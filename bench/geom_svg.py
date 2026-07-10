# parse SVG dieline → วัดมุมเส้นตรงๆ จากพิกัด vector (สะอาด ไม่มี artwork/noise)
# สมมติฐาน: auto-bottom(4/8) มีเส้น "ทแยง" (crash-lock), tuck(1/2) มีแต่เส้นนอน/ตั้ง
# python bench/geom_svg.py
import re, glob, math, os

def parse_paths(svg):
    out = []  # (x1,y1,x2,y2, color, dashed)
    for m in re.finditer(r'<path\b([^>]*)/?>', svg):
        attrs = m.group(1)
        dm = re.search(r'\bd="([^"]+)"', attrs)
        if not dm: continue
        color = (re.search(r'stroke="([^"]+)"', attrs) or [None,'?'])[1]
        dashed = 'stroke-dasharray' in attrs
        d = dm.group(1)
        # tokenize commands + numbers
        toks = re.findall(r'[MLHVmlhvZz]|-?\d*\.?\d+', d)
        cx=cy=0.0; i=0; started=False; sx=sy=0
        while i < len(toks):
            t = toks[i]
            if t in 'Mm':
                cx=float(toks[i+1]); cy=float(toks[i+2]); i+=3; started=True; sx,sy=cx,cy
            elif t in 'Ll':
                nx=float(toks[i+1]); ny=float(toks[i+2]); i+=3
                out.append((cx,cy,nx,ny,color,dashed)); cx,cy=nx,ny
            elif t in 'Hh':
                nx=float(toks[i+1]); i+=2
                out.append((cx,cy,nx,cy,color,dashed)); cx=nx
            elif t in 'Vv':
                ny=float(toks[i+1]); i+=2
                out.append((cx,cy,cx,ny,color,dashed)); cy=ny
            elif t in 'Zz':
                out.append((cx,cy,sx,sy,color,dashed)); i+=1
            else:
                # implicit lineto (number pair after M)
                if i+1 < len(toks) and re.match(r'-?\d', toks[i]) and re.match(r'-?\d', toks[i+1]):
                    nx=float(toks[i]); ny=float(toks[i+1]); i+=2
                    out.append((cx,cy,nx,ny,color,dashed)); cx,cy=nx,ny
                else: i+=1
    return out

def analyze(path):
    svg = open(path, encoding='utf-8').read()
    segs = parse_paths(svg)
    if not segs: return None
    # ขนาดรวมเพื่อ normalize ความยาว
    xs=[s[0] for s in segs]+[s[2] for s in segs]; ys=[s[1] for s in segs]+[s[3] for s in segs]
    diag = math.hypot(max(xs)-min(xs), max(ys)-min(ys)) or 1
    total=0; crashlock=0; shallow=0; steep=0
    for x1,y1,x2,y2,color,dashed in segs:
        L = math.hypot(x2-x1,y2-y1)
        if L < 0.04*diag: continue  # เอาเฉพาะเส้นโครงยาวพอ
        total+=1
        ang = abs(math.degrees(math.atan2(y2-y1,x2-x1)))
        if ang>90: ang=180-ang
        if 35<=ang<=55: crashlock+=1      # ลายเซ็น crash-lock / auto-lock (~45°)
        elif 15<=ang<35: shallow+=1       # เอียงตื้น (pillow/tray)
        elif 55<ang<=80: steep+=1         # เอียงชัน (ฝาเสียบ tuck)
    return dict(total=total, crashlock=crashlock, shallow=shallow, steep=steep)

def verdict(r):
    if r['crashlock']>=3: return 'AUTO-LOCK signature (4/8)'
    if r['crashlock']==0 and r['shallow']==0: return 'ฝาเสียบ/กล่องตรง (1/2/9/11)'
    if r['shallow']>=6: return 'เอียงตื้น (pillow 10)'
    return 'ก้ำกึ่ง'

print('SVG (เฉลย) | เส้นโครง | 🎯crash-lock(~45) | เอียงตื้น | เอียงชัน | อ่านได้ว่า')
print('-'*92)
for f in sorted(glob.glob('Diline_svg/*.svg')):
    r = analyze(f)
    name = os.path.basename(f).replace('.svg','')
    if not r: print(f'  {name[:30]:30s} | parse ไม่ได้'); continue
    print(f'  {name[:30]:30s} | {r["total"]:3d} | {r["crashlock"]:2d} | {r["shallow"]:2d} | {r["steep"]:2d} | {verdict(r)}')
