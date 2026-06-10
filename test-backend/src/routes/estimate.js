const express = require('express')
const fs = require('fs')
const path = require('path')
const prisma = require('../db')
const { proxyGet } = require('../proxy')
const router = express.Router()

const MASTER_DIR = path.join(__dirname, '..', '..', 'seed', 'master')

// ---------- master data ----------
// สำคัญ: ฝั่ง frontend (db.setInfo + setCoatingInfo) ต้องการ "array ดิบ" ไม่ใช่ {success,data}
router.get('/master_data', (req, res) => {
  // type อาจมาเป็น 'paper_info' (estimate_type อยู่อีก query แยก)
  const type = String(req.query.type || '').split('&')[0]
  const file = path.join(MASTER_DIR, `${type}.json`)

  if (!type || !fs.existsSync(file)) {
    return res.json([]) // ไม่มีไฟล์ → array ว่าง (dropdown ว่าง แต่ไม่ crash)
  }

  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'))
    // รองรับทั้ง array ดิบ และที่ห่อ {data:[...]} / {success,data}
    const arr = Array.isArray(raw) ? raw : (raw.data || raw.rows || [])
    return res.json(arr)
  } catch (e) {
    console.error('master_data parse error:', type, e.message)
    return res.json([])
  }
})

// ---------- save RFQ ----------
router.post('/save_rfq', async (req, res) => {
  try {
    const body = req.body || {}
    const header = body.tb_rfq || {}
    const qtyRows = Array.isArray(body.tb_rfq_qty) ? body.tb_rfq_qty : []

    // job_data = mainData ทั้งก้อน (string) → parse เก็บเป็น jsonb
    let jobData = {}
    try { jobData = JSON.parse(body?.tb_rfq_log?.job_data || '{}') } catch (_) {}

    const customerName = jobData?.customer?.customer_name || null
    const aeName = jobData?.ae?.ae_name || null
    const jobName = header.job_name || jobData?.job?.job_name || '(no name)'

    const baseData = {
      jobName,
      docType: header.doc_type || 'est',
      customerId: header.customer_id != null ? String(header.customer_id) : null,
      customerName,
      saleId: header.sale_id != null ? String(header.sale_id) : null,
      aeName,
      estimatorId: header.estimator_id != null ? String(header.estimator_id) : null,
      printType: header.print_type || null,
      inkType: header.ink_type || null,
      isReprinted: header.is_reprinted != null ? String(header.is_reprinted) : null,
      isMultipleF: Number(header.is_multiple_f || 0),
      isProfitSharing: Number(header.is_profit_sharing || 0),
      statusId: header.status_id != null ? Number(header.status_id) : null,
      taxPercent: header.tax != null ? Number(header.tax) : null,
      remark: header.remark || null,
      refCopyRfq: body.ref_copy_rfq || null,
      jobData,
      payload: body,
      updatedBy: header.updated_by != null ? String(header.updated_by) : null,
    }

    const mapQty = (q, i) => ({
      qtyIndex: i,
      qtyMain: num(q.qty_main),
      qtyRunon: num(q.qty_runon),
      qtyTotal: num(q.qty_total),
      materialPrice: num(q.material_price),
      platePrice: num(q.plate_price),
      printPrice: num(q.print_price),
      afterpressPrice: num(q.afterpress_price),
      packingPrice: num(q.packing_price),
      subtotalPrice: num(q.subtotal_price),
      totalPrice: num(q.total_price),
      unitPrice: num(q.unit_price),
      tax: num(q.tax),
    })

    let rfq
    if (body.action === 'update' && body.job_id) {
      const jobId = Number(body.job_id)
      rfq = await prisma.rfq.update({ where: { jobId }, data: baseData })
      await prisma.rfqQty.deleteMany({ where: { rfqId: jobId } })
      if (qtyRows.length) {
        await prisma.rfqQty.createMany({ data: qtyRows.map((q, i) => ({ rfqId: jobId, ...mapQty(q, i) })) })
      }
    } else {
      rfq = await prisma.rfq.create({
        data: { ...baseData, createdBy: baseData.updatedBy, qty: { create: qtyRows.map(mapQty) } },
      })
    }

    console.log(`  ✓ saved RFQ job_id=${rfq.jobId} (${rfq.jobName})`)
    return res.json({ success: true, job_id: rfq.jobId, action: body.action || 'new' })
  } catch (e) {
    console.error('save_rfq error:', e)
    return res.json({ success: false, message: e.message })
  }
})

