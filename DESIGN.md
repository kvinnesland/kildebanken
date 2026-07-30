# Designsystem

Supplement til `SPEC-V1.md`. Gjelder grensesnitt, e-postmaler og visuell
identitet.

Tre krav styrer alt her:

1. **Temaet skal kunne byttes ved å redigere én fil.** Arbeidstittelen er
   midlertidig, og den visuelle identiteten er ikke bestemt. Systemet skal ikke
   låse oss.
2. **Rolig og elegant.** Tjenesten skal se ut som noe man kan stole på med
   personopplysninger. Ikke som en kampanjeside.
3. **Mobil først.** Mottakeren åpner e-posten på telefonen kl. 07.00 og svarer
   der. Det er hovedflyten, ikke et tilfelle vi tilpasser i ettertid.

---

## 1. Tre lag

Hele byttbarheten hviler på at disse lagene holdes atskilt.

```
Lag 1  Primitiver      råskalaer: --gray-500, --accent-600, --space-4
                       kan byttes ut i sin helhet

Lag 2  Semantiske      roller: --color-surface, --color-text-muted
       tokens          kontrakten komponentene koder mot

Lag 3  Komponenter     refererer bare til lag 2
```

**Regelen:** en komponent skal aldri referere til lag 1, og aldri inneholde en
farge-, avstands- eller radiusverdi direkte. Brytes den, er temaet ikke lenger
byttbart, og ingen oppdager det før noen faktisk prøver å bytte.

Håndheves med lint-regel som feiler CI på hex-verdier, `rgb()`, `oklch()`,
`px`-verdier utenfor tokenfilene, og på bruk av lag 1-variabler i
komponentfiler.

### 1.1 Hva et temabytte innebærer

Å bytte tema skal kreve endringer i nøyaktig disse filene:

```
tokens/primitives.css      farger, skalaer
tokens/semantic.css        rollene, hvis nye roller trengs
tokens/typography.css      fontvalg
```

Ingen komponentfil skal trenge å endres. Dette er et akseptansekriterium, ikke
en ambisjon – se seksjon 9.

---

## 2. Farger

Definert i OKLCH. Perseptuelt jevne skalaer betyr at lysstyrken faktisk stemmer
på tvers av fargetoner, slik at kontrastforholdene holder når temaet byttes.
Alle målbrowsere i `SPEC-V1.md` 21.4 støtter det.

### 2.1 Primitiver

Nøytralene er svakt kjølige. Rent grått blir klinisk, og varmt grått blir mykt
på en måte som ikke kler et verktøy for kildearbeid.

```css
:root {
  --gray-0:   oklch(100%  0     0);
  --gray-50:  oklch(98.5% 0.002 250);
  --gray-100: oklch(96.5% 0.004 250);
  --gray-200: oklch(92.5% 0.006 250);
  --gray-300: oklch(87%   0.008 250);
  --gray-400: oklch(71%   0.010 250);
  --gray-500: oklch(58%   0.012 250);
  --gray-600: oklch(48%   0.012 250);
  --gray-700: oklch(39%   0.011 250);
  --gray-800: oklch(28%   0.010 250);
  --gray-900: oklch(21%   0.008 250);
  --gray-950: oklch(15%   0.006 250);

  /* Én aksentfarge. Dempet blå – rolig, ikke bankblå. */
  --accent-50:  oklch(97% 0.014 230);
  --accent-100: oklch(94% 0.026 230);
  --accent-200: oklch(88% 0.045 230);
  --accent-300: oklch(80% 0.065 230);
  --accent-400: oklch(70% 0.085 230);
  --accent-500: oklch(60% 0.095 230);
  --accent-600: oklch(51% 0.095 230);
  --accent-700: oklch(43% 0.082 230);
  --accent-800: oklch(35% 0.065 230);
  --accent-900: oklch(28% 0.050 230);

  /* Status. Bevisst lav metning, slik at de ikke skriker mot resten. */
  --success-100: oklch(95% 0.030 160);
  --success-600: oklch(52% 0.085 160);
  --success-900: oklch(28% 0.055 160);

  --warning-100: oklch(96% 0.040 75);
  --warning-600: oklch(65% 0.105 75);
  --warning-900: oklch(35% 0.070 75);

  --danger-100:  oklch(96% 0.030 25);
  --danger-600:  oklch(52% 0.130 25);
  --danger-900:  oklch(30% 0.090 25);
}
```

