// เทสไบนารี "มาตรฐาน(1-11) vs Custom(12)" — โฟกัสให้ AI จับ Custom ให้ได้ (recall)
//   baseline = วิธีเดิม (refs + few-shot, จับ 12 ทรง แล้วยุบเป็น custom/มาตรฐาน)
//   ใหม่     = Custom-detector prompt: สั่งมองหา "ฟีเจอร์พิเศษ" ก่อน (หน้าต่าง/ขอบโค้ง/หูหิ้ว/RSC/ฝาครอบ)
//   ชุดทดสอบสมดุล: custom N ใบ + มาตรฐาน N ใบ (Haiku คัดว่าเป็นไดไลน์จริง, ไม่ทับ few-shot)
//   ออก Excel ฝังรูป + เหตุผลฟีเจอร์ที่ AI เห็น
// node bench/eval_custom.js [perSide=15]
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs'), path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })

const PERSIDE = Number(process.argv[2] || 15)
const LOCAL = 'test/uploads'
const HAIKU = 'claude-haiku-4-5', OPUS = 'claude-opus-4-8'
const TN = { 1: 'Reverse Tuck End', 2: 'Straight Tuck End', 3: 'Snap Lock Bottom', 4: 'Auto Bottom', 5: 'Tray', 6: 'Frame-Vue', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'Seal End', 12: 'Custom' }
const JUNK = /ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|(^|[ _])lay[ _]/i
const STD_TEMPLATES = [1, 2, 3, 4, 9, 11] // ทรงมาตรฐานที่มีตัวอย่างจริงพอ

async function loadJimp(fp) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	return Jimp.read(buf)
}
const resized = (img, max) => { const w = img.bitmap.width, h = img.bitmap.height; const c = img.clone(); if (Math.max(w, h) > max) c.resize(w >= h ? { w: max } : { h: max }); return c }
const toB64 = async (img, max, q = 80) => (await resized(img, max).getBuffer('image/jpeg', { quality: q })).toString('base64')
const toBuf = async (img, max, q = 74) => resized(img, max).getBuffer('image/jpeg', { quality: q })

function loadJobNames() {
	const map = {}, re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i
	for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (m) map[m[1].trim()] = { job: (m[3] || '').trim(), name: (m[4] || '').trim() } }
	return map
}
function candidatesByT() {
	const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, byT = {}
	for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (!m) continue; const f = m[1].trim(), t = Number(m[2]); if (!(t >= 1 && t <= 12)) continue; (byT[t] = byT[t] || []).push(f) }
	for (const t of Object.keys(byT)) byT[t] = byT[t].slice(25).filter(f => !JUNK.test(f) && fs.existsSync(path.join(LOCAL, f)))
	return byT
}

const HAIKU_SYS = 'You inspect ONE image and decide if it is a single unfolded packaging-box DIE-LINE (flat keyline of one box, WITH or WITHOUT printed artwork). Reply ONLY compact JSON {"type":"artwork"|"blank"|"photo"|"quote"|"multiup"|"other"}.'
async function haikuType(b64) {
	try { const msg = await ai.createWithRetry(client, { model: HAIKU, max_tokens: 60, system: HAIKU_SYS, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: 'type?' }] }] }); return ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')).type } catch (e) { return 'error' }
}

// เลือกไดไลน์จริง n ใบจาก list (Haiku คัด)
async function pickReal(list, n, cache) {
	const out = []
	for (const f of list) {
		if (out.length >= n) break
		let img; try { img = await loadJimp(path.join(LOCAL, f)) } catch (e) { continue }
		const type = await haikuType(await toB64(img, 1000, 78))
		if (type !== 'artwork' && type !== 'blank') continue
		cache[f] = img; out.push({ file: f, type })
	}
	return out
}

