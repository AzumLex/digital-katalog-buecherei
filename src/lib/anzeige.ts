/**
 * Aufbereitung der Rohdaten für die Anzeige.
 *
 * Grundregel des Katalogs: **Was nicht da ist, wird nicht gezeigt.** Kein „unbekannt",
 * keine leeren Zeilen, kein Gedankenstrich als Platzhalter. Deshalb liefern die
 * `angaben…`-Funktionen nur Zeilen zurück, die auch einen Wert haben.
 */
import type { Medium, MedienStatus } from './daten.ts';

/* ------------------------------------------------------------------ *
 * Grundlagen
 * ------------------------------------------------------------------ */

/**
 * Hat das Feld einen anzeigbaren Wert?
 *
 * Der leere Text zählt ausdrücklich als „nicht gesetzt": `standort` und `signatur`
 * stehen bei allen 987 Einträgen als `""` in den Daten (siehe NOTIZEN.md, Punkt 6).
 * Eine Prüfung auf bloßes Vorhandensein des Feldes würde überall leere Zeilen erzeugen.
 */
export function istGesetzt(wert: unknown): boolean {
  if (wert === null || wert === undefined) return false;
  if (typeof wert === 'string') return wert.trim() !== '';
  if (Array.isArray(wert)) return wert.length > 0;
  return true;
}

