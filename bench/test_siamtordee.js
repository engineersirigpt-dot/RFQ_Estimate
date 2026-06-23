// One-off: เทสสเปกแผ่นรองเครื่องมือช่าง (สยามท่อดี) — เช็คว่ากรอกครบไหม
// node bench/test_siamtordee.js
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

const TXT = `ลูกค้า บริษัท สยามท่่อดี จำกัด

TITLE : แผ่นรองเครื่องมือช่าง
SIZE :  190 x 260 mm.
PAPER  กระดาษกล่องแป้งหลังเทา 350 แกรม
PRINT: 4/1 + Gloss Waterbase Hi-Rub  1/s
BINDING : ไดคัท + แกะ
REMARKS : ส่งงานกรุงเทพ 1 จุด พร้อมลิมิตสี 1 เล่ม`

;(async () => {
	const content = await ai.buildContentFromUpload(TXT, [])
	const msg = await ai.createWithRetry(client, {
		model: MODEL, max_tokens: 4000, temperature: 0,
		system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
		messages: [{ role: 'user', content }],
	})
	const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
	let p = ai.extractJson(reply)
	p = await ai.stripHallucinations(p, TXT, [])
	p = ai.validateAndFix(p)
	p = ai.inferDuplexFromDP(p, TXT)
	const c0 = (p.components || [])[0] || {}
	console.log('\n===== ผลลัพธ์เต็ม =====')
	console.log(JSON.stringify(p, null, 2))
	console.log('\n===== เช็คทีละช่อง =====')
	const chk = (label, val, expect) => console.log((val != null && val !== '' && !(Array.isArray(val) && !val.length) ? '✓' : '✗ ขาด') + ' ' + label.padEnd(22) + '= ' + JSON.stringify(val) + (expect ? '   (คาด: ' + expect + ')' : ''))
	chk('customer_name', p.customer_name, 'สยามท่อดี')
	chk('job_name', p.job_name, 'แผ่นรองเครื่องมือช่าง')
	chk('print_type', p.print_type, 'Offset')
	chk('quantities', p.quantities, '(ไม่ระบุในสเปก)')
	chk('dimensions_mm', c0.dimensions_mm, 'W190 L260 ไม่มี height')
	chk('box_template_id', c0.box_template_id, '12 Custom (2 มิติ)')
	chk('paper_type', c0.paper_type, 'Duplex/แป้งหลังเทา')
	chk('paper_gram', c0.paper_gram, '350')
	chk('color_outside', c0.color_outside, '4')
	chk('color_inside', c0.color_inside, '1')
	chk('coatings', c0.coatings, 'Gloss Waterbase Hi-Rub 1 s')
	chk('color_limit_qty', p.color_limit_qty, '1 (ลิมิตสี 1 เล่ม)')
	chk('deliveries', p.deliveries, 'กรุงเทพ')
	console.log('\nหมายเหตุ: ไดคัท+แกะ = auto-handled (ไม่ขึ้น other_processes โดยตั้งใจ)')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
