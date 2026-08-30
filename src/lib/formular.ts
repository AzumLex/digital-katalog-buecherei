/**
 * Das Formular der Verwaltung — beschrieben, nicht gezeichnet.
 *
 * Dieses Modul sagt, **welche Felder es gibt**, wie sie heißen, was sie annehmen und
 * wohin sie gehören. Wie sie aussehen, sagt `src/components/Medienformular.astro`; was
 * mit ihnen passiert, sagt `src/scripts/verwaltungsformular.ts`. Die Trennung lohnt sich,
 * weil dieselbe Beschreibung an drei Stellen gebraucht wird: beim Bauen der Seite auf dem
 * Server, beim Ein- und Ausblenden im Browser und beim Zusammensetzen des Eintrags vor
 * dem Absenden. Drei Fassungen davon würden auseinanderlaufen — und zwar unbemerkt, denn
 * ein Feld, das im Browser anders heißt als im HTML, fällt niemandem auf, bis eine Angabe
 * fehlt.
 *
 * **Nichts hier ist von Hand aufgezählt, was aus dem Schema kommen kann.** Welche Felder
 * es gibt, welchen Typ sie haben, was erlaubt ist und was sie bedeuten, steht in
 * `schema/medium.schema.json` — dem Torwächter, der die Daten ohnehin annimmt oder
 * ablehnt. Ein neues Feld im Schema erscheint im Formular, ohne dass diese Datei
 * angefasst wird.
 *
 * **Auch die Gruppierung ist nicht neu erfunden.** Welches Feld unter „Inhalt“,
 * „Ausgabe“ oder „In der Bücherei“ steht, beantwortet `src/lib/anzeige.ts` — dieselbe
 * Aufteilung, die der Katalog auf der Detailseite zeigt. Wie sie hier ausgelesen wird,
 * steht bei `gruppiereAusAnzeige()`.
 *
 * Das Modul läuft auch im Browser. Es darf deshalb aus `daten.ts` **nichts** holen außer
 * Typen: Jenes Modul zieht beim Laden den gesamten Bestand nach — im Bündel des Browsers
 * wären das Megabyte an Katalogdaten für eine Handvoll Feldnamen.
 */
import schema from '../../schema/medium.schema.json' with { type: 'json' };
import { FELDREIHENFOLGE } from './bestand.ts';
import { angabenAusgabe, angabenBestand, angabenInhalt } from './anzeige.ts';
import type { Medienform, Medium, Sparte } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Was das Schema über ein Feld sagt
 * ------------------------------------------------------------------ */

/**
 * Die Angaben eines Schemafeldes, soweit das Formular sie braucht.
 *
 * Als eigenes Interface und mit einer Umdeutung darunter, weil TypeScript aus der
 * eingelesenen JSON-Datei für jedes Feld einen eigenen Typ ableitet: `enum` gibt es nur
 * bei manchen, `minimum` nur bei anderen. Ohne diesen Schritt müsste jeder Zugriff
 * einzeln abgesichert werden, und die Datei bestünde zur Hälfte aus Beschwichtigungen
 * für den Typprüfer.
 */
interface Schemafeld {
  type?: string | string[];
  enum?: string[];
  description?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  format?: string;
  default?: unknown;
}

const EIGENSCHAFTEN = schema.properties as unknown as Record<string, Schemafeld>;
const PFLICHTFELDER: readonly string[] = schema.required;

/* ------------------------------------------------------------------ *
 * Gruppen
 * ------------------------------------------------------------------ */

export type Gruppe = 'werk' | 'inhalt' | 'ausgabe' | 'bestand';

/**
 * Die Abschnitte des Formulars, in der Reihenfolge, in der sie erscheinen.
 *
 * Die letzten drei Überschriften sind wörtlich die der Detailseite: Wer den Katalog
 * kennt, findet ein Feld dort, wo die Angabe später steht. Der erste Abschnitt hat auf
 * der Detailseite keine Überschrift — dort ist er der Kopf mit Reihe, Titel und Autor.
 */
