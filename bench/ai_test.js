// AI regression harness — DETERMINISTIC unit tests (no API, instant, free).
// รันก่อน commit ทุกครั้ง: ดักบั๊กที่เคยแก้ (mm ×10, paper_gram, prefix, stripMoneyPct, print-type safety net)
// ใช้: node bench/ai_test.js   (exit 1 ถ้ามี fail)
// เทสที่ยิง API จริง (accuracy) แยกไฟล์: golden_grader.js / test_print_types.js / test_explain_price.js
process.env.AI_TEST = '1' // เปิด guarded test-exports ใน router/ai.js
const ai = require('../router/ai')

let pass = 0, fail = 0
function check(name, cond, got) {
	if (cond) { pass++; console.log('  ✅ ' + name) }
	else { fail++; console.log('  ❌ ' + name + (got !== undefined ? '  → got: ' + JSON.stringify(got) : '')) }
}
const sortDim = (d) => [d.width, d.length, d.height].sort((a, b) => a - b)
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b)

console.log('\n=== 1. stated_size parse (mm/cm/prefix) — บั๊ก ×10 ===')
;[
	['50x85x150mm', [50, 85, 150]],
	['180x280x260mm', [180, 260, 280]],
	['8x2.5x15 cm', [25, 80, 150]],
	['W80×L120×H40 mm', [40, 80, 120]],
	['W30 x L95 x H178 mm', [30, 95, 178]],
	['20.20x6.60x3.90 CM', [39, 66, 202]],
	['W8×L2.5×H15 cm', [25, 80, 150]],
].forEach(([s, exp]) => {
	const out = ai.validateAndFix({ components: [{ stated_size: s, dimensions_mm: { width: 1, length: 1, height: 1 } }] })
	const got = sortDim(out.components[0].dimensions_mm)
	check('"' + s + '" → ' + JSON.stringify(exp), eq(got, exp.slice().sort((a, b) => a - b)), got)
})

console.log('\n=== 2. paper_gram strip (เก็บ legit / ตัด hallucinate) ===')
;[
	['A/C C1s 300 ขนาด 50x85x150mm', 300, true],   // gram ติดเกรด ไม่มีคำว่าแกรม → เก็บ
	['กระดาษกล่องแป้ง 270 แกรม', 270, true],        // มีคำว่าแกรม → เก็บ
	['art card 350 gsm', 350, true],                // gsm → เก็บ
	['พิมพ์ 4 สี ส่งกรุงเทพ', 250, false],          // ไม่มีกระดาษ+เลขไม่อยู่ในข้อความ → ตัด
].forEach(([txt, gram, keep]) => {
	return ai.stripHallucinations({ components: [{ paper_type: 'X', paper_gram: gram }] }, txt, []).then((out) => {
		const g = out.components[0].paper_gram
		check('"' + txt.slice(0, 28) + '..." gram=' + gram + ' (' + (keep ? 'เก็บ' : 'ตัด') + ')', keep ? g === gram : g == null, g)
		maybeDone()
	})
})

console.log('\n=== 3. stripMoneyPct (เก็บ spec / ตัด เงิน-%) ===')
;[
	['แกรม 350 และ 4 สี', 'แกรม 350 และ 4 สี'],            // spec → เก็บทั้งหมด
	['ขนาด 80 x 120 x 40', 'ขนาด 80 x 120 x 40'],          // size → เก็บ
	['คิดเป็น 57% ของราคา', /57%/],                          // % → ต้องหาย
	['ต้นทุน 12,000 บาท', /12,000\s*บาท/],                   // money → ต้องหาย
	['ราคาต่อใบ 4.2 บาท/ใบ', /บาท\/ใบ/],                     // money/ใบ → ต้องหาย
].forEach(([s, exp]) => {
	const out = ai.stripMoneyPct(s)
	const ok = exp instanceof RegExp ? !exp.test(out) : out === exp
	check('"' + s + '" → "' + out + '"', ok, out)
})

