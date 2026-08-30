/**
 * Der Arbeitsablauf der Bestandspflege: lesen, prüfen, ändern, speichern.
 *
 * Hier laufen die drei Pakete zusammen, die einzeln nichts voneinander wissen —
 * `pruefung.ts` (ist der Eintrag gültig?), `bestand.ts` (wie sieht die Datei danach aus?)
 * und die Ablage aus `github.ts` (wo liegt sie?). Die Reihenfolge ist immer dieselbe und
 * steht in plan.md § 4.3: **erst prüfen, dann ändern, dann schreiben.** Sie steht genau
 * einmal im Projekt, nämlich hier; die Routen unter `src/pages/api/` reichen nur noch
 * Eingaben herein und Antworten hinaus.
 *
 * **Von GitHub steht in dieser Datei kein Wort.** Sie kennt Ablagefächer, Fassungen und
 * einen Speicherbeleg — Begriffe, die eine Datenbank genauso bedienen könnte (plan.md
 * § 7). Was `speichereSparten` unter der Decke tut, geht sie nichts an.
 *
 * Läuft ausschließlich auf dem Server: Alles, was dieses Modul aufruft, braucht das
 * Zugriffstoken.
 */
import {
  PAPIERKORB,
  holeSparten,
  speichereSparten,
  type Bestandsdatei,
  type GeholteDatei,
  type Speicherbeleg,
  type ZuSchreibendeDatei,
} from './github.ts';
import {
  ausDateiinhalt,
  ausPapierkorbinhalt,
  eintragAendern,
  eintragEinfuegen,
  eintragEntfernen,
  leererPapierkorb,
  papierkorbEinfuegen,
  papierkorbEntfernen,
  zuDateiinhalt,
  type Papierkorbdatei,
} from './bestand.ts';
import { pruefeIdFrei, pruefeMedium } from './pruefung.ts';
import { SPARTEN, type Medium, type Sparte, type SpartenDatei } from './daten.ts';
import { falteGrundform, zerlegeInWorte } from './suchoptionen.ts';
import { PRO_SEITE, seiteVon, sortiere, STANDARD_SORTIERUNG, type Seite } from './sortierung.ts';

/* ------------------------------------------------------------------ *
 * Fehler
 * ------------------------------------------------------------------ */

/**
 * Ein Fehler, den die pflegende Person zu sehen bekommt — und der ihr sagt, was zu tun
 * ist.
 *
 * Das Gegenstück zu `AblageFehler` aus `github.ts`: Der beschreibt, dass das Speichern
 * nicht ging, dieser, dass es gar nicht erst versucht wurde. Deshalb trägt er eine
 * **Liste** von Zeilen und nicht nur einen Satz: Aus dem Formular kommen gern mehrere
 * Beanstandungen auf einmal, und sie alle einzeln zu zeigen erspart das Spiel
 * „speichern, korrigieren, speichern, korrigieren“.
 */
export class PflegeFehler extends Error {
  readonly zeilen: string[];
  readonly neuLadenNoetig: boolean;

  constructor(zeilen: string[], angaben: { neuLadenNoetig?: boolean } = {}) {
    super(zeilen.join(' · '));
    this.name = 'PflegeFehler';
    this.zeilen = zeilen;
    this.neuLadenNoetig = angaben.neuLadenNoetig ?? false;
  }
}

/* ------------------------------------------------------------------ *
 * Lesen
 * ------------------------------------------------------------------ */

/** Der gelesene Bestand: die Einträge und die Fassung, aus der sie stammen. */
export interface Bestandssicht {
  /** Alle Einträge der gelesenen Sparten, zusammengeworfen. */
  medien: Medium[];
  /** Je Sparte die eingelesene Datei samt Fassungskennung. */
  dateien: Map<Sparte, { datei: SpartenDatei; fassung: string }>;
}

