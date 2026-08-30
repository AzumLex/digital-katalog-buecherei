/**
 * Der Schutzwall vor der Verwaltung.
 *
 * Eine einzige Stelle entscheidet, wer hinein darf — und zwar **bevor** irgendeine Seite
 * oder Route ausgeführt wird. Der Grund ist nicht Bequemlichkeit, sondern die Art, wie
 * solche Lücken entstehen: Prüfte jede Seite selbst, wäre der Schutz genau so lückenlos
 * wie die Aufmerksamkeit der Person, die die nächste Seite anlegt. Hier ist er es
 * unabhängig davon; wer eine neue Datei unter `/verwaltung/` oder `/api/` anlegt, bekommt
 * den Schutz, ohne eine Zeile dafür zu schreiben.
 *
 * **Auf den öffentlichen Katalog wirkt sich nichts davon aus.** Alle anderen Pfade gehen
 * unverändert durch. Während des Builds läuft diese Datei zwar für jede der 1058
 * statischen Seiten mit, trifft dort aber sofort auf `return next()`.
 */
import { defineMiddleware } from 'astro:middleware';
import { SITZUNGS_COOKIE, pruefeSitzung } from './lib/anmeldung';

/**
 * Die beiden Bereiche hinter dem Wall.
 *
 * `/api/` gehört dazu, obwohl dort kein Mensch hinklickt: Die schreibenden Routen aus
 * Paket 6 hängen an derselben GitHub-Berechtigung wie die Oberfläche. Eine Schnittstelle,
 * die ohne Anmeldung schreibt, wäre die offene Hintertür neben der verschlossenen Tür.
 */
const GESCHUETZT = ['/verwaltung', '/api'];

/**
 * Was auch ohne Anmeldung erreichbar sein muss.
 *
 * Sonst schickte der Wall die Anmeldeseite auf die Anmeldeseite — im Kreis, für immer.
 */
const OFFEN = ['/verwaltung/anmelden/', '/api/anmelden/'];

/** Liegt `pfad` in diesem Bereich? Mit und ohne abschließenden Schrägstrich. */
function liegtIn(pfad: string, bereich: string): boolean {
  return pfad === bereich || pfad.startsWith(`${bereich}/`);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const pfad = context.url.pathname;

  if (!GESCHUETZT.some((bereich) => liegtIn(pfad, bereich))) return next();

  if (!OFFEN.includes(pfad) && !pruefeSitzung(context.cookies.get(SITZUNGS_COOKIE)?.value)) {
    // Für die Schnittstelle eine Antwort, die ein `fetch` auswerten kann; für eine Seite
    // die Anmeldemaske. Eine Weiterleitung auf HTML wäre für einen Aufruf aus dem
    // Browser-Skript unbrauchbar — er bekäme statt eines Fehlers das Anmeldeformular
    // zurück und zeigte es womöglich als Ergebnis an.
    if (liegtIn(pfad, '/api')) {
      return new Response(
        JSON.stringify({
          fehler: 'Nicht angemeldet. Bitte die Verwaltung neu laden und anmelden.',
        }),
        { status: 401, headers: { 'content-type': 'application/json; charset=utf-8' } },
      );
    }

    // Der gewünschte Pfad wandert mit, damit man nach dem Anmelden dort landet, wo man
    // hinwollte — und nicht immer auf der Übersicht. Nur der Pfad, nie die vollständige
    // Adresse: Was damit erlaubt ist, entscheidet `/api/anmelden/` noch einmal selbst.
    const ziel = new URL('/verwaltung/anmelden/', context.url);
    if (pfad !== '/verwaltung/') ziel.searchParams.set('weiter', pfad);
    return context.redirect(`${ziel.pathname}${ziel.search}`);
  }

  const antwort = await next();

  // Zweiter Riegel gegen den Suchindex, zusätzlich zu `robots.txt` und der Angabe in
  // `vercel.json` (plan.md § 5). Er steht hier, weil er dann von unserem eigenen Code
  // kommt: Eine Kopfzeile, die die Plattform setzt, hängt an einer Plattform-Einstellung,
  // die beim nächsten Umzug oder Umbau still verschwinden kann. Diese hier nicht.
  antwort.headers.set('X-Robots-Tag', 'noindex, nofollow');

  return antwort;
});
