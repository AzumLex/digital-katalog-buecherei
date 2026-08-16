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
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

/** Ab so vielen Fehlern wird die Ausgabe abgeschnitten — sonst scrollt sie weg. */
const MAX_MELDUNGEN = 25;

// Dieses Skript liegt in scripts/, die Daten und das Schema liegen darüber.
const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPfad = join(wurzel, 'schema', 'medium.schema.json');
const datenOrdner = join(wurzel, 'src', 'data');

const schema = JSON.parse(readFileSync(schemaPfad, 'utf8'));

/**
 * `strict: false` und keine Formatprüfung — damit prüft ajv genau das, was auch
 * `jsonschema` in validate.py prüft. Python wertet `"format": "date"` ohne eigens
 * gesetzten FormatChecker nicht aus; würde ajv es hier tun, meldeten die beiden
 * Prüfungen bei denselben Daten Unterschiedliches.
 */
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

const pruefe = ajv.compile(schema);

/**
 * Macht aus einer ajv-Fehlerangabe eine lesbare Zeile.
 *
 * `instancePath` ist ein JSON-Pointer (`/genres/0`); daraus wird die Punktschreibweise
 * aus validate.py (`genres.0`). Bei Fehlern am Eintrag selbst — fehlendes Pflichtfeld,
 * unbekanntes Feld — ist der Pfad leer und entfällt.
 */
function beschreibeFehler(fehler) {
  const stelle = fehler.instancePath.split('/').filter(Boolean).join('.');

  const text =
    fehler.keyword === 'additionalProperties'
      ? `unbekanntes Feld „${fehler.params.additionalProperty}“`
      : (fehler.message ?? 'ungültig');

  return stelle ? `${stelle} ${text}` : text;
}

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

    if (!pruefe(eintrag)) {
      for (const fehler of pruefe.errors ?? []) {
        melde(`${name}[${index}] ${eintrag.id}: ${beschreibeFehler(fehler)}`);
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
