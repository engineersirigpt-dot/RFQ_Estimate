class Summary {
    summary(data = {}, is_forDisplay = false) {

        $('#summary_print').remove()

        const is_delivery = this.checkDelivery(data)

        const table = `
                <div id="summary_print">
                    <table border cellpadding="5" align="center" id="tb_summary_1">
                        <thead>
                            <tr head_row="1">
                                <th colspan="5" rowspan="2">Description</th>
                            </tr>
                            <tr head_row="2"></tr>
                        </thead>
                        <tbody>
                        </tbody>
                    </table>
                </div>`;

        const trRemark = `
            <tr class="trRemark">
                <td colspan="17" class="td_remark">
                    <div class="rfq_remark">
                        <label>Remark : </label>
                        <br>
                        <textarea id="rfq_remark" name="rfq_remark" rows="3" placeholder="หมายเหตุ"></textarea>
                    </div>
                </td>
            </tr>
        `;

        let head1 = '',
            head2 = ''

        $('#section_rfq_summary tr:last').append(table)

        data.qty.main.forEach((item, index) => {
            head1 += `<th>Volume</th> 
                        <th>${numeral(data.qty.totalqty[index]).format('0,0')}</th>
                        <th>${numeral(item).format('0,0')}</th>`
            head2 += `<th>Unit Price</th>
                    <th>Qty</th>
                    <th>Price</th>`
        })

        $('#summary_print table tr[head_row=1]').append(head1)
        $('#summary_print table tr[head_row=2]').append(head2)

        if (is_delivery) {
            var tr_packing = this.getDeliveryPackingTR(data);
        } else {
            var tr_packing = this.getNormalPackingTR(data);
        }

        $('#summary_print table tbody').append(
            this.getTrSummary(data, 'paper'),
            this.getTrSummary(data, 'corrugated'),
            this.getTrSummary(data, 'special_ink'),
            this.getTrSummary(data, 'material'),
            this.getTRTotal(data, 'Material'),
            this.getTrSummary(data, 'print_plate', 'plate'),
            this.getTRTotal(data, 'Plate'),
            this.getTrSummary(data, 'print_plate', 'proof'),
            this.getTRTotal(data, 'Proof'),
            this.getTrSummary(data, 'print_plate', 'print'),
            this.getTRTotal(data, 'Print'),
            this.getTrSummary(data, 'coating'),
            this.getTrSummary(data, 'corrugated_glued'),
            this.getTrSummary(data, 'foilstamp'),
            this.getTrSummary(data, 'bossing', 'emboss'),
            this.getTrSummary(data, 'bossing', 'deboss'),
            this.getTrSummary(data, 'diecut'),
            this.getTrSummary(data, 'main_process', 'chip'),
            this.getTrSummary(data, 'main_process', 'trim'),
            this.getTrSummary(data, 'main_process', 'bag'),
            this.getTrSummary(data, 'main_process', 'shrinkwrap'),
            this.getTrSummary(data, 'process', 'other'),
            this.getTrSummary(data, 'process', 'handwork'),
            this.getTrSummary(data, 'process', 'custom'),
            this.getTrSummary(data, 'assembly'),
            this.getTrSummary(data, 'main_process', 'inspection'),
            this.getTRTotal(data, 'Process'),
            this.getTrSummary(data, 'otherCost'),
            this.getTRTotal(data, 'Other'),
            tr_packing.paperband_tr,
            tr_packing.kraftwrap_tr,
            tr_packing.carton_tr,
            tr_packing.pallet_tr,
            tr_packing.delivery_tr,
            this.getTRTotal(data, 'Packing'),
            this.getTRTotal(data, 'MarkUp'),
            this.getTRTotal(data, 'MarkDown'),
            this.getTRTotal(data, 'Price'),
            this.getTRTotal(data, 'Gift'),
            this.getTRTotal(data, 'CustomerPriceDiff'),
            this.getTRTotal(data, 'DiffPrice'),
            this.getTRTotal(data, 'Tax'),
            this.getTRTotal(data, 'ProfitSharing'),
            this.getTRTotal(data, 'FinalPrice'),
            this.getTRTotal(data, 'UnitPrice'),
            this.getTRWeight(data, is_forDisplay),
            trRemark,
        )

        $('#summary_print #tax input').inputmask({ regex: "^[0-9]{1,3}(\\.\\d{1,2})?$", placeholder: "" })
        $('#rfq_remark').val(data.remark)

        this.getProfitAndLossSection('#summary_print')
    }

    checkDelivery(estData = {}) {
        const check_has_delivery = estData.component1?.every(comp => comp.packing?.every(packing => {
            return packing.every(obj => obj?.detail?.length > 0)
        })) || false

        return check_has_delivery
    }


    getNormalPackingTR(data = {}) {
        const comp_arr = data?.component1 || []

        var num_trPaperband = 0,
            num_trKraftwrap = 0,
            num_trCarton = 0,
            num_trPallet = 0,
            num_trDelivery = 0,
            check_packing = []

        // * count type of packaging
        comp_arr.forEach((item, index) => {
            check_packing.push({
                kraftwrap: false,
                carton: false
            })

            item.packing[0].forEach((item1) => {
                if (item1.name == 'paperband') {
                    num_trPaperband += 1
                }
                if (item1.name == 'kraftwrap') {
                    num_trKraftwrap += 1
                    check_packing[index].kraftwrap = true
                }
                if (item1.name == 'carton') {
                    num_trCarton += 1
                    check_packing[index].carton = true
                }
                if (item1.name == 'pallet') {
                    num_trPallet += 1
                }
            })
            if (check_packing[index].kraftwrap == false && check_packing[index].carton == false) {
                check_packing[index].unit_pallet = 'Cps/Pallet'
            } else if (check_packing[index].kraftwrap == true && check_packing[index].carton == false) {
                check_packing[index].unit_pallet = 'Pack/Pallet'
            } else if (check_packing[index].carton == true) {
                check_packing[index].unit_pallet = 'Carton/Pallet'
            }
            if (item.delivery?.length > 0) {
                num_trDelivery += item.delivery?.length || 1
            }
        })

        var paperbandColumn_arr = [],
            kraftwrapColumn_arr = [],
            cartonColumn_arr = [],
            palletColumn_arr = [],
            deliveryColumn_arr = [],
            paperbandRow_arr = [],
            kraftwrapRow_arr = [],
            cartonRow_arr = [],
            palletRow_arr = [],
            deliveryRow_arr = [],
            packing_obj = {}

        //* Loop components
        comp_arr.forEach((item, index) => {

            var paperbandColumn = "",
                kraftwrapColumn = "",
                cartonColumn = "",
                palletColumn = "",
                deliveryColumn = ""

            item.packing[0].forEach((item1) => {
                if (item1.name == 'paperband') {
                    item1.line.forEach((item2, index2) => {
                        paperbandColumn += `<td  class="alRight"><div class="paperbandRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                    <td  class="alCenter"><div class="paperbandRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0.00')}</div></td>
                                    <td  class="alRight"><div class="paperbandRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                    })
                    paperbandColumn_arr.push(paperbandColumn)
                    if (paperbandColumn_arr.length == 1) {
                        var paperband_tr = `<tr class="packing_tr paperband_tr" index="${index}">
                                        <td rowspan="${num_trPaperband}" colspan="2">Paper Band</td>
                                        <td class="alCenter"><div class="paperbandRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="paperbandRowUnitQty" index="${index}">${item1.info.qty_per_paperband}</div></td>
                                        <td class="alCenter"><div class="paperbandRowUnit" index="${index}">Cps/band</div></td>`
                    } else {
                        var paperband_tr = `<tr class="packing_tr paperband_tr" index="${index}">
                                        <td class="alCenter"><div class="paperbandRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="paperbandRowUnitQty" index="${index}">${item1.info.qty_per_paperband}</div></td>
                                        <td class="alCenter"><div class="paperbandRowUnit" index="${index}">Cps/band</div></td>`
                    }
                    paperbandRow_arr.push(paperband_tr)
                }
                if (item1.name == 'kraftwrap') {
                    item1.line.forEach((item2, index2) => {
                        kraftwrapColumn += `<td class="alRight"><div class="kraftwrapRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="kraftwrapRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0.00')}</div></td>
                                    <td class="alRight"><div class="kraftwrapRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                    })
                    kraftwrapColumn_arr.push(kraftwrapColumn)
                    if (kraftwrapColumn_arr.length == 1) {
                        var kraftwrap_tr = `<tr class="packing_tr kraftwrap_tr" index="${index}">
                                        <td rowspan="${num_trKraftwrap}" colspan="2">Kraftwrap</td>
                                        <td class="alCenter"><div class="kraftwrapRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="kraftwrapRowUnitQty" index="${index}">${numeral(item1.info.qty_per_pack).format('0,0')}</div></td>
                                        <td class="alCenter"><div class="kraftwrapRowUnit" index="${index}">Cps/pack</div></td>`
                    } else {
                        var kraftwrap_tr = `<tr class="packing_tr kraftwrap_tr" index="${index}">
                                        <td class="alCenter"><div class="kraftwrapRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="kraftwrapRowUnitQty" index="${index}">${numeral(item1.info.qty_per_pack).format('0,0')}</div></td>
                                        <td class="alCenter"><div class="kraftwrapRowUnit" index="${index}">Cps/pack</div></td>`
                    }
                    kraftwrapRow_arr.push(kraftwrap_tr)
                }
                if (item1.name == 'carton') {
                    item1.line.forEach((item2, index2) => {
                        cartonColumn += `<td class="alRight"><div class="cartonRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="cartonRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0.00')}</div></td>
                                    <td class="alRight"><div class="cartonRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                    })
                    cartonColumn_arr.push(cartonColumn)
                    if (cartonColumn_arr.length == 1) {
                        var carton_tr = `<tr class="packing_tr carton_tr" index="${index}">
                                        <td rowspan="${num_trCarton}" colspan="2">Carton</td>
                                        <td class="alCenter"><div class="cartonRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="cartonRowUnitQty" index="${index}">${numeral(item1.info.carton.qty_per_carton).format('0,0')}</div></td>
                                        <td class="alCenter"><div class="cartonRowUnit" index="${index}">Cps/carton</div></td>`
                    } else {
                        var carton_tr = `<tr class="packing_tr carton_tr" index="${index}">
                                        <td class="alCenter"><div class="cartonRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="cartonRowUnitQty" index="${index}">${numeral(item1.info.carton.qty_per_carton).format('0,0')}</div></td>
                                        <td class="alCenter"><div class="cartonRowUnit" index="${index}">Cps/carton</div></td>`
                    }
                    cartonRow_arr.push(carton_tr)
                }
                if (item1.name == 'pallet') {
                    item1.line.forEach((item2, index2) => {
                        palletColumn += `<td class="alRight"><div class="cartonRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="cartonRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0.00')}</div></td>
                                    <td class="alRight"><div class="cartonRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                    })
                    palletColumn_arr.push(palletColumn)
                    if (palletColumn_arr.length == 1) {
                        var pallet_tr = `<tr class="packing_tr pallet_tr" index="${index}">
                                        <td rowspan="${num_trPallet}" colspan="2">Pallet</td>
                                        <td class="alCenter"><div class="palletRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="palletRowUnitQty" index="${index}">${numeral(item1.info.bulk_qty_pallet).format('0,0')}</div></td>
                                        <td class="alCenter""><div class="palletRowUnit" index="${index}">${check_packing[index].unit_pallet}</div></td>`
                    } else {
                        var pallet_tr = `<tr class="packing_tr pallet_tr" index="${index}">
                                        <td class="alCenter"><div class="palletRowComponentName" index="${index}">${item.component_name}</div></td>
                                        <td class="alCenter"><div class="palletRowUnitQty" index="${index}">${numeral(item1.info.bulk_qty_pallet).format('0,0')}</div></td>
                                        <td class="alCenter"><div class="palletRowUnit" index="${index}">${check_packing[index].unit_pallet}</div></td>`
                    }
                    palletRow_arr.push(pallet_tr)
                }
            })

            if (item.delivery?.length > 0) {
                item.delivery[0].price.forEach((item1) => {
                    deliveryColumn += `<td class="alRight"><div class="deliveryRowUnitPrice" index="${index}" indexqty="${item1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                <td class="alCenter"><div class="deliveryRowQty" index="${index}" indexqty="${item1}">${numeral(item1.qty).format('0,0.00')}</div></td>
                                <td class="alRight"><div class="deliveryRowPrice" index="${index}" indexqty="${item1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                })

                deliveryColumn_arr.push(deliveryColumn)

                if (deliveryColumn_arr.length == 1) {
                    var delivery_tr = `<tr class="packing_tr delivery_tr" index="${index}">
                                    <td rowspan="${num_trDelivery}" colspan="3">Delivery</td>
                                    <td colspan="2" class="alCenter"><div class="deliveryRowComponentname" index="${index}">${item.component_name}</div></td>`
                } else {
                    var delivery_tr = `<tr class="packing_tr delivery_tr" index="${index}">
                                    <td colspan="2" class="alCenter"><div class="deliveryRowComponentname" index="${index}">${item.component_name}</div></td>`
                }

                deliveryRow_arr.push(delivery_tr)
            }

            packing_obj = {
                paperband_tr: "",
                kraftwrap_tr: "",
                carton_tr: "",
                pallet_tr: "",
                delivery_tr: ""
            }

            if (paperbandColumn_arr.length != 0) {
                paperbandColumn_arr.forEach((item, index) => {
                    packing_obj.paperband_tr += paperbandRow_arr[index] + item + `</tr>`
                })
            }
            if (kraftwrapColumn_arr.length != 0) {
                kraftwrapColumn_arr.forEach((item, index) => {
                    packing_obj.kraftwrap_tr += kraftwrapRow_arr[index] + item + `</tr>`
                })
            }
            if (cartonColumn_arr.length != 0) {
                cartonColumn_arr.forEach((item, index) => {
                    packing_obj.carton_tr += cartonRow_arr[index] + item + `</tr>`
                })
            }
            if (palletColumn_arr.length != 0) {
                palletColumn_arr.forEach((item, index) => {
                    packing_obj.pallet_tr += palletRow_arr[index] + item + `</tr>`
                })
            }
            if (deliveryColumn_arr.length != 0) {
                deliveryColumn_arr.forEach((item, index) => {
                    packing_obj.delivery_tr += deliveryRow_arr[index] + item + `</tr>`
                })
            }
        })

        return packing_obj
    }

    getDeliveryPackingTR(data = {}, isMultipleF = false) {
        const { is_different_packing = false } = data?.job || {}
        const comp_arr = data?.component1
        const delivery = data?.delivery || []

        var num_trPaperband = 0,
            num_trKraftwrap = 0,
            num_trCarton = 0,
            num_trPallet = 0,
            num_trDelivery = 0,
            check_packing = []

        // * count type of packaging
        comp_arr.forEach((item, index) => {
            const packingLength = is_different_packing ? item?.f_detail?.f_list?.length : 1
            for (let fIndex = 0; fIndex < packingLength; fIndex++) {
                check_packing.push([])

                const check_has_delivery = item.packing[fIndex].every(obj => obj?.detail?.length > 0)

                check_packing[fIndex].push({
                    kraftwrap: false,
                    carton: false
                })

                item.packing[fIndex].forEach((item1) => {
                    if (item1.name == 'paperband') {
                        num_trPaperband += 1
                        check_packing[fIndex][index].paperband = true
                    }
                    if (item1.name == 'kraftwrap') {
                        num_trKraftwrap += 1
                        check_packing[fIndex][index].kraftwrap = true
                    }
                    if (item1.name == 'carton') {
                        num_trCarton += 1
                        check_packing[fIndex][index].carton = true
                    }
                    if (item1.name == 'pallet') {
                        num_trPallet += 1
                    }
                })
                // * + row span split delivery
                // * check delivery
                if (check_has_delivery) {
                    item.packing[fIndex].forEach(packing => {
                        if (packing.name === 'kraftwrap') {
                            num_trKraftwrap += packing.detail?.length - 1
                        } else if (packing.name === 'carton') {
                            num_trCarton += packing.detail?.length - 1
                        } else if (packing.name === 'pallet') {
                            num_trPallet += packing.detail?.length - 1
                        } else if (packing.name === 'paperband') {
                            num_trPaperband += packing.detail?.length - 1
                        }
                    })
                }

                if (check_packing[fIndex][index].kraftwrap == false && check_packing[fIndex][index].carton == false) {
                    check_packing[fIndex][index].unit_pallet = 'Cps/Pallet'

                } else if (check_packing[fIndex][index].kraftwrap == true && check_packing[fIndex][index].carton == false) {
                    check_packing[fIndex][index].unit_pallet = 'Pack/Pallet'

                } else if (check_packing[fIndex][index].carton == true) {
                    check_packing[fIndex][index].unit_pallet = 'Carton/Pallet'
                }
            }

        })

        // * หาจำนวนรวมของเรทส่งส่งทุกรอบ
        /*
        delivery.length = รอบส่ง
        */

        var paperbandRow_arr = [],
            kraftwrapRow_arr = [],
            cartonRow_arr = [],
            palletRow_arr = [],
            packing_obj = {}

        //* Loop components
        let checkFirst = {
            paperband: 0,
            kraftwrap: 0,
            carton: 0,
            pallet: 0
        }

        comp_arr.forEach((item, compIndex) => {
            const packingLength = is_different_packing ? item?.f_detail?.f_list?.length : 1
            var paperbandCompTr = "",
                kraftwrapCompTr = "",
                cartonCompTr = "",
                palletCompTr = ""

            for (let fIndex = 0; fIndex < packingLength; fIndex++) {
                let compName = item.component_name
                var paperbandColumn = "",
                    kraftwrapColumn = "",
                    cartonColumn = "",
                    palletColumn = ""

                if (isMultipleF) {
                    compName = packingLength == 1 ? 'All' : item?.f_detail?.f_list[fIndex]?.f_code || 'Error'
                }

                item.packing[fIndex].forEach((item1) => {
                    let newTr = ''

                    if (item1.name == 'paperband') {
                        // * loop by delivery round.
                        newTr = item1.detail.map((roundDetail, roundIndex) => {
                            // * draw <td></td> by number of qty.
                            paperbandColumn = roundDetail.detail.map(qtyDetail =>
                                `<td class="alRight"><div class="paperbandRowUnitprice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.unit_price).format('0,0.00')}</div></td>
                        <td class="alCenter"><div class="paperbandRowQty" index="${compIndex}" indexqty="0">${numeral(qtyDetail.qty).format('0,0.00')}</div></td>
                        <td class="alRight"><div class="paperbandRowPrice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.price).format('0,0.00')}</div></td>`
                            )

                            // * draw <tr></tr> by number of round of delivery
                            let paperband_tr = ""
                            if (checkFirst.paperband === 0 && roundIndex === 0) {
                                //* Title of summary table tr โชว์ หัวข้อ paperband ให้แสดงชื่อ Comp. และ qty_per_paperband
                                paperband_tr = `<tr class="packing_tr paperband_tr" index="${compIndex}">
                            <td rowspan="${num_trPaperband}" colspan="2">Paperband</td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowComponentName" index="${compIndex}">${compName}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowUnitQty" index="${compIndex}">${numeral(item1.info.qty_per_paperband).format('0,0')}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowUnit" index="${compIndex}">Cps/band</div></td>
                            ${paperbandColumn}
                        </tr>
                        `
                            } else {
                                if (roundIndex === 0) {
                                    // * รอบแรกของแต่ละ Comp. ให้แสดงชื่อ Comp. และ qty_per_paperband
                                    paperband_tr = `<tr class="packing_tr paperband_tr" index="${compIndex}">
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowComponentName" index="${compIndex}">${compName}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowUnitQty" index="${compIndex}">${numeral(item1.info.qty_per_paperband).format('0,0')}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="paperbandRowUnit" index="${compIndex}">Cps/band</div></td>
                                ${paperbandColumn}
                            </tr>
                            `
                                } else {
                                    // * รอบส่งอื่นๆให้แสดงเฉพาะจำนวน และราคา
                                    paperband_tr = `<tr class="packing_tr paperband_tr" index="${compIndex}">
                                ${paperbandColumn}
                            </tr>
                            `
                                }
                            }
                            checkFirst.paperband += 1
                            return paperband_tr
                        })

                        paperbandCompTr = [...paperbandCompTr, ...newTr]
                    }

                    if (item1.name == 'kraftwrap') {
                        // * loop by delivery round.
                        newTr = item1.detail.map((roundDetail, roundIndex) => {
                            // * draw <td></td> by number of qty.
                            kraftwrapColumn = roundDetail.detail.map(qtyDetail =>
                                `<td class="alRight"><div class="kraftwrapRowUnitprice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.unit_price).format('0,0.00')}</div></td>
                        <td class="alCenter"><div class="kraftwrapRowQty" index="${compIndex}" indexqty="0">${numeral(qtyDetail.qty).format('0,0.00')}</div></td>
                        <td class="alRight"><div class="kraftwrapRowPrice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.price).format('0,0.00')}</div></td>`
                            )

                            // * draw <tr></tr> by number of round of delivery
                            let kraftwrap_tr = ""
                            if (checkFirst.kraftwrap === 0 && roundIndex === 0) {
                                //* Title of summary table tr โชว์ หัวข้อ Kraftwrap ให้แสดงชื่อ Comp. และ qty_per_pack
                                kraftwrap_tr = `<tr class="packing_tr kraftwrap_tr" index="${compIndex}">
                            <td rowspan="${num_trKraftwrap}" colspan="2">Kraftwrap</td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowComponentName" index="${compIndex}">${compName}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowUnitQty" index="${compIndex}">${numeral(item1.info.qty_per_pack).format('0,0')}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowUnit" index="${compIndex}">Cps/pack</div></td>
                            ${kraftwrapColumn}
                        </tr>
                        `
                            } else {
                                if (roundIndex === 0) {
                                    // * รอบแรกของแต่ละ Comp. ให้แสดงชื่อ Comp. และ qty_per_pack
                                    kraftwrap_tr = `<tr class="packing_tr kraftwrap_tr" index="${compIndex}">
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowComponentName" index="${compIndex}">${compName}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowUnitQty" index="${compIndex}">${numeral(item1.info.qty_per_pack).format('0,0')}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="kraftwrapRowUnit" index="${compIndex}">Cps/pack</div></td>
                                ${kraftwrapColumn}
                            </tr>
                            `
                                } else {
                                    // * รอบส่งอื่นๆให้แสดงเฉพาะจำนวน และราคา
                                    kraftwrap_tr = `<tr class="packing_tr kraftwrap_tr" index="${compIndex}">
                                ${kraftwrapColumn}
                            </tr>
                            `
                                }
                            }
                            checkFirst.kraftwrap += 1
                            return kraftwrap_tr
                        })

                        kraftwrapCompTr = [...kraftwrapCompTr, ...newTr]
                    }

                    if (item1.name == 'carton') {
                        // * loop by delivery round.
                        newTr = item1.detail.map((roundDetail, roundIndex) => {
                            // * draw <td></td> by number of qty.
                            cartonColumn = roundDetail.detail.map(qtyDetail =>
                                `<td class="alRight"><div class="cartonRowUnitprice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.unit_price).format('0,0.00')}</div></td>
                        <td class="alCenter"><div class="cartonRowQty" index="${compIndex}" indexqty="0">${numeral(qtyDetail.qty).format('0,0.00')}</div></td>
                        <td class="alRight"><div class="cartonRowPrice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.price).format('0,0.00')}</div></td>`
                            )

                            // * draw <tr></tr> by number of round of delivery
                            let carton_tr = ""
                            if (checkFirst.carton === 0 && roundIndex === 0) {
                                //* Title of summary table tr โชว์ หัวข้อ carton ให้แสดงชื่อ Comp. และ qty_per_carton
                                carton_tr = `<tr class="packing_tr carton_tr" index="${compIndex}">
                            <td rowspan="${num_trCarton}" colspan="2">Carton</td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowComponentName" index="${compIndex}">${compName}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowUnitQty" index="${compIndex}">${numeral(item1.info.carton.qty_per_carton).format('0,0')}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowUnit" index="${compIndex}">Cps/carton</div></td>
                            ${cartonColumn}
                        </tr>
                        `
                            } else {
                                if (roundIndex === 0) {
                                    // * รอบแรกของแต่ละ Comp. ให้แสดงชื่อ Comp. และ qty_per_carton
                                    carton_tr = `<tr class="packing_tr carton_tr" index="${compIndex}">
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowComponentName" index="${compIndex}">${compName}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowUnitQty" index="${compIndex}">${numeral(item1.info.carton.qty_per_carton).format('0,0')}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="cartonRowUnit" index="${compIndex}">Cps/carton</div></td>
                                ${cartonColumn}
                            </tr>
                            `
                                } else {
                                    // * รอบส่งอื่นๆให้แสดงเฉพาะจำนวน และราคา
                                    carton_tr = `<tr class="packing_tr carton_tr" index="${compIndex}">
                                ${cartonColumn}
                            </tr>
                            `
                                }
                            }
                            checkFirst.carton += 1
                            return carton_tr
                        })

                        cartonCompTr = [...cartonCompTr, ...newTr]
                    }

                    if (item1.name == 'pallet') {
                        // * loop by delivery round.
                        newTr = item1.detail.map((roundDetail, roundIndex) => {
                            // * draw <td></td> by number of qty.
                            palletColumn = roundDetail.detail.map(qtyDetail =>
                                `<td class="alRight"><div class="palletRowUnitprice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.unit_price).format('0,0.00')}</div></td>
                        <td class="alCenter"><div class="palletRowQty" index="${compIndex}" indexqty="0">${numeral(qtyDetail.qty).format('0,0.00')}</div></td>
                        <td class="alRight"><div class="palletRowPrice" index="${compIndex}" indexqty="0">${numeral(qtyDetail.price).format('0,0.00')}</div></td>`
                            )

                            // * draw <tr></tr> by number of round of delivery
                            let pallet_tr = ""
                            if (checkFirst.pallet === 0 && roundIndex === 0) {
                                //* Title of summary table tr โชว์ หัวข้อ pallet ให้แสดงชื่อ Comp. และ qty_per_pallet
                                pallet_tr = `<tr class="packing_tr pallet_tr" index="${compIndex}">
                            <td rowspan="${num_trPallet}" colspan="2">Pallet</td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowComponentName" index="${compIndex}">${compName}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowUnitQty" index="${compIndex}">${numeral(item1.info.bulk_qty_pallet).format('0,0')}</div></td>
                            <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowUnit" index="${compIndex}">${check_packing[fIndex][compIndex].unit_pallet}</div></td>
                            ${palletColumn}
                        </tr>
                        `
                            } else {
                                if (roundIndex === 0) {
                                    // * รอบแรกของแต่ละ Comp. ให้แสดงชื่อ Comp. และ qty_per_pallet
                                    pallet_tr = `<tr class="packing_tr pallet_tr" index="${compIndex}">
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowComponentName" index="${compIndex}">${compName}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowUnitQty" index="${compIndex}">${numeral(item1.info.bulk_qty_pallet).format('0,0')}</div></td>
                                <td rowspan="${item1.detail.length}" class="alCenter"><div class="palletRowUnit" index="${compIndex}">${check_packing[fIndex][compIndex].unit_pallet}</div></td>
                                ${palletColumn}
                            </tr>
                            `
                                } else {
                                    // * รอบส่งอื่นๆให้แสดงเฉพาะจำนวน และราคา
                                    pallet_tr = `<tr class="packing_tr pallet_tr" index="${compIndex}">
                                ${palletColumn}
                            </tr>


                            `
                                }
                            }
                            checkFirst.pallet += 1
                            return pallet_tr
                        })

                        palletCompTr = [...palletCompTr, ...newTr]
                    }
                })
            }

            packing_obj = {
                paperband_tr: "",
                kraftwrap_tr: "",
                carton_tr: "",
                pallet_tr: "",
                delivery_tr: ""
            }

            if (paperbandCompTr.length > 0) {
                paperbandRow_arr.push(paperbandCompTr.join(""))
            }
            if (kraftwrapCompTr.length > 0) {
                kraftwrapRow_arr.push(kraftwrapCompTr.join(""))
            }
            if (cartonCompTr.length > 0) {
                cartonRow_arr.push(cartonCompTr.join(""))
            }
            if (palletCompTr.length > 0) {
                palletRow_arr.push(palletCompTr.join(""))
            }
        })
        // * concat tr element string
        packing_obj.paperband_tr = paperbandRow_arr.join("")
        packing_obj.kraftwrap_tr = kraftwrapRow_arr.join("")
        packing_obj.carton_tr = cartonRow_arr.join("")
        packing_obj.pallet_tr = palletRow_arr.join("")


        //* หาจำนวนแถวที่ต้อง rowspan  // prev = จำนวน rate ในแต่ละรอบส่ง
        const tr_rowspan = delivery?.reduce((prev, curr) =>
            prev += curr.qty_rate.reduce((prevRate, currRate) => //* prev (จำนวน rate รวมของทุกรอบส่ง) += จำนวน rate ที่มากที่สุดของยอด qty ทั้งหมด
                prevRate = prevRate < currRate.length  //*ค่าก่อนหน้า < ค่าปัจจุบัน
                    ? currRate.length
                    : prevRate
                , 0 //*ค่าเริ่มต้นของ qty_rate.reduce
            ), 0) //*ค่าเริ่มต้นของ delivery.reduce

        // * delivery process
        if (tr_rowspan > 0) {
            packing_obj.delivery_tr = delivery.map((obj, roundIndex) => {
                //* 1. รอบส่ง
                const tr_round_rowspan = obj.qty_rate.reduce((max, curr) => max = max < curr.length ? curr.length : max, 0)
                let tr = obj.rate_line.map((line, lineIndex) => {
                    /*
                    rate_line = จำนวนเรทส่ง // 1 ยอด อาจมีเรทส่งได้มากกว่า1 เรท ขึ้นอยู่กับน้ำหนัก
                    line = เรทส่ง, lineIndex = ลำดับของเรทส่ง
                    */

                    let td = '', tr_line = ''

                    line.forEach((qtyInfo, qtyIndex) => {
                        /*
                            qtyInfo = ยอดส่งนั้นๆ, qtyIndex = ลำดับของยอดส่ง
                        */
                        td += `<td class="alRight"><div class="deliveryRowUnitPrice" index="${roundIndex}" indexqty="${qtyIndex}">${numeral(qtyInfo.unit_price).format('0,0.00')}</div></td>
                        <td class="alCenter"><div class="deliveryRowQty" index="${roundIndex}" indexqty="${qtyIndex}">${numeral(qtyInfo.qty).format('0,0.00')}</div></td>
                        <td class="alRight"><div class="deliveryRowPrice" index="${roundIndex}" indexqty="${qtyIndex}">${numeral(qtyInfo.price).format('0,0.00')}</div></td>`
                    })

                    if (roundIndex === 0 && lineIndex === 0) {
                        //! รอบส่งแรก + เรทส่งแรก
                        tr_line += `<tr class="packing_tr delivery_tr" index="${roundIndex}">
                        <td rowspan="${tr_rowspan}" colspan="2">Delivery</td>
                        <td rowspan="${tr_round_rowspan}" colspan="3" class="alCenter"><div class="deliveryRowComponentname" index="${roundIndex}">${obj.destinationName} ${obj.dueDate ? `- ${moment(obj.dueDate, "YYYY-MM-DD").format("DD/MM/YYYY")}` : ""}</div></td>
                        ${td}
                    </tr>
                    `
                    } else {
                        // ! รอบส่งครั้งถัดๆไป
                        if (lineIndex === 0) {
                            // ! จำนวนแรก
                            tr_line += `<tr class="packing_tr delivery_tr" index="${roundIndex}">
                            <td rowspan="${tr_round_rowspan}" colspan="3" class="alCenter"><div class="deliveryRowComponentname" index="${roundIndex}">${obj.destinationName} ${obj.dueDate ? `- ${moment(obj.dueDate, "YYYY-MM-DD").format("DD/MM/YYYY")}` : ""}</div></td>
                            ${td}
                        </tr>
                        `
                        } else {
                            // ! จำนวนอื่นๆ
                            tr_line += `<tr class="packing_tr delivery_tr" index="${roundIndex}">
                            ${td}
                        </tr>
                        `
                        }

                    }

                    return tr_line
                })
                return tr
            }).join("")
        }

        return packing_obj
    }

    getProfitAndLossSection(table_id = '#summary') {
        $(`${table_id} #profit_and_lost`).remove()

        const div = `
            <tr id="profit_and_lost">
                <td colspan="17">
                    <div class="profit_and_lost_control" style="padding:5px;">
                        <input type='checkbox' class='is_loss'> <span class="mr-1">ขาดทุน</span>
                    </div>
                </td>
            </tr>
        `

        $(`${table_id} table tbody`).append(div)
    }

    getTrSummary(data = {}, tb_row, sub_proc) {
        const {
            job: {
                is_multiple_f: isMultipleF = false
            },
        } = data || {}

        return isMultipleF ? this.getEditionTRSummary(data, tb_row, sub_proc) : this.getNormalTRSummary(data, tb_row, sub_proc)
    }

    getNormalTRSummary(data = {}, tb_row, sub_proc) {
        const
            mainData = data,
            comp_arr = data.component1
        var tr = ""

        const printType = mainData.job.print_type

        switch (tb_row) {
            case 'paper':
                var paperColumn_arr = [],
                    paperRow_arr = [],
                    num_trPaper = 0

                //* number of line 
                const numTrPaper = comp_arr?.filter(comp => comp?.component_type?.type != 3)?.length || 0

                comp_arr.forEach((item, index) => {
                    let paperColumn = ''

                    if (item.component_type.type != 3) {
                        item.paper_usage.line.forEach((item1, index1) => {
                            paperColumn += `
                                <td class="alRight">
                                    <div class="paperRowUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.price.paper.unit_price).format('0,0.00')}</div>
                                </td>
                                <td class="alCenter">
                                    <div class="paperRowQty" index="${index}" indexqty="${index1}">${numeral(item1.price.paper.qty).format('0,0')}</div>
                                </td>
                                <td class="alRight">
                                    <div class="paperRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price.paper.price).format('0,0.00')}</div>
                                </td>
                            `
                        })

                        paperColumn_arr.push(paperColumn)

                        if (paperColumn_arr.length == 1) {
                            var paper_tr = `
                                <tr class="paper_tr" index=${index}>
                                    <td rowspan="${numTrPaper}">Paper</td>
                                    <td class="alCenter">
                                        <div class="paperRowComponentName" index=${index}>${item.component_name}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="paperRowPaperType" index=${index}>${item.paper.paper_name}</div>
                                    </td>
                                    <td colspan="2" class="alCenter">
                                        <div class="paperRowPaperGram" index=${index}>${item.paper.paper_gram} gsm</div>
                                    </td>
                                `

                        } else {
                            var paper_tr = `
                                <tr class="paper_tr" index=${index}>
                                    <td class="alCenter">
                                        <div class="paperRowComponentName" index=${index}>${item.component_name}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="paperRowPaperType" index=${index}>${item.paper.paper_name}</div>
                                    </td>
                                    <td colspan="2" class="alCenter">
                                        <div class="paperRowPaperGram" index=${index}>${item.paper.paper_gram} gsm</div>
                                    </td>
                            `

                        }

                        paperRow_arr.push(paper_tr)
                    }
                })

                if (paperColumn_arr.length != 0) {
                    paperColumn_arr.forEach((item, index) => {
                        tr += paperRow_arr[index] + item + `</tr>`
                    })
                }

                break
            case 'corrugated':
                comp_arr.forEach((item, index) => {
                    var corrugatedColumn1, corrugatedColumn2
                    if (item.corrugated_layer) {
                        item.corrugated_layer.price.forEach((item1, index1) => {
                            corrugatedColumn1 += `<td class="alRight"><div class="corugatedRowUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                            <td class="alCenter"><div class="corugatedRowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="corugatedRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                            corrugatedColumn2 += `<td colspan="3" rowspan="3">`
                        })
                        tr += `<tr class="corrugated_tr" index="${index}">
                                <td>Corrugated Board</td>
                                <td class="alCenter"><div class="corrugatedRowComponentName" index="${index}">${item.component_name}</div></td>
                                <td class="alCenter"><div class="corrugatedRowFlute" index="${index}">ลอน ${item.corrugated_layer.info.flute_type} ${item.corrugated_layer.info.num_layer} ชั้น</div></td>
                                <td colspan="2" class="alCenter"><div class="corrugatedRowName" index="${index}">${item.corrugated_layer.info.name}</div></td>
                                ${corrugatedColumn1}
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td colspan="2" class="alCenter"><div>ลอนขนานด้าน x Cut off</div></td>
                                <td class="alCenter" colspan="3">ราคาลูกฟูกต่อแผ่น</td>
                                ${corrugatedColumn2}
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td colspan="2" class="alCenter"><div class="corrugatedRowSize" index="${index}">${item.corrugated_layer.info.flute_side} x ${item.corrugated_layer.info.cut_off}</div></td>
                                <td class="alCenter" colspan="3"><div class="corrugatedRowUnit" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.unit_price)).format('0,0.00')}</div></td>
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td class="alCenter"><div>ราคาทุน</div></td>
                                <td class="alCenter"><div class="corrugatedRowCost" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.cost)).format('0,0.00')}</div></td>
                                <td class="alCenter"><div>B/ตร.ฟุต</div></td>
                                <td class="alCenter"><div class="corrugatedRowUnitInch" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.unit_inch)).format('0,0.0000')}</div></td>
                                <td class="alCenter"><div>B/ตร.นิ้ว</div></td>
                            </tr>`
                    }
                })
                break
            case 'special_ink':
                let countSpeInk = 0
                comp_arr.forEach((item, compIndex) => {
                    if (![null, undefined].includes(item?.color)) {
                        const speInkTr = comp_arr?.reduce((sumtr, comp) => sumtr += comp?.color?.reduce((total, curr) => total += curr?.special_ink?.length || 0, 0), 0)

                        item?.color?.forEach((color, colorIndex) => {
                            const { special_ink } = color || {}

                            special_ink?.forEach((specialInk, specialInkIndex) => {

                                var special_ink_column = ""
                                specialInk?.line?.forEach((line, lineIndex) => {

                                    special_ink_column += `
                                            <td class="alRight">
                                                <div class="specialInkRowUnitPrice" index="${compIndex}" indexqty="${0}">${numeral(line.unit_price).format('0,0.00')}</div>
                                            </td>
                                            <td class="alCenter">
                                                <div class="specialInkRowQty" index="${compIndex}" indexqty="${0}">${numeral(line.qty).format('0,0')}</div>
                                            </td>
                                            <td class="alRight">
                                                <div class="specialInkRowPrice" index="${compIndex}" indexqty="${0}">${numeral(line.price).format('0,0.00')}</div>
                                            </td>
                                        `
                                })

                                if (countSpeInk == 0 && colorIndex == 0 && specialInkIndex == 0) {
                                    tr += `<tr class="special_ink_tr" index="${compIndex}">
                                        <td rowspan="${speInkTr}">Special Ink</td>
                                        <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${item.component_name}</div>
                                        </td>
                                        <td colspan="3">${specialInk.name} : ${specialInk.info.ink_name}</td>
                                        ${special_ink_column}
                                    </tr>`
                                    countSpeInk++
                                } else {
                                    tr += `<tr class="special_ink_tr" index="${compIndex}">
                                            <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${item.component_name}</div>
                                        </td>
                                        <td colspan="3">${specialInk.name} : ${specialInk.info.ink_name}</td>
                                        ${special_ink_column}
                                    </tr>`
                                }
                            })

                        })
                    }


                })
                break
            case 'material':
                mainData.material.forEach((item, index) => {
                    var material_column = ""
                    item.line.forEach((item1, index1) => {
                        material_column += `<td class="alRight"><div class="materialUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                          <td class="alCenter"><div class="materialRowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0.00')}</div></td>
                                          <td class="alRight"><div class="materialRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                    })
                    tr += `<tr class="material_tr" index=${index}">
                            <td colspan="5" >${item.name}</td>
                            ${material_column}
                        </tr>`
                })
                break
            case 'print_plate':
                if (sub_proc == 'plate') {
                    if (printType == 'Offset') {
                        var proc_label = 'Plate', color_label = 'cols'
                    } else if (printType == 'Flexo') {
                        var proc_label = 'Plate Polymer (' + mainData.job.flexo_size[0] + ' x ' + mainData.job.flexo_size[1] + ' in²)',
                            color_label = 'cols'
                    } else if (printType == 'Jet Press') {
                        var proc_label = 'Plate'
                        var color_label = 'cols'
                    }

                } else if (sub_proc == 'proof') {
                    if (printType == 'Jet Press') {
                        var proc_label = 'Proof'
                        var color_label = 'cols'
                    }
                } else {
                    if (printType == 'Offset') {
                        var proc_label = 'Print'
                        if (mainData.job.ink_type == 'UV') {
                            var color_label = 'cols UV'
                        } else {
                            var color_label = 'cols'
                        }
                    } else if (printType == 'Flexo') {
                        var proc_label = 'Print Flexo'
                        var color_label = 'cols'
                    } else if (printType == 'Jet Press') {
                        var proc_label = 'Print'
                        var color_label = 'cols'
                    }
                }

                comp_arr.forEach((item, index) => {
                    var column_outside, column_inside

                    if (printType != 'Jet Press') {
                        if (['plate', 'print'].includes(sub_proc)) {
                            var machine_size = item.machine.machine_size.name
                            item.paper_usage.line.forEach((item1, index1) => {
                                if (sub_proc == 'plate') {
                                    var proc = item1.price.plate
                                } else {
                                    var proc = item1.price.print
                                }

                                column_outside += `<td class="alRight"><div class="${sub_proc}RowUnitPrice" index="${index}" indexqty="${index1}">${numeral(proc.outside.unit_price).format('0,0.00')}</div></td>
                                <td class="alCenter"><div class="${sub_proc}RowQty" index="{index}" indexqty="${index1}">${numeral(proc.outside.qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="${sub_proc}RowPrice" index="{index}" indexqty="${index1}">${numeral(proc.outside.price).format('0,0.00')}</div></td>`
                                column_inside += `<td class="alRight"><div class="${sub_proc}RowUnitPrice" index="${index}" indexqty="${index1}">${numeral(proc.inside.unit_price).format('0,0.00')}</div></td>
                                <td class="alCenter"><div class="${sub_proc}RowQty" index="{index}" indexqty="${index1}">${numeral(proc.inside.qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="${sub_proc}RowPrice" index="{index}" indexqty="${index1}">${numeral(proc.inside.price).format('0,0.00')}</div></td>`
                            })

                            if (index == 0) {
                                tr += `<tr index=${index} class="${sub_proc}Outside_tr">
                                    <td rowspan="${comp_arr.length * 2}">${proc_label}</td>
                                    <td class="alLeft"><div class="${sub_proc}RowOutside" index="${index}">${item.component_name} Outside</div></td>
                                    <td class="alCenter"><div class="${sub_proc}RowColOutside" index="${index}">${item.color[0].outside} ${color_label}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}CutOutside" index="${index}"">${machine_size}</div></td>
                                    ${column_outside}
                                </tr>
                                <tr index=${index} class="${sub_proc}Inside_tr">
                                    <td class="alLeft"><div class="${sub_proc}RowInside" index="${index}">${item.component_name} Inside</div></td>
                                    <td class="alCenter"><div class="${sub_proc}RowColInside" index="${index}">${item.color[0].inside} ${color_label}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}CutInside" index="${index}">${machine_size}</div></td>
                                    ${column_inside}
                                </tr>`
                            } else {
                                tr += `<tr index=${index} class="${sub_proc}Outside_tr">
                                    <td class="alLeft"><div class="${sub_proc}RowOutside" index="${index}">${item.component_name} Outside</div></td>
                                    <td class="alCenter"><div class="${sub_proc}RowColOutside" index="${index}">${item.color[0].outside} ${color_label}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}CutOutside" index="${index}">${machine_size}</div></td>
                                    ${column_outside}
                                </tr>
                                <tr index=${index} class="${sub_proc}Inside_tr">
                                    <td class="alLeft"><div class="${sub_proc}RowInside" index="${index}">${item.component_name} Inside</div></td>
                                    <td class="alCenter"><div class="${sub_proc}RowColInside" index="${index}">${item.color[0].inside} ${color_label}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}CutInside" index="${index}">${machine_size}</div></td>
                                    ${column_inside}
                                </tr>`
                            }
                        }
                    } else {
                        if (['proof', 'print'].includes(sub_proc)) {
                            let colorLabel = `${item.color[0]?.outside ? 4 : 0}/${item.color[0]?.inside ? 4 : 0} ${color_label}`
                            var machine_size = 'Jet Press',
                                column_all = ''

                            item.paper_usage.line.forEach((item1, index1) => {
                                if (sub_proc == 'proof') {
                                    var proc = item1.price.proof
                                } else {
                                    var proc = item1.price.print
                                }


                                column_all += `<td class="alRight"><div class="${sub_proc}RowUnitPrice" index="${index}" indexqty="${index1}">${numeral(proc.all.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="${sub_proc}RowQty" index="${index}" indexqty="${index1}">${numeral(proc.all.qty).format('0,0')}</div></td>
                                    <td class="alRight"><div class="${sub_proc}RowPrice" index="${index}" indexqty="${index1}">${numeral(proc.all.price).format('0,0.00')}</div></td>`
                            })

                            if (index == 0) {
                                if (sub_proc == 'proof') {
                                    tr += `<tr index=${index} class="${sub_proc}Allside_tr">
                                        <td rowspan="${comp_arr.length}">${proc_label}</td>
                                        <td class="alCenter" colspan="4"><div class="${sub_proc}RowAll" index="${index}">${item.component_name}</div></td>
                                        ${column_all}
                                    </tr>`
                                } else { //* print
                                    tr += `<tr index=${index} class="${sub_proc}Allside_tr">
                                        <td rowspan="${comp_arr.length}">${proc_label}</td>
                                        <td class="alCenter"><div class="${sub_proc}RowAll" index="${index}">${colorLabel}</div></td>
                                        <td class="alCenter" colspan="3"><div class="${sub_proc}RowAll" index="${index}">${item.component_name}</div></td>
                                        ${column_all}
                                    </tr>`
                                }

                            } else {
                                if (sub_proc == 'proof') {
                                    tr += `<tr index=${index} class="${sub_proc}Allside_tr">
                                            <td class="alCenter" colspan="4"><div class="${sub_proc}RowAll" index="${index}">${item.component_name}</div></td>
                                            ${column_all}
                                        </tr>`
                                } else {
                                    tr += `<tr index=${index} class="${sub_proc}Allside_tr">
                                            <td class="alCenter"><div class="${sub_proc}RowAll" index="${index}">${colorLabel}</div></td>
                                            <td class="alCenter" colspan="3"><div class="${sub_proc}RowAll" index="${index}">${item.component_name}</div></td>
                                            ${column_all}
                                        </tr>`
                                }
                            }
                        }
                    }
                })
                break
            case 'coating':
                var coatingColumn_arr = [], coatingRow_arr = [], num_trCoating = 0
                comp_arr.forEach((item) => {
                    item.addon.forEach((item1) => {
                        if (item1.type == 'coating') {
                            num_trCoating += 1
                        }
                    })
                })
                comp_arr.forEach((item, index) => {
                    item.addon.forEach((item1) => {
                        var coatingColumn = ""
                        if (item1.info.name == 'Other') {
                            var coating_option = ""
                        } else { var coating_option = item1.info.name }
                        if (item1.type == 'coating') {
                            item1.line.forEach((item2, index2) => {
                                coatingColumn += `<td class="alRight"><div class="coatingRowUnitPrice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="coatingRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="coatingRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                            })
                            coatingColumn_arr.push(coatingColumn)
                            if (['S-UV', 'S-UV-S'].includes(item1.info.code)) {
                                var size_label = "(" + item1.info.width + " x " + item1.info.length + " in²)"
                            } else {
                                var size_label = ""
                            }
                            if (coatingColumn_arr.length == 1) {
                                var coating_tr = `<tr class='coating_tr' index="${index}">
                                    <td rowspan="${num_trCoating}">Coating</td>
                                    <td class="alLeft"><div class="coatingRowComponentName" index="${index}">${item.component_name}</div></td>
                                    <td colspan="3" class="alLeft"><div class="coatingRowCoatingType" index="${index}">${coating_option} ${item1.info.type} ${item1.info.side} s ${size_label}</div></td>`
                            } else {
                                var coating_tr = `<tr>
                                    <td class="alLeft"><div class="coatingRowComponentName" index="${index}">${item.component_name}</div></td>
                                    <td colspan="3" class="alLeft"><div class="coatingRowCoatingType" index="${index}">${coating_option} ${item1.info.type} ${item1.info.side} s ${size_label}</div></td>`
                            }
                            coatingRow_arr.push(coating_tr)
                        }
                    })
                })
                if (coatingColumn_arr.length != 0) {
                    coatingColumn_arr.forEach((item, index) => {
                        tr += coatingRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'foilstamp':
                comp_arr.forEach((component, compIndex) => { //* loop components.
                    const { material_price_marking = 0 } = defaultData || {}
                    const foilstampAddon = component.addon.filter(obj => obj.type === 'foilstamp')
                    const num_process = []

                    foilstampAddon.forEach((addon, index) => {
                        const process_index = addon?.info?.process_index >= 0 ? addon?.info?.process_index : index
                        if (!num_process.includes(process_index)) {
                            num_process.push(process_index)
                        }
                    })


                    //* ได้เลขกรอบทั้งหมดของ foilstamp
                    num_process.forEach(process_id => { //* foilstamp แต่ละกรอบ
                        let trBlock = ``,
                            trRoll = ``,
                            trStamp = ``
                        //* หา process_id จาก addon list ที่ตรงกัน
                        const foilstampSize = foilstampAddon.filter((addon, a_index) => addon?.info?.process_index >= 0 ? addon?.info?.process_index === process_id : a_index === process_id)
                        const summary = {
                            foilRoll: [],
                            foilStamp: []
                        }

                        // if(foilstampSize.length > 1){
                        for (let qtyIndex = 0; qtyIndex < mainData.qty.totalqty.length; qtyIndex++) {
                            summary.foilRoll.push({
                                unit_price: 0,
                                qty: 0,
                                price: 0
                            })
                            summary.foilStamp.push({
                                unit_price: 0,
                                qty: 0,
                                price: 0
                            })
                        }
                        // }

                        foilstampSize.forEach((size, sizeIndex) => { //* foilstamp size แต่ละกรอบ [x*y , x*y]
                            const { line, info: { foil_roll_min_price = 0 } } = size

                            let blockStampColumn = ""


                            line.forEach((qtyDetail, qtyIndex) => {
                                const { labor, block, foil_roll } = qtyDetail

                                blockStampColumn += `<td class="alRight"><div class="blockStampRowUnitPrice" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="blockStampRowQty" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.qty).format('0,0')}</div></td>
                                    <td class="alRight"><div class="blockStampRowPrice" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.price).format('0,0.00')}</div></td>`

                                summary.foilRoll[qtyIndex].unit_price += foil_roll.unit_price
                                summary.foilRoll[qtyIndex].qty = foil_roll.qty
                                summary.foilRoll[qtyIndex].price += foil_roll.qty * foil_roll.unit_price

                                //* คิดค่า stamp ครั้งเดียว
                                summary.foilStamp[qtyIndex].unit_price = labor.unit_price
                                summary.foilStamp[qtyIndex].qty = labor.qty
                                summary.foilStamp[qtyIndex].price = labor.price
                            })

                            //* แต่ละกรอบมีค่า Block ตามจำนวน size
                            trBlock += `<tr class='foilStamp_tr' index="${process_id}" sizeIndex="${sizeIndex}">
                                <td>Block Foil  Stamp</td>
                                <td colspan="2" style="text-align:center"><div class="foilRowComponentName" index="${process_id}" sizeIndex="${sizeIndex}" >${component.component_name}</div></td>
                                <td colspan="2" style="text-align:center"><div class="foilRowArea" index="${process_id}" sizeIndex="${sizeIndex}" >Area (in²) : ${size.info.width} x ${size.info.length}</div></td>
                                ${blockStampColumn}
                            </tr>`
                        })

                        //* check min price
                        foilstampSize.forEach((size, sizeIndex) => {
                            const { line, info: { foil_roll_min_price = 0 } } = size

                            let roll_min_price = parseFloat((foil_roll_min_price * (1 + (material_price_marking / 100))).toFixed(2))

                            line.forEach((qtyDetail, qtyIndex) => {
                                summary.foilRoll[qtyIndex].price = summary.foilRoll[qtyIndex].price < foil_roll_min_price ? roll_min_price : summary.foilRoll[qtyIndex].price
                            })
                        })




                        let foilRollColumn = "",
                            foilStampColumn = ""

                        mainData.qty.totalqty.map((qty, qtyIndex) => {
                            foilRollColumn += `<td class="alRight"><div class="foilRollRowUnitPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].unit_price).format('0,0.0000')}</div></td>
                                <td class="alCenter"><div class="foilRollRowQty" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="foilRollRowPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].price).format('0,0.00')}</div></td>`

                            foilStampColumn += `<td class="alRight"><div class="foilStampRowUnitPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].unit_price).format('0,0.00000')}</div></td>
                                <td class="alCenter"><div class="foilStampRowQty" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="foilStampRowPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].price).format('0,0.00')}</div></td>`
                        })

                        //* แต่ละกรอบมีการสรุปข้อมูล Roll , Stamp กรอบละ 1 แถว
                        trRoll += `<tr class='foilStamp_tr' index="${process_id}">
                            <td colspan="3"><div class="foilRowRollWidth" index="${process_id}">Foil หน้าม้วน  ${foilstampSize[0].info.foil_width}" ความยาว ${foilstampSize[0].info.foil_length} ft </td>
                            <td colspan="2" class="alCenter"><div class="foilRowCode" index="${process_id}">สี${foilstampSize[0].info.color_th} ${foilstampSize[0].info.code}</div></td>
                            ${foilRollColumn}
                        </tr>`

                        trStamp += `<tr class='foilStamp_tr' index="${process_id}">
                            <td colspan="3">Foil Stamp</td>
                            <td colspan="2" class="alRight"></td>
                            ${foilStampColumn}
                        </tr>`

                        tr += trBlock + trRoll + trStamp

                    }) //* END foilstamp แต่ละกรอบ

                })
                break
            case 'bossing':

                // const bossing = comp_arr?.map(comp => comp?.addon?.filter(addon => addon.type == sub_proc))

                if (sub_proc == 'emboss') {
                    var proc_label = "Block Emboss", sub_proc_upper = "Emboss"
                } else {
                    var proc_label = "Block Deboss", sub_proc_upper = "Deboss"
                }

                comp_arr.forEach((item, index) => {
                    const bossing = item?.addon?.filter(addon => addon.type == sub_proc)
                    //     item.addon.forEach((item1,) => {
                    //         if (item1.type == sub_proc) {
                    bossing?.forEach(addon => {

                        let blockTr = "",
                            bossingTr = ""

                        let blockColumn = [],
                            bossingColumn = []

                        let block = []

                        //* BLOCK COST
                        addon.line?.block?.forEach((block, bIndex) => {
                            blockColumn = ''

                            blockTr += `
                                <tr class="${sub_proc}_tr">
                                    <td>${proc_label}</td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}RowComponentName">${item.component_name}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}RowArea">Area (in²) : ${block.size[0]} x ${block.size[1]}</div></td>
                                    
                            `

                            block?.line?.forEach((line, lIndex) => {
                                blockColumn += `
                                    <td class="alRight">
                                        <div class="block${sub_proc_upper}RowUnitPrice" indexqty="${lIndex}">${numeral(line.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="block${sub_proc_upper}RowQty" indexqty="${lIndex}">${numeral(line.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="block${sub_proc_upper}RowPrice" indexqty="${lIndex}">${numeral(line.price).format('0,0.00')}</div>
                                    </td>
                                `
                            })

                            blockTr += `
                                ${blockColumn}
                            </tr>
                            `
                        })

                        //*LABOR
                        bossingTr += `
                        <tr class="${sub_proc}_tr">
                            <td colspan="3">${sub_proc_upper}</td>
                            <td colspan="2" class="alCenter"></td>
                        `

                        addon.line?.labor?.forEach((price, pIndex) => {

                            bossingColumn += `
                                <td class="alRight">
                                    <div class="block${sub_proc_upper}RowUnitPrice" indexqty="${pIndex}">${numeral(price.unit_price).format('0,0.00000')}</div>
                                </td>
                                <td class="alCenter">
                                    <div class="block${sub_proc_upper}RowQty" indexqty="${pIndex}">${numeral(price.qty).format('0,0')}</div>
                                </td>
                                <td class="alRight">
                                    <div class="block${sub_proc_upper}RowPrice" indexqty="${pIndex}">${numeral(price.price).format('0,0.00')}</div>
                                </td>
                            `

                        })

                        bossingTr += `
                            ${bossingColumn}
                            </tr>
                        `

                        tr += blockTr
                        tr += bossingTr
                    })

                }) //* Component

                break
            case 'diecut':
                var diecutColumn_arr = [], blockColumn_arr = [], diecutRow_arr = [], blockRow_arr = []
                if (mainData.job.is_reprinted) {
                    var block_label = 'Block Diecut (Reprint)'
                } else {
                    var block_label = 'Block Diecut'
                }
                comp_arr.forEach((item) => {
                    item.process.forEach((item1, index1) => {
                        if (item1.name == 'diecut') {
                            var diecutColumn = "", blockColumn = ""
                            item1.line.forEach((item2, index2) => {
                                blockColumn += `<td class="alRight"><div class="blockDiecutRowUnitPrice" index="${index1}" indexqty="${index2}">${numeral(item2.block.unit_price).format('0,0.00')}</div></td>
                                            <td class="alCenter"><div class="blockDiecutRowQty" index="${index1}" indexqty="${index2}">${numeral(item2.block.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="blockDiecutRowPrice" index="${index1}" indexqty="${index2}">${numeral(item2.block.price).format('0,0.00')}</div></td>`
                                diecutColumn += `<td class="alRight"><div class="diecutRowUnitPrice" index="${index1}" indexqty="${index2}">${numeral(item2.labor.unit_price).format('0,0.00000')}</div></td>
                                            <td class="alCenter"><div class="diecutRowQty" index="${index1}" indexqty="${index2}">${numeral(item2.labor.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="diecutRowPrice" index="${index1}" indexqty="${index2}">${numeral(item2.labor.price).format('0,0.00')}</div></td>`
                            })
                            diecutColumn_arr.push(diecutColumn)
                            blockColumn_arr.push(blockColumn)
                            if (blockColumn_arr.length == 1) {
                                var blockRow = `<tr index="${index1}" class="diecut_tr">
                                        <td colspan="3"rowspan="${comp_arr.length}">${block_label}</td>
                                        <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${item.component_name}</div></td>`
                                var diecutRow = `<tr>
                                        <td colspan="3" rowspan="${comp_arr.length}">Diecut</td>
                                        <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${item.component_name}</div></td>`
                            } else {
                                var blockRow = `<tr index="${index1}" class="diecut_tr">
                                            <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${item.component_name}</div></td>`
                                var diecutRow = `<tr>
                                            <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${item.component_name}</div></td>`
                            }
                            diecutRow_arr.push(diecutRow)
                            blockRow_arr.push(blockRow)
                        }
                    })
                })
                if (blockColumn_arr.length != 0) {
                    blockColumn_arr.forEach((item, index) => {
                        tr += blockRow_arr[index] + item + `</tr>`
                    })
                }
                if (diecutColumn_arr.length != 0) {
                    diecutColumn_arr.forEach((item, index) => {
                        tr += diecutRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'main_process':
                switch (sub_proc) {
                    case 'chip':
                        var proc_label = "แกะ"
                        break
                    case 'inspection':
                        var proc_label = "Inspection"
                        break
                    case 'trim':
                        var proc_label = "Trim"
                        break
                    case 'shrinkwrap':
                        var proc_label = "Shrinkwrap"
                        break
                }
                mainData.process.forEach((item) => {
                    if (item.name == sub_proc) {
                        var Column = ""
                        item.line.forEach((item1, index1) => {
                            Column += `<td class="alRight"><div class="${sub_proc}RowUnitPrice" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="${sub_proc}RowQty" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="${sub_proc}RowPrice" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                        })
                        tr = `<tr class="${sub_proc}_tr">
                                <td colspan="5">${proc_label}</td>
                                ${Column}
                            </tr>`
                    }
                })
                break
            case 'corrugated_glued':
                var corrugatedGluedColumn_arr = [], corrugatedGluedRow_arr = [], num_trCorrugatedGlued = 0
                comp_arr.forEach((item,) => {
                    item.process.forEach((item1,) => {
                        if (item1.name == 'corrugated_glued') {
                            num_trCorrugatedGlued += 1
                        }
                    })
                })
                comp_arr.forEach((item, index) => {
                    item.process.forEach((item1) => {
                        var corrugatedGluedColumn = ""
                        if (item1.name == 'corrugated_glued') {
                            item1.line.forEach((item2, index2) => {
                                corrugatedGluedColumn += `<td class="alRight"><div class="corrugatedGluedRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="corrugatedGluedRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="corrugatedGluedRowprice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                            })
                            corrugatedGluedColumn_arr.push(corrugatedGluedColumn)
                            if (corrugatedGluedColumn_arr.length == 1) {
                                var corrugated_tr = `<tr class="corrugatedGlued_tr" index="${index}" >
                                    <td rowspan="${num_trCorrugatedGlued}" colspan="2">ทากาวประกบลูกฟูกกับกระดาษ</td>
                                    <td class="alCenter"><div class="corrugatedGluedRowComponentName" index="${index}">${item.component_name}</div></td>
                                    <td colspan="2" class="alCenter"><div class="corrugatedRowGlued" index="${index}">${defaultData.corrugated_glued_cost} B/sqinch</div></td>`
                            } else {
                                var corrugated_tr = `<tr class="corrugatedGlued_tr" index="${index}">
                                    <td class="alCenter"><div class="corrugatedGluedRowComponentName" index="${index}">${item.component_name}</div></td>
                                    <td colspan="2" class="alCenter"><div class="corrugatedGluedRowGlued" index="${index}">${defaultData.corrugated_glued_cost} B/sqinch</div></td>`
                            }
                            corrugatedGluedRow_arr.push(corrugated_tr)
                        }
                    })
                })
                if (corrugatedGluedColumn_arr.length != 0) {
                    corrugatedGluedColumn_arr.forEach((item, index) => {
                        tr += corrugatedGluedRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'assembly':
                var assemblyColumn_arr = [], assemblyRow_arr = []
                var num_trAssembly = 0
                comp_arr.forEach((item) => {
                    item.process.forEach((item1) => {
                        if (item1.name == 'assembly') {
                            num_trAssembly += 1
                        }
                    })
                })
                comp_arr.forEach((item, index) => {
                    item.process.forEach((item1, index1) => {
                        if (item1.name == 'assembly') {
                            var assemblyColumn = ""
                            item1.line.forEach((item2) => {
                                assemblyColumn += `<td class="alRight"><div class="assemblyRowUnitPrice" index="${index}" indexqty="${index1}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                            <td class="alCenter"><div class="assemblyRowQty" index="${index}" indexqty="${index1}">${numeral(item2.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="assemblyRowPrice"  index="${index}"indexqty="${index1}">${numeral(item2.price).format('0,0.00')}</div></td>`
                            })
                            assemblyColumn_arr.push(assemblyColumn)
                            if (assemblyColumn_arr.length == 1) {
                                var assembly_tr = `<tr index="${index}" class="assembly_tr">
                                            <td rowspan="${num_trAssembly}" colspan="3">Assembly (ประกบ/ติดลิ้นกาว)</td>
                                            <td colspan="2" class="alCenter""><div class="assemblyRowComponentName">${item.component_name} ติดกาว ${item.box_type.glued_spot} จุด</div></td>`
                            } else {
                                var assembly_tr = `<tr index="${index}" class="assembly_tr">
                                            <td colspan="2" class="alCenter""><div class="assemblyRowComponentName">${item.component_name} ติดกาว ${item.box_type.glued_spot} จุด</div></td>`
                            }
                            assemblyRow_arr.push(assembly_tr)
                        }
                    })
                })
                if (assemblyColumn_arr.length != 0) {
                    assemblyColumn_arr.forEach((item, index) => {
                        tr += assemblyRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'process':
                var tr = ""
                mainData.process.forEach((item, index) => {
                    if (sub_proc == 'other') {
                        var label = 'otherProcess'
                    } else if (sub_proc == 'handwork') {
                        var label = 'handworkProcess'
                    } else if (sub_proc == 'custom') {
                        var label = 'customProcess'
                    } else {
                        console.log('sub_proc not match // process')
                    }

                    if (item.type == sub_proc) {
                        var process_column = ""
                        item.line.forEach((item1, index1) => {
                            process_column += `<td class="alRight"><div class="${label}UnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.0000')}</div></td>
                                                <td class="alCenter"><div class="${label}RowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                                                <td class="alRight"><div class="${label}RowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                        })
                        tr += `<tr class="${label}_tr" index=${index}">
                                <td colspan="5" >${item.name}</td>
                                ${process_column}
                            </tr>`
                    }
                })
                break
            //? update: 14.03.22
            case 'otherCost':
                mainData?.otherCost && mainData?.otherCost?.forEach((item, index) => {
                    var otherCost_column = ""
                    item.line.forEach((item1, index1) => {
                        otherCost_column += `
                            <td class="alRight"><div class="otherCostUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                            <td class="alCenter"><div class="otherCostRowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0.00')}</div></td>
                            <td class="alRight"><div class="otherCostRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>
                        `
                    })
                    tr += `
                    <tr class="material_tr" index=${index}">
                        <td colspan="5" >${item.name}</td>
                        ${otherCost_column}
                    </tr>
                    `
                })
                break

        }
        return tr
    }

    getEditionTRSummary(data = {}, tb_row, sub_proc) {
        const
            mainData = data,
            comp_arr = data.component1
        const qtyLength = mainData?.qty?.totalqty || 0
        var tr = ""

        const printType = mainData.job.print_type

        switch (tb_row) {
            case 'paper':
                var paperColumn_arr = [],
                    paperRow_arr = []

                comp_arr.forEach((comp, compIndex) => {
                    const numTrPaper = comp?.f_detail?.f_list?.length || 1
                    let paperColumn = ''
                    if (comp.component_type.type != 3) {

                        comp?.f_detail?.f_list?.forEach((fInfo, fIndex) => {
                            const paper_usage = comp.paper_usage.line[fIndex]

                            if (fIndex == 0 && compIndex == 0) {
                                var paper_tr = `
                                    <tr class="paper_tr" index=${compIndex} fIndex=${fIndex}>
                                        <td rowspan="${numTrPaper}">Paper</td>
                                        <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${fInfo?.f_code}</div>
                                        </td>
                                        <td class="alCenter">
                                            <div class="paperRowPaperType" index=${compIndex}>${comp.paper.paper_name}</div>
                                        </td>
                                        <td colspan="2" class="alCenter">
                                            <div class="paperRowPaperGram" index=${compIndex}>${comp.paper.paper_gram} gsm</div>
                                        </td>
                                    `

                            } else {
                                var paper_tr = `
                                    <tr class="paper_tr" index=${compIndex}>
                                        <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${fInfo?.f_code}</div>
                                        </td>
                                        <td class="alCenter">
                                            <div class="paperRowPaperType" index=${compIndex}>${comp.paper.paper_name}</div>
                                        </td>
                                        <td colspan="2" class="alCenter">
                                            <div class="paperRowPaperGram" index=${compIndex}>${comp.paper.paper_gram} gsm</div>
                                        </td>
                                `

                            }

                            paperRow_arr.push(paper_tr)

                            paperColumn = `
                                <td class="alRight">
                                    <div class="paperRowUnitPrice" index="${compIndex}" fIndex=${fIndex} indexqty="${0}">${numeral(paper_usage.price.paper.unit_price).format('0,0.00')}</div>
                                </td>
                                <td class="alCenter">
                                    <div class="paperRowQty" index="${compIndex}" fIndex=${fIndex} indexqty="${0}">${numeral(paper_usage.price.paper.qty).format('0,0')}</div>
                                </td>
                                <td class="alRight">
                                    <div class="paperRowPrice" index="${compIndex}" fIndex=${fIndex} indexqty="${0}">${numeral(paper_usage.price.paper.price).format('0,0.00')}</div>
                                </td>
                            `

                            paperColumn_arr.push(paperColumn)
                        })

                    }
                })

                if (paperColumn_arr.length != 0) {
                    paperColumn_arr.forEach((item, index) => {
                        tr += paperRow_arr[index] + item + `</tr>`
                    })
                }

                break
            case 'corrugated':
                comp_arr.forEach((item, index) => {
                    var corrugatedColumn1, corrugatedColumn2
                    if (item.corrugated_layer) {
                        item.corrugated_layer.price.forEach((item1, index1) => {
                            corrugatedColumn1 += `<td class="alRight"><div class="corugatedRowUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                            <td class="alCenter"><div class="corugatedRowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="corugatedRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                            corrugatedColumn2 += `<td colspan="3" rowspan="3">`
                        })
                        tr += `<tr class="corrugated_tr" index="${index}">
                                <td>Corrugated Board</td>
                                <td class="alCenter"><div class="corrugatedRowComponentName" index="${index}">${item.component_name}</div></td>
                                <td class="alCenter"><div class="corrugatedRowFlute" index="${index}">ลอน ${item.corrugated_layer.info.flute_type} ${item.corrugated_layer.info.num_layer} ชั้น</div></td>
                                <td colspan="2" class="alCenter"><div class="corrugatedRowName" index="${index}">${item.corrugated_layer.info.name}</div></td>
                                ${corrugatedColumn1}
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td colspan="2" class="alCenter"><div>ลอนขนานด้าน x Cut off</div></td>
                                <td class="alCenter" colspan="3">ราคาลูกฟูกต่อแผ่น</td>
                                ${corrugatedColumn2}
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td colspan="2" class="alCenter"><div class="corrugatedRowSize" index="${index}">${item.corrugated_layer.info.flute_side} x ${item.corrugated_layer.info.cut_off}</div></td>
                                <td class="alCenter" colspan="3"><div class="corrugatedRowUnit" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.unit_price)).format('0,0.00')}</div></td>
                            </tr>
                            <tr class="corrugated_tr" index="${index}">
                                <td class="alCenter"><div>ราคาทุน</div></td>
                                <td class="alCenter"><div class="corrugatedRowCost" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.cost)).format('0,0.00')}</div></td>
                                <td class="alCenter"><div>B/ตร.ฟุต</div></td>
                                <td class="alCenter"><div class="corrugatedRowUnitInch" index="${index}">${numeral(Math.max(...item.corrugated_layer.info.unit_inch)).format('0,0.0000')}</div></td>
                                <td class="alCenter"><div>B/ตร.นิ้ว</div></td>
                            </tr>`
                    }
                })
                break
            case 'special_ink':
                let isFirstSpeink = true
                comp_arr.forEach((item, compIndex) => {
                    if (![null, undefined].includes(item?.color)) {
                        const speInkTr = item?.color?.reduce((total, curr) => total += curr?.special_ink?.length || 0, 0)

                        item?.color?.forEach((color, colorIndex) => {
                            const { f_code, special_ink } = color || {}

                            special_ink?.forEach((specialInk, specialInkIndex) => {

                                var special_ink_column = ""
                                specialInk?.line?.forEach((line, lineIndex) => {

                                    special_ink_column += `
                                            <td class="alRight">
                                                <div class="specialInkRowUnitPrice" index="${compIndex}" indexqty="${0}">${numeral(line.unit_price).format('0,0.00')}</div>
                                            </td>
                                            <td class="alCenter">
                                                <div class="specialInkRowQty" index="${compIndex}" indexqty="${0}">${numeral(line.qty).format('0,0')}</div>
                                            </td>
                                            <td class="alRight">
                                                <div class="specialInkRowPrice" index="${compIndex}" indexqty="${0}">${numeral(line.price).format('0,0.00')}</div>
                                            </td>
                                        `
                                })

                                if (compIndex == 0 && isFirstSpeink) {
                                    tr += `<tr class="special_ink_tr" index="${compIndex}">
                                        <td rowspan="${speInkTr}">Special Ink</td>
                                        <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${f_code}</div>
                                        </td>
                                        <td colspan="3">${specialInk.name} : ${specialInk.info.ink_name}</td>
                                        ${special_ink_column}
                                    </tr>`

                                    isFirstSpeink = false
                                } else {
                                    tr += `<tr class="special_ink_tr" index="${compIndex}">
                                            <td class="alCenter">
                                            <div class="paperRowComponentName" index=${compIndex}>${f_code}</div>
                                        </td>
                                        <td colspan="3">${specialInk.name} : ${specialInk.info.ink_name}</td>
                                        ${special_ink_column}
                                    </tr>`
                                }
                            })

                        })
                    }


                })
                break;
            case 'material':
                mainData.material.forEach((item, compIndex) => {
                    item.line.forEach((item1, fIndex) => {
                        var material_column = ""

                        mainData.qty.totalqty.forEach((qty, qtyIndex) => {
                            material_column += `<td class="alRight"><div class="materialUnitPrice" index="${compIndex}" indexqty="${qtyIndex}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                          <td class="alCenter"><div class="materialRowQty" index="${compIndex}" indexqty="${qtyIndex}">${numeral(item1.qty).format('0,0.00')}</div></td>
                                          <td class="alRight"><div class="materialRowPrice" index="${compIndex}" indexqty="${qtyIndex}">${numeral(item1.price).format('0,0.00')}</div></td>`
                        })

                        tr += `<tr class="material_tr" index=${compIndex}" fIndex=${fIndex}>
                                    <td colspan="5" >${item.name}</td>
                                    ${material_column}
                                </tr>`

                    })
                })
                break;
            case 'print_plate':
                var proc_label = '',
                    color_label = ''

                if (sub_proc == 'plate') {
                    if (printType == 'Offset') {
                        proc_label = 'Plate'
                        color_label = 'cols'

                    } else if (printType == 'Flexo') {
                        proc_label = `Plate Polymer (${mainData.job.flexo_size[0]} x ${mainData.job.flexo_size[1]} in²)`
                        color_label = 'cols'

                    } else if (printType == 'Jet Press') {
                        proc_label = 'Plate'
                        color_label = 'cols'
                    }

                } else if (sub_proc == 'proof') {
                    if (printType == 'Jet Press') {
                        proc_label = 'Proof'
                        color_label = 'cols'
                    }
                } else {
                    if (printType == 'Offset') {
                        proc_label = 'Print'

                        if (mainData.job.ink_type == 'UV') {
                            color_label = 'cols UV'
                        } else {
                            color_label = 'cols'
                        }

                    } else if (printType == 'Flexo') {
                        proc_label = 'Print Flexo'
                        color_label = 'cols'

                    } else if (printType == 'Jet Press') {
                        proc_label = 'Print'
                        color_label = 'cols'
                    }
                }

                comp_arr.forEach((comp, compIndex) => {
                    const { machine, f_detail: { f_list }, paper_usage, color } = comp || {}
                    var machineName = '',
                        proc = ''

                    if (printType != 'Jet Press') {
                        machineName = machine.machine_size.name
                    } else {
                        machineName = 'Jet Press'
                    }

                    f_list?.forEach((fInfo, fIndex) => {
                        const paperUasgeInfo = paper_usage.line[fIndex]
                        const fColor = color.find(col => col.f_code === fInfo?.f_code) || {}
                        let column_outside = '',
                            column_inside = ''

                        if (sub_proc == 'plate') {
                            proc = paperUasgeInfo.price.plate
                        } else if (sub_proc == 'proof') {
                            proc = paperUasgeInfo.price?.proof
                        } else {
                            proc = paperUasgeInfo.price.print
                        }

                        if (printType != 'Jet Press') { //* Offset , Flexo
                            if (['plate', 'print'].includes(sub_proc)) {
                                mainData.qty.totalqty.forEach((qty, qtyIndex) => {
                                    column_outside += `
                                    <td class="alRight">
                                        <div class="${sub_proc}RowUnitPrice" index="${compIndex}" indexqty="${0}">${numeral(proc.outside.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="${sub_proc}RowQty" index="{index}" indexqty="${0}">${numeral(proc.outside.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="${sub_proc}RowPrice" index="{index}" indexqty="${0}">${numeral(proc.outside.price).format('0,0.00')}</div>
                                    </td>`

                                    column_inside += `
                                    <td class="alRight">
                                        <div class="${sub_proc}RowUnitPrice" index="${compIndex}" indexqty="${0}">${numeral(proc.inside.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="${sub_proc}RowQty" index="{index}" indexqty="${0}">${numeral(proc.inside.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="${sub_proc}RowPrice" index="{index}" indexqty="${0}">${numeral(proc.inside.price).format('0,0.00')}</div>
                                    </td>`
                                })

                                if (compIndex == 0 && fIndex == 0) {
                                    tr += `<tr index=${compIndex} class="${sub_proc}Outside_tr">
                                            <td rowspan="${comp_arr.length * 2 * (f_list.length || 1)}">${proc_label}</td>
                                            <td class="alLeft"><div class="${sub_proc}RowOutside" index="${compIndex}">${fInfo?.f_code} Outside</div></td>
                                            <td class="alCenter"><div class="${sub_proc}RowColOutside" index="${compIndex}">${fColor?.outside} ${color_label}</div></td>
                                            <td colspan="2" class="alCenter"><div class="${sub_proc}CutOutside" index="${compIndex}"">${machineName}</div></td>
                                            ${column_outside}
                                        </tr>
                                        <tr index=${compIndex} class="${sub_proc}Inside_tr">
                                            <td class="alLeft"><div class="${sub_proc}RowInside" index="${compIndex}">${fInfo?.f_code} Inside</div></td>
                                            <td class="alCenter"><div class="${sub_proc}RowColInside" index="${compIndex}">${fColor?.inside} ${color_label}</div></td>
                                            <td colspan="2" class="alCenter"><div class="${sub_proc}CutInside" index="${compIndex}">${machineName}</div></td>
                                            ${column_inside}
                                        </tr>`
                                } else {
                                    tr += `<tr index=${compIndex} class="${sub_proc}Outside_tr">
                                            <td class="alLeft"><div class="${sub_proc}RowOutside" index="${compIndex}">${fInfo?.f_code} Outside</div></td>
                                            <td class="alCenter"><div class="${sub_proc}RowColOutside" index="${compIndex}">${fColor?.outside} ${color_label}</div></td>
                                            <td colspan="2" class="alCenter"><div class="${sub_proc}CutOutside" index="${compIndex}">${machineName}</div></td>
                                            ${column_outside}
                                        </tr>
                                        <tr index=${compIndex} class="${sub_proc}Inside_tr">
                                            <td class="alLeft"><div class="${sub_proc}RowInside" index="${compIndex}">${fInfo?.f_code} Inside</div></td>
                                            <td class="alCenter"><div class="${sub_proc}RowColInside" index="${compIndex}">${fColor?.inside} ${color_label}</div></td>
                                            <td colspan="2" class="alCenter"><div class="${sub_proc}CutInside" index="${compIndex}">${machineName}</div></td>
                                            ${column_inside}
                                        </tr>`
                                }
                            }
                        } else { //* Jet Press
                            if (['proof', 'print'].includes(sub_proc)) {
                                let colorLabel = `${fColor?.outside ? 4 : 0}/${fColor?.inside ? 4 : 0} ${color_label}`,
                                    column_all = ''

                                mainData.qty.totalqty.forEach((qty, qtyIndex) => {
                                    column_all += `
                                    <td class="alRight">
                                        <div class="${sub_proc}RowUnitPrice" index="${compIndex}" indexqty="${0}">${numeral(proc.all.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="${sub_proc}RowQty" index="{index}" indexqty="${0}">${numeral(proc.all.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="${sub_proc}RowPrice" index="{index}" indexqty="${0}">${numeral(proc.all.price).format('0,0.00')}</div>
                                    </td>`
                                })

                                if (compIndex == 0 && fIndex == 0) {
                                    if (sub_proc == 'proof') {
                                        tr += `<tr index=${compIndex} class="${sub_proc}Allside_tr">
                                        <td rowspan="${comp_arr.length * 1 * (f_list.length || 1)}">${proc_label}</td>
                                        <td class="alCenter" colspan="4"><div class="${sub_proc}RowAll" index="${compIndex}">${fInfo?.f_code}</div></td>
                                        ${column_all}
                                    </tr>`
                                    } else {
                                        tr += `<tr index=${compIndex} class="${sub_proc}Allside_tr">
                                                <td rowspan="${comp_arr.length * 1 * (f_list.length || 1)}">${proc_label}</td>
                                                <td class="alCenter"><div class="${sub_proc}RowColAll" index="${compIndex}">${colorLabel}</div></td>
                                                <td class="alCenter" colspan="3"><div class="${sub_proc}RowAll" index="${compIndex}">${fInfo?.f_code}</div></td>
                                                ${column_all}
                                            </tr>`
                                    }
                                } else {
                                    if (sub_proc == 'proof') {
                                        tr += `<tr index=${compIndex} class="${sub_proc}Allside_tr">
                                    <td class="alCenter" colspan="4"><div class="${sub_proc}RowAll" index="${compIndex}">${fInfo?.f_code}</div></td>
                                                ${column_all}
                                            </tr>`
                                    } else {
                                        tr += `<tr index=${compIndex} class="${sub_proc}Allside_tr">
                                    <td class="alCenter"><div class="${sub_proc}RowColAll" index="${compIndex}">${colorLabel}</div></td>
                                    <td class="alCenter" colspan="3"><div class="${sub_proc}RowAll" index="${compIndex}">${fInfo?.f_code}</div></td>
                                                ${column_all}
                                            </tr>`
                                    }
                                }
                            }
                        }
                    })

                })
                break
            case 'coating':
                var coatingColumn_arr = [], coatingRow_arr = [], num_trCoating = 0
                comp_arr.forEach((item) => {
                    item.addon.forEach((item1) => {
                        if (item1.type == 'coating') {
                            num_trCoating += 1
                        }
                    })
                })

                comp_arr.forEach((item, index) => {
                    item.addon.forEach((item1) => {
                        var coatingColumn = '',
                            coating_option = '',
                            compName = 'All'

                        if (item1.info.name != 'Other') {
                            coating_option = item1.info.name
                        }

                        if (item1.type == 'coating') {
                            item1.line.forEach((item2, index2) => {
                                coatingColumn += `
                                    <td class="alRight">
                                        <div class="coatingRowUnitPrice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="coatingRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="coatingRowPrice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div>
                                    </td>`
                            })

                            coatingColumn_arr.push(coatingColumn)

                            if (['S-UV', 'S-UV-S'].includes(item1.info.code)) {
                                var size_label = "(" + item1.info.width + " x " + item1.info.length + " in²)"
                            } else {
                                var size_label = ""
                            }

                            if (coatingColumn_arr.length == 1) {
                                var coating_tr = `<tr class='coating_tr' index="${index}">
                                    <td rowspan="${num_trCoating}">Coating</td>
                                    <td rowspan="${num_trCoating}"class="alCenter">
                                        <div class="coatingRowComponentName" index="${index}">${compName}</div>
                                    </td>
                                    <td colspan="3" class="alLeft">
                                        <div class="coatingRowCoatingType" index="${index}">${coating_option} ${item1.info.type} ${item1.info.side} s ${size_label}</div>
                                    </td>`
                            } else {
                                var coating_tr = `<tr>
                                    <td colspan="3" class="alLeft">
                                        <div class="coatingRowCoatingType" index="${index}">${coating_option} ${item1.info.type} ${item1.info.side} s ${size_label}</div>
                                    </td>`
                            }

                            coatingRow_arr.push(coating_tr)
                        }
                    })
                })

                if (coatingColumn_arr.length != 0) {
                    coatingColumn_arr.forEach((item, index) => {
                        tr += coatingRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'foilstamp':
                comp_arr.forEach((component, compIndex) => { //* loop components.
                    const foilstampAddon = component.addon.filter(obj => obj.type === 'foilstamp')
                    const num_process = []

                    foilstampAddon.forEach((addon, index) => {
                        const process_index = addon?.info?.process_index >= 0 ? addon?.info?.process_index : index
                        if (!num_process.includes(process_index)) {
                            num_process.push(process_index)
                        }
                    })


                    //* ได้เลขกรอบทั้งหมดของ foilstamp
                    num_process.forEach(process_id => { //* foilstamp แต่ละกรอบ
                        let trBlock = ``,
                            trRoll = ``,
                            trStamp = ``

                        //* หา process_id จาก addon list ที่ตรงกัน
                        const foilstampSize = foilstampAddon.filter((addon, a_index) => addon?.info?.process_index >= 0 ? addon?.info?.process_index === process_id : a_index === process_id)
                        const summary = {
                            foilRoll: [],
                            foilStamp: []
                        }

                        // if(foilstampSize.length > 1){
                        for (let qtyIndex = 0; qtyIndex < mainData.qty.totalqty.length; qtyIndex++) {
                            summary.foilRoll.push({
                                unit_price: 0,
                                qty: 0,
                                price: 0
                            })
                            summary.foilStamp.push({
                                unit_price: 0,
                                qty: 0,
                                price: 0
                            })
                        }
                        // }

                        foilstampSize.forEach((size, sizeIndex) => { //* foilstamp size แต่ละกรอบ [x*y , x*y]
                            const { line, info: { f_code } } = size || {}

                            let blockStampColumn = ""
                            const compName = f_code.join(", ")

                            line.forEach((qtyDetail, qtyIndex) => {
                                const { labor, block, foil_roll } = qtyDetail

                                blockStampColumn += `<td class="alRight"><div class="blockStampRowUnitPrice" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.unit_price).format('0,0.00')}</div></td>
                                    <td class="alCenter"><div class="blockStampRowQty" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.qty).format('0,0')}</div></td>
                                    <td class="alRight"><div class="blockStampRowPrice" index="${process_id}" sizeIndex="${sizeIndex}" indexqty="${qtyIndex}">${numeral(block.price).format('0,0.00')}</div></td>`

                                summary.foilRoll[qtyIndex].unit_price += foil_roll.unit_price
                                summary.foilRoll[qtyIndex].qty = foil_roll.qty
                                summary.foilRoll[qtyIndex].price += foil_roll.qty * foil_roll.unit_price

                                //* คิดค่า stamp ครั้งเดียว
                                summary.foilStamp[qtyIndex].unit_price = labor.unit_price
                                summary.foilStamp[qtyIndex].qty = labor.qty
                                summary.foilStamp[qtyIndex].price = labor.price
                            })

                            //* แต่ละกรอบมีค่า Block ตามจำนวน size
                            trBlock += `<tr class='foilStamp_tr' index="${process_id}" sizeIndex="${sizeIndex}">
                                <td>Block Foil  Stamp</td>
                                <td colspan="2" style="text-align:center"><div class="foilRowComponentName" index="${process_id}" sizeIndex="${sizeIndex}" >${compName}</div></td>
                                <td colspan="2" style="text-align:center"><div class="foilRowArea" index="${process_id}" sizeIndex="${sizeIndex}" >Area (in²) : ${size.info.width} x ${size.info.length}</div></td>
                                ${blockStampColumn}
                            </tr>`
                        })

                        //* check min price
                        foilstampSize.forEach((size, sizeIndex) => {
                            const { line, info: { foil_roll_min_price = 0 } } = size
                            line.forEach((qtyDetail, qtyIndex) => {
                                summary.foilRoll[qtyIndex].price = summary.foilRoll[qtyIndex].price < foil_roll_min_price ? foil_roll_min_price : summary.foilRoll[qtyIndex].price
                            })
                        })




                        let foilRollColumn = "",
                            foilStampColumn = ""

                        mainData.qty.totalqty.map((qty, qtyIndex) => {
                            foilRollColumn += `<td class="alRight"><div class="foilRollRowUnitPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].unit_price).format('0,0.0000')}</div></td>
                                <td class="alCenter"><div class="foilRollRowQty" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="foilRollRowPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilRoll[qtyIndex].price).format('0,0.00')}</div></td>`

                            foilStampColumn += `<td class="alRight"><div class="foilStampRowUnitPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].unit_price).format('0,0.00000')}</div></td>
                                <td class="alCenter"><div class="foilStampRowQty" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].qty).format('0,0')}</div></td>
                                <td class="alRight"><div class="foilStampRowPrice" index="${index}" indexqty="${qtyIndex}">${numeral(summary.foilStamp[qtyIndex].price).format('0,0.00')}</div></td>`
                        })

                        //* แต่ละกรอบมีการสรุปข้อมูล Roll , Stamp กรอบละ 1 แถว
                        trRoll += `<tr class='foilStamp_tr' index="${process_id}">
                            <td colspan="3"><div class="foilRowRollWidth" index="${process_id}">Foil หน้าม้วน  ${foilstampSize[0].info.foil_width}" ความยาว ${foilstampSize[0].info.foil_length} ft </td>
                            <td colspan="2" class="alCenter"><div class="foilRowCode" index="${process_id}">สี${foilstampSize[0].info.color_th} ${foilstampSize[0].info.code}</div></td>
                            ${foilRollColumn}
                        </tr>`

                        trStamp += `<tr class='foilStamp_tr' index="${process_id}">
                            <td colspan="3">Foil Stamp</td>
                            <td colspan="2" class="alRight"></td>
                            ${foilStampColumn}
                        </tr>`

                        tr += trBlock + trRoll + trStamp

                    }) //* END foilstamp แต่ละกรอบ

                })
                break
            case 'bossing':
                var proc_label = 'Block Deboss',
                    sub_proc_upper = 'Deboss',
                    compName = ''
                if (sub_proc == 'emboss') {
                    proc_label = "Block Emboss"
                    sub_proc_upper = "Emboss"
                }

                comp_arr.forEach((item, index) => {
                    const bossing = item?.addon?.filter(addon => addon.type == sub_proc)
                    //     item.addon.forEach((item1,) => {
                    //         if (item1.type == sub_proc) {
                    bossing?.forEach(addon => {

                        let blockTr = "",
                            bossingTr = ""

                        let blockColumn = '',
                            bossingColumn = ''

                        let block = []

                        //* BLOCK COST
                        addon.line?.block?.forEach((block, bIndex) => {
                            blockColumn = ''

                            blockTr += `
                                <tr class="${sub_proc}_tr">
                                    <td>${proc_label}</td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}RowComponentName">${item.component_name}</div></td>
                                    <td colspan="2" class="alCenter"><div class="${sub_proc}RowArea">Area (in²) : ${block.size[0]} x ${block.size[1]}</div></td>
                                    
                            `

                            block?.line?.forEach((line, lIndex) => {
                                blockColumn += `
                                    <td class="alRight">
                                        <div class="block${sub_proc_upper}RowUnitPrice" indexqty="${lIndex}">${numeral(line.unit_price).format('0,0.00')}</div>
                                    </td>
                                    <td class="alCenter">
                                        <div class="block${sub_proc_upper}RowQty" indexqty="${lIndex}">${numeral(line.qty).format('0,0')}</div>
                                    </td>
                                    <td class="alRight">
                                        <div class="block${sub_proc_upper}RowPrice" indexqty="${lIndex}">${numeral(line.price).format('0,0.00')}</div>
                                    </td>
                                `
                            })

                            blockTr += `
                                ${blockColumn}
                            </tr>
                            `
                        })

                        //*LABOR
                        bossingTr += `
                        <tr class="${sub_proc}_tr">
                            <td colspan="3">${sub_proc_upper}</td>
                            <td colspan="2" class="alCenter"></td>
                        `

                        addon.line?.labor?.forEach((price, pIndex) => {

                            bossingColumn += `
                                <td class="alRight">
                                    <div class="block${sub_proc_upper}RowUnitPrice" indexqty="${pIndex}">${numeral(price.unit_price).format('0,0.00000')}</div>
                                </td>
                                <td class="alCenter">
                                    <div class="block${sub_proc_upper}RowQty" indexqty="${pIndex}">${numeral(price.qty).format('0,0')}</div>
                                </td>
                                <td class="alRight">
                                    <div class="block${sub_proc_upper}RowPrice" indexqty="${pIndex}">${numeral(price.price).format('0,0.00')}</div>
                                </td>
                            `

                        })

                        bossingTr += `
                            ${bossingColumn}
                            </tr>
                        `

                        tr += blockTr
                        tr += bossingTr
                    })
                })
                break
            case 'diecut':
                var diecutColumn_arr = [],
                    blockColumn_arr = [],
                    diecutRow_arr = [],
                    blockRow_arr = [],
                    block_label = 'Block Diecut',
                    compName = 'All'

                if (mainData.job.is_reprinted) {
                    block_label = 'Block Diecut (Reprint)'
                }

                comp_arr.forEach((item) => {
                    const diecutArr = item.process?.filter(obj => obj.name == 'diecut') || []
                    diecutArr.forEach((item1, index1) => {
                        var diecutColumn = "",
                            blockColumn = ""

                        item1.line.forEach((item2, index2) => {
                            blockColumn += `<td class="alRight"><div class="blockDiecutRowUnitPrice" index="${index1}" indexqty="${index2}">${numeral(item2.block.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="blockDiecutRowQty" index="${index1}" indexqty="${index2}">${numeral(item2.block.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="blockDiecutRowPrice" index="${index1}" indexqty="${index2}">${numeral(item2.block.price).format('0,0.00')}</div></td>`
                            diecutColumn += `<td class="alRight"><div class="diecutRowUnitPrice" index="${index1}" indexqty="${index2}">${numeral(item2.labor.unit_price).format('0,0.00000')}</div></td>
                                        <td class="alCenter"><div class="diecutRowQty" index="${index1}" indexqty="${index2}">${numeral(item2.labor.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="diecutRowPrice" index="${index1}" indexqty="${index2}">${numeral(item2.labor.price).format('0,0.00')}</div></td>`
                        })

                        diecutColumn_arr.push(diecutColumn)
                        blockColumn_arr.push(blockColumn)

                        if (blockColumn_arr.length == 1) {
                            var blockRow = `
                                <tr index="${index1}" class="diecut_tr">
                                    <td colspan="3"rowspan="${comp_arr.length}">${block_label}</td>
                                    <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${compName}</div></td>`

                            var diecutRow = `
                                <tr>
                                    <td colspan="3" rowspan="${comp_arr.length}">Diecut</td>
                                    <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${compName}</div></td>`
                        } else {
                            var blockRow = `
                                <tr index="${index1}" class="diecut_tr">
                                    <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${compName}</div></td>`
                            var diecutRow = `
                                <tr>
                                    <td colspan="2" class="alCenter"><div class="diecutRowComponentName" index="${index1}">${compName}</div></td>`
                        }

                        diecutRow_arr.push(diecutRow)
                        blockRow_arr.push(blockRow)
                    })
                })

                if (blockColumn_arr.length != 0) {
                    blockColumn_arr.forEach((item, index) => {
                        tr += blockRow_arr[index] + item + `</tr>`
                    })
                }

                if (diecutColumn_arr.length != 0) {
                    diecutColumn_arr.forEach((item, index) => {
                        tr += diecutRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'main_process':
                var proc_label = ''

                switch (sub_proc) {
                    case 'chip':
                        proc_label = "แกะ"
                        break
                    case 'inspection':
                        proc_label = "Inspection"
                        break
                    case 'trim':
                        proc_label = "Trim"
                        break
                    case 'shrinkwrap':
                        proc_label = "Shrinkwrap"
                        break
                }

                mainData.process.forEach((item) => {
                    if (item.name == sub_proc) {
                        var columns = ""

                        item.line.forEach((item1, index1) => {
                            columns += `<td class="alRight"><div class="${sub_proc}RowUnitPrice" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="${sub_proc}RowQty" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="${sub_proc}RowPrice" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                        })

                        tr = `<tr class="${sub_proc}_tr">
                                <td colspan="5">${proc_label}</td>
                                ${columns}
                            </tr>`
                    }
                })
                break
            case 'corrugated_glued':
                var corrugatedGluedColumn_arr = [],
                    corrugatedGluedRow_arr = [],
                    compName = 'All'

                const num_trCorrugatedGlued = comp_arr?.reduce((total, item) => total += item.process.filter(obj => obj.name == 'corrugated_glued')?.length || 0, 0)

                comp_arr.forEach((item, index) => {
                    item.process.forEach((item1) => {
                        var corrugatedGluedColumn = ""
                        if (item1.name == 'corrugated_glued') {
                            item1.line.forEach((item2, index2) => {
                                corrugatedGluedColumn += `<td class="alRight"><div class="corrugatedGluedRowUnitprice" index="${index}" indexqty="${index2}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                        <td class="alCenter"><div class="corrugatedGluedRowQty" index="${index}" indexqty="${index2}">${numeral(item2.qty).format('0,0')}</div></td>
                                        <td class="alRight"><div class="corrugatedGluedRowprice" index="${index}" indexqty="${index2}">${numeral(item2.price).format('0,0.00')}</div></td>`
                            })
                            corrugatedGluedColumn_arr.push(corrugatedGluedColumn)
                            if (corrugatedGluedColumn_arr.length == 1) {
                                var corrugated_tr = `<tr class="corrugatedGlued_tr" index="${index}" >
                                    <td rowspan="${num_trCorrugatedGlued}" colspan="2">ทากาวประกบลูกฟูกกับกระดาษ</td>
                                    <td class="alCenter"><div class="corrugatedGluedRowComponentName" index="${index}">${compName}</div></td>
                                    <td colspan="2" class="alCenter"><div class="corrugatedRowGlued" index="${index}">${defaultData.corrugated_glued_cost} B/sqinch</div></td>`
                            } else {
                                var corrugated_tr = `<tr class="corrugatedGlued_tr" index="${index}">
                                    <td class="alCenter"><div class="corrugatedGluedRowComponentName" index="${index}">${compName}</div></td>
                                    <td colspan="2" class="alCenter"><div class="corrugatedGluedRowGlued" index="${index}">${defaultData.corrugated_glued_cost} B/sqinch</div></td>`
                            }
                            corrugatedGluedRow_arr.push(corrugated_tr)
                        }
                    })
                })

                if (corrugatedGluedColumn_arr.length != 0) {
                    corrugatedGluedColumn_arr.forEach((item, index) => {
                        tr += corrugatedGluedRow_arr[index] + item + `</tr>`
                    })
                }
                break
            case 'assembly':
                var assemblyColumn_arr = [],
                    assemblyRow_arr = [],
                    compName = 'All'
                const num_trAssembly = comp_arr?.reduce((total, item) => total += item.process.filter(obj => obj.name == 'assembly')?.length || 0, 0)

                comp_arr.forEach((item, index) => {
                    item.process.forEach((item1, index1) => {
                        if (item1.name == 'assembly') {
                            var assemblyColumn = ""
                            item1.line.forEach((item2) => {
                                assemblyColumn += `<td class="alRight"><div class="assemblyRowUnitPrice" index="${index}" indexqty="${index1}">${numeral(item2.unit_price).format('0,0.00')}</div></td>
                                            <td class="alCenter"><div class="assemblyRowQty" index="${index}" indexqty="${index1}">${numeral(item2.qty).format('0,0')}</div></td>
                                            <td class="alRight"><div class="assemblyRowPrice"  index="${index}"indexqty="${index1}">${numeral(item2.price).format('0,0.00')}</div></td>`
                            })
                            assemblyColumn_arr.push(assemblyColumn)

                            if (assemblyColumn_arr.length == 1) {
                                var assembly_tr = `<tr index="${index}" class="assembly_tr">
                                            <td rowspan="${num_trAssembly}" colspan="3">Assembly (ประกบ/ติดลิ้นกาว)</td>
                                            <td colspan="2" class="alCenter""><div class="assemblyRowComponentName">${compName} ติดกาว ${item.box_type.glued_spot} จุด</div></td>`
                            } else {
                                var assembly_tr = `<tr index="${index}" class="assembly_tr">
                                            <td colspan="2" class="alCenter""><div class="assemblyRowComponentName">${compName} ติดกาว ${item.box_type.glued_spot} จุด</div></td>`
                            }
                            assemblyRow_arr.push(assembly_tr)
                        }
                    })
                })

                if (assemblyColumn_arr.length != 0) {
                    assemblyColumn_arr.forEach((item, index) => {
                        tr += assemblyRow_arr[index] + item + `</tr>`
                    })
                }

                break
            case 'process':
                var tr = ""
                mainData.process.forEach((item, index) => {
                    if (sub_proc == 'other') {
                        var label = 'otherProcess'
                    } else if (sub_proc == 'handwork') {
                        var label = 'handworkProcess'
                    } else if (sub_proc == 'custom') {
                        var label = 'customProcess'
                    } else {
                        console.log('sub_proc not match // process')
                    }

                    if (item.type == sub_proc) {

                        item.line.forEach((item1, fIndex) => {
                            var process_column = ""

                            mainData.qty.totalqty.forEach((qty, qtyIndex) => {
                                process_column += `<td class="alRight"><div class="${label}UnitPrice" index="${index}" indexqty="${qtyIndex}">${numeral(item1.unit_price).format('0,0.0000')}</div></td>
                                                <td class="alCenter"><div class="${label}RowQty" index="${index}" indexqty="${qtyIndex}">${numeral(item1.qty).format('0,0')}</div></td>
                                                <td class="alRight"><div class="${label}RowPrice" index="${index}" indexqty="${qtyIndex}">${numeral(item1.price).format('0,0.00')}</div></td>`
                            })

                            tr += `<tr class="${label}_tr" index=${index}" fIndex=${fIndex}>
                                        <td colspan="5" >${item.name}</td>
                                        ${process_column}
                                    </tr>`

                        })


                        // var process_column = ""
                        // item.line.forEach((item1, index1) => {
                        //     process_column += `<td class="alRight"><div class="${label}UnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.0000')}</div></td>
                        //                         <td class="alCenter"><div class="${label}RowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0')}</div></td>
                        //                         <td class="alRight"><div class="${label}RowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>`
                        // })
                        // tr += `<tr class="${label}_tr" index=${index}">
                        //         <td colspan="5" >${item.name}</td>
                        //         ${process_column}
                        //     </tr>`
                    }
                })
                break
            //? update: 14.03.22
            case 'otherCost':
                mainData?.otherCost && mainData?.otherCost?.forEach((item, index) => {
                    item.line.forEach((item1, index1) => {
                        var otherCost_column = ""
                        mainData.qty.totalqty.forEach((qty, qtyIndex) => [
                            otherCost_column += `
                            <td class="alRight"><div class="otherCostUnitPrice" index="${index}" indexqty="${index1}">${numeral(item1.unit_price).format('0,0.00')}</div></td>
                            <td class="alCenter"><div class="otherCostRowQty" index="${index}" indexqty="${index1}">${numeral(item1.qty).format('0,0.00')}</div></td>
                            <td class="alRight"><div class="otherCostRowPrice" index="${index}" indexqty="${index1}">${numeral(item1.price).format('0,0.00')}</div></td>
                        `
                        ])
                        tr += `
                        <tr class="material_tr" index=${index}">
                            <td colspan="5" >${item.name}</td>
                            ${otherCost_column}
                        </tr>
                        `
                    })
                })
                break

        }
        return tr
    }

    getTRTotal(data = {}, tb_total_row) {
        const mainData = data
        var totalColumn = "", remark = '',
            tr = "", total_label, total_price, align_class1, align_class2, align_class3

        mainData.totalprice.forEach((item, index) => {
            switch (tb_total_row) {
                case 'Material':
                    total_price = item.material
                    total_label = 'Total (Material)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'Print':
                    total_price = item.print
                    total_label = 'Total (Print)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'Plate':
                    total_price = item.plate
                    total_label = 'Total (Plate)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'Proof':
                    total_price = item?.proof || 0
                    total_label = 'Total (Proof)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'Process':
                    total_price = item.afterpress
                    total_label = 'Total (Process)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'Packing':
                    total_price = item.delivery
                    total_label = 'Total (Packing)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
                case 'MarkUp':
                    total_price = item?.mark_up_price || 0
                    total_label = 'Mark up'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = "alCenter"
                    break
                case 'MarkDown':
                    total_price = item?.mark_down_price || 0
                    total_label = 'Mark down'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = "alCenter"
                    break

                case 'Price':
                    total_price = item.total_price
                    total_label = 'Subtotal Price'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'DiffPrice':
                    total_price = item?.total_with_price_diff
                    remark = ``
                    total_label = 'Subtotal Price + ค่าของขวัญลูกค้า + ส่วนต่างลูกค้า'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'CustomerPriceDiff':
                    total_price = item?.price_diff
                    remark = `<input type="text" readonly value='${mainData?.priceDiff?.length ? mainData?.priceDiff[index] : ''}' class='readonly text-center' style='width:65px;'>`
                    total_label = 'ส่วนต่างลูกค้า'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'Gift':
                    total_price = item?.customer_gift
                    remark = `<input type="text" readonly value='${mainData?.customer_gift?.length ? mainData?.customer_gift[index] : ''}' class='readonly text-center' style='width:65px;'>`
                    total_label = 'ค่าของขวัญลูกค้า'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'Tax':
                    total_price = item.tax
                    total_label = 'Tax ' + mainData.tax + ' %'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'FinalPrice':
                    total_price = item.final_price
                    total_label = 'Total Price'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'ProfitSharing':
                    total_price = item?.profit_sharing || 0
                    total_label = 'Profit Sharing'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    break
                case 'UnitPrice':
                    total_price = item.unit_price
                    total_label = 'Unit Price/cps'
                    align_class1 = "alCenter"
                    align_class2 = "alCenter"
                    align_class3 = ""
                    break
                case 'Other':
                    total_price = item.other
                    total_label = 'Total (Other)'
                    align_class1 = "alRight"
                    align_class2 = "alLeft"
                    align_class3 = ""
                    break
            }
            if (['MarkUp', 'MarkDown'].includes(tb_total_row)) {
                const markingPercent = tb_total_row === 'MarkDown'
                    ? item['mark_down_percent'] || Math.abs(item['marking_percent']) || 0
                    : item['mark_up_percent'] || 0
                totalColumn += `
                    <td colspan="2" class="${align_class3}">
                        <div class="${tb_total_row}" index="${index}"> 
                            <input style="width:40px;text-align:center" value="${markingPercent}"> %
                        </div>
                    </td>
                    <td class="${align_class1}">
                        <div class="total${tb_total_row}" indexqty="${index}">${numeral(total_price).format('0,0.00')}</div>
                    </td>
                `
            } else {
                totalColumn += `
                    <td colspan="2" class="${align_class1}">${remark}</td>
                    <td class="${align_class1}">
                        <div class="total${tb_total_row}" indexqty="${index}">${numeral(total_price).format('0,0.00')}</div>
                    </td>
                `
            }

        })

        if (tb_total_row == 'Tax') {
            tr = `<tr class="totalRow total${tb_total_row}_tr">
                <td colspan="5" class="${align_class2}"><div id="tax">Tax <input style="width:40px;text-align:center" value="${mainData.tax}"> %</div></td>
                ${totalColumn}
            </tr>`
        } else {
            tr = `<tr class="totalRow total${tb_total_row}_tr">
                <td colspan="5" class="${align_class2}">${total_label}</td>
                ${totalColumn}
            </tr>`
        }
        return tr
    }


    getTRWeight(data = {}, is_forDisplay = false) {
        const {
            job: {
                is_different_packing: isDiffPacking = false,
                is_multiple_f: isMultipleF = false
            },
            component1: comp_arr
        } = data || {}

        var weightRow = ''

        comp_arr.forEach((comp, index) => {
            let summaryLength = isMultipleF && isDiffPacking ? comp?.f_detail?.f_list?.length : 1
            let compName = comp.component_name

            for (let fIndex = 0; fIndex < summaryLength; fIndex++) {
                let bulk, bulk_name, bulk_unit,
                    kraftwrap_item, carton_item, pallet_item

                const pallet = est.getPackingObj(comp, 'pallet', fIndex)
                const unit = getUnitPacking(index, is_forDisplay, fIndex)
                const deliveryInfo = comp?.delivery[fIndex]
                let pallet_size = layer = qty_layer = '-'

                if (isMultipleF) {
                    compName = summaryLength == 1 ? 'All' : comp?.f_detail?.f_list[fIndex]?.f_code || 'Error'
                }

                if (pallet != null) {
                    pallet_size = pallet.info.pallet_size[0] + '" x ' + pallet.info.pallet_size[1] + '" x ' + pallet.info.pallet_size[2] + '"'
                    layer = pallet.info.layer_per_pallet
                    qty_layer = pallet.info.laying.qty_layer
                }

                comp.packing[fIndex].forEach((packing) => {
                    if (packing.name == 'kraftwrap') {
                        kraftwrap_item = packing
                    }
                    if (packing.name == 'carton') {
                        carton_item = packing
                    }
                    if (packing.name == 'pallet') {
                        pallet_item = packing
                    }
                })

                switch (unit) {
                    case 'piece':
                        bulk_name = 'Pallet size'
                        bulk = [pallet_item.info.laying.cube_size[0], pallet_item.info.laying.cube_size[1], pallet_item.info.pallet_height]
                        bulk_unit = 'pcs'
                        break
                    case 'kraftwrap':
                        bulk_name = 'Kraftwrap size'
                        bulk = kraftwrap_item.info.inner_size
                        bulk_unit = 'kraftwrap'
                        break
                    case 'carton':
                        bulk_name = 'Carton size'
                        bulk = carton_item.info.size.inner_size
                        bulk_unit = 'carton'
                        break
                }

                weightRow += `
                    <tr class="weight_tr alCenter">
                        <td rowspan="4">${compName}</td>
                        <td>Weight</td>
                        <td>${comp.weight.weight}</td>
                        <td>kg/1 cp.</td>
                        <td style="text-align:center">${bulk_name}</td>
                        <td>กว้าง</td>
                        <td>ยาว</td>
                        <td>สูง</td>
                    </tr>
                    <tr class="weight_tr alCenter">
                        <td>Thickness</td>
                        <td>${comp.thickness.inch.packing_thickness}</td>
                        <td>inch</td>
                        <td style="text-align:center">Inner size (inch)</td>
                        <td>${numeral(bulk[0]).format('0,0.00')}</td>
                        <td>${numeral(bulk[1]).format('0,0.00')}</td>
                        <td>${numeral(bulk[2]).format('0,0.00')}</td>
                    </tr>
                    <tr class="weight_tr alCenter">
                        <td>Pallet size</td>
                        <td colspan="4">${pallet_size}</td>
                        <td>Net weight</td>
                        <td><div>${numeral(deliveryInfo.net_weight).format('0,0.00')}</div></td>
                        <td>kg/pack</td>
                    </tr>
                    <tr class="weight_tr alCenter">
                        <td>วางสูง</td>
                        <td>${layer}</td>
                        <td>ชั้นๆ ละ</td>
                        <td>${qty_layer}</td>
                        <td>${bulk_unit}</td>
                        <td>Gross weight</td>
                        <td>${numeral(deliveryInfo.gross_weight).format('0,0.00')}</td>
                        <td>kg/pack</td>
                    </tr>
                `
            }
        })

        return weightRow
    }

}

var sum = new Summary