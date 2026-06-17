// One-off: รันอินพุตจริง Virtus (DP350 = กล่องแป้งหลังเทา 350) ผ่าน AI pipeline เต็ม
// node bench/test_virtus.js
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

const TXT = `5. Inner Brand Virtus Packing (1V)6X12

AE: นพภกิต เตชโรจน์
ลูกค้า  C2014053   ทรอปิคอลแคนนิ่ง (ประเทศไทย)
ยอด   1000  2000  3000  5000  10000  15000  20000 25000  30000  50000

Size W67 x L67 x H140 mm.
DP350g + UV Coatingเว้นลิ้น + 6 Colors + ไดคัท + แกะ+ ติดลิ้นกาวข้าง 1 จุด + ห่อส่ง กรุงเทพ
สีพิเศษ  PMS เขียว  ตีพื้น
สีพิเศษ  PMS ฟ้า    ลายเส้น`

;(async () => {
	const content = await ai.buildContentFromUpload(TXT, [])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000, temperature: 0,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	let p = ai.extractJson(reply)
	const beforeStrip = JSON.parse(JSON.stringify(p))
	p = await ai.stripHallucinations(p, TXT, [])
	p = ai.validateAndFix(p)
	p = ai.inferDuplexFromDP(p, TXT) // DPxxxg → Duplex GBB (เหมือน route จริง)

	const c0 = (p.components || [])[0] || {}
	console.log('\n========== ผลลัพธ์สุดท้าย (หลัง strip + validate) ==========')
	console.log('print_type   :', p.print_type)
	console.log('quantities   :', JSON.stringify(p.quantities))
	console.log('dimensions   :', JSON.stringify(c0.dimensions_mm), '(คาด W67 L67 H140)')
	console.log('box_template :', c0.box_template_id)
	console.log('paper_type   :', c0.paper_type, '  ← คาด: กล่องแป้งหลังเทา/Duplex')
	console.log('paper_gram   :', c0.paper_gram, '  ← คาด: 350')
	console.log('color out/in :', c0.color_outside, '/', c0.color_inside, '(คาด 6)')
	console.log('coatings     :', JSON.stringify(c0.coatings), '(คาด UV เว้นลิ้น)')
	console.log('special_inks :', JSON.stringify(c0.special_inks))
	console.log('deliveries   :', JSON.stringify(p.deliveries))
	console.log('_uncertain   :', JSON.stringify(p._uncertain))

	console.log('\n--- paper ก่อน vs หลัง strip (ดูว่า DP350 ถูกตัดไหม) ---')
	const b0 = (beforeStrip.components || [])[0] || {}
	console.log('ก่อน strip: paper_type=' + b0.paper_type + ' paper_gram=' + b0.paper_gram)
	console.log('หลัง strip: paper_type=' + c0.paper_type + ' paper_gram=' + c0.paper_gram)

	console.log('\n========== JSON เต็ม ==========')
	console.log(JSON.stringify(p, null, 2))
})().catch((e) => { console.error(e); process.exit(1) })
