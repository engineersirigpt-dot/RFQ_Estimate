** PACKING - CARTON
getCartonInfo(index) 
    * เก็บข้อมูล Packing รูปแบบอื่นๆ
    storePaperband(index)
        * เก็บค่า paperband_obj = { ชนิดสายคาด , จำนวนต่อ band }
        est.setPaperband(index,paperband_obj)
        * ค่าที่ถูก set default จะได้ตามชนิดสายคาดที่เลือก
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
        1.เก็บจำนวนแต่ละด้าน -> num_side = [กว้าง , ยาว]
        2.เก็บข้อมูลจำนวนชิ้น / kraftwrap -> qty_per_kraftwrap
        3.หา packing_size 
            * คำนวณ lay kraftwrap โดยเอาจำนวนแต่ละด้าน * ขนาด
            setCalculateKraftwrapSize(num_side)
                1.หา packing_size ตามสูตรคำนวณของแต่ละ component.
                2. หา bulk_size โดยเช็คว่าติ๊ก paperband ไหม
                    TRUE เอา thickness ของ ชนิดสายคาดที่เลือกมาคำนวณ bulk_size
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
                    FALSE bulk_size จะเท่ากับ packing_size
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
        1. เก็บข้อมูล จำนวนชั้นลูกฟูก, ชนิดลอน , ชนิดลูกฟูก type, gram [gram1,gram2,gram3]
        2. เก็บข้อมูล carton (inner size) ตามที่กรอก / ระบบ default 
            carton_size = [กว้าง, ยาว, สูง]
        3. เก็บข้อมูล layer_carton = จำนวนชั้น
        4. หาหน่วย Unit ถ้ามีติ๊ก kraftwrap หน่วยจะเป็น kraftwrap ถ้าไม่มีจะเป็น pcs
        5. หาข้อมูล กระดาษลูกฟูกจากฐานข้อมูล โดนเทียบ ชนิด - แกรม จะได้ข้อมูล 
            {
                grade,
                all_gram : total_gram,
                thickness : flute_thickness,
                cost : rate
            }
        6. จะได้ข้อมูล 
            {
                inner_size = carton_size,
                layer_carton,
                corrugated : {
                    flute_type : ชนิดลอน,
                    
                }
            }
setCalculateCorrugatedCtn(index)