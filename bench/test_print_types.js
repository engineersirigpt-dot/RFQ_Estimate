// เทส print_type detection: Flexo / Konica / Jet Press / machine-name → Offset
// (synthetic cases — ไม่มี sample จริง) เขียนผลลง bench/print_type_results.md
require('dotenv').config()
const fs = require('fs')
const Anthropic = require('@anthropic-ai/sdk')
process.env.AI_TEST = '1' // เปิด guarded test-exports ใน router/ai.js
const ai = require('../router/ai')
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 90000, maxRetries: 3 })
const MODEL = ai.MODEL || 'claude-sonnet-4-5'

// label, input, expected print_type, (optional) expected component type
const CASES = [
  ['Flexo-corrugated', 'กล่องลูกฟูก B-flute พิมพ์ Flexo 2 สี ขนาด W300 x L400 x H200 mm กระดาษ CA125/CA125 จำนวน 5000 / 10000', 'Flexo', 3],
  ['Konica-digital', 'งานพิมพ์ดิจิตอล Konica Minolta กระดาษอาร์ตการ์ด 300 แกรม พิมพ์ 4 สี ขนาด W80 x L120 x H40 mm จำนวน 500 / 1000', 'Konica', null],
  ['JetPress', 'พิมพ์ Jet Press 4 สี กระดาษอาร์ตการ์ด 350 แกรม ขนาด W100 x L150 x H50 mm จำนวน 2000 / 3000', 'Jet Press', null],
  ['Komori→Offset', 'พิมพ์ Komori 4 สี กระดาษกล่องแป้ง 350 แกรม ขนาด W90 x L130 x H45 mm จำนวน 5000 / 10000', 'Offset', null],
  ['Konica-7สี→clamp4', 'พิมพ์ Konica 7 สี กระดาษอาร์ตการ์ด 300 แกรม ขนาด W70 x L100 x H160 mm จำนวน 1000', 'Konica', null],
]

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

;(async () => {
  const md = ['# Print-type detection test', `model: ${MODEL}`, '']
  let pass = 0, fail = 0
  for (const [label, txt, expPrint, expType] of CASES) {
    try {
      const p = await runOne(txt)
      const c0 = (p.components || [])[0] || {}
      const okPrint = p.print_type === expPrint
      const okType = expType == null || Number(c0.type) === expType
      const ok = okPrint && okType
      ok ? pass++ : fail++
      const note = []
      if (!okPrint) note.push(`print=${p.print_type}≠${expPrint}`)
      if (!okType) note.push(`type=${c0.type}≠${expType}`)
      console.log(`${ok ? '✅' : '❌'} ${label.padEnd(22)} print=${p.print_type} type=${c0.type} color=${c0.color_outside}/${c0.color_inside}` + (note.length ? '  ⚠ ' + note.join(' ') : ''))
      md.push(`## ${label} — ${ok ? 'PASS' : 'FAIL'}`, `expect print=${expPrint}${expType != null ? ' type=' + expType : ''}`, '```json', JSON.stringify(p, null, 2), '```', '')
    } catch (e) { fail++; console.log(`❌ ${label}  ERROR ${e.message}`) }
  }
  fs.writeFileSync('bench/print_type_results.md', md.join('\n'), 'utf8')
  console.log(`\n=== ${pass} pass / ${fail} fail — detail: bench/print_type_results.md ===`)
})().catch((e) => { console.error(e); process.exit(1) })
