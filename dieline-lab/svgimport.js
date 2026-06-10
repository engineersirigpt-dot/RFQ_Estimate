/*
 * dieline-lab/svgimport.js
 * ----------------------------------------------------------------------------
 * แปลง SVG จาก DiecutTemplates API → panels + รอยพับ (รูปแบบเดียวกับ engine.compute)
 * เพื่อส่งต่อให้ fold3d พับ 3D และวาด 2D ได้
 *
 * โครงสร้าง SVG ที่รองรับ:
 *   <g id="crease"> ... </g>  = เส้นพับ (stroke เขียว)
 *   <g id="cut">    ... </g>  = เส้นตัด (เส้นตรง + Arc)
 *   <g id="dimensions"> ... </g> = ข้ามไป
 *
 * วิธี: parse เส้นทั้งหมด → snap จุดใกล้กัน (รวม sliver จาก material gap)
 *       → สร้าง planar graph → หา "หน้า" (face) = panel → fold3d ใช้ต่อ
 */
(function (global) {
	'use strict'

	// ---------- parse path d="..." (รองรับ command ติดเลข เช่น "M351.4") ----------
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
				arcPts(cur, rx, ry, rot, large, sweep, p2).forEach(function (seg) { out.push(seg) })
				cur = p2
			}
			else { i++ }
		}
		return out
	}

	// ---------- sample SVG arc → line segments ----------
	function arcPts(p0, rx, ry, phi, large, sweep, p1, n) {
		n = n || 10
		phi = phi * Math.PI / 180
		var cosP = Math.cos(phi), sinP = Math.sin(phi)
		var dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2
		var x1 = cosP * dx + sinP * dy, y1 = -sinP * dx + cosP * dy
		rx = Math.abs(rx); ry = Math.abs(ry)
		var lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry)
		if (lam > 1) { var s = Math.sqrt(lam); rx *= s; ry *= s }
		var sign = (large !== sweep) ? 1 : -1
		var num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
		var den = rx * rx * y1 * y1 + ry * ry * x1 * x1
		var co = sign * Math.sqrt(Math.max(0, num / den))
		var cxp = co * rx * y1 / ry, cyp = -co * ry * x1 / rx
		var cx = cosP * cxp - sinP * cyp + (p0[0] + p1[0]) / 2
		var cy = sinP * cxp + cosP * cyp + (p0[1] + p1[1]) / 2
		function ang(ux, uy, vx, vy) {
			var d = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
			var a = Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / d)))
			return (ux * vy - uy * vx < 0) ? -a : a
		}
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

	// ---------- ดึง segment จากกลุ่ม (crease/cut) ----------
	function extractGroup(svg, id) {
		var re = new RegExp('<g[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</g>')
		var m = re.exec(svg); if (!m) return []
		var body = m[1], segs = [], pm, pre = /\sd="([^"]+)"/g   // \s กันไปแมตช์ id="..."
		while ((pm = pre.exec(body))) parsePath(pm[1]).forEach(function (s) { segs.push(s) })
		return segs
	}

	// ---------- snap จุดใกล้กัน (รวม material sliver) ----------
	function snapVerts(segs, tol) {
		tol = tol || 2.0
		var reps = []   // ตัวแทนจุด
		function rep(p) {
			for (var i = 0; i < reps.length; i++) {
				if (Math.abs(reps[i][0] - p[0]) <= tol && Math.abs(reps[i][1] - p[1]) <= tol) return reps[i]
			}
			var r = [p[0], p[1]]; reps.push(r); return r
		}
		segs.forEach(function (s) { s.a = rep(s.a); s.b = rep(s.b) })
		// ตัด segment ที่ยาว ~0 (จาก snap)
		return segs.filter(function (s) { return Math.abs(s.a[0] - s.b[0]) > tol * 0.5 || Math.abs(s.a[1] - s.b[1]) > tol * 0.5 })
	}

	function vkey(p) { return Math.round(p[0]) + ',' + Math.round(p[1]) }

	// ตัดเส้นที่ "T-junction" (จุดยอดของเส้นอื่นอยู่กลางเส้นนี้) → ทำให้ planar graph ปิดหน้าได้
	function nodeSegments(segs) {
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
			cuts.forEach(function (c) { out.push({ type: 'line', a: prev, b: c.p, crease: s.crease }); prev = c.p })
			out.push({ type: 'line', a: prev, b: s.b, crease: s.crease })
		})
		return out
	}

	// ---------- หา faces จาก planar graph (half-edge) ----------
	function findFaces(segs) {
		// vertices
		var vmap = {}, verts = []
		function vid(p) { var k = vkey(p); if (vmap[k] == null) { vmap[k] = verts.length; verts.push([p[0], p[1]]) } return vmap[k] }
		// undirected edges (dedup) + crease flag
		var emap = {}, edges = []
		segs.forEach(function (s) {
			var u = vid(s.a), v = vid(s.b); if (u === v) return
			var k = u < v ? u + '_' + v : v + '_' + u
			if (emap[k] == null) { emap[k] = edges.length; edges.push({ u: u, v: v, crease: !!s.crease }) }
			else if (s.crease) edges[emap[k]].crease = true
		})
		// darts (directed) + per-vertex sorted by angle
		var darts = [], outAt = verts.map(function () { return [] })
		edges.forEach(function (e) {
			var d1 = { from: e.u, to: e.v, edge: e }, d2 = { from: e.v, to: e.u, edge: e }
			d1.twin = d2; d2.twin = d1
			d1.ang = Math.atan2(verts[e.v][1] - verts[e.u][1], verts[e.v][0] - verts[e.u][0])
			d2.ang = Math.atan2(verts[e.u][1] - verts[e.v][1], verts[e.u][0] - verts[e.v][0])
			darts.push(d1, d2); outAt[e.u].push(d1); outAt[e.v].push(d2)
		})
		outAt.forEach(function (lst) { lst.sort(function (a, b) { return a.ang - b.ang }) })
		// next dart in face: arrive at v via dart d (from→to=v); reverse = to→from; next = CW neighbor of reverse
		function nextDart(d) {
			var v = d.to, lst = outAt[v]
			// หา dart ที่เป็นทิศย้อนกลับ (v→from)
			var revAng = Math.atan2(verts[d.from][1] - verts[v][1], verts[d.from][0] - verts[v][0])
			var idx = -1
			for (var i = 0; i < lst.length; i++) { if (lst[i].to === d.from) { idx = i; break } }
			if (idx < 0) { // fallback by angle
				for (var j = 0; j < lst.length; j++) if (Math.abs(lst[j].ang - revAng) < 1e-6) { idx = j; break }
			}
			return lst[(idx - 1 + lst.length) % lst.length]
		}
		// traverse faces
		var used = {}, faces = []
		darts.forEach(function (d, di) { d._i = di })
		darts.forEach(function (d) {
			if (used[d._i]) return
			var face = [], cur = d, guard = 0
			do {
				used[cur._i] = 1; face.push(cur.from); cur = nextDart(cur)
				if (++guard > 1000) break
			} while (cur._i !== d._i)
			if (face.length >= 3) faces.push(face)
		})
		// signed area
		function area(f) { var s = 0; for (var i = 0; i < f.length; i++) { var a = verts[f[i]], b = verts[f[(i + 1) % f.length]]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
		var withArea = faces.map(function (f) { return { f: f, a: area(f) } })
		// outer face = พื้นที่ติดลบมากสุด (หรือบวกมากสุด ขึ้นกับ winding) → ตัดตัวที่ |area| ใหญ่สุดออก
		withArea.sort(function (x, y) { return Math.abs(y.a) - Math.abs(x.a) })
		var outer = withArea[0]
		var inner = withArea.filter(function (w) { return w !== outer && Math.abs(w.a) > 1 })
		return { verts: verts, faces: inner.map(function (w) { return w.f }), all: withArea }
	}

	// ---------- หลัก: SVG text → geo (panels/bbox) ----------
	function fromSVG(svgText, opt) {
		opt = opt || {}
		var creaseSegs = extractGroup(svgText, 'crease').map(function (s) { s.crease = true; return s })
		var cutSegs = extractGroup(svgText, 'cut').map(function (s) { s.crease = false; return s })
		var all = creaseSegs.concat(cutSegs)
		// flip y (SVG y-down → world y-up)
		all.forEach(function (s) { s.a = [s.a[0], -s.a[1]]; s.b = [s.b[0], -s.b[1]] })
		all = snapVerts(all, opt.tol || 2.0)
		all = nodeSegments(all)            // ตัด T-junction ก่อนหา face
		var res = findFaces(all)
		// faces → panels (segs)
		var panels = res.faces.map(function (f, i) {
			var segs = []
			for (var k = 0; k < f.length; k++) {
				var a = res.verts[f[k]], b = res.verts[f[(k + 1) % f.length]]
				segs.push({ type: 'line', a: [a[0], a[1]], b: [b[0], b[1]] })
			}
			return { id: 'p' + i, segs: segs, area: 0 }
		})
		// bbox + cut/fold สำหรับวาด 2D (cut=ขอบเดี่ยว, fold=ขอบที่ 2 panel แชร์)
		var geo = assembleGeo(panels)
		geo.rootId = pickRoot(panels)
		return geo
	}

	// เลือก root = "ผนัง" (สูงเท่ากล่อง) ที่มีผนังเพื่อนบ้านมากสุด → กล่องตั้ง ฝา tuck พับปิดได้
	// (ถ้า root เป็นผนังที่มี tuck ฝาจะตั้งชี้ขึ้นไม่ปิด)
	function pickRoot(panels) {
		var info = panels.map(function (p) {
			var xs = p.segs.map(function (s) { return s.a[0] }), ys = p.segs.map(function (s) { return s.a[1] })
			return { h: Math.max.apply(0, ys) - Math.min.apply(0, ys), a: Math.abs(polyArea(p.segs)) }
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
			// มากสุด: ผนังเพื่อนบ้านเยอะ → ฝาเพื่อนบ้านเตี้ย (ไม่ใช่ tuck) → area
			var score = wn * 1e9 - maxFlap * 1e3 + info[i].a
			if (score > bestScore) { bestScore = score; bestI = i }
		})
		return panels[bestI].id
	}

	function polyArea(segs) { var s = 0; segs.forEach(function (e) { s += e.a[0] * e.b[1] - e.b[0] * e.a[1] }); return s / 2 }

	function ekey(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }

	function assembleGeo(panels) {
		var count = {}
		panels.forEach(function (p) { p.segs.forEach(function (s) { var k = ekey(s.a, s.b); count[k] = (count[k] || 0) + 1 }) })
		var cuts = [], folds = [], seen = {}
		panels.forEach(function (p) {
			p.segs.forEach(function (s) {
				var k = ekey(s.a, s.b)
				if (count[k] >= 2) { if (!seen[k]) { seen[k] = 1; folds.push(s) } }
				else cuts.push(s)
			})
		})
		var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9
		panels.forEach(function (p) { p.segs.forEach(function (s) {[s.a, s.b].forEach(function (q) { if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0]; if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1] }) }) })
		return { panels: panels, cuts: cuts, folds: folds, bbox: { minX: minX, minY: minY, maxX: maxX, maxY: maxY } }
	}

	global.SVGImport = { fromSVG: fromSVG, parsePath: parsePath, extractGroup: extractGroup }
})(typeof window !== 'undefined' ? window : globalThis);
