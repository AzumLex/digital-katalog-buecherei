# Plan: Bestandspflege über eine Website

Wie der Katalog von Menschen gepflegt werden kann, die weder Git noch JSON kennen —
ohne die Eigenschaften aufzugeben, wegen derer er so gebaut ist, wie er gebaut ist.

Stand des Plans: 22.08.2026 · Grundlage: Astro 5 statisch, Vercel, GitHub Action.

---

## 1. Worum es geht

Heute wird der Bestand gepflegt, indem jemand `src/data/romane.json` bearbeitet — über
GitHub im Browser oder lokal. Die Anleitung dafür steht im README und ist so geduldig
geschrieben, wie man das nur schreiben kann. Sie verlangt trotzdem, dass jemand ein Komma
an der richtigen Stelle setzt, `"anzahl"` von Hand hochzählt und versteht, was ein Commit
ist. Das ist die Grenze, an die dieser Aufbau stößt, sobald die Pflege an eine Person
übergeht, die das nicht kann und auch nicht lernen will.

Gebraucht wird: **anmelden, suchen, hinzufügen (am liebsten über die ISBN), ändern,
löschen, exportieren.** Ohne Installation, ohne Git, ohne JSON.

### Die Zahlen, an denen sich die Lösung messen muss

| | |
|---|---|
| Bestand heute | 987 Einträge (806 Romane, 181 Tonies, fünf Sparten noch leer) |
| Bestand im Endausbau | **rund 3 500 Einträge** |
| Änderungen | **etwa 10 Zugänge und 10 Abgänge im Monat** |
| Pflegende Personen | **eine** |

Das sind kleine Zahlen. Rund **20 Schreibvorgänge im Monat, einer alle anderthalb Tage,**
von einer einzigen Person. Gleichzeitiges Bearbeiten gibt es nicht, Sperren braucht niemand,
Skalierung ist kein Thema. Wer bei dieser Last eine Datenbank aufstellt, stellt sie nicht
wegen der Last auf.

### Was nicht verloren gehen darf

| Eigenschaft | Warum sie zählt |
|---|---|
| Seiten wiegen 3,5–12 KB, kein Server im Weg | Am Regal, auf einem alten Handy, im WLAN der Bücherei |
| Die Suche schickt keine Anfrage nach außen | Kein Suchverlauf, keine Zählpixel — steht so im README |
| Keine laufenden Kosten außer Hosting | Eine Bücherei hat kein IT-Budget |
| Kaputte Daten werden nie veröffentlicht | Die Prüfung hängt vor dem Build und bricht ihn ab |
| Der Bestand liegt in Git | Jede Änderung ist nachvollziehbar und rücknehmbar |
| Ohne Netz baubar | `npm run build` funktioniert im Zug |

Diese Liste ist der Maßstab. Jede Lösung, die einen dieser Punkte opfert, muss dafür sehr
viel zurückgeben.

---

## 2. Die Entscheidung

### Empfohlen: Die Verwaltung schreibt in das Repository ✅

Kein zusätzlicher Dienst, keine Datenbank. Die Verwaltungsseite läuft als Serverroute auf
Vercel, prüft die Eingabe gegen `schema/medium.schema.json` und legt die geänderte
JSON-Datei über die GitHub-API als Commit ab. Der Rest passiert wie heute von allein.

```
              Verwaltung (Browser)
                      │  Formular, ISBN-Abruf, Löschen, Export
                      ▼
      Astro-Serverroute auf Vercel
                      │  1. Ajv-Prüfung gegen medium.schema.json
                      │     (dieselbe Funktion wie npm run validate)
                      │  2. Eintrag einfügen, anzahl und stand nachziehen
                      ▼
        GitHub — ein Commit je Speichervorgang
                      │  „Neuer Roman: Der lange Sommer (Mustermann)"
      ┌───────────────┴───────────────┐
      ▼                               ▼
  GitHub Action                   Vercel baut neu
  (Gegenprobe)                    prebuild → validate → Build
                                       ▼
                                  Katalog, statisch wie bisher
```

**Warum das hier die richtige Lösung ist:**

- **Es bleibt eine einzige Quelle der Wahrheit.** Die JSON-Dateien. Keine Datenbank, die
  danebensteht und mit dem Schema auseinanderlaufen kann.
- **Versionsgeschichte, Sicherung und Rückgängig sind schon da** — Git macht das seit 2005
  und kostet nichts. Ein versehentlich gelöschter Titel ist ein `git revert`, kein
  Wiederherstellungsfall.
- **Das Änderungsprotokoll muss nicht gebaut werden.** Es ist die Commit-Liste. Wer wann was
  geändert hat, steht dort mit Vorher/Nachher — genauer, als eine selbstgebaute Tabelle es
  je wäre.
- **Kein „Veröffentlichen"-Knopf.** Speichern *ist* Veröffentlichen. Bei Weg A müsste man
  einem Menschen erklären, warum seine gespeicherte Änderung noch nicht im Katalog steht.
  Hier gibt es diesen Zustand nicht.
- **Kein zweiter Dienst, der ausfallen, pausieren oder Geld kosten kann.**
- **Die Prüfkette bleibt unverändert** und bekommt sogar eine Stufe dazu: Bisher fiel ein
  Fehler erst in der GitHub Action auf, künftig sagt das Formular es sofort — und
  fehlerhafte Daten kommen gar nicht erst ins Repository.

**Was es kostet:** Ein Zeitversatz von ein bis zwei Minuten zwischen „Speichern" und „im
Katalog sichtbar" (den hätte Weg A auch). Und die Aussicht, dass eine spätere
Ausleihverwaltung damit nicht zu bauen ist — dazu § 7.

### Die beiden Wege, die es nicht geworden sind

**Weg A — Supabase als Quelle der Wahrheit, Katalog bleibt statisch.** Technisch sauber, und
für die spätere Ausleihe die richtige Grundlage. Bei 20 Änderungen im Monat und einer
pflegenden Person kauft man damit aber vor allem Teile ein, die kaputtgehen können: ein
zweites Konto, RLS-Regeln, ein Abgleich zwischen Schema und Tabelle, ein Export-Skript
zurück ins JSON, ein Protokoll-Trigger, ein Deploy-Hook — und ein Projekt im kostenlosen
Tarif, das bei Untätigkeit pausiert, was bei einer Änderung alle anderthalb Tage kein
theoretischer Fall ist. Der Gegenwert wäre eine Nebenläufigkeit, die es nicht gibt.
**Wenn die Ausleihe kommt, ist Weg A der Umstieg** — und weil der Bestand dann immer noch
als JSON im Repository liegt, ist er dieselbe Arbeit wie heute, keinen Handgriff mehr (§ 7).

**Weg B — alles dynamisch, jede Seite fragt eine Datenbank.** Opfert jeden Punkt der Tabelle
in § 1 gleichzeitig. Nicht ernsthaft erwogen.

### Zwei Zahlen, die den Weg prägen

Aus dem heutigen Bestand gerechnet: **1 093 Bytes je Eintrag.** Bei 3 500 Einträgen sind
das rund **3,6 MB** über alle Dateien, und `romane.json` wächst dabei über **1 MB** hinaus.

Daraus folgen zwei Festlegungen, die weiter unten wieder auftauchen:

