#!/usr/bin/env node
/**
 * Prüft alle `src/data/*.json` gegen `schema/medium.schema.json`.
 * Exit-Code 1 bei Fehlern.
 *
 * Geprüft wird dreierlei — genau wie zuvor in `scripts/validate.py`:
 *   1. Jeder Eintrag erfüllt das JSON Schema.
 *   2. Die Zahl `anzahl` stimmt mit der Zahl der Einträge überein.
 *   3. Keine `id` kommt zweimal vor.
 *
 * Warum in Node und nicht in Python: Diese Prüfung hängt als `prebuild` vor jedem
 * Build und lief damit auch auf dem Deploy-Server. Dort einen Python-Interpreter samt
 * `jsonschema` vorauszusetzen, hieß, dass ein fehlendes `pip3` das Veröffentlichen
 * blockiert — für eine Prüfung, die keine Python-Eigenschaft braucht. Node ist
 * ohnehin da, denn ohne Node gibt es keinen Build.
 *
 * `scripts/validate.py` bleibt für die lokale Arbeit erhalten und prüft dasselbe.
 * Die GitHub Action lässt beide laufen — wenn sie je auseinanderlaufen, fällt es
 * dort auf und nicht erst im Bestand.
 *
 * Punkt 1 steckt nicht mehr in diesem Skript, sondern in `src/lib/pruefung.ts`:
 * Dieselbe Funktion prüft später einen einzelnen Eintrag, bevor die Verwaltung ihn
 * ins Repository schreibt. Eine Prüfung, zwei Aufrufer — damit kann gar nicht erst
 * entstehen, was der Absatz darüber für validate.py befürchtet. Punkt 2 und 3 bleiben
 * hier: Sie gelten für eine ganze Datei, nicht für einen einzelnen Eintrag.
 *
 * Das Skript lädt mit `pruefung.ts` erstmals ein TypeScript-Modul und wird deshalb in
 * `package.json` mit `--experimental-strip-types` gestartet. Node kann das ab 22.18
 * von allein; die Flagge deckt die älteren 22er mit ab, die auf einem Deploy-Server
 * stehen können, und `--disable-warning=ExperimentalWarning` sorgt dafür, dass die
 * Ausgabe dabei auf jeder Node-Fassung dieselbe bleibt.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruefeMedium } from '../src/lib/pruefung.ts';

/** Ab so vielen Fehlern wird die Ausgabe abgeschnitten — sonst scrollt sie weg. */
const MAX_MELDUNGEN = 25;

// Dieses Skript liegt in scripts/, die Daten liegen darüber. Das Schema muss hier
// nicht mehr gesucht werden; pruefung.ts bringt es mit.
const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datenOrdner = join(wurzel, 'src', 'data');

const dateien = readdirSync(datenOrdner)
  .filter((name) => name.endsWith('.json'))
  // Dateien mit führendem Unterstrich sind Arbeitsmaterial, kein Bestand.
  .filter((name) => !name.startsWith('_'))
  .sort();

let fehlerzahl = 0;
let gesamt = 0;
/** id → wie oft sie vorkommt. */
const ids = new Map();

function melde(text) {
  fehlerzahl += 1;
  if (fehlerzahl <= MAX_MELDUNGEN) console.log(text);
  else if (fehlerzahl === MAX_MELDUNGEN + 1) console.log('... (weitere Fehler unterdrückt)');
}

for (const name of dateien) {
  const inhalt = JSON.parse(readFileSync(join(datenOrdner, name), 'utf8'));
  const items = inhalt.items ?? [];
  gesamt += items.length;

  if (inhalt.anzahl !== items.length) {
    melde(`${name}: anzahl=${inhalt.anzahl} stimmt nicht mit ${items.length} Einträgen überein`);
  }

  items.forEach((eintrag, index) => {
    ids.set(eintrag.id, (ids.get(eintrag.id) ?? 0) + 1);

    const ergebnis = pruefeMedium(eintrag);
    if (!ergebnis.gueltig) {
      for (const zeile of ergebnis.fehler) {
        melde(`${name}[${index}] ${eintrag.id}: ${zeile}`);
      }
    }
  });

  console.log(`${name.padEnd(28)} ${String(items.length).padStart(5)} Einträge`);
}

for (const [id, anzahl] of ids) {
  if (anzahl > 1) melde(`DOPPELTE ID: ${id} (${anzahl}x)`);
}

console.log(`\ngesamt ${gesamt} Einträge, ${fehlerzahl} Fehler`);

if (fehlerzahl > 0) {
  console.error(
    '\nDie Datenprüfung ist fehlgeschlagen. Der Build wurde abgebrochen,\n' +
      'damit fehlerhafte Daten nicht veröffentlicht werden.\n',
  );
}

process.exit(fehlerzahl > 0 ? 1 : 0);
