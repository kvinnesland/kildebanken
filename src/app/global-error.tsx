"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";

// Next.js sin egen, dokumenterte reserveside for feil i selve root-laget
// (over [locale]-segmentet, se src/app/[locale]/layout.tsx) — det finnes
// intet locale å slå opp tekst i her, derfor Next sin egen innebygde
// <Error>-komponent i stedet for i18n-systemet. Unntaket fra "ingen
// brukervendt streng i kildekoden" er bevisst: dette er den ENE siden som
// kjører når roten selv har krasjet, ikke en vanlig side.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    // lang="en": Next.js sin egen innebygde <NextError>-komponent under
    // rendrer alltid engelsk tekst, uansett locale — SPEC-V1.md 21.2 krever
    // korrekt lang-attributt på DOKUMENTNIVÅ nettopp for at en skjermleser
    // ikke skal lese innhold med feil uttaleregler (samme begrunnelse som
    // request-innholdets element-nivå lang, se
    // foresporsler/[id]/[slug]/page.tsx) — her er "feil språk" det samme som
    // "helt uten lang", siden det ikke finnes noen locale å slå opp.
    <html lang="en">
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
