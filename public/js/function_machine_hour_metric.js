// ============================================================================
// Machine-Hour Metric — DRAFT (รอข้อมูลความเร็วเครื่องจากพี่)
// ----------------------------------------------------------------------------
// เมตริก "เทียบดู" เฉยๆ: งานนี้ใช้เวลาเครื่องกี่ชั่วโมง + ราคาต่อชั่วโมงเครื่อง
// READ-ONLY: อ่าน est.mainData ที่ calc สร้างไว้แล้ว — ไม่แตะสูตรราคาเดิม ไม่บวกเข้าราคา
//
// โมเดล (ก): ราคา/ชั่วโมง = ราคารวมต่อยอด ÷ ชั่วโมงเดินเครื่อง
//            ชั่วโมงเดินเครื่อง = paper_print (แผ่นที่เครื่องเดินจริง รวม makeready) ÷ ความเร็ว(แผ่น/ชม.)
//
// หมายเหตุ:
// - speedSheetsPerHour = ความเร็ว default (fallback). ถ้า master ของเครื่องมี field machine_speed
//   (หรือ speed_sheets_per_hour / speed) → ใช้ของจริง "ต่อเครื่อง" อัตโนมัติ ไม่ต้องแก้โค้ด
// - paper_print รวมแผ่น makeready/เผื่อเสีย (waste) อยู่แล้ว → เวลานี้คือเวลาที่เครื่องเดินจริง
//   (ถ้าพี่ให้ "ความเร็วรันล้วน" แยกเวลาsetup ค่อยเพิ่มเวลาsetupทีหลัง — ตอนนี้ถือว่า flat)
// - รองรับหลาย component/หลายเครื่อง: รวมเวลาทุกเครื่อง แต่ละเครื่องใช้ความเร็วของตัวเอง
// ============================================================================

/**
 * คำนวณเมตริกชั่วโมงเครื่อง + ราคา/ชั่วโมง ต่อยอดสั่ง
 * @param {object} mainData  est.mainData (อ่านอย่างเดียว)
 * @param {number} speedSheetsPerHour  ความเร็วเครื่อง (แผ่น/ชั่วโมง) — จากพี่
 * @returns {{machine:string, rows:Array}|null}
 */
function computeMachineHourMetric(mainData, speedSheetsPerHour, opts) {
	if (!mainData || !(speedSheetsPerHour > 0)) return null
	const comps = mainData.component1 || []
	if (!comps.length) return null
	const tp = mainData.totalprice || []
	const qtyArr = (mainData.qty && mainData.qty.totalqty) || []
	const SHIFT_HOURS = 8 // กะมาตรฐาน 8 ชม. (ใช้คิดกำลังผลิต/กะ)
	const COST_KEYS = ['material', 'plate', 'print', 'proof', 'afterpress', 'delivery', 'other']
	const o = opts || {}
	const defaultSetup = Number(o.setupHours) > 0 ? Number(o.setupHours) : 0 // setup fallback (ชม.)
	const machineByName = o.machineByName || {} // ชื่อเครื่อง → {speed, setup} จากตารางจริงของพี่
	const machineById = o.machineById || {}     // machine_id → {name, speed, setup} (จับคู่ด้วย id กันชื่อเพี้ยน)

	// คืน {name, speed(แผ่น/ชม.), setup(make_ready ชม.), real}
	//   ลำดับ: field ใน master > จับคู่ด้วย machine_id (กันชื่อเพี้ยน L440/LS440) > จับด้วยชื่อ > fallback
	//   ใช้ "ชื่อจากตารางพี่" (โดย id) เป็นชื่อแสดง → หัวตารางกับลิสต์เทียบตรงกัน ไม่ต้องแก้ default.js
	const machineSpecOf = (comp) => {
		const m = (comp && comp.machine) || {}
		const calcName = m.machine_name || '-'
		const real = Number(m.machine_speed) || Number(m.speed_sheets_per_hour) || Number(m.speed)
		if (real > 0) return { name: calcName, speed: real, setup: Number(m.machine_setup) >= 0 ? Number(m.machine_setup) : defaultSetup, real: true }
		const byId = machineById[m.machine_id]
		if (byId && Number(byId.speed) > 0) return { name: byId.name || calcName, speed: Number(byId.speed), setup: Number(byId.setup) || 0, real: true }
		const t = machineByName[calcName]
		if (t && Number(t.speed) > 0) return { name: calcName, speed: Number(t.speed), setup: Number(t.setup) || 0, real: true }
		return { name: calcName, speed: speedSheetsPerHour, setup: defaultSetup, real: false }
	}

	// ข้อมูลคงที่ต่อ component — แต่ละ component อาจใช้คนละเครื่อง/คนละสี/คนละความเร็ว
	//   passes = จำนวนรอบที่แผ่นวิ่งผ่านเครื่อง (สี > ชุดพิมพ์ → หลายรอบ)
	//   units=0 (ดิจิทัล/ไม่มีข้อมูล) → 1 รอบ
	//   ⚠️ สมมติ "ความเร็ว = impressions/ชม." จึงคูณ passes
	const compInfo = comps.map((comp) => {
		const units = (comp.machine && comp.machine.color && Number(comp.machine.color.max)) || 0
		const color = (comp.color && comp.color[0]) || {}
		const outside = Number(color.outside) || 0
		const inside = Number(color.inside) || 0
		let passes = units > 0 ? (Math.ceil(outside / units) + Math.ceil(inside / units)) : 1
		if (passes < 1) passes = 1
		const spec = machineSpecOf(comp)
		const machine = spec.name || '-' // ชื่อจากตารางพี่ (โดย id) → ตรงกับลิสต์เทียบ
		return {
			machine, units, outside, inside, passes,
			speed: spec.speed, setup: spec.setup,
			isRealSpeed: spec.real, // true = ใช้ความเร็วจริงจากตารางพี่/master
			lines: (comp.paper_usage && comp.paper_usage.line) || [],
			wasteArr: (comp.waste && comp.waste.waste) || [],
		}
	})

	const rows = qtyArr.map((qty, i) => {
		// รวมเวลาเครื่องของทุก component (แต่ละตัววิ่งบนเครื่องของมัน)
		let hours = 0, sheets = 0, wasteSheets = 0
		const byComponent = compInfo.map((c) => {
			const s = Number((c.lines[i] || {}).paper_print) || 0
			// เวลา = setup(ของเครื่องนั้น) + (แผ่น × รอบพิมพ์ ÷ ความเร็ว) • ไม่มีงาน (s=0) → 0
			const h = s > 0 ? c.setup + (s * c.passes) / c.speed : 0
			hours += h; sheets += s; wasteSheets += Number(c.wasteArr[i]) || 0
			return { machine: c.machine, sheets: s, passes: c.passes, setup: c.setup, hours: +h.toFixed(4) }
		})
		const t = tp[i] || {}
		const total = t.total_with_price_diff != null ? t.total_with_price_diff : t.total_price
		const print = Number(t.print) || 0 // ค่าพิมพ์ (หมึก+พิมพ์) จาก calc — แบบ A
		const cost = COST_KEYS.reduce((s, k) => s + (Number(t[k]) || 0), 0) // ต้นทุนรวมทุกหมวด (ระดับงาน)
		const margin = total != null ? total - cost : null // กำไร = ราคาขาย − ต้นทุน (ขยับตาม markup)
		const costPerHour = hours > 0 && total != null ? total / hours : null
		const printPerHour = hours > 0 ? print / hours : null
		const marginPerHour = hours > 0 && margin != null ? margin / hours : null
		const makereadyPct = sheets > 0 ? (wasteSheets / sheets) * 100 : null
		const jobsPerShift = hours > 0 ? SHIFT_HOURS / hours : null
		return {
			qty,
			sheets,
			hours: +hours.toFixed(4),
			total: total != null ? +Number(total).toFixed(2) : null,
			costPerHour: costPerHour != null ? +costPerHour.toFixed(2) : null,
			print: +print.toFixed(2),
			printPerHour: printPerHour != null ? +printPerHour.toFixed(2) : null,
			margin: margin != null ? +margin.toFixed(2) : null,
			marginPerHour: marginPerHour != null ? +marginPerHour.toFixed(2) : null,
			makereadyPct: makereadyPct != null ? +makereadyPct.toFixed(1) : null,
			jobsPerShift: jobsPerShift != null ? +jobsPerShift.toFixed(1) : null,
			byComponent,
		}
	})
	const first = compInfo[0]
	return {
		machine: compInfo.map((c) => c.machine).join(' + '), // หลาย component = ชื่อเครื่อง join
		units: first.units, colors: { outside: first.outside, inside: first.inside }, passes: first.passes,
		compCount: comps.length,
		components: compInfo.map((c) => ({ machine: c.machine, units: c.units, outside: c.outside, inside: c.inside, passes: c.passes, speed: c.speed, setup: c.setup, isRealSpeed: c.isRealSpeed })),
		speed: speedSheetsPerHour, // ความเร็ว fallback — เครื่องที่ระบุชื่อตรงตารางใช้ของจริงใน rows
		allRealSpeed: compInfo.every((c) => c.isRealSpeed), // true = ทุกเครื่อง map ความเร็วเฉพาะเครื่องได้
		anyRealSpeed: compInfo.some((c) => c.isRealSpeed),
		setupHours: defaultSetup, shiftHours: SHIFT_HOURS, rows,
	}
}

