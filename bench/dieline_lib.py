# dieline_lib — core สำหรับ extractor สองโปรไฟล์ + audit (ตาม GPT fix-then-audit)
#   ให้ Adobe(OCG layer) กับ BCSI(stroke color) คืน result โครงสร้างเดียวกัน
#   คำที่ถูกต้อง: "color buckets + nearest-seed assignment" (ไม่ใช่ true clustering)
import fitz, os, re, math, hashlib, unicodedata, subprocess, collections

# ---- profiles (versioned config เดียว ไม่กระจาย logic) ----
PROFILE_BCSI ='bcsi_packdesign_2008_v1'
PROFILE_ADOBE='adobe_ocg_v1'
SEED={'cut':(0.931,0.122,0.141), 'crease':(0.369,0.396,0.683)}   # seed จาก corpus จริง (centroid)
TOL=0.22          # ระยะ RGB สูงสุดที่ยังใกล้ seed (seeds ห่าง 0.83 -> margin ในตัว)
MARGIN=0.12       # ต้องใกล้ seed ที่ assign มากกว่าอีก seed อย่างน้อยเท่านี้
MIN_COV=0.03      # coverage (สัดส่วน length) ขั้นต่ำต่อ role
MIN_LEN=50.0      # ความยาว stroke ขั้นต่ำต่อ role (pt) กันเส้นเศษ
AMBIG_MAX_FRAC=0.15   # extracted=False ถ้า ambiguous_len > สัดส่วนนี้ของ assigned
CHROMA_NEUTRAL=0.12   # chroma ต่ำกว่านี้ = near-gray/black (dimension/hatching/text) ไม่ใช่ spot สี

STRUCT=re.compile(r'\b(crease|fold|score|cut|dicut|die ?cut|thru|knife|kiss|die ?line|dieline|die|cutting)\b')
CREASE_LN=re.compile(r'\b(crease|fold|score)\b')

def code_version():
    try:
        h=subprocess.check_output(['git','rev-parse','--short','HEAD'],
            cwd=os.path.dirname(os.path.abspath(__file__)),text=True,stderr=subprocess.DEVNULL).strip()
        return h or 'nogit'
    except Exception: return 'nogit'

def sha256(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for c in iter(lambda:f.read(1<<16),b''): h.update(c)
    return h.hexdigest()

def file_meta(path):
    st=os.stat(path)
    return dict(relative_path=path.replace('\\','/'), sha256=sha256(path), file_size=st.st_size)

def norm(s):
    s=unicodedata.normalize('NFKC',s or '').lower(); return re.sub(r'[\s_\-/.]+',' ',s).strip()
def is_bcsi(prod): pl=norm(prod); return 'packdesign' in pl or 'bcsi' in pl
def is_adobe(prod): return 'adobe' in norm(prod)
def is_struct_layer(raw): return bool(STRUCT.search(norm(raw)))
def is_crease_layer(raw): return bool(CREASE_LN.search(norm(raw)))
def is_dashed(pth):
    d=pth.get('dashes')
    if not d: return False
    return any(float(x)>0 for x in re.findall(r'[\d.]+',str(d)))
def producer(doc): return ((doc.metadata or {}).get('producer') or (doc.metadata or {}).get('creator') or '?')

def dist(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))
def chroma(col): return max(col)-min(col)
def is_neutral(col): return chroma(col)<CHROMA_NEUTRAL

def seed_role(col):
    # -> (role|None, dist_to_role, status)  status in assigned/ambiguous/none
    dc=dist(col,SEED['cut']); dk=dist(col,SEED['crease'])
    r,dr = min((('cut',dc),('crease',dk)),key=lambda z:z[1])
    other = dk if r=='cut' else dc
    if dr<=TOL and (other-dr)>=MARGIN: return r,dr,'assigned'
    if dr<=TOL:                        return r,dr,'ambiguous'
    return None,min(dc,dk),'none'

def _pts(it):
    out=[]
    for e in it[1:]:
        if hasattr(e,'x'): out.append((e.x,e.y))
        elif isinstance(e,(tuple,list)) and len(e)>=2 and isinstance(e[0],(int,float)): out.append((e[0],e[1]))
        elif hasattr(e,'__len__') and len(e)==4 and hasattr(e[0],'x'):
            for q in e: out.append((q.x,q.y))
    return out
