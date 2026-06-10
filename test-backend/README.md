# test-backend — Mock node_api (Postgres) สำหรับเทส

Backend จำลองของ `node_api` (192.168.5.3:3010) ไว้รันบนเครื่อง/เซิร์ฟเวอร์เทส
ต่อ **Postgres ของคุณเอง** เพื่อ **กันไม่ให้ไปเขียนทับ DB จริงที่มีคนใช้งานอยู่**

## 🔒 หลักประกันความปลอดภัย (อ่านก่อน)

1. ตัวนี้ **ไม่รู้จัก / ไม่เชื่อมต่อ** DB จริงหรือ node_api จริงเลย — ต่อแค่ `DATABASE_URL` ใน `.env` ของตัวเอง
2. frontend จะวิ่งมาหาตัวนี้ **ก็ต่อเมื่อ** คุณเปลี่ยน `node_api` ใน `../config/default.json` ให้ชี้มาที่นี่เท่านั้น
3. รันคนละ port (ค่าเริ่ม **4010**) คนละ DB → แยกขาดจาก prod

> สลับกลับไป prod เมื่อไหร่: เปลี่ยน `node_api` ใน config กลับเป็น `http://192.168.5.3:3010` — จบ

## สถาปัตยกรรม

```
[Frontend Express 3099]  --(config.node_api)-->  [test-backend 4010]  -->  [Postgres ของคุณ]
                                                       │
                                          master data อ่านจาก seed/master/*.json
```

## วิธีติดตั้ง (Ubuntu / Windows)

```bash
# 0) ติดตั้ง Postgres ก่อน (Ubuntu: sudo apt install postgresql) แล้วสร้าง DB
#    createdb estimate_test   (หรือใช้ pgAdmin)

cd test-backend
cp .env.example .env          # แล้วแก้ DATABASE_URL ให้ตรงเครื่องคุณ
npm install
npm run db:push               # สร้างตารางจาก prisma/schema.prisma
npm run db:seed               # สร้าง user เทส + สถานะเอกสาร
npm run import:master         # คัดลอก master data ที่มีจาก "Pornchai AI RFQ" (เท่าที่มี)
npm start                     # รันที่ port 4010
```

## ชี้ frontend มาที่ test-backend

แก้ `../config/default.json`:
```json
"node_api": "http://localhost:4010",
"base_url": "http://hostname:3099"
```
แล้ว restart frontend (`node ../index.js`) → login ด้วย user เทส (ดู `.env`)

## Endpoint ที่จำลอง

| Endpoint | สถานะ | หมายเหตุ |
|----------|-------|----------|
| `POST /user/login` | ✅ ยืนยัน contract | คืน {success, user, accessToken, refreshToken} |
| `GET /user/check-auth` | ✅ | คืน valid:true เสมอ (เทส) |
| `POST /user/token` | ✅ | refresh token |
| `GET /estimate/master_data?type=` | ✅ | อ่านจาก seed/master/<type>.json (ไม่มี = []) |
| `POST /estimate/save_rfq` | ✅ ยืนยัน contract | เก็บ payload + job_data ลง Postgres |
| `POST /estimate/rfq` | ✅ ยืนยัน contract | คืน job_data กลับไป reconstruct ฟอร์ม |
| `GET /estimate/list` | ⚠️ ต้องจูน | shape อาจต้องปรับให้ตรงตาราง index |
| autocomplete / customer / quotations | 🔌 stub | คืนค่าว่างกัน error ไว้ก่อน |

## ฐานข้อมูล — ออกแบบแบบ Hybrid (สำคัญ)

- `tb_rfq.job_data` (jsonb) = **mainData ทั้งก้อน** → ใช้ตอน reload (แหล่งความจริง)
- `tb_rfq.payload` (jsonb) = payload save ทั้งหมด (ทุก tb_* array) → ไว้ทำรายงาน/query
- `tb_rfq_qty` = ตารางจริงของราคาแยกตามยอด (ไว้ query/list)

ข้อดี: **คุณแก้ฟังก์ชันคำนวณ/เพิ่ม field ใน mainData ได้อิสระ** โดยไม่ต้อง migrate ตารางทุกครั้ง
ภายหลังถ้าต้องการตาราง relational ครบ 35 ตาราง (เพื่อรายงาน) ค่อยเพิ่มใน schema ได้

ดู `prisma/schema.prisma`
