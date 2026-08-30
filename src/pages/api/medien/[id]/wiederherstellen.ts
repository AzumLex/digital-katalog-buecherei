/**
 * `POST /api/medien/<id>/wiederherstellen/` — zurück aus dem Papierkorb.
 *
 * Ohne Rumpf: Die Kennung steht in der Adresse, und alles Weitere — vor allem, in welche
 * Sparte der Eintrag gehört — steht im Eintrag selbst, der im Papierkorb liegt. Es gibt
 * hier nichts zu übergeben und deshalb auch nichts, was falsch übergeben werden könnte.
 *
 * `POST` und nicht `GET`, obwohl ein Link einfacher wäre: Eine Adresse, die beim bloßen
 * Aufrufen etwas verändert, wird von Vorschaubildern und Verlaufslisten aufgerufen, ohne
 * dass jemand geklickt hätte — dieselbe Überlegung wie bei `/api/abmelden/`.
 */
import type { APIRoute } from 'astro';
import { fehlerAntwort, jsonAntwort } from '../../../../lib/antworten';
import { PflegeFehler, stelleWiederHer } from '../../../../lib/pflege';

export const prerender = false;

export const POST: APIRoute = async ({ params }) => {
  try {
    const id = params.id?.trim();
    if (!id) {
      throw new PflegeFehler([
        'In der Adresse fehlt die Kennung des Eintrags. Bitte den Papierkorb neu laden.',
      ]);
    }

    return jsonAntwort(await stelleWiederHer(id));
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};
