/**
 * Die Anmeldung zur Verwaltung — ein Passwort und ein signiertes Cookie.
 *
 * Bei genau einer pflegenden Person ist der einfachste Weg auch der richtige
 * (plan.md § 3): ein Passwort, das in den Vercel-Einstellungen hinterlegt ist. Kein
 * zusätzlicher Dienst, kein Sitzungsspeicher, kein Zustand auf dem Server — und damit
 * nichts, was ausfallen, pausieren oder Geld kosten kann.
 *
 * Drei Bedingungen sind dabei nicht verhandelbar, und alle drei stehen hier:
 *
 * 1. **In der Umgebung steht ein Hash, nie das Passwort.** Wer die Vercel-Einstellungen
 *    einsehen kann, kann sich damit nicht anmelden.
 * 2. **Der Vergleich läuft in konstanter Zeit.** Ein Vergleich, der beim ersten falschen
 *    Zeichen abbricht, verrät über die Antwortzeit, wie viele Zeichen stimmen.
 * 3. **Die Sitzung ist ein signiertes Cookie**, kein Schlüssel in eine Tabelle. Der
 *    Server merkt sich nichts; er rechnet bei jeder Anfrage nach.
 *
 * **Keine neue Abhängigkeit:** alles aus `node:crypto`.
 *
 * Dieses Modul liest Geheimnisse aus der Umgebung und läuft deshalb ausschließlich
 * serverseitig — in Dateien mit `export const prerender = false` und in der Middleware.
 *
 * > Wenn später mehrere Personen pflegen, wird genau diese Datei gegen eine
 * > GitHub-Anmeldung getauscht (plan.md § 3). Alles andere bleibt: Der Rest des Projekts
 * > kennt von hier nur `pruefeSitzung`, `erzeugeSitzung` und den Namen des Cookies.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/* ------------------------------------------------------------------ *
 * Fehler
 * ------------------------------------------------------------------ */

/**
 * Ein Fehler, dessen Text angezeigt werden darf.
 *
 * Er entsteht nur bei unfertiger Einrichtung — nie bei einem falschen Passwort. Das ist
 * die wichtige Unterscheidung: „Passwort stimmt nicht“ ist eine Antwort an den Benutzer,
 * „es ist gar kein Passwort hinterlegt“ ist eine Nachricht an die betreuende Person, und
 * wer die beiden verwechselt, lässt jemanden zehn Minuten lang ein richtiges Passwort
 * eintippen.
 */
export class AnmeldeFehler extends Error {
  constructor(meldung: string) {
    super(meldung);
    this.name = 'AnmeldeFehler';
  }
}

/* ------------------------------------------------------------------ *
 * Umgebung
 * ------------------------------------------------------------------ */

/** Liest eine Umgebungsvariable; leer und „nicht gesetzt“ sind dasselbe. */
function umgebung(name: string): string | undefined {
  const wert = process.env[name];
  return wert && wert.trim() !== '' ? wert.trim() : undefined;
}

/**
 * Holt ein Pflichtgeheimnis oder bricht mit einem lesbaren Satz ab.
 *
 * Erst beim Aufruf und nicht beim Import: Der statische Build lädt dieses Modul über die
 * Middleware mit, und er soll auf einem Rechner ohne eingerichtete Umgebung trotzdem
 * durchlaufen. Der Katalog hängt schließlich nicht an der Verwaltung.
 */
function geheimnis(name: string, wozu: string): string {
  const wert = umgebung(name);
  if (!wert) {
    throw new AnmeldeFehler(
      `Die Verwaltung ist noch nicht fertig eingerichtet: In den Vercel-Einstellungen ` +
        `fehlt die Variable ${name} (${wozu}). Bitte bei der Person melden, die den ` +
        `Katalog betreut.`,
    );
  }
  return wert;
}

/* ------------------------------------------------------------------ *
 * Passwort
 * ------------------------------------------------------------------ */

/**
 * Die Kostenparameter von scrypt.
 *
 * `N = 16384` ist die Voreinstellung von Node und braucht 16 MB Arbeitsspeicher je
 * Versuch. Ein höherer Wert wäre möglich, verlangte aber, `maxmem` mit hochzuziehen —
 * und er verteidigte etwas, das ohnehin nicht die schwache Stelle ist: Wer den Hash
 * lesen kann, liest in derselben Einstellungsseite auch `SITZUNG_GEHEIMNIS` und braucht
 * das Passwort dann gar nicht mehr.
 *
 * Wogegen die Kosten wirklich helfen, ist das Durchprobieren über das Anmeldeformular:
 * Jeder Versuch kostet den Server etwa eine Zehntelsekunde Rechenzeit. Eine Zählung der
 * Fehlversuche gibt es bewusst nicht — sie bräuchte einen Zustand, den dieser Aufbau
 * nirgends hat, und schützte bei einem ordentlichen Passwort nichts, was diese Bremse
 * nicht schon schützt.
 */
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_LAENGE = 64;

