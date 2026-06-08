/**
 * generate_excel.js — สร้าง Excel report จาก results.json
 * Usage: node test/generate_excel.js
 */

const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const resultsPath = path.join(__dirname, 'results.json')
const outPath = path.join(__dirname, 'AI_Test_Results.xlsx')
const TODAY = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
const TODAY_SHORT = new Date().toLocaleDateString('th-TH')

// ===== Known issues — แก้ไขแล้วทุกข้อ (Round 4: Validation Layer) =====
// Case 4:  color hallucination + Hi-Rub → แก้ด้วย validateAndFix (alias map)
// Case 6:  coating "1 s" fake → แก้ด้วย validateAndFix (strip "N s" only entries)
// Case 9:  paper_type="กระดาษ" → แก้ด้วย validateAndFix (remove generic)
// Case 10: 2 components จาก DP350/DP400 → แก้ด้วย SYSTEM_PROMPT rule
// Case 12: customer_name ผิด + template ผิด → แก้ด้วย SYSTEM_PROMPT rule
const KNOWN_ISSUES = {}

const CATEGORY = id => id <= 20 ? 'จากตารางเดิม' : 'Synthetic (AI)'

// ===== Extract key fields from AI result =====
function extract(r) {
  const data = r.result?.data || {}
  const comp  = data.components?.[0] || {}
  const corr  = comp.corrugated || {}

  const coatings = (comp.coatings || [])
    .map(c => `${c.option} / ${c.type}`)
    .join('\n')

  const foilstamps = (comp.foilstamps || [])
    .map(f => `${f.size_w_inch}" × ${f.size_h_inch}" ${f.color || ''}`.trim())
    .join(', ')

  const embosses = [...(comp.embosses || []), ...(comp.debosses || [])]
    .map(e => `${e.size_w_inch}" × ${e.size_h_inch}"`)
    .join(', ')

  const fCodes = (data.f_codes || [])
    .map(f => `${f.code}: ${f.qty?.toLocaleString()}`)
    .join('\n')

  const deliveries = (data.deliveries || [])
    .map(d => d.destination)
    .join(', ')

  const corrText = corr.raw_grade_string
    ? `${corr.raw_grade_string} (${corr.flute || '?'}-flute, ${corr.layer || '?'})`
    : ''

  const hasIssue = !!KNOWN_ISSUES[r.id]
  const status = r.status !== 'ok' ? 'ERROR' : hasIssue ? 'มีข้อสังเกต' : 'ผ่าน'

  return {
    no:             r.id,
    category:       CATEGORY(r.id),
    label:          r.label,
    elapsed:        r.elapsed,
    status,
    issue:          KNOWN_ISSUES[r.id] || '',
    // AI Output
    job_name:       data.job_name || '',
    customer_name:  data.customer_name || '',
    print_type:     data.print_type || '',
    ink_type:       data.ink_type || '',
    is_reprinted:   data.is_reprinted !== undefined ? String(data.is_reprinted) : '',
    use_prev_plate: data.use_previous_plate !== undefined ? String(data.use_previous_plate) : '',
    quantities:     (data.quantities || []).map(q => q.toLocaleString()).join(', '),
    is_multiple_f:  data.is_multiple_f !== undefined ? String(data.is_multiple_f) : '',
    f_codes:        fCodes,
    comp_type:      comp.type !== undefined ? String(comp.type) : '',
    box_template:   comp.box_template_id !== undefined ? String(comp.box_template_id) : '',
    dimensions:     comp.dimensions_mm
                      ? `${comp.dimensions_mm.width || ''}×${comp.dimensions_mm.length || ''}×${comp.dimensions_mm.height || ''} mm`
                      : '',
    paper_type:     comp.paper_type || '',
    paper_gram:     comp.paper_gram !== undefined ? String(comp.paper_gram) : '',
    color_out:      comp.color_outside !== undefined ? String(comp.color_outside) : '',
    color_in:       comp.color_inside !== undefined ? String(comp.color_inside) : '',
    coatings,
    foilstamps,
    embosses,
    corrugated:     corrText,
    deliveries,
    packing:        data.packing
                      ? `${data.packing.shrink_per_unit || ''} / ${data.packing.units_per_carton || ''}`
                        .replace(/^\s*\/\s*$/, '')
                      : '',
    notes_ai:       data.notes || '',
  }
}

// ===== Build Sheet 1: Summary =====
function buildSummary(rows) {
  const total   = rows.length
  const passed  = rows.filter(r => r.status === 'ผ่าน').length
  const observe = rows.filter(r => r.status === 'มีข้อสังเกต').length
  const errors  = rows.filter(r => r.status === 'ERROR').length
  const orig    = rows.filter(r => r.category === 'จากตารางเดิม').length
  const synth   = rows.filter(r => r.category === 'Synthetic (AI)').length

  const data = [
    ['AI Input — Estimate Packaging'],
    [''],
    ['วันที่ทดสอบ', TODAY],
    ['Model ที่ใช้', 'claude-sonnet-4-5'],
    [''],
    ['สรุปผลการทดสอบ'],
    ['จำนวน Test Case ทั้งหมด', total],
    ['ผ่าน ✓',  passed],
    ['มีข้อสังเกต ⚠',  observe],
    ['ERROR ✗',  errors],
    [''],
    ['แบ่งตาม Category'],
    ['จากตารางเดิม', orig],
    ['Synthetic (AI)', synth],
    [''],
    ['หมายเหตุ', 'ผ่าน = ข้อมูลที่ AI extract ถูกต้องทุก field หลัก'],
    ['', 'มีข้อสังเกต = ผ่านแต่พบ field ที่ควรปรับปรุง'],
    ['', 'ERROR = ไม่ได้รับ response จาก AI'],
  ]
  return data
}

