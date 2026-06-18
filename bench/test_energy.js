// One-off: เทสมิติ W×L×H (ลูกค้าส่ง กว้าง×ยาว, W>L) ผ่าน AI pipeline
// node bench/test_energy.js
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

const TXT = `TITLE : INNER BOX 25 NERGY PLUS (6สี)

SIZE (Inches) : 4.33" x 2.96" x 6.11"
SIZE (mm.) : 110 x 75 x 155
PAPER   - A/C C1s 350 gsm
PRINT   - 6/0 Colors
COATING   - Gloss OPP 1 s
PROCESS   - ไดคัท แกะ ติดกาว 1 จุด
PACKING   - kraftwrap 100 pcs/pack
Qty 1000  2000   3000  5000`

;(async () => {
	const content = await ai.buildContentFromUpload(TXT, [])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000, temperature: 0,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	let p = ai.extractJson(reply)
	const rawDim = JSON.parse(JSON.stringify((p.components || [])[0] || {})).dimensions_mm
	p = await ai.stripHallucinations(p, TXT, [])
	p = ai.validateAndFix(p)
	p = ai.inferDuplexFromDP(p, TXT)
	const c0 = (p.components || [])[0] || {}
	console.log('\n========== มิติ ==========')
	console.log('AI อ่านดิบ (ก่อน validate):', JSON.stringify(rawDim))
	console.log('หลัง validate            :', JSON.stringify(c0.dimensions_mm))
	console.log('ลูกค้าส่ง: 110(กว้าง) x 75(ยาว) x 155(สูง)')
	console.log('→ ถ้า width=110,length=75 = ตรงที่ลูกค้าส่ง | ถ้า width=75,length=110 = ถูกสลับ (length>=width)')
	console.log('\n========== ช่องอื่น ==========')
	console.log('paper:', c0.paper_type, c0.paper_gram, '| color:', c0.color_outside + '/' + c0.color_inside, '| box_template:', c0.box_template_id)
	console.log('coating:', JSON.stringify(c0.coatings))
	console.log('packing:', JSON.stringify(p.packing), '| _uncertain:', JSON.stringify(p._uncertain))
})().catch((e) => { console.error(e); process.exit(1) })
