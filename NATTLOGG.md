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

---

## Fortsettelse av økt 7 — ekte hull funnet: sperrelisten ble aldri sjekket ved registrering

Samme arbeidsøkt. Før frontend-arbeid eller videre testherding: gjorde en
kort, målrettet gjennomgang av `suppressions`-tabellen (19.13) siden
`unsubscribeByToken()` (bygget tidligere i økten) er den ENESTE koden som
noensinne SKRIVER til den — ingen kode leste fra den.

10.3, ordrett: "Avmeldte adresser beholdes hashet på en sperreliste, slik at
de IKKE KAN registreres inn igjen ved en feil." `registerRecipient()`
sjekket aldri sperrelisten — en avmeldt/sperret e-postadresse kunne
registreres på nytt akkurat som om den aldri hadde vært avmeldt. Et reelt,
funksjonelt hull (ikke bare en manglende feilmelding), oppdaget ved å følge
dataflyten fra tabellen bakover til alle skrive- og lesesteder, ikke ved en
eksplisitt bestilling.

Rettet i `src/lib/registration/recipient.ts`: sjekker `suppressions` (hash
av oppgitt e-post) FØR eksisterende-konto-sjekken, og avviser med en ny,
egen feilkode `errors.email_suppressed` (bevisst forskjellig fra
`errors.email_already_registered` — det er to forskjellige tilstander:
"kontoen finnes" vs. "denne adressen er sperret", og brukeren fortjener et
annet svar for hver).

**Bevisst IKKE utvidet til journalistregistrering** (`applyAsJournalist()`):
`email_subscriptions` (og dermed avmeldingslenken som eneste kilde til
`suppressions`-rader i dag) finnes kun for mottakere — journalister har
ingen bulk-utsendelse å melde seg av fra. 10.3 handler spesifikt om
digest-avmelding. Å sperre journalistsøknader på samme liste uten et
tilsvarende grunnlag i spec-en ville vært en ubegrunnet utvidelse.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/registration/recipient.integration.test.ts`, ny test: en e-post
  som står i `suppressions` avvises med `errors.email_suppressed`, og ingen
  bruker opprettes.

Alle 26 integrasjonstester (8 testfiler) grønne.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (44 API-ruter, uendret), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(26 tester, alle grønne).

### Neste økt

Samme som forrige: (a) begynne på frontend, eller (b) fortsette å lete
etter tilsvarende "skrevet men aldri lest" / "lest men aldri skrevet"-hull
ved å følge datamodellen tabell for tabell — denne metoden (spore
`suppressions` bakover) fant nettopp et reelt hull ingen eksplisitt
oppgave ba om å se etter, og er trolig verdt å gjenta på et par andre
tabeller (f.eks. `audit_logs`: skrives det til den fra ALLE stedene 19.12
og FR-050 forutsetter, eller bare noen?).

---

## Fortsettelse av økt 7 — fulgte opp `audit_logs`-sjekken selv, fant fem til

Samme arbeidsøkt. Fulgte opp forslaget rett over selv: grep'et alle
`insert(auditLogs)`-kall og sammenlignet mot FR-050 ("logge ALLE moderator-
og administratorhandlinger ... med land") for hver moderator-/
administratorfunksjon bygget i natt.

**Fem reelle hull funnet — alle i kode bygget senere i akkurat DENNE
økten, ikke eldre kode:**

1. `closeRequest()` (`src/lib/requests/requests.ts`) — loggførte aldri når
   en moderator/administrator (til forskjell fra eieren selv) lukket en
   forespørsel.
2. `createCountry()`, `updateCountry()`, `setCountryStatus()`,
   `assignModeratorToCountry()` (`src/lib/admin/countries.ts`) — INGEN av
   de fire administrator-handlingene ble loggført.
3. `publishLegalDocument()` (`src/lib/admin/legal-documents.ts`) — loggførte
   aldri publisering av en ny dokumentversjon.
4. `retryFailedDigestDeliveries()` (`src/lib/digests/digests.ts`) — loggførte
   aldri en gjenutsendelse.

Rettet alle fem ved å legge til `db.insert(auditLogs)` med
`actorType: "user"`, `actorUserId` (fra økten/sesjonen som utførte
handlingen), `countryCode` (FR-050: "med land"), en `action`-streng per
type handling (`request.close`, `country.create/update/status_change/
assign_moderator`, `legal_document.publish`, `digest.retry`), og
`metadata` der det ga tilleggsverdi (f.eks. ny status, antall
gjenutsendte).

`closeRequest()` logger KUN når det faktisk er en moderator/administrator
som handler — journalistens egen lukking av sin egen forespørsel er ikke en
"moderator-/administratorhandling" og skal ikke telle med.

### Ny, faktisk verifisert integrasjonstestdekning

- `src/lib/requests/requests.integration.test.ts`, utvidet siste test: en
  moderator som lukker en forespørsel etterlater nå en `audit_logs`-rad med
  riktig `actor_user_id`, `country_code` og `action = "request.close"`.
- De fire funksjonene i `src/lib/admin/countries.ts`, `legal-documents.ts`
  og `digests.ts` kunne IKKE testes direkte (samme `"server-only"`-kjede via
  `requireAdmin()`/`requireModeratorForCountry()` som gjorde `listDigests()`
  untestbar tidligere i økten) — verifisert kun ved `tsc`/`eslint`/
  `next build`.

Alle 26 integrasjonstester (8 testfiler) fortsatt grønne.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (56 tester,
uendret), `i18n:check`, `next build` (44 API-ruter, uendret), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(26 tester, alle grønne).

### Neste økt

Metoden "spor tabell X bakover til alle lese-/skrivesteder" fant seks reelle
hull på rad i natt (suppressions + fem audit_logs-hull). Verdt å gjenta på
flere tabeller neste økt, f.eks. `Suppression.reason` (håndheves
`hard_bounce`/`complaint`/`three-strikes`-reglene fra 10.3 noe sted, eller
er bare `unsubscribed` faktisk implementert?), eller en systematisk
gjennomgang av hvilke FR-punkter i seksjon 22 som IKKE har tilsvarende kode
ennå. Ellers: samme som før — frontend, eller faktisk Brevo-integrasjon.

---

## Fortsettelse av økt 7 — fulgte opp `Suppression.reason` selv, bygget bounce/klage-webhooken

Samme arbeidsøkt (nattens hourly trigger fyrte på nytt med en utdatert
prioriteringsliste fra tidlig i natt — sjekket `git log`/status og fant at
alt den listet som "neste steg" for lengst er ferdig og pushet; fortsatte i
stedet fra NATTLOGG.md sin faktiske siste "Neste økt"-notat, som er
gjeldende kilde til sannhet for status, ikke triggerens faste
promptmal).

Fulgte opp spørsmålet fra forrige "Neste økt": er
`hard_bounce`/`complaint`/tre-på-rad-reglene fra 10.3 faktisk bygget noe
sted? Svaret var nei — `unsubscribeByToken()` var eneste kode som skrev til
`suppressions`. 10.1 punkt 9 ("behandle bounce- og klage-webhooks
fortløpende") og FR-037 ("Test: simulert webhook") forutsetter begge et
webhook-endepunkt som ikke fantes noe sted, verken i kode eller i seksjon
20s ruteliste.

### To spec-rettelser (spec først, så kode, som alltid)

1. **19.9 EmailSubscription** manglet et felt for å telle sammenhengende
   myke bounces — 10.3 sier "tre myke bounces på rad behandles som hard
   bounce", men datamodellen ga ingen måte å telle dem på. Lagt til
   `consecutive_soft_bounces` (heltall, default 0).
2. **Seksjon 20** manglet selve webhook-ruten. Lagt til
   `POST /webhooks/email-events`, med merknad om at den er ubeskyttet av
   innlogging (kalles av leverandøren) og i stedet sikret med en delt
   hemmelighet.

### Skjema og migrasjon

`src/db/schema.ts`: ny kolonne `consecutiveSoftBounces` på
`emailSubscriptions`. Generert og kjørt migrasjon `0006_certain_cable.sql`
(`ALTER TABLE ... ADD COLUMN ... DEFAULT 0 NOT NULL`) mot
`kildebanken_test`.

### Kode

- `src/lib/subscriptions/bounce-policy.ts` — ren funksjon
  `shouldEscalateToHardBounce()`, samme "ingen andre importer"-mønster som
  `safe-redirect.ts`, testet isolert med rene enhetstester.
- `src/lib/subscriptions/email-events.ts` — `processEmailEvent()`. Tar en
  ALLEREDE NORMALISERT hendelsestype (`delivered | soft_bounce |
  hard_bounce | complaint`) — selve tolkningen av Brevos faktiske
  feltnavn/verdier skjer i ruten, samme adapter-/kjernelogikk-fordeling som
  `netlify/functions/tick.ts` vs. `src/lib/jobs/tick.ts`
  (`INFRASTRUCTURE.md` 16.8): bytter vi e-postleverandør, er det bare
  tolkningen i ruten som må endres. Returnerer `{ handled: boolean }`, ikke
  en feil, for en ukjent e-post — en webhook skal alltid få 200 tilbake for
  en hendelse den ikke har noe å gjøre med, ellers gjentar leverandøren
  forsøket unødvendig.
  - `hard_bounce` → `status = bounced` + sperrelisten (`reason:
    hard_bounce`).
  - `complaint` → `status = unsubscribed` umiddelbart + sperrelisten
    (`reason: complaint`).
  - `soft_bounce` → øker telleren; ved den TREDJE sammenhengende
    eskaleres det til akkurat samme hard-bounce-håndtering som over.
  - `delivered` → nullstiller telleren (bryter en påbegynt rekke).
- `src/app/api/webhooks/email-events/route.ts` — normaliserer Brevos
  hendelsestype (verdiene er IKKE bekreftet mot ekte Brevo-dokumentasjon i
  denne økten, ingen nettverkstilgang til Brevo tilgjengelig — dekker
  defensivt både snake_case og camelCase-varianter, MÅ verifiseres før
  produksjon, samme forbehold som Brevo-TODO-en i `send.ts`), og krever en
  delt hemmelighet (`EMAIL_WEBHOOK_SECRET`) via query-parameter eller
  header. **Feiler LUKKET:** mangler hemmeligheten i miljøet, avvises ALLE
  kall (401) — samme "trygg standard"-prinsipp som `RETENTION_DRY_RUN`.

### Ny, faktisk verifisert integrasjonstestdekning

`src/lib/subscriptions/email-events.integration.test.ts` (6 tester): ukjent
e-post gir `handled: false` uten feil; hard bounce setter status og
sperrer; klage setter `unsubscribed` og sperrer; to myke bounces øker
telleren uten å eskalere; den TREDJE sammenhengende eskalerer til hard
bounce (kjerneregelen fra 10.3, bekreftet ordrett); en vellykket levering
bryter en påbegynt rekke slik at telleren faktisk starter på nytt.

Pluss 3 nye rene enhetstester for `shouldEscalateToHardBounce()`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**59 tester**,
+3 nye), `i18n:check`, `next build` (**45 API-ruter totalt**, +1), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(**32 tester**, +6 nye, 9 testfiler).

### Neste økt

`processEmailEvent()` oppdaterer i dag KUN `email_subscriptions` og
`suppressions` på e-postnivå — den oppdaterer IKKE den spesifikke
`DigestDelivery`-raden en hendelse faktisk gjelder, siden
`digest_deliveries.provider_message_id` aldri settes ennå (Brevo er ikke
reelt tilkoblet, `sendBulkEmail()` returnerer ingen ekte melding-ID). Når
faktisk Brevo-integrasjon bygges, bør webhook-ruten også korrelere på
`provider_message_id` og oppdatere den enkelte leveranseraden, ikke bare
kontoen. Ellers: samme restliste som før — frontend, eller en systematisk
FR-for-FR-gjennomgang av seksjon 22.

---

## Fortsettelse av økt 7 — systematisk FR-gjennomgang fant ett hull til: `GET /admin/responses/:id`

Samme arbeidsøkt (nattens `create_trigger`-fyring kom med en utdatert
prioriteringsliste fra tidlig i natt — bekreftet mot `git log` at alt den
nevnte for lengst er ferdig, og fortsatte i stedet herfra, siste økt).
Gjorde en rask, målrettet skanning av FR-listen (seksjon 22) mot bygget
kode, ikke en fullstendig gjennomgang av alle ~54 punktene, men nok til å
finne én til av samme klasse hull som i natt for øvrig.

**FR-051:** "Systemet skal kreve en registrert begrunnelse før en
ADMINISTRATOR kan åpne et enkeltsvar." Og 16.2: "Åpning av et enkeltsvar
... krever at administratoren velger en begrunnelse fra en LISTE.
Oppslaget logges med begrunnelsen." Verken ruten (ingen
`GET /admin/responses/:id` noe sted i seksjon 20) eller selve LISTEN over
gyldige begrunnelser fantes i spec-en — enda FR-051 eksplisitt tester mot
den.

### Rettet spec-en først

- **16.2**: lagt til en konkret, lukket liste over fire begrunnelser
  (`user_support_request`, `abuse_report_investigation`,
  `legal_or_regulatory_request`, `security_incident`) — en ANTAGELSE tatt
  her, dokumentert eksplisitt som sådan, siden spec-en ikke oppga konkrete
  verdier noe sted. Bevisst forskjellig fra fritekstbegrunnelser andre
  steder (f.eks. avvisning av en forespørsel, 9.2) — der beskriver
  moderator SITT resonnement i egne ord, mens dette er faste kategorier
  nettopp for å kunne revidere alle oppslag av én kategori i etterkant.
- **Seksjon 20**: lagt til `GET /admin/responses/:id?reason=...`.

### `src/lib/admin/responses.ts` — `getResponseForAdmin()`

Krever administrator SPESIFIKT (FR-051, ordrett — ikke moderator, til
forskjell fra de fleste andre modereringsrutene som tillater begge).
Loggfører oppslaget MED begrunnelsen FØR svaret returneres, slik at et
oppslag alltid er loggført selv om noe skulle feile lenger ute i
kallkjeden. Filtrerer bevisst IKKE på `lifecycle_status` slik
journalistens egen innboks gjør (kun `submitted`) — poenget med denne
ruten er nettopp unntaksvis tilgang, inkludert til svar en moderator
allerede har skjult (`hidden_by_moderator`), f.eks. under en
misbruksundersøkelse.

### Testdekning — samme kjente begrensning som resten av `src/lib/admin/`

Kan ikke integrasjonstestes direkte (samme `"server-only"`-kjede via
`requireAdmin()` som gjorde `listDigests()` og hele
`src/lib/admin/countries.ts`/`legal-documents.ts` untestbare tidligere i
natt). Verifisert kun ved `tsc`/`eslint`/`next build`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (59 tester,
uendret), `i18n:check`, `next build` (**46 API-ruter totalt**, +1), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(32 tester, uendret — se begrunnelse over).

### Neste økt

Den systematiske FR-gjennomgangen ble bare gjort delvis (ikke alle ~54
FR-punktene sjekket mot kode ennå) — verdt å fullføre resten neste økt før
noe annet, siden metoden har funnet syv reelle hull på rad i natt
(suppressions, fem audit_logs-hull, og nå denne). Ellers: samme restliste
som før — frontend, eller faktisk Brevo-integrasjon når en API-nøkkel
finnes.

---

## Fortsettelse av økt 7 — fortsatte FR-gjennomgangen, fant hull nr. 8: FR-038

Samme arbeidsøkt. Fortsatte den systematiske FR-for-FR-gjennomgangen fra
forrige del.

**FR-038:** "Alle bulkutsendelser skal inneholde `List-Unsubscribe` og
`List-Unsubscribe-Post`." `SendBulkEmailInput` (`src/lib/email/send.ts`)
hadde ingen felt for dette i det hele tatt — verken tick.ts sin
førstegangsutsendelse eller `retryFailedDigestDeliveries()` sin
gjenutsendelse kunne noensinne satt headeren, siden grensesnittet ikke bar
informasjonen frem dit.

Ingen spec-rettelse nødvendig denne gangen — FR-038 var allerede presist og
riktig formulert, bare ikke bygget.

### Rettet

- `SendBulkEmailInput.listUnsubscribeUrl` — nytt, OBLIGATORISK felt (ikke
  valgfritt, med hensikt: en glemt header skal være en typefeil ved
  kompilering, ikke en stille mangel i produksjon). Peker på API-RUTEN
  direkte (`/api/unsubscribe/:token`), IKKE frontend-siden lenken i selve
  e-postteksten peker til (`src/lib/email/digest.ts`) — en e-postklient
  POSTer rett til denne uten å rendre noen side (RFC 8058, "one-click").
- Eksporterte `SITE_ORIGIN` fra `digest.ts` (var privat) slik at både
  `tick.ts` og `digests.ts` kan bygge samme URL uten å duplisere
  fallback-verdien.
- Begge de to reelle kallstedene til `sendBulkEmail()` (førstegangsutsendelse
  i `tick.ts`, gjenutsendelse i `digests.ts`) sender nå med
  `listUnsubscribeUrl`.
- Selve HTTP-headeren er IKKE satt ennå — det krever den faktiske
  Brevo-API-integrasjonen, som fortsatt er en TODO (`send.ts`). Feltet
  finnes nå i grensesnittet slik at det ikke glemmes NÅR den bygges — samme
  "forbered grensesnittet, utsett selve leverandørkallet"-mønster som
  resten av `send.ts`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (59 tester,
uendret), `i18n:check`, `next build` (46 API-ruter, uendret — ingen ny rute
denne gangen), OG `npx vitest run -c vitest.integration.config.ts` mot ekte
lokal Postgres (32 tester, uendret).

### Neste økt

Fortsett FR-for-FR-gjennomgangen — gjenstår bl.a. en grundigere sjekk av
FR-013 (aktivere land uten kodeendring — bygget, men aldri kjørt ende-til-
ende mot ekte data i denne sandkassen), FR-028 (kodegjennomgang: kan en
forespørsel publiseres uten å ha vært innom `submitted`+moderatorhandling —
sjekk `publishRequest()` sin forutsetning eksplisitt), og FR-052
(kodegjennomgang: bekreft at det virkelig ikke finnes noen
tvers-av-forespørsler-svarvisning). Ellers: frontend, eller faktisk
Brevo-integrasjon.

---

## Fortsettelse av økt 7 — sjekket FR-028 og FR-052 (kodegjennomgang, ingen kode endret)

Samme arbeidsøkt. Begge var kodegjennomgangs-krav (ikke automatisert
testbare), sjekket manuelt mot faktisk kode:

- **FR-028** ("skal ikke publisere en forespørsel som ikke har vært innom
  `submitted` og en moderatorhandling"): `publishRequest()`
  (`src/lib/moderation/requests.ts`) er DEN ENESTE koden i hele kodebasen
  som setter `status = "published"`, og den krever eksplisitt
  `request.status === "submitted"` FØR den gjør det (ellers
  `errors.request_not_editable`). Bekreftet grepet mot `"published"` i hele
  `src/`. Ingen hull — tilfredsstilt ved design.
- **FR-052** ("ingen visning som lister svar på tvers av forespørsler"):
  gikk gjennom ALLE steder som spør mot `responses`-tabellen. Alle
  journalist-/admin-vendte spørringer er skalert til ÉN forespørsel eller
  ÉN respons om gangen (`journalist-inbox.ts`, `admin/responses.ts`,
  `contact-requests.ts`, `reports.ts`). Det ENESTE stedet som henter FLERE
  responser på tvers av forespørsler er `listMineResponses()` — men den er
  skopet til ÉN respondents EGNE innsendte svar (`GET /responses/mine`), som
  er noe helt annet enn en journalist/moderator som browser andres svar.
  Ingen hull.

Begge bekreftet uten kodeendring — ingen commit nødvendig for selve
sjekken, men notert her for å unngå å gjenta arbeidet en senere økt.

### Neste økt

Gjenstår av den systematiske FR-gjennomgangen: FR-013 (aktivere et land
ende-til-ende mot ekte data — kunne faktisk KJØRES nå som en lokal Postgres
finnes i sandkassen, i motsetning til resten av natten). Ellers: frontend,
eller faktisk Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — FR-013 verifisert ende-til-ende mot ekte HTTP, ikke bare lib-funksjoner

Samme arbeidsøkt (nok en gang startet med `git log`/`git status` for å
bekrefte at trigger-promptens "neste steg"-liste var utdatert — alt der er
gjort for lengst — og fortsatte fra NATTLOGG.md sin faktiske status).

Første gang i natt noe er testet over EKTE HTTP mot en kjørende `next dev`,
ikke bare kalt direkte som bibliotekfunksjoner i vitest. Alt tidligere i
natt har enten vært enhetstester, integrasjonstester mot biblioteksfunksjoner
(uten `"server-only"`-avhengighet), eller bare `tsc`/`eslint`/`next build`
for koden som IKKE kan testes uten en ekte innlogget økt (hele
`src/lib/admin/`, `suspendUser()` osv.). Denne runden lukker akkurat det
hullet for én konkret flyt.

### Fremgangsmåte

1. Startet Postgres på nytt (sandkassen hadde restartet siden forrige økt —
   som forventet, se merknad fra tidligere i natt), bekreftet migrasjon
   0006 sto ved lag.
2. Satte opp en midlertidig `.env.local` (IKKE committet — `.gitignore`
   dekker den) pekende på `kildebanken_test`.
3. Opprettet en administratorbruker direkte i databasen (ingen
   selvregistrering for rollen finnes, som ventet).
4. Startet `next dev`, hentet et ekte magic link-token fra konsoll-loggen
   (samme `[email:stub]`-mønster som resten av natten), verifiserte det mot
   `POST /api/auth/verify` og fikk en ekte økt-cookie.
5. Kjørte HELE FR-013-flyten som ekte HTTP-kall med den cookien:
   - `POST /api/admin/countries` — opprettet et helt NYTT land (`XE`),
     bekreftet `draft` og usynlig i `GET /api/countries` (offentlig), men
     synlig i `GET /api/admin/countries` (administrator).
   - `PATCH /api/admin/countries/XE {status: active}` FØR juridiske
     dokumenter fantes → korrekt avvist (`errors.legal_documents_unavailable`).
   - `POST /api/admin/legal-documents` × 2 (terms + privacy, `nb-NO`).
   - Samme aktiveringsforsøk igjen, FØR en moderator var tildelt → korrekt
     avvist (`errors.no_moderator_assigned`).
   - `POST /api/admin/countries/XE/moderators` — opprettet en ny
     moderatorkonto direkte via e-post (bekrefter antagelsen fra forrige
     del av natten fungerer i praksis).
   - Samme aktiveringsforsøk en tredje gang → LYKTES.
   - `GET /api/countries` — `XE` er nå offentlig synlig, uten noen
     kodeendring eller migrasjon underveis (FR-013, ordrett).
   - `POST /api/subscribe` mot det NYE landet — en ekte mottakerregistrering
     lyktes, med riktig `country_code`/`locale` på brukeren og alle FIRE
     forventede `ConsentRecord`-rader (samme mønster som verifisert i
     integrasjonstestene fra tidligere i natt, nå bekreftet over hele
     HTTP-stacken i tillegg til bibliotekslaget).
6. Stoppet `next dev`, ryddet opp ALLE testrader (bruker, økt, auth-token,
   samtykker, abonnement, moderatorstilldeling, revisjonslogg, juridiske
   dokumenter, selve landet `XE`) fra `kildebanken_test`, slettet den
   midlertidige `.env.local`. Bekreftet `kildebanken_test` er tilbake til
   nøyaktig samme tilstand som før (kun `XT`/`XU`, som de øvrige
   integrasjonstestene allerede forutsetter).

### Ingen kodeendring, ingen commit for selve testen

FR-013 var allerede riktig bygget — dette var en verifikasjon, ikke en
retting. Ingen hull funnet denne gangen; loggført likevel siden det er
første ekte HTTP-ende-til-ende-test i hele natten og verdt å vite at
metoden (manuell magic-link-utvinning fra dev-server-konsollen, cookie-jar
via curl) fungerer, om den skulle trengs igjen.

### Verifisert

Full HTTP-flyt over, PLUSS `npx vitest run -c vitest.integration.config.ts`
mot ekte lokal Postgres etterpå (32 tester, uendret — bekrefter opprydding
ikke etterlot noe som forstyrrer de andre testene).

### Neste økt

FR-013 er nå den TREDJE FR-en bekreftet uten hull denne natten (etter
FR-028 og FR-052). Fortsett gjerne den systematiske gjennomgangen for de
gjenværende FR-punktene, men metoden har nå funnet åtte reelle hull totalt
i natt og tre bekreftelser — avtagende treffrate, så det kan snart være
verdt å bytte fokus til frontend eller faktisk Brevo-integrasjon i stedet.

---

## Fortsettelse av økt 7 — retensjonsjobbens fem kategorier fikk ekte integrasjonstester

Samme arbeidsøkt. Vurderte frontend-arbeid (komponentbibliotek,
token-eksport til e-postmaler) som neste steg, men to grunner talte imot å
starte det nå: (1) `DESIGN.md` er riktignok svært presist (eksakte
OKLCH-verdier, eksakt lagarkitektur) så det er IKKE et rent smaksspørsmål,
men en fullverdig implementasjon krever enten fargekonvertering
(OKLCH→hex for e-postklienter som ikke støtter `oklch()`, f.eks. Outlook)
eller en omstrukturering av selve token-kildefilene — begge er egne,
større arbeidsstykker jeg ikke vil gjøre forhastet; (2) brukerens
EKSPLISITTE opprinnelige instruks fra i går kveld fremhevet retensjonsjobben
spesifikt som noe som krevde "egne tester FØR den kobles til noe som
ligner ekte data, siden den sletter/anonymiserer persondata" — og denne
testdekningen manglet FORTSATT. Kun de rene dato-/flagg-funksjonene var
testet (`retention.test.ts`); ingen av de fem faktiske SQL-kategoriene
hadde noensinne kjørt mot en ekte database. Nå som en lokal Postgres finnes
i sandkassen (i motsetning til resten av natten), er dette den tydeligste
gjenværende etterlevelsen av en eksplisitt brukerinstruks — prioritert
foran nye, ferskere hull.

### `src/lib/jobs/retention.integration.test.ts` (6 tester)

`runRetention()` tar en `Database`-parameter (ingen `session.ts`-avhengighet)
og kunne derfor testes direkte mot ekte Postgres, som resten av
`src/lib/jobs/` og `src/lib/requests/` — i motsetning til hele
`src/lib/admin/`.

- **Innsendte svar** (12 mnd etter lukking): dry run teller men sletter
  ingenting; ekte kjøring sletter et svar 13 måneder forbi fristen, lar et
  1 måned gammelt stå urørt.
- **Kontaktforespørsler** (12 mnd etter avslutning): sletter en gammel
  AVGJORT (`declined`) rad, men rører ALDRI en like gammel `pending`-rad
  (19.8: kun terminale statuser regnes) eller en nylig avgjort rad.
- **Avviste journalistsøknader** (6 mnd): bekreftet at denne kategorien
  fortsatt KUN teller og ALDRI sletter, selv med
  `RETENTION_DRY_RUN=false` — `dryRun` er hardkodet `true` i selve
  returverdien for denne ene kategorien (bevisst ufullstendig, se
  filkommentaren i `retention.ts` fra tidligere i natt: krever samme
  anonymiseringsrutine som kontosletting, 17.5, ikke bygget som en egen,
  parallell sti). Testen bekrefter både at brukeren OG profilen fortsatt
  finnes etterpå, og at feilmeldingen forklarer hvorfor.
- **Revisjonslogg** (3 år): sletter en logglinje 4 år gammel, lar en 1 år
  gammel stå.
- **Digest og leveringsstatus** (12 mnd): sletter `DigestDelivery` FØR
  `Digest` (FK-rekkefølge), bekreftet ved at begge radene faktisk er borte
  etterpå, mens en nyere digest med sin leveranserad står urørt.

Alle testene bruker ekte, tidsforskjøvne rader (13 måneder/7 måneder/4 år
tilbake vs. 1 måned/1 år tilbake) — ingen mocking av `Date.now()`, siden
`monthsAgo()`/`yearsAgo()` allerede er rene, testbare funksjoner som tar en
`from`-parameter, men selve `runRetention()` bruker `new Date()` internt,
så cutoff-punktene beregnes på ekte kalenderdatoer relativt til NÅ ved
hver testkjøring.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (59 tester,
uendret — nytt filnavn korrekt ekskludert fra standardsuiten), `i18n:check`,
`next build` (46 API-ruter, uendret), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(**38 tester**, +6 nye, **10 testfiler**).

### Neste økt

Retensjonsjobbens fem kategorier har nå ekte dekning mot en ekte database —
den forsiktighets-forpliktelsen fra i går kveld er innfridd. Gjenstående
kjent, IKKE bygget del av 17.4: avviste journalistsøknader slettes
fortsatt aldri (krever samme anonymiseringsrutine som kontosletting, se
over) — verdt å bygge FERDIG en senere økt, med samme forsiktighet. Ellers:
frontend (nå med en klarere forståelse av at token-eksport til e-post
krever fargekonvertering som egen oppgave), eller faktisk Brevo-integrasjon
når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — fullførte retensjonsjobbens siste ufullstendige kategori

Samme arbeidsøkt (sandkassens Postgres hadde stoppet igjen mellom
øktene — som ventet, startet den på nytt før noe annet).

Fulgte opp punktet rett over selv: "avviste journalistsøknader" var den
ENESTE av de fem retensjonskategoriene som fortsatt bare TALTE og aldri
faktisk slettet noe, uansett `RETENTION_DRY_RUN`. Årsaken var dokumentert
i kodekommentaren fra tidligere i natt: sletting av `User`-raden krysser
flere tabeller og ble utsatt til den kunne gjøres trygt.

### Analyse som gjorde det trygt å fullføre

`JournalistProfile.verification_status = rejected` er ENDELIG (8.1), og
BÅDE `pending_review` og `rejected` har "kan sende til moderering: nei" i
samme tabell. En avvist journalist kan derfor ALDRI ha fått noen
forespørsel til `submitted`/`published` — enhver forespørsel de måtte ha
laget er garantert `draft | changes_requested | rejected`, og kan aldri ha
et svar eller en kontaktforespørsel knyttet til seg (begge krever en
`published` forespørsel). Full sletting av kontoen er dermed trygt uten
noen egen anonymiseringslogikk — ingen risiko for å etterlate foreldreløse
svar/kontaktforespørsler.

### Rettet i `src/lib/jobs/retention.ts`

`purgeRejectedJournalistApplications()` tar nå `dryRun` som parameter,
akkurat som de fire andre kategoriene, og sletter (i riktig FK-rekkefølge:
`requests` → `consent_records`/`auth_tokens`/`sessions` → `journalist_profiles`
→ `users`) når `RETENTION_DRY_RUN=false`.

**Bevisst IKKE via `performAccountDeletion()`** (17.5-rutinen,
`account-deletion.ts`) — den er skrevet for en AKTIV/godkjent konto og
sender en bekreftelses-e-post til brukeren. En avvist, aldri-godkjent
søknad har ingen aktivitet å varsle om, og renskes STILLE, samme prinsipp
som de fire andre kategoriene i denne jobben (ingen av dem varsler noen).
Vurdert og bevisst avvist å gjenbruke den delte rutinen, fremfor å anta at
"gjenbruk er alltid riktig" — de to situasjonene har reelt forskjellig
varslingsbehov.

### Oppdatert integrasjonstestdekning

Erstattet den gamle testen ("teller, men sletter aldri") med tre nye i
`retention.integration.test.ts`:

- Dry run teller en avvist søknad forbi 6-månedersfristen uten å slette
  noe.
- Ekte kjøring sletter bruker, profil OG et tilhørende UTKAST (bekrefter
  at antagelsen over — draft-forespørsler er trygge å slette med — faktisk
  stemmer i praksis), men lar en NYLIG avvist søknad (innenfor fristen)
  stå urørt.
- En fortsatt `pending_review`-profil, uansett alder, røres ALDRI — filteret
  er på `verification_status = rejected`, ikke bare alder.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (59 tester,
uendret), `i18n:check`, `next build` (46 API-ruter, uendret), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(**39 tester**, +1 netto — én gammel test erstattet med to nye, pluss de
seks fra forrige del av økten — 10 testfiler).

### Status: SPEC-V1.md 17.4 er nå fullt ut bygget og testet

Alle fem retensjonskategorier gjør nå det spec-en faktisk sier, verifisert
mot ekte Postgres, med `RETENTION_DRY_RUN=true` fortsatt som ubetinget
trygg standard i produksjon inntil noen eksplisitt slår den av.

### Neste økt

Ingen kjente gjenstående hull i 17.4. Naturlige neste steg: frontend, eller
faktisk Brevo-integrasjon når en API-nøkkel finnes. Husk (igjen): sandkassens
Postgres må startes på nytt (`service postgresql start`) ved hver ny
sandkasse-instans — skjedde denne gangen også, som forventet.

---

## Fortsettelse av økt 7 — frontend-arbeidet startet: komponentbibliotek, lag 3

Samme arbeidsøkt. Backend-API-et (seksjon 20) er ferdig, retensjonsjobben er
ferdig, og Brevo-integrasjon er fortsatt blokkert (ingen API-nøkkel). Med
det gjenstående valget mellom å begynne på frontend eller å lete etter enda
flere FR-hull med avtagende treffrate, startet jeg frontend-arbeidet — men
bevisst med LAG 3 (komponenter), IKKE sider/design ennå, fordi:

1. `DESIGN.md` er PRESIST nok (eksakte OKLCH-verdier, eksakt lagarkitektur,
   et konkret minimumssett komponenter) til at å bygge komponentene TRO MOT
   DEN er en implementasjonsoppgave, ikke en smaksbeslutning — lavere risiko
   enn å designe sider blindt uten brukerens tilbakemelding.
2. Alt videre frontend-arbeid (sider, skjemaer) er avhengig av at
   komponentene finnes først.

### Antagelse tatt, dokumentert: React Aria Components fremfor Radix

DESIGN.md 6 sier "Radix eller React Aria" — et bevisst åpent valg jeg måtte
ta. Valgte **React Aria Components** (`react-aria-components`, Adobe),
begrunnet med: (a) prosjektets uttalte i18n-tyngde (ICU MessageFormat,
`Intl`-formatering overalt, 21.3) matcher React Arias opprinnelse i et
internasjonaliseringstungt designsystem (React Spectrum) bedre enn Radix;
(b) pakken dekker DESIGN.md 6s minimumsliste nesten navn-for-navn
(`Button`, `TextField`, `TextArea`, `Checkbox`, `RadioGroup`, `Select`,
`Table`, `Tabs`, `Toast` finnes alle som egne eksporter). Ingen `next build`-
eller kjøretidsproblemer oppstått som følge av valget.

### Ny testinfrastruktur for komponenter

Ingen DOM-testing fantes i prosjektet før nå (all tidligere testing er
node-miljø mot biblioteksfunksjoner eller ekte Postgres). La til:

- `@vitejs/plugin-react` — PÅKREVD for at vitest i det hele tatt skal forstå
  JSX i `.tsx`-testfiler (feilet først med "React is not defined" uten
  denne; Next sin egen SWC-kompilator brukes fortsatt av selve appen,
  denne pluginen er KUN for vitest sin egen transform).
  - **Versjonsfallgruve unngått:** `@vitejs/plugin-react@6` krever
    `vite@^8`, men `vitest@2.1.x` sitt interne `vite-node` krever
    `vite@^5`. Installerte `@vitejs/plugin-react@4.7.0` (siste versjon som
    faktisk støtter `vite@^5`) i stedet — `npm install` sitt eget
    peer-dependency-avvik ved forsøk på v6 fanget dette FØR noe ble
    committet.
- `@testing-library/react`, `@testing-library/jest-dom`,
  `@testing-library/user-event`, `jsdom`.
- `vitest.config.ts`: lagt til `plugins: [react()]` og
  `setupFiles: ["./src/test/setup-dom.ts"]` (registrerer
  `cleanup()` mellom hver test og jest-dom sine matchers globalt — et
  no-op i node-miljø, så resten av suiten er upåvirket).
- Komponenttestfiler bruker `// @vitest-environment jsdom` som
  fil-lokal overstyring (vitest sin innebygde mekanisme) — resten av
  suiten forblir node-miljø uten noen DOM-forutsetning.

### `src/components/Button.tsx` + `TextField.tsx`

De to mest grunnleggende av DESIGN.md 6s 17-komponentsliste — alt annet
(skjemaer særlig) trenger begge. Bygget STRENGT etter tokens (aldri en
farge-/avstands-/radiusverdi direkte, kun `var(--color-*)`/`var(--space-*)`
osv.), og etter 6.1 sine krav ordrett:

- Fokusmarkering alltid synlig (`[data-focus-visible]`-selektor fra React
  Aria → 2px ring i `--color-focus-ring`, aldri fjernet).
- Trykkflate ≥ 44px (5, `min-height: 2.75rem`).
- Feilmelding VED FELTET (ikke bare topp-oppsummert), knyttet med
  `aria-describedby`, feltet får `aria-invalid`.

**Reell feil funnet OG rettet under bygging, ikke antatt riktig:** skrev
først `<FieldError>{errorMessage}</FieldError>` med `errorMessage` som en
ren streng — testet det, og oppdaget at React Aria Components sin
`FieldError` rendrer en streng-`children` UBETINGET, uavhengig av om
feltet faktisk er ugyldig (ikke dokumentert tydelig noe sted jeg fant,
oppdaget ved at en av mine egne tester feilet: "viser IKKE feiltekst når
feltet er gyldig" viste feilteksten likevel). Rettet ved å gi `FieldError`
en RENDER-FUNKSJON i stedet, som eksplisitt sjekker `isInvalid` fra
valideringstilstanden før den viser noe. Nøyaktig den typen feil som ikke
kan fanges med `tsc`/`eslint` alene — bare en faktisk kjørt test avdekket
den.

### Ny, spec-mandert lint-regel: `npm run design:check-tokens`

DESIGN.md 1, ordrett: "Håndheves med lint-regel som feiler CI på
hex-verdier, `rgb()`, `oklch()`, `px`-verdier utenfor tokenfilene, og på
bruk av lag 1-variabler i komponentfiler." Fantes ikke. Bygget
`src/styles/check-tokens.ts`, samme mønster som `src/i18n/check-keys.ts`
(rene, testbare funksjoner + en `main()`): skanner alle `.css`-filer
UTENFOR `styles/tokens/` og `styles/globals.css` for hex-farger,
`rgb()`/`rgba()`, `oklch()`, rå `px`-verdier (unntatt `1px`/`2px` —
kantlinje-/fokusring-bredde er en universell UI-konvensjon DESIGN.md selv
ikke tokeniserer, se kodekommentar), og direkte bruk av lag 1-variabler
(`--gray-*`, `--accent-*` osv.) i en komponentfil. 8 nye enhetstester.
Kjørt mot de to nye komponentfilene: 0 brudd.

**IKKE koblet til CI ennå** — det finnes ingen CI-konfigurasjon i dette
repoet å koble den til (bygges antagelig som en GitHub Actions-workflow
senere, utenfor denne økten sitt scope). Scriptet finnes og kan kjøres
manuelt (`npm run design:check-tokens`) inntil videre.

### Bevisst IKKE gjort denne runden (dokumentert, ikke glemt)

- **OKLCH→sRGB-fargekonvertering** (for den automatiserte
  WCAG-kontrasttesten DESIGN.md 2.4 krever, OG for e-postmalenes
  token-eksport, DESIGN.md 7) — vurdert, men bevisst utsatt. Dette ER
  deterministisk, veldokumentert matematikk (Björn Ottossons OKLab, brukt
  av CSS Color 4/`culori`/`colorjs.io`) jeg kan verifisere nøyaktig for
  akromatiske verdier for hånd (hvit/svart), men fargematematikk med reell
  kroma/hue krever mer varsomhet enn jeg ville gitt den i samme runde som å
  introdusere en helt ny komponent-avhengighet. Egen økt.
- Resten av DESIGN.md 6s 17-komponentliste (`TextArea`, `Checkbox`,
  `RadioGroup`, `Select`, `Dialog`, `Toast`, `Badge`, `Card`, `Alert`,
  `Tabs`, `Table`, `Pagination`, `EmptyState`, `SkeletonLoader`,
  `LanguageSwitcher`).
- Selve sidene/skjemaene (registrering, innlogging osv.) — ingen av dem
  bygget ennå, bevisst, siden komponentene måtte finnes først.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run`
(**74 tester**, +15 nye: 7 komponenttester + 8 token-sjekk-tester),
`npm run design:check-tokens` (OK, 0 brudd), `i18n:check`, `next build`
(kompilerer rent — komponentene er ikke importert i noen side ennå, så de
vises ikke i rutelisten, men typecheck/bundling av dem er bekreftet), OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(39 tester, uendret — ingen av dagens endringer rører databasekode).

**Merk:** `npm audit` viser 29 kjente sårbarheter (4 høy-alvorlighet
direkte relevante: `drizzle-orm`, `postcss`/`sharp` via `next`) — alle
PRE-EKSISTERENDE (bekreftet, ikke innført av dagens `npm install`), og
alle krever brytende major-oppgraderinger (`next@9.x` er foreslått
"fiksen" for `postcss`/`sharp`-kjeden, som ville vært en katastrofal
REGRESJON, ikke en fiks). IKKE handlet på — krever en egen, forsiktig
oppgraderingsøkt med reell testing, ikke noe å haste gjennom midt i
frontend-arbeid.

### Neste økt

(1) OKLCH→sRGB-konvertering + automatisert WCAG-kontrasttest (DESIGN.md
2.4) — egen økt, egen forsiktighet, samme nivå som retensjonsjobben fikk;
(2) resten av komponentbiblioteket, prioritert etter hva `POST /subscribe`-
skjemaet (det første virkelige skjemaet) faktisk trenger:
`Checkbox`/`RadioGroup` (samtykker, 7.1) og `Select` (land/språk) er
sannsynligvis neste i rekkefølge; (3) vurder en enkel GitHub Actions-
workflow som kjører alle fem+ verifiseringskommandoene (inkl. den nye
`design:check-tokens`) automatisk — finnes ikke i repoet ennå.

---

## Fortsettelse av økt 7 — `Checkbox`-komponenten (SPEC-V1.md 7.1: samtykker)

Samme arbeidsøkt. Bygget `src/components/Checkbox.tsx` — nødvendig for det
FØRSTE virkelige skjemaet (mottakerregistrering, 7.1) sine tre obligatoriske
samtykker, som ALLE eksplisitt "ikke forhåndsavkrysset".

- Dokumentert eksplisitt i kodekommentar: komponenten selv håndhever IKKE
  "aldri forhåndsavkrysset" — den arver `defaultSelected`/`isSelected`
  uendret fra React Aria. Det er kallerens ansvar, siden komponenten ikke
  kan vite hvorfor den brukes. Testet likevel at DEFAULT-tilstanden (ingen
  props satt i det hele tatt) er avkrysset av, som en release-mot-regresjon.
- Egen SVG-hake (ikke et ikonbibliotek — React Aria Components' `Checkbox`
  er helt visuelt tom, gir bare tilstand via `data-selected` osv.).
- Støtter `errorMessage`, vist KUN når `isInvalid` — samme mønster (og
  samme grunn) som `TextField`s `FieldError`-fiks fra i sted i denne økten.
- Label-innholdet tar `ReactNode`, ikke bare streng — nødvendig fordi
  samtykketeksten i i18n-nøkkelen (`recipient.register.consent_terms`:
  "Jeg godtar {termsLink} og {privacyLink}.") har innebygde lenker som må
  interpoleres som React-elementer, ikke bare tekst.

4 nye komponenttester, alle grønne på første forsøk (ingen ny feil funnet
denne gangen, i motsetning til `TextField`).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**78 tester**,
+4 nye), `npm run design:check-tokens` (OK, 3 komponent-CSS-filer, 0
brudd), `i18n:check`, `next build`, OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(39 tester, uendret).

### Neste økt

Samme som forrige: OKLCH-fargekonvertering (egen økt), resten av
komponentbiblioteket (`RadioGroup`/`Select` sannsynligvis neste — landet/
språket i registreringsskjemaet), eller en GitHub Actions-workflow som
kjører hele verifiseringskjeden automatisk.

---

## Fortsettelse av økt 7 — `.github/workflows/ci.yml` — verifiseringskjeden er nå automatisert

Samme arbeidsøkt. Plukket opp det siste punktet fra forrige "Neste økt":
INGEN av de fem-pluss verifiseringskommandoene som er kjørt manuelt foran
HVER commit i natt har vært koblet til noe automatisk — bare min egen
disiplin, ikke håndhevet av selve repoet. Bygget `.github/workflows/ci.yml`.

### Oppdaget og rettet i samme slengen: `README.md` var utdatert

`README.md` sa eksplisitt "Lint-håndhevelse er ikke satt opp ennå" for
`design:check-tokens`-regelen — som BLE satt opp tidligere i denne økten
(se over). Samme prinsipp som spec-dokumentene (dokumentasjon skal
reflektere faktisk tilstand, ikke henge etter) — rettet setningen, og la
til en ny "## Verifisering"-seksjon som lister alle kommandoene samlet ett
sted, siden de tidligere bare fantes spredt i triggerprompten og i hodet
mitt.

### `.github/workflows/ci.yml`

- Trigges på `push` (ALLE grener — reelt sett finnes bare ÉN gren i dette
  repoet ennå, `claude/kildebanken-spec-wdukgp`, ingen `main`, så
  `branches: [main]` ville aldri kjørt) og `pull_request`.
- Node 20 (samme som `engines.node` sitt gulv i `package.json` — testet mot
  MINSTekravet, ikke mot en nyere versjon som kunne skjule et
  kompatibilitetsproblem).
- Kjører alle seks kommandoene i rekkefølge: typecheck, lint, enhetstester,
  i18n-sjekk, token-sjekk, produksjonsbygg.
- `DATABASE_URL` satt til en bevisst UGYLDIG verdi for byggesteget —
  bekreftet empirisk (ikke antatt) at `next build` aldri faktisk kontakter
  databasen: kjørt dusinvis av ganger i natt uten noen `DATABASE_URL` satt
  i det hele tatt, alltid grønt. Verdien er ren dokumentasjon av intensjonen,
  ikke en nødvendighet.
- **Bevisst IKKE inkludert:** `npm run test:integration`. Krever en ekte
  Postgres — en service-container i Actions er en reell, men EGEN utvidelse
  (krever å tenke gjennom hemmeligheter/migrasjonssteg i selve
  workflow-en), ikke noe å haste inn sammen med resten.

### Verifisert før commit

Kjørte hele kjeden LOKALT (samme seks kommandoer workflow-en nå kjører
automatisk): `tsc --noEmit`, `eslint .`, `vitest run` (78 tester, uendret),
`i18n:check`, `design:check-tokens`, `next build` — alle grønne. Selve
YAML-en validert med en rå parse (`python3 -c "import yaml; ..."`) siden
den ikke kan "kjøres" lokalt uten selve GitHub Actions-miljøet. OG
`npx vitest run -c vitest.integration.config.ts` mot ekte lokal Postgres
(39 tester, uendret — ingen kodeendring i denne runden, bare CI-oppsett og
dokumentasjon).

### Neste økt

CI-verifisering er nå automatisert for alt UNNTATT integrasjonstestene.
Naturlige neste steg: (1) en Postgres-service-container i CI for
`test:integration`, som en egen, gjennomtenkt utvidelse; (2)
OKLCH-fargekonvertering (egen forsiktighet, se tidligere i økten); (3)
resten av komponentbiblioteket (`RadioGroup`/`Select` for
registreringsskjemaets land/språk-felt).

---

## Fortsettelse av økt 7 — CI-en faktisk KJØRTE, og fant en reell feil ingen lokal kommando kunne funnet

Samme arbeidsøkt. Siden GitHub-verktøyene var tilgjengelige i denne
runden, sjekket jeg faktisk RESULTATET av forrige commit sin CI-kjøring i
stedet for å anta at "validert YAML + grønt lokalt" var nok — og fikk rett
i å sjekke: **kjøringen feilet**, på "Enhetstester"-steget, med en feil
`tsc --noEmit` og `eslint .` aldri kunne fange, og som ikke reproduserte
lokalt (denne sandkassen kjører Node 22, ikke Node 20).

### Rotårsak, funnet i selve loggen

`npm ci` ga flere `EBADENGINE`-advarsler (ikke feil — npm installerer
uansett) for `jsdom@30`, `@testing-library/jest-dom@7`, og deres
transitive avhengigheter (`undici@8.9.0`, `whatwg-url@17.1.0` m.fl.) — ALLE
krever reelt Node ≥22, mens `package.json` sin `engines.node` sier `>=20`
og CI-workflow-en (riktig nok, se forrige del av økten) satte opp Node 20
nettopp fordi det ER det faktiske gulvet prosjektet lover. Selve
kjøretidsfeilen: `TypeError: webidl.util.markAsUncloneable is not a
function` inne i `undici` sin `CacheStorage`-polyfill, lastet transitivt
av `jsdom` sin `api.js` — en reell, ikke-null-relatert Node-versjons-
inkompatibilitet, ikke en flakete test.

### Rettet — IKKE ved å heve Node-gulvet

Vurderte å bare sette `engines.node` til `>=22` og CI til Node 22 i
stedet — men det ville vært en reell innsnevring av hva prosjektet lover å
kjøre på (relevant for `netlify/functions`-kjøretiden,
`INFRASTRUCTURE.md` 16), bare for å slippe å nedgradere to
dev-avhengigheter. Valgte i stedet å beholde det faktiske Node-gulvet
UENDRET og nedgradere:

- `jsdom` 30.0.1 → **26.1.0** (siste versjon som selv oppgir `node: '>=18'`).
- `@testing-library/jest-dom` 7.0.0 → **6.9.1** (siste 6.x-versjon som
  oppgir `node: '>=14'` — `6.10.0` og `7.x` krever begge `>=22`).

Verifisert LOKALT igjen etter nedgraderingen (samme seks kommandoer, alle
grønne, 89 tester — inkludert de 11 nye OKLCH-testene fra samme økt), MEN
lokal grønnhet beviser ingenting om selve Node 20-kompatibiliteten siden
denne sandkassen selv kjører Node 22. Committet og pushet for å la den
EKTE CI-kjøringen (faktisk Node 20) være den egentlige verifiseringen —
samme prinsipp som FR-013-E2E-testen tidligere i natt: ikke anta, sjekk
mot den ekte tingen.

### I samme slengen: OKLCH→sRGB-fargekonvertering (utsatt fra tidligere i økten)

Byttet til dette mens CI-kjøringen pågikk. `src/styles/color/oklch.ts` —
Björn Ottossons offentlig publiserte OKLab↔lineær-sRGB-matriser (samme som
CSS Color 4/`culori`/`colorjs.io`), IKKE en tilnærming. Eksporterer
`oklchToSrgbHex()` (for fremtidig e-postmal-tokeneksport, DESIGN.md 7) og
`oklchContrastRatio()`/`relativeLuminance()`/`contrastRatio()` (for den
automatiserte WCAG-kontrasttesten DESIGN.md 2.4 krever, ikke bygget som
egen sjekk ennå — bare selve matematikk-primitivene).

**Verifiseringsstrategi uten et eksternt fargeverktøy tilgjengelig:**
brukte AKROMATISKE referanseverdier (kroma = 0), som kan etterregnes for
hånd fordi lineær R=G=B=L³ eksakt når kroma er null (matrisens radsummer
er nøyaktig 1,0 for alle tre kanaler — verifisert manuelt). 11 tester,
inkludert: hvit/svart eksakt, `oklch(50% 0 0)` ≈ byte 99 (0x63) — IKKE
rgb(128,128,128), et kjent og sjekkbart trekk ved OKLab (50 % persepsjonell
lystetthet ligger IKKE på sRGB-midtpunktet), hvit-mot-svart-kontrastforhold
eksakt 21:1 (WCAG-lærebokverdien), OG en REELL sjekk av et faktisk
DESIGN.md-tokenpar (`--gray-900` mot `--gray-50`, lyst tema) som bekrefter
4.5:1 AA-kravet for normal tekst — det første beviset i natt på at DE
FAKTISKE fargeverdiene i `tokens/primitives.css` består WCAG AA, ikke bare
at selve matematikken er riktig.

**Ikke bygget ennå:** selve "kjør over den definerte listen av par i begge
temaer"-testen DESIGN.md 2.4 ber om (krever å liste opp ALLE faktisk
BRUKTE tekst/bakgrunn-par fra `semantic.css`, i begge temaer) — bare
byggeklossene og én stikkprøve. Egen, avgrenset oppgave for neste økt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**89
tester**, +11 nye OKLCH-tester), `i18n:check`, `design:check-tokens`
(OK), `next build`, OG `npx vitest run -c vitest.integration.config.ts`
mot ekte lokal Postgres (39 tester, uendret). PLUSS: pushet og sjekket den
FAKTISKE CI-kjøringen på GitHub (Node 20) etterpå — se neste del av økten
for resultatet.

### Neste økt

(1) Bekreft at CI-kjøringen faktisk ble grønn etter nedgraderingen (sjekk
`gh`/GitHub-verktøyene ved neste oppvåkning dersom ikke gjort før økten
slutter); (2) selve "alle tokenpar i begge temaer"-WCAG-testen DESIGN.md
2.4 krever, bygget PÅ de nå ferdige `oklch.ts`-primitivene; (3) en
Postgres-service-container i CI for `test:integration`; (4) resten av
komponentbiblioteket.

---

## Fortsettelse av økt 7 — CI bekreftet grønn på ekte Node 20, PLUSS `Select`-komponenten

Samme arbeidsøkt. Ventet på den faktiske CI-kjøringen (GitHub-verktøyene
tilgjengelige denne runden) i stedet for å anta fiksen virket —
**bekreftet**: `conclusion: "success"` på commit `d548d48`, ekte Node 20,
alle seks steg grønne. Nedgraderingen av `jsdom`/`@testing-library/jest-dom`
løste den reelle inkompatibiliteten fra forrige del av økten. Punkt (1) i
forrige "Neste økt" er dermed lukket, verifisert — ikke bare antatt.

### `src/components/Select.tsx` (SPEC-V1.md 7.1: land/språk-valg)

Bygget mens CI-kjøringen pågikk. Sammensatt av flere React Aria Components-
deler (`Select` > `Label` + `Button` (trigger) + `Popover` > `ListBox` >
`ListBoxItem`) — mer sammensatt enn `Checkbox`, og en reell, ukjent risiko
før den faktisk ble testet: fungerer Popover/portal-mønsteret i det hele
tatt i jsdom? Testet det empirisk i stedet for å anta — **det fungerer
uendret**, ingen `ResizeObserver`/portal-relaterte jsdom-hull dukket opp.

**Reelt funn under testing (ikke antatt riktig på forhånd):**
triggerknappens tilgjengelige navn er `SelectValue`-teksten (placeholder
ELLER valgt verdi) OG selve `<Label>`-teksten sammen, i den rekkefølgen
(`aria-labelledby` peker på begge) — IKKE bare label-teksten alene, som
mine første testantakelser forutsatte. Rettet testene til å spørre etter
DEN ENE knappen i treet og sjekke verdi-/placeholder-teksten separat
(`within(trigger)`), i stedet for et forhåndsanntatt eksakt tilgjengelig
navn.

Ingen forhåndsvalgt alternativ satt av komponenten selv (samme prinsipp
som `Checkbox` — SPEC-V1.md 7.1: "Ingenting avgjøres stille på brukerens
vegne"), testet eksplisitt. 4 nye komponenttester.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**93 tester**,
+4 nye), `design:check-tokens` (OK, 4 komponent-CSS-filer), `i18n:check`,
`next build`, OG `npx vitest run -c vitest.integration.config.ts` mot ekte
lokal Postgres (39 tester, uendret).

### Neste økt

Komponentbiblioteket dekker nå akkurat det mottakerregistreringsskjemaet
(7.1) trenger: `Checkbox` (samtykker), `TextField` (e-post),
`Select` (land/språk). Naturlig neste steg er derfor å FAKTISK BYGGE selve
registreringssiden (`/[locale]/subscribe` e.l.) med disse komponentene —
den første virkelige siden i hele natten, ikke bare en plassholder. Ellers:
selve WCAG-kontrasttesten (DESIGN.md 2.4, byggeklossene finnes nå), eller
en Postgres-service-container i CI.

---

## Fortsettelse av økt 7 — `/[locale]/subscribe` bygget, PLUSS to reelle funn (ett i18n-gap, én ekte `next build`-feil)

Samme arbeidsøkt. Bekreftet først (via GitHub-verktøyene) at CI-kjøringen for
`Select`-committen (`bf50100`) faktisk ble grønn (`conclusion: "success"`,
kjøring 30521003748) — tredje commit på rad denne økten der jeg sjekket den
EKTE kjøringen i stedet for å anta. Gikk så videre til NATTLOGGs eget neste
steg: bygge selve registreringssiden.

### `src/app/[locale]/subscribe/` — den første virkelige siden i natt

`page.tsx` (tynn server-komponent, løser locale) + `SubscribeForm.tsx`
("use client", selve skjemalogikken) + CSS-modul. Implementerer SPEC-V1.md
7.1 fullt ut:

- Henter aktive land fra `GET /api/countries` ved oppstart.
- Land forhåndsvelges fra et grovt geografisk hint (`Intl.Locale(navigator
  .language).maximize().region`), språk forhåndsvelges fra `navigator
  .languages` matchet mot landets `availableLocales` (samme `match()` fra
  `@formatjs/intl-localematcher` som `src/middleware.ts` allerede bruker
  server-side) — men BEGGE feltene vises alltid og kan endres fritt, og
  ingenting hindrer innsending før de er eksplisitt bekreftet. Dette er
  bevisst forskjellig fra samtykkene, som ALDRI forhåndsavkrysses — 7.1
  tillater eksplisitt det ene og forbyr eksplisitt det andre.
- Bytte av land ELLER språk nullstiller alle tre samtykkene (7.1 siste
  avsnitt) — implementert i selve select-handlerne, ikke som en effekt, for
  å unngå at det utilsiktet trigges på snarveier.
- Samtykkeraden for vilkår/personvern vises ikke i det hele tatt før BÅDE
  land og språk er valgt (`recipient.register.select_country_first`) —
  samtykketeksten er knyttet til akkurat den (land, språk)-kombinasjonen,
  og skal ikke kunne krysses av mot en tekst som ikke er lastet ennå.
- Innsending kaller `POST /api/subscribe` (fantes fra før) og viser enten
  suksessmelding eller en OVERSATT feilmelding fra serverens `error`-nøkkel.

**Reelt funn i test, ikke antatt på forhånd:** jsdom sin standard
`navigator.language` er `"en-US"`, som gjør at `match()` fra
`intl-localematcher` genuint foretrekker `en-GB` over et lands egen
`defaultLocale` når begge er kandidater (samme språkgruppe "en" slår et
usammenlignbart `nb-NO`) — IKKE en bug, bare noe testene måtte ta hensyn
til (en av testene bytter eksplisitt til den ANDRE tilgjengelige locale-en
for faktisk å utløse en endring, se kommentar i testfilen).

### `src/app/[locale]/legal/[country]/[docLocale]/[type]/` — offentlig visning av vilkår/personvern

Samtykketeksten i 7.1 ("aksept av vilkår og personvernerklæring") krever
klikkbare lenker til noe — det fantes bare et API-endepunkt
(`GET /api/legal/:country/:locale/:type`) fra før, ingen side som faktisk
viser dokumentet for et menneske. Bygget en minimal offentlig side som
gjenbruker `getCurrentLegalDocument()` direkte. Ruten har EGNE `[country]`
og `[docLocale]`-segmenter, uavhengig av sidens eget `[locale]`-segment —
bevisst, fordi 3.1 sier land og språk er uavhengige akser, og dokumentets
(land, språk) kan avvike fra hvilket språk selve siden rundt er rendret i.

**I18n-teknisk finesse løst uten å utvide delt infrastruktur:** meldingen
`recipient.register.consent_terms` trenger to klikkbare lenker MIDT I en
oversatt setning ("Jeg godtar {termsLink} og {privacyLink}."). Fremfor å
bygge ICU-"rich text"-støtte inn i `src/i18n/get-messages.ts` (som ville
påvirket ALLE andre bruk av `t()` i hele plattformen for ett eneste
tilfelle), løst lokalt i `SubscribeForm.tsx` med en liten
`interpolateNodes()`-hjelpefunksjon som bare splitter på bokstavelige
`{navn}`-tokens og setter inn React-noder — `t(key)` uten `values` returnerer
rå streng uendret (bekreftet i `get-messages.ts`: `format()` hopper over
`IntlMessageFormat` helt når `values` er `undefined`), så dette kolliderer
ikke med den vanlige ICU-tallformateringen som resten av samtykketekstene
(`{minimumAge, number}`) fortsatt bruker normalt.

### To reelle, tidligere usynlige funn — ikke antatt, faktisk oppdaget mens siden ble bygget

**1) `en-GB.json` manglet FIRE nøkler som fantes i `nb-NO.json`:**
`errors.invalid_timezone`, `errors.already_exists`,
`errors.no_moderator_assigned`, `errors.email_suppressed`. `src/i18n/
check-keys.ts` fanget ikke dette fordi den (helt riktig, per SPEC-V1.md
21.3: "manglende oversettelse i andre språk gir advarsel og fallback", ikke
byggefeil) bare validerer nøkler brukt i koden MOT `nb-NO`, aldri de andre
localene mot hverandre. Gapet ble synlig FØRST nå fordi `SubscribeForm`
er den første koden i hele natten som faktisk kaller `t(dynamiskFeilnøkkel)`
med en av disse fire nøklene (serverens `error`-felt er akkurat disse
nøklene). Rettet ved å legge til alle fire i `en-GB.json` (oversatt), pluss
la til de nye nøklene skjemaet selv trenger
(`country.no.name`, `locale.name.nb-NO`, `locale.name.en-GB`,
`recipient.register.submitting/success/country_placeholder/
locale_placeholder/select_country_first`) i BEGGE filene. Verifisert med et
lite Node-script som differ nøkkelsettene mellom de to JSON-filene — null
avvik i noen retning nå.

**2) `next build` feilet fra en helt ren `.next`-tilstand — en ekte,
tidligere usynlig CSS-syntaksfeil i `Button.module.css` (fra ØKT 6, den
aller første komponentfilen i natt):** kommentarlinjen `--space-*/--radius-*`
inneholder, helt utilsiktet, den bokstavelige sekvensen `*/` (fra
`-*` etterfulgt av `/--radius`) — CSS-parseren tolker DENNE som slutten på
kommentaren, ikke den faktiske `*/` fem linjer lenger ned. Alt derfra og ut
kommentaren blir dermed forsøkt parset som ekte CSS og feiler med "Unknown
word". Usynlig helt til nå fordi (a) `check-tokens.ts` sin egen
kommentarstripping bruker samme naive ikke-grådige regex-svakhet, så den
brydde seg aldri om at kommentaren faktisk var gyldig CSS, og (b) et
`next build` fra en HELT ren `.next`-tilstand ser ikke ut til å ha kjørt mot
akkurat denne filen tidligere i natt (tidligere `next build`-kjøringer i
loggen har vært grønne, men mot en allerede varm `.next`-cache). Rettet ved
å omformulere kommentaren (fjernet den utilsiktede `*/`-sekvensen) — ingen
endring i selve reglene, bare i kommentarteksten. Bekreftet med `rm -rf
.next && next build` på nytt: grønt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**98 tester**,
+5 nye for `SubscribeForm`), `i18n:check`, `design:check-tokens` (OK, 7
komponent-CSS-filer), `rm -rf .next && next build` (bekreftet grønt EKTE
fra en helt ren tilstand, se funn 2 over — genererer nå 26 sider, inkludert
de to nye rutene), OG `npx vitest run -c vitest.integration.config.ts` mot
ekte lokal Postgres (**39 tester**, uendret — ingen ny databasekode denne
runden, kun UI som kaller eksisterende, allerede dekkede API-ruter).

### Antagelser tatt

- Terskel for "endre land/språk nullstiller samtykker" er tolket strengt:
  ENHVER endring (også en teknisk re-seleksjon av samme verdi via React
  Arias `onSelectionChange`, som uansett ikke fyres når verdien er
  uendret) nullstiller — ikke bare en faktisk ulik verdi.
- `recipient.register.consent_terms`-lenkene åpnes i ny fane
  (`target="_blank"`) — brukeren skal kunne lese vilkårene uten å miste
  utfylt skjemadata. Ikke eksplisitt spesifisert i SPEC-V1.md, men et
  rimelig, reversibelt UX-valg.
- `errors.consent_required` vises som én samlet feilmelding (skjemabanner)
  ved mislykket innsending, ikke som individuell feiltekst under hver
  avkrysningsboks — det visuelle "ugyldig"-hint (rød kant) vises likevel per
  boks via `isInvalid`. Enklere, og samsvarer med at API-et selv returnerer
  én samlet feil for alle tre.

### Neste økt

(1) Selve "alle tokenpar i begge temaer"-WCAG-kontrasttesten DESIGN.md 2.4
krever (byggeklossene i `oklch.ts` er klare, bare selve testen som itererer
`semantic.css` gjenstår); (2) en Postgres-service-container i CI for
`test:integration` (kjørt manuelt mot lokal Postgres hver gang så langt);
(3) journalist-søknadsskjemaet (`/[locale]/journalists/apply`, SPEC-V1.md
7.2) — samme mønster som subscribe-siden, API-ruten finnes fra før
(`POST /journalists/apply`); (4) vurder om `check-tokens.ts` og
`check-keys.ts` sin kommentarstripping/nøkkeluttrekk med regex bør erstattes
med en ekte CSS/AST-parser på sikt — samme naive-regex-svakhet som forårsaket
funn 2 over finnes fortsatt i selve lint-verktøyet, bare at den ikke har slått
ut på ny igjen ennå.

Bekreftet FØRST i denne runden (GitHub-verktøyene): CI for commit `a613ecb`
(subscribe-siden) er grønn (`conclusion: "success"`, kjøring 30522043186).

---

## Fortsettelse av økt 7 — `/[locale]/journalists/apply` (SPEC-V1.md 7.2)

Samme arbeidsøkt, punkt (3) fra forrige "Neste økt" over. Nøyaktig samme
mønster som `/[locale]/subscribe`: tynn server-`page.tsx` +
`JournalistApplyForm.tsx` ("use client") + CSS-modul, land hentet live fra
`GET /api/countries`, land/språk forhåndsvalgt fra Accept-Language,
posterer mot den eksisterende `POST /journalists/apply`.

Forskjeller fra mottakerskjemaet, alle direkte fra 7.2: fem obligatoriske
tekstfelt (fullt navn, jobb-e-post, stilling, redaksjon, lenke til
redaksjon — sistnevnte validert som en ekte URL med `new URL(...)`, ikke
bare en ikke-tom streng) i stedet for én e-post, og ETT samtykke
(`consentJournalistTerms`) i stedet for tre, siden `applyAsJournalist()`
bare har én lovtekst-type å samtykke til (`journalist_terms`). Disclaimer-
teksten fra 7.2 ("navn og redaksjon vises offentlig, e-post vises aldri")
vises over selve skjemaet, hentet fra den allerede eksisterende
`journalist.apply.disclaimer`-nøkkelen.

Gjenbrukte BEVISST `recipient.register.country_label/locale_label/
country_placeholder/locale_placeholder` og `errors.field_required` i stedet
for å lage parallelle `journalist.apply.*`-duplikater av identisk tekst
("Land"/"Språk" betyr det samme uansett skjema) — la bare til de fire
nøklene som faktisk ER journalist-spesifikke
(`journalist.apply.consent_terms/submitting/success`,
`legal.journalist_terms_title`) i begge språkfilene.

**Utvidet `/legal/[country]/[docLocale]/[type]`-siden fra forrige del av
økten:** den hadde en hardkodet `type === "terms" ? ... : ...`-ternær som
implisitt antok bare to dokumenttyper — men `legalDocumentType`-enumet i
`src/db/schema.ts` har alltid hatt TRE verdier (`terms`, `privacy`,
`journalist_terms`). Byttet til et uttømmende `Record<LegalDocumentType,
string>`-oppslag FØR det faktisk ble en synlig feil (journalistvilkårs-siden
ville vist "Personvernerklæring" som overskrift på et journalistvilkår-
dokument) — fanget ved å faktisk lese gjennom koden på nytt før bruk, ikke
ved at noe feilet i test/bygg.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**101 tester**,
+3 nye for `JournalistApplyForm`), `i18n:check` (56 nøkler), `design:
check-tokens` (OK, 9 komponent-CSS-filer), et lite Node-script som bekrefter
`en-GB.json`/`nb-NO.json` har NULL nøkkeldrift i noen retning nå (ikke bare
"alt brukt i kode finnes i nb-NO", som `check-keys.ts` selv sjekker), `rm -rf
.next && next build` (grønt, nå 28 sider), OG `npx vitest run -c vitest
.integration.config.ts` mot ekte lokal Postgres (**39 tester**, uendret).

Satte et passord på den lokale `kildebanken`-Postgres-brukeren i selve
SANDKASSEN (ikke i noe committet filtre — bare `ALTER USER ... PASSWORD`
mot den lokale klyngen) fordi `DATABASE_URL` ikke lå lagret noe sted fra
tidligere økter, og et rent passordløst `psql`-forsøk feilet
(`fe_sendauth: no password supplied`). Kun relevant for DENNE
kjøretidsinstansen — ikke noe fremtidige økter kan stole på at fortsatt
gjelder.

### Neste økt

(1) Selve WCAG-kontrasttesten DESIGN.md 2.4 krever (fortsatt ubygget);
(2) en Postgres-service-container i CI for `test:integration`; (3)
resten av komponentbiblioteket (TextArea, RadioGroup, Dialog, Toast, Badge,
Card, Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher — DESIGN.md 6); (4) en enkel offentlig forespørsel-
liste/-visning (`/[locale]/requests`, SPEC-V1.md seksjon 9) er trolig den
neste ekte SIDEN som gir mest verdi, nå som begge registreringsskjemaene
finnes — men den krever mer avveiing (paginering, filtre, språkvisning på
tvers av lokaliteter) enn de to formene bygget i kveld, så vurder å bryte
den ned i mindre biter i en egen økt fremfor å haste den frem.

Bekreftet FØRST i denne runden (GitHub-verktøyene): CI for commit `0b23c01`
(journalist-søknad) er grønn (`conclusion: "success"`).

---

## Fortsettelse av økt 7 — DESIGN.md 2.4-kontrasttesten bygget, og den fant ekte, usynlige feil med én gang

Samme arbeidsøkt, punkt (1) fra forrige "Neste økt". Bygget selve
"kjør over den definerte listen av par i begge temaer"-testen DESIGN.md 2.4
krever, oppå `oklch.ts`-primitivene fra tidligere i natt.

### `src/styles/color/contrast-pairs.ts` + `.test.ts`

Leser `tokens/primitives.css` og `tokens/semantic.css` DIREKTE (regex,
samme mønster som `check-keys.ts`/`check-tokens.ts`) i stedet for å
duplisere fargetallene en fjerde gang et sted — risikoen for at testen
stille slutter å teste de EKTE verdiene er verre enn kompleksiteten ved å
parse CSS-en. `TOKEN_PAIRS` er en manuelt kuratert liste over
(forgrunn, bakgrunn)-par som FAKTISK brukes i komponent-/side-CSS-en i
kveld (gjennomgått fil for fil), hver merket med riktig WCAG-kategori
(tekst 4.5:1, grensesnittelement/fokus 3:1). Testen itererer paret ×
begge temaer = 32 sjekker.

**Den kjørte IKKE grønt med én gang — og det var poenget.** Fire reelle,
tidligere usynlige brudd, alle funnet ved faktisk å kjøre tallene, ikke ved
å anta at DESIGN.md sine egne verdier automatisk oppfylte DESIGN.md sitt
eget krav:

1. **`--color-border-strong` (`--gray-300` lyst / `--gray-700` mørkt) mot
   `--color-surface`: 1.48:1 (lyst) / 1.85:1 (mørkt).** Godt under 3:1-kravet
   for grensesnittelementer (WCAG 1.4.11) — feltkanten på HVERT ENESTE
   skjemafelt i hele komponentbiblioteket (TextField, Select, Checkbox) har
   vært nesten usynlig mot flaten, i BEGGE temaer, helt siden `Button`/
   `TextField` ble bygget tidlig i natt. Rettet ved å peke
   `--color-border-strong` til `--gray-500` i alle tre `:root`-blokker
   (4.28:1 lyst, 4.14:1 mørkt) — en EKSISTERENDE primitiv, ingen ny farge
   oppfunnet.
2. **Faretruende-knapp-tekst (`--color-text-inverse`) mot
   `--color-danger`: 3.34:1 i mørkt tema** (`--color-text-inverse` snur til
   nesten svart i mørkt tema, men `--color-danger`-bakgrunnen den står oppå
   er BEVISST tema-uavhengig — feil token brukt for feil jobb). Rettet med
   en ny, tema-UAVHENGIG rolle `--color-on-danger: var(--gray-0)`, brukt i
   `Button.module.css` sin `.danger`-regel i stedet.
3. **Feiltekst under skjemafelt (`--color-danger`) mot `--color-surface`:
   3.01:1 i mørkt tema** — samme rotårsak omvendt: `--color-danger` er
   tema-uavhengig, men brukt direkte som TEKSTFARGE mot en flate som ER
   tema-avhengig, akkurat som aksenten allerede korrekt håndterer (2.3:
   "Aksenten må lysne for å holde kontrast mot mørk bakgrunn"). Rettet med
   en ny rolle `--color-danger-text` (samme som `--color-danger` i lyst
   tema, `--danger-100` i mørkt — en EKSISTERENDE primitiv), brukt i
   `TextField`/`Select`/`Checkbox` sine `.errorMessage`-regler.
4. **`--color-text-subtle` (`--gray-500`) mot `--color-surface`: 4.28:1 i
   lyst tema** — under 4.5:1-kravet for vanlig tekst (men trygt over 3:1).
   Brukt akkurat ÉTT sted i kveld: den offentlige vilkårssidens
   versjonslinje (`legal/.../page.module.css`, `--text-sm`, altså
   normalstørrelse tekst). Rettet ved å bruke `--color-text-muted` der i
   stedet — selve tokenverdien er urørt, bare presisert i DESIGN.md 2.4 at
   `--color-text-subtle` kun er trygg for store overskrifter/dekorativ
   bruk, ikke normal brødtekst.

Alle fire rettelser bruker UTELUKKENDE allerede eksisterende primitiver
(`--gray-500`, `--gray-0`, `--danger-100`) — ingen nye fargeverdier
oppfunnet, ingen endring av selve DESIGN.md 2.1-skalaen. Spec (DESIGN.md
2.2/2.3) rettet FØRST, deretter `tokens/semantic.css`, deretter de tre
komponentfilene som konsumerte feil rolle — i tråd med "spec-en er
sannheten"-regelen, tolket slik: 2.4 sitt eksplisitte, ufravikelige WCAG-
krav ("feiler CI ved avvik") er den autoritative regelen; 2.1/2.2 sine
KONKRETE tallverdier er implementasjonsdetaljer som må justeres for å
oppfylle 2.4, ikke omvendt.

### Faktisk visuelt verifisert i en ekte nettleser — første gang i hele natt

Kjørte `next build` + `next start` (ekte produksjonsbygg, ikke `next dev`)
og brukte Playwright/Chromium til å faktisk ÅPNE `/nb-NO/subscribe` i lyst
OG mørkt tema, både i utgangspunktet og etter et mislykket
innsendingsforsøk (for å se de nye `--color-danger-text`-feiltekstene i
praksis, ikke bare regne dem ut). Feltkantene er nå tydelig synlige i begge
temaer, feilteksten er lesbar i mørkt tema, og hele skjemaet (inkludert
samtykkelenkene til Vilkår/Personvernerklæring) fungerer interaktivt.

**Reell blindvei underveis, oppdaget og korrigert FØR den ble en falsk
alarm i loggen:** et første forsøk på å teste i "produksjon" traff faktisk
en gjenglemt `next dev`-prosess på samme port (`next start` feilet stille
med `EADDRINUSE` i bakgrunnen mens `curl` fortsatte å svare fra den gamle
dev-prosessen) — noe som ga et falskt signal om at HELE appens CSP
(`Content-Security-Policy` i `src/middleware.ts`) blokkerte all
klient-hydrering i enhver ekte nettleser (en `eval()`-relatert CSP-feil som
KUN kommer fra `next dev` sin eval-baserte devtool, aldri fra et ekte
produksjonsbygg). Verifisert grundig FØR det ble konkludert som en feil:
drepte den gjenglemte prosessen, bygget på nytt, startet en EKTE
`next start`, og bekreftet at hydrering fungerer helt fint under den
faktiske, strenge CSP-en uten noen endring i `middleware.ts` i det hele
tatt. Ingen kodefeil fantes — bare en feil i selve testoppsettet. Notert
her fordi det er akkurat den typen "verifiser mot det ekte, ikke anta"-
disiplin resten av natten har fulgt, og fordi konklusjonen (ingen endring
nødvendig i CSP-en) er verdt å vite for neste økt som også vil teste i
nettleser.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**134
tester**, +33 nye for kontrastparene), `i18n:check`, `design:check-tokens`
(OK, 9 filer), `rm -rf .next && next build` (grønt), `npx vitest run -c
vitest.integration.config.ts` mot ekte lokal Postgres (**39 tester**,
uendret), OG en faktisk visuell/interaktiv sjekk i en ekte Chromium-
nettleser (Playwright) av `/nb-NO/subscribe` i lyst og mørkt tema, normal
og feiltilstand — se over.

### Antagelser tatt

- `--color-border-strong` sin nye verdi (`--gray-500`) er valgt som den
  LAVESTE eksisterende primitiv som klarer 3:1 i BEGGE temaer samtidig
  (4.28/4.14) — ikke nødvendigvis det visuelt "riktigste" valget estetisk
  (det er synlig mørkere enn før), men det minst dramatiske korrekte valget
  uten å innføre en helt ny primitiv. Verifisert visuelt at det fortsatt
  ser rolig/elegant ut (DESIGN.md sitt mål), ikke påtrengende.
- `--color-success`/`--color-warning` har SAMME latente risiko som
  `--color-danger` hadde (tema-uavhengige, ville feile 4.5:1 som ren tekst
  mot en tema-avhengig flate i mørkt tema) — ikke rettet nå fordi INGEN
  kodested faktisk bruker dem slik ennå (bare som banner-bakgrunn/-tekst
  sammen med sin egen `-subtle`, som er tema-uavhengig og derfor trygt).
  Neste person som bruker `--color-success`/`--color-warning` som ren
  tekst mot `--color-surface`/`--color-bg` bør bruke samme mønster
  (`--color-success-text`/`--color-warning-text`) FØR de gjør det, ikke
  etter at kontrasttesten fanger det.
- **Rettelse av en antagelse fra samme runde:** trodde først at lenkene i
  samtykketeksten (`Vilkår`/`Personvernerklæring`) arvet nettleserens
  standardfarge fordi de så "vanlig blå" ut på skjermbildet. Sjekket det
  FAKTISK i stedet for å stole på det visuelle inntrykket alene
  (`getComputedStyle` i en ekte nettleser): `globals.css` har allerede en
  global `a { color: var(--color-link); }`-regel (linje 26–28), og
  lenkeelementet sin faktisk beregnede farge er nøyaktig
  `oklch(0.43 0.082 230)` — samme verdi som `--color-link`/`--accent-700`.
  Ingen feil her. Notatet under (fra da jeg trodde det VAR en feil) er
  strøket, men står igjen som en påminnelse om å verifisere med
  `getComputedStyle`, ikke gjette ut fra et skjermbilde, før noe kalles en
  feil i NATTLOGG.

### Neste økt

(1) vurder `--color-success-text`/`--color-warning-text` FØR noen faktisk
bruker dem som ren tekst; (2) en Postgres-service-container i CI for
`test:integration`; (3) resten av komponentbiblioteket (TextArea,
RadioGroup, Dialog, Toast, Badge, Card, Alert, Tabs, Table, Pagination,
EmptyState, SkeletonLoader, LanguageSwitcher); (4) en offentlig
forespørsel-liste/-visning (`/[locale]/requests`, SPEC-V1.md seksjon 9) —
se forrige økts vurdering av hvorfor den bør brytes ned først.

Bekreftet i denne runden (GitHub-verktøyene, via en delegert bakgrunnssjekk
for å spare kontekst): CI for commit `1d175bf` (kontrasttesten) OG `7fa687f`
(NATTLOGG-rettelsen) er begge grønne.

---

## Fortsettelse av økt 7 — Postgres-service-container i CI (`test:integration` automatisert)

Samme arbeidsøkt, punkt (2) fra forrige "Neste økt". `.github/workflows/
ci.yml` har fra starten av natten IKKE kjørt `npm run test:integration` —
bevisst utsatt fordi det krever en ekte Postgres. Lagt til en
`postgres:16`-service-container (samme versjon som INFRASTRUCTURE.md
forutsetter i produksjon), med `pg_isready`-helsesjekk, pluss to nye steg
etter produksjonsbygget: `npm run db:migrate` (kjører de ekte migrasjonene
mot en HELT TOM database — denne stien var faktisk aldri testet fra bunnen
av i denne økten før nå) og deretter `npm run test:integration`.

**Verifisert lokalt FØR push, mot en helt fersk database** (ikke den
gjenbrukte `kildebanken_test` med etter hvert ganske mye testfixture-
rusk fra kveldens mange kjøringer): opprettet en splitter ny, tom
Postgres-database, kjørte `db:migrate` mot den fra bunnen av (aldri gjort
i denne sesjonen før — bekreftet at migrasjonshistorikken faktisk
reproduserer skjemaet fra scratch, ikke bare "fungerer på en database som
allerede har kjørt migrasjoner én gang før i en tidligere økt"), og kjørte
så hele integrasjonstestsuiten mot den (39 tester, grønt). Droppet
databasen igjen etterpå.

Ingen hemmeligheter involvert — bruker/passord er `ci`/`ci`, gyldig kun for
den kortlevde, engangs Actions-containeren, akkurat som `DATABASE_URL`
verdien allerede brukt for produksjonsbygget («bevisst ugyldig, skal aldri
faktisk kontaktes»-kommentaren i samme fil). Oppdaterte README.md sin
"Verifisering"-seksjon til å reflektere at integrasjonstestene nå faktisk
kjører i CI.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (134 tester,
uendret — ingen ny enhetstestkode denne runden), `i18n:check`, `design:
check-tokens`, `rm -rf .next && next build`, en YAML-syntakssjekk av selve
`ci.yml`-filen (`python3 -c "import yaml; yaml.safe_load(...)"`), OG selve
migrate-fra-bunnen-av-pluss-integrasjonstest-flyten mot en helt fersk,
midlertidig database (se over) — den mest presise, tro-mot-CI-simuleringen
som var mulig å gjøre lokalt.

### Neste økt

(1) vurder `--color-success-text`/`--color-warning-text` FØR noen faktisk
bruker dem som ren tekst; (2) resten av komponentbiblioteket (TextArea,
RadioGroup, Dialog, Toast, Badge, Card, Alert, Tabs, Table, Pagination,
EmptyState, SkeletonLoader, LanguageSwitcher); (3) en offentlig
forespørsel-liste/-visning (`/[locale]/requests`, SPEC-V1.md seksjon 9) —
se tidligere økters vurdering av hvorfor den bør brytes ned først; (4) nå
som CI dekker BÅDE enhetstester og integrasjonstester, er det verdt å
vurdere om selve `next build`-steget også burde kjøre MOT en migrert
database (ikke bare den bevisst ugyldige URL-en) for å fange eventuelle
fremtidige tilfeller av spørringer som utilsiktet kjører ved buildtid.

Bekreftet i denne runden: CI for commit `dd45642` er grønn — FØRSTE gang
integrasjonstestene faktisk har kjørt mot en ekte Postgres-service-
container i selve GitHub Actions-infrastrukturen (ikke bare lokalt). Ingen
overraskelser i den ekte kjøringen utover det som allerede var verifisert
lokalt mot en fersk database.

---

## Fortsettelse av økt 7 — `--color-success-text`/`--color-warning-text` (forebyggende, samme funn-klasse som danger)

Samme arbeidsøkt, kort oppgave. La til de to gjenværende "-text"-rollene
DESIGN.md 2.4-notatet fra tidligere i økten pekte på som gjenstående —
FØR noen faktisk bruker `--color-success`/`--color-warning` som ren tekst,
ikke etter.

**Et ekte, litt overraskende funn underveis:** antok først at samme mønster
som `--color-danger-text` (uendret i lyst tema, lysere i mørkt) ville gjelde
begge — men regnet faktisk ut tallene i stedet for å anta, og
`--warning-600` mot hvit flate gir bare **3.28:1 — under 4.5:1-kravet selv i
LYST tema**, ikke bare i mørkt. `--warning-600` er rett og slett for lys/lavt
mettet til å fungere som tekst i noe tema. Løsningen ble derfor asymmetrisk:
`--color-warning-text` peker på `--warning-900` i lyst tema (11.43:1) og
`--warning-100` i mørkt (15.62:1) — begge eksisterende primitiver, ingen nye
farger. `--color-success-text` derimot følger `--color-danger-text` sitt
enklere mønster uendret (`--success-600` klarer 5.27:1 mot hvitt i seg
selv), bare `--success-100` i mørkt tema.

Ingen komponent bruker noen av de to ennå — rent forebyggende, dokumentert
tydelig i både `semantic.css` og DESIGN.md 2.3 med instruks om å legge dem
til i `contrast-pairs.ts` sin `TOKEN_PAIRS`-liste den dagen noe faktisk
konsumerer dem som tekst (testen kan ikke sjekke et par ingen bruker).

### Verifisert før commit

`tsc --noEmit`, `eslint .`, `vitest run` (134 tester, uendret — ingen nye
tokens er tatt i bruk noe sted ennå, så `contrast-pairs.test.ts` sine 32
sjekker er uendret med hensikt), `i18n:check`, `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot lokal Postgres (39
tester).

### Neste økt

(1) resten av komponentbiblioteket (TextArea, RadioGroup, Dialog, Toast,
Badge, Card, Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher) — naturlig neste steg er trolig `TextArea`, siden
`response.form.answer_label`/`relevance_label` (SPEC-V1.md, svarskjemaet)
antakelig trenger et flerlinjers felt, ikke bare `TextField`; (2) en
offentlig forespørsel-liste/-visning (`/[locale]/requests`, SPEC-V1.md
seksjon 9); (3) vurder om `next build`-steget i CI også bør kjøre mot en
migrert database.

---

## Fortsettelse av økt 7 — `TextArea`-komponenten (DESIGN.md 6: "med tegnteller")

Ny time, ny cron-oppvåkning med samme (foreldede) prompt som vanlig —
sjekket faktisk `git log`/`git status` og NATTLOGG sitt eget siste
"Neste økt"-notat i stedet for å stole på prompten, som fortsatt lister
registrerings-API-er og retensjonsjobben som om de gjenstår (de er
committet for lengst). Fortsatte fra punkt (1): `TextArea`.

Sjekket SPEC-V1.md 9.1 og 12.1 først for å bekrefte at et flerlinjers felt
faktisk trengs, ikke anta det: forespørselens "Full beskrivelse" (5 000
tegn), "Hvem søkes" (500 tegn), og svarskjemaets "Hvorfor er du relevant?"
(2 000 tegn)/"Svar på journalistens spørsmål" (4 000 tegn) er alle
fritekstfelt med en EKSPLISITT, håndhevet tegngrense — og DESIGN.md 6 sier
uttrykkelig "`TextArea` med tegnteller" i minimumssettet, ikke bare
"TextArea". Telleren er altså et spesifikt krav, ikke noe jeg la til av
eget tiltak.

### `src/components/TextArea.tsx`

Samme mønster som `TextField.tsx` (React Aria sin `<TextField>`-wrapper,
her med `<TextArea>` i stedet for `<Input>` som selve feltet — begge er
gyldige barn av samme `<TextField>`-kontekst, ifølge react-aria-components
sin egen typedefinisjon). Telleren (`{brukt}/{grense}`) beregnes fra den
KALLER-kontrollerte `value`-propen (`props.value.length`), ikke en egen
intern tilstand — unngår å duplisere sannheten om feltets innhold, og
matcher at ALLE skjemaene bygget i kveld (Subscribe/JournalistApplyForm)
allerede bruker kontrollerte felt konsekvent. `aria-live="polite"` på selve
telleren, slik at skjermlesere får vite når den endrer seg uten å avbryte
brukeren midt i skriving.

Ingen nye designtoken-par introdusert (samme roller som `TextField`:
`--color-danger-text` for feiltekst, `--color-text-muted` for
beskrivelse/teller, `--color-border-strong`/`--color-focus-ring` for
kant/fokus) — `contrast-pairs.ts` sin `TOKEN_PAIRS`-liste trengte derfor
ingen oppdatering.

8 nye komponenttester, inkludert én som faktisk skriver tegn for tegn
(`userEvent.type`) i en ekte kontrollert wrapper-komponent og bekrefter at
telleren oppdaterer seg live — ikke bare at den viser riktig tall ved
første rendering.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**142
tester**, +8 nye), `i18n:check`, `design:check-tokens` (OK, 10
komponent-CSS-filer), `rm -rf .next && next build`.

### Neste økt

(1) resten av komponentbiblioteket (RadioGroup, Dialog, Toast, Badge, Card,
Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher) — komponentbiblioteket dekker nå BÅDE
registreringsskjemaene OG svarskjemaets fritekstfelt; naturlig neste steg
kan derfor være å faktisk bygge selve SVARSKJEMAET
(`/[locale]/requests/[id]/respond` e.l., SPEC-V1.md 12) siden `TextArea`
var den siste manglende brikken for det, i stedet for å fortsette rett
komponent for komponent; (2) en offentlig forespørsel-liste/-visning
(`/[locale]/requests`, SPEC-V1.md seksjon 9) — sannsynligvis et
nødvendig steg FØR svarskjemaet uansett, siden en respondent må kunne
FINNE en forespørsel før hen kan svare på den; (3) vurder om
`next build`-steget i CI også bør kjøre mot en migrert database.

---

## Fortsettelse av økt 7 — `/[locale]/foresporsler/[id]/[slug]` (SPEC-V1.md 11), OG en rettet antagelse

Samme arbeidsøkt. Skulle først bygge en offentlig "forespørsel-liste"-side
(punkt 2 i forrige "Neste økt"), men sjekket SPEC-V1.md 5.2 FØRST i stedet
for å anta at en nettleservennlig liste faktisk trengs — og den gjør ikke
det: mottakerens reise er utelukkende "mottar daglig e-post → klikker
'Les og svar' på ÉN forespørsel → lander på DEN siden". Ingen bla-gjennom-
flyt er beskrevet noe sted i v1-spec-en. Det som faktisk MANGLET var den
individuelle forespørselssiden selve digest-lenken peker på (SPEC-V1.md
11) — `src/lib/email/digest.ts` linker allerede til
`/${locale}/foresporsler/${id}/${slug}`, men ingen slik side fantes.
Rettet kursen til å bygge DEN i stedet for listen ingen ba om.

### Backend fantes nesten helt fra før

`getPublicRequest()` i `requests.ts` fantes allerede med nøyaktig de
feltene 11 krever (tittel, sammendrag, beskrivelse, hvem søkes, status,
frist, org/journalistnavn, anonymitets-/opptaksflagg) — men manglet
landets tidssone og tilgjengelige locales, begge eksplisitt krevd av 11
("svarfrist MED TIDSSONE", "hreflang-alternater"). Utvidet spørringen med
et `countries`-join (fantes allerede importert) for `countryTimezone` og
`countryAvailableLocales` — verifisert med en ny integrasjonstest mot ekte
Postgres, ikke bare antatt riktig fra selve SQL-en.

### To nye komponenter, og et REELT funn oppdaget FØR commit i den ene

- **`Badge`** (DESIGN.md 6.2, "farge OG tekst", fire toner). Status→tone-
  oppslaget ligger i `src/lib/requests/status-badge.ts`, ikke i selve
  komponenten — "fargetilordningen defineres ett sted", per 6.2, gjenbrukbar
  fra e-postmaler senere.

  **Reelt funn, fanget FØR committing, ikke etter:** første forsøk lot
  "warning"- og "danger"-tonen bruke de NYE `--color-warning-text`/
  `--color-danger-text`-tokenene (lagt til forrige del av økten) som
  tekstfarge mot sin egen `-subtle`-bakgrunn. Regnet ut tallene i stedet for
  å anta det var trygt siden begge tokenene "nettopp var verifiserte" — og i
  MØRKT tema er `--color-warning-text`/`--color-danger-text` nøyaktig LIK
  `--color-warning-subtle`/`--color-danger-subtle` (begge peker på samme
  `-100`-primitiv), som ville gitt 1.00:1 kontrast — usynlig tekst. Roten:
  `-text`-tokenene ble kalibrert mot `--color-surface` (som ER
  tema-avhengig), ikke mot sin egen `-subtle`-variant (som ALDRI er det) —
  feil rolle for feil jobb, samme klasse feil som `--color-on-danger` løste
  forrige del av økten, bare denne gangen fanget FØR den ble committet.
  Løsning: `danger`-tonen bruker `--color-danger` (uendret, allerede riktig
  — samme par som den eksisterende "feilbanner-tekst"-sjekken). `warning`-
  tonen fikk et HELT NYTT, bevisst tema-UAVHENGIG token,
  `--color-warning-on-subtle: var(--warning-900)`, siden `--color-warning`
  (600) selv bare gir 2.90:1 mot `--color-warning-subtle` — for lav. To nye
  par lagt til `contrast-pairs.ts` sin `TOKEN_PAIRS` (36 sjekker totalt nå,
  alle grønne i begge temaer).

- **`ReportForm`** (SPEC-V1.md 12.5: "et enkelt skjema", gjenbrukbar for
  BÅDE `request`- og `response`-rapportering via `entityType`-prop). Bevisst
  en inline utvidbar seksjon, IKKE en `Dialog` — den komponenten finnes ikke
  ennå, og et helskjerm-modal er unødvendig kompleksitet for to felt.
  Sjekket eksplisitt for samme klasse CSS-kommentarfeil som
  `Button.module.css` hadde tidligere i natt (en utilsiktet `*/` midt i en
  kommentar) — ingen funnet her.

### To reelle feil funnet UNDER selve `next build`, ikke antatt bort

1. **Server/klient-grense brutt:** `Button.tsx` importerer
   `react-aria-components`, som selv importerer `"client-only"` — ethvert
   Server Component som importerer NOE fra `Button.tsx` (selv en ren
   streng-hjelpefunksjon uten reell klientavhengighet) feiler bygget, fordi
   grensen håndheves PER FIL, ikke per eksport. Forespørselssiden (en Server
   Component) trengte en "Svar"-CTA stylet som en primærknapp, men som en
   EKTE `next/link`-navigasjonslenke (React Aria sin `<Button>` tar bevisst
   ikke imot `href` i det hele tatt — sjekket typedefinisjonen, ikke antatt).
   Løst ved å flytte selve klassenavn-logikken til en helt egen fil,
   `src/components/buttonClassName.ts`, uten noen import av
   `react-aria-components` — importeres trygt fra BÅDE `Button.tsx` og en
   Server Component nå.
2. **Lenken hadde en synlig, utilsiktet understreking** — oppdaget i et
   ekte skjermbilde (Playwright, `next build` + `next start`), ikke antatt
   bort: `.button`-klassen manglet `text-decoration: none`, usynlig så
   lenge klassen bare satt på ekte `<button>`-elementer (som aldri har
   understreking), men synlig nå som den også brukes på en `<a>`. Rettet.

### `noindex` som standard, indekserbar bare her (SPEC-V1.md 11)

La til `robots: { index: false, follow: false }` som standardverdi i
`src/app/[locale]/layout.tsx` sin `metadata` — "noindex på alt utenfor de
offentlige forespørselssidene og informasjonssidene" var IKKE håndhevet
noe sted i prosjektet før nå (et reelt hull mellom spec og kode, rettet).
Selve forespørselssiden overstyrer eksplisitt til `{ index: true, follow:
true }` i sin egen `generateMetadata`, sammen med kanonisk URL og
`hreflang`-alternater utledet fra landets FAKTISKE `availableLocales` (ikke
en hardkodet liste).

**Bevisst IKKE bygget:** delingsbilde (Open Graph-bilde) — 11 krever det
eksplisitt, men prosjektet har ingen bildegenereringsinfrastruktur
(`next/og`, fonter for rendering) eller `public/`-mappe i det hele tatt
ennå. Reelt, notert gap — ikke silently droppet.

### Faktisk visuelt verifisert i en ekte nettleser

Satte inn en midlertidig, ekte publisert testforespørsel i
`kildebanken_test` (slettet igjen etterpå), kjørte `next build` + `next
start`, og sjekket med Playwright: metadata (tittel, `og:*`, `robots:
index, follow`, canonical, BEGGE `hreflang`-alternatene), selve
gjengivelsen i lyst OG mørkt tema (badge, byline, tegnsatt beskrivelse med
linjeskift, de tre anonymitets-/opptaksinfolinjene med korrekt ICU
`select`-formatering ut fra de faktiske boolske verdiene satt i
testdataene), `expired`-tilstanden (advarsel-badge, ingen svar-knapp,
tydelig varsel), rapportskjemaets utvidelse, OG at en feil/gjettet slug i
URL-en faktisk omdirigerer til den kanoniske — ikke bare antatt fra koden.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**157
tester**, +16 nye: Badge, ReportForm, status-badge, pluss to nye
kontrastpar), `i18n:check` (74 nøkler), `design:check-tokens` (OK, 13
komponent-CSS-filer), `rm -rf .next && next build` (grønt, inkludert den
nye ruten), OG `npx vitest run -c vitest.integration.config.ts` mot ekte
lokal Postgres (**40 tester**, +1 for landets tidssone).

### Antagelser tatt

- "Svar"-knappen lenker til `/${locale}/foresporsler/${id}/svar` — en rute
  som IKKE finnes ennå (404 i dag). Bevisst: selve svarskjemaet er neste
  steg, ikke denne siden sin jobb. Innsending av svar krever uansett
  innlogging (SPEC-V1.md 6.2/12), som den fremtidige siden må håndtere selv.
- Rapportering trenger ikke en `Dialog`-komponent — SPEC-V1.md 12.5 sier
  "et enkelt skjema", og en inline utvidbar seksjon er enklere og mer
  mobilvennlig enn en modal, jf. DESIGN.md 5.

### Neste økt

(1) selve svarskjemaet (`/[locale]/foresporsler/[id]/svar`, SPEC-V1.md 12)
— den naturlige fortsettelsen, `TextArea`/`TextField`/`Button` finnes
allerede; (2) vurder om `next build`-steget i CI også bør kjøre mot en
migrert database; (3) resten av komponentbiblioteket (RadioGroup, Dialog,
Toast, Card, Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher) — `RadioGroup` trengs trolig snart for svarskjemaets
"del e-postadressen min"-valg (12.2, to alternativer, ikke en avkryssing);
(4) et OG-delingsbilde for forespørselssider, når/hvis prioritert — krever
`public/`-mappe og en bilde-renderingsstrategi som ikke finnes ennå.

Bekreftet i denne runden: CI for commit `a9740d4` (forespørselssiden) er
grønn — inkludert de ekte integrasjonstestene og produksjonsbygget mot den
nye ruten, ingen miljøspesifikk overraskelse.

**Rettelse av punkt (2) over, oppdaget ved å faktisk tenke gjennom det i
stedet for å bare gjøre det:** vurderte å la `next build`-steget i CI kjøre
mot en ekte, migrert database "for å fange fremtidige spørringer som
utilsiktet kjører ved buildtid" — men logikken var baklengs. `next build`
bruker allerede bevisst en UGYLDIG `DATABASE_URL`
(`postgres://ci:ci@localhost:5432/ci_unused`), som betyr at HVIS en
fremtidig side noensinne skulle spørre databasen ved buildtid, ville
bygget feile UMIDDELBART (tilkoblingen finnes ikke) — det ER allerede
fail-fast-oppsettet. Å bytte til en EKTE, migrert database ville gjort det
MOTSATTE: en utilsiktet buildtid-spørring ville da bare lykkes stille, og
nettopp SKJULE akkurat den klassen feil punktet ville fange. Droppet denne
oppgaven — ikke fordi den ble gjort, men fordi den aldri var en god idé,
og det er mer ærlig å stryke den enn å la den stå som en villedende
"gjenstår"-oppgave for neste økt.

---

## Fortsettelse av økt 7 — `RadioGroup`-komponenten (DESIGN.md 6)

Kort, avgrenset oppgave: bygget forberedende til svarskjemaet (12.2), som
trenger et ekte gjensidig-utelukkende valg ("ikke del e-postadressen min
ennå" / "del e-postadressen min"), ikke en avkryssingsboks.

Brukte `RadioField`/`RadioButton` fra react-aria-components — sjekket
typedefinisjonen først og fant at den eldre, enklere `<Radio>` alene er
merket `@deprecated` til fordel for nettopp denne sammensetningen (samme
disiplin som resten av natten: les den faktiske typedefinisjonen, ikke gjett
API-et fra minnet). Visuelt: en sirkel/prikk-indikator i stedet for
Checkbox sin hake, ellers samme mønster (egen `--color-focus-ring`-outline,
`--color-danger-text` for feiltekst, ingen forhåndsvalgt alternativ satt av
komponenten selv — kalleren bestemmer `defaultValue`/`value`, testet
eksplisitt at INGEN alternativ er forhåndsvalgt uten det).

Ingen nye designtoken-par (samme roller som Checkbox: `--color-accent` for
valgt tilstand, `--color-border-strong`/`--color-focus-ring` for kant/fokus,
`--color-danger-text` for feiltekst) — `contrast-pairs.ts` trengte ingen
oppdatering.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**162 tester**,
+5 nye), `i18n:check`, `design:check-tokens` (OK, 14 komponent-CSS-filer),
`rm -rf .next && next build`.

### Neste økt

(1) selve svarskjemaet (`/[locale]/foresporsler/[id]/svar`, SPEC-V1.md 12)
— nå har `TextField`/`TextArea`/`RadioGroup`/`Button` alt som trengs.
**Én ting å avklare/notere når den bygges:** SPEC-V1.md 12.3 sier
bekreftelsesteksten før innsending "er juridisk relevant og skal
gjennomgås av jurist i hvert språk... faller ikke tilbake til et annet
språk, mangler den, kan ikke locale-en tilbys" — akkurat som vilkår/
personvern/journalistvilkår (19.2, `legalDocumentType`), IKKE som en
vanlig i18n-nøkkel med nb-NO-fallback. Bygges den som en vanlig
oversettelsesstreng for enkelhets skyld i første omgang, er det en bevisst,
notert forenkling som bør rettes (trolig en fjerde `legalDocumentType`-
verdi) før flere enn nb-NO faktisk tilbys — ikke noe å avgjøre i farten
midt i en autonom nattøkt uten menneskelig vurdering av selve den
juridiske teksten; (2) resten av komponentbiblioteket (Dialog, Toast, Card,
Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher); (3) et OG-delingsbilde, når/hvis prioritert.

Bekreftet i denne runden: CI for commit `15d06f9` (`RadioGroup`) er grønn.

---

## Fortsettelse av økt 7 — begynte på svarskjemaet, fant en STØRRE forutsetningskjede enn antatt, stanset bevisst før den ble hastverksarbeid

Startet på punkt (1): selve svarskjemaet (`/[locale]/foresporsler/[id]/svar`).
Kom raskt til et reelt, strukturelt funn som endret omfanget:

**Innsending av svar krever en innlogget økt (SPEC-V1.md 6.2, 12) — men
det finnes IKKE noen innloggings- eller bekreftelsesside i hele
prosjektet ennå.** Bare API-rutene (`POST /auth/request-link`,
`POST /auth/verify`) finnes. Verifiseringsruten forventer et JSON-body
`{token}` via POST — den er IKKE en lenke en nettleser kan klikke direkte
(ingen GET-variant) — så en ekte "bekreft innlogging"-SIDE må finnes for i
det hele tatt å kunne kalle den. Gravde videre og fant et enda mer
grunnleggende hull: `sendTransactionalEmail()`
(`src/lib/email/send.ts`) er fortsatt bare en STUB som logger til
konsollen — ingen e-postmal (`magic_link`, `confirm_email`, m.fl.) er
faktisk bygget, og funksjonen KASTER en feil dersom `BREVO_API_KEY` noen
gang settes. Det finnes altså heller ingen etablert URL for hva
innloggingslenken i selve e-posten peker til — det er fritt frem å
definere den, men det er en større, mer grunnleggende beslutning enn "bygg
ett skjema til".

**Bevisst stanset her, IKKE hastet videre inn i:** en login-side, en
bekreft-side, OG (implisitt) e-postmal-rendring — alt i samme økt som
allerede har bygget mye i kveld. Dette er reell, god arbeidsfordeling: en
autonom økt som prøver å presse tre sammenhengende, delvis ubestemte
delsystemer (autentiserings-UI, e-postmaler, svarskjemaet) inn i samme
strekk risikerer akkurat den typen overflatisk, dårlig gjennomtenkt kode
resten av natten bevisst har unngått ved å stoppe opp og regne/sjekke før
hver antagelse.

### Likevel gjort: én liten, ekte, ferdig forbedring

`src/lib/auth/session.ts` sin `CurrentSession` manglet `email` —
SPEC-V1.md 6.2 krever eksplisitt at siden "alltid tydelig [viser] hvilken
e-postadresse man er innlogget som", noe svarskjemaet (og enhver annen
innlogget side) trenger. Lagt til som et rent additivt felt (alle 26
eksisterende kallesteder av `getCurrentSession()` bruker strukturell
typing og påvirkes ikke) — verifisert med full `tsc`/`vitest`/
`next build`/`test:integration` at ingenting brøt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (162 tester,
uendret), `rm -rf .next && next build`, `test:integration` mot ekte lokal
Postgres (40 tester).

### Neste økt — ANBEFALT REKKEFØLGE, ikke bare en liste

(1) **Innloggings-UI** (`/[locale]/logg-inn` + en bekreftelsesside for
magic link-tokenet, SPEC-V1.md 6.1) — bygg denne FØR svarskjemaet, ikke
etter, siden svarskjemaet uansett er utilgjengelig uten den. Enkleste
skjema i hele biblioteket (ett e-postfelt), men bekreftelsessiden må
faktisk avgjøre URL-formatet ingen andre har bestemt ennå; (2) en minimal
e-postmal-renderer for `magic_link`/`confirm_email` (uten dette har
innloggings-e-posten ingen lenke å style riktig, selv om selve HTML-
malsystemet kan bygges som et eget, avgrenset stykke arbeid uavhengig av
login-siden — bare selve URL-formatet må stemme overens); (3) DERETTER
selve svarskjemaet (`/[locale]/foresporsler/[id]/svar`, SPEC-V1.md 12),
med `--color-warning-text`-vurderingen fra tidligere i baklomma; (4) resten
av komponentbiblioteket; (5) det notert-men-utsatte OG-delingsbildet.

Bekreftet: CI for `d14331b` (email i CurrentSession) er grønn.

**Et reelt, tidligere ikke oppdaget hull mellom SPEC-V1.md 3.7 og forrige
økts kode, notert her i stedet for rettet i farten:** 3.7 sier eksplisitt
at selve STIEN skal oversettes per locale, ikke bare locale-prefikset —
`/nb-NO/foresporsler/:id/...` OG `/en-GB/requests/:id/...` (samme
forespørsel, ulikt stinavn). Forespørselssiden bygget forrige del av
økten (`/[locale]/foresporsler/[id]/[slug]`) bruker "foresporsler" som en
FAST katalogstruktur uavhengig av locale — riktig for `nb-NO`, feil for
`en-GB` (ville blitt `/en-GB/foresporsler/...`, ikke `/en-GB/requests/...`).
Null praktisk konsekvens i dag (ingen aktivt land tilbyr noe annet enn
`nb-NO` ennå — se `seed.ts`), men en reell, bekreftet avvik fra spec-en.
IKKE rettet nå: å bygge en generell løsning (trolig en middleware-
omskrivning av innkommende stier til et kanonisk internt navn, siden
Next.js sin fil-baserte ruting ikke støtter flere bokstavelige stinavn til
samme side-komponent uten det) er en reell arkitekturbeslutning som bør
gjøres når locale nummer to FAKTISK tilbys for et land, ikke spekulativt
bygges og la stå uverifiserbar til den dagen kommer.

---

## Fortsettelse av økt 7 — innloggingssiden (SPEC-V1.md 6.1), og en reell Next.js-feil fanget ved faktisk å teste flyten

Startet punkt (1) fra forrige "Neste økt": innloggings-UI. Bygget
`/[locale]/logg-inn` (`LoginForm.tsx`, ett e-postfelt, samme "avslør
ingenting uansett utfall"-prinsipp som selve API-ruten allerede har).

**Reell feil fanget FØR den ble en falsk antagelse i loggen:** første
forsøk bygget en egen server-rendret "bekreft"-SIDE
(`/[locale]/logg-inn/bekreft`) som kalte `verifyMagicLink()` +
`createSession()` direkte i selve side-komponentens rendring — samme
mønster jeg (feilaktig) trodde speilet `GET /api/digest-access/:token`.
Testet det FAKTISK i en ekte nettleser (`next build` + `next start`, ikke
antatt fra kildekoden) og fikk en ekte Next.js-feil: *"Cookies can only be
modified in a Server Action or Route Handler"* — `createSession()` setter
en cookie, og det er RETT OG SLETT ikke lov fra en vanlig side-komponents
rendring, uansett hvor likt det ser ut på papiret. `digest-access` er en
ROUTE HANDLER (`route.ts`), ikke en side — det var ALDRI det samme
mønsteret, bare overflatisk likt.

**Rettet ved å faktisk følge presedensen riktig:** flyttet selve
verifiserings-/økt-opprettelses-logikken til en ny `GET`-handler i den
EKSISTERENDE `src/app/api/auth/verify/route.ts` (som fra før bare hadde en
`POST`-variant for JSON-body-klienter) — nå en ekte, klikkbar lenke
(`GET /api/auth/verify?token=...&locale=...`), akkurat som
`digest-access`. Suksess: oppretter økt, viderefører til `/${locale}`
(brukerens EGEN locale, lagt til som et nytt felt på `VerifiedUser` i
`magic-link.ts` — rent additivt). Feil (utløpt/brukt/ugyldig — bevisst
udifferensiert, se eksisterende kommentar i `verifyMagicLink()` og
SPEC-V1.md 19.15 sitt "ikke to ulike feilveier"-prinsipp anvendt her også):
viderefører til `/${locale}/logg-inn?feil=utlopt`, som viser
`auth.verify.expired`-teksten. **Merk:** `auth.verify.already_used`
finnes fortsatt i meldingskatalogen, men brukes ALDRI i praksis, nettopp
fordi backend-en bevisst ikke skiller de to tilstandene — ikke en feil,
bare en dokumentert, litt overflødig nøkkel.

### Faktisk verifisert ende-til-ende i en ekte nettleser, ikke bare enhetstestet

Satte inn en ekte bruker + et ekte `AuthToken` i `kildebanken_test`
(ryddet opp igjen etterpå, inkludert `sessions`-raden `createSession()`
selv la igjen — måtte slettes FØR brukerraden pga. fremmednøkkelen,
oppdaget ved selve opprydningsforsøket). Bekreftet med `curl` mot en ekte
`next start`-server: (1) et gyldig token gir `307`-omdirigering til
`/nb-NO` MED en satt `kb_session`-cookie (riktig `HttpOnly`/`Secure`/
`SameSite=lax`, 30 dagers utløp); (2) SAMME token brukt en gang til gir
`feil=utlopt` (engangsbruk fungerer); (3) et oppdiktet token gir samme
feilvei. Skjermbilder av selve login-siden og feilmeldingen i en ekte
Chromium-nettleser bekreftet at teksten og stylingen faktisk vises riktig.

**En annen, mindre feil fanget av selve testkjøringen (ikke antatt bort):**
`LoginForm.tsx` sin `handleSubmit` hadde en `try { await fetch(...) }
finally { ... }` UTEN en `catch` — en avvist `fetch`-promise (nettverksfeil)
ville da forplantet seg som en uhåndtert avvisning forbi selve komponenten,
fanget av selve testsuiten (`vitest` sin "Unhandled Rejection"-advarsel på
akkurat den testen som simulerte en nettverksfeil), ikke antatt trygt fordi
"UI-en ser riktig ut". Rettet med en eksplisitt, bevisst tom `catch`.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**165
tester**, +3 nye for `LoginForm`), `i18n:check`, `design:check-tokens` (OK,
16 komponent-CSS-filer), `rm -rf .next && next build`, `test:integration`
mot ekte lokal Postgres (40 tester), OG en faktisk ende-til-ende-
verifisering av hele innloggingsflyten mot en ekte kjørende server (se
over) — ikke bare at koden kompilerer.

### Antagelser tatt

- Vellykket verifisering viderefører til `/${locale}` (forsiden) — det
  finnes ingen mottaker-/journalist-dashbord å sende brukeren til ennå.
  En `?to=`-destinasjonsparameter (samme mønster som `digest-access`) er
  en naturlig utvidelse den dagen en beskyttet side faktisk trenger å sende
  brukeren tilbake dit hen prøvde å gå — ikke bygget spekulativt nå.
- `auth.verify.already_used` beholdt i meldingskatalogen selv om den er
  ubrukt i praksis (se over) — trygt å beholde, `i18n:check` klager bare
  på MANGLENDE nøkler, ikke ubrukte.

### Neste økt

(1) en minimal e-postmal-renderer for `magic_link`/`confirm_email` (og de
andre stub-malene i `send.ts`) — nå som URL-formatet
(`/api/auth/verify?token=...&locale=...`) faktisk er bestemt og verifisert,
er dette et mer avgrenset stykke arbeid enn det så ut som forrige runde;
(2) DERETTER selve svarskjemaet (SPEC-V1.md 12); (3) resten av
komponentbiblioteket; (4) det notert-men-utsatte OG-delingsbildet; (5)
det notert-men-utsatte 3.7-hullet (oversatte stinavn per locale) — når
locale nummer to faktisk tilbys.

---

## Fortsettelse av økt 7 — de to første e-postmalene (SPEC-V1.md 15: `magic_link`/`confirm_email`), og en reell fargedrift funnet og rettet

Fortsatte punkt (1) fra forrige "Neste økt". Før selve malene: sjekket
DESIGN.md 7 nøye (tabellbasert, én kolonne, maks 600px, all CSS inlinet,
`lang`, ren tekst er en REELL variant) siden dette er "det viktigste
grensesnittet i produktet."

### Et reelt funn: `digest.ts` sine fargeverdier hadde driftet fra de faktiske tokenene

DESIGN.md 7 krever en byggetids-eksport av tokens til e-post nettopp for å
unngå at noen skriver en fargeverdi direkte og den drifter fra sannheten.
Den fulle pipelinen er ikke bygget (kjent, notert tidligere) — men jeg
regnet FAKTISK ut hva de ekte primitivene tilsvarer i hex (samme
`oklchToSrgbHex()` som kontrasttesten bruker) i stedet for å anta at
`digest.ts` sine håndskrevne verdier fra en tidligere økt fortsatt stemte.
De gjorde IKKE det — f.eks. var digestens "tekst"-farge `#21242b` mot den
faktiske `--gray-900` sin `#16191c`, og lenkefargen `#1d5b91` mot den
faktiske `--accent-700` sin `#0a5774`. Reell, bekreftet drift, akkurat den
typen DESIGN.md 7 advarer mot.

**Rettet ved å samle ETT sted:** `src/lib/email/colors.ts`
(`EMAIL_COLORS`) — beregnet med den samme, verifiserte fargematematikken,
med `colors.test.ts` som sjekker at konstantene fortsatt stemmer med de
faktiske primitivene (den nærmeste tilnærmingen til "feiler CI ved avvik"
uten hele eksport-pipelinen). Oppdatert `digest.ts` til å bruke disse i
stedet for sine egne hardkodede verdier — alle 7 eksisterende
`digest.test.ts`-tester fortsatt grønne (ingen av dem sjekket eksakte
hex-verdier, bare struktur/escaping/innhold).

### De to malene

`src/lib/email/templates/simple-cta-email.ts` — ETT delt skall
(overskrift, ett avsnitt, én CTA-lenke, en "se bort fra denne"-linje) for
`magic_link` og `confirm_email`, som er strukturelt identiske i dag (begge
er "her er en lenke, klikk innen 15 minutter") — ikke to dupliserte
maloppsett for samme struktur. `magic-link.ts`/`confirm-email.ts` er tynne
wrappere som bygger selve `GET /api/auth/verify?token=...&locale=...`-
URL-en (formatet bestemt forrige del av økten) og henter riktige
i18n-nøkler (nye: `email.magic_link.*`/`email.confirm_email.*`, begge
locales).

**Koblet inn i selve `sendTransactionalEmail()`-stubben** (`send.ts`):
uten `BREVO_API_KEY` logges nå den FAKTISK rendrede malen (emne + full
tekstversjon) for disse to, i stedet for bare malnavn+rå data — meningsfullt
testbart selv uten en ekte Brevo-integrasjon. De andre 21 malnavnene i
`TransactionalTemplate` faller fortsatt tilbake til det gamle, generiske
loggformatet (ingen av dem er bygget ennå).

Ekstraherte også `escapeHtml()` fra `digest.ts` til en delt
`escape-html.ts` — den andre malen trengte den samme funksjonen, og
duplisering av en sikkerhetsrelevant funksjon (HTML-escaping) er verre enn
en liten fil-flytting.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**186
tester**, +21 nye: `colors.test.ts`, `simple-cta-email.test.ts`,
`magic-link.test.ts`, `confirm-email.test.ts`, `send.test.ts`, pluss at
alle 7 eksisterende `digest.test.ts`-tester fortsatt er grønne etter
fargerefaktoreringen), `i18n:check` (91 nøkler), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(40 tester, uendret). PLUSS en direkte kjøring av den faktiske
`sendTransactionalEmail()`-stubben (ikke bare enhetstestet) som bekreftet
at loggutskriften faktisk er lesbar og riktig.

### Antagelser tatt

- E-postmalene er BARE bygget for lyst tema — DESIGN.md 7 sitt
  `prefers-color-scheme`-krav for e-post er IKKE dekket ennå (samme
  gjenstående punkt som selve byggetids-eksport-pipelinen).
- `magic_link`/`confirm_email` er de eneste to malene med faktisk
  innhold nå — resten av `TransactionalTemplate` sine 21 navn er fortsatt
  bare navn, bevisst i tråd med "bygg det som faktisk trengs, ikke alt på
  én gang"-disiplinen som har styrt hele natten.

### Neste økt

(1) selve svarskjemaet (`/[locale]/foresporsler/[id]/svar`, SPEC-V1.md 12)
— nå har både innloggingsflyten OG de e-postmalene den avhenger av faktisk
innhold; (2) flere e-postmaler etter behov (kvittering på innsendt svar er
trolig neste naturlige, siden svarskjemaet vil trenge den); (3) resten av
komponentbiblioteket; (4) OG-delingsbilde; (5) det oversatte-stinavn-hullet
(3.7); (6) `prefers-color-scheme` for e-postmaler, når/hvis prioritert.

Bekreftet: CI for `b91d463` (e-postmaler) er grønn.

---

## Fortsettelse av økt 7 — selve svarskjemaet (SPEC-V1.md 12), verifisert ende-til-ende mot ekte Postgres

Bygget `/[locale]/foresporsler/[id]/svar` — punkt (1) fra forrige "Neste
økt", og den siste brikken i mottakerens hele reise (5.2) fra registrering
til svar.

### Sideoppsett (server-komponent) og selve skjemaet (klientkomponent)

`page.tsx` sjekker `getCurrentSession()` FØRST: ingen økt eller feil rolle
→ viser en tydelig forklaring PLUSS en lenke til `/logg-inn` (ingen
`?to=`-tilbake-mekanisme ennå, se tidligere del av økten — notert som en
naturlig utvidelse senere). `request.status !== "published"` → viser at
forespørselen ikke lenger tar imot svar, ingen skjema. Ellers: viser
innlogget-som-e-post (SPEC-V1.md 6.2) og selve `ResponseForm`.

`ResponseForm.tsx` er en to-stegs klientkomponent (`form` → `confirm` →
`submitting`/`success`/`error`), ikke en enkelt lang side — SPEC-V1.md 12.3
sier eksplisitt at bekreftelsesskjermen "skal være rolig og fullstendig,
ikke en hurtigdialog", og DESIGN.md 8 kaller den "den viktigste skjermen i
tjenesten". `TextArea`×3 (relevans 2000, svar 4000, kort presentasjon 500),
`TextField` (visningsnavn 80), `RadioGroup` (kontaktdeling, "ikke del" som
STANDARDVALG per 12.2 — i kontrast til samtykkene i registreringsskjemaet,
som ALDRI forhåndsvelges; dette er en av de få stedene et forhåndsvalg
faktisk er spec-pålagt). Bekreftelsesskjermen lister alle sju punktene
12.3 krever ordrett, inkludert de mer juridisk formulerte (se eget avsnitt
under).

**Om den juridisk sensitive bekreftelsesteksten:** SPEC-V1.md 12.3 sier
teksten "skal gjennomgås av jurist i hvert språk... faller ikke tilbake
til et annet språk." De nye `response.confirm.*`-nøklene er skrevet så
presist jeg kan ut fra selve spec-teksten, MEN er ikke juridisk gjennomgått
— samme flaggede forbehold som ble notert FØR dette ble bygget (se
tidligere i økten). Ikke bygget som en egen `legalDocumentType` ennå
(ville krevd en skjemamigrasjon og en beslutning om hvordan den kobles til
land/locale-kombinasjonen) — en bevisst utsatt arkitekturbeslutning, ikke
en forglemmelse.

### Verifisert ende-til-ende mot EKTE Postgres i en ekte nettleser

Satte inn en ekte journalist + publisert forespørsel + mottaker MED en
ekte, gyldig øktcookie (ikke en mock) i `kildebanken_test`. Bekreftet med
Playwright: (1) uten innlogging vises riktig forklaring+lenke, ingen
skjema; (2) med en ekte økt-cookie vises hele skjemaet riktig, tegntellerne
fungerer, "ikke del e-post" er forhåndsvalgt; (3) bekreftelsesskjermen
viser riktig journalist/redaksjon og riktig delingstekst avhengig av valget
(sjekket begge grener); (4) innsending oppretter FAKTISK en rad i
`responses`-tabellen (sjekket direkte med en spørring, ikke bare at
API-et svarte 201) med riktig `contactSharing`; (5) et ANDRE forsøk på
samme forespørsel avvises tydelig med `errors.already_responded`
(FR-041, den betingede unike indeksen) — bekreftelsesskjermen forblir
brukbar med feilbanneret øverst, ikke en blank feiltilstand.

**Liten, ekte Playwright-observasjon (ikke en kodefeil):** et vanlig
`.click()` på selve radio-inputen feilet gjentatte ganger med "element
intercepts pointer events" — React Aria skjuler selve `<input>`-elementet
visuelt (samme mønster som `Checkbox` fra tidligere i natt) og lar en
`<label>` fange klikket i stedet. Løst i testskriptet med
`.click({ force: true })` på selve teksten. Ikke noe å rette i
komponenten — dette er riktig, tilgjengelig oppførsel, bare en kjent
Playwright-firkant mot dette mønsteret.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**193
tester**, +7 nye for `ResponseForm`), `i18n:check` (117 nøkler),
`design:check-tokens` (OK, 18 komponent-CSS-filer), `rm -rf .next &&
next build`, `test:integration` mot ekte lokal Postgres (40 tester), OG
en full ende-til-ende-verifisering i en ekte nettleser mot ekte Postgres
(se over) — den mest grundige verifiseringen av noen enkelt side bygget i
natt, tilsvarende hvor sentral denne siden er i hele produktet.

### Antagelser tatt

- Ingen redirect til `/logg-inn` ved manglende innlogging — siden viser en
  forklaring OG en lenke i stedet, siden ingen `?to=`-tilbake-mekanisme
  finnes ennå (samme antagelse som forrige del av økten).
- `response.confirm.*`-tekstene er UANMELDT juridisk innhold — se eget
  avsnitt over. Skal ikke tolkes som ferdig, juryst-godkjent tekst.
- Ingen kvittering-på-e-post-mal bygget ennå (`response_submitted_receipt`)
  — `sendResponse()` kaller allerede `sendTransactionalEmail` med dette
  malnavnet (fantes fra før), men faller foreløpig tilbake til det
  generiske loggformatet siden ingen mal er bygget for den ennå.

### Neste økt

(1) `response_submitted_receipt`/`new_response_received`-e-postmalene
(nå brukt av en ekte, fungerende flyt — mer motivert enn før); (2) resten
av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs, Table,
Pagination, EmptyState, SkeletonLoader, LanguageSwitcher); (3)
journalistens svarinnboks (SPEC-V1.md 13) — nå som svar faktisk kan
opprettes, er dette den naturlige måten en journalist ser dem; (4)
OG-delingsbilde; (5) det oversatte-stinavn-hullet (3.7); (6)
`prefers-color-scheme` for e-postmaler.

Bekreftet: CI for `7e99184` (svarskjemaet) OG `b91d463` (e-postmalene fra
forrige del av økten) er begge grønne.

---

## Fortsettelse av økt 7 — de neste to e-postmalene (`response_submitted_receipt`/`new_response_received`)

Fortsatte punkt (1) fra forrige "Neste økt". Begge sendes allerede fra
`submitResponse()` (`responses.ts`) — bare uten en faktisk mal bak
malnavnet, akkurat som `magic_link`/`confirm_email` var før forrige del av
økten.

Utvidet `getPublicRequest`-mønsteret videre: `submitResponse()` hentet fra
før `request.title`, men ikke `slug` — lagt til, siden begge de nye malene
trenger å lenke til forespørselens offentlige side.

**Justerte det delte skallet (`simple-cta-email.ts`) i stedet for å bygge
et fjerde, duplisert oppsett:** de to nye malene er strukturelt identiske
med `magic_link`/`confirm_email` (overskrift + avsnitt + lenke) MINUS selve
"ba du ikke om dette"-linjen, som ikke gir mening for en ren kvittering/et
rent varsel (ingen selvbetjent handling å angre). Gjorde `ignoreNote`
valgfri i stedet for å tvinge en kunstig "se bort fra denne"-setning inn i
en e-post som ikke har den vinkelen.

`send.ts` sin `renderTransactionalEmail()`-dispatcher krevde før et
`token`-felt UBETINGET for alle maler — ville aldri truffet de to nye
(som bruker `requestId`/`requestTitle`/`requestSlug`, ikke `token`).
Omstrukturert til å sjekke feltene HVER mal faktisk trenger, gren for
gren, i stedet for én felles forutsetning for alle.

**`new_response_received` lenker foreløpig til forespørselens EGEN
offentlige side**, ikke en ekte svarinnboks — SPEC-V1.md 13 ("journalistens
svarinnboks") er ikke bygget ennå. Tydelig kommentert som en midlertidig
destinasjon i selve malfilen, ikke stille antatt riktig for alltid.

### En reell, men uskyldig driftsforstyrrelse underveis

`test:integration` feilet først med `ECONNREFUSED 127.0.0.1:5432` — den
lokale Postgres-klyngen i selve sandkassen hadde stoppet (ikke noe
kodeendring gjorde det, bekreftet med `pg_isready`/`pg_lsclusters` FØR jeg
konkluderte noe). Startet den på nytt (`pg_ctlcluster 16 main start`), og
alle 40 integrasjonstester gikk gjennom uendret. Notert fordi neste økt
kan støte på det samme og bør sjekke akkurat dette FØR den antar en reell
kodefeil.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**204
tester**, +11 nye), `i18n:check` (125 nøkler), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(40 tester, etter at Postgres-klyngen ble startet på nytt), PLUSS en
direkte kjøring av selve `sendTransactionalEmail()`-stubben for begge nye
maler (ikke bare enhetstestet) som bekreftet lesbar, riktig utskrift.

### Neste økt

(1) resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination, EmptyState, SkeletonLoader, LanguageSwitcher); (2)
journalistens svarinnboks (SPEC-V1.md 13) — ville gjort
`new_response_received`-lenken riktig i stedet for midlertidig; (3)
OG-delingsbilde; (4) det oversatte-stinavn-hullet (3.7); (5)
`prefers-color-scheme` for e-postmaler; (6) flere e-postmaler etter behov
(f.eks. `journalist_application_received`/`journalist_approved`/
`journalist_rejected` — journalistregistreringen som ble bygget tidlig i
natt kaller allerede disse malnavnene uten innhold bak dem, akkurat som
mottakerflyten gjorde før i går natt).

---

## Fortsettelse av økt 7 — `journalist_application_received`-malen (fortsetter punkt (6) over)

`applyAsJournalist()` (`src/lib/registration/journalist.ts`, via
`requestMagicLink()` i `magic-link.ts`) har hele natten kalt
`sendTransactionalEmail()` med malnavnet `journalist_application_received`
uten at noe innhold lå bak det — falt tilbake til det generiske
stubb-loggformatet, akkurat som `magic_link`/`confirm_email` gjorde før
forrige del av økten, og akkurat som de to svar-malene gjorde før det
igjen. Dette er den FØRSTE e-posten enhver journalistsøknad faktisk
utløser, så det var det naturlige neste valget fra punkt (6)-listen
fremfor å starte på komponentbiblioteket eller svarinnboksen.

- Lagt til i18n-nøkler (`email.journalist_application_received.
  subject/heading/body/cta/ignore`) i både `nb-NO.json` og `en-GB.json` —
  verifisert null nøkkeldrift mellom filene med et engangs Node-skript før
  `check-keys.ts` ble kjørt.
- `src/lib/email/templates/journalist-application-received.ts` (ny) —
  bruker det samme delte skallet (`simple-cta-email.ts`) og nøyaktig samme
  `GET /api/auth/verify?token=...&locale=...`-lenkemekanisme som
  `magic_link`/`confirm_email`, siden e-postbekreftelse for journalister
  faktisk SKJER via denne lenken (samme `verifyMagicLink()`-kall setter
  `email_verified_at`, uavhengig av rolle).
- **Kommentert eksplisitt i malfilen** (for å unngå at noen senere leser
  `verification_status`-feltet feil): `pending_review` settes idet søknaden
  opprettes, UAVHENGIG av om denne e-posten i det hele tatt klikkes —
  teksten sier "blir deretter gjennomgått", ikke at klikket UTLØSER
  gjennomgangen. Ren e-postbekreftelse, ikke en portvokter for moderering.
- `send.ts`: lagt malen inn i samme switch-gren som `magic_link`/
  `confirm_email` (alle tre trenger kun `token`), fremfor en egen gren —
  de er strukturelt identiske. Dokumentasjonskommentaren øverst i filen
  oppdatert fra "foreløpig fire" til "foreløpig fem".
- Nye tester: 3 i `journalist-application-received.test.ts` (emne/
  overskrift, lenke med token+locale, en-GB-rendering), 1 ny i
  `send.test.ts` (stubb-loggformatet inneholder den faktiske overskriften).

**Ingen ny antagelse utover det som allerede sto i `magic-link.ts` sin
kommentar fra tidligere i natt** — denne malen implementerer bare det
malnavnet som allerede ble kalt, uten å endre selve beslutningen om å slå
sammen e-postbekreftelse og søknadskvittering i én e-post.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run src/lib/email/`
(9 testfiler, 43 tester), `vitest run` (full suite: 35 testfiler, **208
tester**, +4 nye), `i18n:check` (**130 nøkler**), `design:check-tokens`
(18 komponent-CSS-filer, ingen rå verdier), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (`pg_isready` bekreftet
"accepting connections" først — ingen omstart nødvendig denne gangen, i
motsetning til forrige del av økten — 10 testfiler, 40 tester, alle
grønne, uendret siden malen ikke rører database-logikk).

### Neste økt

(1) `journalist_approved`/`journalist_rejected` — samme mal-familie,
samme hastebegrunnelse (moderator-godkjenningsflyten, som allerede finnes
i `src/lib/moderation/` fra en tidligere del av natten, kaller etter alt
å dømme også disse malnavnene uten innhold bak — bør bekreftes og rettes
på samme måte); (2) resten av komponentbiblioteket (Dialog, Toast, Card,
Alert, Tabs, Table, Pagination, EmptyState, SkeletonLoader,
LanguageSwitcher); (3) journalistens svarinnboks (SPEC-V1.md 13); (4)
OG-delingsbilde; (5) det oversatte-stinavn-hullet (3.7); (6)
`prefers-color-scheme` for e-postmaler; (7) faktisk Brevo-integrasjon når
en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — `journalist_approved`/`journalist_rejected`-malene, PLUSS en generalisering av det delte skallet

Fortsatte punkt (1) fra forrige "Neste økt". Bekreftet FØRST (ikke bare
antatt) at `approveJournalist()`/`rejectJournalist()`
(`src/lib/moderation/journalists.ts`) faktisk kaller disse to malnavnene
uten innhold bak — grep bekreftet det (linje 53–57 og 100–104).

**Reell forskjell fra alle tidligere maler, ikke bare kopiering:**
- `journalist_approved` trenger INGEN token — godkjenningen er ikke en
  klikkbar handling i seg selv, bare en beskjed om at kontoen nå kan
  brukes. CTA-en peker i stedet på den allerede eksisterende
  innloggingssiden (`/[locale]/logg-inn`), ikke `GET /api/auth/verify`.
- `journalist_rejected` har INGEN naturlig oppfølgingshandling i det hele
  tatt — bare en fritekst-begrunnelse (`reason`, skrevet av moderator,
  IKKE oversatt, samme prinsipp som moderator-kommentarer på
  forespørsler, 9.3) satt inn i den oversatte body-teksten via
  ICU-interpolasjon.

Det siste punktet krevde en reell endring i det delte skallet
(`simple-cta-email.ts`), ikke bare et tomt CTA-felt: `ctaLabel`/`ctaUrl`
var påkrevde felt i grensesnittet. Fremfor å tvinge inn en kunstig lenke
(f.eks. til forsiden) bare for å tilfredsstille typen — samme
resonnement som da `ignoreNote` ble gjort valgfri tidligere i natt for
maler uten en "ba du ikke om dette"-vinkel — gjorde jeg `ctaLabel`/
`ctaUrl` valgfrie også. HTML- og tekstrendring hopper nå over CTA-blokken
helt når de ikke er satt, i stedet for å rendre en tom eller ugyldig
lenke.

**Fanget og rettet en test som ville blitt feil av denne endringen**: den
eksisterende "faller tilbake til det generiske formatet for maler uten en
bygget mal ennå"-testen i `send.test.ts` brukte nettopp `journalist_approved`
som sitt eksempel på en IKKE-bygget mal — ville sluttet å teste det den
faktisk skulle teste nå som malen har innhold. Byttet eksempelet til
`contact_approved` (fortsatt reelt ubygget) i stedet for å late som om
ingenting endret seg.

- `src/lib/email/templates/journalist-approved.ts` (ny),
  `journalist-rejected.ts` (ny), med tilhørende testfiler (3 + 4 tester).
- `src/lib/email/templates/simple-cta-email.ts` — `ctaLabel`/`ctaUrl` fra
  påkrevd til valgfritt, med samme begrunnelseskommentar-stil som
  `ignoreNote` allerede hadde. Ny test i `simple-cta-email.test.ts` som
  bekrefter at `<a href=` er fullstendig fraværende når de ikke er satt.
- i18n-nøkler lagt til i begge språkfiler:
  `email.journalist_approved.subject/heading/body/cta`,
  `email.journalist_rejected.subject/heading/body` (ingen `.cta`-nøkkel —
  det finnes ingen knapp å tekste).
- `send.ts`: to nye switch-grener. `journalist_approved` trenger ingen
  data i det hele tatt (`input.data` sjekkes ikke). `journalist_rejected`
  krever `reason: string`, ellers `null` (faller tilbake til generisk
  logging, samme mønster som alle andre grener). Dokumentasjonskommentaren
  oppdatert fra "foreløpig fem" til "foreløpig sju".
- Verifisert med et engangs `tsx`-skript (kjørt og slettet igjen) at
  begge maler faktisk logger lesbar, korrekt tekst — ikke bare
  enhetstestet i isolasjon. `journalist_rejected` sin utskrift bekreftet
  at CTA-lenken faktisk mangler helt i den rå tekst-utskriften, ikke bare
  i HTML-versjonen.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**218
tester**, +10 nye), `i18n:check` (**137 nøkler**), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(`pg_isready` bekreftet på forhånd — 40 tester, uendret, denne endringen
rører ikke databaselogikk), PLUSS en direkte kjøring av
`sendTransactionalEmail()`-stubben for begge nye maler.

### Neste økt

(1) resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination, EmptyState, SkeletonLoader, LanguageSwitcher); (2)
journalistens svarinnboks (SPEC-V1.md 13); (3) OG-delingsbilde; (4) det
oversatte-stinavn-hullet (3.7); (5) `prefers-color-scheme` for
e-postmaler; (6) flere e-postmaler etter behov (16 gjenstår i
`TransactionalTemplate` uten innhold — de rundt forespørsel-livssyklusen
og moderasjon/rapportering er nå trolig de med høyest reell
sannsynlighet for å faktisk bli kalt fra kode som allerede finnes, samme
mønster som de sju som er bygget så langt); (7) faktisk
Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — journalistens forespørsel-skjema (SPEC-V1.md 9), et ekte hull oppdaget før det ble bygget

Før jeg fortsatte punktlisten over, sjekket jeg selve `src/app/[locale]/`-
mappen mot API-rutene den skal dekke — og fant et større, reelt hull enn
noe i "Neste økt"-listen: HELE journalistens forespørsel-livssyklus
(opprette utkast, redigere, sende til vurdering) hadde full backend
(`POST/PATCH/DELETE /requests/:id`, `POST /requests/:id/submit`,
`GET /requests/mine`) men INGEN brukergrensesnitt i det hele tatt — bare
API-ruter en journalist aldri kunne nå uten å skrive HTTP-kall for hånd.
Journalistens svarinnboks (som sto øverst i listen) har SAMME situasjon,
men forespørsel-skjemaet er mer grunnleggende: uten det finnes det
ingenting en journalist faktisk kan publisere gjennom grensesnittet, og
dermed heller ingen publiserte forespørsler å bygge en svarinnboks
IMOT. Prioriterte derfor dette foran punkt (1)/(2) over — en avviking fra
den nedskrevne rekkefølgen, men med samme "hva mangler faktisk for at den
gyldne stien skal fungere ende til ende"-resonnement som har styrt
prioriteringen hele natten.

### Bygget

- `src/app/[locale]/journalist/requests/page.tsx` — journalistens egen
  forespørselsliste (`GET /requests/mine`), med statusmerker, frist (i
  LANDETS tidssone, se under), "Rediger"-lenke for redigerbare statuser,
  og en offentlig visnings-lenke for publiserte/lukkede/utløpte.
- `NewRequestButton.tsx` — en liten klientkomponent som kaller
  `POST /requests` (FR-010: oppretter et TOMT utkast, ingen body) og
  navigerer rett til redigeringssiden. Selve skjemaet fylles der, ikke i
  en opprettelsesdialog.
- `src/app/[locale]/journalist/requests/[id]/page.tsx` +
  `RequestEditForm.tsx` — selve skjemaet (tittel, oppsummering,
  beskrivelse, hvem søkes, tema, språk, svarfrist, de tre ja/nei-feltene,
  geografisk område, intern referanse), med to knapper ("Lagre utkast" =
  PATCH, "Send til vurdering" = PATCH etterfulgt av submit). Statuser
  utenfor `draft`/`changes_requested` vises som en skrivebeskyttet
  oppsummering i stedet — PATCH nekter uansett å kjøre utenfor disse to
  (håndheves allerede av `updateDraft()`), så dette er en SPEILING av en
  regel som allerede fantes, ikke en ny en.
- Feilmeldinger vises PER FELT (DESIGN.md 6.1: "feilmeldinger står ved
  feltet"), ikke bare oppsummert — `fieldErrors`-koden fra
  `validate.ts` mappes eksplisitt til riktig felt i skjemaet, med én
  ny `errors.<kode>`-nøkkel per valideringskode (13 nye nøkler).
- `src/lib/requests/topics.ts` (ny) — de 21 temanøklene fra 9.1 som en
  delt konstant (`REQUEST_TOPICS`), brukt av temavelgeren. 21 nye
  `request.topic.<nøkkel>`-oversettelser lagt til.
- `src/lib/requests/status-badge.ts` utvidet med
  `journalistRequestStatusTone()`/`isJournalistRequestStatus()` for de
  sju statusene journalisten selv ser (`draft`/`submitted`/
  `changes_requested`/`rejected`/`published`/`closed`/`expired`) — filens
  egen kommentar sa fra økt 6 at dette var utsatt "til den dagen
  journalistportalen faktisk viser dem". Den dagen er i dag.
- 4 nye `request.status.*`-oversettelser (draft/submitted/
  changes_requested/rejected) — bare de tre offentlige fantes fra før.

### Svarfristen: et reelt tidssone-problem, løst med en generell, testet funksjon

SPEC-V1.md 9.1 krever "dato + klokkeslett i LANDETS tidssone" — IKKE
journalistens nettleser sin egen. En `<input type="datetime-local">` gir
bare et rått "YYYY-MM-DDTHH:mm" uten noen tidssoneinformasjon i det hele
tatt, så konverteringen til riktig UTC-tidspunkt måtte gjøres et sted som
faktisk kjenner landets IANA-sone.

- `src/lib/datetime/timezone.ts` (ny) — `zonedWallTimeToUtc()` og dens
  invers `utcToZonedWallTime()`, samme "ingen avhengighet utover
  Node sin innebygde Intl"-prinsipp som `localTimeForTimezone()` i
  `tick.ts` (økt 4/5) allerede etablerte for et beslektet problem.
  Bruker en to-runders "gjett, se hva sonen faktisk viser, korriger"-
  teknikk (standard for denne typen konvertering) — IKKE en fast
  UTC-offset-tabell, som ville vært feil halve året for enhver sone med
  sommertid. 10 tester, inkludert en vinter- OG en sommerdato for
  Europe/Oslo (krysser selve DST-grensen riktig) og en ikke-hel-
  time-forskyvning (Asia/Kathmandu, UTC+5:45) som ville avslørt en
  implementasjon som antok hele timer.
- `updateDraft()` (`requests.ts`) tar nå ENTEN et ferdig `responseDeadline:
  Date` (uendret, brukt av integrasjonstestene som allerede kjenner det
  eksakte tidspunktet) ELLER et nytt `responseDeadlineLocal: string` —
  konverteres til UTC med landets tidssone FØR validering og lagring.
  Ny `getCountryFormOptions()` slår opp landets tidssone og tilgjengelige
  språk i én spørring, brukt av både listesiden og redigeringssiden.
  PATCH-ruten sin zod-body byttet fra `responseDeadline: z.coerce.date()`
  (aldri faktisk kalt av noen klient ennå) til
  `responseDeadlineLocal: z.string().regex(...)`.
- **Verifisert uavhengig av UI-et**: etter å ha satt "15.09.2026 14:00"
  gjennom selve skjemaet i en ekte nettleser, sjekket jeg raden direkte i
  Postgres (`psql`) — `response_deadline = 2026-09-15 12:00:00+00`.
  15. september er sommertid i Norge (CEST, UTC+2), så 14:00 lokalt skal
  bli 12:00 UTC. Stemte nøyaktig — ikke bare "listen viste samme
  klokkeslett tilbake" (som en dobbel feil-i-samme-retning kunne skjult),
  men den faktiske lagrede UTC-verdien kontrollert mot kjent riktig svar.

### Et ekte, men lavrisiko funn i selve skjemaet — IKKE rettet nå

`request_status`-enumen i `db/schema.ts` inneholder en verdi, `"approved"`,
som verken SPEC-V1.md 9.2 sin tilstandsdiagram nevner (kun `submitted →
published` direkte, ingen mellomtilstand) eller noe kode noensinne setter
(`grep` bekreftet: enumen definerer den, ingenting tildeler den). Trolig en
rest fra et tidligere utkast av skjemaet. Ufarlig som den står (ingen rad
kan noensinne få denne verdien), men er teknisk et hull mellom kode og
spec i streng forstand. IKKE rettet nå — å fjerne en enum-verdi krever en
migrasjon, og dette er et rent opprydningsarbeid uten hastverk, ikke noe
å gjøre som en bivirkning av å bygge skjema-UI-et. Notert her per
"spec er sannheten"-regelen; en fremtidig økt bør enten fjerne verdien
(migrasjon) eller — om den er ment å brukes til noe — oppdatere 9.2 til å
nevne den.

### Verifisert ende til ende i en EKTE nettleser, ikke bare enhetstestet

`next dev` viste seg IKKE å fungere for denne testen — CSP-en bygget
tidligere i natt (`strict-dynamic`, ingen `unsafe-eval`) kolliderer med
Next sin dev-modus, som er avhengig av `eval()` for å kjøre HMR-bunter.
Ingen klient-JS kjørte i det hele tatt (ingen hydrering, ingen
knappe-handlere), uten noen synlig feil utover en CSP-advarsel i
konsollen. Løst ved å teste mot en PRODUKSJONSBYGGET instans (`next build`
+ `next start`) i stedet — som uansett er den riktige måten å verifisere
en CSP bygget for produksjon på. Notert her i tilfelle en senere økt støter
på samme "ingenting skjer når jeg klikker"-symptom i dev-modus og feilaktig
mistenker en kodefeil.

Brukte Playwright (`npx playwright`, forhåndsinstallert i miljøet, IKKE
lagt til som et prosjektavhengighet — installert midlertidig med
`--no-save` og avinstallert igjen etter testen) til å: logge inn som en
sådd, godkjent testjournalist (økt-token satt direkte i databasen, samme
fixture-mønster som integrasjonstestene bruker), opprette en ny
forespørsel, fylle ut hele skjemaet, lagre utkastet, sende det til
vurdering, og til slutt laste listesiden på nytt — alt fungerte, inkludert
riktig statusmerke og riktig frist-visning etter innsending. Skjermbilder
tatt og sjekket visuelt (riktig designtoken-styling, fokusring synlig,
tegntellere riktige). Alle midlertidige skript og den midlertidige
`playwright`-installasjonen fjernet igjen etter testen.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**234
tester**, +26 nye), `i18n:check` (**175 nøkler**), `design:check-tokens`
(21 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (`pg_isready` — klyngen hadde
stoppet på nytt, samme kjente, ufarlige driftsforstyrrelse som forrige
del av økten, startet på nytt — 41 tester, +1 ny), PLUSS den fullstendige
ende-til-ende-nettleserverifiseringen beskrevet over.

### Neste økt

(1) journalistens svarinnboks (SPEC-V1.md 13) — nå gir dette faktisk
mening å bygge, siden en journalist nå kan komme seg gjennom hele veien
til en publisert forespørsel gjennom selve grensesnittet; (2) resten av
komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs, Table,
Pagination, EmptyState, SkeletonLoader, LanguageSwitcher); (3) en
moderator-/administrasjonsside for å godkjenne/avvise innsendte
forespørsler og journalistsøknader (SPEC-V1.md 16) — også et hull av
samme type som det denne økten fant: full backend, ingen UI; (4) den
ubrukte `"approved"`-verdien i `request_status`-enumen (se over); (5)
OG-delingsbilde; (6) det oversatte-stinavn-hullet (3.7); (7)
`prefers-color-scheme` for e-postmaler; (8) flere e-postmaler etter
behov; (9) faktisk Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — moderator-/administrasjonskøen (SPEC-V1.md 16), samme "backend uten UI"-mønster som forrige del

Fortsatte rett videre på punkt (3) fra forrige "Neste økt" i stedet for
svarinnboksen (som sto øverst) — uten en moderator som faktisk kan
godkjenne noe gjennom grensesnittet, var forespørsel-skjemaet fra forrige
del av økten en blindvei: en innsendt forespørsel kunne ALDRI bli
`published` uten et direkte API-kall, og dermed ville svarinnboksen ikke
hatt noe ekte, gjennom-grensesnittet-publisert innhold å vise. Samme
"hva blokkerer den gyldne stien faktisk"-resonnement som sist, ikke en ny
prioriteringsprosess.

**Bevisst avgrenset, IKKE hele 16.1-dashbordet**: `SPEC-V1.md` 16 beskriver
et fullt dashbord (statistikk, flere køer, landvelger for administrator,
utsendelsesstatus osv.) — bygget her er BARE de to køene som faktisk
blokkerer noe (journalistsøknader, innsendte forespørsler), med
godkjenn/avvis/be-om-endringer-handlinger. Resten av 16 er fortsatt et
reelt hull, notert under "Neste økt".

### Bygget

- `src/app/[locale]/admin/journalists/page.tsx` +
  `JournalistQueueItem.tsx` — `GET /admin/journalists?status=pending_review`
  (kalt direkte via `listJournalists()`, samme mønster som journalist-
  sidene i forrige del av økten), med Godkjenn (direkte) og Avvis
  (åpner en begrunnelses-tekstboks, begrunnelsen er obligatorisk — 8:
  "avvisning skal ha en begrunnelse som sendes til søkeren").
- `src/app/[locale]/admin/requests/page.tsx` + `RequestQueueItem.tsx` —
  `listModerationQueue()`, med tre handlinger: "Godkjenn og publiser"
  (direkte), "Be om endringer" (kommentar obligatorisk), "Avvis"
  (begrunnelse obligatorisk) — nøyaktig de tre overgangene 9.2 tillater
  fra `submitted`.
- `listModerationQueue()` (`src/lib/moderation/requests.ts`) utvidet til
  å joine `journalistProfiles` for VISNING (9.3: moderator skal vurdere
  "legitimt journalistisk formål" — må se hvem som spør, ikke bare
  forespørselsteksten). Endret fra `select()` (alle rå-kolonner, aldri
  brukt av noen tidligere kaller) til et eksplisitt felt-sett + de to
  nye navnefeltene.
- Etter en handling kalles `router.refresh()` — elementet forsvinner
  fra køen ved neste server-rendring i stedet for å administrere en
  klientside-liste selv, samme mønster som ville vært naturlig andre
  steder i kodebasen.
- 25 nye `admin.journalists.*`/`admin.requests.*`-oversettelser.

### Et reelt, pre-eksisterende arkitekturhull oppdaget: `moderation/*.ts` kan ikke integrasjonstestes

Forsøkte først å skrive en integrasjonstest for `listModerationQueue()`
sin nye join (samme disiplin som resten av natten: verifiser mot ekte
Postgres, ikke bare stol på koden). Testen feilet UMIDDELBART med
`"This module cannot be imported from a Client Component module"` — selv
etter å ha fjernet enhver egen import av `CurrentSession`-typen.

Årsaken er strukturell, ikke noe jeg introduserte: `src/lib/moderation/
requests.ts` importerer `requireModeratorForCountry`/
`getAssignedCountryCodes` fra `src/lib/auth/authorize.ts`, som igjen
importerer `getCurrentSession` fra `src/lib/auth/session.ts`, som har
`import "server-only"` øverst. Denne pakken kaster en feil i ETHVERT
miljø som ikke eksplisitt setter Next sin `react-server`-
modulforhold-betingelse (`exports` i `server-only` sin `package.json`)
— noe Vitest ikke gjør. Siden ES-moduler importerer en fils HELE
topptekst uavhengig av hvilken navngitt eksport man faktisk bruker,
poisoner dette HELE `requests.ts`/`journalists.ts` for testformål, selv
for en funksjon som `listModerationQueue()` som aldri selv kaller
`getCurrentSession()`.

Til sammenligning importerer `src/lib/requests/requests.ts` (forrige del
av økten) ALDRI `session.ts` — den tar `journalistUserId`/`actorUserId`
som rene strengparametre og lar RUTEN slå opp økten, nøyaktig for å
unngå denne koblingen. `moderation/*.ts` brøt dette mønsteret ved å
kalle `requireModeratorForCountry()` (som slår opp økten SELV) direkte
fra lib-laget. Ingen eksisterende tester fantes for disse filene fra før
— dette er altså IKKE en regresjon jeg innførte, men et reelt,
pre-eksisterende hull i testbarheten som jeg støtte på.

**Ikke rettet nå** — å dele opp `authorize.ts` (rendyrke
`getAssignedCountryCodes()` til en fil som bare type-importerer
`CurrentSession`) hjelper ikke alene, siden `requireModeratorForCountry()`
(som trengs av SKRIVE-handlingene i samme fil) uansett trekker inn
`session.ts` for hele modulen. En ekte fiks krever enten å flytte
`listModerationQueue()` til en egen fil, eller omstrukturere hvordan
skrivehandlingene henter sin autorisasjon (la RUTEN slå opp økten og gi
den videre, som i `requests.ts`) — begge er reelle, men egne
refaktoreringsoppgaver, ikke noe å gjøre som en bivirkning av én ny
kolonne i én spørring. Verifiserte joinen i stedet med et engangs
`tsx`-skript direkte mot databasen (kjørt og slettet igjen) — bekreftet
riktig `journalistFullName`/`organizationName`.

### Verifisert ende til ende i en ekte nettleser

Samme produksjonsbygg-metode som forrige del av økten (dev-modus
kolliderer fortsatt med CSP-en). Logget inn som en sådd moderator tildelt
testlandet: avviste en ventende journalistsøknad (køen ble tom
etterpå), og publiserte en innsendt forespørsel (forsvant fra
modereringskøen etterpå, `status` ble `published` i databasen).
Skjermbilde tatt og sjekket visuelt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**234
tester**, uendret — se avsnittet over for hvorfor ingen ny
enhetstest/integrasjonstest kunne legges til for selve joinen),
`i18n:check` (**199 nøkler**), `design:check-tokens` (25
komponent-CSS-filer), `rm -rf .next && next build`, `test:integration`
mot ekte lokal Postgres (41 tester, uendret), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over.

### Neste økt

(1) journalistens svarinnboks (SPEC-V1.md 13) — nå er BÅDE
forespørsel-opprettelse OG moderasjon bygget, så dette gir endelig mening
å teste med ekte, gjennom-grensesnittet-publiserte forespørsler; (2)
vurder å rette testbarhetshullet i `moderation/*.ts` (se over) FØR flere
funksjoner legges til der, ikke etter; (3) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination, EmptyState,
SkeletonLoader, LanguageSwitcher); (4) resten av 16.1-dashbordet
(statistikk, landvelger for administrator, utsendelsesstatus) — bevisst
utelatt fra denne økten som bare bygget de to blokkerende køene; (5) den
ubrukte `"approved"`-verdien i `request_status`-enumen; (6)
OG-delingsbilde; (7) det oversatte-stinavn-hullet (3.7); (8)
`prefers-color-scheme` for e-postmaler; (9) flere e-postmaler etter
behov; (10) faktisk Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — journalistens svarinnboks (SPEC-V1.md 13), siste ledd i den gyldne stien

Fortsatte punkt (1) fra forrige "Neste økt" — nå gir det endelig mening,
siden en forespørsel kan gå hele veien fra opprettelse (forrige del av
økten) via moderator-godkjenning (delen før det) til publisert gjennom
selve grensesnittet.

### Et reelt spec-avvik funnet FØR bygging, ikke etterpå

Før jeg bygget listevisningen, sjekket jeg `ResponseListItem`
(`journalist-inbox.ts`, bygget tidligere i natt) mot selve teksten i
13: "visningsnavn, FØRSTE LINJE AV PRESENTASJONEN, innsendingstidspunkt,
merking, og om e-postadressen er delt." "Presentasjonen" er `short_bio`
(12.1: "Kort presentasjon av deg selv"), IKKE `relevanceStatement` — men
`ResponseListItem` eksponerte bare `relevanceStatement`. Et reelt hull
mellom spec og kode fra tidligere i natt, ikke noe jeg selv innførte nå.
Rettet: `shortBio` lagt til i både spørringen og typen, med
`relevanceStatement` beholdt som fallback for "første linje" når
presentasjonen (valgfri) mangler — ikke fordi spec-en ber om en fallback,
men fordi å vise INGENTING når et valgfritt felt er tomt er en dårligere
løsning enn en fornuftig reserveløsning. Verifisert i en ekte nettleser
at begge veier faktisk vises riktig (én respondent med `shortBio`, én
uten).

### Bygget

- `src/app/[locale]/journalist/requests/[id]/responses/page.tsx` —
  tellere (totalt/uleste/aktuelle/kontaktforespørsler, fra
  `listResponsesForRequest()`) + listevisning. "Se svar"-lenken fra
  forrige del av økten (lagt inn i i18n-filene da, men pekte ingen steder
  — nå brukt).
- `src/app/[locale]/journalist/responses/[id]/page.tsx` +
  `ResponseDetailPanel.tsx` — full detaljvisning (kort presentasjon,
  relevans, svar, delingsstatus), merking (`RadioGroup`: ikke vurdert/
  aktuell/ikke valgt) + internt notat (`PATCH .../status`), og en
  kontaktforespørsel-inline-skjema (`POST .../contact-request`) som bare
  vises når respondenten IKKE allerede har delt e-post (13: "knapp for
  kontaktforespørsel"). Gjenbruker `ReportForm` direkte for
  "rapporter dette svaret" (14.2/12.5 mønsteret) i stedet for å bygge en
  ny rapporteringskomponent — se funnet under for hvorfor det avdekket en
  ekte feil.
- `getResponseDetailForJournalist()` setter `viewed_at` automatisk ved
  besøk (allerede bygget tidligere i natt) — ingen ny kode nødvendig her,
  bare bekreftet i en ekte nettleser at telleren for "uleste" faktisk
  synker etterpå.

### Et reelt, tidligere usynlig bug funnet ved førstegangsbruk av `ReportForm` på et svar

`ReportForm` (bygget for `POST /report`, brukt til nå BARE på
forespørsler) viste alltid `t("request.report_button")` — "Rapporter
DENNE FORESPØRSELEN" — UANSETT `entityType`-prop. Usynlig helt frem til
nå fordi ingen tidligere kalte den med `entityType="response"`. Rettet:
knappeteksten velges nå basert på `entityType` (ny nøkkel
`response.report_button`: "Rapporter dette svaret"), med en ny test som
bekrefter at komponenten IKKE lenger viser forespørsel-teksten for et
svar.

### Verifisert ende til ende i en ekte nettleser

Sådd en journalist med en PUBLISERT forespørsel og to svar (én med
`shortBio` satt og `contactSharing: none`, én uten `shortBio` og
`contactSharing: email`) direkte i databasen. I en produksjonsbygget
instans: åpnet innboksen fra forespørsel-listen, bekreftet riktig
tellere og "første linje"-visning for begge svarene, merket det første
svaret som "Aktuell", lagret et internt notat, sendte en
kontaktforespørsel — lastet innboksen på nytt og bekreftet at tellerne
(uleste/aktuelle/kontaktforespørsler) faktisk oppdaterte seg riktig.
Åpnet det ANDRE svaret (med delt e-post) og bekreftet at
delingsteksten var riktig OG at kontaktforespørsel-knappen var HELT
fraværende (riktig — 14.1: bare relevant når e-post ikke allerede er
delt). Skjermbilder tatt og sjekket visuelt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**235
tester**, +1 ny — `ReportForm`-testen; ingen ny test for
`journalist-inbox.ts`-endringen selv, siden den filen har samme
`server-only`-testbarhetshull som `moderation/*.ts`, se forrige del av
økten — verifisert i ekte nettleser i stedet), `i18n:check` (**234
nøkler**), `design:check-tokens` (28 komponent-CSS-filer),
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(41 tester, uendret), PLUSS ende-til-ende-nettleserverifiseringen
beskrevet over.

### Status: hele den journalist-vendte gyldne stien er nå bygget gjennom selve grensesnittet

Søk om journalistkonto → godkjent av moderator → logg inn → opprett
forespørsel → send til vurdering → godkjent og publisert av moderator →
mottar svar → merk/noter/be om kontakt. Alle ledd har nå en faktisk
side, ikke bare et API-endepunkt.

### Neste økt

(1) resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination, EmptyState, SkeletonLoader, LanguageSwitcher); (2)
resten av 16.1-dashbordet (statistikk, landvelger for administrator,
utsendelsesstatus); (3) rett testbarhetshullet i `moderation/*.ts`/
`journalist-inbox.ts` (server-only-import-kjeden, se to deler tilbake i
økten) FØR enda en funksjon legges til uten integrasjonstest-dekning;
(4) den ubrukte `"approved"`-verdien i `request_status`-enumen; (5)
OG-delingsbilde; (6) det oversatte-stinavn-hullet (3.7); (7)
`prefers-color-scheme` for e-postmaler; (8) flere e-postmaler etter
behov; (9) faktisk Brevo-integrasjon når en API-nøkkel finnes.

---

## Fortsettelse av økt 7 — `LanguageSwitcher` + en delt topptekst for de innloggede områdene, et hull oppdaget FØR bygging

Vurderte først den store testbarhets-refaktoreringen (`moderation/*.ts`,
punkt 3 over) som neste steg, men fant at den faktisk sprer seg mye
bredere enn antatt da den ble notert — `grep` viste at HELE
`admin/`- og `moderation/`-lib-laget (`admin/legal-documents.ts`,
`admin/countries.ts`, `admin/responses.ts`, `moderation/users.ts`, i
tillegg til de to allerede kjente) deler samme mønster. En refaktorering
av den størrelsen, som rører mye allerede fungerende
autorisasjonskode uten egen rutetest-dekning å verifisere mot, er ikke
noe å gjøre raskt i én autonom runde — utsatt bevisst, notert på nytt
under.

I stedet, mens jeg sjekket hvilke `common.*`/`nav.*`-i18n-nøkler som
faktisk var i bruk (for å vurdere om `Card`/`Alert`/`EmptyState` hadde
noen reell bruker å bygges mot), fant jeg noe mer grunnleggende: HELE
appen mangler navigasjon. `nav.home`/`nav.log_out`/
`common.language_switcher.label`-nøklene har ligget klare siden økt 1
uten å bli brukt noe sted, og rot-layouten (`src/app/[locale]/layout.tsx`)
er fortsatt bare `<body>{children}</body>` — hver eneste side bygget i
natt (journalistens forespørsler, svarinnboks, moderatorkøene) er kun
nåbar ved å taste URL-en direkte, ingen lenke, ingen språkbytte, ingen
utloggingsknapp noe sted.

**Bevisst avgrenset til de INNLOGGEDE områdene** (`/journalist`,
`/admin`), IKKE rot-layouten/den offentlige forsiden — `page.tsx` sin
egen kommentar sier eksplisitt at forsiden er en plassholder frem til
Fase 2-forsidedesignet (SPEC-V1.md 24), og `nav.requests`/
`nav.my_account` (også ubrukte fra økt 1) passer ikke faktisk
informasjonsarkitektur: det finnes bevisst INGEN offentlig
bla-i-forespørsler-side (11: oppdagelse skjer kun via digesten), og
ingen `/me`-side er bygget. Brukte derfor bare `nav.home`/`nav.log_out`
+ en ny, egen tittel-per-side-nøkkel for navigasjonslenkene, i stedet for
å tvinge de to resterende nøklene inn i noe de ikke passer til.

### Bygget

- `src/components/LanguageSwitcher.tsx` (+ test) — det siste konkrete
  DESIGN.md 6-komponentnavnet som hadde en tydelig, allerede
  identifisert bruker (den ubrukte i18n-nøkkelen). Bytter BARE
  locale-segmentet i gjeldende sti (riktig i dag pga. 3.7 — rute-segmenter
  er ikke oversatt ennå — kommentert i filen for når 3.7 lukkes).
  Første komponent i kodebasen som bruker `next/navigation`'s
  `usePathname()` — satte opp `vi.mock("next/navigation", ...)`-mønsteret
  siden ingen eksisterende test gjorde det fra før.
- `src/components/LogoutButton.tsx` — `POST /api/auth/logout` + redirect
  til `/logg-inn`, PÅ SAMME locale brukeren sto på (bruker samme
  `locale`-prop som resten av headeren, ikke plattformens standardspråk).
- `src/components/SiteHeader.tsx` — delt topptekst: hjem-lenke, valgfrie
  `navLinks` (per område), `LanguageSwitcher`, `LogoutButton`. Tar
  IKKE en `session`-prop og sjekker IKKE autorisasjon selv — det gjør
  hver enkelt `page.tsx` allerede, duplisert sjekk ville vært feil sted
  å legge logikken.
- `src/app/[locale]/journalist/layout.tsx` og `admin/layout.tsx` (nye) —
  wrapper alle undersider med `SiteHeader`, med hvert sitt sett
  `navLinks` (henholdsvis "Mine forespørsler" og de to
  modereringskø-titlene, gjenbrukt fra de eksisterende page-titlene i
  stedet for nye, duplikate strenger).

### Verifisert ende til ende i en ekte nettleser

Produksjonsbygget instans, sådd en journalist- og en moderatorøkt.
Bekreftet for BEGGE roller: riktige navigasjonslenker vises, klikk på
"Engelsk" bytter faktisk URL-ens locale-segment OG rendrer HELE siden
(header og innhold) på engelsk umiddelbart, og "Log out" tilbakekaller
økten og sender brukeren til `/logg-inn` PÅ SAMME locale som ble byttet
til. Skjermbilde tatt og sjekket visuelt — ren styling, riktig
fokus-/aktiv-markering på gjeldende locale.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**237
tester**, +2 nye), `i18n:check` (**240 nøkler**), `design:check-tokens`
(30 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (41 tester, uendret), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over.

### Neste økt

(1) resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination, EmptyState, SkeletonLoader) — ingen av disse har en
like tydelig, allerede identifisert bruker som `LanguageSwitcher` hadde,
så neste økt bør enten finne en konkret bruksgrunn FØRST (som denne
delen av natten gjorde) eller bevisst bygge dem uten en ennå, med en
kommentar om det; (2) rett testbarhetshullet i hele `admin/`-/
`moderation/`-lib-laget (viste seg å være STØRRE enn antatt — fem filer,
ikke to, se over) — planlegg denne skikkelig FØR neste autonome runde
gjør den, siden den rører mye eksisterende, fungerende
autorisasjonskode; (3) resten av 16.1-dashbordet; (4) den ubrukte
`"approved"`-verdien i `request_status`-enumen; (5) OG-delingsbilde; (6)
det oversatte-stinavn-hullet (3.7) — ville også gjort
`LanguageSwitcher` sin nåværende "bare bytt segment 1"-antagelse
foreldet; (7) `prefers-color-scheme` for e-postmaler; (8) flere
e-postmaler etter behov; (9) faktisk Brevo-integrasjon når en
API-nøkkel finnes; (10) vurder om `/me`-en side (profilvisning) og evt.
en offentlig informasjonsside burde bygges, siden `nav.my_account`/
`nav.requests` fortsatt er ubrukte i18n-nøkler uten noen side å peke
til.

---

## Fortsettelse av økt 7 — `prefers-color-scheme` for e-postmalene (DESIGN.md 7)

Vurderte testbarhets-refaktoreringen (punkt 2 over) igjen som neste
steg, men landet på samme konklusjon som sist: `grep` bekreftet at den nå
sprer seg over SEKS lib-filer (`admin/legal-documents.ts`,
`admin/countries.ts`, `admin/responses.ts`, `moderation/users.ts`, i
tillegg til de to allerede kjente `moderation/requests.ts`/
`journalists.ts`) og et sted mellom 15 og 20 rutefiler som ville trenge
tilsvarende endringer — alt sammen autorisasjonskode, uten en eneste
rutetest å verifisere mot i dag. Å gjøre dette raskt, alene, uten et
testsikkerhetsnett, er ikke forsvarlig risiko for én autonom runde.
Fortsatt bevisst utsatt — se "Neste økt" for et konkret forslag til
hvordan en fremtidig økt bør angripe den i stedet.

Valgte i stedet et klart mindre, godt avgrenset, lavrisiko-punkt fra
listen: punkt (7), `prefers-color-scheme` for e-postmalene — DESIGN.md 7
sitt eneste gjenstående, eksplisitt navngitte krav som verken var bygget
eller aktivt utsatt av en god grunn (i motsetning til den fulle
byggetids-eksport-pipelinen for tokens, som ER bevisst utsatt og notert
flere ganger i natt).

### Bygget

- `EMAIL_COLORS_DARK` i `src/lib/email/colors.ts` — samme prinsipp og
  samme verifiseringsmetode som den lyse varianten (`colors.test.ts`
  sjekker BEGGE mot de faktiske oklch-primitivene, nå 16 tester i den
  filen). Verdiene hentet fra `semantic.css` sin egen
  `@media (prefers-color-scheme: dark)`-blokk — IKKE gjettet på nytt: et
  første forsøk med håndskrevne hex-verdier ble faktisk feil (avvek fra
  de ekte primitivene med noen få hex-siffer), fanget opp av å kjøre et
  engangsskript som beregnet de RIKTIGE verdiene med prosjektets egen
  `oklchToSrgbHex()` FØR jeg skrev dem inn — samme disiplin som resten av
  natten ("regn ut de faktiske tallene, ikke anta").
- `emailDarkModeStyleTag()` + `EMAIL_COLOR_SCHEME_META` (samme fil) — et
  delt `<style>`-element med `@media`-regler (`eb-body`/`eb-card`/
  `eb-text`/`eb-muted`/`eb-link`/`eb-button`/`eb-border`-klasser, hver med
  `!important` siden de må vinne over den allerede eksisterende
  inline-stilen for klienter som FAKTISK støtter `<style>`), pluss
  `<meta name="color-scheme">`/`<meta name="supported-color-schemes">` —
  det er DENNE delen av DESIGN.md 7 sitt krav ("farger som er lesbare
  også når klienten inverterer på egen hånd") som faktisk FOREBYGGER at
  en klient prøver å gjette seg til et mørkt tema selv, i stedet for bare
  å tåle det.
- `simple-cta-email.ts` (skallet bak fem av de sju bygde malene) og
  `digest.ts` (den daglige utsendelsen, egen HTML-struktur) begge
  oppdatert til å legge `class="eb-*"` PÅ SIDEN AV de eksisterende
  inline-stilene (aldri i stedet for — inline er fortsatt det
  universelle fallback-laget for klienter uten `<style>`-støtte i det
  hele tatt).
- **Rettet en eksisterende, nå utdatert test-påstand**:
  `simple-cta-email.test.ts` hadde en test som eksplisitt sjekket
  `not.toContain("<style")` — korrekt DA den ble skrevet (ingen
  `<style>` fantes), men "all CSS inlines" i DESIGN.md 7 betyr "ingen
  ExTERNT stilark", ikke "aldri noe `<style>`-element i det hele tatt" —
  det SAMME avsnittet krever jo `prefers-color-scheme`, som er umulig å
  uttrykke med bare inline-stiler (media queries virker ikke der). Rettet
  testen til å reflektere riktig lesning av kravet, med en ny, egen test
  for selve mørk-tema-støtten.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**247
tester**, +10 nye), `i18n:check` (**240 nøkler**, uendret — ingen nye
i18n-strenger i denne delen), `design:check-tokens` (30
komponent-CSS-filer, uendret — endringene er i e-postmaler, ikke
komponent-CSS), `rm -rf .next && next build`, `test:integration` mot
ekte lokal Postgres (41 tester, uendret), PLUSS en direkte kjøring av
`renderMagicLinkEmail()` (kjørt og slettet igjen) som bekreftet at
`<style>`-blokken, metataggene og `class`-attributtene faktisk vises
riktig i den rå HTML-en.

### Neste økt

(1) den store testbarhets-refaktoreringen (`admin/`/`moderation/`-
lib-laget, se over) — konkret forslag denne gangen: start med ÉN fil
(f.eks. `moderation/journalists.ts`, minst risikofylt siden den bare har
to skrivehandlinger), flytt sesjons-oppslaget til de tilhørende rutene,
skriv INTEGRASJONSTESTER for den ene filen FØR den neste, og bruk de
allerede eksisterende browser-verifiserte flytene (denne natten testet
både godkjenning og avvisning i en ekte nettleser) som manuell
regresjonssjekk mellom hver fil — ikke gjør alle seks på én gang; (2)
resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs, Table,
Pagination); (3) resten av 16.1-dashbordet; (4) den ubrukte
`"approved"`-verdien i `request_status`-enumen; (5) OG-delingsbilde; (6)
det oversatte-stinavn-hullet (3.7); (7) flere e-postmaler etter behov;
(8) faktisk Brevo-integrasjon når en API-nøkkel finnes; (9) vurder en
`/me`-side og hva som skal skje med de resterende ubrukte
`nav.*`-nøklene.

---

## Fortsettelse av økt 7 — `EmptyState`-komponenten, og et reelt innholdsdesign-avvik rettet i samme slengen

Fortsatte punkt (2) fra forrige "Neste økt" — men i stedet for å bygge et
vilkårlig valgt komponentnavn uten en bruker, sjekket jeg først om noen
av de resterende (Dialog, Toast, Card, Alert, Tabs, Table, Pagination,
EmptyState) hadde en KONKRET, allerede eksisterende bruksplass, samme
metode som `LanguageSwitcher`-delen av natten. `EmptyState` hadde det
tydeligst: fire sider bygget i natt (journalistens forespørsler,
svarinnboksen, begge modereringskøene) viste allerede en enkel "ingen
X ennå"-tekst med rå `<p>`.

**Fant samtidig et reelt avvik fra DESIGN.md 8** ("Tomme tilstander
forklarer hva som skjer videre, ikke bare at det er tomt.") — alle fire
eksisterende tekstene brøt akkurat dette: "Du har ingen forespørsler
ennå.", "Ingen søknader til vurdering.", osv., uten noen forklaring på
hva som skjer videre. Ikke bare en komponent-mangel, altså, men et
faktisk innholdsdesign-avvik fra en allerede skrevet regel. Rettet
begge deler sammen: la til en obligatorisk `description`-prop på selve
komponenten (gjør det unaturlig å utelate forklaringen, se filens egen
kommentar) OG skrev om alle fire tekstene til faktisk å forklare hva som
skjer videre — delt inn i `_title`/`_description`-nøkkelpar i stedet for
én sammenslått streng.

### Bygget

- `src/components/EmptyState.tsx` (+ test, + CSS) — tittel, obligatorisk
  forklaring, valgfri handling (`action`, en vilkårlig `ReactNode` — f.eks.
  en knapp). Ingen react-aria-primitiv nødvendig, ren statisk visning.
- Fire i18n-nøkkelpar erstattet (`*.empty` → `*.empty_title` +
  `*.empty_description`) i begge språkfiler, med faktiske
  forklaringer: "Klikk «Ny forespørsel» for å opprette din første. Den
  sendes til moderator for godkjenning før den publiseres.", "Nye
  journalistsøknader vises her når noen søker om en konto.", osv.
- Fire sider oppdatert til å bruke komponenten i stedet for rå `<p>`, med
  den nå ubrukte `.empty`-CSS-klassen fjernet fra hver av deres
  `page.module.css` (ingen død kode liggende igjen).
- **Ingen ny handlingsknapp lagt til i selve `EmptyState`en på
  forespørselslisten** — siden "Ny forespørsel"-knappen allerede alltid
  vises i toppteksten (uavhengig av om listen er tom), ville en ANNEN
  knapp inni selve den tomme tilstanden vært en duplisert, forvirrende
  handling, ikke en forbedring.

### Verifisert ende til ende i en ekte nettleser

Sådd en fersk journalist uten noen forespørsler, i en
produksjonsbygget instans. Bekreftet at den tomme tilstanden faktisk
vises med riktig tittel OG forklaring, korrekt stylet (samme
overflate-/avstandstokens som resten av komponentbiblioteket).
Skjermbilde tatt og sjekket visuelt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**250
tester**, +3 nye), `i18n:check` (**244 nøkler**), `design:check-tokens`
(31 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (41 tester, uendret), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over.

### Neste økt

(1) den store testbarhets-refaktoreringen (`admin/`/`moderation/`-
lib-laget) — se konkret plan to deler tilbake i økten, fortsatt bevisst
utsatt; (2) resten av komponentbiblioteket (Dialog, Toast, Card, Alert,
Tabs, Table, Pagination) — samme "finn en konkret bruker først"-metode
bør gjentas, ingen av de resterende har en like opplagt en ennå; (3)
resten av 16.1-dashbordet; (4) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (5) OG-delingsbilde; (6) det
oversatte-stinavn-hullet (3.7); (7) flere e-postmaler etter behov; (8)
faktisk Brevo-integrasjon når en API-nøkkel finnes; (9) vurder en
`/me`-side og hva som skal skje med de resterende ubrukte
`nav.*`-nøklene (`nav.my_account`/`nav.requests`).

---

## Fortsettelse av økt 7 — `/me`-profilsiden, og fullførte kontosletting-flyten ende til ende

Fortsatte punkt (9) fra forrige "Neste økt" — `nav.my_account` var den
siste ubrukte navigasjonsnøkkelen uten en side å peke til, og
kontosletting (steg 1 av 2, `POST /me/request-deletion`) var allerede
bygget i en tidligere del av natten, men manglet en KNAPP noe sted i
grensesnittet til å faktisk utløse den.

### Bygget: selve profilsiden

- `getMyProfile()` (ny, `src/lib/me/profile.ts`) — `GET /me`
  (API-ruten) returnerer bare de fire øktfeltene (dokumentert i ruten sin
  egen kommentar), ikke visningsnavn/tidssone/e-post/landets navnenøkkel.
  Server-komponenten kaller derfor denne direkte, samme mønster som
  resten av kodebasen. 2 nye integrasjonstester.
- `src/app/[locale]/me/page.tsx` + `ProfileForm.tsx` (visningsnavn,
  språk, tidssone → `PATCH /me`) + `JournalistProfileForm.tsx`
  (fullt navn/stilling/redaksjon/lenke → `PATCH /journalists/me`, kun for
  journalister, gjenbruker `journalist.apply.*`-nøklene i stedet for å
  duplisere dem) + `DeleteAccountSection.tsx`.
- `src/app/[locale]/me/layout.tsx` (ny) — `/me` er nåbar fra ALLE roller,
  i motsetning til `/journalist`/`/admin` som er egne rolle-områder.
  Nav-lenkene bygges derfor per rolle i selve layouten (journalist ser
  "Mine forespørsler", moderator/administrator ser de to
  modereringskøene) i stedet for én fast liste. `nav.my_account`-lenken
  lagt til i alle tre layouter (journalist/admin/me selv).

### Fullførte kontosletting-flyten i stedet for å legge til en halvferdig knapp

`requestAccountDeletion()` (bygget for flere økter siden) sender
`confirm_account_deletion`, men den malen var fortsatt bare et navn uten
innhold — å legge til en "Be om sletting"-knapp NÅ ville gitt brukeren en
e-post uten noen ekte lenke å klikke, samme "halvferdig implementasjon"-
mønster som `journalist_application_received` var før den ble fullført
tidligere i natt. Fullførte i stedet begge gjenstående deler:

- `src/lib/email/templates/confirm-account-deletion.ts` (+ test) — peker
  til `/[locale]/me/slett-konto?token=...`, IKKE
  `GET /api/auth/verify` som magic_link/confirm_email, fordi
  bekreftelsen ikke setter noen cookie (kommentert i filen).
- `src/lib/email/templates/account-deletion-confirmed.ts` (+ test) —
  ingen CTA, samme begrunnelse som `journalist_rejected`.
- `src/app/[locale]/me/slett-konto/page.tsx` +
  `ConfirmDeletionClient.tsx` — leser `?token=` via `useSearchParams()`
  og kaller `POST /me/confirm-deletion` klientside (krever ingen aktiv
  økt — se rutens egen kommentar: tokenet ALENE er autoriteten).
  `useSearchParams()` krever en `<Suspense>`-grense i App Router — uten
  den feiler produksjonsbygget. Fanget selv av `next build` (ikke av
  `tsc`/`eslint`), som forventet.
- `send.ts` utvidet med begge nye malene — `confirm_account_deletion`
  slått sammen i samme switch-gren som `magic_link`/`confirm_email`/
  `journalist_application_received` (alle fire trenger bare `token`).
  Kommentaren øverst oppdatert fra "foreløpig sju" til "foreløpig ni".

### Et ekte, ufarlig avvik oppdaget under nettleserverifisering (ikke rettet, ikke nødvendig)

Testet med `TEST_COUNTRY_CODE` sin fixture-`nameKey`
(`"country.test.name"`), som aldri har hatt en faktisk oversettelse (den
er bare ment for integrasjonstester, ikke for å faktisk vises i en
nettleser). Siden viste `"Land: …"` i stedet for et landnavn —
BEKREFTET at dette er den allerede innebygde, tiltenkte graceful
degradation-mekanismen i `resolveMessage()` (logger en `console.error`
og returnerer `"…"` i stedet for å krasje eller vise en rå nøkkel), ikke
en feil i den nye siden. Ekte land i produksjon (f.eks. `NO`) har en
faktisk oversatt `nameKey` og ville vist riktig navn. Ikke rettet — det
er testfixturen som mangler dekning for et felt den aldri før ble bedt
om å vise, ikke noe produksjonskode trenger.

### Verifisert ende til ende i en ekte nettleser

To separate flyter, begge mot en produksjonsbygget instans: (1) en sådd
journalist besøkte `/me`, redigerte visningsnavn/tidssone og
journalistprofilfeltene, lagret begge deler, og ba om kontosletting —
bekreftet riktig stubb-e-post logget for hvert steg; (2) en sådd
mottaker ba om sletting via et faktisk API-kall, hentet den EKTE
`confirm_account_deletion`-lenken fra loggen, besøkte den i en ekte
nettleser, og fikk "Kontoen din er slettet." — bekreftet UAVHENGIG i
databasen (`psql`) at `status = 'deleted'`, e-posten var hashet, og
visningsnavnet var nullstilt. Skjermbilder tatt og sjekket visuelt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler — fanget og rettet en reell
`react-hooks/exhaustive-deps`-advarsel i `ConfirmDeletionClient.tsx`
underveis, la `searchParams` til avhengighetslisten i stedet for å bare
undertrykke advarselen), `vitest run` (**258 tester**, +8 nye),
`i18n:check` (**283 nøkler**), `design:check-tokens` (34
komponent-CSS-filer), `rm -rf .next && next build`, `test:integration`
mot ekte lokal Postgres (43 tester, uendret), PLUSS begge
ende-til-ende-nettleserverifiseringene beskrevet over.

### Neste økt

(1) den store testbarhets-refaktoreringen (`admin/`/`moderation/`-
lib-laget) — fortsatt bevisst utsatt, se konkret plan tre deler tilbake;
(2) resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination); (3) resten av 16.1-dashbordet; (4) den ubrukte
`"approved"`-verdien i `request_status`-enumen; (5) OG-delingsbilde; (6)
det oversatte-stinavn-hullet (3.7); (7) flere e-postmaler etter behov
(nå 14 gjenstår uten innhold, ned fra 16 — `change-country`-flyten
(SPEC-V1.md 7.3) har ingen UI ennå, bevisst utelatt fra denne økten,
kunne vært punkt (10)); (8) faktisk Brevo-integrasjon når en API-nøkkel
finnes; (9) den siste ubrukte `nav.*`-nøkkelen, `nav.requests` — bevisst
UBRUKT (11: ingen offentlig bla-i-forespørsler-side skal finnes, se
tidligere i økten), vurder om den bør fjernes fra i18n-filene i stedet
for å forbli "ubrukt med vilje" for alltid; (10) UI for
`changeCountry()` (SPEC-V1.md 7.3) — full backend finnes
(`src/lib/me/change-country.ts`), men ingen side, samme mønster som de
andre "backend uten UI"-hullene denne natten fant.

---

## Fortsettelse av økt 7 — UI for `changeCountry()` (SPEC-V1.md 7.3)

Fortsatte punkt (10) fra forrige "Neste økt" — samme "backend uten
UI"-mønster denne natten har funnet gjentatte ganger. Full
forretningslogikk fantes allerede (`src/lib/me/change-country.ts`,
bygget for flere økter siden, med egne integrasjonstester), men ingen
side kalte den.

### Bygget

- `src/app/[locale]/me/bytt-land/page.tsx` (server, kun mottakere —
  7.3 siste avsnitt: journalister kan ikke bytte land selv) +
  `ChangeCountryForm.tsx` — gjenbruker `SubscribeForm.tsx` sitt mønster
  for landvelger→språkvelger (kaskade, nullstiller samtykke ved endring
  av begge deler, 7.1/7.3) og samme lokale
  `interpolateNodes()`-hjelpefunksjon for klikkbare vilkår-/
  personvern-lenker inni oversatt tekst. FORSKJELLEN fra
  `SubscribeForm`: forhåndsvelger brukerens NÅVÆRENDE land/språk (ikke et
  gjettet `Accept-Language`-hint, siden dette er en endring av noe som
  allerede er valgt, ikke en førstegangsregistrering).
- **7.3, punkt 3, eksplisitt vist i selve siden, ikke bare i koden**:
  "Allerede innsendte svar blir liggende hos journalistene som mottok
  dem" — en fast, synlig merknad øverst på siden (`me.change_country
  .responses_notice`), ikke gjemt i en tooltip eller en fotnote. Dette
  er et eksplisitt spec-krav ("Dette opplyses i bekreftelsesdialogen"),
  ikke bare god skikk.
- "Bytt land"-lenke lagt til på `/me`, synlig KUN for mottakere
  (`session.role === "recipient"`), gjenbruker `journalist.apply.*`-
  mønsteret fra i går: gjenbrukte `recipient.register.country_label`/
  `locale_label`/`consent_terms`/`country_placeholder`/
  `locale_placeholder`/`select_country_first` direkte i stedet for å
  duplisere seks nøkler for annen gangs skyld.

### En reell timing-feil i TESTSKRIPTET, ikke i produktet — fanget FØR den ble feilaktig rapportert som en bug

Første forsøk på nettleserverifisering viste landvelgeren som TOM
("Velg et land") i stedet for forhåndsvalgt, rett etter
`waitForLoadState("networkidle")`. Så dette umiddelbart som en mulig
reell feil (kunne vært en race i `useEffect`-en) og undersøkte FØR jeg
konkluderte — la til en lengre eksplisitt ventetid i et oppfølgende
testskript, og forhåndsvalget viste seg da å være der hele tiden. Selve
siden var aldri feil; `networkidle` venter ikke på at en REACT-
tilstandsoppdatering etter en allerede fullført `fetch()` faktisk
rekker å rendre før skjermbildet tas — en egenskap ved testverktøyet,
ikke koden. Notert her fordi samme symptom kan dukke opp igjen i en
senere økt og feilaktig mistenkes som en produktfeil.

### Verifisert ende til ende i en ekte nettleser, uavhengig av UI-teksten

Sådd en mottaker i ett testland med to aktive testland tilgjengelige.
Byttet faktisk land gjennom skjemaet i en produksjonsbygget instans, og
bekreftet UAVHENGIG i databasen (`psql`, ikke bare suksessmeldingen på
skjermen): `users.country_code`/`locale` faktisk endret til det nye
landet, OG to nye `ConsentRecord`-rader (`terms`/`privacy`,
`source = 'country_change'`, `granted = true`) faktisk opprettet.
Skjermbilder tatt og sjekket visuelt (korrekt forhåndsvalg, korrekt
samtykketekst med klikkbare lenker).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**258
tester**, uendret — ingen ny ren logikk å isolere, all ny kode er
UI som allerede gjenbruker testet biblioteklogikk), `i18n:check` (**299
nøkler**), `design:check-tokens` (36 komponent-CSS-filer),
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(43 tester, uendret), PLUSS ende-til-ende-nettleserverifiseringen
beskrevet over.

### Neste økt

(1) den store testbarhets-refaktoreringen (`admin/`/`moderation/`-
lib-laget) — fortsatt bevisst utsatt; (2) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (3) resten av
16.1-dashbordet; (4) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (5) OG-delingsbilde; (6) det
oversatte-stinavn-hullet (3.7); (7) flere e-postmaler etter behov (nå 13
gjenstår); (8) faktisk Brevo-integrasjon når en API-nøkkel finnes; (9)
den siste ubrukte `nav.*`-nøkkelen, `nav.requests` — vurder fjerning;
(10) alle "backend uten UI"-hullene denne natten har funnet er nå
lukket (registrering, forespørsler, moderasjon, svarinnboks, profil,
kontosletting, landbytte) — en god anledning i neste økt til å gjøre et
raskt overblikk over HELE `src/app/api/`-treet mot `src/app/[locale]/`
for å se om det finnes flere gjenværende "ruten finnes, siden gjør
det ikke"-hull av samme type før man går videre til andre kategorier
arbeid.

---

## Fortsettelse av økt 7 — respondentens svaroversikt + hele kontaktforespørsel-flyten (SPEC-V1.md 12.6, 14), det siste store "backend uten UI"-hullet

Fulgte forrige del av øktens eget forslag (punkt 10): et raskt overblikk
over `src/app/api/` mot `src/app/[locale]/` FØR neste kategori arbeid.
Fant det klart største gjenværende hullet: HELE respondentens
("mottakerens") egen oversikt over innsendte svar og videre kontakt
(SPEC-V1.md 14) manglet UI fullstendig — `GET /responses/mine`,
`POST /responses/:id/withdraw`, `GET /contact-requests/:id`,
`POST /contact-requests/:id/approve|decline` fantes alle, men ingen side
kalte noen av dem. En egen, ubrukt funksjon (`getRespondentView()` i
`responses.ts`) sto der som et tegn på nøyaktig dette — skrevet for en
side som aldri ble bygget.

### Et reelt spec-hull funnet FØR bygging, ikke gjettet under veis

Fire i18n-nøkler (`response.status.submitted/viewed/contact_requested/
not_selected`) har ligget klare siden økt 1, tydelig ment for nøyaktig
denne siden — men INGEN del av spec-en beskrev innholdet i den. Søkte
eksplisitt etter en "respondentens egen svarliste"-seksjon og fant
ingen. Rettet spec-en FØRST (regelen: "spec-en er sannheten... rett
spec-en først, deretter koden"): la til en ny **12.6 "Respondentens
oversikt over egne svar"** i `SPEC-V1.md`, som formaliserer nøyaktig det
de fire eksisterende nøklene allerede antydet — inkludert en eksplisitt
PRIORITERINGSREKKEFØLGE for når flere utledede statuser er sanne
samtidig (`not_selected` > `contact_requested` > `viewed` > `submitted`,
den mest informative vinner), siden dette ikke kan utledes fra
nøklene alene.

### Bygget

- `listMineResponses()` (`responses.ts`) utvidet fra et rått felt-sett
  til å returnere en UTLEDET `displayStatus` (per 12.6 sin
  prioriteringsregel) og `canWithdraw` (om den underliggende
  forespørselen fortsatt er `published`) — ikke bare et tynnere
  api-object. 4 nye integrasjonstester som dekker alle fire
  prioriteringskombinasjonene.
- `src/app/[locale]/me/svar/page.tsx` + `MyResponsesList.tsx` — listen,
  med `Badge` for utledet status og en "Trekk svaret"-knapp der
  `canWithdraw`. Fanget en reell React-antimønster-feil FØR den ble
  committet: skrev først en komponent DEFINERT INNI en annen
  komponent-funksjon (ny type ved hver rendring, ville mistet
  tilstand/remountet ved enhver forelder-rerendering) — flyttet
  `ResponseListItem` ut til modulnivå før commit.
- `src/app/[locale]/contact-requests/[id]/page.tsx` +
  `ContactRequestActions.tsx` — ÉN side for BEGGE partene (journalisten
  som sendte forespørselen, OG respondenten den gjelder), siden
  `getContactRequestDetail()` allerede håndhever hvem som ser hva
  (bl.a. skjuler `shared_email` for journalisten før godkjenning).
  Godkjenn-/avslå-knapper vises KUN for respondenten når status er
  `pending`.
- Tre nye e-postmaler (`contact_request_received`, `contact_approved`,
  `contact_declined`) — `createContactRequest()` (`contact-requests.ts`)
  utvidet til å hente journalistnavn/redaksjon/forespørselstittel (én
  ekstra join) for at e-posten faktisk skal si HVEM som ber om kontakt
  og OM HVA, ikke bare en generisk varsling. `contact_approved` peker
  til SAMME kontaktforespørsel-side (der journalisten kan se den delte
  e-postadressen), i stedet for å legge selve adressen rått i
  e-postteksten. `contact_declined` har bevisst ingen data og ingen CTA
  (14.2, ordrett: "uten begrunnelse").
- `src/lib/responses/status-badge.ts` og
  `src/lib/contact-requests/status-badge.ts` (nye, små filer) — samme
  ett-sted-for-fargetilordning-prinsipp (DESIGN.md 6.2) som
  `requests/status-badge.ts` fra tidligere i natt.

### En akseptert forenkling, ikke en feil — notert eksplisitt

Etter at en kontaktforespørsel er BESVART (godkjent/avslått),
viser `/me/svar` fortsatt `displayStatus = "contact_requested"` for det
svaret — `listMineResponses()` sjekker bare at en kontaktforespørsel
FINNES, ikke dens nåværende status. Selve kontaktforespørsel-siden viser
riktig, oppdatert status (`Godkjent`/`Avslått`); listen viser bare at
"noe skjedde her". Vurdert bevisst som god nok for v1 fremfor å innføre
enda flere utledede statuser (`contact_approved`/`contact_declined`
som EGNE `displayStatus`-verdier) — ikke lagt til 12.6 i spec-en heller,
siden det ville vært en gjetning uten en klar begrunnelse. Notert her
for en fremtidig økt å vurdere, ikke glemt.

### Verifisert ende til ende i en ekte nettleser, uavhengig av UI-teksten

Sådd en journalist med en publisert forespørsel og en respondent med et
innsendt svar (`contactSharing: none`). Sendte en faktisk
kontaktforespørsel via API-et, hentet den EKTE lenken fra
`contact_request_received`-loggen, besøkte `/me/svar` (viste riktig
"Forespørsel om videre kontakt"-status), åpnet kontaktforespørsel-siden
som respondent (viste melding, kontaktform, utløpsdato, riktige
knapper), godkjente den — og besøkte SAMME side som journalisten
etterpå, som nå viste "Godkjent" og den delte e-postadressen. Bekreftet
UAVHENGIG i databasen at `contact_requests.status = 'approved'` og
`shared_email` faktisk var satt. Skjermbilder tatt og sjekket visuelt
for begge roller.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**274
tester**, +16 nye), `i18n:check` (**326 nøkler**), `design:check-tokens`
(38 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (47 tester, +4 nye), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over (begge roller).

## Fortsettelse av økt 7 — lukkeknapp for journalisten, og et reelt "manglende varsel"-hull rettet

Startet på "flere e-postmaler etter behov" fra forrige "Neste økt". Av de
10 gjenstående malene i `TransactionalTemplate` (`send.ts`) hadde
`request_closed` ("Forespørsel lukket | journalist", SPEC-V1.md 15) NULL
kallere noe sted i kodebasen — verken `closeRequest()` (eier- ELLER
moderator-/administratorlukking, samme funksjon for begge ruter) sendte
den. Dette er et reelt hull (spec-en lister raden, koden manglet den),
ikke en ny beslutning — rettet i `closeRequest()` selv, ETT sted, siden
begge rutene (`/requests/:id/close` og `/admin/requests/:id/close`)
allerede går gjennom den.

Underveis i å bygge `stale_request_reminder_30d` (som SPEC-V1.md 9.2
krever skal ha "lenke til å lukke den") ble et ANNET, større hull
oppdaget: journalistens egen forespørselsside
(`/journalist/requests/[id]`) hadde ingen lukkeknapp i det hele tatt for
en publisert forespørsel, til tross for at `closeRequest()` og BEGGE
API-rutene alltid har fungert. Moderator/administrator kunne altså
lukke enhver forespørsel, men journalisten selv hadde ingen
selvbetjent vei til det samme — konsistent med denne øktens
gjennomgående prinsipp om å aldri sende en e-post-CTA som peker på noe
som ikke finnes, ble knappen bygget FØR e-postmalen som lenker til den.

Lagt til:
- `CloseRequestAction.tsx` — klientkomponent i samme mønster som
  `ContactRequestActions.tsx` (samme fil-plassering, samme
  `useState`/`router.refresh()`-oppskrift), men med ett ekstra
  bekreftelsessteg (`variant="danger"` + `variant="ghost"`) siden
  lukking er irreversibelt (fører bl.a. til at ventende
  kontaktforespørsler utløper umiddelbart). Vist på
  `/journalist/requests/[id]` kun når `status === "published"`.
- Fem nye `journalist.requests.close_*`-nøkler (begge locales).
- `.actions`-klasse i `page.module.css` (samme oppskrift som
  `contact-requests/[id]/page.module.css`).
- `renderRequestClosedEmail()` (`templates/request-closed.ts`) + test +
  fire `email.request_closed.*`-nøkler (begge locales) + wiret inn i
  `send.ts` (trettende ekte mal, ti gjenstår).
- I `closeRequest()`: etter at forespørselen er satt til `closed` og
  ventende kontaktforespørsler er utløpt, slås journalistens
  e-post/locale opp og `request_closed` sendes — uansett hvem som
  faktisk utførte lukkingen, siden spec-raden ikke skiller mellom disse.

### Verifisert ende til ende i en ekte nettleser

Sådd en journalist med én PUBLISERT forespørsel direkte i databasen
(ingen fixture-hjelper fantes for dette, satt inn rått). Besøkte
siden — viste "Åpen"-badge og "Lukk forespørselen"-knappen. Klikket
den — viste bekreftelsesraden ("Ja, lukk forespørselen" / "Avbryt").
Bekreftet — badgen ble umiddelbart "Lukket" (via `router.refresh()`,
samme oppførsel som `ContactRequestActions` — komponentens egen
"lukket"-tekst rekker aldri å vises lenge før forelderen fjerner den
fra treet, siden `status === "published"`-betingelsen ikke lenger er
sann; dette er IKKE en feil, men samme etablerte mønster som
`ContactRequestActions` allerede bruker). Lastet siden på nytt — status
forble "Lukket". Bekreftet i serverloggen at `request_closed` faktisk
ble sendt, med riktig tittel og lenke til journalistens egen side.
Skjermbilder tatt og sjekket visuelt.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**276
tester**, +2 nye), `i18n:check` (**335 nøkler**), `design:check-tokens`
(38 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (47 tester, uendret — ingen
nye integrasjonstester denne runden, men eksisterende `closeRequest`-
tester bekreftet at den nye e-postutsendelsen ikke brøt noe), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over.

### Neste økt

(1) fortsett med de resterende 9 e-postmalene (nå bygget:
`request_closed` — 13 av 23. Gjenstår: `request_approved_published`,
`changes_requested`, `request_rejected`, `deadline_approaching_24h`,
`stale_request_reminder_30d`, `response_request_closed` (allerede har
en kaller i `account-deletion.ts`, se `notifyJournalist`-mønsteret),
`contact_request_cancelled_account_deleted`,
`legal_terms_material_change`, `new_request_for_moderation` (allerede
har en kaller i `submitRequest()`), `content_reported` (allerede har en
kaller i `reports.ts`)); husk å utvide `findSubmitted()` i
`moderation/requests.ts` med `slug`/`title` for
`request_approved_published`, og `runDeadlineReminders()`/
`runStaleRequestReminders()` i `tick.ts` med `title`; oppdater
`send.test.ts`s fallback-test til en genuint ubygget mal når
`request_approved_published` er bygget; (2) vurder om
`contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6 — ikke en feil, men en reell
forbedringsmulighet; (3) den store testbarhets-refaktoreringen
(`admin/`/`moderation/`-lib-laget) — fortsatt bevisst utsatt; (4)
resten av komponentbiblioteket (Dialog, Toast, Card, Alert, Tabs,
Table, Pagination); (5) resten av 16.1-dashbordet; (6) den ubrukte
`"approved"`-verdien i `request_status`-enumen; (7) OG-delingsbilde;
(8) det oversatte-stinavn-hullet (3.7); (9) faktisk Brevo-integrasjon
når en API-nøkkel finnes; (10) den siste ubrukte `nav.*`-nøkkelen,
`nav.requests`.

## Fortsettelse av økt 7 — seks e-postmaler til (nitten av tjuetre), pluss to reelle hull rettet underveis

Bygget de seks neste malene fra forrige "Neste økt": `request_approved_published`,
`changes_requested`, `request_rejected` (alle tre i
`src/lib/moderation/requests.ts`, samme fil som `notifyJournalist()`-
helperen), `deadline_approaching_24h`/`stale_request_reminder_30d`
(begge i `runDeadlineReminders()`/`runStaleRequestReminders()`,
`src/lib/jobs/tick.ts`), og `response_request_closed`
(`closeJournalistContentOnDeletion()`, `src/lib/auth/account-deletion.ts`).
Utvidet `findSubmitted()` med `slug`/`title`, og begge tick-jobbene med
`title`, slik at malene har reelt innhold å vise, ikke bare en ID.
`send.test.ts`s fallback-test flyttet til `legal_terms_material_change`
(den eneste ennå ubygde malen jeg er sikker vil forbli det en stund —
se under). 19 av 23 maler i `TransactionalTemplate` har nå ekte
innhold.

To reelle hull oppdaget og rettet underveis, ingen av dem nye
beslutninger:

- **`new_response_received` lenket til feil side.** Kommentaren over
  denne malen sa eksplisitt "midlertidig destinasjon... oppdater denne
  lenken til den faktiske innboksen den dagen den finnes" —
  svarinnboksen (`/journalist/requests/:id/responses`, SPEC-V1.md 13)
  har eksistert siden en tidligere økt, men lenken var aldri
  oppdatert. Rettet: lenker nå til innboksen, ikke forespørselens
  offentlige side. `requestSlug` er dermed ikke lenger nødvendig for
  denne malen (fortsatt påkrevd for `response_submitted_receipt`, som
  IKKE kan lenke til journalistens innboks — respondenten er ikke
  journalisten).
- **Kontosletting lukket forespørsler UTEN å utløpe ventende
  kontaktforespørsler.** `closeJournalistContentOnDeletion()`
  (17.5, sist avsnitt) dupliserer `closeRequest()`s `published →
  closed`-overgang direkte i stedet for å kalle den — og manglet
  dermed 14.3-regelen ("utløper... når forespørselen lukkes") som ble
  lagt til `closeRequest()` i en tidligere økt. Rettet ved å kopiere
  samme utløps-spørring inn i kontosletting-stien.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**288
tester**, +12 nye), `i18n:check` (**358 nøkler**), `design:check-tokens`
(38 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (47 tester, uendret — ingen
regresjon fra `new_response_received`-lenkeendringen eller
kontosletting-rettelsen). `moderation/requests.ts`, `tick.ts`s
jobbfunksjoner og `account-deletion.ts` har fortsatt INGEN egen
test-dekning (verken enhets- eller integrasjonstester) — samme
pre-eksisterende testbarhetshull som (2) i forrige "Neste økt", ikke
noe jeg har forverret. `requireModeratorForCountry()` (og dermed
`publishRequest()`/`rejectRequest()`/`requestChanges()`) er avhengig av
`getCurrentSession()`s request-skopede cookie-kontekst og kan derfor
ikke enkelt kalles fra et frittstående skript — bekrefter hvorfor denne
testbarhets-refaktoreringen er en egen, større oppgave, ikke noe som
kan gjøres i forbifarten her.

### Neste økt

(1) fire maler gjenstår: `contact_request_cancelled_account_deleted`,
`legal_terms_material_change`, `new_request_for_moderation` (allerede
har en kaller i `submitRequest()`, `src/lib/requests/requests.ts`),
`content_reported` (allerede har en kaller i `reports.ts`) — sjekk
særlig om `legal_terms_material_change`s kallende funksjonalitet
(varsel ved vesentlig endring i vilkår/personvernerklæring) faktisk er
bygget ennå, eller om den selv er et "backend uten UI"-hull; oppdater
`send.test.ts`s fallback-test igjen når `legal_terms_material_change`
bygges; (2) den store testbarhets-refaktoreringen
(`admin/`/`moderation/`-lib-laget, pluss nå bekreftet `tick.ts` og
`account-deletion.ts`) — fortsatt bevisst utsatt, men voksende i omfang;
(3) vurder om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde; (8) det
oversatte-stinavn-hullet (3.7); (9) faktisk Brevo-integrasjon når en
API-nøkkel finnes; (10) den siste ubrukte `nav.*`-nøkkelen,
`nav.requests`.

## Fortsettelse av økt 7 — de fire siste e-postmalene: ALLE 23 i SPEC-V1.md 15 er nå bygget

Bygget `new_request_for_moderation` og `content_reported` (begge hadde
allerede fungerende kallere fra tidligere økter — `submitRequest()` i
`src/lib/requests/requests.ts`, og `submitReport()` i
`src/lib/reports/reports.ts` — lagt til `title` i førstnevntes data),
pluss `contact_request_cancelled_account_deleted` og
`legal_terms_material_change`. Sistnevntes kallende funksjonalitet
(`publishLegalDocument()`, `src/lib/admin/legal-documents.ts`) viste
seg IKKE å være et hull — hele varslingslogikken for "vesentlig
endring i vilkår/personvernerklæring" (17.2) var allerede fullt bygget
i en tidligere økt, komplett med en grundig dokumentert avgrensning av
hva som bevisst IKKE er bygget (tvungen re-samtykke-UX, se kommentaren
i filen). La til `countryCode` i dataene den sender med, slik at malen
kan lenke til dokumentets faktiske offentlige side
(`/[locale]/legal/[country]/[docLocale]/[type]`), og droppet `version`
fra dataene (ikke meningsfullt for en mottaker å se en rå
versjonsstreng — lenken til å LESE dokumentet er det som betyr noe).

`send.test.ts`s "faller tilbake for en ubygget mal"-test er fjernet —
det finnes ingen ubygget mal igjen å demonstrere den med. Erstattet med
en test av det samme fallback-prinsippet på `legal_terms_material_change`
selv (ugyldige/manglende felt), pluss en ny positiv test for at malen
faktisk rendrer, og én for `request_closed` (som aldri fikk en egen
`send.test.ts`-test i sin egen økt). `renderTransactionalEmail()`s
doc-kommentar oppdatert til å si rett ut at alle 23 er bygget, i stedet
for å telle ned et gjenværende antall.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**301
tester**, +13 nye), `i18n:check` (**374 nøkler**), `design:check-tokens`
(38 komponent-CSS-filer), `rm -rf .next && next build`,
`test:integration` mot ekte lokal Postgres (47 tester, uendret — ingen
regresjon fra `legal-documents.ts`s endrede data-payload).

### Neste økt

Alle 23 e-postmaler i SPEC-V1.md 15 er nå bygget — dette er IKKE lenger
et punkt på denne listen. Gjenstående, i grov prioritert rekkefølge:
(1) faktisk Brevo-integrasjon når en API-nøkkel finnes — naturlig neste
steg nå som alle malene finnes å koble til; (2) den store
testbarhets-refaktoreringen (`admin/`/`moderation/`-lib-laget, pluss
`tick.ts`s jobbfunksjoner og `account-deletion.ts`) — fortsatt bevisst
utsatt, men det klart største gjenværende hullet i test-dekning; (3)
vurder om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde; (8) det
oversatte-stinavn-hullet (3.7); (9) den siste ubrukte `nav.*`-nøkkelen,
`nav.requests`.

## Fortsettelse av økt 7 — det oversatte-stinavn-hullet (3.7) endelig lukket

Tok fatt på punkt (8) fra forrige "Neste økt" — utsatt i over 15 økter med
begrunnelsen "når locale nummer to faktisk tilbys". Sjekket: `en-GB` ER
allerede en fullt tilbudt locale (i `SUPPORTED_LOCALES`, full
i18n-nøkkelparitet, alle 23 e-postmaler bygget i begge, `LanguageSwitcher`
lar brukeren bytte) — begrunnelsen for å utsette var blitt utdatert uten at
noen hadde fanget det opp. SPEC-V1.md 3.7 er eksplisitt:
`/nb-NO/foresporsler/:id/slug` vs `/en-GB/requests/:id/slug` — koden
serverte til nå `foresporsler` under BEGGE locales, og hreflang-alternatene
i `generateMetadata()` pekte feilaktig på samme nb-NO-ord for alle locales
(selve 3.7-bugen, ikke bare en kosmetisk detalj).

**Løsning:** ingen duplisering av rutefiler. Ny modul
`src/i18n/localized-paths.ts` — en per-locale oversettelsestabell for to
segmenter (`requests`→`foresporsler`/`requests`, `respond`→`svar`/
`respond`, sistnevnte en antagelse siden 3.7s eksempel bare viser
toppsegmentet, konsistent med den eksisterende `request.respond_button`-
teksten), pluss `requestDetailPath()`/`requestRespondPath()` for utgående
lenker og en ren, enhetstestet `resolveLocalizedRequestPath()` for
innkommende ruting. `middleware.ts` bruker denne til å:
- **rewrite** (URL uendret) når en-GB sitt eget, riktige ord (`requests`)
  brukes, men det faktiske mappenavnet (`foresporsler`, nb-NO sitt ord —
  var v1s eneste locale da mappen ble navngitt) er noe annet;
- **redirect (308)** når FEIL locales ord brukes (`/en-GB/foresporsler/...`
  eller `/nb-NO/requests/...`) — 3.7 krever nøyaktig én kanonisk URL per
  locale-variant, så duplikat-tilgjengelighet under to ord skal ikke bestå.

Rettet ALLE stedene som bygget `/foresporsler/`-lenker hardkodet: siden sin
egen `generateMetadata()` (canonical + hreflang — selve bugen),
stale-slug-redirecten, "Svar"-knappen, `journalist/requests/page.tsx`s
"Se forespørselen"-lenke, `digest.ts`, og de tre e-postmalene som lenker
til den offentlige siden (`request_approved_published`,
`response_submitted_receipt`, `response_request_closed`).

### Verifisert ende til ende i en ekte nettleser/server

Sådd en publisert forespørsel direkte i databasen. Startet
produksjonsbygget og testet via `curl` (statuskoder/redirect-mål, ikke
bare enhetstester av den rene logikken):
- `/nb-NO/foresporsler/:id/:slug` → 200, uendret (nb-NO sitt eget ord er
  allerede det faktiske mappenavnet).
- `/en-GB/requests/:id/:slug` → 200 via intern rewrite, URL i adresselinjen
  uendret, canonical-taggen sier nøyaktig denne URL-en, hreflang-alternatet
  for `nb-NO` peker på `/nb-NO/foresporsler/...` (IKKE på `requests`),
  "Respond"-knappen lenker til `/en-GB/requests/:id/respond`.
- `/en-GB/foresporsler/:id/:slug` (feil ord) → 308 til `/en-GB/requests/...`.
- `/nb-NO/requests/:id/:slug` (feil ord) → 308 til `/nb-NO/foresporsler/...`.
- `/en-GB/requests/:id/respond` (rewrite-mål for svarskjemaet) → 200,
  viser innloggingsoppfordringen korrekt.
- En utdatert/feil slug under `/en-GB/requests/...` → 307 til riktig slug,
  MED en-GB sitt eget ord bevart (ikke tilbake til `foresporsler`).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, +29 nye — 20 for `localized-paths.ts`, 4 for `middleware.ts`
(begge filene hadde INGEN test-dekning fra før), pluss 5 nye
locale-spesifikke tester i eksisterende e-postmal-/digest-tester),
`i18n:check` (**374 nøkler**, uendret — ingen nye tekster, bare ren
rutelogikk), `design:check-tokens` (38 komponent-CSS-filer),
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(47 tester, uendret), PLUSS ende-til-ende-serververifiseringen beskrevet
over.

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) den store
testbarhets-refaktoreringen (`admin/`/`moderation/`-lib-laget,
`tick.ts`s jobbfunksjoner, `account-deletion.ts`) — fortsatt bevisst
utsatt, det klart største gjenværende hullet i test-dekning; (3) vurder
om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde; (8) den siste ubrukte
`nav.*`-nøkkelen, `nav.requests`.

## Fortsettelse av økt 7 — fjernet den siste ubrukte `nav.*`-nøkkelen

Punkt (8) fra forrige "Neste økt". Bekreftet via grep at `nav.requests`
har NULL faktiske `t("nav.requests")`-kall noe sted i kodebasen — kun
nevnt i en kommentar i `SiteHeader.tsx`. Journalistens/moderatorens egne
lenker til sine forespørselslister bruker mer presise, allerede
eksisterende nøkler (`journalist.requests.title` — "Mine forespørsler" —
satt av hver kallende layout), og ingen offentlig "bla i
forespørsler"-side finnes eller skal finnes (11: oppdagelse skjer kun via
digesten). Fjernet nøkkelen fra begge locale-filene.

Rettet samtidig en annen, mindre staleness i samme kommentar: den påsto
fortsatt at "ingen `/me`-side er bygget ennå" — det er den, og har vært
det siden en tidligere økt (`nav.my_account` brukes faktisk, fra
`journalist/layout.tsx`/`admin/layout.tsx`). Presisert kommentaren til å
forklare HVORFOR `nav.requests` ble fjernet, i stedet for å liste to
"ennå ikke bygget"-grunner der bare én fortsatt stemte.

Merk: `i18n:check-keys.ts` fanger BARE nøkler brukt i kode som mangler i
nb-NO — den flagger aldri ubrukte nøkler (FR-012s formål er strengt
"manglende", ikke "ubrukt"). Denne typen opprydding må fortsatt gjøres
manuelt (grep), ikke noe verktøyet gjør automatisk.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, uendret — ingen ny testbar atferd, bare fjernet en ubrukt
tekst), `i18n:check` (uendret antall brukte nøkler, som forventet —
scriptet teller bruk i kode, ikke nøkler i JSON-filen), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(47 tester, uendret).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) den store
testbarhets-refaktoreringen (`admin/`/`moderation/`-lib-laget,
`tick.ts`s jobbfunksjoner, `account-deletion.ts`) — fortsatt bevisst
utsatt, det klart største gjenværende hullet i test-dekning; (3) vurder
om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde.

## Fortsettelse av økt 7 — laveste-risiko-skiven av testbarhets-refaktoreringen: `tick.ts`s jobbfunksjoner

Tok fatt på punkt (2), men bevisst BARE den tryggeste delen av det —
ikke hele `admin/`/`moderation/`-lib-laget. `tick.ts`s fem jobbfunksjoner
(`runExpireRequests`, `runExpireContactRequests`, `runDeadlineReminders`,
`runStaleRequestReminders`, `runPurgeUnverified`) har INGEN
sesjon/cookie-avhengighet i det hele tatt — de tar `Database` som et
eksplisitt parameter og gjør bare lesing/skriving mot den. Grunnen til at
de likevel hadde null test-dekning var noe helt annet og langt
enklere å rette: de var ikke eksportert. Bare `runTick()` (hele
orkestratoren, som kjører ALLE jobbene sammen og i tillegg styres av
`shouldRunDailyJobNow()`s vegg-klokke-avhengighet for de daglige jobbene)
var tilgjengelig utenfra — upraktisk å teste deterministisk.

Løsning: la til `export` foran alle fem (ZERO atferdsendring, ren
synlighetsendring), og skrev `tick.integration.test.ts` (13 nye tester)
mot ekte Postgres — dekker både "skjer riktig ting" (forespørsel
utløper/lukkes, kontaktforespørsel utløper, påminnelse sendes og
idempotens-flagget settes, ubekreftet konto slettes) og "skjer riktig
IKKE" (fremtidig frist rører ingenting, allerede sendt påminnelse sendes
ikke på nytt, en aktiv/bekreftet konto slettes ALDRI selv om den er
gammel).

Én reell fallgruve underveis: `responses`/`contact_requests` har INGEN
`ON DELETE CASCADE` mot `requests` (bevisst, se schema.ts) — et første
utkast som ryddet opp ved å slette `requests`-raden direkte feilet på en
fremmednøkkel-konflikt siden svaret fortsatt refererte til den. Rettet
til å rydde i riktig avhengighetsrekkefølge (`contact_requests` →
`responses` → `requests`).

Presisering, ikke en ny beslutning: dette lukker BARE `tick.ts`s del av
gapet. `moderation/requests.ts` (`publishRequest()`/`rejectRequest()`/
`requestChanges()`) og `account-deletion.ts` er fortsatt utestet — begge
kaller `requireModeratorForCountry()`/`requireAdmin()` internt, som
begge leser `getCurrentSession()` (en `next/headers`-cookie), en ekte
sesjonsavhengighet som IKKE kan løses med bare et `export`-nøkkelord.
Det trenger enten `vi.mock("next/headers")` i testene (ingen
produksjonskode-endring, men mer testoppsett) eller en faktisk endring
av kallekonvensjonen (aktøren injisert som parameter, slik
`closeRequest(requestId, actorUserId)` allerede gjør) — sistnevnte er
den ekte, fortsatt bevisst utsatte refaktoreringen, siden den er en
reell endring i et sikkerhetssensitivt autorisasjonslag.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, uendret — kun integrasjonstester lagt til, som ikke kjøres
her per design), `i18n:check` (uendret), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(**60 tester**, +13 nye — alle grønne, ingen regresjon).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) resten av
testbarhets-refaktoreringen — `moderation/requests.ts` og
`account-deletion.ts`, som begge KREVER enten `vi.mock("next/headers")`
i testene eller en ekte endring av kallekonvensjonen (aktøren injisert
som parameter, se drøftingen over) — fortsatt den klart mest
sikkerhetssensitive og derfor mest forsiktig-utsatte delen; (3) vurder
om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde.

## Fortsettelse av økt 7 — det STRUKTURELLE hinderet for `vi.mock("next/headers")` funnet og løst, pluss ekte test-dekning for `moderation/requests.ts` OG `account-deletion.ts`

Startet på punkt (2) — `vi.mock("next/headers")`-tilnærmingen antatt
mulig forrige økt. Viste seg å IKKE fungere i det hele tatt, av en helt
annen grunn enn selve mockingen: `src/lib/auth/session.ts` (og alt som
importerer den) har `import "server-only"` øverst, en pakke som kaster
en feil med mindre bunteren setter `"react-server"`-eksportbetingelsen.
Vite/Vitest setter den IKKE som standard, så ENHVER test som (transitivt)
importerer `session.ts` feilet umiddelbart med "This module cannot be
imported from a Client Component module" — uavhengig av om
`next/headers` var mocket eller ei. Bekreftet med et minimalt
reproduksjonstilfelle (en fil som BARE importerer `getCurrentSession`,
ingen mocking) — samme feil. Dette er trolig den EKTE, strukturelle
grunnen til at "testbarhets-refaktoreringen" har blitt vurdert som
risikabel/stor i så mange tidligere økter: ingen sesjonsavhengig kode
har noensinne latt seg importere i en test, uansett tilnærming.

**Løsning:** `server-only` sin egen pakke inneholder allerede en tom
`empty.js` (nøyaktig filen `"react-server"`-betingelsen ville gitt).
Lagt til én linje i `vitest.integration.config.ts` sin `resolve.alias`
som peker `"server-only"` dit — KUN for test-konfigurasjonen, rører
ikke `next.config.mjs` eller noe som faktisk bygges/deployes, så
garantien `server-only` gir i PRODUKSJON (at modulen ikke kan havne i en
klientbunt) er fullstendig uendret. Dette er en vanlig, anerkjent
tilnærming for å teste Next.js-serverkode med Vitest, ikke en
hemmelighetsfull hack.

Med hinderet borte, la til:
- `src/lib/moderation/requests.integration.test.ts` (9 tester) — mocker
  `next/headers` for å simulere en innlogget moderator/administrator/
  journalist via en EKTE `sessions`-rad (ekte rå token, ekte hash), bare
  selve cookie-oppslaget er stanget ut. Dekker `publishRequest()`/
  `rejectRequest()`/`requestChanges()`: happy path + e-postvarsling,
  landbegrensning (4: en moderator tildelt et ANNET land nektes), rolle
  (en journalist nektes), FR-029 (en sjette samtidig publisert
  forespørsel nektes), og at en administrator kan handle uansett land
  (19.4).
- `src/lib/auth/account-deletion.integration.test.ts` (8 tester) — viste
  seg IKKE å trenge NOEN mocking i det hele tatt:
  `requestAccountDeletion(userId)`/`confirmAccountDeletion(rawToken)` tar
  begge eksplisitte parametere og har ALDRI kalt `getCurrentSession()` —
  samme kategori som `tick.ts`s jobbfunksjoner (null test-dekning bare
  fordi ingen hadde skrevet testfilen, ikke fordi det var vanskelig).
  Dekker tokenvalidering (ikke-eksisterende/brukt/utløpt), MOTTAKER-
  sletting (anonymiserer svar, kansellerer ventende
  kontaktforespørsler MED varsel til journalisten, avslutter økter,
  avmelder e-post, hasher e-postadressen, revisjonslogg), og
  JOURNALIST-sletting (lukker publiserte forespørsler, utløper
  TILHØRENDE ventende kontaktforespørsler — samme 14.3-regel som ble
  lagt til `closeJournalistContentOnDeletion()` tidligere denne økten —
  og varsler respondentene).

Dette lukker BEGGE de navngitte, sikkerhetssensitive filene fra forrige
"Neste økt". Fem filer i `admin/`/`moderation/`
(`countries.ts`/`legal-documents.ts`/`responses.ts` i `admin/`,
`journalists.ts`/`users.ts` i `moderation/`) har fortsatt null
test-dekning — men hinderet som gjorde DEM vanskelige å teste er nå
også borte (samme `server-only`-problem), så dette er nå et spørsmål om
tid, ikke lenger et strukturelt "kan ikke".

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler, én ubrukt import rettet
underveis), `vitest run` (**329 tester**, uendret — kun
integrasjonstester og en test-konfigurasjonsendring), `i18n:check`
(uendret), `design:check-tokens`, `rm -rf .next && next build`
(bekrefter at `vitest.integration.config.ts`-endringen ikke påvirker det
faktiske Next.js-bygget), `test:integration` mot ekte lokal Postgres
(**77 tester**, +17 nye — alle grønne, ingen regresjon).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) de fem
gjenværende utestede filene i `admin/`/`moderation/`
(`countries.ts`/`legal-documents.ts`/`responses.ts`,
`journalists.ts`/`users.ts`) — samme `vi.mock("next/headers")`-mønster
som nå er bevist å fungere, ikke lenger blokkert strukturelt; (3) vurder
om `contact_approved`/`contact_declined` bør bli egne
`displayStatus`-verdier i 12.6; (4) resten av komponentbiblioteket
(Dialog, Toast, Card, Alert, Tabs, Table, Pagination); (5) resten av
16.1-dashbordet; (6) den ubrukte `"approved"`-verdien i
`request_status`-enumen; (7) OG-delingsbilde.

## Fortsettelse av økt 7 — `moderation/journalists.ts` og `moderation/users.ts` også dekket

Fortsatte rett på punkt (2) fra forrige "Neste økt" mens mønsteret var
ferskt. Begge filene har nøyaktig samme form som `moderation/requests.ts`
(session-gated via `requireModeratorForCountry()`), så samme
`vi.mock("next/headers")`-oppskrift ble gjenbrukt uten videre
tilpasning:

- `moderation/journalists.integration.test.ts` (5 tester) —
  `approveJournalist()`/`rejectJournalist()`: happy path + e-postvarsling
  (godkjenning OG avvisning, sistnevnte med begrunnelsen satt inn
  uoversatt), landbegrensning, administrator-unntaket (19.4).
- `moderation/users.integration.test.ts` (8 tester) —
  `suspendUser()`/`unsuspendUser()`: begrunnelse påkrevd, faktisk
  statusendring, økter avsluttes, journalistens EGNE ventende
  kontaktforespørsler kanselleres (8.1) — men IKKE andres, idempotens
  ved gjentatt suspensjon, landbegrensning, og at
  `verification_status` IKKE røres ved oppheving av suspensjon (8.1,
  siste avsnitt — presist det spec-sitatet sier).

Gjenstår nå kun de tre filene i `admin/` (`countries.ts`,
`legal-documents.ts`, `responses.ts`) — samme bevist fungerende mønster,
men disse er ikke gjennomgått i detalj ennå denne økten (landkonfigurasjon
og enkeltsvar-begrunnelseslisten fra 16.1 kan ha egne særtrekk å sjekke
først).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, uendret), `i18n:check` (uendret), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(**90 tester**, +13 nye — alle grønne, ingen regresjon).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) de tre siste
utestede filene i `admin/` (`countries.ts`/`legal-documents.ts`/
`responses.ts`) — samme bevist mønster; (3) vurder om
`contact_approved`/`contact_declined` bør bli egne `displayStatus`-
verdier i 12.6; (4) resten av komponentbiblioteket (Dialog, Toast, Card,
Alert, Tabs, Table, Pagination); (5) resten av 16.1-dashbordet; (6) den
ubrukte `"approved"`-verdien i `request_status`-enumen; (7)
OG-delingsbilde.

## Fortsettelse av økt 7 — de tre siste filene i `admin/` dekket: HELE testbarhets-refaktoreringen er nå lukket

Fullførte punkt (2). Alle tre filene (`countries.ts`, `legal-documents.ts`,
`responses.ts`) er `requireAdmin()`-gatet (enklere enn
`requireModeratorForCountry()` — kun administrator-rollen slipper
gjennom, intet landoppslag), så samme `vi.mock("next/headers")`-oppskrift
ble gjenbrukt uendret nok en gang:

- `admin/countries.integration.test.ts` (14 tester) — desidert den
  største av de tre: `listAllCountries()`/`createCountry()`
  (opprettes ALLTID i `draft`, validerer standardspråk mot tilgjengelige
  språk, avviser duplikatkoder)/`updateCountry()`/`setCountryStatus()`
  (nekter aktivering uten BÅDE publiserte vilkår/personvernerklæring OG
  minst én tildelt moderator, hver sjekket uavhengig)/
  `assignModeratorToCountry()` (oppretter en ny konto ELLER gjenbruker en
  eksisterende MODERATOR-konto, men avviser å gjøre om en journalist/
  mottaker — akkurat regelen kommentaren i selve filen beskriver — og er
  idempotent).
- `admin/legal-documents.integration.test.ts` (7 tester) —
  `publishLegalDocument()`: validering, ukjent landkode, at en ny versjon
  ALDRI overskriver en eksisterende (17.2), og selve 17.2-varslingsregelen
  presist som filens kommentar beskriver den: varsler AKTIVE mottakere i
  RIKTIG land+locale ved `isMaterialChange` for `terms`/`privacy`, men
  ALDRI for `journalist_terms` (den bevisst avgrensede antagelsen).
- `admin/responses.integration.test.ts` (4 tester) —
  `getResponseForAdmin()`: krever administrator SPESIFIKT (FR-051 — en
  moderator nektes, ulikt de fleste andre admin-rutene), logger oppslaget
  MED begrunnelsen (16.2), og returnerer svaret UANSETT
  `lifecycle_status` (inkludert `hidden_by_moderator`) — bevisst ulikt
  journalistens egen innboks.

To reelle fallgruver underveis, begge løst uten å røre produksjonskode:
- `audit_logs`/`moderator_countries`/`legal_documents`/`users` refererer
  alle til `countries.code` uten `ON DELETE CASCADE` — et første utkast
  som slettet testlandet direkte etter hver test feilet gjentatte ganger
  på fremmednøkkel-konflikter. Løst med en delt `deleteTestCountry()`-
  hjelpefunksjon som rydder i riktig avhengighetsrekkefølge, og ved å la
  moderator-brukerens EGEN `countryCode` peke på det STABILE
  `TEST_COUNTRY_CODE` (aldri slettet) mens selve tildelingen
  (`moderatorCountries`) peker på testlandet som slettes.
- `legal_documents` har en UNIQUE-indeks på (land, locale, type, versjon)
  — hardkodede versjonsstrenger ("2.0.0" osv.) kollapset ved andre
  gangs kjøring av testfilen, siden denne filen bevisst ikke rydder opp i
  publiserte dokumenter (samme aksepterte unntak som resten av
  `fixtures.ts`). Løst med en `uniqueVersion()`-hjelpefunksjon
  (`randomUUID()`-basert) i stedet for faste strenger.

Alle fem filene i `admin/`/`moderation/` som "den store
testbarhets-refaktoreringen" pekte på (over mange, mange økter) har nå
ekte test-dekning: `moderation/requests.ts`, `moderation/journalists.ts`,
`moderation/users.ts`, `admin/legal-documents.ts`, `admin/countries.ts`,
`admin/responses.ts` — pluss `tick.ts`s jobbfunksjoner og
`account-deletion.ts` fra tidligere i denne økten. Til sammen **68 nye
integrasjonstester** lagt til i denne økten alene (47 → 115), og hinderet
(`server-only`) som gjorde ALT dette umulig å teste er løst med én
alias-linje. Dette punktet forsvinner nå helt fra "Neste økt".

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, uendret), `i18n:check` (uendret), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
(**115 tester**, +25 nye — alle grønne, kjørt FLERE ganger på rad for å
bekrefte at ingen av de nye testene etterlater data som kolliderer ved
gjentatt kjøring, ingen regresjon).

### Neste økt

Testbarhets-refaktoreringen er FERDIG — ikke lenger et punkt på denne
listen. Gjenstående, i grov prioritert rekkefølge: (1) faktisk
Brevo-integrasjon når en API-nøkkel finnes; (2) vurder om
`contact_approved`/`contact_declined` bør bli egne `displayStatus`-
verdier i 12.6; (3) resten av komponentbiblioteket (Dialog, Toast, Card,
Alert, Tabs, Table, Pagination); (4) resten av 16.1-dashbordet; (5) den
ubrukte `"approved"`-verdien i `request_status`-enumen; (6)
OG-delingsbilde.

## Fortsettelse av økt 7 — den ubrukte `approved`-verdien i `request_status`-enumen fjernet (migrasjon)

Tok fatt på punkt (5), det siste gjenværende punktet som var utsatt av
migrasjonsrisiko fremfor kodekompleksitet. Sjekket SPEC-V1.md 19.6 først
(spec-en er sannheten) — den sier ORDRETT at spørsmålet allerede var
åpent ved spec-forfatning: "`approved` er med i enumet som mellomtilstand
for moderatorens handling, men settes og forlates i samme transaksjon
som publisering. Alternativt kan den sløyfes helt – avgjøres ved
implementering." Implementeringen (`publishRequest()`,
`src/lib/moderation/requests.ts`, verifisert på nytt denne økten via de
nye integrasjonstestene) går DIREKTE fra `submitted` til `published` —
`approved` er aldri satt eller lest noe sted i kodebasen (bekreftet med
grep, og kryssjekket mot `JournalistRequestStatus`-typen i
`status-badge.ts`, som eksplisitt lister de syv faktisk brukte
statusene). Dette er altså IKKE et hull mellom spec og kode — spec-en selv
overlot valget til implementeringen, og implementeringen tok det for
lenge siden. Det gjenværende hullet var rent en glemt opprydding: enumet
i databasen hadde fortsatt verdien.

Rettet spec FØRST (19.6-tabellen + forklaringsavsnittet, som nå sier at
valget er gjort, ikke lenger et åpent spørsmål), deretter koden
(`request_status`-enumet i `schema.ts`), deretter generert en ekte
Postgres-migrasjon (`npm run db:generate`).

**Én reell fallgruve i selve migrasjonen:** `drizzle-kit`s
førstegenererte SQL prøvde å konvertere kolonnen til `text`, droppe det
gamle enumet, opprette det nye, og konvertere tilbake — men glemte at
`status`-kolonnens `DEFAULT 'draft'` UTTRYKK selv avhenger av enumtypen
(`error: cannot drop type request_status because other objects depend on
it`). Rettet manuelt ved å legge til `ALTER COLUMN status DROP DEFAULT`
FØR konverteringen og `SET DEFAULT 'draft'::request_status` ETTER — en
kjent, dokumentert `drizzle-kit`-begrensning ved enum-endringer med en
avhengig standardverdi, ikke noe spesifikt for dette skjemaet.

Verifiserte FØR migrasjonen kjørte at null rader i BÅDE test- og
utviklings-Postgres-instansene faktisk hadde `status = 'approved'`
(`SELECT count(*) ... WHERE status = 'approved'` — 0 i begge), slik at
selve `USING status::request_status`-konverteringen (som ville feilet
høylytt, ikke stille korrumpert data, dersom antagelsen var feil) var
trygg. Kjørte migrasjonen mot BEGGE lokale instanser (test og
utvikling/nettleserverifisering).

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**329
tester**, uendret), `i18n:check` (uendret), `design:check-tokens`,
`rm -rf .next && next build`, `test:integration` mot ekte lokal Postgres
ETTER migrasjonen (**115 tester**, uendret antall — ingen regresjon fra
skjemaendringen).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) vurder om
`contact_approved`/`contact_declined` bør bli egne `displayStatus`-
verdier i 12.6; (3) resten av komponentbiblioteket (Dialog, Toast, Card,
Alert, Tabs, Table, Pagination); (4) resten av 16.1-dashbordet; (5)
OG-delingsbilde.

## Fortsettelse av økt 7 — SPEC-V1.md 16.1-dashbordet bygget

Tok fatt på punkt (4) fra forrige "Neste økt". Undersøkte først punkt (2)
(`contact_approved`/`contact_declined`-`displayStatus`-spørsmålet) —
konkluderte at det IKKE er et hull: SPEC-V1.md 12.6 sier ORDRETT
"forespørsel om videre kontakt → EN KONTAKTFORESPØRSEL (14) FINNES for
svaret", uten noe forbehold om dens status (pending/godkjent/avslått), og
koden (`listMineResponses()`) gjør nøyaktig det — enhver kontaktforespørsel,
uansett status, gir `displayStatus: "contact_requested"`. En eventuell
finere oppdeling ville vært en PRODUKTBESLUTNING utover det spec-en ber om,
ikke en retting av et hull — lot den derfor stå, i tråd med prinsippet om
å ikke finne opp UX spec-en ikke ber om.

**16.1-dashbordet** fantes ikke i det hele tatt (`/admin` hadde ingen
`page.tsx`). Bygget:

- `src/lib/admin/dashboard.ts` — `getDashboardStatsForCountry(countryCode)`
  (de syv tallene: ventende journalistsøknader, modereringskø, aktive
  forespørsler, utløper innen 48t, nye mottakere/avmeldinger siste 7 dager,
  siste utsendelse MED antall feilede leveranser) og
  `getDashboardCountries(session, selectedCountryCode?)`. Ingen av dem
  kaller `getCurrentSession()` selv (samme mønster som
  `listModerationQueue()`) — dermed INGEN `vi.mock("next/headers")` nødvendig
  i testene, til tross for at dette er nytt admin-kode.
- `dashboard.integration.test.ts` (10 tester) mot ekte Postgres — én
  fallgruve rettet: en test antok et ABSOLUTT tall ("0 ventende søknader")
  for `TEST_COUNTRY_CODE`, som er DELT med mange andre integrasjonstest-
  filer som (bevisst) ikke rydder opp alt — endret til å måle DELTA
  (før/etter), samme lærdom som tidligere økter i denne serien.
- `/admin/page.tsx` + `CountrySelector.tsx` (klientkomponent, kun for
  administrator — navigerer via `?country=`-URL-en, ingen klientside-henting):
  "Filtrert på moderatorens tildelte land, med landvelger for administrator"
  (16.1, ordrett) — en moderator ser AUTOMATISK sine tildelte land uten
  valg, en administrator velger ETT land om gangen (forvalgt til det
  alfabetisk første landet når ingen er valgt ennå).
- `Card`-komponenten (DESIGN.md 6s minimumssett) bygget som en konkret
  konsekvens av dette dashbordet, IKKE spekulativt — det er den eneste av
  de sju gjenværende listede komponentene (Dialog/Toast/Card/Alert/Tabs/
  Table/Pagination) som faktisk hadde en klar, umiddelbar bruker akkurat
  nå. De andre seks er fortsatt bevisst usatt: eksisterende destruktive
  handlinger (lukk forespørsel, avvis, suspender) bruker alle et etablert
  inline-avsløringsmønster i stedet for `Dialog`, og å bytte DEM til en
  modal nå ville vært en ubedt redesign av noe som allerede fungerer og er
  testet, ikke en retting av et hull.

### Verifisert ende til ende i en ekte nettleser

Sådd realistiske data i utviklingsdatabasen (én ventende journalistsøknad,
én forespørsel i kø, tre publiserte hvorav én med frist under 48t, tre
ferske mottakere hvorav én avmeldt, én utsendelse med én feilet levering).
Besøkte siden som BÅDE moderator og administrator: moderator så INGEN
landvelger og korrekte tall for sitt tildelte land; administrator så
velgeren, forvalgt til landet, og identiske korrekte tall; besøk med
`?country=XT` direkte ga samme resultat. Alle sju tallene stemte
nøyaktig overens med det som ble sådd (pluss forventet, allerede
eksisterende data fra tidligere økters egne verifiseringsscript, som
IKKE ble ryddet bort — bekrefter at tellingen faktisk er reell, ikke
hardkodet). Landnavnet viste "…" for begge roller — bekreftet at dette
er FORVENTET, korrekt oppførsel: `TEST_COUNTRY_CODE`s `nameKey`
("country.test.name") er et bevisst uoversatt fixture-navn (se
fixtures.ts: "aldri et ekte ISO 3166-1-kodenavn i bruk"), og
`createTranslator()`s "…"-fallback for en manglende nøkkel er selve den
spesifiserte, tilsiktede oppførselen (3.4) — ikke en feil i den nye koden.

### Verifisert før commit

`tsc --noEmit`, `eslint .` (0 feil/advarsler), `vitest run` (**331
tester**, +2 nye for `Card`), `i18n:check` (**387 nøkler**),
`design:check-tokens` (**40** komponent-CSS-filer, +2), `rm -rf .next &&
next build` (bekreftet `/[locale]/admin` i utdataet), `test:integration`
mot ekte lokal Postgres (**125 tester**, +10 nye), PLUSS
ende-til-ende-nettleserverifiseringen beskrevet over (begge roller).

### Neste økt

(1) faktisk Brevo-integrasjon når en API-nøkkel finnes; (2) resten av
komponentbiblioteket (Dialog, Toast, Alert, Tabs, Table, Pagination) —
bygg når en KONKRET forbruker faktisk trenger dem, ikke spekulativt; (3)
OG-delingsbilde.

---

## Fortsettelse av økt 7 — auditerte de tre "Neste økt"-punktene (alle fortsatt blokkert), fant og lukket to reelle hull

Undersøkte de tre listede punktene før noe annet: **Brevo** — ingen
`BREVO_API_KEY` finnes i miljøet, fortsatt bevisst utsatt, ikke glemt.
**Komponentbiblioteket** — fortsatt ingen konkret forbruker for
Dialog/Toast/Alert/Tabs/Table/Pagination utover det som allerede er bygget;
å bygge dem nå ville vært spekulativt, i strid med etablert prinsipp. **OG-
delingsbilde** — sjekket DESIGN.md på nytt: seksjon "10. Uavklart" lister
dette EKSPLISITT som blokkert på en ikke-besluttet visuell identitet. Dette
er ikke implementasjonens å finne opp; korrekt fortsatt utsatt, ikke et
hull.

Med alle tre bekreftet fortsatt blokkert, gjorde jeg et systematisk søk
etter andre reelle hull i stedet for å stå stille:

**Rettet en utdatert kommentar** i `src/lib/jobs/retention.ts`
(`purgeOldResponses()`s docstring, 17.4/17.5): kommentaren hevdet at
`withdrawResponse()` "ikke er bygget ennå" og at trukne svar derfor midlertidig
er retensjonsjobbens ansvar. Dette er ikke lenger sant —
`withdrawResponse()` (`src/lib/responses/responses.ts`) er bygget og
hard-sletter allerede umiddelbart ved trekking. Rettet kommentaren til å
vise til den faktiske funksjonen i stedet for å beskrive en tilstand som
ikke lenger stemmer. Ren dokumentasjonsrettelse, ingen atferdsendring.

**Testdekningsaudit**: kjørte en systematisk sjekk av alle filer i
`src/lib/**/*.ts` (unntatt `*.test.ts`) mot om de har en søsken-testfil.
Fant 9 filer med NULL dekning. De klart høyest prioriterte — kjernen i HELE
autentiseringssystemet, aldri testet til tross for all
testbarhets-refaktoreringen tidligere denne økten — var `auth/session.ts`
og `auth/magic-link.ts`. Skrev:

- `auth/magic-link.integration.test.ts` (15 tester) — INGEN mocking
  nødvendig (samme kategori som `tick.ts`/`account-deletion.ts`: ingen
  `next/headers`-avhengighet). Dekker `requestMagicLink()`: no-op for
  ukjent/suspendert/slettet bruker (avslører aldri kontoeksistens),
  riktig e-postmal valgt (`magic_link` for bekreftet bruker,
  `confirm_email`/`journalist_application_received` for førstegangs),
  og hastighetsgrensen (5 per 15 minutter, 6. avvist). Og
  `verifyMagicLink()`: avviser ukjent/feil-formål
  (`delete_account`-token brukt mot login)/brukt/utløpt/suspendert-bruker-
  token (19.15: alle samme feilvei, null), gyldig token verifiserer +
  markerer brukt + aktiverer kontoen, samme token kan ikke brukes to
  ganger, og rører IKKE `emailVerifiedAt` for en allerede bekreftet bruker.
- `auth/session.integration.test.ts` (13 tester) — `session.ts` har
  `import "server-only"`, som (som tidligere dokumentert) kaster under
  Vitest med mindre `server-only` er aliaset til pakkens egen `empty.js`
  (allerede løst i `vitest.integration.config.ts` fra en tidligere økt).
  `next/headers`s `cookies()` mocket med en enkel, mutérbar
  fake-cookie-jar (`.get()`/`.set()`/`.delete()`), IKKE en ekte
  cookie-jar-bibliotek. Dekker `createSession()` (setter cookien til
  nøyaktig samme rå token som lagres hashet i databasen; 30 dagers
  levetid for mottaker/journalist, 12 timer for moderator/administrator —
  8.3, fornyes ikke), `getCurrentSession()` (ingen cookie/ukjent
  token/utløpt/tilbakekalt økt/bruker med `status` ulik `active` — ALLE
  gir null, 19.15), `revokeCurrentSession()` (tilbakekaller OG sletter
  cookien; trygt no-op uten cookie), og `revokeAllSessionsForUser()`
  (tilbakekaller ALLE en brukers økter uten å røre andre brukeres,
  idempotent — 17.5).

**Fant og rettet et reelt rerun-sikkerhetshull i de nye
magic-link-testene**: syv av testene brukte hardkodede rå token-strenger
(`"test-raw-token-wrong-purpose"` osv.) direkte som unike verdier i
`auth_tokens.token_hash`. Ved første kjøring gikk alle 15 grønt, men en
etterfølgende kjøring av HELE `test:integration`-pakken feilet med
"duplicate key value violates unique constraint" — radene fra forrige
kjøring var aldri ryddet bort. Samme lærdom som tidligere økter i denne
serien (unike/tilfeldige verdier, ikke hardkodede konstanter): byttet alle
syv til `generateToken()` (den faktiske token-generatoren appen selv
bruker), som gir en ny tilfeldig verdi hver kjøring.

Under full `test:integration`-kjøring dukket også én FLAKY, IKKE-relatert
test opp: `dashboard.integration.test.ts`s første test sammenligner to
påfølgende tellinger av `pendingJournalistApplications` for
`TEST_COUNTRY_CODE` og forventer dem like — men siden Vitest kjører
integrasjonstestfiler parallelt i flere workere mot samme delte Postgres,
kan en ANNEN testfil skrive en `pending_review`-journalistprofil for
samme landkode i vinduet mellom de to tellingene. Bekreftet ved å kjøre
filen isolert (10/10 grønt) og hele pakken på nytt (153/153 grønt) — dette
er en preeksisterende race condition i test-parallelliseringen, IKKE noe
denne øktens endringer forårsaket. Ikke rettet denne økten (utenfor
skopet for testdekningsarbeidet, og krever et bevisst valg om enten
delta-måling med retry eller `pool: "forks"`/serialisering av denne ene
filen) — notert under.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**331
tester**, uendret — ingen nye enhetstester denne runden, kun
integrasjonstester), `i18n:check` (**387 nøkler**), `design:check-tokens`
(**40** komponent-CSS-filer, uendret), `rm -rf .next && next build`
(grønn), `test:integration` mot ekte lokal Postgres (**153 tester**, +28
nye — 15 for `magic-link.ts`, 13 for `session.ts` — kjørt to ganger for å
bekrefte rerun-sikkerhet etter fiksen over).

### Neste økt

(1) de resterende 7 filene uten testdekning funnet i denne øktens audit:
`auth/authorize.ts`, `contact-requests/contact-requests.ts`,
`digests/digests.ts`, `http/escape-html.ts`,
`journalists/journalist-inbox.ts`, `legal/documents.ts`,
`registration/journalist.ts` — prioriter etter samme
sikkerhet/kompleksitet-kriterium som denne runden; (2) den flakete
`dashboard.integration.test.ts`-testen (se over) — vurder delta-måling med
retry eller å isolere filen fra parallell kjøring, IKKE en hastverksfiks
mot symptomet; (3) Brevo-integrasjon, resten av komponentbiblioteket, og
OG-delingsbilde forblir alle korrekt blokkert, se punktene notert i forrige
økt.

---

## Fortsettelse av økt 7 — de siste 7 filene uten testdekning dekket, PLUSS et reelt hull funnet og rettet: journalistregistrering sjekket aldri sperrelisten

Tok fatt på punkt (1) fra forrige "Neste økt" — alle 7 gjenværende filer
uten testdekning fra forrige rundes audit. Skrev, i prioritert rekkefølge:

- `auth/authorize.integration.test.ts` (11 tester) — `requireModeratorForCountry()`
  (moderator får kun tilgang til SITT tildelte land, administrator får ALLE
  land uten egen tildelingsrad, 19.4), `requireAdmin()` (nekter en moderator
  selv med tildelt land, 16.2), `getAssignedCountryCodes()` (literalen
  `"all"` for administrator, IKKE en tom liste — en tom liste for en
  administrator ville feilaktig blitt tolket som "ingen land" av kallere).
  Samme `vi.mock("next/headers")`-mønster som `session.ts`.
- `contact-requests/contact-requests.integration.test.ts` (13 tester) —
  FR-040/041/043 (SPEC-V1.md 14): validering (tom/for lang melding),
  eierskapssjekk (kun JOURNALISTEN forespørselen tilhører kan opprette),
  `contact_already_shared`-avvisningen, FR-043 sin unike indeks (ekte
  Postgres-håndhevelse, ikke bare applikasjonssjekken), godkjenning
  (setter delt e-post, logger revisjonslogg UTEN e-postadressen i
  `metadata` — 14.3 — og varsler journalisten), avslag (INGEN begrunnelse i
  e-posten, 14.2), og `getContactRequestDetail()`s asymmetriske
  synlighetsregel (respondenten ser alltid sin egen delte adresse,
  journalisten ser den FØRST etter godkjenning).
- `digests/digests.integration.test.ts` (7 tester) — `listDigests()`
  filtrert på tildelte land (samme mønster som `listModerationQueue()`),
  `retryFailedDigestDeliveries()`: kun `failed`-leveranser sendes på nytt
  (urørt `delivered`-rad bekreftet), avmeldingstoken roteres, revisjonslogg
  (FR-050) skrevet med riktige tall, og en moderator uten tildelt land
  avvist.
- `legal/documents.integration.test.ts` (5 tester) — "nyeste PUBLISERTE
  versjon, ikke en fremtidig" (17.2/19.2) og
  `getRequiredLegalDocuments()`s alt-eller-ingenting-regel. Isolerte
  bevisst hver test til sin egen (locale, type)-kombinasjon
  (nb-NO/en-GB × terms/privacy) for å unngå å bli skjør mot
  `admin/legal-documents.integration.test.ts`, som kjører parallelt og
  stadig publiserer nye "terms"-versjoner for samme
  (TEST_COUNTRY_CODE, nb-NO) — samme klasse delt-tilstand-lærdom som
  `dashboard.integration.test.ts` fra forrige runde.
- `email/escape-html.test.ts` (4 tester, VANLIG enhetstest — ren funksjon,
  ingen database) — alle fem tegnene, og at `&` escapes FØRST (unngår
  dobbel-escaping av allerede-escapede entiteter).
- `journalist-inbox/journalist-inbox.integration.test.ts` (8 tester) —
  `listResponsesForRequest()` (eierskapssjekk, oppsummeringstallene,
  `hasSharedEmail` er true ved GODKJENT kontaktforespørsel selv uten delt
  e-post i selve svaret), `getResponseDetailForJournalist()` (`viewedAt`
  settes FØRSTE gang, uendret ved neste kall — 13: "utløser ingen
  notifikasjon"), `updateResponseMarking()` (rører ALDRI
  `lifecycleStatus`, som eies av respondenten alene — 19.7).
- `registration/journalist.integration.test.ts` (6 tester) — se under, et
  reelt hull ble funnet og rettet HER, ikke bare dekket.

**Reelt hull funnet og rettet**: mens jeg skrev testene for
`registration/journalist.ts`, oppdaget jeg at `applyAsJournalist()` ALDRI
sjekket sperrelisten (`suppressions`, 19.13) — i sterk kontrast til
`registerRecipient()`, som gjør nøyaktig denne sjekken (FØR
allerede-registrert-sjekken) med en tydelig begrunnende kommentar. SPEC-V1.md
10.3 nevner sperrelisten kun i den daglige digestens kontekst, men selve
19.13-teksten sier eksplisitt at listen er rolleuavhengig ("en adresse som
har klaget i ett marked, skal ikke motta e-post fra et annet" — ikke "fra
samme rolle"), og en journalist mottar like fullt transaksjonell e-post
(magic link, søknadsstatus) som sperrelisten skal beskytte mot. Fulgte
"spec er sannheten, rett spec-en først"-prinsippet: presiserte SPEC-V1.md
19.13 til eksplisitt å si at BÅDE mottaker- og journalistregistrering skal
sjekke sperrelisten, deretter rettet `journalist.ts` til å gjøre nøyaktig
samme sjekk som `recipient.ts` (samme feilkode `errors.email_suppressed`,
samme posisjon i sjekkerekkefølgen). Bekreftet at
`POST /journalists/apply`-ruten allerede videreformidler en vilkårlig
`result.error` generisk (422-status for alt unntatt
`email_already_registered`) — ingen rute-endring nødvendig.

Etter denne rettingen: **null filer i `src/lib/**` uten testdekning**
(bekreftet med samme audit-løkke som forrige runde — tom output).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, +4 — kun `escape-html.test.ts` er en vanlig enhetstest denne
runden), `i18n:check` (**387 nøkler**, uendret — `errors.email_suppressed`
fantes allerede i begge språk), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn),
`test:integration` mot ekte lokal Postgres (**203 tester**, +50 —
`authorize` 11, `contact-requests` 13, `digests` 7, `legal/documents` 5,
`journalist-inbox` 8, `registration/journalist` 6).

### Neste økt

Ingen kjente gjenstående testdekningshull i `src/lib/**`. Gjenstår fortsatt:
(1) den flakete `dashboard.integration.test.ts`-testen (se forrige runde)
— vurder delta-måling med retry eller isolering fra parallell kjøring; (2)
Brevo-integrasjon, resten av komponentbiblioteket, og OG-delingsbilde
forblir alle korrekt blokkert (se punktene notert i tidligere økter). Neste
gode bruk av tiden er trolig et nytt, bredt søk etter spec-vs-kode-hull
(samme type funn som sperrelistehullet over) fremfor mer testdekning alene
— testene i seg selv AVDEKKET dette hullet, så et tilsvarende søk i de
gjenværende hjørnene av kodebasen (spesielt andre steder som speiler en
etablert sjekk uten selv å ha den) kan være mer verdifullt enn ren
dekningsjakt.

---

## Fortsettelse av økt 7 — den flakete `dashboard.integration.test.ts` fikset for godt (var faktisk TO uavhengige race conditions, ikke én)

Tok fatt på punkt (1) fra forrige "Neste økt". Kjørte `test:integration`
gjentatte ganger for å reprodusere flaket fra forrige runde, og fant at det
faktisk var TO separate, uavhengige race conditions i samme fil — begge
forårsaket av at testene delte `TEST_COUNTRY_CODE` med resten av
testsuiten, som (bevisst, se `fixtures.ts`) ikke rydder opp alt den
oppretter:

1. **"teller ventende journalistsøknader"**: en `afterFixtureJournalist`-
   lesning rett etter `before`, med INGENTING som skjer mellom dem — en
   vacuous sammenligning som feilet hver gang en annen parallell fil
   (typisk `registration/journalist.integration.test.ts`, som oppretter en
   `pending_review`-journalistprofil for `TEST_COUNTRY_CODE` som en del av
   sin egen, helt legitime test) traff akkurat det vinduet. Fjernet den
   vacuous lesningen først — avdekket UMIDDELBART en ANNEN, dypere versjon
   av samme problem: selve før/etter-DELTA-en (`+1`) er også skjør mot en
   HVILKEN SOM HELST samtidig skriving til samme land i det litt lengre
   vinduet mellom `before` og `after`. Løsningen var å slutte å dele land i
   det hele tatt — testen oppretter nå to HELT EGNE, engangs testland
   (`Z${randomUUID()...}`) som ingen annen fil vet om, og gjør deretter
   eksakte (ikke delta-baserte) påstander (`0`, så `1`) mot dem — fullstendig
   immun mot alt annet som skjer i databasen samtidig.
2. **"returnerer siste utsendelse med antall feilede leveranser"**: en
   hardkodet `scheduledFor: "2026-07-30"` (dagens dato, ved en ren
   tilfeldighet — men problemet var strengen selv, ikke datoen) kolliderte
   med en rad en TIDLIGERE, mislykket kjøring hadde latt stå igjen for godt
   — testens opprydding sto etter assertion-en, uten `try/finally`, så en
   ENESTE feilet kjøring (uansett årsak) forgiftet ALLE senere kjøringer av
   hele testsuiten permanent via den unike indeksen på
   `(country_code, scheduled_for)`. Fant og slettet den faktiske forgiftede
   raden manuelt (`12a7af90-...`, opprettet av en tidligere økt). Rettet
   testen til samme mønster: eget engangs testland, PLUSS `try/finally`
   rundt hele testkroppen, slik at opprydding kjører uansett om en
   assertion feiler — én fremtidig feil kan ikke lenger forgifte
   testsuiten for godt.

Bekreftet fiksen med **8 påfølgende kjøringer** av hele
`test:integration`-pakken (203 tester hver gang) — alle grønne, ingen
gjentatt av noen av de to tidligere flakene.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**203
tester**, uendret i antall — kjørt 8 ganger på rad, alle grønne).

### Neste økt

Testsuiten (både enhets- og integrasjonstester) er nå, så langt kjent,
fullstendig deterministisk uansett kjørerekkefølge/parallellitet. Neste
gode bruk av tiden: et bredt søk etter flere spec-vs-kode-hull av samme
type som sperrelistehullet (økt 7, forrige runde) — se etter steder der én
modul har en sjekk/regel en STRUKTURELT lignende modul mangler (f.eks.
sammenlign alle `registration/*.ts`-, `moderation/*.ts`- og
`admin/*.ts`-filene parvis for asymmetriske sjekker). Brevo-integrasjon,
resten av komponentbiblioteket, og OG-delingsbilde forblir alle korrekt
blokkert (se punktene notert i tidligere økter).

---

## Fortsettelse av økt 7 — enda et reelt spec-vs-kode-hull funnet og rettet: journalistgodkjenning/-avvisning kunne flippes frem og tilbake

Tok fatt på selve søkeforslaget fra forrige "Neste økt": sammenlignet
`moderation/journalists.ts` parvis mot `moderation/requests.ts` (samme
kategori — moderatorhandling som avgjør en søknad/forespørsel).

**Fant en reell asymmetri**: `moderation/requests.ts` sine tre
handlinger (`publishRequest`, `rejectRequest`, `requestChanges`) håndhever
ALLE eksplisitt `if (request.status !== "submitted") return
errors.request_not_editable` FØR de gjør noe — dokumentert i requests.ts
sin egen kommentar som en bevisst re-håndhevelse av FR-029 mot at to
moderatorer handler samtidig på samme sak. `moderation/journalists.ts` sine
to tilsvarende handlinger (`approveJournalist`, `rejectJournalist`) hadde
INGEN tilsvarende sjekk — en søknad som allerede var `approved` kunne
kalles med `rejectJournalist()` og flippes til `rejected` (og omvendt),
til tross for at SPEC-V1.md 8.1s eget diagram allerede tegner
`verification_status` som en énveis, endelig tilstandsovergang (ingen
tilbakepiler). Verifiserte at hverken API-rutene
(`/admin/journalists/:id/approve|reject`) eller UI-siden
(`admin/journalists/page.tsx`, som kun henter `pending_review`-søknader)
kompenserer for dette på noen måte som ville hindre det via en annen kanal
(f.eks. to samtidig åpne moderator-faner, eller en gjentatt/replayet
forespørsel).

Presiserte SPEC-V1.md 8.1 (diagrammet har alltid vært endelig, men sa det
ikke eksplisitt i tekst) FØR jeg rettet koden: la til en guard i begge
funksjonene (`if (journalist.verificationStatus !== "pending_review")
return errors.journalist_not_pending_review`, plassert FØR
autorisasjonssjekken, samme rekkefølge som requests.ts sin egen guard), ny
feilnøkkel i begge språkfiler, og to nye tester i
`journalists.integration.test.ts` (godkjenn-så-godkjenn-igjen, og
avvis-så-godkjenn — begge nå korrekt avvist, den avviste raden forblir
`rejected` uendret).

Sjekket også `moderation/users.ts` (suspend/unsuspend) og
`admin/responses.ts` (unntaksvis oppslag) i samme runde — begge allerede
korrekte (`users.ts` håndterer idempotens eksplisitt i begge retninger,
`responses.ts` er skrivebeskyttet uten tilstandsovergang å beskytte).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, uendret), `i18n:check` (**387 nøkler brukt i kode**, uendret —
den nye feilnøkkelen er, som flere andre `errors.*`-nøkler i denne
kodebasen, kun konsumert via API-responsen, ikke via en direkte `t()`-kall
i UI-en ennå), `design:check-tokens` (**40** komponent-CSS-filer,
uendret), `rm -rf .next && next build` (grønn), `test:integration` mot
ekte lokal Postgres (**205 tester**, +2).

### Neste økt

Fortsett samme type parvise sammenligning på flere hjørner av kodebasen
(spesielt steder med en tilstandsovergang som IKKE er eksplisitt beskyttet
mot dobbel/samtidig handling — dette er nå den nest funnet forekomsten av
akkurat dette mønsteret på to påfølgende økter, så det er trolig en
produktiv jaktstrategi videre). Brevo-integrasjon, resten av
komponentbiblioteket, og OG-delingsbilde forblir alle korrekt blokkert.

---

## Fortsettelse av økt 7 — audit fortsatte, og en HEL manglende funksjon oppdaget: "skjule et svar" fantes aldri

Fortsatte den parvise sammenligningen fra forrige runde. Sjekket
`admin/countries.ts` (`setCountryStatus()` er bevisst fler-retnings —
draft/active/paused, 3.3 — så ingen "endelig tilstand"-bug er mulig der),
`admin/legal-documents.ts` (publisering er alltid additiv, ingen
tilstand å beskytte), `auth/account-deletion.ts` (allerede korrekt
engangsbruk-beskyttet via `authTokens.usedAt`, samme mønster som
magic-link), og `requests/requests.ts` (samtlige tilstandsoverganger —
`updateDraft`, `submitRequest`, `closeRequest`, `deleteDraft` — allerede
grundig beskyttet fra tidligere økter). Ingen nye asymmetri-bugs av SAMME
klasse som de to forrige funnet i disse.

**Fant i stedet noe større**: `reports.ts`s egen dokumentasjonskommentar
sier ordrett at en moderator "handler manuelt (lukke, skjule, suspendere,
sperre)" etter en rapportering (12.5) — men et systematisk søk etter hvor
disse fire faktisk er IMPLEMENTERT viste at KUN to av fire eksisterte:
"lukke" (`closeRequest()`) og "suspendere" (`suspendUser()`). "Skjule et
svar" hadde INGEN kode noe sted som satte
`responses.lifecycle_status = 'hidden_by_moderator'`, til tross for at
selve enum-verdien (19.7) alltid har eksistert i datamodellen nettopp for
dette formålet — en ren spec-vs-kode-drift, ikke en design-tvil. ("Sperre
e-postadressen" som en EGEN, moderator-utløst handling mangler også
fortsatt — kun den automatiske sperringen ved bounce/klage er bygget; se
"Neste økt" under.)

Rettet spec-en først (la til `POST /admin/responses/:id/hide` i seksjon
20, med samme begrunnende fotnote-stil som de tre forrige tilføyelsene i
samme liste), deretter koden:

- `src/lib/moderation/responses.ts` — `hideResponse(responseId)`. Samme
  mønster som `moderation/journalists.ts`/`requests.ts`: slår opp landet
  via svarets forespørsel, krever `requireModeratorForCountry()`, avviser
  et svar som ikke lenger er `submitted` (samme
  re-håndhevelsesprinsipp som de to forrige øktenes funn — kan ikke
  skjules to ganger, eller etter at det allerede er trukket/slettet),
  kansellerer en ventende kontaktforespørsel (samme sideeffekt som en
  trekking, 12.4 — svaret forsvinner uansett fra journalistens innboks),
  og logger til revisjonsloggen (FR-050). Bevisst INGEN ny
  `hidden_at`/`hidden_by`-kolonne — 19.7 sin fullstendige feltliste for
  `Response` har ingen slike felt, revisjonsloggen bærer ansvarligheten i
  stedet.
- `POST /admin/responses/:id/hide`-ruten (samme
  autorisasjon-inni-funksjonen-mønster som `approve`/`reject`-rutene for
  journalister).
- Ny feilnøkkel `errors.response_not_visible` i begge språkfiler.
- `responses.integration.test.ts` (6 tester): ukjent svar-ID, moderator
  tildelt feil land, vellykket skjuling, kontaktforespørsel kansellert,
  gjentatt skjuling avvist, administrator kan skjule uansett land.
- Bevisst INGEN ny UI-side — samme "backend uten UI"-mønster som
  `GET /admin/responses/:id` allerede etablerte (12.5 sier eksplisitt at
  rapportering ikke har noen egen datamodell/kø i v1, kun e-post til
  moderator, som deretter handler manuelt via denne API-en).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, uendret), `i18n:check` (**387 nøkler**, uendret — samme
"konsumeres kun via API-respons"-mønster som forrige økts feilnøkkel),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn, bekreftet `/api/admin/responses/[id]/hide` i
utdataet), `test:integration` mot ekte lokal Postgres (**211 tester**, +6
— kjørt 4 ganger på rad, alle grønne).

### Neste økt

(1) "sperre e-postadressen" som en EGEN, moderator-utløst handling (12.5,
fjerde og siste av de fire tiltakene) — mangler fortsatt fullstendig,
samme klasse hull som "skjule et svar" var; naturlig sted er trolig en ny
`suppressEmail(email, reason)`-funksjon som setter inn i `suppressions`
med `reason: "manual"`, pluss en tilhørende rute; (2) fortsett den
parvise asymmetri-jakten på gjenværende hjørner av kodebasen; (3)
Brevo-integrasjon, resten av komponentbiblioteket, og OG-delingsbilde
forblir alle korrekt blokkert.

---

## Fortsettelse av økt 7 — det fjerde og siste av 12.5s moderatortiltak bygget: "sperre e-postadressen" (manuell)

Fullførte punkt (1) fra forrige "Neste økt" — det siste gjenstående hullet
i 12.5s fire moderatortiltak. `suppressions.reason`-enumen har alltid hatt
en `manual`-verdi (19.13), men INGEN kode noe sted satte den — kun de tre
automatiske grunnene (`unsubscribed`, `hard_bounce`, `complaint`) ble
noensinne brukt. Rettet spec-en først (la til
`POST /admin/users/:id/suppress-email` i seksjon 20, samme
fotnote-stil), deretter koden:

- `suppressUserEmail(userId, reason)` i `src/lib/moderation/users.ts`
  (samme fil som `suspendUser()`/`unsuspendUser()`, siden alle tre er
  moderatortiltak mot EN konto). Krever begrunnelse (samme mønster som
  `suspendUser()`), slår opp brukerens land og krever
  `requireModeratorForCountry()`, avviser en allerede SLETTET konto
  (kontoens `email`-felt er på det tidspunktet allerede erstattet med en
  hash av den ekte adressen av `account-deletion.ts` — å hashe DEN på nytt
  ville sperret feil verdi), setter inn i `suppressions` med
  `.onConflictDoNothing()` (idempotent via den unike indeksen på
  `email_hash`, samme mønster som `unsubscribeByToken()`), og logger til
  revisjonsloggen. Bevisst en UAVHENGIG handling fra `suspendUser()` — 12.5
  lister de fire tiltakene som distinkte verktøy, ikke en bunt; rører
  derfor ikke kontoens `status`.
- `POST /admin/users/:id/suppress-email`-ruten (samme mønster som
  `/admin/users/:id/suspend`).
- 6 nye tester i `users.integration.test.ts`: manglende begrunnelse,
  riktig hash+reason satt inn PLUSS revisjonslogg, rører ikke kontoens
  status, idempotent (kalt to ganger gir kun én rad), avviser en slettet
  konto, og en moderator tildelt feil land nektes.

Med dette er ALLE FIRE av 12.5s moderatortiltak nå bygget
(`closeRequest()`, `hideResponse()`, `suspendUser()`,
`suppressUserEmail()`) — ingen kjente gjenstående hull i selve
rapporteringsflyten.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, uendret), `i18n:check` (**387 nøkler**, uendret — ingen nye
nøkler trengtes, gjenbrukte `errors.reason_required`/`not_found`/
`not_authorized`), `design:check-tokens` (**40** komponent-CSS-filer,
uendret), `rm -rf .next && next build` (grønn, bekreftet
`/api/admin/users/[id]/suppress-email` i utdataet), `test:integration` mot
ekte lokal Postgres (**217 tester**, +6).

### Neste økt

Ingen kjente gjenstående hull i 12.5-rapporteringsflyten eller i de
modulene sjekket over to økter med den parvise
asymmetri-sammenligningsteknikken. Kandidater videre: (1) fortsett samme
teknikk på resten av kodebasen (spesielt `subscriptions/`- og
`journalists/`-mappene, ikke grundig sjekket ennå med denne spesifikke
linsen); (2) Brevo-integrasjon, resten av komponentbiblioteket, og
OG-delingsbilde forblir alle korrekt blokkert (se punktene notert i
tidligere økter).

---

## Fortsettelse av økt 7 — `subscriptions/`/`journalists/`/`me/` sjekket (rene), pluss en full rutediff mot SPEC-V1.md seksjon 20 fant fire dokumentasjonshull

Fullførte punkt (1) fra forrige "Neste økt": sjekket `subscriptions/`
(`email-events.ts`, `bounce-policy.ts`, `unsubscribe.ts`), `journalists/`
(`journalist-profile.ts`), og `me/` (`profile.ts`, `change-country.ts`)
med samme parvise asymmetri-linse som de tre forrige funnene. Ingen nye
guard-hull av samme klasse — disse modulene var allerede korrekte
(`unsubscribeByToken()` er idempotent, `email-events.ts` håndterer alle
fire hendelsestypene konsistent, `changeCountry()` sjekker samtykke FØR
noe skrives, akkurat som registreringsflytene).

Med denne spesifikke bug-klassen tilsynelatende uttømt for denne runden,
prøvde jeg en beslektet, men bredere teknikk: en FULL diff av hver eneste
rute i SPEC-V1.md seksjon 20 mot hver eneste faktiske `route.ts` i
`src/app/api/`. Fant FIRE reelle avvik — alle dokumentasjonsdrift, ingen
atferdsendring i kode:

1. **`DELETE /me` fantes aldri i kode** — den faktiske, allerede bygde og
   testede flyten er `POST /me/request-deletion` + `POST
   /me/confirm-deletion` (topunkts bekreftelse, 24.3: "særlig sensitive
   handlinger skal kreve ny autentisering", se `account-deletion.ts`s egen
   "Steg 1 av 2"/"Steg 2 av 2"-dokumentasjon). Erstattet linjen i spec-en.
2. **`PATCH /journalist/responses/:id/marking` het aldri det i kode** —
   den faktiske, fungerende ruten (kalt fra `ResponseDetailPanel.tsx`) er
   `/status`. Rettet spec-en til å matche koden, IKKE omvendt — en
   omdøping av en allerede testet, brukt sti hadde vært ubedt churn for en
   ren navnedrift.
3. **`POST /contact-requests/:id/respond { decision }` ble aldri bygget
   slik** — den faktiske implementasjonen er to atskilte,
   beslutning-i-stien-endepunkter (`.../approve`, `.../decline`), allerede
   i bruk fra `ContactRequestActions.tsx`. Samme resonnement: rettet
   spec-en til koden.
4. **`GET /digest-access/:token` manglet i listen HELT** — ikke en
   navnedrift som de tre over, men en total utelatelse. Ruten er reell,
   fungerende, og allerede dokumentert i SPEC-V1.md 6.2 og bygget av en
   tidligere økt (økt 5) — den ble bare aldri lagt til i selve
   API-referansen i seksjon 20. Lagt til.

Bekreftet ved en systematisk kryssjekk (skriptbasert diff av begge
listene, normalisert for path-parameternavn) at ALLE andre ruter nå
stemmer eksakt overens, inkludert at kombinerte multi-verb-ruter (f.eks.
`/requests/:id` med GET+PATCH+DELETE i samme fil, `/admin/countries/:code`
sin bevisste kombinering av felt-PATCH og statusbytte i ÉN rute) allerede
var korrekt implementert som spec-en beskriver.

### Verifisert før commit

Ren spec-/dokumentasjonsendring, ingen kodeendring — men kjørte likevel
hele verifiseringskjeden per standing rule: `tsc --noEmit` (ren),
`eslint .` (0 feil/advarsler), `vitest run` (**335 tester**, uendret),
`i18n:check` (**387 nøkler**, uendret), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn),
`test:integration` mot ekte lokal Postgres (**217 tester**, uendret).

### Neste økt

Rutereferansen i seksjon 20 stemmer nå fullstendig overens med faktisk
kode. Ingen kjente gjenstående spec-vs-kode-hull av noen av de typene
funnet denne økten (verken guard-asymmetri eller rutedrift). Kandidater
videre: (1) en tilsvarende diff av seksjon 15 (e-postmaltabellen) mot de
faktiske malfilene i `src/lib/email/templates/`, samme teknikk anvendt på
et annet inventar; (2) Brevo-integrasjon, resten av komponentbiblioteket,
og OG-delingsbilde forblir alle korrekt blokkert.

---

## Fortsettelse av økt 7 — e-postmaltabellen (seksjon 15) diffet mot de faktiske malfilene: fullstendig ren

Gjorde punkt (1) fra forrige "Neste økt": talte de 23 radene i seksjon
15s tabell (24 rader totalt, ekskludert "Dagens forespørsler (digest)"
som er en egen bulk-mal, `sendBulkEmail()`, ikke en del av
`TransactionalTemplate`-unionen) mot de 23 verdiene i selve
`TransactionalTemplate`-typen (`src/lib/email/send.ts`) — eksakt 1:1-match,
ingen manglende, ingen ekstra. Kryssjekket deretter at hver av de 23
faktisk KALLES fra reell forretningslogikk (ikke bare definert og aldri
brukt) — et første grovt søk viste tilsynelatende 5 ubrukte maler
(`confirm_email`, `magic_link`, `journalist_application_received`,
`changes_requested`, `request_rejected`), men dette var et falskt
alarmsignal fra et for naivt søkemønster (disse kalles via en variabel/
ternær, f.eks. `notifyJournalist(..., "request_rejected", ...)` eller
`user.emailVerifiedAt ? "magic_link" : firstEmailTemplate`, ikke det
bokstavelige `template: "x"`-mønsteret jeg lette etter). Et bredere søk
bekreftet at alle 23 faktisk er koblet til ekte kallsteder.

E-postmaltabellen er dermed fullstendig ren — ingen hull av noen art
funnet denne runden.

### Neste økt

Ingen nye kjente spec-vs-kode-hull igjen etter denne og forrige økts
grundige gjennomgang av: alle `moderation/`-, `admin/`-, `registration/`-,
`subscriptions/`-, `journalists/`- og `me/`-modulene (guard-asymmetri),
hele API-ruteinventaret (seksjon 20), og hele e-postmaltabellen
(seksjon 15). Videre arbeid bør trolig enten (a) plukke opp én av de
lengre utestående, bevisst blokkerte postene (Brevo-integrasjon når en
API-nøkkel finnes, resten av komponentbiblioteket ved konkret behov,
OG-delingsbilde når visuell identitet er besluttet), eller (b) lete etter
en HELT ANNEN klasse hull enn de tre allerede uttømte denne økten —
f.eks. en diff av datamodellen (seksjon 19) mot det faktiske
Drizzle-schemaet, samme teknikk anvendt på et tredje inventar.

---

## Fortsettelse av økt 7 — datamodellen (seksjon 19) diffet mot Drizzle-schemaet: ett feltnavn-hull, ETT REELT ATFERDSHULL, og fem feilaktige spec-henvisninger rettet

Gjorde punkt (b) fra forrige "Neste økt" — sammenlignet hver av de 15
entitetene i seksjon 19 (`Country` gjennom `Session`) felt for felt mot
`src/db/schema.ts`. De aller fleste var perfekte 1:1-treff (`Country`,
`LegalDocument`, `User`, `ModeratorCountry`, `JournalistProfile`,
`Request` — inkludert at `approved`-verdien korrekt forblir fjernet fra
`request_status`-enumen fra en tidligere økt —, `Response`,
`ContactRequest`, `EmailSubscription`, `DigestDelivery`, `ConsentRecord`,
`AuditLog`, `Suppression`, `AuthToken`). To avvik ble funnet:

1. **`Digest` manglet `created_at` i spec-listen** — schemaet har den
   (som alle andre tabeller), spec-teksten hadde bare glemt å liste den.
   Lagt til i spec-en, ingen kodeendring.

2. **Et REELT atferdshull, ikke bare et dokumentasjonshull**: `Session`
   sitt `last_used_at`-felt eksisterer i schemaet, men ble ALDRI satt av
   noen kode noe sted — samme klasse funn som `hidden_by_moderator`/
   `manual` fra forrige økt (en kolonne bygget for et formål, men aldri
   koblet til). Denne var derimot alvorligere: SPEC-V1.md 6.1 sier
   eksplisitt "Økt for mottaker og journalist: 30 dager, FORNYES VED
   BRUK" — et glidende vindu — men `getCurrentSession()` fornyet
   ingenting; øktens `expires_at` sto fast fra innlogging uansett hvor
   ofte kontoen ble brukt, i praksis identisk med
   moderator/administrator-øktene som EKSPLISITT ikke skal fornyes (6.3).
   `createSession()`s egen kommentar hevdet endog at dette var et BEVISST
   valg ("samme 'ingen stille fornyelse'-prinsipp for alle roller"), noe
   som direkte motsa 6.1s tekst.

   Rettet: `getCurrentSession()` kaller nå en ny `renewSessionIfApplicable()`
   som skyver `expires_at` frem til `now + 30 dager` OG setter
   `last_used_at` for mottaker/journalist ved hver gyldig bruk, og setter
   bare `last_used_at` (uendret `expires_at`) for moderator/administrator.

   **Bevisst UFULLSTENDIG, dokumentert eksplisitt** (ikke glattet over):
   dette fornyer kun DATABASE-sannheten, ikke selve `kb_session`-
   informasjonskapselens egen nettleser-utløpsdato (satt én gang i
   `createSession()` og aldri siden). Next.js tillater `cookies().set()`
   KUN fra en Server Action eller Route Handler — `getCurrentSession()`
   kalles derimot også fra over et dusin vanlige Server Component-sider
   (`me/page.tsx`, `admin/page.tsx` m.fl.), der et slikt kall ville
   KASTET og knekt siden. En fullt korrekt løsning krever enten å skille
   kallernes kontekst (én variant for Route Handler-ruter som KAN fornye
   cookien) eller å flytte selve fornyelsen til `middleware.ts` (som
   kjører på hver sideforespørsel og kan sette responscookies, men i dag
   verken dekker `/api`-ruter eller gjør databasekall). En så bred endring
   på tvers av 30+ kallsteder i sikkerhetskritisk kode ble bevisst IKKE
   forsøkt i samme slengen som selve funnet — det fortjener en egen,
   grundig gjennomgått økt. Uten den fullførende cookie-fornyelsen
   forblir den brukeropplevde effekten av denne fiksen begrenset (økten
   fornyes i databasen, men nettleseren dropper likevel cookien etter 30
   dager fra INNLOGGING, ikke fra siste bruk) — men den underliggende
   datamodell-sannheten er nå korrekt, og et fremtidig cookie-fiks har nå
   `last_used_at` å bygge videre på.

3. **Fem stedfortredende spec-henvisningsfeil oppdaget underveis**:
   `Session`/`AuthToken` i seksjon 19.14/19.15, og fire kodekommentarer
   (`session.ts`, `magic-link.ts`, `account-deletion.ts`, `schema.ts`) samt
   to testfilnavn (`session.integration.test.ts`,
   `magic-link.integration.test.ts`) siterte "8.1"/"8.3" som kilden for
   økt-/token-levetider — men 8.1 handler om journalisters
   `verification_status`, IKKE øktlevetid. De faktiske reglene står i 6.1
   (mottaker/journalist: 30 dager, fornyes ved bruk; magic link: 15
   minutter, maks 5 forespørsler) og 6.3 (moderator/administrator: 12
   timer). Rettet alle henvisningene — bekreftet at ALLE andre "8.1"-
   referanser i kodebasen (journalistregistrering, moderation/users.ts,
   schema.ts sin verification_status-kommentar) faktisk ER korrekte, siden
   8.1 dekker BÅDE `verification_status` og det delte `User.status`-feltet.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**335
tester**, uendret), `i18n:check` (**387 nøkler**, uendret), `design:check-tokens`
(**40** komponent-CSS-filer, uendret), `rm -rf .next && next build`
(grønn), `test:integration` mot ekte lokal Postgres (**219 tester**, +2 —
kjørt 3 ganger på rad, alle grønne, gitt at endringen rører
sikkerhetskritisk økt-kode brukt av over 30 kallsteder).

### Neste økt

(1) Det viktigste gjenstående: en gjennomtenkt, isolert økt viet UTELUKKENDE
til å fullføre øktfornyelsen med faktisk cookie-fornyelse (enten via
kontekst-atskilte funksjoner for Route Handler- vs. Server Component-
kallere, eller via `middleware.ts` utvidet til databasekall og
`/api`-dekning) — IKKE noe å haste gjennom sammen med annet arbeid, gitt
hvor sikkerhetskritisk og bredt brukt denne koden er; (2) datamodell-diffen
fant ingen andre hull enn de to over — resten av seksjon 19 stemmer
allerede fullstendig med schemaet; (3) Brevo-integrasjon, resten av
komponentbiblioteket, og OG-delingsbilde forblir alle korrekt blokkert.

---

## Fortsettelse av økt 7 — den viktigste gjenstående posten fullført: kb_session-cookien fornyes nå faktisk ved bruk (SPEC-V1.md 6.1)

Viet HELE denne runden utelukkende til punkt (1) fra forrige "Neste økt",
akkurat som anbefalt der — ingen annet arbeid blandet inn.

**Løsningen som ble valgt, og hvorfor**: vurderte de to skisserte
alternativene (kontekst-atskilte funksjoner for hvert av de 30+
kallstedene til `getCurrentSession()`, vs. en databasebevisst utvidelse
av `middleware.ts`) og landet på en TREDJE, enklere og tryggere modell.
Innsikten: selve informasjonskapselens nettleser-side utløpsdato er ALDRI
den egentlige autoriteten for om en økt er gyldig — det er, og har alltid
vært, `sessions.expires_at`/`revoked_at`, sjekket server-side i
`getCurrentSession()` (som allerede korrekt fornyer DATABASE-raden ved
bruk, fra forrige økts fiks). Å forlenge KUN informasjonskapselens egen
levetid, UTEN noe databaseoppslag i det hele tatt, gir derfor aldri mer
tilgang enn databasen uansett tillater — det er bare et
nettleser-side "hold denne litt lenger"-hint. Dette gjorde det trygt å
gjøre BLINDT i `middleware.ts`, som kjører på HVER forespørsel (etter å
ha utvidet matcher-en til også å dekke `/api`, som tidligere var
ekskludert) og alltid kan sette responscookies — uten et eneste
databasekall, og uten å røre noen av de 30+ eksisterende kallstedene til
`getCurrentSession()`.

Implementert i `src/middleware.ts`:
- `renewSessionCookie(request, response)`: leser `kb_session`-cookien fra
  forespørselen, og hvis den finnes, setter den på nytt på responsen med
  samme verdi men fornyet `maxAge` (30 dager) og identiske attributter som
  `createSession()` selv bruker (`httpOnly`, `secure`, `sameSite: "lax"`,
  `path: "/"`).
- Kalt fra `middleware()` for BÅDE vanlige sider (etter locale-/CSP-logikken)
  OG for `/api`-stier (en egen tidlig gren som HOPPER OVER locale-ruting
  og CSP-header-setting for API-responser — samme oppførsel som før, siden
  `/api` uansett aldri gikk gjennom denne logikken tidligere).
- `config.matcher` utvidet fra å ekskludere `/api` til å inkludere det —
  eneste grunn er punkt 3, ellers uendret oppførsel for API-ruter.
- Gjelder BEVISST likt for alle roller, inkludert moderator/administrator
  — deres økt fornyes ALDRI i databasen (6.3), så selv om cookien deres
  nettleser-side får samme 30-dagers levetid, vil `getCurrentSession()`
  fortsatt korrekt avvise den etter 12 timer. Ufarlig, dokumentert
  eksplisitt i kodekommentaren.
- Oppdaterte `getCurrentSession()`s egen docstring til å beskrive den nye,
  FULLFØRTE løsningen i stedet for forrige økts "bevisst ufullstendig"-notat.

**Testet på tre nivåer**: (1) 5 nye enhetstester i `middleware.test.ts`
(cookie fornyes med riktige attributter når den finnes; ingen cookie
settes når ingen fantes; fornyes også for `/api`-stier UTEN at CSP/nonce
settes der; en `/api`-forespørsel uten cookie passerer uendret; fornyes
selv på selve locale-redirect-responsen). (2) Alle eksisterende
lokalrutings-tester i samme fil fortsatt grønne, uendret oppførsel
bekreftet. (3) **Manuell ende-til-ende-verifisering i en ekte kjørende
dev-server** (`next dev` mot ekte lokal Postgres) — bekreftet med `curl`:
en forespørsel med et vilkårlig (ugyldig) `kb_session`-cookie fikk en
korrekt fornyet `Set-Cookie`-header (`Max-Age=2592000; Secure; HttpOnly;
SameSite=lax`) OG ble fortsatt korrekt omdirigert til innlogging (307 →
`/logg-inn`) siden det ugyldige tokenet uansett avvises server-side —
nøyaktig den tiltenkte "blind fornyelse, databasen forblir autoriteten"-
oppførselen. Bekreftet også at rot-URL-en sin locale-omdirigering og
`/api/countries` (både med og uten cookie) fortsatt fungerer identisk til
før endringen.

Med dette er "fornyes ved bruk" (6.1) fullt implementert ende til ende —
BÅDE database-sannheten (forrige økt) OG selve nettleser-cookien (denne
økten).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**340
tester**, +5 — de nye middleware-testene), `i18n:check` (**387 nøkler**,
uendret), `design:check-tokens` (**40** komponent-CSS-filer, uendret),
`rm -rf .next && next build` (grønn, Middleware-bunten uendret i
størrelse), `test:integration` mot ekte lokal Postgres (**219 tester**,
uendret — ingen nye integrasjonstester denne runden, siden middleware
testes uten database), PLUSS den manuelle dev-server-verifiseringen
beskrevet over.

### Neste økt

Øktfornyelsen (6.1) er nå fullstendig implementert og verifisert på alle
nivåer — ingen kjent gjenstående del av dette hullet. Kandidater videre:
(1) et nytt, bredt søk etter enda en klasse spec-vs-kode-hull (samme
metodikk som har funnet noe hver økt så langt — datamodell, ruter,
e-postmaler og nå øktfornyelse er alle uttømt); (2) Brevo-integrasjon,
resten av komponentbiblioteket, og OG-delingsbilde forblir alle korrekt
blokkert (se punktene notert i tidligere økter).

---

## Fortsettelse av økt 7 — alle 40 FR-xxx (seksjon 22) systematisk sjekket mot kode: ett reelt hull funnet og rettet (FR-009)

Gjorde punkt (1) fra forrige "Neste økt", på et nytt inventar: seksjon 22
("Funksjonelle krav") lister 40 nummererte krav (FR-001 til FR-054) med et
eksplisitt "verifiseres ved"-kriterium hver — en ferdig sjekkliste,
akkurat som rutelisten (seksjon 20) og datamodellen (seksjon 19) var.
Gikk gjennom alle seks kategoriene (registrering/konto, språk/land,
forespørsler, utsendelse, svar/kontakt, administrasjon) og krysset hver
mot faktisk kode.

**Fant ett reelt hull, FR-009**: "Systemet skal ikke tilby en locale i et
land der vilkår eller personvernerklæring mangler i den locale-en" —
verifiseres ved at "locale fjernes fra available_locales i
API-responsen når et dokument mangler." `GET /countries` returnerte
derimot `available_locales` HELT RÅTT, rett fra `countries`-tabellen,
uten noen sjekk mot om `legal_documents` faktisk fantes for den locale-en.
Både `SubscribeForm.tsx` (mottakerregistrering, 7.1) og
`JournalistApplyForm.tsx` (journalistsøknad, 7.2) bygger sine
språknedtrekk direkte fra dette feltet — en bruker kunne dermed velge en
locale i skjemaet som deretter (korrekt, men for sent) ble avvist med
`errors.legal_documents_unavailable` ved selve innsendingen, i stedet for
å aldri vises som et alternativ i utgangspunktet.

**Bevisst IKKE en global filtrering på selve ruten** — `RequestEditForm.tsx`
(journalistens språkvalg for FORESPØRSELSINNHOLDET) henter riktignok ikke
engang fra denne ruten, men ANDRE fremtidige forbrukere av `/countries`
kunne trenge ufiltrerte locales av gode grunner som ikke har noe med
registrering å gjøre. Løsningen ble derfor en VALGFRI spørreparameter:

- `src/lib/countries/countries.ts` (ny fil) — `listActiveCountries(requiredDocumentTypes?)`.
  Uten parameteren: nøyaktig samme oppførsel som før (ufiltrert). Med
  parameteren: filtrerer hvert lands `available_locales` ned til KUN de
  locale-ene der `getRequiredLegalDocuments()` (allerede eksisterende
  funksjon) bekrefter at ALLE de forespurte dokumenttypene er publisert.
- `GET /api/countries?requireDocumentTypes=terms,privacy` (ruten selv,
  nå tynn og delegerende, samme mønster som resten av kodebasen).
- `SubscribeForm.tsx` og `ChangeCountryForm.tsx` (som begge krever
  terms+privacy, jf. `registerRecipient()`/`changeCountry()`) ber nå om
  `?requireDocumentTypes=terms,privacy`. `JournalistApplyForm.tsx` (som
  krever `journalist_terms` spesifikt, jf. `applyAsJournalist()`) ber om
  `?requireDocumentTypes=journalist_terms`.
- `countries.integration.test.ts` (ny fil, 5 tester): ufiltrert som før
  uten parameteren; fjerner en locale der ETT av flere påkrevde dokumenter
  mangler; beholder en locale kun når ALLE finnes; fjerner ALLE locales
  når landet mangler alt; ekskluderer ikke-`active`-land uendret.

**Resten av de 40 kravene** ble spot-sjekket mot faktisk kode
(job-kommentarer med riktig FR-nummer, cron-tidsplan i `netlify.toml`
mot FR-026s "innen 15 minutter", `MAX_CONCURRENT_PUBLISHED`-konstanten mot
FR-029, `submitResponse()`s statussjekk mot FR-002, m.fl.) — ingen andre
reelle hull funnet. Noen krav (FR-013, FR-015, FR-052) er eksplisitt
"kodegjennomgang"-verifiserbare i spec-en selv, ikke automatiserte tester,
og ble derfor kun visuelt inspisert, ikke testkjørt.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**340
tester**, uendret — ingen nye enhetstester, kun integrasjonstester denne
runden), `i18n:check` (**387 nøkler**, uendret), `design:check-tokens`
(**40** komponent-CSS-filer, uendret), `rm -rf .next && next build`
(grønn), `test:integration` mot ekte lokal Postgres (**224 tester**, +5).
PLUSS manuell verifisering i en kjørende dev-server mot ekte lokal
Postgres: bekreftet med `curl` at `/api/countries` uten parameter
fortsatt returnerer begge locale-ene til testlandet "XT" uendret, mens
`?requireDocumentTypes=terms,privacy` korrekt fjerner `en-GB` (som
mangler personvernerklæring i utviklingsdatabasen) og beholder kun
`nb-NO`; bekreftet at `/subscribe`, `/journalists/apply` og
`/me/bytt-land` alle fortsatt laster/omdirigerer korrekt.

### Neste økt

Ingen kjente gjenstående hull i de 40 FR-kravene. Fire inventarer er nå
uttømmende diffet mot kode over denne og forrige økt: datamodellen
(seksjon 19), API-ruter (seksjon 20), e-postmaler (seksjon 15), og
funksjonelle krav (seksjon 22). Neste gode kandidat: seksjon 23
("Akseptansekriterier for lansering") — samme teknikk, et femte inventar.
Ellers: Brevo-integrasjon, resten av komponentbiblioteket, og
OG-delingsbilde forblir alle korrekt blokkert.

---

## Fortsettelse av økt 7 — seksjon 23 (akseptansekriterier) sjekket: fant og rettet en KRITISK, tidligere ALDRI kjørt bug i selve digest-jobben

Startet punkt (1) fra forrige "Neste økt" — seksjon 23s 20-punkts kjede
("V1 er klar når hele denne kjeden kan gjennomføres"). Denne seksjonen er
strukturelt annerledes enn de fire forrige inventarene (ingen liste av
entiteter/ruter/maler/krav å krysse felt for felt) — den beskriver en
sammenhengende BRUKERREISE. Sjekket derfor i stedet: har hvert steg i
kjeden noen gang blitt verifisert, alene ELLER sammen med de andre?

**Punkt 15** ("Ingen svar, mottakerprofiler eller journalistsider er
tilgjengelige uten innlogging eller indekserbare av søkemotorer") ble
grundig sjekket først: bekreftet at `layout.tsx` har `robots: {index:
false}` som global standard, med NØYAKTIG én eksplisitt override (den
offentlige forespørselssiden) — og at samtlige 8 private `page.tsx`-filer
(admin/*, journalist/*, contact-requests/[id], me/*) faktisk kaller
`getCurrentSession()` og omdirigerer til innlogging uten den. Ingen hull.

**Punkt 4** ("Digest-jobben kjører ... og leverer forespørselen til alle
aktive abonnenter") ledet til det virkelig store funnet: `runDigestTick()`
i `tick.ts` var den ENESTE av jobbfilens seks jobber som ALDRI var
eksportert eller direkte testet — testfilens egen kommentar hadde
(feilaktig) antatt den var like upraktisk å teste som `runTick()` selv
(pga. `shouldRunDailyJobNow()`s vegg-klokke-avhengighet), men
`runDigestTick` har sin EGEN, uavhengige, lett testbare klokkeslett-vakt
per land og er IKKE gatet av `shouldRunDailyJobNow()` i det hele tatt
(kun `purge-unverified`/`retention` er). Eksporterte den og skrev 7 nye
tester (isolert testland, samme mønster som forrige økters
`dashboard.ts`/`countries.ts`-tester) — og den environment aller FØRSTE
kjøringen med en faktisk NY publisert forespørsel å inkludere, FEILET:

```
malformed array literal: "352589d0-286b-486e-8e1e-aa77215116ec"
```

**Rotårsaken**: linjen som setter `included_in_digest_at` på de inkluderte
forespørslene brukte en rå SQL-mal (`sql\`${requests.id} = ANY(${requestIds})\``)
i stedet for Drizzles egen `inArray()`-hjelpefunksjon (brukt konsekvent
OVERALT ELLERS i kodebasen for nøyaktig dette mønsteret) — driveren
serialiserte ikke JS-arrayen riktig som en Postgres-array-literal for
`ANY()`. Siden `runDigestTick` ALDRI hadde blitt kjørt med ekte data
(ingen test, og tilsynelatende heller ingen fullstendig manuell
dev-server-verifisering som noensinne fikk en NY forespørsel helt frem til
denne spesifikke linjen), hadde denne bug-en aldri blitt utløst — verken i
utvikling eller (potensielt) i produksjon.

**Konsekvensen dette ville hatt i produksjon**: `runDigestTick`s egen
try/catch PER LAND (FR-036) ville fanget feilen og lagt den i
`errors[]` — jobben ville altså ikke krasjet HELT, men INGEN digest ville
noensinne blitt opprettet for et land DEN DAGEN det fantes en ny publisert
forespørsel å inkludere. Mottakere ville rett og slett ALDRI mottatt en
digest, stille, med ingen synlig feil utover en ubeaktet streng i et
jobbresultat ingen overvåker leser (ingen alarmering er bygget ennå). Med
andre ord: selve KJERNEFUNKSJONEN i hele produktet ("daglig utsendelse")
ville aldri fungert forbi den aller første forespørselen, i noe miljø,
til noen hadde funnet og rettet nøyaktig denne linjen manuelt.

**Rettet**: byttet til `inArray(requests.id, requestIds)` (samme
importlinje hadde allerede `inArray` fra tidligere bruk i filen — bare
`sql` selv ble nå ubrukt og fjernet fra importen).

De 7 nye testene i `tick.integration.test.ts` (egen `describe`-blokk,
isolert testland) dekker: vellykket opprettelse+utsendelse+token-rotasjon
(og bekrefter nå at feilen er borte), FR-034 (idempotent — andre tikk
samme dag oppretter ikke en ny digest), FR-031 (ingen levering til et
annet lands mottaker), FR-035 (utelater avmeldt/sprettet abonnement),
FR-032/033 (riktig locale per levering, to ulike locales), ingen tom
digest når landet ikke har nye forespørsler, og 8.1 (utelater en
suspendert journalists forespørsel).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**340
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**231
tester**, +7 — kjørt 3 ganger på rad, alle grønne, gitt hvor kritisk
denne jobben er).

### Neste økt

Fortsett resten av seksjon 23s 20 punkter — spesielt punkt 17–20
(fler-lands-/fler-språk-kjeden, som spec-en selv fremhever som de eneste
"som beviser at internasjonaliseringen faktisk virker"). Punkt 16 (SPF/
DKIM/DMARC + ekte innboks-levering) er infrastruktur/drift, ikke noe kode
kan verifisere. Ellers: Brevo-integrasjon, resten av komponentbiblioteket,
og OG-delingsbilde forblir alle korrekt blokkert.

**Tilleggssjekk samme runde** (punkt 18, "et andre språk er fullstendig
oversatt"): bekreftet at `nb-NO.json`/`en-GB.json` har PERFEKT
nøkkelparitet i begge retninger (421 nøkler hver, ingen mangler noe sted)
— punkt 18 er dermed reelt oppfylt på nøkkelnivå (oversettelsens
SPRÅKLIGE kvalitet er ikke noe kode kan verifisere). Fant underveis at
`check-keys.ts`s "387 nøkler funnet"-tall er antall `t(...)`-KALLSTEDER,
ikke unike nøkler — 93 av de 421 definerte nøklene har ingen bokstavelig
`t("nøkkel")`-treff i kildekoden, men nesten alle er forklarbare som
DYNAMISKE oppslag regex-en ikke kan fange (`t(\`request.status.${x}\`)`,
`t(result.error)` for API-feilnøkler, osv.) — bekreftet ved stikkprøve.
Ett unntak: `auth.verify.already_used` er et OVERSATT, men reelt ubrukt
strengpar — `verifyMagicLink()` returnerer bevisst bare ÉN generisk
`null`/`auth.verify.expired` for ALLE feilårsaker (19.15: "ikke to ulike
feilveier"), så den mer spesifikke meldingen ble aldri koblet til. Ufarlig
dødt innhold, ikke en funksjonell feil — IKKE ryddet bort denne runden
(lav verdi sammenlignet med resten av funnet i denne økten, og fjerning
uten videre grunn er unødvendig churn).

---

## Fortsettelse av økt 7 — punkt 19 og 20 (de to spec selv fremhever som "beviser at internasjonaliseringen faktisk virker") nå eksplisitt verifisert ende til ende

Fortsatte rett fra forrige "Neste økt": punkt 19 og 20 i seksjon 23.
Begge var strukturelt SANNSYNLIGGJORT av forrige rundes nye
`runDigestTick`-tester (som allerede brukte to ulike locales / to isolerte
land), men ingen test hadde eksplisitt PÅSTÅTT den spesifikke, navngitte
oppførselen disse to punktene beskriver. Rettet det:

**Punkt 19** ("en bruker med locale en-GB og land NO mottar den norske
digesten med engelsk ramme og norsk forespørselstekst, korrekt merket"):
la til `vi.spyOn(emailSend, "sendBulkEmail")` (kalte gjennom til den ekte
implementasjonen, bare for å FANGE argumentene) på den eksisterende
FR-032/033-testen sin natur, i en ny, dedikert test. Fanget den faktiske
`html`-en sendt til hver mottaker og bekreftet: den norske mottakeren ser
INGEN fremmedspråk-varsel (samsvarende språk), den engelske mottakeren ser
varselet PÅ ENGELSK ("This request is written in a different language
than yours" — ikke den norske teksten), og emnefeltet er forskjellig
mellom de to. Første forsøk feilet fordi TESTEN selv (ikke koden) påsto
feil språk for varselet — rettet til å forvente den faktiske engelske
oversettelsen, som beviste at "rammen" (inkludert selve varselet) korrekt
følger MOTTAKERENS locale, ikke landets standardspråk.

**Punkt 20** ("to land med ulik tidssone får hver sin digest ... og en
simulert feil i det ene påvirker ikke det andre", samme prinsipp som
FR-036): ny test med to isolerte land, der `sendBulkEmail` mockes til å
KASTE kun for én spesifikk mottakers e-postadresse (landet A), mens den
kaller gjennom til den EKTE implementasjonen for landet B. Bekreftet:
`result.processed` var 2 (begge land ble behandlet i samme tikk), land A
sin digest fikk status `failed` og sin levering markert `failed` med
feilmeldingen synlig, mens land B sin digest og levering var helt
uberørt (`sent`). Første forsøk her passerte umiddelbart — ingen bug å
rette, ren bekreftelse av at den allerede etablerte per-land/per-mottaker
try/catch-strukturen fungerer nøyaktig som FR-036 krever.

Punkt 17 ("et andre land ... uten kodeendring eller migrasjon") anses
implisitt godt bevist av at BÅDE denne og forrige rundes tester rutinemessig
oppretter helt ferske testland (`Z${randomUUID()...}`) via ren datainnsetting
— ingen migrasjon, ingen kodeendring — og disse fungerer korrekt gjennom
hele digest-pipelinen. En fullstendig, sammenhengende ETT-test-kjede
gjennom alle 14 stegene for ett slikt land ble IKKE bygget denne runden
(hvert steg er allerede godt dekket separat på tvers av mange filer) —
vurdert som lav marginalverdi sammenlignet med de mer presise, målrettede
testene denne og forrige runde faktisk la til.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**340
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**233
tester**, +2 — kjørt 3 ganger på rad, alle grønne).

### Neste økt

Seksjon 23s akseptansekriterier er nå tilstrekkelig dekket for kodens
del — punkt 16 (SPF/DKIM/DMARC + ekte innboks-levering) forblir
infrastruktur/drift, ikke kode. Fem inventarer er nå grundig
gjennomgått denne og forrige økt: datamodell (19), API-ruter (20),
e-postmaler (15), funksjonelle krav (22), og akseptansekriterier (23).
Neste gode bruk av tiden er trolig enten (a) et helt NYTT søk etter en
ANNEN klasse hull enn de som er uttømt (f.eks. INFRASTRUCTURE.md sin egen
jobbtabell mot de faktiske jobbene, eller DESIGN.md sine komponentkrav mot
faktisk bygde komponenter), eller (b) plukke opp et av de lenge utestående,
bevisst blokkerte postene (Brevo-integrasjon, resten av
komponentbiblioteket, OG-delingsbilde).

---

## Fortsettelse av økt 7 — INFRASTRUCTURE.md sin jobbtabell mot de faktiske jobbene i tick.ts

Fulgte opp forrige "Neste økt"-forslag (a): diffet `INFRASTRUCTURE.md`
seksjon 5 sin jobbtabell mot `runTick()` i `src/lib/jobs/tick.ts`, og mot
`netlify.toml` (som bekrefter at det KUN finnes én planlagt funksjon, `tick`,
med `*/15 * * * *` — ingen andre cron-linjer noe sted).

Tabellen påsto tre ulike kadenser utover "hvert 15. minutt":
`expire-contact-requests` "Daglig", `deadline-reminder` "Hver time", og
`stale-request-reminder` "Daglig". Faktisk kode: `runTick()` kaller alle tre
UBETINGET på hvert eneste 15-minutters-tikk, nøyaktig som `digest-tick`/
`expire-requests` — det finnes ingen egen time- eller døgnbasert sperre for
disse tre i det hele tatt. Bare `purge-unverified` og `retention` er
faktisk begrenset, av `shouldRunDailyJobNow()` (`hour === 3 && minute <
15`).

Vurderte om dette var et doc-hull eller et kode-hull. Landet på doc-hull:
oppførselen i koden er trygg (idempotens via `deadlineReminderSentAt`,
`staleReminderSentAt`, og status-sjekken for kontaktforespørsler — ikke via
en tidsplan som antar), enklere, og gir strengere tatt BEDRE presisjon enn
de påståtte kadensene (en påminnelse 24 timer før frist blir sjekket hvert
kvarter, ikke hver time). Å bygge tre nye separate tids-sperrer i kode bare
for å matche vilkårlig påståtte frekvenser, når prosjektet er i Stadium 0
(null brukere, gratis nivå — INFRASTRUCTURE.md 16) der ekstra
spørrefrekvens er kostnadsfritt, ville vært unødvendig kompleksitet uten
noen reell gevinst. Rettet tabellen til å si "Hvert 15. minutt" for alle
tre, med en forklarende note rett under tabellen som navngir den faktiske
idempotens-mekanismen og presiserer at kun `purge-unverified`/`retention`
er ekte døgnbegrenset.

Ingen kodeendring denne runden — rent dokumentasjonsfunn, som instruert
("spec-en er sannheten" gjelder tilsvarende for INFRASTRUCTURE.md: avdekkes
et hull mellom dokumentasjon og kode, rettes det som er feil, og her var
det tabellen som var feil, ikke koden).

Merk: `INFRASTRUCTURE.md` 5 sin åpningstekst nevner fortsatt pg-boss som
den planlagte kø-arkitekturen ("pg-boss i samme Postgres-instans");
`pg-boss` er en reell `package.json`-avhengighet, men er IKKE koblet til
noe sted i faktisk kjørende kode ennå — `tick.ts`s egen toppkommentar
bekrefter dette er bevisst utsatt til en senere vertsform ("later en
pg-boss-lytteprosess ... på Hetzner"), ikke et hull. Ikke rørt denne
runden — dette er et annet, allerede eksplisitt anerkjent utsatt punkt, ikke
den samme typen udokumentert avvik som frekvenstabellen var.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**340
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**233
tester**, uendret — ingen kodeendring, kun dokumentasjon).

### Neste økt

Denne inventaren (INFRASTRUCTURE.md sin jobbtabell) er nå avstemt mot
koden. Gjenstående kandidat fra forrige økts liste: DESIGN.md sine
komponentkrav mot faktisk bygde komponenter (ikke gjort ennå). Ellers
forblir de tre lenge utestående, bevisst blokkerte postene uendret: Brevo-
integrasjon (mangler API-nøkkel), resten av komponentbiblioteket (ingen
konkret forbruker ennå), og OG-delingsbilde (blokkert på uavklart visuell
identitet, DESIGN.md 10).

---

## Fortsettelse av økt 7 — DESIGN.md sitt komponentkrav mot faktisk bygde komponenter, og et reelt kodefunn underveis

Fulgte opp den andre halvdelen av forrige "Neste økt": diffet DESIGN.md
seksjon 6 sitt "minimumssett for v1" (17 komponenter) mot
`src/components/`. 10 av 17 er bygget (`Button`, `TextField`, `TextArea`,
`Checkbox`, `RadioGroup`, `Select`, `Badge`, `Card`, `EmptyState`,
`LanguageSwitcher`). De 7 gjenstående (`Dialog`, `Toast`, `Alert`, `Tabs`,
`Table`, `Pagination`, `SkeletonLoader`) har INGEN forbruker noe sted i
appen ennå — bekreftet ved søk etter `<table`, `role="dialog"`,
`role="alert"`, `toast`/`Toast`, `pagination` i `src/app/`: null treff.
Dette bekrefter bare den allerede riktige, tidligere beslutningen om å
utsette resten av biblioteket (ingen konkret forbruker = ingen grunn til å
bygge dem nå) — ingen ny handling der.

**Fant derimot et reelt gap i samme seksjon.** DESIGN.md 6.1 krever:
"Skjemaer med feil flytter fokus til første feilende felt." Søk etter
`.focus()` i hele `src/app/`/`src/components/` ga NULL treff — kravet var
ikke implementert i noen av de 6 skjemaene (`SubscribeForm`, `LoginForm`,
`JournalistApplyForm`, `ResponseForm`, `ReportForm`,
`RequestEditForm`). Dette er, i motsetning til INFRASTRUCTURE.md-funnet
tidligere i denne økten, et ekte KODE-hull, ikke et dokumentasjons-hull —
kravet er en bevisst, navngitt tilgjengelighetsbeslutning i DESIGN.md sitt
eget "Fokus og feil"-avsnitt, ikke noe koden gjør annerledes av en god
grunn.

Rettet det: ny `src/lib/forms/focus-first-invalid.ts` med
`focusFirstInvalidField(formRef)` — finner første element med
`aria-invalid="true"` inni skjemaet (React Aria Components setter dette
attributtet automatisk på selve det fokuserbare elementet når `isInvalid`
er sant, uansett om det er `TextField`, `Select`, `Checkbox` eller
`RadioGroup`) og fokuserer det, via `requestAnimationFrame` slik at
søket skjer ETTER at React har committet de nye `aria-invalid`-
attributtene. Koblet inn i alle 6 skjemaene: de 5 med synkron
klient-validering kaller den rett etter `setAttempted(true)` når
`formValid` er usann, og `RequestEditForm` (som får feil asynkront
tilbake fra serveren) kaller den rett etter hver `setFieldErrors(...)`
ved en mislykket lagring/innsending.

Ny enhetstest for selve hjelperen (3 tester: fokuserer riktig felt,
gjør ingenting uten ugyldige felt, gjør ingenting uten et `formRef`), og
en ny test i `LoginForm.test.tsx` som bekrefter den FAKTISKE oppførselen
ende-til-ende i en ekte gjengitt komponent (ikke bare hjelperen isolert):
e-postfeltet får fokus etter et mislykket innsendingsforsøk.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**344
tester**, +4 — ny hjelpertest-fil og én ny test i `LoginForm.test.tsx`),
`i18n:check` (**387 nøkler**, uendret), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn),
`test:integration` mot ekte lokal Postgres (**233 tester**, uendret —
ingen databaseendring).

### Neste økt

Både INFRASTRUCTURE.md sin jobbtabell og DESIGN.md sitt komponentkrav er
nå avstemt mot koden denne økten. Ingen nye inventar-kandidater er
identifisert ennå. Neste gode bruk av tiden: enten et helt nytt
inventar-søk (gjennomgå seksjoner av SPEC-V1.md/DESIGN.md/
INFRASTRUCTURE.md som ikke er sjekket ennå), eller plukke opp et av de tre
lenge utestående, bevisst blokkerte postene (Brevo-integrasjon, resten av
komponentbiblioteket — fortsatt uten forbruker, OG-delingsbilde).

---

## Fortsettelse av økt 7 — faktisk Brevo-integrasjon (transaksjonelt + bulk)

Plukket opp den første av de tre lenge utestående, bevisst blokkerte
postene: Brevo-integrasjonen i `src/lib/email/send.ts`. Denne var reelt
utsatt fordi vi ikke har en ekte API-nøkkel/nettverkstilgang til Brevo i
denne økten — MEN selve API-kallet kan skrives og testes fullstendig med
en mocket `fetch`, uten en ekte nøkkel. Det var derfor ikke reelt blokkert,
bare ikke gjort ennå.

**Implementert:** en delt `sendViaBrevo()`-hjelper som POSTer mot Brevo sitt
`v3/smtp/email`-endepunkt (rå `fetch`, ikke Brevo sitt Node-SDK — samme
"tynn adapter"-prinsipp som resten av filen). Både `sendTransactionalEmail`
og `sendBulkEmail` bruker NÅ dette samme endepunktet — IKKE et separat
kampanje-/liste-API for bulk, som den gamle doc-kommentaren antydet.
Begrunnelse notert i kildekoden: Brevo sitt kampanje-API er bygget for
maler mot kontaktlister, ikke individuelt rendret innhold per mottaker
(hver digest er allerede unik per mottaker). Atskillelsen mellom
strømmene (`INFRASTRUCTURE.md` 6.1) ligger i stedet i `BREVO_SENDER_
TRANSACTIONAL` vs. `BREVO_SENDER_BULK` (eget avsenderdomene per strøm,
6.3) og i `List-Unsubscribe`/`List-Unsubscribe-Post`-headerne (FR-038) på
bulk-kallet.

Feilhåndtering: mangler `BREVO_API_KEY`, brukes fortsatt den gamle,
uendrede konsoll-stub-veien (ingen regresjon i eksisterende oppførsel —
ALLE 60+ eksisterende tester stubber allerede `BREVO_API_KEY` til tom
streng, og disse forble grønne uendret). Er `BREVO_API_KEY` satt, men
`BREVO_SENDER_TRANSACTIONAL`/`BREVO_SENDER_BULK` mangler, eller malen ikke
kan rendres (ukjent kombinasjon av mal/data), kastes en tydelig feil FØR
noe HTTP-kall gjøres — ingen taus feil. Svarer Brevo med en feilstatus,
kastes en feil med status og responskropp, slik at `tick.ts` sin
eksisterende per-mottaker/per-land try/catch (FR-036) fanger den akkurat
som en hvilken som helst annen sendefeil.

**Ny test-suite** i `send.test.ts` (7 nye tester, mocket `fetch`): riktig
URL/metode/headere/kropp for transaksjonell sending, kaster ved Brevo-
feilstatus, kaster (uten å kalle Brevo) når avsenderadresse mangler, kaster
(uten å kalle Brevo) når malen ikke kan rendres, stub-loggen for bulk
uendret uten nøkkel, riktig avsender/mottaker/`List-Unsubscribe`-headere
for bulk, og kaster (uten å kalle Brevo) når bulk-avsenderen mangler.

**Ærlig forbehold, notert i kildekoden akkurat som i webhook-ruten fra
tidligere:** selve endepunktet, feltnavnene og responsformen er IKKE
verifisert mot en ekte Brevo-konto denne økten (ingen nettverkstilgang) —
bygget fra kjent, stabil, offentlig dokumentert Brevo v3-API-oppførsel.
Må bekreftes mot en ekte testsending før dette kobles til produksjon.

**Sidefunn under verifisering:** den lokale Postgres-klyngen (`pg_ctlcluster
16 main`) hadde stoppet siden forrige økt (ikke Docker — en ren
systemd-uavhengig cluster, `service`/`systemctl` fungerer ikke i dette
miljøet). Startet den på nytt med `pg_ctlcluster 16 main start`. Første
kjøring av hele integrasjonssuiten etterpå ga to ISOLERTE, ikke-
reproduserbare feil (én forsvant ved å kjøre samme testfil alene, én
forsvant ved neste fulle kjøring) — vurdert som forbigående tilstand fra
den avbrutte forrige kjøringen (ECONNREFUSED-feilene) eller en race i
parallelle testarbeidere mot den delte databasen, IKKE en reell regresjon
fra denne øktens kodeendring (som ikke rører forespørsels-/kontonøkler i
det hele tatt). Bekreftet ved 2 påfølgende fulle kjøringer med 233/233
grønt.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**351
tester**, +7), `i18n:check` (**387 nøkler**, uendret), `design:check-
tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next && next
build` (grønn), `test:integration` mot ekte lokal Postgres (**233
tester**, uendret i antall — kjørt 3 ganger etter at Postgres ble startet
på nytt, grønt de to siste gangene).

### Neste økt

Brevo-integrasjonen er nå kodemessig ferdig, men UBEKREFTET mot en ekte
konto — dette bør testes med en ekte nøkkel før produksjonsbruk, noe
denne økten ikke har tilgang til å gjøre. Gjenstående av de tre lenge
utestående postene: resten av komponentbiblioteket (fortsatt uten
forbruker, ingen grunn til å bygge ennå) og OG-delingsbilde (blokkert på
uavklart visuell identitet). Neste gode bruk av tiden er trolig et nytt
inventar-søk i en seksjon av SPEC-V1.md/DESIGN.md/INFRASTRUCTURE.md som
ikke er dekket ennå.

---

## Fortsettelse av økt 7 — nytt inventar: SPEC-V1.md 18 (Sikkerhet) mot faktisk kode, to reelle hull funnet og rettet

Nytt inventar-søk, siden 18 ("Sikkerhet") aldri var diffet mot koden
denne økten (i motsetning til 19/20/22/23/26 som alle er gjennomgått
tidligere). Seksjonen er en konkret, sjekkbar punktliste — grepet hvert
punkt mot koden:

- HTTPS/HSTS: satt i `next.config.mjs`. CSP med nonce: satt i
  `middleware.ts`. Parametriserte spørringer: Drizzle ORM håndterer dette
  automatisk. Tokens hashet: bekreftet tidligere økter (`auth/tokens.ts`).
  Revisjonslogg: `audit_logs`-tabellen finnes og brukes. Alt dette var
  allerede på plass — ingen handling.
- **To reelle, totalt fraværende hull:** "CSRF-beskyttelse på alle
  tilstandsendrende endepunkter" og de tre navngitte rate-grensene ("5
  innloggingsforespørsler per adresse per 15 min, 10 svarinnsendinger per
  konto per time, 20 forespørselsopprettelser per journalist per døgn") —
  null treff på `csrf`/`CSRF` i hele kildekoden, og null treff på
  rate-limiting-mønstre UTENFOR login-fasen.

**Viktig selvkorreksjon underveis:** mitt første grep etter rate limiting
(`rateLimit`/`rate.limit`/`RateLimit`) ga null treff og fikk meg til å tro
alle tre grensene manglet. Ved nærmere lesing av `src/lib/auth/
magic-link.ts` viste det seg at login-grensen (5 per 15 min) FAKTISK var
implementert og TESTET allerede (`MAX_REQUESTS_PER_WINDOW`/
`RATE_LIMIT_WINDOW_MS`, egne navn, derfor usynlig for det første søket) —
allerede dekket av en test i `magic-link.integration.test.ts` fra en
tidligere økt. Kun de to ANDRE grensene (svar/forespørselopprettelse) var
reelt fraværende. Notert her fordi det er en påminnelse om at et
enkelt nøkkelordsøk kan gi falske positiver — alltid les den faktiske
implementasjonen før man konkluderer at noe mangler.

**CSRF (Origin-verifisering, ikke synkroniserings-tokens):** ny
`rejectCrossOriginMutation()` i `middleware.ts`, kjørt for alle
`/api`-forespørsler med en "utrygg" metode (POST/PUT/PATCH/DELETE). Avviser
med 403 (`errors.not_authorized`) hvis `Origin`-headeren finnes OG ikke
matcher forespørselens eget opphav. Mangler `Origin` helt (webhooken fra
Brevo, e-postklienters "one-click"-utmelding), slippes forespørselen
gjennom uendret — disse bærer ikke øktinformasjonskapselen automatisk, så
CSRF-trusselen gjelder ikke dem, og de er allerede beskyttet av egne
mekanismer (delt hemmelighet, engangstoken). Valgt fremfor synkroniserings-
tokens fordi det krever null ny tilstand og dekker samme trussel — OWASP sin
egen anbefalte metode for akkurat dette. 5 nye tester i `middleware.test.ts`.

**Rate limiting for de to gjenstående grensene:** ny, generisk
`checkRateLimit()` i `src/lib/security/rate-limit.ts`, DB-basert
sliding-window-teller mot en ny tabell. Lagt til datamodellen FØRST
(SPEC-V1.md 19.16 `RateLimitHit`, "sytten tabeller" oppdatert fra
"seksten"), deretter schema.ts, deretter selve funksjonen — spec er
sannheten, rettet i riktig rekkefølge. Selvrenskende: hvert kall sletter
rader eldre enn EGET tidsvindu for samme bucket først, ingen egen
opprydningsjobb trengs. Koblet inn i `submitResponse()` (bucket
`response:<bruker-id>`, 10/time) og `createDraft()` (bucket
`request:<journalist-id>`, 20/døgn) — samme sted som login-grensen
allerede lå (i lib-funksjonen, ikke route-handleren), for konsistens.
Ny feilnøkkel `errors.rate_limited` lagt til i begge språkfiler, rutene
mapper den til HTTP 429. Ny migrasjon `0008_skinny_black_queen.sql`
generert og kjørt mot testdatabasen.

**Testdekning:** ny `rate-limit.integration.test.ts` (4 tester: tillater
opp til grensen, avviser deretter uten å legge til flere rader, teller
bucketer uavhengig, sletter rader eldre enn vinduet før telling). Ny test
i `responses.integration.test.ts` (det 11. svaret på under en time
avvises) og `requests.integration.test.ts` (den 21. opprettelsen på under
et døgn avvises).

**Sidefunn under verifisering:** den lokale Postgres-klyngen hadde stoppet
på nytt siden forrige deløkt (samme som forrige gang — ikke en varig
løsning, bare `pg_ctlcluster 16 main start` på nytt). Startet den igjen
før integrasjonssuiten kjørte.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**356
tester**, +5), `i18n:check` (**387 nøkler**, uendret — `errors.rate_limited`
er en dynamisk oppslått feilnøkkel, samme kategori som andre API-feilkoder
check-keys ikke fanger statisk), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn, kjørt
i bakgrunnen pga. tidsbruk), `test:integration` mot ekte lokal Postgres
(**239 tester**, +6, alle grønne).

### Neste økt

Begge de fraværende sikkerhetskravene fra SPEC-V1.md 18 er nå dekket.
Gjenstående, ikke-kodesjekkbare punkter i samme seksjon (databasekryptering
i hvile, sikkerhetskopi/RPO/RTO, secret manager) er infrastruktur/drift,
ikke noe kode kan verifisere eller bygge. Ellers uendret: resten av
komponentbiblioteket (fortsatt uten forbruker) og OG-delingsbilde
(blokkert på uavklart visuell identitet). Et godt neste steg er trolig
seksjon 5 (Brukerreiser) eller 21 (Ikke-funksjonelle krav) i SPEC-V1.md —
begge er ennå ikke spesifikt diffet mot koden denne økten.

---

## Fortsettelse av økt 7 — SPEC-V1.md 21 (Ikke-funksjonelle krav) mot faktisk kode, to reelle hull funnet

Nytt inventar, per forrige "Neste økt": seksjon 21 (Ytelse, Tilgjengelighet,
Internasjonalisering, Øvrig, Analyse) mot koden. Mesteparten var allerede
riktig eller er infrastruktur/drift (ytelse, oppetid, EØS-plassering,
sikkerhetskopi — ikke noe kode kan bygge eller verifisere). Sjekket
konkret, kodesjekkbare punkter:

- CI feiler på manglende nøkkel i nb-NO, advarer (ikke feiler) på manglende
  nøkkel i andre språk: `check-keys.ts` dekker første halvdel (feiler
  build), og runtime-fallback-kjeden i `get-messages.ts` dekker andre
  halvdel (logger en advarsel og faller tilbake, akkurat som spec-en sier)
  — riktig lag for hver av de to kravene, ingen handling.
- Locale-aware sortering: eneste `.sort()`-kallet i kildekoden
  (`admin/page.tsx`, landkoder) bruker allerede `localeCompare`. Ingen
  handling.
- **Reelt hull 1 — manglende ICU-flertallsformer:** `journalist.inbox.
  total_label` (en-GB: "{count} responses total") og `.contact_requests_
  label` (begge språk: "{count} kontaktforespørsler"/"{count} contact
  requests") hardkodet flertallsform uansett antall — "1 responses total",
  "1 kontaktforespørsler" for et faktisk antall på 1 (feltene
  `summary.totalResponses`/`summary.contactRequestCount` i
  `journalist/requests/[id]/responses/page.tsx` kan reelt være 1). Direkte
  brudd på 21.3: "Alle strenger i ICU MessageFormat, med flertallsformer
  der det er relevant." Rettet til samme `{count, plural, one {...} other
  {...}}`-mønster som allerede brukes i `digest.subject`. `unread_label`/
  `shortlisted_label` trengte IKKE retting — adjektiv, ikke substantiv,
  bøyes ikke i noen av språkene her. Ny `get-messages.test.ts` (2 tester)
  bekrefter riktig bøying for telling 0/1/flere i begge språk.
- **Reelt hull 2 — manglende element-nivå `lang`:** 21.2 krever
  "`lang`-attributt ... på elementnivå der innhold har et annet språk enn
  siden". Dokumentnivået var allerede riktig (`<html lang=...>` i både
  `app/[locale]/layout.tsx` og e-postens egen `<html>`), men selve
  forespørselsteksten (tittel/oppsummering/beskrivelse/stedsnotat — alt
  journalist-forfattet i `request.content_language`, ofte annerledes enn
  leserens/mottakerens locale) hadde INGEN `lang`-attributt noe sted, kun
  en tekstlig "dette er på et annet språk"-varsel. En skjermleser ville
  lest en norsk forespørsel med engelsk uttale for en engelsk mottaker,
  nøyaktig scenarioet 21.2 selv beskriver. Rettet TO steder: den offentlige
  forespørselssiden (`foresporsler/[id]/[slug]/page.tsx` — tittel,
  oppsummering, beskrivelse, målpersonbeskrivelse) og den daglige digesten
  (`lib/email/digest.ts` — tittel, oppsummering, stedsnotat), begge satt
  til forespørselens EGET `contentLanguage`, ubetinget (riktig uansett om
  det tilfeldigvis matcher siden/mottakerens locale, enklere enn en
  betinget sjekk). Ny test i `digest.test.ts` (1 test) bekrefter
  `lang="en-GB"` på riktige elementer i en fremmedspråklig forespørsel i en
  norsk digest. Ingen ny test på selve web-siden — ren JSX-attributtending
  uten eksisterende testoppsett for den filen, dekket av tsc/build i
  stedet.

**Sidefunn under verifisering:** den lokale Postgres-klyngen hadde stoppet
igjen (tredje gang denne økten) — startet på nytt med `pg_ctlcluster 16
main start` før integrasjonssuiten kjørte. Ingen varig løsning funnet for
hvorfor klyngen stopper mellom deløkter; bare notert som et gjentakende,
lavkost oppstartssteg.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**359
tester**, +3), `i18n:check` (**387 nøkler**, uendret — kun verdier endret,
ingen nye/fjernede nøkler), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn),
`test:integration` mot ekte lokal Postgres (**239 tester**, uendret — ingen
databaseendring denne runden).

### Neste økt

Seksjon 21 er nå tilstrekkelig gjennomgått for kodens del. Gjenstående
udiffet inventar: seksjon 5 (Brukerreiser) i SPEC-V1.md. Ellers uendret:
resten av komponentbiblioteket (fortsatt uten forbruker), OG-delingsbilde
(blokkert på uavklart visuell identitet), og Brevo-integrasjonens faktiske
API-kontrakt (kodet fra kjent v3-oppførsel, men ikke bekreftet mot en ekte
konto).

---

## Fortsettelse av økt 7 — SPEC-V1.md 5 (Brukerreiser) gjennomgått, README/.env.example-drift funnet og rettet i stedet

Startet på seksjon 5 (Brukerreiser) som planlagt. Begge reisene
(journalist 5.1, mottaker 5.2) viste seg å være godt dekket allerede —
de er i praksis samme grunn som FR-001 til FR-040 og akseptansekriterium
1-16, begge grundig auditert i tidligere økter denne natten. Stikkprøver
denne runden (varsling på søkerens eget språk ved godkjenning/avvisning av
journalist, faktisk deling av e-post ved godkjent kontaktforespørsel via
`getContactRequestDetail()` i stedet for rått i e-postteksten — en bevisst,
allerede dokumentert designbeslutning, ikke et hull) fant ingen nye avvik.
Ingen handling der.

**Byttet derfor til en helt ny inventar-akse:** README.md og
`.env.example` sine egne påstander mot faktisk kode — ingen tidligere økt
har diffet DISSE to filene denne natten. `README.md`s CI-påstand
(`.github/workflows/ci.yml` kjører hele verifiseringskjeden + integrasjons-
tester mot en Postgres 16-service-container på hver push/PR) stemte helt.
Men et grep av `process.env.[A-Z_]+` i `src/` mot `.env.example` sin
variabelliste avdekket ekte drift i BEGGE retninger:

- `AUTH_TOKEN_SECRET` sto oppført i `.env.example`, men leses ALDRI noe
  sted i koden — `src/lib/auth/tokens.ts` sin egen kommentar bekrefter
  hvorfor: tokens er 256-bit tilfeldige verdier hashet med SHA-256 ved
  lagring, de trenger ingen HMAC-hemmelighet for å være sikre. Ingen
  spec-fil nevner navnet i det hele tatt. Fjernet — en variabel som ser ut
  som den gjør noe, men ikke gjør det, er verre enn ingen variabel.
- `NEXT_PUBLIC_PLATFORM_DEFAULT_LOCALE` sto oppført, men leses ALDRI —
  plattformens standardspråk er en hardkodet konstant i
  `src/i18n/config.ts` (`"nb-NO" as const`), og variabelens EGEN kommentar
  i `.env.example` sa allerede "endres IKKE per miljø; dette er en
  produktbeslutning, ikke konfigurasjon" — selvmotsigende å samtidig
  presentere den som noe å sette. Fjernet, av samme grunn som over.
- `DB_POOL_MAX` leses FAKTISK i `src/db/client.ts` (poolstørrelse, faller
  tilbake til 3 i Stadium 0), men manglet HELT i `.env.example` — motsatt
  retning av de to over, en reell, brukbar innstilling som aldri ble
  dokumentert. Lagt til, med forklaring av Stadium 0 vs. Stadium 1-
  forskjellen (INFRASTRUCTURE.md 4/16.8).
- `SENTRY_DSN` sto også oppført og leses heller ikke noe sted — men i
  motsetning til de to fjernede, er dette en EKSPLISITT vedtatt leverandør
  (INFRASTRUCTURE.md 3/16), ikke en glemt/feilplassert variabel, og ingen
  fase i SPEC-V1.md 24 nevner faktisk Sentry-integrasjon som et
  leveranse-punkt ennå (Fase 1 sin e-postleverandør-linje er Brevo, ikke
  feilrapportering). Samme kategori som Brevo var FØR forrige økt bygget
  den — en bevisst, forhåndsplassert variabel for en fremtidig
  integrasjon, ikke et hull å rette nå. Beholdt, men kommentaren
  presiserer nå eksplisitt at selve integrasjonen ikke er bygget ennå (var
  utydelig før), slik at ingen senere økt tror den er koblet til noe.

Ingen kodeendring — rent dokumentasjonsopprydding, ingen tester berørt.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**359
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**239
tester**, uendret — ingen kode- eller databaseendring).

**Sidefunn:** Postgres-klyngen hadde stoppet på nytt (fjerde gang denne
natten) — startet igjen med `pg_ctlcluster 16 main start` før
integrasjonssuiten kjørte, som blitt et rutinemessig første steg hver
gang en deløkt trenger databasen.

### Neste økt

README.md/.env.example er nå avstemt mot koden. Reelt nytt kandidat-
arbeid, vurdert i prioritert rekkefølge: (a) en faktisk, minimal Sentry-
integrasjon (nettverkstilgang til npm-registeret ble bekreftet
tilgjengelig denne runden — `npm view @sentry/nextjs version` svarte —
så dette er IKKE lenger blokkert av manglende tilgang slik Brevo var før
forrige økt; vurdert som en STØRRE, mer risikofylt endring enn denne
øktens funn, siden det involverer en ny avhengighet, `instrumentation.ts`,
og potensielt `next.config.mjs`-endringer — bør gjøres i en egen, dedikert
runde, ikke hastes inn på slutten av en annen), (b) resten av
komponentbiblioteket (fortsatt uten forbruker), (c) OG-delingsbilde
(fortsatt blokkert på uavklart visuell identitet).

---

## Fortsettelse av økt 7 — faktisk Sentry-integrasjon bygget (feilrapportering)

Plukket opp (a) fra forrige "Neste økt": en faktisk, minimal Sentry-
integrasjon. `INFRASTRUCTURE.md` 3/16 navngir Sentry (EU-region) som
vedtatt leverandør for feilrapportering, men koden hadde INGEN kobling i
det hele tatt — bare en tom `SENTRY_DSN` i `.env.example` (og selv den var
uklar på om den var koblet til noe, rettet forrige deløkt).

**Installerte `@sentry/nextjs@10.69.0`.** Sjekket `npm audit` etterpå: 30
sårbarheter (7 moderate, 22 høye, 1 kritisk) — men ALLE i eksisterende,
uendrede avhengigheter (`next`, `drizzle-orm`, `drizzle-kit`/`esbuild`/
`vite`, `eslint-config-next`/`brace-expansion`), ingen av dem introdusert
av selve Sentry-pakken (bekreftet ved `git diff package.json`: kun
`@sentry/nextjs` lagt til). Ingen av dem rørt — å oppgradere dem ville
vært en egen, mye større og mer risikofylt endring (flere av dem krever
"breaking changes" ifølge `npm audit fix --force`), helt utenfor denne
oppgavens omfang.

**Ingen wizard brukt** (`npx @sentry/wizard` krever interaktiv innlogging
mot en ekte Sentry-konto, ikke tilgjengelig her) — satt opp manuelt ved å
lese pakkens egne bygde typedefinisjoner (`node_modules/@sentry/nextjs/
build/types/`) i stedet for å stole blindt på treningsdata som kan være
utdatert for SDK-versjon 10.x:

- `src/instrumentation.ts` — Next.js sitt offisielle `register()`-hook
  (App Router), kaller `Sentry.init({ dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0 })` og eksporterer `onRequestError:
  Sentry.captureRequestError`. samme funksjon dekker BÅDE node- og
  edge-kjøretid — `@sentry/nextjs` sin `package.json`-`exports` løser
  riktig implementasjon per bunt automatisk, ingen egen
  `sentry.server.config.ts`/`sentry.edge.config.ts`-oppdeling trengs for
  en så enkel oppsett.
- `src/instrumentation-client.ts` — Next 15.3+ sitt klient-hook (bekreftet
  faktisk installert Next-versjon er 15.5.22, støtter dette), samme
  `Sentry.init()`-mønster med `NEXT_PUBLIC_SENTRY_DSN` (må ha
  `NEXT_PUBLIC_`-prefiks for å bakes inn i nettleserbunten — en vanlig
  `SENTRY_DSN` ville vært `undefined` i klientkode). Eksporterer også
  `onRouterTransitionStart: Sentry.captureRouterTransitionStart` — SDK-en
  advarer i hvert bygg uten denne, selv om vi ikke sporer ytelse.
- `next.config.mjs` — pakket inn med `withSentryConfig(nextConfig, {
  silent: true, telemetry: false, sourcemaps: { disable:
  !process.env.SENTRY_AUTH_TOKEN } })`. Ingen ekte org/prosjekt/token
  finnes ennå, så kildekart-opplasting er eksplisitt slått av — `next
  build` skal ALDRI stille og til en ekstern tjeneste som ikke er
  konfigurert. Bekreftet ved faktisk å kjøre `next build` tre ganger
  underveis: grønt uten en eneste nettverksfeil, ingen avhengighet av en
  ekte Sentry-konto.
- `src/app/global-error.tsx` — Next sin egen reserveside for feil i selve
  root-laget (over `[locale]`-segmentet). Fantes IKKE fra før — ingen
  `error.tsx`/`global-error.tsx` noe sted i appen, en reell, tidligere
  udokumentert mangel som Sentry-oppsettet selv avdekket (SDK-en advarte
  om den i byggloggen). Bruker Next sin egen innebygde `<Error>`-komponent
  (`next/error`), IKKE i18n-systemet — bevisst unntak fra "ingen
  brukervendt streng i kildekoden", notert i en kommentar i filen: det
  finnes intet locale å slå opp tekst i når roten selv har krasjet.

**Ingen `.env.example`-verdier ble antatt** — `SENTRY_DSN`/
`NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`
er alle tomme, akkurat som Brevo var før den ble koblet til. Uten en reell
DSN sender SDK-en aldri noe (samme "trygt uten nøkkel"-prinsipp som
`src/lib/email/send.ts`), bekreftet ved at både enhetstester og
`next build` er fullstendig grønne uten noen av disse satt.

Ny test: `global-error.test.tsx` (mocker `@sentry/nextjs`, bekrefter at
`captureException` faktisk kalles med feilen).

**Sidefunn, IKKE rettet denne runden** (notert for neste økt): `src/
middleware.ts` sin egen kommentar hevder "Kjører i Node.js-runtime, ikke
edge — se next.config.mjs", men `next.config.mjs` har INGEN
`experimental.nodeMiddleware`-flagg, og `middleware.ts` sin egen
`config`-eksport har ingen `runtime: "nodejs"`-felt heller — begge er
PÅKREVD sammen for Next.js sin faktiske "Node.js Middleware"-funksjon.
Middleware kjører etter alt å dømme fortsatt på edge-runtime som normalt,
i strid med kommentarens påstand. Ufarlig i praksis I DAG (filen importerer
verken `pg`/`db` eller andre node-only API-er ennå), men kommentaren
beskriver en intensjon som aldri ble koblet til noe reelt — samme type
doc-vs-kode-avvik som flere andre funn denne natten. Ikke undersøkt videre
eller rettet nå — oppdaget midt i en annen oppgave, og fortjener en egen,
fokusert runde for å bekrefte faktisk kjøretid (f.eks. ved å midlertidig
importere noe node-only og se om bygget/kjøretiden faktisk feiler) før
noe rettes.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**360
tester**, +1), `i18n:check` (**387 nøkler**, uendret), `design:check-
tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next && next
build` (grønn — kjørt tre ganger underveis for å bekrefte ingen
nettverksavhengighet), `test:integration` mot ekte lokal Postgres (**239
tester**, uendret — ingen databaseendring).

**Merk om bunt-størrelse:** Sentry-SDK-en er ikke liten — "First Load JS"
gikk fra ~102 kB til ~186 kB, og middleware fra 43,6 kB til 106 kB. Ingen
handling denne runden (Stadium 0 har ingen hard bunt-budsjett-grense i
`INFRASTRUCTURE.md`), men notert i tilfelle en senere økt vurderer ytelse
mer nøye.

### Neste økt

Sentry-integrasjonen er kodemessig ferdig, men UBEKREFTET mot en ekte
konto (samme forbehold som Brevo). To konkrete kandidater for neste
runde: (a) undersøke og eventuelt rette `middleware.ts` sitt edge/node-
runtime-avvik (sidefunn over), (b) resten av komponentbiblioteket
(fortsatt uten forbruker) eller OG-delingsbilde (fortsatt blokkert).

---

## Fortsettelse av økt 7 — bekreftet og rettet middleware.ts sitt edge/node-runtime-avvik

Fulgte opp (a) fra forrige "Neste økt". Bekreftet, ikke bare mistenkt:
kjørte en faktisk `next build` og leste `.next/server/
middleware-manifest.json` etterpå. Beviset er entydig:
`middleware.files` er `["server/edge-instrumentation.js",
"server/edge-runtime-webpack.js", "server/src/middleware.js"]` (edge-
spesifikke buntfiler), og `functions`-feltet (der Node.js-middleware ville
vist opp) er tomt. `middleware.ts` sin egen `config`-eksport har heller
aldri hatt `runtime: "nodejs"`, og `next.config.mjs` har aldri hatt
`experimental.nodeMiddleware` — begge PÅKREVD sammen for at Next.js
faktisk skal velge Node.js-middleware. Kommentaren som hevdet "Kjører i
Node.js-runtime, ikke edge — se next.config.mjs" var altså rett og slett
usann, og har vært det siden den ble skrevet.

Sjekket samtidig om dette er en REELL bug, ikke bare en feil kommentar:
det eneste stedet i filen som bruker en potensielt Node-only API er
`generateNonce()` sin `Buffer.from(crypto.randomUUID())`. Bekreftet mot
Next sin egen edge-sandkasse-kildekode
(`node_modules/next/dist/server/web/sandbox/context.js`, linje ~179):
`Buffer`/`SlowBuffer` er eksplisitt blant de Node.js-API-ene Next.js
polyfyller inn i edge-runtimen. Ufarlig i praksis — koden fungerer
korrekt slik den kjører i dag, kommentaren var feil, ikke koden.

Rettet kommentaren til å beskrive faktisk, verifisert oppførsel (edge-
runtime, Next sin standard for middleware) i stedet for en aldri-
implementert intensjon, med samme "spec/dokumentasjon er sannheten når
koden er trygg og enklere"-resonnement som tidligere doc-funn denne
natten (INFRASTRUCTURE.md sin jobbtabell, .env.example). Beholdt den
opprinnelige, gyldige begrunnelsen (edge støtter ikke `pg`) som en
eksplisitt FREMTIDIG betingelse: den dagen middleware faktisk trenger
databasetilgang, må BEGGE flaggene legges til samtidig, ikke bare det
ene.

Ingen kodeendring utover selve kommentaren.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**360
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn — `middleware-manifest.json` lest på nytt etter
bygget for å bekrefte samme edge-bunting som før rettelsen),
`test:integration` mot ekte lokal Postgres (**239 tester**, uendret).

### Neste økt

Alle konkrete, navngitte funn fra denne natten er nå rettet. Gjenstående,
bevisst utsatte poster (uendret over flere økter): resten av
komponentbiblioteket (fortsatt uten forbruker), OG-delingsbilde (fortsatt
blokkert på uavklart visuell identitet), og Sentry/Brevo sine faktiske
API-kontrakter (kodet fra kjent SDK-/API-oppførsel, ikke bekreftet mot
ekte kontoer). Et helt nytt inventar-søk (en seksjon av SPEC-V1.md/
DESIGN.md/INFRASTRUCTURE.md som ikke er grundig diffet ennå) er trolig
den beste bruken av neste times arbeid, gitt hvor produktiv den
teknikken har vært hele denne natten.

---

## Fortsettelse av økt 7 — DESIGN.md 8/9 (Innholdsdesign/Akseptansekriterier) gjennomgått, ett reelt typografi-hull funnet og rettet

Nytt inventar: `DESIGN.md` seksjon 8 (Innholdsdesign) og 9 (Akseptanse-
kriterier) — ingen av dem spesifikt diffet mot koden denne natten. De
fleste punktene holdt allerede:

- "Ingen utropstegn": null `!`-tegn i noen av de to `messages/*.json`-
  filene (grep bekreftet).
- "«Del e-postadressen min med journalisten», ikke «Fortsett»": nøyaktig
  denne teksten finnes allerede ordrett
  (`response.form.contact_sharing_email`,
  `contact_request.approve_button`), og selve innsendingsknappen i
  bekreftelsesskjermen sier "Bekreft og send", ikke en bar "Fortsett".
- "Ingen forespørsel til en ekstern vert" (akseptanse punkt 8): bekreftet
  ingen Google Fonts/CDN-referanser noe sted i `src/app`/`src/components`/
  `src/styles` — fontene er fullt selvhostet, akkurat som `DESIGN.md` 3
  krever.
- CI-håndhevelsen i akseptanse punkt 2 (`design:check-tokens`) dekker
  faktisk alle tre ting spec-en nevner (hex/rgb/oklch-farger, rå
  px-verdier utenfor en dokumentert 1px/2px-unntaksliste, OG referanser
  til lag 1-variabler i komponentfiler) — allerede fullstendig.
- E-postmalenes fargekonstanter (akseptanse punkt 6, "testtema slår
  gjennom i e-post uten redigert mal") er en allerede KJENT, dokumentert
  forenkling (`src/lib/email/colors.ts` sin egen kommentar erkjenner at
  full byggetids-eksport-pipeline ikke er bygget, og at `colors.test.ts`
  er "den nærmeste tilnærmingen til CI-håndhevelse" i stedet) — ikke et
  nytt funn, bare bekreftet at det fortsatt er ærlig notert.
- Akseptanse punkt 1, 4, 5, 7 er alle eksplisitt pre-lanserings manuelle
  QA-porter (faktisk temabytte-øvelse, full tastatur-/skjermleser-
  gjennomgang, 360px-visning, 40 %-tekstutvidelse) — ikke noe Fase 1-
  kode skal verifisere ennå.

**Ett reelt, tidligere ukjent hull:** `DESIGN.md` 3 krever at
"respondentens svar slik journalisten leser det" settes med serif
(`--font-editorial`), samme begrunnelse som forespørselens tittel/
beskrivelse (menneskelig, ikke grensesnitt-tekst). Fant at
`src/app/[locale]/journalist/responses/[id]/page.module.css` sin `.text`-
klasse — brukt i `page.tsx` på nøyaktig `shortBio`, `relevanceStatement`
OG `answerText` (alt respondent-forfattet innhold, ikke UI-tekst) — brukte
`var(--font-ui)` i stedet. Rettet til `var(--font-editorial)`, og la til
`line-height: var(--leading-relaxed)` for å matche mønsteret fra den
offentlige forespørselssiden sin `.body`-klasse (samme token,
`DESIGN.md` 3.1 sin egen kommentar sier ordrett "lange beskrivelser OG
SVAR" om akkurat denne linjehøyden — bekrefter at dette er riktig token
for nøyaktig dette bruksområdet).

Ingen ny test — ren CSS-tokenendring, ingen eksisterende testfil for
denne siden fra før (ingen CSS-i-JS-testrammeverk i denne kodebasen),
dekket av `design:check-tokens` (fortsatt en tokenreferanse, ikke en rå
verdi) og `next build`.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**360
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**239
tester**, uendret).

### Neste økt

DESIGN.md 8/9 er nå gjennomgått. Gjenstående udiffet DESIGN.md-inventar:
seksjon 4 (Rom, form og dybde) — ikke rukket denne runden. Ellers uendret:
resten av komponentbiblioteket, OG-delingsbilde, Sentry/Brevo sine
ubekreftede API-kontrakter.

---

## Fortsettelse av økt 7 — DESIGN.md 4 gjennomgått (ingen funn), pluss testdekning for de to siste komponentene uten tester

**DESIGN.md 4 (Rom, form og dybde):** siste udiffede DESIGN.md-seksjon.
Alle romtokens (`--space-1` til `--space-9`, `--radius-*`, `--shadow-*`,
`--duration-*`, `--ease`) stemmer eksakt med `tokens/primitives.css`.
"All bevegelse respekterer `prefers-reduced-motion`": bekreftet på FIRE
steder — tre komponentspesifikke `@media`-blokker (`Button`, `Checkbox`,
`RadioGroup`) OG en global catch-all i `globals.css` (`*, *::before,
*::after { transition-duration: 0.01ms !important; ... }`) som i
praksis allerede dekker alt, selv uten de tre komponentspesifikke
blokkene. "Skygge brukes bare på flater som faktisk ligger over andre":
`--shadow-md` har nøyaktig ÉN bruker i hele kodebasen —
`Select.module.css` sin `.popover` (den flytende nedtrekkslisten) — helt
riktig scope, ingen overforbruk på vanlige kort/flater. Ingen funn. Hele
DESIGN.md (seksjon 1–10) er dermed nå diffet mot koden minst én gang
denne natten.

**Byttet til en annen type inventar** siden alle tre spesifikasjons-
dokumentene (SPEC-V1.md, DESIGN.md, INFRASTRUCTURE.md) nå er grundig
gjennomgått: testdekning. Et raskt script bekreftet at HVER ENESTE fil i
`src/lib/` har enten en `.test.ts` eller `.integration.test.ts` — full
dekning der. `src/components/` hadde to unntak: `LogoutButton.tsx` (reell
logikk — POST til `/api/auth/logout`, deretter `router.push()` +
`router.refresh()`) og `SiteHeader.tsx` (komposisjon av
`LanguageSwitcher`/`LogoutButton` + navigasjonslenker).

Skrev `LogoutButton.test.tsx` (2 tester, første i kodebasen som mocker
`useRouter()` — samme mock-mønster som `LanguageSwitcher.test.tsx` satte
for `usePathname()`): bekrefter riktig fetch-kall, riktig
locale-prefikset omdirigering (`/en-GB/logg-inn`, ikke alltid nb-NO), og
at siden faktisk oppdateres (`router.refresh()`). Merk: `/logg-inn` er
IKKE en av stiene `src/i18n/localized-paths.ts` oversetter — den beholder
det norske ordet i URL-en uansett locale, i likhet med `/me`/`/admin` —
dette er eksisterende, konsistent, tilsiktet oppførsel (den oversatte-sti-
mekanismen er bevisst avgrenset til forespørsel-relaterte offentlige
sider, SPEC-V1.md 3.7), ikke en feil testen skulle avdekket.

Skrev `SiteHeader.test.tsx` (2 tester): riktig hjem-/navigasjonslenker og
at logg ut-knappen vises; og at en tom `navLinks`-liste ikke feiler.
Måtte skille mellom TO `<nav>`-elementer i DOM-en (SiteHeaders egen, og
LanguageSwitcher sin egen med `aria-label="Språk"`) ved å filtrere på
fravær av `aria-label` — `getByRole("navigation")` alene kastet på flere
treff, rettet før commit.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, +4), `i18n:check` (**387 nøkler**, uendret), `design:check-
tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next && next
build` (grønn), `test:integration` mot ekte lokal Postgres (**239
tester**, uendret — ingen databaseendring).

### Neste økt

Alle `src/lib/*.ts`- og `src/components/*.tsx`-filer har nå testdekning.
Alle tre spesifikasjonsdokumentene er grundig diffet mot koden. Reelt
gjenstående arbeid er nå kun de lenge bevisst utsatte postene: resten av
komponentbiblioteket (fortsatt uten forbruker — Dialog/Toast/Alert/Tabs/
Table/Pagination/SkeletonLoader), OG-delingsbilde (blokkert på uavklart
visuell identitet), og Sentry/Brevo sine ubekreftede API-kontrakter (kan
ikke bekreftes uten ekte kontoer). Neste økt bør trolig enten (a) lete
etter en helt ny inventar-akse ingen tidligere økt har tenkt på ennå,
eller (b) revurdere om noen av de utsatte postene faktisk kan gjøres
klar for produksjon uten en ekte konto (f.eks. skrive en tydelig
"hvordan sette opp en ekte Brevo-/Sentry-konto"-sjekkliste i
INFRASTRUCTURE.md, som en konkret leveranse selv uten selve kontoen).

---

## Fortsettelse av økt 7 — nytt inventar (SPEC-V1.md 25 scope-creep-sjekk, ingen funn) + ett reelt hull: manglende /health-endepunkt

**SPEC-V1.md 25 ("Kuttet fra v1") mot koden**, en ny type sjekk — ikke
"mangler koden noe spec-en krever", men "har koden ved et uhell begynt på
noe spec-en EKSPLISITT sier skal vente" (scope creep). Grepet etter tegn
på alle 13 kuttede funksjonene (telefonnummer/SMS, vedlegg/profilbilder,
organisasjonskontoer, eksport av svar, filtrering/søk i svarinnboksen,
frekvensvalg, osv.) — ingen funnet. Eneste nær-treff var `topic`-feltet på
`Request`, men det er allerede eksplisitt et ANNET, BEHOLDT v1-felt
(SPEC-V1.md linje 38: et valgfritt, fast-liste `topic`-felt KUN for
visning — ikke den kuttede kategoriseringen/matchingen), og koden
respekterer skillet korrekt (ingen filtrering på temaet noe sted, bekreftet
av en eksisterende kode-kommentar i selve svarinnboks-siden). Ingen
scope creep funnet noe sted.

**Reelt, tidligere ukjent hull, funnet ved samme gjennomlesing:**
`INFRASTRUCTURE.md` 8.1 krever eksplisitt: "`/health` svarer på
databasetilkobling, køtilkobling og migrasjonsversjon. Brukes av
deploy-laget og oppetidsovervåkingen." Ingen slikt endepunkt fantes NOE
sted i kodebasen — verken `/health` eller `/api/health`. Uten det er
BÅDE utrullingens rullende omstart (8: "gammel instans avvikles først når
den nye svarer på helsesjekk") og oppetidsovervåkingens første
varslingsregel (10: "applikasjonen svarer ikke, 2 påfølgende feil")
bokstavelig talt umulige å implementere — dette er ikke en liten
detalj, men en forutsetning flere andre, allerede beskrevne
driftsmekanismer bygger direkte på.

**Bygget `GET /api/health`**, etter samme "tynn rute, testbar
lib-funksjon"-mønster som RESTEN av API-et (`src/lib/health/health.ts`
sin `checkHealth()`, kalt fra `src/app/api/health/route.ts`). Sjekker
faktisk databasetilkobling ved å spørre `drizzle.__drizzle_migrations`
(Drizzle sin egen, INTERNE migrasjons-sporingstabell — bekreftet dens
faktiske skjema empirisk med en direkte `psql`-spørring mot testdatabasen
først, i stedet for å gjette, samme metode som Sentry-oppsettet forrige
runde) og rapporterer siste migrasjons-`id` som "migrasjonsversjon".
Svarer 200 med `{status: "ok", database: "connected", migrationVersion:
N}` når databasen svarer, 503 med `database: "unreachable"` ellers.

**Rettet `INFRASTRUCTURE.md` 8.1 samtidig** (spec er sannheten, men
koden reflekterer en bevisst, allerede etablert forenkling denne gangen):
fjernet "køtilkobling" fra kravet, siden Stadium 0 ikke har noen faktisk
jobbkø å sjekke (`tick.ts` kalles direkte, ingen `pg-boss`-lytter kjører
— samme forenkling som ble dokumentert i INFRASTRUCTURE.md 5 tidligere
denne natten). Notert som en fremtidig utvidelse, ikke en påstått nåtid.

Ny testfil: `health.integration.test.ts` (2 tester — ekte tilkoblet
tilstand med en reell migrasjonsversjon, og en simulert nedbrutt
tilkobling via et minimalt mock-objekt som ikke krever ekte Postgres for
selve feilveis-assertionen).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret — den nye testen er kun integrasjon), `i18n:check`
(**387 nøkler**, uendret), `design:check-tokens` (**40** komponent-CSS-
filer, uendret), `rm -rf .next && next build` (grønn, `/api/health`
bekreftet i rutelisten), `test:integration` mot ekte lokal Postgres
(**241 tester**, +2).

### Neste økt

Alle tre spesifikasjonsdokumentene, testdekningen, README/.env.example,
OG nå scope-creep-sjekken mot kuttede funksjoner er alle gjennomgått.
`/health`-hullet var det siste konkrete, kodesjekkbare funnet denne
inventar-runden fant. Gjenstående er de lenge bevisst utsatte postene
(komponentbibliotek uten forbruker, OG-delingsbilde blokkert på visuell
identitet, Sentry/Brevo sine ubekreftede kontrakter). Neste økt bør
trolig revurdere om en av disse faktisk kan gjøres ferdig UTEN en ekte
konto (en provisjonerings-sjekkliste, som forrige økt foreslo), eller
lete etter en helt ny type inventar (f.eks. en grundig manuell
gjennomgang av selve testkvaliteten — ikke bare DEKNING, men om
eksisterende tester faktisk tester det de PÅSTÅR å teste).

---

## Fortsettelse av økt 7 — testkvalitet-gjennomgang: reell, alvorlig personvernbug funnet og rettet i kontosletting

Fulgte opp forslaget om å vurdere TESTKVALITET, ikke bare dekning —
begynte med det høyeste-innsats-området: kontosletting/retensjon (SPEC-
V1.md 17.4/17.5), siden dette sletter/anonymiserer ekte personopplysninger.

`retention.integration.test.ts` (den daglige retensjonsJOBBEN) holdt mål
— grundig, dekker dry run OG ekte kjøring, tester grensetilfeller (gammel
vs. ny, terminal vs. ventende status) for alle fem kategoriene. Ingen funn
der.

**`account-deletion.ts` (selvbetjent kontosletting) hadde derimot et
reelt, alvorlig hull.** SPEC-V1.md 17.5 krever eksplisitt at "delt
e-postadresse fjernes" som del av anonymiseringen. Men
`anonymizeRecipientContent()` håndterte KUN ventende (`pending`)
kontaktforespørsler (kansellerer dem) — en allerede GODKJENT
kontaktforespørsel, med en EKTE delt e-postadresse lagret i
`contact_requests.shared_email` (satt av `respondToContactRequest()` ved
godkjenning), ble aldri rørt. Konsekvens: en respondent som deler
e-postadressen sin med en journalist, og SENERE sletter kontoen sin (hele
poenget med kontosletting er at e-postadressen skal forsvinne — kontoens
egen e-post erstattes jo med en hash), ville likevel ha den ekte
adressen sin liggende i klartekst i en annen tabellrad, for alltid, uten
noen kodevei som noensinne rydder den opp.

Bekreftet at INGEN eksisterende test noensinne øvde på dette scenarioet
— `account-deletion.integration.test.ts` sin eneste kontaktforespørsel-
test dekket kun den PENDING-kanselleres-veien. Nøyaktig den typen hull en
testkvalitet-gjennomgang (i motsetning til en testDEKNING-sjekk) er ment
å finne: testen fantes, "dekket" filen, men aldri det spesifikke,
spec-krevde scenarioet.

**Rettet:** `anonymizeRecipientContent()` fjerner nå `sharedEmail` (setter
`null`) på alle GODKJENTE kontaktforespørsler knyttet til den slettede
brukerens svar, i tillegg til å kansellere ventende. Status endres IKKE
(fortsatt `approved`, ikke `cancelled` — den er ferdigbehandlet, bare den
lagrede adressen fjernes). Bekreftet at ingen annen kode leser
`sharedEmail` uten allerede å håndtere `null` riktig (kun
`contact-requests/[id]/page.tsx` sin betingede visning, som allerede
sjekker `detail.sharedEmail ?`).

Ny test i `account-deletion.integration.test.ts`: oppretter en GODKJENT
kontaktforespørsel med en ekte delt e-post, sletter kontoen, bekrefter at
`sharedEmail` er `null` etterpå MENS `status` fortsatt er `approved` (ikke
kansellert — et bevisst annet utfall enn den pending-banen).

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret — ny test er kun integrasjon), `i18n:check` (**387
nøkler**, uendret), `design:check-tokens` (**40** komponent-CSS-filer,
uendret), `rm -rf .next && next build` (grønn), `test:integration` mot
ekte lokal Postgres (**242 tester**, +1).

### Neste økt

Testkvalitet-teknikken (lese testene NØYE, ikke bare telle dem, og lete
etter scenarioer spec-en krever som ALDRI ble skrevet en test for) fant en
reell bug på første forsøk i det høyeste-innsats-området. Fortsett samme
teknikk i andre høy-risiko-områder som ikke er lest like nøye: auth/
session.ts (økt-tilbakekalling, glidende utløp), moderation/-modulene
(landtildeling-håndheving), eller CSRF/rate-limiting fra tidligere denne
natten (bygget raskt, kanskje ikke lest like kritisk igjen etterpå).

---

## Fortsettelse av økt 7 — fortsatt testkvalitet-gjennomgang: reell race condition funnet og lukket i rate-limit

Fortsatte kritisk gjennomlesing i sikkerhetskritisk kode. `session.ts` og
`authorize.ts` (økt-tilbakekalling, glidende utløp, moderator-landtildeling)
holdt begge mål ved nøye lesing — presise grensetester med ekte
tidsverdier og toleranser, alle negative veier (utløpt/tilbakekalt/
suspendert/feil land) faktisk testet. `moderation/responses.ts` likeens
(henter land via JOIN mot `requests.countryCode`, ikke et ikke-eksisterende
felt — korrekt, og "nekter en moderator tildelt et ANNET land" er
faktisk testet).

**Reelt hull funnet i `checkRateLimit()`** (`src/lib/security/rate-limit.ts`,
bygget tidligere denne natten): funksjonen gjorde slett-gamle/tell/sett-inn
som TRE separate spørringer uten noen låsing. To samtidige kall for SAMME
bucket kunne begge lese antallet FØR noen av dem rakk å sette inn sin egen
rad (TOCTOU) — en klassisk race condition i en sikkerhetskontroll.

**Bekreftet alvorlighetsgraden empirisk, ikke antatt:** skrev en ny test
som sender 20 helt samtidige kall mot en grense på 5, kjørte den FØRST mot
den gamle koden (via `git stash` av kun `rate-limit.ts`, konkret bevis for
regresjon) — resultatet var at 19 av 20 kall slapp gjennom, ikke bare noen
få ekstra. Dette var altså IKKE en teoretisk, lav-alvorlighets-detalj som
antatt ved første øyekast, men en race som i praksis lar nesten ALT
gjennom under reell samtidighet — akkurat den typen funn en grundig,
empirisk testkvalitet-gjennomgang er ment å avdekke fremfor å anta.

**Rettet:** hele sjekken kjører nå i én `db.transaction()`, låst med en
per-bucket Postgres advisory-lås (`pg_advisory_xact_lock(hashtext(bucket))`,
frigitt automatisk ved commit/rollback) — standard, veldokumentert
Postgres-mønster for nøyaktig dette formålet (nøkkelserialisert per
streng-bucket, ikke en global lås som ville seriealisert ALLE bucketer mot
hverandre unødvendig). Første bruk av `db.transaction()` i kodebasen.
Bekreftet mønsteret fungerer med en direkte `tsx`-spørring mot testdata-
basen først (samme "verifiser empirisk, ikke anta"-metode som Sentry- og
`/health`-arbeidet tidligere denne natten), deretter satt inn i faktisk
kode. Kjørte den nye samtidighetstesten på nytt etter rettelsen: nøyaktig
5 av 20 slipper gjennom, som forventet.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret — den nye testen er kun integrasjon), `i18n:check`
(**387 nøkler**, uendret), `design:check-tokens` (**40** komponent-CSS-
filer, uendret), `rm -rf .next && next build` (grønn, kjørt i bakgrunnen),
`test:integration` mot ekte lokal Postgres (**243 tester**, +1 — inkludert
den nye samtidighetstesten, bekreftet BEGGE veier: feiler mot gammel kode,
består mot rettet kode).

### Neste økt

To reelle bugs funnet på to påfølgende testkvalitet-runder (delt e-post
ved kontosletting, race condition i rate-limit) — teknikken fortsetter å
være produktiv. Andre kandidater for samme kritiske gjennomlesing: CSRF-
Origin-sjekken i `middleware.ts` (bygget samme natt som rate-limit —
`request.nextUrl.origin` sin faktiske verdi bak Netlifys reverse-proxy er
IKKE bekreftet mot et ekte utrullet miljø, bare antatt korrekt fra Next.js
sin dokumenterte oppførsel — kan ikke verifiseres uten en faktisk
Netlify-utrulling, så dette er en KJENT, ikke en lukket, usikkerhet), eller
digest-tick sin per-land-isolasjon (FR-036) sett med samme "kunne dette
race under ekte samtidig kjøring"-blikk som rate-limit nettopp fikk.

---

## Fortsettelse av økt 7 — digest-tick/jobb-jobbene sett med samme "kan dette race"-blikk: ett akseptert kompromiss dokumentert, ellers alt trygt

Fulgte opp forslaget om å se på `tick.ts` sine jobber med samme kritiske
blikk som fant rate-limit-racen. Gikk gjennom alle seks jobbfunksjonene:

- `runDigestTick()`: allerede korrekt og allerede dokumentert — den unike
  indeksen `digests_country_scheduled_for_idx` (schema.ts) gjør selve
  digest-OPPRETTELSEN atomisk trygg mot to overlappende tikk
  (`onConflictDoNothing()` + sjekk på returnert rad). Ingen handling.
- `runExpireRequests()`, `runExpireContactRequests()`, `runPurgeUnverified()`:
  hver av disse er ETT atomisk `UPDATE/DELETE ... WHERE ... RETURNING`,
  uten noe eksternt sideeffekt-kall innimellom. Et overlappende tikk ville
  bare matche null rader den andre allerede har tatt — strukturelt
  race-fritt, ingen handling.
- **`runDeadlineReminders()` og `runStaleRequestReminders()`: samme
  TOCTOU-form som rate-limit-bugen** (les rader der flagget er null →
  send e-post → merk flagget ETTERPÅ, som tre separate steg). Vurderte
  grundig om dette skulle rettes på samme måte (atomisk claim), men
  konkluderte at det IKKE bør gjøres, av to konkrete grunner:
  1. En atomisk claim MÅ enten merke raden FØR sendingen er bekreftet
     vellykket (ville tapt en påminnelse for godt ved en forbigående
     Brevo-feil — verre enn en sjelden dobbel e-post), eller holde en
     radlås åpen over selve det eksterne nettverkskallet til Brevo (ville
     bundet opp den bevisst vesle tilkoblingspoolen — `DB_POOL_MAX`,
     standard 3, `src/db/client.ts` — under et kall som kan ta sekunder).
  2. Et EKTE overlappende tikk (ikke bare to sekvensielle, som flagget
     allerede beskytter korrekt mot) krever at forrige kjøring fortsatt
     pågår 15 minutter senere — usannsynlig ved dagens Stadium 0-volum.

  Dette er altså en bevisst, informert risikoaksept (en sjelden dobbel
  påminnelse er et akseptabelt utfall), ikke et oversett hull som
  rate-limit-racen var (der racen undergravde HELE poenget med en
  sikkerhetskontroll). Rettet likevel den eksisterende kommentaren, som
  overpåsto garantien ("gjør dette trygt... uten å sende samme påminnelse
  flere ganger" — presist bare sant for SEKVENSIELLE tikk, ikke et ekte
  overlappende), til å presist beskrive både hva som faktisk er
  garantert og hvorfor den gjenværende, sjeldne racen er bevisst akseptert
  fremfor lukket. Ingen kodeendring — kun to kommentarer i `tick.ts`.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf
.next && next build` (grønn), `test:integration` mot ekte lokal Postgres
(**243 tester**, uendret — ingen kode- eller databaseendring).

### Neste økt

Konkurranse-/race-gjennomgangen av `tick.ts` er nå ferdig — ett bevisst
akseptert kompromiss dokumentert presist, resten strukturelt trygt.
Gjenstående fra samme kritiske-lesing-liste: CSRF-Origin-sjekken i
`middleware.ts` (fortsatt en KJENT, ubekreftet usikkerhet mot en ekte
Netlify-utrulling — kan ikke lukkes uten en faktisk deploy, så neppe mer å
gjøre der akkurat nå). Ellers er de fleste konkrete, kodesjekkbare
inventar- og kvalitetsvinklene denne natten nå uttømt; neste økt bør
trolig enten fortsette kritisk lesing i et HELT nytt lib-område som
ennå ikke er sett med dette blikket (f.eks. `digests.ts`/`journalist-
inbox.ts`), eller plukke opp en av de lenge bevisst utsatte postene
(komponentbibliotek, OG-bilde, Sentry/Brevo-kontrakter).

---

## Fortsettelse av økt 7 — kritisk gjennomlesing av `digests.ts` og `journalist-inbox.ts`: begge holder mål, ingen nye funn

Fortsatte kritisk-lesing-listen mot to nye lib-områder. Ingen av de to
funnene fra de to forrige rundene (delt e-post ved kontosletting, race
condition i rate-limit) gjentok seg her — begge filene holder mål ved nøye
lesing, ikke bare ved automatisk dekning:

- **`digests.ts` sin `retryFailedDigestDeliveries()`:** mistenkte først at
  `recipientCount: digest.recipientCount + retriedCount` kunne
  dobbelttelle mottakere (originalt mislykkede leveranser som senere
  telles på nytt ved retry). Sjekket `tick.ts` sin egen
  `sentCount`-logikk: den økes KUN ved faktisk vellykket sending, aldri
  ved mislykket — så det opprinnelige `recipientCount` inneholder ALDRI
  de mislykkede leveransene fra start av. Å legge til `retriedCount`
  (nå vellykkede retries) er dermed korrekt, ikke dobbelttelling. Bekreftet
  av en eksisterende test som setter opp nøyaktig dette scenarioet og
  forventer `recipientCount` = 2 (1 opprinnelig + 1 retry) — allerede
  riktig og allerede testet.
- **`journalist-inbox.ts` sin `hasSharedEmail`-logikk**
  (`contactSharing === "email" || approvedContactByResponse.has(r.id)`):
  så først ut som en mulig sammenblanding av to ulike delingsmekanismer.
  Bekreftet mot SPEC-V1.md 12.2/14: dette er faktisk to REELT uavhengige,
  gyldige veier til samme utfall (journalisten har e-posten) — "del
  e-postadressen min med journalisten" ved innsending (adressen følger
  svaret direkte) versus en egen kontaktforespørsel godkjent i etterkant.
  OR-betingelsen er korrekt, og allerede dekket av en egen test
  ("hasSharedEmail er true når kontaktforespørselen er GODKJENT, selv om
  contactSharing er none").
- Merket samtidig at `ResponseListSummary.shortlistedResponses` og
  `.contactRequestCount` ikke er eksplisitt krevd av SPEC-V1.md 13 (som
  bare nevner "antall svar, antall uleste og status/frist") — ikke en
  feil, bare en ekstra, ufarlig opplysning utover spec-en. Ingen handling.
- Verifiserte at `hideResponse()` sin kommentar om at duplisering mellom
  `tick.ts` og `digests.ts` er "notert i NATTLOGG.md som en kandidat for
  opprydding i dagslys" faktisk STEMMER (grep bekrefter flere tidligere
  økters notater om nettopp dette) — vurderte å faktisk gjøre
  refaktoreringen nå, men lot være: den samme, gjentatte begrunnelsen
  fra tidligere økter (risikoen ved å røre en allerede testet, sikkerhets-
  /personvern-sensitiv kjerneflyt uten tilsyn oppveier gevinsten) er like
  gyldig nå som da den ble skrevet — respekterte den konsistente,
  gjentatte vurderingen fremfor å overstyre den under samme uovervåkede
  betingelser.

Ingen kodeendring denne runden — ren verifisering. Verdien ligger i å
BEKREFTE at disse to områdene er trygge, ikke i å finne noe å rette.

### Verifisert før commit

Ingen kodeendring gjort — kun lesing og NATTLOGG-oppdatering. Ingen ny
verifiseringskjøring nødvendig (ingen fil utenom NATTLOGG.md endret).

### Neste økt

To områder til bekreftet trygge. Fortsett kritisk lesing i et nytt
område (kandidater: `contact-requests.ts`, `requests.ts` sin
`updateDraft()`/`submitForModeration()`-flyt, eller `me/`-modulene), eller
plukk opp en av de lenge bevisst utsatte postene (komponentbibliotek uten
forbruker, OG-delingsbilde blokkert på visuell identitet, Sentry/Brevo
sine ubekreftede kontrakter).

---

## Fortsettelse av økt 7 — kritisk gjennomlesing av contact-requests.ts: reelt hull funnet og rettet (i motsetning til forrige runde)

Fortsatte kritisk-lesing-listen mot `contact-requests.ts`.
`createContactRequest()` var allerede trygg (den unike indeksen på
`response_id` håndhever FR-043 atomisk, med `isUniqueViolation()`-fangst
for en pen feilvei — samme mønster som digest-opprettelsen).

**`respondToContactRequest()` hadde derimot et reelt hull, samme
kategori som TOCTOU-funnene tidligere denne natten, men denne gangen med
en billig, trygg fiks tilgjengelig:** funksjonen sjekket kun `status !==
"pending"`, og stolte HELT på at den periodiske `runExpireContactRequests()`
(kjører hvert 15. minutt) allerede hadde flippet status til `expired` før
en respondent svarte. `expiresAt` ble aldri sjekket direkte — en
kontaktforespørsel kunne dermed reelt være forbi sin 14-dagersfrist
(FR-046) i opptil ~15 minutter uten at status hadde rukket å oppdateres,
og i det vinduet ville `respondToContactRequest()` fortsatt godkjenne/
avslå den som om den var gyldig.

Vurderte dette opp mot forrige rundes tick.ts-funn (der en tilsvarende
avveining ble BEVISST AKSEPTERT, ikke rettet, fordi en ekte fiks der ville
kostet noe reelt — enten tapte påminnelser eller en oppbundet
tilkoblingspool). Her er situasjonen annerledes: `expiresAt` ligger
allerede i samme rad som allerede hentes, så en direkte sammenligning
koster ingenting ekstra — ingen transaksjon, ingen lås, ingen endret
feilhåndteringssemantikk. Rettet derfor KODEN denne gangen, ikke bare
kommentaren: `respondToContactRequest()` avviser nå eksplisitt når
`expiresAt < now`, i tillegg til status-sjekken, med samme feilmelding
(`errors.contact_request_not_pending`) som de andre "ikke lenger gyldig"-
tilstandene — ingen ny feilvei å skille ut for brukeren.

**Bekreftet regresjonen empirisk igjen** (samme metode som rate-limit-
funnet): skrev testen først, kjørte den mot den gamle koden via `git
stash` av kun `contact-requests.ts` — testen feilet som forventet
(`result.ok` var `true`, skulle vært `false`). Gjenopprettet fiksen,
kjørte testen på nytt: består.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret — ny test er kun integrasjon), `i18n:check` (**387
nøkler**, uendret), `design:check-tokens` (**40** komponent-CSS-filer,
uendret), `rm -rf .next && next build` (grønn), `test:integration` mot
ekte lokal Postgres (**244 tester**, +1 — bekreftet feiler mot gammel
kode, består mot rettet kode).

### Neste økt

Tredje reelle bug funnet under kritisk gjennomlesing denne natten (delt
e-post ved kontosletting, rate-limit-race, nå kontaktforespørsel-utløp),
og andre runde uten funn (digests.ts/journalist-inbox.ts). Teknikken
fortsetter å være verdt tiden. Gjenstående kandidater for samme lesing:
`requests.ts` sin `updateDraft()`/`submitForModeration()`-flyt, eller
`me/`-modulene (kontobytte av land, kontosletting-forespørsel). Ellers
gjenstår de lenge bevisst utsatte postene (komponentbibliotek uten
forbruker, OG-delingsbilde, Sentry/Brevo sine ubekreftede kontrakter).

---

## Fortsettelse av økt 7 — fjerde reelle bug: respondenter ble ALDRI varslet når en forespørsel lukkes normalt

Fortsatte kritisk-lesing-listen mot `requests.ts` sin `closeRequest()`.
Dette var det STØRSTE funnet av de fire denne natten, målt i faktisk
brukerpåvirkning.

`SPEC-V1.md` 15 sin e-postmal-tabell har en rad "Forespørsel du har svart
på er lukket | mottaker" (linje 830) — en helt egen, respondent-rettet mal
(`response_request_closed`), atskilt fra journalist-varselet på raden
rett over ("Forespørsel lukket | journalist", `request_closed`). Malen
FANTES allerede, var testet, og var korrekt koblet inn ETT sted:
`closeJournalistContentOnDeletion()` i `src/lib/auth/account-deletion.ts`
(17.5, siste avsnitt — når en JOURNALIST sletter kontoen sin, og
forespørslene hens dermed lukkes automatisk).

**Men den var ALDRI koblet inn i selve `closeRequest()`** — funksjonen
som BÅDE `POST /requests/:id/close` (journalisten selv) OG `POST
/admin/requests/:id/close` (moderator/administrator) faktisk bruker, den
desidert vanligste veien en forespørsel lukkes på. `closeRequest()` sendte
allerede `request_closed` til JOURNALISTEN (rettet i en tidligere økt,
se linje ~4799 i denne loggen) — men aldri `response_request_closed` til
RESPONDENTENE som hadde svart. Spec-raden skiller ikke på lukkeårsak, så
dette gjaldt uansett om journalisten selv lukket den, eller en moderator/
administrator gjorde det på hens vegne.

**Konsekvens før rettelsen:** en respondent som sender inn et svar, får
ALDRI vite at forespørselen de svarte på er lukket — med mindre den
tilfeldigvis ble lukket via at journalisten SLETTET KONTOEN sin (den ene,
sjeldne veien som faktisk sendte varselet). Den normale, forventede
lukkingen (journalisten avslutter saken, eller en moderator gjør det) var
helt stille for respondenten.

**Rettet:** lagt til nøyaktig samme spørring/løkke-mønster som allerede
fantes i `closeJournalistContentOnDeletion()` — hent alle respondenter med
`lifecycle_status = submitted` for forespørselen, send
`response_request_closed` til hver, rett etter at journalisten er
varslet. Ingen ny mal, ingen ny type, bare koblet inn på det STEDET
spec-en faktisk krever det.

**Bekreftet regresjonen empirisk** (samme metode som de to forrige
funnene): skrev testen (ny respondent, innsendt svar, lukk forespørselen,
forvent `response_request_closed` i loggen), kjørte den mot gammel kode
via `git stash` — feilet som forventet. Gjenopprettet fiksen — består.

**Ikke undersøkt videre denne runden, notert som åpent spørsmål:** bør
`runExpireRequests()` (automatisk lukking ved passert frist, FR-026, en
egen, direkte bulk-UPDATE i `tick.ts` som IKKE går via `closeRequest()`)
ALSO sende samme varsel? Brukerreisen i seksjon 5.1 punkt 11 sier
"Journalisten lukker forespørselen, ELLER den lukkes automatisk ved
frist" — språklig behandlet som samme hendelse fra brukerens ståsted,
men datamodellen skiller `closed` fra `expired` som to distinkte
statusverdier, og spec-raden i 15 presiserer ikke eksplisitt om automatisk
utløp teller. Krever en bevisst beslutning (og i så fall en STØRRE endring
av `runExpireRequests()`, fra en enkel bulk-UPDATE til en per-rad-løkke
med e-postutsendelse) — utsatt til en egen runde fremfor å hastes inn nå.

### Verifisert før commit

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret — ny test er kun integrasjon), `i18n:check` (**387
nøkler**, uendret), `design:check-tokens` (**40** komponent-CSS-filer,
uendret), `rm -rf .next && next build` (grønn), `test:integration` mot
ekte lokal Postgres (**245 tester**, +1 — bekreftet feiler mot gammel
kode, består mot rettet kode).

### Neste økt

Fjerde reelle bug funnet under kritisk gjennomlesing denne natten, og den
med størst reell brukerpåvirkning (respondenter fikk aldri vite at en sak
de svarte på ble lukket, i det vanligste tilfellet). Åpent spørsmål notert
over: bør `runExpireRequests()` (automatisk utløp) også sende
`response_request_closed`? Krever en egen, større runde. Ellers: fortsett
kritisk lesing i `me/`-modulene, eller plukk opp en av de lenge bevisst
utsatte postene (komponentbibliotek, OG-bilde, Sentry/Brevo).
