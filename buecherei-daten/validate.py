#!/usr/bin/env python3
"""Prüft alle data/*.json gegen schema/medium.schema.json. Exit-Code 1 bei Fehlern."""
import json, sys, glob, os
from collections import Counter
from jsonschema import Draft202012Validator

base = os.path.dirname(os.path.abspath(__file__))
schema = json.load(open(os.path.join(base,'schema/medium.schema.json'), encoding='utf-8'))
v = Draft202012Validator(schema)
fehler = 0; ids = Counter(); gesamt = 0

for pfad in sorted(glob.glob(os.path.join(base,'data/*.json'))):
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
