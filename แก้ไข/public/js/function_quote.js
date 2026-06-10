let quotation_list = []
var dat = {
    quote: {
        data_selected_quotation: '',
        data_doc_status: 0
    },
}

$(function () {
    $('#quotation-li a').attr('href', window.location.href + '#quotation-tab')
    $('#quote-tab').tabs();
    var data = localStorage.getItem("data")

    if (data) {
        getQuotationInfo()
        getQuotationList()
    } else {
        window.location = '/'
    }

    $('#modal_history').dialog({
        autoOpen: false,
        modal: true,
        width: "60%",
        resizable: false,
        closeOnEscape: true,
        draggable: false,
        open: function () {
            $(this).closest('div.ui-dialog').find('.ui-dialog-titlebar').hide()
        },
        close: function () {
            console.log($(this))
        }
    })

    $('#quotation_reject_modal').dialog({
        autoOpen: false,
        modal: true,
        width: "50%",
        // title: "Stock of paper",
        resizable: false,
        closeOnEscape: true,
        draggable: false,
        position: {
            my: "top",   // Center the dialog
            at: "center",   // At the center of the window
            of: 'body'      // Position relative to the window
        },
        open: function () {
            $(this).closest('div.ui-dialog').find('.ui-dialog-titlebar').hide()
        },
        close: function () {
        }
    })

    $('#close').on('click', function () {
        window.location = '/'
    })

    $('#add').on('click', function () {
        const rfq_id = parseURLParams(window.location.href).rfqid[0]
        window.location = '/quote/new?rfqid=' + rfq_id
    })

    $('#edit').on('click', function () {
        if (dat.quote.data_selected_quotation) {
            if (dat.quote.data_doc_status == 3) {
                alert('ไม่สามารถแก้ไขได้ เนื่องจากเอกสารถูกอนุมัติไปแล้ว')
                return false;
            }
            const rfq_id = parseURLParams(window.location.href).rfqid[0]
            window.location = '/quote/edit?rfqid=' + rfq_id + '&quotationid=' + dat.quote.data_selected_quotation
        } else {
            alert('Please select quotation ID')
        }
    })

    $('#view').on('click', function () {
        if (dat.quote.data_selected_quotation) {
            const rfq_id = parseURLParams(window.location.href).rfqid[0]
            window.location = '/quote/view?rfqid=' + rfq_id + '&quotationid=' + dat.quote.data_selected_quotation
        } else {
            alert('Please select quotation ID')
        }
    })

    $('#print').on('click', function () {
        if (dat.quote.data_selected_quotation) {

            const rfq_id = parseURLParams(window.location.href).rfqid[0]
            // window.location = '/quote/print?rfqid=' + rfq_id + '&quotationid=' + dat.quote.data_selected_quotation
            window.location = `${report_url}/quotation/print?quotation_id=${dat.quote.data_selected_quotation}`
        } else {
            alert('Please select quotation ID')
        }
    })

    $('#delete').on('click', function () {
        if (dat.quote.data_selected_quotation) {
            if (confirm('Are you sure to delete this Quotation ID: ' + dat.quote.data_selected_quotation)) {
                console.log(dat.quote.data_selected_quotation)
                deleteQuotation(dat.quote.data_selected_quotation)
            }
        } else {
            alert('Please select quotation ID')
        }
    })

    $('body').on('click', '#close_modal_history', function () {
        $('#modal_history').dialog('close')
    })

    $('body').on('click', ('#quotation-tab tbody tr'), function () {
        const status_id = parseInt($(this).attr('doc_status') || 0)

        setCSStrClick($(this).attr('quotation_id'))
        dat.quote.data_selected_quotation = $(this).attr('quotation_id')
        dat.quote.data_doc_status = status_id

        $('#history').show()

        if ([1, 3]?.includes(status_id)) {
            $('#edit, #delete').prop('disabled', true)
        } else {
            $('#edit, #delete').prop('disabled', false)

        }

        checkQuoteApprove()
    })

    $('body').on('click', ('#approve'), function () {
        if (dat.quote.data_selected_quotation) {
            if (dat.quote.data_doc_status == 3) {
                alert('เอกสารนี้ถูกอนุมัติไปแล้ว')
                return false
            }

            if (confirm('Are you sure to "Approve" this Quotation ID: ' + dat.quote.data_selected_quotation)) {
                updateQuotationStatus(dat.quote.data_selected_quotation, 3, '')
            }
        } else {
            alert('Please select quotation ID')
        }
    })

    $('body').on('click', ('#reject'), async function () {
        console.log("dat.quote.data_selected_quotation", dat.quote.data_selected_quotation)
        $('#reject_quotation_id').html(dat.quote.data_selected_quotation || '-')
        $('#quotation_reject_modal').dialog('open')
    })

    $('body').on('click', ('#save_reject'), function () {

        if (!$('#remark').val()?.trim()) {
            alert('กรุณาระบุเหตุผลที่ Reject')
            return false
        }

        updateQuotationStatus(dat.quote.data_selected_quotation, 2, $('#remark').val())
    })

    $('body').on('click', ('#cancel_reject'), function () {
        $('#quotation_reject_modal').dialog('close')
        $('#remark').val('')
    })

    $('body').on('click', ('.view_history'), function () {
        const quotation_id = $(this).data('quotation_id') || null

        if (!quotation_id) return

        $('#history_id').html(quotation_id || '-')
        viewHistory(quotation_id)
    })
})

