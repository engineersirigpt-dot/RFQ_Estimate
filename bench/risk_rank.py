# prototype: risk-ranking layer (Claude + CV + neighbor purity) → risk_level/axis/focus
# ตาม spec ที่ Claude+GPT ตกลง: ไม่ตัดสินแทน แค่จัดลำดับความเสี่ยงในธง uncertain เดิม
# ฟรี ไม่ยิง API — ใช้ p0_result.json (Claude+CV ที่บันทึกไว้) + clip_emb.jsonl
# python bench/risk_rank.py
import json, re, math, os, collections

TUCK = {1, 2, 4, 11}          # ตระกูลฝาเสียบ/ก้น (สับกันบ่อย ราคาพลาดแรง)
WEAK = {5, 6, 7, 8, 9, 10}    # คลาสอ่อน/หายาก (calibration ต่ำ)
TN = {1:'Reverse Tuck',2:'Straight Tuck',3:'Snap Lock',4:'Auto Bottom',5:'Tray',6:'Frame-Vue',7:'Bento',8:'Gable',9:'Sleeve',10:'Pillow',11:'Seal End',12:'Custom'}

# ---------- โหลด embeddings เพื่อคำนวณ neighbor purity + nearest examples ----------
lbl = {}
pat = re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),', re.I)
for line in open('answer_key/answer_map.csv', encoding='utf-8').read().splitlines()[1:]:
    m = pat.match(line)
    if m and 1 <= int(m.group(2)) <= 12: lbl[m.group(1).strip()] = int(m.group(2))

p0 = json.load(open('answer_key/p0_result.json', encoding='utf-8'))
heldFiles = {r['file'] for r in p0}

emb = {}
for line in open('answer_key/clip_emb.jsonl', encoding='utf-8'):
    line = line.strip()
    if not line: continue
    o = json.loads(line); emb[o['f']] = o['v']
train = [(f, lbl[f], emb[f]) for f in emb if f in lbl and f not in heldFiles]

def dot(a, b): return sum(x*y for x, y in zip(a, b))
def knn(v, k=7):
    sims = sorted(((dot(v, tv), tf, tt) for tf, tt, tv in train), reverse=True)[:k]
    votes = collections.Counter(t for _, _, t in sims)
    top1, cnt = votes.most_common(1)[0]
    neighbors = [tf for _, tf, tt in sims if tt == top1][:3]
    return top1, cnt, k, neighbors

# ---------- risk logic (v2: ใช้ neighbor purity คุม false-comfort + เกรด severity) ----------
def assess(claude, cv, purity_frac):
    conflict = claude != cv
    claude_custom, cv_custom = claude == 12, cv == 12
    tuck_involved = claude in TUCK or cv in TUCK
    weak = claude in WEAK or cv in WEAK
    # --- เห็นตรงกัน (agree) ---
    if not conflict:
        if purity_frac < 0.5:   # เห็นตรงแต่ CV ไม่มั่นใจ → กัน false-comfort (เช่น 12,12 purity 2/7)
            return 'MEDIUM', 'low_conf_agree', f'AI 2 รุ่นเห็นตรงว่า {TN.get(claude,"?")} แต่ความมั่นใจต่ำ (คล้ายหลายทรง) — ตรวจทรงเพิ่ม'
        if weak:                # เห็นตรงในคลาสอ่อน → ยังไม่ fast-track
            return 'MEDIUM', 'weak_class', f'ทรง {TN.get(claude,"?")} เป็นกลุ่มที่ระบบยังไม่มั่นใจ — ตรวจทรงเพิ่ม'
        return 'LOW', 'none', f'AI 2 รุ่นเห็นตรงกันว่า {TN.get(claude,"?")} (มั่นใจ) — ตรวจตามปกติ'
    # --- เห็นต่าง (conflict) ---
    if claude_custom != cv_custom:
        lvl = 'HIGH' if purity_frac >= 0.5 else 'MEDIUM'
        return lvl, 'custom', 'AI เห็นต่างเรื่อง "กล่องพิเศษ (Custom)" — Custom พลาดกระทบ open size/UPS/กระดาษแรง ตรวจก่อนใช้ราคา'
    if tuck_involved:
        lvl = 'HIGH' if purity_frac >= 0.7 else 'MEDIUM'
        return lvl, 'tuck_family', f'AI เลือก {TN.get(claude,"?")} แต่รุ่นเทียบเห็นคล้าย {TN.get(cv,"?")} — ตรวจ"ก้นกล่อง"ว่ามีเส้นทแยง auto-bottom จริงหรือเป็นฝาเสียบธรรมดา'
    if weak:
        return 'MEDIUM', 'weak_class', f'ทรง {TN.get(claude,"?")}/{TN.get(cv,"?")} เป็นกลุ่มที่ระบบยังไม่มั่นใจ — ตรวจทรงเพิ่ม'
    return 'MEDIUM', 'other', f'AI 2 รุ่นเห็นต่าง ({TN.get(claude,"?")} vs {TN.get(cv,"?")}) — ตรวจทรงเพิ่ม'

