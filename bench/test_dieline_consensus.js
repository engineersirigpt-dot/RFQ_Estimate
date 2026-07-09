// รันไดไลน์จริงผ่าน consensus (ยิง N รอบ/ใบ, เอกฉันท์→คงทรง, แตก→Custom) — เหมือน logic ใน endpoint
// วัดบนข้อมูลจริง test/uploads ว่า: เก็บทรงกี่ %, ปัด Custom กี่ %, และความนิ่ง
// node bench/test_dieline_consensus.js <folder> [sampleN] [runsPerFile]
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 4 })
const MODEL = process.env.ANTHROPIC_IMAGE_MODEL || 'claude-opus-4-8'

const folder = process.argv[2] || 'test/uploads'
const sampleN = Number(process.argv[3]) || 12
const runs = Number(process.argv[4]) || 3

const mimeOf = (f) => {
	const e = f.toLowerCase().split('.').pop()
	if (e === 'pdf') return 'application/pdf'
	if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
	if (e === 'png') return 'image/png'
	if (e === 'webp') return 'image/webp'
	return null
}

// คืน RAW box_template pick ของโมเดล (ก่อน validateAndFix แก้)
async function rawParse(file) {
	const buf = fs.readFileSync(file)
	const f = { buffer: buf, mimetype: mimeOf(file), originalname: path.basename(file) }
	const content = await ai.buildContentFromUpload('', [f])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	return ai.extractJson(reply)
}
const rawBoxOf = (p) => {
	const c0 = (p.components || [])[0] || {}
	return c0.box_template_id != null ? parseInt(c0.box_template_id, 10) : null
}

;(async () => {
	const all = fs.readdirSync(folder)
		.filter((f) => mimeOf(f))
		.map((f) => ({ f, size: fs.statSync(path.join(folder, f)).size }))
		.filter((x) => x.size > 50 * 1024 && x.size < 4 * 1024 * 1024)
	const step = Math.max(1, Math.floor(all.length / sampleN))
	const sample = []
	for (let i = 0; i < all.length && sample.length < sampleN; i += step) sample.push(all[i].f)

	console.log(`ไฟล์(ขนาดพอเหมาะ): ${all.length} → สุ่ม ${sample.length} ใบ, consensus ${runs} รอบ/ใบ (เอกฉันท์→คง / แตก→Custom)\n`)
	const rows = [['ไฟล์', 'picks', 'ผล', 'FINAL', 'เฉลย(ทีมเติม)']]
	let kept = 0, custom = 0

	for (const f of sample) {
		const full = path.join(folder, f)
		let run1
		try { run1 = await rawParse(full) } catch (e) { console.log(`${f.slice(0, 30)} → run1 ERR`); continue }
		// run-1 = ตัวจริง (ผ่าน validateAndFix) + อีก 2 รอบ parallel
		let more = []
		try { more = await Promise.all([rawParse(full), rawParse(full)]) } catch (e) { more = [] }
		const picks = [run1, ...more].map(rawBoxOf)
		const votes = picks.filter((v) => v != null && !isNaN(v))
		const unanimous = votes.length >= 2 && votes.every((v) => v === votes[0])
		const b1v = ((ai.validateAndFix(JSON.parse(JSON.stringify(run1)), '').components || [])[0] || {}).box_template_id
		const final = (votes.length >= 2 && !unanimous) ? 12 : b1v
		const verdict = (votes.length < 2) ? 'ข้อมูลไม่พอ' : unanimous ? 'เอกฉันท์' : 'แตก→Custom'
		if (final === 12 && !unanimous) custom++; else kept++
		rows.push([f.slice(0, 26), '[' + picks.join(',') + ']', verdict, String(final), ''])
		console.log(`${f.slice(0, 28).padEnd(29)} picks=[${picks.join(',')}] ${verdict.padEnd(12)} FINAL=${final}`)
	}

	console.log(`\nสรุป: คงทรง ${kept} | ปัด Custom(แตก) ${custom} | รวม ${kept + custom}`)
	const md = '# ผล consensus บนไดไลน์จริง (ให้ทีมเติมเฉลย)\n\n' +
		`consensus ${runs} รอบ/ใบ · คงทรง ${kept} · ปัด Custom ${custom}\n\n` +
		'| ' + rows[0].join(' | ') + ' |\n| ' + rows[0].map(() => '---').join(' | ') + ' |\n' +
		rows.slice(1).map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n'
	fs.writeFileSync('bench/dieline_consensus_results.md', md)
	console.log('→ ตาราง: bench/dieline_consensus_results.md (เติมช่องเฉลยเพื่อวัด accuracy)')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
