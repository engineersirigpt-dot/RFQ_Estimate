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
//   (ถ้าพี่ให้ "ความเร็วรันล้วน" แยกเวลาเซต ค่อยเพิ่มเวลาเซตทีหลัง — ตอนนี้ถือว่า flat)
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
	const setupHours = Number(o.setupHours) > 0 ? Number(o.setupHours) : 0 // make_ready/เซตเครื่อง (ชม.) — พี่บอกเฉลี่ย ~1 ชม.
	const speedByMachine = o.speedByMachine || {} // ชื่อเครื่อง → ความเร็วจริง (จากตารางพี่)

	// ความเร็วต่อเครื่อง (ลำดับความสำคัญ): field ใน master > ตารางความเร็วตามชื่อเครื่อง (พี่) > fallback
	const machineSpeedOf = (comp) => {
		const m = (comp && comp.machine) || {}
		const real = Number(m.machine_speed) || Number(m.speed_sheets_per_hour) || Number(m.speed)
		if (real > 0) return real
		const byName = Number(speedByMachine[m.machine_name])
		if (byName > 0) return byName
		return speedSheetsPerHour
	}

	// ข้อมูลคงที่ต่อ component — แต่ละ component อาจใช้คนละเครื่อง/คนละสี/คนละความเร็ว
	//   passes = จำนวนรอบที่แผ่นวิ่งผ่านเครื่อง (สี > ชุดพิมพ์ → หลายรอบ)
	//   units=0 (ดิจิทัล/ไม่มีข้อมูล) → 1 รอบ
	//   ⚠️ สมมติ "ความเร็ว = impressions/ชม." จึงคูณ passes
	const compInfo = comps.map((comp) => {
		const machine = (comp.machine && comp.machine.machine_name) || '-'
		const units = (comp.machine && comp.machine.color && Number(comp.machine.color.max)) || 0
		const color = (comp.color && comp.color[0]) || {}
		const outside = Number(color.outside) || 0
		const inside = Number(color.inside) || 0
		let passes = units > 0 ? (Math.ceil(outside / units) + Math.ceil(inside / units)) : 1
		if (passes < 1) passes = 1
		const speed = machineSpeedOf(comp)
		return {
			machine, units, outside, inside, passes, speed,
			isRealSpeed: speed !== speedSheetsPerHour, // true = ใช้ความเร็วจริงจาก master (ไม่ใช่ mockup)
			lines: (comp.paper_usage && comp.paper_usage.line) || [],
			wasteArr: (comp.waste && comp.waste.waste) || [],
		}
	})

	const rows = qtyArr.map((qty, i) => {
		// รวมเวลาเครื่องของทุก component (แต่ละตัววิ่งบนเครื่องของมัน)
		let hours = 0, sheets = 0, wasteSheets = 0
		const byComponent = compInfo.map((c) => {
			const s = Number((c.lines[i] || {}).paper_print) || 0
			// เวลา = เซตเครื่อง + (แผ่น × รอบพิมพ์ ÷ ความเร็ว) • ถ้าไม่มีงาน (s=0) → 0
			const h = s > 0 ? setupHours + (s * c.passes) / c.speed : 0
			hours += h; sheets += s; wasteSheets += Number(c.wasteArr[i]) || 0
			return { machine: c.machine, sheets: s, passes: c.passes, hours: +h.toFixed(4) }
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
		components: compInfo.map((c) => ({ machine: c.machine, units: c.units, outside: c.outside, inside: c.inside, passes: c.passes, speed: c.speed, isRealSpeed: c.isRealSpeed })),
		speed: speedSheetsPerHour, // ความเร็ว fallback — เครื่องที่ระบุชื่อตรงตารางใช้ของจริงใน rows
		allRealSpeed: compInfo.every((c) => c.isRealSpeed), // true = ทุกเครื่อง map ความเร็วเฉพาะเครื่องได้
		anyRealSpeed: compInfo.some((c) => c.isRealSpeed),
		setupHours, shiftHours: SHIFT_HOURS, rows,
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
			<td style="text-align:right;color:${r.makereadyPct > 80 ? '#dc2626' : '#374151'}">${fmt(r.makereadyPct, 1)}%</td>
			<td style="text-align:right">${fmt(r.hours, 3)} ชม.<br><span style="color:#9ca3af;font-size:11px">(${mins(r.hours)})</span></td>
			<td style="text-align:right">${fmt(r.total, 2)}</td>
			<td style="text-align:right;font-weight:bold;background:#fef3c7">${fmt(r.costPerHour, 2)}</td>
			<td style="text-align:right;font-weight:bold;background:#dcfce7;color:${r.marginPerHour > 0 ? '#15803d' : '#6b7280'}">${fmt(r.marginPerHour, 2)}${hasTarget && r.marginPerHour != null ? (r.marginPerHour >= target ? ' <span title="ถึงเป้า">✅</span>' : ' <span title="ต่ำกว่าเป้า">⚠️</span>') : ''}</td>
			<td style="text-align:right;font-weight:bold;background:#dbeafe">${fmt(r.printPerHour, 2)}</td>
		</tr>`).join('')
	const mkVals = metric.rows.map((r) => r.makereadyPct).filter((x) => x != null)
	const mkRange = mkVals.length ? (fmt(Math.min(...mkVals), 0) + '–' + fmt(Math.max(...mkVals), 0) + '%') : '-'
	const maxJobs = Math.max(0, ...metric.rows.map((r) => r.jobsPerShift || 0))
	const single = metric.compCount === 1
	const passBadge = (p) => `<span style="color:${p > 1 ? '#dc2626' : '#16a34a'};font-weight:bold">${p} รอบ</span>${p > 1 ? ' (เวลา×' + p + ')' : ''}`
	const compDetail = single
		? `<b>ชุดพิมพ์:</b> ${metric.components[0].units} สี &nbsp;•&nbsp; <b>สีงาน:</b> ${metric.components[0].outside}+${metric.components[0].inside} &nbsp;•&nbsp; <b>รอบพิมพ์:</b> ${passBadge(metric.components[0].passes)}`
		: metric.components.map((c, idx) => `<b>Comp${idx + 1} (${c.machine}):</b> ${c.units} ชุด / ${c.outside}+${c.inside} สี / ${passBadge(c.passes)}`).join('&nbsp;&nbsp;•&nbsp;&nbsp;')
	// go/no-go: เทียบกำไร/ชม. กับเป้าหมาย (สมมติ) → คุ้มกี่ยอด
	let verdictHtml = ''
	if (hasTarget) {
		const mv = metric.rows.map((r) => r.marginPerHour).filter((x) => x != null)
		const ok = mv.filter((x) => x >= target).length
		const v = !mv.length ? '' : ok === mv.length
			? `<span style="color:#15803d;font-weight:bold">✅ คุ้มเวลาเครื่องทุกยอด</span>`
			: ok === 0
				? `<span style="color:#dc2626;font-weight:bold">⚠️ กำไร/ชม. ต่ำกว่าเป้าทุกยอด — ควรขอเพิ่มราคา/เพิ่มยอด</span>`
				: `<span style="color:#d97706;font-weight:bold">🟡 คุ้ม ${ok}/${mv.length} ยอด (ยอดน้อยยังไม่ถึงเป้า)</span>`
		verdictHtml = `<div style="margin-bottom:6px;font-size:12px;background:#f0f9ff;border-left:3px solid #2563eb;padding:5px 10px;border-radius:4px">🎯 <b>เป้าหมายกำไร/ชม. (สมมติ):</b> ${fmt(target, 0)} บาท → ${v}</div>`
	}
	return `
		<div style="font-size:13px">
			<div style="margin-bottom:4px">
				<b>เครื่อง:</b> ${metric.machine} &nbsp;•&nbsp; <b>ความเร็ว:</b> ${fmt(metric.speed, 0)} แผ่น/ชม.${metric.compCount > 1 ? ` &nbsp;•&nbsp; <span style="color:#2563eb;font-weight:bold">${metric.compCount} components (รวมเวลาทุกเครื่อง)</span>` : ''}
			</div>
			<div style="margin-bottom:6px;font-size:12px">${compDetail}</div>
			${verdictHtml}
			<table style="width:100%;border-collapse:collapse">
				<thead><tr style="background:#e5e7eb">
					<th style="padding:5px 8px;text-align:left">ยอดสั่ง</th>
					<th style="padding:5px 8px;text-align:right">แผ่นที่พิมพ์</th>
					<th style="padding:5px 8px;text-align:right">%เซตเครื่อง</th>
					<th style="padding:5px 8px;text-align:right">เวลาเดินเครื่อง</th>
					<th style="padding:5px 8px;text-align:right">ราคารวม</th>
					<th style="padding:5px 8px;text-align:right">ราคารวม/ชั่วโมง</th>
					<th style="padding:5px 8px;text-align:right">กำไร/ชั่วโมง</th>
					<th style="padding:5px 8px;text-align:right">ค่าพิมพ์(สี)/ชั่วโมง</th>
				</tr></thead>
				<tbody>${rows}</tbody>
			</table>
			<div style="margin-top:8px;font-size:11px;color:#6b7280">
				💡 <b>ข้อสังเกต:</b> %เซตเครื่อง ${mkRange} = งานยอดน้อยเสียเวลากับ makeready เยอะ • กำลังผลิต(เฉพาะเครื่องพิมพ์) ~${fmt(maxJobs, 0)} ครั้ง/กะ — ⚠️ <b>กำลังผลิตจริงจำกัดโดยคอขวด</b> (ดูตาราง process ด้านล่าง)<br>
				* เทียบดูเฉยๆ ไม่บวกเข้าราคาขาย • <b>กำไร = ราคาขาย − ต้นทุน</b> (ขยับตาม markup, =0 ถ้าไม่บวกกำไร) • เวลา = เซตเครื่อง${metric.setupHours ? ' ' + metric.setupHours + ' ชม.' : ''} + (แผ่นพิมพ์ × รอบพิมพ์ ÷ ความเร็ว)
			</div>
		</div>`
}

// ============================================================================
// แยกเวลาเครื่อง "ต่อ process" — แต่ละ process = คนละเครื่อง คนละความเร็ว
//   sheet-based (เครื่องรันแผ่น): พิมพ์/เคลือบ/ไดคัท/ปั๊ม → ใช้ paper_print (แผ่น)
//   piece-based (ต่อใบสำเร็จ): ติดกาว/ประกอบ → ใช้ยอดสั่ง (ใบ)
//   เวลา = เซตเครื่อง + (จำนวน ÷ ความเร็ว process) • คอขวด = process ที่ใช้เวลานานสุด
//   ความเร็วจริงจากตารางเครื่องของพี่ + setup เฉลี่ย ~1 ชม./เครื่อง
// ============================================================================
function computeProcessBreakdown(mainData, qtyIndex, speeds) {
	const comp = (mainData.component1 || [])[0] || {}
	const i = qtyIndex || 0
	const paperPrint = Number((((comp.paper_usage && comp.paper_usage.line) || [])[i] || {}).paper_print) || 0
	const orderQty = ((mainData.qty && mainData.qty.totalqty) || [])[i] || 0
	const tp = (mainData.totalprice || [])[i] || {}
	const sp = speeds || {}
	const setupHours = Number(sp.setupHours) > 0 ? Number(sp.setupHours) : 0 // เซตเครื่อง/make_ready (ชม.)
	const procs = []
	const add = (label, unit, qty, cost, speed) => {
		const c = Number(cost) || 0
		if (!(qty > 0) || !(speed > 0) || !(c > 0)) return // c=0 → process ไม่มีในงานนี้ → ข้าม
		const hours = setupHours + qty / speed // รวมเวลาเซตเครื่อง
		procs.push({ label, unit, qty, speed, cost: +c.toFixed(2), hours: +hours.toFixed(4), costPerHour: hours > 0 ? +(c / hours).toFixed(2) : null })
	}
	const sumAddon = (types) => (comp.addon || []).filter((a) => a && types.includes(a.type)).reduce((s, a) => s + (((a.line || [])[i] || {}).price || 0), 0)
	const findProc = (name) => (comp.process || []).find((p) => p && p.name === name)

	add('พิมพ์', 'แผ่น', paperPrint, Number(tp.print) || 0, sp.print)            // sheet-based
	add('เคลือบ', 'แผ่น', paperPrint, sumAddon(['coating']), sp.coating)         // sheet-based
	const dc = findProc('diecut')
	if (dc) { const ln = (dc.line || [])[i] || {}; add('ไดคัท', 'แผ่น', paperPrint, ((ln.block && ln.block.price) || 0) + ((ln.labor && ln.labor.price) || 0), sp.diecut) }
	add('ปั๊ม (ฟอยล์/นูน)', 'แผ่น', paperPrint, sumAddon(['foilstamp', 'emboss', 'deboss']), sp.stamp) // sheet-based
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

	// ตัวเลขเชิง BD จริง: ต่อ "ชั่วโมงคอขวด" (ทรัพยากรที่จำกัด — Theory of Constraints)
	const COST_KEYS = ['material', 'plate', 'print', 'proof', 'afterpress', 'delivery', 'other']
	const total = tp.total_with_price_diff != null ? tp.total_with_price_diff : tp.total_price
	const cost = COST_KEYS.reduce((s, k) => s + (Number(tp[k]) || 0), 0)
	const margin = total != null ? total - cost : null
	const bh = bottleneck ? bottleneck.hours : 0
	return {
		qty: orderQty, procs, bottleneck,
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
		//  • setupHours    = เวลาเซตเครื่อง/make_ready (ชม.) เฉลี่ย ~1 ชม. (พี่บอก "เฉลี่ยๆเอา")
		//  • target        = เป้าหมายกำไร/ชม. (บาท) — ⚠️ ยัง MOCKUP รอพี่ให้ตัวเลขจริง
		//  • processSpeeds = ความเร็วต่อ process (ชิ้น/แผ่น ต่อ ชม.) จากตารางพี่
		//  • speedByMachine= ความเร็วจริงรายเครื่องพิมพ์ (ชื่อ → แผ่น/ชม.) ใช้กับ per-component
		//  ⚠️ ติดกาว(assembly) ยังไม่มีในตารางที่พี่ส่ง → ใช้ค่าประมาณไปก่อน
		// ────────────────────────────────────────────────────────────────────
		const DEFAULTS = {
			speed: 10000,    // เครื่องพิมพ์ Sheet (ส่วนใหญ่ 10,000)
			setupHours: 1,   // make_ready เฉลี่ย ~1 ชม.
			target: 10000,   // ⚠️ MOCKUP — เป้ากำไร/ชม. ยังไม่ได้จากพี่
			processSpeeds: {
				print: 10000,   // Sheet presses
				coating: 1500,  // Coating Packaging (water-base/ขัดเงา); UV 1,800-2,500, OPP 1,300
				diecut: 2500,   // Die-cut auto (SANWA/SHIHENG 2,500, Yoco 3,000); manual 400
				stamp: 500,     // ปั๊มทอง Hot Stamp (300-600). ปั๊มจม/นูนไม่มีเครื่องเฉพาะ → ใช้ไดคัท(2,500)
				                //   หรือเคโยกมือ(500-600) ใช้ 500 แบบ conservative
				assembly: 10000,// ติดกาว Glue-1/2/3/4 (10,000) — ของจริงจากพี่ (เดิมเดา 3,000)
				strip: 15000,   // แกะอัตโนมัติ 5520 MSCB-1080 (15,000)
				chip: 15000,
			},
			speedByMachine: { // จากตารางเครื่อง Sheet ของพี่
				'CD440A': 10000, 'LS440': 10000, 'LS244': 10000, 'L444SP': 10000, 'L444APC': 10000,
				'L540APC': 10000, 'LS540APC': 10000, 'LS1029': 10000, 'L640': 10000,
				'L640APC-B': 5000, 'GL640 UV': 10000, 'GL844 + C(IR)': 9000, 'L640C': 10000,
			},
		}
		const override = (typeof window !== 'undefined' && window.MACHINE_HOUR_CONFIG) || {}
		const CFG = {
			speed: Number(override.speed) > 0 ? Number(override.speed) : DEFAULTS.speed,
			setupHours: override.setupHours != null ? Number(override.setupHours) : DEFAULTS.setupHours,
			target: Number(override.target) > 0 ? Number(override.target) : DEFAULTS.target,
			processSpeeds: Object.assign({}, DEFAULTS.processSpeeds, override.processSpeeds || {}),
			speedByMachine: Object.assign({}, DEFAULTS.speedByMachine, override.speedByMachine || {}),
		}

		function doInject() {
			const $summary = $('#summary')
			const metricOpts = { setupHours: CFG.setupHours, speedByMachine: CFG.speedByMachine }
			const metric = (typeof est !== 'undefined' && est && est.mainData) ? computeMachineHourMetric(est.mainData, CFG.speed, metricOpts) : null
			if (!$summary.length || !metric || !metric.rows.length) return false
			$('#machine_hour_metric').remove()
			const note = `<span style="font-size:11px;color:#15803d;font-weight:normal">— ✅ ความเร็วจริงจากพี่ + เซตเครื่อง ${CFG.setupHours} ชม. <span style="color:#d97706">(เป้ากำไร/ชม. ยังสมมติ)</span></span>`
			const procSpeeds = Object.assign({ setupHours: CFG.setupHours }, CFG.processSpeeds)
			$summary.after(`
				<div id="machine_hour_metric" style="max-width:900px;margin:14px auto;border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:12px 14px;font-family:inherit">
					<div style="font-weight:bold;font-size:15px;color:#b45309;margin-bottom:8px">⏱️ ราคาต่อชั่วโมงเครื่อง ${note}</div>
					${renderMachineHourMetric(metric, CFG.target)}
					${renderProcessBreakdown(computeProcessBreakdown(est.mainData, 0, procSpeeds), CFG.target)}
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
	module.exports = { computeMachineHourMetric, renderMachineHourMetric, computeProcessBreakdown, renderProcessBreakdown }
}