export const GRUPPEN: ReadonlyArray<{ name: Gruppe; titel: string; erklaerung: string }> = [
  {
    name: 'werk',
    titel: 'Titel und Autor',
    erklaerung: 'Wovon ist die Rede. Pflicht sind nur Sparte, Art des Mediums und Titel.',
  },
  {
    name: 'inhalt',
    titel: 'Inhalt',
    erklaerung: 'Worum es geht, für wen es ist, wie lange es dauert.',
  },
  {
    name: 'ausgabe',
    titel: 'Ausgabe',
    erklaerung: 'Die Angaben aus dem Impressum: Verlag, Jahr, Umfang, ISBN.',
  },
  {
    name: 'bestand',
    titel: 'In der Bücherei',
    erklaerung: 'Was dieses Exemplar betrifft — Zustand, Anzahl, Standort.',
  },
];

/* ------------------------------------------------------------------ *
 * Felder
 * ------------------------------------------------------------------ */

export type Feldart = 'text' | 'mehrzeilig' | 'zahl' | 'kommazahl' | 'auswahl' | 'liste' | 'datum';

/** Zu welcher Sparte und welcher Medienform ein Feld passt. */
export interface Passung {
  sparten?: readonly Sparte[];
  medien?: readonly Medienform[];
}

export interface Feld {
  name: string;
  beschriftung: string;
  gruppe: Gruppe;
  art: Feldart;
  pflicht: boolean;
  /** Der Erklärsatz unter dem Feld — aus der `description` des Schemas. */
  hilfe?: string;
  auswahl?: readonly string[];
  muster?: string;
  min?: number;
  max?: number;
  /**
   * Der Wert, mit dem ein neues Formular vorbelegt wird — aus `default` im Schema.
   *
   * Damit steht die Vorbelegung dort, wo auch die Bedeutung des Feldes steht: „bestand:
   * 1“ und „status: verfuegbar“ sind Aussagen über die Daten, nicht über das Formular.
   */
  vorgabe?: string;
  /** Fehlt die Angabe, passt das Feld überall. */
  passung?: Passung;
}

/**
 * Felder, die das Formular nicht anbietet.
 *
 * Keines davon wird von Hand gepflegt, und drei davon dürfen gar nicht verändert werden:
 * `suchtext` rechnet der Build bei jedem Lauf neu aus (plan.md § 9 (c) 3), `_quelle` ist
 * der Beleg auf die Zeile im Word-Dokument, `_pruefen` die Arbeitsliste des Imports.
 * `cover_url` steht hier, weil es keine Coverbilder gibt — ein Pfadfeld ohne Bilder ist
 * nur eine Gelegenheit, sich zu vertippen.
 *
 * **Weggeworfen wird deshalb nichts.** Was ein vorhandener Eintrag in diesen Feldern
 * trägt, führt das Formular unverändert mit (siehe `mitgefuehrteFelder`) und schickt es
 * beim Speichern zurück. Sonst verlöre der erste bearbeitete Tonie seinen `_quelle`-Beleg.
 */
const NICHT_IM_FORMULAR = ['suchtext', '_quelle', '_pruefen', 'cover_url'] as const;

/** Felder, die ein mehrzeiliges Eingabefeld bekommen, weil dort Sätze stehen. */
const MEHRZEILIG: readonly string[] = ['notiz'];

/**
 * Beschriftungen, die nicht aus `anzeige.ts` kommen können.
 *
 * Zwei Fälle: Felder, die auf der Detailseite keine eigene Zeile haben — der Titel steht
 * dort als Überschrift und nicht als Angabe „Titel: …“ —, und Felder, die sich eine Zeile
 * teilen: `spieler_min` und `spieler_max` werden dort zu „2–4 Spieler“ zusammengefasst,
 * im Formular müssen sie aber einzeln anzusprechen sein.
 *
 * Wo ein Feld eine Einheit hat, steht sie in der Beschriftung. „Laufzeit“ allein lädt zur
 * Eingabe von „1:30“ ein, und im Schema steht eine ganze Zahl in Minuten.
 */
