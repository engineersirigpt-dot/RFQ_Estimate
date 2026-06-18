// ============================================================================
// [injected] แถบเลื่อนปรับ Markup (Materials / Production) — ใช้งานง่ายขึ้น
//   ไม่แตะ calc/ฟอร์มของเพื่อน — แค่ set ค่าใน input ที่มีอยู่ (.MarkingPercentMaterial/
//   .MarkingPercentProduction) แล้ว trigger 'change' → handler เดิม (changeMarkingEvent)
//   คำนวณราคาใหม่เอง (อัปเดตช่องในที่ ไม่ re-render ทั้งตาราง)
//   • ตั้ง default Materials = 15% ครั้งแรกที่ตารางขึ้น (ถ้ายังเป็น 0)
//   ⚠️ Materials = กำไรบนค่ากระดาษ/วัสดุ • Production = กำไรบนค่างานผลิต (เพลท+พิมพ์+process+แพ็ค)
// ============================================================================
if (typeof document !== 'undefined' && typeof jQuery !== 'undefined') {
	jQuery(function ($) {
		const PRICE_BTN = '#calc_price, #calc_price_after_change, #calc_price_after_packing'
		const DEFAULT_MATERIAL = 15 // % เริ่มต้นของ Materials (ปรับเลขเดียวที่นี่)
		const SEL_MAT = '.MarkingPercentMaterial input'
		const SEL_PROD = '.MarkingPercentProduction input'
		let defaultApplied = false // ตั้ง 15% แค่ครั้งเดียวต่อการเปิดหน้า (กันไปทับค่าที่ผู้ใช้/งานเก่าตั้งไว้)

		// set ทุกช่อง (ทุกยอด) เป็นค่าเดียว แล้ว trigger change ให้ handler เดิมคำนวณ
		function setAll(sel, val) {
			const $inputs = $(sel)
			if (!$inputs.length) return false
			$inputs.each(function () { $(this).val(val).trigger('change') })
			return true
		}

		function curVal(sel) { return parseFloat($(sel).first().val() || 0) || 0 }

		function row(id, label, val, hint) {
			return `<div style="display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px">
				<span style="width:88px;font-weight:bold;color:#374151">${label}</span>
				<input type="range" id="${id}" min="0" max="50" step="1" value="${val}" style="flex:1;max-width:260px;accent-color:#2563eb">
				<input type="number" id="${id}_n" min="0" max="50" step="1" value="${val}" style="width:52px;text-align:center;border:1px solid #d1d5db;border-radius:4px;padding:2px"> %
				<span style="font-size:11px;color:#9ca3af">${hint}</span>
			</div>`
		}

		function panelHtml(matVal, prodVal) {
			return `<div id="markup_slider_panel" style="max-width:900px;margin:10px auto;border:1px solid #93c5fd;background:#eff6ff;border-radius:8px;padding:10px 14px;font-family:inherit">
				<div style="font-weight:bold;font-size:14px;color:#1d4ed8;margin-bottom:4px">🎚️ ปรับกำไร (Markup) — เลื่อนแล้วราคาคำนวณใหม่ทันที</div>
				${row('mk_mat', 'Materials', matVal, 'กำไรบนค่ากระดาษ/วัสดุ')}
				${row('mk_prod', 'Production', prodVal, 'กำไรบนค่างานผลิต (เพลท/พิมพ์/process/แพ็ค)')}
			</div>`
		}

		// ผูก slider <-> ช่องเลข <-> input จริงในตาราง
		//   ลาก slider → อัปเดตตัวเลขสด (ไม่คำนวณ) • ปล่อย (change) → คำนวณราคาใหม่ (กัน lag)
		function bind(id, sel) {
			const clamp = (v) => Math.max(0, Math.min(50, parseFloat(v) || 0))
			const apply = (v) => { const val = clamp(v); $('#' + id).val(val); $('#' + id + '_n').val(val); setAll(sel, val) }
			$('#' + id).on('input', function () { $('#' + id + '_n').val(clamp(this.value)) }) // สดๆ ระหว่างลาก
			$('#' + id).on('change', function () { apply(this.value) })                          // คำนวณตอนปล่อย
			$('#' + id + '_n').on('change', function () { apply(this.value) })
		}

		function inject() {
			const $summary = $('#summary')
			if (!$summary.length || !$(SEL_MAT).length) return false // ตารางหรือแถว markup ยังไม่มา
			if (!$('#markup_slider_panel').length) {
				$summary.after(panelHtml(curVal(SEL_MAT) || DEFAULT_MATERIAL, curVal(SEL_PROD)))
				bind('mk_mat', SEL_MAT)
				bind('mk_prod', SEL_PROD)
			}
			// default 15% Materials ครั้งแรก (เฉพาะถ้ายังเป็น 0 — ไม่ทับงานเก่าที่ตั้งไว้แล้ว)
			if (!defaultApplied) {
				defaultApplied = true
				if (!(curVal(SEL_MAT) > 0)) {
					setAll(SEL_MAT, DEFAULT_MATERIAL)
					$('#mk_mat').val(DEFAULT_MATERIAL); $('#mk_mat_n').val(DEFAULT_MATERIAL)
				}
			} else {
				// sync ตำแหน่ง slider ให้ตรงค่าปัจจุบัน (เผื่อผู้ใช้พิมพ์ในตารางเอง)
				$('#mk_mat').val(curVal(SEL_MAT)); $('#mk_mat_n').val(curVal(SEL_MAT))
				$('#mk_prod').val(curVal(SEL_PROD)); $('#mk_prod_n').val(curVal(SEL_PROD))
			}
			return true
		}

		function tryInject(n) { if (inject()) return; if (n > 0) setTimeout(() => tryInject(n - 1), 400) }
		$('body').on('click', PRICE_BTN, function () { setTimeout(() => tryInject(10), 500) })
		setTimeout(() => tryInject(6), 1500) // เผื่อเปิดหน้าที่คำนวณไว้แล้ว
	})
}
