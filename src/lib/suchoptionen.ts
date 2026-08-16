/**
 * Normalisierung und Konfiguration der Volltextsuche.
 *
 * Dieses Modul wird an zwei Stellen geladen: beim Build, wo der Index entsteht
 * (`src/pages/suchindex.json.ts`), und im Browser, wo er wieder eingelesen wird
 * (`src/scripts/suche.ts`). Beide MÜSSEN dieselben Optionen verwenden — MiniSearch
 * speichert nur die fertigen Terme, nicht die Funktionen, die sie erzeugt haben.
 * Deshalb steht hier bewusst nichts, was die Katalogdaten importiert: Sonst landeten
 * 990 KB JSON im Browser-Bundle.
 */
import type { AsPlainObject, Options, SearchOptions, SearchResult } from 'minisearch';
import type MiniSearch from 'minisearch';

/** Formatstand von `/suchindex.json`. Hochzählen, wenn sich Felder oder Faltung ändern. */
export const INDEX_VERSION = 1;

/** Der gesamte Inhalt von `/suchindex.json`. */
export interface Suchdaten {
  version: number;
  /** Der serialisierte MiniSearch-Index. */
  index: AsPlainObject;
  /**
   * Gefalteter Begriff → Schreibweise, wie sie im Bestand steht.
   * Nur für „Meinten Sie …?" — ohne das Verzeichnis stünde dort „mueller".
   */
  begriffe: Record<string, string>;
  /** Sparten in Katalogreihenfolge, damit die Trefferliste sie ohne die Daten kennt. */
  sparten: Array<{ sparte: string; bezeichnung: string }>;
}

/** Ab dieser Länge der Eingabe wird gesucht. */
export const MIN_ZEICHEN = 2;

/** Höchstzahl gleichzeitig gezeigter Treffer je Sparte, bevor aufgeklappt werden muss. */
export const MAX_JE_GRUPPE = 25;

/** Wartezeit nach dem letzten Tastendruck, bevor gesucht wird. */
export const ENTPRELLUNG_MS = 150;

/** Kürzeste Wortlänge, die als eigenständiger Begriff zählt. */
export const MIN_BEGRIFF = 2;

/** Kürzeste Länge eines Kompositum-Bestandteils. */
export const MIN_WORTTEIL = 4;

/**
 * Durchsuchte Felder, absteigend gewichtet.
 *
 * `teile` ist kein echtes Datenfeld, sondern enthält die beim Build zerlegten
 * Kompositabestandteile. Es steht ganz unten, damit ein Titel, der „Krimi" wirklich
 * so nennt, immer vor einem „Alpenkrimi" landet.
 */
export const GEWICHTUNG: Record<string, number> = {
  titel: 8,
  autor: 6,
  reihe: 4.5,
  untertitel: 3,
  verlag: 2,
  genres: 1.5,
  figur: 1.2,
  teile: 0.6,
};

export const SUCH_FELDER = Object.keys(GEWICHTUNG);

/** Felder, die im Index mitgespeichert werden, weil die Trefferliste sie anzeigt. */
export const SPEICHER_FELDER = [
  'id',
  'sparte',
  'titel',
  'untertitel',
  'autorAnzeige',
  'reihe',
  'band',
  'figur',
  'art',
  'laufzeit_min',
  'alter_ab',
  'verlag',
  'ort',
  'jahr',
  'seiten',
] as const;

/* ------------------------------------------------------------------ *
 * Faltung
 * ------------------------------------------------------------------ */

const AKZENTE = /[̀-ͯ]/g;

/**
 * Grundform: Umlaut auf den Grundbuchstaben, Ligaturen aufgelöst, Akzente entfernt.
 * „Müller" → „muller", „Größe" → „grosse", „Ægisdóttir" → „agisdottir".
 */
export function falteGrundform(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'a')
    .replace(/ø/g, 'o')
    .normalize('NFKD')
    .replace(AKZENTE, '');
}

/**
 * Ausgeschriebene Form: Umlaut zu zwei Buchstaben.
 * „Müller" → „mueller", „Größe" → „groesse", „Ægisdóttir" → „aegisdottir".
 */
export function falteAusgeschrieben(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .normalize('NFKD')
    .replace(AKZENTE, '');
}

/* ------------------------------------------------------------------ *
 * Zerlegen und Verarbeiten
 * ------------------------------------------------------------------ */

/**
 * Zerlegt Text an allem, was kein Buchstabe und keine Ziffer ist.
 * „Island-Krimi" wird dadurch zu „Island" und „Krimi" — die Gegenrichtung
 * (zusammengeschrieben) wird beim Build ins Feld `teile` gelegt.
 */
