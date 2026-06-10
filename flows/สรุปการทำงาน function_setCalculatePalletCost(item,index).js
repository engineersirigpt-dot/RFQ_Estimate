setCalculatePalletCost(component)
1. หาข้อมูล packing อื่นๆ // จะได้ค่า null หรือ ข้อมูล packing
check_paperband = มี packing paperband ไหม ถ้ามีก็เอาข้อมูลมา 
check_kraftwrap = มี packing kraftwrap ไหม ถ้ามีก็เอาข้อมูลมา
check_carton = มี packing carton ไหม ถ้ามีก็เอาข้อมูลมา

2. หาหน่วย โดยเช็คตามเคสดังนี้
    if(check_paperband==null && check_kraftwrap==null && check_carton==null){
        //* ไม่มี paperband && ไม่มี check_kraftwrap && ไม่มี check_carton
        unit = 'pieces'
    }
    else if(check_paperband!=null && check_kraftwrap!=null && check_carton==null){
        //* มี paperband && มี kraftwrap && ไม่มี carton
        unit = 'kraftwrap'
    }
    else if(check_paperband!=null && check_kraftwrap==null && check_carton!=null){
        //* มี paperband && ไม่มี kraftwrap && มี carton
        unit = 'carton'
    }
    else if(check_kraftwrap!=null && check_carton==null){
        //* มี kraftwrap && ไม่มี carton
        unit = 'kraftwrap'
    }
    else{
        //* ไม่ตรงเงื่อนไขไหนเลย
        unit = 'carton'
    }

3. หา pallet_size = หาจาก pallet_size.size ที่เลือก เทียบกับ id ที่ตรงกัน ข้อมูลจะเป็น default data
    @defaultData.pallet = [
		{id:1,size:[40.00,48.00,6.50]},
		{id:2,size:[39.37,47.24,6.50]},
		{id:3,size:[45.90,45.90,6.50]},
		{id:4,size:[42.00,45.00,6.50]},
		{id:5,size:[43.30,43.30,6.50]},
		{id:6,size:[31.50,47.24,6.50]}
	]
4. delivery_type = หาจาก id ที่ตรงกัน delivery_type.type
    @defaultData.pallet_delivery = [
		{id:1,type:'domestic',pallet_price:400},
		{id:2,type:'abroad',pallet_price:700},
	]
5. unit_price = delivery_type.pallet_price
6. คำนวณ โดยอิงจาก unit ข้อ2

