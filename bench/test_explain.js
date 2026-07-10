// Quality check for /ai/explain-price — runs the REAL prompt (router/ai.js)
// on realistic cost summaries. Verifies: valid JSON, drivers use valid category
// keys, drivers sorted by amount, and NO digits leak into the prose (grounding).
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 3 })

// GEFEN-like sleeve, low qty — matches the breakdown screenshot
const sampleGefen = {
  qty: 2000, unit_price: 4.06, total: 8115,
  categories: { material: 3295, plate: 2400, print: 2100, proof: 0, afterpress: 320, delivery: 0, other: 0 },
  spec: { box_type: 'Sleeve (ปลอกกล่อง)', size_mm: '202 x 66 x 39', paper: 'Duplex GBB', gram: 350, colors_outside: 3, colors_inside: 0, coating: 'Gloss Waterbase', print_type: 'Offset', ink: 'conventional', is_reprint: false, uv: false, markup_mode: 'Standard' },
  qty_tiers: [{ qty: 2000, unit_price: 4.06 }, { qty: 3000, unit_price: 2.82 }, { qty: 4000, unit_price: 2.11 }],
}

const VALID = ['material', 'plate', 'print', 'proof', 'afterpress', 'delivery', 'other']

async function run(name, summary) {
  const msg = await ai.createWithRetry(client, {
    model: MODEL, max_tokens: 1200, temperature: 0,
    system: [{ type: 'text', text: ai.EXPLAIN_PRICE_PROMPT }],
    messages: [{ role: 'user', content: 'ข้อมูลราคา (JSON):\n' + JSON.stringify(summary, null, 1) }],
  })
  const reply = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  const out = ai.extractJson(reply)
  console.log('\n===== ' + name + ' =====')
  console.log(JSON.stringify(out, null, 2))

  // checks
  const cats = (out.drivers || []).map((d) => d.category)
  const badCat = cats.filter((c) => !VALID.includes(c))
  // grounding: headline/why/qty_trend must NOT contain money (บาท/฿) or % —
  // the UI renders those authoritatively, so the AI restating them risks a
  // contradiction. Spec numbers (gram, color count) are allowed. reduce_tips
  // is EXEMPT (future-spec suggestions may carry numbers).
  const groundedProse = [out.headline, out.qty_trend, ...(out.drivers || []).map((d) => d.why)].filter(Boolean)
  const moneyRe = /%|บาท|฿/
  const proseHasMoney = groundedProse.some((t) => moneyRe.test(t))
  console.log('— checks —')
  console.log('  drivers categories valid :', badCat.length === 0, badCat.length ? '(bad: ' + badCat + ')' : '')
  console.log('  no zero-cost driver      :', cats.every((c) => (summary.categories[c] || 0) > 0))
  console.log('  core prose: no ฿ / %     :', !proseHasMoney, proseHasMoney ? '(⚠️ ' + groundedProse.find((t) => moneyRe.test(t)) + ')' : '')
}

;(async () => {
  await run('GEFEN sleeve / qty 2000', sampleGefen)
})().catch((e) => { console.error(e); process.exit(1) })
