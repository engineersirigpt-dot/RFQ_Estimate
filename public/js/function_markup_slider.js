// ============================================================================
// [injected] แถบเลื่อนปรับ Markup แบบ "ในตาราง" — ใต้ช่อง % ของแต่ละแถว
//   ไม่แตะ calc/ฟอร์มของเพื่อน — แค่ใส่ <input type=range> ไว้ "นอก" div .MarkingPercent*
//   (ไม่งั้นจะไปชน selector ".MarkingPercentMaterial input" ของ handler เดิม) แล้วเลื่อน →
//   set ช่อง % เดิม + trigger 'change' → handler เดิม (changeMarkingEvent) คำนวณราคาใหม่เอง
//   • เลื่อนช่องไหนของ Materials → set ทุกยอดให้เท่ากัน (markup ปกติเท่ากันทุกยอด) เช่นเดียวกับ Production
//   • scale -100 ถึง +100 (ติดลบ=ลดราคา) • default = 0 (ไม่ตั้งค่าเริ่มต้น) [Art]
//   Materials = กำไรบนค่ากระดาษ/วัสดุ • Production = กำไรบนค่างานผลิต (เพลท/พิมพ์/process/แพ็ค)
// ============================================================================
if (typeof document !== 'undefined' && typeof jQuery !== 'undefined') {
	jQuery(function ($) {
		const PRICE_BTN = '#calc_price, #calc_price_after_change, #calc_price_after_packing'
		const ROW_MAT = '.MarkingPercentMaterial'
		const ROW_PROD = '.MarkingPercentProduction'

		const pctInput = ($div) => $div.find('input').first() // ช่อง % เดิม (slider เราอยู่นอก div)
		const curVal = (rowSel) => parseFloat(pctInput($(rowSel).first()).val() || 0) || 0
		// [Art 19/06/26] scale slider = -100 ถึง +100 (ติดลบ = mark down/ลดราคา) • พิมพ์ในช่องเกินช่วงได้
		const clamp = (v) => Math.max(-100, Math.min(100, parseFloat(v) || 0))

		// โชว์เลข % ทุกยอด (ไม่ recalc) — สำหรับให้เลขขึ้นสดๆ ตอนลาก
		function setRowDisplay(rowSel, v) {
			$(rowSel).each(function () { pctInput($(this)).val(v) })
		}
		// สั่ง handler เดิม (changeMarkingEvent) คำนวณราคาใหม่ — trigger change ทุก cell
		function recalcRow(rowSel) {
			$(rowSel).each(function () { pctInput($(this)).trigger('change') })
		}
		// set + คำนวณ + sync slider (ตอนปล่อย/พิมพ์เสร็จ)
		function setAllRow(rowSel, val) {
			setRowDisplay(rowSel, clamp(val)); recalcRow(rowSel); syncSliders(rowSel)
		}
		// ลากแบบ realtime: เลขขึ้นสดทันที + recalc ราคาแบบ throttle (กัน lag จากการ trigger หลายยอด)
		const pending = {}
		function liveDrag(rowSel, val) {
			setRowDisplay(rowSel, clamp(val)) // เลข % ขึ้นตาม slider ทันที
			if (pending[rowSel]) return
			pending[rowSel] = setTimeout(function () { pending[rowSel] = null; recalcRow(rowSel) }, 60) // ราคาอัปเดตทุก ~60ms
		}
		// อัปเดตตำแหน่ง slider ทุกตัวให้ตรงค่า % ปัจจุบัน
		function syncSliders(rowSel) {
			$(rowSel).each(function () { $(this).next('.mk_slider').val(clamp(pctInput($(this)).val())) })
		}

		// ใส่ slider ใต้ช่อง % แต่ละช่อง (นอก div เดิม)
		function addSliders(rowSel) {
			$(rowSel).each(function () {
				const $div = $(this)
				if ($div.next('.mk_slider').length) return // ใส่แล้ว
				const v = clamp(pctInput($div).val())
				const $s = $('<input type="range" class="mk_slider" min="-100" max="100" step="1" title="เลื่อนปรับ markup -100 ถึง +100 (ติดลบ=ลดราคา) ทุกยอด">')
					.val(v).css({ display: 'block', width: '90%', margin: '3px auto 0', 'accent-color': '#2563eb', cursor: 'pointer' })
				$div.after($s)
				$s.on('input', function () { liveDrag(rowSel, this.value) })  // realtime ระหว่างลาก
				$s.on('change', function () { setAllRow(rowSel, this.value) }) // ครั้งสุดท้ายตอนปล่อย
			})
		}

		function inject() {
			const $summary = $('#summary')
			if (!$summary.length || !$(ROW_MAT).length) return false
			addSliders(ROW_MAT)
			addSliders(ROW_PROD)
			// [Art] ให้พิมพ์ติดลบ/เกินช่วงในช่อง % ได้ (mask เดิมรับเฉพาะเลขบวก) — re-apply อนุญาต "-"
			if ($.fn.inputmask) {
				try { $(ROW_MAT + ' input, ' + ROW_PROD + ' input').inputmask({ regex: '^-?[0-9]{0,3}(\\.\\d{1,2})?$', placeholder: '' }) } catch (e) {}
			}
			// [Art 19/06/26] default = 0 (ไม่ตั้งค่าเริ่มต้นให้ — ปล่อยตามฟอร์ม)
			syncSliders(ROW_MAT); syncSliders(ROW_PROD)
			return true
		}

		// พิมพ์ % ในช่องเอง → slider เลื่อนตามทันที (ผูกครั้งเดียว, delegated)
		$('body').on('input keyup', ROW_MAT + ' input, ' + ROW_PROD + ' input', function () {
			$(this).closest(ROW_MAT + ', ' + ROW_PROD).next('.mk_slider').val(clamp($(this).val()))
		})

		function tryInject(n) { if (inject()) return; if (n > 0) setTimeout(() => tryInject(n - 1), 400) }
		$('body').on('click', PRICE_BTN, function () { setTimeout(() => tryInject(10), 500) })
		setTimeout(() => tryInject(6), 1500)
	})
}
