Re-calculate Button Flow
>1. setCalculateLayout(index,FALSE) / est.3220
>2. storePaperSize(index) / est. 3260
    > arr [ stdPaper[W] , stdPaper[L] ]
    > arr[W] < arr[L] ?
        > true > paperSize = [0mm ,1mm ,0in ,1in]
        > false > paperSize = [1mm ,0mm ,1in ,0in]
    > switch = item.layout.laySize[0] <= [1] ? 0 : 1
    > switch ?
        > true > paper_align = 'long' , parallel_side = 'LSize'
        > false > paper_align = 'short' , parallel_side = 'WSize'
    > obj = {
        paper_align : paper_align, // long
        parallel_side : parallel_side, // Lsize
        is_switchDisplay : switch, // true
        std_paper_id : std_paper_id
    }
    > est.setPaperSize(item,paperSize,obj) / est.js:188
        > item.paperSize = paperSize
        > set paper_info
            >   std_paper_id , 
                paper_align ,// long
                parallel_roll_width , // Lsize
                is_switchDisplay // true
             	roll_width = paperSize[2] // W
                cut_off = paperSize[3] // L
                paper_grain = 'vertical' // Lsize เกรนตั้ง
>3. est.setCalculateLayout(index) // est.js:3263
    > setCalculateLayoutSize(index) // calculatation.js:1730
        > return {
            laying : [
                // grain แนวนอน
                {
                    laying_type:'straight',
                    laying:'vertical',
                    grain_box_type: 'horizontal',
                    layout:[v_x,v_y],
                    printing:[v_w,v_l],
                    num_laying:v_xy,
                    // W , L
                    paper_size:[paperSize[0],paperSize[1]],
                    [
                        printing[0] + gripper + color_bar,
                        printing[1] + paper_edge * 2
                    ]
                },
                // grain แนวตั้ง
                {
                    laying_type:'straight',
                    laying:'horizontal',
                    grain_box_type: 'vertical',
                    layout:[h_x,h_y],
                    printing:[h_w,h_l],
                    num_laying:h_xy,
                     // L , W
                    paper_size:[paperSize[1],paperSize[0]],
                    [
                        printing[0] + gripper + color_bar,
                        printing[1] + paper_edge * 2
                    ]
                }
            ],
            gripper,
            color_bar,
            paper_edge
        }
    > laying = this.checkMatchMachineLayout // cal:1610 check lay amount if 0 = new lay
    > item.layout = {
        layout:laying,
        selected_layout: //horizontal // best layout * now fix horizontal
        paper_align: paper_info.paper_align // long
        }
    > setParallelRollWidth(item)
        > paper_info.is_switchDisplay = layout_size[0] <= [1] ? 0 : 1
        > grain_box_type == 'vertical' ?
            > true > set paper_info >
                        parallel_roll_width:'LSize',
                        cut_off: inch(selected_layout.paper_size[0]),
                        roll_width: inch(selected_layout.paper_size[1]),
                        paper_grain: 'vertical'
            > false > set paper_info >
                        parallel_roll_width:'WSize',
                        cut_off: inch(selected_layout.paper_size[1]),
                        roll_width: inch(selected_layout.paper_size[0]),
                        paper_grain: 'horizontal'
>4. est.setCalculateLaysize(index,FALSE) // est.js:3268
    > * Set item.layout.laySize =
        > printing = selected_layout.printing
        item.layout.laySize=[
			mm2inch( printing[0] + color_bar + gripper),
			mm2inch( printing[1] + paper_edge * 2),
			printing[0] + color_bar + gripper,
			printing[1] + paper_edge * 2
		]
        > this.setCutSize(item,FALSE)
            > if layot.laySize not match max_size machine
            > set item.machine = machine[index] ที่หาได้
>5. est.setDefaultPacking(index) // not important
>6. est.setCalculateUps(index) // not important
>7. imgLayout(index) // est.js:3275
    > getFluteImg_obj(index) // est.js:1664
        > is_switchDisplay layout.laySize[0] <= [1] ? 0 : 1
        > grain = item.paper_info.paper_grain
        > is_switchDisplay ?
            > true ? 
                paper_info.paper_grain == 'vertical' ?
                > true > arrowH (horizontal)
                > false > arrowV (vertical)
            // todo est.js:1671
            > false ?
                paper_info.paper_grain == 'vertical' ?
                > true > arrowV (vertical)
                > false > arrowH (horizontal)
>8. checkLaysize(index) // est.js:3276
>9. storePaperSize(index)// est.js:3277
>10. est.setCalculatePaperWeight(index)// est.js:3278
>11. editLayout(index)// est.js:3279
>12. edittbPaperUsage(index)// est.js:3280