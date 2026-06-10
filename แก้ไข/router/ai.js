const express = require('express')
const multer = require('multer')
const Anthropic = require('@anthropic-ai/sdk')
const mammoth = require('mammoth')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const router = express.Router()
const upload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 25 * 1024 * 1024, files: 10 }
})

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'

// Load the box-template reference PDF + template images once at startup.
// They're sent with every request (cached by Anthropic prompt cache) so the AI
// can match user specs to templates 1–12.
let TEMPLATE_REFERENCE_B64 = null
try {
	const refPath = path.join(__dirname, '..', 'estimate', 'Estimate Packaging วิธีคิด1.pdf')
	if (fs.existsSync(refPath)) {
		TEMPLATE_REFERENCE_B64 = fs.readFileSync(refPath).toString('base64')
		console.log('AI: loaded template reference PDF (' + (TEMPLATE_REFERENCE_B64.length / 1024).toFixed(0) + ' KB base64)')
	} else {
		console.warn('AI: template reference PDF not found at ' + refPath)
	}
} catch (e) {
	console.warn('AI: failed to load template reference PDF:', e.message)
}

// Load template images 1.jpg .. 12.jpg as visual reference for AI vision.
const TEMPLATE_IMAGES = []
try {
	const imgDir = path.join(__dirname, '..', 'public', 'img')
	for (let id = 1; id <= 12; id++) {
		const p = path.join(imgDir, id + '.jpg')
		if (fs.existsSync(p)) {
			TEMPLATE_IMAGES.push({ id, b64: fs.readFileSync(p).toString('base64') })
		}
	}
	console.log('AI: loaded ' + TEMPLATE_IMAGES.length + ' template images')
} catch (e) {
	console.warn('AI: failed to load template images:', e.message)
}

