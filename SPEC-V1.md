# Kildebanken – produktspesifikasjon v1

**Status:** arbeidsdokument. Erstatter tidligere spesifikasjonsutkast.
**Arbeidstittel:** Kildebanken. Navnet skal ikke bygges inn i arkitekturen.

**Supplerende dokumenter:** `DESIGN.md` (designsystem, tokens, e-postmaler),
`INFRASTRUCTURE.md` (kjøretidsmiljø, drift, leverandører).

---

## 1. Formål

Plattformen kobler journalister som trenger kilder med privatpersoner og
fagpersoner som har relevant kunnskap eller erfaring.

Journalisten oppretter en forespørsel. En moderator godkjenner den. Alle
publiserte forespørsler i et marked samles i én daglig e-post som går til alle
aktive abonnenter i det markedet. Mottakeren leser forespørselen og kan sende
inn et svar. Journalisten leser svarene og velger hvem hen vil kontakte videre.

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
| Alle abonnenter i samme land får samme e-post | Ingen matching, ingen interessevalg, ingen personalisert rendering. Digesten bygges én gang per land og språk. |
| Én utsendelsesfrekvens: daglig | Ingen frekvensvalg, ingen pause, ingen ukesammendrag. Man er abonnent eller ikke. |
| Ingen kategorier valgt av bruker | Ingen kategoriadministrasjon, ingen gruppering i e-posten. Forespørselen har ett valgfritt `topic`-felt fra en fast liste, kun for visning. |
| Ingen vedlegg | Ingen objektlagring, ingen skadevareskanning, ingen signerte nedlastingslenker. |
| Ingen egendefinerte spørsmål | Journalisten skriver spørsmålene i beskrivelsen. Respondenten svarer i ett fritekstfelt. |
| Ingen telefonnummer | Kontaktdeling er binær: e-postadresse eller ingenting. |
| Ingen organisasjonsentitet | Redaksjon lagres som tekst på journalistprofilen. |
| Språk og land er med i modellen fra dag én | Se seksjon 3. Ett land og ett språk er aktivt ved lansering; nummer to er konfigurasjon og oversettelse, ikke migrasjon. |

### 2.2 Uttrykkelige avgrensninger

V1 inneholder ikke: betaling, chat, video/lyd, AI-matching, artikkelpublisering,
rangering, CRM, integrasjoner mot publiseringssystemer, native app, teamkontoer,
eksport av svar, offentlig oversiktsside over alle forespørsler,
maskinoversettelse av brukerinnhold, publisering av samme forespørsel i flere
land.

### 2.3 Forretningsmodell

Det planlegges ingen betaling eller abonnement fra journalister, redaksjoner
eller mottakere. Dette er ikke en avgrensning som gjelder v1 og senere
oppheves – det er den faktiske forretningsmodellen: ingen bruker skal noensinne
måtte betale for å bruke tjenesten.

Fremtidig inntekt er tenkt hentet fra **reklame i grensesnittet og i den
daglige e-posten**, innført når volumet gjør det verdt å selge. Dette er ikke
en del av v1-bygget – se punktet i seksjon 25 – men det er verdt å notere nå,
av to grunner:

1. Reklame skal etter markedsføringsloven være tydelig merket som reklame, og
   skal aldri kunne forveksles med en forespørsel, et svar eller redaksjonelt
   innhold. Dette er en designbegrensning som gjelder fra den dagen reklame
   innføres, ikke noe som kan tilpasses i etterkant.
2. At forretningsmodellen er reklame og ikke betaling fra journalister eller
   mottakere, endrer ikke at prosjektet drives med sikte på inntekt. Dette har
   betydning for hvilke vilkår tredjepartstjenester kan brukes under – se
   `INFRASTRUCTURE.md` 16.1.

### 2.4 Antagelse om lanseringsomfang

Spesifikasjonen forutsetter at **arkitekturen** bærer flere språk og land fra
første kodelinje, mens **lanseringen** skjer med ett aktivt land (`NO`) og ett
aktivt språk (`nb-NO`).

Skal to markeder være live samtidig ved lansering, endrer det ikke arkitekturen,
men det dobler juridisk gjennomgang, oversettelse av vilkår og bemanning av
moderering. Se seksjon 26, punkt 1.

---

## 3. Språk og land

### 3.1 To uavhengige akser

Dette er to forskjellige ting, og den ene skal aldri utledes fra den andre:

| Akse | Format | Styrer |
|---|---|---|
| **Locale** | BCP-47, f.eks. `nb-NO`, `en-GB`, `sv-SE` | Språk i grensesnitt og e-poster, datoformat, tallformat, sortering |
| **Land (marked)** | ISO 3166-1 alpha-2, f.eks. `NO`, `SE` | Hvilke forespørsler du ser, hvilken juridisk tekst som gjelder, hvilken tidssone digesten sendes i, hvilken moderatorgruppe som behandler innholdet, minstealder |

Kombinasjonene er reelle og må fungere:

- En engelsktalende frilanser i Norge: locale `en-GB`, land `NO`.
- En norsktalende som har flyttet til Sverige og vil svare på svenske
  forespørsler: locale `nb-NO`, land `SE`.
- Et land med flere offisielle språk har flere `available_locales` uten at det
  påvirker hvilke forespørsler som distribueres der.

Å utlede land fra språkvalget – eller omvendt – gir feil juridisk tekst eller
feil marked for disse brukerne. Begge lagres eksplisitt på kontoen.

### 3.2 Hva som oversettes

**Oversettes:** grensesnitt, e-postmaler, systemmeldinger, feilmeldinger,
temaliste, statusetiketter, vilkår og personvernerklæring.

**Oversettes aldri:** forespørselens tittel, oppsummering og beskrivelse,
respondentens svar, interne notater og moderatorkommentarer.

Brukerinnhold vises alltid på språket det ble skrevet på. Ingen
maskinoversettelse i v1 – en unøyaktig oversettelse av en kildeforespørsel eller
et svar er en tillitsrisiko, ikke en funksjon.

Forespørselen har et `language`-felt som journalisten setter ved opprettelse.
Det vises som merkelapp på forespørselen og i digesten, slik at en mottaker med
et annet morsmål ser hva hen går til før hen klikker.

### 3.3 Landkonfigurasjon

Et land er en konfigurasjonsrad, ikke kode:

```
country_code            NO
name_key                oversettelsesnøkkel, ikke en visningsstreng
default_locale          nb-NO
available_locales        [nb-NO, en-GB]
timezone                Europe/Oslo
minimum_age             18
digest_send_time        07:00
sender_name_key         oversettelsesnøkkel for From-navn
support_email           kontakt@tjenesten.no
status                  draft | active | paused
```

Å åpne et nytt land krever: konfigurasjonsrad, juridisk gjennomgåtte vilkår og
personvernerklæring i hvert tilgjengelige språk, komplette oversettelser, og
minst én moderator tildelt landet. Ingen utrulling, ingen migrasjon.

Et land i `draft` er usynlig for alle utenom administrator. `paused` stopper nye
registreringer og utsendelser, men beholder data og innlogging.

**Dataresidens:** all lagring skjer innenfor EØS. Et land utenfor EØS krever en
overføringsvurdering før `status` kan settes til `active`. Dette er en port, ikke
en oppgave i v1.

### 3.4 Fallback

**Grensesnitt og e-poster:** forespurt locale → landets `default_locale` →
plattformens standardspråk. En manglende oversettelse skal aldri vises som en
rå nøkkel til sluttbruker. Manglende nøkler logges. CI feiler dersom en nøkkel
brukt i koden mangler i plattformens standardspråk.

**Juridiske tekster faller aldri tilbake.** Finnes ikke vilkår og
personvernerklæring i en gitt locale for et gitt land, er den locale-en ikke
tilgjengelig i det landet. Å vise engelske vilkår til en svensk bruker fordi den
svenske oversettelsen mangler, er ikke et gyldig samtykke.

### 3.5 Formatering

- Alle tekster i ICU MessageFormat. Flertallsformer og kjønn løses av
  formatet, ikke av strengsammensetning i koden. Norsk og engelsk klarer seg med
  naiv logikk; det gjør ikke polsk eller russisk, og valget tas nå.
- Datoer, klokkeslett og tall formateres med `Intl` mot brukerens locale.
- Ingen sammensetning av setninger fra fragmenter. Hver fullstendig setning er
  én nøkkel med parametere.
- Grensesnittet skal tåle 40 % tekstutvidelse uten at layout brytes.
- Høyre-til-venstre-språk er ikke støttet i v1, men CSS-en skal ikke bruke
  retningsavhengige verdier der en logisk egenskap finnes.

### 3.6 Tid

Alle tidspunkter lagres i UTC. Visning skjer i brukerens `timezone` dersom den
er satt, ellers i landets tidssone. Svarfrister vises alltid med tidssone
angitt, slik at en frist ikke misforstås på tvers av markeder.

### 3.7 URL-struktur og søkemotorer

Offentlige sider prefikses med full locale-tag:

```
/nb-NO/foresporsler/:id/soker-personer-som-har-byttet-karriere
/en-GB/requests/:id/looking-for-people-who-changed-careers
```

- Hver locale-variant har `canonical` til seg selv.
- Alle varianter av samme forespørsel lenkes med `hreflang`, pluss `x-default`.
- Slug genereres på forespørselens eget språk og endres aldri etter publisering.
- Rot-URL uten prefiks videresender basert på `Accept-Language` og aktivt land,
  med en synlig språkvelger som overstyrer og huskes.

### 3.8 Landsegmentering er ikke matching

Segmentering på land er markedsinndeling, ikke gjeninnføring av matchingen som
ble kuttet. Innenfor ett land får alle aktive abonnenter fortsatt nøyaktig de
samme forespørslene. Det finnes ingen filtrering på tema, geografi eller språk
innenfor et marked.

En forespørsel tilhører nøyaktig ett land – journalistens. Å publisere den
samme forespørselen i flere markeder er ikke med i v1.

---

## 4. Roller

