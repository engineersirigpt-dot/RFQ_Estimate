// Regression: รัน 20 text test cases จาก Excel ผ่าน AI pipeline ปัจจุบัน
// เขียนผลเต็มลง bench/regression_results.md, พ่นสรุปสั้นๆ ทาง stdout
// Usage: node bench/regression.js
require('dotenv').config()
const fs = require('fs')
const XLSX = require('xlsx')
const Anthropic = require('@anthropic-ai/sdk')
const ai = require('../router/ai')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'

// --- โหลดเคสจาก Excel: เอาเซลล์ที่ยาวสุดในแต่ละแถวเป็น input ---
const file = fs.readdirSync('.').find((n) => n.startsWith('Test Case - AI Input') && n.endsWith('.xlsx'))
const wb = XLSX.readFile(file, { cellText: true })
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
const cases = []
for (let i = 5; i <= 24; i++) {
  const r = rows[i] || []
  let input = '', status = ''
  r.forEach((c) => {
    const s = String(c).replace(/\s+/g, ' ').trim()
    if (s.length > input.length && !/^(AI Chat|ระบุถูกต้อง)/.test(s)) input = s
    if (/^(Pass|Fail)$/i.test(s)) status = s
  })
  if (input.length > 20) {
    const m = input.match(/\b(E\d{8}|TB\d{2}\/\d+|TS\d{2}\/\d+)\b/)
    cases.push({ row: i, label: m ? m[1] : `row${i}`, input, oldStatus: status })
  }
}
console.log(`โหลด ${cases.length} เคส | model ${MODEL}\n`)

async function runOne(c) {
  const content = await ai.buildContentFromUpload(c.input, [])
  const msg = await ai.createWithRetry(client, {
    model: MODEL, max_tokens: 4000, temperature: 0,
    system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
  let parsed = ai.extractJson(reply)
  parsed = await ai.stripHallucinations(parsed, c.input, [])
  parsed = ai.validateAndFix(parsed)
  return parsed
}

function summary(p) {
  const c0 = (p.components || [])[0] || {}
  const d = c0.dimensions_mm || {}
  const dim = [d.width, d.length, d.height].filter((x) => x != null).join('x') || '-'
  const cols = `${c0.color_outside != null ? c0.color_outside : '-'}/${c0.color_inside != null ? c0.color_inside : '-'}`
  const coat = (c0.coatings || []).length
  const foil = (c0.foilstamps || c0.foil || []).length
  const sink = (c0.special_inks || []).length
  const qty = (p.quantities || []).length || (p.f_codes || []).length
  const deli = (p.deliveries || []).length
  return { print: p.print_type || '-', tpl: c0.box_template_id != null ? c0.box_template_id : '-', dim, paper: c0.paper_type || '-', gram: c0.paper_gram || '-', cols, coat, foil, sink, qty, deli, unc: (p._uncertain || []).join(',') || '-' }
}

;(async () => {
  const md = ['# Regression Results', `model: ${MODEL}`, `date(row date col is excel serial)`, '']
  const tableHdr = 'CASE'.padEnd(13) + 'PRINT'.padEnd(9) + 'TPL'.padEnd(5) + 'DIM(mm)'.padEnd(16) + 'PAPER'.padEnd(10) + 'GRM'.padEnd(6) + 'COL'.padEnd(7) + 'coat/foil/sink'.padEnd(16) + 'qty'.padEnd(5) + 'deli'.padEnd(6) + 'old'
  console.log(tableHdr)
  console.log('-'.repeat(tableHdr.length))
  for (const c of cases) {
    try {
      const p = await runOne(c)
      const s = summary(p)
      console.log(
        c.label.padEnd(13) + String(s.print).slice(0, 8).padEnd(9) + String(s.tpl).padEnd(5) + s.dim.padEnd(16) +
        String(s.paper).slice(0, 9).padEnd(10) + String(s.gram).padEnd(6) + s.cols.padEnd(7) +
        `${s.coat}/${s.foil}/${s.sink}`.padEnd(16) + String(s.qty).padEnd(5) + String(s.deli).padEnd(6) + (c.oldStatus || '-')
      )
      md.push(`## ${c.label} (row ${c.row}) — old status: ${c.oldStatus || '-'}`)
      md.push('**INPUT:**', '```', c.input, '```')
      md.push('**OUTPUT:**', '```json', JSON.stringify(p, null, 2), '```', '')
    } catch (e) {
      console.log(c.label.padEnd(13) + 'ERROR: ' + e.message)
      md.push(`## ${c.label} (row ${c.row}) — ERROR`, '```', e.message, '```', '')
    }
  }
  fs.writeFileSync('bench/regression_results.md', md.join('\n'), 'utf8')
  console.log('\nเขียนผลเต็มลง bench/regression_results.md แล้ว')
})().catch((e) => { console.error(e); process.exit(1) })
