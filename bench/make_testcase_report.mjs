// รายงาน Excel "เทสไดไลน์จริง" แบบคนทั่วไปอ่านรู้เรื่อง — คำไทยธรรมดา ไม่มีศัพท์เทคนิค
// อ่าน test/dieline_answers.json (เฉลยที่ยืนยันแล้ว) + ให้ AI(CLIP, ฟรี) ทาย → เทียบ
// node bench/make_testcase_report.mjs
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@xenova/transformers'
import { Jimp } from 'jimp'
import ExcelJS from 'exceljs'
import fs from 'fs'
import path from 'path'
env.allowLocalModels = false
const MODEL = 'Xenova/clip-vit-base-patch32'
const K = 7

// ชื่อทรงแบบคนทั่วไปเข้าใจ
const SHAPE = {
	1: 'แบบ 1 — ฝาเสียบสลับ', 2: 'แบบ 2 — ฝาเสียบตรง', 3: 'แบบ 3 — ก้นสน็อปล็อก', 4: 'แบบ 4 — ก้นล็อกอัตโนมัติ',
	5: 'แบบ 5 — ถาด', 6: 'แบบ 6 — ถาดโชว์', 7: 'แบบ 7 — ถาดมีฝา', 8: 'แบบ 8 — มีหูหิ้ว',
	9: 'แบบ 9 — ปลอกสวม', 10: 'แบบ 10 — ทรงหมอน', 11: 'แบบ 11 — ฝาทากาว', 12: 'กล่องพิเศษ (Custom)'
}
const short = (t) => (t === 12 ? 'กล่องพิเศษ' : 'แบบ ' + t)

async function loadPng(fp) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 640) img.resize(w >= h ? { w: 640 } : { h: 640 })
	return img.getBuffer('image/png')
}
async function thumb(fp) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 420) img.resize(w >= h ? { w: 420 } : { h: 420 })
	return img.getBuffer('image/jpeg', { quality: 72 })
}

