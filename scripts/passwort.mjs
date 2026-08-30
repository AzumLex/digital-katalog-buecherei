#!/usr/bin/env node
/**
 * Erzeugt die beiden Geheimnisse, die die Verwaltung zum Laufen braucht.
 *
 * Aufruf: `npm run passwort`. Das Skript fragt nach einem Passwort und gibt zwei Zeilen
 * aus, die in die Vercel-Einstellungen gehören — `VERWALTUNG_PASSWORT_HASH` und
 * `SITZUNG_GEHEIMNIS`. Beide zusammen, weil sie zusammen gebraucht werden: Wer nur den
 * Hash einträgt, kommt bis zum Anmeldeformular und dort nicht weiter.
 *
 * **Das Passwort selbst verlässt diesen Rechner nicht.** Es wird nicht gespeichert,
 * nicht ausgegeben und nicht verschickt; aus ihm wird ein scrypt-Hash gerechnet, und nur
 * der wird angezeigt. Aus dem Hash lässt sich das Passwort nicht zurückrechnen — wer die
 * Vercel-Einstellungen liest, kann sich damit nicht anmelden.
 *
 * Gefragt wird über eine Eingabeaufforderung und nicht über einen Aufrufparameter: Ein
 * Passwort in der Befehlszeile steht danach in der Verlaufsliste der Kommandozeile, wo
 * es Monate später noch zu finden ist.
 */
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { erzeugeHash } from '../src/lib/anmeldung.ts';

/** Kürzere Passwörter lässt das Skript nicht durch. */
const MINDESTLAENGE = 12;

const eingabe = createInterface({ input: process.stdin, output: process.stdout });

console.log('');
console.log('Passwort für die Verwaltung festlegen');
console.log('-------------------------------------');
console.log('');
console.log(`Mindestens ${MINDESTLAENGE} Zeichen. Am besten drei oder vier Wörter, die`);
console.log('sonst nirgends zusammen vorkommen — die sind leichter zu merken und');
console.log('schwerer zu erraten als „Bibliothek2026!“.');
console.log('');

const passwort = await eingabe.question('Passwort: ');

// Die eingegebene Zeile steht sichtbar im Fenster. Sie wird überschrieben, damit sie
// nicht noch eine Stunde später auf dem Bildschirm steht, wenn jemand vorbeikommt.
// Kann die Konsole das nicht (etwa in einer Protokolldatei), schadet es auch nichts.
const ESC = String.fromCharCode(27); // Steuerzeichen, ohne unsichtbares Byte im Quelltext
process.stdout.write(ESC + '[1A' + ESC + '[2K');
eingabe.close();

if (passwort.trim().length < MINDESTLAENGE) {
  console.error(
    `\nAbgebrochen: Das Passwort ist zu kurz (${passwort.trim().length} von ` +
      `${MINDESTLAENGE} Zeichen). Es ist das Einzige, was die Verwaltung schützt.\n`,
  );
  process.exit(1);
}

// Nicht beschnitten, sondern genommen wie eingegeben: Ein Leerzeichen am Anfang oder
// Ende ist ein Zeichen des Passworts. Beschnitte man es hier, müsste man es beim
// Anmelden auch beschneiden — und eine solche Regel an zwei Stellen bleibt nie gleich.
const hash = erzeugeHash(passwort);
const sitzungsgeheimnis = randomBytes(32).toString('base64url');

console.log('');
console.log('Fertig. Diese beiden Zeilen gehören in die Vercel-Einstellungen');
console.log('(Settings → Environment Variables, nur für „Production“):');
console.log('');
console.log(`  VERWALTUNG_PASSWORT_HASH=${hash}`);
console.log('');
console.log(`  SITZUNG_GEHEIMNIS=${sitzungsgeheimnis}`);
console.log('');
console.log('Dazu noch, aus plan.md § 9 (d): GITHUB_TOKEN und GITHUB_REPOSITORY.');
console.log('');
console.log('Zwei Hinweise:');
console.log('  · Nach dem Eintragen einmal neu bereitstellen — Vercel liest die Werte');
console.log('    beim Erzeugen der Funktionen, ein geänderter Wert wirkt erst danach.');
console.log('  · Ein neues SITZUNG_GEHEIMNIS meldet sofort alle Geräte ab. Das ist der');
console.log('    Not-Aus, falls ein angemeldetes Handy verloren geht.');
console.log('');
