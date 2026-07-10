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
  "print_type": "Offset | Flexo | Jet Press | Konica | Digital — default to Offset when not stated and job uses standard paper/ink.",
  "flexo_size": { "w": number, "h": number },
  "fold_size_mm": { "w": number, "l": number, "h": number },
  "open_size_mm": { "w": number, "l": number },
  "quantities": [number, ...],
  "runon_percent": number,
  "paper_markup_percent": number,
  "packing": {
    "shrink_per_unit": "number — ชิ้น/Shrink หรือ ชิ้น/Bag (e.g. '5 Cans/Shrink' → 5)",
    "units_per_carton": "number — Shrink/ลัง หรือ ชิ้น/ลัง (e.g. '8 Shrink/Carton' → 8)",
    "carton_per_pallet": "number — optional",
    "remark": "string — any packing note not captured above"
  },
  "components": [
    {
      "name": "string — IMPORTANT: if the doc lists components by F-code (e.g. 'F016194: ไม่ประกบลูกฟูก'), use the F-code (F016194) as the name, NOT the box style description from the title. Only fall back to a descriptive name when no F-code is given.",
      "type": "1 | 2 | 3 — 1=ไม่ประกบลูกฟูก (no corrugated, plain paperboard only), 2=ประกบลูกฟูก (paperboard laminated with corrugated), 3=เฉพาะลูกฟูก (corrugated only). CRITICAL: If the spec mentions ANY corrugated indicator alongside a top paper, set type=2: e.g. 'CA105', 'CA125', 'CA150', 'CA175', 'KL', 'KS', 'KA', 'CB-B', 'CB-E', 'E-flute', 'B-flute', 'C-flute', 'ลูกฟูก', 'ประกบลูกฟูก', 'corrugated', 'laminated to flute'. If ONLY corrugated is mentioned (no top paper), use type=3.",
      "box_template_id": "1..12 — Templates 1-11 are specific box styles (tuck-end, auto-bottom, sleeve, hexagonal, lid+base, etc.). Template 12 = 'Custom' (a flat/die-cut catch-all). Rules:\n        • Use 1-11 ONLY when there's an EXPLICIT style word in the doc: 'Inner box', 'Sleeve'/'ปลอก'/'ปลอกกล่อง', 'tuck-end', 'auto-bottom'/'ก้นล็อก', 'crash bottom', 'lid+base'/'ฝาครอบ', 'hexagonal'/'หกเหลี่ยม'.\n        • NEVER infer 1-11 from dimensions/aspect-ratio alone or from product names ('BOX MAXX FLOW' is not a style word).\n        • If no explicit style word but the spec describes a flat / die-cut / one-off shape (only 2 dimensions, irregular outline, or simply 'BOX' with no style detail) → use 12 (Custom).\n        • Only omit entirely when the spec doesn't even describe a packaging item.",
      "dimensions_mm": { "width": number, "length": number, "height": number },
      "flap_mm": "ปีกกล่อง (dust flap) in mm. If the doc doesn't specify, ESTIMATE based on box width: width<60mm → flap=6, 60-120mm → flap=8, 120-200mm → flap=10, >200mm → flap=12. Always provide for tuck-end style boxes.",
      "color_outside": "number — ONLY include when the spec EXPLICITLY states the print color count (e.g. '4/0', '4+0', 'CMYK', '4C', 'full color', '4 สี', 'พิมพ์ 4 สี'). If given as a range like 'COLOR QTY: 1-3' or '1-8', use the MAXIMUM number in the range. If NOT mentioned, OMIT this field entirely. Never default to 4.",
      "color_inside":  "number — same rule as color_outside. OMIT if not explicitly stated.",
      "paper_type": "string. Use the Thai packaging industry abbreviation when possible (the dropdown uses these codes). Common mappings: 'อาร์ตการ์ด'/'Art Card' → 'A/C', 'อาร์ตมันหน้าเดียว'/'อาร์ตการ์ดหน้าเดียว'/'C1S'/'SBS C1S'/'SBS' → 'A/C C1s', 'อาร์ตมันสองหน้า'/'C2S' → 'A/C C2s', 'อาร์ตด้าน'/'Art Matt' → 'A/M', 'ไอวอรี่'/'Ivory' → 'Ivory', 'ดูเพล็กซ์'/'Duplex'/'GBB' → 'Duplex GBB' or 'Duplex', 'คราฟท์'/'Kraft' → 'Kraft', 'แฟนซี'/'Fancy' → keep as-is. For corrugated-only components (type=3), paper_type refers to the top liner material (e.g. 'KS', 'CA', 'KL').",
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
        {
          "option": "Gloss | Matt | Other",
          "type": "exact string from the system type list — see COATING MAPPING below. Default to '1 s' (1 side) unless spec says both sides. INCLUDE EVERY coating mentioned."
        }
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
  "notes": "any free-text notes worth surfacing",
  "_uncertain": ["optional — list field names the AI was not confident about, e.g. ['paper_type','paper_gram','box_template_id','color_outside']. The UI highlights these in yellow so the user knows what to verify. Omit entirely when confident about all fields."]
}

Rules:
- All BOX sizes (dimensions_mm, fold_size_mm, open_size_mm) are in mm — convert from inches if needed.
- BUT foilstamp / emboss / deboss sizes are ALWAYS in INCHES (the form labels them "Size (in²)"). Keep the original inches value, do NOT convert to mm. Field name is size_w_inch / size_h_inch to make this explicit.
- ALL coatings/foilstamps/embosses/debosses are ARRAYS — include every item the doc mentions. Common multi-coating example: "matt OPP 1 s + gloss spot UV 1 s" → coatings has 2 entries (Matt OPP, Gloss Spot UV).
- COATINGS placement: coatings[] MUST always be inside a component object. NEVER place coatings at the job level.
- COATING sides: "OPP N ด้าน" / "OPP N sides" / "N s" means N-sided coating — use ONE coating entry with "N s" suffix (e.g. "OPP 2 s"), NOT N separate entries.
- COATING type field: the type field is ONLY the coating product name + sides. NEVER prepend the option value into the type. Examples:
    ✓ CORRECT:  { "option": "Gloss", "type": "Waterbase 1 s" }
    ✗ WRONG:    { "option": "Gloss", "type": "Gloss Waterbase 1 s" }
    ✓ CORRECT:  { "option": "Other", "type": "OPP Window 1 s" }
- MULTI-DESIGN JOBS (multi-F): If the doc lists multiple DIFFERENT design codes / SKUs that each have their own qty (e.g. "งานมี 8 แบบ", "design 02 = 10000 pcs, design 03 = 25000 pcs", "Wallet 2000 / Sticker 500 / ..."):
    * Set "is_multiple_f": true
    * Fill "f_codes" with one entry per design — the form will create one F-row per entry under the "งานมีหลาย F" section.
    * Use ONE component (single physical box). Do NOT duplicate the component for each design.
    * LEAVE the top-level "quantities" array EMPTY — the per-F qty inside f_codes is the source of truth.
    * The grand total is computed by the form (sum of f_codes[*].qty); do NOT put it in quantities.
- QUANTITIES vs MULTI-F: A list of production quantities for the SAME design (e.g. "QTY: 5,000 / 10,000 / 20,000 / 50,000") is NOT multi-F. Set is_multiple_f=false and put all numbers in quantities[]. Only set is_multiple_f=true when each design/SKU variant has its own code.
- PRODUCTION QUANTITY vs PACKING: Packing counts like "5 Cans/Shrink", "24 pcs/carton", "8 Shrink/Carton" are NOT production quantities — put them in packing, NOT in quantities[]. Production quantities are the total pieces to manufacture (typically thousands).
- CUSTOMER NAME: customer_name = the actual brand or company name. Job reference numbers (formats like E26XXXXXX, TB26/XXX, TS25/XXX, E30XXX) belong in job_name, NEVER in customer_name. If no explicit customer name is given, omit customer_name.
- COLOR COUNT vs MACHINE: Printing machine model names (e.g. "Ryo 70", "Ryobi 525", "Roland 700", machine serial numbers) are NOT color counts. Only extract color_outside/color_inside from explicit color statements like "4C", "4/0", "CMYK", "4 สี", "6 สี". "CMYK" alone does NOT mean 4 — it is just the color mode; only count colors when a number is explicitly stated.
- DIMENSIONS from product names: NEVER extract box dimensions from product names, brand names, or codes. If a name like "9x255" or "140X12" appears in the product/job name, do NOT treat it as box dimensions. Only extract dimensions from lines explicitly labeled as W/L/H, width/length/height, ขนาด, dimension, size — and only when the numbers are clearly dimensional measurements, not codes.
- BOX TEMPLATE from product name: "Tuck Box" in the Style/Type field (not in product name) → box_template_id=1. A product name containing numbers like "140X12" does NOT imply template 12. Template is determined ONLY from the style description field.
- DELIVERY PROVINCE: Only create a delivery entry when the spec names a specific Thai province. "DESTINATION: Thailand" or "ส่งไทย" without a province name → omit deliveries (cannot determine province). "DESTINATION: USA" or any non-Thai country → put destination='ต่างประเทศ'.
- CORRUGATED: NEVER guess/invent flute type or layer count. Only fill flute and layer fields when explicitly stated in the spec. If only the grade is given (e.g. "CA125") without a flute label, omit flute and layer.
- For paper: cost is THB per kg unless the doc says per sheet.
- "color_outside / color_inside": report the raw count; frontend splits CMYK vs special inks automatically (count > 4 = extra special inks). Examples: "6/0" → outside=6, inside=0; "4C" → outside=4.
- COATING MAPPING — use these option+type pairs exactly:
    Customer term                            → option   | type
    "Matte Lamination"/"Matt OPP"            → Matt     | OPP 1 s
    "Gloss Lamination"/"Gloss OPP"           → Gloss    | OPP 1 s
    "Soft Touch"/"Velvet Lamination"         → Matt     | OPP Soft Touch 30 mc 1 s
    "Scuff Free"                             → Matt     | OPP Scuff Free 30 mc 1 s
    "UV Coating"/"Full UV"/"UV varnish"      → Gloss    | UV 1 s
    "UV เว้นลิ้น"                             → Gloss    | UV เว้นลิ้น 1 s
    "Spot UV"/"spot UV"                      → Other    | Spot UV 1 s
    "Waterbase"/"WB coating"/"water base"/"Hi-Rub"/"WB Hi-Rub"/"Waterbase Hi-Rub"/"Gloss Waterbase Hi-Rub" → Gloss | Waterbase 1 s
    "Gloss Waterbase"/"Gloss Water Base"/"Gloss WB" → Gloss | Waterbase 1 s
    "Hi-Gloss Waterbase"                     → Gloss    | Hi-gloss waterbase 1 s
    "Varnish"/"Varnishing"/"Gloss Varnish"   → Gloss    | Varnish 1 s
    "Food Grade OPP"                         → Gloss    | OPP (Food Grade) 1 s
    "Metalize"/"Metallic Silver"             → Other    | M PET (Metalize Silver) 1 s
    "Water Proof"/"กันชื้น"/"Waterproof"      → Other    | กันชื้น (Water Proof) 1 s
    "OPP Window"/"Plastic Window"/"Window"   → Other    | OPP Window 1 s
    "PVC"                                    → Other    | PVC 1 s
    If both sides coated: use "2 s" variant (e.g. "OPP 2 s"). If unsure of option, use the mapping above; if no match, use Other.
- "dimensions_mm" per component: width × length × height. Convert from inches if source uses inches. Required whenever the doc gives box dimensions.
- If foil/emboss/deboss is not mentioned, OMIT the key entirely (do not put empty object).
- If only one quantity is mentioned, return it as a single-element array.
- "is_new_customer": true only if document explicitly says new customer.
- For Thai documents, keep Thai text in name fields verbatim.
- DO NOT invent values. If unsure, omit the field.
- For box_template_id:
    * Templates 1-11 = specific styles. Use ONLY when the doc explicitly says the style:
        - "Inner box" / "ฝาเสียบบนล่าง" / "tuck-end" / "Tuck Box" / "tuck end" → 1
        - "Sleeve" / "ปลอก" / "ปลอกกล่อง" → 9
        - "Pillow box" → 10
        - "Auto-bottom" / "ก้นล็อก" / "snap-lock" / "Crash bottom" → 4 or 5
        - "Lid + Base" / "ฝาครอบ" / "lid base" → 12 (use custom when unsure which lid/base style)
        - "Hexagonal" / "กล่องหกเหลี่ยม" → 7 or 8
        - "Tray" / "ถาด" / "Display tray" / "Shipper tray" → 12 (Custom)
    * Template 12 = "Custom" — the catch-all for flat sheets, die-cut shapes, or boxes whose style isn't explicitly stated. PREFER 12 over omitting when the spec is clearly a packaging item but doesn't name its style.
    * Product names ("BOX MAXX FLOW", "Inner liner") are NOT style words.
- "Rep." or "Reprint" at the start of the title means this is a reprint. Set is_reprinted=1 AND use_previous_plate=true unless the doc explicitly says new plates.
- NEVER include any of these in other_processes (the form/backend handles them automatically): Block Diecut, Diecut / ไดคัท, แกะ / strip-out, Inspection / ตรวจสอบ / QC, ติดกาว / ค่าติดกาว / ปะกาว / gluing / assembly.
- For deliveries: parse REMARK / Delivery sections. "ส่งงานสมุทรปราการ 1 จุด" → one entry with destination='สมุทรปราการ'. "ส่งกรุงเทพ 50% และอยุธยา 50%" → two entries. Use Thai province names only — strip 'จ.' or 'จังหวัด' prefixes. For international destinations (USA, Europe, Japan, China, etc.) put destination='ต่างประเทศ'.
- TRAY (ถาด) boxes: use box_template_id=12 (Custom). Dimensions = inner tray W×L×H in mm. component type=3 if corrugated only, type=2 if paper+corrugated.
- MULTI-COMPONENT jobs: when the spec clearly has two separate packaging items (e.g. "Inner box + Tray", "Tray + Cover", "กล่อง + ปลอก"), create one component entry per item. Give each component its own name, paper_type, dimensions, and coatings.
- PAPER TYPE for corrugated grades: 'DP' = Duplex, 'KS'/'KL'/'KA' = Kraft variants, 'CA' = Coated Art corrugated medium. For grade strings like 'KS170CA125/K125-B': top liner = KS 170g, bottom liner = K125 125g, flute = B.
- CORRUGATED GRADE parsing: 'CA105/CA125' → grade_top={type:'CA',gram:105}, grade_bottom={type:'CA',gram:125}, layer='single-wall'. 'CA105/CA125/CA150' → layer='double-wall'. 'DP250CA125-B' → top paper=Duplex 250g + corrugated CA125, flute=B, component type=2.
- PAPER GRADE OPTIONS (slash = alternative weights): 'DP350/DP400', 'GBB250/GBB300' means two weight choices for THE SAME component — do NOT create two components. Use the first grade as primary paper_gram.
- PRINT MACHINE keywords: 'Ryo'/'Ryobi' → Offset. 'Roland' → Offset. 'Komori' → Offset. 'Flexo' → Flexo. 'HP Indigo'/'Jet Press'/'Jet press' → Jet Press. 'Konica'/'Konica Minolta' → Konica.
- Output MUST be valid JSON parseable by JSON.parse — no trailing commas, no comments.
- _uncertain: when you cannot determine a field value with confidence (spec is ambiguous, info is missing, or you had to guess), add the field name to _uncertain[] and OMIT the field from output. Common uncertain fields: paper_type (only "กระดาษ" mentioned), paper_gram (not stated), box_template_id (no style word), color_outside/color_inside (not explicitly stated), corrugated flute (grade given but no flute label).

EXAMPLES — input spec → expected JSON (follow this pattern exactly):

--- Example 1: Simple Offset inner box with coating + delivery ---
INPUT: "กล่อง Inner box ลูกค้า ABC Corp จำนวน 5,000 / 10,000 ขนาด W80×L120×H40 mm กระดาษ Art Card 350 gsm พิมพ์ 4/0 สี เคลือบ Gloss OPP 1 ด้าน ส่งงานกรุงเทพ 1 จุด"
OUTPUT: {"job_name":"กล่อง Inner box","customer_name":"ABC Corp","print_type":"Offset","quantities":[5000,10000],"components":[{"type":1,"box_template_id":1,"dimensions_mm":{"width":80,"length":120,"height":40},"paper_type":"A/C","paper_gram":350,"color_outside":4,"color_inside":0,"coatings":[{"option":"Gloss","type":"OPP 1 s"}]}],"deliveries":[{"destination":"กรุงเทพ"}]}

--- Example 2: Corrugated tray (type=3) reprint ---
INPUT: "Rep. Tray Julius KS170/CA125-E Flute ลูกค้า บริษัท Julius จำกัด จำนวน 3,000 / 5,000 ขนาด 300×200×80 mm"
OUTPUT: {"job_name":"Rep. Tray Julius","customer_name":"บริษัท Julius จำกัด","is_reprinted":"1","use_previous_plate":true,"print_type":"Offset","quantities":[3000,5000],"components":[{"type":3,"box_template_id":12,"dimensions_mm":{"width":300,"length":200,"height":80},"corrugated":{"grade_top":{"type":"KS","gram":170},"grade_bottom":{"type":"CA","gram":125},"flute":"E","layer":"single-wall","raw_grade_string":"KS170/CA125"}}]}

--- Example 3: Multi-F job with uncertain paper_gram ---
INPUT: "Brochure ลูกค้า XYZ งานมี 3 แบบ Design A01: 5,000 ชิ้น Design A02: 10,000 ชิ้น Design A03: 8,000 ชิ้น กระดาษ Art Card C1S พิมพ์ 4/4 เคลือบ Matt OPP 1 ด้าน"
OUTPUT: {"job_name":"Brochure","customer_name":"XYZ","print_type":"Offset","is_multiple_f":true,"f_codes":[{"code":"A01","qty":5000},{"code":"A02","qty":10000},{"code":"A03","qty":8000}],"quantities":[],"components":[{"type":1,"paper_type":"A/C C1s","color_outside":4,"color_inside":4,"coatings":[{"option":"Matt","type":"OPP 1 s"}]}],"_uncertain":["paper_gram"]}`

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

// ===== Post-processing: deterministic fix-up after AI extraction =====
const VALID_PRINT_TYPES = ['Offset', 'Flexo', 'Jet Press', 'Konica', 'Digital']
const OPTION_PREFIXES   = ['Gloss ', 'Matt ', 'Other ']
// Alias map: regex matches product-name part → canonical name (sides suffix preserved)
const COATING_ALIASES   = [
	[/^Hi[\s-]+Rub\b/i,               'Waterbase'],
	[/^WB\s+Hi[\s-]+Rub\b/i,          'Waterbase'],
	[/^Waterbase\s+Hi[\s-]+Rub\b/i,   'Waterbase'],
	[/^WB\s+Coating\b/i,              'Waterbase'],
	[/^WB\b/i,                        'Waterbase'],
	[/^Hi[\s-]+Gloss\s+Waterbase\b/i, 'Hi-gloss waterbase'],
]

function fixCoating(c) {
	if (!c || typeof c !== 'object') return null
	let type = (c.type || '').trim()

	// Remove invalid entries that are ONLY a side-count (e.g. "1 s", "2 s")
	if (/^\d+\s*s$/i.test(type)) return null

	// Strip option name that was incorrectly prepended (e.g. "Gloss Waterbase 1 s" → "Waterbase 1 s")
	for (const p of OPTION_PREFIXES) {
		if (type.startsWith(p)) { type = type.slice(p.length); break }
	}

	// Normalize known aliases (preserve trailing "N s" side-count)
	for (const [rx, canonical] of COATING_ALIASES) {
		if (rx.test(type)) {
			const sides = (type.match(/\d+\s+s$/i) || [])[0]
			type = canonical + (sides ? ' ' + sides : '')
			break
		}
	}

	return type ? { ...c, type } : null
}

function validateAndFix(data) {
	if (!data || typeof data !== 'object') return data

	// 1. print_type — must be a known value
	if (!VALID_PRINT_TYPES.includes(data.print_type)) data.print_type = 'Offset'

	// 2. quantities — remove zero / non-numeric values
	if (Array.isArray(data.quantities)) {
		data.quantities = data.quantities.filter(q => typeof q === 'number' && q > 0)
	}

	// 3. components
	if (Array.isArray(data.components)) {
		data.components.forEach(comp => {
			// box_template_id must be integer 1-12. When the AI couldn't determine
			// the box style (omitted or out of range), default to 12 (Custom) AND
			// flag it for review — so the user always gets a populated style field
			// plus a yellow highlight telling them to verify it.
			{
				const raw = comp.box_template_id
				const t = parseInt(raw, 10)
				if (raw === undefined || raw === null || isNaN(t) || t < 1 || t > 12) {
					comp.box_template_id = 12
					if (!Array.isArray(data._uncertain)) data._uncertain = []
					if (!data._uncertain.includes('box_template_id')) data._uncertain.push('box_template_id')
				} else {
					comp.box_template_id = t
				}
			}

			// paper_type too generic → remove (let user fill)
			if (/^กระดาษ$/i.test(comp.paper_type || '') || /^paper$/i.test(comp.paper_type || '')) {
				delete comp.paper_type
			}

			// paper_gram must be a positive number
			if (comp.paper_gram !== undefined && !(Number(comp.paper_gram) > 0)) {
				delete comp.paper_gram
			}

			// Konica: max 4 colors per side
			if (data.print_type === 'Konica') {
				if (comp.color_outside > 4) comp.color_outside = 4
				if (comp.color_inside  > 4) comp.color_inside  = 4
			}

			// Flexo: component type must be 3 (corrugated only)
			if (data.print_type === 'Flexo' && comp.type && comp.type !== 3) comp.type = 3

			// Corrugated data on type=1 (plain board) doesn't make sense
			if (comp.type === 1 && comp.corrugated) delete comp.corrugated

			// Fix coating entries
			if (Array.isArray(comp.coatings)) {
				comp.coatings = comp.coatings.map(fixCoating).filter(Boolean)
				if (comp.coatings.length === 0) delete comp.coatings
			}
		})
	}

	return data
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
		const temperature = typeof req.body?._temperature === 'number' ? Math.min(1, Math.max(0, req.body._temperature)) : 0
		const files = req.files || []
		if (!text.trim() && files.length === 0) {
			return res.status(400).json({ success: false, error: 'ต้องมีข้อความหรือไฟล์อย่างน้อย 1 อย่าง' })
		}

		// timeout 90s + extra retries: the request ships a ~2.4MB reference
		// payload (PDF + 12 template images) which re-uploads on every cache
		// miss (5-min TTL), so a slow network can stall it. Fail at 90s and let
		// the SDK retry rather than hanging on the default 10-minute timeout.
		const client = new Anthropic({
			apiKey: process.env.ANTHROPIC_API_KEY,
			timeout: 90000,
			maxRetries: 3
		})
		const userContent = await buildContentFromUpload(text, files)

		const msg = await client.messages.create({
			model: MODEL,
			max_tokens: 4000,
			temperature,
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

		parsed = validateAndFix(parsed)

		res.json({ success: true, data: parsed, model: MODEL })
	} catch (err) {
		console.error('AI parse-spec error:', err)
		const isTimeout =
			err?.name === 'APIConnectionTimeoutError' ||
			/timed out|timeout|ECONNRESET|ETIMEDOUT|ENETUNREACH/i.test(err?.message || '')
		res.status(isTimeout ? 504 : 500).json({
			success: false,
			error: isTimeout
				? 'AI ใช้เวลานานเกินไป (เครือข่ายช้าหรือ timeout) กรุณาลองใหม่อีกครั้ง'
				: (err.message || 'unknown error')
		})
	}
})

module.exports = router

// --- bench exports (appended) ---
module.exports = { SYSTEM_PROMPT, buildContentFromUpload, validateAndFix, extractJson }
