# Kildebanken

Arbeidstittel — skal ikke bygges inn i arkitekturen (`SPEC-V1.md` 2).

Plattform for journalistforespørsler og ekspertkilder. Kobler journalister
som trenger kilder med privatpersoner og fagpersoner med relevant kunnskap
eller erfaring.

## Dokumentasjon

Les disse i denne rekkefølgen før du endrer kode:

1. **`SPEC-V1.md`** — produktspesifikasjon. Datamodell, funksjonelle krav,
   akseptansekriterier. Kildekoden skal reflektere dette dokumentet, ikke
   omvendt.
2. **`DESIGN.md`** — designsystem. Tokens, komponentprinsipper, e-postmaler.
3. **`INFRASTRUCTURE.md`** — kjøretidsmiljø og drift. Spesielt 16 (dagens
   gratisoppsett) og 16.8 (portabilitetsreglene — les denne før du legger til
   noe vertsspesifikt).
4. **`NATTLOGG.md`** — løpende logg over autonomt arbeid: hva som er gjort,
   hvilke antagelser som er tatt, og hva som gjenstår.

## Oppsett

```bash
npm install
cp .env.example .env.local   # fyll inn DATABASE_URL lokalt
npm run db:generate          # genererer SQL fra src/db/schema.ts
npm run db:migrate           # kjører migrasjoner mot DATABASE_URL
npm run db:seed              # seeder landkonfigurasjon (Norge, draft)
npm run dev
```

## Arkitekturprinsipper (ikke bare kodekonvensjoner)

- **Portabilitet er en handhevet regel, ikke en intensjon.** Se
  `INFRASTRUCTURE.md` 16.8. Jobblogikk (`src/lib/jobs/tick.ts`) vet
  ingenting om Netlify — `netlify/functions/tick.ts` er en tynn adapter.
  Samme mønster skal følges for alt som er vertsspesifikt.
- **Datamodellen i `src/db/schema.ts` er en oversettelse, ikke et forslag.**
  Avvik fra `SPEC-V1.md` 19 er en feil i koden. Endre spec-en først.
- **Ingen brukervendt streng i kildekoden.** Alt går via
  `src/i18n/get-messages.ts` og nøklene i `src/i18n/messages/*.json`. CI skal
  kjøre `npm run i18n:check` (FR-012) før bygg.
- **Ingen komponentfil refererer til `tokens/primitives.css` direkte** — bare
  `tokens/semantic.css` (DESIGN.md 1). Håndhevet av
  `npm run design:check-tokens` (`src/styles/check-tokens.ts`).

## Verifisering

Kjør alle disse før du committer — se `NATTLOGG.md` for hvorfor hver av
dem finnes:

```bash
npx tsc --noEmit
npx eslint .
npx vitest run
npx tsx src/i18n/check-keys.ts
npx tsx src/styles/check-tokens.ts
npx next build
```

`npm run test:integration` krever en ekte, disponibel Postgres
(`DATABASE_URL`) og kjøres separat — se `vitest.integration.config.ts`.

Kjøres automatisk i CI (`.github/workflows/ci.yml`) på hver push og PR —
inkludert integrasjonstestene, mot en midlertidig Postgres 16-service-
container (ingen hemmeligheter involvert, bare et engangspassord for en
kortlevd container som forsvinner når jobben er ferdig).

## Status

Dette er et tidlig, autonomt generert skjelett (Fase 1 i
`SPEC-V1.md` 24), ikke en ferdig applikasjon. Se `NATTLOGG.md` for hva som
faktisk er verifisert til å kjøre versus det som bare er skrevet.
