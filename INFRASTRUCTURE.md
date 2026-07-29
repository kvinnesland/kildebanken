# Infrastruktur

Supplement til `SPEC-V1.md`. Gjelder kjøretidsmiljø, drift og leverandørvalg.

---

## 1. Utgangspunkt

Tjenesten er liten. `SPEC-V1.md` 21.1 dimensjonerer for 50 samtidige økter og
10 000 mottakere per land. Det er én maskin med god margin.

Infrastrukturvalgene her styres derfor ikke av skala, men av tre andre ting:

1. **EØS-lagring er skrevet inn i spesifikasjonen** (3.3) som en port for å
   åpne et land. Det begrenser leverandørvalget reelt.
2. **E-postlevering er produktets flaskehals.** Kommer ikke digesten frem kl.
   07.00, finnes ikke tjenesten. Dette er den ene komponenten det er verdt å
   betale for.
3. **Driftsbyrde er en reell kostnad** i et lite team. Hver komponent vi legger
   til, må vi også oppgradere, sikkerhetskopiere og feilsøke kl. 03.00.

Den viktigste beslutningen i dette dokumentet er derfor hvor mange bevegelige
deler vi *ikke* har.

---

## 2. Kjøretidsarkitektur

```
                    ┌──────────────────────────────┐
   Nettleser ──────▶│  Next.js  (SSR + API)        │
                    │  1–2 instanser               │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │  PostgreSQL 16               │
                    │  data + jobbkø + rate limit  │
                    └──────────▲───────────────────┘
                               │
                    ┌──────────┴───────────────────┐
                    │  Worker (pg-boss)            │
                    │  digest · retensjon · varsler│
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
   E-post   ◀───────│  E-postleverandør            │
   Webhooks ───────▶│  transaksjonell + bulk       │
                    └──────────────────────────────┘
```

Fire komponenter. Ingen Redis, ingen objektlagring, ingen søketjeneste, ingen
meldingsbuss, ingen container-orkestrering.

---

## 3. Komponentvalg

| Komponent | Valg | Begrunnelse |
|---|---|---|
| Språk | TypeScript | Ett språk i hele stakken. Delte typer mellom klient og API. |
| Rammeverk | Next.js (App Router) | SSR kreves for offentlige forespørselssider med locale-ruting, `hreflang` og Open Graph. Route handlers dekker API-behovet uten en egen backend. |
| Database | PostgreSQL 16 | Relasjonell modell, transaksjoner, `jsonb` for `AuditLog.metadata`, og god nok tekstsøking hvis vi trenger det senere. |
| Jobbkø og cron | pg-boss, i samme Postgres | Se 5. |
| ORM / migrasjoner | Drizzle eller Prisma | Versjonerte migrasjoner i repoet er kravet; valget mellom dem er teamsmak. |
| Applikasjonsvert | Hetzner Cloud, Falkenstein eller Helsinki | Tysk selskap, EØS-lokasjon, lav kostnad. |
| Deploy-lag | Coolify på egen VM | Git-basert deploy, rullende omstart, TLS, uten å drive Kubernetes. |
| Database-vert | Aiven for PostgreSQL, EØS-region | Finsk selskap. Administrerte sikkerhetskopier med PITR. Se 4. |
| E-post | Se 6 – krever en beslutning | |
| Feilrapportering | Sentry, EU-region | Har eksplisitt EU-datalagring. |
| Oppetidsovervåking | Better Stack eller selvhostet Uptime Kuma | |
| DNS | Europeisk registrar, f.eks. Domeneshop eller Gandi | |
| Kildekode og CI | GitHub + GitHub Actions | Amerikansk, men behandler kildekode – ikke personopplysninger. |

### 3.1 Fravalgt, med begrunnelse

**Kubernetes.** Løser problemer vi ikke har, og innfører en driftsflate større
enn applikasjonen.

**Vercel.** Utmerket for Next.js, men serverløse funksjoner passer dårlig for en
digest-jobb, og databehandleravtalen med en amerikansk leverandør er en
diskusjon vi slipper ved å velge europeisk.

**Redis.** Ville vært en femte komponent med egen persistering, egne
sikkerhetskopier og egen oppgraderingssyklus – for en jobbkø som ved dette
volumet håndteres bedre i databasen vi allerede har. Se 5.

**Objektlagring.** Ikke nødvendig. Vedlegg og profilbilder er kuttet
(`SPEC-V1.md` 25, punkt 7), og det er det som gjør dette valget mulig.
Kommer vedlegg tilbake, kommer denne komponenten tilbake med dem.

