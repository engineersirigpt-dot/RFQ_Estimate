// Proxy to diecuttemplates.com Dielines API.
// Generates production-ready dielines (SVG/PDF/DXF) for the user's box specs.
//
// Docs: https://www.diecuttemplates.com/docs/api/
// Auth: Bearer <API_KEY> + header "Dielines-Api-Version: 1.0"

const express = require('express')
const fs = require('fs')
const path = require('path')
const router = express.Router()

const BASE_URL = process.env.DIECUTTEMPLATES_BASE_URL || 'https://sandbox.api.diecuttemplates.com'
const API_KEY = process.env.DIECUTTEMPLATES_API_KEY

// ===== Local SVG (ทรงที่เซฟไว้แล้ว — เสิร์ฟไฟล์ตรงๆ ไม่ยิง API/ไม่เสีย quota) =====
// box_template_id → ชื่อไฟล์ใน _dieline_3d_bundle/3D_Dieline/ (3D fold engine)
const LOCAL_SVG_DIR = process.env.LOCAL_DIELINE_DIR || path.join(__dirname, '..', '_dieline_3d_bundle', '3D_Dieline')
const LOCAL_SVG = {
	'1': '01-Reverse Tuck End2.svg',
	'2': '02-Straight Tuck End.svg',
	'3': '03-Tuck Top Snap Lock.svg',
	'4': '04-Tuck Top Auto Bottom.svg',
	'5': '05-Shirt Box Tray01.svg',
	'6': '06-Frame Vue Tray.svg',
	'7': '07-Tray Lid.svg',
	'8': '08-Gable Top with Auto Bottom.svg',
	'9': '09-Sleeve.svg',
	'10': '10-Pillow Box.svg',
	'11': '11-Standard Box.svg'
}
function localSvgPath(internalId) {
	const f = LOCAL_SVG[String(internalId)]
	if (!f) return null
	const p = path.join(LOCAL_SVG_DIR, f)
	return fs.existsSync(p) ? p : null
}
// อ่านขนาดแผ่น (mm) จากข้อความในไฟล์ — เอา 2 ค่าใหญ่สุด
function localSvgDims(p) {
	try {
		const txt = fs.readFileSync(p, 'utf8')
		const nums = (txt.match(/([\d.]+)\s*mm/g) || []).map((s) => parseFloat(s)).sort((a, b) => b - a)
		if (nums.length >= 2) return { width: nums[1], height: nums[0], unit: 'mm' }
	} catch (e) {}
	return {}
}

// Map our internal box_template_id (1-12) → diecuttemplates template IDs.
// IDs are best-effort matches based on packaging conventions. User can
// override via the modal (Phase 2). Tested IDs come from
// https://www.diecuttemplates.com/dielines
//
// Layout of internal templates (per default.js + estimate.ejs):
//   1  Reverse Tuck End (ฝาเสียบสลับ — standard small box)
//   2  Straight Tuck End (ฝาเสียบตรง)
//   3  Tuck End with side glue
//   4  Auto-bottom / Crash-lock (ก้นล็อก)
//   5  Tuck Top Auto Bottom (ฝาบนล่างก้นล็อก)
//   6  กรอบ — Frame / Display box
//   7  Polygonal / hexagonal
//   8  Polygonal alt — "ที่จับ" (handle)
//   9  Sleeve / Wraparound
//   10 Sleeve alt
//   11 Special (matches depth=dust)
//   12 Custom / Flat
const TEMPLATE_MAP = {
	'1': { id: 'becf-10301', name: 'Reverse Tuck End', group: 'Tuck End Boxes' },
	'2': { id: 'becf-10302', name: 'Straight Tuck End', group: 'Tuck End Boxes' },
	'3': { id: 'becf-10303', name: 'Tuck End with glue', group: 'Tuck End Boxes' },
	'4': { id: 'becf-11104', name: 'Tuck Top Auto Bottom', group: 'Auto Bottom' },
	'5': { id: 'becf-11106', name: 'Snap Lock Bottom', group: 'Auto Bottom' },
	'6': { id: 'becf-11703', name: 'Tray Box', group: 'Tray Boxes' },
	'7': { id: 'becf-11108', name: 'Polygonal Box', group: 'Polygonal' }, // best guess
	'8': { id: 'becf-1110a', name: 'Polygonal alt', group: 'Polygonal' }, // best guess
	'9': { id: 'becf-10304', name: 'Sleeve (fallback to Tuck)', group: 'Sleeve' }, // best guess
	'10': { id: 'becf-10305', name: 'Sleeve alt', group: 'Sleeve' }, // best guess
	'11': { id: 'becf-10311', name: 'Special tuck', group: 'Special' }, // best guess
	'12': { id: 'becf-10301', name: 'Custom (fallback to Tuck End)', group: 'Custom' }
}