def path_polys(pth): return [_pts(it) for it in pth.get('items',[])]
def poly_len(P): return sum(math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]) for i in range(len(P)-1))
def path_len(pth): return sum(poly_len(P) for P in path_polys(pth))
def path_segs(pth):
    out=[]
    for P in path_polys(pth):
        for i in range(len(P)-1): out.append((P[i][0],P[i][1],P[i+1][0],P[i+1][1]))
    return out

def n_up_components(cut_segs, page_diag, snap=1.5):
    # union-find บน endpoint ที่ snap แล้ว -> นับ component ใหญ่ (bbox diag > 15% หน้า) = n_up guess
    parent={}
    def find(x):
        parent.setdefault(x,x)
        root=x
        while parent[root]!=root: root=parent[root]
        while parent[x]!=root: parent[x],x=root,parent[x]
        return root
    def union(a,b): parent[find(a)]=find(b)
    def key(x,y): return (round(x/snap),round(y/snap))
    for x1,y1,x2,y2 in cut_segs: union(key(x1,y1),key(x2,y2))
    comp=collections.defaultdict(list)
    for x1,y1,x2,y2 in cut_segs: comp[find(key(x1,y1))]+=[(x1,y1),(x2,y2)]
    big=0
    for pl in comp.values():
        xs=[p[0] for p in pl]; ys=[p[1] for p in pl]
        if math.hypot(max(xs)-min(xs),max(ys)-min(ys))>0.15*page_diag: big+=1
    return max(big,1 if cut_segs else 0), len(comp)

def _finalize(profile, page_roles, other_buckets, ambiguous_len, best_dist, doc):
    # page_roles: {pno: {'cut':[pth], 'crease':[pth], 'residual':[pth]}}
    cut_len=crease_len=0.0; cut_segs_all=[]; all_len=0.0
    for pno,d in page_roles.items():
        for pth in d.get('cut',[]):    cut_len+=path_len(pth);   cut_segs_all+=path_segs(pth)
        for pth in d.get('crease',[]): crease_len+=path_len(pth)
        for pth in d.get('residual',[]): all_len+=path_len(pth)
    all_len+=cut_len+crease_len
    total=all_len or 1.0
    # inventory ของสีที่ไม่ถูก assign (แยก neutral vs chromatic)
    neutral_len=sum(L for col,L in other_buckets.items() if is_neutral(col))
    chromatic=[(col,L) for col,L in other_buckets.items() if not is_neutral(col)]
    unassigned_len=sum(L for _,L in chromatic)
    other_structural = unassigned_len>=MIN_LEN and unassigned_len/total>=0.02
    p0=doc[0]; pd=math.hypot(p0.rect.width,p0.rect.height) or 1
    n_up,comp = n_up_components(cut_segs_all, pd)
    assigned=cut_len+crease_len
    extracted = (cut_len>=MIN_LEN and crease_len>=MIN_LEN
                 and cut_len/total>=MIN_COV and crease_len/total>=MIN_COV
                 and (assigned==0 or ambiguous_len<=AMBIG_MAX_FRAC*assigned))
    return dict(profile=profile, page_count=doc.page_count,
        cut_len=round(cut_len), crease_len=round(crease_len), total_stroke_len=round(total),
        cov_cut=round(cut_len/total,3), cov_crease=round(crease_len/total,3),
        assigned_coverage_total=round(assigned/total,3),
        dist_cut=round(best_dist['cut'],3), dist_crease=round(best_dist['crease'],3),
        ambiguous_len=round(ambiguous_len), unassigned_len=round(unassigned_len),
        neutral_len=round(neutral_len), other_structural=int(other_structural),
        other_colors=';'.join('%s:%d'%(tuple(round(x,2) for x in c),round(L))
                              for c,L in sorted(chromatic,key=lambda z:-z[1])[:6]),
        n_up_guess=n_up, component_count=comp, extracted=int(extracted),
        _page_roles=page_roles)

def extract_bcsi(doc):
    page_roles={}; other=collections.defaultdict(float); ambig=0.0
    best={'cut':9.9,'crease':9.9}
    for pno,page in enumerate(doc):
        try: draws=page.get_cdrawings()
        except Exception: continue
        roles={'cut':[],'crease':[],'residual':[]}
        for pth in draws:
            if 's' not in (pth.get('type') or ''): continue
            c=pth.get('color')
            if c is None or len(c)<3: continue
            col=tuple(round(x,3) for x in c[:3]); L=path_len(pth)
            r,dr,status=seed_role(col)
            if status=='assigned':
                roles[r].append(pth); best[r]=min(best[r],dr)
            elif status=='ambiguous':
                ambig+=L; roles['residual'].append(pth)
            else:
                other[col]+=L; roles['residual'].append(pth)
        if roles['cut'] or roles['crease'] or roles['residual']: page_roles[pno]=roles
    return _finalize(PROFILE_BCSI, page_roles, other, ambig, best, doc)

