# BCSI PackDesign color extractor — full-scan -> rich lossless manifest (ตาม GPT fix-then-audit)
#   ใช้ bench/dieline_lib.py (profile bcsi_packdesign_2008_v1): color buckets + nearest-seed assignment
#   manifest: relative_path เต็ม + sha256 + file_size + page_count + inventory (unassigned/ambiguous/other)
#   ไม่ render overlay ที่นี่ (120 ใบ audit ทำที่ build_audit_sheet.py)
# python bench/bcsi_color_extract.py
import fitz, glob, csv, sys, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import dieline_lib as dl

SRC='test/uploads'; OUT='bench/ocg_pilot'
pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
print(f'profile={dl.PROFILE_BCSI} code={dl.code_version()}  TOL={dl.TOL} MARGIN={dl.MARGIN} '
      f'MIN_COV={dl.MIN_COV} AMBIG_MAX={dl.AMBIG_MAX_FRAC}')
print(f'seed cut={dl.SEED["cut"]} crease={dl.SEED["crease"]}\nสแกน PDF {len(pdfs)} หา BCSI...')

rows=[]; n=extract=partial=other_struct=multi=nup=0
for i,p in enumerate(pdfs):
    try: doc=fitz.open(p)
    except Exception: continue
    prod=dl.producer(doc)
    if not dl.is_bcsi(prod): doc.close(); continue
    n+=1
    res=dl.extract_bcsi(doc)
    rows.append(dl.manifest_row(p,prod,res))
    if res['extracted']: extract+=1
    elif res['cut_len']>=dl.MIN_LEN or res['crease_len']>=dl.MIN_LEN: partial+=1
    other_struct+=res['other_structural']; multi+=(res['page_count']>1); nup+=(res['n_up_guess']>1)
    doc.close()
    if n%200==0: print(f'\r  BCSI {n}',end='')

csv.writer(open(OUT+'/bcsi_extract.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows(
    [dl.MANIFEST_COLS]+[[str(c) for c in r] for r in rows])
print(f'\n\n=== BCSI color extract ({dl.PROFILE_BCSI}) — actual ===')
print(f'  BCSI PDF พบ                    : {n}')
print(f'  extracted (cut+crease + gates) : {extract}  ({100*extract//n if n else 0}%)')
print(f'  partial (role เดียว)           : {partial}')
print(f'  abstain                        : {n-extract-partial}')
print(f'  มี other_structural (สีอื่น)   : {other_struct}   | multi-page {multi} | n_up>1 (guess) {nup}')
print(f'manifest -> {OUT}/bcsi_extract.tsv  (lossless: path+sha256, +inventory columns)')
