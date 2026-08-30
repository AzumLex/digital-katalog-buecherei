/**
 * Der Bestand als Datei — Einfügen, Ändern, Entfernen, und zurück in Text.
 *
 * Zwischen dem Formular der Verwaltung und dem Repository liegt genau eine Frage:
 * Wie sieht die Spartendatei nach der Änderung aus? Dieses Modul beantwortet sie —
 * und sonst nichts. Es kennt weder GitHub noch das Dateisystem noch Astro: Es bekommt
 * den Inhalt einer Datei und einen Eintrag, und gibt den neuen Inhalt zurück. Damit
 * lässt sich der gesamte Schreibweg prüfen, ohne dass je ein Commit entsteht — genau
 * das tut `scripts/formattest.mjs`.
 *
 * Diese Trennung ist dieselbe wie bei `pruefung.ts` und aus demselben Grund: Wenn
 * `github.ts` eines Tages `datenbank.ts` weicht (plan.md § 7), bleibt hier alles wie
 * es ist. Das Modul weiß nicht, wohin sein Text geschrieben wird.
 *
 * **Byte-Gleichheit ist kein Selbstzweck.** Die Verwaltung schreibt Commits, die
 * jemand in der GitHub-Oberfläche nachlesen können soll. Würde die Serialisierung
 * auch nur die Feldreihenfolge anders schreiben als die Datei sie hat, stünde neben
 * jeder geänderten Zeile ein Diff über die ganze Datei, und die eigentliche Änderung
 * wäre nicht mehr auffindbar. Deshalb schreibt dieses Modul exakt das Format der
 * vorhandenen Dateien, und `npm run formattest` beweist das bei jedem Lauf an allen
 * 987 Einträgen.
 */
import schema from '../../schema/medium.schema.json' with { type: 'json' };
import { STANDARD_SORTIERUNG, sortiere } from './sortierung.ts';

/**
 * Nur der Typ, nie das Modul selbst — wie in `pruefung.ts`.
 *
 * `daten.ts` liest beim Laden über `import.meta.glob` den ganzen Bestand ein; das kann
 * nur Vite, nicht das nackte Node aus `scripts/formattest.mjs`. Ein `import type`
 * verschwindet beim Type-Stripping restlos, ein gewöhnlicher Import an dieser Stelle
 * würde `daten.ts` ausführen und das Prüfskript zerlegen. Diese Zeile darf also nie
 * ihre Form ändern.
 */
import type { Medium, SpartenDatei } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Format
 * ------------------------------------------------------------------ */

/**
 * Die Feldreihenfolge eines Eintrags — aus dem Schema, nicht von Hand.
 *
 * `schema/medium.schema.json` ist die maßgebliche Quelle für Felder; eine zweite
 * Liste hier wäre die zweite Wahrheit, die beim nächsten neuen Feld auseinanderläuft.
 * Wer ein Feld ins Schema aufnimmt, bestimmt damit zugleich, an welcher Stelle es in
 * den Dateien steht — und `formattest` sagt sofort Bescheid, wenn das die vorhandenen
 * Dateien nicht mehr trifft.
 */
export const FELDREIHENFOLGE: readonly string[] = Object.keys(schema.properties);

/**
 * Die Reihenfolge der Angaben am Dateikopf.
 *
 * Steht als einzige Reihenfolge hier und nicht im Schema: Das Schema beschreibt ein
 * Medium, nicht die Datei, die eine Sparte zusammenfasst. Die Liste ist die von
 * `SpartenDatei` in `daten.ts` und die der heutigen Dateien.
 */
const DATEIFELDER = ['sparte', 'bezeichnung', 'stand', 'quelle', 'anzahl', 'items'] as const;

/**
 * Der Papierkorb als Datei (plan.md § 4.5).
 *
 * Fast eine Spartendatei, aber ohne `sparte` und `quelle`: Was hier liegt, kommt aus
 * allen sieben Sparten, und woher der einzelne Eintrag stammt, steht in ihm selbst
 * (`eintrag.sparte`) — genau daran findet das Wiederherstellen die richtige Datei
 * zurück. Ein erfundener Sparten-Wert im Dateikopf wäre die einzige Stelle im Projekt,
 * an der etwas anderes stünde als die sieben Werte des Schemas.
 *
 * Ein **Datum je Eintrag** gibt es bewusst nicht. Das Schema verbietet zusätzliche
 * Felder, und ein Eintrag, der aus dem Papierkorb zurückkommt, muss derselbe sein, der
 * hineingegangen ist — nicht einer mit einem Zusatzfeld, das die Prüfung dann ablehnt.
 * Wann etwas gelöscht wurde, steht in der Historie: Jeder Löschvorgang ist ein Commit
 * mit Datum und Titel in der Meldung.
 */
