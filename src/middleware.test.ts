import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeRequest(pathname: string, headers: Record<string, string> = {}) {
  return new NextRequest(new URL(pathname, "https://kildebanken.example"), { headers });
}

describe("middleware — locale-oversatte forespørsel-stier (SPEC-V1.md 3.7)", () => {
  it("skriver om en-GB sitt eget ord (requests) til det faktiske mappenavnet, uten å endre adresselinjen", () => {
    const response = middleware(makeRequest("/en-GB/requests/req-1/my-slug"));
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "https://kildebanken.example/en-GB/foresporsler/req-1/my-slug"
    );
  });

  it("redirecter nb-NO sitt ord brukt under en-GB til en-GB sitt eget, riktige ord", () => {
    const response = middleware(makeRequest("/en-GB/foresporsler/req-1/my-slug"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://kildebanken.example/en-GB/requests/req-1/my-slug");
  });

  it("lar nb-NO sin egen, korrekte sti stå helt uendret", () => {
    const response = middleware(makeRequest("/nb-NO/foresporsler/req-1/min-sak"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.status).not.toBe(308);
  });

  it("påvirker ikke andre stier (f.eks. /me)", () => {
    const response = middleware(makeRequest("/nb-NO/me"));
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(response.status).not.toBe(308);
  });
});
