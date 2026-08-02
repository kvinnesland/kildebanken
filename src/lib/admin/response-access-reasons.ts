// Utskilt fra admin/responses.ts (som drar inn next/headers transitivt via
// authorize.ts → auth/session.ts) slik at klientkomponenter (ReasonPicker.tsx)
// kan importere selve listen uten å dra server-only-kode inn i klientbundlet.
export const ADMIN_RESPONSE_ACCESS_REASONS = [
  "user_support_request",
  "abuse_report_investigation",
  "legal_or_regulatory_request",
  "security_incident",
] as const;

export type AdminResponseAccessReason = (typeof ADMIN_RESPONSE_ACCESS_REASONS)[number];
