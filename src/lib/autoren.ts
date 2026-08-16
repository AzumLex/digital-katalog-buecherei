/**
 * Wo steht ein Autor in der Liste?
 *
 * Der Katalog hat keine eigenen Autorenseiten — „weitere Titel von …" führt deshalb
 * an die Stelle in der nach Autor sortierten Sparte, an der der Block dieses Autors
 * beginnt. Dafür muss zweierlei bekannt sein: auf welcher Seite dieser Block anfängt
 * und an welchem Eintrag der Anker sitzt.
 *
 * Beides wird hier einmal berechnet, damit Listenansicht und Detailseite sich nicht
 * widersprechen können.
 */
import { SPARTEN, medienDerSparte, type Medium, type Sparte } from './daten.ts';
import { autorAnzeige, autorSchluessel } from './anzeige.ts';
import { PRO_SEITE, STANDARD_SORTIERUNG, sortiere } from './sortierung.ts';

export interface Autorenblock {
  /** Aus Nach- und Vorname gebildeter Schlüssel, siehe autorSchluessel. */
  schluessel: string;
  /** Anzeigeform, z. B. „Alex Beer". */
  name: string;
  sparte: Sparte;
  /** Seite der Standardsortierung, auf der der Block beginnt (1-basiert). */
  seite: number;
  /** id des ersten Titels des Autors — dort wird der Anker gesetzt. */
  ersteId: string;
  /** Wie viele Titel dieses Autors in dieser Sparte stehen. */
  anzahl: number;
}

function indexBauen(): Map<string, Autorenblock> {
  const index = new Map<string, Autorenblock>();

  for (const sparte of SPARTEN) {
    const sortiert = sortiere(medienDerSparte(sparte), STANDARD_SORTIERUNG);

    sortiert.forEach((medium, position) => {
      const schluessel = autorSchluessel(medium);
      const name = autorAnzeige(medium);
      if (!schluessel || !name) return;

      const kennung = `${sparte}|${schluessel}`;
      const vorhanden = index.get(kennung);

      if (vorhanden) {
        vorhanden.anzahl += 1;
        return;
      }

      index.set(kennung, {
        schluessel,
        name,
        sparte,
        seite: Math.floor(position / PRO_SEITE) + 1,
        ersteId: medium.id,
        anzahl: 1,
      });
    });
  }

  return index;
}

const index = indexBauen();

/** Der Block, zu dem ein Medium gehört — oder undefined, wenn es keinen Autor hat. */
export function autorenblockVon(medium: Medium): Autorenblock | undefined {
  const schluessel = autorSchluessel(medium);
  if (!schluessel) return undefined;
  return index.get(`${medium.sparte}|${schluessel}`);
}

/**
 * Die ids, an denen in der nach Autor sortierten Liste ein Ankerpunkt sitzt,
 * jeweils mit dem Ankernamen.
 */
export function ankerIds(sparte: Sparte): ReadonlyMap<string, string> {
  const anker = new Map<string, string>();
  for (const block of index.values()) {
    if (block.sparte === sparte) anker.set(block.ersteId, block.schluessel);
  }
  return anker;
}
