import { config } from "dotenv";
import type { Config } from "drizzle-kit";

config({ path: ".env.local" });
config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 없습니다. .env.local 또는 실행 환경 변수에 Railway PostgreSQL 연결 문자열을 설정해 주세요.");
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL },
} satisfies Config;