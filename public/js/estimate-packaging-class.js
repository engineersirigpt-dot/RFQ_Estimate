const { masterData, generateUniqueId, toNumber } = require('../js/library/index')
const { masterProcessIds, processIdHelpers } = require('../../include/data/est_popup_master_process_ids')
const moment = require('moment')
class PK {
    estData = {
        est_id: null,
        job_name: null,
        binding_id: 1,
        customer_id: null,
        sale_id: null,
        create_by: null,
        update_by: null,
        remark: null,
        status: null,
        "tb_job_files": [],
        "tb_job_qty": [],
        "tb_job_components": [],
        "tb_job_delivery": {},
        "tb_job_packing": {}
    }

    job_id
    json_data = null
    job_data = null
    edition = {}

    constructor(job_id, json_data) {
        this.job_id = job_id
        this.json_data = json_data
    }

    setJobData(json_data) {
        this.json_data = json_data
    }

    setJobId(job_id) {
        this.job_id = job_id
    }

    parseJobData() {
        try {
            this.job_data = JSON.parse(this.json_data)

            return true
        } catch (error) {
            console.log("parseJobData error", error)
            return false
        }
    }

    generateOpenJobData(editedInfo) {
        const { is_multi_version } = this.job_data?.job

        // * Generate Edition Unique ID
        if (is_multi_version) {
            this.job_data?.packing2?.forEach((obj, index) => this.genEditionId(obj?.version_name))
        } else {
            this.genEditionId('single')
        }

        this.estData = this.getMain()
        this.estData = {
            ...this.estData,
            created: editedInfo.created,
            updated: editedInfo.updated,
            create_by: editedInfo.created_by,
            update_by: editedInfo.updated_by,
        }
        this.estData.files = this.getJobFiles()
        const editions = this.getJobEditions()
        this.estData.editions = editions
        this.estData.qty = this.getJobQty()
        this.estData.process = this.getAllJobProcess()
        this.estData.components = this.getJobComponents()
        this.estData.delivery = this.getJobDelivery()
        this.estData.packing = this.getJobPacking()

        // // * For One Editions
        this.estData?.packing?.forEach((obj, index) => obj.components = this.estData?.components?.map(c => ({ component_code: c?.component_code })))
        // this.estData.prices = this.getJobPrice()

        return this.estData
    }

    genEditionId(name = '') {
        this.edition[name] = generateUniqueId('ED-', 20)
        return this.edition[name]
    }

    getEditionId(name = '', qIndex = null) {
        return this.edition[name] + (qIndex != null ? '-' + qIndex : '')
    }

    // ! ---------------------- Convert Data Section ---------------------------
    // * ---------------------- Main ---------------------------
    getMain() {
        const { job_name, ae_id, customer_id, estimator_id, remark, status_id, binding_id, updated_by } = this.job_data?.job
        const { components } = this.job_data || {}

        const print_type = 'SHEET' /* fixed. 06.01.25 */

        return {
            est_id: this.job_id,
            job_name: job_name,
            binding_id: 17, /* POPUP BOOK */
            customer_id: customer_id,
            sale_id: ae_id,
            remark: remark,
            status: masterData.status[status_id],
            job_qty: null,
            prefix: 'EP',
            print_type: print_type,
            "files": [],
            "qty": {},
            "process": [],
            "editions": [],
            "components": [],
            "delivery": {},
            "packing": {},
        }
    }

    // * ---------------------- Files ---------------------------
    getJobFiles() {
        return []
    }

    // * ---------------------- QTY ---------------------------
    // getJobQty(eIndex) {
    //     const data = []
    //     const { qty } = this.job_data?.packing[eIndex] || {}

    //     qty?.forEach((obj, qIndex) => {
    //         const tb_job_qty = {
    //             qty: obj?.qty,
    //             ae_qty: ,
    //             // "tb_job_qty_price": this.getJobQtyPrice()
    //         }

    //         data.push(tb_job_qty)
    //     })

    //     return data
    // }

    getJobQty() {
        // const { color_limit, qty } = this.job_data?.components[0]

        // const data = qty?.qty?.map((obj, qIndex) => {
        //     return {
        //         qty: obj?.qty,
        //         customer_qty: obj?.customer_qty,
        //         ae_qty: obj?.ae_qty,
        //         runon_percentage: obj?.runon_percent,
        //         runon_qty: obj?.runon_qty,
        //         is_color_limit: color_limit?.is_color_limit ? 'YES' : 'NO',
        //         limit_qty: color_limit?.amount || 0,
        //         prices: this.getJobPrice(qIndex)
        //     }
        // })

        const { is_multi_version } = this.job_data?.job
        const { qty } = this.job_data?.templates[0]

        const data = []

        if (is_multi_version) {
            data.push({
                qty: qty?.main_qty,
                customer_qty: qty?.qty?.reduce((a, b) => a + b?.customer_qty, 0),
                ae_qty: qty?.qty?.reduce((a, b) => a + b?.ae_qty, 0),
                runon_percentage: 0,
                runon_qty: qty?.qty?.reduce((a, b) => a + b?.runon_qty, 0),
                is_color_limit: 'NO',
                limit_qty: 0,
                prices: this.getJobPrice(0)
            })
        } else {
            data.push(...qty?.qty?.map((obj, qIndex) => ({
                qty: obj?.qty,
                customer_qty: obj?.customer_qty,
                ae_qty: obj?.ae_qty,
                runon_percentage: obj?.runon_percent || 0,
                runon_qty: obj?.runon_qty || 0,
                is_color_limit: 'NO',
                limit_qty: 0,
                prices: this.getJobPrice(qIndex)
            })))
        }


        // const data = qty?.qty?.map((obj, qIndex) => {
        //     return {
        //         qty: obj?.qty,
        //         customer_qty: obj?.customer_qty,
        //         ae_qty: obj?.ae_qty,
        //         runon_percentage: obj?.runon_percent || 0,
        //         runon_qty: obj?.runon_qty,
        //         is_color_limit: 'NO',
        //         limit_qty: 0,
        //         prices: this.getJobPrice(is_multi_version ? 0 : qIndex)
        //     }
        // })


        return data
    }

