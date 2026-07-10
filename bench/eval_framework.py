# Evaluation framework v2 — implement ตาม GPT review (Round 10)
# เพิ่มจาก v1: family-group แบบ connected-components(f_code/sha256/job) + per-axis recall
#   + Wilson 95% CI + n<10=insufficient + coverage + immutable run artifacts + gate ของ GPT
# ฟรี ไม่ยิง API. python bench/eval_framework.py
import json, re, math, hashlib, collections, os

TUCK={1,2,4,11}; WEAK={5,6,7,8,9,10}
RUN='bench/results/run_p05_v2'; os.makedirs(RUN, exist_ok=True)

def wilson(k,n,z=1.96):
    if n==0: return (0.0,0.0)
    p=k/n; d=1+z*z/n
    c=(p+z*z/(2*n))/d; h=(z*math.sqrt(p*(1-p)/n+z*z/(4*n*n)))/d
    return (max(0,c-h),min(1,c+h))

# ---------- meta: file -> (proxy, job_id) ----------
meta={}
rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())

def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b', f, re.I)      # F-code เดียวกัน = die เดียวกัน (ข้าม job ได้)
    return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I)
    b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b); b=re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)
    return re.sub(r'\s+',' ',b).strip().lower()
def sha(f):
    p='test/uploads/'+f
    if not os.path.exists(p): return ''
    h=hashlib.sha256()
    with open(p,'rb') as fh:
        for ch in iter(lambda:fh.read(65536),b''): h.update(ch)
    return h.hexdigest()[:16]

# ---------- family-group: connected components ----------
# edges: same f_code | same sha256 | (same job_id & same normbase)
files=[f for f in meta]
parent={}
def find(x):
    parent.setdefault(x,x)
    while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
    return x
def union(a,b): parent[find(a)]=find(b)
for f in files: find(f)
byF=collections.defaultdict(list); byJobNorm=collections.defaultdict(list)
shacache={}
for f in files:
    fc=fcode(f)
    if fc: byF[fc].append(f)
    byJobNorm[(meta[f][1],normbase(f))].append(f)
for g in list(byF.values())+list(byJobNorm.values()):
    for x in g[1:]: union(g[0],x)
def fam(f): return 'fam_'+hashlib.sha256(find(f).encode()).hexdigest()[:12]

# ---------- p0 + embeddings ----------
p0=json.load(open('answer_key/p0_result.json',encoding='utf-8'))
emb={}
for l in open('answer_key/clip_emb.jsonl',encoding='utf-8'):
    l=l.strip()
    if l: o=json.loads(l); emb[o['f']]=o['v']
def axisof(g):
    if g==12: return 'custom'
    if g in TUCK: return 'tuck'
    if g in WEAK: return 'weak'
    return 'other'
def stratum(c,v,g):
    if (c==12)!=(v==12): return 'custom_conflict'
    if (c in TUCK or v in TUCK) and c!=v and g in {1,2,4,11}: return 'tuck_conflict'
    if c==v and g in {1,2,4,11}: return 'tuck_agree'
    if g in WEAK or c in WEAK or v in WEAK: return 'weak_rare'
    return 'other'

# ---------- (1) manifest (schema ตาม GPT) ----------
hdr=['sample_id','file','file_type','asset_sha256','job_id','f_code','family_group_id','group_basis',
     'proxy_label','proxy_label_source','expert_gold','expert_gold_reason','review_status',
     'reviewed_by','reviewed_at','stratum','axis','claude','cv']
rows_m=[','.join(hdr)]
for r in p0:
    f=r['file']; pl,jid=meta.get(f,(r['gold'],'')); s=sha(f); fc=fcode(f)
    basis='+'.join([b for b in [('f_code' if fc else''),('sha' if s else''),'job+name'] if b])
    row=[s or f[:16], f, ('pdf' if f.lower().endswith('.pdf') else 'img'), s, jid, fc, fam(f), basis,
         str(pl),'production','','','unreviewed','','',stratum(r['claude'],r['cv'],r['gold']),
         axisof(r['gold']),str(r['claude']),str(r['cv'])]
    rows_m.append(','.join('"'+c+'"' if ','in c else c for c in row))
open('answer_key/evaluation_manifest.csv','w',encoding='utf-8').write('\n'.join(rows_m))

