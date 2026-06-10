** PACKING - การทำงานของฟังก์ชั่น getCartonInfo(index)
getCartonInfo(index) 
    * เก็บข้อมูล Packing paperband , kraftwrap , carton

-------------------------------------------------------
    * เก็บข้อมูล paperband
    storePaperband(index)
        สรุปฟังก์ชั่น >>
            1.เก็บข้อมูลจากการกรอก 1. ชนิดสายคาด 2.จำนวนต่อสายคาด
            2.หาข้อมูลของแต่ละชนิดสายคาด และบันทึกข้อมูล

        การทำงานของฟังก์ชั่น >>
        * เก็บค่า paperband_obj ค่าที่เก็บมี { ชนิดสายคาด , จำนวนต่อ band }
        est.setPaperband(index,paperband_obj)
        * ค่าที่ถูก set default จะได้ตามชนิดสายคาดที่เลือก
            ข้อมูลชนิดสายคาด
            {
                type:'white_paper',
                price:100,
                length:100, //metre
                width:30, //mm
                thickness:0.2 //mm
            },
            {
                type:'brown_paper',
                price:100,
                length:100, //metre
                width:30, //mm
                thickness:0.2 //mm
            },
            {
                type:'plastic',
                price:100,
                length:100, //metre
                width:30, //mm
                thickness:0.2 //mm
            }

        * เซ็ทค่า info = {
            roll_width = default.width, //
            roll_length = default.length,
            type = ชนิดสายคาด,
            roll_price = default.price,
            thickness = default.thickness,
            qty_per_paperband =  จำนวนต่อ band
        }
---------------------------------------------------
    * เก็บข้อมูล kraftwrap
    storeKraftwrap(index)
        * เช็คว่าติ๊ก kraftwrap ไหม ถ้าติ๊กก็ทำงานต่อข้างล่าง
        สรุปฟังก์ชั่น >>
            1.เก็บข้อมูลจำนวนชิ้นในแต่ละด้านจากการกรอก
            2.คำนวณขนาด bulk_size และ kraftwrap_lay_size
            3.เก็บราคา default และ จำนวน/ชั้น  โดยเอาจำนวนด้านกว้าง*ยาว
            4.เก็บจำนวนชิ้น / wrap
            5.บันทึกข้อมูลทั้งหมด

        การทำงานของฟังก์ชั่น >>
        1.@num_side = [กว้าง , ยาว] เก็บข้อมูลจากที่กรอก (เก็บจำนวนแต่ละด้าน)
        2.@qty_per_kraftwrap เก็บข้อมูลจำนวนชิ้น ต่อ kraftwrap 
        3.หา packing_size 
            setCalculateKraftwrapSize(num_side)
                1.หา packing_size ตามสูตรคำนวณของแต่ละ component.
                2.หา bulk_size โดยเช็คว่าติ๊ก paperband ไหม
                    [ติ๊ก] เอา thickness ของ ชนิดสายคาดที่เลือกมาคำนวณ bulk_size
                        1.หาด้านสั้น-ยาว ของ packing_size W < L 
                            TRUE bulk_size = [ 
                                    W + ( 2 * thickness) นิ้ว,
                                    L นิ้ว,
                                    W มิล,
                                    L มิล
                            ]
                            FALSE bulk_size = [ 
                                L นิ้ว,
                                W + ( 2 * thickness) นิ้ว,
                                L มิล,
                                W มิล,
                            ]
                    [ไม่ติ๊ก] bulk_size จะเท่ากับ packing_size
        4. layKraftwrap = [
            จำนวนด้านกว้าง * bulk_size[0] นิ้ว,
            จำนวนด้านยาว * bulk_size[0] นิ้ว,
            จำนวนด้านกว้าง * bulk_size[0] มิล,
            จำนวนด้านยาว * bulk_size[0] มิล,
        ]
        5. est.setKraftwrap(index,kraftwrap_obj) 
            *เซ็ทค่า info = {
                unit_price : default_kraftwrap_price, // 5 บาท
                num_side : จำนวนด้าน [ กว้าง , ยาว],
                cube_size : layKraftwrap จากข้อ 4 ,
                bulk_size : bulk_size จากข้อ 3.2,
                num_bulk_per_layer : จน.ด้านกว้าง * จน.ด้านยาว,
                qty_per_kraftwrap : qty_per_kraftwrap จากข้อ 2
            }