    getJobEditions() {
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { templates, packing2 } = this.job_data
        // * 1 Edition : N Qty.
        packing2?.forEach((packingEdition, eIndex) => {
            const { qty } = templates[0]?.qty
            const editionInfo = templates[0]?.qty?.qty[eIndex]

            if (is_multi_version) {
                const { version_name } = editionInfo

                const tb_job_editions = {
                    edition_id: this.getEditionId(version_name),
                    name: version_name,
                    qty: editionInfo?.qty,
                    customer_qty: editionInfo?.customer_qty,
                    ae_qty: editionInfo?.ae_qty,
                    runon_qty: editionInfo?.runon_qty,
                    limit_qty: 0,
                    edition_qty: [
                        {
                            edition_qty_id: this.getEditionId(version_name, 0),
                            qty: editionInfo?.qty,
                            customer_qty: editionInfo?.customer_qty,
                            ae_qty: editionInfo?.ae_qty,
                            runon_percentage: editionInfo?.runon_percent || 0,
                            runon_qty: editionInfo?.runon_qty || 0,
                            is_color_limit: 'NO',
                            limit_qty: 0
                        }
                    ]
                }

                data.push(tb_job_editions)
            } else {
                const tb_job_editions = {
                    edition_id: this.getEditionId('single'),
                    name: "DEFAULT EDITION",
                    qty: 0,
                    customer_qty: 0,
                    ae_qty: 0,
                    runon_qty: 0,
                    limit_qty: 0,
                    edition_qty: qty?.map((obj, qIndex) => {
                        return {
                            edition_qty_id: this.getEditionId('single', qIndex),
                            qty: obj?.qty,
                            customer_qty: obj?.customer_qty,
                            ae_qty: obj?.ae_qty,
                            runon_percentage: obj?.runon_percent || 0,
                            runon_qty: obj?.runon_qty || 0,
                            is_color_limit: 'NO',
                            limit_qty: 0
                        }
                    })
                }

                const total = tb_job_editions?.edition_qty?.reduce((total, obj) => {
                    total.qty += obj?.qty
                    total.customer_qty += obj?.customer_qty
                    total.ae_qty += obj?.ae_qty
                    total.runon_qty += obj?.runon_qty
                    total.limit_qty += obj?.limit_qty

                    return total
                }, {
                    qty: 0,
                    customer_qty: 0,
                    ae_qty: 0,
                    runon_qty: 0,
                    limit_qty: 0
                })

                tb_job_editions.qty = total?.qty
                tb_job_editions.customer_qty = total?.customer_qty
                tb_job_editions.ae_qty = total?.ae_qty
                tb_job_editions.runon_qty = total?.runon_qty
                tb_job_editions.limit_qty = total?.limit_qty

                data.push(tb_job_editions)

            }
        })


        return data
    }

    getJobQtyPrice() {
        const tb_job_qty_price = {
            qty: null,
            job_qty_id: null,
            currency_code: null,
            exchange_rate: null,
            material: null,
            plate: null,
            proof: null,
            "print": null,
            process: null,
            other: null,
            packing: null,
            shipping: null,
            base_total: null,
            base_total_adjust: null,
            customer_gift: null,
            customer_commission_unit_price: null,
            customer_commission: null,
            profit_sharing: null,
            subtotal: null,
            tax_percentage: null,
            tax: null,
            fob: null,
            total: null,
        }

        return []
    }

    getAllJobProcess() {  /* checked */
        const data = []

        const templates = this.job_data?.templates || []

        templates?.forEach((component, index) => {

            data.push(...this.getJobProcess(index))
        })

        return data
    }
    // * ---------------------- Components ---------------------------
    getJobComponents() {  /* checked */
        const data = []

        const { binding_name } = this.job_data?.job || {}
        const { templates: components } = this.job_data || []

        components?.forEach((component, index) => {

            const tb_job_components = {
                component_name: component?.info?.name,
                component_index: index,
                component_no: index + 1,
                component_type_id: masterData?.popup_component_type?.find(obj => obj?.component_name == component?.info?.name)?.component_type_id || null,
                component_code: generateUniqueId(`C-${(('' + index).padStart(2, '0'))}-`, 15),
                "component_info": this.getComponentInfo(index),
                "component_qty": this.getComponentQty(index),
                "component_process": this.getComponentProcess(index),
                "component_files": this.getComponentFiles(index),
                "parts": this.getComponentParts(index)
            }

            data.push(tb_job_components)
        })

        return data
    }