case 'pieces':
    bulk_size = this.getPackingSize(item) // packing_size คำนวณได้จากแต่ละ template
    bulk_height = [comp.thickness.inch.packing_thickness, comp.thickness.mm.packing_thickness]
    pallet.info.bulk_size = [
        bulk_size[0], // กว้าง , ยาว , สูง (นิ้ว) , ... (มิล)
        bulk_size[1],
        bulk_height[0],
        bulk_size[2],
        bulk_size[3],
        bulk_height[1]
    ]
    //* หาการวางเลย์ เป็นสูตรคำนวณ หา lay ที่วางได้มากที่สุด
    pallet_info.laying = this.setCalculateBoxLayingPallet(pallet_info.pallet_size, bulk_size)
    
    v_x1 = ปัดเศษ(p[0]/c[0])
    v_y1 = ปัดเศษ(p[1]/c[1])
    v_xy1 = v_x1 * (v_y1)
    y_remain1 = p[1]-((v_y1) * c[1])
    v_xx1 = ปัดเศษ(p[0]/c[1])
    v_yy1 = ปัดเศษ(y_remain1/c[0])
    v_xy1 += v_xx1 * v_yy1
    aa1 = ((((v_y1) * c[1])+(v_yy1 * c[0])))
    if(v_x1 * c[0]>v_xx1 * c[1]){
        bb1 = ((v_x1 * c[0]))
    }else{ bb1 = ((v_xx1 * c[1]))}
    if(aa1<bb1){
        v_box1 = [aa1,bb1]
    }else{v_box1 = [bb1,aa1]}
    //horizontal_2
    v_x2 = ปัดเศษ(p[0]/c[0])
    v_y2 = ปัดเศษ(p[1]/c[1])
    v_xy2 = v_x2 * (v_y2-1)
    y_remain2 = p[1]-((v_y2-1) * c[1])
    v_xx2 = ปัดเศษ(p[0]/c[1])
    v_yy2 = ปัดเศษ(y_remain2/c[0])
    v_xy2 += v_xx2 * v_yy2
    aa2 = ((((v_y2-1) * c[1])+(v_yy2 * c[0])))
    if(v_x2 * c[0]>v_xx2 * c[1]){
        bb2 = ((v_x2 * c[0]))
    }else{ bb2 = ((v_xx2 * c[1]))}
    if(aa2<bb2){
        v_box2 = [aa2,bb2]
    }else{v_box2 = [bb2,aa2]}
    
    
    //vertical_1
    h_x1 = ปัดเศษ(p[0]/c[1])
    h_y1 = ปัดเศษ(p[1]/c[0])
    h_xy1 = h_x1 * h_y1
    x_remain1 = p[0]-(h_x1 * c[1])
    h_xx1 = ปัดเศษ(x_remain1/c[0])
    h_yy1 = ปัดเศษ(p[1]/c[1])
    h_xy1 += h_xx1 * h_yy1
    cc1 = (((h_x1 * c[1])+(h_xx1 * c[0])))
    if(h_y1 * c[0]>h_yy1 * c[1]){
        dd1 = ((h_y1 * c[0]))
    }else{dd1 = ((h_yy1 * c[1]))}
    if(cc1<dd1){
        h_box1 = [cc1,dd1]
    }else{h_box1 = [cc1,dd1]}
    
    //vertical_2
    h_x2 = ปัดเศษ(p[0]/c[1])
    h_y2 = ปัดเศษ(p[1]/c[0])
    h_xy2 = (h_x2-1) * h_y2
    x_remain2 = p[0]-((h_x2-1) * c[1])
    h_xx2 = ปัดเศษ(x_remain2/c[0])
    h_yy2 = ปัดเศษ(p[1]/c[1])
    h_xy2 += h_xx2 * h_yy2
    cc2 = ((((h_x2-1) * c[1])+(h_xx2 * c[0])))
    if(h_y2 * c[0]>h_yy2 * c[1]){
        dd2 = ((h_y2 * c[0]))
    }else{
        dd2 = ((h_yy2 * c[1]))
    }
    if(cc2<dd2){
        h_box2 = [cc2,dd2]
    }else{
        h_box2 = [cc2,dd2]
    }

    หาค่ามากที่สุดว่าตรงกับค่าไหน(v_xy1,v_xy2,h_xy1,h_xy2){
        case v_xy1:
            box_laying = {
                laying:[
                        {
                            laying:"horizontal",
                            pcs_per_row:v_x1,
                            row:v_y1
                        },
                        {
                            laying:"vertical",
                            pcs_per_row:v_xx1,
                            row:v_yy1,
                        },
                ],
                qty_layer:v_xy1,
                cube_size:v_box1,
            }
            break
        case v_xy2:
            box_laying = {
                laying:[
                        {
                            laying:"horizontal",
                            pcs_per_row:v_x2,
                            row:v_y2-1
                        },
                        {
                            laying:"vertical",
                            pcs_per_row:v_xx2,
                            row:v_yy2
                        },
                ],
                qty_layer:v_xy2,
                cube_size:v_box2,
                
            }
            break
        case h_xy1:
            box_laying = {
                laying:[
                        {
                            laying:"horizontal",
                            pcs_per_row:h_x1,
                            row:h_y1
                        },
                        {
                            laying:"vertical",
                            pcs_per_row:h_xx1,
                            row:h_yy1,
                        },
                ],
                qty_layer:h_xy1,
                cube_size:h_box1,
            }
            break
        case h_xy2:
            box_laying = {
                laying:[
                        {
                            laying:"horizontal",
                            pcs_per_row:h_x2-1,
                            row:h_y2
                        },
                        {
                            laying:"vertical",
                            pcs_per_row:h_xx2,
                            row:h_yy2,
                        },
                ],
                qty_layer:h_xy2,
                cube_size:h_box2,
            }		
            break				
    }

    pallet_info.weight_per_layer = (pallet_info.laying.qty_layer * item.weight.weight)
    //* หาค่าจากฟังก์ชั่น 
    {layer_per_pallet, pallet_weight, pallet_height} = this.setCalculatePalletLayer(pallet_info.weight_per_layer, bulk_height[0])
        หาค่าจาก defaultData pallet_info
        @limit_pallet_weight = 40 // kg
        @empty_pallet_weight = 25 // kg
        @limit_pallet_height = 44 //inch

        limit_pack_weight = limit_pallet_weight - empty_pallet_weight // หาค่าที่ใส่ของได้
        total_weight = 0
        total_height = 0
        layer_per_pallet = 0
        
        loop >>
            ถ้า total_weight <= limit_pack_weight && total_height <= limit_pallet_height
            ทำ >>
                layer_per_pallet + 1
                total_weight + weight_per_layer
                total_height + bulk_height
            ถ้าหลุดเงื่อนไข = จบ loop
        
        total_weight > limit_pack_weight หรือ total_height > limit_pallet_height
            total_weight - weight_per_layer
            total_height - bulk_height
            layer_per_pallet - 1

        ถ้า layer_per_pallet = 0
            layer_per_pallet = 1
            total_weight = weight_per_layer
            total_height = bulk_height

        จะได้ค่า
			layer_per_pallet,
			pallet_weight = total_weight,
			pallet_height = total_height

    pallet_info.layer_per_pallet = layer_per_pallet
    pallet_info.pallet_weight = pallet_weight
    pallet_info.pallet_height = pallet_height
    pallet_info.bulk_qty_pallet = pallet_info.laying.qty_layer  *  pallet_info.layer_per_pallet
    pallet_info.qty_pallet = pallet_info.bulk_qty_pallet
    break
