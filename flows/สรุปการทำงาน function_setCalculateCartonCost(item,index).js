การทำงานของฟังก์ชั่น
est.setCalculateCartonCost(item,false,index)
* ฟังก์ชั่นที่เกี่ยวข้องที่สำคัญคือ 
    1. getBulkCartonObj() // หาส่วนประกอบของสิ่งที่อยู่ใน carton
    2. setCalculateCarton() // คำนวณส่วนประกอบต่างๆของ carton
        2.1. getRearrangeBulkSize() //
        2.2. getMinCartonSize() // หา lay_size ที่มีขนาดน้อยที่สุด
        3.3. setCalculateBoxLayinginCarton() //วางเลย์ carton
        3.4. setCalculateCorrugatedcarton() // หาขนาดลูกฟูกที่ใช้
    3. คำนวณราคาค่า pack 
    4. คำนวณราคาจัดส่ง

*item.thickness ได้จาก ฟังก์ชั่นคำนวณน้ำหนัก
@default_carton_price = 1 THB/carton
เช็คว่า bulk.unit เป็นอะไร
ถ้าเป็น 'piece'
    @bulk_size = [
        packing_size[0],
        packing_size[1],
        item.thickness.inch.packing_thickness,
        packing_size[2],
        packing_size[3],
        item.thickness.mm.packing_thickness
    ]
    @unit_info = ""
    
ถ้าเป็น 'kraftwrap'
    @unit_info = ข้อมูลของ packing kraftwrap
    @bulk_size = kraftwrap.info.outer_size

เช็คว่า เป็นการคำนวณใหม่หรือไม่ (เคยคำนวณ carton ไว้แล้วหรือยัง)
ถ้าใช่
    @inner_size = carton.info.inner_size
ถ้าไม่ใช่
    @inner_size = ''

* หา bulk 
@info.bulk = this.getBulkCartonObj(item, bulk.unit, unit_info, bulk_size)
    case bulk.unit = 'piece':
        var bulk = {
            unit : unit,
            bulk_size : bulk_size,
            qty_per_bulk : 1,
            weight_per_bulk : component.weight.weight
        }
        break
    case  bulk.unit= 'paperband': 
        var bulk = {
            unit : unit,
            bulk_size : bulk_size,
            qty_per_bulk : unit_info.info.qty_per_paperband,
            weight_per_bulk : unit_info.info.stack_weight,
        }
        break
    case bulk.unit = 'kraftwrap': 
        var bulk = {
            unit : unit,
            bulk_size : bulk_size,
            qty_per_bulk : unit_info.info.qty_per_pack,
            weight_per_bulk : unit_info.info.gross_weight
        }
        break

