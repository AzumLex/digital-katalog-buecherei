# -*- coding: utf-8 -*-
import re, json, unicodedata, hashlib, sys

recs = json.load(open('/tmp/recs.json'))
BIND = {'kart.':'kartoniert','kt.':'kartoniert','brosch.':'broschiert','Broschur':'broschiert',
        'fest geb.':'fest gebunden','Festeinbd.':'fest gebunden','Hardcover':'fest gebunden',
        'geb.':'fest gebunden','Taschenbuch':'Taschenbuch'}

def slug(s):
    s = s.lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')
    s = unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode()
    return re.sub(r'-+','-', re.sub(r'[^a-z0-9]+','-',s).strip('-'))

GENRE_RULES = [
 ('Thriller', r'\bThriller\b|\bPsychothriller\b'),
 ('Krimi', r'\bKrimi\b|\bKriminalroman\b|\bCommissario\b|\bKommissar|\bein Fall für|-Krimi\b|\bDetektiv'),
 ('Historischer Roman', r'\bhistorisch|\bHistorienroman|\bhistor\.'),
 ('Fantasy', r'\bFantasy\b|\bMärchen\b'),
 ('Science-Fiction', r'\bScience[- ]Fiction\b|\bSF-Roman|\bDystopie'),
 ('Liebesroman', r'\bLiebesroman\b|\bLiebesgeschichte'),
 ('Familienroman', r'\bFamilienroman\b|\bFamiliensaga\b|\bGenerationenroman'),
 ('Heimatroman', r'\bHeimatroman\b|\bDorfroman\b|\bDorfgeschichte'),
 ('Biografie / Wahre Geschichte', r'\bBiograf|\bAutobiograf|\bMemoiren\b|nach einer wahren|\bTatsachenroman'),
 ('Erzählungen', r'\bErzählungen\b|\bKurzgeschichten\b|\bStories\b|\bNovelle|\bGedichte\b'),
 ('Gesellschaftsroman', r'\bGesellschaftsroman\b|\bZeitroman'),
 ('Roman', r'\bRoman\b'),
]

