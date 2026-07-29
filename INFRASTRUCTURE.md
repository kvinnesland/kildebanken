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

**To stadier.** Seksjon 3–14 beskriver oppsettet for når tjenesten har brukere
og en liten driftskostnad er forsvarlig. Ved null brukere gjelder i stedet
**seksjon 16** – et oppsett som er gratis i kroner, men som koster ett bevisst
avvik fra EØS-prinsippet og én arkitekturforskjell i jobbkjøringen. Begge er
beskrevet der, med eksplisitte terskler for når dere migrerer til oppsettet i
seksjon 3–14.

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

**Besluttet: Brevo.** Begrunnelsen er ikke teknisk – Postmark er det bedre
produktet – men produktmessig. Tjenestens verdiforslag er at privatpersoner kan
stole på den med opplysninger om seg selv. «All behandling skjer i EØS, uten
unntak» er en setning vi kan stå ved i personvernerklæringen og i
markedsføringen, og den mister verdi hvis den har en fotnote.

Ved store leveringsproblemer i produksjon er det en beslutning å ta opp igjen,
med åpne øyne.

**Gratisplanen har et hardt tak: 300 e-poster per døgn**, som ikke ruller over
til neste dag. Dette er trolig den *første* kvoten som sprenges, ikke
serverkapasiteten – en digest til noen hundre abonnenter kan alene fylle hele
døgnkvoten, før en eneste innloggingslenke er sendt samme dag. Se 16.4 for
terskelen som utløser oppgradering til en betalt Brevo-plan.

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

Dette er kostnaden når tjenesten har brukere og en liten driftsutgift er
forsvarlig å ta på seg. Ved null brukere, se seksjon 16 for et oppsett til
0 kr i måneden.

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

1. ~~**E-postleverandør**~~ **Besluttet: Brevo** (6.2). Gratisplanens tak på
   300 e-poster per døgn er lagt inn som overvåkningspunkt i 16.4.
2. **Administrert database mot selvdrift.** Anbefalingen er administrert.
   Selvdrift halverer kostnaden og flytter risikoen dit den er dyrest.
3. **Registrar og hvem som eier domenet.** Bør eies av virksomheten, ikke av en
   privatperson, fra første dag.
4. **Hvem som har produksjonstilgang**, og hvordan den fjernes ved
   eierskifte. Bør avklares før første ekte bruker.
5. **0 kr mot europeisk eierskap i bootstrap-fasen** (16.7). Utredet, ikke
   avgjort: bli på Netlify/Neon-kompromisset, eller betale ~4–5 €/måned for
   Clever Cloud og forlate det tidligere enn tersklene i 16.4 krever.

---

## 16. Stadium 0 – gratis oppsett ved null brukere

Seksjon 3–14 forutsetter en liten, men reell driftskostnad. Denne seksjonen
beskriver oppsettet for perioden før det er forsvarlig – null brukere, null
inntekt. Det er **midlertidig per design**, med tersklene for å forlate det
listet i 16.4.

Gratis, kommersielt tillatt bruk og EØS-lagring er ikke alle tre oppnåelige
samtidig uten kostnad. Dette stadiet velger gratis og kommersielt tillatt, og
aksepterer et bevisst, tidsbegrenset avvik fra EØS-prinsippet. Det avviket
skal stå i personvernerklæringen så lenge det gjelder, ikke skjules.

### 16.1 Hvorfor ikke Vercel

Vercel var det opplagte valget for et Next.js-prosjekt, og er allerede
fravalgt i 3.1 av driftsmessige grunner. Det er også reelt utelukket av en
annen grunn: **Hobby-planens vilkår tillater bare personlig, ikke-kommersiell
bruk**, definert som ethvert prosjekt som er «used for the purpose of
financial gain of anyone involved in any part of the production of the
project» – inkludert en betalt utvikler som skriver koden.

**Dette avgjøres av hensikt, ikke av dagens inntekt.** At Kildebanken ikke tar
betalt fra journalister eller mottakere (`SPEC-V1.md` 2.3), gjør ikke
prosjektet ikke-kommersielt – planen om å selge reklameplass når volumet
tillater det er nøyaktig den hensikten Vercels definisjon fanger opp, fra den
dagen planen finnes. Å vente med annonsesalget utsetter inntekten, ikke
klassifiseringen. Vercel kan stanse et Hobby-prosjekt uten varsel dersom det
oppdages, uavhengig av om det på det tidspunktet faktisk har begynt å tjene
penger.

