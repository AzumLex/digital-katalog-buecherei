/**
 * Der Meldungsbalken der Verwaltung — eine Stelle, an der Sätze ankommen.
 *
 * Vier Seiten zeigen Rückmeldungen: Bestand, Neu, Bearbeiten, Papierkorb. Damit sie
 * gleich aussehen und gleich vorgelesen werden, steht das Anzeigen hier und nicht viermal
 * daneben.
 *
 * **Warum die Sätze nicht durch die Adresszeile wandern:** Nach dem Speichern wird die
 * Seite neu geladen — sonst wäre die Fassungskennung im Formular veraltet und der nächste
 * Klick auf „Speichern“ liefe in ein „Bitte neu laden“. Der Satz muss diesen Wechsel also
 * überleben. Über `?meldung=…` ginge das, aber dann könnte ein zugeschickter Link der
 * Bücherei einen beliebigen Text unterschieben, der aussieht, als käme er vom Katalog —
 * dieselbe Überlegung wie in `/verwaltung/anmelden/`. Der Sitzungsspeicher des Browsers
 * kann das nicht: Dort steht nur, was diese Seite selbst hineingeschrieben hat, und beim
 * Schließen des Tabs ist es weg.
 */

/** Der Schlüssel im Sitzungsspeicher. Ein einziger — es gibt immer nur eine Meldung. */
const SPEICHER = 'verwaltung-meldung';

export type Meldungsart = 'gut' | 'schlecht';

/** Zeigt eine oder mehrere Zeilen im Meldungsbalken an. */
export function zeigeMeldung(
  balken: HTMLElement,
  zeilen: string[],
  art: Meldungsart = 'gut',
): void {
  balken.textContent = '';
  balken.classList.toggle('schlecht', art === 'schlecht');

  // Eine Zeile wird ein Absatz, mehrere werden eine Liste: Aus der Prüfung kommen gern
  // drei Beanstandungen auf einmal, und die aneinandergereiht in einem Absatz sind
  // dieselbe Information in unlesbar.
  if (zeilen.length === 1) {
    const absatz = document.createElement('p');
    absatz.textContent = zeilen[0];
    balken.append(absatz);
  } else {
    const liste = document.createElement('ul');
    for (const zeile of zeilen) {
      const punkt = document.createElement('li');
      punkt.textContent = zeile;
      liste.append(punkt);
    }
    balken.append(liste);
  }

  // Nach oben, wo die Meldung steht — bei einem langen Formular steht sie sonst außerhalb
  // des Bildes und die Person sieht nur, dass nichts passiert.
  balken.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/** Merkt sich einen Satz für die Seite, die als Nächstes geladen wird. */
export function merkeMeldung(text: string, art: Meldungsart = 'gut'): void {
  try {
    sessionStorage.setItem(SPEICHER, JSON.stringify({ text, art }));
  } catch {
    // Ein Browser, der den Sitzungsspeicher verweigert (privater Modus, strenge
    // Einstellungen), ist kein Grund, das Speichern abzubrechen — es fehlt dann nur die
    // Bestätigung danach. Die Änderung selbst ist längst durch.
  }
}

/** Zeigt den gemerkten Satz — und vergisst ihn, damit er nicht beim Blättern wiederkehrt. */
export function zeigeGemerkteMeldung(balken: HTMLElement | null): void {
  if (!balken) return;

  let roh: string | null = null;
  try {
    roh = sessionStorage.getItem(SPEICHER);
    sessionStorage.removeItem(SPEICHER);
  } catch {
    return;
  }

  if (!roh) return;

  try {
    const { text, art } = JSON.parse(roh) as { text: string; art: Meldungsart };
    if (text) zeigeMeldung(balken, [text], art);
  } catch {
    // Kaputter Inhalt im Sitzungsspeicher: übergehen. Eine Fehlermeldung darüber, dass
    // eine Erfolgsmeldung nicht angezeigt werden konnte, hilft niemandem.
  }
}

/**
 * Die Fehlerzeilen einer Antwort der Schnittstelle.
 *
 * `/api/medien/` schickt eine Liste, der Schutzwall in `middleware.ts` bei fehlender
 * Anmeldung einen einzelnen Satz. Beides muss hier ankommen, sonst steht bei einer
 * abgelaufenen Sitzung „undefined“ auf dem Bildschirm.
 */
export function fehlerzeilen(daten: unknown): string[] {
  const fehler = (daten as { fehler?: unknown } | null)?.fehler;

  if (Array.isArray(fehler) && fehler.length > 0) return fehler.map(String);
  if (typeof fehler === 'string' && fehler !== '') return [fehler];

  return [
    'Das hat nicht geklappt, und die Gegenstelle sagt nicht warum. Bitte die Seite neu ' +
      'laden und es noch einmal versuchen.',
  ];
}
