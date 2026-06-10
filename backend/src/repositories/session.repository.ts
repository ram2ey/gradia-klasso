import { eq, and } from "drizzle-orm";
import { db, DbClient } from "../db";
import { sessions } from "../db/schema";

export type CreateSessionInput = typeof sessions.$inferInsert;
export type Session = typeof sessions.$inferSelect;

export class SessionRepository {
  async create(input: CreateSessionInput, tx: DbClient = db): Promise<Session> {
    const [result] = await tx
      .insert(sessions)
      .values(input)
      .returning();
    return result;
  }

  async findByTokenHash(tokenHash: string, tx: DbClient = db): Promise<Session | undefined> {
    const [result] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.refreshTokenHash, tokenHash))
      .limit(1);
    return result;
  }

  async delete(id: string, tx: DbClient = db): Promise<void> {
    await tx
      .delete(sessions)
      .where(eq(sessions.id, id));
  }

  async deleteByTokenHash(tokenHash: string, tx: DbClient = db): Promise<void> {
    await tx
      .delete(sessions)
      .where(eq(sessions.refreshTokenHash, tokenHash));
  }

  async deleteUserSessions(userId: string, tx: DbClient = db): Promise<void> {
    await tx
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }
}
