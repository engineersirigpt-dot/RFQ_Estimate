// Demo: กำไร "ต่อยอดสั่ง" vs "ต่อชั่วโมง" ข้ามหลายยอด + พิสูจน์คูณกลับได้ก้อนเดิม
//   ใช้ compute จริงจาก metric ที่ speed 6,000 (ความเร็วจริงที่ยืนยันแล้ว)
// node bench/demo_qty_vs_hour.js
const { computeMachineHourMetric } = require('../public/js/function_machine_hour_metric')

// ── งานจริง (Pillow) — ต้นทุนรวมต่อยอด + แผ่นพิมพ์ต่อยอด (waste สูง = งานยอดน้อย) ──
const sheetsPerTier = [360, 369, 378, 387, 396]
const wastePerTier  = [350, 350, 350, 350, 350]
const baseCost      = [16594, 16688.70, 16833.40, 17172.86, 17625.25] // ต้นทุนรวม (ยังไม่บวกกำไร)
const MARKUP = 20 // % กำไรที่บวก
const SPEED = 6000, SETUP = 1

const data = {
	qty: { totalqty: [1000, 2000, 3000, 4000, 5000] },
	component1: [{
		machine: { machine_name: 'L440', color: { max: 6 } },
		color: [{ outside: 3, inside: 0 }],
		paper_usage: { line: sheetsPerTier.map((s) => ({ paper_print: s })) },
		waste: { waste: wastePerTier },
	}],
	totalprice: baseCost.map((cost) => ({
		material: 2636, plate: 2400, print: 2100,
		afterpress: cost - 2636 - 2400 - 2100 - 1820, delivery: 1820,
		total_with_price_diff: +(cost * (1 + MARKUP / 100)).toFixed(2), // ราคาขาย = ต้นทุน×1.2
	})),
}

const mt = computeMachineHourMetric(data, SPEED, { setupHours: SETUP })
const f = (n, d = 2) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

console.log(`\nงาน: ${mt.machine} • เครื่องพิมพ์ ${f(SPEED,0)} แผ่น/ชม. • setup ${SETUP} ชม. • markup ${MARKUP}%\n`)
console.log('ยอดสั่ง | แผ่นพิมพ์ |  ชั่วโมง | กำไร/ยอด(บาท) | กำไร/ชม.(บาท) | เช็คย้อนกลับ: กำไร/ชม.×ชม.')
console.log('─'.repeat(92))
mt.rows.forEach((r) => {
	const back = r.marginPerHour * r.hours // ← คูณกลับ
	const ok = Math.abs(back - r.margin) < 0.5 ? '✓ ตรง' : '✗'
	console.log(
		`${f(r.qty,0).padStart(6)} | ${f(r.sheets,0).padStart(7)} | ${f(r.hours,3).padStart(7)} |`
		+ ` ${f(r.margin).padStart(11)} | ${f(r.marginPerHour).padStart(11)} |  ${f(back).padStart(10)}  ${ok}`
	)
})

// ── โชว์ว่ายอดโตเป็นเท่าไหร่ แต่ชั่วโมงโตไม่ตาม (เพราะ setup คงที่) ──
const r0 = mt.rows[0], rN = mt.rows[mt.rows.length - 1]
console.log('\nยอด×' + f(rN.qty / r0.qty, 2) + '  แต่ชั่วโมง×' + f(rN.hours / r0.hours, 2)
	+ '  → ไม่แปรผันตรง (setup คงที่กลืนงานยอดน้อย, makeready ' + f(r0.makereadyPct,0) + '%→' + f(rN.makereadyPct,0) + '%)')
console.log('→ จัดอันดับ "ต่อยอด" กับ "ต่อชั่วโมง" จึงไม่เหมือนกัน\n')