const SYSTEM_PROMPT = `You are an expert at extracting packaging job specifications from RFQ documents (English/Thai).
Extract data from the user's input (text/files/images) and return ONLY a single JSON object — no prose, no markdown fences.

Return this exact schema (omit fields you cannot determine — DO NOT guess):

{
  "job_name": "string",
  "customer_name": "string",
  "ae_name": "string",
  "is_new_customer": false,
  "is_reprinted": "0 or 1",
  "is_multiple_f": "true if the job has multiple F-codes / SKU variants / design codes that share the same physical specs but each have their own quantity. Triggers the form's 'งานมีหลาย F' mode.",
  "f_codes": [
    { "code": "string — design/SKU code, e.g. '02', '03', 'F016194'", "qty": "number — quantity for this F-code" }
  ],
  "use_previous_plate": "true if this is a reprint that reuses the old printing plate (typical signal: title starts with 'Rep.' or 'Reprint' or doc says ใช้ Plate เก่า / ใช้เพลทเดิม)",
  "ink_type": "conventional or UV",
  "print_type": "Offset or Flexo",
  "flexo_size": { "w": number, "h": number },
  "fold_size_mm": { "w": number, "l": number, "h": number },
  "open_size_mm": { "w": number, "l": number },
  "quantities": [number, ...],
  "runon_percent": number,
  "paper_markup_percent": number,
  "components": [
    {
      "name": "string — IMPORTANT: if the doc lists components by F-code (e.g. 'F016194: ไม่ประกบลูกฟูก'), use the F-code (F016194) as the name, NOT the box style description from the title. Only fall back to a descriptive name when no F-code is given.",
      "type": "1 | 2 | 3 — 1=ไม่ประกบลูกฟูก (no corrugated, plain paperboard only), 2=ประกบลูกฟูก (paperboard laminated with corrugated), 3=เฉพาะลูกฟูก (corrugated only). CRITICAL: If the spec mentions ANY corrugated indicator alongside a top paper, set type=2: e.g. 'CA105', 'CA125', 'CA150', 'CA175', 'KL', 'KS', 'KA', 'CB-B', 'CB-E', 'E-flute', 'B-flute', 'C-flute', 'ลูกฟูก', 'ประกบลูกฟูก', 'corrugated', 'laminated to flute'. If ONLY corrugated is mentioned (no top paper), use type=3.",
      "box_template_id": "1..12 — Templates 1-11 are specific box styles (tuck-end, auto-bottom, sleeve, hexagonal, lid+base, etc.). Template 12 = 'Custom' (a flat/die-cut catch-all). Rules:\n        • Use 1-11 ONLY when there's an EXPLICIT style word in the doc: 'Inner box', 'Sleeve'/'ปลอก'/'ปลอกกล่อง', 'tuck-end', 'auto-bottom'/'ก้นล็อก', 'crash bottom', 'lid+base'/'ฝาครอบ', 'hexagonal'/'หกเหลี่ยม'.\n        • NEVER infer 1-11 from dimensions/aspect-ratio alone or from product names ('BOX MAXX FLOW' is not a style word).\n        • If no explicit style word but the spec describes a flat / die-cut / one-off shape (only 2 dimensions, irregular outline, or simply 'BOX' with no style detail) → use 12 (Custom).\n        • Only omit entirely when the spec doesn't even describe a packaging item.",
      "dimensions_mm": { "width": number, "length": number, "height": number },
      "flap_mm": "ปีกกล่อง (dust flap) in mm. If the doc doesn't specify, ESTIMATE based on box width: width<60mm → flap=6, 60-120mm → flap=8, 120-200mm → flap=10, >200mm → flap=12. Always provide for tuck-end style boxes.",
      "color_outside": number,
      "color_inside": number,
      "paper_type": "string. Use the Thai packaging industry abbreviation when possible (the dropdown uses these codes). Common mappings: 'อาร์ตการ์ด'/'Art Card' → 'A/C', 'อาร์ตมันหน้าเดียว'/'อาร์ตการ์ดหน้าเดียว'/'C1S' → 'A/C C1s' (or 'C1s'), 'อาร์ตมันสองหน้า'/'C2S' → 'A/C C2s', 'อาร์ตด้าน'/'Art Matt' → 'A/M', 'ไอวอรี่'/'Ivory' → 'Ivory', 'ดูเพล็กซ์'/'Duplex'/'GBB' → 'Duplex GBB' or 'Duplex', 'คราฟท์'/'Kraft' → 'Kraft', 'แฟนซี'/'Fancy' → keep as-is.",
      "paper_gram": number,
      "paper_cost": number,
      "paper_percent": number,
      "remark_paper": "string",
      "corrugated": {
        "_comment": "Provide ONLY when component type=2 or 3.",
        "grade_top": { "type": "CA|KL|KA|KS|...", "gram": number },
        "grade_bottom": { "type": "CA|KL|KA|KS|...", "gram": number },
        "flute": "E | B | C | EB | BC — flute size (E=เล็ก, B=กลาง, C=ใหญ่).",
        "layer": "single-face (1 liner + 1 medium) | single-wall (2 liners + 1 medium, e.g. 'CA105/CA125') | double-wall (3 liners + 2 mediums, e.g. 'CA105/CA125/CA150'). COUNT THE GRADES: 2 grades → single-wall (NOT double-wall). Only call it double-wall when 3+ grades are listed.",
        "raw_grade_string": "the original grade text from the spec, e.g. 'CA105/CA125', for user reference."
      },
      "coatings": [
        { "option": "Gloss|Matt|Other", "type": "string e.g. 'OPP 1 s', 'UV เว้นลิ้น 1 s', 'Spot UV 1 s'. INCLUDE EVERY coating mentioned — multi-coating jobs are common." }
      ],
      "foilstamps": [
        { "size_w_inch": number, "size_h_inch": number, "color": "string", "code": "string" }
      ],
      "embosses": [
        { "size_w_inch": number, "size_h_inch": number, "depth": "1.25 or 1.65" }
      ],
      "debosses": [
        { "size_w_inch": number, "size_h_inch": number, "depth": "1.25 or 1.65" }
      ]
    }
  ],
  "other_processes":    [{ "name": "string — EXCLUDE: Block Diecut, Diecut/ไดคัท, แกะ/strip-out, Inspection/ตรวจสอบ/QC, ติดกาว/ค่าติดกาว/ปะกาว/gluing/assembly. These are auto-handled by the form (gluing has its own checkbox in the box template) or priced automatically by the backend.", "price_per_unit": number }],
  "deliveries":         [{ "destination": "Thai province name only, e.g. 'สมุทรปราการ', 'กรุงเทพ', 'นครปฐม', 'ชลบุรี'. Strip prefixes like 'จ.', 'จังหวัด'. Extract from clauses like 'ส่งงาน[จังหวัด] N จุด'.", "qty": "number, optional — only fill if doc says split into specific qty per destination", "delivery_date": "DD/MM/YYYY, optional" }],
  "handwork_processes": [{ "name": "string", "price_per_unit": number }],
  "materials":          [{ "name": "string", "price_per_unit": number, "is_fixed_price": true, "qty": number }],
  "notes": "any free-text notes worth surfacing"
}

Rules:
- All BOX sizes (dimensions_mm, fold_size_mm, open_size_mm) are in mm — convert from inches if needed.
- BUT foilstamp / emboss / deboss sizes are ALWAYS in INCHES (the form labels them "Size (in²)"). Keep the original inches value, do NOT convert to mm. Field name is size_w_inch / size_h_inch to make this explicit.
- ALL coatings/foilstamps/embosses/debosses are ARRAYS — include every item the doc mentions. Common multi-coating example: "matt OPP 1 s + gloss spot UV 1 s" → coatings has 2 entries (Matt OPP, Gloss Spot UV).
- MULTI-DESIGN JOBS (multi-F): If the doc lists multiple design codes / SKUs that share the same physical specs but have their own quantities (e.g. "งานมี 8 แบบ", "02 จำนวน 10000 / 03 จำนวน 25000 / ...", "F016194 + F016195 + ..."):
    * Set "is_multiple_f": true
    * Fill "f_codes" with one entry per design — the form will create one F-row per entry under the "งานมีหลาย F" section.
    * Use ONE component (single physical box). Do NOT duplicate the component for each design.
    * LEAVE the top-level "quantities" array EMPTY — the per-F qty inside f_codes is the source of truth.
    * The grand total is computed by the form (sum of f_codes[*].qty); do NOT put it in quantities.
- For paper: cost is THB per kg unless the doc says per sheet.
- "color_outside / color_inside" = TOTAL number of printing colors per side (e.g. "6/0" → outside=6, inside=0). Just report the raw count — do NOT split into CMYK + special inks (frontend handles that automatically: any count above 4 means the rest are special inks for the user to fill in).
- "dimensions_mm" per component: width × length × height. Convert from inches if source uses inches. Required whenever the doc gives box dimensions.
- If foil/emboss/deboss is not mentioned, OMIT the key entirely (do not put empty object).
- If only one quantity is mentioned, return it as a single-element array.
- "is_new_customer": true only if document explicitly says new customer.
- For Thai documents, keep Thai text in name fields verbatim.
- DO NOT invent values. If unsure, omit the field.
- For box_template_id:
    * Templates 1-11 = specific styles. Use ONLY when the doc explicitly says the style:
        - "Inner box" / "ฝาเสียบบนล่าง" / "tuck-end" → 1
        - "Sleeve" / "ปลอก" / "ปลอกกล่อง" → 9 or 10
        - "Auto-bottom" / "ก้นล็อก" / "snap-lock" / "Crash bottom" → 4 or 5
        - "Lid + Base" / "ฝาครอบ" → see PDF
        - "Hexagonal" / "กล่องหกเหลี่ยม" → 7 or 8
    * Template 12 = "Custom" — the catch-all for flat sheets, die-cut shapes, or boxes whose style isn't explicitly stated. PREFER 12 over omitting when the spec is clearly a packaging item but doesn't name its style.
    * Product names ("BOX MAXX FLOW", "Inner liner") are NOT style words.
- "Rep." or "Reprint" at the start of the title means this is a reprint. Set is_reprinted=1 AND use_previous_plate=true unless the doc explicitly says new plates.
- NEVER include any of these in other_processes (the form/backend handles them automatically): Block Diecut, Diecut / ไดคัท, แกะ / strip-out, Inspection / ตรวจสอบ / QC, ติดกาว / ค่าติดกาว / ปะกาว / gluing / assembly.
- For deliveries: parse REMARK / Delivery sections. "ส่งงานสมุทรปราการ 1 จุด" → one entry with destination='สมุทรปราการ'. "ส่งกรุงเทพ 50% และอยุธยา 50%" → two entries. Use Thai province names only — strip 'จ.' or 'จังหวัด' prefixes.
- Output MUST be valid JSON parseable by JSON.parse — no trailing commas, no comments.`

