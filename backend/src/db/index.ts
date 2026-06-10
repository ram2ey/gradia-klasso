import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set in environment variables");
}

export const pgPool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pgPool, { schema });

/**
 * Executes a database operation within a transaction, configuring PostgreSQL session context
 * for Row-Level Security (RLS). This isolates queries to the specific tenant (school).
 * 
 * @param schoolId The UUID of the school tenant
 * @param callback The DB query operations to execute inside this context
 */
export async function withSchoolContext<T>(
  schoolId: string,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");
    // Set the session-local configuration setting app.current_school_id
    // This variable will be read by the PostgreSQL RLS policy.
    await client.query(`SELECT set_config('app.current_school_id', $1, true)`, [schoolId]);
    
    // Create a temporary drizzle instance bound to this specific client
    const txDb = drizzle(client, { schema });
    
    const result = await callback(txDb as any);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export type DbClient = typeof db;
