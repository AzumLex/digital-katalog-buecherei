/**
 * Der Weg der Daten ins Repository — das einzige Modul, das GitHub kennt.
 *
 * Alles darüber spricht nur noch von Dateien und ihrem Inhalt: `holeSparte` gibt Text
 * zurück, `speichereSparten` nimmt Text entgegen. Was dazwischen passiert — Blob,
 * Baum, Commit, Ref —, bleibt hier drin. Der Grund steht in plan.md § 7: Tritt eines
 * Tages eine Datenbank an diese Stelle, wird genau diese eine Datei ersetzt und sonst
 * nichts. Deshalb taucht das Wort „GitHub“ in keinem anderen Modul auf, und deshalb
 * heißen die Begriffe hier nach der Sache und nicht nach dem Anbieter: `fassung` statt
 * „Blob-SHA“, `Speicherbeleg` statt „Commit“, `AblageFehler` statt „GithubFehler“.
 *
 * **Git-Data-API, nicht Contents-API** (plan.md § 2). Die Contents-API liefert
 * Dateiinhalte nur bis etwa 1 MB aus; `romane.json` reißt diese Grenze bei 3 500
 * Einträgen. Die Git-Data-API kennt sie nicht — und sie kann mehrere Dateien in
 * **einen** Commit legen. Das wird an zwei Stellen zwingend gebraucht: beim Verschieben
 * eines Titels in eine andere Sparte und beim Löschen (§ 4.5). Mit zwei Commits stünde
 * der Eintrag für die Dauer des zweiten doppelt oder gar nicht da — und genau dazwischen
 * kann ein Build laufen.
 *
 * **Keine neue Abhängigkeit.** `fetch` und `Buffer` bringt Node mit; ein API-Klient
 * wäre für sechs Endpunkte ein schlechter Tausch.
 *
 * **Kein Geheimnis im Browser.** Dieses Modul liest `GITHUB_TOKEN` aus der Umgebung und
 * läuft ausschließlich serverseitig: in Dateien mit `export const prerender = false`
 * und in der Middleware, nie im `<script>` einer `.astro`-Datei und nie als Prop
 * weitergereicht. Die Umgebung wird erst beim Aufruf gelesen und nicht beim Import —
 * sonst könnte der statische Build den Katalog nicht mehr erzeugen, nur weil auf dem
 * bauenden Rechner kein Token liegt.
 */

/**
 * Nur der Typ, nie das Modul selbst — wie in `pruefung.ts` und `bestand.ts`.
 *
 * `daten.ts` liest beim Laden über `import.meta.glob` den ganzen Bestand ein; das kann
 * nur Vite. Ein `import type` verschwindet beim Übersetzen restlos und hält dieses
 * Modul frei von allem, was einen Build voraussetzt.
 */
import type { Sparte } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Was hier abgelegt wird
 * ------------------------------------------------------------------ */

/**
 * Der Papierkorb (plan.md § 4.5).
 *
 * Dateien mit führendem Unterstrich werden weder von `scripts/validate.mjs` noch von
 * `src/lib/daten.ts` eingelesen — deshalb ist eine solche Datei der fertige Papierkorb,
 * ohne dass am Katalog, am Schema oder an der Prüfung irgendetwas anzupassen wäre.
 *
 * Der Name steht hier und nicht in `bestand.ts`, weil dieses Modul die Zuordnung von
 * Ablagefach zu Dateipfad besitzt. Eine spätere Datenbank hätte statt der Datei eine
 * Tabelle, aber dasselbe Fach.
 */
export const PAPIERKORB = '_geloescht';

/** Ein Ablagefach: eine der sieben Sparten oder der Papierkorb. */
export type Bestandsdatei = Sparte | typeof PAPIERKORB;

/** Eine gelesene Datei, so wie sie im Repository steht. */
export interface GeholteDatei {
  datei: Bestandsdatei;
  /** Der Text, wortgleich mit der Datei — direkt für `ausDateiinhalt` aus `bestand.ts`. */
  inhalt: string;
  /**
   * Die Kennung genau dieser Fassung.
   *
   * Sie wandert als verstecktes Feld ins Formular und kommt beim Speichern zurück
   * (plan.md § 4.2). Beim Schreiben wird geprüft, ob sie noch gilt — das ist der Schutz
   * gegen die zwei offenen Tabs aus § 5. Bei GitHub ist das der Blob-SHA, bei einer
   * Datenbank wäre es eine Versionsnummer; der Aufrufer soll den Wert nur durchreichen
   * und nie auslegen.
   */
  fassung: string;
}

