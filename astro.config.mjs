// @ts-check
import { defineConfig } from 'astro/config';

// Rein statischer Katalog: Der Build erzeugt fertiges HTML, das Vercel nur noch
// ausliefert. Kein Server, keine Datenbank, keine Laufzeit-Abhängigkeiten.
export default defineConfig({
  output: 'static',
  build: {
    // Saubere URLs ohne .html-Endung: /romane/ statt /romane.html
    format: 'directory',
  },
});
