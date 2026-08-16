/**
 * Filter für die Listenansichten.
 *
 * Nichts hier weiß, welche Sparte es gerade bearbeitet. Es gibt einen einzigen
 * Bauplan, der Datenfelder auf Filter abbildet; welche Filter eine Sparte zeigt,
 * entscheidet allein, was in ihren Daten steht. Dass bei Tonies Altersempfehlung,
 * Art und Laufzeit erscheinen und bei Romanen Erscheinungsjahrzehnt, ist damit kein
 * Sonderfall im Code, sondern ein Ergebnis der Auswertung.
 *
 * Läuft im Build (Facetten vorberechnen) und im Browser (filtern, zählen) — deshalb
 * ohne jeden Zugriff auf die Katalogdaten.
 */
import { falteGrundform, zerlegeInWorte } from './suchoptionen.ts';
import type { Sortierbar } from './sortierung.ts';

/** Zeitfenster für „Neu im Bestand", gerechnet ab dem Aufnahmedatum. */
export const NEU_TAGE = 90;

/**
 * Ab welchem Anteil der Einträge ein Feld einen Filter bekommt.
 *
 * Ohne Schwelle bekämen die Romane einen Altersfilter, weil zwei von 806 Titeln ein
 * `alter_ab` tragen — ein Filter, der 804 Titel wegwirft, ist keine Hilfe.
 */
export const MIN_ABDECKUNG = 0.1;

/** Ab so vielen Werten bekommt eine Filterliste ein eigenes Suchfeld. */
export const SUCHFELD_AB = 20;

/** So viele Werte einer Liste sind zunächst sichtbar, der Rest auf Klick. */
export const WERTE_SICHTBAR = 12;

/* ------------------------------------------------------------------ *
 * Eintrag
 * ------------------------------------------------------------------ */

/** Ein Eintrag, wie ihn `/liste/<sparte>.json` liefert. */
export interface Listeneintrag extends Sortierbar {
  sparte: string;
  untertitel?: string;
  autor?: string;
  /** Slug aus Nach- und Vorname — der stabile Schlüssel des Autorenfilters. */
  autorSchluessel?: string;
  figur?: string;
  art?: string;
  genres?: string[];
  verlag?: string;
  ort?: string;
  seiten?: number;
  laufzeit_min?: number;
  alter_ab?: number;
  spieler_min?: number;
  spieler_max?: number;
  spieldauer_min?: number;
  /** Vorgefaltete Wörter inklusive Kompositateile, für die Textsuche in der Liste. */
  suchbar?: string;
}

/* ------------------------------------------------------------------ *
 * Bauplan
 * ------------------------------------------------------------------ */

export type Facettenart = 'liste' | 'bereich' | 'schalter';

interface Bauplan {
  /** Name des URL-Parameters. */
  schluessel: string;
  titel: string;
  art: Facettenart;
  /**
   * Die Werte eines Eintrags für diese Facette. Leeres Ergebnis heißt: Der Eintrag
   * trägt zu dieser Facette nichts bei und zählt nicht in die Abdeckung.
   */
  werte: (e: Listeneintrag) => Array<string | number>;
  /** Anzeigetext eines Wertes, falls er nicht mit dem Schlüssel identisch ist. */
  beschriften?: (wert: string, eintraege: Listeneintrag[]) => string;
  einheit?: string;
  /** Sortierung der Werte in der Liste: nach Häufigkeit oder nach dem Wert selbst. */
  ordnung?: 'haeufigkeit' | 'wert';
}

/**
 * Der gesamte Bauplan. Eine Zeile je Datenfeld, für alle Sparten dieselbe.
 * Hier kommt eine Facette dazu, wenn das Schema ein neues Feld bekommt.
 */
