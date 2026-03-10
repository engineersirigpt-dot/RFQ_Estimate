# Estimate Packaging System — Quick Reference

> ไฟล์นี้ใช้เป็น reference ให้ AI อ่านและแก้ไขระบบได้ทันทีโดยไม่ต้องทำความเข้าใจใหม่

---

## 1. ภาพรวมความสามารถของระบบ

ระบบประเมินราคางานกล่องบรรจุภัณฑ์ (Packaging Estimate) สำหรับโรงพิมพ์ รองรับ:
- กรอก Spec กล่อง (รูปแบบ, ขนาด, กระดาษ, สี, Process เสริม)
- คำนวณ Layout/UPS, Paper Usage, ต้นทุนทุกรายการ, Markup → ราคาสุดท้าย
- รองรับหลาย Qty ต่อครั้ง (main + run-on + AE + customer qty)
- รองรับงานหลาย F-code (หลายรูปแบบกล่องในงานเดียว)
- สร้าง/แก้ไข/พิมพ์ RFQ + Quotation + อนุมัติ (Draft→Pending→Approved/Reject)
- Export Excel, Print PDF
- Auth: Login → httpOnly cookie → auto refresh token

**Print Types:** Offset (Cut1/2/3), Jet Press, Flexo (ลูกฟูกเท่านั้น), Konica
**Component Types:**
- Type 1 = ไม่ประกบลูกฟูก (กล่องกระดาษธรรมดา)
- Type 2 = ประกบลูกฟูก (กระดาษ+ลูกฟูกติดกัน)
- Type 3 = เฉพาะลูกฟูก (กล่องลูกฟูกล้วน → Flexo เท่านั้น)

---

## 2. Important File Paths & Description

### Server
| Path | Description |
|------|-------------|
| `index.js` | Entry point: Express + EJS server |
| `config/default.json` | API URL, PORT (Dev) |
| `config/production.json` | API URL, PORT (Production) |

### Client — Core JS
| Path | Description |
|------|-------------|
| `public/js/function_estimate_calculation.js` | **Core Engine** (~8,800 บรรทัด) — Class `Estimate`, คำนวณทุกอย่าง |
| `public/js/function_estimate_layout.js` | Layout/UPS calculation helpers |
| `public/js/data/default.js` | **Master Config** — ค่า default ทั้งหมด (markup, tolerance, machine, packing, etc.) |
| `public/js/function_estimate_database.js` | Class `db` — เก็บ master data จาก API |
| `public/js/function_estimate_getMasterData.js` | ฟังก์ชัน helper ดึงข้อมูลจาก class `db` |
| `public/js/function_estimate_fetchData.js` | fetch API calls |
| `public/js/function_estimate.js` | Event handler bridge → เรียก class/logic |
| `public/js/function_estimate_readyFunction.js` | รวม Event Handlers ทั้งหมด |
| `public/js/function_estimate_displayData2UI.js` | แสดงผลข้อมูลบน UI |
| `public/js/function_estimate_processInfo.js` | ข้อมูล Process (diecut, chip, etc.) |
| `public/js/prepare_data.js` | แปลง `est.mainData` → payload บันทึก API (`tb_rfq_*`) |
| `public/js/commonFunction.js` | ฟังก์ชันกลางที่ใช้บ่อย |
| `public/js/documentStatusManagerClass.js` | จัดการสถานะเอกสาร (Draft/Pending/Approved/Reject) |
| `public/js/auth-interceptor.js` | Axios interceptor สำหรับ refresh token |

### Views (EJS)
| Path | Description |
|------|-------------|
| `public/index.ejs` | หน้า RFQ List (ค้นหา/กรอง/Export) |
| `public/estimate.ejs` | หน้า Estimate หลัก |
| `public/header.ejs` | include libraries/scripts |

### CLAUDE Reference Docs
| Path | Description |
|------|-------------|
| `CLAUDE/pricing_calculation_flow.md` | **สูตรคำนวณครบ** ทุกขั้นตอน [A]-[F] + parameter source |
| `CLAUDE/summary_estimate_packaging.md` | คำอธิบาย Process, Packing, Delivery, Layout, คำศัพท์ |
| `CLAUDE/machine_spec_v1.1.md` | Spec เครื่องจักรทุกรุ่น (min/max size, สี, component type) |
| `CLAUDE/master data/*.json` | ตัวอย่าง Master Data ทุกตาราง |

---

## 3. System Config & DB Config

### config/default.json / config/production.json
- `API_BASE_URL` — URL ของ backend API
- `PORT` — port ของ Express server

