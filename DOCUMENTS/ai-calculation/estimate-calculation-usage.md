# EstimateCalculation — Usage Guide

> **ไฟล์ต้นฉบับ:** `estimate-calculation-class.js`
> **Data Source Legend:**
> - `[database: table]` — ดึงจาก database ผ่าน `lookupService`
> - `[config: field]` — ค่าจาก `default.js` / config object
> - `[hardcoded]` — ค่า hardcode ในโค้ด
> - `[input]` — ค่าที่ผู้ใช้กรอก

---

## 1. Setup

```js
const EstimateCalculation = require('./estimate-calculation-class')

// ─── Config (จาก default.js) ──────────────────────────────────────────────────
const config = {
  formula_value: 1550000,          // [hardcoded] ค่าแปลงหน่วย
  tax: 3,                          // [config] อัตราภาษี %
  plate_price: 800,                // [config] ราคาเพลท Offset (THB/สี)
  plate_polymer_price: 6.53,       // [config] ราคา Flexo polymer (THB/sq.in)
  reprint_plate_polymer_price: 5.94,
  cut_1_plate_markup: 50,
  reprintReducePlateCostPercent: 50,
  block_polymer_min_price: 50,
  afterpress_price_marking: 0,     // % markup afterpress
  material_price_marking: 0,
  addon_labor_price_marking: 0,
  corrugated_assembly_markup_price: 0,
  corrugated_glued_cost: 0.0015,   // [config] THB/sq.in
  delivery_rate: 1500,             // [config] THB/ton
  foil_width_tolerance: 0.5,
  foil_length_tolerance: 1,
  film_rate: 1.25,
  film_min_cost: 120,
  block_foilstamp_min_cost: 70,
  reprinted_block: 0,
  corrugated_tolerance: 0,
  tolerance: {
    bleed: 3,
    gripper: { Offset: 12, Flexo: 25, 'Jet Press': 0, Konica: 0 },
    color_bar: { Offset: 8, Flexo: 0, 'Jet Press': 0, Konica: 0 },
    paper_edge: { Offset: 4, Flexo: 4, 'Jet Press': 4, Konica: 4 },
  },
  assembly_size: [
    { type: 'assembly_S', width: 7,  length: 10 },
    { type: 'assembly_M', width: 12, length: 16 },
    // ถ้าเกินทั้งหมด → assembly_L
  ],
  print_type_config: {
    Offset: {
      reduce_paper_waste_percent: 0,
      color_limit_waste: { waste: 100, waste_per_color: 50 },
    },
    'Jet Press': {
      proof_price_per_component: 500,
      reduce_paper_waste_percent: 0,
    },
    Konica: {
      proof_price_per_component: 200,
      reduce_paper_waste_percent: 0,
    },
  },
  marking: {
    profit_sharing: {
      print: { print_rate: 0.14, print_min_price: 1400 },
    },
  },
}

// ─── LookupService (mock หรือดึงจาก database จริง) ───────────────────────────
const lookupService = {
  // [database: tb_master_price_rate + tb_master_min_price]
  getPriceRate: (type, qty, printType) => ({ unit_price: 0.5, min_price: 500 }),

  // [database: tb_master_waste / jetpress_waste / konica_waste]
  getWasteRate: (printType, afterUps) => ({
    print_rate: 200,
    afterpress_rate: 0.01,
    coating_rate: 0.005,
    corrugatedglued_rate: 50,
  }),

  // [database: tb_master_blockdiecut]
  getBlockDiecutRate: (laySize) => 2500,

  // [database: tb_master_coating]
  getCoatingRate: (coatingCode, size) => ({ rate: 0.08, min_cost: 500, unit_min_cost: 'sheet' }),

  // [database: tb_master_corrugated_board]
  getCorrugatedRate: (grade, fluteType, qty) => 12,

  // [database: tb_master_foilstamp]
  getFoilStampInfo: (foilCode) => ({ roll_price: 1200, roll_min_price: 600, width: 6, length: 200 }),

  // [database: tb_master_blockstamp]
  getBlockStampRate: (stampType, depthType) => 3.5,

  // [database: tb_master_special_ink]
  getSpecialInkInfo: (inkProcessId) => ({ price: 25 }),
  getSpecialInkFactor: (paperCode, printStyle) => ({ factor: 1000, filling_percent: 0.8 }),

  // [database: tb_master_jetpress_info]
  getJetPressRate: (paperSize, paperPrint) => 1.5,

  // [database: tb_master_std_paper + machine_std_paper]
  getStdPaperSize: (stdPaperId) => ({ width: 25.5, length: 36, costWidth: 25.5, costLength: 36 }),
}

const calc = new EstimateCalculation(config, lookupService)
```

