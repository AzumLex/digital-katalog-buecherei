/**
 * `POST /api/anmelden/` — Passwort entgegennehmen, Sitzungscookie setzen.
 *
 * Nimmt ein gewöhnliches Formular entgegen und antwortet mit einer Weiterleitung, nicht
 * mit JSON. Das ist Absicht: So funktioniert die Anmeldung auch dann, wenn im Browser
 * kein JavaScript läuft — und es gibt nichts, was ein Skript im Browser über das
 * Passwort erfahren könnte, weil kein Skript daran beteiligt ist.
 */
import type { APIRoute } from 'astro';
import {
  AnmeldeFehler,
  SITZUNGS_COOKIE,
  erzeugeSitzung,
  pruefePasswort,
  sitzungsCookieAngaben,
} from '../../lib/anmeldung';

/** Serverrendering — hier wird ein Geheimnis gelesen, das nie in den Katalog gehört. */
export const prerender = false;

/** Wohin es nach dem Anmelden geht, wenn nichts anderes gewünscht war. */
const STARTSEITE = '/verwaltung/';

/**
 * Nur zum Rechnen: eine Basis, die es nicht gibt (RFC 2606).
 *
 * `new URL()` braucht eine Basis, um einen Pfad aufzulösen. Sie taucht in keiner Antwort
 * auf — weitergegeben wird ausschließlich `pathname` und `search`.
 */
const RECHENBASIS = 'https://platzhalter.invalid';

/**
 * Prüft, wohin nach dem Anmelden weitergeleitet werden darf.
 *
 * Ohne diese Prüfung wäre die Adresse eine offene Weiterleitung: Ein zugeschickter Link
 * `/verwaltung/anmelden/?weiter=https://…` schickte die Person nach dem Anmelden auf eine
 * fremde Seite, die aussieht wie die Verwaltung und noch einmal nach dem Passwort fragt.
 *
 * Geprüft wird am **aufgelösten** Pfad und nicht an der eingegebenen Zeichenkette. Der
 * Unterschied ist nicht theoretisch: `/verwaltung/../woanders/` fängt mit `/verwaltung/`
 * an, und ein Browser macht daraus `/woanders/`. Ein Vergleich auf den Anfang der
 * Zeichenkette ließe das durch. `new URL()` rechnet vorher zusammen, was der Browser
 * hinterher rechnen würde — und erledigt nebenbei `//fremde.example` (das ein Browser als
 * vollständige Adresse liest) und `https://…` gleich mit: Beide bekommen eine andere
 * Herkunft als die Rechenbasis.
 */
function erlaubterWeiterweg(gewuenscht: string | null): string {
  if (!gewuenscht) return STARTSEITE;

  let ziel: URL;
  try {
    ziel = new URL(gewuenscht, RECHENBASIS);
  } catch {
    return STARTSEITE;
  }

  if (ziel.origin !== RECHENBASIS) return STARTSEITE;
  if (!ziel.pathname.startsWith('/verwaltung/')) return STARTSEITE;

  return `${ziel.pathname}${ziel.search}`;
}

/** Zurück zum Formular, mit einem Grund, den die Seite in Worte fasst. */
function zurueckZumFormular(grund: string, weiter: string): Response {
  const ziel = new URL('/verwaltung/anmelden/', RECHENBASIS);
  ziel.searchParams.set('fehler', grund);
  if (weiter !== STARTSEITE) ziel.searchParams.set('weiter', weiter);

  return new Response(null, {
    status: 303,
    headers: { location: `${ziel.pathname}${ziel.search}` },
  });
}

export const POST: APIRoute = async ({ request, cookies, url }) => {
  const formular = await request.formData();
  const passwort = String(formular.get('passwort') ?? '');
  const weiter = erlaubterWeiterweg(
    typeof formular.get('weiter') === 'string' ? String(formular.get('weiter')) : null,
  );

  let stimmt: boolean;
  try {
    stimmt = pruefePasswort(passwort);
  } catch (fehler) {
    // Fehlende oder kaputte Einrichtung. Der Text dazu steht auf der Anmeldeseite und
    // nicht hier, damit er nicht über die Adresszeile wandern muss.
    if (fehler instanceof AnmeldeFehler) return zurueckZumFormular('einrichtung', weiter);
    throw fehler;
  }

  if (!stimmt) return zurueckZumFormular('falsch', weiter);

  const sitzung = erzeugeSitzung();
  cookies.set(SITZUNGS_COOKIE, sitzung.wert, sitzungsCookieAngaben(url, sitzung.ablauf));

  // 303 und nicht 302: Danach folgt ein GET. Ohne das könnte ein Neuladen der Seite die
  // Anmeldung erneut abschicken — und der Browser fragte „Formular noch einmal senden?“.
  return new Response(null, { status: 303, headers: { location: weiter } });
};
