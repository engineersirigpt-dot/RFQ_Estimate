# GPT blind labeling — 19 gold candidates

First-pass only. Labels are based solely on the rendered images and the supplied template rules; no answer key was consulted. `uncertain: true` means the image is not a readable dieline or does not reveal the closure geometry.

```json
[
  {"num":1,"template":12,"template_name":"Custom","reason":"มีช่อง die-cut รูปทรงพิเศษบนแผงหลัก จึงเข้ากฎ Custom แม้โครงสร้างเป็นกล่องพับ","confidence":"high","uncertain":false},
  {"num":2,"template":12,"template_name":"Custom","reason":"เป็น LAY ของ dieline #1; กล่องเดี่ยวมีช่อง die-cut รูปทรงพิเศษ","confidence":"high","uncertain":false},
  {"num":3,"template":1,"template_name":"Reverse Tuck End","reason":"กล่องพับ 4 panel มีฝาเสียบธรรมดาทั้งบนและล่าง ไม่มีเส้นทแยง auto-lock; ทิศฝาดูอยู่คนละด้าน","confidence":"medium","uncertain":true},
  {"num":4,"template":12,"template_name":"Custom","reason":"ภาพเป็น screenshot แบบฟอร์ม RFQ ไม่ปรากฏ dieline หรือโครงสร้างฝา จึงจำแนกทรงไม่ได้จากภาพ","confidence":"low","uncertain":true},
  {"num":5,"template":12,"template_name":"Custom","reason":"ภาพเป็นเอกสารขอเสนอราคา ไม่ปรากฏ dieline หรือโครงสร้างกล่อง","confidence":"low","uncertain":true},
  {"num":6,"template":12,"template_name":"Custom","reason":"ภาพเป็นตารางประมาณราคา ไม่ปรากฏ dieline หรือโครงสร้างกล่อง","confidence":"low","uncertain":true},
  {"num":7,"template":1,"template_name":"Reverse Tuck End","reason":"4 panel folding carton มีฝาเสียบธรรมดาด้านบนและล่าง ไม่มี crash-lock/เส้นทแยง; ฝาปิดอยู่คนละทิศ","confidence":"medium","uncertain":true},
  {"num":8,"template":12,"template_name":"Custom","reason":"มีช่องเจาะหน้าต่างสี่เหลี่ยมขนาดใหญ่ที่แผงหน้า จึงเข้ากฎ Custom","confidence":"high","uncertain":false},
  {"num":9,"template":11,"template_name":"Seal End","reason":"LAY ของกล่องที่ปลายทั้งสองเป็นแถบปิด/กาวและมีเส้น perforate บน flap ไม่เห็น tuck flap ปกติหรือ crash-lock ชัด","confidence":"medium","uncertain":true},
  {"num":10,"template":4,"template_name":"Tuck Top Auto Bottom","reason":"screenshot estimate ระบุ Box Outside=4 และ process ระบุ Autolock; ไม่ใช่การอนุมานจาก dieline เต็มภาพ","confidence":"medium","uncertain":true},
  {"num":11,"template":1,"template_name":"Reverse Tuck End","reason":"เป็นภาพซ้ำของ #7: กล่องพับ 4 panel ฝาเสียบธรรมดา ไม่มี crash-lock","confidence":"medium","uncertain":true},
  {"num":12,"template":1,"template_name":"Reverse Tuck End","reason":"ภาพมืด/แสดงเส้นโครงสร้างไม่ครบ แต่ดูเป็นภาพเดียวกับ #7/#11; จึงให้เพียง tentative label","confidence":"low","uncertain":true},
  {"num":13,"template":12,"template_name":"Custom","reason":"มีหน้าต่าง die-cut ครึ่งวงกลมและรูปทรง closure พิเศษ จึงเข้ากฎ Custom","confidence":"high","uncertain":false},
  {"num":14,"template":2,"template_name":"Straight Tuck End","reason":"4 panel folding carton; ฝาเสียบหลักด้านบนและล่างยึดกับ panel เดียวกัน ไม่มี diagonal crash-lock จึงเป็น straight tuck","confidence":"medium","uncertain":true},
  {"num":15,"template":5,"template_name":"Tray","reason":"screenshot estimate ระบุ Box Outside=5; ไม่ปรากฏ dieline ให้ตรวจโครงสร้าง","confidence":"low","uncertain":true},
  {"num":16,"template":12,"template_name":"Custom","reason":"เป็นภาพกล่องประกอบแล้ว มองไม่เห็นรอยพับ/โครงสร้างฝาปิดพอจะจำแนก template","confidence":"low","uncertain":true},
  {"num":17,"template":9,"template_name":"Sleeve","reason":"drawing เป็นแผ่น wrap สี่ panel มี glue tab และไม่มีฝาบน/ล่าง จึงเป็นปลอกสวมเปิดสองด้าน","confidence":"high","uncertain":false},
  {"num":18,"template":4,"template_name":"Tuck Top Auto Bottom","reason":"screenshot estimate ระบุ Box Outside=4; thumbnail เล็กมากจึงใช้เป็นเพียง tentative corroboration","confidence":"low","uncertain":true},
  {"num":19,"template":12,"template_name":"Custom","reason":"มีช่องหน้าต่าง die-cut ขนาดใหญ่และ hang-tab/slot ที่ส่วนบน จึงเข้ากฎ Custom","confidence":"high","uncertain":false}
]
```

