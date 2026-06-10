$(document).ready(function () {
    $('#print_form').on('click', ('input[type=checkbox]'), function (event) {
        event.preventDefault();
    })

    $('#print_form').on('click', ('.print_spec'), function () {
        window.print()
    })
    $('#print_form').on('click', ('.print_summary'), function () {
        const is_download = false
        printPdf(dat.data_rfq_log?.job_data, is_download);
    })

    window.addEventListener("afterprint", (event) => {
        console.log("After print");
    });
})


class PrintForm {

    getDataRFQ(rfq_id, type) {
        let api_url = 'http://192.168.5.25/estimate_packaging'

        if (rfq_id != "") {
            return new Promise((resolve) => {
                const job_log = $.ajax({
                    url: api_url + '/controllers/estimate.php',
                    type: 'POST',
                    data: { post_type: 'getDataRFQ', rfq_id, type },
                    dataType: 'json',
                    cache: false,
                    beforeSend: function () { },
                    success: function (data) {
                        document.title = rfq_id
                        console.log("getData", JSON.parse(data.job_data))
                    },
                    error: function () {
                        console.log('get RFQ_log ERROR')
                    }
                })
                resolve(job_log)
            })
        }
    }


    renderPrintForm(job_data = {}) {
        console.log("----- START Render ------", job_data)
        const {
            created: create_date
        } = dat?.data_rfq_log || {}
        const {
            ae: {
                ae_id,
                ae_name
            },
            customer: {
                customer_id,
                customer_name
            },
            estimator: {
                estimator_id,
                estimator_name
            },
            job: {
                job_name,
                is_multiple_f,
                print_type,
                ink_type,
                is_reprinted,
                color_limit,
                is_profit_sharing,
                is_different_packing,
                is_loss
            },
            component1 = []
        } = job_data
        const {
            status_id = 0
        } = dat?.data_rfq_log || {}

        const approve_status = status_id == 0 ? '-' : status_id == 1 ? 'Pending' : status_id == 2 ? 'Reject' : status_id == 3 ? 'Approve' : '-'

        const job_id = dat.data_rfq_log.job_id

        const is_color_limit = color_limit?.some(obj => obj?.is_color_limit || false) || false

        console.log("print job_id", job_id)
        $('span.job_id').html(job_id || '-')
        $('.job_name').html(job_name || '-')
        $('.ae_name').html(ae_id + ' : ' + ae_name || '-')
        $('.customer_name').html(customer_id + ' : ' + customer_name || '-')
        $('.estimator_name').html(estimator_id + ' : ' + estimator_name || '-')
        $('.approve_status').html(approve_status || '-')
        $('.create_date').html(create_date || '-')
        $('#is_multi_edition').prop('checked', is_multiple_f)
        // ! Section 2 - Qty.

        if (is_multiple_f) {
            this.displayQty(is_multiple_f, component1, color_limit)
            $('.div_color_limit').hide()
        } else {
            this.displayQty(is_multiple_f, job_data, color_limit)
            $('.div_color_limit').show()
        }

        // ! Section 3 - Job Type
        $('.job_type').html(is_reprinted ? 'Reprint' : 'งานใหม่')
        $('.ink_type').html(ink_type == 'UV' ? 'UV' : 'ธรรมดา')
        $('#section_3 .chk_color_limit').prop('checked', is_color_limit || false)
        $('#section_3 .color_limit').html(color_limit[0]?.qty || '-')
        $('.chk_profit_sharing').prop('checked', is_profit_sharing || false)
        $('.print_type').html(print_type || '-')

        this.setJobProfitSharing(is_profit_sharing)

        let
            tr_paper = 0,
            tr_corrugated = 0,
            tr_color = 0,
            tr_coating = 0,
            tr_foilstamp = 0,
            tr_emboss = 0,
            tr_deboss = 0,
            tr_other_process = 0,
            tr_handwork_process = 0,
            tr_outsource = 0,
            tr_material = 0,
            tr_other = 0,
            tr_file = 0,
            tr_delivery = 0,
            tr_sizeLayout = 0

        component1?.forEach((obj, cIndex) => {
            this.displayComponent(cIndex, obj)
            tr_paper += this.displayPaper(tr_paper, obj) ? 1 : 0
            tr_corrugated += this.displayCorrugated(tr_corrugated, obj) ? 1 : 0
            tr_color += this.displayColor(tr_color, obj, is_multiple_f) ?? 0
            tr_coating += this.displayCoating(tr_coating, obj) ?? 0
            tr_emboss += this.displayBossing(tr_emboss, 'emboss', obj, is_multiple_f) ?? 0
            tr_deboss += this.displayBossing(tr_deboss, 'deboss', obj, is_multiple_f) ?? 0
            tr_foilstamp += this.displayFoilstamp(tr_foilstamp, obj, is_multiple_f) ?? 0
        })

        tr_other_process += this.displayProcessDynamicPrice(tr_other_process, 'other', job_data) ?? 0
        tr_handwork_process += this.displayProcessDynamicPrice(tr_handwork_process, 'handwork', job_data) ?? 0
        tr_outsource += this.displayProcessDynamicPrice(tr_outsource, 'custom', job_data) ?? 0
        tr_material += this.displayProcessDynamicQty(tr_material, 'material', job_data) ?? 0
        tr_other += this.displayProcessDynamicQty(tr_other, 'otherCost', job_data) ?? 0
        tr_delivery += this.displayDelivery(tr_delivery, job_data, is_multiple_f) ?? 0
        this.displayFile(job_data)
        this.displayCustomerCost('priceDiff', job_data)
        this.displayCustomerCost('customer_gift', job_data)
        this.setDivPacking(is_different_packing)
        this.displayPacking(job_data)
        sum.summary(job_data, true)
        setProfitAndLossQty(is_loss)


        if (tr_paper == 0) {
            $('#section_paper table').hide()
        }
        if (tr_corrugated == 0) {
            $('#section_corrugated table').hide()
        }
        if (tr_color == 0) {
            $('#section_color table').hide()
        }
        if (tr_coating == 0) {
            $('#section_coating table').hide()
        }
        if (tr_emboss == 0) {
            $('#section_emboss table').hide()
        }
        if (tr_deboss == 0) {
            $('#section_deboss table').hide()
        }
        if (tr_foilstamp == 0) {
            $('#section_foilstamp table').hide()
        }

        if (tr_other_process == 0) {
            $('#section_other_process table').hide()
        }
        if (tr_handwork_process == 0) {
            $('#section_handwork_process table').hide()
        }
        if (tr_outsource == 0) {
            $('#section_custom_process table').hide()
        }
        if (tr_material == 0) {
            $('#section_material_process table').hide()
        }
        if (tr_other == 0) {
            $('#section_otherCost_process table').hide()
        }

        $('#print_form input, #print_form textarea').prop('readonly', true)
        $('#print_form select').prop('disabled', true)

        $('#section_button button').show()
    }

