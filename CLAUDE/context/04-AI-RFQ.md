# 04 — AI RFQ Feature + Pornchai Agent

มี **2 ระบบ AI แยกกัน** ในโปรเจคนี้ อย่าสับสน:
1. **AI RFQ (inline)** — `/ai/parse-spec` สกัดสเปก one-shot → เติมฟอร์ม (production-ready)
2. **Pornchai Agent** — sub-project ในโฟลเดอร์ `Pornchai AI RFQ/` แชทโต้ตอบหลายรอบ (experimental)

---

## ระบบ 1: AI RFQ inline (`/ai/parse-spec`)

### Flow end-to-end
1. ผู้ใช้กดปุ่ม "Add New RFQ with AI" → modal `#ai-rfq-modal`
2. วางข้อความ RFQ และ/หรืออัปโหลดไฟล์ (PDF/DOCX/XLSX/รูป/TXT ≤25MB, ≤10 ไฟล์)
3. submit → POST `/ai/parse-spec` (`function_ai_rfq.js:112`)
4. backend (Claude) สกัด → JSON
5. เก็บใน `sessionStorage['ai_rfq_data']` (`function_ai_rfq.js:120`) → redirect `/estimate?ai=1`
6. `function_ai_rfq_fill.js` เห็น `ai=1` (บรรทัด 6) → auto-fill ฟอร์มทั้งหมด
7. โชว์ banner ม่วงให้ตรวจ AE/Customer/จังหวัดส่ง

### Client files
**`function_ai_rfq.js`** — modal + upload + ส่ง request
- `openModal()` (18), `addFiles()` (47), `renderFileList()` (30), submit handler (97)
- ไม่แตะ mainData ตรงๆ — เก็บ JSON ลง sessionStorage

**`function_ai_rfq_fill.js`** — เติมฟอร์มจาก AI output (สำคัญ)
- `fillForm()` (111) orchestrate → `fillJobInfo()` (273), `fillJobDetail()` (280), `fillQuantities()` (320), `fillComponents()` (388) → `fillOneComponent()` (401-537), `fillCoatings/Foilstamps/Embosses/Debosses()` (852-946), `fillProcesses()` (666-683), `fillDeliveries()` (180-253), `showAIBanner()` (1032-1055)
- **เติมแบบ indirect:** `.val()` + `.trigger('change')` บน DOM → event handler เดิมเป็นคนเขียน mainData เอง (ไม่เขียน mainData ตรง)
- matching อัจฉริยะ: `findOptionMatch()` (69), `stripSideCount()` (65), `matchPaperType()` (687), `matchLayerByCount()` (790)
- ใช้ `setTimeout()` (400-1500ms) เยอะ เพราะ dropdown ลูกต้องรอ repopulate หลัง parent change

**`function_ai_calc_breakdown.js`** — ปุ่มลอยมุมขวาล่าง (เฉพาะ `enable_price_check=1`) โชว์ breakdown ต้นทุนจาก mainData (อ่านอย่างเดียว ไม่คำนวณซ้ำ) — ใช้ได้กับ estimate ทุกอัน ไม่เฉพาะ AI

### Backend (`router/ai.js`)
- model `claude-sonnet-4-5`, max_tokens 4000, temperature 0, prompt caching ephemeral
- ส่ง reference ทุก request: PDF "Estimate Packaging วิธีคิด1.pdf" + รูป template 1-12
- system prompt ~8000 บรรทัด (65-261) = schema + กฎสกัด
- `extractJson()` (352) strip markdown → parse
- **`stripHallucinations()` (368)** = safety net ลบ field ที่ AI เดา (paper_type, paper_gram, corrugated, quantities, deliveries) เมื่อไม่มี trigger word
- retry 4 ครั้ง backoff บน 5xx/529

