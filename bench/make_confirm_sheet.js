// Excel ให้ expert ยืนยัน GPT blind labels เร็วๆ: รูป + GPT เดา (เติมแล้ว) + ช่องแก้เฉพาะที่ผิด
// node bench/make_confirm_sheet.js
const fs = require('fs'), path = require('path')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')

const TSV = 'bench/label_queue/expert_shortlist.tsv'
const OUT = 'bench/label_queue/expert-confirm-nn_gold.xlsx'
const rows = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'))
const H = rows[0], data = rows.slice(1); const ci = n => H.indexOf(n)

async function thumb(file) {
	const fp = path.join('test/uploads', file); let buf
	if (/\.pdf$/i.test(file)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 440) img.resize(w >= h ? { w: 440 } : { h: 440 })
	return img.getBuffer('image/jpeg', { quality: 72 })
}

;(async () => {
	const wb = new ExcelJS.Workbook()
	const ws = wb.addWorksheet('confirm nn_gold', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] })
	ws.columns = [{ width: 30 }, { width: 12 }, { width: 15 }, { width: 22 }, { width: 40 },
		{ width: 15 }, { width: 15 }, { width: 16 }, { width: 30 }]
	ws.mergeCells('A1:I1')
	const t = ws.getCell('A1')
	t.value = 'expert ยืนยัน GPT blind labels — เช็คช่องเหลืองเฉพาะที่ GPT ผิด (' + data.length + ' ใบ shortlist)'
	t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }
	t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 26
	ws.mergeCells('A2:I2')
	const g = ws.getCell('A2')
	g.value = 'วิธีใช้: ดูรูป + คอลัมน์ "GPT เดา" → ถ้าถูก เว้นว่าง · ถ้าผิด เลือก expert_is_custom / expert_base_status ให้ถูก (ปล่อยว่าง = เห็นด้วยกับ GPT)'
	g.font = { size: 9, italic: true }; g.alignment = { vertical: 'middle', wrapText: true, indent: 1 }; g.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCF3CF' } }
	ws.getRow(2).height = 28
	const heads = ['รูป', 'proxy เดิม', 'GPT custom?', 'GPT base', 'GPT เหตุผล',
		'expert_is_custom ▼', 'expert_base_status ▼', 'expert_base_construction', 'expert_note']
	const hr = ws.getRow(3); heads.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	hr.height = 28

	let ok = 0
	for (const r of data) {
		const isFN = r[ci('is_false_negative')] === 'Y'
		const gptCustom = r[ci('gpt_is_custom')] + (r[ci('gpt_custom_reasons')] ? ' (' + r[ci('gpt_custom_reasons')] + ')' : '')
		const gptBase = r[ci('gpt_base_status')] + (r[ci('gpt_base_construction')] ? '=' + r[ci('gpt_base_construction')] : '') + (r[ci('gpt_base_candidates')] ? ' [' + r[ci('gpt_base_candidates')] + ']' : '')
		const row = ws.addRow(['', r[ci('proxy_name')] + ' (' + r[ci('proxy')] + ')', gptCustom, gptBase, r[ci('gpt_evidence')], '', '', '', ''])
		row.height = 116; row.alignment = { vertical: 'middle', wrapText: true }
		if (isFN) row.getCell(3).font = { bold: true, color: { argb: 'FFC0392B' } }  // FN = แดง
		for (const c of [6, 7, 8, 9]) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9E7' } }
		row.getCell(6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"yes,no,unknown"'] }
		row.getCell(7).dataValidation = { type: 'list', allowBlank: true, formulae: ['"standard,nonstandard,ambiguous,unobservable"'] }
		try { const id = wb.addImage({ buffer: await thumb(r[ci('file')]), extension: 'jpeg' }); ws.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 145 } }); ok++ }
		catch (e) { row.getCell(1).value = '(รูปไม่ได้)' }
		if (row.number % 20 === 0) process.stdout.write('\r  ' + ok)
	}
	await wb.xlsx.writeFile(OUT)
	console.log('\n📊 ' + OUT + '  (' + ok + '/' + data.length + ' รูป) — expert เปิดเช็คช่องเหลือง')
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
