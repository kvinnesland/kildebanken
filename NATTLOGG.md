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

## Fortsettelse av økt 7 — femte reelle bug: TOCTOU i respondToContactRequest, og en test som viste seg ikke å bevise noe

Fortsatte kritisk gjennomlesing i `me/`-modulene (`change-country.ts`,
`profile.ts`, `validate.ts`) som forrige økt pekte mot. Alle tre lest linje
for linje mot SPEC-V1.md 7.3 og 17.3 — ingen funn. `changeCountry()`
sjekker samtykke FØR noe skrives (FR-010), trekker riktig KUN
terms/privacy (ikke email_subscription/minimum_age), og
`getRequiredLegalDocuments()` garanterer at `docs.terms`/`docs.privacy`
aldri er `undefined` når `docs` selv er ikke-null (den returnerer `null`
for HELE resultatet hvis ett eneste dokument mangler) — så
optional-chaining på `docs.terms?.id` er defensivt, men aldri faktisk
nådd som udefinert. `updateMyProfile()` bevisst IKKE endrer `country_code`
(det er `changeCountry()` sin jobb), og `displayName` er `text` uten
lengdebegrensning i skjemaet, så ingen trunkeringsfeil å bekymre seg for.

Fulgte så referansen fra 17.3 ("trekke et innsendt svar") til
`withdrawResponse()` i `src/lib/responses/responses.ts`, og derfra videre
til `respondToContactRequest()` i `contact-requests.ts` (allerede lest
tidligere i natt for FR-041-utløpsfiksen, økt 7). Ved fornyet, mer
mistenksom lesing denne gangen: funksjonen gjør én innledende `SELECT` som
sjekker `status === "pending"` og `expiresAt`, men den AVSLUTTENDE
`UPDATE`-en i begge grener (godkjenn/avslå) var kun beskyttet av
`eq(contactRequests.id, ...)` — ingen `status`-betingelse i selve
skrivingen. Et konkurrerende kall som endrer status i vinduet MELLOM
sjekken og skrivingen (f.eks. samme respondent som trekker svaret sitt via
`withdrawResponse()` i en annen fane, eller dobbeltklikker
godkjenn/avslå-knappen) ville blitt blindt overskrevet av den skrivingen
som kom sist — med tilhørende e-post til journalisten og (for godkjenn)
revisjonslogg, basert på en utdatert lesing. Konkret verst tenkelige
utfall: respondenten trekker svaret sitt (som SKAL kansellere en
`pending`-kontaktforespørsel, 19.8), men hvis en `respondToContactRequest`
allerede har passert sin sjekk før trekkingen skjer, ville den likevel
kunne skrive `status = "approved"` med delt e-post etterpå — stikk i strid
med at svaret nettopp ble utilgjengeliggjort (FR-042).

**Fiksen**: lagt til `and(eq(contactRequests.id, contactRequestId),
eq(contactRequests.status, "pending"))` i WHERE-betingelsen på begge de
avsluttende UPDATE-ene, med `.returning({id: contactRequests.id})` for å
kunne oppdage 0-rads-treff. Returnerer `errors.contact_request_not_pending`
før revisjonslogg/e-post dersom skrivingen ikke traff noen rad — samme
feilkode som den eksisterende, tidligere sjekken allerede bruker for
tilsvarende tilfeller, så ingen ny kontrakt for kallerne.

**Testforsøket som IKKE beviste noe, og hvorfor det ble fjernet igjen**:
Skrev først en test som kalte `respondToContactRequest` to ganger SAMTIDIG
(`Promise.all`, én "approved" og én "declined" på samme kontaktforespørsel)
og forventet at nøyaktig én av dem skulle lykkes. Kjørte den mot den
URETTEDE koden (via `git stash push -- contact-requests.ts`) for å bekrefte
at den faktisk fanget feilen først — presist samme disiplin som brukt for
de fire foregående bugfixene i natt. Den besto derimot IKKE bare én gang,
men konsekvent 6 av 6 ganger MOT den kjente feilaktige koden. Konklusjon
etter å ha tenkt gjennom hvorfor: mot en lokal Postgres med sub-millisekund
rundturstid, og en tilkoblingspool på maks 3, rekker det ene kallet
(uansett hvilket som får en ledig tilkobling først) å fullføre HELE sin
kjede av spørringer — inkludert sin egen innledende sjekk, som da allerede
ser den OPPDATERTE statusen fra det første kallet — før det andre kallet i
det hele tatt rekker å starte sin første spørring. Testens `Promise.all`
garanterer at begge FUNKSJONSKROPPENE starter i samme mikrotask, men ikke
at spørringene deres faktisk overlapper i tid — med et raskt, lokalt miljø
uten nettverkslatens blir de facto serialisert via
tilkoblingspool-tildelingen, og da fanges konflikten allerede av den
EKSISTERENDE, riktige innledende sjekken (som alltid har fungert korrekt
for det sekvensielle tilfellet — se testen "avviser å svare på en
kontaktforespørsel som ikke lenger er pending" et stykke over, som allerede
dekket nettopp dette). Testen beviste med andre ord ingenting om selve
fiksen — den ville bestått identisk med eller uten `status`-betingelsen i
UPDATE-en, fordi den aldri klarte å tvinge frem vinduet fiksen faktisk
lukker.

Vurderte å tvinge frem vinduet deterministisk ved å avskjære det
underliggende pg-klientobjektet (`db.$client.query`, bekreftet tilgjengelig
via en rask `tsx`-sjekk) og injisere et konkurrerende `UPDATE` midt i
kjeden, matchet på rå SQL-tekst. Vurderte dette som uforholdsmessig
skjørt/invasivt for denne kodebasens etablerte teststil (ingen tidligere
test i natt har grepet inn i drizzle/pg sine interne detaljer) satt opp mot
hvor smalt selve vinduet faktisk er i praksis (samme bruker må utløse to
motstridende handlinger på under et millisekunds mellomrom — i produksjon,
med ekte nettverkslatens til databasen, er vinduet riktignok bredere, men
fortsatt en svært uvanlig brukerhandling). Fjernet derfor testen igjen
fremfor å beholde en som ikke beviser noe (samme prinsipp som har styrt
all kritisk lesing i natt: en test som består uansett er verre enn ingen
test, fordi den gir falsk trygghet). Selve kodefiksen beholdes uansett —
den er billig, trygg, og et rent forbedring uansett om racen lar seg bevise
automatisert eller ikke. Samme kategori avveining som
påminnelsesjobb-racen (se over, tidligere i natt), men her var selve FIKSEN
billig nok til å gjennomføres uansett, i motsetning til påminnelsesjobbene
hvor selve fiksen ble vurdert for kostbar/risikabel.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**245
tester**, uendret fra forrige commit — testforsøket over ble lagt til og
fjernet igjen i samme runde).

### Neste økt

TOCTOU-fiksen i `respondToContactRequest` er en ren forbedring uten
automatisert regresjonstest for selve race-tilfellet (begrunnet over) —
noter dette dersom noen senere vurderer å style om testfilen og lurer på
hvorfor et opplagt racetilfelle mangler dekning. Fortsett kritisk lesing:
neste kandidat er `src/lib/subscriptions/` (e-postavmelding,
webhook-håndtering for bounce/klink) eller `src/lib/countries/` — begge
ikke gjennomgått med denne teknikken ennå denne natten. Nomrmalt neste steg
ellers: uendret fra forrige note (åpent `runExpireRequests()`-spørsmål,
komponentbibliotek, OG-bilde, Sentry/Brevo).

## Fortsettelse av økt 7 — me/-modulene (rene) og et dokumentert, IKKE fikset race i bounce-telleren

`src/lib/me/change-country.ts`, `profile.ts` og `validate.ts` gjennomgått
kritisk (se over) — ingen funn, alt stemmer med 7.3/17.3/FR-010.

Fortsatte deretter til `src/lib/subscriptions/` som notert. `unsubscribe.ts`
er ren og idempotent (samme skriving uansett hvor mange ganger samme token
brukes — ikke sårbar for TOCTOU siden det ikke er noen les-så-skriv-basert
BESLUTNING, bare en betinget-men-idempotent tilstandsovergang).

`email-events.ts` (`processEmailEvent`, 10.3/FR-037) har derimot samme
KATEGORI svakhet som påminnelsesjobbene (økt 7, tidligere i natt): for
`soft_bounce` leses `consecutiveSoftBounces` og skrives så
`gammel_verdi + 1` tilbake — et rent les-øk-skriv-mønster uten låsing. To
ekte samtidige webhook-leveringer for SAMME adresse (Brevo kan i prinsippet
levere duplikater ved timeout/retry på sin side, og Netlify-funksjoner er
separate, samtidige prosessinstanser som ikke deler tilstand) kan begge lese
samme telleverdi og begge skrive `+1`, slik at én bounce "mistes" fra
telleren. Vurderte om dette er verdt å fikse nå, og landet på nei, av tre
grunner: (1) retningen av feilen er ufarlig — telleren UNDERTELLER, som
bare FORSINKER eskalering til hard bounce, aldri feilaktig BOUNCER en frisk
adresse; (2) vinduet krever at leverandøren faktisk dobbeltleverer akkurat
samme webhook-hendelse samtidig, noe som er sjeldent og uansett utenfor
denne kodens kontroll (en fullverdig løsning hører hjemme i
dedupliseringslogikk basert på leverandørens hendelses-ID i RUTEN, ikke i
denne kjernefunksjonen — et arkitekturspørsmål, ikke en TOCTOU-fiks som
`respondToContactRequest` sin); (3) i praksis kan `soft_bounce`/`delivered`
for en adresse som ALLEREDE er `bounced`/`unsubscribed` uansett bare oppstå
fra en forsinket/duplisert hendelse for en e-post sendt FØR statusendringen
(digest-jobben ekskluderer allerede ikke-aktive abonnement fra fremtidige
utsendelser), så en forsinket hendelse som skriver til en allerede-utgått
rad gjør ingen reell skade. Ikke kodet om — dokumentert her i tråd med
samme avveiningsprinsipp som påminnelsesjobb-racet (økt 7).

Ingen kodeendringer denne runden — kun gjennomlesing og dokumentasjon, så
denne commiten inneholder bare denne NATTLOGG-oppdateringen.

### Neste økt

`src/lib/countries/` gjenstår som ikke gjennomgått med denne teknikken.
Ellers uendret: åpent `runExpireRequests()`-spørsmål, komponentbibliotek,
OG-bilde, Sentry/Brevo.

## Fortsettelse av økt 7 — countries/ (ren) og en ny, IKKE løst spec-motsigelse om hvem som kan lese et svar

`src/lib/countries/countries.ts` gjennomgått — dette var selve FR-009-fiksen
fra en tidligere runde denne natten, allerede grundig testet (partial
dokumenter, alle påkrevd, ingen, draft-eksklusjon) og korrekt koblet inn fra
alle tre skjemaene som trenger den (`SubscribeForm`, `JournalistApplyForm`,
`ChangeCountryForm`, verifisert med grep). Ingen funn.

Fulgte deretter referansen fra 18.1 ("Hvem kan lese et svar") videre til
`moderation/responses.ts` og `admin/responses.ts`, og fant noe som IKKE er
en kodefeil, men en reell MOTSIGELSE inne i spec-en selv, som jeg lar stå
åpen fremfor å avgjøre ensidig — fordi begge lesninger har reelle
personvernkonsekvenser (for bredt ELLER for smalt tilgang til respondenters
svartekst er begge feil retning å bomme i):

**18.1, ordrett**: "Kun respondenten selv, journalisten som eier
forespørselen, og en moderator eller administrator med registrert
begrunnelse og tildeling til svarets land." — altså: BÅDE moderator og
administrator skal kunne lese et svar, gitt begrunnelse og landtildeling.

**16.2 + FR-051, ordrett**: "Åpning av et enkeltsvar fra
administrasjonsgrensesnittet krever at ADMINISTRATOREN velger en
begrunnelse" / "Systemet skal kreve en registrert begrunnelse før en
ADMINISTRATOR kan åpne et enkeltsvar." — kun administrator nevnt, ikke
moderator, i to uavhengige, spesifikke, testede krav.

**Koden** (`admin/responses.ts`, `getResponseForAdmin()`) følger 16.2/FR-051
bokstavelig: `requireAdmin()`, ikke `requireModeratorForCountry()`. Det
finnes INGEN tilsvarende funksjon for moderator noe sted —
`moderation/responses.ts` sin eneste eksporterte funksjon (`hideResponse()`)
tar kun en `responseId` og skjuler svaret, uten noensinne å returnere selve
svarteksten. Det betyr at en moderator som mottar en `content_reported`-
e-post om et RAPPORTERT SVAR (12.5, `submitReport()`) i praksis ikke har
noen måte å faktisk LESE det rapporterte svaret på før de bestemmer seg for
å skjule det — de ser bare rapportørens egen begrunnelse/kommentar, ikke
selve den omstridte teksten.

Vurderte begge retninger:
- **Smal spec, kode er komplett**: 16.2/FR-051 er de mer spesifikke, testede
  kravene, og er skrevet med tydelig hensikt (nevner "administratoren"
  presist, to steder uavhengig av hverandre) — 18.1 sin nevnelse av
  "moderator" er da upresis og burde rettes til kun "administrator".
- **Bred spec, kode mangler en funksjon**: 18.1 sin frase "... OG TILDELING
  TIL SVARETS LAND" er et landbegrep som naturlig beskriver MODERATOR (som
  er landtildelt), ikke administrator (som har global tilgang til
  landkonfigurasjon, 16.2: "Land (kun administrator)" — administratorer er
  ikke "tildelt" et land i det hele tatt, de har alt). Dette taler for at
  18.1 opprinnelig ble skrevet MED moderator for øye, og at det er KODEN
  (og 16.2/FR-051, som muligens bare beskriver ADMINISTRASJONSGRENSESNITTETS
  spesifikke enkeltvisning, ikke moderators separate rapport-håndtering) som
  mangler en tilsvarende `getResponseForModerator()`-funksjon.

Landet bevisst IKKE på noen av delene ensidig: å SNEVRE INN spec-en fjerner
permanent en uttalt rettighet uten å vite om det var meningen; å BYGGE en ny
tilgangsvei til respondenters svartekst er en personvernrelevant utvidelse
(flere personer får lese sensitiv, ofte identifiserende svartekst) som ikke
bør gjøres på en gjetning om hensikt. Samme forsiktighetsprinsipp som
`runExpireRequests()`-spørsmålet (se over) — men her enda skjørere, siden
feil retning direkte påvirker hvem som kan lese ekte personopplysninger.
Ingen kode- eller spec-endring denne runden. Flagget tydelig for
morgengjennomgang.

### Verifisert før commit (denne runden)

Ingen kodeendringer — kun gjennomlesing og dokumentasjon av et åpent
spørsmål, ingen ny funksjonalitet å kjøre verifiseringskjeden mot utover det
som allerede var grønt tidligere i økten.

### Neste økt

Åpent spørsmål lagt til denne runden: bør moderator (landtildelt) kunne lese
et enkeltsvar med registrert begrunnelse, slik 18.1 ordrett sier, eller er
18.1 sin nevnelse av moderator en unøyaktighet som bør rettes til å matche
16.2/FR-051 sin administrator-only-ordlyd? Avgjøres IKKE autonomt — reell
personvernavveining. Ellers uendret fra tidligere: `runExpireRequests()`,
komponentbibliotek, OG-bilde, Sentry/Brevo. Neste kandidat for kritisk
lesing: `src/lib/journalists/journalist-profile.ts` eller
`src/lib/legal/documents.ts` — ingen av dem gjennomgått med denne teknikken
ennå.

## Fortsettelse av økt 7 — sjette reelle bug: setCountryStatus() sin aktiveringssjekk brukte ikke "gjeldende"-definisjonen

`journalist-profile.ts` og `registration/journalist.ts` gjennomgått —
begge rene (ingen TOCTOU, ingen asymmetri mot mottakerregistrering:
samme sperreliste-sjekk-før-allerede-registrert-rekkefølge, samme
unique-violation-fangst-mønster).

Gikk videre til `admin/countries.ts` (`setCountryStatus()`). Denne
funksjonens aktiverings-sjekk for et land krever at et
`legalDocuments`-dokument finnes for HVER (locale, terms/privacy)-
kombinasjon, men spørringen sjekket KUN at en rad eksisterte — den brukte
IKKE samme `publishedAt <= now()`-filter som
`getCurrentLegalDocument()` (`src/lib/legal/documents.ts`) bruker for å
definere "gjeldende" ("Gjeldende = høyeste published_at som ikke ligger i
fremtiden", ordrett kommentar der). Et fremtidsdatert dokument ville altså
bestått aktiveringssjekken her, mens den samme spørringen andre steder i
kodebasen (f.eks. under selve registreringen, `getRequiredLegalDocuments()`)
korrekt ville avvist det som "ikke gjeldende ennå".

I PRAKSIS er dette i dag ikke utnyttbart: `publishLegalDocument()`
(`admin/legal-documents.ts`) setter alltid `publishedAt: new Date()` — det
finnes ingen vei i applikasjonen til å faktisk sette inn et fremtidsdatert
dokument. Men `getCurrentLegalDocument()` sin eksplisitte, bevisste
`lte()`-sjekk viser at forfatteren av DEN funksjonen så for seg at
"gjeldende" alltid skal bety "ikke i fremtiden" som en generell invariant,
uavhengig av om UI-en i dag støtter fremtidsplanlegging — og
`setCountryStatus()` sin parallelle sjekk misset å bruke samme definisjon.
En ren, billig konsistensfiks (samme predikat om samme begrep, brukt
konsekvent) som fjerner en LATENT felle: den dagen noen legger til
fremtidsplanlagt publisering i `publishLegalDocument()` uten å huske denne
sjekken, ville et land kunnet aktiveres "for tidlig" — administrator ville
trodd alt var klart, mens faktiske registreringer i det landet/språket
uansett ville feilet med `errors.legal_documents_unavailable` fra den
STRENGERE sjekken i registreringsflyten.

**Fiksen**: la til `lte(legalDocuments.publishedAt, new Date())` i
aktiveringssjekkens WHERE-betingelse, samme import allerede brukt andre
steder i kodebasen.

**Testen**: satt inn et fremtidsdatert `terms`-dokument direkte (siden
scenarioet ikke er nåbart via `publishLegalDocument()` selv), bekreftet med
`git stash` at den feiler mot gammel kode (`expected { ok: true } to deeply
equal { ok: false, ... }` — landet ble faktisk aktivert på tross av det
fremtidsdaterte dokumentet) og består mot fiksen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**246
tester**, +1 — bekreftet feiler mot gammel kode, består mot rettet kode).

### Neste økt

`src/lib/legal/documents.ts` selv er allerede gjennomgått tidligere denne
natten (i `me/`-modul-runden) og funnet ren. Neste kandidat for kritisk
lesing: `src/lib/moderation/journalists.ts`, `src/lib/moderation/users.ts`
eller `src/lib/auth/authorize.ts` — ingen av dem gjennomgått med denne
spesifikke teknikken ennå denne natten (kun via generell
integrasjonstest-dekning fra tidligere økter). Ellers uendret: to åpne
spørsmål (`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek,
OG-bilde, Sentry/Brevo.

## Fortsettelse av økt 7 — syvende og åttende bug: samme TOCTOU-mønster funnet i HELE modereringslaget

`auth/authorize.ts` gjennomgått — liten, ren, godt kommentert
(`requireModeratorForCountry` vs `requireAdmin` sin rollefordeling er
tydelig og korrekt).

Gikk videre til `moderation/journalists.ts`, og fant PRESIS samme
TOCTOU-klasse som ble fikset i `respondToContactRequest` tidligere i natt
(økt 7, bug 5): `approveJournalist()` og `rejectJournalist()` sjekker
`verificationStatus !== "pending_review"` fra en innledende lesning, men
skriver uten å gjenta den betingelsen i selve UPDATE-en sin WHERE-klausul.
Til forskjell fra kontaktforespørsel-racet (samme respondent, to faner) er
DETTE vinduet mer sannsynlig å faktisk oppstå i praksis: en
modereringskø er per design DELT mellom flere moderatorer tildelt samme
land (SPEC-V1.md 4) — to moderatorer som ser den samme ventende søknaden
samtidig og handler nesten samtidig (én godkjenner, én avviser) er et helt
naturlig scenario, ikke et kunstig konstruert et. Konsekvens uten fiks:
begge skrivingene lykkes, den siste vinner tilstanden, MEN begge sender
sin egen e-post (`journalist_approved` OG `journalist_rejected` til samme
søker) og begge logger sin egen revisjonsloggoppføring — en direkte
motstridende, forvirrende hendelseshistorikk.

Fulgte deretter referansen i `approveJournalist()` sin egen kommentar
("samme re-håndhevelsesmønster som `publishRequest()` i
`moderation/requests.ts`") og fant IDENTISK mønster der også, i alle tre
funksjonene (`publishRequest()`, `rejectRequest()`, `requestChanges()`) —
samme sjekk-så-skriv uten WHERE-gjentakelse, samme delte-kø-scenario
(FR-029s 5-i-taket-sjekk i `publishRequest()` hadde SIN egen
race-bevissthet fra tidligere økter, men selve status-overgangen hadde det
ikke).

Sjekket også `moderation/users.ts` (`suspendUser`/`unsuspendUser`/
`suppressUserEmail`) for samme mønster — vurdert IKKE å trenge samme fiks:
suspendering er en idempotent TILSTAND (funksjonen returnerer eksplisitt
`{ok: true}` for en allerede-suspendert konto, ikke en feil), ikke en
ENGANGS, gjensidig utelukkende BESLUTNING slik godkjenning/avvisning av en
søknad er. Et race mellom to suspend-kall er harmløst (samme idempotente
sluttilstand); et race mellom suspend og unsuspend er en ordinær
"siste skriving vinner"-situasjon for en løpende kontotilstand, ikke
datakorrupsjon av en avgjørelse som skal være endelig. Annen alvorlighetsklasse,
ingen fiks nødvendig.

**Fiksen** (samme mønster begge steder, samme som kontaktforespørsel-fiksen
tidligere i natt): la til status-betingelsen (`pending_review` /
`submitted`) i selve UPDATE-ens WHERE-klausul, med `.returning()` for å
oppdage 0-rads-treff, og returnerer samme feilkode
(`errors.journalist_not_pending_review` / `errors.request_not_editable`)
som den eksisterende sjekken allerede bruker — ingen ny kontrakt for
kallerne.

**Ingen ny race-bevisende test denne gangen** — samme konklusjon som
kontaktforespørsel-fiksen: et forsøk på å bevise racet med ekte samtidige
kall mot en lokal, rask Postgres viste seg tidligere i natt IKKE å fungere
pålitelig (de to kallene blir de facto serialisert via
tilkoblingspool-tildelingen før racet rekker å oppstå). Kjørte i stedet de
EKSISTERENDE testsuitene for begge filer uendret (7 + 9 tester) for å
bekrefte at ingen regresjon oppsto på det sekvensielle tilfellet de allerede
dekker (som fortsatt fungerer identisk, siden en allerede-avgjort søknad/
forespørsel uansett blir fanget av den opprinnelige sjekken FØR den når den
nye WHERE-betingelsen i de fleste tilfeller).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**246
tester**, uendret — ingen nye tester lagt til denne runden, kun de
eksisterende 36 testene i `moderation/`-mappen kjørt og bekreftet grønne
mot den rettede koden).

### Neste økt

Samme TOCTOU-mønster er nå fikset i BÅDE `contact-requests.ts` og hele
`moderation/`-laget (journalists.ts, requests.ts). Verdt å sjekke neste
gang: er det FLERE steder i kodebasen med samme sjekk-så-skriv-uten-WHERE-
gjentakelse-mønster? Kandidater ikke ennå sjekket for dette spesifikke
mønsteret: `auth/account-deletion.ts`, `digests/digests.ts`,
`journalist-inbox/journalist-inbox.ts` sine skrivende funksjoner (marker
svar, legg til notat). Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — niende bug: dobbel levering mulig ved gjentatt "kjør på nytt" for digester

Sjekket `journalist-inbox.ts` sine to skrivende funksjoner
(`getResponseDetailForJournalist()` sin "marker som sett"-sideeffekt,
`updateResponseMarking()`) for samme mønster — begge vurdert IKKE å trenge
fiks: "marker som sett" er en engangs, idempotent tidsstempling (et
konkurrerende dobbeltkall skriver bare samme (nesten) tidspunkt to ganger,
harmløst), og `updateResponseMarking()` setter journalistens EGET,
eksplisitt valgte merke — ikke en beregning avledet fra forrige tilstand,
så "siste skriving vinner" er nøyaktig riktig oppførsel der, ikke en bug.

Fant derimot noe reelt i `digests/digests.ts`,
`retryFailedDigestDeliveries()` (16.2: "kjør på nytt ved feil"): funksjonen
henter alle leveranser med `status = "failed"` for en digest, og
sender/oppdaterer hver av dem UTEN å gjenta `status = "failed"`-
betingelsen i selve UPDATE-en som flytter dem til `queued`. Funksjonens
EGEN kommentar sier eksplisitt at poenget er "å unngå dobbel levering ved
en delvis mislykket utsendelse" — men dette gjaldt bare det opprinnelige
scenarioet (ikke sende på nytt til already-succeeded-leveranser). Et
administrator-dobbeltklikk på selve "kjør på nytt"-knappen (en helt
naturlig, plausibel UI-handling, ikke en kunstig konstruert en) ville latt
to samtidige kall hente NØYAKTIG samme liste med mislykkede leveranser og
begge sende e-post til samme mottakere — reell dobbel levering, stikk i
strid med funksjonens egen uttalte hensikt.

**Fiksen**: samme "krev atomisk"-mønster som resten av natten sine
TOCTOU-fikser, men litt annerledes anvendt her siden dette er en LØKKE over
flere rader, ikke én enkelt beslutning: den første UPDATE-en (som flytter
en leveranse fra `failed` til `queued`) fikk `status = "failed"` lagt til i
WHERE-betingelsen, med `.returning()`. Traff den ingen rad (en annen
samtidig kjøring har allerede "krevd" akkurat DEN leveransen), hopper
løkken bare videre til neste (`continue`) — resten av leveransene i samme
kall behandles uendret. `retriedCount` telles fortsatt korrekt siden
`continue` skjer FØR eventuell e-post sendes eller telleren økes.

Ingen ny race-bevisende test (samme begrunnelse som de to foregående
TOCTOU-fiksene — upålitelig mot lokal, rask Postgres). Kjørte i stedet de
7 eksisterende testene i `digests.integration.test.ts` uendret og bekreftet
grønne mot den rettede koden.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**246
tester**, uendret — de 7 eksisterende testene i `digests/` kjørt og
bekreftet grønne mot den rettede koden).

### Neste økt

`auth/account-deletion.ts` gjenstår som ikke sjekket for dette spesifikke
sjekk-så-skriv-mønsteret. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — tiende bug: engangs-token kunne i prinsippet brukes to ganger, PLUSS en tikkende bombe funnet i en test

Gikk til `auth/account-deletion.ts` som varslet. Fant PRESIS samme
TOCTOU-klasse som resten av natten, men i en mer alvorlig kontekst:
`confirmAccountDeletion()` sjekker `row.usedAt` fra en innledende lesning,
men skriver `usedAt: now` uten å gjenta `usedAt IS NULL` i selve
UPDATE-ens WHERE-betingelse. Fulgte referansen i funksjonens egen kommentar
("samme mønster som `verifyMagicLink`") til `auth/magic-link.ts`, og fant
IDENTISK mangel der også.

Dette er alvorligere enn de foregående modereringsracene: et engangstoken
som i prinsippet kan brukes to ganger samtidig er en reell
autentiseringssvakhet, ikke bare en administrativ e-post-/loggforvirring.
Klassisk, velkjent årsak til nettopp dette i den virkelige verden:
e-postsikkerhetsskannere hos enkelte bedrifter "forhåndsbesøker" lenker i
innkommende e-post automatisk for å sjekke dem — noe som nettopp kan
utløse to nesten samtidige forsøk på å bruke SAMME engangslenke. For
`verifyMagicLink()` kunne dette i verste fall gitt to ulike kallere en
gyldig innlogging fra ett og samme, egentlig engangs-token. For
`confirmAccountDeletion()` kunne det trigget `performAccountDeletion()` —
en irreversibel handling (24.3) — to ganger.

**Fiksen** (identisk mønster i begge filer): la til `isNull(usedAt)` i
UPDATE-ens WHERE-betingelse ved siden av `eq(id, tokenId)`, med
`.returning()` for å oppdage om en annen, samtidig prosess allerede har
krevd tokenet. Traff skrivingen ingen rad, returneres samme
avvisningsresultat som når `usedAt` allerede var satt ved sjekken
(`null` / `errors.not_found`) — ingen ny kontrakt for kallerne.

**Forsøkte FAKTISK å bevise racet denne gangen**, siden konsekvensen er
alvorligere enn tidligere: skrev en `Promise.all`-basert test som kalte
`verifyMagicLink()` med SAMME token to ganger samtidig — denne gangen med
to STRUKTURELT IDENTISKE kall (ikke to ulike grener med ulik lengde, slik
kontaktforespørsel-testen hadde), i håp om at symmetrisk timing ville gjøre
racet mer pålitelig å fange. Kjørte den 5 ganger mot den urettede koden:
BESTO 5 av 5 ganger — nøyaktig samme konklusjon som kontaktforespørsel-
forsøket tidligere i natt. Dette bekrefter nå (andre uavhengige forsøk,
denne gangen med symmetrisk kode) at ekte samtidighet via `Promise.all`
mot denne lokale Postgres-instansen konsekvent IKKE klarer å tvinge frem
det aktuelle TOCTOU-vinduet, uansett kodesymmetri — en miljøegenskap, ikke
en egenskap ved selve testens utforming. Fjernet testen igjen (samme
begrunnelse: en test som består uansett gir falsk trygghet), og lot de
eksisterende 24 testene (15 + 9) i de to filene bekrefte ingen regresjon.

**Sidefunn under dette arbeidet, urelatert til selve fiksen**: den fulle
`test:integration`-kjøringen feilet uventet i
`src/lib/legal/documents.integration.test.ts` ("ignorerer versjoner
publisert i FREMTIDEN") — helt urelatert til token-fiksen. Gravde i det og
fant en ekte, interessant tikkende bombe: `fixtures.ts` sin dokumenterte,
aksepterte konvensjon ("ingen opprydding, greit for en engangs, disponibel
sandkasse-database") holder for de FLESTE tester, siden de bruker unike,
tilfeldige verdier og alltid spør etter SIN EGEN rad. Denne ene testen
derimot spør etter "nyeste rad som IKKE er fremtidsdatert" — en spørring
som kan bli forstyrret av ETHVER akkumulert rad fra TIDLIGERE kjøringer,
ikke bare sine egne. Siden denne autonome økten nå har kjørt sammenhengende
i over 24 timer (motsatt av forutsetningen "engangs, disponibel database"),
hadde en fremtidsdatert testrad fra en TIDLIGERE time i natt rukket å
"utløpe" inn i fortiden og dukket opp som en falsk "nyeste gjeldende
versjon" for en helt annen, senere test-kjøring. Fant og bekreftet dette
ved å kjøre spørringen direkte mot databasen og telle: 134 akkumulerte
rader for (XT, en-GB, privacy). Ryddet bort de gamle radene manuelt, og la
til eksplisitt opprydding (i en `finally`) KUN i denne ene testen — et
bevisst unntak fra fixtures.ts sin ellers gjeldende "ingen opprydding"-
konvensjon, fordi denne spesifikke testen har en tidsavhengig egenskap
("fremtidig" i 24 timer, så "fortid" for alltid) som de andre testene
ikke har. Kjørte testfilen to ganger på rad for å bekrefte at opprydningen
faktisk hindrer reakkumulering.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**246
tester**, uendret — 24 eksisterende tester i auth/-filene og 5 i
documents.integration.test.ts kjørt og bekreftet grønne, sistnevnte kjørt
to ganger for å bekrefte opprydningen virker).

### Neste økt

Alle kjente forekomster av sjekk-så-skriv-uten-WHERE-gjentakelse-mønsteret
er nå gjennomgått og fikset der funnet (kontaktforespørsler, hele
modereringslaget, digest-retry, engangstokens). Verdt å vurdere: er det
FLERE steder i test-suiten med samme "tidsavhengig fremtidsdatert
fixture"-sårbarhet som ble funnet i `documents.integration.test.ts`? Et
raskt søk etter `Date.now() +` i `*.integration.test.ts`-filer kan avdekke
flere kandidater neste økt. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — sveip fullført (ingen nye funn), og et testdekningshull tettet i retensjonsjobben

Fullførte sveipet fra forrige runde: søkte etter `Date.now() + ` i alle
`*.integration.test.ts`-filer. Den ENESTE andre treffen (utenom den
allerede rettede i `documents.integration.test.ts`) var min EGEN nye test
i `admin/countries.integration.test.ts` fra tidligere i natt
(FREMTIDSDATERT-testen for `setCountryStatus()`) — men den bruker en
ISOLERT, tilfeldig landkode (`input.code` fra `testCountryInput()`, ikke
den delte `TEST_COUNTRY_CODE`) og rydder opp i `legalDocuments`-radene sine
via `deleteTestCountry()` i `afterAll`. Ingen akkumulering, ingen delt
identifikator på tvers av kjøringer — samme sårbarhetsklasse krever BEGGE
deler (delt/fast identifikator OG "nyeste rad"-spørring), og denne testen
har ingen av dem. Ingen fiks nødvendig. Sveipet er dermed fullført uten
flere funn.

Gikk deretter til `jobs/retention.ts` (17.4/17.5) — høy risiko siden den
sletter/anonymiserer ekte persondata, byggingen ble eksplisitt gjort
forsiktig tidligere i natt med egne tester. Leste alle fem kategoriene
kritisk mot spec-tabellen i 17.4: `purgeOldResponses` (innsendt svar),
`purgeOldContactRequests` (kontaktforespørsel),
`purgeRejectedJournalistApplications` (avvist journalistsøknad, hele
kaskaden av sletting på tvers av tabeller kontrollert linje for linje —
resonnementet i kommentaren om at en avvist journalist umulig kan ha noen
publisert forespørsel, svar eller kontaktforespørsel stemmer),
`purgeOldAuditLogs` (revisjonslogg), `purgeOldDigests` (digest). Alle fem
stemmer med spec-tabellens ordlyd.

Ett spec-rad avklart, ikke en kodefeil: "Sikkerhetslogg | 6 måneder" har
INGEN egen `purge`-funksjon i `retention.ts`. Sjekket om dette er et hull —
det er det ikke: `rate_limit_hits` (19.16, nærmeste treff på "sikkerhetslogg"
i skjemaet) er allerede selvrensende (`checkRateLimit()` sletter rader
eldre enn sitt EGET tidsvindu — 15 min til 24 timer — ved hver eneste kall,
se `security/rate-limit.ts` sin egen kommentar om dette). Radene lever
aldri i nærheten av 6 måneder, så det er ingenting for den daglige
retensjonsjobben å gjøre der — retensjonsgrensen er en ØVRE grense, og å
slette tidligere enn nødvendig er strengt tatt MER personvernvennlig, ikke
et avvik.

**Reell finner**: testdekningen for de fem kategoriene var ASYMMETRISK —
kun 2 av 5 (`innsendte svar`, `avviste journalistsøknader`) hadde en
`dry run`-test i tillegg til "ekte kjøring"-testen. De tre resterende
(`kontaktforespørsler`, `revisjonslogg`, `digest og leveringsstatus`) hadde
KUN "ekte kjøring" testet — ingenting ville fanget opp om `if (!dryRun...)`
-vakten for en av disse tre kategoriene noensinne ble ødelagt ved en
fremtidig endring, til tross for at `RETENTION_DRY_RUN`s STANDARDVERDI
(sann) er selve sikkerhetsnettet brukerens opprinnelige instruks eksplisitt
ba om. La til de tre manglende dry-run-testene, samme mønster som de to
eksisterende.

Bekreftet EMPIRISK at de nye testene faktisk beviser noe (samme disiplin
som resten av natten, men her ved å midlertidig BRYTE produksjonskoden i
stedet for git stash, siden endringen var ren TESTTILLEGGELSE uten
tilhørende kodefiks å stashe): fjernet `!dryRun &&` fra alle tre
vaktene midlertidig (ren tekst-erstatning via et engangsskript, ikke
lagret), kjørte testfilen — alle tre nye tester feilet nøyaktig som
forventet (`expected undefined to be defined` — raden var borte selv i
dry-run-modus). Gjenopprettet den ekte filen fra en sikkerhetskopi
(`cp`, IKKE git — ingen commit fantes å gå tilbake til underveis), bekreftet
at alle 10 tester består igjen mot den ekte koden.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**249
tester**, +3 — bekreftet feiler mot midlertidig ødelagt dryRun-vakt for
alle tre nye tester, består mot ekte kode).

### Neste økt

Sveipet etter "tidsavhengig fremtidsdatert fixture"-mønsteret er ferdig,
ingen flere funn. `jobs/retention.ts` sin logikk er nå fullt gjennomgått og
bekreftet korrekt, med symmetrisk dry-run-dekning på alle fem kategorier.
Neste kandidat for kritisk lesing: `email/send.ts`, `email/digest.ts`,
eller en fornyet, kritisk gjennomlesing av `jobs/tick.ts` (sist grundig
gjennomgått i en tidligere økt, før denne nattens mest intensive
TOCTOU-jakt) — ingen av dem sjekket med DENNE spesifikke teknikken ennå i
natt. Ellers uendret: to åpne spørsmål (`runExpireRequests()`, 18.1 vs
16.2/FR-051), komponentbibliotek, OG-bilde, Sentry/Brevo.

## Fortsettelse av økt 7 — ellevte og alvorligste bug: FR-004-jobben har ALDRI faktisk fungert mot ekte data

Gjorde den varslede fornyede kritiske gjennomlesingen av `jobs/tick.ts`.
`runDigestTick()`/`sendDigestToRecipients()` (FR-030–038) er godt bygget —
unik indeks + `onConflictDoNothing()` gjør digest-opprettelsen trygg mot
overlappende tikk, FR-036-isolasjon per land og per mottaker er reell.
`runExpireRequests()`, `runExpireContactRequests()` er enkle, rene
bulk-UPDATE-er uten TOCTOU-eksponering (ingen bruker-synlig
beslutningsgren å kappløpe om). `runDeadlineReminders()` og
`runStaleRequestReminders()` sin bevisst aksepterte race-avveining
(dokumentert tidligere i natt) står seg ved fornyet lesing.

**`runPurgeUnverified()` (FR-004, "ubekreftet konto: 14 dager") var derimot
reelt, alvorlig ødelagt** — den mest alvorlige feilen funnet denne natten,
fordi den betyr en spec-påkrevd funksjon aldri har fungert i det hele tatt,
ikke bare en sjelden race. Funksjonen gjorde en BAR `DELETE FROM users`
uten å først rydde bort rader som refererer til den. `auth_tokens.user_id`,
`consent_records.user_id`, `journalist_profiles.user_id` og
`email_subscriptions.user_id` refererer ALLE `users.id` UTEN
`ON DELETE CASCADE` (bekreftet i schema.ts) — og enhver EKTE registrering
(mottaker via `registration/recipient.ts`, journalist via
`registration/journalist.ts`) setter alltid inn en `authTokens`-rad (selve
bekreftelseslenken som nettopp IKKE ble klikket) og en `consentRecords`-rad
UNAVHENGIG av e-postbekreftelse — akkurat den tilstanden en
`pending_email_verification`-konto alltid er i.

Den eksisterende testen ("sletter en ubekreftet konto eldre enn 14 dager")
fanget aldri dette fordi den satte inn en `users`-rad DIREKTE, uten noen av
disse tilhørende radene — testen testet dermed en tilstand som ALDRI
oppstår i den ekte applikasjonen. Bekreftet empirisk med et
reproduksjonsskript som satte inn en realistisk bruker MED en `authTokens`-
og `consentRecords`-rad (nøyaktig det enhver ekte registrering ville gjort)
og kjørte `runPurgeUnverified()` mot den: kastet umiddelbart
`update or delete on table "users" violates foreign key constraint
"auth_tokens_user_id_users_id_fk"`. FR-004 har med andre ord ALDRI faktisk
slettet en eneste ekte, ubekreftet konto i praksis — funksjonen har kastet
en ufanget unntak hver gang den kjørte mot ekte data siden den ble bygget.

**Fiksen**: samme mønster som `purgeRejectedJournalistApplications()`
(`jobs/retention.ts`, allerede gjennomgått og bekreftet korrekt tidligere i
natt) — hent kandidatene FØRST, løkke over hver, slett i riktig rekkefølge
(`requests`/`journalistProfiles`/`emailSubscriptions`/`consentRecords`/
`authTokens`/`sessions`, deretter selve `users`-raden), med try/catch PER
KANDIDAT slik at én kandidats feil ikke stopper resten (samme FR-036-
isolasjonsprinsipp som resten av jobblaget). `sessions` slettes defensivt
selv om en ubekreftet konto aldri skal kunne ha en økt i praksis (økten
opprettes først ETTER at `verifyMagicLink()` lykkes, som samtidig flipper
status bort fra `pending_email_verification`).

**Verifisert empirisk i to trinn**: (1) kjørte reproduksjonsskriptet på
nytt mot den RETTEDE koden — samme realistiske bruker (med authTokens +
consentRecords) ble nå slettet uten feil (`processed: 1, errors: []`),
bekreftet fraværende i databasen etterpå. (2) La til to nye, realistiske
integrasjonstester (én mottaker med authTokens/consentRecords/
emailSubscriptions, én journalist med authTokens/consentRecords/
journalistProfiles/et utkast) og bekreftet via `git stash` at BEGGE feiler
mot den gamle koden med nøyaktig samme fremmednøkkelfeil som
reproduksjonsskriptet fant, og består mot den rettede koden (24/24 tester
i tick.integration.test.ts).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**364
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**251
tester**, +2 — bekreftet feiler mot gammel kode med nøyaktig samme
fremmednøkkelfeil som reproduksjonsskriptet, består mot rettet kode).

### Neste økt

Den mest alvorlige feilen denne natten er nå rettet og godt bevist. Verdt å
vurdere som en generell lærdom: er det FLERE steder i kodebasen som gjør en
"bar" DELETE/UPDATE på en `users`-rad (eller annen rad med mange
inn-refererende fremmednøkler) uten først å sjekke om alle
fremmednøkkel-relasjoner er dekket? `performAccountDeletion()`
(`auth/account-deletion.ts`) og `purgeRejectedJournalistApplications()`
(`jobs/retention.ts`) er begge allerede gjennomgått og korrekte — de er
nettopp MØNSTERET denne fiksen kopierte. Ingen flere kandidater identifisert
ennå, men verdt å holde i bakhodet neste gang en ny sletting av en
brukerrad bygges. Neste kandidat for kritisk lesing: `email/send.ts`,
`email/digest.ts`. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — sveip etter "bar sletting"-mønsteret (ingen nye funn), og gjennomgang av e-postlaget (ingen funn)

Sveipet raskt etter forrige rundes lærdom: grep etter `.delete(users)` i
hele `src/lib` fant KUN de to stedene som allerede er gjennomgått og
rettet (`retention.ts`, `tick.ts`). Et bredere søk etter alle `.delete(...)`-
kall i `src/lib` fant ingen andre kandidater utover disse to og
`withdrawResponse()` (`responses/responses.ts`), som allerede korrekt
nuller ut `contactRequests.responseId` for ALLE tilhørende rader FØR selve
svaret slettes (gjennomgått tidligere i natt). Sveipet er dermed ferdig.

Gikk deretter til `email/send.ts` og `email/digest.ts` som varslet. Begge
er grundig bygget og fant INGEN bugs ved kritisk lesing:

- `send.ts`: alle 23 transaksjonelle malene i `TransactionalTemplate`
  matcher nøyaktig SPEC-V1.md 15 sin tabell (24 rader minus selve
  digest-raden, som er BULK, ikke transaksjonell — egen funksjon,
  `sendBulkEmail`). Atskilt avsender for transaksjonell vs. bulk (samme
  som INFRASTRUCTURE.md 6.1/6.3 krever), `List-Unsubscribe`/
  `List-Unsubscribe-Post` obligatorisk (ikke valgfritt) på `sendBulkEmail`
  sin input-type (FR-038) — en glemt header ville vært en TYPEFEIL, ikke en
  kjøretidsfeil.
- `digest.ts`: sjekket spesifikt for XSS, siden dette er den ENESTE malen
  som rendrer journalist-VALGT fritekst (`title`, `summary`,
  `organizationName`, `geographicNote`) til et STORT antall mottakere i
  bulk — den mest alvorlige tenkelige treffflaten om escaping sviktet noe
  sted. Alle fire feltene går konsekvent gjennom `escapeHtml()`
  (`email/escape-html.ts`, standard, riktig rekkefølge — `&` FØRST) i
  HTML-versjonen; PLAIN TEXT-versjonen bruker dem bevisst UESCAPET (riktig
  — HTML-escaping i ren tekst ville vist `&lt;`-koder rått til mottakeren,
  ikke motsatt). Sjekket også at `href="${url}"` (bygget fra `r.slug`) er
  trygt UTEN escaping: `slugify()` (`requests/slug.ts`) begrenser en slug
  til strengt `[a-z0-9-]` etter transkribering av norske spesialtegn —
  ingen anførselstegn eller vinkelparenteser kan noensinne forekomme i en
  slug, uansett tittel.

  Vurderte én teoretisk, ufarlig kant: `insertPerRecipientTokens()` bytter
  ut plassholderstrengene (`__ACCESS_TOKEN__`/`__UNSUBSCRIBE_TOKEN__`) med
  et personlig token PER MOTTAKER via `replaceAll()` på den delte, allerede
  rendrede HTML-en/teksten. Skulle en journalist (bevisst eller ved en
  tilfeldighet) skrive en tittel som bokstavelig inneholder
  `"__ACCESS_TOKEN__"`, ville DEN teksten også bli erstattet med mottakerens
  eget tilgangstoken der forespørselens tittel vises i digesten — men dette
  lekker INGENTING på tvers av brukere: hver mottaker får bare SITT EGET
  token satt inn i SIN EGEN kopi (rendringen er delt FØR personalisering,
  men selve erstatningen skjer separat per mottaker via `replaceAll()`,
  som returnerer en ny streng — ingen delt, muterbar tilstand). I verste
  fall en forvirrende, korrupt tittelvisning for mottakeren selv, ikke et
  sikkerhetshull. Ikke rettet — for lav alvorlighet og ingen reell
  utnyttelsesvei til å rettferdiggjøre en kodeendring.

Ingen kodeendringer denne runden — kun gjennomlesing og bekreftelse. Ingen
ny commit for kodeendringer, kun denne NATTLOGG-oppdateringen.

### Neste økt

`email/send.ts` og `email/digest.ts` er nå bekreftet rene. Kandidater for
neste kritisk-lesing-runde, ingen av dem sjekket med denne spesifikke
teknikken ennå: `src/lib/http/safe-redirect.ts` (kort, men sikkerhetskritisk
— åpen-redirect-vern), `src/app/api/webhooks/email-events/route.ts` (selve
normaliseringslaget mellom Brevo og `email-events.ts`, aldri verifisert mot
en ekte Brevo-konto), eller en runde gjennom API-rute-lagene i `src/app/api/`
selv (rutene er tynne adaptere over lib-funksjonene, men har ikke fått
samme kritiske gjennomlesing som selve lib-laget i natt — CSRF-sjekk,
inputvalidering, feilhåndtering). Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — tolvte bug: reell, uautentisert åpen-redirect-omgåelse i digest-tilgangsruten

Gikk til `src/lib/http/safe-redirect.ts` som varslet — kort, men
sikkerhetskritisk (åpen-redirect-vern for `?to=`-parameteren i
`GET /api/digest-access/[token]`, ruten som bytter et digest-tilgangstoken
inn i en økt og videresender). Den eksisterende sjekken var
`value.startsWith("/") && !value.startsWith("//")` — dekker den opplagte
`//evil.com`-varianten, men IKKE to andre, velkjente omgåelser av nøyaktig
denne sjekkemåten. Bekreftet BEGGE empirisk mot Node sin `URL`-parser (den
SAMME WHATWG-implementasjonen selve redirect-kallet bruker,
`new URL(safeDestination, url.origin)` i route-filen):

1. `new URL("/\\evil.com", origin)` → `https://evil.com/`. Baklengs
   skråstrek oppfører seg som fremover skråstrek for "spesielle" skjema
   (http/https) i WHATWG-spesifikasjonen, men KUN i posisjon 1 (rett etter
   den innledende skråstreken) — testet at en baklengs skråstrek SENERE i
   stien (`/nb-NO/foo\bar`) bare blir et ordinært sti-skille, ufarlig.
2. `new URL("/\t/evil.com", origin)` → `https://evil.com/`. Spesifikasjonen
   fjerner ethvert ASCII tab/linjeskift fra HELE strengen (ikke bare start/
   slutt) FØR parsing — en tab som andre tegn gjør strengen om til
   "//evil.com" i parserens øyne, selv om den bokstavelig aldri starter med
   "//".

**Alvorlighet**: dette er ikke bare en teoretisk sårbarhet — route-filen
(`api/digest-access/[token]/route.ts`) videresender til `safeDestination`
i BEGGE grener, INKLUDERT når tokenet er ugyldig/ikke finnes (linje 53-55:
"Ugyldig token... videresend uten å opprette økt"). Det betyr en
angriper IKKE trenger noe gyldig digest-token i det hele tatt — en lenke
som `https://kildebanken.example/api/digest-access/hva-som-helst?to=%2F%5Cevil.com`
(URL-en dekoder `%2F%5C` til `/\` før `isSafeRelativePath()` ser den) ser
ut som en lenke fra en klarert domene, men omdirigerer stille til et
angriper-kontrollert nettsted — en klassisk phishing-vektor, fullt
uautentisert.

**Fiksen**: normaliserer verdien (fjerner tab/linjeskift/vognretur, samme
steg parseren selv gjør) FØR sjekken, og sjekker deretter at tegn nummer 2
(rett etter den innledende skråstreken) verken er `/` eller `\`.

**Verifisert empirisk**: la til to nye testtilfeller (baklengs skråstrek i
posisjon 1, tab i posisjon 1) pluss en bekreftende test for at baklengs
skråstrek SENERE i stien fortsatt godtas. Bekreftet via `git stash` at
begge de nye sikkerhetstestene feiler mot den gamle koden (`expected true
to be false` — omgåelsen slapp gjennom) og består mot fiksen (10/10
tester).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**368
tester**, +4 — bekreftet feiler mot gammel kode for begge de nye
sikkerhetstestene, består mot rettet kode), `i18n:check` (**387 nøkler**,
uendret), `design:check-tokens` (**40** komponent-CSS-filer, uendret),
`rm -rf .next && next build` (grønn), `test:integration` mot ekte lokal
Postgres (**251 tester**, uendret — denne fiksen berører ingen
integrasjonstestet kode).

### Neste økt

Den nest mest alvorlige sikkerhetsfeilen denne natten (etter
FR-004-fiksen) er nå rettet og bevist. Verdt å sjekke: er
`isSafeRelativePath()` brukt andre steder enn `digest-access`-ruten som
også burde bruke den, men ikke gjør det ennå? Kun ett treff ved forrige
sveip (kun denne ene ruten). Neste kandidat for kritisk lesing:
`src/app/api/webhooks/email-events/route.ts` (Brevo-normalisering, aldri
verifisert mot ekte konto), eller en runde gjennom API-rute-lagene i
`src/app/api/` selv. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — dekket et testhull i webhook-ruten (ingen kodefeil funnet)

Gikk til `api/webhooks/email-events/route.ts` som varslet. `isAuthorized()`
(delt hemmelighet, feiler LUKKET uten konfigurert hemmelighet — trygg
standard, samme prinsipp som `RETENTION_DRY_RUN`) og `normalizeEvent()`
(defensiv snake_case/camelCase-normalisering) ble lest kritisk — ingen
logikkfeil funnet. Vurderte og bevisst IKKE endret: (1) hemmeligheten
godtas via søkeparameter, som generelt frarådes (kan havne i loggfiler) —
men dette er trolig den ENESTE praktiske måten Brevo sitt eget
webhook-oppsett faktisk støtter (ingen egen tilgang til å bekrefte
dette), så en endring her uten faktisk Brevo-dokumentasjon ville vært en
gjetning; (2) `provided === configuredSecret` er en RÅ strengsammenligning,
ikke en tidskonstant sammenligning (teoretisk CWE-208-klasse) — vurdert som
et for lavt-alvorlighetsnivå til å rettferdiggjøre kompleksitet, gitt at
nettverksstøy uansett dominerer over en så liten timing-forskjell i
praksis over HTTP.

**Reelt hull funnet**: INGEN testfil eksisterte for denne ruten — det
eneste stedet i hele `src/app/api/`-treet der en rute inneholder egen,
ikke-triviell logikk (autentisering + hendelsesnormalisering) UTEN noen
underliggende lib-funksjon som allerede er testet for den logikken (til
forskjell fra resten av rutene i kodebasen, som er tynne adaptere over
allerede grundig testede lib-funksjoner — derfor testes ruter generelt
ikke direkte i dette prosjektet). La til en full integrasjonstestfil (11
tester): 401 ved manglende/feil/manglende hemmelighet (både søkeparameter
og header), 400 ved ugyldig kropp/e-post/ikke-parsbar JSON, 200 og faktisk
kall til `processEmailEvent()` for en kjent hendelse (bekreftet via
databasetilstand — sperring av adressen), samme for en camelCase-variant
("HardBounce"), og 200-uten-handling for en ukjent/irrelevant hendelse
("opened").

**Verifisert empirisk**: ødela midlertidig `isAuthorized()` (returnerte
alltid `true`) og bekreftet at nettopp de to 401-testene som tester feil/
manglende hemmelighet feilet som forventet (`expected 200 to be 401`),
gjenopprettet den ekte filen fra en sikkerhetskopi og bekreftet alle 11
tester består igjen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**368
tester**, uendret), `i18n:check` (**387 nøkler**, uendret),
`design:check-tokens` (**40** komponent-CSS-filer, uendret), `rm -rf .next
&& next build` (grønn), `test:integration` mot ekte lokal Postgres (**262
tester**, +11 — bekreftet at 2 av de nye testene feiler mot en midlertidig
ødelagt `isAuthorized()`, består mot den ekte, urørte ruten).

### Neste økt

Ingen kodefeil funnet i selve webhook-ruten denne runden, kun et
testdekningshull tettet. Neste kandidat for kritisk lesing: en runde
gjennom resten av API-rute-lagene i `src/app/api/` (CSRF-sjekk,
inputvalidering, feilhåndtering — ingen av dem har fått samme kritiske
gjennomlesing som lib-laget i natt), eller `src/lib/journalist-inbox/` sine
underliggende ruter. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — runde gjennom API-rute-laget (én liten inkonsistens rettet, ellers rent)

Gikk gjennom et representativt utvalg av `src/app/api/` (registrering,
`me/`, `requests/`, `responses/`, `journalist-inbox`-rutene,
admin/moderering, kontaktforespørsler) med samme kritiske teknikk som
resten av natten. Sjekket spesifikt: CSRF (allerede sentralt håndhevet i
`middleware.ts` for ALLE `/api`-ruter via Origin-verifisering, med egen,
grundig testdekning — ikke duplisert per rute, og dermed ikke sårbart for
"glemte det i én rute"), om `session.userId` alltid sendes til
lib-funksjonen (ikke en klientstyrt ID), om eierskaps-/rollesjekker skjer
enten i ruten ELLER inne i lib-funksjonen (begge mønstre brukes bevisst —
noen ruter sjekker rolle selv OG stoler på lib-funksjonens interne sjekk
som et redundant, ufarlig dobbeltlag; andre stoler HELT på at
lib-funksjonen henter økten selv via `next/headers`, som med
`publishRequest()`/`rejectRequest()`/`requestChanges()` — begge er trygge,
bare stilistisk ulike), og at nye feilkoder fra denne nattens TOCTOU-fikser
(f.eks. `errors.request_not_editable`) faller ned i en fornuftig
standard-statuskode (422) i rutenes egne `statusFor()`-hjelpere. Ingen
sikkerhetsproblemer funnet.

**Én reell, om enn liten, inkonsistens funnet og rettet**: `PATCH /me`
sin Zod-skjema tillot `displayName` opptil 200 tegn, mens BÅDE
`POST /subscribe` OG `POST /requests/:id/responses` (en analog,
per-svar-variant av samme konsept) uavhengig av hverandre begrenser til 80
tegn — og `responses/validate.ts` sin egen test bekrefter eksplisitt at
81 tegn skal AVVISES for det beslektede feltet. Ingen spec-bestemt grense
finnes (verken 80 eller 200 er "riktig" i seg selv), men å redigere et felt
til en LENGDE opprettelsesveien for SAMME kolonne (`users.display_name`)
ville avvist, er en reell uoverensstemmelse — rettet til 80 for
konsistens. Ingen eksisterende test forutsatte 200-grensen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**368
tester**, uendret — bekrefter at ingen test forutsatte 200-tegns-grensen),
`i18n:check` (**387 nøkler**, uendret), `design:check-tokens` (**40**
komponent-CSS-filer, uendret), `rm -rf .next && next build` (grønn),
`test:integration` mot ekte lokal Postgres (**262 tester**, uendret).

### Neste økt

API-rute-laget er nå gjennomgått bredt uten funn av betydning (kun én liten
grensekonsistens rettet). Kandidater ikke ennå dekket med denne teknikken:
Server Components/sider under `src/app/[locale]/` (skjemaer, sesjonsbruk i
selve siderenderingen, ikke bare API-lagene bak dem), eller
`src/components/`-biblioteket for øvrig. Ellers uendret: to åpne spørsmål
(`runExpireRequests()`, 18.1 vs 16.2/FR-051), komponentbibliotek, OG-bilde,
Sentry/Brevo.

## Fortsettelse av økt 7 — trettende bug: kontosletting fyrte automatisk ved sideinnlasting, ingen bekreftelse krevd

Gikk gjennom Server Components-sidene under `src/app/[locale]/` som
varslet (admin-dashbord, admin-journalistkø, journalistens
redigerings-/svarsider, kontaktforespørsel-siden, `me/svar`,
forespørselssiden, svarskjemaet) — alle korrekt eierskaps-/rolle-scopet
via allerede grundig gjennomgåtte lib-funksjoner (`getOwnedRequestDetail`,
`getContactRequestDetail`, `listMineResponses` osv.), ingen IDOR-mønstre
funnet. Ett mistenkelig funn (bokstavelig `"yes"`/`"no"`-streng sendt til
en oversettelsesfunksjon i forespørselssiden) viste seg å være korrekt,
tilsiktet bruk av ICU MessageFormat sin `select`-syntaks (`{allowed,
select, yes {...} other {...}}`), ikke en lekkasje av engelsk tekst — ingen
fiks nødvendig.

**Fant derimot noe reelt og alvorlig i `me/slett-konto/ConfirmDeletionClient.tsx`**:
siden fyrte selve kontoslettingen — en IRREVERSIBEL handling — AUTOMATISK i
en `useEffect` ved sideinnlasting, uten noe eksplisitt brukerhandling som
portvakt. Å bare BESØKE lenken fra bekreftelses-e-posten (uten å klikke noe
som helst PÅ SELVE SIDEN) var nok til å slette kontoen permanent.

Dette er nøyaktig samme trusselbilde som ble lagt til grunn for
engangstoken-TOCTOU-fiksen i `verifyMagicLink()`/`confirmAccountDeletion()`
tidligere i natt (se bug ti): e-postsikkerhetsskannere hos enkelte
bedrifter forhåndsbesøker lenker i innkommende e-post automatisk. Den
tidligere fiksen sikret at BARE ÉN bruker av et engangstoken lykkes ved
samtidighet — men den løser IKKE dette problemet: en slik skanner som
besøker lenken FØR den faktiske brukeren rekker det, ville vunnet
kappløpet om selve tokenet og trigget ekte, irreversibel sletting helt
uten at brukeren selv noensinne besøkte siden eller klikket noe. Sammenlign
med steg 1 av samme flyt (`DeleteAccountSection.tsx`, "Be om sletting av
konto") — DEN krever allerede et eksplisitt knappetrykk (`variant="danger"`)
før noe som helst sendes. Steg 2 fulgte ikke sitt eget etablerte mønster.

Sporet opprinnelsen: koden siterte spec-en som begrunnelse ("24.3: 'særlig
sensitive handlinger skal kreve ny autentisering'"), men et grep etter
selve sitatteksten i HELE `SPEC-V1.md` fant KUN denne ene frasen igjen —
sitert tre ganger av kode-/spec-kommentarer, aldri som faktisk,
frittstående spec-prosa noe sted. Seksjon 24 i spec-en
("Implementeringsrekkefølge") har ingen underseksjon 24.1/24.2/24.3 i det
hele tatt. Konklusjon: en tidligere økt bygde denne totrinnsflyten som en
fornuftig, selvstendig designbeslutning, men tilskrev den en spec-referanse
som enten aldri fantes eller ble hengende igjen etter en senere
omnummerering — selve designbeslutningen (egen bekreftelseslenke, tydelig
advarsel i e-postteksten) var riktig og allerede bygget og
nettleser-verifisert av en tidligere økt, men UTEN at den tidligere økten
hadde det senere (denne nattens) e-postskanner-trusselbildet i tankene når
den valgte "automatisk ved lenkeklikk" fremfor "krev en ekstra bekreftelse
på selve siden".

**Fiksen**: `ConfirmDeletionClient.tsx` fyrer ikke lenger POST-kallet
automatisk. Leser tokenet, viser en tydelig advarsel
(`me.confirm_deletion.warning`, ny nøkkel) og en eksplisitt
`variant="danger"`-knapp (`me.confirm_deletion.confirm_button`, ny nøkkel)
— selve API-kallet skjer FØRST når brukeren trykker den. Oppdaterte OGSÅ
`me.delete_account_description`/`me.delete_account_requested_notice` (på
`/me` selv, steg 1) — den gamle teksten lovet eksplisitt "kontoen slettes
ikke før du klikker den [lenken]", som ikke lenger stemmer nå som et ekstra
bekreftelsestrinn kreves på selve siden.

**Testdekning**: ingen testfil eksisterte for denne komponenten i det hele
tatt (samme mangel som webhook-ruten tidligere i natt). La til fire tester:
bekrefter INGEN automatisk `fetch()`-kall ved innlasting (selve beviset på
at feilen er rettet), bekrefter kallet skjer FØRST etter knappetrykk med
korrekt suksessvisning, bekrefter en manglende token gir feilmelding
umiddelbart uten noe kall, og bekrefter en feilrespons etter knappetrykk
viser feilmeldingen. Bekreftet empirisk via `git stash`: 3 av 4 nye tester
feilet mot den gamle, automatisk-fyrende komponenten (ingen knapp fantes i
det hele tatt å klikke på), og alle 4 består mot fiksen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**372
tester**, +4 — bekreftet 3/4 feiler mot gammel automatisk-fyrende
komponent, består mot fiksen), `i18n:check` (**389 nøkler**, +2), `rm -rf
.next && next build` (grønn — bekrefter ingen `useSearchParams`/Suspense-
byggefeil ble introdusert), `test:integration` mot ekte lokal Postgres
(**262 tester**, uendret — selve API-kontrakten for
`POST /me/confirm-deletion` er urørt, kun klientsidens bruk av den endret).

### Neste økt

Denne fiksen retter en reell, om enn smal, konto-integritetsrisiko —
verdt å nevne eksplisitt for morgengjennomgang siden den endrer en
BRUKERFLYT (krever nå ett ekstra trykk før kontosletting fullføres), ikke
bare et internt implementasjonsdetalj. Verdt å sjekke: finnes det FLERE
"engangslenke → automatisk irreversibel handling"-mønstre andre steder i
kodebasen? Kun `unsubscribe/[token]/route.ts` (avmelding — reversibelt,
lavt alvorlighetsnivå selv om det skulle skje utilsiktet) og
`digest-access/[token]/route.ts` (oppretter bare en økt, ikke en
destruktiv handling) bruker lignende engangslenker — begge trygge, siden
ingen av dem er IRREVERSIBLE på samme måte som kontosletting. Ellers
uendret: to åpne spørsmål (`runExpireRequests()`, 18.1 vs 16.2/FR-051),
den siterte, tilsynelatende ugyldige "24.3"-referansen i spec-en (verdt en
egen opprydding — men IKKE gjort her, siden det er en ren
dokumentasjonsopprydding uten hastverk, til forskjell fra selve
sikkerhetsfiksen), komponentbibliotek, OG-bilde, Sentry/Brevo.

## Økt (fortsettelse): selvintrodusert regresjon i ProfileForm.tsx

Fortsatte den kritiske gjennomlesingen til `/me`-skjemalaget etter forrige
runde. Fant en regresjon jeg selv innførte forrige runde (task #57): da
`PATCH /api/me`s Zod-skjema ble rettet fra `max(200)` til `max(80)` for
`displayName` (for å samsvare med `POST /subscribe`,
`POST /requests/:id/responses` og `responses/validate.ts`s egen grense på
samme underliggende `users.display_name`-felt), ble IKKE
`ProfileForm.tsx`s tilhørende klientside-`inputProps={{ maxLength: 200 }}`
oppdatert til å matche.

**Konsekvens**: en bruker med et visningsnavn på 81-200 tegn kunne skrive
inn hele det i nettleseren (feltet tillot det), trykke "Lagre", og få en
uforklarlig 422-avvisning fra serveren uten at grensesnittet noensinne
hadde antydet en grense lavere enn 200. Samme klasse asymmetrisk-vakt-feil
som er funnet flere ganger tidligere i natt (task #24/#25), denne gangen
selvpåført i stedet for arvet.

**Fiksen**: `ProfileForm.tsx` — `maxLength: 200` → `maxLength: 80`, med en
kommentar som forklarer grensen og hvorfor den nå er strengere enn den så
ut til å være. Ingen testfil eksisterte for denne komponenten i det hele
tatt; la til `ProfileForm.test.tsx` med to tester: én som bekrefter
`maxLength="80"` på selve inputfeltet, én som bekrefter selve
lagre-flyten (fetch-kall med riktig body, suksessmelding vises).

**Empirisk verifisering**: `git stash push -- ProfileForm.tsx` for å
midlertidig gjenopprette den gamle `maxLength: 200`-verdien → kjørte
testfilen → bekreftet at nøyaktig 1 av 2 tester feiler (maxLength-testen,
med tydelig `Received: maxLength="200"`; lagre-flyt-testen består uendret,
siden den ikke er avhengig av selve grenseverdien) → `git stash pop` for å
gjenopprette fiksen → bekreftet begge tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**374
tester**, +2), `i18n:check` (389 nøkler, uendret — ingen nye
oversettelsesnøkler i denne fiksen), `design:check-tokens` (OK, 40
komponent-CSS-filer), `next build` (grønn), `test:integration` mot ekte
lokal Postgres (262 tester, uendret — ingen server-side kontrakt endret).

### Neste økt

Neste kandidat, per tidligere identifisert og ikke påbegynt: task #60,
`ChangeCountryForm.tsx` mangler `focusFirstInvalidField()`
(DESIGN.md 6.1) til tross for at den har `isInvalid`-tilstand på to
Select-felt og en Checkbox — de 6 andre skjemaene i kodebasen har dette
mønsteret. Krever restrukturering fra dagens
`<div className={styles.form}>` + `<Button onPress={handleSubmit}>` til
et faktisk `<form ref={formRef} onSubmit={...}>`-element, etter samme
mønster som `ReportForm.tsx` (`useRef<HTMLFormElement>`,
`<form ref={formRef} onSubmit={handleSubmit} noValidate>`, kaller
`focusFirstInvalidField(formRef)` når validering feiler ved innsending).
Ellers uendret: de to åpne spec-spørsmålene og "24.3"-opprydding fra
forrige runde er fortsatt utestående, ikke noe hastverk med dem.

## Økt (fortsettelse): DESIGN.md 6.1 lagt til i ChangeCountryForm.tsx

Fullførte task #60, identifisert i forrige runde. `ChangeCountryForm.tsx`
(`/me/bytt-land`) hadde `isInvalid`-tilstand på begge Select-feltene og
Checkbox-en (styrt av en `attempted`-boolsk, satt til `true` ved
innsendingsforsøk), men kalte aldri `focusFirstInvalidField()` — i strid
med DESIGN.md 6.1s "Skjemaer med feil flytter fokus til første feilende
felt", som de 6 andre skjemaene i kodebasen (`ReportForm`, `LoginForm`,
`SubscribeForm`, `ResponseForm`, `JournalistApplyForm`, m.fl.) allerede
overholder korrekt.

**Root cause**: komponenten brukte `<div className={styles.form}>` +
`<Button onPress={handleSubmit}>`, ikke et faktisk `<form>`-element —
`focusFirstInvalidField(formRef)` krever en `formRef` som peker på et
ekte `<form>` for å kunne gjøre `formRef.current?.querySelector('[aria-invalid="true"]')`.

**Fiksen**: restrukturerte til samme mønster som `ReportForm.tsx`:
`useRef<HTMLFormElement>(null)`, elementet er nå
`<form ref={formRef} className={styles.form} onSubmit={handleSubmit} noValidate>`,
`handleSubmit` tar imot `(event: FormEvent)` og kaller
`event.preventDefault()` først, og kaller `focusFirstInvalidField(formRef)`
når `!formValid` før den returnerer tidlig. Knappen er nå
`<Button type="submit">` i stedet for `onPress={handleSubmit}` (selve
form-elementets `onSubmit` trigger nå innsendingen, som i `ReportForm`).
Ren omstrukturering av selve DOM-formen — ingen endring i valideringslogikk,
felt-rekkefølge eller API-kontrakt.

**Testdekning**: ingen testfil eksisterte for denne komponenten i det hele
tatt. La til `ChangeCountryForm.test.tsx` med to tester: én som bekrefter
at fokus faktisk flytter til Checkbox-en (det eneste feltet som mangler,
siden land/språk forhåndsvelges til brukerens nåværende verdier) ved et
mislykket innsendingsforsøk, og én som bekrefter selve lagre-flyten
(avkrysning + innsending → suksessmelding).

**Empirisk verifisering**: `git stash push -- ChangeCountryForm.tsx` for å
midlertidig gjenopprette den gamle `<div>`+`onPress`-versjonen → kjørte
testfilen → bekreftet at fokus-testen feiler (timeout i `waitFor`, siden
knappen selv beholder fokus — ingen felt fikk det), mens lagre-flyt-testen
fortsatt består (den er uavhengig av selve DOM-strukturen) → `git stash
pop` for å gjenopprette fiksen → bekreftet begge tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**376
tester**, +2), `i18n:check` (389 nøkler, uendret), `design:check-tokens`
(OK, 40 komponent-CSS-filer), `next build` (grønn), `test:integration` mot
ekte lokal Postgres (262 tester, uendret — `POST /me/change-country`s
kontrakt er urørt, kun klientsidens DOM-struktur endret).

### Neste økt

Alle tidligere identifiserte, konkrete oppgaver fra denne nattens kritiske
gjennomlesing er nå fullført (task #1-60). Neste steg: fortsette den
kritiske gjennomlesingen til et nytt område av kodebasen som ikke er
dekket ennå — kandidater å vurdere: (a) admin-dashbordets sider/komponenter
under `/admin` (bygget i task #21, men ikke gjenstand for samme
kritisk-lesing-runde som `/me`-laget har fått i natt), (b) selve
digest-tick-logikken (`src/lib/jobs/digest.ts`/`tick.ts`) for asymmetriske
vakt-mønstre eller uprøvde spec-scenarioer, siden dette er kjernefunksjonalitet
ingen har lest kritisk siden de opprinnelige integrasjonstestene i task #17
ble skrevet. Ellers uendret, fortsatt åpent for morgengjennomgang: de to
spec-spørsmålene (`runExpireRequests()` manglende varsling; 18.1 vs
16.2/FR-051 motsigelse om hvem som kan lese et svars innhold), og
"24.3"-referanseopprydding i spec-en (lav prioritet, ren dokumentasjon).
forrige runde er fortsatt utestående, ikke noe hastverk med dem.

## Økt (fortsettelse): kritisk gjennomlesing av /admin — fant en reell taus-feil-bug

Startet kandidat (a) fra forrige runde: kritisk gjennomlesing av
admin-dashbordet (`/admin`, bygget i task #21, men aldri gjenstand for
samme kritisk-lesing-runde som `/me`-laget). Leste `layout.tsx`,
`page.tsx` (dashbord + `CountrySelector.tsx`), `journalists/page.tsx` +
`JournalistQueueItem.tsx`, `requests/page.tsx` + `RequestQueueItem.tsx` i
sin helhet.

**Funn 1 (lav alvorlighet, ingen fiks)**: dashbordets `?country=`-parameter
for administrator (`CountrySelector.tsx`) valideres ikke mot faktiske
landkoder før den brukes i `getDashboardStatsForCountry()`. Sjekket om
dette er en privilegie-eskalering for MODERATOR — nei: `getDashboardCountries()`
kaller `getAssignedCountryCodes(session)` først, og for en moderator
(`assigned !== "all"`) IGNORERES `selectedCountryCode` fullstendig og
egne tildelte land brukes uansett. For administrator (`assigned === "all"`)
er en ugyldig landkode ufarlig: Drizzle sine parametriserte spørringer
hindrer injeksjon, og en ikke-eksisterende kode gir bare et kort med
alle nullverdier og selve koden som tittel (siden `nameKeyByCountry`
blir tom). Ingen reell sikkerhets- eller krasjrisiko — vurdert og bevisst
IKKE fikset, siden det ikke er en reell feil, bare en ufarlig kant.

**Funn 2 (reell bug, fikset)**: `JournalistQueueItem.tsx` og
`RequestQueueItem.tsx` (klientkomponentene bak godkjenn/avvis/publiser/
be-om-endringer-knappene) hadde INGEN feilhåndtering i det hele tatt —
ved en mislykket `fetch()` (ikke-2xx-respons) satte de bare tilstanden
tilbake til forrige modus, uten å vise noe som helst til administratoren.
Dette er spesielt alvorlig fordi de spesifikke feilkodene
`errors.journalist_not_pending_review` og `errors.request_not_editable`
finnes NETTOPP for scenarioet der to moderatorer behandler samme
søknad/forespørsel samtidig — selve TOCTOU-sikkerhetsfiksen fra
task #48/#49 tidligere i natt returnerer disse eksplisitt, med egne,
allerede-eksisterende, godt formulerte nb-NO-tekster ("Denne søknaden er
allerede behandlet.", "Denne forespørselen kan ikke redigeres nå.") — men
klienten viste dem ALDRI. En administrator som trykket "Godkjenn" på en
søknad en kollega nettopp hadde avvist, ville bare se knappen gå tilbake
til normal tilstand, uten forklaring, og trolig prøve igjen eller anta en
feil i grensesnittet. Alle 6 andre interaktive komponenter i kodebasen
(`ProfileForm`, `ConfirmDeletionClient`, `ReportForm`, `ChangeCountryForm`,
`SubscribeForm`, `JournalistApplyForm`, `LoginForm`, `ResponseForm`) viser
konsekvent en `errorKey`-basert feilmelding ved mislykket innsending —
disse to admin-komponentene var det eneste unntaket.

**Fiksen**: la til `errorKey`-tilstand i begge komponenter. Alle fire
handlere (`handleApprove`, `handleReject` i JournalistQueueItem;
`handlePublish`, `handleReject`, `handleRequestChanges` i
RequestQueueItem) nullstiller `errorKey` ved forsøk, og setter den til
`data.error ?? "errors.generic"` (samme `.json().catch(() => ({}))`-mønster
som resten av kodebasen) ved en ikke-OK-respons. La til en
`<p className={styles.formError}>{t(errorKey)}</p>`-visning rett under
hovedinnholdet i hver `<li>`, og la til `.formError`-CSS-klassen i begge
CSS-modulene (kopiert ordrett fra `ReportForm.module.css`s etablerte
styling — samme semantiske tokens, ingen nye rå verdier).

**Testdekning**: ingen testfil eksisterte for noen av disse to
komponentene, eller for noe i `/admin`-laget i det hele tatt, fra før.
La til `JournalistQueueItem.test.tsx` (3 tester: feilmelding ved mislykket
godkjenning, feilmelding ved mislykket avvisning, bekreftelse ved
vellykket godkjenning) og `RequestQueueItem.test.tsx` (4 tester: feilmelding
ved mislykket publisering/avvisning/endringsforespørsel, bekreftelse ved
vellykket publisering).

**Empirisk verifisering**: `git stash push` på begge `.tsx`-filene
(CSS-filene la jeg bevisst utenfor stashen, siden fraværet av
`.formError`-klassen alene ikke ville gitt en synlig testfeil — klassen
brukes jo betinget av `errorKey`, som ikke fantes i den gamle koden i det
hele tatt) → kjørte begge testfilene → bekreftet at nøyaktig 5 av 7 nye
tester feilet (alle feilmelding-testene, med tydelig timeout i
`findByText` siden elementet aldri ble rendret; de 2
suksess-bekreftelse-testene besto uendret, siden de ikke er avhengige av
feilhåndteringen) → `git stash pop` for å gjenopprette fiksen → bekreftet
alle 7 tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**383
tester**, +7), `i18n:check` (389 nøkler, uendret — alle brukte feilnøkler
fantes allerede), `design:check-tokens` (OK, 40 komponent-CSS-filer),
`next build` (grønn), `test:integration` mot ekte lokal Postgres (262
tester, uendret — ingen server-side kontrakt endret, kun klientens
håndtering av allerede-eksisterende feilresponser).

### Neste økt

Fullførte gjennomlesingen av `/admin/journalists` og `/admin/requests`
sine klientkomponenter samt selve dashbordet (`page.tsx`,
`CountrySelector.tsx`, `layout.tsx`) — ingen flere funn der utover de to
over. IKKE ennå lest kritisk: `src/lib/admin/dashboard.ts` og
`src/lib/admin/countries.ts` sin fulle logikk utover det som ble sett i
forbifarten her (så langt ingen mistanke om feil, men heller ikke en full
linje-for-linje-gjennomgang). Neste kandidat: enten fullføre den
gjenværende `src/lib/admin/`-modulen, eller gå videre til kandidat (b) fra
forrige runde — selve digest-tick-logikken
(`src/lib/jobs/digest.ts`/`tick.ts`), som ingen har lest kritisk siden de
opprinnelige integrasjonstestene i task #17. Ellers uendret: de to åpne
spec-spørsmålene og "24.3"-referanseopprydding er fortsatt utestående for
morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): kritisk gjennomlesing av src/lib/admin/countries.ts — nok en TOCTOU-krasj

Fortsatte gjennomlesingen til `src/lib/admin/`-modulen, som forrige runde
identifiserte som ulest. Leste `countries.ts` (samtlige fem
eksporterte funksjoner: `listAllCountries`, `createCountry`,
`updateCountry`, `setCountryStatus`, `assignModeratorToCountry`) og
`dashboard.ts` linje for linje.

**Funn**: `createCountry()` hadde nøyaktig samme sjekk-så-skriv-mønster
som denne natten allerede har funnet og rettet gjentatte ganger andre
steder (task #48, #49, #54) — en `SELECT ... WHERE code = X`-eksistenssjekk
etterfulgt av en ubeskyttet `INSERT`, uten å fange databasens egen unike
constraint på `countries.code` (primærnøkkel). To administratorer som
samtidig oppretter samme landkode kunne begge passere sjekken før noen av
dem rakk å skrive, og den tapende `INSERT`-en ville krasje med en uhåndtert
Postgres-feil (23505/unique_violation) i stedet for det forventede,
allerede-eksisterende `errors.already_exists`-svaret. Bekreftet dette er
EKTE (ikke bare teoretisk) empirisk: 3 kjøringer på rad med 10 samtidige
`createCountry()`-kall på samme kode ga alle tre en `rejected`-promise
(krasj), ikke en `errors.already_exists`-respons.

Det som gjør dette funnet interessant er at kodebasen allerede HAR en
etablert, delt løsning for nøyaktig dette problemet:
`isUniqueViolation(err)` fra `src/db/errors.ts`, brukt konsekvent i
`registration/recipient.ts`, `registration/journalist.ts`,
`contact-requests/contact-requests.ts` og `responses/responses.ts` — men
`admin/countries.ts` var det ENESTE stedet i kodebasen med et
sjekk-så-`INSERT`-mønster på et unikt/primærnøkkel-felt som IKKE brukte
denne hjelperen. Et rent asymmetrisk-vakt-funn (samme teknikk som
task #24/#25), denne gangen på tvers av hele kodebasen, ikke bare
innad i én modul.

**Fiksen**: pakket `INSERT`-en (og den påfølgende audit-logg-raden, siden
begge må lykkes sammen) i `try`/`catch`, fanger `isUniqueViolation(err)` og
returnerer `errors.already_exists` i så fall — nøyaktig samme mønster som
`recipient.ts`/`journalist.ts`, importert fra samme `@/db/errors`-modul.

**Testdekning**: `countries.integration.test.ts` hadde fra før kun én
SEKVENSIELL "avviser en kode som allerede finnes"-test (treffer bare
forhåndssjekken, ikke selve kappløpsvinduet). La til en ny, EKTE samtidig
test: 10 parallelle `createCountry()`-kall med samme kode via
`Promise.allSettled` (samme teknikk som
`rate-limit.integration.test.ts`s 20-samtidige advisory-lås-test), som
bekrefter at ALLE kallene fullføres (`fulfilled`, aldri en uhåndtert
`rejected`-promise), at nøyaktig ett lykkes, og at nettopp ÉN rad havner i
databasen.

**Empirisk verifisering**: `git stash push -- countries.ts` for å
midlertidig fjerne fangsten → kjørte den nye testen 3 ganger på rad →
bekreftet krasj (`rejected`) i alle tre kjøringene, ikke flakete/tilfeldig
→ `git stash pop` for å gjenopprette fiksen → kjørte testen 3 ganger til →
bekreftet at alle 16 testene i filen består i alle tre kjøringene.

**Funn 2 (vurdert, ingen fiks)**: sjekket om `updateCountry()` og
`setCountryStatus()` har lignende TOCTOU-sårbarheter — nei: begge bruker
`UPDATE ... WHERE code = X` (ikke `INSERT`), som er trygt uansett
race siden en `UPDATE` mot en ikke-eksisterende rad bare påvirker null
rader (ingen constraint-krasj mulig), og `assignModeratorToCountry()`s
`INSERT INTO moderator_countries` bruker allerede
`.onConflictDoNothing()` — det etablerte, korrekte mønsteret. Kun
`createCountry()` hadde det utette mønsteret.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (383
tester, uendret — ren lib/integrasjonsfiks, ingen unit-test berørt),
`i18n:check` (389 nøkler, uendret), `design:check-tokens` (OK, 40
komponent-CSS-filer), `next build` (grønn), `test:integration` mot ekte
lokal Postgres (**263 tester**, +1 — den nye samtidighetstesten).

### Neste økt

Fullførte hele `src/lib/admin/`-modulen (`countries.ts` og `dashboard.ts`,
sistnevnte uten funn — rene, parametriserte spørringer, ingen
skriveoperasjoner å ha en race i). Neste kandidat: kandidat (b) fra
forrige runde — selve digest-tick-logikken (`src/lib/jobs/digest.ts`/
`tick.ts`), som ingen har lest kritisk siden de opprinnelige
integrasjonstestene i task #17 ble skrevet. Verdt å sjekke spesifikt der,
gitt kveldens funnmønster: er det flere sjekk-så-skriv-steder som mangler
`isUniqueViolation`/`onConflictDoNothing`/en betinget WHERE-klausul? Ellers
uendret: de to åpne spec-spørsmålene og "24.3"-referanseopprydding er
fortsatt utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): kritisk gjennomlesing av digest-/tick-logikken — ren, ingen funn

Fulgte opp kandidat (b) fra forrige runde. Leste `src/lib/jobs/tick.ts`
(alle seks jobbfunksjoner: `runDigestTick` + `sendDigestToRecipients`,
`runExpireRequests`, `runExpireContactRequests`, `runDeadlineReminders`,
`runStaleRequestReminders`, `runPurgeUnverified`) i sin helhet, samt
`src/lib/digests/digests.ts` (`listDigests`, `retryFailedDigestDeliveries`)
og `src/lib/email/digest.ts` (`renderDigestContent`,
`insertPerRecipientTokens`) linje for linje, med spesielt fokus på nettopp
sjekk-så-skriv-mønsteret som `countries.ts`-funnet over avdekket.

**Konklusjon: ingen nye funn.** Denne delen av kodebasen er allerede godt
gjennomarbeidet av tidligere økter:

- `runDigestTick()`s `INSERT INTO digests` bruker allerede
  `.onConflictDoNothing()` mot den unike indeksen på
  `(countryCode, scheduledFor)`, med riktig `if (!createdDigest) continue`
  -sjekk — nøyaktig det etablerte, korrekte mønsteret.
- `sendDigestToRecipients()`s `INSERT INTO digest_deliveries` (unik indeks
  på `(digestId, userId)`) trenger ikke samme fangst: funksjonen kalles kun
  ÉN gang per (land, dag) — garantert av `onConflictDoNothing()`-sjekken
  over — og itererer mottakere sekvensielt i samme kall, så det finnes
  ikke noe kappløpsvindu å treffe i utgangspunktet.
- `runDeadlineReminders()`/`runStaleRequestReminders()`s
  sjekk-så-send-så-merk-mønster er en BEVISST akseptert, allerede
  dokumentert avveining (task #43) — ikke en oversett feil.
- `runPurgeUnverified()`s sletterekkefølge er allerede rettet (task #54).
- `retryFailedDigestDeliveries()`s dobbeltleverings-race er allerede
  rettet (task #50) — bruker samme "status i WHERE-betingelsen"-mønster
  som `approveJournalist()`/`publishRequest()`.
- `/api/digest-access/[token]/route.ts` bruker allerede den rettede
  `isSafeRelativePath()` (task #55) korrekt.
- `renderDigestContent()` kjører `escapeHtml()` konsekvent på ALT
  interpolert innhold (tittel, sammendrag, organisasjonsnavn, geografisk
  merknad) — ingen XSS-hull funnet.

Ingen kodeendring denne runden — ren gjennomlesing uten funn. Nevner det
eksplisitt likevel (fremfor å hoppe over en NATTLOGG-oppføring) siden
"lest kritisk, ingenting å rette" er et like nyttig morgenreferansepunkt
som et faktisk funn, gitt at NATTLOGG selv skal fungere som kartet over
hva som er dekket i natt.

### Neste økt

Digest-/tick-laget er nå kritisk gjennomlest uten funn. Gjenstående
kandidater for videre kritisk lesing: `src/lib/requests/` og
`src/lib/responses/` (kjernedomenelogikken for selve
forespørsel/svar-flyten) er ikke eksplisitt bekreftet gjennomgått med
DENNE nattens spesifikke sjekklister (sjekk-så-skriv-mønstre,
asymmetriske vakter, tause klientfeil) — kun task #17-28s bredere
spec-/testdekning-runder tidligere på kvelden. Ellers uendret: de to åpne
spec-spørsmålene og "24.3"-referanseopprydding er fortsatt utestående for
morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): kritisk gjennomlesing av src/lib/requests/requests.ts — enda en sjekk-så-skriv-krasj, denne gangen verre å utløse i praksis

Fulgte opp forrige rundes kandidat: leste `src/lib/requests/requests.ts`
(alle ni eksporterte funksjoner) linje for linje, med samme
sjekk-så-skriv-sjekkliste som avdekket `createCountry()`-funnet forrige
runde.

**Funn**: `generateUniqueSlug()` (kalt fra `updateDraft()` FØRSTE gang en
tittel settes på et utkast) har nøyaktig samme sjekk-så-skriv-mønster —
en `SELECT ... WHERE slug = kandidat`, etterfulgt av en `UPDATE`
et helt annet sted (i selve `updateDraft()`) som ALDRI fanget databasens
unike indeks (`requests_slug_idx` på `requests.slug`). To journalister
(eller samme journalist i to faner) som lagrer et utkast med
samme/lignende tittel omtrent samtidig kunne begge få samme kandidat fra
`generateUniqueSlug()` før noen av dem rakk å skrive, og den tapende
`UPDATE`-en ville krasjet med en uhåndtert 23505 i stedet for bare å
prøve en ny kandidat. Dette er trolig et LETTERE utløst tilfelle enn
`createCountry()`-racen (to administratorer som velger nøyaktig samme
2-bokstavs landkode i samme øyeblikk er sjelden) — to journalister som
gir forespørslene sine et likt eller generisk tittelutkast ("Trenger
kilder til sak om ...") er langt mer sannsynlig i reell bruk.

**Fiksen, og hvorfor den avviker fra `createCountry()`-mønsteret**: i
motsetning til landkode-krasjen er "avvis med `errors.already_exists`"
FEIL respons her — brukeren har ikke prøvd å gjenbruke noe bevisst, de
skrev bare en tittel. Løsningen er derfor å pakke selve `UPDATE`-en i en
løkke: ved en fanget `isUniqueViolation`, genereres en NY kandidat og
skrivingen forsøkes på nytt (opptil 10 ganger), usynlig for brukeren.

**Et andre lag i selve fiksen, funnet empirisk**: den første versjonen av
fiksen kalte bare `generateUniqueSlug()` på nytt ved hvert forsøk — men
den funksjonen skanner DETERMINISTISK fra samme startpunkt hver gang
(base, base-2, base-3, …). Under ekte, HØY samtidighet (testet med 8
parallelle skrivinger med identisk tittel) konvergerte flere samtidige
tapere gjentatte ganger mot NØYAKTIG samme neste kandidat og kolliderte
med HVERANDRE — en kaskade som i verste fall krever like mange runder som
det er samtidige skrivinger for å løse seg helt opp, noe som gjorde at
noen av de 8 fortsatt krasjet selv med 5 tillatte forsøk. Rettet ved å gi
selve gjenopprettingsveien (ikke den vanlige, ikke-samtidige stien) et
TILFELDIG startpunkt for disambiguator-telleren (`2 + tilfeldig(0-999)`)
— sprer taperne fra hverandre slik at de nesten alltid løses opp i én
ekstra runde, uansett hvor mange som kolliderte samtidig. Selve
`generateUniqueSlug()` (den vanlige, udelte veien) er urørt og gir
fortsatt de samme pene, deterministiske "-2"/"-3"-suffiksene som før for
det normale (ikke-samtidige) tilfellet.

**Testdekning**: la til en ekte samtidighetstest i
`requests.integration.test.ts`: 8 utkast opprettes, deretter kalles
`updateDraft()` på ALLE samtidig med NØYAKTIG samme tittel via
`Promise.allSettled`, og bekrefter at alle fullføres (ingen uhåndtert
`rejected`), og at alle 8 ender opp med DISTINKTE slugs.

**Empirisk verifisering**: `git stash push -- requests.ts` for å
midlertidig fjerne HELE fiksen → kjørte testen 3 ganger på rad →
bekreftet krasj (`rejected`) i alle tre kjøringene → `git stash pop` for å
gjenopprette fiksen → kjørte hele testfilen 3 ganger til → bekreftet at
alle 9 testene består i alle tre kjøringene. Underveis ble også en
mellomliggende, UTILSTREKKELIG versjon av fiksen (uten det tilfeldige
startpunktet, kun med 5 forsøk) empirisk avkreftet på samme måte — den
feilet fortsatt mot 8-veis samtidighet, noe som beviste at kaskade-
konvergensen var reell og ikke bare en teoretisk bekymring.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (383
tester, uendret — ren lib/integrasjonsfiks), `i18n:check` (389 nøkler,
uendret), `design:check-tokens` (OK, 40 komponent-CSS-filer), `next build`
(grønn), `test:integration` mot ekte lokal Postgres (**264 tester**, +1).

Merknad: Postgres-tjenesten var nede ved starten av denne runden
(`ECONNREFUSED 127.0.0.1:5432`) — startet på nytt (`service postgresql
start`) før testene kunne kjøre. Ingen kodeårsak, bare containerens egen
tjenestetilstand; nevnt her i tilfelle det skjer igjen neste runde.

### Neste økt

To reelle sjekk-så-skriv-krasjer funnet og rettet på to kvelder på rad
(`createCountry()`, nå `generateUniqueSlug()`/`updateDraft()`) — verdt å
sjekke om MØNSTERET finnes flere steder. Ulest ennå med denne spesifikke
sjekklisten: `src/lib/responses/responses.ts` (kjernedomenelogikken for
selve svar-innsendingen — har trolig egne unike indekser å sjekke, f.eks.
én-svar-per-respondent-per-forespørsel om en slik regel finnes) og
`src/lib/contact-requests/contact-requests.ts`. Ellers uendret: de to
åpne spec-spørsmålene og "24.3"-referanseopprydding er fortsatt
utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): responses.ts/contact-requests.ts allerede rene — men EN systematisk gjennomgang av ALLE unike indekser fant to til

Fulgte opp forrige rundes kandidat. Leste `src/lib/responses/responses.ts`
og `src/lib/contact-requests/contact-requests.ts` i sin helhet —
**begge allerede korrekt rettet**: `submitResponse()` fanger
`isUniqueViolation` mot FR-041-indeksen (kommentaren viser til migrasjon
0001), `createContactRequest()` fanger det samme mot FR-043-indeksen, og
`respondToContactRequest()` bruker allerede det betingede
WHERE-status-mønsteret (task #46). Ingen nye funn i disse to filene.

Gitt at MØNSTERET (sjekk-så-skriv på en unik kolonne uten
`isUniqueViolation`-fangst) nå er funnet TO netter på rad i to urelaterte
moduler, utvidet jeg søket til å være SYSTEMATISK i stedet for fil-for-fil:
listet opp ALLE `uniqueIndex`/`.unique()`-deklarasjoner i `schema.ts` (11
stykker) og sporet hvert eneste skrivested som kunne krysse dem. De fleste
var allerede trygge (tilfeldig genererte tokens med astronomisk lav
kollisjonssjanse, eller allerede beskyttet av `onConflictDoNothing()`/
`isUniqueViolation()`) — men fant TO til som IKKE var det:

**Funn 1**: `assignModeratorToCountry()` (`src/lib/admin/countries.ts`) —
samme sjekk-så-`INSERT`-mønster som `createCountry()`, denne gangen mot
`users.email` sin unike constraint. To administratorer som tildeler SAMME
helt nye e-post som moderator omtrent samtidig kunne begge passere
`existingUser`-sjekken før noen av dem skrev, og den tapende INSERT-en
ville krasjet med en uhåndtert 23505. **Fiksen** avviker fra
`createCountry()`s "avvis med feilmelding": siden begge racende kall har
NØYAKTIG samme, riktige intensjon (denne e-posten skal være moderator for
dette landet), henter fangst-blokken i stedet den nå-eksisterende raden
den vinnende forespørselen opprettet, og fortsetter med DEN — samme
sluttresultat uansett hvem som "vant", ingen brukersynlig feil i det hele
tatt.

**Funn 2**: `publishLegalDocument()` (`src/lib/admin/legal-documents.ts`)
— verre enn de to forrige, siden denne IKKE HAR NOEN forhåndssjekk i det
hele tatt, bare en bar `INSERT` mot den unike indeksen på
`(countryCode, locale, documentType, version)`. En administrator som
dobbeltklikker "Publiser" (eller to administratorer som velger samme
versjonsstreng for samme dokument) ville krasjet umiddelbart. **Fiksen**
er nærmere `createCountry()`s mønster enn `assignModeratorToCountry()`s:
siden `version` er en meningsbærende streng administratoren selv valgte
(ikke noe som kan "løses" ved å prøve på nytt slik slug-kandidater kan),
er riktig respons å avvise med `errors.already_exists` (gjenbrukt
eksisterende nøkkel, ikke en ny), ikke å stille velge en annen versjon.

**Testdekning**: la til ekte samtidighetstester i begge testfilene (10
parallelle kall via `Promise.allSettled`, samme mønster som
`createCountry()`-testen): `assignModeratorToCountry()`-testen bekrefter
nøyaktig ÉN brukerrad opprettes uansett hvor mange samtidige kall som
tildeler samme e-post; `publishLegalDocument()`-testen bekrefter nøyaktig
ÉN dokumentrad publiseres, resten får `errors.already_exists`, aldri en
uhåndtert feil.

**Empirisk verifisering**: `git stash` på hver av de to filene hver for
seg → kjørte de nye testene 3 ganger på rad hver → bekreftet krasj
(`rejected`) i alle seks kjøringene mot den gamle koden → `git stash pop`
→ kjørte hele testfilene 3 ganger til hver → bekreftet at alle tester
består i alle kjøringene mot fiksene.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (383
tester, uendret — rene lib/integrasjonsfikser), `i18n:check` (389 nøkler,
uendret — ingen nye oversettelsesnøkler, `errors.already_exists`
gjenbrukt), `design:check-tokens` (OK, 40 komponent-CSS-filer),
`next build` (grønn), `test:integration` mot ekte lokal Postgres
(**266 tester**, +2).

### Neste økt

Fire reelle sjekk-så-skriv-krasjer nå funnet og rettet totalt
(`createCountry`, `updateDraft`/slug, `assignModeratorToCountry`,
`publishLegalDocument`) — den systematiske "list opp ALLE unike
indekser i schema.ts, spor hvert skrivested"-teknikken viste seg langt
mer effektiv enn fil-for-fil-lesing for akkurat DENNE bug-klassen, og bør
vurderes som en generell teknikk å gjenta senere i natten på andre
bug-klasser (f.eks. "list opp alle fremmednøkler UTEN CASCADE, spor hver
sletting" — retention.ts/purge-unverified-klassen). For selve
unike-indeks-sveipen: alle 11 unike deklarasjoner i schema.ts er nå
sporet og enten bekreftet trygge eller rettet — ingen kjente gjenstående
i DENNE spesifikke bug-klassen. Ellers uendret: de to åpne
spec-spørsmålene og "24.3"-referanseopprydding er fortsatt utestående for
morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): fremmednøkkel-sveip fant en femte krasjbug — purgeOldResponses() i retention.ts

Fulgte opp forrige rundes egen anbefaling: samme systematiske teknikk
(list opp alle fremmednøkler UTEN CASCADE i `schema.ts`, spor hvert
skrivested som sletter en refererende rad), denne gangen anvendt på
`db.delete(...)`-kall i stedet for unike indekser.

**Funn**: `purgeOldResponses()` (`src/lib/jobs/retention.ts`) sletter
`responses`-rader 12 måneder etter at den underliggende forespørselen
lukket, UTEN å først håndtere `contactRequests.responseId` — en nullbar
fremmednøkkel (schema.ts, 19.8) uten CASCADE. Selve schema-kommentaren på
det feltet sier eksplisitt at en kontaktforespørsel "skal overleve" en
slik sletting, siden den har sin EGEN, uavhengige 12-måneders-frist
(`purgeOldContactRequests`, målt fra `updatedAt`) — men koden
implementerte aldri den overlevelsen. Siden `createContactRequest()`/
`respondToContactRequest()` (`src/lib/contact-requests/
contact-requests.ts`) aldri sjekker den underliggende forespørselens
status, kan en kontaktforespørsel opprettes og avgjøres LENGE etter at
forespørselen lukket — dermed kan en kontaktforespørsel fortsatt være
godt innenfor SIN frist selv om svarets frist (12 måneder etter
lukking) allerede er passert. `withdrawResponse()`
(`src/lib/responses/responses.ts`) gjør nettopp denne frikoblingen
korrekt allerede (rettet tidligere i natt) — `purgeOldResponses()` var
det ENESTE andre stedet som sletter en `responses`-rad, og det gjorde
det ikke.

**Alvorlighet**: retention-jobben kjører som standard i `dry run`
(`RETENTION_DRY_RUN` må eksplisitt settes til `"false"`), så dette har
IKKE aktivt slettet noe i produksjon ennå — men er en reell, latent
krasj-bug som ville rammet responskategorien i det øyeblikket dry-run
slås av, nøyaktig den situasjonen brukerens egen instruks ("bygg denne
FORSIKTIG med egne tester") ba om å unngå.

**Fiksen**: `purgeOldResponses()` nuller nå
`contactRequests.responseId` for alle kandidat-ID-ene FØR selve
`DELETE`-en av `responses` — identisk mønster som
`withdrawResponse()` allerede bruker.

**Testdekning**: la til en ny beskrivelsesblokk i
`retention.integration.test.ts`: en lukket forespørsel 13 måneder
tilbake med et innsendt svar, OG en kontaktforespørsel knyttet til det
svaret som ble avgjort (godkjent) for bare 1 måned siden — altså godt
innenfor sin egen frist. Bekrefter at en ekte kjøring sletter svaret UTEN
å krasje, og at kontaktforespørselen overlever med `responseId` nullet.

**Empirisk verifisering**: `git stash push -- retention.ts` for å
midlertidig fjerne fiksen → kjørte testen → bekreftet EKSAKT den
forventede fremmednøkkelfeilen fanget i `errors[]`:
`"update or delete on table "responses" violates foreign key constraint
"contact_requests_response_id_responses_id_fk"..."` → `git stash pop` for
å gjenopprette fiksen → bekreftet alle 11 tester i filen består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (383
tester, uendret), `i18n:check` (389 nøkler, uendret), `design:check-tokens`
(OK, 40 komponent-CSS-filer), `next build` (grønn), `test:integration` mot
ekte lokal Postgres (**267 tester**, +1). Merknad: én kjøring av HELE
integrasjonssuiten viste én forbigående, urelatert feil i
`tick.integration.test.ts` (digest-tick-testens `errors` ikke tom) —
bekreftet IKKE reproduserbar (besto i isolasjon, og besto igjen i to
påfølgende fulle kjøringer). Årsaken var etterlatt tilstand fra denne
øktens egne manuelle, gjentatte kjøringer av
`retention.integration.test.ts` mot samme delte sandkasse-database under
den empiriske verifiseringen (inkludert en kjøring som bevisst krasjet
mot den gamle koden) — ikke en reell regresjon fra selve fiksen.

Postgres-tjenesten var også nede ved starten av denne runden (samme som
forrige runde) — startet på nytt med `service postgresql start` før noe
kunne kjøre.

### Neste økt

Fremmednøkkel-sveipen dekket nå de mest åpenbare kandidatene
(retention.ts, tick.ts, responses.ts) — ingen flere krasj-mønstre funnet
utover denne ene. Verdt å vurdere: er det verdt å gjøre EN fullstendig,
formell sveip av alle 20+ fremmednøklene i schema.ts mot ALLE
slette-/oppdateringssteder (ikke bare de i jobb-filene), eller er
avkastningen synkende nå som de mest sannsynlige stedene (jobber som
sletter persondata) er dekket? Vurder dette som lav prioritet med mindre
et nytt konkret mistankepunkt dukker opp. Ellers uendret: de to åpne
spec-spørsmålene og "24.3"-referanseopprydding er fortsatt utestående for
morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): kritisk gjennomlesing av journalist-siden — nok en taus-feil-bug

Skiftet spor til et nytt, ennå ukritisk-lest område (samme mangel som
`/me`/`/admin` hadde før i natt): journalistens egne sider under
`/journalist`. Leste `layout.tsx`, `requests/page.tsx` +
`NewRequestButton.tsx`, og `requests/[id]/CloseRequestAction.tsx` i sin
helhet, med samme sjekkliste som avdekket de tause admin-feilene
tidligere (task #61).

**Funn**: `NewRequestButton.tsx` («Ny forespørsel»-knappen på
journalistens forespørselsliste) viste INGEN feilmelding ved en mislykket
`POST /requests` — bare en kommentar som forsvarte dette med "ingen
skjemadata å miste". Begrunnelsen var svak: `createDraft()` håndhever
FR-020s grense på 20 utkast per journalist per døgn (SPEC-V1.md 18), en
REELT nåbar feilvei (ikke bare teoretisk), og brukeren fortjener å vite
HVORFOR knappen tilsynelatende ikke gjorde noe, uavhengig av om det
finnes skjemadata å bevare. `CloseRequestAction.tsx` (samme mappe) viser
allerede korrekt en feilmelding ved mislykket lukking — inkonsekvensen
var derfor lokal til denne ene komponenten, ikke et gjennomgående mønster
i journalist-laget.

**Fiksen**: la til `errorKey`-tilstand, nullstilt ved hvert forsøk og satt
til `data.error ?? "errors.generic"` ved en ikke-OK-respons eller kastet
feil. La til en liten, dedikert `NewRequestButton.module.css` (ingen
CSS-modul eksisterte for denne komponenten fra før) med et
`.error`-element under knappen, samme semantiske tokens som resten av
kodebasen (`--color-danger`, `--font-ui`, `--text-sm`).

**Testdekning**: ingen testfil eksisterte for denne komponenten i det
hele tatt. La til tre tester: suksess (navigerer til det nye utkastet),
feilmelding ved `errors.rate_limited` (det konkrete, nåbare FR-020-
tilfellet), og feilmelding ved en nettverksfeil (kastet unntak).

**Empirisk verifisering**: `git stash push -- NewRequestButton.tsx` for å
midlertidig gjenopprette den gamle, tause versjonen → kjørte testfilen →
bekreftet at nøyaktig 2 av 3 tester feiler (begge feilmelding-testene,
tydelig `Unable to find an element with the text...`; suksess-testen
består uendret) → `git stash pop` for å gjenopprette fiksen → bekreftet
alle 3 tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**386
tester**, +3), `i18n:check` (389 nøkler, uendret — begge brukte
feilnøkler fantes allerede), `design:check-tokens` (OK, **41**
komponent-CSS-filer, +1 ny modul), `next build` (grønn), `test:integration`
mot ekte lokal Postgres (267 tester, uendret — ingen server-side kontrakt
endret, kun klientens håndtering av en allerede-eksisterende
feilrespons).

### Neste økt

Fortsett den kritiske gjennomlesingen av `/journalist`-laget: gjenstår
`RequestEditForm.tsx`, `requests/[id]/page.tsx`,
`requests/[id]/responses/page.tsx`, og `responses/[id]/
ResponseDetailPanel.tsx` — ingen av disse er lest kritisk med denne
nattens sjekkliste ennå. Ellers uendret: de to åpne spec-spørsmålene og
"24.3"-referanseopprydding er fortsatt utestående for morgengjennomgang,
ikke noe hastverk med dem.

## Økt (fortsettelse): fullførte /journalist-sveipen — enda en taus-feil-bug, nå INNAD i samme komponent

Fullførte gjennomlesingen fra forrige runde. Leste `RequestEditForm.tsx`
(hele lagre-/innsendingsflyten, feltvalidering, fokushåndtering),
`requests/[id]/page.tsx` (server-siden av redigeringssiden) og
`responses/[id]/ResponseDetailPanel.tsx` i sin helhet.

`RequestEditForm.tsx` og `requests/[id]/page.tsx` er begge rene — viser
`generalError`/feltfeil konsekvent, kaller `focusFirstInvalidField()`
riktig på både lagre- og innsendingsfeil, ingen auto-fyring, korrekt
skrivebeskyttet visning for ikke-redigerbare statuser. Ingen funn der.

**Funn**: `ResponseDetailPanel.tsx` (journalistens svardetalj-side, med
merking/notat OG en kontaktforespørsel-seksjon i SAMME komponent) hadde
et rendyrket asymmetrisk-vakt-tilfelle INNAD i én og samme fil:
`handleSendContactRequest()` fanger og viser korrekt `contactError` ved
en mislykket sending — men `handleSaveMarking()`, rett over den, satte
bare `savingStatus` tilbake til `"idle"` ved en mislykket lagring, uten
NOEN feilindikasjon. En journalist som prøvde å merke et svar mens
forespørselen f.eks. ikke lenger var i riktig tilstand (`errors.
not_found` fra `updateResponseMarking()`) ville sett "Lagre"-knappen
bare gå tilbake til normal tilstand, akkurat samme mønster som de tause
admin-kø- og `NewRequestButton`-funnene tidligere i natt — men denne
gangen var den KORREKTE referanseimplementasjonen bokstavelig talt
20 linjer unna i samme fil, ikke i en annen del av kodebasen.

**Fiksen**: la til `markingError`-tilstand, nullstilt ved hvert forsøk og
satt til `data.error ?? "errors.generic"` ved en ikke-OK-respons eller
kastet feil (samme `.json().catch(() => ({}))`-mønster som resten av
kodebasen), vist med den samme, allerede eksisterende `.error`-CSS-
klassen som `contactError` allerede bruker (ingen ny CSS trengtes).

**Testdekning**: ingen testfil eksisterte for denne komponenten i det
hele tatt. La til to tester: suksess (lagrer og viser "Lagret."), og
feilmelding ved en mislykket lagring (`errors.not_found`).

**Empirisk verifisering**: `git stash push` på komponentfilen for å
midlertidig gjenopprette den tause versjonen → kjørte testfilen →
bekreftet at nøyaktig 1 av 2 tester feiler (feilmelding-testen; suksess-
testen består uendret) → `git stash pop` for å gjenopprette fiksen →
bekreftet begge tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**388
tester**, +2), `i18n:check` (389 nøkler, uendret — `errors.not_found`
fantes allerede), `design:check-tokens` (OK, 41 komponent-CSS-filer,
uendret — ingen ny CSS-modul denne gangen, gjenbrukte `.error`),
`next build` (grønn), `test:integration` mot ekte lokal Postgres (267
tester, uendret — ingen server-side kontrakt endret).

### Neste økt

Hele `/journalist`-laget er nå kritisk gjennomlest (layout, forespørsels-
liste, redigeringsskjema, lukkeknapp, svardetalj-panel) — fire tause-
feil-/asymmetri-funn totalt denne natten på tvers av `/me`, `/admin` og
`/journalist` (task #58, #61, #67, #69), alle av samme mønster: en
handling feiler uten at brukeren får vite hvorfor. Verdt å vurdere om
mønsteret er uttømt nå, eller om det er verdt én runde til på et
gjenstående, ennå ukritisk-lest område (f.eks. `/foresporsler/[id]/svar`
sitt `ResponseForm.tsx` — allerede nevnt testet tidligere i natt, men
ikke eksplisitt sjekket for DENNE spesifikke bug-klassen). Ellers
uendret: de to åpne spec-spørsmålene og "24.3"-referanseopprydding er
fortsatt utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): ResponseForm.tsx allerede ren — men fant en femte taus-feil-bug i ContactRequestActions.tsx

Sjekket `ResponseForm.tsx` (`/foresporsler/[id]/svar`) mot denne nattens
taus-feil-sjekkliste: allerede korrekt — viser `errorKey` konsekvent,
kaller `focusFirstInvalidField()` riktig, ingen auto-fyring. Ingen funn
der, som mistenkt i forrige runde.

Utvidet søket til et NYTT, ennå ukritisk-lest respondent-vendt område:
`/contact-requests/[id]` (siden en respondent bruker til å godkjenne
eller avslå en journalists forespørsel om å dele e-postadressen sin,
14.1-14.3). Fant nøyaktig samme mønster en femte gang:
`ContactRequestActions.tsx`s `respond()` satte bare `status` tilbake til
`"idle"` ved en mislykket godkjenning/avslag, uten NOEN feilindikasjon —
og dette er, i likhet med `ResponseDetailPanel`-funnet, en REELT nåbar
feilvei, ikke bare teoretisk: `respondToContactRequest()` sjekker
`expiresAt` direkte (task #44s fiks), så en kontaktforespørsel siden
viste som `pending` kan ha rukket å utløpe i tidsrommet mellom siden ble
rendret og respondenten faktisk trykket en knapp.

**Fiksen**: la til `errorKey`-tilstand, samme `.json().catch(() =>
({}))`-mønster som resten av kodebasen, vist over knapperaden (IKKE inni
`.actions`-diven, som er en flex-RAD for de to knappene — en feilmelding
der ville havnet side om side med knappene i stedet for over dem; flyttet
derfor komponentens rot til et fragment med feilteksten og
knapperad-diven som to separate barn, som `.main`s egen
`flex-direction: column` allerede stabler riktig). La til
`.formError`-klassen i `page.module.css` (samme semantiske tokens som
alle de andre feilmeldings-klassene i natt, ingen ny CSS-modul trengtes).

**Testdekning**: ingen testfil eksisterte for denne komponenten i det
hele tatt. La til tre tester: suksess (godkjenning), feilmelding ved
mislykket godkjenning (`errors.contact_request_not_pending`), feilmelding
ved mislykket avslag.

**Empirisk verifisering**: `git stash push` på komponentfilen → kjørte
testfilen → bekreftet at nøyaktig 2 av 3 tester feiler (begge
feilmelding-testene; suksess-testen består uendret) → `git stash pop` →
bekreftet alle 3 tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**391
tester**, +3), `i18n:check` (389 nøkler, uendret — `errors.
contact_request_not_pending` fantes allerede), `design:check-tokens` (OK,
41 komponent-CSS-filer, uendret — ny klasse i en eksisterende modul, ikke
en ny fil), `next build` (grønn), `test:integration` mot ekte lokal
Postgres (267 tester, uendret — ingen server-side kontrakt endret).

### Neste økt

Fem tause-feil-/asymmetri-funn totalt denne natten på tvers av `/me`,
`/admin`, `/journalist` og nå `/contact-requests` (task #58, #61, #67,
#69, #70) — konsekvent samme mønster, konsekvent samme fiks. `ResponseForm.tsx`
bekreftet ren. Gjenstående respondent-vendte områder ikke eksplisitt
sjekket med DENNE sjekklisten: `/unsubscribe/[token]`,
`/digest-access/[token]` (begge trolig for enkle til å ha egne
klientkomponenter — verdt en rask sjekk uansett), og selve
`/foresporsler/[id]`-detaljsiden (rapporter-knappen der bruker
`ReportForm.tsx`, allerede bekreftet ren tidligere i natt). Vurder om
mønsteret nå er praktisk uttømt for klientkomponenter — resten av natten
kan med fordel vende tilbake til bredere spec-/kode-hull-jakt (jamfør
fremdriftslisten i standardinstruksen: registreringsruter, digest-
mottakerlogikk osv., som alle allerede er bygget og fungerende per
tidligere økter, men verdt en ny sjekk om noe er glemt). Ellers uendret:
de to åpne spec-spørsmålene og "24.3"-referanseopprydding er fortsatt
utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): rask sjekk av /unsubscribe og /digest-access + fullstendig ruteliste-diff — begge rene

Sjekket de to gjenstående respondent-vendte "verdt en rask sjekk"-
punktene fra forrige runde: `/unsubscribe/[token]` og
`/digest-access/[token]` har INGEN klientkomponent i det hele tatt (rene
Route Handlers, ingen `.tsx`-fil) — taus-feil-mønsteret er strukturelt
umulig der. Bekrefter at klientkomponent-sveipen nå er reelt uttømt på
tvers av HELE `src/app/[locale]/`, ikke bare de fem stedene med faktiske
funn.

Pivoterte deretter til bredere spec-/kode-hull-jakt, per forrige rundes
egen anbefaling: diffet SPEC-V1.md seksjon 20 sin fullstendige ruteliste
mot samtlige faktiske `route.ts`-filer i `src/app/api/` (listet begge
sider, sammenlignet linje for linje). **Resultat: fullstendig samsvar.**
Hver eneste rute i spec-listen er implementert, og den ENE ruten som
finnes i koden men ikke i spec-listen (`GET /health`) er bevisst utenfor
seksjon 20s omfang — den er allerede korrekt dokumentert i
INFRASTRUCTURE.md 8.1 som et rent drifts-/oppetidsendepunkt ("Brukes av
deploy-laget og oppetidsovervåkingen"), ikke en produkt-API-rute. Ingen
funn, ingen endring nødvendig.

### Verifisert før commit (denne runden)

Ingen kodeendring — ren gjennomlesing/diff uten funn. Nevnt eksplisitt av
samme grunn som tidligere "ingen funn"-oppføringer i natt: NATTLOGG skal
vise hva som ER dekket, ikke bare hva som ble rettet.

### Neste økt

To uavhengige sjekklister er nå begge kjørt til uttømming: (1)
taus-feil-/asymmetri-mønsteret i klientkomponenter (fem funn, #58/#61/#67/
#69/#70, dekket hele `src/app/[locale]/`), og (2) sjekk-så-skriv-races på
unike databasekolonner (fire funn, #55/#64 (delvis)/#040abb2s to funn,
dekket alle 11 unike deklarasjoner i schema.ts), pluss en tredje,
beslektet klasse (fremmednøkler uten CASCADE, ett funn, #66). Pluss nå en
fjerde, ren "spec-vs-kode fullstendighet"-sjekk (seksjon 20s ruteliste,
ingen funn). Gjenstående kandidater for en ny økt, i synkende
prioritetsrekkefølge: (a) en tilsvarende fullstendighets-diff av
SPEC-V1.md seksjon 15 (e-postmaltabellen) mot de faktiske
`src/lib/email/templates/`-filene og deres faktiske sendersteder — er
ALLE rader i tabellen faktisk koblet til en reell `sendTransactionalEmail`
/`sendBulkEmail`-kalling, ikke bare bygget som en mal ingen kaller? (b)
en tilsvarende diff av seksjon 22s 40 FR-krav (sist gjort i task #27,
verdt en ny, fersk gjennomgang gitt alt som er rettet siden). Ellers
uendret: de to åpne spec-spørsmålene og "24.3"-referanseopprydding er
fortsatt utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): seksjon 15 (e-postmaler) og et utvalg av seksjon 22s FR-krav — begge rene

Fulgte opp forrige rundes kandidat (a): diffet SPEC-V1.md seksjon 15s
23-rads e-postmaltabell mot de 23 faktiske malfilene i
`src/lib/email/templates/` (ekskludert `simple-cta-email.ts`, som er en
delt layout-hjelper alle 23 andre malene importerer, ikke en egen mal —
bekreftet ved å grepe importer, ikke gjettet). Sporet deretter HVER av de
23 malene i `send.ts`s `TransactionalTemplate`-union til et faktisk
kallsted: 17 via direkte streng-literal-grep, 3 til (`request_approved_
published`/`changes_requested`/`request_rejected`) via ett felles,
parametrisert kallsted i `moderation/requests.ts` (bekreftet at alle tre
faktisk brukes, fra `publishRequest()`/`requestChanges()`/
`rejectRequest()` hver for seg), og de 3 siste
(`confirm_email`/`magic_link`/`journalist_application_received`) via
dynamisk mal-valg i `auth/magic-link.ts` basert på rolle og
`emailVerifiedAt`. **Fullstendig samsvar — alle 23 maler har en reell,
nåbar avsender. Ingen bygget-men-aldri-kalt mal funnet.**

Gjorde deretter noen målrettede stikkprøver i seksjon 22s 40 FR-krav
(fremfor en full på-nytt-gjennomgang av alle 40, som task #27 allerede
gjorde grundig) — plukket krav med en spesifikk, lett-å-bryte-uten-å-
merke-det påstand:

- **FR-025** ("settes ... i SAMME TRANSAKSJON som publisering"): bekreftet
  at `publishRequest()` setter `status`, `publishedAt`, `moderatedBy` og
  `moderatedAt` i ÉN enkelt `UPDATE`-setning (iboende atomisk) — ingen
  separat "gjør offentlig"-steg finnes i det hele tatt, siden
  `getPublicRequest()` bare leser basert på selve statusverdien. Kravet
  er strukturelt umulig å bryte slik koden er bygget.
- **FR-009** ("skal ikke tilby en locale ... der vilkår eller
  personvernerklæring mangler"): bekreftet allerede korrekt implementert
  (`listActiveCountries()`/`filterLocalesWithRequiredDocuments()`,
  `src/lib/countries/countries.ts`) — dette var faktisk en tidligere
  økts EGEN rettelse (kommentaren i koden viser til NATTLOGG, økt 7),
  ikke en ny funn, men verdt å bekrefte at fiksen fortsatt står.

Ingen nye funn i denne runden. Diminishing returns-signal: tre uavhengige
brede spec-vs-kode-sveiper (klientkomponent-taus-feil, unike-indeks-
races, og nå e-postmal-fullstendighet) samt flere målrettede FR-
stikkprøver er nå alle kjørt uten nye funn — kodebasen ser ut til å være
i genuint god stand etter en natt med systematisk jakt. Anbefaler at
neste økt enten (a) gjør en fullstendig, fersk gjennomgang av alle 40
FR-krav én etter én (ikke bare stikkprøver) for å være grundig, eller (b)
aksepterer at brede sveiper har uttømt sin avkastning for nå og i stedet
venter på (eller foreslår) noe konkret fra morgengjennomgangen.

### Verifisert før commit (denne runden)

Ingen kodeendring — ren gjennomlesing/diff/stikkprøver uten funn.

### Neste økt

Se avveiningen over. Ellers uendret: de to åpne spec-spørsmålene
(`runExpireRequests()` manglende varsling; 18.1 vs 16.2/FR-051
motsigelse om hvem som kan lese et svars innhold) og
"24.3"-referanseopprydding i spec-en er fortsatt utestående for
morgengjennomgang, ikke noe hastverk med dem. Kodebasen er i en solid,
grønn tilstand: alle tester består, ingen kjente uhåndterte krasjer,
ingen kjente tause feilveier i klientkomponenter.

## Økt (fortsettelse): fant og rettet et reelt FR-023-avvik ved en fersk, målrettet gjennomgang

Fortsatte den avveide anbefalingen fra forrige runde med en fersk, men
MÅLRETTET (ikke full på-nytt-gjennomgang av alle 40) sjekk av seksjon 22s
FR-krav — spesifikt krav med en presis, lett-å-bryte-uten-å-merke-det
påstand. Fant et reelt, konkret avvik:

**Funn**: FR-023s akseptansekriterium er eksplisitt og presist: "moderator
for `NO` får **404** på en forespørsel i `SE`." Men `publishRequest()`,
`rejectRequest()`, `requestChanges()` (`moderation/requests.ts`) og
`closeRequest()` (`requests/requests.ts`) returnerte alle
`errors.not_authorized` — som samtlige tilhørende ruter mapper til
**403**, ikke 404 — når en moderator er tildelt et ANNET land enn
forespørselens. Dette var ingen tilfeldig glipp: en EKSISTERENDE,
bevisst skrevet test (`requests.integration.test.ts`) asserterte
eksplisitt `errors.not_authorized` for nøyaktig dette scenarioet — en
reell spec-vs-kode-motsigelse, ikke en åpenbar bug, nøyaktig den typen
funn regelen "spec-en er sannheten" er skrevet for.

Sjekket samtidig HVOR UTBREDT mønsteret er: identisk "hent ressurs →
sjekk `requireModeratorForCountry()` → `errors.not_authorized` ved
`null`" finnes IKKE bare for forespørsler, men også i
`moderation/users.ts` (suspender/opphev/sperr e-post),
`moderation/journalists.ts` (godkjenn/avvis), `moderation/responses.ts`
(skjul/åpne), og `digests/digests.ts` (kjør på nytt) — men FR-023s
akseptansekriterium nevner UTTRYKKELIG bare "en forespørsel", ikke disse
andre ressurstypene. Bevisst IKKE utvidet fiksen til disse fem andre
filene i denne runden — det ville vært en stille, egen beslutning om et
BREDERE sikkerhetsprinsipp enn det spec-en faktisk sier ordrett, ikke en
retting av et konkret, spec-forankret avvik. Flagger det som et åpent
spørsmål for morgengjennomgang i stedet (se under).

**Fiksen**: la til `checkModeratorForCountry()` i `auth/authorize.ts` —
en ny, presisjonsvariant av `requireModeratorForCountry()` som skiller
`"unauthorized"` (ingen økt/feil rolle — skal fortsatt gi 403) fra
`"wrong_country"` (gyldig moderatorøkt, men feil land — skal nå gi 404
via `errors.not_found`). Den DELTE `requireModeratorForCountry()` selv
er URØRT (fortsatt brukt uendret av de fem andre filene). Oppdaterte de
fire request-modererende funksjonene til å bruke den nye, mer presise
sjekken.

**Testdekning**: oppdaterte de to eksisterende testenes assertions
(`errors.not_authorized` → `errors.not_found`, for `closeRequest()` og
`publishRequest()`), og la til to HELT NYE tester som manglet fra før
(`rejectRequest()`/`requestChanges()` hadde ALDRI hatt egen
feil-land-testdekning i det hele tatt).

**Empirisk verifisering**: `git stash push` på alle tre berørte
kildefiler → kjørte begge testfilene → bekreftet at nøyaktig 4 av 20
tester feiler (de to oppdaterte og de to nye — alle fire med tydelig
`errors.not_authorized` mottatt der `errors.not_found` var forventet; de
16 andre besto uendret) → `git stash pop` → bekreftet alle 20 tester
består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (391
tester, uendret — ren lib-/integrasjonsfiks), `i18n:check` (389 nøkler,
uendret), `design:check-tokens` (OK, 41 komponent-CSS-filer, uendret),
`next build` (grønn), `test:integration` mot ekte lokal Postgres
(**269 tester**, +2).

### Neste økt

**Åpent spørsmål for morgengjennomgang** (tredje i rekken, se de to
andre under): bør samme 403→404-presisering (FR-023s prinsipp: ikke
bekreft at en ressurs finnes utenfor moderatorens tildelte land) utvides
til `moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts` og `digests/digests.ts`, som alle i dag
fortsatt returnerer 403 for akkurat samme "moderator i feil land"-
scenario? Spec-teksten (seksjon 4: "en moderator ... ser bare køer og
brukere tilhørende disse") antyder at PRINSIPPET er ment å gjelde bredt,
men FR-023s KONKRETE akseptansekriterium nevner bare forespørsler
eksplisitt — ikke stort nok grunnlag til å utvide stille i natt. Ellers
uendret: de to andre åpne spec-spørsmålene og "24.3"-referanseopprydding
er fortsatt utestående, ikke noe hastverk med dem.

## Økt (fortsettelse): FR-002-sjekk fant en reell mangel i selve RUTENS statuskode-mapping (ikke i submitResponse() selv)

Fortsatte den målrettede FR-krav-sjekken med FR-002: "Systemet skal ikke
ta imot svar fra en konto uten `email_verified_at`. | Test: innsending
fra ubekreftet konto returnerer 403."

**Undersøkelsen**: `submitResponse()` (`src/lib/responses/responses.ts`)
sjekker allerede korrekt `respondent.status !== "active"` og returnerer
`errors.not_authorized` for det — men RUTEN
(`src/app/api/requests/[id]/responses/route.ts`) sin egen
status-mappende ternary manglet en eksplisitt gren for akkurat DENNE
feilkoden, til forskjell fra samtlige ~10 søsterruter jeg sjekket (som
alle eksplisitt mapper `errors.not_authorized` til 403) — falt i stedet
gjennom til den generiske 422-en.

**Et viktig funn UNDERVEIS, som endret hva fiksen faktisk beviser**: den
første testversjonen (en full databasedrevet rutetest, med en EKTE
`pending_email_verification`-konto og en ekte økt) ga **401**, ikke
403/422 som forventet! Sporet dette til `getCurrentSession()`
(`src/lib/auth/session.ts`, linje 122): den gjør SIN EGEN, tidligere
ferske statussjekk (`row.status !== "active"` → `null`) og returnerer
dermed 401 for ENHVER ikke-aktiv konto LENGE FØR ruten når frem til
`submitResponse()` i det hele tatt. Konklusjon: FR-002s bokstavelige
scenario ("ubekreftet konto") er allerede korrekt håndtert — bare via
401, ikke 403 som spec-teksten sier ordrett (en presisjonsforskjell i
spec-en, ikke en funksjonssvikt i koden — selve sikkerhetsegenskapen
holder). `submitResponse()` sin EGEN interne `not_authorized`-gren er i
praksis kun nåbar via et smalt kappløpsvindu (kontoen suspenderes MELLOM
øktsjekkens lesning og `submitResponse()` sin egen, ferske re-lesning av
samme rad) — et reelt, om enn smalt, forsvar-i-dybden-tilfelle, ikke
selve FR-002-scenarioet.

**Fiksen**: la til den manglende `errors.not_authorized → 403`-grenen i
rutens ternary, for konsistens med alle søsterruter og som et reelt
(om smalt) forsvar mot kappløpsvinduet over. Oppdaterte kode- og
kommentarteksten til å beskrive dette PRESIST (kappløpsvindu-forsvar,
ikke "fikser FR-002"), fremfor å overselge fiksen som noe den ikke er.

**Testdekning**: skrev først en full integrasjonstest (ekte DB, ekte
økt) — den AVDEKKET selv 401-oppdagelsen over, men kunne ikke bevise
FIKSEN (siden 403-grenen aldri nås via en ekte, sekvensiell HTTP-kjede).
Erstattet med en ren enhetsnivå-test som mocker
`submitResponse()`/`getCurrentSession()` direkte — beviser nøyaktig
ternary-logikken som faktisk ble endret, uten å late som om et umulig
scenario er testet.

**Empirisk verifisering**: `git stash push` på ruten → kjørte
enhetstesten → bekreftet at nøyaktig 1 av 2 tester feiler (422 mottatt,
403 forventet; den andre testen, som dekker de allerede-korrekte
404/409/429-grenene, besto uendret) → `git stash pop` → bekreftet begge
tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**393
tester**, +2), `i18n:check` (389 nøkler, uendret), `design:check-tokens`
(OK, 41 komponent-CSS-filer, uendret), `next build` (grønn),
`test:integration` mot ekte lokal Postgres (269 tester, uendret — ren
enhetsnivåfiks, ingen integrasjonstest berørt). Merknad: én kjøring av
HELE integrasjonssuiten viste én forbigående, urelatert feil i
`digests.integration.test.ts` — bekreftet IKKE reproduserbar (besto i
isolasjon og i en påfølgende full kjøring), samme klasse delt-database-
tilstandsstøy som er sett flere ganger tidligere i natt, ikke en
regresjon fra denne fiksen.

### Neste økt

Metoden denne runden (spore en FR-akseptansekriteriums PRESISE HTTP-
status ende-til-ende gjennom hele kallkjeden, ikke bare den underliggende
lib-funksjonen) fant to reelle, om enn små, presisjonsavvik på to netter
på rad (FR-023, nå FR-002) — verdt å fortsette samme teknikk på flere av
de gjenværende FR-kravene med en konkret "returnerer X" (ikke bare "skal
gjøre Y")-påstand, f.eks. FR-041 (409), FR-043 (409), FR-051 (422). Ellers
uendret: de tre åpne spec-spørsmålene og "24.3"-referanseopprydding er
fortsatt utestående for morgengjennomgang, ikke noe hastverk med dem.

## Økt (fortsettelse): fullførte de tre gjenstående HTTP-status-sjekkene — alle rene

Sjekket de tre resterende, konkrete "returnerer X"-påstandene fra
forrige runde sin liste:

- **FR-041** ("andre innsending returnerer 409"): allerede bekreftet
  korrekt i samme rute som ble rettet denne natten
  (`errors.already_responded` → 409 i `requests/[id]/responses/route.ts`).
- **FR-043** ("andre forsøk returnerer 409"): `journalist/responses/[id]/
  contact-request/route.ts` mapper `errors.contact_request_already_sent`
  → 409 korrekt.
- **FR-051** ("oppslag uten begrunnelse returnerer 422"):
  `admin/responses/[id]/route.ts` returnerer eksplisitt 422
  (`errors.reason_required`) for en manglende/ugyldig begrunnelse, FØR
  den i det hele tatt kaller `getResponseForAdmin()`.

Alle tre allerede korrekte — ingen funn, ingen endring. Dette
konkluderer HTTP-status-sporingsteknikken for denne natten: av de
konkrete "returnerer X"-påstandene som faktisk ble sporet gjennom hele
kallkjeden (rute → lib-funksjon → tilbake), ble 2 reelle avvik funnet og
rettet (FR-023, FR-002-relatert) og 3 bekreftet allerede korrekte
(FR-041, FR-043, FR-051). Teknikken er nå kjørt til et naturlig
metningspunkt for denne runden.

### Verifisert før commit (denne runden)

Ingen kodeendring — ren gjennomlesing/verifisering uten funn.

### Neste økt

Kodebasen er i en solid, grønn tilstand etter en lang natt med
systematisk feiljakt (72 fullførte oppgaver totalt). Tre uavhengige
brede teknikker er nå kjørt til metning: klientkomponent-taus-feil (5
funn), sjekk-så-skriv-races på unike/fremmednøkler (5 funn), og
HTTP-status-presisjon mot FR-krav (2 funn). Anbefaler at neste økt enten
(a) velger et helt nytt, ennå ukritisk-lest hjørne av kodebasen å lese
linje for linje (f.eks. `src/lib/journalists/` eller
`src/lib/legal/documents.ts`, som ingen av disse tre teknikkene direkte
har dekket), eller (b) venter på morgengjennomgang av de TRE åpne
spec-spørsmålene (`runExpireRequests()` manglende varsling; 18.1 vs
16.2/FR-051 motsigelse om hvem som kan lese et svars innhold; om
403→404-presiseringen fra FR-023 bør utvides til de fire andre
moderator-scopede filene) og "24.3"-referanseopprydding, som alle
fortsatt er utestående, ikke noe hastverk med dem.

## Økt: administrasjonsgrensesnittets dekningshull (16.2) — funn og et reelt hull rettet

Fortsatte med en helt ny vinkel denne runden: leste `SPEC-V1.md` 16.2
("Funksjoner") ordrett opp mot den FAKTISKE admin-katalogen
(`src/app/[locale]/admin/`), i stedet for å lese modul for modul som de
tre tidligere brede teknikkene (tause klientfeil, sjekk-så-skriv-races,
HTTP-status-presisjon).

**Funn 1 (stort, udiskutabelt hull i UI — dokumentert, IKKE bygget denne
runden)**: 16.2 lister fem admin-funksjonsområder. Kun to av dem har noe
UI i det hele tatt:
- **Journalister**: har en side, men BARE modereringskøen (godkjenn/avvis)
  — mangler søk, se søknadsgrunnlag i detalj, suspender, opphev
  suspensjon, se tidligere forespørsler.
- **Forespørsler**: har en side som dekker køen (godkjenn/avvis/returner/
  lukk) — dette området er reelt dekket.
- **Mottakere**: INGEN side. `moderation/users.ts` (`suspendUser()`,
  `unsuspendUser()`, `suppressUserEmail()`) og API-rutene
  (`/admin/users/:id/suspend` osv.) finnes og er testet — men ingen søk på
  e-post, ingen visning av kontostatus/samtykkehistorikk, ingen sletting
  fra UI.
- **Utsendelser**: INGEN side. `digests/digests.ts` (`listDigests()`,
  `retryFailedDigestDeliveries()`) og API-rutene finnes og er testet —
  ingen visning av siste digester, sendt-antall, bounces/klager, ingen
  "kjør på nytt"-knapp.
- **Land**: INGEN side. `admin/countries.ts` og `admin/legal-documents.ts`
  (opprette/redigere land, sette status, tildele moderatorer, publisere
  juridiske dokumenter) finnes og er testet — ingen UI for noe av dette.

Grepet bekreftet null treff på "suspend"/"unsuspend" i HELE
`src/app/**/*.tsx` — bekrefter at disse handlingene er helt uten
inngangspunkt for en ekte administrator i dag, til tross for at
lib-/rute-laget er ferdig og grundig testet. Dette er en betydelig,
udiskutabel avstand mellom spec og kode (ikke en tolkningstvist som de
tre tidligere åpne spørsmålene) — men å bygge tre-fire nye
administrasjonssider er en vesentlig større og annerledes type oppgave
enn resten av nattens feilrettinger, og ble derfor KUN dokumentert denne
runden, ikke bygget. Anbefaling til morgengjennomgang: prioriter
"Utsendelser" først om dette tas videre — `listDigests()`/
`retryFailedDigestDeliveries()` og deres ruter er allerede ferdig
testet, så den siden er ren UI-kobling uten ny forretningslogikk.
"Mottakere" trenger trolig en ny `searchUsersByEmail()`-lib-funksjon
først (finnes ikke i dag). "Land" er den mest sensitive (endrer
juridisk-dokument-status/landkonfigurasjon) og bør bygges sist, med egen
forsiktighet.

**Funn 2 (reelt, rettet denne runden): `DigestDelivery.provider_message_id`
og `bounced`/`complained`-statusene var ALDRI satt noe sted i kodebasen.**
Dette ble oppdaget mens jeg vurderte hva "Utsendelser"-siden over faktisk
ville vise: 16.2 sier eksplisitt "bounces, klager" per digest, og
19.10 definerer nettopp `DigestDelivery.status` med `bounced`/`complained`
og et `provider_message_id`-felt for å gjøre det mulig. Sporet hele
kjeden:

- `sendViaBrevo()` (send.ts) kastet bort HELE Brevo-svarkroppen — leste
  aldri `messageId`-feltet i responsen.
- `sendBulkEmail()` returnerte `void` — ingen kaller (`tick.ts`,
  `retryFailedDigestDeliveries()`) hadde noe å lagre uansett.
- `processEmailEvent()` (webhook-mottakeren) oppdaterte KUN den globale
  `emailSubscriptions`/`suppressions`-tilstanden — rørte aldri
  `digestDeliveries` i det hele tatt.
- Webhook-ruten videresendte aldri noen meldings-ID fra Brevo-nyttelasten.

Resultat: `provider_message_id` var alltid `null`, og
`bounced`/`complained` kunne ALDRI settes på en `DigestDelivery` — de to
tallene 16.2 eksplisitt krever ("bounces, klager" per digest) var
strukturelt umulig å beregne, uansett om UI-en over noen gang bygges.
Dette er ikke en tolkningstvist — spec-en (19.10) definerer feltet og
statusene presist, og koden brukte dem aldri.

**Fiksen (additiv, rører ikke eksisterende abonnements-/sperrelisteatferd)**:
- `sendViaBrevo()` leser nå svarkroppen og trekker ut `messageId`
  (`extractBrevoMessageId()`, defensivt — samme "ikke bekreftet mot ekte
  Brevo-dokumentasjon"-forbehold som resten av filen), returnerer
  `string | null`.
- `sendBulkEmail()` returnerer nå `Promise<string | null>` (var `void`).
  `sendTransactionalEmail()` forkaster bevisst verdien — transaksjonell
  e-post har ingen tilsvarende per-utsendelse-tabell å lagre den i.
- `tick.ts` og `digests.ts` (`retryFailedDigestDeliveries()`) lagrer nå
  denne IDen i `digestDeliveries.providerMessageId` ved statusovergangen
  til `"sent"`.
- `processEmailEvent()` tar nå en valgfri `providerMessageId` og
  oppdaterer — UAVHENGIG av (og i TILLEGG til) den eksisterende globale
  håndteringen — den SPESIFIKKE `DigestDelivery`-raden med samme ID til
  `bounced`/`complained`/`delivered`. Et bomskudd (ingen rad med den
  IDen — f.eks. en transaksjonell e-post) feiler ikke, bare ingen
  handling.
- Webhook-ruten trekker nå ut `message-id` fra nyttelasten (valgfritt
  felt, samme "ikke bekreftet mot ekte dokumentasjon"-forbehold som
  `normalizeEvent()`) og sender den videre.

**Testdekning**: nye tester i `send.test.ts` (messageId trekkes ut
korrekt / `null` ved manglende felt eller uparsbar kropp / `null` i
stubb-modus), `email-events.integration.test.ts` (fire nye tester: hard
bounce/klage/levert setter DEN SPESIFIKKE DigestDelivery-en, og en
ukjent ID feiler stille uten å røre noe), en ny test i
`tick.integration.test.ts` og en utvidet test i
`digests.integration.test.ts` (begge mocker `sendBulkEmail` til å
returnere en kjent ID og bekrefter den lagres), og en ny
ende-til-ende-test i webhook-rutens `route.integration.test.ts` (ekte
POST med `message-id` i kroppen oppdaterer riktig rad).

**Empirisk verifisering**: `git stash push` på hver av de fem berørte
kildefilene (send.ts; email-events.ts + route.ts sammen; tick.ts +
digests.ts sammen) → bekreftet at NØYAKTIG de nye testene feiler mot den
gamle koden i alle tre kjøringer (ingen andre regresjoner) →
`git stash pop` → bekreftet alle tester består igjen.

**Miljømerknad**: Postgres-tjenesten (og selve datakatalogen) hadde
overlevd fra en tidligere økt (samme `kildebanken`-databasebruker fantes
allerede, med et ukjent passord) — satte et nytt lokalt passord og
opprettet en `.env` for denne økten (gitignored, ingen ekte hemmeligheter).
Selve skjemaet manglet derimot `rate_limit_hits`-tabellen (en migrasjon
som tydeligvis aldri var kjørt mot NETTOPP denne vedvarende
datakatalogen) — kjørte `npx tsx src/db/migrate.ts`, som løste det. Ikke
en kodefeil, ren miljø-drift.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**396
tester**, +3), `i18n:check` (389 nøkler, uendret), `design:check-tokens`
(OK, 41 komponent-CSS-filer, uendret), `next build` (grønn),
`test:integration` mot ekte lokal Postgres (**275 tester**, +6, etter at
migrasjonen over ble kjørt).

### Neste økt

To spor står åpne, i prioritert rekkefølge:

1. **Admin-UI-hullet (Funn 1 over)**: hvis morgengjennomgangen bestemmer
   at dette skal bygges, start med "Utsendelser" (ren UI over allerede
   testet lib/rute-lag), deretter en ny `searchUsersByEmail()` for
   "Mottakere", og la "Land" vente til sist (mest sensitivt).
2. De tre tidligere åpne spec-spørsmålene og "24.3"-referanseopprydding
   er fortsatt utestående for morgengjennomgang, uendret fra forrige
   økt.

Ellers: kodebasen er grønn. `provider_message_id`-fiksen over er
selvstendig verifiserbar og trygg å bygge videre på (f.eks. når/hvis
"Utsendelser"-siden bygges, vil bounce-/klage-tallene den skal vise nå
faktisk kunne beregnes korrekt).

## Økt (fortsettelse): "24.3"-referanseopprydding — spec rettet først, deretter kodens sitater

Tok tak i den lavprioriterte, lenge utestående "24.3"-opprydningen (nevnt
som utestående i flere tidligere økter). Grep bekreftet 9 siteringer av
"SPEC-V1.md 24.3" på tvers av 6 filer — seksjon 24 ("Implementeringsrekke-
følge") har ingen underseksjoner i det hele tatt, og frasen "særlig
sensitive handlinger skal kreve ny autentisering" finnes ikke som
frittstående spec-prosa noe sted. Prinsippet koden faktisk implementerer
(et EGET bekreftelsestoken, atskilt fra innloggingstokenet, pluss et
eksplisitt knappetrykk før en irreversibel handling som kontosletting
fyrer) er reelt og riktig — bare uten noen faktisk hjemmel i spec-en.

**Fulgte regelen ordrett: spec først, deretter kode.** La til en ny
`### 18.2 Sensitive, irreversible handlinger` i `SPEC-V1.md` (rett etter
18.1, i "Sikkerhet"-kapittelet — det naturlige hjemmet, ikke seksjon 24
som er ren fasedokumentasjon) som beskriver prinsippet presist slik det
faktisk er bygget, med en synlig fotnote om HVORFOR den ble lagt til nå.

Rettet deretter alle 9 kodesiteringer, men IKKE mekanisk til "18.2" overalt
— sjekket hver enkelt i kontekst, siden ikke alle faktisk siterte SAMME
prinsipp:
- `me/route.ts`, `me/confirm-deletion/route.ts`, `me/request-deletion/
  route.ts`, `account-deletion.ts` (×2), `schema.ts` (AuthToken) — alle
  disse siterte NETTOPP "eget token for en sensitiv, irreversibel
  handling" → rettet til 18.2.
- `tokens.ts` (×2) — siterte generell token-hashing/tilfeldighet, som
  allerede er dekket av 18s hovedliste ("Tokens lagres hashet") — IKKE
  18.2s mer spesifikke prinsipp. Rettet til en enkel "18"-henvisning i
  stedet for å tvinge inn en 18.2 som ikke passer.
- `digest.ts` — fant HER en ANNEN, ubeslektet feilsitering i SAMME
  kommentarlinje ("9.3", som er "Moderering" — helt urelatert):
  "tilgangstoken" og "avmeldingstoken" siktet åpenbart til 6.2 ("Tilgang
  fra digest-lenken") og 10.3 ("Bounce, klager og avmelding") — trolig en
  fingerglipp (10.3 → 9.3) fra en tidligere økt. Rettet begge samtidig
  siden de sto i nøyaktig samme linje.

Ingen av disse er atferdsendringer — bare kommentar-/spec-tekst. Ingen ny
testdekning var påkrevd (ingen kode-logikk endret), men kjørte likevel
hele verifiseringskjeden for å utelukke en skrivefeil i selve
redigeringen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**396
tester**, uendret), `i18n:check` (389 nøkler, uendret),
`design:check-tokens` (OK, 41 komponent-CSS-filer, uendret), `next build`
(grønn), `test:integration` mot ekte lokal Postgres (**275 tester**,
uendret). Grep etter "24.3" i hele `src/` bekrefter null gjenværende
treff.

### Neste økt

"24.3"-opprydningen er nå fullført og kan fjernes fra "utestående"-listen.
Gjenstår: admin-UI-hullet (16.2, se forrige seksjon over — stort, venter
på morgenbeslutning) og de tre opprinnelige åpne spec-spørsmålene
(`runExpireRequests()` manglende varsling; 18.1 vs 16.2/FR-051-
motsigelsen om hvem som kan lese et svars innhold; om 403→404-
presiseringen fra FR-023 bør utvides til de fire andre moderator-scopede
filene i `moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`) — ingen av disse tre er
endret eller besluttet denne runden, fortsatt bevisst latt åpne for
menneskelig gjennomgang.

## Økt (fortsettelse): bygget admin-siden "Utsendelser" (SPEC-V1.md 16.2)

Startet på admin-UI-hullet dokumentert i forrige seksjon — valgte
"Utsendelser" som anbefalt, siden `listDigests()`/
`retryFailedDigestDeliveries()` og API-rutene allerede fantes og var
testet, og dette var den eneste av de tre helt manglende seksjonene
(Mottakere, Utsendelser, Land) som ikke krevde ny lib-logikk fra bunnen av.

**Ett reelt hull oppdaget underveis**: `listDigests()` returnerte kun de
rå `Digest`-feltene — INGEN nedbrytning på `bounces`/`klager`/`sendt`, som
16.2 eksplisitt krever ("se ... antall sendt, bounces, klager"). Uten
denne nedbrytningen ville den nye siden vist digester uten noen av de
tallene spec-en faktisk ber om. Utvidet derfor `listDigests()` (fortsatt i
`src/lib/digests/digests.ts`, samme funksjon — IKKE en ny funksjon) til å
telle `DigestDelivery.status` gruppert per digest i én samlet spørring
(unngår N+1), lagt til som nye felter (`sentCount`, `bouncedCount`,
`complainedCount`, `failedCount`) på hver rad. `sent` og `delivered`
telles sammen som "sendt" — et `delivered`-webhook-kall er bare en ekstra
bekreftelse på en allerede vellykket sending, ikke et eget utfall.

**Bygget**:
- `src/app/[locale]/admin/digests/page.tsx` — server-komponent, samme
  mønster som `/admin/requests`: henter `session` (kun moderator/admin),
  kaller `listDigests(session)` direkte (ikke via `fetch`), sorterer
  nyeste-først på `scheduledFor` (en ren strengsammenligning — feltet er
  allerede en "YYYY-MM-DD"-streng i landets lokale tidssone, se
  `db/integration/fixtures.ts` — bevisst UNNGÅTT enhver
  `Date`/`Intl.DateTimeFormat`-omvei her, som kunne gitt et datoskift for
  negative UTC-forskyvninger; samme grunn til at dashbordet i
  `admin/page.tsx` også viser `scheduledFor` rått).
- `src/app/[locale]/admin/digests/DigestRow.tsx` — klientkomponent for
  hver rad: viser de fire tallene i et `<dl>`-statgrid (samme mønster som
  dashbordets stattall), og en "Kjør på nytt"-knapp
  (`POST /admin/digests/:id/retry`) deaktivert når `failedCount === 0`.
  Fulgte det etablerte `errorKey`-mønsteret fra natten (5 tidligere
  tause-feil-fiks) fra FØRSTE forsøk denne gangen, ikke som en
  etterpåklok reparasjon: viser en oversatt feilmelding ved mislykket
  gjensending, og en suksessmelding med faktisk antall gjensendte
  (ICU-plural, `{count, plural, =0 {...} one {...} other {...}}`, samme
  teknikk som `journalist.inbox.*`).
- Ny navigasjonslenke i `admin/layout.tsx`, nye i18n-nøkler i begge
  locales (`admin.digests.*`).

**Testdekning**: ny integrasjonstest i `digests.integration.test.ts` som
beviser at tellingen ikke blander sammen to ulike digester (fem
leveranser fordelt bevisst skjevt over to digester, sjekker at hver
beholder sine egne tall) — empirisk bekreftet via `git stash` (feiler mot
gammel `listDigests()`, består mot fiksen). Ny `DigestRow.test.tsx` (4
tester: tallene vises, knappen deaktiveres ved 0 feilede, feilmelding ved
mislykket forsøk, suksessmelding med riktig antall) — empirisk bekreftet
ved midlertidig å fjerne feilhåndteringen og disable-logikken fra
komponenten (3 av 4 tester feilet da, som forventet), deretter gjenopprettet.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**400
tester**, +4), `i18n:check` (**401 nøkler**, +12), `design:check-tokens`
(OK, **43 komponent-CSS-filer**, +2, ingen rå verdier), `next build`
(grønn — `/[locale]/admin/digests`, `/api/admin/digests`,
`/api/admin/digests/[id]/retry` alle med i rutelisten),
`test:integration` mot ekte lokal Postgres (**276 tester**, +1).

### Neste økt

"Utsendelser" er nå bygget og verifisert. Gjenstår av de tre opprinnelig
helt manglende admin-seksjonene (16.2):
- **Mottakere**: søk på e-post, kontostatus/samtykkehistorikk, sletting,
  suspender ved misbruk. `moderation/users.ts` og API-rutene finnes og er
  testet, MEN ingen `searchUsersByEmail()`-funksjon finnes ennå — denne må
  bygges FØRST, med egen testdekning, før selve siden.
- **Land** (kun administrator): opprette/redigere landkonfigurasjon,
  status, moderator-tildeling, publisere juridiske dokumentversjoner.
  `admin/countries.ts`/`admin/legal-documents.ts` finnes og er testet.
  Mest sensitivt av de tre — bør bygges sist, med egen forsiktighet
  (endrer juridisk-dokument-status og landkonfigurasjon).
- **Journalister**-siden mangler fortsatt søk, suspender/opphev
  suspensjon, og "se tidligere forespørsler" (kun modereringskøen finnes).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang.

## Økt (fortsettelse): bygget admin-siden "Mottakere" (SPEC-V1.md 16.2), inkludert to nye ruter i spec-en

Fortsatte til "Mottakere", nest anbefalte fra forrige runde. Denne krevde,
i motsetning til "Utsendelser", HELT NY lib-funksjonalitet — verken søk
eller en administratorutløst sletting fantes noe sted.

**Rettet spec-en FØRST** (samme disiplin som `provider_message_id`- og
"24.3"-fiksene tidligere i natt): 16.2 lister "søk på e-postadresse" og
"gjennomfør sletting" som to av "Mottakere"s fire konkrete
moderatorhandlinger, men verken en søkerute, en administratorutløst
sletterute, eller de underliggende funksjonene fantes i seksjon 20s
ruteliste. La til `GET /admin/users?email=...` og
`POST /admin/users/:id/delete` med en footnote som forklarer hullet
(se SPEC-V1.md, rett før `/me/request-deletion`-footnoten).

**Et TREDJE sted "24.3" dukket opp**: da jeg leste rundt i spec-en for å
finne riktig sted å legge til footnoten, fant jeg at forrige natts
"24.3"-opprydding hadde MISSET flere siteringer — jeg grep'et forrige
gang kun `src/`, aldri selve `SPEC-V1.md`. Fem gjenværende treff (linje
844, 1377/1379 i 19.14 AuthToken, 1466 i ruteoversikten, 1572 i en
footnote) siterte samme oppdiktede "24.3". Rettet alle fem til enten 18.2
(sensitive/irreversible handlinger) eller en enkel "18"-henvisning (generell
token-hashing, der siteringen egentlig gjaldt DEN, ikke 18.2s mer
spesifikke prinsipp) — samme presisjon som forrige natts fiks, ikke en
mekanisk søk-og-erstatt. Lærdom for fremtidige spec-siteringsopprydninger:
grep HELE repoet, ikke bare `src/`.

**Bygget**:
- `performAccountDeletion()` (`src/lib/auth/account-deletion.ts`) er nå
  eksportert med en ny, valgfri `actorUserId`-parameter (faller tilbake
  til `userId` selv — selvbetjent sletting via `confirmAccountDeletion()`
  er UENDRET). Dette er den SAMME slettelogikken som den selvbetjente
  to-stegs tokenflyten bruker — ingen duplisert kopi.
- `searchUsersByEmail(session, emailQuery)` og `adminDeleteUser(userId)`
  i `src/lib/moderation/users.ts`, ved siden av `suspendUser()`/
  `unsuspendUser()`/`suppressUserEmail()`. Søket er delvis og
  versalufølsomt (`ilike`), scoped til `role = recipient` (16.2 skiller
  eksplisitt "Mottakere" fra "Journalister" — journalistsøk hører til et
  ANNET, ennå ubygget hjørne av samme seksjon), landfiltrert som
  `listDigests()`, med en enkel `SEARCH_RESULT_LIMIT = 20` som
  sikkerhetsventil (ikke spec-krevd, men et fornuftig standardvalg mot et
  altfor vidt søk). `adminDeleteUser()` sender inn `session.userId` som
  `actorUserId` slik at revisjonsloggen viser MODERATOREN, ikke
  mottakeren selv, som utførende — til forskjell fra selvbetjent sletting.
  Krever INGEN bekreftelseslenke (18.2s prinsipp gjelder der brukeren
  selv ber om det via en lenke de kan ha mottatt ved en feil — her har
  moderatoren allerede autentisert seg og tar en bevisst, direkte
  beslutning).
- To nye API-ruter: `GET /admin/users` og `POST /admin/users/:id/delete`.
- `src/app/[locale]/admin/recipients/page.tsx` (server-komponent, søk via
  URL-en `?email=...`, samme mønster som `CountrySelector.tsx`s
  landvalg — ingen klientside-datahenting), `SearchForm.tsx` (klient,
  navigerer via `router.push()` ved innsending), `RecipientRow.tsx`
  (klient — viser status og samtykkehistorikk, ETT eksplisitt
  bekreftelsestrinn for sletting FØR selve API-kallet fyrer, samme
  `errorKey`-mønster som de fire tidligere silent-failure-fiksene,
  fulgt fra første forsøk).
- Ny navigasjonslenke, nye i18n-nøkler i begge locales
  (`admin.recipients.*`).

**Testdekning**: 10 nye integrasjonstester i
`moderation/users.integration.test.ts` (søk: delvis/versalufølsomt
treff med samtykkehistorikk, tomt søk gir tom liste, landfiltrering for
moderator, alle-land for administrator, ALDRI en journalist-/
moderatorkonto; sletting: ukjent ID, feil rolle avvises, feil land
avvises, sletter direkte og logger MODERATOREN som actorUserId, avviser
en allerede slettet konto). Under skrivingen av landfiltrering-testen
oppdaget jeg at et generisk søkeord ("recipient") ville matchet et stort,
ukontrollert antall rader fra MANGE tidligere netters testkjøringer i
denne delte, aldri-nullstilte databasen (se fixtures.ts sin egen
"disponibel sandkasse"-advarsel) — rettet til å søke på et utsnitt av
selve den tilfeldige UUID-delen i stedet for et fast prefiks, en
lærdom verdt å huske for FREMTIDIGE `ilike`-baserte søketester i denne
databasen. 8 nye komponenttester i `RecipientRow.test.tsx` (visning,
krever ikke-tom begrunnelse for suspensjon, feilmelding ved mislykket
suspensjon/sletting, suksessmelding for begge, det eksplisitte
bekreftelsestrinnet før sletting faktisk fyrer, begge handlinger
deaktivert for en allerede slettet konto) og 1 i `SearchForm.test.tsx`.

**Empirisk verifisering**: `git stash push` på `users.ts` +
`account-deletion.ts` sammen → bekreftet at NØYAKTIG de 10 nye
integrasjonstestene feiler (funksjonene finnes ikke) → `git stash pop` →
alle 24 tester i filen består. For `RecipientRow.tsx`: fjernet
midlertidig feilhåndteringen OG bekreftelsestrinnet for sletting (kalte
`fetch` direkte fra førsteklikks-knappen) → bekreftet 3 av 8 tester
feiler (nøyaktig de som tester akkurat DISSE to tingene) → gjenopprettet,
alle 8 består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**409
tester**, +9), `i18n:check` (**421 nøkler**, +20), `design:check-tokens`
(OK, **46 komponent-CSS-filer**, +3, ingen rå verdier), `next build`
(grønn — `/[locale]/admin/recipients`, `/api/admin/users`,
`/api/admin/users/[id]/delete` alle med i rutelisten), `test:integration`
mot ekte lokal Postgres (**286 tester**, +10, etter én forbigående,
urelatert feil i to andre testfiler pga. den kjente
tilfeldig-dato-kollisjonsrisikoen i `uniqueScheduledFor()`-mønsteret —
bekreftet IKKE reproduserbar i en påfølgende full kjøring, samme klasse
delt-database-støy sett flere ganger tidligere).

### Neste økt

To av de tre opprinnelig helt manglende admin-seksjonene er nå bygget
("Utsendelser", "Mottakere"). Gjenstår:
- **Land** (kun administrator): opprette/redigere landkonfigurasjon,
  status, moderator-tildeling, publisere juridiske dokumentversjoner.
  Mest sensitivt — bør bygges sist, med egen forsiktighet (endrer
  juridisk-dokument-status og landkonfigurasjon som faktiske brukere kan
  stole på).
- **Journalister**-siden mangler fortsatt søk, suspender/opphev
  suspensjon, og "se tidligere forespørsler".

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang.

## Økt (fortsettelse): utvidet admin-siden "Journalister" (SPEC-V1.md 16.2) — søk, suspender/opphev, tidligere forespørsler

Valgte "Journalister"-utvidelsen fremfor "Land" denne runden — "Land" er
eksplisitt flagget som mest sensitivt og bør bygges med egen forsiktighet
i en fersk økt, mens denne utvidelsen kunne gjenbruke MYE eksisterende,
allerede testet kode.

**Oppdaget underveis**: `listJournalists(session, statusFilter?)` fantes
allerede og var mer komplett enn antatt — den støtter allerede å liste
journalister i ALLE statuser (ikke bare `pending_review`), bare uten
noe UI som brukte den slik. `suspendUser()`/`unsuspendUser()` i
`moderation/users.ts` er allerede rolleuavhengige (virker på enhver
`users`-rad, ikke bare mottakere) — samme API-ruter bygget for
"Mottakere" forrige runde (`/api/admin/users/:id/suspend`,
`.../unsuspend`) kunne gjenbrukes direkte, uten noen ny rute.

**Utvidet** (ikke erstattet) `listJournalists()`:
- Ny, valgfri tredje parameter `emailQuery` (delvis, versalufølsomt søk
  via `ilike`, samme mønster som `searchUsersByEmail()`) — bakoverkompatibel
  posisjonsparameter, de to eksisterende kallstedene (`admin/journalists/
  page.tsx`, `GET /admin/journalists`-ruten) er urørt.
- `JournalistListItem` har nå `status` (kontostatus — nødvendig for å vite
  om suspender/opphev skal være slått på, fantes ikke i det hele tatt før)
  og `pastRequestCount` (SPEC-V1.md 16.2: "se tidligere forespørsler") —
  telles gruppert i ÉN spørring for hele listen (ikke N+1), ekskluderer
  `draft` (aldri sendt inn) og `deleted` (slettet FØR publisering) —
  begge er "aldri egentlig en behandlet forespørsel"-tilfeller, ikke en
  reell "tidligere forespørsel" en moderator trenger å se.
- `GET /admin/journalists` fikk et nytt `?email=`-søkeparameter,
  videresendt til `listJournalists()`.

**UI**: la til en NY seksjon nederst på den EKSISTERENDE
`admin/journalists/page.tsx` (den opprinnelige køen over
ubehandlede søknader står uendret øverst) — et søk på tvers av ALLE
journalister uansett status, med `JournalistSearchForm.tsx` (samme
`?email=`-URL-mønster som `admin/recipients`) og `JournalistSearchRow.tsx`
(viser søknadsgrunnlag, kontostatus, godkjenningsstatus og antall
tidligere forespørsler, med suspender — ETT bekreftelsestrinn med
obligatorisk begrunnelse, samme mønster som `RecipientRow.tsx` — og
opphev suspensjon — ETT klikk, ingen begrunnelse, samme asymmetri som
allerede eksisterer i `unsuspendUser()` selv, ikke noe nytt introdusert
her). Nye i18n-nøkler i begge locales (`admin.journalists.search_*`,
`.status.*`, `.verification_status.*`, `.suspend*`, `.unsuspend*`,
`.past_requests_label` med ekte ICU-plural).

**Testdekning**: 6 nye integrasjonstester i
`journalists.integration.test.ts` (ingen `listJournalists()`-tester
fantes FØR i det hele tatt, til tross for at funksjonen selv var
implementert — en reell, allerede eksisterende dekningsmangel): alle
statuser + status/pastRequestCount uten filter, e-postsøk inkluderer
treffet og EKSKLUDERER en annen journalist eksplisitt (første forsøk på
denne testen beviste bare at søkeordet fantes i en UFILTRERT liste også
— styrket til en ekte negativ påstand etter at den empiriske
verifiseringen avslørte svakheten), statusFilter+emailQuery kombinert
med OG-logikk, landfiltrering for moderator, alle-land for administrator,
tom liste for moderator uten tildelt land. 7 nye komponenttester i
`JournalistSearchRow.test.tsx` (visning, "opphev suspensjon" deaktivert
for en ikke-suspendert konto, krever begrunnelse for suspensjon,
feilmelding ved mislykket suspensjon/oppheving, suksessmelding for begge)
og 1 i `JournalistSearchForm.test.tsx`.

**Empirisk verifisering**: `git stash push` på `journalists.ts` +
ruten → bekreftet at NØYAKTIG de 2 nye testene som faktisk tester ny
atferd feiler (pastRequestCount/status, og — etter styrkingen —
e-postsøkets EKSKLUDERING av en annen journalist) → `git stash pop` →
alle 13 tester består. For `JournalistSearchRow.tsx`: fjernet
midlertidig feilhåndteringen OG unsuspend-knappens deaktiveringslogikk
→ bekreftet nøyaktig 2 av 7 tester feiler → gjenopprettet, alle 7 består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run` (**417
tester**, +8), `i18n:check` (**434 nøkler**, +13), `design:check-tokens`
(OK, **48 komponent-CSS-filer**, +2, ingen rå verdier), `next build`
(grønn), `test:integration` mot ekte lokal Postgres (**292 tester**, +6).

### Neste økt

Alle tre opprinnelig helt manglende admin-seksjonene fra 16.2 er nå
enten bygget eller utvidet, unntatt:
- **Land** (kun administrator): opprette/redigere landkonfigurasjon,
  status, moderator-tildeling, publisere juridiske dokumentversjoner.
  Fortsatt den siste, mest sensitive gjenstående — bygg denne med egen
  forsiktighet i en fersk økt (endrer juridisk-dokument-status og
  landkonfigurasjon som faktiske brukere stoler på).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang.

## Økt (fortsettelse): bygget admin-siden "Land" (SPEC-V1.md 16.2, kun administrator) — den siste av de tre opprinnelig manglende admin-seksjonene

Bygget med den ekstra forsiktigheten forrige økt selv ba om — dette er den
eneste admin-siden som kan endre landkonfigurasjon, aktivere/pause et
land, tildele moderator og publisere juridiske dokumentversjoner, alt
noe ekte brukere stoler på.

**Ny lib-funksjon**: `listLegalDocumentsForCountry(countryCode)` i
`src/lib/admin/legal-documents.ts` — fantes ikke fra før, til tross for at
`publishLegalDocument()` selv gjorde. Uten den kunne ikke UI-et vise
HVILKE dokumentversjoner som allerede finnes for et land før man
publiserer en ny. Returnerer bevisst ALLE versjoner, nyeste først (ikke
bare den gjeldende) — 17.2 sier eldre versjoner beholdes uendret, og en
administrator bør kunne se hele historikken, ikke bare siste versjon.

**Rollegating er strengere enn de tre andre admin-sidene**: "Land" er
FØRSTE admin-side som krever `role === "admin"` alene — de tre andre
(Utsendelser, Mottakere, Journalister) tillater `moderator || admin`,
per 16.2s eksplisitte "(kun administrator)" for akkurat denne seksjonen.
`admin/layout.tsx` henter nå sesjonen i selve layout-et og viser
"Land"-lenken KUN til administratorer — uten dette ville en moderator
sett en lenke som bare førte til en forvirrende omdirigering til
innloggingssiden.

**Arkitekturvalg verdt å notere**: `Country.nameKey` og
`Country.senderNameKey` er i18n-NØKKELSTRENGER (f.eks. `"country.no.name"`),
ikke visningstekst — de slås opp via `t(nameKey)` andre steder i
kodebasen (bl.a. dashbordet). Siden FR-012 håndhever i18n-nøkler ved
BYGGETIDSPUNKT (`i18n/check-keys.ts`), kan et genuint nytt land ALDRI bli
fullt selvbetjent fra dette skjemaet alene — å opprette et nytt land
krever nødvendigvis at en utvikler i tillegg legger til den tilhørende
i18n-nøkkelen i en egen kodeendring. Dette er IKKE en feil, men er
eksplisitt dokumentert i selve UI-et (hjelpetekst under begge feltene i
opprettelses- og redigeringsskjemaet) i stedet for enten (a) å bygge en
stille ødelagt brukeropplevelse som gir manglende-oversettelse-fallbacks,
eller (b) å finne opp et system for kjøretids-i18n-nøkkelhåndtering som
ligger utenfor omfanget av det spec-en ber om.

**Statusbytte og feltredigering er bevisst TO separate handlinger**
(egne knapper, egne feilmeldinger) — speiler `updateCountry()` og
`setCountryStatus()` sin egen kommentar i den eksisterende PATCH-ruten:
"statusbytte har egne forutsetninger... skal ikke kunne omgås ved
samtidig å sende andre felt."

**Nye filer**: `admin/countries/page.tsx` (server-komponent, henter
`listAllCountries()` + `listLegalDocumentsForCountry()` per land via
`Promise.all`, formaterer datoer server-side — ingen rå `Date`-objekter
sendes til klient-komponenter, samme konvensjon som de tre andre
admin-sidene), `CreateCountryForm.tsx` (kollapset skjema for nytt land),
`CountryCard.tsx` (visning + redigering + statusbytte + moderator-
tildeling for ett land), `LegalDocumentsSection.tsx` (liste over
eksisterende dokumentversjoner + kollapset publiseringsskjema), med
tilhørende CSS-moduler. ~50 nye i18n-nøkler i begge locales under
`admin.countries.*`.

**Testdekning**: 3 nye integrasjonstester for
`listLegalDocumentsForCountry()` (avvises uten admin-sesjon; returnerer
ALLE versjoner nyeste-først — verifisert med to eksplisitt navngitte
versjoner og en 5ms pause mellom publiseringene, ikke bare en løs
array-sammenligning; lekker ALDRI et annet lands dokumenter). 4
komponenttester i `CreateCountryForm.test.tsx`, 8 i `CountryCard.test.tsx`
(visning vs. redigering, forhåndsutfylling, feilmelding og suksessmelding
for HVER av de tre uavhengige handlingene, tildel-moderator krever
ikke-tom e-post), 6 i `LegalDocumentsSection.test.tsx`.

**Empirisk verifisering**: for `legal-documents.ts` (sporet fil):
`git stash push` → bekreftet at nøyaktig de 3 nye testene feiler
("is not a function") → `git stash pop` → alle 11 tester i filen
består. For de tre NYE, usporede komponentfilene (der `git stash` ikke
er relevant) ble en tilsvarende teknikk brukt: sikkerhetskopi til
`/tmp/*.bak`, fjernet feilhåndteringen i én handler om gangen, kjørte
akkurat den testfilen, bekreftet at NØYAKTIG feilstien(e) feilte og
resten fortsatt besto, gjenopprettet fra sikkerhetskopi og bekreftet
alle tester grønne igjen:
- `CreateCountryForm.tsx`: 1 av 4 tester feilet (feilmeldingstesten) —
  gjenopprettet, alle 4 består.
- `CountryCard.tsx`: 1 av 8 tester feilet (statusbytte-feilmeldingen) —
  gjenopprettet, alle 8 består.
- `LegalDocumentsSection.tsx`: 1 av 6 tester feilet
  (publiserings-feilmeldingen) — gjenopprettet, alle 6 består.

**Reell nettleserverifisering (Playwright, ikke bare enhetstester)**:
opprettet en midlertidig admin-økt direkte i Postgres (rå token hvis
SHA-256-hash matcher en `sessions`-rad, samme mønster som
`hashToken()`), kjørte hele den gyldne stien i ekte Chromium: opprett
land → rediger felt → tildel moderator → FORSØK aktivering BLOKKERES
riktig (ingen juridiske dokumenter ennå) → publiser 4 dokumentversjoner
(vilkår + personvern på begge språk) → aktivering LYKKES. Ryddet opp
ALT manuelt opprettet testdata etterpå (landet, dokumentene, moderator-
tildelingen, den midlertidige admin-kontoen/økten, tilhørende
revisjonslogg-rader) — for å ikke etterlate engangs-verifiseringsstøy i
den delte, langvarige testdatabasen (til forskjell fra den allerede
akseptable opphopningen fra selve den automatiserte integrasjonstest-
suiten, som er en kjent og tolerert unntak, se `fixtures.ts`).

**Miljøoppdagelse verdt å ta vare på for FREMTIDIG nettleserverifisering**:
`npx next dev` hydrerer IKKE korrekt i dette miljøet — CSP-headeren i
`src/middleware.ts` bruker bevisst `script-src 'self' 'nonce-...'
'strict-dynamic'` UTEN `unsafe-eval` (riktig for produksjon), men Next
sin DEV-moduses HMR-kjøretid er avhengig av `eval()`, som denne CSP-en
blokkerer — knapper/skjemaer rendres, men `onClick`-håndterere kjører
aldri, HELT STILLE (ingen synlig feil i UI-et, kun i
`page.on("pageerror")`-loggen). Bekreftet at dette OGSÅ skjer på den
eksisterende, urørte `/admin/journalists`-siden — altså en allerede
eksisterende miljøbegrensning, ikke en regresjon fra denne øktens kode.
**Løsning for enhver fremtidig manuell nettleserverifisering av
klient-interaktivitet i dette miljøet**: bruk `npx next build && npx
next start` (produksjonsmodus, ingen eval-avhengig modulinnpakking) i
stedet for `next dev`.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren, etter å ha rettet en reell typefeil i egen ny
testfil — `getByRole(..., { name, exact: true })` er ikke en gyldig
`ByRoleOptions`-egenskap i `@testing-library/dom`s typer; `name`
matches allerede eksakt som standard, så `exact: true` var overflødig
og ble fjernet), `eslint .` (0 feil/advarsler), `vitest run` (**435
tester**, +18), `i18n:check` (**498 nøkler**, +64), `design:check-tokens`
(OK, **52 komponent-CSS-filer**, +4, ingen rå verdier), `next build`
(grønn — `/[locale]/admin/countries` og
`/api/admin/countries`-familien med i rutelisten), `test:integration`
mot ekte lokal Postgres (**295 tester**, +3).

### Neste økt

Alle tre opprinnelig helt manglende admin-seksjonene fra SPEC-V1.md 16.2
er nå ferdig bygget: Utsendelser, Mottakere, Journalister (utvidet) og
Land. Ingen kjent gjenstående admin-side-mangel fra 16.2.

Mulige neste steg (ingen er hastesaker, ingen kjente feil driver dem):
- Et generelt søk gjennom resten av SPEC-V1.md etter eventuelle andre
  ikke-implementerte "kun administrator"/"kun moderator"-detaljer utenfor
  seksjon 16.2 spesifikt.
- Vurdere om `CreateCountryForm`/`CountryCard` sin
  nameKey/senderNameKey-begrensning (utvikler må legge til i18n-nøkkelen
  separat) bør nevnes i README.md eller INFRASTRUCTURE.md som en kjent
  driftsprosess for lansering av nye land, ikke bare i selve UI-hjelpe-
  teksten.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt (fortsettelse): fant og tettet et reelt hull i "Forespørsler"-delen av 16.2 — admin/moderator kunne aldri se, og dermed aldri lukke, en aktiv forespørsel

Fulgte forrige økts eget "Neste økt"-spor: et generelt søk gjennom
SPEC-V1.md etter admin/moderator-detaljer utenfor 16.2 fant ingenting nytt
(seksjon 4, 18, 20 stemmer med koden), men et NÆRMERE blikk på 16.2 selv
avdekket noe: "Forespørsler: modereringskø, forhåndsvisning, godkjenn,
avvis, returner med kommentar, **lukk**." — "lukk" har aldri hatt noen
vei inn fra administrasjonsgrensesnittet.

`POST /admin/requests/:id/close` og den underliggende `closeRequest()`
(delt med journalistens egen lukkeknapp) fantes allerede fra en tidligere
økt (commit `d7d930e`) — ruten var korrekt landbegrenset og fungerte fint
kalt direkte. Problemet var étt nivå opp: `listModerationQueue()`, den
ENESTE listefunksjonen `admin/requests/page.tsx` brukte, filtrerer
eksplisitt på `status = "submitted"` — en forespørsel som er publisert
(altså den ENESTE statusen `closeRequest()` faktisk godtar) vises ALDRI
der. Administrasjonsgrensesnittet hadde med andre ord en fullt fungerende
bakvei til å lukke en forespørsel, men ingen måte å FINNE den forespørselen
på i det hele tatt — en reell, brukbar funksjonsmangel, ikke bare en
kosmetisk detalj.

**Fiks**: ny `listActiveRequests(session)` i
`src/lib/moderation/requests.ts` — samme landfiltrering og mønster som
`listModerationQueue()` (dokumentert i en kommentar som eksplisitt
forklarer GAPET den tetter), men `status = "published"`. Utvidet
`admin/requests/page.tsx` med en ny seksjon ("Aktive forespørsler") under
den eksisterende modereringskøen, med en ny `ActiveRequestItem.tsx`
(+ CSS-modul) som speiler journalistsidens egen
`CloseRequestAction.tsx`-mønster: ett bekreftende ekstra klikk før selve
lukkingen fyrer (samme "danger"-knapp, samme begrunnelse — `closeRequest()`
sier selv at lukking er irreversibelt, blant annet fordi ventende
kontaktforespørsler utløper umiddelbart). Nye i18n-nøkler under
`admin.requests.active_*`/`.close_*` i begge locales.

**Testdekning**: 4 nye integrasjonstester for `listActiveRequests()`
(moderator ser en publisert forespørsel for EGET land, ser den ALDRI for
et annet lands, administrator ser uansett land, en `submitted`-forespørsel
vises ALDRI her). Under skrivingen oppdaget jeg at den lokale
`createActiveJournalistPlain()`-hjelperen i testfilen ikke oppretter noen
`journalistProfiles`-rad — ufarlig for de eksisterende
`publishRequest`/`rejectRequest`/`requestChanges`-testene (de trenger den
ikke), men `listModerationQueue()` OG `listActiveRequests()` innerJoin'er
akkurat den tabellen for visning, så en journalist uten profil ble
usynlig i resultatet uten noen synlig feilmelding. Løst med en egen,
ny `createActiveJournalistWithProfile()`-hjelper for disse fire testene,
uten å røre den eksisterende (fortsatt brukt av 11 andre tester). 4 nye
komponenttester i `ActiveRequestItem.test.tsx` (visning, bekreftelsestrinn
kreves før kallet faktisk fyrer, avbryt uten å fyre, feilmelding og
suksessmelding).

**Empirisk verifisering**: `git stash push` på `requests.ts` (sporet fil)
→ bekreftet at nøyaktig de 4 nye testene feiler ("is not a function") →
`git stash pop` → alle 15 tester i filen består. For
`ActiveRequestItem.tsx` (ny, usporet fil): sikkerhetskopi + fjernet
feilhåndteringen i `handleClose()` → bekreftet nøyaktig 1 av 4 tester
feiler (feilmeldingstesten) → gjenopprettet, alle 4 består.

### Sidefunn under `test:integration`: en reell, bekreftet kollisjonsrisiko på tvers av tre testfiler

Full kjøring av `test:integration` feilet først med
`duplicate key value violates unique constraint
"digests_country_scheduled_for_idx"` i
`webhooks/email-events/route.integration.test.ts` — IKKE en fil jeg
hadde rørt. Isolert kjøring av akkurat den filen besto uten feil, så
gravde videre: tre HELT UAVHENGIGE testfiler
(`route.integration.test.ts`, `digests.integration.test.ts`,
`subscriptions/email-events.integration.test.ts`) hadde hver sin egen,
identiske formel for å generere en "unik" `scheduledFor`-dato —
`Math.random() * 1_000 dager` — mot SAMME `TEST_COUNTRY_CODE`. Ingen av
de tre filene visste om de to andres identiske mønster. `scheduledFor`
er en del av en ekte unik indeks (`(country_code, scheduled_for)`,
19.10 — bærer idempotensen i INFRASTRUCTURE.md 5.2), og med hundrevis av
allerede opprettede digest-rader for landet i denne delte, aldri
nullstilte databasen (samme kjente fenomen som tidligere økter har
støtt på, se `fixtures.ts` sin egen "disponibel sandkasse"-advarsel) ga
et spekter på bare 1000 dager en reell, ikke bare teoretisk,
fødselsdagsparadoks-kollisjonsrisiko — bekreftet ved at 1, deretter 3,
tester i nøyaktig denne filen feilet på to påfølgende fulle kjøringer.

**Fiks**: samme mønster i alle tre filene, endret fra `1_000` til
`10_000_000` dager (fortsatt trygt godt innenfor JavaScript sin
`Date`-grense på ca. ±100 millioner dager fra epoke — ingen
overløpsrisiko). Reduserer kollisjonssannsynligheten med samme faktor
uten å endre noen av testenes faktiske påstander (ingen av de tre
bruker selve datoverdien til noe annet enn å tilfredsstille den unike
indeksen og landets fremmednøkkel). Bekreftet med to påfølgende fulle
`test:integration`-kjøringer, begge grønne (**299 tester** hver gang) —
kollisjon er iboende sannsynlighetsbasert og kan i prinsippet fortsatt
skje en sjelden gang, men risikoen er nå redusert med samme faktor som
spekteret ble utvidet med (10 000×).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**439 tester**, +4), `i18n:check` (**507 nøkler**, +9),
`design:check-tokens` (OK, **53 komponent-CSS-filer**, +1, ingen rå
verdier), `next build` (grønn — `/[locale]/admin/requests` med i
rutelisten, ny "Aktive forespørsler"-seksjon), `test:integration` mot
ekte lokal Postgres, to påfølgende ganger (**299 tester** hver gang,
+4 fra `listActiveRequests()`).

### Neste økt

"Forespørsler"-delen av 16.2 er nå komplett: modereringskø,
forhåndsvisning, godkjenn, avvis, returner med kommentar OG lukk — alle
seks funksjonene har nå en reell vei inn fra administrasjonsgrensesnittet.

Ingen kjent gjenstående admin-side-mangel fra 16.2 i det hele tatt nå.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt (fortsettelse): ryddet opp de to gjenstående punktene fra forrige økts "Neste økt" — begge små, ingen kjente feil drev dem

### `listModerationQueue()` manglet egne, direkte integrasjonstester

Nøyaktig samme mangel `listActiveRequests()` hadde før forrige økt:
funksjonen ble bare testet INDIREKTE (via UI-et og via at
`publishRequest`/`rejectRequest`/`requestChanges` fungerer), aldri en test
som kaller `listModerationQueue()` selv og sjekker landfiltrering/innhold
direkte. Rettet med samme mønster som `listActiveRequests()` sine
tester fra forrige økt (samme `makeSession()`-hjelper, samme
`createActiveJournalistWithProfile()` for å tilfredsstille
`innerJoin(journalistProfiles, ...)`): 5 nye tester — moderator ser en
innsendt forespørsel for EGET land, ser den ALDRI for et annet lands,
administrator ser uansett land, en allerede BEHANDLET forespørsel
(f.eks. publisert) vises ALDRI her, og — en test utover
`listActiveRequests()`-mønsteret, siden `listModerationQueue()` har en
tidlig-retur-vei `listActiveRequests()` ikke har på samme måte — en
moderator UTEN noe tildelt land ser en TOM liste, ikke alle land
(bekrefter at "tomt utvalg" ikke feiltolkes som "alle land", se
`getAssignedCountryCodes()`sin egen kommentar om nettopp denne
distinksjonen).

**Empirisk verifisering**: fjernet midlertidig landfiltreringen fra
`listModerationQueue()` (kommenterte ut
`conditions.push(inArray(requests.countryCode, assigned))`) → bekreftet
at NØYAKTIG 1 av de 20 testene i filen feiler (testen som beviser at en
moderator i et ANNET land IKKE ser forespørselen — akkurat den testen
som skal fange denne klassen feil; den tomme-listen-testen for en
moderator UTEN tildelt land fortsatte å bestå urørt, siden den tidlige
returen `if (assigned !== "all" && assigned.length === 0) return [];`
er en HELT separat sjekk fra selve WHERE-betingelsen jeg fjernet) →
gjenopprettet fra sikkerhetskopi, alle 20 tester består igjen.

### Dokumenterte nameKey/senderNameKey-begrensningen som en eksplisitt del av "å åpne et nytt land"

`SPEC-V1.md` 3.3 sin egen liste over hva som kreves for å åpne et nytt
land ("konfigurasjonsrad, juridisk gjennomgåtte vilkår ..., komplette
oversettelser, og minst én moderator") nevnte aldri eksplisitt at
`name_key`/`sender_name_key` SELV er oversettelsesnøkler, ikke
visningsstrenger — og at FR-012s byggetidshåndhevelse dermed gjør det
umulig å opprette et GENUINT nytt land fullt selvbetjent fra
administrasjonsgrensesnittet alene, uten en egen kodeendring fra en
utvikler først. Dette var allerede riktig implementert (se forrige
økts `admin/countries`-arbeid) og allerede forklart i selve UI-ets
hjelpetekst, men aldri skrevet ned i spec-ens egen "hva kreves"-liste —
et hull mellom spec og faktisk (korrekt) atferd, ikke en kodefeil. Rettet
spec-en først (`SPEC-V1.md` 3.3, ett nytt avsnitt), speilet med én ny
setning i `README.md` sin eksisterende i18n-arkitekturprinsipp-kulepunkt
(ingen kodeendring, ingen ny test — ren dokumentasjon av en allerede
korrekt og allerede testet begrensning).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**439 tester**, uendret — ingen nye komponent-/enhetstester denne
runden), `i18n:check` (**507 nøkler**, uendret), `test:integration` mot
ekte lokal Postgres, to påfølgende ganger (**304 tester** hver gang, +5
fra `listModerationQueue()`). `design:check-tokens` og `next build` ikke
kjørt på nytt etter dokumentasjonsendringene — ingen kode-, CSS- eller
byggpåvirkende filer ble rørt i den delen av økten, bare to
Markdown-filer og én testfil (som selv ble grundig verifisert over).

### Neste økt

Ingen kjent gjenstående punkt fra forrige økts "Neste økt"-liste. Ingen
nye, konkrete mangler oppdaget denne runden utover det som allerede er
rettet.

Mulige neste steg (ingen er hastesaker, ingen kjente feil driver dem):
- Et bredere blikk på om NOEN av de andre `list*()`-funksjonene i
  `src/lib/moderation/` og `src/lib/admin/` har samme
  "bare-indirekte-testet"-mønster som `listModerationQueue()` og
  `listActiveRequests()` hadde — ingen konkret mistanke ennå, bare et
  mønster verdt å sjekke systematisk.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt (fortsettelse): fullførte det systematiske søket etter "bare-indirekte-testet"-mønsteret — fant og rettet ett siste, reelt tilfelle

Gjennomførte forrige økts egen "Neste økt"-oppgave: grep'et alle
`export async function list*`/`search*` i `src/lib` (ikke bare
`moderation/`/`admin/`, men systemet under ett), og sjekket hver mot sin
egen testfil.

**Resultat**: `listJournalists()`, `listAllCountries()`,
`listLegalDocumentsForCountry()`, `searchUsersByEmail()`, `listDigests()`,
`listResponsesForRequest()`, `listMineResponses()` og
`listActiveCountries()` hadde alle allerede direkte tester fra tidligere
økter. ÉN reell gjenstående mangel: `listMineRequests()` i
`src/lib/requests/requests.ts` — brukt av BÅDE
`GET /api/requests/mine` og journalistens egen "mine
forespørsler"-side (`journalist/requests/page.tsx`), men aldri testet
direkte. Den eneste eksisterende referansen i en testfil
(`status-badge.test.ts`) tester en helt annen ting (statusmerket
selv) og bare NEVNER `listMineRequests()` sin forutsetning i en
kommentar, uten å faktisk kalle funksjonen.

**Fiks**: 4 nye integrasjonstester i `requests.integration.test.ts`
(egne forespørsler vises, en ANNEN journalists forespørsler vises ALDRI,
`deleted`-status ekskluderes, alle andre statuser som `submitted`/
`published` inkluderes).

**Empirisk verifisering**: fjernet midlertidig `ne(requests.status,
"deleted")`-betingelsen fra `listMineRequests()` → bekreftet at
NØYAKTIG 1 av de 13 testene i filen feiler (testen som beviser at
`deleted` ekskluderes — akkurat den testen som skal fange denne
klassen feil) → gjenopprettet fra sikkerhetskopi, alle 13 tester
består igjen.

Med dette er det systematiske søket ferdig: ALLE `list*()`/`search*()`-
funksjoner i `src/lib` har nå direkte integrasjonstester, ikke bare
indirekte dekning via UI-et eller via andre funksjoners egne tester.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**439 tester**, uendret), `i18n:check` (**507 nøkler**, uendret),
`design:check-tokens` (OK, **53 komponent-CSS-filer**, uendret),
`next build` (grønn), `test:integration` mot ekte lokal Postgres, to
påfølgende ganger (**308 tester** hver gang, +4 fra
`listMineRequests()`).

### Neste økt

Ingen kjent gjenstående punkt fra forrige økts "Neste økt"-liste — det
systematiske `list*()`/`search*()`-søket er fullført uten flere funn.

Ingen nye, konkrete mangler oppdaget denne runden utover det som
allerede er rettet.

Påminnelse til NESTE økt (bekreftet i DENNE runden, for å spare den
runden et bomtokt): den stående cron-promptens punkt (2) og (3) —
mottakerlogikk i digest-tick og retention-jobben — er BEGGE allerede
fullt implementert og testet (`runDigestTick()`/`runRetention()` i
`src/lib/jobs/tick.ts`/`retention.ts`, med egne unit- OG
integrasjonstestfiler). Den opprinnelige promptens punktliste gjenspeiler
ikke lenger reell status — se README.md/NATTLOGG.md sin egen,
gjentatte påminnelse om at NATTLOGG.md sin "Neste økt" er sannheten for
hva som gjenstår, ikke selve cron-teksten.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 11 (fortsettelse): faktisk verifiserte Brevo-webhook-antagelsen mot ekte dokumentasjon — fant og rettet én reell bug

Ingen nye punkter sto igjen i forrige økts "Neste økt", så gikk på jakt
etter selvflagget usikkerhet i kodebasen: grep'et etter `TODO`/`FIXME` i
`src/`. Fant to. `retention.ts` sin TODO (hardkodede
retensjonsperioder i stedet for per-land-konfigurasjon) er bevisst utsatt
til et land nummer to faktisk finnes (ingen reell variasjon å konfigurere
ennå) — urørt. Den andre, i
`src/app/api/webhooks/email-events/route.ts`, sa at Brevo sitt eksakte
feltnavn-/verdiformat for webhook-nyttelasten ALDRI var bekreftet mot
ekte dokumentasjon, "ingen API-nøkkel/nettverkstilgang til Brevo
tilgjengelig" — men denne økten HAR faktisk utgående nettverkstilgang via
miljøets proxy. `developers.brevo.com` selv avviste `WebFetch` med 403
(sannsynligvis bot-beskyttelse), men `WebSearch` mot flere uavhengige
kilder (tredjeparts integrasjonsguider, en reell GitHub-saksrapport fra
Symfony sin mailer-komponent) ga samstemte, verifiserbare svar.

**Bekreftet**: feltnavnene `email`, `event` og `message-id` (med
bindestrek) stemmer nøyaktig med koden sin antagelse.
Hendelsestype-verdiene er camelCase (`hardBounce`, `softBounce`), ikke
snake_case — men `normalizeEvent()` sin egen normalisering (lowercase +
fjern ikke-bokstaver) dekker allerede begge formene, så dette utgjorde
ingen praktisk forskjell. `message-id` kan mangle på enkelte
hendelsestyper (bekreftet via Symfony-saksrapporten) — allerede håndtert
riktig som valgfritt felt.

**Én reell bug avdekket**: Brevos faktiske verdi for en permanent ugyldig
adresse er `invalid`, IKKE `invalid_email` som `normalizeEvent()` sin
switch-setning sjekket mot. `invalid_email`-grenen traff derfor ALDRI —
en slik hendelse falt gjennom til `default: return null`, og webhook-en
gjorde stille ingenting i stedet for å sette adressen til `bounced` og
sperre den, slik SPEC-V1.md 10.3 krever for en permanent leveringsfeil
("Hard bounce: adressen settes til bounced og får ingen flere
utsendelser" — en permanent ugyldig adresse er semantisk det samme
utfallet). **Rettet**: lagt til `case "invalid":` i samme gren som
`hard_bounce` (beholdt `invalid_email` også, ufarlig i tillegg). Oppdatert
kommentarene i `route.ts` til å reflektere det som nå faktisk er
bekreftet, i stedet for å fortsatt hevde det er ukjent.

**Testdekning**: 1 ny integrasjonstest som sender `event: "invalid"` og
bekrefter at abonnementet settes til `bounced` — akkurat den ekte
Brevo-verdien, ikke den oppspikrede (og feilaktige) `invalid_email`.

**Empirisk verifisering**: fjernet midlertidig `case "invalid":` (beholdt
`invalid_email`) → bekreftet at NØYAKTIG den nye testen feiler
(`expected 'active' to be 'bounced'`) → gjenopprettet fra sikkerhetskopi,
alle 13 tester i filen består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**439 tester**, uendret), `i18n:check` (**507 nøkler**, uendret),
`design:check-tokens` (OK, **53 komponent-CSS-filer**, uendret),
`next build` (grønn), `test:integration` mot ekte lokal Postgres, to
påfølgende ganger (**309 tester** hver gang, +1).

### Neste økt

`src/lib/email/send.ts` sin egen antagelse om Brevo sitt SVARFORMAT ved
faktisk utsending (`messageId`, camelCase, uten bindestrek — et ANNET
felt enn webhook-ens `message-id`) ble IKKE eksplisitt verifisert denne
runden, bare webhook-siden. Kan være verdt et tilsvarende
`WebSearch`-sjekk i en fremtidig økt, samme metode som her (developers.
brevo.com selv 403'er `WebFetch`, men uavhengige kilder via `WebSearch`
ga gode nok svar denne gangen).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 12: fullførte forrige økts eget gjenstående punkt — verifiserte send.ts sin Brevo-antagelse også, ingen bug denne gangen

Samme metode som forrige økt (webhook-siden): `WebSearch` mot uavhengige
kilder, siden `developers.brevo.com` selv avviser `WebFetch` med 403.
Denne gangen gjaldt det `src/lib/email/send.ts` sin antagelse om selve
UTSENDINGEN (`POST v3/smtp/email`), ikke mottak av webhook-hendelser.

**Bekreftet, INGEN avvik funnet**: endepunktet
(`https://api.brevo.com/v3/smtp/email`), autentiseringsheaderen
(`api-key`), request-feltnavnene (`sender`, `to`, `subject`,
`htmlContent`, `textContent`, `headers`) og responsfeltet (`messageId`)
stemmer alle nøyaktig med koden sin eksisterende antagelse. Også
`List-Unsubscribe`/`List-Unsubscribe-Post`s eksakte verdiform (FR-038)
ble bekreftet ord for ord mot et reelt dokumentert eksempel — inkludert
`"List-Unsubscribe-Post": "List-Unsubscribe=One-Click"`, identisk med
det koden allerede sender.

Siden `sendBulkEmail()` bruker DET SAMME `v3/smtp/email`-endepunktet som
`sendTransactionalEmail()` (bevisst, ikke Brevos separate batch-/
kampanje-API — se filens egen kommentar), var det ingen egen
batch-endepunkt-antagelse å verifisere i tillegg.

**Ingen kodeendring** — bare oppdaterte de to kommentarene i
`send.ts` som tidligere sa "IKKE verifisert mot en ekte konto denne
økten" til å reflektere det som nå faktisk er bekreftet, samme mønster
som `route.ts`s kommentaroppdatering forrige økt. Ingen nye tester
nødvendig (eksisterende `send.test.ts` sin mockede `messageId`-
uttrekkstest dekket allerede selve logikken, den var aldri i tvil — det
var BARE det ekte feltnavnet/formatet som var uverifisert, og det er nå
bekreftet riktig, ikke endret).

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**439 tester**, uendret, inkludert `send.test.ts` sine 26 tester
urørt), `i18n:check` (**507 nøkler**, uendret), `design:check-tokens`
(OK, **53 komponent-CSS-filer**, uendret), `next build` (grønn). Ingen
kodelogikk endret, så ingen empirisk knekk/gjenopprett-runde denne
gangen — bare kommentarer. `test:integration` ikke kjørt på nytt (ingen
databasepåvirkende endring).

### Neste økt

Begge de to lenge selvflaggede "ikke bekreftet mot ekte Brevo-
dokumentasjon"-forbeholdene i kodebasen (webhook-mottak forrige økt,
utsending denne økten) er nå verifisert. Ingen kjent gjenstående
selvflagget usikkerhet av denne typen.

Ingen nye, konkrete mangler oppdaget denne runden. Neste økt kan med
fordel gjøre et friskt, bredt søk etter neste kategori arbeid — for
eksempel en ny gjennomgang av SPEC-V1.md seksjon 21 (ikke-funksjonelle
krav: ytelse, tilgjengelighet, i18n, analyse) mot faktisk kode, siden
denne seksjonen ikke har vært gjenstand for et eget, dedikert
gjennomgangsøkt tidligere (i motsetning til seksjon 19/20/22/23 som alle
har vært grundig diffet mot koden i tidligere økter).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 13: første dedikerte gjennomgang av SPEC-V1.md seksjon 21 (ikke-funksjonelle krav) — fant og rettet to reelle gap

Fulgte forrige økts eget forslag: seksjon 21 (ytelse, tilgjengelighet,
i18n, øvrig, analyse) hadde aldri fått sin egen gjennomgangsøkt, i
motsetning til 19/20/22/23. Gikk gjennom alle fem underseksjoner
systematisk.

**21.5 (Analyse)**: bekreftet at forbudet ("ingen åpningssporing, ingen
tredjepartssporing... `DigestDelivery` har verken `opened_at` eller
`clicked_at`") er korrekt håndhevet — ingen slike kolonner finnes i
schema.ts, ingen tredjeparts analytics-bibliotek noe sted i `src/`.
Selve rapporterings-UI-et for de 8 listede aggregerte målene er IKKE
bygget, men dette er verken et akseptansekriterium for lansering
(seksjon 23) eller listet i "Kuttet fra v1" (seksjon 25) — vurdert som
et fremtidig, ikke-hastende byggebehov, ikke en bug å rette
autonomt uten et klarere signal om at det trengs nå.

**21.1 (Ytelse)**: arkitektonisk allerede riktig (digest-jobben kjører
via en planlagt Netlify-funksjon, atskilt fra webtrafikk per
konstruksjon) — selve gjennomstrømningstallet (10 000 mottakere på 30
minutter) er en ekte lasttest-påstand som ikke lar seg verifisere i
dette miljøet uten en ekte Brevo-konto og reell trafikk; ikke noe å
"rette" i kode uten å finne opp et falskt benchmark.

**21.2 (Tilgjengelighet) — reelt funn**: `src/app/global-error.tsx`
(Next.js sin reserveside for feil i selve root-laget, over
`[locale]`-segmentet) manglet HELT `lang`-attributt på sitt `<html>`.
Bevisst unntatt fra i18n-systemet fra før (ingen locale å slå opp der
roten selv har krasjet — riktig unntak), MEN aldri gitt noen
FALLBACK-verdi i det hele tatt. Siden Next sin egen innebygde
`<NextError>`-komponent alltid rendrer engelsk tekst uansett locale,
er riktig verdi `lang="en"` (ikke plattformens `nb-NO` — det ville vært
like galt den andre veien, med norsk uttale av engelsk tekst). Rettet.
1 ny test (`document.documentElement` sin `lang`-attributt — bekreftet
at attributter faktisk settes på jsdom sitt EKTE rotdokument, ikke et
nøstet element, til tross for en kjent, akseptert
"html kan ikke være barn av en div"-advarsel testing-library gir).
Empirisk verifisert: fjernet `lang="en"` midlertidig → bekreftet at
nøyaktig den nye testen feiler → gjenopprettet, begge tester består.

**21.3 (Internasjonalisering) — reelt funn, mer alvorlig**:
21.3s eget akseptansekriterium ("ett fullstendig oversatt tilleggsspråk
skal finnes i test") holdt IKKE — en Python-diff av nøklene i
`nb-NO.json` mot `en-GB.json` avdekket at `en-GB` manglet TO nøkler
(`me.confirm_deletion.warning`, `.confirm_button` — introdusert av en
tidligere økts konto-slette-bekreftelsesknapp, økt 58, men aldri lagt
til i en-GB). `i18n:check` fanger IKKE denne klassen feil i det hele
tatt — scriptet sjekker bare at nøkler BRUKT I KODEN finnes i
STANDARDSPRÅKET (nb-NO), aldri om et ANNET aktivt språk har full
dekning. Konsekvensen er reell, ikke bare teoretisk: en ekte en-GB-bruker
som prøver å slette kontoen sin ville sett NORSK tekst midt i en ellers
engelsk side (3.4s fallback-kjede), uten noen advarsel noe sted i
verktøykjeden.

**Rettet i to lag**:
1. La til de to manglende nøklene i `en-GB.json` (full paritet
   bekreftet: 0 manglende, 0 ekstra nøkler mot nb-NO).
2. Bygget selve VERKTØYET som skulle fanget dette: ny
   `findLocaleGaps()`-funksjon i `check-keys.ts` som sammenligner et
   HVILKET SOM HELST aktivt språk (fra `SUPPORTED_LOCALES`) mot
   standardspråket og skriver en ADVARSEL (ikke feil — akkurat slik
   21.3 selv sier: "manglende oversettelse i andre språk gir advarsel
   og fallback", til forskjell fra FR-012s bygg-feilende sjekk mot
   nøkler brukt i koden). 2 nye enhetstester. Empirisk verifisert: fjernet
   én nøkkel fra `en-GB.json` midlertidig, bekreftet at
   `npx tsx src/i18n/check-keys.ts` skriver en tydelig advarsel MEN
   avslutter med kode 0 (feiler ikke bygget) → gjenopprettet, ingen
   advarsel igjen.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**442 tester**, +3), `i18n:check` (**507 nøkler**, uendret — selve
nøkkeltallet endret seg ikke, bare parkobling mellom språkene ble
rettet), `design:check-tokens` (OK, **53 komponent-CSS-filer**,
uendret), `next build` (grønn), `test:integration` mot ekte lokal
Postgres (**309 tester**, uendret — ingen databasepåvirkende endring
denne runden).

### Neste økt

Seksjon 21 er nå gjennomgått i sin helhet. To reelle funn rettet
(global-error.tsx sin manglende lang, en-GB sitt reelle
oversettelsesgap). Ett bevisst IKKE bygget: 21.5s rapporterings-UI for
aggregerte mål (ikke et lanseringskriterium, ikke hastende).

Mulig neste steg: nå som `findLocaleGaps()`-advarselen finnes, kan det
være verdt å faktisk KJØRE `i18n:check` som en del av CI-loggen
(allerede kjørt i `.github/workflows/ci.yml` per README.md) og
dobbeltsjekke at en fremtidig advarsel faktisk blir SETT av noen — en
advarsel som aldri leses er ikke mye bedre enn ingen advarsel. Ingen
kjent handling nødvendig nå, bare noe å huske på.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 14: DESIGN.md 9-gjennomgang — fant et hull i den kuraterte kontrastlisten selv

Fulgte opp forrige økts eget "husk å sjekke"-notat (CI-varselet er
bekreftet synlig — `i18n:check` kjører som et normalt CI-steg, og
`console.warn` går til stderr, som GitHub Actions viser i loggen uten å
feile jobben, siden exit-koden fortsatt er 0. Ingen kodeendring
nødvendig der). Gikk deretter videre til DESIGN.md sitt eget
"9. Akseptansekriterier"-avsnitt, som — i likhet med SPEC-V1.md seksjon
21 forrige økt — aldri hadde fått en egen, dedikert gjennomgang.

Kriterium 8 ("ingen forespørsel til en ekstern vert ved sidelast"):
bekreftet — ingen eksterne CDN-er, fonter, script-tagger eller
analytics-biblioteker noe sted i `src/`.

Kriterium 3 ("kontrasttesten dekker ALLE brukte tokenpar i lyst og
mørkt tema") viste seg IKKE å holde helt: `contrast-pairs.ts` sin egen
kommentar sier eksplisitt at `TOKEN_PAIRS`-listen er "manuelt kuratert,
ikke automatisk ekstrahert" — en systematisk kryssjekk (grep etter
`color`/`background`-egenskaper mot alle 53 komponent-CSS-filene, mot
hvert semantiske tokennavn faktisk brukt i `TOKEN_PAIRS`) avdekket at
`--color-surface-hover` (brukt i BÅDE `Button.module.css` sin
sekundær-/spøkelsesknapp-hover OG `Select.module.css` sitt
fokusert/hovret alternativ — begge steder beholder `color: var(
--color-text)` fra grunnregelen) ALDRI hadde vært med i listen. Et
reelt, ikke bare teoretisk hull: nettopp den typen glemt oppdatering
filens egen kommentar advarer mot ("Oppdater denne listen når et nytt
fargepar tas i bruk").

**Rettet**: lagt til paret (`color-text` / `color-surface-hover`,
kategori "text", 4.5:1-krav) i `TOKEN_PAIRS`. Kjørte testen —
BESTÅR i begge temaer (ratio god margin over kravet), altså ikke en
faktisk WCAG-brist, bare et udekket testtilfelle inntil nå.

**Empirisk verifisering**: satte `--color-surface-hover` i lyst tema
midlertidig lik `--color-text` sin primitiv (`--gray-900`) — garantert
1:1-forhold → bekreftet at NØYAKTIG denne nye testen feiler (`expected
1 to be greater than or equal to 4.5`), og ingen av de 38 andre → gjenopprettet
fra sikkerhetskopi, alle 39 tester består.

### Verifisert før commit (denne runden)

`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**444 tester**, +2 — det nye paret i begge temaer), `i18n:check`
(**507 nøkler**, uendret), `design:check-tokens` (OK, **53
komponent-CSS-filer**, uendret), `next build` (grønn),
`test:integration` mot ekte lokal Postgres (**309 tester**, uendret —
ingen databasepåvirkende endring).

### Neste økt

DESIGN.md 9 er nå gjennomgått i sin helhet. Kriterium 1 (fullstendig
temabytte uten å røre komponentkode) og 6 (samme testtema slår gjennom
i e-postmaler) er strukturelt sikret av selve tre-lags-arkitekturen
(1. Tre lag) og av at e-postmalene bruker de samme fargefunksjonene
(`src/lib/email/colors.ts`, allerede testet), men INGEN av dem er
faktisk blitt PRØVD (et reelt testtema er aldri konstruert og kjørt
gjennom hele kjeden). Kriterium 4/5 (tastatur/skjermleser/360px uten
horisontal scroll) krever reell nettleserverifisering — samme klasse
begrensning som all annen UI-verifisering i dette miljøet (se tidligere
økters `next build && next start`-oppdagelse for `next dev`s CSP/eval-
problem). Ingen av disse er hastesaker eller kjente brudd, bare
ubekreftede påstander — verdt å huske på, ikke noe å bygge nå uten et
klarere signal.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 15: gjennomførte et EKTE testtema-bytte (DESIGN.md 9, kriterium 1) — beviste kriteriet for komponenter, avdekket en reell begrensning for e-post

Fulgte opp forrige økts eget forslag: kriterium 1 ("et fullstendig
temabytte... verifiseres ved å FAKTISK gjennomføre et bytte til et
bevisst avvikende testtema før lansering") hadde ALDRI vært faktisk
utført — bare strukturelt antatt via `check-tokens.ts` sin statiske
lint-sjekk. Gjennomførte selve øvelsen, midlertidig og reversert etterpå
(ikke en permanent endring).

**Testtemaet**: byttet KUN `tokens/primitives.css` (nøytralskalaen fra
kjølig blågrå, hue 250, til varm sepia, hue 40; aksenten fra dempet blå,
hue 230, til dempet magenta, hue 300 — samme lyshet-/metningsprogresjon,
bare ny fargetone) og `tokens/typography.css` (fontparet til "Space
Grotesk"/"Lora" i stedet for "Inter var"/"Source Serif 4"). Rørte
BEVISST ingen komponentfil og ingen `semantic.css` (ingen nye roller
trengtes).

**Resultat, komponentsiden — kriteriet BESTÅTT**:
- `git status` bekreftet at NØYAKTIG de to token-filene var endret, null
  komponentfiler.
- `design:check-tokens` fortsatt OK (53 filer, ingen rå verdier).
- `contrast-pairs.test.ts` sine 39 tester — som beregner kontrastforhold
  LIVE fra de faktiske CSS-verdiene, ikke hardkodede tall — besto ALLE
  mot det HELT NYE fargeparet, i begge temaer, uten at én eneste
  testverdi måtte justeres. Dette er den sterkeste formen for bevis
  akseptansekriteriet selv ber om.
- `tsc --noEmit`, `eslint .`, `next build` — alle grønne mot testtemaet.
- Ekte visuell verifisering (Playwright, produksjonsmodus per tidligere
  økters etablerte `next build && next start`-mønster, se NATTLOGG
  tidligere): skjermbilder av innloggingssiden i BÅDE lyst og mørkt tema
  viste tydelig den varme sepiabakgrunnen, magenta-knappen og
  serif-overskriften — reskinnet slo faktisk gjennom visuelt, ikke bare
  i teorien.

**Resultat, e-postsiden — en reell, ikke tidligere bekreftet begrensning
avdekket**: `src/lib/email/colors.ts` sine `EMAIL_COLORS`/
`EMAIL_COLORS_DARK`-konstanter er HARDKODEDE hex-verdier (fordi
e-postklienter ikke støtter CSS-variabler, DESIGN.md 7) — filens egen,
allerede eksisterende kommentar sier eksplisitt at dette er en bevisst,
midlertidig forenkling i påvente av en full byggetids-eksportpipeline
(`tokens/primitives.css → tokens.json`) som IKKE er bygget ennå (samme
forenkling som `digest.ts` gjorde tidligere, se økt 7). `colors.test.ts`
sjekker at disse hex-verdiene stemmer med de FAKTISKE primitivene — og
under testtemaet feilet nøyaktig disse 14 testene, siden hex-verdiene
naturligvis IKKE fulgte med det nye fargeparet automatisk.

Dette betyr at DESIGN.md 9 sitt kriterium 6 ("testtemaet... slår også
gjennom i alle e-postmaler UTEN at noen mal er redigert") IKKE holder
fullt ut i dag — et ekte temabytte ville krevd en manuell oppdatering av
`colors.ts` sine hex-konstanter i tillegg til de tre offisielle
temafilene. Dette var TIDLIGERE bare en antatt risiko (nevnt i forbifarten
i en tidligere økts NATTLOGG-notat); denne øvelsen er FØRSTE gang det er
faktisk BEKREFTET empirisk. Ikke en ny kodefeil — allerede
selvdokumentert og allerede fanget av en egen test (`colors.test.ts`
gjorde nøyaktig det den skal: den fanget avviket) — men et konkret,
bekreftet hull mellom kriterium 6 sin tekst og faktisk atferd, verdt å
huske eksplisitt.

**Reversert**: begge token-filene gjenopprettet fra sikkerhetskopi.
Bekreftet: `git status`/`git diff` viser INGEN endringer mot siste
commit, `colors.test.ts` (16 tester) og `contrast-pairs.test.ts` (39
tester) begge grønne igjen, full `vitest run` (**444 tester**), `tsc`,
`eslint` alle grønne på nytt.

### Verifisert før commit (denne runden)

Ingen produksjonskodeendring ble committet (selve øvelsen var
midlertidig og fullstendig reversert) — bare denne NATTLOGG-oppføringen.
`tsc --noEmit` (ren), `eslint .` (0 feil/advarsler), `vitest run`
(**444 tester**, uendret fra forrige commit), `i18n:check` og
`design:check-tokens` uendret, `next build` grønn (kjørt både under og
etter reverseringen).

### Neste økt

DESIGN.md 9 sitt kriterium 1 er nå FAKTISK bevist for komponentsiden
(ikke bare antatt). Kriterium 6 (e-postmaler) er bevist å IKKE holde
fullt ut ennå, av en allerede kjent og akseptert grunn (byggetids-
eksportpipelinen for tokens er bevisst utsatt). Ingen hastende handling
— bygging av den fulle pipelinen er en større, egen oppgave som bør
gjøres når den faktisk trengs (f.eks. ved en reell rebranding), ikke
spekulativt nå.

Gjenstående, ikke hastende fra DESIGN.md 9: kriterium 4/5 (tastatur/
skjermleser/360px uten horisontal scroll) krever fortsatt reell
nettleserverifisering utover det denne økten dekket.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 16: bekreftet DESIGN.md 9, kriterium 5 — hele mottakerflyten på 360px bredde, ingen kodeendring

Fulgte opp forrige økts eget gjenstående punkt: kriterium 5 ("hele
mottakerflyten kan gjennomføres på en 360 px bred skjerm uten horisontal
scroll") hadde ALDRI vært faktisk prøvd i en ekte nettleser, bare antatt.
Gjennomførte selve sjekken, samme `next build && next start`-mønster som
tidligere økters browser-verifisering (unngår `next dev` sitt kjente
CSP/eval-hydreringsproblem).

**Metode**: Playwright, viewport 360×640, målte
`document.documentElement.scrollWidth` mot `window.innerWidth` (>0 betyr
horisontal overflow) på hvert steg i selve mottakerflyten (5.2):
1. Forsiden (`/nb-NO`)
2. Registreringssiden (`/nb-NO/subscribe`)
3. En ekte, midlertidig opprettet publisert forespørsel (offentlig
   forespørselsside, `/foresporsler/[id]/[slug]`) — brukte et allerede
   eksisterende aktivt testland (`XT`) fra den delte testdatabasen i
   stedet for å opprette et nytt.
4. Svarskjemaet selv (`/foresporsler/[id]/svar`), med en ekte,
   midlertidig innlogget mottaker-økt (rå token/hash-mønsteret fra
   tidligere økters admin-verifisering) — det er her selve
   skjemafeltene (begrunnelse, svar på spørsmål, kort presentasjon,
   visningsnavn, kontaktvalg) faktisk vises.

**Resultat**: `scrollWidth` var NØYAKTIG 360 (ingen overflow) på alle
fire sidene. Skjermbilder bekreftet visuelt at all tekst bryter
ordentlig, ingen elementer klipper eller stikker utenfor, og selve
svarskjemaet (tekstområder, radioknapper, tegn-tellere) er fullt
brukbart på denne bredden.

**Sidefunn (ikke en app-feil)**: et Playwright `.click()` på selve
"Svar"-lenken (en Next.js `<Link>`) navigerte ikke — URL-en forble
uendret etter klikket. Direkte navigering til lenkens `href` fungerte
derimot helt fint (200, riktig side). Vurdert som en Playwright/Next.js
klient-navigasjon-timing-kvirk i denne testoppsettet (samme klasse
"verktøykvirk, ikke produktbug" som forrige økters kjente checkbox-
klikk-kvirk), IKKE en reell navigasjonsfeil — omgått ved å navigere
direkte til href i stedet for å klikke.

**Opprydding**: alle midlertidig opprettede testrader (journalist,
journalistprofil, forespørsel, mottakerbruker, e-postabonnement, økt)
slettet direkte mot databasen etterpå — samme forsiktighet som tidligere
økters admin-verifisering, for å ikke etterlate engangstestdata i den
delte, langvarige databasen. Serveren stoppet.

### Verifisert før commit (denne runden)

Ingen produksjonskodeendring — bare denne NATTLOGG-oppføringen (`git
status` viser ingen diff verken før eller etter selve
browser-øvelsen). `tsc --noEmit` (ren), `eslint .` (0 feil/advarsler),
`vitest run` (**444 tester**, uendret).

### Neste økt

DESIGN.md 9 sitt kriterium 5 er nå faktisk bevist, ikke bare antatt.
Kriterium 4 (hele mottakerflyten med tastatur alene OG skjermleser)
gjenstår fortsatt — krever en annen type verifisering (tab-rekkefølge,
fokussynlighet, ARIA-roller/-navn) enn den rene bredde-/overflow-sjekken
denne økten dekket. Ikke en hastesak, ingen kjent feil driver den.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 17: bekreftet DESIGN.md 9, kriterium 4 — hele mottakerflyten med tastatur alene, pluss en automatisert axe-core-revisjon som proxy for skjermleser

Fulgte opp forrige økts siste gjenstående punkt fra DESIGN.md 9: kriterium
4 ("hele mottakerflyten kan gjennomføres med tastatur alene, OG med
skjermleser") hadde aldri vært faktisk prøvd, bare antatt via valget av
react-aria-components. Samme `next build && next start`-mønster som
forrige økt (unngår `next dev` sitt CSP/eval-hydreringsproblem).

**Skjermleser-siden (proxy)**: oppdaget at `axe-core` (v4.12.1, en reell,
mye brukt automatisert WCAG-revisjonsmotor) allerede lå tilgjengelig i
`node_modules` (en transitiv avhengighet, ikke i `package.json` direkte)
— injiserte den via Playwright og kjørte en full revisjon (WCAG 2.0 A/AA,
2.1 AA, 2.2 AA-regelsett) mot alle seks mottakervendte sidene: forsiden,
registreringssiden, journalistsøknadssiden, innloggingssiden, en ekte
publisert forespørselsside, og selve svarskjemaet (med en ekte innlogget
testøkt). **0 avvik på alle seks sidene.**

**Tastatur-siden**: gjennomførte BEGGE hovedskjemaene i mottakerflyten
fullstendig med tastatur ALENE (Tab, skriving, ArrowDown for
Select/RadioGroup, Enter/Space for aktivering — ALDRI musepekeren):
1. Registreringsskjemaet (`/subscribe`): e-post → visningsnavn →
   land-Select (åpne med Enter, velge med ArrowDown+Enter) →
   språk-Select (samme mønster) → tre samtykke-avkryssingsbokser (med to
   ekte, separat tabbare innebygde lenker i vilkår-teksten — korrekt
   atferd, ikke en feil) → send-knapp. Endte i den ekte
   bekreftelsesmeldingen: "Sjekk innboksen din — vi har sendt deg en
   lenke for å bekrefte e-postadressen." En ekte brukerrad ble opprettet
   i databasen.
2. Svarskjemaet (`/foresporsler/[id]/svar`): fire tekstfelt (relevans,
   svar, kort presentasjon, visningsnavn) → RadioGroup for
   kontaktdeling (pilnavigasjon) → "Gå videre til bekreftelse"-knappen →
   bekreftelsessteget ("Bekreft innsending") → "Bekreft og send"-knappen.
   Endte i den ekte suksessmeldingen: "Svaret ditt er sendt. Du får en
   kvittering på e-post." En ekte svar-rad ble opprettet i databasen,
   bekreftet med `SELECT`.

**Sidefunn (ikke en feil)**: et første forsøk på skriptet feilantok
tab-rekkefølgen (trodde samtykke-checkboxen for vilkår var rett før
alderscheckboxen) — de to innebygde lenkene i vilkårsteksten
("Vilkår", "Personvernerklæring") er selvsagt SEPARAT tabbare, akkurat
som en skjermleserbruker trenger. Rettet skriptet sitt eget
tab-tellemønster, ikke noe i appen.

**Opprydding**: alle midlertidig opprettede rader (journalist,
journalistprofil, forespørsel, mottakerbruker, e-postabonnement, økt,
samtykkelogg, autentiseringstoken, det ekte svaret, den ekte
registrerte brukeren fra tastatur-testen) slettet direkte mot
databasen i riktig avhengighetsrekkefølge (auth_tokens → sessions →
email_subscriptions → consent_records → responses → requests →
journalist_profiles → users) etter et par forsøk som traff
fremmednøkkelbrudd underveis — samme forsiktighet som tidligere økters
verifisering. Serveren stoppet.

### Verifisert før commit (denne runden)

Ingen produksjonskodeendring — bare denne NATTLOGG-oppføringen (`git
status` viser ingen diff). `tsc --noEmit` (ren), `eslint .` (0
feil/advarsler), `vitest run` (**444 tester**, uendret).

### Neste økt

DESIGN.md 9 er nå gjennomgått og bevist punkt for punkt, i sin helhet
(kriterium 1, 3, 5 og 4 alle faktisk utført denne og forrige økt;
kriterium 2 og 8 strukturelt håndhevet av `check-tokens.ts` fra før;
kriterium 6 sin ENE kjente begrensning — e-postfargene sin manuelle
synkronisering — allerede dokumentert forrige økt; kriterium 7, 40%
tekstutvidelse, ikke eksplisitt utført, men samme klasse
lav-risiko/strukturelt-sikret påstand som resten). Ingen kjent
gjenstående, ubekreftet DESIGN.md-kriterium av betydning.

Ingen nye, konkrete mangler oppdaget. Neste økt bør trolig gå tilbake
til å lete etter en helt ny kategori arbeid, siden både SPEC-V1.md
seksjon 21 og DESIGN.md seksjon 9 nå er grundig gjennomgått.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 18: kritisk gjennomlesing av registrerings-/profilmodulene — ingen nye funn, flere mistenkelige tilfeller avkreftet

Siden både SPEC-V1.md seksjon 21 og DESIGN.md seksjon 9 nå er grundig
gjennomgått (forrige to økter), gikk tilbake til den etablerte
"kritisk lesing"-metoden fra tidligere i natt (samme sjekkliste:
sjekk-så-skriv-mønstre, asymmetriske vakter, tause klientfeil,
klient-/server-grensedrift) mot moduler som ALDRI eksplisitt er nevnt i
en tidligere økts kritisk-lesing-runde: `src/lib/registration/
recipient.ts` og `journalist.ts`, `src/lib/me/change-country.ts`,
`src/lib/journalists/journalist-profile.ts`, og `src/lib/me/profile.ts`
(pluss ruten sin).

**Ingen nye bugs funnet** — men flere reelle, i utgangspunktet
mistenkelige observasjoner ble undersøkt grundig og AVKREFTET:

1. `registerRecipient()`/`applyAsJournalist()` skriver `users` →
   `emailSubscriptions`/`journalistProfiles` → `consentRecords` →
   `requestMagicLink()` som FIRE separate, ikke-transaksjonelle kall.
   Så umiddelbart mistenkelig ut: hva om `requestMagicLink()` feiler
   (Brevo nede) ETTER at brukerraden alt er committet? Undersøkt grundig:
   `requestMagicLink()` er selv HELT frikoblet fra registreringshistorikk
   — den sjekker bare at kontoen finnes og ikke er suspendert/slettet,
   uavhengig av `emailVerifiedAt`. En bruker "sittende fast" etter en
   feilet e-postsending kan derfor ALLTID be om en ny lenke via den
   ordinære innloggingssiden (`POST /auth/request-link`), som fyrer
   AKKURAT samme "confirm_email"/"journalist_application_received"-mal
   på nytt. Ingen permanent låsing — bare et par utestede kroker der noen
   morgendag med god grunn kunne teste at nettopp DETTE gjenopprettings-
   sporet fungerer.
2. `updateMyProfile()` (`me/profile.ts`) sjekker ALDRI
   `displayName.length` mot noen øvre grense — bare at feltet ikke er
   tomt. Så ut som en reell regresjon av SAMME bug som ble rettet
   tidligere i natt (task #57/#59, 200 vs. 80). Undersøkt: håndhevelsen
   ligger korrekt ETT NIVÅ HØYERE, i selve API-ruten (`PATCH /me` sin
   `patchSchema = z.object({ displayName: z.string().max(80)... })`) —
   med en kommentar som EKSPLISITT refererer til den tidligere fiksen.
   Kryssjekket `POST /subscribe` sin rute også (`z.string().max(80)`,
   samme grense). Ingen drift.
3. `ResponseForm.tsx` sin egen `LIMITS`-konstant (2000/4000/500/80)
   dupliserer tallene fra `RESPONSE_FIELD_LIMITS`
   (`src/lib/responses/validate.ts`) i stedet for å importere dem —
   samme klasse latent risiko som forårsaket den tidligere
   displayName-bugen (to separate steder som MÅ holdes synkronisert
   manuelt). Verdiene stemmer i dag (ingen aktiv bug), men er en
   fremtidig driftrisiko. `RequestEditForm.tsx` sin tilsvarende `LIMITS`
   stemmer også nøyaktig med `FIELD_LIMITS` fra `requests/validate.ts`.
   Bekreftet at `submitResponse()` faktisk kaller
   `validateResponseSubmission()` (ingen bypass-rute funnet).

**Vurdering**: ingen av disse tre er en AKTIV bug akkurat nå — alle tre
er enten allerede korrekt håndtert (1, 2) eller en ren fremtidig
driftrisiko uten noe konkret å rette i dag (3, siden en refaktorering
til import fra det delte modulet er en smakssak/forsiktig opprydding,
ikke en feilretting, og ville økt endringsflaten uten en reell feil å
vise til). Ingen kodeendring denne runden.

`change-country.ts` og `journalist-profile.ts` er også lest grundig —
begge korrekte, ingen sjekk-så-skriv-hull funnet (begge er
enkeltbruker-nøkkelert, ingen tverrbruker-kappløp mulig).

### Verifisert før commit (denne runden)

Ingen kodeendring — `git status` viser ingen diff. Ren gjennomlesing,
nevnt eksplisitt i NATTLOGG likevel (samme begrunnelse som økt 7s
tilsvarende "lest kritisk, ingenting å rette"-oppføring).

### Neste økt

Følgende moduler er IKKE eksplisitt kritisk lest ennå med denne nattens
sjekkliste: `src/lib/subscriptions/` (unsubscribe.ts, email-events.ts —
delvis dekket via webhook-ruta tidligere, men ikke selve
bibliotekfunksjonene i isolasjon), `src/lib/reports/reports.ts`,
`src/lib/security/rate-limit.ts`, `src/lib/countries/countries.ts`. Kan
være verdt en rask sveip i en fremtidig økt, men ingen konkret mistanke
driver det.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 19: fant og rettet et reelt tapt-oppdatering-kappløp i `processEmailEvent()`s soft_bounce-håndtering (10.3, FR-037)

Fulgte forrige økts egen "Neste økt"-pekepinn: kritisk lesing av
`src/lib/subscriptions/` sine BIBLIOTEKFUNKSJONER i isolasjon (ikke bare
webhook-ruta, som alt var dekket).

`unsubscribe.ts` er korrekt — idempotent avmelding-via-token med et
harmløst kappløpsvindu (to samtidige klikk på samme lenke er begge trygge,
takket være en idempotent UPDATE og `onConflictDoNothing()` på selve
sperrelisteinnsettingen). Ingen bug.

`email-events.ts` sin `soft_bounce`-håndtering hadde derimot et REELT,
udokumentert tapt-oppdatering-kappløp: koden leste
`subscription.consecutiveSoftBounces` fra et tidligere SELECT, regnet ut
`+ 1` i JavaScript, og skrev tilbake — et klassisk les-så-skriv-mønster.
To nesten samtidige `soft_bounce`-hendelser for SAMME abonnement (Brevo
sin egen retry-semantikk ved en treg webhook-respons, eller to reelle
bounces tett i tid) kunne begge lese samme utgangsverdi og begge skrive
tilbake samme sum — én økning tapt, uten at noen telling faktisk beviser
at streaken er brutt. Konsekvensen er ikke tap av data, men en FORSINKET
eskalering til hard bounce (10.3, ordrett: "Tre myke bounces på rad
behandles som hard bounce") — adressen fortsetter å motta digest-forsøk
lenger enn spec-en tilsier.

**Fiks**: flyttet `+ 1`-regningen inn i selve SQL-setningen via Drizzle
sin `sql`-mal (`sql\`${emailSubscriptions.consecutiveSoftBounces} + 1\``),
kombinert med `.returning()` for å hente den faktiske, atomisk oppdaterte
verdien fra Postgres — eskaleringsbeslutningen tas nå mot DENNE verdien,
aldri mot en potensielt utdatert JS-side verdi. Dette er samme generelle
mønster som de tidligere TOCTOU-fiksene i natt (task #48–#51), første
gang selve `sql`-malen brukes i akkurat dette mønsteret i kodebasen (ingen
tidligere presedens funnet via grep, men teknikken er standard Drizzle-
bruk).

**Dødkode fjernet som en konsekvens**: `shouldEscalateToHardBounce()`
(`bounce-policy.ts`) tok imot "telleren FØR denne hendelsen" og regnet ut
beslutningen selv — overflødig når sammenligningen nå skjer direkte i
`email-events.ts` mot den allerede oppdaterte databaseverdien. Bekreftet
via grep at funksjonen ikke hadde noen gjenværende kallere utenom sin
egen fil og sin egen dedikerte testfil. Per den stående regelen ("er du
sikker på at noe er ubrukt, kan du slette det helt") ble funksjonen
fjernet fullstendig, og `bounce-policy.test.ts` (3 tester, alle mot nå
fjernet funksjon) slettet i sin helhet — den underliggende
forretningsregelen (tre-på-rad-eskalering) er fortsatt dekket, og
arguably BEDRE dekket, av de eksisterende integrasjonstestene mot ekte
Postgres i `email-events.integration.test.ts`.

**Ny test**: la til "to SAMTIDIGE myke bounces mister ikke en økning" i
`email-events.integration.test.ts`, som fyrer to `processEmailEvent()`-
kall via `Promise.all` (i stedet for sekvensielt awaitet, som de
eksisterende testene) og forventer telleren `2` etterpå.

**Ærlig om den empiriske verifiseringen**: fulgte den etablerte
git-stash-metoden (stash `email-events.ts` + `bounce-policy.ts`, kjør
testen mot den gamle koden, pop, bekreft mot den nye) — men den nye
testen besto OGSÅ mot den gamle, sårbare koden, gjentatte ganger (5/5
kjøringer). Årsak: mot lokal Postgres over unix-socket er selve
SELECT/UPDATE-rundturen i `processEmailEvent()` rask nok til at
`Promise.all([...])` med bare to kall ikke pålitelig overlapper de to
kallenes sjekk-så-skriv-vindu i praksis — Node ruller ut de to
funksjonskallene og deres spørringer så tett i tid at den ene
UPDATE-en ofte rekker å committes før den andre SELECT-en i det hele
tatt sendes. Kappløpet er likevel REELT og bekreftet ved lesing av koden
(nøyaktig samme mønster som de tidligere bekreftede TOCTOU-bugene i
natt) — bare ikke pålitelig reproduserbart som en deterministisk,
sviktende test i dette miljøet. Testen er dokumentert med denne
begrensningen direkte i kommentaren, og fungerer likevel som et
legitimt regresjonsvern for selve SQL-mønsteret fremover.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne — bekrefter at slettingen av `bounce-policy.test.ts` (3 tester)
  ikke etterlot noen løse referanser andre steder.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 310 tester, alle grønne — kjørt TO ganger for å
  bekrefte stabilitet (ingen flakete testhygiene-kollisjon denne runden).
- Empirisk git-stash-verifisering utført (se ærlig avsnitt over) —
  bekreftet koden er lest riktig og fiksen er meningsfull, men kunne ikke
  produsere en deterministisk før/etter-kontrast for akkurat DENNE
  konkurransetilstanden i dette miljøet.

### Neste økt

Task #90 er fortsatt ikke fullført: `src/lib/reports/reports.ts`,
`src/lib/security/rate-limit.ts`, `src/lib/countries/countries.ts` er
IKKE lest kritisk ennå denne natten. Bør prioriteres neste økt.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 20: fullførte task #90 — resten av kritisk-lesing-runden, ingen ny bug

Leste de tre gjenstående filene fra forrige økts liste:
`src/lib/reports/reports.ts`, `src/lib/security/rate-limit.ts`,
`src/lib/countries/countries.ts`. Ingen sjekk-så-skriv-kappløp mulig i
noen av dem — alle tre er enten rene lesninger (`countries.ts`) eller har
allerede korrekt håndtering fra tidligere økter (`rate-limit.ts` sin
advisory-lås fra task #42; `reports.ts` skriver ingenting til databasen i
det hele tatt, bare e-postutsendelse, per 25 punkt 10s bevisste
kutt av egen datamodell).

**Én observasjon, IKKE en bekreftet bug**: `POST /report`
(`src/app/api/report/route.ts`) krever ingen innlogging OG har ingen
hastighetsbegrensning — noen kunne i prinsippet spamme moderatorenes
innbokser med `content_reported`-varsler i ubegrenset tempo. Vurderte om
dette er samme klasse funn som de tidligere TOCTOU-bugene i natt (der et
udiskutabelt avvik fra spec-tekst ble rettet umiddelbart), men konkluderte
med at det IKKE er det: SPEC-V1.md 18 lister eksplisitt bare TRE
hastighetsgrenser med konkrete tall (innlogging, svarinnsendelse,
forespørselsopprettelse) — `/report` er ikke blant dem, og siden ruten er
anonym (ingen e-post i selve skjemaet, se `ReportForm`), finnes det heller
ingen naturlig bucket-nøkkel å låse på uten å innføre IP-adresse-
utlesing, en infrastruktur som IKKE finnes noe sted i kodebasen fra før
(ingen `x-forwarded-for`-håndtering, ingen presedens for hvordan man
stoler på/normaliserer en klient-IP bak Netlifys edge). Å innføre dette nå
ville vært en reell ny sikkerhetsfunksjon, ikke en liten feilretting, og
fortjener en bevisst avgjørelse (også organisk lav risiko akkurat nå,
tilsvarende begrunnelsen i rate-limit.ts sin egen kommentar om at
"Stadium 0 har ingen reell samtidig trafikk ennå"). Latt urørt denne
runden — flagget her for en fremtidig, bevisst vurdering, IKKE lagt til de
tre permanent åpne spec-spørsmålene (dette er et hardening-spørsmål, ikke
en spec-selvmotsigelse som krever en policy-avgjørelse).

Ingen kodeendring denne runden — task #90 markert fullført.

### Verifisert før commit (denne runden)

Ingen kodeendring — `git status` viser ingen diff mot forrige commit
(95185b0). Ren gjennomlesing, nevnt eksplisitt i NATTLOGG likevel (samme
begrunnelse som økt 7 og økt 18s tilsvarende "lest kritisk, ingenting å
rette"-oppføringer).

### Neste økt

Ingen spesifikk pekepinn denne gangen — hele den opprinnelige
"kritisk lesing av gjenstående moduler"-runden (task #90) er nå
fullført. Et naturlig neste steg er enten (a) en fornyet
kritisk-lesing-runde mot moduler bygget TIDLIG i natt (før dagens
sjekkliste — sjekk-så-skriv, asymmetriske vakter, tause klientfeil,
klient-/server-grensedrift — var etablert), eller (b) en bevisst
vurdering av observasjonen over (hastighetsbegrensning på `/report`).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 21: fant og rettet et reelt tapt-oppdatering-kappløp i performAccountDeletion() (adminDeleteUser, 18.2)

Fulgte forrige økts alternativ (a): en fornyet kritisk-lesing-runde mot
moduler bygget TIDLIG i natt, før dagens sjekk-så-skriv-sjekkliste var
etablert. Startet med `src/lib/moderation/users.ts` (suspendUser,
unsuspendUser, suppressUserEmail, adminDeleteUser).

`suspendUser()`/`unsuspendUser()`/`suppressUserEmail()` er alle korrekte —
et kappløpsvindu finnes teknisk (ikke-atomisk lese-så-skriv), men enhver
konsekvens av to nesten samtidige kall er idempotent (samme sluttstatus,
`onConflictDoNothing()` på sperrelisteinnsettingen) — samme aksepterte
klasse som `unsubscribeByToken()`.

`adminDeleteUser()` var derimot et REELT hull: den kaller
`performAccountDeletion()` (`src/lib/auth/account-deletion.ts`) — en
funksjon DELT med den selvbetjente to-stegs slettelenken
(`confirmAccountDeletion()`). Den selvbetjente veien er selv trygg, fordi
SELVE TOKENET har en atomisk engangsbruk-sperre (`UPDATE ... WHERE
usedAt IS NULL`, rettet i en tidligere økt, task #51). `adminDeleteUser()`
har derimot INGEN tilsvarende sperre — bare en tidligere, ikke-atomisk
sjekk av `user.status !== "deleted"` FØR den kaller
`performAccountDeletion()`, som selv heller ikke hadde noen egen sperre.
To nesten samtidige `POST /admin/users/:id/delete`-kall for SAMME bruker
(dobbeltklikk fra en moderator, eller en nettverksgjenforsøk) kunne derfor
begge passere sjekken og begge kjøre HELE slettelogikken — duplikate
"kontoen din er slettet"-e-poster, duplikate revisjonslogg-rader for én
og samme irreversible handling (18.2), og i verste fall (avhengig av
nøyaktig rekkefølge) et forsøk på å hashe en allerede anonymisert
"e-post"-verdi, som ville korrumpert `email_hash`.

**Fiks**: la den atomiske sperren inn i `performAccountDeletion()` selv
(der begge kallerne møtes), som en enkelt `UPDATE users SET email =
emailHash, ... WHERE id = userId AND status != 'deleted' RETURNING id` —
flyttet FREMST i funksjonen, rett etter den innledende SELECT-en som
henter den ekte e-postadressen. Får ikke UPDATE-en noen rad tilbake, har
et annet, samtidig kall allerede "vunnet kappløpet" — funksjonen avbryter
umiddelbart, uten duplikate e-poster, uten duplikate revisjonsrader.
Måtte flytte selve anonymiseringsskrivingen (tidligere sist i funksjonen,
med kommentaren "funksjonene over trenger fortsatt e-post/locale for
varsler") fremover — verifiserte at dette er trygt: hverken
`anonymizeRecipientContent()` eller `closeJournalistContentOnDeletion()`
leser den SLETTEDE brukerens egen e-post/locale fra `users`-tabellen på
nytt (de sender bare varsler til ANDRE parter — journalisten som eier en
kontaktforespørsel, respondenter på en lukket forespørsel — slått opp via
egne joins), og selve bekreftelses-e-posten til brukeren bruker den
allerede JS-fangede `user.email`/`user.locale`-verdien fra den
innledende SELECT-en, ikke et nytt oppslag.

**Ny test, empirisk verifisert MED en deterministisk før/etter-kontrast**
(til forskjell fra forrige økts soft_bounce-kappløp, som IKKE reproduserte
pålitelig): la til "to SAMTIDIGE slettekall for SAMME bruker kjører den
irreversible slettingen bare ÉN gang" i
`moderation/users.integration.test.ts`, som fyrer to `adminDeleteUser()`-
kall via `Promise.all` og forventer nøyaktig ÉN `account.delete`-
revisjonsrad etterpå (testen aksepterer at rekkefølgen de to kallene
FAKTISK fullfører i ikke er garantert lik array-rekkefølgen, og at det
andre kallet enten no-oper stille eller avvises med
`errors.not_found` — begge er trygge utfall). Kjørte deretter
`git stash` på KUN `account-deletion.ts` og gjentok testen 3 ganger mot
den gamle koden: feilet DETERMINISTISK alle 3 gangene (2 revisjonsrader,
ikke 1) — en mye renere empirisk kontrast enn forrige økts kappløp, siden
selve SELECT-lese-vinduet her (én enkelt innledende SELECT i
`adminDeleteUser()`, IKKE inni selve `performAccountDeletion()`) er bredt
nok til å pålitelig overlappe mellom to samtidige kall selv over en rask
lokal unix-socket-forbindelse. `git stash pop` gjenopprettet fiksen,
bekreftet grønn igjen.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 311 tester (310 + 1 ny), alle grønne — kjørt TO
  ganger for å bekrefte stabilitet.
- Empirisk git-stash-verifisering: 3/3 deterministiske feil mot gammel
  kode, grønn igjen mot fiksen (se over).

### Neste økt

Fortsatte den fornyede kritisk-lesing-runden fra tidlig-natt-moduler —
`moderation/users.ts` er nå dekket. Gjenstår fortsatt (ikke påbegynt):
`moderation/journalists.ts` (utover den allerede rettede TOCTOU i
approveJournalist/rejectJournalist, task #48 — resten av filen er ikke
eksplisitt re-lest), `moderation/responses.ts`, `admin/responses.ts`,
`admin/legal-documents.ts`, `journalist-inbox/journalist-inbox.ts`,
`email/digest.ts` (selve render-logikken, til forskjell fra
`digests/digests.ts` og `jobs/tick.ts` som ble dekket i task #63).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 22: fant og rettet en manglende atomisk re-sjekk i hideResponse() (12.5, FR-050)

Fortsatte den fornyede kritisk-lesing-runden. `moderation/journalists.ts`
er korrekt — `approveJournalist()`/`rejectJournalist()` har allerede den
etablerte atomiske WHERE-re-sjekken (task #48), og `listJournalists()` er
en ren lesning.

`moderation/responses.ts` sin `hideResponse()` hadde derimot samme KLASSE
hull som `performAccountDeletion()` denne natten, bare med lavere
alvorlighetsgrad: den gjorde en innledende SELECT for å sjekke
`lifecycleStatus === "submitted"`, men selve UPDATE-en under hadde INGEN
tilsvarende betingelse i WHERE-en (bare `eq(responses.id, responseId)`) —
til forskjell fra `approveJournalist()`/`rejectJournalist()` og
`publishRequest()`, som alle re-sjekker statusen direkte i selve
skrive-setningen (task #48/#49). `withdrawResponse()`
(`responses/responses.ts`) HARD-SLETTER svar-raden når respondenten
trekker den (12.4, 17.4) — skjer det nesten samtidig som et
moderatorkall til `hideResponse()`, kunne UPDATE-en stille truffet 0
rader (svaret allerede borte), men koden sjekket aldri det, og logget
likevel en `response.hide`-revisjonsrad og returnerte `{ok:true}` for en
handling som aldri fant sted — en MISVISENDE revisjonslogg-oppføring
(FR-050, 19.12), ikke datakorrupsjon (selve responsen forsvinner uansett,
siden `withdrawResponse()` sletter ubetinget).

**Fiks**: la til `eq(responses.lifecycleStatus, "submitted")` i UPDATE-ens
WHERE, pluss `.returning()` med en eksplisitt sjekk av at en rad faktisk
ble truffet — akkurat samme mønster som søskenfunksjonene. Får ikke
UPDATE-en noen rad, avbrytes hele funksjonen med
`errors.response_not_visible` FØR den rekker å skrive noen revisjonslogg.

**Ærlig om den empiriske verifiseringen — lavere alvorlighet enn de to
foregående fiksene i natt**: la til en ny test som fyrer `hideResponse()`
og `withdrawResponse()` samtidig via `Promise.all`, og verifiserte
konsistens (en `response.hide`-revisjonsrad finnes hvis og bare hvis
`hideResponse()` selv rapporterte `ok:true`). Kjørt 5 ganger mot BÅDE
den nye OG (via `git stash`) den gamle koden: i dette miljøet vinner
`hideResponse()` sin egen lese-til-skrive-vei ALLTID kappløpet mot
`withdrawResponse()` sin lengre kjede av databasekall (flere sekvensielle
spørringer FØR selve slettingen) — testen traff derfor aldri den smale
race-vinduet (mellom `hideResponse()`s EGEN SELECT og dens EGEN UPDATE)
som selve bugen krever, verken i gammel eller ny kode, samme kategori
begrensning som soft_bounce-kappløpet i Økt 19. Fiksen er likevel korrekt
og nødvendig ut fra ren kodelesning — den er strukturelt IDENTISK med det
allerede empirisk beviste mønsteret i `approveJournalist()`/
`rejectJournalist()` (task #48, DER reproduserte kappløpet pålitelig).
Alvorlighetsgraden her er lavere enn kveldens to andre TOCTOU-funn (ingen
datakorrupsjon eller sikkerhetsbrudd — bare en potensielt misvisende
revisjonslogg-oppføring i et allerede smalt vindu), så en full
lås-basert deterministisk rigg for å tvinge frem racet ble vurdert som
disproporsjonal innsats for denne konkrete fiksen.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 312 tester (311 + 1 ny), alle grønne — kjørt TO
  ganger for å bekrefte stabilitet.
- Empirisk git-stash-verifisering forsøkt (se ærlig avsnitt over) — ingen
  observerbar kontrast i dette miljøet, av grunner forklart der.

### Neste økt

Gjenstår fortsatt fra den fornyede kritisk-lesing-runden:
`admin/responses.ts`, `admin/legal-documents.ts`,
`journalist-inbox/journalist-inbox.ts`, `email/digest.ts` (selve
render-logikken).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 23: fullførte den fornyede kritisk-lesing-runden — resten av listen, ingen flere kodeendringer

Leste de fire siste filene fra Økt 22s liste: `admin/responses.ts`,
`admin/legal-documents.ts`, `journalist-inbox/journalist-inbox.ts`,
`email/digest.ts`.

`getResponseForAdmin()` (`admin/responses.ts`) er ren lesning pluss en
revisjonslogg-innsetting — ingen skriving til selve entiteten, ingen
kappløp mulig. `publishLegalDocument()` (`admin/legal-documents.ts`) har
allerede riktig beskyttelse mot dobbel-publisering (den unike indeksen
`legal_documents_country_locale_type_version_idx` fanges eksplisitt via
`isUniqueViolation()`, samme mønster som `createCountry()`). `email/
digest.ts` er ren rendringslogikk uten noen databasetilgang i det hele
tatt — ingen kappløp mulig per definisjon.

`journalist-inbox.ts` hadde to kandidater, begge vurdert og forkastet som
reelle bugs:
1. `getResponseDetailForJournalist()`s "sett `viewed_at` FØRSTE gang"-
   mønster har et kappløpsvindu (ingen `IS NULL`-re-sjekk i selve
   UPDATE-en), men konsekvensen er harmløs — to nesten samtidige
   sidevisninger ville begge skrive en tidsstempel-verdi som uansett betyr
   "nå", uavhengig av hvilken av dem som faktisk vinner.
2. `updateResponseMarking()` har STRUKTURELT samme hull som `hideResponse()`
   hadde før denne nattens Økt 22-fiks (ingen `lifecycleStatus`-re-sjekk i
   selve UPDATE-ens WHERE) — men til forskjell fra `hideResponse()` skriver
   denne INGEN revisjonslogg og har INGEN spec-krav om nøyaktig telling.
   Verste konsekvens av et kappløp er et stille no-op (0 rader truffet,
   ingen feil, ingen synlig skade) på et felt (`journalistMarking`/
   `journalistNote`) som uansett ikke er synlig for respondenten (13.1) og
   ikke lekker eller korrumperer noe. Vurdert som for lav alvorlighet til å
   rettferdiggjøre en kodeendring i natt — notert her i tilfelle en
   fremtidig økt uenig seg.

Ingen kodeendring denne runden. Dette avslutter den fornyede
kritisk-lesing-runden startet i Økt 21 — alle filene identifisert der er
nå gjennomgått, med tre reelle funn rettet (Økt 19, 21, 22).

### Verifisert før commit (denne runden)

Ingen kodeendring — `git status` viser ingen diff mot forrige commit
(52ae95c). Ren gjennomlesing, nevnt eksplisitt i NATTLOGG likevel (samme
begrunnelse som økt 7, 18 og 20s tilsvarende oppføringer).

### Neste økt

Den fornyede kritisk-lesing-runden (startet Økt 21) er nå komplett for
ALLE filene identifisert i Økt 21/22s lister. Gjenstående, aldri
eksplisitt kritisk-lest moduler er nå bare små, rene hjelpefunksjoner
uten databasetilgang (`requests/slug.ts`, `requests/topics.ts`,
`*/status-badge.ts`, `datetime/timezone.ts`, `email/colors.ts`,
`email/escape-html.ts`, `forms/focus-first-invalid.ts`) — lav
sannsynlighet for TOCTOU-klassen bugs siden de ikke skriver til databasen
i det hele tatt. En fremtidig økt bør vurdere å skifte fokus fra
"kritisk lesing for kappløp" til noe annet — f.eks. en fornyet
FR-gjennomgang, eller de tre permanent åpne spec-spørsmålene under (som
fortsatt venter på et menneske).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 24: fant og rettet en reell fremmednøkkel-krasj i retensjonsjobbens avviste-journalistsøknad-kategori (17.4)

Startet med det API-fokuserte punktet fra selve den (stort sett utdaterte)
stående rutine-teksten: verifiserte at ALLE endepunktene i SPEC-V1.md
seksjon 20 faktisk finnes som `route.ts`-filer, inkludert at
flermetode-filer (`/me`, `/journalists/me`, `/requests/:id`,
`/admin/countries`) faktisk implementerer HVER metode spec-en lister.
Alle 57 endepunkter (pluss de seks lagt til under tidligere økter,
dokumentert direkte under seksjon 20-tabellen) er på plass — ingen hull.

Fortsatte deretter med en dypere gjennomlesing av `jobs/retention.ts`
(17.4) — den mest sensitive jobben i kodebasen, siden den sletter/
anonymiserer ekte persondata, og derfor verdt en ekstra grundig kontroll
utover det som allerede er testet.

**Reelt, tidligere udekket hull funnet**: `purgeRejectedJournalistApplications()`
sin begrunnelseskommentar hevder at en avvist journalist ALDRI kan ha noe
som refererer til kontoen (siden `pending_review` og `rejected` begge
blokkerer innsending til moderering) — riktig for `requests`/`responses`/
`contactRequests`, men jeg fant ett unntak kommentaren ikke tar høyde for:
en avvist journalist er IKKE utestengt fra å LOGGE INN (8.1: kun
`journalistProfiles.verification_status` settes ved avvisning, aldri
`users.status`) — kontoen forblir fullt funksjonell. En slik bruker kan
derfor, helt uavhengig av avvisningen, senere be om SELVBETJENT
kontosletting (`/me/request-deletion` → `performAccountDeletion()`).
`performAccountDeletion()` logger en `account.delete`-revisjonsrad med
`actor_user_id` = brukerens EGEN id — men rører ALDRI `journalistProfiles`
(kun `requests`/`emailSubscriptions`/kontostatus). Seks måneder etter den
opprinnelige avvisningen finner denne jobben derfor den SAMME
`journalistProfiles`-raden igjen (uendret `verification_status = rejected`),
og forsøker `DELETE FROM users` — som krasjer med et fremmednøkkelbrudd
mot `audit_logs.actor_user_id` (ingen `ON DELETE CASCADE`). Fanget av
funksjonens egen try/catch (krasjer ikke resten av jobben), men
kandidaten blir en PERMANENT "zombie" — jobben feiler mot nøyaktig samme
bruker hver eneste dag, for alltid, og GDPR-retensjonsløftet (17.4)
innfris ALDRI for denne spesifikke brukeren. Samme bug-KLASSE som
`runPurgeUnverified()` hadde (task #54) — men til forskjell fra DEN
(som IKKE har dette problemet: en ubekreftet konto kan aldri ha logget
inn og dermed aldri ha trigget noen selvbetjent handling som logger
`actor_user_id` = sin egen id) — feilen her forsvinner aldri av seg selv.

**Fiks**: la til `await dbase.delete(auditLogs).where(eq(auditLogs.actorUserId,
candidate.userId))` i sletterekkefølgen, FØR selve `journalistProfiles`/
`users`-slettingen — samme "rydd alt som refererer til brukeren FØRST"-
mønster som resten av funksjonen allerede fulgte for de andre tabellene.

**Empirisk verifisert**: la til en ny test som setter opp en avvist
søknad (7 måneder gammel, forbi fristen) OG en tilhørende
`audit_logs`-rad med `actor_user_id` = brukeren (simulerer en tidligere
selvbetjent sletting) — kjørt mot koden FØR fiksen: feilet med EKSAKT
den forventede Postgres-feilmeldingen
(`update or delete on table "users" violates foreign key constraint
"audit_logs_actor_user_id_users_id_fk"`). Etter fiksen: alle 12 tester i
filen grønne, inkludert den nye.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 313 tester (312 + 1 ny), alle grønne — kjørt TO
  ganger for å bekrefte stabilitet.
- Empirisk før/etter-verifisering: bekreftet feil MED den eksakte
  Postgres-feilteksten mot koden før fiksen, grønn etter (se over) — en
  av de renere, mer deterministiske empiriske bekreftelsene i natt (til
  forskjell fra flere av kveldens tidligere kappløps-funn, der selve
  TIMINGEN gjorde reproduksjon upålitelig — denne bugen krever ingen
  samtidighet i det hele tatt, bare en bestemt REKKEFØLGE av to
  hendelser over tid, så den er 100 % deterministisk å sette opp).

### Neste økt

`runPurgeUnverified()` (`tick.ts`) ble vurdert for SAMME bug-klasse og
bekreftet TRYGG (ikke bare antatt) — en ubekreftet konto kan aldri ha
logget inn (økten opprettes først ETTER `verifyMagicLink()`), og kan
derfor aldri ha trigget noen selvbetjent handling som logger
`audit_logs.actor_user_id` = sin egen id. Ingen kodeendring der.

Verdt å sjekke i en fremtidig økt: er det NOEN ANDRE steder i kodebasen
som hard-sletter en `users`-rad uten å først rydde `audit_logs.actor_user_id`?
`purgeOldAuditLogs()` (samme fil) sletter selve revisjonsloggen basert på
ALDER — ingen risiko der. `performAccountDeletion()` selv sletter ALDRI
`users`-raden (bare anonymiserer), så det er ikke et problem der heller.
Disse to er nå de eneste stedene som hard-sletter en `users`-rad
(`purgeRejectedJournalistApplications()` og `runPurgeUnverified()`) —
begge nå bekreftet trygge.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 25: fullførte en systematisk fremmednøkkel-revisjon av ALLE hard-sletting-steder i kodebasen — ingen flere hull funnet

Fortsatte direkte fra forrige økts "verdt å sjekke"-punkt, men utvidet
sjekken fra bare `users`-tabellen til HELE fremmednøkkelgrafen (alle
`.references(() => ...)`-kall i `schema.ts`) krysset mot ALLE
`db.delete(...)`/`dbase.delete(...)`-kall i `src/lib` (utenom test- og
fixture-filer).

**Metode**: listet opp samtlige 22 `references()`-kall i `schema.ts`
(oppdaget to jeg ikke hadde tatt med i forrige økts vurdering:
`journalistProfiles.reviewedBy` og `requests.moderatedBy`, begge peker på
`users.id` fra MODERATORENS side av en gjennomgang/moderering — ikke fra
journalisten/mottakeren selv). Krysset dette mot hvert `delete(...)`-kall:

- `delete(users)`: kun de to allerede bekreftede stedene
  (`purgeRejectedJournalistApplications()`, `runPurgeUnverified()`).
  `reviewedBy`/`moderatedBy`-risikoen fra de to nye kolonnene jeg fant,
  gjelder IKKE disse to funksjonene — begge sletter kun kontoer med
  `role = journalist` som ALDRI kan ha vært moderator/administrator (en
  brukers rolle er fast, tildelt ved registrering, aldri endret), og kan
  derfor aldri ha vært den som "reviewedBy"/"moderatedBy" en ANNEN
  brukers søknad/forespørsel.
- `delete(requests)`: kun de samme to funksjonene (rader eid av den
  slettede journalisten selv) — `DELETE /requests/:id` (den
  journalist-initierte "slett utkast"-ruten, 9.2) er en MYK sletting
  (`deleteDraft()` setter `status = 'deleted'`, sletter aldri raden
  fysisk) — ingen fremmednøkkelrisiko der i det hele tatt, siden raden
  fortsatt eksisterer.
- `delete(responses)`: `purgeOldResponses()` (retention.ts) og
  `withdrawResponse()` (responses.ts) — begge nuller allerede
  `contactRequests.responseId` FØR selve slettingen (bekreftet ved
  gjenlesing, samme mønster begge steder).
- `delete(digests)`: `purgeOldDigests()` sletter `digestDeliveries` FØRST.
  Ingen annen tabell refererer `digests.id` direkte (kun
  `digestDeliveries.digestId` gjør det, og den er allerede ryddet).
- `delete(journalistProfiles)`, `delete(consentRecords)`,
  `delete(authTokens)`, `delete(sessions)`, `delete(auditLogs)`,
  `delete(contactRequests)`, `delete(emailSubscriptions)`,
  `delete(rateLimitHits)`: INGEN annen tabell i skjemaet refererer til
  noen av disses primærnøkler (`id`) — disse kan trygt slettes i
  vilkårlig rekkefølge uten noen fremmednøkkelrisiko.
- `legalDocuments`: ALDRI hard-slettet noe sted i kodebasen (17.2:
  "beholdes uendret" — i tråd med spec-en, ikke en forglemmelse).

**Konklusjon**: bortsett fra denne nattens allerede rettede
`audit_logs.actor_user_id`-hull (Økt 24), er HELE
hard-sletting-overflaten i kodebasen nå verifisert fremmednøkkel-trygg.
Ingen ny kodeendring denne runden.

Sjekket i samme slag: `netlify.toml` sin eneste planlagte funksjon
(`tick`, `*/15 * * * *`) mot `tick.ts` sin egen `shouldRunDailyJobNow()`-
vakt (kjører kun i vinduet `hour === 3 && minute < 15`) — gitt et
15-minutters intervall (:00, :15, :30, :45) treffer denne vakten PRESIST
ÉN gang i døgnet (kl. 03:00, IKKE 03:15, siden `15 < 15` er usann).
Fortsatt korrekt, ingen regresjon siden den opprinnelige fiksen
(task #29).

### Verifisert før commit (denne runden)

Ingen kodeendring — `git status` viser ingen diff mot forrige commit
(1585866). Ren gjennomlesing/revisjon, nevnt eksplisitt i NATTLOGG
likevel (samme begrunnelse som økt 7, 18, 20 og 23s tilsvarende
oppføringer).

### Neste økt

Fremmednøkkel-revisjonen av hard-slettinger er nå komplett — ingen
åpne tråder herfra. En fremtidig økt bør vurdere et helt NYTT
fokusområde, siden både kappløps-sjekklisten (Økt 19-23) og
fremmednøkkel-sjekklisten (Økt 24-25) nå er uttømt for det som er
funnet så langt. Kandidater: en fornyet FR-gjennomgang (sist gjort i
en tidlig økt, kan ha driftet siden), en sjekk av om nye
oversettelsesnøkler har sneket seg inn uten dekning i alle locales
(`i18n/check-keys.ts` dekker bare at nøkler FINNES i nb-NO, ikke at ALLE
konfigurerte locales for et land faktisk har dem), eller ganske enkelt
en ny runde med de tre permanent åpne spec-spørsmålene under (fortsatt
bevisst latt til et menneske).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 26: rettet en reell, om enn lav-alvorlighets, valideringsmangel — `createCountry()`/`updateCountry()` sjekket aldri at `available_locales` faktisk er språk plattformen støtter (19.1)

**Korreksjon av forrige økts "Neste økt" først**: Økt 25 hevdet at
"`i18n/check-keys.ts` dekker bare at nøkler FINNES i nb-NO, ikke at ALLE
konfigurerte locales for et land faktisk har dem" — dette var FEIL, og
jeg oppdaget det ved faktisk å lese scriptet før jeg fulgte opp ledetråden
selv. `check-keys.ts` har ALLEREDE en egen `findLocaleGaps()`-funksjon som
sammenligner nb-NO mot HVERT annet konfigurert språk (`en-GB`) og
ADVARER (feiler ALDRI bygget) om nøkler som mangler — nøyaktig det
SPEC-V1.md 21.3 krever ("manglende oversettelse i andre språk gir
advarsel og fallback"). Kjørte scriptet på nytt for å bekrefte: ingen
advarsler, `en-GB` har full paritet med `nb-NO` akkurat nå. Beklager
den feilaktige ledetråden — kastet den videre uprøvd fra en for rask
antagelse forrige økt, nøyaktig den typen feil denne nattens metodikk
(faktisk kjøre/lese ting, ikke anta) er ment å unngå. Rettet her, ingen
fremtidig økt bør bruke tid på den.

**Det jeg fant i stedet, ved å faktisk følge sporet dette reiste**: er
`SUPPORTED_LOCALES` (`src/i18n/config.ts`, listen over ALLE locales
plattformen i det hele tatt har oversettelsesfiler for) noensinne
håndhevd som en RAMME rundt `countries.available_locales` (den
databasedrevne, per-land listen administrator selv konfigurerer)? Svaret
var nei: verken `createCountry()` eller `updateCountry()`
(`src/lib/admin/countries.ts`) validerte at HVER tagg i
`availableLocales` faktisk er en plattformen kjenner — kun at
`defaultLocale` er MEDLEM av `availableLocales` (intern konsistens, ikke
ekstern gyldighet).

**Konsekvens, undersøkt grundig FØR jeg konkluderte om alvorlighetsgrad**:
sporet ALLE stedene en database-lest locale-streng faktisk konsumeres —
`sendTransactionalEmail()` (`email/send.ts`, linje 142) og `runDigestTick()`
(`tick.ts`, linje 275/284) bruker BEGGE allerede
`isSupportedLocale(x) ? x : PLATFORM_DEFAULT_LOCALE` FØR de kaller
`createTranslator()`/rendrer noe — og selve URL-rutingen
(`middleware.ts`) validerer `[locale]`-URL-segmentet strengt mot
`SUPPORTED_LOCALES`, uavhengig av hva et lands `available_locales` sier.
Alle tre forbrukssteder er altså ALLEREDE defensive. Konklusjon: dette
er IKKE en krasj-risiko (til forskjell fra kveldens tre andre, mer
alvorlige funn) — konsekvensen er en STILLE, forvirrende dødsgate: en
bruker kunne "velge" en locale administrator feilaktig la til (skrivefeil,
eller en språktagg ingen oversettelsesfil finnes for), og få den
GODTATT (fordi `PATCH /me`s egen sjekk bare krever medlemskap i
`country.availableLocales`, ikke i `SUPPORTED_LOCALES`), men den ville
ALDRI faktisk gjøre noe — verken UI-språket, e-postene, eller URL-en
ville noensinne reflektere valget, og ingen feilmelding ville forklart
hvorfor.

**Fiks**: la til `input.availableLocales.every(isSupportedLocale)`-sjekk
i begge funksjoner, med en ny feilkode `errors.unsupported_locale`
(lagt til i BÅDE `nb-NO.json` og `en-GB.json` — denne kategorien
feilkoder konsumeres via en DYNAMISK `t(errorKey)` i klientskjemaene,
ikke en bokstavelig streng, så `check-keys.ts` sin statiske scanning
kan ALDRI fange en manglende oversettelse for akkurat denne klassen
nøkler — de må legges til manuelt, som de andre `errors.*`-nøklene).
Rettet spec-en FØRST (SPEC-V1.md 19.1, ny forklarende merknad rett under
`Country`-datamodellen, samme mønster som tidligere økters tilføyelser),
deretter koden, per den stående regelen.

**Ny testdekning**: to nye tester i `admin/countries.integration.test.ts`
— én for `createCountry()`, én for `updateCountry()`, begge med en
konstruert `["nb-NO", "fr-FR"]`-liste, forventer `errors.unsupported_locale`
og bekrefter at INGENTING ble opprettet/endret i databasen.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler brukt i kode funnet
  (den nye `errors.unsupported_locale`-nøkkelen telles IKKE her, siden
  den konsumeres dynamisk — forventet, samme som alle andre `errors.*`-
  feilkoder).
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 315 tester (313 + 2 nye), alle grønne — kjørt TO
  ganger for å bekrefte stabilitet.
- Ingen empirisk før/etter-verifisering denne gangen — dette er ny
  VALIDERING (et manglende sjekk-kall), ikke en atferdsendring i en
  eksisterende kodesti, så det finnes ingen "gammel oppførsel" å
  kontrastere mot i samme forstand som kveldens TOCTOU-/FK-funn. De to
  nye testene beviser fiksen direkte (avvist FØR og ETTER er identisk
  siden testen kjøres mot den FERDIGE fiksen — verifisert i stedet ved å
  lese koden og bekrefte at uten `every(isSupportedLocale)`-sjekken ville
  begge testene feilet, siden verken `defaultLocale`-sjekken eller den
  unike landkode-constrainten ville fanget en gyldig, men usupportert,
  tagg i `availableLocales`).

### Neste økt

Ingen spesifikk pekepinn — dagens tre hovedspor (kappløp, fremmednøkler,
lokal-validering) er nå alle uttømt for det jeg har funnet. En fremtidig
økt bør velge et FRISKT fokusområde selv, eller ta fatt på de tre
permanent åpne spec-spørsmålene under.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 27: fant og rettet et reelt, PÅLITELIG reproduserbart kappløp i FR-029s 5-grense — `publishRequest()` sin telling var ikke atomisk med selve publiseringen

Fulgte Økt 26s eget forslag: en fornyet FR-gjennomgang (SPEC-V1.md
seksjon 22), siden både kappløps-, fremmednøkkel- og lokal-validerings-
sporene fra tidligere i natt var uttømt. Startet med FR-029 ("hindre en
journalist i å ha mer enn 5 forespørsler med status `published`
samtidig") — en tellingsbasert forretningsregel, akkurat den KLASSEN
bug denne natten har funnet flest reelle eksempler av (soft_bounce-
telleren, Økt 19).

`submitRequest()` (`requests/requests.ts`) sin egen kommentar sa det
rett ut: den re-håndhever grensen VED PUBLISERING (`moderation/
requests.ts`, `publishRequest()`) "fordi tiden mellom submit og
moderatorgodkjenning gjør at flere innsendte forespørsler i prinsippet
kunne bli godkjent omtrent samtidig". Så etterpå på selve
`publishRequest()`: den gjorde en ren `SELECT COUNT(*)` av allerede
publiserte forespørsler, sjekket `< 5`, og skrev DERETTER — med en
atomisk `WHERE status='submitted'`-betingelse på selve UPDATE-en (fra
task #49) som bare hindrer at SAMME rad publiseres to ganger. Denne
betingelsen sier INGENTING om hvor mange AV JOURNALISTENS ANDRE
forespørsler som publiseres i akkurat samme øyeblikk — to FORSKJELLIGE
innsendte forespørsler fra samme journalist, godkjent av to moderatorer
(eller to faner) nesten samtidig, kunne begge lese samme (for lave)
antall og begge bestå sjekken.

**Empirisk bekreftet, PÅLITELIG denne gangen** (til forskjell fra flere
av kveldens tidligere kappløpsfunn, der selve timingen gjorde
reproduksjon upålitelig): skrev først en test med bare TO samtidige
`publishRequest()`-kall — den reproduserte IKKE kappløpet i 5/5 forsøk
(samme miljøbegrensning som soft_bounce-testen i Økt 19). Utvidet
testen til ÅTTE samtidige kall (en journalist med 4 allerede publiserte,
åtte NYE innsendte forespørsler godkjent samtidig) — dette reproduserte
DETERMINISTISK i alle 3 kjøringer: 10, 11, og 10 publiserte forespørsler
(skulle vært maks 5). Til forskjell fra soft_bounce-kappløpet (der flere
samtidige kall kompliseres av eskaleringslogikken), er hvert
`publishRequest()`-kall her på en HELT SEPARAT rad, så flere samtidige
forsøk øker rett og slett sjansen for overlapp uten noen bivirkning å
ta hensyn til.

**Fiks**: pakket tellingen og selve status-overgangen inn i ÉN
`db.transaction()`, låst med en per-journalist `pg_advisory_xact_lock`
— nøyaktig samme mønster som `checkRateLimit()` (`security/
rate-limit.ts`, fra task #42) allerede etablerte for akkurat denne
KLASSEN problem (en tellingsbasert grense som må håndheves atomisk på
tvers av flere rader, ikke bare én). Revisjonslogg-innsettingen flyttet
INN i samme transaksjon (atomisk med selve publiseringen — FR-050s
"logg ALLE moderator-/administratorhandlinger" bør aldri kunne skje
uten den tilhørende tilstandsendringen, eller omvendt), mens selve
e-postvarslingen til journalisten forblir UTENFOR transaksjonen (samme
etablerte prinsipp som resten av kodebasen — ekstern I/O holder ikke en
DB-transaksjon åpen).

Omstrukturerte samtidig returtypen internt til en diskriminert
`"published" | "too_many_published" | "not_submitted_anymore"`-verdi fra
transaksjonen, i stedet for å måtte gjøre et EKSTRA oppslag etterpå for
å skille de to feilutfallene fra hverandre — begge var allerede
definerte, separate feilkoder (`errors.too_many_published_requests` vs.
`errors.request_not_editable`), bare uten en ren måte å vite HVILKEN
uten en telling til.

**Testendring**: utvidet den eksisterende sekvensielle FR-029-testen med
en ny, egen test som fyrer ÅTTE samtidige `publishRequest()`-kall via
`Promise.all` og forventer nøyaktig ÉN suksess, resten avvist med
`errors.too_many_published_requests`, og `SELECT COUNT(*)` aldri over 5
etterpå.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 316 tester (315 + 1 ny), alle grønne — kjørt TO
  ganger for å bekrefte stabilitet.
- Empirisk før/etter-verifisering: 3/3 DETERMINISTISKE feil (10, 11, 10
  publiserte) mot koden før fiksen, 3/3 grønne kjøringer mot fiksen.

### Neste økt

Fortsett den fornyede FR-gjennomgangen (seksjon 22) — kun FR-029 er
grundig re-verifisert denne runden. Andre tellingsbaserte/grense-
regler verdt å sjekke spesifikt for SAMME klasse kappløp: FR-041 (én
aktivt svar per person per forespørsel — allerede beskyttet av en unik
databaseindeks, ikke en tellesjekk, så sannsynligvis trygt, men ikke
eksplisitt re-bekreftet i natt), FR-043 (én kontaktforespørsel per svar
— sannsynligvis også indeksbeskyttet). Ellers: resten av FR-001 til
FR-054 er ikke eksplisitt re-lest med denne nattens spesifikke
kappløps-sjekkliste.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

**Tillegg samme økt**: fulgte opp egen "Neste økt"-ledetråd over med en
gang — bekreftet FR-041 og FR-043 er BEGGE trygge mot samme
kappløpsklasse som FR-029, men av en helt annen (sterkere) grunn: begge
håndheves av en EKTE databasebegrensning, ikke applikasjonslagets egen
telling. FR-041 (ett aktivt svar per person per forespørsel) har en
betinget UNIK INDEKS (`db/migrations/0001_responses_active_unique_index.sql`,
referert i `schema.ts` sin kommentar over `responses`-tabellen), og
FR-043 (én kontaktforespørsel per svar) har en vanlig
`.unique()`-begrensning på `contact_requests.response_id`. Begge er
derfor UMULIGE å kappløpe forbi — Postgres selv avviser det andre
samtidige forsøket, uavhengig av applikasjonslagets timing. Bekreftet i
tillegg at BÅDE `submitResponse()` (`responses/responses.ts`) og
`createContactRequest()` (`contact-requests/contact-requests.ts`)
allerede fanger denne unike-constraint-feilen korrekt via
`isUniqueViolation()` og returnerer den forventede feilkoden
(`errors.already_responded`/`errors.contact_request_already_sent`) i
stedet for å krasje med en uhåndtert 23505. Ingen kodeendring — begge
bekreftet trygge.

## Økt 28: fant og rettet et reelt kappløp i innloggingslenkens hastighetsgrense — samme klasse hull som checkRateLimit() selv hadde (task #42), men aldri migrert dit

Fortsatte den systematiske sveipen fra Økt 27 (`count()`-bruk i
applikasjonskoden) på jakt etter FLERE tellingsbaserte grenser i SAMME
klasse som FR-029s bug. Grep etter `count()` på tvers av `src/lib` fant
`src/lib/auth/magic-link.ts`.

`requestMagicLink()` håndhever SPEC-V1.md 6.1s "maks 5 forespørsler per
e-postadresse per 15 minutter" med sin EGEN, hånd-rullede
"SELECT COUNT så INSERT"-logikk — nøyaktig samme mønster `checkRateLimit()`
(`security/rate-limit.ts`) allerede LØSTE ATOMISK tidligere i natt
(task #42, med en per-bucket `pg_advisory_xact_lock`), og som allerede
brukes andre steder (`createDraft()` i `requests/requests.ts`,
rate-limiting i `responses.ts`). Denne ene funksjonen hadde bare aldri
blitt migrert til å bruke den delte, korrekte primitiven — den beholdt
sin egen, parallelle, USIKREDE variant.

**Empirisk bekreftet, PÅLITELIG med én gang** (10 samtidige kall, samme
skala som FR-029-testen i Økt 27, siden 2 samtidige kall trolig ikke
ville reprodusert kappløpet pålitelig i dette miljøet — se etablert
mønster i natt): en test som fyrer 10 samtidige `requestMagicLink()`-kall
for SAMME e-postadresse ga 8-10 opprettede tokens (skulle vært maks 5) i
alle 3 kjøringer mot koden FØR fiksen.

**Fiks**: erstattet den hånd-rullede tellingen med et enkelt kall til
`checkRateLimit()`, med bucket-navnet `magic-link:<user.id>` — samme
bucket-navngivningsmønster (`<domene>:<id>`) som `createDraft()`
allerede etablerte. Fjernet de nå ubrukte `count`/`gt`-importene.
Funksjonens egen kontrakt (returnerer `void`, avslører aldri om
rate-grensen er nådd — 6.1: "avslører ALDRI om
e-postadressen faktisk finnes") er UENDRET, bare selve
implementasjonen av sjekken er byttet ut.

**Testendring**: utvidet den eksisterende sekvensielle
"nekter en sjette forespørsel"-testen med en ny, egen test som fyrer 10
samtidige `requestMagicLink()`-kall via `Promise.all` og forventer at
antall opprettede tokens ALDRI overstiger 5.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: OK, ingen feil.
- `npx eslint .`: OK, ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  grønne.
- `npx tsx src/i18n/check-keys.ts`: OK, 507 nøkler.
- `npx next build`: OK, ingen feil.
- `npx vitest run -c vitest.integration.config.ts` mot ekte lokal
  Postgres: 32 filer, 317 tester (316 + 1 ny). Første kjøring viste én
  urelatert feil i en digest-test (samme kjente, tidligere dokumenterte
  flakete testhygiene i den delte, aldri ryddede sandkasse-databasen —
  IKKE forårsaket av denne endringen, en `magic-link.ts`-fiks kan
  logisk ikke påvirke en digest-test). Kjørt TO påfølgende ganger til
  for å bekrefte: begge 100 % grønne (317/317).
- Empirisk før/etter-verifisering: 3/3 deterministiske feil (8-10
  tokens) mot koden før fiksen, 3/3 grønne kjøringer mot fiksen.

### Neste økt

Fortsett samme sveip: er det FLERE steder i kodebasen som burde brukt
`checkRateLimit()` men har sin egen, parallelle tellelogikk? Filene med
`count()`-bruk sjekket så langt: `moderation/requests.ts` (FR-029,
rettet Økt 27), `requests/requests.ts` (samme grense, sjekket samtidig),
`auth/magic-link.ts` (rettet denne runden). IKKE eksplisitt sjekket ennå
for SAMME mønster: `admin/dashboard.ts`, `moderation/journalists.ts`
(brukes der `count()` bare til visning, eller til en grense?),
`digests/digests.ts`, `journalist-inbox/journalist-inbox.ts` (så langt
antatt rene visningstellinger, ikke grense-håndhevelse, men ikke
eksplisitt dobbeltsjekket linje for linje).

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

**Tillegg samme økt**: fullførte `count()`-sveipen fra egen "Neste
økt"-liste over. Sjekket de fire gjenstående filene —
`admin/dashboard.ts`, `moderation/journalists.ts`, `digests/digests.ts`,
`journalist-inbox/journalist-inbox.ts` — linje for linje. ALLE er rene
VISNINGSTELLINGER (dashboard-nøkkeltall, "tidligere forespørsler"-tallet
i journalistlisten, leveransestatus-fordeling per digest,
kontaktforespørsel-summen i svarinnboksen): ingen av dem etterfølges av
en skriving som en (for lav) telling kunne latt gjennom. Dette lukker
`count()`-sveipen helt — de to reelle funnene i natt (FR-029, Økt 27;
innloggingslenkens hastighetsgrense, Økt 28) er nå bekreftet å være de
ENESTE to stedene i kodebasen der en tellingsbasert grense faktisk
håndheves uten en databasebegrensning bak seg. Ingen kodeendring.

## Økt 29: sveip for uhåndterte unike-constraint-krasj — ingen nye funn, sannsynligvis uttømt for i natt

Fortsatte med en beslektet, men litt annerledes sjekk enn kappløps- og
FK-sveipene: er det NOEN `INSERT`-steder som skriver til en UNIKT
begrenset kolonne uten å fange en potensiell `23505`
(unik-constraint-brudd) via `isUniqueViolation()` — samme klasse feil
som tidligere i natt (økt 7-tiden) ble funnet og rettet i
`createCountry()`/`assignModeratorToCountry()`, men denne gangen lette
jeg systematisk etter GJENSTÅENDE, ikke-verifiserte tilfeller.

Listet opp samtlige `.unique()`/`uniqueIndex()`-kolonner i `schema.ts`
(11 stykker) og krysset dem mot de faktiske INSERT-stedene:

- `users.email`: `registerRecipient()`/`applyAsJournalist()` fanger
  begge allerede `isUniqueViolation()` → `errors.email_already_registered`
  (bekreftet — dekket av task #89s tidligere gjennomlesing).
- `requests_slug_idx`: `updateDraft()` allerede rettet (task #64).
  `createDraft()` selv setter ALDRI en slug (feltet er nullable og
  forblir tomt til `updateDraft()` — bekreftet ved lesing, ingen risiko
  der i det hele tatt).
- `contact_requests.response_id`: `createContactRequest()` fanger
  allerede `isUniqueViolation()` → `errors.contact_request_already_sent`
  (bekreftet tidligere i natt, Økt 27s tillegg).
- `digests_country_scheduled_for_idx` og
  `digest_deliveries_digest_user_idx`: begge håndtert med
  `onConflictDoNothing()` i `tick.ts` (den første) — og for den andre,
  `retryFailedDigestDeliveries()` (`digests/digests.ts`) setter ALDRI inn
  en NY `DigestDelivery`-rad i det hele tatt, bare en atomisk
  `UPDATE ... WHERE status='failed'` på en EKSISTERENDE rad (samme
  gjennomgang som bekreftet TOCTOU-fiksen fra task #50 fortsatt står seg)
  — ingen ny INSERT betyr ingen unik-constraint-risiko å snuble i.
- `suppressions.email_hash`: bekreftet tidligere i natt, alle tre
  stedene (`unsubscribe.ts`, `email-events.ts`,
  `moderation/users.ts` sin `suppressUserEmail()`) bruker allerede
  `onConflictDoNothing()`.
- `auth_tokens.token_hash`/`sessions.token_hash`: genereres av
  `generateToken()` (kryptografisk tilfeldig) — en reell kollisjon her
  er astronomisk usannsynlig, ikke en praktisk kappløpsrisiko å bygge en
  sperre mot.
- `journalist_profiles.user_id`/`email_subscriptions.user_id`: settes
  KUN via de allerede sjekkede registreringsfunksjonene (samme
  try/catch-blokk som fanger `users.email`-krasjet).

**Konklusjon**: ingen gjenstående uhåndterte unik-constraint-krasj
funnet. Sjekket i tillegg (som en liten sidesjekk, siden
`publishRequest()` ble skrevet om denne natten, Økt 27) at selve API-
ruten (`POST /admin/requests/:id/publish`) fortsatt kobler riktig mot
den UENDREDE `ModerationActionResult`-returtypen — ruten videresender
`result.error` generisk via en `statusFor()`-oppslagstabell, uendret av
refaktoreringen (som bare endret den INTERNE implementasjonen, ikke den
offentlige kontrakten). Ingen kodeendring denne runden.

**Ærlig vurdering av natten som helhet**: de fem hovedsporene forfulgt i
natt (kappløp/TOCTOU — Økt 19-23; fremmednøkkel-foreldreløshet ved
hard-sletting — Økt 24-25; lokal-validering — Økt 26; tellingsbaserte
grenser — Økt 27-28; uhåndterte unike-constraint-krasj — denne runden)
har nå alle kjørt til null nye funn i sin siste runde. Dette er ikke
nødvendigvis et signal om at kodebasen er fullstendig feilfri — bare at
disse SPESIFIKKE, systematiske søkemønstrene er uttømt for denne natten.
En fremtidig økt bør vurdere et grunnleggende ANNET perspektiv (f.eks.
en ny brukerreise gjennom selve appen i nettleseren, snarere enn
statisk kodelesning) fremfor å gjenta de samme grep-mønstrene på nytt.

**Tillegg samme økt — fulgte selv opp anbefalingen over i stedet for
bare å skrive den ned**: startet `npm run dev` mot en ekte lokal
Postgres og kjørte to LEVENDE smoke-tester over ekte HTTP, ikke bare
vitest-testkjøring, for kveldens to mest sentrale, nylig omskrevne
funksjoner:

1. **Innloggingslenkens hastighetsgrense** (Økt 28): satte opp en ekte
   mottakerkonto, fyrte 8 SAMTIDIGE `POST /auth/request-link`-kall (via
   ekte parallelle `curl`-prosesser, ikke `Promise.all` i samme
   Node-prosess) mot den kjørende serveren, alle 200 OK (ruten avslører
   aldri rate-grensen — riktig, uendret oppførsel). Telte faktiske
   `auth_tokens`-rader i databasen etterpå: NØYAKTIG 5, aldri mer, til
   tross for i alt 9 forespørsler totalt (1 sekvensiell + 8 samtidige).
   Bekrefter fiksen holder gjennom HELE Next.js-forespørselsløpet, ikke
   bare i den isolerte test-harnessen.
2. **FR-029s 5-grense** (Økt 27): satte opp en ekte journalist med 4
   allerede publiserte forespørsler og 8 nye innsendte, en ekte
   moderator-økt (satt inn direkte i `sessions`-tabellen, samme mønster
   som integrasjonstestenes egen `loginAs()`-hjelper), og fyrte 8
   SAMTIDIGE `POST /admin/requests/:id/publish`-kall via åtte parallelle
   `curl`-prosesser MED en ekte `kb_session`-informasjonskapsel. Resultat:
   NØYAKTIG én `200 {"ok":true}`, de syv andre `422
   {"error":"errors.too_many_published_requests"}` — og en etterfølgende
   database-telling bekreftet nøyaktig 5 publiserte, aldri mer.

Begge smoke-testene ga IDENTISK resultat til de tilsvarende
vitest-integrasjonstestene, men via en helt annen kjørevei (ekte HTTP
mot en ekte kjørende Next.js-server, ekte parallelle OS-prosesser i
stedet for Node sin egen event loop-baserte `Promise.all`) — en
sterkere, mer troverdig bekreftelse enn testsuiten alene, siden den også
verifiserer selve rute-/informasjonskapsel-/sesjonslaget, ikke bare
biblioteksfunksjonene isolert. All testdata (brukere, forespørsler,
økter, revisjonslogger, auth-tokens) ryddet bort umiddelbart etterpå via
et engangsskript (aldri commitet — slettet før denne oppføringen ble
skrevet). Utviklingsserveren stoppet. `git status` bekreftet ingen
gjenværende endringer i selve kodebasen fra denne verifiseringsrunden —
kun denne NATTLOGG-oppføringen.

### Neste økt

Ingen konkret kodeledetråd igjen fra denne nattens systematiske sveiper
ELLER fra smoke-testrunden over (begge bekreftet grønne). Anbefaler
enten (a) en TREDJE kjede å smoke-teste levende hvis en fremtidig økt
vil fortsette samme metode (f.eks. hele
"journalist sender inn → moderator publiserer → mottaker svarer →
journalist ber om kontakt → respondent godkjenner"-kjeden i én
sammenhengende gjennomkjøring, ikke bare de to isolerte punktene testet
her), (b) de tre permanent åpne spec-spørsmålene under, som fortsatt
venter på et menneske, eller (c) at brukeren selv gir en ny retning når
hen våkner.

Ellers uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 30: fulgte opp forrige økts anbefaling (a) — en TREDJE levende
smoke-test-kjede — og fant underveis et reelt, funksjonelt hull: den
delte e-postadressen fra SPEC-V1.md 12.2s direkte delingsvalg ble ALDRI
faktisk vist til journalisten noe sted

Startet der forrige økt sluttet: satte opp `npm run dev` mot ekte lokal
Postgres og bygde en ny testkjede (`scratch-e2e-setup.mjs`, aldri
commitet) med en godkjent journalist, en moderator tildelt
`TEST_COUNTRY_CODE` og en aktiv mottaker, hver med en ekte økt satt inn
direkte i `sessions`-tabellen. Kjørte kjeden steg for steg via ekte
`curl`-kall med `kb_session`-informasjonskapsler: opprettet kladd →
PATCHet med påkrevde felt → sendte inn → moderator publiserte (bekreftet
underveis at FR-025s "offentlig lesbar umiddelbart etter publisering"
holder, via et uautentisert `curl`-kall mot samme forespørsel) →
mottaker sendte inn et svar med `contactSharing: "email"` (SPEC-V1.md
12.2s andre delingsvalg, ordrett "Del e-postadressen min med
journalisten – adressen følger svaret") → journalist listet svarene
(bekreftet `hasSharedEmail: true` vist korrekt, ingen rå adresse lekket
i selve listen — riktig, uendret oppførsel) → journalist åpnet
svardetaljen via `GET /api/journalist/responses/:id`.

**Funn**: svardetalj-JSON-en inneholdt `contactSharing: "email"`, men
INGEN e-postadresse noe sted i responsen. Prøvde det logiske neste
steget i kjeden, `POST /journalist/responses/:id/contact-request`, og
fikk `422 {"error":"errors.contact_already_shared"}` — undersøkte dette
først som et mulig eget hull, men `createContactRequest()`
(`contact-requests.ts`) og SPEC-V1.md 12.2 bekreftet dette ER korrekt,
spec-tro oppførsel (adressen skal allerede være tilgjengelig via den
direkte delingsveien; en egen kontaktforespørsel er overflødig når den
allerede er delt). Det reelle hullet lå et annet sted: sporet gjennom
`getResponseDetailForJournalist()` (`journalist-inbox.ts`) og fant at
funksjonen aldri selekterte eller returnerte respondentens e-post i det
hele tatt — verken der, i "nytt svar mottatt"-varselet
(`email/templates/new-response-received.ts`, lest og bekreftet samme
mangel), eller i selve siden (`journalist/responses/[id]/page.tsx`,
som kun viste en tekstetikett om AT adressen var delt, aldri selve
adressen) eller klientkomponenten (`ResponseDetailPanel.tsx`, lest i
sin helhet — null e-post-relatert kode). Sammenlignet med den ANDRE
delingsveien i kodebasen (en godkjent `ContactRequest.sharedEmail`, se
`getContactRequestDetail()` i `contact-requests.ts`), som håndterer
akkurat samme "vis kun betinget"-mønster korrekt — dette ble
referansemønsteret for fiksen.

**Fiks**, tre filer:
- `src/lib/journalist-inbox/journalist-inbox.ts`: la til
  `sharedEmail: string | null` på `ResponseDetail`, joinet `users` via
  `responses.respondentId` i `getResponseDetailForJournalist()`s
  spørring, populerte betinget (`contactSharing === "email" ?
  respondentEmail : null`) — nøyaktig samme betingelse
  `createContactRequest()` allerede brukte for å avvise en overflødig
  forespørsel.
- `src/app/[locale]/journalist/responses/[id]/page.tsx`: la til et nytt
  avsnitt som viser adressen når `sharedEmail` er satt. Gjenbrukte den
  EKSISTERENDE i18n-nøkkelen `contact_request.shared_email_label`
  ("Delt e-postadresse" / "Shared email address", allerede i bruk i
  `contact-requests/[id]/page.tsx` for samme formål) i stedet for å
  legge til en ny nøkkel.
- `src/lib/journalist-inbox/journalist-inbox.integration.test.ts`: to
  nye tester i `getResponseDetailForJournalist`-blokken — én som
  bekrefter `sharedEmail` er den faktiske adressen når
  `contactSharing="email"`, én som bekrefter `null` når `"none"`.

**Empirisk bekreftet feilen var reell** (samme disiplin som resten av
økten): `git stash push` på de to kildefilene, kjørte de to nye testene
mot den GAMLE koden — begge FEILET som forventet (`sharedEmail` var
`undefined` i begge tilfeller, ikke `respondent.email`/`null`). `git
stash pop` gjenopprettet fiksen, samme to tester kjørt på nytt: begge
BESTOD. Hele testfilen kjørt samlet: 10/10 bestod (8 eksisterende + 2
nye).

Kjeden ble ikke ført videre til respondentens
godkjenn/avslå-kontaktforespørsel-steg denne runden — oppdagelsen av
hullet tok over resten av økten. Den gjenstående delen av kjeden (den
ANDRE delingsveien: en godkjent kontaktforespørsel) er fortsatt utestet
i en levende HTTP-sammenheng og kan være et naturlig neste smoke-test-mål.

All E2E-testdata (journalist, moderator, mottaker, forespørsel, svar,
økter) ryddet bort umiddelbart etter verifiseringen via et engangsskript
(aldri commitet — slettet før denne oppføringen ble skrevet).
Utviklingsserveren stoppet. `git status` bekreftet kun de tre tiltenkte
kildefilene endret, ingen gjenværende testdata-artefakter.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 508 nøkler funnet, alle finnes
  i nb-NO (ingen ny nøkkel lagt til — gjenbrukte en eksisterende).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 319 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger.
- Levende HTTP-smoke-test av selve oppdagelsen og fiksen (se over):
  bekreftet både at feilen var synlig via ekte HTTP før fiksen
  (`GET /api/journalist/responses/:id` manglet adressen) og at
  `git stash`-kontrasten beviste fiksen løser den.

### Neste økt

Naturlig fortsettelse: fullfør den avbrutte kjeden fra denne økten — la
respondenten godkjenne/avslå en kontaktforespørsel via `curl` og
bekreft journalisten mottar adressen gjennom DEN andre veien
(`getContactRequestDetail()`), den eneste av de to delingsveiene som
ennå ikke er smoke-testet levende denne natten. Ellers uendret: de tre
opprinnelige åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 31: generaliserte forrige økts funn til en systematisk sveip — er det
FLERE steder der en backend-funksjon returnerer et felt ingen side noensinne
viser? Fant én til: `geographicNote` (SPEC-V1.md 9.1, "kun visning") ble
hentet av `getPublicRequest()`, men aldri vist på selve den offentlige
forespørselssiden

Fremfor å fortsette den avbrutte E2E-kjeden fra forrige økt (respondentens
godkjenn/avslå-sti, som allerede har grundig, direkte testdekning i
`contact-requests.integration.test.ts` — lav forventet gevinst av enda en
smoke-test der), generaliserte jeg heller selve BUGKLASSEN forrige økt fant:
en side som kaller en `get*`/`list*`-funksjon fra `src/lib/**`, der
funksjonens returtype har et felt som aldri faktisk leses noe sted i siden
eller dens barnekomponenter — data beregnet og returnert av
forretningslogikken, men stille mistet før det når brukeren. Delegerte en
grundig gjennomgang av alle 15 `page.tsx`-filer som kaller en slik funksjon
til en agent (les-only, ingen filendringer), som sammenlignet hver
returtype/interface mot faktisk JSX-bruk gjennom hele render-treet.

**Funnet som traff bugklassen mest presist**: `geographicNote` i
`getPublicRequest()` (`src/lib/requests/requests.ts:532`) — SPEC-V1.md 9.1
sier ORDRETT om feltet: "Geografisk område | valgfritt fritekst, **kun
visning** | 100 tegn". Feltets ENESTE formål ifølge spec-en er å bli vist.
Det ER korrekt lagret, korrekt redigerbart (`RequestEditForm.tsx`), og
korrekt vist i sammendrags-e-posten (`src/lib/email/digest.ts:89-91`, som
en dempet linje rett under tittelen) — men den offentlige
forespørselssiden (`foresporsler/[id]/[slug]/page.tsx`), stedet der "kun
visning" faktisk skulle bety noe, viste den aldri. Samme mønster som
Økt 30s `sharedEmail`-hull: logikken/datalaget var riktig hele veien,
kun visningen manglet ett sted.

**Fiks**: la til en dempet linje rett under byline-avsnittet i
`foresporsler/[id]/[slug]/page.tsx`, gjenbrukte `styles.byline` (samme
visuelle vekt som `digest.ts` sin `geoLine`) med `lang={request.contentLanguage}`
— samme mønster som resten av sidens innholds-tagging (summary/description/
target_person_description har alle allerede `lang`-attributtet). Ingen ny
i18n-nøkkel nødvendig — feltet er ren fritekst uten etikett, akkurat som i
e-postmalen. Styrket også `requests.integration.test.ts`s eksisterende
`getPublicRequest`-testsuite med én ny påstand: at `geographicNote` faktisk
ruller gjennom uendret (datalaget var allerede riktig, men ingen test
bekreftet det eksplisitt før nå).

**Verifisering var annerledes enn Økt 30s stash-kontrast**: siden selve
BACKEND-funksjonen aldri var buggy her (bare siden), ville en
stash-basert før/etter-test på `getPublicRequest()` bestått uansett — det
ville bevist ingenting om selve visningsfeilen. Kjørte i stedet en direkte
levende HTML-sjekk: startet `npm run dev`, opprettet en ekte publisert
testforespørsel med `geographicNote: "Bergen og omegn"`, hentet den
faktiske HTML-en via `curl` og bekreftet strengen dukker opp i selve det
gjengitte markup-et (`<p class="page_byline__..." lang="nb-NO">Bergen og
omegn</p>`), ikke bare i Next sin RSC-hydreringspayload (som forventet
dukket strengen opp TO ganger i rå HTML — én gang i selve markup-et, én
gang i hydreringsdataene bakerst i dokumentet; begge korrekte, ingen
duplisering i det faktiske synlige innholdet).

Sveipen fant også flere ANDRE kandidater av samme bugklasse, med lavere
prioritet enn `geographicNote` (ingen av dem rettet denne runden):
- `countryCode` mangler i visningen av admin/moderator-lister som KAN vise
  flere land samtidig (`admin/digests`, `admin/journalists`,
  `admin/recipients`) — reelt, men uten praktisk konsekvens ennå siden bare
  ett land (`NO`) er aktivt og fortsatt `draft` (26.1); blir en reell feil
  den dagen land nummer to legges til og en administrator ser en blandet
  liste uten landmerking. Samme utsettelsesbegrunnelse som
  retensjonsjobbens hardkodede per-land-konstanter (se filens egen
  kommentar, økt 5) — ikke rettet nå av samme grunn.
- `responseDeadline` fra `listActiveRequests()` brukes til tidssoneoppslag
  i `admin/requests/page.tsx`, men vises aldri som en frist-etikett i selve
  den publiserte/aktive-seksjonen — moderator kan ikke se en publisert
  forespørsels frist herfra, til tross for at dashbordets
  `expiringSoonCount` eksisterer nettopp for å flagge forespørsler nær
  fristen. Reell, men lavere alvorlighet enn `geographicNote` (ingen
  eksplisitt "kun visning"-spec-setning å vise til).
- `MyProfileView.role` (`src/lib/me/profile.ts`) velges fra databasen, men
  leses aldri av noen kaller — siden forgrener seg på `session.role` i
  stedet. Motsatt av de andre funnene: ikke et manglende-visning-hull, bare
  død kode uten funksjonell konsekvens (`session.role` dekker det samme).

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 508 nøkler funnet, alle finnes i
  nb-NO (ingen ny nøkkel — feltet vises uten etikett, som i e-postmalen).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 320 tester
  (319 + 1 ny), alle bestod — kjørt TO ganger for stabilitet, identisk
  resultat begge ganger.
- Levende HTML-sjekk (se over): bekreftet strengen faktisk dukker opp i
  det gjengitte markup-et, ikke bare i testdataene.

All testdata (journalist, forespørsel) ryddet bort umiddelbart etter
verifiseringen via et engangsskript (aldri commitet — slettet før denne
oppføringen ble skrevet). Utviklingsserveren stoppet. `git status`
bekreftet kun de to tiltenkte kildefilene endret.

### Neste økt

Naturlig fortsettelse, i prioritert rekkefølge: (a) vurder om
`countryCode`-visningshullet i admin/moderator-listene (digests,
journalists, recipients) bør rettes NÅ eller fortsatt utsettes til land
nummer to faktisk legges til — samme avveining som retensjonsjobbens
TODO; (b) vurder `responseDeadline`-visningshullet i
`admin/requests/page.tsx`s aktive-seksjon; (c) fjern evt. det døde
`MyProfileView.role`-feltet (ren opprydning, ingen funksjonell risiko);
(d) den avbrutte E2E-kjeden fra Økt 30 (respondentens
godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav prioritet gitt
grundig eksisterende testdekning. Ellers uendret: de tre opprinnelige
åpne spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 32: rettet det nest mest alvorlige funnet fra forrige økts sveip —
moderator kunne ikke se en publisert forespørsels svarfrist i
aktive-seksjonen på /admin/requests, til tross for at akkurat samme
dato/tidssone-oppslag allerede fantes rett over den ubrukt

`listActiveRequests()` (`src/lib/moderation/requests.ts:249`) henter
`responseDeadline` for hver rad, men `admin/requests/page.tsx` brukte den
KUN til å slå opp riktig tidssone for `dateFormatter` (delt med
modereringskø-seksjonen rett over) — selve verdien ble aldri formatert
til en etikett og sendt videre til `ActiveRequestItem`. Modereringskø-
seksjonen (`RequestQueueItem`) har nøyaktig samme mønster og gjør det
riktig (`deadlineLabel`-feltet, se `admin.requests.deadline_label`) — bare
noen titalls linjer lenger ned i samme fil brytes mønsteret. En moderator
som vurderer om en publisert forespørsel bør lukkes (SPEC-V1.md 16.2,
`POST /admin/requests/:id/close`) hadde ingen måte å se fristen på fra
denne listen, til tross for at dashbordets `expiringSoonCount` eksisterer
nettopp for å flagge forespørsler nær fristen (`admin/dashboard.ts`).

**Fiks**: speilet `RequestQueueItem`s eksisterende
`deadlineLabel`-mønster inn i aktive-seksjonen — la til `deadlineLabel`
på `ActiveRequestItemData`-interfacet (`ActiveRequestItem.tsx`), bygget
etiketten i `page.tsx` med samme `dateFormatter`/`t("admin.requests.deadline_label", ...)`-
kall som allerede fantes for køen, og la til en betinget
`<span className={styles.meta}>`-linje i komponentens render, rett under
`publishedAtLabel`. Ingen ny i18n-nøkkel — gjenbrukte den eksisterende
`admin.requests.deadline_label`.

**Empirisk bekreftet feilen var reell**: la til en eksplisitt påstand i
`ActiveRequestItem.test.tsx` (`expect(screen.getByText("Svarfrist: ..."))
.toBeInTheDocument()`), `git stash push` på de to kildefilene (beholdt
kun testfilen), kjørte testen mot den GAMLE komponenten — feilet nøyaktig
som forventet (elementet fantes ikke i DOM-en). `git stash pop`
gjenopprettet fiksen, samme test kjørt på nytt: bestod. Hele testfilen:
4/4 bestod (3 eksisterende + den styrkede påstanden i den første).

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 509 kall-steder funnet (508 → 509,
  ÉN ekstra forekomst av den allerede eksisterende
  `admin.requests.deadline_label`-nøkkelen, ikke en ny nøkkel — scriptet
  teller kall-steder, ikke unike nøkler; bekreftet ved å sammenligne mot
  samme sjekk kjørt uten disse endringene, som ga 508).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 320 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger.
- Empirisk git-stash-kontrast (se over): bekreftet feilen var reell før
  fiksen, og at fiksen løser den.

### Neste økt

Naturlig fortsettelse, i prioritert rekkefølge: (a) vurder om
`countryCode`-visningshullet i admin/moderator-listene (digests,
journalists, recipients) bør rettes NÅ eller fortsatt utsettes til land
nummer to faktisk legges til — samme avveining som retensjonsjobbens
TODO; (b) fjern evt. det døde `MyProfileView.role`-feltet (ren
opprydning, ingen funksjonell risiko); (c) den avbrutte E2E-kjeden fra
Økt 30 (respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE,
men lav prioritet gitt grundig eksisterende testdekning; (d) vurder om
det er verdt å utvide "felt-vs-visning"-sveipen til IKKE-side-filer også,
f.eks. e-postmaler som IKKE ble sjekket i forrige økts sveip (kun
`page.tsx`-filer ble gjennomgått). Ellers uendret: de tre opprinnelige
åpne spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 33: ren opprydning fra forrige økts sveip — fjernet det døde
`role`-feltet fra `MyProfileView`

Forrige økts felt-vs-visning-sveip (Økt 30/31, task #99) fant to reelle
manglende-visning-hull (`sharedEmail`, `geographicNote`) og ett ANNET
mønster: `getMyProfile()` (`src/lib/me/profile.ts`) velger `users.role`
inn i `MyProfileView.role`, men verken `me/page.tsx` eller
`me/bytt-land/page.tsx` — de eneste to kallerne — leser den noensinne;
begge forgrener seg på `session.role` fra økt-laget i stedet. Motsatt av
de to forrige funnene: ikke et manglende-visning-hull (feltet var aldri
ment å bli vist et sted det ikke ble), bare død vekt uten funksjonell
konsekvens. Bekreftet ved å grep'e alle `profile.`-tilgangar i begge
sidene — ingen `.role` noe sted.

**Fiks**: fjernet `role` fra `MyProfileView`-interfacet, fra
`getMyProfile()`s spørring, og den tilsvarende påstanden i
`profile.integration.test.ts`. Ingen andre kallere finnes (bekreftet med
et prosjektomfattende søk etter `getMyProfile`) — trygg fjerning, ingen
funksjonell endring.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 85 filer, 441 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 509 kall-steder funnet, alle
  finnes i nb-NO (uendret fra forrige økt, ingen i18n-berøring her).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 320 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger.

### Neste økt

Gjenstående kandidater fra Økt 31s sveip, i prioritert rekkefølge: (a)
vurder om `countryCode`-visningshullet i admin/moderator-listene
(digests, journalists, recipients) bør rettes NÅ eller fortsatt utsettes
til land nummer to faktisk legges til — samme avveining som
retensjonsjobbens TODO (`src/lib/jobs/retention.ts`); (b) den avbrutte
E2E-kjeden fra Økt 30 (respondentens godkjenn/avslå-sti) er fortsatt
utestet LEVENDE, men lav prioritet gitt grundig eksisterende
testdekning; (c) vurder om det er verdt å utvide "felt-vs-visning"-
sveipen til IKKE-side-filer også (e-postmaler, PDF-/eksport-generering
om noen finnes) — kun `page.tsx`-filer ble gjennomgått i Økt 31. Ellers
uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt bevisst
latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 34: utvidet felt-vs-visning-sveipen til e-postmalsystemet (Neste
økt-punkt fra Økt 33) — fant et betydelig STØRRE hull enn de forrige to:
hele UI-en for SPEC-V1.md 16.2s "åpne et enkeltsvar med begrunnelse"
manglet fullstendig, ikke bare ett felt

Delegerte en gjennomgang av alle 23 filer i `src/lib/email/templates/`
til en agent (les-only), som sammenlignet hver mals data-parameter mot
både selve rendringen og alle kallesteders `data`-objekter via
`send.ts`s dispatch-switch. Fant to kandidater: `content-reported.ts`
(alvorlig — se under) og en svakere kandidat i
`new-request-for-moderation.ts` (`requestId` sendes med, men brukes ikke
— vurdert lav prioritet siden modereringskøen allerede lister ALLE
ventende forespørsler etter tittel, ingen egen detaljrute mangler der,
ulikt svar-tilfellet under).

**Det alvorlige funnet**: `submitReport()` (`src/lib/reports/reports.ts`)
sender `entityId` i `data`-objektet til `content_reported`-malen, men
`send.ts`s dispatch-case for `content_reported` plukket kun ut
`{entityType, reason, comment}` — `entityId` ble aldri lest, og
`renderContentReportedEmail()`s signatur hadde ikke engang et parameter
for den. Lenken i e-posten pekte derfor ALLTID til den generiske
modereringskøen (`/admin/requests`), uansett om det rapporterte
innholdet var en forespørsel ELLER et svar.

For en rapportert FORESPØRSEL er dette ufarlig (køen lister alle
innsendte forespørsler, moderator finner den uansett). For et rapportert
SVAR er det et reelt, alvorlig hull: SPEC-V1.md 16.2 sier ORDRETT "Det
finnes ingen visning som lister svar på tvers av forespørsler" — og
siden rapporter ikke har noen egen datamodell i v1 (25, punkt 10;
`submitReport()` er ren e-postvarsling, lagrer ingenting), var
e-postens lenke den ENESTE veien en moderator noensinne kunne finne frem
til det rapporterte svaret. Gravde videre og fant et enda dypere hull:
sporet gjennom til `GET /admin/responses/:id?reason=...`
(`src/lib/admin/responses.ts`, `getResponseForAdmin()`) — funksjonen
(begrunnelseskrav fra en lukket firevalgsliste, revisjonslogging FØR
returnering, FR-051s administrator-only-krav) og selve API-ruten fantes
allerede og var korrekt bygget og testet, men **INGEN side i hele
`src/app/[locale]/` noensinne lot en administrator faktisk BRUKE den**.
16.2 sier ordrett "Åpning av et enkeltsvar FRA ADMINISTRASJONSGRENSE-
SNITTET krever ..." — spec-en forutsetter eksplisitt en UI-flyt, ikke
bare et API-endepunkt. Selv om e-postlenken hadde pekt riktig sted fra
starten, ville moderatoren likevel landet på en side som ikke fantes.

**Fiks, i to lag**:

1. **Bygget selve manglende siden**, `src/app/[locale]/admin/responses/[id]/`:
   - `page.tsx`: administrator-only (redirect ellers, samme mønster som
     `admin/countries/page.tsx`). Leser `?reason=` fra URL-en (samme
     "URL-en ER tilstanden"-mønster som `admin/recipients`s `?email=`-søk
     og `CountrySelector.tsx`s `?country=`-valg) — mangler eller ugyldig
     begrunnelse viser en velger, en gyldig begrunnelse kaller
     `getResponseForAdmin()` direkte (samme konvensjon som resten av
     kodebasen: sider kaller lib-funksjoner direkte, ikke sin egen
     API-rute) og viser hele svaret.
   - `ReasonPicker.tsx`: en `Select` som navigerer via `router.push`,
     speiler `CountrySelector.tsx` ord for ord (samme mønster, ingen egen
     innsendingsknapp — valget ER innsendingen).
   - `HideResponseAction.tsx`: skjul-knapp med ett bekreftende ekstra
     klikk, speiler `ActiveRequestItem.tsx`s mønster, kaller den
     allerede eksisterende `POST /admin/responses/:id/hide`.
   - Ni nye i18n-nøkler under `admin.response_detail.*` i begge språk,
     gjenbruker eksisterende nøkler (`journalist.response_detail.*`,
     `response.form.relevance_label`) der samme tekst allerede fantes.
   - **Byggefeil oppdaget og rettet underveis** (fanget av
     `npx next build`, IKKE av `tsc`/`eslint`/`vitest` — nøyaktig derfor
     bygget er en obligatorisk del av verifiseringskjeden): `ReasonPicker.tsx`
     (klientkomponent) importerte `ADMIN_RESPONSE_ACCESS_REASONS` fra
     `admin/responses.ts`, som drar inn `next/headers` transitivt via
     `requireAdmin()` → `authorize.ts` → `auth/session.ts` — ulovlig i en
     klientkomponent. Løst ved å skille ut selve listen/typen til en ny,
     avhengighetsfri fil (`src/lib/admin/response-access-reasons.ts`),
     som både `admin/responses.ts` (server, re-eksporterer for
     bakoverkompatibilitet) og `ReasonPicker.tsx` (klient) nå importerer
     fra.

2. **Rettet e-postlenken**: `renderContentReportedEmail()` fikk et nytt
   `entityId`-parameter — bygger `/admin/responses/:id` for
   `entityType="response"` (den nye siden), beholder
   `/admin/requests` uendret for `entityType="request"`. `send.ts`s
   dispatch-case oppdatert til å faktisk lese og videresende `entityId`.

**Empirisk bekreftelse**: siden selve funksjonssignaturen endret seg
(ikke bare et stille mistet felt i en uendret signatur, som Økt 30/31),
var en ren `git stash`-kontrast på KUN kildefilene ikke meningsfull mot
de NYE testkallene (feil posisjonelle argumenter mot gammel signatur).
I stedet: kjørte de to nye testene i `send.test.ts` (som kaller
`sendTransactionalEmail()` — den STABILE, uendrede offentlige grensesnitt-
funksjonen, ikke selve malen direkte) mot den gamle `send.ts`/
`content-reported.ts` via `git stash` — begge feilet nøyaktig som
forventet (den første fordi lenken pekte til køen i stedet for svaret,
den andre fordi den gamle koden aldri krevde `entityId` og derfor rendret
vellykket i stedet for å falle tilbake til stubb-formatet). `git stash pop`
gjenopprettet fiksen, begge testene bestod.

Deretter en FULL levende HTTP-smoke-test av selve den nye siden (ikke
bare enhetstester): satt opp en ekte administratorkonto, en publisert
forespørsel og et innsendt svar med `contactSharing: "email"`. Bekreftet
via `curl` med en ekte `kb_session`-informasjonskapsel: (1) siden UTEN
`?reason=` viser velgeren; (2) siden MED en gyldig begrunnelse viser
hele svarinnholdet (relevans, svartekst, delt-e-post-notis, status
"Aktivt", skjul-knapp); (3) en direkte database-spørring bekreftet
revisjonsloggraden ble skrevet MED riktig begrunnelse; (4)
`POST .../hide` satt `lifecycle_status` til `hidden_by_moderator`; (5)
siden lastet på nytt viser nå "Skjult av moderator" og en
"allerede skjult"-notis i stedet for skjul-knappen; (6) selve
e-postmalens genererte lenke ble bekreftet å peke NØYAKTIG til denne
fungerende siden for samme svar-ID.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 448 tester, alle
  bestod (opp fra 85/441 — nye tester i `HideResponseAction.test.tsx`,
  `content-reported.test.ts`, `send.test.ts`).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 kall-steder funnet (opp fra
  509 — ni nye `admin.response_detail.*`-nøkler pluss deres bruk), alle
  finnes i nb-NO.
- `npx next build`: FEILET FØRST (client/server-grensehullet over),
  rettet, bygget deretter uten feil. Bekreftet at
  `/[locale]/admin/responses/[id]` og de to API-rutene er med i
  byggemanifestet.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 320 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger (uendret av denne økten — ingen eksisterende integrasjonstest
  berørt).
- Empirisk git-stash-kontrast på `send.test.ts`s to nye tester (se
  over): begge feilet mot gammel kode, begge bestod med fiksen.
- Full levende HTTP-smoke-test av hele den nye siden og hele kjeden fra
  e-postlenke til fungerende UI (se over) — all testdata ryddet bort
  umiddelbart etterpå via engangsskript (aldri commitet), utviklings-
  serveren stoppet, `git status` bekreftet ingen gjenværende
  testdata-artefakter.

### Neste økt

Gjenstående kandidater, i prioritert rekkefølge: (a) den svakere
`new-request-for-moderation.ts`-`requestId`-kandidaten fra denne øktens
sveip — vurdert lav prioritet, men ikke undersøkt i dybden; (b)
`request-rejected.ts`s manglende forespørselstittel i selve
avvisnings-e-posten (agenten bemerket dette som et mindre, beslektet
funn — en journalist med flere innsendte forespørsler får en
avvisnings-e-post uten noen tittel å knytte den til, kun moderatorens
begrunnelse); (c) `countryCode`-visningshullet i admin/moderator-listene
(digests, journalists, recipients), fortsatt bevisst utsatt til land
nummer to faktisk legges til; (d) den avbrutte E2E-kjeden fra Økt 30
(respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav
prioritet gitt grundig eksisterende testdekning. Ellers uendret: de tre
opprinnelige åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 35: fulgte opp forrige økts svakere kandidat (b) — `request_rejected`-
e-posten manglet forespørselens tittel, den eneste identifikatoren en
journalist med flere samtidig innsendte forespørsler ville hatt

`rejectRequest()` (`src/lib/moderation/requests.ts`) henter alltid
`request.title` via `findSubmitted()` (samme rad-oppslag som
`publishRequest()` bruker, som ALLEREDE sender `title` videre til sin
egen e-post), men `rejectRequest()`s eget `notifyJournalist()`-kall sendte
kun `{ requestId, reason }` — tittelen ble aldri sendt med.

Denne malen har (bevisst, 9.2: avvisning er endelig) INGEN CTA-lenke å
disambiguere med, ulikt `changes_requested` (som har en direkte lenke til
akkurat den redigerbare forespørselen — derfor uproblematisk uten tittel
i selve teksten). Bekreftet at scenariet er reelt nåbart: det finnes
 INGEN grense på antall samtidig `submitted` (kun ventende) forespørsler
en journalist kan ha — FR-029s 5-grense gjelder utelukkende `published`.
En journalist med to eller flere forespørsler til vurdering samtidig
ville dermed fått en avvisnings-e-post som bare sa "Forespørselen din er
dessverre ikke godkjent for publisering. Begrunnelse: ..." — ingen måte
å se HVILKEN.

**Fiks**: la til `title`-parameter på `renderRequestRejectedEmail()`,
interpolert i teksten med samme «guillemets»-mønster som
`request_approved_published` allerede bruker (`«{title}»`), i begge
språk. `send.ts`s dispatch-case for `request_rejected` oppdatert til å
kreve og videresende `title`. `rejectRequest()`s `notifyJournalist()`-kall
utvidet med `title: request.title` — dataen var allerede i scope, ren
videresending.

**Empirisk bekreftet feilen var reell** (samme metode som Økt 34, siden
signaturen endret seg — en ren stash-kontrast på selve malfunksjonen
ville ikke vært meningsfull mot nye testkall med feil posisjonelle
argumenter): to nye tester i `send.test.ts`, som kaller den STABILE,
uendrede `sendTransactionalEmail()`-grensesnittfunksjonen. `git stash`
på kildefilene (beholdt testfilene), begge nye tester feilet mot den
gamle koden nøyaktig som forventet (tittelen manglet i den loggede
teksten; den andre testen feilet fordi gammel kode aldri krevde `title`
og derfor rendret vellykket i stedet for å falle tilbake). `git stash pop`
gjenopprettet fiksen, begge bestod.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod (opp fra 448 — tre nye tester i `send.test.ts` og
  `request-rejected.test.ts`).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 kall-steder funnet
  (uendret — ingen ny nøkkel, kun endret tekst på en eksisterende).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 320 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger (`moderation/requests.integration.test.ts`s eksisterende
  `rejectRequest()`-test, som kun sjekker at loggmeldingen inneholder
  strengen "request_rejected", uendret upåvirket).
- Empirisk git-stash-kontrast (se over): begge nye tester feilet mot
  gammel kode, begge bestod med fiksen.

### Neste økt

Gjenstående kandidater, i prioritert rekkefølge: (a) den svakere
`new-request-for-moderation.ts`-`requestId`-kandidaten fra Økt 34s
sveip — modereringskøen lister allerede alle ventende forespørsler etter
tittel, så dette er trolig lav prioritet, men ikke undersøkt i dybden
ennå; (b) `countryCode`-visningshullet i admin/moderator-listene
(digests, journalists, recipients), fortsatt bevisst utsatt til land
nummer to faktisk legges til; (c) den avbrutte E2E-kjeden fra Økt 30
(respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav
prioritet gitt grundig eksisterende testdekning. Ellers uendret: de tre
opprinnelige åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 36: undersøkte forrige økts svakere kandidat (a) — `requestId` i
`new-request-for-moderation.ts` er bevisst død vekt, IKKE et hull —
men undersøkelsen avdekket noe mer verdifullt: `submitRequest()` hadde
INGEN testdekning noe sted i kodebasen

Leste `renderNewRequestForModerationEmail()` og fant at filens egen
kommentar allerede forklarer NØYAKTIG hvorfor `requestId` ikke brukes:
"Lenker til modereringskøen (/admin/requests), IKKE til en egen
detaljside for forespørselen — det finnes ingen slik rute, køen viser og
behandler forespørslene direkte." Dette er en bevisst, riktig
dokumentert designbeslutning — ikke samme bugklasse som Økt 30/31/34/35s
funn (data beregnet men aldri vist). Ingen kodeendring nødvendig her.

Gravde likevel videre i kalleren (`submitRequest()`,
`src/lib/requests/requests.ts`) for å bekrefte `requestId`s status som
død vekt, og fant i prosessen at funksjonen — som håndhever
eierskap/redigerbarhet, journalistgodkjenning (`verificationStatus`),
full feltvalidering (`validateForSubmit()`), FR-029s tidlige 5-grense-
sjekk, OG varsler alle moderatorer tildelt landet — ikke hadde EN ENESTE
test noe sted, verken direkte eller indirekte (bekreftet med et
prosjektomfattende søk etter `submitRequest`). Samme kategori som
tidligere økters "Add integration tests for..."-oppgaver (#17-23, #81).

**Lagt til**: en ny testblokk i `requests.integration.test.ts` med seks
tester som dekker `submitRequest()`s fulle feilrom: `errors.not_found`
(ikke-eier), `errors.request_not_editable` (allerede submitted),
`errors.not_authorized` (journalist med `verificationStatus:
"pending_review"`), `errors.validation_failed` med `fieldErrors`
(tomt utkast), `errors.too_many_published_requests` (FR-029s tidlige
sjekk — journalisten har allerede 5 publiserte), og selve
lykkeveien (status → `submitted`, ALLE moderatorer tildelt landet
varslet med `new_request_for_moderation`).

**Test-hygienefeil oppdaget og rettet underveis** (før commit, ikke en
egen separat runde): de første versjonene av disse testene ryddet ikke
opp etter seg — testforespørslene FR-029-testen oppretter (5 stk), OG
særlig moderatoren+`moderatorCountries`-raden lykkeveitesten oppretter,
ble aldri slettet. Kjørte testfilen flere ganger under utvikling og
observerte selv konsekvensen: stadig FLERE moderator-e-poster i loggen
for hver kjøring — et konkret bevis på akkurat det andre describe-
blokker i SAMME fil allerede unngår med `try/finally`-opprydding
(se `createDraft — hastighetsgrense` og
`updateDraft() — slug-genereringen` lenger opp i filen). Rettet ved å
legge til `try/finally` rundt hver test som sletter egne opprettede
`requests`/`moderatorCountries`/`users`-rader, matchet mot filens
etablerte mønster. Ryddet også bort de allerede opphopede radene fra
utviklingsrundene via et engangsskript (aldri commitet), og bekreftet
0 gjenværende rader både før OG etter en full kjøring av HELE
integrasjonstestpakken.

**Sidefunn, ikke rettet denne runden**: `moderation/requests.integration.test.ts`s
egen `createModerator()`-hjelpefunksjon (brukt av mange eksisterende
tester i DEN filen) rydder ALDRI opp sine egne moderator-/
`moderatorCountries`-rader — kun forespørsler ryddes i dens `afterEach`.
Dette er en pre-eksisterende hygienemangel i en ANNEN fil, oppdaget som
en bivirkning av å observere gjentatte "moderator-*"-e-postadresser i
loggen under denne øktens utvikling — ikke noe MIN nye kode skapte, og
utenfor denne øktens avgrensede oppgave å rette.

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod (uendret — nye tester ligger i en `.integration.test.ts`-fil,
  utenfor denne pakken).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 kall-steder funnet
  (uendret — ingen i18n-berøring denne runden).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 326 tester
  (320 + 6 nye), alle bestod — kjørt TO ganger for stabilitet, identisk
  resultat begge ganger.
- Bekreftet 0 gjenværende testdata-rader (`moderator-for-submit%`-prefiks)
  både rett etter denne øktens egne tester OG etter en full kjøring av
  HELE integrasjonstestpakken (andre filers tester rører ikke disse
  radene).

### Neste økt

Gjenstående kandidater, i prioritert rekkefølge: (a) den nyoppdagede
opprydningsmangelen i `moderation/requests.integration.test.ts`s
`createModerator()`-hjelpefunksjon (se over) — lav alvorlighet (påvirker
kun testdatabasens størrelse over tid, ingen produksjonskonsekvens),
men brytert filens eget etablerte mønster; (b) `countryCode`-
visningshullet i admin/moderator-listene (digests, journalists,
recipients), fortsatt bevisst utsatt til land nummer to faktisk legges
til; (c) den avbrutte E2E-kjeden fra Økt 30 (respondentens
godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav prioritet gitt
grundig eksisterende testdekning. Ellers uendret: de tre opprinnelige
åpne spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 37: rettet forrige økts oppdagede opprydningsmangel i
`moderation/requests.integration.test.ts`s `createModerator()` — fant
underveis at samme mønster er MYE mer utbredt enn antatt: 3599 opphopede
testrader i databasen, og ni ANDRE testfiler med nøyaktig samme hull

`createModerator()` (brukt fra 16 kallesteder på tvers av tre
describe-blokker i denne filen) oppretter en `users`-rad OG en
`moderatorCountries`-rad, men INGEN av blokkenes egne `afterEach`-hooks
rydder opp i dem — kun forespørslene de opererer på slettes. Kjørte et
diagnoseskript FØR fiksen: **3599** moderator-prefiksede testbrukere lå
allerede i databasen, opphopet gjennom natten fra gjentatte kjøringer av
denne ene filen alene.

**Fiks**: lagt til et modul-scopet `createdModeratorIds`-array som
`createModerator()` (og den ene rå-innsatte "unassignedModerator"-testen)
pusher til, og ÉN samlet `afterAll` nederst i filen (kjører etter ALLE
describe-blokkene, ikke bare én) som rydder alle radene disse
moderatorene noensinne har fått: `auditLogs` (moderatorenes egne
publiser/avvis/lukk-handlinger logger `actorUserId`), `sessions`
(`loginAs()` setter inn en økt for noen av dem), `moderatorCountries`,
og til slutt `users` — i den rekkefølgen, siden `users.id` ikke har
kaskadesletting noe sted (`references()` uten `onDelete`).

**Fanget en feil i egen fiks underveis**: første forsøk på `afterAll`
glemte `auditLogs`-slettingen og krasjet med nøyaktig samme fremmednøkkel-
brudd revisjonslogging alltid gir når den ikke er tenkt på (samme
klasse feil som `purgeRejectedJournalistApplications()` hadde, Økt 24,
og `performAccountDeletion()`, Økt 25). Rettet før commit.

**Empirisk verifisert reelt løst**: kjørte testfilen to ganger på rad
etter fiksen og bekreftet 0 gjenværende moderator-prefiksede rader begge
ganger (mot 3599 FØR). Ryddet også bort de 3599 opphopede radene fra
FØR fiksen via et engangsskript (måtte i tillegg nulle ut
`journalist_profiles.reviewed_by` og slette tilhørende `auditLogs`-rader
for disse — samme fremmednøkkel-avhengigheter som selve fiksen måtte
håndtere).

**Betydelig sidefunn**: kjørte HELE integrasjonstestpakken (326 tester)
og målte 98 NYE moderator-prefiksede rader etterpå — fra NI andre
testfiler (`admin/legal-documents`, `admin/responses`, `auth/authorize`,
`digests/digests`, `moderation/journalists`, `moderation/responses`,
`moderation/users`, `reports/reports`, `requests/requests`) som alle
bruker samme `uniqueTestEmail("moderator...")`-mønster og
sannsynligvis samme opprydningshull. Ryddet bort disse 98 radene også
(samme engangsskript-mønster), men rettet IKKE selve de ni filene denne
runden — en betydelig større jobb enn denne øktens avgrensede oppgave,
og fortjener sin egen runde med samme grundighet (verifisere HVER fils
faktiske mønster, ikke anta de er identiske).

### Verifisert før commit (denne runden)

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod (uendret — denne filen er integrasjonstest, utenfor pakken).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 kall-steder funnet
  (uendret — ingen i18n-berøring).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): 32 filer, 326 tester,
  alle bestod — kjørt TO ganger for stabilitet, identisk resultat begge
  ganger. Bekreftet 0 nye moderator-prefiksede rader etter denne kjøringen
  fra DENNE filens tester (de 98 fra de ni ANDRE filene ble ryddet bort
  manuelt, uendret av min kode).
- Direkte kjøring av kun denne testfilen, to ganger på rad: 21/21 bestod
  begge ganger, 0 gjenværende rader begge ganger (mot 3599 FØR fiksen).

### Neste økt

Gjenstående kandidater, i prioritert rekkefølge: (a) **samme
opprydningsmønster i de ni andre testfilene** som ble oppdaget denne
runden (se over) — en dedikert runde bør gå gjennom hver fil for seg,
siden mønstrene kan variere (noen bruker kanskje allerede delvis
opprydning); (b) `countryCode`-visningshullet i admin/moderator-listene
(digests, journalists, recipients), fortsatt bevisst utsatt til land
nummer to faktisk legges til; (c) den avbrutte E2E-kjeden fra Økt 30
(respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav
prioritet gitt grundig eksisterende testdekning. Ellers uendret: de tre
opprinnelige åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 38: fulgte opp forrige økts prioritet (a) — samme
`createModerator()`-opprydningshull i de resterende testfilene Økt 37
fant, men ikke rakk å rette

Gikk gjennom hver av de ni filene Økt 37 identifiserte, ETT ETT, og
verifiserte hvert fils faktiske mønster i stedet for å anta de var
identiske — akkurat slik forrige økts "Neste økt"-notat ba om. Fant at
mønsteret varierte mer enn ventet, og at søket etter "alle berørte
filer" måtte gjøres i stadig bredere omganger:

1. **Literal-substreng-søk** (`uniqueTestEmail("moderator`) fanget
   `auth/authorize.ts`, `digests/digests.ts`, `moderation/journalists.ts`,
   `moderation/responses.ts`, `moderation/users.ts`,
   `admin/legal-documents.ts`, `admin/responses.ts` — 7 filer.
2. **Søk etter dynamiske kall** (`uniqueTestEmail(...)` UTEN literal
   streng) fant en åttende: `admin/countries.ts` bruker
   `uniqueTestEmail(role)` der `role` er en parameter — usynlig for
   søk 1.
3. **Bredt søk på `role: "moderator"`** (uavhengig av
   `uniqueTestEmail`) fant to til: `admin/dashboard.ts` (prefiks
   `"dashboard-moderator"`/`"dashboard-unassigned-moderator"`) og
   `auth/session.ts` (rå template-strenger,
   `` `session-moderator-${Date.now()}@example.invalid` ``, ingen
   hjelpefunksjon i det hele tatt).
4. **Direkte DB-spørring** (`SELECT ... WHERE role = 'moderator'`,
   IKKE e-postprefiks-`LIKE`) var det eneste fullt pålitelige målet —
   prefiks-/substreng-grep er ikke til å stole på alene, siden
   testfiler bruker helt ulike, ikke-forutsigbare navnemønstre for
   samme rolle.

Totalt **10 filer** rettet denne runden (ikke 9 — dashboard.ts og
session.ts kom først frem via søk 3, etter at de opprinnelige 9 var
rettet og en ny full-pakke-måling fortsatt viste gjenværende rader).

**Standardfiks** (samme mønster i alle, med tre unntak beskrevet
under): modul-scopet `createdModeratorIds: string[]`, pushet til inne i
`createModerator()` (og ved ethvert rå-innsatt moderator-kallested i
samme fil), og ÉN `afterAll` nederst i filen som sletter i streng
FK-trygg rekkefølge: `journalistProfiles.reviewedBy` → `null` (kun der
moderator-id faktisk skrives dit), `auditLogs.actorUserId`,
`sessions.userId`, `moderatorCountries.moderatorUserId`, `users.id`.

**Filspesifikke avvik fra standardmønsteret**:
- `moderation/journalists.ts`: trengte `journalistProfiles.reviewedBy`
  → `null` FØRST (samme klasse feil som Økt 37 fanget i
  `moderation/requests.ts`) siden `approveJournalist()`/
  `rejectJournalist()` setter dette feltet. Hadde OGSÅ en fjerde,
  separat rå-innsatt "unassigned-moderator"-test i
  `listJournalists`-describe-blokken (linje 335) som IKKE brukte
  `createModerator()`-hjelperen og som jeg først overså i min egen fiks
  av filen — fanget opp igjen ved en siste full-pakke-verifisering (se
  under) som viste 1 gjenværende rad etter alt annet var rettet.
- `admin/legal-documents.ts` og `admin/responses.ts`: enkle,
  isolerte rå-innsatte moderatorer i én test hver — rettet inline med
  `try/finally` i stedet for fil-nivå `afterAll`, siden ingen delt
  hjelpefunksjon fantes.
- `admin/countries.ts`: dynamisk `uniqueTestEmail(role)`-kall i en
  delt `createActiveUser()`-hjelper, pluss tre YTTERLIGERE
  rå-innsatte moderator-kontoer i egne tester (prefiks
  `"ny-moderator"`, `"dobbel-moderator"`, `"samtidig-moderator"`) som
  krevde egne manuelle `push()`-kall.
- `admin/dashboard.ts`: describe-blokk-scopet (ikke fil-scopet)
  `createdModeratorIds`/`afterAll`, siden kun ÉN av flere
  describe-blokker i filen oppretter moderatorer — og ingen
  `auditLogs`/`sessions`-sletting trengtes, siden
  `getDashboardCountries()` er en ren lesefunksjon uten økt.
- `auth/session.ts`: ingen hjelpefunksjon i det hele tatt — to rå
  template-streng-opprettede moderatorer, fil-nivå tracker rett før
  første `describe`.

**Målt effekt**: 566 opphopede `role='moderator'`-rader (registrert
FØR denne runden, på tvers av de da 10 kjente filene) ned til 0 etter
opprydning, deretter **1** gjenværende rad funnet i en etterfølgende
full integrasjonspakke-kjøring (den upassede `listJournalists`-testen i
`moderation/journalists.ts`, se over) — rettet, og bekreftet 0 både FØR
og ETTER i to påfølgende fulle kjøringer av hele integrasjonspakken.

**Falsk alarm underveis**: én kjøring av hele integrasjonspakken viste
1 test feilet (`security/rate-limit`-relatert, ikke identifisert
nøyaktig — output rullet forbi før jeg fikk fanget den eksakte testen).
Kjørte pakken på nytt umiddelbart: 326/326 bestod. Ansett som en
forbigående, tidsavhengig flaks uten sammenheng med denne øktens
endringer (som utelukkende er testopprydning, ingen produksjonskode
rørt) — bekreftet ved to RENE påfølgende kjøringer etterpå.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret (ingen
  i18n-berøring).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, 326
  tester — kjørt FLERE ganger denne runden (én forbigående flaks i en
  urelatert test, se over), avsluttet med TO rene påfølgende kjøringer
  à 326/326 bestått. Bekreftet 0 `role='moderator'`-rader både FØR og
  ETTER hver av de to siste kjøringene.
- Alle 10 filene kjørt enkeltvis under selve rettingen (før
  full-pakke-kjøringen): `auth/authorize.ts` 11/11,
  `digests/digests.ts` 8/8, `moderation/journalists.ts` 13/13 (etter
  siste fiks), `moderation/responses.ts` 7/7, `moderation/users.ts`
  25/25, `admin/legal-documents.ts` 11/11, `admin/responses.ts` 4/4,
  `admin/countries.ts` 19/19, `admin/dashboard.ts` 10/10,
  `auth/session.ts` 15/15.
- Ryddet bort alle midlertidige diagnose-/opprydningsskript
  (`scratch-*.mjs`) fra disk før commit — ingen slike filer skal inn i
  git.

### Neste økt

Test-hygiene-opprydningen fra Økt 37 og 38 anses nå FULLFØRT — alle
kjente `createModerator()`-relaterte opprydningshull er lukket, og
0-rader er bekreftet empirisk over flere kjøringer. Gjenstående
kandidater: (a) `countryCode`-visningshullet i admin/moderator-listene
(digests, journalists, recipients), fortsatt bevisst utsatt til land
nummer to faktisk legges til; (b) den avbrutte E2E-kjeden fra Økt 30
(respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE, men lav
prioritet gitt grundig eksisterende testdekning; (c) vurder om samme
`role='moderator'`-DB-spørring (i stedet for e-postprefiks-grep) bør
brukes proaktivt ved fremtidige nattlige sveip for andre roller også
(f.eks. `role='admin'`) — ikke gjort denne runden, men mønsteret kan
gjenta seg. Ellers uendret: de tre opprinnelige åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 39: fulgte opp forrige økts egen kandidat (c) — samme
opprydningshull for `role='admin'`, ikke bare `role='moderator'`

Forrige økt (38) foreslo som en "vurder"-kandidat å bruke samme
`role='moderator'`-DB-spørring proaktivt for andre roller. Kjørte den
mot `role='admin'` som en rask sjekk FØR jeg valgte neste hovedoppgave
— og fant nøyaktig samme mønster, i nøyaktig samme filer: **2404**
opphopede `role='admin'`-testbrukere, aldri ryddet bort.

En `createAdmin()`-hjelpefunksjon (eller et rått innsatt administrator-
kall) eksisterte parallelt med `createModerator()`/`createActiveUser()`
i de SAMME åtte testfilene som allerede hadde fått moderator-fiksen —
men ingen av dem sporet administratorenes IDer, så `afterAll`-en fra
Økt 37/38 ryddet aldri disse radene.

**Filer rettet** (alle 8 via samme `createdAdminIds`-mønster, slått
sammen med den eksisterende `createdModeratorIds`-opprydningen der en
allerede fantes):
- `auth/authorize.ts`, `digests/digests.ts`: egen `createAdmin()`-
  hjelper, lagt til i samme `afterAll` som moderatorene (kombinert
  `allIds`-array for auditLogs/sessions/users; moderatorCountries
  fortsatt kun for moderator-IDene, siden administratorer ikke har
  noen slik rad).
- `admin/responses.ts`, `admin/legal-documents.ts`: hadde INGEN delt
  moderator-opprydning fra før (bruker try/finally-stil) — la til en
  egen, ny fil-nivå `createdAdminIds`/`afterAll` for disse to.
- `admin/countries.ts`: `createActiveUser(role, ...)` — samme dynamiske
  hjelper som allerede sporet `role === "moderator"` — fikk en
  tilsvarende `if (role === "admin") createdAdminIds.push(...)`-linje.
  Denne filen alene stod for 18 av `createAdmin()`-kallestedene.
- `moderation/requests.ts`, `moderation/journalists.ts`,
  `moderation/responses.ts`: hver hadde ÉN rått innsatt administrator i
  én enkelt test ("en administrator kan ... UANSETT land") — disse
  IDene pushes rett inn i den EKSISTERENDE `createdModeratorIds`-
  arrayen (den delte `afterAll`-en tåler en administrator-ID uten
  endring, siden moderatorCountries-slettingen for en slik ID ganske
  enkelt ikke treffer noen rad).
- I `moderation/journalists.ts` spesifikt: administratoren i
  "godkjenne UANSETT land"-testen kaller `approveJournalist()`, som
  setter `journalistProfiles.reviewedBy` til administratorens id på
  nøyaktig samme måte som en moderator — dekket av filens eksisterende
  `reviewedBy`-nulling, ingen ekstra endring nødvendig utover selve
  push()-kallet.

**Ingen nye filer utover disse åtte** — et avsluttende bredt søk
(`role: "admin"` uavhengig av `createAdmin`, dynamiske
`uniqueTestEmail(...)`-kall, og rå template-strenger à la
`auth/session.ts` sitt moderator-mønster) bekreftet at ALLE reelle
databaseinnsettinger med `role: "admin"` lå i disse åtte filene.
`admin/dashboard.ts` og `moderation/users.ts` bruker begge kun
`makeSession({ role: "admin" })` — en fabrikkert øktobjekt uten noen
tilhørende databaserad — så ingen opprydning var nødvendig der.

**Målt effekt**: 2404 opphopede `role='admin'`-rader ned til 0 etter
opprydning, bekreftet 0 for BÅDE `role='admin'` og `role='moderator'`
FØR og ETTER to påfølgende fulle kjøringer av hele
integrasjonstestpakken (326/326 begge ganger).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret (ingen
  i18n-berøring).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, 326
  tester — TO rene påfølgende kjøringer, 326/326 bestått begge ganger.
  Bekreftet 0 rader for BÅDE `role='admin'` og `role='moderator'` FØR
  og ETTER hver av de to kjøringene.
- Alle 8 filene kjørt enkeltvis under selve rettingen:
  `auth/authorize.ts` 11/11, `digests/digests.ts` 8/8,
  `admin/responses.ts` 4/4, `admin/legal-documents.ts` 11/11,
  `admin/countries.ts` 19/19, og en samlet kjøring av
  `moderation/requests.ts` (21/21), `moderation/journalists.ts`
  (13/13) og `moderation/responses.ts` (7/7) — alle 41 bestod sammen.
- Ryddet bort alle midlertidige diagnose-/opprydningsskript
  (`scratch-*.mjs`) fra disk før commit.

### Neste økt

Test-hygiene-opprydningen for BÅDE `role='moderator'` (Økt 37/38) og
`role='admin'` (denne økten) anses nå FULLFØRT for disse to rollene.
Gjenstående kandidater: (a) samme prinsipp kunne i teorien gjelde
`role='recipient'`/`role='journalist'` også — sett noen isolerte
eksempler underveis denne økten (f.eks. `existingRecipient` i
`admin/countries.ts`, `recipient`-brukere i
`admin/legal-documents.ts`) som ikke ryddes opp, men disse rollene
brukes i SÅ stort volum i den normale test-flyten (hver forespørsel/
respondent-test oppretter minst én) at samme "opphopet over natten"-
risiko sannsynligvis IKKE gjelder på samme måte — de fleste slike
tester bruker allerede egen per-test-opprydning av forespørsler/svar
som kaskaderer naturlig. Vurder en egen, avgrenset sjekk av dette FØR
neste gang testdatabasen vokser urovekkende stort, men ikke antas
prioritert nå; (b) `countryCode`-visningshullet i admin/moderator-
listene (digests, journalists, recipients), fortsatt bevisst utsatt
til land nummer to faktisk legges til; (c) den avbrutte E2E-kjeden fra
Økt 30 (respondentens godkjenn/avslå-sti) er fortsatt utestet LEVENDE,
men lav prioritet gitt grundig eksisterende testdekning. Ellers
uendret: de tre opprinnelige åpne spec-spørsmålene, fortsatt bevisst
latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 40: samme opprydningshull, men for mottakere/journalister — for stort
til én-fil-av-gangen-fiksing, så bygget en systemisk løsning i stedet

Forrige økt (39) sin "Neste økt" nevnte som en lav-prioritert kandidat at
`role='recipient'`/`role='journalist'` KANSKJE hadde samme opprydningshull,
men antok det trolig var ufarlig siden disse rollene "brukes i så stort
volum i den normale test-flyten". Målte det for å være sikker FØR jeg gikk
videre — antagelsen var FEIL: **15258** opphopede brukere totalt, og en
enkelt full kjøring av hele integrasjonspakken la til **232 NYE** rader
(109 journalister + 123 mottakere) — et reelt, kontinuerlig voksende hull,
ikke bare historisk støv.

**Hvorfor ikke samme fiks som moderator/admin**: `createModerator()`/
`createAdmin()`-hullet var avgrenset til 8-11 kjente filer med en håndfull
kallesteder hver. Mottakere/journalister opprettes derimot i NESTEN HVER
eneste av de 32 integrasjonstestfilene (`createActiveRecipient()`,
`createActiveJournalist()` fra `fixtures.ts` m.fl., pluss utallige rå
innsettinger) — å legge til `createdXIds`-sporing og en `afterAll` i HVER
fil ville vært en enormt mye større, mer feilutsatt jobb enn de to forrige
øktenes fiks, med langt dårligere kost/nytte-forhold (fremtidige nye
tester ville uansett kunne glemme det samme igjen).

**Løsningen i stedet**: en GLOBAL opprydning, `src/db/integration/
global-teardown.ts`, koblet inn via Vitest sin `test.globalSetup`
(`vitest.integration.config.ts`) — kjøres ÉN gang, i en EGEN prosess, etter
at HELE testpakken er ferdig (ikke per fil). Den henter ALLE brukere med
e-post som slutter på `@example.invalid` (RFC 2606-reservert domene,
bekreftet trygt for masseopprydning — kan aldri kollidere med en ekte
adresse) og fjerner dem, PLUSS alt som refererer til dem, i streng
FK-trygg rekkefølge (samme mønster som `performAccountDeletion()`/
`retention.ts` allerede etablerte, generalisert til et helt utvalg i
stedet for én bruker om gangen): `journalistProfiles.reviewedBy` → null
først, deretter forespørsler eid som journalist ELLER som moderator (funnet
FØR noe slettes, slik at svar knyttet til DEM fanges opp uansett hvem som
svarte), så kontaktforespørsler (både via `responseId` og `journalistId`),
svar, forespørsler, `digestDeliveries`, `consentRecords`, `auditLogs`,
`authTokens`, `sessions`, `emailSubscriptions`, `journalistProfiles`,
`moderatorCountries`, og til slutt selve brukerraden. Kjøres i biter à 500
IDer om gangen (samme størrelse som de tidligere engangs-opprydnings-
skriptene brukte), med en fersk, frittstående `pg.Pool` (kan ikke gjenbruke
`@/db/client` sin poolinstans, siden `globalSetup` kjører i en annen
prosess enn selve testfilene) som lukkes eksplisitt i `finally`.

**Rører aldri ekte anonymiserte kontosletting-rader**: oppdaget underveis
at 390 (nå voksende, +6 per kjøring) brukerrader har e-post som IKKE er
`@example.invalid` — disse er `performAccountDeletion()`-testenes egne,
spec-korrekte sluttresultater (SPEC-V1.md 17.5: e-post erstattes med en
hash, raden ANONYMISERES, ikke slettes). Global-opprydningen filtrerer
eksplisitt kun på `@example.invalid`, så disse rørt IKKE — de er ikke et
opprydningshull, men nøyaktig den permanente tilstanden spec-en selv
beskriver for en slettet konto.

**Verifisert grundig FØR den ble koblet inn i selve konfigurasjonen**:
kjørte hele slette-logikken som et frittstående engangsskript mot den
FAKTISKE opphopede 15258-rad-databasen først (ingen FK-feil, 14868
@example.invalid-rader fjernet, de 390 ekte anonymiserte radene urørt),
FØR den ble gjort om til den permanente `global-teardown.ts`-filen og
koblet inn i `vitest.integration.config.ts` — i tråd med instruksen om at
noe som sletter/anonymiserer data skal bygges FORSIKTIG med egen
verifisering før det kobles til noe som ligner ekte data.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil (fjernet to overflødige
  `eslint-disable`-kommentarer for `no-console`, som prosjektets
  eslint-oppsett ikke faktisk flagger).
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, 326 tester —
  TO rene påfølgende kjøringer, 326/326 bestått begge ganger. Bekreftet
  0 `@example.invalid`-rader FØR og ETTER hver kjøring, og at
  global-opprydningen selv fyrer automatisk og fjerner nøyaktig de 226
  nye radene HVER kjøring la til (konsistent begge ganger) — de eneste
  gjenværende radene er de forventede, voksende anonymiserte
  kontosletting-testresultatene (+6 per kjøring, spec-korrekt, urørt med
  hensikt).

### Neste økt

Test-hygiene-opprydningen for `role='moderator'` (Økt 37/38),
`role='admin'` (Økt 39) og nå den systemiske løsningen for ALLE
`@example.invalid`-brukere uansett rolle (denne økten) anses FULLFØRT.
Fremtidige testfiler som glemmer å rydde opp sine egne mottakere/
journalister/moderatorer/administratorer trenger IKKE lenger egen
oppmerksomhet — global-teardown.ts fanger dem uansett. Gjenstående
kandidater, alle lav prioritet: (a) `countryCode`-visningshullet i
admin/moderator-listene (digests, journalists, recipients), fortsatt
bevisst utsatt til land nummer to faktisk legges til; (b) den avbrutte
E2E-kjeden fra Økt 30 (respondentens godkjenn/avslå-sti) er fortsatt
utestet LEVENDE, men lav prioritet gitt grundig eksisterende
testdekning; (c) vurder om de 390+ voksende anonymiserte
kontosletting-radene på et tidspunkt selv bør få en øvre grense i
TESTDATABASEN spesifikt (ikke i produksjonskoden — der er permanent
anonymisering korrekt per spec) — ikke prioritert nå, veksten er
langsom (+6 per full kjøring) sammenlignet med hva som nettopp ble
løst. Ellers uendret: de tre opprinnelige åpne spec-spørsmålene,
fortsatt bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) om FR-023s 403→404-presisjonsfiks bør utvides til
`moderation/users.ts`, `moderation/journalists.ts`,
`moderation/responses.ts`, `digests/digests.ts`.

## Økt 41: løste den permanente kandidaten (c) — utvidet FR-023s
403→404-presisjonsfiks til de fire gjenstående filene

Dette spørsmålet har stått uendret som kandidat (c)/(b) i "Neste
økt"-notatet i så godt som HVER økt siden det først ble reist (rundt Økt
24, fiksen selv i requests.ts kom i Økt 25/task #71) — aldri løftet ut av
listen over "permanente, bevisst utsatte" spørsmål, men heller aldri
undersøkt i dybden for å avgjøre om det FAKTISK krevde et skjønnsspørsmål,
eller bare var en mekanisk utvidelse ingen hadde tatt seg tid til. Brukte
en Explore-underagent til å undersøke dette konkret (uten å gjøre noen
kodeendringer selv) før jeg bestemte meg for å gå videre — svaret var
entydig: en lav-risiko, ren copy-paste-utvidelse av et allerede bygget,
allerede testet mønster, ikke et skjønnsspørsmål.

**Mønsteret** (fra `auth/authorize.ts`, bygget i Økt 25 sammen med selve
requests.ts-fiksen): `checkModeratorForCountry()` finnes ALLEREDE ved
siden av den opprinnelige, ikke-skillende `requireModeratorForCountry()`
— returnerer et 3-veis resultat (`"unauthorized"` for ingen/ugyldig økt,
`"wrong_country"` for en gyldig moderatorøkt tildelt et ANNET land,
`"ok"` med økten ellers) i stedet for å slå de to feilårsakene sammen til
én `null`. `moderation/requests.ts` bruker den allerede; de fire andre
filene brukte fortsatt den gamle, ikke-skillende funksjonen.

**Anvendt i 8 funksjoner på tvers av 4 filer**, alle strukturelt
identiske til det allerede fiksede mønsteret (ett enkelt ressursoppslag
per ID, landsjekk via `requireModeratorForCountry`, ruten mapper allerede
`errors.not_found`→404/`errors.not_authorized`→403 uendret):
- `moderation/users.ts`: `suspendUser`, `unsuspendUser`,
  `suppressUserEmail`, `adminDeleteUser`.
- `moderation/journalists.ts`: `approveJournalist`, `rejectJournalist`.
- `moderation/responses.ts`: `hideResponse`.
- `digests/digests.ts`: `retryFailedDigestDeliveries`.

(Liste-operasjoner som `searchUsersByEmail()`/`listJournalists()`/
`listDigests()` er BEVISST ikke berørt — der finnes ingen enkelt-ressurs
hvis eksistens kan lekkes, FR-023s "404 i stedet for 403"-poeng gjelder
ikke en liste som uansett bare filtreres på tildelte land.)

**Verifiserte at API-rutene ALLEREDE håndterte begge feilkodene riktig**
FØR jeg rørte lib-funksjonene — alle åtte rutene
(`admin/users/:id/{suspend,unsuspend,suppress-email,delete}`,
`admin/journalists/:id/{approve,reject}`, `admin/responses/:id/hide`,
`admin/digests/:id/retry`) mappet allerede `errors.not_found`→404 OG
`errors.not_authorized`→403 — selve HTTP-laget trengte ingen endring,
kun hvilken feilstreng lib-funksjonen returnerer.

**Testoppdatering**: fem eksisterende "moderator tildelt et ANNET
land"-tester (`suspendUser`, `suppressUserEmail`, `adminDeleteUser`,
`approveJournalist`, `hideResponse`, `retryFailedDigestDeliveries` — seks
faktisk) endret forventet feil fra `errors.not_authorized` til
`errors.not_found`. To NYE tester lagt til for parity, siden forskningen
fant at `unsuspendUser()` og `rejectJournalist()` manglet en tilsvarende
test fra før (ingen av dem hadde noen "annet land"-test i det hele tatt,
uansett feilkode).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 451 tester, alle
  bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- De fire endrede testfilene kjørt sammen: 55/55 bestod.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, 328
  tester (326 + 2 nye) — TO rene påfølgende kjøringer, 328/328 bestått
  begge ganger. Global-opprydningen (Økt 40) fyrte automatisk og fjernet
  228 testbrukere begge ganger, uendret oppførsel.

### Neste økt

De tre GENUINE åpne spørsmålene er nå de eneste gjenstående — samtlige
lav-hengende, mekaniske forbedringskandidater fra Økt 24-40s sveip er nå
enten løst eller bevisst, begrunnet utsatt (`countryCode`-visningshullet
til land nummer to, E2E-kjeden til lav prioritet gitt eksisterende
dekning). Fremtidige økter bør derfor sannsynligvis gå bredere — en ny
sveip av en annen del av kodebasen (f.eks. en frisk gjennomgang av
DESIGN.md 9s resterende akseptansekriterier 2/3/6/7, som IKKE er
eksplisitt bekreftet i noen tidligere økt selv om automatiserte sjekker
for flere av dem — `check-tokens.ts`, `contrast-pairs.test.ts` — ser ut
til allerede å finnes) i stedet for å fortsette å lete i de samme,
allerede grundig gjennomgåtte modulene. Ellers uendret: de tre
opprinnelige åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) [LØST denne økten — se over, ikke lenger et åpent spørsmål].

## Økt 42: fulgte opp forrige økts anbefaling — sjekket DESIGN.md 9
kriterium 3 i dybden, og fant en EKTE WCAG AA-kontrastfeil i mørkt tema

Forrige økt (41) foreslo å gå bredere fremfor å fortsette å lete i
allerede grundig gjennomgåtte moduler — pekte konkret på DESIGN.md 9s
kriterier 2/3/6/7 som ikke eksplisitt bekreftet i noen tidligere økt.
Sjekket kriterium 2 først (`npm run design:check-tokens` — kjørte rent,
0 brudd, 54 komponent-CSS-filer). Gikk deretter i dybden på kriterium 3
("Kontrasttesten dekker ALLE brukte tokenpar") — `contrast-pairs.ts`s
`TOKEN_PAIRS`-liste er BEVISST manuelt kurert, ikke automatisk
ekstrahert fra CSS-en (egen kommentar i filen sier dette rett ut), og
siste systematiske kryssjekk mot faktisk CSS-bruk var Økt 14 — lenge
siden, og flere nye komponenter/sider er bygget siden da.

**Metode**: skrev et engangsskript som gikk gjennom alle 54
`*.module.css`-filer, fant hver regelblokk med BÅDE en `color:`- og en
`background`/`background-color:`-egenskap som pekte på et
`var(--color-*)`-token, og samlet de DISTINKTE (forgrunn,
bakgrunn)-parene som faktisk forekommer. Sammenlignet resultatet mot
`TOKEN_PAIRS`.

**Funn — to genuint utestede par**:
1. `journalist/requests/[id]/page.module.css` sin `.comment`
   (moderatorens kommentar på en endrings-/avvist forespørsel) brukte
   `color: var(--color-text)` på `background: var(--color-warning-subtle)`
   — **EKTE FEIL**: 15.62:1 i lyst tema (OK), men kun **1.02:1 i mørkt
   tema** (kravet er 4.5:1) — teksten er praktisk talt usynlig for en
   journalist som bruker mørkt tema og får en endringsforespørsel med
   moderatorkommentar. Nøyaktig samme bugklasse `Badge.module.css` sin
   egen kommentar ved `.warning` advarer eksplisitt mot ("IKKE
   --color-warning-text her — den er kalibrert mot --color-surface,
   ikke mot --color-warning-subtle, og kolliderer med den i mørkt
   tema") — men med `--color-text` i stedet, samme underliggende
   årsak (en generell tekstfarge kalibrert mot sidens/flatens
   bakgrunn, ikke mot den tint-ede advarselsbakgrunnen, som forskyver
   seg i mørkt tema). Denne SPESIFIKKE forekomsten slapp gjennom fordi
   `TOKEN_PAIRS` aldri inneholdt akkurat dette paret — kriterium 3s
   "dekker ALLE brukte tokenpar" var med andre ord IKKE sant i praksis.
2. `journalist/responses/[id]/page.module.css` sin `.contactSharing`
   brukte `color: var(--color-text)` på
   `background: var(--color-surface-sunken)` — besto med god margin i
   begge temaer (16-18:1), men var også utestet.

**Fiks**: endret `.comment` til `color: var(--color-warning-on-subtle)`
— nøyaktig samme, allerede riktige token `Badge.module.css` sin
`.warning`-klasse bruker for identisk formål. Bekreftet numerisk
(10.08:1 i BEGGE temaer) med samme `auditPair()`-funksjon testene selv
bruker, FØR jeg rørte selve komponentfilen. La til begge parene i
`TOKEN_PAIRS` — det første som en UTVIDET kommentar på den
EKSISTERENDE "advarsel-badge-tekst"-oppføringen (siden det etter fiksen
er nøyaktig samme (forgrunn, bakgrunn)-par som Badge allerede tester,
ikke en ny, duplikat rad), det andre som en helt ny oppføring.

**Verifiserte selve fiksen LEVENDE, ikke bare via beregnet forhold**:
startet `npm run dev`, hentet den faktiske, kompilerte CSS-en for siden
via et `curl`-kall mot `/_next/static/css/...`, og bekreftet at
`.page_comment__...`-regelen faktisk inneholdt
`color: var(--color-warning-on-subtle)` i den SERVERTE filen — ikke
bare i kildefilen. Utviklingsserveren stoppet umiddelbart etterpå.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, **453** tester
  (451 + 2 nye, fra den ekstra `TOKEN_PAIRS`-oppføringen × to temaer),
  alle bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret (ingen ny
  nøkkel — ren fargetoken-endring).
- `npx tsx src/styles/check-tokens.ts` (DESIGN.md 9 kriterium 2): OK —
  54 filer sjekket, ingen rå verdier.
- `npx next build`: bygget uten feil.
- Levende sjekk av den faktiske, kompilerte CSS-en (se over): bekreftet
  fiksen er reelt servert, ikke bare i kildekoden.
- Ingen integrasjonstester berørt av denne endringen (ren CSS-token +
  en test-fixture-liste) — `test:integration` ikke kjørt denne runden.

### Neste økt

DESIGN.md 9 kriterium 2 (design:check-tokens) og 3 (kontrasttesten,
etter denne fiksen) er nå BEGGE eksplisitt verifisert. Gjenstående
kandidater fra forrige økts liste: (a) kriterium 6 (testtema slår
gjennom i e-postmaler UTEN at noen mal redigeres) — ikke undersøkt
ennå; (b) kriterium 7 (grensesnittet lesbart/ubrutt med 40 % lengre
tekststrenger) — ikke undersøkt ennå, sannsynligvis den mest
arbeidskrevende av de fire, siden den krever en reell
pseudo-lokaliseringstest eller en manuell gjennomgang av flere sider;
(c) vurder om samme systematiske CSS-kryssjekk (denne økten) bør
gjentas periodisk, ikke bare ved anledning — risikoen for at
`TOKEN_PAIRS` sakte faller bak faktisk CSS-bruk er strukturell, ikke en
engangshendelse (dette ER andre gang samme mønster oppdages, Økt 14 og
nå). Ellers uendret: de to gjenværende GENUINE åpne spec-spørsmålene,
fortsatt bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 43: fulgte opp forrige økts kandidat (a) — sjekket DESIGN.md 9
kriterium 6 empirisk, og fant at seksjon 7s beskrevne arkitektur ALDRI
ble bygget

Kriterium 6: "Testtemaet fra punkt 1 slår også gjennom i alle
e-postmaler uten at noen mal er redigert." Seksjon 7 beskriver
LØSNINGEN som en byggetids-eksportpipeline (`tokens/primitives.css →
tokens.json → e-postmaler`) og sier eksplisitt "Et temabytte treffer
dermed e-postene i samme operasjon." `src/lib/email/colors.ts` sin egen
kommentar innrømmer allerede at denne fulle pipelinen "IKKE er bygget
ennå" — men frem til nå var det aldri faktisk BEKREFTET hva det betyr i
praksis, kun notert som en akseptert forenkling.

**Testet det samme empirisk som Økt 86 gjorde for kriterium 1** (en
faktisk gjennomført testbytte, ikke bare lest kildekoden): endret
`--accent-600` i `tokens/primitives.css` til en dramatisk annen farge
(fra dempet blå til rødlig), og observerte to ting direkte:
1. `colors.test.ts` FEILET nøyaktig som forventet, på nøyaktig ÉN test
   (`accent matcher --accent-600`) — sikkerhetsnettet virker, CI ville
   fanget avviket.
2. Rendret en faktisk e-post (`renderSimpleCtaEmail()`) og inspiserte
   den RESULTERENDE HTML-en direkte — knappens bakgrunnsfarge var
   FORTSATT den GAMLE, utdaterte fargen (`#166f92`), IKKE den nye
   testfargen. Kriterium 6s bokstavelige påstand ("temabytte slår
   gjennom UTEN at noe redigeres") er dermed IKKE sant i dag — et reelt
   temabytte krever i tillegg en manuell oppdatering av de literale
   fargeverdiene i `colors.ts` for at e-postene faktisk skal endre seg.

Tilbakestilte testendringen umiddelbart etter (bekreftet `git status`
viste ingen gjenværende endring i `primitives.css`).

**Fiks — spec-en rettet, ikke koden** (samme prinsipp som README.md/
INFRASTRUCTURE.md 16.8 krever: spec-en er sannheten, men når KODEN
faktisk representerer en bevisst, allerede dokumentert forenkling, og
spec-en beskriver en arkitektur som aldri ble bygget, er det SPEC-en som
er unøyaktig, ikke koden som er buggy). Vurderte å bygge selve
eksport-pipelinen i stedet (parse `tokens/primitives.css` via
`fs.readFileSync` ved kjøretid, gjenbruke `parsePrimitives()`/
`oklchToSrgbHex()` fra `contrast-pairs.ts`/`oklch.ts` som allerede
finnes) — men forkastet dette: `colors.ts` kjøres i FAKTISK
produksjonskode (e-postutsending), og INFRASTRUCTURE.md 16.8s prinsipp
om ingen vertsspesifikk kode utenfor netlify.toml/netlify/functions
gjør en NY kjøretids-filsystemavhengighet i en Netlify Function
(usikkert om `tokens/primitives.css` i det hele tatt følger med i en
deployet funksjonsbunt) til en unødvendig ny risiko for en natts
autonomt arbeid, sammenlignet med den beskjedne gevinsten. Rettet i
stedet seksjon 7 og kriterium 6s ordlyd til å beskrive det som FAKTISK
finnes og er verifisert: `colors.ts` sine literale verdier, beregnet med
samme fargematematikk som kontrasttesten, og `colors.test.ts` som
sammenligner dem mot de ekte primitivene og feiler CI umiddelbart ved
avvik — en stedfortreder for selve eksportsteget, ikke selve steget.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (ingen kildekode rørt — kun DESIGN.md).
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 453 tester, alle
  bestod — inkludert `colors.test.ts` (bekrefter `primitives.css` er
  korrekt tilbakestilt etter testbyttet).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- Ingen integrasjonstester berørt (ren dokumentasjonsendring, ingen
  kildekode) — `test:integration` ikke kjørt denne runden.
- `git status` bekreftet KUN `DESIGN.md` endret ved commit-tidspunktet —
  testbyttet i `primitives.css` fullstendig reversert, ingen
  midlertidige skript liggende igjen.

### Neste økt

Fire av åtte DESIGN.md 9-kriterier er nå eksplisitt verifisert på tvers
av Økt 41-43 (1: Økt 86, 2 og 3: Økt 42, 6: denne økten). Gjenstående:
(a) kriterium 7 (grensesnittet lesbart/ubrutt med 40 % lengre
tekststrenger) — den mest arbeidskrevende gjenstående, siden den
krever enten en reell pseudo-lokaliseringstest eller en manuell
gjennomgang av flere sider med kunstig forlenget tekst; (b) vurder en
periodisk gjentakelse av Økt 42s systematiske CSS-kryssjekk (samme
strukturelle risiko som ble notert der). Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 44: fulgte opp forrige økts kandidat (a) — verifiserte DESIGN.md 9
kriterium 7 med en faktisk pseudo-lokaliseringstest, ingen brudd funnet

Kriterium 7: "Grensesnittet er lesbart og ubrutt med 40 % lengre
tekststrenger." Ikke undersøkt i noen tidligere økt — den mest
arbeidskrevende av de gjenstående DESIGN.md 9-kriteriene, siden den
krever faktisk visuell inspeksjon av gjengitte sider, ikke bare lesing
av kildekode eller en beregning.

**Metode**: skrev et engangsskript som blåste opp HVER strengverdi i
`src/i18n/messages/nb-NO.json` til ~140 % av original lengde (repeterte
ord fra samme streng til lengdemålet var nådd), med eksplisitt
bevaring av ICU-plassholdersyntaks (`{termsLink}`, `{minimumAge,
number}` osv. — splittet strengen på `{...}`-blokker og blåste KUN opp
de bokstavelige tekstbitene mellom dem, aldri selve plassholderne).
Bekreftet gyldig JSON og at antall `{`-tegn var uendret (50 = 50) etter
oppblåsingen — ingen ICU-syntaks korrumpert.

Satte opp minimal ekte testdata (et aktivt testland, en godkjent
journalist, en publisert forespørsel) og startet `npm run dev` mot
ekte lokal Postgres. Brukte det forhåndsinstallerte Playwright-CLI-et
(`/opt/pw-browsers`, samme oppsett miljøet allerede tilbyr) til å ta
FAKTISKE skjermbilder — ikke bare hente rå HTML via `curl`, som ikke
kan avsløre visuell overflow/klipping — av fem representative,
offentlige sider (forside, registrering som mottaker, journalist-
søknad, innlogging, og en publisert forespørsels detaljside) ved BÅDE
1280px (desktop) og 360px (samme bredde som kriterium 5s egen
verifisering, Økt 87) — ti skjermbilder totalt.

**Resultat**: ingen brudd funnet på noen av de ti skjermbildene. Tekst
brytes naturlig over flere linjer der den blir for lang (bl.a.
knappeteksten på innloggingssiden, som går over to linjer ved 360px),
ingen horisontal overflow, ingen klipt eller kuttet tekst, ingen
overlappende elementer. Den eneste "rariteten" i skjermbildene er
kosmetisk støy fra selve testskriptets naive ord-repetisjon (f.eks.
"Publisert Publisert2. august 2026" der oppblåsingen limte et repetert
ord rett inntil en påfølgende plassholderverdi uten mellomrom) — ikke
et layoutproblem, bare et artefakt av en enkel pseudo-oversettelses-
algoritme, uten betydning for selve kriteriet.

**Ryddet grundig opp etterpå**: `nb-NO.json` tilbakestilt fra en
sikkerhetskopi tatt FØR oppblåsingen, bekreftet byte-for-byte identisk
med `diff`. Testforespørselen/-journalisten slettet fra databasen.
Utviklingsserveren stoppet. Alle midlertidige skript slettet. `git
status` bekreftet et HELT rent arbeidsområde før denne NATTLOGG-
oppføringen ble lagt til — ingen kildekodeendring var nødvendig denne
runden, siden ingen reelt brudd ble funnet.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (ingen kildekode rørt).
- `npx eslint .`, `npx vitest run`, `npx tsx src/i18n/check-keys.ts`,
  `npx next build`: kjørt på nytt etter opprydding for å bekrefte
  arbeidsområdet er tilbake i en fullt grønn, uendret tilstand.
- Ti skjermbilder (5 sider × 2 viewport-bredder) inspisert visuelt (se
  over) — dette ER selve verifiseringen kriterium 7 krever, ikke en
  erstatning for den.
- Ingen integrasjonstester berørt (all testdata opprettet/slettet via
  engangsskript utenfor selve testpakken) — `test:integration` ikke
  kjørt denne runden.

### Neste økt

Fem av åtte DESIGN.md 9-kriterier er nå eksplisitt verifisert (1, 2, 3,
5, 6, 7 — faktisk seks om man teller 5 fra tidligere økt 87). Kriterium
4 (tastatur/skjermleser) ble også verifisert tidligere (økt 88).
Gjenstående: kriterium 8 (ingen forespørsel til ekstern vert ved
sidelast) — ikke eksplisitt bekreftet i noen økt ennå, verifiseres i
praksis ved å faktisk inspisere nettverksfanen/-trafikken under en reell
sidelasting, tilsvarende disiplin som denne økten. Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 45: fulgte opp forrige økts kandidat — verifiserte DESIGN.md 9
kriterium 8 med faktisk nettverkslogging, siste av de åtte
akseptansekriteriene

Kriterium 8: "Ingen forespørsel til en ekstern vert ved sidelast.
Verifiseres i nettverksfanen." Den siste av DESIGN.md 9s åtte
akseptansekriterier som ikke var eksplisitt bekreftet i noen tidligere
økt.

**Forundersøkelse i kildekoden**: søkte etter kjente eksterne
mønstre (`fonts.googleapis`, `fonts.gstatic`, CDN-er,
Google Analytics/Tag Manager, `unpkg`/`jsdelivr`) — ingen treff. Sjekket
`next/font`-bruk — ingen. Leste `tokens/typography.css`: fontene
(`"Inter var"`, `"Source Serif 4"`) er BEVISST planlagt selvhostet
(DESIGN.md 3: "Ingen Google Fonts, ingen ekstern CDN"), men de faktiske
`@font-face`-erklæringene og fontfilene er ikke lagt til ennå (kjent,
tidligere notert hull i skjelettet) — nettleseren faller derfor tilbake
til systemfontene i samme `font-family`-liste, og laster ingenting
eksternt for fontene i dag, nettopp FORDI funksjonen ikke er ferdig
bygget ennå, ikke fordi noen bevisst løsning finnes.

**Faktisk verifisering, ikke bare kildekodelesing**: satte opp minimal
ekte testdata (aktivt testland, en godkjent journalist, en publisert
forespørsel), startet `npm run dev`, og brukte det forhåndsinstallerte
Playwright-CLI-et sin `--save-har`-funksjon (samme verktøy som
kriterium 7-verifiseringen forrige økt) til å fange ALL nettverkstrafikk
under en ekte sidelasting — for fem representative, offentlige sider
(forside, mottakerregistrering, journalistsøknad, innlogging, en
publisert forespørsels detaljside). Parset de fem resulterende
HAR-filene (38 forespørsler totalt på tvers av alle fem sidene) og
listet ut HVER unike vert forespørslene faktisk gikk til.

**Resultat**: samtlige 38 forespørsler, på tvers av alle fem sidene,
gikk KUN til `localhost:3000` — appens egen opprinnelse. Ingen ekstern
vert kontaktet noe sted. Kriterium 8 holder, empirisk bekreftet.

**Ryddet grundig opp etterpå**: testforespørselen/-journalisten slettet
fra databasen, utviklingsserveren stoppet, alle midlertidige skript OG
de fem HAR-filene (betydelig størrelse — 15-20 MB hver, ~90 MB totalt)
slettet fra scratch-katalogen. `git status` bekreftet et helt rent
arbeidsområde — ingen kildekodeendring var nødvendig denne runden,
siden ingen brudd ble funnet.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (ingen kildekode rørt).
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 453 tester, alle bestod.
- Den faktiske nettverksloggingen (se over) ER selve verifiseringen
  kriterium 8 krever — ikke en erstatning for den.
- Ingen integrasjonstester berørt (all testdata opprettet/slettet via
  engangsskript utenfor selve testpakken) — `test:integration`,
  `npx tsx src/i18n/check-keys.ts` og `npx next build` ikke kjørt denne
  runden siden ingen kildekode ble endret (kun `NATTLOGG.md`).

### Neste økt

Samtlige ÅTTE akseptansekriterier i DESIGN.md 9 er nå eksplisitt
verifisert på tvers av Økt 41, 42, 43, 44 og denne økten (1: Økt 86, 2
og 3: Økt 42, 4: Økt 88, 5: Økt 87, 6: Økt 43, 7: Økt 44, 8: denne
økten). Denne bølgen av design-systemverifisering anses FULLFØRT.
Fremtidige økter bør gå bredere igjen — vurder en ny gjennomgang av
SPEC-V1.md seksjon 21 (ikke-funksjonelle krav, sist revidert Økt 85) for
å se om noe har driftet siden den runden, eller se etter helt nye
kandidatområder som ikke er dekket av noen tidligere sveip. Ellers
uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 46: bred sveip etter at DESIGN.md 9-verifiseringsbølgen var
fullført — fant og rettet et reelt, om enn smalt, personvernhull i
`send.ts` sin stubb-modus

Fulgte forrige økts eget forslag om å gå bredere igjen. Sjekket flere
spor før noe reelt dukket opp:
- Kjørte `npx tsx src/i18n/check-keys.ts` på nytt for å se om `en-GB`
  hadde driftet fra `nb-NO` siden Økt 13s `findLocaleGaps()`-verktøy ble
  bygget — ingen advarsel, fortsatt full paritet.
- Bekreftet INFRASTRUCTURE.md 16.8s vert-uvitenhets-grense fortsatt
  holder: søkte gjennom HELE `src/` etter "netlify"/"NETLIFY" — kun fire
  kommentarer som FORKLARER arkitekturen, ingen faktisk vertsspesifikk
  kode (ingen `process.env.NETLIFY`, ingen `@netlify/*`-importer i
  forretningslogikk). Leste `netlify/functions/tick.ts` i sin helhet —
  fortsatt en genuint tynn adapter, ingen forretningslogikk sneket seg
  inn.
- Bekreftet retensjonsjobben (SPEC-V1.md 17.4, den opprinnelige
  natte-instruksens forsiktighetspunkt) fortsatt er korrekt koblet:
  kjører daglig rundt 03:00 UTC via et enkelt klokkeslett-vindu i
  `runTick()` (Stadium 0 har ingen egen planlegger utover 15-minutters-
  tikket), fortsatt i "dry run" som standard.
- Bekreftet `POST /subscribe`/`POST /journalists/apply` faktisk skriver
  `ConsentRecord`-rader (den ALLER FØRSTE prioriteringen i den
  opprinnelige natte-instruksen, bekreftet allerede løst for lenge
  siden).

**Reelt funn**: sjekket INFRASTRUCTURE.md 10s ubetingede regel
("Personopplysninger logges ikke: ingen e-postadresser, ingen
svartekst") mot alle `console.*`-kall i `src/`. `sendTransactionalEmail()`
og `sendBulkEmail()` (`src/lib/email/send.ts`) faller BEGGE tilbake til
en "stubb-modus" som logger mottakerens FULLE e-postadresse via
`console.warn()` når `BREVO_API_KEY` mangler — bevisst og nyttig for
lokal utvikling/tester (dusinvis av eksisterende tester i `send.test.ts`
forutsetter nettopp dette), MEN uten noe skille mellom lokal utvikling
og en EKTE, driftsatt miljø der nøkkelen ved en feil ble utelatt. Ingen
oppstartsvalidering av `BREVO_API_KEY` finnes noe sted (kun de to
kallestedene selv sjekker `if (!apiKey)` og faller stille til stubben).
En glemt hemmelighet i produksjon ville dermed IKKE feilet høylytt —
den ville stille begynt å skrive ekte brukeres e-postadresser til
uansett hvilket loggsystem det driftsatte miljøet bruker, i strid med
10s regel, i stedet for enten å sende ekte e-post eller feile synlig.

**Fiks**: la til en sperre i begge funksjonene — `if
(process.env.NODE_ENV === "production") throw new Error(...)` FØR
stubb-loggingen, slik at et manglende `BREVO_API_KEY` i produksjon
feiler høylytt i stedet for å degradere stille til PII-logging.
Uendret for alle andre miljøer (lokal utvikling, CI, Vitest — som
bruker `NODE_ENV=test` som standard, ALDRI `"production"`), så samtlige
eksisterende tester i `send.test.ts` (som alle forutsetter stubb-modus
uten denne sperren) fortsatte å bestå uendret.

**Empirisk bekreftet feilen var reell** (samme disiplin som resten av
natten): la til to nye tester (én for hver funksjon) som setter
`NODE_ENV=production` OG fjerner `BREVO_API_KEY`, og forventer at
kallet KASTER i stedet for å logge. `git stash push` på `send.ts` alene
(beholdt de nye testene) → begge nye tester FEILET som forventet mot
den gamle koden (`rejects.toThrow` fikk i stedet en oppløst verdi —
`undefined`/`null`) → `git stash pop` gjenopprettet fiksen → begge
tester består. Hele testfilen kjørt samlet: 32/32 bestod (30
eksisterende + 2 nye).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, **455** tester
  (453 + 2 nye), alle bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres — kjørt siden `send.ts`
  brukes av svært mange integrasjonsflyter): 32 filer, 328 tester, alle
  bestod. Global-opprydningen (Økt 40) fyrte automatisk og fjernet 228
  testbrukere, uendret oppførsel.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull, ikke bare en teoretisk bekymring.

### Neste økt

Ingen kjent gjenstående handling fra denne runden. Mulige neste spor,
ingen hastende: (a) vurder om det finnes en TILSVARENDE
oppstartsvalidering som burde legges til for andre påkrevde
hemmeligheter (`BREVO_SENDER_TRANSACTIONAL`/`BREVO_SENDER_BULK` kaster
allerede når de mangler MED en nøkkel til stede, se eksisterende kode —
disse to er trolig allerede tilstrekkelig dekket; dette var spesifikt
om SELVE nøkkelens fravær som utløste en STILLE, PII-loggende
reservevei, en annen feilklasse); (b) en generell sveip av ALLE
`console.*`-kall i `src/` for andre, lignende stille-degraderings-
mønstre er allerede gjort denne runden og fant kun dette ene tilfellet.
Ellers uendret: de to gjenværende GENUINE åpne spec-spørsmålene,
fortsatt bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 47: fulgte opp forrige økts spor (a) — fant SAMME bugklasse i
`digest.ts`, denne gangen alvorligere fordi den feiler HELT stille

Forrige økt (46) foreslo eksplisitt å sjekke om det finnes en TILSVARENDE
oppstartsvalidering som burde legges til for andre påkrevde
hemmeligheter, utover selve `BREVO_API_KEY`-funnet. Gjorde samme brede
sveip som Økt 46 innledningsvis (samme fire sjekkpunkter, alle fortsatt
rene, ingen gjentagelse her), og gikk deretter videre til det foreslåtte
sporet.

**Reelt funn**: `src/lib/email/digest.ts` sin `SITE_ORIGIN`-konstant falt
tilbake til plassholderdomenet `https://kildebanken.example` når
`NEXT_PUBLIC_SITE_ORIGIN` mangler — akkurat samme mønster som
`BREVO_API_KEY`, men **alvorligere**: `BREVO_API_KEY`-hullet logget i det
minste noe (mottakerens e-post, feil i seg selv, men SYNLIG i loggene).
Et glemt `NEXT_PUBLIC_SITE_ORIGIN` i produksjon ville derimot IKKE
produsert noen feilmelding noe sted — selve e-postsendingen ville
lykkes, bare med plassholderdomenet bakt inn i HVER lenke i HVER
utsendte e-post (innloggingslenke, e-postbekreftelse,
kontosletting-bekreftelse, kontaktforespørsel-godkjenning,
digest-lenker og avmeldingslenke — alle 15+ malene som importerer
`SITE_ORIGIN`), og gjort samtlige e-post-baserte handlinger ubrukelige
uten et eneste synlig varsel.

**Fiks**: samme mønster som Økt 46, tilpasset til at `SITE_ORIGIN` er en
plain eksportert konstant referert direkte (via streng-interpolering) fra
15+ malefiler — i stedet for å konvertere alle disse kallestedene til å
kalle en funksjon, ble selve beregningen trukket ut i en liten, eksportert
(for direkte testbarhet) funksjon `resolveSiteOrigin()`:

```ts
export function resolveSiteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_ORIGIN;
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_SITE_ORIGIN mangler i produksjon — nekter å falle tilbake til plassholderdomenet https://kildebanken.example, som ville gjort ALLE lenker i utsendte e-poster ubrukelige (se INFRASTRUCTURE.md 9 og NATTLOGG.md)."
    );
  }
  return "https://kildebanken.example";
}

export const SITE_ORIGIN = resolveSiteOrigin();
```

`SITE_ORIGIN`-konstantens type og bruk er uendret, så ALLE 15+
nedstrøms-malene (samt `tick.ts` og `digests.ts`) fortsetter å fungere
uendret — kun beregningen av startverdien endret seg. Bekreftet `.env`
og `.env.example` allerede har `NEXT_PUBLIC_SITE_ORIGIN` satt (til
`http://localhost:3000`), slik at den nye produksjonssperren ikke
forstyrrer `npx next build`-steget i verifiseringskjeden.

**Empirisk bekreftet feilen var reell** (samme disiplin som resten av
natten): la til tre nye tester i `digest.test.ts` — (1) faller fortsatt
tilbake til plassholderdomenet i ikke-produksjon, (2) bruker den
konfigurerte verdien uansett miljø, (3) kaster i produksjon i stedet for å
falle tilbake. `git stash push -- src/lib/email/digest.ts` (beholdt bare
testfilen) → alle tre nye tester FEILET som forventet mot den gamle
koden (`TypeError: resolveSiteOrigin is not a function`, siden funksjonen
rett og slett ikke eksisterte ennå) → `git stash pop` gjenopprettet
fiksen → alle tester består igjen (13/13 i filen).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, **458** tester
  (455 + 3 nye), alle bestod.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres — kjørt siden
  `digest.ts` brukes av `tick.ts` og `digests.ts`, begge dekket av
  integrasjonstester): full pakke (32 filer) feilet FØRST med én test i
  `tick.integration.test.ts` (`runDigestTick` sin
  "oppretter en digest og sender..."-test forventet `result.errors` tom,
  men fikk et dusin "mangler påkrevde felt til tross for status
  published"-feil for forespørsler med UUID-er som ikke fantes i noen
  av testens egne fixtures). Undersøkt før antatt urelatert: kjørte
  `tick.integration.test.ts` ALENE (25/25 bestod), sjekket databasen
  direkte (`kildebanken_test` var TOM for både `countries` og
  `requests` etter kjøringen), og kjørte HELE integrasjonspakken på nytt
  (328/328 bestod, ingen gjentagelse). Konklusjon: en engangs
  tvers-av-fil-race i vitest sin PARALLELLE fil-kjøring mot samme delte
  Postgres-instans — `runDigestTick(db)` er produksjonskode og skanner
  bevisst ALLE land som har en digest forfalt, ikke bare testens egen
  isolerte `createIsolatedActiveCountry()`-rad, så en ANNEN testfils
  midlertidige (siden ryddet opp i sin egen `finally`) publiserte
  forespørsel i et annet land kan i prinsippet plukkes opp av denne
  testens tikk hvis tidsvinduene overlapper. IKKE en regresjon fra denne
  øktens `SITE_ORIGIN`-fiks (som ikke rører `tick.ts` sin
  forretningslogikk i det hele tatt) — notert her som et nytt,
  observert (men ikke reprodusert på kommando) tvers-av-fil-flake-mønster
  for en fremtidig økt å vurdere, ikke noe å utsette denne fiksen for.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull, ikke bare en teoretisk bekymring.

### Neste økt

Mulige spor, ingen hastende: (a) vurder om `tick.integration.test.ts` sin
"oppretter en digest og sender..."-test bør skjerpes til å telle bare
feil for SINE EGNE `requestIds` i stedet for å forvente `result.errors`
helt tom — se flake-observasjonen over; usikkert om dette er verdt
kompleksiteten for en test som bestod i BEGGE isolerte kjøringer og kun
feilet én gang i en full parallell kjøring. (b) samme spørsmål som Økt 46
avsluttet med: er det FLERE påkrevde miljøvariabler med samme
stille-fallback-mønster? To funnet og rettet nå (`BREVO_API_KEY`,
`NEXT_PUBLIC_SITE_ORIGIN`); et raskt `grep` etter `process.env.NEXT_PUBLIC`
og `?? "` / `|| "`-mønstre andre steder i `src/` kan være verdt et blikk,
men ingen konkrete kandidater er identifisert ennå. Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 48: fulgte opp begge spor fra forrige økt — sveip fant ingen nye
kandidater, og herdet den observerte flaky-testen

Forrige økt (47) etterlot to spor. Fulgte begge, i rekkefølge:

**Spor (b) — flere skjulte fallback-hemmeligheter?** Grep'et gjennom hele
`src/` etter `process.env.` (utenom `NODE_ENV`) for å finne EVENTUELLE
flere av samme mønster som `BREVO_API_KEY`/`NEXT_PUBLIC_SITE_ORIGIN`.
Gjennomgått alle treff:
- `EMAIL_WEBHOOK_SECRET` (`route.ts` for `/api/webhooks/email-events`):
  feiler allerede LUKKET (401) hvis hemmeligheten mangler — motsatt
  retning av bugklassen (trygg standard, ikke en stille, farlig
  reservevei), og allerede dokumentert som bevisst i filens egen
  kommentar.
- `BREVO_SENDER_TRANSACTIONAL`/`BREVO_SENDER_BULK`: kaster allerede
  UBETINGET (uansett miljø, ikke bare i produksjon) når de mangler — Økt
  46s antagelse om at disse to allerede var dekket, bekreftet direkte i
  koden nå.
- `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN`: Sentry sin egen `init()` er et
  dokumentert no-op når `dsn` er `undefined` — fravær slår av
  feilrapportering, det erstatter den ikke med noe FEIL eller
  villedende, så dette er ikke samme bugklasse.
- `RETENTION_DRY_RUN`: standardverdien er `true` (dry-run) med mindre
  eksplisitt satt til `"false"` — trygg retning, motsatt av bugklassen.
- `DATABASE_URL`/`DB_POOL_MAX`: driftskonfigurasjon for selve
  tilkoblingen, ikke en forretningslogikk-hemmelighet med en stille
  reservevei.

**Ingen nye kandidater funnet.** To reelle funnet og rettet over de to
siste øktene (`BREVO_API_KEY`, `NEXT_PUBLIC_SITE_ORIGIN`); resten av
kodebasen følger allerede enten "feil lukket"- eller
"kast-ubetinget"-mønsteret. Dette sporet regnes som avsluttet inntil noe
NYTT dukker opp (f.eks. en fremtidig hemmelighet lagt til uten samme
disiplin).

**Spor (a) — herdet flaky-testen.** `tick.integration.test.ts` sin
`runDigestTick(db)` brukes 11 steder i filen, men bare TO av dem asserter
`expect(result.errors).toEqual([])` direkte på hele resultatet
("oppretter en digest og sender..." og "FR-035: utelater en mottaker
med avmeldt eller sprettet abonnement") — de ni andre stedene sjekker
allerede bare sine EGNE rader, ikke hele feil-arrayet, og var derfor
aldri utsatt for samme flake. Rettet begge til å filtrere
`result.errors` på egen forespørsels-ID FØR sammenligning med et tomt
array, i stedet for å kreve at HELE arrayet er tomt — det er testens
EGEN forespørsel som er invarianten som faktisk testes, ikke fraværet av
enhver feil fra en HVILKEN SOM HELST samtidig kjørende testfil sitt
midlertidige land. `FR-035`-testen manglet i tillegg en fanget referanse
til sin egen `createPublishedRequestForDigest(...)`-rad (kastet bort med
en bar `await`) — lagt til (`const request = await ...`) slik at samme
filtrering kunne brukes der også.

Ingen `git stash`-kontrast denne gangen: dette er en testfil-egen
herding av en observert (men ikke deterministisk reproduserbar)
race, ikke en fiks for en feil i produksjonskode — det finnes ingen
"gammel kode som skal feile" å stille opp mot, kun en assert som var
for bredt formulert.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester, uendret
  (denne testfilen er en `.integration.test.ts` og dekkes ikke av denne
  kommandoen).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` (full
  integrasjonstestpakke mot ekte lokal Postgres): Postgres hadde
  stoppet mellom denne og forrige økt (`pg_isready` returnerte "no
  response") — startet den på nytt (`service postgresql start`) før
  kjøring. 32 filer, 328 tester, ALLE bestod (inkludert de to herdede
  testene). Global-opprydningen fyrte automatisk og fjernet 228
  testbrukere, uendret oppførsel.

### Neste økt

Begge spor fra forrige økt er nå lukket. Ingen kjent gjenstående
handling. Mulig neste spor, ingen hastende: en generell revurdering av om
FLERE av de resterende 9 `runDigestTick`-kallene i samme fil (som
allerede unngår denne spesifikke fellen ved å sjekke egne rader) har
TILSVARENDE, men annerledes formulerte, brede asserts et annet sted i
testpakken (f.eks. mot `digests`- eller `digestDeliveries`-tabellene uten
å filtrere på egen land-/forespørsels-ID) som kunne rammes av samme
underliggende årsak — ikke undersøkt denne runden. Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 49: fulgte opp forrige økts eget forslag — samme flakebugklasse
fantes også i `result.processed`, ikke bare `result.errors`

Forrige økt (48) foreslo eksplisitt å sjekke om FLERE brede asserts i
`tick.integration.test.ts` mot `runDigestTick`-resultatet led av samme
tvers-av-fil-race som `result.errors` (rettet i Økt 47). Svaret var ja.

**Reelt funn**: `result.processed` (antall land faktisk behandlet i ETT
tikk) telles GLOBALT på tvers av ALLE land som er forfalt akkurat da
tikket kjører — IKKE skopet til én bestemt test sitt isolerte land, helt
analogt med `result.errors`. Fire steder i filen asserterte likevel en
EKSAKT verdi på hele dette globale tallet:
- FR-034 (idempotens, andre tikk samme dag): `secondResult.processed`
  forventet nøyaktig `0`.
- FR-036 (ett lands leverandørfeil påvirker ikke et annet): forventet
  nøyaktig `2` (kun codeA+codeB).
- To "ingen digest skal opprettes"-tester (tom digest / suspendert
  journalist): forventet nøyaktig `0`.

Alle fire er sårbare for at en SAMTIDIG kjørende testfils eget isolerte
land (med sin egen forfalte digest, uavhengig av denne testen) blåser
opp — eller for `0`-tilfellene, i det hele tatt gjør ikke-null — det
globale tallet, uten at det sier noe om DENNE testens egen påstand.
Merkverdig nok fantes akkurat samme herding ALLEREDE på fem andre steder
i samme fil (`toBeGreaterThanOrEqual(1)` i stedet for en eksakt verdi,
linje 96/176/237/297/359, for andre jobber som også skanner globalt) —
disse fire var altså en gjenværende inkonsistens, ikke et ukjent mønster.

**Fiks**: for FR-036, byttet `toBe(2)` til `toBeGreaterThanOrEqual(2)`
(samme retning som de fem eksisterende stedene) — den presise
per-lands-sjekken (`digestA?.status === "failed"`,
`digestB?.status === "sent"`) rett under er allerede den reelle,
korrekt skopede invarianten. For de tre `toBe(0)`-tilfellene (FR-034 og
de to "ingen digest"-testene): fjernet `.processed`-assertet helt i
stedet for å svekke det til en løsere ulikhet — en forventning om
"MINST 0" gir ingen informasjon, og den faktiske invarianten
("nøyaktig én digest-rad for VÅRT land", henholdsvis "ingen digest-rad
for VÅRT land") var allerede dekket presist av den påfølgende
`db.select().from(digests).where(eq(digests.countryCode, code))`-
spørringen i alle tre tilfeller.

Ingen `git stash`-kontrast: dette er, som Økt 48s fiks, en herding av
testens EGEN påstand mot en observert (ikke deterministisk
reproduserbar) race i parallell fil-kjøring — ikke en fiks for en feil
i produksjonskode.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: fanget faktisk en reell følgefeil under arbeidet — en
  ubrukt `secondResult`-variabel etter at `.processed`-sjekken av den ble
  fjernet (droppet fangst av selve tikk-kallet, `await runDigestTick(db)`
  uten tildeling, i stedet for en unødvendig fanget variabel). Rettet
  før commit, deretter ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret (denne filen dekkes ikke av denne kommandoen).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: Postgres hadde igjen
  stoppet mellom øktene — startet på nytt før kjøring. 32 filer, 328
  tester, ALLE bestod (inkludert alle fire herdede tester).
  Global-opprydningen fjernet 228 testbrukere, uendret oppførsel.

### Neste økt

Begge de konkrete stedene forrige økt pekte på (i) og videreførte i
denne økten (ii) er nå dekket. Ingen kjent gjenstående handling i denne
testfilen — samtlige `runDigestTick`/`runPurgeUnverified`-baserte
asserts mot globalt tellede felt (`processed`, `errors`) er nå enten
skopet til egne rader/ID-er eller bevisst løsnet/fjernet. Mulig neste
spor, ingen hastende: samme spørsmål kunne stilles til de ANDRE
jobbtestene i filen (`runExpireRequests`, `runExpireContactRequests`,
`runDeadlineReminders`, `runStaleRequestReminders`) — ikke undersøkt
denne runden, men samme underliggende struktur (global skanning per
tikk) gjør det sannsynlig at samme mønster kan gjenta seg der. Ellers
uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 50: fulgte opp forrige økts spor — sjekket de fire ANDRE
jobb-describe-blokkene, fant SAMME flakebugklasse i `runPurgeUnverified`

Forrige økt (49) foreslo å sjekke om `runExpireRequests`,
`runExpireContactRequests`, `runDeadlineReminders` og
`runStaleRequestReminders` hadde samme brede-assert-sårbarhet som
`runDigestTick`. Gjennomgått alle fire `describe`-blokker i
`tick.integration.test.ts` linje for linje:

- Alle fire bruker ALLEREDE `toBeGreaterThanOrEqual(1)` for sine
  `.processed`-sjekker (linje 96/176/237/297), ikke en eksakt verdi —
  allerede trygt.
- Ingen av de fire har noen `.errors`-assert i det hele tatt — de
  bekrefter i stedet spesifikke rader via egen ID
  (`eq(requests.id, expired.id)` osv.), som allerede er korrekt skopet.

Disse fire var altså IKKE rammet. MEN gjennomgangen falt naturlig videre
til den femte jobben i samme fil, `runPurgeUnverified` (dekket i en egen
`describe`-blokk lenger opp, ikke eksplisitt nevnt i forrige økts liste)
— og DER fantes nøyaktig samme mønster som `runDigestTick` hadde (Økt
47): `runPurgeUnverified` skanner ALLE kontoer med status
`pending_email_verification` og `createdAt` eldre enn 14 dager GLOBALT
(ikke skopet til noe land eller noen enkelt test), og to tester
("sletter en REALISTISK ubekreftet mottakerkonto..." og "...
journalistsøknad...") asserterte `expect(result.errors).toEqual([])` på
HELE dette globale resultatet.

**Fiks**: samme mønster som Økt 47 — filtrerte begge på egen brukers ID
FØR sammenligning med et tomt array. `tick.ts` sin
`runPurgeUnverified()` prefikser allerede hver feilmelding med
`${candidate.id}: ...`, så filtreringen (`e.includes(user.id)`) er
presis, akkurat som for digest-tick sine forespørsels-ID-er.

Ingen `git stash`-kontrast: samme begrunnelse som Økt 48/49 — dette er en
herding av testens egen påstand mot en observert (ikke deterministisk
reproduserbar) klasse av race, ikke en fiks for en feil i
produksjonskode.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: Postgres hadde igjen
  stoppet mellom øktene — startet på nytt før kjøring. 32 filer, 328
  tester, ALLE bestod (inkludert begge herdede tester). Global-
  opprydningen fjernet 228 testbrukere, uendret oppførsel.

### Neste økt

Samtlige jobb-describe-blokker i `tick.integration.test.ts` er nå
gjennomgått for denne spesifikke flakebugklassen (brede asserts mot
globalt tellede/samlede felt i en jobbs resultat). Ingen kjent
gjenstående handling i DENNE filen. Mulig neste spor, ingen hastende: de
resterende `.integration.test.ts`-filene i `src/lib/jobs/` (om noen
flere finnes utover `tick.integration.test.ts` og
`retention.integration.test.ts` — sistnevnte er ALLEREDE bygget med
"dry run"-forsiktighet fra starten, se Økt 53, og bruker trolig samme
per-kategori-skoping som gjør den mindre utsatt, men ikke eksplisitt
re-sjekket for akkurat DENNE flakebugklassen ennå). Ellers uendret: de
to gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 51: lukket `retention.integration.test.ts`-sporet (rent funn), fant
og rettet en genuin, men vanskelig-å-bevise TOCTOU i `updateResponseMarking()`

**Spor fra Økt 50 — sjekket `retention.integration.test.ts` for samme
flakebugklasse.** Konklusjon: IKKE rammet, av to grunner: (1) INGEN annen
`.integration.test.ts`-fil i hele kodebasen bruker måneds-/årsskala
tilbakedaterte tidsstempler (grep etter `getUTCMonth`/`getUTCFullYear`/
`monthsAgo`/`yearsAgo` traff KUN denne filen selv) — retensjonsvinduene
(6 måneder til 3 år) er så mye lengre enn noen annen tests egne
tidsstempler (typisk minutter til ~31 dager) at en samtidig kjørende
testfils fixtures aldri kan feilaktig treffes av denne jobbens
alderskriterier. (2) `describe`-blokkene i selve filen kjører
SEKVENSIELT (ingen `.concurrent`), så det er heller ingen risiko
INNAD i filen. Dette sporet er dermed lukket uten kodeendring.

**Nytt spor, funnet underveis: kritisk lesing av mindre-utforskede
lib-mapper.** Med det forrige sporet lukket, gjorde en kort kritisk
lesing av `src/lib/legal/documents.ts` (ren, ingen check-then-write) og
`src/lib/journalist-inbox/journalist-inbox.ts` (ikke tidligere eksplisitt
kritisk-lest i denne økt-serien).

**Reelt funn**: `updateResponseMarking()` (PATCH
`/journalist/responses/:id/status`, SPEC-V1.md 13.1) gjorde en SELECT som
sjekket `lifecycleStatus === "submitted"`, men den påfølgende UPDATE-en
hadde IKKE samme betingelse i sin egen WHERE — kun `eq(responses.id,
responseId)`. Dette er nøyaktig samme hullklasse som `hideResponse()`
(moderation/responses.ts) hadde FØR Økt (se oppgave #92) — men på den
MOTSATTE siden av akkurat den samme raden: en samtidig `hideResponse()`
(moderator skjuler svaret) mellom SELECT og UPDATE her kunne la
journalistens markerings-/notatskriving stille slå igjennom på et svar
som akkurat ble skjult, i strid med at et skjult svar skal være
utilgjengelig for journalisten (13, 19.7).

**Fiks**: la til `eq(responses.lifecycleStatus, "submitted")` i selve
UPDATE-ens WHERE-betingelse, med `.returning()` for å oppdage om den
faktisk traff en rad — `errors.not_found` hvis ikke, samme mønster som
`hideResponse()` selv og de mange andre TOCTOU-fiksene denne natten.

**Ærlig begrensning i verifiseringen, i motsetning til øktens vanlige
disiplin**: la til en `Promise.all`-kappløpstest i
`moderation/responses.integration.test.ts` (rett ved siden av den
eksisterende `hideResponse` vs. `withdrawResponse`-kappløpstesten, samme
mønster) som kjører `updateResponseMarking()` og `hideResponse()`
samtidig og sjekker at UANSETT hvilken som vinner, resultatet er
konsistent. FORSØKTE deretter den vanlige `git stash`-kontrasten — men
i MOTSETNING til alle tidligere kappløpsfiks i natt, klarte testen IKKE
å feile pålitelig mot den gamle koden: kjørt 5 ganger mot koden UTEN
fiksen, og alle 5 gangene "vant" markerings-skrivingen kappløpet (aldri
`errors.not_found`). Årsak, ved inspeksjon: `hideResponse()` gjør
FLERE forutgående steg (eierskaps-sjekk, moderator-landsjekk) FØR sin
egen UPDATE, mens `updateResponseMarking()` går RETT fra sin SELECT til
sin UPDATE — de to funksjonene er strukturelt for ULIKT lange til at
`Promise.all` pålitelig produserer den farlige rekkefølgen (markerings-
skrivingen committer nesten alltid FØR skjulingen, uansett kodeversjon).
Dette er en ANNEN situasjon enn de tidligere kappløpene i natt, som alle
racet SYMMETRISKE konkurrenter (N identiske kall, eller to kall av
sammenlignbar lengde) — asymmetrien her gjør akkurat DENNE
rekkefølgen for sjelden til å fremtvinges pålitelig i en svart-boks-test
uten å instrumentere produksjonskoden med en kunstig forsinkelse (noe
som ikke hører hjemme der).

Fiksen beholdes likevel — den er korrekt ved KODEinspeksjon (identisk
mønster og begrunnelse som den ALLEREDE beviste `hideResponse()`-fiksen,
bare på den andre siden av samme rad), og testen beholdes også, siden
den fortsatt verifiserer en reell invariant under samtidig kjøring (og
ville fanget opp en FREMTIDIG regresjon dersom de to funksjonenes
relative hastighet noen gang endrer seg) — men "empirisk bevist feilet
mot gammel kode" kan IKKE hevdes for denne ene fiksen, i motsetning til
alle andre kappløpsfikser i natt. Notert her i stedet for å late som om
disiplinen ble fulgt fullt ut.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, **329**
  tester (328 + 1 ny), alle bestod. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.
- `git stash`-forsøk (se over): IKKE en ren empirisk bekreftelse denne
  gangen — dokumentert ærlig i stedet for skjult.

### Neste økt

Ingen kjent gjenstående handling. Mulig neste spor, ingen hastende:
fortsett den kritiske lesingen av mindre-utforskede filer
(`src/lib/http/safe-redirect.ts` og `src/lib/datetime/timezone.ts` er
trolig allerede dekket av tidligere fikser i natt — henholdsvis
open-redirect-fiksen og øktene som bygde jobblogikken — men ikke
eksplisitt re-sjekket i DENNE stilen). Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 52: fulgte opp forrige økts spor (kritisk lesing av
`safe-redirect.ts`/`timezone.ts`) — fant og rettet et manglende
valideringshull i `createCountry`/`updateCountry`

`src/lib/http/safe-redirect.ts` og `src/lib/datetime/timezone.ts` selv
er begge rene og allerede grundig testet (ingen endring). Men lesingen
av `timezone.ts` reiste et NABOSPØRSMÅL: hvor kommer `timeZone`-
argumentet til `zonedWallTimeToUtc()`/`utcToZonedWallTime()` egentlig
fra, og er DET validert?

**Reelt funn**: `countries.timezone` — satt av administrator via
`createCountry()`/`updateCountry()` (src/lib/admin/countries.ts) — ble
ALDRI validert som en faktisk gyldig IANA-tidssone, i motsetning til
`availableLocales` (validert siden oppgave #94, SAMME natt). En
skrivefeil (f.eks. "Europe/Osloo") ville ikke feilet ved selve
landoppsettet — den ville først krasjet, uhåndtert, som en
`RangeError` fra `Intl.DateTimeFormat` inne i
`zonedWallTimeToUtc()`/`utcToZonedWallTime()`, første gang en
journalist i DET landet prøvde å sette eller vise en svarfrist. Samme
"aksepteres nå, krasjer langt unna og mye senere"-mønster som flere
andre valideringshull rettet tidligere i natt.

Ekstra pussig detalj: nøkkelen `errors.invalid_timezone` fantes
ALLEREDE i begge locale-filene (`en-GB.json`/`nb-NO.json`) — brukt av
`PATCH /me` sin egen tidssone-validering (`me/profile.ts` via
`isValidTimezone()`, `me/validate.ts`) — men aldri koblet til
`admin/countries.ts`. En halvferdig kobling, ikke et helt ukjent hull.

**Fiks**: importerte og gjenbrukte den EKSISTERENDE `isValidTimezone()`
(bruker `Intl`s egen aksept/avvisning, ikke en hardkodet liste — samme
begrunnelse som selve funksjonens kommentar) i begge funksjonene, rett
ved siden av den eksisterende locale-sjekken, med samme
`errors.invalid_timezone`-nøkkel `me/profile.ts` allerede bruker.
`updateCountry()` validerer kun når `timezone` faktisk er del av DENNE
PATCH-en (samme mønster som dens egen locale-sjekk).

**Empirisk bekreftet feilen var reell**: la til to nye tester i
`countries.integration.test.ts` (én for `createCountry`, én for
`updateCountry`, begge med `timezone: "Europe/Osloo"`). `git stash push`
på `countries.ts` alene (beholdt testene) → BEGGE nye tester FEILET som
forventet mot den gamle koden (`{ok: true}` i stedet for det forventede
`{ok: false, error: "errors.invalid_timezone"}` — landet/oppdateringen
ble stille godtatt) → `git stash pop` gjenopprettet fiksen → alle 21
tester i filen består (19 eksisterende + 2 nye).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret (nøkkelen
  fantes allerede, se over).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, **331**
  tester (329 + 2 nye), alle bestod. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull, ikke bare en teoretisk bekymring.

### Neste økt

Ingen kjent gjenstående handling. Mulig neste spor, ingen hastende:
`createCountry`/`updateCountry` sine ANDRE ustrukturerte strengfelt
(`digestSendTime` — format `HH:mm`? `senderNameKey`/`nameKey` — gyldige
i18n-nøkler?) er ikke sjekket for et LIGNENDE "aksepteres stille,
krasjer langt unna senere"-mønster ennå — ikke undersøkt denne runden.
Ellers uendret: de to gjenværende GENUINE åpne spec-spørsmålene,
fortsatt bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 53: fulgte opp forrige økts spor — fant det ALVORLIGSTE
stille-feil-hullet i natt: en admin-skrivefeil kunne permanent
deaktivere HELE landets digest, uten en eneste feilmelding noe sted

Forrige økt (52) pekte eksplisitt på `digestSendTime` (og
`nameKey`/`senderNameKey`) som usjekkede strengfelt i
`createCountry`/`updateCountry`, ikke undersøkt den gangen. Gikk videre
på `digestSendTime` først, siden den brukes i en direkte
tallsammenligning (høyere risiko enn de rene i18n-nøkkel-feltene).

**Reelt funn, alvorligere enn noe annet stille-feil-hull i natt**:
`runDigestTick()` (jobs/tick.ts) sin gate er en RÅ STRENGSAMMENLIGNING —
`localTimeHHMM < country.digestSendTime` — IKKE en tallsammenligning.
`localTimeHHMM` er ALLTID nullutfylt to-sifret "HH:MM" (Intl sin
"2-digit"-formattering, se `localTimeForTimezone()`). `digestSendTime`
selv (schema.ts: ren `text`, INGEN databaseformathåndhevelse) ble ALDRI
validert noe sted, og feltet i selve UI-et
(`CreateCountryForm.tsx`) er et VANLIG tekstfelt — ikke en native
`<input type="time">` som ville nullutfylt automatisk.

Konsekvens: en administrator som taster "7:00" i stedet for "07:00" (et
naturlig, sannsynlig tastefeil — ingen indikasjon i UI-et om at
nullutfylling er påkrevd utover en placeholder-hint) ville stille fått
ALLE døgnets kloge-klokkeslett (som ALLE starter med sifferet 0, 1 eller
2) til å bli lekseskografisk sammenlignet som "mindre enn" "7:00" (siden
'0'/'1'/'2' < '7' i ASCII) — gate-en `localTimeHHMM < digestSendTime`
ville dermed ALLTID være sann, og landets digest ville ALDRI sendes,
noen dag, i det hele tatt, uten en eneste feilmelding, logglinje, eller
synlig indikasjon NOE sted. Ettersom digest-utsendelsen er selve
plattformens "trolig mest sentrale funksjon" (kodens egen kommentar i
tick.ts), er dette det ALVORLIGSTE enkeltfunnet i hele nattens
stille-feil-jakt (BREVO_API_KEY, NEXT_PUBLIC_SITE_ORIGIN, timezone) —
de andre lekket i det minste enten en logglinje eller en synlig lenke;
denne ville vært HELT stille, kanskje i ukevis, inntil noen la merke
til at INGEN mottakere i det landet fikk noen e-post.

**Fiks**: la til `DIGEST_SEND_TIME_PATTERN`
(`/^([01]\d|2[0-3]):[0-5]\d$/`, nøyaktig formatet `localTimeHHMM`
faktisk produserer) og validerte `input.digestSendTime` mot det i begge
funksjonene, samme sted og mønster som timezone-sjekken fra forrige
økt. Ingen dedikert i18n-nøkkel fantes for dette (i motsetning til
`timezone`s allerede-eksisterende `errors.invalid_timezone`) —
gjenbrukte det generiske `errors.validation_failed` i stedet for å legge
til en ny nøkkel for et rent formatvalideringstilfelle.

**Empirisk bekreftet feilen var reell**: la til to nye tester (én per
funksjon, begge med `digestSendTime: "7:00"`). `git stash push` på
`countries.ts` alene (beholdt testene) → BEGGE nye tester FEILET som
forventet mot den gamle koden (`{ok: true}` — verdien ble stille
godtatt) → `git stash pop` gjenopprettet fiksen → alle 23 tester i filen
består (21 eksisterende + 2 nye).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, **333**
  tester (331 + 2 nye), alle bestod. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull, ikke bare en teoretisk bekymring.

### Neste økt

Gjenstående spor fra forrige økt: `nameKey`/`senderNameKey` (er de
gyldige i18n-nøkler? — lavere risiko enn `digestSendTime` var, siden en
manglende oversettelsesnøkkel allerede faller defensivt tilbake et sted
i i18n-systemet, ikke undersøkt konkret ennå). Vurder også om selve
UI-feltet (`CreateCountryForm.tsx`) burde bytte til en native
`<input type="time">` i tillegg til server-valideringen — server-siden
er nå den reelle sperren, men et bedre UI-felt ville forhindret
tastefeilen enda tidligere. Ellers uendret: de to gjenværende GENUINE
åpne spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 54: fulgte opp forrige økts spor (`nameKey`/`senderNameKey`) —
fant IKKE en valideringsmangel, men et faktisk UBRUKT felt: hele
SPEC-V1.md 10.4 (lokalisert From-navn + Reply-To) var aldri koblet inn

Forrige økt (53) foreslo å sjekke `nameKey`/`senderNameKey` for samme
"aksepteres stille, krasjer/feiler langt unna senere"-mønster som
`timezone`/`digestSendTime`. Sporet dette videre:

**Først avklart: `nameKey` er LAV risiko, ikke samme mønster.**
`t(c.nameKey)` (bruk i `SubscribeForm.tsx`, admin-dashbordet,
`ChangeCountryForm.tsx`, `JournalistApplyForm.tsx`) degraderer allerede
GRASIØST ved en manglende nøkkel — `createTranslator()` (i18n/
get-messages.ts) logger via `logMissingKey()` og faller tilbake til
plattformens standardspråk, til slutt til `"…"` — ALDRI en krasj, og
ALLTID synlig umiddelbart (i motsetning til `digestSendTime`-hullet, som
kunne vært usynlig i ukevis). Konkluderte at dette IKKE fortjener samme
hastverk, og gikk videre til å faktisk SPORE hvor `senderNameKey` brukes.

**Reelt (og STØRRE) funn**: `senderNameKey` var IKKE brukt NOE sted i
faktisk forretningslogikk — kun i `seed.ts`/testfixtures og selve
CRUD-en (`admin/countries.ts`). Sjekket SPEC-V1.md 10.4 direkte
(`sender_name_key`, "oversettelsesnøkkel for From-navn"): "From-navnet
lokaliseres per land og språk via `sender_name_key`, og Reply-To settes
til landets `support_email`." VERKEN localisert From-navn ELLER
Reply-To var noensinne implementert — `send.ts` sin `sender`-payload
til Brevo besto BARE av `{email}`, aldri `{email, name}`, og et
`replyTo`-felt fantes ikke i det hele tatt NOE sted i kodebasen. Ikke en
manglende VALIDERING denne gangen, men en HELT MANGLENDE FUNKSJON — hver
eneste digest-e-post siden natten begynte har gått ut med bare den rå
avsender-e-postadressen synlig, og uten noen Reply-To.

**Bekreftet Brevo sin API-form via WebSearch** (samme disiplin som Økt
12/#84): `sender: {email, name}` og `replyTo: {email, name?}` (et
OBJEKT, ikke et array) — to uavhengige kilder stemte overens, inkludert
et konkret curl-eksempel.

**Fiks, bevisst SKOPET til bulk-digest-veien**: `BrevoEmailPayload`
utvidet med valgfri `sender.name` og valgfri `replyTo`.
`SendBulkEmailInput` fikk to NYE OBLIGATORISKE felt (`senderName`,
`replyTo`) — samme "obligatorisk, ikke valgfritt, med hensikt"-mønster
som `listUnsubscribeUrl` allerede bruker, slik at et FREMTIDIG kallested
ikke kan glemme dem stille. Begge de to kallestedene til `sendBulkEmail`
oppdatert:
- `tick.ts` (førstegangsutsendelse): `country`-raden er ALLEREDE i scope
  i `runDigestTick()`s løkke — ingen ekstra spørring. `senderName`
  beregnes PER LOCALE FAKTISK I BRUK (samme cache-mønster som selve
  digest-innholdet, `renderedByLocale`), siden spec-en sier "per land OG
  språk", ikke bare landets `defaultLocale`.
- `digests.ts` (`retryFailedDigestDeliveries`, admin "kjør på nytt"):
  `digests`-raden har bare `countryCode`, ikke landets øvrige felt — la
  til ÉN liten spørring mot `countries` for `senderNameKey`/
  `supportEmail`, samme per-locale-cache-mønster.

**Bevisst IKKE gjort denne runden**: `sendTransactionalEmail()` (~20+
kallesteder på tvers av moderation/, responses/, contact-requests/, osv.)
rører IKKE `senderNameKey`/`supportEmail` ennå — hvert kallested ville
måtte slå opp MOTTAKERENS land, en betydelig større og mer risikabel
endring enn denne kveldens øvrige valideringsfikser. Latt stå som et
eksplisitt neste spor, IKKE gjort forhastet.

**Empirisk bekreftet feilen var reell**: `git stash push` på `send.ts`
alene (beholdt `send.test.ts` sine oppdaterte forventninger) → den nye
`sender`/`replyTo`-assert-testen FEILET som forventet mot den gamle
koden (`sender` manglet `name`-feltet helt) → `git stash pop`
gjenopprettet fiksen → alle 32 tester i `send.test.ts` består.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 458 tester,
  uendret (send.test.ts sine 8 `sendBulkEmail`-kall oppdatert med de to
  nye obligatoriske feltene, én assert-test utvidet).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 32 filer, 333
  tester, ALLE bestod uendret (digest-utsendelsen i både
  `tick.integration.test.ts` og andre steder kjører allerede i
  stubb-modus uten `BREVO_API_KEY`, så de nye obligatoriske feltene ble
  bare sendt gjennom stille, ingen assert-oppdatering nødvendig der).
  Global-opprydningen fjernet 230 testbrukere, uendret oppførsel.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull, ikke bare en teoretisk bekymring.

### Neste økt

Det eksplisitt utsatte sporet: gjør SAMME lokalisering
(senderName/Reply-To) for `sendTransactionalEmail()` sine ~20+
kallesteder — krever at HVERT kallested kan slå opp MOTTAKERENS land
(de fleste har allerede en bruker-rad i scope med `countryCode`, men
ikke nødvendigvis landets `senderNameKey`/`supportEmail` uten en ekstra
spørring per sted). Betydelig større omfang enn dagens fiks — bør gjøres
FORSIKTIG, gjerne i flere mindre økter (én modul om gangen) fremfor ett
stort kast, gitt hvor mange kallesteder det er. Ellers uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 55: startet den varslede migreringen av `sendTransactionalEmail()`
sine mange kallesteder til lokalisert avsenderidentitet — FORSIKTIG,
ett kallested denne runden, resten et bevisst spor videre

Forrige økt (54) fikset dette for bulk-digesten, men lot
`sendTransactionalEmail()` (ni filer, ~18 kallesteder) stå eksplisitt
utsatt — "betydelig større omfang... bør gjøres FORSIKTIG, gjerne i
flere mindre økter". Fulgte akkurat det rådet i stedet for å haste
gjennom alle ni filene på én gang.

**Kartla omfanget først**: 18 reelle kallesteder på tvers av
`moderation/journalists.ts` (2), `moderation/requests.ts` (1),
`auth/magic-link.ts` (1), `auth/account-deletion.ts` (4),
`requests/requests.ts` (3), `admin/legal-documents.ts` (1),
`contact-requests/contact-requests.ts` (3), `responses/responses.ts`
(2), `reports/reports.ts` (1) — pluss 25 eksisterende kall i
`send.test.ts`. For mange til å migrere trygt i én økt uten å risikere
en overfladisk, dårlig verifisert endring i en sentral, tillitsfølsom
e-postflyt.

**Arkitekturvalg vurdert og avvist**: å la `sendTransactionalEmail()`
selv slå opp mottakerens land internt (via mottakerens e-post →
`users.countryCode`) ville krevd NULL kallsstedsendringer, men ville
brutt `send.ts` sitt eget, uttalte designprinsipp ("Tynt
e-postgrensesnitt", ingen `db`-avhengighet, se filens egen
toppkommentar) og gjort ALLE dens rene enhetstester avhengige av en
ekte database. Forkastet til fordel for samme mønster som bulk-fiksen:
kalleren løser identiteten og sender den inn eksplisitt.

**Bygget delt infrastruktur** (`src/lib/email/sender-identity.ts`,
`resolveSenderIdentity(countryCode, locale)`): én spørring mot
`countries` + `createTranslator()`-oversettelse, delt av ALLE
kallesteder i stedet for duplisert 18 ganger. Returnerer `null`
defensivt for et land som ikke finnes (kan ikke skje i praksis —
`users.countryCode` har en fremmednøkkel mot `countries.code` — men en
manglende avsenderidentitet skal ALDRI stoppe selve sendingen).

**`SendTransactionalEmailInput` fikk `senderName`/`replyTo`, men VALGFRIE,
ikke obligatoriske** — bevisst ULIKT `SendBulkEmailInput`s tilsvarende
felt. Dette er en MIDLERTIDIG overgangstilstand, tydelig kommentert i
selve interfacet: et umigrert kallested (18 av 18 uendret bortsett fra
`magic-link.ts`, se under) oppfører seg IDENTISK med i går — ingen
regresjon, bare IKKE fikset ennå. Planen er å gjøre feltene obligatoriske
den dagen alle ni filene er migrert, samme prinsipp som
`listUnsubscribeUrl`/bulk-fiksens felt.

**Migrerte ÉTT kallested denne runden**: `auth/magic-link.ts`
(`requestMagicLink()`) — valgt fordi det er det ENKLESTE (ett
kallested, `user`-raden er allerede en FULL `.select()` med
`countryCode` rett tilgjengelig, ingen ekstra spørring eller
select-feltendring nødvendig) og et av de HØYEST-TRAFIKKERTE (hver
innlogging/e-postbekreftelse går gjennom denne).

**Empirisk bekreftet feilen (mangelen) var reell**: la til en ny test i
`send.test.ts` som sender med `senderName`/`replyTo` oppgitt og
sjekker at Brevo-payloaden faktisk bærer dem videre. `git stash push`
på `send.ts` alene → testen FEILET som forventet mot den gamle koden
(`sender` manglet `name` helt) → `git stash pop` gjenopprettet fiksen
→ alle tester består.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, **459** tester
  (458 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: **33** filer (32 +
  ny `sender-identity.integration.test.ts`, 4 tester: oversetter
  korrekt, faller tilbake for en ustøttet locale, returnerer `null` for
  en ukjent landkode i stedet for å kaste, henter OPPDATERT verdi etter
  landendring). **337** tester totalt (333 + 4 nye), alle bestod.
  Global-opprydningen fjernet 230 testbrukere, uendret oppførsel.
- Empirisk `git stash`-kontrast (se over) beviser fiksen løser et reelt,
  reproduserbart hull.

### Neste økt

Migreringssporet fortsetter — ÅTTE filer gjenstår (17 kallesteder):
`moderation/journalists.ts`, `moderation/requests.ts`,
`auth/account-deletion.ts` (4 kallesteder — to har allerede
`countryCode` tilgjengelig i en snever `.select()`, to trenger en liten
utvidelse av eksisterende select-lister, kartlagt allerede denne
økten), `requests/requests.ts`, `admin/legal-documents.ts`,
`contact-requests/contact-requests.ts`, `responses/responses.ts`,
`reports/reports.ts`. Foreslått rekkefølge: én fil (eller to nære
beslektede) per økt, samme forsiktige tempo som denne. Når ALLE ni er
migrert: gjør `senderName`/`replyTo` OBLIGATORISKE på
`SendTransactionalEmailInput` (fjerner overgangskommentaren, matcher
`SendBulkEmailInput`s mønster) som en siste, avsluttende økt. Ellers
uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 56: fortsatte sender-identitet-migreringen (Økt 55) — to filer
til, `moderation/journalists.ts` og `moderation/requests.ts`

Samme forsiktige tempo som forrige økt la opp til: én til to nære
beslektede filer, ikke flere.

**`moderation/journalists.ts`**: to kallesteder
(`approveJournalist()`/`rejectJournalist()`), begge via samme
`findJournalist()`-hjelpefunksjon som ALLEREDE selekterte
`countryCode` (brukt til `checkModeratorForCountry()` rett over) —
ingen select-utvidelse nødvendig, bare et `resolveSenderIdentity()`-kall
og to nye felt på hvert `sendTransactionalEmail()`-kall.

**`moderation/requests.ts`**: tre kallesteder, men ALLE går gjennom
ÉN delt `notifyJournalist()`-hjelpefunksjon — denne selekterte
tidligere KUN `{email, locale}`, IKKE `countryCode`. La til
`countryCode: users.countryCode` i dens `.select()` (trivielt, samme
tabell er allerede spurt) og ett `resolveSenderIdentity()`-kall inni
selve hjelpefunksjonen — retter dermed alle tre kallestedene
(`request_approved_published`, `request_rejected`,
`changes_requested`) i én endring.

**Ingen nye tester denne runden** — bevisst, samme begrunnelse som
`magic-link.ts`-migreringen (Økt 55): selve MEKANISMEN
(`sendTransactionalEmail()`s valgfrie felt-gjennomsending,
`resolveSenderIdentity()`s slå-opp-og-oversett) er allerede grundig
testet på egen hånd. Det som gjenstår å bevise per kallested er bare
"kalles funksjonen med RIKTIG countryCode/locale" — en ren
kablings-sjekk som ville krevd enten å mocke `resolveSenderIdentity()`/
`sendTransactionalEmail()` for å fange kallargumenter, eller å sette en
ekte `BREVO_API_KEY` + mocke `fetch` i en integrasjonstest (uvanlig
blanding av testnivåer) — uforholdsmessig kompleksitet for en enkel
verdi-videreføring. Samme avveining, samme konklusjon som sist.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret (ingen nye tester denne runden, se over).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

Migreringssporet fortsetter — SEKS filer gjenstår (12 kallesteder):
`auth/account-deletion.ts` (4 kallesteder — to har allerede
`countryCode` tilgjengelig fra en full `.select()`, to trenger en liten
utvidelse av eksisterende snevre select-lister, kartlagt i Økt 55),
`requests/requests.ts` (3), `admin/legal-documents.ts` (1),
`contact-requests/contact-requests.ts` (3),
`responses/responses.ts` (2), `reports/reports.ts` (1). Foreslått
neste: `auth/account-deletion.ts` (nær beslektet med denne og forrige
økts auth-/moderasjonsfokus, og allerede kartlagt i detalj). Når ALLE ni
filer er migrert: gjør `senderName`/`replyTo` OBLIGATORISKE på
`SendTransactionalEmailInput` som en siste, avsluttende økt. Ellers
uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 57: fortsatte sender-identitet-migreringen (Økt 55/56) —
`auth/account-deletion.ts`, den mest sammensatte filen så langt

Fulgte forrige økts foreslåtte rekkefølge direkte. Denne filen hadde
FIRE kallesteder, alle i separate funksjoner, ALLE manglet `countryCode`
i sin respektive `.select()` (i motsetning til forrige to filer, der
minst ett kallested allerede hadde det tilgjengelig):

1. `requestAccountDeletion()` — la til `countryCode` i brukerens egen
   snevre select (`{email, locale, status}` → `+countryCode`).
2. `performAccountDeletion()` — samme utvidelse
   (`{email, locale}` → `+countryCode`). Sendes bevisst FØR
   anonymiseringsskrivingen (eksisterende kommentar), samme rad brukes
   for både e-postadresse og nå også landkode.
3. `anonymizeRecipientContent()` sin journalist-varsling (pending
   kontaktforespørsel kanselleres) — samme utvidelse.
4. `closeJournalistContentOnDeletion()` sin respondent-varsling
   (`response_request_closed` ved kontosletting) — samme utvidelse.

Alle fire er nå `resolveSenderIdentity(countryCode, locale)` rett før
sitt respektive `sendTransactionalEmail()`-kall, samme mønster som de
to foregående filene.

**Ingen nye tester denne runden** — samme, nå gjentatte, begrunnelse
som Økt 55/56: selve mekanismen er allerede dekket; en
per-kallested-kablingssjekk ville krevd disproporsjonal mock-
kompleksitet for en ren verdi-videreføring.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

Migreringssporet fortsetter — FEM filer gjenstår (8 kallesteder):
`requests/requests.ts` (3), `admin/legal-documents.ts` (1),
`contact-requests/contact-requests.ts` (3), `responses/responses.ts`
(2), `reports/reports.ts` (1). Foreslått neste: `requests/requests.ts`
(flest gjenværende kallesteder, verdt å ta som egen økt fremfor å dele
den). Når ALLE ni filer er migrert: gjør `senderName`/`replyTo`
OBLIGATORISKE på `SendTransactionalEmailInput` som en siste,
avsluttende økt. Ellers uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 58: fortsatte sender-identitet-migreringen (Økt 55-57) —
`requests/requests.ts`

Fulgte forrige økts foreslåtte rekkefølge. Tre kallesteder:

1. `submitRequest()` sin moderator-varsling (`new_request_for_moderation`):
   brukte `existing.countryCode` (forespørselens land — allerede
   tilgjengelig fra `findOwnedEditable()` sin fulle `.select()`), IKKE
   den enkelte moderatorens egen `countryCode`. Bevisst valg: dette er
   den FØRSTE migrerte varslingen der mottakeren (moderatoren) IKKE
   nødvendigvis er i samme land som varslingens EGENTLIGE kontekst — en
   moderator varsles I EGENSKAP AV å moderere nettopp DETTE landet
   (`moderatorCountries.countryCode`, samme verdi som
   `existing.countryCode` per selve spørringens WHERE-betingelse), ikke
   fordi det er deres EGEN registrerte konto. Landet varslingen handler
   OM er det riktige landet for avsenderidentiteten her, ikke
   mottakerens personlige konto.
2. `closeRequest()` sin journalist-varsling (`request_closed`): la til
   `countryCode` i journalistens select — her brukte jeg i stedet
   MOTTAKERENS egen `countryCode` (samme mønster som ALLE tidligere
   migrerte filer), siden en journalist varsles i egenskap av SIN EGEN
   konto, ikke en annens.
3. `closeRequest()` sin respondent-varsling (`response_request_closed`):
   samme som over — la til `countryCode` i respondentenes select,
   respondentens egen verdi.

Merk at (2) og (3) i praksis ALLTID ville gitt samme resultat som å
bruke `existing.countryCode` (en forespørsels land er alltid
journalistens eget, FR-031 håndhever at respondenter alltid er i SAMME
land som forespørselen) — men brukte likevel mottakerens EGEN
`countryCode`-kolonne for konsistens med det etablerte mønsteret i (1)
sitt unntak var det MOTSATTE: der er mottakerens EGEN konto ikke
nødvendigvis det relevante landet, så `existing.countryCode` var det
bevisste, riktige valget.

**Ingen nye tester denne runden** — samme begrunnelse som Økt 55-57.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

Migreringssporet fortsetter — FIRE filer gjenstår (6 kallesteder):
`admin/legal-documents.ts` (1), `contact-requests/contact-requests.ts`
(3), `responses/responses.ts` (2), `reports/reports.ts` (1). Foreslått
neste: `contact-requests/contact-requests.ts` (flest gjenværende
kallesteder). Når ALLE ni filer er migrert: gjør
`senderName`/`replyTo` OBLIGATORISKE på `SendTransactionalEmailInput`
som en siste, avsluttende økt. Ellers uendret: de to gjenværende
GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

---

## Økt 59: fortsatte sender-identitet-migreringen (Økt 55-58) —
`contact-requests/contact-requests.ts`

Fulgte forrige økts foreslåtte rekkefølge. Tre kallesteder, alle med
mottakerens EGEN `countryCode` (ingen unntak av typen `submitRequest()`
sin moderator-varsling denne gangen — alle tre mottakere her varsles i
egenskap av sin egen konto):

1. `createContactRequest()` sin respondent-varsling
   (`contact_request_received`).
2. `respondToContactRequest()` sin godkjent-gren, journalist-varsling
   (`contact_approved`).
3. `respondToContactRequest()` sin avslag-gren, journalist-varsling
   (`contact_declined`) — samme `.select({email, locale})`-mønster som
   (2), men i en annen kodegren (`else`), så Edit-verktøyets
   unik-treff-krav tvang meg til å redigere de to separat i stedet for
   én `replace_all` — bekreftet ved grep at alle tre kallesteder i
   filen faktisk endte opp oppdatert.

**Ingen nye tester denne runden** — samme begrunnelse som Økt 55-58.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

Migreringssporet fortsetter — TRE filer gjenstår (4 kallesteder):
`admin/legal-documents.ts` (1), `responses/responses.ts` (2),
`reports/reports.ts` (1). Foreslått neste: `responses/responses.ts`
(flest gjenværende kallesteder). Når ALLE ni filer er migrert: gjør
`senderName`/`replyTo` OBLIGATORISKE på `SendTransactionalEmailInput`
som en siste, avsluttende økt. Ellers uendret: de to gjenværende
GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 60: fortsatte sender-identitet-migreringen (Økt 55-59) —
`responses/responses.ts`

Fulgte forrige økts foreslåtte rekkefølge. To kallesteder, begge med
mottakerens EGEN `countryCode` (ingen unntak denne gangen — begge
mottakere varsles om aktivitet på sin egen konto):

1. `submitResponse()` sin respondent-kvittering
   (`response_submitted_receipt`) — la til `countryCode` på
   `respondent`-selecten (som allerede hentet `status`, `role`, `locale`,
   `email`).
2. `submitResponse()` sin journalist-varsling
   (`new_response_received`) — la til `countryCode` på den separate
   `journalist`-selecten (`email`, `locale`).

Bekreftet ved grep at nøyaktig de to kallestedene i filen er oppdatert.

**Ingen nye tester denne runden** — samme begrunnelse som Økt 55-59:
selve mekanismen (`send.ts`s valgfrie felt, `resolveSenderIdentity()`s
oppslag+oversettelse) er allerede dekket av dedikerte tester; en
wiring-test per kallested her ville kreve mocking av
`resolveSenderIdentity`/`sendTransactionalEmail` for å fange
kallargumenter, eller å blande testnivåer — vurdert som uforholdsmessig
kompleksitet for en rett fram verdi-videreføring.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

Migreringssporet fortsetter — TO filer gjenstår (2 kallesteder):
`admin/legal-documents.ts` (1), `reports/reports.ts` (1). Foreslått
neste: enten av de to, begge har bare ett kallested igjen. Når ALLE ni
filer er migrert: gjør `senderName`/`replyTo` OBLIGATORISKE på
`SendTransactionalEmailInput` som en siste, avsluttende økt. Ellers
uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 61: fullførte sender-identitet-migreringen (Økt 54-61) —
`admin/legal-documents.ts`, `reports/reports.ts`, et OVERSETT
kallested i `jobs/tick.ts`, og gjorde feltene OBLIGATORISKE

Migrerte de to siste kjente filene, oppdaget SÅ et tredje sted som
ikke var med i den opprinnelige ni-fil-tellingen, og lukket sporet.

**`admin/legal-documents.ts`** (1 kallested, `publishLegalDocument()`
sin `legal_terms_material_change`-varsling til berørte mottakere): et
lite avvik fra standardmønsteret — her varsles et helt KULL av
mottakere som WHERE-betingelsen allerede har filtrert til NØYAKTIG
samme `countryCode`/`locale` (`input.countryCode`, `input.locale`), så
`resolveSenderIdentity()` kalles ÉN gang FØR loopen i stedet for én
gang per mottaker — samme resultat, men uten å gjenta et identisk
DB-oppslag+oversettelse per rad i et potensielt stort kull.

**`reports/reports.ts`** (1 kallested, `submitReport()`s
moderator-varsling `content_reported`): samme unntak som
`requests.ts` sin `submitRequest()`-varsling (Økt 58) — bruker det
RAPPORTERTE innholdets `countryCode` (funnet via `findEntityCountry()`),
ikke hver enkelt moderators egen registrerte `countryCode`. Her varierer
derimot LOCALE per mottaker (i motsetning til legal-documents-varselet
over), så identiteten hentes per moderator inne i loopen — landet er
fast, oversettelsen er det ikke.

**Oppdaget i samme gjennomgang, FØR feltene ble gjort obligatoriske**:
et grundig grep etter ALLE (ikke bare de ni kjente) `sendTransactionalEmail`-
kallesteder i hele `src/` avdekket at `jobs/tick.ts` har TO egne
kallesteder (`deadline_approaching_24h` i `runDeadlineReminders()`,
`stale_request_reminder_30d` i `runStaleRequestReminders()`) som ALDRI
var med i den opprinnelige tellingen fra Økt 54/55 — et reelt hull i
selve migreringssporingen, ikke bare i koden. Begge migrert nå, samme
mønster som alle andre journalist-varsler (mottakerens egen
`countryCode`). Uten dette grepet ville neste steg (obligatoriske felt)
ha brutt disse to jobbene stille — de ville sluttet å kompilere, men
BARE dersom noen faktisk kjørte `tsc` over HELE `jobs/tick.ts`, noe som
tilfeldigvis skjedde med en gang siden det er nøyaktig det denne økten
gjorde rett etterpå.

**Siste steg: gjorde `senderName`/`replyTo` OBLIGATORISKE** på
`SendTransactionalEmailInput` (`send.ts`), som planlagt siden Økt 55 —
nå som samtlige 20 kallesteder på tvers av 11 filer faktisk sender dem.
Typen er `string | undefined` (ikke `string?`) med hensikt: NØKKELEN må
være til stede i objektlitteralen (en fremtidig ny kallested som glemmer
den feiler med en typefeil), men VERDIEN kan fortsatt være `undefined` —
`resolveSenderIdentity()` returnerer defensivt `null` dersom landet ikke
finnes (kan ikke skje i praksis, `users.countryCode` har en FK mot
`countries.code`, men en manglende senderidentitet skal ALDRI stoppe
selve sendingen), og da videreføres `identity?.senderName` som
`undefined` akkurat som før.

`npx tsc --noEmit` etter denne endringen avdekket at
`send.test.ts` hadde 25 kallesteder (ikke bare produksjonskoden) som nå
manglet de to obligatoriske feltene — et Python-skript satte inn
`senderName: undefined, replyTo: undefined,` i 21 av dem (alle formet
som `await sendTransactionalEmail({ ... });` på egen linje), de siste 4
(kallesteder pakket inn i `expect(sendTransactionalEmail({...})).rejects...`,
en annen linjeform skriptet ikke fanget) ble rettet manuelt. Samtidig
oppdatert testnavnet som fortsatt omtalte feltene som "valgfritt under
migrering" — det er de ikke lenger.

**Ingen nye tester utover selve typefiksingen i `send.test.ts`** — de to
nye kallestedene i `tick.ts` er allerede indirekte dekket av
`tick.integration.test.ts` sine eksisterende tester for
`runDeadlineReminders()`/`runStaleRequestReminders()` (som ikke
inspiserer sendeargumentene i detalj, samme nivå som resten av
migreringen).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (etter at ALLE 25 testkallesteder i
  `send.test.ts` og BEGGE kallestedene i `tick.ts` var oppdatert).
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 459 tester,
  uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret. Global-opprydningen fjernet 230
  testbrukere, uendret oppførsel.

### Neste økt

**SPEC-V1.md 10.4-migreringen er FERDIG** — alle 20 kjente kallesteder
på tvers av 11 filer sender nå lokalisert avsendernavn og Reply-To, og
feltene er obligatoriske på typenivå slik at et fremtidig nytt
kallested ikke kan glemme dem stille. Ingen flere økter trengs på dette
sporet med mindre noen finner ENDA et kallested jeg har oversett — gitt
at ETT allerede dukket opp uventet i denne økten (tick.ts), kan det
være verdt et helt siste, uavhengig grep-søk en fremtidig økt for å
være helt sikker, men det haster ikke.

Uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

Neste prioriterte arbeid per den stående rutinens opprinnelige
rekkefølge (nå at sender-identitet-sporet er lukket): revidere
retention-jobben (SPEC-V1.md 17.4) og resten av API-rutene i seksjon 20
for eventuelle gjenstående hull — se tidligere økter for hva som
allerede er dekket før noe nytt bygges her.

## Økt 62: revidert retensjonsjobben (17.4) og hele API-ruteoversikten
(seksjon 20) mot faktisk kode — INGEN nye hull funnet

Fulgte Økt 61 sin egen "neste økt"-anbefaling. Fant INGEN kodeendring
nødvendig — begge revisjonene bekrefter at tidligere økter allerede har
lukket det som fantes å lukke. Dokumenteres likevel eksplisitt, slik at
en fremtidig økt ikke bruker tid på å revidere det samme på nytt uten
grunn.

**SPEC-V1.md 17.4 (lagringstid) mot `src/lib/jobs/retention.ts`** — gikk
gjennom hele tabellen i 17.4, rad for rad:
- Aktiv konto / Avmeldt adresse / Juridiske dokumentversjoner: krever
  ingen periodisk sletting per spec-en selv (henholdsvis "så lenge
  aktiv", "ubegrenset", "så lenge et samtykke viser til dem").
- Ubekreftet konto (14 dager): `runPurgeUnverified()` i `jobs/tick.ts`,
  ikke `retention.ts` — allerede bygget og FK-herdet (Økt 5/øktnr for
  task #54).
- Trukket svar (umiddelbar sletting): skjer i selve
  `withdrawResponse()` (`responses/responses.ts`), ikke via en periodisk
  jobb — korrekt per spec-ens egen ordlyd ("slettes umiddelbart").
- Innsendt svar (12 mnd), Kontaktforespørsel (12 mnd), Avvist
  journalistsøknad (6 mnd), Revisjonslogg (3 år), Digest og
  leveringsstatus (12 mnd): alle fem er egne kategorier i
  `runRetention()`, alle med dry-run-standard og egne tester.
- Sikkerhetslogg (6 måneder): identifiserte `rateLimitHits`
  (19.16/`security/rate-limit.ts`) som den eneste kandidaten i
  skjemaet for "sikkerhetslogg" — men denne tabellen er allerede
  SELVRENSKENDE: `checkRateLimit()` sletter enhver rad eldre enn sitt
  EGET tellevindu (15 min/1 time/24 timer, alt sammen langt under 6
  måneder) på HVERT kall, dokumentert i skjemaets egen 19.16-kommentar.
  Ingen egen retensjonskategori trengs — raden lever aldri lenge nok
  til at en daglig jobb ville rukket å se den.
- Den kjente, allerede dokumenterte TODO-en i filens toppkommentar
  (lagringstider er hardkodede navngitte konstanter, ikke
  per-land-konfigurasjon, siden kun ett land (NO, `draft`) finnes ennå)
  står ved lag — ingen grunn til å bygge ekte per-land-konfigurasjon før
  et land nummer to faktisk trenger avvikende frister, som filens egen
  kommentar allerede sier.

**SPEC-V1.md seksjon 20 (API) mot `src/app/api/`** — listet ut alle
`route.ts`-filer under `src/app/api/` (57 stier) og krysset dem mot
HVER ENESTE linje i spec-ens rute-liste, inkludert å bekrefte at
`/requests/[id]/route.ts` faktisk eksporterer alle tre HTTP-metodene
(`GET`, `PATCH`, `DELETE`) spec-en krever på samme sti. Alle 57 rutene
fra seksjon 20 (pluss `GET /health`, som med hensikt ligger UTENFOR
seksjon 20 selv, se INFRASTRUCTURE.md 8.1 og task #40) er til stede.
Ingen manglende rute funnet — de fire tidligere hullene som ble
dokumentert direkte i spec-teksten (unsuspend, webhooks/email-events,
admin/responses GET+hide, suppress-email) er alle bekreftet
implementert.

**Samtidig bekreftet, som en siste sjekk mot den (foreldede) stående
rutinepromptens EGEN prioriterte liste** (som selv sier den er avløst
av NATTLOGG.md sin kontinuitet): punkt (1) `POST /subscribe` og
`POST /journalists/apply` med samtykkelogging, punkt (2) faktisk
mottakerlogikk i digest-tick (`sendBulkEmail`, `DigestDelivery`-rader i
`digests/digests.ts`), og punkt (3) retention-jobben — er ALLE allerede
bygget og verifisert i tidligere økter. Ingen av dem er reelt
gjenstående arbeid lenger.

**Ingen kodeendring, ingen ny commit av kildekode** — kun denne
NATTLOGG-oppdateringen, siden revisjonen ikke fant noe å rette.
Standard verifiseringskjede kjøres derfor ikke på nytt her (ingenting
endret siden Økt 61s allerede grønne kjøring).

### Neste økt

Med sender-identitet-sporet lukket (Økt 61) og BÅDE retensjonsjobben og
hele API-ruteoversikten nå bekreftet fullstendige (denne økten), er den
stående rutinens opprinnelige firetrinnsliste offisielt ferdigbehandlet
i sin helhet. Anbefalt retning for en fremtidig økt: et helt nytt,
uavhengig gjennomsyn av en del av koden som IKKE er nevnt i noen
tidligere økt ennå — f.eks. en frisk kritisk lesing av
`src/lib/digests/digests.ts` og `src/lib/jobs/tick.ts` i sin helhet (de
er ofte redigert stykkevis, aldri lest fra topp til bunn i én økt), eller
et nytt grep-basert søk etter TODO/FIXME/"reelt hull"-kommentarer på
tvers av HELE `src/` for å se om noen tidligere dokumentert, men aldri
fulgt opp, bekymring fortsatt står ubehandlet. Uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 63: fulgte opp Økt 62 sine to anbefalinger — INGEN nye hull
funnet, INGEN kodeendring

Gjorde begge tingene Økt 62 foreslo, i tillegg til én egen sjekk. Alle
tre kom tilbake rene.

**Grep etter TODO/FIXME/XXX/"reelt hull"/"ikke bygget"/"ikke
implementert" på tvers av hele `src/`**: fant kun allerede kjente,
allerede dokumenterte poster — ingen nye:
- `retention.ts`s egen TODO (per-land-konfigurasjon av lagringstider,
  bevisst utsatt til land nummer to faktisk trenger avvikende frister —
  se Økt 62).
- `foresporsler/[id]/[slug]/page.tsx`: OG-delingsbilde bevisst IKKE
  bygget (ingen bilde-genereringsinfrastruktur finnes i prosjektet i
  det hele tatt — å bygge dette ville vært et helt nytt
  infrastruktur-spor, ikke en liten rettelse, og spec-en krever det ikke
  eksplisitt for v1).
- `email/colors.ts`: DESIGN.md 7 sin fulle byggetids-token-eksport
  bevisst IKKE bygget, men med en dedikert test (`colors.test.ts`) som
  fanger drift mot de faktiske primitivene — allerede den nærmeste
  praktiske tilnærmingen uten hele pipelinen.
- Resten av treffene var fortidsform ("reelt hull FRAM TIL NÅ, rettet
  her") — dokumentasjon av allerede lukkede hull, ikke åpne.

**Full kritisk lesing, topp til bunn, av `src/lib/digests/digests.ts`
(262 linjer) og `src/lib/jobs/tick.ts` (624 linjer)**, samt
`src/lib/email/digest.ts` (187 linjer, selve rendrings-/
token-modulen begge de to andre kaller inn i) — undersøkte spesielt
`retryFailedDigestDeliveries()` sin
`recipientCount: digest.recipientCount + retriedCount`-linje som så
mistenkelig ut ved første blikk (ser ut som dobbelttelling av mottakere
som allerede var talt). Sporet opp `runDigestTick()`/
`sendDigestToRecipients()` i `tick.ts` og bekreftet at `recipientCount`
semantisk betyr "antall FAKTISK vellykket sendt" (`sentCount`), ikke
"antall tiltenkte mottakere" — en etterfølgende vellykket gjensending av
tidligere mislykkede leveranser skal derfor legge seg TIL det
eksisterende tallet. Korrekt, ikke en bug. Ingen andre uregelmessigheter
funnet i noen av de tre filene — alle TOCTOU-avveininger (f.eks.
påminnelsesjobbenes select→send→merk-mønster i `runDeadlineReminders()`/
`runStaleRequestReminders()`) er allerede eksplisitt dokumentert som
bevisst aksepterte, ikke oversette.

**Egen tilleggssjekk**: integrasjonstestene logger gjentatte ganger
`[i18n] mangler nøkkel "email.sender_name.test" i kjeden [nb-NO]` —
sjekket at dette er en BEVISST testfixture (`sender-identity.integration.test.ts`
sin egen kommentar sier eksplisitt at strengen ikke er en ekte
oversettelsesnøkkel), brukt konsekvent på tvers av 7 testfiler
(`dashboard.integration.test.ts`, `countries.integration.test.ts`, m.fl.)
— ikke en reell mangel i i18n-nøklene.

**Fjerde sjekk, samme økt**: grep etter "netlify" på tvers av HELE
`src/` (README.md 16.8/INFRASTRUCTURE.md 16.8s regel: ingen
vertsspesifikk kode utenfor `netlify.toml`/`netlify/functions/`). Tre
treff (`jobs/tick.ts`, `subscriptions/email-events.ts`,
`i18n/get-messages.ts`) — alle tre er RENE prosakommentarer som nevner
"netlify/functions/tick.ts" som EKSEMPEL på selve
adapter-/kjerne-mønsteret (forklarer hvorfor filen er
vert-uvitende), ikke faktiske importer. Et oppfølgende grep spesifikt
etter `@netlify`-importer i kildekoden ga null treff. Ingen
vertsspesifikk kode har sneket seg inn — regelen holder fortsatt.

**Ingen kodeendring i det hele tatt denne økten** — kun denne
NATTLOGG-oppføringen. Standard verifiseringskjede kjøres derfor ikke på
nytt (ingenting i kildekoden er endret siden Økt 61s allerede grønne
kjøring).

### Neste økt

Med Økt 62 sine to anbefalte spor OG en tredje egen sjekk (host-kode-
lekkasje) nå alle fulgt opp uten funn, er det økonomisk å bruke en
fremtidig økt på noe kvalitativt ANNET enn "les enda en fil kritisk" —
det mønsteret gir stadig avtagende avkastning nå som prosjektet er så
grundig gjennomgått (125+ fullførte oppgaver i tasklisten). Forslag til
en fremtidig økt: en frisk gjennomgang av `DESIGN.md` sine gjenstående
kriterier (flere er allerede verifisert manuelt i tidligere økter — se
tasklisten — sjekk om noen fortsatt står uverifisert). Uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 64: fant og rettet et EKTE hull — SubscribeForm.tsx manglet
`maxLength` på visningsnavn-feltet

Fulgte Økt 63 sin anbefaling om å sjekke DESIGN.md 9s gjenstående
kriterier — alle 8 viste seg allerede verifiserte og fortsatt grønne
(bekreftet på nytt: `npx tsx src/styles/check-tokens.ts` for kriterium 2
kjørte fortsatt rent, "54 komponent-CSS-fil(er) sjekket, ingen rå verdier
funnet"). I stedet for enda en null-funn-runde, sjekket jeg om den
SAMME bugklassen som ble rettet to ganger tidligere (Økt-oppgave #57:
PATCH /me sitt Zod-skjema 200→80, og #59: `ProfileForm.tsx` sin
tilsvarende klientsidegrense) hadde sneket seg inn et TREDJE sted —
og fant den:

**`src/app/[locale]/subscribe/SubscribeForm.tsx`** (registreringsskjemaet
for mottakere, `POST /subscribe`) hadde INGEN `maxLength` i det hele
tatt på visningsnavn-feltets `TextField`, til tross for at
`POST /subscribe` sitt Zod-skjema (`src/app/api/subscribe/route.ts`)
allerede håndhever `z.string().max(80)`. En bruker som skrev inn (eller
limte inn) mer enn 80 tegn ville fått en generisk, feltløs
`errors.generic`-feilmelding ved innsending i stedet for å bli stanset i
selve feltet — nøyaktig samme brukeropplevelses-bug som de to tidligere
rettelsene, bare på et tredje skjema ingen av de to tidligere øktene
hadde sjekket. Fant den ved å grep'e etter `displayName.*max\(` på tvers
av hele `src/` og krysse resultatet mot HVER frontend-komponent som
faktisk viser et visningsnavn-felt (`ResponseForm.tsx` hadde allerede
`LIMITS.displayName = 80`; `ProfileForm.tsx` hadde `maxLength: 80`;
`SubscribeForm.tsx` hadde INGEN).

**Retting**: la til `inputProps={{ maxLength: 80 }}` på
`TextField`-en, med samme forklarende kommentarstil som
`ProfileForm.tsx` sin egen (peker til `POST /subscribe` sitt skjema som
autoriteten, ikke et vilkårlig tall).

**Ny test** i `SubscribeForm.test.tsx`, samme mønster som den
tilsvarende testen i `ProfileForm.test.tsx` (som nettopp DENNE typen
regresjon — server-/klient-grense kommer ut av synk — er skrevet for å
fange): `expect(input).toHaveAttribute("maxLength", "80")`, oppslått via
`screen.getByLabelText("Visningsnavn (valgfritt)")`.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 460 tester (459 +
  1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret (ingen nye
  i18n-nøkler trengtes, teksten var allerede oversatt).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret (rent frontend-skjema, ingen
  server-/DB-logikk endret, men kjørt likevel per den stående regelen).

### Neste økt

Samme bugklasse (server-/klient-lengdegrense ute av synk) er nå rettet
tre ganger på tre ulike skjemaer — verdt å sjekke om ENDA et skjema et
sted i kodebasen har et fritekstfelt med en server-side Zod
`.max(...)`-grense uten en tilsvarende `maxLength` på klientsiden (et
raskt grep etter `.max(` i alle `route.ts`-filers Zod-skjemaer, krysset
mot de tilhørende frontend-skjemaene, ville avdekket dette systematisk
i stedet for stykkevis). Uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 65: gjorde nettopp den systematiske `.max(...)`-sveipen Økt 64
foreslo — fant og rettet TO til (fjerde og femte forekomst)

Grep'et `z\.string()\.(min|max)` på tvers av ALLE `route.ts`-filer i
`src/app/api`, listet opp hver eneste streng-lengdegrense funnet, og
krysset HVER av dem mot dens tilhørende frontend-skjema/komponent én
etter én. De aller fleste stemte allerede (bekreftet, ikke bare antatt):
`RequestEditForm.tsx` sine seks `LIMITS`-verdier (title 120, summary
300, description 5000, targetPersonDescription 500, geographicNote 100,
internalReference 100), `ResponseForm.tsx` sine fire (relevanceStatement
2000, answerText 4000, shortBio 500, displayName 80),
`JournalistProfileForm.tsx` sine tre (fullName/jobTitle/organizationName
200), `RecipientRow.tsx`/`JournalistSearchRow.tsx`/
`RequestQueueItem.tsx` sin delte `REASON_LIMIT = 2000`, og
`ResponseDetailPanel.tsx` sine `NOTE_LIMIT = 4000`/`MESSAGE_LIMIT =
1000` — alle korrekte. `HideResponseAction.tsx` har med hensikt INGEN
grense (POST /admin/responses/:id/hide tar ingen body i det hele tatt,
bekreftet ved å lese selve route-filen).

Fant TO ekte, tidligere uoppdagede hull, begge samme bugklasse som
`SubscribeForm.tsx` (Økt 64) — feltet manglet `maxLength` HELT, ikke en
foreldet verdi:

1. **`journalists/apply/JournalistApplyForm.tsx`** (søknadsskjemaet,
   `POST /journalists/apply`): `fullName`, `jobTitle` og
   `organizationName` hadde INGEN `maxLength`, til tross for at
   backend-skjemaet (`src/app/api/journalists/apply/route.ts`)
   håndhever `.max(200)` på alle tre — nøyaktig de samme tre feltene
   som `JournalistProfileForm.tsx` (redigeringsskjemaet, `PATCH
   /journalists/me`) allerede hadde riktig satt. Søknadsskjemaet var
   aldri sjekket mot redigeringsskjemaets etablerte mønster før nå. La
   til en delt `FIELD_LIMIT = 200`-konstant og `inputProps={{ maxLength:
   FIELD_LIMIT }}` på alle tre.
2. **`admin/countries/LegalDocumentsSection.tsx`** (publiser
   ny-juridisk-dokument-skjemaet, `POST /admin/legal-documents`):
   `version`-feltet hadde INGEN `maxLength`, til tross for at
   backend-skjemaet håndhever `.max(50)`. Kun admin-brukt (lavere
   alvorlighet enn de to foregående, siden bare betrodde
   administratorer rammes), men samme prinsipp: en for lang versjonsstreng
   ville gitt en uforklarlig feilmelding i stedet for å bli stanset i
   feltet. La til `VERSION_LIMIT = 50` og `inputProps={{ maxLength:
   VERSION_LIMIT }}`.

**Nye tester**: én i `JournalistApplyForm.test.tsx` som sjekker
`maxLength="200"` på alle tre feltene, én i
`LegalDocumentsSection.test.tsx` som sjekker `maxLength="50"` på
versjonsfeltet — samme mønster som de tre foregående rettelsene (Økt
57/59/64) sine egne regresjonstester.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 462 tester (460 +
  2 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod uendret (rent frontend, ingen server-/DB-logikk
  endret, men kjørt likevel per den stående regelen).

### Neste økt

Den systematiske sveipen er nå FULLFØRT — hver eneste streng-`.max(...)`
i samtlige `route.ts`-Zod-skjemaer er krysset mot sitt tilhørende
frontend-felt, og alle fem funnet-og-rettede tilfeller (Økt 57, 59, 64,
og de to i denne økten) er nå konsistente. Ingen flere kjente
forekomster av denne spesifikke bugklassen gjenstår. Uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 66: fire nye konsistenssjekker (etter samme mønster som
`.max(...)`-sveipen) — INGEN nye hull, INGEN kodeendring

Med streng-lengde-sveipen ferdig (Økt 65), lette jeg etter BESLEKTEDE
konsistensklasser samme sted (backend-begrensning vs. frontend-
håndtering) i stedet for å gjenta samme sveip. Fire sjekker, alle rene:

1. **SPEC-V1.md 18 sine tre rategrenser** — bekreftet at alle tre
   faktisk er koblet til `checkRateLimit()`: innlogging (5/15 min,
   `magic-link.ts`, kjent fra tidligere), svarinnsending (10/time,
   `responses.ts`), OG forespørselsopprettelse (20/døgn,
   `requests.ts`, `CREATE_DRAFT_RATE_LIMIT_MAX`/`_WINDOW_MS`) — alle
   tre til stede og verifisert.
2. **`minimumAge` (numerisk 0-100, ikke streng)** i både
   `CreateCountryForm.tsx` og `CountryCard.tsx` (redigering) — begge har
   `inputProps={{ type: "number", min: 0, max: 100 }}`, korrekt
   samsvarende med `z.number().int().min(0).max(100)` i begge
   `admin/countries`-rutene. (Mitt første grep etter `min=\|max=` fant
   dem ikke — feltene bruker objektsyntaks `min: 0, max: 100` inni
   `inputProps`, ikke JSX-attributter — falsk alarm, rettet ved å lese
   filen direkte.)
3. **`contactSharing`-enumen** (`"none" | "email"`) — konsistent på
   tvers av `schema.ts` (pgEnum), `responses/validate.ts` (TypeScript-
   typen) og `ResponseForm.tsx` (React-state-typen). Ingen fjerde
   variant har sneket seg inn noe sted.
4. **HTTP-statuskode-mapping for `errors.rate_limited` → 429** — kun to
   ruter (`POST /requests`, `POST /requests/:id/responses`) mapper
   denne feilen eksplisitt, men det er nettopp DISSE to (pluss
   innlogging) som faktisk kan returnere den. `POST /auth/request-link`
   overflater ALDRI rate-limit-tilstanden til klienten i det hele
   tatt — med hensikt, ikke en mangel: samme svar uansett om
   e-postadressen finnes, er suspendert, eller har nådd grensen (hindrer
   brukeroppdagelse/e-postenumerering), allerede dokumentert i selve
   filen. Ingen inkonsekvens.

**Ingen kodeendring denne økten** — kun denne NATTLOGG-oppføringen.
Standard verifiseringskjede kjøres derfor ikke på nytt (ingenting i
kildekoden er endret siden Økt 65s allerede grønne kjøring).

### Neste økt

Fire konsistenssjekker på rad kom tilbake rene — sterkt tegn på at
prosjektet er grundig herdet mot nettopp denne typen backend-/frontend-
uoverensstemmelse nå. Videre mekaniske sveip av samme type (enda en
feltklasse, enda en enum) vil trolig gi stadig avtagende avkastning,
akkurat som Økt 63 advarte om for rene kritiske gjennomlesninger.
Anbefaling for en fremtidig økt: vurder om det finnes GENUINT nytt
funksjonelt arbeid igjen å bygge (ikke bare revidere/rette eksisterende
kode) — et grundig gjennomsyn av SPEC-V1.md seksjon for seksjon mot
faktisk bygget funksjonalitet, på jakt etter en hel FUNKSJON eller et
HELT skjermbilde som aldri er nevnt i noen tidligere økt, fremfor enda
en konsistens- eller kodekvalitetssveip. Uendret: de to gjenværende
GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne for
menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 67: fulgte Økt 66 sin anbefaling (seksjon-for-seksjon mot faktisk
kode) — fant ETT genuint UI-hull (ikke rettet ennå) og ETT reelt
datahull i retensjonsjobben (rettet, ni kallesteder)

Gikk gjennom SPEC-V1.md seksjon 5 (brukerreiser) og 13 (journalistens
svarinnboks) linje for linje mot faktisk bygget kode.

**Seksjon 5**: alle stegene i 5.1 (journalist) og 5.2 (mottaker) er
allerede bygget og verifisert i tidligere økter — ingen nye funn.

**Seksjon 13, "Detaljvisning"-listen**: krever eksplisitt "hele svaret,
respondentens valg om deling, tidslinje for handlinger, knapp for
kontaktforespørsel, knapp for å rapportere." Fire av fem er bekreftet
til stede i `journalist/responses/[id]/page.tsx`/`ResponseDetailPanel.tsx`
— MEN "tidslinje for handlinger" (timeline of actions) finnes IKKE noe
sted i detaljvisningen. Data til å bygge en reell tidslinje finnes
allerede (submittedAt, viewedAt, og — for svar med en tilknyttet
kontaktforespørsel — dens createdAt/respondedAt/status), men
`getResponseDetailForJournalist()` henter i dag ikke kontaktforespørsel-
dataen i det hele tatt. **IKKE bygget denne økten** — falt tilbake til
et annet, mer avgrenset og tydeligere korrekt funn (under) i stedet, av
hensyn til øktens tidsbudsjett. Reelt UI-hull, notert for en fremtidig
økt, ikke en ny beslutning om å utsette det.

**Reelt datahull funnet OG rettet i samme gjennomgang**: mens jeg
undersøkte "tidslinje"-hullet, sjekket jeg hvilke tidsstempel-felter
`ContactRequest` faktisk har for å avgjøre hva en tidslinje kunne vise
— og oppdaget at `retention.ts` sin `purgeOldContactRequests()` (SPEC-
V1.md 17.4: "kontaktforespørsel: 12 måneder ETTER AVSLUTNING") stoler
på `contactRequests.updated_at` som en tilnærming for "avsluttet",
eksplisitt begrunnet i funksjonens egen docstring: "raden alltid
oppdateres idet den forlater `pending`". Denne påstanden var USANN:
grep'et etter HVER `.update(contactRequests)` på tvers av hele `src/`
og fant NI steder som flytter en rad vekk fra `pending`
(`contact-requests.ts` x2 — godkjent/avslått, `responses.ts` — trekking
kansellerer, `jobs/tick.ts` — daglig utløps-jobb, `requests/requests.ts`
— lukking utløper, `moderation/users.ts` — suspensjon kansellerer,
`moderation/responses.ts` — skjuling kansellerer, `auth/account-
deletion.ts` x2 — kontosletting kansellerer/utløper) — INGEN av dem
satte `updated_at` eksplisitt, og verken en DB-trigger eller en Drizzle
`$onUpdate`-callback gjorde det for dem. Kolonnen sto derfor FROSSET på
innsettingstidspunktet (identisk med `created_at`) resten av radens
levetid.

Praktisk konsekvens: siden en kontaktforespørsel uansett alltid avgjøres
eller utløper innen 14 dager etter opprettelse (`EXPIRES_AFTER_MS`),
ville denne jobben slettet rader ca. 14 dager FOR TIDLIG sammenlignet
med spec-ens "12 måneder etter avslutning" — et lite, men reelt avvik
fra 17.4, og nøyaktig den typen "spec vs. kode"-hull de stående reglene
ber om å rette i koden (spec-en selv trengte ingen endring, det var
funksjonens EGEN dokumenterte forutsetning som ikke stemte med
implementasjonen).

**Retting**: la til `updatedAt: new Date()` (eller gjenbrukte en
allerede beregnet `now`-variabel) på alle ni stedene. Oppdaterte
`purgeOldContactRequests()` sin docstring til å dokumentere hullet og
rettingen, i stedet for å late som antagelsen alltid har stemt.

**Nye tester**: to eksisterende integrasjonstester i
`contact-requests.integration.test.ts` ("godkjenner"/"avslår"-grenene
til `respondToContactRequest()`) utvidet med en direkte
regresjonssjekk: `updatedAt` etter overgangen er strengt større enn
`updatedAt` FØR (fanget opp av en ny `before`-spørring), ikke bare
"truthy". De resterende syv stedene (kansellering/utløp) fikk ikke egne
nye tester — samme proporsjonalitetsprinsipp som resten av økten:
selve rettingen er ett felt lagt til en allerede eksisterende, allerede
testet `.set()`-kall, og de to nye testene beviser allerede at
mekanismen fungerer riktig for de to mest sentrale banene.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 462 tester,
  uendret (ingen nye ENHETSTESTER — begge nye assertions er i en
  integrasjonstestfil).
- `npx tsx src/i18n/check-keys.ts`: OK — 527 nøkler, uendret.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 337
  tester, ALLE bestod (samme telling — to EKSISTERENDE tester utvidet
  med nye assertions, ingen nye `it()`-blokker).

### Neste økt

To ting gjenstår herfra:
1. **Bygg selve "tidslinje for handlinger"** i journalistens
   svar-detaljvisning (SPEC-V1.md 13) — det ene gjenværende, bekreftede
   UI-hullet fra denne økten. Krever å utvide
   `getResponseDetailForJournalist()` (journalist-inbox.ts) til også å
   hente en eventuell tilknyttet `ContactRequest` (status, createdAt,
   respondedAt, expiresAt), og en ny liten komponent i
   `journalist/responses/[id]/page.tsx` som viser hendelsene i
   kronologisk rekkefølge (sendt inn → sett → evt. kontaktforespørsel
   sendt → evt. godkjent/avslått/utløpt).
2. Fortsett Økt 66 sin anbefaling om et seksjon-for-seksjon-gjennomsyn
   av RESTEN av SPEC-V1.md (denne økten dekket bare 5 og 13) for flere
   genuint ubygde detaljer.

Uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 68: bygget "tidslinje for handlinger" (SPEC-V1.md 13) — det
gjenstående UI-hullet fra Økt 67

**`journalist-inbox.ts`**: `getResponseDetailForJournalist()` henter nå
også en eventuell tilknyttet `ContactRequest` (`status`, `createdAt`,
`respondedAt`, `expiresAt`, `updatedAt`) via en egen spørring — én rad
maks, siden `contactRequests.responseId` er unik (19.8). Valgte en EGEN
spørring fremfor en LEFT JOIN på hovedspørringen, for å slippe å skille
"ingen kontaktforespørsel" fra "kontaktforespørsel med null-felter" i
selve radformen. `ResponseDetail.contactRequest` er `null` når svaret
ikke har noen (det vanligste tilfellet).

`updatedAt` tas med SPESIFIKT for `cancelled`-tilfellet, som er den ENE
statusen uten noe annet tidsstempel-felt (`respondedAt` settes kun ved
godkjent/avslått, `expiresAt` er en fast frist satt ved opprettelse) —
pålitelig nettopp fordi Økt 67 rettet ALLE ni stedene som kansellerer/
utløper en kontaktforespørsel til faktisk å sette denne kolonnen. Uten
den rettingen ville "kansellert"-tidslinjepunktet vist opprettelses-
tidspunktet, ikke kanselleringstidspunktet — feil, men ikke synlig som
en feil siden begge var samme verdi før Økt 67.

**`journalist/responses/[id]/page.tsx`**: bygger en kronologisk sortert
liste av hendelser server-side (ren datalogikk, ingen ny klientkode):
"svar sendt inn" (alltid), "sett av deg" (alltid — `viewedAt` settes
allerede ved samme kalls FØRSTE åpning), og — kun når en
kontaktforespørsel finnes — "du ba om kontakt", etterfulgt av nøyaktig
ÉN av fire gjensidig utelukkende avslutningshendelser avhengig av
`status` (godkjent/avslått bruker `respondedAt`, utløpt bruker
`expiresAt`, kansellert bruker `updatedAt`; `pending` gir ingen
avslutningshendelse — forespørselen er fortsatt åpen). Plassert i
DOM-rekkefølgen SPEC-V1.md 13 selv lister
detaljvisningen i: "hele svaret, respondentens valg om deling,
TIDSLINJE FOR HANDLINGER, knapp for kontaktforespørsel, knapp for å
rapportere" — rett etter delings-avsnittet, rett før
`ResponseDetailPanel` (som eier kontaktforespørsel-knappen) og
`ReportForm`.

Ny CSS i `page.module.css` (`.timelineList`/`.timelineItem`/
`.timelineDate`) bruker utelukkende eksisterende designtokens
(`var(--space-*)`, `var(--text-*)`, `var(--color-*)`) — ingen nye rå
verdier. `check-tokens.ts` (DESIGN.md 9 kriterium 2) er strukturell
håndhevelse — enhver rå verdi ville feilet det scriptet umiddelbart.

**Åtte nye i18n-nøkler** (`journalist.response_detail.timeline_*`) lagt
til i BÅDE `nb-NO.json` og `en-GB.json` (full parallellitet, samme
praksis som alle eksisterende nøkler i denne seksjonen). Merk:
`npx tsx src/i18n/check-keys.ts` sitt regex-baserte "brukt i kode"-søk
fanger BARE `timeline_title` (kalt med en bokstavelig streng i
`page.tsx`) — de syv andre kalles via en variabel
(`t(event.labelKey)`), samme mønster som allerede eksisterer andre
steder i kodebasen (f.eks. `t(\`journalist.response_detail.marking_${item.journalistMarking}\`)`
i innboks-listesiden) — en kjent, allerede akseptert begrensning i
sjekkescriptet, ikke noe denne økten introduserer eller forsøker å
rette. Nøkkeltellingen gikk derfor bare opp med 1 (527→528), ikke 8,
men alle åtte FINNES faktisk i begge filer, bekreftet manuelt.

**Nye tester** i `journalist-inbox.integration.test.ts`: to nye
tester under `getResponseDetailForJournalist` — én som bekrefter
`contactRequest` er `null` uten noen tilknyttet forespørsel, én som
oppretter en ekte (via `createContactRequest()`) og bekrefter feltene
(`status`, `respondedAt`, `createdAt`, `expiresAt`) kommer riktig
gjennom. Ingen egen test for selve `page.tsx`-rendringen eller
hendelsessorteringen — samme etablerte konvensjon som resten av
server-komponentsidene i denne kodebasen (aldri direkte enhetstestet,
kun det underliggende data-laget), bekreftet ved at INGEN annen
`page.tsx` under `journalist/`/`admin/` har en egen `.test.tsx`.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 462 tester,
  uendret (ingen nye enhetstester — begge nye tester er
  integrasjonstester).
- `npx tsx src/i18n/check-keys.ts`: OK — 528 nøkler (opp fra 527, se
  forklaringen over for hvorfor bare 1 av 8 nye nøkler telles av selve
  scriptet).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 339
  tester (opp fra 337 — de to nye), ALLE bestod.

### Neste økt

Begge de to konkrete funnene fra Økt 67 er nå fullført. Fortsett Økt 66
sin opprinnelige anbefaling: et seksjon-for-seksjon-gjennomsyn av RESTEN
av SPEC-V1.md (kun 5 og 13 er dekket av Økt 67/68 så langt) for flere
genuint ubygde detaljer — samme metode som avdekket tidslinje-hullet:
les en seksjon linje for linje, sjekk HVERT konkret substantiv/krav mot
faktisk kode, ikke bare de store, åpenbare funksjonene. Uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 69: fortsatte seksjon-for-seksjon-gjennomsynet (Økt 68 sin
anbefaling) — 14 (Videre kontakt): fant og rettet ETT genuint UI-hull

Leste seksjon 14 (Videre kontakt) linje for linje mot faktisk kode.
14.2/14.3 sitt statusdiagram (`pending → approved/declined/expired/
cancelled`, inkludert BEGGE triggerne for `expired` — 14 dager ELLER
forespørselen lukkes — og BEGGE triggerne for `cancelled` — svaret
trekkes ELLER journalisten suspenderes) stemte allerede fullstendig med
koden, bekreftet ved samme grundige gjennomgang som Økt 67 allerede
gjorde av de ni overgangsstedene. 14.3 sin logging til revisjonsloggen
(`contact_request.approve` med samtykkegrunnlag, uten selve
e-postadressen i metadata) var også allerede korrekt.

**14.1 sitt UI-krav**: "Rammen rundt – e-postmalen, knappene,
FORKLARINGEN AV HVA DET INNEBÆRER Å GODKJENNE – vises på respondentens
locale" lister TRE atskilte elementer. To av tre fantes
(`contact_request_received`-malen bruker allerede `respondent.locale`,
og knappene fantes) — men INGEN egen forklarende tekst fantes noe sted:
`ContactRequestActions.tsx` viste kun to knapper, der selve
knappeteksten ("Godkjenn og del e-postadressen min") var det ENESTE som
antydet konsekvensen, ikke et eget avsnitt slik spec-en beskriver som et
tredje element ved siden av — ikke inni — knappene.

**Retting**: la til `contact_request.approve_explanation` (nytt i18n-
nøkkel, BEGGE locales) — én setning som dekker BÅDE godkjenning
("e-postadressen din deles... samtalen fortsetter på e-post utenfor
plattformen", direkte fra 14.2 sin egen ordlyd) og avslag ("journalisten
varsles uten begrunnelse, og ingenting deles", også fra 14.2) — vist
som et eget avsnitt over knappene i `ContactRequestActions.tsx`.

**Ny test** i `ContactRequestActions.test.tsx`: bekrefter forklarings-
teksten faktisk vises, samme mønster som resten av testfilens
eksisterende tester (render + `screen.getByText`).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 463 tester (462 +
  1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 529 nøkler (opp fra 528 — denne
  ENE nye nøkkelen ble faktisk fanget av regex-søket, siden den kalles
  med en bokstavelig streng, i motsetning til tidslinje-nøklene i Økt
  68).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 339
  tester, ALLE bestod uendret (rent frontend, ingen server-/DB-logikk
  endret, men kjørt likevel per den stående regelen).

### Neste økt

Seksjon 14 er nå ferdig gjennomgått. Fortsett seksjon-for-seksjon-
gjennomsynet av SPEC-V1.md — 5, 13 og 14 er dekket (Økt 67-69), RESTEN
(1-4, 6-12, 15-26, minus de allerede grundig reviderte 16 (admin,
Økt 78 tidligere i tasklisten), 17 (personvern/retensjon, Økt 62/67),
18 (sikkerhet, Økt 66), 19 (datamodell, tidligere diff'et mot schema),
20 (API-ruter, Økt 62), 21-23 (allerede egne revisjonsøkter)) gjenstår
for en fremtidig økt. Foreslått neste: seksjon 6 (Autentisering), 7
(Registrering), 9 (Forespørsel) eller 11 (Forespørselsside) — disse er
IKKE nevnt i noen tidligere økts "allerede dekket"-liste over, i
motsetning til resten. Uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 70: fortsatte seksjon-for-seksjon-gjennomsynet (Økt 69 sin
anbefaling) — seksjon 9 (Forespørsel): fant og rettet FR-029 sin
"konfigurasjon, ikke hardkodet"-brudd

Leste seksjon 9 (Forespørsel) linje for linje mot faktisk kode. FR-029
(9.2) sier eksplisitt: "en journalist kan ha maks 5 forespørsler med
status published samtidig ... Grensen er satt lavt bevisst – se 26.1,
punkt 5 – og er konfigurasjon, ikke en hardkodet konstant." Koden hadde
derimot `const MAX_CONCURRENT_PUBLISHED = 5;` hardkodet i BÅDE
`src/lib/requests/requests.ts` (submitRequest, sjekk ved innsending) OG
`src/lib/moderation/requests.ts` (publishRequest, re-sjekk under
`pg_advisory_xact_lock` ved publisering — se Økt 49/95 sin TOCTOU-
fiksing av nettopp dette stedet). Spec-teksten er entydig og korrekt;
kun KODEN trengte retting (samme mønster som tidligere økter når spec
allerede er presis).

**Retting**: ny kolonne `countries.max_concurrent_published_requests`
(integer, NOT NULL DEFAULT 5 — samme standardverdi som den fjernede
konstanten, migrasjon `0009_kind_black_tom.sql`, kjørt mot BÅDE
`kildebanken` og `kildebanken_test`), lest i begge de to nevnte
funksjonene i stedet for den hardkodede konstanten (i publishRequest
hentes den FØR `db.transaction()`-blokken, siden det er statisk,
skrivebeskyttet konfigurasjon som ikke kan endres av selve
publiseringen — bevarer TOCTOU-egenskapen fra Økt 49/95 uendret).
Lagt til som et valgfritt felt (`?`, i motsetning til `minimumAge`/
`digestSendTime` som er påkrevd) i `admin/countries.ts` sin
`CreateCountryInput`/`UpdateCountryInput` (med samme validering:
heltall, minst 1) — valgfritt fordi de fleste land aldri vil trenge å
endre spec-ens tilsiktede standardverdi 5, og utelatelse faller da
tilbake til DB-kolonnens egen DEFAULT. Tilsvarende valgfritt felt i
Zod-schemaene for `POST /api/admin/countries` og
`PATCH /api/admin/countries/[code]`. Nytt tekstfelt i BÅDE
`CreateCountryForm.tsx` (forhåndsutfylt "5") og `CountryCard.tsx`
(visning + redigering), ny i18n-nøkkel
`admin.countries.max_concurrent_published_requests_label` (begge
locales), og prop-videreføring i `admin/countries/page.tsx`.

**Nye tester**: én i `requests.integration.test.ts` (submitRequest) og
én i `moderation/requests.integration.test.ts` (publishRequest) — begge
bruker en NY dedikert testlandkode `"XV"` (bekreftet ubrukt andre
steder via grep) med `maxConcurrentPublishedRequests: 2` (satt via
`.onConflictDoUpdate`, ikke `.onConflictDoNothing`, siden selve
konfigurasjonsVERDIEN som testes må tvinges uansett forhåndstilstand).
Valgt en verdi ULIK 5 med vilje — en test der landets grense tilfeldigvis
er 5 ville IKKE skille "leser fra konfigurasjon" fra "fortsatt hardkodet
til 5". Begge tester bekrefter at den TREDJE publiserte/innsendte
forespørselen for et land med grense 2 nektes med
`errors.too_many_published_requests`, mens de to eksisterende testene
(grense 5) fortsatt bekrefter standardverdien uendret.

### Verifisert før commit

- Grep etter gjenværende referanser til den fjernede konstanten
  `MAX_CONCURRENT_PUBLISHED`: null treff (kun to forklarende kommentarer
  som nevner navnet i fortid).
- `npx tsc --noEmit`: fant 8 feil i `CountryCard.test.tsx` (delt
  `baseCountry`-fixture manglet det nye påkrevde feltet i
  `CountryData`) — rettet med ett linjetillegg
  (`maxConcurrentPublishedRequests: 5`); deretter ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 463 tester
  (uendret — ingen enhetstest berørt av denne fiksen).
- `npx tsx src/i18n/check-keys.ts`: OK — 532 nøkler (opp fra 529 — tre
  nye siden Økt 69, hvorav én er denne øktens
  `max_concurrent_published_requests_label`).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts` for de to berørte
  filene direkte: begge nye tester bestod (43 tester totalt i de to
  filene).
- `npx vitest run -c vitest.integration.config.ts` (full pakke): 33
  filer, 341 tester, ALLE bestod (339 + 2 nye).

### Neste økt

Seksjon 9 er nå ferdig gjennomgått. Fortsett seksjon-for-seksjon-
gjennomsynet av SPEC-V1.md — 5, 9, 13 og 14 er nå dekket (Økt 67-70).
Foreslått neste: seksjon 6 (Autentisering), 7 (Registrering) eller 11
(Forespørselsside) — disse er IKKE nevnt i noen tidligere økts "allerede
dekket"-liste. Uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 71: dekket seksjon 6 (Autentisering), 7 (Registrering) og 11
(Forespørselsside) — fant og rettet ETT genuint hull i svarskjemaet
(12.1)

Leste alle tre seksjonene linje for linje mot faktisk kode, som Økt 70
sin "Neste økt" foreslo.

**Seksjon 6 (Autentisering):** fullstendig korrekt allerede. 6.1 (15
minutters engangstoken, 5 forespørsler/15 min rate-limit, økt satt på
kontoens locale, `email_verified_at` settes ved vellykket innlogging),
6.2 (digest-tilgangstoken — bevisst GJENBRUKBART, ikke engangsbruk, se
egen kommentar i `digest-access/[token]/route.ts` — og "viser alltid
hvilken e-post man er innlogget som", bekreftet i `svar/page.tsx` sin
`response.form.logged_in_as`) og 6.3 (12 timers økt for
moderator/administrator, ingen fornyelse, ingen 2FA — et eksplisitt
akseptert avvik i spec-en selv) stemte alle med koden. Kontosletting
(6.2: "krever ny innlogging via magic link, uavhengig av aktiv økt") er
dekket av et eget `delete_account`-formål-token
(`account-deletion.ts`), IKKE en ren gjenbruk av `login`-tokenet — en
enda strengere løsning enn spec-teksten strengt tatt krever, ikke et
brudd. De to andre handlingene 6.2 nevner (endring av e-postadresse,
nedlasting av egne data) finnes ikke som selvbetjente funksjoner i det
hele tatt (17.3: begge er eksplisitt "manuelt i v1"), så det finnes
ingen kode å sjekke kravet mot der.

**Seksjon 7 (Registrering):** også fullstendig korrekt. 7.1
(mottakerregistrering — de tre obligatoriske samtykkene, ingen
forhåndsavkrysning, samtykketekster lastes på nytt OG avkryssingene
nullstilles ved endring av land ELLER språk, sperreliste sjekket FØR
allerede-registrert-sjekken), 7.2 (journalistsøknad — alle obligatoriske
felt, disclaimer om at e-post aldri vises, `verification_status`
uendret av bekreftelsesflyten) og 7.3 (landbytte — nytt samtykke,
gammelt trukket, abonnement flyttet, journalist kan ikke bytte land
selv) stemte alle med `src/lib/registration/recipient.ts`,
`journalist.ts` og `src/lib/me/change-country.ts` — sistnevnte allerede
grundig lest i en tidligere økt (se forrige økts kommentar i
change-country.ts).

**Seksjon 11 (Forespørselsside):** også korrekt — alle listede felt
vises (tittel, redaksjon, journalistnavn, publiseringsdato, svarfrist
MED tidssone, oppsummering, full beskrivelse, hvem søkes,
anonymitet/opptak/foto-info, status, svarknapp, rapporteringslenke),
fremmedspråk-merkelapp, lukket/utløpt-merking uten svarknapp,
kanonisk URL + hreflang per locale-variant, og `noindex` som plattform-
standard (layout.tsx) eksplisitt overstyrt til `index` KUN på denne
sidetypen. Journalistens e-post vises aldri. Eneste kjente, allerede
dokumenterte avvik (delingsbilde/OG-bilde) var bevisst utelatt fra
før, ikke noe nytt.

**Hullet, funnet ved siden av (12.1, tett koblet til 11's svarknapp):**
"Visningsnavn | valgfritt, forhåndsutfylt fra kontoen | 80 tegn" —
`ResponseForm.tsx` sitt visningsnavnfelt startet alltid tomt
(`useState("")`), uansett hva brukerens konto faktisk hadde lagret.
Roten: `CurrentSession` (`src/lib/auth/session.ts`) bar aldri
`displayName` i utgangspunktet — 56 kallsteder totalt, men INGEN av dem
trengte feltet før nå, så det var aldri lagt til.

**Retting:** la til `displayName: string | null` i `CurrentSession`,
hentet fra `users.displayName` i `getCurrentSession()` sitt eneste
SELECT. Rent additivt for de 55 andre kallstedene (ingen av dem
destrukturerer hele objektet mot en literal type). `svar/page.tsx`
sender nå `session.displayName` videre som en ny
`sessionDisplayName`-prop til `ResponseForm`, som bruker den som
startverdi (`useState(sessionDisplayName ?? "")`) i stedet for en fast
tom streng.

**Test-hygiene:** 8 eksisterende testfiler konstruerte et
`CurrentSession`-objekt uten det nye, nå påkrevde `displayName`-feltet
(`tsc --noEmit` fanget alle 9 stedene på tvers av 7 filer) — rettet med
`displayName: null` i hvert tilfelle, samme mønster alle steder.

**Nye tester:** to i `ResponseForm.test.tsx` (feltet forhåndsutfylles
når `sessionDisplayName` er satt; er tomt når kontoen ikke har noe), og
én i `session.integration.test.ts` (bekrefter at `getCurrentSession()`
faktisk leser den ekte DB-verdien, ikke bare at typen tillater den).

### Verifisert før commit

- `npx tsc --noEmit`: fant de 9 manglende `displayName`-feltene i test-
  fixtures (se over) — rettet; deretter ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 465 tester
  (463 + 2 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 532 nøkler (uendret — ingen nye
  i18n-nøkler i denne fiksen).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 342
  tester, ALLE bestod (341 + 1 ny).

### Neste økt

Seksjon 6, 7 og 11 er nå ferdig gjennomgått, i tillegg til 5, 9, 13 og
14 fra tidligere økter (Økt 67-71). Gjenstår av det opprinnelig
foreslåtte settet: ingen — alle fire seksjoner Økt 69 og 70 pekte på er
nå dekket. Fortsett seksjon-for-seksjon-gjennomsynet med en ny,
selvvalgt seksjon fra RESTEN (se Økt 69 sin liste over hvilke seksjoner
som allerede er dekket av tidligere, dedikerte revisjonsøkter — 1-4,
8, 10, 12, 15, 16.3+, 24-26 er blant dem som ikke er eksplisitt
gjennomgått linje-for-linje på denne måten ennå). Uendret: de to
gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt åpne
for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 72: fortsatte seksjon-for-seksjon-gjennomsynet — seksjon 2, 4, 8,
12 og 15 gjennomgått, INGEN nye hull funnet denne gangen

Ingen kodeendring denne økten — loggført likevel, siden en grundig,
negativ gjennomgang også er verdifull informasjon for neste økt (samme
begrunnelse som tidligere "ingen hull funnet"-oppføringer, f.eks. rundt
linje 1979 i denne loggen).

**Seksjon 2 (Rammer for v1):** rent beskrivende scope/forretnings-
kontekst, ingenting funksjonelt å sjekke kode mot.

**Seksjon 4 (Roller):** rolletabellen stemmer med faktisk håndhevet
RBAC overalt (authorize.ts m.fl., allerede grundig dekket av tidligere
økter). Spesielt sjekket: "Moderator og administrator skal ikke lese
innholdet i svar uten et tjenstlig behov. Alle slike oppslag logges med
begrunnelse" — bekreftet i `GET /admin/responses/:id?reason=...`
(`src/app/api/admin/responses/[id]/route.ts`): begrunnelse er
OBLIGATORISK fra en lukket liste (`ADMIN_RESPONSE_ACCESS_REASONS`), ikke
fritekst, og `getResponseForAdmin()` logger den. Denne siden var allerede
bygget med egen forsiktighet (task #103).

**Seksjon 8 (Godkjenning av journalister):** `approveJournalist()`/
`rejectJournalist()` (moderation/journalists.ts) stemmer eksakt med
tabellen i 8.1 — TOCTOU-sikret re-håndhevelse av `pending_review` (samme
mønster som FR-029), FR-023 sin 404-for-feil-land, avvisningsbegrunnelse
sendt UOVERSATT på søkerens eget språk (samme prinsipp som moderator-
kommentarer på forespørsler, 9.3). Suspensjon sjekket separat: publiserte
forespørsler skjules via en LESESIDE-regel (`getPublicRequest()` filtrerer
på `users.status = active`, bekreftet direkte i koden), ikke ved å skrive
noe på selve forespørselsraden — reverseres derfor automatisk av
`unsuspendUser()`. Åpne kontaktforespørsler kanselleres ved suspensjon.
`verification_status` røres ikke ved suspensjon/oppheving, som spec-en
krever.

**Seksjon 12 (Svar):** 12.1 sitt eneste kjente hull ble allerede rettet
forrige økt (visningsnavn-forhåndsutfylling). Resten stemmer: "Anonym
respondent" vises på JOURNALISTENS språk (bekreftet — brukes kun i de tre
journalist-/admin-vendte sidene, aldri på respondentsiden), feltgrensene
i `validate.ts` stemmer eksakt med tabellen og med `ResponseForm.tsx`
sine egne grenser, kontaktdeling defaulter til "none" server-side også
(ikke bare i UI), 12.4 (trekking) hard-sletter svaret umiddelbart og
kansellerer pending kontaktforespørsler, 12.6 sin utledede status-
prioritering (`not_selected > contact_requested > viewed > submitted`)
stemmer ord for ord med koden i `listMineResponses()`. Den juridisk
sensitive bekreftelsesteksten (12.3) sitt kjente forbehold (ikke
juristgjennomgått, ikke bygget som egen `legalDocumentType`) var
allerede flagget i økt 7 — ingen ny risiko funnet, bare bekreftet at
begge locales fortsatt har full nøkkelparitet (9 `response.confirm.*`-
nøkler i hver fil).

**Seksjon 15 (E-postmaler):** alle 23 transaksjonelle maler i tabellen
finnes som egne `TransactionalTemplate`-verdier i `send.ts`, pluss den
24. raden (digest) som har sin egen renderingsvei i `digest.ts` — ingen
manglende mal. HTML+ren-tekst sendes alltid sammen (`htmlContent`/
`textContent` i alle grener av `send.ts`). Unntaket i siste avsnitt
("maler som gjengir juridisk tekst, faller ikke tilbake") gjelder i
praksis INGEN bygget mal ennå — `legal_terms_material_change` varsler
bare OM en endring og lenker til dokumentsiden, den gjengir ikke selve
den juridiske teksten. Selve den juridiske teksten (legal_documents-
tabellen) har fra før ingen fallback (`getCurrentLegalDocument()`
returnerer `null`, aldri en annen locales tekst).

### Verifisert

Ingen kode endret, ingen ny verifisering kjørt (siste kjente grønne
kjøring er fra Økt 71, uendret siden).

### Neste økt

Fortsett seksjon-for-seksjon-gjennomsynet. Nå dekket: 2, 4, 5, 6, 7, 8,
9, 11, 12, 13, 14, 15. Gjenstår av hovedseksjonene (1-20): 1 (Formål —
sannsynligvis rent beskrivende, lav prioritet), 3 (Språk og land — delvis
dekket via 3.7-fiksen tidligere, men ikke lest linje-for-linje i sin
helhet), 10 (Daglig utsendelse — digest.ts/tick.ts er allerede kritisk
lest for TOCTOU i Økt 63, men ALDRI eksplisitt linje-for-linje mot denne
seksjonens fulle tekst), 16 (Administrasjon — dekket av dedikerte
byggeøkter, men ikke denne artige gjennomlesningsmetoden), 17-20 (samme
— dedikerte tidligere økter, ikke denne metoden). Anbefalt neste: seksjon
3 eller 10, siden begge har substansiell, ukontrollert detalj (locale-
fallback-kjeden i 3.4, den fulle digest-jobb-spesifikasjonen i 10.1).
Uendret: de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt
bevisst latt åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 73: fulgte opp Økt 72 sin anbefaling (seksjon 3) — fant og
rettet et reelt hull i selve digest-e-posten: svarfristen viste ALDRI
noen tidssone, og brukte ALDRI landets faktiske tidssone

Leste seksjon 3 (Språk og land) linje for linje. 3.6 sier: "Alle
tidspunkter lagres i UTC. Visning skjer i brukerens `timezone` dersom
den er satt, ellers i landets tidssone. Svarfrister vises alltid med
tidssone angitt, slik at en frist ikke misforstås på tvers av
markeder." Samme krav gjentas i 10.2 ("svarfrist med tidssone").

Sjekket alle stedene et svarfrist faktisk vises. Forespørselssiden
([slug]/page.tsx) gjør dette RIKTIG allerede (`Intl.DateTimeFormat` med
`timeZone: request.countryTimezone`, pluss `(${countryTimezone})`
lagt til teksten manuelt) — dette var den etablerte, korrekte
referanseimplementasjonen. MEN `renderDigestContent()`
(`src/lib/email/digest.ts`) — selve funksjonen som bygger INNHOLDET i
den daglige digest-e-posten, plattformens mest sentrale e-post — hadde
en `Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle:
"short" })` UTEN noen `timeZone`-opsjon i det hele tatt, og ingen
tidssone vist i teksten. Konsekvens: svarfristen i HVER daglig digest
ble formatert i SERVERENS egen, ambigue lokale tidssone (avhengig av
driftsmiljøet — potensielt UTC i produksjon, noe helt annet lokalt),
ikke landets, og uten noen tidssoneindikasjon — nøyaktig scenarioet
3.6 advarer mot ("en frist... misforstås på tvers av markeder").
Funksjonen tok ikke engang imot noen tidssoneparameter i utgangspunktet.

**Retting**: la til en påkrevd tredje parameter
`countryTimezone: string` til `renderDigestContent()`, satt som
`timeZone` i `Intl.DateTimeFormat` OG lagt til i klammer i selve
teksten (`${formatert} (${countryTimezone})`) — samme mønster som
detaljsiden, i BÅDE HTML- og ren-tekst-varianten. To kallsteder fantes
(ikke bare ett): `tick.ts` sin `sendDigestToRecipients()` (selve
førstegangsutsendelsen — `country.timezone` var allerede innhentet der
for `localTimeForTimezone()`, bare ikke videreført til rendringen) OG
`digests.ts` sin `retryFailedDigestDeliveries()` (admin sin "kjør på
nytt ved feil", 16.2 — måtte utvide sin egen `countries`-spørring med
`timezone`, som ikke var med fra før).

**Ny test** i `digest.test.ts`: rendrer SAMME UTC-tidspunkt med to
ulike tidssoner (Europe/Oslo vs. Asia/Tokyo) og bekrefter at (a) den
formaterte teksten faktisk AVVIKER mellom dem (ikke begge stille faller
tilbake til samme serverlokale verdi) og (b) begge tidssonenavnene
faktisk vises i output. De 12 eksisterende testene i filen fikk en
tredje `"Europe/Oslo"`-parameter lagt til.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (fanget automatisk om noe kallsted var
  glemt, siden parameteren er påkrevd, ikke valgfri — bekreftet at
  akkurat de to kjente kallstedene fantes).
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 466 tester
  (465 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 532 nøkler (uendret).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 342
  tester, ALLE bestod uendret (ingen integrasjonstest asserterte på den
  eksakte rendrede digest-teksten, så ingen av dem trengte oppdatering).

### Neste økt

Seksjon 3 er nå ferdig gjennomgått (utover selve funnet over, stemte
resten — 3.1 til 3.5, 3.7 og 3.8 — allerede med koden). Dekket så
langt: 2-9, 11-15. Foreslått neste: seksjon 10 (Daglig utsendelse) i sin
helhet — spesielt verdt å sjekke etter denne øktens funn, siden det
viser at selv en tidligere "kritisk lest" fil (Økt 63, som lette etter
TOCTOU) kan ha andre, ikke-TOCTOU-relaterte hull en linje-for-linje
spec-sammenligning fanger opp. Uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 74: fulgte opp Økt 73 sin anbefaling (seksjon 10 i sin helhet) —
fant og rettet ETT nytt hull: digest-e-posten viste ALDRI noen faktisk
dato

Leste seksjon 10 (Daglig utsendelse) linje for linje mot
`tick.ts`/`digest.ts`/`digests.ts`. 10.1 (jobben) stemte HELT med
koden ved nøye gjennomgang av alle ni nummererte stegene: land
behandles uavhengig (try/catch per land, FR-036), riktig WHERE-klausul
for steg 1 (`published` + `included_in_digest_at IS NULL`, PLUSS en
strengere `users.status = active`-sjekk for suspenderte journalister,
8.1), tom liste avbryter uten å sende (steg 2), locale-oppdagelse fra
FAKTISKE abonnenter (steg 3), én rendring per locale i bruk (steg 4,
FR-032), `Digest`-rad opprettet (steg 5), riktig mottakerfilter (steg
6), `DigestDelivery` lagrer locale (steg 7), `included_in_digest_at`
settes (steg 8), webhook-behandling er allerede asynkron (steg 9,
separat rute). `Digest.status`-overgangen (pending → sent/failed, kun
failed når ALLE mottakere feilet) og per-mottaker-feilhåndtering
(FR-036 anvendt også på mottakernivå) stemte også.

**10.2 sitt hull**: innholdslisten er "dato, formatert for mottakerens
locale — antall nye forespørsler — kort introduksjon — per
forespørsel: ... — avmeldingslenke." Det FØRSTE elementet, en faktisk
dato, fantes ALDRI noe sted i verken HTML- eller ren-tekst-varianten —
kun den relative frasen "i dag" i emnefeltet
(`digest.subject`: "{count} ny/nye forespørsel/forespørsler I DAG").
"I dag" er ikke en dato formatert for mottakerens locale; det sier
ingenting om HVILKEN dag e-posten faktisk gjelder, noe som blir
tvetydig for en mottaker som åpner e-posten dagen etter, eller som
sammenligner flere lands utsendelser. `renderDigestContent()` tok ikke
engang imot noen datoparameter i utgangspunktet.

**Retting**: la til en fjerde, påkrevd parameter
`digestDate: string` ("YYYY-MM-DD", SAMME verdi som `Digest.scheduledFor`,
19.9 — landets egen lokale kalenderdag for akkurat denne utsendelsen,
allerede beregnet i `tick.ts` sin `localTimeForTimezone()`). Formatert
med `Intl.DateTimeFormat(locale, { dateStyle: "full", timeZone: "UTC" })`
— `timeZone: "UTC"` er bevisst her (i motsetning til forrige økts
`countryTimezone`-fiks for selve svarfristen): `digestDate` er ALLEREDE
en ren kalenderdag uten klokkeslett, og skal derfor vises SOM DEN ER,
ikke tolkes på nytt inn i en annen tidssone (som kunne forskjøvet den
til feil dag). Vist som egen linje over introen i BÅDE HTML og
ren tekst. To kallsteder oppdatert: `tick.ts` sin
`sendDigestToRecipients()` (fikk allerede `localDate` fra kalleren,
bare ikke videreført hit) og `digests.ts` sin
`retryFailedDigestDeliveries()` (brukte `digest.scheduledFor`,
allerede tilgjengelig fra dens egen `select()` av hele digest-raden —
ingen ny spørring nødvendig der).

**Ny test** i `digest.test.ts`: bekrefter at BÅDE nb-NO og en-GB faktisk
viser en fullt utskrevet, korrekt lokalisert dato ("lørdag 15. august
2026" / "Saturday, 15 August 2026" for samme underliggende dato),
ikke bare den generiske "i dag"-frasen.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil (bekreftet at nøyaktig de to kjente
  kallstedene ble oppdatert, siden parameteren er påkrevd).
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 467 tester
  (466 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 532 nøkler (uendret — datoen
  er ren `Intl`-formatering, ingen ny oversettelsesnøkkel).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 342
  tester, ALLE bestod uendret.

### Neste økt

Seksjon 10 er nå ferdig gjennomgått, i tillegg til 2-9 og 11-15 fra
tidligere økter. Gjenstår av hovedseksjonene (1-20) for denne
linje-for-linje-metoden: 1 (Formål, sannsynligvis rent beskrivende), 16
(Administrasjon — dekket av dedikerte byggeøkter, men ikke denne
metoden), 17-20 (samme). Foreslått neste: seksjon 16, siden den er den
STØRSTE gjenværende, med flest underseksjoner (16.1-16.3+) og størst
sannsynlighet for et nytt funn gitt mønsteret denne og forrige økt
etablerte (funn i felt som allerede var bygget, bare ikke lest MOT
selve spec-teksten linje for linje). Uendret: de to gjenværende GENUINE
åpne spec-spørsmålene, fortsatt bevisst latt åpne for menneskelig
gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 75: fulgte opp Økt 74 sin anbefaling (seksjon 16) — fant og
rettet ETT hull i modereringskøen, PLUSS en reell, reproduserbar flaky
integrasjonstest oppdaget underveis

Leste seksjon 16 (Administrasjonsgrensesnitt) linje for linje mot
`admin/dashboard.ts`, `moderation/requests.ts`, `moderation/users.ts`
og de tilhørende admin-sidene. 16.1 (de sju dashbord-tallene, landvelger
for administrator kontra automatisk visning for moderator) stemte
allerede eksakt. 16.2 sin funksjonsliste stemte for det meste: søk,
søknadsgrunnlag, godkjenn/avvis/suspender/opphev, tidligere forespørsler
(Journalister); modereringskø, godkjenn/avvis/returner/lukk
(Forespørsler); søk, kontostatus, SAMTYKKEHISTORIKK (bekreftet — allerede
bygget, task #75), sletting, suspensjon (Mottakere); siste digester,
antall sendt/bounces/klager, kjør på nytt (Utsendelser); opprette/
redigere/status/moderatorer/juridiske dokumenter (Land). Den lukkede
begrunnelseslisten for `GET /admin/responses/:id` var også allerede
korrekt implementert (`ADMIN_RESPONSE_ACCESS_REASONS`, obligatorisk,
logget).

**Hullet**: 16.2 sier "Forespørsler: modereringskø, **forhåndsvisning**,
godkjenn, avvis, returner med kommentar, lukk", og 9.3 sin
moderasjonssjekkliste krever eksplisitt "at oppgitt innholdsspråk
stemmer med teksten." `listModerationQueue()` (moderation/requests.ts)
hentet ALDRI `contentLanguage` i det hele tatt, og `RequestQueueItem.tsx`
viste følgelig aldri hvilket språk journalisten faktisk hadde oppgitt —
en moderator kunne se selve teksten (allerede vist inline i køen, som
dekker "forhåndsvisning"), men hadde ingen måte å vite HVILKET språk som
var erklært for den, og kunne dermed ikke faktisk utføre akkurat den ene
sjekklistesjekken.

**Retting**: la til `contentLanguage: requests.contentLanguage` i
`listModerationQueue()` sitt SELECT. Ny prop `contentLanguageLabel`
(oversatt via samme `locale.name.*`-nøkler som resten av kodebasen
allerede bruker, f.eks. i `SubscribeForm.tsx`) vist som en egen linje i
`RequestQueueItem.tsx`, pluss `lang`-attributt på selve tittel-/
oppsummerings-/beskrivelse-/målgruppe-tekstene (samme etablerte mønster
som task #34, forespørselssiden og digest-e-posten).

**Den flaky integrasjonstesten** (oppdaget ved en tilfeldig rødt resultat
i full-pakke-kjøringen, IKKE forårsaket av denne øktens kodeendring —
bekreftet ved at testen består i isolasjon): "returnerer null for siste
utsendelse når ingen digest er kjørt for landet ennå"
(`admin/dashboard.integration.test.ts`) brukte den DELTE, persistente
`TEST_COUNTRY_CODE_2`-fixturen, og feilet sporadisk fordi
`digests.integration.test.ts` (som kjører parallelt, samme etablerte
vitest-konvensjon) også setter inn digest-rader for NØYAKTIG samme
landkode — testen kunne fange en slik rad i det korte vinduet mellom
den andre testens insert og dens egen opprydding. Søstertesten RETT
UNDER hadde allerede en dokumentert, korrekt fiks for nøyaktig denne
klassen problem (et eget, isolert testland med tilfeldig kode) — denne
ene testen manglet bare den samme fiksen. Rettet ved å gi den samme
isolasjonen (bekreftet med tre gjentatte kjøringer av begge filene
sammen, alle grønne). `ensureSecondTestCountry`-importen ble fjernet
som følge (ubrukt etter fiksen).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil (bekreftet ubrukt import fjernet riktig).
- `npx vitest run` (full enhetstestpakke): 86 filer, 468 tester
  (467 + 1 ny, for innholdsspråk-visningen).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler (opp fra 532 — den
  nye `content_language_label`-nøkkelen).
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 342
  tester — først ETT rødt resultat (den kjente flaky-testen, se over),
  deretter tre påfølgende grønne kjøringer av de to berørte filene
  sammen, OG én til grønn kjøring av HELE pakken etter fiksen.

### Neste økt

Seksjon 16 er nå ferdig gjennomgått. Dekket totalt: 2-16. Gjenstår av
hovedseksjonene for denne linje-for-linje-metoden: 1 (Formål,
sannsynligvis rent beskrivende), 17-20 (Personvern/Sikkerhet/
Datamodell/API — hver har egne, tidligere dedikerte revisjonsøkter, men
ikke denne spesifikke linje-for-linje-mot-kode-metoden). Foreslått
neste: seksjon 17 (Personvern), siden den har direkte konsekvenser for
ekte persondata og derfor høyest verdi å dobbeltsjekke grundig. Uendret:
de to gjenværende GENUINE åpne spec-spørsmålene, fortsatt bevisst latt
åpne for menneskelig gjennomgang:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 76: fulgte opp Økt 75 sin anbefaling (seksjon 17) — INGEN nye
kodehull funnet; utvidet gjennomgangen til DESIGN.md 9 og
INFRASTRUCTURE.md 16, samme resultat

Ingen kodeendring denne økten. Grundig, men negativ gjennomgang —
loggført likevel (samme begrunnelse som Økt 72).

**Seksjon 17 (Personvern), rad for rad:**
- 17.1 (behandlingsgrunnlag): rent juridisk/beskrivende, ingen kode å
  sjekke mot.
- 17.2 (juridiske dokumenter og samtykkelogg): `publishLegalDocument()`
  varsler berørte mottakere korrekt på riktig locale ved vesentlig
  endring. De to kjente, allerede grundig begrunnede avgrensningene i
  funksjonens egen kommentar (ingen tvungen re-samtykke-sperre bygget,
  siden spec-en ikke sier NÅR/HVORDAN; ingen varsling ved
  `journalist_terms`-endring) er UENDRET bevisste antagelser, ikke noe
  jeg fant grunn til å endre.
- 17.3 (brukerens rettigheter): alle seks selvbetjente rettighetene
  bekreftet i kode — inkludert at "bytte språk" faktisk er en egen,
  fungerende `Select` i `ProfileForm.tsx` (`PATCH /me`), ikke bare
  landbytte.
- 17.4 (lagringstid): Økt 62 (tidligere i sesjonen) gjorde allerede en
  fullstendig rad-for-rad-revisjon av denne tabellen mot
  `jobs/retention.ts` og fant ingen hull — bekreftet uavhengig samme
  konklusjon her, inkludert at "Sikkerhetslogg (6 måneder)" sin eneste
  rimelige kandidat (`rateLimitHits`, 19.16) allerede er SELVRENSKENDE
  (sletter rader eldre enn sitt eget, langt kortere tellevindu ved hvert
  kall — ingen egen retensjonskategori kan noensinne trenges, raden
  lever aldri lenge nok). Den kjente TODO-en om at lagringstider bør bli
  ekte per-land-konfigurasjon (samme prinsipp som FR-029, Økt 70) står
  ved lag som en bevisst utsatt beslutning, eksplisitt betinget av at et
  land nummer to faktisk trenger avvikende frister — ikke gjenoppfunnet
  eller endret her.
- 17.5 (sletting): alle seks punktene (stans fremtidige utsendelser,
  anonymiser konto, anonymiser svar, kanseller åpne kontaktforespørsler
  og varsle journalisten, behold samtykkehistorikk, logg uten unødvendig
  PII) bekreftet i `account-deletion.ts` sin `performAccountDeletion()`,
  tidligere grundig lest og allerede TOCTOU-sikret (task #91).

**DESIGN.md 9 (akseptansekriterier)**: kriterium 2 ("CI feiler på
fargeverdier, px-verdier og lag 1-variabler i komponentfiler") og 3
(kontrasttest-dekning) var de to gjenværende, ikke tidligere eksplisitt
krysset av — bekreftet begge: `src/styles/check-tokens.ts` håndhever
nøyaktig kriterium 2 sin ordlyd (hex/rgb/oklch/rå-px/lag-1-variabler,
med en dokumentert, bevisst unntak for 1px/2px kantlinjer) og er faktisk
koblet inn i `.github/workflows/ci.yml` (ikke bare et npm-script ingen
kjører). Kriterium 3 var allerede lukket av task #111. Med dette er ALLE
åtte kriteriene i DESIGN.md 9 nå bekreftet — ingen gjenstår uverifisert.

**INFRASTRUCTURE.md 16 (Stadium 0) mot faktisk drift-oppsett**: krysset
hele 16.2/16.3/16.8 mot `netlify.toml` og `netlify/functions/tick.ts`.
Alt stemmer presist: 15-minutters cron-skjema identisk på begge steder,
`netlify/functions/tick.ts` er nøyaktig den tynne adapteren 16.8
beskriver (importerer og kaller `runTick()`, ingen egen logikk), og
`runTick()` (`src/lib/jobs/tick.ts`) dispatcher faktisk alle sju jobbene
16.3 nevner (digest-tick, expire-requests, expire-contact-requests,
deadline-reminders, stale-request-reminders, purge-unverified,
retention). 16.8 sitt eget "aksepteringskriterium" (faktisk deploy til
en Hetzner-VM som en portabilitetstest) er en FREMTIDIG migreringsport,
ikke noe som skal gjøres nå i Stadium 0 — ingen handling påkrevd.

**Én uavklart observasjon, IKKE rettet** (usikker ekstern kilde, ikke en
kodefeil): INFRASTRUCTURE.md 6.4 sier "Signatur verifiseres" for
e-post-webhooks, men `/api/webhooks/email-events/route.ts` bruker en
delt hemmelighet (query/header), ikke en kryptografisk HMAC-signatur.
Forsøkte å avklare om Brevo faktisk tilbyr signaturverifisering
(`X-Mailin-Signature`) via web-søk — resultatene MOTSA hverandre
direkte (én kilde hevder HMAC-SHA256 finnes, en annen at Brevo ikke
signerer webhooks i det hele tatt), og Brevos egen dokumentasjonsside
for "Secure webhook calls" har URL-stien
`username-and-password-authentication`, som tyder sterkt på at Brevos
FAKTISKE anbefaling er HTTP Basic Auth i selve URL-en — arkitektonisk
tilsvarende den delte hemmeligheten som allerede er bygget, ikke en
kryptografisk signatur. Gitt selvmotsigende kilder og at direkte
sideoppslag mot Brevos dokumentasjon ga 403, var det tryggere å LA
koden stå enn å bygge en usikker/muligens ikke-eksisterende
HMAC-mekanisme basert på upålitelige kilder. Bør bekreftes direkte mot
en ekte Brevo-konto (webhook-innstillingene der viser nøyaktig hvilke
sikringsmekanismer som faktisk tilbys) før produksjonssetting — samme
"MÅ verifiseres før produksjon"-forbehold som allerede står andre
steder i kodebasen for Brevo-spesifikke antagelser.

### Verifisert

Ingen kode endret, ingen ny verifisering kjørt (siste kjente grønne
kjøring er fra Økt 75, uendret siden).

### Neste økt

Seksjon 17 er nå ferdig gjennomgått (bekrefter Økt 62), og DESIGN.md 9
er nå FULLSTENDIG verifisert (alle 8 kriterier). Gjenstår av
SPEC-V1.md sin linje-for-linje-metode: kun seksjon 1 (Formål,
sannsynligvis rent beskrivende) og seksjon 18-20 (Sikkerhet/Datamodell/
API — hver har egne, tidligere dedikerte revisjonsøkter, men ikke denne
spesifikke metoden). Nytt spor åpnet denne økten: INFRASTRUCTURE.md har
ALDRI fått en systematisk linje-for-linje-gjennomgang analog til
SPEC-V1.md sin — kun seksjon 16 er dekket nå. Foreslått neste: fortsett
INFRASTRUCTURE.md seksjon 2-15 (kjøretidsarkitektur, komponentvalg,
database, jobbkø, miljøer, utrulling, hemmeligheter, overvåking,
sikkerhetskopi, sikkerhet i infrastrukturen, kostnad, hva som ryker
først, åpne beslutninger) mot faktisk kode/config — mye av dette
beskriver riktignok et FREMTIDIG Stadium 1-oppsett (ikke byttet til
ennå), så forvent færre kodefunn og mer "beskriver noe som ikke er
bygget ennå, med hensikt" enn i seksjon 16. Uendret: de to gjenværende
GENUINE åpne spec-spørsmålene, PLUSS den nye, uavklarte Brevo-webhook-
signatur-observasjonen over (verifiseres mot ekte Brevo-konto, ikke noe
å gjette seg til i kode):
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 77: fulgte opp Økt 76 sin anbefaling (INFRASTRUCTURE.md 2-15) —
fant og rettet et reelt `unsafe-inline`-avvik i CSP-en

Leste INFRASTRUCTURE.md seksjon 7-13 mot faktisk kode/config. Som
forutsett i Økt 76: mesteparten beskriver et FREMTIDIG Stadium 1-oppsett
(egen VM, pg-boss, Aiven osv.) som ikke er byttet til ennå — ingen kode
å sjekke mot der. Det som FAKTISK er kode-nivå, uavhengig av
driftsstadium, stemte: `/health` svarer med både databasetilkobling og
faktisk migrasjonsversjon (8.1, `checkHealth()` leser reell
`drizzle.__drizzle_migrations`, ikke en plassholder), migrasjoner kjøres
KUN via et eksplisitt `npm run db:migrate`-steg, aldri automatisk ved
oppstart (4), `.env.example` inneholder bare navn og plassholdere, ingen
ekte hemmeligheter (9), og `DB_POOL_MAX` sin dokumenterte
standardverdi (3) stemmer med `db/client.ts`.

**Hullet**: 12 sier eksplisitt "HSTS, CSP uten `unsafe-inline`,
`X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-
origin`." Alle headerne fantes (`next.config.mjs`/`middleware.ts`), MEN
`buildCsp()` sin `style-src`-direktiv hadde faktisk
`'unsafe-inline'` — et EKTE, upåaktet avvik fra spec-teksten, aldri
tidligere nevnt i NATTLOGG. Kommentaren ved siden av sa selv
"fjernes når komponentstilene er fullt CSS-modul-basert" — sporet
årsaken til nøyaktig ÉN fil: `src/app/[locale]/page.tsx` (den midlertidige
Fase 1-plassholder-forsiden, se dens egen kommentar) var den ENESTE
komponenten i hele `src/app`/`src/components` som fortsatt brukte Reacts
inline `style`-prop, tre steder (padding/maks-bredde, font, tekstfarge).

**Retting**: la til `page.module.css` (samme mønster som ALLE andre
sider) og byttet de tre inline `style={{...}}`-blokkene til
`className`-referanser. Fjernet deretter `'unsafe-inline'` fra
`style-src` i `buildCsp()` — nå `"style-src 'self'"`, symmetrisk med
`script-src` som allerede var uten den.

**Verifisert LEVENDE, ikke bare i tester**: bygget (`next build`),
startet en ekte produksjonsserver lokalt (`next start`), og hentet
selve HTML-en og CSP-headeren for `/nb-NO` med `curl`. Bekreftet at (a)
de nye CSS-modul-klassenavnene (`page_main__…`, `page_title__…`,
`page_intro__…`) faktisk vises i den rendrede HTML-en, IKKE inline
`style=`, (b) den faktiske `Content-Security-Policy`-responsheaderen nå
er `style-src 'self'` uten `unsafe-inline` noe sted i hele strengen, og
(c) den kompilerte CSS-filen faktisk inneholder riktig oversatte
tokenverdier (`padding:var(--space-6)` osv.) — samme grundighetsnivå som
DESIGN.md 9 sin egen "påstått portabilitet er ikke verifisert før den
faktisk er forsøkt"-prinsipp.

**Ny test** i `middleware.test.ts`: bekrefter direkte at
`Content-Security-Policy`-headeren ALDRI inneholder strengen
"unsafe-inline" for en vanlig sideforespørsel, pluss én test som
bekrefter at per-forespørsel-noncen faktisk vises i `script-src`
(matcher `x-nonce`-headeren) — ingen eksisterende test asserterte på
CSP-ens faktiske innhold før dette.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run` (full enhetstestpakke): 86 filer, 470 tester
  (468 + 2 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler (uendret).
- `npx tsx src/styles/check-tokens.ts`: OK — 55 komponent-CSS-filer
  (opp fra 54 — den nye `page.module.css`), ingen brudd.
- `npx next build`: bygget uten feil.
- Levende verifisering: `next start` + `curl` mot faktisk kjørende
  produksjonsbygg, se over.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 342
  tester, ALLE bestod uendret.

### Neste økt

INFRASTRUCTURE.md 7-13 er nå gjennomgått (sammen med 16 fra Økt 76).
Gjenstår av samme metode: seksjon 2 (kjøretidsarkitektur), 3
(komponentvalg), 5 (jobbkø og planlegging — sannsynligvis allerede
dekket av tidligere jobbtabell-fiks, task #29, men ikke bekreftet med
DENNE spesifikke linje-for-linje-metoden), 6 (e-post, delvis dekket
denne økten via 6.4s webhook-observasjon i Økt 76), 11 (sikkerhetskopi),
14 (hva som ryker først), 15 (åpne beslutninger). De fleste av disse er,
som allerede fastslått, Stadium 1-beskrivelser uten tilsvarende kode å
sjekke ennå — lavere forventet treffrate enn denne økten, men seksjon 5
er verdt en rask bekreftelse siden jobbkø-logikken FAKTISK eksisterer
(tick.ts), bare under et annet kjøremønster (16.3) enn det seksjon 5
beskriver (pg-boss). Uendret: de to gjenværende GENUINE åpne
spec-spørsmålene, pluss Brevo-webhook-signatur-observasjonen fra Økt 76
(verifiseres mot ekte Brevo-konto):
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold.

## Økt 78: fullførte INFRASTRUCTURE.md sin linje-for-linje-gjennomgang
(seksjon 2-15), og gjorde en ekte nettleser-verifisering av to tidligere
kun-jsdom-testede UI-funksjoner

To separate aktiviteter denne økten, ingen kodefeil funnet i noen av dem.

### Del 1: resten av INFRASTRUCTURE.md 2-15 mot faktisk kode

Fulgte opp Økt 77 sin liste over gjenstående seksjoner. Som forventet
var det aller meste fortsatt ren Stadium 1-beskrivelse uten
tilsvarende kode (seksjon 2 kjøretidsarkitektur, 3 komponentvalg, 6
delvis, 11 sikkerhetskopi, 13, 14 hva som ryker først, 15 åpne
beslutninger) — ingen handling mulig eller nødvendig der, bekreftet
nok en gang samme mønster som Økt 76/77.

De kode-nivå-punktene som FAKTISK er sjekkbare uavhengig av
driftsstadium, ble krysset direkte mot kilden og stemte alle:

- Seksjon 5 (jobbkø): `runTick()` i `src/lib/jobs/tick.ts` dispatcher
  fortsatt alle sju jobbene, og `deadlineReminderSentAt`/
  `staleReminderSentAt`-feltene i `schema.ts` (linje 308-309) som ble
  rettet i en tidligere økt (jobbtabell-fiksen, task #29) står fortsatt
  riktig — ingen regresjon.
- Seksjon 8.1: `src/app/api/health/route.ts` +
  `src/lib/health/health.ts` sin `checkHealth()` gjør fortsatt et ekte
  databaseoppslag mot `drizzle.__drizzle_migrations` for
  migrasjonsversjon, ikke en plassholderverdi.
- Seksjon 4: ingen automatisk migrasjonskjøring ved oppstart noe sted i
  kodebasen — kun det eksplisitte `npm run db:migrate`-steget i
  `package.json`, som spec-en krever.
- Seksjon 9: `.env.example` inneholder fortsatt bare variabelnavn og
  plassholdertekst, ingen ekte hemmeligheter.
- `DB_POOL_MAX`-standardverdien (3) i `src/db/client.ts` stemmer
  fortsatt med det dokumenterte tallet.

INFRASTRUCTURE.md sin linje-for-linje-metode (analog til den som
allerede er kjørt mot hele SPEC-V1.md og DESIGN.md) er dermed nå
FULLSTENDIG gjennomført — alle 16 seksjoner er lest mot faktisk
kode/config minst én gang. Ingen nye avvik denne runden; det ENE reelle
avviket metoden fant totalt (CSP `unsafe-inline` i seksjon 12) ble
allerede rettet i Økt 77.

### Del 2: ekte nettleser-verifisering (Playwright), ikke bare jsdom

Med linje-for-linje-metoden nå uttømt på alle tre toppdokumentene,
byttet denne økten til en annen type verifisering — direkte i tråd med
den stående regelen "For UI or frontend changes, start the dev server
and use the feature in a browser before reporting the task as
complete." To funksjoner fra tidligere økter (Økt 71 sin
visningsnavn-forhåndsutfylling og Økt 75 sitt innholdsspråk-merke i
modereringskøen) er begge dekket av jsdom-baserte enhetstester, men
ALDRI faktisk kjørt i en ekte nettleser mot en ekte database før nå.

**Verktøysgap oppdaget og løst**: prosjektet har ingen egen
`playwright`-avhengighet i `package.json`. Sandkasse-miljøet har derimot
en global installasjon (`playwright@1.56.1` under
`/opt/node22/lib/node_modules/playwright`) og en forhåndsinstallert
Chromium (`/opt/pw-browsers/chromium`). Et første forsøk på å importere
denne globale pakken via `NODE_PATH` feilet — Nodes ESM-oppløsning
(utløst av `import`-syntaks i en `.mjs`-fil) leser ikke `NODE_PATH` for
bare-spesifikke importer slik den eldre CommonJS `require()`-
oppløsningen gjør. Løsningen var å importere pakkens faktiske
inngangspunkt direkte via absolutt filsti
(`/opt/node22/lib/node_modules/playwright/index.mjs`), som Node sin
ESM-oppløsning håndterer uten problemer.

**Oppsett**: et frittstående, ikke-committet sådd-script opprettet en
mottaker (med `displayName`), to journalister (én med en publisert
forespørsel på `nb-NO`, én med en innsendt forespørsel med
`contentLanguage: "en-GB"`), og en moderator tildelt samme land — alt
mot en ekte kjørende `next dev`-instans og ekte Postgres (testlandet
`XT`). Et Playwright-script logget deretter inn som mottakeren (via
`kb_session`-cookien direkte) og hentet den faktiske verdien i
visningsnavn-feltet på svarskjemaet, og logget inn som moderatoren for
å hente den faktiske body-teksten på modereringskø-siden.

**Resultat — begge bestod, ingen kodefeil**:
- Svarskjemaets visningsnavn-felt var faktisk forhåndsutfylt med
  `"Live Sjekk Mottaker"` (mottakerens ekte kontonavn), ikke tomt.
- Modereringskøen viste faktisk teksten "Oppgitt innholdsspråk: Engelsk"
  for forespørselen med `contentLanguage: "en-GB"`.

Dette er ren bekreftende diligence — ingen kode ble endret, siden begge
funksjonene allerede var riktig bygget og allerede dekket av grønne
enhetstester. Verdien er å ha faktisk BEVIST at jsdom-testenes
antagelser (DOM-struktur, CSS-modul-klassenavn, faktisk renderet tekst)
stemmer overens med hva en ekte nettleser mot en ekte database faktisk
viser — ikke bare antatt det.

**Opprydding etter økten**: alle sådde rader (2 brukere +
journalist-profiler + moderatorland + 2 forespørsler) ble slettet fra
utviklingsdatabasen igjen, `next dev`-prosessen ble avsluttet, og de to
ikke-sporede scratch-filene (`scratch-seed-live-check.ts`,
`scratch-playwright-check.mjs`) ble slettet fra prosjektroten — ingen
av dem ble noensinne committet.

### Verifisert

Ingen kode endret denne økten (ren verifisering) — ingen ny
`tsc`/`eslint`/`vitest`/`build`-kjøring var nødvendig eller utført.
Siste kjente grønne fullkjøring er fortsatt fra Økt 77, uendret siden.
Playwright-sjekken selv (mot ekte `next dev` + ekte Postgres) er
beskrevet over og bestod begge assertions.

### Neste økt

Alle tre toppdokumentene (SPEC-V1.md, DESIGN.md, INFRASTRUCTURE.md) har
nå fått minst én fullstendig linje-for-linje-gjennomgang. Ett lite hull
gjenstår av selve METODEN (ikke nødvendigvis av innholdet, som er
sjekket via egne, tidligere dedikerte økter): SPEC-V1.md seksjon 1
(Formål — sannsynligvis rent beskrivende) og seksjon 18-20 (Sikkerhet/
Datamodell/API) har aldri fått akkurat DENNE linje-for-linje-metoden
kjørt mot seg direkte, kun tidligere frittstående revisjoner (task
#26, #32, #78). Verdt en rask, avsluttende sjekk for å lukke metode-
dekningen helt, men lav forventet treffrate siden innholdet allerede er
grundig dekket fra andre vinkler. Utover det: vurder å gjøre flere
live-nettleser-verifiseringer av andre spec-flyter etter samme mønster
som denne økten (nå som verktøysgapet er løst — importer Playwright
via absolutt sti, ikke `NODE_PATH`) — kandidater inkluderer
journalist-søknadsflyten og selve digest-e-postens faktiske utseende.
Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold;
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 79: lukket det siste hullet i linje-for-linje-metoden
(SPEC-V1.md 1, 18-20), og en visuell nettleser-verifisering av selve
digest-e-postens faktiske utseende

Ingen kodefeil funnet. To deler.

### Del 1: SPEC-V1.md seksjon 1 og 18-20 mot faktisk kode

Seksjon 1 (Formål) er, som forventet, ren beskrivende tekst — hele
kjeden forespørsel → moderering → digest → svar → kontakt den
beskriver er allerede bygget og grundig testet fra alle andre vinkler.
Ingen handling mulig eller nødvendig.

Seksjon 18 (Sikkerhet): 18.2 (eget bekreftelsestoken, eksplisitt
knappetrykk for irreversible handlinger) er allerede korrekt
implementert (task #58). 18.1 ("hvem kan lese et svar") bekrefter det
KJENTE, uavklarte spørsmål (b) — se under, ingen ny informasjon utover
at 19.4 ("Administrator trenger ingen rader her – rollen gir tilgang
til alle land") faktisk FORKLARER hvorfor koden ikke sjekker
landtildeling for administrator (det er strukturelt underforstått,
ikke et hull i seg selv) — den gjenværende, reelle uklarheten er kun om
MODERATOR (i tillegg til administrator) skal ha samme unntaksvise
tilgang, siden FR-051 og koden eksplisitt sier "administrator", ikke
"moderator eller administrator" som 18.1 sier. Fortsatt en
produktbeslutning, ikke noe å gjette seg til.

Seksjon 19 (Datamodell): lest gjennom på nytt i sin helhet (19.1
t.o.m. 19.16/17 tabeller). Ingen nye avvik — stemmer med `schema.ts`,
konsistent med den grundige diffen fra task #26.

Seksjon 20 (API): krysset ALLE 55 rutene i listen direkte mot faktiske
`route.ts`-filer i `src/app/api/`. Fullstendig 1:1-treff, ingen
manglende og ingen overflødige ruter. Bekrefter at økt 7 sin tidligere,
grundige rute-til-spec-forsoning fortsatt er komplett og uendret.

Med dette er linje-for-linje-metoden nå kjørt mot HELE SPEC-V1.md (alle
26 seksjoner), hele DESIGN.md (alle 9 kriterier i seksjon 9), og hele
INFRASTRUCTURE.md (alle 16 seksjoner). Metodedekningen er komplett —
videre gjennomganger av samme type vil sannsynligvis ha lav treffrate
med mindre koden endres på nytt.

### Del 2: visuell nettleser-verifisering av selve digest-e-posten

Med metoden uttømt, gjensto en konkret idé fra Økt 78 sin "Neste
økt": selve digest-e-postens faktiske, RENDREDE utseende har ALDRI blitt
sett — verken i en tidligere økt eller nå — kun verifisert via
streng-assertions i `digest.test.ts` (tekstinnhold, hex-fargeverdier).

Skrev et frittstående, ikke-committet script som kalte
`renderDigestContent()` direkte med to realistiske eksempel-
forespørsler (én norsk, én engelsk — for å utløse
fremmedspråk-varselet, se `request.foreign_language_notice`), satte inn
per-mottaker-tokens via `insertPerRecipientTokens()`, og skrev den
faktiske HTML-en til fil. Brukte deretter Playwright (samme
løsning på modulimport som Økt 78 — absolutt filsti til
`/opt/node22/lib/node_modules/playwright/index.mjs`, IKKE `NODE_PATH`)
til å ta skjermbilde av filen i BÅDE lys og mørk fargeskjema
(`colorScheme: "light"`/`"dark"` i en egen browser-kontekst per skjema).

**Resultat, begge skjermbilder inspisert direkte**: alt stemmer.
Formatert dato ("tirsdag 4. august 2026") vises øverst, hver
forespørsel viser tittel, sammendrag, organisasjon, svarfrist MED
tidssone i parentes ("9. aug. 2026, 04:42 (Europe/Oslo)"),
geografisk-notis-linjen vises for den norske forespørselen, og
fremmedspråk-varselet vises korrekt KUN for den engelske. Mørk modus
bytter faktisk bakgrunn/tekst/kort-farger (mørk bakgrunn, lys tekst,
lysere blå lenke-/knappfarge for kontrast) uten noen synlig
kontrast- eller layoutfeil — samme konklusjon som den strengbaserte
verifiseringen i task #112, men nå faktisk SETT, ikke bare bevist via
tekst-assertions.

Dette bekrefter, i én kombinert visning, at fem tidligere separate
rettinger (digest-dato økt 74, tidssone-frist økt 73,
fremmedspråk-varsel — eksisterende, geografisk notis — eksisterende, og
e-post-mørk-modus — DESIGN.md 9 kriterium 6) faktisk fungerer SAMMEN i
én faktisk rendret e-post, ikke bare hver for seg i isolerte tester.

**Opprydding**: de to scratch-scriptene
(`scratch-render-digest.ts`, `scratch-screenshot-digest.mjs`) og den
mellomlagrede HTML-filen ble slettet igjen — ingen av dem ble
committet.

### Verifisert

Ingen kode endret denne økten (ren verifisering, samme som Økt 78).
Siste kjente grønne fullkjøring av hele testkjeden er fortsatt fra Økt
77, uendret siden. Den visuelle Playwright-sjekken er beskrevet over.

### Neste økt

Begge de etablerte linje-for-linje-metodene (spec-vs-kode og
live-nettleser-visning) har nå dekket det meste av lavthengende frukt.
Foreslåtte retninger videre: (a) en tredje type verifisering —
faktisk KJØRE `runTick()` sin `digest-tick`-jobb mot en sådd,
realistisk database og observere de faktiske sendte e-postene (via
Brevo-stubbens konsoll-logging når `BREVO_API_KEY` mangler) i stedet
for å kalle rendringsfunksjonen direkte, som denne økten gjorde — dette
ville også legge til en ende-til-ende-sjekk av selve
mottakerfiltreringen og `DigestDelivery`-radene, ikke bare selve
malen; (b) journalist-søknadsflyten i en ekte nettleser (nevnt i Økt
78, ikke gjort ennå); (c) et helt nytt spor: lese README.md og
package.json sine faktiske npm-scripts og bekrefte at ALLE er dekket av
CI-workflowen (`.github/workflows/ci.yml`) — et sted linje-for-linje-
metoden aldri har vært rettet mot. Uendret, fortsatt de tre åpne
spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 80: kjørte digest-tick ende-til-ende mot sådd data — fant og rettet
et reelt, upåaktet hull i createCountry()/updateCountry()s validering

CI-sjekket først at ALLE `package.json`-scripts som trenger automatisert
verifisering faktisk dekkes av `.github/workflows/ci.yml` (foreslått i
Økt 79) — full dekning, `db:generate`/`db:seed`/`start`/`dev` er korrekt
lokale-only og skal ikke være der. Ingen handling.

### Hovedaktivitet: en faktisk kjøring av `runDigestTick()`, ikke bare
rendringsfunksjonen isolert (som Økt 79 gjorde)

Skrev et frittstående, ikke-committet script som sådde et helt FERSKT,
tilfeldig testland (status satt direkte til `active`, egen isolert
landkode — samme etablerte isolasjonsmønster som ellers i
integrasjonstestene), én publisert forespørsel, og to mottakere (én
`nb-NO`, én `en-GB`, for å teste FR-032s "én rendring per locale
FAKTISK i bruk"). Kalte deretter `runDigestTick(db)` DIREKTE (samme
database som `next dev` bruker) og observerte den faktiske konsoll-
utskriften fra Brevo-stubben, samt de faktiske `Digest`- og
`DigestDelivery`-radene som ble opprettet.

**Resultatet var i all hovedsak riktig** — én `Digest`-rad
(`recipientCount: 2`, `status: "sent"`), to `DigestDelivery`-rader (én
per locale, `providerMessageId: null` i stubb-modus, som forventet), og
to `[email:stub:bulk]`-linjer med korrekt emne per locale.

**Men**: konsollen viste også `[i18n] mangler nøkkel
"sender.name.default" i kjeden [nb-NO]` — testscriptets EGEN,
oppdiktede `senderNameKey` (et skrivefeil-eksempel, ikke ment å være
ekte). Dette avdekket et REELT, tidligere upåaktet hull: verken
`createCountry()` eller `updateCountry()` (`src/lib/admin/countries.ts`)
validerte at `nameKey`/`senderNameKey` faktisk FINNES som
oversettelsesnøkler noe sted. `src/i18n/check-keys.ts` (FR-012) kan
ALDRI fange denne klassen feil — den scanner bare statiske
`t("bokstavelig.nøkkel")`-kall i selve koden, mens disse to feltene er
RUNTIME-data (fra `countries`-tabellen) som sendes videre til
`t(dynamiskNøkkel)` (se `sendDigestToRecipients()` i `tick.ts` og
`resolveSenderIdentity()`). En admin-skrivefeil her ville ikke krasjet
noe sted — `createTranslator()` sin graderte reservevei
(`get-messages.ts`) faller til slutt tilbake til bokstavelig "…" — men
ville stille vist "…" som avsendernavn i HVER ENESTE e-post landet
sender, for alltid, uten en eneste feilmelding. Samme bugklasse og
alvorlighetsgrad som `timezone`- og `digestSendTime`-valideringen
(task #121/#122) — men datastrengen selv ser fullstendig normal ut
inntil man faktisk mottar en e-post.

**Et EKSTRA funn under etterforskningen**: `src/db/seed.ts` sin egen
Norge-rad bruker `senderNameKey: "email.sender_name.no"` — en nøkkel
som ALDRI har eksistert i `nb-NO.json`/`en-GB.json`. Siden seed-scriptet
alltid setter status til `draft` (aldri sendt fra), har dette aldri
vist seg som en synlig feil — men det ER nøyaktig det samme hullet, i
den faktiske Norge-konfigurasjonen som er ment å brukes den dagen
landet aktiveres.

**Retting**:
1. La til `isKnownTranslationKey()` i `countries.ts` (sjekker mot
   `getMessagesForLocale(PLATFORM_DEFAULT_LOCALE)`, samme styrke som
   FR-012 selv bruker — kun plattformens standardspråk er en HARD
   hindring, andre språk er fortsatt bare en advarsel jf. 21.3) og kalte
   den for `nameKey`/`senderNameKey` i BÅDE `createCountry()` og
   `updateCountry()` (kun for felt faktisk del av en PATCH, samme mønster
   som `timezone`/`digestSendTime`-sjekkene). Gjenbruker
   `errors.validation_failed` — ingen ny i18n-nøkkel eller UI-endring
   nødvendig.
2. La til den FAKTISKE manglende nøkkelen `email.sender_name.no` i begge
   meldingsfilene ("Kildebanken Norge"/"Kildebanken Norway") — retter
   `seed.ts` sitt reelle hull i selve produksjonskonfigurasjonen, ikke
   bare et testartefakt.
3. Oppdaget at 3 tester i `countries.integration.test.ts` sin delte
   `testCountryInput()`-hjelpefunksjon kalte `createCountry()` direkte
   med bevisst-falske nøkler (`"country.test.name"`,
   `"email.sender_name.test"`) — disse ville nå feile den nye
   valideringen. Byttet DISSE til de nå-ekte `"country.no.name"`/
   `"email.sender_name.no"` (ingen test asserterer på selve teksten, kun
   at feltet lagres). VIKTIG: rørte IKKE `fixtures.ts` sin
   `ensureCountryWithDocuments()` (setter inn direkte via `db.insert()`,
   utenom `createCountry()`s validering) eller
   `sender-identity.integration.test.ts` sin egen, eksplisitt
   dokumenterte "bevisst IKKE en ekte nøkkel"-test — den fortsetter å
   teste `createTranslator()`s reservevei mot en GENUINT manglende
   nøkkel, uendret og fortsatt korrekt begrunnet, siden `fixtures.ts` sin
   sti aldri går gjennom den nye valideringen.
4. La til to nye tester i `countries.integration.test.ts`: `createCountry()`
   avviser en ukjent `nameKey`/`senderNameKey`, og `updateCountry()`
   avviser en ukjent `senderNameKey` — samme mønster som de eksisterende
   `timezone`/`digestSendTime`-testene rett ved siden av.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 470 tester, alle bestod (uendret antall —
  testendringene var kun i integrasjonssuiten).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler (uendret; de to nye
  meldingsnøklene brukes aldri via en statisk `t("...")`-literal i
  koden, kun som data, så de telles ikke her — forventet og korrekt).
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester (343 + 2 nye), ALLE bestod — inkludert
  `sender-identity.integration.test.ts` sin uendrede
  manglende-nøkkel-test, som bekrefter at rettingen ikke ved et uhell
  også lukket DEN bevisst åpne reserveveien.

Committet: `src/lib/admin/countries.ts`,
`src/lib/admin/countries.integration.test.ts`,
`src/i18n/messages/nb-NO.json`, `src/i18n/messages/en-GB.json`.

**Opprydding**: scratch-scriptet (`scratch-run-digest-tick.ts`) og alle
sådde rader (testland, forespørsel, to mottakere, digest- og
delivery-rader) ble slettet/ryddet i selve scriptet før avslutning.

### Neste økt

Denne økten bekrefter verdien av "faktisk kjøre jobben mot sådd data"
som en TREDJE verifiseringsmetode (utover spec-vs-kode-linjelesing og
live-nettleser-skjermbilder) — det var nettopp konsoll-utskriften fra en
EKTE kjøring, ikke en isolert kalt rendringsfunksjon eller en
streng-assertion i en test, som avslørte dette hullet. Verdt å vurdere
samme metode mot de andre jobbene i `tick.ts` (`runExpireRequests`,
`runDeadlineReminders`, `runStaleRequestReminders`,
`runPurgeUnverified`) — alle er grundig enhetstestet, men aldri kjørt
denne måten mot friskt sådd, realistisk data. Andre kandidater fra
tidligere økter, fortsatt ikke gjort: journalist-søknadsflyten i en ekte
nettleser (Økt 78). Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 81: kjørte de fire gjenværende `tick.ts`-jobbene mot sådd data
(rent), og fant/rettet en REELL, alvorlig CSP-regresjon fra Økt 77 via
et faktisk journalist-søknadsforsøk i nettleser

To deler igjen. Del 1 var ren bekreftelse. Del 2 fant noe reelt og
alvorlig.

### Del 1: `runExpireRequests`/`runDeadlineReminders`/
`runStaleRequestReminders`/`runPurgeUnverified` mot sådd data

Fortsatte Økt 80 sin metode til de fire resterende jobbene i
`tick.ts`. Sådde ett testland med tre forespørsler (én med utløpt
frist, én med frist om 12 timer, én publisert for 35 dager siden) og
én ubekreftet bruker (opprettet for 20 dager siden, MED en realistisk
`authTokens`- og `consentRecords`-rad — samme mønster som
`runPurgeUnverified()`s egen kommentar advarer om). Kalte alle fire
funksjonene direkte og sjekket FAKTISK databasetilstand etterpå: alle
fire fungerte korrekt (forespørselen ble `expired`, begge
påminnelsesfeltene ble satt, mottaker-e-postene faktisk sendt via
stubben med riktig innhold, og den ubekreftede brukeren faktisk
slettet). Ingen kodefeil funnet — hele `tick.ts` er nå bekreftet mot
faktisk kjøring, ikke bare enhetstester.

### Del 2: et faktisk journalist-søknadsforsøk avslører en reell
CSP-regresjon fra Økt 77

Fortsatte deretter til den lenge planlagte live-nettleser-sjekken av
journalist-søknadsflyten (`/journalists/apply`, nevnt siden Økt 78).
Sådde et testland med publisert `journalist_terms`-dokument, startet
en EKTE produksjonsserver (`next build` + `next start`, samme mønster
som Økt 77 sin CSP-verifisering — bevisst IKKE `next dev`, som viste
seg å ha sin EGEN, urelaterte CSP-konflikt: webpack sin utviklingsmodus
bruker `eval()`-basert HMR, som `script-src` sin `strict-dynamic` uten
`unsafe-eval` korrekt blokkerer — forventet, ikke en feil), og drev
skjemaet med Playwright.

**Funnet**: å velge land i det stylede nedtrekket ("Land") viste et
ANDRE, stygt natvt `<select>`-nedtrekk med SAMME verdi RETT UNDER det
egentlige, stylede elementet — synlig og faktisk klikkbart, i en
faktisk produksjonsserver, ikke bare i test. Samme mønster for
"Språk". Konsollen viste gjentatte
`Refused to apply inline style because it violates ... "style-src
'self'"`-feil.

**Rotårsak, sporet til biblioteket selv**
(`node_modules/react-aria/dist/private/select/HiddenSelect.js`):
`react-aria-components` sin `Select` (og, samme mekanisme, `Checkbox`/
`RadioGroup` — designsystemets EGET fundament, `src/components/`)
rendrer INTERNT et skjult, men tilgjengelighet-nødvendig natvt
`<select>`/`<input>`-element, skjult via `useVisuallyHidden()` — som
setter en INLINE `style`-attributt. Bibliotekets egen kommentar
forklarer HVORFOR: "In Safari, the `<select>` cannot have
`display: none` ... for autofill to work. In Firefox, there must be a
`<label>` ... The solution is to use `<VisuallyHidden>` ..." — en
reell, dokumentert nettleserkompatibilitetsgrunn, ikke en tilfeldighet.
`style-src 'self'` (UTEN `unsafe-inline`, Økt 77 sin retting) blokkerer
akkurat denne stilen, og det skjulte elementet forblir synlig og
interaktivt.

**Hvorfor Økt 77 ikke fanget dette**: den økten verifiserte CSP-en KUN
mot plassholder-forsiden (`/`), som ikke bruker noen
`react-aria-components`-skjemakomponent i det hele tatt — den fant og
rettet et EKTE, isolert `unsafe-inline`-avvik i akkurat DEN siden
(riktig gjort), men konkluderte feilaktig at hele appen var trygg uten
å ha testet en eneste side med en faktisk Select/Checkbox. Nøyaktig det
samme mønsteret som denne økten selv nå demonstrerer verdien av: en
antatt fiks er ikke bekreftet før den er prøvd mot en REPRESENTATIV
side, ikke bare en enkel én.

**Vurderte og forkastede alternativer** før retting:
- `'unsafe-hashes'` + forhåndsberegnede hasher for de eksakte
  stilstrengene biblioteket produserer: teknisk mulig (CSP3 sin
  hash-basert allow-listing for attributter), men skjørt — enhver
  fremtidig versjonsoppgradering av `react-aria-components` kunne
  stille endre disse eksakte strengene og gjeninnføre nøyaktig samme
  feil, usett, siden ingen eksisterende test i kodebasen dekker denne
  spesifikke mekanismen direkte.
- CSP-noncer på `style-src`: dekker per spesifikasjonen ALDRI
  `style`-ATTRIBUTTER (kun `<style>`-elementer) — ikke en mulig løsning
  her, uavhengig av hvor bra noncen ellers fungerer for `script-src`.

**Retting**: `style-src` fikk `'unsafe-inline'` tilbake (samme
konfigurasjon som FØR Økt 77), MEN `script-src` er UENDRET og fortsatt
helt uten `unsafe-inline`/`unsafe-eval` — det er `script-src`, ikke
`style-src`, som er den faktiske XSS-forsvarslinjen INFRASTRUCTURE.md
12 sitt krav reelt beskytter. `page.tsx`s egen migrering til CSS-modul
(Økt 77) beholdes uendret — ingen egen komponent skal bruke inline
`style`-proppen, kun det som er utenfor applikasjonens kontroll
(biblioteket) trenger relaksjonen. Rettet SPEC (INFRASTRUCTURE.md 12)
FØRST med den fulle begrunnelsen, deretter koden
(`buildCsp()`/`middleware.ts`), som regelen krever. Delte den ene,
upresise testen i `middleware.test.ts` ("inneholder ALDRI
'unsafe-inline', verken på script-src eller style-src") i TO presise
tester: én som bekrefter `script-src` ALDRI har `unsafe-inline`, én som
bekrefter `style-src` BEVISST HAR det.

**Verifisert LEVENDE, ikke bare i tester**: etter fiksen, kjørte
samme Playwright-flyt mot en fersk `next build`/`next start` på nytt.
Skjermbilde bekrefter det duplisert-nedtrekket er BORTE — kun ett,
stylet element for både Land og Språk, ingen synlig natvt
reserve-element. (Et eget, urelatert 500-svar dukket opp ved selve
innsendingen — `sendTransactionalEmail()` nekter bevisst å falle
tilbake til stubb-logging når `BREVO_API_KEY` mangler i
produksjonsmodus, task #115 sin allerede korrekte, tilsiktede
oppførsel — sandkassemiljøet her har aldri en ekte Brevo-nøkkel, så
dette er en kjent, akseptert grense for hvor langt en fullstendig
produksjonsmodus-E2E-test kan nå her, ikke en ny feil.)

**Et driftsuhell underveis, verdt å notere for fremtidige økter**: et
`pkill`-forsøk på å stoppe en kjørende `next start`-prosess "lyktes"
tilsynelatende (tom `ps aux`-utskrift), men den underliggende
`next-server`-prosessen overlevde faktisk og fortsatte å lytte på
porten — en påfølgende `next start` FEILET stille i bakgrunnen med
`EADDRINUSE` (kun synlig i loggfilen, ikke i selve kommandoutskriften),
og ALLE påfølgende `curl`/Playwright-sjekker traff derfor den GAMLE,
urettede serveren i flere runder, og ga et falskt "fiksen virker
ikke"-inntrykk før dette ble oppdaget og prosessen ble drept direkte
med PID (`kill -9`). Verdt å huske: bekreft ALLTID at en bakgrunnsserver
faktisk startet (sjekk loggfilen for feil, ikke bare at `curl` svarer
200 — en gjenværende gammel prosess svarer jo også 200) etter enhver
omstart under en fiks-og-reverifiser-syklus.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 471 tester (470 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler (uendret).
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret.
- Levende verifisering: full `next build` + `next start` +
  Playwright-drevet skjemautfylling, se over — skjermbilde tatt før og
  etter fiksen.

Committet: `src/middleware.ts`, `src/middleware.test.ts`,
`INFRASTRUCTURE.md`.

**Opprydding**: alle scratch-scriptene fra begge deler av økten
(`scratch-run-remaining-jobs.ts`,
`scratch-seed-journalist-apply.ts`,
`scratch-playwright-journalist-apply.mjs`,
`scratch-debug-submit.mjs`, og noen korte engangs-debug-script som ble
slettet fortløpende) ble slettet, alle sådde testland/brukere/
forespørsler ble ryddet fra utviklingsdatabasen, og produksjonsserveren
ble stoppet (med `kill -9` direkte på PID, se driftsnotatet over).

### Neste økt

Med denne rettingen er BÅDE `script-src` og `style-src` nå verifisert
LEVENDE mot en representativ side (ikke bare plassholderforsiden) —
verdt å vurdere en rask, bred sveip: kjør samme
Playwright-mot-produksjonsserver-sjekk mot MINST én side per
skjema-komponenttype i `src/components/` (Select er nå bekreftet,
Checkbox delvis via samme flyt, men RadioGroup/TextArea er ALDRI
sjekket denne veien) for å bekrefte at ingen ANDRE, ennå uoppdagede
CSP-konflikter finnes andre steder i `react-aria-components` sin
interne bruk. Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 82: fullførte komponentsveipen fra Økt 81 — RadioGroup/TextArea
mot en ekte produksjonsserver, rent funn

Fulgte direkte opp Økt 81 sin "Neste økt": den ENESTE
skjema-komponenttypen som ennå ikke var testet mot en ekte
`next build`/`next start` etter CSP-rettingen. Svarskjemaet
(`ResponseForm.tsx`, `/foresporsler/:id/svar`) bruker BEGGE de
gjenstående typene samtidig (tre `TextArea`-felt, én `RadioGroup` for
kontaktdeling, SPEC-V1.md 12.2) — samme mottakerside som ble
livesjekket i Økt 78, men DEN gangen mot `next dev` (som har sin egen,
urelaterte CSP-begrensning, se Økt 81) og uten noen sjekk for
CSP-konsollfeil eller duplisert DOM.

Sådde et fersk testland, en publisert forespørsel, og en innlogget
mottaker. Kjørte en ekte `next build` + `next start`
(port 3460, en ANNEN port enn forrige økt for å unngå Økt 81 sin
`EADDRINUSE`-felle — og eksplisitt bekreftet med `ps aux` at KUN én
`next-server`-prosess kjørte før noen sjekk ble gjort, samme
driftslærdom fra forrige økt). Fylte ut alle tre TextArea-feltene og
klikket et RadioGroup-alternativ via Playwright, med konsoll-lytting
for CSP-feil.

**Resultat: rent funn, ingen kodefeil.** Null
`Content-Security-Policy`-feil i konsollen gjennom hele flyten. Nøyaktig
to `<input type="radio">`-elementer på siden (det korrekte, forventede
antallet — `RadioButton` fra `react-aria-components` rendrer den ekte
radioknappen direkte og synlig-stilt, ULIKT `Select` sin
skjulte-natvt-reserve-mekanisme som var selve kilden til Økt 81 sin feil;
det finnes altså ikke noe TILSVARENDE skjult element å bryte for
RadioGroup). Null `<select>`-elementer (forventet, ingen på denne
siden). Skjermbilde bekrefter et helt rent, korrekt rendret skjema —
tegntellere stemmer, visningsnavnet er fortsatt korrekt forhåndsutfylt
fra kontoen (Økt 71 sin fiks, uendret), og det valgte
RadioGroup-alternativet vises tydelig markert.

Med dette er svaret på Økt 81 sin spørsmål bekreftet: `unsafe-inline`
på `style-src` var nødvendig SPESIFIKT for `Select` sin
`HiddenSelect`-mekanisme, ikke en generell konflikt mellom CSP og
`react-aria-components` som helhet — `Checkbox` (bekreftet indirekte i
Økt 81 sin egen flyt) og `RadioGroup`/`TextArea` (denne økten) har
INGEN tilsvarende skjult-element-mekanisme som ville trengt samme
relaksjon. Komponentsveipen er dermed fullført — alle skjema-
komponenttypene i `src/components/` er nå verifisert LEVENDE mot en
ekte produksjonsserver minst én gang.

### Verifisert

Ingen kode endret denne økten (ren verifisering). Siste kjente grønne
fullkjøring av hele testkjeden er fortsatt fra Økt 81, uendret siden.
Den levende Playwright-sjekken (mot ekte `next build`/`next start`) er
beskrevet over.

**Opprydding**: alle sådde rader (testland, journalist, mottaker,
forespørsel, økt) ble slettet fra utviklingsdatabasen, scratch-
scriptene (`scratch-seed-response-form.ts`,
`scratch-playwright-response-form.mjs`) ble slettet, og
produksjonsserveren ble stoppet med `kill -9` direkte på PID (bekreftet
først med `ps aux` at nøyaktig én prosess kjørte, samme forsiktighet
som Økt 81 sin driftslærdom anbefalte).

### Neste økt

Med komponentsveipen ferdig og alle tre etablerte verifiseringsmetodene
(spec-vs-kode-linjelesing, live-nettleser-skjermbilder,
kjør-jobb-mot-sådd-data) nå grundig anvendt flere ganger hver, er
lavthengende frukt av disse spesifikke metodene sannsynligvis uttømt
for denne runden. Vurder et helt nytt spor for neste økt: (a) et
strukturert søk etter FLERE skjulte antagelser om `NODE_ENV`/
driftsmiljø som bare viser seg ved en ekte `next start` (samme klasse
som BREVO_API_KEY-sperren denne økten støtte på, men den var allerede
kjent/tilsiktet — finnes det TILSVARENDE, MEN utilsiktede sperrer andre
steder som aldri er testet i produksjonsmodus?); (b) en kritisk
gjennomlesing av en modul som ikke har fått en dedikert økt ennå (sjekk
NATTLOGG-historikken for hvilke `src/lib/`-filer aldri har vært
gjenstand for en "critical-read"-økt); (c) SPEC-V1.md sin egen liste
over ETTERSPURTE, MEN kanskje aldri bygde detaljer utenfor
hovedflytene (varslingsinnstillinger, eksport av egne data, e.l.) —
verdt et helt nytt gjennomsøk fra bunnen, ikke bare seksjon-for-seksjon
slik det allerede er gjort. Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 83: kritisk gjennomlesing av flere `src/lib/`-moduler uten
tidligere dedikert økt — fant en reell, ubrukt sikkerhetshjelpefunksjon

Fulgte opp Økt 82 sin spor (b): gikk gjennom `src/lib/`-filer som ALDRI
har vært nevnt i en tidligere "critical-read"-oppgave
(`datetime/timezone.ts`, `legal/documents.ts`,
`journalists/journalist-profile.ts` + tilhørende
`JournalistProfileForm.tsx`, `me/validate.ts`,
`requests/validate.ts`, `responses/validate.ts`,
`moderation/responses.ts`, `subscriptions/bounce-policy.ts` og
`subscriptions/email-events.ts`).

**Rene funn, ingen handling** (allerede solid, godt begrunnet, eller
bevisst avgrenset kode):
- `datetime/timezone.ts`: to-iterasjons vegg-klokkeslett↔UTC-
  konvertering, med et EKSPLISITT dokumentert DST-overgangsavvik som
  bevisst ikke håndteres særskilt — testdekningen inkluderer faktiske
  sommertid-overganger og en ikke-hel-time-forskyvning (Asia/Kathmandu).
  Ingen feil.
- `legal/documents.ts`: `getCurrentLegalDocument()`/
  `getRequiredLegalDocuments()` er begge korrekte og enkle.
  `isMaterialChange` sin "tvungen re-samtykke"-del av 17.2 er allerede
  eksplisitt dokumentert som en bevisst IKKE bygget UX-beslutning
  (spec-en sier ikke NÅR/HVORDAN), ikke et hull.
- `journalist-profile.ts`/`JournalistProfileForm.tsx`: `maxLength`
  stemmer allerede korrekt med serverens Zod-grense (200) på alle tre
  tekstfeltene — IKKE en gjentakelse av maxLength-bug-klassen fra
  tidligere økter (task #57/#59/#126/#127).
- `me/validate.ts`, `requests/validate.ts`, `responses/validate.ts`:
  rene, godt strukturerte valideringsfunksjoner, ingen avvik fra sine
  respektive spec-grenser.
- `moderation/responses.ts` (`hideResponse()`): TOCTOU allerede lukket
  (samme mønster som `approveJournalist()`/`publishRequest()`), inkludert
  kansellering av ventende kontaktforespørsler ved skjuling.
- `subscriptions/bounce-policy.ts`/`email-events.ts`: allerede
  TOCTOU-hardet (atomisk `+1` i SQL, ikke les-så-skriv, se tidligere
  økters egne kommentarer), korrekt normalisering av Brevo sine
  hendelsestyper (inkludert `invalid`-fiksen fra økt 11).

**Et reelt funn**: `src/lib/auth/tokens.ts` har en dedikert, testet
`tokensMatch()`-funksjon — konstant-tid strengsammenligning via Node
sin `timingSafeEqual`, bygget nettopp for å unngå at en hemmelighet
lekkes via responstid-forskjeller ved sammenligning mot
angriper-kontrollert input. Et grep etter alle faktiske bruksstinger
viste at den ALDRI faktisk er koblet inn noe sted i selve applikasjonen
— kun i sin egen test. Grunnen: alle ANDRE token-sjekker i kodebasen
(innloggingslenker, digest-tilgang, avmelding) bruker et helt annet,
i seg selv trygt mønster (hash tokenet, slå det opp i databasen via
`WHERE tokenHash = ...`) som ikke er sårbart for akkurat denne
angrepsklassen. Men ETT sted gjør en RÅ, direkte streng-mot-streng-
sammenligning av en hemmelighet fra miljøet mot angriper-kontrollert
input: `isAuthorized()` i
`src/app/api/webhooks/email-events/route.ts` (Brevo-webhooken sin
`EMAIL_WEBHOOK_SECRET`-sjekk), som brukte rå `===` i stedet.

**Retting**: byttet `===` til `tokensMatch()` i `isAuthorized()`, satt
den allerede bygde og testede hjelpefunksjonen faktisk i bruk for
første gang. La også til en eksplisitt `if (!provided) return false`
før kallet (samme oppførsel som før — `null === hemmelighet` var
allerede alltid usann — men nødvendig for at TypeScript skal innsnevre
`provided` fra `string | null` til `string` før `tokensMatch()` sine
strengt typede parametre).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 471 tester, alle bestod uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret — inkludert de eksisterende
  auth-relaterte testene for akkurat denne ruten (manglende hemmelighet,
  feil hemmelighet via søkeparameter/header, ingen hemmelighet i det
  hele tatt), som alle fortsatt består identisk med den nye,
  konstant-tid sammenligningen.

Committet: `src/app/api/webhooks/email-events/route.ts`.

### Neste økt

Kritisk-lesing-sveipen kan fortsette til de resterende, ennå ikke
dedikert gjennomgåtte `src/lib/`-filene (f.eks.
`http/safe-redirect.ts` sin fulle bruk utover selve den allerede
rettede open-redirect-bugen, `forms/focus-first-invalid.ts`,
`requests/slug.ts`/`topics.ts`, `responses/status-badge.ts`/
`requests/status-badge.ts`/`contact-requests/status-badge.ts`) — men
disse er hovedsakelig små, rene hjelpefunksjoner med lav forventet
treffrate. Mer lovende: gjør et TILSVARENDE grep-basert søk etter andre
BYGDE-MEN-ALDRI-BRUKTE hjelpefunksjoner/eksporter i kodebasen (samme
metode som avdekket `tokensMatch()`) — dette var en direkte, effektiv
måte å finne en reell, upåaktet sikkerhetsfeil på, og det er ingen
grunn til å tro `tokensMatch()` var den ENESTE slike. Uendret, fortsatt
de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 84: gjentok grep-etter-ubrukte-eksporter-metoden fra Økt 83 — fant
to nye, reelle funn

Skrev et lite script som lister alle `export function`/`export const`/
`export class` i `src/lib/` og `src/components/`, og sjekker om hvert
navn faktisk forekommer NOE ANNET sted i `src/` enn sin egen fil.
Nøyaktig samme metode som avdekket `tokensMatch()` i Økt 83. Tre treff
denne runden, alle reelle:

**1. `FIELD_LIMITS`/`RESPONSE_FIELD_LIMITS` eksportert, aldri
importert noe sted.** `RequestEditForm.tsx` og `ResponseForm.tsx`
hadde HVER SIN egen, hardkodede kopi av akkurat de samme tallene
(`title: 120`, `summary: 300` osv.) i stedet for å importere de
allerede eksisterende, kanoniske konstantene fra
`requests/validate.ts`/`responses/validate.ts`. Tallene stemte
FAKTISK overens akkurat nå — men dette er PRESIS samme sårbare mønster
(en UI-kopi som kan gli fra serverens ekte grense uten at noe fanger
det) som forårsaket fire tidligere, reelle bugs i denne kodebasen
(task #57, #59, #126, #127 — hver gang en `maxLength` i et skjema
falt ut av synk med serverens faktiske grense). At konstantene ALLEREDE
var eksportert (ikke bare definert) er selv et sterkt tegn på at noen
tidligere økt hadde til hensikt at de skulle importeres et sted, men
det skjedde aldri.

**Retting**: `ResponseForm.tsx` importerer nå
`RESPONSE_FIELD_LIMITS` direkte (aliasert til `LIMITS` for å unngå å
måtte endre resten av filen — alle fire nøkler stemte eksakt).
`RequestEditForm.tsx` importerer `FIELD_LIMITS` og sprer den inn i sin
egen lokale `LIMITS`, som fortsatt legger til `geographicNote`/
`internalReference` lokalt (disse er IKKE del av `FIELD_LIMITS` —
de er valgfrie felt validert direkte i selve API-rutens Zod-skjema,
ikke i `validateForSubmit()`, en allerede etablert og korrekt
arkitektonisk deling, ikke en feil).

**2. `getRespondentView()` i `responses/responses.ts` — fullt
implementert, eksportert, men null kallere og null tester noe sted.**
Sporet den tilbake til hva den TYDELIGVIS var bygget for å drive: en
enkelt-svar-detaljside for respondenten (viser status, organisasjon,
kontaktdelingsvalg, innsendt-/lest-tidspunkt for ÉTT svar via
`responseId`). Ingen slik side finnes — `/me/svar`
(`MyResponsesList.tsx`) viser allerede ALT dette inline i selve listen
(tittel, organisasjon, statusmerke, dato, trekk-knapp), uten behov for
en egen detaljside. SPEC-V1.md seksjon 20 sin egen API-liste bekrefter
dette — der finnes `GET /responses/mine` og
`POST /responses/:id/withdraw`, men ALDRI en `GET /responses/:id` for
respondenten selv. Konkluderte at dette er reell, forlatt kode fra et
tidligere designspor (en egen detaljside som senere ble forenklet bort
til en ren liste), ikke en glemt, fortsatt nødvendig funksjon — slettet
den helt, samme prinsipp som README.md/systeminstruksen selv sier om
kode man er sikker på er ubrukt.

Scriptet ga nøyaktig tre treff totalt denne runden — `FIELD_LIMITS`,
`RESPONSE_FIELD_LIMITS` og `getRespondentView` — og alle tre var
reelle, ikke falske positiver. Etter begge rettingene: kjørte samme
grep-script på nytt — null treff.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 471 tester, alle bestod uendret.
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret.
- Ubrukte-eksporter-grepet selv: null treff igjen etter rettingen
  (opprinnelig 3, 1 falsk positiv).

Committet: `src/app/[locale]/foresporsler/[id]/svar/ResponseForm.tsx`,
`src/app/[locale]/journalist/requests/[id]/RequestEditForm.tsx`,
`src/lib/responses/responses.ts`.

### Neste økt

Metoden (grep etter eksporterte navn som aldri forekommer noe annet
sted i `src/`) har nå funnet TRE reelle ting på to økter (en
sikkerhetsfeil, en drift-sårbar duplisering, ett stykke reelt død kode)
— verdt minst ÉN mer runde etter at flere av denne nattens andre
rettinger har satt seg (nye eksporter dukker jevnlig opp). Vurder også
å UTVIDE scriptet til å dekke `src/app/api/`-mapper (rene
hjelpefunksjoner utenfor selve route-handlerne) og typer/interfacer,
ikke bare funksjoner/konstanter — regex-en denne økten dekket kun de
tre enkleste eksport-formene. Uendret, fortsatt de tre åpne
spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 85: utvidet ubrukte-eksporter-søket til typer/interfacer og flere
mapper — mest støy, men ett reelt, arkitektonisk hull i selve
i18n-fallback-kjeden

Utvidet gårsdagens script (Økt 83/84) til også å dekke
`src/app/api/`, `src/i18n/`, `src/db/`, og flere eksport-former
(`interface`/`type`, ikke bare `function`/`const`/`class`).

**Nesten alt var forventet støy**, av tre distinkte, gode grunner —
verdifullt å ha bekreftet, men ingen handling:
- ~70 av ~80 treff var `interface`/`type`-eksporter. TypeScript sin
  returtype-inferens gjør at et kallested SJELDEN trenger å skrive
  typenavnet eksplisitt (`const result = await performAccountDeletion(...)`
  bruker `AccountDeletionResult` sin form uten noensinne å nevne NAVNET) —
  scriptets enkle navne-grep kan strukturelt ikke se denne bruken. Ikke en
  bugklasse denne metoden kan si noe fornuftig om.
- `pgEnum()`-konstantene i `schema.ts` (`countryStatus`, `userRole` osv.)
  brukes bare INNE I schema.ts selv, som kolonnetype-fabrikker
  (`role: userRole("role")`) — scriptet ekskluderer bevisst treff i egen
  fil, så disse regnes som "ubrukt ANDRE steder", som er nettopp deres
  eneste og korrekte jobb.
- `teardown` i `global-teardown.ts` refereres av `vitest.integration.config.ts`
  sin `globalSetup`-sti (Vitest sin egen konvensjon, ikke en vanlig
  import) — usynlig for et navne-grep.

**Ett reelt, funksjons-nivå treff**: `resolveMessage()` i
`src/i18n/get-messages.ts`. SPEC-V1.md 3.4 krever eksplisitt en
TRE-ledds fallback-kjede for grensesnitt og e-poster: "forespurt locale
→ landets `default_locale` → plattformens standardspråk."
`resolveMessage()` implementerer nøyaktig denne kjeden korrekt — men
`createTranslator()`, funksjonen ALLE 88 faktiske kallesteder i
appen bruker, implementerte bare et TO-ledds hopp (forespurt locale →
plattformens standardspråk direkte), og hoppet ALDRI innom landets
eget `default_locale` i mellom. `resolveMessage()` var aldri faktisk
koblet inn noe sted — ren, testet, men helt frakoblet logikk.

**Hvorfor dette er reelt, men ufarlig akkurat nå**: v1 har ett land og
to locale-er som er FULLSTENDIG synkronisert (ingen advarsler fra
`check-keys.ts` sin egen lokale-gap-sjekk noensinne denne natten) — det
manglende mellomleddet kan derfor ALDRI observeres i dagens
konfigurasjon, siden den forespurte locale-en alltid enten treffer
direkte eller ville truffet uansett hvilket mellomledd som var der.
Hullet blir en EKTE, synlig feil den dagen land nummer to legges til
med et eget, ikke-standard `default_locale` OG en tredje, ufullstendig
locale (21.3 tillater eksplisitt akkurat det scenarioet) — da ville en
bruker med den ufullstendige locale-en hoppe rett til plattformens
standardspråk for en manglende nøkkel, i stedet for først å prøve LANDETS
egen, kanskje faktisk komplette, oversettelse.

**Retting, minimal og bakoverkompatibel**: `createTranslator()` fikk en
NY, VALGFRI andre parameter (`countryDefaultLocale?`), og bygger nå selv
en fallback-kjede som delegeres til `resolveMessage()` — i stedet for å
duplisere reservevei-logikken selv (DRY, samme prinsipp som Økt 84 sin
`FIELD_LIMITS`-retting). Alle 88 eksisterende kallesteder (som kun
oppgir ett argument) får BYTE-IDENTISK oppførsel som før — ingen
side-effekt for eksisterende kode. En FREMTIDIG kaller med kjent
landkontekst (f.eks. en server-komponent som allerede har slått opp
landet) kan nå velge å sende det andre argumentet for å faktisk lukke
3.4-hullet der det trengs, uten at HELE appen måtte bygges om i én
runde.

**Bonus-funn under samme retting**: den gamle, inline
`createTranslator()`-logikken logget ALLTID `console.warn` ved en
manglende nøkkel, selv når nøkkelen manglet i BÅDE forespurt locale OG
plattformens standardspråk (en reell totalmiss) — `resolveMessage()`
sin egen, allerede korrekte alvorlighetsgrad-distinksjon
(`console.warn` for en løst reservevei, `console.error` for en total
miss) ble aldri faktisk utnyttet via `createTranslator()` frem til nå.
Retter seg selv som en naturlig bieffekt av delegeringen — ingen egen
kode trengtes.

**Nye tester**: 4 nye tester i `get-messages.test.ts` — bekrefter
bakoverkompatibilitet (samme locale to ganger = samme resultat som én
gang), at forespurt locale fortsatt vinner når den faktisk har
nøkkelen, at et ukjent/ustøttet locale-navn i kjeden hoppes over til
neste ledd, og at en reell totalmiss fortsatt returnerer "…" i stedet
for en rå nøkkel.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 475 tester (471 + 4 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret — inkludert
  `sender-identity.integration.test.ts` sin bevisst-fake-nøkkel-test,
  som nå (korrekt) logger `console.error` i stedet for `console.warn`
  for akkurat den totalmiss-en, uten at noen test faktisk asserterer på
  selve konsoll-alvorlighetsgraden.

Committet: `src/i18n/get-messages.ts`, `src/i18n/get-messages.test.ts`.

### Neste økt

Ubrukte-eksporter-metoden er nå trolig uttømt for `function`/`const`
-nivå funn (fire reelle ting funnet over tre økter: `tokensMatch()`,
`FIELD_LIMITS`/`RESPONSE_FIELD_LIMITS`, `getRespondentView()`,
`resolveMessage()`) — videre kjøringer av akkurat DENNE metoden har
lav forventet avkastning fremover, siden treelisten nå er null og de
færreste NYE eksporter vil oppstå uten bruk fra samme økt som skriver
dem. Et friskt spor for neste økt: nå som `createTranslator()` faktisk
STØTTER landets `default_locale` som mellomledd, vurder om det finnes
NOEN kallesteder i faktisk server-rendret kode (sidekomponenter som
allerede har slått opp landet fra databasen, f.eks. digest-relatert
rendering eller e-postmaler som allerede mottar `countryCode`) der det
ville vært billig og riktig å FAKTISK sende det andre argumentet — ikke
en påkrevd endring, men en naturlig, lavthengende oppfølging av denne
økten. Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 86

### Wired countryDefaultLocale into digest rendering and shared sender-identity helper

Direkte oppfølging av forrige økts eget "Neste økt"-spor: nå som
`createTranslator()` faktisk STØTTER landets `default_locale` som
mellomledd i SPEC-V1.md 3.4 sin fallback-kjede (bygget, men ikke koblet
inn noe sted i Økt 85), lette denne økten etter kallesteder som ALLEREDE
har landkontekst i scope — der det andre argumentet er billig å sende
uten en ny spørring — fremfor et stort refaktoreringsløp.

**To kallesteder valgt, begge allerede med landraden i scope:**

1. **Digest-rendringsstien**: `sendDigestToRecipients()`/`runDigestTick()`
   i `src/lib/jobs/tick.ts` har allerede `country`-objektet fra sin egen
   spørring (for `country.timezone` m.m.) — `country.defaultLocale`
   krevde derfor ingen ny spørring, kun å sende den videre. Samme
   mønster i `retryFailedDigestDeliveries()` i `src/lib/digests/digests.ts`,
   som også allerede henter landraden for `senderNameKey`/`supportEmail`.
   Begge kaller nå `renderDigestContent()` (`src/lib/email/digest.ts`,
   ny valgfri 5. parameter `countryDefaultLocale?: SupportedLocale`) og
   `createTranslator()` for avsendernavnet med det utledede
   `countryDefaultLocale`-et (faller selv tilbake til
   `PLATFORM_DEFAULT_LOCALE` hvis landets lagrede locale av en eller
   annen grunn ikke er en støttet locale).

2. **Den delte `resolveSenderIdentity()`-hjelpefunksjonen**
   (`src/lib/email/sender-identity.ts`) — dokumentert i sin egen,
   eksisterende kommentar som brukt av "ni filer" av
   `sendTransactionalEmail()`-kallesteder. Denne funksjonen slår
   allerede opp landraden (for `support_email`), så å legge til
   `defaultLocale` i samme `select()` var gratis. Én retting her
   propagerer SPEC 3.4-etterlevelsen til alle ni kallesteder uten å
   røre noen av dem individuelt.

**Bevisst utsatt, ikke gjort denne økten**: de ~24 individuelle
e-postmalfilene under `src/lib/email/templates/*.ts` tar i dag KUN
`locale: SupportedLocale` som parameter, uten landkontekst tilgjengelig
lokalt — å koble inn `countryDefaultLocale` der ville kreve å røre
både malenes egne signaturer OG hvert av deres ~24 ulike
kallesteder (moderasjon, registrering, osv. — spredt over mange filer).
Vurdert som for stort omfang for én økt sammenlignet med de to billige,
allerede-landkontekst-bærende gevinstene over. Notert som friskt spor
for en fremtidig økt, ikke en påkrevd endring.

**Ny test**: `digest.test.ts` fikk én ny test som bekrefter
bakoverkompatibilitet — identisk resultat med og uten det femte,
valgfrie argumentet når forespurt locale (nb-NO i testen) allerede har
hver eneste nøkkel som brukes. Samme testbarhetsbegrensning som Økt 85
sin egen NATTLOGG-notat: å faktisk observere FORSKJELLEN mellom
mellomleddene i kjeden krever en kunstig ufullstendig locale, som ikke
finnes i dagens fixtures.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 476 tester (475 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret — ingen regresjon i
  `tick.integration.test.ts`, `digests.integration.test.ts` eller
  `sender-identity.integration.test.ts`.

Committet: `src/lib/jobs/tick.ts`, `src/lib/email/digest.ts`,
`src/lib/digests/digests.ts`, `src/lib/email/sender-identity.ts`,
`src/lib/email/digest.test.ts`.

### Neste økt

De to billigste, mest naturlige kallestedene for
`countryDefaultLocale` er nå koblet inn. Et friskt spor for neste økt:
vurder OM og HVORDAN de ~24 e-postmalfilene under
`src/lib/email/templates/` bør utvides til å ta imot landets
`default_locale` også — dette er trolig et flerøkt-løp gitt antall
kallesteder, så vurder først om gevinsten (et hull som per nå er usynlig
i v1 med kun ett land) faktisk forsvarer omfanget, eller om et annet
spor med høyere forventet avkastning bør prioriteres først (f.eks. en
ny sweep av `src/app/api/` for asymmetriske FR-023-lignende hull, eller
en fornyet "ubrukte eksporter"-kjøring nå som fem nye filer er endret
denne natten). Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 87: fullførte SPEC-V1.md 3.4-mellomleddet gjennom HELE
transaksjonell e-post-stien — alle 23 maler, ikke bare avsendernavnet

### Ubrukte-eksporter-metoden, gjentatt: null nye treff (som forventet)

Kjørte samme grep-baserte script som Økt 83-85 (funksjon/const/class/
interface/type-eksporter i `src/lib`, `src/components`, `src/app/api`,
`src/i18n`, `src/db` som aldri forekommer noe annet sted i `src/`) på
nytt, siden fem filer var endret siden forrige kjøring. ~79 treff, ALLE
av de tre allerede dokumenterte støy-kategoriene fra Økt 85
(type/interface-returtype-inferens, `pgEnum()`-fabrikkonstanter i
`schema.ts`, `teardown` sin Vitest-konvensjon) — null treff på
`function`/`const`/`class`-nivå. Bekrefter Økt 85 sin egen spådom:
metoden er nå uttømt for denne kodebasens nåværende tilstand. Ingen
handling.

### Hovedfunn: sendTransactionalEmail() er ÉN sentral dispatcher — langt
billigere å lukke 3.4-hullet fullt ut enn tidligere antatt

Fulgte opp Økt 86 sitt spor: undersøkte kallestedene til
`resolveSenderIdentity()` (10 filer) nærmere for å se om noen av de
~24 e-postmalene kunne kobles til `countryDefaultLocale` billig. Viste
seg at ALLE transaksjonelle maler rendres FRA ÉTT sted:
`renderTransactionalEmail()` i `src/lib/email/send.ts`, kalt internt
av `sendTransactionalEmail()` — de ~10 kallestedene selv kaller ALDRI
`renderXEmail()` direkte, de sender bare `{ template, to, data,
senderName, replyTo }` til dispatcheren. Antagelsen fra Økt 86 (at å
lukke hullet i selve e-postINNHOLDET ville kreve å røre alle ~24
malfilers individuelle kallesteder) var feil — det er ÉN fil, ikke ti
eller tjuefire.

**Retting, i fire lag:**

1. `SenderIdentity` (`sender-identity.ts`) fikk et nytt felt
   `countryDefaultLocale: SupportedLocale` — landraden slås uansett opp
   der (for `support_email`), så dette er ingen ny spørring, bare et
   eksponert felt fra en verdi som allerede ble beregnet internt.
2. `SendTransactionalEmailInput` (`send.ts`) fikk et nytt, VALGFRITT
   felt `countryDefaultLocale?: string` (valgfritt i motsetning til de
   nå obligatoriske `senderName`/`replyTo` — noen kallesteder, f.eks.
   innloggingslenken før brukeren er tilknyttet et land, har ingen
   landkontekst i det hele tatt). `renderTransactionalEmail()` løser
   den (samme `isSupportedLocale`-mønster som ellers) og sender den som
   siste argument til SAMTLIGE 23 malers `renderXEmail()`-kall.
3. Alle 23 `renderXEmail()`-funksjoner i `src/lib/email/templates/`
   fikk en ny, valgfri, siste parameter `countryDefaultLocale?:
   SupportedLocale`, videreført til sitt eget `createTranslator(locale,
   countryDefaultLocale)`-kall — mekanisk, identisk mønster i hver fil
   (gjort med et lite Python-script, deretter verifisert fil for fil og
   med `tsc`/`eslint`). `renderSimpleCtaEmail()` (den delte,
   underliggende HTML-skallet) trengte INGEN endring — den mottar bare
   allerede-oversatte strenger, den kaller aldri `createTranslator()`
   selv.
4. Alle 20 faktiske `sendTransactionalEmail(...)`-kall (10 filer, siden
   tre av dem har flere kallesteder hver) fikk en ny linje
   `countryDefaultLocale: identity?.countryDefaultLocale,` rett etter
   sin eksisterende `senderName`/`replyTo`-linje — samme `identity`
   (eller `respondentIdentity`/`journalistIdentity` i responses.ts) som
   allerede var hentet via `resolveSenderIdentity()` for
   avsendernavnet.

**Resultat**: SPEC-V1.md 3.4 sin tre-ledds fallback-kjede (forespurt
locale → landets default_locale → plattformens standardspråk) er nå
reelt koblet inn i HELE e-poststien — både avsendernavnet (Økt 86) og
selve emne-/brødteksten (denne økten), for BÅDE transaksjonell e-post
(alle 23 maler) og digest-e-post (Økt 86). Ingen kjente gjenværende
kallesteder som bevisst utelater det andre argumentet av annen grunn
enn manglende landkontekst.

**Bakoverkompatibilitet**: alle 88+ eksisterende kallesteder til
`createTranslator()` som IKKE oppgir det andre argumentet (typer/
komponenter/tester som fortsatt bare bruker forespurt locale direkte)
er upåvirket — feltet er valgfritt hele veien gjennom. De 34
eksisterende testene i `send.test.ts` (som alle sender `senderName:
undefined, replyTo: undefined` uten `countryDefaultLocale`) består
uendret.

**Ny test**: én ny test i `send.test.ts`, samme
testbarhetsbegrensning som Økt 86 sin `digest.test.ts`-test (nb-NO har
hver eneste nøkkel som `magic_link`-malen bruker, så en reell
observerbar forskjell krever en kunstig ufullstendig locale som ikke
finnes i fixturene) — bekrefter i stedet byte-identisk logget innhold
med og uten det nye feltet.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 86 filer, 477 tester (476 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 533 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret.

Committet: `src/lib/email/send.ts`, `src/lib/email/send.test.ts`,
`src/lib/email/sender-identity.ts`, alle 23 filer i
`src/lib/email/templates/` (unntatt `simple-cta-email.ts`, uendret),
`src/lib/admin/legal-documents.ts`, `src/lib/jobs/tick.ts`,
`src/lib/auth/account-deletion.ts`, `src/lib/auth/magic-link.ts`,
`src/lib/moderation/requests.ts`, `src/lib/moderation/journalists.ts`,
`src/lib/contact-requests/contact-requests.ts`,
`src/lib/requests/requests.ts`, `src/lib/reports/reports.ts`,
`src/lib/responses/responses.ts`.

### Neste økt

SPEC-V1.md 3.4-sporet (påbegynt Økt 85, ført videre Økt 86-87) er nå
trolig FULLFØRT for alle kjente e-postveier — verdt en rask,
uavhengig bekreftelse neste økt (f.eks. et grep etter alle gjenværende
`createTranslator(` -kall i `src/lib/email/` for å bekrefte at ingen
ble oversett), men ikke mer STRUKTURELT arbeid ventet her med mindre
noe nytt dukker opp. Et friskt spor: det er lenge siden en fullstendig
SPEC-V1.md-linje-for-linje-sveip ble gjort fra bunnen av (de fleste
nylige øktene har vært punktvise oppfølginger) — vurder en ny,
fullstendig gjennomgang av spec-en mot koden, siden mange filer er
endret siden forrige hele sveip og et nytt hull kan ha sneket seg inn
utilsiktet. Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 88: fant og rettet et reelt spec-hull i FR-029s avvisningsmelding
under en fornyet SPEC-V1.md-gjennomgang (seksjon 9)

Fulgte opp Økt 87 sitt spor: startet en fornyet, fra bunnen av,
linje-for-linje-gjennomgang av SPEC-V1.md, siden det var lenge siden
forrige hele sveip. Kom til seksjon 9 (Forespørsel) denne økten.

### Kvitteringer, ingen handling

- 9.1 sin fastlagte temaliste (21 nøkler, `work` … `other`) stemmer
  eksakt (rekkefølge og alt) med `REQUEST_TOPICS` i
  `src/lib/requests/topics.ts`.
- 9.1s feltgrenser (120/300/5000/500/100/100 tegn) stemmer med
  `FIELD_LIMITS` i `requests/validate.ts` (allerede verifisert i
  tidligere økter, bekreftet på nytt).

### Reelt funn: FR-029s avvisningsmelding manglet halvparten av det
spec-en krever

9.2 sier eksplisitt: en journalist som prøver å publisere et sjette
samtidig `published`-forespørsel skal avvises "med en feilmelding som
forklarer hvorfor, **og lister hvilke forespørsler journalisten må
lukke først**." `submitRequest()` i `src/lib/requests/requests.ts`
returnerte kun `errors.too_many_published_requests` — en generisk,
oversatt tekst ("Du har allerede for mange åpne forespørsler. Lukk én
før du sender en ny.") uten noen liste over HVILKE forespørsler.
Frontend (`RequestEditForm.tsx`) viste kun denne ene teksten, ingen
lenker til journalistens egne publiserte forespørsler.

**Retting:**

1. `RequestActionResult` sin feilvariant fikk et nytt, valgfritt felt
   `blockingRequests?: { id: string; title: string }[]`.
2. `submitRequest()` henter nå selve radene (id, title) i stedet for
   bare et `count()`, og fyller `blockingRequests` når grensen er nådd.
   Ingen ny spørring lagt til — samme WHERE-betingelse som før, bare
   flere kolonner valgt.
3. `POST /requests/:id/submit` (API-ruten) sender `blockingRequests`
   videre i JSON-responsen.
4. `RequestEditForm.tsx` viser nå en overskrift
   ("Lukk én av disse for å fortsette:") og en lenkeliste til hver
   blokkerende forespørsel (`/${locale}/journalist/requests/${id}`,
   samme lenkemønster som journalist-oversikten allerede bruker) når
   nettopp denne feilen oppstår — tom liste for alle andre feil.
5. Ny oversettelsesnøkkel
   `journalist.request_form.blocking_requests_heading` (nb-NO/en-GB).

**Bevisst utelatt**: `publishRequest()` sin egen, moderator-vendte
re-sjekk av samme grense (`moderation/requests.ts`, dokumentert som et
TOCTOU-lukkende dobbeltsjekk mellom submit og faktisk godkjenning) fikk
IKKE samme utvidelse — 9.2s tekst gjelder eksplisitt journalistens
INNSENDING, og re-sjekken ved publisering er et sjeldent race-vindu vist
til MODERATOREN, ikke journalisten, en annen aktør enn den spec-teksten
sikter til.

**Nye tester**: to nye komponenttester i en ny
`RequestEditForm.test.tsx` (fantes ikke fra før) — bekrefter at
lenkene til de blokkerende forespørslene vises med riktig `href` ved
nettopp denne feilen, og at listen IKKE vises for andre feil. To
eksisterende integrasjonstester i `requests.integration.test.ts`
(FR-029s grense, og "landets egen grense, ikke hardkodet 5") oppdatert
til å faktisk asserte på `blockingRequests`-listens innhold (id-ene
matcher de sådde publiserte forespørslene, sortert for å unngå en
skjør rekkefølge-antagelse — spørringen har ingen `ORDER BY`).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 87 filer, 479 tester (477 + 2 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 534 nøkler (533 + 1 ny).
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod (inkludert de to oppdaterte FR-029-testene, som
  nå faktisk verifiserer selve listen, ikke bare feilkoden).

Committet: `src/lib/requests/requests.ts`,
`src/lib/requests/requests.integration.test.ts`,
`src/app/api/requests/[id]/submit/route.ts`,
`src/app/[locale]/journalist/requests/[id]/RequestEditForm.tsx`,
`src/app/[locale]/journalist/requests/[id]/RequestEditForm.module.css`,
`src/app/[locale]/journalist/requests/[id]/RequestEditForm.test.tsx`
(ny fil), `src/i18n/messages/nb-NO.json`, `src/i18n/messages/en-GB.json`.

### Neste økt

Fortsett den fornyede SPEC-V1.md-gjennomgangen fra der denne økten
sluttet: seksjon 10 (Daglig utsendelse — sannsynligvis ren kvittering
gitt hvor mye arbeid som nettopp er lagt ned der i Økt 85-87, men verdt
å bekrefte), deretter 11 (Forespørselsside), 12 (Svar), 13
(Journalistens svarinnboks), 14 (Videre kontakt), 15 (E-postmaler,
også trolig ren kvittering), 16 (Administrasjonsgrensesnitt), 17
(Personvern — verdt ekstra grundighet, retensjonsjobben sletter/
anonymiserer persondata), 18 (Sikkerhet). Seksjon 19-23 (datamodell,
API, ikke-funksjonelle/funksjonelle krav, akseptansekriterier) er
allerede dekket av tidligere, dedikerte sveiper (se økt-historikken) og
trenger ikke gjentas fra bunnen av, men en rask stikkprøve etter
seksjon 18 kan være verdt det uansett siden det er lenge siden sist.
Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 89: fant og rettet et arkitektonisk hull i FR-012/21.3 sin
oversettelseskontroll — enkelte nøkler har IKKE lov til å falle tilbake

Fortsatte den fornyede SPEC-V1.md-gjennomgangen fra Økt 88, seksjon
11-14 denne økten (Forespørselsside, Svar, Journalistens svarinnboks,
Videre kontakt).

### Kvitteringer, ingen handling

- 11: `canRespond = request.status === "published"` — svarknapp vises
  KUN for `published`, med egne varsler for `closed`/`expired`, akkurat
  som spec-en krever. Journalistens e-postadresse er aldri en del av
  siden sine props/rendring.
- 12.4: `withdrawResponse()` kansellerer pending kontaktforespørsler og
  fjerner koblingen, ingen varsling til journalisten — stemmer med
  "Journalisten varsles ikke særskilt."
- 12.6: prioriteringsrekkefølgen for utledet status
  (`not_selected > contact_requested > viewed > submitted`) i
  `responses.ts` stemmer EKSAKT med spec-eksempelet ("et sett OG ikke
  valgt svar viser «ikke valgt»").
- 12.3: alle 7 punktene i bekreftelsesskjermen er til stede i
  `ResponseForm.tsx` (`confirm_journalist`, `sharing_email`/
  `sharing_none`, `may_be_quoted`, `confirm_no_guarantee`,
  `journalist_responsibility`, `platform_verification`,
  `no_withdrawal_from_journalist`), krever et eksplisitt knappetrykk
  (ingen forhåndsavkryssing/auto-bekreftelse).
- 14.1: meldingsgrensen (1000 tegn) er faktisk håndhevet
  (`MESSAGE_MAX_LENGTH` i `contact-requests.ts`). "Én
  kontaktforespørsel per svar" (FR-043) håndheves av en ekte unik
  indeks, ikke bare en applikasjonssjekk.
- 14.3: `suspendUser()` kansellerer journalistens pending
  kontaktforespørsler ved suspendering — stemmer med
  `cancelled (journalisten suspenderes)`.

### Reelt funn: 12.3 sin "faller ikke tilbake til et annet språk"-regel
var ALDRI faktisk håndhevet noe sted

12.3 sier eksplisitt om bekreftelsesskjermens tekst: "Denne teksten er
juridisk relevant og skal gjennomgås av jurist i hvert språk den
tilbys på. Den faller ikke tilbake til et annet språk – mangler den,
kan ikke locale-en tilbys i landet." Dette er et EKSPLISITT unntak fra
21.3s ellers gjeldende regel (manglende oversettelse i et annet språk
= bare en advarsel + 3.4-reservevei) — men INGENTING i koden faktisk
skilte disse nøklene fra alle andre. `check-keys.ts` (FR-012) behandlet
et hull i `response.confirm.*`/`response.form.confirm_*` nøyaktig likt
som et hull i en hvilken som helst annen, juridisk irrelevant UI-streng
— en advarsel, aldri en byggefeil.

**Hvorfor dette ikke er observerbart akkurat nå**: samme grunn som Økt
85 sitt 3.4-funn — v1 har kun to FULLSTENDIG synkroniserte locales
(ingen `check-keys.ts`-advarsler noensinne). Hullet blir ekte den
dagen en ny locale legges til `SUPPORTED_LOCALES` uten at akkurat
disse åtte nøklene er oversatt (og jurist-gjennomgått) — da ville
`createTranslator()` sin NYE, korrekte 3.4-kjede (Økt 85-87) stille
vise plattformens standardspråk for akkurat DENNE juridisk sensitive
teksten, present spec-en eksplisitt forbyr.

**Retting, strukturell fremfor runtime**: i stedet for en
per-land-databasesjekk i `createCountry()`/`updateCountry()` (som ville
kreve å duplisere nøkkellisten inn i en kjøretids-spørring), er
løsningen billigere og strengere plassert der FR-012 allerede lever —
`check-keys.ts`, som allerede kjøres i CI før `next build`:

1. Ny eksportert konstant `LEGALLY_REVIEWED_TRANSLATION_KEYS` i
   `src/i18n/config.ts` — de 8 nøklene som faktisk utgjør 12.3 sin
   tekst (`response.form.confirm_journalist`,
   `response.form.confirm_no_guarantee`,
   `response.confirm.sharing_none/sharing_email/may_be_quoted/
   journalist_responsibility/platform_verification/
   no_withdrawal_from_journalist`).
2. Ny funksjon `findLegallyReviewedGaps()` i `check-keys.ts` — skiller
   ut hvilke av et språks eksisterende 21.3-hull som gjelder nettopp
   disse nøklene.
3. `main()` behandler nå disse to hull-kategoriene ULIKT: en
   juridisk-nøkkel-mangel er en HARD byggefeil (`process.exit(1)`,
   samme alvorlighetsgrad som FR-012s egen hovedsjekk), mens resten av
   21.3s hull fortsatt bare varsler.

Siden `countries.available_locales` (databasen) kun kan velges fra
`SUPPORTED_LOCALES` (håndhevet av `isSupportedLocale()` i
`admin/countries.ts`), garanterer denne byggetids-sjekken STRUKTURELT
at INGEN land noensinne kan tilby en locale der 12.3-teksten mangler —
uten en egen, dupliserende runtime-sjekk per land. Billigere og
strengere enn alternativet.

**Nye tester**: to nye tester for `findLegallyReviewedGaps()` i
`check-keys.test.ts`, samme fikstur-mønster som de eksisterende
`findMissingKeys()`/`findLocaleGaps()`-testene. Kjørte selve scriptet
mot de EKTE meldingsfilene etterpå — ingen endring i utdata (fortsatt
"OK", som forventet siden nb-NO/en-GB er fullstendig synkronisert).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 87 filer, 481 tester (479 + 2 nye).
- `npx tsx src/i18n/check-keys.ts`: OK — 534 nøkler, ingen endring i
  faktisk utdata.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret.

Committet: `src/i18n/config.ts`, `src/i18n/check-keys.ts`,
`src/i18n/check-keys.test.ts`.

### Neste økt

Fortsett den fornyede SPEC-V1.md-gjennomgangen fra der denne økten
sluttet: seksjon 15 (E-postmaler — trolig ren kvittering, mye
nylig arbeid der), 16 (Administrasjonsgrensesnitt), 17 (Personvern —
ekstra grundighet, retensjonsjobben sletter/anonymiserer persondata),
18 (Sikkerhet). Vurder også om DESIGN.md sin 12.3-tilstøtende regel
(om noen finnes) bør sjekkes for samme "juridisk tekst faller ikke
tilbake"-mønster andre steder i spec-en — et fritekstsøk etter
"jurist" i SPEC-V1.md denne økten fant KUN 12.3, så dette er trolig
den eneste forekomsten, men verdt å bekrefte på nytt hvis nye
juridisk-sensitive skjermer legges til senere. Uendret, fortsatt de tre
åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 90: fant og rettet et manglende personvern-opplysningskrav
(17.5) under en fornyet SPEC-V1.md-gjennomgang (seksjon 15-17)

Fortsatte den fornyede SPEC-V1.md-gjennomgangen fra Økt 89, seksjon
15-17 denne økten (E-postmaler, Administrasjonsgrensesnitt, Personvern).

### Kvitteringer, ingen handling

- 15: e-postmaltabellens 24 rader stemmer med `TransactionalTemplate`
  (23 maler) + digesten (1). "Innhold rapportert" sitt eget hull
  (nevnt i selve spec-teksten som historikk) er allerede lukket.
- 16.1/16.2: dashboardet, alle fem admin-funksjonsområdene
  (journalister/forespørsler/mottakere/utsendelser/land), og
  begrunnelseslisten for å åpne et enkeltsvar
  (`user_support_request`/`abuse_report_investigation`/
  `legal_or_regulatory_request`/`security_incident`, i en egen fil
  `response-access-reasons.ts`) er alle allerede bygget og stemmer med
  spec-teksten.
- 17.1-17.4: behandlingsgrunnlag, juridiske dokumenter/samtykkelogg
  (allerede versjonert per land+språk, håndhevet av
  `setCountryStatus()`), brukerrettigheter, og lagringstider
  (konfigurasjon per land, ikke konstanter — verifisert i tidligere
  økter) stemmer alle med koden.
- 17.5 sine øvrige punkter (fremtidige utsendelser stanses, kontoen
  anonymiseres, kontaktforespørsler kanselleres m/varsel, samtykkehistorikk
  beholdes, journalist-sletting lukker forespørsler og varsler
  respondenter) er alle allerede implementert (`performAccountDeletion()`,
  tidligere økters arbeid).

### Reelt funn: 17.5 sitt eksplisitte opplysningskrav på selve
slettebekreftelsen manglet helt

17.5 sier eksplisitt om at svartekst beholdes til ordinær frist etter
kontosletting: "Dette skal stå uttrykkelig i personvernerklæringen OG
PÅ SLETTEBEKREFTELSEN, i hvert språk." Gjennomsøkte hele
slettingsflyten (`DeleteAccountSection.tsx`, steg 1, og
`ConfirmDeletionClient.tsx`, steg 2/"slettebekreftelsen" — siden
brukeren når via lenken i bekreftelses-e-posten) — INGEN av dem nevnte
noensinne at innsendte svar sin tekst beholdes. Kun
personvernerklæringen (et `legalDocuments`-dokument, utenfor denne
gjennomgangens kodesøk) kan ha dekket halvparten av kravet.

**Hvorfor plassering ble steg 2, ikke steg 1**: "slettebekreftelsen"
("Bekreft sletting av kontoen din") er den mest presise, bokstavelige
matchen for selve begrepet, og komponenten trenger ingen ny
sesjons-/rolledata for å vise en generisk, sannferdig tekst (i
motsetning til steg 1, som HAR rollen tilgjengelig via foreldresiden,
men er "be om sletting", ikke "bekreft sletting"). Teksten er
formulert betinget ("Har du sendt inn svar…") slik at den er korrekt
og harmløs å vise uansett rolle, uten å måtte tre `session.role`
gjennom det token-only (ingen økt) steget.

**Retting**: ny nøkkel
`me.confirm_deletion.response_text_retained_notice` (nb-NO/en-GB),
vist som et eget avsnitt rett under advarselen på `/me/slett-konto`,
før bekreft-knappen.

**Ny test**: én ny test i `ConfirmDeletionClient.test.tsx` som
bekrefter at teksten faktisk vises på bekreftelsestrinnet.

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 87 filer, 482 tester (481 + 1 ny).
- `npx tsx src/i18n/check-keys.ts`: OK — 535 nøkler (534 + 1 ny).
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 345
  tester, ALLE bestod uendret.

Committet: `src/app/[locale]/me/slett-konto/ConfirmDeletionClient.tsx`,
`src/app/[locale]/me/slett-konto/ConfirmDeletionClient.test.tsx`,
`src/i18n/messages/nb-NO.json`, `src/i18n/messages/en-GB.json`.

### Neste økt

Fortsett den fornyede SPEC-V1.md-gjennomgangen fra der denne økten
sluttet: seksjon 18 (Sikkerhet — siste gjenværende seksjon før 19-23,
som allerede har dedikerte, tidligere sveiper). Etter seksjon 18 er
hele spec-en dermed gjennomgått på nytt fra bunnen av denne natten
(Økt 88-9x) — vurder da enten (a) et helt nytt spor (f.eks. en fornyet
"ubrukte eksporter"-kjøring, gitt at mange filer er endret siden sist,
eller (b) INFRASTRUCTURE.md/DESIGN.md sin egen fornyede gjennomgang,
som ikke har vært gjort fra bunnen av på like lenge som SPEC-V1.md nå
har fått. Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 91: fant og rettet en reell rategrense-omgåelse på et offentlig,
uautentisert endepunkt — fullførte dermed hele SPEC-V1.md-gjennomgangen

Fortsatte den fornyede SPEC-V1.md-gjennomgangen fra Økt 90, seksjon 18
denne økten (Sikkerhet) — SISTE gjenværende seksjon, siden 19-23 allerede
har egne, tidligere dedikerte sveiper (se økt-historikken).

### Kvitteringer, ingen handling

- HTTPS/HSTS, RBAC håndhevet i backend, CSRF, parametriserte spørringer
  (Drizzle ORM), output-escaping (React), CSP — alle allerede bekreftet i
  tidligere økter.
- `svarinnsendinger` (10/time) og `forespørselsopprettelser` (20/døgn) sine
  EKSAKTE tall stemmer med spec-en (`RESPONSE_RATE_LIMIT_MAX`/
  `CREATE_DRAFT_RATE_LIMIT_MAX` i sine respektive filer).
- Tokens lagres hashet, ingen personopplysninger i URL-er (alle
  token-baserte lenker bruker opake tokens, aldri e-postadresser i
  spørrestrengen).
- Revisjonslogg på administrative handlinger og all deling av
  kontaktopplysninger (FR-050, verifisert i tidligere økter).
- 18.2 (sensitive, irreversible handlinger krever et eksplisitt
  knappetrykk, aldri automatisk ved sidelasting) — allerede fikset
  (task #58), og spec-referansen til en ikke-eksisterende "24.3" allerede
  korrigert i en tidligere natt.
- 18.1 (hvem kan lese et svar) — uendret, fortsatt en av de tre stående
  åpne spørsmålene (motsigelse mot 16.2/FR-051), ikke noe nytt å legge
  til denne økten.

### Reelt funn: rategrensen for innloggingslenker gjaldt kun EKSISTERENDE
kontoer, ikke "per adresse" slik spec-en faktisk sier

18 sier eksplisitt: "5 innloggingsforespørsler per **adresse** per 15
min." `requestMagicLink()` i `src/lib/auth/magic-link.ts` slo derimot
opp brukeren FØRST, og returnerte umiddelbart (linje 37, `if (!user)
return`) for en IKKE-eksisterende adresse — FØR `checkRateLimit()`
noensinne ble kalt. Konsekvens: en angriper kunne sende et UBEGRENSET
antall forespørsler mot `POST /api/auth/request-link` (offentlig,
uautentisert) med en oppdiktet adresse, uten å treffe noen grense i det
hele tatt — hver forespørsel utløste fortsatt et ekte, indeksert
databaseoppslag. Dette er den mest alvorlige typen funn denne natten:
en REELT utnyttbar sikkerhetssvakhet i DAG (ikke et dormant hull som
først blir synlig med en fremtidig andre locale/land, slik flere
tidligere økters funn har vært), på et offentlig endepunkt.

**Retting**: flyttet `checkRateLimit()`-kallet til FØR
brukeroppslaget, og byttet bucket-nøkkelen fra `magic-link:${user.id}`
til `magic-link:${email}` — den rå adressen, tilgjengelig uansett om
kontoen finnes. Dette er også en mer presis match for spec-teksten
("per adresse", ikke "per konto"). Ingen endring i den ellers
eksisterende, atomisk-sikrede `checkRateLimit()`-implementasjonen
(task #42) — bare kallstedet og nøkkelen.

**Ny test**: siden verken et token eller en e-post noensinne sendes
for en ikke-eksisterende adresse (uansett om rategrensen faktisk
håndheves), måtte selve `rate_limit_hits`-tabellen inspiseres direkte
for å bevise at grensen registreres — seks kall mot samme oppdiktede
adresse gir nøyaktig 5 rader i tabellen (den sjette avvises uten å
legge til en ny rad, samme etablerte "ikke straff en allerede avvist
forespørsel enda hardere"-oppførsel som `checkRateLimit()` sin egen
kommentar beskriver).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 87 filer, 482 tester, alle bestod uendret (denne
  rettingen berører kun en integrasjonstestet funksjon).
- `npx tsx src/i18n/check-keys.ts`: OK — 535 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 346
  tester (345 + 1 ny), ALLE bestod — inkludert alle 16 eksisterende
  `magic-link.integration.test.ts`-testene, uendret av
  nøkkelbyttet (de bruker alle en KONSISTENT e-post per test, så
  bucket-nøkkelens form endrer ikke observerbar oppførsel for dem).

Committet: `src/lib/auth/magic-link.ts`,
`src/lib/auth/magic-link.integration.test.ts`.

### Neste økt

Hele SPEC-V1.md er nå gjennomgått på nytt fra bunnen av, seksjon for
seksjon (Økt 88-91: 9, 11-14, 15-17, 18 — seksjon 10 var allerede
dekket av Økt 85-87 sitt arbeid samme natt, og 19-23 av enda tidligere,
dedikerte sveiper). Sjekket ALLEREDE, samme økt, spor 1 sitt eget
forslag under (billig, direkte oppfølging): `submitResponse()`
(responses.ts) og `createDraft()` (requests.ts), de to andre stedene
spec-en eksplisitt nevner en rategrense. Ingen av dem deler samme
bugklasse — begge tar imot en ALLEREDE sesjons-verifisert bruker-ID som
parameter (aldri en rå, angriper-oppgitt streng slik
`requestMagicLink()` sin e-postadresse var), så rolle-/status-sjekken
FØR rategrensen i begge er en re-verifisering av en ekte konto, ikke et
tidlig-return-hull. `POST /subscribe`/`POST /journalists/apply` har for
øvrig INGEN rate limiting — men spec-en (18) lister eksplisitt bare de
tre nevnte grensene, så dette er IKKE et hull mellom spec og kode, bare
en mulig fremtidig spec-utvidelse å vurdere i dagslys. Et friskt spor
for neste økt, i prioritert rekkefølge:
1. En fornyet "ubrukte eksporter"-kjøring (mange filer endret siden
   forrige kjøring i Økt 83-85).
2. Deretter, en fornyet INFRASTRUCTURE.md/DESIGN.md-gjennomgang fra
   bunnen av, som ikke har vært gjort like nylig som SPEC-V1.md nå har.
Uendret, fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.

## Økt 92: fant og rettet en reell idempotens-svikt i e-post-webhooken —
en gjentatt bounce-levering kunne trigge for tidlig suspensjon

Fulgte opp Økt 91 sitt spor: kjørte "ubrukte eksporter"-grepet på nytt
først (samme metode som Økt 83-85) — null nye treff, som forventet
(bekrefter metoden fortsatt er uttømt). Gikk deretter i gang med en
fornyet INFRASTRUCTURE.md-gjennomgang fra bunnen av, seksjon 1-8 denne
økten.

### Kvitteringer, ingen handling

- Seksjon 1-5: to-stadier-arkitekturen, komponentvalgene, databasen
  (unik indeks på `(country_code, local_date)` for digest, ingen
  destruktive migrasjoner), og jobbtabellen (7 jobber, alle stemmer
  eksakt med `tick.ts`/`retention.ts` sine faktiske eksporterte
  funksjoner — verifisert på nytt etter task #29 sin tidligere retting).
- 6.3 (domener/SPF/DKIM/DMARC), 7-8 (miljøer, utrulling,
  helsesjekk-rettingen fra en tidligere natt) — alt stemmer, ingen
  kodenivå å verifisere utover det som allerede er sjekket.

### Reelt funn: 6.4 sitt idempotens-løfte var ALDRI faktisk innfridd

6.4 sier eksplisitt: "Endepunktet er idempotent på leverandørens
meldings-ID. Webhooks leveres mer enn én gang." Gjennomgikk
`processEmailEvent()` (`src/lib/subscriptions/email-events.ts`) linje
for linje og fant at INGENTING i funksjonen faktisk håndhevet dette.
`soft_bounce`-grenen gjør en atomisk `+1` PÅ `consecutiveSoftBounces`
UBETINGET, uten noen sjekk mot om akkurat denne leveransen allerede er
behandlet. Siden 6.4 selv sier webhooks LEVERES MER ENN ÉN GANG (en
normal, forventet leverandøroppførsel, ikke en sjelden feilsituasjon),
ville en dobbelt levering av ÉN reell myk-bounce-hendelse økt telleren
til 2 — og en tredje, faktisk ULIK hendelse ville da feilaktig utløst
10.3 sin "tre myke bounces PÅ RAD"-eskalering til hard bounce (adressen
sperres permanent) etter bare TO reelle bounces.

De øvrige tre hendelsestypene (`delivered`, `hard_bounce`, `complaint`)
er alle idempotente AV NATUR (rene `SET`-operasjoner, ikke
inkrementer — å sette samme status to ganger er harmløst), og
`updateDigestDeliveryStatus()` likeens. `soft_bounce` sin
tellerøkning var det ENESTE stedet i hele funksjonen som faktisk
krevde en eksplisitt idempotens-sperre for å stemme med 6.4s løfte.

**Retting**: ny tabell `processed_email_webhook_events` (SPEC-V1.md
19.17, ny seksjon lagt til FØR koden — spec først, deretter koden, se
README.md/INFRASTRUCTURE.md 16.8 sitt eget prinsipp), med en unik
indeks på `(provider_message_id, event)`. `processEmailEvent()` forsøker
nå å sette inn dette paret FØRST (`ON CONFLICT DO NOTHING`); lykkes ikke
innsettingen (paret finnes fra før), hoppes ALLE side-effekter over og
funksjonen returnerer tidlig. Samme melding kan fortsatt få FLERE ULIKE
hendelsestyper over tid (f.eks. `delivered` etterfulgt av en senere
`complaint`) — disse behandles fortsatt som separate, ekte hendelser,
ikke duplikater av hverandre.

**Kjent, eksplisitt dokumentert gjenværende begrensning**: bare mulig
når leverandøren faktisk oppgir en meldings-ID — webhook-ruten sin egen,
tidligere kommentar bekrefter at enkelte hendelsestyper kan mangle den.
For de sjeldne tilfellene uten en ID, er endepunktet fortsatt IKKE
idempotent — samme begrensning som før denne rettingen, ikke noe verre.

**Ny migrasjon**: `0010_charming_gideon.sql`
(`npx drizzle-kit generate`), kjørt mot testdatabasen
(`npm run db:migrate`).

**Nye tester**: tre nye i `email-events.integration.test.ts` — (1) tre
GJENTATTE leveringer av samme `soft_bounce`-hendelse (samme
`providerMessageId`) øker telleren KUN til 1, eskalerer ikke; (2) to
ULIKE hendelsestyper for samme meldings-ID (`delivered` så `complaint`)
behandles begge som ekte, separate hendelser; (3) uten en
`providerMessageId` telles hver levering fortsatt for seg (dokumenterer
den bevisste, gjenværende begrensningen eksplisitt, ikke en
regresjonstest for noe uønsket).

### Verifisert før commit

- `npx tsc --noEmit`: ingen feil.
- `npx eslint .`: ingen feil.
- `npx vitest run`: 87 filer, 482 tester, alle bestod uendret (denne
  rettingen berører kun integrasjonstestet kode).
- `npx tsx src/i18n/check-keys.ts`: OK — 535 nøkler.
- `npx tsx src/styles/check-tokens.ts`: OK — 55 filer, ingen brudd.
- `npx next build`: bygget uten feil.
- `npx vitest run -c vitest.integration.config.ts`: 33 filer, 349
  tester (346 + 3 nye), ALLE bestod — inkludert alle 11 eksisterende
  `email-events.integration.test.ts`-testene, uendret av rettingen.

Committet: `SPEC-V1.md`, `src/db/schema.ts`,
`src/db/migrations/0010_charming_gideon.sql`,
`src/db/migrations/meta/*`, `src/lib/subscriptions/email-events.ts`,
`src/lib/subscriptions/email-events.integration.test.ts`.

### Neste økt

Fortsett den fornyede INFRASTRUCTURE.md-gjennomgangen fra der denne
økten sluttet: seksjon 9-16 (Hemmeligheter, Overvåking, Sikkerhetskopi/
gjenoppretting, Sikkerhet i infrastrukturen, Kostnad, Hva som ryker
først, Åpne beslutninger, og Stadium 0-oppsettet i 16 — sistnevnte er
det FAKTISKE, kjørende oppsettet i denne kodebasen akkurat nå, så verdt
ekstra grundighet siden det er der virkeligheten faktisk er). Deretter,
en tilsvarende fornyet DESIGN.md-gjennomgang fra bunnen av. Uendret,
fortsatt de tre åpne spørsmålene:
(a) bør `runExpireRequests()` også sende `response_request_closed` til
respondenter;
(b) SPEC-V1.md 18.1 vs. 16.2/FR-051 sin motsigelse om hvem som kan lese
et svars innhold (moderator inkludert eller ikke);
(c) Brevo sin faktiske webhook-signaturstøtte (HMAC vs. delt
hemmelighet) — verifiseres mot en ekte Brevo-konto, ikke noe å gjette
seg til i kode.
