# Nattlogg

Løpende logg over autonomt arbeid utført uten avbrudd for avklaring, per
brukerens instruks natt 2026-07-29/30. Formatet er: hva som ble gjort,
hvilke antagelser som ble tatt under veis, og hva som gjenstår — slik at
resultatet kan gjennomgås om morgenen uten å måtte rekonstruere
resonnementet fra commit-historikken alene.

Kjøres i dynamisk selvregulerende `/loop`-modus (ingen fast intervall).
Modell: Sonnet 5, standard (ikke fast mode) — se begrunnelse i samtalen.

---

## Økt 1 — 2026-07-29, kveld/natt

### Løste gjenstående åpne spørsmål i SPEC-V1.md

Seksjon 26 ("Uavklarte spørsmål") hadde 7 punkter. 6 av dem var arkitektur-
og produktvalg jeg kunne besvare med begrunnede antagelser — ingen av dem
er organisasjonsbeslutninger, og ingen er bygget inn som irreversible. Flyttet
til ny **26.1 "Besluttet under autonomt arbeid"**:

1. Ett land ved lansering (NO) — bekreftet, ikke bare forutsatt.
2. `nb-NO` som plattformens standardspråk (terminal fallback).
3. Journalistens fulle navn vises offentlig — tillitsbegrunnelse.
4. Ingen åpningssporing på forespørselsnivå — konsistent med 21.5.
5. Maks 5 samtidig publiserte forespørsler per journalist (ny **FR-029**,
   regel i 9.2) — hindrer at én journalist fyller en dags digest siden den
   ikke grupperer (10.2).
6. Påminnelse til journalist 30 dager etter publisering hvis forespørselen
   verken er lukket eller utløpt, uten automatisk lukking (ny jobb
   `stale-request-reminder`, ny e-postmal). En 90-dagers frist kan være
   tilsiktet; plattformen skal ikke avslutte en sak uten menneskelig
   beslutning.

**Ett punkt er bevisst IKKE besvart** og står igjen i ny 26.2: hvem eier
oversettelse og godkjenning av juridiske tekster. Dette er en navngitt
rolletildeling i virksomheten, ikke en arkitekturbeslutning — jeg har ikke
oppfunnet en eier for den.

Rettet en liten unøyaktighet i samme slengen: seksjon 19 sa "tolv tabeller"
men listet fjorten (Digest og DigestDelivery telles hver for seg). Rettet til
"fjorten".

Alt committet og pushet før scaffolding startet (commit `d762bcd`).

### Startet Fase 1 — kodebase-skjelett

Bygget et first-cut skjelett av selve applikasjonen, med disse
prioriteringene: (a) datamodellen er den mest fullstendig spesifiserte delen
av dokumentasjonen, så den ga mest verdi å oversette først, (b) portabilitets-
prinsippet fra `INFRASTRUCTURE.md` 16.8 måtte demonstreres i faktisk kode,
ikke bare beskrives, og (c) alt som ble skrevet skulle faktisk verifiseres —
ingen kode ble committet uten å ha kjørt gjennom typecheck, lint, tester og
`next build`.

**Opprettet:**

- `package.json`, `tsconfig.json`, `next.config.mjs`, `eslint.config.mjs`,
  `vitest.config.ts`, `.env.example`, `.gitignore`
- `netlify.toml` — den ENESTE filen som vet at vi kjører på Netlify
  (`INFRASTRUCTURE.md` 16.8, punkt 1)
- `src/db/schema.ts` — hele datamodellen fra `SPEC-V1.md` 19, felt for felt.
  Drizzle ORM valgt fremfor Prisma (spec-en overlot valget til "teamsmak",
  seksjon 3) — Drizzle er nærmere rå SQL, gir god TypeScript-inferens, og
  fungerer uten kodegenerering i serverløse funksjoner (relevant for
  Stadium 0, `INFRASTRUCTURE.md` 16).
- `src/db/client.ts`, `migrate.ts`, `seed.ts` — seed oppretter kun
  Norge-konfigurasjonen i status `draft` (aktivering krever juridisk
  gjennomgang og moderatortildeling — ikke noe et seed-script skal gjøre mot
  et ekte miljø).
- `src/lib/jobs/tick.ts` + `netlify/functions/tick.ts` — den vert-uvitende
  jobblogikken og den tynne Netlify-adapteren, nøyaktig etter mønsteret i
  `INFRASTRUCTURE.md` 16.3/16.8. Dekker `digest-tick`, `expire-requests`,
  `expire-contact-requests`, `deadline-reminder`, `stale-request-reminder`,
  `purge-unverified`.
- `src/lib/email/send.ts` — tynt e-postgrensesnitt. Brevo-integrasjonen er
  **ikke implementert** — funksjonen logger til konsoll når `BREVO_API_KEY`
  mangler, og kaster ellers en tydelig "ikke implementert"-feil. Dette er
  bevisst utsatt, ikke glemt.
- `src/i18n/` — `config.ts` (locale/land som separate akser, jf. 3.1),
  `messages/nb-NO.json` og `en-GB.json` (et startsett med rundt 60 nøkler —
  IKKE hele appens tekst, og IKKE profesjonelt korrekturlest engelsk),
  `get-messages.ts` (fallback-kjeden fra 3.4, ICU MessageFormat via
  `intl-messageformat`), `check-keys.ts` (FR-012 — CI-sjekk, med egen test
  som verifiserer selve akseptansekriteriet med en fikstur, slik spec-en
  ber om).
- `src/middleware.ts` — locale-deteksjon/redirect (3.7) og CSP med
  per-request nonce (seksjon 18, "uten unsafe-inline"). Kjører i Node.js-
  runtime, ikke edge, fordi edge-runtime ikke støtter `pg` og
  landspesifikk logikk her før eller siden vil trenge databasetilgang.
- `src/styles/tokens/{primitives,semantic,typography}.css` — kopiert direkte
  fra `DESIGN.md` 2–4. Null tvetydighet her, så null grunn til å utsette det.
- `src/app/[locale]/layout.tsx` og `page.tsx` — minimal plassholderside som
  beviser at locale-ruting, meldingslasting (`createTranslator`) og
  designtokens faktisk fungerer sammen, ende til ende.

### Verifisert, ikke bare skrevet

Kjørt i rekkefølge, alle grønne, før commit:

```
npx tsc --noEmit        → OK, ingen feil
npx eslint .             → OK (etter å ha lagt til ignores for .next/ og
                            next-env.d.ts — se "Kjente hull" under)
npx vitest run           → 5/5 tester grønne
npx tsx src/i18n/check-keys.ts → OK, fant og validerte faktisk nøkkelbruk
npx next build           → bygger begge locale-varianter statisk,
                            middleware kompilerer (43,2 kB)
```

`npm install` kjørt to ganger (395 + 308 pakker) — første runde manglet tre
avhengigheter jeg la til etter at installasjonen allerede var i gang
(`@eslint/eslintrc`, `@netlify/functions`, `@netlify/plugin-nextjs`,
`server-only`).

### Kjente hull — ikke gjort, med vilje

- **Ingen faktisk autentisering** (magic link-flyten i `SPEC-V1.md` 6) er
  implementert ennå — bare datamodellen (`users`-tabellen) finnes.
- **Ingen Brevo-integrasjon.** `src/lib/email/send.ts` er et stubbet
  grensesnitt. Krever en ekte API-nøkkel og bør testes mot sandkassemodus
  før noe sendes for reelt.
- **Ingen faktisk mottakerlogikk i `digest-tick`.** Funksjonen oppretter
  `Digest`-raden idempotent (den delen som beviser at
  race-condition-beskyttelsen i `INFRASTRUCTURE.md` 5.2 fungerer), men
  finner ikke faktiske mottakere, rendrer ikke locale-varianter, og sender
  ingen e-post ennå. Merket med TODO i koden.
- **Ingen betinget unik indeks** for "ett aktivt svar per person per
  forespørsel" (FR-041). Drizzles schema-API støtter ikke `WHERE`-betingede
  unike indekser direkte — dette må legges til som en håndskrevet
  SQL-migrasjon etter `db:generate`, ikke i `schema.ts` selv. Notert i en
  kommentar i schema-filen.
- **`deadline-reminder` og `stale-request-reminder` mangler et
  "påminnelse sendt"-flagg.** Slik de er skrevet nå, ville de sendt på nytt
  hvert 15. minutt innenfor sitt tidsvindu hvis de kjørte i produksjon over
  tid. Merket tydelig med TODO — IKKE produksjonsklare i dagens form, bevisst
  bygget som riktig struktur først, robusthet etterpå.
- **`retention`-jobben (sletting/anonymisering av persondata, `SPEC-V1.md`
  17.4) er bevisst IKKE implementert.** Dette er den ene jobben jeg aktivt
  valgte å utsette fremfor å skrive rått: å slette eller anonymisere ekte
  personopplysninger feil vei er irreversibelt, og bør ikke skje første gang
  i et system som aldri har kjørt mot et testmiljø. Bygges i en senere økt,
  med tester som kjøres FØR den kobles til ekte data.
- **Lint-håndhevelsen fra `DESIGN.md` 1 og 9** (ingen hex/px/lag-1-variabler
  i komponentfiler) er ikke satt opp. Krever en stylelint-konfigurasjon,
  ikke bare ESLint. TODO i `eslint.config.mjs`.
- **Ingen ekte fontfiler.** `tokens/typography.css` peker på fontnavn
  (`Inter var`, `Source Serif 4`) uten tilhørende `@font-face`, siden
  DESIGN.md krever selvhosting (ingen Google Fonts) og filene ikke er lastet
  ned ennå. Faller tilbake til systemfonter inntil videre — ikke en feil,
  bare uferdig.
- **Ingen faktiske API-ruter** (`/auth/*`, `/requests`, `/responses`, osv. fra
  `SPEC-V1.md` 20). Skjemaet finnes, jobblogikken finnes delvis, men
  endepunktene som binder dem sammen er ikke skrevet.

### Neste økt (planlagt, ikke påbegynt)

I prioritert rekkefølge: (1) autentisering — magic link request/verify,
øktbehandling; (2) API-ruter for registrering (mottaker og journalist) med
samtykkelogging; (3) den betingede unike indeksen for `responses`; (4)
"påminnelse sendt"-flagg på `requests` slik at reminder-jobbene blir trygge å
faktisk kjøre gjentatte ganger.

---

## Økt 2 — 2026-07-29, kveld (brukeren fortsatt våken)

**Viktig hendelse:** den planlagte gjenoppvåkningen (`ScheduleWakeup`,
21:18) fyrte aldri. Brukeren merket at ingenting skjedde klokken 21:26 —
`git log` bekreftet at ingen commits var gjort siden forrige økt, og
`list_triggers` viste ingen aktive triggere i det hele tatt. Jeg vet ikke
sikkert hvorfor `ScheduleWakeup` ikke leverte, og later ikke som jeg vet.
Fra og med denne økten brukes i stedet `create_trigger` direkte (en
selvbundet, timebasert Routine) — den vises i `list_triggers` og kan
faktisk verifiseres, i motsetning til det forrige forsøket.

Siden brukeren var til stede, gjorde jeg videre arbeid synkront i stedet
for å vente på neste automatiske oppvåkning.