1. Die GitHub-**Contents**-API liefert Dateiinhalte nur bis etwa 1 MB direkt aus.
   `romane.json` wird diese Grenze reißen. Gelesen und geschrieben wird deshalb über die
   **Git-Data-API** (Blob → Tree → Commit → Ref), die keine solche Grenze hat und nebenbei
   mehrere Dateien in einem Commit erlaubt.
2. Jeder Speichervorgang schreibt die ganze Datei — 20-mal im Monat gut 1 MB. Das klingt
   nach viel und ist keins: Git legt aufeinanderfolgende, fast gleiche Fassungen als
   Differenz ab. Der Zuwachs pro Änderung liegt im einstelligen Kilobyte-Bereich.

---

## 3. Anmeldung

Bei genau einer pflegenden Person ist der einfachste Weg auch der richtige: **ein Passwort,
das in den Vercel-Einstellungen hinterlegt ist.** Kein zusätzlicher Dienst, keine neue
Abhängigkeit, nichts zu verwalten.

Mit drei Bedingungen, die nicht verhandelbar sind:

- **In der Umgebungsvariablen steht ein Hash, nicht das Passwort.** `scrypt` aus
  `node:crypto`, Salt inbegriffen. Wer die Vercel-Einstellungen einsieht, sieht kein
  Passwort. Ein kleines Skript `npm run passwort` erzeugt den Hash zum Eintragen.
- **Vergleich in konstanter Zeit** (`crypto.timingSafeEqual`).
- **Die Sitzung ist ein signiertes Cookie** (HMAC-SHA256 mit einem zweiten Geheimnis
  `SITZUNG_GEHEIMNIS`), httpOnly, Secure, SameSite=Lax, Ablauf nach 30 Tagen. Kein
  Sitzungsspeicher nötig, kein Zustand auf dem Server.

Alles davon steckt in `node:crypto` — **keine einzige neue Abhängigkeit.**

> **Wenn später mehrere Personen pflegen:** dann nicht mehrere Passwörter, sondern
> **GitHub-Anmeldung (OAuth)**. Der Vorteil ist nicht die Sicherheit, sondern die
> Zuordnung: Der Commit trägt dann den Namen der Person, die ihn ausgelöst hat, und die
> Zugriffsrechte sind die des Repositories — nichts Zusätzliches zu pflegen. Der Aufbau
> unten ist so geschnitten, dass nur `src/lib/anmeldung.ts` ausgetauscht werden muss.

**Zugriff auf das Repository** über ein **fein abgestuftes Zugriffstoken** (Fine-grained PAT),
das ausschließlich auf dieses eine Repository zeigt und nur eine Berechtigung hat:
*Contents: Read and write*. Ablaufdatum notieren — läuft es ab, schlägt das Speichern fehl,
und die Meldung muss das im Klartext sagen (§ 5).

---

## 4. Der Aufbau im Einzelnen

### 4.1 Was serverseitig läuft — und was nicht

Der Katalog bleibt zu 100 % statisch. Nur `/verwaltung/*` und `/api/*` werden auf dem Server
ausgeführt: `output: 'static'` bleibt stehen, dazu kommt `@astrojs/vercel`, und jede
Verwaltungsdatei bekommt `export const prerender = false`. Nach dem Umbau muss `npm run build`
weiterhin dieselbe Zahl statischer Seiten erzeugen — das ist die Abnahmebedingung, nicht
eine Nebenbemerkung.

`node:crypto` verlangt die Node-Laufzeit, nicht Edge. Der Vercel-Adapter macht das
standardmäßig richtig; es darf nur niemand auf Edge umstellen.

### 4.2 Die GitHub-Anbindung — `src/lib/github.ts`

Das Herzstück, und mit Absicht das einzige Modul, das GitHub kennt.

**Lesen** — `holeSparte(sparte)`: über die Git-Data-API den Blob zum Pfad
`src/data/<sparte>.json` holen, Inhalt und Blob-SHA zurückgeben. Der SHA wandert als
verstecktes Feld ins Formular und kommt beim Speichern zurück.

**Schreiben** — `speichereSparten(dateien, meldung)`:

```
1. Ref main lesen           → Commit-SHA
2. Blob je geänderter Datei → Blob-SHA
3. Tree auf Basis des alten → Tree-SHA
4. Commit erzeugen          → Commit-SHA
5. Ref main setzen (nicht erzwungen)
```

Schritt 5 ohne `force`: Hat sich `main` zwischenzeitlich bewegt, lehnt GitHub ab. Dann wird
**einmal automatisch neu gelesen und neu versucht**; scheitert es wieder, bekommt die Person
„Bitte die Seite neu laden und noch einmal speichern". Das passiert bei einer pflegenden
Person praktisch nie — aber „praktisch nie" ist nicht „nie": zwei offene Tabs, ein
Doppelklick auf „Speichern", ein Nachtrag während eines laufenden Builds.

Dass mehrere Dateien in **einen** Commit gehen, wird an genau einer Stelle gebraucht, aber
dort zwingend: beim Verschieben eines Titels in eine andere Sparte (er verschwindet aus der
einen Datei und taucht in der anderen auf) und beim Löschen (§ 4.5).

**Commit-Meldungen** in der Sprache des Projekts, damit die Historie lesbar bleibt:

```
Neuer Roman: Der lange Sommer (Mustermann)
Geändert: rom-beer-die-rote-frau-6761 — jahr, verlag
Gelöscht: ton-paw-patrol-abenteuer-bucht
```

Als Commit-Autor wird die Bücherei eingetragen (Name und E-Mail aus Umgebungsvariablen),
damit die Historie nicht so aussieht, als hätte ein Entwickler den Bestand gepflegt.

### 4.3 Schreiben heißt prüfen

Jede schreibende Route prüft **vor** dem Commit:

1. **Ajv gegen `schema/medium.schema.json`** — dieselbe Funktion, die `npm run validate`
   benutzt. Dafür wandert die Ajv-Einrichtung aus `scripts/validate.mjs` nach
   `src/lib/pruefung.ts`; Skript und Serverroute rufen danach dasselbe auf. Der Kommentar in
   `validate.mjs` („wenn sie je auseinanderlaufen, fällt es dort auf") beschreibt genau das
   Problem, das damit gar nicht erst entsteht.
2. **`id` eindeutig** über alle Sparten hinweg — die Prüfung, die heute `daten.ts` beim Build
   macht und die den Build abbricht. Sie hier vorzuziehen heißt: Der Fall kommt nie mehr vor.
3. **`anzahl` und `stand` werden gesetzt, nicht eingegeben.** Der Schritt, den das README
   heute von Hand verlangt und der laut eigener Anleitung „am häufigsten vergessen wird",
   fällt ersatzlos weg.
4. **Feldreihenfolge und Formatierung stabil** — Reihenfolge des Schemas, zwei Leerzeichen
   Einrückung, abschließender Zeilenumbruch. Sonst zeigt der Diff bei jeder Änderung die
   ganze Datei, und die Historie ist wertlos.

Kaputte Daten kommen damit gar nicht erst ins Repository. Die GitHub Action bleibt trotzdem
stehen — als Gegenprobe, so wie heute schon `validate.py` gegen `validate.mjs` gegengeprüft
wird. Und die letzte Verteidigungslinie steht ohnehin: `prebuild` bricht den Build ab, und
bei einem abgebrochenen Build bleibt die bisherige Fassung online.

### 4.4 Die Verwaltungsseiten

| Adresse | Inhalt |
|---|---|
| `/verwaltung/anmelden/` | Passwort |
| `/verwaltung/` | Zahlen je Sparte · letzte zehn Änderungen · Stand des letzten Builds |
| `/verwaltung/bestand/` | Tabelle mit Suchfeld, Spartenfilter, Blätterung |
| `/verwaltung/neu/` | ISBN-Feld ganz oben, darunter das volle Formular |
| `/verwaltung/bearbeiten/[id]/` | dasselbe Formular, gefüllt |
| `/verwaltung/papierkorb/` | Gelöschtes, mit „Wiederherstellen" |
| `/verwaltung/export/` | JSON · Excel · CSV, ganzer Bestand oder eine Sparte |
| `/verwaltung/protokoll/` | Die Commit-Liste zu `src/data/`, lesbar aufbereitet |

Gestaltet mit `src/styles/global.css` und dem vorhandenen `Grundgeruest.astro` — kein zweites
Design, keine UI-Bibliothek. Die Blätterung kommt aus `Blaetterung.astro`.

**Das Formular** entsteht aus `schema/medium.schema.json`: `enum` → Auswahlfeld,
`integer`/`number` → Zahlenfeld, `description` → Hilfetext unter dem Feld, `pattern` →
`pattern`-Attribut. Gruppiert wie die Detailseite (Inhalt · Ausgabe · In der Bücherei) — die
Aufteilung steht schon in `src/lib/anzeige.ts` (`angabenInhalt`, `angabenAusgabe`,
`angabenBestand`) und wird von dort übernommen, nicht neu erfunden. Felder, die zur gewählten
Sparte nicht passen (`figur` bei Romanen, `spieler_min` bei Tonies), werden ausgeblendet.

Drei Regeln aus der bisherigen Anleitung übernimmt das Formular als Verhalten, sodass sie
niemand mehr lesen muss:

- Leeres Feld → Feld wird gar nicht geschrieben (nicht `""`). Das behebt zugleich den
  Missstand aus NOTIZEN.md § 6 für alle neuen Einträge.
- Die `id` wird vorgeschlagen (§ 4.6) und ist beim Bearbeiten **gesperrt**.
- `erfasst_am` wird bei „Neu" auf das heutige Datum vorbelegt.

**Die Bestandsliste** hält alle Einträge einer Sparte im Speicher der Serverfunktion und
filtert dort. Bei 3 500 Einträgen ist das eine Datei von unter 4 MB und eine Suche, die
niemand als Wartezeit wahrnimmt. Kein Index, keine Vorberechnung — solange die Zahlen so
klein sind, wäre beides nur Ballast.

### 4.5 Löschen: der Papierkorb liegt schon bereit

Das Projekt hat die Lösung dafür schon eingebaut, ohne dass es dafür gedacht war: **Dateien
mit führendem Unterstrich werden weder von `scripts/validate.mjs` noch von `src/lib/daten.ts`
eingelesen** (`_unlesbar.json` ist der Beleg).

Gelöschte Einträge wandern deshalb nach **`src/data/_geloescht.json`** — im selben Commit,
in dem sie aus ihrer Sparte verschwinden. Sie sind aus dem Katalog raus, aber vollständig da,
und der Papierkorb stellt sie mit einem Klick zurück. Kein Schemafeld muss dafür erfunden
werden, kein Filter im Build muss angepasst werden, nichts am Katalog ändert sich.

Dazu kommt die Historie: Selbst wenn jemand den Papierkorb leert, steht jeder je gelöschte
Eintrag noch im Git-Verlauf.

> **Buch aussortiert, verkauft, verschenkt?** Das ist **kein** Löschen, sondern
> `status: "ausgeschieden"` — eine Aussage über das Buch, die in den Katalog gehört. Löschen
> heißt „der Datensatz war ein Versehen". Die Oberfläche muss diesen Unterschied benennen,
> sonst verschwinden aussortierte Bücher spurlos statt sichtbar zu bleiben.

### 4.6 ISBN-Abruf und id-Vorschlag

Der Abruf **füllt das Formular aus, er speichert nicht.** Wer eine ISBN eingibt, bekommt
einen Vorschlag, den er ansieht, korrigiert und dann selbst speichert. Fremde Metadaten sind
oft falsch, und NOTIZEN.md zeigt, wie genau in diesem Bestand hingesehen wird.

Anbieter hintereinander, erster Treffer gewinnt, Herkunft wird angezeigt („Angaben von
Google Books"):

1. **Google Books** — `https://www.googleapis.com/books/v1/volumes?q=isbn:<isbn>`, kein
   Schlüssel nötig, JSON, gute Abdeckung deutschsprachiger Titel.
2. **OpenLibrary** — `https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data`,
   kein Schlüssel, bei deutschen Titeln lückenhaft, aber ein brauchbarer zweiter Versuch.
3. **DNB (SRU)** — die sachlich besten Angaben für deutschsprachige Bücher (Verlag, Ort,
   Seiten, Einband). **Vor dem Bau die aktuellen Nutzungsbedingungen und die Frage prüfen,
   ob ein Zugangstoken nötig ist** — das hat sich in der Vergangenheit geändert. Deshalb als
   dritter, nachrüstbarer Anbieter hinter einer gemeinsamen Schnittstelle
   (`interface Anbieter { name: string; hole(isbn): Promise<Teilmedium | null> }`).

Zwei Prüfungen laufen, **bevor** irgendein Dienst gefragt wird:

- **Prüfziffer rechnen.** NOTIZEN.md § 3 listet 15 Einträge mit kaputter ISBN. Die
  Oberfläche sagt „Die Prüfziffer stimmt nicht — bitte noch einmal ansehen", statt einen
  Dienst nach einer Zahl zu fragen, die es nicht gibt.
- **Schon im Bestand?** Dann sofort: „Steht schon im Katalog: … — zweites Exemplar? Dann
  `bestand` erhöhen statt neu anlegen." Das ist der Fall aus NOTIZEN.md § 2, abgefangen an
  der Stelle, an der er entsteht.

**id-Vorschlag** in `src/lib/kennung.ts`, nach der Regel aus dem README: Sparten-Kürzel
(`rom-`, `sac-`, `kib-`, `kis-`, `ton-`, `spi-`, `cds-`) + Nachname + Titel + letzte vier
ISBN-Ziffern, alles klein, Umlaute ausgeschrieben, Leerzeichen als Bindestrich. `slug()` aus
`src/lib/anzeige.ts` macht das schon — wiederverwenden. Ist die id vergeben, wird `-2`
angehängt. Beim Bearbeiten ist das Feld gesperrt: „Eine einmal vergebene id nie wieder
ändern."

### 4.7 Export und Protokoll

**Export** liest dieselben Dateien wie die Bestandsliste — kein eigener Weg zu den Daten:

- **JSON** — exakt das Dateiformat aus `src/data/`, für den späteren Umzug in ein
  Bibliotheksprogramm.
- **CSV** — UTF-8 **mit BOM**, Semikolon als Trenner. Öffnet in deutschem Excel mit
  Doppelklick, ohne Importdialog, mit richtigen Umlauten.
- **Excel (.xlsx)** — braucht als einziger Punkt dieses Plans eine neue Abhängigkeit
  (`exceljs`). Ob sie das wert ist, ist Paket 1 zu entscheiden: CSV mit BOM tut in Excel
  dasselbe, nur ohne fixierte Kopfzeile und gesetzte Spaltenbreiten.

**Protokoll** ist die Commit-Liste: `GET /repos/{owner}/{repo}/commits?path=src/data` liefert
Meldung, Zeitpunkt und Autor. Verlinkt auf die Ansicht bei GitHub, wo Vorher und Nebeneinander
stehen. Ein selbstgebautes Protokoll wäre schlechter und müsste gepflegt werden.

---

## 5. Was schiefgehen kann — und was dagegen steht

| Risiko | Gegenmaßnahme |
|---|---|
| **Das Zugriffstoken läuft ab** — das wahrscheinlichste Problem überhaupt | Ablaufdatum bei der Einrichtung notieren. Die Fehlermeldung beim Speichern muss im Klartext sagen: „Das Zugriffstoken für GitHub ist abgelaufen. Bitte bei … ein neues erzeugen." Nicht „401". Zusätzlich zeigt `/verwaltung/` das Ablaufdatum an, sobald es unter 30 Tage fällt. |
| **Geheimnisse landen im Browser-Bündel** | Nur in `.ts`-Serverdateien und `middleware.ts` verwenden, nie in `<script>` einer `.astro`-Datei und nie als Prop weiterreichen. Ohne `PUBLIC_`-Präfix stellt Astro sie im Client gar nicht bereit. Zusätzlich nach dem Build `grep -rE "github_pat_\|ghp_" dist/` als Schritt in der Action. |
| **Verwaltungsseiten im Suchindex** | `Disallow: /verwaltung/` in `src/pages/robots.txt.ts`, `X-Robots-Tag: noindex` für `/verwaltung/` und `/api/` in `vercel.json` (`npm run vercelpruefen` muss grün bleiben), `/verwaltung/` aus `sitemap.xml.ts` heraushalten. |
| **Zwei offene Tabs, ein Doppelklick** | Blob-SHA im Formular, Ref-Aktualisierung ohne `force`, ein automatischer Wiederholungsversuch, danach „Bitte neu laden". § 4.2. |
| **Die Datei wird beim Schreiben zerstört** (halber Commit, kaputtes JSON) | Kann nicht passieren: Der Commit enthält immer eine vollständige, vorher gegen das Schema geprüfte Datei. Und selbst dann bricht `prebuild` den Build ab und die bisherige Fassung bleibt online. |
| **`romane.json` überschreitet 1 MB** | Git-Data-API statt Contents-API. § 2. |
| **Jeder Commit stößt einen Build und einen Action-Lauf an** | 20 im Monat. Weit unter jeder Grenze, bei einem öffentlichen Repository sind die Action-Minuten ohnehin frei. |
| **Vercel Hobby erlaubt keine kommerzielle Nutzung** | Für eine Bücherei ohne Erlösabsicht in aller Regel unkritisch — vor dem Start einmal gegen die aktuellen Bedingungen halten. |

**Laufende Kosten: 0 €.** Vercel Hobby, GitHub, sonst nichts.

### Zwei Dinge, die mit 3 500 Einträgen zu beobachten sind

Nicht Teil dieses Umbaus, aber durch die neue Zielgröße absehbar und deshalb hier notiert:

- **Der Suchindex wächst mit.** Heute 590 KB roh / ~140 KB komprimiert bei 987 Einträgen;
  bei 3 500 rund 2 MB / ~500 KB. Er wird erst geladen, wenn jemand das Suchfeld anfasst —
  aber ab etwa 1 000 Einträgen lohnt es, das nachzumessen und gegebenenfalls je Sparte zu
  teilen.
- **Die Zahl der gebauten Seiten wächst von 1 058 auf grob 3 700.** Die Bauzeit steigt
  entsprechend. Bei 20 Builds im Monat unkritisch, aber der Wert gehört in die
  Umfangs-Zusammenfassung der Action, die es schon gibt.

---

## 6. Anleitung für die Bücherei

*Diese Fassung kommt am Ende ins README und ersetzt dort die JSON-Anleitung. Sie steht schon
hier, damit beim Bauen klar ist, worauf alles hinauslaufen muss.*

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
> vorhandenen und erhöhen Sie **„Bestand"** auf 2. Die Verwaltung weist Sie darauf hin, wenn
> die ISBN schon im Katalog steht.

### Etwas ändern

„Bestand" → suchen → Zeile anklicken → ändern → speichern.
**Die „id" lässt sich nicht ändern.** Das ist Absicht: An ihr hängt die Adresse der Seite.

### Etwas löschen

Zeile anklicken → **„Löschen"**. Der Eintrag wandert in den **Papierkorb** und lässt sich
dort jederzeit zurückholen. Verloren geht nichts.

> **Buch aussortiert, verkauft oder verschenkt?** Dann nicht löschen, sondern den **Status**
> auf „ausgeschieden" setzen. Löschen ist für Einträge gedacht, die aus Versehen entstanden
> sind.

### Eine Liste ausdrucken oder in Excel öffnen

„Export" → Sparte wählen (oder „Alle") → Format wählen. **Excel** für den täglichen Gebrauch,
**JSON** für den späteren Umzug in ein Bibliotheksprogramm.

### Wenn etwas nicht geht

- **„Die Prüfziffer stimmt nicht"** — bei der ISBN hat sich eine Ziffer verlesen. Noch einmal
  vergleichen; die ISBN steht meist auch im Impressum.
- **„Diese id gibt es schon"** — es gibt schon einen Eintrag mit gleichem Autor und Titel.
  Nachsehen, ob es dasselbe Buch ist (dann „Bestand" erhöhen).
- **„Bitte die Seite neu laden"** — es war noch ein zweiter Tab offen. Neu laden, Änderung
  wiederholen.
- **„Das Zugriffstoken ist abgelaufen"** — das ist nichts, was Sie falsch gemacht haben.
  Bei der Person melden, die den Katalog betreut; es ist in fünf Minuten erneuert.
- **Die Änderung ist nicht im Katalog zu sehen** — ein bis zwei Minuten warten und die Seite
  neu laden. Steht sie nach fünf Minuten immer noch nicht da, melden.

---

## 7. Wenn später doch eine Datenbank kommt

Die Ausleihverwaltung ist im Schema an mehreren Stellen vorgezeichnet (`status`, `bestand`,
„damit die spätere Ausleihverwaltung keine Datenmigration braucht"). Ausleihvorgänge,
Fristen und Mitglieder in Git zu schreiben, trägt nicht — dafür braucht es dann eine
Datenbank.

**Nichts von dem, was jetzt gebaut wird, ist dann verloren.** Der Umstieg besteht aus drei
Teilen, und zwei davon bleiben unverändert:

| | |
|---|---|
| Formular, ISBN-Abruf, id-Vergabe, Export, Anmeldung, Schutzwall | bleiben **wie sie sind** |
| `src/lib/pruefung.ts` | bleibt **wie sie ist** — das Schema bleibt der Torwächter |
| `src/lib/github.ts` | wird durch `src/lib/datenbank.ts` **ersetzt**, plus ein Skript, das vor dem Build aus der Datenbank wieder `src/data/*.json` schreibt |

Ein einziges Modul. Deshalb ist es richtig, es heute nicht zu bauen — und deshalb ist es
wichtig, dass alles außer diesem einen Modul nichts von GitHub weiß.

---

## 8. Prompting-Plan (für Opus 5 in späteren Sitzungen)

Acht Arbeitspakete. **Jedes ist für sich lauffähig und einzeln nachvollziehbar.** Nach jedem
Paket müssen `npm run validate`, `npm run check`, `npm run build`, `npm run suchtest`,
`npm run filtertest` unverändert durchlaufen — das ist die Abnahmebedingung, die überall
gilt und deshalb unten nicht wiederholt wird.

### Regeln, die in jedem Paket gelten

Diesen Block bei jedem Paket mitgeben:

> **Hausregeln dieses Projekts.** Deutsch für Bezeichner, Dateinamen, Kommentare und alle
> Texte in der Oberfläche — so wie `Blaetterung.astro`, `spartenUebersicht`, `pfade.ts`.
> Kommentare erklären das **Warum**, nicht das Was, und sind so ausführlich wie die
> vorhandenen. `schema/medium.schema.json` ist die maßgebliche Quelle für Felder — nichts
> zweimal definieren, was von dort kommen kann. **Keine neue Abhängigkeit** ohne Begründung
> im Kommentar; das Projekt hat genau eine Laufzeitabhängigkeit und dieser Umbau soll höchstens
> eine weitere hinzufügen. Gestaltung ausschließlich über die Custom Properties in
> `src/styles/global.css`. Der öffentliche Katalog bleibt statisch: Serverrendering nur unter
> `/verwaltung/` und `/api/`, jede solche Datei mit `export const prerender = false`. Kein
> Geheimnis in Code, der im Browser läuft. **Nur `src/lib/github.ts` weiß, dass es GitHub
> gibt** — jedes andere Modul spricht über eine Schnittstelle, die auch eine Datenbank
> bedienen könnte.

### Paket 1 — Entscheidungen festzurren (ohne Code)

> Lies `plan.md`, `README.md`, `NOTIZEN.md` und `schema/medium.schema.json`. Beantworte
> danach in einem Abschnitt „Festlegungen" am Ende von `plan.md`: (a) `/verwaltung/` oder
> `/admin/` als Adresse — der Rest des Projekts ist deutsch, ich neige zu `/verwaltung/`;
> (b) rechtfertigt der Excel-Export die Abhängigkeit `exceljs`, oder reicht CSV mit BOM
> (§ 4.7)? Nenne mir für beides den konkreten Unterschied in der Bedienung; (c) welche Felder
> aus NOTIZEN.md § 6 bereinigt werden — mein Vorschlag: neue Einträge schreiben leere Felder
> gar nicht mehr, die 987 vorhandenen bleiben zunächst unverändert; (d) welche
> Umgebungsvariablen es gibt, mit Namen und einem Satz, was hineingehört, als Tabelle, die
> ich beim Einrichten von Vercel abarbeiten kann. Schreibe nur diesen Abschnitt, ändere
> sonst nichts am Plan.

### Paket 2 — Prüfung teilen

> Zieh die Ajv-Einrichtung und `beschreibeFehler` aus `scripts/validate.mjs` nach
> `src/lib/pruefung.ts` heraus, mit `pruefeMedium(eintrag): { gueltig: boolean; fehler: string[] }`.
> Ergänze dort `pruefeIdFrei(id, alleMedien)` — dieselbe Bedingung, die `pruefeEindeutigeIds`
> in `src/lib/daten.ts` beim Build erzwingt. `scripts/validate.mjs` benutzt danach diese
> Funktionen und verhält sich **zeichengenau wie vorher**: gleiche Ausgabe, gleiche
> Exit-Codes, `MAX_MELDUNGEN` bleibt. Belege das, indem du die Ausgabe vor und nach der
> Änderung vergleichst. Kein neues Verhalten in diesem Paket.

### Paket 3 — Die JSON-Dateien schreiben können, ohne GitHub

> Schreibe `src/lib/bestand.ts`: reine Funktionen auf dem Inhalt einer Spartendatei —
> `eintragEinfuegen`, `eintragAendern`, `eintragEntfernen`, jeweils `(datei, eintrag) → datei`.
> Sie setzen `anzahl` und `stand` selbst, sortieren die `items` stabil und geben den Inhalt
> **byte-gleich formatiert** zurück wie die heutigen Dateien: Feldreihenfolge des Schemas,
> zwei Leerzeichen Einrückung, abschließender Zeilenumbruch. Beweise das mit einem Skript
> `scripts/formattest.mjs`, das jede vorhandene Datei einliest, durch die Serialisierung
> schickt und auf Byte-Gleichheit prüft — als `npm run formattest` eintragen und in
> `pruefen.yml` einhängen. Dieses Paket fasst weder GitHub noch Astro an; es ist reine
> Logik mit einem Beweis.

### Paket 4 — GitHub-Anbindung

> Schreibe `src/lib/github.ts` nach `plan.md` § 4.2: `holeSparte(sparte)` und
> `speichereSparten(dateien, meldung)` über die **Git-Data-API** (Blob → Tree → Commit → Ref),
> nicht über die Contents-API — `romane.json` wird die 1-MB-Grenze reißen. Ref-Aktualisierung
> ohne `force`, ein automatischer Wiederholungsversuch bei Ablehnung, danach ein Fehler, den
> die Oberfläche im Klartext zeigen kann. Fehlerfälle bekommen **deutsche Klartextmeldungen**,
> vor allem der abgelaufene Token (§ 5). Commit-Autor aus Umgebungsvariablen. Keine
> Abhängigkeit: `fetch` reicht. Dieses Modul ist das einzige, das GitHub kennen darf.

### Paket 5 — Vercel-Adapter, Anmeldung, Schutzwall

> Richte `@astrojs/vercel` ein, `output: 'static'` bleibt. **Belege im selben Durchgang**,
> dass `npm run build` weiterhin genauso viele statische Seiten erzeugt wie vorher und keine
> Katalogseite zu einer Funktion geworden ist — zähl beides vorher und nachher. Dann:
> `src/lib/anmeldung.ts` (scrypt-Hash-Vergleich in konstanter Zeit gegen
> `VERWALTUNG_PASSWORT_HASH`, signiertes Sitzungs-Cookie per HMAC gegen `SITZUNG_GEHEIMNIS`,
> alles aus `node:crypto`, keine neue Abhängigkeit), `scripts/passwort.mjs` als
> `npm run passwort` zum Erzeugen des Hashes, `POST /api/anmelden/` und `/api/abmelden/`,
> `src/middleware.ts` als Schutz für `/verwaltung/*` und `/api/*` außer Anmelden,
> `/verwaltung/anmelden/` und `/verwaltung/` als Seiten. Ergänze `Disallow: /verwaltung/` in
> `src/pages/robots.txt.ts`, `X-Robots-Tag: noindex` in `vercel.json` (`npm run vercelpruefen`
> muss grün bleiben) und halte `/verwaltung/` aus `sitemap.xml.ts` heraus.

### Paket 6 — Bestand, Formular, Speichern, Löschen

> Die Routen `GET/POST /api/medien/`, `PUT/DELETE /api/medien/[id]/` und
> `POST /api/medien/[id]/wiederherstellen/`. **Jede schreibende Route ruft zuerst
> `pruefeMedium` und `pruefeIdFrei` aus Paket 2**, ändert dann über Paket 3 und committet über
> Paket 4. Löschen verschiebt den Eintrag im selben Commit nach `src/data/_geloescht.json` —
> Dateien mit führendem Unterstrich werden von Build und Prüfung ignoriert, das ist der
> Papierkorb (§ 4.5). Dazu die Seiten `/verwaltung/bestand/` (Suche, Spartenfilter,
> Blätterung aus `Blaetterung.astro`), `/verwaltung/neu/`, `/verwaltung/bearbeiten/[id]/`,
> `/verwaltung/papierkorb/`. Das Formular wird aus `schema/medium.schema.json` erzeugt und
> nach `angabenInhalt`/`angabenAusgabe`/`angabenBestand` aus `src/lib/anzeige.ts` gruppiert;
> Felder, die zur gewählten Sparte nicht passen, werden ausgeblendet. Leeres Feld → Feld wird
> nicht geschrieben. `id` beim Bearbeiten gesperrt, `erfasst_am` bei „Neu" auf heute
> vorbelegt. Der Unterschied zwischen „Löschen" und „Status: ausgeschieden" muss **in der
> Oberfläche** stehen, nicht nur in der Dokumentation. Alle Texte deutsch und für Menschen
> ohne Vorkenntnisse — die Formulierungen aus `plan.md` § 6 sind die Vorlage.

### Paket 7 — ISBN und id

> `src/lib/isbn.ts` (Prüfziffer für ISBN-10 und ISBN-13, Normalisierung auf reine Ziffern —
> **auch für die Bindestrich-Varianten `‑`, `–`, `—` aus NOTIZEN.md § 13**) und
> `src/lib/kennung.ts` (id-Vorschlag nach der README-Regel, `slug()` aus `anzeige.ts`
> wiederverwenden, `-2` bei Kollision). Dann `GET /api/isbn/[isbn]/` mit der
> Anbieter-Schnittstelle aus `plan.md` § 4.6: erst Prüfziffer, dann „steht schon im Katalog?",
> dann Google Books, dann OpenLibrary. Die Antwort nennt immer die Herkunft. DNB **nicht**
> bauen — die Stelle vorbereiten und mir in einem Satz sagen, was zu klären ist. Nichts wird
> automatisch gespeichert: Die Route füllt das Formular, mehr nicht. Schreib einen kleinen
> Test für die Prüfziffer mit den 15 kaputten ISBN aus NOTIZEN.md § 3 als Eingabe — alle 15
> müssen als ungültig erkannt werden.

### Paket 8 — Export, Protokoll, Dokumentation

> `GET /api/export/` mit JSON (exakt das Dateiformat aus `src/data/`), CSV (UTF-8 mit BOM,
> Semikolon) und dem in Paket 1 festgelegten Excel-Weg; Dateiname
> `buecherei-<sparte>-<datum>`. Dazu `/verwaltung/export/` und `/verwaltung/protokoll/`
> (Commit-Liste zu `src/data/` über die GitHub-API, lesbar aufbereitet, verlinkt auf GitHub).
> Ergänze `pruefen.yml` um `npm run formattest` und um eine Suche nach Token-Mustern in
> `dist/`. Zuletzt: § 6 dieses Plans ins README übernehmen und die bisherige JSON-Anleitung
> dort durch einen kurzen Hinweis ersetzen, dass sie nur noch für den Notfall gilt — löschen
> sollen wir sie nicht, sie ist die Rückfallebene, wenn die Verwaltung einmal nicht läuft.

### Nach Paket 8

- Einen Titel anlegen, ändern, löschen, wiederherstellen — mit der Person, die den Bestand
  künftig pflegt, und daneben sitzen, ohne zu helfen. Was sie fragt, ist ein Fehler in der
  Oberfläche, nicht in ihr.
- NOTIZEN.md § 2, 3, 5, 9, 10, 11, 13, 14 durchgehen: rund 40 Einträge, deren Korrektur jetzt
  eine Sache von Minuten in der Verwaltung ist statt eines Import-Durchlaufs.
- Die fünf leeren Sparten füllen. Das ist der Weg von 987 auf 3 500 — und der erste echte
  Belastungstest der Oberfläche. Dabei nachmessen, was § 5 unter „Zwei Dinge, die mit 3 500
  Einträgen zu beobachten sind" nennt.
- Erst wenn die Ausleihe konkret wird, § 7 aufschlagen.

---

## 9. Festlegungen (Paket 1)

*Beantwortet am 23.08.2026, vor der ersten Zeile Code. Alle Zahlen in diesem Abschnitt sind
am heutigen Bestand nachgemessen, nicht geschätzt.*

### (a) Die Adresse heißt `/verwaltung/`

**Festgelegt: `/verwaltung/`.** Der Unterschied in der Bedienung ist klein, aber er zeigt in
genau eine Richtung:

| | `/verwaltung/` | `/admin/` |
|---|---|---|
| **Was man am Telefon sagt** | „Schrägstrich verwaltung" — ein deutsches Wort, das die pflegende Person buchstabieren und fehlerfrei tippen kann | „admin", englisch ausgesprochen, muss erst erklärt werden |
| **Wie es neben dem Rest aussieht** | passt zu `/sparte/romane/titel/seite-2/` und `/titel/rom-beer-die-rote-frau-6761/` | die einzige englische Stelle in der ganzen Adresszeile |
| **Was im Vercel-Protokoll ankommt** | nichts Fremdes; Standardlisten klopfen diesen Pfad nicht ab | `/admin` gehört zu den meistgesuchten Pfaden überhaupt. Nach dem Umbau läuft jeder dieser Versuche in eine Serverfunktion und durch die Middleware, statt in eine statische 404 zu fallen |
| **Alles Übrige** | gleich | gleich |

Die letzte Zeile ist **kein** Sicherheitsargument — es schützt das Passwort, nicht der Name
der Adresse. Es geht um Ruhe im Protokoll: Wer nachsehen will, ob die Anmeldung von gestern
geklappt hat, soll nicht durch hundert Anfragen fremder Suchprogramme blättern.

Damit es später niemand neu aufmacht: **`/api/` bleibt `/api/`.** Diese Adressen tippt kein
Mensch, sie stehen in `fetch`-Aufrufen — dort ist die englische Abkürzung die überall
verstandene, und `/schnittstelle/` wäre eine Erfindung ohne Nutzen. Die Hausregel gilt für
das, was Menschen lesen und sagen.

### (b) Kein `exceljs`. CSV mit BOM — mit drei Auflagen

**Festgelegt: CSV.** Drei Gründe, und der erste ist der harte.

**1. Das Abhängigkeitsbudget ist bereits vergeben.** Die Hausregel erlaubt diesem Umbau
höchstens *eine* zusätzliche Abhängigkeit neben `minisearch`. Diese eine ist
**`@astrojs/vercel`** (Paket 5) — ohne den Adapter gibt es keine Serverroute und damit keine
Verwaltung. `exceljs` wäre die zweite, und es ist keine kleine: Es bringt ZIP-, Strom- und
Datumsteile mit, die in jede erzeugte Serverfunktion gebündelt werden. Für zwei
Formatierungen.

**2. Der Unterschied in der Bedienung sind genau zwei Handgriffe je Export.**

| | `.xlsx` (exceljs) | CSV mit BOM |
|---|---|---|
| **Öffnen** | Doppelklick | Doppelklick |
| **Umlaute** | richtig | richtig — dafür ist das BOM da |
| **Kopfzeile beim Scrollen** | bleibt oben stehen | scrollt weg. *Ansicht → Fenster fixieren → Oberste Zeile fixieren* — ein Handgriff, je Export einmal |
| **Spaltenbreiten** | sitzen | alle gleich schmal, `titel` sichtbar abgeschnitten. Strg+A, dann Doppelklick auf eine Spaltentrennlinie — ein Handgriff, je Export einmal |
| **Zahlen, ISBN, Freitext** | stehen als Typ im Dokument fest | hängen an den drei Auflagen unten |
| **Speichern nach dem Bearbeiten** | ohne Rückfrage | Excel fragt einmal nach, ob das Format bleiben soll |

Das ist die ganze Rechnung: zwei Tastenwege, die man einmal zeigt und die in beiden
Richtungen umkehrbar sind — gegen eine zweite Abhängigkeit, die für immer mitgepflegt,
mitaktualisiert und mitgebündelt wird.

**3. Nachrüstbar, falls die Handgriffe doch stören.** Der Export liest ohnehin dieselben
Dateien wie die Bestandsliste (§ 4.7); ein weiteres Format ist ein zusätzlicher Zweig hinter
`/api/export/`, an dem sich weder Formular noch Prüfung noch GitHub-Anbindung ändern. Diese
Entscheidung ist also billig zurückzunehmen — die umgekehrte nicht.

**Die drei Auflagen** für Paket 8. Ohne sie gewinnt CSV den Vergleich nicht, sondern verliert
ihn:

- **Dezimalkomma.** `preis_eur` muss als `13,40` in der Datei stehen, nicht als `13.4`.
  Deutsches Excel liest `13.4` als **Datum 13.04.** Das betrifft **791 der 987 Einträge** und
  fällt niemandem auf, bis jemand eine Spalte summiert.
- **ISBN als Text.** Eine dreizehnstellige Ziffernfolge liest Excel als Zahl und zeigt
  `9,78333E+12`; danach ist die Spalte weder durchsuchbar noch sortierbar. Anführungszeichen
  helfen nicht, Excel wandelt trotzdem um. Deshalb führt die CSV die ISBN in der Form aus
  **`isbn_formatiert`** (mit Bindestrichen; 803 der 987 Einträge haben sie) — die bleibt Text,
  ganz ohne Trick. Die reine Ziffernfolge steht im JSON-Export, wo sie hingehört. Nebenbei
  rettet das später ISBN-10 mit führender Null (heute keine im Bestand, bei
  englischsprachigen Titeln der Normalfall).
- **Formelzeichen entschärfen.** Ein Feld, das mit `=`, `+`, `-` oder `@` beginnt, versucht
  Excel als Formel zu lesen. `notiz` und `_quelle` sind Freitext aus dem Word-Dokument; ein
  führender Gedankenstrich genügt. Solche Werte bekommen ein vorangestelltes Hochkomma.

> Für § 4.4 und § 6 heißt das eine einzige Wortänderung in Paket 8. Es bleibt bei „Excel",
> denn genau das tut die Datei — sie öffnet sich in Excel per Doppelklick. Nur stehen im
> Auswahlfeld statt drei Formaten zwei: **Excel (CSV)** und **JSON**.

### (c) Leere Felder: der Vorschlag gilt — mit vier Präzisierungen

**Festgelegt wie vorgeschlagen.** Neue Einträge schreiben leere Felder gar nicht mehr; die 987
vorhandenen werden **inhaltlich** nicht angefasst. Die Nachkontrolle aus NOTIZEN.md (§ 2, 3,
5, 9, 10, 11, 13, 14) bleibt eine eigene Arbeit, die die Verwaltung später zu einer Sache von
Minuten macht — sie gehört nicht in den Umbau. Vier Dinge dazu:

**1. Die Regel gilt für alle Felder, nicht nur für `standort` und `signatur`.** Im Formular:
Wert beschneiden, leer → Schlüssel wird nicht geschrieben; leere Liste → Schlüssel wird nicht
geschrieben. Das ist wörtlich die Regel, die `schema/medium.schema.json` in seiner
Beschreibung schon aufstellt („Unbekannte Felder werden weggelassen, nicht mit null/leer
gefüllt") und an die sich bisher nur der Import bei diesen zwei Feldern nicht gehalten hat.

**2. `cover_url` bekommt keinen Schlüssel statt `null`.** Das Schema erlaubt `null`, und alle
987 stehen so da — für `istGesetzt()` in `src/lib/anzeige.ts` bedeuten „fehlt" und „null" aber
dasselbe. Zwei Schreibweisen für einen Zustand sind genau das, was NOTIZEN.md § 6 bemängelt.
`erfasst_am` ist der Sonderfall: Bei „Neu" wird es auf das heutige Datum vorbelegt (§ 4.4) und
ist damit gesetzt; wer es von Hand leert, bekommt keinen Schlüssel — kein `null`.

**3. `suchtext` wird nie wieder geschrieben, auch nicht bei neuen Einträgen.** Nachgemessen:
Der in den Dateien gespeicherte Wert wird **von niemandem gelesen**. `src/lib/listendaten.ts`
ruft `baueSuchtexte()` aus `src/lib/suchdokumente.ts` und rechnet den Suchtext bei jedem Build
aus den Feldern neu aus; geschrieben hat ihn allein das stillgelegte Importskript. 987
gespeicherte Werte, rund **103 KB**, ohne jede Wirkung — und schlimmer als wirkungslos:
Sobald jemand über die Verwaltung einen Titel berichtigt, stünde daneben ein Suchtext, der
den alten Titel enthält. Das Formular bietet das Feld nicht an, und der Schreibweg trägt es
nicht mit.

> `_quelle` und `_pruefen` bleiben bei den vorhandenen Einträgen unverändert stehen — das eine
> ist der Beleg auf die Zeile im Word-Dokument, das andere die Arbeitsliste der Nachkontrolle.
> Bei neuen Einträgen entstehen beide nicht: Es gibt keine Quellzeile, und es gibt nichts
> anzumerken, was das Formular nicht schon beim Eintippen geprüft hätte.

**4. „Unverändert" heißt: bis der Eintrag angefasst wird.** Wer einen der 987 öffnet und
speichert, schreibt ihn nach den Regeln oben zurück — in diesem Commit verschwinden
`"standort": ""`, `"signatur": ""`, `"cover_url": null` und der tote `suchtext`. Vier Zeilen,
sichtbar im Diff neben der eigentlichen Änderung. Das ist richtig so: Die Bereinigung folgt
der Arbeit, statt sie zu ersetzen, und es braucht keinen Wanderungslauf. Einen Sammel-Commit,
der alle 987 Einträge **inhaltlich** auf einmal umschreibt, gibt es nicht — er wäre 987
Änderungen an einem Tag, in denen eine echte Korrektur nicht mehr auffindbar ist.

Eine Ausnahme von Punkt 4 steht in (e). Sie hat mit dem Inhalt der Daten nichts zu tun,
sondern allein mit ihrer Schreibweise.

### (d) Umgebungsvariablen

Zum Abarbeiten unter **Vercel → Settings → Environment Variables**. Die Reihenfolge ist die
der Einrichtung: ohne die ersten vier läuft die Verwaltung nicht.

| Name | Pflicht | Was hineingehört |
|---|---|---|
| `VERWALTUNG_PASSWORT_HASH` | **ja** | Die Ausgabe von `npm run passwort` (Paket 5) — Salz und scrypt-Hash in einer Zeile, **nicht** das Passwort selbst; wer sie liest, kann sich damit nicht anmelden. |
| `SITZUNG_GEHEIMNIS` | **ja** | 32 zufällige Bytes, erzeugt mit `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`; damit wird das Sitzungs-Cookie signiert, und ein neuer Wert meldet sofort alle Geräte ab — der Not-Aus, wenn ein Gerät verloren geht. |
| `GITHUB_TOKEN` | **ja** | Das fein abgestufte Zugriffstoken (§ 3): nur dieses eine Repository, einzige Berechtigung *Contents: Read and write* — Ablaufdatum beim Erzeugen notieren, es ist das wahrscheinlichste Problem im Betrieb (§ 5). |
| `GITHUB_REPOSITORY` | **ja** | Konto und Repository in einem, genau wie in der GitHub-Adresszeile, z. B. `musterdorf/digital-katalog-buecherei`. |
| `GITHUB_BRANCH` | nein — `main` | Nur setzen, wenn der Hauptzweig anders heißt als `main`. |
| `COMMIT_AUTOR_NAME` | nein — `Bücherei` | Der Name, der in der Historie und im Protokoll (§ 4.7) neben jeder Änderung steht: „Bücherei Musterdorf", nicht der Name einer Person. |
| `COMMIT_AUTOR_EMAIL` | nein | Die Adresse zur selben Zeile; eine erreichbare Sammeladresse der Bücherei, oder die `…@users.noreply.github.com`-Adresse des Kontos, wenn keine öffentlich werden soll. |
| `GITHUB_TOKEN_ABLAUF` | nein | Das notierte Ablaufdatum als `JJJJ-MM-TT`, damit `/verwaltung/` rechtzeitig warnen kann — **nur nötig, falls sich in Paket 4 bestätigt, dass GitHub das Datum nicht selbst mitschickt** (bei fein abgestuften Token kommt die Kopfzeile `github-authentication-token-expiration` zurück; dann entfällt diese Variable ersatzlos). |
| `SITE_URL` | nein, empfohlen | Steht schon heute im README und in `astro.config.mjs`: die endgültige öffentliche Adresse für `sitemap.xml`, `robots.txt` und die Canonical-Angaben. Ohne sie nimmt der Build die Vercel-Produktionsadresse. |

Vier Dinge, die beim Eintragen zu beachten sind:

- **Kein `PUBLIC_` vor einen dieser Namen.** Ohne dieses Präfix stellt Astro eine Variable im
  Browser gar nicht erst bereit — das ist die halbe Miete des Schutzes aus § 5, und sie kostet
  nichts, solange niemand den Namen „hübscher" macht.
- **`GITHUB_TOKEN` nur für *Production* setzen, nicht für *Preview*.** Sonst könnte eine
  Vorschau-Bereitstellung aus einem beliebigen Zweig in `main` schreiben. Dass die Verwaltung
  in der Vorschau dann nicht speichern kann, ist kein Mangel, sondern der Zweck.
- **Nach jeder Änderung neu bereitstellen.** Vercel liest die Variablen beim Erzeugen der
  Funktionen; ein geänderter Wert wirkt erst nach dem nächsten Deploy.
- **`.env.local` in `.gitignore` nachtragen** (Paket 5). Nachgeprüft: `.env` und
  `.env.*.local` sind heute ausgenommen, **`.env.local` nicht** — und genau diese Datei legt
  man beim lokalen Entwickeln an. Ein Muster `.env*.local` schließt die Lücke.

Die vier `GITHUB_`-Namen tragen ihr Präfix mit Absicht: Sie werden ausschließlich in
`src/lib/github.ts` gelesen, und wenn dieses Modul eines Tages `src/lib/datenbank.ts` weicht
(§ 7), fällt der ganze Block als sichtbare Einheit weg. Zu prüfen bleibt in Paket 4, ob
Vercels eigene `VERCEL_GIT_REPO_OWNER`/`VERCEL_GIT_REPO_SLUG` zur Laufzeit in der Funktion
stehen — dann wäre `GITHUB_REPOSITORY` ein Rückfallwert und keine Pflichtzeile mehr.

### (e) Dazu aufgefallen: Paket 3 kann seine Abnahmebedingung so nicht erfüllen

Beim Nachprüfen von (c) ist etwas herausgekommen, das festgezurrt gehört, bevor jemand Paket 3
anfängt. Paket 3 verlangt eine Serialisierung, die die Felder **in der Reihenfolge des
Schemas** schreibt, und `scripts/formattest.mjs` soll beweisen, dass jede vorhandene Datei
diesen Weg **byte-gleich** übersteht. Beides zusammen ist heute unmöglich:

| Gemessen | |
|---|---|
| Einträge, deren Feldreihenfolge von der des Schemas abweicht | **987 von 987** |
| `romane.json` beginnt mit | `id, sparte, medium, titel, …` |
| `tonies.json` beginnt mit | `sparte, medium, reihe, …` — und führt **`id` als allerletztes Feld** |
| Innerhalb von `romane.json` | 43 Einträge schreiben `_pruefen` vor `_quelle`, vier umgekehrt |

Es gibt also keine einzige Feldreihenfolge, die beide Dateien byte-gleich reproduziert. Die
Abweichungen selbst sind harmlos — JSON-Objekte sind ungeordnet, `npm run validate` und der
Build stören sich an nichts davon —, aber der Beweis, den Paket 3 führen soll, scheitert
daran, und zwar an 987 von 987 Einträgen.

**Festgelegt: ein Normalisierungs-Commit vor Paket 4.** Ein einziger, rein mechanischer
Durchlauf über `src/data/*.json`, der

- alle Einträge in die Reihenfolge des Schemas bringt,
- `"standort": ""`, `"signatur": ""`, `"cover_url": null` und `suchtext` entfernt,
- und **keinen einzigen Wert ändert**.

Danach misst `formattest.mjs` gegen diese Dateien, und seine Zusage gilt von da an lückenlos.
Der Commit heißt „Schreibweise vereinheitlicht, keine Inhalte geändert" und passiert einmal,
**bevor** die Verwaltung in Betrieb geht — er kann also nie mit einer echten Bestandsänderung
verwechselt werden. Das ist kein Widerspruch zu (c) Punkt 4: Dort geht es um Inhalte, hier um
Schreibweise.

Der Beleg dafür ist zu führen, nicht zu behaupten: `npm run validate`, `npm run check`,
`npm run suchtest`, `npm run filtertest` unverändert, `npm run build` mit derselben Zahl
erzeugter Seiten — und ein kleiner Vergleich, der beide Fassungen einliest und Eintrag für
Eintrag prüft, dass sich nur Schlüssel entfernt und Zeilen verschoben haben.

Als Zugabe schrumpfen die Daten dabei von **996 KB auf 768 KB** (davon 103 KB toter
`suchtext`). An der Entscheidung für die Git-Data-API ändert das nichts — bei 3 500 Einträgen
reißt `romane.json` die 1-MB-Grenze so oder so —, aber die Dateien werden handlicher, und der
heutige Stand von 860 KB in `romane.json` rückt wieder von der Kante weg.

**Falls Ihnen der Sammel-Commit widerstrebt,** gibt es eine Rückfallebene: Die Serialisierung
behält je Eintrag die vorhandene Feldreihenfolge bei und hängt nur neue Felder hinten an. Dann
besteht `formattest.mjs` ohne jeden Eingriff — aber die Tonies führen `id` für immer als
letztes Feld, neue Einträge sehen anders aus als alte, und die Dateien behalten ihre 229 KB
Ballast. Empfohlen ist der Normalisierungs-Commit.
