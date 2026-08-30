/**
 * Der Vorschlag für die `id` — die Regel aus dem README, als Code.
 *
 * Im README steht sie unter „Die Regeln für `id`“ als Anleitung für Menschen, die eine
 * JSON-Datei von Hand bearbeiten: Kürzel, Nachname, Titel, die letzten vier Ziffern der
 * ISBN. Genau dieselbe Regel steht in `scripts/import/01_romane_parsen.py`, mit der die
 * 987 vorhandenen ids entstanden sind. Hier steht sie ein drittes Mal — aber dafür an der
 * Stelle, an der ab jetzt jede neue id entsteht, und `npm run isbntest` rechnet sie gegen
 * die vorhandenen Daten nach: Was diese Datei vorschlägt, muss für jeden Eintrag mit ISBN
 * genau die id ergeben, die er heute schon trägt. Läuft die Regel je auseinander, sagt es
 * der Testlauf und nicht der erste schiefe Eintrag.
 *
 * **`slug()` kommt aus `anzeige.ts`** und wird nicht nachgebaut. Es ist dieselbe Funktion,
 * die die Anker der Autorenblöcke erzeugt: Kleinbuchstaben, Umlaute ausgeschrieben, alles
 * andere zu Bindestrichen. Eine zweite Umschrift hier hieße, dass „Müller“ an einer Stelle
 * `mueller` und an der anderen `muller` würde.
 *
 * Das Modul rechnet nur. Es kennt weder Astro noch die Ablage — es bekommt die Angaben und
 * die Liste der schon vergebenen Kennungen und gibt eine Zeichenfolge zurück. Deshalb
 * läuft es im Browser (Vorschlag beim Tippen) genauso wie in der Serverroute (Vorschlag
 * nach dem ISBN-Abruf, dort gegen den echten Bestand geprüft).
 */
import { slug } from './anzeige.ts';
import { normalisiereIsbn } from './isbn.ts';
import type { Medium, Sparte } from './daten.ts';

/**
 * Das Kürzel je Sparte — die Liste aus dem README.
 *
 * Sie lässt sich nicht aus dem Schema ableiten: Dort stehen die Sparten, aber nicht ihre
 * Abkürzungen, und `kinderbuecher` → `kib` ist eine Setzung, keine Rechnung (die ersten
 * drei Buchstaben wären `kin`, und die hätte `kinder-sachbuecher` genauso). Der
 * Zusammenhang ist der Grund, warum diese Zuordnung überhaupt existiert: Am Anfang jeder
 * Kennung soll man sehen, worum es geht.
 *
 * `Record<Sparte, string>` und nicht `Record<string, string>`: Kommt im Schema eine Sparte
 * dazu, ohne dass sie hier ein Kürzel bekommt, sagt es der Typprüfer — nicht der Benutzer.
 */
export const SPARTENKUERZEL: Record<Sparte, string> = {
  romane: 'rom',
  sachbuecher: 'sac',
  kinderbuecher: 'kib',
  'kinder-sachbuecher': 'kis',
  tonies: 'ton',
  spiele: 'spi',
  cds: 'cds',
};

/**
 * Wie lang der mittlere Teil höchstens werden darf.
 *
 * 52 Zeichen, wie im Importskript. Der längste Titel im Bestand ist 105 Zeichen lang;
 * ungekürzt entstünde daraus eine Kennung, die in keine Tabellenspalte und in keine
 * lesbare Adresse passt. Die Zahl ist deshalb Teil der Regel und nicht eine Grenze, die
 * sich beiläufig ändern ließe: Sie steht in allen 987 vorhandenen ids drin.
 */
const STAMM_MAX = 52;

/** Die Angaben, aus denen sich eine Kennung bilden lässt. */
export type Kennungsangaben = Pick<Medium, 'sparte'> &
  Partial<Pick<Medium, 'titel' | 'autor_nachname' | 'reihe' | 'isbn'>>;

/**
 * Der Name, unter dem der Titel einsortiert wird — für die Kennung derselbe wie im Regal.
 *
 * Bei Büchern der Nachname des Autors. Bei Tonies gibt es oft keinen: 121 der 181 haben
 * keinen Autor, dort steht die Reihe („Paw Patrol“) an dieser Stelle, und genau so hat es
 * auch der Import gemacht. Fehlt beides, trägt der Titel die Kennung allein.
 */
function ordnungsteil(angaben: Kennungsangaben): string {
  return angaben.autor_nachname ?? angaben.reihe ?? '';
}

/**
 * Der Vorschlag ohne Rücksicht auf schon Vergebenes.
 *
 * Getrennt von `schlageKennungVor`, weil beides getrennt gebraucht wird: Der Browser kennt
 * die vergebenen Kennungen nicht und schlägt trotzdem etwas vor; die Serverroute kennt sie
 * und hängt bei Bedarf ein Suffix an.
 *
 * **Ohne ISBN entfällt der Zahlenteil.** Das ist keine Notlösung, sondern die Schreibweise
 * der 181 Tonies: `ton-paw-patrol-die-siegertrophaee`. Die vier Ziffern sind dazu da, zwei
 * gleichnamige Titel auseinanderzuhalten — wo es sie nicht gibt, erledigt das der
 * Zähler unten.
 */
export function kennungsvorschlag(angaben: Kennungsangaben): string {
  const kuerzel = SPARTENKUERZEL[angaben.sparte];
  const stamm = slug(`${ordnungsteil(angaben)} ${angaben.titel ?? ''}`)
    .slice(0, STAMM_MAX)
    // Der harte Schnitt kann mitten in einem Wort landen — das tut er in den vorhandenen
    // Daten auch („…-sollte-meins-s-1665“). Er darf aber nicht auf einem Bindestrich
    // enden, sonst stünden am Ende zwei nebeneinander.
    .replace(/-+$/, '');

  const ziffern = angaben.isbn ? normalisiereIsbn(angaben.isbn).slice(-4) : '';

  return [kuerzel, stamm, ziffern].filter(Boolean).join('-');
}

/**
 * Der Vorschlag, der garantiert noch frei ist.
 *
 * Bei einer Kollision wird `-2` angehängt, dann `-3` und so weiter — die Regel aus dem
 * README („Bei einer Dublette bekommt der neue Eintrag ein Suffix (`…-2`)“) und dieselbe,
 * die der Import benutzt hat. Im Bestand gibt es zwei solche Paare (NOTIZEN.md § 2).
 *
 * Wichtig ist, was **nicht** passiert: Es wird nichts zusammengeführt und nichts ersetzt.
 * Ob ein zweiter Eintrag überhaupt richtig ist oder stattdessen `bestand` erhöht gehört,
 * entscheidet die Bücherei — die Verwaltung sagt es ihr an der Stelle, an der die Frage
 * auftaucht, und schlägt hier nur eine freie Kennung vor.
 */
export function schlageKennungVor(
  angaben: Kennungsangaben,
  vergeben: Iterable<string> = [],
): string {
  const belegt = new Set(vergeben);
  const grund = kennungsvorschlag(angaben);

  if (!belegt.has(grund)) return grund;

  for (let zaehler = 2; ; zaehler++) {
    const versuch = `${grund}-${zaehler}`;
    if (!belegt.has(versuch)) return versuch;
  }
}
