/**
 * Die Datenprüfung — einmal geschrieben, von zwei Seiten benutzt.
 *
 * `scripts/validate.mjs` prüft damit vor jedem Build den gesamten Bestand. Die
 * Verwaltung prüft damit später einen einzelnen Eintrag, **bevor** er ins Repository
 * geschrieben wird. Beide müssen dasselbe unter „gültig" verstehen, sonst entsteht
 * genau der Fall, vor dem der Kommentar in `validate.mjs` warnt: Eine Prüfung sagt ja,
 * die andere nein, und niemand weiß, welche recht hat. Deshalb steht die
 * Ajv-Einrichtung hier — und nur hier.
 *
 * Das Modul kennt weder Astro noch das Dateisystem noch GitHub. Es bekommt einen
 * Eintrag und gibt Fehlerzeilen zurück, sonst nichts. Nur so lässt es sich sowohl aus
 * einem nackten Node-Skript als auch aus einer Serverroute aufrufen.
 */
import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject } from 'ajv';
import schema from '../../schema/medium.schema.json' with { type: 'json' };

/**
 * Nur der Typ, nie das Modul selbst.
 *
 * `daten.ts` liest beim Laden über `import.meta.glob` den ganzen Bestand ein — das
 * kann nur Vite, nicht das nackte Node aus `scripts/validate.mjs`. Ein `import type`
 * verschwindet beim Type-Stripping restlos; ein gewöhnlicher Import an dieser Stelle
 * (auch `import { type Medium }`) würde `daten.ts` ausführen und das Prüfskript
 * zerlegen. Diese Zeile darf also nie ihre Form ändern.
 */
import type { Medium } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Ergebnis
 * ------------------------------------------------------------------ */

/**
 * Ergebnis einer Prüfung.
 *
 * `fehler` enthält fertige, deutsche Zeilen ohne Fundstellenangabe — wo der Eintrag
 * herkommt, weiß der Aufrufer besser: Das Skript stellt Dateiname und Position davor,
 * die Verwaltung schreibt sie unter das jeweilige Formularfeld.
 */
export interface Pruefergebnis {
  gueltig: boolean;
  fehler: string[];
}

/* ------------------------------------------------------------------ *
 * Schemaprüfung
 * ------------------------------------------------------------------ */

/**
 * `strict: false` und keine Formatprüfung — damit prüft ajv genau das, was auch
 * `jsonschema` in `scripts/validate.py` prüft. Python wertet `"format": "date"` ohne
 * eigens gesetzten FormatChecker nicht aus; würde ajv es hier tun, meldeten die beiden
 * Prüfungen bei denselben Daten Unterschiedliches — und die Gegenprobe in der GitHub
 * Action wäre wertlos.
 */
const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: false,
});

const pruefeGegenSchema = ajv.compile(schema);

/**
 * Der Datentyp aus dem Schema, in Worten.
 *
 * `type` darf im Schema auch eine Liste sein (`["string", "null"]` bei `erfasst_am`);
 * ajv reicht sie unverändert durch. Dann wird die Aufzählung genannt, denn beides ist
 * erlaubt und die Person soll nicht raten, welches der beiden gemeint war.
 */
function typWort(typ: unknown): string {
  const worte: Record<string, string> = {
    string: 'Text',
    integer: 'eine ganze Zahl',
    number: 'eine Zahl',
    array: 'eine Liste',
    boolean: 'ja oder nein',
    object: 'ein Objekt',
    null: 'leer',
  };

  const alle = (Array.isArray(typ) ? typ : [typ]).map((t) => worte[String(t)] ?? String(t));
  return alle.join(' oder ');
}

/**
 * Macht aus einer ajv-Fehlerangabe eine lesbare Zeile — auf Deutsch.
 *
 * `instancePath` ist ein JSON-Pointer (`/genres/0`); daraus wird die Punktschreibweise
 * aus validate.py (`genres.0`). Bei Fehlern am Eintrag selbst — fehlendes Pflichtfeld,
 * unbekanntes Feld — ist der Pfad leer und entfällt.
 *
 * **Warum die Meldungen hier übersetzt werden und nicht bei ajv bleiben:** Diese Zeilen
 * stehen ab Paket 6 nicht mehr nur im Terminal einer Entwicklerin, sondern unter dem
 * Formular der Bücherei. „must be integer“ ist dort keine Auskunft. Eine Sprachdatei von
 * ajv (`ajv-i18n`) wäre eine neue Abhängigkeit für acht Sätze — das Schema benutzt genau
 * diese Schlüsselwörter, mehr Fälle kann es gar nicht geben. Kommt später ein neues
 * hinzu, fällt es über den Zweig ganz unten auf die englische Fassung zurück, statt zu
 * verschwinden.
 *
 * Bewusst nicht ausgeführt: Die Zeilen entstehen ausschließlich über `pruefeMedium`,
 * damit Prüfskript und Verwaltung denselben Wortlaut melden.
 */
