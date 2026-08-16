/**
 * Prüft die Suche gegen den echten, gebauten Index — mit dem echten Suchmodul,
 * nicht mit einer Nachbildung. Eine Kopie der Faltungslogik würde bestehen, selbst
 * wenn `src/lib/suchoptionen.ts` kaputtginge.
 *
 * Aufruf: `npm run suchtest` (setzt einen Build voraus, weil dist/suchindex.json
 * gelesen wird).
 */
import { readFileSync } from 'node:fs';
import MiniSearch from 'minisearch';
import {
  INDEX_VERSION,
  SUCH_OPTIONEN,
  hebeHervor,
  suche,
  vorschlag,
  type Suchdaten,
} from '../src/lib/suchoptionen.ts';

const daten = JSON.parse(readFileSync('dist/suchindex.json', 'utf8')) as Suchdaten;
const index = MiniSearch.loadJS(daten.index, SUCH_OPTIONEN);

let fehler = 0;
const ok = (b: unknown, t: string): void => {
  console.log(`  ${b ? 'OK  ' : 'FEHL'}  ${t}`);
  if (!b) fehler++;
};
const ids = (q: string): string[] => suche(index, q).map((x) => String(x.id)).sort();

console.log(`Formatstand ${daten.version} (erwartet ${INDEX_VERSION}), ${daten.index.documentCount} Dokumente`);
ok(daten.version === INDEX_VERSION, 'Formatstand passt');

console.log('\n=== 1. Umlaute beidseitig falten ===');
for (const [a, b] of [
  ['Pflüger', 'Pfluger'],
  ['Pflüger', 'Pflueger'],
  ['Nußbaumeder', 'Nussbaumeder'],
  ['Pötzsch', 'Potzsch'],
  ['Pötzsch', 'Poetzsch'],
  ['flüchtig', 'fluechtig'],
  ['Größe', 'Grösse'],
  ['Mørck', 'Morck'],
]) {
  const ra = ids(a);
  const rb = ids(b);
  ok(ra.length > 0 && JSON.stringify(ra) === JSON.stringify(rb), `„${a}" ≡ „${b}" (${ra.length} Treffer)`);
}

console.log('\n=== 2. Der Ægisdóttir-Fall: Æ, Ä, ae und a ===');
for (const q of ['Ægisdóttir', 'Ägisdóttir', 'Aegisdottir', 'Agisdottir', 'ægisdottir', 'AEGISDOTTIR']) {
  const r = suche(index, q);
  ok(r.length === 1 && r[0]!.titel === 'Verschworen', `„${q}" → Verschworen (${r.length} Treffer)`);
}

console.log('\n=== 3. Groß-/Kleinschreibung, Satzzeichen ===');
ok(JSON.stringify(ids('beer, alex')) === JSON.stringify(ids('ALEX BEER')), '„beer, alex" ≡ „ALEX BEER"');
ok(ids('O’Mahony').length > 0 && ids('OMahony').length > 0, 'Apostroph wird ignoriert');
ok(JSON.stringify(ids('Adler-Olsen')) === JSON.stringify(ids('adler olsen')), 'Bindestrich ≡ Leerzeichen');

console.log('\n=== 4. Komposita ab 4 Zeichen ===');
const krimi = suche(index, 'Krimi');
ok(krimi.length > 200, `„Krimi" → ${krimi.length} Treffer`);
ok(krimi.some((x) => (x.reihe ?? '').includes('Island-Krimi')), 'Island-Krimi (Bindestrich zerlegt)');
ok(krimi.some((x) => (x.reihe ?? '').includes('Altaussee-Krimi')), 'Altaussee-Krimi');
const kriminalroman = krimi.filter((x) => /Kriminalroman/i.test(String(x.untertitel ?? '')));
ok(kriminalroman.length > 50, `„Kriminalroman" zerlegt (${kriminalroman.length} Treffer)`);
ok(suche(index, 'Roman').some((x) => /Kriminalroman/i.test(String(x.untertitel ?? ''))), '„Roman" findet Kriminalroman');

console.log('\n=== 5. Bindestrich in beide Richtungen ===');
ok(ids('Islandkrimi').length > 0, 'zusammengeschrieben findet getrennt');
ok(ids('AdlerOlsen').length > 0, '„AdlerOlsen" findet „Adler-Olsen"');
ok(ids('Olsen').length > 0, 'nur der zweite Bestandteil genügt');

