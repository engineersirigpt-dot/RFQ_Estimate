let customerContact = []
var currencyList = []

var jobInfoType = {
    selected: 1,
    data: ['', '']
}

let checkChangeUnitPrice = false

$(async function () {
    var data = localStorage.getItem("data")

    if (data) {
        const rfq_id = parseURLParams(window.location.href).rfqid[0]
        defaultValue()
        getApprover(rfq_id)

        if (getPathnameAction(2) == 'new') {
            $('#issue_date').val(moment().format('YYYY-MM-DD'))
            getQuotatonInfo('new')
        } else {
            const quotation_id = (parseURLParams(window.location.href)).quotationid[0]
            get_edit_quotation_info(quotation_id)
        }

        if (getPathnameAction(2) == 'view') {
            $('input, textarea').attr('readonly', true)
            $('select, input[type=checkbox]').attr('disabled', true)
            $('#save').hide()
        }
    } else {
        window.location = '/'
    }

    await (async () => {
        return await Promise.all([
            fetchExchangeRate()
        ]).then(res => {
            currencyList = res[0]
            setDisplaySelectOption('#currency', currencyList, 'currency_no', 'currency_no', false, null)
        }).catch(error => {
            console.log('error', error)
        })
    })()

    $('#currency').on('change', function () {
        const currency = $(this).val()
        checkChangeUnitPrice = true
        setChangeExchangeRate(currency, true)
    })

    $('.is_Date').datepicker({
        dateFormat: 'yy-mm-dd'
    })

    $('#add-row').on('click', function () {
        addRow()
    })

    $('#delete-row').on('click', function () {
        $('.tr-list:last').remove()
    })

    $('#save').on('click', function () {
        if (!validateItemList()) {
            return false
        }

        if (!validateTHBUnitPrice()) {
            return false
        }

        if (!validateCustomerInfo()) {
            return false
        }

        // if (!validateFormQty()) {
        //     return false
        // }

        if (!validateFormInput()) {
            return false
        }

        if (getPathnameAction(2) == 'new') {
            var msg = 'Are you sure to create Quotation'
        } else {
            var msg = 'Are you sure to save this Quotation ID: ' + $('#quotation_id').val()
        }

        const quotation_data = prepareQuotationData()

        console.log("quotation_data", quotation_data)

        if (confirm(msg)) {
            save_quotation(getPathnameAction(2), quotation_data)
        }
    })

    $('#close').on('click', function () {
        window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
    })

    $('body').on('click', ('#test'), function () {
        prepareQuotationData()
    })

    $('body').on('keyup', ('.list-qty'), function () {
        const index = parseInt($(this).parent().parent().index())
        changeListQty(numeral($(this).val()).value(), index)
        changeTotalPrice()
    })

    $('#price_format').on('change', function () {
        setChangePriceFormat()
        validateChangeTHBUnitPrice()
        changeTotalPrice()
    })

    $('#exchange_cur').on('keyup', function () {
        const exchange_cur = parseFloat($(this).val())
        chageExchangeCur(exchange_cur)
        changeTotalPrice()
    })

    $('body').on('change', ('.THB_unitprice'), function () {
        const index = parseInt($(this).parent().parent().index())
        $(this).attr('is_custom', 1)
        changeTHBUnitprice(index)
        changeTotalPrice()
    })

    $('body').on('change', ('.CUR_unitprice'), function () {
        const index = parseInt($(this).parent().parent().index())
        // const val = parseFloat($(this).val()).toFixed(3)
        $(this).attr('is_custom', 1)
        changeConvertedUnitPrice(index)
        changeTotalPrice()
    })

    $('body').on('change', ('#qty-all'), function () {
        if ($(this).prop('checked')) {
            var qty_arr = []
            $('.qty-list').prop('checked', true)
            $('.qty-list:checked').each((index) => {
                var qty = numeral($('.qty-list:checked:eq(' + index + ')').val()).value()
                qty_arr.push(qty)
            })
            var added_row = $('.qty-list:checked').length - $('.tr-qty').length
            for (var index = 0; index < (added_row); index++) {
                addRowQty(0)
            }
            changeQtyList(qty_arr)
        } else {
            $('.qty-list:not(.qty-list:eq(0))').prop('checked', false)
            $('.qty-list').each((index) => {
                if ($('.qty-list:eq(' + index + ')').prop('checked') == false) {
                    deleteRowQty()
                }
            })
        }
        setChangePriceFormat()
        validateChangeTHBUnitPrice()
        changeTotalPrice()
    })

    $('body').on('change', ('.qty-list'), function () {
        var qty = numeral($(this).val()).value()
        var qty_arr = []
        $('.qty-list:checked').each(function (index) {
            qty_arr.push(numeral($('.qty-list:checked:eq(' + index + ')').val()).value())
        })
        if ($(this).prop('checked') == false) {

            if ($('.qty-list:checked').length == 0) {
                alert('กรุณาเลือก Quantity อย่างน้อย 1 ยอด')
                $(this).prop('checked', true)
                return
            } else {
                if ($('#qty-all').prop('checked')) { $('#qty-all').prop('checked', false) }
                deleteRowQty()
                newRunningNO()
            }

        } else {
            addRowQty(qty)
        }
        changeQtyList(qty_arr)
        setChangePriceFormat()
        validateChangeTHBUnitPrice()
        changeTotalPrice()
    })

    $("#customer_contact_person").on("change", function (event) {
        const contactId = $(this).find('option:selected').attr('contactID');

        if (!contactId) {
            $("#customer_tel").val('')
            $("#customer_fax").val('')
            $("#customer_mobile").val('')
            $("#customer_email").val('')
            return
        }

        const {
            telephone = '',
            fax = '',
            mobilePhone = '',
            email = ''
        } = customerContact.find(f => f.contactID == contactId)

        $("#customer_tel").val(telephone)
        $("#customer_fax").val(fax)
        $("#customer_mobile").val(mobilePhone)
        $("#customer_email").val(email)
    })

    $('#is_request_for_approve').on('change', function () {
        const bool = $(this).prop('checked') || false
        setChangeRequestForApprove(bool)
    })
})

