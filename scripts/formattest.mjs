#!/usr/bin/env node
/**
 * Der Beweis für `src/lib/bestand.ts`: Jede vorhandene Datei übersteht den Schreibweg
 * der Verwaltung **byte-gleich**.
 *
 * Jede `src/data/*.json` wird eingelesen, durch `zuDateiinhalt` geschickt und Byte für
 * Byte mit dem Original verglichen. Stimmt auch nur ein Zeichen nicht, schlägt dieser
 * Lauf fehl — und zwar hier, in einer Sekunde, und nicht als 800-Zeilen-Diff neben der
 * ersten echten Bestandsänderung, den danach niemand mehr lesen kann.
 *
 * Drei Dinge werden geprüft, nicht eins:
 *   1. **Format** — Feldreihenfolge, Einrückung, Zeilenumbruch am Ende.
 *   2. **Reihenfolge der Einträge** — die Datei steht schon in der Ordnung, die
 *      `sortiereEintraege` herstellt. Ohne diese Prüfung wäre das Format zwar stabil,
 *      aber die erste Änderung würde die ganze Datei umsortieren.
 *   3. **Die Änderungsfunktionen** — eine Bearbeitung, die nichts ändert, ein Einfügen
 *      mit anschließendem Entfernen und ein Löschen mit anschließendem Wiederherstellen
 *      lassen die Datei byte-gleich zurück. Punkt 1 allein prüfte nur die Serialisierung;
 *      das hier ist der Weg, den die Verwaltung wirklich geht, samt `anzahl`, Sortierung
 *      und dem Wegwerfen leerer Felder. Der dritte Fall ist zugleich der Beweis für die
 *      Zusage des Papierkorbs (plan.md § 4.5): Was gelöscht wurde, kommt Zeichen für
 *      Zeichen so zurück, wie es war.
 *
 * Der Lauf ändert nichts. Er liest, rechnet und vergleicht — mehr nicht.
 *
 * Aufruf: `npm run formattest`. Setzt keinen Build voraus und braucht kein Netz.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ausDateiinhalt,
  ausPapierkorbinhalt,
  eintragAendern,
  eintragEinfuegen,
  eintragEntfernen,
  leererPapierkorb,
  papierkorbEinfuegen,
  papierkorbEntfernen,
  sortiereEintraege,
  zuDateiinhalt,
} from '../src/lib/bestand.ts';

/** Wie viele abweichende Stellen je Datei gezeigt werden, bevor abgeschnitten wird. */
const MAX_STELLEN = 3;
/** Wie viele Zeilen um eine abweichende Stelle herum gezeigt werden. */
const UMGEBUNG = 2;

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datenOrdner = join(wurzel, 'src', 'data');

const dateien = readdirSync(datenOrdner)
  .filter((name) => name.endsWith('.json'))
  // Dateien mit führendem Unterstrich sind Arbeitsmaterial und keine Spartendatei —
  // dieselbe Regel wie in validate.mjs und daten.ts.
  .filter((name) => !name.startsWith('_'))
  .sort();

/**
 * Liest eine Datei als Text mit `\n` als Zeilenende.
 *
 * Das Repository speichert `\n` (`.gitattributes`: `* text=auto`), aber Git checkt
 * unter Windows mit `\r\n` aus. Verglichen wird deshalb gegen die Fassung, die im
 * Repository liegt und die die Verwaltung später über die GitHub-API schreibt — sonst
 * schlüge dieser Test auf jedem Windows-Rechner fehl und in der GitHub Action nicht,
 * was schlimmer wäre als gar keine Prüfung.
 */
function liesAlsRepositoryfassung(pfad) {
  return readFileSync(pfad, 'utf8').replaceAll('\r\n', '\n');
}

/**
 * Beschreibt die erste Stelle, an der zwei Fassungen auseinanderlaufen — zeilenweise.
 *
 * Ein Byte-Versatz allein wäre in einer 20 000 Zeilen langen Datei nutzlos; hier steht
 * hinterher da, welches Feld an welcher Stelle anders geschrieben wurde.
 */
function zeigeUnterschiede(original, neu) {
  const alt = original.split('\n');
  const jung = neu.split('\n');
  const meldungen = [];

  for (let i = 0; i < Math.max(alt.length, jung.length) && meldungen.length < MAX_STELLEN; i++) {
    if (alt[i] === jung[i]) continue;

    const von = Math.max(0, i - UMGEBUNG);
    const vorher = alt.slice(von, i).map((zeile) => `      ${zeile}`);
    meldungen.push(
      [
        `    Zeile ${i + 1}:`,
        ...vorher,
        `    Datei  ${alt[i] ?? '(Datei ist hier zu Ende)'}`,
        `    neu    ${jung[i] ?? '(Serialisierung ist hier zu Ende)'}`,
      ].join('\n'),
    );
  }

  return meldungen;
}

let fehlerzahl = 0;

