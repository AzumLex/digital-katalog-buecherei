#!/usr/bin/env python3
"""Prüft alle src/data/*.json gegen schema/medium.schema.json. Exit-Code 1 bei Fehlern.

NICHT Teil des Builds. Die Prüfung, die vor jedem Build läuft, steckt in
scripts/validate.mjs und braucht nur Node — damit auf dem Deploy-Server kein Python
vorhanden sein muss. Dieses Skript bleibt für die lokale Arbeit erhalten und prüft
dasselbe: Schemakonformität, doppelte ids, und dass `anzahl` zur Zahl der Einträge
passt.

Aufruf: `npm run validate:py` (oder `python scripts/validate.py`).
Braucht `pip install -r requirements.txt`.
"""
import json, sys, glob, os
from collections import Counter
from jsonschema import Draft202012Validator

# Umlaute auch auf Windows-Konsolen ausgeben können, ohne UnicodeEncodeError.
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Dieses Skript liegt in scripts/, die Daten und das Schema liegen im Projektwurzelverzeichnis.
base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
schema = json.load(open(os.path.join(base,'schema/medium.schema.json'), encoding='utf-8'))
v = Draft202012Validator(schema)
fehler = 0; ids = Counter(); gesamt = 0

for pfad in sorted(glob.glob(os.path.join(base,'src/data/*.json'))):
    name = os.path.basename(pfad)
    if name.startswith('_'): continue
    d = json.load(open(pfad, encoding='utf-8'))
    items = d.get('items', [])
    gesamt += len(items)
    if d.get('anzahl') != len(items):
        print(f'{name}: anzahl={d.get("anzahl")} stimmt nicht mit {len(items)} Einträgen überein'); fehler += 1
    for i, it in enumerate(items):
        ids[it.get('id')] += 1
        for e in v.iter_errors(it):
            fehler += 1
            if fehler <= 25:
                print(f'{name}[{i}] {it.get("id")}: {".".join(map(str,e.path))} {e.message}')
            elif fehler == 26:
                print('... (weitere Fehler unterdrückt)')
    print(f'{name:28} {len(items):5} Einträge')

for k, n in ids.items():
    if n > 1: print(f'DOPPELTE ID: {k} ({n}x)'); fehler += 1

print(f'\ngesamt {gesamt} Einträge, {fehler} Fehler')
sys.exit(1 if fehler else 0)
