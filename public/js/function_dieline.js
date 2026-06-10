// Adds a "📐 สร้างไดไล" button on the estimate page that calls
// diecuttemplates.com via our /dieline/generate proxy and displays the result.

$(function () {
	if (!/\/estimate|\/view/.test(location.pathname)) return

	// Load the internal→diecuttemplates map once and cache it client-side so
	// we can show the user which external template will be used.
	let TEMPLATE_MAP = {}
	$.getJSON('/dieline/map-info').done((res) => {
		if (res && res.success) TEMPLATE_MAP = res.map || {}
	})

	function injectButton() {
		if ($('#dieline-btn').length) return
		// Place after Calc Price buttons in #div_bttn
		const $target = $('#div_bttn > div').first()
		if (!$target.length) {
			setTimeout(injectButton, 500)
			return
		}
		const $btn = $(`
			<button id="dieline-btn" type="button" style="
				margin-left:10px;
				background:linear-gradient(90deg,#0ea5e9 0%,#2563eb 100%);
				color:#fff;border:none;padding:8px 16px;border-radius:6px;
				font-weight:bold;cursor:pointer">
				<i class="fa fa-cube"></i> สร้างไดไล
			</button>
		`)
		$target.append($btn)
	}
	setTimeout(injectButton, 1500)
	// Re-inject if the form rerenders
	setInterval(injectButton, 3000)

	$('body').on('click', '#dieline-btn', openDielineModal)

	function openDielineModal() {
		// Read dimensions + template from the first component
		const $comp = $('.component[index="0"]')
		const $iType = $('.inputType[index="0"]')
		const tplId = $('.boxType[index="0"]').val() || ''
		const widthMm = parseFloat($iType.find('.specmm.width').val()) || null
		const lengthMm = parseFloat($iType.find('.specmm.length').val()) || null
		const heightMm = parseFloat($iType.find('.specmm.depth').val()) || null
		const tuckMm = parseFloat($iType.find('.specmm.tuck').val()) || 15
		const dustMm = parseFloat($iType.find('.specmm.dust').val()) || 8

		if (!widthMm || !lengthMm || !heightMm) {
			alert('กรุณากรอกขนาด กว้าง × ยาว × สูง (mm) ใน Component ที่ 1 ก่อน')
			return
		}

		showModal(tplId, { widthMm, lengthMm, heightMm, tuckMm, dustMm })
	}

	function showModal(internalTplId, dims) {
		$('#dieline-overlay').remove()
		const mapping = TEMPLATE_MAP[String(internalTplId)] || null
		const mappingLabel = mapping
			? `${escapeHtml(mapping.name)} (${escapeHtml(mapping.group)}) — <code style="background:#fef3c7;padding:2px 6px;border-radius:3px">${mapping.id}</code>`
			: `<span style="color:#dc2626">⚠️ ยังไม่ได้ map — ใช้ Tuck End เป็น fallback</span>`
		const $overlay = $(`
			<div id="dieline-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center">
				<div style="background:#fff;width:min(900px,95vw);max-height:92vh;border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.3);display:flex;flex-direction:column;overflow:hidden">
					<div style="background:linear-gradient(90deg,#0ea5e9,#2563eb);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:bold">
						<span><i class="fa fa-cube"></i> สร้างไดไล (Powered by diecuttemplates.com)</span>
						<span class="dl-close" style="cursor:pointer;font-size:24px;padding:0 6px">&times;</span>
					</div>
					<div style="padding:18px;overflow:auto;flex:1">
						<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:10px 12px;border-radius:4px;font-size:13px;margin-bottom:12px">
							<b>Template:</b> ${mappingLabel}
						</div>
						<div style="display:flex;gap:16px;flex-wrap:wrap;background:#f9fafb;padding:12px;border-radius:6px;font-size:13px;margin-bottom:12px">
							<div><b>กว้าง:</b> ${dims.widthMm} mm</div>
							<div><b>ยาว:</b> ${dims.lengthMm} mm</div>
							<div><b>สูง:</b> ${dims.heightMm} mm</div>
							<div><b>ฝา (tuck):</b> ${dims.tuckMm} mm</div>
							<div><b>ปีก (dust):</b> ${dims.dustMm} mm</div>
							<div><b>Internal template:</b> ${internalTplId || '(default)'}</div>
						</div>

						<div id="dl-progress" style="margin-bottom:10px;font-size:13px;color:#555">
							<span id="dl-progress-step">⏳ กำลังเชื่อมต่อ diecuttemplates.com...</span>
							<span id="dl-elapsed" style="color:#888;margin-left:8px">0s</span>
						</div>

						<div id="dl-result" style="text-align:center;min-height:200px;display:flex;align-items:center;justify-content:center">
							<i class="fa fa-spinner fa-pulse" style="font-size:36px;color:#2563eb"></i>
						</div>
					</div>
					<div style="padding:12px 18px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:8px;background:#fafafa">
						<a id="dl-download-pdf" style="display:none;background:#0ea5e9;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none;font-weight:bold" target="_blank">📥 PDF</a>
						<a id="dl-download-dxf" style="display:none;background:#0ea5e9;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none;font-weight:bold" target="_blank">📥 DXF</a>
						<a id="dl-download-svg" style="display:none;background:#0ea5e9;color:#fff;padding:8px 14px;border-radius:5px;text-decoration:none;font-weight:bold" target="_blank">📥 SVG</a>
						<button class="dl-close" style="padding:8px 16px;background:#eee;border:none;border-radius:5px;cursor:pointer">ปิด</button>
					</div>
				</div>
			</div>
		`)
		$('body').append($overlay)
		$overlay.on('click', function (e) {
			if (e.target === this || $(e.target).hasClass('dl-close')) $overlay.remove()
		})

		generate(internalTplId, dims)
	}

	async function generate(internalTplId, dims) {
		// Start elapsed timer + step progress
		const startTime = Date.now()
		const steps = [
			'⏳ กำลังเชื่อมต่อ diecuttemplates.com...',
			'📐 กำลังคำนวณ layout ของไดไล...',
			'🎨 กำลังสร้าง SVG vector...',
			'📥 กำลังโหลดผลลัพธ์...'
		]
		let stepIdx = 0
		const timer = setInterval(() => {
			const elapsed = Math.floor((Date.now() - startTime) / 1000)
			$('#dl-elapsed').text(elapsed + 's')
			if (elapsed > (stepIdx + 1) * 4 && stepIdx < steps.length - 1) {
				stepIdx++
				$('#dl-progress-step').text(steps[stepIdx])
			}
		}, 500)
		const cleanup = () => clearInterval(timer)

		const payload = {
			internal_template_id: internalTplId || null,
			format: 'svg',
			variables: {
				unit: 'mm',
				material: 0.5,
				length: dims.lengthMm,
				width: dims.widthMm,
				height: dims.heightMm,
				top_tuck_flap: dims.tuckMm,
				dust_flap: dims.dustMm
			}
		}
		try {
			const r = await fetch('/dieline/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
				credentials: 'same-origin'
			})
			const json = await r.json()
			cleanup()
			$('#dl-progress').hide()
			if (!json.success) {
				// Show full error detail so we can see exactly what went wrong
				const detail = json.api_error_detail ? JSON.stringify(json.api_error_detail, null, 2) : ''
				$('#dl-result').html(`
					<div style="color:#b91c1c;padding:20px;text-align:left;width:100%">
						<div style="text-align:center;margin-bottom:12px">
							<i class="fa fa-exclamation-triangle" style="font-size:32px"></i>
							<div style="margin-top:10px;font-weight:bold">เกิดข้อผิดพลาด</div>
						</div>
						<div style="font-size:13px;padding:10px;background:#fef2f2;border-radius:4px;margin-bottom:10px">
							${escapeHtml(json.error || 'unknown')}
						</div>
						${json.template_id ? `<div style="font-size:12px;color:#555;margin-bottom:8px"><b>Template ID:</b> <code>${escapeHtml(json.template_id)}</code></div>` : ''}
						${detail ? `<details><summary style="cursor:pointer;font-size:12px;color:#555">ดูรายละเอียดจาก API</summary><pre style="background:#f3f4f6;padding:10px;border-radius:4px;font-size:11px;overflow:auto;max-height:300px">${escapeHtml(detail)}</pre></details>` : ''}
					</div>
				`)
				return
			}
			const cacheMark = json.cached ? '<span style="color:#059669;font-size:11px;margin-left:8px">⚡ from cache</span>' : ''
			const url = json.url
			const dim = json.dimensions || {}
			let adjHtml = ''
			if (Array.isArray(json.adjustments) && json.adjustments.length > 0) {
				const rows = json.adjustments.map((a) => `<li><b>${escapeHtml(a.name)}</b>: ${a.from ?? '-'} → <b>${a.to}</b> ${a.reason ? '(' + escapeHtml(a.reason) + ')' : ''}</li>`).join('')
				adjHtml = `
					<div style="padding:10px;background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;font-size:12px;margin-bottom:10px">
						⚠️ <b>ระบบปรับค่าให้อัตโนมัติ</b> (template มีข้อจำกัด):
						<ul style="margin:6px 0 0 20px;padding:0">${rows}</ul>
					</div>
				`
			}
			$('#dl-result').html(`
				<div style="width:100%">
					${adjHtml}
					<div style="padding:10px;background:#ecfdf5;border-radius:6px;font-size:13px;margin-bottom:10px">
						✅ <b>สร้างเรียบร้อย</b> — Sheet size: ${dim.width} × ${dim.height} ${dim.unit || 'mm'}${cacheMark}
					</div>
					<div style="border:1px solid #ddd;border-radius:6px;padding:10px;background:#fff;text-align:center;max-height:500px;overflow:auto">
						<object data="${url}" type="image/svg+xml" style="max-width:100%;height:auto"></object>
					</div>
				</div>
			`)
			$('#dl-download-svg').attr('href', url).show()
			// Show PDF/DXF buttons as "generate on click" instead of pre-fetching
			// (avoids hitting the API rate limit by firing 3 requests at once).
			$('#dl-download-pdf')
				.attr('href', '#')
				.attr('data-fmt', 'pdf')
				.removeAttr('target')
				.show()
			$('#dl-download-dxf')
				.attr('href', '#')
				.attr('data-fmt', 'dxf')
				.removeAttr('target')
				.show()
			$('#dl-download-pdf, #dl-download-dxf').off('click').on('click', function (e) {
				e.preventDefault()
				const fmt = $(this).attr('data-fmt')
				const url = $(this).attr('data-url')
				if (url) {
					window.open(url, '_blank')
					return
				}
				downloadFormat(internalTplId, dims, fmt, this)
			})
		} catch (err) {
			cleanup()
			$('#dl-progress').hide()
			$('#dl-result').html('<div style="color:#b91c1c">เชื่อมต่อไม่ได้: ' + escapeHtml(err.message) + '</div>')
		}
	}

	async function downloadFormat(internalTplId, dims, fmt, $btnEl) {
		const $btn = $($btnEl)
		const original = $btn.html()
		$btn.html('<i class="fa fa-spinner fa-pulse"></i> กำลังสร้าง...')
		try {
			const r = await fetch('/dieline/generate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					internal_template_id: internalTplId || null,
					format: fmt,
					variables: {
						unit: 'mm', material: 0.5,
						length: dims.lengthMm, width: dims.widthMm, height: dims.heightMm,
						top_tuck_flap: dims.tuckMm, dust_flap: dims.dustMm
					}
				}),
				credentials: 'same-origin'
			})
			const json = await r.json()
			if (json.success && json.url) {
				$btn.attr('data-url', json.url).attr('target', '_blank').attr('href', json.url)
				$btn.html(original)
				window.open(json.url, '_blank')
			} else {
				$btn.html(original)
				alert('สร้าง ' + fmt.toUpperCase() + ' ไม่สำเร็จ: ' + (json.error || 'unknown'))
			}
		} catch (e) {
			$btn.html(original)
			alert('สร้าง ' + fmt.toUpperCase() + ' ล้มเหลว: ' + e.message)
		}
	}

	function escapeHtml(s) {
		return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
	}
})
