/**
 * Die Antworten der Schnittstelle — eine Form für alle Routen.
 *
 * Vier Routen unter `/api/medien/` beantworten dieselben Fragen: Hat es geklappt? Wenn
 * nicht, warum, und was ist zu tun? Stünde das in jeder Route noch einmal, gäbe es vier
 * Formen derselben Antwort und das Skript im Browser müsste alle vier auseinanderhalten.
 *
 * Die Form ist immer dieselbe:
 *
 * ```json
 * { "fehler": ["…", "…"], "neuLadenNoetig": false }
 * ```
 *
 * `fehler` fehlt, wenn alles gut ging. Jede Zeile darin ist ein fertiger deutscher Satz,
 * der so angezeigt werden kann, wie er ist — die Zusage aus plan.md § 5: **nicht „401“**.
 * Der Statuscode steht daneben fürs Protokoll, nicht für die Anzeige.
 */
import { AblageFehler } from './github.ts';
import { PflegeFehler } from './pflege.ts';

/** Der Rumpf einer Fehlerantwort, so wie ihn das Skript im Browser erwartet. */
export interface Fehlerantwort {
  fehler: string[];
  /** Ein zweiter Stand ist im Weg — die Seite muss neu geladen werden. */
  neuLadenNoetig: boolean;
  /** Derselbe Knopf noch einmal kann klappen. */
  wiederholbar: boolean;
}

/** Eine Antwort mit JSON-Rumpf. */
export function jsonAntwort(daten: unknown, status = 200): Response {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Die Verwaltung zeigt Bestandsdaten. Nichts davon darf ein Zwischenspeicher
      // festhalten — weder der des Browsers noch einer auf dem Weg dorthin.
      'cache-control': 'no-store',
    },
  });
}

/**
 * Macht aus einem Fehler eine Antwort, die die Oberfläche zeigen kann.
 *
 * Die drei Fälle sind bewusst unterschieden:
 *
 * - **`PflegeFehler`** — die Eingabe ging nicht durch die Prüfung. 422, denn die Anfrage
 *   war formal in Ordnung, ihr Inhalt nicht.
 * - **`AblageFehler`** — das Speichern selbst ging schief. Der Statuscode kommt von dort,
 *   wo es schiefging; fehlt er, ist es die Ablage, die nicht mitspielt (502).
 * - **alles andere** — ein Programmfehler. Der Text davon geht **nicht** hinaus: Er ist
 *   auf Englisch, hilft niemandem und kann Interna nennen. Stattdessen ein Satz, der sagt,
 *   was zu tun ist. Ins Protokoll geschrieben wird er trotzdem, sonst ist er weg.
 */
export function fehlerAntwort(fehler: unknown): Response {
  if (fehler instanceof PflegeFehler) {
    return jsonAntwort(
      {
        fehler: fehler.zeilen,
        neuLadenNoetig: fehler.neuLadenNoetig,
        wiederholbar: false,
      } satisfies Fehlerantwort,
      fehler.neuLadenNoetig ? 409 : 422,
    );
  }

  if (fehler instanceof AblageFehler) {
    return jsonAntwort(
      {
        fehler: [fehler.message],
        neuLadenNoetig: fehler.neuLadenNoetig,
        wiederholbar: fehler.wiederholbar,
      } satisfies Fehlerantwort,
      fehler.neuLadenNoetig ? 409 : (fehler.status ?? 502),
    );
  }

  console.error('Unerwarteter Fehler in der Verwaltung:', fehler);

  return jsonAntwort(
    {
      fehler: [
        'Beim Speichern ist etwas schiefgegangen, das hier nicht vorgesehen war. Es ' +
          'wurde nichts geändert. Bitte noch einmal versuchen — und wenn es wieder ' +
          'nicht geht, bei der Person melden, die den Katalog betreut.',
      ],
      neuLadenNoetig: false,
      wiederholbar: true,
    } satisfies Fehlerantwort,
    500,
  );
}

/**
 * Liest den JSON-Rumpf einer Anfrage.
 *
 * Mit eigenem Fehler statt mit dem von `JSON.parse`: Dessen Text („Unexpected token …“)
 * stünde sonst im Meldungsbalken der Bücherei. Ankommen kann das nur, wenn im Browser
 * etwas schiefging — ein Grund mehr, den Satz an die Person zu richten und nicht an die
 * Maschine.
 */
export async function liesJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new PflegeFehler([
      'Die Angaben aus dem Formular sind unterwegs beschädigt worden. Bitte die Seite ' +
        'neu laden und die Eingabe noch einmal machen.',
    ]);
  }
}
