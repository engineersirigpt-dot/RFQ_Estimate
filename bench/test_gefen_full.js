// End-to-end test through the REAL merged+edited router/ai.js pipeline
// (buildContentFromUpload → createWithRetry → extractJson → stripHallucinations
//  → validateAndFix) — exactly what /parse-spec runs. Image input.
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
const ai = require('../router/ai')

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })

const imgPath = process.argv[2] || path.join(__dirname, 'Screenshot 2026-06-12 145127.png')
const ext = path.extname(imgPath).toLowerCase().replace('.', '')
const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/png'

;(async () => {
  const files = [{ buffer: fs.readFileSync(imgPath), mimetype: mime, originalname: path.basename(imgPath) }]
  const content = await ai.buildContentFromUpload('', files)
  const msg = await ai.createWithRetry(client, {
    model: MODEL, max_tokens: 4000, temperature: 0,
    system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  let parsed = ai.extractJson(reply)
  parsed = await ai.stripHallucinations(parsed, '', files)
  parsed = ai.validateAndFix(parsed)
  const c0 = (parsed.components || [])[0] || {}
  console.log('\n=== FULL PIPELINE RESULT (image) ===')
  console.log('job_name      =', parsed.job_name)
  console.log('customer_name =', parsed.customer_name)
  console.log('paper_type    =', c0.paper_type, '| paper_gram =', c0.paper_gram)
  console.log('quantities    =', JSON.stringify(parsed.quantities))
  console.log('_uncertain    =', JSON.stringify(parsed._uncertain))
})().catch((e) => { console.error(e); process.exit(1) })
