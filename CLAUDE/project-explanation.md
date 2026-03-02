#file : Description
./config/default.json : ไฟล์ config API , BASE URL , PORT ของระบบสำหรับ Dev.
./config/production.json : ไฟล์ config API , BASE URL , PORT ของระบบสำหรับ Production.
./DOCUMENTS/\* : ไฟล์เอกสารต่างๆที่ใช้ในการพัฒนาระบบ
./flows/\* : notes / flow สรุปการทำงานของระบบ (version เก่า)
./public/index.ejs : หน้าแรกของระบบ
./public/header.ejs : ไฟล์ header สำหรับ include class / script / library ต่างๆ
./public/estimate.ejs : ไฟล์หน้า UI การคำนวณราคา
./public/js/data/default.js : ไฟล์ MASTER DATA / Default Data ของระบบการคิดราคา

- defaultData.tolerance : ระยะเผื่อของกระดาษที่ถูกนับเข้าไปก่อนการวาง Layout
- defaultData.color_limit : เรทการคิดเผื่อสีกรณีเลือกทำเล่มลิมิตสี
- defaultData.^\*\_marking : เรท markup ราคาในส่วนต่างๆ โดยแบ่งแยกเป็น 2 กรณีหลักคือ 1. profit_sharing คือเรท markup ราคากรณีมีการแบ่ง profit sharing , 2. default_marking เรท markup ปกติ
- defaultData.print_type_config : config ต่างๆกรณีเลือกรูปแบบพิมพ์ใดๆ เช่น mix/max gram กระดาษ , สี , สีพิเศษ , ระยะเผื่อ Layout , component type ที่สามารถทำงานกับรูปแบบพิมพ์นี้ได้
- defaultData.^\*\_price , cost , rate : เรท config ต่างๆของแต่ละส่วนในระบบใช้สำหรับเป็นตัวคูณราคา / จำนวน / default ตัวเลข เป็นต้น
- defaultData.machine : เครื่องจักรต่างๆที่สามารถเลือกทำงาน และคิดราคาได้ โดยจะมี config min , max size ของกระดาษที่สามารถเข้าเครื่องได้ และข้อกำหนดด้านจำนวนสีที่พิมพ์ , component type ที่สามารถใช้เครื่องนี้ได้ เป็นต้น
- defaultData.\_pallet , kraftwrap , carton , paperband : config ต่างๆ เช่น ราคา , limit , ขนาด , น้ำหนัก ของ Packing ต่างๆที่สามารถเลือกทำได้ในระบบ
- defaultData.component_type : ประเภทของ Component ต่างๆที่สามารถคิดราคาโดยยึดจากประเภทกระดาษ

./public/js/commonFunction.js : ไฟล์ที่รวบรวมฟังก์ชั่นที่ใช้งานบ่อยในระบบ
./public/js/function_estimate_calculation.js : Class สำหรับคำนวณค่าต่างๆ ตั้งแต่ Layout ไปจนถึงราคา
./public/js/function_estimate_database.js : Class สำหรับเก็บข้อมูล Master Data ที่ fetch จาก API และถูกเรียกใช้ผ่าน class db แทน
./public/js/function_estimate_getMasterData.js : รวบรวมฟังก์ชั่นเพื่อเป็นตัวกลางในการเรียกข้อมูลจาก Class db
./public/js/function_estimate_fetchData.js : ฟังก์ชั่นสำหรับ Get ข้อมูลจาก API
./public/js/function_estimate_layout.js : ฟังก์ชั่นที่เกี่ยวข้องกับการคำนวณ Layout บางส่วน (บางฟังก์ชั่นไม่ได้ถูกนำไปใช้งานจริง)
./public/js/function_estimate_displayData2UI.js : ฟังก์ชั่นสำหรับนำข้อมูลประเมินราคามาแสดงผลเป็นหน้า UI
./public/js/function_estimate.js : ฟังก์ชั่นตัวกลางที่ถูก Event handler trigger และเรียกใช้งาน class หรือทำ Logic ต่างๆให้สำเร็จ
./public/js/prepare_data.js : ฟังก์ชั่นสำหรับเตรียม save ข้อมูลเข้า Database
./public/js/function_estimate_readyFunction.js : ไฟล์ที่รวบรวม Event Handler ทั้งหมดเอาไว้
