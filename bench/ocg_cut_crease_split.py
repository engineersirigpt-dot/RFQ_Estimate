# Phase 2: แยก cut (เส้นทึบ) vs crease (เส้นประ) ในไฟล์ที่มี structural layer แล้ว overlay สีแยก
# convention prepress: crease/fold = dashed, cut = solid | python bench/ocg_cut_crease_split.py
import fitz, os, glob, re, csv, unicodedata, collections
from PIL import Image, ImageDraw

SRC='test/uploads'; OUT='bench/ocg_pilot'; os.makedirs(OUT+'/split',exist_ok=True)
MAX=24; SCAN_CAP=1200
def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); return re.sub(r'[\s_\-/.]+',' ',s).strip()
STRUCT=re.compile(r'\b(crease|fold|score|cut|dicut|die ?cut|thru|knife|kiss|die ?line|dieline|die|cutting)\b')
def is_struct(raw): return bool(STRUCT.search(norm(raw)))

def is_dashed(pth):
    d=pth.get('dashes')
    if not d: return False
    nums=re.findall(r'[\d.]+',str(d))
    return any(float(x)>0 for x in nums)          # มีช่วง on/off > 0 = เส้นประ

def pts(it):
    out=[]
    for e in it[1:]:
        if hasattr(e,'x'): out.append((e.x,e.y))
        elif isinstance(e,(tuple,list)) and len(e)>=2 and isinstance(e[0],(int,float)): out.append((e[0],e[1]))
        elif hasattr(e,'__len__') and len(e)==4 and hasattr(e[0],'x'):
            for q in e: out.append((q.x,q.y))
    return out

def split_render(doc, out_png):
    page=doc[0]; zoom=2.0
    try: draws=page.get_cdrawings()
    except Exception: draws=page.get_drawings()
    cut=[]; crease=[]
    dash_ct=collections.Counter()
    for pth in draws:
        if not is_struct(pth.get('layer') or ''): continue
        (crease if is_dashed(pth) else cut).append(pth)
        dash_ct[str(pth.get('dashes'))[:12]]+=1
    pix=page.get_pixmap(matrix=fitz.Matrix(zoom,zoom))
    im=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).convert('RGB')
    im=Image.blend(im,Image.new('RGB',im.size,(255,255,255)),0.7)
    dr=ImageDraw.Draw(im)
    for role,col in [(cut,(220,20,20)),(crease,(20,60,220))]:      # cut=แดง crease=น้ำเงิน
        for pth in role:
            for it in pth.get('items',[]):
                P=[(x*zoom,y*zoom) for x,y in pts(it)]
                if len(P)>=2: dr.line(P,fill=col,width=2)
    im.save(out_png,quality=80)
    return len(cut),len(crease),dash_ct

pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
rows=[]; done=0; scanned=0
for p in pdfs:
    if done>=MAX or scanned>=SCAN_CAP: break
    try: doc=fitz.open(p)
    except Exception: continue
    scanned+=1
    try: draws=doc[0].get_cdrawings()
    except Exception:
        try: draws=doc[0].get_drawings()
        except Exception: draws=[]
    if not any(is_struct(d.get('layer') or '') for d in draws): doc.close(); continue
    done+=1
    nc,ncr,dct=split_render(doc,f'{OUT}/split/{done:02d}.png')
    rows.append([os.path.basename(p)[:36],nc,ncr,'Y' if (nc>0 and ncr>0) else '', dict(dct.most_common(4))])
    doc.close()

csv.writer(open(OUT+'/split_manifest.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [['file','n_cut_solid','n_crease_dashed','แยกได้','dash_patterns']]+[[r[0],r[1],r[2],r[3],str(r[4])] for r in rows])
sep=sum(1 for r in rows if r[3]=='Y')
print(f'scan {scanned} | structural {done} | แยก cut+crease ได้จาก dash: {sep}/{done}')
print('overlay → %s/split/  (cut=แดง crease=น้ำเงิน)\n'%OUT)
for r in rows: print('  cut(ทึบ)%-4d crease(ประ)%-4d %s | %s : %s'%(r[1],r[2],'[แยกได้]' if r[3] else '[ทึบล้วน]',r[0],r[4]))
