# Kildebanken – produktspesifikasjon v1

**Status:** arbeidsdokument. Erstatter tidligere spesifikasjonsutkast.
**Arbeidstittel:** Kildebanken. Navnet skal ikke bygges inn i arkitekturen.

---

## 1. Formål

Plattformen kobler journalister som trenger kilder med privatpersoner og
fagpersoner som har relevant kunnskap eller erfaring.

Journalisten oppretter en forespørsel. En moderator godkjenner den. Alle
publiserte forespørsler samles i én daglig e-post som går til alle aktive
abonnenter. Mottakeren leser forespørselen og kan sende inn et svar.
Journalisten leser svarene og velger hvem hen vil kontakte videre.

Plattformen deler aldri mottakerens kontaktopplysninger med journalisten
automatisk. Deling skjer bare når respondenten aktivt velger det – enten
sammen med svaret, eller ved å godkjenne en kontaktforespørsel.

---

## 2. Rammer for v1

Tjenesten har null brukere i dag. V1 er bygget for å bevise at kjeden
_forespørsel → utsendelse → svar → kontakt_ fungerer, ikke for å skalere.

### 2.1 Bærende forenklinger

| Beslutning | Konsekvens |
|---|---|
| Alle abonnenter får samme e-post | Ingen matching, ingen interessevalg, ingen personalisert rendering. Digesten bygges én gang og sendes til alle. |
| Én utsendelsesfrekvens: daglig | Ingen frekvensvalg, ingen pause, ingen ukesammendrag. Man er abonnent eller ikke. |
| Ingen kategorier valgt av bruker | Ingen `Category`-tabell, ingen kategoriadministrasjon, ingen gruppering i e-posten. Forespørselen har ett valgfritt `topic`-felt fra en hardkodet liste, kun for visning. |
| Ingen vedlegg | Ingen objektlagring, ingen skadevareskanning, ingen signerte nedlastingslenker. |
| Ingen egendefinerte spørsmål | Journalisten skriver spørsmålene i beskrivelsen. Respondenten svarer i ett fritekstfelt. |
| Ingen telefonnummer | Kontaktdeling er binær: e-postadresse eller ingenting. |
| Ingen organisasjonsentitet | Redaksjon lagres som tekst på journalistprofilen. |
| Norge, norsk bokmål, `Europe/Oslo` | Ingen tidssonelogikk per bruker, ingen i18n-rammeverk i v1. |

### 2.2 Uttrykkelige avgrensninger

V1 inneholder ikke: betaling, chat, video/lyd, AI-matching, artikkelpublisering,
rangering, CRM, integrasjoner mot publiseringssystemer, native app, teamkontoer,
eksport av svar, offentlig oversiktsside over alle forespørsler.

---

## 3. Roller

| Rolle | Kan |
|---|---|
| **Besøkende** | Lese om tjenesten, registrere seg som mottaker, søke om journalistkonto, lese publiserte forespørsler, lese personvernerklæring og vilkår. |
| **Mottaker** | Lese forespørsler, sende svar, trekke eget svar, godkjenne eller avslå kontaktforespørsel, se og korrigere egne opplysninger, melde seg av, slette kontoen. |
| **Journalist** | Opprette og redigere utkast, sende til moderering, se egne publiserte forespørsler, lese innsendte svar, merke svar, skrive internt notat, be om videre kontakt, lukke forespørsel, redigere egen profil. |
| **Moderator** | Behandle journalistsøknader, godkjenne/avvise/returnere forespørsler, lukke forespørsler, suspendere brukere, skjule svar ved misbruk, se moderasjonshistorikk. |
| **Administrator** | Alt moderator kan, pluss: administrere moderatorer, se revisjonslogg, kjøre og se status for utsendelser, håndtere innsyns- og sletteforespørsler, konfigurere lagringstid. |

En konto har nøyaktig én rolle. En e-postadresse kan bare ha én konto. Ønsker en
journalist også å motta digesten, må hen bruke en annen adresse i v1.

Moderator og administrator skal ikke lese innholdet i svar uten et tjenstlig
behov. Alle slike oppslag logges med begrunnelse (se 15.2).

---

## 4. Brukerreiser

### 4.1 Journalist

1. Søker om konto: navn, jobb-e-post, stilling, redaksjon, lenke til redaksjon.
2. Bekrefter e-postadressen.
3. Moderator godkjenner eller avviser søknaden manuelt. Journalisten varsles.
4. Oppretter en forespørsel og sender den til moderering.
5. Moderator godkjenner. Forespørselen publiseres umiddelbart på egen side.
6. Forespørselen inngår i neste morgens utsendelse.
7. Svar kommer inn. Journalisten leser og merker dem.
8. Journalisten ber utvalgte respondenter om videre kontakt.
9. Respondenten godkjenner. Journalisten får e-postadressen.
10. Dialogen fortsetter utenfor plattformen.
11. Journalisten lukker forespørselen, eller den lukkes automatisk ved frist.

### 4.2 Mottaker

1. Registrerer e-postadresse, huker av for samtykke, vilkår og 18 år.
2. Bekrefter adressen via lenke i e-post.
3. Mottar den daglige e-posten kl. 07.00.
4. Klikker «Les og svar» på en forespørsel.
5. Leser forespørselen, fyller ut svaret.
6. Velger om e-postadressen skal følge svaret. Standard: nei.
7. Bekrefter aktivt hva som deles, og sender.
8. Får kvittering på e-post.
9. Får eventuelt en kontaktforespørsel, og godkjenner eller avslår.
10. Ved godkjenning deles e-postadressen med journalisten.

---

## 5. Autentisering

### 5.1 Innlogging

- Kun e-post og engangslenke (magic link). Ingen passord.
- Lenken er gyldig i 15 minutter og kan brukes én gang.
- Økt for mottaker og journalist: 30 dager, fornyes ved bruk.
- Økt for moderator og administrator: 12 timer, fornyes ikke automatisk.
- Maks 5 innloggingsforespørsler per e-postadresse per 15 minutter.
- Vellykket innlogging setter `email_verified_at` dersom den er tom.

