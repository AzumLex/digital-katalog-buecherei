/**
 * Baut den Suchindex — ausschließlich beim Build.
 *
 * Dieses Modul importiert die Katalogdaten und darf deshalb NIE im Browser landen.
 * Der Browser lädt nur das Ergebnis (`/suchindex.json`) und die reinen Optionen aus
 * `suchoptionen.ts`.
 */
import MiniSearch from 'minisearch';
import { alleMedien, spartenUebersicht, type Medium, type Sparte } from './daten.ts';
import { autorAnzeige } from './anzeige.ts';
import {
  INDEX_VERSION,
  MIN_BEGRIFF,
  MIN_WORTTEIL,
  SUCH_OPTIONEN,
  falteAusgeschrieben,
  falteGrundform,
  zerlegeInWorte,
  type Suchdaten,
} from './suchoptionen.ts';

/**
 * Ein Dokument im Suchindex.
 *
 * Fast alles ist optional, und das ist wörtlich zu nehmen: Felder ohne Wert fehlen
 * ganz, statt als leerer Text dazustehen. MiniSearch würde `""` sonst mitspeichern —
 * bei knapp tausend Einträgen und mehreren Feldern sind das zweistellige Kilobyte
 * für Angaben, die es gar nicht gibt.
 */
export interface Suchdokument {
  id: string;
  sparte: Sparte;
  // durchsuchte Felder
  titel: string;
  autor?: string;
  reihe?: string;
  untertitel?: string;
  verlag?: string;
  genres?: string;
  figur?: string;
  teile?: string;
  // gespeicherte Felder für die Trefferanzeige
  autorAnzeige?: string;
  band?: number;
  art?: string;
  laufzeit_min?: number;
  alter_ab?: number;
  ort?: string;
  jahr?: number;
  seiten?: number;
}

/* ------------------------------------------------------------------ *
 * Textquellen je Feld
 * ------------------------------------------------------------------ */

function autorenText(m: Medium): string {
  return [m.autor, m.autor_nachname, m.autor_vorname, ...(m.weitere_autoren ?? [])]
    .filter(Boolean)
    .join(' ');
}

/** Die durchsuchten Rohtexte eines Mediums, ohne das abgeleitete Feld `teile`. */
function rohtexte(m: Medium): Record<string, string> {
  return {
    titel: m.titel,
    autor: autorenText(m),
    reihe: m.reihe ?? '',
    untertitel: m.untertitel ?? '',
    verlag: m.verlag ?? '',
    genres: (m.genres ?? []).join(' '),
    figur: m.figur ?? '',
  };
}

/* ------------------------------------------------------------------ *
 * Komposita
 * ------------------------------------------------------------------ */

const BINDESTRICH_WORT = /\p{L}+(?:[-‐-―]\p{L}+)+/gu;

/**
 * Sucht in einem zusammengeschriebenen Wort nach Bestandteilen, die anderswo im
 * Bestand als eigenes Wort vorkommen.
 *
 * Kein echter Kompositazerleger, sondern eine Abgleichheuristik gegen den eigenen
 * Wortschatz — und gerade deshalb genau: „Alpenkrimi" wird nur zerlegt, weil „Krimi"
 * im Katalog tatsächlich als Wort existiert. Genommen wird das jeweils längste
 * bekannte Wortende und der längste bekannte Wortanfang, also aus „Kriminalroman"
 * die Teile „roman" und „krimi".
 */
function zerlegeKompositum(wort: string, wortschatz: ReadonlySet<string>): string[] {
  // Ein Kompositum braucht mindestens zwei brauchbare Hälften.
  if (wort.length < MIN_WORTTEIL * 2) return [];

  const teile: string[] = [];
  const MIN_REST = 3;

  // Längstes bekanntes Wortende. Ein Fugen-s wird dabei automatisch übersprungen,
  // weil auch die um ein Zeichen kürzeren Enden geprüft werden.
  for (let start = MIN_REST; start <= wort.length - MIN_WORTTEIL; start++) {
    const ende = wort.slice(start);
    if (wortschatz.has(ende)) {
      teile.push(ende);
      break;
    }
  }

  // Längster bekannter Wortanfang, mit und ohne Fugen-s.
  for (let laenge = wort.length - MIN_REST; laenge >= MIN_WORTTEIL; laenge--) {
    const anfang = wort.slice(0, laenge);
    if (wortschatz.has(anfang)) {
      teile.push(anfang);
      break;
    }
    const ohneFugen = anfang.endsWith('s') ? anfang.slice(0, -1) : '';
    if (ohneFugen.length >= MIN_WORTTEIL && wortschatz.has(ohneFugen)) {
      teile.push(ohneFugen);
      break;
    }
  }

  return teile;
}

/**
 * Das Feld `teile` eines Mediums: Kompositabestandteile und die zusammengeschriebene
 * Form von Bindestrichwörtern.
 *
 * Der Bindestrich wird damit in beide Richtungen erfasst: Die Zerlegung („Island",
 * „Krimi") erledigt schon der Tokenizer, die Zusammenschreibung („islandkrimi")
 * kommt hier dazu.
 */
function baueTeile(m: Medium, wortschatz: ReadonlySet<string>): string {
  const teile = new Set<string>();

  for (const text of Object.values(rohtexte(m))) {
    if (!text) continue;

    for (const zusammengesetzt of text.matchAll(BINDESTRICH_WORT)) {
      const verbunden = falteGrundform(zusammengesetzt[0].replace(/[-‐-―]/gu, ''));
      if (verbunden.length >= MIN_BEGRIFF) teile.add(verbunden);
    }

    for (const wort of zerlegeInWorte(text)) {
      for (const teil of zerlegeKompositum(falteGrundform(wort), wortschatz)) {
        teile.add(teil);
      }
    }
  }

  return [...teile].join(' ');
}

