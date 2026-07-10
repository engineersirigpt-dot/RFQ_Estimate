# สถานะงาน AI dieline (กัน compact หาย) — อัปเดต 2026-07-09

## เป้า
แก้ AI จับ box_template (ทรงกล่อง) ให้แม่น โดยเฉพาะ tuck-family (1 vs 2 vs 3 vs 4 vs 11)

## ทำเสร็จแล้ว (บนดิสก์ทั้งหมด)
1. **outer_shape rule** ใน router/ai.js — "มีส่วนยื่น/เพิ่ม → Custom(12)", mirror กาวไม่สน (committed + push sirisol ai-fixes-jun15 แล้ว: d7efc1b, 5d82f21)
2. **ดึงเฉลยจริงจาก DB** (read-only ผ่าน API):
   - `bench/pull_answer_key.js` — POST estimate/list → estimate/rfq (job_data.component1[0].box_type.type_id) → match ไฟล์ใน test/uploads (server ลบไฟล์แล้ว แต่ local มี)
   - node_api = http://192.168.5.3:3010, ต้อง Bearer accessToken (login http://192.168.5.3:3040 → F12 → localStorage.getItem('accessToken'))
   - ผลอยู่ **answer_key/answer_map.csv** — ~8,200+ คู่ (รูป+ทรงที่คนเลือก) [pull วน 2022-01→2023-12 ทีละเดือน]
3. **split**: `bench/split_answer.js` → answer_key/fewshot_map.tsv + heldout_map.tsv (parse robust กันชื่อไฟล์มี comma; ไฟล์อยู่ test/uploads)
4. **ingest**: `bench/ingest_labeled.js --src test/uploads --map answer_key/fewshot_map.tsv` → แปลง PDF→รูป(pdf-to-img หน้าแรก) + ย่อ≤1568px → router/labeled_dielines/<1-12>/
5. **few-shot loader** ใน ai.js: อ่าน labeled_dielines/<เลข>/ เป็นเฉลย, GATE `AI_FEWSHOT_DIELINES=1` (ปิด default)
6. **เทส**: `bench/test_fewshot.js` → **accuracy OFF 20% → ON 60%** (แก้ tuck-family 3,4 ได้; 1-vs-2 ยังพลาด) ✓ พิสูจน์ว่า few-shot เฉลยจริงช่วยจริง

## ค้าง / ต่อไป
- pull ยังวิ่ง background (เก็บถึง ก.ย. 2023 = ขอบ backup local) — map เซฟทุกเดือน
- **เทส held-out ใหญ่ขึ้น** (test_fewshot.js PER=5) → accuracy ที่เชื่อถือได้
- **curate few-shot** (ตอนนี้ 3/ทรง=30 ใบ) เน้น 1-vs-2, เลือกใบเดี่ยวชัด (เลี่ยง LAY layout)
- ย่อ template public/img (บางใบ>2000px) — เลี่ยงแตะ shared: test_fewshot ย่อในตัวอยู่แล้ว; ถ้าจะเปิด few-shot จริงใน ai.js ต้องจัดการ template ≤2000px (many-image rule)
- commit เครื่องมือใหม่ (pull/split/test_fewshot + ingest PDF) — answer_key/* ใหญ่ ใส่ .gitignore แล้ว

## ข้อเท็จจริงสำคัญ
- box_type ใน job_data เป็น OBJECT: `{type_id:1-12, type_name}` → เลขทรง = type_id
- ไฟล์ RFQ upload = ชื่อตรงกับ test/uploads (server ENOENT แล้ว)
- 1-vs-2 (RTE vs STE) ต่างแค่ทิศฝา — ยากสุด
