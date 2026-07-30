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