### Lukket tre av de fire "kjente hull" fra økt 1

- **Autentisering (magic link) er nå implementert**, ikke bare planlagt:
  - Oppdaget og rettet et reelt spec-hull underveis: `SPEC-V1.md` seksjon 6
    og 8 forutsetter engangstokens og økter, men seksjon 19 (datamodell)
    definerte aldri disse tabellene. Lagt til **19.14 AuthToken** og
    **19.15 Session** i spec-en FØRST (jf. README-prinsippet: "endre
    spec-en først"), deretter i `schema.ts`. Seksten tabeller totalt nå.
  - `src/lib/auth/tokens.ts` — generering, hashing (SHA-256), konstant-tid
    sammenligning.
  - `src/lib/auth/magic-link.ts` — `requestMagicLink` (avslører aldri om
    e-post finnes, håndhever 5-per-15-minutter, velger `confirm_email` vs.
    `magic_link`-mal basert på om kontoen er verifisert fra før) og
    `verifyMagicLink` (engangsbruk, 15 min gyldighet, setter
    `email_verified_at`/`active` ved første vellykkede innlogging).
  - **Tolkning tatt autonomt, verdt å sjekke:** spec-en lister "Bekreft
    e-postadresse" og "Innloggingslenke" som to separate e-postmaler, men
    6.1 sier eksplisitt at verifisering skjer "som en del av innloggingen".
    Jeg har IKKE bygget en separat bekreftelsesflyt — samme
    `AuthToken`/`verifyMagicLink` brukes for begge, bare med ulik mal valgt
    ved utsending. Hvis dette er feil lesning av spec-en, er det billig å
    rette: endringen er isolert til `requestMagicLink`.
  - `src/lib/auth/session.ts` — øktopprettelse (30 dager mottaker/journalist,
    12 timer moderator/admin, ingen stille fornyelse), oppslag (utløpt og
    tilbakekalt behandles likt), tilbakekalling ved utlogging.
  - Route handlers: `POST /api/auth/request-link`, `POST /api/auth/verify`,
    `POST /api/auth/logout`, og `GET /api/me` som første beskyttede
    endepunkt — beviser at hele kjeden (token → økt → cookie → oppslag)
    faktisk fungerer sammen.

- **Den betingede unike indeksen for `responses` (FR-041) er lagt til**,
  som håndskrevet migrasjon (`0001_responses_active_unique_index.sql`) —
  Drizzles schema-API støtter ikke `WHERE`-betingede unike indekser.

- **"Påminnelse sendt"-flaggene er lagt til.** Nye felter
  `deadline_reminder_sent_at` og `stale_reminder_sent_at` på `Request`
  (spec-en oppdatert først, deretter schema og migrasjon `0002`).
  `deadline-reminder` og `stale-request-reminder` i `tick.ts` er omskrevet
  til å sjekke og sette disse — trygge å kjøre gjentatte ganger nå, ikke
  bare riktig strukturert.

**Gjenstår fortsatt** (uendret fra økt 1, ikke rørt denne økten):
registrering (mottaker/journalist) med samtykkelogging, Brevo-integrasjon,
faktisk mottakerlogikk i `digest-tick`, `retention`-jobben, lint-håndhevelse
av designtokens, ekte fontfiler.

### Verifisert på nytt før commit

Samme kjede som økt 1 (`tsc --noEmit`, `eslint`, `vitest` — nå 10 tester,
`i18n:check`, `next build`), pluss `drizzle-kit generate` kjørt to ganger
(først for `auth_tokens`/`sessions`, så for de to nye feltene på `requests`)
for å bekrefte at skjemaendringene faktisk gir gyldig SQL. Alt grønt.

---

## Økt 3 — 2026-07-29/30, natt (`create_trigger` fyrte som forventet)

Rutinen fra økt 2 fyrte presist til planlagt tid (`22:38 UTC`) og gikk rett
inn i samme samtale med full kontekst — i motsetning til `ScheduleWakeup`.
Dette bekrefter at byttet var riktig.

### Oppdaget og rettet et nytt spec-hull: journaliststatus var to ting camouflert som ett felt

Underveis i registreringsarbeidet (se under) måtte jeg faktisk implementere
statusovergangene fra 8.1, og oppdaget da at de ikke kan implementeres som
skrevet: 8.1 beskrev `pending_review`, `approved` og `rejected` som om de var
verdier på samme felt som `pending_email_verification` og `suspended` — men
`User.status` (19.3) er felles for ALLE roller og har aldri inkludert disse
verdiene. Å legge journalist-spesifikke verdier til et felt delt med
mottaker/moderator/administrator ville vært feil retning.

**Rettet i spec-en først** (8.1 og 19.5): splittet til to uavhengige felt.
`User.status` forblir generisk (`pending_email_verification → active →
suspended → deleted`, samme for alle roller). Ny
`JournalistProfile.verification_status`
(`pending_review → approved | rejected`) eier moderator-vurderingen alene,
satt til `pending_review` ved søknad og aldri endret av
innlogging/verifisering. FR-005 omformulert til å referere begge feltene
eksplisitt. Deretter lagt til i `schema.ts` (`journalist_verification_status`
enum + kolonne) og migrert (`0003`).

Dette er nøyaktig samme type feil som `AuthToken`/`Session`-hullet i økt 2 —
en seksjon i spec-en (her: 8, der: 6/8) forutsatte en tilstand
datamodell-seksjonen (19) aldri faktisk definerte riktig. Mistanke å ta med
videre: det kan finnes flere slike hull andre steder i spec-en som bare
dukker opp når noen faktisk prøver å implementere det beskrevne.

### Bygget registrering (prioritet 1 fra forrige økt)

- `src/lib/legal/documents.ts` — henter gjeldende publiserte versjon av et
  juridisk dokument for (land, locale, type). "Gjeldende" = høyeste
  `published_at` som ikke ligger i fremtiden. Returnerer `null` for HELE
  resultatet hvis ett eneste påkrevd dokument mangler (FR-009) — ingen delvis
  samtykkeflyt.
- `src/db/errors.ts` — `isUniqueViolation()`, for å skille en reell
  kappløps-kollisjon (to samtidige registreringer, samme e-post) fra andre
  databasefeil.
- `src/lib/registration/recipient.ts` — `registerRecipient()`. Håndhever de
  tre samtykkene fra 7.1, sjekker at landet er `active` og locale-en er
  tilgjengelig der, henter gjeldende vilkår+personvern, oppretter bruker +
  `EmailSubscription` + fire `ConsentRecord`-rader (én kombinert
  avkrysningsboks for vilkår+personvern gir likevel TO rader, siden de to
  dokumenttypene versjoneres uavhengig), og sender første e-post via
  `requestMagicLink`.
- `src/lib/registration/journalist.ts` — `applyAsJournalist()`. Samme mønster,
  oppretter også `JournalistProfile` med `verification_status =
  pending_review` (skjemaets default, ikke satt eksplisitt i koden).
- Route handlers: `GET /api/countries` (kun `active` land — et land i
  `draft` skal aldri kunne velges, jf. 3.3), `POST /api/subscribe`,
  `POST /api/journalists/apply`.
- **Rettet valg av første e-post:** `requestMagicLink` sendte tidligere
  alltid `confirm_email` som første e-post, uavhengig av rolle — men spec-en
  har en egen `journalist_application_received`-mal som sto ubrukt. Journalist
  får nå denne ved første utsendelse, mottaker får `confirm_email`, begge får
  `magic_link` ved senere innlogginger.
- Lagt til seks nye `errors.*`-nøkler i begge locale-filene
  (`consent_required`, `invalid_country`, `invalid_locale`,
  `legal_documents_unavailable`, `email_already_registered`,
  `not_authenticated`) for konsistens, selv om `check-keys.ts` ikke krever
  det ennå (de sendes som rå API-feilkoder, ikke gjennom `t()`).

### Ikke gjort denne økten, med vilje

- **Ingen integrasjonstester mot en ekte database.** Dette sandkassemiljøet
  har ingen kjørende Postgres, så `registerRecipient`/`applyAsJournalist` er
  verifisert ved kodegjennomgang, typecheck og vellykket `next build` —
  ikke ved faktisk å kjøre dem. Bør dekkes med ekte integrasjonstester (mot
  en test-database) før dette går i produksjon. Notert som gap, ikke skjult.
- Digest-tick sin mottakerlogikk, Brevo-integrasjon, retention-jobben — alle
  uendret fra økt 1/2, fortsatt TODO.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil), `vitest run` (10 tester, uendret antall
— ingen nye enhetstester denne økten, se over), `i18n:check`, `next build`
(fire nye API-ruter kompilerer: `/api/countries`, `/api/subscribe`,
`/api/journalists/apply`, pluss eksisterende), og `drizzle-kit generate` for
den nye kolonnen på `journalist_profiles`.

### Neste økt

I prioritert rekkefølge: (1) faktisk mottakerlogikk i `digest-tick` (finn
mottakere per land, rendre locale-varianter, opprette `DigestDelivery`); (2)
integrasjonstester for registreringsflyten mot en ekte test-database, hvis
en kan settes opp i miljøet; (3) `retention`-jobben, fortsatt med forsiktighet
først; (4) admin-ruter for journalistgodkjenning
(`POST /admin/journalists/:id/approve|reject`) siden `verification_status`
nå finnes men ingenting setter den til noe annet enn default.

---

## Økt 4 — 2026-07-30, natt (`create_trigger` fyrte presist igjen, 23:38 UTC)

### Bygget faktisk mottakerlogikk i `digest-tick` (prioritet 1 fra økt 3)

- `src/lib/email/digest.ts` — `renderDigestContent(locale, requests)` rendrer
  HTML + tekst ÉN gang per locale faktisk i bruk (FR-032), med to
  plassholdere (`__ACCESS_TOKEN__`, `__UNSUBSCRIBE_TOKEN__`) i stedet for
  ekte tokens. `insertPerRecipientTokens()` gjør det billige strengbyttet per
  mottaker etterpå — dette er selve mekanismen som gjør FR-032 sant i praksis,
  ikke bare i en kommentar.
- **Viktig designvalg, verdt å sjekke:** avmeldingstokenet
  (`EmailSubscription.unsubscribe_token_hash`) roteres ved HVER
  digest-utsendelse, ikke bare satt én gang ved registrering. Grunnen: den
  forrige økten (registrering) genererte tokenet, hashet det, og kastet den
  rå verdien — uten noen plass å faktisk sende den rå verdien til brukeren.
  Det var reelt ubrukelig som skrevet. Løsningen: generer et FERSKT
  avmeldingstoken ved hver utsendelse, bruk det rå i den e-postens
  avmeldingslenke, oppdater hashen. Det gjør forrige e-posts avmeldingslenke
  ugyldig når en ny sendes — en akseptabel og faktisk ønsket egenskap
  ("tilbakekallbar", 24.3), ikke en bivirkning.
- `sendBulkEmail()` lagt til i `src/lib/email/send.ts`, atskilt fra
  `sendTransactionalEmail()` — speiler kravet i `INFRASTRUCTURE.md` 6.1 om
  atskilte strømmer, selv om begge fortsatt bare er stubber.
