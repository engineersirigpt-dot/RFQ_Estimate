// เทส /ai/explain-price: AI เลือก driver ถูกไหม + หลุดเลข (฿/%) ใน headline/why/qty_trend ไหม
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1' // เปิด guarded test-exports ใน router/ai.js
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 60000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

const SUMMARIES = [
  ['offset-paper-heavy', {
    qty: 5000, unit_price: 4.2, total: 21000,
    categories: { material: 12000, plate: 3200, print: 2800, proof: 500, afterpress: 1500, delivery: 1000, other: 0 },
    spec: { box_type: 'RTE', box_template_id: 1, size_mm: '80 x 120 x 40', paper: 'A/C', gram: 350, colors_outside: 4, colors_inside: 0, coating: 'Gloss OPP', print_type: 'Offset', ink: 'conventional', is_reprint: false, uv: false, markup_mode: 'Standard' },
    qty_tiers: [{ qty: 5000, unit_price: 4.2 }, { qty: 10000, unit_price: 3.1 }, { qty: 20000, unit_price: 2.5 }],
  }],
  ['foil-afterpress-heavy', {
    qty: 3000, unit_price: 9.8, total: 29400,
    categories: { material: 6000, plate: 2500, print: 2000, proof: 400, afterpress: 16000, delivery: 500, other: 0 },
    spec: { box_type: 'Seal End', box_template_id: 11, size_mm: '50 x 50 x 150', paper: 'อาร์ตการ์ด', gram: 300, colors_outside: 4, colors_inside: 0, coating: 'Matt OPP', print_type: 'Offset', ink: 'conventional', is_reprint: false, uv: false, markup_mode: 'Profit Sharing' },
    qty_tiers: [{ qty: 3000, unit_price: 9.8 }, { qty: 5000, unit_price: 7.5 }],
  }],
]

// ตรวจเลขเงิน/% หลุด (อนุญาต "350 แกรม", "3 สี" — จับเฉพาะ ฿/บาท/% ที่ติดเลข)
const MONEY_PCT = /(\d[\d,\.]*\s*(บาท|฿)|฿\s*\d|\d[\d,\.]*\s*%)/

async function run(summary) {
  const msg = await ai.createWithRetry(client, {
    model: MODEL, max_tokens: 1200, temperature: 0,
    system: [{ type: 'text', text: ai.EXPLAIN_PRICE_PROMPT }],
    messages: [{ role: 'user', content: 'ข้อมูลราคา (JSON):\n' + JSON.stringify(summary, null, 1) }],
  })
  const reply = msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
  return ai.extractJson(reply)
}

;(async () => {
  for (const [label, s] of SUMMARIES) {
    console.log('\n===== ' + label + ' =====')
    try {
      const r = await run(s)
      const topCats = Object.entries(s.categories).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k]) => k)
      console.log('headline:', r.headline)
      console.log('top categories (จริง):', topCats.slice(0, 3).join(' > '))
      console.log('drivers AI เลือก:', (r.drivers || []).map((d) => d.category).join(' > '))
      ;(r.drivers || []).forEach((d) => console.log('   - ' + d.category + ': ' + d.why))
      console.log('qty_trend:', r.qty_trend)
      console.log('reduce_tips:', JSON.stringify(r.reduce_tips))
      // ตรวจเลขหลุด
      const leaks = []
      if (MONEY_PCT.test(r.headline || '')) leaks.push('headline')
      if (MONEY_PCT.test(r.qty_trend || '')) leaks.push('qty_trend')
      ;(r.drivers || []).forEach((d, i) => { if (MONEY_PCT.test(d.why || '')) leaks.push('drivers[' + i + '].why') })
      console.log(leaks.length ? '⚠️  เลขหลุด (฿/%): ' + leaks.join(', ') : '✅ ไม่มีเลขเงิน/% หลุด')
      const firstOk = (r.drivers || [])[0] && (r.drivers[0].category === topCats[0])
      console.log(firstOk ? '✅ driver#1 ตรง top category' : '⚠️  driver#1 ไม่ตรง top category')
    } catch (e) { console.log('ERROR', e.message) }
  }
})().catch((e) => { console.error(e); process.exit(1) })
