// "ค่าเครื่องเปล่า/ชม." = ถอดค่าบล็อก/แม่พิมพ์/วัสดุออก เหลือแค่ค่าแรง+เครื่อง (time-based) ÷ ชั่วโมง
//   real data แยก field: ไดคัท {block, labor} • foil {labor_price, block_unit_price, roll_price, material_price}
//   → เอาเฉพาะ labor(เครื่อง+แรง) มาคิด/ชม. ; block(แม่พิมพ์ จ่ายครั้งเดียว) + roll/material(วัสดุ) = ถอดออก
// node bench/demo_machine_rate.js
const f = (n, d = 0) => (n == null ? '-' : Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
const SETUP = 1, paperPrint = 396, orderQty = 5000 // ยอด 5,000 (แผ่นพิมพ์ 396)

// แต่ละ process: cost แยกเป็น 3 ก้อน + ฐานหน่วย(แผ่น/ใบ) + ความเร็ว
//   machine = ค่าแรง+เครื่อง (คิด/ชม.ได้)  |  tooling = แม่พิมพ์/บล็อก (จ่ายครั้งเดียว)  |  material = วัสดุ (ต่อชิ้น)
const P = [
	// label,            qty,        speed, machine, tooling, material,  note
	['พิมพ์',            paperPrint, 6000,  2100,    0,       0,   'plate แยกแล้ว; หมึกยังปนใน 2,100 (ถอดต่อได้ถ้ามี field)'],
	['เคลือบ',           paperPrint, 1500,  700,     0,       607, 'แยกค่าวาร์นิช (material) ออก'],
	['ไดคัท',            paperPrint, 2500,  1000,    3000,    0,   'block 3,000 = แม่พิมพ์ (จ่ายครั้งเดียว) ถอดออก'],
	['ปั๊มฟอยล์',        paperPrint, 500,   800,     2000,    1500,'block 2,000 + foil ม้วน/วัสดุ 1,500 ถอดออก'],
	['ติดกาว/ประกอบ',    orderQty,   8000,  2294,    0,       0,   'ค่าแรงเครื่องล้วน (กาวน้อยมาก)'],
	['แกะ (strip-out)',  orderQty,   15000, 3750,    0,       0,   'ค่าแรงเครื่องล้วน'],
]

console.log(`\nงาน Pillow • ยอด ${f(orderQty)} • แผ่นพิมพ์ ${f(paperPrint)} • setup ${SETUP} ชม.\n`)
console.log('process'.padEnd(17) + 'ต้นทุนรวม'.padStart(10) + 'ถอดออก'.padStart(9) + 'ค่าเครื่อง+แรง'.padStart(14)
	+ 'ชม.'.padStart(7) + 'ราคา/ชม.รวม'.padStart(13) + 'ค่าเครื่องเปล่า/ชม.'.padStart(19))
console.log('─'.repeat(90))
P.forEach(([label, qty, speed, machine, tooling, material]) => {
	const total = machine + tooling + material
	const strip = tooling + material
	const hours = SETUP + qty / speed
	const rateAll = total / hours          // ราคา/ชม. รวมทุกอย่าง (เดิม)
	const rateBare = machine / hours       // ค่าเครื่องเปล่า/ชม. (ถอดแล้ว)
	console.log(
		label.padEnd(17) + f(total).padStart(10) + ('−' + f(strip)).padStart(9) + f(machine).padStart(14)
		+ f(hours, 2).padStart(7) + f(rateAll).padStart(13) + f(rateBare).padStart(19)
	)
})
console.log('\nหมายเหตุ:')
P.forEach(([label, , , , , , note]) => console.log('  • ' + label + ': ' + note))
console.log('\nสูตร: ค่าเครื่องเปล่า/ชม. = (ต้นทุนรวม − ค่าบล็อก − ค่าวัสดุ) ÷ ชั่วโมง = ค่าแรง+เครื่อง ÷ ชั่วโมง')
