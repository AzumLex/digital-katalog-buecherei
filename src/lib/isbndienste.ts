/**
 * Angaben von außen: Wer eine ISBN kennt, wird gefragt — der Reihe nach.
 *
 * Das Modul holt zu einer ISBN das, was fremde Dienste über das Buch wissen, und gibt es
 * zurück. **Gespeichert wird davon nichts.** Der Weg endet im Formular, wo die Bücherei
 * die Angaben ansieht, berichtigt und dann selbst speichert (plan.md § 4.6). Der Grund
 * steht in NOTIZEN.md auf jeder zweiten Seite: In diesem Bestand wird genau hingesehen,
 * und fremde Metadaten halten dem oft nicht stand — sie haben englische Sachgruppen,
 * falsche Auflagen und Verlagsnamen, die halbe Sätze sind.
 *
 * **Die Anbieter stehen hintereinander, der erste Treffer gewinnt.** Jeder von ihnen
 * erfüllt dieselbe schmale Schnittstelle (`Anbieter`), damit ein weiterer nur eine
 * Funktion und eine Zeile in der Liste kostet — und damit die Herkunft immer mitgeführt
 * werden kann. Die Oberfläche nennt sie („Angaben von Google Books“); wer eine Angabe für
 * falsch hält, soll wissen, wen er nicht fragen muss.
 *
 * **Keine neue Abhängigkeit.** `fetch` bringt Node mit, beide Dienste antworten mit JSON
 * und brauchen keinen Schlüssel.
 *
 * Läuft nur auf dem Server: Der Aufruf aus dem Browser wäre eine Anfrage von der Bücherei
 * an einen fremden Dienst — mit ihrer Adresse, ihrem Browser und ohne dass wir wüssten,
 * was dabei mitgeschickt wird.
 */
import schema from '../../schema/medium.schema.json' with { type: 'json' };
import type { Medium } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Was ein Anbieter liefern darf
 * ------------------------------------------------------------------ */

/**
 * Die Felder, die aus einer fremden Quelle kommen dürfen.
 *
 * Bewusst eine kurze Liste. Alles, was die Bücherei über ihr **Exemplar** weiß —
 * `bestand`, `standort`, `signatur`, `status`, `erfasst_am` —, kann ein Dienst nicht
 * wissen und darf er deshalb auch nicht vorschlagen. `genres` fehlt mit Absicht: Google
 * Books liefert dort englische Sachgruppen („Fiction“), und die stünden anschließend
 * neben den deutschen Genres des Katalogs in denselben Filterlisten.
 */
export type Teilmedium = Partial<
  Pick<
    Medium,
    | 'titel'
    | 'untertitel'
    | 'autor'
    | 'autor_nachname'
    | 'autor_vorname'
    | 'weitere_autoren'
    | 'verlag'
    | 'ort'
    | 'jahr'
    | 'seiten'
    | 'sprache'
  >
>;

/**
 * Ein Anbieter — die Schnittstelle aus plan.md § 4.6.
 *
 * `hole` gibt `null` zurück, wenn der Dienst das Buch nicht kennt, und wirft, wenn er
 * nicht antwortet. Der Unterschied zählt: Das eine heißt „weitersuchen“, das andere
 * „später noch einmal versuchen“, und die Oberfläche sagt der Bücherei je etwas anderes.
 */
export interface Anbieter {
  name: string;
  hole(isbn: string): Promise<Teilmedium | null>;
}

/* ------------------------------------------------------------------ *
 * Gemeinsames Handwerkszeug
 * ------------------------------------------------------------------ */

/**
 * Wie lange auf einen Dienst gewartet wird.
 *
 * Sechs Sekunden je Anbieter. Die Serverfunktion darf 30 Sekunden laufen
 * (`astro.config.mjs`), und vor dem ersten Dienst wird schon der Bestand gelesen. Wer
 * eine ISBN eintippt, wartet außerdem — nach zwölf Sekunden ist von Hand eintragen
 * schneller als weiter zu warten.
 */
const ZEITGRENZE_MS = 6_000;

