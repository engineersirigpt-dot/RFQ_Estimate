// คัดลอก master data JSON ที่มีอยู่จากโฟลเดอร์ "Pornchai AI RFQ" มาไว้ที่ seed/master/
// (เท่าที่มี — ครบ 22 type หรือไม่ขึ้นกับว่า cache ไว้แค่ไหน; ที่ขาดให้ export จาก prod เพิ่ม)
const fs = require('fs')
const path = require('path')

const DEST = path.join(__dirname, '..', 'seed', 'master')

// แหล่งที่อาจมี master data cache
const SOURCES = [
  path.join(__dirname, '..', '..', 'Pornchai AI RFQ', 'webapp', 'knowledge', 'legacy_system', 'master_data'),
  path.join(__dirname, '..', '..', 'Pornchai AI RFQ', 'agent-chat', 'knowledge'),
  path.join(__dirname, '..', '..', 'public', 'data'),
]

fs.mkdirSync(DEST, { recursive: true })

let copied = 0
for (const src of SOURCES) {
  if (!fs.existsSync(src)) continue
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.json')) continue
    const from = path.join(src, f)
    const to = path.join(DEST, f)
    try {
      // ตรวจว่า parse ได้ก่อนค่อยคัดลอก
      JSON.parse(fs.readFileSync(from, 'utf8'))
      fs.copyFileSync(from, to)
      console.log('✓ copied', f, 'จาก', path.basename(src))
      copied++
    } catch (e) {
      console.warn('× ข้าม', f, '(', e.message, ')')
    }
  }
}

console.log(`\nรวม ${copied} ไฟล์ → ${DEST}`)
console.log('master type ที่ frontend ต้องการ 22 ตัว:')
console.log('  paper_info, coating_info, corrugated_info, foilstamp_info, blockstamp_info,')
console.log('  price_info, min_price_info, waste_info, blockdiecut_info, boxtemplate_info,')
console.log('  specialink_info, specialink_factor_info, jetpress_waste_info, jetpress_info,')
console.log('  marking_price_info, machine_std_paper_info, delivery_rate_info, paper_code_type,')
console.log('  process_type, price_type, konica_waste_info, exchange_rate')
console.log('ตัวที่ขาด → export จาก prod (เรียก /estimate/master_data?type=<ตัวที่ขาด> ตอน login prod) แล้ววางที่ seed/master/<type>.json')
