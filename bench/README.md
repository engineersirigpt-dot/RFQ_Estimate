# AI Regression Harness (`bench/`)

ตาข่ายกันงาน AI พัง — รันเทสฝั่ง `router/ai.js` (parse-spec / explain-price) + `function_ai_rfq_fill.js`

> **กลไก:** helper ภายใน `router/ai.js` (validateAndFix, stripHallucinations, ฯลฯ) ถูก export
> **เฉพาะตอนตั้ง env `AI_TEST=1`** เท่านั้น (production ไม่โดนแตะ) — ทุก script ในนี้ตั้งให้เองแล้ว

## ⚡ รันก่อน commit ทุกครั้ง (deterministic, ไม่ง้อ API, ฟรี)

```bash
node bench/ai_test.js
```

ดักบั๊กที่เคยแก้ทันที (exit 1 ถ้า fail):
- **stated_size ×10** — `"150mm"` ต้องอ่านเป็น 150 ไม่ใช่ 1500 (regex `/mm\b/`) + prefix `W/L/H`
- **paper_gram strip** — `"C1s 300"` ต้องเก็บแกรม / เลขมั่วต้องตัด
- **stripMoneyPct** — ตัด ฿/บาท/% ออกจากคำอธิบายราคา แต่เก็บ "350 แกรม"/"4 สี"

## 🌐 เทส accuracy (ยิง API จริง — ต้องมี `ANTHROPIC_API_KEY` ใน `.env`)

| คำสั่ง | เทสอะไร | ต้องมี |
|---|---|---|
| `node bench/golden_grader.js` | ความแม่น 19 เคสข้อความ (ขนาด/แกรม/สี/ยอด) | `Test Case - AI Input ...xlsx` |
| `node bench/test_print_types.js` | แยก Flexo/Konica/Jet Press + constraint | - |
| `node bench/test_explain_price.js` | explain-price เลือก driver ถูก + ไม่หลุดเลข | - |
| `node bench/regression.js` | dump output เต็ม 20 เคส ลง `regression_results.md` | xlsx |

## หมายเหตุ
- ผลเต็มเขียนลงไฟล์ `*_results.md` (ไม่ commit — เป็น output ชั่วคราว)
- เพิ่มเคสใหม่ใน `ai_test.js` (deterministic) เมื่อแก้บั๊กใหม่ทุกครั้ง → กัน regression
- ไฟล์ใน `bench/` เป็นเครื่องมือ dev — ไม่ต้อง deploy