/**
 * แปลงเมตริกเป็น HTML ตาราง (ใช้ใน modal/หน้าจอ — ภายหลัง)
 */
function renderMachineHourMetric(metric, target) {
	if (!metric || !metric.rows.length) return '<div>ยังไม่มีข้อมูล (ต้องคำนวณ price ก่อน + ใส่ความเร็วเครื่อง)</div>'
	const hasTarget = target != null && target > 0 // เป้าหมายกำไร/ชม. (สมมติ) — ไว้ตัดสิน คุ้ม/ไม่คุ้ม
	const fmt = (n, d) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
	const mins = (h) => (h == null ? '-' : fmt(h * 60, 1) + ' นาที')
	const rows = metric.rows.map((r) => `
		<tr>
			<td>${fmt(r.qty, 0)}</td>
			<td style="text-align:right">${fmt(r.sheets, 0)}</td>
			<td style="text-align:right">${fmt(r.hours, 3)} ชม.<br><span style="color:#9ca3af;font-size:11px">(${mins(r.hours)})</span></td>
			<td style="text-align:right">${fmt(r.total, 2)}</td>
			<td style="text-align:right;font-weight:bold;background:#dbeafe">${fmt(r.printPerHour, 2)}</td>
		</tr>`).join('')
	const maxJobs = Math.max(0, ...metric.rows.map((r) => r.jobsPerShift || 0))
	const single = metric.compCount === 1
	const passBadge = (p) => `<span style="color:${p > 1 ? '#dc2626' : '#16a34a'};font-weight:bold">${p} รอบ</span>${p > 1 ? ' (เวลา×' + p + ')' : ''}`
	const compDetail = single
		? `<b>ชุดพิมพ์:</b> ${metric.components[0].units} สี &nbsp;•&nbsp; <b>สีงาน:</b> ${metric.components[0].outside}+${metric.components[0].inside} &nbsp;•&nbsp; <b>รอบพิมพ์:</b> ${passBadge(metric.components[0].passes)}`
		: metric.components.map((c, idx) => `<b>Comp${idx + 1} (${c.machine}):</b> ${c.units} ชุด / ${c.outside}+${c.inside} สี / ${passBadge(c.passes)}`).join('&nbsp;&nbsp;•&nbsp;&nbsp;')
		// go/no-go (กำไร/ชม.) ย้ายไป 💎 box ของ per-process (คอขวดจริง) — ตาราง ⏱️ นี้โชว์เฉพาะเครื่องพิมพ์
		return `
		<div style="font-size:13px">
			<div style="margin-bottom:4px">
				<b>เครื่อง:</b> ${metric.machine} &nbsp;•&nbsp; <b>ความเร็ว:</b> ${single ? fmt(metric.components[0].speed, 0) + ' แผ่น/ชม. (setup ' + metric.components[0].setup + ' ชม.)' : 'หลายเครื่อง'}${metric.compCount > 1 ? ` &nbsp;•&nbsp; <span style="color:#2563eb;font-weight:bold">${metric.compCount} components (รวมเวลาทุกเครื่อง)</span>` : ''}
			</div>
			<div style="margin-bottom:6px;font-size:12px">${compDetail}</div>
			<table style="width:100%;border-collapse:collapse">
				<thead><tr style="background:#e5e7eb">
					<th style="padding:5px 8px;text-align:left">ยอดสั่ง</th>
					<th style="padding:5px 8px;text-align:right">แผ่นที่พิมพ์</th>
					<th style="padding:5px 8px;text-align:right">เวลาเดินเครื่อง</th>
					<th style="padding:5px 8px;text-align:right">ราคารวม</th>
					<th style="padding:5px 8px;text-align:right">ค่าพิมพ์(สี)/ชั่วโมง</th>
				</tr></thead>
				<tbody>${rows}</tbody>
			</table>
			<div style="margin-top:8px;font-size:11px;color:#6b7280">
				💡 <b>ตาราง ⏱️ นี้ = เฉพาะเครื่องพิมพ์</b> • <b>ราคารวม</b> = ราคาทั้งงาน (อ้างอิง รวมทุก process) • <b>ค่าพิมพ์/ชม.</b> = ค่าพิมพ์ ÷ เวลาพิมพ์ (เครื่องพิมพ์แท้ๆ)<br>
				⚠️ ราคา/กำไรต่อชั่วโมง "ที่ใช้ตัดสิน" → ดู <b>💎 ตาราง process ด้านล่าง (ต่อชั่วโมงคอขวดจริง)</b> • กำลังผลิตเครื่องพิมพ์ ~${fmt(maxJobs, 0)} ครั้ง/กะ
			</div>
		</div>`
}

