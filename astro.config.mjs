// @ts-check
import { defineConfig } from 'astro/config';

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

// Rein statischer Katalog: Der Build erzeugt fertiges HTML, das Vercel nur noch
// ausliefert. Kein Server, keine Datenbank, keine Laufzeit-Abhängigkeiten.
export default defineConfig({
  output: 'static',
  site: seitenadresse,
  // Astro erzeugt Verzeichnisse mit index.html; dazu passt trailingSlash: true in
  // der vercel.json. Beides muss zusammenpassen, sonst leitet Vercel im Kreis.
  trailingSlash: 'always',
  build: {
    // Saubere URLs ohne .html-Endung: /romane/ statt /romane.html
    format: 'directory',
  },
});