;(async () => {
	// training embeddings (จากที่ embed ไว้แล้ว — ฟรี)
	const train = []
	if (fs.existsSync('answer_key/clip_emb.jsonl')) {
		// ต้องมี label ทรงของแต่ละไฟล์ → อ่านจาก answer_map
		const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, tByFile = {}
		for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (m) tByFile[m[1].trim()] = Number(m[2]) }
		for (const l of fs.readFileSync('answer_key/clip_emb.jsonl', 'utf8').split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); if (tByFile[o.f] >= 1 && tByFile[o.f] <= 12) train.push({ t: tByFile[o.f], v: o.v }) } catch (e) {} }
	}
	console.log('ตัวอย่างอ้างอิง (จากเฉลยจริง):', train.length, 'กล่อง')

	console.log('โหลด AI (CLIP)...')
	const processor = await AutoProcessor.from_pretrained(MODEL)
	const vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL)

	function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
	async function predict(fp) {
		const raw = await RawImage.fromBlob(new Blob([await loadPng(fp)]))
		const { image_embeds } = await vision(await processor(raw))
		let v = Array.from(image_embeds.data); const n = Math.hypot(...v); v = v.map(x => x / n)
		const sims = train.map(tr => ({ t: tr.t, s: dot(v, tr.v) })).sort((a, b) => b.s - a.s).slice(0, K)
		const vote = {}; let tot = 0; for (const x of sims) { vote[x.t] = (vote[x.t] || 0) + x.s; tot += x.s }
		const best = Number(Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0])
		const pCustom = Math.round(100 * (vote[12] || 0) / (tot || 1))
		return { best, pCustom }
	}

	const ans = JSON.parse(fs.readFileSync('test/dieline_answers.json', 'utf8'))
	const rows = []
	for (const c of ans.cases) {
		const fp = path.join('test', c.file)
		if (!fs.existsSync(fp)) { console.log('ไม่เจอไฟล์:', c.file); continue }
		const p = await predict(fp)
		const correct = p.best === c.expected_box_template_id
		rows.push({ ...c, aiBest: p.best, pCustom: p.pCustom, correct, thumb: await thumb(fp) })
		console.log('  ' + (c.product || c.file).slice(0, 30).padEnd(31) + ' | ถูก=' + short(c.expected_box_template_id) + ' | AI=' + short(p.best) + (correct ? ' ✓' : ' ✗'))
	}

	// ===== Excel (คำไทยธรรมดา) =====
	const wb = new ExcelJS.Workbook()
	const ws = wb.addWorksheet('ผลทดสอบจับทรงกล่อง', { views: [{ state: 'frozen', ySplit: 2 }] })
	ws.columns = [
		{ width: 30 }, { width: 26 }, { width: 22 }, { width: 22 }, { width: 14 }, { width: 10 }, { width: 40 },
	]
	// หัวเรื่องใหญ่
	ws.mergeCells('A1:G1')
	const title = ws.getCell('A1')
	title.value = 'ผลทดสอบ: AI ดูรูปไดไลน์แล้วทายว่าเป็นกล่องทรงไหน (ทดสอบกับกล่องจริง ' + rows.length + ' แบบ)'
	title.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
	title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }
	title.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
	ws.getRow(1).height = 30
	// หัวตาราง
	const heads = ['รูปกล่อง (ไดไลน์)', 'สินค้า', 'ทรงที่ถูกต้อง (คนตรวจยืนยัน)', 'AI ทายว่าเป็น', 'AI ทายถูกไหม', 'AI คิดว่าเป็นกล่องพิเศษ', 'ทำไมถึงเป็นทรงนี้']
	const hr = ws.getRow(2); heads.forEach((h, i) => { const c = hr.getCell(i + 1); c.value = h; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	hr.height = 34

	for (const r of rows) {
		const row = ws.addRow(['', r.product || r.file, SHAPE[r.expected_box_template_id], SHAPE[r.aiBest], r.correct ? 'ถูก ✓' : 'ผิด ✗', r.pCustom + '%', r.reason || ''])
		row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(5).font = { bold: true, color: { argb: r.correct ? 'FF1B8A3A' : 'FFC0392B' } }
		row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' })
		ws.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 200, height: 138 } })
	}
	// แถวสรุปท้าย
	const okN = rows.filter(r => r.correct).length
	const sumRow = ws.addRow(['', 'สรุป: AI ทายถูก ' + okN + ' จาก ' + rows.length + ' กล่อง', '', '', '', '', ''])
	ws.mergeCells('B' + sumRow.number + ':G' + sumRow.number)
	sumRow.getCell(2).font = { bold: true, size: 12 }
	sumRow.getCell(2).alignment = { vertical: 'middle', indent: 1 }
	sumRow.height = 24

	// คำอธิบายศัพท์ (ชีตที่ 2) — เผื่อคนอ่านไม่รู้จักทรง
	const g = wb.addWorksheet('อธิบายทรงกล่อง')
	g.columns = [{ header: 'รหัสทรง', width: 12 }, { header: 'ชื่อ (ภาษาคน)', width: 26 }, { header: 'ลักษณะ', width: 55 }]
	const desc = {
		1: 'ฝาบน-ล่างเสียบคนละทาง (กล่องกล่องยา/เครื่องสำอางทั่วไป)', 2: 'ฝาบน-ล่างเสียบทางเดียวกัน',
		3: 'ก้นแบบสน็อปล็อก พับล็อกเอง', 4: 'ก้นล็อกอัตโนมัติ กางแล้วก้นล็อกทันที',
		5: 'ถาดเปิดด้านบน', 6: 'ถาดโชว์สินค้า', 7: 'ถาดมีฝาครอบ', 8: 'มีหูหิ้วสำหรับถือ',
		9: 'ปลอกสวมรอบกล่อง เปิด 2 ด้าน', 10: 'ทรงหมอน โค้งมน', 11: 'ปิดปลายด้วยกาว',
		12: 'กล่องพิเศษ — ไม่เข้าทรงมาตรฐาน (มีหน้าต่าง / ขอบโค้ง / หูหิ้ว / รูปทรงแปลก ฯลฯ) ต้องออกแบบเฉพาะ'
	}
	const gh = g.getRow(1); gh.eachCell(c => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A3A5C' } }; c.alignment = { horizontal: 'center', vertical: 'middle' } }); gh.height = 22
	for (let t = 1; t <= 12; t++) g.addRow([short(t), SHAPE[t].split(' — ')[1] || SHAPE[t], desc[t]])

	const out = 'test/ผลทดสอบจับทรงกล่อง.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 รายงาน (คำไทยธรรมดา): ' + out)
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
