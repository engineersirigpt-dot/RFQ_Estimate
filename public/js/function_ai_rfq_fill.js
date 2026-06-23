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

	// Remove a trailing side-count suffix: "1 s", "2 s", "1s", "1/s", "2/s".
	// e.g. "water proof 1/s" → "water proof", "opp soft touch 30 mc 1 s" → "opp soft touch 30 mc"
	function stripSideCount(s) {
		return String(s || '').replace(/\s*\d+\s*\/?\s*s\s*$/i, '').trim()
	}

	function findOptionMatch($select, target) {
		if (!target) return null
		const t = normalize(target)
		const tNoSpace = t.replace(/\s+/g, '')
		const tStripped = stripSideCount(t)
		// Tokenise the side-count-free target so a "1/s" vs "1 s" mismatch can't
		// break token matching.
		const tokens = tStripped.split(/\s+/).filter((x) => x.length > 1)
		let exact = null,
			strippedExact = null,
			contains = null,
			tokenMatch = null
		$select.find('option').each(function () {
			const rawTxt = $(this).text()
			const rawVal = $(this).val()
			if (!rawTxt && !rawVal) return
			const txt = normalize(rawTxt)
			const txtNoSpace = txt.replace(/\s+/g, '')
			const txtStripped = stripSideCount(txt)
			const val = normalize(rawVal)
			if (txt === t || val === t || txtNoSpace === tNoSpace) {
				exact = rawVal
				return false
			}
			if (!strippedExact && tStripped && txtStripped === tStripped) {
				strippedExact = rawVal
			}
			if (!contains && txt && (txt.indexOf(t) !== -1 || t.indexOf(txt) !== -1)) {
				contains = rawVal
			}
			// Token match against the side-count-free option text.
			if (!tokenMatch && tokens.length > 0 && tokens.every((tok) => txtStripped.indexOf(tok) !== -1)) {
				tokenMatch = rawVal
			}
		})
		return exact != null ? exact : strippedExact != null ? strippedExact : contains != null ? contains : tokenMatch
	}

	// Module-scope: F-codes for multi-F jobs, so addon fillers can populate
	// each foil/emboss/deboss F-code list.
	let multiFCodes = null

	function fillForm(d, input) {
		try {
			multiFCodes = d.is_multiple_f && Array.isArray(d.f_codes) && d.f_codes.length > 0 ? d.f_codes : null
			fillJobInfo(d)
			fillJobDetail(d)
			fillQuantities(d)
			fillComponents(d)
			fillProcesses(d)
			fillDeliveries(d)
			// In multi-F mode, each component needs one specialInk-container per
			// F-code. Run after fillComponents has filled the first container.
			if (d.is_multiple_f && Array.isArray(d.f_codes) && d.f_codes.length > 1) {
				setTimeout(() => expandMultiFContainers(d.f_codes, d.components || []), 800)
			}
			const uncertainCount = highlightUncertain(d)
			showAIBanner(d, input, uncertainCount)
			if (typeof checkRequiredInput === 'function') checkRequiredInput()
		} catch (e) {
			console.error('AI auto-fill error', e)
			alert('AI กรอกข้อมูลไม่สำเร็จบางส่วน: ' + e.message + '\nกรุณาตรวจสอบฟอร์ม')
		}
	}

	// For each component, add one specialInk-container per F-code and select
	// the F-code in its dropdown. Replicates the colors from container 0 so all
	// F-codes share the same color set (typical case — only graphics differ).
	function expandMultiFContainers(fCodes, comps) {
		// Refresh F-code dropdown options across the form so the just-added
		// F-codes appear in the .f-code-select dropdowns.
		if (typeof getFCodeSelectOption === 'function') getFCodeSelectOption()

		comps.forEach((c, ci) => {
			const $section = $('.specialInkSection[index="' + ci + '"]')
			if (!$section.length) return

			// Capture the colors from the first (existing) container so we can
			// replicate them across all F-codes for this component.
			const $first = $section.find('.specialInk-container').first()
			const baseOutside = $first.find('.colorOutside').first().val() || (c.color_outside != null ? c.color_outside : '')
			const baseInside = $first.find('.colorInside').first().val() || (c.color_inside != null ? c.color_inside : 0)

			// Add (N-1) more containers — the form starts with 1
			const existing = $section.find('.specialInk-container').length
			for (let k = existing; k < fCodes.length; k++) {
				if (typeof addSpecialInkF === 'function') addSpecialInkF(ci)
			}

			// Refresh dropdowns again now that we added containers
			if (typeof getFCodeSelectOption === 'function') getFCodeSelectOption()

			// Select F-code + fill colors in each container
			setTimeout(() => {
				$section.find('.specialInk-container').each(function (idx) {
					const fc = fCodes[idx]
					if (!fc) return
					const $box = $(this)
					if (fc.code) {
						$box.find('.specialInkFCode').first().val(fc.code).trigger('change')
					}
					if (baseOutside !== '' && baseOutside != null) {
						$box.find('.colorOutside').first().val(baseOutside).trigger('change').trigger('input')
					}
					if (baseInside !== '' && baseInside != null) {
						$box.find('.colorInside').first().val(baseInside).trigger('change').trigger('input')
					}
				})
			}, 200)
		})
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
		if (list.length === 0) return
		// Single delivery: fill the primary one-time row.
		// Multi delivery: enable แบ่งส่ง mode, add rows, fill destination/date/qty per row.
		if (list.length === 1) {
			setTimeout(() => fillSingleDelivery(list[0]), 600)
		} else {
			// Longer wait — split-delivery requires qty + component name to be
			// already filled (otherwise chk_split_delivery rejects with alert).
			setTimeout(() => fillSplitDelivery(list), 1500)
		}
	}

	function fillSingleDelivery(first) {
		const $primary = $('#delivery .deliveryProcess[index="0"]').first()
		if (!$primary.length) return
		if (first.destination) {
			$primary.find('.deliveryDestinationName').first().val(first.destination).trigger('change').trigger('input')
		}
		if (first.delivery_date) {
			$primary.find('.deliveryDate').first().val(first.delivery_date).trigger('change').trigger('input')
		}
	}

	function fillSplitDelivery(list) {
		const $chk = $('.chk_split_delivery').first()
		if (!$chk.length || $chk.prop('disabled')) {
			// Form disabled split mode (e.g. multiple Quantity rows entered).
			// Fall back: fill the first one and warn about the rest.
			console.warn('AI: chk_split_delivery unavailable — falling back to single delivery')
			fillSingleDelivery(list[0])
			showSplitDeliveryWarning(list.slice(1))
			return
		}

		if (!$chk.is(':checked')) {
			$chk[0].click() // triggers toggleSplitDelivery → opens split UI, adds row 0
		}

		// Wait for split UI to render, then add remaining rows and fill each.
		setTimeout(() => {
			const $addBtn = $('.splitDelivery').first()
			const existing = $('#deliveryProcess tr.deliveryProcess').length
			for (let k = existing; k < list.length; k++) {
				if ($addBtn.length) $addBtn[0].click()
			}

			setTimeout(() => {
				const $rows = $('#deliveryProcess tr.deliveryProcess')
				if ($rows.length === 0) {
					// chk_split_delivery click didn't take effect (validation
					// blocked it silently?) — fall back gracefully.
					console.warn('AI: split-delivery rows did not render — fallback')
					fillSingleDelivery(list[0])
					showSplitDeliveryWarning(list.slice(1))
					return
				}
				list.forEach((entry, idx) => {
					const $row = $rows.eq(idx)
					if (!$row.length) return
					if (entry.destination) {
						$row.find('.deliveryDestinationName').first().val(entry.destination).trigger('change').trigger('input')
					}
					if (entry.delivery_date) {
						$row.find('.deliveryDate').first().val(entry.delivery_date).trigger('change').trigger('input')
					}
					if (entry.qty != null) {
						$row.find('.deliveryQty input').first().val(entry.qty).trigger('change').trigger('input').trigger('blur')
					}
				})
			}, 450)
		}, 450)
	}

	function showSplitDeliveryWarning(extras) {
		if (!extras || extras.length === 0) return
		const lines = extras
			.map((x) => {
				const parts = [escapeHtml(x.destination || '?')]
				if (x.delivery_date) parts.push(escapeHtml(x.delivery_date))
				if (x.qty != null) parts.push(Number(x.qty).toLocaleString() + ' กล่อง')
				return parts.join(' / ')
			})
		console.warn('AI: extra delivery rows (need manual แบ่งส่ง): ' + lines.join(' | '))
		$('#delivery').append(
			'<div style="color:#b45309;font-size:12px;margin:4px 0 0 5px">' +
				'⚠️ AI พบรายการส่งเพิ่มเติม: <b>' + lines.join('</b>, <b>') + '</b> — ' +
				'กรุณาติ๊ก "แบ่งส่ง" แล้วเพิ่มเองหลังคำนวณ Layout' +
			'</div>'
		)
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

		// ลิมิตสี N เล่ม — check the box (which reveals the qty input via its
		// change handler), then fill the qty. Normal (non-multi-F) mode only;
		// multi-F has per-row checkboxes which would need component-level data.
		if (d.color_limit_qty != null && Number(d.color_limit_qty) > 0) {
			setTimeout(() => {
				const $chk = $('.chk_color_limit:visible').first()
				if (!$chk.length) return
				if (!$chk.is(':checked')) $chk[0].click()
				setTimeout(() => {
					const $input = $('.color_limit_normal.color_limit input').first()
					if ($input.length) {
						$input.val(d.color_limit_qty).trigger('change').trigger('input').trigger('blur')
					}
				}, 250)
			}, 500)
		}
	}

	function fillQuantities(d) {
		// The form's run-on / qty handlers listen on 'keyup' (runonPercent) and
		// 'blur' (inputQty), NOT 'change'. Trigger those so .runonQty input
		// (the calculated extra qty cell) gets recomputed automatically.
		if (d.runon_percent != null) {
			$('.runonPercent').first().val(d.runon_percent).trigger('change').trigger('keyup')
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
			// Trigger BLUR so the form recalculates runon qty from this qty
			// (handler in function_estimate_readyFunction.js binds on blur).
			$('#qty_info .inputQty').eq(i).find('input').val(q).trigger('change').trigger('blur')
		})
		// One more keyup on runon to cover the case where qty was filled
		// AFTER runon (the blur above also covers it, but keyup is idempotent).
		if (d.runon_percent != null) {
			$('.runonPercent').first().trigger('keyup')
		}
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
		// Pass top-level open_size_mm down so Custom template can use it.
		const topOpen = d.open_size_mm || null
		comps.forEach((c, i) => fillOneComponent(c, i, topOpen))
	}

	function fillOneComponent(c, i, topOpenSize) {
		const $comp = $('.component[index="' + i + '"]')
		if (!$comp.length) return

		if (c.name) $comp.find('.nameComp').first().val(c.name).trigger('change')
		if (c.type) $comp.find('.componentType').first().val(String(c.type)).trigger('change')
		if (c.color_outside != null) $comp.find('.colorOutside').first().val(c.color_outside).trigger('change')
		if (c.color_inside != null) $comp.find('.colorInside').first().val(c.color_inside).trigger('change')

		// If total colors per side exceed 4 (CMYK), the excess are special inks.
		// Check the "มีสีพิเศษ" box, add the needed rows, and — if the AI
		// extracted special-ink detail — fill name/type/filling-style too.
		const aiSpecialInks = Array.isArray(c.special_inks) ? c.special_inks.filter(Boolean) : []
		// A UV Drip-Off coating makes the form auto-add its own "Drip off" ink
		// row. Detect it so we don't double-count that ink as a blank row.
		const coatingsForCheck = toArray(c.coatings || c.coating)
		const hasDripOffCoating = coatingsForCheck.some(
			(co) => co && /drip\s*off|ดิฟออฟ|ดรอปออฟ/i.test(String(co.type || ''))
		)
		let extraSpecial = Math.max(
			Math.max(0, (c.color_outside || 0) - 4) + Math.max(0, (c.color_inside || 0) - 4),
			aiSpecialInks.length
		)
		// The Drip-off ink is auto-created by the coating logic — subtract it
		// from the blank rows we add manually so the total comes out right.
		if (hasDripOffCoating) extraSpecial = Math.max(0, extraSpecial - 1)
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
				// Fill detail rows that AI provided
				if (aiSpecialInks.length > 0) {
					setTimeout(() => {
						const $rows = $comp.find('.div-speInk .table_speInk tbody .tr_speInk')
						aiSpecialInks.forEach((ink, idx) => {
							const $r = $rows.eq(idx)
							if (!$r.length) return
							if (ink.name) {
								$r.find('.speInk_name').first().val(ink.name).trigger('change').trigger('input')
							}
							if (ink.ink_type) {
								const $t = $r.find('.speInk_type').first()
								const m = findOptionMatch($t, ink.ink_type)
								if (m) $t.val(m).trigger('change')
							}
							if (ink.filling_style) {
								const $f = $r.find('.speInk_fillingStyle').first()
								const m = findOptionMatch($f, ink.filling_style)
								if (m) $f.val(m).trigger('change')
							}
						})
					}, 250)
				}
			}, 350)
		}

		// Paper type — WAIT for the dropdown to be populated before matching.
		// The .paperType option list is (re)built asynchronously and is filtered
		// by the current print type's GSM range (getMasterData.js buildPaperType /
		// getDefaultPaperTypeList). Matching synchronously here can run before the
		// options exist and silently leave the field blank — the GEFEN "Duplex 350"
		// case. gram/corrugated already guard with waitForOptions; do the same here.
		const $papType = $comp.find('.paperType').first()
		const fillGram = ($papGram) => {
			if (c.paper_gram == null || !$papGram || !$papGram.length) return
			const m = findOptionMatch($papGram, c.paper_gram)
			if (m) $papGram.val(m).trigger('change')
			else $papGram.val(String(c.paper_gram)).trigger('change')
		}
		if (c.paper_type && $papType.length) {
			waitForOptions($papType, 2000).then(($sel) => {
				const $p = $sel || $papType
				const m = matchPaperType($p, c.paper_type)
				if (m) $p.val(m).trigger('change')
				// gram options depend on the just-selected type — wait for them too
				waitForOptions($comp.find('.paperGram').first(), 2000).then(($g) =>
					fillGram($g || $comp.find('.paperGram').first()))
			})
		} else {
			setTimeout(() => fillGram($comp.find('.paperGram').first()), 250)
		}
		if (c.paper_cost != null) $comp.find('.paperCost').first().val(c.paper_cost).trigger('change')
		if (c.paper_percent != null) $comp.find('.paperPercent').first().val(c.paper_percent).trigger('change')
		if (c.remark_paper) {
			$comp.find('.remark-paper').first().val(c.remark_paper).trigger('change').trigger('input')
		}

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
		// Prefer the component's own open_size if AI returned one; else use the
		// top-level open_size_mm from the AI payload (per-component fallback).
		const openSize = c.open_size_mm || topOpenSize || null

		const extraSpec = { glue_mm: c.glue_mm, tuck_mm: c.tuck_mm }

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
					// Custom (12) กรอกขนาดจาก open_size (แผ่นแบนไม่มี dimensions_mm) — เรียกถ้ามี dim หรือ (Custom + openSize)
					const isCustom12 = String(c.box_template_id) === '12'
					if (c.dimensions_mm || (isCustom12 && openSize)) fillDimensionsAfterTemplate(i, c.dimensions_mm || {}, c.flap_mm, openSize, extraSpec, c.box_template_id)
					if (c.glued_spots != null) fillGluedSpots(i, parseInt(c.glued_spots, 10))
				}
			}, 500)
		} else if (c.dimensions_mm) {
			fillDimensionsAfterTemplate(i, c.dimensions_mm, c.flap_mm, openSize, extraSpec, c.box_template_id)
			if (c.glued_spots != null) fillGluedSpots(i, parseInt(c.glued_spots, 10))
		}
	}

	function fillGluedSpots(componentIndex, gluedSpots) {
		// Wait briefly because the .inputType section (which contains the
		// is_assembled checkbox + glued_spot input) renders after the template
		// dropdown change event.
		setTimeout(() => {
			const $iType = $('.inputType[index="' + componentIndex + '"]')
			if (!$iType.length) return
			const $chk = $iType.find('.is_assembled').first()
			const $td = $iType.find('.td-glued-spot').first()
			const $spot = $iType.find('.glued_spot').first()
			if (!$chk.length) return

			if (gluedSpots <= 0) {
				if ($chk.is(':checked')) $chk[0].click() // uncheck
				return
			}

			const maxAllowed = parseInt($spot.attr('max')) || 4
			const minAllowed = parseInt($spot.attr('min')) || 1

			if (gluedSpots <= maxAllowed) {
				// Normal case: fits in the form — tick is_assembled and set value
				if (!$chk.is(':checked')) $chk[0].click()
				$td.show()
				const targetVal = Math.max(minAllowed, gluedSpots)
				$spot.val(targetVal).trigger('change').trigger('input')
			} else {
				// Exceeds form max — uncheck is_assembled (template default may
				// have ticked it) and surface as an Other Process row so the
				// estimator prices the labor manually.
				if ($chk.is(':checked')) $chk[0].click()
				addExtraGluedSpotsAsOtherProcess(gluedSpots, maxAllowed)
			}
		}, 900)
	}

	function addExtraGluedSpotsAsOtherProcess(gluedSpots, maxAllowed) {
		if (typeof addProcess !== 'function') return
		const procName = 'ติดกาว ' + gluedSpots + ' จุด (เกินที่ฟอร์มกำหนด ' + maxAllowed + ' จุด)'
		// Don't double-add if a row with this name already exists.
		let alreadyExists = false
		$('#otherProcess tr').each(function () {
			const t = $(this).find('.nameProcess textarea').first().val() || ''
			if (t.indexOf('ติดกาว ' + gluedSpots + ' จุด') !== -1) alreadyExists = true
		})
		if (alreadyExists) return
		addProcess('other')
		const $row = $('#otherProcess tr').last()
		if (!$row.length) return
		$row.find('.nameProcess textarea').first().val(procName).trigger('change').trigger('input')
	}

	function fillDimensionsAfterTemplate(componentIndex, dim, flap_mm, openSize, extraSpec, templateId) {
		// Custom = template 12 (open + packing size fields instead of W/L/H).
		// Detect by the TEMPLATE ID, NOT by DOM presence: the dimension section
		// renders late after the .boxType change, and a not-yet-rendered
		// .specmm.width used to be misread as "Custom" — which silently skipped
		// W/L/H. That was the Seal End #11 dieline bug (80×25×150 extracted by the
		// AI but never filled). Poll until the right inputs actually exist.
		const isCustom = String(templateId) === '12'
		let tries = 0
		const tick = () => {
			if (++tries > 40) return // ~4s budget — give up rather than spin
			const $iType = $('.inputType[index="' + componentIndex + '"]')
			if (!$iType.length) return setTimeout(tick, 100)

			if (isCustom) {
				// Custom: the user-facing inputs are กว้าง/ยาว (.specmm.width/.length)
				// and they hold the FLAT sheet size (= AI open_size). The form mirrors
				// them into Open Size and runs setSize4Template12 (readyFunction ~917).
				// So fill .specmm (the primary, required fields) and let the form
				// cascade — matches the original dev's flow + clears the pink required
				// fields. Don't fall back to box dims if no flat size — leave blank.
				const ow = openSize && (openSize.width != null ? openSize.width : openSize.w)
				const ol = openSize && (openSize.length != null ? openSize.length : openSize.l)
				if (ow == null && ol == null) return // nothing reliable — leave blank
				const $w = $iType.find('.specmm.width').first()
				const $l = $iType.find('.specmm.length').first()
				if (!$w.length && !$l.length) return setTimeout(tick, 100) // wait for fields
				if (ow != null && $w.length) $w.val(ow).trigger('change') // → Open Size + setSize4Template12
				if (ol != null && $l.length) $l.val(ol).trigger('change')
				// Packing size: fill only if the cascade left it empty.
				const $packMm = $iType.find('.packingsizemm input')
				if ($packMm.length >= 2) {
					if (ow != null && !$packMm.eq(0).val()) $packMm.eq(0).val(ow).trigger('change')
					if (ol != null && !$packMm.eq(1).val()) $packMm.eq(1).val(ol).trigger('change')
				}
				return
			}

			// Non-custom: WAIT for the W/L/H inputs to render, then fill.
			const $width = $iType.find('.specmm.width').first()
			if (!$width.length) return setTimeout(tick, 100)

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

			// ติดกาว (side glue tab) and ฝาเสียบ (tuck flap) — form defaults (15/15)
			// are often wrong; override when the AI measured a value from the dieline.
			if (extraSpec && extraSpec.glue_mm != null) {
				const $glue = $iType.find('.specmm.glue').first()
				if ($glue.length) $glue.val(extraSpec.glue_mm).trigger('change')
			}
			if (extraSpec && extraSpec.tuck_mm != null) {
				const $tuck = $iType.find('.specmm.tuck').first()
				if ($tuck.length) $tuck.val(extraSpec.tuck_mm).trigger('change')
			}
		}
		setTimeout(tick, 150)
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
		if (t.indexOf('ดูเพล็กซ์') !== -1 || t.indexOf('duplex') !== -1 || t.indexOf('gbb') !== -1 || t.indexOf('กล่องแป้ง') !== -1) {
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

		// Build the full list of grades. The raw grade string is the most
		// reliable source — use it directly. Each grade = one type+gram pair.
		// layer value = number of grades (the system supports 2, 3, 5).
		let grades = Array.isArray(corrugated.grades)
			? corrugated.grades
					.filter((g) => g && g.type)
					.map((g) => ({ type: String(g.type).toUpperCase(), gram: g.gram }))
			: []
		const parsed = parseAllGradeParts(rawGrade)
		if (parsed.length > grades.length) grades = parsed // raw string wins if it has more
		if (grades.length === 0) return

		// Cascade: layer → flute → (type_1 → gram_1 → type_2 → gram_2 → ...).
		// Each select populates the next on its change event, so we must wait
		// for options before each match step.
		;(async () => {
			const $layer = $cInput.find('.layerCorrugated').first()
			// layer dropdown values are 2, 3, 5 — match by grade count.
			const layerVal = matchLayerByCount($layer, grades.length)
			if (!layerVal) {
				console.warn('fillCorrugated: no layer option for ' + grades.length + ' grades')
				return
			}
			$layer.val(layerVal).trigger('change')

			if (corrugated.flute) {
				const $flute = await waitForOptions($cInput.find('.fluteCorrugated').first(), 2000)
				if (!$flute) return
				const fm = findOptionMatch($flute, corrugated.flute)
				if (!fm) return
				$flute.val(fm).trigger('change')
			}

			// Fill every grade pair in sequence (cascading dropdowns).
			for (let i = 0; i < grades.length; i++) {
				await fillGradeSlot($cInput, String(i + 1), grades[i])
			}
		})().catch((e) => console.warn('fillCorrugated cascade error', e))
	}

	// The corrugated "layer" dropdown uses numeric values equal to the number
	// of paper plies (2, 3, 5). Match by exact count; if the exact count isn't
	// available, fall back to the nearest supported value.
	function matchLayerByCount($select, count) {
		const opts = []
		$select.find('option').each(function () {
			const v = String($(this).val()).trim()
			if (v) opts.push(v)
		})
		if (opts.includes(String(count))) return String(count)
		// nearest fallback
		const nums = opts.map((o) => parseInt(o, 10)).filter((n) => !isNaN(n))
		if (nums.length === 0) return null
		nums.sort((a, b) => Math.abs(a - count) - Math.abs(b - count))
		return String(nums[0])
	}

	async function fillGradeSlot($cInput, slot, info) {
		const $type = await waitForOptions($cInput.find('.type_' + slot).first(), 1500)
		if ($type && info.type) {
			const tm = findOptionMatch($type, info.type)
			if (tm) {
				$type.val(tm).trigger('change')
			}
		}
		const $gram = await waitForOptions($cInput.find('.gram_' + slot).first(), 1500)
		if ($gram && info.gram != null) {
			const gm = findOptionMatch($gram, String(info.gram))
			if (gm) {
				$gram.val(gm).trigger('change')
			}
		}
	}

	// Parse a slash-separated grade string into an array of {type, gram}.
	// "KS170/CA125/KI125" → [{KS,170},{CA,125},{KI,125}]
	function parseAllGradeParts(s) {
		if (!s) return []
		return String(s)
			.split(/[\/,]/)
			.map((p) => p.trim())
			.filter(Boolean)
			.map((part) => {
				const m = part.match(/^([a-zA-Z]+)[-\s]?(\d+)/i)
				if (!m) return null
				return { type: m[1].toUpperCase(), gram: parseInt(m[2], 10) }
			})
			.filter(Boolean)
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

	// In multi-F mode an addon (foil/emboss/deboss) has an F-code list — one
	// row per F-code that the addon applies to. Add rows + select each F-code.
	function fillAddonFCodes($addon, name) {
		if (!multiFCodes || multiFCodes.length === 0 || !$addon || !$addon.length) return
		setTimeout(() => {
			if (typeof getFCodeSelectOption === 'function') getFCodeSelectOption()
			const $addBtn = $addon.find('.add-addon-f-code').first()
			const needed = multiFCodes.length
			let existing = $addon.find('.' + name + 'FCode').length
			for (let k = existing; k < needed; k++) {
				if ($addBtn.length) $addBtn[0].click()
			}
			if (typeof getFCodeSelectOption === 'function') getFCodeSelectOption()
			setTimeout(() => {
				const $selects = $addon.find('.' + name + 'FCode')
				multiFCodes.forEach((fc, idx) => {
					if (fc && fc.code && $selects.eq(idx).length) {
						$selects.eq(idx).val(fc.code).trigger('change')
					}
				})
			}, 250)
		}, 350)
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
			fillAddonFCodes($fs, 'foilstamp')
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
			fillAddonFCodes($e, 'emboss')
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
			fillAddonFCodes($b, 'deboss')
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
				// Nothing matched any option's dropdown. Set the suggested
				// option for context, then prepend a "needs review" placeholder
				// to the coatingType so the form does NOT show a WRONG coating
				// (otherwise it auto-selects the first option in the list).
				if (coating.option) $opt.val(coating.option).trigger('change')
				setTimeout(() => {
					const $t = $container.find('.coatingType').first()
					if ($t.length) {
						const wantedLabel = wanted ? ' (spec: ' + wanted + ')' : ''
						$t.prepend('<option value="" selected>— กรุณาเลือกเอง' + escapeHtml(wantedLabel) + ' —</option>')
						$t.val('').trigger('change')
					}
				}, 400)
				return
			}
			$opt.val(candidates[i]).trigger('change')
			setTimeout(() => {
				if (!wanted) return // option set, no specific type to match
				const m = findOptionMatch($type, wanted)
				if (m) {
					$type.val(m).trigger('change')
					// For Spot UV / Spot UV Semi the form auto-renders a
					// "Size (in²)" input via .coatingSize. Fill it if AI gave
					// a size.
					if (/spot\s*uv/i.test(wanted)) {
						const w = coating.size_w_inch != null ? coating.size_w_inch : null
						const h = coating.size_h_inch != null ? coating.size_h_inch : null
						if (w != null || h != null) {
							setTimeout(() => {
								const $sizes = $container.find('.coatingSize')
								if ($sizes.length >= 2) {
									if (w != null) $sizes.eq(0).val(w).trigger('change').trigger('input')
									if (h != null) $sizes.eq(1).val(h).trigger('change').trigger('input')
								}
							}, 400)
						}
					}
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