function beschreibeFehler(fehler: ErrorObject): string {
  const stelle = fehler.instancePath.split('/').filter(Boolean).join('.');
  const grenze = fehler.params.limit as number | undefined;

  let text: string;
  switch (fehler.keyword) {
    case 'required':
      text = `Pflichtangabe „${fehler.params.missingProperty}“ fehlt`;
      break;
    case 'additionalProperties':
      text = `unbekanntes Feld „${fehler.params.additionalProperty}“`;
      break;
    case 'type':
      text = `muss ${typWort(fehler.params.type)} sein`;
      break;
    case 'minLength':
      text = grenze === 1 ? 'darf nicht leer sein' : `braucht mindestens ${grenze} Zeichen`;
      break;
    case 'maxLength':
      text = `darf höchstens ${grenze} Zeichen lang sein`;
      break;
    case 'minimum':
      text = `darf nicht kleiner als ${grenze} sein`;
      break;
    case 'maximum':
      text = `darf nicht größer als ${grenze} sein`;
      break;
    case 'enum':
      text = `muss einer dieser Werte sein: ${(fehler.params.allowedValues as unknown[]).join(', ')}`;
      break;
    case 'pattern':
      // Der reguläre Ausdruck selbst hilft niemandem weiter; was erlaubt ist, steht als
      // Hilfetext unter dem Feld (aus der `description` des Schemas).
      text = 'ist nicht in der erwarteten Schreibweise';
      break;
    default:
      text = fehler.message ?? 'ist nicht gültig';
  }

  return stelle ? `${stelle} ${text}` : text;
}

/**
 * Prüft einen einzelnen Eintrag gegen `schema/medium.schema.json`.
 *
 * Der Parameter ist `unknown` und nicht `Medium`: Geprüft wird gerade das, was noch
 * kein Medium sein muss — ein Formular schickt Zeichenketten, wo Zahlen stehen sollen,
 * und eine Datei kann alles enthalten. Erst wenn `gueltig` wahr ist, darf der Aufrufer
 * den Eintrag als `Medium` behandeln.
 */
export function pruefeMedium(eintrag: unknown): Pruefergebnis {
  if (pruefeGegenSchema(eintrag)) return { gueltig: true, fehler: [] };

  // ajv legt die Fehler an der Prüffunktion ab und überschreibt sie beim nächsten
  // Aufruf — deshalb hier sofort in eigene Zeilen umschreiben.
  return {
    gueltig: false,
    fehler: (pruefeGegenSchema.errors ?? []).map(beschreibeFehler),
  };
}

/* ------------------------------------------------------------------ *
 * Eindeutigkeit der id
 * ------------------------------------------------------------------ */

/**
 * Ist diese `id` noch frei?
 *
 * Dieselbe Bedingung, die `pruefeEindeutigeIds` in `src/lib/daten.ts` beim Build
 * erzwingt — hier nur vorgezogen: Was die Verwaltung gar nicht erst schreibt, kann den
 * Build später nicht abbrechen. Die `id` ist der dauerhafte Schlüssel eines Mediums;
 * zwei Einträge mit derselben würden sich beim Erzeugen der Seiten gegenseitig
 * überschreiben.
 *
 * Gedacht für **neue** Einträge. Beim Bearbeiten ist das Feld gesperrt (die id eines
 * vorhandenen Eintrags wird nie geändert), es gibt dort also nichts zu prüfen — sonst
 * fände der Eintrag sich selbst und meldete einen Fehler, den es nicht gibt.
 */
export function pruefeIdFrei(id: string, alleMedien: readonly Medium[]): Pruefergebnis {
  const belegt = alleMedien.find((medium) => medium.id === id);
  if (!belegt) return { gueltig: true, fehler: [] };

  return {
    gueltig: false,
    fehler: [
      `Die id „${id}“ ist schon vergeben: „${belegt.titel}“ (${belegt.sparte}). ` +
        'Bereits vergebene ids nie ändern — stattdessen dem neuen Eintrag eine eigene ' +
        'id geben (z. B. Suffix „-2“). Ist es dasselbe Buch ein zweites Mal, gehört ' +
        'kein neuer Eintrag angelegt, sondern „bestand" erhöht.',
    ],
  };
}
