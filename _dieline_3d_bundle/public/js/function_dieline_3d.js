/*
 * function_dieline_3d.js
 * ----------------------
 * เพิ่มปุ่ม "3D" ข้างปุ่ม "สร้างไดไล" บนหน้า estimate
 * พับกล่อง 3 มิติจากขนาด (W,L,D) + animation กาง→พับ
 *
 * แนวทาง (ตามที่ผู้ใช้เลือก): กล่องกระดาษสะอาด (สีครีม + เส้นขอบ/รอยพับ + แสงเงา)
 * และโชว์ dieline จริงเป็น "ภาพแบนแยก" มุมขวาบน (ไม่แปะลงผิว เพราะ layout ไม่ตรง)
 *
 * วิธีพับ: แต่ละ panel = PlaneGeometry, parent กันเป็นลำดับชั้นผ่าน Object3D pivot
 * ที่ขอบบานพับ → หมุน pivot = พับ panel ลูกตามไปด้วย (cascade)
 *
 * ใช้ three.js global (window.THREE) + orbit controller ขนาดเล็กที่เขียนเอง
 */
(function () {
	try { console.log('%c[dieline3d] build v9 — gable SVG peak (roof slope)', 'color:#16a34a;font-weight:bold') } catch (e) { }; if (!/\/estimate|\/view/.test(location.pathname)) return

	var BOX_NAMES = {
		1: 'Reverse Tuck End (RTE)', 2: 'Straight Tuck End (STE)',
		3: 'Tuck Top Snap Lock Bottom', 4: 'Tuck Top Auto Bottom',
		5: 'Tray / Double Glue Side Wall', 6: 'Frame-Vue Tray',
		7: 'Four Corner Bento Tray', 8: 'Gable Top', 9: 'Sleeve',
		10: 'Pillow Box', 11: 'Seal End', 12: 'Custom'
	}
	var APPROX_TYPES = {}
	var HALF = Math.PI / 2

	// ===== slider แบบ gradient + ลูกศรวงกลม (ธีมม่วง) =====
	var SLIDER_ARROW = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='9 6 15 12 9 18'/%3E%3C/svg%3E"
	function injectSliderStyle() {
		if (document.getElementById('d3-slider-style')) return
		var t = '#d3-slider{-webkit-appearance:none;appearance:none;height:14px;border-radius:10px;outline:none;cursor:pointer;background:#e5e7eb}'
			+ '#d3-slider::-webkit-slider-runnable-track{height:14px;border-radius:10px;background:transparent}'
			+ '#d3-slider::-webkit-slider-thumb{-webkit-appearance:none;width:26px;height:26px;margin-top:-6px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:grab;background:#7c3aed url("' + SLIDER_ARROW + '") center/13px no-repeat}'
			+ '#d3-slider:active::-webkit-slider-thumb{cursor:grabbing}'
			+ '#d3-slider::-moz-range-track{height:14px;border-radius:10px;background:#e5e7eb}'
			+ '#d3-slider::-moz-range-progress{height:14px;border-radius:10px;background:linear-gradient(90deg,#c4b5fd,#7c3aed)}'
			+ '#d3-slider::-moz-range-thumb{width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:grab;background:#7c3aed url("' + SLIDER_ARROW + '") center/13px no-repeat}'
		var s = document.createElement('style'); s.id = 'd3-slider-style'; s.textContent = t
		document.head.appendChild(s)
	}
	function setSliderFill(pct) {
		var el = document.getElementById('d3-slider')
		if (el) el.style.background = 'linear-gradient(90deg,#c4b5fd,#7c3aed) 0/' + pct + '% 100% no-repeat,#e5e7eb'
	}

	// แผงชื่อส่วนของกล่อง (ตามทรง)
	var PART_LABELS = {
		front: 'หน้า', back: 'หลัง', left: 'ข้าง', right: 'ข้าง',
		glue: 'กาว', floor: 'ก้น', topMain: 'ฝาบน', botMain: 'ฝาล่าง',
		roofF: 'หลังคา', roofB: 'หลังคา', endT: 'ปลาย', endB: 'ปลาย',
		rightDustT: 'ปีก', rightDustB: 'ปีก', leftDustT: 'ปีก', leftDustB: 'ปีก'
	}

	// ป้ายข้อความ — ตัวหนังสือดำ ไม่มีพื้นหลัง (มี halo ขาวให้อ่านง่าย)
	function makeTextSprite(text, color) {
		var c = document.createElement('canvas'), ctx = c.getContext('2d')
		c.width = 256; c.height = 64
		ctx.font = 'bold 34px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
		ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(text, 128, 34)
		ctx.fillStyle = color || '#111'; ctx.fillText(text, 128, 34)
		var tex = new THREE.CanvasTexture(c)
		return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }))
	}

	// ป้ายบอกขนาด — เส้น + ลูกศรชี้เข้า + ตัวเลข (ตัวดำ ไม่มีพื้น)
	function makeDimSprite(text) {
		var c = document.createElement('canvas'), ctx = c.getContext('2d'), m = 28
		c.width = 340; c.height = 56
		ctx.strokeStyle = '#111'; ctx.fillStyle = '#111'; ctx.lineWidth = 2.5
		ctx.beginPath(); ctx.moveTo(30, m); ctx.lineTo(130, m); ctx.stroke()                 // เส้นซ้าย
		ctx.beginPath(); ctx.moveTo(210, m); ctx.lineTo(310, m); ctx.stroke()                // เส้นขวา
		ctx.beginPath(); ctx.moveTo(30, m); ctx.lineTo(14, m - 8); ctx.lineTo(14, m + 8); ctx.closePath(); ctx.fill()      // ลูกศรซ้าย ชี้เข้า
		ctx.beginPath(); ctx.moveTo(310, m); ctx.lineTo(326, m - 8); ctx.lineTo(326, m + 8); ctx.closePath(); ctx.fill()   // ลูกศรขวา ชี้เข้า
		ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
		ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.strokeText(text, 170, m)
		ctx.fillStyle = '#111'; ctx.fillText(text, 170, m)
		var tex = new THREE.CanvasTexture(c)
		return new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, transparent: true }))
	}

	// ===== อ่านขนาดกล่อง — อ่านจากฟอร์ม (DOM) ก่อน แล้วค่อย mainData =====
	function readDims(index) {
		index = index || 0
		// 1) DOM (.specmm) = ค่าปัจจุบันในฟอร์ม (กันค่าเก่าใน mainData ที่ยังไม่ sync)
		var $i = $('.inputType[index="' + index + '"]')
		function num(sel, dflt) { var v = parseFloat($i.find(sel).val()); return isNaN(v) ? dflt : v }
		var dW = num('.specmm.width', null), dL = num('.specmm.length', null), dD = num('.specmm.depth', null)
		if (dW && dL && dD) {
			return {
				type: readType(index),
				W: dW, L: dL, D: dD,
				T: num('.specmm.tuck', 15), G: num('.specmm.glue', 10),
				dust: num('.specmm.dust', 8), OL: num('.specmm.ol', 5)
			}
		}
		// 2) fallback → mainData (เช่น DOM ยังไม่ render / custom)
		try {
			var est = window.est || window.estimate
			var comp = est && est.mainData && est.mainData.component1 && est.mainData.component1[index]
			var ps = (comp && comp.packaging_size) || {}
			var fs = ps.fold_size || []
			var W = +ps.width || +fs[3] || 0, L = +ps.length || +fs[4] || 0, D = +ps.depth || +fs[5] || 0
			if (W && L && D) {
				return {
					type: readType(index) || Number(comp.box_type && comp.box_type.type_id) || 1,
					W: W, L: L, D: D,
					T: +ps.tuck_flap || +fs[6] || 15, G: +ps.glue_flap || +fs[7] || 10,
					dust: +ps.dust_flap || +fs[8] || 8, OL: +ps.ol || +fs[9] || 5
				}
			}
		} catch (e) { console.warn('[dieline-3d] readDims', e) }
		// 3) สุดท้าย → คืน DOM (อาจ null ถ้ายังไม่กรอก)
		return {
			type: readType(index),
			W: dW, L: dL, D: dD,
			T: num('.specmm.tuck', 15), G: num('.specmm.glue', 10),
			dust: num('.specmm.dust', 8), OL: num('.specmm.ol', 5)
		}
	}
	function readType(index) {
		if ($('#d3-box').length) { var dv = parseInt($('#d3-box').val()); if (!isNaN(dv)) return dv }
		return parseInt($('.boxType[index="' + (index || 0) + '"]').val()) || 1
	}

	// ===========================================================================
	// FOLD SPEC — สร้าง panel + fold tree จากขนาดกล่อง
	//   wrap (1,2,11,3,4,7,8,10): 4 ผนัง + ฝาบน/ล่าง
	//   tray (5,6): 4 ผนัง + ก้นกล่อง
	//   sleeve (9): 4 ผนัง เปล่า
	//   custom (12): แผ่นแบนไม่พับ
	// ===========================================================================
	function buildSpec(d) {
		if (d.type === 12) {
			var w = d.W || 100, h = d.L || 100
			return { boxMax: Math.max(w, h, 1), root: { pw: w, ph: h, anchor: 'bl', children: [] }, noFold: true }
		}
		if (d.type === 3) return buildSnapLockBox(d)
		if (d.type === 4) return buildAutoBottomBox(d)
		if (d.type === 5) return buildSimpleTray(d)
		if (d.type === 6) return buildFrameVueTray(d)
		if (d.type === 7) return buildBento(d)
		if (d.type === 8) return buildGable(d)
		if (d.type === 9) return buildSleeve(d)
		if (d.type === 10) return buildPillow(d)
		if (d.type === 11) return buildSealEnd(d)
		return buildBox(d, { flaps: true, floor: false, straight: (d.type === 2) })
	}

	function buildWrapShell(d) {
		var W = d.W, L = d.L, D = d.D, G = d.G
		function wall(id, w) { return { id: id, pw: w, ph: D, anchor: 'bl', children: [] } }
		var L1 = wall('L1', L), W1 = wall('W1', W), L2 = wall('L2', L), W2 = wall('W2', W)
		W1.hinge = 'right'; W1.axis = 'y'; W1.sign = 1; W1.angle = HALF; W1.phase = [0, 0.5]
		L2.hinge = 'right'; L2.axis = 'y'; L2.sign = 1; L2.angle = HALF; L2.phase = [0, 0.5]
		W2.hinge = 'right'; W2.axis = 'y'; W2.sign = 1; W2.angle = HALF; W2.phase = [0, 0.5]
		L2.children.push(W2); W1.children.push(L2); L1.children.push(W1)
		L1.children.push({ id: 'glue', glue: true, pw: G, ph: D, anchor: 'br', hinge: 'left', axis: 'y', sign: -1, angle: HALF, phase: [0.5, 0.58], children: [] })
		return { root: L1, L1: L1, W1: W1, L2: L2, W2: W2 }
	}

	function makeTopDust(id, w, h, inner) {
		return { id: id, trap: true, trapInner: inner, pw: w, ph: h, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.58, 0.74] }
	}
	function makeBottomWing(id, w, h, outline) {
		return { id: id, outline: outline, pw: w, ph: h, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.72, 0.96] }
	}
	function makeMajorBottom(id, w, h, outline, creases) {
		return { id: id, outline: outline, pw: w, ph: h, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.72, 0.96], creases: creases || [] }
	}
	function snapMaleOutline(w, h) {
		return [[0, 0], [w, 0], [w, -h * 0.48], [w * 0.76, -h * 0.74], [w * 0.61, -h], [w * 0.39, -h], [w * 0.24, -h * 0.74], [0, -h * 0.48]]
	}
	function snapFemaleOutline(w, h) {
		return [[0, 0], [w, 0], [w, -h * 0.52], [w * 0.72, -h], [w * 0.58, -h], [w * 0.58, -h * 0.58], [w * 0.42, -h * 0.58], [w * 0.42, -h], [w * 0.28, -h], [0, -h * 0.52]]
	}
	function snapWingOutline(w, h, side) {
		if (side === 'left') return [[0, 0], [w, 0], [w, -h * 0.55], [w * 0.68, -h], [0, -h]]
		return [[0, 0], [w, 0], [w, -h], [w * 0.32, -h], [0, -h * 0.55]]
	}
	function autoMajorOutline(w, h, side) {
		if (side === 'left') return [[0, 0], [w, 0], [w, -h * 0.18], [w * 0.82, -h], [0, -h]]
		return [[0, 0], [w, 0], [w, -h], [w * 0.18, -h], [0, -h * 0.18]]
	}
	function autoWingOutline(w, h, side) {
		if (side === 'left') return [[0, 0], [w, 0], [w, -h * 0.46], [w * 0.7, -h], [0, -h]]
		return [[0, 0], [w, 0], [w, -h], [w * 0.3, -h], [0, -h * 0.46]]
	}
	function makeSealDust(id, w, h, anchor, hinge, sign) {
		return { id: id, pw: w, ph: h, anchor: anchor, hinge: hinge, axis: 'x', sign: sign, angle: HALF, phase: [0.58, 0.74] }
	}

	function buildSnapLockBox(d) {
		var shell = buildWrapShell(d)
		var W = d.W, L = d.L, T = d.T, lockH = Math.max((W * 0.5) + d.OL, 8)
		shell.W1.children.push(makeTopDust('W1DustT', W, d.dust, 'right'))
		shell.W2.children.push(makeTopDust('W2DustT', W, d.dust, 'left'))
		var topMain = { id: 'topMain', pw: L, ph: W, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.72, 0.9], children: [] }
		topMain.children.push({ id: 'topTuck', round: true, pw: L, ph: T, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.9, 1] })
		shell.L1.children.push(topMain)
		shell.L1.children.push(makeMajorBottom('snapMale', L, lockH, snapMaleOutline(L, lockH)))
		shell.W1.children.push(makeBottomWing('snapWingL', W, lockH, snapWingOutline(W, lockH, 'left')))
		shell.L2.children.push(makeMajorBottom('snapFemale', L, lockH, snapFemaleOutline(L, lockH)))
		shell.W2.children.push(makeBottomWing('snapWingR', W, lockH, snapWingOutline(W, lockH, 'right')))
		return { boxMax: Math.max(W, L, d.D, lockH, 1), root: shell.root }
	}

	function buildAutoBottomBox(d) {
		var shell = buildWrapShell(d)
		var W = d.W, L = d.L, T = d.T, lockH = Math.max((W * 0.5) + d.OL, 8)
		shell.W1.children.push(makeTopDust('W1DustT', W, d.dust, 'right'))
		shell.W2.children.push(makeTopDust('W2DustT', W, d.dust, 'left'))
		var topMain = { id: 'topMain', pw: L, ph: W, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.72, 0.9], children: [] }
		topMain.children.push({ id: 'topTuck', round: true, pw: L, ph: T, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.9, 1] })
		shell.L2.children.push(topMain)
		shell.L1.children.push(makeMajorBottom('autoMainL', L, lockH, autoMajorOutline(L, lockH, 'left'), [{ from: [L * 0.96, -lockH * 0.08], to: [L * 0.68, -lockH * 0.88] }]))
		shell.W1.children.push(makeBottomWing('autoWingL', W, lockH, autoWingOutline(W, lockH, 'left')))
		shell.L2.children.push(makeMajorBottom('autoMainR', L, lockH, autoMajorOutline(L, lockH, 'right'), [{ from: [L * 0.04, -lockH * 0.08], to: [L * 0.32, -lockH * 0.88] }]))
		shell.W2.children.push(makeBottomWing('autoWingR', W, lockH, autoWingOutline(W, lockH, 'right')))
		return { boxMax: Math.max(W, L, d.D, lockH, 1), root: shell.root }
	}

	function buildTrayShell(d) {
		var W = d.W, L = d.L, D = d.D
		// floor = ฐาน (root, อยู่กับที่) — ผนัง 4 ด้านพับขึ้นรอบ floor เป็นรูปกากบาท (ทุก panel เรียงตรงแกนกัน)
		var floor = { id: 'floor', pw: L, ph: W, anchor: 'bl', children: [] }
		var front = { id: 'front', pw: L, ph: D, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: -1, angle: HALF, phase: [0.3, 0.7], children: [] }   // ใต้ floor → พับขึ้น
		var back = { id: 'back', pw: L, ph: D, anchor: 'bl', hinge: 'top', axis: 'x', sign: 1, angle: HALF, phase: [0.3, 0.7], children: [] }          // เหนือ floor → พับขึ้น
		var right = { id: 'right', pw: D, ph: W, anchor: 'bl', hinge: 'right', axis: 'y', sign: -1, angle: HALF, phase: [0.3, 0.7], children: [] }      // ขวา floor → พับขึ้น
		var left = { id: 'left', pw: D, ph: W, anchor: 'br', hinge: 'left', axis: 'y', sign: 1, angle: HALF, phase: [0.3, 0.7], children: [] }          // ซ้าย floor → พับขึ้น
		floor.children.push(front, back, right, left)
		return { root: floor, floor: floor, front: front, back: back, right: right, left: left }
	}

	function buildSimpleTray(d) {
		var tray = buildTrayShell(d)
		return { boxMax: Math.max(d.W, d.L, d.D, 1), root: tray.root }
	}

	function buildFrameVueTray(d) {
		var tray = buildTrayShell(d)
		var lip = Math.max(6, Math.min(d.D * 0.6, d.dust || (d.D * 0.6)))
		// ลิ้นกรอบ (frame) ที่ขอบบนของผนังหน้า/หลัง → พับเข้าด้านในแนวนอน (ทิศเดียวกับผนัง)
		tray.front.children.push({ id: 'frontFrame', pw: d.L, ph: lip, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: -1, angle: HALF, phase: [0.74, 1] })
		tray.back.children.push({ id: 'backFrame', pw: d.L, ph: lip, anchor: 'bl', hinge: 'top', axis: 'x', sign: 1, angle: HALF, phase: [0.74, 1] })
		return { boxMax: Math.max(d.W, d.L, d.D, 1), root: tray.root }
	}

	function buildBento(d) {
		var tray = buildTrayShell(d)
		// ฝาปิด อยู่ขอบบนผนังหลัง → พับลงมาปิดถาด (เปิดค้างเล็กน้อยให้เห็นว่าเป็นฝา)
		tray.back.children.push({ id: 'lid', pw: d.L, ph: d.W, anchor: 'bl', hinge: 'top', axis: 'x', sign: 1, angle: HALF * 0.85, phase: [0.74, 1] })
		return { boxMax: Math.max(d.W, d.L, d.D, 1), root: tray.root }
	}

	function buildWalls(d, wallH) {
		var W = d.W, L = d.L, G = d.G, H = wallH || d.D
		function wall(id, w) { return { id: id, pw: w, ph: H, anchor: 'bl', children: [] } }
		var front = wall('front', W), right = wall('right', L), back = wall('back', W), left = wall('left', L)
		right.hinge = 'right'; right.axis = 'y'; right.sign = 1; right.angle = HALF; right.phase = [0, 0.5]
		back.hinge = 'right'; back.axis = 'y'; back.sign = 1; back.angle = HALF; back.phase = [0, 0.5]
		left.hinge = 'right'; left.axis = 'y'; left.sign = 1; left.angle = HALF; left.phase = [0, 0.5]
		var glue = { id: 'glue', pw: G, ph: H, anchor: 'bl', hinge: 'right', axis: 'y', sign: 1, angle: HALF, phase: [0.5, 0.58], children: [] }
		left.children.push(glue); back.children.push(left); right.children.push(back); front.children.push(right)
		return { front: front, right: right, back: back, left: left }
	}

	function buildGable(d) {
		var W = d.W, L = d.L, D = d.D
		var w = buildWalls(d)
		w.front.children.push({ id: 'floor', pw: W, ph: L, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.5, 0.66], children: [] })
		var peakH = Math.max(W * 0.45, D * 0.85)
		var roofH = Math.sqrt((W / 2) * (W / 2) + peakH * peakH)
		var slope = Math.atan2(W / 2, peakH)
		var slotW = Math.min(L * 0.34, W * 0.58)
		var slotH = Math.max(4, Math.min(roofH * 0.14, peakH * 0.22))
		var slotR = Math.max(2, slotH * 0.35)
		var slotY = Math.max(slotH, roofH * 0.62)
		w.right.children.push({ id: 'roofR', pw: L, ph: roofH, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: slope, phase: [0.7, 1], slot: { cx: L / 2, cy: slotY, w: slotW, h: slotH, r: slotR } })
		w.left.children.push({ id: 'roofL', pw: L, ph: roofH, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: slope, phase: [0.7, 1], slot: { cx: L / 2, cy: slotY, w: slotW, h: slotH, r: slotR } })
		w.front.children.push({ id: 'gableF', tri: true, pw: W, ph: peakH, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.7, 1] })
		w.back.children.push({ id: 'gableB', tri: true, pw: W, ph: peakH, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.7, 1] })
		return { boxMax: Math.max(W, L, D + peakH, 1), root: w.front }
	}

	function buildSleeve(d) {
		return buildBox(d, { flaps: false, floor: false })
	}

	function buildSealEnd(d) {
		var shell = buildWrapShell(d)
		var W = d.W, L = d.L
		shell.W1.children.push(makeSealDust('W1SealTop', W, d.dust, 'bl', 'top', -1))
		shell.W1.children.push(makeSealDust('W1SealBottom', W, d.dust, 'tl', 'bottom', 1))
		shell.W2.children.push(makeSealDust('W2SealTop', W, d.dust, 'bl', 'top', -1))
		shell.W2.children.push(makeSealDust('W2SealBottom', W, d.dust, 'tl', 'bottom', 1))
		shell.L2.children.push({ id: 'topSeal', pw: L, ph: W, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF * 0.92, phase: [0.72, 0.96] })
		shell.L1.children.push({ id: 'bottomSeal', pw: L, ph: W, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF * 0.92, phase: [0.72, 0.96] })
		return { boxMax: Math.max(W, L, d.D, 1), root: shell.root }
	}

	// ทรงหมอน (Pillow) — surface โค้งจริง (lens-tube จีบปลาย 2 ข้าง)
	function buildPillow(d) {
		var W = d.W, L = d.L, D = Math.max(d.D, 6)
		return { boxMax: Math.max(W, L, D, 1), customGeo: 'pillow', cw: W, cl: L, cd: D, noFold: true }
	}
	function makePillowGeometry(W, L, D) {
		var nu = 30, nv = 16, pos = [], idx = []
		function surf(sgn) {
			var base = pos.length / 3, i, j
			for (i = 0; i <= nu; i++) {
				var u = i / nu, tu = Math.pow(Math.sin(Math.PI * u), 0.45), z = (u - 0.5) * L   // อวบ พับเฉพาะปลาย
				for (j = 0; j <= nv; j++) {
					var v = j / nv
					pos.push((v - 0.5) * W, sgn * (D / 2) * tu * Math.pow(Math.sin(Math.PI * v), 0.6), z)   // ผิวบน/ล่างอวบ
				}
			}
			for (i = 0; i < nu; i++) for (j = 0; j < nv; j++) {
				var a = base + i * (nv + 1) + j, b = a + 1, c = a + (nv + 1), e = c + 1
				if (sgn > 0) idx.push(a, c, b, b, c, e); else idx.push(a, b, c, b, e, c)
			}
		}
		surf(1); surf(-1)   // ผิวบน + ผิวล่าง
		var g = new THREE.BufferGeometry()
		g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
		g.setIndex(idx); g.computeVertexNormals()
		return g
	}

	function buildBox(d, mode) {
		var W = d.W, L = d.L, D = d.D, T = d.T, G = d.G, dust = d.dust
		// เรียงตาม dieline จริง (รูป 1.jpg ซ้าย→ขวา): ติดกาว | ยาว | กว้าง | ยาว | กว้าง
		function wall(id, w) { return { id: id, pw: w, ph: D, anchor: 'bl', children: [] } }
		var L1 = wall('L1', L), W1 = wall('W1', W), L2 = wall('L2', L), W2 = wall('W2', W)

		// chain พันเป็นท่อ (พับรอบแกน Y ที่ขอบขวา) — เสร็จที่ 50%
		W1.hinge = 'right'; W1.axis = 'y'; W1.sign = 1; W1.angle = HALF; W1.phase = [0, 0.5]
		L2.hinge = 'right'; L2.axis = 'y'; L2.sign = 1; L2.angle = HALF; L2.phase = [0, 0.5]
		W2.hinge = 'right'; W2.axis = 'y'; W2.sign = 1; W2.angle = HALF; W2.phase = [0, 0.5]
		L2.children.push(W2)
		W1.children.push(L2)
		L1.children.push(W1)
		// ติดกาว ซ้ายสุด — ติดขอบ "ซ้าย" ของ ยาว(L1), ยื่นไป -x (anchor br, hinge left)
		var glue = { id: 'glue', glue: true, pw: G, ph: D, anchor: 'br', hinge: 'left', axis: 'y', sign: -1, angle: HALF, phase: [0.5, 0.58], children: [] }
		L1.children.push(glue)

		if (mode.flaps) {
			// ปีกกล่อง (คางหมู) บนผนัง กว้าง W1,W2 — ฝั่งติดฝาเสียบ "ตั้งตรง(ติดกัน)" ฝั่งนอก "เฉียง"
			// ฝาบนอยู่ L2 เสมอ → W1 ติดขวา / W2 ติดซ้าย ; ฝาล่าง: RTE=L1(สลับ) / STE=L2
			var botInW1 = mode.straight ? 'right' : 'left'
			var botInW2 = mode.straight ? 'left' : 'right'
			W1.children.push({ id: 'W1DustT', trap: true, trapInner: 'right', pw: W, ph: dust, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.6, 0.72] })
			W1.children.push({ id: 'W1DustB', trap: true, trapBevel: true, trapInner: botInW1, pw: W, ph: dust, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.6, 0.72] })
			W2.children.push({ id: 'W2DustT', trap: true, trapInner: 'left', pw: W, ph: dust, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.6, 0.72] })
			W2.children.push({ id: 'W2DustB', trap: true, trapBevel: true, trapInner: botInW2, pw: W, ph: dust, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.6, 0.72] })
			// ฝาเสียบบน อยู่บนผนัง ยาว(L2) เสมอ — main เรียบ + ลิ้นโค้ง (แบบเดิม ตามรูป 1)
			var topMain = { id: 'topMain', pw: L, ph: W, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.74, 0.9], children: [] }
			topMain.children.push({ id: 'topTuck', round: true, pw: L, ph: T, anchor: 'bl', hinge: 'top', axis: 'x', sign: -1, angle: HALF, phase: [0.9, 1] })
			L2.children.push(topMain)
			// ฝาเสียบล่าง: RTE=ผนัง ยาว(L1) อีกด้าน(สลับ) / STE=ผนังเดียวกับบน(L2)
			// main พับปิดก้นก่อน → ลิ้นพับต่ออีกที "เสียบเข้าในกล่อง" (mirror ฝาบนเป๊ะ)
			var botWall = mode.straight ? L2 : L1
			var botMain = { id: 'botMain', pw: L, ph: W, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.74, 0.9], children: [] }
			botMain.children.push({ id: 'botTuck', round: true, lock: true, pw: L, ph: T, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.9, 1] })
			botWall.children.push(botMain)
		}

		if (mode.floor) {
			// ถาด: ก้นกล่องเต็มแผ่นบนผนัง กว้าง(W1) พับขึ้นเป็นพื้น
			W1.children.push({ id: 'floor', pw: W, ph: L, anchor: 'tl', hinge: 'bottom', axis: 'x', sign: 1, angle: HALF, phase: [0.55, 1], children: [] })
		}
		return { boxMax: Math.max(W, L, D, 1), root: L1 }
	}

	// ===========================================================================
	// THREE.JS — สร้างกล่องจาก spec (กระดาษสะอาด + เส้นขอบ)
	// ===========================================================================
	function rectOutline(node) {
		if (node.anchor === 'tl') return [[0, 0], [node.pw, 0], [node.pw, -node.ph], [0, -node.ph]]
		if (node.anchor === 'br') return [[0, 0], [-node.pw, 0], [-node.pw, node.ph], [0, node.ph]]
		return [[0, 0], [node.pw, 0], [node.pw, node.ph], [0, node.ph]]
	}
	function shapeFromPoints(points) {
		var sh = new THREE.Shape()
		if (!points || !points.length) return sh
		sh.moveTo(points[0][0], points[0][1])
		for (var i = 1; i < points.length; i++) sh.lineTo(points[i][0], points[i][1])
		sh.lineTo(points[0][0], points[0][1])
		return sh
	}
	function addRoundedSlot(shape, slot) {
		if (!slot) return
		var cx = slot.cx, cy = slot.cy, w = slot.w, h = slot.h, r = Math.min(slot.r || 0, w / 2, h / 2)
		var x = cx - (w / 2), y = cy - (h / 2)
		var hole = new THREE.Path()
		if (r > 0) {
			hole.moveTo(x + r, y)
			hole.lineTo(x + w - r, y)
			hole.quadraticCurveTo(x + w, y, x + w, y + r)
			hole.lineTo(x + w, y + h - r)
			hole.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
			hole.lineTo(x + r, y + h)
			hole.quadraticCurveTo(x, y + h, x, y + h - r)
			hole.lineTo(x, y + r)
			hole.quadraticCurveTo(x, y, x + r, y)
		} else {
			hole.moveTo(x, y); hole.lineTo(x + w, y); hole.lineTo(x + w, y + h); hole.lineTo(x, y + h); hole.lineTo(x, y)
		}
		shape.holes.push(hole)
	}
	function makeMesh(node, material, edgeMat) {
		var geo, shp = null                          // shp = THREE.Shape (ถ้ามี) ใช้ดึง outline วาดเส้นตัด
		if (node.outline || node.slot) {
			shp = shapeFromPoints(node.outline || rectOutline(node))
			addRoundedSlot(shp, node.slot)
			geo = new THREE.ShapeGeometry(shp)
		} else if (node.tri) {                       // แผ่นสามเหลี่ยม (ฐาน pw, ยอดกลางสูง ph) — สำหรับจั่ว
			var sh = new THREE.Shape()
			sh.moveTo(0, 0); sh.lineTo(node.pw, 0); sh.lineTo(node.pw / 2, node.ph); sh.lineTo(0, 0)
			geo = new THREE.ShapeGeometry(sh); shp = sh
		} else if (node.round) {                     // ฝาเสียบโค้งมน — arc ลึก (โค้งมากขึ้น)
			var s = (node.anchor === 'tl') ? -1 : 1
			var H = node.ph * s
			var sh2 = new THREE.Shape()
			if (node.lock) {                                       // ฝาล่าง: ด้านข้างดิ่งลงตรงๆ แล้วโค้งก้น
				sh2.moveTo(0, 0); sh2.lineTo(node.pw, 0)           // รอยพับเต็มกว้าง
				sh2.lineTo(node.pw, H * 0.5)                       // ขวาลงตรงๆ (ดิ่ง)
				sh2.quadraticCurveTo(node.pw, H, node.pw / 2, H)   // โค้งก้น
				sh2.quadraticCurveTo(0, H, 0, H * 0.5)
				sh2.lineTo(0, 0)                                   // ซ้ายลงตรงๆ
			} else {                                               // ฝาบน: โค้งเรียบเต็มกว้าง (เดิม)
				sh2.moveTo(0, 0); sh2.lineTo(node.pw, 0)
				sh2.lineTo(node.pw, H * 0.28)
				sh2.quadraticCurveTo(node.pw, H, node.pw / 2, H)
				sh2.quadraticCurveTo(0, H, 0, H * 0.28)
				sh2.lineTo(0, 0)
			}
			geo = new THREE.ShapeGeometry(sh2); shp = sh2
		} else if (node.trap) {                      // ปีกกล่อง — trapInner=ฝั่งตั้งตรง(ติดฝา); trapBevel=ปีกล่าง(ตั้งตรง+เฉียงสั้นปลาย)
			var st = (node.anchor === 'tl') ? -1 : 1
			var Ht = node.ph * st, ins = node.pw * 0.28
			var sh3 = new THREE.Shape()
			if (node.trapBevel) {                    // ปีกล่าง: ตั้งตรงไปติดกล่อง + เฉียงสั้นๆตรงปลาย (40%)
				var bf = 0.6
				if (node.trapInner === 'right') {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw, Ht); sh3.lineTo(ins, Ht); sh3.lineTo(0, Ht * bf); sh3.lineTo(0, 0)
				} else if (node.trapInner === 'left') {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw, Ht * bf); sh3.lineTo(node.pw - ins, Ht); sh3.lineTo(0, Ht); sh3.lineTo(0, 0)
				} else {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw, Ht * bf); sh3.lineTo(node.pw - ins, Ht); sh3.lineTo(ins, Ht); sh3.lineTo(0, Ht * bf); sh3.lineTo(0, 0)
				}
			} else {                                  // ปีกบน: คางหมูเต็ม (เฉียงยาว)
				if (node.trapInner === 'right') {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw, Ht); sh3.lineTo(ins, Ht); sh3.lineTo(0, 0)
				} else if (node.trapInner === 'left') {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw - ins, Ht); sh3.lineTo(0, Ht); sh3.lineTo(0, 0)
				} else {
					sh3.moveTo(0, 0); sh3.lineTo(node.pw, 0); sh3.lineTo(node.pw - ins, Ht); sh3.lineTo(ins, Ht); sh3.lineTo(0, 0)
				}
			}
			geo = new THREE.ShapeGeometry(sh3); shp = sh3
		} else if (node.glue) {                      // แถบติดกาว (anchor br: x=-pw..0) — ปลายด้านนอก 2 มุมเฉียง
			var bv = Math.min(node.pw, node.ph * 0.5) * 0.6
			var shg = new THREE.Shape()
			shg.moveTo(0, 0); shg.lineTo(0, node.ph)            // ขอบบานพับ (ขวา x=0)
			shg.lineTo(-node.pw + bv, node.ph)                 // ขอบบนไปจุดเริ่มเฉียง
			shg.lineTo(-node.pw, node.ph - bv)                 // เฉียงมุมนอก-บน
			shg.lineTo(-node.pw, bv)                           // ขอบนอก (ซ้าย)
			shg.lineTo(-node.pw + bv, 0)                       // เฉียงมุมนอก-ล่าง
			shg.lineTo(0, 0)
			geo = new THREE.ShapeGeometry(shg); shp = shg
		} else {
			geo = new THREE.PlaneGeometry(node.pw, node.ph)
			if (node.anchor === 'tl') geo.translate(node.pw / 2, -node.ph / 2, 0)
			else if (node.anchor === 'br') geo.translate(-node.pw / 2, node.ph / 2, 0)   // ยื่นไป -x (ติดกาวซ้าย)
			else geo.translate(node.pw / 2, node.ph / 2, 0)
		}
		var mesh = new THREE.Mesh(geo, material)
		// outline ของแผ่น (เรียงตามขอบ) — จาก Shape หรือสี่เหลี่ยมตาม anchor
		var outline
		if (shp) {
			outline = shp.getPoints(24).map(function (p) { return [p.x, p.y] })
		} else if (node.anchor === 'tl') {
			outline = [[0, 0], [node.pw, 0], [node.pw, -node.ph], [0, -node.ph]]
		} else if (node.anchor === 'br') {
			outline = [[0, 0], [-node.pw, 0], [-node.pw, node.ph], [0, node.ph]]
		} else {
			outline = [[0, 0], [node.pw, 0], [node.pw, node.ph], [0, node.ph]]
		}
		// วาดเส้นทึบเฉพาะ "ขอบเส้นตัด" — ข้ามขอบที่เป็นรอยพับ (ฐาน hinge ตัวเอง + ขอบที่ลูกมาต่อ)
		mesh.add(buildCutEdges(node, outline, edgeMat))
		return mesh
	}

	// คืน LineSegments ของขอบเส้นตัด (ไม่รวมขอบรอยพับ) เพื่อไม่ให้เส้นทึบซ้อนเส้นประ
	function buildCutEdges(node, outline, edgeMat) {
		var folds = []                               // เส้นพับ: {a:'x'|'y', v:number}
		var h = node.hinge
		if (h === 'top' || h === 'bottom') folds.push({ a: 'y', v: 0 })
		else if (h === 'left' || h === 'right') folds.push({ a: 'x', v: 0 })
			; (node.children || []).forEach(function (c) {
				if (c.hinge === 'right') folds.push({ a: 'x', v: node.pw })
				else if (c.hinge === 'left') folds.push({ a: 'x', v: 0 })
				else if (c.hinge === 'top') folds.push({ a: 'y', v: node.ph })
				else if (c.hinge === 'bottom') folds.push({ a: 'y', v: (node.anchor === 'tl' ? -node.ph : 0) })
			})
		var eps = 0.012 * Math.max(node.pw, node.ph, 1)
		var onFold = function (p, q) {
			for (var i = 0; i < folds.length; i++) {
				var f = folds[i]
				if (f.a === 'x' && Math.abs(p[0] - f.v) < eps && Math.abs(q[0] - f.v) < eps) return true
				if (f.a === 'y' && Math.abs(p[1] - f.v) < eps && Math.abs(q[1] - f.v) < eps) return true
			}
			return false
		}
		var verts = []
		for (var i = 0; i < outline.length; i++) {
			var p = outline[i], q = outline[(i + 1) % outline.length]
			if (onFold(p, q)) continue
			verts.push(new THREE.Vector3(p[0], p[1], 0.3), new THREE.Vector3(q[0], q[1], 0.3))
		}
		return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(verts), edgeMat)
	}

	// เส้นพับ: วาดทั้ง "เส้นประ" (โชว์ตอนกาง) + "เส้นทึบ" คู่กัน (โชว์ตอนพับ 100%)
	// viewer สลับโชว์ตาม _t (กาง=ประ, พับ=ทึบ) — depthTest=true ทั้งคู่ → เส้นที่โดนบังหายเอง
	function addCrease(parent, pts, dashMat, edgeMat) {
		var dash = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashMat)
		dash.computeLineDistances(); dash.renderOrder = 5; dash.userData.creaseDash = true
		parent.add(dash)
		var solid = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat)
		solid.renderOrder = 5; solid.visible = false; solid.userData.creaseSolid = true
		parent.add(solid)
		return dash
	}

	function addInternalCreases(holder, node, dashMat, edgeMat) {
		if (!dashMat || !node.creases || !node.creases.length) return
		for (var i = 0; i < node.creases.length; i++) {
			var cr = node.creases[i]
			addCrease(holder, [
				new THREE.Vector3(cr.from[0], cr.from[1], 0.92),
				new THREE.Vector3(cr.to[0], cr.to[1], 0.92)
			], dashMat, edgeMat)
		}
	}

	function buildNode(node, material, edgeMat, folds, dashMat) {
		var pivot = new THREE.Group()
		pivot.add(makeMesh(node, material, edgeMat))
		// รอยบากล็อก (ฝาเสียบล่าง): ข้างละเส้น "โค้งสั้นๆ" ชี้ขึ้นบน (โค้งเข้าหากลาง) — ทั้งซ้ายและขวา
		if (node.lock && dashMat) {
			var s = (node.anchor === 'tl') ? -1 : 1       // ทิศเข้าเนื้อฝา (ฝาล่าง = -y)
			var lnw = node.pw * 0.1                       // ระยะเข้าจากขอบ
			var yb = node.ph * 0.42 * s                   // ปลายบาก "ชี้ลง" เข้าเนื้อฝา
			var bow = node.pw * 0.06                      // เฉียงเข้าหากลาง
			var lz = 0.9
			var lockMark = function (x, dir) {
				// เส้นตรงเฉียงจากรอยพับ → ปลายที่ชี้ลง (ลากไปจบที่ปลาย)
				var p0 = [x, 0], p2 = [x + dir * bow, yb]
				var l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(p0[0], p0[1], lz), new THREE.Vector3(p2[0], p2[1], lz)]), edgeMat)
				l.renderOrder = 5; pivot.add(l)
				return p2                 // คืนตำแหน่งปลายที่ชี้ลง
			}
			var tipL = lockMark(lnw, 1)
			var tipR = lockMark(node.pw - lnw, -1)
			// เส้นประ (รอยพับ) เชื่อม "ปลายที่ชี้ลง" ของบากสองข้าง (ติดปลายพอดี)
			addCrease(pivot, [
				new THREE.Vector3(tipL[0], tipL[1], lz), new THREE.Vector3(tipR[0], tipR[1], lz)], dashMat, edgeMat)
		}
		addInternalCreases(pivot, node, dashMat, edgeMat)
		if (node.axis) {
			folds.push({ pivot: pivot, axis: node.axis, sign: node.sign || 1, angle: node.angle || HALF, phase: node.phase || [0, 1] })
		}
		var kids = node.children || []
		for (var i = 0; i < kids.length; i++) {
			var child = kids[i]
			var c = buildNode(child, material, edgeMat, folds, dashMat)
			var hx = 0, hy = 0
			if (child.hinge === 'right') hx = node.pw
			else if (child.hinge === 'top') hy = node.ph
			else if (child.hinge === 'bottom' && node.anchor === 'tl') hy = -node.ph   // พ่อยื่นลง (tl) → ขอบล่างอยู่ที่ -ph
			if (child.attachX != null) hx = child.attachX
			if (child.attachY != null) hy = child.attachY
			c.position.set(hx, hy, 0)
			pivot.add(c)
			// เส้นพับ (เส้นประ) ที่ขอบบานพับ — แยกจากเส้นตัด (ทึบ)
			if (dashMat) {
				var p1 = null, p2 = null, yb = (node.anchor === 'tl') ? -node.ph : 0, dz = 0.9
				if (child.hinge === 'right') { p1 = [node.pw, 0, dz]; p2 = [node.pw, node.ph, dz] }
				else if (child.hinge === 'left') { p1 = [0, 0, dz]; p2 = [0, node.ph, dz] }
				else if (child.hinge === 'top') { p1 = [0, node.ph, dz]; p2 = [node.pw, node.ph, dz] }
				else if (child.hinge === 'bottom') { p1 = [0, yb, dz]; p2 = [node.pw, yb, dz] }
				if (p1 && child.lock && child.hinge === 'bottom') {
					// ฝาเสียบล่าง: เส้นประวาดใน lock block (เชื่อมปลายบนของเส้นบาก) — ไม่วาดที่รอยต่อ
				} else if (p1) {
					addCrease(pivot, [
						new THREE.Vector3(p1[0], p1[1], p1[2]), new THREE.Vector3(p2[0], p2[1], p2[2])], dashMat, edgeMat)
				}
			}
		}
		return pivot
	}

	function applyFold(folds, t) {
		for (var i = 0; i < folds.length; i++) {
			var f = folds[i]
			var local = (t - f.phase[0]) / (f.phase[1] - f.phase[0])
			local = Math.max(0, Math.min(1, local))
			var eased = local * local * (3 - 2 * local)
			f.pivot.rotation[f.axis] = eased * f.angle * f.sign
		}
	}

	function buildBoxGroup(spec, finish) {
		finish = finish || {}
		var material = new THREE.MeshStandardMaterial({
			color: (finish.paperColor != null ? finish.paperColor : 0xf4ecd8),
			side: THREE.DoubleSide,
			roughness: (finish.roughness != null ? finish.roughness : 0.92),
			metalness: (finish.metalness != null ? finish.metalness : 0)
		})
		var edgeMat = new THREE.LineBasicMaterial({ color: 0x8a7a55 })
		// ทรงพิเศษที่เป็น surface โค้ง (pillow) — ไม่ใช้ fold tree
		if (spec.customGeo === 'pillow') {
			var pgeo = makePillowGeometry(spec.cw, spec.cl, spec.cd)
			var pholder = new THREE.Group(); pholder.add(new THREE.Mesh(pgeo, material))
			var ps = 1 / (spec.boxMax || 100); pholder.scale.set(ps, ps, ps)
			return { group: pholder, folds: [], material: material, edgeMat: edgeMat }
		}
		var dashMat = new THREE.LineDashedMaterial({ color: 0x2b2b2b, dashSize: 9, gapSize: 5 })   // เส้นพับ (เส้นประ) ขีดยาว เห็นชัด
		var folds = []
		var rootPivot = buildNode(spec.root, material, edgeMat, folds, dashMat)
		var s = 1 / (spec.boxMax || 100)
		var holder = new THREE.Group()
		holder.add(rootPivot)
		holder.scale.set(s, s, s)
		holder.userData.lineMats = { cut: edgeMat, fold: dashMat }   // toggle เส้นพับสีจริง
		return { group: holder, folds: folds, material: material, edgeMat: edgeMat }
	}

	// ===========================================================================
	// SVG dieline (diecuttemplates) → 3D — ทรงที่เซฟ SVG ไว้ (1=RTE, 2=STE)
	// parse SVG → panels (face-finding) → พับ (general edge-fold) → folds รูปแบบเดียวกับ buildBoxGroup
	// ===========================================================================
	// ทรงที่พับ 3D จาก SVG (1-7, 9) — ทรง 10 Pillow ใช้ procedural (ผิวโค้ง) เพราะ flat-fold ทำเส้นโค้งไม่ได้
	var LOCAL_SVG_TYPES = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 11: 1 }
	function hasLocalSVG(t) { return !!LOCAL_SVG_TYPES[t] }

	var SVGImp = (function () {
		function parsePath(d) {
			var t = d.match(/[MLAZmlaz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || []
			var i = 0, cur = null, out = [], cmd = null
			function num() { return parseFloat(t[i++]) }
			while (i < t.length) {
				if (/[A-Za-z]/.test(t[i])) { cmd = t[i].toUpperCase(); i++ }
				if (cmd === 'M') { cur = [num(), num()] }
				else if (cmd === 'L') { var p = [num(), num()]; out.push({ type: 'line', a: cur, b: p }); cur = p }
				else if (cmd === 'A') {
					var rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), p2 = [num(), num()]
					arcPts(cur, rx, ry, rot, large, sweep, p2).forEach(function (seg) { out.push(seg) }); cur = p2
				} else { i++ }
			}
			return out
		}
		function arcPts(p0, rx, ry, phi, large, sweep, p1, n) {
			n = n || 10; phi = phi * Math.PI / 180
			var cosP = Math.cos(phi), sinP = Math.sin(phi)
			var dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2
			var x1 = cosP * dx + sinP * dy, y1 = -sinP * dx + cosP * dy
			rx = Math.abs(rx); ry = Math.abs(ry)
			var lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry)
			if (lam > 1) { var sg = Math.sqrt(lam); rx *= sg; ry *= sg }
			var sign = (large !== sweep) ? 1 : -1
			var nu = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
			var de = rx * rx * y1 * y1 + ry * ry * x1 * x1
			var co = sign * Math.sqrt(Math.max(0, nu / de))
			var cxp = co * rx * y1 / ry, cyp = -co * ry * x1 / rx
			var cx = cosP * cxp - sinP * cyp + (p0[0] + p1[0]) / 2
			var cy = sinP * cxp + cosP * cyp + (p0[1] + p1[1]) / 2
			function ang(ux, uy, vx, vy) { var d = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy)); var a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d))); return (ux * vy - uy * vx < 0) ? -a : a }
			var th0 = ang(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry)
			var dth = ang((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry)
			if (!sweep && dth > 0) dth -= 2 * Math.PI
			if (sweep && dth < 0) dth += 2 * Math.PI
			var pts = [], prev = p0
			for (var k = 1; k <= n; k++) {
				var th = th0 + dth * k / n
				var x = cosP * rx * Math.cos(th) - sinP * ry * Math.sin(th) + cx
				var y = sinP * rx * Math.cos(th) + cosP * ry * Math.sin(th) + cy
				pts.push({ type: 'line', a: prev, b: [x, y] }); prev = [x, y]
			}
			return pts
		}
		function extractGroup(svg, id) {
			var re = new RegExp('<g[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</g>')
			var m = re.exec(svg); if (!m) return []
			var body = m[1], segs = [], pm, pre = /\sd="([^"]+)"/g
			while ((pm = pre.exec(body))) parsePath(pm[1]).forEach(function (s) { segs.push(s) })
			return segs
		}
		function snapVerts(segs, tol) {
			tol = tol || 2.0; var reps = []
			function rep(p) { for (var i = 0; i < reps.length; i++) { if (Math.abs(reps[i][0] - p[0]) <= tol && Math.abs(reps[i][1] - p[1]) <= tol) return reps[i] } var r = [p[0], p[1]]; reps.push(r); return r }
			segs.forEach(function (s) { s.a = rep(s.a); s.b = rep(s.b) })
			return segs.filter(function (s) { return Math.abs(s.a[0] - s.b[0]) > tol * 0.5 || Math.abs(s.a[1] - s.b[1]) > tol * 0.5 })
		}
		function vkey(p) { return Math.round(p[0]) + ',' + Math.round(p[1]) }
		function nodeSegments(segs) {   // ตัดเส้นที่ T-junction → face ปิดได้ (จำเป็นสำหรับ STE)
			var vmap = {}, verts = []
			segs.forEach(function (s) {[s.a, s.b].forEach(function (p) { var k = vkey(p); if (!vmap[k]) { vmap[k] = 1; verts.push(p) } }) })
			var out = []
			segs.forEach(function (s) {
				var dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L2 = dx * dx + dy * dy
				if (L2 < 1) { out.push(s); return }
				var cuts = []
				verts.forEach(function (v) {
					var t = ((v[0] - s.a[0]) * dx + (v[1] - s.a[1]) * dy) / L2
					if (t <= 0.001 || t >= 0.999) return
					if (Math.hypot(v[0] - (s.a[0] + t * dx), v[1] - (s.a[1] + t * dy)) < 1.5) cuts.push({ t: t, p: v })
				})
				if (!cuts.length) { out.push(s); return }
				cuts.sort(function (a, b) { return a.t - b.t })
				var prev = s.a
				cuts.forEach(function (c) { out.push({ type: 'line', a: prev, b: c.p }); prev = c.p })
				out.push({ type: 'line', a: prev, b: s.b })
			})
			return out
		}
		function findFaces(segs) {
			var vmap = {}, verts = []
			function vid(p) { var k = vkey(p); if (vmap[k] == null) { vmap[k] = verts.length; verts.push([p[0], p[1]]) } return vmap[k] }
			var emap = {}, edges = []
			segs.forEach(function (s) { var u = vid(s.a), v = vid(s.b); if (u === v) return; var k = u < v ? u + '_' + v : v + '_' + u; if (emap[k] == null) { emap[k] = edges.length; edges.push({ u: u, v: v }) } })
			var darts = [], outAt = verts.map(function () { return [] })
			edges.forEach(function (e) {
				var d1 = { from: e.u, to: e.v }, d2 = { from: e.v, to: e.u }
				d1.ang = Math.atan2(verts[e.v][1] - verts[e.u][1], verts[e.v][0] - verts[e.u][0])
				d2.ang = Math.atan2(verts[e.u][1] - verts[e.v][1], verts[e.u][0] - verts[e.v][0])
				darts.push(d1, d2); outAt[e.u].push(d1); outAt[e.v].push(d2)
			})
			outAt.forEach(function (lst) { lst.sort(function (a, b) { return a.ang - b.ang }) })
			function nextDart(d) {
				var v = d.to, lst = outAt[v], idx = -1
				for (var i = 0; i < lst.length; i++) { if (lst[i].to === d.from) { idx = i; break } }
				return lst[(idx - 1 + lst.length) % lst.length]
			}
			var used = {}, faces = []
			darts.forEach(function (d, di) { d._i = di })
			darts.forEach(function (d) {
				if (used[d._i]) return
				var face = [], cur = d, guard = 0
				do { used[cur._i] = 1; face.push(cur.from); cur = nextDart(cur); if (++guard > 2000) break } while (cur._i !== d._i)
				if (face.length >= 3) faces.push(face)
			})
			function area(f) { var s = 0; for (var i = 0; i < f.length; i++) { var a = verts[f[i]], b = verts[f[(i + 1) % f.length]]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
			var wa = faces.map(function (f) { return { f: f, a: area(f) } })
			wa.sort(function (x, y) { return Math.abs(y.a) - Math.abs(x.a) })
			var outer = wa[0]
			return { verts: verts, faces: wa.filter(function (w) { return w !== outer && Math.abs(w.a) > 1 }).map(function (w) { return w.f }) }
		}
		function ekey(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }
		function fromSVG(svgText, opt) {
			opt = opt || {}
			var cr = extractGroup(svgText, 'crease'), ct = extractGroup(svgText, 'cut')
			var all = cr.concat(ct)
			all.forEach(function (s) { s.a = [s.a[0], -s.a[1]]; s.b = [s.b[0], -s.b[1]] })   // flip y
			all = snapVerts(all, opt.tol || 2.0)
			all = nodeSegments(all)            // ตัด T-junction ก่อนหา face
			var res = findFaces(all)
			var panels = res.faces.map(function (f, i) {
				var segs = []
				for (var k = 0; k < f.length; k++) { var a = res.verts[f[k]], b = res.verts[f[(k + 1) % f.length]]; segs.push({ type: 'line', a: [a[0], a[1]], b: [b[0], b[1]] }) }
				return { id: 'p' + i, segs: segs }
			})
			return { panels: panels, rootId: pickRoot(panels) }
		}
		// root = "ผนัง" (สูงเท่ากล่อง) ที่มีผนังเพื่อนบ้านมากสุด + ฝาเพื่อนบ้านเตี้ย (ไม่ใช่ tuck)
		// → กล่องตั้ง ฝา tuck พับปิดได้ (ถ้า root มี tuck ฝาจะตั้งชี้ขึ้นไม่ปิด)
		function pickRoot(panels) {
			var info = panels.map(function (p) {
				var xs = p.segs.map(function (s) { return s.a[0] }), ys = p.segs.map(function (s) { return s.a[1] })
				var ar = 0; p.segs.forEach(function (e) { ar += e.a[0] * e.b[1] - e.b[0] * e.a[1] })
				return { h: Math.max.apply(0, ys) - Math.min.apply(0, ys), a: Math.abs(ar / 2) }
			})
			var maxH = Math.max.apply(0, info.map(function (x) { return x.h }))
			var isWall = info.map(function (x) { return x.h >= 0.7 * maxH })
			var em = {}
			panels.forEach(function (p, pi) { p.segs.forEach(function (s) { var k = ekey(s.a, s.b); (em[k] = em[k] || []).push(pi) }) })
			var nb = panels.map(function () { return {} })
			Object.keys(em).forEach(function (k) { var e = em[k]; if (e.length === 2) { nb[e[0]][e[1]] = 1; nb[e[1]][e[0]] = 1 } })
			var bestI = 0, bestScore = -1e18
			panels.forEach(function (p, i) {
				if (!isWall[i]) return
				var wn = 0, maxFlap = 0
				Object.keys(nb[i]).forEach(function (j) { if (isWall[+j]) wn++; else if (info[+j].h > maxFlap) maxFlap = info[+j].h })
				var score = wn * 1e9 - maxFlap * 1e3 + info[i].a
				if (score > bestScore) { bestScore = score; bestI = i }
			})
			return panels[bestI].id
		}
		return { fromSVG: fromSVG }
	})()

	function buildTreeImp(geo, rootId) {
		var edgeMap = {}
		function ek(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }
		geo.panels.forEach(function (p, pi) { p.segs.forEach(function (s) { var k = ek(s.a, s.b); (edgeMap[k] = edgeMap[k] || []).push({ pi: pi, a: s.a, b: s.b }) }) })
		var adj = geo.panels.map(function () { return [] })
		Object.keys(edgeMap).forEach(function (k) { var e = edgeMap[k]; if (e.length === 2) { var L = Math.hypot(e[0].a[0] - e[0].b[0], e[0].a[1] - e[0].b[1]); adj[e[0].pi].push({ nb: e[1].pi, A: e[0].a, B: e[0].b, len: L }); adj[e[1].pi].push({ nb: e[0].pi, A: e[0].a, B: e[0].b, len: L }) } })
		var cent = geo.panels.map(function (p) { var sx = 0, sy = 0, n = 0; p.segs.forEach(function (s) { sx += s.a[0]; sy += s.a[1]; n++ }); return [sx / n, sy / n] })
		var rootIdx = 0; geo.panels.forEach(function (p, i) { if (p.id === rootId) rootIdx = i })
		var nodes = geo.panels.map(function (p, i) { return { idx: i, id: p.id, children: [], hinge: null } })
		// max-spanning-tree (Prim's): ต่อ panel กับ parent ผ่านขอบที่ "ยาวสุด" → ปีกต่อผนัง ไม่ใช่ขอบมุมสั้นๆ
		var visited = {}; visited[rootIdx] = 1
		var frontier = adj[rootIdx].map(function (e) { return { from: rootIdx, e: e } })
		while (frontier.length) {
			var best = -1, bi = -1
			for (var i = 0; i < frontier.length; i++) { if (!visited[frontier[i].e.nb] && frontier[i].e.len > best) { best = frontier[i].e.len; bi = i } }
			if (bi < 0) break
			var pick = frontier[bi]; frontier.splice(bi, 1)
			var nb = pick.e.nb; if (visited[nb]) continue
			visited[nb] = 1
			var A = pick.e.A, B = pick.e.B, c = cent[nb]
			var cross = (B[0] - A[0]) * (c[1] - A[1]) - (B[1] - A[1]) * (c[0] - A[0])
			if (cross < 0) { var t = A; A = B; B = t }
			nodes[nb].hinge = { A: A, B: B }
			nodes[pick.from].children.push(nodes[nb])
			adj[nb].forEach(function (e) { if (!visited[e.nb]) frontier.push({ from: nb, e: e }) })
		}
		return nodes[rootIdx]
	}

	function buildSVGGroup(svgText, fin, boxType) {
		fin = fin || {}
		var material = new THREE.MeshStandardMaterial({ color: (fin.paperColor != null ? fin.paperColor : 0xf4ecd8), side: THREE.DoubleSide, roughness: (fin.roughness != null ? fin.roughness : 0.92), metalness: (fin.metalness != null ? fin.metalness : 0), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
		var edgeMat = new THREE.LineBasicMaterial({ color: 0x8a7a55 })
		var geo = SVGImp.fromSVG(svgText, {})
		function ekeyG(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }
			var cutMat = new THREE.LineBasicMaterial({ color: 0x333333 })   // 3D = เส้นดำ (backend ยังแยก cut/fold ด้วย ecount)
			var foldMat = new THREE.LineBasicMaterial({ color: 0x333333 }); function pAreaG(p) { var s = 0; p.segs.forEach(function (e) { s += e.a[0] * e.b[1] - e.b[0] * e.a[1] }); return Math.abs(s / 2) }
			var ecount = {}
			geo.panels.forEach(function (p) { p.segs.forEach(function (s) { var k = ekeyG(s.a, s.b); ecount[k] = (ecount[k] || 0) + 1 }) })
			var root = buildTreeImp(geo, geo.rootId)
		// ทรง 8 gable: หา band บนผนัง (roof=ครึ่งล่าง, จั่ว=ครึ่งบนถึง apex) เพื่อพับลาดขึ้นสัน
		var _g8 = null
		if (boxType === 8) { var _ay = [], _rp = null; geo.panels.forEach(function (p) { if (p.id === geo.rootId) _rp = p; p.segs.forEach(function (s) { _ay.push(s.a[1]) }) }); var _tm = Math.max.apply(0, _ay), _rt = Math.max.apply(0, _rp.segs.map(function (s) { return s.a[1] })); _g8 = { rt: _rt, mid: (_rt + _tm) / 2 } }
		var folds = [], maxDepth = 1, holder = new THREE.Group(), _rootArea = 0
		function w2l(f, P) { var dx = P[0] - f.ox, dy = P[1] - f.oy, c = Math.cos(-f.ang), s = Math.sin(-f.ang); return [dx * c - dy * s, dx * s + dy * c] }
		function rec(node, pf, container, depth, parentArea, parentPerp, parentMesh) {
			if (depth > maxDepth) maxDepth = depth
			var panel = geo.panels[node.idx]; var myArea = pAreaG(panel); if (depth === 0) _rootArea = myArea; var isLip = node.hinge && node.children.length === 0 && depth >= 2 && parentArea > 0 && myArea >= 0.8 * parentArea; var isLid = boxType === 7 && node.hinge && node.children.length > 0 && depth >= 2 && _rootArea > 0 && myArea >= 0.65 * _rootArea; var isEar = boxType === 5 && node.hinge && node.children.length === 0 && depth >= 2 && !isLip && parentArea > 0 && myArea < 0.5 * parentArea; var fAngle = isLip ? Math.PI * 0.97 : (isEar ? Math.PI * 0.98 : (isLid ? HALF * 0.4 : HALF)); if (_g8 && node.hinge) { var _cy = 0, _cn = 0; panel.segs.forEach(function (s) { _cy += s.a[1]; _cn++ }); _cy /= _cn; if (_cy > _g8.rt + 5) fAngle = (_cy < _g8.mid ? HALF * 0.62 : HALF * 0.55) }
			var frame = node.hinge ? { ox: node.hinge.A[0], oy: node.hinge.A[1], ang: Math.atan2(node.hinge.B[1] - node.hinge.A[1], node.hinge.B[0] - node.hinge.A[0]) } : { ox: 0, oy: 0, ang: 0 }
			var shape = new THREE.Shape(), cutV = [], foldV = []
			var _clipP = (isLip && parentPerp > 0) ? parentPerp * 1.02 : 0
			panel.segs.forEach(function (s, i) { var la = w2l(frame, s.a), lb = w2l(frame, s.b); if (_clipP) { la[1] = Math.max(-_clipP, Math.min(_clipP, la[1])); lb[1] = Math.max(-_clipP, Math.min(_clipP, lb[1])) } if (i === 0) shape.moveTo(la[0], la[1]); shape.lineTo(lb[0], lb[1]); var arr = (ecount[ekeyG(s.a, s.b)] >= 2) ? foldV : cutV; arr.push(new THREE.Vector3(la[0], la[1], 0), new THREE.Vector3(lb[0], lb[1], 0)) })
			var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), material)
			if (cutV.length) mesh.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cutV), cutMat)); if (foldV.length) mesh.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(foldV), foldMat))
			var nc
			if (node.hinge) {
				var aP = w2l(pf, node.hinge.A), joint = new THREE.Group()
				joint.position.set(aP[0], aP[1], 0); joint.rotation.z = frame.ang - pf.ang
				var fold = new THREE.Group(); joint.add(fold); fold.add(mesh); container.add(joint)
				folds.push({ pivot: fold, axis: 'x', sign: 1, angle: fAngle, phase: [0, 1], _d: depth, leaf: node.children.length === 0, mesh: mesh, parentMesh: parentMesh }); nc = fold
			} else { var gg = new THREE.Group(); gg.add(mesh); container.add(gg); nc = gg }
			node.children.forEach(function (c) { var pp = 0; if (c.hinge) { var hf = { ox: c.hinge.A[0], oy: c.hinge.A[1], ang: Math.atan2(c.hinge.B[1] - c.hinge.A[1], c.hinge.B[0] - c.hinge.A[0]) }; panel.segs.forEach(function (s) { var dy = Math.abs(w2l(hf, s.a)[1]); if (dy > pp) pp = dy }) } rec(c, frame, nc, depth + 1, myArea, pp, mesh) })
		}
		rec(root, { ox: 0, oy: 0, ang: 0 }, holder, 0, 0, 0)
		folds.forEach(function (f) { var p0 = (f._d - 1) / maxDepth * 0.55; f.phase = [Math.max(0, p0), Math.min(1, p0 + 0.45)] })
		var box = new THREE.Box3().setFromObject(holder), sz = box.getSize(new THREE.Vector3()), sc = 1 / Math.max(sz.x, sz.y, sz.z, 1)
		holder.scale.set(sc, sc, sc)
		// ปีก (leaf) พับเข้าหาจุดกลางกล่อง → lock เข้าหากัน, ทิศสม่ำเสมอทุกทรง
		folds.forEach(function (f) { f.pivot.rotation.x = f.angle * f.sign })
		holder.updateMatrixWorld(true)
		var _bc = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3())
		folds.forEach(function (f) {
			if (!f.leaf || !f.mesh) return
			f.mesh.geometry.computeBoundingBox()
			var lc0 = f.mesh.geometry.boundingBox.getCenter(new THREE.Vector3())
			function dist(sgn) { f.pivot.rotation.x = f.angle * sgn; holder.updateMatrixWorld(true); var c = lc0.clone(); f.mesh.localToWorld(c); return c.distanceTo(_bc) }
			var dp = dist(f.sign), dn = dist(-f.sign)
			if (dn < dp) f.sign = -f.sign
		})
		// flatten: ปีกเล็กที่ตั้งฉากกับแกนยาว ณ ปลายปิดกล่อง → พับราบ 180° (เช่น dust flap RTE ที่ตั้งขึ้น 90°)
		folds.forEach(function (f) { f.pivot.rotation.x = f.angle * f.sign })
		holder.updateMatrixWorld(true)
		var _bb = new THREE.Box3().setFromObject(holder), _bsz = _bb.getSize(new THREE.Vector3())
		var _nrm = new THREE.Matrix3(), _maxA = 0
		folds.forEach(function (f) { if (f.mesh) { f.mesh.geometry.computeBoundingBox(); var b = f.mesh.geometry.boundingBox; f.mesh._area = (b.max.x - b.min.x) * (b.max.y - b.min.y); if (f.mesh._area > _maxA) _maxA = f.mesh._area } })
		// แกนตั้งจริง (up) = แกนที่ "ผนัง" หันไปทางน้อยที่สุด (area-weighted) ไม่ใช่แกนที่ bbox กว้างสุด
		var _axU = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)], _sumU = [0, 0, 0]
		folds.forEach(function (f) { if (!f.mesh) return; _nrm.getNormalMatrix(f.mesh.matrixWorld); var nn = new THREE.Vector3(0, 0, 1).applyMatrix3(_nrm).normalize(); for (var k = 0; k < 3; k++) _sumU[k] += Math.abs(nn.dot(_axU[k])) * (f.mesh._area || 0) })
		var _ui = (_sumU[0] <= _sumU[1] && _sumU[0] <= _sumU[2]) ? 0 : (_sumU[1] <= _sumU[2] ? 1 : 2)
		var _up = _axU[_ui], _upLen = [_bsz.x, _bsz.y, _bsz.z][_ui]
		folds.forEach(function (f) {
			if (!f.leaf || !f.mesh || f.angle > HALF * 1.2 || f._d < 2) return
			var b = f.mesh.geometry.boundingBox, cen = b.getCenter(new THREE.Vector3()); f.mesh.localToWorld(cen)
			_nrm.getNormalMatrix(f.mesh.matrixWorld)
			var n = new THREE.Vector3(0, 0, 1).applyMatrix3(_nrm).normalize()
			var perp = Math.abs(n.dot(_up)) < 0.35
			var cUp = cen.dot(_up), nearEnd = Math.min(Math.abs(cUp - _bb.min.dot(_up)), Math.abs(cUp - _bb.max.dot(_up))) < _upLen * 0.25
			var small = f.mesh._area < 0.4 * _maxA
			if (perp && nearEnd && small) { f.angle = Math.PI * 0.98; return }
			// ลิ้นเล็กที่ตั้งฉากกับ parent ซึ่งเป็น "ปีก" (เล็ก ไม่ใช่ผนัง) เช่น lock tab บนปีกก้น auto-bottom → พับราบ
			if (small && f.parentMesh && f.parentMesh._area != null && f.parentMesh._area < 0.4 * _maxA) {
				_nrm.getNormalMatrix(f.parentMesh.matrixWorld)
				var pn = new THREE.Vector3(0, 0, 1).applyMatrix3(_nrm).normalize()
				if (Math.abs(n.dot(pn)) < 0.4) f.angle = Math.PI * 0.98
			}
		})
		folds.forEach(function (f) { f.pivot.rotation.x = 0 })
		// แผ่นที่พับ ≥126° (ราบทับผนัง/พื้น เช่น lip, ear, flap) → tag เส้นเป็น flatFlap (OFF ซ่อน, ON โชว์)
		folds.forEach(function (f) { if (f.angle >= 2.2 && f.mesh) f.mesh.children.forEach(function (ch) { if (ch.type === 'LineSegments') ch.userData.flatFlap = true }) })
		holder.userData.lineMats = { cut: cutMat, fold: foldMat }   // toggle เส้นพับสีจริง
		return { group: holder, folds: folds, material: material, edgeMat: edgeMat }
	}

	// เลือก builder: ทรงมี local SVG → พับจาก SVG (async fetch), ไม่มี → procedural เดิม
	function buildModelAsync(d, fin, cb) {
		if (hasLocalSVG(d.type)) {
			fetch('/dieline/local/' + d.type, { credentials: 'same-origin' })
				.then(function (r) { if (!r.ok) throw new Error('no svg'); return r.text() })
				.then(function (txt) { cb(buildSVGGroup(txt, fin, d.type), true) })
				.catch(function () { cb(buildBoxGroup(buildSpec(d), fin), false) })
		} else {
			cb(buildBoxGroup(buildSpec(d), fin), false)
		}
	}

	// ===========================================================================
	// Viewer — renderer + แสง + custom orbit + auto-fit + render loop
	// ===========================================================================
	function Viewer(canvas) {
		this.canvas = canvas
		this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true })
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
		this.scene = new THREE.Scene()
		// แสงนุ่มเป็นธรรมชาติ (hemisphere ฟ้า/พื้น + key + fill + เติมใต้)
		this.scene.add(new THREE.HemisphereLight(0xffffff, 0xe6e2d6, 0.75))
		this.scene.add(new THREE.AmbientLight(0xffffff, 0.30))
		var dir = new THREE.DirectionalLight(0xffffff, 0.78); dir.position.set(1.6, 2.6, 1.9); this.scene.add(dir)
		var dir2 = new THREE.DirectionalLight(0xffffff, 0.32); dir2.position.set(-1.6, 0.9, -1.2); this.scene.add(dir2)
		var dir3 = new THREE.DirectionalLight(0xffffff, 0.16); dir3.position.set(0, -1, 0.6); this.scene.add(dir3)
		this.camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1000)
		this.fovHalfSin = Math.sin((45 / 2) * Math.PI / 180)
		this.target = new THREE.Vector3(0, 0, 0)
		this.az = 0.9; this.pol = 1.05; this.rad = 3
		this._userRot = false    // ผู้ใช้ลากหมุนเองแล้วหรือยัง (true → หยุด auto-follow)
		this._flatAz = 1.5708    // มุมกล้องตอนกาง (มองตรงเห็น dieline) — +Z; ถ้าได้ด้านในให้เปลี่ยนเป็น -1.5708
		this.autoFit = true
		this.folds = []; this.boxGroup = null
		this.foldSpeed = 0.0034   // ~5 วินาที (0→1)
		this.stops = [1]          // จุดหยุดของแต่ละสเต็ป (ตั้งจาก startViewer)
		this._t = 0; this._raf = null; this._playing = false; this._playTo = 1
		this._box3 = new THREE.Box3(); this._sph = new THREE.Sphere()
		this.showDims = false; this._dimGroup = null; this._dims = null   // เริ่มต้นปิด ให้ผู้ใช้กดปุ่มเอง
		this._bindOrbit()
		this._loop = this._loop.bind(this)
	}
	Viewer.prototype._bindOrbit = function () {
		var self = this
		var el = this.canvas
		var drag = false, px = 0, py = 0
		function down(x, y) { drag = true; px = x; py = y; self._userRot = true }   // เริ่มหมุน → หยุด auto-follow
		function move(x, y) {
			if (!drag) return
			self.az -= (x - px) * 0.01
			self.pol = Math.max(0.08, Math.min(3.06, self.pol - (y - py) * 0.01))
			px = x; py = y
		}
		this._onDown = function (e) { down(e.clientX, e.clientY) }
		this._onMove = function (e) { move(e.clientX, e.clientY) }
		this._onUp = function () { drag = false }
		el.addEventListener('mousedown', this._onDown)
		window.addEventListener('mousemove', this._onMove)
		window.addEventListener('mouseup', this._onUp)
		el.addEventListener('touchstart', function (e) { if (e.touches[0]) down(e.touches[0].clientX, e.touches[0].clientY) }, { passive: true })
		el.addEventListener('touchmove', function (e) { if (e.touches[0]) { move(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault() } }, { passive: false })
		el.addEventListener('touchend', this._onUp)
		el.addEventListener('wheel', function (e) {
			e.preventDefault()
			self.autoFit = false // ผู้ใช้คุมซูมเอง
			self.rad = Math.max(0.2, Math.min(50, self.rad * (1 + (e.deltaY > 0 ? 0.12 : -0.12))))
		}, { passive: false })
	}
	Viewer.prototype.setScene = function (boxGroup, folds) {
		if (this.boxGroup) {
			this.scene.remove(this.boxGroup)
			// คืน memory ของกล่องเก่า (กันสะสมตอน rebuild หลายรอบ → ไม่สะดุด)
			this.boxGroup.traverse(function (o) {
				if (o.geometry) o.geometry.dispose()
				if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() }
			})
		}
		this.boxGroup = boxGroup; this.folds = folds
		this.scene.add(boxGroup)
		// เก็บเส้นพับ (ประ/ทึบ) ไว้สลับโชว์ตามสถานะพับ
		this._creaseDash = []; this._creaseSolid = []; this._allLines = []
		var self = this
		boxGroup.traverse(function (o) {
			if (o.type === 'LineSegments' || o.type === 'Line' || o.type === 'LineLoop') self._allLines.push(o)
			if (!o.userData) return
			if (o.userData.creaseDash) self._creaseDash.push(o)
			else if (o.userData.creaseSolid) self._creaseSolid.push(o)
		})
		this._lineMats = (boxGroup.userData && boxGroup.userData.lineMats) || null
		if (this._lineMats) {
			if (this._lineMats.cut.userData.defHex == null) this._lineMats.cut.userData.defHex = this._lineMats.cut.color.getHex()
			if (this._lineMats.fold.userData.defHex == null) this._lineMats.fold.userData.defHex = this._lineMats.fold.color.getHex()
		}
		this._applyFoldLineColors()
		this._applyLineVisibility()
		applyFold(this.folds, 0)
		this._updateCreases(this._t || 0)
		this._dirty = true
	}
	// toggle: โชว์เส้นพับสีจริง (เขียว=fold, แดง=cut) / ปิด=สีเดิม
	Viewer.prototype._applyFoldLineColors = function () {
		if (!this._lineMats) return
		var on = this._showFolds
		this._lineMats.cut.color.setHex(on ? 0xdd1111 : this._lineMats.cut.userData.defHex)
		this._lineMats.fold.color.setHex(on ? 0x16a34a : this._lineMats.fold.userData.defHex)
		// ON = เส้นทะลุผิว (depthTest off) → เห็นเส้น dieline ครบทุกเส้น 2 ฝั่ง สมมาตร
		this._lineMats.cut.depthTest = !on; this._lineMats.fold.depthTest = !on
		this._dirty = true
	}
	// OFF = ไม่โชว์เส้นเลย (กล่องเรียบ), ON = โชว์ทุกเส้น (สีจริง)
	Viewer.prototype._applyLineVisibility = function () {
		if (!this._allLines) return
		var show = !!this._showFolds
		for (var i = 0; i < this._allLines.length; i++) this._allLines[i].visible = show
		if (show) this._updateCreases(this._t || 0)
		this._dirty = true
	}
	Viewer.prototype.setShowFolds = function (on) { this._showFolds = on; this._applyFoldLineColors(); this._applyLineVisibility() }
	// กาง(t เล็ก)=เส้นประ, พับ(t ใกล้ 1)=เส้นทึบ
	Viewer.prototype._updateCreases = function (t) {
		if (!this._showFolds) return
		var solid = t >= 0.96, i
		if (this._creaseDash) for (i = 0; i < this._creaseDash.length; i++) this._creaseDash[i].visible = !solid
		if (this._creaseSolid) for (i = 0; i < this._creaseSolid.length; i++) this._creaseSolid[i].visible = solid
	}
	Viewer.prototype.setFold = function (t) { this._t = t; applyFold(this.folds, t); this._updateCreases(t); this._dirty = true }
	Viewer.prototype.setDims = function (W, L, D) { this._dims = { W: W, L: L, D: D }; this._dirty = true }
	Viewer.prototype._clearDims = function () {
		if (!this._dimGroup) return
		while (this._dimGroup.children.length) {
			var ch = this._dimGroup.children.pop()
			if (ch.geometry) ch.geometry.dispose()
			if (ch.material) { if (ch.material.map) ch.material.map.dispose(); ch.material.dispose() }
		}
	}
	Viewer.prototype._refreshDims = function () {
		if (!this.boxGroup) return
		var self = this
		this.boxGroup.traverse(function (o) { if (o.name === 'partLabel') o.visible = self.showDims })   // toggle ป้ายส่วน
		if (!this._dimGroup) { this._dimGroup = new THREE.Group(); this.scene.add(this._dimGroup) }
		this._clearDims()
		this._dimGroup.visible = this.showDims
		if (!this.showDims || !this._dims) return
		this._box3.setFromObject(this.boxGroup)
		if (this._box3.isEmpty()) return
		var mn = this._box3.min, mx = this._box3.max
		var sz = this._box3.getSize(new THREE.Vector3())
		var off = Math.max(sz.x, sz.y, sz.z) * 0.13
		var ctr = new THREE.Vector3((mn.x + mx.x) / 2, (mn.y + mx.y) / 2, (mn.z + mx.z) / 2)
		// กว้าง = ขอบบน, สูง = ขอบซ้ายตั้ง, ยาว = ขอบล่าง (แยกกันไม่ทับ)
		this._addDimLine(new THREE.Vector3(mn.x, mx.y + off, mx.z + off), new THREE.Vector3(mx.x, mx.y + off, mx.z + off), 'กว้าง ' + this._dims.W, off, ctr)   // W บน
		this._addDimLine(new THREE.Vector3(mn.x - off, mn.y, mx.z + off), new THREE.Vector3(mn.x - off, mx.y, mx.z + off), 'สูง ' + this._dims.D, off, ctr)       // D ซ้าย
		this._addDimLine(new THREE.Vector3(mx.x + off, mn.y - off, mn.z), new THREE.Vector3(mx.x + off, mn.y - off, mx.z), 'ยาว ' + this._dims.L, off, ctr)       // L ล่าง
	}
	Viewer.prototype._addDimLine = function (p1, p2, label, off, center) {
		var mat = new THREE.LineBasicMaterial({ color: 0x222222, depthTest: false })
		this._dimGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([p1, p2]), mat))
		var dir = new THREE.Vector3().subVectors(p2, p1).normalize()
		var ah = Math.min(p1.distanceTo(p2) * 0.14, off * 1.1)
		var up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)
		var perp = new THREE.Vector3().crossVectors(dir, up).normalize()
		this._arrow(p1, dir.clone().negate(), perp, ah, mat)
		this._arrow(p2, dir, perp, ah, mat)
		var mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5)
		var outward = center ? new THREE.Vector3().subVectors(mid, center).normalize() : perp   // ดันออกนอกกล่อง
		var sp = makeTextSprite(label, '#111')
		var tsc = off * 2.8
		sp.scale.set(tsc, tsc * 0.25, 1)
		sp.position.copy(mid).addScaledVector(outward, off * 1.2)   // ตัวหนังสืออยู่นอก (พ้นกล่อง)
		this._dimGroup.add(sp)
	}
	Viewer.prototype._arrow = function (tip, outDir, perp, size, mat) {
		var base = tip.clone().addScaledVector(outDir, -size)
		var w1 = base.clone().addScaledVector(perp, size * 0.45)
		var w2 = base.clone().addScaledVector(perp, -size * 0.45)
		this._dimGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([w1, tip, w2]), mat))
	}
	Viewer.prototype.resize = function () {
		var w = this.canvas.clientWidth || 600, h = this.canvas.clientHeight || 400
		this.renderer.setSize(w, h, false)
		this.camera.aspect = w / h
		this.camera.updateProjectionMatrix()
	}
	Viewer.prototype._fit = function () {
		if (!this.boxGroup) return
		this._box3.setFromObject(this.boxGroup)
		if (this._box3.isEmpty()) return
		this._box3.getBoundingSphere(this._sph)
		this.target.copy(this._sph.center)
		// ระยะกล้องให้ทรงกลมขอบเขตพอดีเฟรม + เผื่อขอบ
		this.rad = (this._sph.radius / this.fovHalfSin) * 1.25
	}
	Viewer.prototype._loop = function () {
		this._raf = requestAnimationFrame(this._loop)
		// auto-fit + รีเฟรชเส้นบอกขนาด เฉพาะตอนกล่องเปลี่ยน → หมุนลื่นขึ้น
		if (this._dirty || this._playing) {
			if (this.autoFit) this._fit()
			this._refreshDims()
			if (!this._playing) this._dirty = false
		}
		// กล้องหมุนตามสถานะพับอัตโนมัติ — จนกว่าผู้ใช้จะลากหมุนเอง (_userRot) แล้วปล่อยให้คุมเอง
		// กาง(t=0)=มองตรงเห็น dieline แบบรูป, พับ(t=1)=มุม 3D
		if (!this._userRot) {
			var ft = this._t < 0 ? 0 : (this._t > 1 ? 1 : this._t)
			var ease = ft * ft * (3 - 2 * ft)              // smoothstep
			this.az = this._flatAz + (0.9 - this._flatAz) * ease
			this.pol = 1.5708 + (1.05 - 1.5708) * ease
		}
		var r = this.rad, p = this.pol, a = this.az
		this.camera.position.set(
			this.target.x + r * Math.sin(p) * Math.cos(a),
			this.target.y + r * Math.cos(p),
			this.target.z + r * Math.sin(p) * Math.sin(a)
		)
		this.camera.lookAt(this.target)
		if (this._playing) {
			this._t += this.foldSpeed
			var goal = (this._playTo == null) ? 1 : this._playTo
			if (this._t >= goal) { this._t = goal; this._playing = false; if (this.onPlayEnd) this.onPlayEnd() }
			applyFold(this.folds, this._t)
			this._updateCreases(this._t)
			if (this.onFold) this.onFold(this._t)
		}
		this.renderer.render(this.scene, this.camera)
	}
	Viewer.prototype.start = function () { if (!this._raf) this._loop() }
	Viewer.prototype.play = function () { this._playTo = 1; if (this._t >= 1) this._t = 0; this._playing = true }
	Viewer.prototype.pause = function () { this._playing = false }
	// พับไปสเต็ปถัดไป (1 ขั้น) แล้วหยุด
	Viewer.prototype.stepNext = function () {
		var eps = 0.001
		if (this._t >= 1 - eps) { this._t = 0; applyFold(this.folds, 0); if (this.onFold) this.onFold(0) }
		var stops = this.stops || [1], next = 1
		for (var i = 0; i < stops.length; i++) { if (stops[i] > this._t + eps) { next = stops[i]; break } }
		this._playTo = next; this._playing = true
	}
	Viewer.prototype.dispose = function () {
		if (this._raf) cancelAnimationFrame(this._raf); this._raf = null
		if (this._onMove) window.removeEventListener('mousemove', this._onMove)
		if (this._onUp) window.removeEventListener('mouseup', this._onUp)
		try {
			this.scene.traverse(function (o) {
				if (o.geometry) o.geometry.dispose()
				if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() }
			})
			this.renderer.dispose()
		} catch (e) { }
	}

	// ===========================================================================
	// UI — ปุ่ม + overlay modal
	// ===========================================================================
	function injectButton() {
		if ($('#dieline-3d-btn').length) return
		var $target = $('#div_bttn > div').first()
		if (!$target.length) { setTimeout(injectButton, 500); return }
		$target.append($('<button id="dieline-3d-btn" type="button" style="' +
			'margin-left:10px;position:relative;z-index:50;background:linear-gradient(90deg,#8b5cf6 0%,#6d28d9 100%);' +
			'color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer">' +
			'<i class="fa fa-cube"></i> 3D</button>'))
	}
	setTimeout(injectButton, 1500)
	setInterval(injectButton, 3000)

	$(document).on('click', '#dieline-3d-btn', function () {
		try {
			if (typeof THREE === 'undefined') { alert('โหลด three.js ไม่สำเร็จ — ลอง refresh หน้าใหม่'); return }
			openModal()
		} catch (err) {
			console.error('[dieline-3d] open error:', err)
			alert('เปิด 3D ไม่สำเร็จ: ' + (err && err.message || err))
		}
	})

	var _viewer = null

	function openModal() {
		var d = readDims(0)
		if (!d.W || !d.L || !d.D) { alert('กรุณากรอกขนาด กว้าง × ยาว × สูง (mm) ใน Component ที่ 1 ก่อน'); return }
		var fin = readFinish(0)
		closeModal()
		injectSliderStyle()
		var approx = APPROX_TYPES[d.type]
			? '<span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px">⚠️ ภาพจำลองโดยประมาณ</span>' : ''
		var specInfo = buildSpecInfo(fin)
		// dropdown กระดาษ — clone option จากฟอร์ม component แรก
		var paperOptionsHtml = $('.paperType').eq(0).html() || ('<option value="">' + (fin.paperLabel || '-') + '</option>')
		var paperCurVal = $('.paperType').eq(0).val()
		var paperSelect = '<span style="display:inline-flex;align-items:center;gap:4px"><b>กระดาษ</b>' +
			'<select id="d3-paper" style="max-width:215px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;cursor:pointer">' + paperOptionsHtml + '</select></span>'
		// dropdown ชนิดกล่อง (Box Template) — clone จากฟอร์ม
		var boxOptionsHtml = $('.boxType').eq(0).html() || ''
		var boxCurVal = $('.boxType').eq(0).val()
		var boxSelect = boxOptionsHtml ? ('<span style="display:inline-flex;align-items:center;gap:4px"><b>ทรง</b>' +
			'<select id="d3-box" style="max-width:185px;padding:3px 5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;cursor:pointer">' + boxOptionsHtml + '</select></span>') : ''
		// dropdown เคลือบ
		var coatSelect = '<span style="display:inline-flex;align-items:center;gap:4px"><b>เคลือบ</b>' +
			'<select id="d3-coat" style="padding:3px 5px;border:1px solid #cbd5e1;border-radius:4px;font-size:12px;cursor:pointer">' +
			'<option value="">ไม่เคลือบ</option><option value="Gloss">Gloss (เงา)</option><option value="Matt">Matt (ด้าน)</option></select></span>'
		function dimInput(label, key, val) {
			return '<span style="display:inline-flex;align-items:center;gap:3px"><b>' + label + '</b>' +
				'<input class="d3-dim" data-key="' + key + '" type="number" min="1" value="' + (val || 0) + '" style="width:50px;padding:2px 4px;border:1px solid #cbd5e1;border-radius:4px;text-align:center;font-size:12px"></span>'
		}
		var dimRow = dimInput('กว้าง', 'W', d.W) + dimInput('ยาว', 'L', d.L) + dimInput('สูง', 'D', d.D) + dimInput('ฝา', 'T', d.T) + dimInput('ปีก', 'dust', d.dust)
		var $ov = $('<div id="dieline-3d-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:10000;display:flex;align-items:center;justify-content:center">' +
			'<div style="background:#fff;width:min(960px,96vw);height:min(90vh,720px);border-radius:8px;box-shadow:0 10px 40px rgba(0,0,0,0.35);display:flex;flex-direction:column;overflow:hidden">' +
			'<div style="flex-shrink:0;background:linear-gradient(90deg,#8b5cf6,#6d28d9);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:bold">' +
			'<span id="d3-title"><i class="fa fa-cube"></i> มุมมอง 3D — ' + (BOX_NAMES[d.type] || ('Type ' + d.type)) + approx + '</span>' +
			'<span class="d3-close" style="cursor:pointer;font-size:24px;padding:0 6px">&times;</span></div>' +
			'<div style="flex-shrink:0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;background:#f9fafb;padding:8px 16px;font-size:12px;color:#444">' +
			dimRow + boxSelect + paperSelect + coatSelect + '<span id="d3-specinfo" style="display:inline-flex;gap:10px;align-items:center">' + specInfo + '</span>' + '<span style="color:#888;font-size:11px">(mm)</span></div>' +
			'<div style="flex:1;display:flex;min-height:0">' +
			'<div id="d3-canvas-wrap" style="flex:1;min-height:0;position:relative;background:radial-gradient(circle at 50% 38%,#eef2ff,#dbe2f5)">' +
			'<canvas id="d3-canvas" style="width:100%;height:100%;display:block;touch-action:none"></canvas>' +
			'<div id="d3-status" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#4338ca;font-weight:bold;pointer-events:none;text-align:center">' +
			'<span><i class="fa fa-spinner fa-pulse" style="font-size:28px"></i><br>กำลังสร้างโมเดล...</span></div></div>' +
			'' +
			'</div>' +
			'<div style="flex-shrink:0;padding:12px 18px;border-top:1px solid #eee;background:#fafafa;display:flex;align-items:center;gap:12px">' +
			'<span style="font-size:13px;color:#6d28d9;font-weight:bold;white-space:nowrap"><i class="fa fa-cube"></i> พับ/กาง</span>' +
			'<input id="d3-slider" type="range" min="0" max="100" value="0" style="flex:1">' +
			'<span id="d3-pct" style="font-size:13px;color:#444;min-width:64px;text-align:right">พับ 0%</span>' +
			'<button id="d3-foldlines" data-on="0" style="background:#fff;color:#6d28d9;border:2px solid #6d28d9;border-radius:6px;padding:6px 12px;font-weight:bold;cursor:pointer;white-space:nowrap"><i class="fa fa-bezier-curve"></i> เส้นพับ</button>' +
			'<button id="d3-showdim" style="background:#9ca3af;color:#fff;border:none;border-radius:6px;padding:8px 14px;font-weight:bold;cursor:pointer;white-space:nowrap"><i class="fa fa-arrows-alt"></i> ขนาด</button>' +
			'<button id="d3-confirm" style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:8px 16px;font-weight:bold;cursor:pointer"><i class="fa fa-check"></i> ยืนยัน</button>' +
			'<button class="d3-close" style="padding:8px 16px;background:#eee;border:none;border-radius:6px;cursor:pointer">ปิด</button>' +
			'</div></div></div>')
		$('body').append($ov)
		if (paperCurVal != null) $('#d3-paper').val(paperCurVal)
		if (boxCurVal != null) $('#d3-box').val(boxCurVal)
		var ci = (fin.coatingLabel || '').toLowerCase()
		$('#d3-coat').val(/gloss|เงา|uv/.test(ci) ? 'Gloss' : (/matt|ด้าน/.test(ci) ? 'Matt' : ''))
		$ov.on('click', function (e) { if (e.target === this || $(e.target).hasClass('d3-close')) closeModal() })
		startViewer(d, fin)
	}

	// สร้าง html แถบสเปก (กระดาษ/เคลือบ/พิมพ์) — ใช้ตอนเปิด + ตอนอัปเดตสด
	function buildSpecInfo(f) {
		return (f.colorOut != null ? '<span><b>พิมพ์</b> ' + f.colorOut + ' สี</span>' : '')
	}

	// ===== อ่านสี/วัสดุจากสเปก (กระดาษ → สีกล่อง, เคลือบ → ความเงา) =====
	function readFinish(index) {
		index = index || 0
		var out = { paperLabel: '', paperColor: 0xf4ecd8, roughness: 0.92, metalness: 0, coatingLabel: '', colorOut: null }
		try {
			var est = window.est || window.estimate
			var comp = (est && est.mainData && est.mainData.component1 && est.mainData.component1[index]) || {}
			// กระดาษ → สีกล่อง
			var paper = comp.paper || {}
			var pcode = String(paper.paper_code || paper.type || paper.paper_type || '')
			out.paperLabel = paper.paper_code || paper.type || ''
			var p = pcode.toLowerCase()
			// ตามรหัสกระดาษจริงในระบบ: AC,Dup,FCY,GA,K,MA,MCA,WC,B
			if (/kraft|คราฟ|(^|\s)k(\s|$|\/)/.test(p)) { out.paperColor = 0xc09a64; out.roughness = 0.97 }   // Kraft → น้ำตาล
			else if (/duplex|grey|gray|เทา|(^|\s)dup/.test(p)) { out.paperColor = 0xd5d2c6 }                 // Duplex/Grey → เทา
			else if (/fancy|woodfree|(^|\s)fcy|(^|\s)b(\s|$)/.test(p)) { out.paperColor = 0xeee2c8 }         // Fancy/Woodfree → ครีม
			else { out.paperColor = 0xf2ebd9 }                                                               // Art/Gloss/Matt/White Card → ขาวนวล
			// เคลือบ → ความเงา (หาจาก addon/coating)
			var addons = comp.addon || comp.coating || []
			if (Array.isArray(addons)) {
				for (var i = 0; i < addons.length; i++) {
					var a = addons[i] || {}
					if (a.type === 'coating' || (a.info && a.info.name)) {
						var cn = String((a.info && (a.info.name || a.info.type)) || a.name || a.option || '')
						if (cn) { out.coatingLabel = cn }
						if (/gloss|เงา|uv/i.test(cn)) { out.roughness = 0.32; out.metalness = 0.07 }
						else if (/matt|ด้าน/i.test(cn)) { out.roughness = 0.97 }
						break
					}
				}
			}
			// จำนวนสีพิมพ์ (outside)
			var col = comp.color
			if (Array.isArray(col)) out.colorOut = col[0] && col[0].outside
			else if (col) out.colorOut = col.outside
		} catch (e) { }

		// อ่านจาก DOM dropdown (ค่าที่เลือกล่าสุดในฟอร์ม) — ทับ mainData ที่อาจ stale ตอนเปลี่ยนกระดาษสด
		{
			try {
				var $pt = ($('#d3-paper').length ? $('#d3-paper') : $('.paperType').eq(index))   // ใช้ dropdown ในป๊อปอัปก่อน
				var ptxt = ($pt.find('option:selected').text() || $pt.val() || '').trim()
				if (ptxt && ptxt.toLowerCase().indexOf('select') < 0) {
					out.paperLabel = ptxt
					var p2 = ptxt.toLowerCase()
					if (/kraft|คราฟ|(^|\s)k(\s|$|\/)/.test(p2)) { out.paperColor = 0xc09a64; out.roughness = 0.97 }
					else if (/duplex|grey|gray|เทา|dup/.test(p2)) { out.paperColor = 0xd5d2c6 }
					else if (/fancy|woodfree|fcy/.test(p2)) { out.paperColor = 0xeee2c8 }
					else { out.paperColor = 0xf2ebd9 }
				}
				var copt = ($('#d3-coat').length ? ($('#d3-coat').val() || '') : ($('.coatingOption').eq(index).val() || '')).trim()   // dropdown ในป๊อปอัปก่อน
				if (copt && copt.toLowerCase() !== 'other') {
					out.coatingLabel = copt
					if (/gloss|เงา|uv/i.test(copt)) { out.roughness = 0.32; out.metalness = 0.07 }
					else if (/matt|ด้าน/i.test(copt)) { out.roughness = 0.97 }
				}
				var cv = parseInt($('.colorOutside').eq(index).val())
				if (!isNaN(cv)) out.colorOut = cv
			} catch (e) { }
		}
		return out
	}

	function setStatus(html) {
		var $s = $('#d3-status')
		if (html === false) { $s.hide(); return }
		$s.show().html('<span>' + html + '</span>')
	}

	function renderSideDieline(d) {
		var $side = $('#d3-dieline-side'); if (!$side.length) return
		var ttl = '<div style="position:absolute;top:6px;left:8px;font-size:11px;color:#6d28d9;font-weight:bold;z-index:2"><i class="fa fa-vector-square"></i> แบบกาง (dieline)</div>'
		if (hasLocalSVG(d.type)) {
			$side.html(ttl + '<object data="/dieline/local/' + d.type + '" type="image/svg+xml" style="max-width:100%;max-height:100%"></object>')
		} else if (window.__dielineV2 && window.__dielineV2.buildDielineSVG) {
			try { $side.html(ttl + window.__dielineV2.buildDielineSVG(d)) } catch (e) { $side.html(ttl + '<span style="color:#dc2626">สร้าง dieline ไม่ได้</span>') }
		} else {
			$side.html(ttl + '<span style="color:#94a3b8;text-align:center">ทรงนี้ใช้ Dieline v2<br>(กดปุ่ม Dieline v2 ฟรี)</span>')
		}
	}
	function updateReferenceDieline(type) {
		var $box = $('#d3-dieline-box')
		var $img = $('#d3-dieline-img')
		if (!$box.length || !$img.length) return
		if (type >= 1 && type <= 11) {
			// ทรงที่เซฟ SVG ไว้ (จาก diecuttemplates) → โหลด local SVG แม่นๆ; ไม่มีก็ fallback รูป jpg
			$img.get(0).onerror = function () { this.onerror = null; this.src = './img/' + type + '.jpg' }
			$img.attr('src', '/dieline/local/' + type)
			$box.show()
		} else {
			$img.attr('src', '')
			$box.hide()
		}
	}

	function startViewer(d, fin) {
		var canvas = document.getElementById('d3-canvas')
		_viewer = new Viewer(canvas)
		_viewer.resize()
		_viewer.start()
		_viewer.onFold = function (t) {
			var pct = Math.round(t * 100)
			$('#d3-slider').val(pct); setSliderFill(pct)
			$('#d3-pct').text('พับ ' + pct + '%')
		}
		setSliderFill(0)
		$('#d3-slider').off('input').on('input', function () {
			var t = (+this.value) / 100
			_viewer.pause(); _viewer.setFold(t); setSliderFill(+this.value)
			$('#d3-pct').text('พับ ' + Math.round(t * 100) + '%')
		})
		// toggle เส้นพับสีจริง (เขียว=fold, แดง=cut)
		$('#d3-foldlines').off('click').on('click', function () {
			var on = $(this).attr('data-on') !== '1'
			$(this).attr('data-on', on ? '1' : '0')
			_viewer.setShowFolds(on)
			if (on) $(this).css({ background: '#6d28d9', color: '#fff' })
			else $(this).css({ background: '#fff', color: '#6d28d9' })
		})

		// ใส่ built เข้า viewer (ใช้ร่วมกันทั้งตอนเปิดและ rebuild)
		function applyBuilt(built, isSvg) {
			_viewer.setScene(built.group, built.folds)
			_viewer._svgType = isSvg ? d.type : null
			_viewer.setDims(d.W, d.L, d.D)
			var stops = built.folds.map(function (f) { return f.phase[1] })
				.filter(function (v, i, a) { return a.indexOf(v) === i }).sort(function (a, b) { return a - b })
			if (!stops.length || stops[stops.length - 1] !== 1) stops.push(1)
			_viewer.stops = stops
			_viewer.setFold(_viewer._t || 0)
			setStatus(false)
		}
		setStatus('กำลังสร้างโมเดล...')
		buildModelAsync(d, fin, applyBuilt)
		updateReferenceDieline(d.type)
		renderSideDieline(d)

		// ===== แก้ขนาดในหน้าต่าง 3D → กล่องอัปเดต =====
		function rebuild3D() {
			renderSideDieline(d)
			// ทรง SVG = ขนาดคงที่ → ไม่ rebuild ตอนแก้ขนาด (rebuild เฉพาะตอนเปลี่ยนทรง)
			if (hasLocalSVG(d.type) && _viewer._svgType === d.type) return
			buildModelAsync(d, readFinish(0), function (built, isSvg) {
				_viewer.setScene(built.group, built.folds)
				_viewer._svgType = isSvg ? d.type : null
				_viewer.setDims(d.W, d.L, d.D)
				var stops2 = built.folds.map(function (f) { return f.phase[1] })
					.filter(function (v, i, a) { return a.indexOf(v) === i }).sort(function (a, b) { return a - b })
				if (!stops2.length || stops2[stops2.length - 1] !== 1) stops2.push(1)
				_viewer.stops = stops2
				_viewer.setFold(_viewer._t)   // คงตำแหน่งพับเดิม
			})
		}
		function readEdits() {
			$('#dieline-3d-overlay .d3-dim').each(function () {
				var k = $(this).data('key'), v = parseFloat(this.value)
				if (!isNaN(v) && v > 0) d[k] = v
			})
		}
		function commitToForm() {
			var $i = $('.inputType[index="0"]')
			if (!$i.length) return
			$i.find('.specmm.width').val(d.W).trigger('change')
			$i.find('.specmm.length').val(d.L).trigger('change')
			$i.find('.specmm.depth').val(d.D).trigger('change')
			$i.find('.specmm.tuck').val(d.T).trigger('change')
			$i.find('.specmm.dust').val(d.dust).trigger('change')
		}
		$('#dieline-3d-overlay').off('input.d3 change.d3', '.d3-dim')
			.on('input.d3', '.d3-dim', function () { readEdits(); rebuild3D() })                       // พิมพ์ → กล่องเปลี่ยนสด
			.on('change.d3', '.d3-dim', function () { readEdits(); rebuild3D(); commitToForm() })       // ออกจากช่อง → อัปเดตฟอร์ม

		// ===== เปลี่ยนกระดาษ/เคลือบ/สี ในฟอร์ม → กล่อง 3D เปลี่ยนสีเองทันที =====
		function recolorFromForm() {
			var fin2 = readFinish(0)
			if (_viewer && _viewer.boxGroup) {
				_viewer.boxGroup.traverse(function (o) {
					if (o.material && o.material.isMeshStandardMaterial) {
						o.material.color.setHex(fin2.paperColor)
						o.material.roughness = fin2.roughness
						o.material.metalness = fin2.metalness
					}
				})
			}
			$('#d3-specinfo').html(buildSpecInfo(fin2))
		}
		$(document).off('change.d3color')
			.on('change.d3color', '.paperType, .paperGram, .coatingOption, .coatingType, .colorOutside, .has_speInk', function () {
				setTimeout(recolorFromForm, 120)   // รอฟอร์มอัปเดต mainData ก่อนแล้วค่อยอ่านใหม่
			})

		// เปลี่ยน dropdown กระดาษในป๊อปอัป → 3D เปลี่ยนสีทันที (preview ยังไม่แตะฟอร์ม)
		$('#dieline-3d-overlay').off('change.d3p', '#d3-paper').on('change.d3p', '#d3-paper', function () { recolorFromForm() })
		// เปลี่ยน dropdown เคลือบ → ความเงาเปลี่ยนสด
		$('#dieline-3d-overlay').off('change.d3coat', '#d3-coat').on('change.d3coat', '#d3-coat', function () { recolorFromForm() })
		// toggle แสดงป้ายขนาด
		$('#dieline-3d-overlay').off('click.d3dim', '#d3-showdim').on('click.d3dim', '#d3-showdim', function () {
			if (!_viewer) return
			_viewer.showDims = !_viewer.showDims
			if (_viewer.showDims) {                                  // เปิดขนาด → พับเต็มก่อน (วัดบนกล่องจริง)
				_viewer.setFold(1); $('#d3-slider').val(100); setSliderFill(100); $('#d3-pct').text('พับ 100%')
			}
			_viewer._dirty = true
			$(this).css('background', _viewer.showDims ? '#7c3aed' : '#9ca3af')   // active=ม่วง / off=เทา
		})
		// เปลี่ยน dropdown ทรงกล่อง → 3D เปลี่ยนรูปทรงทันที (preview)
		$('#dieline-3d-overlay').off('change.d3b', '#d3-box').on('change.d3b', '#d3-box', function () {
			var nt = parseInt($('#d3-box').val())
			if (isNaN(nt)) return
			d.type = nt
			rebuild3D()
			updateReferenceDieline(nt)
			var apx = APPROX_TYPES[nt] ? ' <span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-size:11px;margin-left:8px">⚠️ ภาพจำลองโดยประมาณ</span>' : ''
			$('#d3-title').html('<i class="fa fa-cube"></i> มุมมอง 3D — ' + (BOX_NAMES[nt] || ('Type ' + nt)) + apx)
		})
		// ปุ่มยืนยัน → ดันค่า ขนาด + กระดาษ + ทรงกล่อง เข้าฟอร์ม RFQ
		$('#dieline-3d-overlay').off('click.d3c', '#d3-confirm').on('click.d3c', '#d3-confirm', function () {
			readEdits()
			var bv = $('#d3-box').val(), pv = $('#d3-paper').val(), cv = $('#d3-coat').val()
			var bt = parseInt(bv); if (!isNaN(bt)) d.type = bt
			rebuild3D()
			// 1) เปลี่ยน "ทรง" ก่อน (ถ้าต่างจากฟอร์ม) — เพราะมันจะ reconfigure ฟอร์ม (ล้างช่องขนาด)
			var boxChanged = (bv != null && bv !== '' && String(bv) !== String($('.boxType').eq(0).val()))
			if (boxChanged) $('.boxType').eq(0).val(bv).trigger('change')
			// 2) รอ form reconfigure เสร็จ แล้วค่อยกรอก ขนาด/กระดาษ/เคลือบ
			var applyRest = function () {
				commitToForm()                                                                  // ขนาด → ฟอร์ม
				if (pv != null && pv !== '') $('.paperType').eq(0).val(pv).trigger('change')     // กระดาษ
				if (cv && $('.coatingOption').length) $('.coatingOption').eq(0).val(cv).trigger('change')  // เคลือบ
			}
			if (boxChanged) setTimeout(applyRest, 450); else applyRest()
			var $b = $(this), html = $b.html()
			$b.html('<i class="fa fa-check"></i> อัปเดตแล้ว')
			setTimeout(function () { $b.html(html) }, 1500)
		})
		try {
			_viewer._ro = new ResizeObserver(function () { if (_viewer) _viewer.resize() })
			_viewer._ro.observe(document.getElementById('d3-canvas-wrap'))
		} catch (e) { window.addEventListener('resize', _viewer._onWinResize = function () { _viewer && _viewer.resize() }) }

		// (เอา auto-play ออกแล้ว — ผู้ใช้ลากเลื่อนพับเอง)

		// (ปิด dieline preview แล้ว — โฟกัสแค่ 3D ไม่เรียก /dieline/generate)
	}

	function generateDieline(d) {
		// diecuttemplates ต้องการ length >= width → ส่งด้านยาวกว่าเป็น length เสมอ
		var dlLen = Math.max(d.W, d.L), dlWid = Math.min(d.W, d.L)
		return fetch('/dieline/generate', {
			method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
			body: JSON.stringify({
				internal_template_id: String(d.type), format: 'svg',
				variables: { unit: 'mm', material: 0.5, length: dlLen, width: dlWid, height: d.D, top_tuck_flap: d.T, dust_flap: d.dust }
			})
		}).then(function (r) { return r.json() }).then(function (j) {
			if (!j.success || !j.url) throw new Error(j.error || 'gen failed')
			return j.url
		})
	}

	function closeModal() {
		if (_viewer) {
			if (_viewer._ro) try { _viewer._ro.disconnect() } catch (e) { }
			if (_viewer._onWinResize) window.removeEventListener('resize', _viewer._onWinResize)
			_viewer.dispose(); _viewer = null
		}
		$(document).off('change.d3color')   // เลิกฟังการเปลี่ยนกระดาษในฟอร์ม
		$('#dieline-3d-overlay').remove()
	}

	// เปิด core ให้เรียกจากภายนอก (ใช้ตอนทดสอบ/ฝังที่อื่น)
	try { window.__dieline3d = { buildSpec: buildSpec, buildBoxGroup: buildBoxGroup, buildSVGGroup: buildSVGGroup, Viewer: Viewer, applyFold: applyFold, readDims: readDims } } catch (e) { }
})()
