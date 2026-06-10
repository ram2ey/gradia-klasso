import { eq, and } from "drizzle-orm";
import { db, DbClient } from "../db";
import { enrolments, classes, academicYears } from "../db/schema";

export type CreateEnrolmentInput = typeof enrolments.$inferInsert;
export type Enrolment = typeof enrolments.$inferSelect;

export class EnrolmentRepository {
  async create(input: CreateEnrolmentInput, tx: DbClient = db): Promise<Enrolment> {
    const [result] = await tx
      .insert(enrolments)
      .values(input)
      .returning();
    return result;
  }

  async findActiveByStudent(studentId: string, schoolId: string, tx: DbClient = db): Promise<any | undefined> {
    const [result] = await tx
      .select({
        enrolment: enrolments,
        class: classes,
        academicYear: academicYears,
      })
      .from(enrolments)
      .leftJoin(classes, eq(enrolments.classId, classes.id))
      .leftJoin(academicYears, eq(enrolments.academicYearId, academicYears.id))
      .where(
        and(
          eq(enrolments.schoolId, schoolId),
          eq(enrolments.studentId, studentId),
          eq(enrolments.status, "active")
        )
      )
      .limit(1);
    return result;
  }

  async updateStatus(enrolmentId: string, status: "active" | "withdrawn" | "graduated", tx: DbClient = db): Promise<void> {
    await tx
      .update(enrolments)
      .set({ status })
      .where(eq(enrolments.id, enrolmentId));
  }

  /**
   * Transfer student by closing the current active enrolment as 'withdrawn'
   * and opening a new active enrolment in the new class.
   */
  async transfer(
    studentId: string,
    schoolId: string,
    activeEnrolmentId: string,
    newClassId: string,
    academicYearId: string,
    tx: DbClient = db
  ): Promise<Enrolment> {
    // 1. Close current enrolment
    await this.updateStatus(activeEnrolmentId, "withdrawn", tx);

    // 2. Create new active enrolment
    return this.create({
      schoolId,
      studentId,
      classId: newClassId,
      academicYearId,
      status: "active",
    }, tx);
  }
}
