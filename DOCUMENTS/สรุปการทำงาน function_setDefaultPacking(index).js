setDefaultPacking()
* ให้ packing kraftwrap เป็นเริ่มต้น และไม่มี packing รูปแบบอื่น
* ฟังก์ชั่นนี้ทำงานเมื่อมีการทำอะไรที่มีผลต่อ layout / คำนวณ lay ใหม่

@packing_size = setCalculatePackingSize(item) คำนวณตามสูตรจะได้ [กว้าง, ยาว, กว้าง_mm, ยาว_mm]
@num_side = กำหนดจำนวนแต่ละด้านเริ่มต้นที่ [1 กว้าง,1 ยาว]
@w_side = ขนาดด้านกว้าง จำนวนด้านกว้าง * packing_size[กว้าง]
@l_side = ขนาดด้านกว้าง จำนวนด้านยาว * packing_size[ยาว]
@Kraftwrap_lay_size = [@w_side, @l_side, @w_side_mm, @l_side_mm]
@obj = {
    bulk_size: @packing_size,
    layKraftwrap: @Kraftwrap_lay_size,
    num_side: @num_side,
    qty_per_kraftwrap: ""
}

>> setKraftwrap(index,obj) >> ถ้า obj ไม่มีค่าอะไรเลย คือไม่มีการ packing รูปแบบนี้
--- START ฟังก์ชั่น setKraftwrap ---
@default_kraftwrap_price = 5 (น่าจะเป็น THB)
@Kraftwrap.info = {
    unit_price : @default_kraftwrap_price,
    num_side : num_side,
    cube_size : @kraftwrap_lay_size,
    bulk_size : @packing_size,
    num_bulk_per_layer : num_side[กว้าง] * num_side[ยาว],
    qty_per_kraftwrap : ""
}
--- END ฟังก์ชั่น setKraftwrap ---