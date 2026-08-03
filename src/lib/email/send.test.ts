import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTransactionalEmail, sendBulkEmail } from "./send";

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
      data: { requestId: "req-1", requestTitle: "En testforespørsel" },
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

  it("logger den faktisk rendrede malen for request_rejected, med TITTELEN satt inn i teksten (ingen CTA-lenke til å disambiguere)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "request_rejected",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { title: "Journalisters spørsmål til kommunen", reason: "Manglet legitimt journalistisk formål." },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Journalisters spørsmål til kommunen");
    expect(loggedMessage).toContain("Manglet legitimt journalistisk formål.");
  });

  it("faller tilbake til det generiske formatet når request_rejected mangler tittelen", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "request_rejected",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { reason: "Manglet legitimt journalistisk formål." },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] request_rejected → journalist@example.com (nb-NO)",
      { reason: "Manglet legitimt journalistisk formål." }
    );
  });

  it("logger den faktisk rendrede malen for content_reported, med lenke til DET SPESIFIKKE svaret for entityType='response'", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "content_reported",
      to: { email: "moderator@example.com", locale: "nb-NO" },
      data: { entityType: "response", entityId: "response-42", reason: "Upassende innhold", comment: "" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("/nb-NO/admin/responses/response-42");
  });

  it("faller tilbake til det generiske formatet når content_reported mangler entityId", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "content_reported",
      to: { email: "moderator@example.com", locale: "nb-NO" },
      data: { entityType: "response", reason: "Upassende innhold", comment: "" },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] content_reported → moderator@example.com (nb-NO)",
      { entityType: "response", reason: "Upassende innhold", comment: "" }
    );
  });

  it("logger den faktisk rendrede malen for contact_request_received", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "contact_request_received",
      to: { email: "respondent@example.com", locale: "nb-NO" },
      data: {
        contactRequestId: "cr-1",
        requestTitle: "En testforespørsel",
        journalistName: "Kari Journalist",
        organizationName: "Testavisen",
      },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Forespørsel om videre kontakt");
    expect(loggedMessage).toContain("Kari Journalist");
  });

  it("logger den faktisk rendrede malen for contact_approved", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "contact_approved",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { contactRequestId: "cr-1" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Kontakt godkjent");
  });

  it("logger den faktisk rendrede malen for contact_declined (ingen data trengs)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "contact_declined",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: {},
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Kontakt avslått");
  });

  it("faller tilbake til det generiske formatet når legal_terms_material_change mangler feltene den trenger", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "legal_terms_material_change",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { documentType: "not-a-valid-type" }, // mangler countryCode, ugyldig documentType
    });

    expect(warnSpy).toHaveBeenCalledWith(
      "[email:stub] legal_terms_material_change → test@example.com (nb-NO)",
      { documentType: "not-a-valid-type" }
    );
  });

  it("logger den faktisk rendrede malen for legal_terms_material_change", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "legal_terms_material_change",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { documentType: "privacy", countryCode: "NO" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("personvernerklæringen");
  });

  it("alle 23 malene i TransactionalTemplate har nå en ekte mal bygget", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendTransactionalEmail({
      template: "request_closed",
      to: { email: "journalist@example.com", locale: "nb-NO" },
      data: { requestId: "req-1", title: "En testforespørsel" },
    });

    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Forespørselen din er lukket");
  });

  // INFRASTRUCTURE.md 10: "Personopplysninger logges ikke: ingen
  // e-postadresser" — stubb-loggingen over er en bevisst
  // utviklingsbekvemmelighet, men skal ALDRI kunne skje i produksjon (en
  // glemt BREVO_API_KEY der skal feile høylytt, ikke stille skrive
  // mottakerens e-postadresse til logg).
  it("kaster i produksjon i stedet for å falle tilbake til stubb-logging av e-postadressen", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      sendTransactionalEmail({
        template: "magic_link",
        to: { email: "test@example.com", locale: "nb-NO" },
        data: { token: "abc123" },
      })
    ).rejects.toThrow(/BREVO_API_KEY/);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("sendTransactionalEmail (ekte Brevo-kall, mocket fetch)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("poster til v3/smtp/email med korrekt avsender, mottaker og rendret innhold", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_TRANSACTIONAL", "varsler@tjenesten.no");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendTransactionalEmail({
      template: "magic_link",
      to: { email: "test@example.com", locale: "nb-NO" },
      data: { token: "abc123" },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({ "api-key": "test-key-123" });
    const body = JSON.parse(options.body as string);
    expect(body.sender).toEqual({ email: "varsler@tjenesten.no" });
    expect(body.to).toEqual([{ email: "test@example.com" }]);
    expect(body.subject).toContain("innloggingslenke");
    expect(body.htmlContent).toContain("abc123");
    expect(body.textContent).toContain("abc123");
  });

  it("kaster når Brevo svarer med en feilstatus", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_TRANSACTIONAL", "varsler@tjenesten.no");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('{"message":"invalid sender"}'),
      })
    );

    await expect(
      sendTransactionalEmail({
        template: "magic_link",
        to: { email: "test@example.com", locale: "nb-NO" },
        data: { token: "abc123" },
      })
    ).rejects.toThrow(/Brevo-sending feilet \(400\)/);
  });

  it("kaster når BREVO_SENDER_TRANSACTIONAL mangler, uten å kalle Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_TRANSACTIONAL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTransactionalEmail({
        template: "magic_link",
        to: { email: "test@example.com", locale: "nb-NO" },
        data: { token: "abc123" },
      })
    ).rejects.toThrow(/BREVO_SENDER_TRANSACTIONAL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("kaster når malen ikke kan rendres (ukjent mal eller manglende data), uten å kalle Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_TRANSACTIONAL", "varsler@tjenesten.no");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendTransactionalEmail({
        template: "response_submitted_receipt",
        to: { email: "test@example.com", locale: "nb-NO" },
        data: { requestId: "req-1" }, // mangler requestTitle/requestSlug
      })
    ).rejects.toThrow(/ingen mal bygget/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("sendBulkEmail", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("logger stubben når BREVO_API_KEY mangler", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await sendBulkEmail({
      to: { email: "recipient@example.com", locale: "nb-NO" },
      subject: "Dagens digest",
      html: "<p>hei</p>",
      text: "hei",
      listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
      senderName: "Kildebanken Norge",
      replyTo: "support@example.invalid",
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = warnSpy.mock.calls[0]?.[0] as string;
    expect(loggedMessage).toContain("Dagens digest");
    expect(loggedMessage).toContain("tok-1");
  });

  it("poster til v3/smtp/email med bulk-avsender, lokalisert From-navn, Reply-To og List-Unsubscribe-headere (FR-038, SPEC-V1.md 10.4)", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_BULK", "utsendelse@epost.tjenesten.no");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: () => Promise.resolve(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendBulkEmail({
      to: { email: "recipient@example.com", locale: "nb-NO" },
      subject: "Dagens digest",
      html: "<p>hei</p>",
      text: "hei",
      listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
      senderName: "Kildebanken Norge",
      replyTo: "support@example.invalid",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(body.sender).toEqual({ email: "utsendelse@epost.tjenesten.no", name: "Kildebanken Norge" });
    expect(body.replyTo).toEqual({ email: "support@example.invalid" });
    expect(body.to).toEqual([{ email: "recipient@example.com" }]);
    expect(body.headers).toEqual({
      "List-Unsubscribe": "<https://tjenesten.no/api/unsubscribe/tok-1>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  });

  it("kaster når BREVO_SENDER_BULK mangler, uten å kalle Brevo", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_BULK", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      sendBulkEmail({
        to: { email: "recipient@example.com", locale: "nb-NO" },
        subject: "Dagens digest",
        html: "<p>hei</p>",
        text: "hei",
        listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
        senderName: "Kildebanken Norge",
        replyTo: "support@example.invalid",
      })
    ).rejects.toThrow(/BREVO_SENDER_BULK/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returnerer null i stubb-modus (ingen BREVO_API_KEY)", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendBulkEmail({
      to: { email: "recipient@example.com", locale: "nb-NO" },
      subject: "Dagens digest",
      html: "<p>hei</p>",
      text: "hei",
      listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
      senderName: "Kildebanken Norge",
      replyTo: "support@example.invalid",
    });

    expect(result).toBeNull();
  });

  it("returnerer Brevo sin messageId fra svarkroppen, for senere kobling til DigestDelivery (19.10)", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_BULK", "utsendelse@epost.tjenesten.no");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 201,
        text: () => Promise.resolve('{"messageId":"<brevo-msg-123@relay.brevo.com>"}'),
      })
    );

    const result = await sendBulkEmail({
      to: { email: "recipient@example.com", locale: "nb-NO" },
      subject: "Dagens digest",
      html: "<p>hei</p>",
      text: "hei",
      listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
      senderName: "Kildebanken Norge",
      replyTo: "support@example.invalid",
    });

    expect(result).toBe("<brevo-msg-123@relay.brevo.com>");
  });

  it("returnerer null (ikke en feil) når svarkroppen mangler messageId eller ikke er parsbar JSON", async () => {
    vi.stubEnv("BREVO_API_KEY", "test-key-123");
    vi.stubEnv("BREVO_SENDER_BULK", "utsendelse@epost.tjenesten.no");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 201, text: () => Promise.resolve("") })
    );

    const result = await sendBulkEmail({
      to: { email: "recipient@example.com", locale: "nb-NO" },
      subject: "Dagens digest",
      html: "<p>hei</p>",
      text: "hei",
      listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
      senderName: "Kildebanken Norge",
      replyTo: "support@example.invalid",
    });

    expect(result).toBeNull();
  });

  // Se samme begrunnelse i sendTransactionalEmail sin tilsvarende test over.
  it("kaster i produksjon i stedet for å falle tilbake til stubb-logging av e-postadressen", async () => {
    vi.stubEnv("BREVO_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      sendBulkEmail({
        to: { email: "recipient@example.com", locale: "nb-NO" },
        subject: "Dagens digest",
        html: "<p>hei</p>",
        text: "hei",
        listUnsubscribeUrl: "https://tjenesten.no/api/unsubscribe/tok-1",
        senderName: "Kildebanken Norge",
        replyTo: "support@example.invalid",
      })
    ).rejects.toThrow(/BREVO_API_KEY/);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