    getComponentInfo(index) {  /* checked */
        const { info, size, weight } = this.job_data?.templates[index] || {}

        const tb_job_component_info = {
            open_size_width_mm: size?.open_size?.length ? size?.open_size[0] : 0,
            open_size_length_mm: size?.open_size?.length ? size?.open_size[1] : 0,
            open_size_width_inch: size?.open_size?.length ? size?.open_size[2] : 0,
            open_size_length_inch: size?.open_size?.length ? size?.open_size[3] : 0,

            fold_size_width_mm: size?.fold_size?.length ? size?.fold_size[0] : 0,
            fold_size_length_mm: size?.fold_size?.length ? size?.fold_size[1] : 0,
            fold_size_height_mm: size?.thickness_arr?.length ? size?.thickness_arr[0] : 0,
            fold_size_width_inch: size?.fold_size?.length ? size?.fold_size[3] : 0,
            fold_size_length_inch: size?.fold_size?.length ? size?.fold_size[4] : 0,
            fold_size_height_inch: size?.thickness_arr?.length ? size?.thickness_arr[1] : 0,

            thickness_mm: size?.thickness_arr?.length ? size?.thickness_arr[0] : 0,
            thickness_inch: size?.thickness_arr?.length ? size?.thickness_arr[1] : 0,

            weight_kg: weight?.gross_weight || 0,
            /* net_weight , gross_weight */

            is_fsc: info?.is_fsc ? 'YES' : 'NO',
            print_type: masterData?.print_type?.find(obj => obj?.id == (info?.print_type + 1))?.name?.toUpperCase() || null,
            ink_type: masterData?.ink_type?.find(obj => obj?.id == (info?.ink_type + 1))?.name?.toUpperCase() || null,
            is_use_prev_plate: info?.is_use_prev_plate ? 'YES' : 'NO',
            is_reprint: info?.is_reprinted ? 'YES' : 'NO',
        }

        return tb_job_component_info
    }

    getComponentQty(index) { /* checked */
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { qty } = this.job_data?.templates[index] || {}

        data.push(...qty?.qty?.map((obj, qIndex) => ({
            edition_qty_id: is_multi_version ? this.getEditionId(obj?.version_name, 0) : this.getEditionId('single', qIndex),
            qty: obj?.qty,
            customer_qty: obj?.customer_qty,
            ae_qty: obj?.ae_qty,
            runon_percentage: obj?.runon_percent || 0,
            runon_qty: obj?.runon_qty || 0,
            is_color_limit: 'NO',
            limit_qty: 0
        })))

        return data
    }

    getComponentProcess(cIndex) {
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { info, size, weight, process, color, paper_info, process_info } = this.job_data?.templates[cIndex] || {}

        if (typeof process_info != 'object') {
            return data
        }

        const listOfProcess = ['material', 'plate', 'proof', 'print', 'process', 'other', 'handwork']

        listOfProcess?.forEach((procType, index) => {
            const processList = process_info[procType]

            if (!processList?.length) return

            processList?.forEach((proc, procIndex) => {
                const { process_id, process_name, remark, unit_id, info, line, is_apply_all_edition } = proc || {}

                // * find unit
                const unitInfo = masterData?.unit?.find(obj => obj?.id == unit_id) || { id: 15, name: 'unit' }

                const tb_job_part_process = {
                    process_id: process_id,
                    process_name: (process_name || remark || '').trim(),
                    unit_id: unitInfo?.id,
                    main_process: 'NO',
                    manual_added: 'NO',
                    apply_all_editions: is_apply_all_edition ? 'YES' : 'NO',
                    unit_price: is_apply_all_edition ? line[0]?.unit_price : 0,
                    price: is_apply_all_edition ? line[0]?.total_price : 0,
                    process_qty: is_apply_all_edition ? line[0]?.qty : 0,
                    remark: remark || process_name,
                    "component_process_editions": is_apply_all_edition ? [] : line?.map((price, qIndex) => {
                        const { description, qty, unit_price, total_price, } = price || {}
                        const version_name = is_multi_version ? description : 'single'
                        return {
                            edition_qty_id: this.getEditionId(version_name, qIndex),
                            process_qty: qty || 0,
                            unit_price: unit_price || 0,
                            price: total_price || 0
                        }
                    })
                }

                data.push(tb_job_part_process)
            })
        })

        return data
    }

    getJobProcess(cIndex) {
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { info, size, weight, process, color, paper_info, process_info } = this.job_data?.templates[cIndex] || {}

        if (typeof process_info != 'object') {
            return data
        }

        const listOfProcess = ['packing', 'extend']

        listOfProcess?.forEach((procType, index) => {
            const processList = process_info[procType]

            if (!processList?.length) return

            processList?.forEach((proc, procIndex) => {
                const { process_id, process_name, remark, unit_id, info, line, is_apply_all_edition } = proc || {}

                // * find unit
                const unitInfo = masterData?.unit?.find(obj => obj?.id == unit_id) || { id: 15, name: 'unit' }

                const tb_job_part_process = {
                    process_id: process_id,
                    process_name: (process_name || remark || '').trim(),
                    unit_id: unitInfo?.id,
                    main_process: 'NO',
                    manual_added: 'NO',
                    apply_all_editions: is_apply_all_edition ? 'YES' : 'NO',
                    unit_price: is_apply_all_edition ? line[0]?.unit_price : 0,
                    price: is_apply_all_edition ? line[0]?.total_price : 0,
                    process_qty: is_apply_all_edition ? line[0]?.qty : 0,
                    remark: remark || process_name,
                    "process_editions": is_apply_all_edition ? [] : line?.map((price, qIndex) => {
                        const { description, qty, unit_price, total_price, } = price || {}
                        const version_name = is_multi_version ? description : 'single'
                        return {
                            edition_qty_id: this.getEditionId(version_name, qIndex),
                            process_qty: qty || 0,
                            unit_price: unit_price || 0,
                            price: total_price || 0
                        }
                    })
                }

                data.push(tb_job_part_process)
            })
        })

        return data
    }

    // getComponentProcessEdition() {
    //     const tb_job_component_process_edition = {
    //         edition_id: "",
    //         process_qty: 0,
    //         unit_id: null,
    //         unit_name: ""
    //     }

    //     return []
    // }

