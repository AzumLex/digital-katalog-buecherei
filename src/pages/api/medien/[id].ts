/**
 * `PUT /api/medien/<id>/` — ändern, `DELETE /api/medien/<id>/` — in den Papierkorb.
 *
 * Beide Verben brauchen ein Skript im Browser; ein HTML-Formular kann nur `GET` und
 * `POST`. Das ist der Grund, warum die Verwaltung — anders als der Katalog — ohne
 * JavaScript nicht auskommt. Der Katalog selbst bleibt davon unberührt: Er ist statisch
 * und hat mit diesen Routen nichts zu tun.
 *
 * Die `fassung` ist der Schutz gegen den zweiten offenen Tab (plan.md § 5): Das Formular
 * hat sie beim Laden mitbekommen und gibt sie hier zurück. Hat sich die Datei
 * zwischenzeitlich geändert, wird nicht gespeichert, sondern erklärt.
 */
import type { APIRoute } from 'astro';
import { fehlerAntwort, jsonAntwort, liesJson } from '../../../lib/antworten';
import { aendere, loesche, PflegeFehler } from '../../../lib/pflege';
import { SPARTEN, type Sparte } from '../../../lib/daten';

export const prerender = false;

/** Die Kennung aus der Adresse — ohne sie kann keine der beiden Routen etwas tun. */
function kennung(params: Record<string, string | undefined>): string {
  const id = params.id?.trim();
  if (!id) {
    throw new PflegeFehler([
      'In der Adresse fehlt die Kennung des Eintrags. Bitte die Bestandsliste neu laden ' +
        'und den Titel dort noch einmal anklicken.',
    ]);
  }

  return id;
}

/**
 * Der Sparten-Hinweis: In welcher Sparte stand der Eintrag, als die Seite geladen wurde?
 *
 * Eine Abkürzung, keine Auskunft — `findeMedium` liest notfalls alles. Sie erspart im
 * Regelfall sechs Dateiabrufe, und zwar genau dann, wenn es zählt: beim Speichern, wo die
 * Person wartet.
 */
function hinweis(wert: unknown): Sparte | undefined {
  return typeof wert === 'string' && SPARTEN.includes(wert as Sparte)
    ? (wert as Sparte)
    : undefined;
}

/**
 * `PUT /api/medien/<id>/`
 *
 * Rumpf: `{ "medium": { … }, "fassung": "…", "sparte": "romane" }`. `medium` ist der
 * **vollständige** Eintrag und nicht nur das Geänderte: Nur so verschwindet ein Feld, das
 * jemand geleert hat, auch wirklich aus den Daten (siehe `eintragAendern` in
 * `bestand.ts`).
 */
export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const id = kennung(params);
    const rumpf = (await liesJson(request)) as {
      medium?: unknown;
      fassung?: unknown;
      sparte?: unknown;
    };

    const ergebnis = await aendere(id, rumpf?.medium, {
      fassung: typeof rumpf?.fassung === 'string' ? rumpf.fassung : undefined,
      hinweis: hinweis(rumpf?.sparte),
    });

    return jsonAntwort(ergebnis);
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};

/**
 * `DELETE /api/medien/<id>/?fassung=…&sparte=…`
 *
 * Die beiden Angaben stehen in der Adresse und nicht im Rumpf: Ein `DELETE` mit Rumpf ist
 * zwar erlaubt, wird aber von Zwischenstationen unterschiedlich behandelt — und für zwei
 * kurze Zeichenketten lohnt das Risiko nicht.
 *
 * Gelöscht wird in den Papierkorb, nie endgültig. Was das von „Status: ausgeschieden“
 * unterscheidet, steht auf der Seite, die diesen Knopf zeigt — nicht erst in der
 * Dokumentation (plan.md § 4.5).
 */
export const DELETE: APIRoute = async ({ params, url }) => {
  try {
    const id = kennung(params);

    const ergebnis = await loesche(id, {
      fassung: url.searchParams.get('fassung') ?? undefined,
      hinweis: hinweis(url.searchParams.get('sparte')),
    });

    return jsonAntwort(ergebnis);
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};
