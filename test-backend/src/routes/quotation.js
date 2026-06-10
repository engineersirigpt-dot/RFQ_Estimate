// ใบเสนอราคา (quotation) — เก็บใน Postgres เทป
// mount ที่ /estimate/quotations
const express = require('express')
const prisma = require('../db')
const router = express.Router()

const STATUS_NAME = { 0: 'Draft', 1: 'Pending Approval', 2: 'Rejected', 3: 'Approved' }

// map header จาก payload (snake) → model (camel)
function mapHeader(h = {}) {
  return {
    rfqId: h.rfq_id || null,
    description: h.description || null,
    docStatus: Number(h.doc_status || 0),
    customerId: h.customer_id || null,
    customerName: h.customer_name || null,
    customerAddress: h.customer_address || null,
    customerContactPerson: h.customer_contact_person || null,
    customerTel: h.customer_tel || null,
    customerFax: h.customer_fax || null,
    customerMobile: h.customer_mobile || null,
    customerEmail: h.customer_email || null,
    creditTerm: h.credit_term || null,
    aeName: h.ae_name || null,
    currencyUnit: h.currency_unit || 'THB',
    exchangeUnit: num(h.exchange_unit) ?? 1,
    priceFormat: h.price_format != null ? Number(h.price_format) : null,
    priceIncludedVat: num(h.price_included_vat),
    vat: num(h.vat),
    priceExcludedVat: num(h.price_excluded_vat),
    editedBy: h.edited_by != null ? String(h.edited_by) : null,
    requestApproveTo1: h.request_approve_to_1 || null,
    requestApproveTo2: h.request_approve_to_2 || null,
    issueDate: h.issue_date || null,
    validDate: h.valid_date || null,
    validDateDay: h.valid_date_day != null ? String(h.valid_date_day) : null,
    deliveryDate: h.delivery_date || null,
    jobInfoTypeId: h.job_info_type_id != null ? Number(h.job_info_type_id) : null,
  }
}

function mapItem(quotationId, it = {}) {
  return {
    quotationId,
    listInfo: it.list_info || null,
    isMainInfo: Number(it.is_mainInfo || 0),
    isQtyList: Number(it.is_qtyList || 0),
    unit: it.unit || null,
    qty: num(it.qty),
    minThbUnitprice: num(it.MIN_THB_unitprice),
    thbUnitprice: num(it.THB_unitprice),
    thbPrice: num(it.THB_price),
    curUnitprice: num(it.CUR_unitprice),
    curPrice: num(it.CUR_price),
  }
}

