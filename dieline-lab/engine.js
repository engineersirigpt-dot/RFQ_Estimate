/*
 * dieline-lab/engine.js
 * ----------------------------------------------------------------------------
 * Packaging CAD Engine (PoC) — template-driven, formula-driven
 *
 * แนวคิด: template (JSON) = source of truth
 *   - แต่ละ panel เก็บ "outline" เป็นชุดคำสั่ง M/L/Q/Z ที่ค่าทุกตัวเป็น "สูตร"
 *   - ใส่ค่า {L,W,D,T,G,dust} → engine คำนวณพิกัดจริง
 *   - ขอบที่ panel สองชิ้นใช้ร่วมกัน = "รอยพับ" (เส้นประ) ตรวจจับอัตโนมัติ
 *   - ขอบที่เหลือ + เส้นโค้ง = "เส้นตัด" (เส้นทึบ)
 *   → ได้ทั้ง SVG 2D และ (ภายหลัง) fold-tree 3D จากข้อมูลชุดเดียวกัน
 *
 * ไม่มี hardcode รูปทรงในโค้ด — รูปทรงทั้งหมดมาจาก template
 */
(function (global) {
	'use strict'

	// ===== ตัวคำนวณสูตร: "2*(W+T)+D" + scope {L,W,...} → ตัวเลข =====
	function evalF(expr, scope) {
		if (typeof expr === 'number') return expr
		var keys = Object.keys(scope)
		var vals = keys.map(function (k) { return scope[k] })
		// helper เผื่อใช้ในสูตร
		keys = keys.concat(['min', 'max', 'sqrt', 'abs', 'PI'])
		vals = vals.concat([Math.min, Math.max, Math.sqrt, Math.abs, Math.PI])
		try {
			return Function.apply(null, keys.concat(['return (' + expr + ')'])).apply(null, vals)
		} catch (e) {
			console.error('evalF error in "' + expr + '":', e.message)
			return 0
		}
	}

	// ===== สร้าง scope จาก params + vars (vars คิดตามลำดับ อ้างถึงกันได้) =====
	function buildScope(template, params) {
		var scope = {}
		// รับทุกค่าจาก params (ขนาด L/W/D... + ค่าปรับรูปทรงจาก controls)
		Object.keys(params || {}).forEach(function (k) { scope[k] = params[k] })
		;['L', 'W', 'H', 'D', 'T', 'G', 'dust'].forEach(function (k) { if (scope[k] == null) scope[k] = 0 })
		if (scope.H === 0 && scope.D) scope.H = scope.D   // alias H<->D
		// ค่าเริ่มต้นของ controls (เผื่อ params ยังไม่ส่งมา)
		;(template.controls || []).forEach(function (c) { if (scope[c.name] == null) scope[c.name] = c.default })
		;(template.vars || []).forEach(function (v) { scope[v.name] = evalF(v.expr, scope) })
		return scope
	}

	// ===== resolve panel.outline (สูตร) → คำสั่งพิกัดจริง (+ override จากการลากมือ) =====
	// override key: "panelId:cmdIndex" = [dx,dy] (จุดมุม), "panelId:cmdIndex:c" = [dx,dy] (จุดคุมโค้ง)
	function resolveOutline(outline, scope, overrides, panelId) {
		return outline.map(function (c, i) {
			var o = { t: c.t, i: i }
			if (c.x != null) o.x = evalF(c.x, scope)
			if (c.y != null) o.y = evalF(c.y, scope)
			if (c.cx != null) o.cx = evalF(c.cx, scope)
			if (c.cy != null) o.cy = evalF(c.cy, scope)
			if (overrides) {
				var d = overrides[panelId + ':' + i]
				if (d && o.x != null) { o.x += d[0]; o.y += d[1]; o.ov = true }
				var dc = overrides[panelId + ':' + i + ':c']
				if (dc && o.cx != null) { o.cx += dc[0]; o.cy += dc[1]; o.ovc = true }
			}
			return o
		})
	}

	// ===== แตก outline → segment list (พร้อมจุดสุ่มของเส้นโค้ง) =====
	// คืน { segments:[{type:'line'|'curve', a:[x,y], b:[x,y], pts?:[[x,y]..]}], points:[...] }
	function outlineToSegments(cmds) {
		var segs = [], start = null, cur = null
		for (var i = 0; i < cmds.length; i++) {
			var c = cmds[i]
			if (c.t === 'M') { start = [c.x, c.y]; cur = start }
			else if (c.t === 'L') { segs.push({ type: 'line', a: cur, b: [c.x, c.y] }); cur = [c.x, c.y] }
			else if (c.t === 'Q') {
				var pts = []
				for (var k = 0; k <= 12; k++) {
					var t = k / 12, mt = 1 - t
					pts.push([
						mt * mt * cur[0] + 2 * mt * t * c.cx + t * t * c.x,
						mt * mt * cur[1] + 2 * mt * t * c.cy + t * t * c.y
					])
				}
				segs.push({ type: 'curve', a: cur, b: [c.x, c.y], pts: pts })
				cur = [c.x, c.y]
			} else if (c.t === 'Z') {
				if (start && cur && (cur[0] !== start[0] || cur[1] !== start[1]))
					segs.push({ type: 'line', a: cur, b: start })
				cur = start
			}
		}
		return segs
	}

	// ===== คีย์ขอบ (ปัดเศษกัน float เพี้ยน) เพื่อหาขอบที่ใช้ร่วมกัน =====
	function edgeKey(a, b) {
		var r = function (n) { return Math.round(n * 2) / 2 }   // ปัด 0.5
		var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1])
		return (pa < pb) ? pa + '|' + pb : pb + '|' + pa
	}

	// ===== หลัก: template + params → geometry (cut/fold แยกแล้ว) =====
	function compute(template, params, overrides) {
		var scope = buildScope(template, params)
		overrides = overrides || template.overrides || null
		var panels = template.panels.map(function (p) {
			var cmds = resolveOutline(p.outline, scope, overrides, p.id)
			return { id: p.id, cmds: cmds, segs: outlineToSegments(cmds) }
		})
		// นับขอบเส้นตรง: ปรากฏ 2 ครั้ง = รอยพับ, 1 ครั้ง = เส้นตัด
		var count = {}
		panels.forEach(function (pn) {
			pn.segs.forEach(function (s) {
				if (s.type === 'line') {
					var k = edgeKey(s.a, s.b)
					count[k] = (count[k] || 0) + 1
				}
			})
		})
		var cuts = [], folds = [], foldSeen = {}
		panels.forEach(function (pn) {
			pn.segs.forEach(function (s) {
				if (s.type === 'curve') { cuts.push(s); return }
				var k = edgeKey(s.a, s.b)
				if (count[k] >= 2) {                 // รอยพับ — วาดครั้งเดียว
					if (!foldSeen[k]) { foldSeen[k] = 1; folds.push(s) }
				} else cuts.push(s)                  // เส้นตัด
			})
		})
		// bounding box (ทุกจุด)
		var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
		function acc(p) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1] }
		panels.forEach(function (pn) { pn.segs.forEach(function (s) { acc(s.a); acc(s.b); if (s.pts) s.pts.forEach(acc) }) })
		return { scope: scope, panels: panels, cuts: cuts, folds: folds, bbox: { minX: minX, minY: minY, maxX: maxX, maxY: maxY } }
	}

	// ===== transform world(mm, y-up) <-> viewBox(svg, y-down) =====
	function viewTransform(geo, margin) {
		var bb = geo.bbox, m = (margin != null ? margin : 12)
		return {
			m: m, W: (bb.maxX - bb.minX) + m * 2, H: (bb.maxY - bb.minY) + m * 2,
			X: function (x) { return (x - bb.minX) + m },          // world x -> vb x
			Y: function (y) { return (bb.maxY - y) + m },          // world y -> vb y (flip)
			invX: function (vx) { return vx - m + bb.minX },       // vb x -> world x
			invY: function (vy) { return bb.maxY - (vy - m) }      // vb y -> world y
		}
	}

	// ===== สร้าง SVG (y กลับด้านให้ขึ้นบน), cut=ทึบ fold=ประ =====
	function toSVG(geo, opt) {
		opt = opt || {}
		var tr = viewTransform(geo, opt.margin)
		var W = tr.W, H = tr.H, X = tr.X, Y = tr.Y
		function segPath(s) {
			if (s.type === 'line') return 'M ' + X(s.a[0]) + ' ' + Y(s.a[1]) + ' L ' + X(s.b[0]) + ' ' + Y(s.b[1])
			var d = 'M ' + X(s.pts[0][0]) + ' ' + Y(s.pts[0][1])
			for (var i = 1; i < s.pts.length; i++) d += ' L ' + X(s.pts[i][0]) + ' ' + Y(s.pts[i][1])
			return d
		}
		var cutD = geo.cuts.map(segPath).join(' ')
		var foldD = geo.folds.map(segPath).join(' ')
		var sw = opt.strokeWidth || Math.max(W, H) * 0.0016
		return '' +
			'<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" ' +
			'style="position:absolute;inset:0;width:100%;height:100%;overflow:visible">' +
			'<path d="' + foldD + '" fill="none" stroke="' + (opt.foldColor || '#1769ff') + '" ' +
			'stroke-width="' + sw + '" stroke-dasharray="' + (sw * 4) + ' ' + (sw * 3) + '"/>' +
			'<path d="' + cutD + '" fill="none" stroke="' + (opt.cutColor || '#e11d48') + '" stroke-width="' + sw + '"/>' +
			'</svg>'
	}

	global.DielineEngine = { evalF: evalF, compute: compute, toSVG: toSVG, buildScope: buildScope, viewTransform: viewTransform }
})(window);