// ---------- reload RFQ ----------
// commonFunction.getDataRFQ ทำ JSON.parse(res.job_data) → ต้องคืน job_data เป็น string
router.post('/rfq', async (req, res) => {
  try {
    const rfqId = Number(req.body?.rfq_id)
    if (!rfqId) return res.json({ success: false, message: 'no rfq_id' })

    const rfq = await prisma.rfq.findUnique({ where: { jobId: rfqId } })
    if (!rfq) return res.json({ success: false, message: 'not found' })

    return res.json({
      success: true,
      job_id: rfq.jobId,
      job_data: JSON.stringify(rfq.jobData),
      created: fmt(rfq.createdAt),
      updated: fmt(rfq.updatedAt),
      status_id: rfq.statusId,
      estimate_check: false,
      request_approve_datetime: null,
      customer_name: rfq.customerName || '',
      customer_no_name: '',
      estimate_date: '',
      log_id: '',
      ref_copy_rfq: rfq.refCopyRfq || '',
      created_by: rfq.createdBy || '',
      updated_by: rfq.updatedBy || '',
      ae_name: rfq.aeName || '',
      ae_name_eng: '',
      open_job_status: 0, // 0 = แก้ไขได้ (กัน alert "เอกสารถูกเปิด Job")
      mi_job_id: null,
      // สำหรับหน้า quotation (type='quote') — ข้อมูลผู้ติดต่อ (เลือกจริงผ่าน dropdown get-contact)
      address: '',
      contact: '',
      tel: '',
      fax: '',
      mobile: '',
      email: '',
      tax_id: '',
      credit_term: (rfq.jobData && rfq.jobData.job && rfq.jobData.job.credit_term_name) || '',
    })
  } catch (e) {
    console.error('rfq error:', e)
    return res.json({ success: false, message: e.message })
  }
})

// ---------- list (หน้า index) ----------
// frontend (fetchlastest50record + search) ยิง POST แล้วอ่าน res[0]=records, res[1]=exportData
router.post('/list', async (req, res) => {
  try {
    const rows = await prisma.rfq.findMany({
      orderBy: { jobId: 'desc' },
      take: 50,
      include: { qty: { orderBy: { qtyIndex: 'asc' } } },
    })
    const records = rows.map(r => ({
      job_id: r.jobId,
      ref_copy_rfq: r.refCopyRfq || '',
      job_name: r.jobName,
      created_by: r.createdBy || '-',
      ae_name: r.aeName || '-',
      customer_name: r.customerName || '-',
      job_qty: r.qty.map(q => q.qtyMain).filter(v => v != null).join(', ') || '-',
      request_approve_datetime: null,
      request_by: '',
      is_profit_sharing: r.isProfitSharing ? 'Yes' : 'No',
      approve_status: r.statusId || '-',
      estimator_name: '-',
      log_data: JSON.stringify((r.jobData && r.jobData.job) || {}),
      total_price: r.qty.map(q => q.totalPrice ?? 0).join(','),
      unit_price: r.qty.map(q => q.unitPrice ?? 0).join(','),
    }))
    // res[0] = records (มี .map), res[1] = exportData
    res.json([records, records])
  } catch (e) {
    console.error('list error:', e)
    res.json([[], []])
  }
})

// ---------- lookups → proxy อ่านจาก prod (read-only) ----------
router.get('/autocomplete', (req, res) => proxyGet(req.originalUrl, res, []))   // ?type=customer|employee|delivery&term=
router.get('/customer', (req, res) => proxyGet(req.originalUrl, res, {}))       // ?customer_id= → credit_term
router.get('/emp_status', (req, res) => proxyGet(req.originalUrl, res, { emp_status: 1 })) // ?emp_id=

// ---------- quotation history ----------
router.get('/quotations_history', async (req, res) => {
  try {
    const qid = req.query.quotation_id ? String(req.query.quotation_id) : ''
    const logs = await prisma.quotationLog.findMany({ where: { quotationId: qid }, orderBy: { id: 'asc' } })
    res.json(logs.map(l => ({
      status_id: l.statusId,
      status_name: l.statusName,
      remark: l.remark || '',
      emp_name: l.empName || '',
      edited: fmt(l.edited),
    })))
  } catch (e) { console.error('quotations_history error:', e); res.json([]) }
})

// ---------- stubs กัน error ----------
router.get('/file/:id', (_req, res) => res.json({ success: true }))
router.get('/rfq/status/log', (_req, res) => res.json({ success: true, data: [] }))
router.get('/history', (_req, res) => res.json({ success: true, data: [] }))

// helpers
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null }
function fmt(d) { return d ? new Date(d).toISOString().slice(0, 19).replace('T', ' ') : '' }

module.exports = router
