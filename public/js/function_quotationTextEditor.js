$(() => {
    console.log("Import : quotationTextEditorClass.js");

    addTextEditorModal()

    $('#modal-text-editor').dialog({
        autoOpen: false,
        modal: true,
        width: "100%",
        resizable: false,
        closeOnEscape: false,
        draggable: false,
        position: { my: "top", at: "top", of: window },
        open: () => {
            const modal = $('.ui-dialog[aria-describedby=modal-text-editor]')
            modal.find(".ui-dialog-titlebar").hide();
            modal.find(".ui-dialog-titlebar-close").hide();
        },
        beforeClose: async () => {
        },
        close: async () => {
            disabledScrolling(false)
        }
    })

    $('#issue_date, #select_validate_day').on('change', function () {
        setChangeIssuedDate()
    })

    $('#valid_date').on('change', function () {
        $('#select_validate_day').val('')
    })

    $('body').on('change', ('[name=job_info_type_id]'), function () {
        const type_id = parseInt($('[name=job_info_type_id]:checked').val())
        setChangeJobInfoTypeId(type_id)
    })

    $('body').on('click', ('textarea#job_info.is-modal'), function () {
        const jobInfo = $('#job_info').val()
        console.log("jobInfo", jobInfo)
        const textRows = jobInfo.split("\n")
        const textEditorData = []

        textRows?.forEach((row, rIndex) => {
            const rowData = row.replaceAll('\\n', '\n').split("\t")

            if (rowData?.length < 5) {
                for (let i = rowData?.length - 1; i < 5; i++) {

                    rowData.push('')
                }
            }

            textEditorData.push({
                row_id: genUniqueId(),
                text_item: rowData[0],
                text_spec: decodeURI(rowData[1]),
                text_colour: rowData[2],
                text_description: rowData[3],
                text_quantity: rowData[4],
            })
        })

        console.log("textEditorData", textEditorData)

        disabledScrolling(true)
        setTextEditorTable([])
        $('#modal-text-editor').dialog('open')
        setTextEditorTable(textEditorData)

        checkFormEnabled()
    })

    $('body').on('click', ('#text-editor-add-row'), function () {
        const rowId = genUniqueId()

        const data = []

        data.push([rowId, '', '', '', '', ''])

        $('#tb-text-editor')?.DataTable()?.row.add(data).draw();
    })

    $('body').on('click', ('.text-editor-delete-row'), function () {
        var row = $(this).closest('tr');

        $('#tb-text-editor')?.DataTable()?.row(row).remove().draw();
    })

    $('#text-editor-save').on('click', async function () {
        const isConfirm = confirm('คุณต้องการ"บันทึกข้อมูล"นี้ใช่หรือไม่ ?')

        if (!isConfirm) return false

        console.log("$('#tb-text-editor tbody')", $('#tb-text-editor tbody'))
        const info = []

        await $('#tb-text-editor tbody tr').each(function (index, ele) {
            const tr = $(ele)
            const rowSpec = (tr?.find('td:eq(2) textarea')?.val()?.trim() || '').replaceAll('\n', '\\n')
            console.log("tr", tr)

            const row = [
                tr?.find('td:eq(1) input')?.val()?.trim() || '',
                rowSpec,
            ]

            const item3 = tr?.find('td:eq(3) input')?.val()?.trim()
            const item4 = tr?.find('td:eq(4) input')?.val()?.trim()
            const item5 = tr?.find('td:eq(5) input')?.val()?.trim()

            if (item5 != '') {
                row.push(item3, item4, item5)
            } else if (item4 != '') {
                row.push(item3, item4)
            } else if (item3 != '') {
                row.push(item3)
            }

            info.push(row?.join('\t') + '\n')
        })

        console.log("info", info)
        $('#job_info').val(info?.join(''))

        $('#modal-text-editor').dialog('close')
    })

    $('#text-editor-close').on('click', function () {
        const isConfirm = confirm('คุณต้องการ"ปิด"หน้าต่างนี้ใช่หรือไม่ ?')

        if (!isConfirm) return false

        $('#modal-text-editor').dialog('close')
    })
})

function getRowData(index) {
    const tr = $(`#tb-text-editor tbody tr:eq(${index})`)
    const rowSpec = (tr?.find('td:eq(2) textarea')?.val()?.trim() || '')
    console.log("tr", tr)

    const row = [
        tr?.find('td:eq(1) input')?.val()?.trim() || '',
        rowSpec,
    ]

    const item3 = tr?.find('td:eq(3) input')?.val()?.trim()
    const item4 = tr?.find('td:eq(4) input')?.val()?.trim()
    const item5 = tr?.find('td:eq(5) input')?.val()?.trim()

    if (item5 != '') {
        row.push(item3, item4, item5)
    } else if (item4 != '') {
        row.push(item3, item4)
    } else if (item3 != '') {
        row.push(item3)
    }

    return {
        arrayData: row,
        objData: {
            text_item: row[0],
            text_spec: row[1],
            text_colour: row[2],
            text_description: row[3],
            text_quantity: row[4],
        }
    }
}

