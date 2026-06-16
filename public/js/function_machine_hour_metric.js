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
// - ยังไม่มีข้อมูลความเร็วใน master → รับ speedSheetsPerHour เป็น input (พี่จะเอาเลขจริงมาเสียบ)
// - paper_print รวมแผ่น makeready/เผื่อเสีย (waste) อยู่แล้ว → เวลานี้คือเวลาที่เครื่องเดินจริง
//   (ถ้าพี่ให้ "ความเร็วรันล้วน" แยกเวลาเซต ค่อยเพิ่มเวลาเซตทีหลัง — ตอนนี้ถือว่า flat)
// - draft นี้คิด component แรกก่อน (TODO: รองรับหลาย component/หลายเครื่อง)
// ============================================================================

/**
 * คำนวณเมตริกชั่วโมงเครื่อง + ราคา/ชั่วโมง ต่อยอดสั่ง
 * @param {object} mainData  est.mainData (อ่านอย่างเดียว)
 * @param {number} speedSheetsPerHour  ความเร็วเครื่อง (แผ่น/ชั่วโมง) — จากพี่
 * @returns {{machine:string, rows:Array}|null}
 */
function computeMachineHourMetric(mainData, speedSheetsPerHour) {
	if (!mainData || !(speedSheetsPerHour > 0)) return null
	const compCount = (mainData.component1 || []).length // โชว์เตือนถ้ามีหลาย component (draft คิดตัวแรก)
	const comp = (mainData.component1 || [])[0] || {}
	const machine = (comp.machine && comp.machine.machine_name) || '-'
	const units = (comp.machine && comp.machine.color && Number(comp.machine.color.max)) || 0 // ชุดพิมพ์ (color units) ของเครื่อง
	const color = (comp.color && comp.color[0]) || {}
	const outside = Number(color.outside) || 0
	const inside = Number(color.inside) || 0

	// จำนวนรอบที่แผ่นวิ่งผ่านเครื่อง (passes): ถ้าสี > ชุดพิมพ์ ต้องวิ่งหลายรอบ
	//   passes = ceil(สีหน้านอก/ชุดพิมพ์) + ceil(สีหน้าใน/ชุดพิมพ์)
	//   units=0 (เครื่องดิจิทัล/ไม่มีข้อมูล) → ถือว่า 1 รอบ
	// ⚠️ สมมติ "ความเร็ว = impressions/ชม. (ต่อรอบ)" จึงคูณ passes — ถ้าพี่บอกว่าเป็น
	//   "แผ่นเสร็จ/ชม." (รวม passes แล้ว) ให้ลบการคูณ passes ออก (ตั้ง passes=1)
	let passes = units > 0 ? (Math.ceil(outside / units) + Math.ceil(inside / units)) : 1
	if (passes < 1) passes = 1

	const lines = (comp.paper_usage && comp.paper_usage.line) || []
	const wasteArr = (comp.waste && comp.waste.waste) || [] // แผ่น makeready/เผื่อเสีย ต่อยอด
	const tp = mainData.totalprice || []
	const qtyArr = (mainData.qty && mainData.qty.totalqty) || []
	const SHIFT_HOURS = 8 // กะมาตรฐาน 8 ชม. (ใช้คิดกำลังผลิต/กะ)
	const COST_KEYS = ['material', 'plate', 'print', 'proof', 'afterpress', 'delivery', 'other']

	const rows = qtyArr.map((qty, i) => {
		const ln = lines[i] || {}
		const sheets = Number(ln.paper_print) || 0 // แผ่นที่เครื่องเดินจริง (รวม makeready/waste)
		const impressions = sheets * passes        // จำนวนรอบพิมพ์รวม (แผ่น × passes)
		const t = tp[i] || {}
		const total = t.total_with_price_diff != null ? t.total_with_price_diff : t.total_price
		const print = Number(t.print) || 0 // ค่าพิมพ์ (หมึก+พิมพ์) จาก calc — แบบ A
		const cost = COST_KEYS.reduce((s, k) => s + (Number(t[k]) || 0), 0) // ต้นทุนรวมทุกหมวด
		const margin = total != null ? total - cost : null // กำไร = ราคาขาย − ต้นทุน (ขยับตาม markup)
		const hours = impressions / speedSheetsPerHour
		const costPerHour = hours > 0 && total != null ? total / hours : null
		const printPerHour = hours > 0 ? print / hours : null
		const marginPerHour = hours > 0 && margin != null ? margin / hours : null
		const wasteSheets = Number(wasteArr[i]) || 0
		const makereadyPct = sheets > 0 ? (wasteSheets / sheets) * 100 : null // % แผ่นที่เป็นเซตเครื่อง/เผื่อเสีย
		const jobsPerShift = hours > 0 ? SHIFT_HOURS / hours : null            // ทำงานนี้ได้กี่ครั้ง/กะ (ทฤษฎี)
		return {
			qty,
			sheets,
			impressions,
			hours: +hours.toFixed(4),
			total: total != null ? +Number(total).toFixed(2) : null,
			costPerHour: costPerHour != null ? +costPerHour.toFixed(2) : null,
			print: +print.toFixed(2),
			printPerHour: printPerHour != null ? +printPerHour.toFixed(2) : null,
			margin: margin != null ? +margin.toFixed(2) : null,
			marginPerHour: marginPerHour != null ? +marginPerHour.toFixed(2) : null,
			makereadyPct: makereadyPct != null ? +makereadyPct.toFixed(1) : null,
			jobsPerShift: jobsPerShift != null ? +jobsPerShift.toFixed(1) : null,
		}
	})
	return { machine, units, colors: { outside, inside }, passes, speed: speedSheetsPerHour, shiftHours: SHIFT_HOURS, compCount, rows }
}