### 5.2 Tilgang fra digest-lenken

«Les og svar»-lenken i den daglige e-posten inneholder en token som er unik per
mottaker per utsendelse. Token gir en innlogget økt på 30 dager.

- Token lagres hashet, kan tilbakekalles, og inneholder ingen personopplysninger.
- Siden viser alltid tydelig hvilken e-postadresse man er innlogget som, slik at
  en videresendt e-post ikke fører til at noen svarer i feil navn ved et uhell.
- Kontosletting, endring av e-postadresse og nedlasting av egne data krever ny
  innlogging via magic link, uavhengig av aktiv økt.

**Akseptert risiko:** videresendes den daglige e-posten, får mottakeren av
videresendingen tilgang til kontoen. Alternativet – magic link for hver
innsending – vurderes å koste flere svar enn risikoen er verdt ved lansering.
Revurderes når tjenesten har reelle brukere.

### 5.3 Administratorkontoer

Administrator og moderator logger inn med samme magic link-mekanisme, men med
12 timers økt og full logging av alle handlinger.

**Akseptert risiko:** ingen tofaktor i v1. Skal på plass før antallet
administratorkontoer overstiger to, eller før 500 registrerte mottakere.

---

## 6. Registrering

### 6.1 Mottaker

Obligatorisk:
- e-postadresse
- aktivt samtykke til å motta den daglige e-posten (ikke forhåndsavkrysset)
- aksept av vilkår og personvernerklæring (ikke forhåndsavkrysset)
- bekreftelse på at brukeren er minst 18 år (ikke forhåndsavkrysset)

Valgfritt:
- visningsnavn

Ingen andre profilfelter samles inn i v1. Alt annet journalisten trenger å vite,
skriver respondenten i selve svaret.

Ny konto får status `pending_email_verification`. Digesten sendes ikke før
adressen er bekreftet. Ubekreftede kontoer slettes automatisk etter 14 dager.

### 6.2 Journalist

Obligatorisk:
- fullt navn
- jobb-e-post
- stilling eller funksjon
- redaksjon eller publiseringssted (tekst)
- lenke til redaksjon eller publiseringstjeneste
- aksept av journalistvilkår

Registreringsskjemaet skal opplyse tydelig at journalistens navn og redaksjon
vises offentlig på forespørselen, men at e-postadressen aldri vises for
mottakere.

Ny journalistkonto får status `pending_email_verification`, deretter
`pending_review` når adressen er bekreftet.

---

## 7. Godkjenning av journalister

All godkjenning er manuell i v1. Ingen automatiske kontroller.

Moderator vurderer navn, e-postdomene, oppgitt redaksjon og lenken, og
godkjenner eller avviser. Frilansere, studenter, podkast- og
dokumentarprodusenter og uavhengige medier skal kunne godkjennes.

Avvisning skal ha en begrunnelse som sendes til søkeren.

### 7.1 Kontostatus for journalist

```
pending_email_verification → pending_review → approved
                                            → rejected
approved → suspended → approved
approved → deleted
```

| Status | Kan logge inn | Kan lage utkast | Kan sende til moderering |
|---|---|---|---|
| `pending_email_verification` | nei | nei | nei |
| `pending_review` | ja | ja | nei |
| `approved` | ja | ja | ja |
| `rejected` | nei | – | – |
| `suspended` | nei | – | – |

Ved suspensjon skjules journalistens publiserte forespørsler umiddelbart, og
åpne kontaktforespørsler kanselleres. Innsendte svar beholdes, men er ikke
tilgjengelige for journalisten.

---

## 8. Forespørsel

### 8.1 Felter

| Felt | Krav | Grense |
|---|---|---|
| Tittel | obligatorisk | 120 tegn |
| Kort oppsummering (vises i e-posten) | obligatorisk | 300 tegn |
| Full beskrivelse (inkl. journalistens spørsmål) | obligatorisk | 5 000 tegn |
| Hvem søkes | obligatorisk, fritekst med hjelpetekst som forsvinner ved input | 500 tegn |
| Tema | valgfritt, ett valg fra hardkodet liste | – |
| Svarfrist | obligatorisk, dato + klokkeslett, minst 24 t og maks 90 dager frem | – |
| Anonym medvirkning mulig | obligatorisk ja/nei | – |
| Intervju kan bli tatt opp | obligatorisk ja/nei | – |
| Foto eller video kan bli aktuelt | obligatorisk ja/nei | – |
| Geografisk område | valgfritt fritekst, kun visning | 100 tegn |
| Intern referanse | valgfritt, vises kun for journalisten | 100 tegn |

Temalisten er en konstant i koden, ikke en tabell: Arbeidsliv, Økonomi,
Forbruker, Teknologi, Helse, Familie og oppvekst, Utdanning, Bolig, Miljø og
klima, Politikk og samfunn, Kultur og medier, Reise og fritid, Mat og drikke,
Sport, Næringsliv, Forskning, Jus, Transport, Livserfaring, Lokale saker, Annet.

Temaet påvirker ingenting i v1 – det lagres for å ha datagrunnlag den dagen
matching innføres.

### 8.2 Status og overganger

```
draft ──submit──→ submitted ──approve──→ published ──close──→ closed
                      │                      │
                      ├──request_changes──→ changes_requested ──submit──→ submitted
                      │
                      └──reject──────────→ rejected

published ──frist passert (jobb)──→ expired
draft | changes_requested | rejected ──delete──→ deleted
```

| Overgang | Aktør | Merknad |
|---|---|---|
| `draft → submitted` | journalist | Validerer at alle obligatoriske felter er utfylt. |
| `submitted → published` | moderator | `published_at` settes. Siden er live umiddelbart. |
| `submitted → changes_requested` | moderator | Kommentar til journalisten er obligatorisk. |
| `submitted → rejected` | moderator | Begrunnelse obligatorisk. Endelig. |
| `changes_requested → submitted` | journalist | Etter redigering. |
| `published → closed` | journalist eller moderator | `closed_at` settes. |
| `published → expired` | systemjobb | Når `response_deadline` passeres. `closed_at` settes også. |
| `* → deleted` | journalist (kun før publisering) | Soft delete. |