    displayComponent(index, obj) {
        const table = $('#section_component table tbody')

        const {
            component_name = '',
            box_type: {
                type_name = ''
            },
            component_type: {
                detail_th = ''
            }
        } = obj || {}

        if (index > 0) {
            const new_tr = $('#section_component table tbody tr:first').clone()
            table.append(new_tr)
        }

        const tr = $('#section_component table tbody tr:last')
        tr.find('span').html('-')

        tr.find('span.component_no').html(index + 1)
        tr.find('span.component_name').html(component_name)
        tr.find('span.component_type').html(detail_th)
        tr.find('span.box_type').html(type_name)
    }

    displayPaper(index, obj) {
        const table = $('#section_paper table tbody')
        const trLength = table.find('tr').length

        if (obj.component_type.type == 3) {
            return 0
        }

        const {
            component_name = '',
            paper: {
                paper_name = '',
                paper_gram = '',
                paper_markup = '',
                paper_percent = '',
                paper_cost = '',
                paper_total_price = '',
                sheet_unit_price = false,
                remark = ''
            }
        } = obj || {}
        console.log(index, component_name)


        const unit = sheet_unit_price ? 'B/Sheet' : 'B/Kg'

        if (index > 0) {
            const new_tr = $('#section_paper table tbody tr:first').clone()
            table.append(new_tr)
            console.log("append")
        }

        const tr = $('#section_paper table tbody tr:last')
        tr.find('span').html('-')

        tr.find('span.component_name').html(component_name)
        tr.find('span.paper_name').html(paper_name)
        tr.find('span.paper_gram').html(paper_gram)
        tr.find('span.paper_markup').html(paper_markup)
        tr.find('span.roll_cut').html(paper_percent)
        tr.find('span.paper_cost').html(paper_cost)
        tr.find('span.paper_total_price').html(paper_total_price)
        tr.find('span.unit').html(unit)
        tr.find('span.remark').html(remark)
        console.log("paper")
        return 1
    }

    displayCorrugated(index, obj) {
        const table = $('#section_corrugated table tbody')
        if (obj.component_type.type == 1) {
            return 0
        }

        const {
            component_name = '',
            corrugated_layer: {
                info: {
                    num_layer = '',
                    flute_type = '',
                    name = '',
                    remark = ''
                }
            }
        } = obj || {}

        const grade = name?.split('/')
        const grade_arr = []
        grade.forEach((item1) => {
            if (item1.search('SCG') > -1) {
                grade_arr.push((item1.substring(0, 6)), item1.substring(6, 9))
            } else if (item1.search('ยูไนเต็ด') > -1) {
                grade_arr.push((item1.substring(0, 11)), item1.substring(11, 14))
            } else {
                if (item1.length == 5) {
                    grade_arr.push((item1.substring(0, 2)), item1.substring(2, 5))
                } else {
                    grade_arr.push((item1.substring(0, 3)), item1.substring(3, 6))
                }
            }
        })

        if (index > 0) {
            const new_tr = $('#section_corrugated table tbody tr:first').clone()
            table.append(new_tr)
        }

        const tr = $('#section_corrugated table tbody tr:last')
        tr.find('span').html('-')

        tr.find('span.component_name').html(component_name)
        tr.find('span.corrugated_layer').html(num_layer)
        tr.find('span.corrugated_type').html(flute_type)

        tr.find('span.corrugated_grade1').html(grade_arr[0])
        tr.find('span.corrugated_gram1').html(grade_arr[1])

        tr.find('span.corrugated_grade2').html(grade_arr[2])
        tr.find('span.corrugated_gram2').html(grade_arr[3])

        tr.find('span.corrugated_grade3').html(grade_arr[4])
        tr.find('span.corrugated_gram3').html(grade_arr[5])

        tr.find('span.remark').html(remark)

        return 1
    }

    displayColor(index, obj, is_multi_version = false) {
        let count_tr = index
        const table = $('#section_color table tbody')

        const {
            component_name = '',
            color = []
        } = obj || {}

        if (is_multi_version) {
            table.find('.column_name').html('F Code')
        }

        color?.forEach((col, cIndex) => {
            const {
                outside = 0,
                inside = 0,
                f_code = '',
                special_ink = []
            } = col || {}

            const is_speInk = special_ink?.length > 0 ? true : false

            if (count_tr > 0) {
                const new_tr = $('#section_color table tbody tr:first').clone()
                table.append(new_tr)
            }

            const tr = $('#section_color table tbody tr:last')
            tr.find('span').html('-')
            tr.find('input[type=checkbox]').prop('checked', false)

            tr.find('span.component_name').html(f_code || component_name)
            tr.find('span.out_col').html(outside)
            tr.find('span.in_col').html(inside)
            tr.find('.is_spe_ink').prop('checked', is_speInk)
            count_tr += 1

            special_ink?.forEach((speInk, sIndex) => {
                if (sIndex > 0) {
                    const new_tr2 = $('#section_color table tbody tr:first').clone()
                    new_tr2.find('span').html('')
                    new_tr2.find('input[type=checkbox]').remove()
                    table.append(new_tr2)
                    count_tr += 1
                }

                const speInk_tr = $('#section_color table tbody tr:last')
                const print_style_th = speInk.info.print_style == 'solid' ? 'ตีพื้น' : 'ลายเส้น'
                speInk_tr.find('span.spe_ink_name').html(speInk.info.ink_name)
                speInk_tr.find('span.spe_ink_type').html(speInk.name)
                speInk_tr.find('span.spe_ink_style').html(print_style_th)
            })


        })

        return count_tr
    }

    displayProcessDynamicPrice(index, process_name = '', obj) {
        let count_tr = index
        const table = $(`#section_${process_name}_process table tbody`)

        const {
            process = []
        } = obj || {}

        const procesArray = process?.filter(obj => obj.type == process_name)

        const num_td = procesArray?.reduce((max, obj) => (obj?.info?.unit_price?.length > max) ? obj?.info?.unit_price?.length : max, 0)
        console.log("max td", num_td)

        for (let i = 0; i < num_td; i++) {
            if (i > 0) {
                const new_th = $(`#section_${process_name}_process table`).find('.th_process_ppu:first').clone()
                const new_td = $(`#section_${process_name}_process table`).find('.td_process_ppu:first').clone()
                $(`#section_${process_name}_process table`).find('thead tr:first').append(new_th)
                $(`#section_${process_name}_process table`).find('tbody tr:first').append(new_td)
            }
        }

        procesArray?.forEach((info, cIndex) => {
            const {
                name = '',
                info: {
                    is_fixedPrice = false,
                    unit_price
                }
            } = info || {}

            if (count_tr > 0) {
                const new_tr = $(`#section_${process_name}_process table tbody tr:first`).clone()
                new_tr.find('span').html('-')
                table.append(new_tr)
            }

            const tr = $(`#section_${process_name}_process table tbody tr:last`)

            tr.find('span').html('-')
            tr.find('span.process_name').html(name)
            tr.find('input[type=checkbox]').prop('checked', is_fixedPrice)

            if (is_fixedPrice) {
                tr.find(`.td_process_ppu:eq(0) .ppu`).html(unit_price)
            } else {
                unit_price?.forEach((ppu, pIndex) => {
                    tr.find(`.td_process_ppu:eq(${pIndex}) .ppu`).html(ppu)
                })
            }

            count_tr += 1
        })

        return count_tr
    }