console.log('\n=== 4. print-type rules (validateAndFix safety net) ===')
// validateAndFix บังคับเฉพาะ safety ขั้นต่ำ — GSM range/ความเข้ากันได้อื่น เป็นหน้าที่ฟอร์ม validate
;[
	// Flexo = ลูกฟูกเท่านั้น → type ต้องถูกบังคับเป็น 3 แม้ AI อ่านมาเป็น 1
	['Flexo type=1 → บังคับ 3', { print_type: 'Flexo', components: [{ type: 1 }] }, (o) => o.components[0].type === 3],
	['Flexo type=3 คงเดิม', { print_type: 'Flexo', components: [{ type: 3 }] }, (o) => o.components[0].type === 3],
	// Konica = ดิจิทัล max 4 สี/ด้าน → clamp ทั้งสองด้าน
	['Konica 7/6 สี → clamp 4/4', { print_type: 'Konica', components: [{ color_outside: 7, color_inside: 6 }] }, (o) => o.components[0].color_outside === 4 && o.components[0].color_inside === 4],
	['Konica 4/0 สี คงเดิม', { print_type: 'Konica', components: [{ color_outside: 4, color_inside: 0 }] }, (o) => o.components[0].color_outside === 4 && o.components[0].color_inside === 0],
	// Offset ไม่ clamp สีตรงนี้ (ฟอร์ม validate ดูแลกฎสี/UV เอง)
	['Offset 6 สี ไม่ถูก clamp', { print_type: 'Offset', components: [{ color_outside: 6, color_inside: 0 }] }, (o) => o.components[0].color_outside === 6],
	// print_type ที่ไม่รู้จัก → default Offset (ไม่ปล่อยค่าเพี้ยนไปคำนวณ)
	['print_type มั่ว → Offset', { print_type: 'Xerox', components: [{ type: 1 }] }, (o) => o.print_type === 'Offset'],
	['print_type ว่าง → Offset', { components: [{ type: 1 }] }, (o) => o.print_type === 'Offset'],
].forEach(([name, input, pred]) => {
	const out = ai.validateAndFix(input)
	check(name, pred(out), { print: out.print_type, c0: out.components[0] })
})

console.log('\n=== 5. DPxxxg → กล่องแป้งหลังเทา (Duplex GBB) ===')
// กฎธุรกิจ: "DP"+แกรม+"g" = หลังเทา ; "DP"+เลข (ไม่มี g) = รหัสแบบ ไม่ใช่กระดาษ
;[
	['DP350g → Duplex GBB 350', 'DP350g + UV + 6 Colors', { components: [{}], _uncertain: ['paper_type', 'paper_gram'] },
		(o) => o.components[0].paper_type === 'Duplex GBB' && o.components[0].paper_gram === 350],
	['DP350g เคลียร์ธง uncertain paper', 'DP350g', { components: [{}], _uncertain: ['paper_type', 'paper_gram', 'box_template_id'] },
		(o) => !(o._uncertain || []).includes('paper_type') && !(o._uncertain || []).includes('paper_gram') && (o._uncertain || []).includes('box_template_id')],
	['DP350 (ไม่มี g) → ไม่แตะกระดาษ (รหัสแบบ)', 'งานแบบ DP350 พิมพ์ 4 สี', { components: [{}] },
		(o) => o.components[0].paper_type == null && o.components[0].paper_gram == null],
	['DP 250 g (เว้นวรรค) → Duplex GBB 250', 'กระดาษ DP 250 g', { components: [{}] },
		(o) => o.components[0].paper_type === 'Duplex GBB' && o.components[0].paper_gram === 250],
	['ไม่ override กระดาษที่ AI อ่านมาแล้ว', 'DP350g', { components: [{ paper_type: 'A/C', paper_gram: 300 }] },
		(o) => o.components[0].paper_type === 'A/C' && o.components[0].paper_gram === 300],
].forEach(([name, txt, input, pred]) => {
	const out = ai.inferDuplexFromDP(input, txt)
	check(name, pred(out), { c0: out.components[0], unc: out._uncertain })
})

console.log('\n=== 6. W/L swap: ข้อความเคารพลำดับ / ไดไลน์สลับ length≥width ===')
// ลูกค้าพิมพ์ W×L (110×75) = เคารพลำดับ ไม่สลับ ; ไดไลน์/รูป (width>length) = สลับ
;[
	['ข้อความ 110×75 → คงลำดับ (ไม่สลับ)', { components: [{ dimensions_mm: { width: 110, length: 75, height: 155 } }] }, undefined,
		(o) => o.components[0].dimensions_mm.width === 110 && o.components[0].dimensions_mm.length === 75],
	['รูป (hasImageInput) 80×25 → สลับเป็น 25×80', { components: [{ dimensions_mm: { width: 80, length: 25, height: 150 } }] }, true,
		(o) => o.components[0].dimensions_mm.width === 25 && o.components[0].dimensions_mm.length === 80],
	['ไดไลน์ (dieline_panels) 80×25 → สลับ', { components: [{ dimensions_mm: { width: 80, length: 25 }, dieline_panels: [80, 25, 80, 25] }] }, undefined,
		(o) => o.components[0].dimensions_mm.width === 25 && o.components[0].dimensions_mm.length === 80],
].forEach(([name, input, hasImg, pred]) => {
	const out = ai.validateAndFix(input, hasImg)
	check(name, pred(out), out.components[0].dimensions_mm)
})

// stripHallucinations เป็น async — รอให้ครบก่อนสรุป
let asyncDone = 0
const ASYNC_TOTAL = 4
function maybeDone() {
	if (++asyncDone < ASYNC_TOTAL) return
	console.log('\n=== สรุป ===')
	console.log(`  ${pass} pass / ${fail} fail`)
	process.exit(fail > 0 ? 1 : 0)
}
