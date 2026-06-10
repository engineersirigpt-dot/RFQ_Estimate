# 03 — Frontend (UI, Data Flow, mainData)

ฝั่ง browser: โครงสร้างข้อมูล, lifecycle หน้า, การ save (การคำนวณดู `02-CALCULATION-ENGINE.md`)

## est.mainData — โครงสร้างข้อมูลกลาง

object เดียวที่เก็บทุกอย่างของ estimate (นิยามใน `function_estimate_calculation.js` บรรทัด 1-23):

```
mainData = {
  job: { job_name, job_id, is_reprinted, is_use_previous_plate, ink_type,
         print_type (Offset/Flexo/Jet Press/Konica), flexo_size, color_limit,
         is_multiple_f, is_different_packing, is_request_approve, approve_status,
         is_profit_sharing, is_cancel_total_profit_sharing, credit_term_id, estimate_check },
  ae: { ae_id, ae_name },
  customer: { customer_id, customer_name },
  estimator: { estimator_id, estimator_name, estimate_check, approve_status },
  qty: { main:[], runon:[], runon_percent, customer:int, ae:int, totalqty:[] },
  component1: [ {
      box_type: { type_id, type_name, packing_layer, glued_spot },
      packaging_size: { fold_size, open_size, packing_size },
      paper: { paper_code, gram, type, color },
      corrugated_layer: { info },
      color: [{ inside, outside }],
      paper_info: { paper_align, parallel_side, std_paper_id, realPaperSize },
      paper_usage: {...},  machine: {...},  layout: {...},  paper_tolerance: {...},
      special_ink: [], foilstamp: [], bossing: [], coating: [],
      f_detail: { f_list: [{ f_code, f_qty, runon_qty, ae_qty, customer_qty }] }  // multiple-F
  } ],
  material: [{ type_id, name, cost_type, cost_per_unit, info, line }],
  process: [{ type_id, process_id, type(afterpress/other/handwork), name, info, line }],
  delivery: [{ qty_rate:[], destination:{ destination_id, destination_name } }],
  totalprice: [{ paper, corrugated, special_ink, material, plate, proof, print,
      afterpress, block, delivery, other, mark_up_percent, mark_up_price,
      mark_down_percent, mark_down_price, total_price, final_price, unit_price,
      tax, customer_gift, price_diff, marking_percent, loss, profit_sharing }],
  fileUpload: [{ id, name, active }],
  tax: 3, currency_no: 'THB', exchange_rate: 1, remark, date, priceDiff:[], customer_gift:[]
}
```

**Data flow:** UI input → `storeJob()/storeCustomer()/storeQty()/storeTolerance()/storePaperSize()` → `est.set*()` อัปเดต mainData → คำนวณ → `displayData2UI()` render กลับ

## Page Load Lifecycle (estimate.ejs + readyFunction.js)

**ลำดับโหลด script** (estimate.ejs): config.js → default.js → mockup.js → function_estimate_calculation.js (คลาส Estimate) → function_estimate_readyFunction.js → function_estimate.js

**Document ready (`function_estimate_readyFunction.js`):**
1. Auth check — อ่าน role จาก localStorage → enable/disable field ราคาตาม `enable_price_check`
2. STATUS manager init (role, approval callbacks), datepicker
3. **Fetch master data** — `Promise.all()` ดึง 22 ชนิด → `db.setInfo(data)`:
   paper_info, coating_info, corrugated_info, foilstamp_info, blockstamp_info, price_info, min_price_info, waste_info, blockdiecut_info, boxtemplate_info, specialink_info, specialink_factor_info, jetpress_waste_info, jetpress_info, marking_price_info, machine_std_paper_info, delivery_rate_info, paper_code_type, process_type, price_type, konica_waste_info, exchange_rate
4. `getListfromDB()` (เติม dropdown) → `getJobID(url)` (ถ้ามี `?jobid` โหลด RFQ เดิม, ไม่งั้นสร้างใหม่) → `setPage()` (bind events)

**โหลด RFQ เดิม:** `getJobID()` → `setDataRFQ({rfq_id, type:'common'})` → fetch `/estimate/rfq` → `displayEstimateData()`

## db class (`function_estimate_database.js`)

```
class Database { db = { paper_info, coating_info, corrugated_info, foilstamp_info,
  block_stamp_info, price_info, min_price_info, waste_info, block_diecut_info,
  box_template_info, special_ink_info, special_ink_factor_info, jetpress_waste_info,
  jetpress_info, marking_price_info, machine_std_paper_info, delivery_rate_info,
  paper_code_type, process_type, price_type, konica_waste_info, exchange_rate }
  setInfo(arr) {...} }
var db = new Database()
```

**Readers (`function_estimate_getMasterData.js`):** `get_box_template_arr()`, `get_corrugated_*()`, `get_coating_code()`, `getPaperPrice(type,gram,sourcePaperId)`, `getMasterPaperPrintType()`, `getFoilStampColor()`

## fetchData (`function_estimate_fetchData.js`)