;(async () => {
	console.log('เตรียม template refs + few-shot...')
	const refBlocks = [{ type: 'text', text: 'The 12 reference stock templates (1-11 standard, 12=Custom):' }]
	for (let i = 1; i <= 12; i++) { const p = 'public/img/' + i + '.jpg'; if (!fs.existsSync(p)) continue; refBlocks.push({ type: 'text', text: 'Template #' + i + ' = ' + TN[i] }); refBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp(p), 1400) } }) }
	const fewBlocks = [{ type: 'text', text: 'VERIFIED EXAMPLES (real dielines a human labelled):' }]
	let fewN = 0
	for (let t = 1; t <= 12; t++) { const d = 'router/labeled_dielines/' + t; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d).filter(x => /\.jpg$/i.test(x))) { fewBlocks.push({ type: 'text', text: '→ correct = Template #' + t }); fewBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(path.join(d, f)).toString('base64') } }); fewN++ } }
	refBlocks[refBlocks.length - 1].cache_control = { type: 'ephemeral' }
	fewBlocks[fewBlocks.length - 1].cache_control = { type: 'ephemeral' }

	// ---- เลือกชุดทดสอบสมดุล ----
	const byT = candidatesByT(), imgCache = {}
	console.log('คัดไดไลน์จริง (Haiku)... custom', PERSIDE, '+ มาตรฐาน', PERSIDE)
	const customPick = await pickReal(byT[12] || [], PERSIDE, imgCache)
	const stdPick = []
	const perStd = Math.ceil(PERSIDE / STD_TEMPLATES.length)
	for (const t of STD_TEMPLATES) { const got = await pickReal(byT[t] || [], perStd, imgCache); got.forEach(g => g.trueT = t); stdPick.push(...got); if (stdPick.length >= PERSIDE) break }
	customPick.forEach(c => c.trueT = 12)
	const testset = [...customPick.slice(0, PERSIDE), ...stdPick.slice(0, PERSIDE)]
	console.log('ชุดทดสอบ:', testset.filter(x => x.trueT === 12).length, 'custom +', testset.filter(x => x.trueT !== 12).length, 'มาตรฐาน =', testset.length, 'ใบ')

	// ---- baseline: 12-way (refs + few-shot) ----
	const BASE_SYS = 'You classify a packaging-box DIELINE (may have artwork) into ONE of 12 templates by construction. 12=Custom (not matching 1-11). Reply ONLY compact JSON {"box":<1-12>}.'
	async function baseClassify(b64) {
		const content = [...refBlocks, ...fewBlocks, { type: 'text', text: 'Classify THIS dieline (reply {"box":N}):' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }]
		const msg = await ai.createWithRetry(client, { model: OPUS, max_tokens: 200, system: BASE_SYS, messages: [{ role: 'user', content }] }); cacheRead += (msg.usage?.cache_read_input_tokens || 0)
		try { return ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')).box } catch (e) { return null }
	}

	// ---- ใหม่: Custom-detector (มองหาฟีเจอร์พิเศษก่อน) ----
	const NEW_SYS = [
		'You inspect a packaging-box DIELINE (may have printed artwork on it). First decide STANDARD vs CUSTOM.',
		'Classify as CUSTOM (box 12) if the dieline shows ANY non-standard feature, such as:',
		'- a die-cut display WINDOW or any cut-out opening in a panel',
		'- CURVED, SCALLOPED, ARCHED or WAVY cut edges/tabs (not plain straight tuck flaps)',
		'- a HANG-TAB, hook hole, or carry HANDLE',
		'- special locking tabs beyond a simple tuck (e.g. bakery locks, snap hooks)',
		'- an open COVER / WRAP / LID / plain sleeve-band that does not fully close a box',
		'- CORRUGATED RSC flap construction (4 wall panels + top & bottom flaps, no tuck-in end)',
		'- extra glued panels, unusual extra flaps, or an irregular overall outline',
		'- proportions or parts that do not cleanly match any stock template',
		'Only if NONE of these apply, classify as a STANDARD stock template 1-11 by construction (tuck / auto-bottom / tray / sleeve / seal).',
		'When genuinely in doubt, choose CUSTOM.',
		'Reply ONLY compact JSON {"custom":true|false,"features":["..."],"box":<1-12>}. If custom=true, set box=12.'
	].join('\n')
	async function newClassify(b64) {
		const content = [...refBlocks, { type: 'text', text: 'Inspect THIS dieline and reply JSON:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }]
		const msg = await ai.createWithRetry(client, { model: OPUS, max_tokens: 400, system: NEW_SYS, messages: [{ role: 'user', content }] }); cacheRead += (msg.usage?.cache_read_input_tokens || 0)
		try { const j = ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')); return { custom: !!j.custom, box: j.box, features: Array.isArray(j.features) ? j.features.join(', ') : '' } } catch (e) { return { custom: null, box: null, features: '' } }
	}

	const jobNames = loadJobNames(), results = []
	let cacheRead = 0
	// confusion: [trueCustom][predCustom]
	let bTP = 0, bFN = 0, bFP = 0, bTN = 0, nTP = 0, nFN = 0, nFP = 0, nTN = 0
	console.log('\nไฟล์ | จริง | baseline | ใหม่(custom?)')
	for (const it of testset) {
		const img = imgCache[it.file]; if (!img) continue
		const b64 = await toB64(img, 1400)
		const trueCustom = it.trueT === 12
		const base = await baseClassify(b64)
		const nw = await newClassify(b64)
		const basePredCustom = Number(base) === 12
		const newPredCustom = nw.custom === true || Number(nw.box) === 12
		if (trueCustom) { basePredCustom ? bTP++ : bFN++; newPredCustom ? nTP++ : nFN++ }
		else { basePredCustom ? bFP++ : bTN++; newPredCustom ? nFP++ : nTN++ }
		const jn = jobNames[it.file] || {}
		results.push({ file: it.file, job: jn.job || '', name: jn.name || '', type: it.type, trueT: it.trueT, trueCustom, base, basePredCustom, newCustom: newPredCustom, newBox: nw.box, features: nw.features, thumb: await toBuf(img, 420) })
		console.log('  ' + it.file.slice(0, 26).padEnd(27) + ' | ' + (trueCustom ? 'CUSTOM' : 'มาตรฐาน(' + it.trueT + ')').padEnd(10) + ' | ' + (base + (basePredCustom === trueCustom ? '✓' : '✗')).padEnd(4) + ' | ' + (newPredCustom ? 'custom' : 'std(' + nw.box + ')') + (newPredCustom === trueCustom ? '✓' : '✗'))
	}
	const rec = (tp, fn) => (tp + fn) ? (100 * tp / (tp + fn)).toFixed(0) + '%' : '-'
	const acc = (tp, tn, tot) => tot ? (100 * (tp + tn) / tot).toFixed(0) + '%' : '-'
	const N = results.length
	console.log('\n==== ผลไบนารี (Custom vs มาตรฐาน) — ' + N + ' ใบ ====')
	console.log('                    baseline(เดิม)   ใหม่(Custom-detector)')
	console.log('Custom recall (จับ custom ได้) : ' + rec(bTP, bFN).padEnd(6) + '        ' + rec(nTP, nFN))
	console.log('มาตรฐานถูก (ไม่ตีเป็น custom)  : ' + rec(bTN, bFP).padEnd(6) + '        ' + rec(nTN, nFP))
	console.log('accuracy รวม                  : ' + acc(bTP, bTN, N).padEnd(6) + '        ' + acc(nTP, nTN, N))
	console.log('cache อ่านซ้ำ: ' + (cacheRead / 1000 | 0) + 'k tokens')

	// ================= Excel =================
	const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
	const wb = new ExcelJS.Workbook()
	const hdr = (ws, argb = 'FF0D2440') => { const r = ws.getRow(1); r.height = 24; r.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } }) }

	const s = wb.addWorksheet('สรุป')
	s.columns = [{ width: 40 }, { width: 18 }, { width: 22 }]
	s.addRows([
		['รายงาน: AI จับ Custom vs มาตรฐาน (ไบนารี)'], ['วันที่', stamp], [],
		['จำนวนทดสอบ', N + ' ใบ (' + bTP + bFN + ' custom + ' + (bTN + bFP) + ' มาตรฐาน)'], ['เฉลยที่ใช้สอน (few-shot)', fewN + ' ใบ'], [],
		['ตัวชี้วัด', 'baseline (เดิม)', 'ใหม่ (Custom-detector)'],
		['Custom recall (จับ custom ได้กี่ %)', rec(bTP, bFN), rec(nTP, nFN)],
		['มาตรฐานถูก (ไม่ตีมั่วเป็น custom)', rec(bTN, bFP), rec(nTN, nFP)],
		['accuracy รวม', acc(bTP, bTN, N), acc(nTP, nTN, N)],
	])
	s.getRow(1).font = { bold: true, size: 13 }; s.getRow(7).font = { bold: true }
	hdr; // (สรุปไม่ต้อง header สี)

	const d = wb.addWorksheet('รายไฟล์+รูป', { views: [{ state: 'frozen', ySplit: 1 }] })
	d.columns = [
		{ header: 'รูปไดไลน์', width: 31 }, { header: 'ไฟล์', width: 30 }, { header: 'ชื่องาน', width: 22 },
		{ header: 'เฉลยจริง', width: 12 }, { header: 'เดิมตอบ', width: 9 }, { header: 'เดิมถูก?', width: 8 },
		{ header: 'ใหม่ตอบ', width: 11 }, { header: 'ใหม่ถูก?', width: 8 }, { header: 'ฟีเจอร์ที่ AI เห็น (วิธีใหม่)', width: 34 },
	]
	for (const r of results) {
		const row = d.addRow([null, r.file, r.name, r.trueCustom ? 'CUSTOM' : 'มาตรฐาน(' + r.trueT + ')', r.base, r.basePredCustom === r.trueCustom ? '✓' : '✗', r.newCustom ? 'custom' : 'std(' + r.newBox + ')', r.newCustom === r.trueCustom ? '✓' : '✗', r.features])
		row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(6).font = { bold: true, color: { argb: r.basePredCustom === r.trueCustom ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(8).font = { bold: true, color: { argb: r.newCustom === r.trueCustom ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' })
		d.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 143 } })
	}
	hdr(d)

	const out = 'answer_key/ผลเทส-custom-detector.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 รายงาน Excel (ฝังรูป): ' + out)
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