- `runDigestTick()` i `tick.ts` utvidet til faktisk å: hente forespørslene i
  digesten (med journalistens organisasjonsnavn via join), finne mottakere
  (aktiv konto + aktivt abonnement + riktig land — FR-031/FR-035), gruppere
  på locale faktisk i bruk, rendre én gang per locale, og for hver mottaker
  opprette `DigestDelivery`, sende, og sette status (`sent`/`failed` med
  `errorMessage`). `Digest.status` settes til `failed` bare når ALLE
  mottakere feilet — delvis feil er fortsatt en vellykket utsendelse sett fra
  landets side.
- Lagt til 7 enhetstester for rendringslogikken (`digest.test.ts`) — ren
  funksjon, ingen database nødvendig: flertallsform i emnefelt, HTML-escaping
  av brukergenerert innhold (tittel/oppsummering), fremmedspråk-varsel,
  plassholder-erstatning.

### Reell feil oppdaget og rettet underveis: `"server-only"` brøt jobben

`digest.ts` bruker `createTranslator()` fra `src/i18n/get-messages.ts`, som
hadde `import "server-only"` øverst. Den pakken kaster ubetinget når den
importeres utenfor Next.js sin egen bundler — og `tick.ts` kjøres av
`netlify/functions/tick.ts`, en frittstående funksjon UTENFOR Next.js'
bundler, samt av vitest direkte. Testene feilet umiddelbart med akkurat
denne feilen.

**Fjernet `"server-only"` fra `get-messages.ts`**, med en kommentar i filen
som forklarer hvorfor, slik at ingen legger den til igjen uten å forstå
konsekvensen. `src/lib/auth/session.ts` beholder sin `"server-only"` — den
bruker `next/headers`, som er reelt bundet til Next.js' request-kontekst og
aldri importeres av jobblogikken.

### Ikke gjort denne økten, med vilje

- Fortsatt ingen ekte Brevo-integrasjon — `sendBulkEmail`/
  `sendTransactionalEmail` er begge stubber.
- Fortsatt ingen integrasjonstester mot en ekte database (samme begrunnelse
  som økt 3 — ingen kjørende Postgres i denne sandkassen).
- Klikk-gjennom-verifiseringen for `?da=TOKEN` (som skal gi en innlogget økt,
  6.2) er IKKE bygget. Jeg har lagt riktig form på lenken og lagret
  `access_token_hash` på `DigestDelivery`, men selve endepunktet som slår opp
  tokenet og oppretter en `Session` gjenstår. Naturlig neste steg, ikke
  glemt.
- `DESIGN.md` 7 sin fulle byggetids-eksport av designtokens til e-post
  (`tokens.json`) er ikke bygget — fargeverdiene i `digest.ts` er skrevet
  direkte som literale verdier som matcher dagens tokens, med en kommentar om
  at de må oppdateres manuelt inntil pipelinen finnes.

### Verifisert før commit

`tsc --noEmit`, `eslint .`, `vitest run` (17 tester — 7 nye), `i18n:check`
(11 nøkler, opp fra 2), `next build`. Alt grønt, inkludert etter at
`"server-only"`-feilen ble oppdaget og rettet midt i verifiseringen.

### Neste økt

(1) klikk-gjennom-endepunkt for `?da=TOKEN` → oppretter `Session` (fullfører
6.2); (2) admin-ruter for journalistgodkjenning; (3) `retention`-jobben,
fortsatt med forsiktighet; (4) faktisk Brevo-integrasjon når/hvis en ekte
API-nøkkel blir tilgjengelig i miljøet.

---

## Økt 5 — 2026-07-30, natt (`create_trigger` fyrte presist, 00:39 UTC)

Alle tre gjenstående prioriteter fra økt 4 er fullført denne timen.

### 1. Klikk-gjennom-endepunkt for digest-lenken (fullfører SPEC-V1.md 6.2)

- **Endret lenkeformat i `digest.ts`:** i stedet for å peke direkte på
  innholdssiden med `?da=TOKEN` i søkestrengen, peker "Les og svar"-lenken nå
  på `/api/digest-access/TOKEN?to=/{locale}/foresporsler/{id}/{slug}`.
  Grunnen: å opprette en `Session` krever å sette en cookie via
  `next/headers`, noe en vanlig side (Server Component-rendering) ikke kan
  gjøre i Next.js — det krever en Route Handler. Byttepunktet slår opp
  tokenet, oppretter økten, og videresender til den faktiske siden.
- **Design valgt bevisst: gjenbrukbart, ikke engangsbruk.** En bruker skal
  kunne klikke seg inn fra en ukes gammel digest-e-post uten å måtte be om
  en ny innloggingslenke. `DigestDelivery.access_token_hash` har derfor
  ingen utløps- eller brukt-flagg, i motsetning til `AuthToken` (engangsbruk,
  15 minutter). Dokumentert eksplisitt i route-filen, siden det er et avvik
  fra mønsteret i resten av autentiseringskoden og lett kan mistolkes som en
  forglemmelse.
- Åpen redirect-beskyttelse (`to`-parameteret) flyttet til en egen,
  avhengighetsfri modul `src/lib/http/safe-redirect.ts` — se feilen under for
  hvorfor.

### Reell feil oppdaget og rettet: samme `"server-only"`-problem, ny variant

Skrev først `isSafeRelativePath()` inne i selve route-filen. Testen for den
importerte route-filen, som transitivt drar inn `session.ts` →
`next/headers` → dens `"server-only"`-guard, og feilet med nøyaktig samme
feil som økt 4 (men denne gangen var `"server-only"` faktisk riktig plassert
i `session.ts` — problemet var at jeg testet en ren hjelpefunksjon ved å
importere en fil med tunge, request-kontekst-bundne sideeffekter).
**Lærdom notert for videre arbeid:** rene, testbare hjelpefunksjoner bør fra
nå av bo i egne moduler UTEN andre importer, ikke inni route-/handler-filer
— ikke bare for denne filen, men som et generelt mønster fremover.

### 2. Admin-ruter for journalistgodkjenning

- `src/lib/auth/authorize.ts` — `requireModeratorForCountry(countryCode)`:
  moderator tildelt DET LANDET, eller administrator (som har alle land,
  19.4). `getAssignedCountryCodes()` for lister.
- `src/lib/moderation/journalists.ts` — `approveJournalist()`,
  `rejectJournalist()` (krever ikke-tom begrunnelse, sendes til søkeren på
  søkerens eget språk, jf. seksjon 8), `listJournalists()` (filtrert på
  moderatorens tildelte land — en moderator uten landtildeling ser en TOM
  liste, ikke alle journalister, hvis det noen gang blir en
  konfigurasjonsfeil). Alle skriver til `AuditLog` (FR-050).
- `GET /api/admin/journalists` (med `?status=`-filter),
  `POST /api/admin/journalists/:id/approve`,
  `POST /api/admin/journalists/:id/reject`.

### 3. Retensjonsjobben — bygget forsiktig, som instruert

- `src/lib/jobs/retention.ts`: **standard er dry run.** Jobben SELECTer og
  teller hva den ville påvirket i alle kategorier, men sletter ingenting med
  mindre `RETENTION_DRY_RUN=false` er eksplisitt satt i miljøet — noe som
  ikke er satt noe sted i dette scaffoldet. Koblet inn i `tick.ts` sin
  daglige jobbrunde, men forblir inert helt til noen bevisst slår den på
  etter å ha sett gjennom dry run-loggene.
- Dekker: innsendte svar (12 mnd etter at forespørselen lukkes — HELE raden
  slettes, tolket fra "svarteksten beholdes TIL fristen løper ut" i 17.5),
  kontaktforespørsler (12 mnd etter avslutning — `updated_at` brukt som
  tilnærming til "avslutning" siden `ContactRequest` ikke har et eget
  `resolved_at`-felt), revisjonslogg (3 år), digest + leveringsstatus
  (12 mnd).
- **Én kategori er bevisst KUN telt, aldri utført**, uansett
  `RETENTION_DRY_RUN`: avviste journalistsøknader (6 mnd). Å faktisk slette
  krysser flere tabeller med FK mot `user_id` og bør dele rutine med
  kontosletting (17.5), som ikke er bygget ennå — ikke noe en periodisk jobb
  bør gjøre på egen hånd. Rapporteres i `errors[]` i stedet for å utføres.
- **Kjent, dokumentert avvik fra spec-en:** 17.4 sier eksplisitt at
  lagringstider skal være per-land-konfigurasjon, ikke konstanter i koden.
  Med kun ett aktivt land (NO, fortsatt `draft`) er det ingen reell variasjon
  å konfigurere ennå — periodene er hardkodede, navngitte konstanter, med en
  TODO i filen om at dette må bli ekte konfigurasjon på `countries`-tabellen
  før land nummer to med andre krav legges til.
- 6 enhetstester for de rene funksjonene (`monthsAgo`, `yearsAgo`,
  `isRetentionDryRun`) — dato-utregning og sikker-standard-logikken er
  nettopp det som MÅ være riktig før noen noensinne vurderer å slå av dry
  run.

### Ikke gjort denne økten

Fortsatt ingen ekte Brevo-integrasjon, fortsatt ingen integrasjonstester mot
ekte database (samme begrunnelse som tidligere økter).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil, 0 advarsler etter opprydding), `vitest
run` (29 tester — 12 nye), `i18n:check` (11 nøkler), `next build` (tre nye
API-ruter kompilerer: `/api/digest-access/[token]`,
`/api/admin/journalists`, `/api/admin/journalists/[id]/approve`,
`/api/admin/journalists/[id]/reject`).

### Neste økt

Alle fire prioriteter fra økt 4 er nå dekket. Naturlige neste steg: (1)
withdraw-endepunkt for svar (`POST /responses/:id/withdraw`) — nevnt som
avhengighet i retention-jobbens kommentarer, men ikke bygget; (2)
kontosletting (`DELETE /me`, SPEC-V1.md 17.5) — deler anonymiseringslogikk
med den utsatte "avvist journalistsøknad"-kategorien i retention; (3)
`POST /requests` og resten av forespørsel-CRUD-en fra seksjon 20; (4) faktisk
Brevo-integrasjon når en API-nøkkel finnes.

---

## Økt 6 — 2026-07-30, natt (`create_trigger` fyrte presist, 00:39 UTC)

### Reelt skjemaproblem oppdaget FØR koding kunne starte: NOT NULL mot FR-020

Før forespørsel-CRUD-en kunne bygges, måtte den faktisk teste antagelsen om
at et utkast kan lagres delvis utfylt — og da viste det seg at åtte
kolonner på `requests` (`title`, `summary`, `description`,
`target_person_description`, `response_deadline`,
`allows_anonymous_participation`, `may_be_recorded`,
`may_involve_photo_video`) var `NOT NULL` i skjemaet fra Fase 1-scaffoldet
(økt 1). FR-020 sier eksplisitt: "Journalisten skal kunne lagre en
forespørsel som `draft` uten at obligatoriske felter er utfylt." En
databasekolonne kan ikke være både `NOT NULL` og tillate et manglende felt i
et utkast — de motsa hverandre direkte, og ingen kunne ha oppdaget det uten
faktisk å prøve å implementere `createDraft()`.

