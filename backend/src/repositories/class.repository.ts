import { eq, and } from "drizzle-orm";
import { db, DbClient } from "../db";
import { classes } from "../db/schema";

export type CreateClassInput = typeof classes.$inferInsert;
export type ClassRecord = typeof classes.$inferSelect;

export class ClassRepository {
  async create(input: CreateClassInput, tx: DbClient = db): Promise<ClassRecord> {
    const [result] = await tx
      .insert(classes)
      .values(input)
      .returning();
    return result;
  }

  async findById(id: string, tx: DbClient = db): Promise<ClassRecord | undefined> {
    const [result] = await tx
      .select()
      .from(classes)
      .where(eq(classes.id, id))
      .limit(1);
    return result;
  }

  async listAll(schoolId: string, tx: DbClient = db): Promise<ClassRecord[]> {
    return tx
      .select()
      .from(classes)
      .where(eq(classes.schoolId, schoolId));
  }

  async listByAcademicYear(schoolId: string, academicYearId: string, tx: DbClient = db): Promise<ClassRecord[]> {
    return tx
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.schoolId, schoolId),
          eq(classes.academicYearId, academicYearId)
        )
      );
  }

  async listByTeacher(schoolId: string, teacherId: string, tx: DbClient = db): Promise<ClassRecord[]> {
    return tx
      .select()
      .from(classes)
      .where(
        and(
          eq(classes.schoolId, schoolId),
          eq(classes.classTeacherId, teacherId)
        )
      );
  }
}
