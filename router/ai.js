const express = require('express')
const multer = require('multer')
const Anthropic = require('@anthropic-ai/sdk')
const mammoth = require('mammoth')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')
const { logAIUsage } = require('./usageLogger')

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

// Template names — must match the box-template-id dropdown labels in
// public/js/data/default.js so the AI matches the same names the form uses.
const TEMPLATE_NAMES = {
	1:  "Reverse Tuck End — กล่องฝาคู่ แบบฝาสลับ (top + bottom tuck flaps, OPPOSITE directions)",
	2:  "Straight Tuck End — กล่องฝาคู่ แบบฝาตรง (top + bottom tuck flaps, SAME direction)",
	3:  "Tuck Top Snap Lock Bottom (TTSLB) — กล่องออโต้ล็อคแบบหูขัด (tuck top, snap-lock bottom, NO bottom glue)",
	4:  "Tuck Top Auto Bottom (TTAB) — กล่องออโต้ล็อคแบบทากาว (tuck top, auto-bottom WITH GLUE — diagonal fold lines + OL marker)",
	5:  "Double Glue Side Wall / Simple Tray — กล่องฝาครอบ (flat tray, diagonal corner folds, open top, NO lid)",
	6:  "Frame-Vue Tray — กล่องฝาครอบ มีขอบ (tray with extra frame/rim on top opening)",
	7:  "Four Corner Beers Tray with Lid — กล่องเบนโตะ (tray with attached hinged lid — bento/pizza style)",
	8:  "Gable Top with Auto Bottom — กล่องทรงจั่ว (gable/peaked top with handle slot, auto-glue bottom)",
	9:  "Sleeve — ปลอกกล่อง (open both ends, just a rectangular tube)",
	10: "Pillow Box — กล่องทรงหมอน (pillow shape with curved arched ends)",
	11: "Seal End — กล่องฝาปิดแบบทากาว (looks tuck-end but flaps are SEALED with glue, tamper-evident)",
	12: "Custom — รูปแบบกล่องกำหนดเอง (any shape not matching 1-11: flat die-cut, irregular, hexagonal, etc.)"
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
  "ink_type": "conventional | UV. Default to 'conventional'. Set to 'UV' ONLY when the doc EXPLICITLY says UV is the printing ink, e.g. 'พิมพ์ UV', 'หมึก UV', 'UV ink', 'UV offset', 'พิมพ์ด้วยหมึก UV'. DO NOT set to UV just because the coating is UV — 'เคลือบ UV' / 'UV coating' / 'Spot UV' / 'UV Drip Off' / 'UV varnish' are all COATINGS and have NOTHING to do with ink_type. The ink and the coating are separate layers.",
  "print_type": "Offset or Flexo",
  "flexo_size": { "w": number, "h": number },
  "fold_size_mm": { "w": number, "l": number, "h": number },
  "open_size_mm": { "w": number, "l": number },
  "quantities": [number, ...],
  "runon_percent": number,
  "color_limit_qty": "number, optional — the 'ลิมิตสี N เล่ม' value. Fill ONLY when the doc explicitly says color-limit. Triggers the form's ลิมิตสี checkbox + sets the เล่ม input. Keywords: 'ลิมิตสี N เล่ม', 'ลิมิต N เล่ม' (typed casually as 'ลิเบล' or 'ลิเมท' too), 'limit color N books', 'color limit N'. The number is in 'เล่ม' (books). Example: 'ลิมิตสี 3 เล่ม' → color_limit_qty=3. Omit if not mentioned.",
  "paper_markup_percent": number,
  "components": [
    {
      "name": "string — IMPORTANT: if the doc lists components by F-code (e.g. 'F016194: ไม่ประกบลูกฟูก'), use the F-code (F016194) as the name, NOT the box style description from the title. Only fall back to a descriptive name when no F-code is given.",
      "type": "1 | 2 | 3 — 1=ไม่ประกบลูกฟูก (no corrugated, plain paperboard only), 2=ประกบลูกฟูก (paperboard laminated with corrugated), 3=เฉพาะลูกฟูก (corrugated only). CRITICAL: If the spec mentions ANY corrugated indicator alongside a top paper, set type=2: e.g. 'CA105', 'CA125', 'CA150', 'CA175', 'KL', 'KS', 'KA', 'CB-B', 'CB-E', 'E-flute', 'B-flute', 'C-flute', 'ลูกฟูก', 'ประกบลูกฟูก', 'corrugated', 'laminated to flute'. If ONLY corrugated is mentioned (no top paper), use type=3.",
      "box_template_id": "1..12 — Templates 1-11 are specific box styles; 12 = Custom. Decision order (TOP rule wins):\n        1. UPLOADED DIECUT/DIELINE IMAGE = PRIMARY EVIDENCE. We have already sent you labelled reference images for all 12 templates (Template #1 through Template #12) earlier in the message. COMPARE the user's uploaded dieline against those 12 references and pick the one whose construction matches closest — panel layout, flap shape, glue tab position, bottom locking pattern, side seam. Pick the BEST visual match, not a default. Do not bias toward any particular number.\n           - Do NOT count cuts/folds in the image to infer a glue-spot count or override the visual match.\n           - Do NOT assume Template 4 just because the bottom has flaps — auto-bottom has a very specific geometry: diagonal dashed fold lines + 'OL' marker on the bottom panel.\n        2. DIMENSION CHECK: only TWO dimensions (W × L, NO height) and no 3D-box style word → Template 12 (Custom). Cannot be a 3D box.\n        3. STYLE WORDS → matching template. The 12 templates in THIS system:\n           - Template 1 = Reverse Tuck End / 'กล่องฝาคู่ แบบฝาสลับ' / RTE — top + bottom tuck flaps face OPPOSITE directions (one tucks from front, the other from back). Has dust flaps + side glue tab. DEFAULT for generic 'inner box' / 'tuck box' with no flap-direction info.\n           - Template 2 = Straight Tuck End / 'กล่องฝาคู่ แบบฝาตรง' / STE — top + bottom tuck flaps face the SAME direction. Has dust flaps + side glue tab.\n           - Template 3 = Tuck Top Snap Lock Bottom (TTSLB) / 'กล่องออโต้ล็อคแบบหูขัด' — top = tuck flap, BOTTOM = SNAP-LOCK (interlocking rectangular flaps, NO bottom glue). DEFAULT for any tuck-top box when you cannot confirm the bottom uses glue.\n           - Template 4 = Tuck Top Auto Bottom (TTAB) / 'กล่องออโต้ล็อคแบบทากาว' — top = tuck flap, BOTTOM = AUTO-BOTTOM WITH GLUE (diagonal dashed fold lines + 'OL' marker). Pick ONLY when the TEXT explicitly says glue at the bottom: 'ปะกาว N จุดก้นกล่อง', 'ติดกาวก้นกล่อง', 'ทากาวก้น', 'auto-bottom with glue', 'TTAB', 'crash bottom (glue)'. HARD RULE — Template 3 vs 4: if no bottom-glue text, pick Template 3 even if the dieline looks like auto-bottom. 'ติดกาว' alone refers to the SIDE glue tab. Default = 3.\n           - Template 5 = Double Glue Side Wall / Simple Tray / 'กล่องฝาครอบ' (ถาด) — flat single-piece TRAY with diagonal fold lines at each of the 4 corners. Open top, NO lid. Keywords: 'tray', 'ถาด', 'ทรย์', 'Simple Tray', 'double glue side wall'. NOTE: 'กล่องฝาครอบ' in this system's terminology = a tray (the cover is a separate piece, not part of Template 5). Template 5 is NOT auto-bottom and NOT a Lid+Base set.\n           - Template 6 = Frame-Vue Tray / 'กล่องฝาครอบ มีขอบ' — tray like Template 5 PLUS an extra FRAME/RIM around the top opening (visible inner border). Keywords: 'Frame-Vue', 'Frame Vue', 'ถาดมีขอบ', 'มีขอบ', 'tray with frame'.\n           - Template 7 = Four Corner Beers Tray with Lid / 'กล่องเบนโตะ' — tray with an attached HINGED LID that folds over and tucks in. Like a bento box or pizza box. Keywords: 'bento', 'เบนโตะ', 'pizza box', 'tray with hinged lid', 'กล่องอาหารแบบเปิดฝา'.\n           - Template 8 = Gable Top with Auto Bottom / 'กล่องทรงจั่ว' — gable / peaked-roof top with a HANDLE cut-out (carry slot), auto-glue bottom. Like a take-away meal carrier or milk carton with handle. ABSOLUTE PHYSICAL REQUIREMENT — Template 8 IS A BOX YOU CARRY BY A HANDLE. Without a handle, there is no purpose for the gable shape. Therefore Template 8 REQUIRES BOTH of the following — if EITHER is missing, it is NOT Template 8, FULL STOP: (a) a visible HANDLE CUT-OUT — an OVAL or RECTANGULAR SLOT cut out near the top of the side panels, intended for fingers to grip; (b) a TRIANGULAR / PEAKED / ANGLED top — the top panels meet at a ridge (like a tent or jiao /gable roof), NOT a flat rectangle. STOP and ASK YOURSELF before picking 8: 'Can I see the carrying handle slot in this dieline?' If NO → it is NOT Template 8. Period. A flat tuck top with rectangular flaps + auto-bottom = Template 4 (TTAB), NEVER Template 8. The 'Auto Bottom' words in the name 'Gable Top with Auto Bottom' refer to ONE feature among many — many other templates also have auto-bottom (Template 4 is the prime example). Do NOT match Template 8 on 'auto bottom' alone. SCG cookie/snack/food box dielines are USUALLY Template 4 (TTAB), almost NEVER Template 8 — gable boxes are for take-away meals/drinks that need carrying, not for retail-shelf products. Keywords (only valid alongside a handle cut-out): 'gable', 'gable top', 'จั่ว', 'ทรงจั่ว', 'milk carton', 'กล่องหิ้ว', 'มีหูหิ้ว', 'หูหิ้ว', 'handle box', 'carry handle', 'take-away handle'.\n           - Template 9 = Sleeve / 'ปลอกกล่อง' — open on BOTH ends (top and bottom). Just a rectangular tube with one side glue seam. STRICT VISUAL TEST: the dieline must consist of ONLY 4 vertical panels side-by-side (ยาว/กว้าง/ยาว/กว้าง) plus ONE narrow side-glue tab. ABSOLUTE DISQUALIFIERS — if you see ANY of these in the dieline, it is NOT Template 9: (a) any top tuck flap or top closure panel above the main panels; (b) any bottom flap or glue tab below the main panels; (c) any DUST FLAPS (small curved/rounded tabs) extending sideways from the top or bottom edge of the main panels; (d) any horizontal fold lines that create sub-panels stacked vertically. Sleeve = a SINGLE strip of 4 rectangles with NOTHING attached top or bottom. If a dieline has top + bottom flaps with dust flaps, it is Template 1, 2, 3, 4, or 11 — NEVER Template 9. Keywords: 'sleeve', 'ปลอก', 'ปลอกกล่อง', 'open both ends'.\n           - Template 10 = Pillow Box / 'กล่องทรงหมอน' — pillow / cushion shape with CURVED arched ends (not flat). Keywords: 'pillow box', 'pillow pack', 'ทรงหมอน', 'กล่องทรงหมอน'.\n           - Template 11 = Seal End / 'กล่องฝาปิดแบบทากาว' — looks like a tuck-end box (top + bottom flaps with dust flaps) BUT the flaps are SEALED WITH GLUE — not tucked. No opening notch. Common for cosmetic/pharma tubes that need a tamper-evident seal (toothpaste-style box). STRONG VISUAL CUES (any of these → Template 11): (a) top and bottom closure flaps are ASYMMETRIC in size — e.g. top flap ~25-35mm tall with full dust flaps, but bottom is just a thin 8-15mm glue tab (too small to tuck). HARD EXCEPTION: a HANG TAB / EURO-SLOT (a rounded tab with a hanging hole) on the top flap is NOT asymmetry — it is just a display feature that makes the top flap longer. If BOTH ends have real TUCK-IN flaps (foldable into the box), it is Reverse/Straight Tuck End (Template 1/2), NOT Seal End — regardless of product type; (b) bottom panel is a narrow strip clearly meant for gluing, not tucking; (c) the spec/title mentions cosmetic/pharma/cream/lotion/toothpaste/tube products (NOTE: product type ALONE — e.g. contact lens, cosmetics — is NOT enough; there must ALSO be real glued/sealed flaps i.e. a thin bottom glue strip that cannot tuck. A normal tuck-in top+bottom is NOT Seal End even for pharma/cosmetic products); (d) explicit wording 'seal end', 'ฝาปิดทากาว', 'ทากาวปิดฝา'. The asymmetric flap rule is the most reliable visual signal — standard tuck-end (Template 1/2) ALWAYS has top and bottom flaps the same size. Keywords: 'seal end', 'sealed end', 'ฝาปิดทากาว', 'ฝาทากาว', 'glued seal', 'sealed top', 'tamper seal', 'tamper-evident'.\n           - Template 12 = Custom / 'รูปแบบกล่องกำหนดเอง' — any shape NOT matching 1-11: flat 2D die-cut (heart, star, irregular), wrappers, labels, hang tags, hexagonal/octagonal boxes, or anything genuinely custom.\n        4. THREE dimensions (W×L×H all present) and no specific style word → DEFAULT to Template 1 (Reverse Tuck End). Most common folding carton.\n        5. Use Template 12 (Custom) ONLY when: only 2 dimensions, OR the doc says flat sheet / die-cut / 'ส่งเป็นแผ่น', OR the shape is genuinely irregular (heart, star, hexagonal, polygonal). Do NOT pick Custom just because you are unsure — a 3D box with W×L×H always gets a real template (1 if nothing more specific).\n        6. Reference PDF + size: use to refine WHICH template (1-11). A size mismatch is NOT a reason to fall back to Custom.\n        7. NOT IN THIS SYSTEM:\n           - No hexagonal / octagonal / polygonal template — use Template 12.\n           - No true 2-piece Lid+Base set (separate lid + separate base). If the spec describes both pieces in ONE component, emit them as TWO components (each a tray = Template 5 or 6).\n        8. Note: 'INNER' as part of a product/brand name ('กล่อง INNER P.O.CARE') is NOT a style word — but 'Inner box' / 'Inner carton' as a packaging-type ('บรรจุภัณฑ์: Inner box') IS → Template 1.",
      "dimensions_mm": { "width": number, "length": number, "height": number },
      "_dimension_label_mapping": "CRITICAL — DO NOT MIX UP W, L, H, D. The letters are NOT interchangeable:\n          - W / Width / กว้าง  → dimensions_mm.width\n          - L / Length / ยาว   → dimensions_mm.length\n          - H / Height / ความสูง / สูง → dimensions_mm.height  (H = VERTICAL height, NEVER length)\n          - D / Depth / ลึก / ความลึก → dimensions_mm.length   (D and L are equivalent — both go into 'length')\n          Worked examples:\n          - 'DIMENSION: W65 x H85 x D90 mm' → {width:65, length:90, height:85}  (H=85→height, D=90→length)\n          - 'W × L × H = 50 × 100 × 30'    → {width:50, length:100, height:30}\n          - 'W × D × H = 50 × 100 × 30'    → {width:50, length:100, height:30}  (D→length)\n          - 'ขนาด 100 × 50 × 30 mm' (no letter labels) → assume W × L × H by convention → {width:100, length:50, height:30}\n          NEVER put H into 'length'. NEVER put D into 'height'.\n          INFERENCE FROM DIELINE (no W/L labels) — Thai packaging convention: in a 4-wraparound-panel layout (the pattern a/b/a/b reading horizontally), the LARGER panel value is ยาว/Length, the SMALLER is กว้าง/Width. RULE OF THUMB: length ≥ width. Example: dieline shows horizontal panels '175 / 85 / 175 / 84.5' → length=175, width=85 (NOT width=175, length=85). If you ever produce width > length for a folding carton, you are almost certainly wrong — swap them.\n          HEIGHT FROM DIELINE — the box HEIGHT is the VERTICAL measurement labeled on the MAIN BODY PANEL (the central rectangle that becomes the front/back of the assembled box). It sits BETWEEN the top closure (tuck flap area) and the bottom closure (auto-bottom / bottom flaps). If the dieline shows TWO red rectangles stacked vertically: the UPPER one represents the TOP face viewed from above (its vertical measurement = box WIDTH, NOT height — because the top face is L×W rotated 90° in this projection); the LOWER one is the front face (its vertical measurement IS the height). DIAGNOSTIC: if your candidate height ≈ the box width, you picked the top-view rectangle by mistake — choose the OTHER vertical measurement on the main body panel. Example (DP350-style Cookie box layout, total vertical 252): tuck flap 55.5 → top-face vertical labeled '86' (top-view of width 85, NOT height) → body vertical labeled '55' (this IS height) → bottom auto-bottom flaps. CORRECT: width=85, length=175, height=55. WRONG: height=86.",
      "flap_mm": "ปีกกล่อง (dust flap) in mm. If the doc gives a labelled DIELINE/diecut drawing, MEASURE the dust flap height from the dieline (the small curved tabs extending out from the top/bottom of the side panels) — do NOT use the estimation formula in that case. Only when no dieline is given, estimate from box width: width<60mm → 6, 60-120mm → 8, 120-200mm → 10, >200mm → 12. Always provide for tuck-end style boxes.",
      "glue_mm": "ติดกาว (side-seam glue tab width) in mm — the narrow strip on one side of the dieline where the box wraps and is glued shut. ONLY fill this when the dieline shows a dimension for it (typically labelled as the rightmost/leftmost narrow strip, often 8-15mm wide). MEASURE from the dieline. If not visible in any input, OMIT — the form has a default value.",
      "tuck_mm": "ฝาเสียบ (top tuck flap depth) in mm — the depth of the tuck-end closure flap that folds into the box. ONLY fill when the dieline shows a clearly labelled top closure flap height. MEASURE from the dieline (it's the topmost vertical section in a standard RTE/STE layout, typically 20-35mm, approximately equal to the box's smaller horizontal dimension). If not visible, OMIT — the form has a default value.",
      "glued_spots": "number — ONLY set this when the TEXT of the spec EXPLICITLY says how many glue spots ('ติดกาว 2 จุด', 'ปะกาว 3 จุด', 'ไดคัทติดกาว 6 จุด', 'glue 3 points'). NEVER guess or infer from a dieline image. If the spec does NOT mention a glue-spot count, OMIT this field entirely. The glue-spot number alone is NOT enough evidence to pick a particular box_template_id — let the visual match against the 12 template images decide the template; glued_spots is just a sub-field that fills the form's 'N จุด' input.",
      "color_outside": number,
      "color_inside": number,
      "special_inks": [
        {
          "_comment": "ONLY include when the doc EXPLICITLY describes a special ink (color name + type). If the doc just says 'N สี' with no detail, OMIT this array — the frontend creates blank rows for the user to fill.",
          "name": "color name / pantone from the doc, e.g. 'ส้ม', 'สีส้ม', 'Pantone 877', 'Gold', 'White'.",
          "ink_type": "one of: ธรรมดา | เมทัลลิค | สะท้อนแสง | ทนแดด | UV. Mapping: 'หมึกทนแดด'/'ทนแดด'/'sun-resistant'/'fade-resistant' → 'ทนแดด'; 'เมทัลลิค'/'metallic' → 'เมทัลลิค'; 'สะท้อนแสง'/'reflective'/'fluorescent' → 'สะท้อนแสง'; 'หมึก UV'/'UV ink' → 'UV'; plain special/spot colour → 'ธรรมดา'.",
          "filling_style": "printing style if stated: 'ตีพื้น'/'พื้น'/'background' → 'ตีพื้น'; 'ลายเส้น'/'line'/'spot' → 'ลายเส้น'. Omit if not specified."
        }
      ],
      "paper_type": "string. ⚠️ ABSOLUTE RULE: IF THE TEXT DOES NOT CONTAIN A LITERAL PAPER-TYPE WORD, OMIT THIS FIELD ENTIRELY. DO NOT RETURN ANY VALUE. The form has its own default — your job is to fill ONLY when you have evidence. Forbidden behaviors (ALL of these are HALLUCINATION — never do them): (1) guessing from product type — cookie boxes are NOT automatically Duplex/GBB, snack boxes are NOT automatically Ivory, cosmetic boxes are NOT automatically A/C; (2) guessing from customer name (e.g. 'อาหารยอดคุณ' is a brand name, NOT evidence of paper type); (3) guessing from box style (folding cartons are NOT automatically A/C); (4) interpreting CAD/drawing/plate codes as paper — 'DP350', 'CAD No. Useful', 'Pcs:', 'M/C', 'Knitt:', 'Score:', 'Perf:', 'D/C Sheet', 'Ar:', 'Wt:', 'Plate No.' etc. are ALL drawing/production metadata, NEVER paper info; (5) inferring from corrugated grade nearby. THE ONLY VALID TRIGGERS to fill paper_type are these EXACT words appearing in the text: 'อาร์ตการ์ด', 'อาร์ตมัน', 'อาร์ตด้าน', 'Art Card', 'card', 'Card', 'Art Matt', 'Art', 'ไอวอรี่', 'Ivory', 'กล่องแป้ง', 'กระดาษกล่องแป้ง', 'Duplex', 'GBB', 'ดูเพล็กซ์', 'คราฟท์', 'Kraft', 'แฟนซี', 'Fancy', 'C1S', 'C1s', 'C2S', 'C2s', 'A/C', 'A/M'. NO OTHER TEXT counts as paper evidence. When you fill, use the Thai packaging industry abbreviation: 'อาร์ตการ์ด'/'Art Card'/'card'/'Card' → 'A/C', 'อาร์ตมันหน้าเดียว'/'อาร์ตการ์ดหน้าเดียว'/'C1S'/'1/s' → 'A/C C1s', 'อาร์ตมันสองหน้า'/'C2S'/'2/s' → 'A/C C2s' (เช่น 'card 1/s' → 'A/C C1s', 'card 2/s' → 'A/C C2s'), 'อาร์ตด้าน'/'Art Matt' → 'A/M', 'ไอวอรี่'/'Ivory' → 'Ivory', 'กล่องแป้ง'/'ดูเพล็กซ์'/'Duplex' โดยไม่ระบุชนิดย่อย → 'Duplex GBB' (ค่าเริ่มต้นงานแพคเกจจิ้ง); ถ้าระบุชัด BBB → 'Duplex BBB', WBB → 'Duplex WBB', GBB → 'Duplex GBB', 'คราฟท์'/'Kraft' → 'Kraft', 'แฟนซี'/'Fancy' → keep as-is.",
      "paper_gram": "number — paper weight in grams per square meter (gsm). ⚠️ ABSOLUTE RULE: OMIT THIS FIELD if you cannot point to a number followed by a literal weight unit. Valid triggers ONLY: a number IMMEDIATELY followed by 'แกรม', 'gsm', 'g/m²', 'gram', 'g.', 'GSM', OR a standalone 'G'/'g' placed right AFTER the number (optional space) — e.g. 'อาร์ตการ์ด 250 แกรม' → 250, 'DUPLEX 350 G' → 350, '300g' → 300. IMPORTANT: the unit comes AFTER the number; a code like 'DP350' (letters BEFORE the number) is NOT a gram value. Forbidden: (1) extracting numbers from drawing codes — 'DP350' has '350' but it is a Drawing Pattern code, NOT 350gsm; (2) numbers from dimensions ('252 x 539.5' is sheet size, not gram); (3) numbers from process metadata ('Knitt: 2049.53', 'Score: 1297', 'Perf: 370.61' are die-cut measurements, not gram); (4) numbers from product code/SKU. If the spec text mentions a paper type but NO gram value, fill paper_type only and omit paper_gram.",
      "paper_cost": number,
      "paper_percent": number,
      "remark_paper": "string — extra paper detail that does NOT fit the type/gram dropdowns. ALWAYS capture here when the doc mentions: paper BRAND ('Bohui', 'StarSpark', 'IK', 'UPM', 'APP' etc.), grade qualifier ('ชนิดฟู้ดเกรด'/'food grade', 'FSC', 'recycled'), coating side ('1/s', 'C1s'), or any special note about the paper. Example: doc says 'อาร์ตการ์ด 250 แกรม 1/s ชนิดฟู้ดเกรด Bohui' → remark_paper = 'ชนิดฟู้ดเกรด, แบรนด์ Bohui'.",
      "corrugated": {
        "_comment": "Provide ONLY when component type=2 or 3.",
        "grades": [
          { "type": "paper code — KS, KI, KA, KL, CA, DP, etc.", "gram": number }
        ],
        "flute": "E | B | C | EB | BC — flute size (E=เล็ก, B=กลาง, C=ใหญ่).",
        "layer": "integer — the COUNT of grades = number of paper plies. The system supports 2, 3, or 5.",
        "raw_grade_string": "the original grade text verbatim, e.g. 'KS170/CA125/KI125'.",
        "_grade_parsing": "Slash-separated grade string. Put EVERY grade (in order) into the 'grades' array — do NOT drop the middle one. 'CA105/CA125' → grades=[CA105, CA125], layer=2. 'KS170/CA125/KI125' → grades=[KS170, CA125, KI125], layer=3. A 5-grade string → layer=5. The form has one type+gram pair per grade; the layer dropdown value equals the number of grades."
      },
      "coatings": [
        { "option": "Gloss|Matt|Other", "size_w_inch": "number — ONLY for 'Spot UV' / 'Spot UV Semi' coating types where the spec mentions a size (e.g. 'spotUV 2x2 นิ้ว' → size_w_inch=2). Omit for other coatings.", "size_h_inch": "number — same as size_w_inch.", "type": "string — MUST be one of the EXACT dropdown names below, with a side suffix '1s' or '2s' appended (default 1s).\n        ── option='Gloss' choices: UV, Waterbase, OPP, UV เว้นลิ้น, Varnish, Spot UV, Spot Waterbase, OPP Window, Hi-gloss waterbase, UV Drip off, Waterbase Hi-Rub, OPP (Food Grade), Spot UV Semi, UV Anti-static & tapetest, UV Anti-static & tapetest เว้นลิ้น, Hi-rub WB เว้นยิง Lot No., Hi-Gloss WB เว้นยิง Lot No., OPP (Cold).\n        ── option='Matt' choices: UV, Waterbase, OPP, Spot UV, Spot Waterbase, OPP (Food Grade), OPP Window, UV Anti-static & tapetest, UV Anti-static & tapetest เว้นลิ้น, OPP (Cold).\n        ── option='Other' choices: OPP Soft Touch 30 mc, OPP Scuff Free 30 mc, Calendering, M PET (Metalize Silver), กันซึม (Water Proof), Blister Pack, PE Food Grade, อัดลาย, Waterbase Softouch.\n        Mappings (spec wording → option / type):\n          - 'Varnishing'/'Varnish'/'วานิช'/'เคลือบวานิช' → Gloss / 'Varnish 1s'\n          - 'เคลือบเงา'/'waterbase'/'water base'/'Waterbase Gloss'/'Waterbase Gloss Varnish'/'เคลือบเงา Waterbase' (gloss waterbase ทั่วไป ไม่ระบุชนิด) → Gloss / 'Waterbase Hi-Rub 1s' (ค่าเริ่มต้นงานแพคเกจจิ้ง)\n          - 'เคลือบด้าน Waterbase'/'Waterbase Matt' → Matt / 'Waterbase 1s'\n          - 'Hi-gloss'/'ไฮกลอส'/'Hi-Gloss waterbase' → Gloss / 'Hi-gloss waterbase 1s'\n          - 'Hi-Rub'/'Waterbase Hi-Rub' → Gloss / 'Waterbase Hi-Rub 1s'\n          - 'UV เงา'/'ยูวีเงา'/'UV Gloss' → Gloss / 'UV 1s'; 'UV ด้าน'/'UV Matt' → Matt / 'UV 1s'\n          - 'UV เว้นลิ้น'/'ยูวีเว้น'/'เว้นลิ้น'/'เว้นฝา'/'ยูวีเงาเว้น' → Gloss / 'UV เว้นลิ้น 1s' (NOT Drip Off)\n          - 'Spot UV' → Gloss / 'Spot UV 1s'; 'Spot UV Semi' → Gloss / 'Spot UV Semi 1s'\n          - 'Spot Waterbase' → Gloss / 'Spot Waterbase 1s'\n          - 'UV ดิฟออฟ'/'UV Drip Off'/'Drip off' → Gloss / 'UV Drip off 1s'\n          - 'OPP เงา'/'Gloss OPP' → Gloss / 'OPP 1s'; 'OPP ด้าน'/'OPP Matt' → Matt / 'OPP 1s'\n          - 'OPP Window'/'OPP เจาะหน้าต่าง' → Gloss / 'OPP Window 1s' (keep the word Window)\n          - 'OPP Food Grade'/'OPP ฟู้ดเกรด' → Gloss / 'OPP (Food Grade) 1s'\n          - 'OPP Cold'/'OPP เย็น' → Gloss / 'OPP (Cold) 1s'\n          - 'UV Anti-static'/'tapetest' → Gloss / 'UV Anti-static & tapetest 1s'\n          - 'PE Food Grade'/'PE ฟู้ดเกรด' → Other / 'PE Food Grade 1s'\n          - 'กันซึม'/'Water Proof'/'Waterproof'/'กันน้ำ' → Other / 'Water Proof 1s' (dropdown shows 'กันซึม (Water Proof) 1 s')\n          - 'เมทัลไลท์'/'Metallic'/'Metalize'/'M PET' → Other / 'M PET (Metalize Silver) 1s'\n          - 'Soft Touch'/'ด้านนุ่ม' → Other / 'OPP Soft Touch 30 mc 1s' (or 'Waterbase Softouch 1s' if waterbase soft-touch)\n          - 'Scuff Free' → Other / 'OPP Scuff Free 30 mc 1s'\n          - 'อัดลาย'/'Calendering' → Other / 'อัดลาย 1s' or 'Calendering 1s'\n          - 'Blister'/'Blister Pack' → Other / 'Blister Pack 1s'\n        Side count: '1/s'/'1 หน้า'/'1 ด้าน' → '1s'; '2/s'/'2 หน้า'/'2 ด้าน' → '2s'. Default '1s'.\n        IMPORTANT: 'เว้น/เว้นลิ้น' (skip) ≠ 'Drip Off'. Each distinct coating mentioned = one array entry." }
      ],
      "foilstamps": [
        { "_comment": "ONLY include when the doc EXPLICITLY mentions foil stamping with one of these keywords: 'ปั๊มฟอยล์', 'ปั๊มเค', 'ปั๊มเงิน', 'ปั๊มทอง', 'foil stamp', 'foil stamping', 'hot stamping', 'hot foil', 'ฟอยล์'. A Spot UV size is NOT a foil — do NOT create a foilstamp from a Spot UV mention.", "size_w_inch": number, "size_h_inch": number, "color": "string", "code": "string" }
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
  "deliveries":         [{ "destination": "Thai province name only, e.g. 'สมุทรปราการ', 'กรุงเทพ', 'นครปฐม', 'ชลบุรี'. Strip prefixes like 'จ.', 'จังหวัด'. Extract from clauses like 'ส่งงาน[จังหวัด] N จุด'.", "qty": "number, optional — qty for THIS specific delivery batch. Fill whenever the doc gives per-batch quantities (split shipments, multiple dates, multiple destinations).", "delivery_date": "DD/MM/YYYY in Thai Buddhist Era (พ.ศ.), optional. The form expects BE — e.g. CE 2022 → 2565, CE 2026 → 2569. If the doc gives a 2-digit year ('20/7/65'), assume BE: → '20/07/2565'. If the doc gives a clearly CE year (4-digit, year < 2200), add 543 to convert: '20/07/2022' → '20/07/2565'. Always output a 4-digit BE year." }],
  "handwork_processes": [{ "name": "string", "price_per_unit": number }],
  "materials":          [{ "name": "string", "price_per_unit": number, "is_fixed_price": true, "qty": number }],
  "notes": "any free-text notes worth surfacing"
}

Rules:
- ink_type vs coating: "UV" alone is AMBIGUOUS. If the doc only mentions "UV" in a coating context ('เคลือบ UV', 'UV coating', 'Spot UV', 'UV Drip Off'), the ink_type is "conventional" (NOT UV). The ink_type is "UV" ONLY when the doc explicitly says the INK is UV ('พิมพ์ UV', 'หมึก UV', 'UV ink', 'UV offset print').
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
- "color_outside / color_inside" = TOTAL number of printing colors per side. COUNT GENEROUSLY — include CMYK + every additional ink/varnish layer applied via the press:
    * CMYK base = 4 colors
    * "ขาวตีพื้น" / "white base" / "white background" → +1 (white ink is a special printing layer)
    * "สีทอง" / "สีเงิน" / "สีนีออน" / metallic inks → +1 each
    * "Spot UV" / "UV ดิฟออฟ" / "UV ดรอปออฟ" / "UV Drip Off" when applied via PRINTING (and also adds a coating row — see coatings below) → +1
    * "พิมพ์ N สี" + extras = N + (count of extras)
    * Example: "CMYK + ขาวตีพื้น" → 5
    * Example: "พิมพ์ 5 สี CMYK + ขาวตีพื้น + UV ดิฟออฟ" → 6 (4 CMYK + 1 white + 1 UV varnish)
    * Just report the count — the frontend auto-creates blank special-ink rows for any count above 4.
    * If the colour count is given as a RANGE (e.g. 'COLOR Q'TY: 3-5', '4-6 สี', '1-8') → use the MAXIMUM of the range (conservative for estimate pricing). '3-5' → color_outside=5.
- special_inks: Fill this array ONLY when the doc explicitly describes the special ink (e.g. "สีพิเศษพื้นสีส้มหมึกทนแดด" → name='ส้ม', ink_type='ทนแดด', filling_style='ตีพื้น'). If the doc only gives a colour count with no special-ink detail, OMIT the array.
- EXPLICIT SPECIAL-COLOR LIST (HIGHEST PRIORITY — this overrides the M/Y DOMAIN RULE below): when the doc lists specific spot/special colours by name or Pantone code — e.g. "สีพิเศษ 4 สี PT257C / PT661C / PR155C / แดง / ดำ", "special colors: Pantone 661C, Pantone 257C", "สีพิเศษ ส้ม, เงิน, ดำ" — you MUST create ONE special_inks entry PER colour actually listed, using the colour/Pantone string EXACTLY as written for the "name" field (keep 'PT257C', 'PR155C', 'แดง', 'ดำ' verbatim — do NOT convert to M/Y or CMYK). Count the items in the list itself, NOT the "N สี" number if they disagree (e.g. "สีพิเศษ 4 สี" followed by 5 codes → emit 5 entries). For each entry: set ink_type='ทนแดด' if the doc says the printing uses หมึกทนแดด / fade-resistant, otherwise 'ธรรมดา'; omit filling_style unless the doc states ตีพื้น/ลายเส้น. NEVER replace an explicit special-colour list with the generic M/Y expansion.
- DOMAIN RULE — CMYK + 'หมึกทนแดด' (fade-resistant ink) auto-expansion:
    * When the spec says "พิมพ์ N สี หมึกทนแดด" / "N-color fade-resistant" / "พิมพ์ N สี ทนแดด" AND N ≥ 4 (i.e. CMYK base) AND the doc has NO explicit special-colour list (if an explicit list exists per the rule above, that list WINS and you SKIP this whole M/Y expansion):
      - In packaging production, the M (Magenta) and Y (Yellow) inks fade fastest in sunlight, so they are reprinted as fade-resistant OVERLAYS on top of the regular CMYK. This adds 2 extra ink stations.
      - Therefore: color_outside (or color_inside) = N + 2 (account for the 2 extra overlay layers).
      - AND special_inks MUST include 2 entries:
        { name: "M", ink_type: "ทนแดด", filling_style: "ลายเส้น" },
        { name: "Y", ink_type: "ทนแดด", filling_style: "ลายเส้น" }
      - Do NOT add a generic "หมึกทนแดด" entry as a single special ink — that's wrong. The fade-resistant treatment for CMYK is ALWAYS the 2 specific M and Y line-work overlays.
    * Example: "พิมพ์ 4/0 สี หมึกทนแดด" → color_outside=6, color_inside=0, special_inks=[{M, ทนแดด, ลายเส้น}, {Y, ทนแดด, ลายเส้น}]
    * Example: "พิมพ์ 4/4 หมึกทนแดด ทั้งสองด้าน" → color_outside=6, color_inside=6, special_inks=[{M, ทนแดด, ลายเส้น}, {Y, ทนแดด, ลายเส้น}, {M, ทนแดด, ลายเส้น}, {Y, ทนแดด, ลายเส้น}] (4 entries total — 2 per side).
    * Exception: if the doc EXPLICITLY names specific fade-resistant spot colors (e.g. "หมึกทนแดดสีส้มตีพื้น"), use those instead — the M/Y rule only applies to generic "CMYK + fade-resistant".
- "dimensions_mm" per component: width × length × height. Convert from inches if source uses inches. Required whenever the doc gives box dimensions.
- If foil/emboss/deboss is not mentioned, OMIT the key entirely (do not put empty object).
- If only one quantity is mentioned, return it as a single-element array.
- "is_new_customer": true only if document explicitly says new customer.
- For Thai documents, keep Thai text in name fields verbatim.
- DO NOT invent values. If unsure, omit the field.
- For box_template_id: see the box_template_id field description in the schema above for the full 12-template map. Quick keyword → template reference:
    * "Reverse Tuck End" / "RTE" / "ฝาคู่ ฝาสลับ" → 1
    * "Inner box" / "Inner carton" / generic "tuck box" with no flap-direction info → 1 (default)
    * "Straight Tuck End" / "STE" / "ฝาคู่ ฝาตรง" → 2
    * "Tuck top + snap-lock bottom" / "TTSLB" / "หูขัด" / "ก้นล็อกแบบหูขัด" (no glue at bottom) → 3
    * "Tuck top + auto-bottom glue" / "TTAB" / "ทากาวก้น" / "ปะกาว N จุดก้นกล่อง" → 4
    * "Tray" / "ถาด" / "Simple Tray" / "กล่องฝาครอบ" (with no further detail) → 5
    * "Tray + frame" / "ถาดมีขอบ" / "Frame-Vue Tray" → 6
    * "Bento" / "เบนโตะ" / "Pizza box" / "tray with hinged lid" → 7
    * "Gable top" / "ทรงจั่ว" / "milk carton" / "กล่องหิ้ว" / "มีหูหิ้ว" → 8
    * "Sleeve" / "ปลอก" / "ปลอกกล่อง" (open both ends) → 9
    * "Pillow box" / "ทรงหมอน" → 10
    * "Seal end" / "ฝาปิดทากาว" / "sealed end" / "tamper-evident seal" → 11
    * Custom / flat 2D / die-cut / hexagonal / irregular → 12
- Common box_template_id MISTAKES to avoid:
    * SLEEVE (Template 9) IS RARE — only pick it when the dieline shows literally just 4 rectangular panels in a single horizontal strip with NOTHING above or below. If the dieline has top tuck flap + dust flaps + bottom glue tab → it is a TUCK-END family box (Template 1/2/3/4/11), NOT Template 9. A box with 4 sides + asymmetric top/bottom closures = Template 11 (Seal End), not Sleeve.
    * Tuck-end with ASYMMETRIC flap sizes (top ≠ bottom, e.g. 30mm top tuck + 12mm bottom glue tab) → Template 11 (Seal End), NOT Template 1/2. Standard tuck-end has equal top/bottom flaps. BUT a HANG-TAB / EURO-SLOT retail carton (a tuck box with a rounded hanging-hole tab on the top flap — common for contact lens, cosmetics, small retail items) → Template 1 (Reverse Tuck End) by default, NOT Template 11. The hanging hole is just a display feature; if both ends still tuck in, it is a normal tuck-end box. Do NOT pick Seal End just because the product is pharma/cosmetic or the top flap looks longer due to the hang tab.
    * "ก้นล็อก" / "snap-lock bottom" → Template 3, NOT 4 or 5. Template 5 is a tray (no bottom-lock); Template 4 needs explicit bottom-GLUE text.
    * "Hexagonal" / "octagonal" / "กล่องหกเหลี่ยม" → Template 12 (Custom). This system has NO hexagonal template.
    * "Lid + Base set" / two-piece (separate lid + separate base) → Not one of the 12 templates. Split into 2 components (each a tray = Template 5 or 6) instead.
    * "ฝาครอบ" alone in this system = a TRAY (Template 5), NOT a Lid+Base set.
    * 3+ glue spots on its own → NOT a strong template signal. The form's glued_spots field is independent of box_template_id. Most folding cartons have only 1 side-glue tab; a high count usually means auto-bottom (Template 4) — but still requires the text to say bottom glue, otherwise Template 3.
- VISUAL DIECUT IMAGES: if the user uploads a dieline/diecut image, USE IT AS PRIMARY EVIDENCE — compare against the 12 reference images we sent earlier. Visual cues:
    * Diagonal dashed fold lines at the bottom + 'OL' marker → auto-bottom (Template 4 — but text must also confirm bottom glue, else 3)
    * Interlocking rectangular flaps at bottom, no diagonal lines → snap-lock (Template 3)
    * Straight tuck flaps top + bottom on the SAME side → Template 2
    * Straight tuck flaps top + bottom on OPPOSITE sides → Template 1
    * Flat tray, diagonal folds at all 4 corners, no top → Template 5 or 6 (6 if extra inner frame visible)
    * Tray + attached lid panel → Template 7 (bento)
    * Peaked/gable top + handle slot → Template 8
    * Just a rectangle with vertical fold lines, no top/bottom flaps → Template 9 (sleeve)
    * Curved / arched ends on top and bottom → Template 10 (pillow)
    * Looks tuck-end but spec says GLUED CLOSED / SEALED → Template 11
    * If the spec text and the dieline disagree on top/bottom geometry, TRUST THE DIELINE (except Template 3 vs 4 — there, text wins).
- Only 2 dimensions (W × L, no height) → Template 12 (Custom). Cannot be a 3D box.
- THREE dimensions (W×L×H all present) → ALWAYS a real box → Templates 1-11 (default 1). NEVER use Custom for a 3D box just because the size seems unusual.
- The reference PDF helps refine WHICH template — it is not a reason to fall back to Custom.
- "Rep." or "Reprint" at the start of the title means this is a reprint. Set is_reprinted=1 AND use_previous_plate=true unless the doc explicitly says new plates.
- NEVER include any of these in other_processes (the form/backend handles them automatically): Block Diecut, Diecut / ไดคัท, แกะ / strip-out, Inspection / ตรวจสอบ / QC, ติดกาว / ค่าติดกาว / ปะกาว / gluing / assembly.
- For deliveries: parse REMARK / Delivery sections. "ส่งงานสมุทรปราการ 1 จุด" → one entry with destination='สมุทรปราการ'. "ส่งกรุงเทพ 50% และอยุธยา 50%" → two entries. Use Thai province names only — strip 'จ.' or 'จังหวัด' prefixes.
- SPLIT SHIPMENTS (แบ่งส่ง / ส่งหลายงวด / ส่งหลายครั้ง) — create ONE deliveries entry PER batch, even when the destination is the same:
    * "ส่งนนทบุรี 2 ครั้ง ครั้งละ 50,000 / 20/7/65 จำนวน 50,000 / 30/7/65 จำนวน 50,000" → TWO entries: [{destination:'นนทบุรี', qty:50000, delivery_date:'20/07/2565'}, {destination:'นนทบุรี', qty:50000, delivery_date:'30/07/2565'}]
    * "แบ่งส่ง 3 งวด" / "แยกส่ง N ครั้ง" → that many entries; if individual qty given, fill 'qty' for each.
    * If only total qty given but split into N equal batches → divide and fill qty per entry.
    * Same destination repeating across batches is EXPECTED — DO NOT dedupe. The frontend will enable แบ่งส่ง mode and create one row per entry.
- Output MUST be valid JSON parseable by JSON.parse — no trailing commas, no comments.

⚠️ FINAL SELF-CHECK BEFORE RESPONDING — review your JSON one last time. The #1 mistake AI makes is FILLING IN DEFAULTS for empty fields. The form already has its own defaults — your job is to fill ONLY what you can quote from the input. When in doubt, OMIT.

1. paper_type / paper_gram / remark_paper: did you fill these? If yes, can you point to an EXACT word like 'อาร์ตการ์ด', 'Duplex', 'Ivory', 'Kraft', 'แกรม', 'gsm', or a number+'G'/'g' such as '350 G', in the actual TEXT of the user's input? If you cannot quote the exact triggering word, REMOVE these fields. Common mistakes to delete:
   - 'cookie box' / 'snack' / 'food' / customer name → DO NOT translate to Duplex / GBB.
   - SCG drawing codes 'DP350', 'CAD No. Useful', 'Plate No.', 'Knitt:', 'Score:', 'Perf:', 'M/C', 'D/C Sheet', 'Ar:', 'Wt:' → drawing metadata, NEVER paper.
   - 'DP350' → '350' is a DRAWING ID, NOT 350 gsm.

2. corrugated / type=2 / type=3: ONLY emit these when the text EXPLICITLY mentions corrugated keywords: 'ลูกฟูก', 'corrugated', 'CA105/125/150/175', 'KL/KS/KA', 'E-flute', 'B-flute', 'C-flute', 'flute' with a value. EMPTY field labels like 'Flute:' (with nothing after the colon) ARE NOT evidence — they are blank form fields, NOT data. If 'Flute:' has no value after it, DO NOT invent CA125 or any other grade. Default component.type = '1' (plain paperboard, no corrugated). Only escalate to type=2 or 3 when corrugated text is present.

3. quantities: ONLY fill when an explicit quantity is given (e.g. 'ยอด 10,000', '100,000 กล่อง', 'จำนวน 50000', 'Qty: 25000'). EMPTY 'Pcs:' or 'Quantity:' labels in a drawing template are NOT quantities — they are blank fields. NEVER fabricate magic numbers like '10000/20000/50000' to fill the array. If no quantity is stated, leave 'quantities' as an empty array [].

4. deliveries: ONLY fill when an actual Thai province name appears in the text (กรุงเทพ, นนทบุรี, สมุทรปราการ, etc.) tied to a delivery context ('ส่งที่', 'ส่งงาน', 'จัดส่ง', 'delivery'). DO NOT default to 'กรุงเทพ' just because the box has no destination. EMPTY 'Customer' field is NOT a destination. If no destination is stated, OMIT 'deliveries' entirely.

5. box_template_id = 8 (Gable Top): did you verify there is a visible HANDLE CUT-OUT slot in the dieline? If no handle, it is NOT Template 8 — most likely Template 4 (TTAB) or Template 1.

6. dimensions_mm:
   • LENGTH vs WIDTH: length ≥ width is almost always true for a folding carton. If your width > length, swap them.
   • HEIGHT = the MAIN BODY PANEL height — the vertical dimension of the front/back face that sits BETWEEN the top closure (tuck flap area) and the bottom closure (auto-bottom / bottom flaps). It is labeled on the central main panel, NOT at the top or bottom of the dieline.
   • MULTIPLE RED RECTANGLES — CAD dielines often outline the assembled-box faces as red rectangles overlaid on the flat layout. There may be TWO red rectangles stacked vertically:
       - The TOP red rectangle = the box TOP viewed from above (its vertical measurement = box WIDTH, NOT height — because the top face has dimensions LENGTH × WIDTH and is rotated 90° in this projection).
       - The MIDDLE/LOWER red rectangle = the FRONT/BACK face (its vertical measurement = box HEIGHT).
   • DIAGNOSTIC #1: if your candidate height ≈ the box width (e.g. you picked 86 when width=85, or you picked 100 when width≈100), you have selected the top-view rectangle by mistake. Pick the OTHER labeled vertical dimension on the main body panel instead.
   • DIAGNOSTIC #2: do NOT reject a height value just because it is small. The height CAN be 30–60mm (flat cookie/snack boxes are commonly that short). Only reject when the value sits in an obvious flap region: at the very TOP of the dieline above all main panels (= tuck flap depth) or as a small CURVED WING tab extending sideways (= dust flap).
   • WORKED EXAMPLE — SCG-style Cookie box / DP350 dieline (total vertical 252mm): from top down — tuck flap '55.5' → top-face section with vertical label '86' (this is the top-view = box WIDTH, NOT height — note 86 ≈ width 85) → main body section with vertical label '55' (this IS the height) → bottom auto-bottom flaps. Bottom horizontal panels: 20 / 175 / 85 / 175 / 84.5. CORRECT answer: width=85, length=175, height=55, tuck_mm=55.5, flap_mm=54, glue_mm=20. WRONG answer: height=86 (that 86 is the top-face projection of the width).

7. flap_mm (ปีกกล่อง / dust flap): measure the dust flap height from the dieline (the small wing tabs flanking the top closure). Do NOT confuse with the side-glue-tab width (which goes into glue_mm). If the dust flap is clearly visible as ~50-55mm wings on either side of the top tuck, use that value, NOT a small 8-12mm formula estimate.

8. Any other field you cannot back up with an explicit quote from the text/dieline → REMOVE rather than guess. Empty form-template field labels (Customer:, Board:, Flute:, Disk:, M/C:, Plate No.:, Pcs:, Wt:, with nothing filled in) are NOT data — treat them as if they don't exist.`

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

	// Visual template references — image of each template numbered 1..12,
	// each labelled with its name + key construction feature so the AI can
	// cross-check the visual against the name when matching a user's dieline.
	// Last one carries cache_control so the whole image block is cached.
	if (TEMPLATE_IMAGES.length > 0) {
		content.push({ type: 'text', text: 'Below are visual references for templates 1–12. Each image is labelled with its template name + key construction feature. Use these together with the PDF to match the user\'s box style:' })
		TEMPLATE_IMAGES.forEach((img, idx) => {
			const label = TEMPLATE_NAMES[img.id] || 'unnamed'
			content.push({ type: 'text', text: 'Template #' + img.id + ' = ' + label })
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

// Server-side safety net for AI hallucinations. AI sometimes ignores the
// "do not guess" rules and fills fields based on common defaults (Duplex
// for cookie boxes, magic quantities like 10000/20000/50000, default
// destinations like 'กรุงเทพ', corrugated CA125 because the doc has an
// empty 'Flute:' label). This scans available text for trigger words. If
// none exist for a category, strip that category — safer to leave blank
// than to fill with a guess that misleads downstream pricing.
async function stripHallucinations(parsed, userText, files) {
	if (!parsed) return parsed

	let verifiable = String(userText || '').toLowerCase()

	// Re-extract text from files the server CAN read (docx/xlsx/text).
	// Image and PDF text aren't extractable here without extra deps, so we
	// also fall back to the AI's own notes field (which usually transcribes
	// readable text from the input).
	for (const f of files) {
		const mime = (f.mimetype || '').toLowerCase()
		const name = (f.originalname || '').toLowerCase()
		try {
			if (mime.includes('wordprocessingml') || name.endsWith('.docx')) {
				const r = await mammoth.extractRawText({ buffer: f.buffer })
				verifiable += '\n' + (r.value || '').toLowerCase()
			} else if (mime.includes('spreadsheet') || mime.includes('excel') || /\.(xlsx|xls|csv)$/i.test(name)) {
				const wb = XLSX.read(f.buffer, { type: 'buffer' })
				wb.SheetNames.forEach((s) => { verifiable += '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[s]).toLowerCase() })
			} else if (mime.startsWith('text/') || /\.(txt|md|json)$/i.test(name)) {
				verifiable += '\n' + f.buffer.toString('utf8').toLowerCase()
			}
		} catch (e) { /* ignore extraction errors — falls back to notes */ }
	}
	if (parsed.notes) verifiable += '\n' + String(parsed.notes).toLowerCase()

	// Trigger word lists per field category. "If none of these literal
	// substrings appear in the verifiable text, that category is hallucinated."
	const paperKeywords = ['อาร์ต', 'art card', 'card', 'art matt', 'artmatt', 'ไอวอรี่', 'ไอวอรี', 'ivory', 'กล่องแป้ง', 'duplex', 'gbb', 'ดูเพล็กซ์', 'คราฟท์', 'คราฟ', 'kraft', 'แฟนซี', 'fancy', 'c1s', 'c2s', '1/s', '2/s', 'a/c', 'a/m']
	const gramKeywords = ['แกรม', 'gsm', 'g/m', ' gram', 'กรัม']
	const corrugatedKeywords = ['ลูกฟูก', 'ประกบลูกฟูก', 'corrugated', 'flute', 'ca105', 'ca125', 'ca150', 'ca175', 'kl', 'ks', 'ka', 'cb-b', 'cb-e', 'e-flute', 'b-flute', 'c-flute', 'eb-flute', 'bc-flute', 'kraft liner']
	const qtyKeywords = ['จำนวน', 'qty', 'quantity', 'ยอด', 'order', 'pcs', 'pieces', 'ใบ', 'กล่อง']
	// Thai provinces (subset — extend if needed). Used to detect delivery destinations.
	const provinceKeywords = ['กรุงเทพ', 'นนทบุรี', 'ปทุมธานี', 'สมุทรปราการ', 'สมุทรสาคร', 'สมุทรสงคราม', 'นครปฐม', 'อยุธยา', 'พระนครศรีอยุธยา', 'สระบุรี', 'อ่างทอง', 'ลพบุรี', 'สิงห์บุรี', 'ชัยนาท', 'ชลบุรี', 'ระยอง', 'จันทบุรี', 'ตราด', 'ฉะเชิงเทรา', 'ปราจีนบุรี', 'สระแก้ว', 'นครนายก', 'ราชบุรี', 'กาญจนบุรี', 'เพชรบุรี', 'ประจวบ', 'สุพรรณบุรี', 'นครราชสีมา', 'โคราช', 'ขอนแก่น', 'อุดร', 'หนองคาย', 'นครพนม', 'มุกดาหาร', 'สกลนคร', 'เลย', 'หนองบัวลำภู', 'ชัยภูมิ', 'มหาสารคาม', 'ร้อยเอ็ด', 'กาฬสินธุ์', 'ยโสธร', 'อำนาจเจริญ', 'อุบล', 'ศรีสะเกษ', 'สุรินทร์', 'บุรีรัมย์', 'เชียงใหม่', 'เชียงราย', 'ลำพูน', 'ลำปาง', 'แม่ฮ่องสอน', 'น่าน', 'พะเยา', 'แพร่', 'อุตรดิตถ์', 'ตาก', 'สุโขทัย', 'พิษณุโลก', 'พิจิตร', 'กำแพงเพชร', 'นครสวรรค์', 'อุทัยธานี', 'เพชรบูรณ์', 'ภูเก็ต', 'พังงา', 'กระบี่', 'ตรัง', 'สตูล', 'สงขลา', 'พัทลุง', 'นครศรีธรรมราช', 'สุราษฎร์', 'ชุมพร', 'ระนอง', 'ปัตตานี', 'ยะลา', 'นราธิวาส', 'bangkok', 'province', 'จังหวัด', 'ส่งที่', 'ส่งงาน', 'delivery', 'ส่ง']

	const has = (list) => list.some((k) => verifiable.indexOf(k) !== -1)
	const hasPaper = has(paperKeywords)
	const hasGram = has(gramKeywords) || /\b\d{2,4}\s?g\b/.test(verifiable) // รองรับ '350 G' / '350g' (G ตัวเดียว)
	const hasCorrugated = has(corrugatedKeywords)
	const hasQty = has(qtyKeywords) || /\b\d{3,7}\b/.test(verifiable) // any 3-7 digit number
	const hasProvince = has(provinceKeywords)

	let stripped = 0
	const log = (what, val) => { console.log('[AI strip] removed hallucinated ' + what + ': ' + JSON.stringify(val)); stripped++ }

	// Component-level fields
	if (Array.isArray(parsed.components)) {
		for (const c of parsed.components) {
			if (!c) continue
			if (!hasPaper && c.paper_type) { log('paper_type', c.paper_type); delete c.paper_type }
			if (!hasGram && c.paper_gram != null) { log('paper_gram', c.paper_gram); delete c.paper_gram }
			if (!hasPaper && c.remark_paper) { log('remark_paper', c.remark_paper); delete c.remark_paper }
			if (!hasCorrugated) {
				if (c.corrugated) { log('corrugated', c.corrugated); delete c.corrugated }
				// type=2 (ประกบลูกฟูก) / type=3 (เฉพาะลูกฟูก) require corrugated
				// evidence; otherwise force back to type=1 (plain paperboard).
				if (c.type === '2' || c.type === '3' || c.type === 2 || c.type === 3) {
					log('component.type (forced to 1)', c.type)
					c.type = '1'
				}
			}
		}
	}

	// Top-level fields
	if (!hasQty && Array.isArray(parsed.quantities) && parsed.quantities.length > 0) {
		log('quantities', parsed.quantities)
		parsed.quantities = []
	}
	if (!hasProvince && Array.isArray(parsed.deliveries) && parsed.deliveries.length > 0) {
		log('deliveries', parsed.deliveries.map((d) => d && d.destination))
		parsed.deliveries = []
	}

	if (stripped > 0) console.log('[AI strip] total ' + stripped + ' hallucinated field(s) removed')
	return parsed
}

// ค่าเริ่มต้นงานแพคเกจจิ้ง เมื่อ spec ไม่ระบุชนิดย่อย (บังคับแบบ deterministic — ชัวร์กว่า prompt)
//   - กระดาษ "กล่องแป้ง/Duplex" (ไม่ระบุ BBB/GBB/WBB) → Duplex GBB
//   - เคลือบ gloss waterbase ธรรมดา → Waterbase Hi-Rub (คงจำนวนด้านเดิม, default 1s)
function applyPackagingDefaults(parsed) {
	if (!parsed || !Array.isArray(parsed.components)) return parsed
	for (const c of parsed.components) {
		if (!c) continue
		// กระดาษ Duplex ที่ไม่ระบุชนิดย่อย → Duplex GBB
		if (typeof c.paper_type === 'string' && /^duplex\s*$/i.test(c.paper_type.trim())) {
			console.log('[AI default] paper_type "' + c.paper_type + '" → "Duplex GBB"')
			c.paper_type = 'Duplex GBB'
		}
		// เคลือบ gloss waterbase ธรรมดา → Waterbase Hi-Rub
		if (Array.isArray(c.coatings)) {
			for (const ct of c.coatings) {
				if (ct && ct.option === 'Gloss' && typeof ct.type === 'string' && /^waterbase(\s*\d?\s*s)?$/i.test(ct.type.trim())) {
					const sideMatch = ct.type.match(/(\d)\s*s/i)
					const side = sideMatch ? sideMatch[1] : '1'
					console.log('[AI default] coating "' + ct.type + '" → "Waterbase Hi-Rub ' + side + 's"')
					ct.type = 'Waterbase Hi-Rub ' + side + 's'
				}
			}
		}
	}
	return parsed
}

// Wrap client.messages.create with retry-on-overload. Anthropic sometimes
// returns 529 "overloaded_error" or 429 rate-limit during peak hours; both are
// transient. We retry with exponential backoff before surfacing the failure.
async function createWithRetry(client, payload, maxAttempts = 4) {
	let lastErr
	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await client.messages.create(payload)
		} catch (err) {
			lastErr = err
			const status = err && err.status
			const isOverloaded = status === 529 || status === 503
			const isRateLimit = status === 429
			const isRetryable = isOverloaded || isRateLimit || (status >= 500 && status < 600)
			if (!isRetryable || attempt === maxAttempts) throw err
			const delayMs = Math.min(15000, 1500 * Math.pow(2, attempt - 1)) // 1.5s, 3s, 6s, 12s
			console.warn(`[AI] retry ${attempt}/${maxAttempts - 1} after ${delayMs}ms (status=${status} ${err.message})`)
			await new Promise((r) => setTimeout(r, delayMs))
		}
	}
	throw lastErr
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

		const msg = await createWithRetry(client, {
			model: MODEL,
			max_tokens: 4000,
			// temperature=0 → most deterministic. For a spec-extraction task we
			// want the same input → same output as much as possible.
			temperature: 0,
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

		// เก็บ log การใช้งานลงไฟล์ LogAI/YYYY-MM-DD.txt (1 วัน 1 ไฟล์)
		logAIUsage({ user: req.cookies && req.cookies.emp_id, model: MODEL, usage: u, status: 'OK' })

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

		// Strip hallucinated fields (paper, corrugated, quantities, deliveries)
		// when no trigger word is present in any verifiable input text.
		// Safety net for AI prompt rules that AI sometimes ignores.
		try {
			parsed = await stripHallucinations(parsed, text, files)
		} catch (e) {
			console.warn('[AI strip] error (non-fatal): ' + e.message)
		}

		// บังคับค่าเริ่มต้นงานแพคเกจจิ้ง (Duplex GBB / Waterbase Hi-Rub) เมื่อ spec ไม่ระบุชนิด
		try {
			parsed = applyPackagingDefaults(parsed)
		} catch (e) {
			console.warn('[AI default] error (non-fatal): ' + e.message)
		}

		res.json({ success: true, data: parsed, model: MODEL })
	} catch (err) {
		console.error('AI parse-spec error:', err)
		// เก็บ log กรณี error ด้วย (token = 0 เพราะ request ไม่สำเร็จ)
		logAIUsage({ user: req.cookies && req.cookies.emp_id, model: MODEL, status: 'ERROR', error: err.message })
		// Friendly Thai messages for common transient failures.
		let friendly = err.message || 'unknown error'
		const status = err && err.status
		if (status === 529 || /overload/i.test(friendly)) {
			friendly = 'ขณะนี้เซิร์ฟเวอร์ AI ผู้ให้บริการ (Anthropic) ใช้งานล้นมือ ลองใหม่อีกครั้งใน 30 วินาที - 2 นาที (ระบบลองอัตโนมัติ 4 ครั้งแล้ว)'
		} else if (status === 429) {
			friendly = 'ส่ง request ถี่เกินไป (rate limit) กรุณารอสักครู่แล้วลองใหม่'
		} else if (status === 401) {
			friendly = 'API key ไม่ถูกต้อง — กรุณาตรวจสอบ ANTHROPIC_API_KEY ใน .env'
		} else if (status === 402) {
			friendly = 'API credit หมด — กรุณาเติม credit ที่ Anthropic console'
		} else if (status >= 500 && status < 600) {
			friendly = 'เซิร์ฟเวอร์ AI ขัดข้องชั่วคราว ลองใหม่อีกครั้งในไม่กี่นาที'
		}
		res.status(status && status < 600 ? status : 500).json({ success: false, error: friendly, status })
	}
})

module.exports = router
