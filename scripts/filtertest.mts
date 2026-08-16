/**
 * Prüft die Filterlogik gegen die gebauten Sparten-Dateien — mit demselben Modul,
 * das auch im Browser läuft.
 *
 * Zwei Dinge lassen sich am echten Bestand nicht prüfen, weil die Daten sie nicht
 * hergeben: „Neu im Bestand" (kein Eintrag hat ein `erfasst_am`) und die
 * Spieleranzahl (die Sparte Spiele ist leer). Beides wird deshalb mit eigens
 * gebauten Einträgen geprüft — sonst wäre gerade der Teil ungetestet, bei dem der
 * Auftrag ausdrücklich vor einer Verwechslung warnt.
 *
 * Aufruf: `npm run filtertest` (setzt einen Build voraus).
 */
import { readFileSync } from 'node:fs';
import {
  MIN_ABDECKUNG,
  NEU_TAGE,
  SUCHFELD_AB,
  anzahlAktiv,
  ausParametern,
  filtere,
  istLeer,
  leereAuswahl,
  leiteFacettenAb,
  zaehle,
  zuParametern,
  type Auswahl,
  type Facette,
  type Listeneintrag,
} from '../src/lib/facetten.ts';
import { sortiere } from '../src/lib/sortierung.ts';

interface Listendaten {
  version: number;
  sparte: string;
  bezeichnung: string;
  eintraege: Listeneintrag[];
  facetten: Facette[];
}

const lade = (s: string): Listendaten =>
  JSON.parse(readFileSync(`dist/liste/${s}.json`, 'utf8')) as Listendaten;

const romane = lade('romane');
const tonies = lade('tonies');

let fehler = 0;
const ok = (b: unknown, t: string): void => {
  console.log(`  ${b ? 'OK  ' : 'FEHL'}  ${t}`);
  if (!b) fehler++;
};
const schluessel = (d: Listendaten): string[] => d.facetten.map((f) => f.schluessel);
const wahl = (teil: Partial<Auswahl>): Auswahl => ({ ...leereAuswahl(), ...teil });

/* ---------------------------------------------------------------- */
console.log('=== 1. Facetten werden je Sparte aus den Daten abgeleitet ===');
console.log('  romane:', schluessel(romane).join(', '));
console.log('  tonies:', schluessel(tonies).join(', '));

ok(
  JSON.stringify(schluessel(romane)) === JSON.stringify(['genre', 'jahrzehnt', 'autor', 'reihe', 'neu']),
  'Romane: Genre, Jahrzehnt, Autor, Reihe, Zugang',
);
ok(
  JSON.stringify(schluessel(tonies)) ===
    JSON.stringify(['genre', 'autor', 'reihe', 'art', 'alter', 'laufzeit', 'neu']),
  'Tonies: zusätzlich Art, Altersempfehlung, Laufzeit — dafür kein Jahrzehnt',
);
ok(!schluessel(romane).includes('art'), 'Romane haben keinen Art-Filter');
ok(!schluessel(romane).includes('laufzeit'), 'Romane haben keinen Laufzeit-Filter');
ok(!schluessel(tonies).includes('jahrzehnt'), 'Tonies haben kein Erscheinungsjahrzehnt (kein Jahr erfasst)');
ok(
  !schluessel(romane).includes('spieler') && !schluessel(tonies).includes('spieler'),
  'Spieleranzahl erscheint nirgends, weil sie im Bestand nicht vorkommt',
);

const mitAlter = romane.eintraege.filter((e) => e.alter_ab !== undefined).length;
ok(
  !schluessel(romane).includes('alter'),
  `Romane bekommen keinen Altersfilter: nur ${mitAlter} von ${romane.eintraege.length} Titeln (${(mitAlter / romane.eintraege.length * 100).toFixed(1)} % < ${MIN_ABDECKUNG * 100} %)`,
);

const autorFacette = romane.facetten.find((f) => f.schluessel === 'autor')!;
ok(autorFacette.durchsuchbar === true, `Autorenliste ist durchsuchbar (${autorFacette.werte!.length} ≥ ${SUCHFELD_AB})`);
const genreFacette = romane.facetten.find((f) => f.schluessel === 'genre')!;
ok(genreFacette.durchsuchbar !== true, `Genreliste braucht kein Suchfeld (${genreFacette.werte!.length} Werte)`);