Dette gjør i praksis ingen forskjell for anbefalingen under: Netlify skiller
ikke mellom kommersiell og ikke-kommersiell bruk på sin gratisplan i det hele
tatt. Poenget er bare at Vercel forblir stengt, også senere – ikke noe som
åpner seg den dagen reklamen faktisk selges.

### 16.2 Oppsettet

```
                    ┌──────────────────────────────┐
   Nettleser ──────▶│  Next.js på Netlify Free     │
                    │  (kommersiell bruk tillatt)   │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │  Neon Free – PostgreSQL       │
                    │  region: Frankfurt (eu-central-1) │
                    └──────────▲───────────────────┘
                               │
                    ┌──────────┴───────────────────┐
                    │  Netlify Scheduled Function   │
                    │  cron-utløst, ingen egen VM   │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
   E-post   ◀───────│  Brevo Free (300/døgn)        │
                    └──────────────────────────────┘
```

| Komponent | Valg | Hvorfor dette holder ved null brukere |
|---|---|---|
| App | **Netlify Free** | Offisiell Next.js-adapter (SSR, API-ruter). Vilkårene tillater kommersiell bruk – i motsetning til Vercel. Kvote i «credits», ikke i penger. |
| Database | **Neon Free** | Permanent gratisnivå (ikke tidsbegrenset som mange konkurrenters gratis-Postgres). Frankfurt-region tilgjengelig på gratisplanen. 0,5 GB lagring, 100 CU-timer/måned, «scale to zero» ved inaktivitet. |
| Planlagte jobber | **Netlify Scheduled Functions** | Se 16.3 – erstatter den alltid-kjørende workeren i seksjon 5. |
| E-post | **Brevo Free** | Allerede besluttet (6.2). 300 e-poster/døgn, ingen rulling til neste dag. |
| Feilrapportering | Sentry Free | Samme som i 3 – 5 000 hendelser/måned dekker null-brukere-fasen uendret. |
| Oppetidsovervåking | Gratis ekstern monitor (f.eks. UptimeRobot) | Erstatter den betalte varianten i 3 til driftskostnad er forsvarlig. |
| Domene og DNS | **Ikke gratis** | Se 16.5. Det eneste posten som koster reelle kroner i dette stadiet. |

### 16.3 Jobbkjøring uten egen server

Dette er den ene reelle arkitekturforskjellen, ikke bare et leverandørbytte.
Seksjon 5 forutsetter en alltid-kjørende worker som poller pg-boss kontinuerlig.
En slik prosess finnes ikke på en gratis, serverløs plattform – funksjonen
kjører, gjør jobben sin, og avsluttes.

Løsningen er å snu logikken fra «lytt kontinuerlig» til «bli vekket og sjekk»:

```
Hvert 15. minutt (Netlify Scheduled Function):
   for hvert land med status = active:
       samme sjekk som i 5.2 – lokal tid mot digest_send_time,
       ingen Digest for (land, lokal_dato) ennå
   kjør expire-requests, expire-contact-requests, deadline-reminder,
   retention og purge-unverified etter samme mønster – én sjekk per kall,
   ikke en bakgrunnsprosess
```

Idempotensen ligger fortsatt i databasens unike indeks på
`(country_code, local_date)`, akkurat som i 5.2 – det er derfor dette
fungerer uten pg-boss's lytteprosess. To overlappende kall kan fortsatt ikke gi
to digester.

**Konsekvens ved migrering til seksjon 3–14:** å bytte til en alltid-kjørende
worker er byttet ut kallmønster, ikke datamodell. `Digest`, `DigestDelivery` og
de øvrige tabellene i `SPEC-V1.md` 19 er uendret. Dette er kjent, avgrenset
arbeid – ikke en omskriving.

### 16.4 Det som faktisk begrenser dette stadiet

| Grense | Verdi | Hva som skjer når den nås |
|---|---|---|
| Brevo, e-poster per døgn | 300, ingen rulling | Digest og transaksjonell e-post konkurrerer om samme kvote samme dag. **Dette er trolig den første grensen som treffes** – overvåk daglig sendt antall fra dag én, ikke bare ved feil. |
| Neon, lagring | 0,5 GB | Nås ikke av forespørsler og svar alene på lang tid; `AuditLog` og `DigestDelivery` vokser raskest. |
| Neon, beregningstid | 100 CU-timer/måned | Bør holde ved lavt trafikkvolum og en tikkejobb hvert 15. minutt; overvåk om «scale to zero» gir merkbare oppvåkningsforsinkelser for brukeren. |
| Netlify, funksjonskvote | 300 «credits»/måned | Vokser med trafikk og antall bygg. Verifiser gjeldende omregning mot faktisk bruk før dere nærmer dere den. |

