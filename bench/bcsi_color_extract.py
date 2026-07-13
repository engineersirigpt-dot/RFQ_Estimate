# BCSI PackDesign color extractor + full-scan (ตาม GPT: centroid seed + tolerance + abstention)
#   BCSI ไม่ใช้ OCG -> เข้ารหัสด้วย stroke color คงที่:
#     cut   = แดง        (0.931, 0.122, 0.141)
#     crease= น้ำเงินเทา (0.369, 0.396, 0.683)
#     อื่นๆ (near-black hatching / dimension / registration) = ไม่ใช่ dieline
#   กติกา: cluster สี stroke ต่อไฟล์ -> nearest seed ภายใน TOL + margin จาก seed อีกตัว
#          + coverage (length-weighted) พอ -> ถึงนับ extracted; ไม่งั้น abstain
#   profile versioned: เก็บ seed/tol ไว้ config เดียว | หา "จำนวนที่ extract ได้จริง" ไม่ใช่เพดาน
# python bench/bcsi_color_extract.py            (full-scan BCSI + overlay sample)
import fitz, os, glob, re, csv, math, unicodedata, collections
from PIL import Image, ImageDraw

SRC='test/uploads'; OUT='bench/ocg_pilot'; os.makedirs(OUT+'/bcsi',exist_ok=True)
OVERLAY_MAX=24                      # render overlay ให้ reviewer ตรวจ (audit step ถัดไป)

# ---- profile: bcsi_packdesign_2008_v1 (seed จาก corpus จริง ไม่ hardcode equality) ----
PROFILE='bcsi_packdesign_2008_v1'
SEED={'cut':(0.931,0.122,0.141), 'crease':(0.369,0.396,0.683)}
TOL=0.22           # ระยะ RGB สูงสุดที่ยังถือว่าใกล้ seed (seeds ห่างกัน 0.83 -> margin ในตัว)
MARGIN=0.12        # ต้องใกล้ seed ที่ assign มากกว่าอีก seed อย่างน้อยเท่านี้
MIN_COV=0.03       # coverage (สัดส่วน length) ขั้นต่ำต่อ role
MIN_LEN=50.0       # ความยาว stroke ขั้นต่ำต่อ role (pt) กันเส้นเศษ

def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); return re.sub(r'[\s_\-/.]+',' ',s).strip()
def is_bcsi(prod):
    pl=norm(prod); return 'packdesign' in pl or 'bcsi' in pl
def dist(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
def pts(it):
    out=[]
    for e in it[1:]:
        if hasattr(e,'x'): out.append((e.x,e.y))
        elif isinstance(e,(tuple,list)) and len(e)>=2 and isinstance(e[0],(int,float)): out.append((e[0],e[1]))
        elif hasattr(e,'__len__') and len(e)==4 and hasattr(e[0],'x'):
            for q in e: out.append((q.x,q.y))
    return out
def plen(pth):
    tot=0.0
    for it in pth.get('items',[]):
        pf=pts(it)
        for a,b in zip(pf,pf[1:]): tot+=math.hypot(b[0]-a[0],b[1]-a[1])
    return tot

def analyze(doc):
    # cluster stroke color -> total length | อ่านทุกหน้า
    clen=collections.defaultdict(float)
    stroke_paths=[]                       # (rounded_color, pth, page_no) เก็บไว้ overlay
    for pno,page in enumerate(doc):
        try: draws=page.get_cdrawings()
        except Exception: continue
        for pth in draws:
            t=pth.get('type') or ''
            if 's' not in t: continue     # เฉพาะ stroke (s / fs)
            c=pth.get('color')
            if c is None or len(c)<3: continue
            key=tuple(round(x,3) for x in c[:3])
            L=plen(pth)
            clen[key]+=L
            stroke_paths.append((key,pth,pno))
    total=sum(clen.values()) or 1.0
    # assign แต่ละ cluster ให้ role ตาม seed (TOL + margin)
    role_len={'cut':0.0,'crease':0.0}
    best={'cut':(9.9,None),'crease':(9.9,None)}   # (dist, color) ของ cluster ที่ใกล้ seed สุด
    role_of={}
    ambiguous=False
    for col,L in clen.items():
        dc=dist(col,SEED['cut']); dk=dist(col,SEED['crease'])
        near=min(('cut',dc),('crease',dk),key=lambda z:z[1])
        r,dr=near; other=dk if r=='cut' else dc
        if dr<=TOL and (other-dr)>=MARGIN:
            role_of[col]=r; role_len[r]+=L
            if dr<best[r][0]: best[r]=(dr,col)
        elif dr<=TOL and (other-dr)<MARGIN:
            ambiguous=True               # อยู่กึ่งกลางระหว่าง cut/crease
    cov={r:role_len[r]/total for r in role_len}
    extracted = (role_len['cut']>=MIN_LEN and role_len['crease']>=MIN_LEN
                 and cov['cut']>=MIN_COV and cov['crease']>=MIN_COV)
    return dict(total=total, cut_len=role_len['cut'], crease_len=role_len['crease'],
                cov_cut=cov['cut'], cov_crease=cov['crease'],
                dist_cut=best['cut'][0], dist_crease=best['crease'][0],
                ambiguous=ambiguous, extracted=extracted,
                stroke_paths=stroke_paths, role_of=role_of)

def overlay(doc, role_of, out_png):
    page=doc[0]; zoom=2.0
    pix=page.get_pixmap(matrix=fitz.Matrix(zoom,zoom))
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).convert('RGB')
    im=Image.blend(im,Image.new('RGB',im.size,(255,255,255)),0.6)
    dr=ImageDraw.Draw(im)
    COL={'cut':(220,20,20),'crease':(20,60,220)}
    try: draws=page.get_cdrawings()
    except Exception: return
    for pth in draws:
        if 's' not in (pth.get('type') or ''): continue
        c=pth.get('color')
        if c is None or len(c)<3: continue
        r=role_of.get(tuple(round(x,3) for x in c[:3]))
        if not r: continue
        for it in pth.get('items',[]):
            P=[(x*zoom,y*zoom) for x,y in pts(it)]
            if len(P)>=2: dr.line(P,fill=COL[r],width=2)
    im.save(out_png,quality=80)

pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
print(f'profile={PROFILE}  TOL={TOL} MARGIN={MARGIN} MIN_COV={MIN_COV}')
print(f'seed cut={SEED["cut"]}  crease={SEED["crease"]}\nสแกน PDF {len(pdfs)} ใบ หา BCSI...')

rows=[]; n_bcsi=n_extract=n_ambig=n_partial=ov=0
for i,p in enumerate(pdfs):
    try: doc=fitz.open(p)
    except Exception: continue
    prod=((doc.metadata or {}).get('producer') or (doc.metadata or {}).get('creator') or '?')
    if not is_bcsi(prod): doc.close(); continue
    n_bcsi+=1
    r=analyze(doc)
    if r['extracted']:
        n_extract+=1
        if ov<OVERLAY_MAX:
            ov+=1
            try: overlay(doc,r['role_of'],f'{OUT}/bcsi/{ov:02d}.png')
            except Exception: pass
    elif r['cut_len']>=MIN_LEN or r['crease_len']>=MIN_LEN:
        n_partial+=1                       # เจอ role เดียว = candidate ไม่ separable
    if r['ambiguous']: n_ambig+=1
    rows.append([os.path.basename(p)[:44], PROFILE,
                 round(r['cut_len']),round(r['crease_len']),round(r['total']),
                 round(r['cov_cut'],3),round(r['cov_crease'],3),
                 round(r['dist_cut'],3),round(r['dist_crease'],3),
                 'Y' if r['ambiguous'] else '', 'Y' if r['extracted'] else ''])
    doc.close()
    if n_bcsi%200==0: print(f'\r  BCSI {n_bcsi} scanned',end='')

HDR=['file','profile','cut_len','crease_len','total_len','cov_cut','cov_crease',
     'dist_cut','dist_crease','ambiguous','extracted']
csv.writer(open(OUT+'/bcsi_extract.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [HDR]+[[str(c) for c in r] for r in rows])

print(f'\n\n=== BCSI color extract ({PROFILE}) ===')
print(f'  BCSI PDF พบ                    : {n_bcsi}')
print(f'  extracted (cut+crease แยกได้)  : {n_extract}  ({100*n_extract//n_bcsi if n_bcsi else 0}% ของ BCSI)  << actual ไม่ใช่เพดาน')
print(f'  partial (เจอ role เดียว)       : {n_partial}')
print(f'  ambiguous color (สีก้ำกึ่ง)    : {n_ambig}')
print(f'  abstain (ไม่เข้าเกณฑ์)         : {n_bcsi-n_extract-n_partial}')
print(f'\noverlay {ov} ใบ -> {OUT}/bcsi/  (cut=แดง crease=น้ำเงิน) สำหรับ reviewer audit')
print(f'manifest -> {OUT}/bcsi_extract.tsv  (มี dist/cov ให้ตรวจ threshold ย้อนหลัง)')
