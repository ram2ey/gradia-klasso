import { eq, and, sql } from "drizzle-orm";
import { db, DbClient } from "../db";
import { subjects, Subject } from "../db/schema";

export interface CreateSubjectInput {
  name: string;
  code: string;
  classLevels: number[];
}

export class SubjectRepository {
  /**
   * Lists subjects for a school, optionally filtered by class level.
   */
  async list(
    schoolId: string,
    filters?: { classLevel?: number },
    tx: DbClient = db
  ): Promise<Subject[]> {
    if (filters?.classLevel !== undefined) {
      return tx
        .select()
        .from(subjects)
        .where(
          and(
            eq(subjects.schoolId, schoolId),
            eq(subjects.isActive, true),
            sql`${filters.classLevel} = ANY(${subjects.classLevels})`
          )
        );
    }

    return tx.select().from(subjects).where(eq(subjects.schoolId, schoolId));
  }

  /**
   * Bulk creates subjects for a school.
   */
  async bulkCreate(
    schoolId: string,
    inputs: CreateSubjectInput[],
    tx: DbClient = db
  ): Promise<Subject[]> {
    if (inputs.length === 0) return [];

    const values = inputs.map((input) => ({
      schoolId,
      name: input.name,
      code: input.code,
      classLevels: input.classLevels,
      isActive: true,
    }));

    return tx.insert(subjects).values(values).returning();
  }

  /**
   * Seed default Ghana NaCCA subjects for a school.
   */
  async seedDefaultSubjects(schoolId: string, tx: DbClient = db): Promise<void> {
    const existing = await tx
      .select({ id: subjects.id })
      .from(subjects)
      .where(eq(subjects.schoolId, schoolId))
      .limit(1);

    if (existing.length > 0) return;

    const defaults: CreateSubjectInput[] = [
      { name: "English Language", code: "ENG", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { name: "Mathematics", code: "MAT", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { name: "Integrated Science", code: "SCI", classLevels: [7, 8, 9] },
      { name: "Natural Science", code: "NSCI", classLevels: [1, 2, 3, 4, 5, 6] },
      { name: "Social Studies", code: "SOC", classLevels: [7, 8, 9] },
      { name: "Computing", code: "COMP", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { name: "Creative Arts and Design", code: "CAD", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { name: "Religious and Moral Education", code: "RME", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
      { name: "Career Technology", code: "CARTEC", classLevels: [7, 8, 9] },
      { name: "French", code: "FRN", classLevels: [7, 8, 9] },
      { name: "Ghanaian Language", code: "GHLAN", classLevels: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
    ];

    await this.bulkCreate(schoolId, defaults, tx);
  }
}
