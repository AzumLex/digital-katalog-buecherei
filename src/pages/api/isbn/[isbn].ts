/**
 * `GET /api/isbn/<isbn>/` — was über dieses Buch bekannt ist.
 *
 * Die Route **füllt das Formular, sie speichert nicht** (plan.md § 4.6). Sie gibt einen
 * Vorschlag zurück; ob er stimmt, entscheidet die Bücherei, und gespeichert wird erst
 * über `POST /api/medien/`.
 *
 * Die Reihenfolge ist die aus plan.md § 4.6 und in jedem Schritt begründet:
 *
 * 1. **Prüfziffer rechnen** — vor jeder Anfrage nach außen. Zu einer ISBN, die es nicht
 *    geben kann, gibt es auch keine Antwort; „nichts gefunden“ wäre hier die falsche
 *    Auskunft, wo „eine Ziffer stimmt nicht“ die richtige ist.
 * 2. **Steht das schon im Katalog?** — der Fall aus NOTIZEN.md § 2, abgefangen an der
 *    Stelle, an der er entsteht. Wer das Buch ein zweites Mal in die Hand nimmt, soll es
 *    erfahren, **bevor** ein zweiter Datensatz existiert.
 * 3. **Erst dann die Dienste fragen.** Das ist der einzige Schritt, der einen fremden
 *    Server bemüht — und der einzige, der schiefgehen kann, ohne dass jemand etwas falsch
 *    gemacht hat.
 *
 * Nebenbei fällt der **id-Vorschlag** ab: Für Schritt 2 wird der Bestand ohnehin gelesen,
 * und damit sind alle vergebenen Kennungen bekannt. Eine eigene Route dafür hieße, dieselbe
 * Megabyte-Datei ein zweites Mal zu holen.
 */
import type { APIRoute } from 'astro';
import { fehlerAntwort, jsonAntwort } from '../../../lib/antworten';
import { PflegeFehler, liesBestand } from '../../../lib/pflege';
import {
  alsIsbn13,
  gleicheIsbn,
  istIsbn,
  normalisiereIsbn,
  vereinheitlicheBindestriche,
} from '../../../lib/isbn';
import { holeAngaben } from '../../../lib/isbndienste';
import { schlageKennungVor } from '../../../lib/kennung';
import { SPARTEN, spartenUebersicht, type Sparte } from '../../../lib/daten';

/** Serverrendering: Diese Route liest das Repository und fragt fremde Dienste. */
export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  try {
    const eingetippt = vereinheitlicheBindestriche((params.isbn ?? '').trim());
    const ziffern = normalisiereIsbn(eingetippt);

    if (!istIsbn(ziffern)) {
      throw new PflegeFehler([
        'Die Prüfziffer stimmt nicht — bitte die Ziffern noch einmal mit dem Buch ' +
          'vergleichen. Die ISBN steht meist auch im Impressum auf einer der ersten ' +
          'Seiten. Stimmt sie genau so, wie sie im Buch abgedruckt ist, tragen Sie sie ' +
          'bitte von Hand unter „ISBN mit Bindestrichen“ ein und lassen „ISBN, nur ' +
          'Ziffern“ leer — dann geht die Angabe nicht verloren.',
      ]);
    }

    // Ab hier wird mit der dreizehnstelligen Form gearbeitet: Die Dienste finden damit
    // zuverlässiger etwas, und im Katalog steht sie bei 762 der 791 Titel mit ISBN.
    const isbn = alsIsbn13(ziffern)!;

    /* -- Schritt 2: Steht das schon im Katalog? ---------------------- */

    const sicht = await liesBestand();
    const vorhanden = sicht.medien.find((medium) => gleicheIsbn(medium.isbn, isbn));

    if (vorhanden) {
      const bezeichnung =
        spartenUebersicht.find((eintrag) => eintrag.sparte === vorhanden.sparte)?.bezeichnung ??
        vorhanden.sparte;

      return jsonAntwort({
        isbn,
        imBestand: {
          id: vorhanden.id,
          titel: vorhanden.titel,
          sparte: vorhanden.sparte,
          bestand: vorhanden.bestand ?? 1,
        },
        meldung:
          `Steht schon im Katalog: „${vorhanden.titel}“ (${bezeichnung}). Ist es ein ` +
          'zweites Exemplar? Dann bitte keinen neuen Eintrag anlegen, sondern beim ' +
          'vorhandenen „Exemplare“ erhöhen — dafür ist das Feld da.',
      });
    }

    /* -- Schritt 3: Die Dienste fragen ------------------------------- */

    const { herkunft, angaben, gestoert } = await holeAngaben(isbn);

    if (!angaben) {
      return jsonAntwort({
        isbn,
        herkunft: null,
        // Kein Fehler-Statuscode: Die Anfrage war in Ordnung, die Antwort lautet nur
        // „nichts bekannt". Das ist bei älteren und bei kleinen Verlagen der Normalfall
        // und kein Grund, eine Fehlermeldung zu zeigen.
        meldung: gestoert
          ? 'Zu dieser ISBN kam keine Antwort — mindestens ein Dienst hat gerade nicht ' +
            'geantwortet. Manchmal hilft ein zweiter Versuch; sonst tragen Sie die ' +
            'Angaben bitte von Hand ein. Es fehlt dadurch nichts, was der Katalog später ' +
            'nicht auch hätte.'
          : 'Zu dieser ISBN ist bei Google Books und OpenLibrary nichts verzeichnet. Das ' +
            'kommt bei älteren Büchern und kleinen Verlagen vor — bitte die Angaben von ' +
            'Hand eintragen.',
      });
    }

    /* -- Die Antwort zusammenstellen --------------------------------- */

    const gewaehlt = url.searchParams.get('sparte');
    const sparte: Sparte | undefined = SPARTEN.includes(gewaehlt as Sparte)
      ? (gewaehlt as Sparte)
      : undefined;

    return jsonAntwort({
      isbn,
      herkunft,
      medium: {
        ...angaben,
        isbn,
        // Die Schreibweise mit Bindestrichen kommt nur mit, wenn sie mehr sagt als die
        // reinen Ziffern. Sonst stünde dieselbe Zahl zweimal in den Daten — genau die
        // Sorte doppelte Angabe, die NOTIZEN.md § 6 bemängelt.
        isbn_formatiert: eingetippt !== isbn ? eingetippt : undefined,
      },
      // Ohne gewählte Sparte kein Vorschlag: Das Kürzel am Anfang der Kennung hängt daran,
      // und ein geratenes wäre falsch, sobald jemand etwas anderes als einen Roman anlegt.
      kennung: sparte
        ? schlageKennungVor(
            {
              sparte,
              titel: angaben.titel,
              autor_nachname: angaben.autor_nachname,
              isbn,
            },
            sicht.medien.map((medium) => medium.id),
          )
        : undefined,
      meldung:
        `Angaben von ${herkunft}. Bitte durchsehen und berichtigen — geholte Angaben ` +
        'sind Vorschläge, keine Wahrheit. Gespeichert wird nichts, bevor Sie unten auf ' +
        '„Speichern“ drücken.',
    });
  } catch (fehler) {
    return fehlerAntwort(fehler);
  }
};