**Cloudflare foran applikasjonen.** Proxying betyr TLS-terminering utenfor EØS.
Ved vårt trafikkvolum gir det ingen målbar gevinst mot en kostnad i
personvernhistorien. Vurderes på nytt hvis vi får et DDoS-problem.

**Selvdriftet Postgres.** Fristende for kostnaden, men sikkerhetskopiering og
punktgjenoppretting er det siste stedet et lite team bør spare penger.

---

## 4. Database

- PostgreSQL 16, administrert, i EØS-region.
- Daglig sikkerhetskopi med punktgjenoppretting minst 7 dager tilbake.
- Kryptering i hvile og TLS på tilkobling.
- Migrasjoner er versjonerte filer i repoet og kjøres som eget steg i deploy,
  aldri automatisk ved applikasjonsoppstart.
- Ingen destruktive migrasjoner i ett steg. Kolonner fjernes i en senere
  utrulling enn koden som slutter å bruke dem.
- Tilkoblingspooling i applikasjonen. Ett tilkoblingsbudsjett per instanstype.

### 4.1 Skjemadetaljer som infrastrukturen avhenger av

- Unik indeks på `(country_code, local_date)` for digest, slik at en dobbel
  jobbkjøring ikke kan sende to digester samme dag. Se 5.2.
- `AuditLog` og `DigestDelivery` vokser monotont. Begge partisjoneres eller
  arkiveres når retensjonsjobben begynner å ta merkbar tid.

---

## 5. Jobbkø og planlegging

**pg-boss i samme Postgres-instans.** Køen får da transaksjonell garanti sammen
med forretningsdataene: en jobb som skriver en rad og planlegger en oppfølging,
gjør begge deler eller ingen av delene. Det er ikke mulig med en separat Redis
uten distribuert transaksjonshåndtering vi ikke vil skrive.

Jobber i v1:

| Jobb | Frekvens | Oppgave |
|---|---|---|
| `digest-tick` | Hvert 15. minutt | Se 5.2 |
| `expire-requests` | Hvert 15. minutt | `published → expired` ved passert frist (FR-026) |
| `expire-contact-requests` | Daglig | 14-dagersregelen (FR-046) |
| `retention` | Daglig | Sletting og anonymisering etter `SPEC-V1.md` 17.4 |
| `deadline-reminder` | Hver time | Varsel 24 t før frist |
| `purge-unverified` | Daglig | Ubekreftede kontoer eldre enn 14 dager (FR-004) |

### 5.2 Utsendelse per land og sommertid

Landene har hver sin tidssone og hvert sitt utsendelsestidspunkt
(`SPEC-V1.md` 19.1). Det kan ikke løses med en cron-linje i UTC – `07:00
Europe/Oslo` er `06:00 UTC` om vinteren og `05:00 UTC` om sommeren, og en
hardkodet UTC-tid ville sendt digesten en time feil halve året.

Løsningen er en tikkejobb som spør, i stedet for en tidsplan som antar:

```
Hvert 15. minutt:
  for hvert land med status = active:
      lokal_tid  = nå i landets tidssone
      lokal_dato = dato i landets tidssone
      hvis lokal_tid >= digest_send_time
         og ingen Digest finnes for (land, lokal_dato):
             sett i kø: send-digest(land, lokal_dato)
```

Unikhetsbetingelsen ligger i databasen, ikke i jobblogikken. To samtidige
tikk kan derfor ikke gi to digester, og en jobb som feiler halvveis, kan kjøres
på nytt uten å sende dobbelt.

Feiler ett land, går de andre videre (FR-036). Én jobb per land, ikke én global.

---

## 6. E-post

Dette er den ene komponenten som fortjener å koste penger, og den eneste der
EØS-kravet står i reell spenning med kvalitet.

### 6.1 Krav

- Atskilte strømmer for transaksjonell e-post og bulk, slik at en klage på
  digesten ikke ødelegger leveringen av innloggingslenker.
- Webhooks for bounce og spam-klage, med signaturverifisering.
- Egendefinert avsenderdomene med DKIM.
- Målbar leveringsgrad per strøm.
- Databehandleravtale.

### 6.2 Alternativene

