# Notizen zum Datenbestand

Auffälligkeiten, die beim Einrichten des Katalogs aufgefallen sind. **Nichts davon wurde
korrigiert** — die Dateien in `src/data/` sind unverändert so übernommen worden, wie sie in
`buecherei-daten/` lagen. Diese Liste ist die Arbeitsgrundlage für die Nachkontrolle am
Original (`Romane.doc`, `Tonies.xlsx`).

Stand der Durchsicht: 16.08.2026 · 987 Einträge · `npm run validate` meldet 0 Schemafehler
und 0 doppelte ids.

Die Punkte 1–7 stammen aus der Ersteinrichtung, die Punkte 8–12 kamen beim Bau der
Katalogansicht dazu — dort fällt auf, was sich im JSON allein nicht zeigt.

---

## 1. Einträge mit Prüfvermerk (`_pruefen`)

47 Einträge tragen einen automatisch gesetzten Vermerk aus dem Import.

| Vermerk | Anzahl | Bedeutung |
|---|---|---|
| `kein_ort` | 19 | Verlagsort fehlt in der Quelle |
| `isbn_ungueltig` | 12 | ISBN-Prüfziffer stimmt nicht oder eine Ziffer fehlt |
| `kein_jahr` | 7 | Erscheinungsjahr nicht erkennbar |
| `moegliche_dublette` | 4 | zweimal derselbe Titel mit identischer ISBN |
| `nur_ATS_preis` | 4 | Preis nur in Schilling angegeben |
| `keine_isbn` | 3 | gar keine ISBN vorhanden |

> **Abweichung zur Übergabe:** `buecherei-daten/LIESMICH.md` nennt 43 Einträge mit
> `_pruefen`, tatsächlich sind es 47. Die Summe der Einzelposten in der dortigen Tabelle
> ergibt ebenfalls 49 Vermerke auf 47 Einträgen (manche Einträge tragen zwei Vermerke).
> Die Zahl 43 in der LIESMICH ist also schlicht falsch — an den Daten selbst liegt es nicht.

So findet man sie:

```bash
python -c "import json;[print(x['_pruefen'], x['_quelle']) for x in json.load(open('src/data/romane.json', encoding='utf-8'))['items'] if x.get('_pruefen')]"
```

---

## 2. Vermutliche Dubletten (2 Titelpaare)

Jeweils zweimal derselbe Titel mit identischer ISBN. Die ids sind eindeutig (das zweite
Exemplar hat das Suffix `-2`), der Build läuft deshalb durch. Zu klären ist, ob die Bücherei
das Buch wirklich zweimal besitzt.

| ISBN | ids |
|---|---|
| 9783709979969 | `rom-eigner-nichts-verblasst-fuer-immer-9969`, `…-9969-2` |
| 9783442315673 | `rom-riley-atlas-die-geschichte-von-pa-salt-5673`, `…-5673-2` |

**Wenn es tatsächlich zwei Exemplare sind:** nicht zwei Datensätze führen, sondern beim
ersten Eintrag `"bestand": 2` setzen und den zweiten löschen. Das Feld `bestand` ist genau
dafür da; das spätere Bibliothekssystem erwartet es so.

**Wenn es ein Doppeleintrag ist:** den Eintrag mit dem Suffix `-2` löschen. Die id des
ersten Eintrags auf keinen Fall ändern.

---

## 3. Fehlerhafte ISBN (15 Einträge)

Bei diesen Einträgen wurde das Feld `isbn` weggelassen, weil die Prüfziffer nicht stimmt
oder eine Ziffer fehlt. `isbn_formatiert` enthält weiterhin die Zeichenfolge aus dem Word-
Dokument. Solange `isbn` fehlt, findet die spätere Coverabfrage (OpenLibrary/DNB) zu diesen
Titeln kein Bild.