function validateFormInput() {
    let validate = true

    $('.required').each((index, item) => {
        const value = $(item).val() || ''
        const keyValidate = $(item).attr('data-validate') || '-'

        if (!value) {
            validate = false
            alert(`กรุณาระบุข้อมูล ${keyValidate}`)
            return false
        }
    })

    return validate
}

function checkFormEnabled() {
    if (getPathnameAction(2) == 'view') {
        $('input, textarea').attr('readonly', true)
        $('select, input[type=checkbox]').attr('disabled', true)
        // $('#save').hide()
        $('button:not(#close, #text-editor-close), .button').hide()
    }
}

async function getQuotatonInfo(action, data) {
    await setDataRFQ({ rfq_id: parseURLParams(window.location.href).rfqid[0], type: 'quote' })

    setChangeJobInfoTypeId(data?.quotation_info?.job_info_type_id || 1)

    switch (action) {
        case 'new':
            displayQuotationDetail(action)
            displayRFQDetial()
            break
        case 'edit':
            if (data?.quotation_info?.doc_status == 1) {
                alert('ไม่สามารถแก้ไขเอกสารนี้ได้ เนื่องจากเอกสารถูกอนุมัติไปแล้ว.')
                window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
                return false
            }
        case 'view':
            displayQuotationDetail(action, data)
            displayList(data)
            break
    }

    checkFormEnabled()
}

function getPrice(qty, unitprice) {
    return parseFloat((qty * unitprice).toFixed(2))
}

function displayQuotationDetail(action, data) {
    const mainData = dat.data_rfq_log.job_data
    const totalPrice = getSortedTotalPrice(mainData)

    console.log("getEstimateComponentSpec", getEstimateComponentSpec(mainData))

    totalPrice.forEach(({ qty }) => {
        $('#qty-div').append('<li><input class="qty-list" type="checkbox" value="' + qty + '">' + numeral(qty).format('0,0') + '</li>')
    })

    $('.qty-list:eq(0)').prop('checked', true)
    const excluded_vat = totalPrice[0].qty * totalPrice[0].unit_price
    const vat = excluded_vat * 0.07
    const include_vat = excluded_vat + vat

    switch (action) {
        case 'new':
            $('#quotation_description').val(mainData?.job?.job_name || '')
            $('#rfq_id').val(dat.data_rfq_log.job_id)
            $('#customer_name').val(mainData.customer.customer_name)
            $('#ae_name').val(mainData.ae.ae_name)
            $('#customer_address').text(dat.data_rfq_log.customer.address)
            $('#customer_contact_person').val(dat.data_rfq_log.customer.contact)
            $('#customer_tel').val(dat.data_rfq_log.customer.tel)
            $('#customer_fax').val(dat.data_rfq_log.customer.fax)
            $('#customer_mobile').val(dat.data_rfq_log.customer.mobile)
            $('#customer_email').val(dat.data_rfq_log.customer.email)
            $('#payment_condition').val(dat.data_rfq_log.customer.credit_term)
            $('.qty').val(numeral(totalPrice[0].qty).format('0,0'))
            $('.THB_unitprice:eq(0)').val(numeral(totalPrice[0].unit_price).format('0,0.000'))
            $('.CUR_unitprice:eq(0)').val(numeral(totalPrice[0].unit_price_exchange).format('0,0.0000'))
            $('.THB_price:eq(0)').val(numeral(getPrice(totalPrice[0].qty, totalPrice[0].unit_price)).format('0,0.00'))
            $('.CUR_price:eq(0)').val(numeral(getPrice(totalPrice[0].qty, totalPrice[0].unit_price_exchange)).format('0,0.00'))

            $('#vat_excluded').text(numeral(excluded_vat).format('0,0.00'))
            $('#vat').text(numeral(vat).format('0,0.00'))
            $('#vat_included').text(numeral(include_vat).format('0,0.00'))

            $('#exchange_cur').val(mainData?.exchange_rate || 1)
            $('#currency').val(mainData?.currency_no || 'THB')
            setPriceFormat(mainData?.currency_no || 'THB')
            setChangeExchangeRate(mainData?.currency_no || 'THB', false)

            setMinTHBUnitPrice(0, totalPrice[0].unit_price)
            setEstimateUnitPrice(0, totalPrice[0].unit_price)
            getCustomerContact(mainData?.customer?.customer_id, dat.data_rfq_log.customer.contact)

            setChangeRequestForApprove(false)
            break
        case 'view':
        case 'edit':
            $('#quotation_description').val(data.quotation_info?.description || mainData?.job?.job_name || '')
            $('#rfq_id').val(data.quotation_info.rfq_id)
            $('#quotation_id').val(data.quotation_info.quotation_id)
            $('#customer_name').val(data.quotation_info.customer_name)
            $('#ae_name').val(data.quotation_info.ae_name)
            $('#customer_address').text(data.quotation_info.customer_address)
            $('#customer_contact_person').val(data.quotation_info.customer_contact_person)
            $('#customer_tel').val(data.quotation_info.customer_tel)
            $('#customer_fax').val(data.quotation_info.customer_fax)
            $('#customer_mobile').val(data.quotation_info.customer_mobile)
            $('#customer_email').val(data.quotation_info.customer_email)

            $('#vat_excluded').text(numeral(data.quotation_info.price_excluded_vat).format('0,0.00'))
            $('#vat').text(numeral(data.quotation_info.vat).format('0,0.00'))
            $('#vat_included').text(numeral(data.quotation_info.price_included_vat).format('0,0.00'))

            $('#exchange_cur').val(data.quotation_info.exchange_unit)
            $('#currency').val(data.quotation_info.currency_unit)
            $('.price_unit').html(data.quotation_info.currency_unit)

            setPriceFormat(data.quotation_info.currency_unit)

            $('#payment_condition').val(data.quotation_info.credit_term)
            $('#price_format').val(data.quotation_info.price_format)
            $('#issue_date').val(data.quotation_info.issue_date)
            $('#valid_date').val(data.quotation_info.valid_date)
            $('#select_validate_day').val(data.quotation_info.valid_date_day || '')
            $('#due_date').val(data.quotation_info.delivery_date)

            getCustomerContact(mainData?.customer?.customer_id, data.quotation_info.customer_contact_person)

            setChangeRequestForApprove(data.quotation_info.doc_status == 1)
            data.quotation_info?.request_approve_1 && $('.request_approve_to_1').val(data.quotation_info?.request_approve_1)
            data.quotation_info?.request_approve_2 && $('.request_approve_to_2').val(data.quotation_info?.request_approve_2)

            $('[name=job_info_type_id]').prop('disabled', true)
            break
    }

    $('.list-qty:last,.THB_unitprice:last').inputmask({ regex: "^[0-9]{0,8}(\\.\\d{1,3})?$", placeholder: "" })
}

