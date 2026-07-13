# Gold adjudication sheet — 19 candidates → gold set

**วิธี:** proxy(engineer) + Claude + CV + GPT(blind) + **Claude-review (ดูรูปจริง)** → รวมเป็น draft gold
- `gold_draft` = เฉลยที่ผมมั่นใจ (custom feature เห็นชัด / หลายแหล่งตรงกัน)
- `needs_human` = ธงให้ expert ยืนยัน (tuck 1-vs-2 = blind spot ของ AI ทุกตัว / แหล่งขัดกันหนัก)

## ❌ ตัดออก 7 ใบ (ไม่ใช่ไดไลน์ — GPT จับได้)
`#4,#5,#6` = ฟอร์ม RFQ/ใบราคา · `#10,#15,#18` = สกรีนช็อต estimate (อ่านเลขจากฟอร์ม ไม่ใช่จากไดไลน์) · `#16` = รูปกล่องประกอบแล้ว
→ **ปัญหา candidate selection: held-out มี non-dieline ปน — ต้องกรองก่อนคัดรอบหน้า**

## ไดไลน์จริง 12 ใบ

| # | สินค้า | proxy | Claude | CV | GPT | **Claude-review (ดูรูป)** | **gold_draft** | สถานะ |
|---|---|---|---|---|---|---|---|---|
| 1 | F009929 FETTUCCINE | 1 | 1 | 3 | 12 | tuck บน + ก้นพิเศษ, จุดกลางเล็ก (ไม่ใช่หน้าต่างใหญ่) → GPT over-read | 1/2 | 🚩 human (ก้น+1v2) |
| 2 | LAY ของ #1 | 1 | 4 | 2 | 12 | = #1 (imposition) | =#1 | ตัด (ซ้ำ #1) |
| 3 | ZOE Ring Stand | 2 | 1 | 2 | 1 | tuck ขอบมน ฝาบน-ล่างดูข้างเดียวกัน → เอนไป 2 | 2? | 🚩 human (1-vs-2) |
| 7 | 1649131510785 | 1 | 1 | 1 | 1 | (ทุกแหล่ง=1) | 1 | ✅ confident |
| 8 | Oat Spaghetti | 1 | 1 | 1 | 12 | **ดูแล้วไม่มีหน้าต่าง** — tuck ธรรมดา → GPT hallucinate | 1 | ✅ (custom=no) |
| 9 | GPO DICLOX | 4 | 11 | 4 | 11 | ยังไม่ดู, proxy+CV=4 vs Claude+GPT=11 | 4? | 🚩 human (4 vs 11) |
| 11 | =#7 (ซ้ำ job) | 1 | 12 | 1 | 1 | = #7 | =#7 | ตัด (ซ้ำ #7) |
| 12 | =#7 (ซ้ำ job) | 1 | 12 | 1 | 1 | = #7 | =#7 | ตัด (ซ้ำ #7) |
| 13 | THE GENT | 1 | 4 | 12 | 12 | **ยืนยันแล้ว Custom** (ขอบโค้ง+ก้นล็อก) — proxy ผิด | **12** | ✅ confident |
| 14 | Ars Plus Inner | 2 | 12 | 3 | 2 | ยังไม่ดู, proxy+GPT=2 | 2? | 🚩 human (tuck) |
| 17 | 090822 Sleeve | 9 | 9 | 3 | 9 | proxy+Claude+GPT=9 (sleeve) | 9 | ✅ confident |
| 19 | NATUR Gift box | 3 | 4 | 3 | 12 | **มีหน้าต่าง PET จริง + หูหิ้ว** → Custom, proxy ผิด | **12** | ✅ confident |

## สรุป gold set (จาก 12 ไดไลน์, ตัดซ้ำ 3 → 9 unique)
```
✅ confident gold (5 ใบ):  #7→1, #8→1, #13→12, #17→9, #19→12
🚩 ต้อง expert ยืนยัน (4):  #1→1/2, #3→1/2, #9→4/11, #14→tuck
```

