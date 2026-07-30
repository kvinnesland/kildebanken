import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail } from "./send";

describe("sendTransactionalEmail (stub uten BREVO_API_KEY)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("logger den faktisk rendrede malen for magic_link, ikke bare navn+data", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "magic_link",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { token: "abc123" },
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Din innloggingslenke");
    expect(loggedMessage).toContain("/api/auth/verify?token=abc123&locale=nb-NO");
  });

  it("logger den faktisk rendrede malen for journalist_application_received", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "journalist_application_received",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { token: "abc123" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Søknaden din er mottatt");
  });

  it("logger den faktisk rendrede malen for confirm_email", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "confirm_email",
      to: { email: "test@example.com", locale: "en-GB" },
      data: { token: "xyz789" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Confirm your email address");
  });

  it("logger den faktisk rendrede malen for response_submitted_receipt", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "response_submitted_receipt",
      to: { email: "respondent@example.com", locale: "nb-NO" },
      data: { requestId: "req-1", requestTitle: "En testforespørsel", requestSlug: "en-testforesporsel" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Kvittering: Svaret ditt er sendt");
    expect(loggedMessage).toContain("En testforespørsel");
  });

  it("logger den faktisk rendrede malen for new_response_received", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "new_response_received",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { requestId: "req-1", requestTitle: "En testforespørsel", requestSlug: "en-testforesporsel" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Nytt svar mottatt");
  });

  it("faller tilbake til det generiske formatet når data mangler feltene den ene malen faktisk trenger", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "response_submitted_receipt",
      to: { email: "respondent@example.com", locale: "nb-NO" },
      data: { requestId: "req-1" }, // mangler requestTitle/requestSlug
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] response_submitted_receipt → respondent@example.com (nb-NO)",
      { requestId: "req-1" }
    );
  });

  it("logger den faktisk rendrede malen for journalist_approved (ingen data trengs, bare token-løs godkjenning)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "journalist_approved",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: {},
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Journalistkontoen din er godkjent");
  });

  it("logger den faktisk rendrede malen for confirm_account_deletion", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "confirm_account_deletion",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { token: "del-token-abc" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Bekreft sletting av kontoen din");
    expect(loggedMessage).toContain("/me/slett-konto?token=del-token-abc");
  });

  it("logger den faktisk rendrede malen for account_deletion_confirmed (ingen data trengs)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "account_deletion_confirmed",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: {},
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Kontoen din er slettet");
  });

  it("logger den faktisk rendrede malen for journalist_rejected, med begrunnelsen satt inn i teksten", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "journalist_rejected",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { reason: "Kunne ikke bekrefte tilknytning til oppgitt redaksjon." },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Journalistsøknaden din er avvist");
    expect(loggedMessage).toContain("Kunne ikke bekrefte tilknytning til oppgitt redaksjon.");
  });

  it("faller tilbake til det generiske formatet for maler uten en bygget mal ennå", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "contact_approved",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { requestId: "some-id" },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] contact_approved → test@example.com (nb-NO)",
      { requestId: "some-id" }
    );
  });
});