En publisert forespørsel kan ikke redigeres. Trenger den endring, må moderator
lukke den og journalisten opprette en ny.

`closed` og `expired` er begge terminale. Begge setter `closed_at`, slik at
retensjonsjobben har én referansedato. En lukket forespørsel kan ikke gjenåpnes.

### 8.3 Moderering

Alle forespørsler skal godkjennes før publisering. Moderator kontrollerer:

- at forespørselen har et legitimt journalistisk formål
- at tittel og beskrivelse er forståelige
- at fristen er realistisk
- at det ikke bes om flere personopplysninger enn nødvendig
- at diskriminerende kriterier ikke brukes uten saklig begrunnelse
- at den ikke er markedsundersøkelse, salg eller rekruttering
- at den ikke brukes til trakassering eller uthenging
- at den ikke bryter vilkårene

**Særlige kategorier personopplysninger:** forespørsler som ber respondenten
oppgi opplysninger om helse, religion, politisk oppfatning, seksuelle forhold,
etnisitet eller fagforeningsmedlemskap **avvises i v1.** Moderator bruker en
standardbegrunnelse. Dette er et bevisst valg: en forsvarlig behandling av
særlige kategorier krever en samtykke- og informasjonsflyt som ikke bygges nå.

Moderator kan ikke redigere journalistens tekst. Moderator kan godkjenne,
avvise eller returnere med kommentar. Alle handlinger logges.

---

## 9. Daglig utsendelse

### 9.1 Jobben

Kjøres kl. 07.00 `Europe/Oslo`, hver dag.

1. Finn alle forespørsler med status `published` og `included_in_digest_at IS NULL`.
2. Er listen tom, avbryt uten å sende.
3. Bygg ett innhold – identisk for alle mottakere, bortsett fra
   lenketoken og avmeldingslenke.
4. Opprett en `Digest`-rad med forespørslene.
5. Finn alle brukere med rolle `recipient`, status `active` og abonnement `active`.
6. Send via e-postleverandør. Lagre én `DigestDelivery` per mottaker.
7. Sett `included_in_digest_at` på forespørslene.
8. Behandle bounce- og klage-webhooks fortløpende, ikke synkront i jobben.

Fordi hver forespørsel får `included_in_digest_at` satt ved første utsendelse,
kan den aldri havne i to digester. Kravet om at samme forespørsel bare sendes én
gang, er dermed en konsekvens av datamodellen og ikke en regel som må håndheves.

En forespørsel publisert etter kl. 07.00 kommer med neste morgen. Siden er
tilgjengelig og kan besvares fra publiseringsøyeblikket.

### 9.2 Innhold

- dato
- antall nye forespørsler
- kort introduksjon
- per forespørsel: tittel, kort oppsummering, redaksjon, svarfrist, eventuelt
  geografisk område, knapp «Les og svar»
- avmeldingslenke

Forespørslene listes kronologisk. Ingen gruppering.

Full beskrivelse tas ikke med i e-posten.

Alle e-poster sendes i både HTML og ren tekst.

### 9.3 Bounce, klager og avmelding

- Hard bounce: adressen settes til `bounced` og får ingen flere utsendelser.
- Spam-klage: abonnementet settes til `unsubscribed` umiddelbart.
- Tre myke bounces på rad behandles som hard bounce.
- Avmeldingslenken virker uten innlogging, med ett klikk, via en tilbakekallbar
  token. Ingen bekreftelsesside som krever ytterligere handling.
- Alle bulkutsendelser sender `List-Unsubscribe` og `List-Unsubscribe-Post`.
- Avmeldte adresser beholdes hashet på en sperreliste, slik at de ikke kan
  registreres inn igjen ved en feil.

### 9.4 Avsenderoppsett

SPF, DKIM og DMARC skal være konfigurert før første utsendelse. Bulkutsendelser
går fra eget subdomene, atskilt fra konto- og sikkerhetsmeldinger:

```
utsendelse@epost.tjenesten.no    daglig digest
varsler@tjenesten.no             transaksjonelle varsler
```

Avsenderdomenet varmes opp gradvis. Leveringsgrad og klagerate overvåkes fra
første utsendelse.

---

## 10. Forespørselsside

Hver publisert forespørsel får en offentlig side på en lesbar URL:

```
/foresporsler/:id/soker-personer-som-har-byttet-karriere
```

Siden viser tittel, redaksjon, journalistens navn, publiseringsdato, svarfrist,
kort oppsummering, full beskrivelse, hvem som søkes, informasjon om anonymitet
og opptak, status, knapp for å svare, og en lenke for å rapportere forespørselen.

Journalistens e-postadresse vises aldri.

Siden er offentlig lesbar uten innlogging og har Open Graph-metadata, kanonisk
URL og delingsbilde. Innsending av svar krever verifisert konto.

Er forespørselen `closed` eller `expired`, vises innholdet fortsatt, men med
tydelig merking og uten svarknapp.

Svar, mottakerprofiler og journalistportalen skal aldri indekseres. `noindex` på
alt utenfor de offentlige forespørselssidene og informasjonssidene.

---

## 11. Svar

### 11.1 Skjema

| Felt | Krav | Grense |
|---|---|---|
| Hvorfor er du relevant? | obligatorisk, fritekst med eksempeltekst | 2 000 tegn |
| Svar på journalistens spørsmål | obligatorisk, fritekst med eksempeltekst | 4 000 tegn |
| Kort presentasjon av deg selv | valgfritt | 500 tegn |
| Visningsnavn | valgfritt, forhåndsutfylt fra kontoen | 80 tegn |

Er visningsnavn tomt, vises svaret for journalisten som «Anonym respondent».

Ingen utkast. Ett svar per person per forespørsel, håndhevet med unik indeks.

### 11.2 Deling av kontaktopplysninger

Respondenten velger:

1. **Ikke del e-postadressen min ennå** *(standard)* – journalisten kan be om
   kontakt gjennom plattformen.
