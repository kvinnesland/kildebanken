import { db } from "./client";
import { countries } from "./schema";

// Seeder kun landkonfigurasjonen for Norge (SPEC-V1.md 3.3, 26.1 punkt 1).
// Status er bevisst "draft", ikke "active" — å sette et land aktivt krever at
// juridisk gjennomgåtte vilkår og personvernerklæring finnes i alle
// tilgjengelige locales (LegalDocument, se 19.2) og at minst én moderator er
// tildelt landet (ModeratorCountry, 19.4). Det er en administrativ handling
// i produksjon (`/admin/countries`), ikke noe som skal skje via seed-scriptet
// mot et ekte miljø. Dette scriptet er for lokal utvikling og testmiljø.
async function main() {
  await db
    .insert(countries)
    .values({
      code: "NO",
      nameKey: "country.no.name",
      defaultLocale: "nb-NO",
      availableLocales: ["nb-NO"],
      timezone: "Europe/Oslo",
      minimumAge: 18,
      digestSendTime: "07:00",
      senderNameKey: "email.sender_name.no",
      supportEmail: "kontakt@tjenesten.no",
      status: "draft",
    })
    .onConflictDoNothing();

  console.log("Seed fullført: land NO (draft).");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed feilet:", err);
  process.exit(1);
});
