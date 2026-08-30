/**
 * Die ISBN — lesen, säubern, nachrechnen.
 *
 * Reine Rechnerei, ohne Netz und ohne Astro: Dieses Modul entscheidet, ob eine
 * Zeichenfolge überhaupt eine ISBN sein **kann**. Erst wenn es ja sagt, wird ein Dienst
 * gefragt (`isbndienste.ts`). Die Reihenfolge ist die aus plan.md § 4.6 und hat einen
 * Grund: NOTIZEN.md § 3 listet fünfzehn Einträge, deren ISBN im Word-Dokument schon
 * kaputt war. Zu jeder davon einen fremden Server zu fragen, hieße auf eine Antwort zu
 * warten, die es nicht geben kann — und am Ende „nichts gefunden“ zu melden, wo „die
 * Prüfziffer stimmt nicht“ die Wahrheit ist.
 *
 * **Die Bindestriche sind hier das eigentliche Thema.** NOTIZEN.md § 13 hält den Fall
 * fest, der diesen Bestand einen Eintrag gekostet hat: In `rom-komarek-blumen-fuer-polt`
 * stand die ISBN mit einem **geschützten Bindestrich** (U+2011) statt eines gewöhnlichen.
 * Das Muster des Imports erkannte sie nicht, und alles ab dem Verlagsnamen rutschte in
 * ein einziges Feld. Die ISBN selbst ist tadellos — sie war nur anders geschrieben. Wer
 * eine Zeile aus Word in dieses Formular kopiert, bringt genau dieses Zeichen mit; hier
 * wird es zusammen mit Halbgeviert- und Geviertstrich abgefangen, bevor es Schaden
 * anrichtet.
 *
 * Das Modul kennt weder Astro noch das Dateisystem noch die Katalogdaten. Nur so lässt es
 * sich sowohl aus einer Serverroute als auch aus `scripts/isbntest.mjs` und aus dem
 * Browser aufrufen.
 */

/* ------------------------------------------------------------------ *
 * Schreibweise vereinheitlichen
 * ------------------------------------------------------------------ */

/**
 * Alles, was wie ein Bindestrich aussieht, aber keiner ist.
 *
 * U+2010 Hyphen, U+2011 geschützter Bindestrich (der Fall aus NOTIZEN.md § 13),
 * U+2012 Ziffernstrich, U+2013 Halbgeviertstrich, U+2014 Geviertstrich, U+2015
 * Horizontalstrich, U+2212 Minuszeichen. Textverarbeitungen setzen sie beim Tippen von
 * selbst ein; auf dem Buchrücken steht immer nur der gewöhnliche Bindestrich.
 */
const BINDESTRICHE = /[‐‑‒–—―−]/g;

/**
 * Ersetzt alle Bindestrich-Varianten durch den gewöhnlichen Bindestrich.
 *
 * Für Text, der als Text erhalten bleiben soll — `isbn_formatiert` etwa hält die
 * Schreibweise der Quelle fest, aber eben mit einem Bindestrich, den jede Suche und jedes
 * spätere Bibliothekssystem wiedererkennt.
 */
export function vereinheitlicheBindestriche(text: string): string {
  return text.replace(BINDESTRICHE, '-');
}

/**
 * Macht aus einer beliebigen Schreibweise die reinen Zeichen einer ISBN.
 *
 * Bindestriche jeder Art, Leerzeichen und ein vorangestelltes „ISBN“ fallen weg; das X
 * der ISBN-10 bleibt und wird groß geschrieben. Was übrig bleibt, ist noch **keine**
 * gültige ISBN — nur der Rohstoff für `istIsbn`.
 */
export function normalisiereIsbn(roh: string): string {
  return vereinheitlicheBindestriche(roh)
    .toUpperCase()
    .replace(/[^0-9X]/g, '');
}

/* ------------------------------------------------------------------ *
 * Prüfziffer
 * ------------------------------------------------------------------ */

/**
 * ISBN-10: Die Ziffern werden mit 10 bis 1 gewichtet, die Summe muss durch 11 teilbar
 * sein. Die letzte Stelle darf ein X sein — sie steht für den Wert 10, denn eine Zahl
 * zwischen 0 und 10 lässt sich mit einer Ziffer allein nicht schreiben.
 */
