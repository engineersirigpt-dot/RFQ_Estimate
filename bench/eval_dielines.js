// เทสความแม่น AI จับทรงกล่อง — เฉพาะ "อาร์ตเวิร์คลงไดไลน์จริง" + ฝังรูปลง Excel
//   1) คัด candidate จาก answer_key (ไม่ทับ few-shot) → ตัด quote/แชท/LAY จากชื่อไฟล์
//   2) Haiku สแกน: ใช่ไดไลน์กล่องแผ่นเดียวไหม (artwork/blank) — ตัดรูปถ่าย/ใบราคา/เพลตรวมทิ้ง
//   3) Opus จับทรง: เทียบใช้เฉลย (few-shot) vs ไม่ใช้ + prompt caching (ประหยัดเครดิต)
//   4) ออก Excel ฝังรูปไดไลน์แต่ละแถว (ExcelJS)
// node bench/eval_dielines.js [perTemplate=5] [scanCapPerTemplate=14]
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs'), path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })

const PER = Number(process.argv[2] || 5)          // เก็บไดไลน์จริงต่อทรง
const SCAN = Number(process.argv[3] || 14)         // สแกน Haiku ต่อทรงไม่เกิน (คุมค่าใช้จ่าย)
const LOCAL = 'test/uploads'
const HAIKU = 'claude-haiku-4-5', OPUS = 'claude-opus-4-8'
const TN = { 1: 'Reverse Tuck End (ฝาเสียบสลับ)', 2: 'Straight Tuck End (ฝาเสียบตรง)', 3: 'Tuck Top Snap Lock Bottom', 4: 'Tuck Top Auto Bottom (ก้นทากาว)', 5: 'Tray (ถาด)', 6: 'Frame-Vue Tray', 7: 'Bento Tray+Lid', 8: 'Gable Top (มีหูหิ้ว)', 9: 'Sleeve (ปลอก เปิด2ด้าน)', 10: 'Pillow Box', 11: 'Seal End (ฝาทากาว)', 12: 'Custom (ไม่เข้าทรง 1-11)' }
const JUNK = /ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|(^|[ _])lay[ _]/i

// ---------- โหลดรูป (pdf→หน้าแรก) → Jimp ----------
async function loadJimp(fp) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	return Jimp.read(buf)
}
const resized = (img, max) => { const w = img.bitmap.width, h = img.bitmap.height; const c = img.clone(); if (Math.max(w, h) > max) c.resize(w >= h ? { w: max } : { h: max }); return c }
const toB64 = async (img, max, q = 80) => (await resized(img, max).getBuffer('image/jpeg', { quality: q })).toString('base64')
const toBuf = async (img, max, q = 74) => resized(img, max).getBuffer('image/jpeg', { quality: q })

// ---------- ชื่องานจริง ----------
function loadJobNames() {
	const map = {}, re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i
	for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (m) map[m[1].trim()] = { job: (m[3] || '').trim(), name: (m[4] || '').trim() } }
	return map
}

// ---------- candidate: จาก answer_map ข้าม 25 ใบแรก (กันทับ few-shot) ----------
function candidates() {
	const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, byT = {}
	for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) {
		const m = l.match(re); if (!m) continue
		const file = m[1].trim(), t = Number(m[2]); if (!(t >= 1 && t <= 12)) continue
		;(byT[t] = byT[t] || []).push(file)
	}
	const pool = {}
	for (const t of Object.keys(byT)) {
		pool[t] = byT[t].slice(25).filter(f => !JUNK.test(f) && fs.existsSync(path.join(LOCAL, f)))
	}
	return pool
}

// ---------- Haiku คัด: ไดไลน์กล่องแผ่นเดียวไหม ----------
const HAIKU_SYS = 'You inspect ONE image and decide if it is a single unfolded packaging-box DIE-LINE (the flat keyline layout of one box, with fold/cut lines — WITH or WITHOUT printed artwork on it). Reply ONLY compact JSON {"type":"artwork"|"blank"|"photo"|"quote"|"multiup"|"other"} where: artwork=one box dieline WITH printed graphics, blank=one box dieline lines only, photo=photograph of a real product/box, quote=price sheet/document/spec table, multiup=imposition sheet with many boxes tiled (LAY), other=none of these.'
async function haikuType(b64) {
	try {
		const msg = await ai.createWithRetry(client, { model: HAIKU, max_tokens: 60, system: HAIKU_SYS, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: 'type?' }] }] })
		const txt = msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')
		return ai.extractJson(txt).type
	} catch (e) { return 'error' }
}

