// ============================================================================
// [injected] แถบเลื่อนปรับ Markup แบบ "ในตาราง" — ใต้ช่อง % ของแต่ละแถว
//   ไม่แตะ calc/ฟอร์มของเพื่อน — แค่ใส่ <input type=range> ไว้ "นอก" div .MarkingPercent*
//   (ไม่งั้นจะไปชน selector ".MarkingPercentMaterial input" ของ handler เดิม) แล้วเลื่อน →
//   set ช่อง % เดิม + trigger 'change' → handler เดิม (changeMarkingEvent) คำนวณราคาใหม่เอง
//   • เลื่อนช่องไหนของ Materials → set ทุกยอดให้เท่ากัน (markup ปกติเท่ากันทุกยอด) เช่นเดียวกับ Production
//   • ตั้ง default Materials = 15% ครั้งแรกที่ตารางขึ้น (เฉพาะถ้ายังเป็น 0 — ไม่ทับงานเก่า)
//   Materials = กำไรบนค่ากระดาษ/วัสดุ • Production = กำไรบนค่างานผลิต (เพลท/พิมพ์/process/แพ็ค)
// ============================================================================
if (typeof document !== 'undefined' && typeof jQuery !== 'undefined') {
	jQuery(function ($) {
		const PRICE_BTN = '#calc_price, #calc_price_after_change, #calc_price_after_packing'
		const DEFAULT_MATERIAL = 15
		const ROW_MAT = '.MarkingPercentMaterial'
		const ROW_PROD = '.MarkingPercentProduction'
		let defaultApplied = false

		const pctInput = ($div) => $div.find('input').first() // ช่อง % เดิม (slider เราอยู่นอก div)
		const curVal = (rowSel) => parseFloat(pctInput($(rowSel).first()).val() || 0) || 0
		const clamp = (v) => Math.max(0, Math.min(50, parseFloat(v) || 0))

		// set ทุกยอดในแถวให้เท่ากัน + ให้ handler เดิมคำนวณ
		function setAllRow(rowSel, val) {
			const v = clamp(val)
			$(rowSel).each(function () { pctInput($(this)).val(v).trigger('change') })
			syncSliders(rowSel)
		}
		// อัปเดตตำแหน่ง slider ทุกตัวให้ตรงค่า % ปัจจุบัน (เผื่อผู้ใช้พิมพ์ในช่องเอง/คำนวณใหม่)
		function syncSliders(rowSel) {
			$(rowSel).each(function () { $(this).next('.mk_slider').val(parseFloat(pctInput($(this)).val() || 0) || 0) })
		}

		// ใส่ slider ใต้ช่อง % แต่ละช่อง (นอก div เดิม)
		function addSliders(rowSel) {
			$(rowSel).each(function () {
				const $div = $(this)
				if ($div.next('.mk_slider').length) return // ใส่แล้ว
				const v = parseFloat(pctInput($div).val() || 0) || 0
				const $s = $('<input type="range" class="mk_slider" min="0" max="50" step="1" title="เลื่อนปรับ markup (ทุกยอด)">')
					.val(v).css({ display: 'block', width: '90%', margin: '3px auto 0', 'accent-color': '#2563eb', cursor: 'pointer' })
				$div.after($s)
				$s.on('change', function () { setAllRow(rowSel, this.value) }) // คำนวณตอนปล่อย (กัน lag)
			})
		}

		function inject() {
			const $summary = $('#summary')
			if (!$summary.length || !$(ROW_MAT).length) return false
			addSliders(ROW_MAT)
			addSliders(ROW_PROD)
			if (!defaultApplied) {
				defaultApplied = true
				if (!(curVal(ROW_MAT) > 0)) setAllRow(ROW_MAT, DEFAULT_MATERIAL) // default 15% ครั้งเดียว
			}
			syncSliders(ROW_MAT); syncSliders(ROW_PROD)
			return true
		}

		function tryInject(n) { if (inject()) return; if (n > 0) setTimeout(() => tryInject(n - 1), 400) }
		$('body').on('click', PRICE_BTN, function () { setTimeout(() => tryInject(10), 500) })
		setTimeout(() => tryInject(6), 1500)
	})
}
