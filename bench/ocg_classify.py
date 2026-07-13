# A: classifier ต้นแบบ — ป้อน cut/crease สะอาด (จาก OCG layer) เข้า geometry
# feature: crash-lock (cut ~45° = auto-bottom), panel grid (crease นอน/ตั้ง), window (cut loop ในแผง)
# เทียบ proxy บน subset ที่มี structural layer | python bench/ocg_classify.py
import fitz, os, glob, re, math, unicodedata, csv, collections

SRC='test/uploads'; OUT='bench/ocg_pilot'; SCAN_CAP=1500; MAX=60
def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); return re.sub(r'[\s_\-/.]+',' ',s).strip()
STRUCT=re.compile(r'\b(crease|fold|score|cut|dicut|die ?cut|thru|knife|kiss|die ?line|dieline|die|cutting)\b')
def is_struct(raw): return bool(STRUCT.search(norm(raw)))
def is_dashed(pth):
    d=pth.get('dashes')
    return bool(d) and any(float(x)>0 for x in re.findall(r'[\d.]+',str(d)))

# proxy label
meta={}; rex=re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),',re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if m and 1<=int(m.group(2))<=12: meta[m.group(1).strip()]=int(m.group(2))

def segs_of(pth):
    out=[]
    for it in pth.get('items',[]):
        pf=[]
        for e in it[1:]:
            if hasattr(e,'x'): pf.append((e.x,e.y))
            elif isinstance(e,(tuple,list)) and len(e)>=2 and isinstance(e[0],(int,float)): pf.append((e[0],e[1]))
        for a,b in zip(pf,pf[1:]): out.append((a[0],a[1],b[0],b[1]))
    return out

def analyze(doc):
    cut=[]; crease=[]
    for pi in range(min(2,doc.page_count)):
        try: draws=doc[pi].get_cdrawings()
        except Exception: continue
        for pth in draws:
            if not is_struct(pth.get('layer') or ''): continue
            (crease if is_dashed(pth) else cut).extend(segs_of(pth))
    alls=cut+crease
    if not alls: return None
    xs=[s[0] for s in alls]+[s[2] for s in alls]; ys=[s[1] for s in alls]+[s[3] for s in alls]
    diag=math.hypot(max(xs)-min(xs),max(ys)-min(ys)) or 1
    def ang(s):
        a=abs(math.degrees(math.atan2(s[3]-s[1],s[2]-s[0]))); return 180-a if a>90 else a
    def L(s): return math.hypot(s[2]-s[0],s[3]-s[1])
    longcut=[s for s in cut if L(s)>0.02*diag]
    crash=[s for s in longcut if 38<=ang(s)<=52]                 # crash-lock ~45° = auto-bottom
    ch=[s for s in crease if L(s)>0.05*diag and ang(s)<12]       # crease นอน
    cv=[s for s in crease if L(s)>0.05*diag and ang(s)>78]       # crease ตั้ง
    return dict(cut=len(longcut),crash=len(crash),crease_h=len(ch),crease_v=len(cv),
                crash_ratio=round(len(crash)/max(1,len(longcut)),3))

def guess(f):
    # rule ต้นแบบ: crash-lock เยอะ = auto-bottom(4); ไม่มี crash + มี panel grid = tuck(1/2)
    if f['crash']>=4 and f['crash_ratio']>0.03: return 4
    return 12 if f['crease_h']+f['crease_v']<2 else 1   # ไม่มี crease grid ชัด → เดา custom, มี → tuck

pdfs=[f for f in glob.glob(SRC+'/*') if f.lower().endswith('.pdf')]
rows=[]; done=0
for i,p in enumerate(pdfs):
    if done>=MAX or i>=SCAN_CAP: break
    try: doc=fitz.open(p)
    except Exception: continue
    f=analyze(doc); doc.close()
    if not f: continue
    done+=1; base=os.path.basename(p); px=meta.get(base,'?'); g=guess(f)
    rows.append([base[:34],px,g,f['crash'],f['crash_ratio'],f['crease_h'],f['crease_v'],f['cut']])

HDR=['file','proxy','geo_guess','crash','crash_ratio','crease_h','crease_v','n_cut']
csv.writer(open(OUT+'/classify.tsv','w',newline='',encoding='utf-8'),delimiter='\t').writerows([HDR]+[[str(c) for c in r] for r in rows])
print(f'วิเคราะห์ {done} ไฟล์ (มี structural layer)\n')
print('%-34s proxy geo crash ratio cH cV'%'file')
for r in rows:
    mark='✓' if str(r[1])==str(r[2]) else ('?' if r[1]=='?' else '✗')
    print('%-34s  %-4s %-3s %-5d %-5s %-3d %-3d %s'%(r[0],r[1],r[2],r[3],r[4],r[5],r[6],mark))
# สรุปเฉพาะ crash-lock signal (auto-bottom detection)
haveproxy=[r for r in rows if r[1]!='?']
crash_pos=[r for r in rows if r[3]>=4 and float(r[4])>0.03]
print(f'\ncrash-lock ตรวจพบ (auto-bottom signal): {len(crash_pos)}/{done} ไฟล์')
print(f'  proxy ของ crash-positive: {collections.Counter(r[1] for r in crash_pos)}')
