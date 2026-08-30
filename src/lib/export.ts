/**
 * Der Bestand zum Mitnehmen — als Tabelle für Excel und als JSON für später.
 *
 * Zwei Formate, zwei Zwecke (plan.md § 4.7): **JSON** ist das Dateiformat aus `src/data/`,
 * unverändert — die Fassung, die eines Tages in ein Bibliotheksprogramm eingelesen wird.
 * **CSV** ist die Fassung für den täglichen Gebrauch: eine Datei, die in deutschem Excel
 * per Doppelklick aufgeht, mit richtigen Umlauten und ohne Importdialog.
 *
 * **Warum kein `.xlsx`:** Das ist in plan.md § 9 (b) entschieden worden. Die eine
 * zusätzliche Abhängigkeit, die dieser Umbau ausgeben durfte, ist der Vercel-Adapter;
 * `exceljs` wäre die zweite gewesen — für eine fixierte Kopfzeile und gesetzte
 * Spaltenbreiten, also für zwei Handgriffe, die man einmal zeigt. Die Entscheidung ist
 * billig zurückzunehmen: Ein weiteres Format wäre ein weiterer Zweig in `/api/export/`,
 * und an diesem Modul änderte sich nichts.
 *
 * **Die drei Auflagen aus § 9 (b) stehen unten im Code**, jede an ihrer Stelle: das
 * Dezimalkomma bei `preis_eur`, die ISBN als Text und das entschärfte Formelzeichen. Ohne
 * sie gewinnt CSV den Vergleich mit `.xlsx` nicht, sondern verliert ihn — und zwar
 * unbemerkt, denn keiner der drei Fehler sieht in der Tabelle nach einem Fehler aus.
 *
 * Das Modul rechnet nur. Es kennt weder Astro noch die Ablage: Es bekommt Einträge und
 * gibt Text zurück.
 */
import { FELDREIHENFOLGE, zuDateiinhalt } from './bestand.ts';
import { FELDER } from './formular.ts';
import { STANDARD_SORTIERUNG, sortiere } from './sortierung.ts';
import type { Medium, SpartenDatei } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Spalten
 * ------------------------------------------------------------------ */

/**
 * Die Spalten der Tabelle — die Felder des Schemas, in der Reihenfolge des Schemas.
 *
 * Keine eigene Spaltenliste: Wer ein Feld ins Schema aufnimmt, hat es damit auch im
 * Export. `suchtext` fällt als einziges weg — er wird bei jedem Build neu gerechnet
 * (plan.md § 9 (c) 3), steht in keinem heutigen Eintrag mehr und wäre in einer Tabelle
 * eine Spalte voll Wiederholungen.
 */
const SPALTEN: readonly string[] = FELDREIHENFOLGE.filter((feld) => feld !== 'suchtext');

/**
 * Deutsche Überschriften für die drei Felder, die das Formular nicht anbietet.
 *
 * Für alle anderen liefert `formular.ts` die Beschriftung — dieselbe, die im Formular
 * über dem Feld steht und die ihrerseits aus `anzeige.ts` und dem Schema stammt. Diese
 * drei kommen dort nicht vor, weil sie niemand von Hand pflegt; in der Tabelle sind sie
 * trotzdem nützlich: `_pruefen` ist die Arbeitsliste der Nachkontrolle, `_quelle` der
 * Beleg auf die Zeile im Word-Dokument.
 */
const WEITERE_UEBERSCHRIFTEN: Record<string, string> = {
  cover_url: 'Coverbild',
  _quelle: 'Quellzeile aus dem Dokument',
  _pruefen: 'Prüfvermerke aus dem Import',
};

/** Die Überschrift einer Spalte. */
function ueberschrift(feld: string): string {
  return (
    FELDER.find((eintrag) => eintrag.name === feld)?.beschriftung ??
    WEITERE_UEBERSCHRIFTEN[feld] ??
    feld
  );
}

/* ------------------------------------------------------------------ *
 * Ein einzelner Wert
 * ------------------------------------------------------------------ */

/**
 * Zeichen, mit denen ein Feld nicht beginnen darf.
 *
 * Excel und LibreOffice lesen eine Zelle, die mit `=`, `+`, `-` oder `@` anfängt, als
 * Formel. `notiz` und `_quelle` sind Freitext aus einem Word-Dokument; ein führender
 * Gedankenstrich genügt, und statt des Textes steht `#NAME?` in der Tabelle — oder, im
 * schlimmeren Fall, etwas, das aussieht wie ein Wert. Ein vorangestelltes Hochkomma sagt
 * beiden Programmen „das ist Text"; angezeigt wird es nicht.
 */
const FORMELZEICHEN = /^[=+\-@\t\r]/;

/**
 * Macht aus einem Wert den Text, der in der Zelle steht.
 *
 * Drei Sonderfälle, alle drei aus plan.md § 9 (b):
 *
 * - **`preis_eur` mit Dezimalkomma.** Deutsches Excel liest `13.4` als **Datum 13.04.**,
 *   und das fällt niemandem auf, bis jemand die Spalte summiert. Betroffen wären 791 der
 *   987 Einträge.
 * - **Die ISBN als Text.** Eine dreizehnstellige Ziffernfolge wird sonst zu `9,78333E+12`,
 *   und danach ist die Spalte weder durchsuchbar noch sortierbar. Das Hochkomma erzwingt
 *   Text — dieselbe Regel wie beim Formelzeichen, nur aus dem umgekehrten Grund. Daneben
 *   steht die Fassung mit Bindestrichen aus `isbn_formatiert`, die von sich aus Text ist.
 * - **Listen** (`genres`, `weitere_autoren`, `_pruefen`) werden zu einer Aufzählung mit
 *   Komma. Eine Zelle je Genre gäbe es in einer Tabelle nicht.
 */
