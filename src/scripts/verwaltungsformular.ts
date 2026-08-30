/**
 * Das Formular im Browser: Felder ein- und ausblenden, speichern, löschen.
 *
 * Welche Felder es gibt und welches wozu passt, steht in `src/lib/formular.ts` — demselben
 * Modul, aus dem der Server das Formular gebaut hat. Deshalb kann hier keine zweite
 * Vorstellung davon entstehen, was ein „passendes Feld“ ist: Beide Seiten fragen dieselbe
 * Funktion.
 *
 * **Kein Geheimnis kommt hier vorbei.** Dieses Skript kennt Feldnamen und Adressen, sonst
 * nichts. Angemeldet ist der Browser über das Sitzungscookie, und ob die Anmeldung noch
 * gilt, entscheidet der Schutzwall auf dem Server bei jeder einzelnen Anfrage.
 */
import { FELDER, ausFormularwerten, passt, zuFormularwert } from '../lib/formular.ts';
import { kennungsvorschlag } from '../lib/kennung.ts';
import { fehlerzeilen, merkeMeldung, zeigeGemerkteMeldung, zeigeMeldung } from './meldung.ts';

type Eingabe = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Was die Schnittstelle nach einer erfolgreichen Änderung zurückgibt. */
interface Pflegeergebnis {
  id: string;
  titel: string;
  meldung: string;
}

