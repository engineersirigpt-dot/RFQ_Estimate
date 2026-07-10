# คัด gold candidate batch 2 (สำหรับ validation set สะอาด) — กรอง non-dieline + ตัดชุดเดิม
# เน้น tuck(1/2/4/11) + custom(12) + เรนเดอร์ให้ GPT อ่านได้ (1200px)
# python bench/select_gold2.py
import os, re, io, csv, collections
import fitz
from PIL import Image

SRC='test/uploads'; OUT='bench/gold/img2'; os.makedirs(OUT, exist_ok=True); PX=1200
JUNK=re.compile(r'ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|estimate',re.I)
# ไฟล์ที่เคยอยู่ batch 1 (ตัดออก)
prev=set()
if os.path.exists('answer_key/gold_candidates.tsv'):
    for l in open('answer_key/gold_candidates.tsv',encoding='utf-8').read().splitlines()[1:]:
        prev.add(l.split('\t')[1])

meta=collections.defaultdict(list)
rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if not m: continue
    f=m.group(1).strip(); t=int(m.group(2))
    if 1<=t<=12 and f not in prev and not JUNK.search(f) and os.path.exists(os.path.join(SRC,f)):
        meta[t].append(f)

# stratified: tuck 1/2/4/11 อย่างละ 4, custom 12 = 5, 3/9 = อย่างละ 2 | prefer PDF
TARGET={1:4,2:4,4:4,11:4,12:5,3:2,9:2}
def key(f): return (0 if f.lower().endswith('.pdf') else 1, f)   # PDF ก่อน
picked=[]
for t,n in TARGET.items():
    for f in sorted(meta.get(t,[]), key=key)[:n]: picked.append((f,t))

def render(path):
    if path.lower().endswith('.pdf'):
        d=fitz.open(path); pix=d[0].get_pixmap(matrix=fitz.Matrix(3,3)); im=Image.open(io.BytesIO(pix.tobytes('png'))); d.close()
    else: im=Image.open(path)
    im=im.convert('RGB'); im.thumbnail((PX,PX)); return im

rows=[]; i=0
for f,t in picked:
    try: im=render(os.path.join(SRC,f))
    except Exception: continue
    i+=1; im.save(f'{OUT}/{i:02d}.png'); rows.append([i,f,t])
with open('answer_key/gold_candidates2.tsv','w',newline='',encoding='utf-8') as fh:
    w=csv.writer(fh,delimiter='\t'); w.writerow(['num','file','proxy_gold']); w.writerows(rows)
print(f'คัด+เรนเดอร์ {i} ใบ → {OUT}/ (01-{i:02d}.png)')
print('ต่อทรง(proxy):', collections.Counter(r[2] for r in rows))
print('เฉลย(proxy)เก็บ → answer_key/gold_candidates2.tsv (ไม่ส่ง GPT)')