const jahrzehnte = romane.facetten.find((f) => f.schluessel === 'jahrzehnt')!;
ok(
  jahrzehnte.werte!.every((w) => /^\d{4}er$/.test(w.anzeige)),
  `Jahrzehnte lesbar beschriftet: ${jahrzehnte.werte!.map((w) => w.anzeige).join(', ')}`,
);
const alterFacette = tonies.facetten.find((f) => f.schluessel === 'alter')!;
ok(alterFacette.min === 3 && alterFacette.max === 10, `Altersgrenzen aus den Daten: ${alterFacette.min}–${alterFacette.max}`);

/* ---------------------------------------------------------------- */
console.log('\n=== 2. Filtern ===');
const krimi = filtere(romane.eintraege, wahl({ listen: { genre: ['Krimi'] } }));
const thriller = filtere(romane.eintraege, wahl({ listen: { genre: ['Thriller'] } }));
const beide = filtere(romane.eintraege, wahl({ listen: { genre: ['Krimi', 'Thriller'] } }));
console.log(`  Krimi ${krimi.length}, Thriller ${thriller.length}, beide ${beide.length}`);
ok(krimi.length > 0 && thriller.length > 0, 'beide Genres liefern Treffer');
ok(
  beide.length >= Math.max(krimi.length, thriller.length) && beide.length <= krimi.length + thriller.length,
  'Mehrfachauswahl innerhalb einer Facette wirkt als ODER',
);

const krimi2020 = filtere(romane.eintraege, wahl({ listen: { genre: ['Krimi'], jahrzehnt: ['2020'] } }));
ok(krimi2020.length < krimi.length, `verschiedene Facetten wirken als UND (${krimi2020.length} < ${krimi.length})`);
ok(
  krimi2020.every((e) => e.genres!.includes('Krimi') && e.jahr! >= 2020 && e.jahr! < 2030),
  'jeder Treffer erfüllt beide Bedingungen',
);

/* ---------------------------------------------------------------- */
console.log('\n=== 3. Trefferzahlen ===');
const ohneWahl = zaehle(romane.eintraege, romane.facetten, leereAuswahl());
ok(ohneWahl.listen.genre!['Krimi'] === krimi.length, 'Zählung ohne Auswahl entspricht dem Filterergebnis');

const mitKrimi = zaehle(romane.eintraege, romane.facetten, wahl({ listen: { genre: ['Krimi'] } }));
ok(
  mitKrimi.listen.genre!['Thriller'] === thriller.length,
  'die eigene Facette wird bei ihrer Zählung ausgeklammert — Thriller behält seine Zahl',
);
ok(
  mitKrimi.listen.jahrzehnt!['2020'] === krimi2020.length,
  'andere Facetten zählen dagegen nur noch innerhalb der Auswahl',
);
const nullwerte = Object.values(mitKrimi.listen.jahrzehnt!).filter((n) => n === 0).length;
console.log(`  Jahrzehnte mit 0 Treffern bei gewähltem Krimi: ${nullwerte}`);
ok(
  Object.keys(mitKrimi.listen.jahrzehnt!).length === jahrzehnte.werte!.length,
  'Werte mit 0 Treffern bleiben in der Zählung stehen und verschwinden nicht',
);

/* ---------------------------------------------------------------- */
console.log('\n=== 4. Bereichsfilter ===');
const jung = filtere(tonies.eintraege, wahl({ bereiche: { alter: { von: 3, bis: 4 } } }));
ok(jung.length > 0 && jung.every((e) => e.alter_ab! >= 3 && e.alter_ab! <= 4), `Alter 3–4: ${jung.length} Tonies`);
const kurz = filtere(tonies.eintraege, wahl({ bereiche: { laufzeit: { bis: 30 } } }));
ok(kurz.length > 0 && kurz.every((e) => e.laufzeit_min! <= 30), `Laufzeit bis 30 Min.: ${kurz.length} Tonies`);
const voll = filtere(tonies.eintraege, wahl({ bereiche: { alter: { von: 3, bis: 10 } } }));
ok(voll.length === tonies.eintraege.length, 'volle Spanne schließt niemanden aus');

