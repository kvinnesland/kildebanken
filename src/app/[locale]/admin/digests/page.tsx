import { redirect } from "next/navigation";
import { isSupportedLocale, PLATFORM_DEFAULT_LOCALE } from "@/i18n/config";
import { createTranslator } from "@/i18n/get-messages";
import { getCurrentSession } from "@/lib/auth/session";
import { listDigests } from "@/lib/digests/digests";
import { EmptyState } from "@/components/EmptyState";
import { DigestRow } from "./DigestRow";
import styles from "./page.module.css";

// GET /[locale]/admin/digests (SPEC-V1.md 16.2: "se siste digester per
// land, antall sendt, bounces, klager, kjør på nytt ved feil"). Samme
// "tynn skive"-mønster som /admin/requests og /admin/journalists — se
// NATTLOGG.md for hvorfor dette var den første av de tre helt manglende
// admin-sidene (Mottakere, Utsendelser, Land) som ble bygget: lib-laget
// (listDigests()/retryFailedDigestDeliveries()) og API-rutene fantes
// allerede, testet, uten noe UI over dem.
export default async function AdminDigestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = isSupportedLocale(rawLocale) ? rawLocale : PLATFORM_DEFAULT_LOCALE;
  const t = createTranslator(locale);

  const session = await getCurrentSession();
  if (!session || (session.role !== "moderator" && session.role !== "admin")) {
    redirect(`/${locale}/logg-inn`);
  }

  const digestList = await listDigests(session);
  // Nyeste først — "scheduled_for" er allerede en "YYYY-MM-DD"-streng i
  // landets egen tidssone (se db/integration/fixtures.ts), en enkel
  // strengsammenligning holder og unngår enhver fare for datofeilskift ved
  // en Date/Intl.DateTimeFormat-omvei (samme grunn til at
  // admin/page.tsx sitt dashbord viser scheduledFor rått, uten formatering).
  const sorted = [...digestList].sort((a, b) => b.scheduledFor.localeCompare(a.scheduledFor));

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("admin.digests.title")}</h1>

      {sorted.length === 0 ? (
        <EmptyState
          title={t("admin.digests.empty_title")}
          description={t("admin.digests.empty_description")}
        />
      ) : (
        <ul className={styles.list}>
          {sorted.map((digest) => (
            <DigestRow
              key={digest.id}
              locale={locale}
              digest={{
                id: digest.id,
                rowLabel: t("admin.digests.row_label", {
                  date: digest.scheduledFor,
                  status: t(`admin.dashboard.digest_status.${digest.status}`),
                }),
                sentCount: digest.sentCount,
                bouncedCount: digest.bouncedCount,
                complainedCount: digest.complainedCount,
                failedCount: digest.failedCount,
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
