/**
 * sitemap.xml — was Suchmaschinen kennen sollen.
 *
 * Aufgenommen werden die Startseite, die Sparten-Listen in der Standardsortierung
 * (mit allen Blätterseiten, damit die Titelseiten erreichbar sind) und jede
 * Titelseite. **Nicht** aufgenommen werden die drei Alternativsortierungen: Das ist
 * dieselbe Liste in anderer Reihenfolge, also dreimal derselbe Inhalt. Diese Seiten
 * tragen zusätzlich `noindex,follow`.
 *
 * Bewusst als eine Datei und von Hand gebaut statt über eine Integration: Bei gut
 * tausend Adressen ist das weit unter dem Limit von 50 000, und so steht genau das
 * drin, was drinstehen soll — unter dem Namen, den man erwartet.
 *
 * `/verwaltung/` und `/api/` können hier gar nicht hineingeraten: `sammleAdressen()`
 * zählt auf, was aufgenommen wird, statt zu durchsuchen und auszuschließen. Eine
 * Integration, die alle erzeugten Seiten einsammelt, hätte die Verwaltung beim ersten
 * Build mit aufgeführt — und niemandem wäre es aufgefallen.
 */
import type { APIRoute } from 'astro';
import { SPARTEN, alleMedien, medienDerSparte } from '../lib/daten';
import { datenstand } from '../lib/daten';
import { spartenPfad, titelPfad } from '../lib/pfade';
import { STANDARD_SORTIERUNG, anzahlSeiten } from '../lib/sortierung';

interface Adresse {
  pfad: string;
  /** Grobe Gewichtung untereinander — Startseite vor Listen vor Einzeltiteln. */
  gewicht: string;
}

function sammleAdressen(): Adresse[] {
  const adressen: Adresse[] = [{ pfad: '/', gewicht: '1.0' }];

  for (const sparte of SPARTEN) {
    const anzahl = medienDerSparte(sparte).length;
    const seiten = anzahl === 0 ? 1 : anzahlSeiten(anzahl);
    for (let nummer = 1; nummer <= seiten; nummer++) {
      adressen.push({
        pfad: spartenPfad(sparte, STANDARD_SORTIERUNG, nummer),
        gewicht: nummer === 1 ? '0.8' : '0.5',
      });
    }
  }

  for (const medium of alleMedien) {
    adressen.push({ pfad: titelPfad(medium.id), gewicht: '0.6' });
  }

  return adressen;
}

/** XML-Sonderzeichen maskieren. In ids und Sparten kommen sie nicht vor, aber verlassen sollte man sich darauf nicht. */
function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: APIRoute = ({ site }) => {
  const basis = site ?? new URL('https://buecherei.example');
  const eintraege = sammleAdressen()
    .map(
      ({ pfad, gewicht }) =>
        `  <url>\n` +
        `    <loc>${maskiere(new URL(pfad, basis).href)}</loc>\n` +
        (datenstand ? `    <lastmod>${datenstand}</lastmod>\n` : '') +
        `    <priority>${gewicht}</priority>\n` +
        `  </url>`,
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${eintraege}\n</urlset>\n`;

  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
};
