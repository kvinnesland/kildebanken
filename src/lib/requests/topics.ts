// SPEC-V1.md 9.1: "Temalisten er et sett faste nøkler i koden, ikke en
// tabell, og ikke visningsstrenger." Nøkkelen lagres i databasen (`topic`);
// den oversatte teksten (`request.topic.<key>` i i18n-filene) lagres aldri.
// Rekkefølgen her er rekkefølgen spec-en selv lister dem i, og er derfor
// også visningsrekkefølgen i temavelgeren.
export const REQUEST_TOPICS = [
  "work",
  "economy",
  "consumer",
  "technology",
  "health",
  "family",
  "education",
  "housing",
  "climate",
  "politics",
  "culture",
  "travel",
  "food",
  "sport",
  "business",
  "research",
  "law",
  "transport",
  "life_experience",
  "local",
  "other",
] as const;

export type RequestTopic = (typeof REQUEST_TOPICS)[number];

export function isRequestTopic(value: string): value is RequestTopic {
  return (REQUEST_TOPICS as readonly string[]).includes(value);
}