/** Eine Datei, die geschrieben werden soll. */
export interface ZuSchreibendeDatei {
  datei: Bestandsdatei;
  /** Der vollständige neue Inhalt — aus `zuDateiinhalt` in `bestand.ts`. */
  inhalt: string;
  /**
   * Die Fassung, auf der die Änderung aufsetzt; `null` heißt „die Datei gab es noch
   * nicht“ — der Fall des Papierkorbs vor der ersten Löschung.
   *
   * Weggelassen heißt „ungeprüft überschreiben“. Wer eine Datei ändert, die er vorher
   * gelesen hat, reicht die Fassung durch — sonst ist der Schutz aus § 5 ausgeschaltet,
   * und zwar unbemerkt.
   */
  fassung?: string | null;
}

/** Der Nachweis, dass gespeichert wurde. */
export interface Speicherbeleg {
  /** Die Kennung des Speichervorgangs — bei GitHub der Commit-SHA. */
  kennung: string;
  /** Wo die Änderung nachzulesen ist, falls die Ablage so etwas anbietet. */
  adresse: string | null;
  /**
   * Wahr, wenn der neue Inhalt Zeichen für Zeichen dem alten entsprach.
   *
   * Dann entsteht **kein** Commit. Ein leerer Commit stieße einen Build und einen
   * Action-Lauf an, ohne dass sich etwas geändert hätte — und stünde für immer als
   * Änderung in einer Historie, die genau deshalb lesbar ist, weil dort nur echte
   * Änderungen stehen. Die Oberfläche darf das ruhig sagen: „Es gab nichts zu speichern.“
   */
  unveraendert: boolean;
}

/* ------------------------------------------------------------------ *
 * Fehler
 * ------------------------------------------------------------------ */

/**
 * Ein Fehler, dessen Text der Person auf der Verwaltungsseite gezeigt werden darf.
 *
 * `message` ist deutscher Klartext und nennt, wo immer möglich, den nächsten Handgriff.
 * Das ist die Zusage aus plan.md § 5: **nicht „401“**. Wer diesen Fehler fängt, zeigt
 * `fehler.message` an und muss nichts übersetzen.
 *
 * Die drei Zusatzangaben sind für die Oberfläche, nicht für den Text: `neuLadenNoetig`
 * heißt „ein zweiter Stand ist im Weg, die Seite muss neu geladen werden“,
 * `wiederholbar` heißt „derselbe Knopf noch einmal kann klappen“, `status` ist die
 * HTTP-Antwort fürs Protokoll — nie für die Anzeige.
 */
export class AblageFehler extends Error {
  readonly status?: number;
  readonly neuLadenNoetig: boolean;
  readonly wiederholbar: boolean;

  constructor(
    meldung: string,
    angaben: { status?: number; neuLadenNoetig?: boolean; wiederholbar?: boolean } = {},
  ) {
    super(meldung);
    this.name = 'AblageFehler';
    this.status = angaben.status;
    this.neuLadenNoetig = angaben.neuLadenNoetig ?? false;
    this.wiederholbar = angaben.wiederholbar ?? false;
  }
}

/* ------------------------------------------------------------------ *
 * Einstellungen aus der Umgebung
 * ------------------------------------------------------------------ */

/** Wo die Bestandsdateien im Repository liegen. */
const DATENORDNER = 'src/data';

/**
 * Voreinstellung für den Commit-Autor.
 *
 * Der Name kommt aus plan.md § 9 (d). Die Adresse endet auf `.invalid` — eine Endung,
 * die es laut RFC 2606 nie geben wird und die deshalb garantiert niemandem gehört. Ein
 * ausgedachtes `…@users.noreply.github.com` könnte dagegen auf ein fremdes Konto
 * zeigen, und die Änderungen der Bücherei stünden in dessen Beitragsübersicht.
 * `COMMIT_AUTOR_EMAIL` auf eine erreichbare Sammeladresse zu setzen bleibt das Bessere.
 */
const AUTOR_NAME = 'Bücherei';
const AUTOR_EMAIL = 'bestandspflege@buecherei.invalid';

/** Wie lange auf eine einzelne Antwort gewartet wird, bevor abgebrochen wird. */
const ZEITGRENZE_MS = 10_000;

interface Einstellungen {
  repository: string;
  zweig: string;
  token: string;
  autor: { name: string; email: string };
}

/** Liest eine Umgebungsvariable; leer und „nicht gesetzt“ sind dasselbe. */
function umgebung(name: string): string | undefined {
  const wert = process.env[name];
  return wert && wert.trim() !== '' ? wert.trim() : undefined;
}

/**
 * Sammelt die Einstellungen — bei jedem Aufruf neu, nicht beim Import.
 *
 * Ein Zwischenspeicher spräche nichts dagegen, spart aber nichts (Vercel legt die Werte
 * beim Erzeugen der Funktion fest) und sorgte im lokalen Entwicklungsserver dafür, dass
 * eine geänderte `.env.local` erst nach einem Neustart wirkt.
 *
 * Fehlt etwas Pflichtiges, ist das kein Programmfehler, sondern eine unfertige
 * Einrichtung — deshalb ein `AblageFehler` mit dem Namen der Variablen im Text und
 * nicht ein `TypeError` zehn Zeilen später.
 */
