import { pool } from "@/lib/db";
import { expireSharedRoutes } from "@/lib/shared-routes/repository";

async function main() {
  const expiredCount = await expireSharedRoutes();
  console.info(`[RouteFit] Expired shared route snapshots purged: ${expiredCount}`);
}

main()
  .catch((error) => {
    console.error("[RouteFit] Failed to purge expired shared route snapshots.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
