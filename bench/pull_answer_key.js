// ดึง "เฉลย" (รูปไดไลน์ + box_type ที่คนเลือกจริง) จากระบบ RFQ — ⚠️ READ-ONLY เท่านั้น
// วนทีละเดือน (กัน estimate/list ค้างเวลากรองช่วงกว้าง) + สะสม dedup
//
// อ่านอย่างเดียว: POST estimate/list (query) + POST estimate/rfq (โหลด job_data) — ไม่มี write/delete
// ไฟล์จริงอยู่ในเครื่อง (test/uploads) — server ลบแล้ว → match local ไม่ต้องโหลด
//
//   node bench/pull_answer_key.js --node_api http://192.168.5.3:3010 --token <t> --start 2022-01 --end 2023-12
//   ต่อ: node bench/ingest_labeled.js --src test/uploads --map answer_key/answer_map.csv --max 30

const fs = require('fs')
const path = require('path')

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] : d }
const NODE_API = (arg('--node_api') || '').replace(/\/+$/, '')
const TOKEN = arg('--token')
const OUT = arg('--out', './answer_key')
const USER_GROUP = arg('--user_group_id', '1')
const LOCAL_DIR = arg('--local', 'test/uploads')
const START = arg('--start', '2022-01') // YYYY-MM
const END = arg('--end', '2023-12')

if (!NODE_API || !TOKEN) { console.error('ใช้: --node_api <url> --token <t> [--start 2022-01] [--end 2023-12]'); process.exit(1) }
fs.mkdirSync(OUT, { recursive: true })
const H = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }

const req = async (u, o, ms = 30000) => { const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms); try { return await fetch(u, { ...o, signal: ac.signal }) } finally { clearTimeout(t) } }

// สร้างช่วงเดือน [{start_date,end_date}] จาก YYYY-MM ถึง YYYY-MM
function months(s, e) {
	const out = []; let [y, m] = s.split('-').map(Number); const [ey, em] = e.split('-').map(Number)
	while (y < ey || (y === ey && m <= em)) {
		const last = new Date(y, m, 0).getDate()
		out.push({ start_date: `${y}-${String(m).padStart(2, '0')}-01`, end_date: `${y}-${String(m).padStart(2, '0')}-${last}` })
		m++; if (m > 12) { m = 1; y++ }
	}
	return out
}

const mapLines = ['file,box_template,job_id,job_name']
const byT = {}, seen = new Set()
let pairs = 0, noTmpl = 0, noFile = 0, rfqFail = 0, notLocal = 0

async function pullMonth(range) {
	let rows = []
	try {
		const lr = await req(NODE_API + '/estimate/list', { method: 'POST', headers: H, body: JSON.stringify({ limit: 2000, est_type: 'packaging', user_group_id: USER_GROUP, search: { job_id: '', job_name: '', ae_name: '', customer_name: '', status_id: '', start_date: range.start_date, end_date: range.end_date } }) }, 120000)
		if (!lr.ok) { console.log('  [' + range.start_date + '] list ' + lr.status + ' ข้าม'); return }
		const ld = await lr.json(); rows = Array.isArray(ld[0]) ? ld[0] : (Array.isArray(ld) ? ld : [])
	} catch (e) { console.log('  [' + range.start_date + '] list ค้าง/พลาด ข้าม'); return }
	let mp = 0
	for (const row of rows) {
		let rfqId; try { rfqId = JSON.parse(row.log_data || '{}').job_id || row.job_id } catch (e) { rfqId = row.job_id }
		if (!rfqId) continue
		let job
		try {
			const rr = await req(NODE_API + '/estimate/rfq', { method: 'POST', headers: H, body: JSON.stringify({ type: 'common', rfq_id: rfqId }) })
			if (!rr.ok) { rfqFail++; continue }
			job = JSON.parse((await rr.json()).job_data || '{}')
		} catch (e) { rfqFail++; continue }
		const comps = job.component1 || job.components || []
		const bt = comps[0] && comps[0].box_type
		const tmpl = (bt && typeof bt === 'object' ? bt.type_id : bt) != null ? (bt && typeof bt === 'object' ? bt.type_id : bt) : (comps[0] && comps[0].box_template_id)
		const files = (job.fileUpload || []).filter((f) => f && (f.fileName || f.name))
		if (tmpl == null || !(Number(tmpl) >= 1 && Number(tmpl) <= 12)) { noTmpl++; continue }
		if (!files.length) { noFile++; continue }
		for (const f of files) {
			const fileName = f.fileName || f.name
			if (!/\.(jpe?g|png|pdf|webp)$/i.test(fileName) || seen.has(fileName)) continue
			seen.add(fileName)
			if (!fs.existsSync(path.join(LOCAL_DIR, fileName))) { notLocal++; continue }
			mapLines.push([fileName, tmpl, rfqId, String((job.job && job.job.job_name) || job.job_name || rfqId).replace(/,/g, ';')].join(','))
			byT[tmpl] = (byT[tmpl] || 0) + 1; pairs++; mp++
		}
	}
	console.log('  [' + range.start_date + '] RFQ=' + rows.length + ' → +' + mp + ' คู่ (รวม ' + pairs + ')')
	fs.writeFileSync(path.join(OUT, 'answer_map.csv'), mapLines.join('\n')) // เซฟทุกเดือน กันหาย
}

;(async () => {
	const ms = months(START, END)
	console.log('ดึง ' + ms.length + ' เดือน (' + START + ' → ' + END + ') read-only\n')
	for (const r of ms) await pullMonth(r)
	console.log('\n==== เสร็จ ====')
	console.log('คู่ (รูป+เฉลย) รวม: ' + pairs)
	console.log('ต่อทรง: ' + JSON.stringify(byT))
	console.log('ข้าม: ไม่มี template=' + noTmpl + ' | RFQ ไม่มีไฟล์=' + noFile + ' | rfq พลาด=' + rfqFail + ' | ไฟล์ไม่มีในเครื่อง=' + notLocal)
	console.log('map → ' + path.join(OUT, 'answer_map.csv') + ' (ไฟล์อยู่ ' + LOCAL_DIR + ')')
	console.log('\nต่อ: node bench/ingest_labeled.js --src "' + LOCAL_DIR + '" --map "' + path.join(OUT, 'answer_map.csv') + '" --max 30')
	process.exit(0)
})().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1) })
