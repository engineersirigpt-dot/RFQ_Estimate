var dat = {}
$(function () {
    var data = localStorage.getItem("data")

    if (data) {
        var quotation_id = parseURLParams(window.location.href).quotationid[0]
        get_quotation_info(quotation_id)
        document.title = 'Quotation ' + quotation_id

    } else {
        window.location = '/'
    }

    $('body').on('click', ('#print'), function () {
        window.print()
    })

    $('body').on('click', ('#close'), function () {
        window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
    })

    $('body').on('change', ('#display_vat'), function () {
        if ($(this).prop('checked')) {
            $('.display_vat').show()
        } else {
            $('.display_vat').hide()
        }
    })

    $('body').on('change', ('#display_price'), function () {
        displayPrice($(this).prop('checked'))
    })

    $('body').on('change', ('.display_vat_option'), function () {
        var is_displayPrice = $('#display_price').prop('checked')
        displayPrice(is_displayPrice)
    })

    $('body').on('change', ('.display_address_option'), function () {
        var opt_address = parseInt($('.display_address_option:checked').val())
        setAddress(opt_address)
    })
})


function storeDataList(data_list) {
    data_list.forEach((item) => {
        var totalprice = (item.total_price.split(',').map((x) => numeral(parseFloat(x)).format('0,0.00') + ' THB')).join(', ')
        var unitprice = (item.unit_price.split(',').map((x) => numeral(parseFloat(x)).format('0,0.00') + ' THB')).join(', ')
        item.total_price = totalprice
        item.unit_price = unitprice
    })
    dat.data_fetchList = data_list
}

function defaultValuePrintPage() {
    var price_format = dat.data_quotation_info.quotation_info.price_format
    create_fieldset(price_format)
    create_table(price_format)
    setAddress(1)

}

function setAddress(option) {
    switch (option) {
        case 1:
            var addr = '125 Soi Chan32, Chan Road, Thungwatdon,\nSathorn, Bangkok 10120 Thailand\n' +
                'Tel: +66(0) 2675 5600 (24 Lines)\nFax: +66(0) 2212 6444, (0)2212 1105\n' +
                'Fax: +66(0) 2675 56230'
            break
        case 2:
            var addr = '14/8 Moo12 Bangna-Trad Km46 Road,\nBangpakong, Chachoengsao,\n24130 Thailand\n' +
                'Tel: +66(0) 38 532 000\nFax: +66(0) 38 830 595, (0) 38 830 8390'

            break
    }
    $('.td-address').text(addr)
}

function get_quotation_info(quotation_id) {
    $.ajax({
        url: `${node_api}/estimate/quotations/${quotation_id}`,
        type: 'GET',
        data: {},
        dataType: 'json',
        cache: false,
        success: function (data) {
            console.log('get_quotation_info SUCCESS', data)
            dat.data_quotation_info = data
            defaultValuePrintPage()
            setPage()
            displayInfotoPage()
            displayList2Page(getAllList('group').group, getAllList('group').check_mainInfo)
            displayListPrice(getAllList('length'))
            setTRVat()
        },
        error: function () {
            console.log('get_quotation_info ERROR')
        }
    })
}