async function buildContentFromUpload(textInput, files) {
	const content = []

	// Reference PDF first — gets cached by Anthropic prompt cache so each
	// follow-up request only pays for the user's spec, not the reference doc.
	if (TEMPLATE_REFERENCE_B64) {
		content.push({
			type: 'document',
			source: { type: 'base64', media_type: 'application/pdf', data: TEMPLATE_REFERENCE_B64 },
			cache_control: { type: 'ephemeral' }
		})
		content.push({
			type: 'text',
			text: '↑ Reference PDF: explains the 12 box templates (วิธีคิด).'
		})
	}

	// Visual template references — image of each template numbered 1..12.
	// Last one carries cache_control so the whole image block is cached.
	if (TEMPLATE_IMAGES.length > 0) {
		content.push({ type: 'text', text: 'Below are visual references for templates 1–12. Use these together with the PDF to match the user\'s box style:' })
		TEMPLATE_IMAGES.forEach((img, idx) => {
			content.push({ type: 'text', text: 'Template #' + img.id + ':' })
			const block = {
				type: 'image',
				source: { type: 'base64', media_type: 'image/jpeg', data: img.b64 }
			}
			if (idx === TEMPLATE_IMAGES.length - 1) {
				block.cache_control = { type: 'ephemeral' }
			}
			content.push(block)
		})
	}

	if (textInput && textInput.trim()) {
		content.push({ type: 'text', text: 'Pasted text from user:\n' + textInput.trim() })
	}
	for (const f of files) {
		const mime = f.mimetype || ''
		const name = f.originalname || 'file'
		if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) {
			content.push({
				type: 'document',
				source: { type: 'base64', media_type: 'application/pdf', data: f.buffer.toString('base64') }
			})
			content.push({ type: 'text', text: `(PDF file: ${name})` })
		} else if (mime.startsWith('image/')) {
			content.push({
				type: 'image',
				source: { type: 'base64', media_type: mime, data: f.buffer.toString('base64') }
			})
			content.push({ type: 'text', text: `(Image: ${name})` })
		} else if (
			mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
			name.toLowerCase().endsWith('.docx')
		) {
			const result = await mammoth.extractRawText({ buffer: f.buffer })
			content.push({ type: 'text', text: `--- Content of Word file ${name} ---\n${result.value}` })
		} else if (
			mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
			mime === 'application/vnd.ms-excel' ||
			/\.(xlsx|xls|csv)$/i.test(name)
		) {
			const wb = XLSX.read(f.buffer, { type: 'buffer' })
			let text = `--- Content of spreadsheet ${name} ---\n`
			wb.SheetNames.forEach((sheet) => {
				const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheet])
				text += `\n[Sheet: ${sheet}]\n${csv}\n`
			})
			content.push({ type: 'text', text })
		} else if (mime.startsWith('text/') || /\.(txt|md|json)$/i.test(name)) {
			content.push({ type: 'text', text: `--- Content of ${name} ---\n${f.buffer.toString('utf8')}` })
		} else {
			content.push({ type: 'text', text: `(Skipped unsupported file: ${name} — ${mime})` })
		}
	}
	if (content.length === 0) {
		content.push({ type: 'text', text: '(no input)' })
	}
	content.push({
		type: 'text',
		text: 'Now extract the packaging spec and return the JSON object as described in the system prompt.'
	})
	return content
}