export interface Papierkorbdatei {
  bezeichnung: string;
  /** Datum der letzten Änderung am Papierkorb, wie `stand` bei den Spartendateien. */
  stand: string;
  anzahl: number;
  items: Medium[];
}

/** Was `zuDateiinhalt` schreiben kann: eine Spartendatei oder der Papierkorb. */
type Bestandsinhalt = SpartenDatei | Papierkorbdatei;

/**
 * Bringt die Felder eines Eintrags in die Reihenfolge des Schemas.
 *
 * `JSON.stringify` schreibt die Felder in der Reihenfolge, in der sie im Objekt
 * angelegt wurden — deshalb genügt es, das Objekt neu aufzubauen. Felder, die der
 * Eintrag nicht hat, entstehen dabei nicht: `undefined` ist kein Wert, den ein
 * neu gesetzter Schlüssel bekommen dürfte, sonst stünde er als `null` in der Datei.
 *
 * Felder, die das Schema **nicht** kennt, werden hinten angehängt statt weggeworfen.
 * Das Schema verbietet sie (`additionalProperties: false`) und `pruefeMedium` meldet
 * sie — aber ein Schreibweg, der stillschweigend Daten verliert, ist das schlechtere
 * Übel: Ein unbekanntes Feld soll im Diff auffallen, nicht spurlos verschwinden.
 */
function inSchemareihenfolge(eintrag: Medium): Record<string, unknown> {
  const roh = eintrag as unknown as Record<string, unknown>;
  const geordnet: Record<string, unknown> = {};

  for (const feld of FELDREIHENFOLGE) {
    if (roh[feld] !== undefined) geordnet[feld] = roh[feld];
  }
  for (const feld of Object.keys(roh)) {
    if (!(feld in geordnet) && roh[feld] !== undefined) geordnet[feld] = roh[feld];
  }

  return geordnet;
}

/**
 * Der fertige Text einer Spartendatei — genau so, wie er im Repository steht.
 *
 * Zwei Leerzeichen Einrückung und ein abschließender Zeilenumbruch: Das erste ist die
 * Schreibweise der vorhandenen Dateien, das zweite die Bedingung dafür, dass GitHub
 * die letzte Zeile nicht als „No newline at end of file" markiert und ein späterer
 * Anhang nicht die vorherige Zeile mit anfasst.
 *
 * Zeilenenden sind `\n`, auch unter Windows: Das Repository speichert `\n` (siehe
 * `.gitattributes`, `* text=auto`), und dieser Text geht nicht durch Git, sondern
 * direkt in einen Blob der GitHub-API. `\r\n` würde dort dauerhaft landen.
 *
 * `anzahl` wird hier bewusst nicht nachgerechnet, sondern geschrieben wie übergeben:
 * Diese Funktion formatiert, sie repariert nicht. Gesetzt wird `anzahl` von den drei
 * Änderungsfunktionen unten, und `npm run validate` prüft es bei jedem Build.
 */
export function zuDateiinhalt(datei: Bestandsinhalt): string {
  const roh = datei as unknown as Record<string, unknown>;
  const geordnet: Record<string, unknown> = {};

  for (const feld of DATEIFELDER) {
    if (feld === 'items') geordnet.items = datei.items.map(inSchemareihenfolge);
    else if (roh[feld] !== undefined) geordnet[feld] = roh[feld];
  }

  return `${JSON.stringify(geordnet, null, 2)}\n`;
}

/**
 * Das Gegenstück: Text einlesen.
 *
 * Nur eine Zeile, aber sie gehört hierher und nicht zum Aufrufer — so steht das
 * Wissen, wie eine Spartendatei aussieht, an einer einzigen Stelle, und `github.ts`
 * muss über den Inhalt nichts wissen außer, dass er Text ist.
 */
export function ausDateiinhalt(inhalt: string): SpartenDatei {
  return JSON.parse(inhalt) as SpartenDatei;
}

/** Dasselbe für den Papierkorb — eigene Funktion, weil er einen anderen Kopf hat. */
export function ausPapierkorbinhalt(inhalt: string): Papierkorbdatei {
  return JSON.parse(inhalt) as Papierkorbdatei;
}

/* ------------------------------------------------------------------ *
 * Reihenfolge der Einträge
 * ------------------------------------------------------------------ */

