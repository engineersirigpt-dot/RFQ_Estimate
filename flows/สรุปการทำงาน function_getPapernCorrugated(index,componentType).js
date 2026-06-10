getPapernCorrugated(index,componentType)
* เช็คประเภทของ Component เพื่อหาข้อมูล paper / corrugated

1. หาข้อมูลกระดาษ

paper = getPaperInfo(index)
    markup = % ได้จากการกรอก
    paperPercent = มาร์กอัพราคา(บาท)ได้จากการกรอก
    sheet_unit_price = ติ๊กว่าเป็นราคาต่อแผ่น หรือ กิโล
    cost = ราคากระดาษ
    gram = ได้จากที่เลือก [gram1, gram2, gram3]

    *หาข้อมูล paper info จาก ข้อมูลใน db โดยเทียบ code และ gram
    สรุปจะได้ข้อมูล
    {
        paper_code  // ได้จาก db
        paper_name  // ได้จาก db ฟิลด์ paper_type
        paper_cost
        paper_markup
        paper_gram
        paper_thickness // ได้จาก db
        paper_percent
        sheet_unit_price
        is_custom
        remark
    }
    

corrugated.info = getCorrugatedInfo(index)
    num_layer = ได้จากที่เลือก จำนวนชั้น
    flute_type = ได้จากที่เลือก A B C D E F G
    type_1,
    type_2,
    type_3,
    gram_1,
    gram_2,
    gram_3,
    * หาข้อมูล corrugated info จาก ข้อมูลใน db โดยเทียบ type และ gram ทั้งหมด
    สรุปจะได้ข้อมูล
    {
        name // ได้จาก db
        flute_type,
        num_layer,
        gram,
        all_gram // ได้จาก db
        thickness // ได้จาก db
        corrugated_markup  // default 1.1
        corrugated_glued_cost // 0.0015,//THB/sq inch ตารางนิ้ว
        remark
        cost //ได้จาก db เฉพาะลูกฟูก
    }