# คัด candidate สำหรับ gold set แบบ stratified (จาก p0_result ที่มี Claude+CV+proxy แล้ว)
# GPT จะตี blind (เห็นแต่รูป) → เราเก็บ gold/stratum ไว้ตรวจ
# python bench/select_gold.py
import json, collections, os

TUCK={1,2,4,11}; WEAK={5,6,7,8,9,10}
p0=json.load(open('answer_key/p0_result.json',encoding='utf-8'))

def stratum(r):
    c,v,g=r['claude'],r['cv'],r['gold']
    if (c==12)!=(v==12): return 'custom_conflict'
    if (c in TUCK or v in TUCK) and c!=v and g in {1,2,4,11}: return 'tuck_conflict'
    if c==v and g in {1,2,4,11}: return 'tuck_agree'
    if g in WEAK or c in WEAK or v in WEAK: return 'weak_rare'
    return 'other'

buckets=collections.defaultdict(list)
for r in p0: buckets[stratum(r)].append(r)

TARGET={'tuck_conflict':6,'tuck_agree':4,'custom_conflict':5,'weak_rare':3,'other':2}
picked=[]
for strat,n in TARGET.items():
    for r in buckets.get(strat,[])[:n]:
        picked.append({**r, 'stratum':strat})

# บันทึกไฟล์อ้างอิง (มีเฉลย — สำหรับเราตรวจ ห้ามส่ง GPT)
with open('answer_key/gold_candidates.tsv','w',encoding='utf-8') as f:
    f.write('num\tfile\tstratum\tproxy_gold\tclaude\tcv\n')
    for i,r in enumerate(picked,1):
        f.write(f"{i}\t{r['file']}\t{r['stratum']}\t{r['gold']}\t{r['claude']}\t{r['cv']}\n")

# รายชื่อไฟล์ที่ต้องอัปให้ GPT (แค่ num + file, ไม่มีเฉลย)
print(f'คัดได้ {len(picked)} ใบ:')
c=collections.Counter(p['stratum'] for p in picked)
for k,v in c.items(): print(f'  {k}: {v} ใบ')
print('\n=== รายการไฟล์ให้อัปโหลดให้ GPT (ตามลำดับ) ===')
for i,r in enumerate(picked,1):
    ext = 'PDF' if r['file'].lower().endswith('.pdf') else 'รูป'
    exists = '✓' if os.path.exists('test/uploads/'+r['file']) else '✗หาไม่เจอ'
    print(f"  #{i:2d} [{ext}] {exists} {r['file'][:55]}")
print('\nบันทึก → answer_key/gold_candidates.tsv (มีเฉลย — เก็บไว้ตรวจ ห้ามส่ง GPT)')
