// Consensus harness: รันแต่ละเคส 2 รอบ → เคสไหน "แกว่ง" (field ไม่ตรงกัน) ค่อยรอบ 3 → โหวต
//   ประหยัด token: เคสนิ่งจ่ายแค่ 2 รอบ, เฉพาะเคสก้ำกึ่งจ่าย 3 (+ system prompt ถูก cache)
//   แยก "AI ผิดจริง" (นิ่งแต่ผิด) ออกจาก "AI แกว่ง" (ไม่นิ่ง)
// node bench/parse_consensus.js [ไฟล์เคส]
const fs = require('fs')
const XLSX = require('xlsx')
const { runOne, R, norm, same } = require('./parse_testcases')

const val = (p, f) => (R[f] ? R[f](p) : null)

;(async () => {
  const cases = JSON.parse(fs.readFileSync(process.argv[2] || 'bench/parse_cases.json', 'utf8'))
  const xrows = [['No', 'Case', 'Field', 'Expected', 'Consensus', 'Votes', 'Stable', 'OK']]
  const md = ['# Parse Consensus Results', '']
  let casePass = 0, fieldPass = 0, fieldTotal = 0, flaky = 0, totalRuns = 0, no = 0
  for (const c of cases) {
    no++
    const fields = Object.keys(c.expected || {})
    const runs = [await runOne(c.input), await runOne(c.input)]           // 2 รอบก่อน
    const agree = fields.every((f) => norm(val(runs[0], f)) === norm(val(runs[1], f)))
    if (!agree) runs.push(await runOne(c.input))                          // แกว่ง → รอบ 3
    totalRuns += runs.length
    let allOk = true, anyFlaky = false
    const rows = []
    for (const f of fields) {
      const vals = runs.map((p) => val(p, f))
      const counts = {}
      vals.forEach((v) => { const k = norm(v); counts[k] = (counts[k] || 0) + 1 })
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      const consensus = vals.find((v) => norm(v) === sorted[0][0])         // เสียงข้างมาก
      const stable = sorted[0][1] === runs.length
      const votes = sorted.map(([k, n]) => `${k}×${n}`).join(' ')
      const ok = same(f, c.expected[f], consensus)
      fieldTotal++; if (ok) fieldPass++; else allOk = false
      if (!stable) { flaky++; anyFlaky = true }
      rows.push([f, JSON.stringify(c.expected[f]), JSON.stringify(consensus), votes, stable ? 'นิ่ง' : '⚠️แกว่ง', ok ? '✓' : '✗'])
      xrows.push([no, c.name, f, JSON.stringify(c.expected[f]), JSON.stringify(consensus), votes, stable ? 'นิ่ง' : 'แกว่ง', ok ? '✓' : '✗'])
    }
    if (allOk) casePass++
    const tag = allOk ? 'PASS' : 'FAIL'
    console.log(`\n## ${c.name} — ${tag} (${runs.length} รอบ)${anyFlaky ? ' ⚠️มี field แกว่ง' : ''}`)
    console.log('  field'.padEnd(16) + 'expected'.padEnd(18) + 'consensus'.padEnd(18) + 'votes'.padEnd(16) + 'stable ok')
    for (const [f, e, cs, v, st, o] of rows) console.log('  ' + f.padEnd(14) + e.padEnd(18) + String(cs).padEnd(18) + v.padEnd(16) + st.padEnd(9) + o)
    md.push(`## ${c.name} — ${tag} (${runs.length} รอบ)`, '', '| field | expected | consensus | votes | stable | ok |', '|---|---|---|---|---|---|')
    for (const [f, e, cs, v, st, o] of rows) md.push(`| ${f} | ${e} | ${cs} | ${v} | ${st} | ${o} |`)
    md.push('')
  }
  const naive = cases.length * 3
  const summary = `\n=== สรุป: ${casePass}/${cases.length} เคสผ่าน · ${fieldPass}/${fieldTotal} field · ${flaky} field แกว่ง · ใช้ ${totalRuns} รอบ (แทน ${naive} ถ้ารัน 3 ทุกเคส = ประหยัด ${Math.round((1 - totalRuns / naive) * 100)}%) ===`
  console.log(summary)
  md.push(summary.trim())
  fs.writeFileSync('bench/parse_consensus.md', md.join('\n'), 'utf8')
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.aoa_to_sheet(xrows)
  ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 4 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Consensus')
  XLSX.writeFile(wb, 'bench/parse_consensus.xlsx')
  console.log('รายละเอียด -> bench/parse_consensus.md + bench/parse_consensus.xlsx')
})().catch((e) => { console.error(e); process.exit(1) })
