var exportData = []
var dat = {
    data_fetchList: []
}

$(function () {
    accordion_div()
    var data = localStorage.getItem("data")

    setAllInputMask()

    if (data) {
        data = JSON.parse(data)
        if (data.user_group_id && data?.roles) {
            localStorage.removeItem("url")
            // $.unblockUI();
            showLogin(data);
            fetchlastest50record(data.user_group_id, data.sale_group_id)

            if (data?.user_group_id?.includes(1)) {
                $('#costingSystemBtn').show()
            }
        } else {
            alert('เนื่องจากระบบมีการปรับเปลี่ยนสิทธิ์การใช้งาน กรุณา Log-in ใหม่')
            logout()
        }

    } else {
        // blockUI()
        logout()
    }

    $('#costingSystemBtn').on('click', function () {
        window.open(COSTING_URL, '_blank');
    })

    $('#login-submit').on('click', () => {
        login()
        //$.unblockUI();
    })

    $('body').on('click', ('#newRFQ button:not(#newRFQ-ai)'), function () {
        window.location = '/estimate'
    })

    $('#logout-div').on('click', () => {
        logout()
    })

    $('body').on('change', ('#slc-appStatus, #is_profit_sharing'), () => {
        var status = $('#slc-appStatus').val()
        search(status)
    })

    $('body').on('change', ('#fromDate'), function () {
        var fromDate = $('#fromDate').val()
        var toDate = $('#toDate').val()
        const dateDiff = moment(toDate, 'DD/MM/YYYY').diff(moment(fromDate, 'DD/MM/YYYY'), 'day') || 0

        if (dateDiff < 0) {
            $('#toDate').val(fromDate || '')
        }

        if (toDate == '') {
            const toDate = fromDate ? moment(moment(fromDate, 'DD/MM/YYYY')).endOf('month')?.format('DD/MM/YYYY') : ''
            $('#toDate').val(toDate || '')
        }
    })

    $('body').on('change', ('#toDate'), function () {
        var toDate = $('#toDate').val()
        var fromDate = $('#fromDate').val()
        const dateDiff = moment(toDate, 'DD/MM/YYYY').diff(moment(fromDate, 'DD/MM/YYYY'), 'day') || 0

        if (dateDiff < 0) {
            $('#fromDate').val(toDate || '')
        }

        if (fromDate == '') {
            const fromDate = toDate ? moment(moment(toDate, 'DD/MM/YYYY')).startOf('month')?.format('DD/MM/YYYY') : ''
            $('#fromDate').val(fromDate || '')
        }
    })

    $('#search-bttn').on('click', () => {
        var status = $('#slc-appStatus').val()
        search(status)
    })

    $('body').on('click', ('#list table tr'), function () {
        menuList($(this).attr('job-id'))
        accordion_div()
    })

    $('body').on('click', ('#edit'), function () {
        if ($(this)?.attr('class')?.split(' ')?.includes('disabled')) {
            alert('ไม่สามารถแก้ไขได้ เนื่องจากเอกสารถูกใช้ในระบบ MI แล้ว')
            return
        }

        const job_id = $('#id_no').text()
        window.location = '/estimate?jobid=' + job_id
    })

    $('body').on('click', ('#view'), function () {
        const job_id = $('#id_no').text()
        window.location = '/view?jobid=' + job_id
    })

    $('body').on('click', ('#quote'), function () {
        const job_id = $('#id_no').text()
        if (getPricecheck(job_id)) {
            window.location = '/quote?rfqid=' + job_id
        } else {
            alert('RFQ: ' + job_id + ' ยังไม่ได้รับการอนุมัติ')
        }
    })

    $('body').on('click', ('#copy'), function () {
        const job_id = $('#id_no').text()
        copyRFQ(job_id)
        // window.location = '/estimate?jobid=' + job_id + '&copy=1'
    })

    $('#jobid, #jobName, #ae, #customer, #fromDate, #toDate').keyup((event) => {
        if (event.keyCode === 13) {
            $('#search-bttn').click()
        }
    })

    $('#username, #password').keyup(e => {
        if (e.keyCode === 13) {
            $('#login-submit').click()
        }
    })

    $('.sorter').on('click', function () {
        const field = $(this).data('field') || ''
        let sort_type = $(this).data('sort_type') || 0

        sort_type += 1

        if (sort_type == 3) {
            sort_type = 0
        }

        $(this).data('sort_type', sort_type)

        const sorted = sortDate(dat.data_fetchList, sort_type, 'request_approve_datetime')
        console.log("sort_type", sort_type, sorted)


        showList(sorted)
    })
})