function setChangeRequestForApprove(bool = false) {
    const checkbox = $('#is_request_for_approve')
    const approverSection = $('[option=on_request_for_approve]')
    const selectApprover = $('.request_approve_to_1, .request_approve_to_2')

    checkbox.prop('checked', bool)

    console.log(checkbox, approverSection)

    if (bool) {
        approverSection.show()
        $('#doc_status').val(1)
    } else {
        approverSection.hide()
        $('#doc_status').val(0)
    }
}

function displayRFQDetial() {
    const mainData = dat.data_rfq_log.job_data
    const { is_multiple_f = false, is_different_packing = false } = mainData?.job || {}

    var paper = '',
        print = '',
        other = '',
        process = '',
        packing = '',
        component = '',
        color = ''

    mainData.component1.forEach((item) => {
        color = ''

        if (item?.component_type?.type != 3) {
            paper += '   - ' + item.component_name + ': ' + item.paper.paper_name + ' ' + item.paper.paper_gram + ' gsm\n'
        }

        item?.color?.forEach(col => {
            color += `   - ${col?.f_code ? col?.f_code : item.component_name} : ${col?.outside}/${col?.inside} Colors\n`
        })

        print += color
        component += '   - ' + item.component_name + ': ' + item.component_type.detail_th + '\n'

        item.addon.forEach((item1) => {
            let compName = item.component_name;
            if (is_multiple_f && ['foilstamp', 'emboss', 'deboss'].includes(item1.type)) {
                compName = `[${is_multiple_f ? item1?.info?.f_code?.join(', ') : item.component_name$}]`
            }

            if (item1.type == 'coating') {
                other += '   - ' + compName + ': coating ' + item1.name + ' ' + item1.info.side + ' s\n'
            } else if (item1.type == 'foilstamp') {

                other += '   - ' + compName + ': foil stamp ' + item1.info.color_th + '(' + item1.info.code + ') ' +
                    item1.info.width + '"x' + item1.info.length + '"\n'
            } else if (item1.type == 'emboss' || item1.type == 'deboss') {
                item1.info?.size?.forEach(size => {
                    other += '   - ' + compName + ': ' + item1.type + ' ' + size[0] + '"x' + size[1] + '"\n'
                })
            }
        })

        item.packing.forEach((fPacking, fIndex) => {
            fPacking?.forEach(pack => {
                const compName = is_multiple_f && is_different_packing
                    ? item?.f_detail?.f_list[fIndex]?.f_code
                    : item.component_name

                if (pack.name == 'paperband') {
                    packing += '   - ' + compName + ': paperband ' + numeral(pack.info.qty_per_paperband).format('0,0') + ' pcs/band\n'
                } else if (pack.name == 'kraftwrap') {
                    packing += '   - ' + compName + ': kraftwrap ' + numeral(pack.info.qty_per_pack).format('0,0') + ' pcs/pack\n'
                } else if (pack.name == 'carton') {
                    packing += '   - ' + compName + ': carton ' + numeral(pack.info.carton.qty_per_carton).format('0,0') + ' pcs/carton\n'
                } else if (pack.name == 'pallet') {
                    packing += '   - ' + compName + ': pallet\n'
                }
            })
        })

    })

    mainData.process.forEach((item) => {
        if (item.type == 'other' || item.type == 'handwork') {
            process += '   - ' + item.name + '\n'
        }
    })

    var info = 'TITLE : ' + mainData.job.job_name + '\n' +
        'SIZE (Inches) : ' + mainData.component1[0].packaging_size.fold_size[0] + '" x ' +
        mainData.component1[0].packaging_size.fold_size[1] + '" x ' +
        mainData.component1[0].packaging_size.fold_size[2] + '"\n' +
        'SIZE (mm.) : ' + mainData.component1[0].packaging_size.fold_size[3] + ' x ' +
        mainData.component1[0].packaging_size.fold_size[4] + ' x ' +
        mainData.component1[0].packaging_size.fold_size[5] + '\nCOMPONENT TYPE\n' + component +
        'PAPER\n' + paper + 'PRINT\n' + print + 'OTHER\n' + other +
        'PROCESS\n' + process + 'PACKING\n' + packing

    const info2 = getEstimateComponentSpec(mainData)

    jobInfoType.data[0] = info
    jobInfoType.data[1] = info2

    $('#job_info').text(info)
    setChangeJobInfoTypeId(1)
}
function addRow() {
    var tr = `<tr class="tr-list q-list">
                <td class="align-top" style="text-align:center"></td>
                <td class="align-top" ><textarea class="td-list"></textarea></td>
                <td class="td-input"><input class="unit" style="width: 80%;text-align: center;" value=""></td>
                <td class="td-input"> <input style="width: 80%;text-align: right;" class="list-qty"></td>
                <td class="td-input">
                    <input style="width: 80%;text-align: right;" class="THB_unitprice" min_thb_unit_price="0"><br>
                    <span class="validate_THB_unitprice" style="text-align:center;"></span>
                </td>
                <td class="td-input"> <input style="width: 80%;text-align: right;" class="THB_price" readonly></td>
                <td class="td-input"> <input style="width: 80%;text-align: right;" class="CUR_unitprice"></td>
                <td class="td-input"> <input style="width: 80%;text-align: right;" class="CUR_price" readonly></td>
            </tr>`
    $('#tr-price_format').before(tr)
    $('.list-qty:last,.THB_unitprice:last').inputmask({ regex: "^[0-9]{0,8}(\\.\\d{1,3})?$", placeholder: "" })
}

