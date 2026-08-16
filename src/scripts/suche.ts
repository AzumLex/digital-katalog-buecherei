/**
 * Die Suche im Browser — das einzige JavaScript im ganzen Katalog.
 *
 * Alles läuft lokal: Der Index wird einmal als Datei geladen, danach geht keine
 * Anfrage mehr hinaus. Kein Suchverlauf, keine Zählpixel, keine fremden Server.
 */
import MiniSearch from 'minisearch';
import {
  ENTPRELLUNG_MS,
  INDEX_VERSION,
  MAX_JE_GRUPPE,
  MIN_ZEICHEN,
  SUCH_OPTIONEN,
  hebeHervor,
  suche,
  vorschlag,
  type Suchdaten,
  type Treffer,
} from '../lib/suchoptionen.ts';
import { titelPfad } from '../lib/pfade.ts';

/** Die im Index mitgespeicherten Felder, so wie sie an einem Treffer hängen. */
interface Trefferdaten extends Treffer {
  sparte: string;
  titel: string;
  untertitel?: string;
  autorAnzeige?: string;
  reihe?: string;
  band?: number;
  figur?: string;
  art?: string;
  laufzeit_min?: number;
  alter_ab?: number;
  verlag?: string;
  ort?: string;
  jahr?: number;
  seiten?: number;
}

const INDEX_URL = '/suchindex.json';

let index: MiniSearch | null = null;
let daten: Suchdaten | null = null;
let ladevorgang: Promise<void> | null = null;
let letzteAnfrage = '';
/** Sparten, die der Nutzer aufgeklappt hat — bleibt über Tastendrücke hinweg erhalten. */
const aufgeklappt = new Set<string>();

/* ------------------------------------------------------------------ *
 * Index laden
 * ------------------------------------------------------------------ */

function ladeIndex(): Promise<void> {
  if (ladevorgang) return ladevorgang;

  ladevorgang = (async () => {
    const antwort = await fetch(INDEX_URL);
    if (!antwort.ok) throw new Error(`Suchindex nicht erreichbar (HTTP ${antwort.status})`);

    const geladen = (await antwort.json()) as Suchdaten;
    if (geladen.version !== INDEX_VERSION) {
      throw new Error(`Suchindex hat Formatstand ${geladen.version}, erwartet ${INDEX_VERSION}`);
    }

    // loadJSAsync statt loadJS: Der Index hat knapp 1000 Dokumente, der Aufbau in
    // Häppchen hält die Seite währenddessen bedienbar.
    index = await MiniSearch.loadJSAsync(geladen.index, SUCH_OPTIONEN);
    daten = geladen;
  })();

  return ladevorgang;
}

/* ------------------------------------------------------------------ *
 * Kleine Helfer
 * ------------------------------------------------------------------ */

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  klasse?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (klasse) el.className = klasse;
  if (text) el.textContent = text;
  return el;
}

/**
 * Setzt Text mit hervorgehobenen Fundstellen — über echte Textknoten und <mark>,
 * nie über innerHTML.
 */
function setzeHervorgehoben(ziel: HTMLElement, text: string, anfrage: string): void {
  for (const stueck of hebeHervor(text, anfrage)) {
    if (stueck.treffer) {
      ziel.appendChild(element('mark', undefined, stueck.text));
    } else {
      ziel.appendChild(document.createTextNode(stueck.text));
    }
  }
}