    getComponentFiles(index) {
        const data = []

        const { files } = this.job_data?.templates[index] || {}

        files?.forEach((obj, index) => {
            const tb_job_component_files = {
                file_name: obj?.path?.split('/').pop(),
                file_original_name: obj?.fileName,
                file_path: obj?.path,
                file_index: index,
                file_type: "OTHER",
            }

            data.push(tb_job_component_files)
        })

        return data
    }

    getComponentParts(index) {
        const data = []

        const { components: sub_components } = this.job_data?.templates[index] || {}

        sub_components?.forEach((part, pIndex) => {
            const { info } = part || {}

            const tb_job_component_parts = {
                part_type_id: masterData?.part?.find(obj => obj?.popup_id?.includes(info?.id))?.id,
                part_index: pIndex,
                part_no: info?.no || 1,
                part_name: info?.description,
                "part_qty": this.getPartQty(index, pIndex),
                "part_info": this.getPartInfo(index, pIndex),
                "part_paper": this.getPartPaper(index, pIndex),
                "part_process": this.getPartProcess(index, pIndex),
                "part_editions": this.getPartEdition(index, pIndex),
                "part_layout": this.getPartLayout(index, pIndex)
            }

            data.push(tb_job_component_parts)
        })

        return data
    }

    getPartQty(cIndex, pIndex) {
        const data = []
        const { is_multi_version } = this.job_data?.job
        const component = this.job_data?.templates[cIndex] || {}
        const { info, size, weight, process, color, paper_usage } = component?.components[pIndex] || {}

        paper_usage?.line?.forEach((obj, qIndex) => {
            const tb_job_component_part_qty = {
                edition_qty_id: is_multi_version ? this.getEditionId(obj?.name, 0) : this.getEditionId('single', qIndex),
                qty: obj?.qty,
                "part_paper_usage": this.getPartPaperUsage(cIndex, pIndex, qIndex)
            }

            data.push(tb_job_component_part_qty)
        })

        return data
    }

    getPartInfo(cIndex, pIndex) {
        const component = this.job_data?.templates[cIndex] || {}
        const { info, size, weight, process, color, layout, paper: { input: paperInput } } = component?.components[pIndex] || {}

        const tb_job_component_part_info = {
            open_size_width_mm: size?.open_size[0],
            open_size_length_mm: size?.open_size[1],
            open_size_width_inch: size?.open_size[2],
            open_size_length_inch: size?.open_size[3],
            fold_size_width_mm: size?.fold_size[0],
            fold_size_length_mm: size?.fold_size[1],
            fold_size_height_mm: size?.thickness?.length ? size?.thickness[0] : 0,  /* no data */
            fold_size_width_inch: size?.fold_size[3],
            fold_size_length_inch: size?.fold_size[4],
            fold_size_height_inch: size?.thickness?.length ? size?.thickness[1] : 0,  /* no data */
            thickness_mm: size?.thickness?.length ? size?.thickness[0] : 0,  /* no data */
            thickness_inch: size?.thickness?.length ? size?.thickness[1] : 0,  /* no data */
            weight_kg: weight?.gross_weight,
            is_fsc: info?.is_fsc ? 'YES' : 'NO',
            print_type: masterData?.print_type?.find(obj => obj?.id == (info?.print_type + 1))?.name?.toUpperCase(),
            ink_type: masterData?.ink_type?.find(obj => obj?.id == (info?.ink_type + 1))?.name?.toUpperCase(), /* no data */
            is_use_prev_plate: info?.is_use_prev_plate ? 'YES' : 'NO',
            is_reprint: info?.is_reprinted ? 'YES' : 'NO',
            grain_type: layout?.selected_layout?.grain_box_type === 'vertical' ? 'W' : 'H',  /* no data */

            pages: process?.input?.no_of_pages || process?.input?.no_of_pages_brochure || 0,  /* no data */
            sheet: process?.input?.sheet || 0,  /* no data */
            page_per_sheet: process?.input?.total_no_of_pages || 0,  /* no data */
            print: 'SHEET'
        }

        return tb_job_component_part_info
    }

    getPartPaperUsage(cIndex, pIndex, qIndex) {
        const data = []
        const component = this.job_data?.templates[cIndex] || {}
        const { info, size, weight, process, color, paper_usage } = component?.components[pIndex] || {}

        const {
            ups,
            after_ups,
            waste,
            after_waste,
            sig,
            paper_print,
            split,
            paper_qty,
            paper_net,
            weight_kg,
            weight_ton,
            qty,
        } = paper_usage?.line[qIndex] || {}

        data.push({
            ups,
            after_ups,
            waste,
            after_waste,
            sig,
            sig_type: 'MAIN',
            paper_print,
            split,
            paper_qty,
            paper_net,
            weight_kg,
            weight_ton,
            qty
        })

        if (paper_usage?.sub_line?.length) {
            const subSig = paper_usage?.sub_line[qIndex]

            data.push({
                ups: subSig?.ups,
                after_ups: subSig?.after_ups,
                waste: subSig?.waste,
                after_waste: subSig?.after_waste,
                sig: subSig?.sig,
                sig_type: 'SUB',
                paper_print: subSig?.paper_print,
                split: subSig?.split,
                paper_qty: subSig?.paper_qty,
                paper_net: subSig?.paper_net,
                weight_kg: subSig?.weight_kg,
                weight_ton: subSig?.weight_ton,
                qty: subSig?.qty
            })
        }

        return data
    }