Én aksentfarge er et bevisst valg. To konkurrerer, og resultatet blir sjelden
rolig.

### 2.2 Semantiske tokens

Dette er kontrakten. Komponentene kjenner bare disse navnene.

```css
:root {
  --color-bg:              var(--gray-50);
  --color-surface:         var(--gray-0);
  --color-surface-sunken:  var(--gray-100);
  --color-surface-hover:   var(--gray-100);

  --color-border:          var(--gray-200);
  --color-border-strong:   var(--gray-500);

  --color-text:            var(--gray-900);
  --color-text-muted:      var(--gray-600);
  --color-text-subtle:     var(--gray-500);
  --color-text-inverse:    var(--gray-0);

  --color-accent:          var(--accent-600);
  --color-accent-hover:    var(--accent-700);
  --color-accent-subtle:   var(--accent-50);
  --color-accent-text:     var(--gray-0);
  --color-link:            var(--accent-700);

  --color-focus-ring:      var(--accent-500);

  --color-success:         var(--success-600);
  --color-success-subtle:  var(--success-100);
  --color-warning:         var(--warning-600);
  --color-warning-subtle:  var(--warning-100);
  --color-danger:          var(--danger-600);
  --color-danger-subtle:   var(--danger-100);
  --color-danger-text:     var(--danger-600);
  --color-on-danger:       var(--gray-0);
  --color-success-text:    var(--success-600);
  --color-warning-text:    var(--warning-900);
}
```

### 2.3 Mørkt tema