const BESCHRIFTUNGEN: Record<string, string> = {
  id: 'Kennung (id)',
  sparte: 'Sparte',
  medium: 'Art des Mediums',
  titel: 'Titel',
  untertitel: 'Untertitel',
  reihe: 'Reihe',
  band: 'Band',
  autor: 'Autor, wie er auf dem Buch steht',
  autor_nachname: 'Nachname (danach wird sortiert)',
  autor_vorname: 'Vorname',
  weitere_autoren: 'Weitere Beteiligte',
  uebersetzung: 'Übersetzung von',
  figur: 'Figur',
  genres: 'Genres',
  seiten: 'Umfang in Seiten',
  isbn: 'ISBN, nur Ziffern',
  isbn_formatiert: 'ISBN mit Bindestrichen',
  preis_eur: 'Preis',
  waehrung_original: 'Währung des Originalpreises',
  spieler_min: 'Spieler mindestens',
  spieler_max: 'Spieler höchstens',
  spieldauer_min: 'Spieldauer in Minuten',
  laufzeit_min: 'Laufzeit in Minuten',
  alter_ab: 'Empfohlen ab (Jahre)',
  erfasst_am: 'Aufgenommen am',
};

/**
 * Gruppen für die Felder, die auf der Detailseite im Kopf stehen statt in einer Liste.
 *
 * Alles, was weder hier noch über `gruppiereAusAnzeige()` eine Zuordnung findet, landet
 * im ersten Abschnitt. Das ist Absicht: Ein neues Feld im Schema soll oben auffallen und
 * nicht unauffindbar sein, bis jemand diese Datei ergänzt.
 */
const GRUPPE_ERSATZ: Record<string, Gruppe> = {
  id: 'werk',
  sparte: 'werk',
  medium: 'werk',
  titel: 'werk',
  untertitel: 'werk',
  reihe: 'werk',
  band: 'werk',
  autor: 'werk',
  autor_nachname: 'werk',
  autor_vorname: 'werk',
  weitere_autoren: 'werk',
  // Die Figur steht auf der Detailseite ganz oben, gehört aber zum Inhalt: Sie beschreibt,
  // was man in der Hand hält.
  figur: 'inhalt',
  // Ohne Preis erzeugt die Währung keine Zeile — sie kann sich also nicht selbst finden.
  waehrung_original: 'ausgabe',
};

/**
 * Hilfetexte, die den des Schemas **ersetzen**.
 *
 * Bisher genau einer. Die Beschreibung von `status` erklärt einem Entwickler, warum es
 * das Feld schon gibt („damit die spätere Ausleihverwaltung keine Datenmigration
 * braucht“) — unter dem Auswahlfeld der Bücherei steht dagegen die Frage, die dort
 * wirklich ansteht: aussortiert oder aus Versehen angelegt? Das ist der Unterschied
 * zwischen „ausgeschieden“ und „Löschen“, und er gehört an die Stelle, an der er
 * entschieden wird (plan.md § 4.5).
 */
const HILFE_ERSATZ: Record<string, string> = {
  status:
    'Ein Buch, das aussortiert, verkauft oder verschenkt wurde, bekommt hier ' +
    '„ausgeschieden“ — der Eintrag bleibt dann im Katalog sichtbar, mit seiner ' +
    'Geschichte. Gelöscht wird nur, was aus Versehen angelegt wurde.',
};

/** Ergänzungen zum Hilfetext des Schemas, wo der für die Bücherei zu knapp ist. */
const HILFE_ZUSATZ: Record<string, string> = {
  id:
    'Drei Kleinbuchstaben, ein Bindestrich, dann Kleinbuchstaben, Ziffern und ' +
    'Bindestriche — zum Beispiel „rom-die-rote-frau“.',
  weitere_autoren: 'Mehrere durch Komma trennen.',
  genres: 'Mehrere durch Komma trennen.',
  titel: 'Ohne Reihen- und Bandangabe — die haben eigene Felder.',
};

/** Die vier Sparten, in denen Bücher stehen — gebraucht für die Passung unten. */
const BUCHSPARTEN: readonly Sparte[] = [
  'romane',
  'sachbuecher',
  'kinderbuecher',
  'kinder-sachbuecher',
];

