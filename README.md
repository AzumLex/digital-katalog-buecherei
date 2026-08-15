# Digitaler Büchereikatalog

Statischer Online-Katalog der Büchereimedien. Der Bestand liegt als JSON im Projekt, beim
Build entsteht daraus fertiges HTML — kein Server, keine Datenbank, keine laufenden Kosten
außer dem Hosting.

Der Katalog ist zugleich Vorbereitung auf den späteren Umstieg auf ein richtiges
Bibliotheksprogramm: Die Datenfelder sind schon so geschnitten, dass sie sich ohne
Informationsverlust dorthin übernehmen lassen.

**Stand: Phase 1.** Die Datenpipeline steht, die Startseite zeigt die Anzahl je Sparte.
Suche, Sparten- und Detailseiten kommen in den nächsten Phasen.

---

## Schnellstart

Gebraucht werden [Node.js](https://nodejs.org/) 18 oder neuer und
[Python](https://www.python.org/downloads/) 3.

```bash
npm install                    # einmalig
pip install -r requirements.txt  # einmalig, für die Datenprüfung
npm run dev                    # startet http://localhost:4321
```

| Befehl | Was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver mit automatischem Neuladen |
| `npm run validate` | prüft alle Daten gegen das Schema |
| `npm run build` | erzeugt die fertige Website in `dist/` (prüft vorher die Daten) |
| `npm run preview` | zeigt das Ergebnis aus `dist/` lokal an |
| `npm run check` | prüft Astro- und TypeScript-Dateien auf Fehler |

---

## Einen Titel hinzufügen

Alle Medien stehen in `src/data/` — eine Datei je Sparte:

```
src/data/romane.json              Romane (Deutsch)
src/data/sachbuecher.json         Sachbücher
src/data/kinderbuecher.json       Kinderbücher
src/data/kinder-sachbuecher.json  Kinder-Sachbücher
src/data/tonies.json              Tonies
src/data/spiele.json              Spiele
src/data/cds.json                 CDs
```

### Schritt für Schritt

**1. Die passende Datei öffnen** und im Array `items` einen neuen Eintrag ergänzen. Am
einfachsten: einen bestehenden Eintrag kopieren und überschreiben.

```jsonc
{
  "id": "rom-mustermann-der-lange-sommer-1234",
  "sparte": "romane",
  "medium": "Buch",
  "titel": "Der lange Sommer",
  "untertitel": "Roman",
  "autor": "Anna Mustermann",
  "autor_nachname": "Mustermann",
  "autor_vorname": "Anna",
  "verlag": "Beispielverlag",
  "ort": "Wien",
  "jahr": 2026,
  "seiten": 312,
  "isbn": "9783123456789",
  "isbn_formatiert": "978-3-12-345678-9",
  "einband": "kartoniert",
  "preis_eur": 24.0,
  "genres": ["Roman"],
  "sprache": "de",
  "bestand": 1,
  "status": "verfuegbar",
  "erfasst_am": "2026-08-16"
}
```

**2. Die Zahl `anzahl` ganz oben in derselben Datei um eins erhöhen.** `npm run validate`
meckert sonst — das ist Absicht, damit niemand versehentlich einen halben Eintrag stehen
lässt.

**3. Prüfen:**

```bash
npm run validate
```

Meldet der Befehl `0 Fehler`, passt alles. Andernfalls steht in der Ausgabe genau, welcher
Eintrag welches Feld falsch hat.

### Die Regeln für `id`

Die `id` ist der dauerhafte Schlüssel eines Mediums. Später hängen die Adresse der
Detailseite und die Ausleihdatensätze daran.

- Aufbau: drei Kleinbuchstaben, Bindestrich, dann Kleinbuchstaben/Ziffern/Bindestriche —
  z. B. `rom-mustermann-der-lange-sommer-1234`
- Kürzel je Sparte: `rom-` Romane, `sac-` Sachbücher, `kib-` Kinderbücher,
  `kis-` Kinder-Sachbücher, `ton-` Tonies, `spi-` Spiele, `cds-` CDs
- Bewährtes Muster: Kürzel + Nachname + Titel + die letzten vier ISBN-Ziffern
- **Eine einmal vergebene `id` nie wieder ändern**, auch nicht, wenn der Titel korrigiert
  wird. Bei einer Dublette bekommt der neue Eintrag ein Suffix (`…-2`).

Kommt eine `id` zweimal vor, bricht der Build mit einer Fehlermeldung ab, die beide
Fundstellen nennt.

### Pflichtfelder und alles Weitere

Pflicht sind `id`, `sparte`, `medium`, `titel`, `status`. Alle übrigen Felder sind optional.

**Unbekanntes bitte weglassen, nicht leer eintragen.** Wenn die ISBN fehlt, wird das Feld
`isbn` gar nicht erst geschrieben — kein `""`, kein `null`. So bleibt später erkennbar, was
wirklich unbekannt ist und was nur noch nicht nachgetragen wurde.

Welche Felder es gibt und welche Werte erlaubt sind, steht vollständig und kommentiert in
[`schema/medium.schema.json`](schema/medium.schema.json). Ein zweites Exemplar desselben
Titels bekommt keinen eigenen Eintrag, sondern `"bestand": 2`.

### Eine neue Sparte

Sparten sind fest im Schema hinterlegt. Für eine neue Sparte braucht es drei Schritte:
Wert in `schema/medium.schema.json` bei `sparte.enum` ergänzen, dieselbe Sparte in
`SPARTEN` in `src/lib/daten.ts` eintragen, und eine leere Datei `src/data/<sparte>.json`
nach dem Muster der bestehenden anlegen.

---

## Veröffentlichen (Vercel)

Der Katalog ist eine rein statische Website; Vercel erkennt Astro automatisch.

### Einmalig einrichten

1. Projekt zu GitHub pushen.
2. Auf [vercel.com](https://vercel.com) → **Add New… → Project** → das Repository wählen.
3. Framework Preset: **Astro** (wird erkannt). Build Command `npm run build`,
   Output Directory `dist`.
4. **Install Command überschreiben** auf:

   ```
   npm install && pip3 install -r requirements.txt
   ```

   Grund: `npm run build` prüft vor dem Bauen die Daten mit `scripts/validate.py`. Dafür
   muss das Python-Paket `jsonschema` auch auf dem Build-Server vorhanden sein.
5. **Deploy** klicken.

### Danach

Jeder Push auf `main` veröffentlicht automatisch neu. Pushes auf andere Branches erzeugen
eine Vorschau-Adresse zum Anschauen, ohne die öffentliche Seite anzufassen.

Schlagen die Datenprüfung oder die Dublettenprüfung fehl, bricht der Build ab und die
bisherige Seite bleibt online. Kaputte Daten gehen so nie live.

### Wenn der Build an Python scheitert

Sollte `pip3` in der Build-Umgebung nicht verfügbar sein, das Build Command auf

```
npx astro build
```

ändern. Dann entfällt nur die Schemaprüfung auf dem Server — die Prüfung auf doppelte `id`
steckt in `src/lib/daten.ts` und läuft weiterhin bei jedem Build. In dem Fall vor jedem Push
lokal `npm run validate` ausführen.

---

## Aufbau des Projekts

```
schema/medium.schema.json   Definition aller Datenfelder — die maßgebliche Quelle
src/data/*.json             der Bestand, eine Datei je Sparte
src/lib/daten.ts            lädt die Daten, vergibt die Typen, prüft ids auf Dubletten
src/layouts/                gemeinsames Seitengerüst
src/pages/                  eine Datei je Seite; index.astro ist die Startseite
src/styles/global.css       Farben, Schriften, Abstände als CSS Custom Properties
scripts/validate.py         Schemaprüfung
scripts/validate.mjs        startet validate.py mit dem passenden Python
scripts/import/             einmalige Importskripte aus Word/Excel (Beleg, nicht mehr nötig)
buecherei-daten/            Originalübergabe, unverändert als Beleg
NOTIZEN.md                  bekannte Mängel im Datenbestand
```

Technisch: [Astro](https://astro.build/) mit TypeScript, `output: 'static'`. Kein React,
kein Vue, kein Tailwind — Astro-Komponenten und reines CSS. Interaktivität kommt später als
einzelnes Vanilla-TypeScript-Skript dazu.

## Bekannte Mängel im Bestand

`npm run validate` läuft fehlerfrei durch, trotzdem stecken in den Daten Altlasten aus dem
Word-Dokument: fehlerhafte ISBN, zwei vermutliche Dubletten, zwei unlesbare Fragmente.
Alles gesammelt in [`NOTIZEN.md`](NOTIZEN.md).

47 Einträge tragen ein Feld `_pruefen` mit dem konkreten Vermerk. Felder mit führendem
Unterstrich (`_quelle`, `_pruefen`) sind Arbeitsmaterial und werden im Katalog nie angezeigt.