function sortDate(objects, sortType, key = 'request_approve_datetime') {
    const sortedArray = [...objects]; // create a copy of the original array

    sortedArray.sort((a, b) => {
        const dateA = a[key] ? new Date(a[key]) : new Date();
        const dateB = b[key] ? new Date(b[key]) : new Date();

        if (sortType == 1) {
            if (!a[key]) dateA.setDate(dateA.getDate() + 1);
            if (!b[key]) dateB.setDate(dateB.getDate() + 1);
        } else if (sortType == 2) {
            if (!a[key]) dateA.setDate(dateA.getDate() - 999);
            if (!b[key]) dateB.setDate(dateB.getDate() - 999);
        }

        if (sortType == 1) {
            $('.no_sort').hide()
            $('.sort_date').show()
            $('.sort_date').css('transform', 'rotate(90deg)')
            return dateA - dateB;
        } else if (sortType == 2) {
            $('.no_sort').hide()
            $('.sort_date').show()
            $('.sort_date').css('transform', 'rotate(-90deg)')
            return dateB - dateA;
        } else {
            // default case: no sorting
            $('.sort_date').hide()
            $('.no_sort').show()
            return 0;
        }
    });

    return sortedArray;
}

function blockUI() {
    var login_div = `<div id="login-div" style="padding:10px">
                        <div style="font-size:14px;font-weight:bold">Username</div>
                        <div style="margin-bottom:10px"><input id="username"></div>
                        <div style="font-size:14px;font-weight:bold">Password</div>
                        <div style="margin-bottom:10px"><input id="password" type="password"></div>
                        <div><button id="login-submit">Log in</div>
                </div>`
    $.blockUI({
        overlayCSS: { cursor: "default" },
        css: {
            cursor: "default",
            padding: '15px',
            margin: 'auto',
            top: '20%',
            width: '250px',
            left: '42%',
            border: 'none',
            backgroundColor: '#E0F0F7',
            '-webkit-border-radius': '15px',
            '-moz-border-radius': '15px',
            opacity: 1,
            color: '#000000',
        }, message: login_div
    })
}

function login() {
    var username = $('#username').val()
    var password = $('#password').val()
    $.ajax({
        url: `${node_api}/user/login`,
        type: 'POST',
        data: JSON.stringify({ username, password, estimate_type: 'packaging' }),
        contentType: 'application/json',
        dataType: 'json',
        cache: false,
        beforeSend: function () { },
        success: function (res) {
            console.log("res", res)
            if (res.isPassed == 1) {
                const checkAuth = res?.roles?.some(role => role.authorized)
                if (checkAuth) {
                    const { roles, data: emp_data, accessToken, refreshToken } = res || {}
                    const {
                        emp_id, emp_name
                    } = emp_data[0] || {}

                    const data = {
                        emp_id,
                        emp_name,
                        roles,
                        user_group_id: roles?.map(role => role.user_group_id),
                        sale_group_id: roles?.map(role => role.sale_group_id),
                        enable_price_check: roles.some(role => role.enable_price_check),
                        is_super_admin: roles.some(role => role.is_super_admin),
                    }

                    // เก็บข้อมูลผู้ใช้
                    localStorage.setItem("data", JSON.stringify(data))

                    // เก็บ tokens
                    if (accessToken) {
                        localStorage.setItem("accessToken", accessToken)
                    }
                    if (refreshToken) {
                        localStorage.setItem("refreshToken", refreshToken)
                    }

                    // เรียก API เพื่อเซ็ต cookies
                    $.ajax({
                        url: '/set-cookie',
                        type: 'POST',
                        data: {
                            emp_id: emp_id,
                            accessToken: accessToken,
                            refreshToken: refreshToken
                        },
                        success: function () {
                            console.log("Cookies set successfully")
                            console.log("data", data)
                            showLogin(data)
                            $.unblockUI();
                            var url = localStorage.getItem("url")
                            if (url) {
                                window.location = '/' + url
                                localStorage.removeItem("url")
                            } else {
                                // redirect ไปหน้าแรกเพื่อให้ middleware ทำงาน
                                window.location = '/'
                            }
                        },
                        error: function () {
                            console.error('Failed to set cookies')
                            alert('เกิดข้อผิดพลาดในการตั้งค่า session')
                        }
                    });
                } else {
                    alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้')
                    $('#username,#password').val("")
                }
            } else {
                alert('User name หรือ Password ไม่ถูกต้อง')
                $('#password').val("")
            }
        },
        error: function () {
            console.log('POST Login ERROR')
        }
    })
}

