// /customer/* — proxy อ่านจาก prod
const express = require('express')
const { proxyGet } = require('../proxy')
const router = express.Router()

// GET /customer/get-contact?customer_id= → array ผู้ติดต่อ (จาก prod)
router.get('/get-contact', (req, res) => proxyGet(req.originalUrl, res, []))

module.exports = router
