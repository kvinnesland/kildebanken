import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Tilkoblingspooling i applikasjonen selv, ikke overlatt til hver funksjon å
// åpne sin egen — se INFRASTRUCTURE.md 4. Én pool per prosess.
//
// I Stadium 0 (Netlify Functions) er hver invokasjon kortlevd, så poolen bør
// holdes liten (max: 1-3) for å ikke sprenge Neons tilkoblingsgrense på tvers
// av samtidige funksjonsinstanser. I Stadium 1 (alltid-kjørende prosess på
// Hetzner) kan poolen dimensjoneres normalt. Denne filen er identisk i begge
// stadier — bare miljøvariabelen endres, jf. INFRASTRUCTURE.md 16.8.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : 3,
});

export const db = drizzle(pool, { schema });
export type Database = typeof db;