| Leverandør | Hjemland | Vurdering |
|---|---|---|
| **Postmark** | USA (ActiveCampaign) | Best leveringsgrad i klassen. Message Streams skiller strømmene rent. EU-datalagring tilgjengelig. |
| **Brevo** | Frankrike | EØS-selskap, dekker både transaksjonelt og bulk. Leveringsgraden er god, ikke fremragende. |
| **Mailjet** | Frankrike | Som Brevo. EØS-lagring som standard. |
| **Scaleway TEM** | Frankrike | Enklest juridisk. Umodent på bulk og analyse. |

**Anbefaling: Brevo eller Mailjet.** Begrunnelsen er ikke teknisk – Postmark er
det bedre produktet – men produktmessig. Tjenestens verdiforslag er at
privatpersoner kan stole på den med opplysninger om seg selv. «All behandling
skjer i EØS, uten unntak» er en setning vi kan stå ved i personvernerklæringen
og i markedsføringen, og den mister verdi hvis den har en fotnote.

Ved store leveringsproblemer i produksjon er det en beslutning å ta opp igjen,
med åpne øyne.

### 6.3 Domener

```
tjenesten.no              nettsted
epost.tjenesten.no        bulk – daglig digest
tjenesten.no              transaksjonelt – innlogging, varsler
```

SPF, DKIM og DMARC på begge avsenderdomener. DMARC starter på `p=none` med
rapportering, og strammes til `p=quarantine` når rapportene er rene.

Oppvarming: den daglige digesten starter på et lite volum og økes gradvis. Med
null brukere ved lansering skjer oppvarmingen naturlig, forutsatt at vi ikke
importerer en liste.

**Ett avsenderdomene for alle land** (`SPEC-V1.md` 10.4). Omdømme bygges per
domene; å splitte per marked betyr å bygge det på nytt hver gang.

### 6.4 Webhooks

- Signatur verifiseres før innholdet leses.
- Endepunktet er idempotent på leverandørens meldings-ID. Webhooks leveres mer
  enn én gang.
- Kvitterer raskt, behandler i kø. En treg webhook gir leverandøren grunn til å
  slutte å sende.
- Ukjente hendelsestyper logges og ignoreres uten feil.

---

## 7. Miljøer

| Miljø | Vert | Data |
|---|---|---|
| Lokalt | Docker Compose | Syntetiske testdata |
| Test | Egen liten VM + egen database | **Kun syntetiske data** |
| Produksjon | Egen VM + administrert database | Ekte data |

**Produksjonsdata kopieres aldri til test eller lokalt.** Ikke anonymisert
heller – anonymisering av fritekstsvar er ikke pålitelig, og et svar kan
identifisere en person gjennom innholdet alene. Testdata genereres med seed-
skript som ligger i repoet.

Trenger vi å feilsøke en produksjonsfeil på ekte data, gjøres det i produksjon
med logget tilgang, ikke ved å flytte dataene ut.

Testmiljøet bruker leverandørens sandkassemodus for e-post og har `noindex` på
alt.

---

## 8. Utrulling

- Push til `main` → GitHub Actions bygger container → deploy til test →
  automatiske tester → manuell godkjenning → produksjon.
- Migrasjoner kjøres som eget steg før ny kode starter.
- Rullende omstart. Gammel instans avvikles først når den nye svarer på
  helsesjekk.
- Worker rulles etter web, slik at en jobb ikke plukkes opp av kode som er
  eldre enn skjemaet.
- Tilbakerulling er å rulle ut forrige image. Databasemigrasjoner rulles ikke
  tilbake – de skrives forovervennlige.

### 8.1 Helsesjekk

`/health` svarer på databasetilkobling, køtilkobling og migrasjonsversjon.
Brukes av deploy-laget og oppetidsovervåkingen.

---

## 9. Hemmeligheter

- Aldri i repoet. `.env.example` inneholder navn, aldri verdier.
- Produksjonshemmeligheter i deploy-lagets krypterte lagring.
- Nøkler roteres ved eierskifte i teamet.
- Hemmeligheter skrives aldri til logg. Loggredaktør på kjente nøkkelnavn.
- Applikasjonen har én databasebruker uten superbrukerrettigheter.

---

## 10. Overvåking

| Signal | Terskel | Handling |
|---|---|---|
| Applikasjonen svarer ikke | 2 påfølgende feil | Varsel umiddelbart |
| Digest ikke sendt innen 60 min etter planlagt tid | Per land | Varsel umiddelbart |
| Andel feilede leveranser i en digest | > 5 % | Varsel |
| Spam-klagerate | > 0,1 % | Varsel. Over 0,3 % er kritisk – Gmail og Outlook begynner å avvise. |
| Hard bounce-rate | > 2 % | Varsel |
| Jobb feilet etter alle forsøk | Enhver | Varsel |
| Feilrate i applikasjonen | > 1 % av forespørsler | Varsel |
| Diskbruk database | > 80 % | Varsel |
| Sertifikat utløper | < 14 dager | Varsel |

