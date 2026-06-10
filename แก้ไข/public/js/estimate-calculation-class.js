/**
 * ═══════════════════════════════════════════════════════════════════════════
 * EstimateCalculation Class
 * ═══════════════════════════════════════════════════════════════════════════
 * Pure JS calculation class สำหรับระบบ Estimate Packaging
 * แยก calculation logic ออกจาก UI — ไม่มี jQuery, DOM, global function
 * รองรับ single qty mode
 *
 * Usage:
 *   const calc = new EstimateCalculation(config, lookupService)
 *   const result = calc.calculate(input)
 *
 * Data Source Convention:
 *   [database: table_name]  — ข้อมูลจาก database
 *   [config: field_name]    — ค่าจาก default.js / config file
 *   [hardcoded]             — ค่า hardcode ใน source code
 *   [input]                 — ค่าที่ผู้ใช้กรอก
 *
 * Source Reference:
 *   function_estimate_calculation.js  — Core calculation (8,813 lines)
 *   function_estimate_layout.js       — Layout computation
 *   data/default.js                   — Config ค่าคงที่
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} Config
 * @property {Object} tolerance                          — [config: default.js > tolerance]
 * @property {number} tolerance.bleed                    — ค่า bleed (mm) default: 3
 * @property {number} tolerance.gripper                  — ค่า gripper (mm) แตกต่างตาม print type
 * @property {number} tolerance.color_bar                — ค่า color_bar (mm)
 * @property {number} tolerance.paper_edge               — ค่า paper_edge (mm)
 * @property {number} plate_price                        — [config: default.js > plate_price] ราคาเพลท Offset (THB/สี)
 * @property {number} plate_polymer_price                — [config: default.js > plate_polymer_price] ราคา polymer Flexo (THB/sq.in)
 * @property {number} reprint_plate_polymer_price        — [config: default.js > reprint_plate_polymer_price]
 * @property {number} cut_1_plate_markup                 — [config: default.js > cut_1_plate_markup] markup เพลท Cut 1 (THB)
 * @property {number} reprintReducePlateCostPercent      — [config: default.js > reprintReducePlateCostPercent] ลด% reprint
 * @property {number} block_polymer_min_price            — [config: default.js > block_polymer_min_price]
 * @property {number} afterpress_price_marking           — [config: default.js > afterpress_price_marking] markup% afterpress
 * @property {number} material_price_marking             — [config: default.js > material_price_marking] markup% วัสดุ
 * @property {number} addon_labor_price_marking          — [config: default.js > addon_labor_price_marking] markup% ค่าแรง addon
 * @property {number} corrugated_assembly_markup_price   — [config: default.js > corrugated_assembly_markup_price]
 * @property {number} corrugated_tolerance               — [config: default.js > corrugated_tolerance] (inch)
 * @property {number} corrugated_glued_cost              — [config: default.js > corrugated_glued_cost] (THB/sq.in)
 * @property {number} delivery_rate                      — [config: default.js > delivery_rate] (THB/ton)
 * @property {number} tax                                — [config: default.js > tax] อัตราภาษี (%)
 * @property {number} formula_value                      — [hardcoded] 1,550,000 ค่าแปลงหน่วย
 * @property {Array} assembly_size                       — [config: default.js > assembly_size] ช่วงขนาด S/M/L
 * @property {Object} print_type_config                  — [config: default.js > print_type_config]
 * @property {Object} packing_info                       — [config: default.js > packing_info]
 * @property {Object} marking                            — [config: default.js > default_marking / profit_sharing]
 * @property {number} foil_width_tolerance               — [config: default.js > foil_width_tolerance] (inch)
 * @property {number} foil_length_tolerance              — [config: default.js > foil_length_tolerance] (inch)
 * @property {number} film_rate                          — [config: default.js > film_rate] (THB/sq.in)
 * @property {number} film_min_cost                      — [config: default.js > film_min_cost] (THB)
 * @property {number} block_foilstamp_min_cost           — [config: default.js > block_foilstamp_min_cost] (THB)
 * @property {number} foilstamp_price                    — [config: default.js > foilstamp_price] (THB/sheet) — ไม่ได้ใช้โดยตรง
 * @property {number} bossing_price                      — [config: default.js > bossing_price] (THB/sheet) — ไม่ได้ใช้โดยตรง
 * @property {number} reprinted_block                    — [config: default.js > reprinted_block] (THB)
 */

/**
 * @typedef {Object} LookupService
 * @property {Function} getPriceRate      — [database: tb_master_price_rate + tb_master_min_price]
 *   (type: string, qty: number, printType: string) → { unit_price, min_price }
 * @property {Function} getWasteRate      — [database: tb_master_waste / jetpress_waste / konica_waste]
 *   (printType: string, afterUps: number) → { print_rate, afterpress_rate, coating_rate, ... }
 * @property {Function} getBlockDiecutRate — [database: tb_master_blockdiecut]
 *   (laySize: [w, l]) → number (rate)
 * @property {Function} getCoatingRate    — [database: tb_master_coating]
 *   (coatingCode: string, size?: [w,l]) → { rate, min_cost, unit_min_cost }
 * @property {Function} getCorrugatedRate — [database: tb_master_corrugated_board]
 *   (grade: string, fluteType: string, qty: number) → number (rate per sq.in)
 * @property {Function} getFoilStampInfo  — [database: tb_master_foilstamp]
 *   (foilCode: string) → { roll_price, roll_min_price, width, length }
 * @property {Function} getBlockStampRate — [database: tb_master_blockstamp]
 *   (stampType: string, depthType: string) → number (rate per sq.in)
 * @property {Function} getSpecialInkInfo — [database: tb_master_special_ink]
 *   (inkProcessId: number) → { price }
 * @property {Function} getSpecialInkFactor — [database: tb_master_special_ink > factor]
 *   (paperCode: string, printStyle: string) → { factor, filling_percent }
 * @property {Function} getJetPressRate   — [database: tb_master_jetpress_info]
 *   (paperSize: [w,l], paperPrint: number) → number (print_price)
 * @property {Function} getStdPaperSize   — [database: tb_master_std_paper + machine_std_paper]
 *   (stdPaperId: number) → { width, length, costWidth, costLength }
 */

class EstimateCalculation {

	constructor(config, lookupService) {
		/** @type {Config} */
		this.config = config
		/** @type {LookupService} */
		this.lookup = lookupService
	}

	// ═══════════════════════════════════════════════════════════════════════
	// [A] LAYOUT CALCULATION
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * แปลง mm เป็น inch
	 * @param {number} mm
	 * @returns {number} inch (ทศนิยม 3 ตำแหน่ง)
	 */
	mm2inch(mm) {
		return parseFloat((mm / 25.4).toFixed(3))
	}

	/**
	 * แปลง inch เป็น mm
	 * @param {number} inch
	 * @returns {number} mm (ทศนิยม 2 ตำแหน่ง)
	 */
	inch2mm(inch) {
		return parseFloat((inch * 25.4).toFixed(2))
	}

	/**
	 * [A1] คำนวณ Open Size (ขนาดกางแผ่น) จาก box template
	 * Source: setCalculateOpenSize() — function_estimate_calculation.js:4023-4115
	 *
	 * @param {number} boxType                — [input] box template type (1-12)
	 * @param {Object} dim                    — [input] ขนาดกล่อง (mm)
	 * @param {number} dim.width              — ความกว้าง (W)
	 * @param {number} dim.length             — ความยาว (L)
	 * @param {number} dim.depth              — ความลึก (D)
	 * @param {number} [dim.tuck_flap=0]      — ฝาเสียบ (T)
	 * @param {number} [dim.glue_flap=0]      — ลิ้นกาว (G)
	 * @param {number} [dim.dust_flap=0]      — ฝาฝุ่น
	 * @param {number} [dim.ol=0]             — overlap
	 * @returns {{ width_in, length_in, width_mm, length_mm }} Open Size [inch, inch, mm, mm]
	 */
	calculateOpenSize(boxType, dim) {
		const { width: W, length: L, depth: D,
			tuck_flap: T = 0, glue_flap: G = 0, dust_flap: dust = 0, ol: OL = 0
		} = dim

		let w_mm, l_mm

		switch (boxType) {
			case 1: // RTE (Reverse Tuck End)
				w_mm = 2 * (W + T) + D
				l_mm = 2 * (W + L) + G
				break
			case 2: // STE (Straight Tuck End)
				w_mm = 2 * (W + T) + D
				l_mm = 2 * (W + L) + G
				break
			case 3: // TTSLB
				w_mm = T + W + D + W / 2 + OL
				l_mm = 2 * (W + L) + G
				break
			case 4: // TTAB
				w_mm = T + W + D + W / 2 + OL
				l_mm = 2 * (W + L) + G
				break
			case 5: // Tray
				w_mm = W + 4 * D
				l_mm = L + 4 * D + 2 * dust
				break
			case 6: // Four Corner
				w_mm = W + 4 * D + 2 * dust + 2 * OL
				l_mm = L + 4 * D + 2 * dust + 2 * OL
				break
			case 7: // Sleeve
				w_mm = 2 * (L + dust) + W
				l_mm = 2 * (L + D) + L
				break
			case 8: // Pillow Box
				w_mm = T + 2 * D + W / 2 + OL
				l_mm = 2 * (W + L) + G
				break
			case 9: // Belly Band / Sleeve (simple)
				w_mm = D
				l_mm = 2 * (W + L) + G
				break
			case 10: // Rigid Box Wrapper
				w_mm = L + D
				l_mm = 2 * W + G
				break
			case 11: // Mailer Box
				w_mm = 2 * W + D
				l_mm = 2 * (W + L) + G
				break
			default:
				w_mm = W
				l_mm = L
				break
		}

		return {
			width_in: this.mm2inch(w_mm),
			length_in: this.mm2inch(l_mm),
			width_mm: w_mm,
			length_mm: l_mm
		}
	}

	/**
	 * [A1.1] คำนวณ Fold Size (ขนาดพับ)
	 * Source: setCalculateFoldSize() — function_estimate_calculation.js:4117-4138
	 *
	 * @param {number} boxType   — [input]
	 * @param {Object} dim       — [input] ขนาดกล่อง (mm)
	 * @returns {{ width_in, length_in, depth_in, width_mm, length_mm, depth_mm }}
	 */
	calculateFoldSize(boxType, dim) {
		const { width: W, length: L, depth: D, tuck_flap: T = 0 } = dim

		if (boxType === 8) {
			return {
				width_in: this.mm2inch(2 * W + T),
				length_in: this.mm2inch(L),
				depth_in: this.mm2inch(D),
				width_mm: 2 * W + T,
				length_mm: L,
				depth_mm: D
			}
		}

		return {
			width_in: this.mm2inch(W),
			length_in: this.mm2inch(L),
			depth_in: this.mm2inch(D),
			width_mm: W,
			length_mm: L,
			depth_mm: D
		}
	}