// ============================================================================
// แยกเวลาเครื่อง "ต่อ process" — แต่ละ process = คนละเครื่อง คนละความเร็ว
//   sheet-based (เครื่องรันแผ่น): พิมพ์/เคลือบ/ไดคัท/ปั๊ม → ใช้ paper_print (แผ่น)
//   piece-based (ต่อใบสำเร็จ): ติดกาว/ประกอบ → ใช้ยอดสั่ง (ใบ)
//   เวลา = setup + (จำนวน ÷ ความเร็ว process) • คอขวด = process ที่ใช้เวลานานสุด
//   ความเร็วจริงจากตารางเครื่องของพี่ + setup เฉลี่ย ~1 ชม./เครื่อง
// ============================================================================
function computeProcessBreakdown(mainData, qtyIndex, speeds) {
	const comp = (mainData.component1 || [])[0] || {}
	const i = qtyIndex || 0
	const paperPrint = Number((((comp.paper_usage && comp.paper_usage.line) || [])[i] || {}).paper_print) || 0
	const orderQty = ((mainData.qty && mainData.qty.totalqty) || [])[i] || 0
	const tp = (mainData.totalprice || [])[i] || {}
	const sp = speeds || {}
	const globalSetup = Number(sp.setupHours) > 0 ? Number(sp.setupHours) : 0 // setup fallback (ชม.)
	// แต่ละ process: รับเป็น object {speed, setup} (ของจริงต่อเครื่อง) หรือเลขความเร็วล้วน (ใช้ globalSetup)
	const resolve = (v) => (v && typeof v === 'object')
		? { speed: Number(v.speed) || 0, setup: Number(v.setup) >= 0 ? Number(v.setup) : globalSetup }
		: { speed: Number(v) || 0, setup: globalSetup }
	const procs = []
	const add = (label, unit, qty, cost, speedCfg) => {
		const { speed, setup } = resolve(speedCfg)
		const c = Number(cost) || 0
		if (!(qty > 0) || !(speed > 0) || !(c > 0)) return // c=0 → process ไม่มีในงานนี้ → ข้าม
		const hours = setup + qty / speed // setup(ของเครื่องนั้น) + เวลาเดิน
		procs.push({ label, unit, qty, speed, setup, cost: +c.toFixed(2), hours: +hours.toFixed(4), costPerHour: hours > 0 ? +(c / hours).toFixed(2) : null })
	}
	const sumAddon = (types) => (comp.addon || []).filter((a) => a && types.includes(a.type)).reduce((s, a) => s + (((a.line || [])[i] || {}).price || 0), 0)
	const findProc = (name) => (comp.process || []).find((p) => p && p.name === name)

	add('พิมพ์', 'แผ่น', paperPrint, Number(tp.print) || 0, sp.print)            // sheet-based
	add('เคลือบ', 'แผ่น', paperPrint, sumAddon(['coating']), sp.coating)         // sheet-based
	const dc = findProc('diecut')
	if (dc) { const ln = (dc.line || [])[i] || {}; add('ไดคัท', 'แผ่น', paperPrint, ((ln.block && ln.block.price) || 0) + ((ln.labor && ln.labor.price) || 0), sp.diecut) }
	add('ปั๊ม (ฟอยล์/นูน)', 'แผ่น', paperPrint, sumAddon(['foilstamp', 'emboss', 'deboss']), sp.stamp) // sheet-based
	add('ปะลูกฟูก', 'แผ่น', paperPrint, sumAddon(['corrugated', 'flute', 'laminate']), sp.flute) // sheet-based (เฉพาะงานลูกฟูก type 2/3)
	const asm = findProc('assembly')
	if (asm) { const ln = (asm.line || [])[i] || {}; add('ติดกาว/ประกอบ', 'ใบ', orderQty, ln.price || 0, sp.assembly) } // piece-based

	// process ระดับงาน (top-level) เช่น แกะ/strip-out — เป็นเครื่อง (ยกเว้น inspection = QC แมนนวล)
	const PROC_LABEL = { chip: 'แกะ (strip-out)' }
	;(mainData.process || []).forEach((p) => {
		if (!p || p.name === 'inspection') return
		const ln = (p.line || [])[i] || {}
		add(PROC_LABEL[p.name] || p.name || 'อื่นๆ', 'ใบ', Number(ln.qty) || orderQty, ln.price || 0, sp[p.name] || sp.strip || sp.assembly) // piece-based
	})

	const bottleneck = procs.reduce((mx, p) => (!mx || p.hours > mx.hours ? p : mx), null)

	// จำนวนสีรวม (นอก+ใน ทุก component) — ใช้กับเรทพิมพ์แบบ "สีละ X บาท/ชม." (Art)
	const colors = (mainData.component1 || []).reduce((s, c) =>
		s + (c.color || []).reduce((s2, cc) => s2 + (Number(cc.outside) || 0) + (Number(cc.inside) || 0) + (Array.isArray(cc.special_ink) ? cc.special_ink.length : 0), 0), 0) // [ทีม] นับสีพิเศษด้วย (เรท 500/สี รวมสีพิเศษ)

	// ตัวเลขเชิง BD จริง: ต่อ "ชั่วโมงคอขวด" (ทรัพยากรที่จำกัด — Theory of Constraints)
	const COST_KEYS = ['material', 'plate', 'print', 'proof', 'afterpress', 'delivery', 'other']
	const total = tp.total_with_price_diff != null ? tp.total_with_price_diff : tp.total_price
	const cost = COST_KEYS.reduce((s, k) => s + (Number(tp[k]) || 0), 0)
	const margin = total != null ? total - cost : null
	const bh = bottleneck ? bottleneck.hours : 0
	return {
		qty: orderQty, procs, bottleneck, colors,
		total: total != null ? +Number(total).toFixed(2) : null,
		margin: margin != null ? +margin.toFixed(2) : null,
		revenuePerBnHour: bh > 0 && total != null ? +(total / bh).toFixed(2) : null,   // ราคา/ชม.คอขวด
		profitPerBnHour: bh > 0 && margin != null ? +(margin / bh).toFixed(2) : null,  // กำไร/ชม.คอขวด ← ตัวตัดสินจริง
		capacity: bh > 0 ? +(8 / bh).toFixed(1) : null,                                 // กำลังผลิตจริง/กะ
	}
}

function renderProcessBreakdown(pb, target) {
	if (!pb || !pb.procs.length) return ''
	const fmt = (n, d) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
	const mins = (h) => fmt(h * 60, 1) + ' น.'
	const hasTarget = target != null && target > 0
	const verdict = !hasTarget || pb.profitPerBnHour == null ? ''
		: pb.profitPerBnHour >= target
			? ` <span style="color:#15803d;font-weight:bold">✅ คุ้ม (≥ เป้า ${fmt(target, 0)})</span>`
			: ` <span style="color:#dc2626;font-weight:bold">⚠️ ต่ำกว่าเป้า ${fmt(target, 0)} — ควรขอเพิ่มราคา/เพิ่มยอด</span>`
	const rows = pb.procs.map((p) => {
		const bn = pb.bottleneck && p.label === pb.bottleneck.label
		return `<tr style="${bn ? 'background:#fee2e2' : ''}">
			<td style="padding:4px 8px">${bn ? '🔴 ' : ''}${p.label}</td>
			<td style="text-align:right">${fmt(p.qty, 0)} ${p.unit}</td>
			<td style="text-align:right;color:#9ca3af">${fmt(p.speed, 0)}/ชม.</td>
			<td style="text-align:right;font-weight:${bn ? 'bold' : 'normal'}">${mins(p.hours)}</td>
			<td style="text-align:right">${fmt(p.cost, 2)}</td>
			<td style="text-align:right">${fmt(p.costPerHour, 0)}</td>
		</tr>`
	}).join('')
	return `
		<div style="margin-top:10px">
			<div style="font-weight:bold;font-size:13px;color:#7c3aed;margin-bottom:4px">🏭 เวลาเครื่องแยกตาม process (ยอด ${fmt(pb.qty, 0)} ใบ) — แต่ละอันคนละเครื่อง</div>
			<table style="width:100%;border-collapse:collapse;font-size:12px">
				<thead><tr style="background:#ede9fe">
					<th style="padding:4px 8px;text-align:left">Process</th>
					<th style="padding:4px 8px;text-align:right">จำนวน</th>
					<th style="padding:4px 8px;text-align:right">ความเร็ว/ชม.</th>
					<th style="padding:4px 8px;text-align:right">เวลา</th>
					<th style="padding:4px 8px;text-align:right">ค่าใช้จ่าย</th>
					<th style="padding:4px 8px;text-align:right">ค่า/ชม.</th>
				</tr></thead>
				<tbody>${rows}</tbody>
			</table>
			${pb.bottleneck ? `<div style="margin-top:4px;font-size:11px;color:#b91c1c">🔴 <b>คอขวด = ${pb.bottleneck.label}</b> (${mins(pb.bottleneck.hours)}) — เครื่องนี้ตันสุด${pb.capacity != null ? ` → <b>กำลังผลิตจริง ~${fmt(pb.capacity, 0)} ครั้ง/กะ</b> (8ชม., จำกัดโดยคอขวด ไม่ใช่เครื่องพิมพ์)` : ''}</div>` : ''}
			${pb.profitPerBnHour != null ? `<div style="margin-top:6px;font-size:12px;background:#ecfdf5;border-left:3px solid #059669;padding:6px 10px;border-radius:4px">
				💎 <b>ตัวเลขจริงที่ใช้ตัดสิน</b> (ต่อชั่วโมง<b>คอขวด</b> = ทรัพยากรที่จำกัดจริง):
				ราคา/ชม.คอขวด <b>${fmt(pb.revenuePerBnHour, 0)}</b> • <b>กำไร/ชม.คอขวด ${fmt(pb.profitPerBnHour, 0)}</b>${verdict}
			</div>` : ''}
		</div>`
}

