#!/usr/bin/env node
/**
 * Prüft `src/lib/isbn.ts` und `src/lib/kennung.ts` — gegen den echten Bestand.
 *
 * Zwei Module, ein Testlauf, weil sie dieselbe Vorlage haben: NOTIZEN.md. Dort steht in
 * § 3, welche fünfzehn Einträge eine kaputte ISBN haben, in § 13, woran das bei einem
 * davon lag (ein geschützter Bindestrich aus Word), und in § 2, warum es zwei Kennungen
 * mit dem Suffix `-2` gibt. Alle drei Beobachtungen sind hier Prüfbedingungen.
 *
 * **Die Eingaben werden nicht abgeschrieben, sondern gelesen.** Welche Einträge eine
 * kaputte ISBN haben, steht in den Daten selbst — im Feld `_pruefen`, das der Import
 * gesetzt hat (`isbn_ungueltig`, `keine_isbn`). Eine Liste von fünfzehn ids in dieser
 * Datei wäre beim nächsten berichtigten Eintrag falsch, ohne dass es jemand merkt; so
 * prüft der Lauf immer den heutigen Stand — und meldet nebenbei, wenn es nicht mehr
 * fünfzehn sind.
 *
 * Der Lauf ändert nichts, braucht kein Netz und setzt keinen Build voraus.
 * Aufruf: `npm run isbntest`.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { alsIsbn13, gleicheIsbn, istIsbn, normalisiereIsbn } from '../src/lib/isbn.ts';
import { kennungsvorschlag, schlageKennungVor, SPARTENKUERZEL } from '../src/lib/kennung.ts';

let fehler = 0;
const ok = (bedingung, text) => {
  console.log(`  ${bedingung ? 'OK  ' : 'FEHL'}  ${text}`);
  if (!bedingung) fehler++;
};

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const datenOrdner = join(wurzel, 'src', 'data');

/** Alle Einträge aus allen Spartendateien — Unterstrich-Dateien bleiben außen vor. */
const alleMedien = readdirSync(datenOrdner)
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'))
  .sort()
  .flatMap((name) => JSON.parse(readFileSync(join(datenOrdner, name), 'utf8')).items);

console.log(`${alleMedien.length} Einträge aus ${datenOrdner}`);

/* ================================================================== *
 * 1. Die fünfzehn kaputten ISBN aus NOTIZEN.md § 3
 * ================================================================== */

console.log('\n=== 1. Die kaputten ISBN aus NOTIZEN.md § 3 ===');

const kaputt = alleMedien.filter((m) => (m._pruefen ?? []).includes('isbn_ungueltig'));
const ohneIsbn = alleMedien.filter((m) => (m._pruefen ?? []).includes('keine_isbn'));

ok(
  kaputt.length + ohneIsbn.length === 15,
  `${kaputt.length} mit kaputter ISBN + ${ohneIsbn.length} ohne jede ISBN = ` +
    `${kaputt.length + ohneIsbn.length} (NOTIZEN.md § 3 nennt 15)`,
);

// Die zwölf mit kaputter Zeichenfolge: Was im Word-Dokument stand, steht weiterhin in
// `isbn_formatiert` — genau diese Zeichenfolge muss die Prüfziffer ablehnen.
for (const m of kaputt) {
  const roh = m.isbn_formatiert ?? '';
  ok(roh !== '' && !istIsbn(roh), `„${roh}" abgelehnt (${m.id})`);
}

// Die drei ohne ISBN: Zu ihnen gibt es keine Zeichenfolge, die man prüfen könnte. Der
// Beweis lautet hier deshalb anders — es darf gar nichts dastehen, was als ISBN durchgeht.
for (const m of ohneIsbn) {
  const roh = m.isbn_formatiert ?? m.isbn ?? '';
  ok(!istIsbn(roh), `ohne ISBN im Dokument, nichts Gültiges hinterlegt (${m.id})`);
}

// Keiner der fünfzehn darf ein `isbn`-Feld haben: Der Import hat es weggelassen, und
// genau darauf beruht die Aussage „findet keine Coverabfrage".
ok(
  [...kaputt, ...ohneIsbn].every((m) => m.isbn === undefined),
  'keiner der fünfzehn trägt ein `isbn`-Feld',
);

/* ================================================================== *
 * 2. Die Gegenprobe: alles, was der Import angenommen hat, ist gültig
 * ================================================================== */

console.log('\n=== 2. Gegenprobe am gesamten Bestand ===');

