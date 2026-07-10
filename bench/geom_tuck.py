# prototype v2: แยก tuck(1/2) vs auto-bottom(4) ด้วย geometry
# fix: เส้นพับ auto-bottom เป็นเส้นประ → dilate เชื่อมเส้นประ + maxLineGap สูง ก่อน Hough
# ฟรี ไม่ใช้ API. python bench/geom_tuck.py
import cv2, numpy as np, math, os, glob

def load(path):
    try: return cv2.imdecode(np.fromfile(path, dtype=np.uint8), cv2.IMREAD_COLOR)
    except Exception: return None

def analyze(path):
    img = load(path)
    if img is None: return None
    h, w = img.shape[:2]
    scale = 1400 / max(h, w)
    if scale < 1: img = cv2.resize(img, (int(w*scale), int(h*scale)))
    h, w = img.shape[:2]; diag = math.hypot(h, w)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 40, 120)
    minlen = 0.13 * diag  # เฉพาะเส้นยาวมาก = โครงไดไลน์ (ตัด artwork/ข้อความสั้น)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=90, minLineLength=minlen, maxLineGap=25)
    total=0; diagN=0; diagLen=0.0; angs=[]
    # แยกครึ่งล่าง (auto-lock อยู่ก้น = มักครึ่งล่างของภาพ) — นับทแยงเฉพาะครึ่งล่างด้วย
    diagBottom=0
    if lines is not None:
        for l in lines:
            v = np.asarray(l).flatten(); x1,y1,x2,y2 = map(float, v[:4])
            length = math.hypot(x2-x1, y2-y1)
            ang = abs(math.degrees(math.atan2(y2-y1, x2-x1)))
            if ang > 90: ang = 180-ang
            total += 1
            if 18 <= ang <= 72:  # ทแยง
                diagN += 1; diagLen += length; angs.append(round(ang))
                if (y1+y2)/2 > h*0.5: diagBottom += 1
    return dict(total=total, diagN=diagN, diagBottom=diagBottom, diagLen=round(diagLen), ratio=round(diagLen/diag,2), angs=sorted(angs)[:10])

TESTS = [
    ('test/messageImage_1783407667263.jpg', 1, 'tuck Happy Jim'),
    ('test/รูปBloss triple collagen_240522_152326.jpg', 1, 'tuck Bloss'),
    ('test/GENT.jpg', 12, 'custom GENT'),
    ('test/D3D.jpg', 12, 'custom D3D'),
]
# เพิ่ม auto-bottom(4) + tuck(1) จากเฉลยจริงหลายใบ
for f in sorted(glob.glob('router/labeled_dielines/4/*.jpg'))[:5]: TESTS.append((f, 4, 'AUTO-BOTTOM(4)'))
for f in sorted(glob.glob('router/labeled_dielines/1/*.jpg'))[:4]: TESTS.append((f, 1, 'tuck(1)'))

print('ชนิด | เฉลย | เส้นรวม | ทแยง | ทแยงครึ่งล่าง | ratio | มุม')
print('-'*90)
byGold={}
for path, gold, kind in TESTS:
    if not os.path.exists(path): continue
    r = analyze(path)
    if not r: print(f'  อ่านไม่ได้: {os.path.basename(path)[:40]}'); continue
    byGold.setdefault(gold, []).append(r['diagBottom'])
    print(f'  {kind:16s} g{gold:2d} | {r["total"]:3d} | {r["diagN"]:2d} | ล่าง {r["diagBottom"]:2d} | {r["ratio"]:4} | {r["angs"][:6]}')
print('-'*90)
for g in sorted(byGold):
    v=byGold[g]; print(f'  เฉลี่ย "ทแยงครึ่งล่าง" ของ gold {g}: {sum(v)/len(v):.1f} (n={len(v)})')
