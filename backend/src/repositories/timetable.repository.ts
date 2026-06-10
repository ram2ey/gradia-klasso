import { eq, and, sql, ne } from "drizzle-orm";
import { db, DbClient } from "../db";
import { periods, Period, timetableEntries, TimetableEntry, users, subjects, classes } from "../db/schema";

export type CreatePeriodInput = typeof periods.$inferInsert;
export type CreateTimetableEntryInput = typeof timetableEntries.$inferInsert;

export class TimetableRepository {
  /**
   * List periods sorted by sort_order
   */
  async listPeriods(schoolId: string, tx: DbClient = db): Promise<Period[]> {
    return tx
      .select()
      .from(periods)
      .where(eq(periods.schoolId, schoolId))
      .orderBy(periods.sortOrder);
  }

  /**
   * Bulk insert periods
   */
  async bulkCreatePeriods(inputs: CreatePeriodInput[], tx: DbClient = db): Promise<Period[]> {
    if (inputs.length === 0) return [];
    return tx.insert(periods).values(inputs).returning();
  }

  /**
   * Find entry by ID
   */
  async findEntryById(id: string, tx: DbClient = db): Promise<TimetableEntry | undefined> {
    const [result] = await tx
      .select()
      .from(timetableEntries)
      .where(eq(timetableEntries.id, id))
      .limit(1);
    return result;
  }

  /**
   * Create a single timetable slot
   */
  async createEntry(input: CreateTimetableEntryInput, tx: DbClient = db): Promise<TimetableEntry> {
    const [result] = await tx.insert(timetableEntries).values(input).returning();
    return result;
  }

  /**
   * Update a timetable slot
   */
  async updateEntry(id: string, input: Partial<CreateTimetableEntryInput>, tx: DbClient = db): Promise<TimetableEntry> {
    const [result] = await tx
      .update(timetableEntries)
      .set(input)
      .where(eq(timetableEntries.id, id))
      .returning();
    return result;
  }

  /**
   * Delete a slot
   */
  async deleteEntry(id: string, tx: DbClient = db): Promise<boolean> {
    const result = await tx.delete(timetableEntries).where(eq(timetableEntries.id, id)).returning();
    return result.length > 0;
  }

  /**
   * Checks if a class is already booked at a given slot (excluding a specific entry id if updating)
   */
  async checkClassConflict(
    schoolId: string,
    academicYearId: string,
    classId: string,
    dayOfWeek: number,
    periodId: string,
    excludeEntryId?: string,
    tx: DbClient = db
  ): Promise<TimetableEntry | undefined> {
    const conditions = [
      eq(timetableEntries.schoolId, schoolId),
      eq(timetableEntries.academicYearId, academicYearId),
      eq(timetableEntries.classId, classId),
      eq(timetableEntries.dayOfWeek, dayOfWeek),
      eq(timetableEntries.periodId, periodId),
    ];

    if (excludeEntryId) {
      conditions.push(ne(timetableEntries.id, excludeEntryId));
    }

    const [result] = await tx
      .select()
      .from(timetableEntries)
      .where(and(...conditions))
      .limit(1);

    return result;
  }

  /**
   * Checks if a teacher is already booked at a given slot (excluding a specific entry id if updating)
   */
  async checkTeacherConflict(
    schoolId: string,
    academicYearId: string,
    teacherId: string,
    dayOfWeek: number,
    periodId: string,
    excludeEntryId?: string,
    tx: DbClient = db
  ): Promise<TimetableEntry | undefined> {
    const conditions = [
      eq(timetableEntries.schoolId, schoolId),
      eq(timetableEntries.academicYearId, academicYearId),
      eq(timetableEntries.teacherId, teacherId),
      eq(timetableEntries.dayOfWeek, dayOfWeek),
      eq(timetableEntries.periodId, periodId),
    ];

    if (excludeEntryId) {
      conditions.push(ne(timetableEntries.id, excludeEntryId));
    }

    const [result] = await tx
      .select()
      .from(timetableEntries)
      .where(and(...conditions))
      .limit(1);

    return result;
  }