const euroFormat = new Intl.NumberFormat('de-AT', { style: 'currency', currency: 'EUR' });
const zahlFormat = new Intl.NumberFormat('de-AT');
const datumFormat = new Intl.DateTimeFormat('de-AT', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

/** Kleinbuchstaben, ASCII, Bindestriche — für Anker und Schlüssel. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Akzente, die NFKD abgetrennt hat
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ *
 * Namen
 * ------------------------------------------------------------------ */

/** Ansetzungsform für Listen: „Beer, Alex". */
export function ordnungsform(m: Medium): string | undefined {
  if (m.autor_nachname && m.autor_vorname) return `${m.autor_nachname}, ${m.autor_vorname}`;
  return m.autor_nachname ?? m.autor;
}

/** Anzeigeform für Fließtext und Überschriften: „Alex Beer". */
export function autorAnzeige(m: Medium): string | undefined {
  if (m.autor) return m.autor;
  if (m.autor_nachname && m.autor_vorname) return `${m.autor_vorname} ${m.autor_nachname}`;
  return m.autor_nachname;
}

/**
 * Schlüssel, unter dem Titel desselben Autors zusammengefasst werden.
 * Bewusst aus Nach- **und** Vorname gebildet — zwölf Nachnamen im Bestand gehören
 * zu je zwei verschiedenen Personen.
 */
export function autorSchluessel(m: Medium): string | undefined {
  if (!m.autor_nachname) return undefined;
  return slug(`${m.autor_nachname} ${m.autor_vorname ?? ''}`);
}

/* ------------------------------------------------------------------ *
 * Einzelne Felder
 * ------------------------------------------------------------------ */

export function laufzeitText(minuten: number): string {
  if (minuten < 60) return `${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `${stunden} Std.` : `${stunden} Std. ${rest} Min.`;
}

/**
 * Preis. Bei sechs Einträgen steht in `waehrung_original` „ATS" — dort ist die Zahl
 * in `preis_eur` ein Schillingbetrag und keine Euro (siehe NOTIZEN.md). Sie wird
 * deshalb als Schilling ausgewiesen und nicht mit einem Eurozeichen versehen.
 */
export function preisText(m: Medium): string | undefined {
  if (!istGesetzt(m.preis_eur)) return undefined;
  const betrag = m.preis_eur as number;
  if (m.waehrung_original) return `${zahlFormat.format(betrag)} ${m.waehrung_original}`;
  return euroFormat.format(betrag);
}

export function datumText(iso: string): string {
  const datum = new Date(iso);
  return Number.isNaN(datum.getTime()) ? iso : datumFormat.format(datum);
}

const SPRACHEN: Record<string, string> = {
  de: 'Deutsch',
  en: 'Englisch',
  fr: 'Französisch',
  it: 'Italienisch',
  es: 'Spanisch',
};

export function spracheText(code: string): string {
  return SPRACHEN[code] ?? code;
}

const STATUS_TEXTE: Record<MedienStatus, string> = {
  verfuegbar: 'verfügbar',
  ausgeliehen: 'ausgeliehen',
  vermisst: 'vermisst',
  ausgeschieden: 'ausgeschieden',
};

export function statusText(status: MedienStatus): string {
  return STATUS_TEXTE[status];
}

/** „Band 3" bzw. nur die Reihe, wenn keine Nummer bekannt ist. */
export function bandText(m: Medium): string | undefined {
  return istGesetzt(m.band) ? `Band ${m.band}` : undefined;
}

export function spielerText(m: Medium): string | undefined {
  const { spieler_min: min, spieler_max: max } = m;
  if (min && max) return min === max ? `${min} Spieler` : `${min}–${max} Spieler`;
  if (min) return `ab ${min} Spielern`;
  if (max) return `bis ${max} Spieler`;
  return undefined;
}

/* ------------------------------------------------------------------ *
 * Zusammengestellte Angaben für die Detailseite
 * ------------------------------------------------------------------ */

export interface Angabe {
  label: string;
  wert: string;
}

/**
 * Freitext aus der Quelle — ohne die Fälle, in denen dort nur die Bandnummer steht.
 *
 * Bei 44 der 73 Einträge mit `notiz` ist der Inhalt exakt „Bd. 4" o. ä. und damit
 * eine Wiederholung der Bandangabe, die schon über dem Titel steht. Eine Zeile
 * „Anmerkung: Bd. 4" direkt unter „Band 4" ist reines Rauschen.
 */
function anmerkung(m: Medium): string | undefined {
  if (!m.notiz) return undefined;
  if (m.band !== undefined && m.notiz.replace(/\s+/g, '') === `Bd.${m.band}`) return undefined;
  return m.notiz;
}

/** Nimmt nur Zeilen auf, die tatsächlich einen Wert haben. */
function sammle(zeilen: Array<[string, string | undefined]>): Angabe[] {
  return zeilen
    .filter((z): z is [string, string] => istGesetzt(z[1]))
    .map(([label, wert]) => ({ label, wert }));
}

/** Angaben zum Inhalt: Was ist das, für wen, wie lang. */
export function angabenInhalt(m: Medium): Angabe[] {
  return sammle([
    ['Art', m.art],
    ['Genre', m.genres?.join(', ')],
    ['Laufzeit', istGesetzt(m.laufzeit_min) ? laufzeitText(m.laufzeit_min as number) : undefined],
    ['Spieldauer', istGesetzt(m.spieldauer_min) ? laufzeitText(m.spieldauer_min as number) : undefined],
    ['Spieler', spielerText(m)],
    ['Empfohlen ab', istGesetzt(m.alter_ab) ? `${m.alter_ab} Jahren` : undefined],
    ['Anmerkung', anmerkung(m)],
  ]);
}

/** Angaben zur Ausgabe: Verlag, Umfang, ISBN — das Bibliografische. */
export function angabenAusgabe(m: Medium): Angabe[] {
  return sammle([
    ['Verlag', m.verlag],
    ['Erscheinungsort', m.ort],
    ['Erschienen', istGesetzt(m.jahr) ? String(m.jahr) : undefined],
    ['Auflage', m.auflage],
    ['Umfang', istGesetzt(m.seiten) ? `${zahlFormat.format(m.seiten as number)} Seiten` : undefined],
    ['Einband', m.einband],
    ['ISBN', m.isbn_formatiert ?? m.isbn],
    ['Preis', preisText(m)],
    ['Übersetzung', m.uebersetzung],
    ['Originalsprache', m.originalsprache],
    ['Sprache', m.sprache ? spracheText(m.sprache) : undefined],
  ]);
}

/* ------------------------------------------------------------------ *
 * Seitentitel und Meta-Beschreibung
 * ------------------------------------------------------------------ */

/** Höchstlänge einer Meta-Beschreibung, bevor Suchmaschinen abschneiden. */
const BESCHREIBUNG_MAX = 160;

/** Kürzt an einer Wortgrenze und hängt ein Auslassungszeichen an. */
function kuerze(text: string, laenge = BESCHREIBUNG_MAX): string {
  if (text.length <= laenge) return text;
  const schnitt = text.slice(0, laenge - 1);
  const luecke = schnitt.lastIndexOf(' ');
  return `${(luecke > laenge * 0.6 ? schnitt.slice(0, luecke) : schnitt).trimEnd()}…`;
}

/** Der Titel im Browser-Tab und in Suchergebnissen: „Die rote Frau — Alex Beer". */
export function seitentitel(m: Medium): string {
  const werk = [m.titel, autorAnzeige(m)].filter(Boolean).join(' — ');
  return `${werk} · Büchereikatalog`;
}

/** Entfernt Wiederholungen, ohne die Reihenfolge zu ändern; Groß-/Kleinschreibung egal. */
function ohneDoppelte(teile: Array<string | undefined>): string[] {
  const gesehen = new Set<string>();
  const heraus: string[] = [];
  for (const teil of teile) {
    if (!istGesetzt(teil)) continue;
    const schluessel = (teil as string).toLowerCase();
    if (gesehen.has(schluessel)) continue;
    gesehen.add(schluessel);
    heraus.push(teil as string);
  }
  return heraus;
}

/**
 * Eine Meta-Beschreibung aus dem, was über den Titel bekannt ist.
 *
 * Bewusst als Sätze und nicht als aneinandergereihte Felder: Was hier steht, ist bei
 * einer Google-Suche und beim Teilen eines Links das Einzige, was jemand sieht,
 * bevor er klickt. Fehlende Angaben entfallen ersatzlos — wie überall im Katalog.
 *
 * Wird es zu lang, fallen ganze Sätze von hinten weg statt mitten im Wort
 * abgeschnitten zu werden. Ein „… Im Bes…" am Ende sieht nach kaputt aus.
 */
export function metaBeschreibung(m: Medium): string {
  const autor = autorAnzeige(m);

  // Bei 151 der 181 Tonies steht in `art` dasselbe wie in `genres` — „Hörspiel,
  // Hörspiel" wäre das Ergebnis, wenn man beides ungeprüft aneinanderreiht.
  const merkmale = ohneDoppelte([
    m.art,
    ...(m.genres ?? []),
    istGesetzt(m.laufzeit_min) ? laufzeitText(m.laufzeit_min as number) : undefined,
    istGesetzt(m.alter_ab) ? `ab ${m.alter_ab} Jahren` : undefined,
    istGesetzt(m.jahr) ? `${m.verlag ? `${m.verlag} ` : ''}${m.jahr}` : m.verlag,
    istGesetzt(m.seiten) ? `${m.seiten} Seiten` : undefined,
  ]).join(', ');

  const saetze = [
    [m.titel, autor && `von ${autor}`].filter(Boolean).join(' '),
    m.reihe
      ? istGesetzt(m.band)
        ? `Band ${m.band} der Reihe „${m.reihe}“`
        : `Aus der Reihe „${m.reihe}“`
      : undefined,
    m.figur ? `Tonie-Figur: ${m.figur}` : undefined,
    merkmale || undefined,
    'Im Bestand der Bücherei',
  ].filter((s): s is string => istGesetzt(s));

  let text = kuerze(`${saetze[0]}.`);
  for (const satz of saetze.slice(1)) {
    const erweitert = `${text.slice(0, -1)}. ${satz}.`;
    if (erweitert.length > BESCHREIBUNG_MAX) continue;
    text = erweitert;
  }
  return text;
}

/** Angaben zum Exemplar in der Bücherei. */
export function angabenBestand(m: Medium): Angabe[] {
  return sammle([
    ['Status', statusText(m.status)],
    ['Exemplare', istGesetzt(m.bestand) ? zahlFormat.format(m.bestand as number) : undefined],
    ['Standort', m.standort],
    ['Signatur', m.signatur],
    ['Aufgenommen', m.erfasst_am ? datumText(m.erfasst_am) : undefined],
  ]);
}
