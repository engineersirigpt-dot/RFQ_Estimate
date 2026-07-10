// AI parse competition: เวอร์ชันคุณ (validateAndFix) vs เวอร์ชันพี่ (stripHallucinations)
// รันสเปกเดียวกันผ่านทั้ง 2 pipeline แล้วให้ AI กรรมการตัดสินว่าใครแม่นกว่า
// Usage: node bench/compete.js [จำนวนเคส]
require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const fs = require('fs')
const path = require('path')
const user = require('./ai_user')
const siri = require('./ai_siri')

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5'
const JUDGE_MODEL = 'claude-sonnet-4-5'
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ---- test cases: อ่านจากไฟล์ Test Case ของ P'Art (คอลัมน์ Description = สเปก input จริง) ----
const XLSX = require('xlsx')
const TC_FILE = path.join(__dirname, '..', "Test Case - AI Input (Estimate Packaging - P'Art) (Engineer).xlsx")
function loadCases() {
  const wb = XLSX.readFile(TC_FILE)
  const rows = XLSX.utils.sheet_to_json(wb.Sheets['Test Case'], { header: 1, blankrows: false })
  const cases = []
  for (let i = 4; i < rows.length; i++) {
    const r = rows[i] || []
    const no = r[2], desc = r[3]
    if (desc && String(desc).trim().length > 10) {
      cases.push({ id: String(no || cases.length + 1), label: 'เคส ' + (no || cases.length + 1), text: String(desc).replace(/\r/g, '').trim() })
    }
  }
  return cases
}
const CASES = loadCases()

function textOf(msg) {
  return msg.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n')
}

async function runUser(text) {
  const content = await user.buildContentFromUpload(text, [])
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 4000, temperature: 0,
    system: [{ type: 'text', text: user.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  let parsed = user.extractJson(textOf(msg))
  parsed = user.validateAndFix(parsed)
  return parsed
}

async function runSiri(text) {
  const content = await siri.buildContentFromUpload(text, [])
  const msg = await siri.createWithRetry(client, {
    model: MODEL, max_tokens: 4000, temperature: 0,
    system: [{ type: 'text', text: siri.SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content }],
  })
  let parsed = siri.extractJson(textOf(msg))
  parsed = await siri.stripHallucinations(parsed, text, [])
  parsed = siri.applyPackagingDefaults(parsed)
  return parsed
}

const JUDGE_PROMPT = (spec, a, b) => `You are judging two AI systems (A and B) that extract structured packaging-RFQ data from a Thai/English spec.

Score each 0-10 on three axes, then pick a winner. The MOST important axis is **no-hallucination**: inventing a value the spec does not state (e.g. a paper type, gram, box style, color count, delivery province that isn't there) is a serious error. Leaving a field out when the spec is silent is CORRECT, not a miss.

Return ONLY a JSON object, no prose:
{"a":{"accuracy":n,"completeness":n,"no_hallucination":n},"b":{"accuracy":n,"completeness":n,"no_hallucination":n},"winner":"A"|"B"|"tie","reason":"สั้นๆ ภาษาไทย","a_hallucinations":["field=value ที่เดาเกิน"],"b_hallucinations":[...]}

=== SOURCE SPEC ===
${spec}

=== EXTRACTION A ===
${JSON.stringify(a, null, 1)}

=== EXTRACTION B ===
${JSON.stringify(b, null, 1)}`

async function judge(spec, a, b) {
  const msg = await client.messages.create({
    model: JUDGE_MODEL, max_tokens: 1500, temperature: 0,
    messages: [{ role: 'user', content: JUDGE_PROMPT(spec, a, b) }],
  })
  const t = textOf(msg)
  const s = t.indexOf('{'), e = t.lastIndexOf('}')
  return JSON.parse(t.slice(s, e + 1))
}

async function main() {
  // โหมด list: แค่โชว์เคสที่จะรัน ไม่เรียก API
  if (process.argv[2] === 'list') {
    console.log(`พบ ${CASES.length} เคสในไฟล์ Test Case:\n`)
    CASES.forEach((c) => console.log(`[${c.id}] ${c.text.replace(/\n/g, ' | ').slice(0, 90)}`))
    return
  }
  const n = parseInt(process.argv[2] || CASES.length, 10)
  const cases = CASES.slice(0, n)
  const results = []
  let userWins = 0, siriWins = 0, ties = 0
  let userScoreSum = 0, siriScoreSum = 0

  console.log(`\n=== AI Parse Competition — ${cases.length} เคส (model: ${MODEL}) ===\n`)

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i]
    process.stdout.write(`[${i + 1}/${cases.length}] ${c.label} ... `)
    try {
      const [uOut, sOut] = await Promise.all([runUser(c.text), runSiri(c.text)])
      // สลับ A/B กันลำเอียงตำแหน่ง — ใช้ index คี่/คู่ (ไม่ใช้ random เพื่อ reproducible)
      const userIsA = i % 2 === 0
      const a = userIsA ? uOut : sOut
      const b = userIsA ? sOut : uOut
      const v = await judge(c.text, a, b)
      // map winner กลับเป็น user/siri
      let winner = 'tie'
      if (v.winner === 'A') winner = userIsA ? 'user' : 'siri'
      else if (v.winner === 'B') winner = userIsA ? 'siri' : 'user'
      const uScore = userIsA ? v.a : v.b
      const sScore = userIsA ? v.b : v.a
      const uTot = (uScore.accuracy + uScore.completeness + uScore.no_hallucination)
      const sTot = (sScore.accuracy + sScore.completeness + sScore.no_hallucination)
      userScoreSum += uTot; siriScoreSum += sTot
      const uHall = userIsA ? v.a_hallucinations : v.b_hallucinations
      const sHall = userIsA ? v.b_hallucinations : v.a_hallucinations
      if (winner === 'user') userWins++; else if (winner === 'siri') siriWins++; else ties++
      console.log(`winner=${winner.toUpperCase()}  (คุณ ${uTot}/30 | พี่ ${sTot}/30)`)
      results.push({ id: c.id, label: c.label, winner, userScore: uTot, siriScore: sTot, reason: v.reason, userHallucinations: uHall, siriHallucinations: sHall, userOut: uOut, siriOut: sOut })
    } catch (e) {
      console.log(`ERROR: ${e.message}`)
      results.push({ id: c.id, label: c.label, error: e.message })
    }
  }

  console.log(`\n=== สรุป ===`)
  console.log(`ของคุณ (validateAndFix) ชนะ: ${userWins}`)
  console.log(`ของพี่ (stripHallucinations) ชนะ: ${siriWins}`)
  console.log(`เสมอ: ${ties}`)
  console.log(`คะแนนรวมเฉลี่ย — คุณ ${(userScoreSum / cases.length).toFixed(1)}/30 | พี่ ${(siriScoreSum / cases.length).toFixed(1)}/30`)
  fs.writeFileSync(path.join(__dirname, 'compete_results.json'), JSON.stringify(results, null, 2), 'utf8')
  console.log(`\nบันทึกผลละเอียด: bench/compete_results.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
