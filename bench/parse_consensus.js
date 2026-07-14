// Consensus harness: รันแต่ละเคส 2 รอบ → เคสไหน "แกว่ง" (field ไม่ตรงกัน) ค่อยรอบ 3 → โหวต
//   ประหยัด token: เคสนิ่งจ่ายแค่ 2 รอบ, เฉพาะเคสก้ำกึ่งจ่าย 3 (+ system prompt ถูก cache)
//   แยก "AI ผิดจริง" (นิ่งแต่ผิด) ออกจาก "AI แกว่ง" (ไม่นิ่ง)
// node bench/parse_consensus.js [ไฟล์เคส]
const fs = require('fs')
const XLSX = require('xlsx')
const { runOne, R, norm, same } = require('./parse_testcases')

const val = (p, f) => (R[f] ? R[f](p) : null)
const TPL = { 1: 'RTE', 2: 'STE', 3: 'TTSLB', 4: 'TTAB', 5: 'Tray', 6: 'FrameTray', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'SealEnd', 12: 'Custom' }
const tplOf = (runs) => { const v = runs.map((p) => R.box_template(p)); const c = {}; v.forEach((x) => { const k = norm(x); c[k] = (c[k] || 0) + 1 }); const b = Object.entries(c).sort((a, z) => z[1] - a[1])[0]; const pick = v.find((x) => norm(x) === b[0]); return `${pick} ${TPL[pick] || ''}${b[1] === runs.length ? '' : ' ⚠(' + Object.entries(c).map(([k, n]) => `${k}×${n}`).join(' ') + ')'}` }

;(async () => {
  const cases = JSON.parse(fs.readFileSync(process.argv[2] || 'bench/parse_cases.json', 'utf8'))
  const xrows = [['No', 'Case', 'Field', 'Expected', 'Consensus', 'Votes', 'Stable', 'OK']]
  const byCase = [['No', 'สเปค (input เต็ม)', 'ทรงที่ AI เลือก', 'Expected', 'Real (AI)', 'ผล', 'ที่ไม่ตรง']]  // 1 แถว = 1 เคส
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
    // แถวสรุปต่อเคส (อ่านง่าย): สเปคเต็ม + expected/real ทุก field ในเซลล์เดียว
    const expStr = rows.map((r) => `${r[0]} = ${r[1]}`).join('\n')
    const realStr = rows.map((r) => `${r[0]} = ${r[2]}${String(r[4]).includes('แกว่ง') ? ' ⚠แกว่ง' : ''}`).join('\n')
    const mismatch = rows.filter((r) => r[5] === '✗').map((r) => `${r[0]}: ${r[1]} ≠ ${r[2]}`).join('\n') || '-'
    byCase.push([no, c.input, tplOf(runs), expStr, realStr, tag, mismatch])
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
  // ── ชีต 1: ByCase (อ่านง่าย 1 แถว/เคส, สเปคเต็มใน cell เดียว) ──
  const wsC = XLSX.utils.aoa_to_sheet(byCase)
  wsC['!cols'] = [{ wch: 4 }, { wch: 52 }, { wch: 16 }, { wch: 34 }, { wch: 34 }, { wch: 6 }, { wch: 34 }]
  for (const addr in wsC) {                       // เปิด wrap text ทุกเซลล์ (ให้ \n แสดงหลายบรรทัด)
    if (addr[0] === '!') continue
    wsC[addr].s = { alignment: { wrapText: true, vertical: 'top' } }
  }
  XLSX.utils.book_append_sheet(wb, wsC, 'ByCase')
  // ── ชีต 2: Detail (per field + votes/นิ่ง-แกว่ง) ──
  const ws = XLSX.utils.aoa_to_sheet(xrows)
  ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 4 }]
  XLSX.utils.book_append_sheet(wb, ws, 'Detail')
  XLSX.writeFile(wb, 'bench/parse_consensus.xlsx')
  try {                                            // polish ให้อ่านง่าย (wrap/freeze/สี FAIL) — optional
    require('child_process').execSync('python bench/polish_xlsx.py bench/parse_consensus.xlsx', { stdio: 'ignore' })
  } catch (e) { console.log('(ข้าม polish — ต้องมี python+openpyxl)') }
  console.log('รายละเอียด -> bench/parse_consensus.md + bench/parse_consensus.xlsx (ชีต ByCase = อ่านง่าย)')
})().catch((e) => { console.error(e); process.exit(1) })
