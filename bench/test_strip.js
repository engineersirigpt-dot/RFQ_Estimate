// Verify the stripHallucinations fix on the REAL function in router/ai.js
// (no API call). Confirms: image input keeps paper/qty; text path & empty
// path keep the safety-net behavior.
require('dotenv').config()
const { stripHallucinations } = require('../router/ai')

const baseParsed = () => ({
  quantities: [5000, 6000, 20000],
  components: [{ name: 'SLEEVE BOX', type: 1, box_template_id: 9, paper_type: 'Duplex', paper_gram: 350 }],
})
const imgFile = { mimetype: 'image/png', originalname: 'gefen.png', buffer: Buffer.from('') }

const show = (label, p) => {
  const c = (p.components || [])[0] || {}
  console.log(label)
  console.log('   paper_type =', c.paper_type, '| paper_gram =', c.paper_gram, '| quantities =', JSON.stringify(p.quantities))
}

;(async () => {
  // 1) IMAGE input, empty text — the GEFEN case. EXPECT: kept (fix working)
  show('1) image + empty text  →', await stripHallucinations(baseParsed(), '', [imgFile]))

  // 2) pure text WITHOUT trigger words — safety net must still strip
  show('2) text, no keywords   →', await stripHallucinations(baseParsed(), 'hello world', []))

  // 3) pure text WITH trigger words — must keep
  show('3) text "duplex 350 จำนวน 5000" →', await stripHallucinations(baseParsed(), 'duplex 350 จำนวน 5000 ใบ', []))
})().catch((e) => { console.error(e); process.exit(1) })