function changeJobQty(qty, index) {
    const mainData = dat.data_rfq_log.job_data
    const exchange_cur = parseFloat($('#exchange_cur').val())
    const totalPrice = getSortedTotalPrice(mainData)
    const matchQty = totalPrice.find((total) => total.qty === qty)

    setMinTHBUnitPrice(index, matchQty.unit_price)
    setEstimateUnitPrice(index, matchQty.unit_price)

    const unit_price_THB = matchQty.unit_price

    let cur_unit_price = toNumber(unit_price_THB / exchange_cur, 3)
    let cur_total_price = 0

    $('.THB_unitprice:eq(' + index + ')').val(numeral(unit_price_THB).format('0,0.000'))
    $('.THB_price:eq(' + index + ')').val(numeral(getPrice(qty, unit_price_THB)).format('0,0.00'))

    if (checkEqualExchangeRate()) {
        // * Estimate Exchange Rate == Quotation Exchange Rate
        cur_unit_price = matchQty?.unit_price_exchange || toMathNumber(unit_price_THB / exchange_cur, 4)
    }

    cur_unit_price = numeral(cur_unit_price).format('0,0.0000')
    cur_total_price = numeral(getPrice(qty, cur_unit_price)).format('0,0.00')

    $('.CUR_unitprice:eq(' + index + ')').val(cur_unit_price)
    $('.CUR_price:eq(' + index + ')').val(cur_total_price)
}

checkEqualExchangeRate = () => {
    const exchange_cur = parseFloat($('#exchange_cur').val())

    return (dat.data_rfq_log.job_data?.exchange_rate || 1) == exchange_cur
}

function addRowQty(qty) {
    const mainData = dat.data_rfq_log.job_data
    const totalPrice = getSortedTotalPrice(mainData)
    const exchange_cur = parseFloat($('#exchange_cur').val())
    var THB_unitprice, THB_price, CUR_unitprice, CUR_price
    let min_thb_unit_price = 0
    var num_existQty = $('.tr-qty').length

    const matchQty = totalPrice.find(total => total.qty === qty)

    if (matchQty) {
        min_thb_unit_price = matchQty.unit_price
        THB_unitprice = matchQty.unit_price
        THB_price = getPrice(qty, matchQty.unit_price)

        CUR_unitprice = toNumber(matchQty.unit_price / exchange_cur, 4)

        if (checkEqualExchangeRate()) {
            // * Estimate Exchange Rate == Quotation Exchange Rate
            CUR_unitprice = matchQty?.unit_price_exchange || toNumber(matchQty.unit_price / exchange_cur, 4)
        }

        CUR_price = getPrice(qty, CUR_unitprice)
    }

    var tr = `<tr class="tr-qty q-list">
        <td class="align-top" style="text-align:center">${num_existQty + 1}</td>
        <td class="align-top"><input style="width:98%" disabled></td>
        <td class="td-input"><input class="unit" style="width: 80%;text-align: center;" value="Pcs."></td>
        <td class="td-input"> <input style="width: 80%;text-align: right;" class="qty list-qty" value="${numeral(qty).format('0,0')}"></td>
        <td class="td-input"> 
            <input style="width: 80%;text-align: right;" class="THB_unitprice" value="${numeral(THB_unitprice).format('0,0.000')}"><br>
            <span class="validate_THB_unitprice" style="text-align:center;"></span>
        </td>
        <td class="td-input"> <input style="width: 80%;text-align: right;" class="THB_price" readonly value="${numeral(THB_price).format('0,0.00')}"></td>
        <td class="td-input"> <input style="width: 80%;text-align: right;" class="CUR_unitprice" value="${numeral(CUR_unitprice).format('0,0.0000')}"></td>
        <td class="td-input"> <input style="width: 80%;text-align: right;" class="CUR_price" readonly value="${numeral(CUR_price).format('0,0.00')}"></td>
    </tr>`

    if ($('.tr-list').length > 0) {
        $('.tr-list:first').before(tr)
    } else {
        $('#tr-price_format').before(tr)
    }

    $('.tr-qty:last .THB_unitprice:last').inputmask({ regex: "^[0-9]{0,7}(\\.\\d{1,3})?$", placeholder: "" })
    $('.tr-qty:last .qty').inputmask({
        'alias': 'decimal',
        'groupSeparator': ',',
        'autoGroup': true,
        'digits': 0,
        'digitsOptional': false,
        'placeholder': '',
    })
}

function deleteRowQty() {
    $('.tr-qty:last').remove()
}

function changeQtyList(qty_arr) {
    qty_arr.forEach((item, index) => {
        $('.tr-qty:eq(' + index + ') .qty').val(numeral(item).format('0,0'))
        changeJobQty(item, index)
    })
}
function newRunningNO() {
    $('.tr-qty').each(function (index) {
        $('.tr-qty:eq(' + index + ') td:eq(0)').html(index + 1)
    })
}
function changeListQty(qty, index) {
    const THB_unitprice = numeral($('.THB_unitprice:eq(' + index + ')').val()).value()
    const CUR_unitprice = numeral($('.CUR_unitprice:eq(' + index + ')').val()).value()

    $('.THB_price:eq(' + index + ')').val(numeral(THB_unitprice * qty).format('0,0.00'))
    $('.CUR_price:eq(' + index + ')').val(numeral(CUR_unitprice * qty).format('0,0.00'))
}

function setChangePriceFormat() {
    const price_format = parseInt($('#price_format').val())

    $('.THB_unitprice').each(function (index, ele) {
        setChangePriceFormatUnitPrice(index, price_format)
    })
}