    displayProcessDynamicQty(index, process_name = '', obj) {
        let count_tr = index
        const table = $(`#section_${process_name}_process table tbody`)

        const qty_key = process_name == 'material' ? 'qty_material' : 'qty_other'

        const {
            [process_name]: process = []
        } = obj || {}


        const num_td = process?.reduce((max, obj) => (obj.info[qty_key]?.length > max) ? obj.info[qty_key]?.length : max, 0)
        console.log("max td", num_td)

        for (let i = 0; i < num_td; i++) {
            if (i > 0) {
                const new_th = $(`#section_${process_name}_process table`).find('.th_process_qty:first').clone()
                const new_td = $(`#section_${process_name}_process table`).find('.td_process_qty:first').clone()
                $(`#section_${process_name}_process table`).find('thead tr:first').append(new_th)
                $(`#section_${process_name}_process table`).find('tbody tr:first').append(new_td)
            }
        }

        process?.forEach((info, cIndex) => {
            const {
                name = '',
                info: {
                    is_fixedPrice = false,
                    [qty_key]: qty,
                    unit_price = 0
                }
            } = info || {}

            if (count_tr > 0) {
                const new_tr = $(`#section_${process_name}_process table tbody tr:first`).clone()
                new_tr.find('span').html('-')
                table.append(new_tr)
            }

            const tr = $(`#section_${process_name}_process table tbody tr:last`)

            tr.find('span').html('-')
            tr.find('span.name').html(name)
            tr.find('span.ppu').html(unit_price)
            tr.find('input[type=checkbox]').prop('checked', is_fixedPrice)

            if (is_fixedPrice) {
                tr.find(`.td_process_qty:eq(0) .qty`).html(qty)
            } else {
                qty?.forEach((ppu, pIndex) => {
                    tr.find(`.td_process_qty:eq(${pIndex}) .qty`).html(ppu)
                })
            }

            count_tr += 1
        })

        return count_tr
    }

    displayCoating(index, obj) {
        let count_tr = index

        const table = $('#section_coating table tbody')

        const {
            component_name = '',
            addon = []
        } = obj || {}

        const coating = addon?.filter(obj => ['coating'].includes(obj.type))

        coating?.forEach((info, aIndex) => {
            const {
                info: {
                    name = '',
                    type = '',
                    side = '',
                    width = '',
                    length = '',
                    code = ''
                }
            } = info || {}

            if (count_tr > 0) {
                const new_tr = $('#section_coating table tbody tr:first').clone()
                table.append(new_tr)
            }

            const tr = $('#section_coating table tbody tr:last')
            tr.find('span').html('-')

            tr.find('span.component_name').html(component_name)
            tr.find('span.type1').html(name)
            tr.find('span.type2').html(`${type} ${side} s`)

            if (['S-UV', 'S-UV-S'].includes(code)) {
                // if (code == 'S-UV') {
                tr.find('span.width').html(width)
                tr.find('span.length').html(length)
            }

            count_tr += 1

        })

        return count_tr
    }

    displayFoilstamp(index, obj, is_multi_version = false) {
        let count_tr = index
        const table = $(`#section_foilstamp table tbody`)

        const {
            component_name = '',
            addon = []
        } = obj || {}

        if (is_multi_version) {
            $('#section_foilstamp .column_name').html('F Code')
        }

        const foilstamp = addon?.filter(obj => ['foilstamp'].includes(obj.type))

        foilstamp?.forEach((info, aIndex) => {

            const {
                info: {
                    color_th = '',
                    code = '',
                    size = [],
                    f_code = []
                }
            } = info || {}

            if (count_tr > 0) {
                const new_tr = $(`#section_foilstamp table tbody tr:first`).clone()
                table.append(new_tr)
            }

            const tr = $(`#section_foilstamp table tbody tr:last`)
            tr.find('span').html('-')

            tr.find('span.component_name').html(f_code.join(', ') || component_name)
            tr.find('span.color_th').html(color_th)
            tr.find('span.code').html(code)
            tr.find('span.width').html(size[0])
            tr.find('span.length').html(size[1])

            count_tr += 1
        })

        return count_tr
    }

    displayBossing(index, bossing_type, obj, is_multi_version = false) {
        let count_tr = index
        const table = $(`#section_${bossing_type} table tbody`)

        const {
            component_name = '',
            addon = []
        } = obj || {}

        if (is_multi_version) {
            table.find('.column_name').html('F Code')
        }

        const bossing = addon?.filter(obj => [bossing_type].includes(obj.type))

        bossing?.forEach((info, aIndex) => {

            const {
                info: {
                    depth = '',
                    size = [],
                    f_code = []
                }
            } = info || {}

            if (count_tr > 0) {
                const new_tr = $(`#section_${bossing_type} table tbody tr:first`).clone()
                table.append(new_tr)
            }

            const tr = $(`#section_${bossing_type} table tbody tr:last`)
            tr.find('span').html('-')

            tr.find('span.component_name').html(f_code.join(', ') || component_name)
            tr.find('span.depth').html(depth)

            count_tr += 1

            size.forEach((size, sIndex) => {
                if (sIndex > 0) {
                    const new_tr2 = $(`#section_${bossing_type} table tbody tr:first`).clone()
                    new_tr2.find('span').html('')
                    table.append(new_tr2)

                    count_tr += 1
                }

                const size_tr = $(`#section_${bossing_type} table tbody tr:last`)
                size_tr.find('span.width').html(size[0])
                size_tr.find('span.length').html(size[1])
                size_tr.find('span.component_name').html(component_name)
                size_tr.find('span.depth').html(depth)

            })

        })

        return count_tr
    }

    displayFile(obj) {
        let count_tr = index
        const table = $(`#section_file .td_file`)

        let file_tr = ''

        obj?.fileUpload?.forEach((file, index) => {
            const { filePath, id, originFileName } = file
            const linkFilePath = api_url + '/' + filePath
            const fileDisplay = `<a href='${linkFilePath}' target='_blank' file-id='${id}' class="file_path">${originFileName}</a>`

            file_tr += `<div class="file">
                <span>${fileDisplay}</span>
            </div>`
        })

        table.append(file_tr)

        return count_tr
    }