// ============================================================================
// [PROTOTYPE] เทียบเครื่องต่อ process — ถ้างานนี้ลงเครื่องไหนได้บ้าง อันไหนคุ้มกว่า
//   แต่ละ process มีหลายเครื่อง (เร็ว/ช้า/setupต่างกัน) → คิดเวลา+ต้นทุน/ชิ้น ของแต่ละตัว
//   ⚠️ ต้นทุน/ชม. ตอนนี้ใช้ค่าสมมติ "เท่ากันทุกเครื่อง" — ยังไม่ได้แยกค่าจริงต่างกัน
//   (ค่าเสื่อม/แรงงาน/ไฟ/overhead) → ดูได้แค่แนวโน้ม "เวลา" จริง ส่วน "คุ้มทุนจริง"
//   ต้องรอต้นทุน/ชม. รายเครื่องจากพี่ → เสียบ opts.ratesByName ทีหลัง
// ============================================================================
function computeMachineComparison(mainData, qtyIndex, machineTable, opts) {
	if (!mainData || !Array.isArray(machineTable)) return null
	const o = opts || {}
	const defaultRate = Number(o.defaultRatePerHour) > 0 ? Number(o.defaultRatePerHour) : 0 // ค่าเครื่อง/ชม. สมมติ (เท่ากันทุกเครื่อง)
	const ratesByName = o.ratesByName || {} // ของจริงรายเครื่อง (เสียบทีหลัง) → ค่อย override
	const forceSetup = o.setupHours != null ? Number(o.setupHours) : null // ถ้าระบุ → ใช้ setup นี้แทน make_ready ในตาราง
	const coatingType = o.coatingType || 'WATER' // OPP/UV/WATER → กรองเครื่องเคลือบให้ตรงชนิดงาน
	const coatingCatsFor = (t) => (t === 'OPP' ? ['OPP'] : t === 'UV' ? ['UV'] : ['Coating'])
	const comp = (mainData.component1 || [])[0] || {}
	const i = qtyIndex || 0
	const paperPrint = Number((((comp.paper_usage && comp.paper_usage.line) || [])[i] || {}).paper_print) || 0
	const orderQty = ((mainData.qty && mainData.qty.totalqty) || [])[i] || 0
	const sumAddon = (types) => (comp.addon || []).filter((a) => a && types.includes(a.type)).reduce((s, a) => s + (((a.line || [])[i] || {}).price || 0), 0)
	const findProc = (name) => (comp.process || []).find((p) => p && p.name === name)
	const hasTopProc = (name) => (mainData.process || []).some((p) => p && p.name === name)

	// process ที่งานนี้ใช้จริง + ฐานจำนวน (แผ่น/ใบ) + ประเภทเครื่องที่ทำงานนั้นได้
	const USES = []
	if (paperPrint > 0) USES.push({ key: 'print', label: 'พิมพ์', qty: paperPrint, unit: 'แผ่น', cats: ['Sheet'] })
	if (sumAddon(['coating']) > 0) USES.push({ key: 'coating', label: 'เคลือบ (' + coatingType + ')', qty: paperPrint, unit: 'แผ่น', cats: coatingCatsFor(coatingType) })
	if (findProc('diecut')) USES.push({ key: 'diecut', label: 'ไดคัท', qty: paperPrint, unit: 'แผ่น', cats: ['Die-cut'] })
	if (sumAddon(['foilstamp', 'emboss', 'deboss']) > 0) USES.push({ key: 'stamp', label: 'ปั๊ม (ฟอยล์/นูน)', qty: paperPrint, unit: 'แผ่น', cats: ['Hot Stamp', 'Die-cut'] })
	if (findProc('assembly')) USES.push({ key: 'assembly', label: 'ติดกาว/ประกอบ', qty: orderQty, unit: 'ใบ', cats: ['Glue'] })
	if (hasTopProc('chip')) USES.push({ key: 'strip', label: 'แกะ (strip-out)', qty: orderQty, unit: 'ใบ', cats: ['Strip'] })
	if (sumAddon(['corrugated', 'flute', 'laminate']) > 0) USES.push({ key: 'flute', label: 'ปะลูกฟูก', qty: paperPrint, unit: 'แผ่น', cats: ['Flute'] })

	const processes = USES.map((u) => {
		const candidates = machineTable
			.filter((m) => u.cats.includes(m.cat) && m.speed > 0)
			.map((m) => {
				const setup = forceSetup != null ? forceSetup : m.setup
				const hours = setup + u.qty / m.speed
				const rate = Number(ratesByName[m.name]) > 0 ? Number(ratesByName[m.name]) : defaultRate
				const costPerPiece = rate > 0 && u.qty > 0 ? (rate * hours) / u.qty : null
				return { name: m.name, cat: m.cat, speed: m.speed, setup, hours: +hours.toFixed(4), costPerPiece: costPerPiece != null ? +costPerPiece.toFixed(4) : null }
			})
			.sort((a, b) => a.hours - b.hours) // เร็วสุดขึ้นก่อน (เมื่อมีค่าเครื่องจริงค่อยจัดอันดับด้วยต้นทุน/ชิ้น)
		return { key: u.key, label: u.label, qty: u.qty, unit: u.unit, candidates }
	}).filter((p) => p.candidates.length > 1) // โชว์เฉพาะ process ที่มีเครื่องให้เลือก >1

	return { qty: orderQty, processes, usingRealRates: Object.keys(ratesByName).length > 0 }
}

function renderMachineComparison(cmp) {
	if (!cmp || !cmp.processes.length) return ''
	const fmt = (n, d) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
	const mins = (h) => fmt(h * 60, 1) + ' น.'
	const blocks = cmp.processes.map((p) => {
		const rows = p.candidates.map((c, idx) => `
			<tr style="${idx === 0 ? 'background:#dcfce7' : ''}">
				<td style="padding:3px 8px">${idx === 0 ? '⚡ ' : ''}${c.name}</td>
				<td style="text-align:right;color:#6b7280">${fmt(c.speed, 0)}/ชม.</td>
				<td style="text-align:right;color:#6b7280">${fmt(c.setup, 2)} ชม.</td>
				<td style="text-align:right;font-weight:${idx === 0 ? 'bold' : 'normal'}">${mins(c.hours)}</td>
				<td style="text-align:right">${c.costPerPiece != null ? fmt(c.costPerPiece, 3) : '<span style="color:#9ca3af">รอค่าเครื่อง/ชม.</span>'}</td>
			</tr>`).join('')
		return `
			<div style="margin-top:6px">
				<div style="font-size:12px;font-weight:bold;color:#7c3aed">${p.label} <span style="font-weight:normal;color:#6b7280">(งานยอด ${fmt(p.qty, 0)} ${p.unit} — มี ${p.candidates.length} เครื่องที่ทำได้)</span></div>
				<table style="width:100%;border-collapse:collapse;font-size:11px">
					<thead><tr style="background:#f3f4f6;color:#374151">
						<th style="padding:3px 8px;text-align:left">เครื่อง</th>
						<th style="padding:3px 8px;text-align:right">ความเร็ว</th>
						<th style="padding:3px 8px;text-align:right">setup</th>
						<th style="padding:3px 8px;text-align:right">เวลางานนี้</th>
						<th style="padding:3px 8px;text-align:right">ต้นทุน/ชิ้น</th>
					</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>`
	}).join('')
	return `
		<div style="margin-top:12px;border-top:1px dashed #c4b5fd;padding-top:8px">
			<div style="font-weight:bold;font-size:13px;color:#6d28d9">🔬 [Prototype] เทียบเครื่องที่ทำงานนี้ได้ — อันไหนคุ้มกว่า (⚡ = เร็วสุด)</div>
			${blocks}
			<div style="margin-top:8px;font-size:11px;color:#b45309;background:#fffbeb;border:1px dashed #fcd34d;border-radius:4px;padding:6px 10px">
				⚠️ <b>นี่เป็น Prototype</b> — ตอนนี้เทียบ "<b>เวลา</b>" จากความเร็วจริงเท่านั้น <b>ยังไม่ได้นับค่าต่างๆ ของแต่ละเครื่อง</b>
				(ค่าเสื่อม/ค่าแรง/ค่าไฟ/overhead ที่ต่างกัน) → ต้นทุน/ชิ้นใช้ค่าสมมติเท่ากันทุกเครื่อง<br>
				ดังนั้นยัง <b>ตัดสิน "คุ้มทุนจริง" ไม่ได้</b> — "เร็วสุด" อาจไม่ใช่ "คุ้มสุด" ถ้าเครื่องเร็วมีค่าเดินเครื่องแพงกว่า
				<b>รอต้นทุน/ชม. รายเครื่องจากพี่</b> มาเสียบ แล้วตารางจะจัดอันดับ "คุ้มทุน" + บอกจุดคุ้มทุน (break-even) ได้จริง
			</div>
		</div>`
}