def extract_adobe(doc):
    # cut = struct-layer solid, crease = struct-layer dashed (หรือชื่อ layer บอก crease)
    page_roles={}; other=collections.defaultdict(float); ambig=0.0
    for pno,page in enumerate(doc):
        try: draws=page.get_cdrawings()
        except Exception: continue
        roles={'cut':[],'crease':[],'residual':[]}
        for pth in draws:
            if 's' not in (pth.get('type') or 'f'):
                if not pth.get('items'): continue
            ln=pth.get('layer') or ''
            if is_struct_layer(ln):
                if is_dashed(pth) or is_crease_layer(ln): roles['crease'].append(pth)
                else: roles['cut'].append(pth)
            else:
                c=pth.get('color')
                if c and len(c)>=3: other[tuple(round(x,3) for x in c[:3])]+=path_len(pth)
                roles['residual'].append(pth)
        if roles['cut'] or roles['crease'] or roles['residual']: page_roles[pno]=roles
    return _finalize(PROFILE_ADOBE, page_roles, other, ambig, {'cut':0.0,'crease':0.0}, doc)

MANIFEST_COLS=['relative_path','sha256','file_size','producer_raw','profile','profile_version',
    'code_version','page_count','cut_len','crease_len','total_stroke_len','cov_cut','cov_crease',
    'assigned_coverage_total','dist_cut','dist_crease','ambiguous_len','unassigned_len','neutral_len',
    'other_structural','other_colors','n_up_guess','component_count','extracted']

def manifest_row(path, prod, res):
    m=file_meta(path)
    return [m['relative_path'],m['sha256'],m['file_size'],str(prod)[:60],res['profile'],
        res['profile'], code_version(),
        res['page_count'],res['cut_len'],res['crease_len'],res['total_stroke_len'],
        res['cov_cut'],res['cov_crease'],res['assigned_coverage_total'],res['dist_cut'],
        res['dist_crease'],res['ambiguous_len'],res['unassigned_len'],res['neutral_len'],
        res['other_structural'],res['other_colors'],res['n_up_guess'],res['component_count'],
        res['extracted']]

# ---- overlay: หลายหน้า, 3 มุมมองต่อหน้า (original / extracted-only / residual) ----
def render_views(doc, res, out_png, zoom=2.0):
    from PIL import Image, ImageDraw
    COL={'cut':(220,20,20),'crease':(20,60,220)}
    pages=[pno for pno,d in res['_page_roles'].items() if d['cut'] or d['crease']] or [0]
    panels=[]
    for pno in pages:
        page=doc[pno]; pix=page.get_pixmap(matrix=fitz.Matrix(zoom,zoom))
        base=Image.frombytes('RGB',(pix.width,pix.height),pix.samples).convert('RGB')
        W,H=base.size; roles=res['_page_roles'].get(pno,{'cut':[],'crease':[],'residual':[]})
        orig=Image.blend(base,Image.new('RGB',(W,H),(255,255,255)),0.55)
        ext=Image.new('RGB',(W,H),(255,255,255)); de=ImageDraw.Draw(ext)
        rez=Image.new('RGB',(W,H),(255,255,255)); dz=ImageDraw.Draw(rez)
        for role in ('cut','crease'):
            for pth in roles[role]:
                for P in path_polys(pth):
                    Q=[(x*zoom,y*zoom) for x,y in P]
                    if len(Q)>=2: de.line(Q,fill=COL[role],width=2)
        for pth in roles['residual']:
            for P in path_polys(pth):
                Q=[(x*zoom,y*zoom) for x,y in P]
                if len(Q)>=2: dz.line(Q,fill=(150,150,150),width=1)
        row=Image.new('RGB',(W*3+20,H),(235,235,235))
        row.paste(orig,(0,0)); row.paste(ext,(W+10,0)); row.paste(rez,(W*2+20,0))
        panels.append(row)
    Wt=max(p.width for p in panels); Ht=sum(p.height for p in panels)+10*(len(panels)-1)
    combo=Image.new('RGB',(Wt,Ht),(255,255,255)); y=0
    for p in panels: combo.paste(p,(0,y)); y+=p.height+10
    scale=min(1.0, 2200/Wt)
    if scale<1.0: combo=combo.resize((int(Wt*scale),int(Ht*scale)))
    combo.save(out_png,quality=80)
    return pages