    getPartPaper(cIndex, pIndex) {
        const data = []

        const component = this.job_data?.templates[cIndex] || {}
        const { info, size, weight, process, color, paper } = component?.components[pIndex] || {}

        const {
            input, is_board, paper_info, paper_ref_size, paper_size, std_paper_id, paper_price_info
        } = paper

        const tb_job_component_part_paper = {
            paper_id: null, /* ไม่มีข้อมูล */
            paper_code: input?.paper_code || (!input?.is_custom_paper ? input?.paper_type?.split(' ')[0] : null),
            paper_type: input?.paper_type || null,
            paper_name: input?.paper_name || null,
            paper_gram: input?.paper_gram || 0,
            thickness_mm: input?.paper_thickness || 0,
            thickness_micron: toNumber(input?.paper_gram * 100, 0) || 0, /* ไม่มีข้อมูล */
            is_baht_per_sheet: input?.price_per_sheet ? 'YES' : 'NO',
            cost: input?.paper_cost || 0,
            roll_cut_price: input?.paper_roll_cut_price || 0,
            markup_percentage: input?.paper_markup || 0,
            markup_price: input?.paper_markup_price || toNumber((input?.paper_sale - input?.paper_roll_cut_price - input?.paper_cost), 2) || 0,
            sale_price: input?.paper_sale,
            paper_width: paper_size[2],
            paper_length: paper_size[3],
            source_paper_width: paper_ref_size?.length ? paper_ref_size[2] : paper_size[2],
            source_paper_length: paper_ref_size?.length ? paper_ref_size[3] : paper_size[3],
            std_paper_id: std_paper_id || null,
            is_custom_paper: input?.is_custom_paper ? 'YES' : 'NO',
        }

        data.push(tb_job_component_part_paper)

        return data
    }

    getPartProcess(cIndex, pIndex) {
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { info, size, weight, process, color, paper_info, process_info } = this.job_data?.templates[cIndex]?.components[pIndex] || {}

        if (typeof process_info != 'object') {
            return data
        }

        const listOfProcess = ['material', 'plate', 'proof', 'print', 'process', 'other', 'handwork', 'packing']

        listOfProcess?.forEach((procType, index) => {
            const processList = process_info[procType]

            if (!processList?.length) return

            processList?.forEach((proc, procIndex) => {
                const { process_id, process_name, remark, unit_id, info, line, is_apply_all_edition } = proc || {}

                // * find unit
                const unitInfo = masterData?.unit?.find(obj => obj?.id == unit_id) || { id: 15, name: 'unit' }

                // console.log("line", process_name, line)

                const tb_job_part_process = {
                    process_id: process_id,
                    process_name: (process_name || remark || '').trim(),
                    unit_id: unitInfo?.id,
                    main_process: 'NO',
                    manual_added: 'NO',
                    apply_all_editions: is_apply_all_edition ? 'YES' : 'NO',
                    unit_price: is_apply_all_edition ? line[0]?.unit_price : 0,
                    price: is_apply_all_edition ? line[0]?.total_price : 0,
                    process_qty: is_apply_all_edition ? line[0]?.qty : 0,
                    remark: remark || process_name,
                    "part_process_editions": is_apply_all_edition ? [] : line?.map((price, qIndex) => {
                        const { description, qty, unit_price, total_price, } = price || {}
                        const version_name = is_multi_version ? description : 'single'
                        return {
                            edition_qty_id: this.getEditionId(version_name, qIndex),
                            process_qty: qty || 0,
                            unit_price: unit_price || 0,
                            price: total_price || 0
                        }
                    })
                }

                data.push(tb_job_part_process)
            })
        })

        return data
    }

    getPartEdition(cIndex, pIndex) {
        const data = []
        const { is_multi_version } = this.job_data?.job
        const { info, size, weight, process, color, paper_info } = this.job_data?.templates[cIndex]?.components[pIndex] || {}

        this.estData.editions?.forEach((obj, index) => {
            const tb_job_component_part_edition = {
                edition_id: obj?.edition_id,
                outside_color: color?.color?.outside || 0,
                inside_color: color?.color?.inside || 0,
                is_outside_color_dieline: color?.color?.outside_color_type == 'dieline' ? 'YES' : 'NO',
                is_inside_color_dieline: color?.color?.inside_color_type == 'dieline' ? 'YES' : 'NO',
                is_outside_black_print: color?.color?.is_back_printing_outside ? 'YES' : 'NO', /* no data */
                is_inside_black_print: color?.color?.is_back_printing_inside ? 'YES' : 'NO', /* no data */
                is_apply_all_edition: !color?.plate?.is_change ? 'YES' : 'NO',
                is_plate_change: color?.plate?.is_change ? 'YES' : 'NO', /* no data */
                plate_change_outside_color: color?.plate?.change_outside,
                plate_change_inside_color: color?.plate?.change_inside,
                is_has_special_ink: color?.special_ink?.length ? 'YES' : 'NO',

                "part_edition_special_ink": this.getPartSpecialInk(cIndex, pIndex)
            }

            data.push(tb_job_component_part_edition)
        })


        return data
    }

    getPartSpecialInk(cIndex, pIndex) {
        const data = []
        const { info, size, weight, process, color, paper_info } = this.job_data?.templates[cIndex]?.components[pIndex] || {}

        color?.special_ink?.forEach((ink, inkIndex) => {
            const tb_job_component_part_special_ink = {
                special_ink_name: ink?.info?.ink_name,
                filling_style: ink?.info?.print_style?.toUpperCase() || null,
                ink_type: masterData?.special_ink_type?.find(obj => obj?.name_th == ink?.name)?.id, /* now is id. */
            }

            data.push(tb_job_component_part_special_ink)
        })

        return data
    }

