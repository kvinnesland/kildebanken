import { describe, expect, it } from "vitest";
import { db } from "@/db/client";
import { countries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureTestCountry, TEST_COUNTRY_CODE } from "@/db/integration/fixtures";
import { resolveSenderIdentity } from "./sender-identity";

describe("resolveSenderIdentity mot ekte Postgres (SPEC-V1.md 10.4)", () => {
  it("henter landets support_email uendret, og oversetter sender_name_key til gjeldende locale", async () => {
    await ensureTestCountry();

    const identity = await resolveSenderIdentity(TEST_COUNTRY_CODE, "nb-NO");

    expect(identity).not.toBeNull();
    expect(identity?.replyTo).toBe("test@example.invalid");
    // "email.sender_name.test" er bevisst IKKE en ekte oversettelsesnøkkel
    // (samme mønster som "country.test.name" andre steder i testfixturene)
    // — resolveSenderIdentity() skal likevel returnere en STRENG (aldri
    // kaste), siden createTranslator() sin egen graderte reservevei
    // (logging + fallback) håndterer dette, se i18n/get-messages.ts.
    expect(typeof identity?.senderName).toBe("string");
  });

  it("faller tilbake til plattformens standardspråk for en locale landet ikke støtter", async () => {
    await ensureTestCountry();

    const identity = await resolveSenderIdentity(TEST_COUNTRY_CODE, "fr-FR");

    expect(identity).not.toBeNull();
    expect(typeof identity?.senderName).toBe("string");
  });

  it("returnerer null for en landkode som ikke finnes, i stedet for å kaste", async () => {
    const identity = await resolveSenderIdentity("ZZ", "nb-NO");

    expect(identity).toBeNull();
  });

  it("henter DEN OPPDATERTE verdien, ikke en cachet en, etter at landet endres", async () => {
    await ensureTestCountry();
    const [before] = await db
      .select({ supportEmail: countries.supportEmail })
      .from(countries)
      .where(eq(countries.code, TEST_COUNTRY_CODE));
    if (!before) throw new Error("testland mangler");

    await db
      .update(countries)
      .set({ supportEmail: "endret-for-testen@example.invalid" })
      .where(eq(countries.code, TEST_COUNTRY_CODE));

    try {
      const identity = await resolveSenderIdentity(TEST_COUNTRY_CODE, "nb-NO");
      expect(identity?.replyTo).toBe("endret-for-testen@example.invalid");
    } finally {
      await db
        .update(countries)
        .set({ supportEmail: before.supportEmail })
        .where(eq(countries.code, TEST_COUNTRY_CODE));
    }
  });
});