/**
 * Liest Spartendateien und macht Einträge daraus.
 *
 * Ohne Angabe alle sieben. Das ist der Regelfall und nicht die Ausnahme: Die Suche geht
 * über den ganzen Bestand, und `pruefeIdFrei` muss alle ids kennen — eine id, die in
 * `tonies.json` schon vergeben ist, darf in `romane.json` nicht ein zweites Mal entstehen.
 *
 * **Kein Zwischenspeicher.** Verlockend wäre er: Sieben Dateien bei jedem Seitenaufruf
 * sind rund ein Megabyte. Aber die Serverfunktion läuft in mehreren Ausführungen
 * nebeneinander, und ein Bestand, der aus einem vorherigen Aufruf stammt, wäre genau dann
 * veraltet, wenn es darauf ankommt: beim Speichern. Was der Bestand ist, weiß die Ablage
 * und niemand sonst.
 */
export async function liesBestand(
  sparten: readonly Sparte[] = SPARTEN,
): Promise<Bestandssicht> {
  const geholt = await holeSparten(sparten);
  return ausGeholten(geholt, sparten);
}

/** Macht aus den gelesenen Dateien eine Bestandssicht — ohne noch einmal zu lesen. */
function ausGeholten(
  geholt: Map<Bestandsdatei, GeholteDatei>,
  sparten: readonly Sparte[],
): Bestandssicht {
  const dateien = new Map<Sparte, { datei: SpartenDatei; fassung: string }>();
  const medien: Medium[] = [];

  for (const sparte of sparten) {
    const roh = geholt.get(sparte);
    if (!roh) continue;

    const datei = ausDateiinhalt(roh.inhalt);
    dateien.set(sparte, { datei, fassung: roh.fassung });
    medien.push(...datei.items);
  }

  return { medien, dateien };
}

/**
 * Liest Bestand und Papierkorb in einem Zug.
 *
 * Für die Übersicht, die beides zeigt. Ein einziger Aufruf statt zweier: `holeSparten`
 * ermittelt den Stand des Zweigs **einmal**, und damit stammen alle acht Dateien
 * garantiert aus demselben Commit. Bei zwei Aufrufen könnte dazwischen ein Commit
 * entstehen, und die Übersicht zeigte einen Bestand, den es so nie gegeben hat.
 */
export async function liesBestandUndPapierkorb(): Promise<{
  bestand: Bestandssicht;
  papierkorb: Papierkorbsicht;
}> {
  const geholt = await holeSparten([...SPARTEN, PAPIERKORB]);
  const korb = geholt.get(PAPIERKORB);

  return {
    bestand: ausGeholten(geholt, SPARTEN),
    papierkorb: korb
      ? { datei: ausPapierkorbinhalt(korb.inhalt), fassung: korb.fassung }
      : { datei: leererPapierkorb(), fassung: null },
  };
}

/** Der Papierkorb, so wie er gerade aussieht. `fassung: null` heißt: Es gab ihn noch nie. */
export interface Papierkorbsicht {
  datei: Papierkorbdatei;
  fassung: string | null;
}

/**
 * Liest den Papierkorb.
 *
 * Gibt es die Datei noch nicht, ist das kein Fehler, sondern der Normalzustand einer
 * Bücherei, die noch nie etwas gelöscht hat — dann kommt ein leerer Papierkorb zurück und
 * `fassung: null` sagt der Ablage später, dass die Datei neu angelegt wird.
 */
export async function liesPapierkorb(): Promise<Papierkorbsicht> {
  const geholt = (await holeSparten([PAPIERKORB])).get(PAPIERKORB);
  if (!geholt) return { datei: leererPapierkorb(), fassung: null };

  return { datei: ausPapierkorbinhalt(geholt.inhalt), fassung: geholt.fassung };
}

/* ------------------------------------------------------------------ *
 * Einen Eintrag finden
 * ------------------------------------------------------------------ */

/** Ein gefundener Eintrag, mitsamt der Datei, in der er steht. */
export interface Fundstelle {
  medium: Medium;
  sparte: Sparte;
  datei: SpartenDatei;
  fassung: string;
}