async function getQuotationInfo() {
    await setDataRFQ({ rfq_id: parseURLParams(window.location.href).rfqid[0], type: 'quote' })
    displayQuotationInfo()
}

async function viewHistory(quotation_id = null) {
    if (!quotation_id) return false

    const historyData = await getQuotationHistory(quotation_id)

    $('#modal_history').dialog('open')

    $('#tb_quotation_history')?.DataTable()?.destroy();

    $('#tb_quotation_history').DataTable({
        responsive: true,
        searching: false,
        scrollY: 300,
        paging: false,
        info: false,
        order: [],
        data: historyData,
        columns: [
            { data: 'status_id', className: "text-center" },
            { data: 'status_name', className: "text-center" },
            { data: 'remark', className: "text-left" },
            { data: 'emp_name', className: "text-left" },
            { data: 'edited', className: "text-center" },
        ],
        columnDefs: [
            {
                targets: [0],
                orderable: false,
                width: "5%",
                render: function (data, type, row, meta) {
                    return meta.row + 1
                }
            },
            {
                targets: [1], width: "10%", orderable: false, render: function (data, type, row, meta) {
                    return `<span class="bold doc_status_${row?.status_id}">${data}</span>`
                }
            },
            { targets: [2], width: "45%", orderable: false, },
            { targets: [3], width: "20%", orderable: false, },

            {
                targets: [4],
                orderable: false,
                // orderDataType: 'date-time-custom',
                width: '20%',
                render: function (data, type, row, meta) {
                    return `
                        <span>
                        ${moment(row?.edited, 'YYYY-MM-DD HH:mm:ss').format('DD/MM/YYYY HH:mm')}
                        </span>`;
                }
            },
        ]
    })
}

function displayQuotationInfo() {
    const job_data = dat.data_rfq_log.job_data
    $('#rfq_id').val(dat.data_rfq_log.job_id)
    $('#job_name').val(job_data.job.job_name)
    $('#ae_name').val(job_data.ae.ae_name)
    $('#customer_name').val(job_data.customer.customer_name)
    $('#qty').val(job_data.qty.main.map(x => numeral(x).format('0,0')).join(' / '))
}

function approveQuotation(quotation_id) {
    var data = JSON.parse(localStorage.getItem("data"))
    console.log("data", data)
    $.ajax({
        url: `${node_api}/estimate/quotations/status`,
        type: 'POST',
        data: JSON.stringify({
            emp_id: data.emp_id,
            quotation_id
        }),
        dataType: 'json',
        cache: false,
        contentType: 'application/json',
        beforeSend: function () { },
        success: function (data) {
            if (data?.data?.approve_status == 1) {
                alert('อนุมัติเอกสารเรียบร้อยแล้ว')
            } else {
                alert('พบข้อผิดพลาด ไม่สามารถอนุมัติเอกสารได้ หรือ เอกสารถูกอนุมัติไปแล้ว')
            }
            window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
        },
        error: function () {
            console.log('approve ERROR')
        }
    })
}

