import { withSchoolContext } from "../db";
import { AttendanceRepository, CreateAttendanceRecordInput } from "../repositories/attendance.repository";
import { ClassRepository } from "../repositories/class.repository";
import { StudentRepository } from "../repositories/student.repository";

const attendanceRepo = new AttendanceRepository();
const classRepo = new ClassRepository();
const studentRepo = new StudentRepository();

export interface BulkSubmitRecordInput {
  studentId: string;
  status: "present" | "absent" | "late" | "excused";
  note?: string;
}

export class AttendanceService {
  /**
   * Submits a full class attendance roster bulk log.
   * Enforces role locks (only class teachers or headteachers can submit) and override logic.
   */
  async submitClassAttendance(
    schoolId: string,
    recordedBy: string,
    userRole: string,
    classId: string,
    dateStr: string,
    session: "morning" | "afternoon",
    records: BulkSubmitRecordInput[],
    forceOverride = false
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      // 1. Enforce Role & Ownership checks
      const targetClass = await classRepo.findById(classId, tx);
      if (!targetClass) {
        throw new Error("Class not found");
      }

      if (userRole !== "headteacher") {
        if (userRole === "class_teacher") {
          if (targetClass.classTeacherId !== recordedBy) {
            throw new Error("Forbidden: You are not the assigned teacher for this class stream");
          }
        } else {
          throw new Error("Forbidden: Only headteachers and class teachers can record attendance");
        }
      }

      // 2. Check if session already recorded
      const alreadySubmitted = await attendanceRepo.checkSessionExists(schoolId, classId, dateStr, session, tx);
      if (alreadySubmitted && !forceOverride) {
        if (userRole === "headteacher") {
          throw new Error("WARNING: Attendance already recorded for this session. Headteacher override required.");
        } else {
          throw new Error("Forbidden: Attendance has already been submitted for this session. Only Headteachers can override logs.");
        }
      }

      // 3. Map inputs and invoke bulk upsert
      const mappedRecords: CreateAttendanceRecordInput[] = records.map((r) => ({
        studentId: r.studentId,
        classId,
        date: dateStr,
        session,
        status: r.status,
        recordedBy,
        note: r.note,
      }));

      await attendanceRepo.bulkUpsert(schoolId, mappedRecords, tx);

      return {
        message: "Attendance recorded successfully",
        count: records.length,
        overridden: alreadySubmitted && forceOverride,
      };
    });
  }

  /**
   * Lists records for a class on a date and session.
   */
  async getClassAttendance(
    schoolId: string,
    classId: string,
    dateStr: string,
    session: "morning" | "afternoon"
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      return attendanceRepo.listClassAttendance(schoolId, classId, dateStr, session, tx);
    });
  }

  /**
   * Lists attendance logs for a single student over a date range.
   */
  async getStudentHistory(schoolId: string, studentId: string, fromDate: string, toDate: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return attendanceRepo.getStudentHistory(schoolId, studentId, fromDate, toDate, tx);
    });
  }

  /**
   * Compiles attendance metrics and percentages per student in a class.
   */
  async getClassSummary(schoolId: string, classId: string, fromDate: string, toDate: string) {
    return withSchoolContext(schoolId, async (tx) => {
      // 1. Fetch historical logs
      const logs = await attendanceRepo.getClassHistoryRange(schoolId, classId, fromDate, toDate, tx);
      
      // 2. Fetch class roster to ensure all students are included in statistics
      const roster = await studentRepo.list(schoolId, { classId }, tx);

      // Map statistics
      const summary = roster.map((student) => {
        const studentLogs = logs.filter((l) => l.studentId === student.id);
        
        let presentCount = 0;
        let absentCount = 0;
        let lateCount = 0;
        let excusedCount = 0;

        studentLogs.forEach((l) => {
          if (l.status === "present") presentCount++;
          else if (l.status === "absent") absentCount++;
          else if (l.status === "late") lateCount++;
          else if (l.status === "excused") excusedCount++;
        });

        const totalSessions = studentLogs.length;
        // Calculate percentage: Late and Excused count towards presence
        const presenceDays = presentCount + lateCount + excusedCount;
        const percentage = totalSessions > 0 ? Math.round((presenceDays / totalSessions) * 100) : 100;

        return {
          studentId: student.id,
          firstName: student.firstName,
          lastName: student.lastName,
          photoUrl: student.photoUrl,
          presentCount,
          absentCount,
          lateCount,
          excusedCount,
          totalSessions,
          percentage,
        };
      });

      return summary;
    });
  }
}
