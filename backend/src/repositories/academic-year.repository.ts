import { eq, and } from "drizzle-orm";
import { db, DbClient } from "../db";
import { academicYears } from "../db/schema";

export type CreateAcademicYearInput = typeof academicYears.$inferInsert;
export type AcademicYear = typeof academicYears.$inferSelect;

export class AcademicYearRepository {
  async create(input: CreateAcademicYearInput, tx: DbClient = db): Promise<AcademicYear> {
    const [result] = await tx
      .insert(academicYears)
      .values(input)
      .returning();
    return result;
  }

  async findById(id: string, tx: DbClient = db): Promise<AcademicYear | undefined> {
    const [result] = await tx
      .select()
      .from(academicYears)
      .where(eq(academicYears.id, id))
      .limit(1);
    return result;
  }

  async findCurrent(schoolId: string, tx: DbClient = db): Promise<AcademicYear | undefined> {
    const [result] = await tx
      .select()
      .from(academicYears)
      .where(
        and(
          eq(academicYears.schoolId, schoolId),
          eq(academicYears.isCurrent, true)
        )
      )
      .limit(1);
    return result;
  }

  async listAll(schoolId: string, tx: DbClient = db): Promise<AcademicYear[]> {
    return tx
      .select()
      .from(academicYears)
      .where(eq(academicYears.schoolId, schoolId));
  }

  async setCurrent(schoolId: string, id: string, tx: DbClient = db): Promise<void> {
    // 1. Set all school academic years isCurrent to false
    await tx
      .update(academicYears)
      .set({ isCurrent: false })
      .where(eq(academicYears.schoolId, schoolId));

    // 2. Set chosen id isCurrent to true
    await tx
      .update(academicYears)
      .set({ isCurrent: true })
      .where(eq(academicYears.id, id));
  }
}