| Rolle | Kan |
|---|---|
| **Besøkende** | Lese om tjenesten, registrere seg som mottaker, søke om journalistkonto, lese publiserte forespørsler, lese personvernerklæring og vilkår. |
| **Mottaker** | Lese forespørsler, sende svar, trekke eget svar, godkjenne eller avslå kontaktforespørsel, se og korrigere egne opplysninger, bytte språk og land, melde seg av, slette kontoen. |
| **Journalist** | Opprette og redigere utkast, sende til moderering, se egne publiserte forespørsler, lese innsendte svar, merke svar, skrive internt notat, be om videre kontakt, lukke forespørsel, redigere egen profil. |
| **Moderator** | Behandle journalistsøknader, godkjenne/avvise/returnere forespørsler, lukke forespørsler, suspendere brukere, skjule svar ved misbruk, se moderasjonshistorikk – alt begrenset til landene moderatoren er tildelt. |
| **Administrator** | Alt moderator kan, i alle land, pluss: administrere moderatorer og landtildeling, administrere landkonfigurasjon og juridiske dokumentversjoner, se revisjonslogg, kjøre og se status for utsendelser, håndtere innsyns- og sletteforespørsler, konfigurere lagringstid. |

En moderator er tildelt ett eller flere land og ser bare køer og brukere
tilhørende disse. Tildelingen er en praktisk nødvendighet – en moderator kan
ikke vurdere om en forespørsel er saklig formulert på et språk hen ikke leser.

En konto har nøyaktig én rolle. En e-postadresse kan bare ha én konto. Ønsker en
journalist også å motta digesten, må hen bruke en annen adresse i v1.

Moderator og administrator skal ikke lese innholdet i svar uten et tjenstlig
behov. Alle slike oppslag logges med begrunnelse (se 16.2).

---

## 5. Brukerreiser

### 5.1 Journalist

1. Søker om konto: navn, jobb-e-post, stilling, redaksjon, lenke til redaksjon,
   land og språk.
2. Bekrefter e-postadressen.
3. Moderator for det aktuelle landet godkjenner eller avviser manuelt.
   Journalisten varsles på sitt eget språk.
4. Oppretter en forespørsel, velger språk for innholdet, og sender den til
   moderering.
5. Moderator godkjenner. Forespørselen publiseres umiddelbart på egen side.
6. Forespørselen inngår i neste morgens utsendelse i journalistens land.
7. Svar kommer inn. Journalisten leser og merker dem.
8. Journalisten ber utvalgte respondenter om videre kontakt.
9. Respondenten godkjenner. Journalisten får e-postadressen.
10. Dialogen fortsetter utenfor plattformen.
11. Journalisten lukker forespørselen, eller den lukkes automatisk ved frist.

### 5.2 Mottaker

1. Registrerer e-postadresse, velger land og språk, huker av for samtykke,
   vilkår og aldersbekreftelse.
2. Bekrefter adressen via lenke i e-post.
3. Mottar den daglige e-posten kl. 07.00 i sitt lands tidssone, med
   grensesnittstekst på sitt eget språk.
4. Klikker «Les og svar» på en forespørsel.
5. Leser forespørselen, fyller ut svaret.
6. Velger om e-postadressen skal følge svaret. Standard: nei.
7. Bekrefter aktivt hva som deles, og sender.
8. Får kvittering på e-post.
9. Får eventuelt en kontaktforespørsel, og godkjenner eller avslår.
10. Ved godkjenning deles e-postadressen med journalisten.

---

## 6. Autentisering

### 6.1 Innlogging

- Kun e-post og engangslenke (magic link). Ingen passord.
- Lenken er gyldig i 15 minutter og kan brukes én gang.
- Innloggingsmailen sendes på kontoens locale.
- Økt for mottaker og journalist: 30 dager, fornyes ved bruk.
- Økt for moderator og administrator: 12 timer, fornyes ikke automatisk.
- Maks 5 innloggingsforespørsler per e-postadresse per 15 minutter.
- Vellykket innlogging setter `email_verified_at` dersom den er tom.

### 6.2 Tilgang fra digest-lenken

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

### 6.3 Administratorkontoer

Administrator og moderator logger inn med samme magic link-mekanisme, men med
12 timers økt og full logging av alle handlinger.

**Akseptert risiko:** ingen tofaktor i v1. Skal på plass før antallet
administratorkontoer overstiger to, eller før 500 registrerte mottakere.

---

## 7. Registrering

### 7.1 Mottaker

Obligatorisk:
- e-postadresse
- land, valgt eksplisitt fra en liste over aktive land
- språk, valgt fra landets tilgjengelige locales
- aktivt samtykke til å motta den daglige e-posten (ikke forhåndsavkrysset)
- aksept av vilkår og personvernerklæring for valgt land og språk
  (ikke forhåndsavkrysset)
- bekreftelse på at brukeren har fylt landets `minimum_age`
  (ikke forhåndsavkrysset)

Valgfritt:
- visningsnavn

Land og språk forhåndsvelges fra `Accept-Language` og eventuelt et grovt
geografisk hint, men begge feltene vises alltid og kan endres før innsending.
Ingenting avgjøres stille på brukerens vegne.

Endres land eller språk, lastes samtykketekstene på nytt, og avkryssingene
nullstilles. Brukeren skal aldri kunne samtykke til én tekst og bli registrert
mot en annen.

Ingen andre profilfelter samles inn i v1. Alt annet journalisten trenger å vite,
skriver respondenten i selve svaret.

Ny konto får status `pending_email_verification`. Digesten sendes ikke før
adressen er bekreftet. Ubekreftede kontoer slettes automatisk etter 14 dager.

### 7.2 Journalist

Obligatorisk:
- fullt navn
- jobb-e-post
- stilling eller funksjon
- redaksjon eller publiseringssted (tekst)
- lenke til redaksjon eller publiseringstjeneste
- land forespørslene skal publiseres i
- språk for eget grensesnitt
- aksept av journalistvilkår for valgt land og språk

Registreringsskjemaet skal opplyse tydelig at journalistens navn og redaksjon
vises offentlig på forespørselen, men at e-postadressen aldri vises for
mottakere.

Ny journalistkonto får status `pending_email_verification`, deretter
`pending_review` når adressen er bekreftet.

### 7.3 Bytte av land i etterkant

En mottaker kan bytte land i innstillingene. Da skjer følgende i én operasjon:

1. Vilkår og personvernerklæring for det nye landet vises og må aksepteres på
   nytt. Nytt `ConsentRecord` skrives; det gamle markeres som tilbaketrukket.
2. Abonnementet flyttes til det nye landets digest fra neste utsendelse.
3. Allerede innsendte svar blir liggende hos journalistene som mottok dem.
   Dette opplyses i bekreftelsesdialogen.

Nekter brukeren de nye vilkårene, gjennomføres ikke byttet.

En journalist kan ikke bytte land selv. Det krever en ny vurdering av moderator,
fordi godkjenningen er knyttet til et marked.

---

## 8. Godkjenning av journalister

All godkjenning er manuell i v1. Ingen automatiske kontroller.

En moderator tildelt journalistens land vurderer navn, e-postdomene, oppgitt
redaksjon og lenken, og godkjenner eller avviser. Frilansere, studenter,
podkast- og dokumentarprodusenter og uavhengige medier skal kunne godkjennes.

Avvisning skal ha en begrunnelse som sendes til søkeren på søkerens eget språk.
Moderator skriver begrunnelsen i fritekst; den oversettes ikke.

### 8.1 Kontostatus for journalist

**Rettet under autonomt arbeid** (se `NATTLOGG.md`, økt 3): denne seksjonen
beskrev tidligere "pending_review", "approved" og "rejected" som om de var
verdier på samme felt som `pending_email_verification` og `suspended` — men
`User.status` (19.3) er et felles felt for alle roller og har aldri hatt
disse verdiene. Journalistens moderator-vurdering er en egen tilstand, atskilt
fra kontoens grunnleggende tilgang, og lever derfor på `JournalistProfile`
(19.5) som et eget felt: `verification_status`.

**To uavhengige felt, ikke ett:**

```
User.status (felles for alle roller, 19.3):
  pending_email_verification → active → (suspended → active) | deleted

JournalistProfile.verification_status (kun journalist, 19.5):
  pending_review → approved
                 → rejected
```

`verification_status` settes til `pending_review` idet søknaden opprettes
(7.2), uavhengig av om e-posten er bekreftet ennå. Den endres bare av en
moderatorhandling (godkjenn/avvis) — aldri av innloggings- eller
verifiseringsflyten.

| `User.status` | `verification_status` | Kan logge inn | Kan lage utkast | Kan sende til moderering |
|---|---|---|---|---|
| `pending_email_verification` | (uansett) | nei | nei | nei |
| `active` | `pending_review` | ja | ja | nei |
| `active` | `approved` | ja | ja | ja |
| `active` | `rejected` | ja | ja | nei (endelig) |
| `suspended` | (uansett) | nei | – | – |

FR-005 håndhever raden `active` + `approved` — ikke `User.status` alene.

Ved suspensjon (`User.status = suspended`) skjules journalistens publiserte
forespørsler umiddelbart, og åpne kontaktforespørsler kanselleres. Innsendte
svar beholdes, men er ikke tilgjengelige for journalisten. `verification_status`
endres ikke ved suspensjon — oppheves suspensjonen, er journalisten fortsatt
`approved` uten ny moderatorbehandling.

---

## 9. Forespørsel

### 9.1 Felter

| Felt | Krav | Grense |
|---|---|---|
| Tittel | obligatorisk | 120 tegn |
| Kort oppsummering (vises i e-posten) | obligatorisk | 300 tegn |
| Full beskrivelse (inkl. journalistens spørsmål) | obligatorisk | 5 000 tegn |
| Hvem søkes | obligatorisk, fritekst med hjelpetekst som forsvinner ved input | 500 tegn |
| Språk for innholdet | obligatorisk, forhåndsvalgt fra landets `default_locale` | – |
| Tema | valgfritt, ett valg fra fast liste | – |
| Svarfrist | obligatorisk, dato + klokkeslett i landets tidssone, minst 24 t og maks 90 dager frem | – |
| Anonym medvirkning mulig | obligatorisk ja/nei | – |
| Intervju kan bli tatt opp | obligatorisk ja/nei | – |
| Foto eller video kan bli aktuelt | obligatorisk ja/nei | – |
| Geografisk område | valgfritt fritekst, kun visning | 100 tegn |
| Intern referanse | valgfritt, vises kun for journalisten | 100 tegn |