/**
 * **Befund aus diesem Testlauf, nicht aus NOTIZEN.md:** Bei diesen zwölf Einträgen steht
 * eine ISBN im Feld `isbn`, deren Prüfziffer nicht aufgeht — und sie tragen **keinen**
 * `_pruefen`-Vermerk. Der Import hat also nur Form und Länge geprüft, nicht die
 * Prüfziffer; die fünfzehn aus § 3 fielen ihm aus anderen Gründen auf (zu kurz, zu lang,
 * gar nicht vorhanden). Meist ist es eine einzelne verlesene Ziffer: Bei
 * `rom-ammer-auf-dem-gipfel-ist-ruh-8556` etwa ergäbe dieselbe Zahl mit Prüfziffer 7
 * statt 6 eine gültige ISBN.
 *
 * Sie hier aufzulisten ist kein Freibrief, sondern eine Alarmanlage: Die Prüfung unten
 * verlangt, dass **keine weiteren** hinzukommen. Wird einer berichtigt, verschwindet er
 * einfach aus der Menge — der Test bleibt grün, ohne dass jemand diese Liste pflegen
 * muss. Zu berichtigen sind sie am Buch selbst; das ist Nachkontrolle und gehört nicht in
 * diesen Umbau (plan.md § 9 (c)).
 */
const BEKANNT_UNGUELTIG = new Set([
  'rom-ammer-auf-dem-gipfel-ist-ruh-8556',
  'rom-clark-der-tausch-4975',
  'rom-cognetti-acht-berge-3448',
  'rom-heinichen-die-ruhe-des-staerkeren-4551',
  'rom-indriason-frostnacht-5832',
  // Hier sind es nicht die Ziffern, sondern die Länge: „978-3-00998-3" ergibt zehn
  // Ziffern und wurde deshalb als ISBN-10 gelesen. Es ist eine verstümmelte ISBN-13.
  'rom-johann-die-schwester-9983',
  'rom-koppelstaetter-am-hang-des-todes-4775',
  'rom-martin-madame-le-commissaire-und-die-gefaehrliche-be-9955',
  'rom-schenkel-kalteis-5417',
  'rom-sellano-portugiesisches-blut-9221',
  'rom-sellano-portugiesische-wahrheit-9238',
  'rom-veloso-der-duft-der-kaffeebluete-1624',
]);

const mitIsbn = alleMedien.filter((m) => m.isbn);
const durchgefallen = mitIsbn.filter((m) => !istIsbn(m.isbn));
const unerwartet = durchgefallen.filter((m) => !BEKANNT_UNGUELTIG.has(m.id));

console.log(
  `        ${mitIsbn.length} Einträge mit ISBN, davon ${durchgefallen.length} mit falscher ` +
    `Prüfziffer (bekannt: ${BEKANNT_UNGUELTIG.size})`,
);

ok(
  unerwartet.length === 0,
  'keine unbekannten ungültigen ISBN im Bestand' +
    (unerwartet.length ? ` — neu: ${unerwartet.map((m) => m.id).join(', ')}` : ''),
);

// Eine Prüfung, die alles annimmt, bestünde den Test oben auch. Deshalb die Kehrseite:
// Eine geänderte Ziffer muss auffallen. Genommen wird die vorletzte Stelle, damit nicht
// nur die Prüfziffer selbst verändert wird.
const gueltige = mitIsbn.filter((m) => istIsbn(m.isbn));
const verdreht = gueltige.filter((m) => {
  const z = m.isbn;
  const andere = String((Number(z[z.length - 2]) + 1) % 10);
  return istIsbn(z.slice(0, -2) + andere + z.slice(-1));
});
ok(verdreht.length === 0, `eine verdrehte Ziffer wird bei allen ${gueltige.length} erkannt`);

ok(mitIsbn.filter((m) => m.isbn.length === 10).length > 0, 'im Bestand stehen auch ISBN-10');

/* ================================================================== *
 * 3. Schreibweisen: die Bindestriche aus NOTIZEN.md § 13
 * ================================================================== */

console.log('\n=== 3. Schreibweisen ===');

// Die ISBN aus `rom-komarek-blumen-fuer-polt-9548`, wie sie im Word-Dokument steht:
// mit geschütztem Bindestrich (U+2011). Sie ist gültig — sie war nur anders geschrieben,
// und genau daran ist der Import gescheitert.
ok(istIsbn('3‑85218-321-9'), 'U+2011 (geschützter Bindestrich): 3‑85218-321-9');
ok(normalisiereIsbn('3‑85218-321-9') === '3852183219', 'U+2011 wird weggerechnet');