function einstellungen(): Einstellungen {
  const token = umgebung('GITHUB_TOKEN');
  if (!token) {
    throw new AblageFehler(
      'Es ist kein Zugriffstoken für GitHub hinterlegt, deshalb kann nichts gespeichert ' +
        'werden. Zu tun ist das bei der Person, die den Katalog betreut: in den ' +
        'Vercel-Einstellungen unter „Environment Variables“ die Variable GITHUB_TOKEN ' +
        'eintragen und danach neu bereitstellen.',
    );
  }

  // Vercel stellt Konto und Repository der Bereitstellung auch zur Laufzeit bereit
  // (nachgeprüft in Paket 4: VERCEL_GIT_REPO_OWNER / VERCEL_GIT_REPO_SLUG stehen in der
  // Funktion). Das ist der bequeme Rückfallwert, aber nicht der maßgebliche: Bei einer
  // Vorschau aus einer Abspaltung zeigen die beiden auf das fremde Repository. Wer
  // GITHUB_REPOSITORY setzt, legt fest, wohin geschrieben wird — und dieser Zeile sieht
  // man an, was sie tut.
  const konto = umgebung('VERCEL_GIT_REPO_OWNER');
  const kuerzel = umgebung('VERCEL_GIT_REPO_SLUG');
  const repository =
    umgebung('GITHUB_REPOSITORY') ?? (konto && kuerzel ? `${konto}/${kuerzel}` : undefined);

  if (!repository) {
    throw new AblageFehler(
      'Es ist nicht hinterlegt, in welches Repository geschrieben werden soll. In den ' +
        'Vercel-Einstellungen die Variable GITHUB_REPOSITORY eintragen: Konto und ' +
        'Repository mit einem Schrägstrich dazwischen, genau wie in der ' +
        'GitHub-Adresszeile.',
    );
  }

  return {
    repository,
    zweig: umgebung('GITHUB_BRANCH') ?? 'main',
    token,
    autor: {
      name: umgebung('COMMIT_AUTOR_NAME') ?? AUTOR_NAME,
      email: umgebung('COMMIT_AUTOR_EMAIL') ?? AUTOR_EMAIL,
    },
  };
}

/* ------------------------------------------------------------------ *
 * Ablauf des Zugriffstokens
 * ------------------------------------------------------------------ */

/**
 * Das Ablaufdatum aus der zuletzt erhaltenen Antwort, als `JJJJ-MM-TT`.
 *
 * **Nachgeprüft (Paket 4): GitHub schickt das Datum von sich aus mit.** Bei einem fein
 * abgestuften Token trägt jede Antwort die Kopfzeile
 * `github-authentication-token-expiration`. Die Umgebungsvariable `GITHUB_TOKEN_ABLAUF`
 * aus plan.md § 9 (d) entfällt damit ersatzlos — ein von Hand gepflegtes Datum wäre
 * ohnehin die zweite Wahrheit, die beim Erneuern des Tokens als Erstes vergessen wird.
 */
let zuletztGemeldeterAblauf: string | null = null;

/**
 * Wann läuft das Zugriffstoken ab?
 *
 * Für die Warnung auf `/verwaltung/`, die plan.md § 5 verlangt: Der abgelaufene Token
 * ist das wahrscheinlichste Problem im Betrieb, und er kündigt sich von allein nicht
 * an. `null` heißt „noch nicht bekannt“ — die Angabe stammt aus der letzten Antwort, es
 * muss also vorher etwas gelesen worden sein — oder „Token ohne Ablaufdatum“.
 */
export function tokenAblauf(): { datum: string; tageBis: number } | null {
  if (!zuletztGemeldeterAblauf) return null;

  // Auf das Ende des Tages gerechnet und in UTC: Für eine Warnung ab 30 Tagen ist die
  // Uhrzeit belanglos, eine falsch verstandene Zeitzone wäre es nicht.
  const ablauf = Date.parse(`${zuletztGemeldeterAblauf}T23:59:59Z`);
  if (Number.isNaN(ablauf)) return null;

  return {
    datum: zuletztGemeldeterAblauf,
    tageBis: Math.floor((ablauf - Date.now()) / 86_400_000),
  };
}

/* ------------------------------------------------------------------ *
 * Anfragen
 * ------------------------------------------------------------------ */

