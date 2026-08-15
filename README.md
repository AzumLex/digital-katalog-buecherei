# Digitaler Büchereikatalog

Statischer Online-Katalog der Büchereimedien. Der Bestand liegt als JSON im Projekt, beim
Build entsteht daraus fertiges HTML — kein Server, keine Datenbank, keine laufenden Kosten
außer dem Hosting.

Der Katalog ist zugleich Vorbereitung auf den späteren Umstieg auf ein richtiges
Bibliotheksprogramm: Die Datenfelder sind schon so geschnitten, dass sie sich ohne
Informationsverlust dorthin übernehmen lassen.

**Stand: Phase 2.** Startseite, Sparten-Listen und eine Detailseite je Titel stehen — 1057
fertig gebaute Seiten, ganz ohne JavaScript. Die Volltextsuche kommt als Nächstes; das
Suchfeld auf der Startseite ist bis dahin sichtbar deaktiviert.

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

## Wie der Katalog aufgebaut ist

### Die Seiten

| Adresse | Was dort steht |
|---|---|
| `/` | Suchfeld, Sparten als Kacheln, „Neu im Bestand" |
| `/sparte/romane/` | Liste einer Sparte, Standardsortierung, Seite 1 |
| `/sparte/romane/seite-2/` | zweite Seite derselben Liste |
| `/sparte/romane/titel/` | dieselbe Liste, nach Titel sortiert |
| `/sparte/romane/titel/seite-3/` | dritte Seite davon |
| `/titel/rom-beer-die-rote-frau-6761/` | Detailseite eines Titels |

Jede Sortierung und jede Seite ist eine eigene, fertig gebaute HTML-Datei. Deshalb
funktionieren Umsortieren und Blättern ohne JavaScript, lassen sich als Lesezeichen
speichern, und der Zurück-Knopf tut, was man erwartet. Das Adressschema steht an einer
einzigen Stelle in `src/lib/pfade.ts` — Links und erzeugte Seiten können nicht
auseinanderlaufen.

Eine Liste fasst **60 Titel**. Bei 806 Romanen wären alle auf einmal rund 800 Einträge im
DOM — auf einem älteren Handy am Regal deutlich spürbar.

### Wie sortiert wird

Standard ist **Autor, dann Titel**, umschaltbar auf Titel A–Z, Erscheinungsjahr absteigend
und zuletzt aufgenommen.

- **Deutsche Sortierung** über `Intl.Collator('de')` nach DIN 5007-1: Umlaute zählen wie
  ihr Grundbuchstabe. „Ö" steht zwischen „O" und „P", nicht am Ende; „Ægisdóttir" landet
  zwischen „Adler-Olsen" und „Ahern".
- **Wer keinen Autor hat, steht unter der Reihe, sonst unter dem Titel** — wie im
  gedruckten Katalog. Bei 121 der 181 Tonies ist kein Autor erfasst; „Paw Patrol" steht
  dadurch unter P statt in einem Block namenloser Einträge.
- **Der Vorname entscheidet mit.** Zwölf Nachnamen im Bestand gehören zu zwei
  verschiedenen Personen (Alex Beer und Hans de Beer, Anna und Stephanie Schneider …).
- **Reihen mit mehreren Bänden stehen als Block in Bandreihenfolge**, nicht alphabetisch.
  Der Block wird unter dem Reihennamen einsortiert.
- **Ohne Bandnummer gilt das Erscheinungsjahr.** Bei 24 der 44 Reihen standen im
  Quelldokument keine Bandnummern — beim „Altaussee-Krimi" etwa entspricht die
  Erscheinungsfolge der Lesefolge. Wo Bandnummern da sind, schlagen sie das Jahr: Bei
  „Ein Fall für August Emmerich" ist Band 5 (2020) älter als Band 4 (2021).

Die Sortierung „zuletzt aufgenommen" erscheint ausgegraut und wird gar nicht erst gebaut,
solange kein Eintrag ein `erfasst_am` hat. Sobald das erste Datum gepflegt ist, entsteht sie
beim nächsten Build von allein — dasselbe gilt für „Neu im Bestand" auf der Startseite.

