// [ประหยัด] ดัน Custom recall: v1 (prompt เปล่า) vs v2 (+custom few-shot 13 ใบ) — ไม่ใช้ thinking
// few-shot 13 ใบ, เทส 10+10, รูป 1000px → ถูกกว่าเดิม ~10 เท่า
// node bench/eval_custom_lean.js [perSide=10]
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs'), path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const ExcelJS = require('exceljs')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })

const PERSIDE = Number(process.argv[2] || 10)
const PX = 1000
const LOCAL = 'test/uploads'
const HAIKU = 'claude-haiku-4-5', OPUS = 'claude-opus-4-8'
const TN = { 1: 'Reverse Tuck End', 2: 'Straight Tuck End', 3: 'Snap Lock Bottom', 4: 'Auto Bottom', 5: 'Tray', 6: 'Frame-Vue', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'Seal End', 12: 'Custom' }
const JUNK = /ใบเสนอราคา|เสนอราคา|quotation|invoice|messageimage|screen ?shot|screenshot|(^|[ _])lay[ _]/i
const STD = [1, 2, 3, 4, 9, 11]

async function loadJimp(fp) { let buf; if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } } else buf = fs.readFileSync(fp); return Jimp.read(buf) }
const resized = (img, max) => { const w = img.bitmap.width, h = img.bitmap.height; const c = img.clone(); if (Math.max(w, h) > max) c.resize(w >= h ? { w: max } : { h: max }); return c }
const toB64 = async (img, max, q = 78) => (await resized(img, max).getBuffer('image/jpeg', { quality: q })).toString('base64')
const toBuf = async (img, max, q = 72) => resized(img, max).getBuffer('image/jpeg', { quality: q })
function loadJobNames() { const map = {}, re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i; for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (m) map[m[1].trim()] = { job: (m[3] || '').trim(), name: (m[4] || '').trim() } } return map }
function candByT() { const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, byT = {}; for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (!m) continue; const f = m[1].trim(), t = Number(m[2]); if (!(t >= 1 && t <= 12)) continue; (byT[t] = byT[t] || []).push(f) } for (const t of Object.keys(byT)) byT[t] = byT[t].slice(25).filter(f => !JUNK.test(f) && fs.existsSync(path.join(LOCAL, f))); return byT }

const HAIKU_SYS = 'Is this ONE unfolded packaging-box DIE-LINE (flat keyline of one box, with/without artwork)? Reply ONLY JSON {"type":"artwork"|"blank"|"photo"|"quote"|"multiup"|"other"}.'
async function haikuType(b64) { try { const m = await ai.createWithRetry(client, { model: HAIKU, max_tokens: 40, system: HAIKU_SYS, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: 'type?' }] }] }); return ai.extractJson(m.content.filter(x => x.type === 'text').map(x => x.text).join('\n')).type } catch (e) { return 'error' } }
async function pickReal(list, n, cache) { const out = []; for (const f of list) { if (out.length >= n) break; let img; try { img = await loadJimp(path.join(LOCAL, f)) } catch (e) { continue } const t = await haikuType(await toB64(img, PX)); if (t !== 'artwork' && t !== 'blank') continue; cache[f] = img; out.push({ file: f, type: t }) } return out }

const SYS = [
	'You inspect a packaging-box DIELINE (may have printed artwork). Decide STANDARD vs CUSTOM.',
	'CUSTOM (box 12) if the dieline shows ANY non-standard feature:',
	'- die-cut display WINDOW or cut-out opening in a panel',
	'- CURVED / SCALLOPED / ARCHED / WAVY cut edges or tabs (not plain straight tuck flaps)',
	'- HANG-TAB, hook hole, or carry HANDLE',
	'- special locking tabs beyond a simple tuck (bakery locks, snap hooks)',
	'- open COVER / WRAP / LID / plain sleeve-band that does not fully close a box',
	'- CORRUGATED RSC flap construction (4 wall panels + top & bottom flaps, no tuck-in end)',
	'- extra glued panels, unusual extra flaps, or irregular overall outline',
	'Only if NONE apply, classify as STANDARD stock template 1-11 by construction. When in doubt, choose CUSTOM.',
	'Reply ONLY JSON {"custom":true|false,"features":["..."],"box":<1-12>}. If custom=true set box=12.'
].join('\n')