const BAUPLAN: Bauplan[] = [
  {
    schluessel: 'genre',
    titel: 'Genre',
    art: 'liste',
    werte: (e) => e.genres ?? [],
    ordnung: 'haeufigkeit',
  },
  {
    schluessel: 'jahrzehnt',
    titel: 'Erscheinungsjahrzehnt',
    art: 'liste',
    werte: (e) => (e.jahr === undefined ? [] : [Math.floor(e.jahr / 10) * 10]),
    beschriften: (wert) => `${wert}er`,
    ordnung: 'wert',
  },
  {
    schluessel: 'autor',
    titel: 'Autor',
    art: 'liste',
    werte: (e) => (e.autorSchluessel ? [e.autorSchluessel] : []),
    // Der Schlüssel ist ein Slug; angezeigt wird die Ansetzungsform aus den Daten.
    beschriften: (wert, eintraege) => {
      const treffer = eintraege.find((e) => e.autorSchluessel === wert);
      if (!treffer) return wert;
      return treffer.autor_nachname && treffer.autor_vorname
        ? `${treffer.autor_nachname}, ${treffer.autor_vorname}`
        : (treffer.autor_nachname ?? treffer.autor ?? wert);
    },
    ordnung: 'haeufigkeit',
  },
  {
    schluessel: 'reihe',
    titel: 'Reihe',
    art: 'liste',
    werte: (e) => (e.reihe ? [e.reihe] : []),
    ordnung: 'haeufigkeit',
  },
  {
    schluessel: 'art',
    titel: 'Art',
    art: 'liste',
    werte: (e) => (e.art ? [e.art] : []),
    ordnung: 'haeufigkeit',
  },
  {
    schluessel: 'alter',
    titel: 'Altersempfehlung',
    art: 'bereich',
    werte: (e) => (e.alter_ab === undefined ? [] : [e.alter_ab]),
    einheit: 'Jahre',
  },
  {
    schluessel: 'laufzeit',
    titel: 'Laufzeit',
    art: 'bereich',
    werte: (e) => (e.laufzeit_min === undefined ? [] : [e.laufzeit_min]),
    einheit: 'Minuten',
  },
  {
    schluessel: 'spieler',
    titel: 'Spieleranzahl',
    art: 'bereich',
    // Ein Spiel deckt eine Spanne ab; beide Enden zählen für Grenzen und Abdeckung.
    werte: (e) => [e.spieler_min, e.spieler_max].filter((v): v is number => v !== undefined),
    einheit: 'Spieler',
  },
  {
    schluessel: 'spieldauer',
    titel: 'Spieldauer',
    art: 'bereich',
    werte: (e) => (e.spieldauer_min === undefined ? [] : [e.spieldauer_min]),
    einheit: 'Minuten',
  },
];

const NEU_SCHLUESSEL = 'neu';

/* ------------------------------------------------------------------ *
 * Abgeleitete Facetten
 * ------------------------------------------------------------------ */

export interface Facettenwert {
  wert: string;
  anzeige: string;
}

export interface Facette {
  schluessel: string;
  titel: string;
  art: Facettenart;
  einheit?: string;
  /** Bei `art: 'liste'` — die vorkommenden Werte, fertig sortiert. */
  werte?: Facettenwert[];
  /** Bei `art: 'bereich'` — die Grenzen im Bestand. */
  min?: number;
  max?: number;
  /** Bei langen Listen: Suchfeld einblenden. */
  durchsuchbar?: boolean;
}

/**
 * Leitet die Filter einer Sparte aus ihren Einträgen ab.
 *
 * Eine Facette erscheint, wenn mindestens zwei verschiedene Werte vorkommen und
 * mindestens `MIN_ABDECKUNG` der Einträge überhaupt einen Wert dafür hat. „Neu im
 * Bestand" ist davon ausgenommen: Der Schalter bleibt sichtbar und wird bei null
 * Treffern ausgegraut, wie jeder andere Filterwert auch.
 */