// ---------- POST /estimate/quotations  (create / edit) ----------
router.post('/', async (req, res) => {
  try {
    const body = req.body || {}
    const header = mapHeader(body.tb_rfq_quotation || {})
    const items = Array.isArray(body.tb_rfq_quotation_list) ? body.tb_rfq_quotation_list : []
    const editedBy = body?.tb_rfq_quotation_log?.edited_by || header.editedBy || null
    const action = body.action || body.type || 'new'

    if (action === 'edit' && body.quotation_id) {
      const qid = body.quotation_id
      await prisma.quotation.update({ where: { quotationId: qid }, data: header })
      await prisma.quotationList.deleteMany({ where: { quotationId: qid } })
      if (items.length) await prisma.quotationList.createMany({ data: items.map(it => mapItem(qid, it)) })
      await prisma.quotationLog.create({
        data: { quotationId: qid, statusId: header.docStatus, statusName: STATUS_NAME[header.docStatus], remark: '', empName: String(editedBy || '') },
      })
      console.log(`  ✓ updated quotation ${qid}`)
      return res.json({ success: true, quotation_id: qid })
    }

    // new — สร้างก่อนแล้วตั้ง quotation_id จาก id
    const created = await prisma.quotation.create({
      data: { ...header, quotationId: `tmp-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, createdBy: String(editedBy || '') },
    })
    const quotationId = `QT${String(created.id).padStart(5, '0')}`
    await prisma.quotation.update({ where: { id: created.id }, data: { quotationId } })
    if (items.length) await prisma.quotationList.createMany({ data: items.map(it => mapItem(quotationId, it)) })
    await prisma.quotationLog.create({
      data: { quotationId, statusId: header.docStatus, statusName: STATUS_NAME[header.docStatus], remark: '', empName: String(editedBy || '') },
    })
    console.log(`  ✓ created quotation ${quotationId}`)
    return res.json({ success: true, quotation_id: quotationId })
  } catch (e) {
    console.error('quotation save error:', e)
    return res.json({ success: false, message: e.message })
  }
})

// ---------- GET /estimate/quotations?rfq_id=  (list) ----------
router.get('/', async (req, res) => {
  try {
    const rfqId = req.query.rfq_id ? String(req.query.rfq_id) : undefined
    const rows = await prisma.quotation.findMany({
      where: rfqId ? { rfqId } : {},
      orderBy: { id: 'desc' },
    })
    const data = rows.map(q => ({
      quotation_id: q.quotationId,
      customer_name: q.customerName || '',
      issue_date: q.issueDate || '',
      valid_date: q.validDate || '',
      credit_term: q.creditTerm || '',
      approved_by_name: q.approvedByName || '-',
      customer_contact_person: q.customerContactPerson || '',
      doc_status: q.docStatus,
      doc_status_name: STATUS_NAME[q.docStatus] || '',
      request_approve_to: [q.requestApproveTo1, q.requestApproveTo2].filter(Boolean).join(','),
    }))
    res.json(data)
  } catch (e) {
    console.error('quotation list error:', e)
    res.json([])
  }
})

// ---------- POST /estimate/quotations/status  (approve/reject) ----------
router.post('/status', async (req, res) => {
  try {
    const { quotation_id, status_id, remark, emp_id } = req.body || {}
    const sid = Number(status_id)
    await prisma.quotation.update({
      where: { quotationId: quotation_id },
      data: { docStatus: sid, approvedByName: sid === 3 ? String(emp_id || '') : undefined },
    })
    await prisma.quotationLog.create({
      data: { quotationId: quotation_id, statusId: sid, statusName: STATUS_NAME[sid], remark: remark || '', empName: String(emp_id || '') },
    })
    res.json({ success: true })
  } catch (e) {
    console.error('quotation status error:', e)
    res.json({ success: false, message: e.message })
  }
})

// ---------- GET /estimate/quotations/:quotation_id  (detail) ----------
router.get('/:quotationId', async (req, res) => {
  try {
    const q = await prisma.quotation.findUnique({
      where: { quotationId: req.params.quotationId },
      include: { items: { orderBy: { id: 'asc' } } },
    })
    if (!q) return res.json({ success: false, message: 'not found' })

    const quotation_info = {
      quotation_id: q.quotationId,
      rfq_id: q.rfqId,
      description: q.description,
      doc_status: q.docStatus,
      customer_id: q.customerId,
      customer_name: q.customerName,
      customer_address: q.customerAddress,
      customer_contact_person: q.customerContactPerson,
      customer_tel: q.customerTel,
      customer_fax: q.customerFax,
      customer_mobile: q.customerMobile,
      customer_email: q.customerEmail,
      credit_term: q.creditTerm,
      ae_name: q.aeName,
      currency_unit: q.currencyUnit,
      exchange_unit: q.exchangeUnit,
      price_format: q.priceFormat,
      price_included_vat: q.priceIncludedVat,
      vat: q.vat,
      price_excluded_vat: q.priceExcludedVat,
      issue_date: q.issueDate,
      valid_date: q.validDate,
      valid_date_day: q.validDateDay,
      delivery_date: q.deliveryDate,
      job_info_type_id: q.jobInfoTypeId,
      request_approve_1: q.requestApproveTo1,
      request_approve_2: q.requestApproveTo2,
    }
    const list_info = q.items.map(it => ({
      list_info: it.listInfo,
      is_mainInfo: it.isMainInfo,
      is_qtyList: it.isQtyList,
      unit: it.unit,
      qty: it.qty,
      MIN_THB_unitprice: it.minThbUnitprice,
      THB_unitprice: it.thbUnitprice,
      THB_price: it.thbPrice,
      CUR_unitprice: it.curUnitprice,
      CUR_price: it.curPrice,
    }))
    res.json({ quotation_info, list_info })
  } catch (e) {
    console.error('quotation detail error:', e)
    res.json({ success: false, message: e.message })
  }
})

// ---------- DELETE /estimate/quotations/:quotation_id ----------
router.delete('/:quotationId', async (req, res) => {
  try {
    await prisma.quotation.delete({ where: { quotationId: req.params.quotationId } })
    res.json({ success: true })
  } catch (e) {
    console.error('quotation delete error:', e)
    res.json({ success: false, message: e.message })
  }
})

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null }

module.exports = router
