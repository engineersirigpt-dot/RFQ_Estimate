// สร้างไฟล์ HTML โชว์ "เฉลยจริง" — รูปไดไลน์จริง + เลขทรงที่วิศวกรเลือก (เปิดให้เฮียดู)
// อ่านอย่างเดียว: answer_key/answer_map.csv + รูปใน test/uploads → ฝังเป็น data URI
// node bench/make_proof_gallery.js [perTemplate=2]
const fs = require('fs'), path = require('path')
const { Jimp } = require('jimp')

const PER = Number(process.argv[2] || 2)
const LOCAL = 'test/uploads'
const TN = {
	1: 'Reverse Tuck End (ฝาเสียบสลับ)', 2: 'Straight Tuck End (ฝาเสียบตรง)',
	3: 'Tuck Top Snap Lock Bottom', 4: 'Tuck Top Auto Bottom (ก้นทากาว)',
	5: 'Tray (ถาด)', 6: 'Frame-Vue Tray', 7: 'Bento Tray+Lid', 8: 'Gable Top (มีหูหิ้ว)',
	9: 'Sleeve (ปลอก เปิด 2 ด้าน)', 10: 'Pillow Box', 11: 'Seal End (ฝาทากาว)', 12: 'Custom (ไม่เข้าทรงมาตรฐาน 1-11)'
}

const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),([^,]*),(.*)$/i
const rows = fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1).filter(l => l.trim())
const byT = {}
for (const l of rows) {
	const m = l.match(re); if (!m) continue
	const file = m[1].trim(), t = Number(m[2]), job = m[3].trim(), name = (m[4] || '').trim()
	if (!(t >= 1 && t <= 12)) continue
	// เอาเฉพาะไฟล์รูป (ฝังง่าย ไม่ต้องแปลง PDF) ที่มีในเครื่อง
	if (!/\.(jpe?g|png|webp)$/i.test(file)) continue
	if (!fs.existsSync(path.join(LOCAL, file))) continue
	;(byT[t] = byT[t] || []).push({ file, job, name })
}

async function thumb(fp, max = 460) {
	const img = await Jimp.read(fs.readFileSync(fp))
	const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > max) img.resize(w >= h ? { w: max } : { h: max })
	return 'data:image/jpeg;base64,' + (await img.getBuffer('image/jpeg', { quality: 78 })).toString('base64')
}

;(async () => {
	let cards = ''
	const total = rows.length
	for (let t = 1; t <= 12; t++) {
		const list = (byT[t] || []).slice(0, PER)
		for (const it of list) {
			let uri; try { uri = await thumb(path.join(LOCAL, it.file)) } catch (e) { continue }
			cards += `<div class="card"><div class="badge">ทรง ${t}</div><img src="${uri}" loading="lazy"><div class="meta"><div class="tn">${TN[t]}</div><div class="job">${it.job} — ${it.name.replace(/</g, '&lt;')}</div></div></div>\n`
		}
	}
	const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>เฉลยทรงกล่อง จากระบบ RFQ จริง</title>
<style>
*{box-sizing:border-box}body{font-family:'Segoe UI','Sarabun',sans-serif;margin:0;background:#f4f5f7;color:#1a2233}
header{background:#0d2440;color:#fff;padding:22px 28px}
header h1{margin:0 0 6px;font-size:22px}header p{margin:3px 0;opacity:.85;font-size:14px}
.stat{display:inline-block;background:#1a3a5c;border-radius:8px;padding:6px 14px;margin:8px 8px 0 0;font-size:14px}
.stat b{color:#4fd1c5;font-size:18px}
.note{background:#fff;border-left:4px solid #4fd1c5;margin:18px 28px;padding:14px 18px;font-size:14px;border-radius:0 8px 8px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;padding:6px 28px 40px}
.card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);position:relative}
.card img{width:100%;height:200px;object-fit:contain;background:#fafbfc;border-bottom:1px solid #eef0f3}
.badge{position:absolute;top:10px;left:10px;background:#0d2440;color:#fff;font-weight:700;font-size:13px;padding:4px 10px;border-radius:6px;z-index:2}
.meta{padding:10px 12px}.tn{font-weight:600;font-size:14px;color:#0d2440}.job{font-size:12px;color:#6b7688;margin-top:3px;line-height:1.4}
</style></head><body>
<header>
<h1>📦 เฉลยทรงกล่อง (box template) — จากระบบ RFQ จริง</h1>
<p>แต่ละรูป = ไดไลน์ที่ลูกค้าส่งมาจริง · เลขทรง = สิ่งที่วิศวกรของเราเลือกเองตอนทำใบเสนอราคา</p>
<p>ดึงจากระบบแบบอ่านอย่างเดียว (READ-ONLY) ไม่แก้ไขฐานข้อมูล · งานปี 2022–2023</p>
<div>
<span class="stat"><b>${total.toLocaleString()}</b> คู่ (รูป + เฉลย)</span>
<span class="stat"><b>12</b> ประเภททรง</span>
<span class="stat">ใช้สอน AI + วัดความแม่น</span>
</div>
</header>
<div class="note"><b>อ่านยังไง:</b> มุมซ้ายบนแต่ละรูปคือ <b>เลขทรง (1–12)</b> ที่วิศวกรเลือก เช่น "ทรง 1 = Reverse Tuck End" — นี่คือคำตอบของคน ไม่ใช่ AI เดา · ด้านล่างรูปนี้แสดงแค่ตัวอย่าง ${PER} รูป/ทรง (ของจริงมีหลักพัน)</div>
<div class="grid">
${cards}</div>
</body></html>`
	const out = 'answer_key/เฉลย-box-template.html'
	fs.writeFileSync(out, html)
	console.log('เขียน:', out, '(' + (html.length / 1024 | 0) + ' KB)')
	console.log('เปิด: ดับเบิลคลิกไฟล์ หรือ start "" "' + out + '"')
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
