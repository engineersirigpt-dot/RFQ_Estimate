# Estimate-Packaging

ระบบประเมินราคางานประเภทกล่องบรรจุภัณฑ์ — Node.js + Express + EJS, คำนวณฝั่ง Browser

## Tech Stack

- Backend: Node.js + Express, EJS templating
- Frontend: jQuery, DataTables, pdfmake, SweetAlert2
- Port: 3040 (dev)
- Config: config/default.json, config/production.json

## Git Commit Rules

เมื่อผู้ใช้สั่ง "git commit":

1. ตรวจสอบ branch ปัจจุบันด้วย `git branch --show-current`
2. ถ้าอยู่ใน branch **dev** → สรุปสิ่งที่แก้ไขเป็นหัวข้อสั้นๆ แล้ว commit ให้เลย
3. ถ้า **ไม่ได้** อยู่ใน branch dev → **แจ้งเตือน** ผู้ใช้ว่าตอนนี้อยู่ branch อะไร แล้วถามยืนยันก่อน commit
4. Commit message: สรุปการแก้ไขเป็นภาษาไทยสั้นๆ (bullet points)

## Core Files (แก้ไขบ่อย)

| File                                            | หน้าที่                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------- |
| `public/js/function_estimate_calculation.js`    | Estimate class (8,819 lines) — คำนวณ 16 cost items ทั้งหมด             |
| `public/js/data/default.js`                     | Default config — tolerance, markup rates, machine specs, plate pricing |
| `public/js/function_estimate_layout.js`         | UPS calculation, layout optimization, tolerance                        |
| `public/js/function_estimate_validate.js`       | Input validation, business rules (72 KB)                               |
| `public/js/function_estimate_processInfo.js`    | Process handling — die-cut, foil stamp, coating (40 KB)                |
| `public/js/function_estimate.js`                | Main UI interaction & calculation bridge (637 KB)                      |
| `public/js/function_estimate_readyFunction.js`  | Event handlers & initialization (117 KB)                               |
| `public/js/function_estimate_displayData2UI.js` | Render data on page (46 KB)                                            |
| `public/js/function_estimate_database.js`       | Class db — master data storage                                         |
| `public/js/function_estimate_getMasterData.js`  | Helper fetch from db class                                             |
| `public/js/function_estimate_fetchData.js`      | API calls to backend                                                   |
| `public/js/prepare_data.js`                     | Transform mainData for API saving                                      |

## Need more detail?

อ่าน CLAUDE/README.md (สูตรคำนวณ, box type, markup rates, pipeline ครบ)
อ่าน CLAUDE/pricing_calculation_flow.md (สูตรราคาละเอียด)

## Pages (EJS)

| Route             | File                        | หน้าที่                 |
| ----------------- | --------------------------- | ----------------------- |
| `/`               | `public/index.ejs`          | RFQ list                |
| `/estimate`       | `public/estimate.ejs`       | หน้าประเมินราคา (70 KB) |
| `/estimate_print` | `public/estimate_print.ejs` | พิมพ์ estimate          |
| `/quote_detail`   | `public/quote_detail.ejs`   | Quotation               |
| `/login`          | `public/login.ejs`          | Login                   |

## Data Structure (est.mainData)

```
job: { job_name, print_type (Offset/Flexo/Jet Press/Konica), ink_type, is_profit_sharing }
qty: { main: [qty1, qty2, ...], runon, customer, ae }
component1: [{ box_type(1-12), W, L, D, T, G, dust, OL, paper_code, gram, color, coating, foilstamp, bossing }]
process: [{ type_id, process_id, name }]
packing: { paperband, kraftwrap, carton, pallet }
delivery: []
totalprice: [{ markup, markdown, tax, exchange_rate }]
```

## Box Types (12 types)

| Type | Name   | Formula                            |
| ---- | ------ | ---------------------------------- |
| 1    | RTE    | W=2(W+T)+D, L=2(W+L)+G             |
| 2    | STE    | W=2(W+T)+D, L=2(W+L)+G             |
| 3    | TTSLB  | W=T+W+D+W/2+OL, L=2(W+L)+G         |
| 4    | TTAB   | W=T+W+D+W/2+OL, L=2(W+L)+G         |
| 5    | DGWS   | W=W+4D, L=L+4D+2dust+2OL           |
| 6    | FVT    | W=W+4D+2dust+2OL, L=L+4D+2dust+2OL |
| 7    | CBT    | W=2(L+dust)+W, L=2(L+D)+L          |
| 8    | GTA    | W=T+2D+W/2+OL, L=2(W+L)+G          |
| 9    | Sleeve | W=D, L=2(W+L)+G                    |
| 10   | Pillow | W=L+D, L=2W+G                      |
| 11   | SE     | W=2W+D, L=2(W+L)+G                 |
| 12   | Custom | User defined                       |

## 16 Cost Items

C1-Paper, C2-Plate, C3-Proof, C4-Print, C5-Coating, C6-Foil Stamp, C7-Bossing, C8-Special Ink, C9-Assembly, C10-Die-cut, C11-Digital DC, C12-Chip, C13-Inspection, C14-Corrugated, C15-Packing, C16-Delivery

## Print Types & Constraints

| Feature    | Offset | Flexo  | Jet Press | Konica |
| ---------- | ------ | ------ | --------- | ------ |
| Component  | 1,2    | 3 only | 1,2       | 1 only |
| GSM        | 0-50K  | 0-50K  | 190-500   | 60-350 |
| Max Colors | 4+4    | 4+4    | 4+4       | 4+4    |
| Gripper    | 12mm   | 25mm   | 25mm      | 35mm   |

## Markup Modes

| Mode           | Plate | Paper | Afterpress | Material | Packing | Delivery |
| -------------- | ----- | ----- | ---------- | -------- | ------- | -------- |
| Standard       | 800   | 10%   | 0%         | 0%       | 0%      | 0%       |
| Profit Sharing | 1,875 | 18%   | 20%        | 25%      | 25%     | 20%      |

## System Flow

```
Login → RFQ List → Create/Edit Estimate → Select Print Type + Box Type
→ Component Specs (dimensions, paper, colors, addons)
→ Auto Calculate: Open Size → Machine → UPS → Paper Usage → 16 Cost Items → Summary
→ Save (POST /estimate/save_rfq via prepareDatatoDB)
→ Quotation → Approval (Draft → Pending → Approved/Rejected)
```

## Auth & Permissions

- Cookie-based: accessToken (15min), refreshToken (7days)
- Roles: super_admin, enable_price_check, regular
- Document status controls field editability

## Special Logic

- UV Ink: Print cost × 2.5 (Offset only)
- Reprint: Plate cost × 50% reduction
- Konica: No paper rounding, Digital DC = 5 THB/sheet
- OPP Window: Die-cut block ×2, labor ×2
- Assembly factor: 1 glue=×1.0, 2=×1.5, 3=×1.75, 4=×1.9
