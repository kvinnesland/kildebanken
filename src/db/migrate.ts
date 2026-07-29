import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Kjøres som eget deploy-steg, aldri automatisk ved appstart.
// Se INFRASTRUCTURE.md 4 og 8 ("Migrasjoner kjøres som eget steg før ny kode
// starter").
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log("Kjører migrasjoner...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  console.log("Migrasjoner fullført.");

  await pool.end();
}

main().catch((err) => {
  console.error("Migrering feilet:", err);
  process.exit(1);
});