2. **Del e-postadressen min med journalisten** – adressen følger svaret.

### 11.3 Bekreftelse før innsending

Før svaret sendes, vises en bekreftelsesskjerm med:

- hvilken journalist som mottar svaret, og hvilken redaksjon hen har oppgitt
- nøyaktig hvilke opplysninger som deles, gitt valget i 11.2
- at svaret kan bli sitert
- at innsending ikke garanterer kontakt eller publisering
- at journalisten har et selvstendig ansvar for journalistisk behandling
- at plattformen kontrollerer at journalisten er en reell person i en oppgitt
  redaksjon, men ikke kan garantere hvordan hen opptrer, og at man ikke bør dele
  mer enn man er komfortabel med
- at opplysninger som allerede er sendt, ikke kan trekkes tilbake fra
  journalisten, selv om svaret trekkes fra plattformen

Respondenten må aktivt bekrefte. Ingen forhåndsavkryssing.

### 11.4 Trekking

Respondenten kan trekke svaret så lenge forespørselen er åpen. Trukket svar
skjules umiddelbart for journalisten, og åpne kontaktforespørsler knyttet til
det kanselleres. Journalisten varsles ikke særskilt.

Svar kan ikke redigeres etter innsending. Ønsker respondenten å endre, må hen
trekke svaret og sende et nytt.

### 11.5 Rapportering

Både forespørsler og svar kan rapporteres via et enkelt skjema som sender
e-post til moderatorene. Ingen egen datamodell i v1. Moderator handler manuelt
og logger tiltaket i revisjonsloggen.

Tiltak moderator kan sette i verk: lukke forespørselen, skjule et svar,
suspendere kontoen, sperre e-postadressen.

---

## 12. Journalistens svarinnboks

Per forespørsel vises antall svar, antall uleste og status/frist.

Listevisning per svar: visningsnavn, første linje av presentasjonen,
innsendingstidspunkt, markering, og om e-postadressen er delt.

Detaljvisning: hele svaret, respondentens valg om deling, tidslinje for
handlinger, knapp for kontaktforespørsel, knapp for å rapportere.

Journalisten kan markere hvert svar som `unreviewed`, `shortlisted` eller
`not_selected`, og skrive et internt notat. Markering og notat er aldri synlig
for respondenten.

Ingen filtrering, sortering eller søk i v1 – volumet forsvarer det ikke.

`viewed_at` settes første gang detaljvisningen åpnes, og utløser ingen
notifikasjon til respondenten utover statusen hen kan se selv.

---

## 13. Videre kontakt

### 13.1 Kontaktforespørsel

Har respondenten ikke delt e-postadressen, kan journalisten sende én
kontaktforespørsel per svar. Journalisten oppgir en kort melding (maks 1 000
tegn) og hvilken kontaktform hen ønsker.

### 13.2 Respondentens svar

Respondenten godkjenner eller avslår. Ved godkjenning deles e-postadressen, og
journalisten varsles. Ved avslag varsles journalisten uten begrunnelse.

Ingen motforslag, ingen oppfølgingsmeldinger, ingen strukturert dialog i v1.
Etter godkjenning fortsetter kontakten på e-post utenfor plattformen.

Kontaktforespørselen utløper automatisk etter 14 dager uten svar, eller når
forespørselen lukkes.

### 13.3 Status

```
pending → approved
        → declined
        → expired    (14 dager, eller forespørselen lukkes)
        → cancelled  (svaret trekkes, eller journalisten suspenderes)
```

`ContactRequest.status` er eneste kilde for kontaktflytens tilstand. Svarets
egen markering og livssyklus holdes adskilt fra denne (se 18.4).

All deling av kontaktopplysninger logges i revisjonsloggen med tidspunkt,
hvilken journalist som fikk tilgang og hvilket samtykke som lå til grunn.

---

## 14. E-postmaler

| Mal | Mottaker |
|---|---|
| Bekreft e-postadresse | begge |
| Innloggingslenke | begge |
| Journalistsøknad mottatt | journalist |
| Journalistkonto godkjent | journalist |
| Journalistkonto avvist, med begrunnelse | journalist |
| Forespørsel godkjent og publisert | journalist |
| Endringer kreves, med kommentar | journalist |
| Forespørsel avvist, med begrunnelse | journalist |
| Nytt svar mottatt | journalist |
| Kontakt godkjent | journalist |
| Kontakt avslått | journalist |
| Forespørsel utløper om 24 timer | journalist |
| Forespørsel lukket | journalist |
| Dagens forespørsler (digest) | mottaker |
| Kvittering på innsendt svar | mottaker |
| Forespørsel om videre kontakt | mottaker |
| Forespørsel du har svart på er lukket | mottaker |
| Kontosletting bekreftet | mottaker |
| Ny forespørsel til moderering | moderator |

Alle maler finnes i HTML og ren tekst. Alle skal fungere med skjermleser.

---

## 15. Administrasjonsgrensesnitt

### 15.1 Dashboard

Journalistsøknader til behandling, forespørsler i modereringskø, aktive
forespørsler, forespørsler som utløper innen 48 timer, status for siste
utsendelse med antall feilede leveranser, nye mottakere siste 7 dager,
avmeldinger siste 7 dager.

### 15.2 Funksjoner

- **Journalister:** søk, se søknadsgrunnlag, godkjenn, avvis, suspender,
  opphev suspensjon, se tidligere forespørsler.
- **Forespørsler:** modereringskø, forhåndsvisning, godkjenn, avvis, returner
  med kommentar, lukk.
- **Mottakere:** søk på e-postadresse, se kontostatus og samtykkehistorikk,
  gjennomfør sletting, suspender ved misbruk.
- **Utsendelser:** se siste digester, antall sendt, bounces, klager, kjør på
  nytt ved feil.

Åpning av et enkeltsvar fra administrasjonsgrensesnittet krever at
administratoren velger en begrunnelse fra en liste. Oppslaget logges med
begrunnelsen. Det finnes ingen visning som lister alle svar på tvers av
forespørsler.

---

## 16. Personvern

### 16.1 Behandlingsgrunnlag

