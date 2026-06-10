import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { attendanceRecords, AttendanceRecord } from "../db/schema";

export interface CreateAttendanceRecordInput {
  studentId: string;
  classId: string;
  date: string;
  session: "morning" | "afternoon";
  status: "present" | "absent" | "late" | "excused";
  recordedBy: string;
  note?: string;
}

export class AttendanceRepository {
  /**
   * Performs a bulk upsert of attendance records.
   * If a record exists for (schoolId, studentId, date, session), it updates the status, note, and recordedBy fields.
   */
  async bulkUpsert(
    schoolId: string,
    records: CreateAttendanceRecordInput[],
    tx: DbClient = db
  ): Promise<void> {
    if (records.length === 0) return;

    const values = records.map((r) => ({
      schoolId,
      studentId: r.studentId,
      classId: r.classId,
      date: r.date,
      session: r.session,
      status: r.status,
      recordedBy: r.recordedBy,
      note: r.note || null,
    }));

    await tx
      .insert(attendanceRecords)
      .values(values)
      .onConflictDoUpdate({
        target: [
          attendanceRecords.schoolId,
          attendanceRecords.studentId,
          attendanceRecords.date,
          attendanceRecords.session,
        ],
        set: {
          status: sql`EXCLUDED.status`,
          recordedBy: sql`EXCLUDED.recorded_by`,
          note: sql`EXCLUDED.note`,
          createdAt: sql`NOW()`,
        },
      });
  }

  /**
   * Checks if attendance has already been recorded for this class, date, and session.
   */
  async checkSessionExists(
    schoolId: string,
    classId: string,
    dateStr: string,
    session: "morning" | "afternoon",
    tx: DbClient = db
  ): Promise<boolean> {
    const result = await tx
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.classId, classId),
          eq(attendanceRecords.date, dateStr),
          eq(attendanceRecords.session, session)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  /**
   * Retrieves recorded attendance for a class, date, and session.
   */
  async listClassAttendance(
    schoolId: string,
    classId: string,
    dateStr: string,
    session: "morning" | "afternoon",
    tx: DbClient = db
  ): Promise<AttendanceRecord[]> {
    return tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.classId, classId),
          eq(attendanceRecords.date, dateStr),
          eq(attendanceRecords.session, session)
        )
      );
  }

  /**
   * Gets attendance history for a single student over a date range.
   */
  async getStudentHistory(
    schoolId: string,
    studentId: string,
    fromDate: string,
    toDate: string,
    tx: DbClient = db
  ): Promise<AttendanceRecord[]> {
    return tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.studentId, studentId),
          gte(attendanceRecords.date, fromDate),
          lte(attendanceRecords.date, toDate)
        )
      );
  }

  /**
   * Gets all attendance records for a class over a date range (used for summarisation).
   */
  async getClassHistoryRange(
    schoolId: string,
    classId: string,
    fromDate: string,
    toDate: string,
    tx: DbClient = db
  ): Promise<AttendanceRecord[]> {
    return tx
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.schoolId, schoolId),
          eq(attendanceRecords.classId, classId),
          gte(attendanceRecords.date, fromDate),
          lte(attendanceRecords.date, toDate)
        )
      );
  }
}
