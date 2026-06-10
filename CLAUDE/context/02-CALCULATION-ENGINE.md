# 02 — Calculation Engine (หัวใจของระบบ)

การคำนวณราคา **ทำงานฝั่ง browser ทั้งหมด** ในคลาส `Estimate`
ไฟล์หลัก: `public/js/function_estimate_calculation.js` (~8,850 บรรทัด)

> รายละเอียดสูตรลึกสุดอยู่ที่ `CLAUDE/pricing_calculation_flow.md` (48KB) — ไฟล์นี้คือแผนที่ว่า logic อยู่ตรงไหน

## คลาส Estimate

- **Constructor (บรรทัด 42-46):** init `mockupData`, `mockupData2`
- กิน `mainData` (โครงสร้างเต็มดู `03-FRONTEND.md`) — มี job, qty, component1[], material[], process[], packing, delivery[], totalprice[]
- ราคาออกมาเป็น **array ต่อระดับจำนวน** (`mainData.qty.main[]` → `mainData.totalprice[index]`)

## Calculate Pipeline — ลำดับการทำงาน

Entry หลักผ่าน `setCalculatePrice()` (เรียกใน `function_estimate.js` ~บรรทัด 641):

**Prerequisite ต่อ component (รันก่อนคิดต้นทุน):**
1. `setCalculateLayout(index)` (บรรทัด 1924) — เลือกเครื่อง + วาง layout บนแผ่น
2. `setCalculateUps(index)` (บรรทัด 3427) — คำนวณ UPS (ชิ้น/แผ่น) → `setCalculatePaperWeight()` → `setCalculatePackingCost()`

**คิดต้นทุนรวม:**
3. `setCalculateDeliveryPrice()` (8569) — เรตขนส่ง/รถ
4. `setCalculateComponentMaterialCost()` (6865)
5. `setCalculateProcessCost()` (6631) — process กำหนดเอง
6. `setCalculateMaterialCost()` (6577)
7. `setCalculateOtherCostCost()` (6702)
8. `setCalculateChipCost()` (6812) — chip/เศษ
9. `setCalculateInspectionCost()` (7079) — ค่าตรวจ
10. `setCalculateTotalPrice(arrObjMarking)` (7389) — **รวมยอดหลัก**
11. `setCalculateTax()` (7941) — VAT + profit sharing

## 16 Cost Items (C1–C16)

> **สำคัญ:** การจับคู่หมายเลข C# ↔ ชื่อใน CLAUDE.md เก่า **ไม่ตรง** กับชื่อ method เป๊ะ ให้ยึด "ชื่อ method + บรรทัด" ด้านล่างเป็นความจริง (เพราะเทียบจากโค้ดจริง)

หมวดตาม CLAUDE.md เก่า: C1-Paper, C2-Plate, C3-Proof, C4-Print, C5-Coating, C6-Foil Stamp, C7-Bossing, C8-Special Ink, C9-Assembly, C10-Die-cut, C11-Digital DC, C12-Chip, C13-Inspection, C14-Corrugated, C15-Packing, C16-Delivery

**Method ในโค้ด (file:line):**

| รายการ | method | บรรทัด |
|--------|--------|--------|
| Paper | `setCalculatePaperCost()` | 3573 |
| Corrugated | `setCalculateCorrugatedBoard()` | 6047 |
| Special Ink | `setCalculateSpecialInkCost()` | 6757 |
| Material | `setCalculateMaterialCost()` | 6577 |
| Plate | `setCalculatePlateCost()` | 3621 |
| Proof | `setCalculateProofCost()` | 3990 (Jet Press/Konica) |
| Print | `setCalculatePrintCost()` | 3798 |
| Coating | `setCalculateCoatingCost()` | 5967 |
| Foil Stamp | `setCalculateFoilStampCost()` | 6333 |
| Bossing (emboss) | `setCalculateBossingCost()` | 6456 |
| Assembly | `setCalculateAssemblyCost()` | 6943 |
| Die-cut | `setCalculateDieCutCost()` | 6981 |
| Carton | `setCalculateCartonCost()` | 4741 |
| Kraft Wrap | `setCalculateKraftwrapCost2()` | 5517 |
| Pallet | `setCalculatePalletCost()` | 5261 |
| Paperband | `setCalculatePaperbandCost()` | 4454 |
| Delivery | `setCalculateDelivery()` 7331 / `setCalculateDeliveryPrice()` 8569 |

## Box Types (12 ชนิด) + Open Size

Logic อยู่ใน **`public/js/function_estimate_layout.js`**
- `setCalculateWSide()` (บรรทัด 43) + `setCalculateLSide()` (บรรทัด 106) — คำนวณขนาดกาง (open size) จากขนาดกล่อง
- `switch(templateId)` 12 case (บรรทัด 252-334) — แต่ละ case มีหลายสูตรย่อยตามตำแหน่ง flap/glue
- ตัวแปร: w=กว้าง, l=ยาว, d=ลึก, t=tuck, dust, g=glue flap, ol=overlap, b=bleed

สูตร box type (จาก CLAUDE.md):