case 'kraftwrap':
    pallet_info.bulk_size = kraftwrap_item.info.outer_size
    pallet_info.laying = this.setCalculateBoxLayingPallet(pallet_info.pallet_size, pallet_info.bulk_size)
    pallet_info.weight_per_layer = (pallet_info.laying.qty_layer * kraftwrap_item.info.gross_weight)
    //* หาค่าจากฟังก์ชั่น
    {layer_per_pallet, pallet_weight, pallet_height} = this.setCalculatePalletLayer(pallet_info.weight_per_layer, pallet_info.bulk_size[2])

    pallet_info.layer_per_pallet = layer_per_pallet
    pallet_info.pallet_weight = pallet_weight
    pallet_info.pallet_height = pallet_height
    pallet_info.bulk_qty_pallet = pallet_info.laying.qty_layer * pallet_info.layer_per_pallet
    pallet_info.qty_pallet = pallet_info.bulk_qty_pallet * kraftwrap_item.info.qty_per_pack
    break
case 'carton':
    pallet_info.bulk_size = carton_item.info.size.outer_size
    pallet_info.laying = this.setCalculateBoxLayingPallet(pallet_info.pallet_size, pallet_info.bulk_size)
    pallet_info.weight_per_layer = (pallet_info.laying.qty_layer * carton_item.info.gross_weight)
    //* หาค่าจากฟังก์ชั่น
    {layer_per_pallet, pallet_weight, pallet_height} = this.setCalculatePalletLayer(pallet_info.weight_per_layer, pallet_info.bulk_size[2])

    pallet_info.layer_per_pallet = layer_per_pallet
    pallet_info.pallet_weight = pallet_weight
    pallet_info.pallet_height = pallet_height
    pallet_info.bulk_qty_pallet = pallet_info.laying.qty_layer * pallet_info.layer_per_pallet
    pallet_info.qty_pallet = pallet_info.bulk_qty_pallet * carton_item.info.carton.qty_per_carton
    break

7. คำนวณราคา 
    pallet_qty = จำนวนงาน / pallet_info.qty_pallet
    unit_price = pallet_price,
    price = pallet_qty * unit_price