function laufzeitText(minuten: number): string {
  if (minuten < 60) return `${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `${stunden} Std.` : `${stunden} Std. ${rest} Min.`;
}

function zusatzzeile(t: Trefferdaten): string {
  if (t.sparte === 'tonies' || t.sparte === 'cds') {
    return [t.art, t.laufzeit_min ? laufzeitText(t.laufzeit_min) : '', t.alter_ab ? `ab ${t.alter_ab} Jahren` : '']
      .filter(Boolean)
      .join(' · ');
  }
  return [[t.verlag, t.ort].filter(Boolean).join(', '), t.jahr ? String(t.jahr) : '', t.seiten ? `${t.seiten} S.` : '']
    .filter(Boolean)
    .join(' · ');
}

/* ------------------------------------------------------------------ *
 * Treffer zeichnen
 * ------------------------------------------------------------------ */

function baueTreffer(t: Trefferdaten, anfrage: string): HTMLLIElement {
  const zeile = element('li', 'treffer');
  const link = element('a', 'treffer-link');
  link.href = titelPfad(String(t.id));

  if (t.autorAnzeige) {
    const autor = element('span', 'treffer-autor');
    setzeHervorgehoben(autor, t.autorAnzeige, anfrage);
    link.appendChild(autor);
  }

  const titel = element('span', 'treffer-titel');
  setzeHervorgehoben(titel, t.titel, anfrage);
  link.appendChild(titel);

  if (t.untertitel) {
    const untertitel = element('span', 'treffer-untertitel');
    setzeHervorgehoben(untertitel, t.untertitel, anfrage);
    link.appendChild(untertitel);
  }

  if (t.reihe) {
    const reihe = element('span', 'treffer-reihe');
    setzeHervorgehoben(reihe, t.band ? `${t.reihe} · Band ${t.band}` : t.reihe, anfrage);
    link.appendChild(reihe);
  }

  if (t.figur) {
    const figur = element('span', 'treffer-figur');
    figur.appendChild(element('span', 'treffer-figur-label', 'Figur'));
    const name = element('span');
    setzeHervorgehoben(name, t.figur, anfrage);
    figur.appendChild(name);
    link.appendChild(figur);
  }

  const zusatz = zusatzzeile(t);
  if (zusatz) link.appendChild(element('span', 'treffer-zusatz', zusatz));

  zeile.appendChild(link);
  return zeile;
}

function baueGruppe(
  bezeichnung: string,
  sparte: string,
  treffer: Trefferdaten[],
  anfrage: string,
  neuZeichnen: () => void,
): HTMLElement {
  const gruppe = element('section', 'gruppe');

  const kopf = element('h3', 'gruppe-kopf');
  kopf.appendChild(element('span', 'gruppe-name', bezeichnung));
  kopf.appendChild(element('span', 'gruppe-anzahl', String(treffer.length)));
  gruppe.appendChild(kopf);

  const zeigeAlle = aufgeklappt.has(sparte);
  const sichtbar = zeigeAlle ? treffer : treffer.slice(0, MAX_JE_GRUPPE);

  const liste = element('ul', 'trefferliste');
  for (const t of sichtbar) liste.appendChild(baueTreffer(t, anfrage));
  gruppe.appendChild(liste);

  if (treffer.length > sichtbar.length) {
    const rest = treffer.length - sichtbar.length;
    const knopf = element('button', 'mehr', `weitere ${rest} anzeigen`);
    knopf.type = 'button';
    knopf.addEventListener('click', () => {
      aufgeklappt.add(sparte);
      neuZeichnen();
    });
    gruppe.appendChild(knopf);
  }

  return gruppe;
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

export function starteSuche(): void {
  const feld = document.querySelector<HTMLInputElement>('#suchfeld');
  const status = document.querySelector<HTMLElement>('#suche-status');
  const ausgabe = document.querySelector<HTMLElement>('#suchergebnis');
  const stoebern = document.querySelector<HTMLElement>('#stoebern');
  if (!feld || !status || !ausgabe) return;

  // Ohne JavaScript bliebe das Feld gesperrt; jetzt ist es benutzbar.
  feld.disabled = false;
  feld.setAttribute('aria-keyshortcuts', '/');

  const setzeStatus = (text: string): void => {
    status.textContent = text;
  };

  setzeStatus('Taste / springt ins Suchfeld. Die Suche läuft im Browser, es wird nichts übertragen.');

  /* ---- Zeichnen ---- */

  function leereAusgabe(): void {
    ausgabe!.replaceChildren();
    ausgabe!.hidden = true;
    if (stoebern) stoebern.hidden = false;
  }

  function zeichne(anfrage: string): void {
    if (!index || !daten) return;

    const treffer = suche(index, anfrage) as Trefferdaten[];
    ausgabe!.replaceChildren();
    ausgabe!.hidden = false;
    if (stoebern) stoebern.hidden = true;

    const kopf = element('h2', 'ergebnis-kopf');
    kopf.appendChild(
      document.createTextNode(
        treffer.length === 1 ? '1 Treffer für ' : `${treffer.length.toLocaleString('de-AT')} Treffer für `,
      ),
    );
    kopf.appendChild(element('span', 'ergebnis-anfrage', `„${anfrage}“`));
    ausgabe!.appendChild(kopf);

    if (treffer.length === 0) {
      ausgabe!.appendChild(baueKeineTreffer(anfrage));
      setzeStatus(`Keine Treffer für „${anfrage}“.`);
      return;
    }

    const nachSparte = new Map<string, Trefferdaten[]>();
    for (const t of treffer) {
      const liste = nachSparte.get(t.sparte);
      if (liste) liste.push(t);
      else nachSparte.set(t.sparte, [t]);
    }

    // Reihenfolge des Katalogs, nicht Reihenfolge des Zufalls.
    for (const { sparte, bezeichnung } of daten.sparten) {
      const gruppe = nachSparte.get(sparte);
      if (!gruppe || gruppe.length === 0) continue;
      ausgabe!.appendChild(baueGruppe(bezeichnung, sparte, gruppe, anfrage, () => zeichne(anfrage)));
    }

    setzeStatus(`${treffer.length} Treffer. Mit den Pfeiltasten durchgehen, Enter öffnet.`);
  }

  function baueKeineTreffer(anfrage: string): HTMLElement {
    const block = element('div', 'keine-treffer');

    const begriffe = index ? vorschlag(index, anfrage) : [];
    const lesbar = [...new Set(begriffe.map((b) => daten?.begriffe[b] ?? b))];

    if (lesbar.length > 0) {
      const zeile = element('p', 'meinten-sie');
      zeile.appendChild(document.createTextNode('Meinten Sie '));
      const knopf = element('button', 'vorschlag', lesbar.join(' '));
      knopf.type = 'button';
      knopf.addEventListener('click', () => {
        feld!.value = lesbar.join(' ');
        feld!.focus();
        fuehreAus(feld!.value);
      });
      zeile.appendChild(knopf);
      zeile.appendChild(document.createTextNode('?'));
      block.appendChild(zeile);
    }

    block.appendChild(
      element(
        'p',
        'fernleihe',
        'Nicht im Bestand? An der Ausleihe können Sie nach einer Fernleihe fragen — ' +
          'Titel aus anderen Büchereien lassen sich oft besorgen.',
      ),
    );

    return block;
  }

  /* ---- Ausführen ---- */

  async function fuehreAus(rohtext: string): Promise<void> {
    const anfrage = rohtext.trim();
    letzteAnfrage = anfrage;
    aktualisiereAdresse(anfrage);

    if (anfrage.length < MIN_ZEICHEN) {
      leereAusgabe();
      setzeStatus(
        anfrage.length === 0
          ? 'Taste / springt ins Suchfeld. Die Suche läuft im Browser, es wird nichts übertragen.'
          : `Noch mindestens ${MIN_ZEICHEN - anfrage.length} Zeichen …`,
      );
      return;
    }

    if (!index) {
      setzeStatus('Suchindex wird geladen …');
      try {
        await ladeIndex();
      } catch (fehler) {
        setzeStatus('Der Suchindex konnte nicht geladen werden. Bitte die Seite neu laden.');
        console.error(fehler);
        return;
      }
      // Während des Ladens kann sich die Eingabe geändert haben.
      if (letzteAnfrage !== anfrage) return;
    }

    aufgeklappt.clear();
    zeichne(anfrage);
  }

  /* ---- Adresszeile ---- */

  function aktualisiereAdresse(anfrage: string): void {
    const adresse = new URL(window.location.href);
    if (anfrage) adresse.searchParams.set('q', anfrage);
    else adresse.searchParams.delete('q');

    // replaceState statt pushState: Sonst läge nach „krimi" für jeden einzelnen
    // Tastendruck ein Eintrag im Verlauf und der Zurück-Knopf wäre unbrauchbar.
    // So führt Zurück von einer Detailseite wieder auf genau diese Trefferliste.
    window.history.replaceState(null, '', adresse.toString());
  }

  /* ---- Ereignisse ---- */

  let zeitgeber: number | undefined;
  feld.addEventListener('input', () => {
    window.clearTimeout(zeitgeber);
    zeitgeber = window.setTimeout(() => void fuehreAus(feld.value), ENTPRELLUNG_MS);
  });

  // Den Index schon beim ersten Kontakt mit dem Feld holen, damit er bereitliegt,
  // wenn das zweite Zeichen getippt ist. Wer nur die Sparten durchblättert, lädt ihn nie.
  for (const ereignis of ['focus', 'pointerenter'] as const) {
    feld.addEventListener(ereignis, () => void ladeIndex().catch(() => {}), { once: true });
  }

  /* ---- Tastatur ---- */

  function trefferLinks(): HTMLAnchorElement[] {
    return [...ausgabe!.querySelectorAll<HTMLAnchorElement>('a.treffer-link')];
  }

  function bewege(richtung: 1 | -1): void {
    const links = trefferLinks();
    if (links.length === 0) return;

    const aktuell = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (aktuell === -1) {
      (richtung === 1 ? links[0] : links[links.length - 1])!.focus();
      return;
    }

    const naechster = aktuell + richtung;
    if (naechster < 0) feld!.focus();
    else if (naechster < links.length) links[naechster]!.focus();
  }

  feld.addEventListener('keydown', (ereignis) => {
    if (ereignis.key === 'ArrowDown') {
      ereignis.preventDefault();
      bewege(1);
    } else if (ereignis.key === 'Escape') {
      ereignis.preventDefault();
      feld.value = '';
      void fuehreAus('');
    } else if (ereignis.key === 'Enter') {
      ereignis.preventDefault();
      trefferLinks()[0]?.click();
    }
  });

  ausgabe.addEventListener('keydown', (ereignis) => {
    const taste = (ereignis as KeyboardEvent).key;
    if (taste === 'ArrowDown') {
      ereignis.preventDefault();
      bewege(1);
    } else if (taste === 'ArrowUp') {
      ereignis.preventDefault();
      bewege(-1);
    } else if (taste === 'Escape') {
      ereignis.preventDefault();
      feld.value = '';
      feld.focus();
      void fuehreAus('');
    }
  });

  // „/" springt ins Suchfeld — außer man tippt gerade irgendwo anders.
  document.addEventListener('keydown', (ereignis) => {
    if (ereignis.key !== '/' || ereignis.ctrlKey || ereignis.metaKey || ereignis.altKey) return;

    const ziel = ereignis.target as HTMLElement | null;
    const tippt =
      ziel instanceof HTMLInputElement ||
      ziel instanceof HTMLTextAreaElement ||
      ziel instanceof HTMLSelectElement ||
      ziel?.isContentEditable === true;
    if (tippt) return;

    ereignis.preventDefault();
    feld.focus();
    feld.select();
  });

  /* ---- Adresszeile beim Laden und beim Zurückspringen ---- */

  function ausAdresseLesen(): void {
    const q = new URL(window.location.href).searchParams.get('q') ?? '';
    if (q === feld!.value && q !== '') return;
    feld!.value = q;
    void fuehreAus(q);
  }

  window.addEventListener('popstate', ausAdresseLesen);

  const start = new URL(window.location.href).searchParams.get('q');
  if (start) {
    feld.value = start;
    void fuehreAus(start);
  }
}