;(async () => {
	console.log('เตรียม template refs + few-shot...')
	const refBlocks = [{ type: 'text', text: 'The 12 reference templates:' }]
	for (let i = 1; i <= 12; i++) { const p = 'public/img/' + i + '.jpg'; if (!fs.existsSync(p)) continue; refBlocks.push({ type: 'text', text: 'Template #' + i + ' = ' + TN[i] }); refBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp(p), 1400) } }) }
	const fewBlocks = [{ type: 'text', text: 'VERIFIED EXAMPLES (real dielines a human labelled with the correct template):' }]
	let fewN = 0
	for (let t = 1; t <= 12; t++) { const d = 'router/labeled_dielines/' + t; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d).filter(x => /\.jpg$/i.test(x))) { fewBlocks.push({ type: 'text', text: '→ correct = Template #' + t }); fewBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(path.join(d, f)).toString('base64') } }); fewN++ } }
	// จุด cache: ปลาย refs (สำหรับ OFF) + ปลาย few-shot (สำหรับ ON) — เฉลย 76 ใบไม่ต้องส่งซ้ำ
	refBlocks[refBlocks.length - 1].cache_control = { type: 'ephemeral' }
	fewBlocks[fewBlocks.length - 1].cache_control = { type: 'ephemeral' }
	console.log('few-shot:', fewN, 'ใบ | เป้า', PER, '/ทรง | สแกน Haiku ≤', SCAN, '/ทรง')

	const SYS = 'You classify a packaging-box DIELINE (may have printed artwork on it) into ONE of 12 templates by CONSTRUCTION (tuck/auto-bottom/tray/sleeve/seal/custom). 12=Custom (not matching 1-11). Reply ONLY compact JSON {"box": <1-12>}.'
	async function classify(heldB64, useFew) {
		const content = useFew ? [...refBlocks, ...fewBlocks] : [...refBlocks]
		content.push({ type: 'text', text: 'Now classify THIS dieline (reply {"box":N}):' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: heldB64 } })
		const msg = await ai.createWithRetry(client, { model: OPUS, max_tokens: 300, system: SYS, messages: [{ role: 'user', content }] })
		const u = msg.usage || {}; cacheRead += (u.cache_read_input_tokens || 0)
		const txt = msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')
		try { return ai.extractJson(txt).box } catch (e) { return null }
	}

	const jobNames = loadJobNames(), pool = candidates()
	const results = []
	let cacheRead = 0, offOK = 0, onOK = 0, n = 0, scanned = 0
	const perT = {}
	console.log('\nไฟล์ | ชนิด(Haiku) | จริง | OFF | ON')
	for (let t = 1; t <= 12; t++) {
		const list = pool[t] || []; let got = 0, tried = 0
		for (const file of list) {
			if (got >= PER || tried >= SCAN) break
			tried++; scanned++
			let img; try { img = await loadJimp(path.join(LOCAL, file)) } catch (e) { continue }
			const type = await haikuType(await toB64(img, 1000, 78))
			if (type !== 'artwork' && type !== 'blank') { console.log('  – ข้าม [' + type + '] ' + file.slice(0, 40)); continue }
			const hb = await toB64(img, 1400)
			let off, on
			try { off = await classify(hb, false) } catch (e) { off = null }
			try { on = await classify(hb, true) } catch (e) { on = null }
			const offHit = Number(off) === t, onHit = Number(on) === t
			n++; got++; if (offHit) offOK++; if (onHit) onOK++
			perT[t] = perT[t] || { n: 0, off: 0, on: 0 }; perT[t].n++; if (offHit) perT[t].off++; if (onHit) perT[t].on++
			const jn = jobNames[file] || {}
			results.push({ file, job: jn.job || '', name: jn.name || '', type, t, tname: TN[t], off, offHit, on, onHit, onName: TN[Number(on)] || '', thumb: await toBuf(img, 420) })
			console.log('  ' + file.slice(0, 30).padEnd(31) + ' | ' + type.padEnd(7) + ' | ' + t + ' | ' + off + (offHit ? '✓' : '✗') + ' | ' + on + (onHit ? '✓' : '✗'))
		}
	}
	const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-'
	console.log('\n==== ผล (' + n + ' ใบ, สแกน ' + scanned + ') ====')
	console.log('ไม่ใช้เฉลย OFF: ' + offOK + '/' + n + ' = ' + pct(offOK, n))
	console.log('ใช้เฉลย   ON : ' + onOK + '/' + n + ' = ' + pct(onOK, n) + '  ' + (onOK > offOK ? '📈' : onOK < offOK ? '📉' : '≈'))
	console.log('cache อ่านซ้ำ: ' + (cacheRead / 1000 | 0) + 'k tokens (ประหยัดจากไม่ส่งเฉลยซ้ำ)')

	// ================= Excel (ExcelJS, ฝังรูป) =================
	const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
	const wb = new ExcelJS.Workbook()
	const hdr = (ws, argb = 'FF0D2440') => { const r = ws.getRow(1); r.height = 22; r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } }) }

	// สรุป
	const s = wb.addWorksheet('สรุป')
	s.columns = [{ width: 34 }, { width: 16 }, { width: 12 }, { width: 12 }]
	s.addRows([
		['รายงานผลทดสอบ AI จับทรงกล่อง (เฉพาะอาร์ตเวิร์คลงไดไลน์จริง)'],
		['วันที่ทดสอบ', stamp], [],
		['จำนวนไดไลน์ที่ทดสอบ', n], ['ตัวอย่างเฉลยที่ใช้สอน (few-shot)', fewN + ' ใบ'], ['สแกนคัดกรอง (Haiku)', scanned + ' ใบ'], [],
		['ความแม่นยำ', 'ตอบถูก', 'จากทั้งหมด', 'คิดเป็น'],
		['แบบไม่ใช้เฉลย (AI เดาเอง)', offOK, n, pct(offOK, n)],
		['แบบใช้เฉลยสอน (few-shot)', onOK, n, pct(onOK, n)],
		['เปลี่ยนแปลง', (onOK - offOK >= 0 ? '+' : '') + (onOK - offOK) + ' ใบ', '', onOK > offOK ? 'ดีขึ้น' : onOK < offOK ? 'แย่ลง' : 'เท่าเดิม'],
	])
	s.getRow(1).font = { bold: true, size: 13 }; s.getRow(8).font = { bold: true }

	// รายทรง
	const p = wb.addWorksheet('รายทรง')
	p.columns = [{ header: 'ทรง', width: 6 }, { header: 'ชื่อทรง', width: 32 }, { header: 'ทดสอบ', width: 9 }, { header: 'ถูก(ไม่ใช้เฉลย)', width: 15 }, { header: '%ไม่ใช้', width: 9 }, { header: 'ถูก(ใช้เฉลย)', width: 13 }, { header: '%ใช้เฉลย', width: 10 }]
	for (let t = 1; t <= 12; t++) { const q = perT[t]; if (!q) continue; p.addRow([t, TN[t], q.n, q.off, pct(q.off, q.n), q.on, pct(q.on, q.n)]) }
	hdr(p)

	// รายไฟล์ + รูป (ชีตหลัก)
	const d = wb.addWorksheet('รายไฟล์+รูป', { views: [{ state: 'frozen', ySplit: 1 }] })
	d.columns = [
		{ header: 'รูปไดไลน์', width: 31 }, { header: 'ไฟล์', width: 34 }, { header: 'ชื่องาน', width: 24 },
		{ header: 'ชนิด', width: 9 }, { header: 'ทรงจริง', width: 8 }, { header: 'ชื่อทรงจริง', width: 26 },
		{ header: 'AI ไม่ใช้เฉลย', width: 12 }, { header: 'ถูก?', width: 6 }, { header: 'AI ใช้เฉลย', width: 11 }, { header: 'ถูก?', width: 6 },
	]
	for (const r of results) {
		const row = d.addRow([null, r.file, r.name, r.type === 'artwork' ? 'อาร์ตเวิร์ค' : 'ไดไลน์เปล่า', r.t, r.tname, r.off, r.offHit ? '✓' : '✗', r.on, r.onHit ? '✓' : '✗'])
		row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(8).font = { bold: true, color: { argb: r.offHit ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(10).font = { bold: true, color: { argb: r.onHit ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' })
		d.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 143 } })
	}
	hdr(d)

	// ตอบผิด (ใช้เฉลย)
	const w = wb.addWorksheet('ตอบผิด(ใช้เฉลย)')
	w.columns = [{ header: 'รูป', width: 31 }, { header: 'ไฟล์', width: 34 }, { header: 'ชื่องาน', width: 24 }, { header: 'ทรงจริง', width: 8 }, { header: 'ชื่อทรงจริง', width: 26 }, { header: 'AI ตอบ(ผิด)', width: 11 }, { header: 'AI เข้าใจว่าเป็น', width: 26 }]
	for (const r of results) if (!r.onHit) { const row = w.addRow([null, r.file, r.name, r.t, r.tname, r.on, r.onName]); row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }; const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' }); w.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 143 } }) }
	hdr(w, 'FFC0392B')

	const out = 'answer_key/ผลเทส-ไดไลน์จริง.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 รายงาน Excel (ฝังรูป): ' + out + '  (4 ชีต)')
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