export function zerlegeInWorte(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter((wort) => wort.length > 0);
}

/**
 * Verarbeitung beim **Indexieren**: legt beide Faltungen ab.
 *
 * „Müller" wird also unter „muller" UND „mueller" gefunden. Das ist die Hälfte der
 * beidseitigen Umlautfaltung — die andere Hälfte macht `verarbeiteAnfrage`.
 */
export function verarbeiteBegriff(begriff: string): string[] | null {
  if (begriff.length < MIN_BEGRIFF) return null;
  const grund = falteGrundform(begriff);
  const lang = falteAusgeschrieben(begriff);
  if (grund.length < MIN_BEGRIFF) return null;
  return grund === lang ? [grund] : [grund, lang];
}

/**
 * Verarbeitung bei der **Suchanfrage**: genau EIN Begriff, nie zwei.
 *
 * Der Unterschied ist nicht kosmetisch. MiniSearch verknüpft mehrere aus `processTerm`
 * zurückgegebene Terme mit demselben Operator wie die übrigen Suchwörter — bei
 * `combineWith: 'AND'` müsste ein Dokument also beide Schreibweisen enthalten.
 * Für „Müller" ginge das gut (beide stehen im Index), für „Ägisdóttir" nicht:
 * indexiert ist „Ægisdóttir" als „agisdottir"/„aegisdottir", die Anfrage ergäbe
 * „agisdottir" UND „aegisdottir" — und das Dokument fiele durch, obwohl beide
 * Terme einzeln passen.
 *
 * Die Anfrage wird deshalb auf die Grundform reduziert. Weil der Index beide Formen
 * kennt, findet jede Schreibweise trotzdem jede andere.
 */
export function verarbeiteAnfrage(begriff: string): string | null {
  if (begriff.length < MIN_BEGRIFF) return null;
  const grund = falteGrundform(begriff);
  return grund.length < MIN_BEGRIFF ? null : grund;
}

/* ------------------------------------------------------------------ *
 * MiniSearch-Optionen
 * ------------------------------------------------------------------ */

/**
 * Die Optionen, mit denen der Index gebaut UND geladen wird.
 * Änderungen hier machen einen bereits ausgelieferten Index ungültig.
 */
export const SUCH_OPTIONEN: Options = {
  fields: SUCH_FELDER,
  storeFields: [...SPEICHER_FELDER],
  idField: 'id',
  tokenize: zerlegeInWorte,
  processTerm: verarbeiteBegriff,
};

/** Gemeinsame Grundeinstellungen jeder Suchanfrage. */
const ANFRAGE_BASIS: SearchOptions = {
  boost: GEWICHTUNG,
  // Mehrere Suchwörter grenzen ein, statt die Trefferliste aufzublähen:
  // „alex beer" soll Alex Beer finden, nicht jedes Buch mit „Alex" ODER „Beer".
  combineWith: 'AND',
  processTerm: verarbeiteAnfrage,
  tokenize: zerlegeInWorte,
};

/**
 * Die drei Stufen, in denen gesucht wird — in genau dieser Reihenfolge.
 *
 * MiniSearch dämpft ungenaue Treffer zwar über `weights`, garantiert aber keine
 * strikte Trennung: Ein Fuzzy-Treffer in einem hoch gewichteten Feld kann einen
 * exakten Treffer in einem niedrig gewichteten überholen. Für „exakte Treffer immer
 * vor Fuzzy-Treffern" reicht das nicht, deshalb werden die Stufen getrennt
 * ausgeführt und aneinandergehängt.
 */
const STUFEN = [
  { name: 'exakt', optionen: { prefix: false, fuzzy: false } },
  { name: 'prefix', optionen: { prefix: true, fuzzy: false } },
  { name: 'fuzzy', optionen: { prefix: false, fuzzy: 0.2 } },
] as const;

export type Trefferstufe = (typeof STUFEN)[number]['name'];

export interface Treffer extends SearchResult {
  /** Auf welcher Stufe der Treffer zustande kam. */
  stufe: Trefferstufe;
}

/**
 * Sucht gestaffelt und liefert die Treffer in der Reihenfolge exakt → Prefix → Fuzzy.
 * Jedes Dokument erscheint nur einmal, und zwar auf seiner besten Stufe.
 */