# ---------- (2) group-split contract: family-disjoint + assert ----------
fams=sorted(set(fam(f) for f in files))
test_f=set(fams[i] for i in range(0,len(fams),5))
cross=sum(1 for fm in set(fam(f) for f in files) if len({('test' if fam(x) in test_f else 'train') for x in [z for z in files if fam(z)==fm]})>1)

# ---------- (3+4) metrics group-safe kNN + Wilson + per-axis ----------
train=[(f,meta[f][0],fam(f),emb[f]) for f in files if f in emb and f not in {r['file'] for r in p0}]
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def knn(v,fm,k=7):
    top=sorted(((dot(v,tv),tt) for tf,tt,tg,tv in train if tg!=fm),reverse=True)[:k]
    vt=collections.Counter(t for _,t in top); t1,c=vt.most_common(1)[0]; return t1,c/k
def assess(c,v,pf):
    if c==v: return 'MED' if (pf<0.5 or c in WEAK or v in WEAK) else 'LOW'
    if (c==12)!=(v==12): return 'HIGH' if pf>=0.5 else 'MED'
    if c in TUCK or v in TUCK: return 'HIGH' if pf>=0.7 else 'MED'
    return 'MED'
R=[]
for r in p0:
    v=emb.get(r['file']);
    if not v: continue
    cv,pf=knn(v,fam(r['file']))
    R.append(dict(claude=r['claude'],cv=cv,gold=r['gold'],risk=assess(r['claude'],cv,pf),axis=axisof(r['gold']),wrong=r['claude']!=r['gold']))

def rate(num,den,label):
    lo,hi=wilson(num,den)
    ev='' if den>=10 else '  ⚠️insufficient(n<10)'
    return f'{label:26s} {num}/{den} = {100*num//den if den else 0:3d}%  [95%CI {100*lo:.0f}-{100*hi:.0f}]{ev}'

n=len(R); wrong=[x for x in R if x['wrong']]; HI=[x for x in R if x['risk']=='HIGH']; LO=[x for x in R if x['risk']=='LOW']
print(f'=== eval_framework v2 (group-safe, proxy label, n={n}) ===')
print('(2) family-split:', len(fams),'families,',len(test_f),'→ test | cross-family =',cross,'✅' if cross==0 else '❌')
print('\n(4) Metrics + Wilson 95% CI:')
print('  '+rate(len([x for x in wrong if x['risk']in('HIGH','MED')]),len(wrong),'error-escalation recall'))
print('  '+rate(len([x for x in wrong if x['risk']=='HIGH']),len(wrong),'HIGH recall'))
print('  '+rate(len([x for x in HI if x['wrong']]),len(HI),'HIGH precision'))
print('  '+rate(len([x for x in LO if x['wrong']]),len(wrong),'false-comfort (err→LOW)'))
print('  '+rate(len([x for x in LO if not x['wrong']]),len(LO),'LOW trust'))
print('  '+rate(n,n,'coverage'))
print('\n  per-axis escalation recall (gnั error):')
for ax in ['tuck','custom','weak','other']:
    aw=[x for x in wrong if x['axis']==ax]
    if aw: print('    '+rate(len([x for x in aw if x['risk']in('HIGH','MED')]),len(aw),ax))

# confusion (Claude vs gold) เฉพาะ tuck
print('\n  confusion Claude×gold (tuck-family):')
for g in sorted({x['gold'] for x in R if x['gold'] in TUCK}):
    cs=collections.Counter(x['claude'] for x in R if x['gold']==g)
    print(f'    gold {g}: '+', '.join(f'→{k}×{v}' for k,v in sorted(cs.items())))

print('\n=== gate (ตาม GPT) ===')
print('  SHADOW: manifest+group-disjoint+versioned report รันได้ + ≥15 adjudicated gold (8 tuck-conflict/4 agree/3 custom) + ไม่มี gold-error หลุด LOW')
print('  UI(HIGH): ≥75 gold families (30 known error,40 tuck/custom) + recall≥90%(CI lower≥75%) + HIGH-prec≥50% + 0 LOW error ใน≥30 + actionability≥80% + coverage≥99%')
print('  ตอนนี้ = exploratory proxy (n=37) → ยังไม่ผ่าน UI gate (ต้อง adjudicated gold)')

json.dump({'n':n,'families':len(fams),'cross':cross,'note':'proxy exploratory, not UI-eligible'}, open(RUN+'/metrics.json','w'), indent=1)
print(f'\nartifacts → {RUN}/  | manifest → answer_key/evaluation_manifest.csv')
