setCalculateComponentWeight(index)
    @ area_box = setCalculateArea(item) คำนวนตามสูตรแต่ละ Comp.
        case 1:
            area_box = (depth * glue) + (2 * length * depth) + (2 * width * depth) + (4 * dust * width) + (2 * length * (tuck + width))
        case 2:
            area_box = (depth * glue) + (2 * length * depth) + (2 * width * depth) + (4 * dust * width) + (2 * length * (tuck + width))
        case 3:
            area_box = (depth * glue) + (2 * length * depth) + (2 * width * depth) + (2 * dust * width) + ((tuck + width) * length) + ((width / 2 + ol) * (2 * width + 2 * length))
        case 4:
            area_box = (depth * glue) + (2 * length * depth) + (2 * width * depth) + (2 * dust * width) + ((tuck + width) * length) + (2 * length * (width / 2 + ol)) + (width * width)
        case 5:
            area_box = ((width + 4 * depth) * length) + (2 * (width + 2 * depth) * depth) + (2 * (depth + dust) * width)
        case 6:
            area_box = ((width + 4 * depth + 2 * ol + 2 * dust) * length) + ((4 * depth + 2 * ol + width) + 2 * depth) + (2 * (ol + depth + dust * width))
        case 7:
            area_box = (3 * width * length) + (2 * depth * width) + (2 * (length + dust) * depth) + (4 * (length + glue))
        case 8:
            area_box = (glue * depth) + (4 * depth * length) + (2 * width * depth) + (2 * length * tuck) + (length + width) * width + (ol * length) + (width * depth)
        case 9:
            area_box = (glue * depth) + (2 * width * depth) + (2 * length * depth)
        case 10:
            area_box = (glue * length) + (2 * length * width) + (2 * width * depth)
        case 11:
            area_box = (glue * length) + (2 * length * depth) + (2 * width * depth) + (4 * (width + length) * width)
        case 12:
            area_box = open_size[2] * open_size[3]

    * เฉพาะ 2,3 (ประกบ / เฉพาะลูกฟูก)
    @ corrugated_weight = ทศนิยม 3 หลัก (area_box * corru.info.all_gram * corru.info.num_layer / 1 ล้าน) || 0

    * เฉพาะ 1,2 (ไม่ประกบ / ประกบ)
    @ paper_weight = ทศนิยม 3 หลัก (area_box * item.gram / 1 ล้าน) || 0
    @@ item.weight = {
        paper_weight,
        corrugated_weight,
        weight(น้ำหนักรวม): ทศ3หลัก (paper_weight + corrugated_weight)
    }

    this.setCalculateThickness(item)
            * เฉพาะ 2,3
        @ corrugated_thickness = corru.info.thickness
            * เฉพาะ 1
        @ paper_thickness = paper.paper_thickness
        @ total_hickness_mm = paper_thickness + corrugated_thickness
        @ packing_thickness_mm = total_hickness_mm * packing_layer

        @@ item.thickness = {
            mm:{
                paper_thickness,
                corrugated_thickness,
                thickness: ทศ2 (total_hickness_mm),
                packing_thickness: ทศ2 (packing_thickness_mm)
            },
            inch:{
                paper_thickness: ทศ5 ( (ปัดเป็นจำนวนเต็ม + ถัดไป (paper_thickness / 25.4 * 100000)) / 100000)
                corrugated_thickness: ทศ5 ( (ปัดเป็นจำนวนเต็ม + ถัดไป (corrugated_thickness / 25.4 * 100000)) / 100000)
                thickness: ทศ5 ( (ปัดเป็นจำนวนเต็ม + ถัดไป (total_hickness_mm / 25.4 * 100000)) / 100000)
                packing_thickness: ทศ5 ( (ปัดเป็นจำนวนเต็ม + ถัดไป (packing_thickness_mm / 25.4 * 100000)) / 100000)
            },
        }