function extractJson(text) {
	const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
	const candidate = fenced ? fenced[1] : text
	const start = candidate.indexOf('{')
	const end = candidate.lastIndexOf('}')
	if (start === -1 || end === -1) throw new Error('AI did not return a JSON object')
	return JSON.parse(candidate.slice(start, end + 1))
}

router.post('/parse-spec', upload.array('files', 10), async (req, res) => {
	try {
		if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'PLEASE_REPLACE_WITH_YOUR_KEY') {
			return res.status(500).json({
				success: false,
				error: 'ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY ในไฟล์ .env กรุณาแก้ไขแล้วรีสตาร์ทเซิร์ฟเวอร์'
			})
		}
		const text = req.body && req.body.text ? String(req.body.text) : ''
		const files = req.files || []
		if (!text.trim() && files.length === 0) {
			return res.status(400).json({ success: false, error: 'ต้องมีข้อความหรือไฟล์อย่างน้อย 1 อย่าง' })
		}

		const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
		const userContent = await buildContentFromUpload(text, files)

		const msg = await client.messages.create({
			model: MODEL,
			max_tokens: 4000,
			// system as a structured array so we can attach cache_control —
			// caches the (mostly stable) prompt across requests.
			system: [
				{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
			],
			messages: [{ role: 'user', content: userContent }]
		})

		// Log cache hit/miss + cost for visibility.
		const u = msg.usage || {}
		console.log(
			'[AI] tokens:',
			'input=' + (u.input_tokens || 0),
			'cache_create=' + (u.cache_creation_input_tokens || 0),
			'cache_read=' + (u.cache_read_input_tokens || 0),
			'output=' + (u.output_tokens || 0),
			'model=' + MODEL
		)

		const reply = msg.content
			.filter((c) => c.type === 'text')
			.map((c) => c.text)
			.join('\n')

		let parsed
		try {
			parsed = extractJson(reply)
		} catch (e) {
			return res.status(502).json({
				success: false,
				error: 'AI ตอบกลับมาแต่ไม่ใช่ JSON ที่อ่านได้',
				raw: reply
			})
		}

		res.json({ success: true, data: parsed, model: MODEL })
	} catch (err) {
		console.error('AI parse-spec error:', err)
		res.status(500).json({ success: false, error: err.message || 'unknown error' })
	}
})

module.exports = router
