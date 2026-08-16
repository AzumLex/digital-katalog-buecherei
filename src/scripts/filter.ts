/**
 * Filter für die Sparten-Listen.
 *
 * Die ungefilterte Liste steht fertig im HTML und braucht dieses Skript nicht.
 * Sobald ein Filter greift, übernimmt der Browser: Er holt einmal
 * `/liste/<sparte>.json` und filtert, sortiert und blättert von da an lokal. Pro
 * Filterklick wird nichts nachgeladen.
 *
 * Sortiert wird mit demselben Modul wie im Build (`sortierung.ts`), und die Zeilen
 * bauen auf denselben Feldern auf (`zeile.ts`) — die gefilterte Liste kann also nicht
 * anders aussehen oder anders geordnet sein als die statische.
 */
import {
  WERTE_SICHTBAR,
  anzahlAktiv,
  ausParametern,
  filtere,
  istLeer,
  leereAuswahl,
  zaehle,
  zuParametern,
  type Auswahl,
  type Facette,
  type Listeneintrag,
} from '../lib/facetten.ts';
import { falteGrundform } from '../lib/suchoptionen.ts';
import { PRO_SEITE, seiteVon, sortiere, type Sortierung } from '../lib/sortierung.ts';
import { spartenPfad, titelPfad, autorAnker } from '../lib/pfade.ts';
import { zeilenfelder } from '../lib/zeile.ts';

interface Listendaten {
  version: number;
  sparte: string;
  bezeichnung: string;
  eintraege: Listeneintrag[];
  facetten: Facette[];
}

const LISTE_VERSION = 1;
const ENTPRELLUNG_MS = 150;

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
  if (text !== undefined) el.textContent = text;
  return el;
}

const zahlFormat = new Intl.NumberFormat('de-AT');

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