- **Samtykke:** abonnement på den daglige e-posten.
- **Avtale:** levering av brukerkonto og de funksjonene brukeren ber om.
- **Berettiget interesse:** sikkerhet, misbruksforebygging, revisjonslogg.

En juridisk gjennomgang skal gjøres før lansering. Særlige kategorier
personopplysninger behandles ikke i v1 (se 8.3).

### 16.2 Samtykkelogg

Ved hvert samtykke lagres: bruker-ID, samtykketype, versjon av teksten det ble
samtykket til, tidspunkt, kilde, og eventuelt tidspunkt for tilbaketrekking.

Vilkårs- og personvernversjonene lagres i repoet med versjonsnummer, slik at det
alltid kan dokumenteres nøyaktig hvilken tekst brukeren godtok.

### 16.3 Brukerens rettigheter

Selvbetjent i v1: se egne opplysninger, korrigere visningsnavn, trekke et
innsendt svar, melde seg av, slette kontoen.

Manuelt i v1: nedlasting av egne data og innsyn. Forespørsler sendes til
kontaktadressen i personvernerklæringen og besvares innen 30 dager.
Administrator har en dokumentert rutine for uttrekket. En selvbetjent eksport
bygges når volumet krever det.

### 16.4 Lagringstid

| Data | Lagringstid |
|---|---|
| Aktiv konto | Så lenge kontoen er aktiv |
| Ubekreftet konto | 14 dager |
| Innsendt svar | 12 måneder etter at forespørselen lukkes |
| Trukket svar | Slettes umiddelbart |
| Kontaktforespørsel | 12 måneder etter avslutning |
| Avvist journalistsøknad | 6 måneder |
| Avmeldt adresse | Hashet på sperreliste, ubegrenset |
| Sikkerhetslogg | 6 måneder |
| Revisjonslogg | 3 år |
| Digest og leveringsstatus | 12 måneder |

Alle lagringstider settes som konfigurasjon, ikke som konstanter i
forretningslogikken. Retensjonsjobben kjører daglig.

Automatisk sletting ved inaktivitet er ikke med i v1, men er en forutsetning
for punktet «aktiv konto» over og må på plass innen 18 måneder etter lansering.

### 16.5 Sletting

Ved kontosletting:

- fremtidige utsendelser stanses, aktive økter avsluttes
- kontoen anonymiseres: e-post erstattes av en hash, visningsnavn fjernes
- innsendte svar anonymiseres – `respondent_id` beholdes som referanse til den
  anonymiserte kontoen, delt e-postadresse fjernes, svarteksten beholdes til den
  ordinære retensjonsfristen løper ut
- åpne kontaktforespørsler kanselleres og journalisten varsles
- samtykkehistorikk beholdes i minimal form for å dokumentere avmelding
- slettingen logges uten unødvendige personopplysninger

Svarteksten beholdes fordi journalisten kan ha en pågående sak. Dette skal stå
uttrykkelig i personvernerklæringen og på slettebekreftelsen.

Slettes en journalistkonto, lukkes åpne forespørsler, respondentene varsles, og
svarene følger den ordinære retensjonsfristen.

---

## 17. Sikkerhet

- HTTPS overalt, HSTS.
- Rollebasert tilgangskontroll håndhevet i backend, ikke i frontend.
- Rate limiting: 5 innloggingsforespørsler per adresse per 15 min, 10
  svarinnsendinger per konto per time, 20 forespørselsopprettelser per
  journalist per døgn.
- CSRF-beskyttelse på alle tilstandsendrende endepunkter.
- Parametriserte spørringer. Output escapes. Content Security Policy.
- Tokens lagres hashet. Ingen personopplysninger i URL-er.
- Databasen krypteres i hvile. Hemmeligheter i secret manager, ikke i miljøfiler
  i repoet.
- Daglig sikkerhetskopi. RPO 24 timer, RTO 8 timer. Gjenoppretting testes før
  lansering.
- Revisjonslogg på alle administrative handlinger og all deling av
  kontaktopplysninger.

### 17.1 Hvem kan lese et svar

Kun respondenten selv, journalisten som eier forespørselen, og en moderator
eller administrator med registrert begrunnelse. Ingen andre. Ingen
teamdeling i v1.

---

## 18. Datamodell

Åtte tabeller. `RecipientProfile`, `Organization`, `Category`, `UserInterest`,
`RequestCategory`, `RequestQuestion`, `ResponseAnswer` og `Attachment` finnes
ikke i v1.

### 18.1 User

```
id
email                       unik
email_hash                  settes ved anonymisering
email_verified_at
role                        recipient | journalist | moderator | admin
status                      pending_email_verification | active | suspended | deleted
display_name                nullable
created_at
updated_at
last_login_at
deleted_at
```

### 18.2 JournalistProfile

```
id
user_id                     unik
full_name
job_title
organization_name
organization_url
reviewed_by                 nullable
reviewed_at                 nullable
review_note                 nullable, kun synlig for moderator
created_at
updated_at
```

### 18.3 Request

```
id
journalist_id
slug                        for offentlig URL
title
summary
description
target_person_description
topic                       nullable, enum-verdi fra hardkodet liste
geographic_note             nullable
internal_reference          nullable
response_deadline
status                      draft | submitted | changes_requested | approved
                            | published | closed | expired | rejected | deleted
allows_anonymous_participation
may_be_recorded
may_involve_photo_video
moderator_comment           nullable
moderated_by                nullable
moderated_at                nullable
published_at                nullable
included_in_digest_at       nullable
closed_at                   nullable, settes ved både closed og expired
created_at
updated_at
```

`approved` er med i enumet som mellomtilstand for moderatorens handling, men
settes og forlates i samme transaksjon som publisering. Alternativt kan den
sløyfes helt – avgjøres ved implementering.

### 18.4 Response

```
id
request_id
respondent_id
display_name_snapshot       navnet slik det ble oppgitt ved innsending
relevance_statement
answer_text
short_bio                   nullable
contact_sharing             none | email
lifecycle_status            submitted | withdrawn | hidden_by_moderator | deleted
journalist_marking          unreviewed | shortlisted | not_selected
journalist_note             nullable
viewed_at                   nullable
submitted_at
withdrawn_at                nullable
created_at
updated_at
```

