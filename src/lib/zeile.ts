/**
 * Was in einer Listenzeile steht.
 *
 * Die Zeile wird an zwei Stellen erzeugt: serverseitig von `Medieneintrag.astro`
 * für die statischen Listen, clientseitig von `src/scripts/filter.ts`, sobald ein
 * Filter aktiv ist. Damit beide dasselbe zeigen, treffen sie ihre inhaltlichen
 * Entscheidungen hier gemeinsam — unterschiedlich ist nur, wie das Ergebnis in
 * Markup gegossen wird.
 */

/** Die Felder, die eine Listenzeile braucht. */
export interface Zeilenquelle {
  id: string;
  sparte: string;
  titel: string;
  untertitel?: string;
  autor_nachname?: string;
  autor_vorname?: string;
  autor?: string;
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

export interface Zeilenfelder {
  /** Ansetzungsform „Beer, Alex" — leer, wenn kein Autor erfasst ist. */
  autor?: string;
  titel: string;
  untertitel?: string;
  /** „Ein Fall für August Emmerich · Band 1" */
  reihe?: string;
  figur?: string;
  /** Kurze Zusatzzeile, je nach Medienform anders zusammengestellt. */
  zusatz?: string;
}

export function laufzeitText(minuten: number): string {
  if (minuten < 60) return `${minuten} Min.`;
  const stunden = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest === 0 ? `${stunden} Std.` : `${stunden} Std. ${rest} Min.`;
}

function ordnungsform(q: Zeilenquelle): string | undefined {
  if (q.autor_nachname && q.autor_vorname) return `${q.autor_nachname}, ${q.autor_vorname}`;
  return q.autor_nachname ?? q.autor;
}

/**
 * Stellt die Zusatzzeile zusammen.
 *
 * Bei Hörmedien helfen andere Angaben beim Wiedererkennen als bei einem Buch:
 * Laufzeit und Altersempfehlung statt Verlag und Seitenzahl.
 */
function zusatzzeile(q: Zeilenquelle): string {
  const hoermedium = q.sparte === 'tonies' || q.sparte === 'cds';

  const teile = hoermedium
    ? [
        q.art,
        q.laufzeit_min ? laufzeitText(q.laufzeit_min) : '',
        q.alter_ab ? `ab ${q.alter_ab} Jahren` : '',
      ]
    : [
        [q.verlag, q.ort].filter(Boolean).join(', '),
        q.jahr ? String(q.jahr) : '',
        q.seiten ? `${q.seiten} S.` : '',
      ];

  return teile.filter(Boolean).join(' · ');
}

export function zeilenfelder(q: Zeilenquelle): Zeilenfelder {
  const reihe = [q.reihe, q.band === undefined ? '' : `Band ${q.band}`].filter(Boolean).join(' · ');

  return {
    autor: ordnungsform(q) || undefined,
    titel: q.titel,
    untertitel: q.untertitel || undefined,
    reihe: reihe || undefined,
    figur: q.figur || undefined,
    zusatz: zusatzzeile(q) || undefined,
  };
}