def parse(rec):
    text, bold = rec['text'], rec['bold']
    e = {'quelle': text}
    warn = []

    # --- Kopf (fett): "Nachname, Vorname: Titel." -----------------------
    # Fett-Kopf whitespace-unabhängig im Fließtext lokalisieren
    kopf, rest = '', text
    target = re.sub(r'\s+', '', bold)
    if target:
        buf, idx = '', None
        for i, ch in enumerate(text):
            if not ch.isspace(): buf += ch
            if buf == target: idx = i + 1; break
            if not target.startswith(buf): break
        if idx is None:
            warn.append('kein_fettkopf')
        else:
            kopf, rest = text[:idx].strip(), text[idx:].strip()
    else:
        warn.append('kein_fettkopf')
    m = re.match(r'^(.{2,70}?)\s*[:.]\s+(.*)$', kopf)
    if m: autor, titel = m.group(1).strip(), m.group(2).strip()
    else: autor, titel = '', kopf
    e['autor'] = autor
    if ',' in autor:
        nn, vn = autor.split(',', 1)
        e['autor_nachname'], e['autor_vorname'] = nn.strip(), vn.strip()
        e['autor_anzeige'] = f"{vn.strip()} {nn.strip()}"
    else:
        e['autor_nachname'], e['autor_vorname'], e['autor_anzeige'] = autor, '', autor
    if '/' in autor:  # "Gerritsen, Tess/Braver, Gary"
        e['weitere_autoren'] = [a.strip() for a in autor.split('/')[1:]]
    e['titel'] = titel.strip().rstrip('.').strip()

    # --- Schwanz (bibliographische Angaben) -----------------------------
    s = rest
    m = re.search(r'\s*\(([^()]{0,150})\)?\s*$', s)
    if m and '(' in s[m.start():]:
        note = m.group(1).strip(); s = s[:m.start()].rstrip()
        if note:
            e['notiz'] = note
            mb = re.match(r'^(.+?)[ ,]*(?:Bd\.?|Band)?\s*(\d{1,2})$', note)
            if mb:
                rn = mb.group(1).strip(' ,.')
                if rn and rn not in ('Bd','Bd.','Band'): e['reihe'] = rn
                e['band'] = int(mb.group(2))
            ma = re.search(r'\bab\s*(\d{1,2})\b', note)
            if ma: e['alter_ab'] = int(ma.group(1))

    m = re.search(r'€\s*([0-9]{1,4})[,.]([0-9]{2})\s*$', s)
    if m: e['preis_eur']=float(f"{m.group(1)}.{m.group(2)}"); s=s[:m.start()].rstrip()
    else:
        m = re.search(r'\bATS\s*[0-9.,]+\s*/\s*(?:€\s*)?([0-9]{1,4})[,.]([0-9]{2})\s*$', s)
        if m: e['preis_eur']=float(f"{m.group(1)}.{m.group(2)}"); e['waehrung_original']='ATS'; s=s[:m.start()].rstrip()
        else:
            m = re.search(r'\bATS\s*[0-9.,/]+\s*$', s)
            if m: e['waehrung_original']='ATS'; s=s[:m.start()].rstrip(); warn.append('nur_ATS_preis')
            else:
                m = re.search(r'(?<![\d,])([0-9]{1,3})[,.]([0-9]{2})\s*$', s)   # "kart. 12,40" ohne €
                if m: e['preis_eur']=float(f"{m.group(1)}.{m.group(2)}"); s=s[:m.start()].rstrip()

    m = re.search(r'[\s.](kart\.|kt\.|brosch\.|Broschur|fest geb\.|Festeinbd\.|Hardcover|Taschenbuch|geb\.)\s*$', s)
    if m: e['einband']=BIND[m.group(1)]; s=s[:m.start()].rstrip()

    m = re.search(r'ISBN[-\s]*([0-9][0-9\- ]{7,20}[0-9Xx])-?', s)
    if m:
        d = re.sub(r'[^0-9Xx]','',m.group(1)).upper()
        e['isbn_formatiert'] = m.group(1).strip()
        if len(d) in (10,13): e['isbn']=d
        else: warn.append('isbn_ungueltig')
        s = re.sub(r'\s+',' ', (s[:m.start()]+' '+s[m.end():])).strip().rstrip('-–,').strip()
    else:
        warn.append('keine_isbn')

    m = re.search(r'(\d{1,4})\s*S\.\s*$', s)
    if m: e['seiten']=int(m.group(1)); s=s[:m.start()].rstrip().rstrip('.').rstrip()

    for pat in [r'[,.]?\s*\(?\s*(\d{1,3}\.\s*(?:Aufl|Auflage)[^,.]*(?:\.\s*\w+\.?\s*\d{4})?)\s*\)?\s*$',
                r',\s*([^,]*?(?:Aufl|Ausgabe|Auflage|Lizenzausgabe)[^,]*)$',
                r'[./]\s*(\d{1,3}\.\s*Aufl[^,]*)$',
                r'\.\s*((?:Genehmigte\s+)?Lizenzausgabe[^.]*)$']:
        m = re.search(pat, s)
        if m: e['auflage']=m.group(1).strip().rstrip('.'); s=s[:m.start()].rstrip(); break

    m = re.search(r'\b((?:1[89]|20)\d{2})\s*(?:[,/]\s*(?:(?:1[89]|20)\d{2}|[^.]{0,40}))?\s*\.?\s*$', s)
    if m: e['jahr']=int(m.group(1)); s=s[:m.start()].rstrip()
    elif 'auflage' in e:
        m2 = re.search(r'((?:1[89]|20)\d{2})', e['auflage'])
        if m2: e['jahr']=int(m2.group(1))
    if not e.get('jahr'): warn.append('kein_jahr')

    NICHT_ORT = {'Zeichnungen','Illustrationen','Ill','Mit','Aus','Hrsg','Herausgegeben',
                 'Fotos','Bilder','Übersetzung','Nachwort','Vorwort','Übers','Original','Reihe'}
    m = None
    for mm in re.finditer(r'(?:^|\.\s+)([A-ZÄÖÜ][A-Za-zÄÖÜäöüß\-]{1,20}(?:[ \-][A-ZÄÖÜ][A-Za-zÄÖÜäöüß]{1,20})?):\s*', s):
        if mm.group(1).strip() in NICHT_ORT: continue
        tail = s[mm.end():]
        if not tail or len(tail) > 95: continue
        m = mm
    if m and m.group(1).strip() not in NICHT_ORT:
        e['ort'] = m.group(1).strip(); e['verlag'] = s[m.end():].strip().rstrip('.,')
        s = s[:m.start()].rstrip()
    elif False:
        e['ort']=m.group(1).strip(); e['verlag']=m.group(2).strip().rstrip('.,'); s=s[:m.start()].rstrip()
    else:
        m = re.search(r'(?:^|\.\s+)([^.]{2,60})$', s)
        if m: e['verlag']=m.group(1).strip().rstrip('.,'); s=s[:m.start()].rstrip(); warn.append('kein_ort')
        else: warn.append('kein_verlag')

    e['untertitel'] = re.sub(r'\s+',' ', s).strip().rstrip('.').strip()

    ctx = ' '.join([e['titel'], e['untertitel'], e.get('notiz','')])
    GENRE_WOERTER = {'Roman','Kriminalroman','Krimi','Thriller','Psychothriller','Erzählungen',
                     'Novelle','Hörbuch','Hörspiel','Bd','Band','Kriminalromane'}
    def setze_reihe(v):
        v = v.strip(' –-,.')
        if v and v not in GENRE_WOERTER and not e.get('reihe'): e['reihe'] = v

    m = re.search(r'\bEin(?:e)? (?:Fall für|Ermittlung von) ([A-ZÄÖÜ][^.,;]{2,40})', ctx)
    if m: setze_reihe('Ein Fall für ' + m.group(1))
    m = re.search(r'\bEin(?:e)? ([A-ZÄÖÜ][\wäöüß]*(?:[- ][A-ZÄÖÜ]?[\wäöüß]*){0,2}[- ](?:Krimi|Reihe|Serie|Saga))\b', ctx)
    if m: setze_reihe(m.group(1))
    m = re.search(r'([^.,;]{2,60}?),?\s*(?:Bd\.|Band)\s*(\d+)', ctx)
    if m:
        setze_reihe(m.group(1))
        e.setdefault('band', int(m.group(2)))
    if e.get('notiz') and not e.get('reihe'):
        mn = re.match(r'^([A-ZÄÖÜ][^.,;]{2,45}?)\s+(\d{1,2})$', e['notiz'])
        if mn: setze_reihe(mn.group(1)); e.setdefault('band', int(mn.group(2)))

    m = re.search(r'\b(?:Aus|A\.)\s+d(?:\.|em)\s+([A-Za-zÄÖÜäöüß.]+(?:\s+Englisch)?)', ctx)
    if m: e['originalsprache'] = m.group(1).rstrip('.')
    m = re.search(r'\b(?:(?:Aus|A\.)\s+d(?:\.|em)[^.]*?|Dt\.)\s+v\.\s+([^.]{3,60})', ctx)
    if m: e['uebersetzung'] = m.group(1).strip()

    gs = [g for g,p in GENRE_RULES if re.search(p, ctx, re.I)]
    if len(gs)>1 and 'Roman' in gs: gs.remove('Roman')
    e['genres'] = gs or ['Roman']

    e['sparte']='romane'; e['medium']='Buch'; e['sprache']='de'
    e['pruefen'] = warn
    base = e.get('isbn') or hashlib.sha1(text.encode()).hexdigest()[:10]
    e['id'] = 'rom-' + slug(f"{e['autor_nachname']}-{e['titel']}")[:52] + '-' + base[-4:]
    return e

items=[]; frag=[]
for r in recs:
    if not r['bold']: frag.append(r['text']); continue
    items.append(parse(r))
seen={}
for it in items:
    seen[it['id']]=seen.get(it['id'],0)+1
    if seen[it['id']]>1: it['id'] += f"-{seen[it['id']]}"

print('Einträge:', len(items), '| Fragmente (Datenverlust im Original):', len(frag), file=sys.stderr)
for f in ['autor','titel','untertitel','verlag','ort','jahr','seiten','isbn','einband','preis_eur','reihe']:
    print(f'  {f:12} fehlt bei {sum(1 for i in items if not i.get(f)):4}', file=sys.stderr)
print('  mit Warnung:', sum(1 for i in items if i['pruefen']), file=sys.stderr)
print('  doppelte IDs:', len(items)-len({i["id"] for i in items}), file=sys.stderr)
from collections import Counter
print('  Genres:', Counter(g for i in items for g in i['genres']).most_common(), file=sys.stderr)
json.dump({'items':items,'fragmente':frag}, open('/tmp/romane_p.json','w'), ensure_ascii=False, indent=1)