/**
 * Rechnet das Passwort in einen Schlüssel um.
 *
 * `normalize('NFKC')` vor allem sonst: „ü“ lässt sich als ein Zeichen oder als u + Trema
 * schreiben, und je nach Tastatur, Betriebssystem und Browser kommt mal das eine, mal
 * das andere an. Ohne diese Zeile ließe sich ein Passwort mit Umlaut auf dem einen Gerät
 * setzen und auf dem anderen nicht eingeben — ein Fehler, den niemand je fände.
 */
function rechneSchluessel(passwort: string, salz: Buffer, laenge: number): Buffer {
  return scryptSync(passwort.normalize('NFKC'), salz, laenge, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
}

/**
 * Erzeugt den Wert für `VERWALTUNG_PASSWORT_HASH`. Benutzt von `npm run passwort`.
 *
 * Das Format trägt seine eigenen Parameter: `scrypt$N$r$p$Salz$Hash`. Damit lässt sich
 * die Kostenstufe später erhöhen, ohne dass ein vorhandener Hash ungültig wird — beim
 * Prüfen gelten die Zahlen aus der Zeile, nicht die aus dieser Datei. Ein Hash ohne
 * Parameter wäre eine Einbahnstraße: Jede spätere Änderung sperrte die Bücherei aus.
 */
export function erzeugeHash(passwort: string): string {
  const salz = randomBytes(16);
  const schluessel = rechneSchluessel(passwort, salz, SCRYPT_LAENGE);

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salz.toString('base64url'),
    schluessel.toString('base64url'),
  ].join('$');
}

/**
 * Stimmt das eingegebene Passwort?
 *
 * `timingSafeEqual` und nicht `===`: Ein gewöhnlicher Vergleich bricht beim ersten
 * abweichenden Byte ab. Der Unterschied ist winzig, aber messbar, und über genug
 * Versuche lässt sich ein Hash damit Zeichen für Zeichen erraten. Verglichen werden
 * dabei die gerechneten Schlüssel, nicht die Passwörter — die sind unterschiedlich lang,
 * und schon die Länge wäre eine Auskunft.
 */
export function pruefePasswort(passwort: string): boolean {
  const hinterlegt = geheimnis(
    'VERWALTUNG_PASSWORT_HASH',
    'die Ausgabe von „npm run passwort“',
  );

  const teile = hinterlegt.split('$');
  if (teile.length !== 6 || teile[0] !== 'scrypt') {
    throw new AnmeldeFehler(
      'Die Variable VERWALTUNG_PASSWORT_HASH hat nicht die erwartete Form. Sie muss ' +
        'die vollständige, unveränderte Ausgabe von „npm run passwort“ enthalten — ' +
        'eine Zeile, die mit „scrypt$“ beginnt.',
    );
  }

  const [, n, r, p, salz, erwartet] = teile;
  const erwarteterSchluessel = Buffer.from(erwartet!, 'base64url');

  // Die Parameter stammen aus der hinterlegten Zeile, nicht aus den Konstanten oben —
  // siehe `erzeugeHash`. Die Länge kommt aus dem hinterlegten Hash, damit
  // `timingSafeEqual` nie an ungleich langen Puffern scheitert.
  const gerechnet = scryptSync(
    passwort.normalize('NFKC'),
    Buffer.from(salz!, 'base64url'),
    erwarteterSchluessel.length,
    { N: Number(n), r: Number(r), p: Number(p) },
  );

  return timingSafeEqual(gerechnet, erwarteterSchluessel);
}

/* ------------------------------------------------------------------ *
 * Sitzung
 * ------------------------------------------------------------------ */

/** Name des Sitzungscookies. Deutsch, wie alles, was jemand zu Gesicht bekommt. */
export const SITZUNGS_COOKIE = 'buecherei_sitzung';

/** Wie lange eine Anmeldung hält (plan.md § 3). */
const SITZUNGSDAUER_TAGE = 30;