Følger systemvalget, med en manuell overstyring som huskes på kontoen.

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* verdiene under */ }
}
:root[data-theme="dark"] {
  --color-bg:             var(--gray-950);
  --color-surface:        var(--gray-900);
  --color-surface-sunken: var(--gray-950);
  --color-surface-hover:  var(--gray-800);

  --color-border:         var(--gray-800);
  --color-border-strong:  var(--gray-500);

  --color-text:           var(--gray-100);
  --color-text-muted:     var(--gray-400);
  --color-text-subtle:    var(--gray-500);
  --color-text-inverse:   var(--gray-950);

  --color-accent:         var(--accent-400);
  --color-accent-hover:   var(--accent-300);
  --color-accent-subtle:  var(--accent-900);
  --color-accent-text:    var(--gray-950);
  --color-link:           var(--accent-300);

  --color-danger-text:    var(--danger-100);
  --color-success-text:   var(--success-100);
  --color-warning-text:   var(--warning-100);
}
```

Mørkt tema er ikke inverterte farger. Aksenten må lysne for å holde kontrast mot
mørk bakgrunn, og `--color-accent-text` snur.

`--color-border-strong` peker på `--gray-500` i BEGGE temaer, ikke `--gray-300`/
`--gray-700` som et tidligere utkast hadde — de sistnevnte ga bare 1.48:1
(lyst)/1.85:1 (mørkt) mot flaten, godt under 3:1-kravet under. Rettet økt 7
etter at `contrast-pairs.test.ts` (2.4) avdekket det som en reell, usynlig
feil i absolutt alle skjemafelt (TextField/Select/Checkbox) sin kant.

`--color-danger` som INNHOLDSFARGE (kant, knappebakgrunn) er bevisst
tema-uavhengig, jf. 2.1. Men brukt direkte som TEKSTFARGE (feiltekst under et
felt) må den lysne i mørkt tema, akkurat som aksenten over — derfor
`--color-danger-text` (samme verdi som `--color-danger` i lyst tema,
`--danger-100` i mørkt). `--color-on-danger` er komplementet: tekst/ikon OPPÅ
en `--color-danger`-fylt flate (faretruende-knapp) — tema-uavhengig fordi
bakgrunnen den står på er det. Rettet samme økt, samme funn.

`--color-success-text`/`--color-warning-text` finnes av samme grunn, lagt
til FOREBYGGENDE (økt 7, ingen komponent bruker dem som ren tekst ennå).
Merk at `--color-warning` (`--warning-600`) i seg selv bare gir 3.28:1 mot
hvitt — under 4.5:1 selv i LYST tema — så `--color-warning-text` peker på
`--warning-900` i lyst tema (11.43:1), ikke `--warning-600` som
`--color-danger-text` gjorde. `--color-success-text` følger derimot
`--color-danger-text` sitt mønster (uendret i lyst tema, `-100` i mørkt),
siden `--success-600` selv klarer 4.5:1 mot hvitt. Legg til i
`contrast-pairs.ts` sin `TOKEN_PAIRS` DEN DAGEN noe faktisk bruker dem.

### 2.4 Kontrast

Alle kombinasjoner som faktisk brukes, skal testes automatisk mot WCAG 2.2 AA:
4.5:1 for tekst, 3:1 for store overskrifter og for grensesnittelementer og
fokusmarkering.

Testen kjører over den definerte listen av par i begge temaer og feiler CI ved
avvik. Dette er den eneste måten et temabytte ikke stille kan bryte
tilgjengelighetskravet i `SPEC-V1.md` 21.2. Implementert i
`src/styles/color/contrast-pairs.ts` (parene) og
`contrast-pairs.test.ts` (selve håndhevelsen), økt 7.

`--color-text-subtle` (`--gray-500`) gir 4.28:1 mot `--color-surface` i lyst
tema — under 4.5:1-kravet for vanlig tekst, men godt over 3:1. Bruk den
BARE til store overskrifter eller rent dekorativ tekst, aldri til
normalstørrelse brødtekst/metatekst — bruk `--color-text-muted` der i
stedet (se `src/app/[locale]/legal/.../page.module.css`, som gjorde nettopp
denne feilen først).

Farge er aldri eneste bærer av mening. Statusetiketter har alltid tekst, og der
et ikon brukes, har det tekstalternativ.

---

## 3. Typografi

```css
:root {
  --font-ui:        "Inter var", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-editorial: "Source Serif 4", Georgia, "Times New Roman", serif;
  --font-mono:      ui-monospace, "SF Mono", "Cascadia Mono", monospace;
}
```

**To fontfamilier med hvert sitt formål.** Grensesnittet – knapper, skjemaer,
navigasjon, administrasjon – er sans-serif. Redaksjonelt innhold –
forespørselens tittel og beskrivelse, og respondentens svar slik journalisten
leser det – settes med serif.

Det gjør to ting: det signaliserer at innholdet er tekst skrevet av et
menneske og ikke grensesnitt, og det gjør lange beskrivelser merkbart lettere å
lese på mobil.

**Fontene selvhostes.** Ingen Google Fonts, ingen ekstern CDN. Dette er delvis
ytelse og delvis personvern – innlasting fra Google overfører brukerens
IP-adresse til USA, og tysk rettspraksis har allerede funnet at det er et brudd.
Vi har skrevet EØS-lagring inn i spesifikasjonen; da kan vi ikke lekke
IP-adresser i skriftlasten.

Subsettes til latin + latin-extended (dekker nordisk og det meste av europeisk),
serveres som woff2, `font-display: swap`, preload på de to vektene som brukes
over folden.

### 3.1 Skala

Flytende mellom mobil og desktop, slik at vi slipper brytepunkter i typografien.

```css
:root {
  --text-xs:   0.8125rem;                                  /* 13px  metadata   */
  --text-sm:   0.875rem;                                   /* 14px  hjelpetekst */
  --text-base: 1rem;                                       /* 16px  brødtekst   */
  --text-lg:   1.125rem;                                   /* 18px  ingress     */
  --text-xl:   clamp(1.25rem,  1.1rem + 0.7vw,  1.5rem);
  --text-2xl:  clamp(1.5rem,   1.3rem + 1.0vw,  1.875rem);
  --text-3xl:  clamp(1.875rem, 1.5rem + 1.8vw,  2.5rem);

  --leading-tight:  1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.7;   /* lange beskrivelser og svar */

  --measure: 68ch;          /* maks linjelengde for løpende tekst */
}
```

Brødtekst er aldri under 16 px. På iOS zoomer Safari inn på skjemafelter med
mindre skriftstørrelse, og det ødelegger svarskjemaet på mobil.

Løpende tekst begrenses til `--measure`. En forespørselsbeskrivelse på 5 000
tegn i full bredde på desktop er uleselig.

### 3.2 Tekstutvidelse

`SPEC-V1.md` 21.3 krever at grensesnittet tåler 40 % tekstutvidelse. I praksis:

- Ingen faste bredder på knapper eller etiketter.
- Ingen tekst i bilder.
- Knapperader brytes til kolonne når de ikke får plass, aldri horisontal scroll.
- Tabelloverskrifter skal tåle to linjer uten at raden hopper.

---

## 4. Rom, form og dybde

```css
:root {
  /* 4 px basis */
  --space-1: 0.25rem;  --space-2: 0.5rem;   --space-3: 0.75rem;
  --space-4: 1rem;     --space-5: 1.5rem;   --space-6: 2rem;
  --space-7: 3rem;     --space-8: 4rem;     --space-9: 6rem;

  --radius-sm:   0.25rem;
  --radius-md:   0.5rem;
  --radius-lg:   0.75rem;
  --radius-full: 9999px;

  /* Myke og svake. Dybde kommer fra kantlinje og flate, ikke fra slagskygge. */
  --shadow-sm: 0 1px 2px oklch(0% 0 0 / 0.04);
  --shadow-md: 0 2px 8px oklch(0% 0 0 / 0.06);
  --shadow-lg: 0 8px 24px oklch(0% 0 0 / 0.08);

  --duration-fast: 120ms;
  --duration-base: 200ms;
  --ease: cubic-bezier(0.2, 0, 0, 1);
}
```

Elegant kommer fra luft og få elementer, ikke fra effekter. Standardvalget er
kantlinje og bakgrunnsforskjell; skygge brukes bare på flater som faktisk ligger
over andre – dialoger og lignende.

All bevegelse respekterer `prefers-reduced-motion`.

---

## 5. Mobil

Basisstilen er mobilstilen. Alle media queries er `min-width`.

```css
:root {
  --bp-sm:  40rem;   /* 640px  */
  --bp-md:  56rem;   /* 900px  */
  --bp-lg:  75rem;   /* 1200px */
}
```

Regler som gjelder uansett komponent:

- **Trykkflate minst 44 × 44 px.** WCAG 2.2 AA krever 24 px; 44 px er det som
  faktisk fungerer med en tommel.
- Minst 8 px mellom to trykkflater.
- Primærhandlingen i et skjema er i full bredde på mobil og festet nederst i
  synsfeltet der skjemaet er langt. Svarskjemaet er langt.
- Ingen horisontal scroll på siden. Innhold som må være bredt – tabeller i
  administrasjonsgrensesnittet – scroller i sin egen beholder.
- `font-size: 16px` på alle skjemafelter.
- Skjematilstand overlever at nettleseren legges i bakgrunnen. Et halvskrevet
  svar på 2 000 tegn skal ikke forsvinne fordi noen sjekket en melding
  underveis. Lokal mellomlagring i nettleseren, ikke på server – vi har ingen
  utkastfunksjon i v1, og dette er ikke en.
- Journalist- og administrasjonsgrensesnittet optimaliseres for desktop, men
  ingen handling der skal være umulig på mobil.

---

## 6. Komponenter

Bygget på **headless primitiver** – Radix eller React Aria – med vår egen
styling. Vi arver riktig tastaturhåndtering, fokusfelle og ARIA, og beholder
full kontroll over det visuelle. Et ferdigstylet komponentbibliotek ville
motarbeidet kravet om byttbarhet direkte.

Minimumssett for v1:

`Button` (primary, secondary, ghost, danger) · `TextField` · `TextArea` med
tegnteller · `Checkbox` · `RadioGroup` · `Select` · `Dialog` · `Toast` ·
`Badge` for status · `Card` · `Alert` · `Tabs` · `Table` · `Pagination` ·
`EmptyState` · `SkeletonLoader` · `LanguageSwitcher`

### 6.1 Fokus og feil

- Fokusmarkering er alltid synlig, aldri fjernet. `:focus-visible`, 2 px ring i
  `--color-focus-ring` med 2 px avstand.
- Feilmeldinger står ved feltet, ikke bare oppsummert på toppen, og knyttes med
  `aria-describedby`.
- Skjemaer med feil flytter fokus til første feilende felt.
- Feiltekst er aldri bare rød – den har alltid en tekstlig forklaring, og
  feltet får `aria-invalid`.

### 6.2 Status

Forespørsels- og svarstatuser vises som `Badge` med både farge og tekst.
Fargetilordningen defineres ett sted og gjenbrukes i grensesnitt og e-post.

---

## 7. E-post

E-post er det viktigste grensesnittet i produktet. Den daglige digesten er der
mottakeren faktisk møter tjenesten.

E-postklienter støtter ikke CSS-variabler. Løsningen er ikke å ha to
sannheter, men å **eksportere tokenene ved bygg**:

```
tokens/primitives.css  ──build──→  tokens.json  ──→  e-postmaler (literale verdier)
                       └─────────→  CSS-variabler (web)
