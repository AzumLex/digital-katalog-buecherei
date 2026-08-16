/**
 * Der Suchindex als eine statische Datei.
 *
 * Beim Build entsteht daraus `dist/suchindex.json`. Der Browser lädt sie einmal und
 * sucht darin lokal — es geht keine Anfrage an einen fremden Server, weder beim
 * Laden noch beim Tippen.
 */
import type { APIRoute } from 'astro';
import { baueSuchdaten } from '../lib/suchdokumente';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(baueSuchdaten()), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