/* ---------------------------------------------------------------- */
console.log('\n=== 5. Textsuche kombiniert mit Filtern ===');
const textNur = filtere(romane.eintraege, wahl({ text: 'krimi' }));
const textUndJahr = filtere(romane.eintraege, wahl({ text: 'krimi', listen: { jahrzehnt: ['2020'] } }));
console.log(`  „krimi" ${textNur.length}, davon 2020er ${textUndJahr.length}`);
ok(textNur.length > 0, 'Text allein findet etwas');
ok(textUndJahr.length > 0 && textUndJahr.length < textNur.length, 'Text und Filter greifen zusammen');
ok(
  filtere(romane.eintraege, wahl({ text: 'Muller' })).length ===
    filtere(romane.eintraege, wahl({ text: 'Müller' })).length,
  'die Umlautfaltung der Volltextsuche gilt auch hier',
);
ok(
  filtere(romane.eintraege, wahl({ text: 'alpenkrimi' })).length > 0,
  'Kompositateile wirken auch in der Listensuche',
);
ok(filtere(romane.eintraege, wahl({ text: 'xylophonquark' })).length === 0, 'Unsinn findet nichts');

/* ---------------------------------------------------------------- */
console.log('\n=== 6. Adresszeile hin und zurück ===');
const proben: Auswahl[] = [
  wahl({ listen: { genre: ['Krimi', 'Thriller'] } }),
  wahl({ listen: { genre: ['Biografie / Wahre Geschichte'] } }),
  wahl({ listen: { jahrzehnt: ['1970', '2020'] }, text: 'polt' }),
  wahl({ listen: { autor: ['beer-alex'] } }),
];
for (const probe of proben) {
  const parameter = zuParametern(probe, romane.facetten);
  const zurueck = ausParametern(new URLSearchParams(parameter.toString()), romane.facetten);
  ok(
    JSON.stringify(filtere(romane.eintraege, probe).map((e) => e.id)) ===
      JSON.stringify(filtere(romane.eintraege, zurueck).map((e) => e.id)),
    `?${parameter.toString()}`,
  );
}
ok(
  ausParametern(new URLSearchParams('genre=GibtsNicht'), romane.facetten).listen.genre === undefined,
  'unbekannte Werte aus der Adresse werden verworfen',
);
ok(istLeer(leereAuswahl()) && !istLeer(proben[0]!), 'istLeer erkennt aktive Filter');
ok(anzahlAktiv(proben[2]!) === 3, 'aktive Filter werden gezählt (2 Jahrzehnte + 1 Suche)');

/* ---------------------------------------------------------------- */
console.log('\n=== 7. „Neu im Bestand" hängt am Aufnahmedatum, nicht am Erscheinungsjahr ===');
const heute = new Date('2026-08-16T12:00:00Z');
const vorTagen = (n: number): string =>
  new Date(heute.getTime() - n * 86_400_000).toISOString().slice(0, 10);

const probeBestand: Listeneintrag[] = [
  // Der Fall aus dem Auftrag: antiquarisch beschafft, uralt, trotzdem neu im Bestand.
  { id: 'a', sparte: 'romane', titel: 'Antiquarisch von 1975', jahr: 1975, erfasst_am: vorTagen(3), genres: ['Roman'] },
  { id: 'b', sparte: 'romane', titel: 'Brandneu erschienen', jahr: 2026, erfasst_am: vorTagen(200), genres: ['Roman'] },
  { id: 'c', sparte: 'romane', titel: 'Gerade noch im Fenster', jahr: 2001, erfasst_am: vorTagen(NEU_TAGE - 1), genres: ['Krimi'] },
  { id: 'd', sparte: 'romane', titel: 'Knapp zu alt', jahr: 2001, erfasst_am: vorTagen(NEU_TAGE + 1), genres: ['Krimi'] },
  { id: 'e', sparte: 'romane', titel: 'Ohne Aufnahmedatum', jahr: 2026, genres: ['Roman'] },
];

