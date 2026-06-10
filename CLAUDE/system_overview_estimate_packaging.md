# System Overview: Estimate Packaging

ไฟล์นี้สรุปภาพรวมระบบเพื่อใช้เป็นบริบทในอนาคตเมื่อ context เก่าถูกตัดทิ้ง

**วัตถุประสงค์**
ระบบนี้ใช้สำหรับประเมินราคางานกล่องบรรจุภัณฑ์ โดยผู้ใช้กรอกสเปคงานและระบบคำนวณ Layout, Paper Usage, กระบวนการผลิต, Packing, Delivery และราคาสุทธิ พร้อมบันทึกเป็นเอกสาร RFQ

**โครงสร้างระบบโดยรวม**
- Server: Node.js + Express + EJS (ไฟล์หลัก `index.js`)
- Client: jQuery‑based UI ที่คำนวณหนักในฝั่ง Browser (`public/js/function_estimate*.js`)
- Master Data: โหลดจาก API แล้วเก็บใน `db` (ดู `public/js/function_estimate_database.js`, `public/js/function_estimate_getMasterData.js`)
- Config API: `config/default.json`, `config/production.json`

**หน้าและโมดูลหลัก**
- `/` หน้า RFQ List ค้นหา/กรอง/Export Excel (`public/index.ejs`, `public/js/function_index.js`)
- `/estimate` หน้า Estimate กรอกสเปคและคำนวณราคา (`public/estimate.ejs`)
- `/view` หน้า View‑only
- `/quote` ระบบ Quotation (สร้าง/แก้ไข/พิมพ์/อนุมัติ)

**แกนข้อมูลหลัก (client)**
- คลาส `Estimate` (`public/js/function_estimate_calculation.js`) เก็บข้อมูลทั้งหมดไว้ใน `est.mainData`
- โครงสร้างสำคัญ
- `job`: ข้อมูล RFQ หลัก เช่น print type, ink type, multiple F, profit sharing
- `qty`: จำนวนงานหลัก/run‑on/AE/customer รองรับหลายยอด
- `component1[]`: ชิ้นส่วนของงาน (สเปค กล่อง กระดาษ ลูกฟูก สี โปรเซส Layout ฯลฯ)
- `process`, `material`, `otherCost`, `delivery`, `totalprice`, `fileUpload`

**โฟลว์หลัก**
1. โหลด master data จาก API → เก็บใน `db`
2. กรอกข้อมูลพื้นฐาน + สเปค component
3. คำนวณ Layout/UPS/Paper Usage
4. คำนวณราคา (ต้นทุน + markup + รวมสุทธิ)
5. แสดง Summary + Export + Save

**จุดคำนวณสำคัญ**
- Layout: open size + tolerance → เลือก machine + std paper → หา ups และ layout ที่เหมาะสม
- กระดาษ/ลูกฟูก: คำนวณ paper usage, waste, split, net, ton
- Process: diecut, chip, inspection, assembly, coating, foilstamp, emboss/deboss, corrugated glue, digital die‑cut
- Packing: paperband, kraftwrap, carton, pallet
- Delivery: คำนวณตามน้ำหนักและ rate ของปลายทาง
- Markup/Profit Sharing: ค่า default อยู่ใน `public/js/data/default.js`

**รองรับหลาย F**
- โหมด “งานมีหลาย F”
- แยก qty, color, special ink และบาง process ตาม F code
- รองรับ packing ต่างกันราย F

**การบันทึกข้อมูล**
- `public/js/prepare_data.js` แปลง `est.mainData` เป็น payload หลายตาราง `tb_rfq_*` เพื่อส่ง API
- เก็บ log และ status log (Draft/Pending/Reject/Approved)

**สถานะเอกสาร**
- จัดการด้วย `public/js/documentStatusManagerClass.js`
- มี remark/reject history และเงื่อนไข readonly ตาม role

**Auth**
- Login ผ่าน API แล้วเซ็ต httpOnly cookie
- Server middleware ตรวจ token/refresh (`public/js/includes/auth.js`)
- Client axios interceptor สำหรับ refresh token (`public/js/auth-interceptor.js`)

