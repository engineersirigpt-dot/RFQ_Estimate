# Machine Spec Summary

เอกสารนี้สรุปข้อมูลเครื่องจักรจากระบบ (ไฟล์ `public/js/data/default.js`) และเตรียมพื้นที่สำหรับข้อมูลข้อกำหนดจาก `sheet_machine.pdf` เพื่อนำไปใช้เป็นเงื่อนไขเลือกเครื่องจักร

---

## 1) นิยามฟิลด์ที่ใช้ในระบบ

- `min_size` / `max_size`: ขนาดงานขั้นต่ำ/สูงสุดของเครื่องในรูปแบบ `[กว้าง(นิ้ว), ยาว(นิ้ว), กว้าง(mm), ยาว(mm)]`
- `w_range` / `l_range`: ช่วงขนาดกว้าง/ยาวที่เครื่องรองรับ (รูปแบบเดียวกับ `min_size/max_size`)
- `print_type`: ประเภทพิมพ์ที่เครื่องรองรับ
- `compType`: ประเภทชิ้นงานที่เครื่องรองรับ (1=ไม่ประกบ, 2=ประกบ, 3=เฉพาะลูกฟูก)
- `color`: จำนวนสีที่เครื่องรองรับ (`min`, `max`)
- `machine_size.id`: หมวดเครื่อง (เช่น Cut 1 / Cut 2 / Flexo / Jet Press / Konica)
- `size_options`: เงื่อนไขขนาดเพิ่มเติม (เช่น Flexo ตามจำนวนชั้นลูกฟูก)

---

## 2) เครื่องจักรจากระบบ (default.js)

### 2.1 กลุ่ม Offset (Cut 1/2/3)

- **L444SP (Cut 1)**
  - machine_id: 3422, machine_size.id: 1
  - print_type: Offset
  - compType: 1, 2
  - color: 0–8
  - min_size: [18.11, 24.41, 460, 620.01]
  - max_size: [33, 45.275, 840, 1150]
  - w_range: [18.11, 33, 460, 840]
  - l_range: [24.41, 45.275, 620.01, 1150]

- **L440 (Cut 2)**
  - machine_id: 3407, machine_size.id: 2
  - print_type: Offset
  - compType: 1, 2
  - color: 0–6
  - min_size: [14.18, 20.48, 360.17, 520.19]
  - max_size: [28.35, 40.56, 720.09, 1030.22]
  - w_range: [14.18, 28.35, 360.17, 720.09]
  - l_range: [20.48, 40.56, 520.19, 1030.22]

- **LS1029 (Cut 3)**
  - machine_id: 3507, machine_size.id: 3
  - print_type: Offset
  - compType: 1, 2
  - color: 0–8
  - min_size: [10.24, 14.18, 260.09, 360.17]
  - max_size: [20.87, 29.53, 530.1, 750.06]
  - w_range: [10.24, 20.87, 260.09, 530.1]
  - l_range: [14.18, 29.53, 360.17, 750.06]

### 2.2 กลุ่ม Flexo

- **เครื่องทำกล่องบรรจุสินค้า (Flexo)**
  - machine_id: 5518, machine_size.id: 4
  - print_type: Offset, Flexo
  - compType: 3
  - color: 0–8
  - size_options (ตามชั้นลูกฟูก):
    - **2 ชั้น**
      - min_size: [15.75, 21, 400.05, 533.4]
      - max_size: [57, 50, 1447.8, 1270]
      - w_range: [15.75, 57, 400.05, 1447.8]
      - l_range: [21, 50, 533.4, 1270]
    - **3–5 ชั้น**
      - min_size: [15.75, 21, 400.05, 533.4]
      - max_size: [57, 94.4, 1447.8, 2397.76]
      - w_range: [15.75, 57, 400.05, 1447.8]
      - l_range: [21, 94.4, 533.4, 2397.76]

### 2.3 กลุ่ม Digital

- **Jet Press**
  - machine_id: 5527, machine_size.id: 5
  - print_type: Jet Press
  - compType: 1, 2
  - color: 0–8
  - min_size: [15.5, 21.5, 393, 546]
  - max_size: [23.03, 29.52, 585, 750]
  - w_range: [15.5, 23.03, 393, 585]
  - l_range: [21.5, 29.52, 546, 750]

- **Konica**
  - machine_id: 5528, machine_size.id: 6
  - print_type: Konica
  - compType: 1
  - color: 0–8
  - min_size: [5.51, 7.16, 140, 182]
  - max_size: [13.00, 19.17, 330.2, 487]
  - w_range: [5.51, 13.00, 140, 330.2]
  - l_range: [7.16, 19.17, 182, 487]

### 2.4 เครื่องค่าเริ่มต้น (Placeholder)

- **Machine “-”**
  - machine_id: 9998, machine_size.id: 9998
  - print_type: Offset, Flexo, Jet Press, Konica
  - compType: 1, 2, 3
  - color: 0–0
  - min_size/max_size/w_range/l_range เป็นค่าเริ่มต้นกว้างมาก (ใช้เป็น placeholder)

---

## 3) ข้อกำหนดระดับ Print Type ที่เกี่ยวกับการเลือกเครื่อง

- **Offset**: รองรับ Component Type 1/2/3, Special Ink ใช้ได้
- **Flexo**: รองรับ Component Type 3 เท่านั้น, Special Ink ปิด, จำนวนสีต่อด้าน ≤ 2
- **Jet Press**: Component Type 1/2, Special Ink ปิด, Gram 190–500 gsm
- **Konica**: Component Type 1 เท่านั้น, Special Ink ปิด, Gram 60–350 gsm

หมายเหตุ: เงื่อนไขจำนวนสี (Flexo ≤ 2, Offset+UV ≤ 6) เป็นข้อจำกัดก่อนวาง Layout จากระบบ

---

## 4) ข้อมูลจากไฟล์ PDF `sheet_machine.pdf`

> ยังไม่สามารถดึงข้อมูลจาก PDF ได้ในสภาพแวดล้อมนี้ (ไม่มีเครื่องมืออ่าน PDF)

กรุณาส่งข้อมูลจาก PDF ในรูปแบบข้อความ หรืออนุญาตให้ติดตั้งเครื่องมืออ่าน PDF แล้วฉันจะเติมข้อมูลส่วนนี้ให้ครบถ้วนทันที

โครงสร้างที่เตรียมไว้สำหรับเติมจาก PDF:
- รายชื่อเครื่อง + สเปคหลัก (ขนาด, วัสดุ, ประเภทงานที่รองรับ)
- เงื่อนไข/ข้อจำกัดเฉพาะเครื่อง (เช่น min/max size เพิ่มเติม, ชนิดกระดาษ/ความหนาที่รับได้)
- ข้อห้ามหรือเงื่อนไขพิเศษ (เช่น งานชนิดใดห้ามใช้เครื่องบางรุ่น)

