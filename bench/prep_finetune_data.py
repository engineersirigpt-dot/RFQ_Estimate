# แพ็กข้อมูล fine-tune v2.1 — train (cap/ทรง) + adjudicated holdout (กัน leakage แบบ connected-components)
# train: proxy label (noisy แต่เยอะ) | holdout: adjudicated label (expert 4 + claude-review 5)
# family = connected-components (f_code | sha256 | job+normbase) — ตัวเดียวกับ eval_framework.py
# ตัด family ของ holdout ออกจาก train + assert train∩holdout=∅ + รายงาน near-dup
# python bench/prep_finetune_data.py [cap=500]
import os, re, sys, csv, io, zipfile, collections, hashlib
import fitz
try: from PIL import Image, ImageChops
except ImportError: os.system(sys.executable+' -m pip install pillow -q'); from PIL import Image, ImageChops

CAP=int(sys.argv[1]) if len(sys.argv)>1 else 500
SRC='test/uploads'; OUT='bench/finetune_data'; PX=384
os.makedirs(OUT+'/img', exist_ok=True); os.makedirs(OUT+'/gold', exist_ok=True)
JUNK=re.compile(r'ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|estimate',re.I)

# ---------- meta: file -> (proxy_label, job_id) ----------
meta={}; rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())

# ---------- adjudicated holdout (source: expert | claude) ----------
gold={}; gsrc={}
for l in open('answer_key/gold_final.tsv',encoding='utf-8').read().splitlines()[1:]:
    r=l.split('\t'); gold[r[0]]=int(r[1]); gsrc[r[0]]=r[2] if len(r)>2 else 'unknown'

# ---------- family graph: connected-components (พอร์ตจาก eval_framework.py) ----------
def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b',f,re.I); return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I)
    b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b); b=re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)
    return re.sub(r'\s+',' ',b).strip().lower()
def sha(f):
    p=os.path.join(SRC,f)
    if not os.path.exists(p): return ''
    h=hashlib.sha256()
    with open(p,'rb') as fh:
        for ch in iter(lambda:fh.read(65536),b''): h.update(ch)
    return h.hexdigest()[:16]

pool=sorted(set(meta)|set(gold))                       # รวม gold เข้า graph ด้วย
parent={}
def find(x):
    parent.setdefault(x,x)
    while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
    return x
def union(a,b): parent[find(a)]=find(b)
for f in pool: find(f)
byF=collections.defaultdict(list); byJN=collections.defaultdict(list); byS=collections.defaultdict(list)
for f in pool:
    fc=fcode(f)
    if fc: byF[fc].append(f)
    jid=meta.get(f,('',''))[1]; byJN[(jid,normbase(f))].append(f)
    s=sha(f)
    if s: byS[s].append(f)
sha_merges=0
for g in byF.values():                                 # edge: same F-code
    for x in g[1:]: union(g[0],x)
for g in byJN.values():                                 # edge: same (job, normbase)
    for x in g[1:]: union(g[0],x)
for g in byS.values():                                  # edge: same sha256 = EXACT dup (byte-identical) เท่านั้น
    for x in g[1:]:                                      # ไม่จับ near-dup (revision/re-render hash ต่าง) — ต้อง pHash/embedding ถึงจับได้
        if find(g[0])!=find(x): sha_merges+=1
        union(g[0],x)
def fam(f): return 'fam_'+hashlib.sha256(find(f).encode()).hexdigest()[:12]

gold_fams=set(fam(f) for f in gold)
dup_groups=sum(1 for g in byS.values() if len(g)>1)
print(f'family graph: {len(pool)} ไฟล์ → {len(set(fam(f) for f in pool))} families | '
      f'exact-sha dup groups {dup_groups} (merge เพิ่ม {sha_merges}) | holdout families {len(gold_fams)} '
      f'| ⚠️ near-dup ยังไม่จับ (ต้อง pHash)')

def trim(im):
    # crop กรอบเนื้อ dieline (ตัด whitespace) → feature เล็ก (window/notch) ได้ pixel มากขึ้น (GPT Round 16)
    bg=Image.new('RGB',im.size,(255,255,255)); bb=ImageChops.difference(im,bg).getbbox()
    if bb:
        w,h=im.size; mx=max(2,int((bb[2]-bb[0])*0.03)); my=max(2,int((bb[3]-bb[1])*0.03))
        im=im.crop((max(0,bb[0]-mx),max(0,bb[1]-my),min(w,bb[2]+mx),min(h,bb[3]+my)))
    return im
