// แยก answer_map (comma-CSV) → few-shot + held-out เป็น TSV (กันชื่อไฟล์มี comma)
// parse robust: จับ "ชื่อไฟล์.pdf/jpg,เลขทรง," แม้ชื่อมี comma
// node bench/split_answer.js [mapCsv] [fewMax] [heldMax]
const fs = require('fs')
const path = require('path')

const MAP = process.argv[2] || 'answer_key/snapshot_map.csv'
const FEW = Number(process.argv[3] || 25)
const HELD = Number(process.argv[4] || 8)
const LOCAL = 'test/uploads'

const lines = fs.readFileSync(MAP, 'utf8').split(/\r?\n/).slice(1).filter((l) => l.trim())
const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i
const byT = {}
let bad = 0, missing = 0
for (const l of lines) {
	const m = l.match(re)
	if (!m) { bad++; continue }
	const file = m[1].trim(); const t = Number(m[2])
	if (!(t >= 1 && t <= 12)) { bad++; continue }
	if (!fs.existsSync(path.join(LOCAL, file))) { missing++; continue }
	;(byT[t] = byT[t] || []).push(file)
}

const fewLines = [], heldLines = []
const report = {}
for (const t of Object.keys(byT).sort((a, b) => a - b)) {
	const files = byT[t]
	report[t] = files.length
	files.slice(0, FEW).forEach((f) => fewLines.push(f + '\t' + t))
	files.slice(FEW, FEW + HELD).forEach((f) => heldLines.push(f + '\t' + t))
}
fs.writeFileSync('answer_key/fewshot_map.tsv', fewLines.join('\n'))
fs.writeFileSync('answer_key/heldout_map.tsv', heldLines.join('\n'))
console.log('parse: ดี ' + Object.values(byT).reduce((s, a) => s + a.length, 0) + ' | เพี้ยน ' + bad + ' | ไฟล์หาย ' + missing)
console.log('ต่อทรง (ทั้งหมด):', JSON.stringify(report))
console.log('few-shot: ' + fewLines.length + ' ใบ → answer_key/fewshot_map.tsv (≤' + FEW + '/ทรง)')
console.log('held-out: ' + heldLines.length + ' ใบ → answer_key/heldout_map.tsv (≤' + HELD + '/ทรง)')