function authHeaders() {
	return {
		Authorization: 'Bearer ' + API_KEY,
		'Dielines-Api-Version': '1.0',
		Accept: 'application/json'
	}
}

// In-memory cache for generated dielines (key = tplId|format|variables hash).
// Avoids hitting API for identical requests within the process lifetime.
const generateCache = new Map()
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

function cacheKey(tplId, format, vars) {
	const keys = Object.keys(vars).sort()
	const norm = keys.map((k) => k + '=' + vars[k]).join('|')
	return tplId + '|' + format + '|' + norm
}
function cacheGet(key) {
	const entry = generateCache.get(key)
	if (!entry) return null
	if (Date.now() - entry.t > CACHE_TTL_MS) {
		generateCache.delete(key)
		return null
	}
	return entry.v
}
function cacheSet(key, value) {
	generateCache.set(key, { t: Date.now(), v: value })
}

function ensureConfigured(res) {
	if (!API_KEY) {
		res.status(500).json({
			success: false,
			error: 'ยังไม่ได้ตั้งค่า DIECUTTEMPLATES_API_KEY ใน .env'
		})
		return false
	}
	return true
}

// GET /dieline/map-info — returns the TEMPLATE_MAP for the frontend so it can
// show which diecuttemplates template will be used for each internal id.
router.get('/map-info', (req, res) => {
	res.json({ success: true, map: TEMPLATE_MAP })
})

// GET /dieline/debug-path — แสดง path ที่ router ใช้จริง (debug only)
router.get('/debug-path', (req, res) => {
	const p6 = path.join(LOCAL_SVG_DIR, '06-Frame Vue Tray.svg')
	res.json({
		LOCAL_SVG_DIR,
		file6_exists: fs.existsSync(p6),
		file6_path: p6,
		files: (() => { try { return fs.readdirSync(LOCAL_SVG_DIR) } catch(e) { return 'ERROR: ' + e.message } })()
	})
})

// GET /dieline/local/:type — เสิร์ฟ SVG ที่เซฟไว้ในเครื่อง (3D ใช้ตัวนี้ → โฟลเดอร์ 2D_Dieline)
router.get('/local/:type', (req, res) => {
	const p = localSvgPath(req.params.type)
	if (!p) return res.status(404).json({ success: false, error: 'ไม่มี local SVG สำหรับทรงนี้' })
	res.set('Content-Type', 'image/svg+xml')
	res.set('Cache-Control', 'no-cache')
	res.sendFile(p)
})

// GET /dieline/v2svg/:type — เสิร์ฟ SVG สำหรับ 2D dieline (v2) แยกจาก 3D → โฟลเดอร์ _dieline_3d_bundle/2D-Diline_svg
const V2_SVG_DIR = process.env.V2_DIELINE_DIR || path.join(__dirname, '..', '_dieline_3d_bundle', '2D-Diline_svg')
const V2_SVG = {
	'1': '01-Reverse Tuck End.svg',
	'2': '02-Straight Tuck End.svg',
	'3': '03-Tuck Top Snap Lock.svg',
	'4': '04-Tuck Top Auto Bottom.svg',
	'5': '05-Shirt Box Tray.svg',
	'6': '06-Frame Vue Tray.svg',
	'7': '07-Tray Lid.svg',
	'8': '08-Gable Top with Auto Bottom.svg',
	'9': '09-Sleeve.svg',
	'10': '10-Pillow Box.svg',
	'11': '11-Standard Box.svg'
}
router.get('/v2svg/:type', (req, res) => {
	const f = V2_SVG[String(req.params.type)]
	let p = f ? path.join(V2_SVG_DIR, f) : null
	if (!p || !fs.existsSync(p)) p = localSvgPath(req.params.type)   // fallback → 3D_Dieline ถ้าไม่มีใน 2D-Diline_svg
	if (!p) return res.status(404).json({ success: false, error: 'ไม่มี v2 SVG สำหรับทรงนี้' })
	res.set('Content-Type', 'image/svg+xml')
	res.set('Cache-Control', 'no-cache')
	res.sendFile(p)
})