export function starteFilter(): void {
  const wurzel = document.querySelector<HTMLElement>('#katalogansicht');
  const panel = document.querySelector<HTMLDetailsElement>('#filterpanel');
  const koerper = document.querySelector<HTMLElement>('#filter-koerper');
  const liste = document.querySelector<HTMLUListElement>('#katalogliste');
  const bilanz = document.querySelector<HTMLElement>('#bilanz');
  const blaetterhalter = document.querySelector<HTMLElement>('#blaetterung');
  const marken = document.querySelector<HTMLElement>('#filter-aktiv');
  const zahlAbzeichen = document.querySelector<HTMLElement>('#filter-zahl');

  if (!wurzel || !panel || !koerper || !liste || !bilanz || !marken) return;

  const sparte = wurzel.dataset.sparte ?? '';
  const sortierung = (wurzel.dataset.sortierung ?? 'autor') as Sortierung;

  let daten: Listendaten | null = null;
  let ladevorgang: Promise<void> | null = null;
  let auswahl: Auswahl = leereAuswahl();
  let seite = 1;
  let aktiv = false;
  let panelGebaut = false;
  /** Facetten, deren Werteliste der Nutzer aufgeklappt hat. */
  const aufgeklappt = new Set<string>();
  /** Suchtext innerhalb einer Facettenliste (z. B. im Autorenfilter). */
  const facettensuche = new Map<string, string>();

  /* ---- Daten ---- */

  function ladeDaten(): Promise<void> {
    ladevorgang ??= (async () => {
      const antwort = await fetch(`/liste/${sparte}.json`);
      if (!antwort.ok) throw new Error(`Sparten-Daten nicht erreichbar (HTTP ${antwort.status})`);
      const geladen = (await antwort.json()) as Listendaten;
      if (geladen.version !== LISTE_VERSION) {
        throw new Error(`Sparten-Daten haben Formatstand ${geladen.version}, erwartet ${LISTE_VERSION}`);
      }
      daten = geladen;
    })();
    return ladevorgang;
  }

  /* ---- Adresszeile ---- */

  function baueAdresse(): string {
    const parameter = daten ? zuParametern(auswahl, daten.facetten) : new URLSearchParams();
    if (seite > 1) parameter.set('seite', String(seite));
    const abfrage = parameter.toString();
    // Immer auf Seite 1 der Sortierung zeigen: Seite 7 der ungefilterten Liste gibt
    // es nach dem Filtern nicht mehr, die Blätterung übernimmt der Parameter.
    return spartenPfad(sparte as never, sortierung) + (abfrage ? `?${abfrage}` : '');
  }

  function schreibeAdresse(neuerEintrag: boolean): void {
    const ziel = baueAdresse();
    if (ziel === window.location.pathname + window.location.search) return;
    if (neuerEintrag) window.history.pushState(null, '', ziel);
    else window.history.replaceState(null, '', ziel);
  }

  function leseAdresse(): void {
    if (!daten) return;
    const parameter = new URL(window.location.href).searchParams;
    auswahl = ausParametern(parameter, daten.facetten);
    const gelesen = Number(parameter.get('seite'));
    seite = Number.isFinite(gelesen) && gelesen > 0 ? gelesen : 1;
  }

  /* ---- Sortierlinks mitziehen ---- */

  function aktualisiereSortierlinks(): void {
    const parameter = daten ? zuParametern(auswahl, daten.facetten) : new URLSearchParams();
    const abfrage = parameter.toString();

    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[data-sortierung]')) {
      const ziel = link.dataset.sortierung as Sortierung;
      link.href = spartenPfad(sparte as never, ziel) + (abfrage ? `?${abfrage}` : '');
    }
  }

  /* ---- Liste zeichnen ---- */

  function baueZeile(eintrag: Listeneintrag, anker?: string): HTMLLIElement {
    const felder = zeilenfelder(eintrag);
    const zeile = element('li', 'eintrag');
    if (anker) zeile.id = anker;

    if (felder.autor) zeile.appendChild(element('p', 'autor', felder.autor));

    const titel = element('h3', 'titel');
    const link = element('a', undefined, felder.titel);
    link.href = titelPfad(eintrag.id);
    titel.appendChild(link);
    zeile.appendChild(titel);

    if (felder.untertitel) zeile.appendChild(element('p', 'untertitel', felder.untertitel));
    if (felder.reihe) zeile.appendChild(element('p', 'reihe', felder.reihe));

    if (felder.figur) {
      const figur = element('p', 'figur');
      figur.appendChild(element('span', 'figur-label', 'Figur'));
      figur.appendChild(document.createTextNode(felder.figur));
      zeile.appendChild(figur);
    }

    if (felder.zusatz) zeile.appendChild(element('p', 'zusatz', felder.zusatz));
    return zeile;
  }

  function zeichneBlaetterung(anzahlSeiten: number): void {
    if (!blaetterhalter) return;
    blaetterhalter.replaceChildren();
    if (anzahlSeiten <= 1) return;

    const nav = element('nav', 'blaetterung');
    nav.setAttribute('aria-label', 'Seiten');

    const knopf = (beschriftung: string, ziel: number, gesperrt: boolean, klasse: string) => {
      const b = element('button', klasse + (gesperrt ? ' gesperrt' : ''), beschriftung);
      b.type = 'button';
      if (gesperrt) b.disabled = true;
      else
        b.addEventListener('click', () => {
          seite = ziel;
          zeichne(true);
          wurzel!.scrollIntoView({ behavior: 'auto', block: 'start' });
        });
      return b;
    };

    nav.appendChild(knopf('← Zurück', seite - 1, seite <= 1, 'pfeil'));

    const zeigen = new Set([1, anzahlSeiten, seite - 1, seite, seite + 1]);
    const nummern = [...zeigen].filter((n) => n >= 1 && n <= anzahlSeiten).sort((a, b) => a - b);

    const leiste = element('ol', 'nummern');
    let vorher = 0;
    for (const n of nummern) {
      if (vorher && n - vorher > 1) {
        const luecke = element('li', 'luecke', '…');
        luecke.setAttribute('aria-hidden', 'true');
        leiste.appendChild(luecke);
      }
      const li = element('li');
      const b = knopf(String(n), n, false, 'nummer' + (n === seite ? ' aktiv' : ''));
      if (n === seite) b.setAttribute('aria-current', 'page');
      li.appendChild(b);
      leiste.appendChild(li);
      vorher = n;
    }
    nav.appendChild(leiste);
    nav.appendChild(knopf('Weiter →', seite + 1, seite >= anzahlSeiten, 'pfeil'));

    blaetterhalter.appendChild(nav);
  }

  function zeichneMarken(): void {
    marken!.replaceChildren();
    if (!daten || istLeer(auswahl)) {
      marken!.hidden = true;
      if (zahlAbzeichen) zahlAbzeichen.hidden = true;
      return;
    }

    marken!.hidden = false;

    const entferne = (tun: () => void) => () => {
      tun();
      seite = 1;
      zeichne(true);
      aktualisierePanel();
    };

    if (auswahl.text.trim()) {
      const marke = element('button', 'filter-marke');
      marke.type = 'button';
      marke.appendChild(document.createTextNode(`Suche: „${auswahl.text.trim()}"`));
      marke.appendChild(element('span', 'weg', '×'));
      marke.addEventListener('click', entferne(() => (auswahl.text = '')));
      marken!.appendChild(marke);
    }

    for (const facette of daten.facetten) {
      if (facette.art === 'bereich') {
        const bereich = auswahl.bereiche[facette.schluessel];
        if (!bereich || (bereich.von === undefined && bereich.bis === undefined)) continue;
        const marke = element('button', 'filter-marke');
        marke.type = 'button';
        marke.appendChild(
          document.createTextNode(
            `${facette.titel}: ${bereich.von ?? facette.min}–${bereich.bis ?? facette.max}`,
          ),
        );
        marke.appendChild(element('span', 'weg', '×'));
        marke.addEventListener('click', entferne(() => delete auswahl.bereiche[facette.schluessel]));
        marken!.appendChild(marke);
        continue;
      }

      for (const wert of auswahl.listen[facette.schluessel] ?? []) {
        const anzeige = facette.werte?.find((w) => w.wert === wert)?.anzeige ?? wert;
        const marke = element('button', 'filter-marke');
        marke.type = 'button';
        marke.appendChild(document.createTextNode(anzeige));
        marke.appendChild(element('span', 'weg', '×'));
        marke.addEventListener(
          'click',
          entferne(() => {
            auswahl.listen[facette.schluessel] = (auswahl.listen[facette.schluessel] ?? []).filter(
              (w) => w !== wert,
            );
          }),
        );
        marken!.appendChild(marke);
      }
    }

    const zuruecksetzen = element('button', 'filter-zuruecksetzen', 'Alle Filter zurücksetzen');
    zuruecksetzen.type = 'button';
    zuruecksetzen.addEventListener(
      'click',
      entferne(() => {
        auswahl = leereAuswahl();
      }),
    );
    marken!.appendChild(zuruecksetzen);

    if (zahlAbzeichen) {
      zahlAbzeichen.hidden = false;
      zahlAbzeichen.textContent = String(anzahlAktiv(auswahl));
    }
  }

  function zeichne(neuerEintrag: boolean): void {
    if (!daten) return;

    const gefiltert = filtere(daten.eintraege, auswahl);
    const sortiert = sortiere(gefiltert, sortierung);
    const gesamtSeiten = Math.max(1, Math.ceil(sortiert.length / PRO_SEITE));
    if (seite > gesamtSeiten) seite = gesamtSeiten;
    const aktuelleSeite = seiteVon(sortiert, seite);

    // Ankerpunkte je Autor nur in der Standardsortierung — nur dort stehen die Titel
    // eines Autors als Block beieinander.
    const gesetzt = new Set<string>();
    liste!.replaceChildren();
    for (const eintrag of aktuelleSeite.eintraege) {
      let anker: string | undefined;
      if (sortierung === 'autor' && eintrag.autorSchluessel && !gesetzt.has(eintrag.autorSchluessel)) {
        gesetzt.add(eintrag.autorSchluessel);
        anker = autorAnker(eintrag.autorSchluessel);
      }
      liste!.appendChild(baueZeile(eintrag, anker));
    }

    const gesamt = daten.eintraege.length;
    if (sortiert.length === 0) {
      bilanz!.textContent = `Kein Titel von ${zahlFormat.format(gesamt)} passt zu den Filtern.`;
      liste!.appendChild(
        (() => {
          const hinweis = element('li');
          hinweis.appendChild(
            element(
              'p',
              'filter-leer',
              'Keine Treffer. Einzelne Filter über die Schaltflächen oben wieder wegnehmen — ' +
                'ausgegraute Werte in der Filterliste ergäben ebenfalls keine Treffer.',
            ),
          );
          return hinweis;
        })(),
      );
    } else if (istLeer(auswahl)) {
      bilanz!.textContent =
        `${zahlFormat.format(sortiert.length)} Titel` +
        (gesamtSeiten > 1 ? ` · angezeigt ${aktuelleSeite.von}–${aktuelleSeite.bis}` : '');
    } else {
      bilanz!.textContent =
        `${zahlFormat.format(sortiert.length)} von ${zahlFormat.format(gesamt)} Titeln` +
        (gesamtSeiten > 1 ? ` · angezeigt ${aktuelleSeite.von}–${aktuelleSeite.bis}` : '');
    }

    // Der Titel im Tab stammt aus dem Build und spräche sonst weiter von der
    // ungefilterten Seitenzahl. Gerade beim Teilen eines gefilterten Links ist das
    // das Erste, was jemand sieht.
    const seitenzusatz = gesamtSeiten > 1 ? ` — Seite ${seite} von ${gesamtSeiten}` : '';
    document.title = istLeer(auswahl)
      ? `${daten.bezeichnung}${seitenzusatz} · Büchereikatalog`
      : `${daten.bezeichnung}, gefiltert (${zahlFormat.format(sortiert.length)})${seitenzusatz} · Büchereikatalog`;

    zeichneBlaetterung(gesamtSeiten);
    zeichneMarken();
    aktualisiereSortierlinks();
    schreibeAdresse(neuerEintrag);
  }

  /* ---- Panel ---- */

  function wertePasst(anzeige: string, suche: string): boolean {
    if (!suche) return true;
    return falteGrundform(anzeige).includes(falteGrundform(suche));
  }

  function baueFacette(facette: Facette): HTMLElement {
    const block = element('section', 'facette');
    block.dataset.facette = facette.schluessel;
    block.appendChild(element('h3', 'facette-titel', facette.titel));

    if (facette.art === 'bereich') {
      const werte = element('div', 'bereich-werte');
      const anzeige = element('p', 'bereich-anzeige');
      anzeige.dataset.rolle = 'bereich-anzeige';

      for (const [rolle, beschriftung] of [
        ['von', 'ab'],
        ['bis', 'bis'],
      ] as const) {
        const zeile = element('label', 'bereich-zeile');
        zeile.appendChild(element('span', undefined, beschriftung));
        const regler = document.createElement('input');
        regler.type = 'range';
        regler.min = String(facette.min ?? 0);
        regler.max = String(facette.max ?? 0);
        regler.step = '1';
        regler.dataset.rolle = rolle;
        regler.value = String(rolle === 'von' ? (facette.min ?? 0) : (facette.max ?? 0));
        regler.addEventListener('input', () => {
          const bereich = auswahl.bereiche[facette.schluessel] ?? {};
          const wert = Number(regler.value);
          if (rolle === 'von') bereich.von = wert;
          else bereich.bis = wert;
          // Griffe dürfen sich nicht überholen.
          if (bereich.von !== undefined && bereich.bis !== undefined && bereich.von > bereich.bis) {
            if (rolle === 'von') bereich.bis = bereich.von;
            else bereich.von = bereich.bis;
          }
          // Volle Spanne heißt: kein Filter.
          if (bereich.von === facette.min && bereich.bis === facette.max) {
            delete auswahl.bereiche[facette.schluessel];
          } else {
            auswahl.bereiche[facette.schluessel] = bereich;
          }
          seite = 1;
          zeichne(true);
          aktualisierePanel();
        });
        zeile.appendChild(regler);
        werte.appendChild(zeile);
      }

      werte.appendChild(anzeige);
      block.appendChild(werte);
      return block;
    }

    if (facette.durchsuchbar) {
      const suchfeld = document.createElement('input');
      suchfeld.type = 'search';
      suchfeld.className = 'facette-suche';
      suchfeld.placeholder = `${facette.titel} suchen …`;
      suchfeld.setAttribute('aria-label', `${facette.titel} in der Filterliste suchen`);
      suchfeld.addEventListener('input', () => {
        facettensuche.set(facette.schluessel, suchfeld.value);
        zeichneWerte(block, facette);
      });
      block.appendChild(suchfeld);
    }

    block.appendChild(element('ul', 'facette-werte'));
    zeichneWerte(block, facette);
    return block;
  }

  /** Baut nur die Werteliste einer Facette neu — Suchfeld und Fokus bleiben erhalten. */
  function zeichneWerte(block: HTMLElement, facette: Facette): void {
    const liste = block.querySelector<HTMLUListElement>('.facette-werte');
    if (!liste) return;

    const suche = facettensuche.get(facette.schluessel) ?? '';
    const gewaehlt = new Set(auswahl.listen[facette.schluessel] ?? []);
    const alle = (facette.werte ?? []).filter((w) => wertePasst(w.anzeige, suche));
    const zeigeAlle = aufgeklappt.has(facette.schluessel) || suche !== '' || facette.art === 'schalter';

    // Gewählte Werte bleiben immer sichtbar, auch wenn sie weiter hinten stünden —
    // sonst könnte man sie nicht mehr abwählen.
    const sichtbar = zeigeAlle
      ? alle
      : [
          ...alle.slice(0, WERTE_SICHTBAR),
          ...alle.slice(WERTE_SICHTBAR).filter((w) => gewaehlt.has(w.wert)),
        ];

    liste.replaceChildren();

    for (const wert of sichtbar) {
      const zeile = element('li');
      const label = element('label', 'facette-wert');
      label.dataset.wert = wert.wert;

      const kasten = document.createElement('input');
      kasten.type = 'checkbox';
      kasten.checked = gewaehlt.has(wert.wert);
      kasten.addEventListener('change', () => {
        const bisher = new Set(auswahl.listen[facette.schluessel] ?? []);
        if (kasten.checked) bisher.add(wert.wert);
        else bisher.delete(wert.wert);
        auswahl.listen[facette.schluessel] = [...bisher];
        seite = 1;
        zeichne(true);
        aktualisierePanel();
      });

      label.appendChild(kasten);
      label.appendChild(element('span', 'name', wert.anzeige));
      label.appendChild(element('span', 'zahl', ''));
      zeile.appendChild(label);
      liste.appendChild(zeile);
    }

    const versteckt = alle.length - sichtbar.length;
    const vorhandenerKnopf = block.querySelector('.facette-mehr');
    vorhandenerKnopf?.remove();

    if (versteckt > 0) {
      const knopf = element('button', 'facette-mehr', `alle ${alle.length} anzeigen`);
      knopf.type = 'button';
      knopf.addEventListener('click', () => {
        aufgeklappt.add(facette.schluessel);
        zeichneWerte(block, facette);
        aktualisierePanel();
      });
      block.appendChild(knopf);
    }
  }

  function bauePanel(): void {
    if (!daten || panelGebaut) return;
    panelGebaut = true;
    koerper!.replaceChildren();

    // Textsuche zuerst — sie wirkt wie ein weiterer Filter und ist mit allen kombinierbar.
    const suchblock = element('section', 'facette');
    suchblock.appendChild(element('h3', 'facette-titel', 'Suche in dieser Sparte'));
    const textfeld = document.createElement('input');
    textfeld.type = 'search';
    textfeld.className = 'facette-suche';
    textfeld.id = 'filter-text';
    textfeld.placeholder = 'Titel, Autor, Reihe …';
    textfeld.value = auswahl.text;
    textfeld.setAttribute('aria-label', 'Innerhalb dieser Sparte suchen');

    let zeitgeber: number | undefined;
    textfeld.addEventListener('input', () => {
      window.clearTimeout(zeitgeber);
      zeitgeber = window.setTimeout(() => {
        auswahl.text = textfeld.value;
        seite = 1;
        // Beim Tippen kein neuer Verlaufseintrag je Zeichen — sonst wäre der
        // Zurück-Knopf nach einer Suche unbrauchbar.
        zeichne(false);
        aktualisierePanel();
      }, ENTPRELLUNG_MS);
    });
    suchblock.appendChild(textfeld);
    koerper!.appendChild(suchblock);

    for (const facette of daten.facetten) {
      koerper!.appendChild(baueFacette(facette));
    }
  }

  /** Trefferzahlen, Ausgrauung und Häkchen auffrischen, ohne das Panel neu zu bauen. */
  function aktualisierePanel(): void {
    if (!daten || !panelGebaut) return;

    const zaehlung = zaehle(daten.eintraege, daten.facetten, auswahl);

    for (const facette of daten.facetten) {
      const block = koerper!.querySelector<HTMLElement>(`[data-facette="${CSS.escape(facette.schluessel)}"]`);
      if (!block) continue;

      if (facette.art === 'bereich') {
        const bereich = auswahl.bereiche[facette.schluessel];
        const von = block.querySelector<HTMLInputElement>('[data-rolle="von"]');
        const bis = block.querySelector<HTMLInputElement>('[data-rolle="bis"]');
        const anzeige = block.querySelector<HTMLElement>('[data-rolle="bereich-anzeige"]');
        if (von) von.value = String(bereich?.von ?? facette.min ?? 0);
        if (bis) bis.value = String(bereich?.bis ?? facette.max ?? 0);
        if (anzeige) {
          const treffer = zaehlung.bereiche[facette.schluessel] ?? 0;
          anzeige.textContent =
            `${bereich?.von ?? facette.min}–${bereich?.bis ?? facette.max} ${facette.einheit ?? ''}` +
            ` · ${zahlFormat.format(treffer)} Titel`;
        }
        continue;
      }

      const gewaehlt = new Set(auswahl.listen[facette.schluessel] ?? []);
      const zahlen = zaehlung.listen[facette.schluessel] ?? {};

      for (const label of block.querySelectorAll<HTMLElement>('.facette-wert')) {
        const wert = label.dataset.wert ?? '';
        const treffer = zahlen[wert] ?? 0;
        const kasten = label.querySelector<HTMLInputElement>('input');
        const zahl = label.querySelector<HTMLElement>('.zahl');

        if (kasten) kasten.checked = gewaehlt.has(wert);
        if (zahl) zahl.textContent = zahlFormat.format(treffer);

        // Null Treffer: blass, aber weiterhin da. Ein Wert, der gerade gewählt ist,
        // bleibt bedienbar — sonst käme man aus der Auswahl nicht mehr heraus.
        const leer = treffer === 0 && !gewaehlt.has(wert);
        label.classList.toggle('leer', leer);
        if (kasten) kasten.disabled = leer;
        if (leer && facette.schluessel === 'neu') {
          label.title = 'Es ist noch bei keinem Titel ein Aufnahmedatum erfasst.';
        }
      }
    }
  }

  /* ---- Aktivieren ---- */

  async function aktiviere(ausAdresse: boolean): Promise<void> {
    try {
      await ladeDaten();
    } catch (fehler) {
      koerper!.replaceChildren(
        element('p', 'filter-hinweis', 'Die Filterdaten konnten nicht geladen werden. Bitte die Seite neu laden.'),
      );
      console.error(fehler);
      return;
    }

    if (ausAdresse) leseAdresse();
    bauePanel();
    aktiv = true;
    zeichne(false);
    aktualisierePanel();
  }

  /* ---- Verdrahtung ---- */

  // Auf breiten Displays steht das Panel offen, auf dem Handy zugeklappt.
  if (window.matchMedia('(min-width: 48rem)').matches) panel.open = true;

  // Der Nutzer klappt das Panel auf: Daten holen, damit die Werte gleich dastehen.
  panel.addEventListener('toggle', () => {
    if (panel.open && !aktiv) void aktiviere(false);
  });

  window.addEventListener('popstate', () => {
    if (!daten) {
      void aktiviere(true);
      return;
    }
    leseAdresse();
    zeichne(false);
    aktualisierePanel();
  });

  // Beim Laden: Steht ein Filter in der Adresse, sofort anwenden.
  const startParameter = new URL(window.location.href).searchParams;
  const hatFilter = [...startParameter.keys()].length > 0;
  if (hatFilter || panel.open) void aktiviere(hatFilter);
}
