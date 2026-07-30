// Delt mellom alle e-postmaler (digest.ts og templates/*.ts) — flyttet ut av
// digest.ts (økt 7) da den andre malen som trengte den ble bygget, i stedet
// for å duplisere den.
export function escapeHtml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
