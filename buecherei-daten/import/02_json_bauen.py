# -*- coding: utf-8 -*-
import json, re, unicodedata, hashlib, datetime, openpyxl, os
OUT='/sessions/eloquent-charming-darwin/mnt/outputs/buecherei-daten'
os.makedirs(OUT+'/data', exist_ok=True)

def slug(s):
    s=s.lower().replace('ä','ae').replace('ö','oe').replace('ü','ue').replace('ß','ss')
    s=unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode()
    return re.sub(r'-+','-',re.sub(r'[^a-z0-9]+','-',s).strip('-'))

# ---------- Romane ----------
p=json.load(open('/tmp/romane_p.json'))
romane=[]
for x in p['items']:
    if x.get('reihe'): x['reihe']=re.sub(r'\s*\(?(Bd\.?|Band)\.?\s*$','',x['reihe']).strip(' (,-')
    o={'id':x['id'],'sparte':'romane','medium':'Buch','titel':x['titel']}
    for k in ['untertitel','reihe','band','autor_nachname','autor_vorname',
              'weitere_autoren','uebersetzung','originalsprache','verlag','ort','jahr','auflage',
              'seiten','isbn','isbn_formatiert','einband','preis_eur','waehrung_original',
              'alter_ab','notiz','genres']:
        if x.get(k) not in (None,'',[]): o[k]=x[k]
    o['sprache']='de'
    o['autor']=x['autor_anzeige']
    o['suchtext']=' '.join(str(v) for v in [x['autor'],x['titel'],x.get('untertitel',''),
                    x.get('reihe',''),x.get('verlag',''),' '.join(x['genres'])] if v)
    o['bestand']=1; o['status']='verfuegbar'; o['standort']=''; o['signatur']=''
    o['erfasst_am']=None; o['cover_url']=None
    if x['pruefen']: o['_pruefen']=x['pruefen']
    o['_quelle']=x['quelle']
    romane.append(o)

# ---------- Tonies ----------
wb=openpyxl.load_workbook('/sessions/eloquent-charming-darwin/mnt/uploads/f0e35ff3-4c59-41d6-b30a-4e3eef53c8ef-1786831676793_Tonies.xlsx',data_only=True)
ART={'Höspiel':'Hörspiel'}
tonies=[]; seen={}
for row in wb['Tabelle1'].iter_rows(values_only=True):
    titel, art, minuten, alter, figur = (row+(None,)*5)[:5]
    if not titel: continue
    titel=re.sub(r'\s+',' ',str(titel)).strip()
    o={'sparte':'tonies','medium':'Tonie'}
    # "Nachname, Vorname: Titel" oder "Reihe: Titel" oder nur Titel
    m=re.match(r'^([A-ZÄÖÜ][^:]{1,45}),\s*([^:]{1,30}):\s*(.+)$', titel)
    if m:
        o['autor_nachname'],o['autor_vorname']=m.group(1).strip(),m.group(2).strip()
        o['autor']=f"{m.group(2).strip()} {m.group(1).strip()}"
        o['titel']=m.group(3).strip()
    else:
        m=re.match(r'^([^:]{2,45}):\s*(.+)$', titel)
        if m: o['reihe']=m.group(1).strip(); o['titel']=m.group(2).strip()
        else:
            m=re.match(r'^(.+?)\s+-\s+(.+)$', titel)
            if m: o['reihe']=m.group(1).strip(); o['titel']=m.group(2).strip()
            else: o['titel']=titel
    art=ART.get((art or '').strip(), (art or '').strip())
    if art:
        o['art']=art
        o['genres']=[g for g in ['Hörspiel','Hörbuch'] if g in art] or [art]
        if 'Lied' in art or 'Musik' in art: o['genres'].append('mit Musik')
    else: o['genres']=[]
    if isinstance(minuten,(int,float)): o['laufzeit_min']=int(minuten)
    if isinstance(alter,(int,float)): o['alter_ab']=int(alter)
    if figur: o['figur']=re.sub(r'\s+',' ',str(figur)).strip()
    o['sprache']='de'
    o['suchtext']=' '.join(str(v) for v in [titel,o.get('reihe',''),o.get('figur',''),art] if v)
    o['bestand']=1; o['status']='verfuegbar'; o['standort']=''; o['signatur']=''
    o['erfasst_am']=None; o['cover_url']=None
    o['_quelle']=titel
    base='ton-'+slug(f"{o.get('reihe','') or o.get('autor_nachname','')}-{o['titel']}")[:52]
    seen[base]=seen.get(base,0)+1
    o['id']=base if seen[base]==1 else f"{base}-{seen[base]}"
    tonies.append(o)

def wr(name,obj):
    with open(f'{OUT}/{name}','w',encoding='utf-8') as f:
        json.dump(obj,f,ensure_ascii=False,indent=2)
    print(name, os.path.getsize(f'{OUT}/{name}')//1024,'KB')

heute=datetime.date.today().isoformat()
wr('data/romane.json',{'sparte':'romane','bezeichnung':'Romane (Deutsch)','stand':heute,
   'quelle':'Romane.doc','anzahl':len(romane),'items':romane})
wr('data/tonies.json',{'sparte':'tonies','bezeichnung':'Tonies','stand':heute,
   'quelle':'Tonies.xlsx','anzahl':len(tonies),'items':tonies})
for s,b in [('spiele','Spiele'),('cds','CDs'),('kinderbuecher','Kinderbücher'),
            ('kinder-sachbuecher','Kinder-Sachbücher'),('sachbuecher','Sachbücher')]:
    wr(f'data/{s}.json',{'sparte':s,'bezeichnung':b,'stand':heute,'quelle':'','anzahl':0,'items':[]})
json.dump(p['fragmente'],open(f'{OUT}/data/_unlesbar.json','w'),ensure_ascii=False,indent=2)
print('Romane:',len(romane),'| Tonies:',len(tonies))