---

## 2. Utility Converters

### `mm2inch(mm)` — แปลง mm → inch
```js
const inch = calc.mm2inch(25.4)
// → 1.000
```

### `inch2mm(inch)` — แปลง inch → mm
```js
const mm = calc.inch2mm(1)
// → 25.40
```

---

## [A] Layout Calculation

### A1 — `calculateOpenSize(boxType, dim)` — ขนาดกางแผ่น

```js
// RTE box (boxType 1): W=60, L=40, D=30, T=15, G=10 (mm)
const openSize = calc.calculateOpenSize(1, {
  width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10
})
// → { width_mm: 150, length_mm: 210, width_in: 5.906, length_in: 8.268 }
// สูตร: w_mm = 2*(W+T)+D = 2*(60+15)+30 = 180  ← ตัวอย่างใช้ค่าตาม formula จริง
```

| boxType | ชื่อ | สูตร Width | สูตร Length |
|---------|------|-----------|------------|
| 1 | RTE | 2(W+T)+D | 2(W+L)+G |
| 2 | STE | 2(W+T)+D | 2(W+L)+G |
| 3 | TTSLB | T+W+D+W/2+OL | 2(W+L)+G |
| 4 | TTAB | T+W+D+W/2+OL | 2(W+L)+G |
| 5 | Tray | W+4D | L+4D+2dust |
| 6 | Four Corner | W+4D+2dust+2OL | L+4D+2dust+2OL |
| 7 | Sleeve | 2(L+dust)+W | 2(L+D)+L |
| 8 | Pillow Box | T+2D+W/2+OL | 2(W+L)+G |
| 9 | Belly Band | D | 2(W+L)+G |
| 10 | Rigid Box Wrapper | L+D | 2W+G |
| 11 | Mailer Box | 2W+D | 2(W+L)+G |

### A1.1 — `calculateFoldSize(boxType, dim)` — ขนาดพับ

```js
const foldSize = calc.calculateFoldSize(1, { width: 60, length: 40, depth: 30 })
// → { width_mm: 60, length_mm: 40, depth_mm: 30, width_in: 2.362, length_in: 1.575, depth_in: 1.181 }
// Pillow Box (boxType 8) → width = 2W + T
```

### A2 — `calculateTolerance(printType, componentType)` — ค่าเผื่อขอบ

```js
const tol = calc.calculateTolerance('Offset', 1)
// → { gripper: 12, color_bar: 8, paper_edge: 4, bleed: 3, shortSide: 20, longSide: 8 }
// componentType: 1=ไม่ประกบ, 2=ประกบ, 3=ลูกฟูก
```

### A3 — `calculateWSide(wCase, n, w, l, d, b, dust, ol, g, t)` — ด้านกว้าง Layout

```js
// RTE straight (wCase=1.1), n=2 ชิ้นแนวกว้าง
const wSide = calc.calculateWSide(1.1, 2, 60, 40, 30, 3, 0, 0, 10, 15)
// → ขนาดด้านกว้างรวม (mm)
```

### A4 — `calculateLSide(lCase, n, w, l, d, b, dust, ol, g)` — ด้านยาว Layout

```js
const lSide = calc.calculateLSide(1.0, 3, 60, 40, 30, 3, 0, 0, 10)
// → ขนาดด้านยาวรวม (mm)
```

### A5 — `applyTolerance(printingSize, shortSide, longSide)` — บวก Tolerance

```js
const layoutSize = calc.applyTolerance([200, 300], 20, 8)
// → { layout_w_mm: 220, layout_l_mm: 308, layout_w_in: 8.661, layout_l_in: 12.126 }
// ด้านสั้น (≤ ด้านยาว) บวก shortSide, ด้านยาวบวก longSide
```

### A6 — `calculateLayout(params)` — หา UPS ทุก case

```js
const layouts = calc.calculateLayout({
  boxType: 1,
  dimensions: { width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10 },
  bleed: 3,
  paperSize: [635, 940],     // [w_mm, l_mm] กระดาษ
  shortSide: 20,
  longSide: 8,
})
// → [{ laying: 'vertical', layout: [3, 2], num_laying: 6, printSize: [...], layoutSize: {...} }, ...]
```