Leveringsgrad og klagerate følges **per land** (`SPEC-V1.md` 10.4) – ett
marked kan ødelegge omdømmet for alle.

Logger struktureres som JSON med korrelasjons-ID. Personopplysninger logges
ikke: ingen e-postadresser, ingen svartekst. Bruker-ID er greit.
Loggretensjon settes til seks måneder for å matche `SPEC-V1.md` 17.4.

---

## 11. Sikkerhetskopi og gjenoppretting

- Administrerte sikkerhetskopier med punktgjenoppretting, minst 7 dager.
- Ukentlig logisk dump til separat EØS-lagring, kryptert, oppbevart i 90 dager.
  Dette dekker det administrerte oppsettet ikke gjør: at leverandøren selv
  faller bort.
- **Gjenoppretting testes før lansering**, ikke bare konfigureres. En utestet
  sikkerhetskopi er en antagelse.
- RPO 24 timer, RTO 8 timer (`SPEC-V1.md` 18).
- Gjenopprettingsrutinen er skrevet ned og kan følges av én person alene.

---

## 12. Sikkerhet i infrastrukturen

- Databasen er ikke eksponert mot internett. Kun applikasjonen når den.
- SSH med nøkkel, ingen passord, ingen root-innlogging.
- Automatiske sikkerhetsoppdateringer på operativsystemet.
- Ukentlig avhengighetsskanning. CI feiler på kjente kritiske sårbarheter.
- Rate limiting lagres i Postgres, ikke i minnet per instans – ellers er grensen
  i `SPEC-V1.md` 18 ganget med antall instanser.
- HSTS, CSP uten `unsafe-inline`, `X-Content-Type-Options`, `Referrer-Policy:
  strict-origin-when-cross-origin`.
- Ingen tredjepartsskript. Fontene selvhostes (`DESIGN.md` 3).

---

## 13. Kostnad

Estimat ved lansering, ett land:

| Post | Per måned |
|---|---|
| Applikasjonsserver (Hetzner CPX21) | ~8 € |
| Testserver (Hetzner CX22) | ~4 € |
| Administrert PostgreSQL, minste plan med PITR | 25–70 € |
| E-post, inntil ~20 000 sendinger | 0–25 € |
| Sikkerhetskopilagring | ~4 € |
| Sentry, EU-region | 0–26 € |
| Oppetidsovervåking | 0–8 € |
| Domene og DNS | ~2 € |
| **Sum** | **45–150 €** |

Databasen er den største enkeltposten, og den vi bevisst ikke sparer på.

Et land nummer to koster i praksis ingenting i infrastruktur – det er
konfigurasjon (`SPEC-V1.md` 3.3). Kostnaden ligger i juridisk gjennomgang,
oversettelse og moderering.

---

## 14. Hva som ryker først

I rekkefølge, når tjenesten vokser:

1. **E-postomdømmet**, hvis listehygienen glipper. Kommer før alt annet, og er
   det vanskeligste å reparere.
2. **Digest-jobben**, når ett land passerer ~50 000 mottakere. Løses med
   parallelle arbeidere og satsvis sending, ikke med større maskin.
3. **Én applikasjonsinstans**, når vedvarende trafikk gjør omstart merkbar.
   Løses med to instanser bak lastbalanserer – rate limiting ligger allerede i
   Postgres, så det krever ingen omskriving.
4. **pg-boss**, et sted nord for noen hundre tusen jobber i døgnet. Langt
   utenfor horisonten.

Ingen av disse krever arkitekturendring. Det er den egentlige testen på om
oppsettet er riktig dimensjonert.

---

## 15. Åpne beslutninger

1. **E-postleverandør** (6.2). Krever et valg mellom leveringsgrad og en
   EØS-historie uten fotnoter. Anbefalingen er EØS, men beslutningen er ikke
   min.
2. **Administrert database mot selvdrift.** Anbefalingen er administrert.
   Selvdrift halverer kostnaden og flytter risikoen dit den er dyrest.
3. **Registrar og hvem som eier domenet.** Bør eies av virksomheten, ikke av en
   privatperson, fra første dag.
4. **Hvem som har produksjonstilgang**, og hvordan den fjernes ved
   eierskifte. Bør avklares før første ekte bruker.
