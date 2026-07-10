// ดัน Custom recall: เทียบ v1 (Custom-detector prompt เปล่า) vs v2 (+custom few-shot +adaptive thinking)
// ชุดทดสอบสมดุลชุดเดียวกัน (custom N + มาตรฐาน N), Haiku คัดไดไลน์จริง, ไม่ทับ few-shot
// node bench/eval_custom2.js [perSide=15]
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs'), path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 180000, maxRetries: 3 })

const PERSIDE = Number(process.argv[2] || 15)
const LOCAL = 'test/uploads'
const HAIKU = 'claude-haiku-4-5', OPUS = 'claude-opus-4-8'
const TN = { 1: 'Reverse Tuck End', 2: 'Straight Tuck End', 3: 'Snap Lock Bottom', 4: 'Auto Bottom', 5: 'Tray', 6: 'Frame-Vue', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'Seal End', 12: 'Custom' }
const JUNK = /ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|(^|[ _])lay[ _]/i
const STD_TEMPLATES = [1, 2, 3, 4, 9, 11]

async function loadJimp(fp) { let buf; if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } } else buf = fs.readFileSync(fp); return Jimp.read(buf) }
const resized = (img, max) => { const w = img.bitmap.width, h = img.bitmap.height; const c = img.clone(); if (Math.max(w, h) > max) c.resize(w >= h ? { w: max } : { h: max }); return c }
const toB64 = async (img, max, q = 80) => (await resized(img, max).getBuffer('image/jpeg', { quality: q })).toString('base64')
const toBuf = async (img, max, q = 74) => resized(img, max).getBuffer('image/jpeg', { quality: q })
function loadJobNames() { const map = {}, re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i; for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (m) map[m[1].trim()] = { job: (m[3] || '').trim(), name: (m[4] || '').trim() } } return map }
function candidatesByT() { const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, byT = {}; for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (!m) continue; const f = m[1].trim(), t = Number(m[2]); if (!(t >= 1 && t <= 12)) continue; (byT[t] = byT[t] || []).push(f) } for (const t of Object.keys(byT)) byT[t] = byT[t].slice(25).filter(f => !JUNK.test(f) && fs.existsSync(path.join(LOCAL, f))); return byT }

const HAIKU_SYS = 'You inspect ONE image and decide if it is a single unfolded packaging-box DIE-LINE (flat keyline of one box, WITH or WITHOUT printed artwork). Reply ONLY compact JSON {"type":"artwork"|"blank"|"photo"|"quote"|"multiup"|"other"}.'
async function haikuType(b64) { try { const msg = await ai.createWithRetry(client, { model: HAIKU, max_tokens: 60, system: HAIKU_SYS, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: 'type?' }] }] }); return ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')).type } catch (e) { return 'error' } }
async function pickReal(list, n, cache) { const out = []; for (const f of list) { if (out.length >= n) break; let img; try { img = await loadJimp(path.join(LOCAL, f)) } catch (e) { continue } const type = await haikuType(await toB64(img, 1000, 78)); if (type !== 'artwork' && type !== 'blank') continue; cache[f] = img; out.push({ file: f, type }) } return out }

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

