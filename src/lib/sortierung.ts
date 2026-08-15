/**
 * Sortierung und Blätterung der Listenansichten.
 *
 * Alles läuft beim Build. Die Listen sind fertig sortiert im HTML — im Browser wird
 * nicht nachsortiert.
 */
import type { Medium } from './daten';

/** Ab wann geblättert wird. Mehr Einträge als das kommen nie in eine Seite. */
export const PRO_SEITE = 60;

export const SORTIERUNGEN = ['autor', 'titel', 'jahr', 'neu'] as const;
export type Sortierung = (typeof SORTIERUNGEN)[number];

export const STANDARD_SORTIERUNG: Sortierung = 'autor';

export const SORTIER_TEXTE: Record<Sortierung, { kurz: string; lang: string }> = {
  autor: { kurz: 'Autor', lang: 'Nach Autor, dann Titel' },
  titel: { kurz: 'Titel A–Z', lang: 'Nach Titel von A bis Z' },
  jahr: { kurz: 'Jahr', lang: 'Nach Erscheinungsjahr, neueste zuerst' },
  neu: { kurz: 'Zuletzt aufgenommen', lang: 'Nach Aufnahmedatum, zuletzt aufgenommene zuerst' },
};

/**
 * Deutsche Sortierung nach DIN 5007-1: Umlaute zählen wie ihr Grundbuchstabe.
 * „Ö" steht damit zwischen „O" und „P" und nicht am Ende des Alphabets, „Ægisdóttir"
 * einsortiert wie „Aegisdóttir" also zwischen „Adler-Olsen" und „Ahern".
 *
 * `numeric` sorgt nebenbei dafür, dass „Band 2" vor „Band 12" landet und nicht danach.
 */
export const collator = new Intl.Collator('de', { numeric: true });

/* ------------------------------------------------------------------ *
 * Vergleichsbausteine
 * ------------------------------------------------------------------ */

/** Aufsteigend; Einträge ohne Wert kommen ans Ende, nicht an den Anfang. */
function zahlAufsteigend(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
}

/** Absteigend; Einträge ohne Wert kommen ans Ende. */
function zahlAbsteigend(a: number | undefined, b: number | undefined): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return b - a;
}

/** Absteigend für ISO-Datumsangaben; `null` und fehlende Werte ans Ende. */
function datumAbsteigend(a: string | null | undefined, b: string | null | undefined): number {
  const x = a ?? '';
  const y = b ?? '';
  if (x === y) return 0;
  if (x === '') return 1;
  if (y === '') return -1;
  return x < y ? 1 : -1;
}

/* ------------------------------------------------------------------ *
 * Einordnung
 * ------------------------------------------------------------------ */

/**
 * Das Wort, unter dem ein Medium einsortiert wird.
 *
 * Regel wie im gedruckten Katalog: Was einen Autor hat, steht unter dem Nachnamen.
 * Was keinen hat — bei Tonies sind das 121 von 181 — steht unter der Reihe, sonst
 * unter dem Titel. Damit landet „Paw Patrol" unter P und nicht in einem Block
 * namenloser Einträge am Rand.
 */
export function ordnungsname(m: Medium): string {
  return m.autor_nachname ?? m.reihe ?? m.titel;
}

/** Reihen, von denen mehr als ein Band in der übergebenen Menge steckt. */
export function mehrbaendigeReihen(medien: Medium[]): Set<string> {
  const anzahl = new Map<string, number>();
  for (const m of medien) {
    if (m.reihe) anzahl.set(m.reihe, (anzahl.get(m.reihe) ?? 0) + 1);
  }
  return new Set([...anzahl].filter(([, n]) => n > 1).map(([reihe]) => reihe));
}

/**
 * Der Text, nach dem alphabetisch einsortiert wird.
 *
 * Bei einer Reihe mit mehreren Bänden ist das der Reihenname — dadurch stehen die
 * Bände als Block beieinander und werden anschließend nach Bandnummer geordnet,
 * statt alphabetisch auseinandergerissen zu werden.
 */
function gruppentext(m: Medium, reihen: Set<string>): string {
  return m.reihe && reihen.has(m.reihe) ? m.reihe : m.titel;
}

/* ------------------------------------------------------------------ *
 * Sortierung
 * ------------------------------------------------------------------ */