| id | im Dokument steht | vermutlich |
|---|---|---|
| `rom-didierlaurent-die-sehnsucht-des-vorlesers-feed` | 978-33-423-26078-7 | eine `3` zu viel |
| `rom-gerritsen-die-studentin-bb02` | 978-3-8090-2748-50 | eine Ziffer zu viel |
| `rom-heib-drei-meter-unter-null-74e5` | 978-3-453-2711-1 | eine Ziffer fehlt |
| `rom-heldt-die-familienangelegenheiten-der-johanne-johans-779d` | 978-3-423-28430-13 | eine Ziffer zu viel |
| `rom-innerhofer-schoene-tage-10ac` | 3-7017-1315 | ISBN-10 unvollständig |
| `rom-kluepfel-seegrund-fc37` | 978-3-492-25094-8-1 | Ziffer angehängt |
| `rom-kubsova-bergland-3460` | 978-3-44-31618-2 | Ziffer fehlt |
| `rom-roos-die-sonntagsschwestern-5546` | 978-3-442-49484 | Prüfziffer fehlt |
| `rom-spielman-morgen-kommt-ein-neuer-himmel-b6ec` | 978-3-8105-131-30-4 | Gruppierung kaputt |
| `rom-taylor-wildblumensommer-52cf` | 978-3-404-1736-9 | Ziffer fehlt |
| `rom-vigan-dankbarkeiten-fa3b` | 978-3-8321-3 | stark verkürzt |
| `rom-whitaker-von-hier-bis-zum-anfang-db80` | 978-3-492-07129 | Prüfziffer fehlt |

Ganz ohne ISBN im Dokument (`keine_isbn`):
`rom-kaiser-blasmusikpop-oder-wie-die-wissenschaft-in-die-11d5`,
`rom-kaiser-rueckwaertswalzer-oder-die-manen-der-familie--71af`,
`rom-komarek-blumen-fuer-polt-9548`

---

## 4. Zwei Textfragmente aus dem Word-Dokument sind verloren

`src/data/_unlesbar.json` enthält zwei abgeschnittene Zeilen, bei denen im Original schon
der Anfang fehlte — Autor und Titel sind nicht mehr rekonstruierbar:

```
"nes 2011. 198 S. ISBN 978-3-257-06767-5 fest geb. € 20,50"
"mann 2022. 413 S. ISBN 978-3-442-49017-2 kart."
```

Beide ISBN sind gültig und vollständig — die zugehörigen Titel lassen sich also über eine
ISBN-Abfrage ermitteln und dann von Hand als reguläre Einträge nachtragen. Die Verlagsnamen
enden auf „…nes" (Diogenes?) und „…mann" (Goldmann?), was dazu passt.

Dateien mit führendem Unterstrich werden weder von `scripts/validate.py` noch von
`src/lib/daten.ts` eingelesen. Die zwei Fragmente zählen daher **nicht** zu den 987 Medien.

---

## 5. Tonies: `reihe` ist uneinheitlich befüllt

Von 181 Tonies haben 105 ein Feld `reihe`, 76 nicht. Bei vier davon steckt der Reihenname
noch komplett im Titel, weil im Excel ein Gedankenstrich (`–`) statt eines Bindestrichs
(`-`) verwendet wurde und der Import nur auf den Bindestrich prüft:

```
Asterix – Der Gallier
Ritter Rost – Die Zauberinsel
Käpt'n Blaubär – Seemannsgarn
Gregs Tagebuch – Von Idioten umzingelt
```

Folge: Wer später nach der Reihe „Asterix" filtert, findet diese vier Tonies nicht.

Das ist ein Fehler im Importskript, nicht in den Daten. Sauber zu beheben in
`scripts/import/02_json_bauen.py`, Zeile 51 — dort steht `\s+-\s+`, gebraucht wird
`\s+[-–—]\s+`. Danach den Import wiederholen. **Achtung:** Die ids der Tonies werden aus
`reihe` + `titel` gebildet; eine Korrektur würde die ids dieser vier Einträge ändern. Solange
noch keine Links und keine Ausleihdaten daran hängen, ist das unkritisch — später nicht mehr.

Weitere Beobachtung: Nur 60 der 181 Tonies haben ein Feld `autor`. Bei Hörspielen ist das
meist in Ordnung, bei Hörbüchern nach einer Buchvorlage wäre der Autor sinnvoll.

---

