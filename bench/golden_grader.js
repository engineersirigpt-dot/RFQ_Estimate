// Golden grader: รัน 20 เคสผ่าน AI pipeline ปัจจุบัน แล้วเทียบกับค่าที่ถูกต้อง
// (เฉพาะ field ที่ตัดสินได้ deterministic) — field กำกวมไม่ใส่ golden = ข้าม
// เขียนผลเต็มลง bench/golden_results.md, พ่นเฉพาะ mismatch + สรุปทาง stdout
require('dotenv').config()
const fs = require('fs')
const XLSX = require('xlsx')
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1' // เปิด guarded test-exports ใน router/ai.js
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

// label -> expected. dims = sorted [a,b,c]. omit a field = skip it.
const GOLD = {
  'TB26/148':  { dims: [76, 175, 350], color: 3 },
  'row6':      { dims: [69, 258, 343], color: 5 },
  'TS25/352':  { dims: [95, 112, 145], color: 8 },
  'E26050175': { gram: 350, color: 7, qty: 5 },
  'E26020706': { dims: [139, 212, 223], gram: 310, color: 6, qty: 9 },
  'E26020626': { dims: [65, 80, 180], gram: 270, color: 5, qty: 4 },
  'E26030773': { gram: 400, color: 4, qty: 3 },
  'E26030019': { dims: [72, 133, 260], gram: 310, color: 4 },
  'E26040347': { dims: [180, 260, 280], gram: 270, color: 6, qty: 4 },
  'E26050169': { gram: 300, color: 2, qty: 3 },
  'E26050144': { dims: [30, 95, 178], gram: 450, color: 7, qty: 4 },
  'E26050015': { dims: [160, 165, 230], gram: 300, qty: 7 },
  'E26050007': { dims: [28, 28, 124], gram: 350, color: 3, qty: 5 },
  'E26040652': { color: 4, qty: 8 },
  'E26040575': { dims: [50, 105, 230], gram: 250, color: 4 },
  'E26040535': { dims: [17, 72, 110], gram: 300, color: 5 },
  'E26040504': { color: 4, qty: 2 },
  'E26040236': { dims: [50, 85, 150], gram: 300, color: 5, qty: 7 },
  'E26030829': { gram: 300, color: 6, qty: 2 },
}

const file = fs.readdirSync('.').find((n) => n.startsWith('Test Case - AI Input') && n.endsWith('.xlsx'))
const rows = XLSX.utils.sheet_to_json(XLSX.readFile(file, { cellText: true }).Sheets['Test Case'], { header: 1, defval: '' })
const cases = []
for (let i = 5; i <= 24; i++) {
  let input = ''
  ;(rows[i] || []).forEach((c) => {
    const s = String(c).replace(/\s+/g, ' ').trim()
    if (s.length > input.length && !/^(AI Chat|ระบุถูกต้อง)/.test(s)) input = s
  })
  if (input.length > 20) {
    const m = input.match(/\b(E\d{8}|TB\d{2}\/\d+|TS\d{2}\/\d+)\b/)
    cases.push({ label: m ? m[1] : `row${i}`, input })
  }
}

async function runOne(txt) {
  const content = await ai.buildContentFromUpload(txt, [])
  const msg = await ai.createWithRetry(client, {
    model: MODEL, max_tokens: 4000, temperature: 0,
    system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
  let p = ai.extractJson(reply); p = await ai.stripHallucinations(p, txt, []); p = ai.validateAndFix(p)
  return p
}

function grade(label, p) {
  const g = GOLD[label]; if (!g) return { skip: true, miss: [] }
  const c0 = (p.components || [])[0] || {}
  const miss = []
  if (g.dims) {
    const d = c0.dimensions_mm || {}
    const got = [d.width, d.length, d.height].filter((x) => x != null).sort((a, b) => a - b)
    if (JSON.stringify(got) !== JSON.stringify(g.dims.slice().sort((a, b) => a - b))) miss.push(`dims=${JSON.stringify(got)}≠${JSON.stringify(g.dims)}`)
  }
  if (g.gram != null && Number(c0.paper_gram) !== g.gram) miss.push(`gram=${c0.paper_gram}≠${g.gram}`)
  if (g.color != null && Number(c0.color_outside) !== g.color) miss.push(`color=${c0.color_outside}≠${g.color}`)
  if (g.qty != null) {
    const q = (p.quantities || []).length || (p.f_codes || []).length
    if (q !== g.qty) miss.push(`qty=${q}≠${g.qty}`)
  }
  return { skip: false, miss }
}

;(async () => {
  const md = ['# Golden Grader Results', `model: ${MODEL}`, '']
  let pass = 0, fail = 0
  for (const c of cases) {
    try {
      const p = await runOne(c.input)
      const r = grade(c.label, p)
      const c0 = (p.components || [])[0] || {}
      const d = c0.dimensions_mm || {}
      md.push(`## ${c.label} — ${r.skip ? 'NO-GOLD' : r.miss.length ? 'FAIL' : 'PASS'}`)
      md.push(`dims=${[d.width, d.length, d.height].join('x')} gram=${c0.paper_gram} color=${c0.color_outside}/${c0.color_inside} tpl=${c0.box_template_id} qty=${(p.quantities || []).length || (p.f_codes || []).length} unc=[${(p._uncertain || []).join(',')}]`)
      if (r.miss.length) md.push('MISS: ' + r.miss.join(' | '))
      md.push('')
      if (r.skip) { console.log(`  -- ${c.label}  (no gold)`) }
      else if (r.miss.length) { fail++; console.log(`❌ ${c.label}  ${r.miss.join(' | ')}`) }
      else { pass++; console.log(`✅ ${c.label}`) }
    } catch (e) { fail++; console.log(`❌ ${c.label}  ERROR ${e.message}`) }
  }
  fs.writeFileSync('bench/golden_results.md', md.join('\n'), 'utf8')
  console.log(`\n=== ${pass} pass / ${fail} fail (graded) — detail: bench/golden_results.md ===`)
})().catch((e) => { console.error(e); process.exit(1) })