### public/js/data/default.js — ค่าสำคัญ
```
defaultData.machine[]              — เครื่องจักร (id, name, min/max size, max color, component_type[])
defaultData.print_type_config{}    — config ตาม print type (tolerance, gram range, color limit waste)
defaultData.tolerance{}            — bleed/gripper/color_bar/paper_edge ตาม print type
defaultData.default_marking{}      — markup rates (Standard mode)
defaultData.profit_sharing{}       — markup rates (Profit Sharing mode)
defaultData.paperband_info{}       — qty_per_paperband=100, price=0.5 THB
defaultData.kraftwrap_info{}       — limit=5kg, price=5 THB
defaultData.carton_info{}          — limit=15kg, price=5 THB, printing=3 THB, markup=15 THB
defaultData.pallet_info{}          — limit=750kg, empty_weight=25kg, height=44", mif=1,100 THB
defaultData.assembly_size{}        — S(<=9x11"), M(<=21x31"), L(>21x31")
defaultData.component_type[]       — ประเภท component (1,2,3)
```

### Database Tables (Master Data — โหลดจาก API → class db)
| Table | ใช้ใน |
|-------|-------|
| `tb_master_paper` | ราคา/แกรมกระดาษ → [C1] |
| `tb_master_std_paper` | ขนาดกระดาษมาตรฐาน (roll_width, cut_off) → [A3],[B1] |
| `machine_std_paper` | mapping เครื่อง↔กระดาษ → [A3] |
| `tb_master_price_rate` | อัตราค่าแรงตาม qty range (print, diecut, foilstamp, bossing, chip, inspection, assembly) → [E] |
| `tb_master_min_price` | ราคาขั้นต่ำตาม qty range → [E] |
| `tb_master_waste` | อัตราเสียกระดาษ (print, afterpress, coating, foilstamp, bossing, corrugated) → [B3] |
| `tb_master_jetpress_waste` | waste เฉพาะ Jet Press → [B3] |
| `tb_master_konica_waste` | waste เฉพาะ Konica → [B3] |
| `tb_master_coating` | ราคา coating (rate/sqin, min_cost) → [C5] |
| `tb_master_foilstamp` | ขนาด/ราคาม้วนฟอยล์ → [C6] |
| `tb_master_blockstamp` | ราคาบล็อค (foil=17, emboss_thin=38, emboss_thick=50 THB/sqin) → [C6],[C7] |
| `tb_master_blockdiecut` | ราคาบล็อคไดคัท → [C10] |
| `tb_master_corrugated_board` | ราคาลูกฟูกตาม grade/flute/qty → [C14] |
| `tb_master_special_ink` | ราคาหมึกพิเศษ → [C8] |
| `tb_master_jetpress_info` | ค่าพิมพ์ Jet Press ตาม std_paper_size → [C4] |

---

## 4. Input / Master Data / Default Data

### User Input (กรอกที่หน้า estimate.ejs)
```
job:
  print_type         — Offset / Jet Press / Flexo / Konica
  ink_type           — Normal / UV (UV → print cost x2.5)
  is_profit_sharing  — boolean → เปลี่ยน markup set ทั้งหมด
  is_reprinted       — งาน reprint (plate cost ลด 50%)
  is_use_previous_plate — ใช้ plate เดิม
  multiple_f         — งานหลาย F code
  mark_up_percent, mark_down_percent
  tax                — ภาษี (default 3%)
  exchange_rate      — อัตราแลกเงิน (default 1)

qty[]:               — รายการจำนวน (main, run-on, AE, customer)

component1[]:        — ชิ้นส่วนงาน (กรอกต่อ F)
  component_type     — 1/2/3
  box_type           — 1-12 (รูปแบบกล่อง → สูตร Open Size ต่างกัน)
  W, L, D            — กว้าง, ยาว, ลึก (mm)
  T, G, dust, OL     — tuck_flap, glue_flap, dust_flap, overlap (mm)
  paper_code, gram   — กระดาษ + แกรม
  outside_colors, inside_colors — จำนวนสีนอก/ใน
  coating[]          — เลือก coating + จำนวนด้าน (1/2)
  foilstamp[]        — ขนาด (inch) + สีฟอยล์ (หลายจุดได้)
  bossing[]          — ขนาด (inch) + depth (1.25/1.65 mm)
  special_ink[]      — ประเภท + style (outside/inside)
  digital_diecut     — boolean (Konica only)
  corrugated_glue    — boolean (comp type 2 only)

packing:
  paperband, kraftwrap, carton, pallet — boolean per F

delivery:
  destination        — สถานที่ส่ง
  rounds             — จำนวนรอบส่ง
```

