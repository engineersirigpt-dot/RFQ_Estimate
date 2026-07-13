# Full-scan usable-rate scan (ฉบับซื่อสัตย์ ตาม GPT review)
#   แก้ 3 จุดที่เคยโม้: (1) T1 -> structural_candidate (แค่มี solid+dashed ในเลเยอร์ชื่อโครงสร้าง
#   ยังไม่ verify topology/ครบ/แมตช์ทรง)  (2) อ่านทุกหน้า ไม่ใช่ 2 หน้าแรก  (3) รายงาน tier
#   unsupported/other (xls/docx/mp4...) แยก ไม่ให้หายจาก denominator
# metadata-only ไม่ render (เร็ว) | python bench/ocg_full_scan.py
import fitz, os, glob, re, csv, unicodedata, collections

SRC='test/uploads'; OUT='bench/ocg_pilot'
RASTER_EXT=('.jpg','.jpeg','.png')          # gif ถือเป็น other (อาจ animated)
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
def ext(f): return os.path.splitext(f)[1].lower()
pdfs   =[f for f in allf if ext(f)=='.pdf']
raster =[f for f in allf if ext(f) in RASTER_EXT]
other  =[f for f in allf if ext(f) not in ('.pdf',)+RASTER_EXT]   # 613: xls/docx/mp4/gif...
ext_ct=collections.Counter(ext(f) for f in other)
print(f'ไฟล์ทั้งหมด {len(allf)} = PDF {len(pdfs)} + raster {len(raster)} + other/unsupported {len(other)}')
print(f'  other ประกอบด้วย: {dict(ext_ct.most_common())}')

rows=[]; by=collections.defaultdict(lambda:[0,0,0])   # bucket -> [total, struct_layer, structural_candidate]
tot_struct=tot_cand=tot_fail=0
for i,p in enumerate(pdfs):
    try: doc=fitz.open(p)
    except Exception: tot_fail+=1; rows.append([os.path.basename(p)[:40],'open_fail','','','']); continue
    prod=((doc.metadata or {}).get('producer') or (doc.metadata or {}).get('creator') or '?')
    pc=pbucket(prod)
    struct=solid=dashed=False; layers=set()
    for page in doc:                                  # อ่านทุกหน้า (เดิมอ่านแค่ 2 หน้าแรก)
        try: draws=page.get_cdrawings()
        except Exception: continue
        for pth in draws:
            ln=pth.get('layer') or ''
            if is_struct(ln):
                struct=True; layers.add(ln)
                if is_dashed(pth): dashed=True
                else: solid=True
    doc.close()
    cand=solid and dashed          # structural_candidate: มีทั้งเส้นทึบ+ประในเลเยอร์โครงสร้าง (ยังไม่ verify)
    by[pc][0]+=1; by[pc][1]+=struct; by[pc][2]+=cand
    tot_struct+=struct; tot_cand+=cand
    rows.append([os.path.basename(p)[:40],pc,'Y' if struct else '','Y' if cand else '',len(layers)])
    if (i+1)%500==0: print(f'\r  {i+1}/{len(pdfs)}',end='')

csv.writer(open(OUT+'/full_scan.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [['file','producer_bucket','has_struct_layer','structural_candidate','n_struct_layers']]+rows)

N=len(allf); P=len(pdfs)
print(f'\n\n=== tier ของทั้ง corpus {N} ไฟล์ ===')
print(f'  PDF                              : {P}  ({100*P//N}%)')
print(f'    - มี structural OCG layer      : {tot_struct}  ({100*tot_struct//P}% ของ PDF)')
print(f'    - structural_candidate (OCG)   : {tot_cand}  ({100*tot_cand//P}% ของ PDF)   << ยังไม่ใช่ usable_T1')
print(f'    - PDF เปิดไม่ได้               : {tot_fail}')
print(f'  raster (jpg/png) -> human pick   : {len(raster)}  ({100*len(raster)//N}%)')
print(f'  other/unsupported (xls/doc/mp4)  : {len(other)}  ({100*len(other)//N}%)')
print(f'\n  หมายเหตุ: structural_candidate = มี solid+dashed ในเลเยอร์ชื่อโครงสร้างเท่านั้น')
print(f'           ยังไม่ได้ verify: parse ครบ / topology valid / unique template match / scale')
print(f'           BCSI 1,855 = 0 ที่นี่ (ไม่ใช้ OCG) -> วัดจริงที่ bench/bcsi_color_extract.py')
print(f'\n=== แยกตาม producer (total / มี struct OCG / structural_candidate) ===')
for b,(t,s,c) in sorted(by.items(),key=lambda x:-x[1][0]):
    print(f'  {b:18s} {t:5d} / {s:5d} ({100*s//t if t else 0:3d}%) / {c:5d} ({100*c//t if t else 0:3d}%)')
print(f'\nmanifest -> {OUT}/full_scan.tsv')
