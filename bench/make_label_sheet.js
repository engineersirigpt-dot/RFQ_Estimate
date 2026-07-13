// Excel labeling sheet: FN-mining candidates + รูป + dropdown (two-layer schema ตาม GPT)
// expert เปิดแล้วเติม is_custom / base_status ผ่าน dropdown ได้เลย  |  node bench/make_label_sheet.js
const fs = require('fs'), path = require('path')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')

const TSV = 'bench/label_queue/fn_candidates.tsv'
const OUT = 'bench/label_queue/labeling-sheet-custom-FN.xlsx'
const rows = fs.readFileSync(TSV, 'utf8').split(/\r?\n/).filter(Boolean).map(l => l.split('\t'))
const H = rows[0], data = rows.slice(1)
const ci = n => H.indexOf(n)

const BUCKET = {
	nn_gold: ['FFD98880', 'ใกล้ gold custom — น่าจะ FN สูง'],
	model_custom: ['FFF5CBA7', 'AI เห็น custom แต่ proxy=std'],
	proxy12: ['FFA9CCE3', 'proxy=custom (เช็คนิยาม)'],
	random_std: ['FFD5DBDB', 'สุ่ม std (วัด miss-rate)'],
}

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
	const ws = wb.addWorksheet('label custom FN', { views: [{ state: 'frozen', ySplit: 3, xSplit: 1 }] })
	ws.columns = [{ width: 30 }, { width: 30 }, { width: 15 }, { width: 12 }, { width: 40 },
		{ width: 14 }, { width: 24 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 34 }, { width: 14 }]
	// title
	ws.mergeCells('A1:L1')
	const t = ws.getCell('A1')
	t.value = 'ตีเฉลย Custom false-negative — expert เติมช่องเหลือง (dropdown) | ' + data.length + ' ใบ (unique family)'
	t.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }
	t.alignment = { vertical: 'middle', indent: 1 }; ws.getRow(1).height = 26
	// instructions
	ws.mergeCells('A2:L2')
	const g = ws.getCell('A2')
	g.value = 'is_custom: yes=มีฟีเจอร์พิเศษ(หน้าต่าง/ขอบโค้ง/หูหิ้ว/RSC/>4panel) · no=เข้าทรง1-11 · unknown=ดูไม่ออก   ||   base_status: standard→ใส่ base_construction 1-11 · nonstandard→โครงไม่เข้า1-11 · ambiguous→คาบ(ใส่ base_candidates เช่น 4,8) · unobservable→รูปไม่พอ'
	g.font = { size: 9, italic: true }; g.alignment = { vertical: 'middle', wrapText: true, indent: 1 }; g.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCF3CF' } }
	ws.getRow(2).height = 40
	// header
	const heads = ['รูป', 'ไฟล์', 'bucket', 'proxy', 'ทำไมถูกเลือก',
		'is_custom ▼', 'custom_reasons', 'base_status ▼', 'base_construction', 'base_candidates', 'evidence', 'reviewed_by']
	const hr = ws.getRow(3); heads.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	hr.height = 28

	let ok = 0
	for (const r of data) {
		const bucket = r[ci('bucket')], bmeta = BUCKET[bucket] || ['FFFFFFFF', '']
		const row = ws.addRow(['', r[ci('file')], bucket, r[ci('proxy_name')] + ' (' + r[ci('proxy')] + ')', r[ci('why_selected')],
			'', '', '', '', '', '', ''])
		row.height = 116; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bmeta[0] } }
		row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
		// editable cells = เหลือง
		for (const c of [6, 7, 8, 9, 10, 11, 12]) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9E7' } }
		// dropdowns
		row.getCell(6).dataValidation = { type: 'list', allowBlank: true, formulae: ['"yes,no,unknown"'] }
		row.getCell(8).dataValidation = { type: 'list', allowBlank: true, formulae: ['"standard,nonstandard,ambiguous,unobservable"'] }
		try {
			const id = wb.addImage({ buffer: await thumb(r[ci('file')]), extension: 'jpeg' })
			ws.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 145 } })
			ok++
		} catch (e) { row.getCell(1).value = '(รูปไม่ได้: ' + e.message.slice(0, 20) + ')' }
		if (row.number % 40 === 0) process.stdout.write('\r  rendered ' + ok)
	}

	// legend sheet
	const lg = wb.addWorksheet('อธิบาย bucket')
	lg.columns = [{ header: 'bucket', width: 16 }, { header: 'ความหมาย', width: 50 }]
	lg.getRow(1).eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } } })
	for (const [k, v] of Object.entries(BUCKET)) { const rr = lg.addRow([k, v[1]]); rr.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: v[0] } } }

	await wb.xlsx.writeFile(OUT)
	console.log('\n📊 ' + OUT + '  (' + ok + '/' + data.length + ' รูป) — ส่งให้ expert เติม dropdown')
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