/**
 * Welche Felder zu welcher Sparte und welcher Medienform passen.
 *
 * Diese Zuordnung ist die einzige im Formular, die **nicht** aus dem Schema kommt, und
 * das aus einem Grund: Das Schema sagt sie nur in Prosa („Nur Tonies/CDs“, „Nur Tonies“),
 * und Prosa auszuwerten wäre geraten statt gewusst. Aus den Daten ableiten — so wie
 * `facetten.ts` es für die Filter tut — geht hier ebenfalls nicht: Fünf der sieben Sparten
 * sind noch leer, und ein Formular, das nur anbietet, was dort schon einmal eingetragen
 * wurde, ließe dort nie etwas eintragen.
 *
 * **Beide Richtungen zählen.** Ein Feld bleibt sichtbar, wenn es zur gewählten Sparte
 * *oder* zur gewählten Medienform passt. Das Schema trennt die beiden ausdrücklich („weil
 * z. B. ein Sachbuch auch als CD vorliegen kann“) — ein Sachbuch als Hörbuch-CD braucht
 * die Laufzeit, obwohl seine Sparte „sachbuecher“ heißt.
 *
 * Nur Einschränkungen stehen hier. Was fehlt, passt überall: Verlag, Jahr, Genre und
 * Notiz gibt es bei einem Spiel so gut wie bei einem Roman.
 */
const PASSUNG: Record<string, Passung> = {
  art: { sparten: ['tonies', 'cds'], medien: ['Tonie', 'CD', 'DVD'] },
  laufzeit_min: { sparten: ['tonies', 'cds'], medien: ['Tonie', 'CD', 'DVD'] },
  figur: { sparten: ['tonies'], medien: ['Tonie'] },
  spieler_min: { sparten: ['spiele'], medien: ['Spiel'] },
  spieler_max: { sparten: ['spiele'], medien: ['Spiel'] },
  spieldauer_min: { sparten: ['spiele'], medien: ['Spiel'] },
  seiten: { sparten: BUCHSPARTEN, medien: ['Buch', 'Zeitschrift'] },
  einband: { sparten: BUCHSPARTEN, medien: ['Buch', 'Zeitschrift'] },
  auflage: { sparten: BUCHSPARTEN, medien: ['Buch', 'Zeitschrift'] },
  isbn: { sparten: BUCHSPARTEN, medien: ['Buch', 'Zeitschrift'] },
  isbn_formatiert: { sparten: BUCHSPARTEN, medien: ['Buch', 'Zeitschrift'] },
};

/* ------------------------------------------------------------------ *
 * Gruppe und Beschriftung aus anzeige.ts holen
 * ------------------------------------------------------------------ */

const GRUPPENFUNKTIONEN: ReadonlyArray<[Gruppe, (m: Medium) => Array<{ label: string }>]> = [
  ['inhalt', angabenInhalt],
  ['ausgabe', angabenAusgabe],
  ['bestand', angabenBestand],
];

/**
 * Ein Beispielwert für ein Feld, mit dem sich die Anzeige befragen lässt.
 *
 * Der Wert muss nur eines können: als „gesetzt“ durchgehen. `istGesetzt()` in `anzeige.ts`
 * lässt die Null durch — sie ist eine Zahl wie jede andere —, deshalb ist auch ein Feld
 * mit `minimum: 0` unproblematisch.
 */
function probewert(feld: Schemafeld): unknown {
  if (feld.enum) return feld.enum[0];

  const typ = Array.isArray(feld.type) ? feld.type[0] : feld.type;
  if (typ === 'integer' || typ === 'number') return feld.minimum ?? 1;
  if (typ === 'array') return ['Probe'];
  return feld.format === 'date' ? '2000-01-01' : 'Probe';
}