    displayDelivery(index, obj, is_multi_version = false) {
        let count_tr = index
        const table = $(`#section_delivery table tbody`)

        const {
            delivery = []
        } = obj || {}

        const is_split = delivery?.length > 1 ? true : false

        delivery?.forEach((info, aIndex) => {

            const {
                destinationName = '',
                dueDate = '',
                detail = []
            } = info || {}

            // const qty = detail?.reduce((total, obj) => total += obj.qty, 0)

            // let f_code = []

            // detail?.forEach(obj => {
            //     if (obj?.f_code != '') {
            //         f_code.push(obj?.f_code)
            //     }
            // })

            // f_code = f_code.join(', ')

            detail?.forEach((obj, dIndex) => {
                const {
                    f_code = '',
                    qty = 0
                } = obj || {}

                const delivery_date = dueDate ? moment(dueDate, 'YYYY-MM-DD').add(543, 'year').format('DD/MM/YYYY') : '-'

                if (count_tr > 0) {
                    const new_tr = $(`#section_delivery table tbody tr:first`).clone()

                    if (is_split) {
                        new_tr.find('.is_split_delivery').remove()
                    }

                    table.append(new_tr)
                    count_tr += 1
                }

                const tr = $(`#section_delivery table tbody tr:last`)
                tr.find('span').html('')

                if (dIndex == 0) {
                    tr.find('.is_split_delivery').prop('checked', is_split)

                    tr.find('span.destinationName').html(destinationName)
                    tr.find('span.dueDate').html(delivery_date)
                }
                tr.find('span.f_code').html(f_code || '-')
                tr.find('span.qty').html(numeral(qty).format('0,000'))

                count_tr += 1
            })
        })


        if (!is_multi_version) {
            $('#section_delivery .col-f-code').hide()
        }

        return count_tr
    }

    displayCustomerCost(process_key = '', obj) {
        const table = $(`#section_${process_key} table`)

        const {
            [process_key]: process = []
        } = obj || {}

        const is_checked = process?.length >= 1 ? true : false

        table.find('input[type=checkbox]').prop('checked', is_checked)

        process?.forEach((price, pIndex) => {
            if (pIndex > 0) {
                const new_td = table.find('.td_price:first').clone()
                table.find('tr:first').append(new_td)
            }

            table.find('.td_price:last input').val(price || '')
        })
    }

    displayComponentSizeLaying2(index, obj, objEle = {}) {
        console.log("display laying", index)
        const table = $('#section_component_laying > tbody')
        const {
            component_name = '',
            box_type: {
                type_id = 0
            },
            layout_manual = false
        } = obj || {}

        if (index > 0) {
            const new_tr = table.find('.tr_size_component:first').clone()
            new_tr.find('.component_no , .component_name').html('-')
            new_tr.find('img').remove()
            table.append(new_tr)
        }

        const tr = table.find('.tr_size_component:last')

        tr.find('.component_no').html(index + 1)
        tr.find('.component_name').html(component_name)

        tr.find('.size_img .template_img').html(objEle.template)
        tr.find('.size_img .spec').html(objEle.spec)
        tr.find('.size_img .size').html(objEle.size)

        tr.find('.layout_img .size_layout').html(objEle.size_layout)
        tr.find('.layout_img .layout').html(objEle.layout)
        tr.find('.layout_img .num_laying').html(objEle.num_laying)
        if (!layout_manual) {
            tr.find('.layout_img .tolerance').html(objEle.tolerance)
        }
        const paper_usage = $(objEle.paper_usage)
        paper_usage.attr('cellspacing', '0').removeAttr('border')
        tr.find('.layout_img .paper_usage').html(objEle.paper_usage)

        // tr.find('.component_name').html(component_name)

        // tr.find('.size_img .template_img').html(imgArr[0])
        // tr.find('.size_img .spec').html(imgArr[1])
        // tr.find('.size_img .size').html(imgArr[2])

        // tr.find('.layout_img .size_layout').html(imgArr[3])
        // tr.find('.layout_img .layout').html(imgArr[4])
        // tr.find('.layout_img .num_laying').html(imgArr[5])
        // tr.find('.layout_img .tolerance').html(imgArr[6])
        // tr.find('.layout_img .paper_usage').html(imgArr[7])

        tr.find('.layout_img .is_manual_layout').prop('checked', layout_manual)

        table.find('input, select').prop('disabled', true)

        return 1
    }

    displayComponentPacking(index, fIndex = 0, obj, img) {
        console.log("display Packing", index, fIndex, img)
        const section = $('#section_packing > tbody')
        const {
            component_name = '',
            f_detail: {
                f_list = []
            }
        } = obj || {}
        let f_code = ''

        const is_multi_edition = f_list?.length > 0 ? true : false

        if (is_multi_edition) {
            f_code = f_list[fIndex]?.f_code
            section.find('.f_code_header').show()
        } else {
            section.find('.f_code_header').hide()
        }

        if (index > 0) {
            const new_tb = section.find('.component_packing:first').clone()
            new_tb.find('.packing_img').empty()
            section.find('.td_packing').append(new_tb)
        }

        const tb = section.find('.component_packing:last')

        if (fIndex > 0) {
            let fRow = `
                <tr>
                    <td colspan="7" class="f_code_header w-100 center vcenter bg-head d-none">
                        <strong><span class="f_code">${f_code}</span></strong>
                    </td>
                </tr>
                <tr>
                    <td colspan="7" class="w-100 packing_img center vcenter">
                        ${img}
                    </td>
                </tr>
            `
            tb.find('tbody').append(fRow)
        } else {
            tb.find('.packing_img').append(img)
        }

        tb.find('.f_code').html(f_code)
        tb.find('.component_no').html(index + 1)
        tb.find('.component_name').html(component_name)
        return 1
    }