;(async () => {
	console.log('เตรียม refs + few-shot (1000px)...')
	const refBlocks = [{ type: 'text', text: 'The 12 reference stock templates (1-11 standard, 12=Custom):' }]
	for (let i = 1; i <= 12; i++) { const p = 'public/img/' + i + '.jpg'; if (!fs.existsSync(p)) continue; refBlocks.push({ type: 'text', text: 'Template #' + i + ' = ' + TN[i] }); refBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp(p), PX) } }) }
	refBlocks[refBlocks.length - 1].cache_control = { type: 'ephemeral' }

	const few = [{ type: 'text', text: 'LABELLED EXAMPLES (learn CUSTOM vs STANDARD):' }]
	let fc = 0, fsd = 0
	for (const f of fs.readdirSync('router/labeled_dielines/12').filter(x => /\.jpg$/i.test(x))) { few.push({ type: 'text', text: '→ CUSTOM (non-standard feature: window / curved lock / RSC / open cover / extra part):' }); few.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp('router/labeled_dielines/12/' + f), PX) } }); fc++ }
	for (const t of STD) { const d = 'router/labeled_dielines/' + t; if (!fs.existsSync(d)) continue; const f = fs.readdirSync(d).filter(x => /\.jpg$/i.test(x))[0]; if (!f) continue; few.push({ type: 'text', text: '→ STANDARD template #' + t + ' (' + TN[t] + ') — plain stock box:' }); few.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toB64(await loadJimp(path.join(d, f)), PX) } }); fsd++ }
	few[few.length - 1].cache_control = { type: 'ephemeral' }
	console.log('few-shot: custom', fc, '+ มฐ', fsd, '=', fc + fsd, 'ใบ')

	let cacheRead = 0
	async function classify(b64, useFew) {
		const content = [...refBlocks]; if (useFew) content.push(...few)
		content.push({ type: 'text', text: 'Inspect THIS dieline, reply JSON:' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } })
		const msg = await ai.createWithRetry(client, { model: OPUS, max_tokens: 400, system: SYS, messages: [{ role: 'user', content }] }); cacheRead += (msg.usage?.cache_read_input_tokens || 0)
		try { const j = ai.extractJson(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')); return { custom: j.custom === true || Number(j.box) === 12, box: j.box, features: Array.isArray(j.features) ? j.features.join(', ') : '' } } catch (e) { return { custom: null, box: null, features: '' } }
	}

	const byT = candByT(), cache = {}
	console.log('คัดไดไลน์จริง (Haiku)... custom', PERSIDE, '+ มฐ', PERSIDE)
	const cust = await pickReal(byT[12] || [], PERSIDE, cache); cust.forEach(c => c.trueT = 12)
	const sp = []; const per = Math.ceil(PERSIDE / STD.length)
	for (const t of STD) { const g = await pickReal(byT[t] || [], per, cache); g.forEach(x => x.trueT = t); sp.push(...g) }
	const testset = [...cust.slice(0, PERSIDE), ...sp.slice(0, PERSIDE)]
	fs.writeFileSync('answer_key/custom_testset.tsv', testset.map(x => x.file + '\t' + x.trueT).join('\n'))
	console.log('ชุดทดสอบ:', testset.filter(x => x.trueT === 12).length, 'custom +', testset.filter(x => x.trueT !== 12).length, 'มฐ')

	const jobNames = loadJobNames(), results = []
	let a = { TP: 0, FN: 0, FP: 0, TN: 0 }, b = { TP: 0, FN: 0, FP: 0, TN: 0 }
	console.log('\nไฟล์ | จริง | v1 | v2')
	for (const it of testset) {
		const img = cache[it.file]; if (!img) continue
		const b64 = await toB64(img, PX)
		const tc = it.trueT === 12
		const v1 = await classify(b64, false), v2 = await classify(b64, true)
		if (tc) { v1.custom ? a.TP++ : a.FN++; v2.custom ? b.TP++ : b.FN++ } else { v1.custom ? a.FP++ : a.TN++; v2.custom ? b.FP++ : b.TN++ }
		const jn = jobNames[it.file] || {}
		results.push({ file: it.file, name: jn.name || '', trueT: it.trueT, tc, v1, v2, thumb: await toBuf(img, 400) })
		const mk = (v) => (v.custom ? 'custom' : 'std(' + v.box + ')') + (v.custom === tc ? '✓' : '✗')
		console.log('  ' + it.file.slice(0, 24).padEnd(25) + ' | ' + (tc ? 'CUSTOM' : 'มฐ(' + it.trueT + ')').padEnd(8) + ' | ' + mk(v1).padEnd(11) + ' | ' + mk(v2))
	}
	const rec = (x) => (x.TP + x.FN) ? (100 * x.TP / (x.TP + x.FN)).toFixed(0) + '%' : '-'
	const std = (x) => (x.TN + x.FP) ? (100 * x.TN / (x.TN + x.FP)).toFixed(0) + '%' : '-'
	const acc = (x, n) => n ? (100 * (x.TP + x.TN) / n).toFixed(0) + '%' : '-'
	const N = results.length
	console.log('\n==== ผล (' + N + ' ใบ) ====')
	console.log('                       v1(เปล่า)   v2(+few-shot)')
	console.log('Custom recall        : ' + rec(a).padEnd(6) + '     ' + rec(b))
	console.log('มาตรฐานถูก           : ' + std(a).padEnd(6) + '     ' + std(b))
	console.log('accuracy รวม         : ' + acc(a, N).padEnd(6) + '     ' + acc(b, N))
	console.log('cache อ่านซ้ำ: ' + (cacheRead / 1000 | 0) + 'k tokens')

	// Excel
	const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
	const wb = new ExcelJS.Workbook()
	const s = wb.addWorksheet('สรุป'); s.columns = [{ width: 38 }, { width: 14 }, { width: 16 }]
	s.addRows([['ดัน Custom recall (ประหยัด) v1 vs v2'], ['วันที่', stamp], [], ['ทดสอบ', N + ' ใบ'], ['few-shot', fc + fsd + ' ใบ'], [], ['ตัวชี้วัด', 'v1 เปล่า', 'v2 +few-shot'], ['Custom recall', rec(a), rec(b)], ['มาตรฐานถูก', std(a), std(b)], ['accuracy', acc(a, N), acc(b, N)]])
	s.getRow(1).font = { bold: true, size: 13 }; s.getRow(7).font = { bold: true }
	const d = wb.addWorksheet('รายไฟล์+รูป', { views: [{ state: 'frozen', ySplit: 1 }] })
	d.columns = [{ header: 'รูป', width: 30 }, { header: 'ไฟล์', width: 28 }, { header: 'ชื่องาน', width: 22 }, { header: 'เฉลย', width: 10 }, { header: 'v1', width: 9 }, { header: '?', width: 4 }, { header: 'v2', width: 9 }, { header: '?', width: 4 }, { header: 'ฟีเจอร์ v2', width: 32 }]
	const h = d.getRow(1); h.height = 20; h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D2440' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', horizontal: 'center' } })
	for (const r of results) {
		const row = d.addRow([null, r.file, r.name, r.tc ? 'CUSTOM' : 'มฐ(' + r.trueT + ')', r.v1.custom ? 'custom' : 'std(' + r.v1.box + ')', r.v1.custom === r.tc ? '✓' : '✗', r.v2.custom ? 'custom' : 'std(' + r.v2.box + ')', r.v2.custom === r.tc ? '✓' : '✗', r.v2.features])
		row.height = 108; row.alignment = { vertical: 'middle', wrapText: true }
		row.getCell(6).font = { bold: true, color: { argb: r.v1.custom === r.tc ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }
		row.getCell(8).font = { bold: true, color: { argb: r.v2.custom === r.tc ? 'FF1B8A3A' : 'FFC0392B' } }; row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }
		const id = wb.addImage({ buffer: r.thumb, extension: 'jpeg' }); d.addImage(id, { tl: { col: 0.1, row: row.number - 1 + 0.05 }, ext: { width: 200, height: 138 } })
	}
	const out = 'answer_key/ผลเทส-custom-recall-lean.xlsx'
	await wb.xlsx.writeFile(out)
	console.log('\n📊 Excel: ' + out)
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
