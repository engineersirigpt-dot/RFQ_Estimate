// Excel report: 9 clean gold — รูป + EXPERT gold เทียบ engineer(proxy)/Claude/CV (คำไทยธรรมดา)
// node bench/make_gold_report.js
const fs = require('fs'), path = require('path')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')

const SHAPE = { 1: 'แบบ 1 ฝาเสียบสลับ', 2: 'แบบ 2 ฝาเสียบตรง', 3: 'แบบ 3 ก้นสน็อปล็อก', 4: 'แบบ 4 ก้นล็อกอัตโนมัติ', 5: 'แบบ 5 ถาด', 6: 'แบบ 6 ถาดโชว์', 7: 'แบบ 7 ถาดมีฝา', 8: 'แบบ 8 มีหูหิ้ว', 9: 'แบบ 9 ปลอกสวม', 10: 'แบบ 10 ทรงหมอน', 11: 'แบบ 11 ฝาทากาว', 12: 'กล่องพิเศษ (Custom)' }
const sh = t => SHAPE[t] || String(t)

// file -> (proxy, claude, cv)
const gc = {}
for (const l of fs.readFileSync('answer_key/gold_candidates.tsv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) {
	const r = l.split('\t'); gc[r[1]] = { proxy: +r[3], claude: +r[4], cv: +r[5] }
}
// file -> (gold, reason)
const gold = []
for (const l of fs.readFileSync('answer_key/gold_final.tsv', 'utf8').split(/\r?\n/).slice(1).filter(Boolean)) {
	const r = l.split('\t'); gold.push({ file: r[0], gold: +r[1], src: r[2], reason: r[3] })
}

async function thumb(file) {
	const fp = path.join('test/uploads', file); let buf
	if (/\.pdf$/i.test(file)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 440) img.resize(w >= h ? { w: 440 } : { h: 440 })
	return img.getBuffer('image/jpeg', { quality: 74 })
}

;(async () => {
	const wb = new ExcelJS.Workbook()
	const ws = wb.addWorksheet('เฉลยทรงกล่อง (gold)', { views: [{ state: 'frozen', ySplit: 2 }] })
	ws.columns = [{ width: 30 }, { width: 30 }, { width: 22 }, { width: 20 }, { width: 18 }, { width: 18 }, { width: 12 }, { width: 34 }]
	ws.mergeCells('A1:H1')
	const t = ws.getCell('A1')
	t.value = 'ผลทดสอบ: เฉลยทรงกล่องที่ยืนยันแล้ว (gold) เทียบ engineer เดิม vs AI — 9 ไดไลน์จริง'
	t.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }; t.alignment = { vertical: 'middle', indent: 1 }
	ws.getRow(1).height = 30
	const heads = ['รูปไดไลน์', 'ไฟล์', 'ทรงที่ถูก (ยืนยันแล้ว)', 'engineer เดิม', 'AI (Claude)', 'AI (CV)', 'engineerผิด?', 'หมายเหตุ']
	const hr = ws.getRow(2); heads.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	hr.height = 30

	let pp = 0, cc = 0, cv = 0
	for (const g of gold) {
		const m = gc[g.file] || {}
		const pOk = m.proxy === g.gold, clOk = m.claude === g.gold, cvOk = m.cv === g.gold
		pp += pOk; cc += clOk; cv += cvOk
		const wrong = !pOk
		const row = ws.addRow(['', g.file, sh(g.gold), sh(m.proxy) + (pOk ? ' ✓' : ' ✗'), sh(m.claude) + (clOk ? ' ✓' : ' ✗'), sh(m.cv) + (cvOk ? ' ✓' : ' ✗'), wrong ? '🚨 ผิด' : 'ถูก', g.reason])
		row.height = 108; row.alignment = { vertical: 'middle', wrapText: true }
		if (wrong) row.getCell(4).font = { bold: true, color: { argb: 'FFC0392B' } }
		row.getCell(7).font = { bold: true, color: { argb: wrong ? 'FFC0392B' : 'FF1B8A3A' } }; row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }
		try { const id = wb.addImage({ buffer: await thumb(g.file), extension: 'jpeg' }); ws.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 200, height: 138 } }) } catch (e) { row.getCell(1).value = '(รูปไม่ได้)' }
	}
	const n = gold.length
	const sr = ws.addRow(['', 'สรุปความแม่นเทียบเฉลยจริง (gold):', '', `${pp}/${n} = ${Math.round(100 * pp / n)}%`, `${cc}/${n} = ${Math.round(100 * cc / n)}%`, `${cv}/${n} = ${Math.round(100 * cv / n)}%`, '', 'engineer ดีสุด แต่ยังผิด 33% (under-label Custom)'])
	sr.getCell(2).font = { bold: true }; sr.height = 22
	;[4, 5, 6].forEach(i => sr.getCell(i).font = { bold: true })

	// ชีต 2: อธิบายทรง
	const g2 = wb.addWorksheet('อธิบายทรง')
	g2.columns = [{ header: 'ทรง', width: 22 }, { header: 'ลักษณะ', width: 55 }]
	const gh = g2.getRow(1); gh.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } } })
	const d = { 1: 'ฝาบน-ล่างเสียบคนละทาง', 2: 'ฝาบน-ล่างเสียบทางเดียวกัน', 9: 'ปลอกสวม เปิด 2 ด้าน', 12: 'ไม่เข้าทรงมาตรฐาน (หน้าต่าง/ก้นแปลก/ไม่มีหูหิ้ว ฯลฯ)' }
	for (const k of [1, 2, 9, 12]) g2.addRow([SHAPE[k], d[k]])

	const out = 'test/ผลทดสอบ-gold-เฉลยทรงกล่อง.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('📊 ' + out + '  | engineer ' + Math.round(100 * pp / n) + '% Claude ' + Math.round(100 * cc / n) + '% CV ' + Math.round(100 * cv / n) + '%')
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