// ============================================================================
// ตารางต่อชั่วโมง "คอลัมน์ละ quantity" (สลับ view กับตารางราคาเขียว)
//   แต่ละ quantity (1000/2000/.../5000) = 1 คอลัมน์ โชว์ตัวเลขต่อชั่วโมงของยอดนั้น
//   เน้น "กำไร/ชม.คอขวด" (= ตัวเลขที่ใช้ตัดสินจริง)
// ============================================================================
function computeHourlyByQty(mainData, procCfg) {
	const qtyArr = (mainData && mainData.qty && mainData.qty.totalqty) || []
	return qtyArr.map((qty, i) => {
		const pb = computeProcessBreakdown(mainData, i, procCfg)
		return { qty, bottleneck: pb.bottleneck, total: pb.total, margin: pb.margin, procs: pb.procs, colors: pb.colors,
			revenuePerBnHour: pb.revenuePerBnHour, profitPerBnHour: pb.profitPerBnHour, capacity: pb.capacity }
	})
}

// process ที่คิดเรทแบบ "สีละ X บาท/ชม." (พิมพ์) — เรท × เวลา × จำนวนสี
const PER_COLOR_PROC = { 'พิมพ์': true }
// ราคาคิดจากเวลา (วิธี Art): เรท(บาท/ชม.) × เวลา  [พิมพ์ = × จำนวนสีด้วย]
function timePriceOf(label, hours, rate, colors) {
	if (!(rate > 0) || !(hours > 0)) return null
	return PER_COLOR_PROC[label] ? rate * hours * (colors > 0 ? colors : 1) : rate * hours
}

