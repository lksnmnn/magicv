export type Bilingual = { de: string; en: string };

export const LANGUAGES: Bilingual[] = [
  { de: "Deutsch", en: "German" },
  { de: "Englisch", en: "English" },
  { de: "Französisch", en: "French" },
  { de: "Spanisch", en: "Spanish" },
  { de: "Italienisch", en: "Italian" },
  { de: "Niederländisch", en: "Dutch" },
  { de: "Polnisch", en: "Polish" },
  { de: "Russisch", en: "Russian" },
  { de: "Portugiesisch", en: "Portuguese" },
  { de: "Chinesisch", en: "Chinese" },
  { de: "Japanisch", en: "Japanese" },
  { de: "Arabisch", en: "Arabic" },
  { de: "Türkisch", en: "Turkish" },
];

/**
 * Proficiency levels. The first entry that matches either side wins when
 * mapping back from stored data, so order matters for ambiguous wording.
 */
export const LEVELS: { key: string; de: string; en: string }[] = [
  { key: "native", de: "Muttersprache", en: "native" },
  { key: "c2", de: "Fließend (C2)", en: "Fluent (C2)" },
  { key: "c1", de: "Sehr gut (C1)", en: "Advanced (C1)" },
  { key: "b2", de: "Gute Kenntnisse (B2)", en: "Upper-intermediate (B2)" },
  { key: "b1", de: "Mittelstufe (B1)", en: "Intermediate (B1)" },
  { key: "a2", de: "Grundkenntnisse (A2)", en: "Elementary (A2)" },
  { key: "a1", de: "Anfänger (A1)", en: "Beginner (A1)" },
];

export function findLanguage(de: string, en: string): Bilingual | null {
  const dl = de.trim().toLowerCase();
  const el = en.trim().toLowerCase();
  return (
    LANGUAGES.find(
      (l) => l.de.toLowerCase() === dl || l.en.toLowerCase() === el,
    ) ?? null
  );
}

export function findLevel(de: string, en: string) {
  const dl = de.trim().toLowerCase();
  const el = en.trim().toLowerCase();
  return (
    LEVELS.find(
      (l) => l.de.toLowerCase() === dl || l.en.toLowerCase() === el,
    ) ?? null
  );
}
