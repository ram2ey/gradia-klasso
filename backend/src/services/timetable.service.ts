import { withSchoolContext } from "../db";
import { TimetableRepository, CreateTimetableEntryInput } from "../repositories/timetable.repository";
import { AcademicYearRepository } from "../repositories/academic-year.repository";
import { UserRepository } from "../repositories/user.repository";
import { inArray, sql, and, eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../db/schema";

const timetableRepo = new TimetableRepository();
const academicYearRepo = new AcademicYearRepository();
const userRepo = new UserRepository();

export class TimetableService {
  /**
   * Helper: fetches the current academic year, creating a default one if none exists.
   */
  private async getOrInitializeCurrentYear(schoolId: string, tx: any) {
    let year = await academicYearRepo.findCurrent(schoolId, tx);
    if (!year) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 10); // 10 months duration

      year = await academicYearRepo.create({
        schoolId,
        label: `${startDate.getFullYear()}/${startDate.getFullYear() + 1}`,
        startDate,
        endDate,
        isCurrent: true,
      }, tx);
    }
    return year;
  }

  /**
   * Get periods for the school. If none exist, auto-seed defaults.
   */
  async getOrSeedPeriods(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      let currentPeriods = await timetableRepo.listPeriods(schoolId, tx);

      if (currentPeriods.length === 0) {
        // Seed standard Ghanaian basic school period structure
        const defaults = [
          { name: "Period 1", startTime: "08:00:00", endTime: "08:45:00", isBreak: false, sortOrder: 1 },
          { name: "Period 2", startTime: "08:45:00", endTime: "09:30:00", isBreak: false, sortOrder: 2 },
          { name: "Period 3", startTime: "09:30:00", endTime: "10:15:00", isBreak: false, sortOrder: 3 },
          { name: "Morning Break", startTime: "10:15:00", endTime: "10:45:00", isBreak: true, sortOrder: 4 },
          { name: "Period 4", startTime: "10:45:00", endTime: "11:30:00", isBreak: false, sortOrder: 5 },
          { name: "Period 5", startTime: "11:30:00", endTime: "12:15:00", isBreak: false, sortOrder: 6 },
          { name: "Lunch Break", startTime: "12:15:00", endTime: "13:00:00", isBreak: true, sortOrder: 7 },
          { name: "Period 6", startTime: "13:00:00", endTime: "13:45:00", isBreak: false, sortOrder: 8 },
          { name: "Period 7", startTime: "13:45:00", endTime: "14:30:00", isBreak: false, sortOrder: 9 },
        ];

        const inputs = defaults.map((item) => ({
          schoolId,
          ...item,
        }));

        currentPeriods = await timetableRepo.bulkCreatePeriods(inputs, tx);
      }

      return currentPeriods;
    });
  }

  /**
   * Add or update a timetable entry.
   * Performs validation check to avoid double bookings or clashes.
   */
  async addOrUpdateEntry(
    schoolId: string,
    input: {
      id?: string;
      classId: string;
      subjectId: string;
      teacherId?: string | null;
      dayOfWeek: number;
      periodId: string;
    }
  ) {
    return withSchoolContext(schoolId, async (tx) => {
      const activeYear = await this.getOrInitializeCurrentYear(schoolId, tx);
      const academicYearId = activeYear.id;

      // 1. Check class double booking (UNIQUE constraint)
      const classClash = await timetableRepo.checkClassConflict(
        schoolId,
        academicYearId,
        input.classId,
        input.dayOfWeek,
        input.periodId,
        input.id,
        tx
      );

      if (classClash) {
        throw new Error("Class double-booking detected: This class stream already has a subject scheduled during this period.");
      }

      // 2. Check teacher conflict (if teacher is assigned)
      if (input.teacherId) {
        const teacherClash = await timetableRepo.checkTeacherConflict(
          schoolId,
          academicYearId,
          input.teacherId,
          input.dayOfWeek,
          input.periodId,
          input.id,
          tx
        );

        if (teacherClash) {
          throw new Error("Teacher clash detected: The selected teacher is already scheduled to teach another class during this period.");
        }
      }

      // 3. Upsert
      if (input.id) {
        // Update
        return timetableRepo.updateEntry(input.id, {
          subjectId: input.subjectId,
          teacherId: input.teacherId || null,
          dayOfWeek: input.dayOfWeek,
          periodId: input.periodId,
        }, tx);
      } else {
        // Insert (Wait, what if they submit without ID but there is a slot? Drizzle check classClash ensures uniqueness)
        return timetableRepo.createEntry({
          schoolId,
          classId: input.classId,
          subjectId: input.subjectId,
          teacherId: input.teacherId || null,
          dayOfWeek: input.dayOfWeek,
          periodId: input.periodId,
          academicYearId,
        }, tx);
      }
    });
  }

  /**
   * Delete a timetable entry
   */
  async deleteEntry(schoolId: string, id: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const entry = await timetableRepo.findEntryById(id, tx);
      if (!entry) {
        throw new Error("Timetable entry not found");
      }
      return timetableRepo.deleteEntry(id, tx);
    });
  }

  /**
   * Get class weekly schedule
   */
  async getClassTimetable(schoolId: string, classId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const activeYear = await this.getOrInitializeCurrentYear(schoolId, tx);
      const schedule = await timetableRepo.listByClass(schoolId, classId, activeYear.id, tx);
      const periodsList = await this.getOrSeedPeriods(schoolId);

      return {
        periods: periodsList,
        entries: schedule,
        academicYear: activeYear,
      };
    });
  }

  /**
   * Get teacher weekly schedule
   */
  async getTeacherTimetable(schoolId: string, teacherId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const activeYear = await this.getOrInitializeCurrentYear(schoolId, tx);
      const schedule = await timetableRepo.listByTeacher(schoolId, teacherId, activeYear.id, tx);
      const periodsList = await this.getOrSeedPeriods(schoolId);

      return {
        periods: periodsList,
        entries: schedule,
        academicYear: activeYear,
      };
    });
  }

  /**
   * Get conflicts in the current academic year
   */
  async getConflicts(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      const activeYear = await this.getOrInitializeCurrentYear(schoolId, tx);
      return timetableRepo.getAllConflicts(schoolId, activeYear.id, tx);
    });
  }

  /**
   * Get list of teachers in school for selection list dropdown
   */
  async getTeachers(schoolId: string) {
    return withSchoolContext(schoolId, async (tx) => {
      return tx
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(
          and(
            eq(users.schoolId, schoolId),
            inArray(users.role, ["headteacher", "class_teacher"])
          )
        );
    });
  }
}
