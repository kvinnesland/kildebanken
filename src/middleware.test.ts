import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeRequest(
  pathname: string,
  headers: Record<string, string> = {},
  init: { method?: string } = {}
) {
  return new NextRequest(new URL(pathname, "https://kildebanken.example"), { headers, ...init });
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

describe("middleware — Content-Security-Policy (INFRASTRUCTURE.md 12: 'CSP uten unsafe-inline')", () => {
  it("script-src inneholder ALDRI 'unsafe-inline' — dette er den faktiske XSS-vektoren kravet beskytter mot", () => {
    const response = middleware(makeRequest("/nb-NO/me"));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).not.toBeNull();

    const scriptSrc = csp?.split(";").find((d) => d.trim().startsWith("script-src"));
    expect(scriptSrc).toBeDefined();
    expect(scriptSrc).not.toContain("unsafe-inline");
  });

  it("style-src har BEVISST 'unsafe-inline' — react-aria-components sin interne HiddenSelect-mekanisme (Select/Checkbox/RadioGroup) krever det, se buildCsp() sin egen kommentar og NATTLOGG.md", () => {
    const response = middleware(makeRequest("/nb-NO/me"));
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).not.toBeNull();

    const styleSrc = csp?.split(";").find((d) => d.trim().startsWith("style-src"));
    expect(styleSrc).toBeDefined();
    expect(styleSrc).toContain("unsafe-inline");
  });

  it("setter en per-forespørsel nonce på script-src, delt med x-nonce-headeren", () => {
    const response = middleware(makeRequest("/nb-NO/me"));
    const csp = response.headers.get("Content-Security-Policy");
    const nonce = response.headers.get("x-nonce");

    expect(nonce).toBeTruthy();
    expect(csp).toContain(`'nonce-${nonce}'`);
  });
});

describe("middleware — fornyer kb_session-cookiens levetid ved bruk (SPEC-V1.md 6.1)", () => {
  function makeRequestWithSessionCookie(pathname: string, rawToken = "test-raw-session-token") {
    const request = makeRequest(pathname);
    request.cookies.set("kb_session", rawToken);
    return request;
  }

  it("setter en fornyet kb_session-cookie når en allerede finnes, på en vanlig side", () => {
    const response = middleware(makeRequestWithSessionCookie("/nb-NO/me"));

    const setCookie = response.cookies.get("kb_session");
    expect(setCookie?.value).toBe("test-raw-session-token");
    expect(setCookie?.maxAge).toBe(30 * 24 * 60 * 60);
    expect(setCookie?.httpOnly).toBe(true);
    expect(setCookie?.secure).toBe(true);
    expect(setCookie?.sameSite).toBe("lax");
  });

  it("setter INGEN kb_session-cookie når ingen fantes i forespørselen", () => {
    const response = middleware(makeRequest("/nb-NO/me"));

    expect(response.cookies.get("kb_session")).toBeUndefined();
  });

  it("fornyer kb_session også for /api-stier, uten å sette CSP/nonce-headere der", () => {
    const response = middleware(makeRequestWithSessionCookie("/api/me"));

    expect(response.cookies.get("kb_session")?.value).toBe("test-raw-session-token");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("x-nonce")).toBeNull();
  });

  it("lar en /api-forespørsel uten kb_session-cookie passere uendret", () => {
    const response = middleware(makeRequest("/api/countries"));

    expect(response.cookies.get("kb_session")).toBeUndefined();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("fornyer kb_session selv på et locale-redirect-svar", () => {
    const response = middleware(makeRequestWithSessionCookie("/me"));

    expect(response.status).not.toBe(200);
    expect(response.cookies.get("kb_session")?.value).toBe("test-raw-session-token");
  });
});

describe("middleware — CSRF-beskyttelse via Origin-verifisering (SPEC-V1.md 18)", () => {
  it("avviser en POST til /api med en fremmed Origin-header (403)", () => {
    const response = middleware(
      makeRequest("/api/subscribe", { origin: "https://ondsinnet.example" }, { method: "POST" })
    );

    expect(response.status).toBe(403);
  });

  it("slipper gjennom en POST til /api med Origin lik forespørselens eget opphav", () => {
    const response = middleware(
      makeRequest("/api/subscribe", { origin: "https://kildebanken.example" }, { method: "POST" })
    );

    expect(response.status).not.toBe(403);
  });

  it("slipper gjennom en POST til /api helt UTEN Origin-header (webhook/e-postklient)", () => {
    const response = middleware(makeRequest("/api/webhooks/email-events", {}, { method: "POST" }));

    expect(response.status).not.toBe(403);
  });

  it("sjekker IKKE Origin på GET (trygg metode), selv med fremmed Origin", () => {
    const response = middleware(
      makeRequest("/api/countries", { origin: "https://ondsinnet.example" }, { method: "GET" })
    );

    expect(response.status).not.toBe(403);
  });

  it("avviser også PUT/PATCH/DELETE med fremmed Origin, ikke bare POST", () => {
    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const response = middleware(
        makeRequest("/api/me", { origin: "https://ondsinnet.example" }, { method })
      );
      expect(response.status).toBe(403);
    }
  });
});