/**
 * Sortiert eine Liste von Medien. Die übergebene Liste bleibt unverändert.
 *
 * Innerhalb einer Reihe gilt: Bandnummer vor Erscheinungsjahr. Das Jahr ist der
 * Ersatz für die 24 Reihen, bei denen im Quelldokument keine Bandnummern standen
 * (z. B. „Altaussee-Krimi") — dort entspricht die Erscheinungsfolge der Lesefolge.
 * Wo Bandnummern da sind, schlagen sie das Jahr, denn die Reihenfolge stimmt nicht
 * immer mit dem Erscheinungsjahr überein: Bei „Ein Fall für August Emmerich" ist
 * Band 5 (2020) älter als Band 4 (2021).
 */
export function sortiere(medien: Medium[], sortierung: Sortierung): Medium[] {
  const reihen = mehrbaendigeReihen(medien);

  /** Reihenfolge innerhalb eines Reihen- oder Autorenblocks. */
  const imBlock = (a: Medium, b: Medium): number =>
    zahlAufsteigend(a.band, b.band) ||
    zahlAufsteigend(a.jahr, b.jahr) ||
    collator.compare(a.titel, b.titel) ||
    collator.compare(a.id, b.id);

  /**
   * Nach Autor. Der Vorname entscheidet mit, weil sich zwölf Nachnamen im Bestand
   * zwei Personen teilen (Alex Beer und Hans de Beer, Anna und Stephanie Schneider …).
   */
  const nachAutor = (a: Medium, b: Medium): number =>
    collator.compare(ordnungsname(a), ordnungsname(b)) ||
    collator.compare(a.autor_vorname ?? '', b.autor_vorname ?? '') ||
    collator.compare(gruppentext(a, reihen), gruppentext(b, reihen)) ||
    imBlock(a, b);

  const nachTitel = (a: Medium, b: Medium): number =>
    collator.compare(gruppentext(a, reihen), gruppentext(b, reihen)) || imBlock(a, b);

  const kopie = [...medien];

  switch (sortierung) {
    case 'autor':
      return kopie.sort(nachAutor);
    case 'titel':
      return kopie.sort(nachTitel);
    case 'jahr':
      return kopie.sort((a, b) => zahlAbsteigend(a.jahr, b.jahr) || nachAutor(a, b));
    case 'neu':
      return kopie.sort((a, b) => datumAbsteigend(a.erfasst_am, b.erfasst_am) || nachAutor(a, b));
  }
}

/**
 * Bände einer Reihe in Lesereihenfolge — für die Querverweise auf der Detailseite.
 */
export function sortiereReihe(medien: Medium[]): Medium[] {
  return [...medien].sort(
    (a, b) =>
      zahlAufsteigend(a.band, b.band) ||
      zahlAufsteigend(a.jahr, b.jahr) ||
      collator.compare(a.titel, b.titel),
  );
}

/* ------------------------------------------------------------------ *
 * Blätterung
 * ------------------------------------------------------------------ */

export interface Seite<T> {
  /** Die Einträge dieser Seite. */
  eintraege: T[];
  /** 1-basierte Seitennummer. */
  nummer: number;
  /** Gesamtzahl der Seiten, mindestens 1. */
  anzahlSeiten: number;
  /** Gesamtzahl der Einträge über alle Seiten. */
  anzahlEintraege: number;
  /** 1-basierte Nummer des ersten Eintrags dieser Seite; 0 bei leerer Liste. */
  von: number;
  /** 1-basierte Nummer des letzten Eintrags dieser Seite; 0 bei leerer Liste. */
  bis: number;
}

export function anzahlSeiten(anzahlEintraege: number, proSeite = PRO_SEITE): number {
  return Math.max(1, Math.ceil(anzahlEintraege / proSeite));
}

export function seiteVon<T>(alle: T[], nummer: number, proSeite = PRO_SEITE): Seite<T> {
  const seiten = anzahlSeiten(alle.length, proSeite);
  const geklemmt = Math.min(Math.max(1, nummer), seiten);
  const start = (geklemmt - 1) * proSeite;
  const eintraege = alle.slice(start, start + proSeite);

  return {
    eintraege,
    nummer: geklemmt,
    anzahlSeiten: seiten,
    anzahlEintraege: alle.length,
    von: eintraege.length === 0 ? 0 : start + 1,
    bis: start + eintraege.length,
  };
}