// Die beiden vollständigen ISBN aus den unlesbaren Fragmenten (NOTIZEN.md § 4), in
// wechselnden Schreibweisen — sie sind der Anlass, überhaupt eine Abfrage zu bauen.
for (const [text, was] of [
  ['978-3-257-06767-5', 'gewöhnlicher Bindestrich'],
  ['978–3–257–06767–5', 'Halbgeviertstrich (–)'],
  ['978—3—257—06767—5', 'Geviertstrich (—)'],
  ['978 3 257 06767 5', 'Leerzeichen'],
  ['ISBN 978-3-257-06767-5', 'mit vorangestelltem „ISBN"'],
  ['9783257067675', 'ohne alles'],
]) {
  ok(istIsbn(text), `${was}: „${text}"`);
}

ok(istIsbn('0-8044-2957-X'), 'ISBN-10 mit Prüfziffer X');
ok(istIsbn('0-8044-2957-x'), 'kleines x zählt genauso');
ok(!istIsbn('08X4429570'), 'ein X mitten in der Zahl ist keine ISBN');
ok(!istIsbn(''), 'leere Eingabe ist keine ISBN');
ok(!istIsbn('978-3-257-0676'), 'zu kurz ist keine ISBN');

/* ================================================================== *
 * 4. Umrechnen und vergleichen
 * ================================================================== */

console.log('\n=== 4. ISBN-10 und ISBN-13 ===');

ok(alsIsbn13('3-257-06767-4') === '9783257067675', 'ISBN-10 → ISBN-13');
ok(alsIsbn13('9783257067675') === '9783257067675', 'ISBN-13 bleibt, wie sie ist');
ok(alsIsbn13('978-3-257-0676') === null, 'aus einer kaputten Vorlage wird nichts gerechnet');
ok(gleicheIsbn('3-257-06767-4', '9783257067675'), 'beide Formen meinen dasselbe Buch');
ok(!gleicheIsbn('9783257067675', '9783442490172'), 'zwei Bücher bleiben zwei Bücher');
ok(!gleicheIsbn(undefined, '9783257067675'), 'ohne Angabe kein Treffer');

// Die Umrechnung muss zu jeder ISBN-10 im Bestand eine gültige ISBN-13 liefern.
ok(
  gueltige
    .filter((m) => m.isbn.length === 10)
    .every((m) => istIsbn(alsIsbn13(m.isbn) ?? '')),
  'jede gültige ISBN-10 im Bestand ergibt umgerechnet wieder eine gültige ISBN',
);

/* ================================================================== *
 * 5. Der id-Vorschlag gegen die 987 vorhandenen Kennungen
 * ================================================================== */

console.log('\n=== 5. Der id-Vorschlag (src/lib/kennung.ts) ===');

/** Ist `kurz` in `lang` als Teilfolge enthalten? */
function teilfolge(kurz, lang) {
  let stelle = 0;
  for (const zeichen of lang) if (zeichen === kurz[stelle]) stelle++;
  return stelle === kurz.length;
}

const ohneBindestriche = (text) => text.replace(/-/g, '');

/**
 * Warum eine vorhandene Kennung anders lautet, als sie heute vorgeschlagen würde.
 *
 * Vier Gründe sind bekannt und in Ordnung, ein fünfter wäre ein Fehler in der Regel.
 * Der Test bestätigt also nicht bloß „stimmt meistens", sondern verlangt zu **jeder**
 * Abweichung eine Erklärung.
 */
function abweichungsgrund(medium, vorschlag) {
  if (medium.id === vorschlag) return 'gleich';

  // NOTIZEN.md § 2: zwei Titel liegen doppelt im Bestand.
  if (medium.id === `${vorschlag}-2`) return 'Dublette mit Suffix -2';

  // Der Import ließ nach dem Zuschnitt auf 52 Zeichen einen Bindestrich am Ende stehen.
  if (medium.id === `${vorschlag}-`) return 'Bindestrich am Ende (Import)';

  // Ohne gültige ISBN hängte der Import vier Zeichen aus einer Prüfsumme der Quellzeile
  // an — das sind genau die fünfzehn aus § 3. Die Verwaltung hat keine Quellzeile und
  // lässt den Zahlenteil weg.
  const hatHashsuffix = !medium.isbn && /^[0-9a-f]{4}$/.test(medium.id.slice(-4));
  const ohneSuffix = medium.id.slice(0, -5);
  if (hatHashsuffix && ohneSuffix === vorschlag) return 'Prüfsummen-Suffix statt ISBN (Import)';

  // Die Umschrift des Imports (Python, NFKD + ASCII) ließ Zeichen fallen, die `slug()`
  // in `anzeige.ts` ausschreibt: Æ wird zu „ae", ð und der Apostroph werden zu einem
  // Bindestrich. Erkennbar daran, dass die alte Kennung in der neuen als Teilfolge steckt.
  const links = ohneBindestriche(hatHashsuffix ? ohneSuffix : medium.id);
  if (teilfolge(links, ohneBindestriche(vorschlag))) {
    return hatHashsuffix ? 'Prüfsummen-Suffix und Umschrift' : 'Umschrift: heute mehr Zeichen';
  }

  return 'UNGEKLÄRT';
}

