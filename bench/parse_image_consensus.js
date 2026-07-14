// Image RFQ test — AI อ่าน "รูป" (ไดไลน์/RFQ) แทน text → เทียบ expected vs real (consensus)
//   mirror production: Opus (IMAGE_MODEL), buildContentFromUpload('',[file]), strip/validate/duplex
//   Excel ByCase โชว์ "รูปจริง" ในเซลล์ (แทน text) — polish_xlsx.py ฝังรูป
// node bench/parse_image_consensus.js [ไฟล์เคส]
const fs = require('fs'), path = require('path')
const XLSX = require('xlsx')
process.env.AI_TEST = '1'
const ai = require('../router/ai')
const { R, norm, same, client } = require('./parse_testcases')

async function runOneImage(imgPath) {
  const buffer = fs.readFileSync(imgPath)
  const lo = imgPath.toLowerCase()
  const mime = lo.endsWith('.png') ? 'image/png' : lo.endsWith('.pdf') ? 'application/pdf' : lo.endsWith('.webp') ? 'image/webp' : 'image/jpeg'
  const file = { mimetype: mime, originalname: path.basename(imgPath), buffer }
  const content = await ai.buildContentFromUpload('', [file])
  const msg = await ai.createWithRetry(client, {
    model: ai.IMAGE_MODEL, max_tokens: 4000,               // Opus: ไม่ใส่ temperature/thinking (ตาม production)
    system: [{ type: 'text', text: ai.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  const reply = msg.content.filter((x) => x.type === 'text').map((x) => x.text).join('\n')
  let p = ai.extractJson(reply)
  p = await ai.stripHallucinations(p, '', [file])
  p = ai.validateAndFix(p, '')
  p = ai.inferDuplexFromDP(p, '')
  return p
}
const val = (p, f) => (R[f] ? R[f](p) : null)
const TPL = { 1: 'RTE', 2: 'STE', 3: 'TTSLB', 4: 'TTAB', 5: 'Tray', 6: 'FrameTray', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'SealEnd', 12: 'Custom' }
const consensusOf = (vals) => { const c = {}; vals.forEach((v) => { const k = norm(v); c[k] = (c[k] || 0) + 1 }); const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; return { pick: vals.find((v) => norm(v) === best), votes: Object.entries(c).map(([k, n]) => `${k}×${n}`).join(' '), stable: Object.keys(c).length === 1 } }
// "โชว์ทุกช่อง" — dump ทุก field ที่ AI กรอกได้ (มีค่า=ค่า, ไม่มี= -)
const ALLF = ['box_template', 'dims', 'comp_type', 'flute', 'gram', 'paper_type', 'color_out', 'color_in', 'print_type', 'ink_type', 'coating', 'foil', 'emboss', 'glued_spots', 'quantities', 'is_multiple_f', 'f_codes', 'reprint', 'pack_pcs']
const dash = (v) => (v == null || v === '' || v === false || (Array.isArray(v) && !v.length)) ? '-' : (Array.isArray(v) ? JSON.stringify(v) : String(v))
const fullOut = (runs) => ALLF.map((f) => `${f} = ${dash(consensusOf(runs.map((p) => (R[f] ? R[f](p) : null))).pick)}`).join('\n')

;(async () => {
  const cases = JSON.parse(fs.readFileSync(process.argv[2] || 'bench/parse_image_cases.json', 'utf8'))
  const xrows = [['No', 'Case', 'Field', 'Expected', 'Consensus', 'Votes', 'Stable', 'OK']]
  const byCase = [['No', 'รูป (image)', 'Case', 'ทรงที่ AI เลือก', 'Expected (เช็ค)', 'AI กรอก (ทุกช่อง)', 'ผล', 'ที่ไม่ตรง', '_imgpath']]
  let casePass = 0, fieldPass = 0, fieldTotal = 0, flaky = 0, totalRuns = 0, no = 0
  for (const c of cases) {
    no++
    if (!fs.existsSync(c.image)) { console.log(`## ${c.name} — ไม่พบรูป ${c.image}`); continue }
    const fields = Object.keys(c.expected || {})
    const runs = [await runOneImage(c.image), await runOneImage(c.image)]
    const agree = fields.every((f) => norm(val(runs[0], f)) === norm(val(runs[1], f)))
    if (!agree) runs.push(await runOneImage(c.image))
    totalRuns += runs.length
    let allOk = true; const rows = []
    for (const f of fields) {
      const vals = runs.map((p) => val(p, f))
      const counts = {}; vals.forEach((v) => { const k = norm(v); counts[k] = (counts[k] || 0) + 1 })
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
      const consensus = vals.find((v) => norm(v) === sorted[0][0])
      const stable = sorted[0][1] === runs.length
      const ok = same(f, c.expected[f], consensus)
      fieldTotal++; if (ok) fieldPass++; else allOk = false
      if (!stable) flaky++
      rows.push([f, JSON.stringify(c.expected[f]), JSON.stringify(consensus), sorted.map(([k, n]) => `${k}×${n}`).join(' '), stable ? 'นิ่ง' : '⚠️แกว่ง', ok ? '✓' : '✗'])
      xrows.push([no, c.name, f, JSON.stringify(c.expected[f]), JSON.stringify(consensus), sorted.map(([k, n]) => `${k}×${n}`).join(' '), stable ? 'นิ่ง' : 'แกว่ง', ok ? '✓' : '✗'])
    }
    if (allOk) casePass++
    const tag = allOk ? 'PASS' : 'FAIL'
    // ทรงที่ AI เลือก (output หลักของรูป) — consensus จากทุกรอบ + ชื่อทรง + votes ถ้าแกว่ง
    const tpl = consensusOf(runs.map((p) => R.box_template(p)))
    const tplStr = `${tpl.pick} ${TPL[tpl.pick] || ''}${tpl.stable ? '' : ' ⚠(' + tpl.votes + ')'}`
    const expStr = rows.map((r) => `${r[0]} = ${r[1]}`).join('\n')
    const realStr = fullOut(runs)   // โชว์ทุกช่องที่ AI อ่านจากรูปได้
    const mismatch = rows.filter((r) => r[5] === '✗').map((r) => `${r[0]}: ${r[1]} ≠ ${r[2]}`).join('\n') || '-'
    byCase.push([no, '', c.name, tplStr, expStr, realStr, tag, mismatch, c.image])   // col2 ว่างไว้ให้ polish ฝังรูป
    console.log(`\n## ${no}. ${c.name} — ${tag} (${runs.length} รอบ) · ทรง=${tplStr}`)
    for (const [f, e, cs, v, st, o] of rows) console.log('  ' + f.padEnd(14) + e.padEnd(10) + String(cs).padEnd(10) + v.padEnd(12) + st.padEnd(9) + o)
  }
  const naive = cases.length * 3
  console.log(`\n=== สรุป: ${casePass}/${cases.length} เคสผ่าน · ${fieldPass}/${fieldTotal} field · ${flaky} แกว่ง · ${totalRuns} รอบ (แทน ${naive}) ===`)
  const wb = XLSX.utils.book_new()
  const wsC = XLSX.utils.aoa_to_sheet(byCase)
  wsC['!cols'] = [{ wch: 4 }, { wch: 42 }, { wch: 24 }, { wch: 16 }, { wch: 28 }, { wch: 28 }, { wch: 6 }, { wch: 28 }, { wch: 2 }]
  XLSX.utils.book_append_sheet(wb, wsC, 'ByCase')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(xrows), 'Detail')
  XLSX.writeFile(wb, 'bench/parse_image_results.xlsx')
  try { require('child_process').execSync('python bench/polish_xlsx.py bench/parse_image_results.xlsx --images', { stdio: 'ignore' }) }
  catch (e) { console.log('(ข้าม polish/ฝังรูป — ต้องมี python+openpyxl+Pillow)') }
  console.log('รายละเอียด -> bench/parse_image_results.xlsx (ชีต ByCase มีรูปฝังในเซลล์)')
})().catch((e) => { console.error(e); process.exit(1) })