interface Anfrage {
  /** Was gerade versucht wird, als Halbsatz: „beim Lesen des Bestands“. */
  zweck: string;
  weg: string;
  methode?: 'GET' | 'POST' | 'PATCH';
  koerper?: unknown;
  /** Rohen Text statt JSON erwarten — für den Inhalt eines Blobs. */
  alsText?: boolean;
}

/**
 * Eine Anfrage an die GitHub-API, mit allem, was jede Anfrage braucht.
 *
 * Zwei der Kopfzeilen sind nicht verhandelbar: `X-GitHub-Api-Version` friert das
 * Verhalten auf eine Fassung ein, damit eine Änderung bei GitHub nicht unangekündigt
 * hier ankommt — und ohne `User-Agent` antwortet die API mit 403, was aussieht wie ein
 * fehlendes Recht und stundenlang in die falsche Richtung führt.
 *
 * Die Zeitgrenze steht hier und nicht beim Aufrufer: Eine Serverfunktion auf Vercel wird
 * nach wenigen Sekunden hart beendet, und dann sieht die pflegende Person eine Seite der
 * Plattform statt einer Meldung. Lieber vorher selbst abbrechen und es erklären.
 */
async function anfrage<T>(anfrageDaten: Anfrage): Promise<T> {
  const { repository, token } = einstellungen();
  const { zweck, weg, methode = 'GET', koerper, alsText = false } = anfrageDaten;

  let antwort: Response;
  try {
    antwort = await fetch(`https://api.github.com/repos/${repository}${weg}`, {
      method: methode,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: alsText ? 'application/vnd.github.raw' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'digital-katalog-buecherei',
        ...(koerper === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: koerper === undefined ? undefined : JSON.stringify(koerper),
      signal: AbortSignal.timeout(ZEITGRENZE_MS),
    });
  } catch {
    // Kein Netz, DNS weg, Zeitgrenze überschritten: In allen drei Fällen ist nichts
    // passiert — und das ist wichtiger als die Ursache, denn danach richtet sich, was
    // die Person als Nächstes tun soll.
    throw new AblageFehler(
      `GitHub war ${zweck} nicht erreichbar. Es wurde nichts geändert. Bitte die ` +
        'Internetverbindung prüfen und es in ein paar Minuten noch einmal versuchen.',
      { wiederholbar: true },
    );
  }

  const ablauf = antwort.headers.get('github-authentication-token-expiration');
  if (ablauf) zuletztGemeldeterAblauf = ablauf.slice(0, 10);

  if (!antwort.ok) throw fehlerAus(zweck, antwort, await antwort.text());

  return (alsText ? await antwort.text() : await antwort.json()) as T;
}

/**
 * Übersetzt eine abschlägige Antwort in einen Satz, den die Bücherei lesen kann.
 *
 * Jeder Zweig hier ist ein Fall aus plan.md § 5 — allen voran der abgelaufene Token, das
 * wahrscheinlichste Problem überhaupt. Die Meldungen sagen deshalb nicht nur, was los
 * ist, sondern auch, wo es behoben wird und dass nichts geändert wurde; wer sie zu lesen
 * bekommt, ist in aller Regel nicht die Person, die den Katalog betreut.
 */
function fehlerAus(zweck: string, antwort: Response, koerper: string): AblageFehler {
  const status = antwort.status;

  // GitHub legt seine eigene Begründung als JSON bei. Sie ist englisch und gehört nicht
  // in die Oberfläche — aber ohne sie ist ein unerwarteter Fall später nicht
  // aufzuklären, deshalb hängt sie am Ende der allgemeinen Meldungen.
  let begruendung = koerper.slice(0, 200);
  try {
    const gelesen = JSON.parse(koerper) as { message?: string };
    if (gelesen.message) begruendung = gelesen.message;
  } catch {
    /* Kein JSON — dann bleibt der gekürzte Rohtext. */
  }

  if (status === 401) {
    return new AblageFehler(
      'Das Zugriffstoken für GitHub ist abgelaufen oder ungültig. Es wurde nichts ' +
        'geändert. Das ist nichts, was Sie falsch gemacht haben — bitte bei der Person ' +
        'melden, die den Katalog betreut. Dort ist zu tun: bei GitHub unter Settings → ' +
        'Developer settings → Personal access tokens → Fine-grained tokens ein neues ' +
        'Token für dieses eine Repository erzeugen (Berechtigung „Contents: Read and ' +
        'write“) und es in den Vercel-Einstellungen als GITHUB_TOKEN eintragen. Das ' +
        'dauert fünf Minuten.',
      { status },
    );
  }

  if (status === 403 && antwort.headers.get('x-ratelimit-remaining') === '0') {
    // Als Anzahl Minuten und nicht als Uhrzeit: Die Funktion läuft auf Vercel in UTC,
    // eine dort gebildete Uhrzeit wäre in der Bücherei um zwei Stunden falsch.
    const zuruecksetzung = Number(antwort.headers.get('x-ratelimit-reset'));
    const minuten = Number.isFinite(zuruecksetzung)
      ? Math.max(1, Math.ceil((zuruecksetzung * 1000 - Date.now()) / 60_000))
      : 60;
    return new AblageFehler(
      'GitHub hat in kurzer Zeit zu viele Anfragen bekommen und nimmt für etwa ' +
        `${minuten} Minuten keine weiteren an. Es wurde nichts geändert. Bitte danach ` +
        'noch einmal speichern.',
      { status, wiederholbar: true },
    );
  }

  if (status === 403) {
    return new AblageFehler(
      'Das Zugriffstoken für GitHub darf nicht schreiben. Es wurde nichts geändert. ' +
        'Bitte bei der betreuenden Person melden: Das Token braucht für dieses ' +
        'Repository die Berechtigung „Contents: Read and write“. ' +
        `(GitHub meldet: ${begruendung})`,
      { status },
    );
  }

  if (status === 404) {
    return new AblageFehler(
      'Das Repository oder der Zweig, in den geschrieben werden soll, wurde bei GitHub ' +
        'nicht gefunden. Es wurde nichts geändert. Bitte bei der betreuenden Person ' +
        'melden: Zu prüfen sind GITHUB_REPOSITORY und GITHUB_BRANCH — und ob das ' +
        'Zugriffstoken überhaupt auf dieses Repository zeigt. GitHub antwortet auch dann ' +
        'mit „nicht gefunden“, wenn es das Repository gibt, das Token es aber nicht ' +
        'sehen darf.',
      { status },
    );
  }

  if (status >= 500) {
    return new AblageFehler(
      `GitHub hat ${zweck} mit einer Störung geantwortet (Fehler ${status}). Es wurde ` +
        'nichts geändert. Das liegt nicht am Katalog — bitte in ein paar Minuten noch ' +
        'einmal versuchen.',
      { status, wiederholbar: true },
    );
  }

  return new AblageFehler(
    `GitHub hat die Anfrage ${zweck} abgelehnt (Fehler ${status}). Es wurde nichts ` +
      'geändert. Bitte die Seite neu laden und es noch einmal versuchen; bleibt es ' +
      `dabei, hilft diese Angabe bei der Suche: ${begruendung}`,
    { status, wiederholbar: true },
  );
}

/* ------------------------------------------------------------------ *
 * Der Zustand des Zweigs
 * ------------------------------------------------------------------ */

/** Der Kopf des Zweigs: der letzte Commit, sein Baum und der Inhalt von `src/data/`. */
interface Spitze {
  commit: string;
  baum: string;
  /** Die Bestandsdateien, von Dateiname auf Fassung. */
  dateien: Map<string, string>;
}

interface Baumeintrag {
  path: string;
  type: string;
  sha: string;
}

/**
 * Liest Commit, Baum und den Inhalt von `src/data/` in einem Rutsch.
 *
 * Vier kleine Anfragen (Ref, Commit, `src`, `data`) — und danach ist für **alle**
 * Bestandsdateien bekannt, dass es sie gibt und welche Fassung sie haben. Der Weg über
 * die Verzeichnisse statt über einen rekursiven Baum ist Absicht: Eine rekursive Abfrage
 * liefert das ganze Repository und darf laut GitHub abgeschnitten werden — und ein
 * abgeschnittener Baum sähe hier aus wie eine fehlende Datei, also wie „diese Sparte
 * gibt es nicht“. Der Weg über die Ordner kann das nicht.
 */
async function holeSpitze(): Promise<Spitze> {
  const { zweig } = einstellungen();

  const ref = await anfrage<{ object: { sha: string } }>({
    zweck: 'beim Nachsehen, auf welchem Stand der Katalog ist',
    weg: `/git/ref/heads/${encodeURIComponent(zweig)}`,
  });

  const commit = await anfrage<{ tree: { sha: string } }>({
    zweck: 'beim Nachsehen, auf welchem Stand der Katalog ist',
    weg: `/git/commits/${ref.object.sha}`,
  });

  let baum = commit.tree.sha;
  for (const ordner of DATENORDNER.split('/')) {
    const inhalt = await anfrage<{ tree: Baumeintrag[] }>({
      zweck: 'beim Suchen der Bestandsdateien',
      weg: `/git/trees/${baum}`,
    });

    const eintrag = inhalt.tree.find((kandidat) => kandidat.path === ordner && kandidat.type === 'tree');
    if (!eintrag) {
      throw new AblageFehler(
        `Im Repository gibt es den Ordner „${DATENORDNER}“ nicht, in dem der Bestand ` +
          'liegt. Es wurde nichts geändert. Bitte bei der betreuenden Person melden — ' +
          'vermutlich zeigt GITHUB_REPOSITORY auf das falsche Repository.',
      );
    }
    baum = eintrag.sha;
  }

  const ordnerinhalt = await anfrage<{ tree: Baumeintrag[] }>({
    zweck: 'beim Suchen der Bestandsdateien',
    weg: `/git/trees/${baum}`,
  });

  return {
    commit: ref.object.sha,
    baum: commit.tree.sha,
    dateien: new Map(
      ordnerinhalt.tree
        .filter((eintrag) => eintrag.type === 'blob')
        .map((eintrag) => [eintrag.path, eintrag.sha]),
    ),
  };
}

/* ------------------------------------------------------------------ *
 * Lesen
 * ------------------------------------------------------------------ */

/**
 * Eine Änderung am Bestand, wie sie im Protokoll steht.
 *
 * Die Begriffe sind die der Sache und nicht die des Anbieters — `kennung` statt „SHA",
 * `wer` statt „author.login": Eine Datenbank an dieser Stelle hätte eine Änderungstabelle
 * mit genau diesen Spalten, und die Seite, die das anzeigt, müsste dafür nicht angefasst
 * werden.
 */
export interface Aenderung {
  /** Die Kennung des Speichervorgangs — bei GitHub der Commit-SHA. */
  kennung: string;
  /** Die erste Zeile der Meldung; bei der Verwaltung ein fertiger deutscher Satz. */
  meldung: string;
  /** Wer gespeichert hat. Bei der Verwaltung immer „Bücherei" (plan.md § 9 (d)). */
  wer: string;
  /** Zeitpunkt als ISO-Zeichenkette. */
  wann: string;
  /** Wo die Änderung mit Vorher und Nachher nachzulesen ist. */
  adresse: string;
}

/**
 * Die letzten Änderungen an den Bestandsdateien.
 *
 * Das Protokoll aus plan.md § 4.7 — und zwar bewusst **kein selbstgebautes**: Wer jede
 * Änderung zusätzlich in eine eigene Datei schriebe, hätte eine zweite Wahrheit zu
 * pflegen, die beim ersten Fehlschlag von der ersten abweicht. Die Historie des
 * Repositories steht ohnehin da, ist vollständig und lässt sich nicht nachträglich
 * beschönigen.
 *
 * `path` grenzt auf den Datenordner ein: Ein Commit, der nur das Aussehen ändert, ist
 * keine Bestandsänderung und hat im Protokoll der Bücherei nichts zu suchen.
 *
 * Nur die erste Zeile der Meldung: Die Verwaltung schreibt einzeilige Meldungen, aber ein
 * von Hand gemachter Commit kann einen Rumpf haben — der gehört in die Ansicht bei
 * GitHub, nicht in eine Tabellenzeile.
 */
export async function holeAenderungen(anzahl = 30): Promise<Aenderung[]> {
  const commits = await anfrage<
    Array<{
      sha: string;
      html_url: string;
      commit: { message: string; author?: { name?: string; date?: string } };
    }>
  >({
    zweck: 'beim Lesen des Änderungsprotokolls',
    weg: `/commits?path=${encodeURIComponent(DATENORDNER)}&per_page=${anzahl}`,
  });

  return commits.map((eintrag) => ({
    kennung: eintrag.sha,
    meldung: eintrag.commit.message.split('\n')[0]!.trim(),
    wer: eintrag.commit.author?.name ?? 'unbekannt',
    wann: eintrag.commit.author?.date ?? '',
    adresse: eintrag.html_url,
  }));
}

/**
 * Holt mehrere Dateien auf einmal.
 *
 * Die Mehrzahl ist der Regelfall und nicht die Ausnahme: Die Bestandsliste und die
 * Prüfung auf eine freie `id` brauchen alle sieben Sparten. Der Stand des Zweigs wird
 * dabei **einmal** ermittelt statt siebenmal, und alle Dateien stammen garantiert aus
 * demselben Commit — sieben Einzelabrufe könnten sich einen dazwischen entstandenen
 * Commit einfangen und einen Bestand zeigen, den es so nie gegeben hat.
 *
 * Nicht vorhandene Dateien fehlen im Ergebnis, statt einen Fehler auszulösen: Den
 * Papierkorb gibt es erst, nachdem zum ersten Mal etwas gelöscht wurde.
 */
export async function holeSparten(
  dateien: readonly Bestandsdatei[],
): Promise<Map<Bestandsdatei, GeholteDatei>> {
  const spitze = await holeSpitze();
  const ergebnis = new Map<Bestandsdatei, GeholteDatei>();

  // Nacheinander und nicht gleichzeitig: Bei Dateien von rund einem Megabyte spart
  // Gleichzeitigkeit wenig, kann aber die Ratenbegrenzung auslösen — und der
  // Arbeitsspeicher einer Serverfunktion ist knapper bemessen als die Geduld der
  // Bücherei.
  for (const datei of dateien) {
    const fassung = spitze.dateien.get(`${datei}.json`);
    if (!fassung) continue;

    const inhalt = await anfrage<string>({
      zweck: 'beim Lesen des Bestands',
      weg: `/git/blobs/${fassung}`,
      // Rohtext statt JSON mit Base64: Das spart das Umkodieren einer Megabyte-Datei
      // und umgeht die 10-MB-Grenze, ab der GitHub den Inhalt im JSON gar nicht mehr
      // mitschickt.
      alsText: true,
    });

    ergebnis.set(datei, { datei, inhalt, fassung });
  }

  return ergebnis;
}

/**
 * Holt eine einzelne Datei; `null`, wenn es sie noch nicht gibt.
 *
 * Der Inhalt geht unverändert an `ausDateiinhalt` aus `bestand.ts` — dieses Modul liest
 * ihn nicht, es transportiert ihn nur.
 */
export async function holeSparte(sparte: Bestandsdatei): Promise<GeholteDatei | null> {
  return (await holeSparten([sparte])).get(sparte) ?? null;
}

/* ------------------------------------------------------------------ *
 * Schreiben
 * ------------------------------------------------------------------ */

/**
 * Legt den Inhalt einer Datei als Blob ab und gibt dessen Kennung zurück.
 *
 * Base64 und nicht `utf-8`, obwohl die API beides annimmt: Die abgelegten Bytes sollen
 * genau die sein, die `zuDateiinhalt` erzeugt hat. Bei `utf-8` überließe man die
 * Kodierung dem Server — und `npm run formattest` bewiese die Byte-Gleichheit dann für
 * eine Datei, die so nie geschrieben wurde.
 */
async function legeBlobAn(inhalt: string): Promise<string> {
  const blob = await anfrage<{ sha: string }>({
    zweck: 'beim Speichern',
    weg: '/git/blobs',
    methode: 'POST',
    koerper: { content: Buffer.from(inhalt, 'utf8').toString('base64'), encoding: 'base64' },
  });

  return blob.sha;
}

/** Wo die Änderung nachzulesen ist — für den Verweis in der Oberfläche und im Protokoll. */
function commitAdresse(repository: string, commit: string): string {
  return `https://github.com/${repository}/commit/${commit}`;
}

/**
 * Ein vollständiger Speicherversuch: prüfen, Blob, Baum, Commit, Ref.
 *
 * Genau die fünf Schritte aus plan.md § 4.2, mit der Fassungsprüfung davor. Als eigene
 * Funktion, weil sie im Konfliktfall ein zweites Mal laufen muss — und zwar wirklich von
 * vorn, denn der Commit, auf dem sie aufsetzt, ist dann ein anderer.
 */
async function speicherversuch(
  dateien: readonly ZuSchreibendeDatei[],
  meldung: string,
): Promise<Speicherbeleg> {
  const { repository, zweig, autor } = einstellungen();
  const spitze = await holeSpitze();

  // Zuerst die Fassungsprüfung, vor jedem Schreibschritt: Sie ist der eigentliche Schutz
  // aus plan.md § 5 — zwei offene Tabs, ein Doppelklick, ein Nachtrag während eines
  // laufenden Builds. Ohne sie überschriebe die zweite Änderung die erste stillschweigend,
  // und im Diff sähe das aus wie eine Rücknahme von Hand.
  for (const datei of dateien) {
    if (datei.fassung === undefined) continue;

    const jetzt = spitze.dateien.get(`${datei.datei}.json`) ?? null;
    if (jetzt !== datei.fassung) {
      throw new AblageFehler(
        'Die Daten haben sich in der Zwischenzeit geändert — vermutlich war noch ein ' +
          'zweiter Tab offen oder es wurde zweimal auf „Speichern“ gedrückt. Es wurde ' +
          'nichts geändert, damit die andere Änderung nicht verloren geht. Bitte die ' +
          'Seite neu laden und die Eingabe noch einmal machen.',
        { neuLadenNoetig: true },
      );
    }
  }

  const eintraege = [];
  for (const datei of dateien) {
    eintraege.push({
      path: `${DATENORDNER}/${datei.datei}.json`,
      // 100644 ist die gewöhnliche Datei ohne Ausführungsrecht — die einzige Betriebsart,
      // die für eine JSON-Datei in Frage kommt.
      mode: '100644',
      type: 'blob',
      sha: await legeBlobAn(datei.inhalt),
    });
  }

  const baum = await anfrage<{ sha: string }>({
    zweck: 'beim Speichern',
    weg: '/git/trees',
    methode: 'POST',
    // `base_tree` heißt: Alles andere im Repository bleibt, wie es ist. Ohne diese
    // Angabe bestünde der Commit aus genau diesen Dateien — und der ganze Katalog wäre
    // mit einem Speichervorgang gelöscht.
    koerper: { base_tree: spitze.baum, tree: eintraege },
  });

  // Gleicher Baum heißt: Es hat sich kein Byte geändert. Dann bleibt es beim bisherigen
  // Commit; siehe `unveraendert` bei `Speicherbeleg`.
  if (baum.sha === spitze.baum) {
    return {
      kennung: spitze.commit,
      adresse: commitAdresse(repository, spitze.commit),
      unveraendert: true,
    };
  }

  const commit = await anfrage<{ sha: string }>({
    zweck: 'beim Speichern',
    weg: '/git/commits',
    methode: 'POST',
    koerper: {
      message: meldung,
      tree: baum.sha,
      parents: [spitze.commit],
      // Autor und Committer sind dieselben: In der Historie soll die Bücherei stehen und
      // nicht das Konto, dem das Zugriffstoken gehört (plan.md § 4.2). Sonst sähe die
      // Bestandspflege aus wie die Arbeit eines Entwicklers.
      author: autor,
      committer: autor,
    },
  });

  await anfrage({
    zweck: 'beim Speichern',
    weg: `/git/refs/heads/${encodeURIComponent(zweig)}`,
    methode: 'PATCH',
    // Ohne `force`: Hat sich der Zweig zwischen dem Lesen oben und dieser Zeile bewegt,
    // lehnt GitHub ab, statt die fremde Änderung zu überschreiben. Genau darauf ist der
    // Wiederholungsversuch in `speichereSparten` gebaut.
    koerper: { sha: commit.sha, force: false },
  });

  return {
    kennung: commit.sha,
    adresse: commitAdresse(repository, commit.sha),
    unveraendert: false,
  };
}

/**
 * Schreibt eine oder mehrere Bestandsdateien in **einem** Commit.
 *
 * Alle Dateien oder keine: Der Commit ist die kleinste Einheit, die Git kennt, und
 * deshalb kann ein Titel beim Wechsel der Sparte nicht für einen Augenblick in beiden
 * Dateien stehen — auch dann nicht, wenn währenddessen ein Build losläuft.
 *
 * **Der Wiederholungsversuch** (plan.md § 4.2): Lehnt GitHub die Ref-Aktualisierung ab,
 * hat sich der Zweig zwischenzeitlich bewegt. Dann wird einmal von vorn gelesen und neu
 * versucht. Das ist unbedenklich, weil der zweite Durchgang die Fassungsprüfung noch
 * einmal durchläuft: Betraf die fremde Änderung eine andere Datei, setzt der Commit nun
 * sauber darauf auf; betraf sie dieselbe Datei, bricht die Prüfung ab und die Person
 * bekommt „bitte neu laden“ — statt dass die fremde Änderung überschrieben wird.
 *
 * Bei genau einer pflegenden Person passiert das praktisch nie. „Praktisch nie“ ist aber
 * nicht „nie“, und der Unterschied wäre hier ein verlorener Datensatz.
 */
export async function speichereSparten(
  dateien: readonly ZuSchreibendeDatei[],
  meldung: string,
): Promise<Speicherbeleg> {
  if (dateien.length === 0) {
    throw new AblageFehler('Es wurde keine Datei zum Speichern übergeben.');
  }

  try {
    return await speicherversuch(dateien, meldung);
  } catch (fehler) {
    // 422 ist die Antwort auf eine nicht vorspulbare Ref-Aktualisierung — der einzige
    // Fall, in dem ein zweiter Versuch etwas ändern kann. Alles andere (abgelaufener
    // Token, fehlende Rechte, Störung bei GitHub) scheiterte beim zweiten Mal genauso
    // und verdoppelte nur die Wartezeit.
    if (!(fehler instanceof AblageFehler) || fehler.status !== 422) throw fehler;

    try {
      return await speicherversuch(dateien, meldung);
    } catch (zweiterFehler) {
      // Ist beim zweiten Durchgang die Fassungsprüfung angeschlagen, steht dort schon
      // der genauere Satz — dann diesen und nicht den allgemeinen.
      if (zweiterFehler instanceof AblageFehler && zweiterFehler.neuLadenNoetig) {
        throw zweiterFehler;
      }

      throw new AblageFehler(
        'Am Katalog wurde gerade gleichzeitig etwas anderes geändert, deshalb konnte ' +
          'nicht gespeichert werden. Es ging nichts verloren und es wurde nichts ' +
          'geändert. Bitte die Seite neu laden und die Eingabe noch einmal machen.',
        { neuLadenNoetig: true },
      );
    }
  }
}