const gruende = new Map();
const ungeklaert = [];

for (const medium of alleMedien) {
  const vorschlag = kennungsvorschlag(medium);
  const grund = abweichungsgrund(medium, vorschlag);

  gruende.set(grund, (gruende.get(grund) ?? 0) + 1);
  if (grund === 'UNGEKLÄRT') ungeklaert.push(`${medium.id}  →  ${vorschlag}`);
}

for (const [grund, anzahl] of [...gruende].sort((a, b) => b[1] - a[1])) {
  console.log(`        ${String(anzahl).padStart(4)}  ${grund}`);
}

ok(ungeklaert.length === 0, 'jede Abweichung von den vorhandenen Kennungen ist erklärt');
for (const zeile of ungeklaert.slice(0, 10)) console.log(`        ${zeile}`);

ok(
  (gruende.get('Prüfsummen-Suffix statt ISBN (Import)') ?? 0) +
    (gruende.get('Prüfsummen-Suffix und Umschrift') ?? 0) ===
    15,
  'die fünfzehn ohne gültige ISBN sind genau die aus § 3',
);
ok((gruende.get('Dublette mit Suffix -2') ?? 0) === 2, 'die zwei Dubletten aus § 2 stehen als solche da');

/* ------------------------------------------------------------------ *
 * Die Regel selbst
 * ------------------------------------------------------------------ */

const beispiel = {
  sparte: 'romane',
  titel: 'Der lange Sommer',
  autor_nachname: 'Mustermann',
  isbn: '9783442491234',
};

ok(
  kennungsvorschlag(beispiel) === 'rom-mustermann-der-lange-sommer-1234',
  'das Beispiel aus dem README kommt heraus: rom-mustermann-der-lange-sommer-1234',
);

ok(
  kennungsvorschlag({ ...beispiel, autor_nachname: 'Müller' }).startsWith('rom-mueller-'),
  'Umlaute werden ausgeschrieben',
);

ok(
  kennungsvorschlag({ sparte: 'tonies', titel: 'Die Siegertrophäe', reihe: 'Paw Patrol' }) ===
    'ton-paw-patrol-die-siegertrophaee',
  'ohne Autor trägt die Reihe die Kennung, ohne ISBN entfällt der Zahlenteil',
);

ok(
  /^[a-z]{3}-[a-z0-9-]+$/.test(kennungsvorschlag({ sparte: 'cds', titel: 'Für Elise' })),
  'der Vorschlag genügt dem Muster aus dem Schema',
);

ok(
  alleMedien.every((m) => /^[a-z]{3}-[a-z0-9-]+$/.test(kennungsvorschlag(m))),
  'auch für alle vorhandenen Einträge genügt der Vorschlag dem Muster',
);

ok(
  Object.keys(SPARTENKUERZEL).length === 7 &&
    new Set(Object.values(SPARTENKUERZEL)).size === 7,
  'sieben Sparten, sieben verschiedene Kürzel',
);

console.log('\n=== 6. Kollisionen ===');

const vergeben = ['rom-mustermann-der-lange-sommer-1234'];
ok(
  schlageKennungVor(beispiel, vergeben) === 'rom-mustermann-der-lange-sommer-1234-2',
  'ist die Kennung vergeben, wird -2 angehängt',
);
ok(
  schlageKennungVor(beispiel, [...vergeben, 'rom-mustermann-der-lange-sommer-1234-2']) ===
    'rom-mustermann-der-lange-sommer-1234-3',
  'und danach -3',
);
ok(
  schlageKennungVor(beispiel, alleMedien.map((m) => m.id)) === kennungsvorschlag(beispiel),
  'gegen den echten Bestand bleibt der Vorschlag unverändert',
);

/* ================================================================== */

console.log(`\n${fehler === 0 ? '>>> ALLE ISBN- UND KENNUNGSPRÜFUNGEN BESTANDEN' : `>>> ${fehler} FEHLER`}`);
process.exit(fehler > 0 ? 1 : 0);
