import { describe, expect, it } from "vitest";
import { slugify, withDisambiguator } from "./slug";

describe("slugify", () => {
  it("lager en lesbar slug fra en vanlig norsk tittel", () => {
    expect(slugify("Søker personer som har byttet karriere")).toBe(
      "soker-personer-som-har-byttet-karriere"
    );
  });

  it("transkriberer æ, ø og å i stedet for å fjerne dem", () => {
    expect(slugify("Blåbær og trøbbel")).toBe("blaabaer-og-trobbel");
  });

  it("fjerner tegnsetting og kollapser mellomrom til én bindestrek", () => {
    expect(slugify("Hva skjer, egentlig?! Ingen vet.")).toBe(
      "hva-skjer-egentlig-ingen-vet"
    );
  });

  it("trimmer bindestreker i start og slutt", () => {
    expect(slugify("  -Ledende mellomrom-  ")).toBe("ledende-mellomrom");
  });

  it("begrenser lengden til 80 tegn uten å ende med en løs bindestrek", () => {
    const longTitle = "ord ".repeat(30).trim();
    const slug = slugify(longTitle);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("gir en tom streng for en tittel uten gyldige tegn", () => {
    expect(slugify("???")).toBe("");
  });
});

describe("withDisambiguator", () => {
  it("legger til suffiks med bindestrek", () => {
    expect(withDisambiguator("min-sak", 2)).toBe("min-sak-2");
    expect(withDisambiguator("min-sak", 3)).toBe("min-sak-3");
  });
});
