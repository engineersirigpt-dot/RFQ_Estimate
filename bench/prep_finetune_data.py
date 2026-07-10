# แพ็กข้อมูลสำหรับ fine-tune บน Colab — รูป balanced + labels.csv (group-aware) → zip
# แปลง PDF→PNG(384px), cap ต่อทรง, ใส่ group_id กัน leakage ตอน split
# python bench/prep_finetune_data.py [cap_per_class=200]
import os, re, sys, csv, io, zipfile, collections
import fitz                                  # PDF → image
try: from PIL import Image
except ImportError: os.system(sys.executable+' -m pip install pillow -q'); from PIL import Image

CAP=int(sys.argv[1]) if len(sys.argv)>1 else 200
SRC='test/uploads'; OUT='bench/finetune_data'; IMG=OUT+'/img'; PX=384
os.makedirs(IMG, exist_ok=True)

# non-dieline: ตัดชื่อไฟล์ที่ชัดว่าไม่ใช่ไดไลน์ (กันขยะเข้า training)
JUNK=re.compile(r'ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot',re.I)
meta={}; rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())
def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b',f,re.I); return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I); b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b)
    return re.sub(r'\s+',' ',re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)).strip().lower()
def group_id(f,jid): return ('job:'+jid) if jid else ('nm:'+normbase(f))

def render(path):
    if path.lower().endswith('.pdf'):
        doc=fitz.open(path); pg=doc[0]; pix=pg.get_pixmap(matrix=fitz.Matrix(2,2))
        im=Image.open(io.BytesIO(pix.tobytes('png'))); doc.close()
    else: im=Image.open(path)
    im=im.convert('RGB'); im.thumbnail((PX*2,PX*2))
    # pad เป็นสี่เหลี่ยม PX×PX (คงสัดส่วนไดไลน์)
    im.thumbnail((PX,PX)); bg=Image.new('RGB',(PX,PX),(255,255,255))
    bg.paste(im,((PX-im.width)//2,(PX-im.height)//2)); return bg

rows=[]; per=collections.Counter(); ok=0; skip=0
byT=collections.defaultdict(list)
for f,(t,j) in meta.items(): byT[t].append((f,j))
for t in sorted(byT):
    for f,j in byT[t]:
        if per[t]>=CAP: break
        if JUNK.search(f) or not os.path.exists(os.path.join(SRC,f)): skip+=1; continue
        try:
            im=render(os.path.join(SRC,f))
        except Exception: skip+=1; continue
        name=f'{ok:05d}.png'; im.save(os.path.join(IMG,name))
        rows.append([name,t,group_id(f,j)]); per[t]+=1; ok+=1
        if ok%100==0: print(f'\r  แปลงแล้ว {ok}',end='')

with open(OUT+'/labels.csv','w',newline='',encoding='utf-8') as fh:
    w=csv.writer(fh); w.writerow(['file','label','group_id']); w.writerows(rows)
print(f'\nรวม {ok} รูป (ข้าม {skip}) | ต่อทรง: {dict(sorted(per.items()))}')

# zip
zp='bench/dieline_train.zip'
with zipfile.ZipFile(zp,'w',zipfile.ZIP_DEFLATED) as z:
    z.write(OUT+'/labels.csv','labels.csv')
    for r in rows: z.write(os.path.join(IMG,r[0]),'img/'+r[0])
print(f'\n📦 {zp} ({os.path.getsize(zp)//1024//1024} MB) — อัปโหลดอันนี้ขึ้น Colab')
