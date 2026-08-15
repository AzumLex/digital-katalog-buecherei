# Digitaler Inventar — Datenstand

Erzeugt am 16.08.2026 aus `Romane.doc` und `Tonies.xlsx`.

| Datei | Einträge |
|---|---|
| `data/romane.json` | 806 |
| `data/tonies.json` | 181 |
| `data/spiele.json`, `cds.json`, `kinderbuecher.json`, `kinder-sachbuecher.json`, `sachbuecher.json` | leere Gerüste |
| `data/_unlesbar.json` | 2 Fragmente — im Original-Word ist hier Text verloren gegangen |

`schema/medium.schema.json` beschreibt alle Felder. `python3 validate.py` prüft die Daten dagegen
(aktuell: 987 Einträge, 0 Fehler, 0 doppelte IDs).

## Nachzuarbeiten (43 Einträge mit `_pruefen`)

Alles Mängel, die schon in der Word-Datei standen — nicht Fehler des Imports:

| Vermerk | Anzahl | Bedeutung |
|---|---|---|
| `kein_ort` | 19 | Verlagsort fehlt in der Quelle |
| `isbn_ungueltig` | 12 | ISBN-Prüfziffer stimmt nicht oder Ziffer fehlt |
| `kein_jahr` | 7 | Erscheinungsjahr nicht erkennbar |
| `nur_ATS_preis` | 4 | Preis nur in Schilling angegeben |
| `keine_isbn` | 3 | gar keine ISBN vorhanden |
| `moegliche_dublette` | 4 | zweimal derselbe Titel mit identischer ISBN (Eigner, Riley) |

So findet ihr sie:

```bash
python3 -c "import json;[print(x['_pruefen'], x['_quelle']) for x in json.load(open('data/romane.json'))['items'] if x.get('_pruefen')]"
```

## Felder, die absichtlich leer sind

`standort`, `signatur`, `erfasst_am`, `cover_url` und `status` stehen schon im Schema, sind aber
noch nicht befüllt. `erfasst_am` ist die Grundlage für den "Neu"-Filter und sollte ab jetzt bei
jedem Neuzugang gesetzt werden.

## Import wiederholen

```bash
python3 import/01_romane_parsen.py   # Word-HTML -> Zwischenformat
python3 import/02_json_bauen.py      # -> data/*.json
python3 validate.py
```
