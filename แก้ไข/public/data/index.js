const binding_type = [
    { id: 1, name: 'Folded brochure', },
    { id: 2, name: 'Leaflet', },
    { id: 3, name: 'Saddle stitch', },
    { id: 4, name: 'Perfect bound', },
    { id: 5, name: 'Limp bound', },
    { id: 6, name: 'Hard cover book', },
    { id: 7, name: 'Wire-O book', },
    { id: 8, name: 'Spiral bound book', },
    { id: 9, name: 'Flexi bound book', },
    { id: 10, name: 'Board book', },
    { id: 11, name: 'Singer sewn' },
    { id: 14, name: 'Desk Calendar' },
]

const mainComponentCustomProcess = [
    {
        name: 'Other Process',
        row_label: 'Process',
        data_key: 'other_process',
        input_type: 'text', //* text , file,
        data_type: 'process',
        display: {
            price: true,
            qty: false,
        },
        process_id: 100,
    },
    {
        name: 'Handwork Process',
        row_label: 'Process',
        data_key: 'handwork',
        input_type: 'text', //* text , file,
        data_type: 'process',
        display: {
            price: true,
            qty: false,
        },
        process_id: 101,
    },
    {
        name: 'Outsource',
        row_label: 'Outsource',
        data_key: 'outsource',
        input_type: 'text', //* text , file,
        data_type: 'process',
        display: {
            price: true,
            qty: true,
        },
        process_id: 102,
    },
    {
        name: 'Materials',
        row_label: 'Material',
        data_key: 'material',
        input_type: 'text', //* text , file,
        data_type: 'material',
        display: {
            price: true,
            qty: true,
        },
        process_id: 103,
    },
    {
        name: 'Other',
        row_label: 'Other',
        data_key: 'other_material',
        input_type: 'text', //* text , file,
        data_type: 'material',
        display: {
            price: true,
            qty: true,
        },
        process_id: 104,
    },
    {
        name: 'Shipping',
        row_label: 'Shipping',
        data_key: 'shipping',
        input_type: 'text', //* text , file,
        data_type: 'extend',
        display: {
            price: true,
            qty: false,
        },
        process_id: 106,
    },
    {
        name: 'Attach File',
        row_label: '',
        data_key: 'attach_file',
        input_type: 'file', //* text , file
        data_type: 'file',
        display: {
            price: false,
            qty: false,
        },
        process_id: 105,
    },
]

const master_process = [
    { id: 1, name: 'Trim' },
    { id: 2, name: 'Die-cut' },
    { id: 3, name: 'Score' },
    { id: 4, name: 'Perforate' },
    { id: 5, name: 'Insert' },
    { id: 6, name: 'Gatefold' },
    { id: 7, name: 'Drill' },
    { id: 8, name: 'Folding' },
    { id: 9, name: 'ใช้ร่วมกันทุกหน้า' },
    { id: 10, name: 'Coating' },
    { id: 11, name: 'Foilstamp' },
    { id: 12, name: 'Emboss' },
    { id: 13, name: 'Deboss' },
]