/**
 * Unterschreibt einen Wert mit `SITZUNG_GEHEIMNIS`.
 *
 * Ein neuer Wert dieser Variablen macht jede ausgestellte Unterschrift ungültig und
 * meldet damit sofort alle Geräte ab — der Not-Aus aus plan.md § 9 (d), wenn ein Handy
 * verloren geht. Dass er ohne eine Zeile Code hier auskommt, ist der eigentliche Grund
 * für ein signiertes Cookie statt einer Sitzungstabelle.
 */
function unterschrift(nutzlast: string): Buffer {
  return createHmac(
    'sha256',
    geheimnis('SITZUNG_GEHEIMNIS', '32 zufällige Bytes zum Unterschreiben der Sitzung'),
  )
    .update(nutzlast)
    .digest();
}

/** Eine frisch ausgestellte Sitzung. */
export interface Sitzung {
  /** Der Wert, der ins Cookie kommt. */
  wert: string;
  /** Wann sie abläuft — dasselbe Datum gehört ins Cookie selbst. */
  ablauf: Date;
}

/**
 * Stellt eine Sitzung aus.
 *
 * Im Cookie steht nur der Ablaufzeitpunkt und seine Unterschrift. Mehr braucht es nicht:
 * Es gibt genau eine berechtigte Person, also ist „gültig unterschrieben“ dasselbe wie
 * „angemeldet“. Der Zeitpunkt steht **im** unterschriebenen Teil und nicht nur in den
 * Cookie-Angaben — die kann ein Browser (oder wer das Cookie in die Hand bekommt)
 * beliebig setzen, den unterschriebenen Wert nicht.
 */
export function erzeugeSitzung(jetzt: Date = new Date()): Sitzung {
  const ablauf = new Date(jetzt.getTime() + SITZUNGSDAUER_TAGE * 86_400_000);
  const nutzlast = String(ablauf.getTime());

  return { wert: `${nutzlast}.${unterschrift(nutzlast).toString('base64url')}`, ablauf };
}

/**
 * Ist dieses Cookie eine gültige, nicht abgelaufene Sitzung?
 *
 * Gibt `false` zurück und wirft nicht — außer die Einrichtung fehlt. Ein kaputtes,
 * fremdes oder abgelaufenes Cookie ist kein Fehlerfall, sondern schlicht „nicht
 * angemeldet“; die Middleware schickt dann zum Anmeldeformular.
 */
export function pruefeSitzung(wert: string | undefined): boolean {
  if (!wert) return false;

  const trennstelle = wert.lastIndexOf('.');
  if (trennstelle <= 0) return false;

  const nutzlast = wert.slice(0, trennstelle);
  const gezeigt = Buffer.from(wert.slice(trennstelle + 1), 'base64url');
  const erwartet = unterschrift(nutzlast);

  // Längenprüfung vor `timingSafeEqual`: Die Funktion wirft bei ungleich langen Puffern,
  // und ein zu kurzes Cookie ist ein Fall, den jeder Besucher auslösen kann.
  if (gezeigt.length !== erwartet.length) return false;
  if (!timingSafeEqual(gezeigt, erwartet)) return false;

  const ablauf = Number(nutzlast);
  return Number.isFinite(ablauf) && ablauf > Date.now();
}

/**
 * Die Angaben, mit denen das Sitzungscookie gesetzt wird.
 *
 * `httpOnly` hält es aus jedem Skript heraus, `sameSite: 'lax'` sorgt dafür, dass eine
 * fremde Seite keine Änderung in unserem Namen abschicken kann, und `path: '/'` gilt für
 * `/verwaltung/` und `/api/` gleichermaßen.
 *
 * `secure` ist überall an — außer auf dem eigenen Rechner. Ein Secure-Cookie über
 * `http://localhost` würde je nach Browser gar nicht erst gespeichert, und dann ließe
 * sich die Anmeldung lokal nicht ausprobieren. Die Bedingung fragt deshalb nach dem
 * Rechnernamen und nicht nach dem Protokoll: Hinter Vercels TLS-Abschluss kommt in der
 * Funktion je nach Zwischenschicht auch einmal `http:` an — an einem Cookie ohne
 * `Secure` läge es dann nicht mehr.
 */
export function sitzungsCookieAngaben(url: URL, ablauf?: Date) {
  const oertlich = url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  return {
    httpOnly: true,
    secure: !oertlich,
    sameSite: 'lax',
    path: '/',
    expires: ablauf,
  } as const;
}
