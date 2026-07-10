// วิเคราะห์ root cause: ทำไม Claude อ่าน Happy Jim เป็น 4 (ก้นล็อก) แทน 1 (ฝาเสียบสลับ)
// ถาม Claude ให้บรรยายโครงสร้างบน/ล่าง + เหตุผล 1 vs 4 (ไม่ใช่ classify เฉยๆ)
require('dotenv').config()
process.env.AI_TEST = '1'
const fs = require('fs')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')
const { Jimp } = require('jimp')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 120000, maxRetries: 3 })

async function b64(fp, max = 1500) {
	const img = await Jimp.read(fs.readFileSync(fp)); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > max) img.resize(w >= h ? { w: max } : { h: max })
	return (await img.getBuffer('image/jpeg', { quality: 85 })).toString('base64')
}

;(async () => {
	const ref1 = await b64('public/img/1.jpg')
	const ref4 = await b64('public/img/4.jpg')
	const hj = await b64('test/messageImage_1783407667263.jpg')

	const SYS = 'You are a folding-carton die-line expert. Template 1 = Reverse Tuck End (both top AND bottom close with a simple TUCK flap; no glue at the bottom). Template 4 = Tuck Top Auto Bottom (top is a tuck flap, but the BOTTOM is a crash-lock / auto-lock bottom that is GLUED — the bottom flaps have diagonal fold lines and glue, so the box pops open with a locked bottom). The decisive difference is the BOTTOM: simple tuck flap = Template 1; glued diagonal auto-lock = Template 4.'
	const content = [
		{ type: 'text', text: 'Reference — Template 1 (Reverse Tuck End):' },
		{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ref1 } },
		{ type: 'text', text: 'Reference — Template 4 (Tuck Top Auto Bottom, glued auto-lock bottom):' },
		{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: ref4 } },
		{ type: 'text', text: 'Now THIS die-line to analyse (Happy Jim Rose Cider, 10x6x12 cm):' },
		{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: hj } },
		{ type: 'text', text: 'Answer in Thai, concise:\n1) บรรยายฝา"บน"สุด: เป็นฝาเสียบ (tuck) หรืออย่างอื่น?\n2) บรรยายฝา"ล่าง"สุด: เป็นฝาเสียบธรรมดา หรือ ก้นล็อกทากาวมีเส้นทแยง (auto-lock)? ดูเส้นพับทแยง/ตำแหน่งทากาวที่ก้น\n3) สรุปว่าเป็น Template 1 หรือ 4 พร้อมเหตุผลที่ตัดสินจาก"ก้น"\n4) ความมั่นใจ (%) และถ้าไม่ชัด บอกว่าอะไรทำให้สับสน' }
	]
	const msg = await ai.createWithRetry(client, { model: 'claude-opus-4-8', max_tokens: 1200, system: SYS, messages: [{ role: 'user', content }] })
	console.log(msg.content.filter(x => x.type === 'text').map(x => x.text).join('\n'))
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