## 6. `standort` und `signatur` stehen als leerer Text im JSON

Bei allen 987 Einträgen steht `"standort": ""` und `"signatur": ""`.

Das JSON Schema sagt in seiner Beschreibung ausdrücklich: „Unbekannte Felder werden
weggelassen, nicht mit null/leer gefüllt." Der Import hält sich bei den übrigen Feldern
daran (fehlende ISBN → Feld fehlt ganz), bei diesen zwei aber nicht. Formal ist das kein
Schemafehler — `"" ` ist ein gültiger String, deshalb meldet `npm run validate` nichts.

Praktische Folge: Ein Test wie `if (medium.standort)` funktioniert zwar (leerer String ist
falsy), aber `"standort" in medium` liefert überall `true`. Beim Anzeigen also auf den Inhalt
prüfen, nicht auf das Vorhandensein des Feldes.

`erfasst_am` und `cover_url` stehen bei allen Einträgen auf `null`. Das ist im Schema
ausdrücklich erlaubt und damit in Ordnung.

---

## 7. Noch gar nicht erfasst

- **Fünf Sparten sind leere Gerüste:** `sachbuecher`, `kinderbuecher`, `kinder-sachbuecher`,
  `spiele`, `cds`. Die Dateien existieren mit `"anzahl": 0`, damit Navigation und
  Sparten-Übersicht schon vollständig sind.
- **`erfasst_am` ist nirgends gesetzt.** Das ist die Grundlage für einen späteren
  „Neuzugänge"-Filter — `jahr` taugt dafür nicht, weil ein 2019 erschienenes Buch letzte
  Woche gekauft worden sein kann. Ab dem nächsten Neuzugang sollte das Feld mitgepflegt
  werden.
- **`cover_url` ist nirgends gesetzt.** Für Titel mit gültiger ISBN ließen sich Cover später
  automatisch beziehen.

---

## 8. `preis_eur` enthält bei sechs Einträgen Schilling, keine Euro

Sechs Einträge tragen `"waehrung_original": "ATS"`. Bei zweien davon steht in `preis_eur`
trotzdem der Schillingbetrag aus der Quelle:

| id | `preis_eur` | Originalzeile |
|---|---|---|
| `rom-coelho-der-alchimist-1269` | `175` | `ATS 234,00/175,00` |
| `rom-helfer-oskar-und-lilli-6864` | `209` | `ATS 281,00/209,00` |

175 Schilling sind rund 12,70 Euro — als Euro gelesen wäre der Preis also gut vierzehnmal
zu hoch. Die übrigen vier Einträge haben gar keinen `preis_eur`.

Der Katalog zeigt den Betrag deshalb ohne Eurozeichen an, sobald `waehrung_original`
gesetzt ist: „175 ATS" statt „€ 175,00". Sauber wäre, beim nächsten Durchgang entweder
umzurechnen (1 € = 13,7603 ATS) oder ein eigenes Feld `preis_original` einzuführen.

---

## 9. Die Anzeigeform `autor` ist bei 17 Einträgen zusammengeschoben

Wo im Word-Dokument zwei Verfasser standen, hat der Import Vor- und Nachnamen falsch
getrennt:

| `autor` | `autor_vorname` | `autor_nachname` |
|---|---|---|
| `Thomas/Lier Horst, Jørn Enger` | `Thomas/Lier Horst, Jørn` | `Enger` |
| `Tess/Braver, Gary Gerritsen` | `Tess/Braver, Gary` | `Gerritsen` |
| `Volker/Kobr, Michael Klüpfel` | `Volker/Kobr, Michael` | `Klüpfel` |

Richtig wäre `autor: "Thomas Enger"` mit `weitere_autoren: ["Jørn Lier Horst"]` — das Feld
`weitere_autoren` ist bei diesen Einträgen sogar schon korrekt befüllt, nur der zweite Name
steckt zusätzlich im Vornamen des ersten.

Betrifft 17 Einträge. Der Katalog zeigt sie so an, wie sie dastehen; die Einsortierung
stimmt (sie läuft über `autor_nachname`), nur die Namenszeile liest sich holprig.