	/**
	 * [A2] คำนวณ Tolerance (ค่าเผื่อขอบกระดาษ)
	 * Source: setCompTypeTolerance() — function_estimate_calculation.js
	 *         setLayoutTolerance()   — function_estimate_layout.js:3-41
	 *
	 * @param {string} printType         — [input] 'Offset'|'Flexo'|'Jet Press'|'Konica'
	 * @param {number} componentType     — [input] 1=ไม่ประกบ, 2=ประกบ, 3=เฉพาะลูกฟูก
	 * @returns {{ gripper, color_bar, paper_edge, bleed, shortSide, longSide }}
	 *   shortSide/longSide = ค่า tolerance รวมที่บวกเข้าแต่ละด้าน (mm)
	 */
	calculateTolerance(printType, componentType) {
		// [config: default.js > tolerance] — ค่าแตกต่างตาม print type
		const tol = this.config.tolerance
		let gripper, color_bar, paper_edge, bleed

		// ค่า tolerance ตาม print type
		if (typeof tol.gripper === 'object') {
			// กรณีส่ง tolerance แยกตาม print type เช่น { Offset: 12, Flexo: 25, ... }
			gripper = tol.gripper[printType] || tol.gripper.Offset || 12
			color_bar = tol.color_bar[printType] || tol.color_bar.Offset || 8
			paper_edge = tol.paper_edge[printType] || tol.paper_edge.Offset || 4
		} else {
			gripper = tol.gripper || 12
			color_bar = tol.color_bar || 8
			paper_edge = tol.paper_edge || 4
		}
		bleed = tol.bleed || 3

		// คำนวณ shortSide / longSide ตาม component type
		let shortSide, longSide

		switch (componentType) {
			case 1:
			case 2:
				shortSide = gripper + color_bar        // ด้านสั้น = gripper + color_bar
				longSide = paper_edge * 2              // ด้านยาว = paper_edge × 2
				break
			case 3:
				shortSide = gripper + color_bar + (paper_edge * 2) // Flexo: บวก paper_edge ทั้ง 2 ด้าน
				longSide = paper_edge * 2
				break
			default:
				shortSide = gripper + color_bar
				longSide = paper_edge * 2
				break
		}

		return { gripper, color_bar, paper_edge, bleed, shortSide, longSide }
	}