// GET /dieline/template-info?template_id=becf-10301
// Returns the template metadata so frontend knows which variables to send.
router.get('/template-info', async (req, res) => {
	if (!ensureConfigured(res)) return
	const tplId = String(req.query.template_id || '').trim()
	if (!tplId) return res.status(400).json({ success: false, error: 'ต้องระบุ template_id' })

	try {
		const r = await fetch(BASE_URL + '/dieline-templates/mm/' + encodeURIComponent(tplId), {
			method: 'GET',
			headers: authHeaders()
		})
		if (!r.ok) {
			const txt = await r.text()
			return res.status(r.status).json({ success: false, error: txt || r.statusText, status: r.status })
		}
		const data = await r.json()
		res.json({ success: true, data })
	} catch (err) {
		console.error('[dieline] template-info error:', err)
		res.status(500).json({ success: false, error: err.message || 'unknown error' })
	}
})

// Translate common Turkish/English error fragments to Thai for our users.
function translateErrorMessage(msg) {
	if (!msg) return ''
	const translations = [
		[/flap ölçüsü en az ([\d.]+)mm olmalıdır/i, 'ปีกกล่อง (dust flap) ต้องไม่น้อยกว่า $1 mm'],
		[/tuck ölçüsü en az ([\d.]+)mm olmalıdır/i, 'ฝา (tuck flap) ต้องไม่น้อยกว่า $1 mm'],
		[/en az ([\d.]+)mm olmalıdır/i, 'ต้องไม่น้อยกว่า $1 mm'],
		[/en fazla ([\d.]+)mm olabilir/i, 'ต้องไม่เกิน $1 mm'],
		[/must be at least ([\d.]+) ?mm/i, 'ต้องไม่น้อยกว่า $1 mm'],
		[/must be less than ([\d.]+) ?mm/i, 'ต้องไม่เกิน $1 mm'],
		[/Validation failed for one or more variables/i, 'ค่าที่ส่งไปไม่ผ่านการตรวจสอบ'],
		[/Based on the variables you provided/i, 'จากค่าที่ระบุ'],
		[/dust[_ ]flap/gi, 'ปีกกล่อง'],
		[/top[_ ]tuck[_ ]flap/gi, 'ฝา (top tuck)'],
		[/glue[_ ]margin/gi, 'ระยะติดกาว']
	]
	let out = msg
	for (const [re, rep] of translations) out = out.replace(re, rep)
	return out
}

// Build the request payload, then call the API. Handles:
//   - 429 Too Many Requests → wait + retry (exponential backoff)
//   - 4xx with suggestions → apply suggested values + retry
//   - 5xx → wait + retry
async function generateWithSuggestionRetry(tplId, format, vars, maxRetries) {
	const adjustedVars = { ...vars }
	const adjustments = []
	let rateLimitRetries = 0
	const MAX_RATE_RETRIES = 4

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const r = await fetch(
			BASE_URL + '/dieline-templates/' + encodeURIComponent(tplId) + '/dielines',
			{
				method: 'POST',
				headers: { ...authHeaders(), 'Content-Type': 'application/json' },
				body: JSON.stringify({ format, variables: adjustedVars, dimension_texts: true })
			}
		)
		const text = await r.text()
		let parsed
		try { parsed = JSON.parse(text) } catch { parsed = null }

		if (r.ok) {
			return { ok: true, status: r.status, body: parsed, adjustments }
		}

		// 429 Too Many Requests — wait then retry (don't consume normal attempt budget)
		if (r.status === 429 && rateLimitRetries < MAX_RATE_RETRIES) {
			const wait = Math.min(8000, 1000 * Math.pow(2, rateLimitRetries))
			console.warn(`[dieline] rate-limited, waiting ${wait}ms (retry ${rateLimitRetries + 1}/${MAX_RATE_RETRIES})`)
			await new Promise((res) => setTimeout(res, wait))
			rateLimitRetries++
			attempt-- // don't count this as a normal attempt
			continue
		}

		// Look for suggestions in the errors array
		const errors = (parsed && (parsed.errors || (parsed.error && parsed.error.errors))) || []
		let appliedAny = false
		for (const e of errors) {
			if (e && e.suggestion && e.suggestion.type === 'change_value' && e.suggestion.name) {
				const oldVal = adjustedVars[e.suggestion.name]
				adjustedVars[e.suggestion.name] = e.suggestion.value
				adjustments.push({
					name: e.suggestion.name,
					from: oldVal,
					to: e.suggestion.value,
					reason: translateErrorMessage(e.message)
				})
				appliedAny = true
			}
		}

		if (!appliedAny || attempt === maxRetries) {
			return { ok: false, status: r.status, body: parsed, raw: text, adjustments }
		}
	}
}