### Box Types (1-12) → Open Size Formula
| Type | Name | Open Width | Open Length |
|------|------|-----------|------------|
| 1 | RTE | 2(W+T)+D | 2(W+L)+G |
| 2 | STE | 2(W+T)+D | 2(W+L)+G |
| 3 | TTSLB | T+W+D+W/2+OL | 2(W+L)+G |
| 4 | TTAB | T+W+D+W/2+OL | 2(W+L)+G |
| 5 | DGWS | W+4D | L+4D+2dust+2OL |
| 6 | FVT | W+4D+2dust+2OL | L+4D+2dust+2OL |
| 7 | CBT | 2(L+dust)+W | 2(L+D)+L |
| 8 | GTA | T+2D+W/2+OL | 2(W+L)+G |
| 9 | Sleeve | D | 2(W+L)+G |
| 10 | Pillow | L+D | 2W+G |
| 11 | SE | 2W+D | 2(W+L)+G |
| 12 | Custom | user input | user input |

---

## 5. UI & System Conditions

### หน้า estimate.ejs — Sections หลัก
1. **Job Info** — ชื่องาน, ลูกค้า, print type, ink type, profit sharing
2. **Qty** — กรอกจำนวน (หลาย qty ได้)
3. **Component Spec** — กรอกสเปคกล่องต่อ F
4. **Layout Result** — แสดงผล UPS, Paper Size, Layout
5. **Process Summary** — ราคาแต่ละ process
6. **Packing & Delivery**
7. **Total Price Summary**

### เงื่อนไขสำคัญของระบบ
- **Readonly:** เอกสาร Approved/Pending → ฟิลด์ส่วนใหญ่ readonly ตาม role
- **Jet Press:** ไม่รองรับ Special Ink / กระดาษ 250-600 gsm เท่านั้น
- **Flexo:** Component Type 3 เท่านั้น / สีไม่เกิน 2 สี
- **Konica:** Component Type 1 เท่านั้น / ไม่ปัดขึ้น 100 แผ่น / Digital Die-cut = 5 THB/แผ่น
- **OPP Window Coating:** die-cut block x2, labor x2 (process_id 36, 51)
- **UV Ink:** ค่าพิมพ์ x2.5 (Offset เท่านั้น)
- **Assembly Factor:** 1 จุดกาว=x1.0, 2=x1.5, 3=x1.75, 4=x1.9
- **Reprint Plate:** ลดราคา 50%
- **Konica paper_net:** ไม่ปัดขึ้นหาร 100 (ต่างจาก Offset/Flexo/JetPress)
- **Profit Sharing Min Markup:** 5,000 THB (Standard = 0)
- **formula_value = 1,550,000** (hardcoded ค่าคงที่แปลงหน่วย gsm→kg)

### Machine Selection Logic (Offset)
1. Default → Cut 2 (id=2)
2. หา std paper ที่ match open_size+offset (W+1.04", L+0.57")
3. ถ้าไม่เจอใน Cut 2 → ลอง machine อื่น
4. ถ้าไม่เจอเลย → machine แรก + max size
- สี > 6 + ใบพิมพ์ > 1,000 → Cut 1 ก่อน
- สี <= 4 + ใบพิมพ์ > 5,000 → Cut 2 ก่อน
- ใบพิมพ์ < 1,000 Offset → พิจารณา Jet Press

---

## 6. Calculation Priority (Pipeline)

