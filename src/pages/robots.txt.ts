/**
 * robots.txt — als Endpunkt und nicht als feste Datei in `public/`, weil die
 * Sitemap-Adresse absolut sein muss und erst beim Build feststeht.
 *
 * Vom Katalog wird nichts gesperrt: Die Alternativsortierungen halten Suchmaschinen über
 * `noindex,follow` heraus, und die JSON-Dateien sind ohnehin nur Rohdaten desselben
 * Bestands, der auch als HTML dasteht.
 *
 * Gesperrt sind allein die Verwaltung und die Schnittstelle. Das ist **kein** Schutz —
 * `robots.txt` ist eine Bitte, und wer nichts Gutes vorhat, liest sie als Wegweiser. Der
 * Schutz ist das Passwort (`src/middleware.ts`). Hier geht es um etwas anderes: dass die
 * Anmeldemaske nicht in den Suchergebnissen der Bücherei auftaucht, wenn jemand ihren
 * Namen eingibt. Denselben Zweck haben `X-Robots-Tag: noindex` aus der Middleware und
 * aus `vercel.json` — drei Wege, weil jeder einzelne von ihnen ausfallen kann.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const basis = site ?? new URL('https://buecherei.example');

  const text = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /verwaltung/',
    'Disallow: /api/',
    '',
    `Sitemap: ${new URL('/sitemap.xml', basis).href}`,
    '',
  ].join('\n');

  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