Landet settes fra journalistens konto og kan ikke velges i skjemaet.

Temalisten er et sett faste nøkler i koden, ikke en tabell, og ikke
visningsstrenger: `work`, `economy`, `consumer`, `technology`, `health`,
`family`, `education`, `housing`, `climate`, `politics`, `culture`, `travel`,
`food`, `sport`, `business`, `research`, `law`, `transport`, `life_experience`,
`local`, `other`. Etikettene ligger i oversettelsesfilene. Nøkkelen lagres i
databasen; den oversatte teksten lagres aldri.

Temaet påvirker ingenting i v1 – det lagres for å ha datagrunnlag den dagen
matching innføres.

### 9.2 Status og overganger

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

**Grense på samtidig publiserte forespørsler:** en journalist kan ha maks 5
forespørsler med status `published` samtidig (FR-029). `submit` som ville gitt
et sjette samtidig publisert avvises med en feilmelding som forklarer
hvorfor, og lister hvilke forespørsler journalisten må lukke først. Grensen
er satt lavt bevisst – se 26.1, punkt 5 – og er konfigurasjon, ikke en
hardkodet konstant.

**Påminnelse ved lenge åpne forespørsler:** en publisert forespørsel som
verken er lukket eller utløpt 30 dager etter `published_at`, utløser en
e-post til journalisten («Denne forespørselen har vært åpen lenge», se
seksjon 14) med lenke til å lukke den. Ingen automatisk lukking – en lang
`response_deadline` (opptil 90 dager, 9.1) kan være tilsiktet, og systemet
skal ikke avslutte en sak uten en menneskelig beslutning. Se 26.1, punkt 6,
og jobben `stale-request-reminder` i `INFRASTRUCTURE.md` 5.1.

### 9.3 Moderering

Alle forespørsler skal godkjennes før publisering, av en moderator tildelt
forespørselens land. Moderator kontrollerer:

- at forespørselen har et legitimt journalistisk formål
- at tittel og beskrivelse er forståelige
- at fristen er realistisk
- at det ikke bes om flere personopplysninger enn nødvendig
- at diskriminerende kriterier ikke brukes uten saklig begrunnelse
- at den ikke er markedsundersøkelse, salg eller rekruttering
- at den ikke brukes til trakassering eller uthenging
- at den ikke bryter vilkårene i det aktuelle landet
- at oppgitt innholdsspråk stemmer med teksten

**Særlige kategorier personopplysninger:** forespørsler som ber respondenten
oppgi opplysninger om helse, religion, politisk oppfatning, seksuelle forhold,
etnisitet eller fagforeningsmedlemskap **avvises i v1.** Moderator bruker en
standardbegrunnelse. Dette er et bevisst valg: en forsvarlig behandling av
særlige kategorier krever en samtykke- og informasjonsflyt som ikke bygges nå.

Moderator kan ikke redigere journalistens tekst. Moderator kan godkjenne,
avvise eller returnere med kommentar. Alle handlinger logges.

---

## 10. Daglig utsendelse

### 10.1 Jobben

Kjøres for hvert aktivt land på landets `digest_send_time` i landets tidssone.
Landene behandles uavhengig; feil i ett land stopper ikke de andre.

1. Finn alle forespørsler i landet med status `published` og
   `included_in_digest_at IS NULL`.
2. Er listen tom, avbryt uten å sende for dette landet.
3. Finn hvilke locales som faktisk er i bruk blant landets aktive abonnenter.
4. Bygg én innholdsvariant per locale i bruk. Forespørslenes egen tekst er
   identisk i alle variantene; bare rammen rundt oversettes.
5. Opprett en `Digest`-rad for landet med forespørslene.
6. Send til alle brukere med rolle `recipient`, riktig land, status `active` og
   abonnement `active`. Hver mottaker får varianten for sin locale.
7. Lagre én `DigestDelivery` per mottaker, med hvilken locale som ble brukt.
8. Sett `included_in_digest_at` på forespørslene.
9. Behandle bounce- og klage-webhooks fortløpende, ikke synkront i jobben.

Antall renderinger er antall locales i bruk i landet – typisk én, i praksis
sjelden mer enn tre. Det er ikke per mottaker.

Fordi hver forespørsel får `included_in_digest_at` satt ved første utsendelse,
kan den aldri havne i to digester. Kravet om at samme forespørsel bare sendes én
gang, er dermed en konsekvens av datamodellen og ikke en regel som må håndheves.

En forespørsel publisert etter utsendelsestidspunktet kommer med neste morgen.
Siden er tilgjengelig og kan besvares fra publiseringsøyeblikket.

### 10.2 Innhold

- dato, formatert for mottakerens locale
- antall nye forespørsler
- kort introduksjon
- per forespørsel: tittel, kort oppsummering, redaksjon, svarfrist med tidssone,
  eventuelt geografisk område, språkmerkelapp dersom forespørselens språk
  avviker fra mottakerens, knapp «Les og svar»
- avmeldingslenke

Forespørslene listes kronologisk. Ingen gruppering.

Full beskrivelse tas ikke med i e-posten.

Alle e-poster sendes i både HTML og ren tekst, med `lang`-attributt satt på
HTML-varianten.

### 10.3 Bounce, klager og avmelding

- Hard bounce: adressen settes til `bounced` og får ingen flere utsendelser.
- Spam-klage: abonnementet settes til `unsubscribed` umiddelbart.
- Tre myke bounces på rad behandles som hard bounce.
- Avmeldingslenken virker uten innlogging, med ett klikk, via en tilbakekallbar
  token, og siden vises på mottakerens locale.
- Alle bulkutsendelser sender `List-Unsubscribe` og `List-Unsubscribe-Post`.
- Avmeldte adresser beholdes hashet på en sperreliste, slik at de ikke kan
  registreres inn igjen ved en feil.

### 10.4 Avsenderoppsett

SPF, DKIM og DMARC skal være konfigurert før første utsendelse. Bulkutsendelser
går fra eget subdomene, atskilt fra konto- og sikkerhetsmeldinger:

```
utsendelse@epost.tjenesten.no    daglig digest
varsler@tjenesten.no             transaksjonelle varsler
```

**Ett avsenderdomene for alle land.** From-navnet lokaliseres per land og språk
via `sender_name_key`, og `Reply-To` settes til landets `support_email`. Å gi
hvert land sitt eget avsenderdomene fragmenterer omdømmet og krever ny
oppvarming per marked – det er feil vei å gå for et lite volum.

Avsenderdomenet varmes opp gradvis. Leveringsgrad og klagerate overvåkes per
land fra første utsendelse, siden et enkelt marked kan ødelegge omdømmet for
alle.

---

## 11. Forespørselsside

Hver publisert forespørsel får en offentlig side per tilgjengelig locale i
landet:

```
/nb-NO/foresporsler/:id/soker-personer-som-har-byttet-karriere
```

Siden viser tittel, redaksjon, journalistens navn, publiseringsdato, svarfrist
med tidssone, kort oppsummering, full beskrivelse, hvem som søkes, informasjon
om anonymitet og opptak, status, knapp for å svare, og en lenke for å rapportere
forespørselen.

Forespørselens egen tekst vises alltid uendret. Er innholdsspråket et annet enn
sidens locale, vises en nøytral merkelapp om hvilket språk teksten er på. Ingen
oversettelsestilbud.

Journalistens e-postadresse vises aldri.

Siden er offentlig lesbar uten innlogging og har Open Graph-metadata, kanonisk
URL per locale-variant, `hreflang`-alternater og delingsbilde. Innsending av
svar krever verifisert konto.

Er forespørselen `closed` eller `expired`, vises innholdet fortsatt, men med
tydelig merking og uten svarknapp.

Svar, mottakerprofiler og journalistportalen skal aldri indekseres. `noindex` på
alt utenfor de offentlige forespørselssidene og informasjonssidene.

---

## 12. Svar

### 12.1 Skjema

| Felt | Krav | Grense |
|---|---|---|
| Hvorfor er du relevant? | obligatorisk, fritekst med eksempeltekst | 2 000 tegn |
| Svar på journalistens spørsmål | obligatorisk, fritekst med eksempeltekst | 4 000 tegn |
| Kort presentasjon av deg selv | valgfritt | 500 tegn |
| Visningsnavn | valgfritt, forhåndsutfylt fra kontoen | 80 tegn |

Er visningsnavn tomt, vises svaret for journalisten som «Anonym respondent» –
på journalistens språk, ikke respondentens.

Skjemaet vises på respondentens locale. Svarene lagres som skrevet, uten
språkmerking; journalisten ser hvilket språk teksten er på ved å lese den.

Ingen utkast. Ett svar per person per forespørsel, håndhevet med unik indeks.

### 12.2 Deling av kontaktopplysninger

Respondenten velger:

1. **Ikke del e-postadressen min ennå** *(standard)* – journalisten kan be om
   kontakt gjennom plattformen.
2. **Del e-postadressen min med journalisten** – adressen følger svaret.

### 12.3 Bekreftelse før innsending

Før svaret sendes, vises en bekreftelsesskjerm med:

- hvilken journalist som mottar svaret, og hvilken redaksjon hen har oppgitt
- nøyaktig hvilke opplysninger som deles, gitt valget i 12.2
- at svaret kan bli sitert
- at innsending ikke garanterer kontakt eller publisering
- at journalisten har et selvstendig ansvar for journalistisk behandling
- at plattformen kontrollerer at journalisten er en reell person i en oppgitt
  redaksjon, men ikke kan garantere hvordan hen opptrer, og at man ikke bør dele
  mer enn man er komfortabel med
- at opplysninger som allerede er sendt, ikke kan trekkes tilbake fra
  journalisten, selv om svaret trekkes fra plattformen

Respondenten må aktivt bekrefte. Ingen forhåndsavkryssing.