var MAIN_DATA = {
    web_printing_conditions: {
        max_paper_gram: 130
    },
    inter_paper_size: [
        { name: 'A5', size: [210, 148, 8.3, 5.8] },
        { name: 'A4', size: [297, 210, 11.7, 8.3] },
        { name: 'A3', size: [297, 420, 11.7, 16.5] },
        { name: 'A2', size: [420, 594, 16.5, 23.4] },
    ],
    master_process_ids: [
        { process_id: 1, name: 'trim' },
        { process_id: 2, name: 'die_cut' },
        { process_id: 3, name: 'score' },
        { process_id: 4, name: 'perforate' },
        { process_id: 5, name: 'drill' },
        { process_id: 6, name: 'insert' },
        { process_id: 7, name: 'gatefold' },
        { process_id: 8, name: 'folding' },
        { process_id: 9, name: 'apply_all_pages' },

        { process_id: 10, name: 'round_corner' },
        { process_id: 11, name: 'shrink_wrap' },
        { process_id: 12, name: 'chop' },
        { process_id: 13, name: 'duplicate_file' },
        { process_id: 14, name: 'pallet_purify' },
        { process_id: 15, name: 'flap' },
        { process_id: 16, name: 'chop_polybag' },
        { process_id: 17, name: 'chop_polywrap' },

        { process_id: 18, name: 'extract' },
        // * เจาะรู ปกแข็ง
        { process_id: 19, name: 'drill_solid' },
        // * เจาะรู กระดาษทั่วไป
        { process_id: 20, name: 'drill_normal' },
        { process_id: 21, name: 'insert_slipcase' },
        { process_id: 22, name: 'end_sheet' },
        { process_id: 23, name: 'jacket' },
        { process_id: 24, name: 'binding_pur' },
        { process_id: 25, name: 'binding_cover' },
        { process_id: 26, name: 'ht_band' },
        { process_id: 27, name: 'saddle_stitch' },
        { process_id: 28, name: 'singer_sewn' },
        { process_id: 29, name: 'sewn' },

        { process_id: 30, name: 'collate' },
        { process_id: 31, name: 'collate_couple' },
        { process_id: 32, name: 'glued_liner' },
        { process_id: 33, name: 'insert_sub_sig' },
        { process_id: 34, name: 'cover_drawn_on' },
        //* ---------
        { process_id: 35, name: 'coating' },
        { process_id: 36, name: 'foilstamp' },
        { process_id: 37, name: 'emboss' },
        { process_id: 38, name: 'deboss' },

        { process_id: 39, name: 'Paperband' },
        { process_id: 40, name: 'Kraftwrap' },
        { process_id: 41, name: 'Carton' },
        { process_id: 42, name: 'Pallet' },
        //* ---------
        { process_id: 43, name: 'pull_sub_sig' },
        { process_id: 44, name: 'final_trim' },
        { process_id: 45, name: 'separator_counting' },
        { process_id: 46, name: 'folding_cover_with_flap' },
        { process_id: 47, name: 'grooving' },
        { process_id: 48, name: 'case_making' },
        { process_id: 49, name: 'case_in' },

        { process_id: 50, name: 'wire_o_binding' },
        { process_id: 51, name: 'spiral_bound_binding' },

        { process_id: 52, name: 'folded_brochure_folding' },
        { process_id: 53, name: 'book_folding' },
        { process_id: 54, name: 'board_book_folding' },
        { process_id: 55, name: 'board_book_collate' },
        { process_id: 56, name: 'board_book_glued' },
        { process_id: 57, name: 'board_book_glue' },
        { process_id: 58, name: 'slipcase_making' },
        { process_id: 59, name: 'slipcase_rigid_making' },

        { process_id: 60, name: 'delivery' },
        { process_id: 61, name: 'pack_separator' },

        { process_id: 62, name: 'loop_binding' },

        { process_id: 100, name: 'other_process' },
        { process_id: 101, name: 'handwork' },
        { process_id: 102, name: 'outsource' },
        { process_id: 103, name: 'material' },
        { process_id: 104, name: 'other_material' },
        { process_id: 105, name: 'attach_file' },
        { process_id: 106, name: 'shipping' },

        // * calendar
        { process_id: 107, name: 'calendar_trim' },
        { process_id: 108, name: 'calendar_collate' },
        { process_id: 109, name: 'calendar_drill_hole' },
        { process_id: 110, name: 'calendar_easel' },
        { process_id: 111, name: 'calendar_wire_o_bound' },
        { process_id: 112, name: 'calendar_footer_folded' },
    ],
    addon: {
        foilstamp: {
            labor_unit_price: 0.5, //*THB/sheet
            //ยิงฟิล์ม foil stmamp, bossing
            film_rate: 1.25, //THB/sqinch
            film_min_cost: 120,

            //foil stamp
            foil_width_tolerance: 0.5, //inch
            foil_length_tolerance: 1,	//inch
            // foilstamp_price: 0.5, //THB/sheet ค่าแรง foilstamp
            block_foilstamp_min_cost: 70, //THB/ตัว
        },
        bossing: {
            block_min_cost: 70,
            labor_unit_price: 0.5, //*THB/sheet
            bossing_price: 0.8, //THB/sheet ค่าแรง ปั๊มจม ปั๊มนูน
            film_rate: 1.25, //THB/sqinch
            film_min_cost: 120,
        },
        acetate: {
            labor_unit_price: 1.5, // THB/sheet
        }
    },
    max_qty: 10,
    job_info: {
        job_type: [
            { id: 1, name: 'งานใหม่' },
            { id: 2, name: 'งาน Reprint' }
        ],
        ink_type: [
            { id: 1, name: 'ธรรมดา' },
            { id: 2, name: 'UV' }
        ],
        print_type: [
            { id: 1, name: 'Offset' }
        ],
    },
    template: [
        { id: 1, name: 'Folded brochure', },
        { id: 2, name: 'Leaflet', },
        { id: 3, name: 'Saddle stitch', },
        { id: 4, name: 'Perfect bound', },
        { id: 5, name: 'Limp bound', },
        { id: 6, name: 'Hard cover book', },
        { id: 7, name: 'Wire-O book', },
        { id: 8, name: 'Spiral bound book', },
        { id: 9, name: 'Flexi bound', },
        { id: 10, name: 'Board book', },
        { id: 11, name: 'Singer sewn' },
        { id: 14, name: 'Desk Calendar' },
    ],
    main_component: [
        { id: 1, name: 'Book' },
        { id: 2, name: 'Custom' },
        { id: 3, name: 'Other' },
    ],
    sub_component: [
        { id: 1, name: 'Cover' },
        { id: 2, name: 'Text' },
        { id: 3, name: 'Liner' },
        { id: 4, name: 'End Sheet' },
        { id: 5, name: 'Spine' },
        { id: 6, name: 'Board' },
        { id: 7, name: 'Jacket' },
        { id: 8, name: 'Custom' },
        { id: 9, name: 'Sticker' },
        { id: 10, name: 'Spacer' },
        { id: 11, name: 'Folded Brochure' },
        { id: 12, name: 'Wrap' },
        { id: 13, name: 'Lid : Wrap' },
        { id: 14, name: 'Lid : Liner' },
        { id: 15, name: 'Lid : Board' },
        { id: 16, name: 'Base : Wrap' },
        { id: 17, name: 'Base : Liner' },
        { id: 18, name: 'Base : Board' },
        { id: 19, name: 'Insert' },
        { id: 20, name: 'Board (ขาตั้ง)' },
        { id: 21, name: 'Board (ฐานขาตั้ง)' },
        { id: 22, name: 'ใบหุ้มขาตั้ง (หุ้มนอก)' },
        { id: 23, name: 'Liner (หุ้มใน)' },
    ],
    other_type: [
        { id: 1, name: 'Hard Slipcase' },
        { id: 2, name: 'Soft Slipcase' },
        { id: 3, name: 'Rigid Box' },
    ],
    jacket_type: [
        { id: 1, name: 'Normal' },
        { id: 2, name: 'French Fold' },
    ],
    delivery_type: [
        { id: 1, name: 'ในประเทศ' },
        { id: 2, name: 'ต่างประเทศ' },
    ],
    folding_type: [
        { id: 1, name: 'Single Fold', pages: 1, folding: 1, panels: 2, layer: 2, img_path: '/images/fold/1.png' },
        { id: 2, name: 'Standard/Roll Fold 3 Panels', pages: 2, folding: 2, panels: 3, layer: 3, img_path: '/images/fold/2.png' },
        { id: 3, name: 'Gate fold', pages: 2, folding: 2, panels: 3, layer: 2, img_path: '/images/fold/3.png' },
        { id: 4, name: 'Concertina Fold 3 Panels', pages: 2, folding: 2, panels: 3, layer: 3, img_path: '/images/fold/4.png' },
        { id: 5, name: 'Double Parallel Fold', pages: 2, folding: 2, panels: 4, layer: 4, img_path: '/images/fold/5.png' },
        { id: 6, name: 'Right Angle/French Fold', pages: 2, folding: 2, panels: 2, layer: 4, img_path: '/images/fold/6.png', img_path2: '/images/fold/6_width.png' },

        { id: 7, name: 'Concertina Fold 4 Panels', pages: 8, folding: 3, panels: 4, layer: 4, img_path: '/images/fold/7.png' },
        { id: 8, name: 'Parallel Over & Outer Fold/Roll Fold 4 Panels', pages: 8, folding: 3, panels: 4, layer: 4, img_path: '/images/fold/8.png' },
        { id: 9, name: 'Double Gate Fold', pages: 8, folding: 3, panels: 4, layer: 4, img_path: '/images/fold/9.png' },
        { id: 10, name: 'Parallel Map Fold', pages: 8, folding: 3, panels: 4, layer: 4, img_path: '/images/fold/10.png' },
        { id: 11, name: 'Reverse Map Fold', pages: 8, folding: 3, panels: 4, layer: 4, img_path: '/images/fold/11.png' },
        { id: 12, name: 'Concertina Fold 5 Panels', pages: 10, folding: 4, panels: 5, layer: 5, img_path: '/images/fold/12.png' },
        { id: 13, name: 'Parallel Over & Outer Fold/Roll Fold 5 Panels', pages: 10, folding: 4, panels: 5, layer: 5, img_path: '/images/fold/13_length.png', img_path2: '/images/fold/13_width.png' },
        { id: 14, name: 'Parallel with roll Fold', pages: 12, folding: 3, panels: 3, layer: 6, img_path: '/images/fold/14_length.png', img_path2: '/images/fold/14_width.png' },

        { id: 15, name: 'Parallel triple Fold', pages: 12, folding: 3, panels: 6, layer: 6, img_path: '/images/fold/15.png' },
        { id: 16, name: 'Parallel with concertina Fold', pages: 16, folding: 4, panels: 4, layer: 8, img_path: '/images/fold/16_length.png', img_path2: '/images/fold/16_width.png' },
        { id: 17, name: 'Parallel quad Fold', pages: 16, folding: 4, panels: 8, layer: 8, img_path: '/images/fold/17.png' },
        { id: 18, name: 'Custom', is_custom: true, pages: null, folding: null, panels: null, layer: 2, img_path: '/images/fold/custom.png' },
    ],
    folding_side: [
        { id: 1, name: 'กว้าง' },
        { id: 2, name: 'ยาว' }
    ],
    main_process: [
        { id: 10, name: 'Round Corner', corner: true, film: false, post: false },
        { id: 11, name: 'Shrink wrap', corner: false, film: true, post: true },
        { id: 12, name: 'Chop', corner: false, film: false, post: false },
        { id: 13, name: 'Duplicate File', corner: false, film: false, post: false },
        { id: 14, name: 'อบน้ำยา Pallet', corner: false, film: false, post: false },
        { id: 15, name: 'Flap', corner: false, film: false, post: false },
        {
            id: 16, name: 'Chop Polybag', corner: false, film: false, post: true, prev_process: 12, custom_process: [
                {
                    name: 'Chop Polybag',
                    custom_type: 'material',
                    from_process: 'main_process_chop_polybag',
                    readonly: true,
                    disabled_editing: false,
                    is_fixed_price: true,
                    is_fixed_qty: true,
                    price: [],
                    qty: [],

                }
            ]
        },
        {
            id: 17, name: 'Chop Poly wrap', corner: false, film: false, post: true, prev_process: 12, custom_process: [
                {
                    name: 'Chop Poly wrap',
                    custom_type: 'material',
                    from_process: 'main_process_chop_polywrap',
                    readonly: true,
                    disabled_editing: false,
                    is_fixed_price: true,
                    is_fixed_qty: true,
                    price: [],
                    qty: [],

                }
            ]
        },
    ],
    shrink_wrap_thickness: [
        { id: 1, name: '12 mic.' },
        { id: 2, name: '15 mic.' },
        { id: 3, name: '19 mic.' },
        { id: 4, name: '25 mic.' },
    ],
    chop_type: [
        { id: 1, name: 'Polybag' },
        { id: 2, name: 'Poly wrap' },
    ],
    chop_material: [
        { id: 1, name: 'Sticker' },
        { id: 2, name: 'กระดาษต่อเนื่อง' }
    ],
    special_ink: {
        ink_type: [
            { id: 1, name: 'หมึกพิเศษธรรมดา' },
            { id: 2, name: 'หมึกเมทัลลิค' },
            { id: 3, name: 'หมึกสะท้อนแสง' },
            { id: 4, name: 'หมึกทนแดด' },
            { id: 5, name: 'หมึก UV' },
        ],
        filling_style: [
            { id: 1, name: 'solid', name_th: 'ตีพื้น' },
            { id: 2, name: 'stripe', name_th: 'ลายเส้น' },
        ]
    },
    process: [
        { id: 1, name: 'Trim' },
        { id: 2, name: 'Die - cut' },
        { id: 3, name: 'Score' },
        { id: 4, name: 'Perforate' },
        { id: 5, name: 'Drill' },
        { id: 6, name: 'Insert', type: [{ id: 0, name: 'แทรกลอย' }, { id: 1, name: 'ติดเทปกาว' }] },
        { id: 7, name: 'Gatefold', pages: [{ id: 0, name: 6 }, { id: 1, name: 8 }] },
        { id: 8, name: 'Folding' },
        {
            id: 9,
            name: 'เหมือนกันทุกหน้า',
            type: [
                {
                    id: 1,
                    name: 'Artwork หน้า-หลัง เหมือนกัน'
                }, {
                    id: 2,
                    name: 'Artwork หน้า-หลัง ต่างกัน'
                }
            ]
        },
    ],
    paper: {
        print_type: [
            {
                id: 1,
                name: 'Sheet'
            },
            {
                id: 2,
                name: 'Web'
            }
        ],
        // marking_percent: {
        //     local: 10, //* update : 25.01.24 from 7 -> 10
        //     import: 13 //* update : 25.01.24 from 10 -> 13
        // },
        roll_cut_price: 1.2 //* THB
    },
    marking_price: {
        current: 'normal',
        rate: {},
        profit: { //* profit sharing
            marking_price: {
                paper_local_percent: 18, //* Percentage
                paper_import_percent: 18, //* Percentage
                material_percent: 25, //* Percentage
                plate_price: 1875, //* THB/color
                // print_price: 0.14, //* THB/sheet/color
                // print_min_price: 1400, //* THB
                after_press_percent: 20, //* Percentage
                other_percent: 25, //* Percentage
                packing_percent: 25, //* Percentage
                delivery_percent: 20, //* Percentage
                print: {
                    web: {
                        min_qty: 10000,
                        min_price: 1400, //* per color 700 -> 1,000 Update: 29.02.24 -> 900 Update: 01.04.24
                        price_rate: 0.14,

                    },
                    sheet: {
                        min_qty: 10000,
                        min_price: 1400, //* per color 700 -> 1,000 Update: 29.02.24 -> 900 Update: 01.04.24
                        price_rate: 0.14,

                    },
                }
            },
        },
        normal: {
            marking_price: {
                paper_local_percent: 10, //* Percentage
                paper_import_percent: 13, //* Percentage
                material_percent: 0, //* Percentage
                plate_price: 900, //* THB/color
                // print_price: 0, //* THB/sheet/color
                // print_min_price: 0, //* THB
                after_press_percent: 0, //* Percentage
                other_percent: 0, //* Percentage
                packing_percent: 0, //* Percentage
                delivery_percent: 0, //* Percentage
                print: {
                    web: {
                        min_qty: 10000,
                        min_price: 750, //* per color 700 -> 1,000 Update: 29.02.24 -> 900 Update: 01.04.24
                        price_rate: 0.075, //* THB/ใบพิมพ์ 0.07 -> 0.10 Update: 29.02.24 -> 0.09 Update: 01.04.24

                    },
                    sheet: {
                        min_qty: 10000,
                        min_price: 900, //* per color 700 -> 1,000 Update: 29.02.24 -> 900 Update: 01.04.24
                        price_rate: 0.09, //* THB/ใบพิมพ์ 0.07 -> 0.10 Update: 29.02.24 -> 0.09 Update: 01.04.24

                    },
                }
            }
        },
        setRate: function (rateName) {
            this.current = rateName;
            this.rate = this[rateName];
        },
        getRate: function () {
            return this.rate?.marking_price
        }
    },
    cover_type: [
        { id: 1, name: 'ปกแข็ง' },
        { id: 2, name: 'ปกอ่อน' },
    ],
    wire_o_side: [
        { id: 1, name: 'สัน', side_name: 'L' },
        { id: 2, name: 'กว้าง', side_name: 'W' },
    ],
    wire_o_color: [
        { id: 1, name: 'ขาว' },
        { id: 2, name: 'ดำ' },
        { id: 3, name: 'ทอง' },
        { id: 4, name: 'เงินเงา' },
        { id: 5, name: 'ทองแดงเงา' },
        { id: 6, name: 'ส้ม' },
        { id: 7, name: 'แดง' },
        { id: 8, name: 'เหลือง' },
        { id: 9, name: 'เขียวอ่อน' },
        { id: 10, name: 'เขียวแก่' },
        { id: 11, name: 'น้ำเงิน' },
        { id: 12, name: 'ฟ้า' },
        { id: 13, name: 'เงินด้าน' },
        { id: 14, name: 'ทองแดงด้าน' },
    ],
    component_type: [
        // level 1
        // { type_id: 1, template_id: 4, component_id: 1, type_level: 1, component_type_id: 1, name: 'Square back', parent_type_id: null },
        // { type_id: 2, template_id: 4, component_id: 1, type_level: 1, component_type_id: 1, name: 'Round back', parent_type_id: null },

        { type_id: 3, template_id: 5, component_id: 1, type_level: 1, component_type_id: 1, name: 'Square back', parent_type_id: null },
        { type_id: 4, template_id: 5, component_id: 1, type_level: 1, component_type_id: 1, name: 'Round back', parent_type_id: null },

        { type_id: 62, template_id: 5, component_id: 1, type_level: 2, component_type_id: 1, name: '-', parent_type_id: 3 },
        { type_id: 63, template_id: 5, component_id: 1, type_level: 2, component_type_id: 1, name: 'Self Endsheet', parent_type_id: 3 },
        { type_id: 64, template_id: 5, component_id: 1, type_level: 2, component_type_id: 1, name: '-', parent_type_id: 4 },
        { type_id: 65, template_id: 5, component_id: 1, type_level: 2, component_type_id: 1, name: 'Self Endsheet', parent_type_id: 4 },

        { type_id: 5, template_id: 6, component_id: 1, type_level: 1, component_type_id: 1, name: 'Square back', parent_type_id: null },
        { type_id: 66, template_id: 6, component_id: 1, type_level: 2, component_type_id: 1, name: '-', parent_type_id: 5 },
        { type_id: 67, template_id: 6, component_id: 1, type_level: 2, component_type_id: 1, name: 'Self Endsheet', parent_type_id: 5 },

        { type_id: 6, template_id: 6, component_id: 1, type_level: 1, component_type_id: 2, name: 'Round back', parent_type_id: null },
        { type_id: 68, template_id: 6, component_id: 1, type_level: 2, component_type_id: 2, name: '-', parent_type_id: 6 },
        { type_id: 69, template_id: 6, component_id: 1, type_level: 2, component_type_id: 2, name: 'Self Endsheet', parent_type_id: 6 },

        { type_id: 7, template_id: 7, component_id: 1, type_level: 1, name: 'ปกแข็ง', parent_type_id: null },
        { type_id: 8, template_id: 7, component_id: 1, type_level: 1, name: 'ปกอ่อน', parent_type_id: null },

        { type_id: 9, template_id: 8, component_id: 1, type_level: 1, name: 'ปกแข็ง', parent_type_id: null },
        { type_id: 10, template_id: 8, component_id: 1, type_level: 1, name: 'ปกอ่อน', parent_type_id: null },

        { type_id: 11, template_id: 9, component_id: 1, type_level: 1, component_type_id: 1, name: 'Square back', parent_type_id: null },
        { type_id: 12, template_id: 9, component_id: 1, type_level: 1, component_type_id: 1, name: 'Round back', parent_type_id: null },

        { type_id: 13, template_id: 10, component_id: 1, type_level: 1, component_type_id: 1, name: 'ปกแข็ง', parent_type_id: null },
        { type_id: 14, template_id: 10, component_id: 1, type_level: 1, component_type_id: 2, name: 'ปกอ่อน', parent_type_id: null },

        { type_id: 15, template_id: 11, component_id: 1, type_level: 1, component_type_id: 1, name: 'ปกแข็ง', parent_type_id: null },
        { type_id: 16, template_id: 11, component_id: 1, type_level: 1, component_type_id: 2, name: 'ปกอ่อน', parent_type_id: null },
        // level 2
        // wire-o -> ปกแข็ง
        { type_id: 17, template_id: 7, component_id: 1, type_level: 2, component_type_id: 1, name: 'Standard (โชว์ห่วง)', parent_type_id: 7 },
        { type_id: 18, template_id: 7, component_id: 1, type_level: 2, name: 'Concealed (ซ่อนห่วง)', parent_type_id: 7 },
        { type_id: 19, template_id: 7, component_id: 1, type_level: 2, name: 'Semi-Concealed', parent_type_id: 7 },
        // wire-o -> ปกอ่อน
        { type_id: 20, template_id: 7, component_id: 1, type_level: 2, component_type_id: 6, name: 'Standard (โชว์ห่วง)', parent_type_id: 8 },
        { type_id: 21, template_id: 7, component_id: 1, type_level: 2, component_type_id: 7, name: 'Concealed (ซ่อนห่วง)', parent_type_id: 8 },
        { type_id: 22, template_id: 7, component_id: 1, type_level: 2, name: 'Semi-Concealed', parent_type_id: 8 },

        // level 3
        // wire-o -> แข็ง -> con.
        { type_id: 23, template_id: 7, component_id: 1, type_level: 3, component_type_id: 2, name: 'Square back', parent_type_id: 18 },
        { type_id: 24, template_id: 7, component_id: 1, type_level: 3, component_type_id: 3, name: 'Round back', parent_type_id: 18 },
        // wire-o -> แข็ง -> semi.
        { type_id: 25, template_id: 7, component_id: 1, type_level: 3, name: 'Square back', parent_type_id: 19 },
        { type_id: 26, template_id: 7, component_id: 1, type_level: 3, name: 'Round back', parent_type_id: 19 },
        // wire-o -> อ่อน > semi
        { type_id: 27, template_id: 7, component_id: 1, type_level: 3, component_type_id: 8, name: 'Front', parent_type_id: 22 },
        { type_id: 28, template_id: 7, component_id: 1, type_level: 3, component_type_id: 8, name: 'Back', parent_type_id: 22 },
        { type_id: 29, template_id: 7, component_id: 1, type_level: 3, component_type_id: 8, name: 'Spine', parent_type_id: 22 },

        // level 4
        // wire-o -> แข็ง -> semi. > sq
        { type_id: 30, template_id: 7, component_id: 1, type_level: 4, component_type_id: 4, name: 'Front', parent_type_id: 25 },
        { type_id: 31, template_id: 7, component_id: 1, type_level: 4, component_type_id: 4, name: 'Back', parent_type_id: 25 },
        { type_id: 32, template_id: 7, component_id: 1, type_level: 4, component_type_id: 4, name: 'Spine', parent_type_id: 25 },
        // wire-o -> แข็ง -> semi. > round
        { type_id: 52, template_id: 7, component_id: 1, type_level: 4, component_type_id: 5, name: 'Front', parent_type_id: 26 },
        { type_id: 53, template_id: 7, component_id: 1, type_level: 4, component_type_id: 5, name: 'Back', parent_type_id: 26 },
        { type_id: 54, template_id: 7, component_id: 1, type_level: 4, component_type_id: 5, name: 'Spine', parent_type_id: 26 },

        // spiral > แข็ง
        { type_id: 33, template_id: 8, component_id: 1, type_level: 2, component_type_id: 1, name: 'Standard (โชว์ห่วง)', parent_type_id: 9 },
        { type_id: 34, template_id: 8, component_id: 1, type_level: 2, name: 'Concealed (ซ่อนห่วง)', parent_type_id: 9 },
        { type_id: 35, template_id: 8, component_id: 1, type_level: 2, name: 'Semi-Concealed', parent_type_id: 9 },
        // spiral > แข็ง > con.
        { type_id: 36, template_id: 8, component_id: 1, type_level: 3, component_type_id: 2, name: 'Square back', parent_type_id: 34 },
        { type_id: 37, template_id: 8, component_id: 1, type_level: 3, component_type_id: 3, name: 'Round back', parent_type_id: 34 },
        // spiral > แข็ง > semi.
        { type_id: 38, template_id: 8, component_id: 1, type_level: 3, name: 'Square back', parent_type_id: 35 },
        { type_id: 39, template_id: 8, component_id: 1, type_level: 3, name: 'Round back', parent_type_id: 35 },

        // spiral > อ่อน
        { type_id: 40, template_id: 8, component_id: 1, type_level: 2, component_type_id: 6, name: 'Standard (โชว์ห่วง)', parent_type_id: 10 },
        { type_id: 41, template_id: 8, component_id: 1, type_level: 2, component_type_id: 7, name: 'Concealed (ซ่อนห่วง)', parent_type_id: 10 },
        { type_id: 42, template_id: 8, component_id: 1, type_level: 2, name: 'Semi-Concealed', parent_type_id: 10 },
        // spiral > อ่อน > semi.
        { type_id: 43, template_id: 8, component_id: 1, type_level: 3, component_type_id: 8, name: 'Front', parent_type_id: 42 },
        { type_id: 44, template_id: 8, component_id: 1, type_level: 3, component_type_id: 8, name: 'Back', parent_type_id: 42 },
        { type_id: 45, template_id: 8, component_id: 1, type_level: 3, component_type_id: 8, name: 'Spine', parent_type_id: 42 },

        // spiral > แข็ง > semi. > sq
        { type_id: 46, template_id: 8, component_id: 1, type_level: 4, component_type_id: 4, name: 'Front', parent_type_id: 38 },
        { type_id: 47, template_id: 8, component_id: 1, type_level: 4, component_type_id: 4, name: 'Back', parent_type_id: 38 },
        { type_id: 48, template_id: 8, component_id: 1, type_level: 4, component_type_id: 4, name: 'Spine', parent_type_id: 38 },
        // spiral > แข็ง > semi. > round
        { type_id: 49, template_id: 8, component_id: 1, type_level: 4, component_type_id: 5, name: 'Front', parent_type_id: 39 },
        { type_id: 50, template_id: 8, component_id: 1, type_level: 4, component_type_id: 5, name: 'Back', parent_type_id: 39 },
        { type_id: 51, template_id: 8, component_id: 1, type_level: 4, component_type_id: 5, name: 'Spine', parent_type_id: 39 },

        { type_id: 55, template_id: 12, component_id: 2, type_level: 1, component_type_id: 1, name: 'Custom', parent_type_id: null },
        { type_id: 56, template_id: 12, component_id: 2, type_level: 1, component_type_id: 2, name: 'Sticker', parent_type_id: null },
        { type_id: 57, template_id: 12, component_id: 2, type_level: 1, component_type_id: 3, name: 'Leaflet', parent_type_id: null },
        { type_id: 58, template_id: 12, component_id: 2, type_level: 1, component_type_id: 4, name: 'Folded Brochure', parent_type_id: null },

        { type_id: 59, template_id: 13, component_id: 3, type_level: 1, component_type_id: 1, name: 'Hard Slipcase', parent_type_id: null },
        { type_id: 60, template_id: 13, component_id: 3, type_level: 1, component_type_id: 2, name: 'Soft Slipcase', parent_type_id: null },
        { type_id: 61, template_id: 13, component_id: 3, type_level: 1, component_type_id: 3, name: 'Rigid Box', parent_type_id: null },

    ],
    machine: [
        {
            machine_id: 1,
            machine_name: "L444SP",
            machine_type: 1,
            machine_group_id: 1,
            name: 'Cut 1',
            max_size: [840, 1150, 33, 45.275],
            min_size: [460, 620, 18.11, 24.41],
            w_range: [460, 840, 18.11, 33],
            l_range: [620, 1150, 24.41, 45],
        },
        {
            machine_id: 2,
            machine_name: "L440",
            machine_type: 1,
            machine_group_id: 1,
            name: 'Cut 2',
            max_size: [720.09, 1030.22, 28.35, 40.56],
            min_size: [360.17, 520.19, 14.18, 20.48],
            w_range: [360.17, 720.09, 14.18, 28.35],
            l_range: [520.19, 1030.22, 20.48, 40.56],
        },
        {
            machine_id: 3,
            machine_name: "LS1029",
            machine_type: 1,
            machine_group_id: 1,
            name: 'Cut 3',
            max_size: [530.09, 750.06, 20.87, 29.53],
            min_size: [260.09, 360.17, 10.24, 14.18],
            w_range: [260.09, 530.09, 10.24, 20.87],
            l_range: [360.17, 750.06, 14.18, 29.53],
        },
        {
            machine_id: 9999,
            machine_name: "9999",
            machine_type: 3,
            machine_group_id: 4,
            name: 'Board Cutter',
            max_size: [1143, 1143, 45, 45],
            min_size: [508, 508, 20, 20],
            w_range: [508, 1143, 20, 45],
            l_range: [508, 1143, 20, 45],
        },
        {
            machine_id: 35,
            machine_name: "Web35",
            name: "Web 35",
            machine_type: 2,
            machine_group_id: 2,
            max_size: [889, 546.1, 35, 21.5],
            min_size: [546.1, 546.1, 21.5, 21.5],
            w_range: [546.1, 889, 21.5, 35],
            l_range: [546.1, 546.1, 21.5, 21.5],
        },
        {
            machine_id: 38,
            machine_name: "Web38s",
            name: "Web 38s",
            machine_type: 2,
            machine_group_id: 3,
            max_size: [965.2, 598.42, 38, 23.56],
            min_size: [598.42, 598.42, 23.56, 23.56],
            w_range: [598.42, 965.2, 23.56, 38],
            l_range: [598.42, 598.42, 23.56, 23.56],
        },
        {
            machine_id: 442,
            machine_name: "Web 442",
            name: "Web 442",
            machine_type: 2,
            machine_group_id: 2,
            max_size: [1066.8, 624.84, 42, 24.6],
            min_size: [624.84, 624.84, 24.6, 24.6],
            w_range: [624.84, 1066.8, 24.6, 42],
            l_range: [624.84, 624.84, 24.6, 24.6],
        },
        {
            machine_id: 542,
            machine_name: "Web 542",
            name: "Web 542",
            machine_type: 2,
            machine_group_id: 2,
            max_size: [1066.8, 624.84, 42, 24.6],
            min_size: [624.84, 624.84, 24.6, 24.6],
            w_range: [624.84, 1066.8, 24.6, 42],
            l_range: [624.84, 624.84, 24.6, 24.6],
        }
    ],
    paper_fold: [
        { gram: 0, pages: 64 },
        { gram: 64, pages: 64 },
        { gram: 70, pages: 64 },
        { gram: 80, pages: 64 },
        { gram: 85, pages: 64 },
        { gram: 90, pages: 64 },
        { gram: 95, pages: 64 },
        { gram: 100, pages: 64 },
        { gram: 104, pages: 40 },
        { gram: 105, pages: 40 },
        { gram: 113, pages: 40 },
        { gram: 115, pages: 40 },
        { gram: 118, pages: 32 },
        { gram: 120, pages: 32 },
        { gram: 125, pages: 32 },
        { gram: 128, pages: 32 },
        { gram: 130, pages: 32 },
        { gram: 140, pages: 32 },
        { gram: 148, pages: 32 },
        { gram: 150, pages: 32 },
        { gram: 157, pages: 24 },
        { gram: 160, pages: 24 },
        { gram: 165, pages: 24 },
        { gram: 170, pages: 24 },
        { gram: 180, pages: 16 },
        { gram: 185, pages: 16 },
        { gram: 190, pages: 16 },
        { gram: 205, pages: 16 },
        { gram: 180, pages: 12 },
        { gram: 185, pages: 12 },
        { gram: 190, pages: 12 },
        { gram: 205, pages: 12 },
        { gram: 210, pages: 8 },
        { gram: 215, pages: 8 },
        { gram: 220, pages: 8 },
        { gram: 225, pages: 8 },
        { gram: 230, pages: 4 },
        { gram: 235, pages: 4 },
        { gram: 240, pages: 4 },
        { gram: 250, pages: 4 },
        { gram: 260, pages: 4 },
        { gram: 10000, pages: 4 },
    ],
    page_fold: [64, 40, 32, 24, 16, 12, 8, 4],
    layout: {
        paper_rounding: 100,
        sig: 1,
        tolerance: {
            gripper: 12,
            color_bar: 8,
            paper_edge: 4,
            bleed: 3,
            layout_edge: 0,
        }
    },
    packing: {
        packing_type: [
            { packing_type_id: 1, name: 'วางแนวนอน' },
            { packing_type_id: 2, name: 'วางแนวตั้ง' },
        ],
        process_id: {
            paperband: 39,
            kraftwrap: 40,
            carton: 41,
            pallet: 42,
        },
        paper_band: {
            default_unit_price: 0.5, //THB/stack
            default_qty_per_paperband: 100,
            paperband_allowance: 1,//inch ทบติดกาว
            default_limit_weight_kg: 5, //* kg.
            default_paperband_type: {
                id: 0,
                type: 'White Paper',
                price: 100,
                length: 100, //metre
                width: 30, //mm
                thickness: 0.2 //mm
            },
            paperband_type: [
                {
                    id: 0,
                    type: 'White Paper',
                    price: 100,
                    length: 100, //metre
                    width: 30, //mm
                    thickness: 0.2 //mm
                },
                {
                    id: 1,
                    type: 'Brown Paper',
                    price: 100,
                    length: 100, //metre
                    width: 30, //mm
                    thickness: 0.2 //mm
                },
                {
                    id: 2,
                    type: 'Plastic',
                    price: 100,
                    length: 100, //metre
                    width: 30, //mm
                    thickness: 0.2 //mm
                }
            ],
        },
        kraftwrap: {
            default_kraftwrap_size: [
                parseFloat((Math.ceil(297 / 25.4 * 100) / 100).toFixed(2)),
                parseFloat((Math.ceil(420 / 25.4 * 100) / 100).toFixed(2)),
                297,
                420
            ],
            default_kraftwrap_price: 5, //ยึดตามนี้ไปก่อน (ค่า pack + กระดาษ)
            kraftwrap_thickness: 0.5, //0.5mm
            limit_weight: 5,//kg
            limit_height: 300,// mm
        },
        carton: {
            default_carton_size: [11, 17], //* inch width,length
            default_limit_weight: 15, //* kg
            default_unit_price: 15, //*THB/Carton 5+ 10 บาท
            default_markup_price: 10,
            corrugated: {
                corrugated_layer: 5,
                corrugated_flute: "BC",
                type: [
                    "KA",
                    "CA",
                    "KA"
                ],
                gram: [
                    185,
                    125,
                    125
                ]
            },
            corrugated_is_use_275_lbs: {
                corrugated_layer: 5,
                corrugated_flute: "BC",
                type: [
                    "KA",
                    "CA",
                    "KA"
                ],
                gram: [
                    230,
                    125,
                    185
                ]
            },
        },
        pallet: {
            empty_pallet_weight: 25,//kg
            limit_weight: 750, //kg
            limit_height: 44,//inch
            pallet_list: [
                {
                    id: 1,
                    size: [40, 48, 6.5],
                    unit_price: 700
                },
                {
                    id: 2,
                    size: [39.37, 47.24, 6.5],
                    unit_price: 700
                },
                {
                    id: 3,
                    size: [45.9, 45.9, 6.5],
                    unit_price: 700
                },
                {
                    id: 4,
                    size: [42, 45, 6.5],
                    unit_price: 700
                },
                {
                    id: 5,
                    size: [43.3, 43.3, 6.5],
                    unit_price: 700
                },
                {
                    id: 6,
                    size: [31.5, 47.24, 6.5],
                    unit_price: 700
                },
            ],
            pallet_price: {
                local: 400,
                oversea: 700
            },
            fob_markup: 15, //* 15 percent from total FOB Cost
            shipping_container: [
                {
                    type: 'LCL',
                    name: '-',
                    min_pallet: 0,
                    max_pallet: 15,
                    extra: 1.384,
                    THC: 450,
                    BL: 2000,
                    surrender_BL: 2000,
                    handling: 1500,
                    CFS: 450,
                    seal: 0,
                    min_price: 0,
                    min_weight: 0,
                    max_weight: 1000000
                },
                {
                    type: 'FCL20',
                    name: 'ตู้สั้น 20 ft.',
                    min_pallet: 16,
                    max_pallet: 20,
                    extra: 0,
                    haulage: 8100,
                    THC: 3200,
                    BL: 2000,
                    surrender_BL: 2000,
                    handling: 1500,
                    CFS: 0,
                    seal: 300,
                    min_price: 17100,
                    min_weight: 0,
                    max_weight: 17000
                },
                {
                    type: 'FCL40',
                    name: 'ตู้ยาว 40 ft.',
                    min_pallet: 21,
                    max_pallet: 40,
                    extra: 0,
                    haulage: 8600,
                    THC: 4400,
                    BL: 2000,
                    surrender_BL: 2000,
                    handling: 1500,
                    CFS: 0,
                    seal: 300,
                    min_price: 18800,
                    min_weight: 0,
                    max_weight: 19500
                },
            ]
        },
    },
    waste: {
        color_limit: {
            rate: [{
                min: 1,
                max: 10,
                waste: 400
            }],
            col_add: 100,

        }
    },
    process_rate: {
        diecut: {
            machine_setting_cost: 12000, //* per text diecut
            block_reprint_unit_price: 500, //* reprinted
            labor_unit_price: 0.5, //* THB / Sheet
        },
        score: {
            block_rate: [
                { width: 13, length: 19, rate_per_spin: 3.0 },
                { width: 15.5, length: 21.5, rate_per_spin: 3.0 },
                { width: 18, length: 25, rate_per_spin: 3.0 },
                { width: 21.5, length: 31, rate_per_spin: 3.0 },
                { width: 24, length: 35, rate_per_spin: 3.0 },
                { width: 25, length: 36, rate_per_spin: 3.0 },
                { width: 28, length: 40, rate_per_spin: 3.0 },
                { width: 31, length: 43, rate_per_spin: 3.0 },
                { width: 33, length: 45, rate_per_spin: 3.0 },
            ]
        },
        perforate: {
            block_rate: [
                { width: 13, length: 19, rate_per_spin: 6 },
                { width: 15.5, length: 21.5, rate_per_spin: 6 },
                { width: 18, length: 25, rate_per_spin: 5.5 },
                { width: 21.5, length: 31, rate_per_spin: 5.25 },
                { width: 24, length: 35, rate_per_spin: 5 },
                { width: 25, length: 36, rate_per_spin: 5 },
                { width: 28, length: 40, rate_per_spin: 4.75 },
                { width: 31, length: 43, rate_per_spin: 4.75 },
                { width: 33, length: 45, rate_per_spin: 4.75 },
                // { width: 37, length: 51.5, rate_per_spin: 4.75 },
            ]
        },
        saddle_stitch: {
            rate: [ //* Update: 29.02.24
                { min: 1, max: 5000, rate: 0.65 },
                { min: 5001, max: 10000, rate: 0.52 },
                { min: 10001, max: 30000, rate: 0.40 },
                { min: 30001, max: 50000, rate: 0.325 },
                { min: 50001, max: 9999999, rate: 0.325 },
            ]
        },
        perfect_binding: {
            pur_binding: [
                { min: 1, max: 5000, rate: 2.8 },
                { min: 5001, max: 10000, rate: 2.4 },
                { min: 10001, max: 30000, rate: 2.2 },
                { min: 30001, max: 50000, rate: 2.00 },
                { min: 50001, max: 100000000, rate: 1.80 },
            ],
            cover_flap: [
                { min: 1, max: 5000, rate: 2.6 },
                { min: 5001, max: 10000, rate: 2.2 },
                { min: 10001, max: 30000, rate: 1.95 },
                { min: 30001, max: 50000, rate: 1.80 },
                { min: 50001, max: 100000000, rate: 1.60 },
            ],
            cover_no_flap: [
                { min: 1, max: 5000, rate: 2.4 },
                { min: 5001, max: 10000, rate: 1.63 },
                { min: 10001, max: 30000, rate: 1.30 },
                { min: 30001, max: 50000, rate: 1.20 },
                { min: 50001, max: 100000000, rate: 1.10 },
            ]
        },
        singer_sewn: {
            rate_a4: [
                { min: 1, max: 5000, rate: 4.90 },
                { min: 5001, max: 10000, rate: 4.20 },
                { min: 10001, max: 30000, rate: 3.60 },
                { min: 30001, max: 50000, rate: 2.90 },
                { min: 50001, max: 9999999, rate: 2.90 },
            ],
            rate_a5: [
                { min: 1, max: 5000, rate: 3.90 },
                { min: 5001, max: 10000, rate: 3.20 },
                { min: 10001, max: 30000, rate: 2.60 },
                { min: 30001, max: 50000, rate: 1.90 },
                { min: 50001, max: 9999999, rate: 1.90 },
            ],
        },
        plate: {
            // price_per_color: 900, //* 700 -> 900 Update: 29.02.24
            prev_plate: 600, //* ใช้เพลทเก่า กรณีงาน reprint
        },
        print: {
            // uv: {
            //     min_qty: 3000,
            //     min_price: 3500, //* per color
            //     // * get price_rate from db.
            //     price_rate: 0.72 //* THB
            // },
            uv_rate: [
                { min: 1, max: 3000, rate: 1.00 },
                { min: 3001, max: 5000, rate: 0.90 },
                { min: 5001, max: 8000, rate: 0.72 },
                { min: 8001, max: 10000, rate: 0.58 },
                { min: 10001, max: 13000, rate: 0.55 },
                { min: 13001, max: 16000, rate: 0.52 },
                { min: 16001, max: 19000, rate: 0.50 },
                { min: 19001, max: 22000, rate: 0.46 },
                { min: 22001, max: 25000, rate: 0.44 },
                { min: 25001, max: 30000, rate: 0.42 },
                { min: 30001, max: 35000, rate: 0.41 },
                { min: 35001, max: 40000, rate: 0.40 },
                { min: 40001, max: 50000, rate: 0.36 },
                { min: 50001, max: 70000, rate: 0.35 },
                { min: 70001, max: 90000, rate: 0.34 },
                { min: 90001, max: 100000, rate: 0.33 },
                { min: 100001, max: 999999999, rate: 0.32 },
            ]
        },
        delivery: {
            export: {
                pallet_cost: 100, //* 100 THB / pallet
                sea_freight: 1500, //* 1500 THB / Tons.
            }
        },
        end_sheet: {
            rate: [
                { min: 1, max: 5000, rate: 0.8 },
                { min: 5001, max: 10000, rate: 0.8 },
                { min: 10001, max: 30000, rate: 0.8 },
                { min: 30001, max: 50000, rate: 0.8 },
                { min: 50001, max: 100000000, rate: 0.8 },
            ]
        },
        glued_liner: {
            machine_size: [400, 550, 15.748, 21.654],
            unit_price: {
                machine: 0.005, //*THB/sqin
                hand: 0.01 //* THB/sqin
            }
        },
        case_making: {

            rate: [
                { min: 1, max: 5000, rate: 9.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'Sq.Back' },
                { min: 5001, max: 10000, rate: 8.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'Sq.Back' },
                { min: 10001, max: 30000, rate: 7.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'Sq.Back' },
                { min: 30001, max: 50000, rate: 6.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'Sq.Back' },
                { min: 50001, max: 9999999, rate: 5.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'Sq.Back' },

                { min: 1, max: 5000, rate: 10.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'Sq.Back' },
                { min: 5001, max: 10000, rate: 9.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'Sq.Back' },
                { min: 10001, max: 30000, rate: 8.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'Sq.Back' },
                { min: 30001, max: 50000, rate: 7.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'Sq.Back' },
                { min: 50001, max: 9999999, rate: 6.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'Sq.Back' },

                { min: 1, max: 5000, rate: 10.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'R.Back' },
                { min: 5001, max: 10000, rate: 9.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'R.Back' },
                { min: 10001, max: 30000, rate: 8.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'R.Back' },
                { min: 30001, max: 50000, rate: 7.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'R.Back' },
                { min: 50001, max: 9999999, rate: 6.00, over_rate_charge: 1, inter_paper_size: 'A5', type_key: 'R.Back' },

                { min: 1, max: 5000, rate: 11.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'R.Back' },
                { min: 5001, max: 10000, rate: 10.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'R.Back' },
                { min: 10001, max: 30000, rate: 9.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'R.Back' },
                { min: 30001, max: 50000, rate: 8.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'R.Back' },
                { min: 50001, max: 9999999, rate: 7.00, over_rate_charge: 1, inter_paper_size: 'A4', type_key: 'R.Back' },

                { min: 1, max: 5000, rate: 9.00, over_rate_charge: 0, inter_paper_size: 'A5', type_key: 'Flexi' },
                { min: 5001, max: 10000, rate: 8.00, over_rate_charge: 0, inter_paper_size: 'A5', type_key: 'Flexi' },
                { min: 10001, max: 30000, rate: 7.00, over_rate_charge: 0, inter_paper_size: 'A5', type_key: 'Flexi' },
                { min: 30001, max: 50000, rate: 6.00, over_rate_charge: 0, inter_paper_size: 'A5', type_key: 'Flexi' },
                { min: 50001, max: 9999999, rate: 5.00, over_rate_charge: 0, inter_paper_size: 'A5', type_key: 'Flexi' },

                { min: 1, max: 5000, rate: 9.00, over_rate_charge: 0, inter_paper_size: 'A4', type_key: 'Flexi' },
                { min: 5001, max: 10000, rate: 8.00, over_rate_charge: 0, inter_paper_size: 'A4', type_key: 'Flexi' },
                { min: 10001, max: 30000, rate: 7.00, over_rate_charge: 0, inter_paper_size: 'A4', type_key: 'Flexi' },
                { min: 30001, max: 50000, rate: 6.00, over_rate_charge: 0, inter_paper_size: 'A4', type_key: 'Flexi' },
                { min: 50001, max: 9999999, rate: 5.00, over_rate_charge: 0, inter_paper_size: 'A4', type_key: 'Flexi' },
            ]
        },
        case_in: {
            rate: [
                { min: 1, max: 5000, rate: 11, over_rate_charge: 1, inter_paper_size: 'A5' },
                { min: 5001, max: 10000, rate: 10, over_rate_charge: 1, inter_paper_size: 'A5' },
                { min: 10001, max: 30000, rate: 9, over_rate_charge: 1, inter_paper_size: 'A5' },
                { min: 30001, max: 50000, rate: 8, over_rate_charge: 1, inter_paper_size: 'A5' },
                { min: 50001, max: 9999999, rate: 7, over_rate_charge: 1, inter_paper_size: 'A5' },

                { min: 1, max: 5000, rate: 12, over_rate_charge: 1, inter_paper_size: 'A4' },
                { min: 5001, max: 10000, rate: 11, over_rate_charge: 1, inter_paper_size: 'A4' },
                { min: 10001, max: 30000, rate: 10, over_rate_charge: 1, inter_paper_size: 'A4' },
                { min: 30001, max: 50000, rate: 9, over_rate_charge: 1, inter_paper_size: 'A4' },
                { min: 50001, max: 9999999, rate: 8, over_rate_charge: 1, inter_paper_size: 'A4' },
            ]
        },
        loop_binding: {
            description: 'ค่าเข้าห่วง wire o , spiral',
            wire_o: [ //* inch , min - max ยอดงาน
                { min_size: 0, max_size: 12, min: 1, max: 5000, rate: 2.6, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 5001, max: 10000, rate: 1.95, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 10001, max: 30000, rate: 1.63, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 30001, max: 50000, rate: 1.3, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 50001, max: 999999999, rate: 1.3, min_price: 2600 },

                { min_size: 12, max_size: 99, min: 1, max: 5000, rate: 3, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 5001, max: 10000, rate: 2.5, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 10001, max: 30000, rate: 2.25, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 30001, max: 50000, rate: 2.0, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 50001, max: 999999999, rate: 1.75, min_price: 3000 },
            ],
            spiral: [ //* inch , min - max ยอดงาน
                { min_size: 0, max_size: 12, min: 1, max: 5000, rate: 2.6, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 5001, max: 10000, rate: 1.95, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 10001, max: 30000, rate: 1.63, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 30001, max: 50000, rate: 1.3, min_price: 2600 },
                { min_size: 0, max_size: 12, min: 50001, max: 999999999, rate: 1.3, min_price: 2600 },

                { min_size: 12, max_size: 99, min: 1, max: 5000, rate: 3, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 5001, max: 10000, rate: 2.5, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 10001, max: 30000, rate: 2.25, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 30001, max: 50000, rate: 2.0, min_price: 3000 },
                { min_size: 12, max_size: 99, min: 50001, max: 999999999, rate: 1.75, min_price: 3000 },
            ],
        },
        desk_calendar: {
            drill_hole: [
                { min: 1, max: 5000, rate: 0.7, min_price: 1500 },
                { min: 5001, max: 10000, rate: 0.6, min_price: 1500 },
                { min: 10001, max: 30000, rate: 0.5, min_price: 1500 },
                { min: 30001, max: 50000, rate: 0.4, min_price: 1500 },
                { min: 50001, max: 999999999, rate: 0.3, min_price: 1500 },
            ],
            easel_stand: [
                { min: 1, max: 5000, rate: 7.0, min_price: 5700 },
                { min: 5001, max: 10000, rate: 6.0, min_price: 5700 },
                { min: 10001, max: 30000, rate: 5.0, min_price: 5700 },
                { min: 30001, max: 50000, rate: 4.0, min_price: 5700 },
                { min: 50001, max: 999999999, rate: 3.0, min_price: 5700 },
            ],
            wire_o_bound: [
                { min: 1, max: 5000, rate: 0.9, min_price: 1500 },
                { min: 5001, max: 10000, rate: 0.8, min_price: 1500 },
                { min: 10001, max: 30000, rate: 0.7, min_price: 1500 },
                { min: 30001, max: 50000, rate: 0.6, min_price: 1500 },
                { min: 50001, max: 999999999, rate: 0.5, min_price: 1500 },
            ],
        }
    },
    default_process: {
        coating: {
            suv: {
                input: {
                    name: 'ผ้ายาง (Spot Waterbase)',
                    from_process: 'S-WTB',
                    is_fixed_price: true,
                    is_fixed_qty: true,
                    readonly: true,
                    disabled_editing: true,
                    price: [1500],
                    qty: [1]
                }
            },
            uv_gap: {
                input: {
                    name: 'ผ้ายาง (UV เว้นลิ้น)',
                    from_process: 'UV_GAP',
                    is_fixed_price: true,
                    is_fixed_qty: true,
                    readonly: true,
                    disabled_editing: true,
                    price: [1500],
                    qty: [1]
                }
            }
        },
        insert: {
            name: 'เทปกาว',
            from_process: 'insert',
            is_fixed_price: true,
            is_fixed_qty: true,
            readonly: true,
            disabled_editing: false,
            price: [],
            qty: []
        },
        gatefold: {
            name: 'เทปกาว',
            from_process: 'gatefold',
            is_fixed_price: true,
            is_fixed_qty: true,
            readonly: true,
            disabled_editing: false,
            price: [],
            qty: []
        }
    },

}