---

## 10. „Der Alchimist": Reihe und Band aus einer Klammerbemerkung erfunden

```
rom-coelho-der-alchimist-1269
  reihe: "Auch für jugendl. Leser ab"
  band:  15
  notiz: "Auch für jugendl. Leser ab 15"
```

Im Quelltext steht am Zeilenende `(Auch für jugendl. Leser ab 15)`. Der Import hat das für
eine Reihenangabe mit Bandnummer gehalten. Der Alchimist gehört zu keiner Reihe; gemeint
war eine Altersempfehlung, also inhaltlich `alter_ab: 15`.

Folge im Katalog: Auf der Detailseite steht über dem Titel „Auch für jugendl. Leser ab ·
Band 15". Weil diese „Reihe" nur einen Eintrag hat, wird sie wenigstens nicht als Serie
behandelt und es entsteht kein Reihenblock. Es ist der einzige Fall dieser Art im Bestand.

---

## 11. Eine Serie zerfällt in vier Einzelreihen

Vier Bände einer Thriller-Reihe haben jeweils einen eigenen `reihe`-Wert bekommen, weil der
Untertitel mit hineingerutscht ist:

| `band` | `reihe` | Titel |
|---|---|---|
| 1 | `Es geht um dein Leben Thriller` | Das Spiel. Es geht um dein Leben |
| 2 | `Wirst du morgen noch leben? Thriller` | Die Nacht. Wirst du morgen noch leben? |
| 3 | `Er wird dich finden Thriller` | Die Spur. Er wird dich finden |
| 4 | `Dein letzter Tag ist gekommen Thriller` | Das Ende. Dein letzter Tag ist gekommen |

Weil jeder Wert nur einmal vorkommt, gelten die vier dem Katalog als vier verschiedene
Reihen mit je einem Band — sie werden weder gruppiert noch untereinander verlinkt. Ein
einheitlicher Reihenname (z. B. `Das Spiel`) würde das beheben.

Ähnlich, wenn auch harmloser: `Die Frau im Eishaus Ein Schwedenkrimi mit August Strindberg`
(59 Zeichen) ist eher Titel plus Gattungsangabe als ein Reihenname.

---

## 12. Kleinkram

- **`notiz` wiederholt oft nur die Bandnummer.** Bei 44 der 73 Einträge mit `notiz` steht
  dort exakt „Bd. 4" — dieselbe Angabe, die schon in `band` steht. Der Katalog blendet
  genau diese Fälle aus, damit unter „Band 4" nicht noch einmal „Anmerkung: Bd. 4" steht.
  Die übrigen 29 Notizen sind echter Freitext („Kriminalroman", „ab 14 und Erwachsene",
  „Kommissar Proteo Laurentis zehnter Fall.") und werden angezeigt.
- **`originalsprache` enthält abgeschnittene Wortfragmente.** In den Daten stehen Werte wie
  `Engl`, `Isländ`, `Französ`, `Schwed`, `amerikan`, `argentinischem` — Bruchstücke aus
  Wendungen wie „Aus dem Englischen von …". Der Katalog zeigt sie unverändert; sinnvoll
  wären ISO-Codes (`en`, `is`, `fr`) oder wenigstens ausgeschriebene Sprachnamen.
- **`NesbØ`** ist mit großem Ø in der Mitte geschrieben, richtig wäre `Nesbø`. Auf die
  Einsortierung wirkt sich das nicht aus (der Collator behandelt ø wie o), auf die Anzeige
  schon.
- **`sprache` ist bei allen 987 Einträgen `de`** und `bestand` überall `1`. Beide Zeilen
  stehen dadurch auf jeder Detailseite, ohne je etwas zu unterscheiden. Sobald es
  fremdsprachige Titel oder Mehrfachexemplare gibt, tragen sie Information — bis dahin
  sind sie schlicht Rauschen.
- **`spieler_min`, `spieler_max`, `spieldauer_min`** kommen im Bestand kein einziges Mal vor.
  Erwartbar: Die Sparte `spiele` ist noch leer. Der Katalog kann die Felder bereits anzeigen.
