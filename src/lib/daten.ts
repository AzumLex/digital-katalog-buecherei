/**
 * Zentrale Datenschicht des Katalogs.
 *
 * Lädt alle Sparten-Dateien aus `src/data/`, führt sie zu einem Array zusammen und
 * stellt die Typen bereit. Alles passiert beim Build — zur Laufzeit im Browser wird
 * hiervon nichts ausgeführt.
 *
 * Die Typen unten sind 1:1 aus `schema/medium.schema.json` abgeleitet. Das Schema ist
 * die maßgebliche Quelle: Wer dort ein Feld ergänzt, muss es auch hier ergänzen —
 * `npm run validate` prüft die JSON-Dateien gegen das Schema, nicht gegen diese Typen.
 */

/* ------------------------------------------------------------------ *
 * Aufzählungen (enum-Werte aus dem Schema)
 * ------------------------------------------------------------------ */

/** Oberste Gliederungsebene der Bücherei. Bestimmt Navigation und Filter. */
export const SPARTEN = [
  'romane',
  'sachbuecher',
  'kinderbuecher',
  'kinder-sachbuecher',
  'tonies',
  'spiele',
  'cds',
] as const;
export type Sparte = (typeof SPARTEN)[number];

/** Physische Form. Getrennt von der Sparte, weil z. B. ein Sachbuch auch als CD vorliegen kann. */
export const MEDIENFORMEN = ['Buch', 'Tonie', 'CD', 'Spiel', 'DVD', 'Zeitschrift'] as const;
export type Medienform = (typeof MEDIENFORMEN)[number];

export const EINBAENDE = [
  'kartoniert',
  'broschiert',
  'fest gebunden',
  'Taschenbuch',
  'Spiralbindung',
] as const;
export type Einband = (typeof EINBAENDE)[number];

/**
 * Im statischen Katalog vorerst immer 'verfuegbar'. Das Feld existiert jetzt schon,
 * damit die spätere Ausleihverwaltung keine Datenmigration braucht.
 */
export const STATUSWERTE = ['verfuegbar', 'ausgeliehen', 'vermisst', 'ausgeschieden'] as const;
export type MedienStatus = (typeof STATUSWERTE)[number];

/* ------------------------------------------------------------------ *
 * Datensatz
 * ------------------------------------------------------------------ */

/**
 * Ein Datensatz pro Exemplar-Titel.
 *
 * Optionale Felder fehlen im JSON schlicht, statt `null` oder "" zu enthalten
 * (`additionalProperties: false` im Schema) — Ausnahmen sind `erfasst_am` und
 * `cover_url`, die ausdrücklich `null` sein dürfen.
 */
export interface Medium {
  // --- Pflichtfelder ---

  /**
   * Stabiler, menschenlesbarer Schlüssel (`^[a-z]{3}-[a-z0-9-]+$`).
   * Darf NIE geändert werden, auch nicht bei Titelkorrekturen — URLs und spätere
   * Ausleihdatensätze hängen daran.
   */
  id: string;
  sparte: Sparte;
  medium: Medienform;
  titel: string;
  status: MedienStatus;

  // --- Titelangaben ---
  untertitel?: string;
  /** Serientitel, z. B. 'Altaussee-Krimi'. */
  reihe?: string;
  band?: number;

  // --- Urheber ---
  /** Anzeigeform, 'Vorname Nachname'. */
  autor?: string;
  /** Sortierschlüssel. */
  autor_nachname?: string;
  autor_vorname?: string;
  weitere_autoren?: string[];
  uebersetzung?: string;
  originalsprache?: string;

  // --- Ausgabe ---
  verlag?: string;
  ort?: string;
  jahr?: number;
  auflage?: string;
  seiten?: number;
  /** Nur Ziffern, ohne Bindestriche. ISBN-10 oder ISBN-13. Schlüssel für spätere Coveranfragen. */
  isbn?: string;
  /** ISBN wie im Quelldokument, für die Anzeige. */
  isbn_formatiert?: string;
  einband?: Einband;
  preis_eur?: number;
  /** Gesetzt, wenn der Quellpreis nicht in Euro war (z. B. 'ATS'). */
  waehrung_original?: string;