function getQuotationList() {
    var rfq_id = (parseURLParams(window.location.href)).rfqid[0]
    $.ajax({
        url: `${node_api}/estimate/quotations?rfq_id=${rfq_id}`,
        type: 'GET',
        data: {},
        dataType: 'json',
        cache: false,
        beforeSend: function () { },
        success: function (data) {
            quotation_list = data
            displayQuotationList(data)
        },
        error: function () {
            console.log('get quotation_list ERROR')
        }
    })
}

function getQuotationHistory(quotation_id) {
    return $.ajax({
        url: `${node_api}/estimate/quotations_history?quotation_id=${quotation_id}`,
        type: 'GET',
        data: {},
        dataType: 'json',
        cache: false,
        beforeSend: function () { },
        success: function (data) {
            return data
        },
        error: function () {
            console.log('get quotation_list ERROR')
            return []
        }
    })
}

function deleteQuotation(quotation_id) {
    $.ajax({
        url: `${node_api}/estimate/quotations/${quotation_id}`,
        type: 'DELETE',
        data: {},
        dataType: 'json',
        cache: false,
        success: function () {
            console.log('get delete_quotation_id SUCCESS')
            window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
        },
        error: function () {
            console.log('delete_quotation_id ERROR')
        }
    })
}

function displayQuotationList(list_arr) {
    var tbody = ""
    list_arr.forEach((item) => {
        tbody += `<tr quotation_id='${item.quotation_id}' doc_status='${item?.doc_status || 0}'>
                    <td>${item.quotation_id || '-'}</td>
                    <td>${item.customer_name || '-'}</td>
                    <td>${item?.issue_date ? moment(item.issue_date, 'YYYY-MM-DD').format('DD/MM/YYYY') : '-'}</td>
                    <td>${item?.valid_date ? moment(item.valid_date, 'YYYY-MM-DD').format('DD/MM/YYYY') : '-'}</td>
                    <td>${item.credit_term || '-'}</td>
                    <td>${item?.approved_by_name || '-'}</td>
                    <td>${item.customer_contact_person}</td>
                    <td><span data-quotation_id="${item?.quotation_id}" class="view_history bold doc_status_${item?.doc_status}" style="display:flex;align-items: center;">${item?.doc_status_name || '-'}</span></td>
                </tr>`
    })
    $('#quotation-tab table tbody').append(tbody)
}

function setCSStrClick(quotation_id) {
    $('#quotation-tab tbody tr').css({
        "background-color": "white",
        "font-weight": ""
    })
    $('#quotation-tab tbody tr[quotation_id=' + quotation_id + ']').css({
        "background-color": "#aac5e6ce",
    })
}

function checkQuoteApprove() {
    const {
        emp_id = ''
    } = JSON.parse(localStorage.getItem("data"))
    const quotation = quotation_list?.find(qn => qn.quotation_id == dat.quote?.data_selected_quotation)

    const isAuthorizeApprove = quotation?.request_approve_to?.split(',')?.includes(emp_id) || false

    if (dat?.quote?.data_doc_status == 1 && isAuthorizeApprove) {
        $('#approve, #reject').attr('disabled', false)
        $('#approve, #reject').css('display', 'block')
    } else {
        $('#approve, #reject').attr('disabled', true)
        $('#approve, #reject').css('display', 'none')
    }
}

function updateQuotationStatus(quotation_id, status_id = 0, remark = null) {
    var data = JSON.parse(localStorage.getItem("data"))

    $.ajax({
        url: `${node_api}/estimate/quotations/status`,
        type: 'POST',
        data: JSON.stringify({
            emp_id: data.emp_id,
            quotation_id,
            status_id,
            remark
        }),
        dataType: 'json',
        cache: false,
        contentType: 'application/json',
        beforeSend: function () { },
        success: function (data) {
            if (data?.success) {
                alert('อัปเดตสถานะเรียบร้อยแล้ว')
            } else {
                alert('พบข้อผิดพลาด ไม่สามารถอัปเดตสถานะเอกสารได้ โปรดติดต่อ MIS.')
            }

            window.location = '/quote?rfqid=' + parseURLParams(window.location.href).rfqid[0]
        },
        error: function () {
            console.log('approve ERROR')
        }
    })
}