Unik indeks på `(request_id, respondent_id)` der `lifecycle_status = 'submitted'`.

De tre aksene holdes atskilt med hensikt: `lifecycle_status` eies av
respondenten, `journalist_marking` av journalisten, og kontaktflytens tilstand
ligger utelukkende i `ContactRequest`.

### 18.5 ContactRequest

```
id
response_id                 unik – én kontaktforespørsel per svar
journalist_id
message
requested_contact_method
status                      pending | approved | declined | expired | cancelled
shared_email                nullable, settes ved godkjenning
responded_at                nullable
expires_at
created_at
updated_at
```

### 18.6 EmailSubscription

```
id
user_id                     unik
status                      active | unsubscribed | bounced
unsubscribe_token_hash
unsubscribed_at             nullable
last_digest_at              nullable
created_at
updated_at
```

### 18.7 Digest og DigestDelivery

```
Digest
id
scheduled_for
request_ids                 array
recipient_count
status                      pending | sending | sent | failed
sent_at

DigestDelivery
id
digest_id
user_id
access_token_hash
provider_message_id         nullable
status                      queued | sent | delivered | bounced | complained | failed
error_message               nullable
created_at
updated_at
```

### 18.8 ConsentRecord

```
id
user_id
consent_type                terms | privacy | email_subscription | age_18
document_version
granted                     boolean
granted_at
withdrawn_at                nullable
source                      registration_form | settings_page | unsubscribe_link
created_at
```

### 18.9 AuditLog

```
id
actor_type                  user | system | job
actor_user_id               nullable – null for system og job
action
entity_type
entity_id
reason                      nullable, obligatorisk ved oppslag i svar
metadata                    jsonb, aldri fullstendige svar eller unødvendige
                            personopplysninger
ip_address                  nullable
created_at
```

### 18.10 Suppression

```
id
email_hash                  unik
reason                      unsubscribed | hard_bounce | complaint | manual
created_at
```

---

## 19. API

```
POST   /auth/request-link
POST   /auth/verify
POST   /auth/logout

GET    /me
PATCH  /me                          visningsnavn
DELETE /me                          krever fersk innlogging

POST   /unsubscribe/:token          uten innlogging, ett klikk
POST   /subscribe                   registrering som mottaker

POST   /journalists/apply
GET    /journalists/me
PATCH  /journalists/me

POST   /requests
GET    /requests/mine
GET    /requests/:id                offentlig for publiserte
PATCH  /requests/:id                kun draft og changes_requested
POST   /requests/:id/submit
POST   /requests/:id/close
DELETE /requests/:id                kun før publisering

POST   /requests/:id/responses      krever verifisert konto
GET    /responses/mine
POST   /responses/:id/withdraw

GET    /journalist/requests/:id/responses
GET    /journalist/responses/:id
PATCH  /journalist/responses/:id/marking
POST   /journalist/responses/:id/contact-request

GET    /contact-requests/:id
POST   /contact-requests/:id/respond    { decision: approved | declined }

POST   /report                      { entity_type, entity_id, reason, comment }

GET    /admin/journalists
POST   /admin/journalists/:id/approve
POST   /admin/journalists/:id/reject
POST   /admin/users/:id/suspend
GET    /admin/moderation/requests
POST   /admin/requests/:id/publish
POST   /admin/requests/:id/reject
POST   /admin/requests/:id/request-changes
POST   /admin/requests/:id/close
GET    /admin/digests
POST   /admin/digests/:id/retry
```

---

## 20. Ikke-funksjonelle krav

### 20.1 Ytelse

- p95 sidelast under 2 sekunder ved inntil 50 samtidige økter.
- Digest-jobben skal levere til 10 000 mottakere innen 30 minutter fra 07.00, og
  skal kjøre i jobbkø uten å blokkere webtrafikk.
- 99,5 % oppetid målt månedlig.

Tallene er dimensjonert for lansering, ikke for det spekulative 100 000-tallet i
tidligere utkast. Revurderes ved 5 000 mottakere.

### 20.2 Tilgjengelighet

WCAG 2.2 AA. Alle sentrale handlinger skal kunne utføres med tastatur. Skjemaer
skal ha tydelige, tekstlige feilmeldinger knyttet til riktig felt. Farge skal
aldri være eneste statusindikator. E-postene skal fungere med skjermleser.

### 20.3 Øvrig

- Mottakerflyten skal være fullt mobiltilpasset. Journalist- og
  administrasjonsflatene skal fungere på mobil, men optimaliseres for desktop.
- Siste to hovedversjoner av Chrome, Safari, Firefox og Edge.
- Norsk bokmål. Tekster ligger i egne ressursfiler slik at språk kan legges til
  senere uten refaktorering.
- Alle tidspunkter lagres i UTC og vises i `Europe/Oslo`.

### 20.4 Analyse

Kun aggregert måling: antall aktive mottakere, nye per uke, avmeldingsrate,
antall publiserte forespørsler, andel med minst ett svar, gjennomsnittlig antall
svar, andel som fører til godkjent kontakt, modereringstid, bounce- og
klagerate.

Ingen åpningssporing, ingen tredjepartssporing, ingen annonsepiksler, ingen
session replay. `EmailDelivery` har derfor verken `opened_at` eller `clicked_at`.

---

## 21. Funksjonelle krav

Hvert krav har et akseptansekriterium som kan verifiseres direkte.

### Registrering og konto

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-001 | Systemet skal opprette en mottakerkonto med status `pending_email_verification` når skjemaet i 6.1 sendes med alle tre samtykkene avkrysset. | Test: innsending uten ett av samtykkene avvises. |
| FR-002 | Systemet skal ikke ta imot svar fra en konto uten `email_verified_at`. | Test: innsending fra ubekreftet konto returnerer 403. |
| FR-003 | Systemet skal sette abonnementet til `unsubscribed` ved ett kall til `/unsubscribe/:token`, uten innlogging og uten videre bekreftelse. | Test: ett POST-kall, deretter ingen leveranse i neste digest. |
| FR-004 | Systemet skal slette ubekreftede kontoer eldre enn 14 dager. | Test: retensjonsjobb mot fikstur. |
| FR-005 | Systemet skal hindre en journalist med annen status enn `approved` i å sende en forespørsel til moderering. | Test per status i tabellen i 7.1. |

