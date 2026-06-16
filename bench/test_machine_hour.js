// Demo เมตริกชั่วโมงเครื่อง — เลขจริงงาน Pillow + ทดสอบ margin/makeready/capacity/passes
// node bench/test_machine_hour.js [speed]
const { computeMachineHourMetric, computeProcessBreakdown } = require('../public/js/function_machine_hour_metric')

const sheetsPerTier = [360, 369, 378, 387, 396]
const wastePerTier = [350, 350, 350, 350, 350]
const baseTotals = [16594, 16688.70, 16833.40, 17172.86, 17625.25] // = ต้นทุนรวม (markup 0)

// outside=สีงาน, units=ชุดพิมพ์เครื่อง, markupPct=กำไรที่บวก (ทดสอบ margin)
function makeData(outside, units, markupPct) {
	const m = 1 + (markupPct || 0) / 100
	return {
		qty: { totalqty: [1000, 2000, 3000, 4000, 5000] },
		component1: [{
			machine: { machine_name: 'L440', color: { max: units } },
			color: [{ outside, inside: 0 }],
			paper_usage: { line: sheetsPerTier.map((s) => ({ paper_print: s })) },
			waste: { waste: wastePerTier },
			addon: [{ type: 'coating', line: [1188, 1217.7, 1247.4, 1277.1, 1306.8].map((p) => ({ price: p })) }],
			process: [
				{ name: 'diecut', line: sheetsPerTier.map(() => ({ block: { price: 3000 }, labor: { price: 1000 } })) },
				{ name: 'assembly', line: [1500, 1500, 1800, 2030.76, 2294.1].map((p) => ({ price: p })) },
			],
		}],
		totalprice: baseTotals.map((cost) => ({
			material: 2636, plate: 2400, print: 2100, afterpress: cost - 2636 - 2400 - 2100 - 1820, delivery: 1820,
			total_with_price_diff: +(cost * m).toFixed(2), // ราคาขาย = ต้นทุน × (1+markup)
		})),
		process: [ // top-level: แกะ (เครื่อง) + inspection (แมนนวล → ถูกตัด)
			{ name: 'chip', line: [1000, 2000, 3000, 4000, 5000].map((q) => ({ qty: q, price: q * 0.75 })) },
			{ name: 'inspection', line: [1000, 2000, 3000, 4000, 5000].map((q) => ({ qty: q, price: q * 0.05 })) },
		],
	}
}

// งาน 2 component (กล่อง L440 + ไส้ใน LS1029 คนละเครื่อง) — ทดสอบรวมเวลาทุกเครื่อง
function makeMulti() {
	const d = makeData(3, 6, 20)
	d.component1.push({
		machine: { machine_name: 'LS1029', color: { max: 8 } },
		color: [{ outside: 4, inside: 0 }],
		paper_usage: { line: sheetsPerTier.map((s) => ({ paper_print: Math.round(s * 0.5) })) }, // ไส้ใน ups ต่างกัน
		waste: { waste: wastePerTier.map((w) => Math.round(w * 0.5)) },
	})
	return d
}

const speed = Number(process.argv[2]) || 5000
const fmt = (n, d) => (n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))

;[
	['ปกติ 3 สี, markup 0%', makeData(3, 6, 0)],
	['markup 20% (เห็นกำไร)', makeData(3, 6, 20)],
	['สีเยอะ 8 สี (passes 2)', makeData(8, 6, 20)],
	['2 component (L440 + LS1029)', makeMulti()],
].forEach(([label, data]) => {
	const mt = computeMachineHourMetric(data, speed)
	console.log(`\n===== ${label} =====`)
	console.log(`เครื่อง: ${mt.machine} • ${mt.compCount} comp • ${fmt(speed, 0)} แผ่น/ชม.`)
	if (mt.compCount > 1) mt.components.forEach((c, i) => console.log(`   Comp${i + 1}: ${c.machine} ชุด ${c.units}/สี ${c.outside}+${c.inside}/รอบ ${c.passes}`))
	console.log('ยอด'.padEnd(7) + 'แผ่น'.padStart(7) + '%เซต'.padStart(7) + 'นาที'.padStart(7) + 'ราคา/ชม.'.padStart(12) + 'กำไร/ชม.'.padStart(12) + 'พิมพ์/ชม.'.padStart(11) + 'งาน/กะ'.padStart(8))
	mt.rows.forEach((r) => console.log(
		fmt(r.qty, 0).padEnd(7) + fmt(r.sheets, 0).padStart(7) + (fmt(r.makereadyPct, 0) + '%').padStart(7) +
		fmt(r.hours * 60, 1).padStart(7) + fmt(r.costPerHour, 0).padStart(12) + fmt(r.marginPerHour, 0).padStart(12) +
		fmt(r.printPerHour, 0).padStart(11) + fmt(r.jobsPerShift, 0).padStart(8)
	))
	if (mt.compCount > 1) {
		const r0 = mt.rows[0]
		console.log('   → ยอด 1,000: รวมเวลา ' + fmt(r0.hours * 60, 1) + ' นาที = ' + r0.byComponent.map((b) => b.machine + ' ' + fmt(b.hours * 60, 1) + 'น.').join(' + '))
	}
})
console.log('\n* markup 0 → กำไร/ชม.=0 • 2 component → เวลารวมทุกเครื่อง (ราคา/กำไร ระดับงาน ÷ เวลารวม)')

// per-process: แยกเวลาต่อ process (แต่ละ process คนละเครื่อง) + หาคอขวด
const procSpeeds = { print: 5000, coating: 6000, diecut: 4000, stamp: 3000, assembly: 3000 }
;[0, 4].forEach((i) => {
	const pb = computeProcessBreakdown(makeData(3, 6, 0), i, procSpeeds)
	console.log(`\n=== per-process ยอด ${fmt(pb.qty, 0)} ===`)
	pb.procs.forEach((p) => console.log('  ' + p.label.padEnd(16) + (fmt(p.qty, 0) + ' ' + p.unit).padEnd(12) + (fmt(p.hours * 60, 1) + ' น.').padStart(10) + ('ค่า ' + fmt(p.cost, 0)).padStart(12)))
	console.log('  🔴 คอขวด = ' + pb.bottleneck.label + ' (' + fmt(pb.bottleneck.hours * 60, 1) + ' น.) — ไม่ใช่เครื่องพิมพ์!')
})