// POST /dieline/generate
// body: { internal_template_id?, template_id?, format, variables }
// Returns: { success, url, dimensions, adjustments, raw }
router.post('/generate', express.json(), async (req, res) => {
	const body = req.body || {}
	const format = (body.format || 'svg').toLowerCase()
	if (!['svg', 'pdf', 'dxf'].includes(format)) {
		return res.status(400).json({ success: false, error: 'format ต้องเป็น svg, pdf หรือ dxf' })
	}

	// ใช้ local SVG ถ้ามี (ทรงที่เซฟไว้ — ไม่ยิง API ไม่ต้องมี API key) เฉพาะ format svg
	if (format === 'svg' && body.internal_template_id != null) {
		const lp = localSvgPath(body.internal_template_id)
		if (lp) {
			const m = TEMPLATE_MAP[String(body.internal_template_id)] || {}
			return res.json({
				success: true,
				url: '/dieline/local/' + encodeURIComponent(String(body.internal_template_id)),
				format: 'svg',
				dimensions: localSvgDims(lp),
				template_id: m.id || null,
				internal_template_id: body.internal_template_id,
				source: 'local',
				adjustments: []
			})
		}
	}

	// ทรงอื่น/format อื่น → ยิง API (ต้องมี key)
	if (!ensureConfigured(res)) return
	let tplId = body.template_id
	if (!tplId && body.internal_template_id) {
		const m = TEMPLATE_MAP[String(body.internal_template_id)]
		if (m) tplId = m.id
	}
	if (!tplId) tplId = 'becf-10301'

	const vars = body.variables || {}
	if (!vars.unit) vars.unit = 'mm'
	if (vars.material == null) vars.material = 0.5

	const cacheK = cacheKey(tplId, format, vars)
	const cached = cacheGet(cacheK)
	if (cached) {
		return res.json({ ...cached, cached: true })
	}

	try {
		const result = await generateWithSuggestionRetry(tplId, format, vars, 4)

		if (!result.ok) {
			const errors = (result.body && (result.body.errors || (result.body.error && result.body.error.errors))) || []
			const firstMsg = errors[0] && errors[0].message
			const baseMsg = (result.body && result.body.message) || ''
			const friendly = translateErrorMessage(firstMsg || baseMsg || result.raw || 'unknown')
			// FULL LOG for debugging: dump request payload + every error so we
			// can see exactly which template/variable rejected us.
			console.warn('[dieline] generate failed:')
			console.warn('  status =', result.status)
			console.warn('  template_id =', tplId)
			console.warn('  internal_template_id =', body.internal_template_id)
			console.warn('  variables =', JSON.stringify(vars))
			console.warn('  api response =', JSON.stringify(result.body))
			return res.status(result.status).json({
				success: false,
				error: friendly,
				api_error_detail: result.body,
				template_id: tplId,
				adjustments_tried: result.adjustments
			})
		}

		const d = result.body && result.body.dieline ? result.body.dieline : result.body
		const response = {
			success: true,
			url: d && d.url,
			dimensions: d && d.artwork_dimensions,
			format: d && d.format,
			template_id: tplId,
			internal_template_id: body.internal_template_id || null,
			adjustments: result.adjustments,
			raw: d
		}
		cacheSet(cacheK, response)
		res.json(response)
	} catch (err) {
		console.error('[dieline] generate error:', err)
		res.status(500).json({ success: false, error: err.message || 'unknown error' })
	}
})

// GET /dieline/asset?url=<encoded diecuttemplates asset url>
// Same-origin proxy สำหรับ SVG/PNG ที่ generate มา เพื่อให้ 3D viewer วาดลง canvas/WebGL ได้
// (asset จาก diecuttemplates ไม่มี CORS header → canvas tainted → WebGL error)
// SECURITY: allow-list เฉพาะ diecuttemplates.com / cloudfront ที่เป็นไฟล์ dieline
router.get('/asset', async (req, res) => {
	const url = String(req.query.url || '')
	const allowed =
		/^https:\/\/([a-z0-9-]+\.)*diecuttemplates\.com\//i.test(url) ||
		/^https:\/\/[a-z0-9-]+\.cloudfront\.net\/[^?]*dieline/i.test(url)
	if (!allowed) {
		return res.status(400).json({ success: false, error: 'invalid asset url (host not allowed)' })
	}
	try {
		const r = await fetch(url)
		if (!r.ok) {
			return res.status(r.status).json({ success: false, error: 'upstream ' + r.status })
		}
		res.set('Content-Type', r.headers.get('content-type') || 'image/svg+xml')
		res.set('Cache-Control', 'public, max-age=3600')
		res.set('Access-Control-Allow-Origin', '*')
		const buf = Buffer.from(await r.arrayBuffer())
		res.send(buf)
	} catch (err) {
		console.error('[dieline] asset proxy error:', err)
		res.status(502).json({ success: false, error: err.message || 'proxy failed' })
	}
})

module.exports = router
