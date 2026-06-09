// Reads AI-extracted spec from sessionStorage and populates the estimate form.
// Runs only when /estimate?ai=1 is opened. After fill, a banner reminds user to
// verify (especially AE/Customer which need to be picked via autocomplete).

$(function () {
	if (location.search.indexOf('ai=1') === -1) return
	const raw = sessionStorage.getItem('ai_rfq_data')
	if (!raw) return
	let aiData
	try {
		aiData = JSON.parse(raw)
	} catch (e) {
		console.error('AI data not valid JSON', e)
		sessionStorage.removeItem('ai_rfq_data')
		return
	}
	let aiInput = null
	try {
		const inputRaw = sessionStorage.getItem('ai_rfq_input')
		if (inputRaw) aiInput = JSON.parse(inputRaw)
	} catch (e) {
		/* ignore */
	}
	sessionStorage.removeItem('ai_rfq_data')
	sessionStorage.removeItem('ai_rfq_input')

	$('<style>').text(
		'.ai-uncertain { outline: 2px solid #f59e0b !important; background-color: #fffbeb !important; border-radius: 3px; }' +
		'.ai-uncertain-wrap { outline: 2px solid #f59e0b !important; background-color: #fffbeb !important; border-radius: 4px; padding: 2px; }'
	).appendTo('head')

	waitForReady().then(() => fillForm(aiData, aiInput))

	function waitForReady() {
		return new Promise((resolve) => {
			let tries = 0
			const check = () => {
				tries++
				const ready =
					typeof db !== 'undefined' &&
					db &&
					db.db &&
					((Array.isArray(db.db.paper_info) && db.db.paper_info.length > 0) ||
						(db.db.paper && Array.isArray(db.db.paper))) &&
					$('.paperType').length > 0
				if (ready) {
					setTimeout(resolve, 400)
				} else if (tries > 100) {
					console.warn('AI auto-fill: form readiness timeout — proceeding anyway')
					resolve()
				} else {
					setTimeout(check, 200)
				}
			}
			check()
		})
	}

	function setVal($el, v) {
		if (!$el.length || v == null || v === '') return
		$el.val(v).trigger('change')
	}

	function normalize(s) {
		return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
	}

	function findOptionMatch($select, target) {
		if (!target) return null
		const t = normalize(target)
		const tNoSpace = t.replace(/\s+/g, '')
		let exact = null,
			contains = null,
			tokenMatch = null
		const tokens = t.split(/\s+/).filter((x) => x.length > 1)
		$select.find('option').each(function () {
			const rawTxt = $(this).text()
			const rawVal = $(this).val()
			if (!rawTxt && !rawVal) return
			const txt = normalize(rawTxt)
			const txtNoSpace = txt.replace(/\s+/g, '')
			const val = normalize(rawVal)
			if (txt === t || val === t || txtNoSpace === tNoSpace) {
				exact = rawVal
				return false
			}
			if (!contains && txt && (txt.indexOf(t) !== -1 || t.indexOf(txt) !== -1)) {
				contains = rawVal
			}
			if (!tokenMatch && tokens.length > 0 && tokens.every((tok) => txt.indexOf(tok) !== -1)) {
				tokenMatch = rawVal
			}
		})
		return exact != null ? exact : contains != null ? contains : tokenMatch
	}

	function fillForm(d, input) {
		try {
			fillJobInfo(d)
			fillJobDetail(d)
			fillQuantities(d)
			fillComponents(d)
			fillProcesses(d)
			fillDeliveries(d)
			const uncertainCount = highlightUncertain(d)
			showAIBanner(d, input, uncertainCount)
			if (typeof checkRequiredInput === 'function') checkRequiredInput()
		} catch (e) {
			console.error('AI auto-fill error', e)
			alert('AI กรอกข้อมูลไม่สำเร็จบางส่วน: ' + e.message + '\nกรุณาตรวจสอบฟอร์ม')
		}
	}

	function highlightUncertain(d) {
		const fields = Array.isArray(d._uncertain) ? d._uncertain : []
		if (fields.length === 0) return 0
		const MAP = {
			job_name:        () => $('#jobName input'),
			customer_name:   () => $('#customerLabel'),
			ae_name:         () => $('#aeLabel'),
			print_type:      () => $('#print_type select'),
			ink_type:        () => $('#ink_type select'),
			quantities:      () => $('#qty_info .inputQty input'),
			paper_type:      () => $('.paperType'),
			paper_gram:      () => $('.paperGram'),
			box_template_id: () => $('.boxType'),
			color_outside:   () => $('.colorOutside'),
			color_inside:    () => $('.colorInside'),
			coatings:        () => $('.coatingInput'),
			corrugated:      () => $('.corrugatedInput'),
			dimensions_mm:   () => $('.specmm'),
			deliveries:      () => $('.deliveryDestinationName'),
		}
		// Delay until all fills + their internal setTimeouts complete
		setTimeout(() => {
			fields.forEach((field) => {
				const fn = MAP[field]
				if (!fn) return
				fn().addClass('ai-uncertain')
			})
		}, 1500)
		return fields.length
	}

	function fillDeliveries(d) {
		const list = Array.isArray(d.deliveries) ? d.deliveries.filter((x) => x && x.destination) : []
		if (list.length === 0 || typeof addProcess !== 'function') return
		// Wait briefly so the form's row template helpers (component dropdown,
		// balance qty calc) have stable values to clone from.
		setTimeout(() => {
			list.forEach((dlv) => {
				addProcess('delivery')
				const $row = $('#deliveryProcess tr.deliveryProcess').last()
				if (!$row.length) return
				if (dlv.destination) {
					$row.find('.deliveryDestinationName').first().val(dlv.destination).trigger('change').trigger('input')
				}
				if (dlv.qty != null) {
					$row.find('.deliveryQty input').first().val(dlv.qty).trigger('change').trigger('input')
				}
				if (dlv.delivery_date) {
					$row.find('.deliveryDate').first().val(dlv.delivery_date).trigger('change').trigger('input')
				}
			})
		}, 600)
	}

	function fillJobInfo(d) {
		if (d.job_name) setVal($('#jobName input').first(), d.job_name)
		if (d.ae_name) setVal($('#aeLabel'), d.ae_name)
		if (d.customer_name) setVal($('#customerLabel'), d.customer_name)
		if (d.is_new_customer === true) $('#is_newCustomer').prop('checked', true).trigger('change')
	}

	function fillJobDetail(d) {
		if (d.is_reprinted != null) setVal($('#is_reprinted select'), String(d.is_reprinted))
		if (d.ink_type) setVal($('#ink_type select'), d.ink_type)
		if (d.print_type) {
			setVal($('#print_type select'), d.print_type)
			if (d.print_type === 'Flexo' && d.flexo_size) {
				$('#flexo_size').show()
				const $inputs = $('#flexo_size input')
				if (d.flexo_size.w != null && $inputs.length >= 1) $inputs.eq(0).val(d.flexo_size.w).trigger('change')
				if (d.flexo_size.h != null && $inputs.length >= 2) $inputs.eq(1).val(d.flexo_size.h).trigger('change')
			}
		}
		// "Rep." in title → use previous plate. Reveal the (normally hidden)
		// container, then check the box.
		if (d.use_previous_plate === true) {
			setTimeout(() => {
				$('.use_prev_plate').removeClass('d-none')
				const $chk = $('#is_use_previous_plate')
				if ($chk.length && !$chk.is(':checked')) $chk[0].click()
			}, 400)
		}
	}

	function fillQuantities(d) {
		if (d.runon_percent != null) {
			$('.runonPercent').first().val(d.runon_percent).trigger('change')
		}
		if (d.paper_markup_percent != null) {
			$('.paperMarkup input').first().val(d.paper_markup_percent).trigger('change')
		}

		// Multi-F mode (งานมีหลาย F): each F has its own code + qty.
		const fCodes = Array.isArray(d.f_codes) ? d.f_codes.filter((x) => x && (x.code || x.qty != null)) : []
		if (d.is_multiple_f === true || fCodes.length > 1) {
			fillMultipleF(fCodes)
			return
		}

		const qtys = Array.isArray(d.quantities) ? d.quantities.filter((x) => x != null) : []
		if (qtys.length === 0) return
		// Scope strictly to #qty_info — without this we count rows from the
		// hidden #multiple_f_qty_info container too, which makes addQty() never
		// fire and quantities go into the wrong elements.
		while ($('#qty_info .inputQty').length < qtys.length) {
			if (typeof addQty === 'function') addQty()
			else break
		}
		qtys.forEach((q, i) => {
			$('#qty_info .inputQty').eq(i).find('input').val(q).trigger('change')
		})
	}

	function fillMultipleF(fCodes) {
		// 1) Enable the multi-F checkbox so the form reveals #multiple_f_qty_info
		const $chk = $('#is_multiple_f')
		if (!$chk.is(':checked')) $chk[0]?.click()

		// 2) Wait for the panel to render, then populate F-rows.
		setTimeout(() => {
			const $container = $('#multiple_f_qty_info')
			if (!$container.length) return

			// Add enough rows
			while ($container.find('.f_table').length < fCodes.length) {
				if (typeof addFQty === 'function') addFQty()
				else break
			}

			// Fill each row's F-code + qty
			fCodes.forEach((entry, idx) => {
				const $row = $container.find('.f_table').eq(idx)
				if (!$row.length) return
				if (entry.code) $row.find('.f-code').first().val(entry.code).trigger('change').trigger('input')
				if (entry.qty != null) $row.find('.inputQty input').first().val(entry.qty).trigger('change').trigger('input').trigger('blur')
			})

			// Recompute Total Qty per F + grand total at bottom.
			if (typeof recalcTotalFQty === 'function') recalcTotalFQty()
		}, 350)
	}

	function fillComponents(d) {
		const comps = Array.isArray(d.components) ? d.components : []
		if (comps.length === 0) return
		while ($('.component').length < comps.length) {
			const next = $('.component').length
			if (typeof addComponent === 'function') addComponent(next)
			else break
		}
		comps.forEach((c, i) => fillOneComponent(c, i))
	}

	function fillOneComponent(c, i) {
		const $comp = $('.component[index="' + i + '"]')
		if (!$comp.length) return

		if (c.name) $comp.find('.nameComp').first().val(c.name).trigger('change')
		if (c.type) $comp.find('.componentType').first().val(String(c.type)).trigger('change')
		if (c.color_outside != null) $comp.find('.colorOutside').first().val(c.color_outside).trigger('change')
		if (c.color_inside != null) $comp.find('.colorInside').first().val(c.color_inside).trigger('change')

		// If total colors per side exceed 4 (CMYK), the excess are special inks.
		// Check the "มีสีพิเศษ" box (via native click so the form's existing
		// click handler runs and reveals the special-ink section) and add empty
		// rows for the user to fill in.
		const extraSpecial = Math.max(0, (c.color_outside || 0) - 4) + Math.max(0, (c.color_inside || 0) - 4)
		if (extraSpecial > 0) {
			const $hasSpe = $comp.find('.has_speInk').first()
			if ($hasSpe.length && !$hasSpe.is(':checked')) {
				$hasSpe[0].click()
			}
			setTimeout(() => {
				const $tbody = $comp.find('.div-speInk .table_speInk tbody').first()
				const $addBtn = $comp.find('.div-speInk .addSpeInk').first()
				if ($addBtn.length) {
					const existing = $tbody.find('tr').length
					for (let k = existing; k < extraSpecial; k++) {
						$addBtn[0].click()
					}
				}
			}, 350)
		}

		const $papType = $comp.find('.paperType').first()
		if (c.paper_type && $papType.length) {
			const m = matchPaperType($papType, c.paper_type)
			if (m) $papType.val(m).trigger('change')
		}
		setTimeout(() => {
			const $papGram = $comp.find('.paperGram').first()
			if (c.paper_gram != null && $papGram.length) {
				const m = findOptionMatch($papGram, c.paper_gram)
				if (m) $papGram.val(m).trigger('change')
				else $papGram.val(String(c.paper_gram)).trigger('change')
			}
		}, 250)
		if (c.paper_cost != null) $comp.find('.paperCost').first().val(c.paper_cost).trigger('change')
		if (c.paper_percent != null) $comp.find('.paperPercent').first().val(c.paper_percent).trigger('change')
		if (c.remark_paper) $comp.find('.remark-paper').first().val(c.remark_paper)

		// Default paper source to "ในประเทศ" (value=1) — overridable by user.
		const $paperSrc = $comp.find('.select_paper_source').first()
		if ($paperSrc.length && (!$paperSrc.val() || $paperSrc.val() === '')) {
			$paperSrc.val('1').trigger('change')
		}

		// Normalize: accept either array (new schema) or single object (old).
		const coatings = toArray(c.coatings || c.coating)
		const foilstamps = toArray(c.foilstamps || c.foilstamp)
		const embosses = toArray(c.embosses || c.emboss)
		const debosses = toArray(c.debosses || c.deboss)

		fillCoatings($comp, coatings, i)
		fillFoilstamps($comp, foilstamps, i)
		fillEmbosses($comp, embosses, i)
		fillDebosses($comp, debosses, i)

		// Corrugated (only relevant when componentType = 2 or 3). The
		// .corrugatedInput section is rendered after the type change, so wait
		// briefly before filling.
		if (c.corrugated && (String(c.type) === '2' || String(c.type) === '3')) {
			setTimeout(() => fillCorrugated(i, c.corrugated), 400)
		}

		// Box template (1-12) — set after a brief delay so .boxType options
		// loaded from get_box_template_arr() are available. Then fill the
		// W×L×H dimensions and flap once the .inputType section renders.
		if (c.box_template_id != null) {
			setTimeout(() => {
				const $box = $('.boxType[index="' + i + '"]')
				if (!$box.length) return
				const tid = String(c.box_template_id)
				const hasOpt = $box.find('option').filter(function () {
					return String($(this).val()) === tid
				}).length > 0
				if (hasOpt) {
					$box.val(tid).trigger('change')
					if (c.dimensions_mm) fillDimensionsAfterTemplate(i, c.dimensions_mm, c.flap_mm)
				}
			}, 500)
		} else if (c.dimensions_mm) {
			fillDimensionsAfterTemplate(i, c.dimensions_mm, c.flap_mm)
		}
	}

	function fillDimensionsAfterTemplate(componentIndex, dim, flap_mm) {
		setTimeout(() => {
			const $iType = $('.inputType[index="' + componentIndex + '"]')
			if (!$iType.length) return

			// Template 12 (Custom) replaces width/length/depth with open + packing
			// size fields. Detect by checking which inputs actually exist.
			const $width = $iType.find('.specmm.width').first()
			const isCustom = $width.length === 0 || !$width.is(':visible')

			if (isCustom) {
				// Fill open size (W x L) and packing size if available.
				const $openMm = $iType.find('.openSizemm input')
				if ($openMm.length >= 2) {
					if (dim.width != null) $openMm.eq(0).val(dim.width).trigger('change')
					if (dim.length != null) $openMm.eq(1).val(dim.length).trigger('change')
				}
				const $packMm = $iType.find('.packingsizemm input')
				if ($packMm.length >= 2) {
					if (dim.width != null && !$packMm.eq(0).val()) $packMm.eq(0).val(dim.width).trigger('change')
					if (dim.length != null && !$packMm.eq(1).val()) $packMm.eq(1).val(dim.length).trigger('change')
				}
				return // no width/length/depth to fill on Custom
			}

			if (dim.width != null) $iType.find('.specmm.width').val(dim.width).trigger('change')
			if (dim.length != null) $iType.find('.specmm.length').val(dim.length).trigger('change')
			if (dim.height != null) $iType.find('.specmm.depth').val(dim.height).trigger('change')

			// ปีกกล่อง (dust flap) — only fill if currently empty so we don't
			// overwrite a template-provided default (e.g. templates 5/6 = 25mm).
			if (flap_mm != null) {
				const $dust = $iType.find('.specmm.dust').first()
				if ($dust.length && (!$dust.val() || $dust.val() === '')) {
					$dust.val(flap_mm).trigger('change')
				}
			}
		}, 800)
	}

	// Process names that the backend / form already handle for every Packaging
	// job — never insert them as Other Process rows.
	//   - Diecut / Block Diecut / strip-out / Inspection: priced automatically
	//   - ติดกาว / ปะกาว / gluing: handled by the .is_assembled checkbox in the
	//     box template (auto-checked when the template's default glue_spot > 0)
	const STANDARD_PACKAGING_PROCESSES = [
		'block diecut', 'block-diecut', 'blockdiecut',
		'diecut', 'die-cut', 'die cut', 'ไดคัท', 'ได คัท',
		'แกะ', 'strip', 'strip-out', 'stripping', 'strip out', 'waste removal', 'แกะเศษ',
		'inspection', 'ตรวจสอบ', 'qc', 'ตรวจงาน', 'ตรวจ qc',
		'ติดกาว', 'ค่าติดกาว', 'ปะกาว', 'gluing', 'glue', 'glueing', 'assembly', 'assemble'
	]
	function isStandardProcess(name) {
		const n = normalize(name)
		return STANDARD_PACKAGING_PROCESSES.some((p) => n === p || n.indexOf(p) !== -1)
	}

	function fillProcesses(d) {
		;[
			['other_processes', 'other', 'otherProcess'],
			['handwork_processes', 'handwork', 'handworkProcess'],
			['materials', 'material', 'materialProcess']
		].forEach(([key, type, containerId]) => {
			const arr = Array.isArray(d[key]) ? d[key] : []
			arr.forEach((item) => {
				if (typeof addProcess !== 'function') return
				// Skip standard packaging processes — backend handles these
				if (item && item.name && isStandardProcess(item.name)) return
				addProcess(type)
				const $row = $('#' + containerId + ' tr').last()
				if (!$row.length) return
				fillProcessRow($row, item, type)
			})
		})
	}

	// Paper type matching with Thai → industry-code fallbacks. The dropdown
	// uses codes like "A/C C1s" while the doc may say "อาร์ตมันหน้าเดียว".
	function matchPaperType($select, target) {
		const direct = findOptionMatch($select, target)
		if (direct) return direct
		const t = normalize(target)
		const aliases = []
		if (t.indexOf('อาร์ตมันหน้าเดียว') !== -1 || t.indexOf('art c1s') !== -1 || t.indexOf('a/c c1s') !== -1 || t.indexOf('c1s') !== -1) {
			aliases.push('A/C C1s', 'C1s', 'Art C1s', 'A/C')
		}
		if (t.indexOf('อาร์ตมันสองหน้า') !== -1 || t.indexOf('art c2s') !== -1 || t.indexOf('c2s') !== -1) {
			aliases.push('A/C C2s', 'C2s', 'Art C2s', 'A/C')
		}
		if (t.indexOf('อาร์ตด้าน') !== -1 || t.indexOf('art matt') !== -1 || t.indexOf('a/m') !== -1) {
			aliases.push('A/M', 'Art Matt')
		}
		if (t.indexOf('อาร์ต') !== -1 || t.indexOf('art card') !== -1 || t.indexOf('art ') !== -1 || t === 'a/c') {
			aliases.push('A/C', 'Art Card')
		}
		if (t.indexOf('ไอวอรี') !== -1 || t.indexOf('ivory') !== -1) {
			aliases.push('Ivory')
		}
		if (t.indexOf('คราฟ') !== -1 || t.indexOf('kraft') !== -1) {
			aliases.push('Kraft')
		}
		if (t.indexOf('ดูเพล็กซ์') !== -1 || t.indexOf('duplex') !== -1 || t.indexOf('gbb') !== -1) {
			aliases.push('Duplex GBB', 'Duplex', 'GBB')
		}
		for (const alias of aliases) {
			const m = findOptionMatch($select, alias)
			if (m) return m
		}
		return null
	}

	function toArray(v) {
		if (v == null) return []
		return Array.isArray(v) ? v : [v]
	}
	function getInchSize(item, axis) {
		// Accept both new (size_w_inch) and legacy (size_w) keys.
		if (axis === 'w') return item.size_w_inch != null ? item.size_w_inch : item.size_w
		return item.size_h_inch != null ? item.size_h_inch : item.size_h
	}

	function fillCorrugated(componentIndex, corrugated) {
		const $cInput = $('.corrugatedInput[index="' + componentIndex + '"]')
		if (!$cInput.length) return

		// Always drop the raw grade text into the remark for traceability.
		const rawGrade = corrugated.raw_grade_string || corrugated.grade
		if (rawGrade) {
			const $remark = $cInput.find('.remark-corrugated').first()
			if ($remark.length) {
				const existing = ($remark.val() || '').trim()
				const note = 'Spec: ' + rawGrade
				if (!existing.includes(String(rawGrade))) {
					$remark.val(existing ? existing + ' | ' + note : note).trigger('change').trigger('input')
				}
			}
		}

		// Parse "CA105/CA125" string fallback if AI didn't split it.
		const top = corrugated.grade_top || parseGradePart(rawGrade, 0)
		const bottom = corrugated.grade_bottom || parseGradePart(rawGrade, 1)

		// Cascade: layer → flute → grade selects. Each select populates the
		// next, so wait for options before matching.
		const $layer = $cInput.find('.layerCorrugated').first()
		const layerVal = matchLayer($layer, corrugated.layer, !!bottom)
		if (layerVal) {
			$layer.val(layerVal).trigger('change')
			waitForOptions($cInput.find('.fluteCorrugated').first(), 1500).then(($flute) => {
				if (corrugated.flute && $flute) {
					const m = findOptionMatch($flute, corrugated.flute)
					if (m) {
						$flute.val(m).trigger('change')
						waitForOptions($cInput.find('.type_1').first(), 1500).then(() => {
							if (top) fillGradeFields($cInput, '1', top)
							if (bottom) fillGradeFields($cInput, '2', bottom)
						})
					}
				}
			})
		}
	}

	// Parse "CA105/CA125" → ["CA", 105] for index 0; ["CA", 125] for index 1.
	function parseGradePart(s, idx) {
		if (!s) return null
		const parts = String(s).split(/[\/,]/).map((p) => p.trim()).filter(Boolean)
		const part = parts[idx]
		if (!part) return null
		const m = part.match(/^([a-zA-Z]+)[-\s]?(\d+)/i)
		if (!m) return null
		return { type: m[1].toUpperCase(), gram: parseInt(m[2], 10) }
	}

	// Layer: try direct match, then aliases. AI-text → numeric option fallback
	// because the dropdown often uses numeric values like "1", "2", "3".
	function matchLayer($select, layerHint, hasTwoGrades) {
		if (!layerHint && !hasTwoGrades) return null
		const tryMatch = (key) => findOptionMatch($select, key)

		const direct = layerHint ? tryMatch(layerHint) : null
		if (direct) return direct

		const hint = normalize(layerHint || (hasTwoGrades ? 'single-wall' : 'single-face'))
		const candidates = []
		if (hint.indexOf('single-face') !== -1 || hint.indexOf('single face') !== -1 || hint === 'sf') {
			candidates.push('Single Face', 'SF', '1')
		}
		if (hint.indexOf('single-wall') !== -1 || hint.indexOf('single wall') !== -1 || hint === 'sw') {
			candidates.push('Single Wall', 'SW', '2')
		}
		if (hint.indexOf('double-wall') !== -1 || hint.indexOf('double wall') !== -1 || hint === 'dw') {
			candidates.push('Double Wall', 'DW', '3')
		}
		// If we still have nothing but spec lists two grades, single-wall is
		// the most likely answer (top + bottom liners with one medium).
		if (candidates.length === 0 && hasTwoGrades) {
			candidates.push('Single Wall', 'SW', '2')
		}
		for (const c of candidates) {
			const v = tryMatch(c)
			if (v) return v
		}
		return null
	}

	// Wait until a select has at least 2 options (placeholder + real values).
	// Resolves with the jQuery select once ready, or null after timeout.
	function waitForOptions($select, timeoutMs) {
		return new Promise((resolve) => {
			if (!$select || !$select.length) return resolve(null)
			const start = Date.now()
			const tick = () => {
				if ($select.find('option').length > 1) return resolve($select)
				if (Date.now() - start > timeoutMs) return resolve(null)
				setTimeout(tick, 100)
			}
			tick()
		})
	}

	function fillGradeFields($cInput, slot, info) {
		const $type = $cInput.find('.type_' + slot).first()
		const $gram = $cInput.find('.gram_' + slot).first()
		if ($type.length && info.type) {
			const tm = findOptionMatch($type, info.type)
			if (tm) $type.val(tm).trigger('change')
		}
		// gram dropdown depends on type — wait briefly
		setTimeout(() => {
			if ($gram.length && info.gram != null) {
				const gm = findOptionMatch($gram, String(info.gram))
				if (gm) $gram.val(gm).trigger('change')
			}
		}, 300)
	}

	function fillCoatings($comp, coatings, componentIndex) {
		coatings.forEach((coating, idx) => {
			if (!coating) return
			if (idx > 0 && typeof addAddon === 'function') {
				addAddon(componentIndex, 'coating')
			}
			// Target the LAST .coatingInput within this component (the just-added one).
			fillCoating($comp.find('.coatingInput').last(), coating)
		})
	}

	function fillFoilstamps($comp, foilstamps, componentIndex) {
		foilstamps.forEach((fs, idx) => {
			if (!fs) return
			if (idx > 0 && typeof addAddon === 'function') {
				addAddon(componentIndex, 'foilstamp')
			}
			const $fs = $comp.find('.foilstampInput').last()
			if (!$fs.length) return
			$fs.find('.foilstampCheck')[0]?.click()
			const $sizes = $fs.find('.foilstampSize')
			const w = getInchSize(fs, 'w')
			const h = getInchSize(fs, 'h')
			if (w != null && $sizes.length >= 1) $sizes.eq(0).val(w).trigger('change')
			if (h != null && $sizes.length >= 2) $sizes.eq(1).val(h).trigger('change')
			if (fs.color) {
				const $col = $fs.find('.foilColor').first()
				const m = findOptionMatch($col, fs.color)
				if (m) $col.val(m).trigger('change')
			}
		})
	}

	function fillEmbosses($comp, embosses, componentIndex) {
		embosses.forEach((e, idx) => {
			if (!e) return
			if (idx > 0 && typeof addAddon === 'function') {
				addAddon(componentIndex, 'emboss')
			}
			const $e = $comp.find('.embossInput').last()
			if (!$e.length) return
			$e.find('.embossCheck')[0]?.click()
			const $sizes = $e.find('.embossSize')
			const w = getInchSize(e, 'w')
			const h = getInchSize(e, 'h')
			if (w != null && $sizes.length >= 1) $sizes.eq(0).val(w).trigger('change')
			if (h != null && $sizes.length >= 2) $sizes.eq(1).val(h).trigger('change')
			if (e.depth) $e.find('.embossDepth').val(String(e.depth)).trigger('change')
		})
	}

	function fillDebosses($comp, debosses, componentIndex) {
		debosses.forEach((b, idx) => {
			if (!b) return
			if (idx > 0 && typeof addAddon === 'function') {
				addAddon(componentIndex, 'deboss')
			}
			const $b = $comp.find('.debossInput').last()
			if (!$b.length) return
			$b.find('.debossCheck')[0]?.click()
			const $sizes = $b.find('.debossSize')
			const w = getInchSize(b, 'w')
			const h = getInchSize(b, 'h')
			if (w != null && $sizes.length >= 1) $sizes.eq(0).val(w).trigger('change')
			if (h != null && $sizes.length >= 2) $sizes.eq(1).val(h).trigger('change')
			if (b.depth) $b.find('.debossDepth').val(String(b.depth)).trigger('change')
		})
	}

	// Coating: the .coatingType dropdown is populated dynamically when
	// .coatingOption changes. AI may guess the wrong option (e.g. "Gloss" for
	// UV varnish that's actually under "Other"). Strategy: try the suggested
	// option first; if no type matches, walk through Gloss/Matt/Other and
	// pick whichever produces a dropdown that contains the requested type.
	// $container = a .coatingInput element (which may be the original or one
	// added later via addAddon).
	function fillCoating($container, coating) {
		const $opt = $container.find('.coatingOption').first()
		const $type = $container.find('.coatingType').first()
		if (!$opt.length) return

		const wanted = coating.type ? String(coating.type).trim() : null
		const candidates = []
		if (coating.option) candidates.push(coating.option)
		;['Other', 'Gloss', 'Matt'].forEach((o) => {
			if (!candidates.includes(o)) candidates.push(o)
		})

		const tryNext = (i) => {
			if (i >= candidates.length) {
				// nothing matched — leave the user-suggested option set so the
				// dropdown is at least populated for manual choice
				if (coating.option) $opt.val(coating.option).trigger('change')
				return
			}
			$opt.val(candidates[i]).trigger('change')
			setTimeout(() => {
				if (!wanted) return // option set, no specific type to match
				const m = findOptionMatch($type, wanted)
				if (m) {
					$type.val(m).trigger('change')
				} else {
					tryNext(i + 1)
				}
			}, 350)
		}
		tryNext(0)
	}

	function fillProcessRow($row, item, type) {
		// Selectors match the structure produced by addProcess() in
		// function_estimate.js: <textarea> for name, .ppuInput for price,
		// .numMatInput for material qty.
		if (item.name) {
			const $nameField = $row.find('.nameProcess textarea').first()
			if ($nameField.length) $nameField.val(item.name).trigger('change').trigger('input')
		}
		if (item.price_per_unit != null) {
			const $priceField = $row.find('.div_price .ppuInput').first()
			if ($priceField.length) $priceField.val(item.price_per_unit).trigger('change').trigger('input')
		}
		if (type === 'material' && item.qty != null) {
			const $qtyField = $row.find('.div_qty .numMatInput').first()
			if ($qtyField.length) $qtyField.val(item.qty).trigger('change').trigger('input')
		}
	}

	function showAIBanner(d, input, uncertainCount) {
		const uncertainMsg = uncertainCount > 0
			? ' — <b style="color:#fde68a">⚠ ' + uncertainCount + ' field ไฮไลต์สีเหลือง</b> ต้องกรอกเพิ่มเติม'
			: ''
		const notes = d.notes ? '<div style="margin-top:6px;font-size:12px;color:#444"><b>หมายเหตุจาก AI:</b> ' + escapeHtml(d.notes) + '</div>' : ''
		const packing = d.packing && (d.packing.shrink_per_unit != null || d.packing.units_per_carton != null || d.packing.carton_per_pallet != null || d.packing.remark)
			? (() => {
				const parts = []
				if (d.packing.shrink_per_unit != null) parts.push(d.packing.shrink_per_unit + ' ชิ้น/Shrink')
				if (d.packing.units_per_carton != null) parts.push(d.packing.units_per_carton + ' Shrink/ลัง')
				if (d.packing.carton_per_pallet != null) parts.push(d.packing.carton_per_pallet + ' ลัง/พาเลท')
				if (d.packing.remark) parts.push(d.packing.remark)
				return '<div style="margin-top:6px;font-size:12px;color:#fde68a"><b>📦 ข้อมูลการบรรจุ (กรอกเองในส่วน Packing):</b> ' + escapeHtml(parts.join(' · ')) + '</div>'
			  })()
			: ''
		const btnStyle =
			'background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.5);padding:4px 10px;border-radius:4px;cursor:pointer;font-size:12px;margin-left:8px'
		const banner = $(`
			<div id="ai-fill-banner" style="position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#6a5af9,#a855f7);color:#fff;padding:10px 20px;z-index:9998;box-shadow:0 2px 6px rgba(0,0,0,0.2)">
				<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
					<div style="flex:1">
						<i class="fa fa-magic"></i> <b>AI ได้กรอกข้อมูลให้แล้ว</b> — กรุณาตรวจสอบทุกฟิลด์ โดยเฉพาะ <b>AE</b>, <b>Customer</b>, และ <b>จังหวัดส่งงาน</b> ต้องเลือกจากรายการ autocomplete อีกครั้ง${uncertainMsg}
						${notes}
						${packing}
					</div>
					<div style="white-space:nowrap">
						<button id="ai-show-input" type="button" style="${btnStyle}"><i class="fa fa-file-text-o"></i> ดู input ที่ส่งให้ AI</button>
						<button id="ai-show-output" type="button" style="${btnStyle}"><i class="fa fa-code"></i> ดูที่ AI อ่านได้</button>
						<span id="ai-banner-close" style="cursor:pointer;font-size:22px;padding:0 8px;margin-left:6px">&times;</span>
					</div>
				</div>
			</div>
		`)
		$('body').prepend(banner)
		$('#ai-banner-close').on('click', () => banner.remove())
		$('#ai-show-input').on('click', () => showAIPopup('Input ที่ส่งให้ AI', formatInput(input)))
		$('#ai-show-output').on('click', () => showAIPopup('ข้อมูลที่ AI อ่านได้ (JSON)', formatOutput(d)))
	}

	function formatInput(input) {
		if (!input) return '<i style="color:#888">ไม่มีข้อมูล input ที่บันทึกไว้</i>'
		const parts = []
		if (input.text && input.text.trim()) {
			parts.push('<b>ข้อความที่วาง:</b><pre style="background:#f5f5f5;padding:10px;border-radius:4px;white-space:pre-wrap;word-break:break-word">' + escapeHtml(input.text) + '</pre>')
		}
		if (input.files && input.files.length > 0) {
			parts.push(
				'<b>ไฟล์แนบ (' +
					input.files.length +
					'):</b><ul>' +
					input.files
						.map(
							(f) =>
								'<li>' +
								escapeHtml(f.name) +
								' <span style="color:#888">(' +
								(f.size / 1024).toFixed(1) +
								' KB' +
								(f.type ? ', ' + escapeHtml(f.type) : '') +
								')</span></li>'
						)
						.join('') +
					'</ul>'
			)
		}
		return parts.length ? parts.join('') : '<i style="color:#888">ไม่มีข้อมูล input</i>'
	}

	function formatOutput(d) {
		const json = JSON.stringify(d, null, 2)
		return '<pre style="background:#f5f5f5;padding:10px;border-radius:4px;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:60vh;overflow:auto">' + escapeHtml(json) + '</pre>'
	}

	function showAIPopup(title, html) {
		$('#ai-popup-overlay').remove()
		const $overlay = $(`
			<div id="ai-popup-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center">
				<div style="background:#fff;width:min(800px,92vw);max-height:88vh;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden">
					<div style="background:linear-gradient(90deg,#6a5af9,#a855f7);color:#fff;padding:12px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:bold">
						<span>${escapeHtml(title)}</span>
						<span class="ai-popup-close" style="cursor:pointer;font-size:24px;padding:0 6px">&times;</span>
					</div>
					<div style="padding:16px;overflow:auto;flex:1">${html}</div>
				</div>
			</div>
		`)
		$('body').append($overlay)
		$overlay.on('click', function (e) {
			if (e.target === this || $(e.target).hasClass('ai-popup-close')) $overlay.remove()
		})
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
	}
})