console.log('\n=== 6. Exakt vor Prefix vor Fuzzy ===');
const rang = { exakt: 0, prefix: 1, fuzzy: 2 } as const;
for (const q of ['Beer', 'Polt', 'Krimi', 'Roman', 'Sommer']) {
  const stufen = suche(index, q).map((x) => x.stufe);
  ok(
    stufen.every((s, i) => i === 0 || rang[stufen[i - 1]!] <= rang[s]),
    `„${q}": Stufenfolge bleibt monoton (${stufen.filter((s) => s === 'exakt').length} exakt, ${stufen.filter((s) => s === 'fuzzy').length} fuzzy)`,
  );
}
const beer = suche(index, 'Beer');
ok(beer[0]!.stufe === 'exakt', 'der erste Treffer für „Beer" ist ein exakter');

console.log('\n=== 7. Prefix und Fuzzy 0.2 ===');
ok(suche(index, 'Emmer').length > 0, 'Prefix „Emmer" findet Emmerich');
ok(suche(index, 'Emerich').length > 0, 'Tippfehler „Emerich" per Fuzzy');
ok(suche(index, 'Emerich').every((x) => x.stufe === 'fuzzy'), '… ausschließlich als Fuzzy-Treffer');

console.log('\n=== 8. Mehrwort grenzt ein (AND) ===');
ok(suche(index, 'alex beer').length < 20, `„alex beer" → ${suche(index, 'alex beer').length} Treffer`);
ok(suche(index, 'beer zwergnase').length === 0, '„beer zwergnase" → 0 Treffer');

console.log('\n=== 9. Alle geforderten Felder werden durchsucht ===');
for (const [feld, q] of [
  ['titel', 'Verschworen'],
  ['autor', 'Achleitner'],
  ['reihe', 'Altaussee'],
  ['untertitel', 'Kriminalroman'],
  ['verlag', 'Zsolnay'],
  ['genres', 'Hörspiel'],
  ['figur', 'Obelix'],
]) {
  ok(suche(index, q!).length > 0, `${feld}: „${q}" (${suche(index, q!).length} Treffer)`);
}

console.log('\n=== 10. Gewichtung: Titel schlägt Nebenfeld ===');
const sommer = suche(index, 'Sommer');
ok(/sommer/i.test(sommer[0]!.titel), `bester Treffer hat „Sommer" im Titel: „${sommer[0]!.titel}"`);

console.log('\n=== 11. Meinten Sie …? ===');
for (const q of ['Emerih', 'Xylophonquark', 'Nussbaumeda', 'Verschwooren']) {
  const treffer = suche(index, q);
  const begriffe = [...new Set(vorschlag(index, q).map((b) => daten.begriffe[b] ?? b))];
  console.log(`  „${q}": ${treffer.length} Treffer, Vorschlag ${JSON.stringify(begriffe)}`);
  if (treffer.length === 0 && begriffe.length > 0) {
    ok(suche(index, begriffe.join(' ')).length > 0, `  der Vorschlag „${begriffe.join(' ')}" führt zu Treffern`);
  }
}
ok(suche(index, 'Xylophonquark').length === 0, '„Xylophonquark" bleibt leer');
ok((daten.begriffe['emmerich'] ?? '') === 'Emmerich', 'Vorschläge tragen die Schreibweise aus dem Bestand');

console.log('\n=== 12. Hervorhebung ===');
const proben: Array<[string, string, string]> = [
  ['Alpenkrimi am Berg', 'krimi', 'krimi'],
  ['Die weiße Stunde', 'weisse', 'weiße'],
  ['Ægisdóttir', 'agisdottir', 'Ægisdóttir'],
  ['Größe zeigen', 'grosse', 'Größe'],
  ['Der zweite Reiter', 'reiter', 'Reiter'],
];
for (const [text, anfrage, erwartet] of proben) {
  const markiert = hebeHervor(text, anfrage).filter((s) => s.treffer).map((s) => s.text).join('|');
  ok(markiert === erwartet, `„${text}" + „${anfrage}" → markiert „${markiert}" (erwartet „${erwartet}")`);
}
ok(
  hebeHervor('Kein Treffer hier', 'xyz').length === 1,
  'ohne Fundstelle bleibt der Text ein einziges Stück',
);

console.log('\n=== 13. Sparten für die Gruppierung liegen bei ===');
ok(daten.sparten.length === 7, `${daten.sparten.length} Sparten mitgeliefert`);
ok(daten.sparten[0]!.sparte === 'romane', 'in Katalogreihenfolge');

console.log(fehler ? `\n>>> ${fehler} FEHLSCHLÄGE` : '\n>>> ALLE SUCHPRÜFUNGEN BESTANDEN');
process.exitCode = fehler ? 1 : 0;