function logout() {
    localStorage.removeItem("data")
    localStorage.removeItem("accessToken")
    localStorage.removeItem("refreshToken")
    window.location = '/logout'
}

function showLogin(data) {
    $('#right-menu').show()
    $('#name').text(data.emp_name)
}

function fetchlastest50record(user_group_id, sale_group_id) {
    $.ajax({
        url: `${node_api}/estimate/list`,
        type: 'POST',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem("accessToken")}`
        },
        data: JSON.stringify({
            limit: 50,
            user_group_id,
            sale_group_id,
            est_type: 'packaging'
        }),
        dataType: 'json',
        cache: false,
        contentType: 'application/json',
        beforeSend: async function () {
            $('#list tbody').html('<tr><td colspan="10"><div style="width:100%;text-align:center;font-size:20px"><i class="fa fa-spinner fa-pulse"></i> Loading</div></td></tr>')
        },
        success: async function (res) {
            console.log("res", res)
            const data = [
                ...res[0]?.map(obj => ({
                    ...obj,
                    log_data: JSON.parse(obj?.log_data || '{}')
                })),
            ]

            showList(data)
            storeDataList(data)
            exportData = res[1]
        },
        error: function () {
            console.log('get the 50 lastest RFQ error')
        }
    })
}

function search(status) {
    var job_id = $('#jobid').val().trim()
    var job_name = $('#jobName').val().trim()
    var ae_name = $('#ae').val().trim()
    var customer_name = $('#customer').val().trim()
    var fromDate = $('#fromDate').val()
    var toDate = $('#toDate').val()
    var is_profit_sharing = $('#slc-profit_sharing').val()
    var user_group_id = (JSON.parse(localStorage.getItem("data"))).user_group_id
    var sale_group_id = (JSON.parse(localStorage.getItem("data"))).sale_group_id

    const obj = {
        job_id,
        job_name,
        ae_name,
        customer_name,
        status_id: status,
        start_date: fromDate ? moment(fromDate, 'DD/MM/YYYY').format('YYYY-MM-DD') : '',
        end_date: toDate ? moment(toDate, 'DD/MM/YYYY').format('YYYY-MM-DD') : '',
        is_profit_sharing
    }

    let check = [job_id, job_name, ae_name, customer_name, status]

    if (check.every(val => val == '') && (!obj?.start_date || !obj?.end_date)) {
        snackAlert('กรุณาระบุวันที่ค้นหา')
        return false
    }

    $.ajax({
        url: `${node_api}/estimate/list`,
        type: 'POST',
        data: JSON.stringify({
            limit: 500,
            user_group_id,
            sale_group_id,
            est_type: 'packaging',
            search: {
                ...obj
            }
        }),
        dataType: 'json',
        cache: false,
        contentType: 'application/json',
        beforeSend: async function () {
            $('.no_of_rows').html('....')
            $('#list tbody').html('<tr><td colspan="10"><div style="width:100%;text-align:center;margin-top:18px;font-size:20px"><i class="fa fa-spinner fa-pulse"></i> Loading</div></td></tr>')
        },
        success: async function (res) {
            const data = [
                ...res[0]?.map(obj => ({
                    ...obj,
                    log_data: JSON.parse(obj?.log_data || '{}')
                })),
            ]

            console.log("converted data", data)
            showList(data)
            storeDataList(data)
            exportData = res[1]
            // setDataExcel(res[1])
        },
        error: function () {
            console.log('get search RFQ error')
        }
    })
}

function showList(list) {
    var tr = ""
    if (list.length > 0) {
        $('.no_of_rows').html(list.length || '-')

        list.forEach((item, index) => {
            const req_approve_datetime = item?.request_approve_datetime ?
                moment(item?.request_approve_datetime, 'YYYY-MM-DD hh:mm:ss').format('DD/MM/YYYY HH:mm') + '<br>' + `<span class="request_approve_by">${item?.request_by}</span>`
                : '-'

            tr += `<tr job-id="${item.job_id}">
                    <td class="job_id_td" style="">${item.job_id}${item?.ref_copy_rfq ? `<br><span class="ref_copy_rfq_td">${item?.ref_copy_rfq || ''}</span>` : ''}</td>
                    <td class="job_name_td" style="">${item.job_name}</td>
                    <td class="created_by_name_td" style="">${item?.created_by || '-'}</th>
                    <td class="ae_name_td" style="">${item.ae_name}</th>
                    <td class="customer_name_td" style="">${item.customer_name}</td>
                    <td class="job_qty_td" style="text-align:left;">${item.job_qty || "-"}</td>

                    <td class="request_for_approve_date_td" style="text-align:center;">${req_approve_datetime || "-"}</td>

                    <td class="profit_sharing_td" style="text-align:center;">${item?.is_profit_sharing || "No"}</td>
                    <td class="approve_status_td" style="text-align:center;">${item?.approve_status || "-"}</td>
                    <td class="estimator_name_td" style="text-align:center;">${item.estimator_name || '-'}</td>
                </tr>`
        })
    } else {
        tr += `
        <tr>
            <td colspan="9" class="text-center w-100">
                <span>----- ไม่พบข้อมูล -----</span>
            </td>
        </tr>
        `

    }

    $('#table-list tbody').html(tr)
    $('#table_rfq tbody').html(tr)
}

function menuList(job_id) {
    var job_obj = (dat.data_fetchList.filter((item, index) => { return item?.job_id == job_id }))[0] || null

    if (!job_obj) {
        return false
    }

    const title_bar = `${job_obj?.job_name} / Team : ${job_obj?.team_name}`

    console.log("job_obj", job_obj)
    $('#docType').text('RFQ')
    $('#id_no').text(job_obj.job_id)
    $('#title_name').text(title_bar)
    $('#menu').show()

    const created_datetime = job_obj?.created_datetime ? moment(job_obj?.created_datetime, 'YYYY-MM-DD HH:mm:ss').format('DD/MM/YYYY HH:mm') : null
    const updated_datetime = job_obj?.updated ? moment(job_obj?.updated, 'YYYY-MM-DD HH:mm:ss').format('DD/MM/YYYY HH:mm') : null

    var div = `<table cellpadding="5">
                <tr><td style="width:120px;"><b>เลขที่ RFQ</b><td>${job_id}</td></tr>
                <tr><td><b>Binding</b></td><td>${job_obj?.log_data?.binding_name || "-"}</td></tr>
                <tr><td><b>ชื่องาน</b></td><td>${job_obj?.job_name || "-"}</td></tr>
                <tr><td><b>AE</b></td><td>${job_obj?.ae_name || "-"}</td></tr>
                <tr><td><b>Customer</b></td><td>${job_obj?.customer_name || "-"}</td></tr>
                <tr><td><b>ยอดงาน</b></td><td>${job_obj?.job_qty || "-"}</td></tr>
                <tr><td><b>Price</b></td><td>${job_obj?.total_price || "-"}</td></tr>
                <tr><td><b>Unit Price</b></td><td>${job_obj?.unit_price || "-"}</td></tr>
                <tr><td><b>Created by</b></td><td>${job_obj?.created_by || "-"}</td></tr>
                <tr><td><b>Create Date</b></td><td>${created_datetime || "-"}</td></tr>
                <tr><td><b>Last Edited by</b></td><td>${job_obj?.updated_by || "-"}</td></tr>
                <tr><td><b>Last Edited Date</b></td><td>${updated_datetime || "-"}</td></tr>
                <tr><td><b>Approve Status</b></td><td>${job_obj?.approve_status || "-"}</td></tr>
                <tr><td><b>MI Docs.</b></td><td>${job_obj?.mi_doc_id || '-'}</td></tr>
            </table>`
    $('#job_info').html(div)

    $('#edit').removeClass('disabled')

    if (job_obj?.mi_status_id == 1) {
        $('#edit').addClass('disabled')
    }
}

function closeMenu() {
    $('#menu').hide()
    $("#menu-accordion").accordion("refresh");
}

function accordion_div() {
    $('#menu-accordion').accordion({
        header: "h3",
        icons: { "header": "ui-icon-plus", "activeHeader": "ui-icon-minus" },
        heightStyle: "content",
        active: 0,
        // active: false,
        collapsible: true,
    });
}

function copyRFQ(job_id) {
    window.location = window.location = '/estimate?jobid=' + job_id + '&copy=1'
}

function getPricecheck(job_id) {
    var job_obj = (dat.data_fetchList.filter((item, index) => { return item.job_id == job_id }))[0]
    return job_obj.approved
}


async function exportDataExcel() {
    $(".export-loading").show()
    const check = await new Promise(async (res, rej) => {
        showExportExcel(exportData)
        await $("#export-rfq").tableExport({
            formats: ["xlsx"],
            sheetname: "report_rfq",
        })
        $("#export-bttn").click()
        res(true)
    }).then(_ => {

        return true
    })
    if (check === true) {
        $(".export-loading").hide()
    }
    // $("button, input, select").removeAttr("disabled")
}

function showExportExcel(res) {
    const rowHeader = `
        <tr class="export-header">
            <th>Created</th>
            <th>Est_ID</th>
            <th>Customer_Name</th>
            <th>Job_Name</th>
            <th>Created_by2</th>
            <th>AE_Name</th>
            <th>Approved_by</th>
            <th>Qty.</th>
            <th>Qty_Run_on</th>
            <th>Qty_Customer</th>
            <th>Qty_AE</th>
            <th>Total_Qty.</th>
            <th>Unit_price</th>
            <th>Total_price</th>
            <th>Loss Checked</th>
            <th>Loss</th>
            <th>Profit Sharing</th>
            <th>Remark</th>
            <th>Delivery Date</th>
            <th>Ref. Copy</th>

        </tr>
     `

    var rowData = ""
    res.forEach((item, index) => {
        const create_datetime = item.created_date_time || '-'
        rowData += `
        <tr>
                <td class="tableexport-string target">${create_datetime}</td>
                <td class="tableexport-string target">${item.job_id || '-'}</td>
                <td class="tableexport-string target">${item.customer_name}</td>
                <td class="tableexport-string target">${item.job_name || '-'}</td>
                <td class="tableexport-string target">${item.created_by || '-'}</td>
                <td class="tableexport-string target">${item.ae_name || '-'}</td>
                <td class="tableexport-string target">${item.estimator_name || '-'}</td>
                <td>${item.row_qty}</td>
                <td>${item.qty_runon}</td>
                <td>${item.qty_customer}</td>
                <td>${item.qty_ae}</td>
                <td>${item.row_total_qty}</td>
                <td>${item.row_unit_price}</td>
                <td>${item.row_total_price}</td>
                <td>${item?.is_loss ? 1 : 0}</td>
                <td>${item?.row_loss || 0}</td>
                <td>${item?.is_profit_sharing || ''}</td>
                <td class="tableexport-string target">${item.remark}</td>
                <td class="tableexport-string target">${item?.delivery_date ? moment(item?.delivery_date, 'YYYY-MM-DD').format('DD/MM/YYYY') : ''}</td>
                <td class="tableexport-string target">${item?.ref_copy_rfq || '-'}</td>
        </tr>
        `
    })
    $('#export-rfq thead').html(rowHeader)
    $('#export-rfq tbody').html(rowData)
}

function storeDataList(data_list) {
    data_list.forEach((item) => {
        var totalprice = (item.total_price?.split(',').map((x) => numeral(parseFloat(x)).format('0,0.00') + ' THB'))?.join(', ')
        var unitprice = (item.unit_price?.split(',').map((x) => numeral(parseFloat(x)).format('0,0.00') + ' THB'))?.join(', ')
        item.total_price = totalprice
        item.unit_price = unitprice
    })
    dat.data_fetchList = data_list

}