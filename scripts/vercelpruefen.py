#!/usr/bin/env python3
"""Prüft vercel.json gegen das offizielle Schema von Vercel.

Warum es dieses Skript gibt: Vercel lehnt eine Konfiguration mit einem einzigen
unbekannten Schlüssel komplett ab (`additionalProperties: false` durchgehend) — und
zwar erst beim Deploy, wenn schon alles gepusht ist. Diese Prüfung zieht den Fehler
nach vorn, in denselben Durchlauf, der auch die Daten prüft.

Fällt das Netz aus, wird die Prüfung übersprungen statt fehlzuschlagen: Eine nicht
erreichbare Schema-Adresse sagt nichts über die Konfiguration aus und sollte kein
Deployment blockieren. Ein echter Schemaverstoß dagegen schon.

Aufruf: `npm run vercelpruefen`
"""
import json
import os
import sys
import urllib.error
import urllib.request

from jsonschema import Draft4Validator

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SCHEMA_URL = 'https://openapi.vercel.sh/vercel.json'
basis = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
konfig_pfad = os.path.join(basis, 'vercel.json')

if not os.path.exists(konfig_pfad):
    print('vercel.json nicht gefunden — nichts zu prüfen.')
    sys.exit(0)

with open(konfig_pfad, encoding='utf-8') as datei:
    konfig = json.load(datei)

try:
    with urllib.request.urlopen(SCHEMA_URL, timeout=20) as antwort:
        schema = json.load(antwort)
except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as fehler:
    print(f'Schema unter {SCHEMA_URL} nicht erreichbar ({fehler}).')
    print('Prüfung übersprungen — das sagt nichts über vercel.json aus.')
    sys.exit(0)

fehler = sorted(Draft4Validator(schema).iter_errors(konfig), key=lambda e: list(e.path))

for e in fehler:
    stelle = '.'.join(map(str, e.path)) or '(oberste Ebene)'
    print(f'FEHLER  {stelle}: {e.message}')

if fehler:
    print(f'\nvercel.json verstößt an {len(fehler)} Stelle(n) gegen das Vercel-Schema.')
    print('Vercel würde das Deployment mit derselben Meldung ablehnen.')
    sys.exit(1)

print(
    f'vercel.json ist gültig: {len(konfig)} Einstellungen, '
    f'{len(konfig.get("headers", []))} Header-Regeln, 0 Verstöße.'
)