function setChangePriceFormatUnitPrice(index, price_format) {
    const input = $(`.THB_unitprice:eq(${index})`)
    let val = toNumber(input.val() || 0, 3)

    const estUnitPrice = input.attr('est_unit_price') || val
    const minUnit_price = input.attr('min_unit_price') || val

    let newTHB = 0
    let newMinPrice = estUnitPrice
    let prevTHB = input.data('prevTHB') || val || 0

    console.log(`
        price_format: ${price_format}
        estUnitPrice : ${estUnitPrice}
        min_price : ${minUnit_price}
        curr : ${val}
        prev : ${prevTHB}
    `)

    if (val < estUnitPrice) {
        val = estUnitPrice
    }


    switch (price_format) {
        case 6: //* local include vat
        case 7: //* export
            newTHB = parseFloat(estUnitPrice * 1.07).toFixed(3)
            newMinPrice = parseFloat(estUnitPrice * 1.07).toFixed(3)

            input.data('prevTHB', val)
            input.val(newTHB)
            break;
        case 4: //* export exclude vat
        case 1: //* local exclude vat

        // break;
        case 3: //* no vat.
        default:
            input.val(estUnitPrice)
            break;
    }

    console.log("newTHB", newTHB, estUnitPrice, newMinPrice)

    if (estUnitPrice != newMinPrice) {
        console.log("is not equal")
        checkChangeUnitPrice = true
    }

    setMinTHBUnitPrice(index, newMinPrice)
    checkChangeUnitPrice && changeTHBUnitprice(index)
}

function changeTotalPrice() {
    const price_format = parseInt($('#price_format').val())
    var total_price = 0
    $('.CUR_price').each(function (index) {
        total_price += numeral($('.CUR_price:eq(' + index + ')').val()).value()
    })

    console.log("total_price", total_price)

    switch (price_format) {
        case 4: //* export exclude vat
        case 1: //* local exclude vat
            var vat_excluded = total_price
            var vat = total_price * 0.07
            var vat_included = total_price * 1.07
            break
        case 5: //* export include vat
        case 2: //* local
        case 6: //* local (new)
        case 7: //* export include vat (new)
            var vat_excluded = total_price / 1.07
            var vat = vat_excluded * 0.07
            var vat_included = total_price
            break
        case 3:
            var vat_excluded = vat_included = total_price
            var vat = 0
            var vat_included = vat_included = total_price
            break
    }

    $('#vat_excluded').text(numeral(vat_excluded).format('0,0.00'))
    $('#vat').text(numeral(vat).format('0,0.00'))
    $('#vat_included').text(numeral(vat_included).format('0,0.00'))
}

function chageExchangeCur(exchange_cur) {
    $('.THB_unitprice').each(function (index) {
        var qty = numeral($('.list-qty:eq(' + (index) + ')').val()).value()
        var THB_unitprice = numeral($('.THB_unitprice:eq(' + index + ')').val()).value()
        const unit_price = toNumber(THB_unitprice / exchange_cur, 4)
        const total_price = toNumber(unit_price * qty, 2)

        $('.CUR_unitprice:eq(' + index + ')').val(numeral(unit_price).format('0,0.0000'))
        $('.CUR_price:eq(' + index + ')').val(numeral(total_price).format('0,0.00'))
    })
}

function changeTHBUnitprice(index) {
    const exchange_cur = parseFloat($('#exchange_cur').val())
    const THB_unitprice = numeral($('.THB_unitprice:eq(' + index + ')').val()).value()
    var qty = numeral($('.list-qty:eq(' + (index) + ')').val()).value()

    const total_price_THB = toNumber(qty * THB_unitprice, 3)
    const unit_price_ex_rate = toNumber(THB_unitprice / exchange_cur, 4)
    const total_price_ex_rate = toNumber(unit_price_ex_rate * qty, 2)

    $('.THB_price:eq(' + index + ')').val(numeral(total_price_THB).format('0,0.00'))
    $('.CUR_unitprice:eq(' + index + ')').val(numeral(unit_price_ex_rate).format('0,0.0000'))
    $('.CUR_price:eq(' + index + ')').val(numeral(total_price_ex_rate).format('0,0.00'))

    validateChangeTHBUnitPrice()
}

function changeConvertedUnitPrice(index) {
    const exchange_cur = parseFloat($('#exchange_cur').val())

    const CUR_unitprice = numeral($('.CUR_unitprice:eq(' + index + ')').val()).value()
    const qty = numeral($('.list-qty:eq(' + (index) + ')').val()).value()

    // Ex.
    const total_price_ex_rate = toNumber(CUR_unitprice * qty, 2)
    $('.CUR_unitprice:eq(' + index + ')').val(numeral(CUR_unitprice).format('0,0.0000'))
    $('.CUR_price:eq(' + index + ')').val(numeral(total_price_ex_rate).format('0,0.00'))

    // THB
    const unit_price_ex_rate = toNumber(CUR_unitprice * exchange_cur, 3)
    const total_price_THB = toNumber(qty * unit_price_ex_rate, 2)
    $('.THB_unitprice:eq(' + index + ')').val(numeral(unit_price_ex_rate).format('0,0.000'))
    $('.THB_price:eq(' + index + ')').val(numeral(total_price_THB).format('0,0.00'))

    validateChangeTHBUnitPrice()
}

