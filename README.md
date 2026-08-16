# Digitaler Büchereikatalog

Statischer Online-Katalog der Büchereimedien. Der Bestand liegt als JSON im Projekt, beim
Build entsteht daraus fertiges HTML — kein Server, keine Datenbank, keine laufenden Kosten
außer dem Hosting.

Der Katalog ist zugleich Vorbereitung auf den späteren Umstieg auf ein richtiges
Bibliotheksprogramm: Die Datenfelder sind schon so geschnitten, dass sie sich ohne
Informationsverlust dorthin übernehmen lassen.

**Stand: Phase 4.** Startseite, Sparten-Listen mit Filtern, eine Detailseite je Titel und
die Volltextsuche stehen — 1057 fertig gebaute Seiten plus Such- und Filterdaten.
Stöbern, Sortieren und Blättern funktionieren ohne JavaScript; Suche und Filter brauchen
es.

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
| `npm run suchtest` | prüft die Suche gegen den gebauten Index (nach `npm run build`) |
| `npm run filtertest` | prüft Facetten und Filter gegen die gebauten Sparten-Dateien |

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

### Die Filter

Jede Sparten-Liste hat ein Filterpanel. **Welche Filter eine Sparte zeigt, steht nirgends
im Code** — es ergibt sich aus ihren Daten. Es gibt eine einzige Regel, für alle Sparten
dieselbe:

> Ein Feld wird zum Filter, wenn mindestens **zwei verschiedene Werte** vorkommen und
> mindestens **10 %** der Einträge das Feld überhaupt haben.

Daraus folgt von allein:

| Sparte | Filter |
|---|---|
| Romane | Genre, Erscheinungsjahrzehnt, Autor, Reihe, Zugang |
| Tonies | Genre, Autor, Reihe, Art, Altersempfehlung, Laufzeit, Zugang |
| noch leere Sparten | keine |

Tonies haben keinen Jahrzehnt-Filter, weil bei ihnen kein Erscheinungsjahr erfasst ist.
Romane bekommen umgekehrt keinen Altersfilter, obwohl zwei Titel ein `alter_ab` tragen —
2 von 806 sind 0,2 % und damit unter der Schwelle. Ein Filter, der 804 Titel wegwirft,
hilft niemandem. Spieleranzahl und Spieldauer erscheinen, sobald die Sparte Spiele Daten
bekommt.

Ab 20 Werten bekommt eine Filterliste ein eigenes Suchfeld (bei den Romanen sind das 369
Autoren und 122 Reihen). Lange Listen zeigen zunächst die zwölf häufigsten Werte.

**Verhalten**

- **Jeder Wert zeigt seine Trefferzahl.** Bei der Zählung wird die eigene Facette
  ausgeklammert: Ist „Krimi" gewählt, behält „Thriller" seine volle Zahl, sonst käme man
  nie zu einer Mehrfachauswahl. Die *anderen* Facetten rechnen dagegen mit.
- **Werte mit null Treffern bleiben stehen** und werden nur blass und unklickbar. Würde
  man sie entfernen, sprängen die übrigen bei jedem Klick an eine andere Stelle.
