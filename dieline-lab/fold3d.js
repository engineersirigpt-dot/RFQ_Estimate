/*
 * dieline-lab/fold3d.js
 * ----------------------------------------------------------------------------
 * พับ dieline เป็น 3D จาก "ข้อมูลชุดเดียวกับ SVG 2D" (geo จาก DielineEngine.compute)
 *
 * หลักการ (general edge-fold — พับรอบขอบไหนก็ได้ ไม่จำกัดแกน x/y):
 *   1. หา adjacency: ขอบเส้นตรงที่ panel 2 ชิ้นใช้ร่วมกัน = บานพับ
 *   2. สร้าง fold-tree (BFS จาก root)
 *   3. แต่ละ panel = ShapeGeometry ใน "เฟรมท้องถิ่น" (ขอบบานพับวางที่ origin ตามแกน +x)
 *      → ห่อด้วย jointGroup (วางตำแหน่ง+หันตามขอบ) + foldGroup (หมุนพับรอบแกน x)
 *   4. setFold(t): หมุน foldGroup ทุกตัว (สตักเกอร์ตามชั้น)
 */
(function (global) {
	'use strict'
	var HALF = Math.PI / 2

	function ekey(a, b) {
		var r = function (n) { return Math.round(n * 2) / 2 }
		var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1])
		return (pa < pb) ? pa + '|' + pb : pb + '|' + pa
	}

	// outline ของ panel → จุดต่อเนื่อง (สุ่มเส้นโค้ง)
	function panelPolygon(panel) {
		var pts = []
		panel.segs.forEach(function (s) {
			if (s.type === 'line') pts.push(s.a)
			else for (var i = 0; i < s.pts.length - 1; i++) pts.push(s.pts[i])
		})
		return pts
	}

	function worldToLocal(f, P) {
		var dx = P[0] - f.ox, dy = P[1] - f.oy
		var c = Math.cos(-f.ang), s = Math.sin(-f.ang)
		return [dx * c - dy * s, dx * s + dy * c]
	}

	// สร้าง fold-tree จาก adjacency
	function buildTree(geo, rootId) {
		var edgeMap = {}
		geo.panels.forEach(function (p, pi) {
			p.segs.forEach(function (s) {
				if (s.type !== 'line') return
				var k = ekey(s.a, s.b)
				;(edgeMap[k] = edgeMap[k] || []).push({ pi: pi, a: s.a, b: s.b })
			})
		})
		var adj = geo.panels.map(function () { return [] })
		Object.keys(edgeMap).forEach(function (k) {
			var e = edgeMap[k]
			if (e.length === 2) {
				adj[e[0].pi].push({ nb: e[1].pi, A: e[0].a, B: e[0].b })
				adj[e[1].pi].push({ nb: e[0].pi, A: e[0].a, B: e[0].b })
			}
		})
		// centroid ของแต่ละ panel (ไว้ orient hinge ให้พับทางเดียวกัน)
		var cent = geo.panels.map(function (p) {
			var sx = 0, sy = 0, n = 0
			p.segs.forEach(function (s) { sx += s.a[0]; sy += s.a[1]; n++ })
			return [sx / n, sy / n]
		})
		var rootIdx = 0
		geo.panels.forEach(function (p, i) { if (p.id === rootId) rootIdx = i })
		var nodes = geo.panels.map(function (p, i) { return { idx: i, id: p.id, children: [], hinge: null } })
		var visited = {}; visited[rootIdx] = 1
		var q = [rootIdx]
		while (q.length) {
			var cur = q.shift()
			adj[cur].forEach(function (e) {
				if (!visited[e.nb]) {
					visited[e.nb] = 1
					// orient A→B ให้ centroid ของลูกอยู่ "ด้านซ้าย" (cross>0) → พับทิศเดียวกันหมด
					var A = e.A, B = e.B, c = cent[e.nb]
					var cross = (B[0] - A[0]) * (c[1] - A[1]) - (B[1] - A[1]) * (c[0] - A[0])
					if (cross < 0) { var t = A; A = B; B = t }
					nodes[e.nb].hinge = { A: A, B: B }
					nodes[cur].children.push(nodes[e.nb])
					q.push(e.nb)
				}
			})
		}
		return nodes[rootIdx]
	}

	// สร้างกลุ่ม 3D + รายการ fold
	function build3D(geo, opt) {
		opt = opt || {}
		var THREE = global.THREE
		var mat = new THREE.MeshStandardMaterial({ color: opt.color || 0xf2ead6, side: THREE.DoubleSide, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
		var cutMat = new THREE.LineBasicMaterial({ color: 0xdd1111 })
		var foldMat = new THREE.LineBasicMaterial({ color: 0x11aa33 })
		function ekeyG(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }
		var ecount = {}
		geo.panels.forEach(function (p) { p.segs.forEach(function (s) { var k = ekeyG(s.a, s.b); ecount[k] = (ecount[k] || 0) + 1 }) })
		var sign = (opt.sign != null) ? opt.sign : 1
		var root = buildTree(geo, opt.root || 'L1')
		var folds = []
		var maxDepth = 1

		function pArea(panel) { var s = 0; panel.segs.forEach(function (e) { s += e.a[0] * e.b[1] - e.b[0] * e.a[1] }); return Math.abs(s / 2) }
		var rootArea = 0;
		function buildPanel(node, parentFrame, container, depth, parentArea) {
			if (depth > maxDepth) maxDepth = depth
			var panel = geo.panels[node.idx]
			var myArea = pArea(panel)
			if (depth === 0) rootArea = myArea
			// ลิ้นในของถาด (double-wall): leaf + ลึก + ใหญ่กว่าผนัง → พับกลับ ~180° (ไม่ใช่ 90°)
			var isLip = node.hinge && node.children.length === 0 && depth >= 2 && parentArea > 0 && myArea >= 0.8 * parentArea
			// ฝากล่อง (lid): ไม่ใช่ leaf + ลึก + ใหญ่ ~เท่าพื้น → พับน้อย "เปิดค้าง"
			var isLid = opt.type === 7 && node.hinge && node.children.length > 0 && depth >= 2 && rootArea > 0 && myArea >= 0.65 * rootArea
			var fAngle = isLip ? Math.PI * 0.97 : (isLid ? HALF * 0.4 : HALF)
			var frame = node.hinge
				? { ox: node.hinge.A[0], oy: node.hinge.A[1], ang: Math.atan2(node.hinge.B[1] - node.hinge.A[1], node.hinge.B[0] - node.hinge.A[0]) }
				: { ox: 0, oy: 0, ang: 0 }
			var shape = new THREE.Shape(), cutV = [], foldV = []
			panel.segs.forEach(function (s, i) {
				var la = worldToLocal(frame, s.a), lb = worldToLocal(frame, s.b)
				if (i === 0) shape.moveTo(la[0], la[1])
				shape.lineTo(lb[0], lb[1])
				var arr = (ecount[ekeyG(s.a, s.b)] >= 2) ? foldV : cutV
				arr.push(new THREE.Vector3(la[0], la[1], 0), new THREE.Vector3(lb[0], lb[1], 0))
			})
			var mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat)
			if (cutV.length) mesh.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cutV), cutMat))
			if (foldV.length) mesh.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(foldV), foldMat))

			var nextContainer
			if (node.hinge) {
				var aP = worldToLocal(parentFrame, node.hinge.A)
				var joint = new THREE.Group()
				joint.position.set(aP[0], aP[1], 0)
				joint.rotation.z = frame.ang - parentFrame.ang
				var fold = new THREE.Group()
				joint.add(fold); fold.add(mesh)
				container.add(joint)
				folds.push({ grp: fold, depth: depth, role: panel.role, angle: fAngle, sign: sign, leaf: node.children.length === 0, mesh: mesh })
				nextContainer = fold
			} else {
				var g = new THREE.Group(); g.add(mesh); container.add(g)
				nextContainer = g
			}
			node.children.forEach(function (c) { buildPanel(c, frame, nextContainer, depth + 1, myArea) })
		}

		var holder = new THREE.Group()
		buildPanel(root, { ox: 0, oy: 0, ang: 0 }, holder, 0, 0)

		// normalize scale + center
		var box = new THREE.Box3().setFromObject(holder)
		var size = box.getSize(new THREE.Vector3())
		var s = 1 / Math.max(size.x, size.y, size.z, 1)
		holder.scale.set(s, s, s)

		function setFold(t) {
			t = Math.max(0, Math.min(1, t))
			folds.forEach(function (f) {
				var p0 = maxDepth > 0 ? (f.depth - 1) / maxDepth * 0.5 : 0
				var local = Math.max(0, Math.min(1, (t - p0) / 0.5))
				var eased = local * local * (3 - 2 * local)
				f.grp.rotation.x = eased * (f.angle || HALF) * f.sign
			})
		}
		// ปีก (leaf) พับเข้าหาจุดกลางกล่อง → lock เข้าหากัน, ทิศสม่ำเสมอ (ทุกทรง)
		setFold(1); holder.updateMatrixWorld(true);
		var _bc = new THREE.Box3().setFromObject(holder).getCenter(new THREE.Vector3());
		folds.forEach(function (f) {
			if (!f.leaf || !f.mesh) return;
			f.mesh.geometry.computeBoundingBox();
			var lc0 = f.mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
			function dist(sgn) { f.grp.rotation.x = (f.angle || HALF) * sgn; holder.updateMatrixWorld(true); var c = lc0.clone(); f.mesh.localToWorld(c); return c.distanceTo(_bc); }
			var dp = dist(f.sign), dn = dist(-f.sign);
			if (dn < dp) f.sign = -f.sign;
		});
		setFold(0)
		return { group: holder, folds: folds, setFold: setFold, maxDepth: maxDepth }
	}

	global.Fold3D = { build3D: build3D, buildTree: buildTree }
})(window);
