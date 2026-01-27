สรุปการงาน function_setCalculatePaperbandCost(item)
setCalculatePaperbandCost(component)
1. หาข้อมูล info อ้างอิงจาก packing kraftwrap หรือ carton
2. คำนวณ หาจำนวน ราคาต่อหน่วย
3. คำนวณ ราคารวม

@default_paperband_price = 0.5 //THB/stack
1. หา paperband_info
    @info.paperband = setCalculatePaperbandStack(comp, objPacking)
        @default_paperband_allowance = 25.4
        @packing_size = getPackingSize(item) //คำนวณตามแต่ละ templateด
        @thickness_per_cp = component.thickness.mm.packing_thickness

        หาด้านสั้น / ด้านยาว
        ถ้า packing_size[2] < packing_size[3]
            ถ้าใช่ @short_side = packing_size[2] 
                , @long_side = packing_size[3]
            ถ้าไม่ใช่ ให้เป็นค่าตรงข้าม
        @stack_height = qty_per_paperband * thickness_per_cp
        
        หาเส้นรอบวง
        @circ = (2 * short_side + (2 * qty_per_paperband * thickness_per_cp) + default_paperband_allowance)
        @paperband_per_roll = ปัดเศษ(info.roll_length * 1000 / circ)


        *เช็คว่ามี kraftwrap ไหม ถ้ามี อิงจาก kraftwrap ถ้าไม่มี อิงจาก carton

        เช็คว่ามี kraftwrap ไหม
            kraftwrap_qty_per_pack = จำนวนงาน / pack
            // ถ้า จำนวนชิ้นงาน/wrap < จำนวนชิ้นงานต่อ paperband
            // ให้จำนวนชิ้นงานต่อ paperband = จำนวนชิ้นงาน/wrap
            ถ้า kraftwrap_qty_per_pack <= qty_per_paperband
            @qty_per_paperband = kraftwrap_qty_per_pack

            kraftwrap_qty = kraftwrap_qty //จำนวน kraftwrap
            @wrapped_qty = ( kraftwrap_qty - 1 ) * kraftwrap_qty_per_pack // หาจำนวนงานที่ wrap แล้ว
            @stack = ปัดเศษ(wrapped_qty / qty_per_paperband) + ปัดเศษ( (จำนวนงาน - wrapped_qty) / qty_per_paperband )

            จะได้ข้อมูลตาม "ยอดงาน"
            @paperband = {
                qty, // ยอดงาน
                stack,
                roll_usage: stack * kraftwrap_qty / paperband_per_roll,
                cost_per_stack: roll_price / paperband_per_roll
            }

        เช็คว่ามี carton ไหม
            qty_per_carton = carton.qty_per_carton
            @qty_per_paperband = info.qty_per_paperband
            ถ้า qty_per_carton <= qty_per_paperband
                @qty_per_paperband = qty_per_carton
            
            carton_qty = carton.qty
            in_carton_qty = (carton.carton_qty - 1) * qty_per_carton
            qty = จำนวนยอดงาน
            stack = (in_carton_qty / qty_per_paperband ) + (qty - in_carton_qty / qty_per_paperband)
            
            จะได้ข้อมูลตาม "ยอดงาน"

            @paperband = {
                qty, // ยอดงาน
                stack,
                roll_usage: stack * carton_qty / paperband_per_roll,
                cost_per_stack: roll_price / paperband_per_roll
            }

        *คำนวณหาขนาด paperband stack_size 
        setCalculatePaperbandStackSize(comp, paperband, short_side, long_side, stack_height)
            stack_size=[
                mm2inch(short_side + 2 * (paperband.info.thickness)), // นิ้ว
                mm2inch(long_side), // นิ้ว
                mm2inch(stack_height + 3 *(paperband.info.thickness)), // นิ้ว
                short_side + 2 * (paperband.info.thickness),
                long_side,
                stack_height + 3 * (paperband.info.thickness)
            ]

            stack_weight = comp.weight * qty_per_paperband
            paperband.info.stack_size=stack_size
            paperband.info.stack_weight=stack_weight
2. คิดราคา
        @unit_price = default_paperband_price * cost_per_stack
        @paperband_qty = stack
        @price = (default_paperband_price * cost_per_stack) * stack
        
        
    
            
            
            
            
// 2. คิดราคา packing
//     @unit_price = @default_paperband_price + cost_per_stack
//     @pack_qty = @stack 
//     @price =  @default_paperband_price + cost_per_stack * stack