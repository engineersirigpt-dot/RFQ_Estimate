// P0 — วัด "CV จับตอน Claude ผิดได้ไหม" (4-quadrant Claude vs CV) ตามเกณฑ์ที่ debate สรุป
// Claude = endpoint จริง (/ai/parse-spec), CV = kNN บน CLIP embedding (cache), gold = production label (proxy)
// ต้องมี server local 3099 + answer_key/clip_emb.jsonl
// node bench/p0_measure.js
const fs = require('fs'), path = require('path')
const BASE = 'http://localhost:3099', COOKIE = 'accessToken=test.local; emp_id=Admin'
const K = 7
const mimeOf = f => /\.png$/i.test(f) ? 'image/png' : /\.pdf$/i.test(f) ? 'application/pdf' : 'image/jpeg'

// labels
const reMap = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, lbl = {}
for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(reMap); if (m) { const t = +m[2]; if (t >= 1 && t <= 12) lbl[m[1].trim()] = t } }
// held-out
const held = fs.readFileSync('answer_key/heldout_map.tsv', 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.lastIndexOf('\t'); return { file: l.slice(0, i), t: +l.slice(i + 1) } })
const heldSet = new Set(held.map(h => h.file))
// embeddings → train / test
const emb = {}
for (const l of fs.readFileSync('answer_key/clip_emb.jsonl', 'utf8').split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); emb[o.f] = o.v } catch (e) {} }
const train = []
for (const f in emb) { if (!heldSet.has(f) && lbl[f]) train.push({ t: lbl[f], v: emb[f] }) }
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }
function cvPredict(v) { const s = train.map(tr => ({ t: tr.t, s: dot(v, tr.v) })).sort((a, b) => b.s - a.s).slice(0, K); const vote = {}; for (const x of s) vote[x.t] = (vote[x.t] || 0) + x.s; return +Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0] }

async function claudePredict(file) {
	const fp = path.join('test/uploads', file); if (!fs.existsSync(fp)) return null
	const fd = new FormData(); fd.append('files', new Blob([fs.readFileSync(fp)], { type: mimeOf(file) }), file)
	const r = await fetch(BASE + '/ai/parse-spec', { method: 'POST', headers: { Cookie: COOKIE }, body: fd })
	const j = await r.json().catch(() => ({})); const c = (j.data && j.data.components && j.data.components[0]) || {}
	return c.box_template_id != null ? +c.box_template_id : null
}

;(async () => {
	const rows = []
	console.log('ยิง Claude + CV เทียบ gold (' + held.length + ' รูป)...\n')
	for (const h of held) {
		if (!emb[h.file]) continue
		const cv = cvPredict(emb[h.file])
		let cl; try { cl = await claudePredict(h.file) } catch (e) { cl = null }
		if (cl == null) continue
		rows.push({ file: h.file, gold: h.t, claude: cl, cv })
	}
	// ===== metrics =====
	function report(name, subset) {
		const R = rows.filter(subset); const n = R.length; if (!n) { console.log('\n[' + name + '] ไม่มีข้อมูล'); return }
		const agree = R.filter(r => r.claude === r.cv)
		const disagree = R.filter(r => r.claude !== r.cv)
		const claudeWrong = R.filter(r => r.claude !== r.gold)
		const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-'
		// P(correct|agree): ตอนเห็นตรงกัน ถูกกี่ %
		const agreeCorrect = agree.filter(r => r.claude === r.gold).length
		// false-comfort: ตอน agree แต่ผิด (ทั้งคู่ผิดเหมือนกัน)
		const falseComfort = agree.filter(r => r.claude !== r.gold).length
		// disagreement-recall on Claude errors: ตอน Claude ผิด CV disagree กี่ %
		const flagged = claudeWrong.filter(r => r.cv !== r.claude).length
		// เมื่อ disagree ใครถูก
		const disClaudeRight = disagree.filter(r => r.claude === r.gold).length
		const disCvRight = disagree.filter(r => r.cv === r.gold).length
		console.log('\n=== ' + name + ' (' + n + ' รูป) ===')
		console.log('  Claude ถูกเดี่ยว : ' + pct(R.filter(r => r.claude === r.gold).length, n) + ' | CV ถูกเดี่ยว: ' + pct(R.filter(r => r.cv === r.gold).length, n))
		console.log('  เห็นตรงกัน(agree): ' + agree.length + '/' + n + ' | เห็นต่าง(disagree): ' + disagree.length + '/' + n)
		console.log('  P(ถูก | agree)   : ' + pct(agreeCorrect, agree.length) + '   ← agree เชื่อได้แค่ไหน')
		console.log('  false-comfort    : ' + pct(falseComfort, agree.length) + '   ← agree แต่ผิด (อันตราย)')
		console.log('  🎯 CV จับ Claude-ผิด: ' + pct(flagged, claudeWrong.length) + '  (' + flagged + '/' + claudeWrong.length + ')  ← ตัวชี้ขาด flagger')
		console.log('  ตอน disagree ใครถูก: Claude ' + disClaudeRight + ' | CV ' + disCvRight + ' | ไม่มีใครถูก ' + (disagree.length - disClaudeRight - disCvRight))
	}
	report('ทั้งหมด', () => true)
	report('tuck-family (gold 1/2/4)', r => [1, 2, 4].includes(r.gold))
	// custom axis (binary)
	const cr = rows.map(r => ({ cl: r.claude === 12, cv: r.cv === 12, gold: r.gold === 12 }))
	const cAgree = cr.filter(x => x.cl === x.cv), cWrong = cr.filter(x => x.cl !== x.gold)
	const pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-'
	console.log('\n=== แกน Custom vs มาตรฐาน (binary) ===')
	console.log('  Claude custom-acc: ' + pct(cr.filter(x => x.cl === x.gold).length, cr.length) + ' | CV custom-acc: ' + pct(cr.filter(x => x.cv === x.gold).length, cr.length))
	console.log('  P(ถูก | agree)   : ' + pct(cAgree.filter(x => x.cl === x.gold).length, cAgree.length))
	console.log('  🎯 CV จับ Claude-ผิด(custom axis): ' + pct(cWrong.filter(x => x.cv !== x.cl).length, cWrong.length))

	fs.writeFileSync('answer_key/p0_result.json', JSON.stringify(rows, null, 1))
	console.log('\nบันทึกดิบ → answer_key/p0_result.json')
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
