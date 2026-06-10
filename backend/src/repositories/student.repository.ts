import { eq, and, like, or, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { students, enrolments, classes } from "../db/schema";

export type CreateStudentInput = typeof students.$inferInsert;
export type Student = typeof students.$inferSelect;

export class StudentRepository {
  async create(input: CreateStudentInput, tx: DbClient = db): Promise<Student> {
    const [result] = await tx
      .insert(students)
      .values(input)
      .returning();
    return result;
  }

  async findById(id: string, tx: DbClient = db): Promise<Student | undefined> {
    const [result] = await tx
      .select()
      .from(students)
      .where(eq(students.id, id))
      .limit(1);
    return result;
  }

  async update(id: string, input: Partial<typeof students.$inferInsert>, tx: DbClient = db): Promise<Student> {
    const [result] = await tx
      .update(students)
      .set(input)
      .where(eq(students.id, id))
      .returning();
    return result;
  }

  /**
   * Search and list students under a school tenant.
   * Can join and filter by classId and academicYearId.
   */
  async list(
    schoolId: string,
    filters: { classId?: string; academicYearId?: string; search?: string } = {},
    tx: DbClient = db
  ): Promise<any[]> {
    const conditions: any[] = [eq(students.schoolId, schoolId)];

    if (filters.classId) {
      conditions.push(eq(enrolments.classId, filters.classId));
    }
    if (filters.academicYearId) {
      conditions.push(eq(enrolments.academicYearId, filters.academicYearId));
    }
    
    // Default: only list active enrolments
    conditions.push(or(eq(enrolments.status, "active"), sql`enrolments.status IS NULL`));

    if (filters.search) {
      const searchPattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(students.firstName, searchPattern),
          like(students.lastName, searchPattern),
          like(students.middleName, searchPattern),
          like(students.emisNumber, searchPattern)
        )
      );
    }

    const results = await tx
      .select({
        id: students.id,
        emisNumber: students.emisNumber,
        firstName: students.firstName,
        middleName: students.middleName,
        lastName: students.lastName,
        dateOfBirth: students.dateOfBirth,
        gender: students.gender,
        photoUrl: students.photoUrl,
        guardianName: students.guardianName,
        guardianPhone: students.guardianPhone,
        guardianEmail: students.guardianEmail,
        guardianRelationship: students.guardianRelationship,
        homeAddress: students.homeAddress,
        previousSchool: students.previousSchool,
        createdAt: students.createdAt,
        enrolmentStatus: enrolments.status,
        classId: enrolments.classId,
        className: classes.name,
      })
      .from(students)
      .leftJoin(enrolments, eq(students.id, enrolments.studentId))
      .leftJoin(classes, eq(enrolments.classId, classes.id))
      .where(and(...conditions));

    return results;
  }
}
