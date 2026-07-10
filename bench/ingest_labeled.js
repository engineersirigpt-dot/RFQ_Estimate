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
const fs = require('fs')
const path = require('path')

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const src = arg('--src')
const map = arg('--map')
const MAX = Number(arg('--max', 30)) // เก็บทรงละไม่เกินกี่ใบ (few-shot ไม่ต้องเยอะ)
const MAXPX = 1568 // ย่อรูปยาวสุดที่ 1568px — เท่าที่ Anthropic ย่อเองพอดี, และ ≤2000px
//   (กฎ many-image request >20 รูป บังคับทุกรูป ≤2000px มิเช่นนั้น 400)
const dest = path.join(__dirname, '..', 'router', 'labeled_dielines')

if (!src || !map) {
	console.error('ใช้: node bench/ingest_labeled.js --src <โฟลเดอร์รูป> --map <mapping.csv> [--max 30]')
	process.exit(1)
}

// jimp = ย่อรูป, pdf-to-img = แปลง PDF→รูป (ไดไลน์ส่วนใหญ่เป็น PDF, loader อ่านแค่ jpg/png)
let Jimp = null, pdfToImg = null
try { Jimp = require('jimp').Jimp } catch (e) { console.warn('เตือน: ไม่มี jimp → ไม่ย่อ. ติดตั้ง: npm install jimp --no-save') }

async function loadImgBuffer(srcPath) {
	if (/\.pdf$/i.test(srcPath)) {
		if (!pdfToImg) pdfToImg = (await import('pdf-to-img')).pdf
		const doc = await pdfToImg(srcPath, { scale: 2 })
		for await (const page of doc) return page // หน้าแรกพอ
		throw new Error('PDF ว่าง')
	}
	return fs.readFileSync(srcPath)
}

// แปลง(ถ้า PDF) + ย่อ ≤MAXPX → เซฟเป็น .jpg
async function placeImage(srcPath, destPath) {
	const dest = destPath.replace(/\.(png|webp|pdf)$/i, '.jpg')
	if (!Jimp) { fs.copyFileSync(srcPath, destPath); return }
	const img = await Jimp.read(await loadImgBuffer(srcPath))
	const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > MAXPX) img.resize(w >= h ? { w: MAXPX } : { h: MAXPX })
	fs.writeFileSync(dest, await img.getBuffer('image/jpeg', { quality: 82 }))
}

;(async () => {
	const lines = fs.readFileSync(map, 'utf8').split(/\r?\n/).filter((l) => l.trim())
	const perT = {}
	let ok = 0, skip = 0, miss = 0
	for (const line of lines) {
		const parts = line.split('\t').map((s) => s.trim().replace(/^"|"$/g, '')) // TSV — กันชื่อไฟล์มี comma
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
		try { await placeImage(s, path.join(d, file)); perT[tmpl]++; ok++ } catch (e) { console.warn('ข้าม (อ่านรูปไม่ได้): ' + file); skip++ }
	}
	console.log('เท labeled เข้า', dest, '(ย่อ ≤' + MAXPX + 'px)')
	console.log('  สำเร็จ:', ok, '| ข้าม:', skip, '| หาไฟล์ไม่เจอ:', miss)
	console.log('  ต่อทรง:', JSON.stringify(perT))
	console.log('\nจากนั้น: AI_FEWSHOT_DIELINES=1 แล้วรันเทสวัด accuracy')
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1) })