    getPartLayout(cIndex, pIndex) {
        const { info, size, weight, process, color, paper, layout } = this.job_data?.templates[cIndex]?.components[pIndex] || {}
        const { selected_layout } = layout || {}

        const tb_job_component_part_layout = {
            open_size_width_mm: size?.open_size[0],
            open_size_length_mm: size?.open_size[1],
            open_size_width_inch: size?.open_size[2],
            open_size_length_inch: size?.open_size[3],

            num_lay_width: selected_layout?.layout[0],
            num_lay_length: selected_layout?.layout[1],
            lay_amount: selected_layout?.num_laying,
            paper_lay_size_width_mm: selected_layout?.paper_lay[0],
            paper_lay_size_length_mm: selected_layout?.paper_lay[1],
            paper_lay_size_width_inch: selected_layout?.paper_lay[2],
            paper_lay_size_length_inch: selected_layout?.paper_lay[3],
            print_size_width_mm: selected_layout?.printing[0],
            print_size_length_mm: selected_layout?.printing[1],
            print_size_width_inch: toNumber(selected_layout?.printing[0] / 25.4, 2),
            print_size_length_inch: toNumber(selected_layout?.printing[1] / 25.4, 2),
            layout_size_width_mm: selected_layout?.layout_size[0],
            layout_size_length_mm: selected_layout?.layout_size[1],
            layout_size_width_inch: selected_layout?.layout_size[2],
            layout_size_length_inch: selected_layout?.layout_size[3],
            gripper_mm: selected_layout?.tolerance?.gripper || 0,
            color_bar_mm: selected_layout?.tolerance?.color_bar || 0,
            bleed_mm: selected_layout?.tolerance?.bleed || 0,
            paper_edge_mm: selected_layout?.tolerance?.paper_edge || 0,
            layout_edge: selected_layout?.tolerance?.layout_edge || 0,
            is_manual_tolerance: layout?.is_manual_tolerance ? 'YES' : 'NO',
            is_manual_layout_size: layout?.is_manual_layout ? 'YES' : 'NO',
            is_manual_paper_size: paper?.std_paper_id ? 'NO' : 'YES',
            is_manual_num_layout: layout?.is_manual_laying ? 'YES' : 'NO',
            is_manual_layout_grain: "NO",
            layout_grain: layout?.layout_grain == 'horizontal' ? "L" : "W" || null,
            selected_layout_grain: selected_layout?.laying ? selected_layout?.laying == 'horizontal' ? "L" : "W" : layout?.layout_Grain == 'vertical' ? 'W' : 'L' || null,
            part_grain: selected_layout?.grain_box_type ? selected_layout?.grain_box_type == 'horizontal' ? "L" : "W" : null,
            lay_type: selected_layout?.laying_type ? selected_layout?.laying_type?.toUpperCase() : null, /* [STRAIGHT, OVERLAP] */
            laying: selected_layout?.laying?.toUpperCase() || null, /* [VERTICAL, HORIZONTAL] */
        }

        return tb_job_component_part_layout
    }

    // * ---------------------- Delivery ---------------------------
    getJobDelivery() {
        const { is_multi_version, templates } = this.job_data?.job

        const delivery_detail = [
            {
                delivery_location_id: null,
                delivery_location_name: null,
                delivery_date: null,
                delivery_total_qty: this.estData?.qty?.reduce((total, obj) => total + obj?.qty, 0) + this.estData?.qty?.reduce((total, obj) => total + obj?.runon_qty, 0),
                delivery_method: 'OVERSEA',
                "delivery_editions": is_multi_version
                    ? this.estData?.editions?.map((obj, index) => ({
                        delivery_qty: obj?.qty + obj?.runon_qty,
                        edition_qty_id: this.getEditionId(obj?.name, 0)
                    }))
                    : this.estData?.qty?.map((obj, index) => ({
                        delivery_qty: obj?.qty,
                        edition_qty_id: this.getEditionId('single', index)
                    }))
            }
        ]

        const tb_job_delivery = {
            delivery_type: 'EXPORT',
            split_delivery: 'NO',
            "delivery_detail": [...delivery_detail?.flat()]
        }

        return tb_job_delivery
    }
    // * ---------------------- Packing ---------------------------