/**
 * Fragt `anzeige.ts`, wohin ein Feld gehört und wie es heißt.
 *
 * Der Kunstgriff ist die Umkehrung: Statt hier eine zweite Liste zu führen, welches Feld
 * unter „Ausgabe“ steht, bekommt jede der drei Funktionen ein Medium vorgelegt, an dem
 * **nur dieses eine Feld** gesetzt ist. Die Funktion, die daraufhin eine Zeile
 * zurückgibt, ist die Gruppe des Feldes, und die Beschriftung dieser Zeile ist seine
 * Beschriftung. Möglich ist das, weil alle drei ausdrücklich nur Zeilen einsammeln, die
 * einen Wert haben.
 *
 * Damit gibt es die Zuordnung genau einmal im Projekt. Wandert `Preis` eines Tages von
 * „Ausgabe“ nach „In der Bücherei“, wandert das Feld im Formular mit, ohne dass jemand
 * daran denken muss.
 *
 * Der Preis dafür sind gut hundert Aufrufe beim Laden des Moduls — einmal je Feld und
 * Gruppe, auf Objekten mit einem einzigen Schlüssel. Das ist billiger als jede andere
 * Form von Wahrheit.
 */
function gruppiereAusAnzeige(
  name: string,
  feld: Schemafeld,
): { gruppe: Gruppe; beschriftung: string } | undefined {
  const probe = { [name]: probewert(feld) } as unknown as Medium;

  for (const [gruppe, angaben] of GRUPPENFUNKTIONEN) {
    const zeilen = angaben(probe);
    if (zeilen.length > 0) return { gruppe, beschriftung: zeilen[0].label };
  }

  return undefined;
}

/* ------------------------------------------------------------------ *
 * Die Felderliste
 * ------------------------------------------------------------------ */

function bestimmeArt(name: string, feld: Schemafeld): Feldart {
  if (feld.enum) return 'auswahl';

  const typen = Array.isArray(feld.type) ? feld.type : [feld.type];
  if (typen.includes('array')) return 'liste';
  if (feld.format === 'date') return 'datum';
  if (typen.includes('integer')) return 'zahl';
  if (typen.includes('number')) return 'kommazahl';

  return MEHRZEILIG.includes(name) ? 'mehrzeilig' : 'text';
}

function baueFeld(name: string): Feld {
  const eigenschaft = EIGENSCHAFTEN[name];
  const ausAnzeige = gruppiereAusAnzeige(name, eigenschaft);
  const hilfe =
    HILFE_ERSATZ[name] ?? [eigenschaft.description, HILFE_ZUSATZ[name]].filter(Boolean).join(' ');

  return {
    name,
    beschriftung: BESCHRIFTUNGEN[name] ?? ausAnzeige?.beschriftung ?? name,
    gruppe: GRUPPE_ERSATZ[name] ?? ausAnzeige?.gruppe ?? 'werk',
    art: bestimmeArt(name, eigenschaft),
    pflicht: PFLICHTFELDER.includes(name),
    hilfe: hilfe || undefined,
    auswahl: eigenschaft.enum,
    muster: eigenschaft.pattern,
    min: eigenschaft.minimum,
    max: eigenschaft.maximum,
    vorgabe: eigenschaft.default === undefined ? undefined : zuFormularwert(eigenschaft.default),
    passung: PASSUNG[name],
  };
}

/**
 * Alle Felder des Formulars, in der Reihenfolge des Schemas.
 *
 * Dieselbe Reihenfolge, in der die Felder auch in den Dateien stehen (`FELDREIHENFOLGE`
 * aus `bestand.ts`): Wer eine Datei im Repository ansieht und wer das Formular ausfüllt,
 * sieht dieselbe Abfolge.
 */
export const FELDER: readonly Feld[] = FELDREIHENFOLGE.filter(
  (name) => !(NICHT_IM_FORMULAR as readonly string[]).includes(name),
).map(baueFeld);

/** Die Felder eines Abschnitts. */
export function felderDerGruppe(gruppe: Gruppe): Feld[] {
  return FELDER.filter((feld) => feld.gruppe === gruppe);
}

/**
 * Passt dieses Feld zur gewählten Sparte oder Medienform?
 *
 * Ist noch nichts gewählt — der erste Augenblick auf `/verwaltung/neu/` —, gilt jedes
 * Feld als passend: Lieber eines zu viel zeigen als eines verstecken, das gebraucht wird.
 */
