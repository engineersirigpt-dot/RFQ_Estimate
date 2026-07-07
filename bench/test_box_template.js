// เทสนโยบาย box template (ประชุม 07/2026): ไม่มี pattern ชัด → Custom(12) • มีคำบอกสไตล์ → template จริง
// node bench/test_box_template.js
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

async function parse(txt) {
	const content = await ai.buildContentFromUpload(txt, [])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	let p = ai.extractJson(reply)
	p = await ai.stripHallucinations(p, txt, [])
	p = ai.validateAndFix(p, txt)
	return (p.components || [])[0] || {}
}

const CARDS = `TITLE : กล่อง cards1/s 350g + matt opp+spot uv
SIZE (mm.) : 60 x 100 x 120
PAPER - box: A/C C1s 350 gsm
PRINT - box : 4/0 Colors
OTHER - box: coating matt OPP 1 s ; coating gloss spot UV 1 s`

const CROCI = `TITLE : Inner Box Croci Spa (Multipack) Can 6x70g (1000)
SIZE (mm.) : 80 x 120 x 40
PAPER - A/C C1s 350 gsm
PRINT - 4/0 Colors`

// มีคำบอกสไตล์ชัด → ต้องยังจับ template จริง (กันแก้แรงไปจน Custom หมด)
const SLEEVE = `TITLE : ปลอกกล่อง (sleeve) สินค้า
SIZE (mm.) : 60 x 100 x 120
PAPER - A/C C1s 350 gsm
PRINT - 4/0`

;(async () => {
	const cases = [
		['cards spec (ไม่มี pattern)', CARDS, 12, true],
		['Croci Inner Box (ไม่มี pattern)', CROCI, 12, true],
		['Sleeve (มีคำ "ปลอก/sleeve")', SLEEVE, 9, false],
	]
	let pass = 0
	for (const [label, txt, expect, wantUncertain] of cases) {
		const c0 = await parse(txt)
		const got = c0.box_template_id
		const ok = got === expect
		console.log(`${ok ? '✅' : '❌'} ${label.padEnd(34)} → box=${got} (คาด ${expect})`)
		if (ok) pass++
	}
	console.log(`\n${pass}/${cases.length} pass`)
	if (pass < cases.length) process.exitCode = 1
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