function zelle(feld: string, wert: unknown): string {
  if (wert === undefined || wert === null) return '';

  if (Array.isArray(wert)) return wert.join(', ');

  if (feld === 'preis_eur' && typeof wert === 'number') {
    return wert.toFixed(2).replace('.', ',');
  }

  const text = String(wert);

  if (feld === 'isbn' && text !== '') return `'${text}`;

  return FORMELZEICHEN.test(text) ? `'${text}` : text;
}

/**
 * Setzt eine Zelle so, dass sie den Trenner überlebt.
 *
 * Anführungszeichen nur, wenn sie gebraucht werden — sonst stünden sie in jeder Zelle und
 * die Datei wäre im Texteditor nicht mehr zu lesen. Innerhalb der Anführungszeichen wird
 * ein Anführungszeichen verdoppelt; so schreibt es RFC 4180, und so liest es Excel.
 */
function maskiere(text: string): string {
  if (!/[;"\r\n]/.test(text) && text.trim() === text) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/* ------------------------------------------------------------------ *
 * Die ganze Datei
 * ------------------------------------------------------------------ */

/**
 * Das Byte-Vorzeichen am Dateianfang.
 *
 * Ohne dieses eine Zeichen liest deutsches Excel eine UTF-8-Datei beim Doppelklick als
 * Windows-1252 — aus „Bücherei" wird „BÃ¼cherei". Mit ihm stimmt es, ohne dass jemand
 * einen Importdialog sieht. Das ist der ganze Grund, warum CSV in dieser Entscheidung
 * gegen `.xlsx` bestehen kann.
 */
const BOM = '﻿';

/**
 * Zeilenende `\r\n`, anders als bei den Datendateien.
 *
 * Dort ist `\n` Pflicht, weil die Dateien durch Git gehen (`.gitattributes`). Diese Datei
 * geht durch keinen Git-Baum, sondern direkt in einen Download unter Windows — und ältere
 * Excel-Fassungen zeigen eine Datei mit reinem `\n` als eine einzige lange Zeile.
 */
const ZEILENENDE = '\r\n';

/**
 * Der gesamte Bestand als Tabelle.
 *
 * Sortiert wie im Katalog (`STANDARD_SORTIERUNG`): Wer die Tabelle neben die Website legt,
 * findet dieselbe Reihenfolge. Beim Export mehrerer Sparten stehen sie damit gemischt, aber
 * durchgehend nach Autor geordnet — die Spalte „Sparte" trennt sie in Excel mit einem
 * Klick auf den Filter.
 */
export function zuCsv(medien: readonly Medium[]): string {
  const zeilen = [SPALTEN.map((feld) => maskiere(ueberschrift(feld))).join(';')];

  for (const medium of sortiere([...medien], STANDARD_SORTIERUNG)) {
    const roh = medium as unknown as Record<string, unknown>;
    zeilen.push(SPALTEN.map((feld) => maskiere(zelle(feld, roh[feld]))).join(';'));
  }

  return BOM + zeilen.join(ZEILENENDE) + ZEILENENDE;
}

/**
 * Der Bestand als JSON — dasselbe Format wie in `src/data/`.
 *
 * Bei **einer** Sparte ist das Ergebnis die Datei selbst, Byte für Byte so, wie sie im
 * Repository steht: `zuDateiinhalt` ist dieselbe Funktion, die auch beim Speichern
 * schreibt, und `npm run formattest` beweist deren Byte-Gleichheit an allen vorhandenen
 * Dateien. Wer eine Sparte exportiert und die Datei zurückspielt, hat keinen Unterschied
 * erzeugt.
 *
 * Bei **mehreren** wird daraus eine Liste dieser Dateien. Ein zusammengefasstes Objekt
 * mit allen Einträgen wäre ein drittes Format, das es sonst nirgends gibt — und der
 * Datenstand je Sparte ginge dabei verloren. Der Umweg über `JSON.parse` ist Absicht: Er
 * übernimmt die Feldreihenfolge, die `zuDateiinhalt` gesetzt hat, statt sie ein zweites
 * Mal herzustellen.
 */
export function zuJson(dateien: readonly SpartenDatei[]): string {
  if (dateien.length === 1) return zuDateiinhalt(dateien[0]!);

  const inhalte = dateien.map((datei) => JSON.parse(zuDateiinhalt(datei)) as unknown);
  return `${JSON.stringify(inhalte, null, 2)}\n`;
}

/* ------------------------------------------------------------------ *
 * Der Dateiname
 * ------------------------------------------------------------------ */

/** Was in den Dateinamen kommt, wenn nicht eine einzelne Sparte gewählt wurde. */
export const ALLE = 'alle';

/**
 * Der Name der heruntergeladenen Datei: `buecherei-<sparte>-<datum>.<endung>`.
 *
 * Mit Datum, weil im Downloadordner sonst `buecherei-romane (3).csv` liegt und niemand
 * mehr weiß, welche die neuere ist. Das Datum steht in der Form `JJJJ-MM-TT` — so ordnet
 * eine alphabetische Dateiliste die Ausgaben von selbst nach Alter.
 */
export function dateiname(sparte: string, datum: string, endung: 'csv' | 'json'): string {
  return `buecherei-${sparte}-${datum}.${endung}`;
}