**Rettet spec-en først** (`SPEC-V1.md` 19.6): alle åtte feltene er nå
eksplisitt merket "nullable inntil innsending", med en forklarende merknad om
at "obligatorisk" i 9.1 betyr obligatorisk for `submit` (FR-021, håndhevet i
applikasjonslaget), ikke i databasen. De tre boolske feltene fikk en egen
begrunnelse: en `NOT NULL DEFAULT false` ville latt databasen stille anta
"nei" for et felt journalisten aldri tok stilling til — `boolean | null` er
riktig, ikke en tilfeldig løshet. Deretter rettet i `schema.ts` og migrert
(`0004`). Én følgefeil i `tick.ts` (typene `DigestRequestItem` krevde
non-null der databasen nå tillater null) rettet med en eksplisitt
null-sjekk og feilmelding i stedet for en antagelse — raden hopper over og
logges dersom en publisert forespørsel mot formodning mangler et påkrevd
felt, i stedet for at koden bare stoler blindt på invarianten.

### Bygget full forespørsel-CRUD (prioritet 3 fra økt 5)

- `src/lib/requests/slug.ts` — `slugify()` transkriberer æøå (ikke fjerner
  dem) og produserer lesbare slugs; `withDisambiguator()` for kollisjoner.
  7 enhetstester.