function prepareQuotationData() {
    var data = JSON.parse(localStorage.getItem("data"))
    var data_user = JSON.parse(localStorage.getItem("data"))
    const mainData = dat.data_rfq_log.job_data
    var list_arr = [], count_qty = 0
    const doc_status = parseInt($('#doc_status').val() || 0)

    $('.tr-qty').each(function (index) {
        if (index == 0) {
            var is_mainInfo = 1, list_info = $('#job_info').val()
        } else {
            is_mainInfo = 0,
                list_info = null
        }
        list_arr.push({
            list_info: list_info,
            is_mainInfo: is_mainInfo,
            is_qtyList: 1,
            unit: $('.unit:eq(' + index + ')').val(),
            qty: numeral($('.qty:eq(' + index + ')').val()).value(),
            MIN_THB_unitprice: numeral($('.THB_unitprice:eq(' + index + ')').attr('min_thb_unit_price') || 0).value(),
            THB_unitprice: numeral($('.THB_unitprice:eq(' + index + ')').val()).value(),
            THB_price: numeral($('.THB_price:eq(' + index + ')').val()).value(),
            CUR_unitprice: numeral($('.CUR_unitprice:eq(' + index + ')').val()).value(),
            CUR_price: numeral($('.CUR_price:eq(' + index + ')').val()).value(),
        })
        count_qty += 1
    })

    $('.td-list').each(function (index) {
        list_arr.push({
            list_info: $('.td-list:eq(' + index + ')').val(),
            is_mainInfo: 0,
            is_qtyList: 0,
            unit: $('.unit:eq(' + (index + count_qty) + ')').val(),
            qty: numeral($('.list-qty:eq(' + (index + count_qty) + ')').val()).value(),
            MIN_THB_unitprice: numeral($('.THB_unitprice:eq(' + (index + count_qty) + ')').attr('min_thb_unit_price') || 0).value(),
            THB_unitprice: numeral($('.THB_unitprice:eq(' + (index + count_qty) + ')').val()).value(),
            THB_price: numeral($('.THB_price:eq(' + (index + count_qty) + ')').val()).value(),
            CUR_unitprice: numeral($('.CUR_unitprice:eq(' + (index + count_qty) + ')').val()).value(),
            CUR_price: numeral($('.CUR_price:eq(' + (index + count_qty) + ')').val()).value()
        })
    })

    var quotation_obj = {
        quotation_id: $('#quotation_id').val(),
        tb_rfq_quotation: {
            description: $('#quotation_description').val(),
            rfq_id: $('#rfq_id').val(),
            doc_status,
            customer_id: mainData.customer.customer_id,
            customer_address: $('#customer_address').val(),
            customer_contact_person: $('#customer_contact_person').val(),
            customer_tel: $('#customer_tel').val(),
            customer_fax: $('#customer_fax').val(),
            customer_mobile: $('#customer_mobile').val(),
            customer_email: $('#customer_email').val(),
            credit_term: $('#payment_condition').val(),
            ae_name: $('#ae_name').val(),
            currency_unit: $('#currency').val(),
            exchange_unit: parseFloat($('#exchange_cur').val()),
            price_format: parseInt($('#price_format').val()),
            price_included_vat: numeral($('#vat_included').text()).value(),
            vat: numeral($('#vat').text()).value(),
            price_excluded_vat: numeral($('#vat_excluded').text()).value(),
            created_by: data.emp_id,
            edited_by: data.emp_id,
            request_approve_to_1: doc_status == 1 ? $('.request_approve_to_1').val() : null,
            request_approve_to_2: doc_status == 1 ? $('.request_approve_to_2').val() : null,
            issue_date: $('#issue_date').val(),
            valid_date: $('#valid_date').val(),
            delivery_date: $('#due_date').val(),
            job_info_type_id: parseInt($('[name=job_info_type_id]:checked').val()),
            valid_date_day: $('#select_validate_day').val() || '',
        },
        tb_rfq_quotation_list: list_arr,
        tb_rfq_quotation_log: {
            edited_by: data_user.emp_id
        }
    }

    return quotation_obj
}
function save_quotation(action, quotation_obj) {
    quotation_obj.action = action
    if (action == 'edit') {
        delete quotation_obj.tb_rfq_quotation.created_by
    }

    $.ajax({
        url: `${node_api}/estimate/quotations`,
        type: 'POST',
        data: JSON.stringify({ type: action, data: quotation_obj }),
        dataType: 'json',
        cache: 'false',
        contentType: "application/json",
        beforeSend: function () { },
        success: function (res) {
            if (res.success) {
                window.location = '/quote?rfqid=' + (parseURLParams(window.location.href)).rfqid[0]
            } else {
                console.log('error', res)
            }
        },
        error: function (error) {
            console.log('save quotaton ERROR')
        }
    })
}

function get_edit_quotation_info(quotation_id) {
    $.ajax({
        url: `${node_api}/estimate/quotations/${quotation_id}`,
        type: 'GET',
        data: {},
        dataType: 'json',
        cache: 'false',
        contentType: "application/json",
        success: function (data) {
            console.log('get_quotation_info SUCCESS', data)
            getQuotatonInfo(getPathnameAction(2), data)
        },
        error: function () {
            console.log('get_quotation_info ERROR')
        }
    })
}

function getApprover(job_id) {
    return $.ajax({
        url: `${node_api}/user/qt_approver`,
        type: 'POST',
        data: JSON.stringify({ job_id }),
        dataType: 'json',
        cache: 'false',
        contentType: "application/json",
        beforeSend: function () { },
        success: function (res) {
            const manager = res?.filter(obj => obj.is_admin == 0)
            const excutive = res?.filter(obj => obj.is_admin == 1)
            setDisplaySelectOption('.request_approve_to_1', manager, 'emp_id', 'emp_name', true, null)
            setDisplaySelectOption('.request_approve_to_2', excutive, 'emp_id', 'emp_name', true, null)
        },
        error: function (error) {
            console.log('save quotaton ERROR')
        }
    })
}

function getCustomerContact(customer_id, value) {
    return $.ajax({
        url: `${node_api}/customer/get-contact?customer_id=${customer_id}`,
        type: 'GET',
        dataType: 'json',
        cache: 'false',
        contentType: "application/json",
        success: (res) => {
            customerContact = Object.assign(res)

            const options = customerContact.map(mp => {
                return `
                    <option 
                        contactID=${mp.contactID} 
                        value='${mp.contactName}'
                        ${mp.contactName == value ? "selected" : ""}
                    >
                        ${mp.contactName}
                    </option>
                `
            }).join("")

            $("#customer_contact_person").html(options)
        },
        error: (error) => {
            console.log("error get customer contact", error);
        }
    })
}