/* ------------------------------------------------------------------ *
 * Wortschatz und Anzeigeformen
 * ------------------------------------------------------------------ */

interface Wortanalyse {
  /** Alle gefalteten Wörter ab MIN_WORTTEIL — Grundlage der Kompositazerlegung. */
  wortschatz: Set<string>;
  /** Gefalteter Begriff → häufigste Schreibweise im Bestand. */
  begriffe: Record<string, string>;
}

function analysiereWorte(medien: Medium[]): Wortanalyse {
  const wortschatz = new Set<string>();
  /** gefaltete Grundform → Schreibweise → Häufigkeit */
  const schreibweisen = new Map<string, Map<string, number>>();

  for (const m of medien) {
    for (const text of Object.values(rohtexte(m))) {
      for (const wort of zerlegeInWorte(text)) {
        const grund = falteGrundform(wort);
        if (grund.length < MIN_BEGRIFF) continue;
        if (grund.length >= MIN_WORTTEIL) wortschatz.add(grund);

        const zaehler = schreibweisen.get(grund) ?? new Map<string, number>();
        zaehler.set(wort, (zaehler.get(wort) ?? 0) + 1);
        schreibweisen.set(grund, zaehler);
      }
    }
  }

  const begriffe: Record<string, string> = {};
  for (const [grund, zaehler] of schreibweisen) {
    const haeufigste = [...zaehler].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    // Eingetragen wird, sobald die Schreibweise im Bestand von der gefalteten Form
    // abweicht — auch wenn es nur die Großschreibung ist. „Meinten Sie: Emmerich?"
    // liest sich deutlich weniger nach Maschine als „Meinten Sie: emmerich?".
    if (haeufigste !== grund) begriffe[grund] = haeufigste;
    const lang = falteAusgeschrieben(haeufigste);
    if (lang !== grund && haeufigste !== lang) begriffe[lang] = haeufigste;
  }

  return { wortschatz, begriffe };
}

/* ------------------------------------------------------------------ *
 * Index
 * ------------------------------------------------------------------ */

/**
 * Der gefaltete Wortvorrat je Medium, als Zeichenkette mit Leerzeichen getrennt.
 *
 * Grundlage der Textsuche innerhalb einer Sparten-Liste. Bewusst hier gebaut und
 * nicht ein zweites Mal in `listendaten.ts`: Es sind dieselbe Faltung, dieselbe
 * Zerlegung und derselbe Wortschatz wie im Suchindex — sonst fände die Liste bei
 * „Alpenkrimi" etwas anderes als die Startseite.
 */
export function baueSuchtexte(medien: Medium[] = alleMedien): Map<string, string> {
  const { wortschatz } = analysiereWorte(medien);
  const texte = new Map<string, string>();

  for (const m of medien) {
    const woerter = new Set<string>();

    for (const text of Object.values(rohtexte(m))) {
      for (const wort of zerlegeInWorte(text)) {
        const grund = falteGrundform(wort);
        if (grund.length >= MIN_BEGRIFF) woerter.add(grund);
      }
    }

    for (const teil of baueTeile(m, wortschatz).split(' ')) {
      if (teil) woerter.add(teil);
    }

    texte.set(m.id, [...woerter].join(' '));
  }

  return texte;
}

/**
 * Leere Texte zu `undefined` machen.
 *
 * `rohtexte` liefert für fehlende Felder den leeren Text, damit die Zerlegung damit
 * rechnen kann. Im Dokument selbst hat er nichts verloren: MiniSearch speichert ihn
 * sonst mit, und `"reihe":"",` × 987 Einträge × mehrere Felder summiert sich auf
 * zweistellige Kilobyte — für Angaben, die es gar nicht gibt.
 */
function ohneLeere<T extends Record<string, string>>(felder: T): { [K in keyof T]: string | undefined } {
  return Object.fromEntries(
    Object.entries(felder).map(([name, wert]) => [name, wert === '' ? undefined : wert]),
  ) as { [K in keyof T]: string | undefined };
}

export function baueDokumente(medien: Medium[] = alleMedien): Suchdokument[] {
  const { wortschatz } = analysiereWorte(medien);

  return medien.map((m) => ({
    id: m.id,
    sparte: m.sparte,
    ...ohneLeere(rohtexte(m)),
    // Nach dem Spread, weil der Titel als Pflichtfeld immer gesetzt ist.
    titel: m.titel,
    teile: baueTeile(m, wortschatz) || undefined,
    autorAnzeige: autorAnzeige(m) || undefined,
    band: m.band,
    art: m.art,
    laufzeit_min: m.laufzeit_min,
    alter_ab: m.alter_ab,
    ort: m.ort,
    jahr: m.jahr,
    seiten: m.seiten,
  }));
}

export function baueSuchdaten(medien: Medium[] = alleMedien): Suchdaten {
  const { begriffe } = analysiereWorte(medien);
  const index = new MiniSearch<Suchdokument>(SUCH_OPTIONEN);
  index.addAll(baueDokumente(medien));

  return {
    version: INDEX_VERSION,
    index: index.toJSON(),
    begriffe,
    // Die Trefferliste gruppiert nach Sparte und braucht dafür Reihenfolge und
    // Bezeichnungen — die kommen mit, damit der Browser die Katalogdaten nicht
    // ebenfalls laden muss.
    sparten: spartenUebersicht.map(({ sparte, bezeichnung }) => ({ sparte, bezeichnung })),
  };
}