function renderHourlyByQty(perQty, target, rates) {
	if (!perQty || !perQty.length) return '<div style="padding:10px">ยังไม่มีข้อมูล (กดคำนวณ price ก่อน)</div>'
	const fmt = (n, d) => (n == null || isNaN(n) ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
	const mins = (h) => (h == null ? '-' : fmt(h * 60, 1) + ' น.')
	const hasTarget = target != null && target > 0
	const rateOf = (label) => { const r = rates && rates[label]; return r != null && r !== '' && !isNaN(r) ? Number(r) : null }
	// ใช้ template เดียวกับตารางราคา (เขียว): <table border cellpadding="5"> + แถวสรุปใช้ class .totalRow (เขียว bold)
	const th = perQty.map((p) => `<th class="alCenter">${fmt(p.qty, 0)}</th>`).join('')
	const row = (label, cellFn, cls) => `<tr${cls ? ` class="${cls}"` : ''}><td class="alLeft">${label}</td>${perQty.map((p, i) => `<td class="alRight">${cellFn(p, i)}</td>`).join('')}</tr>`
	const profitCell = (p) => {
		if (p.profitPerBnHour == null) return '-'
		const badge = hasTarget ? (p.profitPerBnHour >= target ? ' <span title="ถึงเป้า">✅</span>' : ' <span title="ต่ำกว่าเป้า">⚠️</span>') : ''
		return `${fmt(p.profitPerBnHour, 0)}${badge}`
	}
	// รวมรายชื่อ process ทั้งหมด (เรียงตามยอดที่มี process มากสุด) — แต่ละแถว = 1 process
	let procLabels = []
	perQty.forEach((p) => { (p.procs || []).forEach((pr) => { if (!procLabels.includes(pr.label)) procLabels.push(pr.label) }) })
	const procOf = (p, label) => (p.procs || []).find((pr) => pr.label === label)
	// สร้างชุดแถว process ตาม "ค่าที่อยากโชว์" (valueFn) — ช่องคอขวดของยอดนั้น = ไฮไลต์แดง + เวลากำกับ
	const procSection = (valueFn) => procLabels.map((label) => {
		const cells = perQty.map((p) => {
			const pr = procOf(p, label)
			if (!pr) return `<td class="alRight">-</td>`
			const isBn = p.bottleneck && p.bottleneck.label === label
			const v = valueFn(p, pr)
			const tip = `<span style="font-size:10px;color:#9ca3af">(${mins(pr.hours)})</span>`
			return `<td class="alRight"${isBn ? ' style="background:#fee2e2;color:#b91c1c;font-weight:bold"' : ''}>${v == null ? '-' : fmt(v, 0)}${isBn ? ' 🔴' : ''}<br>${tip}</td>`
		}).join('')
		return `<tr><td class="alLeft">${label}</td>${cells}</tr>`
	}).join('')
	// (1) ค่าใช้จ่าย/ชม. = ค่างานของ process นั้น ÷ เวลา (มีเลขจริงเสมอ ไม่ต้องรอ markup)
	const costRows = procSection((p, pr) => (pr.hours > 0 ? pr.cost / pr.hours : null))
	// (2) กำไร/ชม. = กำไรทั้งงาน ÷ เวลาที่ process นั้นใช้ (0 จนกว่าตั้ง markup)
	const profitRows = procSection((p, pr) => (p.margin != null && pr.hours > 0 ? p.margin / pr.hours : null))
	const span = perQty.length + 1

	// ── 📊 ตารางเทียบ (Art): แต่ละยอดสั่งแบ่ง 3 ช่องย่อย เดิม|เวลา|ต่าง (มีเส้นขีดแยก) ──
	const diffHtml = (d) => `<b style="color:${d > 0 ? '#b91c1c' : d < 0 ? '#15803d' : '#6b7280'}">${d > 0 ? '+' : ''}${fmt(d, 0)}</b>`
	const cmpHead1 = perQty.map((p) => `<th colspan="3" class="alCenter">${fmt(p.qty, 0)}</th>`).join('')
	const cmpHead2 = perQty.map(() => `<th class="alCenter" style="font-size:11px;font-weight:normal">เดิม</th><th class="alCenter" style="font-size:11px;font-weight:normal">เวลา</th><th class="alCenter" style="font-size:11px;font-weight:normal">ต่าง</th>`).join('')
	const cmpRows = procLabels.map((label) => {
		const isPerColor = !!PER_COLOR_PROC[label]
		const rate = rateOf(label)
		const rateInput = `<input type="number" min="0" step="100" class="mh_rate_input" data-proc="${label}" value="${rate != null ? rate : ''}" placeholder="กรอกเรท" style="width:78px;padding:2px 5px;border:1px solid #c4b5fd;border-radius:4px;text-align:right;font-size:12px"> <span style="font-size:10px;color:#9ca3af">บ./ชม.${isPerColor ? '/สี' : ''}</span>`
		const cells = perQty.map((p) => {
			const pr = procOf(p, label)
			if (!pr) return `<td class="alRight">-</td><td class="alRight">-</td><td class="alRight">-</td>`
			const old = pr.cost
			const v = timePriceOf(label, pr.hours, rate, p.colors)
			const note = isPerColor && v != null && p.colors > 0 ? `<span style="font-size:9px;color:#9ca3af"> ×${p.colors}</span>` : ''
			const diffC = v == null ? '<span style="color:#cbd5e1;font-size:11px">รอเรท</span>' : diffHtml(v - old)
			return `<td class="alRight">${fmt(old, 0)}</td><td class="alRight">${v == null ? '-' : fmt(v, 0) + note}</td><td class="alRight">${diffC}</td>`
		}).join('')
		return `<tr><td class="alLeft" style="white-space:nowrap">${label}<br>${rateInput}</td>${cells}</tr>`
	}).join('')
	const cmpTotal = `<tr class="totalRow"><td class="alLeft">💰 รวม <span style="font-weight:normal;font-size:10px">(เฉพาะมีเรท)</span></td>${perQty.map((p) => {
		let oldSum = 0, vSum = 0, has = false
		procLabels.forEach((label) => { const pr = procOf(p, label); if (!pr) return; const v = timePriceOf(label, pr.hours, rateOf(label), p.colors); if (v != null) { oldSum += pr.cost; vSum += v; has = true } })
		if (!has) return `<td class="alRight">-</td><td class="alRight">-</td><td class="alRight">-</td>`
		return `<td class="alRight">${fmt(oldSum, 0)}</td><td class="alRight">${fmt(vSum, 0)}</td><td class="alRight">${diffHtml(vSum - oldSum)}</td>`
	}).join('')}</tr>`

	return `
		<div style="overflow-x:auto;font-family:inherit">
			<div style="font-weight:bold;font-size:15px;color:#15803d;margin:6px 0 4px;text-align:center">📊 เทียบราคา: สูตรเดิม vs เวลา×เรท</div>
			<div style="font-size:11px;color:#6b7280;text-align:center;margin-bottom:8px">กรอกเรท บาท/ชม.เอง • พิมพ์ = เรท×เวลา×สี • <b style="color:#b91c1c">ต่าง แดง = วิธีเวลาแพงกว่า</b> / <b style="color:#15803d">เขียว = ถูกกว่า</b></div>
			<table border cellpadding="5" align="center" style="border-collapse:collapse;margin:0 auto 16px;font-size:14px">
				<thead>
					<tr class="totalRow"><th rowspan="2" class="alLeft">รายการ (กรอกเรท)</th>${cmpHead1}</tr>
					<tr class="totalRow">${cmpHead2}</tr>
				</thead>
				<tbody>${cmpRows}${cmpTotal}</tbody>
			</table>

			<div style="font-weight:bold;font-size:14px;color:#6d28d9;margin:14px 0 8px;text-align:center">⏱️ วิเคราะห์ต่อชั่วโมง (ประกอบการตั้งเรท)${hasTarget ? ` • เป้ากำไร/ชม. ${fmt(target, 0)}` : ''}</div>
			<table border cellpadding="5" align="center" style="border-collapse:collapse;margin:0 auto;font-size:14px">
				<thead>
					<tr class="totalRow"><th class="alLeft">รายการ (ยอดสั่ง →)</th>${th}</tr>
				</thead>
				<tbody>
					<tr class="weightRow"><td class="alLeft" colspan="${span}">💵 <b>ค่าใช้จ่าย/ชม.</b> ของแต่ละ process — ค่างาน ÷ เวลา (= เรทโดยปริยายจากสูตรเดิม ใช้อ้างอิงตอนตั้งเรท) <span style="font-weight:normal;font-size:11px">(ตัวเลขเล็ก = เวลา • 🔴 = คอขวด)</span></td></tr>
					${costRows}
					<tr class="weightRow"><td class="alLeft" colspan="${span}">💎 <b>กำไร/ชม.</b> ของแต่ละ process — กำไรงาน ÷ เวลา <span style="font-weight:normal;font-size:11px">(=0 ถ้ายังไม่บวก markup)</span></td></tr>
					${profitRows}
					<tr class="weightRow"><td class="alLeft" colspan="${span}">💰 สรุปต่อยอดสั่ง</td></tr>
					${row('ราคารวม (บาท)', (p) => fmt(p.total, 2))}
					${row('🔴 คอขวด', (p) => p.bottleneck ? p.bottleneck.label : '-')}
					${row('เวลาคอขวด (รวม)', (p) => p.bottleneck ? mins(p.bottleneck.hours) : '-')}
					${row('กำลังผลิต/กะ (8ชม.)', (p) => p.capacity != null ? fmt(p.capacity, 0) + ' ครั้ง' : '-')}
					${row('ราคา/ชม.คอขวด', (p) => fmt(p.revenuePerBnHour, 0))}
					${row('💎 กำไร/ชม.คอขวด', profitCell, 'totalRow')}
				</tbody>
			</table>
			<div style="margin:10px auto 0;max-width:900px;font-size:11px;color:#6b7280;text-align:center">
				* <b>ตารางบน</b> = เทียบราคา (เดิม=สูตรปัจจุบัน / เวลา=เรท×เวลา×สี) • <b>ตารางล่าง</b> = ตัวเลขช่วยตั้งเรท • READ-ONLY ไม่บวกเข้าราคาจริง
			</div>
		</div>`
}

// ============================================================================
// แทรกตารางลง "หน้า price จริง" ต่อท้ายตาราง summary (#summary)
// ไม่แตะโค้ดเพื่อน — แค่ append ผ่าน DOM หลังกดคำนวณ price
// ============================================================================
if (typeof document !== 'undefined' && typeof jQuery !== 'undefined') {
	jQuery(function ($) {
		const PRICE_BTN = '#calc_price, #calc_price_after_change, #calc_price_after_packing'

		// ────────────────────────────────────────────────────────────────────
		// ⚙️ ข้อมูลจริงจากตารางเครื่องของพี่ (17 มิ.ย.) — แก้จุดเดียว หรือ set
		//    window.MACHINE_HOUR_CONFIG จากภายนอกก็ได้ (ไม่ต้องแตะไฟล์)
		//  • speed         = ความเร็วเครื่องพิมพ์ default (แผ่น/ชม.) — เครื่อง Sheet ส่วนใหญ่ 10,000
		//  • setupHours    = เวลาsetup/make_ready (ชม.) เฉลี่ย ~1 ชม. (พี่บอก "เฉลี่ยๆเอา")
		//  • target        = เป้าหมายกำไร/ชม. (บาท) — ⚠️ ยัง MOCKUP รอพี่ให้ตัวเลขจริง
		//  • processSpeeds = ความเร็วต่อ process (ชิ้น/แผ่น ต่อ ชม.) จากตารางพี่
		//  • speedByMachine= ความเร็วจริงรายเครื่องพิมพ์ (ชื่อ → แผ่น/ชม.) ใช้กับ per-component
		//  ⚠️ ติดกาว(assembly) ยังไม่มีในตารางที่พี่ส่ง → ใช้ค่าประมาณไปก่อน
		// ────────────────────────────────────────────────────────────────────
		const MACHINE_TABLE = [
				// Sheet (เครื่องพิมพ์)
				// ⚠️ id 3407: default.js (calc/เพื่อน) เรียก "L440" (พิมพ์ย่อ) แต่ชื่อจริง = "LS440" (ตารางพี่)
				//    metric จับคู่ด้วย machine_id แล้วโชว์ "LS440" → ไม่ต้องแก้ default.js ของเพื่อน
				[3403, 'CD440A', 'Sheet', 10000, 1.0], [3407, 'LS440', 'Sheet', 10000, 0.0], [3408, 'LS244', 'Sheet', 10000, 1.0],
				[3422, 'L444SP', 'Sheet', 10000, 1.0], [3423, 'L444APC', 'Sheet', 10000, 1.0], [3505, 'L540APC', 'Sheet', 10000, 1.0],
				[3506, 'LS540APC', 'Sheet', 10000, 1.0], [3507, 'LS1029', 'Sheet', 10000, 1.0], [3601, 'L640', 'Sheet', 10000, 1.0],
				[3604, 'L640APC-B', 'Sheet', 5000, 1.0], [3605, 'GL640 UV', 'Sheet', 10000, 0.5], [3606, 'GL844 + C(IR)', 'Sheet', 9000, 0.5],
				[3607, 'L640C', 'Sheet', 10000, 1.0],
				// Die-cut
				[5243, 'Crank Press', 'Die-cut', 0, 0.0], [5420, 'SANWA', 'Die-cut', 2500, 1.0], [5425, 'D 2 Manual', 'Die-cut', 400, 1.0],
				[5426, 'D 3 Manual', 'Die-cut', 400, 0.0], [5429, 'D 5 Manual', 'Die-cut', 400, 1.0], [5501, 'YOKO auto ไดคัท-ขาด', 'Die-cut', 2500, 1.0],
				[5502, 'YOKO ไดคัท+K auto', 'Die-cut', 2000, 1.5], [5511, 'ปั้มมือ-1', 'Die-cut', 400, 1.5], [5519, 'Yoco Diecut JY-106E', 'Die-cut', 3000, 1.0],
				[5525, 'ASAHI API300', 'Die-cut', 2000, 1.0], [5542, 'SHIHENG', 'Die-cut', 2500, 1.0],
				// UV
				[5941, 'UV Steinemann', 'UV', 2500, 1.0], [5942, 'UV TYMI', 'UV', 1800, 1.0],
				// OPP
				[5924, 'OPP wanchay', 'OPP', 1300, 1.0], [5931, 'OPP Yelee', 'OPP', 1300, 1.0],
				// Hot Stamp (ปั๊มทอง)
				[5901, 'LCK', 'Hot Stamp', 300, 0.0], [5903, 'Hot Stamp Manual 1', 'Hot Stamp', 500, 0.0],
				[5904, 'Hot Stamp manaul 2', 'Hot Stamp', 600, 0.0], [5905, 'Hot Stamp manaul 3', 'Hot Stamp', 600, 0.0],
				// Coating Packaging
				[5506, 'เครื่องขัดเงา', 'Coating', 1500, 1.0], [5507, 'เคลือบวอเตอร์เบส', 'Coating', 1500, 1.0],
				// Inspector
				[5535, 'Inspect', 'Inspector', 12000, 1.0],
				// Flute Laminator (ปะลูกฟูก)
				[5503, 'ปะลูกฟูก-เก่า', 'Flute', 2000, 0.3], [5540, 'ปะลูกฟูก-ใหม่', 'Flute', 2000, 0.3],
				// GLUE Packaging (ติดกาว/แกะ/ปะ)
				[5505, 'ปะหน้าต่าง', 'Glue', 1500, 1.0], [5510, 'Glue-1', 'Glue', 10000, 1.0], [5512, 'Glue-2', 'Glue', 10000, 1.0],
				[5513, 'เครื่องผ่าแผ่น ทับรอย', 'Glue', 0, 0.0], [5514, 'Presstypegluer 2000', 'Glue', 0, 0.0], [5516, 'Sourcevoltage 2000', 'Glue', 0, 0.0],
				[5517, 'เครื่องติดกาว', 'Glue', 0, 0.0], [5518, 'เครื่องพิมพ์ Flexo', 'Glue', 600, 2.0], [5520, 'แกะอัตโนมัติ MSCB-1080', 'Strip', 15000, 0.5],
				[5521, 'ปะกาวลิ้น 5521', 'Glue', 8000, 1.0], [5522, 'ปะกาวลิ้น 5522', 'Glue', 8000, 1.0], [5523, 'ติดเทปกาว Athos', 'Glue', 2000, 0.3],
				[5526, 'Glue-4', 'Glue', 10000, 1.0], [5529, 'ติดเส้นใบเลื่อยฟอยล์', 'Glue', 1800, 1.0], [5532, 'แชมเบอร์เกอร์', 'Glue', 3000, 1.0],
				[5534, 'ติดเส้นฟอยล์ JTJ-330', 'Glue', 3500, 1.0], [5536, 'Glue-3', 'Glue', 10000, 1.0], [5544, 'ติดเทป 2 หน้า KQ', 'Glue', 3000, 1.0],
			].map(([code, name, cat, speed, setup]) => ({ code, name, cat, speed, setup }))

			// override ภายนอกได้ (window.MACHINE_HOUR_CONFIG)
			const override = (typeof window !== 'undefined' && window.MACHINE_HOUR_CONFIG) || {}

			// ⚙️ เวลาsetup (make_ready) = 1 ชม. เท่ากันทุกเครื่อง — ปรับเลขเดียวที่นี่ให้ง่าย
			//    (MACHINE_TABLE เก็บ make_ready จริงรายเครื่องไว้แล้ว แต่ตอนนี้ยังไม่เอามาคิด)
			const SETUP = override.setupHours != null ? Number(override.setupHours) : 1

			// เครื่องพิมพ์: ชื่อ -> {speed(จริงรายเครื่อง), setup(=SETUP)}
			const machineByName = {}
			MACHINE_TABLE.filter((m) => m.cat === 'Sheet').forEach((m) => { machineByName[m.name] = { speed: m.speed, setup: SETUP } })
			// machine_id -> {name, speed, setup} ทุกเครื่อง (จับคู่ด้วย id กันชื่อเพี้ยน L440/LS440)
			const machineById = {}
			MACHINE_TABLE.forEach((m) => { machineById[m.code] = { name: m.name, speed: m.speed, setup: SETUP } })

			// process -> "กลุ่มเครื่องที่ทำงานนั้นได้" (ใช้ร่วมทั้ง per-process และตารางเทียบ → สอดคล้องกัน)
			//   per-process เลือก "ตัวเร็วสุด" ในกลุ่ม (= ⚡ ในตารางเทียบ) ; เคลือบเลือกตามชนิด (OPP/UV/water)
			//   strip(แกะ) แยกกลุ่มจาก glue(ติดกาว) แล้ว → ไม่ปนกัน
			const coatingCatsFor = (t) => (t === 'OPP' ? ['OPP'] : t === 'UV' ? ['UV'] : ['Coating'])
			const detectCoatingType = (comp) => {
				const blob = JSON.stringify(((comp && comp.addon) || []).filter((a) => a && a.type === 'coating')).toUpperCase()
				return blob.includes('OPP') ? 'OPP' : blob.includes('UV') ? 'UV' : 'WATER'
			}
			const catsFor = (key, coatingType) => (({
				print: ['Sheet'], coating: coatingCatsFor(coatingType), diecut: ['Die-cut'],
				stamp: ['Hot Stamp'], assembly: ['Glue'], strip: ['Strip'], chip: ['Strip'], flute: ['Flute'],
			})[key] || [])
			// เครื่องเร็วสุดในกลุ่ม (ตรงกับ ⚡ ในตารางเทียบ) — setup = SETUP เท่ากันทุกเครื่อง
			const fastestOf = (cats) => {
				const best = MACHINE_TABLE.filter((m) => cats.includes(m.cat) && m.speed > 0).reduce((a, b) => (!a || b.speed > a.speed ? b : a), null)
				return { speed: best ? best.speed : 0, setup: SETUP }
			}

			const CFG = {
				defaultSpeed: Number(override.speed) > 0 ? Number(override.speed) : 10000,
				setupHours: SETUP,
				target: Number(override.target) > 0 ? Number(override.target) : null, // ไม่มีเป้าปลอม — เฮียกรอกเองในช่อง (รอเลขจริง)
				machineByName: Object.assign({}, machineByName, override.machineByName || {}),
				machineById: Object.assign({}, machineById, override.machineById || {}),
				ratePerHour: Number(override.ratePerHour) > 0 ? Number(override.ratePerHour) : 500, // ⚠️ MOCKUP ค่าเครื่อง/ชม. เท่ากันทุกเครื่อง
				ratesByName: override.ratesByName || {}, // ของจริงรายเครื่อง (เสียบทีหลัง → จัดอันดับคุ้มทุนจริง)
			}

			function doInject() {
			const $summary = $('#summary')
			const metricOpts = { setupHours: CFG.setupHours, machineByName: CFG.machineByName, machineById: CFG.machineById }
			const metric = (typeof est !== 'undefined' && est && est.mainData) ? computeMachineHourMetric(est.mainData, CFG.defaultSpeed, metricOpts) : null
			if (!$summary.length || !metric || !metric.rows.length) return false
			$('#machine_hour_metric').remove()
			// เตือนถ้าเครื่องพิมพ์ของงานนี้ไม่มีในตาราง (เช่น Jet Press/Konica) → ใช้ความเร็ว fallback
			const note = metric.allRealSpeed
				? `<span style="font-size:11px;color:#15803d;font-weight:normal">— ✅ ความเร็วจริงจากพี่ + setup ${CFG.setupHours} ชม. <span style="color:#d97706">(เป้ากำไร/ชม. ยังสมมติ)</span></span>`
				: `<span style="font-size:11px;color:#dc2626;font-weight:normal">— ⚠️ เครื่องพิมพ์งานนี้ (${metric.machine}) ยังไม่มีความเร็วจริงในตาราง → ใช้ค่า fallback ${CFG.defaultSpeed.toLocaleString()} (รอความเร็วจริงจากพี่)</span>`
			const c0 = (est.mainData.component1 || [])[0] || {}
				const coatingType = detectCoatingType(c0) // OPP/UV/WATER → เลือกเครื่องเคลือบให้ตรงชนิด
				// เครื่องพิมพ์งานนี้: จับด้วย id ก่อน (กันชื่อเพี้ยน) แล้วค่อยชื่อ
				const printCfg = { speed: 6000, setup: CFG.setupHours } // [ทีม] เครื่องพิมพ์ความเร็ว 6,000 แผ่น/ชม. ทุกเครื่อง (override)
				// per-process: เลือก "ตัวเร็วสุด" ในแต่ละกลุ่ม → ตรงกับ ⚡ ในตารางเทียบเสมอ
				const procCfg = Object.assign({
					print: printCfg,
					coating: fastestOf(catsFor('coating', coatingType)),
					diecut: fastestOf(catsFor('diecut')),
					stamp: fastestOf(catsFor('stamp')),
					assembly: fastestOf(catsFor('assembly')),
					strip: fastestOf(catsFor('strip')),
					chip: fastestOf(catsFor('chip')),
					flute: fastestOf(catsFor('flute')),
				}, override.processSpeeds || {})

				// ── ปุ่มสลับ view: ราคา (ตารางเขียว) ↔ ต่อชั่วโมง (คอลัมน์ละ quantity) ──
				$('#mh_view_toggle, #hourly_by_qty').remove()
				const hourly = computeHourlyByQty(est.mainData, procCfg)
				const tabCss = 'cursor:pointer;border:1px solid #c4b5fd;padding:5px 14px;border-radius:6px;font-weight:bold;font-size:13px'
				const targetVal = CFG.target != null ? CFG.target : '' // เป้าปัจจุบัน (ว่าง = ยังไม่ตั้ง)
				$summary.before(`
					<div id="mh_view_toggle" style="max-width:900px;margin:8px auto 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-family:inherit">
						<span style="font-size:12px;color:#6b7280">มุมมอง:</span>
						<span class="mh_tab" data-v="price" style="${tabCss};background:#2563eb;color:#fff">💰 ราคา</span>
						<span class="mh_tab" data-v="hours" style="${tabCss};background:#fff;color:#6d28d9">⏱️ ต่อชั่วโมง</span>
						<span id="mh_target_box" style="display:none;align-items:center;gap:5px;font-size:12px;color:#6b7280;margin-left:auto">
							🎯 เป้ากำไร/ชม.:
							<input id="mh_target_input" type="number" min="0" step="500" placeholder="ใส่เลขเป้า" value="${targetVal}"
								style="width:90px;padding:3px 6px;border:1px solid #c4b5fd;border-radius:5px;text-align:right;font-size:12px">
							<span style="color:#9ca3af">บาท (ว่าง = ไม่เทียบเป้า)</span>
						</span>
					</div>
					<div id="hourly_by_qty" style="display:none;margin:10px auto;padding:6px 4px"></div>
				`)
				// state เป้าเก็บนอก scope ฟังก์ชัน เพื่อให้กรอกแล้วจำได้ข้ามการกดคำนวณ
				if (typeof window !== 'undefined' && window.MH_TARGET == null && CFG.target != null) window.MH_TARGET = CFG.target
				const curTarget = () => (typeof window !== 'undefined' && Number(window.MH_TARGET) > 0 ? Number(window.MH_TARGET) : null)
				// เรท บาท/ชม. ต่อ process (กรอกเอง, จำข้ามการกดคำนวณ) — เติมพิมพ์ 2,500/สี ตาม Art
				if (typeof window !== 'undefined' && !window.MH_RATES) window.MH_RATES = { 'พิมพ์': 500 } // [ทีม] เรทพิมพ์ 500/สี/ชม. (รวมสีพิเศษ)
				const curRates = () => (typeof window !== 'undefined' && window.MH_RATES) || {}
				const drawHourly = () => { $('#hourly_by_qty').html(renderHourlyByQty(hourly, curTarget(), curRates())) }
				drawHourly()
				$('#mh_target_input').val(curTarget() != null ? curTarget() : '')
				$('body').off('click.mhview').on('click.mhview', '.mh_tab', function () {
					const v = $(this).attr('data-v')
					$('.mh_tab').css({ background: '#fff', color: '#6d28d9' })
					$(this).css({ background: '#2563eb', color: '#fff' })
					if (v === 'hours') { $('#summary').hide(); $('#hourly_by_qty').show(); $('#mh_target_box').css('display', 'flex') }
					else { $('#summary').show(); $('#hourly_by_qty').hide(); $('#mh_target_box').hide() }
				})
				// กรอกเป้า → จำค่า + วาดตารางใหม่ (badge ✅/⚠️ ขึ้นตาม)
				$('body').off('input.mhtarget').on('input.mhtarget', '#mh_target_input', function () {
					const v = parseFloat(this.value)
					if (typeof window !== 'undefined') window.MH_TARGET = v > 0 ? v : null
					drawHourly()
				})
				// กรอกเรท บาท/ชม. ต่อ process → จำค่า + คิดราคา(เรท×เวลา)ใหม่ (ใช้ change กันโฟกัสหลุดตอนพิมพ์)
				$('body').off('change.mhrate').on('change.mhrate', '.mh_rate_input', function () {
					const proc = $(this).attr('data-proc')
					const v = parseFloat(this.value)
					if (typeof window !== 'undefined') { window.MH_RATES = window.MH_RATES || {}; if (v > 0) window.MH_RATES[proc] = v; else delete window.MH_RATES[proc] }
					drawHourly()
				})

			$summary.after(`
				<div id="machine_hour_metric" style="max-width:900px;margin:14px auto;border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:12px 14px;font-family:inherit">
					<div style="font-weight:bold;font-size:15px;color:#b45309;margin-bottom:8px">⏱️ ราคาต่อชั่วโมงเครื่อง ${note}</div>
					${renderMachineHourMetric(metric, CFG.target)}
					${renderProcessBreakdown(computeProcessBreakdown(est.mainData, 0, procCfg), CFG.target)}
					${renderMachineComparison(computeMachineComparison(est.mainData, 0, MACHINE_TABLE, { defaultRatePerHour: CFG.ratePerHour, ratesByName: CFG.ratesByName, setupHours: CFG.setupHours, coatingType }))}
				</div>`)
			return true
		}

		// retry หลายรอบ เผื่อ summary/est.mainData ยังไม่พร้อมตอนกด
		function tryInject(attemptsLeft) {
			if (doInject()) return
			if (attemptsLeft > 0) setTimeout(() => tryInject(attemptsLeft - 1), 400)
			else console.warn('[machine-hour] inject ไม่ได้ — #summary:' + $('#summary').length + ' est.mainData:' + (typeof est !== 'undefined' && !!(est && est.mainData)))
		}

		$('body').on('click', PRICE_BTN, function () { setTimeout(() => tryInject(10), 500) })
		setTimeout(() => tryInject(6), 1500) // เผื่อเปิดหน้าที่คำนวณไว้แล้ว
	})
}

// export สำหรับเทส (Node) — ในเบราว์เซอร์เรียกใช้ฟังก์ชันตรงๆ
if (typeof module !== 'undefined' && module.exports) {
	module.exports = { computeMachineHourMetric, renderMachineHourMetric, computeProcessBreakdown, renderProcessBreakdown, computeMachineComparison, renderMachineComparison, computeHourlyByQty, renderHourlyByQty, timePriceOf }
}
