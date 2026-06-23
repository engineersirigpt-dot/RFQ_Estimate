// Repro: ป้อน "รูป" GEFEN เข้า pipeline ของ user (เลียนแบบ path อัปโหลดไฟล์รูป)
// เทียบกับ test_gefen.js (path ข้อความ) — ดูว่าทำไมรูปดึง paper/quantities ไม่ออก
// วางไฟล์รูปไว้ที่ bench/gefen.png (หรือส่ง path เป็น arg: node bench/test_gefen_image.js path/to/img)
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
const user = require('./ai_user')

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })

const imgPath = process.argv[2] || path.join(__dirname, 'gefen.png')
if (!fs.existsSync(imgPath)) {
  console.error('ไม่พบไฟล์รูป:', imgPath, '\nวางไฟล์ที่ bench/gefen.png หรือส่ง path เป็น argument')
  process.exit(1)
}
const ext = path.extname(imgPath).toLowerCase().replace('.', '')
const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'

;(async () => {
  // เลียนแบบ object ที่ multer ส่งให้ buildContentFromUpload (มี buffer/mimetype/originalname)
  const file = { buffer: fs.readFileSync(imgPath), mimetype: mime, originalname: path.basename(imgPath) }
  const content = await user.buildContentFromUpload('', [file])
  const payload = {
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: 'text', text: user.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  }
  // Opus 4.7+/Fable ไม่รับ temperature (deprecated) — ส่งเฉพาะรุ่นเก่า (เหมือน router/ai.js)
  if (!/opus-4-[789]|fable|mythos/i.test(MODEL)) payload.temperature = 0
  const msg = await client.messages.create(payload)
  const reply = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  console.log('=== RAW AI REPLY (image path) ===')
  console.log(reply)
  let parsed = user.extractJson(reply)
  parsed = user.validateAndFix(parsed)
  const c0 = (parsed.components || [])[0] || {}
  console.log('\n=== CHECK ===')
  console.log('paper_type =', c0.paper_type)
  console.log('paper_gram =', c0.paper_gram)
  console.log('quantities =', JSON.stringify(parsed.quantities))
})().catch((e) => { console.error(e); process.exit(1) })
