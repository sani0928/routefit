import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { routefitPool?: Pool };

const connectionString = process.env.DATABASE_URL;
export const pool = globalForDb.routefitPool ?? new Pool({
  connectionString,
  ssl: connectionString?.includes("localhost") ? false : { rejectUnauthorized: false },
});

if (process.env.NODE_ENV !== "production") globalForDb.routefitPool = pool;
export const db = drizzle(pool, { schema });
export { schema };