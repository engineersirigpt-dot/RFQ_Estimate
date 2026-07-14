// เทส before/after: prompt เดิม vs +กฎ CUSTOM-FEATURE OVERRIDE บน gold dielines
//   ส่งรูป template 1-12 + ไดไลน์ ให้ Opus 4.8 เลือก box_template — วัดว่า override ช่วยจับ Custom ไหม
// node bench/test_prompt_custom.js
require('dotenv').config()
const fs = require('fs')
const Anthropic = require('@anthropic-ai/sdk')
const client = new Anthropic()
const MODEL = 'claude-opus-4-8'

const TEMPLATE_NAMES = {
  1:'Reverse Tuck End (RTE) — top+bottom tuck flaps OPPOSITE directions, dust flaps + side glue tab',
  2:'Straight Tuck End (STE) — top+bottom tuck flaps SAME direction, dust flaps + side glue tab',
  3:'Tuck Top Snap Lock Bottom (TTSLB) — tuck top, snap-lock bottom, NO bottom glue',
  4:'Tuck Top Auto Bottom (TTAB) — tuck top, auto-bottom WITH glue (diagonal fold + OL marker)',
  5:'Simple Tray / Double Glue Side Wall — flat tray, diagonal corner folds, open top, NO lid',
  6:'Frame-Vue Tray — tray with extra frame/rim on top opening',
  7:'Four Corner Tray with hinged Lid — bento/pizza style',
  8:'Gable Top with Auto Bottom — peaked top + carry HANDLE slot',
  9:'Sleeve — open both ends, just a rectangular tube (4 panels + glue tab, nothing top/bottom)',
  10:'Pillow Box — pillow shape with curved arched ends',
  11:'Seal End — tuck-look but flaps SEALED with glue (asymmetric flaps), tamper-evident',
  12:'Custom — any shape not matching 1-11: flat die-cut, irregular, hexagonal, box+extra-feature',
}
const OVERRIDE = `CUSTOM-FEATURE OVERRIDE — CHECK BEFORE settling on Template 1-11. A box is Template 12 (Custom) whenever its dieline has ANY structural feature the matched template 1-11 does NOT have, EVEN IF the base body/closure looks like a normal tuck/auto-bottom/sleeve box. Custom-forcing features: (a) a WINDOW cut-out — a hole in a MAIN BODY panel to VIEW THE PRODUCT (often PET/OPP film window); (b) a CARRY HANDLE that is NOT the Template-8 gable handle; (c) a CURVED / ARCHED / ROUNDED / NON-STRAIGHT body outline — the body PANEL EDGES themselves are curved (rounded FLAP corners alone do NOT count); (d) attached PARTITION / DIVIDER / INSERT panels; (e) any extra lock tab/panel/cut not in the reference. *** NOT custom-forcing — IGNORE these and classify by the MAIN BODY + BOTTOM, keeping the base template: a HANG-HOLE / EURO-SLOT / rounded header tab for RETAIL HANGING (small extra tab above the body with a hole — very common on RTE), a thumb-notch, rounded flap corners, the standard side glue tab. A tuck box WITH a hang-tab header is STILL Template 1/2/3/4, NOT Custom. *** HARD RULE: a reverse-tuck WITH a product window is Template 12; a tuck box with a curved body outline is 12; but a plain tuck box with only a hang-tab is Template 1.`

const GOLD = [
  { img: 'test/uploads/รูปBloss Jeli_240522_145319.jpg', gold: 1, name: 'bloss (hang-tab) [std]' },
  { img: 'bench/gold/img/19.png', gold: 12, name: 'NATUR (window) [custom]' },
  { img: 'bench/gold/img/13.png', gold: 12, name: 'GENT (curved) [custom]' },
  { img: 'test/uploads/F004695 INSERT APPLAWS 12X70G R-1_110522_172106.jpg', gold: 12, name: 'Applaws INSERT [custom]' },
]
const b64 = (p) => fs.readFileSync(p).toString('base64')
const mtype = (p) => (p.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg')
const templates = []
for (let i = 1; i <= 12; i++) if (fs.existsSync(`public/img/${i}.jpg`)) templates.push({ id: i, b64: b64(`public/img/${i}.jpg`) })

async function classify(dielinePath, useOverride) {
  const content = [{ type: 'text', text: 'Reference box templates (labeled by number):' }]
  for (const t of templates) {
    content.push({ type: 'text', text: `Template ${t.id}: ${TEMPLATE_NAMES[t.id]}` })
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: t.b64 } })
  }
  content.push({ type: 'text', text: '\nNow classify THIS uploaded dieline by CONSTRUCTION (panel layout, flap directions, bottom lock, tray corners). Mirror / glue-tab side does NOT change the template.' })
  content.push({ type: 'image', source: { type: 'base64', media_type: mtype(dielinePath), data: b64(dielinePath) } })
  let rules = 'Pick the best-matching template 1-12. Template 12 = Custom.'
  if (useOverride) rules += '\n\n' + OVERRIDE
  content.push({ type: 'text', text: rules + '\n\nReturn ONLY JSON: {"box_template_id": <1-12 integer>, "reason": "<short>"}' })
  const msg = await client.messages.create({ model: MODEL, max_tokens: 3000, thinking: { type: 'adaptive' }, messages: [{ role: 'user', content }] })
  const txt = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('')
  const m = txt.match(/\{[\s\S]*\}/)
  try { return JSON.parse(m[0]) } catch { return { box_template_id: '?', reason: txt.slice(0, 80) } }
}

;(async () => {
  console.log(`\nเทส box_template: OLD (ไม่มีกฎ) vs NEW (+CUSTOM override) — ${MODEL}\n`)
  console.log('ไดไลน์'.padEnd(30) + 'gold'.padStart(5) + 'OLD'.padStart(6) + 'NEW'.padStart(6))
  console.log('-'.repeat(78))
  let oldHit = 0, newHit = 0
  for (const g of GOLD) {
    const [o, n] = [await classify(g.img, false), await classify(g.img, true)]
    const ok = (x) => (x == g.gold ? '✓' : '✗')
    if (o.box_template_id == g.gold) oldHit++
    if (n.box_template_id == g.gold) newHit++
    console.log(g.name.padEnd(30) + String(g.gold).padStart(5) + `${o.box_template_id}${ok(o.box_template_id)}`.padStart(6) + `${n.box_template_id}${ok(n.box_template_id)}`.padStart(6))
    console.log('   NEW reason: ' + String(n.reason).slice(0, 90))
  }
  console.log('-'.repeat(78))
  console.log(`ถูก: OLD ${oldHit}/${GOLD.length}  →  NEW ${newHit}/${GOLD.length}`)
})().catch((e) => console.error('ERROR:', e.message))
