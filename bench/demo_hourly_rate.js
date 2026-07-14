// หา "ราคา/ชั่วโมง" จากงานจริง — derive จากต้นทุนที่ calc คิดไว้แล้ว ÷ ชั่วโมง (ไม่ต้องรอข้อมูลใหม่)
//   speed พิมพ์ = 6,000 (จริง) • process อื่นจากตารางเครื่อง • setup 1 ชม.
// node bench/demo_hourly_rate.js
const { computeMachineHourMetric, computeProcessBreakdown } = require('../public/js/function_machine_hour_metric')

const sheetsPerTier = [360, 369, 378, 387, 396], wastePerTier = [350, 350, 350, 350, 350]
const baseCost = [16594, 16688.70, 16833.40, 17172.86, 17625.25]
const MARKUP = 20, SPEED = 6000

function makeData() {
	return {
		qty: { totalqty: [1000, 2000, 3000, 4000, 5000] },
		component1: [{
			machine: { machine_name: 'L440', color: { max: 6 } },
			color: [{ outside: 3, inside: 0 }],
			paper_usage: { line: sheetsPerTier.map((s) => ({ paper_print: s })) },
			waste: { waste: wastePerTier },
			addon: [{ type: 'coating', line: [1188, 1217.7, 1247.4, 1277.1, 1306.8].map((p) => ({ price: p })) }],
			process: [
				{ name: 'diecut', line: sheetsPerTier.map(() => ({ block: { price: 3000 }, labor: { price: 1000 } })) },
				{ name: 'assembly', line: [1500, 1500, 1800, 2030.76, 2294.1].map((p) => ({ price: p })) },
			],
		}],
		totalprice: baseCost.map((cost) => ({
			material: 2636, plate: 2400, print: 2100,
			afterpress: cost - 2636 - 2400 - 2100 - 1820, delivery: 1820,
			total_with_price_diff: +(cost * (1 + MARKUP / 100)).toFixed(2),
		})),
		process: [{ name: 'chip', line: [1000, 2000, 3000, 4000, 5000].map((q) => ({ qty: q, price: q * 0.75 })) }],
	}
}
const procSpeeds = { setupHours: 1, print: SPEED, coating: 1500, diecut: 2500, stamp: 500, assembly: 8000, strip: 15000, chip: 15000 }
const f = (n, d = 0) => (n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))

const mt = computeMachineHourMetric(makeData(), SPEED, { setupHours: 1 })
console.log(`\nงาน Pillow • เครื่องพิมพ์ ${f(SPEED)} แผ่น/ชม. • markup ${MARKUP}%`)

console.log('\n━━━ (1) ราคา/ชม. "ต่อเครื่องพิมพ์" (จาก metric) ━━━')
console.log('ยอด'.padEnd(7) + 'ราคาขาย/ชม.'.padStart(13) + 'กำไร/ชม.'.padStart(12) + 'ค่าพิมพ์/ชม.'.padStart(13))
mt.rows.forEach((r) => console.log(f(r.qty).padEnd(7) + f(r.costPerHour).padStart(13) + f(r.marginPerHour).padStart(12) + f(r.printPerHour).padStart(13)))

console.log('\n━━━ (2) ราคา/ชม. "ต่อชั่วโมงคอขวด" (TOC — ตัวจริงที่ใช้ตัดสิน) ━━━')
console.log('ยอด'.padEnd(7) + 'คอขวด'.padEnd(16) + 'ราคาขาย/ชม.คอขวด'.padStart(18) + 'กำไร/ชม.คอขวด'.padStart(16))
;[0, 2, 4].forEach((i) => {
	const pb = computeProcessBreakdown(makeData(), i, procSpeeds)
	console.log(f(pb.qty).padEnd(7) + pb.bottleneck.label.padEnd(16) + f(pb.revenuePerBnHour).padStart(18) + f(pb.profitPerBnHour).padStart(16))
})

console.log('\n━━━ (3) ราคา(ต้นทุน)/ชม. แยกราย process — derive จาก cost÷ชม. (แทน mockup 500) ━━━')
const pb = computeProcessBreakdown(makeData(), 4, procSpeeds) // ยอด 5,000
console.log('process'.padEnd(18) + 'ต้นทุน'.padStart(9) + 'ชั่วโมง'.padStart(9) + 'บาท/ชม.(implied)'.padStart(18))
pb.procs.forEach((p) => {
	const bn = p.label === pb.bottleneck.label ? '  🔴 คอขวด' : ''
	console.log(p.label.padEnd(18) + f(p.cost).padStart(9) + f(p.hours, 2).padStart(9) + f(p.costPerHour).padStart(18) + bn)
})
console.log('\nสรุป: ราคา/ชม. หาได้จากงานจริงเลย = (ราคา/ต้นทุน ที่ calc คิดไว้) ÷ ชั่วโมง — ไม่ต้องรอเลขค่าเครื่องจากใคร')