```
[INPUT] spec + qty
    ↓
[A1] Open Size  (สูตรตาม box_type 1-12)
    ↓
[A2] Tolerance  (gripper + color_bar + paper_edge + bleed ตาม print_type)
    ↓
[A3] Machine + Std Paper Selection
    ↓
[A4] UPS (max ของ 4 layouts: Straight/Overlap x Vertical/Horizontal)
    ↓
[B1] Split = floor(roll_width/paperW) x floor(cut_off/paperL)
[B2] after_ups = ceil(qty / UPS)
[B3] Waste (print + afterpress + coating + foil + bossing + corrugated + color_limit)
[B4] paper_net = ceil(ceil((after_ups+waste)/split)/100)x100
     tons = paper_net x gram / 1,550,000 x roll_width x cut_off / 1000
    ↓
COST CALCULATION (เรียงลำดับ):
[C1]  Paper      = paper_net x unit_price x (1 + paper_markup%)
[C2]  Plate      = colors x qty_100k x plate_price (Offset=800/สี, PS=1,875/สี | Flexo=6.53 THB/sqin)
[C3]  Proof      = 500 THB (Offset/Flexo/Jet) | 200 THB (Konica)
[C4]  Print      = setPriceRate(type, after_ups) x colors x sig [UV x2.5]
                   [PS mode: after_ups x 0.14, min 1,400 THB]
[C5]  Coating    = paper_print x layW x layL x rate x sides x afterpress_markup%
[C6]  Foil Stamp = labor + foil_roll + block (17 THB/sqin)
[C7]  Bossing    = labor + block (38/50 THB/sqin) + film (1.25 THB/sqin)
[C8]  Special Ink= qty_can x price x material_markup%
[C9]  Assembly   = setPriceRate(size, qty) x factor(glue_points) x afterpress_markup%
[C10] Die-cut    = block(setBlockDiecutRate2) + labor(setPriceRate) x afterpress_markup%
[C11] Digital DC = 5 THB x after_waste x afterpress_markup% (Konica only)
[C12] Chip       = setPriceRate('chip', totalQty) x afterpress_markup%
[C13] Inspection = setPriceRate('inspection', totalQty) x afterpress_markup%
[C14] Corrugated = rate/144 x (1+corrugated_markup%) x flute_side x cut_off
      Glue       = flute_side x cut_off x 0.0015 x qty x afterpress_markup%
[C15] Packing    = paperband + kraftwrap + carton + pallet (ตาม config weight limit)
[C16] Delivery   = lookup rate(destination, net_weight) → จำนวนรถ × ราคาต่อรถ × (1+delivery_markup%)
                   [database: delivery_rate — ตาม destination + ช่วงน้ำหนัก]
    ↓
[D]  Total Price
     subtotal = C1+C2+...+C16 + other_cost
     total_after_markup = subtotal x (1+markup%) x (1-markdown%)
     [PS] marking = max(total x 5%, 5,000 THB)
     tax_amount = total x 3%
     grand_total = (total + tax) x exchange_rate
```

### Markup Rates Summary
| Rate | Standard | Profit Sharing |
|------|----------|----------------|
| paper_markup | 10% | 18% |
| import_paper_markup | 13% | — |
| afterpress_markup | 0% | 20% |
| material_markup | 0% | 25% |
| outsource_markup | 0% | 25% |
| packing_markup | 0% | 25% |
| delivery_markup | 0% | 20% |
| corrugated_markup | 10% | 20% |
| total_price_markup | 0% | 5% (min 5,000 THB) |
| addon_labor_markup | 20% | 20% |
| plate_price | 800 THB/color | 1,875 THB/color |
| tax | 3% | 3% |

### setPriceRate [E] — ระบบ Rate Lookup
```
input: (type, qty)  →  lookup tb_master_price_rate ตาม qty range
types: print_1col, print_3col, print_5col, print_flexo, diecut,
       foilstamp, bossing, chip, inspection, assembly_S, assembly_M, assembly_L, trim
→ return { unit_price, min_price }  (ใช้ min_price ถ้า qty x unit_price < min_price)
```

---

## 7. Data Flow — Save/Load

```
Save:
  est.mainData  →  prepare_data.js  →  API POST  →  tb_rfq_*, tb_rfq_component*, tb_rfq_process*, ...

Load:
  API GET  →  function_estimate_fetchData.js  →  est.mainData  →  displayData2UI
```

**Document Status Flow:** Draft → Pending → Approved / Reject

---

## 8. Diagram Overview (สำหรับแก้ไข drawio)

```
[กรอก Spec]
  box_type + W,L,D,T,G  |  print_type  |  paper+gram  |  colors  |  optional process
      ↓
[A] Layout Engine
  Open Size (สูตรตาม box_type) → +Tolerance → Machine Selection → Std Paper → UPS
      ↓
[B] Paper Usage
  after_ups=ceil(qty/UPS) → Waste(print+afterpress+process) → paper_net → tons
      ↓
[C] Cost Items C1→C16
  Paper | Plate | Proof | Print | Coating | Foil | Bossing | SpecialInk
  Assembly | Diecut | DigitalDiecut | Chip | Inspection | Corrugated | Packing | Delivery
      ↓
[D] Total Price
  subtotal → markup/markdown → [PS marking] → tax 3% → grand_total
      ↓
[Output] Save RFQ / Print PDF / Export Excel / Create Quotation
```
