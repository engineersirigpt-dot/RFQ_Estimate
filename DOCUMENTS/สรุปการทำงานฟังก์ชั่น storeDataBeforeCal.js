สรุปการทำงานฟังก์ชั่น storeDataBeforeCalcPrice()
1. storeJob() >> เก็บข้อมูล job_name, job_id, is_reprinted, ink_type, print_type, color_limit, flexo_size
2. validate Flexo, paperMarkup
3. validate
3.1 checkValidateNameComp // ชื่อ Comp.
3.2 checkValidatePapernCorrugated // กระดาษ, ลูกฟูก
3.3 checkValidateSpecialInk // การติ๊ก และ การเลือกสีพิเศษ
3.4 checkValidateGluedspot // จุดติดกาว

3.5 store name comp.
    3.6 store glue_spot
3.7 store comp.color & spe - ink
3.8 store paper info
3.9 store corrugated info
3.10 setCalculateUps(index) // คำนวณ paper usage
4. validate other process
4.1 Store Other Process
4.2 Store Handwork Process
4.3 Store Material // อิงจากจำนวน input
4.4 Store Other Cost Process // อิงจากจำนวน input
5. setCalculate....
5.1 DelvieryPrice
5.2 ProcessCost
5.3 MaterialCost
5.4 OtherCostCost
5.5 ChipCost // แกะ
5.6 InspectionCost
5.7 TotalPrice