  // --- Tonies, CDs, Spiele ---
  /** Nur Tonies/CDs: 'Hörspiel', 'Hörbuch', 'Hörspiel mit Liedern' … */
  art?: string;
  laufzeit_min?: number;
  /** Nur Tonies: Beschreibung der Figur — daran erkennen Kinder den Tonie. */
  figur?: string;
  spieler_min?: number;
  spieler_max?: number;
  spieldauer_min?: number;

  // --- Einordnung ---
  alter_ab?: number;
  genres?: string[];
  sprache?: string;
  /** Freitext aus der Quelle, z. B. 'Auch für jugendl. Leser ab 15'. */
  notiz?: string;

  // --- Bestand ---
  bestand?: number;
  /** Regal/Raum, z. B. 'Regal 4 links'. */
  standort?: string;
  signatur?: string;
  /** ISO-Datum der Aufnahme in den Bestand. Grundlage für den 'Neu'-Filter — NICHT `jahr` verwenden. */
  erfasst_am?: string | null;
  /** Relativer Pfad zu einem lokalen Coverbild oder null. */
  cover_url?: string | null;

  // --- Technisch (nicht anzeigen) ---
  /** Vorberechnetes Suchfeld. Wird beim Import erzeugt, nicht von Hand gepflegt. */
  suchtext?: string;
  /** Originalzeile aus Word/Excel. Bleibt als Beleg erhalten. */
  _quelle?: string;
  /** Warnungen aus dem Import (z. B. 'keine_isbn'). Arbeitsliste für die Nachkontrolle. */
  _pruefen?: string[];
}

/** Aufbau einer Datei in `src/data/` — eine Datei je Sparte. */
export interface SpartenDatei {
  sparte: Sparte;
  /** Anzeigename der Sparte, z. B. 'Romane (Deutsch)'. */
  bezeichnung: string;
  /** Datenstand als ISO-Datum. */
  stand: string;
  /** Herkunft, z. B. 'Romane.doc'. Leer, solange die Sparte noch nicht befüllt ist. */
  quelle: string;
  anzahl: number;
  items: Medium[];
}

/** Ein Eintrag der Sparten-Übersicht auf der Startseite. */
export interface SpartenUebersicht {
  sparte: Sparte;
  bezeichnung: string;
  anzahl: number;
}

/* ------------------------------------------------------------------ *
 * Laden
 * ------------------------------------------------------------------ */