## 💡 ข้อค้นพบสำคัญ (ต้องบอก expert)
1. **proxy label ผิดจริง 2 ใบ** (#13 GENT, #19 NATUR — proxy บอกมาตรฐาน แต่จริง Custom) → **อย่าเชื่อ proxy เป็น gold**
2. **GPT custom detection: ถูกเมื่อมี feature จริง (#13,#19), hallucinate เมื่อไม่มี (#8)** → ต้องคนยืนยัน
3. **tuck 1-vs-2 (#1,#3): AI ทุกตัว + คนดูรูปก็ยังก้ำกึ่ง** — นี่คือเคสที่ต้อง expert ที่รู้ construction จริง
4. **candidate selection ต้องกรอง non-dieline** (รอบนี้เสีย 7/19 = 37%)

## expert ต้องทำแค่
ยืนยัน 4 ใบที่ธง (#1,#3,#9,#14) — ไม่ใช่ทั้ง 19 → **Claude+GPT+CV ทำ 70% ให้แล้ว**

---

# GPT outsider review — หลัง trace ถึง fine-tune v2

## Intent

เป้าหมายที่แท้จริงคือสร้าง holdout ที่เชื่อถือได้พอจะตอบว่าโมเดล B3 อ่าน **โครงสร้างกล่องจริง** ดีขึ้นหรือไม่ ไม่ใช่เพียงทายตรง proxy label. แนว adjudication หลายแหล่งถูกทาง แต่ artifact ปัจจุบันยังใช้คำว่า “expert gold/accuracy จริง” เกินกว่าหลักฐานรองรับ.

## [BLOCKER] Gold 9 ใบไม่ใช่ expert-confirmed ทั้งหมด

**Finding:** `gold_final.tsv` มีเพียง 4 แถวที่ `source=expert`; อีก 5 แถวเป็น `source=claude` แต่ `prep_finetune_data.py` และ notebook เรียกทั้ง 9 ว่า expert gold.

**Why it matters:** metric ที่รายงานว่า “accuracy จริง” จะผสม expert label กับ AI adjudication และผู้ใช้ผลอาจเข้าใจว่าคนผู้เชี่ยวชาญยืนยันครบแล้ว.

**Evidence:** `bench/gold/gold_final.tsv` แถว 2–6 เป็น `claude`, แถว 7–10 จึงเป็น `expert`; ขณะที่ `bench/prep_finetune_data.py:1-2,53,61` และ notebook ใช้คำว่า expert กับทั้งชุด.

**Suggested change:** เปลี่ยนชื่อ metric ตอนนี้เป็น `adjudicated_holdout_9` และรายงานแยก:

```text
expert_only (n=4)
claude_reviewed_confident (n=5)
combined_adjudicated (n=9)
```

ถ้าต้องการใช้คำว่า expert gold ให้ expert ยืนยันอีก 5 ใบ หรือเพิ่ม `review_status`/`reviewed_by` จริงใน TSV.

## [MAJOR] ชุด 9 ใบไม่สามารถวัด “12-way accuracy” ได้

**Finding:** label ใน final gold มีเฉพาะ class 1, 2, 9 และ 12; ไม่มี 3/4/5/6/7/8/10/11.

**Why it matters:** accuracy รวมจะขึ้นกับ mix ของ 4 class นี้และไม่บอกความสามารถ 12-way โดยเฉพาะ auto-bottom(4), seal-end(11) และ rare classes ซึ่งเป็นจุดตัดสินของผลิตภัณฑ์.

**Evidence:** `gold_final.tsv` กระจายเป็น `{1:3, 2:2, 9:1, 12:3}`.

**Suggested change:** ใช้ 9 ใบเป็น **smoke test/per-case audit** เท่านั้น. ห้ามเทียบ “B3 12-way ชนะ B0” จากชุดนี้. รายงานต่อใบและราย slice (`tuck 1/2`, `custom`, `sleeve`) จนกว่า gold จะมี coverage ต่อ critical axis อย่างน้อยหลายสิบ family.

## [MAJOR] ตัวกรอง non-dieline ยังป้องกัน contamination ไม่ได้

**Finding:** train และ batch 2 กรองเอกสารขยะด้วย regex บน filename เท่านั้น.

**Why it matters:** batch แรกพิสูจน์แล้วว่า non-dieline ปน 7/19 (37%). ไฟล์เอกสารที่ชื่อไม่ตรง `quotation|estimate|screenshot...` ยังเข้า train ได้ ทำให้ B3 เรียน UI/text/document style แทน flap geometry.

**Evidence:** `prep_finetune_data.py:12,39` และ `select_gold2.py:9,22` ใช้ `JUNK.search(f)`; แต่ข้อสรุปไฟล์นี้เองบันทึกว่า candidate selection มี non-dieline 37%.

**Suggested change:** เพิ่ม `content_type` gate ก่อน pack อย่างน้อย `dieline | lay | document | assembled_photo | unreadable`, โดย manual-review sample จากทุก class ก่อน Colab. รายงานจำนวนที่ถูกตัดต่อ class. ถ้ายังไม่ทำ ให้เรียกผล B3 ว่า exploratory และอย่าเตรียม deploy.

## [MAJOR] Family leakage guard ยังอ่อนกว่ากรอบที่ตกลงกัน

**Finding:** `gid()` ใช้ `job_id` มิฉะนั้น filename base; ไม่เชื่อม F-code, design hash หรือ revision ข้าม job.

**Why it matters:** die เดิมที่ reprint ด้วย job ใหม่สามารถอยู่ทั้ง train และ gold/validation ทำให้ผลดูสูงจาก near-duplicate.

**Evidence:** `prep_finetune_data.py:18-20,27,39`; implementation นี้ไม่ใช่ connected-component family graph ที่ใช้ใน eval framework v2.

**Suggested change:** reuse family mapping จาก `eval_framework.py` หรือ export `family_group_id` กลางหนึ่งชุด แล้วใช้ชุดเดียวกันใน prep, train/val split และ gold exclusion. ก่อน train ให้ assert `train_family ∩ gold_family = ∅` และพิมพ์จำนวน exact/pHash near-duplicates.

## [MAJOR] Batch 2 คัดไฟล์ ไม่ได้คัด unique family

**Finding:** `select_gold2.py` เลือกไฟล์เรียงชื่อจำนวน N ต่อ proxy class โดยไม่ group family.

**Why it matters:** revision/LAY/job เดียวกันอาจกินหลาย slot เหมือน batch 1 (#2/#11/#12 เป็นไฟล์ซ้ำเชิง family) ทำให้เสียแรง expert และทำให้ effective sample size ต่ำกว่าจำนวนรูป.

**Evidence:** `select_gold2.py:26,29-30` เลือก `sorted(meta[t])[:n]`; ไม่มี family dedupe.

**Suggested change:** group candidates ด้วย `family_group_id`, เลือกหนึ่ง representative ต่อ family, แล้ว stratify ตาม axis/conflict/input quality ไม่ใช่ proxy class อย่างเดียว.

## [MAJOR] Notebook บันทึก final epoch และไม่มี reproducibility run

**Finding:** training loop 20 epoch ไม่เก็บ best checkpoint และไม่มี fixed seeds สำหรับ Torch/NumPy/DataLoader.

**Why it matters:** final epoch อาจแย่กว่าจุดดีที่สุด และผล gold 9 ใบเปลี่ยนมากได้จาก prediction ผิด/ถูกเพียงใบเดียว (11.1 percentage points) หรือจาก random initialization/augmentation.

**Evidence:** `finetune_dieline.ipynb` training cell พิมพ์ val accuracy แต่ `torch.save` หลัง loop บันทึกโมเดลสุดท้ายเท่านั้น.

**Suggested change:** fix seeds, save `best_state` ตาม predeclared proxy-val metric, และรันอย่างน้อย 3 seeds. รายงาน mean/range; gold ใช้ evaluate หลังเลือกโมเดลแล้ว ห้ามเลือก seed/checkpoint จาก gold.

## Simpler alternative

ยังไม่ต้องวาง deploy plan สำหรับ 12-way B3. ใช้ Colab v2 เป็น experiment เพื่อทดสอบ 3 ข้อก่อน:

1. B3 ชนะ B0 บน **group-safe proxy validation** อย่างสม่ำเสมอหลาย seed หรือไม่
2. บน adjudicated 9 ใบ โมเดลแก้ proxy-wrong Custom (#13/#19 และ GPO) ได้จริงหรือเพียงทาย Custom มากขึ้น
3. error ต่อใบอ้าง structural feature หรือสัมพันธ์กับ document/artwork style

ถ้าไม่ผ่าน ให้กลับไปลงทุนที่ content filtering + unique-family gold มากกว่าเพิ่มขนาดโมเดล. ถ้าผ่าน จึงขยาย expert gold ก่อนออกแบบ integration.

## Verdict

**Fix-then-interpret:** notebook รันเพื่อเก็บ exploratory result ได้ แต่ยังห้ามใช้คำว่า “expert 9 / accuracy จริง / พร้อม deploy”. Blocker ใหญ่สุดคือ provenance ของ gold 5/9 ใบและ coverage เพียง 4 classes.