/**
 * Sucht einen Eintrag über seine `id`.
 *
 * Der `hinweis` ist eine Abkürzung und keine Auskunft: Die Bestandsliste weiß, in welcher
 * Sparte die angeklickte Zeile stand, und gibt es weiter — dann wird eine Datei gelesen
 * statt sieben. Stimmt der Hinweis nicht, weil die Sparte inzwischen eine andere ist,
 * wird trotzdem alles gelesen. Ein falscher Hinweis kostet also Zeit, aber er kann nie
 * dazu führen, dass ein vorhandener Eintrag als verschwunden gilt.
 */
export async function findeMedium(id: string, hinweis?: Sparte): Promise<Fundstelle | null> {
  if (hinweis && SPARTEN.includes(hinweis)) {
    const sicht = await liesBestand([hinweis]);
    const treffer = greifeHeraus(sicht, id);
    if (treffer) return treffer;
  }

  return greifeHeraus(await liesBestand(), id);
}

function greifeHeraus(sicht: Bestandssicht, id: string): Fundstelle | null {
  for (const [sparte, { datei, fassung }] of sicht.dateien) {
    const medium = datei.items.find((eintrag) => eintrag.id === id);
    if (medium) return { medium, sparte, datei, fassung };
  }

  return null;
}

/* ------------------------------------------------------------------ *
 * Suchen und blättern
 * ------------------------------------------------------------------ */

/**
 * Die Felder, über die die Verwaltung sucht.
 *
 * Andere Felder als im Katalog, und mit Absicht: Wer den Bestand pflegt, sucht nach dem,
 * was auf dem Zettel oder im Regal steht — Signatur, Standort, ISBN, notfalls die id.
 * Ein Volltextindex wie im Katalog wäre dafür zu viel Maschinerie; bei 3 500 Einträgen
 * ist das Durchgehen einer Liste im Arbeitsspeicher nicht messbar (plan.md § 4.4).
 */