export function passt(feld: Feld, sparte?: string, medium?: string): boolean {
  if (!feld.passung) return true;
  if (!sparte && !medium) return true;

  const { sparten, medien } = feld.passung;
  if (sparte && sparten?.includes(sparte as Sparte)) return true;
  if (medium && medien?.includes(medium as Medienform)) return true;

  return false;
}

/* ------------------------------------------------------------------ *
 * Zwischen Eintrag und Formularfeldern
 * ------------------------------------------------------------------ */

/** Der Wert eines Feldes, wie er im Eingabefeld steht. */
export function zuFormularwert(wert: unknown): string {
  if (wert === undefined || wert === null) return '';
  if (Array.isArray(wert)) return wert.join(', ');
  return String(wert);
}

/**
 * Die Felder eines Eintrags, die das Formular nicht anbietet.
 *
 * Sie gehen als versteckte Beigabe durch das Formular und kommen beim Speichern
 * unverändert zurück. Ohne diesen Weg verlöre jeder bearbeitete Eintrag seinen
 * `_quelle`-Beleg und seine `_pruefen`-Liste — und zwar stillschweigend, weil
 * `eintragAendern` den alten Eintrag vollständig ersetzt und nicht mit ihm verschmilzt.
 */
export function mitgefuehrteFelder(eintrag: Medium): Record<string, unknown> {
  const roh = eintrag as unknown as Record<string, unknown>;
  const mitgefuehrt: Record<string, unknown> = {};

  for (const name of NICHT_IM_FORMULAR) {
    // `suchtext` bleibt bewusst draußen: Er wird bei jedem Build neu gerechnet, und ein
    // mitgeschleppter alter Wert stünde neben einem berichtigten Titel (plan.md § 9 (c) 3).
    if (name === 'suchtext') continue;
    if (roh[name] !== undefined && roh[name] !== null) mitgefuehrt[name] = roh[name];
  }

  return mitgefuehrt;
}

/**
 * Baut aus den Eingaben einen Eintrag, wie ihn `pruefeMedium` erwartet.
 *
 * **Leeres Feld heißt: kein Feld.** Das ist die Regel aus plan.md § 9 (c), und sie steht
 * hier zum zweiten Mal — `ohneLeereFelder` in `bestand.ts` setzt sie für jeden Schreibweg
 * durch, auch für den, der nicht durch dieses Formular geht. Die Wiederholung ist
 * gewollt: Was hier schon wegfällt, taucht in der Prüfung nicht als „muss Text sein“ auf,
 * und niemand bekommt eine Fehlermeldung zu einem Feld, das er absichtlich leer gelassen
 * hat.
 *
 * Zahlen, die keine sind, gehen **als Text** weiter, statt zu `NaN` zu werden: So sagt
 * die Prüfung „jahr muss eine ganze Zahl sein“ und nicht „jahr muss leer sein“.
 */
export function ausFormularwerten(
  werte: Record<string, string>,
  mitgefuehrt: Record<string, unknown> = {},
): Record<string, unknown> {
  const eintrag: Record<string, unknown> = { ...mitgefuehrt };

  for (const feld of FELDER) {
    const roh = (werte[feld.name] ?? '').trim();
    if (roh === '') continue;

    if (feld.art === 'liste') {
      const teile = roh
        .split(',')
        .map((teil) => teil.trim())
        .filter((teil) => teil !== '');
      if (teile.length > 0) eintrag[feld.name] = teile;
      continue;
    }

    if (feld.art === 'zahl' || feld.art === 'kommazahl') {
      // Das Komma als Dezimaltrennzeichen ist hierzulande das erwartete; „12,90“ soll
      // nicht als Fehler zurückkommen, nur weil JavaScript den Punkt bevorzugt.
      const zahl = Number(roh.replace(',', '.'));
      eintrag[feld.name] = Number.isFinite(zahl) ? zahl : roh;
      continue;
    }

    eintrag[feld.name] = roh;
  }

  return eintrag;
}
