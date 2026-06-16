// AI regression harness — DETERMINISTIC unit tests (no API, instant, free).
// รันก่อน commit ทุกครั้ง: ดักบั๊กที่เคยแก้ (mm ×10, paper_gram, prefix, stripMoneyPct)
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

// stripHallucinations เป็น async — รอให้ครบก่อนสรุป
let asyncDone = 0
const ASYNC_TOTAL = 4
function maybeDone() {
	if (++asyncDone < ASYNC_TOTAL) return
	console.log('\n=== สรุป ===')
	console.log(`  ${pass} pass / ${fail} fail`)
	process.exit(fail > 0 ? 1 : 0)
}
