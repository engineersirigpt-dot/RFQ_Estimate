// วัด accuracy การจับ box template — เทียบ few-shot ON (เฉลยจริง) vs OFF บน held-out
// ออกรายงาน Excel (.xlsx) หลายชีต: สรุป / รายทรง / รายไฟล์ / จุดที่ตอบผิด
// node bench/test_fewshot.js [perTemplateHeldout=5]   (ใส่ 0 = เทสทุกใบใน held-out)
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs'), path = require('path')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const XLSX = require('xlsx')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })

const PER = Number(process.argv[2] ?? 5) // 0 = ทุกใบ
const TN = { 1: 'Reverse Tuck End (ฝาเสียบสลับ)', 2: 'Straight Tuck End (ฝาเสียบตรง)', 3: 'Tuck Top Snap Lock Bottom', 4: 'Tuck Top Auto Bottom (ก้นทากาว)', 5: 'Tray (ถาด)', 6: 'Frame-Vue Tray', 7: 'Bento Tray+Lid', 8: 'Gable Top (มีหูหิ้ว)', 9: 'Sleeve (ปลอก เปิด2ด้าน)', 10: 'Pillow Box', 11: 'Seal End (ฝาทากาว)', 12: 'Custom (ไม่เข้าทรง 1-11)' }

// โหลดไฟล์ใดๆ (pdf→หน้าแรก) → jpeg ≤1400px base64
async function b64(fp, max = 1400) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > max) img.resize(w >= h ? { w: max } : { h: max })
	return (await img.getBuffer('image/jpeg', { quality: 80 })).toString('base64')
}

// ชื่องานจริง (จาก answer_map.csv) — เอาไว้กำกับในรายงานให้อ่านรู้เรื่อง
function loadJobNames() {
	const map = {}
	try {
		const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i
		for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) {
			const m = l.match(re); if (m) map[m[1].trim()] = { job: (m[3] || '').trim(), name: (m[4] || '').trim() }
		}
	} catch (e) {}
	return map
}