# ---------- รัน + validate ----------
rows = []
for r in p0:
    v = emb.get(r['file'])
    if not v: continue
    top1, cnt, k, neigh = knn(v)
    purity = cnt / k
    cv = top1  # ใช้ kNN สด(เท่ากับ p0 cv โดยประมาณ)
    lvl, axis, focus = assess(r['claude'], cv, purity)
    correct = r['claude'] == r['gold']
    rows.append(dict(file=r['file'], gold=r['gold'], claude=r['claude'], cv=cv,
                     purity=f'{cnt}/{k}', level=lvl, axis=axis, focus=focus,
                     neighbors=neigh, claudeWrong=not correct))

order = {'HIGH':0,'MEDIUM':1,'LOW':2}
rows.sort(key=lambda x: order[x['level']])
print('=== risk queue (เรียงเสี่ยงมาก→น้อย) ===')
print('ระดับ | axis | เฉลย | Claude | CV | purity | Claudeผิด?')
for x in rows:
    print(f"  {x['level']:6s}|{x['axis']:12s}| g{x['gold']:2d} | {x['claude']:2d} | {x['cv']:2d} | {x['purity']:4s} | {'✗ผิด' if x['claudeWrong'] else 'ถูก'}")

# ---------- ตัวชี้วัดคุณค่า: HIGH/MED จับ Claude-error ได้ไหม + ไม่ over-flag ตัวถูก ----------
n = len(rows)
cw = [x for x in rows if x['claudeWrong']]
cr = [x for x in rows if not x['claudeWrong']]
flagged = lambda X: [x for x in X if x['level'] in ('HIGH','MEDIUM')]
pct = lambda a,b: f'{100*a/b:.0f}%' if b else '-'
print('\n=== คุณค่า risk-ranking (บน '+str(n)+' รูป) ===')
print(f'  Claude ผิด {len(cw)} ใบ → ถูก flag (HIGH/MED) {len(flagged(cw))} = {pct(len(flagged(cw)),len(cw))}   ← จับ error (สูง=ดี)')
print(f'  Claude ถูก {len(cr)} ใบ → ปล่อย LOW {len([x for x in cr if x["level"]=="LOW"])} = {pct(len([x for x in cr if x["level"]=="LOW"]),len(cr))}   ← ไม่กวนตัวถูก (สูง=ดี)')
print(f'  HIGH ทั้งหมด {len([x for x in rows if x["level"]=="HIGH"])} ใบ | ใน HIGH เป็น Claude-ผิด {pct(len([x for x in rows if x["level"]=="HIGH" and x["claudeWrong"]]),max(len([x for x in rows if x["level"]=="HIGH"]),1))}')
# false-comfort: เห็นตรงกัน (claude==cv) แต่ Claude ผิด — v2 ควรดันออกจาก LOW
fc = [x for x in rows if x['claude']==x['cv'] and x['claudeWrong']]
fcLow = [x for x in fc if x['level']=='LOW']
print(f'  false-comfort (เห็นตรงแต่ผิด) {len(fc)} ใบ → ยังหลุด LOW {len(fcLow)} = {pct(len(fcLow),len(fc))}  (ต่ำ=ดี)')
json.dump(rows, open('answer_key/risk_rank_result.json','w',encoding='utf-8'), ensure_ascii=False, indent=1)
print('\nบันทึก → answer_key/risk_rank_result.json (มี focus_message + neighbors ครบ)')