export function leiteFacettenAb(eintraege: Listeneintrag[]): Facette[] {
  const facetten: Facette[] = [];
  if (eintraege.length === 0) return facetten;

  for (const plan of BAUPLAN) {
    let mitWert = 0;
    const haeufigkeit = new Map<string, number>();
    const zahlen: number[] = [];

    for (const eintrag of eintraege) {
      const werte = plan.werte(eintrag);
      if (werte.length === 0) continue;
      mitWert += 1;

      for (const wert of werte) {
        if (typeof wert === 'number') zahlen.push(wert);
        const text = String(wert);
        haeufigkeit.set(text, (haeufigkeit.get(text) ?? 0) + 1);
      }
    }

    if (haeufigkeit.size < 2) continue;
    if (mitWert / eintraege.length < MIN_ABDECKUNG) continue;

    if (plan.art === 'bereich') {
      facetten.push({
        schluessel: plan.schluessel,
        titel: plan.titel,
        art: 'bereich',
        einheit: plan.einheit,
        min: Math.min(...zahlen),
        max: Math.max(...zahlen),
      });
      continue;
    }

    const werte = [...haeufigkeit.entries()]
      .sort((a, b) =>
        plan.ordnung === 'wert'
          ? Number(a[0]) - Number(b[0]) || a[0].localeCompare(b[0], 'de')
          : b[1] - a[1] || a[0].localeCompare(b[0], 'de'),
      )
      .map(([wert]) => ({
        wert,
        anzeige: plan.beschriften ? plan.beschriften(wert, eintraege) : wert,
      }));

    facetten.push({
      schluessel: plan.schluessel,
      titel: plan.titel,
      art: 'liste',
      werte,
      durchsuchbar: werte.length >= SUCHFELD_AB,
    });
  }

  facetten.push({
    schluessel: NEU_SCHLUESSEL,
    titel: 'Zugang',
    art: 'schalter',
    werte: [{ wert: '1', anzeige: `Neu im Bestand (letzte ${NEU_TAGE} Tage)` }],
  });

  return facetten;
}

/* ------------------------------------------------------------------ *
 * Auswahl
 * ------------------------------------------------------------------ */

export interface Bereichsauswahl {
  von?: number;
  bis?: number;
}

export interface Auswahl {
  /** Facettenschlüssel → gewählte Werte (Listen und Schalter). */
  listen: Record<string, string[]>;
  /** Facettenschlüssel → gewählte Spanne. */
  bereiche: Record<string, Bereichsauswahl>;
  /** Freitext, kombinierbar mit allen Filtern. */
  text: string;
}

export function leereAuswahl(): Auswahl {
  return { listen: {}, bereiche: {}, text: '' };
}

export function istLeer(auswahl: Auswahl): boolean {
  return (
    auswahl.text.trim() === '' &&
    Object.values(auswahl.listen).every((werte) => werte.length === 0) &&
    Object.values(auswahl.bereiche).every((b) => b.von === undefined && b.bis === undefined)
  );
}

export function anzahlAktiv(auswahl: Auswahl): number {
  let n = auswahl.text.trim() === '' ? 0 : 1;
  for (const werte of Object.values(auswahl.listen)) n += werte.length;
  for (const b of Object.values(auswahl.bereiche)) {
    if (b.von !== undefined || b.bis !== undefined) n += 1;
  }
  return n;
}

/* ------------------------------------------------------------------ *
 * Filtern
 * ------------------------------------------------------------------ */

const planNach = new Map(BAUPLAN.map((p) => [p.schluessel, p]));

/** Liegt das Aufnahmedatum innerhalb des Zeitfensters? */
function istNeu(eintrag: Listeneintrag, heute: Date): boolean {
  if (!eintrag.erfasst_am) return false;
  const aufgenommen = new Date(eintrag.erfasst_am);
  if (Number.isNaN(aufgenommen.getTime())) return false;
  const tage = (heute.getTime() - aufgenommen.getTime()) / 86_400_000;
  return tage >= 0 && tage <= NEU_TAGE;
}