`fetchMasterData(type)` → `/estimate/master_data?type=` | `checkFileExist()` | `fetchExchangeRate()` | `getRFQStatusLog()` | `getCustomerInfo()` | `getEmployeeInfo()` — ทั้งหมดคืน Promise

## Save Flow (`prepare_data.js` → `prepareDatatoDB()`)

1. เรียก `est.setCalculateDeliveryPrice()`
2. action = "new" ถ้า job_id ว่าง ไม่งั้น "update"
3. แปลง Flexo size array → comma string
4. สร้าง `tb_rfq` (flatten job/customer/estimator/qty/pricing → คอลัมน์ DB)
5. สร้าง `tb_rfq_qty` ต่อ qty.main (material_price, plate_price, print_price, afterpress_price, packing_price, subtotal, total, unit_price, tax, customer_gift, price_diff, markup/markdown, loss, profit_sharing)
6. แนบไฟล์ active → `tb_rfq_file`
7. status log = snapshot mainData JSON เต็ม + transition
8. output `dat.data_DB = { action, job_id, tb_rfq, tb_rfq_qty, tb_rfq_price, ... }` → **POST `/estimate/save_rfq`**

## Display (`function_estimate_displayData2UI.js`)

`displayEstimateData(data)` → โหลด mainData → เรียก `displayJobInfo2()`, `displayJobQty2()`, `displayComponent2()`, `displayLayout()`, `displayPacking()`, `summary()`, `summary_excel()` → show/hide ปุ่ม (#calc_layout, #calc_price_after_change, #print)

## Trigger คำนวณ (`function_estimate.js` — 637KB)

- `#calc_price` click → `save_data()` → prepareDatatoDB → POST save_rfq
- เปลี่ยน input → `checkRequiredInput()` → โชว์ปุ่ม `#calc_price_after_change`

## default.js — ค่าคงที่สำคัญ (`public/js/data/default.js`, ~645 บรรทัด)

| หมวด | ค่า |
|------|-----|
| Tolerance (Offset) | bleed 3, gripper 12, color_bar 8, paper_edge 4 (mm) |
| Color | max_color 4, paper_waste 300, waste_per_color 50 |
| Markup standard | plate 800/สี, paper 10%, import 13%, afterpress 0% |
| Profit Sharing | plate 1875/สี, paper 18%, print_rate 0.14/แผ่น, print_min 1400, afterpress 20%, packing 25%, delivery 20% |
| Plate | polymer 6.53/sqin, reprint 5.94/sqin, block_min 50, reprint_reduce 50% |
| Corrugated | tolerance 0.375, markup 10%, glued 0.0015/sqin |
| Coating | opp_cold_film 0.0103/sqin |
| Machines | L444SP (Cut1), L440 (Cut2), LS1029 (Cut3), Flexo(4), Jet Press(5), Konica(6) |
| Pallet | 6 ขนาด, น้ำหนัก ≤750kg, สูง ≤44", เปล่า 25kg |
| Packing | Kraftwrap 5/ชิ้น 0.5mm ≤5kg; Carton 5/ชิ้น +พิมพ์ 3 ≤15kg |
| Delivery | 1500/ตัน |

**Print type config (บรรทัด 89-223):**
- Offset: gripper12/color_bar8/paper_edge4/bleed3, proof 500/component
- Flexo: gripper25/color_bar3/bleed3/paper_edge4
- Jet Press: gsm 190-500, reduce_paper_waste 30%
- Konica: gsm 60-350, gripper35/paper_edge15, reduce_paper_waste 30%

## Quote Detail (`function_quote_detail.js`)

- โหลด: อ่าน rfq_id + quotation_id จาก URL → new (ฟอร์มเปล่า+วันนี้) / edit / view (disable หมด)
- events: เปลี่ยนสกุลเงิน → `setChangeExchangeRate()`, add/delete row, `.qty-list` → `changeTotalPrice()`, customer contact lookup, request approval
- save: validate (item list, THB unit price, customer info, required) → `prepareQuotationData()` → `save_quotation(action, data)`
- **commit ล่าสุด:** `Swal.fire` แจ้ง error เมื่อ save quotation ไม่สำเร็จ

## Core files reference (จาก CLAUDE.md)

| File | หน้าที่ |
|------|---------|
| function_estimate_calculation.js | คลาส Estimate (~8,850 บรรทัด) — 16 cost items |
| data/default.js | config default |
| function_estimate_layout.js | UPS, layout, tolerance, box formulas |
| function_estimate_validate.js | input validation, business rules (72KB) |
| function_estimate_processInfo.js | process: die-cut, foil, coating, delivery (40KB) |
| function_estimate.js | UI interaction + calc bridge (637KB) |
| function_estimate_readyFunction.js | event handlers + init (117KB) |
| function_estimate_displayData2UI.js | render (46KB) |
| function_estimate_database.js | db class master data |
| function_estimate_getMasterData.js | helper อ่าน db |
| function_estimate_fetchData.js | API calls |
| prepare_data.js | transform mainData → save |
