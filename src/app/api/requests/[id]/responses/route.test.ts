import { describe, expect, it, vi } from "vitest";

// Ingen testfil eksisterte for denne ruten fra før. Fokus: den ENE, ekte
// mangelen funnet ved en fersk FR-002-sjekk (se NATTLOGG.md) — ternary-en
// som mapper submitResponse()s feilkoder til HTTP-status manglet en
// eksplisitt errors.not_authorized → 403-gren, til forskjell fra samtlige
// søsterruter i kodebasen, og falt derfor gjennom til den generiske 422.
//
// Testet som et RENT enhetsnivå (mocker submitResponse()/getCurrentSession()
// direkte) i stedet for en full databasedrevet integrasjonstest: den
// virkelige feilveien denne fiksen dekker er et forsvar-i-dybden-tilfelle
// (submitResponse() sin egen ferske DB-sjekk av respondentens status,
// atskilt fra den økt-baserte sjekken ruten selv gjør) som i praksis ikke
// er nåbart via et ekte, sekvensielt HTTP-kall — getCurrentSession() gjør
// sin EGEN ferske statussjekk og returnerer null (401) lenge før
// submitResponse() i det hele tatt kalles for en ikke-aktiv konto. Selve
// ternary-logikken i ruten er likevel korrekt å rette, for konsistens med
// alle søsterruter og som et reelt (om enn smalt) forsvar mot en fremtidig
// kodeendring som kobler de to sjekkene fra hverandre.

vi.mock("@/lib/auth/session", () => ({
  getCurrentSession: vi.fn(),
}));
vi.mock("@/lib/responses/responses", () => ({
  submitResponse: vi.fn(),
}));

import { getCurrentSession } from "@/lib/auth/session";
import { submitResponse } from "@/lib/responses/responses";
import { POST } from "./route";

function postRequest(body: unknown): Request {
  return new Request("https://kildebanken.example/api/requests/x/responses", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  relevanceStatement: "Jeg er relevant fordi X.",
  answerText: "Svaret mitt på spørsmålet.",
  contactSharing: "none" as const,
};

describe("POST /requests/:id/responses", () => {
  it("returnerer 403 (ikke den generiske 422) når submitResponse() svarer errors.not_authorized", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      role: "recipient",
      countryCode: "NO",
      locale: "nb-NO",
      email: "test@example.invalid",
    });
    vi.mocked(submitResponse).mockResolvedValue({ ok: false, error: "errors.not_authorized" });

    const response = await POST(postRequest(validBody), { params: Promise.resolve({ id: "request-1" }) });
    const data: { error?: string } = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe("errors.not_authorized");
  });

  it("returnerer fortsatt 404/409/429 uendret for de andre kjente feilkodene", async () => {
    vi.mocked(getCurrentSession).mockResolvedValue({
      sessionId: "session-1",
      userId: "user-1",
      role: "recipient",
      countryCode: "NO",
      locale: "nb-NO",
      email: "test@example.invalid",
    });

    vi.mocked(submitResponse).mockResolvedValueOnce({ ok: false, error: "errors.not_found" });
    const notFound = await POST(postRequest(validBody), { params: Promise.resolve({ id: "request-1" }) });
    expect(notFound.status).toBe(404);

    vi.mocked(submitResponse).mockResolvedValueOnce({ ok: false, error: "errors.already_responded" });
    const conflict = await POST(postRequest(validBody), { params: Promise.resolve({ id: "request-1" }) });
    expect(conflict.status).toBe(409);

    vi.mocked(submitResponse).mockResolvedValueOnce({ ok: false, error: "errors.rate_limited" });
    const rateLimited = await POST(postRequest(validBody), { params: Promise.resolve({ id: "request-1" }) });
    expect(rateLimited.status).toBe(429);
  });
});