  /**
   * Get class schedule (with subject and teacher details)
   */
  async listByClass(
    schoolId: string,
    classId: string,
    academicYearId: string,
    tx: DbClient = db
  ) {
    return tx
      .select({
        id: timetableEntries.id,
        schoolId: timetableEntries.schoolId,
        classId: timetableEntries.classId,
        subjectId: timetableEntries.subjectId,
        teacherId: timetableEntries.teacherId,
        dayOfWeek: timetableEntries.dayOfWeek,
        periodId: timetableEntries.periodId,
        academicYearId: timetableEntries.academicYearId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
      })
      .from(timetableEntries)
      .innerJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .leftJoin(users, eq(timetableEntries.teacherId, users.id))
      .where(
        and(
          eq(timetableEntries.schoolId, schoolId),
          eq(timetableEntries.classId, classId),
          eq(timetableEntries.academicYearId, academicYearId)
        )
      );
  }

  /**
   * Get teacher schedule (with class and subject details)
   */
  async listByTeacher(
    schoolId: string,
    teacherId: string,
    academicYearId: string,
    tx: DbClient = db
  ) {
    return tx
      .select({
        id: timetableEntries.id,
        schoolId: timetableEntries.schoolId,
        classId: timetableEntries.classId,
        subjectId: timetableEntries.subjectId,
        teacherId: timetableEntries.teacherId,
        dayOfWeek: timetableEntries.dayOfWeek,
        periodId: timetableEntries.periodId,
        academicYearId: timetableEntries.academicYearId,
        subjectName: subjects.name,
        subjectCode: subjects.code,
        className: classes.name,
      })
      .from(timetableEntries)
      .innerJoin(subjects, eq(timetableEntries.subjectId, subjects.id))
      .innerJoin(classes, eq(timetableEntries.classId, classes.id))
      .where(
        and(
          eq(timetableEntries.schoolId, schoolId),
          eq(timetableEntries.teacherId, teacherId),
          eq(timetableEntries.academicYearId, academicYearId)
        )
      );
  }

  /**
   * Detect and return all conflicts in the timetable (any slots where double bookings of teachers exist, if any)
   */
  async getAllConflicts(schoolId: string, academicYearId: string, tx: DbClient = db) {
    // A teacher clash occurs when same teacher is scheduled for different classes at same day and period.
    const alias1 = timetableEntries;
    const alias2 = timetableEntries;

    // Self join query to locate clashing rows
    // It finds slots with same teacherId, dayOfWeek, periodId, academicYearId but different classId (hence different entries)
    return tx
      .select({
        teacherId: users.id,
        teacherFirstName: users.firstName,
        teacherLastName: users.lastName,
        dayOfWeek: timetableEntries.dayOfWeek,
        periodId: timetableEntries.periodId,
        periodName: periods.name,
        class1Id: timetableEntries.classId,
        class1Name: sql<string>`c1.name`,
        class2Id: sql<string>`t2.class_id`,
        class2Name: sql<string>`c2.name`,
        entry1Id: timetableEntries.id,
        entry2Id: sql<string>`t2.id`,
      })
      .from(timetableEntries)
      .innerJoin(users, eq(timetableEntries.teacherId, users.id))
      .innerJoin(periods, eq(timetableEntries.periodId, periods.id))
      .innerJoin(sql`timetable_entries t2`, sql`
        ${timetableEntries.schoolId} = t2.school_id AND
        ${timetableEntries.academicYearId} = t2.academic_year_id AND
        ${timetableEntries.teacherId} = t2.teacher_id AND
        ${timetableEntries.dayOfWeek} = t2.day_of_week AND
        ${timetableEntries.periodId} = t2.period_id AND
        ${timetableEntries.id} < t2.id
      `)
      .innerJoin(sql`classes c1`, sql`${timetableEntries.classId} = c1.id`)
      .innerJoin(sql`classes c2`, sql`t2.class_id = c2.id`)
      .where(
        and(
          eq(timetableEntries.schoolId, schoolId),
          eq(timetableEntries.academicYearId, academicYearId)
        )
      );
  }
}
