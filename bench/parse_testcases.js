// Test harness: parse spec (ข้อความ) -> เทียบ expected vs real ต่อ field
//   อ่านเคสจาก bench/parse_cases.json = [{ name, input, expected:{field:value} }]
//   รัน AI pipeline จริง (เหมือน production: buildContent -> Anthropic -> strip -> validate)
//   ออกตาราง field|expected|real|✓ + สรุป + เขียน bench/parse_results.md
// node bench/parse_testcases.js [ไฟล์เคส]
require('dotenv').config()
const fs = require('fs')
const XLSX = require('xlsx')
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1' // เปิด guarded test-exports ใน router/ai.js
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

// ── field resolver: expected key -> ดึงค่าจริงจากผล parse ── (เพิ่ม field ใหม่ที่นี่)
const c0 = (p) => (p.components || [])[0] || {}
const R = {
  dims:          (p) => { const d = c0(p).dimensions_mm || {}; return [d.width, d.length, d.height].filter((x) => x != null).sort((a, b) => a - b) },
  gram:          (p) => c0(p).paper_gram ?? null,
  paper_type:    (p) => c0(p).paper_type ?? null,
  comp_type:     (p) => c0(p).type ?? null,                          // 1=ไม่ประกบ 2=ประกบลูกฟูก 3=ลูกฟูกล้วน
  flute:         (p) => (c0(p).corrugated || {}).flute ?? null,
  color_out:     (p) => c0(p).color_outside ?? null,
  color_in:      (p) => c0(p).color_inside ?? null,
  box_template:  (p) => c0(p).box_template_id ?? null,
  print_type:    (p) => p.print_type ?? null,
  ink_type:      (p) => p.ink_type ?? null,
  qty:           (p) => (p.quantities || []).length || (p.f_codes || []).length,
  quantities:    (p) => p.quantities || [],
  coating:       (p) => (c0(p).coatings || []).map((x) => x.type).join(' | ') || null,
  foil:          (p) => (c0(p).foilstamps || []).length,
  emboss:        (p) => ((c0(p).embosses || []).length + (c0(p).debosses || []).length),
  glued_spots:   (p) => c0(p).glued_spots ?? null,
  is_multiple_f: (p) => p.is_multiple_f ?? false,
  f_codes:       (p) => (p.f_codes || []).length,
  reprint:       (p) => p.use_previous_plate ?? false,
  pack_pcs:      (p) => (p.packing || {}).shrink_per_unit ?? null,   // kraftwrap N pcs/pack
}
const norm = (v) => (Array.isArray(v) ? JSON.stringify(v.slice().sort((a, b) => (a > b ? 1 : -1))) : String(v))
// coating เทียบแบบ substring (real มีคำใน expected) กัน false-fail จาก '1 s' vs '1s' ฯลฯ
const same = (field, exp, got) => (field === 'coating'
  ? String(got).toLowerCase().includes(String(exp).toLowerCase())
  : norm(exp) === norm(got))

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

async function main() {
  const casesFile = process.argv[2] || 'bench/parse_cases.json'
  const cases = JSON.parse(fs.readFileSync(casesFile, 'utf8'))
  const md = [`# Parse Test Results`, `model: ${MODEL} · ${cases.length} cases`, '']
  const xrows = [['No', 'Case', 'Field', 'Expected', 'Real', 'OK']]
  let casePass = 0, fieldPass = 0, fieldTotal = 0, caseNo = 0
  for (const c of cases) {
    caseNo++
    let p, err = null
    try { p = await runOne(c.input) } catch (e) { err = e.message }
    const rows = []; let allOk = true
    for (const [field, exp] of Object.entries(c.expected || {})) {
      const got = err ? '(ERROR)' : (R[field] ? R[field](p) : '(no resolver)')
      const ok = !err && R[field] && same(field, exp, got)
      fieldTotal++; if (ok) fieldPass++; else allOk = false
      rows.push([field, JSON.stringify(exp), JSON.stringify(got), ok ? '✓' : '✗'])
    }
    if (allOk && !err) casePass++
    const head = `## ${c.name} — ${err ? 'ERROR: ' + err : allOk ? 'PASS' : 'FAIL'}`
    console.log('\n' + head)
    console.log('  field'.padEnd(16) + 'expected'.padEnd(22) + 'real'.padEnd(22) + 'ok')
    console.log('  ' + '-'.repeat(58))
    md.push(head, '', '| field | expected | real | ok |', '|---|---|---|---|')
    for (const [f, e, g, o] of rows) {
      console.log('  ' + f.padEnd(14) + e.padEnd(22) + String(g).padEnd(22) + o)
      md.push(`| ${f} | ${e} | ${g} | ${o} |`)
      xrows.push([caseNo, c.name, f, e, String(g), o])
    }
    md.push('')
  }
  const summary = `\n=== สรุป: ${casePass}/${cases.length} เคสผ่าน (ทุก field) · ${fieldPass}/${fieldTotal} field ถูก ===`
  console.log(summary)
  md.push(summary.trim())
  fs.writeFileSync('bench/parse_results.md', md.join('\n'), 'utf8')
  // ── เขียน Excel ── (Detail = ราย field, Summary = แถวบนสุด)
  const wb = XLSX.utils.book_new()
  xrows.push([], ['สรุป', `${casePass}/${cases.length} เคสผ่านทุก field`, `${fieldPass}/${fieldTotal} field ถูก`])
  const ws = XLSX.utils.aoa_to_sheet(xrows)
  ws['!cols'] = [{ wch: 4 }, { wch: 32 }, { wch: 14 }, { wch: 20 }, { wch: 20 }, { wch: 4 }]
  XLSX.utils.book_append_sheet(wb, ws, 'ExpectedVsReal')
  XLSX.writeFile(wb, 'bench/parse_results.xlsx')
  console.log('รายละเอียด -> bench/parse_results.md + bench/parse_results.xlsx')
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1) })
module.exports = { runOne, R, norm, same, MODEL, client }