/**
 * แปลงเมตริกเป็น HTML ตาราง (ใช้ใน modal/หน้าจอ — ภายหลัง)
 */
function renderMachineHourMetric(metric) {
	if (!metric || !metric.rows.length) return '<div>ยังไม่มีข้อมูล (ต้องคำนวณ price ก่อน + ใส่ความเร็วเครื่อง)</div>'
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
			<td style="text-align:right;font-weight:bold;background:#dcfce7;color:${r.marginPerHour > 0 ? '#15803d' : '#6b7280'}">${fmt(r.marginPerHour, 2)}</td>
			<td style="text-align:right;font-weight:bold;background:#dbeafe">${fmt(r.printPerHour, 2)}</td>
		</tr>`).join('')
	const mkVals = metric.rows.map((r) => r.makereadyPct).filter((x) => x != null)
	const mkRange = mkVals.length ? (fmt(Math.min(...mkVals), 0) + '–' + fmt(Math.max(...mkVals), 0) + '%') : '-'
	const maxJobs = Math.max(0, ...metric.rows.map((r) => r.jobsPerShift || 0))
	return `
		<div style="font-size:13px">
			<div style="margin-bottom:6px">
				<b>เครื่อง:</b> ${metric.machine} &nbsp;•&nbsp;
				<b>ชุดพิมพ์:</b> ${metric.units} สี &nbsp;•&nbsp;
				<b>สีงาน:</b> ${metric.colors.outside}+${metric.colors.inside} &nbsp;•&nbsp;
				<b>รอบพิมพ์:</b> <span style="color:${metric.passes > 1 ? '#dc2626' : '#16a34a'};font-weight:bold">${metric.passes} รอบ</span>${metric.passes > 1 ? ' (สีเกินชุดพิมพ์ → เวลา×' + metric.passes + ')' : ''} &nbsp;•&nbsp;
				<b>ความเร็ว:</b> ${fmt(metric.speed, 0)} แผ่น/ชม.
				${metric.compCount > 1 ? `<span style="color:#dc2626">&nbsp;•&nbsp;⚠️ คิดเฉพาะ component 1 จาก ${metric.compCount}</span>` : ''}
			</div>
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
				💡 <b>ข้อสังเกต:</b> %เซตเครื่อง ${mkRange} = งานยอดน้อยเสียเวลากับ makeready เยอะ • กำลังผลิต ~${fmt(maxJobs, 0)} ครั้งงานนี้/กะ (8 ชม., ทฤษฎี ไม่รวมเวลาสลับงาน)<br>
				* เทียบดูเฉยๆ ไม่บวกเข้าราคาขาย • <b>กำไร = ราคาขาย − ต้นทุน</b> (ขยับตาม markup, =0 ถ้าไม่บวกกำไร) • เวลา = แผ่นพิมพ์ × รอบพิมพ์ ÷ ความเร็ว
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
		const MOCKUP_SPEED = 5000 // แผ่น/ชม. — ⚠️ MOCKUP รอข้อมูลจริงจากพี่

		function doInject() {
			const $summary = $('#summary')
			const metric = (typeof est !== 'undefined' && est && est.mainData) ? computeMachineHourMetric(est.mainData, MOCKUP_SPEED) : null
			if (!$summary.length || !metric || !metric.rows.length) return false
			$('#machine_hour_metric').remove()
			// (debug log removed) — inject ตารางต่อท้าย #summary
			$summary.after(`
				<div id="machine_hour_metric" style="max-width:900px;margin:14px auto;border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:12px 14px;font-family:inherit">
					<div style="font-weight:bold;font-size:15px;color:#b45309;margin-bottom:8px">⏱️ ราคาต่อชั่วโมงเครื่อง
						<span style="font-size:11px;color:#d97706;font-weight:normal">— ⚠️ ข้อมูล MOCKUP (ความเร็ว ${MOCKUP_SPEED.toLocaleString()} แผ่น/ชม. สมมติ รอข้อมูลจริงจากพี่)</span>
					</div>
					${renderMachineHourMetric(metric)}
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
	module.exports = { computeMachineHourMetric, renderMachineHourMetric }
}
