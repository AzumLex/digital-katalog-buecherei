/**
 * Die Einträge einer Sparte als statische Datei, eine je Sparte.
 *
 * Beim Build entstehen daraus `dist/liste/romane.json`, `dist/liste/tonies.json` …
 * Der Browser holt genau die eine Datei, die er zum Filtern braucht — und auch die
 * erst, wenn wirklich gefiltert wird.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { SPARTEN, type Sparte } from '../../lib/daten';
import { baueListendaten } from '../../lib/listendaten';

export const getStaticPaths = (() =>
  SPARTEN.map((sparte) => ({ params: { sparte } }))) satisfies GetStaticPaths;

export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(baueListendaten(params.sparte as Sparte)), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