/** Prüft eine einzelne Facette gegen einen Eintrag. */
function passtFacette(
  eintrag: Listeneintrag,
  schluessel: string,
  auswahl: Auswahl,
  heute: Date,
): boolean {
  if (schluessel === NEU_SCHLUESSEL) {
    return (auswahl.listen[NEU_SCHLUESSEL]?.length ?? 0) === 0 || istNeu(eintrag, heute);
  }

  const plan = planNach.get(schluessel);
  if (!plan) return true;

  if (plan.art === 'bereich') {
    const bereich = auswahl.bereiche[schluessel];
    if (!bereich || (bereich.von === undefined && bereich.bis === undefined)) return true;

    const werte = plan.werte(eintrag).map(Number);
    if (werte.length === 0) return false;

    // Bei einer Spanne (Spieleranzahl) genügt Überschneidung, bei einem Einzelwert
    // muss er im gewählten Fenster liegen — beides deckt derselbe Vergleich ab.
    const eigenesMin = Math.min(...werte);
    const eigenesMax = Math.max(...werte);
    if (bereich.von !== undefined && eigenesMax < bereich.von) return false;
    if (bereich.bis !== undefined && eigenesMin > bereich.bis) return false;
    return true;
  }

  const gewaehlt = auswahl.listen[schluessel];
  if (!gewaehlt || gewaehlt.length === 0) return true;

  const eigene = plan.werte(eintrag).map(String);
  // Mehrfachauswahl innerhalb einer Facette wirkt als ODER: „Krimi oder Thriller".
  return eigene.some((w) => gewaehlt.includes(w));
}

/**
 * Textsuche innerhalb der Liste.
 *
 * Nutzt dieselbe Faltung und Zerlegung wie die Volltextsuche, damit „Muller" auch
 * hier „Müller" findet und „Krimi" auch „Alpenkrimi". Bewusst nur exakt und als
 * Wortanfang, ohne Fuzzy: Der Text ist hier ein weiterer Filter neben den anderen,
 * und die Reihenfolge der Liste bestimmt die gewählte Sortierung, nicht die
 * Trefferqualität. Die unscharfe Suche steht auf der Startseite.
 */
function passtText(eintrag: Listeneintrag, begriffe: string[]): boolean {
  if (begriffe.length === 0) return true;
  const heuhaufen = eintrag.suchbar ?? '';
  return begriffe.every(
    (begriff) => heuhaufen.startsWith(begriff) || heuhaufen.includes(` ${begriff}`),
  );
}

export function textBegriffe(text: string): string[] {
  return zerlegeInWorte(text).map(falteGrundform).filter((b) => b.length > 0);
}

/** Alle Filter außer den genannten anwenden. */
function filtereOhne(
  eintraege: Listeneintrag[],
  auswahl: Auswahl,
  ausnahme: string | null,
  heute: Date,
): Listeneintrag[] {
  const schluessel = [...planNach.keys(), NEU_SCHLUESSEL].filter((s) => s !== ausnahme);
  const begriffe = textBegriffe(auswahl.text);

  return eintraege.filter(
    (eintrag) =>
      passtText(eintrag, begriffe) &&
      schluessel.every((s) => passtFacette(eintrag, s, auswahl, heute)),
  );
}

export function filtere(
  eintraege: Listeneintrag[],
  auswahl: Auswahl,
  heute: Date = new Date(),
): Listeneintrag[] {
  return filtereOhne(eintraege, auswahl, null, heute);
}

/* ------------------------------------------------------------------ *
 * Trefferzahlen
 * ------------------------------------------------------------------ */

export interface Zaehlung {
  /** Facettenschlüssel → Wert → Trefferzahl. */
  listen: Record<string, Record<string, number>>;
  /** Facettenschlüssel → Trefferzahl im aktuell gewählten Bereich. */
  bereiche: Record<string, number>;
}

/**
 * Zählt für jeden Filterwert, wie viele Treffer er ergäbe.
 *
 * Entscheidend ist, dass eine Facette bei ihrer eigenen Zählung ausgeklammert wird:
 * Sonst zeigte jeder nicht gewählte Genre-Wert eine 0, sobald ein Genre gewählt ist,
 * und man käme nie mehr zu einer Mehrfachauswahl.
 */
