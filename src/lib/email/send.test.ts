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

  it("faller tilbake til det generiske formatet for maler uten en bygget mal ennå", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "journalist_approved",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { requestId: "some-id" },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] journalist_approved → test@example.com (nb-NO)",
      { requestId: "some-id" }
    );
  });
});