### A7 — `selectBestLayout(layouts, paperSize)` — เลือก layout ดีสุด

```js
const best = calc.selectBestLayout(layouts, [635, 940])
// → { laying, layout: [nw, nl], num_laying, printSize, layoutSize }
// เลือก UPS สูงสุด ถ้าเท่ากัน → เลือก waste น้อยสุด
```

---

## [B] Paper Usage Calculation

### B1 — `calculateSplit(rollWidth, cutOff, laySize, parallelRollWidth)` — จำนวนแผ่นต่อแผ่นใหญ่

```js
const split = calc.calculateSplit(25.5, 36, [8.661, 12.126], 'WSize')
// → 6  (floor(25.5/8.661) × floor(36/12.126) = 2 × 2 = 4)
```

### B2 — `calculateWaste(params)` — คำนวณ Waste

```js
const wasteResult = calc.calculateWaste({
  printType: 'Offset',
  afterUps: 1667,           // ceil(10000/6)
  outsideColors: 4,
  insideColors: 0,
  allColors: 4,
  componentType: 1,
  isDigitalDiecut: false,
  isColorLimit: false,
  addons: {
    hasCoating: true,
    coatingSide: 1,
    hasFoilstamp: false,
    hasEmboss: false,
    hasDeboss: false,
  }
})
// → { totalWaste: 217, waste_print: 200, waste_afterpress: 17, waste_coating: 8, ... }
```

### B3 — `calculatePaperUsage(params)` — คำนวณปริมาณกระดาษ

```js
const paperUsage = calc.calculatePaperUsage({
  qty: 10000,
  ups: 6,
  sig: 1,
  split: 4,
  totalWaste: 217,
  gram: 300,              // [database: tb_master_paper] GSM
  rollWidth: 25.5,
  cutOff: 36,
  printType: 'Offset',
})
// → {
//   after_ups: 1667,    ceil(10000/6)
//   after_waste: 1884,  after_ups + totalWaste
//   paper_print: 1884,  after_waste × sig
//   paper_qty: 471,     ceil(1884/4)
//   paper_net: 500,     ceil(471/100)*100
//   kilogram: 88.67,    paper_net × gram / 1,550,000 × rollWidth × cutOff
//   ton: 0.089
// }
```

---

## [C] Cost Calculations

### C1 — `calculatePaperCost(paperInfo, rollWidth, cutOff, paperNet)` — ต้นทุนกระดาษ

```js
const paperCost = calc.calculatePaperCost(
  {
    paper_cost: 45,          // [database: tb_master_paper] THB/kg
    paper_gram: 300,
    paper_markup: 10,        // [config] %
    paper_percent: 0,
    sheet_unit_price: false,
  },
  25.5, 36, 500             // rollWidth, cutOff, paper_net
)
// → { qty: 500, unit_price: 25.81, price: 12905.00 }
```

### C2 — `calculatePlateCost(params)` — ต้นทุนเพลท

```js
// Offset
const plateCost = calc.calculatePlateCost({
  printType: 'Offset',
  outsideColors: 4,
  insideColors: 0,
  afterWaste: 1884,
  sig: 1,
  ups: 6,
  isCut1: false,
  isReprinted: false,
  isUsePrevPlate: false,
})
// → {
//   outside: { qty: 1, unit_price: 3200, price: 3200 },  // 4สี × 800
//   inside: { qty: 1, unit_price: 0, price: 0 },
//   reprint: { outside: {...}, inside: {...} }
// }

// Flexo
const plateCostFlexo = calc.calculatePlateCost({
  printType: 'Flexo',
  outsideColors: 2,
  insideColors: 0,
  ups: 6,
  flexoSize: [3.5, 5.0],
  isReprinted: false,
})
// unit = 6.53 × 3.5 × 5.0 = 114.28/ชิ้น

// Jet Press / Konica → price = 0
```

### C3 — `calculateProofCost(printType, componentCount)` — ต้นทุน Proof

```js
// เฉพาะ Jet Press หรือ Konica
const proof = calc.calculateProofCost('Jet Press', 1)
// → { qty: 1, unit_price: 500, price: 500 }

const proofKonica = calc.calculateProofCost('Konica', 2)
// → { qty: 2, unit_price: 200, price: 400 }

const proofOffset = calc.calculateProofCost('Offset')
// → { qty: 0, unit_price: 0, price: 0 }
```