export function zaehle(
  eintraege: Listeneintrag[],
  facetten: Facette[],
  auswahl: Auswahl,
  heute: Date = new Date(),
): Zaehlung {
  const zaehlung: Zaehlung = { listen: {}, bereiche: {} };

  for (const facette of facetten) {
    const grundmenge = filtereOhne(eintraege, auswahl, facette.schluessel, heute);

    if (facette.art === 'bereich') {
      zaehlung.bereiche[facette.schluessel] = grundmenge.filter((e) =>
        passtFacette(e, facette.schluessel, auswahl, heute),
      ).length;
      continue;
    }

    const je: Record<string, number> = {};

    if (facette.schluessel === NEU_SCHLUESSEL) {
      je['1'] = grundmenge.filter((e) => istNeu(e, heute)).length;
    } else {
      const plan = planNach.get(facette.schluessel);
      for (const wert of facette.werte ?? []) je[wert.wert] = 0;
      if (plan) {
        for (const eintrag of grundmenge) {
          for (const wert of new Set(plan.werte(eintrag).map(String))) {
            if (wert in je) je[wert] += 1;
          }
        }
      }
    }

    zaehlung.listen[facette.schluessel] = je;
  }

  return zaehlung;
}

/* ------------------------------------------------------------------ *
 * Adresszeile
 * ------------------------------------------------------------------ */

/**
 * Trenner einer Spanne in der Adresszeile: `?alter=..5`, `?laufzeit=20..60`.
 * Bewusst nicht der Bindestrich — `?alter=-5` läse sich wie „minus fünf".
 */
const BEREICH_TRENNER = '..';

/**
 * Liest die Auswahl aus den Suchparametern.
 *
 * Mehrere Werte stehen als wiederholter Parameter (`?genre=Krimi&genre=Roman`) und
 * nicht kommagetrennt — Genrenamen wie „Biografie / Wahre Geschichte" enthalten
 * Zeichen, an denen ein Trennzeichen zerbräche.
 */
export function ausParametern(parameter: URLSearchParams, facetten: Facette[]): Auswahl {
  const auswahl = leereAuswahl();
  auswahl.text = parameter.get('q') ?? '';

  for (const facette of facetten) {
    if (facette.art === 'bereich') {
      const roh = parameter.get(facette.schluessel);
      if (!roh) continue;
      const [von, bis] = roh.split(BEREICH_TRENNER, 2).map((t) => (t === '' ? undefined : Number(t)));
      auswahl.bereiche[facette.schluessel] = {
        von: Number.isFinite(von) ? von : undefined,
        bis: Number.isFinite(bis) ? bis : undefined,
      };
      continue;
    }

    const erlaubt = new Set((facette.werte ?? []).map((w) => w.wert));
    const gewaehlt = parameter.getAll(facette.schluessel).filter((w) => erlaubt.has(w));
    if (gewaehlt.length > 0) auswahl.listen[facette.schluessel] = gewaehlt;
  }

  return auswahl;
}

/** Schreibt die Auswahl in Suchparameter. Reihenfolge bleibt stabil, damit sich URLs vergleichen lassen. */
export function zuParametern(auswahl: Auswahl, facetten: Facette[]): URLSearchParams {
  const parameter = new URLSearchParams();
  if (auswahl.text.trim()) parameter.set('q', auswahl.text.trim());

  for (const facette of facetten) {
    if (facette.art === 'bereich') {
      const bereich = auswahl.bereiche[facette.schluessel];
      if (!bereich || (bereich.von === undefined && bereich.bis === undefined)) continue;
      parameter.set(facette.schluessel, `${bereich.von ?? ''}${BEREICH_TRENNER}${bereich.bis ?? ''}`);
      continue;
    }

    for (const wert of auswahl.listen[facette.schluessel] ?? []) {
      parameter.append(facette.schluessel, wert);
    }
  }

  return parameter;
}