```

Et temabytte treffer dermed e-postene i samme operasjon. Endrer noen en farge
direkte i en e-postmal, feiler CI.

Videre krav:

- Tabellbasert layout, én kolonne, maks 600 px.
- All CSS inlines. Ingen eksterne stilark.
- Mørkt tema via `prefers-color-scheme` der klienten støtter det, med farger
  som er lesbare også når klienten inverterer på egen hånd.
- Ingen bilder som bærer informasjon. Logo har `alt`. Blokkerte bilder skal
  ikke gjøre e-posten uforståelig.
- Ren tekst-varianten er en reell variant, ikke maskinstrippet HTML.
- `lang` settes korrekt, og forespørsler på et annet språk enn mottakerens
  merkes med `lang` på elementnivå.
- Testes i Gmail (web, iOS, Android), Outlook (web, Windows), Apple Mail
  (macOS, iOS) før lansering.

---

## 8. Innholdsdesign

Tonen er en del av designet, og den er en tillitsmekanisme.

- Klart språk. Ingen markedsføringstone. Ingen utropstegn.
- Konsekvent begrepsbruk mellom grensesnitt, e-post og vilkår. En «forespørsel»
  er en forespørsel overalt.
- Handlinger som deler personopplysninger, beskrives med hva som faktisk skjer:
  «Del e-postadressen min med journalisten», ikke «Fortsett».
- Bekreftelsesskjermen før innsending (`SPEC-V1.md` 12.3) er den viktigste
  skjermen i tjenesten. Den skal være rolig og fullstendig, ikke en
  hurtigdialog.
- Tomme tilstander forklarer hva som skjer videre, ikke bare at det er tomt.

---

## 9. Akseptansekriterier

1. Et fullstendig temabytte – nye farger, ny aksent, ny font – gjennomføres ved
   å endre bare filene i 1.1. Verifiseres ved å faktisk gjennomføre et bytte til
   et bevisst avvikende testtema før lansering. Består ikke testen hvis en
   eneste komponentfil må endres.
2. CI feiler på fargeverdier, `px`-verdier og lag 1-variabler i komponentfiler.
3. Kontrasttesten dekker alle brukte tokenpar i lyst og mørkt tema, og feiler
   ved avvik fra WCAG 2.2 AA.
4. Hele mottakerflyten kan gjennomføres med tastatur alene, og med skjermleser.
5. Hele mottakerflyten kan gjennomføres på en 360 px bred skjerm uten
   horisontal scroll.
6. Testtemaet fra punkt 1 slår også gjennom i alle e-postmaler uten at noen
   mal er redigert.
7. Grensesnittet er lesbart og ubrutt med 40 % lengre tekststrenger.
8. Ingen forespørsel til en ekstern vert ved sidelast. Verifiseres i
   nettverksfanen.

---

## 10. Uavklart

1. **Visuell identitet og navn.** Arbeidstittelen er midlertidig. Palett og
   typografi her er et gjennomarbeidet utgangspunkt, ikke et merkevarevalg.
   Hele poenget med seksjon 1 er at den beslutningen kan tas senere uten
   omskriving.
2. **Serif til redaksjonelt innhold** – Source Serif 4 er et forslag. Valget bør
   tas sammen med identiteten, men todelingen sans/serif bør beholdes uansett.
3. **Logo og delingsbilde** for Open Graph mangler, og trengs før
   forespørselssidene deles i sosiale medier.