;(async () => {
	console.log('เตรียม template refs + few-shot...')
	const refBlocks = [{ type: 'text', text: 'The 12 reference stock templates (1-11 standard, 12=Custom):' }]
	for (let i = 1; i <= 12; i++) { const p = 'public/img/' + i + '.jpg'; if (!fs.existsSync(p)) continue; refBlocks.push({ type: 'text', text: 'Template #' + i + ' = ' + TN[i] }); refBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp(p), 1400) } }) }
	refBlocks[refBlocks.length - 1].cache_control = { type: 'ephemeral' }

	// v2 few-shot: custom-positive (ทั้งหมดใน /12) + standard-negative (ทรงละ 2)
	const fs2 = [{ type: 'text', text: 'LABELLED EXAMPLES of real dielines (learn what makes a box CUSTOM vs STANDARD):' }]
	let fewCustom = 0, fewStd = 0
	for (const f of fs.readdirSync('router/labeled_dielines/12').filter(x => /\.jpg$/i.test(x))) { fs2.push({ type: 'text', text: '→ CUSTOM (has a non-standard feature such as window / curved lock / RSC flaps / open cover / extra part):' }); fs2.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync('router/labeled_dielines/12/' + f).toString('base64') } }); fewCustom++ }
	for (const t of STD_TEMPLATES) { const d = 'router/labeled_dielines/' + t; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d).filter(x => /\.jpg$/i.test(x)).slice(0, 2)) { fs2.push({ type: 'text', text: '→ STANDARD template #' + t + ' (' + TN[t] + ') — plain stock box, no special feature:' }); fs2.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: fs.readFileSync(path.join(d, f)).toString('base64') } }); fewStd++ } }
	fs2[fs2.length - 1].cache_control = { type: 'ephemeral' }
	console.log('v2 few-shot: custom', fewCustom, '+ มาตรฐาน', fewStd)

	let cacheRead = 0
	async function classify(b64, useFew, think) {
		const content = [...refBlocks]
		if (useFew) content.push(...fs2)
		content.push({ type: 'text', text: 'Inspect THIS dieline and reply JSON:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })
		const req = { model: OPUS, max_tokens: think ? 2500 : 400, system: NEW_SYS, messages: [{ role: 'user', content }] }
		if (think) req.thinking = { type: 'adaptive' }
		const msg = await ai.createWithRetry(client, req); cacheRead += (msg.usage?.cache_read_input_tokens || 0)
		try { const j = ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')); return { custom: j.custom === true || Number(j.box) === 12, box: j.box, features: Array.isArray(j.features) ? j.features.join(', ') : '' } } catch (e) { return { custom: null, box: null, features: '' } }
	}

	// ---- เลือกชุดทดสอบสมดุล ----
	const byT = candidatesByT(), imgCache = {}
	console.log('คัดไดไลน์จริง (Haiku)... custom', PERSIDE, '+ มาตรฐาน', PERSIDE)
	const customPick = await pickReal(byT[12] || [], PERSIDE, imgCache); customPick.forEach(c => c.trueT = 12)
	const stdPick = []; const perStd = Math.ceil(PERSIDE / STD_TEMPLATES.length)
	for (const t of STD_TEMPLATES) { const got = await pickReal(byT[t] || [], perStd, imgCache); got.forEach(g => g.trueT = t); stdPick.push(...got) }
	const testset = [...customPick.slice(0, PERSIDE), ...stdPick.slice(0, PERSIDE)]
	fs.writeFileSync('answer_key/custom_testset.tsv', testset.map(x => x.file + '\t' + x.trueT).join('\n'))
	console.log('ชุดทดสอบ:', testset.filter(x => x.trueT === 12).length, 'custom +', testset.filter(x => x.trueT !== 12).length, 'มาตรฐาน =', testset.length, 'ใบ')

	const jobNames = loadJobNames(), results = []
	let v1TP = 0, v1FN = 0, v1FP = 0, v1TN = 0, v2TP = 0, v2FN = 0, v2FP = 0, v2TN = 0
	console.log('\nไฟล์ | จริง | v1 | v2')
	for (const it of testset) {
		const img = imgCache[it.file]; if (!img) continue
		const b64 = await toB64(img, 1400)
		const trueCustom = it.trueT === 12
		const v1 = await classify(b64, false, false)
		const v2 = await classify(b64, true, true)
		if (trueCustom) { v1.custom ? v1TP++ : v1FN++; v2.custom ? v2TP++ : v2FN++ } else { v1.custom ? v1FP++ : v1TN++; v2.custom ? v2FP++ : v2TN++ }
		const jn = jobNames[it.file] || {}
		results.push({ file: it.file, job: jn.job || '', name: jn.name || '', trueT: it.trueT, trueCustom, v1, v2, thumb: await toBuf(img, 420) })
		const mk = (v) => (v.custom ? 'custom' : 'std(' + v.box + ')') + (v.custom === trueCustom ? '✓' : '✗')
		console.log('  ' + it.file.slice(0, 24).padEnd(25) + ' | ' + (trueCustom ? 'CUSTOM' : 'มฐ(' + it.trueT + ')').padEnd(8) + ' | ' + mk(v1).padEnd(11) + ' | ' + mk(v2))
	}
	const rec = (tp, fn) => (tp + fn) ? (100 * tp / (tp + fn)).toFixed(0) + '%' : '-'
	const acc = (tp, tn, tot) => tot ? (100 * (tp + tn) / tot).toFixed(0) + '%' : '-'
	const N = results.length
	console.log('\n==== ผล (' + N + ' ใบ) ====')
	console.log('                              v1(เปล่า)   v2(few-shot+thinking)')
	console.log('Custom recall (จับ custom ได้): ' + rec(v1TP, v1FN).padEnd(6) + '      ' + rec(v2TP, v2FN))
	console.log('มาตรฐานถูก (ไม่ตีมั่ว)        : ' + rec(v1TN, v1FP).padEnd(6) + '      ' + rec(v2TN, v2FP))
	console.log('accuracy รวม                  : ' + acc(v1TP, v1TN, N).padEnd(6) + '      ' + acc(v2TP, v2TN, N))
	console.log('cache อ่านซ้ำ: ' + (cacheRead / 1000 | 0) + 'k tokens')

	// ===== Excel =====
	const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
	const wb = new ExcelJS.Workbook()
	const s = wb.addWorksheet('สรุป'); s.columns = [{ width: 40 }, { width: 16 }, { width: 22 }]
	s.addRows([['รายงาน: ดัน Custom recall (v1 vs v2)'], ['วันที่', stamp], [], ['จำนวนทดสอบ', N + ' ใบ'], ['v2 few-shot', 'custom ' + fewCustom + ' + มฐ ' + fewStd], [], ['ตัวชี้วัด', 'v1 (เปล่า)', 'v2 (few-shot+thinking)'], ['Custom recall', rec(v1TP, v1FN), rec(v2TP, v2FN)], ['มาตรฐานถูก', rec(v1TN, v1FP), rec(v2TN, v2FP)], ['accuracy รวม', acc(v1TP, v1TN, N), acc(v2TP, v2TN, N)]])
	s.getRow(1).font = { bold: true, size: 13 }; s.getRow(7).font = { bold: true }
	const d = wb.addWorksheet('รายไฟล์+รูป', { views: [{ state: 'frozen', ySplit: 1 }] })
	d.columns = [{ header: 'รูปไดไลน์', width: 31 }, { header: 'ไฟล์', width: 28 }, { header: 'ชื่องาน', width: 22 }, { header: 'เฉลยจริง', width: 11 }, { header: 'v1 ตอบ', width: 9 }, { header: 'v1', width: 5 }, { header: 'v2 ตอบ', width: 9 }, { header: 'v2', width: 5 }, { header: 'ฟีเจอร์ที่ v2 เห็น', width: 34 }]
	const hrow = d.getRow(1); hrow.height = 22; hrow.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true } })
	for (const r of results) {
		const row = d.addRow([null, r.file, r.name, r.trueCustom ? 'CUSTOM' : 'มฐ(' + r.trueT + ')', r.v1.custom ? 'custom' : 'std(' + r.v1.box + ')', r.v1.custom === r.trueCustom ? '✓' : '✗', r.v2.custom ? 'custom' : 'std(' + r.v2.box + ')', r.v2.custom === r.trueCustom ? '✓' : '✗', r.v2.features])
		row.height = 112; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(6).font = { bold: true, color: { argb: r.v1.custom === r.trueCustom ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(8).font = { bold: true, color: { argb: r.v2.custom === r.trueCustom ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' }); d.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 205, height: 143 } })
	}
	const out = 'answer_key/ผลเทส-custom-recall-v2.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 Excel: ' + out)
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
