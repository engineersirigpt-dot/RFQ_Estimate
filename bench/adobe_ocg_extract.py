# Adobe OCG extractor — full-scan -> rich lossless manifest (คู่กับ bcsi)
#   profile adobe_ocg_v1: cut = struct-layer solid, crease = struct-layer dashed/ชื่อ crease
#   ยังเป็น structural_candidate (ยังไม่ verify topology) — audit จะยืนยัน
# python bench/adobe_ocg_extract.py
import fitz, glob, csv, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import dieline_lib as dl

SRC='test/uploads'; OUT='bench/ocg_pilot'
pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
print(f'profile={dl.PROFILE_ADOBE} code={dl.code_version()}\nสแกน PDF {len(pdfs)} หา Adobe ที่มี structural layer...')

rows=[]; n_adobe=cand=extract=multi=nup=0
for i,p in enumerate(pdfs):
    try: doc=fitz.open(p)
    except Exception: continue
    prod=dl.producer(doc)
    if not dl.is_adobe(prod): doc.close(); continue
    n_adobe+=1
    res=dl.extract_adobe(doc)
    if res['cut_len']<dl.MIN_LEN and res['crease_len']<dl.MIN_LEN: doc.close(); continue  # ไม่มี struct layer
    cand+=1
    rows.append(dl.manifest_row(p,prod,res))
    if res['extracted']: extract+=1
    multi+=(res['page_count']>1); nup+=(res['n_up_guess']>1)
    doc.close()
    if n_adobe%300==0: print(f'\r  Adobe {n_adobe}',end='')

csv.writer(open(OUT+'/adobe_extract.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [dl.MANIFEST_COLS]+[[str(c) for c in r] for r in rows])
print(f'\n\n=== Adobe OCG extract ({dl.PROFILE_ADOBE}) ===')
print(f'  Adobe PDF                      : {n_adobe}')
print(f'  structural candidate (cut/crease) : {cand}')
print(f'  extracted (ทั้ง cut+crease + gates) : {extract}')
print(f'  multi-page {multi} | n_up>1 (guess) {nup}')
print(f'manifest -> {OUT}/adobe_extract.tsv')