### กฎสกัดสำคัญ (ใน system prompt)
- **paper_type/gram:** เติมเฉพาะเมื่อมีคำตรงตัว (อาร์ตการ์ด/Ivory/Kraft/Duplex/แกรม/gsm) — ห้ามเดาจากชนิดสินค้า/รหัส CAD เช่น "DP350"
- **corrugated:** set type=2 (laminate)/type=3 (corrugated only) เฉพาะเมื่อมี keyword ลูกฟูก; label ว่าง "Flute:" ไม่นับ
- **box_template_id:** หลักฐานหลัก = รูป dieline ที่อัปโหลด, fallback = คำสไตล์ (RTE/tray/gable/sleeve); Template 12 (Custom) เฉพาะเมื่อ 2D หรือไม่มี template ตรง
- **colors:** นับเยอะหน่อย CMYK=4, +white base +1, +metallic/special +1; "CMYK+ทนแดด" → +2
- **ink_type vs coating:** UV ink = หมึกพิมพ์ ("พิมพ์ UV"), UV coating = เคลือบ (Spot UV/Drip off) ≠ ink_type; default "conventional"
- **multiple-F:** หลาย design code สเปกเดียวกัน → `is_multiple_f=true`, f_codes[]=ต่อ code, quantities top-level ว่าง
- **deliveries:** เฉพาะชื่อจังหวัดไทยจริง, split = 1 entry/รอบ, format DD/MM/YYYY BE

### Output schema (ย่อ)
`{ success, data: { job_name, customer_name, ae_name, is_new_customer, is_reprinted, is_multiple_f, f_codes[], use_previous_plate, ink_type, print_type, flexo_size, quantities[], runon_percent, color_limit_qty, paper_markup_percent, components[]{ name, type(1|2|3), box_template_id, dimensions_mm, flap_mm, glue_mm, tuck_mm, color_outside, color_inside, special_inks[], paper_type, paper_gram, paper_cost, corrugated{grades,flute}, coatings[], foilstamps[], embosses[], debosses[] }, other_processes[], handwork_processes[], materials[], deliveries[], notes }, model }`

---

## ระบบ 2: Pornchai Agent (`Pornchai AI RFQ/`)

Sub-project แยก (มี `.git` ของตัวเอง) — AI Agent บน **OpenClaw** แชทโต้ตอบหลายรอบ ตรวจ Master Data ก่อน save **สถานะ: experimental**

### Stack
```
AE → Pornchai Webapp (localhost:3080)
   → OpenClaw Gateway (localhost:18789)
   → Pornchai Agent
   → rfq-estimate-skill (14 CLI commands)
   → Estimate API (192.168.5.3:3010)  ← backend หลักตัวเดียวกัน
```

### โครงสร้างโฟลเดอร์
- `README.md`, `AGENTS.md`, `API-Documentation.md`, `ACTION_PLAN*.md`
- `agent/` — `IDENTITY.md` (บุคลิก Pornchai: ชาย มืออาชีพ ไม่ใส่ emoji ไทยล้วน), `SOUL.md` (หลักการ: ไม่เดา, validate กับ Master Data, ยืนยันก่อน save), `models.json`, `auth.json`
- `agent-chat/` — `knowledge/` (master data files), `auth-profiles.json`
- `webapp/` — `server.js` (203KB, Express port 3080), `public/index.html` (chat UI), `package.json`

### ต่างจากระบบ 1 อย่างไร
- multi-turn ถาม-ตอบ (ไม่ใช่ one-shot), validate กับระบบจริงผ่าน 14 skill, ยืนยันก่อน save, มีบุคลิก
- 14 skills: login, list, search, detail, customer, customer-detail, employee, delivery, paper-types, box-templates, master, exchange-rate, status-log, save
- Telegram ยังไม่เชื่อม, ต้องรัน OpenClaw gateway แยก, **ยังไม่รวมเข้าฟอร์ม estimate หลัก**

---

## หมายเหตุสถานะ
- ระบบ 1 (`/ai/parse-spec`): **production-ready** — ใช้จากปุ่ม "Add New RFQ with AI"
- ระบบ 2 (Pornchai): experimental
- Dieline generation (`/dieline`): router มีแล้ว แต่ UI integration ยังไม่ active
