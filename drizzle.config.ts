import { defineConfig } from "drizzle-kit";

// Genererer SQL fra src/db/schema.ts. Kjør med `npm run db:generate`.
// Selve migreringen (src/db/migrate.ts) kjøres som eget steg i deploy,
// aldri automatisk ved appstart — se INFRASTRUCTURE.md 4 og 8.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