    displayQty(is_multi_edition = false, data, color_limit) {

        console.log("color_limit", color_limit)
        if (is_multi_edition) {
            const tb = $('#tb_qty_f tbody')
            $('#tb_qty_normal').hide()
            $('#tb_qty_f').show()

            data?.forEach((obj, index) => {
                obj.f_detail?.f_list?.forEach((fQty, fIndex) => {
                    if (fIndex > 0) {
                        const new_tr = tb.find('tr:first').clone()
                        new_tr.find('span').html('')
                        new_tr.find('input[type=checkbox]').prop('checked', false)
                        tb.append(new_tr)
                    }

                    const tr = tb.find('tr:last')
                    const { is_color_limit = false, qty = 0 } = color_limit[fIndex]
                    console.log(is_color_limit, qty, tr.find('.chk_color_limit'))

                    tr.find('.f_code').html(fQty?.f_code || '-')
                    tr.find('.qty').html(numeral(fQty?.f_qty).format('0,000') || '-')
                    tr.find('.runon_percent').html(fQty?.runon_percent || '-')
                    tr.find('.runon_qty').html(fQty?.runon_qty || '-')
                    tr.find('.ae_qty').html(fQty?.ae_qty || '-')
                    tr.find('.customer_qty').html(fQty?.customer_qty || '-')
                    tr.find('.total_qty').html(fQty?.total_qty || '-')

                    tr.find('.chk_color_limit').prop('checked', is_color_limit)
                    tr.find('.color_limit').html(qty || '-')
                })

                $('#tb_qty_f .total_net_qty').html(numeral(obj.f_detail?.f_total_qty).format('0,000') || '-')
            })
        } else {
            const tb = $('#tb_qty_normal tbody')
            $('#tb_qty_normal').show()
            $('#tb_qty_f').hide()

            const {
                qty: {
                    ae = 0,
                    customer = 0,
                    main = [],
                    runon = [],
                    runon_percent = ''
                }
            } = data || {}
            console.log("data qty", data)
            const td_qty = $('.td_qty')
            const td_runon = $('.td_runon')

            console.log(main, runon)
            main?.forEach((qty, index) => {
                if (index > 0) {
                    const new_input = td_qty.find('.input_qty:first').clone()
                    new_input.val('')
                    td_qty.append(new_input)
                }

                let last_qty = $('.input_qty:last')
                last_qty.val(numeral(qty).format('0,000.00') || '-')
            })

            runon?.forEach((qty, index) => {
                if (index > 0) {
                    const new_input = td_runon.find('.input_runon:first').clone()
                    new_input.val('')
                    td_runon.append(new_input)
                }

                let last_qty = $('.input_runon:last')
                last_qty.val(numeral(qty).format('0,000.00') || '-')
            })

            tb.find('.ae_qty').val(ae)
            tb.find('.customer_qty').val(customer)
            tb.find('.runon_percent').val(runon_percent)
        }
    }