export function starteFormular(): void {
  const formular = document.querySelector<HTMLFormElement>('#medienformular');
  if (!formular) return;

  const balken = document.querySelector<HTMLElement>('#meldung');
  const knopf = formular.querySelector<HTMLButtonElement>('button[type="submit"]');
  const alleFelder = formular.querySelector<HTMLInputElement>('#alle-felder');

  const modus = formular.dataset.modus === 'bearbeiten' ? 'bearbeiten' : 'neu';
  const kennung = formular.dataset.id ?? '';
  const fassung = formular.dataset.fassung ?? '';
  const herkunftssparte = formular.dataset.sparte ?? '';

  /* -------------------------------------------------- *
   * Felder lesen und ein- und ausblenden
   * -------------------------------------------------- */

  const eingabe = (name: string): Eingabe | null =>
    formular.querySelector<Eingabe>(`[name="${name}"]`);

  const huelle = (name: string): HTMLElement | null =>
    formular.querySelector<HTMLElement>(`.feld[data-feld="${name}"]`);

  const wertVon = (name: string): string => eingabe(name)?.value.trim() ?? '';

  /**
   * Blendet Felder ein und aus, die zur gewählten Sparte oder Medienform nicht passen.
   *
   * Drei Gründe, ein Feld stehen zu lassen: Es passt, es ist schon ausgefüllt, oder das
   * Häkchen „alle Felder“ ist gesetzt. Der zweite ist der wichtigste — was ausgeblendet
   * ist, wird nicht mitgeschickt, und ein ausgeblendetes Feld mit Inhalt hieße: Die
   * Angabe verschwindet beim nächsten Speichern, ohne dass jemand es gesehen hat.
   */
  function aktualisiereSichtbarkeit(): void {
    const sparte = wertVon('sparte');
    const medium = wertVon('medium');
    const alles = alleFelder?.checked ?? false;

    for (const feld of FELDER) {
      const bereich = huelle(feld.name);
      if (!bereich) continue;

      bereich.hidden = !(alles || wertVon(feld.name) !== '' || passt(feld, sparte, medium));
    }
  }

  eingabe('sparte')?.addEventListener('change', aktualisiereSichtbarkeit);
  eingabe('medium')?.addEventListener('change', aktualisiereSichtbarkeit);
  alleFelder?.addEventListener('change', aktualisiereSichtbarkeit);

  /* -------------------------------------------------- *
   * Speichern
   * -------------------------------------------------- */

  /** Die mitgeführten Felder: `_quelle`, `_pruefen`, `cover_url` — unverändert zurück. */
  function mitgefuehrt(): Record<string, unknown> {
    const block = document.querySelector('#mitgefuehrt');
    if (!block?.textContent) return {};

    try {
      return JSON.parse(block.textContent) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /** Die Eingaben — ohne die ausgeblendeten Felder. */
  function werte(): Record<string, string> {
    const gesammelt: Record<string, string> = {};

    for (const feld of FELDER) {
      if (huelle(feld.name)?.hidden !== false) continue;
      gesammelt[feld.name] = wertVon(feld.name);
    }

    return gesammelt;
  }

  /**
   * Schickt eine Anfrage und beantwortet sie einheitlich.
   *
   * Bei Erfolg wird der Satz der Schnittstelle gemerkt und die Seite gewechselt: Nach dem
   * Speichern ist die Fassungskennung im Formular veraltet, und ein zweiter Klick liefe
   * sonst in ein „Bitte neu laden“, obwohl niemand etwas falsch gemacht hat.
   */
  async function sende(adresse: string, angaben: RequestInit, weiter: (id: string) => string) {
    if (knopf) {
      knopf.disabled = true;
      knopf.textContent = 'Wird gespeichert …';
    }

    try {
      const antwort = await fetch(adresse, {
        ...angaben,
        headers: { 'content-type': 'application/json', ...(angaben.headers ?? {}) },
      });
      const daten: unknown = await antwort.json().catch(() => null);

      if (!antwort.ok) {
        if (balken) zeigeMeldung(balken, fehlerzeilen(daten), 'schlecht');
        return;
      }

      const ergebnis = daten as Pflegeergebnis;
      merkeMeldung(ergebnis.meldung);
      window.location.href = weiter(ergebnis.id);
    } catch {
      // Kein Netz, abgebrochene Verbindung, Zeitgrenze der Plattform: Der Browser weiß
      // nicht, ob die Änderung angekommen ist. Genau das muss dastehen — „Fehler beim
      // Speichern“ wäre eine Behauptung, die niemand geprüft hat.
      if (balken) {
        zeigeMeldung(
          balken,
          [
            'Die Verbindung ist abgebrochen. Ob die Änderung noch angekommen ist, lässt ' +
              'sich von hier aus nicht sagen — bitte die Bestandsliste neu laden und ' +
              'nachsehen, bevor Sie es noch einmal versuchen.',
          ],
          'schlecht',
        );
      }
    } finally {
      if (knopf) {
        knopf.disabled = false;
        knopf.textContent = 'Speichern';
      }
    }
  }

  formular.addEventListener('submit', (ereignis) => {
    ereignis.preventDefault();

    const medium = ausFormularwerten(werte(), mitgefuehrt());

    if (modus === 'neu') {
      void sende(
        '/api/medien/',
        { method: 'POST', body: JSON.stringify({ medium }) },
        (id) => `/verwaltung/bearbeiten/${encodeURIComponent(id)}/`,
      );
      return;
    }

    void sende(
      `/api/medien/${encodeURIComponent(kennung)}/`,
      {
        method: 'PUT',
        body: JSON.stringify({ medium, fassung, sparte: herkunftssparte }),
      },
      // Nach dem Ändern zurück auf dieselbe Seite: Sie liest den Eintrag neu ein und hat
      // damit wieder eine gültige Fassungskennung. Die Sparte kann sich geändert haben,
      // deshalb kommt der Hinweis nicht mit — die Seite findet den Eintrag notfalls über
      // alle Sparten.
      (id) => `/verwaltung/bearbeiten/${encodeURIComponent(id)}/`,
    );
  });

  /* -------------------------------------------------- *
   * Ist diese Kennung noch frei?
   * -------------------------------------------------- */

  /**
   * Der Hinweis unter dem Kennungsfeld — wird angelegt, wenn er gebraucht wird.
   *
   * Als eigenes Element und nicht im Meldungsbalken oben: Der Hinweis gehört zu diesem
   * einen Feld und soll verschwinden, sobald es geändert wird. Erzeugt wird er hier und
   * nicht im HTML, weil er nur auf einer der beiden Seiten und nur manchmal vorkommt —
   * ein leerer Absatz im Formular wäre ein Sonderfall für ein einziges Feld.
   */
  function zeigeKennungshinweis(text: string): void {
    const bereich = huelle('id');
    if (!bereich) return;

    let hinweis = bereich.querySelector<HTMLElement>('.kennungshinweis');

    if (!text) {
      hinweis?.remove();
      return;
    }

    if (!hinweis) {
      hinweis = document.createElement('p');
      hinweis.className = 'kennungshinweis';
      hinweis.setAttribute('role', 'status');
      bereich.append(hinweis);
    }

    hinweis.textContent = text;
  }

  /**
   * Sieht nach, ob es die eingetippte Kennung schon gibt.
   *
   * Ein **Hinweis**, keine Prüfung: Die Prüfung macht `pruefeIdFrei` beim Speichern, und
   * nur die zählt. Hier geht es darum, den Fall früh zu zeigen — bevor jemand zwanzig
   * Felder ausfüllt, die er anschließend noch einmal eintippen müsste. Geht die Anfrage
   * schief, bleibt es deshalb still: Ein Fehler über eine misslungene Vorschau wäre eine
   * Meldung über nichts.
   */
  async function pruefeKennung(): Promise<void> {
    zeigeKennungshinweis('');

    const id = wertVon('id');
    if (!id) return;

    try {
      const adresse = new URL('/api/medien/', window.location.origin);
      adresse.searchParams.set('id', id);
      // Die gewählte Sparte als Abkürzung: Damit liest die Gegenstelle eine Datei statt
      // sieben. Liegt der Eintrag in einer anderen, findet sie ihn trotzdem.
      if (wertVon('sparte')) adresse.searchParams.set('sparte', wertVon('sparte'));

      const antwort = await fetch(adresse);
      if (!antwort.ok) return;

      const daten = (await antwort.json()) as {
        gefunden: boolean;
        medium?: { titel: string };
      };

      if (daten.gefunden && daten.medium) {
        zeigeKennungshinweis(
          `Diese Kennung ist schon vergeben: „${daten.medium.titel}“. Ist es dasselbe ` +
            'Buch? Dann bitte keinen zweiten Eintrag anlegen, sondern beim vorhandenen ' +
            '„Exemplare“ erhöhen. Ist es ein anderes, wählen Sie eine andere Kennung — ' +
            'zum Beispiel dieselbe mit „-2“ am Ende.',
        );
      }
    } catch {
      // Kein Netz: Der Hinweis entfällt, gespeichert wird trotzdem geprüft.
    }
  }

  // Nur beim Anlegen. Beim Bearbeiten ist das Feld gesperrt, und der Eintrag fände sich
  // dort selbst — genau der Fall, vor dem `pruefeIdFrei` in `pruefung.ts` warnt.
  if (modus === 'neu') {
    eingabe('id')?.addEventListener('change', () => {
      void pruefeKennung();
    });
  }

  /* -------------------------------------------------- *
   * Löschen
   * -------------------------------------------------- */

  const loeschknopf = document.querySelector<HTMLButtonElement>('#loeschen');

  loeschknopf?.addEventListener('click', () => {
    const titel = wertVon('titel') || kennung;

    // Eine Rückfrage, obwohl der Papierkorb den Klick ohnehin auffängt: Ein Klick, der
    // einen Titel aus dem Katalog nimmt, soll nicht aus Versehen passieren.
    const sicher = window.confirm(
      `„${titel}“ in den Papierkorb legen?\n\n` +
        'Der Eintrag verschwindet aus dem Katalog und lässt sich im Papierkorb jederzeit ' +
        'zurückholen.\n\nWenn das Buch nur aussortiert wurde, brechen Sie bitte ab und ' +
        'setzen stattdessen den Status auf „ausgeschieden“ — dann bleibt es im Katalog ' +
        'sichtbar.',
    );
    if (!sicher) return;

    const adresse = new URL(
      `/api/medien/${encodeURIComponent(kennung)}/`,
      window.location.origin,
    );
    if (fassung) adresse.searchParams.set('fassung', fassung);
    if (herkunftssparte) adresse.searchParams.set('sparte', herkunftssparte);

    void sende(
      `${adresse.pathname}${adresse.search}`,
      { method: 'DELETE' },
      () => '/verwaltung/bestand/',
    );
  });

  /* -------------------------------------------------- *
   * Die Kennung vorschlagen
   * -------------------------------------------------- */

  /**
   * Füllt das Kennungsfeld, solange es leer ist.
   *
   * Vorgeschlagen wird mit **derselben** Funktion, die auch die Serverroute benutzt
   * (`kennungsvorschlag` aus `kennung.ts`) — die Regel steht dort und nirgends sonst. Was
   * der Browser nicht wissen kann, ist die Liste der schon vergebenen Kennungen; dafür
   * läuft anschließend `pruefeKennung()`, das genau danach fragt.
   *
   * Nur solange das Feld leer ist: Wer selbst etwas einträgt, soll es nicht beim nächsten
   * Tastendruck im Titel überschrieben bekommen.
   */
  function schlageKennungVor(): void {
    const feld = eingabe('id');
    if (!feld || feld.value.trim() !== '') return;

    // Ohne Titel käme nur das Sparten-Kürzel heraus — das ist keine Kennung, sondern der
    // Anfang einer.
    if (!wertVon('titel')) return;

    feld.value = kennungsvorschlag({
      sparte: wertVon('sparte') as never,
      titel: wertVon('titel'),
      autor_nachname: wertVon('autor_nachname'),
      reihe: wertVon('reihe'),
      isbn: wertVon('isbn'),
    });

    void pruefeKennung();
  }

  if (modus === 'neu') {
    for (const name of ['sparte', 'titel', 'autor_nachname', 'reihe']) {
      eingabe(name)?.addEventListener('change', schlageKennungVor);
    }
  }

  /* -------------------------------------------------- *
   * Der ISBN-Abruf — nur auf „Neuer Titel“ vorhanden
   * -------------------------------------------------- */

  const isbnFeld = document.querySelector<HTMLInputElement>('#isbn-abruf');
  const holknopf = document.querySelector<HTMLButtonElement>('#daten-holen');
  const isbnHinweis = document.querySelector<HTMLElement>('#isbn-hinweis');

  /** Schreibt in den Hinweis unter dem ISBN-Feld; `knoten` hängt einen Verweis daran. */
  function zeigeIsbnHinweis(satz: string, art: 'gut' | 'schlecht', knoten?: Node): void {
    if (!isbnHinweis) return;

    isbnHinweis.textContent = satz;
    isbnHinweis.classList.toggle('schlecht', art === 'schlecht');
    if (knoten) isbnHinweis.append(' ', knoten);
  }

  /**
   * Trägt geholte Angaben in das Formular ein — **nur in leere Felder**.
   *
   * Was jemand schon eingetippt hat, bleibt stehen: Der Abruf ist ein Vorschlag, und ein
   * Vorschlag überschreibt keine Arbeit. Wer die geholte Fassung doch will, leert das Feld
   * und holt noch einmal. Gezählt wird mit, damit die Meldung sagen kann, was geschehen
   * ist — ein Abruf, der sichtbar nichts tut, sieht aus wie ein Fehler.
   */
  function fuelleFormular(angaben: Record<string, unknown>): number {
    let gefuellt = 0;

    for (const feld of FELDER) {
      const wert = zuFormularwert(angaben[feld.name]);
      if (wert === '') continue;

      const ziel = eingabe(feld.name);
      if (!ziel || ziel.value.trim() !== '') continue;

      ziel.value = wert;
      gefuellt++;
    }

    // Ein gefülltes Feld darf nicht ausgeblendet bleiben — sonst ginge die Angabe beim
    // Speichern wieder verloren. Genau darauf sieht `aktualisiereSichtbarkeit`.
    aktualisiereSichtbarkeit();
    schlageKennungVor();

    return gefuellt;
  }

  /**
   * Fragt `/api/isbn/` und macht aus der Antwort einen Satz und ein gefülltes Formular.
   *
   * **Die Prüfziffer rechnet der Server**, obwohl `isbn.ts` auch hier zur Verfügung stünde.
   * Der Grund ist nicht Bequemlichkeit: Die Route muss ohnehin prüfen — sie ist von außen
   * erreichbar —, und zwei Stellen mit demselben Urteil bräuchten zwei Formulierungen für
   * dieselbe Auskunft. Eine Anfrage, die mit „die Prüfziffer stimmt nicht“ zurückkommt,
   * kostet dabei fast nichts: Die Route liest dafür weder den Bestand, noch fragt sie einen
   * Dienst.
   */
  async function holeIsbnAngaben(): Promise<void> {
    if (!isbnFeld || !holknopf) return;

    const eingetippt = isbnFeld.value.trim();
    if (eingetippt === '') {
      zeigeIsbnHinweis('Bitte zuerst die ISBN eintippen.', 'schlecht');
      isbnFeld.focus();
      return;
    }

    holknopf.disabled = true;
    holknopf.textContent = 'Wird geholt …';
    zeigeIsbnHinweis('', 'gut');

    try {
      const adresse = new URL(
        `/api/isbn/${encodeURIComponent(eingetippt)}/`,
        window.location.origin,
      );
      // Die gewählte Sparte entscheidet über das Kürzel am Anfang der Kennung.
      if (wertVon('sparte')) adresse.searchParams.set('sparte', wertVon('sparte'));

      const antwort = await fetch(adresse);
      const daten = (await antwort.json().catch(() => null)) as {
        meldung?: string;
        medium?: Record<string, unknown>;
        kennung?: string;
        imBestand?: { id: string; titel: string };
      } | null;

      if (!antwort.ok) {
        zeigeIsbnHinweis(fehlerzeilen(daten).join(' '), 'schlecht');
        return;
      }

      // Steht der Titel schon im Katalog, führt der Weg dorthin und nicht ins Formular.
      if (daten?.imBestand) {
        const verweis = document.createElement('a');
        verweis.href = `/verwaltung/bearbeiten/${encodeURIComponent(daten.imBestand.id)}/`;
        verweis.textContent = 'Vorhandenen Eintrag öffnen';
        zeigeIsbnHinweis(daten.meldung ?? '', 'schlecht', verweis);
        return;
      }

      if (!daten?.medium) {
        zeigeIsbnHinweis(daten?.meldung ?? '', 'schlecht');
        return;
      }

      const gefuellt = fuelleFormular(daten.medium);

      // Die Kennung kommt von der Route und nicht aus `schlageKennungVor`: Nur sie kennt
      // die vergebenen Kennungen und kann bei einer Kollision `-2` anhängen.
      const kennungsfeld = eingabe('id');
      if (daten.kennung && kennungsfeld && kennungsfeld.value.trim() === '') {
        kennungsfeld.value = daten.kennung;
        void pruefeKennung();
      }

      zeigeIsbnHinweis(
        `${daten.meldung ?? ''} ${
          gefuellt === 0
            ? 'Ausgefüllt wurde nichts — die Felder waren schon belegt.'
            : `Ausgefüllt wurden ${gefuellt} leere Felder.`
        }`,
        'gut',
      );
    } catch {
      zeigeIsbnHinweis(
        'Die Verbindung ist abgebrochen — bitte noch einmal versuchen. Die Angaben lassen ' +
          'sich auch von Hand eintragen.',
        'schlecht',
      );
    } finally {
      holknopf.disabled = false;
      holknopf.textContent = 'Daten holen';
    }
  }

  holknopf?.addEventListener('click', () => {
    void holeIsbnAngaben();
  });

  // Die Eingabetaste im ISBN-Feld tut, was jeder erwartet. Das Feld steht außerhalb des
  // Formulars — ohne diese Zeile passierte gar nichts, und das sieht aus wie ein Hänger.
  isbnFeld?.addEventListener('keydown', (ereignis) => {
    if (ereignis.key !== 'Enter') return;
    ereignis.preventDefault();
    void holeIsbnAngaben();
  });

  /* -------------------------------------------------- *
   * Beim Laden
   * -------------------------------------------------- */

  zeigeGemerkteMeldung(balken);
  aktualisiereSichtbarkeit();
}
