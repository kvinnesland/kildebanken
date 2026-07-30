import { EMAIL_COLORS } from "../colors";
import { escapeHtml } from "../escape-html";

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface SimpleCtaEmailContent {
  locale: string;
  subject: string;
  heading: string;
  body: string;
  // Valgfrie med hensikt: en ren beslutningsmelding uten noen selvbetjent
  // oppfølgingshandling (f.eks. "journalistkonto avvist, med begrunnelse" —
  // SPEC-V1.md 15 — søkeren har ingenting å klikke på, bare en begrunnelse
  // å lese) har ingen naturlig lenke å tvinge frem. Samme begrunnelse som
  // `ignoreNote` under.
  ctaLabel?: string;
  ctaUrl?: string;
  // Valgfri med hensikt: "ba du ikke om denne?"-linjen gir bare mening for
  // maler som utløses av en BRUKERHANDLING som kan gjøres ved en feiltakelse
  // (magic_link/confirm_email — noen skrev feil e-post). Rene varsler
  // (response_submitted_receipt/new_response_received) har ingen "ba du
  // ikke om dette"-vinkel — de skjer alltid som en direkte konsekvens av en
  // handling mottakeren nettopp selv utførte eller ble adressert av.
  ignoreNote?: string;
}

/**
 * Delt skall for de enkleste e-postmalene (SPEC-V1.md 15): en overskrift,
 * ett avsnitt tekst, én tydelig lenke/knapp, og (for noen av dem) en linje
 * om at man kan se bort fra e-posten hvis man ikke ba om den. `confirm_email`
 * og `magic_link` er strukturelt identiske (begge er "her er en lenke,
 * klikk den innen 15 minutter"), og `response_submitted_receipt`/
 * `new_response_received` er strukturelt identiske med DEM (overskrift +
 * avsnitt + lenke) minus selve "ba du ikke om dette"-linjen — derfor ETT
 * skall for alle fire, ikke fire dupliserte maloppsett. DESIGN.md 7 sitt
 * tabellbaserte, én-kolonnes, maks-600px-oppsett, samme mønster som
 * `digest.ts`.
 */
export function renderSimpleCtaEmail(content: SimpleCtaEmailContent): RenderedEmail {
  const ctaHtml =
    content.ctaLabel && content.ctaUrl
      ? `<a href="${content.ctaUrl}" style="display:inline-block;padding:10px 20px;background:${EMAIL_COLORS.accent};color:${EMAIL_COLORS.accentText};text-decoration:none;border-radius:6px;font-size:15px;">${escapeHtml(content.ctaLabel)}</a>`
      : "";
  const ignoreNoteHtml = content.ignoreNote
    ? `<p style="margin:24px 0 0;font-size:13px;color:${EMAIL_COLORS.textMuted};">${escapeHtml(content.ignoreNote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="${content.locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${EMAIL_COLORS.pageBackground};font-family:-apple-system,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${EMAIL_COLORS.surface};border-radius:8px;">
        <tr><td style="padding:24px;">
          <h1 style="font-size:20px;margin:0 0 16px;color:${EMAIL_COLORS.text};font-family:Georgia,'Times New Roman',serif;">${escapeHtml(content.heading)}</h1>
          <p style="margin:0 0 20px;color:${EMAIL_COLORS.text};">${escapeHtml(content.body)}</p>
          ${ctaHtml}
          ${ignoreNoteHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    content.heading,
    "",
    content.body,
    ...(content.ctaUrl ? ["", content.ctaUrl] : []),
    ...(content.ignoreNote ? ["", content.ignoreNote] : []),
  ].join("\n");

  return { subject: content.subject, html, text };
}