    setDivPacking(is_different_packing = false) {
        const is_multiple_f = getIsMultipleF()
        const { qty_per_paper_band: default_qty_per_paperband } = defaultData.paperband_info || {}
        var packing_component = ""

        est.mainData?.component1?.forEach((comp, compIndex) => {
            const component_name = `Component ที่ ${parseInt(compIndex || 0) + 1} : ${comp.component_name}`

            let packingLength = 1, div_child = "", checkboxDiffPacking = ''

            if (is_different_packing) {
                packingLength = est.mainData?.component1[0]?.f_detail?.f_list?.length
            }

            if (is_multiple_f && est.mainData?.component1?.length > 0) {
                checkboxDiffPacking = `<div class="ml-2 mt-2 mb-2">
                    <input type="checkbox" id="is_different_packing" ${is_different_packing ? 'checked' : ''}/> <label for="is_different_packing">แต่ละ F มีรูปแบบการ Packing แตกต่างกัน</label>
                </div>`
            }

            for (let fIndex = 0; fIndex < packingLength; fIndex++) {
                const {
                    component_name,
                    f_detail
                } = est.mainData?.component1[is_different_packing ? 0 : compIndex] || {}

                const f_code = `${f_detail?.f_list[fIndex]?.f_code}`

                div_child += `
                    <div class="packingComponent" index="${compIndex}" fIndex="${fIndex}">
                        <div class="border1 w-100 bg-head ${is_different_packing ? '' : 'd-none'}" style="padding:7px 0px;"><strong>${f_code}</strong></div>
                                <div class="divPacking" index="${compIndex}" fIndex="${fIndex}">
                                    <div class="div-child divPaperband" index="${compIndex}" fIndex="${fIndex}" style="display:none">
                                        <table>
                                            <tr>
                                                <td style="width:100px">Paper Band</td>
                                                <td style="align:center; width:80px">ชนิดสายคาด</td>
                                                <td>
                                                    <select class="paperbandType" index="${compIndex}" fIndex="${fIndex}" style="vertical-align:center">
                                                        <option value="white_paper">White Paper</option>
                                                        <option value="brown_paper">Brown Paper</option>
                                                        <option value="plastic">Plastic</option>
                                                    </select>
                                                </td>
                                                <td style="text-align:center">Quantity/band</td>
                                                <td style="text-align:center"><input class="qty_per_band" index="${compIndex}" fIndex="${fIndex}" style="text-align:center;width:50px;" value="${default_qty_per_paperband}"></td>
                                            </tr>
                                        </table>	
                                    </div>
                                    <div class="div-child divKraftwrap flex-row-parent" index="${compIndex}" fIndex="${fIndex}" style="display:none">
                                        <div style="width:100px;" class="flex-row-child">Kraftwrap</div>
                                        <div class="flex-row-child">
                                            <table  cellpadding="5">
                                                <tr>
                                                    <td>จำนวนด้านกว้าง</td>
                                                    <td><input class="numW_Kraftwrap" index="${compIndex}" fIndex="${fIndex}" style="width:30px; text-align:center" value="1"></td>
                                                </tr>
                                                <tr>
                                                    <td>จำนวนด้านยาว</td>
                                                    <td><input class="numL_Kraftwrap" index="${compIndex}" fIndex="${fIndex}" style="width:30px; text-align:center" value="1"></td>
                                                </tr>
                                                <tr>
                                                    <td>Packing Size</td>
                                                    <td class="bulk_size" index="${compIndex}" fIndex="${fIndex}"></td>
                                                </tr>
                                                <tr>
                                                    <td><input type="checkbox" class="edit_kraftwrap_qty" index="${compIndex}" fIndex="${fIndex}" >แก้ไขจำนวนทั้งหมด</td>
                                                    <td><input class="kraftwrap_qty" index="${compIndex}" fIndex="${fIndex}" style="width:50px;text-align:center" value="" disabled> ชิ้น</td>
                                                </tr>
                                            </table>
                                        </div>
                                        <div class="flex-row-child" style="text-align:right; width:150px; margin-top:5px">รูปแบบการ Packing</div>
                                    </div>
                                    <div class="div-child flex-row-parent divCarton" index="${compIndex}" fIndex="${fIndex}" style="display:none">
                                        <div style="width:100px;" class="flex-row-child">Carton</div>
                                        <div class="flex-row-child">
                                            <div style="margin-bottom:10px">
                                                <table >
                                                    <tr>
                                                        <td style="text-align:center">จำนวนชั้นลูกฟูก</td>
                                                        <td style="text-align:center; width:50px;">
                                                            <div>
                                                                <select class="cartonLayer" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center">
                                                                    <option value="3">3</option>
                                                                    <option value="5" selected>5</option>
                                                                <select>
                                                            </div>
                                                        </td>
                                                        <td style="text-align:center; width:100px">ชนิดลอน</td>
                                                        <td>
                                                            <div class="fluteCtn_corrugated" index="${compIndex}" fIndex="${fIndex}">
                                                                <select class="required" style="text-align-last:center">
                                                                    <option value="BC">BC</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        <td style="text-align:center; width:100px">ชนิดลูกฟูก</td>
                                                        <td >
                                                            <div class="gradeCtn_corrugated" index="${compIndex}" fIndex="${fIndex}">
                                                                <select class="type_1Ctn required"  index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center">
                                                                    <option value="CA">CA</option>
                                                                    <option value="KI">KI</option>
                                                                    <option value="KA">KA</option>
                                                                    <option value="KS">KS</option>
                                                                </select>
                                                                <select class="gram_1Ctn required" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center">
                                                                    <option value="">-</option>
                                                                    <option value="125" selected>125</option>
                                                                </select>
                                                                /<span class="corrugatedFlute">3</span>
                                                                <select class="type_2Ctn required" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center;">
                                                                    <option value="">-</option>
                                                                    <option value="CA" selected>CA</option>
                                                                </select>
                                                                <select class="gram_2Ctn required" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center;">
                                                                    <option value="">-</option>
                                                                    <option value="125" selected>125</option>
                                                                </select>
                                                                /<select class="type_3Ctn required" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center">
                                                                    <option value="">-</option>
                                                                    <option value="CA" selected>CA</option>
                                                                </select>
                                                                <select class="gram_3Ctn required" index="${compIndex}" fIndex="${fIndex}" style="text-align-last:center">
                                                                    <option value="">-</option>
                                                                    <option value="125" selected>125</option>
                                                                </select>
                                                            </div>
                                                        </td>
                                                        
                                                    </tr>
                                                </table>
                                            </div>
                                            <div class="flex-row-parent">
                                                <div style="margin-right:50px">
                                                    <table cellpadding="5">
                                                        <tr>
                                                            <td style="text-align:center">Unit</td>
                                                            <td ><div class="carton_info_unit" index="${compIndex}" fIndex="${fIndex}">unit!!!</div></td>
                                                        </tr>
                                                        <tr>
                                                            <td style="text-align:center">Unit size</td>
                                                            <td colspan="3"><div class="carton_info_unit_size" index="${compIndex}" fIndex="${fIndex}">unit size</div></td>
                                                        </tr>
                                                        <tr>
                                                            <td style="text-align:center">Carton<br/>(Inner size)</td>
                                                            <td colspan="3"><div class="innerCtnSize" index="${compIndex}" fIndex="${fIndex}"><input class="w_innerCtnSize" index="${compIndex}" fIndex="${fIndex}" style="width:40px; text-align:center" > x <input class="l_innerCtnSize" index="${compIndex}" fIndex="${fIndex}" style="width:40px; text-align:center" > x <input class="h_innerCtnSize" index="${compIndex}" fIndex="${fIndex}" style="width:40px; text-align:center" > inch</div></td>
                                                        </tr>
                                                        <tr>
                                                            <td style="text-align:center">จำนวนชั้น</td>
                                                            <td><div class="carton_info_layer_per_carton" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly></div></td>
                                                            <td style="text-align:center">จำนวนชิ้นงาน/ชั้น</td>
                                                            <td><div class="carton_info_qty_per_layer" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly> ชิ้น</div></td>
                                                        </tr> 
                                                        <tr>
                                                            <td style="text-align:center">จำนวนทั้งหมด</td>
                                                            <td><div class="carton_info_qty_per_carton" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly> ชิ้น</div></td>
                                                            <td style="text-align:center">จำนวนชิ้นกอง/ชั้น</td>
                                                            <td><div class="carton_info_bulk_per_layer" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly > กอง</div></td>
                                                        </tr> 
                                                        <tr>
                                                            <td style="text-align:center">น้ำหนัก</td>
                                                            <td><div class="carton_info_weight_per_carton" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly> kg</div></td>
                                                            <td style="text-align:center">น้ำหนัก/ชั้น</td>
                                                            <td><div class="carton_info_weight_per_layer" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly> kg</div></td>
                                                        </tr>
                                                    </table>
                                                </div>
                                                <div class="flex-row-parent flex-row-child">
                                                    <div class="flex-row-child" style="width:550px; margin-left:20px">
                                                        <div style="text-align:center">
                                                            <table cellpadding="5">
                                                                <tr>
                                                                    <td style="text-align:center; width:100px" >ขนาดแผ่นลูกฟูก</td>
                                                                    <td colspan="2"><div class="mmSizeCtn_corrugated" index="${compIndex}" fIndex="${fIndex}"><input style="width:60px; text-align:center" readonly> x <input  style="width:60px; text-align:center" readonly> mm</div></td>
                                                                    <td colspan="2"><div class="inchSizeCtn_corrugated" index="${compIndex}" fIndex="${fIndex}"><input style="width:60px; text-align:center" readonly> x <input  style="width:60px; text-align:center" readonly> inch</div></td>
                                                                </tr>
                                                                <tr>
                                                                    <td style="text-align:center">พื้นที่</td>
                                                                    <td><div class="areaCtn_corrugated" index="${compIndex}" fIndex="${fIndex}"><input style="width:50px; text-align:center" readonly> ft²</div></td>
                                                                    <td style="text-align:center">ความยาวต่อแผ่น</td>
                                                                    <td><div class="lengthCtn_corrugated" index="${compIndex}" fIndex="${fIndex}" style="text-align:left"><input style="width:50px; text-align:center" readonly> metre</div></td>
                                                                </tr>
                                                            </table>
                                                        </div>
                                                        
                                                        <div class="img_corrugated position-relative" index="${compIndex}" fIndex="${fIndex}">
                                                            <img src="./img/corrugated.png" width="100%">
                                                            <div class="w0_corrugated" index="${compIndex}" fIndex="${fIndex}">35</div>
                                                            <div class="w1_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="w2_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="w3_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="w4_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="w_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="l0_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="l1_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div class="l2_corrugated" index="${compIndex}" fIndex="${fIndex}" ></div>
                                                            <div class="l_corrugated" index="${compIndex}" fIndex="${fIndex}"></div>
                                                            <div style="position:absolute; bottom:10px; right:5px">หน่วย:mm</div>
                                                            <div class="flute_carton_img"><img src="./img/fluteV2.png" width="100%"></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="div-child divPallet" index="${compIndex}" fIndex="${fIndex}" style="display:none">
                                        <table>
                                            <tr>
                                                <td style="width:80px;">Pallet</td>
                                                <td style="text-align:center; width:100px;">Pallet size</td>
                                                <td style="text-align:center; width:200px;">
                                                    <div class="palletSize" index="${compIndex}" fIndex="${fIndex}" >
                                                        <select style="text-align-last:center">
                                                            <option value="1">40.00" x 48.00" x 6.50"</option>
                                                            <option value="2">39.37" x 47.24" x 6.50"</option>
                                                            <option value="3">45.90" x 45.90" x 6.50"</option>
                                                            <option value="4">42.00" x 45.00" x 6.50"</option>
                                                            <option value="5">43.30" x 43.30" x 6.50"</option>
                                                            <option value="6">31.50" x 47.24" x 6.50"</option>
                                                        </select>
                                                    </div>
                                                </td>
                                                <td style="text-align:center; width:100px">การขนส่ง</td>
                                                <td style="text-align:center; width:120px">
                                                    <div class="palletDelivery" index="${compIndex}" fIndex="${fIndex}">
                                                        <select style="text-align-last:center">
                                                            <option value="1">ในประเทศ</option>
                                                            <option value="2">ต่างประเทศ</option>
                                                        </select>
                                                    </div>
                                                </td>
                                            </tr>
                                        </table>
                                    </div>
                                </div>
                            </div>`
            }

            packing_component += `
                <table class="w-100 component_packing" border="0" cellspacing="0" cellpadding="0">
                    <thead>
                        <th colspan="7" align="center" class="bg-head border1">
                            <h4>
                                <strong>${component_name}</strong>
                            </h4>
                        </th>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="7" class="w-100">
                                ${checkboxDiffPacking}
                            </td>
                        </tr>
                        <tr>
                            <td colspan="7" class="w-100 packing_img center vcenter">
                                ${div_child}
                            </td>
                        </tr>
                    </tbody>
                </table>
            `
        })



        const packingDiv = `<div id="packing_section">
                    <div id="packing">
                        ${packing_component}
                    </div>
                </div>`


        $('#print_form .td_packing').append(packingDiv)



        $('.divPaperband .qty_per_band').inputmask({ regex: "^[0-9]{1,3}", placeholder: "" })
        $('.numW_Kraftwrap, .numL_Kraftwrap, .carton_info_layer_per_carton input').inputmask({ regex: "^[0-9]{1,2}", placeholder: "" })
        $('.innerCtnSize input').inputmask({ alias: "numeric", placeholder: "" })
        $('.kraftwrap_qty').inputmask({
            'alias': 'decimal',
            'groupSeparator': ',',
            'autoGroup': true,
            'digits': 0,
            'digitsOptional': false,
            'placeholder': ''
        })
    }