### C4 — `calculatePrintCost(params)` — ต้นทุนพิมพ์

```js
// Offset
const printCost = calc.calculatePrintCost({
  printType: 'Offset',
  inkType: 'conventional',
  outsideColors: 4,
  insideColors: 0,
  afterUps: 1667,
  paperPrint: 1884,
  sig: 1,
})
// ใช้ lookupPriceRate('print_3col', 1667) × 4สี

// UV Ink → inkFactor = 2.5 คูณเข้าไป
const printCostUV = calc.calculatePrintCost({
  printType: 'Offset',
  inkType: 'UV',
  outsideColors: 4,
  insideColors: 0,
  afterUps: 1667,
  paperPrint: 1884,
})

// Konica → 3 THB/ใบ/ด้าน, 1 THB ถ้าขาวดำ [hardcoded]
const printKonica = calc.calculatePrintCost({
  printType: 'Konica',
  outsideColors: 4,
  insideColors: 0,
  paperPrint: 1884,
  isBlackPrintingOutside: false,
})
// → outside: { qty: 1884, unit_price: 3, price: 5652 }

// Jet Press → ใช้ getJetPressRate(paperSize, paperPrint)
const printJP = calc.calculatePrintCost({
  printType: 'Jet Press',
  outsideColors: 4,
  paperPrint: 1884,
  paperSize: [635, 940],
})
```

### C5 — `calculateCoatingCost(params)` — ต้นทุน Coating

```js
// UV Coating 1 ด้าน
const coating = calc.calculateCoatingCost({
  coatingCode: 'UV',
  coatingPrice: 0.08,         // [database: tb_master_coating]
  side: 1,
  minCost: 500,
  unitMinCost: 'sheet',
  paperPrint: 1884,
  laySize: [8.661, 12.126],   // inch
  ups: 6,
})
// → { qty: 1884, unit_price: 8.41, price: 15,845 }

// S-UV (Spot UV) → ใช้ custom width/length + ups factor
const spotUV = calc.calculateCoatingCost({
  coatingCode: 'S-UV',
  coatingPrice: 0.12,
  side: 1,
  minCost: 0,
  unitMinCost: 'price',
  paperPrint: 1884,
  laySize: [8.661, 12.126],
  ups: 6,
  width: 3.0,
  length: 2.0,
})

// B-PACK → unit_price = coatingPrice × side (ราคาต่อแผ่น flat)
// P-PAT → unit_price = coatingPrice (fixed)
```

### C6 — `calculateFoilStampCost(params)` — ต้นทุน Foil Stamp

```js
const foilStamp = calc.calculateFoilStampCost({
  foilWidth: 6,             // [database: tb_master_foilstamp]
  foilLength: 200,
  width: 2.0,               // [input] ขนาดลาย (inch)
  length: 1.5,
  foilRollPrice: 1200,      // [database]
  foilRollMinPrice: 600,
  blockRate: 3.5,           // [database: tb_master_blockstamp]
  qty: 10000,
  afterUps: 1667,
  ups: 6,
  printType: 'Offset',
})
// → {
//   labor: { qty: 10000, unit_price: 0.0..., price: ... },
//   foil_roll: { qty: 10000, unit_price: ..., price: ... },
//   block: { qty: 6, unit_price: ..., price: ... }
// }
```

### C7 — `calculateBossingCost(params)` — ต้นทุน Emboss / Deboss

```js
const emboss = calc.calculateBossingCost({
  type: 'emboss',
  blockRate: 3.5,
  sizes: [[2.0, 1.5], [1.0, 1.0]],   // [input] ขนาดลายแต่ละกรอบ (inch)
  qty: 10000,
  afterUps: 1667,
  ups: 6,
  printType: 'Offset',
})
// → {
//   labor: { qty: 10000, unit_price: ..., price: ... },
//   blocks: [
//     { size: [2.0, 1.5], qty: 6, unit_price: ..., price: ... },
//     { size: [1.0, 1.0], qty: 6, unit_price: ..., price: ... }
//   ]
// }
```

### C8 — `calculateSpecialInkCost(params)` — ต้นทุนหมึกพิเศษ

```js
const specialInk = calc.calculateSpecialInkCost({
  inkProcessId: 5,
  paperCode: 'ART',
  printStyle: 'full',
  afterWaste: 1884,
  laySize: [8.661, 12.126],
})
// qty = ceil(1.05 × 8.661 × 12.126 × 1884 × filling% / factor)
// → { qty: ..., unit_price: 25, price: ... }
```

