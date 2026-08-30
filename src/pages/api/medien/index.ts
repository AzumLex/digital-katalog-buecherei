/**
 * `GET /api/medien/` — nachsehen, `POST /api/medien/` — anlegen.
 *
 * Die Route ist dünn und soll es bleiben: Sie liest Eingaben aus der Anfrage, ruft
 * `src/lib/pflege.ts` und macht aus dem Ergebnis eine Antwort. Was geprüft wird, in
 * welcher Reihenfolge und mit welcher Meldung, steht dort — sonst stünde es viermal da,
 * einmal je Route, und beim fünften Mal anders.
 *
 * Angemeldet sein muss man nicht hier, sondern in `src/middleware.ts`: Der Schutzwall
 * liegt vor `/api/` und `/verwaltung/` insgesamt. Eine Route, die sich selbst schützt,
 * ist genau so sicher wie die Aufmerksamkeit dessen, der die nächste anlegt.
 */
import type { APIRoute } from 'astro';
import { fehlerAntwort, jsonAntwort, liesJson } from '../../../lib/antworten';
import { blaettere, filtereMedien, findeMedium, legeAn, liesBestand } from '../../../lib/pflege';
import { SPARTEN, type Sparte } from '../../../lib/daten';

/** Serverrendering: Diese Route liest und schreibt das Repository. */
export const prerender = false;

/** Eine Sparte aus der Adresszeile — oder nichts, wenn dort etwas anderes stand. */
function spartenParameter(wert: string | null): Sparte | undefined {
  return wert && SPARTEN.includes(wert as Sparte) ? (wert as Sparte) : undefined;
}

/**
 * `GET /api/medien/`
 *
 * Zwei Fragen, eine Route:
 *
 * - `?id=rom-die-rote-frau` — **gibt es diesen Eintrag?** Das braucht das Formular unter
 *   `/verwaltung/neu/`, um noch vor dem Speichern zu sagen, dass eine Kennung schon
 *   vergeben ist (plan.md § 6: „Diese id gibt es schon“). Antwort ist der Eintrag selbst,
 *   damit die Meldung nennen kann, welcher Titel dahintersteckt.
 * - `?suche=…&sparte=…&seite=2` — **die Bestandsliste**, dieselbe, die
 *   `/verwaltung/bestand/` als Seite zeigt.
 *
 * Die Seite selbst ruft diese Route nicht auf: Sie holt sich dieselben Zahlen direkt aus
 * `pflege.ts` und kommt damit ohne JavaScript aus. Diese Route ist der Weg für alles,
 * was nicht die Seite ist.
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const id = url.searchParams.get('id');

    if (id) {
      const fund = await findeMedium(id, spartenParameter(url.searchParams.get('sparte')));
      return jsonAntwort(
        fund
          ? { gefunden: true, medium: fund.medium, sparte: fund.sparte, fassung: fund.fassung }
          : { gefunden: false },
      );
    }

    const sparte = spartenParameter(url.searchParams.get('sparte'));
    const sicht = await liesBestand(sparte ? [sparte] : undefined);
    const gefiltert = filtereMedien(sicht.medien, url.searchParams.get('suche') ?? '');
    const seite = blaettere(gefiltert, Number(url.searchParams.get('seite') ?? '1') || 1);

    return jsonAntwort({
      anzahl: gefiltert.length,
      nummer: seite.nummer,
      anzahlSeiten: seite.anzahlSeiten,
      medien: seite.eintraege,
    });
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};

/**
 * `POST /api/medien/` — einen neuen Eintrag anlegen.
 *
 * Der Rumpf ist `{ "medium": { … } }`. Ein eigenes Feld statt des Eintrags selbst, damit
 * später etwas danebenpassen kann, ohne dass es wie ein unbekanntes Schemafeld aussieht.
 *
 * 201 und nicht 200: Es ist etwas entstanden, das es vorher nicht gab.
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const rumpf = (await liesJson(request)) as { medium?: unknown };
    return jsonAntwort(await legeAn(rumpf?.medium), 201);
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};