/**
 * Die Reihenfolge, in der die Einträge in der Datei stehen.
 *
 * Dieselbe, in der die Sparte auch im Katalog erscheint (`STANDARD_SORTIERUNG`) — und
 * bewusst über `sortiere` aus `sortierung.ts`, nicht über eine eigene, einfachere
 * Regel: Zwei Reihenfolgen für dieselben Daten wären zwei Wahrheiten, und die zweite
 * prüft niemand. Der Preis ist eine Kopplung — ändert jemand die Sortierung des
 * Katalogs, schlägt `formattest` fehl und die Dateien müssen einmal neu geschrieben
 * werden. Das ist gewollt: Genau dieser Lauf soll sichtbar sein und nicht verstreut
 * bei der nächsten Bestandsänderung mitlaufen.
 *
 * „Stabil" heißt hier: Gleicher Inhalt, gleiche Reihenfolge — unabhängig davon, wie
 * die Einträge vorher lagen. Dafür sorgt der letzte Vergleichsschritt in `sortiere`,
 * der über die `id` geht und damit nie unentschieden ausgeht.
 */
export function sortiereEintraege<T extends Medium>(eintraege: readonly T[]): T[] {
  return sortiere([...eintraege], STANDARD_SORTIERUNG);
}

/* ------------------------------------------------------------------ *
 * Leere Felder
 * ------------------------------------------------------------------ */

/**
 * Wirft leere Angaben weg, bevor sie in die Datei kommen.
 *
 * Das ist wörtlich die Regel aus der Beschreibung des Schemas — „Unbekannte Felder
 * werden weggelassen, nicht mit null/leer gefüllt" — und aus plan.md, Festlegung (c).
 * Sie steht hier und nicht im Formular, weil sie für **jeden** Schreibweg gelten muss:
 * Was das Formular vergisst zu beschneiden, würde sonst als `""` in den Daten landen
 * und wäre dort ein zweiter Weg, dasselbe Nichts auszudrücken.
 *
 * `null` fällt mit weg. Das Schema erlaubt es nur bei `erfasst_am` und `cover_url`,
 * und beide meinen damit „nicht gesetzt" — für `istGesetzt()` in `anzeige.ts` ist das
 * ununterscheidbar von „Feld fehlt".
 *
 * `suchtext` fällt immer weg, auch wenn er gefüllt ankommt: Der Wert in der Datei wird
 * von niemandem gelesen (`listendaten.ts` rechnet ihn bei jedem Build neu aus), und
 * neben einem berichtigten Titel stünde sonst ein Suchtext mit dem alten.
 */
function ohneLeereFelder(eintrag: Medium): Medium {
  const roh = eintrag as unknown as Record<string, unknown>;
  const sauber: Record<string, unknown> = {};

  for (const [feld, wert] of Object.entries(roh)) {
    if (feld === 'suchtext') continue;
    if (wert === undefined || wert === null) continue;
    if (typeof wert === 'string' && wert.trim() === '') continue;
    if (Array.isArray(wert) && wert.length === 0) continue;
    sauber[feld] = typeof wert === 'string' ? wert.trim() : wert;
  }

  return sauber as unknown as Medium;
}

/* ------------------------------------------------------------------ *
 * Datenstand
 * ------------------------------------------------------------------ */

/**
 * Das heutige Datum als `JJJJ-MM-TT`, aus der lokalen Zeit des laufenden Prozesses.
 *
 * Nicht `toISOString()`: Das rechnet in UTC, und eine Änderung, die abends um halb elf
 * in Mitteleuropa gespeichert wird, bekäme dort das Datum des Vortags. Auf Vercel läuft
 * die Funktion ohnehin in UTC — dann sind beide Wege gleich —, aber lokal und in der
 * GitHub Action ist der Unterschied sichtbar, und ein Datenstand, der einen Tag zurück
 * datiert, ist genau die Art Kleinigkeit, die später niemand mehr erklären kann.
 */
export function heutigesDatum(jetzt: Date = new Date()): string {
  const zweistellig = (n: number): string => String(n).padStart(2, '0');
  const monat = zweistellig(jetzt.getMonth() + 1);
  return `${jetzt.getFullYear()}-${monat}-${zweistellig(jetzt.getDate())}`;
}

/* ------------------------------------------------------------------ *
 * Ändern
 * ------------------------------------------------------------------ */

/**
 * Baut die geänderte Datei zusammen: Einträge sortieren, `anzahl` und `stand` setzen.
 *
 * Die übergebene Datei bleibt unangetastet — die Verwaltung hält den eingelesenen
 * Stand fest, um bei einer abgelehnten Ref-Aktualisierung (plan.md § 4.2) noch einmal
 * von vorn ansetzen zu können. Eine Funktion, die dabei ihre Eingabe verändert hätte,
 * wäre genau dann falsch, wenn es darauf ankommt.
 */