function displayInfotoPage() {
    const mainData = dat.data_quotation_info.quotation_info
    $('.td-quotation-id').html(mainData.quotation_id)
    $('.td-rfq-id').html('(' + mainData.rfq_id + ')')
    $('.td-contact-person').html(mainData.customer_contact_person)
    $('.td-customer-name').html(mainData.customer_name)
    $('.td-customer-address').html(mainData.customer_address)
    $('.td-customer-tax-id').html(mainData.tax_id)

    if (mainData.customer_fax != "") {
        var fax = '/Fax. ' + mainData.customer_fax
    } else {
        var fax = '/Fax. -'
    }

    $('.td-customer-tel').html(mainData.customer_tel + fax)
    $('.td-issue-date').html(mainData.issue_date)
    $('.td-payment-term').html(mainData.credit_term)
    $('.td-customer-id').html(mainData.customer_id)
    $('.td-ae-name').html('&nbsp;&nbsp;&nbsp;&nbsp;' + mainData.ae_name + '&nbsp;&nbsp;&nbsp;&nbsp;')
    $('.td-approved-by').html('&nbsp;&nbsp;&nbsp;&nbsp;' + mainData?.request_approve_display + '&nbsp;&nbsp;&nbsp;&nbsp;')
    $('.td-approved-position').html('ผู้จัดการฝ่ายการตลาด' + '<br/>Approved By')

    if (mainData.valid_date) {
        $('.td-valid-date').html('&nbsp;&nbsp;&nbsp;&nbsp;' + mainData.valid_date + '&nbsp;&nbsp;&nbsp;&nbsp;')
    } else {
        $('.td-valid-date').html('&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;')
    }

    if ([3, 4, 5, 7].includes(mainData.price_format)) {
        $('.td-cur_unit').html('(' + mainData.currency_unit + ')')
    }

    if (mainData?.approved_by) {
        $('.td-approved-license-img').html('<img src="http://192.168.5.40/ADDON/SINGATURE/tmp/' + mainData?.approved_by + '.png" height="65px">')
    } else {
        $('.td-approved-license-img img').hide()
    }
}

function displayPrice(boolean) {
    const opt_vat = parseInt($('input[name=display_vat_option]:checked').val())
    if (boolean) {
        switch (opt_vat) {
            case 1:
                $('.td-totalprice').html(numeral(dat.data_quotation_info.quotation_info.price_excluded_vat).format('0,0.00'))
                $('.td-totalprice-text').html(THBText(dat.data_quotation_info.quotation_info.price_excluded_vat))
                break
            case 2:
                $('.td-totalprice').html(numeral(dat.data_quotation_info.quotation_info.price_included_vat).format('0,0.00'))
                $('.td-totalprice-text').html(THBText(dat.data_quotation_info.quotation_info.price_included_vat))
                break
        }
    } else {
        $('.td-totalprice,.td-totalprice-text').html('-')
    }
}

function sliceIntoChunks(arr) {
    var chunkSize = getChuckSize()
    const res = [];
    for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize);
        res.push(chunk);
    }
    return res;
}

function getChuckSize() {
    if ([1, 2, 6].includes(dat.data_quotation_info.quotation_info.price_format)) {
        return 16
    } else { return 32 }
}

function getMinusTR() {
    if ([1, 2, 6].includes(dat.data_quotation_info.quotation_info.price_format)) {
        return 7
    } else { return 6 }
}
function getTotalHieghtListTR() {
    if ([1, 2, 6].includes(dat.data_quotation_info.quotation_info.price_format)) {
        return 350
    } else { return 660 }
}

function setPage() {
    var group_arr = getAllList('group').group

    for (var i = 0; i < (group_arr.length - 1); i++) {
        $('.page:last').after($('.page:eq(0)').clone())
        $('.page:last .display_vat').remove()
        $('.page:last').attr('index', i + 1)
    }
}

function check_qtyTR() {
    const listData = dat.data_quotation_info.list_info
    var num_qty = (listData.filter((x) => x.is_qtyList == 1)).length
    var num_main = (listData.filter(x => x.is_mainInfo == 1 && x.is_qtyList == 1)[0].list_info.split('\n')).length
    if (num_main > num_qty) {
        var is_addTD = 0, diff_td = num_qty - num_main
    } else { var is_addTD = 1, diff_td = num_qty - num_main }
    return {
        is_addTD, diff_td
    }
}

function getAllList(type) {
    const listData = dat.data_quotation_info.list_info
    var is_addTD = check_qtyTR().is_addTD, diff_td = check_qtyTR().diff_td, check_mainInfo = []
    var all_info = listData.filter(x => x.is_mainInfo == 1 && x.is_qtyList == 1)[0].list_info.split('\n')
    all_info.forEach(() => check_mainInfo.push(1))
    if (is_addTD) {
        var list_length = [all_info.length + diff_td]
        for (var index = 0; index < diff_td; index++) {
            all_info.push("")
            check_mainInfo.push(1)
        }
    } else {
        var list_length = [all_info.length]
    }
    var other_info = listData.filter(x => x.is_mainInfo == 0 && x.is_qtyList == 0)
    other_info.forEach((item) => {
        var add = item.list_info.split('\n')
        list_length.push(add.length)
        add.forEach((item1) => {
            all_info.push(item1)
            check_mainInfo.push(0)
        })
    })
    if (type == 'group') {
        return { group: sliceIntoChunks(all_info), check_mainInfo: sliceIntoChunks(check_mainInfo) }
    } else if (type == 'length') {
        return list_length
    }
}

