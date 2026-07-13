# FN-mining: หา custom false-negatives (ไฟล์ proxy 1/2/3/4/11 ที่หน้าตาใกล้ custom) → labeling queue
# ตาม GPT Round 13-14: 4 bucket, unique-family, two-layer schema (standard/nonstandard/ambiguous/unobservable)
# ฟรี ใช้ CLIP emb ที่มี ไม่ยิง API. python bench/mine_fn_candidates.py
import json, re, collections, hashlib, os
import numpy as np

STD={1,2,3,4,11}                                  # tuck/seal pool ที่มักซ่อน custom false-negative
GOLD_CUSTOM={                                      # 3 gold custom (confirmed) เป็น anchor
 '060622_092147.jpg':'GENT',
 'ART_2PAGB000890_050422_101202.pdf':'NATUR',
 'LAY F007346 31012660 กล่องพิมพ์ GPO DICLOX (DICLOXACILIN) 250 MG.-1_160522_151313.pdf':'GPO'}
K=10; OUT='bench/label_queue'; os.makedirs(OUT,exist_ok=True)
random_seed=42                                    # reproducible (ไม่ใช้ Date/random แบบสุ่มจริง)

# ---------- meta: file -> (proxy, job) ----------
meta={}; rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=(int(m.group(2)),m.group(3).strip())

# ---------- family graph (fcode | job+normbase) ----------
def fcode(f):
    m=re.search(r'\bF0*(\d{4,6})\b',f,re.I); return 'F'+m.group(1) if m else ''
def normbase(f):
    b=re.sub(r'\.(pdf|jpe?g|png|webp)$','',f,flags=re.I)
    b=re.sub(r'[_\s-]*\d{6}[-_]\d{3,6}$','',b); b=re.sub(r'^\s*lay\s+|\blay\b|\brev\.?\s*\d+','',b,flags=re.I)
    return re.sub(r'\s+',' ',b).strip().lower()
parent={}
def find(x):
    parent.setdefault(x,x)
    while parent[x]!=x: parent[x]=parent[parent[x]]; x=parent[x]
    return x
def union(a,b): parent[find(a)]=find(b)

# ---------- CLIP emb ----------
files=[]; V=[]
for l in open('answer_key/clip_emb.jsonl',encoding='utf-8'):
    l=l.strip()
    if not l: continue
    o=json.loads(l); f=o['f']
    if f not in meta: continue                    # ต้องมี proxy label ด้วย
    files.append(f); V.append(o['v'])
X=np.asarray(V,dtype=np.float32)
X/=np.linalg.norm(X,axis=1,keepdims=True)+1e-9    # L2 normalize → dot = cosine
idx={f:i for i,f in enumerate(files)}
proxy=np.array([meta[f][0] for f in files])
for f in files: find(f)
byF=collections.defaultdict(list); byJN=collections.defaultdict(list)
for f in files:
    fc=fcode(f)
    if fc: byF[fc].append(f)
    byJN[(meta[f][1],normbase(f))].append(f)
for g in list(byF.values())+list(byJN.values()):
    for x in g[1:]: union(g[0],x)
def fam(f): return 'fam_'+hashlib.sha256(find(f).encode()).hexdigest()[:12]
famarr=np.array([fam(f) for f in files])
print(f'emb∩proxy: {len(files)} ไฟล์ | {len(set(famarr))} families | proxy custom(12)={int((proxy==12).sum())} std(1/2/3/4/11)={int(np.isin(proxy,list(STD)).sum())}')

# ---------- cosine sim matrix ----------
S=X@X.T                                            # (N,N) cosine
np.fill_diagonal(S,-2)

# ---------- kNN prediction (group-safe: ตัด neighbor family เดียวกัน) ----------
def knn_row(i):
    order=np.argsort(-S[i])
    picked=[]; seen=famarr[i]
    for j in order:
        if famarr[j]==seen: continue              # กัน near-dup family เดียวกัน vote
        picked.append(j)
        if len(picked)>=K: break
    labs=proxy[picked]
    vt=collections.Counter(labs.tolist()); pred,_=vt.most_common(1)[0]
    frac12=float((labs==12).mean())
    return pred, frac12
knn_pred=np.zeros(len(files),dtype=int); knn12=np.zeros(len(files))
for i in range(len(files)):
    knn_pred[i],knn12[i]=knn_row(i)

