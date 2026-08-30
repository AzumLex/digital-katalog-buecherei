/**
 * `POST /api/abmelden/` — Sitzungscookie löschen.
 *
 * Nur `POST`, obwohl ein Link einfacher wäre: Eine Adresse, die per `GET` abmeldet, wird
 * von Vorschaubildern, Verlaufslisten und mitlesenden Erweiterungen aufgerufen, ohne
 * dass jemand geklickt hätte — und die Person steht ohne Grund wieder am Anmeldeformular.
 * Deshalb ist der Abmeldeknopf ein kleines Formular.
 */
import type { APIRoute } from 'astro';
import { SITZUNGS_COOKIE, sitzungsCookieAngaben } from '../../lib/anmeldung';

export const prerender = false;

export const POST: APIRoute = ({ cookies, url }) => {
  // Mit denselben Angaben löschen, mit denen gesetzt wurde: Ein Browser entfernt ein
  // Cookie nur, wenn Pfad und die übrigen Angaben übereinstimmen. Weicht auch nur der
  // Pfad ab, bleibt die Sitzung bestehen und das Abmelden wirkt nur so.
  cookies.delete(SITZUNGS_COOKIE, sitzungsCookieAngaben(url));

  return new Response(null, {
    status: 303,
    headers: { location: '/verwaltung/anmelden/?abgemeldet=1' },
  });
};