| Type | ชื่อ | สูตร |
|------|------|------|
| 1 | RTE | W=2(W+T)+D, L=2(W+L)+G |
| 2 | STE | W=2(W+T)+D, L=2(W+L)+G |
| 3 | TTSLB | W=T+W+D+W/2+OL, L=2(W+L)+G |
| 4 | TTAB | W=T+W+D+W/2+OL, L=2(W+L)+G |
| 5 | DGWS | W=W+4D, L=L+4D+2dust+2OL |
| 6 | FVT | W=W+4D+2dust+2OL, L=L+4D+2dust+2OL |
| 7 | CBT | W=2(L+dust)+W, L=2(L+D)+L |
| 8 | GTA | W=T+2D+W/2+OL, L=2(W+L)+G |
| 9 | Sleeve | W=D, L=2(W+L)+G |
| 10 | Pillow | W=L+D, L=2W+G |
| 11 | SE | W=2W+D, L=2(W+L)+G |
| 12 | Custom | ผู้ใช้กำหนดเอง |

## UPS & Layout Optimization (`function_estimate_layout.js`)

- `setCalculateLayout()` (1924): หาเครื่องที่ใช้ได้ → คำนวณ layout เป็นไปได้ (1×n, 2×n, ...) → เลือกที่เสียกระดาษน้อยสุด/ตรงกับงาน → เก็บ machine id, UPS, layout ใน `component.paper_usage`
- `setCalculateUps()` (3427): UPS = ชิ้นต่อแผ่น
- **Tolerance/Gripper** `setLayoutTolerance()` (บรรทัด ~3-41):
  - Offset (type 1,2): gripper 12 + color_bar 8 = 20mm ด้านสั้น, bleed×2 = 8mm ด้านยาว
  - Flexo/Digital (type 3): gripper 25 + color_bar + bleed×2 = 28mm

## Special-case Logic (สำคัญ — มักถามถึง)

| เคส | logic | ตำแหน่ง |
|-----|-------|---------|
| **UV Ink** | print cost × **2.5** (เคย 4→3→2.5) เฉพาะ Offset | `ink_factor=2.5` บรรทัด 3844-3848, ใช้ที่ 3897-3901 |
| **Reprint** | ถ้าใช้เพลทเดิม → plate cost **−50%** | บรรทัด 3658-3660 (`reprintReducePlateCostPercent`) |
| **Konica** | process_id 56, ไม่ปัดเศษกระดาษ, Digital DC = 5 บาท/แผ่น, ต้องมี proof | บรรทัด 3861-3865, 3905 |
| **Assembly factor** | 1 จุดกาว ×1.0, 2 ×1.5, 3 ×1.75, 4 ×1.9 — ตามขนาด S/M/L | `getAssemblyFactor()` 1090-1096, 1185-1197 |
| **OPP Window** | die-cut block ×2, labor ×2 (process_id 36/51) | 6991-6998, ใช้ที่ 7009 |
| **Print process_id** | Offset=2, Flexo=37, Jet Press=44, Konica=56 | — |

## การรวมยอด & ราคาสุดท้าย (`setCalculateTotalPrice` บรรทัด 7389-7788)

**รวมต้นทุน 2 กลุ่ม:**
- `sub_total_price_material` = paper + corrugated + special_ink + material
- `sub_total_price_production` = plate + print + proof + afterpress + block + delivery + other

**Markup/Markdown** — System v3.1+ คิด marking แยก material/production:
- `total_price = setPriceAfterMarking(total, markup% − markdown%)`
- บวก `price_diff` + `customer_gift`
- ถ้า `checkSystemVersion(3.1)` → ใช้ `total_price_marking_material_production`

**Profit Sharing** (7956-7980):
```
profit_sharing = max(min_บาท, total_with_price_diff × percent/100)
total_with_ps = total_with_price_diff + profit_sharing
```

**Tax** `setCalculateTax()` (7941):
```
tax = total_with_ps × tax%/100   (tax default = 3)
final_price = total_with_ps + tax
unit_price = final_price / qty.main[index]
unit_price_exchange = unit_price / exchange_rate
```

## Markup Modes (จาก CLAUDE.md / default.js)

| Mode | Plate | Paper | Afterpress | Material | Packing | Delivery |
|------|-------|-------|------------|----------|---------|----------|
| Standard | 800 | 10% | 0% | 0% | 0% | 0% |
| Profit Sharing | 1,875 | 18% | 20% | 25% | 25% | 20% |

## Print Types & ข้อจำกัด

| Feature | Offset | Flexo | Jet Press | Konica |
|---------|--------|-------|-----------|--------|
| Component | 1,2 | 3 only | 1,2 | 1 only |
| GSM | 0-50K | 0-50K | 190-500 | 60-350 |
| Max Colors | 4+4 | 4+4 | 4+4 | 4+4 |
| Gripper | 12mm | 25mm | 25mm | 35mm |

## ProcessInfoBuilder (`function_estimate_processInfo.js`)

คลาส `ProcessInfoBuilder(estimateInstance)` — ผูกต้นทุนแต่ละก้อนเข้ากับ **process_id ใน DB** เพื่อออกใบ/ไป invoice
- หมวด: material/plate/proof/print/process/packing
- process_id อ้างอิง: Paper 73, Corrugated 145, Special Ink 78, Plate 74, Print 76, Coating 34, Foilstamp 35, Emboss 36, Diecut 3, Assembly 104, Trim 2, Delivery 60, Carton 40, Kraft 39, Pallet 41, Paperband 38
- method: `addPaperProcess()`, `addCoatingProcess()`, `addDieCutProcess()`, `addTrimProcess()` (955), `addDeliveryProcess()`, `addPackingProcess()`
- **commit ล่าสุด:** split delivery emit ต่อ round, `addDeliveryProcess` เรียกหลัง `addTrimProcess`, Carton label, corrugated pid 103, label gate `isDiffPacking`