const neu = filtere(probeBestand, wahl({ listen: { neu: ['1'] } }), heute).map((e) => e.id);
console.log('  im Fenster:', JSON.stringify(neu));
ok(neu.includes('a'), 'das Buch von 1975, vor 3 Tagen aufgenommen, gilt als neu');
ok(!neu.includes('b'), 'der 2026 erschienene Titel, vor 200 Tagen aufgenommen, gilt NICHT als neu');
ok(neu.includes('c') && !neu.includes('d'), `die Grenze liegt bei ${NEU_TAGE} Tagen`);
ok(!neu.includes('e'), 'ohne Aufnahmedatum kein Treffer');

const probeFacetten = leiteFacettenAb(probeBestand);
const neuZaehlung = zaehle(probeBestand, probeFacetten, leereAuswahl(), heute);
ok(neuZaehlung.listen.neu!['1'] === 2, 'der Zugangsschalter zeigt seine Trefferzahl (2)');
ok(
  zaehle(romane.eintraege, romane.facetten, leereAuswahl()).listen.neu!['1'] === 0,
  'im echten Bestand steht der Schalter auf 0 — es ist nirgends ein erfasst_am gepflegt',
);

/* ---------------------------------------------------------------- */
console.log('\n=== 8. Spieleranzahl und Spieldauer (Sparte noch leer) ===');
const probeSpiele: Listeneintrag[] = [
  { id: 's1', sparte: 'spiele', titel: 'Solo bis Vier', spieler_min: 1, spieler_max: 4, spieldauer_min: 30 },
  { id: 's2', sparte: 'spiele', titel: 'Erst ab Drei', spieler_min: 3, spieler_max: 6, spieldauer_min: 90 },
  { id: 's3', sparte: 'spiele', titel: 'Genau Zwei', spieler_min: 2, spieler_max: 2, spieldauer_min: 15 },
];
const spielFacetten = leiteFacettenAb(probeSpiele);
console.log('  abgeleitet:', spielFacetten.map((f) => f.schluessel).join(', '));
ok(spielFacetten.some((f) => f.schluessel === 'spieler'), 'Spieleranzahl erscheint, sobald Daten da sind');
ok(spielFacetten.some((f) => f.schluessel === 'spieldauer'), 'Spieldauer ebenso');

const zuZweit = filtere(probeSpiele, wahl({ bereiche: { spieler: { von: 2, bis: 2 } } })).map((e) => e.id);
console.log('  zu zweit spielbar:', JSON.stringify(zuZweit));
ok(
  zuZweit.includes('s1') && zuZweit.includes('s3') && !zuZweit.includes('s2'),
  'ein Spiel passt, wenn seine Spanne die gewählte überschneidet',
);
const kurzeSpiele = filtere(probeSpiele, wahl({ bereiche: { spieldauer: { bis: 30 } } })).map((e) => e.id);
ok(kurzeSpiele.length === 2 && !kurzeSpiele.includes('s2'), 'Spieldauer bis 30 Minuten');

/* ---------------------------------------------------------------- */
console.log('\n=== 9. Sortierung bleibt beim Filtern erhalten ===');
const emmerich = filtere(romane.eintraege, wahl({ text: 'emmerich' }));
const sortiert = sortiere(emmerich, 'autor');
console.log('  ', sortiert.map((e) => `${e.band ?? '·'} ${e.titel}`).join(' | '));
ok(sortiert.length === 6, '6 Bände gefiltert');
ok(
  JSON.stringify(sortiert.map((e) => e.band)) === JSON.stringify([1, 2, 3, 4, 5, 6]),
  'auch gefiltert stehen die Bände in Bandreihenfolge',
);

/* ---------------------------------------------------------------- */
console.log('\n=== 10. Leere Sparten ===');
for (const s of ['spiele', 'cds', 'sachbuecher']) {
  const d = lade(s);
  ok(d.eintraege.length === 0 && d.facetten.length === 0, `${s}: keine Einträge, keine Filter`);
}

console.log(fehler ? `\n>>> ${fehler} FEHLSCHLÄGE` : '\n>>> ALLE FILTERPRÜFUNGEN BESTANDEN');
process.exitCode = fehler ? 1 : 0;
