import { describe, expect, it } from "vitest";
import { escapeHtml } from "./escape-html";

describe("escapeHtml", () => {
  it("escaper alle fem spesialtegnene", () => {
    expect(escapeHtml(`<script>alert("x") & 'y'</script>`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;) &amp; &#39;y&#39;&lt;/script&gt;"
    );
  });

  it("escaper & FØRST, slik at den ikke dobbelt-escaper allerede-escapede entiteter", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("lar tekst uten spesialtegn stå uendret", () => {
    expect(escapeHtml("En helt vanlig setning uten noe rart.")).toBe(
      "En helt vanlig setning uten noe rart."
    );
  });

  it("håndterer en tom streng", () => {
    expect(escapeHtml("")).toBe("");
  });
});
