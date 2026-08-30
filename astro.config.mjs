// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';

/**
 * Die öffentliche Adresse des Katalogs.
 *
 * Gebraucht für sitemap.xml, robots.txt und die Canonical-Angaben. Auf Vercel steht
 * die Produktionsadresse während des Builds in der Umgebung, lokal fällt sie auf
 * einen Platzhalter zurück. Wer eine eigene Domain hat, setzt `SITE_URL` in den
 * Projekteinstellungen — dann steht sie überall richtig.
 */
const seitenadresse =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'https://buecherei.example');

/**
 * Unter welchen Rechnernamen diese Seite erreichbar ist — und warum das hier stehen muss.
 *
 * Hinter Vercel läuft die Serverfunktion nicht selbst unter der öffentlichen Adresse: Der
 * echte Rechnername steht in den Kopfzeilen `Host` und `X-Forwarded-Host`. Astro glaubt
 * beiden **nur**, wenn sie zu einem Muster in dieser Liste passen — sonst gelten sie als
 * untergeschoben (jeder kann eine Kopfzeile setzen), und `Astro.url` fällt auf
 * `https://localhost/…` zurück. Ohne diese Liste ist der Rechnername also in jeder Anfrage
 * falsch, und zwei Dinge gehen still kaputt:
 *
 * 1. **Kein Formular lässt sich mehr abschicken.** Astros Schutz gegen fremde Formulare
 *    vergleicht die `Origin`-Kopfzeile des Browsers mit `Astro.url.origin`. Der Browser
 *    sagt `https://…vercel.app`, Astro rechnet mit `https://localhost` — die Anmeldung
 *    endet mit „Cross-site POST form submissions are forbidden" (403).
 * 2. **Das Sitzungscookie verliert sein `Secure`.** `sitzungsCookieAngaben` in
 *    `src/lib/anmeldung.ts` entscheidet am Rechnernamen, ob die Seite gerade lokal läuft;
 *    „localhost" heißt dort „ohne TLS, also ohne `Secure`" — richtig auf dem eigenen
 *    Rechner, falsch im Netz.
 *
 * Deshalb drei Muster, jedes mit Grund:
 *
 * - **Die eigene Adresse** aus `SITE_URL` (oder der Vercel-Produktionsadresse). Wer später
 *   eine eigene Domain aufschaltet, **muss `SITE_URL` setzen** — sonst steht sie hier nicht
 *   und die Verwaltung lehnt jede Eingabe ab.
 * - **`**.vercel.app`** für die Vorschau-Bereitstellungen, die bei jedem Zweig unter einem
 *   neuen Namen entstehen. Ohne dieses Muster ließe sich in einer Vorschau nichts
 *   ausprobieren.
 * - **`localhost`** für `npm run dev`.
 *
 * Der Schutz selbst (`security.checkOrigin`) bleibt eingeschaltet. Er wird hier nicht
 * abgeschaltet, sondern bekommt endlich die Wahrheit über den Rechnernamen zu sehen — das
 * ist der Unterschied zwischen „Warnung weg" und „Fehler behoben".
 */
const eigeneAdresse = new URL(seitenadresse);
const erlaubteRechnernamen = [
  { hostname: eigeneAdresse.hostname, protocol: eigeneAdresse.protocol.replace(':', '') },
  { hostname: '**.vercel.app', protocol: 'https' },
  { hostname: 'localhost', protocol: 'http' },
];

// Rein statischer Katalog: Der Build erzeugt fertiges HTML, das Vercel nur noch
// ausliefert. Kein Server, keine Datenbank, keine Laufzeit-Abhängigkeiten.
//
// `output: 'static'` bleibt genau deshalb stehen. Der Adapter macht daraus keinen
// Server: Er nimmt die 1058 fertigen Seiten, wie sie sind, und erzeugt eine
// Serverfunktion nur für die Dateien, die ausdrücklich `export const prerender = false`
// tragen — die Verwaltung und die Schnittstelle. Wer das nachrechnen will, zählt nach
// dem Build die Ordner unter `.vercel/output/functions/`: Es darf genau einer sein.
export default defineConfig({
  output: 'static',
  // Der Adapter ist die eine zusätzliche Abhängigkeit, die dieser Umbau kosten darf
  // (plan.md § 9 (b)). Ohne ihn gibt es auf Vercel keine Serverroute und damit keine
  // Verwaltung. Fassung 9 statt der neuesten: Ab 10 verlangt der Adapter Astro 6
  // beziehungsweise 7 — ein Sprung, der den ganzen Katalog anfasst und in diesem Paket
  // nichts zu suchen hat.
  //
  // Ohne Angaben, mit Absicht: `imageService` bräuchte der Katalog nicht (er hat keine
  // Bilder), `edgeMiddleware` wäre sogar schädlich — `node:crypto` aus `anmeldung.ts`
  // gibt es in der Edge-Laufzeit nicht. Die Voreinstellung ist in beiden Fällen die
  // richtige; sie hier hinzuschreiben hieße nur, sie beim nächsten Update pflegen zu
  // müssen.
  adapter: vercel({
    // Speichern heißt: bis zu sechs Anfragen an die GitHub-API, eine davon mit dem
    // vollen Inhalt von `romane.json`. Die Voreinstellung von zehn Sekunden reicht
    // dafür im Regelfall, aber nicht an einem schlechten Tag — und ein Abbruch durch
    // die Plattform zeigt der Bücherei eine fremde Fehlerseite statt einer Meldung.
    // 30 Sekunden liegen unter der Grenze auch des kostenlosen Tarifs.
    maxDuration: 30,
  }),
  site: seitenadresse,
  security: {
    // Siehe `erlaubteRechnernamen` oben. Ohne diese Zeile scheitert jede Anmeldung.
    allowedDomains: erlaubteRechnernamen,
  },
  // Astro erzeugt Verzeichnisse mit index.html; dazu passt trailingSlash: true in
  // der vercel.json. Beides muss zusammenpassen, sonst leitet Vercel im Kreis.
  trailingSlash: 'always',
  build: {
    // Saubere URLs ohne .html-Endung: /romane/ statt /romane.html
    format: 'directory',

    // Sobald ein Adapter im Spiel ist, teilt Astro das Ergebnis von sich aus in
    // `dist/client/` und `dist/server/`. Diese beiden Zeilen holen den fertigen
    // Katalog dorthin zurück, wo er immer lag — nach `dist/`. Sonst müssten
    // `npm run suchtest`, `npm run filtertest`, die Umfangsmessung in `pruefen.yml`
    // und die Anleitung im README alle denselben Pfad nachziehen, und der Umbau würde
    // an vier Stellen sichtbar, an denen er nichts zu suchen hat.
    //
    // Der Serverteil muss dafür **außerhalb** von `dist/` liegen: Der Adapter kopiert
    // den ganzen Client-Ordner nach `.vercel/output/static`, also in das öffentlich
    // ausgelieferte Verzeichnis. Läge das Serverbündel darin, wäre es mitsamt allem,
    // was hineingebündelt wurde, aus dem Netz abrufbar.
    // Beide Angaben zählen ab `outDir` (also ab `dist/`), nicht ab der Projektwurzel:
    // `'./'` ist damit `dist/` selbst, `'../dist-server/'` liegt daneben.
    client: './',
    server: '../dist-server/',
  },
});
