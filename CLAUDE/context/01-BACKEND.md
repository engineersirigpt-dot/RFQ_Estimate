# 01 — Backend (Server, Routing, Auth)

ฝั่งเซิร์ฟเวอร์ทั้งหมดของ Express app นี้ (ไม่รวมการคำนวณซึ่งอยู่ฝั่ง browser — ดู `02-CALCULATION-ENGINE.md`)

## index.js — Entry point (~150 บรรทัด)

**Setup (บรรทัด 1-21)**
- view engine = EJS, views = `public/`
- middleware: `express.json()`, `express.static(public/)`, `cookieParser()`, `dotenv.config()`
- port จาก `config.get('data').port`
- config ทั้งก้อนใส่ `app.locals.data` → EJS เข้าถึงได้

**Route mounting (บรรทัด 23-25)**
- `/product` → `router/product.js` (public ไม่ต้อง auth)
- `/ai` → `router/ai.js` (มี `checkAuth`)
- `/dieline` → `router/dieline.js` (มี `checkAuth`)

**Inline routes (บรรทัด 27-116)**
- `/login`, `/logout` (เคลียร์ cookie: emp_id, accessToken, refreshToken)
- `POST /set-cookie` — client ส่ง token มา server เซ็ตเป็น httpOnly cookie (access 15 นาที, refresh 7 วัน)
- `/quote`, `/estimate`, `/view`, `/`, `/print`, `/print2` — render EJS (protected)
- `/id/:id`, `POST /add` — endpoint ทดสอบ

**Socket.IO (บรรทัด 128-139)**
- ฟัง `save_message` → broadcast `refresh_message` ให้ทุก client (ใช้งานน้อย)

## Auth — `public/js/includes/auth.js` (middleware `checkAuth`)

Cookie-based, ตรวจทุก protected request:
1. Login → backend คืน `accessToken` (15 นาที) + `refreshToken` (7 วัน) → เก็บเป็น httpOnly cookie ผ่าน `POST /set-cookie`
2. ทุก request: เรียก `${node_api}/user/check-auth?emp_id=...` header `Authorization: Bearer <accessToken>` → คาดหวัง `{valid, expires_at}`
3. ถ้า 401 → ลอง refresh: `POST ${node_api}/user/token` header `Bearer <refreshToken>` → ได้ token ใหม่ → อัปเดต cookie → retry
4. refresh ล้มเหลว → redirect `/logout`

**Public paths (ยกเว้น auth):** `/logout`, `/login`, `/set-cookie`, `/user/check-auth`, `/favicon.ico`

**Roles:** `super_admin`, `enable_price_check`, `regular` — คุมการแก้ไข field ตาม document status

## router/ai.js — AI RFQ extraction (558 บรรทัด) ⭐

เรียก **Anthropic Claude** สกัดสเปกจากเอกสาร RFQ → JSON (รายละเอียดเต็มใน `04-AI-RFQ.md`)

- **Model:** `claude-sonnet-4-5` (env `ANTHROPIC_MODEL`, default บรรทัด 15)
- **Endpoint:** `POST /ai/parse-spec` (บรรทัด 469-555) — รับ multipart `{text, files[]}` คืน `{success, data, model}`
- โหลด reference ตอน startup: PDF วิธีคิด + รูป template 1-12 (cache แบบ ephemeral)
- รองรับไฟล์: PDF (ส่ง base64), รูป (base64), DOCX (mammoth), XLSX/CSV (xlsx→csv), text
- **System prompt ยาว ~8000 บรรทัด** (บรรทัด 65-261) = schema + กฎการสกัด
- config: max_tokens 4000, temperature 0, prompt caching
- retry 4 ครั้งบน 5xx/529 (backoff 1.5→3→6→12s)
- `stripHallucinations()` (บรรทัด 368-444) = safety net ลบ field ที่ AI เดาเอง (paper_type, paper_gram, corrugated, quantities, deliveries) เมื่อไม่มี trigger word ใน input
- error เป็นข้อความไทยตาม HTTP code (529/429/401/402/5xx)

## router/dieline.js — Dieline proxy (272 บรรทัด)

Proxy ไป **diecuttemplates.com** สร้าง dieline พร้อมผลิต (SVG/PDF/DXF)
- base URL: `https://sandbox.api.diecuttemplates.com` (env `DIECUTTEMPLATES_BASE_URL`)
- auth: Bearer token + header `Dielines-Api-Version: 1.0`
- `GET /map-info` — map box id ภายใน (1-12) → template id ของ diecuttemplates (เช่น `becf-10301`)
- `GET /template-info?template_id=` — ดึง metadata
- `POST /generate` — รับ `{internal_template_id, template_id, format, variables}` → คืน `{success, url, dimensions, adjustments, raw}`
  - มี in-memory cache (TTL 1 ชม.), จัดการ rate-limit 429 (backoff), retry ตาม suggestion, แปล error ไทย
- *สถานะ: router มีแล้วแต่ integration ฝั่ง UI ยังไม่ active เท่าไหร่*

## router/product.js — (7 บรรทัด)
`GET /product/` → render `product.ejs`

## node_api endpoints ที่ฝั่ง frontend เรียก (backend หลัก @ 192.168.5.3:3010)

> เหล่านี้คือ API ของ backend microservice แยก ไม่ใช่ของ Express app นี้

**Auth/User**
- `POST /user/login`, `GET /user/check-auth`, `POST /user/token`, `GET /user/qt_approver`

**Estimate/RFQ**
- `GET /estimate/rfq` — ดึง RFQ
- `POST /estimate/save_rfq` — **บันทึก RFQ หลัก** (จาก prepareDatatoDB)
- `GET /estimate/master_data?type=` — ดึง master data (22 ชนิด)
- `POST /estimate/upload`, `GET /estimate/file/view/:fileName`
- `GET /estimate/autocomplete?type=customer|employee|delivery`
- `GET /estimate/history?job_id=`, `GET /estimate/list`
- `GET /estimate/customer`, `GET /estimate/emp_status`

**Quotation**
- `GET /estimate/quotations/status`, `GET /estimate/quotations?rfq_id=`
- `POST /estimate/quotations`, `GET /estimate/quotations/:quotation_id`
- `GET /estimate/quotations_history?quotation_id=`
- `GET /customer/get-contact?customer_id=`

## package.json — deps สำคัญ
express, ejs, @anthropic-ai/sdk, socket.io, cookie-parser, dotenv, config, axios, multer, mammoth, xlsx, moment, nanoid

## หมายเหตุสำหรับ dev
- ไม่มี test/build step ฝั่ง server — แก้แล้ว restart node
- `gh` CLI **ไม่ได้ติดตั้ง** บนเครื่องนี้ (review PR ผ่าน gh ไม่ได้)
- git remote: `Sirisolutions/Estimate-Packaging` — branches: main, dev, dev_mi2
