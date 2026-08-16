/**
 * robots.txt — als Endpunkt und nicht als feste Datei in `public/`, weil die
 * Sitemap-Adresse absolut sein muss und erst beim Build feststeht.
 *
 * Gesperrt wird nichts: Die Alternativsortierungen halten Suchmaschinen über
 * `noindex,follow` heraus, und die JSON-Dateien sind ohnehin nur Rohdaten desselben
 * Bestands, der auch als HTML dasteht.
 */
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const basis = site ?? new URL('https://buecherei.example');

  const text = ['User-agent: *', 'Allow: /', '', `Sitemap: ${new URL('/sitemap.xml', basis).href}`, ''].join(
    '\n',
  );

  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