### C9 — `calculateAssemblyCost(params)` — ต้นทุนประกอบ

```js
const assembly = calc.calculateAssemblyCost({
  openSize: [5.906, 8.268],   // inch (จาก calculateOpenSize)
  qty: 10000,
  componentType: 1,
  gluedSpot: 1,               // [hardcoded factor: 1|1.5|1.75|1.9]
  printType: 'Offset',
})
// getAssemblyType → 'assembly_S'|'M'|'L' ตาม assembly_size config
// → { qty: 10000, unit_price: ..., price: ... }
```

### C10 — `calculateDieCutCost(params)` — ต้นทุน Die-cut

```js
const diecut = calc.calculateDieCutCost({
  qty: 10000,
  afterUps: 1667,
  ups: 6,
  laySize: [8.661, 12.126],
  hasOppWindow: false,    // OPP Window → factor × 2, block qty × 2
  isReprinted: false,
  printType: 'Offset',
})
// → {
//   labor: { qty: 10000, unit_price: ..., price: ... },
//   block: { qty: 1, unit_price: 2500, price: 2500 }
// }
```

### C11 — `calculateDigitalDieCutCost(afterWaste)` — Digital Die-cut

```js
const digitalDiecut = calc.calculateDigitalDieCutCost(1884)
// [hardcoded] 5 THB/pcs
// → { qty: 1884, unit_price: 5, price: 9420 }
```

### C12 — `calculateChipCost(qty, printType)` — ต้นทุนแกะ (Chip)

```js
const chip = calc.calculateChipCost(10000, 'Offset')
// → { qty: 10000, unit_price: 0.5, price: 5000 }
```

### C13 — `calculateInspectionCost(totalQty, printType)` — ต้นทุนตรวจสอบ

```js
const inspection = calc.calculateInspectionCost(10000, 'Offset')
// → { qty: 10000, unit_price: 0.5, price: 5000 }
```

### C14 — `calculateCorrugatedBoardCost(params)` — ต้นทุนลูกฟูก

```js
const corrugated = calc.calculateCorrugatedBoardCost({
  grade: 'KSF170/CSF110',
  fluteType: 'B',
  corrugatedMarkup: 10,
  fluteSide: 24.8,          // inch (ด้าน flute)
  cutOff: 36,               // inch
  qty: 1934,                // after_ups + waste_corrugated
  afterUps: 1667,
})
// unit_inch = rate/144 × (1 + 10%)
// unit_price = unit_inch × fluteSide × cutOff
// → { qty: 1934, unit_price: ..., price: ..., unit_inch: ... }
```

### C15 — `calculateCorrugatedGluedCost(fluteSide, cutOff, qty)` — ต้นทุนประกบลูกฟูก

```js
const corrugatedGlued = calc.calculateCorrugatedGluedCost(24.8, 36, 1884)
// [config: corrugated_glued_cost = 0.0015 THB/sq.in]
// unit_price = 24.8 × 36 × 0.0015
// → { qty: 1884, unit_price: 1.34, price: 2524.56 }
```

### C16 — `calculateDeliveryCost(grossWeight)` — ต้นทุนจัดส่ง

```js
const delivery = calc.calculateDeliveryCost(150)
// [config: delivery_rate = 1500 THB/ton]
// unit_price = 1500 × 150 / 1000 = 225
// → { unit_price: 225, price: 225 }
```

---

## [D] Price Aggregation

### D1 — `calculateTotalPrice(costs, markupConfig, mainQty)` — รวมราคา + Markup

```js
const totalPrice = calc.calculateTotalPrice(
  {
    paper: 12905,
    corrugated: 0,
    special_ink: 0,
    material: 0,
    plate: 3200,
    proof: 0,
    print: 8000,
    afterpress: 20000,
    block: 2500,
    delivery: 225,
    other: 0,
  },
  {
    mark_up_percent: 0,
    mark_down_percent: 0,
    marking_material_percent: 15,     // material markup %
    marking_production_percent: 20,   // production markup %
    price_diff: 0,
    customer_gift: 0,
  },
  10000    // mainQty
)
// → {
//   sub_total_price_material: 12905,
//   sub_total_price_production: 33925,
//   total_marking_material: 1935.75,
//   sub_total_price_material_marking: 14840.75,
//   total_marking_production: 6785,
//   sub_total_price_production_marking: 40710,
//   total_price: 55550.75,
//   total_with_price_diff: 55550.75,
//   unit_price_material: 1.29,
//   unit_price_production: 3.39,
//   ...
// }
```