function neueDatei(datei: SpartenDatei, eintraege: Medium[], stand: string): SpartenDatei {
  const sortiert = sortiereEintraege(eintraege);
  return { ...datei, stand, anzahl: sortiert.length, items: sortiert };
}

/**
 * Findet einen Eintrag über seine `id`.
 *
 * Über die `id` und nichts anderes: Sie ist der dauerhafte Schlüssel (Schema: „Darf NIE
 * geändert werden"), und das Formular sperrt das Feld beim Bearbeiten. Ein Vergleich
 * über Titel oder Position wäre zwei Titelkorrekturen später falsch.
 */
function stelleVon(datei: SpartenDatei, id: string): number {
  return datei.items.findIndex((vorhanden) => vorhanden.id === id);
}

/**
 * Bricht ab, wenn ein Eintrag in der falschen Datei landen soll.
 *
 * `daten.ts` glaubt beim Build der Datei, nicht dem Eintrag: Ein Roman in
 * `tonies.json` erschiene unter Tonies, ohne dass irgendeine Prüfung anschlägt —
 * `pruefeMedium` sieht nur den Eintrag, nicht die Datei um ihn herum. Diese Zeile ist
 * die einzige Stelle, an der beides zugleich bekannt ist.
 */
function pruefeSparte(datei: SpartenDatei, eintrag: Medium): void {
  if (eintrag.sparte !== datei.sparte) {
    throw new Error(
      `Der Eintrag „${eintrag.id}“ gehört zur Sparte „${eintrag.sparte}“, ` +
        `die Datei aber zur Sparte „${datei.sparte}“. ` +
        'Ein Wechsel der Sparte ist ein Entfernen aus der einen und ein Einfügen ' +
        'in die andere Datei.',
    );
  }
}

/**
 * Fügt einen neuen Eintrag ein.
 *
 * Die doppelte `id` ist hier ein Abbruch und keine Meldung: `pruefeIdFrei` in
 * `pruefung.ts` hat sie schon im Formular abgefangen und dem Benutzer erklärt. Kommt
 * sie trotzdem hier an, ist etwas anderes schiefgegangen — zwei gleichzeitige
 * Änderungen etwa —, und dann ist ein Fehler das einzig Richtige: Zwei Einträge mit
 * derselben id würden sich beim Erzeugen der Seiten gegenseitig überschreiben.
 */
export function eintragEinfuegen(
  datei: SpartenDatei,
  eintrag: Medium,
  stand: string = heutigesDatum(),
): SpartenDatei {
  pruefeSparte(datei, eintrag);

  if (stelleVon(datei, eintrag.id) !== -1) {
    throw new Error(
      `Die id „${eintrag.id}“ steht schon in „${datei.sparte}“. ` +
        'Bereits vergebene ids nie ändern — stattdessen dem neuen Eintrag eine eigene id geben.',
    );
  }

  return neueDatei(datei, [...datei.items, ohneLeereFelder(eintrag)], stand);
}

/**
 * Ersetzt einen vorhandenen Eintrag.
 *
 * Ersetzt vollständig, statt die Felder zu vermischen: Das Formular schickt den ganzen
 * Eintrag zurück, und nur so verschwindet ein Feld, das jemand geleert hat, auch aus
 * der Datei. Ein Zusammenführen mit dem alten Stand würde geleerte Felder still wieder
 * auffüllen — und der Benutzer hätte keine Möglichkeit, eine falsche Angabe je wieder
 * loszuwerden.
 */
export function eintragAendern(
  datei: SpartenDatei,
  eintrag: Medium,
  stand: string = heutigesDatum(),
): SpartenDatei {
  pruefeSparte(datei, eintrag);

  const stelle = stelleVon(datei, eintrag.id);
  if (stelle === -1) {
    throw new Error(
      `Die id „${eintrag.id}“ steht nicht in „${datei.sparte}“. ` +
        'Der Eintrag wurde vermutlich zwischenzeitlich entfernt — bitte die Liste neu laden.',
    );
  }

  const eintraege = [...datei.items];
  eintraege[stelle] = ohneLeereFelder(eintrag);
  return neueDatei(datei, eintraege, stand);
}

/**
 * Entfernt einen Eintrag.
 *
 * Nimmt den ganzen Eintrag und nicht nur seine `id`, damit alle drei Funktionen
 * dieselbe Form haben und die Verwaltung nicht je nach Fall etwas anderes übergeben
 * muss. Benutzt wird nur die `id`.
 *
 * Zum Löschen selbst: Ein ausgeschiedenes Buch gehört nicht unbedingt gelöscht — dafür
 * gibt es `status: "ausgeschieden"`, und der Eintrag bleibt mit seiner Geschichte
 * erhalten. Diese Funktion ist für den anderen Fall gedacht: den Eintrag, der nie
 * hätte entstehen dürfen.
 */