function setChangeJobInfoTypeId(type_id = 1) {
    const jobInfo = $('#job_info')

    console.log("change type")
    $(`[name=job_info_type_id][value=${type_id}]`).prop('checked', true)

    $('#select_validate_day').val('')

    if (type_id == 2) {
        $('#ae_name').val(dat?.data_rfq_log?.ae_name_eng || dat?.data_rfq_log?.ae_name)
        $('#valid_date').prop('readonly', true)?.prop('disabled', true).val('')
        jobInfo.prop('readonly', true)?.attr('title', 'คลิกเพื่อแก้ไขข้อมูล')?.addClass('pointer is-modal')
    } else {
        $('#ae_name').val(dat?.data_rfq_log?.ae_name)
        $('#valid_date').prop('readonly', false)?.prop('disabled', false).val('')
        jobInfo.prop('readonly', false)?.attr('title', '')?.removeClass('pointer is-modal')
    }

    jobInfo.val(jobInfoType.data[type_id - 1])
}

function setTextEditorTable(data = []) {
    var tableHeight = $(window).height() - 200  // Adjust the 20px based on your page layout

    var table = $('#tb-text-editor')?.DataTable()

    table = $('#tb-text-editor')?.DataTable()?.destroy();
    table = $('#tb-text-editor')?.DataTable({
        responsive: true,
        paging: false,
        createdRow: function (row, data, dataIndex) { },
        columns: [
            {
                data: 'row_id',
                className: 'text-center',
                align: 'center',
            },
            {
                data: 'row_id',
                className: 'text-center',
                align: 'center',
                visible: false,
            },
            {
                data: 'text_item',
                className: 'text-left',
                align: 'left',
            },
            {
                data: 'text_spec',
                className: 'text-left',
                align: 'left',
            },
            {
                data: 'text_colour',
                className: 'text-left',
                align: 'left',
            },
            {
                data: 'text_description',
                className: 'text-left',
                align: 'left',
            },
            {
                data: 'text_quantity',
                className: 'text-left',
                align: 'left',
            },
        ],
        columnDefs: [
            {
                targets: [0],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<span class="text-editor-delete-row button" data-id="${data}">ลบ</span>`;

                },
                width: '4%'
            },
            {
                targets: [1],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<i class="fa fa-arrows" style="font-size: 18px;color:#cfcfcf;"></i>`;
                },
                width: '2%'
            },
            {
                targets: [2],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<input class="w-100 text_item" value="${data || ''}" description="Items"/>`;
                },
                width: '15%'
            },
            {
                targets: [3],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<textarea class="w-100 text_spec" description="Items" rows="1">${data || ''}</textarea>`;
                },
                width: '55%'
            },
            {
                targets: [4],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<input class="w-100 text_colour" value="${data || ''}" description="Colour"/>`;
                },
                width: '8%'
            },
            {
                targets: [5],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<input class="w-100 text_description" value="${data || ''}" description="Description"/>`;
                },
                width: '8%'
            },
            {
                targets: [6],
                searchable: false,
                orderable: false,
                render: function (data, type, row, meta) {
                    return `<input class="w-100 text_qty" value="${data || ''}" description="Qty."/>`;
                },
                width: '8%'
            },
        ],
        data: data,
        searching: false,
        className: 'stripe',
        scrollY: tableHeight,
        info: false,
        order: []
    })


    $('#tb-text-editor').sortable({
        items: 'tr',            // Make rows draggable
        cursor: 'move',         // Set cursor to move
        helper: fixWidthHelper, // Helper function for width consistency
        start: function (e, ui) {
            // Store the original position
            ui.item.data('start_index', ui.item.index());
        },
        update: function (event, ui) {
            // Preserve the updated order in DataTable
            var rows = $('#tb-text-editor tbody tr');
            var newOrder = [];
            rows.each(function (index) {
                const { objData } = getRowData(index)
                // var rowData = table.row(this).data();
                // console.log("rowData", index, data, rowData)
                newOrder.push(objData); // Collect the new row order
            });

            // Clear the table and reinsert rows in the new order
            table.clear();
            table.rows.add(newOrder).draw();
        }
    }).disableSelection();

}

// Helper function to keep column width consistent
function fixWidthHelper(e, ui) {
    ui.children().each(function () {
        $(this).width($(this).width());
    });
    return ui;
}

function disabledScrolling(bool = false) {
    if (bool) {
        $('body').addClass('prevent-scroll')
    } else {
        $('body').removeClass('prevent-scroll')
    }
}

function genUniqueId() {
    return `${moment().valueOf()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
}

function addTextEditorModal(selector = $('body')) {
    selector.append(`
    <div id="modal-text-editor" class="modal">
        <!-- <i id="close-modal" class="fa fa-close"></i> -->
        <div id="text-editor-wrapper">
            <div id="text-editor-title">
                <h2>แก้ไขรายละเอียด</h2>
                <button id="text-editor-add-row">เพิ่มแถว <i class="fa fa-plus-circle" style="font-size: 20px;"></i></button>
            </div>
            <table id="tb-text-editor" class="display table hover stripe cell-border row-border compact">
                <thead>
                    <th>Delete</th>
                    <th>Move</th>
                    <th>Items</th>
                    <th>Specifications</th>
                    <th>Colour</th>
                    <th>Description</th>
                    <th>Quantity</th>
                </thead>
                <tbody>

                </tbody>
                <tfoot>
                    <th colspan="7" class="text-center">
                        <button id="text-editor-save">บันทึก</button>
                        <button id="text-editor-close">ปิด</button>
                    </th>
                </tfoot>
            </table>
        </div>
    </div>`)
}