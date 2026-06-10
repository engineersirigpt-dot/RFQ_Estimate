require('dotenv').config()
const express = require('express')
const cors = require('cors')

const userRoutes = require('./routes/user')
const estimateRoutes = require('./routes/estimate')
const quotationRoutes = require('./routes/quotation')
const customerRoutes = require('./routes/customer')

const app = express()
const PORT = process.env.PORT || 4010
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || true

// CORS: เปิดให้ frontend (คนละ origin) เรียกได้ พร้อม Authorization header
app.use(cors({ origin: FRONTEND_ORIGIN, credentials: true }))

// payload RFQ ใหญ่มาก → ขยาย limit
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// log ทุก request (เห็นว่า frontend ยิงอะไรมา)
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${req.method} ${req.originalUrl}`)
  next()
})

app.get('/', (_req, res) => res.json({ ok: true, service: 'estimate-test-backend' }))

app.use('/user', userRoutes)
app.use('/estimate/quotations', quotationRoutes) // ต้อง mount ก่อน /estimate
app.use('/estimate', estimateRoutes)
app.use('/customer', customerRoutes)

// stub กัน 404 ของ endpoint ที่ยังไม่ทำ (คืนค่าว่าง ไม่ให้ frontend error)
app.use((req, res) => {
  console.warn('  ↳ stub (ยังไม่ implement):', req.method, req.path)
  res.json({ success: true, data: [] })
})

app.listen(PORT, () => {
  console.log('============================================')
  console.log(` test-backend running:  http://localhost:${PORT}`)
  console.log(` DB: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':****@')}`)
  console.log(` CORS origin: ${FRONTEND_ORIGIN}`)
  console.log('============================================')
})