    displayPacking(mainData) {
        mainData.component1.forEach((item, index) => {
            item.packing?.forEach((fPack, fIndex) => {
                fPack.forEach((packing) => {
                    switch (packing.name) {
                        case 'paperband':
                            this.displayPaperband(index, packing, fIndex)
                            break
                        case 'kraftwrap':
                            this.displayKraftwrap(index, packing, fIndex)
                            break
                        case 'carton':
                            this.displayCarton(index, packing, fIndex)
                            break
                        case 'pallet':
                            this.displayPallet(index, packing, fIndex)
                            break
                    }
                })
            })
        })
    }

    displayPaperband(index, paperband_obj, fIndex = 0) {
        const paperband = `#print_form .divPaperband[index=${index}][fIndex=${fIndex}]`
        $(`#print_form .packingCheck[index=${index}][fIndex=${fIndex}] .paperband input`).prop('checked', true)
        $(paperband).show()
        $(`${paperband} .paperbandType`).val(paperband_obj.info.type)
        $(`${paperband} .qty_per_band`).val(paperband_obj.info.qty_per_paperband)
    }

    displayKraftwrap(index, kraftwrap_obj, fIndex = 0) {
        const obj = {
            lay_size: kraftwrap_obj.info.cube_size,
            bulk_size: kraftwrap_obj.info.bulk_size
        }
        const kraftwrap = `#print_form .divKraftwrap[index=${index}][fIndex=${fIndex}]`

        $(`#print_form .packingCheck[index=${index}][fIndex=${fIndex}] .kraftwrap input`).prop('checked', true)
        $(kraftwrap).show()
        imgLayoutKraftwrap(index, kraftwrap_obj.info.num_side[0], kraftwrap_obj.info.num_side[1], obj, fIndex)
        $(`${kraftwrap} .numW_Kraftwrap`).val(kraftwrap_obj.info.num_side[0])
        $(`${kraftwrap} .numL_Kraftwrap`).val(kraftwrap_obj.info.num_side[1])
        $(`${kraftwrap} .kraftwrap_qty`).val(kraftwrap_obj.info.qty_per_pack)
        $(`${kraftwrap} .edit_kraftwrap_qty`).attr('checked', kraftwrap_obj.info?.is_editKraftwrapQty)
        $(`${kraftwrap} .kraftwrap_qty`).attr('readonly', !kraftwrap_obj.info?.is_editKraftwrapQty)
    }

    displayCarton(index, carton_obj, fIndex = 0) {
        const carton = `#print_form .divCarton[index=${index}][fIndex=${fIndex}]`
        const corrugated = carton_obj.info.corrugated
        var grade = corrugated.grade.split('/')
        var grade_arr = []
        grade.forEach((item1) => {
            if (item1.length == 6) {
                grade_arr.push(item1.substring(1, 3), item1.substring(3, 6))
            } else {
                grade_arr.push(item1.substring(0, 2), item1.substring(2, 5))
            }
        })
        //var grade_arr=[grade[0].substring(0,2),grade[0].substring(2,5),grade[grade.length-1].substring(0,2),grade[grade.length-1].substring(2,5)]
        $(`#print_form .packingCheck[index=${index}][fIndex=${fIndex}] .carton input`).prop('checked', true)
        $(carton).show()
        showCartonInfo(index, carton_obj, fIndex)
        setCalculateCorrugatedCtn(index, fIndex)
        getCartonFluteTypeOption(index, get_corrugated_type(corrugated.corrugated_layer), fIndex)
        getCartonOption(index, get_corrugated_grade_type1(corrugated.corrugated_layer, corrugated.flute_type), 'type_1', fIndex)
        getCartonOption(index, get_corrugated_grade_gram1(corrugated.corrugated_layer, corrugated.flute_type, grade_arr[0]), 'gram_1', fIndex)
        getCartonOption(index, get_corrugated_grade_type2(corrugated.corrugated_layer, corrugated.flute_type, grade_arr[0], grade_arr[1]), 'type_2', fIndex)
        getCartonOption(index, get_corrugated_grade_gram2(corrugated.corrugated_layer, corrugated.flute_type, grade_arr[0], grade_arr[1], grade_arr[2]), "gram_2", fIndex)
        if (corrugated.corrugated_layer != 2) {
            getCartonOption(index, get_corrugated_grade_type3(corrugated.corrugated_layer, corrugated.flute_type, grade_arr[0], grade_arr[1], grade_arr[2], grade_arr[3]), 'type_3', fIndex)
            getCartonOption(index, get_corrugated_grade_gram3(corrugated.corrugated_layer, corrugated.flute_type, grade_arr[0], grade_arr[1], grade_arr[2], grade_arr[3], grade_arr[4]), "gram_3", fIndex)
        }
        $(carton + ' .cartonLayer').val(corrugated.corrugated_layer)
        $(carton + ' .fluteCtn_corrugated select').val(corrugated.flute_type)
        $(carton + ' .type_1Ctn').val(grade_arr[0])
        $(carton + ' .gram_1Ctn').val(grade_arr[1])
        $(carton + ' .type_2Ctn').val(grade_arr[2])
        $(carton + ' .gram_2Ctn').val(grade_arr[3])
        $(carton + ' .type_3Ctn').val(grade_arr[4])
        $(carton + ' .gram_3Ctn').val(grade_arr[5])
    }