*คำนวณรายละเอียดต่างๆของ carton ที่ต้องใช้ในการคำนวณราคา
@carton_info = setCalculateCarton(info.bulk, inner_size ) {
    @default_limit_carton_weight = default  15 // kg

    @lay_bulk_size = getRearrangeBulkSize(info.bulk.bulk_size)
        bulk_size[0] > [1] จะเรียง lay_bulk_size ได้ [0,2,1,3,5,4]
        bulk_size[0] < [1] จะได้ [1,2,0,4,5,3]

    ถ้า inner_size = ''
        default_carton = [11,17]
        carton_lay_height = ''
        carton_lay_size = getMinCartonSize(lay_bulk_size, default_carton)
            *เป็นสูตรคำนวณหา max, min 
            1. หา min , max จาก bulk_size[0] , bulk_size[1]
            2. ให้ค่าเริ่มต้น min_w = default_carton[0] , min_l = default_carton[1]
            3. เช็คว่าตรงกับเงื่อนไขไหน 
                case 1 : default_carton[0] < min และ default_carton[1] < min
                    ให้ค่า min_w = min , min_l = max
                case 2 : default_carton[0] < min และ default_carton[1] >= min และ default_carton[1] < max
                    ให้ค่า min_w = max
                case 3 : default_carton[0] < min และ default_carton[1] >= max
                    min_w = min
                case 4 : default_carton[0] >= min และ default_carton[0] < max และ default_carton[1] < max
                    min_l = max
                case 5 : default_carton[0] >= max และ default_carton[1] < min
                    min_l = min
            4. จะสรุปได้ค่า carton_lay_size = [min_w, min_l]

    ถ้า inner_size != ''
        carton_lay_size = [
            inner_size[0] - 0.75, //กว้าง
            inner_size[1] - 0.75, //ยาว
            inner_size[2] - 0.75 // สูง
        ]
        carton_lay_height = inner_size[2] - 0.75

    @laying = setCalculateBoxLayinginCarton(carton_lay_size, lay_bulk_size)
       *เป็นสูตร หาจำนวน ในการวาง lay แต่ละแบบ แนวตั้ง/นอน
            1. วางแนวตั้ง	
                v_x = ปัดเศษ(carton_lay_size[0] / lay_bulk_size[1]), // หาจำนวนของแต่ละด้าน 
                v_y = ปัดเศษ(carton_lay_size[1] / lay_bulk_size[0]), // หาจำนวนของแต่ละด้าน
                v_xy = v_x*v_y,
                v_w_side = parseFloat((v_x*c[1]).toFixed(2)),  // หาขนาด
                v_l_side = parseFloat((v_y*c[0]).toFixed(2))

            2. วางแนวนอน  
                h_x = ปัดเศษ(carton_lay_size[0] / lay_bulk_size[0]), // หาจำนวนของแต่ละด้าน
                h_y = ปัดเศษ(carton_lay_size[1] / lay_bulk_size[1]), // หาจำนวนของแต่ละด้าน
                h_xy = h_x*h_y, // หาจำนวน
                h_w_side = parseFloat((h_x*c[0]).toFixed(2)), // หาขนาด
                h_l_side = parseFloat((h_y*c[1]).toFixed(2))
        หาว่าการวางแบบไหนได้จำนวนที่มากกว่า และเลือกการ lay แบบนั้น
        สรุปสุดท้ายจะได้ข้อมูล
            laying = {
                    laying:'vertical', //'vertical' หรือ 'horizontal'
                    lay_size:[w_side, l_side],
                    layout:[จำนวนด้านกว้าง, จำนวนด้านยาว],
                    qty: จำนวนด้านกว้าง * จำนวนด้านยาว
            }  
    @bulk_per_layer = laying.qty
    @weight_per_layer = bulk_per_layer * @info.bulk.weight_per_bulk

    เงื่อนไข ถ้ายังไม่เคยคำนวณ carton มาก่อนหน้านี้ ( carton_lay_height = '')
        ถ้าใช่
            @layer_per_carton = default_limit_carton_weight /  weight_per_layer
            *ถ้าคำนวณแล้วได้ 0 ให้ค่าเป็น 1 (ไม่น้อยกว่า 1)
        ถ้าไม่ใช่ (ถ้าเป็นการคำนวณซ้ำ)
            *คำนวณหา layer_per_carton โดยที่ถ้าคำนวณแล้วยังเป็น 0 ให้ค่าเป็น 1
            @layer_per_carton = 1
            layer_height = lay_bulk_size[2] // สูง

            total_weight = weight_per_layer * layer_per_carton
            total_height = layer_height * layer_per_carton

            *คำนวณหา layer_per_carton จริง
            loop >> (วนซ้ำจนกว่าเงื่อนไขจะเป็นเท็จ)
                ถ้า (total_height <= carton_lay_height) และ (total_weight <= default_limit_carton_weight)
                    @layer_per_carton += 1 (เพิ่มขึ้นทีละ 1)
                    total_weight , total_height คำนวณใหม่ด้วยสูตรเดิม
            
            ถ้า (total_height > carton_lay_height) หรือ (total_weight > default_limit_carton_weight)
                @layer_per_carton - 1
            
            ถ้า layer_per_carton = 0 ให้ layer_per_carton = 1
            total_weight , total_height คำนวณใหม่ด้วยสูตรเดิม
    
    @cube_size = [
        laying.lay_size[0], // กว้าง-นิ้ว
        laying.lay_size[1], // ยาว-นิ้ว
        layer_per_carton * lay_bulk_size[2], // สูง-นิ้ว
        laying.lay_size[0] * 25.4, // มิล
        laying.lay_size[1] * 25.4, // มิล
        layer_per_carton * lay_bulk_size[2]  * 25.4// สูง-มิล
    ]

    ** สรุปสุดท้ายฟังก์ชั่น setCalculateCarton จะได้ข้อมูล
    carton_info={
        carton:{
            layer_per_carton,
            qty_per_layer: bulk_per_layer * @info.bulk.qty_per_bulk,
            bulk_per_layer,
            num_layout: laying.layout,  // จำนวน
            weight_per_layer,
            qty_per_carton : bulk_per_layer * @info.bulk.qty_per_bulk * layer_per_carton
        },
        size:{
            cube: @cube_size,
            inner_size:[ // กว้าง , ยาว , สูง นิ้ว , .... หน่วยมิล
                (cube_size[0]+0.75), 
                (cube_size[1]+0.75),
                (cube_size[2]+0.75),
                (cube_size[3]+(0.75*25.4)),
                (cube_size[4]+(0.75*25.4)),
                (cube_size[5]+(0.75*25.4)),
            ],
            outer_size:[ // กว้าง , ยาว , สูง นิ้ว , .... หน่วยมิล
                (cube_size[0]+0.75+0.5),
                (cube_size[1]+0.75+0.5),
                (cube_size[2]+0.75+0.5),
                (cube_size[3]+(0.75+0.5*25.4)),
                (cube_size[4]+(0.75+0.5*25.4)),
                (cube_size[5]+(0.75+0.5*25.4)),
            ]
        }
    }
}
@info.size.cube = @cube_size จาก setCalculateCarton()
@info.dummy_size = size  จาก setCalculateCarton()