/**
 * Die Grenzen für `jahr` und `seiten` — aus dem Schema, nicht von Hand.
 *
 * Fremde Daten enthalten Jahreszahlen wie `0` oder `9999` und Seitenzahlen von `0`. Was
 * das Schema ohnehin ablehnen würde, soll gar nicht erst im Formular stehen: Sonst
 * scheitert das Speichern an einer Zahl, die niemand eingetippt hat.
 */
const JAHR = schema.properties.jahr;
const SEITEN_MIN = schema.properties.seiten.minimum;

/** Holt JSON von einer Adresse — mit Zeitgrenze und ohne Umschweife. */
async function holeJson(adresse: string): Promise<unknown> {
  const abbruch = AbortSignal.timeout(ZEITGRENZE_MS);
  const antwort = await fetch(adresse, {
    signal: abbruch,
    headers: {
      accept: 'application/json',
      // Ein Kennzeichen, an dem die Betreiber erkennen, wer da fragt. Beide Dienste bitten
      // in ihren Hinweisen darum; ohne eines sieht der Aufruf aus wie ein Skript, das man
      // sperren möchte.
      'user-agent': 'buecherei-katalog (Bestandspflege)',
    },
  });

  if (!antwort.ok) {
    throw new Error(`${adresse} antwortete mit ${antwort.status}`);
  }

  return antwort.json();
}

/** Text aus fremden Daten: nur, wenn wirklich etwas dasteht. */
function text(wert: unknown): string | undefined {
  if (typeof wert !== 'string') return undefined;
  const sauber = wert.trim();
  return sauber === '' ? undefined : sauber;
}

/** Die erste vierstellige Zahl in einer Datumsangabe — „Mar 01, 2016“ ebenso wie „2016“. */
function jahrAus(wert: unknown): number | undefined {
  const treffer = /\d{4}/.exec(String(wert ?? ''));
  if (!treffer) return undefined;

  const jahr = Number(treffer[0]);
  return jahr >= JAHR.minimum && jahr <= JAHR.maximum ? jahr : undefined;
}

/** Eine Seitenzahl, sofern sie eine sein kann. */
function seitenAus(wert: unknown): number | undefined {
  const zahl = Number(wert);
  return Number.isInteger(zahl) && zahl >= SEITEN_MIN ? zahl : undefined;
}

/**
 * Zerlegt „Alex Beer“ in Vor- und Nachnamen.
 *
 * Das letzte Wort ist der Nachname, alles davor der Vorname. Bewusst ohne Klugheit bei
 * „de“, „van“ und „von“: Der Bestand schreibt genau so — „Simone de Beauvoir“ steht dort
 * als Vorname „Simone de“, Nachname „Beauvoir“. Eine Sonderbehandlung hier ergäbe eine
 * zweite Schreibweise für dieselbe Sorte Name, und danach sortierte der Katalog dieselbe
 * Autorin an zwei Stellen ein.
 *
 * Was die Regel falsch macht, sieht die Bücherei im Formular und berichtigt es — dafür
 * ist der Abruf ein Vorschlag und keine Übernahme.
 */
function zerlegeName(name: string): { autor: string; vorname?: string; nachname: string } {
  const teile = name.trim().split(/\s+/);
  const nachname = teile.at(-1) ?? name;
  const vorname = teile.slice(0, -1).join(' ');

  return { autor: name.trim(), vorname: vorname || undefined, nachname };
}

/** Trägt eine Autorenliste in die Felder ein, die der Katalog dafür hat. */
function mitAutoren(angaben: Teilmedium, namen: unknown): Teilmedium {
  const liste = (Array.isArray(namen) ? namen : [])
    .map((eintrag) => text(eintrag))
    .filter((eintrag): eintrag is string => eintrag !== undefined);

  if (liste.length === 0) return angaben;

  const { autor, vorname, nachname } = zerlegeName(liste[0]!);

  return {
    ...angaben,
    autor,
    autor_vorname: vorname,
    autor_nachname: nachname,
    // Alle weiteren Beteiligten bleiben als Anzeigeform stehen: Für sie gibt es im Schema
    // keine getrennten Namensfelder, weil nach ihnen nicht sortiert wird.
    weitere_autoren: liste.length > 1 ? liste.slice(1) : undefined,
  };
}