function displayList2Page(group_arr, check_mainInfo_arr) {
    group_arr.forEach((item, index) => {
        var list_obj = split1stTD(item)
        var mainInfo_obj = split1stTD(check_mainInfo_arr[index])
        $('.page:eq(' + index + ') .td-list:eq(0)').html(list_obj.firstTD)
        $('.page:eq(' + index + ') .tr-list:eq(0)').attr('is_mainInfo', mainInfo_obj.firstTD)
        var list_arr = (list_obj.list_arr.map(x => x.replace(" ", "&nbsp;&nbsp;"))).map(x => x.replace("\t", "&nbsp;&nbsp;&nbsp;"))
        list_arr.forEach((item1, index1) => {
            var tr = `<tr class="tr-list" is_mainInfo="${mainInfo_obj.list_arr[index1]}">
                        <td colspan="4" class="td-bd-l td-bd-r td-bold td-list">${item1}</td>
                        <td class="td-bd-l td-bd-r td-bold" ></td>
                        <td class="td-bd-l td-bd-r td-bold" ></td>
                        <td class="td-bd-l td-bd-r td-bold" ></td>
                    </tr>`
            $('.page:eq(' + index + ') .tr-list:last').after(tr)
        })
    })

}

function displayListPrice(list_length) {
    const list_info = dat.data_quotation_info.list_info, tr_page = getChuckSize()
    var list = list_info.filter((x) => x.is_mainInfo == 0 && x.is_qtyList == 0)
    var main_list = (list_info.filter((x) => x.is_mainInfo == 1 && x.is_qtyList == 1))[0]
    var qty_list = list_info.filter((x) => x.is_mainInfo == 0 && x.is_qtyList == 1)
    var cummu_tr = 0,
        tr_index = 0
    const { price_format = 1 } = dat.data_quotation_info.quotation_info || {}

    list_length.forEach((item, index) => {
        //console.log(item)
        if (index == 0) {
            var num_page = 0
            cummu_tr = 0
            tr_index = 0
        } else {
            cummu_tr += list_length[index - 1]
            var num_page = Math.floor(cummu_tr / tr_page)
            if (num_page != 0) {
                tr_index = cummu_tr % tr_page
            } else {
                tr_index = cummu_tr
            }
        }

        if ([1, 2, 6].includes(price_format)) {
            if (index == 0) {
                var qty = numeral(main_list.qty).format('0,0')
                var unitprice = numeral(main_list.THB_unitprice).format('0,0.000')
                var price = numeral(main_list.THB_price).format('0,0.000')
            } else {
                var qty = numeral(list[index - 1].qty).format('0,0')
                var unitprice = numeral(list[index - 1].THB_unitprice).format('0,0.000')
                var price = numeral(list[index - 1].THB_price).format('0,0.000')
            }
        } else {
            if (index == 0) {
                var qty = numeral(main_list.qty).format('0,0')
                var unitprice = numeral(main_list.CUR_unitprice).format('0,0.000')
                var price = numeral(main_list.CUR_price).format('0,0.000')
            } else {
                var qty = numeral(list[index - 1].qty).format('0,0')
                var unitprice = numeral(list[index - 1].CUR_unitprice).format('0,0.000')
                var price = numeral(list[index - 1].CUR_price).format('0,0.000')
            }
        }

        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(1)').html(qty)
        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(2)').html(unitprice)
        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(3)').html(price)
        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(1)').addClass('td-qty')
        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(2)').addClass('td-unitprice')
        $('.page:eq(' + num_page + ') .tr-list:eq(' + tr_index + ') td:eq(3)').addClass('td-price')
    })

    for (var index = 0; index < qty_list.length; index++) {
        var qty_qty = numeral(qty_list[index].qty).format('0,0')

        if ([1, 2, 6].includes(price_format)) {
            var qty_unitprice = numeral(qty_list[index].THB_unitprice).format('0,0.000')
            var qty_price = numeral(qty_list[index].THB_price).format('0,0.000')
        } else {
            var qty_unitprice = numeral(qty_list[index].CUR_unitprice).format('0,0.000')
            var qty_price = numeral(qty_list[index].CUR_price).format('0,0.000')
        }

        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(1)').html(qty_qty)
        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(2)').html(qty_unitprice)
        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(3)').html(qty_price)
        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(1)').addClass('td-qty')
        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(2)').addClass('td-unitprice')
        $('.tr-list[is_mainInfo=1]:eq(' + (index + 1) + ') td:eq(3)').addClass('td-price')

    }
}