### D2 — `calculateTax(totalPrice)` — คำนวณภาษี

```js
const tax = calc.calculateTax(55550.75)
// [config: tax = 3%]
// → { tax_percent: 3, tax_price: 1666.52, total_with_tax: 57217.27 }
```

### D3 — `calculateUnitPrice(totalPrice, qty, exchangeRate)` — ราคาต่อชิ้น

```js
const unitPrice = calc.calculateUnitPrice(57217.27, 10000)
// → { unit_price: 5.72, unit_price_exchange: 5.72 }

const unitPriceUSD = calc.calculateUnitPrice(57217.27, 10000, 35)
// → { unit_price: 5.72, unit_price_exchange: 0.16 }
```

---

## [E] Full Pipeline — `calculate(input)`

ใช้ method เดียวที่เรียก **ทุก method ตามลำดับ A→B→C→D** โดยอัตโนมัติ

```js
const result = calc.calculate({
  // ─── ข้อมูล Job ──────────────────────────────────────────
  qty: 10000,                    // [input] จำนวนชิ้น
  printType: 'Offset',           // [input]
  inkType: 'conventional',       // [input]
  boxType: 1,                    // [input] RTE
  dimensions: {
    width: 60, length: 40, depth: 30,
    tuck_flap: 15, glue_flap: 10,
  },
  componentType: 1,              // [input] 1=ไม่ประกบ
  colors: { outside: 4, inside: 0, all: 4 },

  // ─── ข้อมูลกระดาษ ────────────────────────────────────────
  paper: {
    paper_cost: 45,              // [database: tb_master_paper]
    paper_gram: 300,
    paper_markup: 10,            // [config]
  },
  paperSize: [635, 940],         // [database: machine_std_paper] mm
  rollWidth: 25.5,               // [database] inch
  cutOff: 36,                    // [database] inch
  parallelRollWidth: 'WSize',

  // ─── Process / Addon (optional) ──────────────────────────
  processes: {
    assembly: { gluedSpot: 1 },
    diecut: { hasOppWindow: false },
    chip: true,
    inspection: true,
  },
  addons: {
    coating: {
      coatingCode: 'UV',
      coatingPrice: 0.08,
      side: 1,
      minCost: 500,
      unitMinCost: 'sheet',
    },
  },

  // ─── Markup ───────────────────────────────────────────────
  markupConfig: {
    marking_material_percent: 15,
    marking_production_percent: 20,
  },

  isProfitSharing: false,
  isReprinted: false,
})

// ─── ผลลัพธ์ ─────────────────────────────────────────────────────────────────
console.log(result.layout.ups)                 // จำนวน UPS
console.log(result.paperUsage.paper_net)       // จำนวนแผ่นกระดาษ
console.log(result.paperUsage.kilogram)        // น้ำหนักกระดาษ (kg)
console.log(result.costs.paper.price)          // ต้นทุนกระดาษ
console.log(result.costs.plate.outside.price)  // ต้นทุนเพลทด้านนอก
console.log(result.costs.print.outside.price)  // ต้นทุนพิมพ์
console.log(result.summary.totalPrice.total_price)  // ราคารวมก่อนภาษี
console.log(result.summary.tax.total_with_tax)      // ราคารวมหลังภาษี
console.log(result.summary.unitPrice.unit_price)    // ราคาต่อชิ้น
```

### โครงสร้าง Output

