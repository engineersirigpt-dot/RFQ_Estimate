// prototype: CLIP embedding + kNN บนเฉลยจริง 8,349 — จับทรงกล่อง (รันในเครื่อง ฟรี ไม่ยิง API)
//   train = answer_map (ยกเว้น held-out), cap TRAIN_PER/ทรง | test = held-out
//   cache embedding → answer_key/clip_emb.jsonl (รันซ้ำไม่ต้อง embed ใหม่)
// node bench/eval_clip.mjs [trainPerTemplate=80] [k=7]
import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from '@xenova/transformers'
import { Jimp } from 'jimp'
import fs from 'fs'
import path from 'path'
env.allowLocalModels = false

const TRAIN_PER = Number(process.argv[2] || 80)
const K = Number(process.argv[3] || 7)
const LOCAL = 'test/uploads'
const EMB_CACHE = 'answer_key/clip_emb.jsonl'
const MODEL = 'Xenova/clip-vit-base-patch32'
const TN = { 1: 'Reverse Tuck', 2: 'Straight Tuck', 3: 'Snap Lock', 4: 'Auto Bottom', 5: 'Tray', 6: 'Frame-Vue', 7: 'Bento', 8: 'Gable', 9: 'Sleeve', 10: 'Pillow', 11: 'Seal End', 12: 'Custom' }

// ---------- โหลด/แปลงรูป ----------
async function loadPng(fp) {
	let buf
	if (/\.pdf$/i.test(fp)) { const { pdf } = await import('pdf-to-img'); const doc = await pdf(fp, { scale: 2 }); for await (const p of doc) { buf = p; break } }
	else buf = fs.readFileSync(fp)
	const img = await Jimp.read(buf); const w = img.bitmap.width, h = img.bitmap.height
	if (Math.max(w, h) > 640) img.resize(w >= h ? { w: 640 } : { h: 640 })
	return img.getBuffer('image/png')
}

// ---------- cache embedding ----------
const cache = new Map()
if (fs.existsSync(EMB_CACHE)) for (const l of fs.readFileSync(EMB_CACHE, 'utf8').split('\n')) { if (!l.trim()) continue; try { const o = JSON.parse(l); cache.set(o.f, o.v) } catch (e) {} }
console.log('cache embedding เดิม:', cache.size, 'รูป')
const cacheStream = fs.createWriteStream(EMB_CACHE, { flags: 'a' })

let processor, vision
async function embed(file) {
	if (cache.has(file)) return cache.get(file)
	const fp = path.join(LOCAL, file)
	if (!fs.existsSync(fp)) return null
	let v
	try {
		const png = await loadPng(fp)
		const raw = await RawImage.fromBlob(new Blob([png]))
		const inputs = await processor(raw)
		const { image_embeds } = await vision(inputs)
		v = Array.from(image_embeds.data)
		// normalize (cosine = dot)
		const n = Math.hypot(...v); v = v.map(x => x / n)
	} catch (e) { return null }
	cache.set(file, v); cacheStream.write(JSON.stringify({ f: file, v }) + '\n')
	return v
}

// ---------- อ่าน answer_map + held-out ----------
function readRows() {
	const re = /^(.+\.(?:pdf|jpe?g|png|webp)),(\d{1,2}),/i, byT = {}
	for (const l of fs.readFileSync('answer_key/answer_map.csv', 'utf8').split(/\r?\n/).slice(1)) { const m = l.match(re); if (!m) continue; const f = m[1].trim(), t = Number(m[2]); if (!(t >= 1 && t <= 12)) continue; (byT[t] = byT[t] || []).push(f) }
	return byT
}
const held = fs.readFileSync('answer_key/heldout_map.tsv', 'utf8').split(/\r?\n/).filter(Boolean).map(l => { const i = l.lastIndexOf('\t'); return { file: l.slice(0, i), t: Number(l.slice(i + 1)) } })
const heldSet = new Set(held.map(h => h.file))

;(async () => {
	console.log('โหลด CLIP', MODEL, '...')
	processor = await AutoProcessor.from_pretrained(MODEL)
	vision = await CLIPVisionModelWithProjection.from_pretrained(MODEL)
	console.log('พร้อม ✓  train ≤' + TRAIN_PER + '/ทรง, k=' + K)

	// train set (ยกเว้น held-out)
	const byT = readRows()
	const train = []
	for (let t = 1; t <= 12; t++) {
		const files = (byT[t] || []).filter(f => !heldSet.has(f))
		let got = 0
		for (const f of files) { if (got >= TRAIN_PER) break; const v = await embed(f); if (v) { train.push({ file: f, t, v }); got++; if (train.length % 50 === 0) process.stdout.write('\r  embed train: ' + train.length) } }
	}
	console.log('\ntrain:', train.length, 'รูป | ต่อทรง:', JSON.stringify(train.reduce((a, x) => (a[x.t] = (a[x.t] || 0) + 1, a), {})))

	// test set (held-out)
	const test = []
	for (const h of held) { const v = await embed(h.file); if (v) test.push({ ...h, v }) }
	console.log('test (held-out):', test.length, 'รูป')

	// kNN
	function knn(v) {
		const sims = train.map(tr => ({ t: tr.t, s: dot(v, tr.v) }))
		sims.sort((a, b) => b.s - a.s)
		const top = sims.slice(0, K)
		const vote = {}; for (const x of top) vote[x.t] = (vote[x.t] || 0) + x.s // weighted by similarity
		return Number(Object.entries(vote).sort((a, b) => b[1] - a[1])[0][0])
	}
	function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s }

	let ok = 0, cTP = 0, cFN = 0, cFP = 0, cTN = 0
	const perT = {}
	console.log('\nไฟล์ | จริง | kNN ทำนาย')
	for (const it of test) {
		const pred = knn(it.v)
		const hit = pred === it.t
		if (hit) ok++
		perT[it.t] = perT[it.t] || { n: 0, ok: 0 }; perT[it.t].n++; if (hit) perT[it.t].ok++
		const trueCustom = it.t === 12, predCustom = pred === 12
		if (trueCustom) predCustom ? cTP++ : cFN++; else predCustom ? cFP++ : cTN++
		console.log('  ' + it.file.slice(0, 30).padEnd(31) + ' | ' + String(it.t).padEnd(4) + ' | ' + pred + (hit ? '✓' : '✗'))
	}
	const N = test.length, pct = (a, b) => b ? (100 * a / b).toFixed(0) + '%' : '-'
	console.log('\n==== ผล kNN (' + N + ' ใบ held-out) ====')
	console.log('12-way accuracy (จับทรงเป๊ะ): ' + ok + '/' + N + ' = ' + pct(ok, N))
	console.log('Custom recall (จับ custom ได้): ' + pct(cTP, cTP + cFN))
	console.log('Custom vs มาตรฐาน accuracy   : ' + pct(cTP + cTN, N))
	console.log('\nรายทรง:')
	for (let t = 1; t <= 12; t++) if (perT[t]) console.log('  ทรง ' + String(t).padEnd(2) + ' (' + TN[t] + '): ' + perT[t].ok + '/' + perT[t].n + ' = ' + pct(perT[t].ok, perT[t].n))
	cacheStream.end()
	console.log('\nembedding cache รวม:', cache.size, 'รูป (→ ' + EMB_CACHE + ')')
	process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
