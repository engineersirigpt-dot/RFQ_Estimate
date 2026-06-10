# Dieline + 3D feature bundle

ไฟล์ฟีเจอร์ **Dieline generation + 3D preview** สำหรับโปรเจกต์ Estimate-Packaging

## ไฟล์ในชุดนี้ (วางทับตาม path เดิมในโปรเจกต์)

### ไฟล์หลัก (ไฟล์ใหม่)
- `public/js/function_dieline_3d.js` — 3D rendering (buildSpec / buildBoxGroup / Viewer)
- `public/js/function_dieline.js` — dieline frontend (modal, เรียก /dieline/generate)
- `public/js/library/three.min.js` — Three.js (ไลบรารี 3D — จำเป็น)
- `public/estimate_3dtest.html` — หน้าทดสอบ 3D แยก (เปิด /estimate_3dtest.html)
- `router/dieline.js` — backend proxy → diecuttemplates.com

### ไฟล์ wiring (ไฟล์เดิมที่ถูกแก้ — ถ้ามี repo อยู่แล้วให้ merge เฉพาะส่วนนี้)
- `public/estimate.ejs` — เพิ่ม `<script>` 3 ตัว (ดูบรรทัด ~45-47):
  ```html
  <script src="./js/function_dieline.js"></script>
  <script src="./js/library/three.min.js"></script>
  <script src="./js/function_dieline_3d.js"></script>
  ```
- `index.js` — mount dieline router:
  ```js
  const dielineRouter = require('./router/dieline')
  app.use('/dieline', checkAuth, dielineRouter)
  ```
- `.env.example` — ต้องมี key (ใส่ค่าจริงใน .env เอง):
  ```
  DIECUTTEMPLATES_API_KEY=xxxxxxxx
  DIECUTTEMPLATES_BASE_URL=https://sandbox.api.diecuttemplates.com
  ```

## หมายเหตุ
- **ไม่ได้แนบ `.env` จริง** (มี API key) — ใช้ `.env.example` เป็นแม่แบบ แล้วเติม key เอง
- `router/dieline.js`: TEMPLATE_MAP ชื่อ template ถูกแก้ให้ตรง 12 แบบจริงแล้ว แต่ `becf-xxxxx` id
  ของ type 6,7,8,9,10,11 ยัง "best guess" — ต้อง verify กับ diecuttemplates.com (ดู `// TODO verify id`)
- ขอ sandbox API key ฟรีที่ https://www.diecuttemplates.com/dielines-api-keys