```
result
├── layout
│   ├── openSize          { width_mm, length_mm, width_in, length_in }
│   ├── foldSize          { width_mm, length_mm, depth_mm, ... }
│   ├── tolerance         { gripper, color_bar, paper_edge, bleed, shortSide, longSide }
│   ├── selectedLayout    { laying, layout: [nw,nl], num_laying, printSize, layoutSize }
│   ├── ups               number
│   └── laySize           [w_in, l_in]
├── paperUsage
│   ├── split             number
│   ├── waste             { totalWaste, waste_print, waste_afterpress, ... }
│   ├── after_ups         number
│   ├── after_waste       number
│   ├── paper_print       number
│   ├── paper_qty         number
│   ├── paper_net         number
│   ├── kilogram          number
│   └── ton               number
├── costs
│   ├── paper             { qty, unit_price, price }
│   ├── plate             { outside, inside, reprint }
│   ├── proof             { qty, unit_price, price }
│   ├── print             { outside, inside }
│   ├── coating           { qty, unit_price, price } | null
│   ├── assembly          { qty, unit_price, price } | null
│   ├── diecut            { labor, block } | null
│   ├── digitalDiecut     { qty, unit_price, price } | null
│   ├── chip              { qty, unit_price, price } | null
│   ├── inspection        { qty, unit_price, price } | null
│   └── corrugated        { qty, unit_price, price, unit_inch } | null
└── summary
    ├── aggregatedCosts   { paper, corrugated, plate, print, afterpress, block, ... }
    ├── totalPrice        { sub_total_price_material, sub_total_price_production, total_price, ... }
    ├── tax               { tax_percent, tax_price, total_with_tax }
    └── unitPrice         { unit_price, unit_price_exchange }
```

---

## Helpers

### `lookupPriceRate(type, qty, printType)` — ดึง rate พร้อม min_price

```js
const rate = calc.lookupPriceRate('print_3col', 1667, 'Offset')
// → { unit_price: 0.5, min_price: 500, price: 833.5 }
// ถ้า qty × unit_price < min_price → ใช้ min_price
```

### `getAssemblyType(openSize)` — ประเภท Assembly ตามขนาด

```js
const type = calc.getAssemblyType([5.906, 8.268])
// → 'assembly_S' | 'assembly_M' | 'assembly_L'
```

### `getAssemblyFactor(gluedSpot)` — Factor ตามจุดกาว

```js
calc.getAssemblyFactor(1) // → 1
calc.getAssemblyFactor(2) // → 1.5
calc.getAssemblyFactor(3) // → 1.75
calc.getAssemblyFactor(4) // → 1.9
```

---

## Method Summary

| Section | Method | หน้าที่ |
|---------|--------|---------|
| Util | `mm2inch` / `inch2mm` | แปลงหน่วย |
| A1 | `calculateOpenSize` | ขนาดกางแผ่น |
| A1.1 | `calculateFoldSize` | ขนาดพับ |
| A2 | `calculateTolerance` | ค่าเผื่อขอบกระดาษ |
| A3 | `calculateWSide` | ด้านกว้าง layout |
| A4 | `calculateLSide` | ด้านยาว layout |
| A5 | `applyTolerance` | บวก tolerance เข้า layout |
| A6 | `calculateLayout` | หา UPS ทุก case |
| A7 | `selectBestLayout` | เลือก layout ที่ดีสุด |
| B1 | `calculateSplit` | จำนวนแผ่นต่อแผ่นใหญ่ |
| B2 | `calculateWaste` | คำนวณ waste |
| B3 | `calculatePaperUsage` | ปริมาณกระดาษทั้งหมด |
| C1 | `calculatePaperCost` | ต้นทุนกระดาษ |
| C2 | `calculatePlateCost` | ต้นทุนเพลท |
| C3 | `calculateProofCost` | ต้นทุน proof |
| C4 | `calculatePrintCost` | ต้นทุนพิมพ์ |
| C5 | `calculateCoatingCost` | ต้นทุน coating |
| C6 | `calculateFoilStampCost` | ต้นทุน foil stamp |
| C7 | `calculateBossingCost` | ต้นทุน emboss/deboss |
| C8 | `calculateSpecialInkCost` | ต้นทุนหมึกพิเศษ |
| C9 | `calculateAssemblyCost` | ต้นทุนประกอบ |
| C10 | `calculateDieCutCost` | ต้นทุน die-cut |
| C11 | `calculateDigitalDieCutCost` | ต้นทุน digital die-cut |
| C12 | `calculateChipCost` | ต้นทุนแกะ |
| C13 | `calculateInspectionCost` | ต้นทุนตรวจสอบ |
| C14 | `calculateCorrugatedBoardCost` | ต้นทุนลูกฟูก |
| C15 | `calculateCorrugatedGluedCost` | ต้นทุนประกบลูกฟูก |
| C16 | `calculateDeliveryCost` | ต้นทุนจัดส่ง |
| D1 | `calculateTotalPrice` | รวมราคา + markup |
| D2 | `calculateTax` | คำนวณภาษี |
| D3 | `calculateUnitPrice` | ราคาต่อชิ้น |
| E | `calculate` | Full pipeline |
