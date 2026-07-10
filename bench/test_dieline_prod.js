// ยิง 5 ไดไลน์จริง ผ่าน endpoint production (/ai/parse-spec) → เทียบกับเฉลย + ออก Excel คำไทยธรรมดา
// ต้องมี server local รันที่ 3099 ก่อน (NODE_ENV=local node index.js)
// node bench/test_dieline_prod.js
const fs = require('fs')
const path = require('path')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')

const BASE = 'http://localhost:3099'
const COOKIE = 'accessToken=test.local; emp_id=Admin'
const SHAPE = { 1: 'แบบ 1 — ฝาเสียบสลับ', 2: 'แบบ 2 — ฝาเสียบตรง', 3: 'แบบ 3 — ก้นสน็อปล็อก', 4: 'แบบ 4 — ก้นล็อกอัตโนมัติ', 5: 'แบบ 5 — ถาด', 6: 'แบบ 6 — ถาดโชว์', 7: 'แบบ 7 — ถาดมีฝา', 8: 'แบบ 8 — มีหูหิ้ว', 9: 'แบบ 9 — ปลอกสวม', 10: 'แบบ 10 — ทรงหมอน', 11: 'แบบ 11 — ฝาทากาว', 12: 'กล่องพิเศษ (Custom)' }
const short = (t) => (t == null ? '(ว่าง)' : t === 12 ? 'กล่องพิเศษ' : 'แบบ ' + t)
const mimeOf = (f) => /\.png$/i.test(f) ? 'image/png' : /\.pdf$/i.test(f) ? 'application/pdf' : 'image/jpeg'

async function askProd(fp) {
	const buf = fs.readFileSync(fp)
	const fd = new FormData()
	fd.append('files', new Blob([buf], { type: mimeOf(fp) }), path.basename(fp))
	const res = await fetch(BASE + '/ai/parse-spec', { method: 'POST', headers: { Cookie: COOKIE }, body: fd })
	const j = await res.json().catch(() => ({}))
	const d = j && j.data ? j.data : {}
	const comp = (d.components && d.components[0]) || {}
	const unc = Array.isArray(d._uncertain) && d._uncertain.includes('box_template_id')
	return { box: comp.box_template_id, uncertain: unc, model: j.model }
}
async function thumb(fp) {
	const img = await Jimp.read(fs.readFileSync(fp)); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 420) img.resize(w >= h ? { w: 420 } : { h: 420 })
	return img.getBuffer('image/jpeg', { quality: 72 })
}

;(async () => {
	const ans = JSON.parse(fs.readFileSync('test/dieline_answers.json', 'utf8'))
	const rows = []
	console.log('ยิง 5 ไดไลน์ผ่าน production (/ai/parse-spec)...\n')
	console.log('สินค้า | เฉลย | Claude ทาย')
	for (const c of ans.cases) {
		const fp = path.join('test', c.file)
		if (!fs.existsSync(fp)) { console.log('  ไม่เจอไฟล์:', c.file); continue }
		let r; try { r = await askProd(fp) } catch (e) { console.log('  ERR', c.file, e.message); continue }
		const correct = Number(r.box) === c.expected_box_template_id
		rows.push({ ...c, aiBox: r.box, uncertain: r.uncertain, correct, model: r.model, thumb: await thumb(fp) })
		console.log('  ' + (c.product || c.file).slice(0, 30).padEnd(31) + ' | ' + short(c.expected_box_template_id).padEnd(12) + ' | ' + short(r.box) + (correct ? ' ✓' : ' ✗'))
	}
	const okN = rows.filter(r => r.correct).length
	console.log('\nสรุป: Claude ทายถูก ' + okN + '/' + rows.length + '  (โมเดล: ' + (rows[0] && rows[0].model || '?') + ')')

	// ===== Excel คำไทยธรรมดา =====
	const wb = new ExcelJS.Workbook()
	const ws = wb.addWorksheet('ผลทดสอบจับทรงกล่อง', { views: [{ state: 'frozen', ySplit: 2 }] })
	ws.columns = [{ width: 30 }, { width: 26 }, { width: 22 }, { width: 22 }, { width: 12 }, { width: 42 }]
	ws.mergeCells('A1:F1')
	const t = ws.getCell('A1')
	t.value = 'ผลทดสอบ: AI (Claude) ดูรูปไดไลน์แล้วทายว่าเป็นกล่องทรงไหน — ทดสอบกับกล่องจริง ' + rows.length + ' แบบ'
	t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }; t.alignment = { vertical: 'middle', indent: 1 }
	ws.getRow(1).height = 30
	const heads = ['รูปกล่อง (ไดไลน์)', 'สินค้า', 'ทรงที่ถูกต้อง (คนตรวจยืนยัน)', 'AI ทายว่าเป็น', 'AI ทายถูกไหม', 'ทำไมถึงเป็นทรงนี้']
	const hr = ws.getRow(2); heads.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	hr.height = 34
	for (const r of rows) {
		const aiText = SHAPE[r.aiBox] ? SHAPE[r.aiBox] + (r.uncertain ? ' (ไม่มั่นใจ ให้คนตรวจ)' : '') : short(r.aiBox)
		const row = ws.addRow(['', r.product || r.file, SHAPE[r.expected_box_template_id], aiText, r.correct ? 'ถูก ✓' : 'ผิด ✗', r.reason || ''])
		row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(5).font = { bold: true, color: { argb: r.correct ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' }); ws.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 200, height: 138 } })
	}
	const sr = ws.addRow(['', 'สรุป: AI ทายถูก ' + okN + ' จาก ' + rows.length + ' กล่อง', '', '', '', '']); ws.mergeCells('B' + sr.number + ':F' + sr.number)
	sr.getCell(2).font = { bold: true, size: 12 }; sr.getCell(2).alignment = { vertical: 'middle', indent: 1 }; sr.height = 24

	const g = wb.addWorksheet('อธิบายทรงกล่อง')
	g.columns = [{ header: 'รหัสทรง', width: 12 }, { header: 'ชื่อ (ภาษาคน)', width: 26 }, { header: 'ลักษณะ', width: 55 }]
	const desc = { 1: 'ฝาบน-ล่างเสียบคนละทาง (กล่องยา/เครื่องสำอางทั่วไป)', 2: 'ฝาบน-ล่างเสียบทางเดียวกัน', 3: 'ก้นแบบสน็อปล็อก พับล็อกเอง', 4: 'ก้นล็อกอัตโนมัติ กางแล้วก้นล็อกทันที', 5: 'ถาดเปิดด้านบน', 6: 'ถาดโชว์สินค้า', 7: 'ถาดมีฝาครอบ', 8: 'มีหูหิ้วสำหรับถือ', 9: 'ปลอกสวมรอบกล่อง เปิด 2 ด้าน', 10: 'ทรงหมอน โค้งมน', 11: 'ปิดปลายด้วยกาว', 12: 'กล่องพิเศษ — ไม่เข้าทรงมาตรฐาน (มีหน้าต่าง/ขอบโค้ง/หูหิ้ว/รูปทรงแปลก) ต้องออกแบบเฉพาะ' }
	const gh = g.getRow(1); gh.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { horizontal: 'center', vertical: 'middle' } }); gh.height = 22
	for (let i = 1; i <= 12; i++) g.addRow([short(i), (SHAPE[i].split(' — ')[1] || SHAPE[i]), desc[i]])

	const out = 'test/ผลทดสอบจับทรงกล่อง.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 รายงาน (คำไทยธรรมดา + Claude จริง): ' + out)
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
