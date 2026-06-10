// ดึง master data ทั้ง 22 type จาก prod node_api → เก็บลง seed/master/<type>.json
// รันบนเครื่องที่เข้าถึง prod ได้:  node scripts/export-from-prod.js
// อัปเดตข้อมูลใหม่จาก prod ก็รันซ้ำได้ตลอด
const fs = require('fs')
const path = require('path')
const http = require('http')

const PROD = process.env.PROD_NODE_API || 'http://192.168.5.3:3010'
const DEST = path.join(__dirname, '..', 'seed', 'master')

// type → query string (บางตัวต้องมี &estimate_type=packaging ตาม frontend)
const TYPES = [
  ['paper_info', 'paper_info&estimate_type=packaging'],
  ['coating_info', 'coating_info&estimate_type=packaging'],
  ['corrugated_info', 'corrugated_info&estimate_type=packaging'],
  ['foilstamp_info', 'foilstamp_info'],
  ['blockstamp_info', 'blockstamp_info'],
  ['price_info', 'price_info'],
  ['min_price_info', 'min_price_info'],
  ['waste_info', 'waste_info'],
  ['blockdiecut_info', 'blockdiecut_info'],
  ['boxtemplate_info', 'boxtemplate_info'],
  ['specialink_info', 'specialink_info'],
  ['specialink_factor_info', 'specialink_factor_info'],
  ['jetpress_waste_info', 'jetpress_waste_info'],
  ['jetpress_info', 'jetpress_info'],
  ['marking_price_info', 'marking_price_info'],
  ['machine_std_paper_info', 'machine_std_paper_info'],
  ['delivery_rate_info', 'delivery_rate_info'],
  ['paper_code_type', 'paper_code_type'],
  ['process_type', 'process_type'],
  ['price_type', 'price_type'],
  ['konica_waste_info', 'konica_waste_info'],
  ['exchange_rate', 'exchange_rate'],
]

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 15000 }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (e) { reject(new Error('parse: ' + e.message)) }
      })
    }).on('error', reject).on('timeout', function () { this.destroy(new Error('timeout')) })
  })
}

;(async () => {
  fs.mkdirSync(DEST, { recursive: true })
  console.log('ดึงจาก prod:', PROD, '\n')
  let ok = 0, fail = 0
  for (const [name, query] of TYPES) {
    try {
      const data = await get(`${PROD}/estimate/master_data?type=${query}`)
      const arr = Array.isArray(data) ? data : (data?.data || [])
      fs.writeFileSync(path.join(DEST, `${name}.json`), JSON.stringify(arr))
      console.log(`✓ ${name.padEnd(24)} ${arr.length} rows`)
      ok++
    } catch (e) {
      console.log(`✗ ${name.padEnd(24)} ERROR: ${e.message}`)
      fail++
    }
  }
  console.log(`\nเสร็จ: สำเร็จ ${ok} / ล้มเหลว ${fail}  → ${DEST}`)
})()