- **Mehrere Werte einer Facette wirken als ODER** („Krimi oder Thriller"), verschiedene
  Facetten als UND.
- **Der Filterzustand steht in der Adresse:** `/sparte/romane/?genre=Krimi&jahrzehnt=2020`,
  Spannen als `?alter=..5` oder `?laufzeit=20..60`. Solche Links lassen sich teilen, und
  der Zurück-Knopf nimmt Filter einzeln wieder zurück.
- **„Alle Filter zurücksetzen"** steht über der Liste, sobald ein Filter aktiv ist,
  daneben jeder aktive Filter als einzeln abwählbare Schaltfläche.
- **Auf dem Handy** ist das Panel zugeklappt und zeigt nur die Zahl der aktiven Filter; ab
  48 rem steht es offen.
- **Sortierung bleibt erhalten:** Ein Wechsel der Sortierung nimmt die Filter mit.
- **Filter und Suche sind kombinierbar** — im Panel steht ein Suchfeld für diese Sparte.

**„Neu im Bestand"** meint Titel, deren `erfasst_am` höchstens 90 Tage zurückliegt —
ausdrücklich **nicht** das Erscheinungsjahr. Ein antiquarisch beschafftes Buch von 1975
ist neu im Bestand, ein 2026 erschienener Titel, der seit einem Jahr im Regal steht, ist
es nicht. Solange nirgends ein `erfasst_am` gepflegt ist, steht der Schalter auf 0 und ist
ausgegraut wie jeder andere Wert ohne Treffer.

**Wie es technisch läuft:** Die ungefilterte Liste steht fertig im HTML. Sobald ein Filter
greift, holt der Browser einmal `/liste/<sparte>.json` (Romane rund 70 KB komprimiert) und
filtert, sortiert und blättert von da an lokal — **pro Filterklick wird nichts
nachgeladen**. Wer nur blättert, lädt die Datei nie. Sortiert wird dabei mit demselben
Modul wie im Build, und die Zeilen entstehen aus denselben Feldern; die gefilterte Liste
kann also nicht anders aussehen oder anders geordnet sein als die statische.

### Die Suche

Gesucht wird mit [MiniSearch](https://github.com/lucaong/minisearch), vollständig im
Browser. Der Index entsteht beim Build und wird als eine Datei ausgeliefert
(`/suchindex.json`, rund 590 KB, komprimiert etwa 140 KB); er wird erst geladen, wenn
jemand das Suchfeld anfasst. **Die Seite schickt keine einzige Anfrage nach außen** — kein
Suchverlauf, keine Zählpixel, keine fremden Server.

Durchsucht werden, absteigend gewichtet: Titel, Autor, Reihe, Untertitel, Verlag, Genre,
Figur. Getippt wird ab dem zweiten Zeichen, gesucht 150 ms nach dem letzten Tastendruck.
Treffer erscheinen nach Sparte gruppiert mit Trefferzahl, der Suchbegriff ist im Treffer
hervorgehoben, und die Anfrage steht in der Adresse (`/?q=krimi`) — Trefferlisten lassen
sich also verlinken, und der Zurück-Knopf führt aus einem Titel wieder auf die Liste.

**Tastatur:** `/` springt ins Suchfeld, Pfeiltasten gehen durch die Treffer, Enter öffnet,
Escape leert.

#### Normalisierung

Das ist der Teil, an dem eine Suche steht oder fällt.

- **Umlaute in beide Richtungen.** „Muller", „Müller" und „Mueller" finden einander,
  ebenso „Grösse", „Größe" und „Groesse". Dafür wird beim Indexieren jedes Wort in zwei
  Formen abgelegt — auf den Grundbuchstaben gefaltet (`müller` → `muller`) und
  ausgeschrieben (`mueller`). Die **Suchanfrage** wird dagegen nur auf die Grundform
  gebracht. Diese Asymmetrie ist Absicht: MiniSearch verknüpft mehrere Terme aus
  `processTerm` mit demselben Operator wie die übrigen Suchwörter, bei `AND` müsste ein
  Buch also beide Schreibweisen enthalten. Für „Müller" ginge das gut, für „Ægisdóttir"
  nicht.
- **Groß-/Kleinschreibung und Satzzeichen** spielen keine Rolle; „O'Mahony" findet
  „OMahony" und umgekehrt.
- **Komposita.** Zusätzlich zur normalen Zerlegung werden Wortbestandteile ab vier Zeichen
  indexiert, damit „Krimi" auch „Alpenkrimi" und „Kriminalroman" findet. Das ist kein
  allgemeiner Kompositazerleger, sondern ein Abgleich gegen den eigenen Wortschatz:
  „Kriminalroman" wird nur in „krimi" und „roman" zerlegt, weil beides im Katalog
  tatsächlich als eigenes Wort vorkommt. Ein Fugen-s wird dabei übersprungen.
- **Bindestrichwörter in beide Richtungen.** „Island-Krimi" ist über „Island", über
  „Krimi" und über „Islandkrimi" zu finden.
- **Gesucht wird in drei Stufen:** erst exakt, dann als Wortanfang, dann unscharf
  (Fuzzy-Distanz 0.2). Die Stufen laufen getrennt und werden aneinandergehängt, damit ein
  exakter Treffer **immer** vor einem unscharfen steht — die eingebaute Gewichtung allein
  garantiert das nicht.
- **Mehrere Suchwörter grenzen ein** (UND-Verknüpfung): „alex beer" findet Alex Beer, nicht
  jedes Buch mit „Alex" oder „Beer".

Bei null Treffern erscheint „Meinten Sie …?" mit dem nächstliegenden Begriff aus dem
Bestand, in der Schreibweise, wie sie dort steht — dafür liegt dem Index ein kleines
Begriffsverzeichnis bei. Findet sich auch unscharf nichts Verwandtes, entfällt der
Vorschlag; geraten hilft niemandem. Darunter steht in jedem Fall der Hinweis auf die
Fernleihe.

`npm run suchtest` prüft all das gegen den gebauten Index — mit demselben Modul, das auch
im Browser läuft.

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
src/lib/suchoptionen.ts     Normalisierung und Suchlogik — läuft im Build UND im Browser
src/lib/suchdokumente.ts    baut den Index; nur im Build, nie im Browser
src/lib/facetten.ts         Filter: Ableitung, Zählung, Adresszeile — Build UND Browser
src/lib/listendaten.ts      baut /liste/<sparte>.json; nur im Build
src/lib/zeile.ts            was in einer Listenzeile steht — Build UND Browser

src/pages/index.astro       Startseite
src/pages/sparte/           Listenansicht, alle Sortierungen und Seiten
src/pages/titel/            Detailseite je Titel
src/pages/suchindex.json.ts erzeugt dist/suchindex.json
src/pages/liste/            erzeugt dist/liste/<sparte>.json
src/scripts/suche.ts        Volltextsuche im Browser (nur Startseite)
src/scripts/filter.ts       Filter im Browser (nur Sparten-Listen)
src/components/             Kachel, Listenzeile, Sortierwahl, Blätterung, Suchleiste, Filterpanel
src/layouts/                gemeinsames Seitengerüst
src/styles/global.css       Farben, Schriften, Abstände als CSS Custom Properties

scripts/validate.py         Schemaprüfung
scripts/validate.mjs        startet validate.py mit dem passenden Python
scripts/suchtest.mts        Prüfungen für die Suche
scripts/filtertest.mts      Prüfungen für die Filter
scripts/import/             einmalige Importskripte aus Word/Excel (Beleg, nicht mehr nötig)
buecherei-daten/            Originalübergabe, unverändert als Beleg
NOTIZEN.md                  bekannte Mängel im Datenbestand
```

Technisch: [Astro](https://astro.build/) mit TypeScript, `output: 'static'`. Kein React,
kein Vue, kein Tailwind — Astro-Komponenten und reines CSS. Im Browser laufen zwei
Vanilla-TypeScript-Skripte: die Suche auf der Startseite (rund 26 KB samt MiniSearch) und
die Filter auf den Sparten-Listen (rund 18 KB). Stöbern, Sortieren und Blättern
funktionieren ohne JavaScript.

Die Module unter `src/lib/` und `src/scripts/` geben in ihren Importen die `.ts`-Endung
an. Das ist Absicht: So kann Node sie in den Prüfskripten direkt laden, und die Prüfungen
testen den echten Code statt einer Nachbildung.

## Bekannte Mängel im Bestand

`npm run validate` läuft fehlerfrei durch, trotzdem stecken in den Daten Altlasten aus dem
Word-Dokument: fehlerhafte ISBN, zwei vermutliche Dubletten, zwei unlesbare Fragmente,
sechs Preise in Schilling statt Euro, zusammengeschobene Autorennamen und eine Serie, die
in vier Einzelreihen zerfällt. Zwölf Punkte, alle gesammelt in [`NOTIZEN.md`](NOTIZEN.md) —
nichts davon wurde in den Daten korrigiert.

47 Einträge tragen ein Feld `_pruefen` mit dem konkreten Vermerk. Felder mit führendem
Unterstrich (`_quelle`, `_pruefen`) sind Arbeitsmaterial und werden im Katalog nie angezeigt.
