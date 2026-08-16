/**
 * Die Daten einer Sparte für den Browser — nur für den Build.
 *
 * Wird als `/liste/<sparte>.json` ausgeliefert und erst geholt, wenn tatsächlich
 * gefiltert wird. Wer nur blättert, lädt die Datei nie: Die ungefilterte Liste steht
 * fertig im HTML.
 */
import { alleMedien, medienDerSparte, spartenNachName, type Medium, type Sparte } from './daten.ts';
import { autorSchluessel } from './anzeige.ts';
import { baueSuchtexte } from './suchdokumente.ts';
import { leiteFacettenAb, type Facette, type Listeneintrag } from './facetten.ts';

/** Formatstand von `/liste/<sparte>.json`. */
export const LISTE_VERSION = 1;

export interface Listendaten {
  version: number;
  sparte: Sparte;
  bezeichnung: string;
  /** Alle Einträge der Sparte, unsortiert — sortiert wird im Browser. */
  eintraege: Listeneintrag[];
  /**
   * Die Filter dieser Sparte, beim Build aus den Einträgen abgeleitet.
   *
   * Bewusst mitgeliefert statt im Browser noch einmal berechnet: So können
   * serverseitig gerendertes Panel und clientseitige Auswertung nicht
   * auseinanderlaufen, und der Browser spart die Arbeit.
   */
  facetten: Facette[];
}

/** Nur Felder übernehmen, die auch gesetzt sind — sonst bläht `null` die Datei auf. */
function falls<T>(wert: T | undefined | null, leerErlaubt = false): T | undefined {
  if (wert === undefined || wert === null) return undefined;
  if (!leerErlaubt && typeof wert === 'string' && wert.trim() === '') return undefined;
  if (Array.isArray(wert) && wert.length === 0) return undefined;
  return wert;
}

function zuEintrag(m: Medium, suchtext: string | undefined): Listeneintrag {
  return {
    id: m.id,
    sparte: m.sparte,
    titel: m.titel,
    untertitel: falls(m.untertitel),
    autor: falls(m.autor),
    autor_nachname: falls(m.autor_nachname),
    autor_vorname: falls(m.autor_vorname),
    autorSchluessel: autorSchluessel(m),
    reihe: falls(m.reihe),
    band: falls(m.band),
    figur: falls(m.figur),
    art: falls(m.art),
    genres: falls(m.genres),
    verlag: falls(m.verlag),
    ort: falls(m.ort),
    jahr: falls(m.jahr),
    seiten: falls(m.seiten),
    laufzeit_min: falls(m.laufzeit_min),
    alter_ab: falls(m.alter_ab),
    spieler_min: falls(m.spieler_min),
    spieler_max: falls(m.spieler_max),
    spieldauer_min: falls(m.spieldauer_min),
    erfasst_am: m.erfasst_am ?? undefined,
    suchbar: suchtext,
  };
}

/**
 * Die Suchtexte werden einmal über den ganzen Katalog gebaut, weil der Wortschatz
 * für die Kompositazerlegung aus allen Sparten stammt — „Krimi" soll auch dann als
 * bekanntes Wort gelten, wenn es in der gerade gebauten Sparte nur in
 * Zusammensetzungen vorkommt.
 */
let suchtexte: Map<string, string> | null = null;

export function baueListendaten(sparte: Sparte): Listendaten {
  suchtexte ??= baueSuchtexte(alleMedien);

  const eintraege = medienDerSparte(sparte).map((m) => zuEintrag(m, suchtexte!.get(m.id)));

  return {
    version: LISTE_VERSION,
    sparte,
    bezeichnung: spartenNachName.get(sparte)?.bezeichnung ?? sparte,
    eintraege,
    facetten: leiteFacettenAb(eintraege),
  };
}

/** Nur die Facetten — für das serverseitig gerenderte Panel. */
export function facettenDerSparte(sparte: Sparte): Facette[] {
  return baueListendaten(sparte).facetten;
}
