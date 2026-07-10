# เทรน classifier head (Logistic Regression) บน CLIP embeddings — เทียบกับ kNN
# ฟรี รันในเครื่อง: อ่าน answer_key/clip_emb.jsonl + answer_map.csv + heldout_map.tsv
# python bench/train_clip_head.py
import json, csv, re, sys
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.neighbors import KNeighborsClassifier

TN = {1:'Reverse Tuck',2:'Straight Tuck',3:'Snap Lock',4:'Auto Bottom',5:'Tray',6:'Frame-Vue',7:'Bento',8:'Gable',9:'Sleeve',10:'Pillow',11:'Seal End',12:'Custom'}

# label ต่อไฟล์ (จาก answer_map)
lbl = {}
pat = re.compile(r'^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),', re.I)
for line in open('answer_key/answer_map.csv', encoding='utf-8').read().splitlines()[1:]:
    m = pat.match(line)
    if m:
        t = int(m.group(2))
        if 1 <= t <= 12: lbl[m.group(1).strip()] = t

# held-out
held = set()
for line in open('answer_key/heldout_map.tsv', encoding='utf-8').read().splitlines():
    if '\t' in line: held.add(line.rsplit('\t',1)[0])

# embeddings
Xtr, ytr, Xte, yte = [], [], [], []
for line in open('answer_key/clip_emb.jsonl', encoding='utf-8'):
    line = line.strip()
    if not line: continue
    o = json.loads(line)
    f, v = o['f'], o['v']
    if f not in lbl: continue
    if f in held: Xte.append(v); yte.append(lbl[f])
    else: Xtr.append(v); ytr.append(lbl[f])
Xtr, ytr, Xte, yte = np.array(Xtr), np.array(ytr), np.array(Xte), np.array(yte)
print(f'train {len(Xtr)} | test(held-out) {len(Xte)}')
import collections
print('train ต่อทรง:', dict(sorted(collections.Counter(ytr).items())))

def report(name, pred):
    acc = (pred == yte).mean()
    # custom binary
    tc, pc = (yte==12), (pred==12)
    rec = (pc & tc).sum() / max(tc.sum(),1)
    stdok = (~pc & ~tc).sum() / max((~tc).sum(),1)
    bacc = ((pc==tc)).mean()
    print(f'\n=== {name} ===')
    print(f'  จับทรงเป๊ะ 12-way : {acc*100:.0f}%  ({(pred==yte).sum()}/{len(yte)})')
    print(f'  Custom recall     : {rec*100:.0f}%')
    print(f'  Custom vs มาตรฐาน : {bacc*100:.0f}%')

# kNN (baseline เดิม)
knn = KNeighborsClassifier(n_neighbors=7, metric='cosine', weights='distance').fit(Xtr, ytr)
report('kNN k=7 (เดิม)', knn.predict(Xte))

# Logistic Regression head
lr = LogisticRegression(max_iter=2000, C=1.0, class_weight='balanced').fit(Xtr, ytr)
report('Logistic Regression (เทรน head)', lr.predict(Xte))

# Logistic แบบไม่ balance (เผื่อ base-rate ช่วย)
lr2 = LogisticRegression(max_iter=2000, C=2.0).fit(Xtr, ytr)
report('Logistic (ไม่ balance, C=2)', lr2.predict(Xte))