def render(path):
    if path.lower().endswith('.pdf'):
        d=fitz.open(path); pix=d[0].get_pixmap(matrix=fitz.Matrix(2,2)); im=Image.open(io.BytesIO(pix.tobytes('png'))); d.close()
    else: im=Image.open(path)
    im=trim(im.convert('RGB'))                         # crop bbox ก่อน แล้ว preserve-aspect + pad ขาว
    im.thumbnail((PX,PX)); bg=Image.new('RGB',(PX,PX),(255,255,255))
    bg.paste(im,((PX-im.width)//2,(PX-im.height)//2)); return bg

# ---------- ตรวจ mixed-label families (family เดียวมีหลาย proxy label = grouping/label ขัด) ตัดทิ้ง (GPT Round 16) ----------
famlabels=collections.defaultdict(set)
for f,(t,j) in meta.items():
    if fam(f) in gold_fams or JUNK.search(f): continue
    famlabels[fam(f)].add(t)
mixed_fams={g for g,s in famlabels.items() if len(s)>1}
print(f'mixed-label families ตัดทิ้ง: {len(mixed_fams)} ({sum(1 for f in meta if fam(f) in mixed_fams)} ไฟล์)')

# ---------- train (proxy, ตัด holdout family + non-dieline + mixed-label family) ----------
byT=collections.defaultdict(list)
for f,(t,j) in meta.items():
    if fam(f) in gold_fams or JUNK.search(f) or fam(f) in mixed_fams: continue
    byT[t].append(f)
rows=[]; per=collections.Counter(); ok=0
for t in sorted(byT):
    for f in sorted(byT[t]):                            # เรียงคงที่ = reproducible
        if per[t]>=CAP: break
        if not os.path.exists(os.path.join(SRC,f)): continue
        try: im=render(os.path.join(SRC,f))
        except Exception: continue
        nm=f'{ok:05d}.png'; im.save(OUT+'/img/'+nm); rows.append([nm,t,fam(f)]); per[t]+=1; ok+=1
        if ok%200==0: print(f'\r  train {ok}',end='')
csv.writer(open(OUT+'/labels.csv','w',newline='',encoding='utf-8')).writerows([['file','label','group_id']]+rows)
train_fams=set(r[2] for r in rows)
assert not (train_fams & gold_fams), 'LEAKAGE: train family ชนกับ holdout!'
print(f'\ntrain: {ok} รูป | ต่อทรง: {dict(sorted(per.items()))} | families {len(train_fams)} | '
      f'train∩holdout = ∅ ✅')

# ---------- adjudicated holdout ----------
grows=[]; gi=0
for f,g in gold.items():
    if not os.path.exists(os.path.join(SRC,f)): print('holdout หาย:',f[:30]); continue
    try: im=render(os.path.join(SRC,f))
    except Exception: continue
    nm=f'g{gi:02d}.png'; im.save(OUT+'/gold/'+nm); grows.append([nm,g,gsrc[f]]); gi+=1
csv.writer(open(OUT+'/gold_labels.csv','w',newline='',encoding='utf-8')).writerows([['file','label','source']]+grows)
bysrc=collections.Counter(r[2] for r in grows); bycls=collections.Counter(r[1] for r in grows)
print(f'holdout: {gi} รูป | source: {dict(bysrc)} | ต่อทรง: {dict(sorted(bycls.items()))}')
print(f'  ⚠️ holdout ครอบเพียง class {sorted(bycls)} (ไม่ใช่ 12-way) → ใช้เป็น per-case audit เท่านั้น')

# ---------- zip ----------
zp='bench/dieline_train.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(OUT+'/labels.csv','labels.csv'); z.write(OUT+'/gold_labels.csv','gold_labels.csv')
    for r in rows: z.write(OUT+'/img/'+r[0],'img/'+r[0])
    for r in grows: z.write(OUT+'/gold/'+r[0],'gold/'+r[0])
print(f'\n📦 {zp} ({os.path.getsize(zp)//1024//1024} MB) — อัปขึ้น Colab')