	/**
	 * [A3] คำนวณด้านกว้างของ Layout (WSide)
	 * Source: setCalculateWSide() — function_estimate_layout.js:43-104
	 *
	 * @param {number} wCase   — case number (1.1, 1.2, 2.1, ..., 11.0)
	 * @param {number} n       — จำนวนชิ้นตามแนวกว้าง
	 * @param {number} w       — width (mm)
	 * @param {number} l       — length (mm)
	 * @param {number} d       — depth (mm)
	 * @param {number} b       — bleed (mm) — [config: default.js > tolerance.bleed]
	 * @param {number} dust    — dust flap (mm) — [input]
	 * @param {number} ol      — overlap (mm) — [input]
	 * @param {number} g       — glue flap (mm) — [input]
	 * @param {number} t       — tuck flap (mm) — [input]
	 * @returns {number} ขนาดด้านกว้างรวม (mm)
	 */
	calculateWSide(wCase, n, w, l, d, b, dust, ol, g, t) {
		let side = 0
		switch (wCase) {
			case 1.1: // dust <= (w+t)/2
				side = (n + 1) * (w + t) + n * (2 * b + d)
				break
			case 1.2: // dust > (w+t)/2
				side = 2 * (w + t) + n * (2 * b + d) + (n - 1) * (2 * dust)
				break
			case 2.1: // straight
				side = 2 * (w + t) + n * (2 * b + d) + (n - 1) * (dust + w + t)
				break
			case 2.2: // overlap, dust <= (w+t)/2
				side = (n + 1) * (w + t) + n * (2 * b + d)
				break
			case 2.3: // overlap, dust > (w+t)/2
				side = 2 * (w + t) + n * (2 * b + d) + (n - 1) * (2 * dust)
				break
			case 3.1: // TTSLB straight
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t) + Math.floor(n / 2) * dust
				break
			case 3.2: // TTSLB overlap, dust <= (w+t)/2
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t)
				break
			case 3.3: // TTSLB overlap, dust > (w+t)/2
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t) + Math.floor(n / 2) * (2 * dust - w - t)
				break
			case 4.1: // TTAB straight
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t) + Math.floor(n / 2) * dust
				break
			case 4.2: // TTAB overlap, dust <= (w+t)/2
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t)
				break
			case 4.3: // TTAB overlap, dust > (w+t)/2
				side = n * (ol + w / 2 + 2 * b + d) + (Math.floor(n / 2) + (n % 2)) * (w + t) + Math.floor(n / 2) * (2 * dust - w - t)
				break
			case 5.0: // Tray
				side = n * (w + 4 * d + 2 * b)
				break
			case 6.0: // Four Corner
				side = n * (w + 4 * d + 2 * b + 2 * ol + 2 * dust)
				break
			case 7.1: // Sleeve, glue <= (l+dust)/2
				side = (n + 1) * (l + dust) + n * (2 * b + w)
				break
			case 7.2: // Sleeve, glue > (l+dust)/2
				side = 2 * (l + dust) + n * (w + 2 * b) + 2 * (n - 1) * g
				break
			case 8.1: // Pillow Box
				side = n * (t + 2 * d + 2 * b) + n * w / 2 + (n % 2) * ol
				break
			case 9.0: // Belly Band
				side = n * (d + 2 * b)
				break
			case 10.0: // Rigid Box Wrapper
				side = n * (l + d + 2 * b)
				break
			case 11.0: // Mailer Box
				side = n * (d + 2 * w + 2 * b)
				break
		}
		return side
	}

	/**
	 * [A4] คำนวณด้านยาวของ Layout (LSide)
	 * Source: setCalculateLSide() — function_estimate_layout.js:106-164
	 *
	 * @param {number} lCase   — case number (1.0, 2.0, 2.2, ..., 11.0)
	 * @param {number} n       — จำนวนชิ้นตามแนวยาว
	 * @param {number} w       — width (mm) — [input]
	 * @param {number} l       — length (mm) — [input]
	 * @param {number} d       — depth (mm) — [input]
	 * @param {number} b       — bleed (mm) — [config: default.js > tolerance.bleed]
	 * @param {number} dust    — dust flap (mm) — [input]
	 * @param {number} ol      — overlap (mm) — [input]
	 * @param {number} g       — glue flap (mm) — [input]
	 * @returns {number} ขนาดด้านยาวรวม (mm)
	 */
	calculateLSide(lCase, n, w, l, d, b, dust, ol, g) {
		let side = 0
		switch (lCase) {
			case 1.0: // RTE/STE
				side = n * (2 * (w + l + b) + g)
				break
			case 2.0: // straight
				side = n * (2 * (w + l + b) + g)
				break
			case 2.2: // overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 2.3: // overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 3.0: // TTSLB straight
				side = n * (2 * (w + l + b) + g)
				break
			case 3.2: // TTSLB overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 3.3: // TTSLB overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 4.0: // TTAB straight
				side = n * (2 * (w + l + b) + g)
				break
			case 4.2: // TTAB overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 4.3: // TTAB overlap
				side = 2 * n * (l + b) + (2 * n + 1) * w + (n - 1) * g
				break
			case 5.0: // Tray
				side = n * (l + 4 * d + 2 * b + 2 * dust)
				break
			case 6.0: // Four Corner
				side = n * (l + 4 * d + 2 * b + 2 * dust + 2 * ol)
				break
			case 7.0: // Sleeve
				side = n * (2 * d + 2 * b + 3 * l)
				break
			case 8.0: // Pillow Box (straight)
				side = n * (2 * (w + l + b) + g)
				break
			case 8.1: // Pillow Box (overlap)
				side = 2 * n * (w + l + b) + (n + 1) * g
				break
			case 9.0: // Belly Band
				side = n * (2 * (w + l + b) + g)
				break
			case 10.0: // Rigid Box Wrapper
				side = n * (2 * w + 2 * b + g)
				break
			case 11.0: // Mailer Box
				side = n * (2 * (b + w + l) + g)
				break
		}
		return side
	}

	/**
	 * [A5] บวก Tolerance เข้ากับ Layout Size
	 * Source: setLayoutTolerance() — function_estimate_layout.js:3-41
	 *
	 * @param {number[]} printingSize  — [w_mm, l_mm] ขนาดพิมพ์ (ไม่รวม tolerance)
	 * @param {number} shortSide       — tolerance ด้านสั้น (mm) — จาก calculateTolerance()
	 * @param {number} longSide        — tolerance ด้านยาว (mm) — จาก calculateTolerance()
	 * @returns {{ layout_w_mm, layout_l_mm, layout_w_in, layout_l_in }}
	 */
	applyTolerance(printingSize, shortSide, longSide) {
		let wSide, lSide
		if (printingSize[0] <= printingSize[1]) {
			wSide = printingSize[0] + shortSide
			lSide = printingSize[1] + longSide
		} else {
			wSide = printingSize[0] + longSide
			lSide = printingSize[1] + shortSide
		}

		return {
			layout_w_mm: wSide,
			layout_l_mm: lSide,
			layout_w_in: this.mm2inch(wSide),
			layout_l_in: this.mm2inch(lSide)
		}
	}

	/**
	 * [A6] คำนวณ Layout — หาจำนวน UPS ที่วางได้บนกระดาษ (straight layout)
	 * Source: calculateStraightPrintSize() — function_estimate_layout.js:374-560
	 *
	 * คำนวณโดยลอง n=1,2,3... จนกว่าจะเกินขนาดกระดาษ
	 * ทดสอบทั้ง vertical (แนวตั้ง) และ horizontal (แนวนอน)
	 *
	 * @param {Object} params
	 * @param {number} params.boxType              — [input] box template type
	 * @param {Object} params.dimensions           — [input] { width, length, depth, tuck_flap, glue_flap, dust_flap, ol }
	 * @param {number} params.bleed                — [config: default.js > tolerance.bleed]
	 * @param {number[]} params.paperSize           — [w_mm, l_mm] ขนาดกระดาษพิมพ์ได้
	 * @param {number} params.shortSide            — tolerance ด้านสั้น (mm) — จาก calculateTolerance()
	 * @param {number} params.longSide             — tolerance ด้านยาว (mm) — จาก calculateTolerance()
	 * @returns {Array<{ laying, layout, num_laying, printSize, layoutSize }>} layout options
	 */
	calculateLayout(params) {
		const { boxType, dimensions, bleed: b, paperSize, shortSide, longSide } = params
		const { width: w, length: l, depth: d, tuck_flap: t = 0,
			glue_flap: g = 0, dust_flap: dust = 0, ol = 0 } = dimensions

		// กำหนด wCase / lCase ตาม box type
		const cases = this._getLayoutCases(boxType, dimensions)
		const results = []

		// ลอง vertical & horizontal
		for (const { wCase, lCase, label } of cases) {
			// Vertical: W → paperW, L → paperL
			const vResult = this._tryLayout(wCase, lCase, w, l, d, b, dust, ol, g, t,
				paperSize[0], paperSize[1], shortSide, longSide, 'vertical')
			if (vResult) results.push({ ...vResult, label })

			// Horizontal: W → paperL, L → paperW (สลับด้าน)
			const hResult = this._tryLayout(wCase, lCase, w, l, d, b, dust, ol, g, t,
				paperSize[1], paperSize[0], shortSide, longSide, 'horizontal')
			if (hResult) results.push({ ...hResult, label })
		}

		return results
	}

	/**
	 * หา layout cases ตาม box type
	 * @private
	 */
	_getLayoutCases(boxType, dim) {
		const { dust_flap: dust = 0, tuck_flap: t = 0, width: w = 0,
			length: l = 0, glue_flap: g = 0 } = dim
		const cases = []

		switch (boxType) {
			case 1: // RTE
				if (dust <= (w + t) / 2) {
					cases.push({ wCase: 1.1, lCase: 1.0, label: 'RTE straight' })
				} else {
					cases.push({ wCase: 1.2, lCase: 1.0, label: 'RTE straight (large dust)' })
				}
				break
			case 2: // STE
				cases.push({ wCase: 2.1, lCase: 2.0, label: 'STE straight' })
				if (dust <= (w + t) / 2) {
					cases.push({ wCase: 2.2, lCase: 2.2, label: 'STE overlap' })
				} else {
					cases.push({ wCase: 2.3, lCase: 2.3, label: 'STE overlap (large dust)' })
				}
				break
			case 3: // TTSLB
				cases.push({ wCase: 3.1, lCase: 3.0, label: 'TTSLB straight' })
				if (dust <= (w + t) / 2) {
					cases.push({ wCase: 3.2, lCase: 3.2, label: 'TTSLB overlap' })
				} else {
					cases.push({ wCase: 3.3, lCase: 3.3, label: 'TTSLB overlap (large dust)' })
				}
				break
			case 4: // TTAB
				cases.push({ wCase: 4.1, lCase: 4.0, label: 'TTAB straight' })
				if (dust <= (w + t) / 2) {
					cases.push({ wCase: 4.2, lCase: 4.2, label: 'TTAB overlap' })
				} else {
					cases.push({ wCase: 4.3, lCase: 4.3, label: 'TTAB overlap (large dust)' })
				}
				break
			case 5:
				cases.push({ wCase: 5.0, lCase: 5.0, label: 'Tray' })
				break
			case 6:
				cases.push({ wCase: 6.0, lCase: 6.0, label: 'Four Corner' })
				break
			case 7:
				if (g <= (l + dust) / 2) {
					cases.push({ wCase: 7.1, lCase: 7.0, label: 'Sleeve' })
				} else {
					cases.push({ wCase: 7.2, lCase: 7.0, label: 'Sleeve (large glue)' })
				}
				break
			case 8:
				cases.push({ wCase: 8.1, lCase: 8.0, label: 'Pillow straight' })
				cases.push({ wCase: 8.1, lCase: 8.1, label: 'Pillow overlap' })
				break
			case 9:
				cases.push({ wCase: 9.0, lCase: 9.0, label: 'Belly Band' })
				break
			case 10:
				cases.push({ wCase: 10.0, lCase: 10.0, label: 'Rigid Wrapper' })
				break
			case 11:
				cases.push({ wCase: 11.0, lCase: 11.0, label: 'Mailer Box' })
				break
			default:
				cases.push({ wCase: 1.1, lCase: 1.0, label: 'default' })
				break
		}

		return cases
	}

	/**
	 * ลอง layout ทีละด้าน — หาจำนวน n_w, n_l สูงสุดที่พอดีกระดาษ
	 * @private
	 */
	_tryLayout(wCase, lCase, w, l, d, b, dust, ol, g, t, maxW, maxL, shortSide, longSide, laying) {
		let bestW = 0, bestL = 0

		// หา n_w สูงสุด
		for (let nw = 1; nw <= 50; nw++) {
			const wSide = this.calculateWSide(wCase, nw, w, l, d, b, dust, ol, g, t)
			const printW = wSide
			// apply tolerance ง่าย: บวกด้านสั้น/ยาวตาม side
			const layoutW = printW + (printW <= maxL ? shortSide : longSide)
			if (layoutW > maxW) break
			bestW = nw
		}

		// หา n_l สูงสุด
		for (let nl = 1; nl <= 50; nl++) {
			const lSide = this.calculateLSide(lCase, nl, w, l, d, b, dust, ol, g)
			const printL = lSide
			const layoutL = printL + (printL <= maxW ? longSide : shortSide)
			if (layoutL > maxL) break
			bestL = nl
		}

		if (bestW <= 0 || bestL <= 0) return null

		const printSize_w = this.calculateWSide(wCase, bestW, w, l, d, b, dust, ol, g, t)
		const printSize_l = this.calculateLSide(lCase, bestL, w, l, d, b, dust, ol, g)
		const layoutSize = this.applyTolerance([printSize_w, printSize_l], shortSide, longSide)

		return {
			laying,
			layout: [bestW, bestL],
			num_laying: bestW * bestL,
			printSize: [printSize_w, printSize_l],
			layoutSize
		}
	}

	/**
	 * [A7] เลือก Layout ที่ดีที่สุด — UPS สูงสุด, waste น้อยสุด
	 * Source: checkMaximunNumLayout() / checkMinAreaUsageLayout()
	 *
	 * @param {Array} layouts            — ผลลัพธ์จาก calculateLayout()
	 * @param {number[]} paperSize        — [w_mm, l_mm]
	 * @returns {Object|null} layout ที่ดีที่สุด
	 */
	selectBestLayout(layouts, paperSize) {
		if (!layouts || layouts.length === 0) return null

		// เลือก layout ที่มี num_laying สูงสุด
		const maxUps = Math.max(...layouts.map(l => l.num_laying))
		const candidates = layouts.filter(l => l.num_laying === maxUps)

		if (candidates.length === 1) return candidates[0]

		// ถ้ามีเท่ากัน เลือกที่ใช้พื้นที่กระดาษน้อยสุด (waste น้อยสุด)
		const paperArea = paperSize[0] * paperSize[1]
		let bestLayout = candidates[0]
		let minWaste = Infinity

		for (const layout of candidates) {
			const usedArea = layout.layoutSize.layout_w_mm * layout.layoutSize.layout_l_mm
			const waste = paperArea - usedArea
			if (waste < minWaste) {
				minWaste = waste
				bestLayout = layout
			}
		}

		return bestLayout
	}

	// ═══════════════════════════════════════════════════════════════════════
	// [B] PAPER USAGE CALCULATION
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * [B1] คำนวณ Split (จำนวนแผ่นพิมพ์ต่อแผ่นกระดาษมาตรฐาน)
	 * Source: setCalculateSplit() — function_estimate_calculation.js:3439-3487
	 *
	 * @param {number} rollWidth           — [database: machine_std_paper > std_paper_size_width_in] (inch)
	 * @param {number} cutOff              — [database: machine_std_paper > std_paper_size_length_in] (inch)
	 * @param {number[]} laySize            — [w_in, l_in] layout size (inch) — จาก calculateLayout()
	 * @param {string} parallelRollWidth   — 'WSize'|'LSize' ทิศทางกระดาษ
	 * @returns {number} split count
	 */
	calculateSplit(rollWidth, cutOff, laySize, parallelRollWidth) {
		let wSide, lSide

		if (parallelRollWidth === 'WSize') {
			wSide = Math.floor(rollWidth / laySize[0])
			lSide = Math.floor(cutOff / laySize[1])
		} else { // 'LSize'
			wSide = Math.floor(rollWidth / laySize[1])
			lSide = Math.floor(cutOff / laySize[0])
		}

		return Math.max(wSide * lSide, 1)
	}

	/**
	 * [B2] คำนวณ Waste (เศษกระดาษสูญเสีย)
	 * Source: setWaste() — function_estimate_calculation.js:848-1046
	 *
	 * @param {Object} params
	 * @param {string} params.printType              — [input] 'Offset'|'Flexo'|'Jet Press'|'Konica'
	 * @param {number} params.afterUps               — จำนวนใบพิมพ์ (qty/ups)
	 * @param {number} params.outsideColors           — [input] จำนวนสีด้านนอก
	 * @param {number} params.insideColors            — [input] จำนวนสีด้านใน
	 * @param {number} params.allColors               — [input] จำนวนสีรวม
	 * @param {number} params.componentType           — [input] 1|2|3
	 * @param {boolean} [params.isDigitalDiecut=false] — [input]
	 * @param {boolean} [params.isColorLimit=false]    — [input]
	 * @param {Object} params.addons                  — { hasCoating, coatingSide, hasFoilstamp, hasEmboss, hasDeboss }
	 * @returns {Object} { totalWaste, waste_print, waste_afterpress, waste_coating, waste_details }
	 */
	calculateWaste(params) {
		const {
			printType, afterUps, outsideColors = 0, insideColors = 0, allColors = 0,
			componentType, isDigitalDiecut = false, isColorLimit = false,
			addons = {}
		} = params

		// [database: tb_master_waste / tb_master_jetpress_waste / tb_master_konica_waste]
		const wasteRate = this.lookup.getWasteRate(printType, afterUps)
		const wasteRateOffset = this.lookup.getWasteRate(null, afterUps) // Offset rates สำหรับ afterpress

		// [config: default.js > print_type_config]
		const printConfig = this.config.print_type_config?.[printType] || {}
		let wasteReducePercent = printConfig.reduce_paper_waste_percent || 0

		// Waste print
		let wastePrint = wasteRate.print_rate || 0
		if (wastePrint < 1) { // rate เป็น % ต้องคูณ
			wastePrint = Math.ceil(afterUps * wastePrint)
		}

		// Waste afterpress
		let wasteAfterpress = wasteRateOffset.afterpress_rate || 0
		if (wasteAfterpress < 1) {
			wasteAfterpress = Math.ceil(afterUps * wasteAfterpress)
		}

		// Waste coating (base)
		let wasteCoating = wasteRateOffset.coating_rate || 0

		// Corrugated glued waste (type 2,3)
		if (componentType !== 1) {
			wasteAfterpress += (wasteRateOffset.corrugatedglued_rate || 0)
		}

		// Color limit waste
		let wasteColorLimit = 0
		if ([1, 2].includes(componentType) && isColorLimit) {
			const maxColor = this.config.print_type_config?.color_limit?.max_color || 4
			const clWaste = printConfig.color_limit_waste?.waste || 0
			const clPerColor = printConfig.color_limit_waste?.waste_per_color || 0

			if (outsideColors > 0) {
				wasteColorLimit += clWaste
				if (outsideColors > 4) wasteColorLimit += (outsideColors - maxColor) * clPerColor
			}
			if (insideColors > 0) {
				wasteColorLimit += clWaste
				if (insideColors > 4) wasteColorLimit += (insideColors - maxColor) * clPerColor
			}
		}

		// Digital die-cut adjustments
		let wasteAfterpressNet = 0
		let wasteCoatingNet = 0
		if (isDigitalDiecut) {
			wasteReducePercent += (printConfig.reduce_paper_waste_percent_digital_diecut || 0)
			wasteAfterpressNet = wasteRate.digital_diecut_rate || 0
			wasteCoatingNet = wasteRate.coating_rate || 0
			wasteAfterpress = 0
			wasteCoating = 0
		}

		// Other waste rates
		const wastePrintColAdd = wasteRateOffset.print_col_add_rate || 0
		const wasteFoilstamp = wasteRateOffset.foilstamp_rate || 0
		const wasteBossing = wasteRateOffset.bossing_rate || 0
		const wasteCorrugatedBoard = wasteRateOffset.corrugated_board_rate || 0

		// Apply waste reduction
		const applyReduce = (val) => Math.ceil((val - Math.ceil(val * wasteReducePercent / 100)) || 0)

		const reduced = {
			wasteAfterpress: applyReduce(wasteAfterpress),
			wasteCoating: applyReduce(wasteCoating),
			wasteFoilstamp: applyReduce(wasteFoilstamp),
			wasteBossing: applyReduce(wasteBossing),
			wasteCorrugatedBoard: applyReduce(wasteCorrugatedBoard),
			wastePrintColAdd: applyReduce(wastePrintColAdd),
		}

		// SUM waste
		let totalWaste = 0

		// Print waste (Jet Press/Konica: คิดแยก inside/outside)
		if (['Jet Press', 'Konica'].includes(printType)) {
			if (outsideColors > 0) totalWaste += wastePrint
			if (insideColors > 0) totalWaste += wastePrint
		} else {
			totalWaste += wastePrint
		}

		totalWaste += wasteColorLimit
		totalWaste += reduced.wasteAfterpress
		totalWaste += wasteAfterpressNet

		// Color add waste (> 4 สี)
		if (allColors > 4 && !['Jet Press', 'Konica'].includes(printType)) {
			totalWaste += (allColors - 4) * reduced.wastePrintColAdd
		}

		// Addon waste
		if (addons.hasCoating) {
			const side = addons.coatingSide || 1
			totalWaste += side * reduced.wasteCoating
			totalWaste += side * wasteCoatingNet
		}
		if (addons.hasFoilstamp) totalWaste += reduced.wasteFoilstamp
		if (addons.hasEmboss) totalWaste += reduced.wasteBossing
		if (addons.hasDeboss) totalWaste += reduced.wasteBossing

		return {
			totalWaste,
			waste_print: wastePrint,
			waste_afterpress: reduced.wasteAfterpress,
			waste_coating: reduced.wasteCoating,
			waste_color_limit: wasteColorLimit,
			waste_corrugated_board: reduced.wasteCorrugatedBoard,
			waste_reduce_percent: wasteReducePercent,
			waste_details: {
				wasteFoilstamp: reduced.wasteFoilstamp,
				wasteBossing: reduced.wasteBossing,
				wasteAfterpressNet,
				wasteCoatingNet
			}
		}
	}

	/**
	 * [B3] คำนวณ Paper Usage — pipeline ตั้งแต่ qty จนถึง kg/ton
	 * Source: setCalculatePaperWeight() — function_estimate_calculation.js:3489-3571
	 *
	 * สูตร:
	 *   after_ups  = ceil(qty / ups)
	 *   waste      = calculateWaste(...)
	 *   after_waste = after_ups + totalWaste
	 *   paper_print = after_waste × sig
	 *   paper_qty  = ceil(paper_print / split)
	 *   paper_net  = ceil(paper_qty / 100) × 100   // [hardcoded] ปัดขึ้น 100
	 *   kilogram   = paper_net × gram / 1,550,000 × roll_width × cut_off  // [hardcoded: formula_value]
	 *   ton        = kilogram / 1000
	 *
	 * @param {Object} params
	 * @param {number} params.qty            — [input] จำนวนชิ้น
	 * @param {number} params.ups            — จำนวน UPS — จาก layout
	 * @param {number} params.sig            — signature (default: 1)
	 * @param {number} params.split          — split — จาก calculateSplit()
	 * @param {number} params.totalWaste     — waste — จาก calculateWaste()
	 * @param {number} params.gram           — [database: tb_master_paper > gram] GSM กระดาษ
	 * @param {number} params.rollWidth      — [database: machine_std_paper] (inch)
	 * @param {number} params.cutOff         — [database: machine_std_paper] (inch)
	 * @param {string} params.printType      — [input] 'Offset'|'Flexo'|'Jet Press'|'Konica'
	 * @returns {Object} { after_ups, after_waste, paper_print, paper_qty, paper_net, kilogram, ton }
	 */
	calculatePaperUsage(params) {
		const { qty, ups, sig = 1, split, totalWaste, gram, rollWidth, cutOff, printType } = params

		const after_ups = Math.ceil(qty / ups)
		const after_waste = after_ups + totalWaste
		const paper_print = after_waste * sig
		const paper_qty = Math.ceil(paper_print / split)

		// [hardcoded] ปัดขึ้นทีละ 100 แผ่น (ยกเว้น Konica ไม่ปัด)
		let paper_net = Math.ceil(paper_qty / 100) * 100
		if (printType === 'Konica') {
			paper_net = paper_qty
		}

		// [hardcoded: formula_value = 1,550,000]
		const formulaValue = this.config.formula_value || 1550000
		const kilogram = parseFloat((paper_net * gram / formulaValue * rollWidth * cutOff).toFixed(2))
		const ton = parseFloat((kilogram / 1000).toFixed(3))

		return { after_ups, after_waste, paper_print, paper_qty, paper_net, kilogram, ton }
	}

	// ═══════════════════════════════════════════════════════════════════════
	// [C] COST CALCULATIONS (16 รายการ)
	// ═══════════════════════════════════════════════════════════════════════

	// ─── Helper: Lookup Price Rate ────────────────────────────────────────

	/**
	 * [Helper] ค้นหา price rate จาก database
	 * Source: setPriceRate() — function_estimate_calculation.js:1048-1136
	 *
	 * @param {string} type       — ประเภท: 'print_1col'|'print_3col'|'print_5col'|'print_flexo'|
	 *                              'diecut'|'foilstamp'|'bossing'|'chip'|'inspection'|'trim'|
	 *                              'assembly_S'|'assembly_M'|'assembly_L'
	 * @param {number} qty        — [input] จำนวน
	 * @param {string} printType  — [input] print type (สำหรับ min_price lookup)
	 * @returns {{ unit_price: number, min_price: number, price: number }}
	 */
	lookupPriceRate(type, qty, printType = 'Offset') {
		// [database: tb_master_price_rate] + [database: tb_master_min_price]
		const result = this.lookup.getPriceRate(type, qty, printType)
		const unit_price = result?.unit_price || 0
		const min_price = result?.min_price || 0
		const price = (qty * unit_price < min_price) ? min_price : parseFloat((qty * unit_price).toFixed(2))

		return { unit_price, min_price, price }
	}

	/**
	 * [Helper] กำหนดประเภท Assembly ตาม Open Size
	 * Source: setAssemblyType() — function_estimate_calculation.js:1185-1197
	 *
	 * @param {number[]} openSize  — [w_in, l_in] ขนาด open size (inch)
	 * @returns {string} 'assembly_S'|'assembly_M'|'assembly_L'
	 */
	getAssemblyType(openSize) {
		// [config: default.js > assembly_size]
		const sizes = this.config.assembly_size || []
		for (const item of sizes) {
			if (openSize[0] <= item.width && openSize[1] <= item.length) {
				return item.type
			}
		}
		return 'assembly_L'
	}

	/**
	 * [Helper] Assembly Factor ตามจำนวน glued_spot
	 * Source: getAssemblyFactor() — function_estimate_calculation.js:6901-6913
	 *
	 * @param {number} gluedSpot — [input] จำนวนจุดกาว (1-4) — [hardcoded]
	 * @returns {number} factor (1 | 1.5 | 1.75 | 1.9)
	 */
	getAssemblyFactor(gluedSpot) {
		// [hardcoded]
		switch (gluedSpot) {
			case 1: return 1
			case 2: return 1.5
			case 3: return 1.75
			case 4: return 1.9
			default: return 1
		}
	}

	// ─── C1: Paper Cost ──────────────────────────────────────────────────

	/**
	 * [C1] คำนวณต้นทุนกระดาษ
	 * Source: setCalculatePaperCost() — function_estimate_calculation.js:3573-3618
	 *
	 * สูตร:
	 *   paper_total_price = paper_cost × (1 + markup/100) + paper_percent
	 *   unit_price = roll_width × cut_off × paper_total_price × gram / 1,550,000  (THB/kg mode)
	 *   หรือ unit_price = paper_total_price  (THB/sheet mode)
	 *   price = paper_net × unit_price
	 *
	 * @param {Object} paperInfo
	 * @param {number} paperInfo.paper_cost          — [database: tb_master_paper > price] ราคากระดาษ
	 * @param {number} paperInfo.paper_gram           — [database: tb_master_paper > gram] GSM
	 * @param {number} paperInfo.paper_markup         — [config: default.js > paper_price_marking] (10%|13%|18%)
	 * @param {number} [paperInfo.paper_percent=0]    — [input] ส่วนเพิ่มราคากระดาษ (THB)
	 * @param {boolean} [paperInfo.sheet_unit_price=false] — [input] true = ราคาต่อแผ่น
	 * @param {number} rollWidth                     — [database: machine_std_paper > width_in]
	 * @param {number} cutOff                        — [database: machine_std_paper > length_in]
	 * @param {number} paperNet                      — จาก calculatePaperUsage().paper_net
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculatePaperCost(paperInfo, rollWidth, cutOff, paperNet) {
		const {
			paper_cost, paper_gram, paper_markup,
			paper_percent = 0, sheet_unit_price = false
		} = paperInfo

		const formulaValue = this.config.formula_value || 1550000

		// [config: default.js > paper_price_marking]
		const paper_total_price = parseFloat(
			((paper_cost * (1 + paper_markup / 100)) + paper_percent).toFixed(2)
		)

		let unit_price = 0
		if (sheet_unit_price) {
			// ราคาต่อแผ่น (THB/sheet)
			unit_price = paper_total_price
		} else {
			// ราคาต่อ kg → แปลงเป็น THB/sheet
			// [hardcoded: formula_value = 1,550,000]
			unit_price = parseFloat((rollWidth * cutOff * paper_total_price * paper_gram / formulaValue).toFixed(2))
		}

		return {
			qty: paperNet,
			unit_price,
			price: parseFloat((paperNet * unit_price).toFixed(2))
		}
	}

	// ─── C2: Plate Cost ──────────────────────────────────────────────────

	/**
	 * [C2] คำนวณต้นทุนเพลท
	 * Source: setCalculatePlateCost() — function_estimate_calculation.js:3621-3795
	 *
	 * สูตร Offset:
	 *   plate_ppu = plate_price + cut1_markup (reprint: ลด reprintReducePlateCostPercent%)
	 *   qty = max(round(after_waste / 100000), 1) × colors × sig
	 *   price = qty × plate_ppu
	 *
	 * สูตร Flexo:
	 *   plate_ppu = polymer_price × flexo_w × flexo_l
	 *   price = plate_ppu × ups × colors (min: block_polymer_min_price)
	 *
	 * Jet Press / Konica: ไม่มีค่าเพลท
	 *
	 * @param {Object} params
	 * @param {string} params.printType             — [input]
	 * @param {number} params.outsideColors          — [input] จำนวนสีด้านนอก
	 * @param {number} params.insideColors           — [input] จำนวนสีด้านใน
	 * @param {number} params.afterWaste             — จาก calculatePaperUsage().after_waste
	 * @param {number} [params.sig=1]                — signature
	 * @param {number} [params.ups=1]                — UPS (Flexo ใช้)
	 * @param {boolean} [params.isCut1=false]        — เครื่อง Cut 1 → +markup — [input]
	 * @param {boolean} [params.isReprinted=false]   — งาน reprint — [input]
	 * @param {boolean} [params.isUsePrevPlate=false] — ใช้เพลทเดิม — [input]
	 * @param {number[]} [params.flexoSize=[0,0]]     — [input] ขนาด Flexo [w_in, l_in]
	 * @returns {{ outside: {qty,unit_price,price}, inside: {qty,unit_price,price}, reprint?: {...} }}
	 */
	calculatePlateCost(params) {
		const {
			printType, outsideColors = 0, insideColors = 0, afterWaste = 0,
			sig = 1, ups = 1, isCut1 = false, isReprinted = false,
			isUsePrevPlate = false, flexoSize = [0, 0]
		} = params

		// [config: default.js > plate_price, plate_polymer_price, ...]
		const {
			plate_price: defaultPlatePrice = 800,
			plate_polymer_price = 6.53,
			reprint_plate_polymer_price = 5.94,
			cut_1_plate_markup = 50,
			reprintReducePlateCostPercent = 50,
			block_polymer_min_price = 50
		} = this.config

		const zero = { qty: 0, unit_price: 0, price: 0 }

		switch (printType) {
			case 'Offset': {
				let plateMarkup = isCut1 ? cut_1_plate_markup : 0
				let platePpu = defaultPlatePrice

				// [config: default.js > reprintReducePlateCostPercent]
				if (isReprinted && isUsePrevPlate) {
					platePpu = platePpu - (platePpu * (reprintReducePlateCostPercent / 100))
				}
				platePpu += plateMarkup

				let qty = Math.max(Math.round(afterWaste / 100000), 1)
				let reprintQty = qty > 1 ? qty - 1 : 0

				let unitOut = parseFloat((outsideColors * sig * platePpu).toFixed(2))
				let unitIn = parseFloat((insideColors * sig * platePpu).toFixed(2))
				let priceOut = unitOut * qty
				let priceIn = unitIn * qty

				let reprint = { outside: zero, inside: zero }

				// Reprint plate: ถ้าไม่ใช้เพลทเดิม แต่ qty > 1 → แยก reprint
				if (!isUsePrevPlate && qty > 1) {
					qty = 1
					priceOut = unitOut
					priceIn = unitIn

					const reprintPpu = (defaultPlatePrice - (defaultPlatePrice * reprintReducePlateCostPercent / 100)) + plateMarkup
					const rUnitOut = parseFloat((outsideColors * sig * reprintPpu).toFixed(2))
					const rUnitIn = parseFloat((insideColors * sig * reprintPpu).toFixed(2))

					reprint = {
						outside: { qty: reprintQty, unit_price: rUnitOut, price: rUnitOut * reprintQty },
						inside: { qty: reprintQty, unit_price: rUnitIn, price: rUnitIn * reprintQty }
					}
				}

				return {
					outside: { qty, unit_price: unitOut, price: priceOut },
					inside: { qty, unit_price: unitIn, price: priceIn },
					reprint
				}
			}

			case 'Flexo': {
				// [config: default.js > plate_polymer_price]
				const polymerPrice = isReprinted ? reprint_plate_polymer_price : plate_polymer_price
				const platePpu = parseFloat((polymerPrice * flexoSize[0] * flexoSize[1]).toFixed(2))

				const outPrice = parseFloat((platePpu * ups * outsideColors).toFixed(2))
				const inPrice = parseFloat((platePpu * ups * insideColors).toFixed(2))

				return {
					outside: {
						qty: ups * outsideColors,
						unit_price: platePpu,
						price: outPrice > 0 && outPrice < block_polymer_min_price ? block_polymer_min_price : outPrice
					},
					inside: {
						qty: ups * insideColors,
						unit_price: platePpu,
						price: inPrice > 0 && inPrice < block_polymer_min_price ? block_polymer_min_price : inPrice
					},
					reprint: { outside: zero, inside: zero }
				}
			}

			case 'Jet Press':
			case 'Konica':
			default:
				return {
					outside: zero,
					inside: zero,
					reprint: { outside: zero, inside: zero }
				}
		}
	}

	// ─── C3: Proof Cost ──────────────────────────────────────────────────

	/**
	 * [C3] คำนวณต้นทุน Proof
	 * Source: setCalculateProofCost() — function_estimate_calculation.js:3990-4019
	 *
	 * สำหรับ Jet Press / Konica เท่านั้น
	 *
	 * @param {string} printType         — [input]
	 * @param {number} [componentCount=1] — จำนวน component
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateProofCost(printType, componentCount = 1) {
		if (!['Jet Press', 'Konica'].includes(printType)) {
			return { qty: 0, unit_price: 0, price: 0 }
		}

		// [config: default.js > print_type_config > proof_price_per_component]
		const printConfig = this.config.print_type_config?.[printType] || {}
		const unitPrice = printConfig.proof_price_per_component || 500 // 500 Jet Press, 200 Konica

		return {
			qty: componentCount,
			unit_price: unitPrice,
			price: componentCount * unitPrice
		}
	}

	// ─── C4: Print Cost ──────────────────────────────────────────────────

	/**
	 * [C4] คำนวณต้นทุนพิมพ์
	 * Source: setCalculatePrintCost() — function_estimate_calculation.js:3798-3988
	 *
	 * สูตร Offset:
	 *   type = colors < 3 ? 'print_1col' : colors <= 4 ? 'print_3col' : 'print_5col'
	 *   price_rate = lookupPriceRate(type, after_ups)
	 *   ink_factor = 2.5 สำหรับ UV ink — [hardcoded]
	 *   price = ink_factor × price_rate.price × colors × sig
	 *
	 * สูตร Konica:
	 *   3 THB/ใบพิมพ์/ด้าน (1 THB ถ้าพิมพ์ขาวดำ) — [hardcoded]
	 *
	 * สูตร Jet Press:
	 *   price = lookupJetPressRate(paperSize, paper_print) × paper_print × ด้าน
	 *
	 * @param {Object} params
	 * @param {string} params.printType             — [input]
	 * @param {string} params.inkType               — [input] 'UV'|'conventional'
	 * @param {number} params.outsideColors          — [input]
	 * @param {number} params.insideColors           — [input]
	 * @param {number} params.afterUps               — จาก calculatePaperUsage()
	 * @param {number} params.paperPrint             — จาก calculatePaperUsage()
	 * @param {number} [params.sig=1]                — signature
	 * @param {boolean} [params.isProfitSharing=false] — [input] profit sharing mode
	 * @param {boolean} [params.isBlackPrintingOutside=false] — [input] พิมพ์ขาวดำด้านนอก
	 * @param {boolean} [params.isBlackPrintingInside=false]  — [input] พิมพ์ขาวดำด้านใน
	 * @param {number[]} [params.paperSize=[0,0]]     — [input] ขนาดกระดาษ [w_mm, l_mm] สำหรับ Jet Press
	 * @returns {{ outside: {qty,unit_price,price}, inside: {qty,unit_price,price} }}
	 */
	calculatePrintCost(params) {
		const {
			printType, inkType = 'conventional', outsideColors = 0, insideColors = 0,
			afterUps = 0, paperPrint = 0, sig = 1, isProfitSharing = false,
			isBlackPrintingOutside = false, isBlackPrintingInside = false,
			paperSize = [0, 0]
		} = params

		let unitOut = 0, qtyOut = 0, priceOut = 0
		let unitIn = 0, qtyIn = 0, priceIn = 0

		switch (printType) {
			case 'Offset':
			case 'Flexo': {
				if (isProfitSharing) {
					// [config: default.js > profit_sharing > print]
					const psConfig = this.config.marking?.profit_sharing?.print || {}
					let printPrice = parseFloat((afterUps * (psConfig.print_rate || 0.14)).toFixed(4))
					if (printPrice < (psConfig.print_min_price || 1400)) {
						printPrice = psConfig.print_min_price || 1400
					}

					unitOut = parseFloat((printPrice * outsideColors * sig).toFixed(2))
					qtyOut = 1
					priceOut = unitOut

					unitIn = parseFloat((printPrice * insideColors * sig).toFixed(2))
					qtyIn = 1
					priceIn = unitIn
				} else {
					// กำหนด type ตามจำนวนสี
					const getType = (colors) => {
						if (printType === 'Flexo') return 'print_flexo'
						return colors < 3 ? 'print_1col' : colors < 5 ? 'print_3col' : 'print_5col'
					}

					// [database: tb_master_price_rate]
					const rateOut = this.lookupPriceRate(getType(outsideColors), afterUps, printType)
					const rateIn = this.lookupPriceRate(getType(insideColors), afterUps, printType)

					// [hardcoded] ink_factor: UV = 2.5, conventional = 1.0
					const inkFactor = inkType === 'UV' ? 2.5 : 1.0

					unitOut = parseFloat((inkFactor * rateOut.price * outsideColors * sig).toFixed(2))
					qtyOut = 1
					priceOut = unitOut

					unitIn = parseFloat((inkFactor * rateIn.price * insideColors * sig).toFixed(2))
					qtyIn = 1
					priceIn = unitIn
				}
				break
			}

			case 'Konica': {
				// [hardcoded] 3 THB/ใบ/ด้าน, 1 THB ถ้าพิมพ์ขาวดำ
				let ppOut = outsideColors > 0 ? 3 : 0
				let ppIn = insideColors > 0 ? 3 : 0

				if (isBlackPrintingOutside) ppOut = 1
				if (isBlackPrintingInside) ppIn = 1

				const colFactorOut = outsideColors > 0 ? 1 : 0
				const colFactorIn = insideColors > 0 ? 1 : 0

				unitOut = colFactorOut * ppOut
				qtyOut = paperPrint
				priceOut = parseFloat((unitOut * qtyOut).toFixed(2))

				unitIn = colFactorIn * ppIn
				qtyIn = paperPrint
				priceIn = parseFloat((unitIn * qtyIn).toFixed(2))
				break
			}

			case 'Jet Press': {
				// [database: tb_master_jetpress_info]
				const jpPrice = this.lookup.getJetPressRate(paperSize, paperPrint) || 1
				const colFactorOut = outsideColors > 0 ? 1 : 0
				const colFactorIn = insideColors > 0 ? 1 : 0

				unitOut = colFactorOut * jpPrice
				qtyOut = paperPrint
				priceOut = parseFloat((unitOut * qtyOut).toFixed(2))

				unitIn = colFactorIn * jpPrice
				qtyIn = paperPrint
				priceIn = parseFloat((unitIn * qtyIn).toFixed(2))
				break
			}
		}

		return {
			outside: { qty: qtyOut, unit_price: unitOut, price: priceOut },
			inside: { qty: qtyIn, unit_price: unitIn, price: priceIn }
		}
	}

	// ─── C5: Coating Cost ────────────────────────────────────────────────

	/**
	 * [C5] คำนวณต้นทุน Coating / Varnish
	 * Source: setCalculateCoatingCost() — function_estimate_calculation.js:5967-6044
	 *
	 * สูตร:
	 *   B-PACK: unit_price = coating_price × side
	 *   S-UV/S-UV-S: unit_price = ups × width × length × coating_price × side
	 *   Other: unit_price = width × length × coating_price × side
	 *   min cost enforcement (per sheet or per total)
	 *
	 * @param {Object} params
	 * @param {string} params.coatingCode     — [input] 'UV'|'WTB'|'S-UV'|'S-UV-S'|'B-PACK'|'OPP'|'P-PAT'
	 * @param {number} params.coatingPrice    — [database: tb_master_coating > rate]
	 * @param {number} params.side            — [input] จำนวนด้าน (1 หรือ 2)
	 * @param {number} params.minCost         — [database: tb_master_coating > min_cost]
	 * @param {string} params.unitMinCost     — [database: tb_master_coating > unit_min_cost] 'sheet'|'price'
	 * @param {number} params.paperPrint      — จาก calculatePaperUsage().paper_print
	 * @param {number[]} params.laySize        — [w_in, l_in] layout size (inch)
	 * @param {number} params.ups             — UPS
	 * @param {number} [params.width]          — [input] ขนาดกว้าง coating (inch) สำหรับ S-UV
	 * @param {number} [params.length]         — [input] ขนาดยาว coating (inch) สำหรับ S-UV
	 * @param {string} [params.materialType]   — B-PACK material type
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateCoatingCost(params) {
		const {
			coatingCode, coatingPrice, side = 1, minCost = 0, unitMinCost = 'sheet',
			paperPrint, laySize = [0, 0], ups = 1, width, length, materialType
		} = params

		// [config: default.js > afterpress_price_marking]
		const afterpressMarking = this.config.afterpress_price_marking || 0

		// กำหนด width/length สำหรับ coating
		let cWidth = width || laySize[0]
		let cLength = length || laySize[1]
		let upsFactor = 1

		// S-UV, S-UV-S ใช้ custom size + ups factor
		if (['S-UV', 'S-UV-S'].includes(coatingCode)) {
			upsFactor = ups
		}

		// คำนวณ unit price
		let unit_price = 0

		if (coatingCode === 'B-PACK') {
			unit_price = parseFloat((coatingPrice * side).toFixed(2))
		} else if (coatingCode === 'P-PAT') {
			unit_price = parseFloat(coatingPrice.toFixed(2))
		} else {
			unit_price = parseFloat((upsFactor * cWidth * cLength * coatingPrice * side).toFixed(2))
		}

		// Min cost enforcement
		let price = 0
		if (unitMinCost === 'sheet') {
			if (unit_price < minCost) unit_price = minCost
			unit_price = parseFloat((unit_price * (1 + afterpressMarking / 100)).toFixed(2))
			price = parseFloat((paperPrint * unit_price).toFixed(2))
		} else { // 'price'
			price = parseFloat((paperPrint * unit_price).toFixed(2))
			if (price < minCost) price = minCost
			price = parseFloat((price * (1 + afterpressMarking / 100)).toFixed(2))
		}

		return { qty: paperPrint, unit_price, price }
	}

	// ─── C6: Foil Stamp Cost ─────────────────────────────────────────────

	/**
	 * [C6] คำนวณต้นทุน Foil Stamp (3 ส่วน: labor + foil_roll + block)
	 * Source: setCalculateFoilStampCost() — function_estimate_calculation.js:6333-6453
	 *
	 * สูตร:
	 *   pcs_per_roll = floor(foil_width/(w+tol_w*2)) × floor(foil_length*12/(l+tol_l))
	 *   foil_unit_price = roll_price × (1 + material_markup%) / pcs_per_roll
	 *   block_unit_price = max(w×l×block_rate, block_min) + max(w×l×film_rate, film_min)
	 *   labor: rate = lookupPriceRate('foilstamp', after_ups) / ups
	 *
	 * @param {Object} params
	 * @param {number} params.foilWidth           — [input] ขนาดกว้าง foil (inch)
	 * @param {number} params.foilLength          — [input] ขนาดยาว foil (inch)
	 * @param {number} params.width               — [input] ขนาดกว้างลายปั๊ม (inch)
	 * @param {number} params.length              — [input] ขนาดยาวลายปั๊ม (inch)
	 * @param {number} params.foilRollPrice       — [database: tb_master_foilstamp > roll_price]
	 * @param {number} params.foilRollMinPrice    — [database: tb_master_foilstamp > roll_min_price]
	 * @param {number} params.blockRate           — [database: tb_master_blockstamp > rate] (foil type)
	 * @param {number} params.qty                 — [input] จำนวนชิ้น
	 * @param {number} params.afterUps            — จาก calculatePaperUsage()
	 * @param {number} params.ups                 — UPS
	 * @param {string} params.printType           — [input]
	 * @returns {{ labor: {qty,unit_price,price}, foil_roll: {qty,unit_price,price}, block: {qty,unit_price,price} }}
	 */
	calculateFoilStampCost(params) {
		const {
			foilWidth, foilLength, width, length,
			foilRollPrice, foilRollMinPrice = 0, blockRate,
			qty, afterUps, ups, printType = 'Offset'
		} = params

		// [config: default.js]
		const {
			foil_width_tolerance = 0.5,
			foil_length_tolerance = 1,
			film_rate = 1.25,
			film_min_cost = 120,
			block_foilstamp_min_cost = 70,
			afterpress_price_marking = 0,
			material_price_marking = 0,
			addon_labor_price_marking = 0
		} = this.config

		// Foil roll calculation
		const numRollW = Math.floor(foilWidth / (width + foil_width_tolerance * 2))
		const numRollL = Math.floor(foilLength * 12 / (length + foil_length_tolerance))
		const pcsPerRoll = Math.max(numRollW * numRollL, 1)
		const foilUnitPrice = parseFloat(((foilRollPrice * (1 + material_price_marking / 100)) / pcsPerRoll).toFixed(4))

		// Block cost
		let blockUnitPrice = width * length * blockRate
		if (blockUnitPrice < block_foilstamp_min_cost) blockUnitPrice = block_foilstamp_min_cost
		else blockUnitPrice = parseFloat(blockUnitPrice.toFixed(2))

		// Film cost
		let filmUnitPrice = width * length * film_rate
		if (filmUnitPrice < film_min_cost) filmUnitPrice = film_min_cost
		else filmUnitPrice = parseFloat(filmUnitPrice.toFixed(2))

		// Block total (block + film) × material markup
		let blockTotal = parseFloat((blockUnitPrice + filmUnitPrice).toFixed(2))
		blockTotal = parseFloat((blockTotal * (1 + material_price_marking / 100)).toFixed(2))

		// Labor
		const laborRate = this.lookupPriceRate('foilstamp', afterUps, printType)
		const laborUnitPrice = parseFloat(((laborRate.unit_price / ups) * (1 + addon_labor_price_marking / 100)).toFixed(5))
		let laborPrice = parseFloat((laborUnitPrice * qty).toFixed(2))
		if (laborPrice < laborRate.min_price) laborPrice = laborRate.min_price
		laborPrice = parseFloat((laborPrice * (1 + afterpress_price_marking / 100)).toFixed(2))

		// Foil roll price
		const foilPrice = parseFloat((qty * foilUnitPrice).toFixed(2))
		const rollMinPrice = parseFloat((foilRollMinPrice * (1 + material_price_marking / 100)).toFixed(2))

		return {
			labor: { qty, unit_price: laborUnitPrice, price: laborPrice },
			foil_roll: {
				qty,
				unit_price: foilUnitPrice,
				price: foilPrice < foilRollMinPrice ? rollMinPrice : foilPrice
			},
			block: {
				qty: ups,
				unit_price: blockTotal,
				price: parseFloat((blockTotal * ups).toFixed(2))
			}
		}
	}

	// ─── C7: Emboss / Deboss Cost ────────────────────────────────────────

	/**
	 * [C7] คำนวณต้นทุน Emboss / Deboss (2 ส่วน: labor + block per size)
	 * Source: setCalculateBossingCost() — function_estimate_calculation.js:6456-6574
	 *
	 * @param {Object} params
	 * @param {string} params.type               — [input] 'emboss'|'deboss'
	 * @param {number} params.blockRate          — [database: tb_master_blockstamp > rate]
	 * @param {Array<[number,number]>} params.sizes — [input] ขนาดลายแต่ละกรอบ [[w_in,l_in], ...]
	 * @param {number} params.qty                — [input] จำนวนชิ้น
	 * @param {number} params.afterUps           — จาก calculatePaperUsage()
	 * @param {number} params.ups                — UPS
	 * @param {string} params.printType          — [input]
	 * @returns {{ labor: {qty,unit_price,price}, blocks: Array<{size,qty,unit_price,price}> }}
	 */
	calculateBossingCost(params) {
		const { type, blockRate, sizes = [], qty, afterUps, ups, printType = 'Offset' } = params

		const {
			film_rate = 1.25,
			film_min_cost = 120,
			afterpress_price_marking = 0,
			addon_labor_price_marking = 0,
			material_price_marking = 0
		} = this.config

		// Labor (คิดครั้งเดียวไม่ว่ามีกี่ size)
		const laborRate = this.lookupPriceRate('bossing', afterUps, printType)
		const laborUnitPrice = parseFloat(((laborRate.unit_price / ups) * (1 + addon_labor_price_marking / 100)).toFixed(5))
		let laborPrice = parseFloat((laborUnitPrice * qty).toFixed(2))
		if (laborPrice < laborRate.min_price) laborPrice = laborRate.min_price
		laborPrice = parseFloat((laborPrice * (1 + afterpress_price_marking / 100)).toFixed(2))

		// Blocks (คิดแยกตาม size)
		const blocks = sizes.map(([w, l]) => {
			const blockUnitPrice = parseFloat((w * l * blockRate).toFixed(2))
			let filmUnitPrice = w * l * film_rate
			if (filmUnitPrice < film_min_cost) filmUnitPrice = film_min_cost
			else filmUnitPrice = parseFloat(filmUnitPrice.toFixed(2))

			let totalUnit = parseFloat((blockUnitPrice + filmUnitPrice).toFixed(2))
			totalUnit = parseFloat((totalUnit * (1 + material_price_marking / 100)).toFixed(2))

			return {
				size: [w, l],
				qty: ups,
				unit_price: totalUnit,
				price: parseFloat((totalUnit * ups).toFixed(2))
			}
		})

		return {
			labor: { qty, unit_price: laborUnitPrice, price: laborPrice },
			blocks
		}
	}

	// ─── C8: Special Ink Cost ────────────────────────────────────────────

	/**
	 * [C8] คำนวณต้นทุนหมึกพิเศษ
	 * Source: setCalculateSpecialInkCost() — function_estimate_calculation.js:6720-6771
	 *
	 * สูตร:
	 *   qty = ceil(1.05 × layout_w × layout_l × after_waste × filling_percent / factor)
	 *   price = qty × unit_price
	 *
	 * @param {Object} params
	 * @param {number} params.inkProcessId     — [input] process ID ของหมึก
	 * @param {string} params.paperCode        — [database: tb_master_paper > paper_code]
	 * @param {string} params.printStyle       — [input] filling style
	 * @param {number} params.afterWaste       — จาก calculatePaperUsage().after_waste
	 * @param {number[]} params.laySize         — [w_in, l_in] layout size (inch)
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateSpecialInkCost(params) {
		const { inkProcessId, paperCode, printStyle, afterWaste, laySize } = params

		const { material_price_marking = 0 } = this.config

		// [database: tb_master_special_ink > factor]
		const { factor = 1, filling_percent = 1 } = this.lookup.getSpecialInkFactor(paperCode, printStyle) || {}

		// [database: tb_master_special_ink > price]
		const inkInfo = this.lookup.getSpecialInkInfo(inkProcessId) || {}
		let unitPrice = inkInfo.price || 0

		unitPrice = parseFloat((unitPrice * (1 + material_price_marking / 100)).toFixed(2))

		// [hardcoded] 1.05 = ค่าเผื่อหมึก 5%
		const inkQty = Math.ceil(1.05 * laySize[0] * laySize[1] * afterWaste * filling_percent / factor)

		return {
			qty: inkQty,
			unit_price: unitPrice,
			price: parseFloat((inkQty * unitPrice).toFixed(2))
		}
	}

	// ─── C9: Assembly Cost ───────────────────────────────────────────────

	/**
	 * [C9] คำนวณต้นทุนประกอบ (Assembly)
	 * Source: setCalculateAssemblyCost() — function_estimate_calculation.js:6915-6951
	 *
	 * สูตร:
	 *   type = getAssemblyType(openSize) — ตามช่วง assembly_size [config]
	 *   factor = getAssemblyFactor(gluedSpot) — [hardcoded] 1|1.5|1.75|1.9
	 *   rate = lookupPriceRate(type, qty) — factor คูณเข้าไปใน rate แล้ว
	 *   price = max(qty × unit_price, min_price) + corrugated markup
	 *
	 * @param {Object} params
	 * @param {number[]} params.openSize        — [w_in, l_in] open size (inch)
	 * @param {number} params.qty               — [input] จำนวนชิ้น
	 * @param {number} params.componentType     — [input] 1|2|3
	 * @param {number} [params.gluedSpot=1]     — [input] จำนวนจุดกาว
	 * @param {string} [params.printType]       — [input]
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateAssemblyCost(params) {
		const { openSize, qty, componentType, gluedSpot = 1, printType = 'Offset' } = params

		const {
			afterpress_price_marking = 0,
			corrugated_assembly_markup_price = 0
		} = this.config

		// [config: default.js > assembly_size]
		const type = this.getAssemblyType(openSize)

		// factor คูณใน setPriceRate ต้นทาง — แต่ที่นี่เราคูณเอง
		const factor = this.getAssemblyFactor(gluedSpot)

		// [database: tb_master_price_rate]
		const rateResult = this.lookup.getPriceRate(type, qty, printType)
		let unitPrice = (rateResult?.unit_price || 0) * factor
		const minPrice = rateResult?.min_price || 0

		// ถ้า component type 2,3 → +corrugated markup
		if ([2, 3].includes(componentType)) {
			unitPrice += corrugated_assembly_markup_price
		}

		let price = parseFloat((unitPrice * qty).toFixed(2))
		if (price < minPrice) price = minPrice

		// [config: default.js > afterpress_price_marking]
		price = parseFloat((price * (1 + afterpress_price_marking / 100)).toFixed(2))

		return { qty, unit_price: unitPrice, price }
	}

	// ─── C10: Die-cut Cost ───────────────────────────────────────────────

	/**
	 * [C10] คำนวณต้นทุน Die-cut (2 ส่วน: labor + block)
	 * Source: setCalculateDieCutCost() — function_estimate_calculation.js:6953-7007
	 *
	 * สูตร:
	 *   labor: rate = lookupPriceRate('diecut', after_ups) / ups
	 *          price = max(qty × labor_unit × factor, min_price)
	 *   block: rate = lookupBlockDiecutRate(laySize)
	 *          price = block_qty × rate
	 *   OPP Window → factor = 2, block_qty = 2 — [hardcoded]
	 *
	 * @param {Object} params
	 * @param {number} params.qty              — [input] จำนวนชิ้น
	 * @param {number} params.afterUps         — จาก calculatePaperUsage()
	 * @param {number} params.ups              — UPS
	 * @param {number[]} params.laySize         — [w_in, l_in] layout size
	 * @param {boolean} [params.hasOppWindow=false] — [input] มี OPP Window Coating
	 * @param {boolean} [params.isReprinted=false]  — [input] reprint job
	 * @param {string} [params.printType]      — [input]
	 * @returns {{ labor: {qty,unit_price,price}, block: {qty,unit_price,price} }}
	 */
	calculateDieCutCost(params) {
		const {
			qty, afterUps, ups, laySize,
			hasOppWindow = false, isReprinted = false, printType = 'Offset'
		} = params

		const {
			afterpress_price_marking = 0,
			material_price_marking = 0,
			reprinted_block = 0
		} = this.config

		// [hardcoded] OPP Window → factor & block qty
		const factor = hasOppWindow ? 2 : 1
		const blockQty = hasOppWindow ? 2 : 1

		// Labor
		const laborRate = this.lookupPriceRate('diecut', afterUps, printType)
		const laborUnitPrice = parseFloat((laborRate.unit_price / ups).toFixed(5))

		let laborPrice = parseFloat(((laborUnitPrice * factor) * qty).toFixed(2))
		if (laborUnitPrice * qty < laborRate.min_price) laborPrice = laborRate.min_price
		laborPrice = parseFloat((laborPrice * (1 + afterpress_price_marking / 100)).toFixed(2))

		// Block — [database: tb_master_blockdiecut]
		let blockRate = 0
		if (isReprinted) {
			blockRate = reprinted_block
		} else {
			blockRate = this.lookup.getBlockDiecutRate(laySize) || 0
		}
		blockRate = parseFloat((blockRate * (1 + material_price_marking / 100)).toFixed(2))

		return {
			labor: { qty, unit_price: laborUnitPrice * factor, price: laborPrice },
			block: {
				qty: blockQty,
				unit_price: blockRate,
				price: parseFloat((blockQty * blockRate).toFixed(2))
			}
		}
	}

	// ─── C11: Digital Die-cut Cost ───────────────────────────────────────

	/**
	 * [C11] คำนวณต้นทุน Digital Die-cut
	 * Source: setCalculateDigitalDieCutCost() — function_estimate_calculation.js:7009-7047
	 *
	 * @param {number} afterWaste   — จาก calculatePaperUsage().after_waste
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateDigitalDieCutCost(afterWaste) {
		const { afterpress_price_marking = 0 } = this.config

		// [hardcoded] 5 THB/pcs
		const unitPrice = 5
		let price = parseFloat((unitPrice * afterWaste).toFixed(2))
		price = parseFloat((price * (1 + afterpress_price_marking / 100)).toFixed(2))

		return { qty: afterWaste, unit_price: unitPrice, price }
	}

	// ─── C12: Chip Cost ──────────────────────────────────────────────────

	/**
	 * [C12] คำนวณต้นทุนแกะ (Chip/Hand Stripping)
	 * Source: setCalculateChipCost() — function_estimate_calculation.js:6784-6835
	 *
	 * @param {number} qty           — [input] จำนวนชิ้นทุก component รวม
	 * @param {string} [printType]   — [input]
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateChipCost(qty, printType = 'Offset') {
		const { afterpress_price_marking = 0 } = this.config

		// [database: tb_master_price_rate > chip]
		const rateResult = this.lookupPriceRate('chip', qty, printType)

		let price = parseFloat((rateResult.unit_price * qty).toFixed(2))
		if (price < rateResult.min_price) price = rateResult.min_price
		price = parseFloat((price * (1 + afterpress_price_marking / 100)).toFixed(2))

		return { qty, unit_price: rateResult.unit_price, price }
	}

	// ─── C13: Inspection Cost ────────────────────────────────────────────

	/**
	 * [C13] คำนวณต้นทุนตรวจสอบ (Inspection)
	 * Source: setCalculateInspectionCost() — function_estimate_calculation.js:7051-7102
	 *
	 * @param {number} totalQty      — [input] จำนวนชิ้นทุก component รวม
	 * @param {string} [printType]   — [input]
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateInspectionCost(totalQty, printType = 'Offset') {
		const { afterpress_price_marking = 0 } = this.config

		// [database: tb_master_price_rate > inspection]
		const rateResult = this.lookupPriceRate('inspection', totalQty, printType)

		let price = parseFloat((rateResult.unit_price * totalQty).toFixed(2))
		if (price < rateResult.min_price) price = rateResult.min_price
		price = parseFloat((price * (1 + afterpress_price_marking / 100)).toFixed(2))

		return { qty: totalQty, unit_price: rateResult.unit_price, price }
	}

	// ─── C14: Corrugated Board Cost ──────────────────────────────────────

	/**
	 * [C14] คำนวณต้นทุนลูกฟูก
	 * Source: setCalculateCorrugatedBoard() — function_estimate_calculation.js:6047-6294
	 *
	 * สูตร (2 ชั้น):
	 *   rate = lookup by grade + flute_type + qty range — [database: tb_master_corrugated_board]
	 *   unit_inch = rate / 144 × (1 + corrugated_markup%)
	 *   unit_price = unit_inch × flute_side × cut_off
	 *   price = qty × unit_price
	 *
	 * @param {Object} params
	 * @param {string} params.grade            — [input] เกรดลูกฟูก เช่น 'KSF170/CSF110'
	 * @param {string} params.fluteType        — [input] 'A'|'B'|'C'|'E'|'F'
	 * @param {number} params.corrugatedMarkup — [config / input] % markup (10% / 20%)
	 * @param {number} params.fluteSide        — (inch) ด้าน flute
	 * @param {number} params.cutOff           — (inch) ด้าน cut off
	 * @param {number} params.qty              — จำนวน (after_ups + waste_corrugated)
	 * @param {number} params.afterUps         — จาก calculatePaperUsage()
	 * @param {boolean} [params.isPricePerSheet=false] — ราคาต่อแผ่น
	 * @param {number} [params.customCost]     — ราคา custom
	 * @returns {{ qty: number, unit_price: number, price: number, unit_inch: number }}
	 */
	calculateCorrugatedBoardCost(params) {
		const {
			grade, fluteType, corrugatedMarkup = 10, fluteSide, cutOff,
			qty, afterUps, isPricePerSheet = false, customCost
		} = params

		if (customCost !== undefined) {
			const unit_price = parseFloat((customCost * (1 + corrugatedMarkup / 100)).toFixed(2))
			return { qty, unit_price, price: parseFloat((qty * unit_price).toFixed(2)), unit_inch: 0 }
		}

		// [database: tb_master_corrugated_board]
		const rate = this.lookup.getCorrugatedRate(grade, fluteType, afterUps) || 0

		const unit_inch = parseFloat((rate / 144 * (1 + corrugatedMarkup / 100)).toFixed(4))

		let unit_price = 0
		if (isPricePerSheet) {
			unit_price = parseFloat((rate * (1 + corrugatedMarkup / 100)).toFixed(2))
		} else {
			unit_price = parseFloat((unit_inch * fluteSide * cutOff).toFixed(2))
		}

		return {
			qty,
			unit_price,
			price: parseFloat((qty * unit_price).toFixed(2)),
			unit_inch
		}
	}

	// ─── C15: Corrugated Glued Cost ──────────────────────────────────────

	/**
	 * [C15] คำนวณต้นทุนประกบลูกฟูก
	 * Source: setCalculateCorrugatedGluedCost() — function_estimate_calculation.js:6296-6331
	 *
	 * @param {number} fluteSide    — (inch)
	 * @param {number} cutOff       — (inch)
	 * @param {number} qty          — จำนวน
	 * @returns {{ qty: number, unit_price: number, price: number }}
	 */
	calculateCorrugatedGluedCost(fluteSide, cutOff, qty) {
		// [config: default.js > corrugated_glued_cost]
		const gluedCost = this.config.corrugated_glued_cost || 0.0015
		const { afterpress_price_marking = 0 } = this.config

		let unit_price = parseFloat((fluteSide * cutOff * gluedCost).toFixed(2))
		unit_price = parseFloat((unit_price * (1 + afterpress_price_marking / 100)).toFixed(2))

		return {
			qty,
			unit_price,
			price: parseFloat((qty * unit_price).toFixed(2))
		}
	}

	// ─── C16: Delivery Cost ──────────────────────────────────────────────

	/**
	 * [C16] คำนวณต้นทุนจัดส่ง
	 * Source: setCalculateDelivery() — function_estimate_calculation.js:7303-7359
	 *
	 * สูตร: unit_price = delivery_rate × gross_weight / 1000
	 *
	 * @param {number} grossWeight    — น้ำหนักรวม (kg) — จาก packing calculation
	 * @returns {{ unit_price: number, price: number }}
	 */
	calculateDeliveryCost(grossWeight) {
		// [config: default.js > delivery_rate] (THB/ton)
		const deliveryRate = this.config.delivery_rate || 1500
		const unit_price = parseFloat((deliveryRate * grossWeight / 1000).toFixed(2))

		return { unit_price, price: unit_price }
	}

	// ═══════════════════════════════════════════════════════════════════════
	// [D] PRICE AGGREGATION
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * [D1] รวมต้นทุนทั้งหมด + Markup → Total Price
	 * Source: setCalculateTotalPrice() — function_estimate_calculation.js:7361-7731
	 *
	 * สูตร:
	 *   sub_material = paper + corrugated + special_ink + material
	 *   sub_production = plate + print + proof + afterpress + block + delivery + other
	 *   total = sub_material × (1 + material_markup%) + sub_production × (1 + production_markup%)
	 *   markup/markdown → final = total × (1 + markup% - markdown%)
	 *
	 * @param {Object} costs — รายการต้นทุน
	 * @param {number} costs.paper             — ต้นทุนกระดาษ
	 * @param {number} costs.corrugated        — ต้นทุนลูกฟูก
	 * @param {number} costs.special_ink       — ต้นทุนหมึกพิเศษ
	 * @param {number} costs.material          — ต้นทุนวัสดุอื่น
	 * @param {number} costs.plate             — ต้นทุนเพลท
	 * @param {number} costs.proof             — ต้นทุน proof
	 * @param {number} costs.print             — ต้นทุนพิมพ์
	 * @param {number} costs.afterpress        — ต้นทุน afterpress (coating, foilstamp, emboss, assembly, diecut, chip, insp)
	 * @param {number} costs.block             — ต้นทุน block (diecut, foilstamp, emboss blocks)
	 * @param {number} costs.delivery          — ต้นทุนจัดส่ง
	 * @param {number} costs.other             — ต้นทุนอื่นๆ
	 * @param {Object} markupConfig
	 * @param {number} markupConfig.mark_up_percent        — [input] markup %
	 * @param {number} markupConfig.mark_down_percent      — [input] markdown %
	 * @param {number} markupConfig.marking_material_percent   — [input] material markup %
	 * @param {number} markupConfig.marking_production_percent — [input] production markup %
	 * @param {number} [markupConfig.price_diff=0]          — [input] ส่วนต่างราคา
	 * @param {number} [markupConfig.customer_gift=0]       — [input] ของแถม
	 * @param {number} mainQty                             — [input] จำนวนหลัก (สำหรับ unit price)
	 * @returns {Object} ผลลัพธ์ total price
	 */
	calculateTotalPrice(costs, markupConfig, mainQty) {
		const {
			paper = 0, corrugated = 0, special_ink = 0, material = 0,
			plate = 0, proof = 0, print: printCost = 0, afterpress = 0,
			block = 0, delivery = 0, other = 0
		} = costs

		const {
			mark_up_percent = 0, mark_down_percent = 0,
			marking_material_percent = 0, marking_production_percent = 0,
			price_diff = 0, customer_gift = 0
		} = markupConfig || {}

		// Sub totals
		const sub_material = paper + corrugated + special_ink + material
		const sub_production = plate + printCost + proof + afterpress + block + delivery + other

		const raw_total = sub_material + sub_production

		// Material / Production markup (v3.1)
		const total_marking_material = parseFloat((sub_material * marking_material_percent / 100).toFixed(2))
		const sub_material_marked = parseFloat((sub_material + total_marking_material).toFixed(2))

		const total_marking_production = parseFloat((sub_production * marking_production_percent / 100).toFixed(2))
		const sub_production_marked = parseFloat((sub_production + total_marking_production).toFixed(2))

		const total_marked = sub_material_marked + sub_production_marked

		// Legacy markup/markdown (ถ้าไม่ใช้ v3.1)
		const mark_up_price = parseFloat((raw_total * mark_up_percent / 100).toFixed(2))
		const mark_down_price = parseFloat((raw_total * mark_down_percent / 100).toFixed(2))

		// Final total (ใช้ material/production markup)
		const total_price = total_marked
		const total_with_extra = total_price + price_diff + customer_gift

		// Unit prices
		const unit_price_material = mainQty > 0 ? parseFloat((sub_material / mainQty).toFixed(2)) : 0
		const unit_price_production = mainQty > 0 ? parseFloat((sub_production / mainQty).toFixed(2)) : 0

		return {
			// Raw costs
			raw: costs,
			sub_total_price_material: parseFloat(sub_material.toFixed(2)),
			sub_total_price_production: parseFloat(sub_production.toFixed(2)),

			// Markup
			marking_material_percent,
			total_marking_material,
			sub_total_price_material_marking: sub_material_marked,
			marking_production_percent,
			total_marking_production,
			sub_total_price_production_marking: sub_production_marked,

			// Legacy markup
			mark_up_percent,
			mark_up_price,
			mark_down_percent,
			mark_down_price,

			// Extra
			price_diff,
			customer_gift,

			// Total
			total_price,
			total_with_price_diff: total_with_extra,

			// Unit prices
			unit_price_material,
			unit_price_production,
			unit_price_material_marking: mainQty > 0 ? parseFloat((sub_material_marked / mainQty).toFixed(2)) : 0,
			unit_price_production_marking: mainQty > 0 ? parseFloat((sub_production_marked / mainQty).toFixed(2)) : 0,
		}
	}

	/**
	 * [D2] คำนวณภาษี
	 * Source: setCalculateTax() — function_estimate_calculation.js
	 *
	 * @param {number} totalPrice   — ราคารวมก่อนภาษี
	 * @returns {{ tax_percent: number, tax_price: number, total_with_tax: number }}
	 */
	calculateTax(totalPrice) {
		// [config: default.js > tax] (default: 3%)
		const taxPercent = this.config.tax || 3
		const taxPrice = parseFloat((totalPrice * taxPercent / 100).toFixed(2))

		return {
			tax_percent: taxPercent,
			tax_price: taxPrice,
			total_with_tax: parseFloat((totalPrice + taxPrice).toFixed(2))
		}
	}

	/**
	 * [D3] คำนวณ Unit Price (ราคาต่อชิ้น)
	 *
	 * @param {number} totalPrice   — ราคารวม
	 * @param {number} qty          — [input] จำนวน
	 * @param {number} [exchangeRate=1] — [input] อัตราแลกเปลี่ยน
	 * @returns {{ unit_price: number, unit_price_exchange: number }}
	 */
	calculateUnitPrice(totalPrice, qty, exchangeRate = 1) {
		const unitPrice = qty > 0 ? parseFloat((totalPrice / qty).toFixed(2)) : 0
		const unitPriceExchange = exchangeRate !== 1
			? parseFloat((unitPrice / exchangeRate).toFixed(2))
			: unitPrice

		return {
			unit_price: unitPrice,
			unit_price_exchange: unitPriceExchange
		}
	}

	// ═══════════════════════════════════════════════════════════════════════
	// [E] ORCHESTRATOR — calculate() เรียกทุก method ตามลำดับ
	// ═══════════════════════════════════════════════════════════════════════

	/**
	 * [E] คำนวณทั้ง pipeline ตั้งแต่ต้นจนจบ
	 *
	 * @param {Object} input
	 * @param {number} input.qty                      — [input] จำนวนชิ้น
	 * @param {string} input.printType                — [input] 'Offset'|'Flexo'|'Jet Press'|'Konica'
	 * @param {string} input.inkType                  — [input] 'UV'|'conventional'
	 * @param {number} input.boxType                  — [input] box template (1-12)
	 * @param {Object} input.dimensions               — [input] { width, length, depth, tuck_flap, glue_flap, dust_flap, ol }
	 * @param {number} input.componentType            — [input] 1|2|3
	 * @param {Object} input.paper                    — [input + database] { paper_cost, paper_gram, paper_markup, ... }
	 * @param {number[]} input.paperSize               — [database: machine_std_paper] [w_mm, l_mm]
	 * @param {number} input.rollWidth                — [database: machine_std_paper] (inch)
	 * @param {number} input.cutOff                   — [database: machine_std_paper] (inch)
	 * @param {string} input.parallelRollWidth        — 'WSize'|'LSize'
	 * @param {Object} input.colors                   — [input] { outside, inside, all }
	 * @param {Object} [input.addons]                 — [input] addon list (coating, foilstamp, emboss, etc.)
	 * @param {Object} [input.processes]              — [input] process list (assembly, diecut, chip, inspection)
	 * @param {Object} [input.markupConfig]           — [input] markup settings
	 * @param {boolean} [input.isProfitSharing=false]  — [input]
	 * @param {boolean} [input.isReprinted=false]      — [input]
	 * @returns {Object} ผลลัพธ์ทั้งหมด
	 */
	calculate(input) {
		const {
			qty, printType, inkType = 'conventional', boxType, dimensions,
			componentType, paper, paperSize, rollWidth, cutOff,
			parallelRollWidth = 'WSize', colors = {},
			addons = {}, processes = {}, markupConfig = {},
			isProfitSharing = false, isReprinted = false
		} = input

		// ─── [A] Layout ──────────────────────────────────────────
		const openSize = this.calculateOpenSize(boxType, dimensions)
		const foldSize = this.calculateFoldSize(boxType, dimensions)
		const tolerance = this.calculateTolerance(printType, componentType)

		const layouts = this.calculateLayout({
			boxType, dimensions, bleed: tolerance.bleed,
			paperSize, shortSide: tolerance.shortSide, longSide: tolerance.longSide
		})

		const selectedLayout = this.selectBestLayout(layouts, paperSize)
		const ups = selectedLayout?.num_laying || 1

		// laySize in inches สำหรับใช้ต่อ
		const laySize = selectedLayout
			? [selectedLayout.layoutSize.layout_w_in, selectedLayout.layoutSize.layout_l_in]
			: [this.mm2inch(paperSize[0]), this.mm2inch(paperSize[1])]

		// ─── [B] Paper Usage ─────────────────────────────────────
		const split = this.calculateSplit(rollWidth, cutOff, laySize, parallelRollWidth)

		const wasteResult = this.calculateWaste({
			printType,
			afterUps: Math.ceil(qty / ups),
			outsideColors: colors.outside || 0,
			insideColors: colors.inside || 0,
			allColors: colors.all || 0,
			componentType,
			isDigitalDiecut: processes.isDigitalDiecut || false,
			isColorLimit: colors.isColorLimit || false,
			addons: {
				hasCoating: !!addons.coating,
				coatingSide: addons.coating?.side || 1,
				hasFoilstamp: !!addons.foilstamp,
				hasEmboss: !!addons.emboss,
				hasDeboss: !!addons.deboss
			}
		})

		const paperUsage = this.calculatePaperUsage({
			qty, ups, sig: 1, split,
			totalWaste: wasteResult.totalWaste,
			gram: paper.paper_gram,
			rollWidth, cutOff, printType
		})

		// ─── [C] Cost Calculations ───────────────────────────────
		const costResults = {}

		// C1: Paper
		costResults.paper = this.calculatePaperCost(paper, rollWidth, cutOff, paperUsage.paper_net)

		// C2: Plate
		costResults.plate = this.calculatePlateCost({
			printType, outsideColors: colors.outside || 0, insideColors: colors.inside || 0,
			afterWaste: paperUsage.after_waste, sig: 1, ups,
			isCut1: input.isCut1 || false, isReprinted,
			isUsePrevPlate: input.isUsePrevPlate || false,
			flexoSize: input.flexoSize || [0, 0]
		})

		// C3: Proof
		costResults.proof = this.calculateProofCost(printType)

		// C4: Print
		costResults.print = this.calculatePrintCost({
			printType, inkType, outsideColors: colors.outside || 0, insideColors: colors.inside || 0,
			afterUps: paperUsage.after_ups, paperPrint: paperUsage.paper_print,
			sig: 1, isProfitSharing,
			isBlackPrintingOutside: colors.isBlackPrintingOutside || false,
			isBlackPrintingInside: colors.isBlackPrintingInside || false,
			paperSize: paperSize
		})

		// C5-C8: Addons (optional)
		costResults.coating = addons.coating
			? this.calculateCoatingCost({ ...addons.coating, paperPrint: paperUsage.paper_print, laySize, ups })
			: null

		// C9-C13: Processes (optional)
		costResults.assembly = processes.assembly
			? this.calculateAssemblyCost({
				openSize: [openSize.width_in, openSize.length_in],
				qty, componentType,
				gluedSpot: processes.assembly.gluedSpot || 1,
				printType
			})
			: null

		costResults.diecut = processes.diecut
			? this.calculateDieCutCost({
				qty, afterUps: paperUsage.after_ups, ups, laySize,
				hasOppWindow: processes.diecut.hasOppWindow || false,
				isReprinted, printType
			})
			: null

		costResults.digitalDiecut = processes.isDigitalDiecut
			? this.calculateDigitalDieCutCost(paperUsage.after_waste)
			: null

		costResults.chip = processes.chip
			? this.calculateChipCost(qty, printType)
			: null

		costResults.inspection = processes.inspection
			? this.calculateInspectionCost(qty, printType)
			: null

		// C14: Corrugated
		costResults.corrugated = (componentType !== 1 && addons.corrugated)
			? this.calculateCorrugatedBoardCost({
				...addons.corrugated,
				qty: paperUsage.after_ups + (wasteResult.waste_corrugated_board || 0),
				afterUps: paperUsage.after_ups
			})
			: null

		// ─── [D] Aggregate ───────────────────────────────────────
		const plateTotalPrice = (costResults.plate.outside.price + costResults.plate.inside.price
			+ (costResults.plate.reprint?.outside?.price || 0)
			+ (costResults.plate.reprint?.inside?.price || 0))

		const printTotalPrice = costResults.print.outside.price + costResults.print.inside.price

		const aggregatedCosts = {
			paper: costResults.paper?.price || 0,
			corrugated: costResults.corrugated?.price || 0,
			special_ink: 0, // ต้อง sum จาก special ink array ถ้ามี
			material: 0,
			plate: plateTotalPrice,
			proof: costResults.proof?.price || 0,
			print: printTotalPrice,
			afterpress: (costResults.coating?.price || 0)
				+ (costResults.assembly?.price || 0)
				+ (costResults.diecut?.labor?.price || 0)
				+ (costResults.digitalDiecut?.price || 0)
				+ (costResults.chip?.price || 0)
				+ (costResults.inspection?.price || 0),
			block: (costResults.diecut?.block?.price || 0),
			delivery: 0, // ต้องคำนวณจาก packing
			other: 0
		}

		const totalPrice = this.calculateTotalPrice(aggregatedCosts, markupConfig, qty)
		const tax = this.calculateTax(totalPrice.total_with_price_diff)
		const unitPrice = this.calculateUnitPrice(tax.total_with_tax, qty, input.exchangeRate)

		// ─── Return ──────────────────────────────────────────────
		return {
			layout: {
				openSize,
				foldSize,
				tolerance,
				selectedLayout,
				ups,
				laySize
			},
			paperUsage: {
				split,
				waste: wasteResult,
				...paperUsage
			},
			costs: costResults,
			summary: {
				aggregatedCosts,
				totalPrice,
				tax,
				unitPrice
			}
		}
	}
}

// Export สำหรับ Node.js / browser
if (typeof module !== 'undefined' && module.exports) {
	module.exports = EstimateCalculation
}
