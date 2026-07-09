// สแกน test/uploads (pdf/jpg/png) → แยกใบที่ AI "มั่นใจ" (consensus เอกฉันท์) ออกจากใบไม่มั่นใจ
// node bench/scan_confident.js <folder> [sampleN] [runsPerFile]
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 4 })
const MODEL = process.env.ANTHROPIC_IMAGE_MODEL || 'claude-opus-4-8'

const folder = process.argv[2] || 'test/uploads'
const sampleN = Number(process.argv[3]) || 24
const runs = Number(process.argv[4]) || 3

const TNAME = { 1: 'RTE', 2: 'STE', 3: 'TTSLB', 4: 'TTAB', 5: 'Tray', 6: 'FrameTray', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'SealEnd', 12: 'Custom' }
const mimeOf = (f) => {
	const e = f.toLowerCase().split('.').pop()
	if (e === 'pdf') return 'application/pdf'
	if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
	if (e === 'png') return 'image/png'
	if (e === 'webp') return 'image/webp'
	return null
}
async function rawBox(file) {
	const buf = fs.readFileSync(file)
	const content = await ai.buildContentFromUpload('', [{ buffer: buf, mimetype: mimeOf(file), originalname: path.basename(file) }])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	const c0 = (ai.extractJson(reply).components || [])[0] || {}
	return c0.box_template_id != null ? parseInt(c0.box_template_id, 10) : null
}

;(async () => {
	const all = fs.readdirSync(folder)
		.filter((f) => mimeOf(f))
		.map((f) => ({ f, size: fs.statSync(path.join(folder, f)).size }))
		.filter((x) => x.size > 40 * 1024 && x.size < 5 * 1024 * 1024)
	const step = Math.max(1, Math.floor(all.length / sampleN))
	const sample = []
	for (let i = 0; i < all.length && sample.length < sampleN; i += step) sample.push(all[i].f)
	console.log(`ไฟล์: ${all.length} → สุ่ม ${sample.length} ใบ (${runs} รอบ/ใบ)\n`)

	const results = []
	for (const f of sample) {
		const full = path.join(folder, f)
		const picks = []
		try {
			picks.push(await rawBox(full)) // รอบ 1 warm cache
			const more = await Promise.all(Array.from({ length: runs - 1 }, () => rawBox(full).catch(() => null)))
			picks.push(...more)
		} catch (e) { picks.push('ERR') }
		const valid = picks.filter((v) => typeof v === 'number' && !isNaN(v))
		const unanimous = valid.length >= 2 && valid.every((v) => v === valid[0])
		const ext = f.toLowerCase().split('.').pop()
		results.push({ f, ext, picks, unanimous, box: unanimous ? valid[0] : null })
		console.log(`${(unanimous ? '✅' : '· ')} ${f.slice(0, 30).padEnd(31)} [${picks.join(',')}]${unanimous ? ' → ' + valid[0] + ' ' + (TNAME[valid[0]] || '') : ''}`)
	}

	const conf = results.filter((r) => r.unanimous)
	const unsure = results.filter((r) => !r.unanimous)
	console.log(`\n========== มั่นใจ (เอกฉันท์ ${runs}/${runs}) : ${conf.length}/${results.length} ==========`)
	const byType = {}
	conf.forEach((r) => { const k = TNAME[r.box] || r.box; (byType[k] = byType[k] || []).push(r.f) })
	Object.entries(byType).sort((a, b) => b[1].length - a[1].length).forEach(([t, fs2]) => console.log(`  ทรง ${t} (${fs2.length}): ${fs2.map((x) => x.slice(0, 24)).join(', ')}`))
	console.log(`\n========== ไม่มั่นใจ (แตก→Custom) : ${unsure.length}/${results.length} ==========`)
	unsure.forEach((r) => console.log(`  ${r.f.slice(0, 30).padEnd(31)} [${r.picks.join(',')}]`))
	// by file type — มั่นใจแยกตามชนิดไฟล์
	console.log('\n--- มั่นใจ แยกตามชนิดไฟล์ ---')
	for (const ext of ['pdf', 'jpg', 'jpeg', 'png']) {
		const tot = results.filter((r) => r.ext === ext).length
		const c = conf.filter((r) => r.ext === ext).length
		if (tot) console.log(`  ${ext.toUpperCase().padEnd(5)}: มั่นใจ ${c}/${tot}`)
	}

	const md = '# ไดไลน์ที่ AI มั่นใจ (consensus เอกฉันท์)\n\n' +
		`สุ่ม ${results.length} ใบ · มั่นใจ ${conf.length} · ไม่มั่นใจ ${unsure.length}\n\n` +
		'## มั่นใจ\n\n| ไฟล์ | picks | ทรง | เฉลย(ทีมเติม) |\n| --- | --- | --- | --- |\n' +
		conf.map((r) => `| ${r.f} | [${r.picks.join(',')}] | ${r.box} ${TNAME[r.box] || ''} | |`).join('\n') +
		'\n\n## ไม่มั่นใจ (→Custom)\n\n| ไฟล์ | picks | เฉลย(ทีมเติม) |\n| --- | --- | --- |\n' +
		unsure.map((r) => `| ${r.f} | [${r.picks.join(',')}] | |`).join('\n') + '\n'
	fs.writeFileSync('bench/scan_confident_results.md', md)
	console.log('\n→ ตาราง: bench/scan_confident_results.md')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
