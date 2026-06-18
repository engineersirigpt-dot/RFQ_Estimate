// Demo เมตริกชั่วโมงเครื่อง — เลขจริงงาน Pillow + ทดสอบ margin/makeready/capacity/passes
// node bench/test_machine_hour.js [speed]
const { computeMachineHourMetric, computeProcessBreakdown, computeMachineComparison } = require('../public/js/function_machine_hour_metric')

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

const speed = Number(process.argv[2]) || 10000
const SETUP = 1 // เซตเครื่อง 1 ชม. (เหมือนแอปจริง)
const fmt = (n, d) => (n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))

;[
	['ปกติ 3 สี, markup 0%', makeData(3, 6, 0)],
	['markup 20% (เห็นกำไร)', makeData(3, 6, 20)],
	['สีเยอะ 8 สี (passes 2)', makeData(8, 6, 20)],
	['2 component (L440 + LS1029)', makeMulti()],
].forEach(([label, data]) => {
	const mt = computeMachineHourMetric(data, speed, { setupHours: SETUP })
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
// ความเร็วจริงจากตารางพี่ + setup 1 ชม.
const procSpeeds = { setupHours: 1, print: 10000, coating: 1500, diecut: 2500, stamp: 500, assembly: 10000, strip: 15000, chip: 15000 }
;[0, 4].forEach((i) => {
	const pb = computeProcessBreakdown(makeData(3, 6, 0), i, procSpeeds)
	console.log(`\n=== per-process ยอด ${fmt(pb.qty, 0)} ===`)
	pb.procs.forEach((p) => console.log('  ' + p.label.padEnd(16) + (fmt(p.qty, 0) + ' ' + p.unit).padEnd(12) + (fmt(p.hours * 60, 1) + ' น.').padStart(10) + ('ค่า ' + fmt(p.cost, 0)).padStart(12)))
	console.log('  🔴 คอขวด = ' + pb.bottleneck.label + ' (' + fmt(pb.bottleneck.hours * 60, 1) + ' น.) — ไม่ใช่เครื่องพิมพ์!')
})

// ── ทดสอบ "เสียบความเร็วจริงจาก master" — เครื่องมี machine_speed → ใช้ของจริง ไม่ใช้ fallback
console.log('\n===== master speed auto-pickup =====')
const dReal = makeData(3, 6, 0)
dReal.component1[0].machine.machine_speed = 10000 // พี่เสียบความเร็วจริงลง master
const mtReal = computeMachineHourMetric(dReal, 5000) // fallback 5000 (ควรถูกข้าม)
const rr = mtReal.rows[0]
const expHours = (360 * mtReal.components[0].passes) / 10000 // 360 แผ่น × passes ÷ 10000
const ok = mtReal.allRealSpeed === true && mtReal.components[0].speed === 10000 && Math.abs(rr.hours - +expHours.toFixed(4)) < 1e-6
console.log('  ความเร็วที่ใช้: ' + fmt(mtReal.components[0].speed, 0) + ' (master 10,000, fallback 5,000)')
console.log('  allRealSpeed=' + mtReal.allRealSpeed + ' • เวลา ' + fmt(rr.hours * 60, 2) + ' น. (คาด ' + fmt(expHours * 60, 2) + ')')
console.log('  ' + (ok ? '✅ PASS — ดึงความเร็วจริงจาก master ถูกต้อง' : '❌ FAIL'))
if (!ok) process.exitCode = 1

// ── ทดสอบ setup + machineByName (opts {speed,setup}) — เวลา = setup + แผ่น×passes÷ความเร็ว
console.log('\n===== setup + machineByName (per-machine) =====')
const dOpt = makeData(3, 6, 0) // L440, 360 แผ่น, passes 1
const mtOpt = computeMachineHourMetric(dOpt, 8000, { machineByName: { L440: { speed: 10000, setup: 0.5 } } })
const ro = mtOpt.rows[0]
const expRun = 360 / 10000          // ใช้ความเร็วตามชื่อเครื่อง L440=10000 (ไม่ใช่ fallback 8000)
const expWithSetup = 0.5 + expRun   // + setup ของเครื่องนั้น 0.5 ชม.
const okOpt = mtOpt.components[0].speed === 10000 && mtOpt.components[0].setup === 0.5 && Math.abs(ro.hours - +expWithSetup.toFixed(4)) < 1e-6
console.log('  ความเร็ว(by name)=' + fmt(mtOpt.components[0].speed, 0) + ' setup=' + mtOpt.components[0].setup + ' ชม.')
console.log('  เวลา ' + fmt(ro.hours, 4) + ' ชม. (คาด ' + fmt(expWithSetup, 4) + ' = 0.5 setup + ' + fmt(expRun, 4) + ' run)')
console.log('  ' + (okOpt ? '✅ PASS — setup + machineByName ถูกต้อง' : '❌ FAIL'))
if (!okOpt) process.exitCode = 1

// ── ทดสอบ machineById: เครื่องชื่อเพี้ยน (calc=L440) แต่ id 3407 → โชว์ชื่อจริง LS440 + ความเร็วถูก
console.log('\n===== machineById (ชื่อเพี้ยน L440→LS440 จับด้วย id) =====')
const dId = makeData(3, 6, 0)
dId.component1[0].machine = { machine_name: 'L440', machine_id: 3407, color: { max: 6 } } // calc เรียก L440
const mtId = computeMachineHourMetric(dId, 8000, { machineById: { 3407: { name: 'LS440', speed: 10000, setup: 1 } } })
const okId = mtId.machine === 'LS440' && mtId.components[0].speed === 10000 && mtId.components[0].isRealSpeed === true
console.log('  ชื่อแสดง: ' + mtId.machine + ' (calc ส่ง L440, ตาราง id 3407 = LS440) • ความเร็ว ' + fmt(mtId.components[0].speed, 0))
console.log('  ' + (okId ? '✅ PASS — จับด้วย id โชว์ชื่อจริง LS440 + ความเร็วถูก ไม่ fallback' : '❌ FAIL'))
if (!okId) process.exitCode = 1

// ── ทดสอบ per-process รับ {speed,setup} object form + flute (ปะลูกฟูก)
console.log('\n===== per-process {speed,setup} + flute =====')
const dFlute = makeData(3, 6, 0)
dFlute.component1[0].addon.push({ type: 'corrugated', line: sheetsPerTier.map(() => ({ price: 500 })) })
const procCfg = { print: { speed: 10000, setup: 1 }, coating: { speed: 1500, setup: 1 }, diecut: { speed: 2500, setup: 1 }, stamp: { speed: 500, setup: 0 }, assembly: { speed: 10000, setup: 1 }, strip: { speed: 15000, setup: 0.5 }, chip: { speed: 15000, setup: 0.5 }, flute: { speed: 2000, setup: 0.3 } }
const pbF = computeProcessBreakdown(dFlute, 0, procCfg)
const fluteRow = pbF.procs.find((p) => p.label === 'ปะลูกฟูก')
const printRow = pbF.procs.find((p) => p.label === 'พิมพ์')
const expFlute = 0.3 + 360 / 2000 // setup 0.3 + 360 แผ่น ÷ 2000
const okF = !!fluteRow && Math.abs(fluteRow.hours - +expFlute.toFixed(4)) < 1e-6 && !!printRow && Math.abs(printRow.hours - (1 + 360 / 10000)) < 1e-3
console.log('  ปะลูกฟูก: ' + (fluteRow ? fmt(fluteRow.hours * 60, 1) + ' น. (คาด ' + fmt(expFlute * 60, 1) + ')' : 'ไม่พบ!'))
console.log('  ' + (okF ? '✅ PASS — flute + object form ถูกต้อง' : '❌ FAIL'))
if (!okF) process.exitCode = 1

// ── ทดสอบ [Prototype] เทียบเครื่อง + fix: แยก strip/glue, เคลือบตามชนิด
console.log('\n===== [prototype] compare + แยก strip/glue + เคลือบตามชนิด =====')
const MT = [
	[3407, 'LS440', 'Sheet', 10000, 1.0], [3606, 'GL844', 'Sheet', 9000, 0.5],
	[5420, 'SANWA', 'Die-cut', 2500, 1.0], [5519, 'Yoco', 'Die-cut', 3000, 1.0], [5425, 'D 2 Manual', 'Die-cut', 400, 1.0],
	[5512, 'Glue-2', 'Glue', 10000, 1.0], [5510, 'Glue-1', 'Glue', 10000, 1.0], // gluers
	[5520, 'แกะอัตโนมัติ', 'Strip', 15000, 0.5],                                   // strip แยกกลุ่มแล้ว
	[5924, 'OPP wanchay', 'OPP', 1300, 1.0], [5931, 'OPP Yelee', 'OPP', 1300, 1.0], [5941, 'UV Steinemann', 'UV', 2500, 1.0], [5507, 'วอเตอร์เบส', 'Coating', 1500, 1.0],
].map(([code, name, cat, speed, setup]) => ({ code, name, cat, speed, setup }))
// งานเคลือบ OPP (addon type coating มีคำว่า OPP) — ส่ง coatingType:'OPP'
const dCmp = makeData(3, 6, 0)
dCmp.component1[0].addon = [{ type: 'coating', line: sheetsPerTier.map(() => ({ price: 1000 })) }]
const cmp = computeMachineComparison(dCmp, 0, MT, { defaultRatePerHour: 500, setupHours: 1, coatingType: 'OPP' })
const get = (k) => cmp.processes.find((p) => p.key === k)
const diecutCmp = get('diecut'), asmCmp = get('assembly'), stripCmp = get('strip'), coatCmp = get('coating')
// (1) ไดคัท ⚡ = Yoco 3000 (เร็วสุด ไม่ใช่ SANWA)
const okDiecut = !!diecutCmp && diecutCmp.candidates[0].name === 'Yoco'
// (2) ติดกาว = เฉพาะ gluers (ไม่มี 'แกะอัตโนมัติ')
const okAsm = !!asmCmp && asmCmp.candidates.every((c) => c.name !== 'แกะอัตโนมัติ') && asmCmp.candidates.some((c) => c.name === 'Glue-2')
// (3) แกะ = เฉพาะเครื่อง Strip
const okStrip = !stripCmp || stripCmp.candidates.every((c) => c.name === 'แกะอัตโนมัติ')
// (4) เคลือบ OPP = เฉพาะเครื่อง OPP (ไม่มี UV/วอเตอร์เบส)
const okCoat = !coatCmp || coatCmp.candidates.every((c) => c.name.startsWith('OPP'))
console.log('  ไดคัท ⚡: ' + (diecutCmp ? diecutCmp.candidates[0].name : '-') + ' (คาด Yoco)')
console.log('  ติดกาว มีแกะปนไหม: ' + (okAsm ? 'ไม่ปน ✓' : 'ปน ✗') + ' | แกะ: ' + (okStrip ? 'เฉพาะ strip ✓' : 'ปน ✗'))
console.log('  เคลือบ OPP เฉพาะ OPP: ' + (okCoat ? '✓' : '✗') + ' (' + (coatCmp ? coatCmp.candidates.map((c) => c.name).join(',') : '-') + ')')
const okCmp = okDiecut && okAsm && okStrip && okCoat
console.log('  ' + (okCmp ? '✅ PASS — fix ครบ (ไดคัทเร็วสุด/แยก strip-glue/เคลือบตามชนิด)' : '❌ FAIL'))
if (!okCmp) process.exitCode = 1
