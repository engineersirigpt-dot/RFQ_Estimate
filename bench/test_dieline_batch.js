// รันรูป/PDF หลายใบผ่าน AI parse (Opus) — ดูคำตอบ box_template + ความนิ่ง (consistency)
// ไม่มีเฉลย → ออกตารางให้ทีมเติมเฉลยเอง
// node bench/test_dieline_batch.js <folder> [sampleN] [runsPerFile]
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })
const MODEL = process.env.ANTHROPIC_IMAGE_MODEL || 'claude-opus-4-8' // รูป → Opus (เหมือนแอปจริง)

const folder = process.argv[2] || 'test/uploads'
const sampleN = Number(process.argv[3]) || 10
const runs = Number(process.argv[4]) || 2

const mimeOf = (f) => {
	const e = f.toLowerCase().split('.').pop()
	if (e === 'pdf') return 'application/pdf'
	if (e === 'jpg' || e === 'jpeg') return 'image/jpeg'
	if (e === 'png') return 'image/png'
	if (e === 'webp') return 'image/webp'
	return null
}

async function parseOnce(file) {
	const buf = fs.readFileSync(file)
	const f = { buffer: buf, mimetype: mimeOf(file), originalname: path.basename(file) }
	const content = await ai.buildContentFromUpload('', [f])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	let p = ai.extractJson(reply)
	p = ai.validateAndFix(p, '')
	return (p.components || [])[0] || {}
}

;(async () => {
	// เลือกไฟล์ขนาดพอเหมาะ (50KB–4MB) กระจายทั่ว list กัน sample ซ้ำๆ
	const all = fs.readdirSync(folder)
		.filter((f) => mimeOf(f))
		.map((f) => ({ f, size: fs.statSync(path.join(folder, f)).size }))
		.filter((x) => x.size > 50 * 1024 && x.size < 4 * 1024 * 1024)
	const step = Math.max(1, Math.floor(all.length / sampleN))
	const sample = []
	for (let i = 0; i < all.length && sample.length < sampleN; i += step) sample.push(all[i].f)

	console.log(`ไฟล์ทั้งหมด(ขนาดพอเหมาะ): ${all.length} → สุ่ม ${sample.length} ใบ, รัน ${runs} รอบ/ใบ (Opus)\n`)
	const rows = [['ไฟล์', ...Array.from({ length: runs }, (_, i) => 'รอบ' + (i + 1)), 'นิ่ง?', 'มิติ', 'เฉลย(ทีมเติม)']]

	for (const f of sample) {
		const boxes = []
		let dims = ''
		for (let r = 0; r < runs; r++) {
			try {
				const c0 = await parseOnce(path.join(folder, f))
				boxes.push(c0.box_template_id != null ? String(c0.box_template_id) : '-')
				if (!dims && c0.dimensions_mm) dims = `${c0.dimensions_mm.width || '?'}×${c0.dimensions_mm.length || '?'}×${c0.dimensions_mm.height || '?'}`
				else if (!dims && c0.open_size_mm) dims = `open ${c0.open_size_mm.width || '?'}×${c0.open_size_mm.length || '?'}`
			} catch (e) { boxes.push('ERR') }
		}
		const stable = new Set(boxes).size === 1 ? '✅' : '⚠️ ไม่นิ่ง'
		rows.push([f.slice(0, 28), ...boxes, stable, dims || '-', ''])
		console.log(`${f.slice(0, 30).padEnd(31)} → [${boxes.join(', ')}] ${stable}`)
	}

	// เขียนตาราง md
	const md = '# ผลเทส box template (ให้ทีมเติมเฉลย)\n\n| ' + rows[0].join(' | ') + ' |\n| ' + rows[0].map(() => '---').join(' | ') + ' |\n' +
		rows.slice(1).map((r) => '| ' + r.join(' | ') + ' |').join('\n') + '\n'
	fs.writeFileSync('bench/dieline_batch_results.md', md)
	console.log('\n→ ตารางเขียนที่ bench/dieline_batch_results.md (ให้ทีมเติมช่อง "เฉลย")')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
