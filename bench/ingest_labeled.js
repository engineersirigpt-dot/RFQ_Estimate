// เท "รูปเฉลย → template" เข้า router/labeled_dielines/<1-12>/ อัตโนมัติ
// ใช้เมื่อทีม export ประวัติ RFQ ที่มี (รูปไดไลน์ + box_template ที่คนเลือก)
//
// ต้องมี:
//   1) โฟลเดอร์รูปต้นทาง (--src)
//   2) ไฟล์ mapping CSV/TSV (--map) คอลัมน์:  <ชื่อไฟล์รูป> , <เลข template 1-12>
//      (มีหัวตารางหรือไม่มีก็ได้ — ข้ามแถวที่ template ไม่ใช่ 1-12)
//
// ตัวอย่าง:
//   node bench/ingest_labeled.js --src ./export_images --map ./export_map.csv --max 30
require('fs')
const fs = require('fs')
const path = require('path')

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const src = arg('--src')
const map = arg('--map')
const MAX = Number(arg('--max', 30)) // เก็บทรงละไม่เกินกี่ใบ (few-shot ไม่ต้องเยอะ)
const dest = path.join(__dirname, '..', 'router', 'labeled_dielines')

if (!src || !map) {
	console.error('ใช้: node bench/ingest_labeled.js --src <โฟลเดอร์รูป> --map <mapping.csv> [--max 30]')
	process.exit(1)
}

const lines = fs.readFileSync(map, 'utf8').split(/\r?\n/).filter((l) => l.trim())
const perT = {}
let ok = 0, skip = 0, miss = 0
for (const line of lines) {
	const parts = line.split(/[\t,]/).map((s) => s.trim().replace(/^"|"$/g, ''))
	// หา 2 ช่อง: ชื่อไฟล์ (มีนามสกุลรูป) + เลข template
	const file = parts.find((p) => /\.(jpe?g|png|pdf|webp)$/i.test(p))
	const tmpl = parts.map(Number).find((n) => Number.isInteger(n) && n >= 1 && n <= 12)
	if (!file || !tmpl) { skip++; continue }
	perT[tmpl] = perT[tmpl] || 0
	if (perT[tmpl] >= MAX) { skip++; continue }
	const s = path.join(src, file)
	if (!fs.existsSync(s)) { miss++; continue }
	const d = path.join(dest, String(tmpl))
	fs.mkdirSync(d, { recursive: true })
	fs.copyFileSync(s, path.join(d, file))
	perT[tmpl]++; ok++
}
console.log('เท labeled เข้า', dest)
console.log('  สำเร็จ:', ok, '| ข้าม(เกิน max/ไม่เข้าเกณฑ์):', skip, '| หาไฟล์ไม่เจอ:', miss)
console.log('  ต่อทรง:', JSON.stringify(perT))
console.log('\nจากนั้น: AI_FEWSHOT_DIELINES=1 แล้วรันเทสวัด accuracy')