export function eintragEntfernen(
  datei: SpartenDatei,
  eintrag: Medium,
  stand: string = heutigesDatum(),
): SpartenDatei {
  const stelle = stelleVon(datei, eintrag.id);
  if (stelle === -1) {
    throw new Error(
      `Die id „${eintrag.id}“ steht nicht in „${datei.sparte}“ ` +
        'und kann dort nicht entfernt werden.',
    );
  }

  return neueDatei(
    datei,
    datei.items.filter((vorhanden) => vorhanden.id !== eintrag.id),
    stand,
  );
}

/* ------------------------------------------------------------------ *
 * Papierkorb
 * ------------------------------------------------------------------ */

/** Der Kopf des Papierkorbs — steht so in `src/data/_geloescht.json`. */
const PAPIERKORB_BEZEICHNUNG = 'Papierkorb';

/**
 * Ein leerer Papierkorb — für den Fall, dass es die Datei noch nicht gibt.
 *
 * Sie entsteht mit der ersten Löschung und nicht vorher: Eine leere Datei im
 * Repository, die nie jemand angefasst hat, wäre ein Versprechen ohne Deckung — und
 * `holeSparte` in `github.ts` gibt für eine nicht vorhandene Datei ausdrücklich `null`
 * zurück, damit genau dieser Fall hier behandelt werden kann statt als Fehler zu enden.
 */
export function leererPapierkorb(stand: string = heutigesDatum()): Papierkorbdatei {
  return { bezeichnung: PAPIERKORB_BEZEICHNUNG, stand, anzahl: 0, items: [] };
}

/** Wie `neueDatei`, nur für den Papierkorb: sortieren, zählen, Stand setzen. */
function neuerPapierkorb(
  datei: Papierkorbdatei,
  eintraege: Medium[],
  stand: string,
): Papierkorbdatei {
  const sortiert = sortiereEintraege(eintraege);
  return { ...datei, stand, anzahl: sortiert.length, items: sortiert };
}

/**
 * Legt einen gelöschten Eintrag in den Papierkorb.
 *
 * Sortiert wird mit derselben Funktion wie in den Spartendateien, obwohl hier Einträge
 * aus mehreren Sparten nebeneinanderliegen. Nicht, weil die Ordnung „nach Autor" im
 * Papierkorb besonders sinnvoll wäre — sondern weil sie **stabil** ist: Zweimal
 * dasselbe Löschen ergibt dieselbe Datei, und im Diff steht genau die eine
 * hinzugekommene Zeile statt einer umsortierten Liste.
 *
 * Ist die id schon im Papierkorb, wird der vorhandene Eintrag ersetzt. Der Fall
 * entsteht, wenn jemand einen Titel löscht, ihn neu anlegt und wieder löscht; zwei
 * Einträge mit derselben id nebeneinander wären beim Wiederherstellen nicht mehr
 * auseinanderzuhalten.
 */
export function papierkorbEinfuegen(
  datei: Papierkorbdatei,
  eintrag: Medium,
  stand: string = heutigesDatum(),
): Papierkorbdatei {
  const ohneAlten = datei.items.filter((vorhanden) => vorhanden.id !== eintrag.id);
  return neuerPapierkorb(datei, [...ohneAlten, ohneLeereFelder(eintrag)], stand);
}

/**
 * Nimmt einen Eintrag aus dem Papierkorb heraus.
 *
 * Nimmt die `id` und nicht den Eintrag, anders als `eintragEntfernen`: Wer
 * wiederherstellt, hat nur den Knopf neben einer Zeile gedrückt — den Eintrag selbst
 * holt der Aufrufer sich hier heraus, bevor er ihn zurück in seine Sparte legt.
 */
export function papierkorbEntfernen(
  datei: Papierkorbdatei,
  id: string,
  stand: string = heutigesDatum(),
): Papierkorbdatei {
  const stelle = datei.items.findIndex((vorhanden) => vorhanden.id === id);
  if (stelle === -1) {
    throw new Error(
      `Die id „${id}“ liegt nicht im Papierkorb und kann dort nicht entnommen werden. ` +
        'Der Eintrag wurde vermutlich schon wiederhergestellt — bitte die Seite neu laden.',
    );
  }

  return neuerPapierkorb(
    datei,
    datei.items.filter((vorhanden) => vorhanden.id !== id),
    stand,
  );
}
