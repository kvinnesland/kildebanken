// Postgres-feilkoder vi faktisk trenger å skille ut i applikasjonslaget.
// node-postgres kaster native `Error`-objekter beriket med et `code`-felt
// (SQLSTATE) — ikke en egen feilklasse, derfor denne hjelpefunksjonen
// fremfor `instanceof`.

const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