### Was auf der Detailseite steht

Alle vorhandenen Felder, gruppiert in **Inhalt**, **Ausgabe** und **In der Bücherei**.
Fehlende Felder erzeugen keine Zeile — kein „unbekannt", kein Gedankenstrich. Als fehlend
gilt auch der leere Text, weil `standort` und `signatur` überall als `""` in den Daten
stehen.

Die Felder mit führendem Unterstrich (`_quelle`, `_pruefen`) und das vorberechnete
`suchtext` sind Arbeitsmaterial und werden nie angezeigt.

Bei Tonies steht die **Figur** unmittelbar unter dem Titel, hervorgehoben — Kinder suchen
im Regal den gelben Löwen, nicht den Titel. Sie erscheint auch in der Listenansicht.

Gehört ein Titel zu einer Reihe mit mehreren Bänden, stehen unten alle Bände in
Lesereihenfolge; der gerade geöffnete ist markiert und nicht verlinkt. Darunter führt
„weitere Titel von …" an die Stelle der Sparten-Liste, an der der Block dieses Autors
beginnt.

### Gestaltung

Farben, Schriften und Abstände stehen als Custom Properties in `src/styles/global.css` —
wer das Aussehen ändern will, ändert dort die Werte, nicht die einzelnen Komponenten.
Dunkelmodus über `prefers-color-scheme`, mobil-zuerst aufgebaut, keine Bilder, keine
Icon-Bibliothek, keine Animationen außer kurzen Farbübergängen (die bei
`prefers-reduced-motion` entfallen).

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
src/lib/sortierung.ts       deutsche Sortierung, Reihenfolge von Serien, Blätterung
src/lib/anzeige.ts          Formatierung; entscheidet, was angezeigt wird und was entfällt
src/lib/pfade.ts            das Adressschema — alle URLs an einer Stelle
src/lib/autoren.ts          wo der Block eines Autors in der Liste beginnt

src/pages/index.astro       Startseite
src/pages/sparte/           Listenansicht, alle Sortierungen und Seiten
src/pages/titel/            Detailseite je Titel
src/components/             Kachel, Listenzeile, Sortierwahl, Blätterung, Suchleiste
src/layouts/                gemeinsames Seitengerüst
src/styles/global.css       Farben, Schriften, Abstände als CSS Custom Properties

scripts/validate.py         Schemaprüfung
scripts/validate.mjs        startet validate.py mit dem passenden Python
scripts/import/             einmalige Importskripte aus Word/Excel (Beleg, nicht mehr nötig)
buecherei-daten/            Originalübergabe, unverändert als Beleg
NOTIZEN.md                  bekannte Mängel im Datenbestand
```

Technisch: [Astro](https://astro.build/) mit TypeScript, `output: 'static'`. Kein React,
kein Vue, kein Tailwind — Astro-Komponenten und reines CSS. Der Katalog kommt bisher ganz
ohne JavaScript im Browser aus; erst die Suche wird ein einzelnes Vanilla-TypeScript-Skript
brauchen.

## Bekannte Mängel im Bestand

`npm run validate` läuft fehlerfrei durch, trotzdem stecken in den Daten Altlasten aus dem
Word-Dokument: fehlerhafte ISBN, zwei vermutliche Dubletten, zwei unlesbare Fragmente,
sechs Preise in Schilling statt Euro, zusammengeschobene Autorennamen und eine Serie, die
in vier Einzelreihen zerfällt. Zwölf Punkte, alle gesammelt in [`NOTIZEN.md`](NOTIZEN.md) —
nichts davon wurde in den Daten korrigiert.

47 Einträge tragen ein Feld `_pruefen` mit dem konkreten Vermerk. Felder mit führendem
Unterstrich (`_quelle`, `_pruefen`) sind Arbeitsmaterial und werden im Katalog nie angezeigt.