/** Wirft alles weg, was leer geblieben ist — die Regel aus plan.md § 9 (c), schon hier. */
function ohneLeeres(angaben: Teilmedium): Teilmedium | null {
  const roh = angaben as Record<string, unknown>;
  const sauber: Record<string, unknown> = {};

  for (const [feld, wert] of Object.entries(roh)) {
    if (wert === undefined || wert === null) continue;
    if (Array.isArray(wert) && wert.length === 0) continue;
    sauber[feld] = wert;
  }

  // Ohne Titel ist es kein Fund. Ein Datensatz, der nur „Piper, 2016“ sagt, füllt das
  // Formular mit Angaben zu einem Buch, von dem niemand weiß, ob es das richtige ist.
  return sauber.titel ? (sauber as Teilmedium) : null;
}

/* ------------------------------------------------------------------ *
 * Google Books
 * ------------------------------------------------------------------ */

/**
 * Google Books — der erste Anbieter, weil er deutschsprachige Titel am besten kennt.
 *
 * Kein Schlüssel nötig. Die Antwort enthält `totalItems` und `items`; gefragt wird nur der
 * erste Treffer, denn die Suche `q=isbn:…` ist eindeutig — eine ISBN gehört zu genau
 * einer Ausgabe.
 *
 * **Beobachtet beim Bauen:** Ohne Schlüssel rechnet Google alle anfragenden Rechner einer
 * Adresse gegen **ein gemeinsames Tageskontingent**; ist es erschöpft, antwortet der
 * Dienst mit 429 und nennt ein fremdes Projekt als Verursacher. Auf einer
 * Serverfunktion, die sich ihre Ausgangsadresse mit anderen teilt, kann das jederzeit
 * passieren. Deshalb ist OpenLibrary nicht bloß Zierde, sondern der Fall, der dann
 * eintritt — und deshalb sagt die Oberfläche, wenn ein Dienst nicht geantwortet hat,
 * statt „nichts gefunden“ zu behaupten. Wird es zum Dauerzustand, wäre ein eigener
 * API-Schlüssel in einer Umgebungsvariablen der nächste Schritt (plan.md § 9 (d)).
 */
const googleBooks: Anbieter = {
  name: 'Google Books',

  async hole(isbn) {
    const daten = (await holeJson(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(isbn)}`,
    )) as { items?: Array<{ volumeInfo?: Record<string, unknown> }> };

    const buch = daten.items?.[0]?.volumeInfo;
    if (!buch) return null;

    return ohneLeeres(
      mitAutoren(
        {
          titel: text(buch.title),
          untertitel: text(buch.subtitle),
          verlag: text(buch.publisher),
          jahr: jahrAus(buch.publishedDate),
          seiten: seitenAus(buch.pageCount),
          sprache: text(buch.language),
        },
        buch.authors,
      ),
    );
  },
};

/* ------------------------------------------------------------------ *
 * OpenLibrary
 * ------------------------------------------------------------------ */

/**
 * OpenLibrary — der zweite Versuch.
 *
 * Bei deutschen Titeln lückenhaft, dafür oft mit Erscheinungsort, den Google Books nicht
 * mitliefert. Die Antwort ist ein Objekt, dessen einziger Schlüssel die angefragte ISBN
 * ist (`ISBN:9783…`) — deshalb wird der erste Wert genommen und nicht ein bestimmter
 * Schlüssel gesucht: Ob der Dienst die Schreibweise der Anfrage übernimmt, ist nicht
 * zugesichert.
 *
 * `sprache` bleibt hier leer. `jscmd=data` liefert dazu nichts Verlässliches, und eine
 * geratene Sprache wäre schlechter als keine: Der Katalog zeigt sie als Angabe an.
 */
const openLibrary: Anbieter = {
  name: 'OpenLibrary',

  async hole(isbn) {
    const daten = (await holeJson(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`,
    )) as Record<string, Record<string, unknown> | undefined>;

    const buch = Object.values(daten)[0];
    if (!buch) return null;

    const ersteAngabe = (werte: unknown): string | undefined =>
      Array.isArray(werte) ? text((werte[0] as { name?: unknown } | undefined)?.name) : undefined;

    return ohneLeeres(
      mitAutoren(
        {
          titel: text(buch.title),
          untertitel: text(buch.subtitle),
          verlag: ersteAngabe(buch.publishers),
          ort: ersteAngabe(buch.publish_places),
          jahr: jahrAus(buch.publish_date),
          seiten: seitenAus(buch.number_of_pages),
        },
        Array.isArray(buch.authors)
          ? buch.authors.map((person) => (person as { name?: unknown } | null)?.name)
          : [],
      ),
    );
  },
};

