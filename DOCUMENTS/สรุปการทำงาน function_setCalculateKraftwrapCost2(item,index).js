setCalculateKraftwrapCost2(item,index)

*ต้องใช้ค่าจาก setCalculateComponentWeight(index)

@default_kraftwrap_thickness = 0.5 mm
@bulk_height = [ packing_thickness_inch , packing_thickness_mm]
@num_per_layer = @num_bulk_per_layer
@weight_per_layer = weight * @num_bulk_per_layer
@layer_per_pack = 1
@qty_per_pack = 0

คำนวณ layer_per_pack
layer_per_pack = 
    if qty_per_kraftwrap = "" // ครั้งแรก / ระบบคำนวณให้
        if (default_limit_kraftwrap_weight / weight_per_layer) = 0
            loop {
                total_weight = weight_per_layer * layer_per_pack
                total_height = layer_per_pack * height[0]
                layer_per_pack ++

                if total_weight <= default_limit_kraftwrap_weight 
                    และ total_height <= default_a3_size[1]
                    >> วนซ้ำ
                else
                    >> ออกจาก loop
            }
            
            if
                total_weight <= default_limit_kraftwrap_weight
                หรือ 
                total_height <= default_a3_size[1]
                    layer_per_pack -= 1
            
            full_pack = ceil(layer_per_pack / 10) * 10

            if full_pack !== layer_per_pack
                @ diff_layer = full_pack - layer_per_pack
                @@ layer_per_pack = diff_layer <= 5 ? full_pack - 5 : full_pack - 10
            
            if layer_per_pack <= 0
                @@ layer_per_pack = 1
        
    else
        @@ layer_per_pack = ceil( weight_per_qty * qty_per_kraftwrap / weight_per_layer)
----- จบ คำนวณ layer_per_pack ----

if qty_per_kraftwrap = ""
    @@ qty_per_pack = layer_per_pack * num_per_layer
    @@ net_weight = ทศ2( weight_per_layer * layer_per_pack)
else
    @@ qty_per_pack = qty_per_kraftwrap
    @@ net_weight = ทศ2(weight * qty_per_pack)

@@ gross_weight = net_weight
@@ inner_size = [
    kw.info.cube_size[0],
    kw.info.cube_size[1],
    ทศ2(bulk_height[0] * layer_per_pack),
    kw.info.cube_size[2],
    kw.info.cube_size[3],
    bulk_height[1] * layer_per_pack
]
@ doubleThickness =  default_kraftwrap_thickness * 2
@@ outer_size = [
    ทศ2(kw.info.cube_size[0] + mm2inch(doubleThickness)),
    ทศ2(kw.info.cube_size[1] + mm2inch(doubleThickness)),
    ทศ2(bulk_height[0] * layer_per_pack + mm2inch(doubleThickness)),
    ทศ2(kw.info.cube_size[2] + doubleThickness),
    ทศ2(kw.info.cube_size[3] + doubleThickness),
    ทศ2(bulk_height[1] * layer_per_pack + doubleThickness),
]
---- จบ คำนวณ kraftwrap ----