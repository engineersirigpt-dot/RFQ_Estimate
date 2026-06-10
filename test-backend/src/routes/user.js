const express = require('express')
const prisma = require('../db')
const { proxyPost } = require('../proxy')
const router = express.Router()

// token ปลอมสำหรับเทส (frontend ไม่ได้ verify ลายเซ็น — แค่เก็บไว้แนบ header)
function fakeToken(prefix) {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e9)}`
}

// POST /user/login
// รองรับ parser ทั้ง login.ejs (อ่าน res.user.*) และ function_index.js (อ่าน res.* top-level)
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {}

  let user = await prisma.user.findUnique({ where: { username: String(username || '') } })

  // fallback: ถ้ายังไม่ seed ใช้ user จาก .env
  if (!user && username === process.env.TEST_USER_USERNAME) {
    user = {
      empId: process.env.TEST_USER_USERNAME,
      empName: process.env.TEST_USER_EMPNAME || 'Test User',
      username: process.env.TEST_USER_USERNAME,
      password: process.env.TEST_USER_PASSWORD,
      roles: [{ user_group_id: 1, sale_group_id: null, enable_price_check: 1, is_super_admin: 0, authorized: 1 }],
    }
  }

  if (!user || user.password !== String(password || '')) {
    return res.json({ success: false, isPassed: 0, message: 'username หรือ password ไม่ถูกต้อง' })
  }

  const roles = user.roles
  const empData = [{ emp_id: user.empId, emp_name: user.empName }]
  const accessToken = fakeToken('access')
  const refreshToken = fakeToken('refresh')

  const payload = {
    isPassed: 1,
    roles,
    data: empData,
    username: user.username,
  }

  return res.json({
    success: true,
    isPassed: 1,
    accessToken,
    refreshToken,
    roles,
    data: empData,
    user: payload, // login.ejs อ่านจากตรงนี้
  })
})

// GET /user/check-auth  (เรียกโดย middleware ฝั่ง Express frontend) → valid เสมอในโหมดเทส
router.get('/check-auth', (req, res) => {
  res.json({ valid: true, expires_at: Date.now() + 24 * 3600 * 1000 })
})

// POST /user/token  → ออก accessToken ใหม่
router.post('/token', (req, res) => {
  res.json({ accessToken: fakeToken('access'), refreshToken: fakeToken('refresh') })
})

// /user/qt_approver → รายชื่อผู้อนุมัติ (proxy อ่านจาก prod — ได้ชื่อจริง)
router.post('/qt_approver', (req, res) => proxyPost('/user/qt_approver', req.body, res, []))
router.get('/qt_approver', (req, res) => proxyPost('/user/qt_approver', req.body, res, []))

module.exports = router