function setTRVat() {
    const vat = numeral(dat.data_quotation_info.quotation_info.vat).format('0,0.000')
    const page_index = $('.table-quote .tr-list .td-qty:last').parent().parent().parent().parent().parent().attr('index')
    const last_trlist_index = $('.page:eq(' + page_index + ') .tr-list').length - 1
    const last_trqty_index = $('.table-quote .tr-list .td-qty:last').parent().index() - getMinusTR()
    const total_tr = getChuckSize()
    if (last_trqty_index < total_tr - 1) {
        if (last_trlist_index == last_trqty_index) {
            var tr = `<tr class="tr-list">
                        <td colspan="4" class="td-bd-l td-bd-r td-bold td-list"></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat" style="vertical-align: top;"><div class="display_vat">Vat</div></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat" style="vertical-align: top;"><div class="display_vat" >7%</div></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat td-vat" style="vertical-align: top;" ><div class="display_vat align-right">${vat}</div></td>
                    </tr>`
            $('.page:eq(' + page_index + ') .tr-list:last').after(tr)
        } else {
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(1)').addClass('td_vat')
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(2)').addClass('td_vat')
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(3)').addClass('td_vat td-vat')
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(1)').html('<div class="display_vat">Vat</div>')
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(2)').html('<div class="display_vat" >7%</div>')
            $('.page:eq(' + page_index + ') .tr-list:eq(' + (last_trqty_index + 1) + ') td:eq(3)').html('<div class="display_vat align-right">' + vat + '</div>')
        }
    } else {
        var tr = `<tr class="tr-list">
                        <td colspan="4" class="td-bd-l td-bd-r td-bold td-list"></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat" style="vertical-align: top;"><div class="display_vat">Vat</div></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat" style="vertical-align: top;"><div class="display_vat" >7%</div></td>
                        <td class="td-bd-l td-bd-r td-bold td_vat td-vat" style="vertical-align: top;" ><div class="display_vat align-right">${vat}</div></td>
                    </tr>`
        $('.page:eq(' + page_index + ') .tr-list:last').after(tr)
    }

    var cum_tr_height = 0 //*cummulative height of tr
    var total_height = getTotalHieghtListTR()
    $('.page:last .tr-list').each(function (index) {
        cum_tr_height += $('.page:last .tr-list:eq(' + index + ')').height()
    })
    if (cum_tr_height == 0) {
        var addded_height = total_height
    } else {
        var addded_height = $('.page:last .tr-list:last').height() + total_height - cum_tr_height
    }
    $('.page:last .tr-list:last td').css({
        'height': addded_height,
        'vertical-align': 'top'
    })
}
function split1stTD(list_arr) {
    var firstTD = list_arr.shift()
    return { firstTD, list_arr }
}