function displayList(data) {
    console.log("list", data)
    var count_qty = 0

    const mainData = dat.data_rfq_log.job_data
    const totalPrice = getSortedTotalPrice(mainData)

    data.list_info?.sort((a, b) => (b.is_mainInfo + b.is_qtyList) - (a.is_mainInfo + a.is_qtyList)).forEach((item, index) => {
        let minUnitPrice = item?.MIN_THB_unitprice || 0,
            estimateUnitPrice = item?.MIN_THB_unitprice || 0

        if (item.is_mainInfo == 1 && item.is_qtyList == 1) {
            $('#job_info').val(item.list_info)
            $('.qty:eq(' + index + ')').val(numeral(item.qty).format('0,0'))

            // ! here
            const matchQty = totalPrice.find(total => total.qty === item.qty)
            if (matchQty) {
                estimateUnitPrice = matchQty.unit_price
            }

            count_qty += 1
        } else if (item.is_mainInfo == 0 && item.is_qtyList == 1) {
            addRowQty()
            $('.qty:eq(' + index + ')').val(numeral(item.qty).format('0,0'))

            const matchQty = totalPrice.find(total => total.qty === item.qty)
            if (matchQty) {
                estimateUnitPrice = matchQty.unit_price
            }

            count_qty += 1
        } else if (item.is_mainInfo == 0 && item.is_qtyList == 0) {
            addRow(index - count_qty)
            $('.tr-list:eq(' + (index - count_qty) + ') .td-list').text(item.list_info)
            $('.list-qty:eq(' + (index) + ')').val(numeral(item.qty).format('0,0'))
        }
        $('.unit:eq(' + index + ')').val(item.unit)
        $('.THB_unitprice:eq(' + index + ')').val(numeral(item.THB_unitprice).format('0,0.000'))
        $('.THB_price:eq(' + index + ')').val(numeral(item.THB_price).format('0,0.00'))
        $('.CUR_unitprice:eq(' + index + ')').val(numeral(item.CUR_unitprice).format('0,0.0000'))
        $('.CUR_price:eq(' + index + ')').val(numeral(item.CUR_price).format('0,0.00'))
        setMinTHBUnitPrice(index, minUnitPrice || 0)
        setEstimateUnitPrice(index, estimateUnitPrice || 0)

        console.log("display list")
    })
}
function validateItemList() {
    if (checkValidateInput('.tr-qty', $('.tr-qty').length)) {
        if (checkValidateInput('.tr-list', $('.tr-list').length)) {
            return true
        } else { return false }
    } else {
        return false
    }

}
function checkValidateInput(class_name, length) {
    for (var index = 0; index < length; index++) {
        if (class_name == '.tr-qty') {
            if (index == 0) {
                if ($(class_name + ':eq(' + index + ') #job_info').val() == "") {
                    alert('Please fill Job infomation')
                    $(class_name + ':eq(' + index + ') #job_info').focus()
                    return false
                }
            }
        } else {
            if ($(class_name + ':eq(' + index + ') .td-list').val() == "") {
                alert('Please fill out list information or delete this row')
                $(class_name + ':eq(' + index + ') .td-list').focus()
                return false
            }
        }
        if ($(class_name + ':eq(' + index + ') .unit').val() == "") {
            alert('Please fill out unit or delete this row')
            $(class_name + ':eq(' + index + ') .unit').focus()
            return false
        } else if ($(class_name + ':eq(' + (index) + ') .list-qty').val() == "") {
            alert('Please fill out quantity or delete this row')
            $(class_name + ':eq(' + (index) + ') .list-qty').focus()
            return false
        } else if ($(class_name + ':eq(' + (index) + ') .THB_unitprice').val() == "") {
            alert('Please fill out unit price or delete this row')
            $(class_name + ':eq(' + (index) + ') .THB_unitprice').focus()
            return false
        }
    }
    return true
}

function getSortedTotalPrice(mainData) {
    const mainTotalPrice = mainData.totalprice.map((obj, index) => ({ ...obj, qty: mainData.qty.main[index] }))
    const totalPrice = mainTotalPrice.sort((a, b) => a.qty < b.qty ? -1 : 1)
    return totalPrice
}

function setPriceFormat(currency_no = 'THB') {
    if (currency_no == 'THB') {
        $('#price_format option.export').prop('disabled', true)
        $('#price_format option.local').prop('disabled', false)
        $('#price_format').val(1)

    } else {
        $('#price_format option.export').prop('disabled', false)
        $('#price_format option.local').prop('disabled', true)
        $('#price_format').val(3)
    }
}

function setChangeExchangeRate(currency = 'THB', is_changeCurrency = true) {
    const { currency_no = 'THB', exchange_rate = 1 } = currencyList?.find(obj => obj.currency_no == currency) || {}

    $('.price_unit').html(currency_no)
    $('#exchange_cur').val(exchange_rate)
    is_changeCurrency && chageExchangeCur(parseFloat(exchange_rate))

    console.log("setChangeExchangeRate", currency_no, exchange_rate)
    setPriceFormat(currency_no)
    setChangePriceFormat()
    validateChangeTHBUnitPrice()
    changeTotalPrice()
}

function setMinTHBUnitPrice(index, min_unit_price) {
    console.log("setMin", min_unit_price)
    $(`.THB_unitprice:eq(${index})`).attr('min_thb_unit_price', min_unit_price)
}

function setEstimateUnitPrice(index, est_unit_price) {
    $(`.THB_unitprice:eq(${index})`).attr('est_unit_price', est_unit_price)
}

function validateTHBUnitPrice() {
    let validate = true
    $('.tr-qty').each(function (index) {
        let min_thb_unit_price = numeral($(`.THB_unitprice:eq(${index})`).attr('min_thb_unit_price') || 0).value()
        let thb_unit_price = numeral($(`.THB_unitprice:eq(${index})`).val() || 0).value()

        if (thb_unit_price < min_thb_unit_price) {
            validate = false
            alert(`ราคาต่อหน่วย (${thb_unit_price}) ไม่สามารถราคาขั้นต่ำ (${min_thb_unit_price}) ได้`)
            $(`.THB_unitprice:eq(${index})`).focus();
            return false
        }
    })

    return validate
}

function validateChangeTHBUnitPrice() {
    $(`.validate_THB_unitprice`).html(``)

    $('.tr-qty').each(function (index) {
        let min_thb_unit_price = numeral($(`.THB_unitprice:eq(${index})`).attr('min_thb_unit_price') || 0).value()
        let thb_unit_price = numeral($(`.THB_unitprice:eq(${index})`).val() || 0).value()

        console.log("validate", thb_unit_price < min_thb_unit_price)
        if (thb_unit_price < min_thb_unit_price) {
            $(`.validate_THB_unitprice:eq(${index})`).html(`ราคาขั้นต่ำ <br> ( ${min_thb_unit_price} )`)
        }
    })
}