function pruefzifferIsbn10(ziffern: string): boolean {
  let summe = 0;

  for (let stelle = 0; stelle < 10; stelle++) {
    const zeichen = ziffern[stelle]!;

    // Das X gibt es nur an letzter Stelle. Steht es mittendrin, ist die Zeichenfolge
    // keine ISBN — und nicht etwa eine mit falscher Prüfziffer.
    if (zeichen === 'X') {
      if (stelle !== 9) return false;
      summe += 10 * (10 - stelle);
      continue;
    }

    summe += Number(zeichen) * (10 - stelle);
  }

  return summe % 11 === 0;
}

/**
 * ISBN-13: abwechselnd mit 1 und 3 gewichtet, die Summe muss durch 10 teilbar sein.
 * Dieselbe Rechnung wie bei jedem EAN-13-Strichcode — die ISBN-13 **ist** einer.
 */
function pruefzifferIsbn13(ziffern: string): boolean {
  if (/[^0-9]/.test(ziffern)) return false;

  let summe = 0;
  for (let stelle = 0; stelle < 13; stelle++) {
    summe += Number(ziffern[stelle]) * (stelle % 2 === 0 ? 1 : 3);
  }

  return summe % 10 === 0;
}

/**
 * Ist das eine gültige ISBN — in irgendeiner Schreibweise?
 *
 * Zehn oder dreizehn Zeichen, richtige Prüfziffer. Mehr wird nicht behauptet: Eine
 * gültige Prüfziffer heißt nicht, dass es das Buch gibt. Sie heißt nur, dass sich beim
 * Abtippen keine Ziffer verlesen hat — und genau das ist der Fehler, den die
 * fünfzehn Einträge aus NOTIZEN.md § 3 zeigen.
 */
export function istIsbn(roh: string): boolean {
  const ziffern = normalisiereIsbn(roh);

  if (ziffern.length === 10) return pruefzifferIsbn10(ziffern);
  if (ziffern.length === 13) return pruefzifferIsbn13(ziffern);

  return false;
}

/* ------------------------------------------------------------------ *
 * Umrechnen und vergleichen
 * ------------------------------------------------------------------ */

/**
 * Rechnet eine ISBN-10 in die gleichwertige ISBN-13 um; eine ISBN-13 bleibt, wie sie ist.
 *
 * Gebraucht an zwei Stellen: Die Frage „steht das schon im Katalog?“ muss auch dann ja
 * sagen, wenn dasselbe Buch einmal als ISBN-10 und einmal als ISBN-13 erfasst ist — im
 * Bestand stehen 29 Titel mit ISBN-10. Und die Dienste finden mit der dreizehnstelligen
 * Form zuverlässiger etwas.
 *
 * `null` bei allem, was keine gültige ISBN ist: Eine umgerechnete Zahl aus einer kaputten
 * Vorlage wäre eine erfundene Auskunft.
 */
export function alsIsbn13(roh: string): string | null {
  if (!istIsbn(roh)) return null;

  const ziffern = normalisiereIsbn(roh);
  if (ziffern.length === 13) return ziffern;

  // Der Buchhandels-Präfix 978 davor, die alte Prüfziffer weg — und die neue nach der
  // EAN-Regel gerechnet.
  const rumpf = `978${ziffern.slice(0, 9)}`;
  let summe = 0;
  for (let stelle = 0; stelle < 12; stelle++) {
    summe += Number(rumpf[stelle]) * (stelle % 2 === 0 ? 1 : 3);
  }

  return `${rumpf}${(10 - (summe % 10)) % 10}`;
}

/**
 * Meinen zwei Schreibweisen dieselbe ISBN?
 *
 * Über die dreizehnstellige Form, damit `3-257-06767-9` und `9783257067675` als dasselbe
 * Buch gelten. Ungültige Angaben sind nie gleich — auch nicht zwei gleich kaputte:
 * Was keine ISBN ist, taugt nicht als Schlüssel.
 */
export function gleicheIsbn(eine: string | undefined, andere: string | undefined): boolean {
  if (!eine || !andere) return false;

  const links = alsIsbn13(eine);
  return links !== null && links === alsIsbn13(andere);
}