/* ------------------------------------------------------------------ *
 * Die Deutsche Nationalbibliothek — die vorbereitete Stelle
 * ------------------------------------------------------------------ */

/**
 * **Noch nicht gebaut, mit Absicht** (plan.md § 4.6, Anbieter 3).
 *
 * Sachlich wären die Angaben der DNB für deutschsprachige Bücher die besten von allen:
 * Verlag, Ort, Seitenzahl und Einband kommen dort aus der Pflichtablieferung und nicht aus
 * einem Händlerkatalog. Die Schnittstelle ist SRU
 * (`https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&query=num%3D<isbn>`)
 * und antwortet mit MARC21-XML, nicht mit JSON.
 *
 * **Zu klären ist eine einzige Frage:** ob der SRU-Zugang weiterhin ohne Zugangstoken
 * benutzt werden darf und was die aktuellen Nutzungsbedingungen für eine öffentlich
 * erreichbare Seite verlangen — das hat sich in der Vergangenheit geändert, und wenn ein
 * Token nötig ist, kommt eine weitere Umgebungsvariable dazu (plan.md § 9 (d)).
 *
 * Erst wenn das beantwortet ist, entsteht hier ein dritter `Anbieter` mit einem
 * XML-Auswerter — ein `DOMParser` steht in der Serverumgebung nicht zur Verfügung, es
 * liefe also auf ein paar reguläre Ausdrücke für die gebrauchten MARC-Felder hinaus oder
 * auf die erste zusätzliche Abhängigkeit dieses Umbaus. Auch das gehört in die
 * Entscheidung.
 */
export const DNB_STEHT_AUS =
  'Die DNB wäre der dritte Anbieter. Vor dem Bau ist zu klären, ob ihr SRU-Zugang ohne ' +
  'Zugangstoken benutzt werden darf.';

/* ------------------------------------------------------------------ *
 * Die Reihe
 * ------------------------------------------------------------------ */

/** Die Anbieter in der Reihenfolge, in der sie gefragt werden. */
export const ANBIETER: readonly Anbieter[] = [googleBooks, openLibrary];

/** Das Ergebnis einer Abfrage über alle Anbieter. */
export interface Abfrageergebnis {
  /** Der Name des Anbieters, von dem die Angaben stammen; `null`, wenn keiner etwas wusste. */
  herkunft: string | null;
  angaben: Teilmedium | null;
  /**
   * Wahr, wenn mindestens ein Anbieter nicht geantwortet hat.
   *
   * Der Unterschied zu „nichts gefunden“ ist für die Bücherei der zwischen „das Buch ist
   * dort nicht verzeichnet“ und „gleich noch einmal versuchen“.
   */
  gestoert: boolean;
}

/**
 * Fragt die Anbieter der Reihe nach; der erste Treffer gewinnt.
 *
 * Ein Dienst, der nicht antwortet, hält den Vorgang nicht auf: Sein Fehler wird ins
 * Protokoll geschrieben und der nächste gefragt. Für die Person vor dem Formular ist ein
 * Ausfall bei Google Books kein Grund, gar nichts zu bekommen.
 */
export async function holeAngaben(isbn: string): Promise<Abfrageergebnis> {
  let gestoert = false;

  for (const anbieter of ANBIETER) {
    try {
      const angaben = await anbieter.hole(isbn);
      if (angaben) return { herkunft: anbieter.name, angaben, gestoert };
    } catch (fehler) {
      gestoert = true;
      console.error(`ISBN-Abruf bei ${anbieter.name} fehlgeschlagen:`, fehler);
    }
  }

  return { herkunft: null, angaben: null, gestoert };
}
