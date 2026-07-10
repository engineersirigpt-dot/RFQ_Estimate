# risk queue ตาม GPT Round 11: ALERT / CHECKLIST / ROUTINE (2 action ไม่ใช่ 2 สี)
# ALERT = หลักฐานขัดแย้งเชิงบวก (CV≠Claude + CV มั่นใจ) | CHECKLIST = tuck/custom ที่ CV ไม่มั่นใจ | ROUTINE = อื่น
# วัด: queue_recall, alert_precision, false_comfort, display_rate + error concentration ordering
# ฟรี. python bench/risk_queue.py [purity_p=0.57] [margin_m=0.14]
import json, sys, math, collections, re, hashlib, os
TUCK={1,2,4,11}; WEAK={5,6,7,8,9,10}
P=float(sys.argv[1]) if len(sys.argv)>1 else 0.57      # purity threshold (~4/7)
Mg=float(sys.argv[2]) if len(sys.argv)>2 else 0.14     # margin threshold (top1-top2)/k

def wilson(k,n,z=1.96):
    if n==0: return (0.0,0.0)
    p=k/n; d=1+z*z/n; c=(p+z*z/(2*n))/d; h=(z*math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d
    return (max(0,c-h),min(1,c+h))

meta={}
rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())
def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b',f,re.I); return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I); b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b)
    return re.sub(r'\s+',' ',re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)).strip().lower()
# family group (กัน leakage)
parent={}
def find(x):
    parent.setdefault(x,x)
    while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
    return x
files=list(meta)
byF=collections.defaultdict(list); byJN=collections.defaultdict(list)
for f in files:
    if fcode(f): byF[fcode(f)].append(f)
    byJN[(meta[f][1],normbase(f))].append(f)
for g in list(byF.values())+list(byJN.values()):
    for x in g[1:]: parent[find(x)]=find(g[0])
def fam(f): return find(f)

p0=json.load(open('answer_key/p0_result.json',encoding='utf-8'))
emb={}
for l in open('answer_key/clip_emb.jsonl',encoding='utf-8'):
    l=l.strip()
    if l: o=json.loads(l); emb[o['f']]=o['v']
train=[(f,meta[f][0],fam(f),emb[f]) for f in files if f in emb and f not in {r['file'] for r in p0}]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def knn(v,fm,k=7):
    top=sorted(((dot(v,tv),tt) for tf,tt,tg,tv in train if tg!=fm),reverse=True)[:k]
    vt=collections.Counter(t for _,t in top); (t1,c1)=vt.most_common(1)[0]
    c2=vt.most_common(2)[1][1] if len(vt)>1 else 0
    return t1, c1/k, (c1-c2)/k

# === Round 12 verdict: 2-tier CHECKLIST/ROUTINE (ยุบ ALERT) ===
def classify(claude,cv,purity):
    tuck_or_custom = (claude in TUCK or cv in TUCK or claude==12 or cv==12)
    if tuck_or_custom and (claude!=cv or purity<P):    # tuck/custom ที่ขัด/CV ไม่มั่นใจ → inline focus cue
        return 'CHECKLIST'
    return 'ROUTINE'
# ALERT = research field only (log ไว้ วัด precision แยกเมื่อมี gold; ยังไม่ขึ้น UI)
def alert_reason(claude,cv,purity,margin):
    if claude!=cv and purity>=P and margin>=Mg: return 'high_purity_cv_disagreement'
    # structural_fact_contradiction / retrieval_prototype_contradiction → รอ signal ใหม่
    return 'none'
def axisof(g): return 'custom' if g==12 else ('tuck' if g in TUCK else ('weak' if g in WEAK else 'other'))

R=[]
for r in p0:
    v=emb.get(r['file'])
    if not v: continue
    cv,pur,mar=knn(v,fam(r['file']))
    R.append(dict(claude=r['claude'],cv=cv,gold=r['gold'],pur=pur,mar=mar,q=classify(r['claude'],cv,pur),
                  areason=alert_reason(r['claude'],cv,pur,mar),axis=axisof(r['gold']),wrong=r['claude']!=r['gold']))
n=len(R); err=[x for x in R if x['wrong']]
C=[x for x in R if x['q']=='CHECKLIST']; RO=[x for x in R if x['q']=='ROUTINE']
def line(k,d,lab):
    lo,hi=wilson(k,d); ev='' if d>=10 else ' ⚠️insuf'
    return f'  {lab:36s} {k}/{d}={100*k//d if d else 0:3d}% [CI {100*lo:.0f}-{100*hi:.0f}]{ev}'
print(f'=== risk queue 2-tier (Round 12 verdict, p={P}, group-safe proxy n={n}) ===')
print(f'  display: CHECKLIST {len(C)} ({100*len(C)//n}%) | ROUTINE {len(RO)} ({100*len(RO)//n}%)')
print('\n  metrics (ตาม GPT R12):')
print(line(len([x for x in err if x['q']=='CHECKLIST']),len(err),'queue_recall P(CHECKLIST|err)'))
print(line(len([x for x in RO if x['wrong']]),len(err),'routine_miss P(ROUTINE|err)'))
print('\n  🎯 error concentration (ต้อง CHECKLIST > ROUTINE):')
print(line(len([x for x in C if x['wrong']]),len(C),'P(err|CHECKLIST)'))
print(line(len([x for x in RO if x['wrong']]),len(RO),'P(err|ROUTINE)'))
print('\n  per-axis queue_recall (CHECKLIST|err):')
for ax in ['tuck','custom','weak','other']:
    ae=[x for x in err if x['axis']==ax]
    if ae: print(line(len([x for x in ae if x['q']=='CHECKLIST']),len(ae),ax))
print('\n  candidate_alert_reason (research field — ยังไม่ขึ้น UI):')
rc=collections.Counter(x['areason'] for x in R)
for k,v in rc.items():
    prec=[x for x in R if x['areason']==k]
    print(f'    {k:32s}: {v} ใบ | precision(err) {len([x for x in prec if x["wrong"]])}/{v}')
