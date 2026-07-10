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