// Vite liest die JSON-Dateien beim Build ein. Dateien mit führendem Unterstrich
// (z. B. _unlesbar.json) sind Arbeitsmaterial und kein Bestand — sie werden
// ausgelassen, genau wie in scripts/validate.py.
const rohdateien = import.meta.glob('../data/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, SpartenDatei>;

function dateiname(pfad: string): string {
  return pfad.slice(pfad.lastIndexOf('/') + 1);
}

const geladen = new Map<Sparte, { datei: string; inhalt: SpartenDatei }>();

for (const [pfad, inhalt] of Object.entries(rohdateien)) {
  const name = dateiname(pfad);
  if (name.startsWith('_')) continue;

  if (!SPARTEN.includes(inhalt.sparte)) {
    throw new Error(
      `src/data/${name}: unbekannte Sparte "${inhalt.sparte}".\n` +
        `Erlaubt sind: ${SPARTEN.join(', ')}.\n` +
        'Neue Sparten müssen zuerst in schema/medium.schema.json eingetragen werden.',
    );
  }

  const schonDa = geladen.get(inhalt.sparte);
  if (schonDa) {
    throw new Error(
      `Die Sparte "${inhalt.sparte}" steht in zwei Dateien: ` +
        `src/data/${schonDa.datei} und src/data/${name}.\n` +
        'Pro Sparte darf es nur eine Datei geben.',
    );
  }

  geladen.set(inhalt.sparte, { datei: name, inhalt });
}

/** Alle Sparten-Dateien in der Reihenfolge von SPARTEN (nicht alphabetisch). */
export const spartenDateien: SpartenDatei[] = SPARTEN.flatMap(
  (sparte) => geladen.get(sparte)?.inhalt ?? [],
);

/* ------------------------------------------------------------------ *
 * Dublettenprüfung — bricht den Build ab
 * ------------------------------------------------------------------ */

/**
 * Bricht ab, wenn eine `id` mehr als einmal vorkommt.
 *
 * Die `id` ist der dauerhafte Schlüssel eines Mediums: Detailseiten-URLs und später
 * die Ausleihdatensätze hängen daran. Zwei Einträge mit derselben id würden sich
 * beim Erzeugen der Seiten gegenseitig überschreiben — deshalb lieber ein harter
 * Fehler beim Build als ein still kaputter Katalog.
 */
function pruefeEindeutigeIds(dateien: SpartenDatei[]): void {
  const herkunft = new Map<string, string[]>();

  for (const datei of dateien) {
    datei.items.forEach((medium, index) => {
      const stellen = herkunft.get(medium.id) ?? [];
      stellen.push(`src/data/${datei.sparte}.json (Eintrag ${index + 1}: "${medium.titel}")`);
      herkunft.set(medium.id, stellen);
    });
  }

  const dubletten = [...herkunft.entries()].filter(([, stellen]) => stellen.length > 1);
  if (dubletten.length === 0) return;

  const bericht = dubletten
    .map(([id, stellen]) => `  id "${id}" — ${stellen.length}x:\n${stellen.map((s) => `    - ${s}`).join('\n')}`)
    .join('\n');

  throw new Error(
    `Doppelte id in den Katalogdaten (${dubletten.length} ${dubletten.length === 1 ? 'Fall' : 'Fälle'}):\n` +
      `${bericht}\n\n` +
      'Jede id darf nur einmal vorkommen. Bereits vergebene ids NICHT ändern — ' +
      'stattdessen dem neueren Eintrag eine eigene id geben (z. B. Suffix "-2").',
  );
}

pruefeEindeutigeIds(spartenDateien);

/* ------------------------------------------------------------------ *
 * Öffentliche Daten
 * ------------------------------------------------------------------ */

/** Alle Medien aller Sparten in einem Array, in der Reihenfolge von SPARTEN. */
export const alleMedien: Medium[] = spartenDateien.flatMap((datei) => datei.items);

/** Anzahl je Sparte — auch für Sparten, die noch leer sind. */
export const spartenUebersicht: SpartenUebersicht[] = spartenDateien.map((datei) => ({
  sparte: datei.sparte,
  bezeichnung: datei.bezeichnung,
  anzahl: datei.items.length,
}));

/** Gesamtzahl aller Medien im Katalog. */
export const gesamtAnzahl: number = alleMedien.length;

/** Jüngster Datenstand über alle Sparten (ISO-Datum). */
export const datenstand: string = spartenDateien
  .map((datei) => datei.stand)
  .sort()
  .at(-1) ?? '';

/* ------------------------------------------------------------------ *
 * Nachschlagen
 * ------------------------------------------------------------------ */

/** Zugriff auf eine Sparte samt Bezeichnung und Datenstand. */
export const spartenNachName: ReadonlyMap<Sparte, SpartenDatei> = new Map(
  spartenDateien.map((datei) => [datei.sparte, datei]),
);

/** Zugriff auf ein einzelnes Medium über seine id. Eindeutig, siehe pruefeEindeutigeIds. */
export const medienNachId: ReadonlyMap<string, Medium> = new Map(
  alleMedien.map((medium) => [medium.id, medium]),
);

/**
 * Alle Bände einer Reihe, über Sparten hinweg.
 *
 * Bewusst nur über den Reihennamen gebildet: Eine Reihe bleibt dieselbe Reihe, auch
 * wenn ein Band von einem anderen Autor stammt. Enthält auch Reihen mit nur einem
 * Band — wer nur echte Serien will, prüft die Länge.
 */
export const reihenIndex: ReadonlyMap<string, Medium[]> = (() => {
  const index = new Map<string, Medium[]>();
  for (const medium of alleMedien) {
    if (!medium.reihe) continue;
    const baende = index.get(medium.reihe);
    if (baende) baende.push(medium);
    else index.set(medium.reihe, [medium]);
  }
  return index;
})();

/** Die Medien einer Sparte in Dateireihenfolge (unsortiert). */
export function medienDerSparte(sparte: Sparte): Medium[] {
  return spartenNachName.get(sparte)?.items ?? [];
}