for (const name of dateien) {
  const original = liesAlsRepositoryfassung(join(datenOrdner, name));
  const datei = ausDateiinhalt(original);
  const neu = zuDateiinhalt(datei);

  const meldungen = [];

  if (neu !== original) {
    meldungen.push(
      `  ${name}: die Serialisierung schreibt die Datei anders, als sie im Repository steht.`,
      ...zeigeUnterschiede(original, neu),
    );
  }

  // Die Reihenfolge der Einträge wird an den ids verglichen und nicht an den Einträgen
  // selbst: Nur so steht bei einer Abweichung da, welcher Titel wohin gehört hätte.
  const jetzt = datei.items.map((eintrag) => eintrag.id);
  const soll = sortiereEintraege(datei.items).map((eintrag) => eintrag.id);
  const stelle = jetzt.findIndex((id, i) => id !== soll[i]);

  if (stelle !== -1) {
    meldungen.push(
      `  ${name}: die Einträge stehen nicht in der Reihenfolge, die die Verwaltung schreibt.`,
      `    Eintrag ${stelle + 1}: in der Datei „${jetzt[stelle]}“, erwartet „${soll[stelle]}“.`,
    );
  }

  // Der Weg der Verwaltung, zweimal — mit `stand` aus der Datei statt mit dem heutigen
  // Datum: Sonst schlüge dieser Test an jedem Tag fehl, der nicht der Datenstand ist,
  // und prüfte am Ende den Kalender statt das Format. Genau dafür hat jede der drei
  // Funktionen ihren dritten Parameter.
  for (const [was, umbau] of [
    [
      'eine Bearbeitung ohne Änderung',
      (d) => (d.items[0] ? eintragAendern(d, d.items[0], d.stand) : d),
    ],
    [
      'ein Einfügen mit anschließendem Entfernen',
      (d) => {
        // Nur ein Vehikel: Der Eintrag wird eingefügt und sofort wieder entfernt. Er
        // muss nichts können außer eine id, die Sparte der Datei und die Pflichtfelder
        // des Schemas zu haben.
        const probe = {
          id: 'zzz-probe-formattest',
          sparte: d.sparte,
          medium: d.items[0]?.medium ?? 'Buch',
          titel: 'Probe aus dem Formattest',
          status: 'verfuegbar',
        };
        return eintragEntfernen(eintragEinfuegen(d, probe, d.stand), probe, d.stand);
      },
    ],
    [
      'ein Löschen mit anschließendem Wiederherstellen',
      (d) => {
        const eintrag = d.items[0];
        if (!eintrag) return d;

        // Der ganze Weg aus plan.md § 4.5, genau wie die Verwaltung ihn geht: Der Eintrag
        // verlässt seine Sparte und landet im Papierkorb — und zwar **durch die Datei
        // hindurch**. Der Papierkorb wird geschrieben und wieder eingelesen, denn genau
        // das passiert im Betrieb auch: Zwischen Löschen und Zurückholen liegen ein
        // Commit und ein zweiter Seitenaufruf. Kommt der Eintrag danach anders zurück,
        // als er hineinging, ist die Zusage „Verloren geht nichts“ gebrochen.
        const ohne = eintragEntfernen(d, eintrag, d.stand);
        const korb = ausPapierkorbinhalt(
          zuDateiinhalt(papierkorbEinfuegen(leererPapierkorb(d.stand), eintrag, d.stand)),
        );

        const zurueck = korb.items.find((vorhanden) => vorhanden.id === eintrag.id);
        const geleert = papierkorbEntfernen(korb, eintrag.id, d.stand);

        // Beides zusammen eingefügt: Der zurückgeholte Eintrag und alles, was im
        // Papierkorb übrig blieb. Hätte `papierkorbEntfernen` ihn dort stehen lassen,
        // käme er hier zweimal an — und `eintragEinfuegen` bricht bei einer doppelten id
        // ab, statt sie stillschweigend zu schlucken.
        return [zurueck, ...geleert.items].reduce(
          (stand, eintragZurueck) => eintragEinfuegen(stand, eintragZurueck, d.stand),
          ohne,
        );
      },
    ],
  ]) {
    const danach = zuDateiinhalt(umbau(datei));
    if (danach !== original) {
      meldungen.push(
        `  ${name}: ${was} schreibt die Datei anders zurück, als sie war.`,
        ...zeigeUnterschiede(original, danach),
      );
    }
  }

  if (meldungen.length === 0) {
    const zeilen = original.split('\n').length;
    console.log(
      `${name.padEnd(28)} ${String(datei.items.length).padStart(5)} Einträge, ` +
        `${String(zeilen).padStart(6)} Zeilen byte-gleich`,
    );
  } else {
    fehlerzahl += 1;
    console.log(meldungen.join('\n'));
  }
}

console.log(`\n${dateien.length} Dateien geprüft, ${fehlerzahl} mit Abweichung`);

if (fehlerzahl > 0) {
  console.error(
    '\nDer Formattest ist fehlgeschlagen. Das heißt nicht, dass die Daten falsch sind —\n' +
      'sie sind nur anders geschrieben, als src/lib/bestand.ts sie schreiben würde.\n' +
      'Die Verwaltung würde diese Dateien beim nächsten Speichern vollständig neu\n' +
      'formatieren; die eigentliche Änderung wäre im Diff nicht mehr zu finden.\n\n' +
      'Zu tun: entweder bestand.ts an die Dateien anpassen — oder die Dateien einmal\n' +
      'geschlossen neu schreiben, in einem eigenen Commit, der nichts anderes enthält.\n',
  );
}

process.exit(fehlerzahl > 0 ? 1 : 0);
