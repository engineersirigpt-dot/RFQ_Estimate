// proxy อ่านข้อมูลจาก prod แบบ READ-ONLY (autocomplete, customer, contact, approver)
// ใช้ global fetch ของ Node 18+ (ไม่ต้องลง dependency เพิ่ม)
// ⚠️ ใช้เฉพาะ GET/อ่าน เท่านั้น — ไม่มี endpoint เขียนที่ proxy ไป prod
const PROD = process.env.PROD_NODE_API || 'http://192.168.5.3:3010'

// forward GET ไป prod ตาม path เดิม (req.originalUrl) แล้วส่ง JSON กลับ
async function proxyGet(originalUrl, res, fallback = []) {
  try {
    const r = await fetch(PROD + originalUrl)
    const data = await r.json()
    res.json(data)
  } catch (e) {
    console.warn('  ↳ proxy GET fail:', originalUrl, e.message, '→ คืน fallback')
    res.json(fallback)
  }
}

// forward POST (read-only เช่น qt_approver) ไป prod
async function proxyPost(path, body, res, fallback = []) {
  try {
    const r = await fetch(PROD + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    })
    const data = await r.json()
    res.json(data)
  } catch (e) {
    console.warn('  ↳ proxy POST fail:', path, e.message, '→ คืน fallback')
    res.json(fallback)
  }
}

module.exports = { PROD, proxyGet, proxyPost }
