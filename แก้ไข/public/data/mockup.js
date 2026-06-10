const mockupJobData = {
    job: {
        template_id: 6,
    },
    components: [
        {
            info: {
                unique_id: "1698397806871-953507",
                template_id: 6,
                component_no: 1,
                component_name: "Book",
                component_id: 1,
                component_code: "6.1.1",
                component_type: [
                    {
                        type_id: "5",
                        type_name: "Square back"
                    }
                ],
                is_reprint: 1,
                ink_type: 1,
                print_type: 1,
                is_fsc: false
            },
            color_limit: {
                is_color_limit: false,
                amount: 0
            },
            qty: {
                ae_qty: 2,
                customer_qty: 3,
                runon_percent: 2,
                qty: [
                    {
                        qty: 500,
                        runon_qty: 10,
                        runon_percent: 2,
                        ae_qty: 2,
                        customer_qty: 3,
                        total_qty: 515
                    },
                    {
                        qty: 1500,
                        runon_qty: 30,
                        runon_percent: 2,
                        ae_qty: 2,
                        customer_qty: 3,
                        total_qty: 1535
                    }
                ],
                total_qty: 2050
            },
            sub_components: [
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397811746-695645",
                        selected_id: 22,
                        sub_component_id: 6,
                        sub_component_code: "6.1.1.6",
                        sub_component_name: "Board",
                        sub_component_no: "",
                        sub_component_custom_name: "Board",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_color_limit: false,
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 0,
                            outside: 0,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 3,
                        machine: {
                            machine_id: 1,
                            machine_name: "L444SP",
                            machine_type: 1,
                            name: "Cut 1",
                            max_size: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            min_size: [
                                460,
                                620,
                                18.11,
                                24.41
                            ],
                            w_range: [
                                460,
                                840,
                                18.11,
                                33
                            ],
                            l_range: [
                                620,
                                1150,
                                24.41,
                                45
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 30,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "Board",
                                description: "Board",
                                qty: 1030,
                                ups: 30,
                                after_ups: 35,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1035,
                                paper_print: 1035,
                                paper_qty: 1035,
                                paper_net: 1100,
                                weight_kg: 1632.879,
                                weight_ton: 1.633
                            },
                            {
                                name: "Board",
                                description: "Board",
                                qty: 3070,
                                ups: 30,
                                after_ups: 103,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1103,
                                paper_print: 1103,
                                paper_qty: 1103,
                                paper_net: 1200,
                                weight_kg: 1781.323,
                                weight_ton: 1.781
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 3,
                            paper_print: 0,
                            paper_code: "",
                            paper_name: "Board 2.5mm",
                            paper_type: "B 2.5",
                            paper_gram: 1540,
                            paper_thickness: 2.5,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 2,
                            paper_roll_cut_price: 0,
                            paper_cost: 24.5,
                            paper_sale: 26.21,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0

                        },
                        paper_info: {},
                        source_paper_size: [
                            840,
                            1150,
                            33,
                            45.275
                        ],
                        paper_size: [
                            840,
                            1150,
                            33,
                            45.275
                        ],
                        std_paper_id: null
                    },
                    layout: {
                        tolerance: {
                            gripper: 0,
                            color_bar: 0,
                            paper_edge: 0,
                            bleed: 0,
                            layout_edge: 25.4
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 3,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: false,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: false,
                            is_edit_folding_page: false,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    6,
                                    5
                                ],
                                printing: [
                                    762,
                                    1047.75
                                ],
                                num_laying: 30,
                                tolerance: {
                                    gripper: 0,
                                    color_bar: 0,
                                    paper_edge: 0,
                                    bleed: 0,
                                    layout_edge: 25.4
                                },
                                layout_size: [
                                    787.4,
                                    1073.15,
                                    31,
                                    42.25
                                ],
                                open_size: [
                                    127,
                                    209.55,
                                    5,
                                    8.25
                                ],
                                paper_lay: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                paper_size: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                size: {
                                    width: 127,
                                    length: 209.55
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    3,
                                    8
                                ],
                                printing: [
                                    628.65,
                                    1016
                                ],
                                num_laying: 24,
                                tolerance: {
                                    gripper: 0,
                                    color_bar: 0,
                                    paper_edge: 0,
                                    bleed: 0,
                                    layout_edge: 25.4
                                },
                                layout_size: [
                                    654.05,
                                    1041.4,
                                    25.75,
                                    41
                                ],
                                open_size: [
                                    127,
                                    209.55,
                                    5,
                                    8.25
                                ],
                                paper_lay: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                paper_size: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                size: {
                                    width: 127,
                                    length: 209.55
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                6,
                                5
                            ],
                            printing: [
                                762,
                                1047.75
                            ],
                            num_laying: 30,
                            tolerance: {
                                gripper: 0,
                                color_bar: 0,
                                paper_edge: 0,
                                bleed: 0,
                                layout_edge: 25.4
                            },
                            layout_size: [
                                787.4,
                                1073.15,
                                31,
                                42.25
                            ],
                            open_size: [
                                127,
                                209.55,
                                5,
                                8.25
                            ],
                            paper_lay: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            paper_size: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            size: {
                                width: 127,
                                length: 209.55
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 0,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            127,
                            209.55,
                            5,
                            8.25
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397811811-562931",
                        selected_id: 23,
                        sub_component_id: 5,
                        sub_component_code: "6.1.1.5",
                        sub_component_name: "Spine",
                        sub_component_no: "",
                        sub_component_custom_name: "Spine",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 0,
                            outside: 0,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 3,
                        machine: {
                            machine_id: 1,
                            machine_name: "L444SP",
                            machine_type: 1,
                            name: "Cut 1",
                            max_size: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            min_size: [
                                460,
                                620,
                                18.11,
                                24.41
                            ],
                            w_range: [
                                460,
                                840,
                                18.11,
                                33
                            ],
                            l_range: [
                                620,
                                1150,
                                24.41,
                                45
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 265,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "Spine",
                                description: "Spine",
                                qty: 515,
                                ups: 265,
                                after_ups: 2,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1002,
                                paper_print: 1002,
                                paper_qty: 1002,
                                paper_net: 1100,
                                weight_kg: 662.695,
                                weight_ton: 0.663
                            },
                            {
                                name: "Spine",
                                description: "Spine",
                                qty: 1535,
                                ups: 265,
                                after_ups: 6,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1006,
                                paper_print: 1006,
                                paper_qty: 1006,
                                paper_net: 1100,
                                weight_kg: 662.695,
                                weight_ton: 0.663
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 3,
                            paper_print: 0,
                            paper_code: "",
                            paper_name: "Board 1mm",
                            paper_type: "B 1",
                            paper_gram: 625,
                            paper_thickness: 1,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 2,
                            paper_roll_cut_price: 0,
                            paper_cost: 24.5,
                            paper_sale: 26.21,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            840,
                            1150,
                            33,
                            45.275
                        ],
                        paper_size: [
                            840,
                            1150,
                            33,
                            45.275
                        ],
                        std_paper_id: null
                    },
                    layout: {
                        tolerance: {
                            gripper: 0,
                            color_bar: 0,
                            paper_edge: 0,
                            bleed: 0,
                            layout_edge: 25.4
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 3,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: false,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: false,
                            is_edit_folding_page: false,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    53,
                                    5
                                ],
                                printing: [
                                    809.84,
                                    1047.75
                                ],
                                num_laying: 265,
                                tolerance: {
                                    gripper: 0,
                                    color_bar: 0,
                                    paper_edge: 0,
                                    bleed: 0,
                                    layout_edge: 25.4
                                },
                                layout_size: [
                                    835.24,
                                    1073.15,
                                    32.89,
                                    42.25
                                ],
                                open_size: [
                                    15.28,
                                    209.55,
                                    0.61,
                                    8.25
                                ],
                                paper_lay: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                paper_size: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                size: {
                                    width: 15.28,
                                    length: 209.55
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    3,
                                    74
                                ],
                                printing: [
                                    628.65,
                                    1130.72
                                ],
                                num_laying: 222,
                                tolerance: {
                                    gripper: 0,
                                    color_bar: 0,
                                    paper_edge: 0,
                                    bleed: 0,
                                    layout_edge: 25.4
                                },
                                layout_size: [
                                    654.05,
                                    1156.12,
                                    25.75,
                                    45.52
                                ],
                                open_size: [
                                    15.28,
                                    209.55,
                                    0.61,
                                    8.25
                                ],
                                paper_lay: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                paper_size: [
                                    840,
                                    1150,
                                    33,
                                    45.275
                                ],
                                size: {
                                    width: 15.28,
                                    length: 209.55
                                },
                                validate: {
                                    chk_paper: false,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                53,
                                5
                            ],
                            printing: [
                                809.84,
                                1047.75
                            ],
                            num_laying: 265,
                            tolerance: {
                                gripper: 0,
                                color_bar: 0,
                                paper_edge: 0,
                                bleed: 0,
                                layout_edge: 25.4
                            },
                            layout_size: [
                                835.24,
                                1073.15,
                                32.89,
                                42.25
                            ],
                            open_size: [
                                15.28,
                                209.55,
                                0.61,
                                8.25
                            ],
                            paper_lay: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            paper_size: [
                                840,
                                1150,
                                33,
                                45.275
                            ],
                            size: {
                                width: 15.28,
                                length: 209.55
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 0,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            15.28,
                            209.55,
                            0.61,
                            8.25
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397811906-301922",
                        selected_id: 24,
                        sub_component_id: 1,
                        sub_component_code: "6.1.1.1",
                        sub_component_name: "Cover",
                        sub_component_no: "",
                        sub_component_custom_name: "Cover",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 4,
                            outside: 4,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 1,
                        machine: {
                            machine_id: 2,
                            machine_name: "L440",
                            machine_type: 1,
                            name: "Cut 2",
                            max_size: [
                                720.09,
                                1030.22,
                                28.35,
                                40.56
                            ],
                            min_size: [
                                360.17,
                                520.19,
                                14.18,
                                20.48
                            ],
                            w_range: [
                                360.17,
                                720.09,
                                14.18,
                                28.35
                            ],
                            l_range: [
                                520.19,
                                1030.22,
                                20.48,
                                40.56
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 6,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "Cover",
                                description: "Cover",
                                qty: 515,
                                ups: 6,
                                after_ups: 86,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1086,
                                paper_print: 1086,
                                paper_qty: 1086,
                                paper_net: 1100,
                                weight_kg: 283.8,
                                weight_ton: 0.284
                            },
                            {
                                name: "Cover",
                                description: "Cover",
                                qty: 1535,
                                ups: 6,
                                after_ups: 256,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1256,
                                paper_print: 1256,
                                paper_qty: 1256,
                                paper_net: 1300,
                                weight_kg: 335.4,
                                weight_ton: 0.335
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 1,
                            paper_print: 1,
                            paper_code: "Dup",
                            paper_name: "Duplex BBB",
                            paper_type: "Dup BBB",
                            paper_gram: 300,
                            paper_thickness: 0.35,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 1,
                            paper_roll_cut_price: 1.2,
                            paper_cost: 30.8,
                            paper_sale: 34.16,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            787,
                            1092,
                            31,
                            43
                        ],
                        paper_size: [
                            711,
                            1016,
                            28,
                            40
                        ],
                        std_paper_id: 33
                    },
                    layout: {
                        tolerance: {
                            gripper: 12,
                            color_bar: 8,
                            paper_edge: 4,
                            bleed: 3,
                            layout_edge: 0
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 1,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: true,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: false,
                            is_edit_folding_page: false,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    2,
                                    3
                                ],
                                printing: [
                                    664.86,
                                    760.95
                                ],
                                num_laying: 6,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    684.86,
                                    768.95,
                                    26.97,
                                    30.28
                                ],
                                open_size: [
                                    326.43,
                                    247.65,
                                    12.86,
                                    9.75
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 332.43,
                                    length: 253.65
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    2,
                                    3
                                ],
                                printing: [
                                    507.3,
                                    997.29
                                ],
                                num_laying: 6,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    527.3,
                                    1005.29,
                                    20.76,
                                    39.58
                                ],
                                open_size: [
                                    326.43,
                                    247.65,
                                    12.86,
                                    9.75
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 332.43,
                                    length: 253.65
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                2,
                                3
                            ],
                            printing: [
                                664.86,
                                760.95
                            ],
                            num_laying: 6,
                            tolerance: {
                                gripper: 12,
                                color_bar: 8,
                                paper_edge: 4,
                                bleed: 3,
                                layout_edge: 0
                            },
                            layout_size: [
                                684.86,
                                768.95,
                                26.97,
                                30.28
                            ],
                            open_size: [
                                326.43,
                                247.65,
                                12.86,
                                9.75
                            ],
                            paper_lay: [
                                711,
                                1016,
                                28,
                                40
                            ],
                            paper_size: [
                                787,
                                1092,
                                31,
                                43
                            ],
                            size: {
                                width: 332.43,
                                length: 253.65
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 0,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            326.43,
                            247.65,
                            12.86,
                            9.75
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397812015-509934",
                        selected_id: 25,
                        sub_component_id: 2,
                        sub_component_code: "6.1.1.2",
                        sub_component_name: "Text",
                        sub_component_no: 1,
                        sub_component_custom_name: "Text",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 4,
                            outside: 4,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 1,
                        machine: {
                            machine_id: 2,
                            machine_name: "L440",
                            machine_type: 1,
                            name: "Cut 2",
                            max_size: [
                                720.09,
                                1030.22,
                                28.35,
                                40.56
                            ],
                            min_size: [
                                360.17,
                                520.19,
                                14.18,
                                20.48
                            ],
                            w_range: [
                                360.17,
                                720.09,
                                14.18,
                                28.35
                            ],
                            l_range: [
                                520.19,
                                1030.22,
                                20.48,
                                40.56
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 8,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "Text",
                                description: "Text",
                                qty: 515,
                                ups: 8,
                                after_ups: 65,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1065,
                                paper_print: 1065,
                                paper_qty: 1065,
                                paper_net: 1100,
                                weight_kg: 402.387,
                                weight_ton: 0.402
                            },
                            {
                                name: "Text",
                                description: "Text",
                                qty: 1535,
                                ups: 8,
                                after_ups: 192,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1192,
                                paper_print: 1192,
                                paper_qty: 1192,
                                paper_net: 1200,
                                weight_kg: 438.968,
                                weight_ton: 0.439
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 1,
                            paper_print: 1,
                            paper_code: "",
                            paper_name: "Grey Board",
                            paper_type: "GB",
                            paper_gram: 630,
                            paper_thickness: 0,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 1,
                            paper_roll_cut_price: 1.2,
                            paper_cost: 22.5,
                            paper_sale: 25.28,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            635,
                            914,
                            25,
                            36
                        ],
                        paper_size: [
                            635,
                            914,
                            25,
                            36
                        ],
                        std_paper_id: 11
                    },
                    layout: {
                        tolerance: {
                            gripper: 12,
                            color_bar: 8,
                            paper_edge: 4,
                            bleed: 3,
                            layout_edge: 0
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 4,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: true,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: true,
                            is_edit_folding_page: true,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    2,
                                    4
                                ],
                                printing: [
                                    520,
                                    836.8
                                ],
                                num_laying: 8,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    540,
                                    844.8,
                                    21.26,
                                    33.26
                                ],
                                open_size: [
                                    254,
                                    203.2,
                                    10,
                                    8
                                ],
                                paper_lay: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                paper_size: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                size: {
                                    width: 260,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    2,
                                    3
                                ],
                                printing: [
                                    418.4,
                                    780
                                ],
                                num_laying: 6,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    438.4,
                                    788,
                                    17.26,
                                    31.03
                                ],
                                open_size: [
                                    254,
                                    203.2,
                                    10,
                                    8
                                ],
                                paper_lay: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                paper_size: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                size: {
                                    width: 260,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                2,
                                4
                            ],
                            printing: [
                                520,
                                836.8
                            ],
                            num_laying: 8,
                            tolerance: {
                                gripper: 12,
                                color_bar: 8,
                                paper_edge: 4,
                                bleed: 3,
                                layout_edge: 0
                            },
                            layout_size: [
                                540,
                                844.8,
                                21.26,
                                33.26
                            ],
                            open_size: [
                                254,
                                203.2,
                                10,
                                8
                            ],
                            paper_lay: [
                                635,
                                914,
                                25,
                                36
                            ],
                            paper_size: [
                                635,
                                914,
                                25,
                                36
                            ],
                            size: {
                                width: 260,
                                length: 209.2
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 16,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: true,
                            apply_all_type: 2,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            254,
                            203.2,
                            10,
                            8
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397812128-911048",
                        selected_id: 26,
                        sub_component_id: 4,
                        sub_component_code: "6.1.1.4",
                        sub_component_name: "End Sheet",
                        sub_component_no: "",
                        sub_component_custom_name: "End Sheet",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 4,
                            outside: 4,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 1,
                        machine: {
                            machine_id: 2,
                            machine_name: "L440",
                            machine_type: 1,
                            name: "Cut 2",
                            max_size: [
                                720.09,
                                1030.22,
                                28.35,
                                40.56
                            ],
                            min_size: [
                                360.17,
                                520.19,
                                14.18,
                                20.48
                            ],
                            w_range: [
                                360.17,
                                720.09,
                                14.18,
                                28.35
                            ],
                            l_range: [
                                520.19,
                                1030.22,
                                20.48,
                                40.56
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 8,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "End Sheet",
                                description: "End Sheet",
                                qty: 515,
                                ups: 8,
                                after_ups: 65,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1065,
                                paper_print: 1065,
                                paper_qty: 1065,
                                paper_net: 1100,
                                weight_kg: 94.529,
                                weight_ton: 0.095
                            },
                            {
                                name: "End Sheet",
                                description: "End Sheet",
                                qty: 1535,
                                ups: 8,
                                after_ups: 192,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1192,
                                paper_print: 1192,
                                paper_qty: 1192,
                                paper_net: 1200,
                                weight_kg: 103.123,
                                weight_ton: 0.103
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 1,
                            paper_print: 1,
                            paper_code: "MA",
                            paper_name: "Matt Art",
                            paper_type: "MA",
                            paper_gram: 148,
                            paper_thickness: 0.133,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 1,
                            paper_roll_cut_price: 1.2,
                            paper_cost: 100,
                            paper_sale: 108.2,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            635,
                            914,
                            25,
                            36
                        ],
                        paper_size: [
                            635,
                            914,
                            25,
                            36
                        ],
                        std_paper_id: 11
                    },
                    layout: {
                        tolerance: {
                            gripper: 12,
                            color_bar: 8,
                            paper_edge: 4,
                            bleed: 3,
                            layout_edge: 0
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 4,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: true,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: true,
                            is_edit_folding_page: true,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    2,
                                    4
                                ],
                                printing: [
                                    520,
                                    836.8
                                ],
                                num_laying: 8,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    540,
                                    844.8,
                                    21.26,
                                    33.26
                                ],
                                open_size: [
                                    254,
                                    203.2,
                                    10,
                                    8
                                ],
                                paper_lay: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                paper_size: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                size: {
                                    width: 260,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    2,
                                    3
                                ],
                                printing: [
                                    418.4,
                                    780
                                ],
                                num_laying: 6,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    438.4,
                                    788,
                                    17.26,
                                    31.03
                                ],
                                open_size: [
                                    254,
                                    203.2,
                                    10,
                                    8
                                ],
                                paper_lay: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                paper_size: [
                                    635,
                                    914,
                                    25,
                                    36
                                ],
                                size: {
                                    width: 260,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                2,
                                4
                            ],
                            printing: [
                                520,
                                836.8
                            ],
                            num_laying: 8,
                            tolerance: {
                                gripper: 12,
                                color_bar: 8,
                                paper_edge: 4,
                                bleed: 3,
                                layout_edge: 0
                            },
                            layout_size: [
                                540,
                                844.8,
                                21.26,
                                33.26
                            ],
                            open_size: [
                                254,
                                203.2,
                                10,
                                8
                            ],
                            paper_lay: [
                                635,
                                914,
                                25,
                                36
                            ],
                            paper_size: [
                                635,
                                914,
                                25,
                                36
                            ],
                            size: {
                                width: 260,
                                length: 209.2
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 16,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            254,
                            203.2,
                            10,
                            8
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397812265-686082",
                        selected_id: 27,
                        sub_component_id: 3,
                        sub_component_code: "6.1.1.3",
                        sub_component_name: "Liner",
                        sub_component_no: "",
                        sub_component_custom_name: "Liner",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 4,
                            outside: 4,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 1,
                        machine: {
                            machine_id: 2,
                            machine_name: "L440",
                            machine_type: 1,
                            name: "Cut 2",
                            max_size: [
                                720.09,
                                1030.22,
                                28.35,
                                40.56
                            ],
                            min_size: [
                                360.17,
                                520.19,
                                14.18,
                                20.48
                            ],
                            w_range: [
                                360.17,
                                720.09,
                                14.18,
                                28.35
                            ],
                            l_range: [
                                520.19,
                                1030.22,
                                20.48,
                                40.56
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 20,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "Liner",
                                description: "Liner",
                                qty: 4120,
                                ups: 20,
                                after_ups: 206,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1206,
                                paper_print: 1206,
                                paper_qty: 1206,
                                paper_net: 1300,
                                weight_kg: 447.2,
                                weight_ton: 0.447
                            },
                            {
                                name: "Liner",
                                description: "Liner",
                                qty: 12280,
                                ups: 20,
                                after_ups: 614,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1614,
                                paper_print: 1614,
                                paper_qty: 1614,
                                paper_net: 1700,
                                weight_kg: 584.8,
                                weight_ton: 0.585
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            paper_category_id: 1,
                            paper_print: 1,
                            paper_code: "Dup",
                            paper_name: "Duplex WBB",
                            paper_type: "Dup WBB",
                            paper_gram: 400,
                            paper_thickness: 0.52,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 1,
                            paper_roll_cut_price: 1.2,
                            paper_cost: 31.5,
                            paper_sale: 34.91,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            787,
                            1092,
                            31,
                            43
                        ],
                        paper_size: [
                            711,
                            1016,
                            28,
                            40
                        ],
                        std_paper_id: 33
                    },
                    layout: {
                        tolerance: {
                            gripper: 12,
                            color_bar: 8,
                            paper_edge: 4,
                            bleed: 3,
                            layout_edge: 0
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 1,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: true,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: false,
                            is_edit_folding_page: false,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    5,
                                    4
                                ],
                                printing: [
                                    665,
                                    836.8
                                ],
                                num_laying: 20,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    685,
                                    844.8,
                                    26.97,
                                    33.26
                                ],
                                open_size: [
                                    127,
                                    203.2,
                                    5,
                                    8
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 133,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    3,
                                    7
                                ],
                                printing: [
                                    627.6,
                                    931
                                ],
                                num_laying: 21,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    647.6,
                                    939,
                                    25.5,
                                    36.97
                                ],
                                open_size: [
                                    127,
                                    203.2,
                                    5,
                                    8
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 133,
                                    length: 209.2
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                5,
                                4
                            ],
                            printing: [
                                665,
                                836.8
                            ],
                            num_laying: 20,
                            tolerance: {
                                gripper: 12,
                                color_bar: 8,
                                paper_edge: 4,
                                bleed: 3,
                                layout_edge: 0
                            },
                            layout_size: [
                                685,
                                844.8,
                                26.97,
                                33.26
                            ],
                            open_size: [
                                127,
                                203.2,
                                5,
                                8
                            ],
                            paper_lay: [
                                711,
                                1016,
                                28,
                                40
                            ],
                            paper_size: [
                                787,
                                1092,
                                31,
                                43
                            ],
                            size: {
                                width: 133,
                                length: 209.2
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: false,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 16,
                            is_trim: false,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: false,
                            gatefold_no_of_sheet: 0,
                            gatefold_no_of_pages: 0,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0,
                            0
                        ],
                        open_size: [
                            127,
                            203.2,
                            5,
                            8
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                },
                {
                    info: {
                        component_name: "Book",
                        component_no: 1,
                        c_unique_id: "1698397806871-953507",
                        unique_id: "1698397812417-093267",
                        selected_id: 29,
                        sub_component_id: 8,
                        sub_component_code: "6.1.1.8",
                        sub_component_name: "Custom",
                        sub_component_no: "",
                        sub_component_custom_name: "cuss",
                        is_fsc: false
                    },
                    addon: [],
                    color: {
                        is_special_ink: false,
                        special_ink: [],
                        color: {
                            inside: 4,
                            outside: 4,
                            in_type: 1,
                            out_type: 1
                        }
                    },
                    machine: {
                        machine_type: 1,
                        machine: {
                            machine_id: 2,
                            machine_name: "L440",
                            machine_type: 1,
                            name: "Cut 2",
                            max_size: [
                                720.09,
                                1030.22,
                                28.35,
                                40.56
                            ],
                            min_size: [
                                360.17,
                                520.19,
                                14.18,
                                20.48
                            ],
                            w_range: [
                                360.17,
                                720.09,
                                14.18,
                                28.35
                            ],
                            l_range: [
                                520.19,
                                1030.22,
                                20.48,
                                40.56
                            ]
                        }
                    },
                    paper_usage: {
                        ups: 21,
                        sig: 1,
                        split: 1,
                        line: [
                            {
                                name: "cuss",
                                description: "cuss",
                                qty: 515,
                                ups: 21,
                                after_ups: 25,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1025,
                                paper_print: 1025,
                                paper_qty: 1025,
                                paper_net: 1100,
                                weight_kg: 331.1,
                                weight_ton: 0.331
                            },
                            {
                                name: "cuss",
                                description: "cuss",
                                qty: 1535,
                                ups: 21,
                                after_ups: 74,
                                marking: 0.12,
                                sig: 1,
                                split: 1,
                                paper_waste: 1000,
                                waste: 1000,
                                after_waste: 1074,
                                paper_print: 1074,
                                paper_qty: 1074,
                                paper_net: 1100,
                                weight_kg: 331.1,
                                weight_ton: 0.331
                            }
                        ],
                        sub_line: [],
                        proof: []
                    },
                    paper_info: {
                        paper_grain: "horizontal",
                        paper_type_id: 1,
                        input: {
                            is_custom_paper: false,
                            paper_category_id: 1,
                            paper_print: 1,
                            paper_code: "Dup",
                            paper_name: "Duplex BBB",
                            paper_type: "Dup BBB",
                            paper_gram: 350,
                            paper_thickness: 0.42,
                            is_fsc: false,
                            paper_source_type: 1,
                            roll_cut_type: 1,
                            paper_roll_cut_price: 1.2,
                            paper_cost: 29.4,
                            paper_sale: 32.66,
                            paper_markup: 7,
                            paper_remark: "",
                            price_per_sheet: 0
                        },
                        paper_info: {},
                        source_paper_size: [
                            787,
                            1092,
                            31,
                            43
                        ],
                        paper_size: [
                            711,
                            1016,
                            28,
                            40
                        ],
                        std_paper_id: 33
                    },
                    layout: {
                        tolerance: {
                            gripper: 12,
                            color_bar: 8,
                            paper_edge: 4,
                            bleed: 3,
                            layout_edge: 0
                        },
                        is_manual_layout: false,
                        is_manual_laying: false,
                        is_manual_tolerance: false,
                        laying_type: 4,
                        layout: {
                            layout_grain: "",
                            laying: [],
                            selected_layout: {}
                        },
                        option: {
                            open_size: true,
                            layout_size: true,
                            paper_size: true,
                            source_paper_size: true,
                            std_paper_size: true,
                            machine: true,
                            machine_min_size: true,
                            machine_max_size: true,
                            recalc_layout: true,
                            is_edit_laying: true,
                            is_edit_folding: true,
                            is_edit_folding_page: true,
                            is_edit_tolerance: true,
                            is_show_paper_usage: true
                        },
                        laying: [
                            {
                                laying_type: "straight",
                                laying: "vertical",
                                grain_box_type: "vertical",
                                layout: [
                                    3,
                                    7
                                ],
                                printing: [
                                    627.6,
                                    931
                                ],
                                num_laying: 21,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    647.6,
                                    939,
                                    25.5,
                                    36.97
                                ],
                                open_size: [
                                    203.2,
                                    127,
                                    8,
                                    5
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 209.2,
                                    length: 133
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            },
                            {
                                laying_type: "straight",
                                laying: "horizontal",
                                grain_box_type: "horizontal",
                                layout: [
                                    5,
                                    4
                                ],
                                printing: [
                                    665,
                                    836.8
                                ],
                                num_laying: 20,
                                tolerance: {
                                    gripper: 12,
                                    color_bar: 8,
                                    paper_edge: 4,
                                    bleed: 3,
                                    layout_edge: 0
                                },
                                layout_size: [
                                    685,
                                    844.8,
                                    26.97,
                                    33.26
                                ],
                                open_size: [
                                    203.2,
                                    127,
                                    8,
                                    5
                                ],
                                paper_lay: [
                                    711,
                                    1016,
                                    28,
                                    40
                                ],
                                paper_size: [
                                    787,
                                    1092,
                                    31,
                                    43
                                ],
                                size: {
                                    width: 209.2,
                                    length: 133
                                },
                                validate: {
                                    chk_paper: true,
                                    chk_machine: true
                                }
                            }
                        ],
                        selected_layout: {
                            laying_type: "straight",
                            laying: "vertical",
                            grain_box_type: "vertical",
                            layout: [
                                3,
                                7
                            ],
                            printing: [
                                627.6,
                                931
                            ],
                            num_laying: 21,
                            tolerance: {
                                gripper: 12,
                                color_bar: 8,
                                paper_edge: 4,
                                bleed: 3,
                                layout_edge: 0
                            },
                            layout_size: [
                                647.6,
                                939,
                                25.5,
                                36.97
                            ],
                            open_size: [
                                203.2,
                                127,
                                8,
                                5
                            ],
                            paper_lay: [
                                711,
                                1016,
                                28,
                                40
                            ],
                            paper_size: [
                                787,
                                1092,
                                31,
                                43
                            ],
                            size: {
                                width: 209.2,
                                length: 133
                            },
                            validate: {
                                chk_paper: true,
                                chk_machine: true
                            }
                        }
                    },
                    process: {
                        input: {
                            is_show_fold_size: true,
                            spread: 0,
                            sheet: 0,
                            no_of_pages: 16,
                            is_trim: true,
                            is_diecut: false,
                            is_score: false,
                            is_perforate: false,
                            is_insert: false,
                            insert_type: 0,
                            is_gatefold: true,
                            gatefold_no_of_sheet: 16,
                            gatefold_no_of_pages: 6,
                            is_apply_all: false,
                            apply_all_type: 0,
                            is_drill: false,
                            drill_amount: 0,
                            is_folding: false,
                            is_special_ink: false
                        },
                        process: []
                    },
                    size: {
                        fold_size: [
                            203.2,
                            127,
                            8,
                            5
                        ],
                        open_size: [
                            203.2,
                            127,
                            8,
                            5
                        ],
                        custom_size: [],
                        flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        french_size: [],
                        jacket_flap_size: [
                            0,
                            0,
                            0,
                            0
                        ],
                        jacket_french_size: [
                            0,
                            0,
                            0,
                            0
                        ]
                    },
                    weight: {
                        weight: 0,
                        net_weight: 0,
                        gross_weight: 0
                    }
                }
            ],
            main_process: [],
            custom_process: [],
            process: [],
            size: {
                finish_size: [],
                fold_size: [
                    127,
                    203.2,
                    5,
                    8
                ],
                open_size: [
                    254,
                    203.2,
                    10,
                    8
                ],
                thickness: []
            },
            attach_files: [],
            weight: {
                net_weight: 0,
                gross_weight: 0
            }
        }
    ]
}