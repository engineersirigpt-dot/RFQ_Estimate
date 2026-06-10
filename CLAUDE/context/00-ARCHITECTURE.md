# 00 — Architecture Overview (ภาพรวมสถาปัตยกรรม)

> เอกสารชุด `CLAUDE/context/` สร้างไว้สำหรับฟื้น context เมื่อ conversation ยาว/เต็ม
> อ่านไฟล์นี้ก่อนเป็นอันดับแรก แล้วค่อยเจาะไฟล์ย่อยตามต้องการ

## โปรเจคนี้คืออะไร

ระบบ **ประเมินราคา (estimate) งานกล่องบรรจุภัณฑ์** สำหรับโรงพิมพ์/โรงงานกล่อง
AE กรอกสเปก → ระบบคำนวณราคาต้นทุน 16 รายการ → ออกใบเสนอราคา (quotation) → อนุมัติ

**จุดสำคัญทางสถาปัตยกรรม:** แอปนี้เป็น **frontend-facing Express wrapper** — business logic การคำนวณราคา **ทำงานฝั่ง browser ทั้งหมด** (JS class `Estimate`) ส่วนการบันทึก/ดึงข้อมูลจริงไปที่ backend microservice แยกต่างหาก (`node_api`)

## แผนผังระบบ (services)

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (ที่คำนวณราคาจริง)                                    │
│   estimate.ejs + Estimate class (function_estimate_*.js)     │
│   - คำนวณ 16 cost items ทั้งหมดบน client                      │
└───────────────┬─────────────────────────────────────────────┘
                │ HTTP
┌───────────────▼─────────────────────────────────────────────┐
│ This Express App (index.js)  — port 3099 dev / 3040 prod     │
│   - serve EJS pages + static JS                              │
│   - auth middleware (checkAuth) ตรวจ cookie ทุก request       │
│   - /ai/parse-spec  → เรียก Anthropic Claude (AI RFQ)        │
│   - /dieline/*      → proxy ไป diecuttemplates.com           │
│   - /product, socket.io (save_message → refresh_message)     │
└───────┬──────────────────────────┬──────────────────┬────────┘
        │                          │                  │
┌───────▼────────┐    ┌────────────▼──────┐   ┌───────▼────────┐
│ node_api       │    │ Anthropic Claude  │   │ diecuttemplates│
│ 192.168.5.3    │    │ (claude-sonnet-   │   │ .com API       │
│ :3010          │    │  4-5)             │   │ (sandbox)      │
│ = DB + auth +  │    │ = สกัดสเปกจาก RFQ │   │ = สร้าง dieline│
│   save_rfq +   │    └───────────────────┘   │   SVG/PDF/DXF  │
│   master_data  │                            └────────────────┘
└────────────────┘
```

## Tech Stack

- **Backend:** Node.js + Express 4.17, EJS views (views dir = `public/`)
- **Frontend:** jQuery, DataTables, pdfmake, SweetAlert2 (ไม่มี build step — โหลด `<script>` ตรงๆ)
- **AI:** `@anthropic-ai/sdk` v0.91 — model `claude-sonnet-4-5`
- **อื่นๆ:** socket.io, multer (upload), mammoth (อ่าน .docx), xlsx (อ่าน excel), config, dotenv
- **Port:** 3099 dev / 3040 prod (จาก `config/*.json`) — *หมายเหตุ: CLAUDE.md เก่าเขียน 3040 dev ให้เชื่อค่าใน config*

## Config (`config/default.json` = dev, `config/production.json` = prod)

| key | dev | หน้าที่ |
|-----|-----|---------|
| `data.port` | 3099 | port ที่ listen |
| `data.node_api` | http://192.168.5.3:3010 | **backend หลัก** (DB, auth, save) |
| `data.api_url` | http://192.168.5.3/estimate_packaging | legacy API |
| `data.base_url` | http://hostname:3040 | URL ตัวเอง |
| `data.report_url` | http://192.168.5.3:3051/estimate | service ออกรายงาน |
| `data.wizard_api` | http://hostname:3000 | wizard service |
| `data.version` | "3.1" | system version (มีผลกับสูตร markup ดู §calculation) |

`index.js` ดึง config ใส่ `app.locals.data` → EJS ทุกหน้าเข้าถึงได้

## Env vars (`.env`, ดู `.env.example`)

- `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-4-5`)
- `DIECUTTEMPLATES_API_KEY`, `DIECUTTEMPLATES_BASE_URL`

## System Flow (end-to-end)

```
Login → RFQ List → สร้าง/แก้ Estimate → เลือก Print Type + Box Type
→ กรอก Component specs (ขนาด, กระดาษ, สี, addon)
→ Auto Calculate: Open Size → Machine → UPS → Paper Usage → 16 Cost Items → Summary
→ Save (POST node_api /estimate/save_rfq ผ่าน prepareDatatoDB)
→ Quotation → Approval (Draft → Pending → Approved/Rejected)
```

## ไฟล์เอกสารในชุดนี้

| ไฟล์ | เนื้อหา |
|------|---------|
| `00-ARCHITECTURE.md` | ไฟล์นี้ — ภาพรวม, services, config |
| `01-BACKEND.md` | index.js, router/*, auth, AI endpoint, dieline proxy, node_api endpoints |
| `02-CALCULATION-ENGINE.md` | Estimate class, 16 cost items, box types, UPS/layout, special logic |
| `03-FRONTEND.md` | est.mainData, page lifecycle, db class, save flow, default.js constants |
| `04-AI-RFQ.md` | AI RFQ feature (parse-spec) + Pornchai Agent subproject |

## เอกสารเดิมที่มีอยู่แล้ว (ใน `CLAUDE/`)

- `CLAUDE/README.md` (ว่าง — รอเติม)
- `CLAUDE/pricing_calculation_flow.md` (48KB — สูตรราคาละเอียดสุด)
- `CLAUDE/summary_estimate_spec_v1.md`, `CLAUDE/system_overview_estimate_packaging.md`
- `CLAUDE/machine_spec_v1.1.md`, `CLAUDE/estimation_diagrams.md`
- `machine_spec.md` (root), `ตัวอย่าง estimate spec.md` (ตัวอย่างจริง)
