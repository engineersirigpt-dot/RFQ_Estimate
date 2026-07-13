# OCG extractor pilot (ตาม GPT consult) — ดึง cut/crease จาก PDF layer + overlay PNG ให้คนดู
# ใช้ path['layer'] (PyMuPDF>=1.22) · whitelist ไม่ใช่ substring · cut/crease แยกสี · silver ไม่ใช่ gold
# python bench/ocg_extract_pilot.py  (pilot: เก็บ positives + negatives ไม่ full-scan)
import fitz, os, glob, re, csv, io, unicodedata, hashlib, collections
from PIL import Image, ImageDraw

assert tuple(int(x) for x in fitz.VersionBind.split('.')[:2]) >= (1,22), 'ต้อง PyMuPDF>=1.22 (path layer)'
SRC='test/uploads'; OUT='bench/ocg_pilot'; os.makedirs(OUT+'/overlay',exist_ok=True)
MAX_POS=40; MAX_NEG=20; SCAN_CAP=1200      # pilot: หยุดเมื่อได้ครบ

def norm(s):  # NFKC + lower + collapse (เก็บ raw ไว้ด้วย)
    s=unicodedata.normalize('NFKC',s or '').lower()
    return re.sub(r'[\s_\-/.]+',' ',s).strip()
CREASE=re.compile(r'\b(crease|fold|score)\b')
CUT=re.compile(r'\b(cut|dicut|die ?cut|thru|knife|kiss|through)\b')
DIE=re.compile(r'\b(die ?line|dieline|die|cutting)\b')
def classify(raw):
    n=norm(raw)
    if CREASE.search(n): return 'crease'
    if CUT.search(n):    return 'cut'
    if DIE.search(n):    return 'die'      # โครงสร้างแต่ไม่แยก cut/crease
    return None

def pts(it):  # item -> list of (x,y) จาก cdrawings (จุดเป็น tuple หรือ Point)
    out=[]
    for e in it[1:]:
        if hasattr(e,'x'): out.append((e.x,e.y))
        elif isinstance(e,(tuple,list)) and len(e)>=2 and isinstance(e[0],(int,float)): out.append((e[0],e[1]))
        elif hasattr(e,'__len__') and len(e)==4 and hasattr(e[0],'x'):  # rect/quad
            for q in e: out.append((q.x,q.y))
    return out

def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for c in iter(lambda:f.read(65536),b''): h.update(c)
    return h.hexdigest()[:16]

def extract(doc):
    # คืน dict layer_role -> list ของ path items | + รายชื่อ layer ที่เจอ
    roles=collections.defaultdict(list); layers=collections.Counter()
    for page in doc:
        try: draws=page.get_cdrawings()
        except Exception: draws=page.get_drawings()
        for pth in draws:
            lname=pth.get('layer') or ''
            role=classify(lname)
            if lname: layers[lname]+=1
            if role: roles[role].append((page.number,pth))
    return roles, layers

def overlay(doc, roles, out_png):
    page=doc[0]; zoom=2.0
    pix=page.get_pixmap(matrix=fitz.Matrix(zoom,zoom))
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).convert('RGB')
    # จาง artwork ลงให้เส้นโครงสร้างเด่น
    im=Image.blend(im,Image.new('RGB',im.size,(255,255,255)),0.55)
    dr=ImageDraw.Draw(im)
    COL={'cut':(220,20,20),'crease':(20,60,220),'die':(20,160,20)}
    for role,items in roles.items():
        col=COL.get(role,(120,120,120))
        for pno,pth in items:
            if pno!=0: continue
            for it in pth.get('items',[]):
                P=[(x*zoom,y*zoom) for x,y in pts(it)]
                if len(P)>=2: dr.line(P,fill=col,width=2)
    im.save(out_png,quality=80)

pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
print(f'PDF ทั้งหมด {len(pdfs)} | pilot: หา positives {MAX_POS} + negatives {MAX_NEG} (scan cap {SCAN_CAP})')
rows=[]; pos=neg=0; scanned=0
for p in pdfs:
    if pos>=MAX_POS and neg>=MAX_NEG: break
    if scanned>=SCAN_CAP: break
    try: doc=fitz.open(p)
    except Exception: continue
    scanned+=1
    prod=((doc.metadata or {}).get('producer') or (doc.metadata or {}).get('creator') or '?')[:24]
    roles,layers=extract(doc)
    n_cut=sum(len(roles.get(r,[])) for r in ['cut']); n_cre=len(roles.get('crease',[])); n_die=len(roles.get('die',[]))
    has_struct = (n_cut+n_cre+n_die)>0
    separated = n_cut>0 and n_cre>0            # cut กับ crease แยก layer = evidence แข็งสุด
    base=os.path.basename(p)
    if has_struct and pos<MAX_POS:
        pos+=1; tag='POS'
        try: overlay(doc,roles,f'{OUT}/overlay/pos_{pos:02d}.png')
        except Exception as e: tag='POS(overlay fail:%s)'%str(e)[:15]
    elif (not has_struct) and neg<MAX_NEG:
        neg+=1; tag='NEG'
        try: overlay(doc,roles,f'{OUT}/overlay/neg_{neg:02d}.png')
        except Exception: pass
    else:
        doc.close(); continue
    rows.append([tag,base[:40],prod,n_cut,n_cre,n_die,'Y' if separated else '',
                 '|'.join(sorted(set(l for l in layers))[:5])])
    doc.close()

HDR=['tag','file','producer','n_cut','n_crease','n_die','cut+crease_แยก','layer_names']
csv.writer(open(OUT+'/manifest.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows([HDR]+rows)
sep=sum(1 for r in rows if r[6]=='Y')
print(f'\nscan {scanned} ไฟล์ | positives {pos} (แยก cut+crease {sep}) | negatives {neg}')
print(f'overlay PNG → {OUT}/overlay/  | manifest → {OUT}/manifest.tsv')
print('\n=== positives (มี structural layer) ===')
for r in rows:
    if r[0].startswith('POS'): print('  cut%-3d crease%-3d die%-3d %s | %s : %s'%(r[3],r[4],r[5],'[แยก]' if r[6] else '     ',r[2],r[7][:45]))
