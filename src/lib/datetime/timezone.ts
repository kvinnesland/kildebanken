// Konverterer et vegg-klokkeslett i en IANA-tidssone til det faktiske
// UTC-tidspunktet, uten avhengighet utover Node sin innebygde Intl (samme
// prinsipp som `localTimeForTimezone()` i src/lib/jobs/tick.ts, som løser
// det motsatte problemet — dagens lokale klokkeslett i en sone).
//
// Brukes av `POST/PATCH /requests/:id` (SPEC-V1.md 9.1: "Svarfrist ...
// dato + klokkeslett i landets tidssone") — journalisten taster inn en
// dato og et klokkeslett som skal tolkes i LANDETS tidssone, ikke
// nettleserens egen.

function wallClockAsUtcMillis(ms: number, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
}

/**
 * `localDateTime` er `YYYY-MM-DDTHH:mm` — nøyaktig formatet en native
 * `<input type="datetime-local">` sender, med hensikt (ingen egen parsing
 * påkrevd i skjemaet). To iterasjoner av "gjett, se hva sonen faktisk
 * viser, korriger" — standard teknikk for denne konverteringen, konvergerer
 * i praksis alltid innen to runder unntatt i selve DST-overgangstimen (et
 * par timer i året), som ikke er verdt å håndtere særskilt for et
 * svarfrist-felt.
 */
export function zonedWallTimeToUtc(localDateTime: string, timeZone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime);
  if (!match) {
    throw new Error(`zonedWallTimeToUtc: ugyldig format "${localDateTime}", forventet YYYY-MM-DDTHH:mm`);
  }
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));

  let utcGuess = target;
  for (let i = 0; i < 2; i++) {
    const offset = wallClockAsUtcMillis(utcGuess, timeZone) - utcGuess;
    utcGuess = target - offset;
  }

  return new Date(utcGuess);
}

/**
 * Motsatt vei av `zonedWallTimeToUtc()` — hvilket vegg-klokkeslett en
 * IANA-sone viser ved et gitt UTC-tidspunkt, som `YYYY-MM-DDTHH:mm` (samme
 * format en `<input type="datetime-local">` forventer som `value`). Brukes
 * til å forhåndsutfylle svarfrist-feltet med den lagrede UTC-verdien,
 * tilbake i landets tidssone.
 */
export function utcToZonedWallTime(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
