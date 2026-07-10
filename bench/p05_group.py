# P0.5 — กัน data leakage: group-split ตาม job_id + re-measure risk-ranking แบบสะอาด
# ปัญหา: CV kNN "จำงานเดิม" ได้ ถ้า revision งานเดียวกันอยู่ทั้ง train และ test → ตัวเลขสูงเกินจริง
# ฟรี ไม่ยิง API. python bench/p05_group.py
import json, re, collections

TUCK={1,2,4,11}; WEAK={5,6,7,8,9,10}
TN={1:'Reverse Tuck',2:'Straight Tuck',3:'Snap Lock',4:'Auto Bottom',5:'Tray',6:'Frame-Vue',7:'Bento',8:'Gable',9:'Sleeve',10:'Pillow',11:'Seal End',12:'Custom'}

# file -> (template, job_id)  จาก answer_map (4 คอลัมน์: file,box,job_id,job_name)
meta={}
rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),', re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12:
        meta[m.group(1).strip()]=(int(m.group(2)), m.group(3).strip())

def jobkey(f):
    t=meta.get(f)
    if t and t[1]: return t[1]                     # job_id (ดีสุด)
    base=re.sub(r'_\d{6}[-_]\d{3,6}.*$','',f)      # fallback: ตัด _date_time ท้าย
    return re.sub(r'^LAY\s+','',base).strip().lower()

p0=json.load(open('answer_key/p0_result.json',encoding='utf-8'))
heldFiles={r['file'] for r in p0}
emb={}
for l in open('answer_key/clip_emb.jsonl',encoding='utf-8'):
    l=l.strip()
    if l:
        o=json.loads(l); emb[o['f']]=o['v']
train=[(f, meta[f][0], jobkey(f), emb[f]) for f in emb if f in meta and f not in heldFiles]
def dot(a,b): return sum(x*y for x,y in zip(a,b))

def knn(v, testjob, k=7, exclude_same_job=False):
    cand=[(dot(v,tv),tf,tt,tj) for tf,tt,tj,tv in train if not (exclude_same_job and tj==testjob)]
    top=sorted(cand,reverse=True)[:k]
    votes=collections.Counter(t for _,_,t,_ in top)
    top1,cnt=votes.most_common(1)[0]
    sameJob=sum(1 for _,_,_,tj in top if tj==testjob)   # นับ neighbor ที่งานเดียวกัน (=leakage)
    return top1, cnt, sameJob

# ---------- 1) วัด leakage ----------
leakTests=0; leakNeighTot=0
for r in p0:
    v=emb.get(r['file']);
    if not v: continue
    tj=jobkey(r['file'])
    _,_,sj=knn(v,tj,exclude_same_job=False)
    if sj>0: leakTests+=1; leakNeighTot+=sj
print('=== 1) Leakage ในชุดเทส '+str(len(p0))+' ใบ ===')
print(f'  test ที่มี neighbor "งานเดียวกัน" ใน top-7: {leakTests} ใบ (รวม {leakNeighTot} neighbor รั่ว)')
print(f'  → CV เคยเห็นงานนั้นแล้ว {leakTests}/{len(p0)} = {100*leakTests//len(p0)}% ของเทส')

# ---------- 2) risk logic (v2) ----------
def assess(claude,cv,pf):
    conflict=claude!=cv; cc,vc=claude==12,cv==12; tuck=claude in TUCK or cv in TUCK; weak=claude in WEAK or cv in WEAK
    if not conflict:
        if pf<0.5: return 'MED'
        if weak: return 'MED'
        return 'LOW'
    if cc!=vc: return 'HIGH' if pf>=0.5 else 'MED'
    if tuck: return 'HIGH' if pf>=0.7 else 'MED'
    return 'MED'

def measure(exclude):
    rows=[]
    for r in p0:
        v=emb.get(r['file'])
        if not v: continue
        tj=jobkey(r['file'])
        cv,cnt,_=knn(v,tj,exclude_same_job=exclude)
        lvl=assess(r['claude'],cv,cnt/7)
        rows.append((r['claude'],cv,r['gold'],lvl,r['claude']!=r['gold']))
    n=len(rows); cw=[x for x in rows if x[4]]; cr=[x for x in rows if not x[4]]
    catch=len([x for x in cw if x[3] in('HIGH','MED')])
    fc=[x for x in rows if x[0]==x[1] and x[4]]; fcLow=len([x for x in fc if x[3]=='LOW'])
    cvAcc=len([x for x in rows if x[1]==x[2]])
    p=lambda a,b: f'{100*a//b}%' if b else '-'
    return dict(n=n, catch=f'{catch}/{len(cw)}={p(catch,len(cw))}', cvAcc=f'{cvAcc}/{n}={p(cvAcc,n)}',
                fc=f'{fcLow}/{len(fc)}', low=len([x for x in cr if x[3]=='LOW']))

print('\n=== 2) เทียบ risk-ranking: มี leakage (เดิม) vs กัน leakage (สะอาด) ===')
a=measure(False); b=measure(True)
print(f'                        มี leakage   |  กัน leakage (จริง)')
print(f'  CV จับทรงถูก (solo) : {a["cvAcc"]:12s} | {b["cvAcc"]}')
print(f'  จับ Claude-error    : {a["catch"]:12s} | {b["catch"]}')
print(f'  false-comfort หลุดLOW: {a["fc"]:12s} | {b["fc"]}')
print(f'  ปล่อย LOW (ตัวถูก)  : {a["low"]:12d} | {b["low"]}')
