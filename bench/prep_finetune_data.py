# แพ็กข้อมูล fine-tune v2 — train (500/ทรง) + gold holdout (expert-confirmed, กัน leakage)
# train: proxy label (noisy แต่เยอะ) | gold: expert label (วัด accuracy จริง)
# ตัด family ของ gold ออกจาก train (กัน leakage) | python bench/prep_finetune_data.py [cap=500]
import os, re, sys, csv, io, zipfile, collections
import fitz
try: from PIL import Image
except ImportError: os.system(sys.executable+' -m pip install pillow -q'); from PIL import Image

CAP=int(sys.argv[1]) if len(sys.argv)>1 else 500
SRC='test/uploads'; OUT='bench/finetune_data'; PX=384
os.makedirs(OUT+'/img', exist_ok=True); os.makedirs(OUT+'/gold', exist_ok=True)
JUNK=re.compile(r'ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|estimate',re.I)

meta={}; rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())
def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b',f,re.I); return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I); b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b)
    return re.sub(r'\s+',' ',re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)).strip().lower()
def gid(f): j=meta.get(f,('',''))[1]; return ('job:'+j) if j else ('nm:'+normbase(f))

# gold set (expert) + family ของมัน (ตัดจาก train)
gold={r[0]:int(r[1]) for r in [l.split('\t') for l in open('answer_key/gold_final.tsv',encoding='utf-8').read().splitlines()[1:]]}
gold_fams=set(gid(f) for f in gold)

def render(path):
    if path.lower().endswith('.pdf'):
        d=fitz.open(path); pix=d[0].get_pixmap(matrix=fitz.Matrix(2,2)); im=Image.open(io.BytesIO(pix.tobytes('png'))); d.close()
    else: im=Image.open(path)
    im=im.convert('RGB'); im.thumbnail((PX,PX)); bg=Image.new('RGB',(PX,PX),(255,255,255))
    bg.paste(im,((PX-im.width)//2,(PX-im.height)//2)); return bg

# --- train (proxy, ตัด gold family) ---
byT=collections.defaultdict(list)
for f,(t,j) in meta.items():
    if gid(f) in gold_fams or JUNK.search(f): continue     # กัน leakage + non-dieline
    byT[t].append(f)
rows=[]; per=collections.Counter(); ok=0
for t in sorted(byT):
    for f in byT[t]:
        if per[t]>=CAP: break
        if not os.path.exists(os.path.join(SRC,f)): continue
        try: im=render(os.path.join(SRC,f))
        except Exception: continue
        nm=f'{ok:05d}.png'; im.save(OUT+'/img/'+nm); rows.append([nm,t,gid(f)]); per[t]+=1; ok+=1
        if ok%200==0: print(f'\r  train {ok}',end='')
csv.writer(open(OUT+'/labels.csv','w',newline='',encoding='utf-8')).writerows([['file','label','group_id']]+rows)
print(f'\ntrain: {ok} รูป | ต่อทรง: {dict(sorted(per.items()))}')

# --- gold holdout (expert) ---
grows=[]; gi=0
for f,g in gold.items():
    if not os.path.exists(os.path.join(SRC,f)): print('gold หาย:',f[:30]); continue
    try: im=render(os.path.join(SRC,f))
    except Exception: continue
    nm=f'g{gi:02d}.png'; im.save(OUT+'/gold/'+nm); grows.append([nm,g]); gi+=1
csv.writer(open(OUT+'/gold_labels.csv','w',newline='',encoding='utf-8')).writerows([['file','label']]+grows)
print(f'gold holdout: {gi} รูป (expert) | ต่อทรง: {dict(sorted(collections.Counter(r[1] for r in grows).items()))}')

# --- zip ---
zp='bench/dieline_train.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(OUT+'/labels.csv','labels.csv'); z.write(OUT+'/gold_labels.csv','gold_labels.csv')
    for r in rows: z.write(OUT+'/img/'+r[0],'img/'+r[0])
    for r in grows: z.write(OUT+'/gold/'+r[0],'gold/'+r[0])
print(f'\n📦 {zp} ({os.path.getsize(zp)//1024//1024} MB) — อัปขึ้น Colab')