export function suche(index: MiniSearch, anfrage: string): Treffer[] {
  const text = anfrage.trim();
  if (text.length < MIN_ZEICHEN) return [];

  const gesehen = new Set<unknown>();
  const treffer: Treffer[] = [];

  for (const stufe of STUFEN) {
    for (const ergebnis of index.search(text, { ...ANFRAGE_BASIS, ...stufe.optionen })) {
      if (gesehen.has(ergebnis.id)) continue;
      gesehen.add(ergebnis.id);
      treffer.push({ ...ergebnis, stufe: stufe.name });
    }
  }

  return treffer;
}

/**
 * Vorschlag für „Meinten Sie …?" — nur sinnvoll, wenn `suche` leer ausgeht.
 *
 * Erst wird nah gesucht, dann großzügiger. Die erste Stufe liefert brauchbare
 * Korrekturen für Tippfehler („Emerih" → „Emmerich"), die zweite fängt gröbere
 * Verschreibungen. Findet auch die zweite nichts, gibt es eben keinen Vorschlag:
 * Zu einem Wort, das mit nichts im Bestand verwandt ist, ist jede Vermutung
 * geraten, und geraten hilft an der Ausleihe niemandem.
 */
export function vorschlag(index: MiniSearch, anfrage: string): string[] {
  const text = anfrage.trim();
  if (text.length < MIN_ZEICHEN) return [];

  for (const fuzzy of [0.4, 0.6]) {
    const treffer = index.autoSuggest(text, { ...ANFRAGE_BASIS, fuzzy, prefix: true });
    const begriffe = treffer[0]?.terms ?? [];
    if (begriffe.length > 0) return begriffe;
  }
  return [];
}

/* ------------------------------------------------------------------ *
 * Hervorhebung
 * ------------------------------------------------------------------ */

export interface Textstueck {
  text: string;
  treffer: boolean;
}

/**
 * Faltet den Text und merkt sich für jedes gefaltete Zeichen, aus welchem
 * Originalzeichen es stammt. Nötig, weil die Faltung die Länge ändern kann:
 * „ß" wird zu „ss", „Größe" ist gefaltet einen Buchstaben länger als im Original.
 */
function falteMitHerkunft(text: string): { gefaltet: string; herkunft: number[] } {
  let gefaltet = '';
  const herkunft: number[] = [];
  for (let i = 0; i < text.length; i++) {
    for (const zeichen of falteGrundform(text[i]!)) {
      gefaltet += zeichen;
      herkunft.push(i);
    }
  }
  return { gefaltet, herkunft };
}

/**
 * Zerlegt einen Anzeigetext in Stücke mit und ohne Treffer.
 *
 * Gesucht wird an beliebiger Stelle im Wort, nicht nur am Wortanfang — sonst bliebe
 * bei der Anfrage „Krimi" das „krimi" in „Alpenkrimi" unmarkiert, obwohl genau
 * dieser Treffer über das Feld `teile` zustande kam.
 */
export function hebeHervor(text: string, anfrage: string): Textstueck[] {
  const begriffe = zerlegeInWorte(anfrage)
    .map(verarbeiteAnfrage)
    .filter((b): b is string => b !== null);

  if (begriffe.length === 0 || text.length === 0) return [{ text, treffer: false }];

  const { gefaltet, herkunft } = falteMitHerkunft(text);
  const bereiche: Array<[number, number]> = [];

  for (const begriff of begriffe) {
    let ab = 0;
    for (;;) {
      const start = gefaltet.indexOf(begriff, ab);
      if (start === -1) break;
      const ende = start + begriff.length;
      bereiche.push([herkunft[start]!, herkunft[ende - 1]! + 1]);
      ab = start + 1;
    }
  }

  if (bereiche.length === 0) return [{ text, treffer: false }];

  // Überlappungen zusammenfassen, damit keine verschachtelten Stücke entstehen.
  bereiche.sort((a, b) => a[0] - b[0]);
  const vereint: Array<[number, number]> = [bereiche[0]!];
  for (const [start, ende] of bereiche.slice(1)) {
    const letzter = vereint[vereint.length - 1]!;
    if (start <= letzter[1]) letzter[1] = Math.max(letzter[1], ende);
    else vereint.push([start, ende]);
  }

  const stuecke: Textstueck[] = [];
  let position = 0;
  for (const [start, ende] of vereint) {
    if (start > position) stuecke.push({ text: text.slice(position, start), treffer: false });
    stuecke.push({ text: text.slice(start, ende), treffer: true });
    position = ende;
  }
  if (position < text.length) stuecke.push({ text: text.slice(position), treffer: false });

  return stuecke;
}
