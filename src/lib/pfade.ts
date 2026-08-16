/**
 * Alle URLs des Katalogs an einer Stelle.
 *
 * Wer das Adressschema ändern will, ändert es hier — `getStaticPaths` in
 * `src/pages/sparte/[...pfad].astro` baut seine Pfade aus derselben Funktion,
 * Links und erzeugte Seiten können also nicht auseinanderlaufen.
 *
 * Schema:
 *   /sparte/romane/                 Sparte, Standardsortierung, Seite 1
 *   /sparte/romane/seite-2/         Sparte, Standardsortierung, Seite 2
 *   /sparte/romane/titel/           Sparte, nach Titel sortiert, Seite 1
 *   /sparte/romane/titel/seite-2/   Sparte, nach Titel sortiert, Seite 2
 *   /titel/rom-beer-die-rote-frau-6761/
 */
import type { Sparte } from './daten.ts';
import { STANDARD_SORTIERUNG, type Sortierung } from './sortierung.ts';

/** Die Pfadsegmente einer Listenansicht, ohne führendes `sparte/`. */
export function spartenSegmente(
  sparte: Sparte,
  sortierung: Sortierung = STANDARD_SORTIERUNG,
  seite = 1,
): string[] {
  const teile: string[] = [sparte];
  if (sortierung !== STANDARD_SORTIERUNG) teile.push(sortierung);
  if (seite > 1) teile.push(`seite-${seite}`);
  return teile;
}

export function spartenPfad(
  sparte: Sparte,
  sortierung: Sortierung = STANDARD_SORTIERUNG,
  seite = 1,
): string {
  return `/sparte/${spartenSegmente(sparte, sortierung, seite).join('/')}/`;
}

export function titelPfad(id: string): string {
  return `/titel/${id}/`;
}

/**
 * Ankername für den Block eines Autors in der nach Autor sortierten Liste.
 * Schlüssel ist der vollständige Name, nicht nur der Nachname — sonst würde
 * „weitere Titel von Alex Beer" bei Hans de Beer landen.
 */
export function autorAnker(schluessel: string): string {
  return `autor-${schluessel}`;
}