;(async () => {
	// 1) template refs (ย่อ ≤1400 — ไม่แตะ public/img)
	console.log('เตรียม template refs...')
	const tmpl = []
	for (let i = 1; i <= 12; i++) { const p = 'public/img/' + i + '.jpg'; if (fs.existsSync(p)) tmpl.push({ id: i, b64: await b64(p) }) }

	// 2) few-shot (เฉลยจริง จาก labeled_dielines)
	const few = []
	for (let t = 1; t <= 12; t++) { const d = 'router/labeled_dielines/' + t; if (!fs.existsSync(d)) continue; for (const f of fs.readdirSync(d).filter(x => /\.jpg$/i.test(x))) few.push({ t, b64: fs.readFileSync(path.join(d, f)).toString('base64') }) }
	console.log('few-shot:', few.length, 'ใบ | held-out เทส', PER || 'ทุก', '/ทรง')

	// 3) held-out (เลือก PER ต่อทรง; PER=0 = ทุกใบ)
	const jobNames = loadJobNames()
	const held = fs.readFileSync('answer_key/heldout_map.tsv', 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.lastIndexOf('\t'); return { file: l.slice(0, i), t: Number(l.slice(i + 1)) } })
	const byT = {}; const test = []
	for (const h of held) { byT[h.t] = (byT[h.t] || 0); if (!PER || byT[h.t] < PER) { test.push(h); byT[h.t]++ } }

	const SYS = 'You classify a packaging-box DIELINE into ONE of 12 templates by CONSTRUCTION (tuck/auto-bottom/tray/sleeve/seal/custom). 12=Custom (not matching 1-11). Reply ONLY compact JSON {"box": <1-12>}.'
	const refBlocks = [{ type: 'text', text: 'The 12 reference templates:' }]
	tmpl.forEach(t => { refBlocks.push({ type: 'text', text: 'Template #' + t.id + ' = ' + TN[t.id] }); refBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: t.b64 } }) })
	const fewBlocks = [{ type: 'text', text: 'VERIFIED EXAMPLES (real dielines a human labelled with the correct template — learn to tell them apart):' }]
	few.forEach(f => { fewBlocks.push({ type: 'text', text: '→ correct = Template #' + f.t }); fewBlocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: f.b64 } }) })

	async function classify(heldB64, useFew) {
		const content = [...refBlocks]
		if (useFew) content.push(...fewBlocks)
		content.push({ type: 'text', text: 'Now classify THIS dieline (reply {"box":N}):' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: heldB64 } })
		const msg = await ai.createWithRetry(client, { model: 'claude-opus-4-8', max_tokens: 300, system: SYS, messages: [{ role: 'user', content }] })
		const txt = msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n')
		try { return ai.extractJson(txt).box } catch (e) { return null }
	}

	const rows = []            // ราย held-out
	const perT = {}            // สถิติรายทรง
	let onOK = 0, offOK = 0, n = 0
	console.log('\nไฟล์ | จริง | OFF | ON')
	for (const h of test) {
		let hb; try { hb = await b64(path.join('test/uploads', h.file)) } catch (e) { console.log('  skip (แปลงไม่ได้):', h.file.slice(0, 30)); continue }
		let off, on
		try { off = await classify(hb, false) } catch (e) { off = null }
		try { on = await classify(hb, true) } catch (e) { on = null }
		const offHit = Number(off) === h.t, onHit = Number(on) === h.t
		n++; if (offHit) offOK++; if (onHit) onOK++
		perT[h.t] = perT[h.t] || { n: 0, off: 0, on: 0 }; perT[h.t].n++; if (offHit) perT[h.t].off++; if (onHit) perT[h.t].on++
		const jn = jobNames[h.file] || {}
		rows.push({ file: h.file, job: jn.job || '', name: jn.name || '', t: h.t, tname: TN[h.t], off, offHit, on, onHit, onName: TN[Number(on)] || '' })
		console.log('  ' + h.file.slice(0, 34).padEnd(35) + ' | ' + h.t + ' | ' + off + (offHit ? '✓' : '✗') + ' | ' + on + (onHit ? '✓' : '✗'))
	}
	const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-'
	console.log('\n==== ผล (' + n + ' ใบ) ====')
	console.log('few-shot OFF: ' + offOK + '/' + n + ' = ' + pct(offOK, n))
	console.log('few-shot ON:  ' + onOK + '/' + n + ' = ' + pct(onOK, n) + '  ' + (onOK > offOK ? '📈 ดีขึ้น!' : onOK < offOK ? '📉 แย่ลง' : '≈ เท่าเดิม'))

	// ===== เขียน Excel =====
	const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ')
	const wb = XLSX.utils.book_new()

	// ชีต 1: สรุป
	const s1 = [
		['รายงานผลทดสอบ AI จับทรงกล่อง (box template)', ''],
		['วันที่ทดสอบ', stamp],
		['', ''],
		['จำนวนไฟล์ที่ทดสอบ', n],
		['ตัวอย่างเฉลยที่ใช้สอน (few-shot)', few.length + ' ใบ'],
		['ไฟล์เฉลยทั้งหมดในระบบ', Object.keys(jobNames).length + ' คู่'],
		['', ''],
		['ความแม่นยำ', 'ตอบถูก', 'จากทั้งหมด', 'คิดเป็น'],
		['แบบไม่ใช้เฉลย (AI เดาเอง)', offOK, n, pct(offOK, n)],
		['แบบใช้เฉลยสอน (few-shot)', onOK, n, pct(onOK, n)],
		['เปลี่ยนแปลง', (onOK - offOK >= 0 ? '+' : '') + (onOK - offOK) + ' ใบ', '', (onOK > offOK ? 'ดีขึ้น' : onOK < offOK ? 'แย่ลง' : 'เท่าเดิม')],
	]
	const ws1 = XLSX.utils.aoa_to_sheet(s1); ws1['!cols'] = [{ wch: 34 }, { wch: 14 }, { wch: 12 }, { wch: 12 }]
	XLSX.utils.book_append_sheet(wb, ws1, 'สรุป')

	// ชีต 2: รายทรง
	const s2 = [['ทรง', 'ชื่อทรง', 'จำนวนทดสอบ', 'ถูก (ไม่ใช้เฉลย)', '% ไม่ใช้เฉลย', 'ถูก (ใช้เฉลย)', '% ใช้เฉลย']]
	for (let t = 1; t <= 12; t++) { const p = perT[t]; if (!p) continue; s2.push([t, TN[t], p.n, p.off, pct(p.off, p.n), p.on, pct(p.on, p.n)]) }
	const ws2 = XLSX.utils.aoa_to_sheet(s2); ws2['!cols'] = [{ wch: 5 }, { wch: 32 }, { wch: 11 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 11 }]
	XLSX.utils.book_append_sheet(wb, ws2, 'รายทรง')

	// ชีต 3: รายไฟล์
	const s3 = [['ไฟล์', 'เลขงาน', 'ชื่องาน', 'ทรงจริง', 'ชื่อทรงจริง', 'AI ไม่ใช้เฉลย', 'ถูก?', 'AI ใช้เฉลย', 'ถูก?']]
	for (const r of rows) s3.push([r.file, r.job, r.name, r.t, r.tname, r.off, r.offHit ? '✓' : '✗', r.on, r.onHit ? '✓' : '✗'])
	const ws3 = XLSX.utils.aoa_to_sheet(s3); ws3['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 26 }, { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 6 }]
	XLSX.utils.book_append_sheet(wb, ws3, 'รายไฟล์')

	// ชีต 4: จุดที่ยังตอบผิด (แบบใช้เฉลย) — ไว้ปรับปรุงต่อ
	const s4 = [['ไฟล์', 'ชื่องาน', 'ทรงจริง', 'ชื่อทรงจริง', 'AI ตอบ (ผิด)', 'AI เข้าใจว่าเป็น']]
	for (const r of rows) if (!r.onHit) s4.push([r.file, r.name, r.t, r.tname, r.on, r.onName])
	const ws4 = XLSX.utils.aoa_to_sheet(s4); ws4['!cols'] = [{ wch: 40 }, { wch: 26 }, { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 28 }]
	XLSX.utils.book_append_sheet(wb, ws4, 'ตอบผิด(ใช้เฉลย)')

	const out = 'answer_key/ผลเทส-AI-box-template.xlsx'
	XLSX.writeFile(wb, out)
	console.log('\n📊 รายงาน Excel: ' + out + '  (4 ชีต)')
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
