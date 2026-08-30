/**
 * `GET /api/export/?format=csv|json&sparte=<sparte|alle>` — der Bestand zum Herunterladen.
 *
 * Die Route liest **dieselben Dateien wie die Bestandsliste** (plan.md § 4.7): kein
 * eigener Weg zu den Daten, keine zweite Vorstellung davon, was der Bestand ist. Was
 * daraus wird, entscheidet `src/lib/export.ts`; hier steht nur, wie die Datei zum Browser
 * kommt.
 *
 * **Der Weg ist ein gewöhnlicher Link.** Deshalb kommt der Download ohne eine Zeile
 * JavaScript aus — die Seite `/verwaltung/export/` ist ein Formular mit `method="get"`,
 * und der Browser macht daraus die Adresse, die hier ankommt. Das ist auch der Grund für
 * die Fallunterscheidung beim Fehler: Wer über einen Link kommt, sieht eine Seite und
 * keine geschweiften Klammern.
 */
import type { APIRoute } from 'astro';
import { fehlerAntwort } from '../../lib/antworten';
import { liesBestand } from '../../lib/pflege';
import { ALLE, dateiname, zuCsv, zuJson } from '../../lib/export';
import { heutigesDatum } from '../../lib/bestand';
import { SPARTEN, type Sparte } from '../../lib/daten';

/** Serverrendering: Die Route liest den Bestand aus der Ablage. */
export const prerender = false;

export const GET: APIRoute = async ({ url, request }) => {
  const gewaehlt = url.searchParams.get('sparte');
  const sparte: Sparte | undefined = SPARTEN.includes(gewaehlt as Sparte)
    ? (gewaehlt as Sparte)
    : undefined;

  // CSV ist die Voreinstellung: Sie ist die Fassung für den täglichen Gebrauch, JSON die
  // für den späteren Umzug. Wer nichts angibt, will fast immer die erste.
  const alsJson = url.searchParams.get('format') === 'json';

  try {
    const sicht = await liesBestand(sparte ? [sparte] : undefined);

    const inhalt = alsJson
      ? zuJson([...sicht.dateien.values()].map((eintrag) => eintrag.datei))
      : zuCsv(sicht.medien);

    return new Response(inhalt, {
      headers: {
        'content-type': alsJson
          ? 'application/json; charset=utf-8'
          : 'text/csv; charset=utf-8',
        // `attachment` macht aus der Antwort einen Download statt einer angezeigten Seite.
        // Der Name ist der aus plan.md § 8; er enthält keine Zeichen, die in
        // Anführungszeichen erklärt werden müssten.
        'content-disposition': `attachment; filename="${dateiname(
          sparte ?? ALLE,
          heutigesDatum(),
          alsJson ? 'json' : 'csv',
        )}"`,
        // Ein Bestand von gestern wäre beim Export schlimmer als eine Wartezeit.
        'cache-control': 'no-store',
      },
    });
  } catch (fehler) {
    // Für einen Browser eine Seite, für alles andere die übliche JSON-Antwort. Der
    // Unterschied ist nicht Kosmetik: Ein Download, der als Antwort `{"fehler":[…]}`
    // anzeigt, sieht kaputt aus — der Satz darin steht auf der Exportseite besser
    // aufgehoben, und dorthin führt die Weiterleitung.
    if (!request.headers.get('accept')?.includes('text/html')) return fehlerAntwort(fehler);

    console.error('Export fehlgeschlagen:', fehler);
    return new Response(null, {
      status: 303,
      headers: { location: '/verwaltung/export/?fehler=1' },
    });
  }
};