### Forespørsler

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-010 | Journalisten skal kunne lagre en forespørsel som `draft` uten at obligatoriske felter er utfylt. | Test: lagring med tomme felter lykkes. |
| FR-011 | Systemet skal avvise `draft → submitted` dersom et obligatorisk felt i 8.1 mangler, med feilmelding per felt. | Test per felt. |
| FR-012 | Moderator skal kunne publisere, avvise eller returnere en `submitted` forespørsel, og begrunnelse skal være obligatorisk ved de to siste. | Test: avvisning uten begrunnelse returnerer 422. |
| FR-013 | Systemet skal sette `published_at` og gjøre forespørselssiden offentlig tilgjengelig i samme transaksjon som publisering. | Test: siden svarer 200 anonymt umiddelbart etter godkjenning. |
| FR-014 | Systemet skal sette status `expired` og `closed_at` på alle publiserte forespørsler der `response_deadline` er passert, innen 15 minutter. | Test: jobb mot fikstur med frist i fortiden. |
| FR-015 | Journalisten skal kunne lukke en publisert forespørsel før fristen. | Test: status blir `closed`, svarknappen forsvinner. |
| FR-016 | Systemet skal ikke publisere en forespørsel som ikke har vært innom `submitted` og en moderatorhandling. | Kodegjennomgang og test av direkte statusmanipulasjon. |

### Utsendelse

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-020 | Systemet skal sende én digest per dag kl. 07.00 til alle brukere med abonnement `active`, forutsatt at det finnes minst én ny publisert forespørsel. | Test: jobb med og uten nye forespørsler. |
| FR-021 | Systemet skal sette `included_in_digest_at` slik at en forespørsel aldri inngår i mer enn én digest. | Test: to påfølgende jobbkjøringer gir tom andre digest. |
| FR-022 | Systemet skal utelate brukere med status `unsubscribed` eller `bounced` fra utsendelsen. | Test per status. |
| FR-023 | Systemet skal registrere leveringsstatus per mottaker og sette adressen til `bounced` ved hard bounce. | Test: simulert webhook. |
| FR-024 | Alle bulkutsendelser skal inneholde `List-Unsubscribe` og `List-Unsubscribe-Post`. | Inspeksjon av headere. |

### Svar og kontakt

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-030 | Systemet skal lagre `contact_sharing = none` som standard, og bare dele e-postadressen dersom respondenten aktivt har valgt det. | Test: innsending uten valg gir `none`, og journalistvisningen viser ingen adresse. |
| FR-031 | Systemet skal hindre mer enn ett aktivt svar per person per forespørsel. | Test: andre innsending returnerer 409. |
| FR-032 | Respondenten skal kunne trekke svaret så lenge forespørselen er åpen, og det skal umiddelbart bli utilgjengelig for journalisten. | Test: journalistvisningen returnerer 404 etter trekking. |
| FR-033 | Journalisten skal kunne sende én kontaktforespørsel per svar. | Test: andre forsøk returnerer 409. |
| FR-034 | Systemet skal bare gjøre e-postadressen tilgjengelig for journalisten etter at respondenten har godkjent kontaktforespørselen. | Test: adressen er fraværende i API-svaret ved status `pending` og `declined`. |
| FR-035 | Systemet skal skrive en revisjonslogg ved hver deling av kontaktopplysninger, med journalist, respondent, tidspunkt og grunnlag. | Test: logglinje finnes etter godkjenning. |
| FR-036 | Systemet skal sette kontaktforespørsler til `expired` etter 14 dager uten svar. | Test: jobb mot fikstur. |

### Administrasjon

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-050 | Systemet skal logge alle moderator- og administratorhandlinger i revisjonsloggen. | Test per handling i 15.2. |
| FR-051 | Systemet skal kreve en registrert begrunnelse før en administrator kan åpne et enkeltsvar. | Test: oppslag uten begrunnelse returnerer 422. |
| FR-052 | Systemet skal ikke tilby noen visning som lister svar på tvers av forespørsler. | Kodegjennomgang. |
| FR-053 | Administrator skal kunne se leveringsstatus for hver digest og kjøre en feilet utsendelse på nytt. | Test: retry etter simulert feil. |

---

## 22. Akseptansekriterier for lansering

V1 er klar når hele denne kjeden kan gjennomføres på et produksjonsmiljø:

1. En journalist søker om konto og blir manuelt godkjent av en moderator.
2. Journalisten oppretter en forespørsel og sender den til moderering.
3. Moderator godkjenner. Forespørselssiden er umiddelbart offentlig lesbar.
4. Digest-jobben kjører 07.00 og leverer forespørselen til alle aktive
   abonnenter, i én e-post, med fungerende ettklikks avmelding.
5. En mottaker åpner forespørselen fra e-posten og sender inn et svar med
   standardvalget «ikke del e-postadresse».
6. Journalisten leser svaret uten å se noen kontaktopplysninger.
7. Journalisten sender en kontaktforespørsel.
8. Respondenten godkjenner, og journalisten får e-postadressen.
9. Delingen finnes i revisjonsloggen med grunnlag og tidspunkt.
10. Begge parter har mottatt de bekreftelsene som er listet i seksjon 14.
11. Forespørselen settes automatisk til `expired` når fristen passeres.
12. Respondenten trekker et annet svar, og det forsvinner fra journalistens
    innboks umiddelbart.
13. Mottakeren melder seg av med ett klikk og får ikke neste digest.
14. Mottakeren sletter kontoen, og anonymiseringen i 16.5 er gjennomført.
15. Ingen svar, mottakerprofiler eller journalistsider er tilgjengelige uten
    innlogging eller indekserbare av søkemotorer.