- `src/lib/requests/validate.ts` — `validateForSubmit()` er selve
  FR-021-logikken (én feilkode per manglende/ugyldig felt, aldri bare "noe
  mangler"), `validatePatchedFields()` er den lettere sjekken som kjører ved
  HVER lagring av utkast (håndhever lengdegrenser og fristvindu på felter
  som faktisk er oppgitt, uten å kreve fullstendighet). 12 enhetstester,
  inkludert én som eksplisitt beviser at `false` telles som besvart, ikke
  som manglende — det var jo hele poenget med `boolean | null`-fikset over.
- `src/lib/requests/requests.ts` — `createDraft`, `updateDraft` (kun
  `draft`/`changes_requested`, genererer slug første gang tittel finnes),
  `submitRequest` (FR-005-sjekk mot `verification_status`, FR-029-grensen på
  5 samtidig publiserte, varsler alle moderatorer tildelt landet),
  `closeRequest` (eier ELLER moderator/administrator), `deleteDraft` (soft
  delete, kun før publisering), `listMineRequests`, `getPublicRequest`
  (kun `published`/`closed`/`expired` — aldri `rejected`),
  `getOwnedRequestDetail`.
- Seks route handlers: `POST /api/requests`, `GET /api/requests/mine`,
  `GET|PATCH|DELETE /api/requests/[id]`, `POST /api/requests/[id]/submit`,
  `POST /api/requests/[id]/close`. `GET /api/requests/:id` gjør dobbel
  jobb bevisst — offentlig visning for publiserte/lukkede/utløpte, eierens
  egen (autentiserte) visning for alt annet — siden spec-en ikke definerer
  et eget endepunkt for journalistens detaljvisning av egne utkast.

**Kjent, ikke lukket:** FR-029s samtidighetsgrense sjekkes ved `submit`
(teller `published`), men ingen publiseringsendepunkt finnes ennå som
re-håndhever grensen idet moderator faktisk godkjenner. Flere innsendte
forespørsler kunne i prinsippet bli godkjent omtrent samtidig og midlertidig
bryte 5-grensen før neste sjekk. Notert i kode-kommentar — må lukkes når
`POST /admin/requests/:id/publish` bygges.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (48 tester — 19
nye), `i18n:check`, `next build` (16 API-ruter kompilerer totalt),
`drizzle-kit generate` for skjemarettelsen (migrasjon `0004`).

### Neste økt

(1) `POST /admin/requests/:id/publish` (+ `reject`/`request-changes`) —
lukker FR-029-hullet over samtidig; (2) svarinnsending
(`POST /requests/:id/responses`) og `withdraw`; (3) `DELETE /me`
(kontosletting, 17.5); (4) faktisk Brevo-integrasjon når en API-nøkkel
finnes.

---

## Fortsettelse av økt 6 — svarinnsending og trekking

Samme arbeidsøkt (00:39–01:38 UTC), fortsatte forbi punkt (2) fra listen
over siden det fortsatt var god tid til neste planlagte gjenoppvåkning.

### Nok et skjemaproblem oppdaget FØR koding, samme mønster som denne økten

`ContactRequest.response_id` var `NOT NULL` — men 12.4/17.4 krever at et
trukket svar slettes UMIDDELBART, mens kontaktforespørselen skal leve videre
med sin egen, uavhengige 12-måneders retensjonstid (17.4). En `NOT NULL`
fremmednøkkel mot en rad som skal kunne forsvinne før den selv gjør det, er
umulig å implementere ærlig. Rettet i spec-en først (19.8: `response_id`
nullable, med forklaring), deretter `schema.ts`, migrert (`0005`).

Dette er nå TREDJE gang i denne natten samme klasse feil dukker opp
(`AuthToken`/`Session` i økt 2, journaliststatus i økt 3, `requests`
NOT NULL i denne økten, nå denne) — mønsteret er tydelig: **Fase
1-skjelettet (økt 1) ble skrevet før noen prøvde å faktisk implementere
flytene spec-en beskriver, og databasekolonners nullability ble gjettet
optimistisk i stedet for utledet fra kravene.** Verdt å nevne eksplisitt til
brukeren: resten av skjemaet (spesielt `ContactRequest` og `Response` sine
øvrige felter) bør få samme kritiske gjennomgang før noen stoler blindt på
at det som ikke er testet ennå, er riktig.

### Bygget svarinnsending og trekking (FR-030/FR-033/FR-041, 12.1–12.4)

- `src/lib/responses/validate.ts` — feltgrenser fra 12.1 (2000/4000/500/80
  tegn), `relevanceStatement`/`answerText` obligatoriske (også mot
  whitespace-only). 6 enhetstester.
- `src/lib/responses/responses.ts`:
  - `submitResponse()` — krever verifisert, aktiv mottakerkonto og at
    forespørselen er `published`. Databasens betingede unike indeks
    (migrasjon `0001`, fra økt 4) er den EGENTLIGE garantien mot dobbeltsvar
    (FR-041); denne funksjonens forhåndssjekk er bare en vennligere feilvei
    enn en rå constraint-feil ved kappløp.
  - `withdrawResponse()` — henter ut 17.4 sin "slettes umiddelbart"
    bokstavelig: kansellerer `pending` kontaktforespørsler, sever
    `response_id`-koblingen for ALLE kontaktforespørsler knyttet til svaret
    (uavhengig av status, siden svaret uansett forsvinner), og
    HARD-SLETTER responsraden i samme kall — ikke en `withdrawn`-markering
    som ryddes senere. `lifecycleStatus`-verdien `"withdrawn"` i
    enum-typen brukes derfor i praksis aldri persistert; beholdt i skjemaet
    for å matche 19.7 ordrett, men verdt å vite for neste leser.
  - `listMineResponses()`, `getRespondentView()`.
- Fire route handlers: `POST /api/requests/[id]/responses`,
  `GET /api/responses/mine`, `POST /api/responses/[id]/withdraw`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (54 tester — 6
nye), `i18n:check`, `next build` (19 API-ruter totalt), `drizzle-kit
generate` for `ContactRequest`-rettelsen (migrasjon `0005`).

### Neste økt

(1) `POST /admin/requests/:id/publish` (+ `reject`/`request-changes`) —
fortsatt ikke bygget, og fortsatt den eneste gjenværende delen av
FR-029-hullet; (2) `DELETE /me` (kontosletting, 17.5); (3) kontaktforespørsel-
flyten (`POST /journalist/responses/:id/contact-request`,
`POST /contact-requests/:id/respond`); (4) vurder å sette av litt tid til å
lese gjennom RESTEN av `schema.ts` proaktivt for flere NOT NULL/nullable-feil
av samme type som er funnet tre netter på rad, i stedet for å vente på at
implementering av neste endepunkt avslører dem enkeltvis.

---

## Fortsettelse av økt 6, del 3 — proaktiv skjemarevisjon + moderasjonsendepunkter

Fortsatt samme arbeidsøkt (00:39–01:38 UTC).

### Proaktiv gjennomgang av resten av `schema.ts` — INGEN nye funn

Fulgte eget råd fra punkt (4) over før jeg gikk videre, i stedet for å vente
på at nok et endepunkt tilfeldig skulle avsløre et fjerde tilfelle. Gikk
systematisk gjennom hver eneste `NOT NULL`-kolonne i alle 16 tabellene og
kryssjekket mot hvilken spec-seksjon som beskriver når raden opprettes.

**Konklusjon: ingen flere motsigelser.** Det avgjørende, gjennomgående
mønsteret: `Request` er den ENESTE entiteten i hele datamodellen med et
eksplisitt utkast-konsept (FR-020, "ingen utkast" er til og med sagt
eksplisitt om `Response` i 12.1) — alt annet (`Response`, `ContactRequest`,
`JournalistProfile`, `EmailSubscription`, osv.) opprettes atomisk i én
innsending der alle obligatoriske felter uansett foreligger samtidig. Denne
kategorien feil (progressivt utfylte felt migrert inn i et "alt-eller-
ingenting"-skjema) er derfor trolig uttømt, ikke bare denne gangen skjult.
Dette punktet regnes som lukket.

### Moderasjonsendepunkter for forespørsler (lukker FR-029-hullet permanent)

- `src/lib/moderation/requests.ts`: `publishRequest()` (`submitted →
  published`, RE-HÅNDHEVER FR-029s 5-grense her — ikke bare ved `submit` i
  `src/lib/requests/requests.ts`, som fortsatt sjekker den samme grensen ved
  innsending. To sjekker, samme grense, fordi tiden mellom innsending og
  moderatorgodkjenning er nøyaktig vinduet der grensen ellers kunne blitt
  brutt), `rejectRequest()` og `requestChanges()` (`submitted → rejected`
  / `changes_requested`, begge krever ikke-tom begrunnelse/kommentar),
  `listModerationQueue()` (samme landfiltrerings-mønster som
  `listJournalists()`, økt 5).
- Fire nye route handlers: `GET /api/admin/moderation/requests`,
  `POST /api/admin/requests/[id]/publish`,
  `POST /api/admin/requests/[id]/reject`,
  `POST /api/admin/requests/[id]/request-changes`.
- Fjernet TODO-kommentaren i `submitRequest()` som pekte på dette hullet —
  erstattet med en kommentar som forklarer HVORFOR begge sjekkene finnes
  (ikke redundans, forskjellig tidspunkt).

**Med dette er hele forespørsel-livssyklusen faktisk sammenhengende for
første gang i natt:** opprett utkast → rediger → send til moderering →
moderator publiserer/avviser/ber om endringer → publisert forespørsel kan
motta svar → respondent trekker eller lar det stå. Ingen av delene var
koblet sammen før denne økten.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (54 tester,
uendret antall — ingen nye rene funksjoner å teste isolert denne runden),
`i18n:check`, `next build` (23 API-ruter totalt).

### Neste økt

(1) `DELETE /me` (kontosletting, 17.5) — deler anonymiseringslogikk med den
utsatte "avvist journalistsøknad"-kategorien i `retention.ts`; (2)
kontaktforespørsel-flyten (`POST /journalist/responses/:id/contact-request`,
`POST /contact-requests/:id/respond`) — siste store hull i kjeden fra
`SPEC-V1.md` 20; (3) journalistens svarinnboks
(`GET /journalist/requests/:id/responses`,
`PATCH /journalist/responses/:id/status`); (4) faktisk Brevo-integrasjon når
en API-nøkkel finnes.

---

## Økt 7 — 2026-07-30, natt (`create_trigger` fyrte presist, 01:38 UTC)

### Kontosletting bygget som to-stegs flyt (SPEC-V1.md 17.5, 24.3)

Merket i økt 2 at `AuthToken.purpose` inkluderte `delete_account`, men
flyten som faktisk bruker den var ikke bygget. Bygget nå:

- `src/lib/auth/account-deletion.ts`:
  - `requestAccountDeletion()` — steg 1, krever aktiv økt (ruten), sender en
    EGEN bekreftelseslenke (`confirm_account_deletion`-mal, ny), ikke den
    vanlige innloggingslenken — se begrunnelse lagt til i `SPEC-V1.md` 15
    (24.3: sensitive handlinger skal kreve ny autentisering, og en
    irreversibel handling bør si det tydelig i selve e-postteksten).
  - `confirmAccountDeletion()` — steg 2, krever IKKE en aktiv økt. Tokenet
    ALENE er autoriteten, bevisst samme prinsipp som
    `verifyMagicLink()`: å ha mottatt e-posten er beviset, uavhengig av om
    brukeren fortsatt er innlogget i nettleseren som ba om slettingen.
  - Selve slettingen grener på rolle:
    - **Mottaker:** svar (`lifecycleStatus = submitted`) anonymiseres —
      IKKE slettes. `contact_sharing` settes til `none`,
      `display_name_snapshot` fjernes, men selve svarteksten beholdes til
      ordinær retensjonsfrist (17.5, ordrett). Dette er BEVISST forskjellig
      fra `withdrawResponse()` (økt 6), som hard-sletter umiddelbart — to
      ulike hendelser (respondentens eget valg vs. kontosletting), to ulike,
      spec-definerte utfall. Pending kontaktforespørsler kanselleres, og
      journalisten VARSLES (ny mal `contact_request_cancelled_account_deleted`)
      — i motsetning til vanlig trekking, der 12.4 eksplisitt sier
      journalisten IKKE varsles særskilt.
    - **Journalist:** åpne (`published`) forespørsler lukkes, respondenter
      varsles (gjenbruker `response_request_closed`).
    - **Begge:** økter tilbakekalles (ny `revokeAllSessionsForUser()` i
      `session.ts` — tilbakekaller ALLE økter, ikke bare klientens egen),
      e-postabonnement settes til `unsubscribed`, kontoen anonymiseres
      (e-post OG `email_hash` settes til SHA-256-hash av original e-post —
      tilfredsstiller både unikhets- og NOT NULL-kravet på `email` uten
      skjemaendring), bekreftelse sendes til ORIGINAL adresse FØR
      anonymisering, slettingen logges til `AuditLog`.
- To route handlers: `POST /api/me/request-deletion`,
  `POST /api/me/confirm-deletion`.
- To nye e-postmaler lagt til i spec-en (15) og `send.ts`:
  `confirm_account_deletion`, `contact_request_cancelled_account_deleted`.
  "Kontosletting bekreftet" endret fra "mottaker" til "begge" — en
  journalistkonto kan også slettes (17.5, siste avsnitt), og det stemte ikke
  at malen bare gjaldt én rolle.

**Antagelse tatt, ikke skjult** (dokumentert i kodekommentar også): 17.5 sier
ingenting om `JournalistProfile` (fullName, organizationName) skal
anonymiseres ved kontosletting — bare at forespørsler lukkes og
respondenter varsles. Valgt å LA disse feltene stå uendret på allerede
publiserte forespørsler, med samme begrunnelse som at en avis beholder en
byline selv om journalisten slutter. Revurder om dette er feil lesning.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (54 tester,
uendret — ingen ny ren logikk å isolere denne runden), `i18n:check`, `next
build` (25 API-ruter totalt).

### Neste økt

(1) kontaktforespørsel-flyten
(`POST /journalist/responses/:id/contact-request`,
`POST /contact-requests/:id/respond`) — siste store hull i seksjon 20; (2)
journalistens svarinnboks (`GET /journalist/requests/:id/responses`,
`PATCH /journalist/responses/:id/marking`); (3) faktisk Brevo-integrasjon
når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — kontaktforespørsel-flyten

Samme arbeidsøkt (01:38–02:38 UTC), fortsatte forbi kontosletting siden det
fortsatt var god tid til neste planlagte gjenoppvåkning.

### Rettet et hull i `closeRequest()` oppdaget mens kontaktflyten ble bygget

14.3 sier eksplisitt at en pending kontaktforespørsel utløper "14 dager,
ELLER forespørselen lukkes" — men `closeRequest()` (bygget økt 6) satte bare
`status = closed` på forespørselen, uten å røre tilhørende
kontaktforespørsler. Rettet: `closeRequest()` setter nå alle `pending`
kontaktforespørsler knyttet til forespørselens svar til `expired` i samme
kall — som en øyeblikkelig konsekvens av lukking, ikke noe som skal vente på
at den daglige tikkejobben oppdager det i etterkant.

### Kontaktforespørsel-flyten (FR-040/FR-041/FR-043, 14.1–14.3)

- `src/lib/contact-requests/contact-requests.ts`:
  - `createContactRequest()` — kun forespørselens egen journalist, kun hvis
    respondenten IKKE allerede har delt e-postadressen
    (`contact_sharing !== "email"`), kun hvis svaret fortsatt er
    `submitted`. FR-043 (én kontaktforespørsel per svar) håndheves av den
    unike indeksen på `contact_requests.response_id` (19.8) — sjekken her
    er bare en vennligere feilvei enn en rå constraint-feil ved kappløp.
  - `respondToContactRequest()` — godkjenning setter `shared_email` fra
    respondentens LIVE e-postadresse (ikke en snapshot) og logger til
    `AuditLog` med samtykkegrunnlag i `reason`, ALDRI selve
    e-postadressen i `metadata` (19.12). Avslag varsler journalisten UTEN
    begrunnelse (14.2, ordrett) — ingen `reason`-data sendes med den
    e-posten.
  - `getContactRequestDetail()` — synlig for de to involverte partene.
    Skjuler bevisst `shared_email` for journalisten før status er
    `approved`, slik at feltets tilstedeværelse ikke kan brukes til å gjette
    seg til utfallet før respondenten faktisk har svart.
- **Rettet ruteoppsett underveis:** startet med én generisk
  `POST /contact-requests/:id/respond`, men `SPEC-V1.md` 20 lister faktisk
  TO separate endepunkter (`/approve`, `/decline`). Rettet til å matche
  spec-en nøyaktig — samme underliggende funksjon (`respondToContactRequest`
  med et `decision`-parameter), men to tynne ruter.
- Fire route handlers: `POST /api/journalist/responses/[id]/contact-request`,
  `GET /api/contact-requests/[id]`, `POST /api/contact-requests/[id]/approve`,
  `POST /api/contact-requests/[id]/decline`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler etter å ha fjernet én ubrukt
import), `vitest run` (54 tester, uendret), `i18n:check` (3 nye
feilnøkler), `next build` (28 API-ruter totalt).

### Status ved slutten av økt 7

Alle fire hovedflytene fra `SPEC-V1.md` 20 som ble prioritert i natt er nå
bygget: registrering, autentisering, forespørsel-livssyklus (utkast →
moderering → publisering → lukking), svar (innsending → trekking), og
kontakt (forespørsel → godkjenning/avslag). Gjenstående kjente hull:
journalistens svarinnboks-endepunkter (merking, internt notat — datamodellen
finnes, ingen ruter ennå), faktisk Brevo-integrasjon, og
integrasjonstester mot en ekte database (ingen Postgres tilgjengelig i denne
sandkassen gjennom hele natten).

### Neste økt

(1) journalistens svarinnboks:
`GET /journalist/requests/:id/responses` (liste + tellere fra 13),
`GET /journalist/responses/:id` (detaljvisning, setter `viewed_at`),
`PATCH /journalist/responses/:id/status` (merking + internt notat, 13.1); (2)
`GET /me/data-export` og øvrige gjenstående `/me`-ruter; (3) faktisk
Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — journalistens svarinnboks (siste hovedflyt)

Samme arbeidsøkt (01:38–02:38 UTC).

- `src/lib/journalist-inbox/journalist-inbox.ts`:
  - `listResponsesForRequest()` — liste + tellere fra 13 (antall svar,
    uleste, aktuelle/`shortlisted`, kontaktforespørsler). Viser kun aktive
    svar (`lifecycle_status = submitted`) — trukne finnes ikke lenger
    (hard-slettet), skjulte av moderator vises ikke her.
    `hasSharedEmail` beregnes fra ENTEN `contact_sharing = email` (delt ved
    innsending) ELLER en godkjent `ContactRequest` (delt senere) — to ulike
    veier til samme synlige felt.
  - `getResponseDetailForJournalist()` — setter `viewed_at` ved FØRSTE
    åpning, ingen e-post utløses (13, ordrett: "utløser ingen notifikasjon
    til respondenten").
  - `updateResponseMarking()` — setter `journalist_marking` og/eller
    `journalist_note`. Rører ALDRI `lifecycle_status`, som eies av
    respondenten alene (19.7-prinsippet fra tidligere økter, håndhevet
    konsekvent helt til slutt).
- Tre route handlers: `GET /api/journalist/requests/[id]/responses`,
  `GET /api/journalist/responses/[id]`,
  `PATCH /api/journalist/responses/[id]/status`.
- Lagt til en generell ESLint-regel (`argsIgnorePattern`/`varsIgnorePattern:
  "^_"`) i `eslint.config.mjs` — ryddigere enn å bruke `void`-triks for hver
  bevisst ubrukt destrukturert variabel, noe som dukket opp for tredje gang
  i natt (tidligere ryddet manuelt i `retention.ts` og
  `account-deletion.ts`).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (54 tester,
uendret), `i18n:check`, `next build` (**31 API-ruter totalt**).

### Status: hele SPEC-V1.md seksjon 20 sin kjernefunksjonalitet er nå bygget

Registrering (mottaker + journalist), autentisering (magic link, økter,
kontosletting), forespørsel-livssyklus (utkast → moderering → publisering →
lukking), svar (innsending → trekking → journalistens innboks), kontakt
(forespørsel → godkjenning/avslag), og digest-utsendelse med
klikk-gjennom-tilgang. Gjenstående, ikke-blokkerende hull: noen mindre
`/me`-ruter (`PATCH /me`, `POST /me/change-country`, `GET /me/data-export`),
`GET /journalists/me`/`PATCH /journalists/me`, faktisk Brevo-integrasjon, og
integrasjonstester mot en ekte database (ingen Postgres tilgjengelig i denne
sandkassen i natt — alt verifisert ved kodegjennomgang, typecheck og
`next build` i stedet).

### Neste økt

(1) resten av `/me`-rutene (`PATCH /me`, `POST /me/change-country`,
`GET /me/data-export`); (2) `GET /journalists/me`/`PATCH /journalists/me`;
(3) vurder om det er tid til å sette opp en lokal Postgres i sandkassen for
faktisk å kjøre migrasjonene og få de første ekte integrasjonstestene, i
stedet for bare kodegjennomgang — ville fanget feil ingen mengde
typechecking kan fange (f.eks. om den betingede unike indeksen i migrasjon
`0001` faktisk håndheves som forventet); (4) faktisk Brevo-integrasjon når
en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — ekte Postgres oppdaget, første integrasjonstester

Samme arbeidsøkt. Antagelsen fra hele natten ("ingen database tilgjengelig i
denne sandkassen") viste seg å være feil — `psql` og `postgresql-16` er
installert, bare ikke startet.

### Oppsett

- `service postgresql start` → `16/main (port 5432): online`.
- Opprettet rolle og to databaser som `postgres`-OS-brukeren: `kildebanken`
  (bruker, med `CREATEDB`), `kildebanken` og `kildebanken_test` (databaser).
- Kjørte alle 6 migrasjoner mot `kildebanken_test` via
  `DATABASE_URL=... npx tsx src/db/migrate.ts` — alle gikk gjennom uten feil.
- Bekreftet med `psql ... -c "\d responses"` at den hånd-skrevne partielle
  unike indeksen (migrasjon `0001`, kan ikke uttrykkes i Drizzles skjema-API)
  faktisk eksisterer nøyaktig som tiltenkt.

### Ny testinfrastruktur, adskilt fra den vanlige enhetstestsuiten

Standard `npx vitest run` skal ALDRI forutsette en database — det har vært
en bevisst egenskap hele natten og skal fortsette å være det (bl.a. fordi
selve CI-miljøet for enhetstester ikke nødvendigvis har Postgres). Derfor en
helt separat konfigurasjon for de nye, ekte databasetestene:

- `vitest.integration.config.ts` (ny) — egen config, `include: ["**/*.integration.test.ts"]`.
- `vitest.config.ts` — lagt til `exclude: [..., "**/*.integration.test.ts"]`
  slik at standardkjøringen aldri plukker dem opp.
- `package.json` — ny script `test:integration` (`vitest run -c
  vitest.integration.config.ts`), krever `DATABASE_URL` satt manuelt av den
  som kjører den (aldri i CI for enhetstester).
- `src/db/integration/fixtures.ts` (ny) — hjelpefunksjoner:
  `ensureTestCountry()` (testland `XT` + tre publiserte juridiske dokumenter,
  forutsetning for FR-009), `uniqueTestEmail()`, `createActiveRecipient()`,
  `createActiveJournalist()`. Dokumentert eksplisitt i filen at dette IKKE er
  et fullverdig testrammeverk (ingen transaksjons-rollback per test) — greit
  for en engangs sandkasse-database, bør erstattes med rollback eller en
  fersk database per kjøring (f.eks. en Neon-branch) i et ekte CI-oppsett.

### To ekte feil funnet og rettet i selve testriggen (ikke i applikasjonskoden)

1. **Kappløp mellom parallelle testfiler:** `ensureTestCountry()` brukte
   først sjekk-så-sett-inn for `legalDocuments`. Vitest kjører testfiler
   parallelt som standard, så begge testfilenes `beforeAll` så "ingen
   eksisterende rad" samtidig og forsøkte begge å sette inn samme rad →
   unik constraint-feil. Rettet ved å bruke `.onConflictDoNothing()` (samme
   mønster som allerede brukt for `countries`-innsettingen), og fjernet den
   nå ubrukte `eq`-importen.
2. **FK-rekkefølgefeil i testopprydding:**
   `recipient.integration.test.ts` sin `afterAll` forsøkte å slette
   `users`-raden mens en `auth_tokens`-rad (satt inn av
   `registerRecipient()` sitt interne kall til `requestMagicLink()`) fortsatt
   refererte til den → FK-brudd. Rettet ved å importere `authTokens` og
   slette fra den FØRST, før `consentRecords`, `emailSubscriptions` og
   `users`.

Begge er feil i testinfrastrukturen selv, ikke i produksjonskoden — men
verdt å nevne fordi de er nøyaktig den typen feil kodegjennomgang og
typechecking alene aldri ville fanget.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/responses/responses.integration.test.ts` (3 tester): FR-041
  håndheves av den partielle unike indeksen mot en ekte Postgres (ikke bare
  lest i migrasjons-SQL-en) — ett svar tillatt, et andre svar fra samme
  respondent på samme forespørsel avvist, og et NYTT svar tillatt etter at
  det forrige er trukket (bekrefter at trukket svar faktisk er hard-slettet
  fra databasen, ikke bare markert).
- `src/lib/registration/recipient.integration.test.ts` (3 tester):
  `registerRecipient()` oppretter bruker + e-postabonnement + FIRE
  samtykkerader fra ÉN avkrysningsboks, avviser manglende samtykke, og
  avviser en andre registrering med samme e-post — bekrefter at
  beskyttelsen er databasens unike constraint, ikke bare forhåndssjekken i
  applikasjonskoden.

Alle 6 tester grønne ved endelig kjøring:
`DATABASE_URL="postgres://kildebanken:kildebanken@localhost:5432/kildebanken_test" npx vitest run -c vitest.integration.config.ts`
→ "Test Files 2 passed (2)", "Tests 6 passed (6)".

**Merk for morgendagen / neste sandkasse-økt:** denne Postgres-installasjonen
lever i selve sandkasseboksen, ikke i noe persistent lagringssted git kan se.
Det betyr at `service postgresql start` + rolle/database-oppsett trolig må
gjentas fra bunnen neste gang en ny sandkasse-instans startes — selve
testfilene og riggen (som ER committet) trenger ingen endring, bare en
databaseinstans å peke `DATABASE_URL` mot.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (54 tester,
uendret — integrasjonstestene korrekt ekskludert, 9 testfiler ikke 11),
`i18n:check`, `next build` (31 API-ruter, uendret), OG (nytt denne runden)
`npx vitest run -c vitest.integration.config.ts` mot en ekte lokal Postgres
(6 tester, alle grønne).

### Neste økt

(1) resten av `/me`-rutene (`PATCH /me`, `POST /me/change-country`,
`GET /me/data-export`); (2) `GET /journalists/me`/`PATCH /journalists/me`;
(3) vurder å utvide integrasjonstestdekningen til flere av de kritiske
databasenivå-invariantene (f.eks. `contact_requests.response_id`-unikheten,
kontosletting-anonymisering) nå som riggen finnes; (4) faktisk
Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — `PATCH /me`, `POST /me/change-country`, `/journalists/me`

Samme arbeidsøkt. Postgres-instansen fra forrige del av økten er fortsatt
oppe, så disse ble bygget MED integrasjonstester fra starten, ikke bare
kodegjennomgang.

### `src/lib/me/profile.ts` — `updateMyProfile()` (`PATCH /me`)

Endrer visningsnavn, locale og timezone. Endrer bevisst IKKE `country_code` —
det er en egen, strengere operasjon (se under). Et rent språkbytte for en
allerede aktiv konto krever IKKE nytt samtykke: 7.1s krav om at
samtykketekster lastes på nytt og nullstilles ved endret land/språk gjelder
registreringsSKJEMAET før innsending, ikke løpende redigering av en ferdig
konto — bare landbytte (7.3, FR-010) er eksplisitt underlagt et nytt
samtykkekrav.

Ny ren valideringsfunksjon `src/lib/me/validate.ts` (`isValidTimezone`) —
lar `Intl.DateTimeFormat` selv avgjøre gyldigheten av en IANA-tidssone i
stedet for å vedlikeholde en egen liste som fort blir utdatert. Testet
isolert (samme "ren funksjon, ingen andre importer"-mønster som
`safe-redirect.ts`).

### `src/lib/me/change-country.ts` — `changeCountry()` (`POST /me/change-country`)

Bygger 7.3 ordrett: sjekker samtykke FØR noe som helst skrives (FR-010:
avslag skal la `country_code` stå uendret), trekker tilbake KUN det gamle
terms/privacy-samtykket (`withdrawn_at`) — bevisst IKKE
`email_subscription`/`minimum_age`, som ikke er knyttet til et bestemt land
— skriver nye ConsentRecord-rader med `source = "country_change"` (enum-
verdien fantes allerede i skjemaet, forberedt tidligere i natt uten at
funksjonen som bruker den var bygget), og oppdaterer til slutt
`users.country_code`/`locale`. Ingen egen handling trengs for å "flytte
abonnementet til det nye landets digest" (7.3, punkt 2) — bekreftet ved å
lese `tick.ts`: digest-jobben grupperer mottakere på `users.country_code`
direkte, uten noen egen landkobling på `email_subscriptions`. Allerede
innsendte svar røres bevisst ikke (punkt 3).

Rollesjekk (kun mottakere — 7.3 siste avsnitt: journalist kan ikke bytte
land selv) håndheves i RUTEN, ikke i biblioteksfunksjonen — samme
ansvarsfordeling som resten av kodebasen (rute = rolle, bibliotek =
forretningsregler for den gitte brukeren).

Utvidet `src/db/integration/fixtures.ts` med `ensureSecondTestCountry()`
(`TEST_COUNTRY_CODE_2 = "XU"`) — landbytte kan ikke testes meningsfullt mot
bare ett testland.

### `src/lib/journalists/journalist-profile.ts` — `GET`/`PATCH /journalists/me`

`getJournalistProfile()` slår sammen `JournalistProfile`-feltene med
`User.country_code`/`locale` (landet ligger på `User`, ikke på profilen,
19.5). `updateJournalistProfile()` endrer KUN kontaktfeltene (fullName,
jobTitle, organizationName, organizationUrl) — ALDRI `country_code` (krever
ny moderatorvurdering, 7.3) og ALDRI `verification_status` (kun moderator).

**Antagelse tatt, dokumentert i kodekommentar:** spec-en sier ingenting om
hvorvidt en redigering av disse kontaktfeltene skal utløse ny
moderatorbehandling. 8.1 lister bare søknad → review som utløsende hendelse
for `verification_status` — ikke senere redigering av en allerede vurdert
profil. Valgt å IKKE tilbakestille `verification_status` ved slik
redigering. Revurder om dette er feil lesning.

### Nye ruter

`PATCH /api/me`, `POST /api/me/change-country`, `GET /api/journalists/me`,
`PATCH /api/journalists/me`.

### Ny i18n-nøkkel

`errors.invalid_timezone` lagt til i `nb-NO.json` (samme mønster som de
øvrige `errors.*`-nøklene — brukes av en fremtidig frontend, ikke av
`i18n:check` direkte siden den bare scanner etter bokstavelige `t(...)`-kall
i kildekoden, som ikke finnes i disse rutene ennå).

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/me/change-country.integration.test.ts` (2 tester): bytte av land
  trekker tilbake gammelt terms/privacy-samtykke og skriver nytt for det nye
  landet; avslått samtykke lar `country_code` stå uendret.
- `src/lib/me/profile.integration.test.ts` (3 tester): oppdaterer
  visningsnavn/timezone, avviser ugyldig timezone uten å skrive noe, avviser
  en locale landet ikke tilbyr.
- `src/lib/journalists/journalist-profile.integration.test.ts` (3 tester):
  henter sammenslått profil, oppdaterer kontaktfelt uten å røre
  `verification_status`, avviser tomme felt.

Alle 14 integrasjonstester (5 testfiler) grønne:
`DATABASE_URL="postgres://kildebanken:kildebanken@localhost:5432/kildebanken_test" npx vitest run -c vitest.integration.config.ts`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
inkludert 2 nye for `isValidTimezone`), `i18n:check`, `next build`
(**33 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(14 tester, alle grønne).

### Rettet en feil i tidligere økters egne notater — IKKE et hull i spec/kode

Før neste steg ble påbegynt: sjekket `GET /me/data-export`, som har stått på
"neste økt"-listen flere ganger i natt, mot selve spec-en. Den finnes IKKE i
seksjon 20s API-liste, og seksjon 25 ("Kuttet fra v1"), punkt 13, sier
eksplisitt: **"Selvbetjent dataeksport ... GDPR krever at retten oppfylles,
ikke at den er selvbetjent. Manuell rutine med 30 dagers frist er
tilstrekkelig."** Bekreftet også av 17.3: nedlasting av egne data er uttrykkelig
listet under "Manuelt i v1", ikke "Selvbetjent i v1".

Dette er altså IKKE et hull mellom spec og kode som skal rettes ved å bygge
noe — det er en feil i mine egne tidligere "neste økt"-notater, som gjentok
et punkt uten å sjekke det mot spec-en først. Retter herved: ingen
`GET /me/data-export`-rute skal bygges i v1. En manuell rutine (moderator
eksporterer på forespørsel til personvern-kontaktadressen) er alt spec-en
krever, og krever ikke applikasjonskode.

### Neste økt

(1) vurder om flere kritiske databasenivå-invarianter bør få
integrasjonstester (kontosletting-anonymisering,
`contact_requests.response_id`-unikheten, FR-029 sitt
maks-5-samtidig-publiserte-forespørsler); (2) faktisk Brevo-integrasjon når en
API-nøkkel finnes; (3) husk at Postgres-instansen i sandkassen må startes på
nytt (`service postgresql start`) i en ny sandkasse-økt — se merknad i
forrige del av denne økten. Alle rutene i SPEC-V1.md seksjon 20 er nå bygget
bortsett fra admin/moderator-rutene som ikke er prioritert i natt
(`/admin/users/:id/suspend`, `/admin/digests*`, `/admin/countries*`,
`/admin/legal-documents`, `/report`, `/unsubscribe/:token`) — vurder disse
som neste kandidat dersom det fortsatt er tid.

---

## Fortsettelse av økt 7 — `/legal/:country/:locale/:type`, `/unsubscribe/:token`, `/report`

Samme arbeidsøkt. Plukket videre fra restlisten over.

### Ekte hull funnet: `POST /report` forutsetter en e-postmal som ikke fantes i spec-en

12.5 sier "sender e-post til moderatorene for det aktuelle landet", og
seksjon 20 lister ruten — men seksjon 15s maltabell hadde ingen rad for
dette. Rettet spec-en FØRST (lagt til "Innhold rapportert (forespørsel eller
svar) | moderator", med forklarende merknad i teksten under tabellen, samme
mønster som de to forrige tilføyelsene i økt 7), deretter lagt
`"content_reported"` til `TransactionalTemplate`-unionen i
`src/lib/email/send.ts`.

### `src/lib/reports/reports.ts` — `submitReport()` (`POST /report`)

Ingen egen datamodell (25, punkt 10 — bevisst kuttet fra v1). Slår opp
landet til den rapporterte entiteten (`request.country_code` direkte, eller
via forespørselen et `response` tilhører), henter moderatorene tildelt DET
landet (`moderator_countries`), og sender ett `content_reported`-varsel til
hver. Lagrer ingenting selv — moderator vurderer og logger selve TILTAKET
manuelt (12.5, ordrett).

### `src/lib/subscriptions/unsubscribe.ts` — `unsubscribeByToken()` (`POST /unsubscribe/:token`)

Verifiserer tokenet mot `email_subscriptions.unsubscribe_token_hash` (samme
hash-mønster som alle andre tokens i kodebasen). Idempotent — et andre klikk
på en allerede brukt (men ennå ikke rotert) lenke er ok, ikke en feil. 17.4:
"Avmeldt adresse — Hashet på sperreliste, ubegrenset" — derfor settes
IKKE bare `status = unsubscribed` på abonnementet, adressen legges også inn i
`suppressions` (hash av e-post, ikke selve adressen), en tabell som fantes i
skjemaet men som ingen kode faktisk skrev til før nå.

### `GET /legal/:country/:locale/:type`

Tynn wrapper rundt den allerede eksisterende `getCurrentLegalDocument()`
(bygget tidligere i natt for registreringsflytene) — offentlig, ingen
innlogging, siden vilkår og personvernerklæring må kunne leses FØR
registrering.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/reports/reports.integration.test.ts` (4 tester): finner riktig
  land for både en rapportert forespørsel og et rapportert svar (via
  forespørselen det tilhører), avviser ukjent `entity_id`, avviser tom
  begrunnelse.
- `src/lib/subscriptions/unsubscribe.integration.test.ts` (3 tester): melder
  av og legger adressen på sperrelisten, idempotent ved andre klikk, avviser
  ukjent token.

Alle 21 integrasjonstester (7 testfiler) grønne.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (**36 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(21 tester, alle grønne).

### Neste økt

Gjenstår av seksjon 20: kun admin/moderator-administrasjonsrutene
(`/admin/users/:id/suspend`, `GET /admin/digests`,
`POST /admin/digests/:id/retry`, `/admin/countries*`,
`POST /admin/countries/:code/moderators`, `POST /admin/legal-documents`) —
et sammenhengende "landadministrasjon for administrator"-sett (16.2, siste
kulepunkt), naturlig neste byggeblokk. Ellers: faktisk Brevo-integrasjon når
en API-nøkkel finnes, og flere integrasjonstester for kritiske invarianter
nå som riggen finnes.

---

## Fortsettelse av økt 7 — `POST /admin/users/:id/suspend` (+ ny `unsuspend`)

Samme arbeidsøkt.

### Ekte hull funnet: seksjon 20 manglet en "opphev suspensjon"-rute

8.1s tilstandsdiagram viser eksplisitt `suspended → active`, og 16.2 lister
"opphev suspensjon" som en egen moderatorhandling for journalister — men
seksjon 20s rute-liste hadde bare `POST /admin/users/:id/suspend`, aldri
det motsatte. Rettet spec-en først: lagt til
`POST /admin/users/:id/unsuspend`, med forklarende merknad rett under
API-blokken (samme mønster som de tidligere tilføyelsene i økt 7).

### `src/lib/moderation/users.ts` — `suspendUser()` / `unsuspendUser()`

8.1: "Ved suspensjon skjules journalistens publiserte forespørsler
umiddelbart." Bevisst IKKE implementert som en tilstandsendring på selve
`requests`-raden (det ville vært det samme som `closeRequest()`, og
spec-en bruker et annet ord — "skjules", ikke "lukkes" — nettopp fordi det
er midlertidig og reversibelt). Implementert i stedet som en
SYNLIGHETSREGEL på lesesiden:

- `getPublicRequest()` (`src/lib/requests/requests.ts`) joiner nå også mot
  `users` og krever `status = active` hos eieren.
- `runDigestTick()`s spørring etter nye, digest-klare forespørsler
  (`src/lib/jobs/tick.ts`) filtrerer på det samme, slik at en suspendert
  journalists forespørsler heller ikke tas med i en NY digest.

Begge reverseres derfor AUTOMATISK når `unsuspendUser()` setter status
tilbake til `active` — ingen egen "vis igjen"-handling nødvendig, og ingen
risiko for at de to stedene kommer ut av synk siden begge leser samme felt.

`suspendUser()` kansellerer i tillegg journalistens egne PENDING
kontaktforespørsler (8.1: "åpne kontaktforespørsler kanselleres") og
tilbakekaller alle økter (samme `revokeAllSessionsForUser()` som
kontosletting bruker). `unsuspendUser()` rører bevisst IKKE
`verification_status` (8.1, siste setning: forblir `approved` uten ny
moderatorbehandling).

Begge funksjonene følger samme mønster som resten av
`src/lib/moderation/`: autorisasjonssjekken
(`requireModeratorForCountry()`) skjer INNE i biblioteksfunksjonen, ikke i
ruten — og importerer dermed transitivt `"server-only"` via `session.ts`.
Det betyr, som for resten av modereringsmodulen, at disse to funksjonene
IKKE kan integrasjonstestes direkte (samme begrensning som
`approveJournalist()` m.fl. — udekket fra før, ikke en ny svakhet).

**Fant og rettet et fixture-hull i samme slengen:** `createActiveJournalist()`
i `src/db/integration/fixtures.ts` opprettet en bruker med `role =
journalist` UTEN noen tilhørende `JournalistProfile`-rad — en tilstand som
aldri kan oppstå i ekte drift (19.5: én-til-én, opprettet atomisk). Dette
var usynlig helt til den nye `getPublicRequest()`-testen under (som
innerjoiner mot `journalist_profiles`) rett og slett ikke fant noen rad i
det hele tatt. Rettet: fixture-en oppretter nå alltid en godkjent profil i
samme kall.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/requests/requests.integration.test.ts` (2 tester): en publisert
  forespørsel er synlig så lenge eieren er aktiv; skjules umiddelbart ved
  suspensjon og blir synlig igjen når suspensjonen oppheves — verifiserer
  selve synlighetsregelen `suspendUser()`/`unsuspendUser()` er bygget på,
  siden funksjonene selv ikke kan testes direkte (se over).

Alle 23 integrasjonstester (8 testfiler) grønne.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (**38 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(23 tester, alle grønne).

### Neste økt

Gjenstår av seksjon 20: kun det administrative "landstyrings"-settet for
administrator (`GET /admin/digests`, `POST /admin/digests/:id/retry`,
`GET/POST /admin/countries`, `PATCH /admin/countries/:code`,
`POST /admin/countries/:code/moderators`, `POST /admin/legal-documents`) og
`POST /admin/requests/:id/close` (admin-variant, adskilt fra journalistens
egen). Ellers: faktisk Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — `POST /admin/requests/:id/close` + rettet en reell autorisasjonsbrist

Samme arbeidsøkt.

### Ekte sikkerhetshull funnet og rettet i `closeRequest()`

Ved bygging av admin-varianten av lukkeruten ble det tydelig at
`closeRequest()` (bygget tidligere i natt, brukt av `POST /requests/:id/close`)
sin autorisasjon for ikke-eiere bare sjekket `role === "moderator" ||
role === "admin"` — UTEN å sjekke om moderatoren faktisk er tildelt
FORESPØRSELENS land. Dette bryter direkte med seksjon 4: "en moderator er
tildelt ett eller flere land og ser bare køer og brukere tilhørende disse."
En moderator tildelt ett land kunne dermed lukke en hvilken som helst
forespørsel i et HELT ANNET land.

Rettet i `src/lib/requests/requests.ts`: for en moderator (ikke eier, ikke
administrator) sjekkes nå `moderator_countries` mot forespørselens
`country_code` før lukking tillates. Administrator er fortsatt unntatt (har
tilgang til alle land, 19.4). Denne funksjonen importerer bevisst IKKE
`session.ts` (og dermed ikke `"server-only"`) — den tar `actorUserId` som
enkel streng-parameter, samme mønster som resten av `requests.ts` — så
rettelsen kunne integrasjonstestes direkte, i motsetning til
`suspendUser()`/`unsuspendUser()` fra forrige del av økten.

### `POST /admin/requests/:id/close`

Tynn rute, samme mønster som `POST /requests/:id/close` (som allerede kalte
den samme `closeRequest()`-funksjonen) — begge ruter er nå bevisst dokumentert
som to innganger til én operasjon, ikke duplisert logikk.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/requests/requests.integration.test.ts`, ny describe-blokk (2
  tester): en moderator tildelt et ANNET land nektes å lukke forespørselen
  (og forespørselen forblir `published`), en moderator tildelt SAMME land
  får lukke den.

Alle 25 integrasjonstester (8 testfiler) grønne.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (**39 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(25 tester, alle grønne).

### Neste økt

Gjenstår av seksjon 20: kun det administrative "landstyrings"-settet for
administrator (`GET/POST /admin/countries`, `PATCH /admin/countries/:code`,
`POST /admin/countries/:code/moderators`, `POST /admin/legal-documents`).
Ellers: faktisk Brevo-integrasjon når en API-nøkkel finnes. Vurder også en
tilsvarende gjennomgang av de ANDRE modereringsfunksjonene
(`approveJournalist`, `publishRequest` m.fl. i `src/lib/moderation/`) for
samme klasse av feil — de bruker `requireModeratorForCountry()` internt via
`session.ts`, som antas riktig, men er ikke bekreftet med en dedikert test
slik `closeRequest()` nå er.

---

## Fortsettelse av økt 7 — `GET /admin/digests`, `POST /admin/digests/:id/retry`

Samme arbeidsøkt.

### `src/lib/digests/digests.ts`

- `listDigests(session)` — samme filtreringsmønster som
  `listModerationQueue()`: moderator ser bare tildelte land, administrator
  ser alle.
- `retryFailedDigestDeliveries(digestId)` — SPEC-V1.md 16.2: "kjør på nytt
  ved feil." Sender KUN på nytt til `DigestDelivery`-rader med status
  `failed` (ikke til de som allerede fikk digesten — en delvis mislykket
  utsendelse skal ikke bli en dobbel levering til de som lyktes). Roterer
  BÅDE `access_token_hash` (på selve leveransen) og
  `email_subscriptions.unsubscribe_token_hash` på nytt — nøyaktig samme to
  rotasjoner som førstegangsutsendelsen i `tick.ts`, siden en mislykket
  sending kan ha rotert token-en uten at mottakeren noensinne fikk lenken.

**Bevisst duplisert, ikke delt kode:** rendrings-/sendeløkken her er en nær
kopi av `sendDigestToRecipients()` i `src/lib/jobs/tick.ts`, fremfor å
refaktorere ut en felles funksjon midt i en lang autonom økt. Risikoen ved å
røre selve digest-utsendelsesløpet (allerede testet og i produksjon-lignende
bruk hele natten) oppveier gevinsten av mindre duplisering her. Kandidat for
opprydding i dagslys, notert eksplisitt i kodekommentaren også.

### Testdekning — samme kjente begrensning som resten av `moderation/`

Forsøkte først å integrasjonsteste `listDigests()` direkte (den tar en
`CurrentSession` som VANLIG PARAMETER, i motsetning til f.eks.
`suspendUser()`) — men selve MODULEN `digests.ts` importerer
`requireModeratorForCountry` fra `src/lib/auth/authorize.ts`, som selv gjør
et ekte (ikke type-only) import av `getCurrentSession` fra `session.ts`.
Det er nok til at HELE `digests.ts`-modulen drar med seg `"server-only"`
ved import, uavhengig av hvilken funksjon i filen som faktisk testes.
Skrev først en test, fikk `"This module cannot be imported from a Client
Component module"` fra vitest, og slettet testfilen igjen — samme kjente,
aksepterte begrensning som resten av `src/lib/moderation/` (se forrige del
av økt 7). Verifisert kun ved `tsc`/`eslint`/`next build`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (**41 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(25 tester, uendret siden forrige del — ingen nye integrasjonstester denne
runden, se begrunnelse over).

### Neste økt

Gjenstår av seksjon 20: kun det administrative "landstyrings"-settet for
administrator (`GET/POST /admin/countries`, `PATCH /admin/countries/:code`,
`POST /admin/countries/:code/moderators`, `POST /admin/legal-documents`).
Dette er det SISTE gjenstående settet — når det er bygget er HELE
SPEC-V1.md seksjon 20 dekket. Ellers: faktisk Brevo-integrasjon når en
API-nøkkel finnes, og vurder om `retryFailedDigestDeliveries()` bør
refaktoreres til å dele kode med `tick.ts` fremfor å duplisere (se over).

---

## Fortsettelse av økt 7 — landstyring: SISTE settet i seksjon 20 er nå bygget

Samme arbeidsøkt. Med dette er **hele SPEC-V1.md seksjon 20 dekket** — alle
ruter listet der finnes nå som Route Handlers.

### `src/lib/admin/countries.ts` — "Land (kun administrator)" (16.2, 3.3)

Ny `requireAdmin()` i `src/lib/auth/authorize.ts` — til forskjell fra
`requireModeratorForCountry()` (som bevisst tillater BÅDE moderator og
administrator for landspesifikke handlinger), er hele "Land"-seksjonen i
16.2 eksplisitt "kun administrator". Brukt inne i alle fire funksjonene
under, samme mønster som resten av `src/lib/moderation/`.

- `listAllCountries()` / `createCountry()` (alltid `draft`, aldri direkte
  `active` — 3.3, ordrett) / `updateCountry()` (feltredigering).
- `setCountryStatus()` — statusbytte til `active` håndhever de
  KODESJEKKBARE forutsetningene fra 3.3: publiserte vilkår OG
  personvernerklæring i HVERT tilgjengelige språk, og minst én tildelt
  moderator. "Komplette oversettelser" og "juridisk gjennomgått" er bevisst
  IKKE forsøkt automatisert (menneskelig vurdering, hhv. en helt annen del
  av kodebasen) — fortsatt administrators eget ansvar før kallet, akkurat
  som spec-en selv sier.
- `assignModeratorToCountry()` — **antagelse tatt, dokumentert i
  kodekommentar:** spec-en sier at administrator "tildeler moderatorer»
  (16.2), men aldri hvordan en moderatorKONTO oppstår i utgangspunktet (kun
  mottaker og journalist har selvregistrering, 7.1/7.2). Valgt: admin oppgir
  en e-post; finnes ingen bruker opprettes én med `role = moderator` direkte
  (administrator-provisjonert tillit, ingen e-postbekreftelse å vente på);
  finnes brukeren med en ANNEN rolle, avvises kallet — å stille om en
  eksisterende mottaker-/journalistkonto til moderator er for
  tillitssensitivt til å gjøre implisitt.

`PATCH /admin/countries/:code` er ÉN rute i spec-en, men feltredigering og
statusbytte er bevisst to separate biblioteksfunksjoner kalt etter
hverandre fra ruten — statusbytte sine forutsetninger skal ikke kunne
omgås ved at et vanlig feltPATCH sniker seg forbi dem.

### `src/lib/admin/legal-documents.ts` — `publishLegalDocument()`

Publiserer alltid en NY versjon (17.2: eksisterende versjoner endres aldri).
Ved `isMaterialChange` på `terms`/`privacy` varsles aktive mottakere i
NØYAKTIG landet+locale-en dokumentet gjelder (dermed "på sitt eget språk"
per konstruksjon, uten noen egen språk-filtreringslogikk å holde synkron).

**To bevisst avgrensede antagelser, dokumentert i kodekommentar, ikke
løst:** (1) samme varsling for en `journalist_terms`-endring er IKKE bygget
— malen i seksjon 15 er skrevet for "mottaker" spesifikt, og å finne opp en
ny mal/mottakergruppe uten videre grunnlag i spec-en er for stor en
antagelse å ta stille; (2) "et nytt samtykke innhentes der endringen krever
det" (samme setning i 17.2) er IKKE bygget som noen tvungen
re-samtykke-sperre — spec-en sier ikke NÅR/HVORDAN (ved neste innlogging?
en blokkerende banner?), og å oppfinne den UX-en her uten videre grunnlag
risikerer å bygge feil ting.

### Nye ruter

`GET/POST /api/admin/countries`, `PATCH /api/admin/countries/[code]`,
`POST /api/admin/countries/[code]/moderators`,
`POST /api/admin/legal-documents`.

### Nye i18n-nøkler

`errors.already_exists`, `errors.no_moderator_assigned` — samme mønster som
øvrige `errors.*`-nøkler (for en fremtidig frontend).

### Testdekning — samme kjente begrensning som resten av `src/lib/moderation/`

Verken `countries.ts` eller `legal-documents.ts` kan integrasjonstestes
direkte: begge importerer `requireAdmin()` fra `authorize.ts`, som selv
gjør et ekte (ikke type-only) import av `getCurrentSession` fra
`session.ts` — akkurat samme kjede som gjorde `listDigests()` untestbar
tidligere i denne økten. Verifisert kun ved `tsc`/`eslint`/`next build`,
konsistent med resten av modereringskoden.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (**44 API-ruter totalt**), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(25 tester, uendret siden forrige del — se begrunnelse over).

### Status: HELE SPEC-V1.md seksjon 20 er nå bygget

Alle ~45 endepunktene listet i seksjon 20 finnes nå som Route Handlers.
Gjenstående kjente arbeid, ingen av det blokkerende for et v1-lanseringsklart
API-lag:

1. Faktisk Brevo-integrasjon (transaksjonelt + bulk) når en API-nøkkel
   finnes — all e-post er fortsatt et konsoll-stubbet grensesnitt
   (`src/lib/email/send.ts`).
2. `retryFailedDigestDeliveries()` dupliserer rendrings-/sendelogikk fra
   `tick.ts` bevisst — kandidat for sammenslåing i dagslys.
3. Flere av modereringsfunksjonene (`approveJournalist`, `publishRequest`,
   `suspendUser`, hele `src/lib/admin/*`) er strukturelt untestbare med
   vitest pga. `"server-only"`-kjeden gjennom `session.ts`/`authorize.ts` —
   verifisert gjennom hele natten kun ved typecheck/lint/build. En ekte
   e2e- eller komponent-testrigg (Playwright mot en kjørende `next dev`,
   eller et jest-miljø som later som Next sin bundler) ville lukket dette
   gapet, men er ikke bygget i natt.
4. Ingen frontend (sider/komponenter) er bygget ennå — kun API-laget.

### Neste økt

Uten videre eksplisitt prioritering fra brukeren: naturlig neste steg er
enten (a) begynne på selve frontend-en (design-tokens og i18n-rammeverket
er allerede lagt fase 1, klare til bruk), eller (b) fortsette å styrke
testdekningen av det som ER bygget innenfor de begrensningene som er
dokumentert over. Fortsetter å lese denne filen (siste økt øverst) ved neste
oppvåkning og velger basert på hva som gir mest verdi da.