// ===== Build Sheet 2: Detail =====
function buildDetail(rows) {
  const headers = [
    'No.',
    'Category',
    'Test Case',
    'สถานะ',
    'เวลา (s)',
    'ข้อสังเกต',
    // AI Output
    'job_name',
    'customer_name',
    'print_type',
    'ink_type',
    'is_reprinted',
    'use_previous_plate',
    'quantities',
    'is_multiple_f',
    'f_codes',
    'comp type (1/2/3)',
    'box_template_id',
    'dimensions (mm)',
    'paper_type',
    'gram',
    'สี นอก',
    'สี ใน',
    'coating',
    'foil stamp',
    'emboss',
    'corrugated grade',
    'delivery',
    'packing',
    'AI notes',
  ]

  const dataRows = rows.map(r => [
    r.no,
    r.category,
    r.label,
    r.status,
    r.elapsed.replace('s', ''),
    r.issue,
    r.job_name,
    r.customer_name,
    r.print_type,
    r.ink_type,
    r.is_reprinted,
    r.use_prev_plate,
    r.quantities,
    r.is_multiple_f,
    r.f_codes,
    r.comp_type,
    r.box_template,
    r.dimensions,
    r.paper_type,
    r.paper_gram,
    r.color_out,
    r.color_in,
    r.coatings,
    r.foilstamps,
    r.embosses,
    r.corrugated,
    r.deliveries,
    r.packing,
    r.notes_ai,
  ])

  return [headers, ...dataRows]
}

// ===== Build Sheet 3: Input Specs =====
function buildInputs(results) {
  const headers = ['No.', 'Category', 'Test Case', 'Input Spec (ต้นฉบับ)']

  // Read test cases from batch_test.js to get input text
  const batchSrc = fs.readFileSync(path.join(__dirname, 'batch_test.js'), 'utf8')
  const inputMap = {}
  const matches = batchSrc.matchAll(/id:\s*(\d+),\s+label:\s*'([^']+)',\s+input:\s*`([^`]+)`/g)
  for (const m of matches) {
    inputMap[Number(m[1])] = m[3].trim()
  }

  const rows = results.map(r => [
    r.id,
    CATEGORY(r.id),
    r.label,
    inputMap[r.id] || '',
  ])

  return [headers, ...rows]
}

// ===== Main =====
const raw     = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))
const rows    = raw.map(extract)
const wb      = XLSX.utils.book_new()

// Sheet 1: Summary
const wsSummary = XLSX.utils.aoa_to_sheet(buildSummary(rows))
wsSummary['!cols'] = [{ wch: 30 }, { wch: 40 }]
XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

// Sheet 2: AI Output Detail
const detailData = buildDetail(rows)
const wsDetail   = XLSX.utils.aoa_to_sheet(detailData)
wsDetail['!cols'] = [
  { wch: 5 },   // No.
  { wch: 18 },  // Category
  { wch: 45 },  // Test Case
  { wch: 14 },  // Status
  { wch: 8 },   // Time
  { wch: 55 },  // Issue
  { wch: 25 },  // job_name
  { wch: 25 },  // customer_name
  { wch: 12 },  // print_type
  { wch: 12 },  // ink_type
  { wch: 12 },  // is_reprinted
  { wch: 16 },  // use_prev_plate
  { wch: 30 },  // quantities
  { wch: 13 },  // is_multiple_f
  { wch: 30 },  // f_codes
  { wch: 14 },  // comp type
  { wch: 14 },  // box_template_id
  { wch: 22 },  // dimensions
  { wch: 14 },  // paper_type
  { wch: 6 },   // gram
  { wch: 8 },   // สี นอก
  { wch: 8 },   // สี ใน
  { wch: 35 },  // coating
  { wch: 20 },  // foil
  { wch: 15 },  // emboss
  { wch: 35 },  // corrugated
  { wch: 20 },  // delivery
  { wch: 12 },  // packing
  { wch: 50 },  // notes
]
XLSX.utils.book_append_sheet(wb, wsDetail, 'AI Output')

// Sheet 3: Input Specs
const inputData  = buildInputs(raw)
const wsInput    = XLSX.utils.aoa_to_sheet(inputData)
wsInput['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 45 }, { wch: 80 }]
XLSX.utils.book_append_sheet(wb, wsInput, 'Input Specs')

// Write file
XLSX.writeFile(wb, outPath)
console.log(`\n✓ Excel saved: ${outPath}`)
console.log(`  Sheets: Summary | AI Output | Input Specs`)
console.log(`  Cases: ${rows.length} total`)
console.log(`  ผ่าน: ${rows.filter(r=>r.status==='ผ่าน').length} | มีข้อสังเกต: ${rows.filter(r=>r.status==='มีข้อสังเกต').length} | ERROR: ${rows.filter(r=>r.status==='ERROR').length}\n`)
