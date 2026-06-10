import { eq } from "drizzle-orm";
import { db, DbClient } from "../db";
import { schools } from "../db/schema";

export type CreateSchoolInput = typeof schools.$inferInsert;
export type School = typeof schools.$inferSelect;

export class SchoolRepository {
  async create(input: CreateSchoolInput, tx: DbClient = db): Promise<School> {
    const [result] = await tx
      .insert(schools)
      .values(input)
      .returning();
    return result;
  }

  async findById(id: string, tx: DbClient = db): Promise<School | undefined> {
    const [result] = await tx
      .select()
      .from(schools)
      .where(eq(schools.id, id))
      .limit(1);
    return result;
  }

  async findBySubdomain(subdomain: string, tx: DbClient = db): Promise<School | undefined> {
    const [result] = await tx
      .select()
      .from(schools)
      .where(eq(schools.subdomain, subdomain))
      .limit(1);
    return result;
  }

  async findByEmisCode(emisCode: string, tx: DbClient = db): Promise<School | undefined> {
    const [result] = await tx
      .select()
      .from(schools)
      .where(eq(schools.emisSchoolCode, emisCode))
      .limit(1);
    return result;
  }

  async update(id: string, input: Partial<CreateSchoolInput>, tx: DbClient = db): Promise<School> {
    const [result] = await tx
      .update(schools)
      .set(input)
      .where(eq(schools.id, id))
      .returning();
    return result;
  }
}