function validateFormQty() {
    let validate = true

    const type_id = parseInt($('[name=job_info_type_id]:checked').val())

    if (type_id == 1) {
        return validate
    }

    const numberOfQty = $('.tr-qty')?.length

    if (type_id == 2 && numberOfQty > 4) {
        validate = false
        alert('แบบฟอร์มต่างประเทศไม่สามารถเลือกยอดงานเกินกว่า (4) ยอดได้.')
    }

    return validate
}

function defaultValue() {

    if (getPathnameAction(2) == 'new') {
        $('title').html('New Quotation')
    } else if (getPathnameAction(2) == 'view') {
        $('title').html('View Quotation')
        $('#add-row,#delete-row,#qty-label,#qty-select-all,#qty-div').hide()

    } else {
        $('title').html('Edit Quotation')
        $('#add-row,#delete-row,#qty-label,#qty-select-all,#qty-div').hide()

    }
    $('#exchange_cur').inputmask({ regex: "^[0-9]{0,2}(\\.\\d{1,2})?$", placeholder: "" })
}

function validateCustomerInfo() {
    let validate = true

    const data = {
        "ที่อยู่ลูกค้า": $('#customer_address').val(),
        "ชื่อผู้ติดต่อ": $('#customer_contact_person').val(),
        "เบอร์โทรลูกค้า": $('#customer_tel').val(),
    }

    Object.entries(data).forEach(([key, value]) => {
        if (value == '') {
            validate = false
            alert(`กรุณากรอกข้อมูล ${key}`)
            return false
        }
    })

    return validate
}


function getEstimateComponentSpec(estData = {}, quotationData = []) {
    const seperateColumnCharacter = '\t'

    const {
        job: {
            is_multiple_f = false,
            is_different_packing = false
        },
        component1 = [],
    } = estData || {}

    let info = ''

    let spec = addon = packing = process = ''

    spec += `Component Type:${seperateColumnCharacter}\n`

    component1?.map(comp => {
        let compName = comp.component_name;

        let paper = '', color = ''

        if (comp?.component_type?.type != 3) {
            paper += `${comp.component_name} ${comp.paper.paper_name} ${comp.paper.paper_gram}`
        }

        comp?.color?.forEach(col => {
            color += `${col?.outside}/${col?.inside} Colors\n`
        })

        spec += `${seperateColumnCharacter}${compName} : ${comp?.component_type?.detail} ${paper}`
        spec += `${seperateColumnCharacter}${color}`
        // })

        //* Other

        comp?.addon?.forEach(ad => {
            const { type, input, info } = ad || {}

            if (is_multiple_f && ['foilstamp', 'emboss', 'deboss'].includes(ad.type)) {
                compName = ad?.info?.f_code?.join(', ')
            }

            if (type == 'coating') {
                if (info?.coating_code == 'SUV') {
                    info?.size?.forEach(size => {
                        addon += `${seperateColumnCharacter}${compName}: ${info?.name} ${info?.type} (${info?.width}" x ${info?.length}")\n`
                    })
                } else {
                    addon += `${seperateColumnCharacter}${compName}: ${info?.name} ${info?.type}\n`
                }
            } else if (type == 'foilstamp') {
                // info?.size?.forEach(size => {
                addon += `${seperateColumnCharacter}${compName}: ${type} ${info?.color}(${info?.code}) ${info?.size?.length ? `${info?.size[0]}" x ${info?.size[1]}"` : `${info?.width}" x ${info?.length}"`}\n`
                // })
            } else if (['deboss', 'emboss'].includes(type)) {
                info?.size?.forEach(size => {
                    addon += `${seperateColumnCharacter}${compName}: ${type} ${size[0]}" x ${size[1]}"\n`
                })
            }
        })

        comp.packing.forEach((fPacking, fIndex) => {
            const compName = is_multiple_f && is_different_packing
                ? comp?.f_detail?.f_list[fIndex]?.f_code
                : comp.component_name
            let texts = ''


            fPacking?.forEach(pack => {

                if (pack.name == 'paperband') {

                    texts += `${seperateColumnCharacter}Paperband ${pack.info?.type} ${numeral(pack.info.qty_per_paperband)?.format('0,0')} pcs/band\n`

                } else if (pack.name == 'kraftwrap') {

                    texts += `${seperateColumnCharacter}Kraftwrap ${numeral(pack.info.qty_per_pack)?.format('0,0')} pcs/pack\n`

                } else if (pack.name == 'carton') {

                    texts += `${seperateColumnCharacter}Carton ${numeral(pack.info.carton.qty_per_carton)?.format('0,0')} pcs/carton\n`

                } else if (pack.name == 'pallet') {

                    texts += `${seperateColumnCharacter}Pallet\n`

                }
            })

            packing += `Packing ${compName}: ${texts}`

        })

        // spec += addon

    })

    estData?.process.forEach((item) => {
        if (item.type == 'other' || item.type == 'handwork') {
            process += '   - ' + item.name + '\n'
        }
    })

    info += spec
    info += packing
    info += process ? `Process:${seperateColumnCharacter}${process}` : ''

    info += `Delivery : ${seperateColumnCharacter} ${estData?.delivery?.map(item => `${item?.destinationName}${item?.dueDate ? ` - ${item?.dueDate}` : ''}`).join('\n') || ' - '}\n`
    info += `Remark : ${seperateColumnCharacter}** If there is the additional place to deliver, there will be the extra transportation cost that will be advised later\n`

    return info
}

function setChangeIssuedDate() {
    const issued_date = $('#issue_date').val()

    if (!issued_date) {
        $('#valid_date').val('')
        $('#select_validate_day').val('')

        alert('กรุณากำหนดวันที่เปิดเอกสารก่อน')
        return false
    }

    const day = parseInt($('#select_validate_day').val() || 0)

    if (day == 0) {
        $('#valid_date').val('')

        return false
    }

    console.log("issued_date", issued_date)
    const valid_date = moment(issued_date, 'YYYY-MM-DD').add(day, 'days').format('YYYY-MM-DD')

    $('#valid_date').val(valid_date)
}