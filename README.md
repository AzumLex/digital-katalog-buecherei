# Digitaler Büchereikatalog

Statischer Online-Katalog der Büchereimedien. Der Bestand liegt als JSON im Projekt, beim
Build entsteht daraus fertiges HTML — kein Server, keine Datenbank, keine laufenden Kosten
außer dem Hosting.

Der Katalog ist zugleich Vorbereitung auf den späteren Umstieg auf ein richtiges
Bibliotheksprogramm: Die Datenfelder sind schon so geschnitten, dass sie sich ohne
Informationsverlust dorthin übernehmen lassen.

**Stand: Der Katalog steht, und der Bestand wird über die Website gepflegt.** Startseite,
Sparten-Listen mit Filtern, eine Detailseite je Titel, Volltextsuche, Sitemap und 404-Seite:
1058 fertig gebaute Seiten plus Such- und Filterdaten. Stöbern, Sortieren und Blättern
funktionieren ohne JavaScript; Suche und Filter brauchen es.

Dazu kommt die **Verwaltung** unter `/verwaltung/` — mit Passwort, ISBN-Abruf, Papierkorb,
Export und Änderungsprotokoll. Sie ist der einzige Teil des Projekts, der auf einem Server
läuft; der Katalog selbst bleibt eine Sammlung fertiger Dateien. Die Anleitung dazu steht
weiter unten unter „Anleitung für die Bücherei".

Eine frisch aufgerufene Seite wiegt **3,5 bis 12 KB** (brotli). Such- und Filterdaten
werden erst geholt, wenn jemand sie wirklich braucht.

---

## Schnellstart