function create_table(price_format) {
    if ([3, 4, 5, 7].includes(price_format)) {
        var table = `<table>
                        <tr>
                            <td style="width: 190px;text-align: left;"><img src="./img/logo_2.png"></td>
                            <!-- <td class="td-small-size">สาขาบางประกง:<br/>(สาขาที่ 00002)</td> -->
                            <td rowspan="3" class="td-header">Sirivatana Interprint Public Company Limited</br>
                                Quotation</td>
                            <td rowspan="3" class="td-small-size td-address">
                                14/8 Moo12 Bangna-Trad Km46 Road,<br/>
                                Bangpakong, Chachoengsao,<br/>
                                24130 Thailand<br/>
                                Tel: +66(0) 38 532 000<br/>
                                Fax: +66(0) 38 830 595, (0) 38 830 8390
                            </td>
                        </tr>
                    </table>
                    <table class="table-quote" cellpadding="3px">
                        <colgroup>
                            <col style="width: 106px;">
                            <col style="width: 112px;">
                            <col style="width: 112px;">
                            <col style="width: 102px;">
                            <col style="width: 102px;">
                            <col style="width: 102px;">
                            <col style="width: 102px;">
                        </colgroup>
                        <tr>
                            <td class='td-bd-t td-bd-l td-bd-b td-small-size td-line-height'>To</td>
                            <td colspan="3" class='td-bd-t td-bd-b td-bd-r td-bold td-contact-person'></td>
                            <td class='td-bd-t td-bd-b td-small-size td-line-height'>Quotation No.</td>
                            <td colspan="2" class='td-bd-t td-bd-b td-bd-r'>
                                <span class="td-bold td-quotation-id"></span> 
                                <span class="td-small-size td-rfq-id"></span>
                            </td>
                        </tr>
                        <tr>
                            <td class='td-bd-t td-bd-l td-small-size td-line-height'>Company</td>
                            <td colspan="3" class='td-bd-t td-bd-r td-bold td-customer-name'></td>
                            <td class='td-bd-t td-bd-b td-small-size td-line-height'>Date</td>
                            <td colspan="2" class='td-bd-t td-bd-b td-bd-r td-bold td-issue-date'></td>
                        </tr>
                        <tr>
                            <td class='td-bd-l td-small-size td-line-height'>Address</td>
                            <td colspan="3" class='td-bd-r td-bold td-customer-address'></td>
                            <td class='td-bd-t td-small-size td-line-height'>Payment terms</td>
                            <td colspan="2" class='td-bd-t td-bd-r td-bold td-payment-term'></td>
                        </tr>
                        <tr>
                            <td class='td-bd-l td-small-size td-line-height'>Tel</td>
                            <td colspan="3" class='td-bd-r td-bold td-customer-tel'></td>
                            <td class='td-small-size td-line-height'>Customer code</td>
                            <td colspan="2" class='td-bd-r td-bold td-customer-id'></td>
                        </tr>
                        <tr>
                            <td colspan="4" class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                                <span class="td-bold">ด้วยบริษัทขอเสนอราคาสำหรับการว่าจ้างงานต่อไปนี้</span><br/>
                                <span class="td-small-size">We are pleased to offer the quotation as follows</span>
                            </td>
                            
                            <td class='td-bd-b td-small-size td-line-height'>Valid Until</td>
                            <td colspan="2" class='td-bd-b td-bd-r td-bold td-v-date'></td>
                        </tr>
                        <tr>
                            <td colspan="4" class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                                <span class="td-bold">รายละเอียดของงาน</span><br/>
                                <span class="td-small-size">Descriptions</span>
                            </td>
                            <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                                Quantity
                            </td>
                            <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                                PPU <span class="td-cur_unit">(USD)</span>
                            </td>
                            <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                                Price <span class="td-cur_unit">(USD)</span>
                            </td>
                        </tr>
                        <tr class="tr-list">
                            <td colspan="4" class="td-bd-l td-bd-r td-bold td-list"></td>
                            <td class="td-bd-l td-bd-r td-bold" ></td>
                            <td class="td-bd-l td-bd-r td-bold" ></td>
                            <td class="td-bd-l td-bd-r td-bold" ></td>
                        </tr>
                        <tr>
                            <td class="td-bd-t td-bd-b td-bd-l td-bold"></td>
                            <td colspan="4" class="td-bd-t td-bd-b td-bold">-</td>
                            <td class="td-bd-t td-bd-b td-bold" style="text-align: right;">Grand Total</td>
                            <td class="td-bd-t td-bd-b td-bd-r td-bd-l td-bold td-totalprice" style="text-align: right;">-</td>
                        </tr>
                        <tr>
                            <td colspan="3" class="td-bd-l td-bd-t td-bd-b" style="text-align: center;">
                                <br/><br/><br/>
                                <span class="td-ae-license-img"></span><br/>
                                <span class="td-bold td-ae-name" style="text-align: center;text-decoration: underline"></span><br/>
                                <span class="td-small-size" style="text-align: center;">Issued By</span>
                            </td>
                            <td colspan="4" class="td-bd-t td-bd-b td-bd-r" style="text-align: center;position:relative;">
                                <br/><br/><br/>
                                <span class="td-approved-license-img" style="top:0px;left:150px;position:absolute"></span><br/>
                                <span class="td-bold td-approved-by" style="text-align: center;text-decoration: underline""></span><br/>
                                <span class="td-small-size td-approved-position" style="text-align: center; "></span>
                            </td>
                        </tr>
                    
                    </table>`
    } else {
        var table = `<table>
                    <tr>
                        <td colspan="4" class="td-bold" style="text-align: right;">FM-721-01-02 Rev.02</td>
                    </tr>
                    <tr>
                        <td rowspan="2" style="width: 85px;text-align: center;"><img src="./img/logo_2.png"></td>
                        <td class="td-small-size">สาขาบางประกง:<br/>(สาขาที่ 00002)</td>
                        <td rowspan="3" class="td-header">บริษัท ศิริวัฒนาอินเตอร์พริ้นท์ จำกัด (มหาชน)</br>
                            Sirivatana Interprint Public Company Limited<br/>ใบเสนอราคา</br>Quotation</td>
                        <td rowspan="3" class="td-small-size td-address">
                            14/8 Moo12 Bangna-Trad Km46 Road,<br/>
                            Bangpakong, Chachoengsao,<br/>
                            24130 Thailand<br/>
                            Tel: +66(0) 38 532 000<br/>
                            Fax: +66(0) 38 830 595, (0) 38 830 8390
                        </td>
                    </tr>
                    <tr>
                        <td class="td-small-size">14/8 หมู่ 12 ต.บางปะกง<br/>อ.บางปะกง จ.ฉะเชิงเทรา<br/>24130</td>
                    </tr>
                    <tr>
                        <td colspan="2" class="td-small-size">เลขที่ประจำตัวผู้เสียภาษี: 0107538000622</td>
                    </tr>
                    <tr>
                        <td  class="td-small-size">สาขาที่ออกใบกำกับภาษี</td>
                    </tr>
                </table>
                <table class="table-quote" cellpadding="3px">
                    <colgroup>
                        <col style="width: 106px;">
                        <col style="width: 112px;">
                        <col style="width: 112px;">
                        <col style="width: 102px;">
                        <col style="width: 102px;">
                        <col style="width: 102px;">
                        <col style="width: 102px;">
                    </colgroup>
                    <tr>
                        <td class='td-bd-t td-bd-l td-bd-b td-small-size td-line-height'>เรียน<br/>To</td>
                        <td colspan="3" class='td-bd-t td-bd-b td-bd-r td-bold td-contact-person'></td>
                        <td class='td-bd-t td-bd-b td-small-size td-line-height'>เลขที่<br/>Quotation No.</td>
                        <td colspan="2" class='td-bd-t td-bd-b td-bd-r'>
                            <span class="td-bold td-quotation-id"></span> 
                            <span class="td-small-size td-rfq-id"></span>
                        </td>
                    </tr>
                    <tr>
                        <td class='td-bd-t td-bd-l td-small-size td-line-height'>บริษัท<br/>Company</td>
                        <td colspan="3" class='td-bd-t td-bd-r td-bold td-customer-name'></td>
                        <td class='td-bd-t td-bd-b td-small-size td-line-height'>วันที่<br/>Date</td>
                        <td colspan="2" class='td-bd-t td-bd-b td-bd-r td-bold td-issue-date'></td>
                    </tr>
                    <tr>
                        <td class='td-bd-l td-small-size td-line-height'>ที่อยู่<br/>Address</td>
                        <td colspan="3" class='td-bd-r td-bold td-customer-address'></td>
                        <td class='td-bd-t td-small-size td-line-height'>เงื่อนไขการขำระเงิน<br/>Payment terms</td>
                        <td colspan="2" class='td-bd-t td-bd-r td-bold td-payment-term'></td>
                    </tr>
                    <tr>
                        <td class='td-bd-l td-small-size td-line-height'>เลขที่ประจำตัว<br/>ผู้เสียภาษี</td>
                        <td colspan="3" class='td-bd-r td-bold td-customer-tax-id'></td>
                        <td rowspan="3" class='td-bd-b  td-small-size td-line-height'>Customer code</td>
                        <td rowspan="3"  colspan="2" class='td-bd-b td-bd-r td-bold td-customer-id'></td>
                    </tr>
                    <tr>
                        <td class='td-bd-l td-small-size td-line-height'>Tel</td>
                        <td colspan="3" class='td-bd-r td-bold td-customer-tel'></td>
                    </tr>
                    <tr>
                        <td colspan="4" class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                            <span class="td-bold">ด้วยบริษัทขอเสนอราคาสำหรับการว่าจ้างงานต่อไปนี้</span><br/>
                            <span class="td-small-size">We are pleased to offer the quotation as follows</span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="4" class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                            <span class="td-bold">รายละเอียดของงาน</span><br/>
                            <span class="td-small-size">Descriptions</span>
                        </td>
                        <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                            <span class="td-bold">จำนวน</span><br/>
                            <span class="td-small-size">Quantity</span>
                        </td>
                        <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                            <span class="td-bold">หน่วยละ</span><br/>
                            <span class="td-small-size">@</span>
                        </td>
                        <td class='td-bd-t td-bd-b td-bd-l td-bd-r' style="text-align: center;">
                            <span class="td-bold">ราคารวม</span><br/>
                            <span class="td-small-size">Price</span>
                        </td>
                    </tr>
                    <tr class="tr-list">
                        <td colspan="4" class="td-bd-l td-bd-r td-bold td-list"></td>
                        <td class="td-bd-l td-bd-r td-bold" ></td>
                        <td class="td-bd-l td-bd-r td-bold"></td>
                        <td class="td-bd-l td-bd-r td-bold" ></td>
                    </tr>
                    <tr>
                        <td class="td-bd-t td-bd-b td-bd-l td-bold">จำนวนเงินตัวอักษร</td>
                        <td colspan="4" class="td-bd-t td-bd-b td-bold td-totalprice-text">-</td>
                        <td class="td-bd-t td-bd-b td-bold" style="text-align: right;">จำนวนเงินรวม<br/>Grand Total</td>
                        <td class="td-bd-t td-bd-b td-bd-r td-bd-l td-bold td-totalprice" style="text-align: right;">-</td>
                    </tr>
                    <tr>
                        <td colspan="3" class="td-bd-l td-bd-t td-bd-b" style="text-align: center;">
                            <br/><br/><br/>
                            <span class="td-ae-license-img"></span><br/>
                            <span class="td-bold td-ae-name" style="text-align: center;text-decoration: underline"></span><br/>
                            <span class="td-small-size" style="text-align: center;">เจ้าหน้าที่ฝ่ายขาย<br/>Issued By</span>
                        </td>
                        <td colspan="4" class="td-bd-t td-bd-b td-bd-r" style="text-align: center;position:relative;">
                            <br/><br/><br/>
                            <span class="td-approved-license-img" style="top:0px;left:150px;position:absolute"></span><br/>
                            <span class="td-bold td-approved-by" style="text-align: center;text-decoration: underline""></span><br/>
                            <span class="td-small-size td-approved-position" style="text-align: center; "></span>
                        </td>
                    </tr>
                    <tr>
                        <td colspan="7" class="td-bd-l td-bd-t td-bd-r td-bd-b td-bold" style="text-align: center;">
                            สำหรับลูกค้าเพื่อตอบกลับแล้วส่งกลับบริษัท
                        </td>
                    </tr>
                    <tr>
                        <td colspan="3"rowspan="2" style="font-size:10px;word-break: normal;" class="td-bd-l td-bd-t td-bd-b td-bd-r">
                            <span style="font-weight:bold;">เงื่อนไข / Conditions</span><br/>
                            <ol style="margin:0;padding-left:30px" >
                                <li>
                                    ราคาที่เสนอนี้มีผลบังคับถึงเพียงวันที่  
                                    <span class="td-valid-date" style="text-decoration: underline;"></span>
                                </li>
                                <li> ราคาที่เสนอนี้ไม่รวมค่าภาษีมูลค่าเพิ่มและค่าแก้ไขเพลท(ถ้ามี)</li>
                                <li>บริษัทขอสงวนสิทธิ์เปลี่ยนแปลงราคางานตามการเปลี่ยนแปลงรายละเอียดของงานที่เกิดขึ้นภายหลังตกลงว่าจ้าง</li>
                                <li>บริษัทขอสงวนสิทธิ์ในความรับผิดชอบ หากมีการละเมิดลิขสิทธิ์ในข้อเขียน, บทความ,บทประพันธ์, การออกแบบ, และ ฯลฯ หากมีเนื่องจากบริษัทอยู่ในสถานะผู้รับจ้างเท่านั้น</li>
                                <li>กรณีลูกค้าอนุมัติการสั่งซื้อแล้ว และมีการเปลี่ยนแปลงกระดาษภายหลังลูกค้าต้องรับผิดชอบต่อกระดาษที่สั่งซื้อไปแล้ว</li>
                                <li>กรณีลดจำนวนพิมพ์ หรือลดจำนวนหน้า และมีกระดาษเหลือมากกว่า 10% ของค่ากระดาษลูกค้าเป็นผู้รับผิดชอบต่อกระดาษส่วนต่างที่เกิดขึ้น</li>
                            </ol>
                        </td>
                        <td colspan="4" style="font-size:10px;word-break: normal" class="td-bd-l td-bd-t td-bd-r td-line-height">
                            ข้าพเจ้ารับทราบรายการว่าจ้างและเงื่อนไขของงานตามใบเสนอราคานี้และยินดีตกลงว่าจ้างตามรายการข้างต้นนี้ทุกประการ
                        </td>
                    </tr>
                    <tr>
                        <td colspan="1" style="text-align: center;" class="td-bd-l td-bd-b">
                            <br/><br/><br/><br/>
                            <span class="td-small-size" ">(ประทับตรา)<br/>Company's Seal</span>
                        </td>
                        <td colspan="3" style="text-align: center;" class="td-bd-b td-bd-r td-line-height">
                            <br/><br/>
                            ___________________________________<br/>
                            <span class="td-small-size" ">ผู้จัดการ / หุ้นส่วนผู้จัดการ / กรรมการผู้จัดการ<br/>Approved By<br/>___/___/___</span>
                        </td>
                    </tr>
                </table>`
    }

    $('.page form').append(table)

}
function create_fieldset(price_format) {
    var add = ""
    // if (price_format != 3) {
    add = `<input id='display_price' type='checkbox'>แสดงราคารวม <br/>
        &nbsp;&nbsp;<input type="radio" class="display_vat_option" value="1" name="display_vat_option" checked>ก่อน Vat<br/>
        &nbsp;&nbsp;<input type="radio" class="display_vat_option" value="2" name="display_vat_option">หลัง Vat<br/><br/>
        ที่อยู่บนหัวเอกสาร<br/>
        &nbsp;&nbsp;<input type="radio" class="display_address_option" value="1" name="display_address_option" checked>เจริญกุรง<br/>
        &nbsp;&nbsp;<input type="radio" class="display_address_option" value="2" name="display_address_option">บางปะกง<br/>`
    // }
    var fieldset = `<legend>Options</legend>
                    <input id='display_vat' type='checkbox'>แสดง Vat <br/>
                    ${add}`
    $('#option').append(fieldset)
}