*set ค่า inner_size และ outer_size ของ carton
ถ้าเป็นการคำนวณใหม่ (เคยคำนวณแล้ว)
    ถ้าใช่
        @info.size.inner_size = [
            carton.info.inner_size[0], //กว้าง นิ้ว
            carton.info.inner_size[1], //ยาว นิ้ว
            carton.info.inner_size[2], //สูง นิ้ว
            carton.info.inner_size[0] * 25.4, //กว้าง มิล
            carton.info.inner_size[1] * 25.4, //ยาว มิล
            carton.info.inner_size[2] * 25.4, //สูง มิล
        ]
        @info.size.outer_size = [
            //* inner_size + 0.5
        ]
    ถ้าไม่ใช่ (คำนวณครั้งแรก) // ใช้ค่าจากการคำนวณที่ได้จากฟังก์ชั่น setCalculateCarton()
        @info.size.inner_size = @info.dummy_size.inner_size
        @info.size.outer_size = @info.dummy_size.outer_size

@info.carton = carton_info.carton // มีข้อมูลของพวก layer_per_carton, bulk_per_layer ...
@info.net_weight = weight_per_layer * layer_per_carton
@info.gross_weight = info.net_weight + 1

@corrugated_board = setCalculateCorrugatedcarton(info.size.inner_size)
    *เป็นสูตรคำนวณ // inner_size มิลลิเมตร + 8 
    w_mm_side = ( inner_size[2] * 25.4 + 8 ) + ( inner_size[0] * 25.4 + 8 )
    l_mm_side = ( 2 * inner_size[1] * 25.4 ) + ( 2 * inner_size[0] * 25.4) + 40 + 32
    w_inch_side = w_mm_side/25.4
    l_inch_side = l_mm_side/25.4
    area_corrugated = w_inch_side * l_inch_side / 144
    length_metre = l_inch_side / 1000
    
    จากการคำนวณจะได้
    corrugated_board = {
        size: [
            w_mm_side, 
            l_mm_side, 
            w_inch_side, 
            l_inch_side
        ],
        area_corrugated,
        length_metre
    }
carton.info.corrugated = { ... ค่าเดิมในตัวแปรนี้ , ...corrugated_board }
carton.info.corrugated.price_inch = info.corrugated.price / 144
carton.info.corrugated.board_price_per_carton = info.corrugated.price * area_corrugated

@unit_price = default_carton_price + board_price_per_carton

*คำนวณราคา pack carton แต่ละยอด qty.
    @carton_qty = จำนวน carton = ยอดงาน / qty_per_carton
    @price = carton_qty * unit_price

*คำนวณค่าจัดส่ง
    @จำนวน_pack = จำนวนชิ้นงาน / qty_per_carton
    @delivery_price = จำนวน_pack * unit_price
    @delivery_gross_weight = @info.gross_weight
    @delivery_total_weight = @info.gross_weight * จำนวน_pack