    displayPallet(index, pallet_obj, fIndex = 0) {
        const pallet = `#print_form .divPallet[index=${index}][fIndex=${fIndex}]`
        $(`#print_form .packingCheck[index=${index}][fIndex=${fIndex}] .pallet input`).prop('checked', true)
        $(pallet).show()
        $(pallet + ' .palletSize select').val(pallet_obj.info.pallet_id)
        $(pallet + ' .palletDelivery select').val(pallet_obj.info.delivery_id)
    }

    divComponentSize(mainData, index) {
        var item = mainData.component1[index]
        const {
            machine: { machine_size: { id }, max_size, min_size },
            component_type: { type: compType },
            packaging_size: { open_size },
            layout: {
                laySize = [],
                layout_grain: grain = ''
            },
            paper_info: {
                std_paper_id = ''
            }
        } = item || {}

        const {
            job: {
                print_type = ''
            }
        } = mainData || {}

        let layout_grain = layout_grain == 'horizontal' ? 'ถูกเกรน' : 'ผิดเกรน'
        let paper_size = std_paper_id ? getStdPaperSize(std_paper_id)?.std_paper_name || '' : 'กำหนดเอง'

        if (item.component_type.type != 3) {
            //* component_type : paper only or paper+corrugated -> show paper size

            if (print_type == 'Jet Press') {
                var roll_width_side = item.paper_info.roll_width
                var cut_off_side = item.paper_info.cut_off
            } else {
                var roll_width_side = item.paper_info.roll_width
                var cut_off_side = item.paper_info.cut_off
            }

        } else {
            //* component_type : only corrugated -> show corrugated size 
            var roll_width_side = item.corrugated_layer.info.flute_side
            var cut_off_side = item.corrugated_layer.info.cut_off
        }

        if (compType != 3) {
            var vertical_size = laySize[0]
            var horizontal_size = laySize[1]
        } else {
            var vertical_size = laySize[0]
            var horizontal_size = laySize[1]

        }

        // const { vertical_size, horizontal_size } = getLayout4Display(index)
        // var {paperSize} = item
        let compTypeComponent = ''

        if (![3].includes(compType)) {
            compTypeComponent = `
                <tr>
                    <td style="text-align:left; ">Paper Size :</td>
                    <td style="text-align:center">
                        <div class="paperSize" index="${index}">
                            <input class="wSize required" style="width:40px; text-align:center" value="${roll_width_side}"> x <input class="lSize required" style="width:40px; text-align:center" value="${cut_off_side}">
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="text-align:left; ">Std. Paper :</td>
                    <td style="text-align:center">
                        <div>
                            ${paper_size}
                        </div>
                    </td>
                </tr>
                <tr class="machine-display">
                    <td style="text-align:left; ">Layout Grain :</td>
                    <td style="text-align:center">
                        <div>
                            ${layout_grain || '-'}
                        </div>
                    </td>
                </tr>
            `
        } else {
            compTypeComponent = `
                <tr>
                    <td style="text-align:left; ">Corrugated Size :</td>
                    <td style="text-align:center">
                        <div class="paperSize" index="${index}">
                            <input class="wSize required" style="width:40px; text-align:center" value="${roll_width_side}"> x <input class="lSize required" style="width:40px; text-align:center" value="${cut_off_side}">
                        </div>
                    </td>
                </tr>
                <tr>
                    <td style="text-align:left; ">Std. Corrugated :</td>
                    <td style="text-align:center">
                        <div>
                            ${paper_size}
                        </div>
                    </td>
                </tr>
                <tr style="display:none;">
                    <td style="text-align:left; ">Layout Grain :</td>
                    <td style="text-align:center">
                        <div>
                            ${layout_grain || '-'}
                        </div>
                    </td>
                </tr>
            `
        }

        var div = `<div class="div_size_component" index="${index}"> 
                        <table>
                            <tr>
                                <td style="text-align:left; ">Open Size :</td>
                                <td style="text-align:center; ">${open_size[0]}" x ${open_size[1]}"</td>
                            </tr>
                            <tr>
                                <td style="text-align:left; ">Layout Size :</td>
                                <td style="text-align:center; " class="laySize" index="${index}">
                                    ${vertical_size}" x ${horizontal_size}"
                                </td>
                            </tr>
                            ${compTypeComponent}
                            <tr class="machine-display">
                               
                                <td style="text-align:left; ">Machine Size :</td>
                                <td style="text-align:center">
                                    <div>
                                        ${item?.machine?.machine_name || " - "}
                                    </div>
                                </td>
                            </tr>
                            <tr class="machine-display">
                                <td>Min Size :</td>
                                <td style="text-align:center;" class="cut_size_size cut_size_min" index="${index}">
                                    ${min_size[0]}" x ${min_size[1]}"
                                </td>
                            </tr>
                            <tr class="machine-display">
                                <td>Max Size :</td>
                                <td style="text-align:center;" class="cut_size_size cut_size_max" index="${index}">
                                    ${max_size[0]}" x ${max_size[1]}"
                                </td>
                            </tr>
                            <tr>
                            </tr>
                            
                        </table>
                    </div>`

        $('.componentLayout[index=' + index + ']').append(div)
        // return div
    }

    setJobProfitSharing(bool = false) {
        const isProfitSharing = bool

        const {
            profit_sharing: {
                paper: {
                    marking_price
                },
                plate_price,
                afterpress_price_marking,
                material_price_marking,
                outsouce_price_marking,
                corrugated_markup,
                marking_total_price
            },
            default_marking
        } = defaultData || {}
        // set master

        if (isProfitSharing) {
            $('tr.otherCostProcess').remove()
            $('#otherCost div.addProcess').addClass('disabled')
            defaultData.paper_price_marking = marking_price
            defaultData.import_paper_price_marking = marking_price
            defaultData.plate_price = plate_price
            defaultData.afterpress_price_marking = afterpress_price_marking
            defaultData.material_price_marking = material_price_marking
            defaultData.outsouce_price_marking = outsouce_price_marking
            defaultData.corrugated_markup = corrugated_markup
            defaultData.marking_total_price = marking_total_price
        } else {
            $('#otherCost div.addProcess').removeClass('disabled')
            defaultData.paper_price_marking = default_marking.paper.marking_price
            defaultData.import_paper_price_marking = default_marking.paper.import_marking_price
            defaultData.plate_price = default_marking.plate_price
            defaultData.afterpress_price_marking = default_marking.afterpress_price_marking
            defaultData.material_price_marking = default_marking.material_price_marking
            defaultData.outsouce_price_marking = default_marking.outsouce_price_marking
            defaultData.corrugated_markup = default_marking.corrugated_markup
            defaultData.marking_total_price = default_marking.marking_total_price
        }
    }

}

var pf = new PrintForm