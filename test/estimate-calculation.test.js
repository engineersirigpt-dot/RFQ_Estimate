/**
 * Jest Unit Tests — EstimateCalculation
 * ครอบคลุมทุก method ตามลำดับ A → B → C → D → E
 *
 * รัน: npx jest test/estimate-calculation.test.js --config test/jest.config.js
 */

const path = require('path')
const EstimateCalculation = require(
  path.resolve(__dirname, '../DOCUMENTS/ai-calculation/estimate-calculation-class.js')
)

// ─── Shared Fixtures ────────────────────────────────────────────────────────

/** Config จำลอง — ค่าเดียวกับ default.js */
const baseConfig = {
  formula_value: 1550000,
  tax: 3,
  plate_price: 800,
  plate_polymer_price: 6.53,
  reprint_plate_polymer_price: 5.94,
  cut_1_plate_markup: 50,
  reprintReducePlateCostPercent: 50,
  block_polymer_min_price: 50,
  afterpress_price_marking: 0,
  material_price_marking: 0,
  addon_labor_price_marking: 0,
  corrugated_assembly_markup_price: 0,
  corrugated_glued_cost: 0.0015,
  delivery_rate: 1500,
  foil_width_tolerance: 0.5,
  foil_length_tolerance: 1,
  film_rate: 1.25,
  film_min_cost: 120,
  block_foilstamp_min_cost: 70,
  reprinted_block: 0,
  tolerance: {
    bleed: 3,
    gripper: { Offset: 12, Flexo: 25, 'Jet Press': 0, Konica: 0 },
    color_bar: { Offset: 8,  Flexo: 0,  'Jet Press': 0, Konica: 0 },
    paper_edge: { Offset: 4, Flexo: 4,  'Jet Press': 4, Konica: 4 },
  },
  assembly_size: [
    { type: 'assembly_S', width: 7,  length: 10 },
    { type: 'assembly_M', width: 12, length: 16 },
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

/** LookupService จำลอง — คืนค่าคงที่เพื่อทดสอบ logic ล้วนๆ */
const baseLookup = {
  getPriceRate: jest.fn((type, qty, printType) => ({ unit_price: 0.5, min_price: 500 })),
  getWasteRate: jest.fn((printType, afterUps) => ({
    print_rate: 200,
    afterpress_rate: 0.01,
    coating_rate: 0.005,
    corrugatedglued_rate: 50,
    print_col_add_rate: 30,
    foilstamp_rate: 50,
    bossing_rate: 50,
    corrugated_board_rate: 100,
    digital_diecut_rate: 0,
  })),
  getBlockDiecutRate: jest.fn(() => 2500),
  getCoatingRate: jest.fn(() => ({ rate: 0.08, min_cost: 500, unit_min_cost: 'sheet' })),
  getCorrugatedRate: jest.fn(() => 12),
  getFoilStampInfo: jest.fn(() => ({ roll_price: 1200, roll_min_price: 600, width: 6, length: 200 })),
  getBlockStampRate: jest.fn(() => 3.5),
  getSpecialInkInfo: jest.fn(() => ({ price: 25 })),
  getSpecialInkFactor: jest.fn(() => ({ factor: 1000, filling_percent: 0.8 })),
  getJetPressRate: jest.fn(() => 1.5),
  getStdPaperSize: jest.fn(() => ({ width: 25.5, length: 36 })),
}

/** Factory สร้าง instance ใหม่ (เพื่อ reset mock call count) */
const createCalc = (configOverride = {}, lookupOverride = {}) =>
  new EstimateCalculation(
    { ...baseConfig, ...configOverride },
    { ...baseLookup, ...lookupOverride }
  )

// ════════════════════════════════════════════════════════════════════════════
// UTILITY CONVERTERS
// ════════════════════════════════════════════════════════════════════════════

describe('Utility Converters', () => {
  const calc = createCalc()

  describe('mm2inch', () => {
    test('25.4 mm = 1 inch', () => {
      expect(calc.mm2inch(25.4)).toBe(1)
    })

    test('ปัด 3 ตำแหน่ง', () => {
      expect(calc.mm2inch(100)).toBe(3.937)
    })

    test('0 mm = 0 inch', () => {
      expect(calc.mm2inch(0)).toBe(0)
    })
  })

  describe('inch2mm', () => {
    test('1 inch = 25.4 mm', () => {
      expect(calc.inch2mm(1)).toBe(25.4)
    })

    test('ปัด 2 ตำแหน่ง', () => {
      // 3.937 × 25.4 = 99.9998 → toFixed(2) = 100.00
      expect(calc.inch2mm(3.937)).toBe(100)
    })

    test('0 inch = 0 mm', () => {
      expect(calc.inch2mm(0)).toBe(0)
    })
  })
})

// ════════════════════════════════════════════════════════════════════════════
// [A] LAYOUT CALCULATION
// ════════════════════════════════════════════════════════════════════════════

describe('[A1] calculateOpenSize', () => {
  const calc = createCalc()
  const dim = { width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10, dust_flap: 5, ol: 0 }

  test('boxType 1 (RTE): w = 2(W+T)+D, l = 2(W+L)+G', () => {
    const r = calc.calculateOpenSize(1, dim)
    expect(r.width_mm).toBe(2 * (60 + 15) + 30)   // 180
    expect(r.length_mm).toBe(2 * (60 + 40) + 10)  // 210
    expect(r.width_in).toBe(calc.mm2inch(180))
    expect(r.length_in).toBe(calc.mm2inch(210))
  })

  test('boxType 2 (STE): สูตรเดียวกับ RTE', () => {
    const r = calc.calculateOpenSize(2, dim)
    expect(r.width_mm).toBe(2 * (60 + 15) + 30)
    expect(r.length_mm).toBe(2 * (60 + 40) + 10)
  })

  test('boxType 3 (TTSLB): w = T+W+D+W/2+OL', () => {
    const r = calc.calculateOpenSize(3, dim)
    expect(r.width_mm).toBe(15 + 60 + 30 + 30 + 0) // 135
  })

  test('boxType 5 (Tray): w = W+4D, l = L+4D+2dust', () => {
    const r = calc.calculateOpenSize(5, dim)
    expect(r.width_mm).toBe(60 + 4 * 30)            // 180
    expect(r.length_mm).toBe(40 + 4 * 30 + 2 * 5)  // 170
  })

  test('boxType 6 (Four Corner): w = W+4D+2dust+2OL', () => {
    const r = calc.calculateOpenSize(6, dim)
    expect(r.width_mm).toBe(60 + 4 * 30 + 2 * 5 + 2 * 0) // 190
  })

  test('boxType 7 (Sleeve): w = 2(L+dust)+W', () => {
    const r = calc.calculateOpenSize(7, dim)
    expect(r.width_mm).toBe(2 * (40 + 5) + 60) // 150
  })

  test('boxType 9 (Belly Band): w = D', () => {
    const r = calc.calculateOpenSize(9, dim)
    expect(r.width_mm).toBe(30)
  })

  test('boxType 10 (Rigid Box Wrapper): w = L+D, l = 2W+G', () => {
    const r = calc.calculateOpenSize(10, dim)
    expect(r.width_mm).toBe(40 + 30) // 70
    expect(r.length_mm).toBe(2 * 60 + 10) // 130
  })

  test('boxType 11 (Mailer Box): w = 2W+D', () => {
    const r = calc.calculateOpenSize(11, dim)
    expect(r.width_mm).toBe(2 * 60 + 30) // 150
  })

  test('default: คืน W, L เดิม', () => {
    const r = calc.calculateOpenSize(99, { width: 50, length: 80 })
    expect(r.width_mm).toBe(50)
    expect(r.length_mm).toBe(80)
  })
})

describe('[A1.1] calculateFoldSize', () => {
  const calc = createCalc()
  const dim = { width: 60, length: 40, depth: 30, tuck_flap: 15 }

  test('boxType ทั่วไป: คืน W, L, D', () => {
    const r = calc.calculateFoldSize(1, dim)
    expect(r.width_mm).toBe(60)
    expect(r.length_mm).toBe(40)
    expect(r.depth_mm).toBe(30)
  })

  test('boxType 8 (Pillow): width = 2W+T', () => {
    const r = calc.calculateFoldSize(8, dim)
    expect(r.width_mm).toBe(2 * 60 + 15) // 135
    expect(r.length_mm).toBe(40)
    expect(r.depth_mm).toBe(30)
  })

  test('คืนค่า inch ด้วย', () => {
    const r = calc.calculateFoldSize(1, dim)
    expect(r.width_in).toBe(calc.mm2inch(60))
    expect(r.length_in).toBe(calc.mm2inch(40))
    expect(r.depth_in).toBe(calc.mm2inch(30))
  })
})

describe('[A2] calculateTolerance', () => {
  const calc = createCalc()

  test('Offset componentType 1: shortSide = gripper+color_bar, longSide = paper_edge×2', () => {
    const r = calc.calculateTolerance('Offset', 1)
    expect(r.gripper).toBe(12)
    expect(r.color_bar).toBe(8)
    expect(r.paper_edge).toBe(4)
    expect(r.bleed).toBe(3)
    expect(r.shortSide).toBe(12 + 8)   // 20
    expect(r.longSide).toBe(4 * 2)      // 8
  })

  test('componentType 2: เหมือน type 1', () => {
    const r = calc.calculateTolerance('Offset', 2)
    expect(r.shortSide).toBe(20)
    expect(r.longSide).toBe(8)
  })

  test('componentType 3 (Flexo): shortSide บวก paper_edge×2 เพิ่ม', () => {
    const r = calc.calculateTolerance('Flexo', 3)
    // gripper=25, color_bar: Flexo=0 (falsy) → fallback Offset=8, paper_edge=4
    // shortSide = 25 + 8 + 4*2 = 41
    expect(r.shortSide).toBe(25 + 8 + 4 * 2)  // 41
    expect(r.longSide).toBe(4 * 2)             // 8
  })
})

describe('[A3] calculateWSide', () => {
  const calc = createCalc()

  test('case 1.1 (RTE straight): (n+1)(W+T) + n(2b+D)', () => {
    // n=2, w=60, t=15, d=30, b=3
    const r = calc.calculateWSide(1.1, 2, 60, 40, 30, 3, 0, 0, 10, 15)
    expect(r).toBe((2 + 1) * (60 + 15) + 2 * (2 * 3 + 30)) // 3×75 + 2×36 = 225+72 = 297
  })

  test('case 5.0 (Tray): n(W+4D+2b)', () => {
    const r = calc.calculateWSide(5.0, 3, 60, 40, 30, 3, 5, 0, 10, 0)
    expect(r).toBe(3 * (60 + 4 * 30 + 2 * 3)) // 3×186 = 558
  })

  test('case 9.0 (Belly Band): n(D+2b)', () => {
    const r = calc.calculateWSide(9.0, 4, 60, 40, 30, 3, 0, 0, 0, 0)
    expect(r).toBe(4 * (30 + 2 * 3)) // 4×36 = 144
  })

  test('case ไม่รู้จัก: คืน 0', () => {
    const r = calc.calculateWSide(99.9, 1, 60, 40, 30, 3, 0, 0, 0, 0)
    expect(r).toBe(0)
  })
})

describe('[A4] calculateLSide', () => {
  const calc = createCalc()

  test('case 1.0 (RTE): n(2(W+L+b)+G)', () => {
    const r = calc.calculateLSide(1.0, 2, 60, 40, 30, 3, 0, 0, 10)
    expect(r).toBe(2 * (2 * (60 + 40 + 3) + 10)) // 2×216=432
  })

  test('case 5.0 (Tray): n(L+4D+2b+2dust)', () => {
    const r = calc.calculateLSide(5.0, 2, 60, 40, 30, 3, 5, 0, 0)
    expect(r).toBe(2 * (40 + 4 * 30 + 2 * 3 + 2 * 5)) // 2×176 = 352
  })

  test('case 10.0 (Rigid Wrapper): n(2W+2b+G)', () => {
    const r = calc.calculateLSide(10.0, 1, 60, 40, 30, 3, 0, 0, 10)
    expect(r).toBe(1 * (2 * 60 + 2 * 3 + 10)) // 136
  })
})

describe('[A5] applyTolerance', () => {
  const calc = createCalc()

  test('ด้านสั้นบวก shortSide, ด้านยาวบวก longSide', () => {
    // printingSize [200, 300]: 200 <= 300 → shortSide บวก 200
    const r = calc.applyTolerance([200, 300], 20, 8)
    expect(r.layout_w_mm).toBe(200 + 20) // 220
    expect(r.layout_l_mm).toBe(300 + 8)  // 308
  })

  test('กรณี w > l: สลับ shortSide/longSide', () => {
    const r = calc.applyTolerance([300, 200], 20, 8)
    expect(r.layout_w_mm).toBe(300 + 8)  // longSide
    expect(r.layout_l_mm).toBe(200 + 20) // shortSide
  })

  test('คืนค่า inch ด้วย', () => {
    const r = calc.applyTolerance([200, 300], 20, 8)
    expect(r.layout_w_in).toBe(calc.mm2inch(220))
    expect(r.layout_l_in).toBe(calc.mm2inch(308))
  })
})

describe('[A6] calculateLayout', () => {
  const calc = createCalc()

  test('คืน array ของ layout options', () => {
    const layouts = calc.calculateLayout({
      boxType: 1,
      dimensions: { width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10 },
      bleed: 3,
      paperSize: [635, 940],
      shortSide: 20,
      longSide: 8,
    })
    expect(Array.isArray(layouts)).toBe(true)
    expect(layouts.length).toBeGreaterThan(0)
  })

  test('แต่ละ layout มี field ครบ', () => {
    const layouts = calc.calculateLayout({
      boxType: 1,
      dimensions: { width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10 },
      bleed: 3,
      paperSize: [635, 940],
      shortSide: 20,
      longSide: 8,
    })
    for (const l of layouts) {
      expect(l).toHaveProperty('laying')
      expect(l).toHaveProperty('layout')
      expect(l).toHaveProperty('num_laying')
      expect(l).toHaveProperty('printSize')
      expect(l).toHaveProperty('layoutSize')
      expect(l.num_laying).toBeGreaterThan(0)
    }
  })

  test('กระดาษเล็กมาก → ไม่พอวางเลย คืน array เปล่า', () => {
    const layouts = calc.calculateLayout({
      boxType: 1,
      dimensions: { width: 600, length: 400, depth: 300, tuck_flap: 150, glue_flap: 100 },
      bleed: 3,
      paperSize: [10, 10],
      shortSide: 20,
      longSide: 8,
    })
    expect(layouts.length).toBe(0)
  })
})

describe('[A7] selectBestLayout', () => {
  const calc = createCalc()

  test('คืน layout ที่ num_laying สูงสุด', () => {
    const layouts = [
      { num_laying: 4, laying: 'vertical',   layoutSize: { layout_w_mm: 300, layout_l_mm: 400 } },
      { num_laying: 6, laying: 'horizontal', layoutSize: { layout_w_mm: 300, layout_l_mm: 400 } },
      { num_laying: 3, laying: 'vertical',   layoutSize: { layout_w_mm: 250, layout_l_mm: 350 } },
    ]
    const best = calc.selectBestLayout(layouts, [635, 940])
    expect(best.num_laying).toBe(6)
  })

  test('ถ้า ups เท่ากัน เลือก waste น้อยสุด', () => {
    const layouts = [
      { num_laying: 6, laying: 'vertical',   layoutSize: { layout_w_mm: 600, layout_l_mm: 900 } }, // area=540000
      { num_laying: 6, laying: 'horizontal', layoutSize: { layout_w_mm: 400, layout_l_mm: 600 } }, // area=240000
    ]
    const best = calc.selectBestLayout(layouts, [635, 940])
    // paperArea = 635*940 = 596900; waste = paperArea - usedArea
    // layout[0]: waste = 596900-540000 = 56900
    // layout[1]: waste = 596900-240000 = 356900
    expect(best.laying).toBe('vertical') // waste น้อยกว่า
  })

  test('layouts เปล่า → คืน null', () => {
    expect(calc.selectBestLayout([], [635, 940])).toBeNull()
    expect(calc.selectBestLayout(null, [635, 940])).toBeNull()
  })
})

// ════════════════════════════════════════════════════════════════════════════
// [B] PAPER USAGE CALCULATION
// ════════════════════════════════════════════════════════════════════════════

describe('[B1] calculateSplit', () => {
  const calc = createCalc()

  test('WSize mode: floor(rollWidth/layW) × floor(cutOff/layL)', () => {
    const split = calc.calculateSplit(25.5, 36, [8.5, 12], 'WSize')
    expect(split).toBe(Math.floor(25.5 / 8.5) * Math.floor(36 / 12)) // 3×3=9
  })

  test('LSize mode: floor(rollWidth/layL) × floor(cutOff/layW)', () => {
    const split = calc.calculateSplit(25.5, 36, [8.5, 12], 'LSize')
    expect(split).toBe(Math.floor(25.5 / 12) * Math.floor(36 / 8.5)) // 2×4=8
  })

  test('min = 1 เสมอ (ไม่คืน 0)', () => {
    const split = calc.calculateSplit(1, 1, [100, 100], 'WSize')
    expect(split).toBe(1)
  })
})

describe('[B2] calculateWaste', () => {
  const calc = createCalc()

  test('Offset: totalWaste ≥ waste_print', () => {
    const r = calc.calculateWaste({
      printType: 'Offset',
      afterUps: 1000,
      outsideColors: 4,
      insideColors: 0,
      allColors: 4,
      componentType: 1,
      addons: {},
    })
    expect(r.totalWaste).toBeGreaterThanOrEqual(r.waste_print)
    expect(r).toHaveProperty('totalWaste')
    expect(r).toHaveProperty('waste_print')
    expect(r).toHaveProperty('waste_afterpress')
    expect(r).toHaveProperty('waste_coating')
  })

  test('Jet Press: outsideColors > 0 AND insideColors > 0 → waste_print คูณ 2', () => {
    const rBoth = calc.calculateWaste({
      printType: 'Jet Press',
      afterUps: 1000,
      outsideColors: 4,
      insideColors: 4,
      allColors: 8,
      componentType: 1,
      addons: {},
    })
    const rOut = calc.calculateWaste({
      printType: 'Jet Press',
      afterUps: 1000,
      outsideColors: 4,
      insideColors: 0,
      allColors: 4,
      componentType: 1,
      addons: {},
    })
    expect(rBoth.totalWaste).toBeGreaterThan(rOut.totalWaste)
  })

  test('addons.hasCoating → totalWaste เพิ่มขึ้น', () => {
    const withoutCoating = calc.calculateWaste({
      printType: 'Offset', afterUps: 1000, outsideColors: 4,
      insideColors: 0, allColors: 4, componentType: 1, addons: {},
    })
    const withCoating = calc.calculateWaste({
      printType: 'Offset', afterUps: 1000, outsideColors: 4,
      insideColors: 0, allColors: 4, componentType: 1,
      addons: { hasCoating: true, coatingSide: 1 },
    })
    expect(withCoating.totalWaste).toBeGreaterThan(withoutCoating.totalWaste)
  })

  test('componentType 2,3 → เพิ่ม corrugatedglued waste', () => {
    const type1 = calc.calculateWaste({
      printType: 'Offset', afterUps: 1000, outsideColors: 4,
      insideColors: 0, allColors: 4, componentType: 1, addons: {},
    })
    const type2 = calc.calculateWaste({
      printType: 'Offset', afterUps: 1000, outsideColors: 4,
      insideColors: 0, allColors: 4, componentType: 2, addons: {},
    })
    expect(type2.totalWaste).toBeGreaterThan(type1.totalWaste)
  })
})

describe('[B3] calculatePaperUsage', () => {
  const calc = createCalc()

  test('after_ups = ceil(qty/ups)', () => {
    const r = calc.calculatePaperUsage({
      qty: 10000, ups: 6, sig: 1, split: 4,
      totalWaste: 200, gram: 300, rollWidth: 25.5, cutOff: 36, printType: 'Offset',
    })
    expect(r.after_ups).toBe(Math.ceil(10000 / 6)) // 1667
  })

  test('after_waste = after_ups + totalWaste', () => {
    const r = calc.calculatePaperUsage({
      qty: 10000, ups: 6, sig: 1, split: 4,
      totalWaste: 200, gram: 300, rollWidth: 25.5, cutOff: 36, printType: 'Offset',
    })
    expect(r.after_waste).toBe(r.after_ups + 200)
  })

  test('paper_net ปัดขึ้นทีละ 100 (Offset)', () => {
    const r = calc.calculatePaperUsage({
      qty: 10000, ups: 6, sig: 1, split: 4,
      totalWaste: 200, gram: 300, rollWidth: 25.5, cutOff: 36, printType: 'Offset',
    })
    expect(r.paper_net % 100).toBe(0)
    expect(r.paper_net).toBeGreaterThanOrEqual(r.paper_qty)
  })

  test('Konica: paper_net ไม่ปัด 100', () => {
    const r = calc.calculatePaperUsage({
      qty: 50, ups: 1, sig: 1, split: 1,
      totalWaste: 0, gram: 200, rollWidth: 12, cutOff: 18, printType: 'Konica',
    })
    expect(r.paper_net).toBe(r.paper_qty) // ไม่ปัด
  })

  test('kilogram คำนวณจาก formula_value', () => {
    const r = calc.calculatePaperUsage({
      qty: 10000, ups: 6, sig: 1, split: 4,
      totalWaste: 200, gram: 300, rollWidth: 25.5, cutOff: 36, printType: 'Offset',
    })
    const expected = parseFloat((r.paper_net * 300 / 1550000 * 25.5 * 36).toFixed(2))
    expect(r.kilogram).toBe(expected)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// [C] COST CALCULATIONS
// ════════════════════════════════════════════════════════════════════════════

describe('[C1] calculatePaperCost', () => {
  const calc = createCalc()

  test('คำนวณ unit_price = rollWidth×cutOff×totalPrice×gram/formulaValue', () => {
    const r = calc.calculatePaperCost(
      { paper_cost: 45, paper_gram: 300, paper_markup: 10 },
      25.5, 36, 500
    )
    const totalPrice = parseFloat(((45 * 1.1) + 0).toFixed(2)) // 49.5
    const expectedUnit = parseFloat((25.5 * 36 * totalPrice * 300 / 1550000).toFixed(2))
    expect(r.unit_price).toBe(expectedUnit)
    expect(r.qty).toBe(500)
    expect(r.price).toBe(parseFloat((500 * expectedUnit).toFixed(2)))
  })

  test('sheet_unit_price = true: unit_price = paper_total_price', () => {
    const r = calc.calculatePaperCost(
      { paper_cost: 5, paper_gram: 300, paper_markup: 0, sheet_unit_price: true },
      25.5, 36, 1000
    )
    expect(r.unit_price).toBe(5)
    expect(r.price).toBe(5000)
  })

  test('paper_percent เพิ่มเข้า total price', () => {
    const r1 = calc.calculatePaperCost(
      { paper_cost: 45, paper_gram: 300, paper_markup: 0, paper_percent: 0 },
      25.5, 36, 100
    )
    const r2 = calc.calculatePaperCost(
      { paper_cost: 45, paper_gram: 300, paper_markup: 0, paper_percent: 5 },
      25.5, 36, 100
    )
    expect(r2.unit_price).toBeGreaterThan(r1.unit_price)
  })
})

describe('[C2] calculatePlateCost', () => {
  const calc = createCalc()

  test('Offset: qty = max(round(afterWaste/100000), 1)', () => {
    const r = calc.calculatePlateCost({
      printType: 'Offset', outsideColors: 4, insideColors: 0,
      afterWaste: 1884, sig: 1, ups: 6,
    })
    expect(r.outside.qty).toBe(1) // round(1884/100000) = 0 → max(0,1) = 1
    expect(r.outside.unit_price).toBe(4 * 1 * 800) // 4สี × 1sig × 800
    expect(r.inside.price).toBe(0) // ไม่มีสีใน
  })

  test('Offset reprint + usePrevPlate: ราคาลด 50%', () => {
    const r = calc.calculatePlateCost({
      printType: 'Offset', outsideColors: 4, insideColors: 0,
      afterWaste: 1884, sig: 1, ups: 1,
      isReprinted: true, isUsePrevPlate: true,
    })
    const expected = 4 * 1 * (800 * 0.5)
    expect(r.outside.unit_price).toBe(expected)
  })

  test('Offset isCut1: บวก cut_1_plate_markup', () => {
    const r = calc.calculatePlateCost({
      printType: 'Offset', outsideColors: 1, insideColors: 0,
      afterWaste: 1884, sig: 1, ups: 1, isCut1: true,
    })
    expect(r.outside.unit_price).toBe(1 * 1 * (800 + 50))
  })

  test('Flexo: unit = polymerPrice × w × l', () => {
    const r = calc.calculatePlateCost({
      printType: 'Flexo', outsideColors: 2, insideColors: 0,
      ups: 1, flexoSize: [4, 5], isReprinted: false,
    })
    const expectedPpu = parseFloat((6.53 * 4 * 5).toFixed(2))
    expect(r.outside.unit_price).toBe(expectedPpu)
  })

  test('Flexo: price ไม่ต่ำกว่า block_polymer_min_price', () => {
    // ขนาดเล็กมาก → price ต่ำกว่า min
    const r = calc.calculatePlateCost({
      printType: 'Flexo', outsideColors: 1, insideColors: 0,
      ups: 1, flexoSize: [0.1, 0.1], isReprinted: false,
    })
    expect(r.outside.price).toBeGreaterThanOrEqual(50) // block_polymer_min_price
  })

  test('Jet Press / Konica: price = 0', () => {
    const rJP = calc.calculatePlateCost({ printType: 'Jet Press' })
    expect(rJP.outside.price).toBe(0)
    const rK = calc.calculatePlateCost({ printType: 'Konica' })
    expect(rK.outside.price).toBe(0)
  })
})

describe('[C3] calculateProofCost', () => {
  const calc = createCalc()

  test('Offset: price = 0', () => {
    expect(calc.calculateProofCost('Offset').price).toBe(0)
  })

  test('Jet Press: price = 500 × componentCount', () => {
    expect(calc.calculateProofCost('Jet Press', 1).price).toBe(500)
    expect(calc.calculateProofCost('Jet Press', 3).price).toBe(1500)
  })

  test('Konica: price = 200 × componentCount', () => {
    expect(calc.calculateProofCost('Konica', 2).price).toBe(400)
  })
})

describe('[C4] calculatePrintCost', () => {
  const calc = createCalc()

  test('Offset conventional: เรียก lookupPriceRate', () => {
    calc.calculatePrintCost({
      printType: 'Offset', inkType: 'conventional',
      outsideColors: 4, insideColors: 0,
      afterUps: 1667, paperPrint: 1884,
    })
    expect(baseLookup.getPriceRate).toHaveBeenCalled()
  })

  test('Offset UV: price = 2.5× conventional', () => {
    const conv = calc.calculatePrintCost({
      printType: 'Offset', inkType: 'conventional',
      outsideColors: 4, insideColors: 0, afterUps: 1667, paperPrint: 1884,
    })
    const uv = calc.calculatePrintCost({
      printType: 'Offset', inkType: 'UV',
      outsideColors: 4, insideColors: 0, afterUps: 1667, paperPrint: 1884,
    })
    expect(uv.outside.price).toBeCloseTo(conv.outside.price * 2.5, 1)
  })

  test('Konica conventional: unit_price = 3 THB/ใบ', () => {
    const r = calc.calculatePrintCost({
      printType: 'Konica', outsideColors: 4, insideColors: 0,
      paperPrint: 1000, isBlackPrintingOutside: false,
    })
    expect(r.outside.unit_price).toBe(3)
    expect(r.outside.qty).toBe(1000)
  })

  test('Konica ขาวดำ: unit_price = 1 THB/ใบ', () => {
    const r = calc.calculatePrintCost({
      printType: 'Konica', outsideColors: 1, insideColors: 0,
      paperPrint: 1000, isBlackPrintingOutside: true,
    })
    expect(r.outside.unit_price).toBe(1)
  })

  test('Konica ไม่มีสี: unit_price = 0', () => {
    const r = calc.calculatePrintCost({
      printType: 'Konica', outsideColors: 0, insideColors: 0, paperPrint: 1000,
    })
    expect(r.outside.unit_price).toBe(0)
    expect(r.inside.unit_price).toBe(0)
  })

  test('Jet Press: เรียก getJetPressRate', () => {
    calc.calculatePrintCost({
      printType: 'Jet Press', outsideColors: 4, insideColors: 0,
      paperPrint: 1000, paperSize: [635, 940],
    })
    expect(baseLookup.getJetPressRate).toHaveBeenCalled()
  })
})

describe('[C5] calculateCoatingCost', () => {
  const calc = createCalc()

  test('UV Coating: unit_price = w×l×coatingPrice×side', () => {
    const r = calc.calculateCoatingCost({
      coatingCode: 'UV',
      coatingPrice: 0.08,
      side: 1,
      minCost: 0,
      unitMinCost: 'sheet',
      paperPrint: 1000,
      laySize: [10, 15],
      ups: 6,
    })
    expect(r.unit_price).toBe(parseFloat((10 * 15 * 0.08 * 1).toFixed(2)))
    expect(r.qty).toBe(1000)
  })

  test('unitMinCost sheet: unit_price ≥ minCost', () => {
    const r = calc.calculateCoatingCost({
      coatingCode: 'UV',
      coatingPrice: 0.001,   // ต่ำมาก
      side: 1,
      minCost: 5,            // min_cost ต่อแผ่น
      unitMinCost: 'sheet',
      paperPrint: 100,
      laySize: [1, 1],
      ups: 1,
    })
    expect(r.unit_price).toBeGreaterThanOrEqual(5)
  })

  test('B-PACK: unit_price = coatingPrice × side', () => {
    const r = calc.calculateCoatingCost({
      coatingCode: 'B-PACK',
      coatingPrice: 2.5,
      side: 2,
      minCost: 0,
      unitMinCost: 'price',
      paperPrint: 100,
      laySize: [10, 15],
      ups: 1,
    })
    expect(r.unit_price).toBe(parseFloat((2.5 * 2).toFixed(2)))
  })

  test('S-UV: unit_price = ups × w × l × coatingPrice × side', () => {
    const r = calc.calculateCoatingCost({
      coatingCode: 'S-UV',
      coatingPrice: 0.1,
      side: 1,
      minCost: 0,
      unitMinCost: 'price',
      paperPrint: 100,
      laySize: [10, 15],
      ups: 3,
      width: 2,
      length: 3,
    })
    expect(r.unit_price).toBe(parseFloat((3 * 2 * 3 * 0.1 * 1).toFixed(2)))
  })
})

describe('[C6] calculateFoilStampCost', () => {
  const calc = createCalc()

  test('คืน 3 ส่วน: labor, foil_roll, block', () => {
    const r = calc.calculateFoilStampCost({
      foilWidth: 6, foilLength: 200,
      width: 2, length: 1.5,
      foilRollPrice: 1200, foilRollMinPrice: 600,
      blockRate: 3.5,
      qty: 10000, afterUps: 1667, ups: 6, printType: 'Offset',
    })
    expect(r).toHaveProperty('labor')
    expect(r).toHaveProperty('foil_roll')
    expect(r).toHaveProperty('block')
    expect(r.labor.qty).toBe(10000)
    expect(r.block.qty).toBe(6) // ups
  })

  test('foil_roll.price ≥ rollMinPrice (min enforcement)', () => {
    const r = calc.calculateFoilStampCost({
      foilWidth: 6, foilLength: 200,
      width: 2, length: 1.5,
      foilRollPrice: 1200, foilRollMinPrice: 600,
      blockRate: 3.5,
      qty: 1, afterUps: 1, ups: 1, printType: 'Offset',
    })
    // qty=1 → foilPrice ต่ำ → ใช้ rollMinPrice
    expect(r.foil_roll.price).toBeGreaterThanOrEqual(600)
  })

  test('block ≥ block_foilstamp_min_cost', () => {
    const r = calc.calculateFoilStampCost({
      foilWidth: 6, foilLength: 200,
      width: 0.1, length: 0.1,  // ขนาดเล็กมาก
      foilRollPrice: 1200, foilRollMinPrice: 0,
      blockRate: 1,
      qty: 10000, afterUps: 1667, ups: 1, printType: 'Offset',
    })
    // blockUnitPrice = 0.1×0.1×1 = 0.01 < 70 → ใช้ 70
    expect(r.block.unit_price).toBeGreaterThanOrEqual(70)
  })
})

describe('[C7] calculateBossingCost', () => {
  const calc = createCalc()

  test('คืน labor และ blocks array', () => {
    const r = calc.calculateBossingCost({
      type: 'emboss',
      blockRate: 3.5,
      sizes: [[2, 1.5], [1, 1]],
      qty: 10000, afterUps: 1667, ups: 6, printType: 'Offset',
    })
    expect(r).toHaveProperty('labor')
    expect(r).toHaveProperty('blocks')
    expect(r.blocks.length).toBe(2)
    expect(r.blocks[0].qty).toBe(6) // ups
  })

  test('sizes เปล่า: blocks = []', () => {
    const r = calc.calculateBossingCost({
      type: 'emboss', blockRate: 3.5, sizes: [],
      qty: 100, afterUps: 100, ups: 1,
    })
    expect(r.blocks.length).toBe(0)
  })
})

describe('[C8] calculateSpecialInkCost', () => {
  const calc = createCalc()

  test('qty = ceil(1.05 × layW × layL × afterWaste × filling / factor)', () => {
    const r = calc.calculateSpecialInkCost({
      inkProcessId: 1, paperCode: 'ART', printStyle: 'full',
      afterWaste: 500, laySize: [10, 12],
    })
    // factor=1000, filling=0.8
    const expectedQty = Math.ceil(1.05 * 10 * 12 * 500 * 0.8 / 1000)
    expect(r.qty).toBe(expectedQty)
    expect(r.unit_price).toBe(25)
    expect(r.price).toBe(r.qty * 25)
  })
})

describe('[C9] calculateAssemblyCost', () => {
  const calc = createCalc()

  test('price = qty × unit_price (ไม่ต่ำกว่า min)', () => {
    const r = calc.calculateAssemblyCost({
      openSize: [5, 8], qty: 10000, componentType: 1, gluedSpot: 1,
    })
    expect(r.qty).toBe(10000)
    expect(r.price).toBeGreaterThan(0)
  })

  test('gluedSpot 2 → factor 1.5 → price สูงกว่า gluedSpot 1', () => {
    const r1 = calc.calculateAssemblyCost({ openSize: [5, 8], qty: 10000, componentType: 1, gluedSpot: 1 })
    const r2 = calc.calculateAssemblyCost({ openSize: [5, 8], qty: 10000, componentType: 1, gluedSpot: 2 })
    expect(r2.price).toBeGreaterThan(r1.price)
  })

  test('componentType 2,3 → +corrugated_assembly_markup', () => {
    const calc2 = createCalc({ corrugated_assembly_markup_price: 0.5 })
    const r1 = calc2.calculateAssemblyCost({ openSize: [5, 8], qty: 10000, componentType: 1, gluedSpot: 1 })
    const r2 = calc2.calculateAssemblyCost({ openSize: [5, 8], qty: 10000, componentType: 2, gluedSpot: 1 })
    expect(r2.unit_price).toBeGreaterThan(r1.unit_price)
  })
})

describe('[C10] calculateDieCutCost', () => {
  const calc = createCalc()

  test('คืน labor และ block', () => {
    const r = calc.calculateDieCutCost({
      qty: 10000, afterUps: 1667, ups: 6,
      laySize: [8.661, 12.126],
    })
    expect(r).toHaveProperty('labor')
    expect(r).toHaveProperty('block')
    expect(r.labor.qty).toBe(10000)
  })

  test('OPP Window: factor×2 → labor price สูงขึ้น, block qty=2', () => {
    const rNormal = calc.calculateDieCutCost({
      qty: 10000, afterUps: 1667, ups: 6, laySize: [8, 12], hasOppWindow: false,
    })
    const rOPP = calc.calculateDieCutCost({
      qty: 10000, afterUps: 1667, ups: 6, laySize: [8, 12], hasOppWindow: true,
    })
    expect(rOPP.labor.price).toBeGreaterThan(rNormal.labor.price)
    expect(rOPP.block.qty).toBe(2)
    expect(rNormal.block.qty).toBe(1)
  })

  test('isReprinted: block.unit_price = reprinted_block (0)', () => {
    const r = calc.calculateDieCutCost({
      qty: 100, afterUps: 100, ups: 1, laySize: [8, 12], isReprinted: true,
    })
    expect(r.block.unit_price).toBe(0)
  })
})

describe('[C11] calculateDigitalDieCutCost', () => {
  const calc = createCalc()

  test('unit_price = 5 [hardcoded]', () => {
    const r = calc.calculateDigitalDieCutCost(1000)
    expect(r.unit_price).toBe(5)
    expect(r.qty).toBe(1000)
    expect(r.price).toBe(5000)
  })

  test('afterpress_price_marking บวกเข้า price', () => {
    const calc2 = createCalc({ afterpress_price_marking: 10 })
    const r = calc2.calculateDigitalDieCutCost(1000)
    expect(r.price).toBe(parseFloat((5000 * 1.1).toFixed(2)))
  })
})

describe('[C12] calculateChipCost', () => {
  const calc = createCalc()

  test('price = qty × unit_price', () => {
    const r = calc.calculateChipCost(10000, 'Offset')
    expect(r.qty).toBe(10000)
    expect(r.unit_price).toBe(0.5) // จาก mock getPriceRate
    expect(r.price).toBeGreaterThanOrEqual(r.qty * r.unit_price)
  })

  test('price ≥ min_price (500)', () => {
    const r = calc.calculateChipCost(1, 'Offset') // qty=1 → 0.5×1=0.5 < 500
    expect(r.price).toBeGreaterThanOrEqual(500)
  })
})

describe('[C13] calculateInspectionCost', () => {
  const calc = createCalc()

  test('price ≥ min_price เมื่อ qty น้อย', () => {
    const r = calc.calculateInspectionCost(1, 'Offset')
    expect(r.price).toBeGreaterThanOrEqual(500)
  })

  test('price เพิ่มตาม qty', () => {
    const r1 = calc.calculateInspectionCost(1000)
    const r2 = calc.calculateInspectionCost(100000)
    expect(r2.price).toBeGreaterThanOrEqual(r1.price)
  })
})

describe('[C14] calculateCorrugatedBoardCost', () => {
  const calc = createCalc()

  test('คำนวณ unit_inch = rate/144×(1+markup%)', () => {
    const r = calc.calculateCorrugatedBoardCost({
      grade: 'KSF170/CSF110', fluteType: 'B',
      corrugatedMarkup: 10,
      fluteSide: 24, cutOff: 36,
      qty: 2000, afterUps: 1667,
    })
    // rate = 12 (จาก mock)
    const expectedUnitInch = parseFloat((12 / 144 * 1.1).toFixed(4))
    expect(r.unit_inch).toBe(expectedUnitInch)
    expect(r.qty).toBe(2000)
  })

  test('customCost: ข้ามการ lookup', () => {
    const mockLookup = { ...baseLookup, getCorrugatedRate: jest.fn() }
    const calc2 = new EstimateCalculation(baseConfig, mockLookup)
    calc2.calculateCorrugatedBoardCost({
      grade: 'any', fluteType: 'B', corrugatedMarkup: 10,
      fluteSide: 24, cutOff: 36, qty: 1000, afterUps: 1000, customCost: 5,
    })
    expect(mockLookup.getCorrugatedRate).not.toHaveBeenCalled()
  })
})

describe('[C15] calculateCorrugatedGluedCost', () => {
  const calc = createCalc()

  test('unit_price = fluteSide × cutOff × corrugated_glued_cost', () => {
    const r = calc.calculateCorrugatedGluedCost(24, 36, 1000)
    const expected = parseFloat((24 * 36 * 0.0015).toFixed(2))
    expect(r.unit_price).toBe(expected)
    expect(r.qty).toBe(1000)
    expect(r.price).toBe(parseFloat((1000 * expected).toFixed(2)))
  })
})

describe('[C16] calculateDeliveryCost', () => {
  const calc = createCalc()

  test('price = delivery_rate × grossWeight / 1000', () => {
    const r = calc.calculateDeliveryCost(200)
    expect(r.price).toBe(parseFloat((1500 * 200 / 1000).toFixed(2))) // 300
  })

  test('grossWeight = 0 → price = 0', () => {
    const r = calc.calculateDeliveryCost(0)
    expect(r.price).toBe(0)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// [D] PRICE AGGREGATION
// ════════════════════════════════════════════════════════════════════════════

describe('[D1] calculateTotalPrice', () => {
  const calc = createCalc()

  const costs = {
    paper: 10000, corrugated: 0, special_ink: 0, material: 0,
    plate: 3200, proof: 0, print: 8000, afterpress: 5000, block: 2000,
    delivery: 500, other: 0,
  }

  test('sub_total_material = paper + corrugated + special_ink + material', () => {
    const r = calc.calculateTotalPrice(costs, {}, 10000)
    expect(r.sub_total_price_material).toBe(10000)
  })

  test('sub_total_production = plate + print + proof + afterpress + block + delivery + other', () => {
    const r = calc.calculateTotalPrice(costs, {}, 10000)
    expect(r.sub_total_price_production).toBe(3200 + 8000 + 0 + 5000 + 2000 + 500 + 0)
  })

  test('material markup ถูกคิดแยก', () => {
    const r = calc.calculateTotalPrice(costs, { marking_material_percent: 10 }, 10000)
    expect(r.total_marking_material).toBe(parseFloat((10000 * 10 / 100).toFixed(2)))
    expect(r.sub_total_price_material_marking).toBe(10000 + r.total_marking_material)
  })

  test('total_price = sub_material_marked + sub_production_marked', () => {
    const r = calc.calculateTotalPrice(costs, { marking_material_percent: 10, marking_production_percent: 20 }, 10000)
    expect(r.total_price).toBe(r.sub_total_price_material_marking + r.sub_total_price_production_marking)
  })

  test('unit_price_material = sub_material / mainQty', () => {
    const r = calc.calculateTotalPrice(costs, {}, 10000)
    expect(r.unit_price_material).toBe(parseFloat((10000 / 10000).toFixed(2)))
  })
})

describe('[D2] calculateTax', () => {
  const calc = createCalc()

  test('tax_percent = 3 (จาก config)', () => {
    const r = calc.calculateTax(10000)
    expect(r.tax_percent).toBe(3)
  })

  test('tax_price = totalPrice × 3%', () => {
    const r = calc.calculateTax(10000)
    expect(r.tax_price).toBe(300)
  })

  test('total_with_tax = totalPrice + tax_price', () => {
    const r = calc.calculateTax(10000)
    expect(r.total_with_tax).toBe(10300)
  })
})

describe('[D3] calculateUnitPrice', () => {
  const calc = createCalc()

  test('unit_price = total / qty', () => {
    const r = calc.calculateUnitPrice(10000, 1000)
    expect(r.unit_price).toBe(10)
  })

  test('qty = 0 → unit_price = 0', () => {
    const r = calc.calculateUnitPrice(10000, 0)
    expect(r.unit_price).toBe(0)
  })

  test('exchangeRate: unit_price_exchange = unit_price / rate', () => {
    const r = calc.calculateUnitPrice(10000, 1000, 35)
    expect(r.unit_price_exchange).toBe(parseFloat((10 / 35).toFixed(2)))
  })
})

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

describe('lookupPriceRate', () => {
  const calc = createCalc()

  test('price = max(qty×unit_price, min_price)', () => {
    // qty=1 → 1×0.5=0.5 < 500 → ใช้ min_price=500
    const r = calc.lookupPriceRate('print_3col', 1, 'Offset')
    expect(r.price).toBe(500)
  })

  test('qty มาก → price = qty × unit_price', () => {
    const r = calc.lookupPriceRate('print_3col', 2000, 'Offset')
    expect(r.price).toBe(parseFloat((2000 * 0.5).toFixed(2))) // 1000 > 500
  })
})

describe('getAssemblyType', () => {
  const calc = createCalc()

  test('ขนาดเล็ก → assembly_S', () => {
    expect(calc.getAssemblyType([5, 8])).toBe('assembly_S')
  })

  test('ขนาดกลาง → assembly_M', () => {
    expect(calc.getAssemblyType([10, 14])).toBe('assembly_M')
  })

  test('ขนาดใหญ่ → assembly_L', () => {
    expect(calc.getAssemblyType([20, 25])).toBe('assembly_L')
  })
})

describe('getAssemblyFactor', () => {
  const calc = createCalc()

  test.each([
    [1, 1],
    [2, 1.5],
    [3, 1.75],
    [4, 1.9],
    [0, 1],     // default
    [5, 1],     // default
  ])('gluedSpot %i → factor %d', (spot, expected) => {
    expect(calc.getAssemblyFactor(spot)).toBe(expected)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// [E] FULL PIPELINE — calculate()
// ════════════════════════════════════════════════════════════════════════════

describe('[E] calculate() — full pipeline', () => {
  const calc = createCalc()

  const input = {
    qty: 10000,
    printType: 'Offset',
    inkType: 'conventional',
    boxType: 1,
    dimensions: { width: 60, length: 40, depth: 30, tuck_flap: 15, glue_flap: 10 },
    componentType: 1,
    colors: { outside: 4, inside: 0, all: 4 },
    paper: { paper_cost: 45, paper_gram: 300, paper_markup: 10 },
    paperSize: [635, 940],
    rollWidth: 25.5,
    cutOff: 36,
    parallelRollWidth: 'WSize',
    processes: {
      assembly: { gluedSpot: 1 },
      diecut: { hasOppWindow: false },
      chip: true,
      inspection: true,
    },
    addons: {},
    markupConfig: { marking_material_percent: 10, marking_production_percent: 15 },
  }

  let result

  beforeAll(() => {
    result = calc.calculate(input)
  })

  test('มี field ครบ: layout, paperUsage, costs, summary', () => {
    expect(result).toHaveProperty('layout')
    expect(result).toHaveProperty('paperUsage')
    expect(result).toHaveProperty('costs')
    expect(result).toHaveProperty('summary')
  })

  test('layout.ups > 0', () => {
    expect(result.layout.ups).toBeGreaterThan(0)
  })

  test('paperUsage.paper_net > 0', () => {
    expect(result.paperUsage.paper_net).toBeGreaterThan(0)
  })

  test('paperUsage.kilogram > 0', () => {
    expect(result.paperUsage.kilogram).toBeGreaterThan(0)
  })

  test('costs.paper.price > 0', () => {
    expect(result.costs.paper.price).toBeGreaterThan(0)
  })

  test('costs.plate.outside.price > 0 (Offset 4 สี)', () => {
    expect(result.costs.plate.outside.price).toBeGreaterThan(0)
  })

  test('costs.assembly ไม่ใช่ null (processes.assembly ถูกส่ง)', () => {
    expect(result.costs.assembly).not.toBeNull()
  })

  test('costs.diecut ไม่ใช่ null', () => {
    expect(result.costs.diecut).not.toBeNull()
  })

  test('costs.chip ไม่ใช่ null', () => {
    expect(result.costs.chip).not.toBeNull()
  })

  test('costs.inspection ไม่ใช่ null', () => {
    expect(result.costs.inspection).not.toBeNull()
  })

  test('costs.coating = null (ไม่ได้ส่ง addons.coating)', () => {
    expect(result.costs.coating).toBeNull()
  })

  test('summary.tax.total_with_tax > summary.totalPrice.total_price', () => {
    expect(result.summary.tax.total_with_tax).toBeGreaterThan(result.summary.totalPrice.total_price)
  })

  test('summary.unitPrice.unit_price > 0', () => {
    expect(result.summary.unitPrice.unit_price).toBeGreaterThan(0)
  })

  test('qty เพิ่ม → unit_price ลด (scale economy)', () => {
    const small = calc.calculate({ ...input, qty: 1000 })
    const large = calc.calculate({ ...input, qty: 50000 })
    expect(large.summary.unitPrice.unit_price).toBeLessThan(small.summary.unitPrice.unit_price)
  })

  test('Jet Press: plate.price = 0, proof.price > 0', () => {
    const jpResult = calc.calculate({ ...input, printType: 'Jet Press' })
    expect(jpResult.costs.plate.outside.price).toBe(0)
    expect(jpResult.costs.proof.price).toBeGreaterThan(0)
  })

  test('addons.coating → costs.coating ไม่ใช่ null', () => {
    const withCoating = calc.calculate({
      ...input,
      addons: {
        coating: { coatingCode: 'UV', coatingPrice: 0.08, side: 1, minCost: 500, unitMinCost: 'sheet' }
      }
    })
    expect(withCoating.costs.coating).not.toBeNull()
  })
})