16. SPF, DKIM og DMARC er verifisert, og en testutsendelse lander i innboksen
    hos Gmail, Outlook og en norsk leverandør.

---

## 23. Implementeringsrekkefølge

**Fase 1 – Fundament.** Prosjektoppsett, database, magic link-autentisering,
brukere og roller, samtykkelogging, revisjonslogg, e-postleverandør og
domeneoppsett med SPF/DKIM/DMARC.

**Fase 2 – Journalist og forespørsel.** Journalistsøknad, moderatorgodkjenning,
opprettelse av forespørsel, modereringskø, publisering, offentlig
forespørselsside.

**Fase 3 – Mottaker og utsendelse.** Registrering med samtykke, digest-jobb,
tilgangstoken fra e-post, avmelding, bounce- og klagehåndtering.

**Fase 4 – Svar og kontakt.** Svarskjema med bekreftelsesskjerm, journalistens
innboks, markering og notat, kontaktforespørsel, godkjenning og deling.

**Fase 5 – Lansering.** Retensjonsjobber, rapporteringsskjema,
tilgjengelighetstest, sikkerhetsgjennomgang, juridisk gjennomgang av vilkår og
personvernerklæring, gjenopprettingstest av sikkerhetskopi, oppvarming av
avsenderdomene.

Fase 1–2 gir en demonstrerbar flyt uten mottakere. Fase 3 er første punkt der
tjenesten kan tas i bruk av eksterne.

---

## 24. Kuttet fra v1

Alt under er bevisst utelatt, ikke glemt. Rekkefølgen er en anbefaling for
gjeninnføring.

| Nr. | Funksjon | Hvorfor kuttet | Utløser for gjeninnføring |
|---|---|---|---|
| 1 | Kategorivalg, interesser, geografisk og regelbasert matching | Uten brukere finnes ingen relevans å optimalisere. Kostet to entiteter, en modul og en tvetydig regelmotor. | Når en digest jevnlig har mer enn ~8 forespørsler, eller avmeldingsraten overstiger 2 % per utsendelse. |
| 2 | Frekvensvalg, pause, ukesammendrag | Ett abonnement er enklere å forklare og teste. | Samme utløser som over. |
| 3 | Egendefinerte spørsmål med strukturerte svar | Krevde to entiteter, dynamisk skjemarendering og et svartype-system. Fritekst dekker behovet ved lavt volum. | Når journalister rutinemessig ber om det samme oppsettet, eller ved behov for eksport. |
| 4 | Vedlegg og profilbilder | Objektlagring, skadevareskanning, signerte lenker og egen retensjonskobling for en marginal gevinst. | Når mer enn et fåtall svar viser til dokumentasjon respondenten ikke får levert. |
| 5 | Telefonnummer og SMS-verifisering | Ekstra personopplysning, ekstra leverandør, ekstra kostnad. E-post er nok for førstekontakt. | Når journalister melder at e-postkontakt ikke gir svar. |
| 6 | Organisasjonsentitet, teamkontoer, delte forespørsler | Krever kuratering, duplikathåndtering og en tilgangsmodell. | Ved første redaksjon med mer enn to aktive journalister. |
| 7 | Rapportering som datamodell | E-post til moderator dekker behovet ved lavt volum. | Ved mer enn ~5 rapporter i måneden. |
| 8 | Filtrering, sortering og søk i svarinnboksen | Meningsløst under ~20 svar per forespørsel. | Når en forespørsel passerer 30 svar. |
| 9 | Eksport av svar | Kan vente til journalistene har et reelt arbeidsflytbehov. | Betalende redaksjoner. |
| 10 | Selvbetjent dataeksport | GDPR krever at retten oppfylles, ikke at den er selvbetjent. Manuell rutine med 30 dagers frist er tilstrekkelig. | Ved mer enn én forespørsel i måneden, eller 1 000 registrerte brukere. |
| 11 | Tofaktor for administratorer | Én til to administratorkontoer ved lansering. | Ved tredje administratorkonto eller 500 registrerte mottakere. |
| 12 | Automatisk sletting ved inaktivitet | Ingen er inaktive ennå. | Innen 18 måneder etter lansering – dette er en forpliktelse, ikke et valg. |
| 13 | Forespørsler om særlige kategorier personopplysninger | Krever en samtykke- og informasjonsflyt vi ikke bygger nå. Avvises av moderator i v1. | Etter juridisk gjennomgang og bygget samtykkeflyt. |
| 14 | Utkast til svar, redigering av innsendte svar | Trekk og send nytt dekker samme behov uten versjonshåndtering. | Ved reelle brukerklager. |
| 15 | Strukturert dialog ved kontakt (motforslag, oppfølgingsspørsmål) | Godkjenn/avslå dekker kjernebehovet. Resten skjer på e-post. | Når mange kontaktforespørsler avslås av praktiske grunner. |
| 16 | Ikke-offentlige forespørsler (`members_only`, `restricted`) | Alle publiserte forespørsler er offentlige. Sensitive avvises. | Sammen med nr. 13. |
| 17 | Offentlig oversiktsside og søk over alle forespørsler | Endrer produktdynamikken og krever paginering og indekseringsregler. | Egen produktbeslutning. |

---

## 25. Uavklarte spørsmål

Disse blokkerer ikke arkitekturarbeidet, men bør besvares før Fase 4:

1. Skal journalistens navn vises offentlig på forespørselen, eller bare
   redaksjonen? Spesifikasjonen forutsetter i dag at navnet vises.
2. Skal en journalist kunne se hvor mange som har åpnet forespørselen?
   Forutsetter klikkmåling, som 20.4 utelukker i sin nåværende form.
3. Hvor mange forespørsler kan én journalist ha publisert samtidig?
   Rate limit finnes i 17, men ingen øvre grense på aktive forespørsler.
4. Hva skjer med svar på en forespørsel journalisten aldri lukker, og som heller
   ikke har passert fristen fordi fristen er satt 90 dager frem?
   Vurder en påminnelse til journalisten og automatisk lukking.
