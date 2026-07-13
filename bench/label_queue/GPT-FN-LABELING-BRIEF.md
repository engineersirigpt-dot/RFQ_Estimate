# งานให้ GPT: ตี Custom false-negative แบบ blind (two-layer schema)

> **บริบท:** เราพบว่า engineer label เดิม (proxy) ตี "กล่องพิเศษ (Custom)" ผิดบางเคส — กล่องที่ควรเป็น Custom ถูกเก็บเป็นทรงมาตรฐาน 1–11. เราคัดผู้ต้องสงสัยมาแล้ว (ด้วย embedding — คุณ**ไม่เห็น** proxy/เหตุผลที่คัด เพื่อความยุติธรรม). วิธี: **GPT ตี blind ก่อน → expert ยืนยันเฉพาะที่ขัด**. label ที่ได้จะเอาไป clean แล้วเทรนโมเดล 2 หัว (custom-feature + base-construction)

## งานของคุณ
ผมแนบ **ไดไลน์หลายรูป (เลข #1 เป็นต้นไป ตามลำดับที่แนบ)** — แต่ละรูปตอบ **2 ชั้น**: (ก) เป็น Custom ไหม (ข) โครงสร้างพื้นฐานคือทรงอะไร/อ่านได้ไหม

## กฎ Custom (business rule) — is_custom = yes เมื่อมีฟีเจอร์พิเศษ ≥1 ข้อ
- หน้าต่าง die-cut / ช่องเจาะโชว์สินค้า (window)
- ขอบโค้ง/หยัก/เว้า (curved_edge)
- หูหิ้ว/รูแขวน (hang_tab)
- ฝาครอบ/wrap เปล่า ไม่มีตัวปิดกล่องในตัว
- กล่องลูกฟูก RSC (4 ผนัง + ฝาบน-ล่าง ไม่มีฝาเสียบ)
- จำนวน body panel > 4 (นับเส้นพับแนวนอน)
- โครงสร้างแปลกจนไม่เข้าทรง 1–11 เลย (nonstandard_structure)

## 12 ทรงพื้นฐาน (สำหรับ base_construction)
| # | ชื่อ | เด่น | | # | ชื่อ | เด่น |
|---|---|---|---|---|---|---|
| 1 | Reverse Tuck End | ฝาบน-ล่างเสียบ **คนละทาง** | | 7 | Bento | ถาดมีฝาครอบติดกัน |
| 2 | Straight Tuck End | ฝาบน-ล่างเสียบ **ทางเดียวกัน** | | 8 | Gable Top | มี **หูหิ้ว** ยอดแหลม |
| 3 | Snap Lock Bottom | ก้นล็อกสน็อป (ไม่ทากาว ไม่มีทแยง) | | 9 | Sleeve | ปลอกสวม เปิด 2 ด้าน ไม่มีฝาบน-ล่าง |
| 4 | Tuck Top Auto Bottom | ฝาบนเสียบ + **ก้น crash-lock ทแยง + ทากาว** | | 10 | Pillow | ทรงหมอน ปลายโค้ง |
| 5 | Tray | ถาดเปิดบน | | 11 | Seal End | ปิดปลายด้วยกาว (ฝาบน-ล่างไม่เท่ากัน) |
| 6 | Frame-Vue Tray | ถาดโชว์ มีกรอบใน | | — | — | — |

## รูปแบบคำตอบ (ต่อรูป — JSON)
```json
{
  "num": 1,
  "is_custom": "yes | no | unknown",
  "custom_reasons": ["window", "hang_tab", "curved_edge", "rsc", ">4_panels", "nonstandard_structure"],
  "base_status": "standard | nonstandard | ambiguous | unobservable",
  "base_construction": 4,
  "base_candidates": [4, 8],
  "evidence": "อ้างโครงสร้างจริงที่เห็น โดยเฉพาะ 'ก้น' สำหรับ tuck-family"
}
```

## กติกา base_status (สำคัญมาก — อย่ายุบรวม)
- **standard** → โครงเข้าทรง 1–11 ชัด → `base_construction` = 1 ค่า, `base_candidates` = []
- **nonstandard** → เห็นชัดว่าโครง **ไม่เข้า 1–11** → `base_construction` = null, `base_candidates` = []
- **ambiguous** → เห็นหลักฐานแต่ **คาบเกี่ยว 2 ทรง** → `base_construction` = null, `base_candidates` = [เช่น 4,8]
- **unobservable** → ภาพ/เส้นไม่พอตัดสิน → `base_construction` = null
- ⚠️ **ห้ามใช้ nonstandard เป็นที่ทิ้งเคสที่ยังไม่แน่ใจ** — ถ้าไม่แน่ใจว่าเข้า 1–11 ไหม ให้ ambiguous/unobservable
- `is_custom` แยกจาก `base_status`: กล่องเป็น Custom (มี window) ได้ทั้งที่ base เป็น auto-bottom(4) — ตอบ `is_custom:yes` + `base_status:standard` + `base_construction:4` ได้

## หลักการ
- **เหตุผลต้องอ้างโครงสร้างจริง** (โดยเฉพาะ "ก้น" สำหรับ 1/2/4) ไม่ใช่เดา
- ไม่แน่ใจ → `unknown`/`unobservable`/`ambiguous` — **บอกไม่แน่ใจมีค่ากว่าเดาผิด**
- LAY = จัดเรียงหลายกล่องบนแผ่นเดียว → จำแนก **กล่อง 1 ตัว**
- ตอบครบทุกรูปตามลำดับที่แนบ

---
## Batch 1: nn_gold (60 ใบ — ผู้ต้องสงสัย FN สูงสุด)
*(ผู้ใช้: แนบไดไลน์ตามลำดับใน `bench/label_queue/nn_gold_manifest.tsv` — แคปหน้าแรกของ PDF ส่ง · GPT ตอบ JSON array เรียงตาม num · Claude จะ map num→file กลับเอง)*