    getJobPacking(index) {
        const data = []

        const { is_multi_version } = this.job_data?.job
        const { packing2 } = this.job_data

        this.estData?.editions?.forEach((edition, eIndex) => {
            const { name } = edition || {}

            let packingEdition = null
            let edition_name = name

            if (is_multi_version) {
                packingEdition = packing2?.find(obj => obj?.version_name == name) || null

            } else {
                packingEdition = packing2[0]
                edition_name = 'single'
            }

            if (!packingEdition) return

            const { packing } = packingEdition

            // * ------------- Packing ------------------
            const paperband = packing?.find(obj => obj?.process_id == 39) || null
            const kraft_wrap = packing?.find(obj => obj?.process_id == 40) || null
            const carton = packing?.find(obj => obj?.process_id == 41) || null
            const pallet = packing?.find(obj => obj?.process_id == 42) || null

            const packingPaperband = null //this.getJobPackingPaperband(paperband)
            const packingKraftWrap = null //this.getJobPackingKraftWrap(kraft_wrap)
            const packingCarton = this.getJobPackingCarton(carton)
            const packingPallet = this.getJobPackingPallet(pallet)


            const tb_job_packing = {
                edition_id: this.getEditionId(edition_name),
                inner_size_width_inch: null,
                inner_size_length_inch: null,
                inner_size_height_inch: null,
                outer_size_width_inch: null,
                outer_size_length_inch: null,
                outer_size_height_inch: null,
                net_weight_kg: null,
                gross_weight_kg: null,
                unit_id: null,
                unit_name: null,
                qty_per_pack: null,
                components: [],
                "paperband": null,
                "kraft_wrap": null,
                "pallet": null,
                "carton": null,
            }

            let outerPacking = null

            if (packingPaperband) {
                tb_job_packing.paperband = packingPaperband
                outerPacking = packingPaperband
            }

            if (packingKraftWrap) {
                tb_job_packing.kraft_wrap = packingKraftWrap
                outerPacking = packingKraftWrap
            }

            if (packingCarton) {
                tb_job_packing.carton = packingCarton
                outerPacking = packingCarton
            }

            if (packingPallet) {
                tb_job_packing.pallet = packingPallet
                outerPacking = packingPallet
            }


            tb_job_packing.inner_size_width_inch = outerPacking.inner_size_width_inch
            tb_job_packing.inner_size_length_inch = outerPacking.inner_size_length_inch
            tb_job_packing.inner_size_height_inch = outerPacking.inner_size_height_inch
            tb_job_packing.outer_size_width_inch = outerPacking.outer_size_width_inch
            tb_job_packing.outer_size_length_inch = outerPacking.outer_size_length_inch
            tb_job_packing.outer_size_height_inch = outerPacking.outer_size_height_inch
            tb_job_packing.net_weight_kg = outerPacking.net_weight_kg
            tb_job_packing.gross_weight_kg = outerPacking.gross_weight_kg
            tb_job_packing.unit_id = outerPacking.unit_id
            tb_job_packing.unit_name = outerPacking.unit_name
            tb_job_packing.qty_per_pack = outerPacking.qty_per_pack

            data.push(tb_job_packing)
        })


        return data
    }

    getJobPackingPaperband(paperband) {
        let tb_job_packing_paperband = null

        if (paperband) {
            const {
                stack_size = [],
                stack_weight,
                unit_pack,
                weight_per_pcs,
                which_side_shorter,
                stack_height,
                size_order,
                qty_per_pack,
                qty_per_paperband,
                is_custom_qty_per_paperband,
                paperband_type = {},
                thickness_per_pcs,
                circ
            } = paperband?.info || {}

            const bulkUnitInfo = masterData?.unit?.find(u => u?.name == unit_pack) || masterData?.unit?.find(u => u?.name == 'unit')

            tb_job_packing_paperband = {
                inner_size_width_inch: 2.3,
                inner_size_length_inch: 3.34,
                inner_size_height_inch: 15.85,
                outer_size_width_inch: stack_size[3],
                outer_size_length_inch: stack_size[4],
                outer_size_height_inch: stack_size[5],
                net_weight_kg: stack_weight,
                gross_weight_kg: stack_weight,
                tare_weight: 0.0001,  /* no data */
                unit_id: 11,
                unit_name: "paperband",
                bulk_unit_id: bulkUnitInfo?.id,
                bulk_unit_name: bulkUnitInfo?.name,
                layer: qty_per_pack,
                bulk_qty_per_layer: 1,  /* no data */
                bulk_qty_per_pack: qty_per_paperband,
                qty_per_pack: qty_per_pack,
                layout_qty_width: 1,  /* no data */
                layout_qty_length: 1,  /* no data */
                is_custom_qty_per_pack: is_custom_qty_per_paperband ? 'YES' : 'NO',
                diameter: circ,
                size_order: size_order,
                wrap_side: which_side_shorter,
                paperband_id: paperband_type?.id + 1,
                paperband_name: paperband_type?.type,
                paperband_thickness_mm: paperband_type?.thickness
            }
        }

        return tb_job_packing_paperband
    }

    getJobPackingKraftWrap(kraft_wrap) {
        let tb_job_packing_kraft_wrap = null

        if (kraft_wrap) {
            const {
                bulk, component_info, info, size, weight, bulk_info
            } = kraft_wrap || {}

            const bulkUnitInfo = masterData?.unit?.find(u => u?.name == info?.unit_pack) || masterData?.unit?.find(u => u?.name == 'unit')

            tb_job_packing_kraft_wrap = {
                inner_size_width_inch: size?.inner_size[3],
                inner_size_length_inch: size?.inner_size[4],
                inner_size_height_inch: size?.inner_size[5],
                outer_size_width_inch: size?.outer_size[3],
                outer_size_length_inch: size?.outer_size[4],
                outer_size_height_inch: size?.outer_size[5],
                net_weight_kg: weight?.net_weight,
                gross_weight_kg: weight?.gross_weight,
                tare_weight: 0.0001,
                unit_id: 12,
                unit_name: "kraft wrap",
                bulk_unit_id: bulkUnitInfo?.id,
                bulk_unit_name: bulkUnitInfo?.name,
                layer: info?.layer_per_pack,
                bulk_qty_per_layer: info?.qty_per_kraftwrap,
                bulk_qty_per_pack: info?.qty_per_kraftwrap,
                qty_per_pack: info?.qty_per_pack,
                layout_qty_width: info?.layout[0],
                layout_qty_length: info?.layout[1],
                is_custom_qty_per_pack: info?.is_custom_qty_per_kraftwrap ? 'YES' : 'NO',
            }
        }

        return tb_job_packing_kraft_wrap
    }