Enhver av disse er en grunn til å migrere den *aktuelle* komponenten alene –
ikke et signal om å bytte hele stabelen på én gang. Går Brevo-kvoten tom lenge
før noe annet, bytt bare e-postplan.

**Samlet migreringstrigger til seksjon 3–14:** første betalende kunde, eller
et reelt antall brukere som gjør 200–300 kr i måneden ubetydelig mot risikoen
ved kaldstart og gratisnivåenes ustabilitet. Ved den grensen er kostnaden i
seksjon 13 lav nok til at den ikke lenger er verdt å administrere rundt.

### 16.5 Det som ikke er gratis

- **Domene og DNS.** Uunngåelig fra dag én, uavhengig av hosting. Bør
  registreres i virksomhetens navn (15, punkt 3), ikke hos en privatperson.
- **Juridisk gjennomgang av vilkår og personvernerklæring** (`SPEC-V1.md`
  17.1). Dette er ikke en infrastrukturkostnad, men det er heller ikke gratis,
  og det kan ikke skyves til stadium 1 – forespørsler tas imot og
  personopplysninger samles inn fra første reelle bruker.

### 16.6 Det bevisste avviket fra EØS-prinsippet

Neon er et amerikansk selskap. Data lagres i Frankfurt, men amerikansk
CLOUD Act-jurisdiksjon følger med selskapet, ikke med regionen – present
selv når lagringen skjer i EØS. Det samme gjelder i praksis Netlify.

Dette aksepteres i dette stadiet fordi risikoen er reell lav – null eller
nesten null registrerte personer – og fordi terskelen for å forlate det er lav
og allerede dokumentert i 16.4. Det er ikke akseptert som en permanent løsning,
og det skal ikke presenteres som at «all behandling skjer i EØS» før
migreringen til seksjon 3–14 er gjennomført. Personvernerklæringen skal i
denne perioden opplyse om hvilke databehandlere som brukes og hvor de er
etablert, slik regelverket uansett krever.

### 16.7 Vurderte europeiske alternativer til Netlify

Undersøkt fordi avviket i 16.6 er et bevisst kompromiss, ikke en mangel på
alternativer. Konklusjonen: ingen europeisk leverandør er per i dag både
reelt gratis og teknisk kompatibel med arkitekturen i 16.2–16.3.

| Leverandør | Land | Gratis? | Hvorfor det ikke er et rent bytte |
|---|---|---|---|
| **IONOS Deploy Now** | Tyskland | Ja, permanent | Kun statisk eksport – ingen Node.js-kjøretid. Ingen SSR, ingen API-ruter, ingen erstatning for den cron-utløste funksjonen i 16.3. Dette bærer ikke arkitekturen vi har spesifisert, uansett budsjett. |
| **Clever Cloud** | Frankrike | Nei – kun prøvekreditt | Betal-per-forbruk fra rundt 4–5 €/måned etter prøveperioden. Ingen tidsbegrensning på selve tjenesten, bare på at den er gratis. |
| **Scalingo** | Frankrike | Nei – 30 dagers prøve | Fra rundt 7,20 €/måned etter prøveperioden. God Next.js-støtte. |

Mønsteret er strukturelt, ikke tilfeldig: en reelt gratis-for-alltid PaaS-plan
er en vekststrategi finansiert av risikokapital, og det er i all hovedsak
amerikanske selskaper som har hatt den finansieringen. Europeiske leverandører
er lønnsomme fra første euro, noe som er sunt for dem, men som gjør «gratis»
og «europeisk eid» reelt uforenlige akkurat nå på denne typen tjeneste.

**To legitime veier videre, ikke bare den ene i 16.2:**

1. Behold Netlify + Neon som beskrevet, med avviket i 16.6 stående som
   dokumentert og midlertidig.
2. Betal en liten, reell sum nå for å få europeisk eierskap tidligere enn
   Stadium 1-tersklene i 16.4 krever – Clever Cloud på ~4–5 €/måned er det
   billigste reelle bruddet med kompromisset, klart under den fulle kostnaden
   i seksjon 13.

Dette er et verdivalg mellom 0 kr og et prinsipp, ikke et teknisk spørsmål.
Det er ikke besvart her.