---------------------------------------------------
    * เก็บข้อมูล Carton
    storeCarton(index)
        สรุปฟังก์ชั่น >>
        1.เก็บข้อมูลจาก UI ทุกอย่าง
        2.หาหน่วย
        3.หาข้อมูลกระดาษลูกฟูก
        4.เก็บข้อมูล

        การทำงานของฟังก์ชั่น >>
        * เช็คว่าติ๊ก carton ไหม ถ้าติ๊กก็ทำงานต่อข้างล่าง
        1. เก็บข้อมูล num_layer(จำนวนชั้นลูกฟูก), 
            ชนิดลอน , 
            ชนิดลูกฟูก type (เอาไว้หาข้อมูลจากฐานข้อมูล), 
            gram [gram1,gram2,gram3] (เอาไว้หาข้อมูลจากฐานข้อมูล)
        2. เก็บข้อมูล carton (inner size) ตามที่กรอก / ระบบ default 
            @carton_size = [กว้าง, ยาว, สูง]
        3. เก็บข้อมูล @layer_carton = จำนวนชั้น default 1
        4. @unit =  ถ้ามีติ๊ก kraftwrap หน่วยจะเป็น kraftwrap ถ้าไม่มีจะเป็น pcs
        5. หาข้อมูล กระดาษลูกฟูกจากฐานข้อมูล โดนเทียบ ชนิด , แกรม จากฐานข้อมูล (db.db.corrugated_info) จะได้ข้อมูล 
            {
                grade,
                all_gram : total_gram,
                thickness : flute_thickness,
                cost : rate
            }
        6. จะได้ข้อมูล 
            {
                inner_size : @carton_size,
                layer_carton : @layer_carton,
                corrugated : {
                    flute_type : ชนิดลอน,
                    grade,
                    gram จากข้อ 1,
                    all_gram จากข้อ 5,
                    thickness จากข้อ 5,
                    price จากข้อ 5,
                    corrugated_layer num_layer
                },
                unit : @unit
            }
        7. est.setCarton(index,carton_obj) เก็บข้อมูลจากข้อ 6
            info = {
                inner_size,
                layer_carton,
                corrugated,
                bulk :{ unit เก็บแค่หน่วย}
            }
-----------------------------------------------
* เก็บข้อมูล Pallet
storePallet(index)
    สรุปฟังก์ชั่น >>
        1. เก็บข้อมูลจาก ขนาด pallet , การขนส่งจากที่เลือก
        2. บันทึกข้อมูลไปใช้ในการคำนวณ

    @pallet_delivery = การขนส่งที่เลือก ในประเทศ / ต่างประเทศ
    @pallet_size = ขนาด
    
    setPallet() 
        pallet.info = {
            delivery_id : pallet_delivery,
            pallet_id : pallet_size,
        }
-----------------------------------------------
setCalculatePackingCost(index)
    1. storeDeliveryData // เก็บข้อมูลแบ่งส่ง
    ถ้า 1 ไม่สำเร็จ ไม่ทำต่อแล้ว

    est.setCalculateKraftwrapCost2(item,index)
        *ดูจากไฟล์ สรุปการทำงาน function_setCalculateKraftwrapCost2(item,index)
    est.setCalculateCartonCost(item,false,index)
        *ดูจากไฟล์ สรุปการทำงาน function_setCalculateCartonCost(item,index)
    est.setCalculatePaperbandCost(item)
        *ดูจากไฟล์ สรุปการงาน function_setCalculatePaperbandCost(item).js
    est.setCalculatePalletCost(item,index)
        *ดูจากไฟล์ สรุปการงาน function_setCalculatePalletCost(item).js
    est.setCalculateDelivery(item)
-----------------------------------------------
ถ้า setCalculatePackingCost สำเร็จ ทำข้างล่างต่อ
getCartonInfo_after_recalc(index)
    *โชว์ข้อมูล carton บน UI 
    showCartonInfo(index,carton_info)
    
    bulk_size = carton.info.bulk.bulk_size[0] > bulk_size[1] 
            ใช่ เรียงใหม่เป็น 0,2,1
            ไม่ใช่ เรียงใหม่เป็น 1,2,0
    1 = w_innerCtnSize = info.size.inner_size[0]
    2 = l_innerCtnSize = info.size.inner_size[1]
    3 = h_innerCtnSize = info.size.inner_size[2]

    4 = carton_info_layer_per_carton = info.carton.layer_per_carton
    5 = carton_info_qty_per_carton = info.carton.qty_per_carton
    6 = carton_info_weight_per_carton = info.net_weight
    
    7 = carton_info_qty_per_layer = info.carton.qty_per_layer
    8 = carton_info_bulk_per_layer = info.carton.bulk_per_layer
    9 = carton_info_weight_per_layer = info.carton.weight_per_layer
    10 = carton_info_unit = info.bulk.unit
    11 = carton_info_unit_size = bulk_size[1] x bulk_size[0] x bulk_size[2]