Denne teksten er juridisk relevant og skal gjennomgås av jurist i hvert språk
den tilbys på. Den faller ikke tilbake til et annet språk – mangler den, kan
ikke locale-en tilbys i landet.

### 12.4 Trekking

Respondenten kan trekke svaret så lenge forespørselen er åpen. Trukket svar
skjules umiddelbart for journalisten, og åpne kontaktforespørsler knyttet til
det kanselleres. Journalisten varsles ikke særskilt.

Svar kan ikke redigeres etter innsending. Ønsker respondenten å endre, må hen
trekke svaret og sende et nytt.

### 12.5 Rapportering

Både forespørsler og svar kan rapporteres via et enkelt skjema som sender
e-post til moderatorene for det aktuelle landet. Ingen egen datamodell i v1.
Moderator handler manuelt og logger tiltaket i revisjonsloggen.

Tiltak moderator kan sette i verk: lukke forespørselen, skjule et svar,
suspendere kontoen, sperre e-postadressen.

### 12.6 Respondentens oversikt over egne svar

Lagt til under autonomt arbeid (økt 7, se NATTLOGG.md) — et reelt hull mellom
spec og kode, ikke en ny beslutning: `GET /responses/mine` (seksjon 20) og
fire status-oversettelser (`response.status.submitted/viewed/
contact_requested/not_selected`, satt opp allerede i økt 1) forutsatte
tydelig at denne siden skulle finnes, men ingen del av spec-en beskrev
innholdet.

En innlogget mottaker kan se en liste over sine egne innsendte svar, med per
svar: forespørselens tittel, redaksjonen som mottok det, innsendingstidspunkt,
og én utledet status – ikke råe databasefelter:

```
sendt              → standard, ingen av det under gjelder ennå
sett av journalisten → viewed_at er satt
forespørsel om videre kontakt → en kontaktforespørsel (14) finnes for svaret
ikke valgt         → journalistens markering (13) er not_selected
```

Rekkefølgen over er prioriteringsrekkefølgen når flere er sanne samtidig
(f.eks. et sett OG ikke valgt svar viser «ikke valgt», som er den mest
informative av de to for respondenten).

Herfra kan respondenten trekke et svar (12.4) så lenge forespørselen
fortsatt er åpen — knappen vises, men et forsøk mot en lukket/utløpt
forespørsel avvises av samme regel som allerede håndheves server-side.

Ingen filtrering, sortering eller søk i v1 – samme begrunnelse som 13
("volumet forsvarer det ikke").

---

## 13. Journalistens svarinnboks

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

## 14. Videre kontakt

### 14.1 Kontaktforespørsel

Har respondenten ikke delt e-postadressen, kan journalisten sende én
kontaktforespørsel per svar. Journalisten oppgir en kort melding (maks 1 000
tegn) og hvilken kontaktform hen ønsker.

Meldingen sendes uendret. Rammen rundt – e-postmalen, knappene, forklaringen av
hva det innebærer å godkjenne – vises på respondentens locale.

### 14.2 Respondentens svar

Respondenten godkjenner eller avslår. Ved godkjenning deles e-postadressen, og
journalisten varsles. Ved avslag varsles journalisten uten begrunnelse.

Ingen motforslag, ingen oppfølgingsmeldinger, ingen strukturert dialog i v1.
Etter godkjenning fortsetter kontakten på e-post utenfor plattformen.

Kontaktforespørselen utløper automatisk etter 14 dager uten svar, eller når
forespørselen lukkes.

### 14.3 Status

```
pending → approved
        → declined
        → expired    (14 dager, eller forespørselen lukkes)
        → cancelled  (svaret trekkes, eller journalisten suspenderes)
```

`ContactRequest.status` er eneste kilde for kontaktflytens tilstand. Svarets
egen markering og livssyklus holdes adskilt fra denne (se 19.5).

All deling av kontaktopplysninger logges i revisjonsloggen med tidspunkt,
hvilken journalist som fikk tilgang og hvilket samtykke som lå til grunn.

---

## 15. E-postmaler

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
| Forespørsel har vært åpen lenge (30 dager) | journalist |
| Forespørsel lukket | journalist |
| Dagens forespørsler (digest) | mottaker |
| Kvittering på innsendt svar | mottaker |
| Forespørsel om videre kontakt | mottaker |
| Forespørsel du har svart på er lukket | mottaker |
| Bekreft kontosletting (lenke) | begge |
| Kontosletting bekreftet | begge |
| Kontaktforespørsel kansellert (respondentens konto slettet) | journalist |
| Vesentlig endring i vilkår eller personvernerklæring | mottaker |
| Ny forespørsel til moderering | moderator |
| Innhold rapportert (forespørsel eller svar) | moderator |

De tre siste radene er lagt til under autonomt arbeid (økt 7, se
`NATTLOGG.md`), som del av å bygge `DELETE /me` (17.5) og `POST /report`
(12.5). "Kontosletting bekreftet" gjelder nå begge roller, ikke bare
mottaker — en journalistkonto kan også slettes (17.5, siste avsnitt).
Bekreftelseslenken er en egen mal, adskilt fra den vanlige innloggingslenken,
fordi den utløser en irreversibel handling og bør si det tydelig i teksten
(24.3: "særlig sensitive handlinger skal kreve ny autentisering"). "Innhold
rapportert" manglet i denne tabellen selv om 12.5 og 20 begge forutsetter at
den finnes ("sender e-post til moderatorene for det aktuelle landet") — et
reelt hull mellom to deler av spec-en, ikke en ny beslutning.

Alle maler finnes i HTML og ren tekst, i alle aktive locales, og sendes på
mottakerens locale. Alle skal fungere med skjermleser.

En mal som mangler i en locale, faller tilbake etter kjeden i 3.4 – med unntak
av maler som gjengir juridisk tekst, som ikke sendes før oversettelsen finnes.

---

## 16. Administrasjonsgrensesnitt

### 16.1 Dashboard

Filtrert på moderatorens tildelte land, med landvelger for administrator:
journalistsøknader til behandling, forespørsler i modereringskø, aktive
forespørsler, forespørsler som utløper innen 48 timer, status for siste
utsendelse per land med antall feilede leveranser, nye mottakere siste 7 dager,
avmeldinger siste 7 dager.

### 16.2 Funksjoner

- **Journalister:** søk, se søknadsgrunnlag, godkjenn, avvis, suspender,
  opphev suspensjon, se tidligere forespørsler.
- **Forespørsler:** modereringskø, forhåndsvisning, godkjenn, avvis, returner
  med kommentar, lukk.
- **Mottakere:** søk på e-postadresse, se kontostatus og samtykkehistorikk,
  gjennomfør sletting, suspender ved misbruk.
- **Utsendelser:** se siste digester per land, antall sendt, bounces, klager,
  kjør på nytt ved feil.
- **Land (kun administrator):** opprette og redigere landkonfigurasjon, sette
  status, tildele moderatorer, publisere nye versjoner av juridiske dokumenter.

Åpning av et enkeltsvar fra administrasjonsgrensesnittet krever at
administratoren velger en begrunnelse fra en liste. Oppslaget logges med
begrunnelsen. Det finnes ingen visning som lister svar på tvers av
forespørsler.

Listen over gyldige begrunnelser (lagt til under autonomt arbeid, økt 7, se
`NATTLOGG.md` — FR-051 og `GET /admin/responses/:id` i seksjon 20
forutsatte begge en slik liste, men ingen konkrete verdier var oppgitt noe
sted i spec-en):

```
user_support_request           brukerhenvendelse (mottaker eller journalist
                                ber om hjelp med et konkret svar)
abuse_report_investigation      undersøker en rapport mottatt via /report
                                eller på annen måte
legal_or_regulatory_request     juridisk eller regulatorisk pålegg
security_incident               undersøker en sikkerhetshendelse
```

