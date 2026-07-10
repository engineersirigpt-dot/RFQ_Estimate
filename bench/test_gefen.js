// Repro: รันสเปก GEFEN จริง (text เท่านั้น) ผ่าน pipeline ของ user
// เช็คว่า AI ดึง paper_type / paper_gram จาก "DUPLEX 350 G" ออกมาไหม
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const user = require('./ai_user')

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })

const TEXT = `รบกวนขอราคา SLEEVE BOX ตามรายละเอียดด้านล่างค่ะ

SIZE 20.20x6.60x3.90CM
DUPLEX 350 G
WATER BASE
4 COLORS
ไดคัท ติดกาว
จำนวน
5,000 ใบ
6,000 ใบ
7,000 ใบ
8,000 ใบ
9,000 ใบ
10,000 ใบ
15,000 ใบ
20,000 ใบ`

;(async () => {
  const content = await user.buildContentFromUpload(TEXT, [])
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    temperature: 0,
    system: [{ type: 'text', text: user.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  console.log('=== RAW AI REPLY ===')
  console.log(reply)
  let parsed = user.extractJson(reply)
  parsed = user.validateAndFix(parsed)
  const c0 = (parsed.components || [])[0] || {}
  console.log('\n=== COMPONENT[0] ===')
  console.log(JSON.stringify(c0, null, 2))
  console.log('\n>>> paper_type =', c0.paper_type)
  console.log('>>> paper_gram =', c0.paper_gram)
})().catch((e) => { console.error(e); process.exit(1) })