function suchtext(medium: Medium): string {
  return [
    medium.titel,
    medium.untertitel,
    medium.reihe,
    medium.autor,
    medium.autor_nachname,
    medium.autor_vorname,
    medium.verlag,
    medium.isbn,
    medium.isbn_formatiert,
    medium.signatur,
    medium.standort,
    medium.id,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Filtert nach einem Suchbegriff.
 *
 * Alle Wörter müssen vorkommen, jedes als Wortanfang — „beer rote“ findet „Die rote Frau“
 * von Alex Beer, egal in welcher Reihenfolge die beiden eingetippt wurden. Gefaltet wird
 * mit `falteGrundform` aus der Katalogsuche, damit „Muller“ auch „Müller“ findet und
 * niemand über die Umlaute nachdenken muss.
 */
export function filtereMedien(medien: readonly Medium[], suche: string): Medium[] {
  const begriffe = zerlegeInWorte(falteGrundform(suche.trim()));
  if (begriffe.length === 0) return [...medien];

  return medien.filter((medium) => {
    const worte = zerlegeInWorte(falteGrundform(suchtext(medium)));
    return begriffe.every((begriff) => worte.some((wort) => wort.startsWith(begriff)));
  });
}

/** Eine Seite der Bestandsliste, fertig sortiert. */
export function blaettere(medien: readonly Medium[], seite: number): Seite<Medium> {
  return seiteVon(sortiere([...medien], STANDARD_SORTIERUNG), seite, PRO_SEITE);
}

/* ------------------------------------------------------------------ *
 * Schreiben
 * ------------------------------------------------------------------ */

/** Was nach einer Änderung an die Oberfläche zurückgeht. */
export interface Pflegeergebnis {
  id: string;
  titel: string;
  /** Ein fertiger deutscher Satz für die Meldung über dem Formular. */
  meldung: string;
  /** Wo die Änderung nachzulesen ist — für den Verweis „im Verlauf ansehen“. */
  adresse: string | null;
}

/** Der Satz, der nach dem Speichern über dem Formular steht. */
function meldungZu(beleg: Speicherbeleg, satz: string): string {
  return beleg.unveraendert
    ? 'Es gab nichts zu speichern — die Angaben waren schon genau so hinterlegt.'
    : satz;
}

/**
 * Prüft die Eingabe gegen das Schema und gibt sie als Eintrag zurück.
 *
 * Der erste Schritt jeder schreibenden Route (plan.md § 4.3, Punkt 1). Erst wenn diese
 * Zeile durch ist, darf irgendetwas als `Medium` behandelt werden — was von außen kommt,
 * ist bis dahin nur ein Objekt mit Hoffnungen.
 */
function alsGeprueftesMedium(eingabe: unknown): Medium {
  const ergebnis = pruefeMedium(eingabe);
  if (!ergebnis.gueltig) throw new PflegeFehler(ergebnis.fehler);

  return eingabe as Medium;
}

/** Die Datei einer Sparte aus einer Sicht — oder ein Fehler, der sagt, was fehlt. */
function dateiDerSparte(sicht: Bestandssicht, sparte: Sparte) {
  const datei = sicht.dateien.get(sparte);
  if (!datei) {
    throw new PflegeFehler([
      `Für die Sparte „${sparte}“ gibt es keine Datei im Bestand. Das ist nichts, was ` +
        'Sie falsch gemacht haben — bitte bei der Person melden, die den Katalog betreut.',
    ]);
  }

  return datei;
}

/**
 * Legt einen neuen Eintrag an.
 *
 * Die beiden Prüfungen stehen vor jeder anderen Zeile: Schema und freie `id`. Die zweite
 * braucht den gesamten Bestand — deshalb wird hier alles gelesen und nicht nur die eine
 * Sparte. Eine doppelte id fiele sonst erst beim Build auf, und dann ist sie schon
 * veröffentlicht.
 */
export async function legeAn(eingabe: unknown): Promise<Pflegeergebnis> {
  const medium = alsGeprueftesMedium(eingabe);

  const sicht = await liesBestand();
  const frei = pruefeIdFrei(medium.id, sicht.medien);
  if (!frei.gueltig) throw new PflegeFehler(frei.fehler);

  const ziel = dateiDerSparte(sicht, medium.sparte);
  const beleg = await speichereSparten(
    [
      {
        datei: medium.sparte,
        inhalt: zuDateiinhalt(eintragEinfuegen(ziel.datei, medium)),
        fassung: ziel.fassung,
      },
    ],
    `Neu: „${medium.titel}“ (${medium.sparte}, ${medium.id})`,
  );

  return {
    id: medium.id,
    titel: medium.titel,
    adresse: beleg.adresse,
    meldung: meldungZu(
      beleg,
      `„${medium.titel}“ ist gespeichert. In ein bis zwei Minuten steht der Titel im ` +
        'öffentlichen Katalog.',
    ),
  };
}

/**
 * Ändert einen vorhandenen Eintrag.
 *
 * **`pruefeIdFrei` läuft hier bewusst nicht.** Die Begründung steht in `pruefung.ts`
 * selbst: Der Eintrag fände sich sonst selbst und meldete einen Fehler, den es nicht
 * gibt. An seine Stelle tritt die Prüfung, die beim Ändern die richtige ist — dass die id
 * dieselbe geblieben ist. Sie ist der dauerhafte Schlüssel, an dem die Adresse der
 * Katalogseite hängt; das Formular sperrt das Feld, und diese Zeile sorgt dafür, dass die
 * Sperre auch dann hält, wenn jemand sie im Browser aushebelt.
 *
 * **Der Wechsel der Sparte** ist der einzige Fall, in dem zwei Dateien betroffen sind:
 * Der Eintrag verschwindet aus der einen und erscheint in der anderen — in **einem**
 * Commit, sonst stünde er für die Dauer des zweiten doppelt oder gar nicht da, und genau
 * dazwischen kann ein Build laufen.
 */
export async function aendere(
  id: string,
  eingabe: unknown,
  angaben: { fassung?: string; hinweis?: Sparte } = {},
): Promise<Pflegeergebnis> {
  const medium = alsGeprueftesMedium(eingabe);

  if (medium.id !== id) {
    throw new PflegeFehler([
      `Die Kennung lässt sich nicht ändern: Der Eintrag heißt „${id}“, gespeichert werden ` +
        `sollte „${medium.id}“. An der Kennung hängt die Adresse der Katalogseite. Wenn es ` +
        'ein anderer Titel sein soll, legen Sie bitte einen neuen Eintrag an.',
    ]);
  }

  const fund = await findeMedium(id, angaben.hinweis);
  if (!fund) throw new PflegeFehler([nichtGefunden(id)], { neuLadenNoetig: true });

  // Die Fassung aus dem Formular gilt für die Datei, aus der das Formular gefüllt wurde —
  // sie ist der Schutz gegen den zweiten offenen Tab (plan.md § 5). Für jede weitere
  // Datei gilt die gerade eben gelesene: Zwischen diesem Lesen und dem Schreiben liegen
  // Millisekunden, und auch die prüft die Ablage noch einmal nach.
  const fassungDerHerkunft = angaben.fassung ?? fund.fassung;

  if (medium.sparte === fund.sparte) {
    const beleg = await speichereSparten(
      [
        {
          datei: fund.sparte,
          inhalt: zuDateiinhalt(eintragAendern(fund.datei, medium)),
          fassung: fassungDerHerkunft,
        },
      ],
      `Geändert: „${medium.titel}“ (${fund.sparte}, ${id})`,
    );

    return {
      id,
      titel: medium.titel,
      adresse: beleg.adresse,
      meldung: meldungZu(
        beleg,
        `Die Änderungen an „${medium.titel}“ sind gespeichert. In ein bis zwei Minuten ` +
          'sind sie im Katalog zu sehen.',
      ),
    };
  }

  const zielSicht = await liesBestand([medium.sparte]);
  const ziel = dateiDerSparte(zielSicht, medium.sparte);

  const beleg = await speichereSparten(
    [
      {
        datei: fund.sparte,
        inhalt: zuDateiinhalt(eintragEntfernen(fund.datei, fund.medium)),
        fassung: fassungDerHerkunft,
      },
      {
        datei: medium.sparte,
        inhalt: zuDateiinhalt(eintragEinfuegen(ziel.datei, medium)),
        fassung: ziel.fassung,
      },
    ],
    `Verschoben: „${medium.titel}“ von ${fund.sparte} nach ${medium.sparte} (${id})`,
  );

  return {
    id,
    titel: medium.titel,
    adresse: beleg.adresse,
    meldung: meldungZu(
      beleg,
      `„${medium.titel}“ steht jetzt in einer anderen Sparte und ist gespeichert. In ein ` +
        'bis zwei Minuten ist die Änderung im Katalog zu sehen.',
    ),
  };
}

/**
 * Löscht einen Eintrag — in den Papierkorb (plan.md § 4.5).
 *
 * Beide Dateien in **einem** Commit: Der Eintrag verschwindet aus seiner Sparte und
 * erscheint in `_geloescht.json` im selben Augenblick. Zwei Commits hätten einen
 * Zwischenzustand, in dem er nirgends steht — und wer dann den Papierkorb öffnet, sieht
 * ihn nicht.
 *
 * Zur Unterscheidung, die die Oberfläche benennen muss: Löschen heißt „der Datensatz war
 * ein Versehen“. Ein Buch, das die Bücherei aussortiert hat, wird **nicht** gelöscht,
 * sondern bekommt `status: "ausgeschieden"` — es bleibt im Katalog sichtbar, mit seiner
 * Geschichte.
 */
export async function loesche(
  id: string,
  angaben: { fassung?: string; hinweis?: Sparte } = {},
): Promise<Pflegeergebnis> {
  const fund = await findeMedium(id, angaben.hinweis);
  if (!fund) throw new PflegeFehler([nichtGefunden(id)], { neuLadenNoetig: true });

  const korb = await liesPapierkorb();

  const beleg = await speichereSparten(
    [
      {
        datei: fund.sparte,
        inhalt: zuDateiinhalt(eintragEntfernen(fund.datei, fund.medium)),
        fassung: angaben.fassung ?? fund.fassung,
      },
      {
        datei: PAPIERKORB,
        inhalt: zuDateiinhalt(papierkorbEinfuegen(korb.datei, fund.medium)),
        fassung: korb.fassung,
      },
    ],
    `Gelöscht: „${fund.medium.titel}“ (${fund.sparte}, ${id}) — in den Papierkorb`,
  );

  return {
    id,
    titel: fund.medium.titel,
    adresse: beleg.adresse,
    meldung: meldungZu(
      beleg,
      `„${fund.medium.titel}“ liegt jetzt im Papierkorb und ist nicht mehr im Katalog. ` +
        'Verloren ist nichts: Der Eintrag lässt sich dort jederzeit zurückholen.',
    ),
  };
}

/**
 * Holt einen Eintrag aus dem Papierkorb zurück in seine Sparte.
 *
 * Auch das ist ein Schreibvorgang und bekommt deshalb beide Prüfungen: Das Schema, weil
 * im Papierkorb ein Eintrag liegen kann, der dort schon lange liegt und einem inzwischen
 * geänderten Schema nicht mehr genügt — und die freie `id`, weil in der Zwischenzeit
 * jemand denselben Titel neu angelegt haben kann. Genau dann darf nicht
 * wiederhergestellt werden: Zwei Einträge mit derselben id überschreiben sich beim Bauen
 * der Seiten gegenseitig.
 *
 * In welche Sparte der Eintrag zurückgeht, sagt er selbst — deshalb braucht der
 * Papierkorb keine zusätzliche Angabe dafür.
 */
export async function stelleWiederHer(id: string): Promise<Pflegeergebnis> {
  const korb = await liesPapierkorb();
  const eintrag = korb.datei.items.find((vorhanden) => vorhanden.id === id);

  if (!eintrag) {
    throw new PflegeFehler(
      [
        `Im Papierkorb liegt kein Eintrag mit der Kennung „${id}“. Vermutlich wurde er ` +
          'schon zurückgeholt. Bitte die Seite neu laden.',
      ],
      { neuLadenNoetig: true },
    );
  }

  const medium = alsGeprueftesMedium(eintrag);

  const sicht = await liesBestand();
  const frei = pruefeIdFrei(medium.id, sicht.medien);
  if (!frei.gueltig) {
    throw new PflegeFehler([
      `„${medium.titel}“ lässt sich nicht zurückholen: ${frei.fehler.join(' ')}`,
    ]);
  }

  const ziel = dateiDerSparte(sicht, medium.sparte);

  const beleg = await speichereSparten(
    [
      {
        datei: medium.sparte,
        inhalt: zuDateiinhalt(eintragEinfuegen(ziel.datei, medium)),
        fassung: ziel.fassung,
      },
      {
        datei: PAPIERKORB,
        inhalt: zuDateiinhalt(papierkorbEntfernen(korb.datei, id)),
        fassung: korb.fassung,
      },
    ] satisfies ZuSchreibendeDatei[],
    `Wiederhergestellt: „${medium.titel}“ (${medium.sparte}, ${id}) — aus dem Papierkorb`,
  );

  return {
    id,
    titel: medium.titel,
    adresse: beleg.adresse,
    meldung: meldungZu(
      beleg,
      `„${medium.titel}“ ist wieder im Bestand. In ein bis zwei Minuten steht der Titel ` +
        'wieder im Katalog.',
    ),
  };
}

/** Ein Satz, der dreimal gebraucht wird — und dreimal derselbe sein soll. */
function nichtGefunden(id: string): string {
  return (
    `Es gibt keinen Eintrag mit der Kennung „${id}“. Vermutlich wurde er in der ` +
    'Zwischenzeit gelöscht oder verschoben. Bitte die Bestandsliste neu laden.'
  );
}
