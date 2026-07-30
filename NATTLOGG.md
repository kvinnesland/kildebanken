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
