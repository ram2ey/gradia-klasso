import { eq, and } from "drizzle-orm";
import { db, DbClient } from "../db";
import { users } from "../db/schema";

export type CreateUserInput = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export class UserRepository {
  async create(input: CreateUserInput, tx: DbClient = db): Promise<User> {
    const [result] = await tx
      .insert(users)
      .values(input)
      .returning();
    return result;
  }

  async findById(id: string, tx: DbClient = db): Promise<User | undefined> {
    const [result] = await tx
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return result;
  }

  async findByEmailAndSchool(email: string, schoolId: string, tx: DbClient = db): Promise<User | undefined> {
    const [result] = await tx
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.schoolId, schoolId)
        )
      )
      .limit(1);
    return result;
  }

  async listBySchool(schoolId: string, tx: DbClient = db): Promise<User[]> {
    return tx
      .select()
      .from(users)
      .where(eq(users.schoolId, schoolId));
  }
}
