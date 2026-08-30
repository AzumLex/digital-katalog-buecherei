/**
 * Der Papierkorb im Browser: ein Knopf je Zeile, „Wiederherstellen“.
 *
 * Mehr ist es nicht — und das ist der Grund, warum diese Datei nicht im
 * Formularskript steht: Sie wird nur auf einer einzigen Seite geladen und hätte dort
 * nichts von dem zu tun, was ein Formular ausmacht.
 */
import { fehlerzeilen, merkeMeldung, zeigeGemerkteMeldung, zeigeMeldung } from './meldung.ts';

export function startePapierkorb(): void {
  const balken = document.querySelector<HTMLElement>('#meldung');
  zeigeGemerkteMeldung(balken);

  const knoepfe = document.querySelectorAll<HTMLButtonElement>('button[data-wiederherstellen]');

  for (const knopf of knoepfe) {
    knopf.addEventListener('click', async () => {
      const id = knopf.dataset.wiederherstellen ?? '';
      if (!id) return;

      knopf.disabled = true;
      const beschriftung = knopf.textContent;
      knopf.textContent = 'Wird zurückgeholt …';

      try {
        const antwort = await fetch(
          `/api/medien/${encodeURIComponent(id)}/wiederherstellen/`,
          { method: 'POST' },
        );
        const daten: unknown = await antwort.json().catch(() => null);

        if (!antwort.ok) {
          if (balken) zeigeMeldung(balken, fehlerzeilen(daten), 'schlecht');
          knopf.disabled = false;
          knopf.textContent = beschriftung;
          return;
        }

        // Neu laden statt die Zeile im Browser zu entfernen: Der Papierkorb hat danach
        // eine neue Fassung, und die Liste soll zeigen, was wirklich in der Datei steht —
        // nicht, was dieses Skript für wahrscheinlich hält.
        merkeMeldung((daten as { meldung: string }).meldung);
        window.location.reload();
      } catch {
        if (balken) {
          zeigeMeldung(
            balken,
            [
              'Die Verbindung ist abgebrochen. Ob der Eintrag zurückgeholt wurde, lässt ' +
                'sich von hier aus nicht sagen — bitte die Seite neu laden und nachsehen.',
            ],
            'schlecht',
          );
        }
        knopf.disabled = false;
        knopf.textContent = beschriftung;
      }
    });
  }
}
