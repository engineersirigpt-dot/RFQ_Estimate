# geometry จาก PDF ดีไลน์จริง — validate สัญญาณ "เส้นพับทแยง (crash-lock) = auto-bottom"
# กุญแจ: กรองเฉพาะ STROKE (ตัด artwork fill ทิ้ง) → เหลือเส้นก่อสร้างไดไลน์
# ทดสอบ: tuck(1) ควร crash-lock ~0 | auto-bottom(4) ควร >0
# python bench/geom_pdf.py
import fitz, math, os, re

def seglist(path):
    doc = fitz.open(path); page = doc[0]; segs = []
    for dr in page.get_drawings():
        if dr.get('type') == 'f':      # fill = artwork → ข้าม เอาเฉพาะเส้น stroke
            continue
        dsh = dr.get('dashes'); dashed = bool(dsh and dsh.strip('[] '))
        for it in dr['items']:
            if it[0] == 'l':
                p1,p2 = it[1],it[2]; segs.append((p1.x,p1.y,p2.x,p2.y,dashed))
            elif it[0] == 're':
                r=it[1]; segs += [(r.x0,r.y0,r.x1,r.y0,dashed),(r.x1,r.y0,r.x1,r.y1,dashed),(r.x1,r.y1,r.x0,r.y1,dashed),(r.x0,r.y1,r.x0,r.y0,dashed)]
            elif it[0] in ('c','qu'):
                p1=it[1]; p2=it[-1]
                try: segs.append((p1.x,p1.y,p2.x,p2.y,dashed))
                except Exception: pass
    doc.close(); return segs

def analyze(path):
    segs = seglist(path)
    if not segs: return None
    xs=[s[0] for s in segs]+[s[2] for s in segs]; ys=[s[1] for s in segs]+[s[3] for s in segs]
    diag=math.hypot(max(xs)-min(xs),max(ys)-min(ys)) or 1
    stroke=0; lock=0; lockDash=0
    for x1,y1,x2,y2,dashed in segs:
        L=math.hypot(x2-x1,y2-y1)
        if L < 0.03*diag: continue
        stroke+=1
        ang=abs(math.degrees(math.atan2(y2-y1,x2-x1)))
        if ang>90: ang=180-ang
        if 40<=ang<=50:               # crash-lock แคบ ~45°
            lock+=1
            if dashed: lockDash+=1
    return dict(stroke=stroke, lock=lock, lockDash=lockDash)

# auto-หา PDF ตัวอย่าง (ทรง 1/2/4 อย่างละ ≤8)
TESTS=[]; per={}
rex=re.compile(r'^(.+\.pdf),(\d{1,2}),', re.I)
for l in open('answer_key/answer_map.csv',encoding='utf-8').read().splitlines()[1:]:
    m=rex.match(l)
    if not m: continue
    t=int(m.group(2)); f=m.group(1).strip()
    if t not in (1,2,4): continue
    if per.get(t,0)>=8: continue
    if os.path.exists(os.path.join('test/uploads',f)) and '/LAY ' not in ' '+f and not f.upper().startswith('LAY '):
        TESTS.append((f,t)); per[t]=per.get(t,0)+1
TESTS.sort(key=lambda x:x[1])

print('ไฟล์ | เฉลย | เส้นก่อสร้าง | 🎯crash-lock(~45) | (ประ)')
print('-'*84)
byGold={}
for f,gold in TESTS:
    p=os.path.join('test/uploads',f)
    try: r=analyze(p)
    except Exception as e: print(f'  ERR {f[:28]}: {str(e)[:30]}'); continue
    if not r or r['stroke']==0: print(f'  {f[:30]:30s} g{gold} | raster/ว่าง'); continue
    byGold.setdefault(gold,[]).append(r['lock'])
    mark='← tuck?' if (gold in(1,2) and r['lock']<=1) or (gold==4 and r['lock']>=2) else ('⚠️' )
    print(f'  {f[:30]:30s} g{gold} | {r["stroke"]:3d} | {r["lock"]:2d} | ({r["lockDash"]:2d})  {mark}')
print('-'*84)
for g in sorted(byGold):
    v=byGold[g]; z=sum(1 for x in v if x<=1)
    print(f'  gold {g}: crash-lock เฉลี่ย {sum(v)/len(v):.1f} | "≤1 (=tuck-like)" {z}/{len(v)} ใบ | ค่า {v}')