Gebraucht wird **nur [Node.js](https://nodejs.org/) 18 oder neuer.** Python ist nicht
nötig — weder zum Entwickeln noch zum Veröffentlichen (siehe „Python ist optional").

```bash
npm install       # einmalig
npm run dev       # startet http://localhost:4321
```

| Befehl | Was er tut |
|---|---|
| `npm run dev` | Entwicklungsserver mit automatischem Neuladen — Verwaltung und Schnittstelle laufen dort mit |
| `npm run validate` | prüft alle Daten gegen das Schema (Node, läuft überall) |
| `npm run build` | erzeugt die fertige Website in `dist/` (prüft vorher die Daten) |
| `npm run preview` | seit dem Vercel-Adapter nicht mehr möglich — der Adapter bringt die Laufzeit mit, die Astro dafür bräuchte. Für eine Vorschau `npm run dev` nehmen. |
| `npm run check` | prüft Astro- und TypeScript-Dateien auf Fehler |
| `npm run suchtest` | prüft die Suche gegen den gebauten Index (nach `npm run build`) |
| `npm run filtertest` | prüft Facetten und Filter gegen die gebauten Sparten-Dateien |
| `npm run formattest` | prüft, ob der Schreibweg der Verwaltung die Datendateien byte-gleich zurückgibt |
| `npm run isbntest` | rechnet die Prüfziffer aller ISBN nach und hält den id-Vorschlag gegen die vorhandenen Kennungen |
| `npm run passwort` | erzeugt Passwort-Hash und Sitzungsgeheimnis für die Verwaltung |
| `npm run validate:py` | dieselbe Datenprüfung mit `validate.py` — braucht Python |
| `npm run vercelpruefen` | prüft `vercel.json` gegen das Schema von Vercel — braucht Python |

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

## Wo der Bestand liegt

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

---

## Anleitung für die Bücherei

**So wird der Bestand gepflegt.** Sie brauchen dafür nichts als einen Browser und das
Passwort — kein GitHub-Konto, keine JSON-Datei, kein installiertes Programm.

### Anmelden

`https://<adresse>/verwaltung/` aufrufen und das Passwort eingeben. Sie bleiben angemeldet,
bis Sie sich abmelden.

### Ein Buch hinzufügen

1. **„Neuer Titel"** anklicken.
2. **Die ISBN eintippen** (die Zahl unter dem Strichcode) und **„Daten holen"** drücken.
   Titel, Autor, Verlag, Jahr und Seitenzahl füllen sich von selbst.
   *Keine ISBN, oder nichts gefunden?* Dann tragen Sie die Angaben von Hand ein. Pflicht sind
   nur **Sparte**, **Art des Mediums** und **Titel**.
3. **Durchsehen und berichtigen.** Die geholten Angaben sind Vorschläge, keine Wahrheit.
4. **Was Sie nicht wissen, lassen Sie leer.** Der Katalog zeigt einfach nichts an, wo nichts
   steht — schreiben Sie bitte nichts wie „unbekannt" oder „-" hinein.
5. **„Speichern"**. Nach ein bis zwei Minuten steht der Titel im öffentlichen Katalog.
   Sie müssen nichts weiter tun.

> **Sie haben das Buch schon?** Legen Sie keinen zweiten Eintrag an. Öffnen Sie den
> vorhandenen und erhöhen Sie **„Exemplare"** auf 2. Die Verwaltung weist Sie darauf hin, wenn
> die ISBN schon im Katalog steht.

### Etwas ändern

„Bestand" → suchen → Zeile anklicken → ändern → speichern.
**Die „Kennung" lässt sich nicht ändern.** Das ist Absicht: An ihr hängt die Adresse der Seite.

### Etwas löschen

Zeile anklicken → **„In den Papierkorb legen"**. Der Eintrag wandert in den **Papierkorb** und
lässt sich dort jederzeit zurückholen. Verloren geht nichts.

> **Buch aussortiert, verkauft oder verschenkt?** Dann nicht löschen, sondern den **Status**
> auf „ausgeschieden" setzen. Löschen ist für Einträge gedacht, die aus Versehen entstanden
> sind.

### Eine Liste ausdrucken oder in Excel öffnen

„Export" → Sparte wählen (oder „Alle") → Format wählen. **Excel (CSV)** für den täglichen
Gebrauch, **JSON** für den späteren Umzug in ein Bibliotheksprogramm. Zwei Handgriffe beim
ersten Öffnen der Excel-Datei lohnen sich; sie stehen auf der Exportseite.

### Nachsehen, was geändert wurde

„Protokoll" zeigt jede Änderung am Bestand mit Datum, Uhrzeit und Titel — und zu jeder einen
Verweis darauf, was vorher dastand. Löschen oder ändern lässt sich daran nichts.

### Wenn etwas nicht geht

- **„Die Prüfziffer stimmt nicht"** — bei der ISBN hat sich eine Ziffer verlesen. Noch einmal
  vergleichen; die ISBN steht meist auch im Impressum.
- **„Diese Kennung ist schon vergeben"** — es gibt schon einen Eintrag mit gleichem Autor und
  Titel. Nachsehen, ob es dasselbe Buch ist (dann „Exemplare" erhöhen).
- **„Bitte die Seite neu laden"** — es war noch ein zweiter Tab offen. Neu laden, Änderung
  wiederholen.
- **„Das Zugriffstoken ist abgelaufen"** — das ist nichts, was Sie falsch gemacht haben.
  Bei der Person melden, die den Katalog betreut; es ist in fünf Minuten erneuert.
- **Die Änderung ist nicht im Katalog zu sehen** — ein bis zwei Minuten warten und die Seite
  neu laden. Steht sie nach fünf Minuten immer noch nicht da, melden.

---

## Einen Titel eintragen und veröffentlichen — ganz ohne Installation

> **Diese Anleitung ist die Rückfallebene.** Seit es die Verwaltung gibt (siehe oben), wird
> der Bestand nicht mehr von Hand in JSON-Dateien gepflegt. Sie bleibt trotzdem stehen und
> gilt unverändert — für den Tag, an dem die Verwaltung einmal nicht läuft, das Zugriffstoken
> abgelaufen ist oder etwas gerettet werden muss. Wer sie nicht braucht, überspringt sie.

**Diese Anleitung setzt nichts voraus außer einem Browser und einem GitHub-Konto.** Es muss
nichts installiert werden, es wird kein Programm gestartet. Wer schon einmal ein Formular
im Internet ausgefüllt hat, schafft das.

Was am Ende passiert: Sie tragen den Titel ein, GitHub prüft die Daten automatisch, und
wenn alles stimmt, ist der Titel ein paar Minuten später im Katalog zu sehen.

### Vorbereitung (einmalig)

1. Auf [github.com](https://github.com) ein Konto anlegen, falls noch keines besteht.
2. Sich bei der Person melden, die das Projekt eingerichtet hat, damit sie Ihnen
   Schreibrechte gibt. Ohne diese Rechte können Sie zwar Änderungen vorschlagen, aber
   nicht selbst veröffentlichen.

### Schritt 1 — Die richtige Datei öffnen

Im Projekt auf GitHub zum Ordner `src/data` gehen und die Datei anklicken, die zur Sparte
passt:

| Was Sie eintragen wollen | Datei |
|---|---|
| Einen Roman | `romane.json` |
| Einen Tonie | `tonies.json` |
| Ein Sachbuch | `sachbuecher.json` |
| Ein Kinderbuch | `kinderbuecher.json` |
| Ein Kinder-Sachbuch | `kinder-sachbuecher.json` |
| Ein Spiel | `spiele.json` |
| Eine CD | `cds.json` |

### Schritt 2 — In den Bearbeitungsmodus

Rechts oben über dem Text steht ein **Stift-Symbol** (Tooltip „Edit this file"). Anklicken.
Jetzt lässt sich der Text bearbeiten.

> Bei `romane.json` zeigt GitHub zuerst nur einen Hinweis, dass die Datei groß ist. Dann
> auf **„Load more"** oder direkt auf den Stift klicken.

### Schritt 3 — Einen bestehenden Eintrag kopieren

**Nicht von Hand tippen — kopieren.** So kann bei den Anführungszeichen und Kommas nichts
schiefgehen.

1. Suchen Sie einen Eintrag, der dem neuen ähnlich ist (mit `Strg+F` bzw. `Cmd+F` im
   Bearbeitungsfeld).
2. Markieren Sie ihn von der öffnenden `{` bis zur schließenden `}` — **einschließlich**
   des Kommas dahinter.
3. Kopieren (`Strg+C`), Cursor direkt dahinter setzen, einfügen (`Strg+V`).

Jetzt steht derselbe Eintrag zweimal untereinander. Den **zweiten** überschreiben Sie mit
den Angaben des neuen Titels.

### Schritt 4 — Die Angaben eintragen

Vier Regeln, mehr braucht es nicht:

- **Was Sie nicht wissen, löschen Sie ganz.** Also die komplette Zeile — nicht `""` oder
  `0` stehen lassen. Der Katalog zeigt einfach nichts an, wo nichts ist.
- **Text steht in Anführungszeichen, Zahlen nicht.** `"titel": "Der lange Sommer"`, aber
  `"jahr": 2026`.
- **Nach jeder Zeile ein Komma — außer nach der letzten** vor der `}`.
- **Die `id` muss neu sein.** Muster: Sparten-Kürzel, Nachname, Titel, die letzten vier
  Ziffern der ISBN — alles klein, Umlaute ausgeschrieben, Leerzeichen als Bindestrich:
  `rom-mustermann-der-lange-sommer-1234`. Die Kürzel stehen weiter unten unter
  „Die Regeln für `id`".

**Tragen Sie heute als `erfasst_am` ein** — im Format `"2026-08-16"` (Jahr-Monat-Tag).
Daran hängen der Filter „Neu im Bestand" und der Abschnitt „Neu im Bestand" auf der
Startseite. Das Erscheinungsjahr taugt dafür nicht: Ein antiquarisch gekauftes Buch von
1975 ist neu im Bestand, ein 2026 erschienener Titel aus dem Vorjahr nicht.

### Schritt 5 — Die Zahl ganz oben erhöhen

Ganz oben in der Datei steht eine Zeile wie:

```json
  "anzahl": 806,
```

Diese Zahl um eins erhöhen — aus `806` wird `807`. **Das ist der Schritt, der am
häufigsten vergessen wird.** Die Prüfung fängt es ab, aber sie kostet Sie sonst eine
Runde.

### Schritt 6 — Speichern

Rechts oben auf den grünen Knopf **„Commit changes…"** klicken. Es öffnet sich ein
Fenster:

- **Oberes Feld:** kurz beschreiben, was Sie getan haben, z. B.
  `Neuer Roman: Der lange Sommer (Mustermann)`.
- **Darunter** die Auswahl stehen lassen bei **„Commit directly to the `main` branch"**.
- Auf **„Commit changes"** klicken.

### Schritt 7 — Warten, bis der Haken grün ist

Oben im Projekt, neben Ihrer letzten Änderung, erscheint zuerst ein **gelber Punkt** 🟡.
GitHub prüft gerade die Daten. Nach ein bis zwei Minuten wird daraus:

- **Grüner Haken** ✅ — alles in Ordnung. Der Katalog ist aktualisiert; nach ein paar
  weiteren Minuten ist der neue Titel online. Fertig.
- **Rotes Kreuz** ❌ — in den Daten stimmt etwas nicht. **Es ist nichts kaputtgegangen und
  nichts veröffentlicht worden**; die Seite läuft unverändert weiter. Weiter bei
  „Wenn etwas rot ist".

### Wenn etwas rot ist

Auf das rote Kreuz klicken, dann auf **„Details"**. In der Ausgabe steht die Zeile, auf die
es ankommt — sie nennt Datei, Eintrag und Feld:

```
romane.json[806] rom-mustermann-der-lange-sommer-1234: jahr 3026 is greater than the maximum of 2100
```

Die häufigsten drei Fälle:

| Meldung enthält | Was zu tun ist |
|---|---|
| `anzahl=806 stimmt nicht mit 807 Einträgen überein` | Schritt 5 vergessen — Zahl oben erhöhen |
| `DOPPELTE ID: …` | Die `id` gibt es schon; eine andere wählen |
| `is not valid under any of the given schemas` / `is a required property` | Ein Feld fehlt oder hat einen falschen Wert; das Feld steht am Anfang der Zeile |

Danach dieselbe Datei erneut über den Stift bearbeiten, korrigieren, wieder speichern. Der
Katalog bleibt die ganze Zeit online.

> **Warum das so gebaut ist:** Solange die Prüfung rot ist, wird nicht veröffentlicht. Sie
> können den öffentlichen Katalog also durch einen Tippfehler nicht kaputt machen.

### Wenn Sie unsicher sind: erst vorschlagen, dann veröffentlichen

Wenn Sie sich bei einem Eintrag nicht sicher sind, wählen Sie in Schritt 6 statt
„Commit directly" die zweite Möglichkeit: **„Create a new branch for this commit and start
a pull request"**. Dann prüft GitHub Ihre Änderung, ohne sie zu veröffentlichen, und jemand
anderes kann sie ansehen und freigeben.

---

## Einen Titel hinzufügen (mit lokaler Installation)

Für alle, die das Projekt ohnehin auf dem Rechner haben.

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

## Veröffentlichen (GitHub und Vercel)

Der Katalog ist eine rein statische Website. Alles Nötige steht im Projekt: `vercel.json`
regt Build, Ausgabeverzeichnis, Installationsbefehl und Cache-Header, die GitHub Action in
`.github/workflows/pruefen.yml` prüft jede Änderung.

### Einmalig einrichten

1. Projekt zu GitHub pushen. Die Action läuft ab dem ersten Push von allein — es ist nichts
   einzurichten.
2. Auf [vercel.com](https://vercel.com) → **Add New… → Project** → das Repository wählen.
3. **Nichts umstellen, einfach Deploy klicken.** Vercel liest `vercel.json`; Framework,
   Build Command (`npm run build`), Output Directory (`dist`) und Install Command
   (`npm install`) stehen dort schon. Der Build braucht ausschließlich Node.
4. Optional, aber empfohlen: unter **Settings → Environment Variables** die Variable
   `SITE_URL` auf die endgültige Adresse setzen (z. B. `https://buecherei-musterdorf.at`).
   Sie landet in `sitemap.xml`, `robots.txt` und den Canonical-Angaben. Ohne sie nimmt der
   Build automatisch die Vercel-Produktionsadresse.

### Zwei Netze gegen kaputte Daten

**Netz 1 — beim Bauen.** `npm run build` führt vorher `npm run validate` aus. Schlägt die
Prüfung fehl, bricht der Build ab, es wird nichts veröffentlicht, und die bisherige Seite
läuft unverändert weiter. Das gilt auf Vercel genauso wie lokal.

**Netz 2 — in GitHub.** Die Action prüft bei **jedem Push und jedem Pull Request** Daten,
Typen, Build, Suche und Filter. Ihr Ergebnis ist der grüne Haken bzw. das rote Kreuz neben
jeder Änderung.

Damit ein roter Lauf auch einen Merge verhindert, in GitHub unter **Settings → Branches →
Add branch protection rule** für `main` einschalten:

- *Require status checks to pass before merging* → Prüfung **„Daten, Build und Prüfungen"**
  auswählen
- *Require a pull request before merging* (nur, wenn direkt auf `main` nicht mehr
  geschrieben werden soll — die Anleitung oben führt bewusst den direkten Weg, weil er für
  Nicht-Techniker einfacher ist)

Ohne diese Regel bleibt Netz 1 wirksam: Ein Push mit kaputten Daten lässt den Vercel-Build
scheitern, die alte Seite bleibt online.

### Danach

Jeder Push auf `main` veröffentlicht automatisch neu. Pushes auf andere Branches erzeugen
eine Vorschau-Adresse zum Anschauen, ohne die öffentliche Seite anzufassen.

### Cache-Einstellungen

In `vercel.json` hinterlegt:

| Was | Cache-Control | Warum |
|---|---|---|
| `/_astro/*` | `max-age=31536000, immutable` (ein Jahr) | Der Dateiname enthält einen Hash des Inhalts. Ändert sich der Inhalt, ändert sich der Name — die alte Datei kann ewig liegen bleiben. |
| `/suchindex.json`, `/liste/*.json` | `max-age=300, stale-while-revalidate=86400` | Kein Hash im Namen. Fünf Minuten, damit ein neuer Titel schnell auffindbar ist; `stale-while-revalidate` hält es trotzdem sofort verfügbar. |
| `sitemap.xml`, `robots.txt`, `favicon.svg` | `max-age=3600` | Ändern sich selten, sind aber unkritisch. |
| alles Übrige (HTML) | `max-age=0, must-revalidate` | HTML ist klein; so sieht niemand eine veraltete Seite mit frischen Daten. |

Die letzte Regel schließt die Sonderpfade ausdrücklich aus. Das ist nötig, weil sich
Vercel-Header-Regeln sonst gegenseitig überschreiben und eine Catch-all-Regel die
`immutable`-Angabe wieder aufheben würde.

### Python ist optional

**Für den Build und das Veröffentlichen wird kein Python gebraucht.** Die Datenprüfung, die
vor jedem Build läuft, steckt in `scripts/validate.mjs` und nutzt
[ajv](https://ajv.js.org/) gegen dasselbe `schema/medium.schema.json`. Sie prüft dasselbe
wie zuvor:

1. jeder Eintrag erfüllt das Schema,
2. `anzahl` stimmt mit der Zahl der Einträge überein,
3. keine `id` kommt zweimal vor —

und beendet sich bei Fehlern mit Exit-Code 1, wodurch der Build abbricht.

`requirements.txt` und `scripts/validate.py` bleiben trotzdem im Projekt. Sie werden nur
noch von zwei Zusatzskripten gebraucht, die **niemand für den Betrieb ausführen muss**:

| Skript | wofür |
|---|---|
| `npm run validate:py` | dieselbe Datenprüfung, als Gegenprobe zur Node-Fassung |
| `npm run vercelpruefen` | prüft `vercel.json` gegen das offizielle Schema von Vercel |

Wer diese beiden nutzen will, installiert einmalig:

```bash
pip install -r requirements.txt
```

Die GitHub Action lässt beide Datenprüfungen laufen. Sollten die Node- und die
Python-Fassung je unterschiedlich urteilen, fällt das dort auf — und nicht erst, wenn sich
jemand lokal auf ein falsches „0 Fehler" verlässt.

> **Kleiner Unterschied, bewusst so:** Beide Prüfungen werten `"format": "date"` nicht aus.
> Pythons `jsonschema` tut das ohne eigens gesetzten FormatChecker nicht, und ajv ist
> deshalb mit `validateFormats: false` konfiguriert. Ein unsinniges Datum in `erfasst_am`
> fällt also keiner der beiden auf. Das war vorher schon so und wurde absichtlich nicht
> geändert — zwei Prüfungen, die sich uneins sind, wären schlimmer.

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

                            ── die Verwaltung ──
src/lib/anmeldung.ts        Passwort-Hash und signiertes Sitzungscookie (node:crypto)
src/lib/github.ts           der einzige Weg zum Repository — und das einzige Modul,
                            das GitHub kennt
src/lib/pruefung.ts         Schemaprüfung — von validate.mjs UND der Verwaltung benutzt
src/lib/bestand.ts          wie eine Datendatei nach einer Änderung aussieht; Papierkorb
src/lib/pflege.ts           der Ablauf: prüfen, ändern, speichern
src/lib/formular.ts         welche Felder das Formular hat — aus Schema und anzeige.ts
src/lib/isbn.ts             Prüfziffer, Schreibweisen, ISBN-10 ↔ ISBN-13
src/lib/isbndienste.ts      Google Books und OpenLibrary hinter einer Schnittstelle
src/lib/kennung.ts          der id-Vorschlag nach der Regel aus diesem README
src/lib/export.ts           CSV für Excel und JSON im Dateiformat aus src/data/
src/lib/antworten.ts        eine Antwortform für alle Routen unter /api/
src/middleware.ts           der Schutzwall vor /verwaltung/ und /api/

src/pages/verwaltung/       Übersicht, Anmeldung, Bestand, Neu, Bearbeiten,
                            Papierkorb, Export, Protokoll
src/pages/api/              Anmelden, Abmelden, Medien (lesen/schreiben), ISBN, Export
src/components/Medienformular.astro   das Formular, aus formular.ts gezeichnet
src/scripts/verwaltungsformular.ts    Formular im Browser: Felder, Speichern, ISBN
src/scripts/papierkorb.ts   „Zurückholen" im Browser
src/scripts/meldung.ts      der Meldungsbalken der Verwaltung

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

scripts/validate.mjs        Datenprüfung mit ajv — läuft vor jedem Build, nur Node
scripts/validate.py         dieselbe Prüfung in Python, optionale Gegenprobe
scripts/vercelpruefen.py    prüft vercel.json gegen das Schema von Vercel (optional)
scripts/python.mjs          startet ein Python-Skript mit dem passenden Interpreter
scripts/suchtest.mts        Prüfungen für die Suche
scripts/filtertest.mts      Prüfungen für die Filter
scripts/formattest.mjs      beweist die Byte-Gleichheit des Schreibwegs der Verwaltung
scripts/isbntest.mjs        Prüfziffern und id-Vorschlag gegen den echten Bestand
scripts/passwort.mjs        erzeugt Passwort-Hash und Sitzungsgeheimnis

src/pages/sitemap.xml.ts    erzeugt dist/sitemap.xml (1011 Adressen)
src/pages/robots.txt.ts     erzeugt dist/robots.txt mit Verweis auf die Sitemap
src/pages/404.astro         Seite für unbekannte Adressen, mit funktionierender Suche
vercel.json                 Build, Ausgabeverzeichnis und Cache-Header für Vercel
.github/workflows/          GitHub Action: prüft jeden Push und jeden Pull Request
scripts/import/             einmalige Importskripte aus Word/Excel (Beleg, nicht mehr nötig)
buecherei-daten/            Originalübergabe, unverändert als Beleg
NOTIZEN.md                  bekannte Mängel im Datenbestand
```

Technisch: [Astro](https://astro.build/) mit TypeScript, `output: 'static'`. Kein React,
kein Vue, kein Tailwind — Astro-Komponenten und reines CSS. Im Browser laufen zwei
Vanilla-TypeScript-Skripte: die Suche auf der Startseite (rund 26 KB samt MiniSearch) und
die Filter auf den Sparten-Listen (rund 18 KB). Stöbern, Sortieren und Blättern
funktionieren ohne JavaScript.

`output: 'static'` bleibt auch mit der Verwaltung stehen: Der Adapter erzeugt eine
Serverfunktion nur für die Dateien, die ausdrücklich `export const prerender = false`
tragen — die Seiten unter `/verwaltung/` und die Routen unter `/api/`. Nachzählen lässt
sich das nach dem Build unter `.vercel/output/functions/`: Es darf genau ein Ordner sein.
Der Katalog selbst bleibt eine Sammlung fertiger Dateien. Zwei Laufzeit-Abhängigkeiten hat
das Projekt: `minisearch` für die Suche und `@astrojs/vercel` für die Serverroute.

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

**Dazu ein dreizehnter Punkt, der erst mit `npm run isbntest` auffiel:** Bei **zwölf**
weiteren Einträgen steht eine ISBN in den Daten, deren Prüfziffer nicht aufgeht — ohne
`_pruefen`-Vermerk, weil der Import nur Form und Länge geprüft hat. Meist ist es eine
einzelne verlesene Ziffer. Die Liste steht mit Begründung in `scripts/isbntest.mjs`; der
Testlauf verlangt, dass keine weiteren hinzukommen, und wird von selbst wieder grün, wenn
einer davon am Buch berichtigt wird. Solange die ISBN falsch ist, findet der ISBN-Abruf der
Verwaltung zu diesen Titeln nichts.