# ---------- gold-custom similarity ----------
anchors={name:idx[f] for f,name in GOLD_CUSTOM.items() if f in idx}
gsim={name:S[a] for name,a in anchors.items()}
max_gold=np.max(np.stack(list(gsim.values())),axis=0) if gsim else np.zeros(len(files))

# ---------- pick 1 representative/family (highest max_gold) ----------
def dedupe_family(cand_idx, score):
    best={}
    for i in cand_idx:
        fm=famarr[i]
        if fm not in best or score[i]>score[best[fm]]: best[fm]=i
    return sorted(best.values(), key=lambda i:-score[i])

rng=np.random.RandomState(random_seed)
std_mask=np.isin(proxy,list(STD))
gold_set=set(idx[f] for f in GOLD_CUSTOM if f in idx)

# bucket B2: nearest ของ 3 gold custom, proxy∈STD (common-mode FN)
b_nn=[i for i in dedupe_family(np.where(std_mask & (max_gold>0.75))[0], max_gold) if i not in gold_set][:60]
# bucket B1: proxy∈STD แต่ CLIP-kNN ทายเป็น 12 (model sees custom)
b_model=[i for i in dedupe_family(np.where(std_mask & (knn_pred==12))[0], knn12) if i not in gold_set]
b_model=[i for i in b_model if i not in set(b_nn)][:100]
# bucket B3: proxy 12 (consistency / false-positive ของนิยาม custom)
p12=dedupe_family(np.where(proxy==12)[0], max_gold); rng.shuffle(p12); b_p12=p12[:40]
# bucket B4: random proxy∈STD (unbiased miss-rate) — เลี่ยงซ้ำ bucket อื่น
used=set(b_nn)|set(b_model)|set(b_p12)|gold_set
stdfam=dedupe_family([i for i in np.where(std_mask)[0] if i not in used], max_gold)
rng.shuffle(stdfam); b_rand=stdfam[:40]

buckets=[('nn_gold',b_nn),('model_custom',b_model),('proxy12',b_p12),('random_std',b_rand)]
NAME={1:'RTE',2:'STE',3:'SnapLock',4:'AutoBottom',11:'SealEnd',12:'Custom'}
def why(i,b):
    if b=='nn_gold':      return f'ใกล้ gold custom (sim {max_gold[i]:.2f}) แต่ proxy={NAME.get(proxy[i],proxy[i])}'
    if b=='model_custom': return f'CLIP-kNN ทาย Custom ({knn12[i]:.0%} ของ {K} เพื่อนบ้าน=12) แต่ proxy={NAME.get(proxy[i],proxy[i])}'
    if b=='proxy12':      return 'proxy=Custom (ตรวจ false-positive/ความสม่ำเสมอนิยาม)'
    return f'random proxy={NAME.get(proxy[i],proxy[i])} (วัด miss-rate ไม่ bias)'

HDR=['file','family_group_id','bucket','proxy','proxy_name','knn_pred','knn12_frac','max_gold_sim','why_selected',
     'is_custom','custom_reasons','base_status','base_construction','base_candidates','evidence','reviewed_by']
rows=[]
for bname,bidx in buckets:
    for i in bidx:
        rows.append([files[i],famarr[i],bname,str(proxy[i]),NAME.get(proxy[i],str(proxy[i])),
                     str(knn_pred[i]),f'{knn12[i]:.2f}',f'{max_gold[i]:.3f}',why(i,bname),
                     '','','','','','',''])   # two-layer schema: ให้ expert เติม
# family-dedup ข้าม bucket (กันใบเดียวโผล่ 2 bucket)
seen=set(); final=[]
for r in rows:
    if r[1] in seen: continue
    seen.add(r[1]); final.append(r)

tsv=OUT+'/fn_candidates.tsv'
with open(tsv,'w',encoding='utf-8') as fh:
    fh.write('\t'.join(HDR)+'\n')
    for r in final: fh.write('\t'.join(r)+'\n')
bc=collections.Counter(r[2] for r in final)
print(f'\n📋 {tsv}: {len(final)} candidates (unique family) | ต่อ bucket: {dict(bc)}')
print('   two-layer schema ให้ expert เติม: is_custom(yes/no/unknown) · base_status(standard/nonstandard/ambiguous/unobservable)')
print('   → รันต่อ: node bench/make_label_sheet.js  (ออก Excel + รูป + dropdown)')