    getJobPackingCarton(carton) {
        let tb_job_packing_carton = null

        if (carton) {
            const {
                bulk, bulk_info, component_info, corrugated, info, size, weight, unit
            } = carton || {}

            const bulkUnitInfo = masterData?.unit?.find(u => u?.name == unit) || masterData?.unit?.find(u => u?.name == 'unit')

            tb_job_packing_carton = {
                inner_size_width_inch: size?.inner_size[0],
                inner_size_length_inch: size?.inner_size[1],
                inner_size_height_inch: size?.inner_size[2],
                outer_size_width_inch: size?.outer_size[0],
                outer_size_length_inch: size?.outer_size[1],
                outer_size_height_inch: size?.outer_size[2],
                net_weight_kg: weight?.net_weight,
                gross_weight_kg: weight?.gross_weight,
                tare_weight: 1.00,
                unit_id: 13,
                unit_name: "carton",
                bulk_unit_id: bulkUnitInfo?.id || null,
                bulk_unit_name: bulkUnitInfo?.name || null,
                is_custom_inner_size: info?.is_custom_inner_size ? 'YES' : 'NO',
                is_custom_qty_per_carton: info?.is_custom_pcs_per_carton ? 'YES' : 'NO',
                is_print_on_carton: info?.is_carton_printing ? 'YES' : 'NO',
                layer: info?.carton_row,
                bulk_qty_per_layer: info?.qty_per_row,
                bulk_qty_per_pack: info?.pcs_per_carton,
                qty_per_pack: info?.pcs_per_carton,
                layout_qty_width: info?.layout[0],
                layout_qty_length: info?.layout[1],
                grade: corrugated?.grade,
                corrugated_layer: corrugated?.corrugated_layer,
                corrugated_flute: corrugated?.flute_type,
                type: corrugated?.type?.join(','),
                gram: corrugated?.gram?.join(','),
                total_gram: corrugated?.all_gram,
                thickness_mm: corrugated?.thickness,
                area: corrugated?.area_corrugated,
                is_275lbs_carton: info?.is_use_275_lbs ? 'YES' : 'NO',
            }
        }

        return tb_job_packing_carton
    }

    getJobPackingPallet(pallet) {
        let tb_job_packing_pallet = null

        if (pallet) {
            const {
                bluk, component_info, info, size, weight, bulk_info, unit
            } = pallet || {}

            const bulkUnitInfo = masterData?.unit?.find(u => u?.name == unit) || masterData?.unit?.find(u => u?.name == 'unit')

            tb_job_packing_pallet = {
                inner_size_width_inch: info?.bulk_size[0],
                inner_size_length_inch: info?.bulk_size[1],
                inner_size_height_inch: info?.bulk_size[2],
                outer_size_width_inch: info?.pallet_size[0],
                outer_size_length_inch: info?.pallet_size[1],
                outer_size_height_inch: info?.pallet_height,
                net_weight_kg: info?.pallet_weight,
                gross_weight_kg: info?.pallet_weight + 25,
                tare_weight: toNumber(weight?.gross_weight - weight?.pallet_weight, 2),
                pallet_id: info?.pallet_id,
                pallet_name: `${info?.pallet_size?.join(' x ')}\"`,
                unit_id: 14,
                unit_name: "pallet",
                bulk_unit_id: bulkUnitInfo?.id,
                bulk_unit_name: bulkUnitInfo?.name,
                is_mif_pallet: info?.is_mif_pallet ? 'YES' : 'NO',
                is_custom_qty_per_pallet: info?.is_custom_carton_per_pallet ? 'YES' : 'NO',
                layer: info?.layer_per_pallet || 0,
                bulk_qty_per_layer: info?.carton_per_pallet_layer || 0,
                bulk_qty_per_pack: toNumber(info?.carton_per_pallet_layer * info?.layer_per_pallet, 0) || 0,
                qty_per_pack: info?.qty_per_pallet || 0
            }
        }

        return tb_job_packing_pallet
    }

    getJobPrice(qIndex) {
        const {
            total_price: {
                components,
                fob_percent,
                tax_percent = 0,
                total
            },
            job } = this.job_data
        // const { total, fob_percent, tax_percent, components } = total_price || {}

        const summaryByComponent = components?.reduce((total, component) => {
            const compTotal = component.total[qIndex]

            total.customer_gift += compTotal?.customer_gift || 0
            total.customer_commission += compTotal?.customer_price_diff || 0
            total.customer_commission_unit_price += compTotal?.customer_price_diff_ratio || 0
            total.sub_total_price_marking += compTotal?.sub_total_price_marking || 0

            return total
        }, {
            customer_gift: 0,
            customer_commission: 0,
            customer_commission_unit_price: 0,
            sub_total_price_marking: 0,
        })

        const price = total[qIndex]
        const tb_job_price = {
            // edition_id: this.getEditionId('single'),
            // edition_qty_id: this.getEditionId('single', pIndex),
            // qty_id: this.getEditionId('single', pIndex),
            qty: price?.main_qty || 0,
            base_total: summaryByComponent?.sub_total_price_marking || 0, /* subtotal price + markup */
            customer_gift: summaryByComponent?.customer_gift || 0,
            customer_commission_unit_price: summaryByComponent?.customer_commission_unit_price || 0,
            customer_commission: summaryByComponent?.customer_commission || 0,
            profit_sharing: price?.profit_sharing || 0,
            tax_percentage: tax_percent || 0,
            tax: price?.tax || 0,
            subtotal: price?.total_price || 0, /* subtotal price + ส่วนต่าง + ของขวัญ */
            fob_percentage: fob_percent || 0,
            fob: price?.total_price_fob || 0,
            total_thb: price?.total_price_fob_thb || 0,
            unit_price_thb: price?.unit_price || 0,
            currency_code: price?.currency_no || 0,
            exchange_rate: price?.exchange_rate || 0,
            total: price?.total_price_fob_exchange || 0,
            unit_price: price?.unit_price_exchange || 0,
            total_adjust: 0,
            unit_price_adjust: 0
        }

        return tb_job_price
    }
}

module.exports = PK