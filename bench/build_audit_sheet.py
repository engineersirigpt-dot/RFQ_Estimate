# Stage-A audit sheet builder (ตาม GPT): deterministic stratified 60 Adobe + 60 BCSI
#   - เลือกด้วย sha256 ordering (ไม่มี RNG, reproducible 100%) ไม่ใช่ "24 ใบแรก"
#   - บันทึก stratum + selection_reason + selection_seed ทุกแถว
#   - render multi-page 3-view overlay (original/extracted-only/residual) ต่อไฟล์ที่เลือก
#   - แยก extraction audit จาก style audit (ยังไม่มี style_correct; ใช้ expert_box_type optional)
# python bench/build_audit_sheet.py
import csv, sys, os, collections, fitz
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import dieline_lib as dl

OUT='bench/ocg_pilot'; AUD=OUT+'/audit_stageA'; os.makedirs(AUD+'/overlay',exist_ok=True)
N_PER=60; SEED_TAG='stageA_v1_sha256order'   # เปลี่ยน tag = ชุดใหม่ (freeze ไว้)

def load(path):
    rows=[]
    with open(path,encoding='utf-8') as f:
        r=csv.DictReader(f,delimiter='\t')
        for d in r: rows.append(d)
    return rows
def hkey(d): return int(d['sha256'][:12],16)       # deterministic rank
def fnum(d,k):
    try: return float(d[k])
    except: return 0.0

def cov_band(d):
    c=fnum(d,'assigned_coverage_total')
    return 'lo' if c<0.30 else ('mid' if c<0.60 else 'hi')
def status(d):
    if d['extracted']=='1': return 'extracted'
    if fnum(d,'cut_len')>=dl.MIN_LEN or fnum(d,'crease_len')>=dl.MIN_LEN: return 'partial'
    return 'abstain'
def stratum(d):
    nup='nup' if int(float(d['n_up_guess']))>1 else 'single'
    mp='multi' if int(float(d['page_count']))>1 else 'onepg'
    oth='oc1' if d['other_structural']=='1' else 'oc0'
    return f'{nup}|{cov_band(d)}|{mp}|{oth}'
def threshold_near(d):
    for k in ('cov_cut','cov_crease'):
        c=fnum(d,k)
        if dl.MIN_COV<=c<=dl.MIN_COV*1.6: return True
    return fnum(d,'ambiguous_len')>0

def select(rows, n):
    # pool หลัก = extracted; แยก risk pool (threshold-near) + negative controls (partial)
    ext=[d for d in rows if status(d)=='extracted']
    partial=[d for d in rows if status(d)=='partial']
    picks=collections.OrderedDict()   # sha -> (row, reason)
    # 1) threshold-near จาก extracted (สูงสุด 10)
    for d in sorted([d for d in ext if threshold_near(d)],key=hkey)[:10]:
        picks[d['sha256']]=(d,'threshold_near')
    # 2) negative controls จาก partial (สูงสุด 8)
    for d in sorted(partial,key=hkey)[:8]:
        if d['sha256'] not in picks: picks[d['sha256']]=(d,'negative_control_partial')
    # 3) เติมให้ครบด้วย round-robin ข้าม strata (normal cases)
    by=collections.defaultdict(list)
    for d in sorted(ext,key=hkey): by[stratum(d)].append(d)
    order=sorted(by)   # strata เรียงชื่อคงที่
    idx={s:0 for s in order}
    while len(picks)<n:
        progressed=False
        for s in order:
            if len(picks)>=n: break
            while idx[s]<len(by[s]):
                d=by[s][idx[s]]; idx[s]+=1
                if d['sha256'] not in picks:
                    picks[d['sha256']]=(d,f'stratified:{s}'); progressed=True; break
        if not progressed: break
    return list(picks.values())

AUDIT_COLS=(['relative_path','sha256','producer_raw','profile','profile_version','stratum',
    'selection_seed','selection_reason','page_count','overlay',
    # machine evidence
    'candidate_status','cut_len','crease_len','cov_cut','cov_crease','dist_cut','dist_crease',
    'ambiguous_len','unassigned_len','other_structural','other_colors','component_count','n_up_guess',
    # reviewer (เว้นว่างให้คนกรอก; reviewed_at ให้ระบบเติม)
    'reviewer_id','reviewed_at','cut_clean','cut_complete','crease_clean','crease_complete',
    'other_structural_missing','complete_net','n_up_actual','component_count_actual',
    'audit_pass','failure_reason','notes',
    # style (optional — matcher ยังไม่ทำ)
    'expert_box_type','expert_is_custom','expert_style_confidence'])

def build(manifest, tag):
    rows=load(manifest)
    if not rows: print(f'  !! {manifest} ว่าง — ข้าม {tag}'); return []
    chosen=select(rows,N_PER)
    out=[]; ov=0
    for d,reason in chosen:
        p=d['relative_path']; ovname=''
        if os.path.exists(p):
            try:
                doc=fitz.open(p); ov+=1
                ovname=f'{tag}_{ov:02d}_{d["sha256"][:8]}.png'
                dl.render_views(doc,dl.extract_bcsi(doc) if tag=='bcsi' else dl.extract_adobe(doc),
                                f'{AUD}/overlay/{ovname}')
                doc.close()
            except Exception as e: ovname=f'(overlay fail:{str(e)[:20]})'
        out.append({'relative_path':p,'sha256':d['sha256'],'producer_raw':d['producer_raw'],
            'profile':d['profile'],'profile_version':d['profile'],'stratum':stratum(d),
            'selection_seed':SEED_TAG,'selection_reason':reason,'page_count':d['page_count'],
            'overlay':ovname,'candidate_status':status(d),'cut_len':d['cut_len'],
            'crease_len':d['crease_len'],'cov_cut':d['cov_cut'],'cov_crease':d['cov_crease'],
            'dist_cut':d['dist_cut'],'dist_crease':d['dist_crease'],'ambiguous_len':d['ambiguous_len'],
            'unassigned_len':d['unassigned_len'],'other_structural':d['other_structural'],
            'other_colors':d['other_colors'],'component_count':d['component_count'],
            'n_up_guess':d['n_up_guess']})
    print(f'  {tag}: เลือก {len(out)} | overlay {ov} | strata ที่ครอบ {len(set(stratum(d) for d,_ in chosen))}')
    return out

print(f'Stage-A audit sheet  seed={SEED_TAG}  N/pop={N_PER}')
allrows=[]
allrows+=build(OUT+'/adobe_extract.tsv','adobe')
allrows+=build(OUT+'/bcsi_extract.tsv','bcsi')

with open(AUD+'/audit_stageA.tsv','w',newline='',encoding='utf-8') as f:
    w=csv.DictWriter(f,fieldnames=AUDIT_COLS,delimiter='\t',extrasaction='ignore')
    w.writeheader()
    for r in allrows: w.writerow(r)
print(f'\nsheet -> {AUD}/audit_stageA.tsv  ({len(allrows)} แถว)')
print(f'overlay -> {AUD}/overlay/  (3 มุมมอง/หน้า: original | extracted-only | residual)')
print('reviewer กรอก: cut_clean/cut_complete/crease_*/other_structural_missing/complete_net/audit_pass/failure_reason')
print('หมายเหตุ: reviewed_at ให้ระบบเติม timestamp; style columns เว้นไว้จน matcher เสร็จ')