Fritekstbegrunnelser (som ved avvisning av en forespørsel, 9.2) er noe ANNET
enn dette — der beskriver moderator SITT resonnement i egne ord. Her velges
en av disse fire ferdige kategoriene, nettopp fordi et enkeltsvar er
respondentens mest sensitive innhold, og en lukket liste gjør det mulig å
revidere ALLE oppslag av en gitt kategori i etterkant (f.eks. "vis alle
oppslag begrunnet med `security_incident` siste kvartal").

---

## 17. Personvern

### 17.1 Behandlingsgrunnlag

- **Samtykke:** abonnement på den daglige e-posten.
- **Avtale:** levering av brukerkonto og de funksjonene brukeren ber om.
- **Berettiget interesse:** sikkerhet, misbruksforebygging, revisjonslogg.

En juridisk gjennomgang skal gjøres per land før det settes til `active`. GDPR
gjelder likt i hele EØS, men markedsførings- og forbrukerlovgivning, krav til
samtykketekst og minstealder varierer. Særlige kategorier personopplysninger
behandles ikke i v1 (se 9.3).

### 17.2 Juridiske dokumenter og samtykkelogg

Vilkår og personvernerklæring versjoneres per **land og språk**. Hver versjon
lagres med publiseringstidspunkt og beholdes uendret så lenge det finnes et
samtykke som viser til den.

Ved hvert samtykke lagres: bruker-ID, samtykketype, hvilket dokument og hvilken
versjon i hvilket land og språk, tidspunkt, kilde, og eventuelt tidspunkt for
tilbaketrekking.

Det skal alltid kunne dokumenteres nøyaktig hvilken tekst en gitt bruker godtok,
på hvilket språk, i hvilket land, på hvilket tidspunkt.

Ved vesentlig endring i et dokument varsles alle berørte brukere i det landet på
sitt eget språk, og et nytt samtykke innhentes der endringen krever det.

### 17.3 Brukerens rettigheter

Selvbetjent i v1: se egne opplysninger, korrigere visningsnavn, bytte språk og
land, trekke et innsendt svar, melde seg av, slette kontoen.

Manuelt i v1: nedlasting av egne data og innsyn. Forespørsler sendes til
kontaktadressen i personvernerklæringen og besvares innen 30 dager.
Administrator har en dokumentert rutine for uttrekket. En selvbetjent eksport
bygges når volumet krever det.

### 17.4 Lagringstid

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
| Juridiske dokumentversjoner | Så lenge et samtykke viser til dem |

Alle lagringstider settes som konfigurasjon per land, ikke som konstanter i
forretningslogikken, slik at et marked med avvikende krav kan justeres uten
kodeendring. Retensjonsjobben kjører daglig.

Automatisk sletting ved inaktivitet er ikke med i v1, men er en forutsetning
for punktet «aktiv konto» over og må på plass innen 18 måneder etter lansering.

### 17.5 Sletting

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
uttrykkelig i personvernerklæringen og på slettebekreftelsen, i hvert språk.

Slettes en journalistkonto, lukkes åpne forespørsler, respondentene varsles, og
svarene følger den ordinære retensjonsfristen.

---

## 18. Sikkerhet

- HTTPS overalt, HSTS.
- Rollebasert tilgangskontroll håndhevet i backend, ikke i frontend.
  Moderatorens landtildeling håndheves i samme lag som rollen.
- Rate limiting: 5 innloggingsforespørsler per adresse per 15 min, 10
  svarinnsendinger per konto per time, 20 forespørselsopprettelser per
  journalist per døgn.
- CSRF-beskyttelse på alle tilstandsendrende endepunkter.
- Parametriserte spørringer. Output escapes. Content Security Policy.
- Oversettelsesstrenger behandles som data, ikke som markup. Interpolerte
  verdier escapes uavhengig av språk.
- Tokens lagres hashet. Ingen personopplysninger i URL-er.
- Databasen krypteres i hvile. Hemmeligheter i secret manager, ikke i miljøfiler
  i repoet.
- Daglig sikkerhetskopi. RPO 24 timer, RTO 8 timer. Gjenoppretting testes før
  lansering.
- Revisjonslogg på alle administrative handlinger og all deling av
  kontaktopplysninger.

### 18.1 Hvem kan lese et svar

Kun respondenten selv, journalisten som eier forespørselen, og en moderator
eller administrator med registrert begrunnelse og tildeling til svarets land.
Ingen andre. Ingen teamdeling i v1.

---

## 19. Datamodell

Seksten tabeller (`Digest` og `DigestDelivery` telles hver for seg;
`AuthToken` og `Session` lagt til i 19.14–19.15 under autonomt arbeid, se
`NATTLOGG.md`). `RecipientProfile`, `Organization`, `Category`,
`UserInterest`, `RequestCategory`, `RequestQuestion`, `ResponseAnswer` og
`Attachment` finnes ikke i v1.

### 19.1 Country

```
code                        PK, ISO 3166-1 alpha-2
name_key
default_locale
available_locales           array av BCP-47-tagger
timezone                    IANA-navn
minimum_age
digest_send_time
sender_name_key
support_email
status                      draft | active | paused
created_at
updated_at
```

### 19.2 LegalDocument

```
id
country_code
locale
document_type               terms | privacy | journalist_terms
version                     semantisk, monotont økende per (land, type)
body                        eller referanse til versjonert fil i repoet
is_material_change          styrer om nytt samtykke må innhentes
published_at
created_at
```

Unik indeks på `(country_code, locale, document_type, version)`.

### 19.3 User

```
id
email                       unik
email_hash                  settes ved anonymisering
email_verified_at
role                        recipient | journalist | moderator | admin
status                      pending_email_verification | active | suspended | deleted
country_code                FK Country
locale                      BCP-47
timezone                    nullable, arver landets tidssone når tom
display_name                nullable
created_at
updated_at
last_login_at
deleted_at
```

### 19.4 ModeratorCountry

```
moderator_user_id
country_code
created_at
```

Sammensatt primærnøkkel. Administrator trenger ingen rader her – rollen gir
tilgang til alle land.

### 19.5 JournalistProfile

```
id
user_id                     unik
full_name
job_title
organization_name
organization_url
verification_status         pending_review | approved | rejected — se 8.1,
                             lagt til under autonomt arbeid (NATTLOGG.md)
reviewed_by                 nullable
reviewed_at                 nullable
review_note                 nullable, kun synlig for moderator
created_at
updated_at
```

Journalistens land ligger på `User.country_code`. `verification_status` er
atskilt fra `User.status` med hensikt — se 8.1 for begrunnelsen.

### 19.6 Request

```
id
journalist_id
country_code                FK Country, kopiert fra journalisten ved opprettelse
content_language            BCP-47, språket teksten er skrevet på – settes
                             ved opprettelse (landets default_locale), derfor
                             ALDRI tom, selv i draft
slug                        nullable inntil title finnes – se merknad under
title                       nullable inntil innsending – se merknad under
summary                     nullable inntil innsending
description                 nullable inntil innsending
target_person_description   nullable inntil innsending
topic                       nullable, fast nøkkel – aldri en visningsstreng
geographic_note             nullable
internal_reference          nullable
response_deadline           nullable inntil innsending, UTC når satt
status                      draft | submitted | changes_requested | published
                            | closed | expired | rejected | deleted
allows_anonymous_participation   nullable inntil innsending (boolsk – kan
                                 IKKE default til false, se merknad)
may_be_recorded                  nullable inntil innsending
may_involve_photo_video           nullable inntil innsending
moderator_comment            nullable
moderated_by                 nullable
moderated_at                 nullable
published_at                 nullable
included_in_digest_at        nullable
closed_at                    nullable, settes ved både closed og expired
deadline_reminder_sent_at    nullable – lagt til i økt 2 (NATTLOGG.md)
stale_reminder_sent_at       nullable – lagt til i økt 2 (NATTLOGG.md)
created_at
updated_at
```

De to `_sent_at`-feltene ble lagt til under autonomt arbeid: uten dem ville
`deadline-reminder` og `stale-request-reminder` (`INFRASTRUCTURE.md` 5.1)
sendt samme påminnelse på nytt ved hver jobbkjøring innenfor sitt tidsvindu,
ikke bare én gang.

**Rettet under autonomt arbeid** (økt 6, se `NATTLOGG.md`): denne tabellen
merket tidligere `title`, `summary`, `description`,
`target_person_description`, `response_deadline`,
`allows_anonymous_participation`, `may_be_recorded` og
`may_involve_photo_video` som om de var obligatoriske på databasenivå — men
FR-020 krever eksplisitt at "Journalisten skal kunne lagre en forespørsel som
`draft` uten at obligatoriske felter er utfylt." En databasekolonne kan ikke
være både `NOT NULL` og tillate at feltet mangler i draft; de to kravene
motsa hverandre direkte. Løsningen er at "obligatorisk" i 9.1 betyr
obligatorisk **for å sende til moderering** (FR-021, håndhevet i
applikasjonslaget ved `draft → submitted`), ikke obligatorisk i databasen fra
opprettelsen. Alle åtte feltene er derfor nullable i skjemaet.

De tre boolske feltene (`allows_anonymous_participation` m.fl.) kan av samme
grunn ikke ha en `NOT NULL DEFAULT false` — en uutfylt boolsk verdi i et
utkast er reelt "ikke besvart ennå", ikke "nei", og å la databasen stille
anta `false` ville skjult at journalisten aldri tok stilling. `slug`
genereres første gang `title` finnes (ved lagring av utkast eller ved
innsending), og regenereres ikke etter publisering (11: "slug … endres aldri
etter publisering").

`country_code` kopieres bevisst i stedet for å utledes fra journalisten, slik at
en senere endring av journalistens marked ikke flytter historiske forespørsler.

**Rettet under autonomt arbeid** (økt 7, se `NATTLOGG.md`): enumet hadde
tidligere også en `approved`-verdi, ment som en mellomtilstand for
moderatorens handling ("settes og forlates i samme transaksjon som
publisering. Alternativt kan den sløyfes helt – avgjøres ved
implementering"). Implementeringen (`publishRequest()`,
`src/lib/moderation/requests.ts`) valgte alternativet — `submitted →
published` er én direkte overgang, `approved` ble aldri satt eller lest
noe sted. Verdien lå likevel igjen i enumet, ubrukt. Fjernet fra enumet
her siden implementeringsvalget nå er endelig gjort, ikke lenger åpent.

### 19.7 Response

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

### 19.8 ContactRequest

```
id
response_id                 unik, NULLABLE – se merknad under
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

**Rettet under autonomt arbeid** (økt 6, se `NATTLOGG.md`): `response_id` var
opprinnelig `NOT NULL`, men 12.4 og 17.4 krever at selve svaret slettes
umiddelbart ved trekking ("Trukket svar: Slettes umiddelbart"), mens
`ContactRequest` har sin egen, uavhengige retensjonstid (12 måneder etter
avslutning, 17.4) — en allerede besvart eller avslått kontaktforespørsel skal
altså kunne overleve at det tilhørende svaret er slettet. En `NOT NULL`
fremmednøkkel mot en rad som skal kunne slettes før den selv slettes, er en
selvmotsigelse. Løsningen: `response_id` er nullable, og nulles ut (ikke hele
raden slettet) i det svaret trekkes — status endres til `cancelled` bare
dersom kontaktforespørselen fortsatt var `pending`; allerede avgjorte
kontaktforespørsler ({`approved`, `declined`, `expired`) beholder sin status
uendret, bare koblingen til det (nå slettede) svaret fjernes.

### 19.9 EmailSubscription

```
id
user_id                     unik
status                      active | unsubscribed | bounced
unsubscribe_token_hash
unsubscribed_at             nullable
last_digest_at              nullable
consecutive_soft_bounces    heltall, default 0 – se 10.3
created_at
updated_at
```

Landet ligger på brukeren. Byttes land, følger abonnementet med uten at raden
opprettes på nytt.

`consecutive_soft_bounces` er lagt til under autonomt arbeid (økt 7, se
`NATTLOGG.md`) — 10.3 krever at "tre myke bounces på rad behandles som hard
bounce", men datamodellen hadde ingen måte å telle dem på. Nullstilles ved
enhver vellykket levering eller hard bounce/klage (som allerede har satt
kontoen til `bounced`/`unsubscribed` og dermed avslutter rekken uansett).

### 19.10 Digest og DigestDelivery

```
Digest
id
country_code
scheduled_for
request_ids                 array
recipient_count
status                      pending | sending | sent | failed
sent_at

DigestDelivery
id
digest_id
user_id
locale                      hvilken variant mottakeren faktisk fikk
access_token_hash
provider_message_id         nullable
status                      queued | sent | delivered | bounced | complained | failed
error_message               nullable
created_at
updated_at
```

### 19.11 ConsentRecord

```
id
user_id
consent_type                terms | privacy | journalist_terms
                            | email_subscription | minimum_age
legal_document_id           nullable – null for samtykker uten dokument
country_code
locale
granted                     boolean
granted_at
withdrawn_at                nullable
source                      registration_form | settings_page | unsubscribe_link
                            | country_change | document_update
created_at
```

### 19.12 AuditLog

```
id
actor_type                  user | system | job
actor_user_id               nullable – null for system og job
country_code                nullable, for filtrering av moderatorhandlinger
action
entity_type
entity_id
reason                      nullable, obligatorisk ved oppslag i svar
metadata                    jsonb, aldri fullstendige svar eller unødvendige
                            personopplysninger
ip_address                  nullable
created_at
```

### 19.13 Suppression

```
id
email_hash                  unik
reason                      unsubscribed | hard_bounce | complaint | manual
created_at
```

Sperrelisten er global på tvers av land. En adresse som har klaget i ett marked,
skal ikke motta e-post fra et annet.

### 19.14 AuthToken

Lagt til under autonomt arbeid (se `NATTLOGG.md`, økt 2): seksjon 6
beskriver magic link-innlogging i detalj, men datamodellen definerte aldri
hvor selve engangstokenet lagres. Uten denne tabellen er 6.1 uimplementerbar.

```
id
user_id                     FK User
token_hash                  unik – aldri rå token, jf. 24.3
purpose                     login | delete_account | data_export
                            (24.3: "særlig sensitive handlinger skal kreve
                            ny autentisering" – samme mekanisme, annet formål)
expires_at                  15 minutter fra utstedelse (8.1)
used_at                     nullable – tokenet er engangsbruk
created_at
```

### 19.15 Session

Samme begrunnelse som 19.14 – 8.1 og 8.3 forutsetter øktlevetid uten at en
økt-entitet noensinne ble definert.

```
id
user_id                     FK User
token_hash                  unik – aldri rå token i cookie ukryptert/usignert
expires_at                  30 dager (mottaker/journalist) eller 12 timer
                            (moderator/administrator), fra 8.1/8.3
last_used_at                fornyer IKKE expires_at automatisk for
                            moderator/administrator (8.3: "fornyes ikke
                            automatisk")
revoked_at                  nullable – satt ved eksplisitt utlogging,
                            kontosletting eller suspensjon
created_at
```

Unik indeks på `token_hash`. En utløpt eller tilbakekalt økt skal behandles
likt av applikasjonslaget – begge betyr "ikke innlogget", ikke to ulike
feilveier.

---

## 20. API

Alle endepunkter tar `Accept-Language`. Feilmeldinger returneres som
oversettelsesnøkkel med parametere, aldri som ferdig formatert setning – klienten
formaterer.

```
GET    /countries                   aktive land med tilgjengelige locales
GET    /legal/:country/:locale/:type   gjeldende versjon av et dokument

POST   /auth/request-link
POST   /auth/verify
POST   /auth/logout

GET    /me
PATCH  /me                          visningsnavn, locale, timezone
POST   /me/change-country           krever aksept av nye vilkår
DELETE /me                          krever fersk innlogging

POST   /unsubscribe/:token          uten innlogging, ett klikk
POST   /subscribe                   registrering som mottaker
POST   /webhooks/email-events       bounce/klage fra e-postleverandøren, se 10.3

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
POST   /admin/users/:id/unsuspend
GET    /admin/moderation/requests
POST   /admin/requests/:id/publish
POST   /admin/requests/:id/reject
POST   /admin/requests/:id/request-changes
POST   /admin/requests/:id/close
GET    /admin/digests
POST   /admin/digests/:id/retry

GET    /admin/countries
POST   /admin/countries
PATCH  /admin/countries/:code
POST   /admin/countries/:code/moderators
POST   /admin/legal-documents

GET    /admin/responses/:id?reason=...   krever begrunnelse fra listen i 16.2
```

Administrative listeendepunkter filtreres automatisk på innlogget moderators
tildelte land. Filtreringen skjer i spørringen, ikke i responsen.

`POST /admin/users/:id/unsuspend` er lagt til under autonomt arbeid (økt 7,
se `NATTLOGG.md`) — 8.1s tilstandsdiagram viser eksplisitt
`suspended → active`, og 16.2 lister "opphev suspensjon" som en egen
moderatorhandling for journalister, men ruten manglet i denne listen. Et
reelt hull mellom to deler av spec-en, ikke en ny beslutning.

`POST /webhooks/email-events` er lagt til av samme grunn (økt 7): 10.1
punkt 9 ("behandle bounce- og klage-webhooks fortløpende") og FR-037
("Test: simulert webhook") forutsetter begge at et slikt endepunkt finnes,
men det manglet i denne listen. Ingen innlogging (kalles av
e-postleverandøren, ikke en bruker) — beskyttet i stedet av en delt
hemmelighet, se `src/lib/subscriptions/email-events.ts`.

`GET /admin/responses/:id` er lagt til av samme grunn (økt 7): FR-051 og
16.2 ("åpning av et enkeltsvar ... krever ... begrunnelse ... logges")
forutsetter begge et slikt endepunkt, men verken ruten eller en konkret
begrunnelsesliste fantes noe sted i spec-en. Se 16.2 for listen.

---

## 21. Ikke-funksjonelle krav

### 21.1 Ytelse

- p95 sidelast under 2 sekunder ved inntil 50 samtidige økter.
- Digest-jobben skal levere til 10 000 mottakere per land innen 30 minutter fra
  landets utsendelsestidspunkt, og skal kjøre i jobbkø uten å blokkere
  webtrafikk. Land kjører uavhengig av hverandre.
- 99,5 % oppetid målt månedlig.

Tallene er dimensjonert for lansering. Revurderes ved 5 000 mottakere i ett land
eller tre aktive land.

### 21.2 Tilgjengelighet

WCAG 2.2 AA. Alle sentrale handlinger skal kunne utføres med tastatur. Skjemaer
skal ha tydelige, tekstlige feilmeldinger knyttet til riktig felt. Farge skal
aldri være eneste statusindikator. E-postene skal fungere med skjermleser.

`lang`-attributt skal settes korrekt på dokumentnivå, og på elementnivå der
innhold har et annet språk enn siden – ellers leser skjermleseren en norsk
forespørsel med engelsk uttale.

### 21.3 Internasjonalisering

- Ingen brukervendt streng i kildekoden. CI feiler ved funn.
- Alle strenger i ICU MessageFormat, med flertallsformer der det er relevant.
- Ingen setninger satt sammen av fragmenter.
- Grensesnittet tåler 40 % tekstutvidelse uten brutt layout.
- Nye nøkler uten oversettelse i plattformens standardspråk feiler i CI;
  manglende oversettelse i andre språk gir advarsel og fallback.
- Alle datoer, klokkeslett, tall og lister formateres med `Intl`.
- Alle tidspunkter lagres i UTC.
- Sortering av tekst bruker locale-aware collation, ikke byte-sammenligning.
- Ett fullstendig oversatt tilleggsspråk skal finnes i test før lansering, selv
  om det ikke aktiveres. Ellers er i18n-en ikke verifisert.

### 21.4 Øvrig

- Mottakerflyten skal være fullt mobiltilpasset. Journalist- og
  administrasjonsflatene skal fungere på mobil, men optimaliseres for desktop.
- Siste to hovedversjoner av Chrome, Safari, Firefox og Edge.
- Det visuelle uttrykket skal kunne byttes uten å endre komponentkode.
  Krav og akseptansekriterier står i `DESIGN.md`.
- Alle komponenter i kjøretidsmiljøet skal ligge innenfor EØS.
  Leverandørvalg og begrunnelser står i `INFRASTRUCTURE.md`.

### 21.5 Analyse

Kun aggregert måling, brutt ned per land: antall aktive mottakere, nye per uke,
avmeldingsrate, antall publiserte forespørsler, andel med minst ett svar,
gjennomsnittlig antall svar, andel som fører til godkjent kontakt,
modereringstid, bounce- og klagerate.

Ingen åpningssporing, ingen tredjepartssporing, ingen annonsepiksler, ingen
session replay. `DigestDelivery` har derfor verken `opened_at` eller
`clicked_at`.

---

## 22. Funksjonelle krav

Hvert krav har et akseptansekriterium som kan verifiseres direkte.

### Registrering og konto

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-001 | Systemet skal opprette en mottakerkonto med status `pending_email_verification` når skjemaet i 7.1 sendes med alle tre samtykkene avkrysset. | Test: innsending uten ett av samtykkene avvises. |
| FR-002 | Systemet skal ikke ta imot svar fra en konto uten `email_verified_at`. | Test: innsending fra ubekreftet konto returnerer 403. |
| FR-003 | Systemet skal sette abonnementet til `unsubscribed` ved ett kall til `/unsubscribe/:token`, uten innlogging og uten videre bekreftelse. | Test: ett POST-kall, deretter ingen leveranse i neste digest. |
| FR-004 | Systemet skal slette ubekreftede kontoer eldre enn 14 dager. | Test: retensjonsjobb mot fikstur. |
| FR-005 | Systemet skal hindre en journalist uten `User.status = active` og `JournalistProfile.verification_status = approved` i å sende en forespørsel til moderering. | Test per rad i tabellen i 8.1. |

### Språk og land

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-006 | Systemet skal lagre locale og land som uavhengige felter på kontoen, og skal ikke utlede det ene fra det andre. | Test: konto med locale `en-GB` og land `NO` beholder begge verdier gjennom registrering, innlogging og profilendring. |
| FR-007 | Systemet skal håndheve landets `minimum_age` ved registrering. | Test: land konfigurert med ulik minstealder gir ulik tekst og validering. |
| FR-008 | Systemet skal knytte hvert samtykke til en konkret dokumentversjon med land og locale. | Test: `ConsentRecord` peker på riktig `LegalDocument` etter registrering. |
| FR-009 | Systemet skal ikke tilby en locale i et land der vilkår eller personvernerklæring mangler i den locale-en. | Test: locale fjernes fra `available_locales` i API-responsen når et dokument mangler. |
| FR-010 | Systemet skal kreve nytt samtykke ved bytte av land, og ikke gjennomføre byttet dersom det avslås. | Test: avslag lar `country_code` stå uendret. |
| FR-011 | Systemet skal falle tilbake etter kjeden forespurt locale → landets standard → plattformens standard, og aldri vise en rå oversettelsesnøkkel. | Test: rendering med ukjent locale gir lesbar tekst i alle maler og skjermbilder. |
| FR-012 | Byggesteget skal feile dersom en oversettelsesnøkkel brukt i koden mangler i plattformens standardspråk. | CI-kjøring mot en fikstur med manglende nøkkel. |
| FR-013 | Systemet skal kunne aktivere et nytt land uten kodeendring eller migrasjon. | Test: opprett land via `/admin/countries`, legg inn dokumenter og oversettelser, verifiser full registrerings- og utsendelsesflyt. |
| FR-014 | Systemet skal lagre alle tidspunkter i UTC og vise dem i brukerens tidssone, subsidiært landets. | Test: samme frist vises korrekt for brukere i to tidssoner. |
| FR-015 | Systemet skal aldri oversette brukergenerert innhold. | Kodegjennomgang: ingen oversettelseskall på felter fra `Request` eller `Response`. |

### Forespørsler

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-020 | Journalisten skal kunne lagre en forespørsel som `draft` uten at obligatoriske felter er utfylt. | Test: lagring med tomme felter lykkes. |
| FR-021 | Systemet skal avvise `draft → submitted` dersom et obligatorisk felt i 9.1 mangler, med feilmelding per felt. | Test per felt. |
| FR-022 | Systemet skal kopiere journalistens land til forespørselen ved opprettelse, og ikke tillate at det endres. | Test: PATCH mot `country_code` returnerer 422. |
| FR-023 | Moderator skal bare se og kunne behandle forespørsler i land hen er tildelt. | Test: moderator for `NO` får 404 på en forespørsel i `SE`. |
| FR-024 | Moderator skal kunne publisere, avvise eller returnere en `submitted` forespørsel, og begrunnelse skal være obligatorisk ved de to siste. | Test: avvisning uten begrunnelse returnerer 422. |
| FR-025 | Systemet skal sette `published_at` og gjøre forespørselssiden offentlig tilgjengelig i samme transaksjon som publisering. | Test: siden svarer 200 anonymt umiddelbart etter godkjenning. |
| FR-026 | Systemet skal sette status `expired` og `closed_at` på alle publiserte forespørsler der `response_deadline` er passert, innen 15 minutter. | Test: jobb mot fikstur med frist i fortiden. |
| FR-027 | Journalisten skal kunne lukke en publisert forespørsel før fristen. | Test: status blir `closed`, svarknappen forsvinner. |
| FR-028 | Systemet skal ikke publisere en forespørsel som ikke har vært innom `submitted` og en moderatorhandling. | Kodegjennomgang og test av direkte statusmanipulasjon. |
| FR-029 | Systemet skal hindre en journalist i å ha mer enn 5 forespørsler med status `published` samtidig. | Test: forsøk på et sjette samtidige `submit` avvises med forklarende feilmelding. |

### Utsendelse

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-030 | Systemet skal sende én digest per aktivt land per dag, på landets `digest_send_time` i landets tidssone, forutsatt minst én ny publisert forespørsel. | Test: to land med ulik tidssone gir to jobbkjøringer til riktig tid. |
| FR-031 | Systemet skal bare inkludere forespørsler fra mottakerens eget land. | Test: mottaker i `SE` mottar ingen forespørsler fra `NO`. |
| FR-032 | Systemet skal rendre én innholdsvariant per locale i bruk i landet, ikke én per mottaker. | Test: 100 mottakere fordelt på 2 locales gir 2 renderinger. |
| FR-033 | Systemet skal sende hver mottaker varianten for sin locale, og logge hvilken locale som ble brukt. | Test: `DigestDelivery.locale` stemmer med brukerens locale. |
| FR-034 | Systemet skal sette `included_in_digest_at` slik at en forespørsel aldri inngår i mer enn én digest. | Test: to påfølgende jobbkjøringer gir tom andre digest. |
| FR-035 | Systemet skal utelate brukere med status `unsubscribed` eller `bounced` fra utsendelsen. | Test per status. |
| FR-036 | En feilende utsendelse i ett land skal ikke stoppe utsendelsen i andre land. | Test: simulert leverandørfeil for ett land. |
| FR-037 | Systemet skal registrere leveringsstatus per mottaker og sette adressen til `bounced` ved hard bounce. | Test: simulert webhook. |
| FR-038 | Alle bulkutsendelser skal inneholde `List-Unsubscribe` og `List-Unsubscribe-Post`. | Inspeksjon av headere. |

### Svar og kontakt

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-040 | Systemet skal lagre `contact_sharing = none` som standard, og bare dele e-postadressen dersom respondenten aktivt har valgt det. | Test: innsending uten valg gir `none`, og journalistvisningen viser ingen adresse. |
| FR-041 | Systemet skal hindre mer enn ett aktivt svar per person per forespørsel. | Test: andre innsending returnerer 409. |
| FR-042 | Respondenten skal kunne trekke svaret så lenge forespørselen er åpen, og det skal umiddelbart bli utilgjengelig for journalisten. | Test: journalistvisningen returnerer 404 etter trekking. |
| FR-043 | Journalisten skal kunne sende én kontaktforespørsel per svar. | Test: andre forsøk returnerer 409. |
| FR-044 | Systemet skal bare gjøre e-postadressen tilgjengelig for journalisten etter at respondenten har godkjent kontaktforespørselen. | Test: adressen er fraværende i API-svaret ved status `pending` og `declined`. |
| FR-045 | Systemet skal skrive en revisjonslogg ved hver deling av kontaktopplysninger, med journalist, respondent, tidspunkt og grunnlag. | Test: logglinje finnes etter godkjenning. |
| FR-046 | Systemet skal sette kontaktforespørsler til `expired` etter 14 dager uten svar. | Test: jobb mot fikstur. |

### Administrasjon

| ID | Krav | Verifiseres ved |
|---|---|---|
| FR-050 | Systemet skal logge alle moderator- og administratorhandlinger i revisjonsloggen, med land. | Test per handling i 16.2. |
| FR-051 | Systemet skal kreve en registrert begrunnelse før en administrator kan åpne et enkeltsvar. | Test: oppslag uten begrunnelse returnerer 422. |
| FR-052 | Systemet skal ikke tilby noen visning som lister svar på tvers av forespørsler. | Kodegjennomgang. |
| FR-053 | Administrator skal kunne se leveringsstatus for hver digest per land og kjøre en feilet utsendelse på nytt. | Test: retry etter simulert feil. |
| FR-054 | Administrator skal kunne publisere en ny versjon av et juridisk dokument og markere den som vesentlig endring. | Test: berørte brukere varsles, nytt samtykke kreves. |

---

## 23. Akseptansekriterier for lansering

V1 er klar når hele denne kjeden kan gjennomføres på et produksjonsmiljø:

1. En journalist søker om konto og blir manuelt godkjent av en moderator tildelt
   journalistens land.
2. Journalisten oppretter en forespørsel og sender den til moderering.
3. Moderator godkjenner. Forespørselssiden er umiddelbart offentlig lesbar, med
   korrekt `hreflang` og kanonisk URL.
4. Digest-jobben kjører på landets utsendelsestidspunkt og leverer forespørselen
   til alle aktive abonnenter i landet, i én e-post, med fungerende ettklikks
   avmelding.
5. En mottaker åpner forespørselen fra e-posten og sender inn et svar med
   standardvalget «ikke del e-postadresse».
6. Journalisten leser svaret uten å se noen kontaktopplysninger.
7. Journalisten sender en kontaktforespørsel.
8. Respondenten godkjenner, og journalisten får e-postadressen.
9. Delingen finnes i revisjonsloggen med grunnlag og tidspunkt.
10. Begge parter har mottatt de bekreftelsene som er listet i seksjon 15, på sitt
    eget språk.
11. Forespørselen settes automatisk til `expired` når fristen passeres.
12. Respondenten trekker et annet svar, og det forsvinner fra journalistens
    innboks umiddelbart.
13. Mottakeren melder seg av med ett klikk og får ikke neste digest.
14. Mottakeren sletter kontoen, og anonymiseringen i 17.5 er gjennomført.
15. Ingen svar, mottakerprofiler eller journalistsider er tilgjengelige uten
    innlogging eller indekserbare av søkemotorer.
16. SPF, DKIM og DMARC er verifisert, og en testutsendelse lander i innboksen
    hos Gmail, Outlook og en norsk leverandør.

I tillegg, for språk og land:

17. Et andre land er opprettet i `draft`, med egne vilkår, egen tidssone og egen
    moderator, og hele kjeden 1–14 kan gjennomføres i det landet uten
    kodeendring eller migrasjon.
18. Et andre språk er fullstendig oversatt i test. Hele mottakerflyten,
    inkludert alle e-poster, kan gjennomføres på dette språket uten at en eneste
    rå nøkkel eller uoversatt streng vises.
19. En bruker med locale `en-GB` og land `NO` mottar den norske digesten med
    engelsk ramme og norsk forespørselstekst, korrekt merket.
20. To land med ulik tidssone får hver sin digest til riktig lokal tid, og en
    simulert feil i det ene påvirker ikke det andre.

Punkt 17 og 18 er de eneste som beviser at internasjonaliseringen faktisk
virker. Uten dem er den udokumentert.

---

## 24. Implementeringsrekkefølge

**Fase 1 – Fundament.** Prosjektoppsett bygget portabelt fra første commit
(`INFRASTRUCTURE.md` 16.8 – jobblogikk adskilt fra vertsspesifikke adaptere,
ingen vertsspesifikk API i applikasjonskoden), database, designtokens og
komponentgrunnlag etter `DESIGN.md`, i18n-rammeverk med ICU og CI-sjekk av
nøkler, `Country` og `LegalDocument`, magic link-autentisering, brukere og
roller med land og locale, samtykkelogging, revisjonslogg, e-postleverandør og
domeneoppsett med SPF/DKIM/DMARC.

**Fase 2 – Journalist og forespørsel.** Journalistsøknad, moderatorgodkjenning
med landtildeling, opprettelse av forespørsel, modereringskø, publisering,
offentlig forespørselsside med locale-ruting og hreflang.

**Fase 3 – Mottaker og utsendelse.** Registrering med land- og språkvalg,
digest-jobb per land, variantrendering per locale, tilgangstoken fra e-post,
avmelding, bounce- og klagehåndtering.

**Fase 4 – Svar og kontakt.** Svarskjema med bekreftelsesskjerm, journalistens
innboks, markering og notat, kontaktforespørsel, godkjenning og deling.

**Fase 5 – Lansering.** Retensjonsjobber, rapporteringsskjema, fullstendig
oversettelse av ett tilleggsspråk i test, oppsett av et andre land i `draft`,
tilgjengelighetstest, sikkerhetsgjennomgang, juridisk gjennomgang av vilkår og
personvernerklæring per land, gjenopprettingstest av sikkerhetskopi, oppvarming
av avsenderdomene.

i18n-rammeverket og designtokenene ligger begge i fase 1 med hensikt. Begge
krever at hver eneste streng og hver eneste stilregel i kodebasen gås gjennom
på nytt dersom de innføres senere. Det er de to tingene som faktisk må gjøres
først.

---

## 25. Kuttet fra v1

Alt under er bevisst utelatt, ikke glemt. Rekkefølgen er en anbefaling for
gjeninnføring.

| Nr. | Funksjon | Hvorfor kuttet | Utløser for gjeninnføring |
|---|---|---|---|
| 1 | Kategorivalg, interesser, geografisk og regelbasert matching | Uten brukere finnes ingen relevans å optimalisere. Kostet to entiteter, en modul og en tvetydig regelmotor. | Når en digest jevnlig har mer enn ~8 forespørsler, eller avmeldingsraten overstiger 2 % per utsendelse. |
| 2 | Frekvensvalg, pause, ukesammendrag | Ett abonnement er enklere å forklare og teste. | Samme utløser som over. |
| 3 | Filtrering på innholdsspråk innenfor et land | Relevant først i land med flere store språkgrupper. Alle i et marked får alt. | Ved første land med to reelt likestilte innholdsspråk. |
| 4 | Publisering av samme forespørsel i flere land | Krever en distribusjonsmodell og duplikathåndtering i digesten. | Når journalister rutinemessig søker kilder på tvers av landegrenser. |
| 5 | Maskinoversettelse av forespørsler og svar | Unøyaktig oversettelse av en kildeforespørsel er en tillitsrisiko, ikke en funksjon. | Neppe. Eventuelt som tydelig merket hjelpevisning, aldri som erstatning for originalen. |
| 6 | Egendefinerte spørsmål med strukturerte svar | Krevde to entiteter, dynamisk skjemarendering og et svartype-system. Fritekst dekker behovet ved lavt volum. | Når journalister rutinemessig ber om det samme oppsettet, eller ved behov for eksport. |
| 7 | Vedlegg og profilbilder | Objektlagring, skadevareskanning, signerte lenker og egen retensjonskobling for en marginal gevinst. | Når mer enn et fåtall svar viser til dokumentasjon respondenten ikke får levert. |
| 8 | Telefonnummer og SMS-verifisering | Ekstra personopplysning, ekstra leverandør, ekstra kostnad, og nummerformat per land. | Når journalister melder at e-postkontakt ikke gir svar. |
| 9 | Organisasjonsentitet, teamkontoer, delte forespørsler | Krever kuratering, duplikathåndtering og en tilgangsmodell. | Ved første redaksjon med mer enn to aktive journalister. |
| 10 | Rapportering som datamodell | E-post til moderator dekker behovet ved lavt volum. | Ved mer enn ~5 rapporter i måneden. |
| 11 | Filtrering, sortering og søk i svarinnboksen | Meningsløst under ~20 svar per forespørsel. | Når en forespørsel passerer 30 svar. |
| 12 | Eksport av svar | Kan vente til journalistene har et reelt arbeidsflytbehov. | Ved redaksjoner med jevnlig og gjentakende behov. |
| 13 | Selvbetjent dataeksport | GDPR krever at retten oppfylles, ikke at den er selvbetjent. Manuell rutine med 30 dagers frist er tilstrekkelig. | Ved mer enn én forespørsel i måneden, eller 1 000 registrerte brukere. |
| 14 | Tofaktor for administratorer | Én til to administratorkontoer ved lansering. | Ved tredje administratorkonto eller 500 registrerte mottakere. |
| 15 | Automatisk sletting ved inaktivitet | Ingen er inaktive ennå. | Innen 18 måneder etter lansering – dette er en forpliktelse, ikke et valg. |
| 16 | Forespørsler om særlige kategorier personopplysninger | Krever en samtykke- og informasjonsflyt vi ikke bygger nå. Avvises av moderator i v1. | Etter juridisk gjennomgang per land og bygget samtykkeflyt. |
| 17 | Utkast til svar, redigering av innsendte svar | Trekk og send nytt dekker samme behov uten versjonshåndtering. | Ved reelle brukerklager. |
| 18 | Strukturert dialog ved kontakt | Godkjenn/avslå dekker kjernebehovet. Resten skjer på e-post. | Når mange kontaktforespørsler avslås av praktiske grunner. |
| 19 | Ikke-offentlige forespørsler | Alle publiserte forespørsler er offentlige. Sensitive avvises. | Sammen med nr. 16. |
| 20 | Offentlig oversiktsside og søk over alle forespørsler | Endrer produktdynamikken og krever paginering og indekseringsregler. | Egen produktbeslutning. |
| 21 | Høyre-til-venstre-språk | Ingen aktuelle markeder. CSS-en skal likevel bruke logiske egenskaper slik at kostnaden senere er lav. | Ved første marked med arabisk eller hebraisk. |
| 22 | Avsenderdomene per land | Fragmenterer omdømme og krever oppvarming per marked. | Ved leveringsproblemer som kan spores til ett enkelt marked. |
| 23 | Reklame i grensesnitt og e-post | Den planlagte inntektsmodellen (2.3), men bygges ikke før volumet gjør salg realistisk. Krever tydelig merking etter markedsføringsloven og et prinsipp for at reklame aldri kan forveksles med en forespørsel. | Ved et mottakertall som gjør annonsesalg reelt. Merkingsprinsippet må være avklart før første plassering, ikke underveis. |

---

## 26. Uavklarte spørsmål

### 26.1 Besluttet under autonomt arbeid (natt 2026-07-29/30)

Løst med begrunnede antagelser fordi ingen av dem er organisasjonsbeslutninger
– de er arkitektur- og produktvalg som kan revideres uten kostnad hvis noen er
uenig. Ingen er bygget inn som irreversible.

1. **Ett land ved lansering.** Bekreftet, ikke bare forutsatt (jf. 2.4).
   Arkitekturen bærer flere, men NO er eneste `active` land ved launch. Ingen
   ny informasjon tilsier at to markeder samtidig er verdt den doblede
   juridiske og modereringsbyrden før ett marked er bevist.
2. **Plattformens standardspråk (siste ledd i fallback-kjeden) er `nb-NO`.**
   V1 er ett marked, ett språk – å sette `en` som terminal fallback nå er å
   løse et problem vi ikke har ennå, på bekostning av at hver eneste
   feilmelding må skrives på et språk ingen bruker faktisk ser i v1. Revurder
   denne når land nummer to legges til (se 3.4 og FR-011/FR-012).
3. **Journalistens fulle navn vises offentlig på forespørselen**, ikke bare
   redaksjonen. Begrunnelse: navngitt avsender er en tillitsmekanisme, ikke
   bare en opplysning – en anonym redaksjonskonto uten navn gjør det lettere
   for en useriøs aktør å gjemme seg bak et ekte medienavn. Dette var allerede
   den underforståtte antagelsen i seksjon 11; den er nå gjort eksplisitt der.
4. **Journalisten ser ikke antall åpninger av forespørselen i v1.** Konsistent
   med 21.5, som allerede utelukker individuell åpningssporing av
   prinsipielle grunner. Å innføre det for forespørselssiden alene ville vært
   en stille bakdør inn i nøyaktig den sporingen 21.5 argumenterer mot.
   Aggregerte, ikke-individuelle visningstall kan vurderes senere, aldri
   åpningspiksler.
5. **Maks 5 samtidig publiserte forespørsler per journalist.** Lagt til som
   FR-029 og et nytt punkt i 9.2. Begrunnelse: den daglige e-posten lister
   forespørsler kronologisk uten gruppering (10.2) – uten en grense kan én
   aktiv journalist fylle store deler av en dags digest og fortrenge andre.
   Fem er satt lavt bevisst; heves når reelle journalister melder at det
   begrenser dem, ikke før.
6. **En forespørsel som verken lukkes eller når fristen, får en påminnelse til
   journalisten 30 dager etter publisering**, uavhengig av hvor langt unna
   `response_deadline` er. Lagt til i 9.2, i e-postmaltabellen (14) og som ny
   jobb i `INFRASTRUCTURE.md` 5.1. Ingen automatisk lukking – en 90 dagers
   frist kan være et bevisst, langsiktig opplegg fra journalisten, og
   plattformen skal ikke stenge en sak uten menneskelig beslutning.

### 26.2 Fortsatt åpent – krever en navngitt eier, ikke en arkitekturbeslutning

1. **Før fase 5:** Hvem eier oversettelse av juridiske tekster, og hvem
   godkjenner dem? Dette er en organisatorisk rolletildeling – en konkret
   person eller et advokatforhold – ikke noe en spesifikasjon kan avgjøre på
   vegne av virksomheten. Må være avklart før noe land kan settes til
   `active` (jf. 3.3, 17.2).
