# Full-scan 6,107: วัด usable rate จริง (มี structural layer / แยก cut+crease ได้) แยกตาม producer
# metadata-only ไม่ render (เร็ว) | python bench/ocg_full_scan.py
import fitz, os, glob, re, csv, unicodedata, collections

SRC='test/uploads'; OUT='bench/ocg_pilot'
def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); return re.sub(r'[\s_\-/.]+',' ',s).strip()
STRUCT=re.compile(r'\b(crease|fold|score|cut|dicut|die ?cut|thru|knife|kiss|die ?line|dieline|die|cutting)\b')
def is_struct(raw): return bool(STRUCT.search(norm(raw)))
def is_dashed(pth):
    d=pth.get('dashes')
    if not d: return False
    return any(float(x)>0 for x in re.findall(r'[\d.]+',str(d)))
def pbucket(prod):
    pl=norm(prod)
    if 'packdesign' in pl or 'bcsi' in pl: return 'bcsi_packdesign'
    if 'adobe' in pl: return 'adobe'
    if 'cairo' in pl: return 'cairo'
    if 'print to pdf' in pl or 'pdfcreator' in pl: return 'office_print'
    return 'other'

allf=[f for f in glob.glob(SRC+'/*') if os.path.isfile(f)]
pdfs=[f for f in allf if f.lower().endswith('.pdf')]
raster=[f for f in allf if f.lower().endswith(('.jpg','.jpeg','.png','.webp'))]
print(f'ไฟล์ทั้งหมด {len(allf)} | PDF {len(pdfs)} | raster {len(raster)}')

rows=[]; by=collections.defaultdict(lambda:[0,0,0])   # bucket -> [total, struct, separable]
tot_struct=tot_sep=tot_fail=0
for i,p in enumerate(pdfs):
    try: doc=fitz.open(p)
    except Exception: tot_fail+=1; rows.append([os.path.basename(p)[:40],'open_fail','','','']); continue
    prod=((doc.metadata or {}).get('producer') or (doc.metadata or {}).get('creator') or '?')
    pc=pbucket(prod)
    struct=solid=dashed=False; layers=set()
    for pi in range(min(2,doc.page_count)):
        try: draws=doc[pi].get_cdrawings()
        except Exception: continue
        for pth in draws:
            ln=pth.get('layer') or ''
            if is_struct(ln):
                struct=True; layers.add(ln)
                if is_dashed(pth): dashed=True
                else: solid=True
    doc.close()
    sep=solid and dashed
    by[pc][0]+=1; by[pc][1]+=struct; by[pc][2]+=sep
    tot_struct+=struct; tot_sep+=sep
    rows.append([os.path.basename(p)[:40],pc,'Y' if struct else '','Y' if sep else '',len(layers)])
    if (i+1)%500==0: print(f'\r  {i+1}/{len(pdfs)}',end='')

csv.writer(open(OUT+'/full_scan.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [['file','producer_bucket','has_struct_layer','separable_cut_crease','n_struct_layers']]+rows)

N=len(allf); P=len(pdfs)
print(f'\n\n=== usable rate (จากทั้งหมด {N} ไฟล์) ===')
print(f'  PDF มี structural layer : {tot_struct}/{P} PDF = {100*tot_struct//P}% ของ PDF = {100*tot_struct//N}% ของทั้งหมด')
print(f'  แยก cut+crease ได้ (T1)  : {tot_sep}/{P} PDF = {100*tot_sep//P}% ของ PDF = {100*tot_sep//N}% ของทั้งหมด')
print(f'  raster (fallback human)  : {len(raster)}/{N} = {100*len(raster)//N}%')
print(f'  PDF เปิดไม่ได้           : {tot_fail}')
print(f'\n=== แยกตาม producer (total / มี struct / แยก cut-crease) ===')
for b,(t,s,sp) in sorted(by.items(),key=lambda x:-x[1][0]):
    print(f'  {b:18s} {t:5d} / {s:5d} ({100*s//t if t else 0:3d}%) / {sp:5d} ({100*sp//t if t else 0:3d}%)')
print(f'\nmanifest → {OUT}/full_scan.tsv')
