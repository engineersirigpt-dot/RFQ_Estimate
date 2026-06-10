// Calc Breakdown: after pressing "คำนวณ Price", show a floating button only
// for users with enable_price_check (approvers). Clicking opens a modal that
// reads est.mainData and explains how each cost was computed.
//
// We only READ from est.mainData — no calculation logic is duplicated here,
// so the breakdown always reflects the live values produced by
// function_estimate_calculation.js.

$(function () {
	const PRICE_BTN_IDS = '#calc_price, #calc_price_after_change, #calc_price_after_packing'

	function hasApprovalRights() {
		try {
			const d = JSON.parse(localStorage.getItem('data') || '{}')
			return d && d.enable_price_check == 1
		} catch (e) {
			return false
		}
	}

	function ensureFloatingButton() {
		if ($('#calc-breakdown-btn').length) return
		if (!hasApprovalRights()) return
		const $btn = $(`
			<button id="calc-breakdown-btn" type="button"
				style="position:fixed;bottom:80px;right:20px;z-index:9990;
					background:linear-gradient(90deg,#0ea5e9,#2563eb);color:#fff;
					border:none;border-radius:30px;padding:12px 18px;font-weight:bold;
					cursor:pointer;box-shadow:0 4px 12px rgba(37,99,235,0.4);
					font-family:inherit;font-size:14px">
				<i class="fa fa-calculator"></i> อธิบายการคำนวณ
			</button>
		`)
		$('body').append($btn)
		$btn.on('click', openBreakdownModal)
	}

	// Show button after a successful price calc.
	$('body').on('click', PRICE_BTN_IDS, function () {
		// Defer a beat so setCalculatePrice() finishes populating est.mainData.
		setTimeout(ensureFloatingButton, 600)
	})

	// Also expose ensureFloatingButton() on first load in case the page is
	// re-opened with already-calculated data.
	setTimeout(() => {
		if (typeof est !== 'undefined' && est && est.mainData && est.mainData.totalprice) {
			ensureFloatingButton()
		}
	}, 1500)

	function fmt(n, decimals) {
		if (n == null || isNaN(n)) return '-'
		const d = decimals != null ? decimals : 2
		return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
	}
	function fmtInt(n) { return fmt(n, 0) }
	function escapeHtml(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
			{ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
		))
	}

	function openBreakdownModal() {
		if (typeof est === 'undefined' || !est || !est.mainData) {
			alert('ยังไม่มีข้อมูลการคำนวณ — กรุณากด "คำนวณ Price" ก่อน')
			return
		}
		const html = renderBreakdown(est.mainData)
		showModal('📊 อธิบายการคำนวณราคา', html)
	}

	function renderBreakdown(mainData) {
		const parts = []
		parts.push(renderJobHeader(mainData))
		parts.push(renderQtySummary(mainData))      // อัปเดต: ราคารวมแต่ละยอดก่อน
		parts.push(renderTotalPriceBySheet(mainData)) // ราคาแยกตามกระบวนการต่อยอด

		const comps = mainData.component1 || []
		comps.forEach((comp, idx) => {
			parts.push(renderComponentBreakdown(comp, idx))
		})

		parts.push(renderProcessSummary(mainData))
		parts.push(renderDeliverySection(mainData))
		parts.push(renderPackingSection(mainData))
		parts.push(renderRawDataSection(mainData))
		return parts.join('\n')
	}

	function renderQtySummary(m) {
		const qty = (m.qty && m.qty.totalqty) || []
		if (!qty.length) return ''
		const tp = m.totalprice || []
		const rows = qty.map((q, i) => {
			const t = tp[i] || {}
			const total = t.total_with_price_diff != null ? t.total_with_price_diff : t.total_price
			const unit = total && q ? total / q : null
			return `<tr>
				<td>${fmtInt(q)}</td>
				<td class="cb-num">${total != null ? fmt(total) : '-'}</td>
				<td class="cb-num">${unit != null ? fmt(unit, 4) : '-'}</td>
			</tr>`
		}).join('')
		return `
			<div class="cb-section">
				<h3>💰 ราคารวมต่อยอดสั่งซื้อ (Summary)</h3>
				<table class="cb-formula">
					<thead><tr><th>ยอดสั่งซื้อ (ใบ)</th><th style="text-align:right">ราคารวม (บาท)</th><th style="text-align:right">Unit price (บาท/ใบ)</th></tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`
	}

	function renderTotalPriceBySheet(m) {
		const qty = (m.qty && m.qty.totalqty) || []
		const tp = m.totalprice || []
		if (!qty.length || !tp.length) return ''

		// Columns per qty tier
		const header = ['<th>หมวด</th>'].concat(qty.map((q) => `<th style="text-align:right">${fmtInt(q)}</th>`)).join('')

		const FIELDS = [
			['material', 'Material (paper, board ฯลฯ)'],
			['plate', 'Plate (เพลทพิมพ์)'],
			['print', 'Print (ค่าพิมพ์)'],
			['proof', 'Proof'],
			['afterpress', 'Afterpress (coating/foil/emboss/diecut)'],
			['delivery', 'Delivery (ขนส่ง)'],
			['other', 'Other'],
			['mark_up_price', 'Markup'],
			['mark_down_price', 'Markdown (ส่วนลด)'],
			['price_diff', 'Price diff'],
			['customer_gift', 'Customer gift'],
			['total_price', 'รวมก่อนปรับ'],
			['total_with_price_diff', 'ราคารวมสุดท้าย']
		]

		const rows = FIELDS.map(([key, label]) => {
			const cells = tp.map((t) => {
				const v = t ? t[key] : null
				if (v == null || (typeof v === 'number' && v === 0 && !['total_price', 'total_with_price_diff'].includes(key))) {
					return '<td class="cb-num" style="color:#9ca3af">-</td>'
				}
				const isTotal = key.startsWith('total')
				return `<td class="cb-num"${isTotal ? ' style="font-weight:bold;background:#fef3c7"' : ''}>${fmt(v)}</td>`
			}).join('')
			return `<tr><td>${escapeHtml(label)}</td>${cells}</tr>`
		}).join('')

		return `
			<div class="cb-section">
				<h3>📊 รายการค่าใช้จ่ายแบ่งตามยอด (totalprice[])</h3>
				<table class="cb-formula">
					<thead><tr>${header}</tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`
	}

	function renderDeliverySection(m) {
		const arr = m.delivery || []
		if (!Array.isArray(arr) || arr.length === 0) return ''
		const rows = arr.map((d, i) => `
			<tr>
				<td>#${i + 1}</td>
				<td>${escapeHtml(d.destination_name || d.deliveryDestinationName || '-')}</td>
				<td>${escapeHtml(d.delivery_date || '-')}</td>
				<td class="cb-num">${fmtInt(d.qty || d.delivery_qty || 0)}</td>
				<td class="cb-num">${fmt(d.price || d.total_price || 0)}</td>
			</tr>`).join('')
		return `
			<div class="cb-section">
				<h3>🚚 Delivery</h3>
				<table class="cb-formula">
					<thead><tr><th>#</th><th>ปลายทาง</th><th>วันที่</th><th style="text-align:right">จำนวน</th><th style="text-align:right">ราคา</th></tr></thead>
					<tbody>${rows}</tbody>
				</table>
			</div>
		`
	}

	function renderPackingSection(m) {
		// Packing data lives inside each component's box_type or paper_usage.line[i].price.packing
		const comps = m.component1 || []
		const lines = []
		comps.forEach((c, ci) => {
			const pu = c.paper_usage || {}
			;(pu.line || []).forEach((ln, li) => {
				const pk = (ln.price && ln.price.packing) || null
				if (pk && (pk.price != null)) {
					lines.push(`<tr>
						<td>Comp #${ci + 1} / ยอด ${fmtInt(ln.quantity || ln.qty || 0)}</td>
						<td class="cb-formula-cell">${escapeHtml(pk.name || 'packing')}</td>
						<td class="cb-num">${fmt(pk.price)}</td>
					</tr>`)
				}
			})
		})
		if (!lines.length) return ''
		return `
			<div class="cb-section">
				<h3>📦 Packing</h3>
				<table class="cb-formula">
					<thead><tr><th>รายการ</th><th>ชนิด</th><th style="text-align:right">ราคา</th></tr></thead>
					<tbody>${lines.join('')}</tbody>
				</table>
			</div>
		`
	}

	function renderRawDataSection(m) {
		// Last-resort full dump for transparency / debugging
		let json
		try {
			json = JSON.stringify(m, (k, v) => {
				// Strip super-large fields if they exist
				if (k === 'box_template_image' || k === 'pdf_b64') return '[omitted]'
				return v
			}, 2)
		} catch (e) {
			json = 'serialize error: ' + e.message
		}
		return `
			<div class="cb-section">
				<details>
					<summary><b>🔧 ดูข้อมูลดิบทั้งหมด (raw mainData)</b> — สำหรับ debug</summary>
					<pre style="background:#1f2937;color:#e5e7eb;padding:10px;border-radius:4px;font-size:11px;max-height:400px;overflow:auto;white-space:pre-wrap;word-break:break-all">${escapeHtml(json)}</pre>
				</details>
			</div>
		`
	}

	function renderJobHeader(m) {
		const j = m.job || {}
		return `
			<div class="cb-section">
				<h3>🏷️ ข้อมูล Job</h3>
				<div class="cb-grid">
					<div><b>RFQ:</b> ${escapeHtml(j.job_id || '-')}</div>
					<div><b>Job Name:</b> ${escapeHtml(j.job_name || '-')}</div>
					<div><b>Print Type:</b> ${escapeHtml(j.print_type || '-')}</div>
					<div><b>Ink Type:</b> ${escapeHtml(j.ink_type || '-')}</div>
					<div><b>Reprint:</b> ${j.is_reprinted == 1 ? 'ใช่' : 'ไม่'}</div>
					<div><b>ใช้ Plate เก่า:</b> ${j.is_use_previous_plate == 1 ? 'ใช่' : 'ไม่'}</div>
				</div>
			</div>
		`
	}

	function renderComponentBreakdown(comp, idx) {
		const lines = comp.paper_usage && comp.paper_usage.line ? comp.paper_usage.line : []
		const compName = (comp.component_name) || ('Component ' + (idx + 1))

		// Paper-section header (base, markup, percent)
		const p = comp.paper || {}
		const paperBase = p.paper_cost || 0
		const markup = p.paper_markup || 0
		const rollCut = p.paper_percent || 0
		const paperTotal = p.paper_total_price

		const rows = lines.map((ln, lineIdx) => renderLineBreakdown(ln, lineIdx, comp)).join('')

		return `
			<div class="cb-section">
				<h3>📦 ${escapeHtml(compName)} (Component #${idx + 1})</h3>

				<details open>
				<summary><b>กระดาษ (Paper)</b></summary>
				<table class="cb-formula">
					<tr><td>Base cost</td><td>${fmt(paperBase)} ${p.sheet_unit_price ? 'บาท/แผ่น' : 'บาท/กก.'}</td></tr>
					<tr><td>+ Markup (${fmt(markup, 1)}%)</td><td>${fmt(paperBase * markup / 100)}</td></tr>
					<tr><td>+ ค่าตัดม้วน</td><td>${fmt(rollCut)}</td></tr>
					<tr class="cb-sum"><td><b>Paper unit price</b></td><td><b>${fmt(paperTotal)} ${p.sheet_unit_price ? 'บาท/แผ่น' : 'บาท/กก.'}</b></td></tr>
					<tr><td colspan="2" class="cb-formula-note">สูตร: (cost × (1 + markup/100)) + paperPercent</td></tr>
				</table>
				</details>

				${rows}
			</div>
		`
	}

	function renderLineBreakdown(line, lineIdx, comp) {
		const qty = line.quantity || line.qty || line.f_qty || '-'
		const fCode = line.f_code ? ' • F-Code: ' + escapeHtml(line.f_code) : ''
		const price = line.price || {}
		const pu = comp.paper_usage || {}
		const printType = (est.mainData && est.mainData.job && est.mainData.job.print_type) || '-'
		const inkType = (est.mainData && est.mainData.job && est.mainData.job.ink_type) || 'conventional'

		// Resolve colors (may be in component.color[0] or per f_code)
		const color = (comp.color && comp.color[0]) || {}
		const outsideCol = color.outside || 0
		const insideCol = color.inside || 0

		// Context block for transparency
		const ctxHtml = `
			<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:8px 12px;margin-bottom:8px;font-size:12px">
				<b>ตัวแปรของรายการนี้:</b>
				ups=${fmt(pu.ups || 0, 0)} •
				sig=${fmt(pu.sig || 0, 4)} •
				paper_net=${fmt(line.paper_net || 0, 2)} •
				after_ups=${fmt(line.after_ups || 0, 0)} •
				after_waste=${fmt(line.after_waste || 0, 0)} •
				outside=${outsideCol} cols • inside=${insideCol} cols •
				print=${escapeHtml(printType)} • ink=${escapeHtml(inkType)}
			</div>
		`

		const sections = []

		// --- Paper ---
		if (price.paper) {
			const p = comp.paper || {}
			sections.push(renderCostSection('🟫 ค่ากระดาษ (Paper)', [
				{
					label: 'Paper base cost', formula: `cost = ${fmt(p.paper_cost)} ${p.sheet_unit_price ? 'บาท/แผ่น' : 'บาท/กก.'}`
				},
				{
					label: '+ Markup', formula: `markup = ${fmt(p.paper_markup, 1)}%`
				},
				{
					label: '+ ค่าตัดม้วน', formula: `+ ${fmt(p.paper_percent)} บาท`
				},
				{
					label: 'Paper unit price', formula:
						`= (${fmt(p.paper_cost)} × (1 + ${fmt(p.paper_markup, 1)}/100)) + ${fmt(p.paper_percent)} = <b>${fmt(p.paper_total_price)}</b>`,
					highlight: true
				},
				{
					label: 'Total', formula:
						`paper_net × unit_price = ${fmt(price.paper.qty, 4)} × ${fmt(price.paper.unit_price)} = <b>${fmt(price.paper.price)}</b> บาท`,
					price: price.paper.price
				}
			]))
		}

		// --- Plate ---
		if (price.plate) {
			const plateRows = []
			plateRows.push({ label: '', formula:
				`<i style="color:#6b7280">Offset: unit_price = cols × sig × plate_ppu, qty = max(1, round(after_waste/100000))</i>`
			})
			;['outside', 'inside'].forEach((side) => {
				const pl = price.plate[side]
				if (!pl || !pl.price) return
				const cols = side === 'outside' ? outsideCol : insideCol
				plateRows.push({
					label: 'Plate ' + side,
					formula: `cols × sig × plate_ppu × qty = ${cols} × ${fmt(pu.sig || 0, 4)} × (plate_ppu) × ${fmtInt(pl.qty)} = <b>${fmt(pl.price)}</b>`,
					price: pl.price
				})
				plateRows.push({
					label: '  ↳ unit_price', formula: `${fmt(pl.unit_price)} (= cols × sig × plate_ppu)`
				})
			})
			if (price.plate.reprint) {
				;['outside', 'inside'].forEach((side) => {
					const pl = price.plate.reprint[side]
					if (!pl || pl.price <= 0) return
					plateRows.push({
						label: 'Plate Reprint ' + side,
						formula: `unit_price × qty = ${fmt(pl.unit_price)} × ${fmtInt(pl.qty)} = <b>${fmt(pl.price)}</b>`,
						price: pl.price
					})
				})
			}
			sections.push(renderCostSection('⚙️ ค่าเพลท (Plate)', plateRows))
		}

		// --- Print ---
		if (price.print) {
			const printRows = []
			const inkFactor = inkType === 'UV' ? 2.5 : 1
			printRows.push({ label: '', formula:
				`<i style="color:#6b7280">Offset: unit_price = ink_factor × print_price × cols × sig (per side). ink_factor = ${inkFactor} (${inkType})</i>`
			})
			;['outside', 'inside'].forEach((side) => {
				const pr = price.print[side]
				if (!pr || !pr.price) return
				const cols = side === 'outside' ? outsideCol : insideCol
				printRows.push({
					label: 'Print ' + side,
					formula: `unit_price × qty = ${fmt(pr.unit_price, 4)} × ${fmtInt(pr.qty)} = <b>${fmt(pr.price)}</b>`,
					price: pr.price
				})
				printRows.push({
					label: '  ↳ unit_price', formula:
						`${inkFactor} × print_price × ${cols} × ${fmt(pu.sig || 0, 4)} = ${fmt(pr.unit_price, 4)}`
				})
			})
			if (price.print.all && price.print.all.price) {
				printRows.push({
					label: 'Print (all)',
					formula: `unit_price × qty = ${fmt(price.print.all.unit_price)} × ${fmtInt(price.print.all.qty)} = <b>${fmt(price.print.all.price)}</b>`,
					price: price.print.all.price
				})
			}
			sections.push(renderCostSection('🖨️ ค่าพิมพ์ (Print)', printRows))
		}

		// --- Foil Stamp / Emboss / Deboss --- (per addon arrays at component level)
		const addons = comp.addon || []
		addons.forEach((ad, ai) => {
			if (!ad || !ad.type) return
			if (!['foilstamp', 'emboss', 'deboss'].includes(ad.type)) return
			const tx = ad.type === 'foilstamp' ? '🏷️ Foil Stamp' : ad.type === 'emboss' ? '🔼 Emboss' : '🔽 Deboss'
			const info = ad.info || {}
			const block = info.block || {}
			const lineEntry = (ad.line || [])[lineIdx] || (ad.line && ad.line[0]) || {}
			const rows = []
			if (info.width != null) {
				rows.push({ label: 'Size', formula: `${fmt(info.width, 2)} × ${fmt(info.length, 2)} inch² = ${fmt((info.width || 0) * (info.length || 0), 4)} in²` })
			}
			if (block.block_unit_price != null) {
				rows.push({ label: 'Block unit price', formula: `${fmt(block.block_unit_price)} บาท (size × block_rate, min ${fmt(0)})` })
			}
			if (block.film_unit_price != null) {
				rows.push({ label: 'Film unit price', formula: `${fmt(block.film_unit_price)} บาท (size × film_rate)` })
			}
			if (info.foil_unit_price != null) {
				rows.push({ label: 'Foil unit price', formula: `roll_price / pcs_per_roll = ${fmt(info.foil_unit_price, 4)} บาท/ใบ` })
				rows.push({ label: 'pcs_per_roll', formula: `${fmtInt(info.pcs_per_roll)} ใบ ต่อม้วน` })
			}
			if (lineEntry.price != null) {
				rows.push({ label: 'Total', formula: `<b>${fmt(lineEntry.price)}</b> บาท`, price: lineEntry.price, highlight: true })
			}
			sections.push(renderCostSection(tx + ' #' + (ai + 1), rows))
		})

		// --- Coating ---
		;[].concat(price.coating || []).filter(Boolean).forEach((c, i) => {
			const rows = [
				{ label: 'Coating', formula: `unit_price × qty = ${fmt(c.unit_price, 4)} × ${fmtInt(c.qty)} = <b>${fmt(c.price)}</b>`, price: c.price }
			]
			sections.push(renderCostSection('🎨 Coating #' + (i + 1), rows))
		})

		// Compute subtotal from all price.* entries that have a .price
		let subtotal = 0
		const walk = (obj) => {
			if (!obj || typeof obj !== 'object') return
			if (typeof obj.price === 'number') subtotal += obj.price
			Object.values(obj).forEach((v) => {
				if (v && typeof v === 'object') walk(v)
			})
		}
		walk(price)

		return `
			<details ${lineIdx === 0 ? 'open' : ''}>
				<summary><b>ยอด ${fmtInt(qty)}</b>${fCode} — รวม ${fmt(subtotal)} บาท</summary>
				${ctxHtml}
				${sections.join('')}
			</details>
		`
	}

	function renderCostSection(title, rows) {
		const rowsHtml = rows.map((r) => `
			<tr ${r.highlight ? 'class="cb-sum"' : ''}>
				<td style="width:24%">${escapeHtml(r.label)}</td>
				<td class="cb-formula-cell">${r.formula}</td>
				${r.price != null ? `<td class="cb-num" style="width:15%">${fmt(r.price)}</td>` : '<td></td>'}
			</tr>`).join('')
		return `
			<div style="margin-top:10px">
				<div style="font-weight:bold;font-size:13px;background:#f3f4f6;padding:6px 10px;border-radius:4px;margin-bottom:4px">${title}</div>
				<table class="cb-formula"><tbody>${rowsHtml}</tbody></table>
			</div>
		`
	}

	function renderProcessSummary(m) {
		const qty = (m.qty && m.qty.totalqty) || []
		const groups = [
			['other_process', '🛠️ Other Process'],
			['handwork', '✋ Handwork'],
			['custom_process', '🤝 จัดจ้าง (Custom)'],
			['material', '📦 Material'],
			['other_cost', '💵 Other Cost']
		]
		const sections = []
		groups.forEach(([key, label]) => {
			const arr = m[key] || []
			if (!Array.isArray(arr) || arr.length === 0) return
			// Each item may have: name, ppu (price per unit), is_fixedPrice, total_price, line[]
			// Show per-qty breakdown when available.
			const rows = arr.map((p, i) => {
				const ppu = p.ppu != null ? p.ppu : p.price_per_unit
				const isFixed = p.is_fixedPrice
				const lineCells = qty.length > 0 ? qty.map((q, qi) => {
					const lp = (p.line && p.line[qi]) ? p.line[qi].price : (Array.isArray(p.prices) ? p.prices[qi] : null)
					return `<td class="cb-num">${lp != null ? fmt(lp) : '-'}</td>`
				}).join('') : `<td class="cb-num">${fmt(p.total_price || p.price)}</td>`

				return `<tr>
					<td>${i + 1}. ${escapeHtml(p.name || '-')}</td>
					<td>${ppu != null ? fmt(ppu, 4) : '-'} ${isFixed ? '(คงที่)' : ''}</td>
					${lineCells}
				</tr>`
			}).join('')
			const header = qty.length > 0
				? '<th>ชื่อ</th><th>ราคาต่อหน่วย</th>' + qty.map((q) => `<th style="text-align:right">ยอด ${fmtInt(q)}</th>`).join('')
				: '<th>ชื่อ</th><th>ราคาต่อหน่วย</th><th style="text-align:right">รวม</th>'
			sections.push(`
				<div class="cb-section">
					<h3>${label}</h3>
					<table class="cb-formula">
						<thead><tr>${header}</tr></thead>
						<tbody>${rows}</tbody>
					</table>
				</div>
			`)
		})
		return sections.join('')
	}

	function showModal(title, html) {
		$('#calc-breakdown-modal').remove()
		const $m = $(`
			<div id="calc-breakdown-modal"
				style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10001;
					display:flex;align-items:center;justify-content:center">
				<div class="cb-modal-content"
					style="background:#fff;width:min(960px,94vw);max-height:90vh;
						border-radius:10px;box-shadow:0 12px 50px rgba(0,0,0,0.3);
						display:flex;flex-direction:column;overflow:hidden">
					<div style="background:linear-gradient(90deg,#0ea5e9,#2563eb);color:#fff;
						padding:14px 20px;display:flex;justify-content:space-between;align-items:center;
						font-weight:bold;font-size:17px">
						<span>${escapeHtml(title)}</span>
						<span class="cb-close" style="cursor:pointer;font-size:26px;padding:0 8px">&times;</span>
					</div>
					<div style="padding:18px;overflow:auto;flex:1;font-size:13px">
						${html}
					</div>
					<div style="border-top:1px solid #eee;padding:10px 18px;text-align:right;background:#fafafa">
						<button class="cb-close-btn" type="button"
							style="background:#6b7280;color:#fff;border:none;padding:8px 18px;
								border-radius:5px;cursor:pointer;font-weight:bold">ปิด</button>
					</div>
				</div>
			</div>
		`)
		$('body').append($m)
		$m.on('click', function (e) {
			if (e.target === this || $(e.target).hasClass('cb-close') || $(e.target).hasClass('cb-close-btn')) $m.remove()
		})
	}

	// Inject scoped styles once.
	if (!$('#calc-breakdown-styles').length) {
		$('head').append(`
			<style id="calc-breakdown-styles">
				#calc-breakdown-modal .cb-section { background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:12px 14px; margin-bottom:12px }
				#calc-breakdown-modal .cb-section h3 { margin:0 0 10px 0; font-size:15px; color:#1f2937 }
				#calc-breakdown-modal .cb-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 16px; font-size:13px }
				#calc-breakdown-modal table.cb-formula { width:100%; border-collapse:collapse; font-size:13px; margin-top:6px }
				#calc-breakdown-modal table.cb-formula th { text-align:left; background:#e5e7eb; padding:6px 8px; font-weight:bold; font-size:12px }
				#calc-breakdown-modal table.cb-formula td { padding:5px 8px; border-bottom:1px solid #f0f0f0 }
				#calc-breakdown-modal .cb-num { text-align:right; font-family:monospace }
				#calc-breakdown-modal .cb-sum td { background:#fef3c7; font-weight:bold; border-top:1px solid #fbbf24 }
				#calc-breakdown-modal .cb-formula-cell { font-family:monospace; font-size:12px; color:#4b5563 }
				#calc-breakdown-modal .cb-formula-note { font-style:italic; color:#6b7280; font-size:11px }
				#calc-breakdown-modal details { background:#fff; border:1px solid #e5e7eb; border-radius:6px; padding:8px 10px; margin-top:8px }
				#calc-breakdown-modal details summary { cursor:pointer; padding:4px 0; user-select:none }
				#calc-breakdown-modal details[open] summary { border-bottom:1px solid #e5e7eb; margin-bottom:8px; padding-bottom:6px }
				#calc-breakdown-btn:hover { transform:translateY(-1px); box-shadow:0 6px 16px rgba(37,99,235,0.5) }
			</style>
		`)
	}
})
