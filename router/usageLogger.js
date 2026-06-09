const fs = require('fs')
const path = require('path')
const moment = require('moment')

// โฟลเดอร์เก็บ log การใช้งาน AI — 1 วัน 1 ไฟล์ (YYYY-MM-DD.txt)
const LOG_DIR = path.join(__dirname, '..', 'LogAI')

// เขียน log การใช้งาน AI 1 บรรทัดต่อ 1 request (append เท่านั้น — ไม่ทับของเดิม).
// ตั้งใจให้ "ไม่ throw" ออกไปกระทบ flow หลัก: ถ้าเขียน log ไม่ได้ก็แค่ warn.
//
// fields:
//   user    - emp_id ของผู้ใช้ (จาก cookie)
//   model   - โมเดลที่เรียก
//   usage   - object จาก Anthropic (msg.usage) หรือ {} ตอน error
//   status  - 'OK' | 'ERROR'
//   error   - ข้อความ error (เฉพาะตอน status=ERROR)
function logAIUsage({ user, model, usage = {}, status = 'OK', error = null }) {
	try {
		if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

		const now = moment()
		const file = path.join(LOG_DIR, now.format('YYYY-MM-DD') + '.txt')
		const ts = now.format('YYYY-MM-DD HH:mm:ss')

		const input = usage.input_tokens || 0
		const cacheRead = usage.cache_read_input_tokens || 0
		const cacheCreate = usage.cache_creation_input_tokens || 0
		const output = usage.output_tokens || 0
		const total = input + cacheRead + cacheCreate + output

		let line =
			`[${ts}] user=${user || 'unknown'}` +
			` | model=${model || '-'}` +
			` | input=${input} cache_read=${cacheRead} cache_create=${cacheCreate} output=${output}` +
			` | total=${total}` +
			` | status=${status}`

		if (status === 'ERROR' && error) {
			line += ` | error=${String(error).replace(/\s+/g, ' ').slice(0, 200)}`
		}

		fs.appendFile(file, line + '\n', (err) => {
			if (err) console.warn('[usageLogger] เขียน log ไม่สำเร็จ:', err.message)
		})
	} catch (e) {
		console.warn('[usageLogger] error (ไม่กระทบการทำงานหลัก):', e.message)
	}
}

module.exports = { logAIUsage }
