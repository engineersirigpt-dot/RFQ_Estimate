/*
 * Dieline v2 — สร้าง dieline เองจากสูตร (ฟรี ไม่ใช้ API ภายนอก ไม่มี AI เดา)
 * วาด SVG vector จากค่า W/L/D/ฝา(T)/กาว(G)/ปีก(dust) ที่กรอกจริง — deterministic math ล้วน
 * เพิ่มปุ่ม "Dieline v2 (ฟรี)" ข้างปุ่ม "สร้างไดไล" (v1) เพื่อกดเทียบกันได้
 */
(function () {
	'use strict';
	console.log('[dieline-v2] generator script loaded ✅');

	var _hiDim = null;       // ไฮไลต์เส้นบอกขนาด: 'A'(ยาว/L) | 'B'(กว้าง/W) | 'C'(สูง/D) | null
	var _lineOnly = false;   // โหมดเส้นล้วน (ไม่ใส่สีพื้น) แบบ v1
	var _showDims = true;    // โชว์เส้นบอกขนาด (เปิด/ปิดได้)
	var _showGrain = true;   // โชว์ทิศเส้นใยกระดาษ (GRAIN) — วิ่งแนวนอน (ด้าน L)
	var _bg = 'white';       // พื้นหลังปัจจุบัน — ใช้เลือกสี GRAIN ให้อ่านชัด
	var _margins = { gripper: 12, colorbar: 8, edge: 4 };   // ระยะเว้นเลย์ (mm) — gripper/color bar/paper edge

	function r(v) { return Math.round(v * 100) / 100 }
	function grainArrow(bw, y, fsIn) {
		var fs = fsIn || Math.max(bw * 0.022, 9), ls = 3;
		var textHalf = (5 * fs * 0.65 + 5 * ls) / 2;
		var gap = textHalf + fs * 1.5;
		var cx = bw / 2, half = Math.max(bw * 0.17, gap + fs * 2.2);
		var x1 = cx - half, x2 = cx + half;
		var ah = Math.max(bw * 0.014, 5), lw = Math.max(ah * 0.24, 0.9);
		var col = _bg === 'black' ? '#c4b5fd' : (_bg === 'gray' ? '#2e1065' : '#7c3aed');
		var gl = cx - gap, gr = cx + gap;
		var ahS = ' fill="' + col + '" stroke="' + col + '" stroke-width="' + r(lw * 0.9) + '" stroke-linejoin="round"/>';
		var s = '';
		s += '<line x1="' + r(x1 + ah * 0.9) + '" y1="' + r(y) + '" x2="' + r(gl) + '" y2="' + r(y) + '" stroke="' + col + '" stroke-width="' + r(lw) + '" stroke-linecap="round"/>';
		s += '<line x1="' + r(gr) + '" y1="' + r(y) + '" x2="' + r(x2 - ah * 0.9) + '" y2="' + r(y) + '" stroke="' + col + '" stroke-width="' + r(lw) + '" stroke-linecap="round"/>';
		s += '<path d="M ' + r(x1) + ' ' + r(y) + ' L ' + r(x1 + ah) + ' ' + r(y - ah * 0.58) + ' L ' + r(x1 + ah) + ' ' + r(y + ah * 0.58) + ' Z"' + ahS;
		s += '<path d="M ' + r(x2) + ' ' + r(y) + ' L ' + r(x2 - ah) + ' ' + r(y - ah * 0.58) + ' L ' + r(x2 - ah) + ' ' + r(y + ah * 0.58) + ' Z"' + ahS;
		s += '<text x="' + r(cx) + '" y="' + r(y) + '" font-size="' + r(fs) + '" fill="' + col + '" text-anchor="middle" dominant-baseline="central" font-family="Prompt, sans-serif" font-weight="bold" letter-spacing="3">GRAIN</text>';
		return s;
	}

	// อ่านขนาดสด (ใช้ตัวเดียวกับ 3D ถ้ามี ไม่งั้น fallback อ่านฟอร์มตรง)
	function readDimsSafe() {
		try { if (window.__dieline3d && window.__dieline3d.readDims) return window.__dieline3d.readDims(0) } catch (e) { }
		var $i = $('.inputType[index="0"]');
		function num(sel, d) { var v = parseFloat($i.find(sel).val()); return isNaN(v) ? d : v }
		return {
			type: parseInt($('.boxType[index="0"]').val()) || 1,
			W: num('.specmm.width', null), L: num('.specmm.length', null), D: num('.specmm.depth', null),
			T: num('.specmm.tuck', 15), G: num('.specmm.glue', 10), dust: num('.specmm.dust', 8), OL: num('.specmm.ol', 5)
		};
	}

	// ===== SVG helpers =====
	// ===== สีมาตรฐานแบบ v1: แดง=เส้นตัด, เขียว=เส้นพับ =====
	var CUT = '#dc2626', FOLD = '#16a34a', FILL = '#fdfdfe', PERF = '#eab308';   // PERF = เส้นปรุ (perforation) เหลืองเข้ม
	function rectCut(x, y, w, h, fill) {
		if (w <= 0 || h <= 0) return '';
		return '<rect x="' + r(x) + '" y="' + r(y) + '" width="' + r(w) + '" height="' + r(h) +
			'" fill="' + (fill || FILL) + '" stroke="' + CUT + '" stroke-width="1" />';
	}
	function pathCut(dStr, fill) {
		return '<path d="' + dStr + '" fill="' + (fill || FILL) + '" stroke="' + CUT + '" stroke-width="1" stroke-linejoin="round" />';
	}
	function foldLine(x1, y1, x2, y2) {  // เส้นพับ = เขียวประ
		return '<line x1="' + r(x1) + '" y1="' + r(y1) + '" x2="' + r(x2) + '" y2="' + r(y2) +
			'" stroke="' + FOLD + '" stroke-width="1" stroke-dasharray="7,4" />';
	}
	function label(x, y, txt, size) {
		return '<text x="' + r(x) + '" y="' + r(y) + '" font-size="' + (size || 9) +
			'" fill="#475569" text-anchor="middle" dominant-baseline="middle" font-family="Prompt, sans-serif">' + txt + '</text>';
	}
	// เส้นบอกขนาด (dimension) แนวนอน — มีหัวลูกศร + ค่า mm
	function dimH(x1, x2, y, value, fs, hi) {
		var aw = Math.max((x2 - x1) * 0.015, 2.5), col = hi ? '#2563eb' : '#dc2626', sw = hi ? 1.8 : 0.8;
		return '<line x1="' + r(x1) + '" y1="' + r(y) + '" x2="' + r(x2) + '" y2="' + r(y) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x1) + '" y1="' + r(y - aw) + '" x2="' + r(x1) + '" y2="' + r(y + aw) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x2) + '" y1="' + r(y - aw) + '" x2="' + r(x2) + '" y2="' + r(y + aw) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<text x="' + r((x1 + x2) / 2) + '" y="' + r(y - aw * 1.8) + '" font-size="' + r(hi ? fs * 1.18 : fs) + '" fill="' + (hi ? '#2563eb' : '#dc2626') + '" text-anchor="middle" font-family="Prompt, sans-serif" font-weight="' + (hi ? 'bold' : 'normal') + '">' + value.toFixed(2) + ' mm</text>';
	}
	// เส้นบอกขนาด แนวตั้ง
	function dimV(y1, y2, x, value, fs, hi) {
		var aw = Math.max((y2 - y1) * 0.015, 2.5), tx = x - aw * 1.8, ty = (y1 + y2) / 2, col = hi ? '#2563eb' : '#dc2626', sw = hi ? 1.8 : 0.8;
		return '<line x1="' + r(x) + '" y1="' + r(y1) + '" x2="' + r(x) + '" y2="' + r(y2) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x - aw) + '" y1="' + r(y1) + '" x2="' + r(x + aw) + '" y2="' + r(y1) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x - aw) + '" y1="' + r(y2) + '" x2="' + r(x + aw) + '" y2="' + r(y2) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<text x="' + r(tx) + '" y="' + r(ty) + '" font-size="' + r(hi ? fs * 1.18 : fs) + '" fill="' + (hi ? '#2563eb' : '#dc2626') + '" text-anchor="middle" font-family="Prompt, sans-serif" font-weight="' + (hi ? 'bold' : 'normal') + '" transform="rotate(-90 ' + r(tx) + ' ' + r(ty) + ')">' + value.toFixed(2) + ' mm</text>';
	}
	// เส้นบอกขนาดแนวนอน (ข้อความอยู่ใต้เส้น) — ใช้กับ per-panel
	function dimHb(x1, x2, y, value, fs, hi) {
		var aw = Math.max((x2 - x1) * 0.04, 2.5), col = hi ? '#2563eb' : '#dc2626', sw = hi ? 1.7 : 0.7;
		return '<line x1="' + r(x1) + '" y1="' + r(y) + '" x2="' + r(x2) + '" y2="' + r(y) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x1) + '" y1="' + r(y - aw) + '" x2="' + r(x1) + '" y2="' + r(y + aw) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<line x1="' + r(x2) + '" y1="' + r(y - aw) + '" x2="' + r(x2) + '" y2="' + r(y + aw) + '" stroke="' + col + '" stroke-width="' + sw + '"/>' +
			'<text x="' + r((x1 + x2) / 2) + '" y="' + r(y + aw + fs) + '" font-size="' + r(hi ? fs * 1.18 : fs) + '" fill="' + (hi ? '#2563eb' : '#dc2626') + '" text-anchor="middle" font-family="Prompt, sans-serif" font-weight="' + (hi ? 'bold' : 'normal') + '">' + value.toFixed(1) + ' mm</text>';
	}
	// เลขบอกขนาดต่อ panel สำหรับทรงที่มีผนัง W|L|W|L (ใต้กล่อง = ความกว้าง panel, ขวา = ความสูง D)
	function wallRowDims(W, L, D, xP1, yWall, yWallBot, totalW, totalH) {
		if (!_showDims) return '';
		var Dc = yWallBot - yWall;
		var fs = Math.max(Math.min(W, L, Dc) * 0.13, 6.5);
		var s = '';
		// แนวนอน (ในกล่อง ใกล้ขอบล่างผนัง) — โชว์แค่ W (panel แรก) + L (panel ที่สอง) แบบ v1
		var yH = yWallBot - fs * 0.7;
		s += dimH(xP1, xP1 + W, yH, W, fs, _hiDim === 'B');        // W = B (กว้าง)
		s += dimH(xP1 + W, xP1 + W + L, yH, L, fs, _hiDim === 'A'); // L = A (ยาว)
		// แนวตั้ง D (ในผนัง L ขวาสุด)
		s += dimV(yWall, yWallBot, xP1 + 2 * W + 1.5 * L, D, fs, _hiDim === 'C'); // D = C (สูง)
		return s;
	}
	// ฝาเสียบ: มีไหล่ล็อก (shoulders) + คอสอบ + มุมบนโค้ง — ใกล้แบบ v1 (dir -1=ขึ้น, +1=ลง)
	function tuckFlap(x, w, yBase, h, dir) {
		var sh = Math.max(2, Math.min(h * 0.22, 8));           // ความสูงไหล่ล็อก
		var neck = w * 0.12;                                    // คอสอบเข้าข้างละ
		var rad = Math.max(2, Math.min((w - 2 * neck) * 0.14, (h - sh) * 0.5, 10));
		var yS = yBase + dir * sh, yT = yBase + dir * h, yc = yBase + dir * (h - rad);
		var xl = x + neck, xr = x + w - neck;
		var dd = ['M', r(x), r(yBase),
			'L', r(x), r(yS), 'L', r(xl), r(yS),
			'L', r(xl), r(yc), 'Q', r(xl), r(yT), r(xl + rad), r(yT),
			'L', r(xr - rad), r(yT), 'Q', r(xr), r(yT), r(xr), r(yc),
			'L', r(xr), r(yS), 'L', r(x + w), r(yS),
			'L', r(x + w), r(yBase), 'Z'].join(' ');
		return pathCut(dd, '#ffffff');
	}
	// ปีกกล่อง: trapezoid สอบคม (มุมเฉียงชัด) — ใกล้แบบ v1 (dir -1=ขึ้น, +1=ลง)
	function dustFlap(x, w, yBase, h, dir) {
		var t = w * 0.32, yT = yBase + dir * h;
		var dd = ['M', r(x), r(yBase), 'L', r(x + t), r(yT), 'L', r(x + w - t), r(yT), 'L', r(x + w), r(yBase), 'Z'].join(' ');
		return pathCut(dd, '#fefce8');
	}
	// ลิ้นกาว: tapered — fold ที่ x=xFold, free edge ที่ xFold-G
	function glueTab(xFold, G, yTop, D) {
		var t = D * 0.1;
		var dd = ['M', r(xFold), r(yTop), 'L', r(xFold - G), r(yTop + t), 'L', r(xFold - G), r(yTop + D - t), 'L', r(xFold), r(yTop + D), 'Z'].join(' ');
		return pathCut(dd, '#eef2ff');
	}

	// ===== RTE / STE (type 1,2) — open size = 2(W+L)+G × 2(W+T)+D =====
	function buildRTE(d) {
		var W = d.W, L = d.L, D = d.D, T = d.T, G = d.G, dust = d.dust;
		var totalW = G + 2 * W + 2 * L, totalH = D + 2 * (W + T);
		var xP1 = G, xP2 = G + W, xP3 = G + W + L, xP4 = G + 2 * W + L;
		var yMainTop = T, yWall = T + W, yWallBot = T + W + D;
		var s = '';
		// ลิ้นกาว + ผนัง 4 ด้าน (สูง D)
		s += glueTab(G, G, yWall, D);
		s += rectCut(xP1, yWall, W, D);
		s += rectCut(xP2, yWall, L, D, '#eff6ff');
		s += rectCut(xP3, yWall, W, D);
		s += rectCut(xP4, yWall, L, D, '#eff6ff');
		// ฝาบน (บนผนัง L หลัง) + ลิ้นเสียบ
		s += rectCut(xP2, yMainTop, L, W, '#ffffff');
		s += tuckFlap(xP2, L, yMainTop, T, -1);
		// ฝาล่าง (บนผนัง L หน้า) + ลิ้นเสียบ — RTE สลับด้าน
		s += rectCut(xP4, yWallBot, L, W, '#ffffff');
		s += tuckFlap(xP4, L, yWallBot + W, T, 1);
		// ปีกกล่อง (dust) บนผนัง W บน/ล่าง — เฉียงสอบ
		s += dustFlap(xP1, W, yWall, dust, -1); s += dustFlap(xP3, W, yWall, dust, -1);
		s += dustFlap(xP1, W, yWallBot, dust, 1); s += dustFlap(xP3, W, yWallBot, dust, 1);
		// เส้นพับ (เขียวประ)
		[xP1, xP2, xP3, xP4].forEach(function (x) { s += foldLine(x, yWall, x, yWallBot) });
		s += foldLine(xP2, yWall, xP2 + L, yWall);
		s += foldLine(xP2, yMainTop, xP2 + L, yMainTop);
		s += foldLine(xP4, yWallBot, xP4 + L, yWallBot);
		s += foldLine(xP4, yWallBot + W, xP4 + L, yWallBot + W);
		s += foldLine(xP1, yWall, xP1 + W, yWall); s += foldLine(xP3, yWall, xP3 + W, yWall);
		s += foldLine(xP1, yWallBot, xP1 + W, yWallBot); s += foldLine(xP3, yWallBot, xP3 + W, yWallBot);
		// ป้ายกำกับ
		// (เลขขนาดแสดงด้วยเส้น dimension แทน — แบบ v1)
		s += label(G / 2, yWall + D / 2, 'กาว', 7);
		s += label(xP2 + L / 2, yMainTop + W / 2, 'ฝาบน', 8);
		s += label(xP4 + L / 2, yWallBot + W / 2, 'ฝาล่าง', 8);
		s += wallRowDims(W, L, D, xP1, yWall, yWallBot, totalW, totalH);
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Tuck Top Snap Lock (3) / Auto Bottom (4) — open size W=T+W+D+W/2+OL, L=2(W+L)+G =====
	function buildTuckTop(d, bottomStyle) {
		var W = d.W, L = d.L, D = d.D, T = d.T, G = d.G, dust = d.dust;
		var OL = d.OL || Math.max(8, W * 0.18);
		var botH = W / 2;
		var totalW = G + 2 * W + 2 * L, totalH = T + W + D + botH + OL;
		var xP1 = G, xP2 = G + W, xP3 = G + W + L, xP4 = G + 2 * W + L;
		var yTopMain = T, yWall = T + W, yWallBot = T + W + D, yBotEnd = T + W + D + botH;
		var s = '';
		// ลิ้นกาว + ผนัง 4 ด้าน
		s += glueTab(G, G, yWall, D);
		s += rectCut(xP1, yWall, W, D);
		s += rectCut(xP2, yWall, L, D, '#eff6ff');
		s += rectCut(xP3, yWall, W, D);
		s += rectCut(xP4, yWall, L, D, '#eff6ff');
		// ฝาบน (tuck top) บนผนัง L หลัง + ปีกข้าง
		s += rectCut(xP2, yTopMain, L, W, '#ffffff');
		s += tuckFlap(xP2, L, yTopMain, T, -1);
		s += dustFlap(xP1, W, yWall, dust, -1); s += dustFlap(xP3, W, yWall, dust, -1);
		// ก้นกล่อง (auto/snap) — แผ่นล่างทั้ง 4 ผนัง
		[[xP1, W], [xP2, L], [xP3, W], [xP4, L]].forEach(function (p) {
			var px = p[0], pw = p[1];
			s += pathCut(['M', r(px), r(yWallBot), 'L', r(px + pw * 0.1), r(yBotEnd),
				'L', r(px + pw * 0.9), r(yBotEnd), 'L', r(px + pw), r(yWallBot), 'Z'].join(' '), '#fff7ed');
			if (bottomStyle === 'auto') {           // TTAB: รอยพับทแยง (auto-lock)
				s += foldLine(px, yWallBot, px + pw / 2, yBotEnd);
				s += foldLine(px + pw, yWallBot, px + pw / 2, yBotEnd);
			} else {                                  // TTSLB: ก้นล็อก รอยพับกลาง
				s += foldLine(px + pw / 2, yWallBot, px + pw / 2, yBotEnd);
			}
			s += foldLine(px, yWallBot, px + pw, yWallBot);
		});
		// OL ลิ้นทากาว (เฉพาะ auto/TTAB) ใต้ผนัง L หลัง
		if (bottomStyle === 'auto') {
			s += pathCut(['M', r(xP2 + L * 0.22), r(yBotEnd), 'L', r(xP2 + L * 0.27), r(yBotEnd + OL),
				'L', r(xP2 + L * 0.73), r(yBotEnd + OL), 'L', r(xP2 + L * 0.78), r(yBotEnd), 'Z'].join(' '), '#fde68a');
			s += label(xP2 + L / 2, yBotEnd + OL / 2, 'OL', 7);
		}
		// เส้นพับผนัง + ฝาบน + ปีก
		[xP1, xP2, xP3, xP4].forEach(function (x) { s += foldLine(x, yWall, x, yWallBot); });
		s += foldLine(xP2, yWall, xP2 + L, yWall);
		s += foldLine(xP2, yTopMain, xP2 + L, yTopMain);
		s += foldLine(xP1, yWall, xP1 + W, yWall); s += foldLine(xP3, yWall, xP3 + W, yWall);
		// ป้ายกำกับ
		// (เลขขนาดแสดงด้วยเส้น dimension แทน — แบบ v1)
		s += label(G / 2, yWall + D / 2, 'กาว', 7);
		s += label(xP2 + L / 2, yTopMain + W / 2, 'ฝาบน', 8);
		s += label(G + (2 * W + 2 * L) / 2, yWallBot + botH * 0.55, bottomStyle === 'auto' ? 'ก้นทากาว (auto)' : 'ก้นล็อก (snap)', 8);
		s += wallRowDims(W, L, D, xP1, yWall, yWallBot, totalW, totalH);
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Tray (5) / Frame-Vue Tray (6) — ฐานกลาง + ผนัง 4 ด้าน + ปีกมุม =====
	//   type5 open: W=W+4D, L=L+4D+2dust ; type6 เพิ่มขอบ frame
	function buildTray(d, withFrame) {
		var W = d.W, L = d.L, D = d.D, dust = d.dust;
		var fr = withFrame ? (d.OL || Math.max(8, D * 0.5)) : 0;
		var totalW = W + 4 * D + (withFrame ? 2 * dust + 2 * fr : 0);
		var totalH = L + 4 * D + 2 * dust + (withFrame ? 2 * fr : 0);
		var bx = (totalW - W) / 2, by = (totalH - L) / 2;   // มุมบนซ้ายของฐาน
		var s = '';
		// ฐาน
		s += rectCut(bx, by, W, L, '#eff6ff');
		// ผนัง 4 ด้าน (D) ติดฐาน
		s += rectCut(bx, by - D, W, D, '#f8fafc');
		s += rectCut(bx, by + L, W, D, '#f8fafc');
		s += rectCut(bx - D, by, D, L, '#f8fafc');
		s += rectCut(bx + W, by, D, L, '#f8fafc');
		// แผ่นพับนอก (flange/ปะกาว) D
		s += rectCut(bx, by - 2 * D, W, D, '#fff7ed');
		s += rectCut(bx, by + L + D, W, D, '#fff7ed');
		s += rectCut(bx - 2 * D, by, D, L, '#fff7ed');
		s += rectCut(bx + W + D, by, D, L, '#fff7ed');
		// ปีกมุม 4 มุม + รอยพับทแยง
		[[bx - D, by - D], [bx + W, by - D], [bx - D, by + L], [bx + W, by + L]].forEach(function (c) {
			s += rectCut(c[0], c[1], D, D, '#fefce8');
			var ccx = c[0] + D / 2, ccy = c[1] + D / 2;
			var ix = (ccx < totalW / 2) ? c[0] + D : c[0], iy = (ccy < totalH / 2) ? c[1] + D : c[1];
			var ox = (ccx < totalW / 2) ? c[0] : c[0] + D, oy = (ccy < totalH / 2) ? c[1] : c[1] + D;
			s += foldLine(ix, iy, ox, oy);
		});
		// dust บน/ล่าง นอกสุด
		s += dustFlap(bx, W, by - 2 * D, dust, -1);
		s += dustFlap(bx, W, by + L + 2 * D, dust, 1);
		// เส้นพับ ฐาน↔ผนัง (เขียว)
		s += foldLine(bx, by, bx + W, by); s += foldLine(bx, by + L, bx + W, by + L);
		s += foldLine(bx, by, bx, by + L); s += foldLine(bx + W, by, bx + W, by + L);
		// ผนัง↔flange
		s += foldLine(bx, by - D, bx + W, by - D); s += foldLine(bx, by + L + D, bx + W, by + L + D);
		s += foldLine(bx - D, by, bx - D, by + L); s += foldLine(bx + W + D, by, bx + W + D, by + L);
		// ป้าย
		s += label(bx + W / 2, by + L / 2, 'ฐาน', 9);
		s += label(bx + W / 2, by - D / 2, 'ผนัง', 7);
		s += label(bx + W / 2, by + L + D / 2, 'ผนัง', 7);
		if (withFrame) s += label(totalW / 2, 11, 'Frame-Vue Tray — ถาดมีขอบ', 9);
		// เส้นบอกขนาด: W ฐาน (แนวนอน) · L ฐาน (แนวตั้ง) · D ผนัง (แนวตั้ง)
		if (_showDims) {
			var fsd = Math.max(Math.min(W, L, D) * 0.12, 7);
			s += dimH(bx, bx + W, by + fsd * 1.7, W, fsd, _hiDim === 'B');         // W = B (กว้าง)
			s += dimV(by, by + L, bx + fsd * 1.7, L, fsd, _hiDim === 'A');         // L = A (ยาว)
			s += dimV(by - D, by, bx + W * 0.5, D, fsd, _hiDim === 'C');           // D = C (สูง/ลึก)
		}
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Sleeve (type 9) — 4 ผนังเปล่า + ลิ้นกาว ไม่มีฝา =====
	function buildSleeve(d) {
		var W = d.W, L = d.L, D = d.D, G = d.G;
		var totalW = G + 2 * W + 2 * L, totalH = D;
		var s = glueTab(G, G, 0, D);
		s += rectCut(G, 0, W, D);
		s += rectCut(G + W, 0, L, D, '#eff6ff');
		s += rectCut(G + W + L, 0, W, D);
		s += rectCut(G + 2 * W + L, 0, L, D, '#eff6ff');
		[G, G + W, G + W + L, G + 2 * W + L].forEach(function (x) { s += foldLine(x, 0, x, D) });
		s += label(G / 2, D / 2, 'กาว', 7);
		// เส้นบอกขนาด W,L (D = ความสูง ดูจากขนาดรวมซ้าย) — กลางแถบ
		if (_showDims) {
			var fsd = Math.max(Math.min(W, L, D) * 0.16, 7);
			s += dimH(G, G + W, D * 0.62, W, fsd, _hiDim === 'B');           // W = B (กว้าง)
			s += dimH(G + W, G + W + L, D * 0.62, L, fsd, _hiDim === 'A');   // L = A (ยาว)
		}
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Seal End (type 11) — ฝาปิดทากาว (เหมือน RTE แต่ฝาเป็นแผ่นทากาว ไม่มีลิ้นเสียบ) =====
	//   open: W=2W+D, L=2(W+L)+G
	function buildSealEnd(d) {
		var W = d.W, L = d.L, D = d.D, G = d.G, dust = d.dust;
		var totalW = G + 2 * W + 2 * L, totalH = 2 * W + D;
		var xP1 = G, xP2 = G + W, xP3 = G + W + L, xP4 = G + 2 * W + L;
		var yMainTop = 0, yWall = W, yWallBot = W + D, yMainBot = W + D;
		var s = '';
		s += glueTab(G, G, yWall, D);
		s += rectCut(xP1, yWall, W, D);
		s += rectCut(xP2, yWall, L, D, '#eff6ff');
		s += rectCut(xP3, yWall, W, D);
		s += rectCut(xP4, yWall, L, D, '#eff6ff');
		// ฝาปิดบน/ล่าง = แผ่นทากาว (amber) ไม่มีลิ้นเสียบ
		s += rectCut(xP2, yMainTop, L, W, '#fef3c7');
		s += rectCut(xP4, yMainBot, L, W, '#fef3c7');
		// ปีกข้าง
		s += dustFlap(xP1, W, yWall, dust, -1); s += dustFlap(xP3, W, yWall, dust, -1);
		s += dustFlap(xP1, W, yWallBot, dust, 1); s += dustFlap(xP3, W, yWallBot, dust, 1);
		// เส้นพับ
		[xP1, xP2, xP3, xP4].forEach(function (x) { s += foldLine(x, yWall, x, yWallBot); });
		s += foldLine(xP2, yWall, xP2 + L, yWall);
		s += foldLine(xP4, yWallBot, xP4 + L, yWallBot);
		s += foldLine(xP1, yWall, xP1 + W, yWall); s += foldLine(xP3, yWall, xP3 + W, yWall);
		s += foldLine(xP1, yWallBot, xP1 + W, yWallBot); s += foldLine(xP3, yWallBot, xP3 + W, yWallBot);
		// ป้าย
		// (เลขขนาดแสดงด้วยเส้น dimension แทน — แบบ v1)
		s += label(G / 2, yWall + D / 2, 'กาว', 7);
		s += label(xP2 + L / 2, yMainTop + W / 2, 'ฝาปิด (ทากาว)', 8);
		s += label(xP4 + L / 2, yMainBot + W / 2, 'ฝาปิด (ทากาว)', 8);
		s += wallRowDims(W, L, D, xP1, yWall, yWallBot, totalW, totalH);
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Pillow Box (type 10) — ทรงหมอน ปลายโค้ง =====
	//   open: กว้าง G+2W , ยาว L + 2*(D/2)  (ปลายโค้งบน/ล่างนูนออก D/2)
	//   อ้างอิงแบบ 10-Pillow Box.svg: ขอบนอกตัด = อาร์คนูนออก , เส้นพับปลาย = อาร์คเว้าเข้า (ประ)
	function pillowPanel(x, w, yTop, yBot, bulge, fill) {
		// ขอบตัดรอบ panel: ด้านข้างตรง + ปลายบน/ล่างอาร์คนูนออก (apex = bulge)
		var dd = 'M' + r(x) + ',' + r(yTop) +
			' Q' + r(x + w / 2) + ',' + r(yTop - 2 * bulge) + ' ' + r(x + w) + ',' + r(yTop) +
			' L' + r(x + w) + ',' + r(yBot) +
			' Q' + r(x + w / 2) + ',' + r(yBot + 2 * bulge) + ' ' + r(x) + ',' + r(yBot) + ' Z';
		return pathCut(dd, fill);
	}
	function pillowCrease(x, w, y, dipSign, bulge) {
		// เส้นพับปลายโค้ง = อาร์คเว้าเข้าหาลำตัว (ประเขียว) apex = bulge เข้าไปในเนื้อกล่อง
		var dd = 'M' + r(x) + ',' + r(y) + ' Q' + r(x + w / 2) + ',' + r(y + dipSign * 2 * bulge) + ' ' + r(x + w) + ',' + r(y);
		return '<path d="' + dd + '" fill="none" stroke="' + FOLD + '" stroke-width="1" stroke-dasharray="7,4" />';
	}
	function buildPillow(d) {
		var W = d.W, L = d.L, D = d.D, G = d.G;
		var bulge = D / 2;
		var totalW = G + 2 * W, totalH = L + 2 * bulge;
		var yTop = bulge, yBot = bulge + L;
		var s = '';
		s += rectCut(0, yTop, G, L, '#eef2ff');                       // ลิ้นกาว (ตรง สูง = L)
		s += pillowPanel(G, W, yTop, yBot, bulge, '#f8fafc');         // panel 1
		s += pillowPanel(G + W, W, yTop, yBot, bulge, '#eff6ff');     // panel 2
		// เส้นพับแนวตั้ง (กาว|p1 , p1|p2)
		s += foldLine(G, yTop, G, yBot);
		s += foldLine(G + W, yTop, G + W, yBot);
		// เส้นพับปลายโค้ง (อาร์คเว้า) บน/ล่าง ของแต่ละ panel
		s += pillowCrease(G, W, yTop, 1, bulge);
		s += pillowCrease(G + W, W, yTop, 1, bulge);
		s += pillowCrease(G, W, yBot, -1, bulge);
		s += pillowCrease(G + W, W, yBot, -1, bulge);
		s += label(G / 2, yTop + L / 2, 'ติดกาว', 7);
		// เส้นบอกขนาด W (panel) + L (ความยาวตรง) + D/2 (ปลายโค้ง)
		if (_showDims) {
			var fsd = Math.max(Math.min(W, L, D) * 0.13, 7);
			s += dimH(G, G + W, -fsd * 0.8, W, fsd, _hiDim === 'B');         // W = B (กว้าง)
			s += dimV(yTop, yBot, G + fsd * 1.4, L, fsd, _hiDim === 'A');    // L = A (ยาว)
			s += dimV(0, yTop, totalW + fsd * 1.6, bulge, fsd, false);       // D/2 (ปลายโค้ง)
		}
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Bento (type 7) — ถาดมีฝาพับ (Four Corner Beers Tray with Lid) =====
	//   open: W=2(L+dust)+W, L=3L+2D
	function buildBento(d) {
		var W = d.W, L = d.L, D = d.D, dust = d.dust;
		var side = L + dust;
		var totalW = W + 2 * side, totalH = 3 * L + 2 * D;
		var bx = side, by = L + D;  // มุมบนซ้ายของฐาน
		var s = '';
		// แถวกลาง (กว้าง W): ฝา | ผนังบานพับ | ฐาน | ผนังหน้า | ลิ้นล็อกฝา
		s += rectCut(bx, 0, W, L, '#fef9c3');             // ฝา (lid)
		s += rectCut(bx, L, W, D, '#f8fafc');             // ผนังบานพับ (hinge)
		s += rectCut(bx, by, W, L, '#eff6ff');            // ฐาน
		s += rectCut(bx, by + L, W, D, '#f8fafc');        // ผนังหน้า
		s += rectCut(bx, by + L + D, W, L, '#fffbeb');    // ลิ้นล็อกฝา
		// ผนังข้าง ซ้าย/ขวา ของฐาน
		s += rectCut(0, by, side, L, '#fff7ed');
		s += rectCut(bx + W, by, side, L, '#fff7ed');
		// เส้นพับ
		s += foldLine(bx, L, bx + W, L);
		s += foldLine(bx, by, bx + W, by);
		s += foldLine(bx, by + L, bx + W, by + L);
		s += foldLine(bx, by + L + D, bx + W, by + L + D);
		s += foldLine(bx, by, bx, by + L);
		s += foldLine(bx + W, by, bx + W, by + L);
		// ป้าย
		s += label(bx + W / 2, L / 2, 'ฝา (lid)', 9);
		s += label(bx + W / 2, by + L / 2, 'ฐาน', 9);
		s += label(side / 2, by + L / 2, 'ผนังข้าง', 7);
		s += label(bx + W + side / 2, by + L / 2, 'ผนังข้าง', 7);
		// เส้นบอกขนาด W,L ฐาน + D ผนังบานพับ
		if (_showDims) {
			var fsd = Math.max(Math.min(W, L, D) * 0.12, 7);
			s += dimH(bx, bx + W, by + fsd * 1.7, W, fsd, _hiDim === 'B');   // W = B (กว้าง)
			s += dimV(by, by + L, bx + fsd * 1.7, L, fsd, _hiDim === 'A');   // L = A (ยาว)
			s += dimV(L, by, bx + W * 0.5, D, fsd, _hiDim === 'C');          // D = C (ผนัง hinge)
		}
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Gable (type 8) — ทรงจั่ว + หูหิ้ว + ก้นทากาว =====
	//   open: W=T+2D+W/2+OL, L=2(W+L)+G
	function buildGable(d) {
		var W = d.W, L = d.L, D = d.D, T = d.T, G = d.G, dust = d.dust;
		var OL = d.OL || Math.max(8, W * 0.18), botH = W / 2;
		var totalW = G + 2 * W + 2 * L, totalH = T + 2 * D + botH + OL;
		var xP1 = G, xP2 = G + W, xP3 = G + W + L, xP4 = G + 2 * W + L;
		var yApex = T, yWall = T + D, yWallBot = T + 2 * D, yBotEnd = T + 2 * D + botH;
		var s = '';
		s += glueTab(G, G, yWall, D);
		s += rectCut(xP1, yWall, W, D);
		s += rectCut(xP2, yWall, L, D, '#eff6ff');
		s += rectCut(xP3, yWall, W, D);
		s += rectCut(xP4, yWall, L, D, '#eff6ff');
		// จั่ว (สามเหลี่ยม) บนผนัง L หน้า/หลัง + ลิ้นยอด + หูหิ้ว
		[xP2, xP4].forEach(function (px) {
			s += pathCut(['M', r(px), r(yWall), 'L', r(px + L / 2), r(yApex), 'L', r(px + L), r(yWall), 'Z'].join(' '), '#fef9c3');
			var tw = W * 0.15;
			s += pathCut(['M', r(px + L / 2 - tw), r(yApex), 'L', r(px + L / 2 - tw), r(0), 'L', r(px + L / 2 + tw), r(0), 'L', r(px + L / 2 + tw), r(yApex), 'Z'].join(' '), '#ffffff');
			s += '<ellipse cx="' + r(px + L / 2) + '" cy="' + r(yApex + D * 0.45) + '" rx="' + r(W * 0.2) + '" ry="' + r(Math.min(D * 0.12, 5)) + '" fill="none" stroke="' + CUT + '" stroke-width="1" />';
		});
		// ปีกข้างบนผนัง W
		s += dustFlap(xP1, W, yWall, dust, -1); s += dustFlap(xP3, W, yWall, dust, -1);
		// ก้นทากาว (auto) ทั้ง 4 ผนัง + รอยทแยง
		[[xP1, W], [xP2, L], [xP3, W], [xP4, L]].forEach(function (p) {
			var px = p[0], pw = p[1];
			s += pathCut(['M', r(px), r(yWallBot), 'L', r(px + pw * 0.1), r(yBotEnd),
				'L', r(px + pw * 0.9), r(yBotEnd), 'L', r(px + pw), r(yWallBot), 'Z'].join(' '), '#fff7ed');
			s += foldLine(px, yWallBot, px + pw / 2, yBotEnd);
			s += foldLine(px + pw, yWallBot, px + pw / 2, yBotEnd);
			s += foldLine(px, yWallBot, px + pw, yWallBot);
		});
		s += pathCut(['M', r(xP2 + L * 0.22), r(yBotEnd), 'L', r(xP2 + L * 0.27), r(yBotEnd + OL),
			'L', r(xP2 + L * 0.73), r(yBotEnd + OL), 'L', r(xP2 + L * 0.78), r(yBotEnd), 'Z'].join(' '), '#fde68a');
		// เส้นพับผนัง + จั่ว
		[xP1, xP2, xP3, xP4].forEach(function (x) { s += foldLine(x, yWall, x, yWallBot); });
		s += foldLine(xP2, yWall, xP2 + L, yWall); s += foldLine(xP4, yWall, xP4 + L, yWall);
		s += foldLine(xP1, yWall, xP1 + W, yWall); s += foldLine(xP3, yWall, xP3 + W, yWall);
		// ป้าย
		// (เลขขนาดแสดงด้วยเส้น dimension แทน — แบบ v1)
		s += label(G / 2, yWall + D / 2, 'กาว', 7);
		s += label(xP2 + L / 2, yApex + D * 0.78, 'จั่ว+หูหิ้ว', 7);
		s += wallRowDims(W, L, D, xP1, yWall, yWallBot, totalW, totalH);
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== Custom (type 12) — แผ่นไดคัทกำหนดเอง (แบน W×L) =====
	function buildCustom(d) {
		var W = d.W, L = d.L;
		var s = rectCut(0, 0, W, L, '#f1f5f9');
		// เส้น guide กึ่งกลาง (ประ) ให้ดูเป็นแผ่นไดคัท
		s += '<line x1="' + r(W / 2) + '" y1="0" x2="' + r(W / 2) + '" y2="' + r(L) + '" stroke="#cbd5e1" stroke-width="0.6" stroke-dasharray="4,4"/>';
		s += '<line x1="0" y1="' + r(L / 2) + '" x2="' + r(W) + '" y2="' + r(L / 2) + '" stroke="#cbd5e1" stroke-width="0.6" stroke-dasharray="4,4"/>';
		s += label(W / 2, L * 0.42, 'Custom', Math.max(W * 0.05, 10));
		s += label(W / 2, L * 0.56, 'แผ่นไดคัทกำหนดเอง', Math.max(W * 0.03, 8));
		return { svg: s, w: W, h: L };
	}

	// ===== ทรงที่ยังไม่รองรับ — โชว์กรอบ open size + ผนัง 4 ด้าน + หมายเหตุ =====
	function buildGeneric(d) {
		var W = d.W, L = d.L, D = d.D, G = d.G;
		var totalW = G + 2 * W + 2 * L, totalH = D;
		var s = rectCut(0, 0, totalW, totalH, '#f8fafc');
		[G, G + W, G + W + L, G + 2 * W + L].forEach(function (x) { s += foldLine(x, 0, x, totalH) });
		s += label(totalW / 2, totalH / 2, 'Type ' + d.type + ' (Custom) — v2 รองรับทรง 1-11 แล้ว · ทรงนี้กำหนดเอง ยังไม่มีแบบอัตโนมัติ', 11);
		return { svg: s, w: totalW, h: totalH };
	}

	// ===== ใช้เทมเพต SVG จริงของเรา (2D_Dieline) สำหรับทรง 1-7 แทนการวาดเอง =====
	var _localBodyCache = {};
	var LOCAL_TPL_TYPES = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 };
	var PT2MM = 1 / 2.834645669;
	function _pathPoints(dStr) {
		var t = dStr.match(/[MLAZmlaz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [], i = 0, cmd = null, pts = [];
		function n() { return parseFloat(t[i++]); }
		while (i < t.length) {
			if (/[A-Za-z]/.test(t[i])) { cmd = t[i].toUpperCase(); i++; }
			if (cmd === 'M' || cmd === 'L') pts.push([n(), n()]);
			else if (cmd === 'Q') { n(); n(); pts.push([n(), n()]); }
			else if (cmd === 'A') { n(); n(); n(); n(); n(); pts.push([n(), n()]); }
			else i++;
		}
		return pts;
	}
	function _grpPaths(svg, id) {
		var m = new RegExp('<g[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</g>').exec(svg);
		if (!m) return [];
		var out = [], pm, re = /\sd="([^"]+)"/g;
		while ((pm = re.exec(m[1]))) out.push(pm[1]);
		return out;
	}
	// parse SVG เทมเพต → เก็บ path ดิบ (pt) + bbox (pt) — ยังไม่ scale (scale ตอน dielineCore ตามขนาดที่กรอก)
	function ourSvgToBody(svgText) {
		var cut = _grpPaths(svgText, 'cut'), crease = _grpPaths(svgText, 'crease'), perf = _grpPaths(svgText, 'perforation');
		if (!cut.length && !crease.length) return null;
		var minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
		cut.concat(crease).forEach(function (dStr) {
			_pathPoints(dStr).forEach(function (p) {
				if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
				if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
			});
		});
		if (minX >= maxX) return null;
		return { cut: cut, crease: crease, perf: perf, minX: minX, minY: minY, w: maxX - minX, h: maxY - minY };   // w/h = pt
	}
	// bake พิกัด path: finalX = x*ax + bx, finalY = y*ay + by (arc: scale rx,ry; คง rot/flags)
	function bakePathD(d, ax, bx, ay, by) {
		var t = d.match(/[MLAZmlaz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [], i = 0, cmd = null, out = '';
		function n() { return parseFloat(t[i++]); }
		function fx(x) { return r(x * ax + bx); }
		function fy(y) { return r(y * ay + by); }
		while (i < t.length) {
			if (/[A-Za-z]/.test(t[i])) { cmd = t[i].toUpperCase(); out += ' ' + cmd; i++; }
			if (cmd === 'M' || cmd === 'L') out += ' ' + fx(n()) + ' ' + fy(n());
			else if (cmd === 'Q') out += ' ' + fx(n()) + ' ' + fy(n()) + ' ' + fx(n()) + ' ' + fy(n());
			else if (cmd === 'A') { var rx = n(), ry = n(), rot = n(), la = n(), sw2 = n(); out += ' ' + r(rx * ax) + ' ' + r(ry * ay) + ' ' + rot + ' ' + la + ' ' + sw2 + ' ' + fx(n()) + ' ' + fy(n()); }
			else if (cmd === 'Z') out += ' Z';
			else i++;
		}
		return out.trim();
	}
	// สร้าง body (mm, สี friend) จากเทมเพต — scale ให้ขนาด = targetW×targetH (mm)
	function tplToBody(tpl, targetW, targetH) {
		var ax = targetW / tpl.w, bx = -tpl.minX * ax, ay = targetH / tpl.h, by = -tpl.minY * ay;
		var sw = r(Math.max(targetW, targetH) * 0.0035 + 0.3);
		var dash = r(targetW * 0.022) + ',' + r(targetW * 0.013);
		var svg = '';
		var pdash = r(targetW * 0.006) + ',' + r(targetW * 0.006);   // เส้นปรุ = dash ถี่
		tpl.cut.forEach(function (d) { svg += '<path d="' + bakePathD(d, ax, bx, ay, by) + '" fill="none" stroke="' + CUT + '" stroke-width="' + sw + '"/>'; });
		tpl.crease.forEach(function (d) { svg += '<path d="' + bakePathD(d, ax, bx, ay, by) + '" fill="none" stroke="' + FOLD + '" stroke-width="' + sw + '" stroke-dasharray="' + dash + '"/>'; });
		(tpl.perf || []).forEach(function (d) { svg += '<path d="' + bakePathD(d, ax, bx, ay, by) + '" fill="none" stroke="' + PERF + '" stroke-width="' + sw + '" stroke-dasharray="' + pdash + '"/>'; });
		return { svg: svg, w: targetW, h: targetH };
	}

	function dielineCore(d) {
		var body;
		if (d.type === 1 || d.type === 2) body = buildRTE(d);
		else if (d.type === 3) body = buildTuckTop(d, 'snap');
		else if (d.type === 4) body = buildTuckTop(d, 'auto');
		else if (d.type === 5) body = buildTray(d, false);
		else if (d.type === 6) body = buildTray(d, true);
		else if (d.type === 7) body = buildBento(d);
		else if (d.type === 8) body = buildGable(d);
		else if (d.type === 10) body = buildPillow(d);
		else if (d.type === 11) body = buildSealEnd(d);
		else if (d.type === 9) body = buildSleeve(d);
		else if (d.type === 12) body = buildCustom(d);
		else body = buildGeneric(d);
		// ถ้ามีเทมเพตจริง (1-7) → ใช้รูปทรงเทมเพต scale ให้ขนาด = ที่คำนวณ (ตามขนาดที่กรอก) → nesting/%เสีย ถูก
		if (_localBodyCache[d.type] && body.w > 0 && body.h > 0) {
			body = tplToBody(_localBodyCache[d.type], body.w, body.h);
		}
		var maxd = Math.max(body.w, body.h, 1);
		var fs = Math.max(maxd * 0.03, 8);
		var pad = maxd * 0.11 + 24;
		var gap = pad * 0.5;
		// เส้นบอกขนาดรวม (open size) หน่วย mm — บนสุด + ซ้ายสุด
		var dims = _showDims ? (dimH(0, body.w, -gap, body.w, fs) + dimV(0, body.h, -gap, body.h, fs)) : '';
		// GRAIN arrow — วางเหนือเส้นบอกขนาด
		var vyTop = -pad, grain = '';
		if (_showGrain) {
			var dimTop = _showDims ? (gap + fs * 1.9) : gap;
			var gY = -(dimTop + fs * 1.5);
			grain = grainArrow(body.w, gY, fs);
			vyTop = Math.min(-pad, gY - fs * 1.3);
		}
		// โหมดเส้นล้วน (แบบ v1): เอาสีพื้นออก เหลือแต่เส้น
		var styleB = _lineOnly ? '<style>rect,path,ellipse{fill:none !important}</style>' : '';
		return { inner: styleB + body.svg + dims + grain, bodySvg: body.svg, vx: -pad, vy: vyTop, vw: body.w + pad * 2, vh: (body.h + pad) - vyTop, bw: body.w, bh: body.h };
	}
	// SVG สำหรับแสดงบนจอ (width 100%)
	function buildDielineSVG(d) {
		var c = dielineCore(d);
		return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + r(c.vx) + ' ' + r(c.vy) + ' ' + r(c.vw) + ' ' + r(c.vh) +
			'" style="width:100%;height:auto;display:block;background:#fff">' + c.inner + '</svg>';
	}
	// SVG สำหรับ export (มี width/height เป็น px ให้แปลงเป็นรูป/PDF ได้)
	var BOXNAMES = { 1: 'Reverse Tuck End', 2: 'Straight Tuck End', 3: 'Tuck Top Snap Lock', 4: 'Tuck Top Auto Bottom', 5: 'Tray', 6: 'Frame-Vue Tray', 7: 'Bento Tray w/Lid', 8: 'Gable Top', 9: 'Sleeve', 10: 'Pillow Box', 11: 'Seal End', 12: 'Custom' };
	// หาเครื่อง/กระดาษที่วางได้เยอะสุด (แกรมรับได้) สำหรับ title block
	function bestMachine(d) {
		try {
			_prodLayout = getProdLayout(); _nestType = d.type; _estLayCache = {}; _realLayoutOK = undefined;
			var c = dielineCore(d), pw = c.bw, ph = c.bh, gram = getJobGram(), best = null;
			MACHINE_PAPERS.forEach(function (m) {
				if (gram != null && (gram < m.gmin || gram > m.gmax)) return;
				var cnt = Math.max(nestCount(m.w, m.l, pw, ph, false), nestCount(m.w, m.l, pw, ph, true));
				if (cnt > 0 && (!best || cnt > best.count)) best = { name: m.name, count: cnt };
			});
			return best;
		} catch (e) { return null; }
	}
	function getMeta(d) {
		var paper = '', jobName = '', customer = '', finish = '', date = '';
		try { var $c = $('.component[index="0"]'); paper = ((($c.find('.paperType select').val() || $c.find('.paperType').first().val())) || '') + ''; } catch (e) { }
		try { jobName = (($('#jobName input').first().val()) || '') + ''; } catch (e) { }
		try { customer = (($('#customerLabel').val()) || '') + ''; } catch (e) { }
		try { var fl = []; $('.coatingType').each(function () { var v = ($(this).val() || '').trim(); if (v && fl.indexOf(v) < 0) fl.push(v); }); finish = fl.join(', '); } catch (e) { }
		try { date = new Date().toLocaleDateString('th-TH'); } catch (e) { }
		return { paper: (paper || '').trim(), jobName: (jobName || '').trim(), customer: (customer || '').trim(), finish: (finish || '').trim(), gram: getJobGram(), date: date, machine: bestMachine(d) };
	}
	function buildExportSVG(d, pxW, meta) {
		var c = dielineCore(d); meta = meta || {};
		var fs = c.vw * 0.019;
		var rows = [
			'SIRIVATANA INTERPRINT — Dieline (v2)' + (meta.jobName ? '      งาน: ' + meta.jobName : ''),
			(meta.customer ? 'ลูกค้า: ' + meta.customer + '      ' : '') + 'Type ' + d.type + ' : ' + (BOXNAMES[d.type] || ''),
			'กว้าง ' + d.W + ' × ยาว ' + d.L + ' × สูง ' + d.D + ' mm      ฝา ' + d.T + '  กาว ' + d.G + '  ปีก ' + d.dust + ' mm',
			'กระดาษ ' + (meta.paper || '-') + (meta.gram ? ' ' + meta.gram + 'g' : '') + (meta.finish ? '      เคลือบ ' + meta.finish : '') + '      open ' + r(c.bw) + ' × ' + r(c.bh) + ' mm',
			(meta.machine ? 'เครื่อง: ' + meta.machine.name + ' · ' + meta.machine.count + ' ตัว/แผ่น      ' : '') + '(แดง = เส้นตัด , เขียว = เส้นพับ)' + (meta.date ? '      ' + meta.date : '')
		];
		var hh = fs * (rows.length * 1.35 + 0.9);
		var vy = c.vy - hh;
		var s = '<rect x="' + r(c.vx) + '" y="' + r(vy) + '" width="' + r(c.vw) + '" height="' + r(hh - fs * 0.5) + '" fill="#f8fafc" stroke="#cbd5e1" stroke-width="' + r(fs * 0.05) + '"/>';
		rows.forEach(function (t, i) { s += '<text x="' + r(c.vx + fs * 0.4) + '" y="' + r(vy + fs * (1.15 + i * 1.35)) + '" font-size="' + r(i === 0 ? fs * 1.05 : fs * 0.8) + '" font-weight="' + (i === 0 ? 'bold' : 'normal') + '" fill="#1e293b" font-family="Prompt, sans-serif">' + t + '</text>'; });
		var w = pxW || 1600, h = w * (c.vh + hh) / c.vw;
		return '<svg xmlns="http://www.w3.org/2000/svg" width="' + r(w) + '" height="' + r(h) + '" viewBox="' + r(c.vx) + ' ' + r(vy) + ' ' + r(c.vw) + ' ' + r(c.vh + hh) + '">' + s + c.inner + '</svg>';
	}

	window.__dielineV2 = { buildDielineSVG: buildDielineSVG, buildExportSVG: buildExportSVG, readDims: readDimsSafe };

	// ===== ปุ่ม Dieline v2 =====
	function onV2Click() {
		try {
			var d = readDimsSafe();
			console.log('[dieline-v2] click! dims:', d);
			if (!d.W || !d.L || !d.D) { alert('กรุณากรอกขนาด กว้าง × ยาว × สูง (mm) ก่อน'); return }
			if (LOCAL_TPL_TYPES[d.type] && !_localBodyCache[d.type]) {
				fetch('/dieline/local/' + d.type, { credentials: 'same-origin' })   // ใช้ 3D_Dieline SVG (มี <g id="cut">/<g id="crease">) แทน 2D-Diline_svg ที่ parse ไม่ได้
					.then(function (rr) { if (!rr.ok) throw 0; return rr.text(); })
					.then(function (txt) { var b = ourSvgToBody(txt); if (b) _localBodyCache[d.type] = b; openV2Modal(d); })
					.catch(function () { openV2Modal(d); });
			} else openV2Modal(d);
		} catch (err) {
			console.error('[dieline-v2] click error:', err);
			alert('เปิด Dieline v2 ไม่สำเร็จ: ' + (err && err.message || err));
		}
	}
	function injectButton() {
		if (document.getElementById('dieline-v2-btn')) return;
		var $target = $('#div_bttn > div').first();
		var target = $target && $target[0];
		if (!target) { setTimeout(injectButton, 500); return }
		var btn = document.createElement('button');
		btn.id = 'dieline-v2-btn';
		btn.type = 'button';
		btn.style.cssText = 'margin-left:10px;background:linear-gradient(90deg,#8b5cf6 0%,#6d28d9 100%);color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer';
		btn.innerHTML = '<i class="fa fa-vector-square"></i> Dieline v2 (ฟรี)';
		btn.addEventListener('click', onV2Click);   // bind ตรงกับปุ่ม
		target.appendChild(btn);
		console.log('[dieline-v2] button injected + click bound ✅');
	}
	setTimeout(injectButton, 1500);
	setInterval(injectButton, 3000);
	// เผื่อ delegated ด้วย (กันพลาด)
	try { $('body').on('click', '#dieline-v2-btn', onV2Click); } catch (e) { console.warn('[dieline-v2] delegate bind failed', e); }

	// export เป็น PDF (แปลง SVG → canvas → PNG → pdfMake; ถ้าไม่มี pdfMake ใช้ print เป็น fallback)
	// PDF: เปิดหน้าใหม่พร้อม dieline + title block แล้วสั่ง print → ผู้ใช้ "Save as PDF" (ชัวร์กว่า canvas/pdfMake)
	function exportV2PDF(d) {
		var exSvg = buildExportSVG(d, 1600, getMeta(d));
		var w2 = window.open('', '_blank');
		if (!w2) { alert('เบราว์เซอร์บล็อก popup — กรุณาอนุญาต popup ของเว็บนี้แล้วลองใหม่ (หรือใช้ปุ่ม SVG)'); return; }
		w2.document.open();
		w2.document.write('<!doctype html><html><head><meta charset="utf-8"><title>dieline_type' + d.type + '</title>' +
			'<style>@page{margin:8mm}html,body{margin:0;padding:0;background:#fff}.wrap{padding:6px;text-align:center}svg{width:100%;max-width:1000px;height:auto}</style></head>' +
			'<body><div class="wrap">' + exSvg + '</div>' +
			'<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();},500)}</scr' + 'ipt></body></html>');
		w2.document.close();
	}

	// ===== Nesting — วางไดไลน์ลงแผ่นกระดาษ (straight vs ไขว้) =====
	function asMm(v) { v = +v; return (v > 0 && v < 80) ? v * 25.4 : v; }   // ค่าน้อย = น่าจะเป็นนิ้ว → แปลง mm
	function getPaperSize() {
		try {
			var comp = (window.est || window.estimate).mainData.component1[0];
			var sl = comp.layout && comp.layout.selected_layout;
			var ps = sl && sl.paper_size;
			if (ps && ps.length >= 2 && +ps[0] > 0 && +ps[1] > 0)
				return { w: asMm(ps[0]), l: asMm(ps[1]), src: 'estimate (แมทเครื่อง/stock แล้ว)' };
			if (comp.paperSize && +comp.paperSize[0] > 0)
				return { w: asMm(comp.paperSize[0]), l: asMm(comp.paperSize[1]), src: 'estimate' };
		} catch (e) { }
		return { w: 790, l: 1090, src: 'ค่า default 79×109cm (ยังไม่ได้กดคำนวณ Layout)' };
	}
	// อ่าน layout ที่ระบบคำนวณจริง (Ups = num_laying จากสูตรเฉพาะทรง) → ใช้แทน nesting generic ให้ตรงกัน
	function getProdLayout() {
		try {
			var comp = (window.est || window.estimate).mainData.component1[0];
			var sl = comp.layout && comp.layout.selected_layout;
			if (!sl || !(+sl.num_laying > 0)) return null;
			var grid = sl.layout || [],
				ps = sl.printSize || sl.printing || (sl.laySize ? [sl.laySize[2], sl.laySize[3]] : null),
				paper = sl.paper_size;
			var pw = paper ? asMm(+paper[0]) : 0, pl = paper ? asMm(+paper[1]) : 0;
			var cols = +grid[0], rows = +grid[1];
			if (!(cols > 0) || !(rows > 0) || !ps || !(ps.length >= 2) || !(pw > 0) || !(pl > 0)) return { num: +sl.num_laying, paperW: pw, paperL: pl };
			var pitchX = (+ps[0]) / cols, pitchY = (+ps[1]) / rows;
			if (!(pitchX > 0) || !(pitchY > 0)) return { num: +sl.num_laying, paperW: pw, paperL: pl };
			return { num: +sl.num_laying, cols: cols, rows: rows, pitchX: pitchX, pitchY: pitchY, paperW: pw, paperL: pl };
		} catch (e) { return null; }
	}
	function prodPaperMatches(prod, PW, PL) {
		if (!prod || !(prod.num > 0) || !(prod.paperW > 0) || !(prod.paperL > 0)) return false;
		var a = prod.paperW, b = prod.paperL;
		return (Math.abs(a - PW) < 6 && Math.abs(b - PL) < 6) || (Math.abs(a - PL) < 6 && Math.abs(b - PW) < 6);
	}
	function prodHasGrid(prod) {
		return !!(prod && prod.cols > 0 && prod.rows > 0 && prod.pitchX > 0 && prod.pitchY > 0);
	}
	function prodMatches(prod, PW, PL) {
		return prodPaperMatches(prod, PW, PL) && prodHasGrid(prod);
	}
	// คำนวณการวางต่อแผ่นด้วย "สูตรระบบจริง" (เหมือน Estimate) — ต่อขนาดแผ่นใดก็ได้
	// เรียก est.calculateLayoutDetail (pure calc, คืน grid+จำนวน) ทั้งแนวตั้ง/นอน เอาที่ได้เยอะกว่า
	var _estLayCache = {}; _realLayoutOK = undefined;      // cache ต่อ (type|PW|PL)
	var _realLayoutOK;          // undefined=ยังไม่ตรวจ · true/false=สูตรเต็มเชื่อถือได้ไหม (validate กับ Ups)
	// map paperSize ปัจจุบัน (กระดาษที่ระบบเลือก) → ของเครื่อง (auto-detect mm/inch จากค่าจริง)
	function _machinePaperArr(arr, cw, cl, PW, PL) {
		if (!Array.isArray(arr)) return [PW, PL, PW / 25.4, PL / 25.4];
		return arr.map(function (v) {
			v = +v;
			if (Math.abs(v - cw) < 1.5) return PW;
			if (Math.abs(v - cl) < 1.5) return PL;
			if (Math.abs(v - cw / 25.4) < 0.6) return PW / 25.4;
			if (Math.abs(v - cl / 25.4) < 0.6) return PL / 25.4;
			return v;
		});
	}
	// เรียกสูตร layout จริงของระบบ (setCalculateLayoutSize) กับขนาดแผ่นใดก็ได้
	// สลับ item.paperSize ชั่วคราว (method นี้ pure ไม่ mutate) แล้วคืนค่าเดิมใน finally
	function realLayout(PW, PL) {
		try {
			var est = window.est || window.estimate;
			if (!est || typeof est.setCalculateLayoutSize !== 'function') return null;
			var item = est.mainData && est.mainData.component1 && est.mainData.component1[0];
			if (!item || !item.paperSize || !_prodLayout || !(_prodLayout.paperW > 0)) return null;
			var saved = item.paperSize;
			try {
				item.paperSize = _machinePaperArr(saved, _prodLayout.paperW, _prodLayout.paperL, PW, PL);
				var laying = est.setCalculateLayoutSize(0);
				var best = 0;
				((laying && laying.laying) || []).forEach(function (L) { var n = L && +L.num_laying; if (n > best) best = n; });
				return best > 0 ? best : null;
			} finally { item.paperSize = saved; }
		} catch (e) { return null; }
	}
	function estLayout(PW, PL) {
		try {
			var key = (_nestType || 0) + '|' + r(PW) + '|' + r(PL);
			if (_estLayCache[key] !== undefined) return _estLayCache[key];
			// กระดาษที่ระบบเลือก → Ups จริง (selected_layout) เป๊ะ 100%
			if (_nestType !== 10 && _prodLayout && _prodLayout.num > 0 && prodPaperMatches(_prodLayout, PW, PL)) {
				var _sysv = { count: _prodLayout.num, cols: _prodLayout.cols || 0, rows: _prodLayout.rows || 0, laying: 'system' };
				_estLayCache[key] = _sysv; return _sysv;
			}
			if (_nestType === 10) { _estLayCache[key] = null; return null; }
			// ตรวจครั้งเดียว: สูตรเต็มกับกระดาษที่เลือก ต้องได้ Ups เป๊ะ → ถ้าตรงใช้กับทุกเครื่อง
			if (_realLayoutOK === undefined && _prodLayout && _prodLayout.num > 0 && _prodLayout.paperW > 0) {
				var chk = realLayout(_prodLayout.paperW, _prodLayout.paperL);
				_realLayoutOK = (chk != null && chk === _prodLayout.num);
				console.log('[nest] realLayout validate: สูตรเต็ม=' + chk + ' vs Ups=' + _prodLayout.num + ' -> ' + (_realLayoutOK ? 'ใช้สูตรจริงทุกเครื่อง OK' : 'fallback ค่าประมาณ'));
			}
			// เครื่องอื่น → สูตรจริง (ถ้า validate ผ่าน) ไม่งั้น calculateLayoutDetail (ค่าประมาณ)
			if (_realLayoutOK) {
				var rn = realLayout(PW, PL);
				if (rn != null && rn > 0) { var rv = { count: rn, cols: 0, rows: 0, laying: 'system' }; _estLayCache[key] = rv; return rv; }
			}
			var est = window.est || window.estimate;
			if (!est || typeof est.calculateLayoutDetail !== 'function') { _estLayCache[key] = null; return null; }
			var comp = est.mainData && est.mainData.component1 && est.mainData.component1[0];
			var ps = comp && comp.packaging_size;
			var tpl = _nestType || (comp && comp.box_type && comp.box_type.type_id);
			if (!ps || !tpl) { _estLayCache[key] = null; return null; }
			var m = getMargins();
			var tol = { gripper: m.gripper, color_bar: m.colorbar, paper_edge: m.edge, bleed: 6 };
			var best = null;
			['vertical', 'horizontal'].forEach(function (lay) {
				try {
					var rdt = est.calculateLayoutDetail(tpl, ps, [PW, PL], tol, lay);
					var n = rdt && (rdt.totalAmount || (rdt.wSideAmount * rdt.lSideAmount));
					if (n > 0 && (!best || n > best.count)) best = { count: n, cols: rdt.wSideAmount, rows: rdt.lSideAmount, laying: lay };
				} catch (e) { }
			});
			_estLayCache[key] = best;
			return best;
		} catch (e) { return null; }
	}
	function getMargins() {
		var pt = '';
		try { pt = ($('#print_type select').val() || '') + ''; } catch (e) { }
		var gr = 12;   // gripper ตาม print type
		if (/flexo/i.test(pt)) gr = 25; else if (/jet/i.test(pt)) gr = 25; else if (/konica/i.test(pt)) gr = 35;
		return { gripper: gr, colorbar: 8, edge: 4 };
	}
	function usableWL(PW, PL) {
		return { uW: Math.max(0, PW - 2 * _margins.edge), uL: Math.max(0, PL - _margins.gripper - _margins.colorbar) };
	}
	function nestGrid(PW, PL, pw, ph) {
		var u = usableWL(PW, PL), uW = u.uW, uL = u.uL;
		var a = Math.floor(uW / pw) * Math.floor(uL / ph);
		var b = Math.floor(uW / ph) * Math.floor(uL / pw);
		if (a >= b) return { cols: Math.floor(uW / pw), rows: Math.floor(uL / ph), pw: pw, ph: ph, count: a };
		return { cols: Math.floor(uW / ph), rows: Math.floor(uL / pw), pw: ph, ph: pw, count: b };
	}
	function drawNest(PW, PL, unit, cross) {
		var pw = unit.pw, ph = unit.ph, bw = unit.bw, bh = unit.bh, bl = unit.bleed;
		var mx = _margins.edge, myT = _margins.gripper, myB = _margins.colorbar;
		var u = usableWL(PW, PL), uW = u.uW, uL = u.uL;
		var forceCross = (unit.type === 10);   // ทรง 10 (Pillow) บังคับวางไขว้ — ปลายนูนลงร่อง ไม่ทับ จำนวนใกล้ของจริง
		var g = nestGrid(PW, PL, pw, ph), pieces = [], i, j, count, pitchY = g.ph;
		var _el = forceCross ? null : estLayout(PW, PL);   // สูตรระบบจริง ต่อเครื่องนี้
		var _useProd = !forceCross && (_el || prodMatches(_prodLayout, PW, PL));   // ทรง 10 ไม่ใช้ (ใช้ interlock แทน)
		var _prodAng = 0;   // มุมวางของ _useProd (0 หรือ 90 ถ้าต้องหมุนให้ฟิตแผ่น)
		if (_useProd) {
			// วาง "จำนวน = สูตรระบบ" จัดกริดสวยเต็มแผ่น — เลือกทิศ (ไม่หมุน vs หมุน 90°) ให้ฟิตแผ่น
			var _num = _el ? _el.count : _prodLayout.num
			function _fit(pwid, phei) { return Math.max(0, Math.floor(uW / (pwid + bl))) * Math.max(0, Math.floor(uL / (phei + bl))); }
			var _capA = _fit(bw, bh), _capB = _fit(bh, bw);   // A=ไม่หมุน, B=หมุน 90°
			var _rot;   // เลือกทิศที่วาง _num ได้พอดี (ชิ้นกว้างเกินแผ่น → ต้องหมุน)
			if (_num <= _capA && Math.floor(uW / (bw + bl)) > 0) _rot = false;
			else if (_num <= _capB && Math.floor(uW / (bh + bl)) > 0) _rot = true;
			else _rot = (_capB > _capA);
			var _pW = _rot ? bh : bw, _pH = _rot ? bw : bh;   // ขนาดชิ้นตามทิศที่เลือก
			_prodAng = _rot ? 90 : 0;
			var _maxCols = Math.max(1, Math.floor(uW / (_pW + bl)))
			var _maxRows = Math.max(1, Math.floor(uL / (_pH + bl)))
			var _cols, _ppx = _pW + bl, _ppy = _pH + bl
			if (_num <= _maxCols * _maxRows) {
				_cols = Math.min(_maxCols, _num)                     // พอดีแผ่น → ขนาดจริง ไม่ซ้อน
			} else {
				_cols = Math.ceil(_num / _maxRows)                   // เกินความจุปกติ → อัดคอลัมน์ ลด pitch
				_ppx = _cols > 1 ? Math.max(2, (uW - _pW) / (_cols - 1)) : (_pW + bl)
			}
			var _rows = Math.ceil(_num / _cols)
			if (_rows > 1) _ppy = Math.min(_ppy, (uL - _pH) / (_rows - 1))
			g = { cols: _cols, rows: _rows, pw: _ppx, ph: _ppy, count: _num }; pitchY = g.ph
		}
		var gridRot = !_useProd && Math.abs(g.pw - pw) > 0.1, baseAng = _useProd ? _prodAng : (gridRot ? 90 : 0);
		if ((cross || forceCross) && !_useProd) {
			// ใช้ grid เดียวกับวางตรง (เต็มเฟรม) + วางสอดเพิ่มแถว (เฉพาะแนวไม่หมุน · profile แนวตั้ง)
			var nrows = g.rows;
			if (!gridRot && _crossPitchY > 0 && _crossPitchY < g.ph) {
				pitchY = _crossPitchY;
				nrows = Math.max(g.rows, Math.floor((uL - bh) / pitchY) + 1);
			}
			// Safety guard: ตรวจ pitchY/nrows ก่อนวางจริง ป้องกัน overlap และล้ำขอบ
			if (pitchY < g.ph) {
				// Guard 1: pitchY ต้องไม่ต่ำกว่า _crossPitchY → ป้องกัน cut-line overlap ระหว่างแถว (profile + 3mm)
				if (_crossPitchY > 0 && pitchY < _crossPitchY - 0.1) {
					pitchY = _crossPitchY;
					nrows = Math.max(g.rows, Math.floor((uL - bh) / pitchY) + 1);
				}
				// Guard 2: (nrows-1)*pitchY + (bh+bl) <= uL → ป้องกัน cut-line ล้ำ color bar/gripper หลัง centering
				var nrowsCap = Math.max(1, Math.floor((uL - bh - bl) / pitchY) + 1);
				if (nrows > nrowsCap) nrows = nrowsCap;
			}
			for (i = 0; i < g.cols; i++) for (j = 0; j < nrows; j++) pieces.push([mx + i * g.pw, myT + j * pitchY, baseAng + (j % 2 === 1 ? 180 : 0)]);
			count = g.cols * nrows;
			// A posteriori: ตรวจ shape overlap จาก dieline จริง → เพิ่ม pitchY 1mm/รอบจนไม่ซ้อน
			if (pitchY < g.ph && unit.svg) {
				var _ovShapes = parseShapes(unit.svg);
				if (_ovShapes.length > 0) {
					while (pitchY < g.ph && _hasCrossShapeOverlap(pieces, _ovShapes, bw, bh, bl)) {
						pitchY = Math.min(pitchY + 1, g.ph);
						var _ncap = Math.max(1, Math.floor((uL - bh - bl) / pitchY) + 1);
						if (nrows > _ncap) nrows = _ncap;
						pieces = [];
						for (i = 0; i < g.cols; i++) for (j = 0; j < nrows; j++)
							pieces.push([mx + i * g.pw, myT + j * pitchY, baseAng + (j % 2 === 1 ? 180 : 0)]);
						count = g.cols * nrows;
					}
				}
			}
		} else {
			// _useProd: วางตามแถว (ซ้าย→ขวา, บน→ล่าง) จำกัดที่ "จำนวน = Ups เป๊ะ" (แถวสุดท้ายไม่เต็มได้)
			var _cap = _useProd ? g.count : g.cols * g.rows, _placed = 0;
			for (j = 0; j < g.rows && _placed < _cap; j++) for (i = 0; i < g.cols && _placed < _cap; i++) { pieces.push([mx + i * g.pw, myT + j * g.ph, baseAng]); _placed++; }
			count = _placed;
		}
		// จัดกึ่งกลาง: เลื่อนกลุ่มชิ้นงานให้อยู่กลางพื้นที่ใช้งาน (เว้นขอบเท่ากันทุกด้าน)
		if (pieces.length) {
			var mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
			pieces.forEach(function (p) {
				var rotp = (p[2] === 90 || p[2] === 270);
				var cwp = rotp ? bh : bw, chp = rotp ? bw : bh;
				if (p[0] < mnX) mnX = p[0]; if (p[0] + cwp > mxX) mxX = p[0] + cwp;
				if (p[1] < mnY) mnY = p[1]; if (p[1] + chp > mxY) mxY = p[1] + chp;
			});
			var offX = mx + (uW - (mxX - mnX)) / 2 - mnX, offY = myT + (uL - (mxY - mnY)) / 2 - mnY;
			pieces.forEach(function (p) { p[0] += offX; p[1] += offY; });
		}
		var lw = Math.max(PW, PL) * 0.0025, fsM = Math.max(PW, PL) * 0.013;
		var s = '<rect x="0" y="0" width="' + r(PW) + '" height="' + r(PL) + '" fill="#fff" stroke="#1e293b" stroke-width="' + r(lw * 1.6) + '"/>';
		// โซนเว้นเลย์: gripper (บน), color bar (ล่าง), paper edge (ซ้าย-ขวา)
		s += '<rect x="0" y="0" width="' + r(PW) + '" height="' + r(myT) + '" fill="#fecaca" fill-opacity="0.7"/>' +
			'<rect x="0" y="' + r(PL - myB) + '" width="' + r(PW) + '" height="' + r(myB) + '" fill="#fde68a" fill-opacity="0.7"/>' +
			'<rect x="0" y="0" width="' + r(mx) + '" height="' + r(PL) + '" fill="#e2e8f0" fill-opacity="0.8"/>' +
			'<rect x="' + r(PW - mx) + '" y="0" width="' + r(mx) + '" height="' + r(PL) + '" fill="#e2e8f0" fill-opacity="0.8"/>';
		var debugMode = false;
		var useReal = (unit.type === 10 || pieces.length <= 80) && unit.svg;   // ทรง 10 (Pillow) วาดรูปจริงเสมอ — ทรงอื่นคงเพดาน 80 เพื่อความลื่น
		if (useReal) s += '<defs><g id="du">' + unit.svg + '</g></defs>';
		pieces.forEach(function (p, pi) {
			var px = p[0], py = p[1], ang = p[2], rotd = (ang === 90 || ang === 270), rotated180 = (ang === 180 || ang === 270);
			var cw = rotd ? bh : bw, ch = rotd ? bw : bh;
			// straight: เส้นปะแดงที่ขอบ bleed นอกสุด — อยู่ห่าง bl/2 จาก dieline SVG จึงไม่ทับ
			// cross debugMode=true: background+ขอบสี; debugMode=false: dieline SVG + label เท่านั้น
			if (!cross) {
				s += '<rect x="' + r(px) + '" y="' + r(py) + '" width="' + r(cw + bl) + '" height="' + r(ch + bl) + '" fill="none" stroke="#dc2626" stroke-width="' + r(lw * 0.6) + '" stroke-dasharray="' + r(lw * 4) + ' ' + r(lw * 2.5) + '"/>';
			} else if (debugMode) {
				var cellStroke = rotated180 ? ' stroke="#d97706" stroke-width="' + r(lw * 1.1) + '"' : ' stroke="#3b82f6" stroke-width="' + r(lw * 0.7) + '"';
				s += '<rect x="' + r(px + bl/2) + '" y="' + r(py + bl/2) + '" width="' + r(cw) + '" height="' + r(ch) + '" fill="' + (rotated180 ? '#fef9c3' : '#eff6ff') + '" fill-opacity="0.45"' + cellStroke + '/>';
			}
			var sf = 1.0;
			if (useReal) {
				var tr;
				if (rotd) {
					var oxr = px + bl/2 + (cw - bh * sf) / 2, oyr = py + bl/2 + (ch - bw * sf) / 2;
					tr = (ang === 90) ? 'translate(' + r(oxr + bh * sf) + ',' + r(oyr) + ') scale(' + sf + ') rotate(90)' : 'translate(' + r(oxr) + ',' + r(oyr + bw * sf) + ') scale(' + sf + ') rotate(270)';
				} else {
					var oxn = px + bl/2 + (cw - bw * sf) / 2, oyn = py + bl/2 + (ch - bh * sf) / 2;
					tr = (ang === 0) ? 'translate(' + r(oxn) + ',' + r(oyn) + ') scale(' + sf + ')' : 'translate(' + r(oxn + bw * sf) + ',' + r(oyn + bh * sf) + ') scale(' + sf + ') rotate(180)';
				}
				s += '<use href="#du" xlink:href="#du" transform="' + tr + '"/>';
			} else {
				var iw = (rotd ? bh : bw) * sf, ih = (rotd ? bw : bh) * sf;
				s += '<rect x="' + r(px + bl/2 + (cw - iw) / 2) + '" y="' + r(py + bl/2 + (ch - ih) / 2) + '" width="' + r(iw) + '" height="' + r(ih) + '" fill="none" stroke="#dc2626" stroke-width="' + r(lw) + '"/>';
			}
			if (cross) {
				if (debugMode && rotated180) {
					var bfs2 = Math.min(cw, ch) * 0.14, bcx = px + bl/2 + cw / 2, bcy = py + bl/2 + ch / 2;
					s += '<text x="' + r(bcx) + '" y="' + r(bcy + bfs2 * 0.35) + '" font-size="' + r(bfs2) + '" fill="#d97706" text-anchor="middle" font-family="Prompt, sans-serif" font-weight="bold" fill-opacity="0.7">↺</text>';
				} else if (!debugMode) {
					var lblSz = Math.min(cw, ch) * 0.09, lblX = px + bl/2 + cw * 0.05, lblY = py + bl/2 + lblSz * 1.4;
					var lblCol = rotated180 ? '#d97706' : '#3b82f6';
					s += '<text x="' + r(lblX) + '" y="' + r(lblY) + '" font-size="' + r(lblSz) + '" fill="' + lblCol + '" font-family="Prompt, sans-serif" font-weight="bold" fill-opacity="0.85">' + (rotated180 ? '180\xb0' : '0\xb0') + '</text>';
				}
			}
		});
		var eff = count * (_unitArea || pw * ph) / (PW * PL) * 100;
		var pd = Math.max(PW, PL) * 0.085;
		var afs = Math.max(PW, PL) * 0.021, asw = afs * 0.07, AC = '#dc2626';
		// ===== ลูกศร + ป้ายระยะ แบบ reference (วางนอกแผ่น ไม่ทับชิ้นงาน) =====
		var ann = '<defs><marker id="nah" markerWidth="9" markerHeight="9" refX="4.5" refY="4.5" orient="auto"><path d="M1,1.5 L7.5,4.5 L1,7.5" fill="none" stroke="' + AC + '" stroke-width="1.4"/></marker></defs>';
		// gripper (บน)
		ann += '<text x="' + r(PW * 0.5) + '" y="' + r(-pd * 0.45) + '" font-size="' + r(afs) + '" fill="' + AC + '" text-anchor="middle" font-family="Prompt, sans-serif">' + r(myT) + ' mm : gripper</text>';
		ann += '<line x1="' + r(PW * 0.5) + '" y1="' + r(-pd * 0.3) + '" x2="' + r(PW * 0.5) + '" y2="' + r(myT) + '" stroke="' + AC + '" stroke-width="' + r(asw) + '" marker-end="url(#nah)"/>';
		// color bar (ล่าง)
		ann += '<text x="' + r(PW * 0.5) + '" y="' + r(PL + pd * 0.58) + '" font-size="' + r(afs) + '" fill="' + AC + '" text-anchor="middle" font-family="Prompt, sans-serif">' + r(myB) + ' mm : color bar</text>';
		ann += '<line x1="' + r(PW * 0.5) + '" y1="' + r(PL + pd * 0.42) + '" x2="' + r(PW * 0.5) + '" y2="' + r(PL - myB) + '" stroke="' + AC + '" stroke-width="' + r(asw) + '" marker-end="url(#nah)"/>';
		// paper edge (ซ้าย/ขวา) — หมุน 90°
		ann += '<text x="' + r(-pd * 0.55) + '" y="' + r(PL * 0.5) + '" font-size="' + r(afs) + '" fill="' + AC + '" text-anchor="middle" font-family="Prompt, sans-serif" transform="rotate(-90 ' + r(-pd * 0.55) + ' ' + r(PL * 0.5) + ')">' + r(mx) + ' mm : paper edge</text>';
		ann += '<text x="' + r(PW + pd * 0.55) + '" y="' + r(PL * 0.5) + '" font-size="' + r(afs) + '" fill="' + AC + '" text-anchor="middle" font-family="Prompt, sans-serif" transform="rotate(-90 ' + r(PW + pd * 0.55) + ' ' + r(PL * 0.5) + ')">' + r(mx) + ' mm : paper edge</text>';
		// bleed — แสดงรอบชิ้นแรกแบบ reference (กล่องเขียว=ชิ้นงาน + ลูกศร bleed 4 ด้าน)
		if (pieces.length) {
			var p0 = pieces[0], p0r = (p0[2] === 90 || p0[2] === 270), cw0 = p0r ? (bh + bl) : (bw + bl), ch0 = p0r ? (bw + bl) : (bh + bl);
			var BC = '#dc2626', bfs = afs * 0.58;
			if (pieces.length <= 8) {
				var sf2 = 1.0, dw0 = (p0r ? bh : bw) * sf2, dh0 = (p0r ? bw : bh) * sf2;
				var gx = p0[0] + (cw0 - dw0) / 2, gy = p0[1] + (ch0 - dh0) / 2, mxp = gx + dw0 / 2, myp = gy + dh0 / 2;
				ann += '<defs><marker id="nahR" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><path d="M1,1.5 L6.5,4 L1,6.5" fill="none" stroke="' + BC + '" stroke-width="1.3"/></marker></defs>';
				ann += '<rect x="' + r(gx) + '" y="' + r(gy) + '" width="' + r(dw0) + '" height="' + r(dh0) + '" fill="none" stroke="#16a34a" stroke-width="' + r(asw * 0.6) + '" stroke-dasharray="' + r(asw * 3) + ' ' + r(asw * 2) + '"/>';
				ann += '<line x1="' + r(mxp) + '" y1="' + r(p0[1]) + '" x2="' + r(mxp) + '" y2="' + r(gy) + '" stroke="' + BC + '" stroke-width="' + r(asw * 0.7) + '" marker-end="url(#nahR)"/>';
				ann += '<line x1="' + r(mxp) + '" y1="' + r(p0[1] + ch0) + '" x2="' + r(mxp) + '" y2="' + r(gy + dh0) + '" stroke="' + BC + '" stroke-width="' + r(asw * 0.7) + '" marker-end="url(#nahR)"/>';
				ann += '<line x1="' + r(p0[0]) + '" y1="' + r(myp) + '" x2="' + r(gx) + '" y2="' + r(myp) + '" stroke="' + BC + '" stroke-width="' + r(asw * 0.7) + '" marker-end="url(#nahR)"/>';
				ann += '<line x1="' + r(p0[0] + cw0) + '" y1="' + r(myp) + '" x2="' + r(gx + dw0) + '" y2="' + r(myp) + '" stroke="' + BC + '" stroke-width="' + r(asw * 0.7) + '" marker-end="url(#nahR)"/>';
				var halo = ' paint-order="stroke" stroke="#fff" stroke-width="' + r(bfs * 0.5) + '" stroke-linejoin="round"';
				ann += '<text x="' + r(mxp) + '" y="' + r((p0[1] + gy) / 2 + bfs * 0.35) + '" font-size="' + r(bfs) + '" fill="' + BC + '" text-anchor="middle" font-family="Prompt, sans-serif"' + halo + '>bleed ' + r(bl / 2) + 'mm</text>';
				ann += '<text x="' + r((p0[0] + gx) / 2) + '" y="' + r(myp) + '" font-size="' + r(bfs) + '" fill="' + BC + '" text-anchor="middle" font-family="Prompt, sans-serif"' + halo + ' transform="rotate(-90 ' + r((p0[0] + gx) / 2) + ' ' + r(myp) + ')">bleed ' + r(bl / 2) + 'mm</text>';
			} else {
				ann += '<text x="' + r(p0[0] + cw0 / 2) + '" y="' + r(p0[1] + ch0 * 0.08) + '" font-size="' + r(bfs) + '" fill="' + BC + '" text-anchor="middle" font-family="Prompt, sans-serif">' + r(bl / 2) + 'mm bleed</text>';
			}
		}
		s += ann;
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' + r(-pd) + ' ' + r(-pd) + ' ' + r(PW + pd * 2) + ' ' + r(PL + pd * 2) +
			'" style="width:100%;height:auto;max-height:72vh;display:block;background:#f8fafc">' + s + '</svg>';
		return { svg: svg, count: count, eff: eff, overlap: cross ? Math.max(0, g.ph - pitchY) : 0 };
	}
	// ขนาดกระดาษเครื่องพิมพ์ (จาก Excel: all spec machine) — w×l mm + ช่วงแกรม
	var MACHINE_PAPERS = [
		{ name: 'ตัด 1 (820×1130)', w: 820, l: 1130, gmin: 40, gmax: 700, mc: 'L244, L444SP, L444SPAPC' },
		{ name: 'ตัด 1 G844 (840×1150)', w: 840, l: 1150, gmin: 80, gmax: 700, mc: 'G844 C+IR (8สี+เคลือบ)' },
		{ name: 'ตัด 2 (720×1030)', w: 720, l: 1030, gmin: 40, gmax: 700, mc: 'L640, LS440, CD440A, GL640, Akiyama' },
		{ name: 'ตัด 2 หนา (720×1030)', w: 720, l: 1030, gmin: 200, gmax: 500, mc: 'LS540, L640C, L640UVAPC-B' },
		{ name: 'ตัด 3 KBA (740×1050)', w: 740, l: 1050, gmin: 50, gmax: 500, mc: 'KBA' },
		{ name: 'ตัด 3 LS1029P (530×750)', w: 530, l: 750, gmin: 40, gmax: 450, mc: 'LS1029P' }
	];
	function getJobGram() {
		// 1) อ่านสดจากฟอร์มก่อน (dropdown Gsm) — เผื่อ AI fill แล้วยังไม่ commit เข้า mainData
		try {
			var $c = $('.component[index="0"]');
			var v = parseFloat($c.find('.paperGram').val()) || parseFloat($c.find('.paperGram-custom').val()) || parseFloat($c.find('.paperGram-custom').text());
			if (v) return v;
		} catch (e) { }
		// 2) fallback: mainData
		try {
			var c = (window.est || window.estimate).mainData.component1[0];
			var g = (c.paper && c.paper.paper_gram) || c.gram || (c.paper && c.paper.gram);
			return parseFloat(g) || null;
		} catch (e) { }
		return null;
	}
	function getJobQty() {
		try {
			var q = (window.est || window.estimate).mainData.qty;
			if (q) {
				if (Array.isArray(q.main) && q.main.length) return +q.main[0] || null;
				if (Array.isArray(q.totalqty) && q.totalqty.length) return +q.totalqty[0] || null;
				if (q.totalqty) return +q.totalqty || null;
			}
		} catch (e) { }
		return null;
	}
	function gramOk(m, gram) { return gram == null ? true : (gram >= m.gmin && gram <= m.gmax); }
	// ราคา/kg ของกระดาษ: 1) ช่อง Cost ในฟอร์ม (B/Kg) → 2) lookup master ตาม code+gram
	function getPaperPriceKg() {
		try { var c = parseFloat($('.component[index="0"] .paperCost').val()); if (c > 0) return c; } catch (e) { }
		try {
			var code = $('.component[index="0"] .paperType').val(), g = getJobGram();
			if (code && g && typeof getPaperPrice === 'function') { var p = getPaperPrice(code, g); if (p > 0) return p; }
		} catch (e) { }
		return null;
	}
	// ===== Shape-nesting: วัด profile รูปจริง → ระยะวางสอด (เส้นตัดไม่ทับ เว้น 3mm) =====
	var _crossPitchY = 0, _unitArea = 0;   // ระยะวางสอด + เนื้อที่จริงของไดไลน์ (สำหรับ %เสีย)
	var _prodLayout = null;   // layout ที่ระบบคำนวณ (Ups) — set ตอน openNestModal
	var _nestType = 0;        // box type ที่กำลังวาง (ทรง 10 = ไม่ใช้ prod Ups ที่ทับ → interlock)
	function parseShapes(svg) {
		var shapes = [], m;
		var re = /<rect\s+x="(-?[\d.]+)"\s+y="(-?[\d.]+)"\s+width="(-?[\d.]+)"\s+height="(-?[\d.]+)"/g;
		while ((m = re.exec(svg))) shapes.push({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] });
		var rp = /<path\s+d="([^"]+)"/g;
		while ((m = rp.exec(svg))) {
			var nums = (m[1].match(/-?[\d.]+/g) || []).map(Number), xs = [], ys = [], i;
			if (nums.length < 4) continue;
			for (i = 0; i + 1 < nums.length; i += 2) { xs.push(nums[i]); ys.push(nums[i + 1]); }
			shapes.push({ x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) });
		}
		return shapes;
	}
	// แปลง shape (local coords) → พิกัดกระดาษ (รองรับ 0° และ 180°)
	function _paperRect(s, ox, oy, bwp, bhp, rotated) {
		return rotated
			? { x: ox + bwp - s.x - s.w, y: oy + bhp - s.y - s.h, w: s.w, h: s.h }
			: { x: ox + s.x, y: oy + s.y, w: s.w, h: s.h };
	}
	// ตรวจว่า shape จริงของ pieces ใดคู่หนึ่งในคอลัมน์เดียวกันซ้อนทับกัน (pixel-level rect intersection)
	function _hasCrossShapeOverlap(pieces, shapes, bwp, bhp, blp) {
		var n = pieces.length;
		for (var pi = 0; pi < n; pi++) {
			for (var pj = pi + 1; pj < n; pj++) {
				if (Math.abs(pieces[pi][0] - pieces[pj][0]) > 1) continue;   // คนละคอลัมน์ → X ห่างพอ ข้าม
				if (Math.abs(pieces[pi][1] - pieces[pj][1]) >= bhp) continue; // Y ห่างกว่า bh → ไม่มีทางซ้อน
				var rot1 = (pieces[pi][2] === 180 || pieces[pi][2] === 270);
				var rot2 = (pieces[pj][2] === 180 || pieces[pj][2] === 270);
				var ox1 = pieces[pi][0] + blp / 2, oy1 = pieces[pi][1] + blp / 2;
				var ox2 = pieces[pj][0] + blp / 2, oy2 = pieces[pj][1] + blp / 2;
				for (var a = 0; a < shapes.length; a++) {
					var r1 = _paperRect(shapes[a], ox1, oy1, bwp, bhp, rot1);
					for (var b = 0; b < shapes.length; b++) {
						var r2 = _paperRect(shapes[b], ox2, oy2, bwp, bhp, rot2);
						if (r1.x + r1.w > r2.x && r2.x + r2.w > r1.x &&
							r1.y + r1.h > r2.y && r2.y + r2.h > r1.y) return true;
					}
				}
			}
		}
		return false;
	}
	function computeCrossPitchY(unit) {
		_unitArea = unit.bw * unit.bh * 0.62;   // fallback
		try {
			var shapes = parseShapes(unit.svg || ''); if (!shapes.length) return 0;
			var n = 80, bw = unit.bw, bh = unit.bh, step = bw / n, bot = [], i, k, area = 0;
			for (i = 0; i < n; i++) {
				var cx = (i + 0.5) * step, b = 0, t = bh, hit = false;
				for (k = 0; k < shapes.length; k++) { var s = shapes[k]; if (cx >= s.x - 0.01 && cx <= s.x + s.w + 0.01) { hit = true; if (s.y + s.h > b) b = s.y + s.h; if (s.y < t) t = s.y; } }
				bot.push(hit ? b : 0); if (hit) area += (b - t) * step;
			}
			if (area > 0) _unitArea = area;
			var pf = 0;
			for (i = 0; i < n; i++) { var d = bot[i] + bot[n - 1 - i] - bh; if (d > pf) pf = d; }   // พลิก 180° → ลิ้นสอดช่องเว้า
			return Math.max(0, pf) + 3;   // +3mm เว้นเส้นตัด
		} catch (e) { return 0; }
	}
	function crossRows(uL, ph) {
		var bh = ph - 6, pitch = ph;
		if (_crossPitchY > 0 && _crossPitchY < ph) pitch = _crossPitchY;
		return Math.max(1, Math.floor((uL - bh) / pitch) + 1);
	}
	function nestCount(PW, PL, pw, ph, cross) {
		if (_nestType !== 10) {
			var el = estLayout(PW, PL);                         // สูตรระบบจริง ต่อเครื่อง (ทุกขนาดแผ่น)
			if (el && el.count > 0) return el.count;
			if (prodPaperMatches(_prodLayout, PW, PL)) return _prodLayout.num;   // fallback: Ups กระดาษที่ระบบเลือก
		}
		var u = usableWL(PW, PL), g = nestGrid(PW, PL, pw, ph);
		if (!cross) return g.cols * g.rows;
		var gridRot = Math.abs(g.pw - pw) > 0.1, nrows = g.rows;   // ไขว้ยึด grid วางตรง + วางสอดเพิ่มแถว
		if (!gridRot && _crossPitchY > 0 && _crossPitchY < g.ph) {
			var bh2 = ph, pitch = _crossPitchY;
			nrows = Math.max(g.rows, Math.floor((u.uL - bh2) / pitch) + 1);
		}
		return g.cols * nrows;
	}
	// export แผ่น nesting (เปิด PDF = ซูมดูรายละเอียดได้, หรือโหลด SVG)
	function exportNestPDF(nestSvg, titleText) {
		var w2 = window.open('', '_blank');
		if (!w2) { alert('เบราว์เซอร์บล็อก popup — อนุญาต popup แล้วลองใหม่ (หรือใช้ปุ่ม SVG)'); return; }
		var svg = nestSvg.replace(/max-height:[^;"]*;?/g, '');
		w2.document.open();
		w2.document.write('<!doctype html><html><head><meta charset="utf-8"><title>nesting</title>' +
			'<style>@page{margin:8mm}html,body{margin:0;padding:0;font-family:Prompt,sans-serif;background:#fff}.h{padding:6px 12px;font-size:12px;border-bottom:1px solid #cbd5e1;font-weight:bold;word-break:break-word}.wrap{padding:4px;text-align:center}svg{width:auto;max-width:100%;max-height:90vh;height:auto}</style></head>' +
			'<body><div class="h">' + titleText + '</div><div class="wrap">' + svg + '</div>' +
			'<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.focus();window.print();},500)}</scr' + 'ipt></body></html>');
		w2.document.close();
	}
	function downloadNestSVG(nestSvg, name) {
		var clean = '<?xml version="1.0" encoding="UTF-8"?>\n' + nestSvg.replace(/max-height:[^;"]*;?/g, '');
		var blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
		var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name + '.svg';
		document.body.appendChild(a); a.click(); a.remove();
	}
	function openNestModal(d) {
		var p0 = document.getElementById('dieline-nest-overlay'); if (p0) p0.remove();
		_margins = getMargins();
		_prodLayout = getProdLayout(); _nestType = d.type; _estLayCache = {}; _realLayoutOK = undefined;   // Ups จากสูตรระบบ (ใช้ให้ตรงกันสำหรับกระดาษที่แมท)
		var core = dielineCore(d);
		var bleed = 6, pw = core.bw + bleed, ph = core.bh + bleed;
		// ตัด label + เส้นบอกขนาดออก → เหลือแต่เส้นกล่อง (สะอาด ดูออกง่ายเวลาวางหลายตัว)
		var cleanSvg = (core.bodySvg || '').replace(/<text[\s\S]*?<\/text>/g, '').replace(/<line[^>]*#dc2626[^>]*\/>/g, '');
		var unit = { svg: cleanSvg, bw: core.bw, bh: core.bh, bleed: bleed, pw: pw, ph: ph, type: d.type };
		_crossPitchY = computeCrossPitchY(unit);   // ระยะวางสอดจาก profile รูปจริง
		var gram = getJobGram(), qty = getJobQty(), priceKg = getPaperPriceKg();
		function sheetInfo(count, eff) {
			var waste = Math.max(0, 100 - eff).toFixed(0);
			var sh = (qty && count > 0) ? ('→ <b>' + Math.ceil(qty / count) + '</b> แผ่น') : 'ใส่ยอดสั่งในฟอร์มเพื่อคำนวณแผ่น';
			return '<div style="font-size:12px;color:#475569;margin-top:3px">' + sh + ' · เสียกระดาษ <b>' + waste + '%</b></div>';
		}
		// ตัวเลือกกระดาษ: จาก estimate (ถ้ามี) + ขนาดเครื่อง
		var opts = MACHINE_PAPERS.slice();
		var ep = getPaperSize();
		if (ep.src.indexOf('estimate') === 0) opts.unshift({ name: 'จาก estimate (' + r(ep.w) + '×' + r(ep.l) + ')', w: ep.w, l: ep.l, gmin: 0, gmax: 9999 });
		// เทียบทุกขนาด
		var rows = opts.map(function (m) {
			var st = nestCount(m.w, m.l, pw, ph, false), cr = nestCount(m.w, m.l, pw, ph, true), best = Math.max(st, cr);
			var waste = Math.max(0, 100 - best * (_unitArea || pw * ph) / (m.w * m.l) * 100);
			// ปริมาณกระดาษที่ใช้ (ตัวชี้ต้นทุน — kg น้อยสุด = ถูกสุดเมื่อกระดาษชนิดเดียวกัน)
			var sheets = (qty && best > 0) ? Math.ceil(qty / best) : null;
			var totalKg = (sheets != null && gram) ? (sheets * m.w * m.l * gram / 1e9) : null;  // แผ่น × พื้นที่(m²) × แกรม
			var cost = (totalKg != null && priceKg) ? (totalKg * priceKg) : null;  // บาท = kg × ราคา/kg
			return { m: m, st: st, cr: cr, best: best, waste: waste, sheets: sheets, totalKg: totalKg, cost: cost, ok: gramOk(m, gram) };
		});
		var pool = rows.filter(function (x) { return x.ok && x.best > 0; }); if (!pool.length) pool = rows;
		// เลือก: จำนวนมากสุดก่อน → ถ้าเท่ากัน เอาเสียน้อยสุด (คุ้มกระดาษกว่า)
		var bestRow = pool.reduce(function (a, b) {
			if (b.best !== a.best) return b.best > a.best ? b : a;
			return b.waste < a.waste ? b : a;
		}, pool[0]);
		var matchIdx = (_prodLayout && _prodLayout.num > 0 && _prodLayout.paperW > 0)
			? rows.findIndex(function (x) {
				var a = _prodLayout.paperW, b = _prodLayout.paperL;
				return (Math.abs(a - x.m.w) < 6 && Math.abs(b - x.m.l) < 6) ||
					   (Math.abs(a - x.m.l) < 6 && Math.abs(b - x.m.w) < 6);
			}) : -1;
		var selIdx = matchIdx >= 0 ? matchIdx : rows.indexOf(bestRow);
		// กระดาษที่ใช้เนื้อน้อยสุด (ถูกสุด) ในกลุ่มที่แกรมรับได้
		var costPool = rows.filter(function (x) { return x.ok && x.best > 0 && x.totalKg != null; });
		var cheapest = costPool.length ? costPool.reduce(function (a, b) { return b.totalKg < a.totalKg ? b : a; }, costPool[0]) : null;

		var optHtml = rows.map(function (x, i) { return '<option value="' + i + '"' + (i === selIdx ? ' selected' : '') + '>' + x.m.name + (x.ok ? '' : ' ⚠️แกรมไม่รับ') + '</option>'; }).join('');
		var tblRows = rows.slice().map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return b.x.best - a.x.best; }).map(function (o) {
			var x = o.x, hl = (o.i === selIdx), waste = x.waste, wc = waste < 25 ? '#16a34a' : (waste > 40 ? '#dc2626' : '#92400e');
			return '<tr style="' + (hl ? 'background:#dcfce7;font-weight:bold' : '') + '"><td style="padding:4px 8px">' + '' + x.m.name + '</td>' +
				'<td style="padding:4px 8px;text-align:center">' + r(x.m.w) + '×' + r(x.m.l) + '</td>' +
				'<td style="padding:4px 8px;font-size:11px;color:#64748b">' + (x.m.mc || '-') + '</td>' +
				'<td style="padding:4px 8px;text-align:center">' + x.st + '</td>' +
				'<td style="padding:4px 8px;text-align:center;color:#2563eb">' + x.cr + '</td>' +
				'<td style="padding:4px 8px;text-align:center;font-weight:bold;color:' + wc + '">' + (x.ok && x.best > 0 ? waste.toFixed(0) + '%' : '-') + '</td>' +
					'<td style="padding:4px 8px;text-align:center' + (x === cheapest ? ';color:#16a34a;font-weight:bold' : '') + '">' + (x.totalKg != null ? ('' + x.sheets + ' แผ่น · ' + x.totalKg.toFixed(0) + ' kg' + (x.cost != null ? ' · ฿' + Math.round(x.cost).toLocaleString() : '')) : '-') + '</td>' +
					'<td style="padding:4px 8px;text-align:center">' + (x.ok ? '✅' : '⚠️') + '</td></tr>';
		}).join('');

		var html = '<div id="dieline-nest-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:100000;display:flex;align-items:center;justify-content:center">' +
			'<div style="background:#fff;width:min(1180px,96vw);height:min(94vh,880px);overflow:auto;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35)">' +
			'<div style="background:linear-gradient(90deg,#0ea5e9,#2563eb);color:#fff;padding:13px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:bold"><span>วางไดไลน์ลงกระดาษ — Type ' + d.type + '</span><span class="nest-close" style="cursor:pointer;font-size:24px">&times;</span></div>' +
			'<div style="padding:10px 16px;background:#eff6ff;font-size:13px;color:#1e40af;display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
			'เลือกเครื่อง/กระดาษ <select class="nest-sel" style="padding:4px 6px;border:1px solid #93c5fd;border-radius:5px">' + optHtml + '</select>' +
			'<span id="nest-gram"></span></div>' +
			'<div id="nest-sheets" style="display:flex;gap:14px;flex-wrap:wrap;padding:16px"></div>' +
			'<div style="padding:0 16px 16px"><div style="font-weight:bold;color:#334155;margin-bottom:6px">เทียบทุกขนาด (ไดไลน์ ≈ ' + r(pw) + '×' + r(ph) + ' mm รวม bleed · เว้น gripper ' + _margins.gripper + ' / color bar ' + _margins.colorbar + ' / edge ' + _margins.edge + ' mm)</div>' +
			'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:5px 8px;text-align:left">กระดาษ</th><th style="padding:5px 8px">ขนาด mm</th><th style="padding:5px 8px;text-align:left">เครื่อง (รุ่น)</th><th style="padding:5px 8px">วางตรง</th><th style="padding:5px 8px">วางไขว้</th><th style="padding:5px 8px">เสียน้อยสุด</th><th style="padding:5px 8px">กระดาษที่ใช้</th><th style="padding:5px 8px">แกรม</th></tr>' + tblRows + '</table>' +
			'<div style="font-size:11px;color:#64748b;margin-top:6px">✅/⚠️ = แกรมงาน' + (gram ? ' ' + gram + 'g' : '') + ' รับได้ไหม' + (qty ? ' · ยอด ' + qty.toLocaleString() : ' · (ใส่ยอดสั่ง)') + (priceKg ? ' · ราคา ' + priceKg + ' ฿/kg' : ' · (ใส่ Cost B/Kg เพื่อคิดเป็นบาท)') + '</div>' +
			(_prodLayout && _prodLayout.cols > 0 ? '<div style="font-size:11px;color:#16a34a;margin-top:4px">กระดาษ ' + r(_prodLayout.paperW) + '×' + r(_prodLayout.paperL) + ' = ตรงกับ <b>Ups สูตรระบบ ' + _prodLayout.num + ' ตัว</b> (' + _prodLayout.cols + '×' + _prodLayout.rows + ' แชร์ขอบตามทรง) · กระดาษอื่นเป็นค่าประมาณจาก nesting</div>' : '') + '</div>' +
			'</div></div>';
		document.body.insertAdjacentHTML('beforeend', html);
		var ov = document.getElementById('dieline-nest-overlay');
		function renderSel(i) {
			var m = rows[i].m;
			var st = drawNest(m.w, m.l, unit, false), cr = drawNest(m.w, m.l, unit, true);
			var b = cr.count > st.count ? 'สอด' : 'ตรง';
			var ebtn = 'border:0;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:bold;cursor:pointer;color:#fff;margin-right:5px';
			var bar = function (k) { return '<div style="margin:6px 0 8px"><button class="np-pdf-' + k + '" style="background:#dc2626;' + ebtn + '">PDF (ซูมได้)</button><button class="np-svg-' + k + '" style="background:#059669;' + ebtn + '">SVG</button><span style="font-size:11px;color:#94a3b8;margin-left:6px">(ลูกกลิ้ง = ซูม)</span></div>'; };
			var zwrap = function (svg) { return '<div class="nz-holder" style="overflow:auto;max-height:74vh;border:1px solid #eef2f7;border-radius:4px"><div class="nz-inner" style="transform-origin:0 0;width:100%">' + svg + '</div></div>'; };
			document.getElementById('nest-sheets').innerHTML =
				'<div style="flex:1;min-width:280px;border:2px solid ' + (b === 'ตรง' ? '#16a34a' : '#e2e8f0') + ';border-radius:8px;padding:10px"><div style="font-weight:bold;color:#334155">วางตรง — <span style="color:#2563eb;font-size:18px">' + st.count + '</span> ตัว/แผ่น · ' + st.eff.toFixed(0) + '%</div>' + sheetInfo(st.count, st.eff) + bar('st') + zwrap(st.svg) + '</div>' +
				'<div style="flex:1;min-width:280px;border:2px solid ' + (b === 'สอด' ? '#16a34a' : '#e2e8f0') + ';border-radius:8px;padding:10px"><div style="font-weight:bold;color:#334155">วางไขว้ — <span style="color:#2563eb;font-size:18px">' + cr.count + '</span> ตัว/แผ่น · ' + cr.eff.toFixed(0) + '%</div>' + sheetInfo(cr.count, cr.eff) + bar('cr') + zwrap(cr.svg) + '</div>';
			var ns = document.getElementById('nest-sheets');
			var ttl = function (kind, cnt, eff) { return 'Nesting — Type ' + d.type + ' · ' + kind + ' · เครื่อง ' + m.name + ' (' + r(m.w) + '×' + r(m.l) + 'mm) · ' + cnt + ' ตัว/แผ่น · เสีย ' + Math.max(0, 100 - eff).toFixed(0) + '% · ไดไลน์ ' + r(unit.bw) + '×' + r(unit.bh) + 'mm'; };
			ns.querySelector('.np-pdf-st').onclick = function () { exportNestPDF(st.svg, ttl('วางตรง', st.count, st.eff)); };
			ns.querySelector('.np-svg-st').onclick = function () { downloadNestSVG(st.svg, 'nest_type' + d.type + '_straight_' + r(m.w) + 'x' + r(m.l)); };
			ns.querySelector('.np-pdf-cr').onclick = function () { exportNestPDF(cr.svg, ttl('วางไขว้', cr.count, cr.eff)); };
			ns.querySelector('.np-svg-cr').onclick = function () { downloadNestSVG(cr.svg, 'nest_type' + d.type + '_cross_' + r(m.w) + 'x' + r(m.l)); };
			// ซูมด้วยลูกกลิ้งเมาส์ (ที่ตำแหน่งเคอร์เซอร์) ในแต่ละแผ่น
			ns.querySelectorAll('.nz-holder').forEach(function (h) {
				var inner = h.querySelector('.nz-inner'), z = 1;
				h.addEventListener('wheel', function (e) {
					e.preventDefault();
					var rect = h.getBoundingClientRect(), ox = e.clientX - rect.left, oy = e.clientY - rect.top;
					var cx = (h.scrollLeft + ox) / z, cy = (h.scrollTop + oy) / z;
					z = Math.min(Math.max(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1), 8);
					inner.style.transform = 'scale(' + z + ')';
					h.scrollLeft = cx * z - ox; h.scrollTop = cy * z - oy;
				}, { passive: false });
			});
			var ok = rows[i].ok;
			document.getElementById('nest-gram').innerHTML = '· กระดาษ <b>' + r(m.w) + '×' + r(m.l) + ' mm</b>' + (m.mc ? ' · เครื่อง: <b>' + m.mc + '</b>' : '') + ' · ยอดสั่ง <b>' + (qty ? qty.toLocaleString() : '?') + '</b> ตัว · ' +
				(gram ? ('แกรมงาน ' + gram + 'g ' + (ok ? '<span style="color:#16a34a">✅ รับได้</span>' : '<span style="color:#dc2626">⚠️ เกินช่วง ' + m.gmin + '-' + m.gmax + 'g</span>')) : 'ไม่ทราบแกรมงาน');
		}
		renderSel(selIdx);
		ov.querySelector('.nest-sel').addEventListener('change', function () { renderSel(+this.value); });
		ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.classList && e.target.classList.contains('nest-close'))) ov.remove(); });
	}

	function openV2Modal(d) {
		var prev = document.getElementById('dieline-v2-overlay');
		if (prev) prev.remove();
		_hiDim = null; _lineOnly = false;
		var cur = { type: d.type, W: d.W, L: d.L, D: d.D, T: d.T, G: d.G, dust: d.dust, OL: d.OL };
		var svg = '';
		var btn = 'border:0;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer;color:#fff;';
		var tabActS = 'padding:9px 20px;border:0;border-bottom:3px solid #6d28d9;background:transparent;font-weight:bold;cursor:pointer;color:#6d28d9;font-size:13px;';
		var tabS = 'padding:9px 20px;border:0;border-bottom:3px solid transparent;background:transparent;cursor:pointer;color:#64748b;font-size:13px;';
		var html =
			'<div id="dieline-v2-overlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999;display:flex;align-items:center;justify-content:center">' +
			'<style>#v2-svg-holder.bg-white{background:#fff}#v2-svg-holder.bg-gray{background:#9ca3af}#v2-svg-holder.bg-black{background:#0b0b0b}' +
			'#v2-svg-holder svg{background:transparent !important}' +
			'#v2-svg-holder.bg-black rect,#v2-svg-holder.bg-black path,#v2-svg-holder.bg-black ellipse{fill:none !important}' +
			'#v2-svg-holder.bg-black line[stroke="#334155"]{stroke:#cbd5e1 !important}' +
			'#v2-svg-holder.bg-black text{fill:#e5e7eb !important}</style>' +
			'<div style="background:#fff;width:min(1180px,96vw);height:min(94vh,880px);border-radius:8px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 10px 40px rgba(0,0,0,.35)">' +
			'<div style="background:linear-gradient(90deg,#8b5cf6,#6d28d9);color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;font-weight:bold">' +
			'<span><i class="fa fa-vector-square"></i> Dieline v2 — สร้างเอง (ฟรี)</span>' +
			'<span class="v2-close" style="cursor:pointer;font-size:24px">&times;</span></div>' +
			'<div id="v2-tabs" style="display:flex;border-bottom:2px solid #e2e8f0;background:#f8fafc">' +
			'<button class="v2-tab" data-tab="dieline" style="' + tabActS + '">Dieline</button>' +
			'<button class="v2-tab" data-tab="nesting" style="' + tabS + '">Nesting</button>' +
			'</div>' +
			'<div style="flex:1;overflow:hidden;display:flex;flex-direction:column;min-height:0">' +
			'<div id="v2-svg-holder" class="bg-white" style="flex:1;overflow:auto;padding:16px;display:flex;align-items:center;justify-content:center"><div id="v2-svg-inner" style="transform-origin:center center;display:flex;align-items:center;justify-content:center;margin:auto"></div></div>' +
			'<div id="v2-nest-panel" style="flex:1;overflow:auto;padding:16px;display:none"></div>' +
			'</div>' +
			'<div id="v2-zoombar" style="padding:12px 18px;border-top:1px solid #eee;background:#fafafa;display:flex;gap:8px;align-items:center;flex-wrap:wrap">' +
			'<button class="v2-zoomout" style="width:34px;height:34px;background:#e2e8f0;border:0;border-radius:6px;font-size:18px;font-weight:bold;cursor:pointer">−</button>' +
			'<span id="v2-zoomlbl" style="min-width:46px;text-align:center;font-size:13px;color:#475569">100%</span>' +
			'<button class="v2-zoomin" style="width:34px;height:34px;background:#e2e8f0;border:0;border-radius:6px;font-size:18px;font-weight:bold;cursor:pointer">+</button>' +
			'<button class="v2-zoomreset" style="background:#e2e8f0;border:0;padding:7px 12px;border-radius:6px;font-size:12px;cursor:pointer">รีเซ็ต</button>' +
			'<span style="font-size:11px;color:#94a3b8">(ลูกกลิ้งเมาส์ = ซูมที่จุดนั้น)</span>' +
			'<label style="font-size:12px;color:#475569">พื้นหลัง <select class="v2-bg" style="padding:3px 5px;border:1px solid #cbd5e1;border-radius:5px"><option value="white">ขาว</option><option value="gray">เทา</option><option value="black">ดำ</option></select></label>' +
			'<span style="flex:1"></span>' +
			'<button class="v2-3d" style="background:#7c3aed;' + btn + '">3D</button>' +
			'<button class="v2-pdf" style="background:#dc2626;' + btn + '">PDF</button>' +
			'<button class="v2-dl" style="background:#6d28d9;' + btn + '">SVG</button>' +
			'<button class="v2-close" style="background:#eee;border:0;padding:8px 16px;border-radius:6px;font-weight:bold;cursor:pointer">ปิด</button>' +
			'</div></div></div>';
		document.body.insertAdjacentHTML('beforeend', html);
		var _prevBodyOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';   // ล็อกหน้าจอหลังไม่ให้เลื่อนตอนเปิด modal
		var ov = document.getElementById('dieline-v2-overlay');
		function closeV2() { _hiDim = null; _lineOnly = false; document.body.style.overflow = _prevBodyOverflow; ov.remove(); }
		var holder = document.getElementById('v2-svg-holder');
		var nestPanel = document.getElementById('v2-nest-panel');
		var zoomBar = document.getElementById('v2-zoombar');
		var inner = document.getElementById('v2-svg-inner');
		var selBg = ov.querySelector('.v2-bg');
		function redraw() {
			_lineOnly = true; _showDims = true;
			try { svg = buildDielineSVG(cur); }
			catch (e) { console.error('[dieline-v2] build error:', e); svg = '<div style="color:#dc2626;padding:20px">' + (e && e.message) + '</div>'; }
			inner.innerHTML = svg;
			// fit เต็มกรอบ + จัดกึ่งกลาง: ใส่ขนาด intrinsic จาก viewBox แล้วจำกัดด้วย max 100% (contain)
			var _sv = inner.querySelector('svg');
			if (_sv) {
				var vb = (_sv.getAttribute('viewBox') || '').split(/\s+/);
				if (vb.length === 4) { _sv.setAttribute('width', vb[2]); _sv.setAttribute('height', vb[3]); }
				_sv.style.width = 'auto'; _sv.style.height = 'auto';
				_sv.style.maxWidth = '100%'; _sv.style.maxHeight = '100%'; _sv.style.display = 'block';
			}
		}
		redraw();
		selBg.addEventListener('change', function () {
			_bg = selBg.value;
			holder.className = 'bg-' + selBg.value;
			redraw();
		});
		// ----- tabs -----
		ov.querySelectorAll('.v2-tab').forEach(function (tab) {
			tab.addEventListener('click', function () {
				var t = this.getAttribute('data-tab');
				ov.querySelectorAll('.v2-tab').forEach(function (bt) {
					bt.style.borderBottomColor = 'transparent';
					bt.style.color = '#64748b';
					bt.style.fontWeight = '';
				});
				this.style.borderBottomColor = '#6d28d9';
				this.style.color = '#6d28d9';
				this.style.fontWeight = 'bold';
				var isNest = t === 'nesting';
				holder.style.display = isNest ? 'none' : 'flex';   // คงเป็น flex เพื่อจัดกึ่งกลาง dieline
				nestPanel.style.display = isNest ? '' : 'none';
				zoomBar.style.display = isNest ? 'none' : '';
				if (isNest && !nestPanel.__loaded) {
					nestPanel.__loaded = true;
					renderNestPanel(cur, nestPanel);
				}
			});
		});
		// ----- ซูม -----
		var zoom = 1;
		function applyZoom() {
			inner.style.transform = 'scale(' + zoom + ')';
			var lbl = ov.querySelector('#v2-zoomlbl'); if (lbl) lbl.textContent = Math.round(zoom * 100) + '%';
		}
		ov.querySelector('.v2-zoomin').addEventListener('click', function () { zoom = Math.min(zoom * 1.25, 8); applyZoom(); });
		ov.querySelector('.v2-zoomout').addEventListener('click', function () { zoom = Math.max(zoom / 1.25, 0.3); applyZoom(); });
		ov.querySelector('.v2-zoomreset').addEventListener('click', function () { zoom = 1; applyZoom(); holder.scrollTo(0, 0); });
		// ----- wheel zoom ที่ตำแหน่งเคอร์เซอร์ -----
		holder.addEventListener('wheel', function (e) {
			e.preventDefault();
			var rect = holder.getBoundingClientRect();
			var ox = e.clientX - rect.left, oy = e.clientY - rect.top;
			var cx = (holder.scrollLeft + ox) / zoom, cy = (holder.scrollTop + oy) / zoom;
			zoom = Math.min(Math.max(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.3), 8);
			applyZoom();
			holder.scrollLeft = cx * zoom - ox;
			holder.scrollTop = cy * zoom - oy;
		}, { passive: false });
		ov.addEventListener('click', function (e) {
			if (e.target === ov || (e.target.classList && e.target.classList.contains('v2-close'))) { closeV2(); }
		});
		ov.querySelector('.v2-dl').addEventListener('click', function () {
			var exSvg = buildExportSVG(cur, 1600, getMeta(cur));
			var blob = new Blob([exSvg], { type: 'image/svg+xml' });
			var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
			a.download = 'dieline_v2_type' + cur.type + '_' + cur.W + 'x' + cur.L + 'x' + cur.D + '.svg';
			document.body.appendChild(a); a.click(); a.remove();
		});
		ov.querySelector('.v2-pdf').addEventListener('click', function () { exportV2PDF(cur); });
		ov.querySelector('.v2-3d').addEventListener('click', function () {
			document.body.style.overflow = _prevBodyOverflow; ov.remove();
			var btn3d = document.getElementById('dieline-3d-btn');
			if (btn3d) btn3d.click();
			else alert('ไม่พบปุ่ม 3D — กรุณากดปุ่ม 3D ที่หน้าหลักแทน');
		});
		function renderNestPanel(d, el) {
			el.__loaded = true;
			_margins = getMargins();
			_prodLayout = getProdLayout(); _nestType = d.type; _estLayCache = {}; _realLayoutOK = undefined;
			var core = dielineCore(d);
			var bleed = 6, pw = core.bw + bleed, ph = core.bh + bleed;
			var cleanSvg = (core.bodySvg || '').replace(/<text[\s\S]*?<\/text>/g, '').replace(/<line[^>]*#dc2626[^>]*\/>/g, '');
			var unit = { svg: cleanSvg, bw: core.bw, bh: core.bh, bleed: bleed, pw: pw, ph: ph, type: d.type };
			_crossPitchY = computeCrossPitchY(unit);
			var gram = getJobGram(), qty = getJobQty(), priceKg = getPaperPriceKg();
			function sheetInfo(count, eff) {
				var waste = Math.max(0, 100 - eff).toFixed(0);
				var sh = (qty && count > 0) ? ('→ <b>' + Math.ceil(qty / count) + '</b> แผ่น') : 'ใส่ยอดสั่งเพื่อคำนวณแผ่น';
				return '<div style="font-size:12px;color:#475569;margin-top:3px">' + sh + ' · เสียกระดาษ <b>' + waste + '%</b></div>';
			}
			var opts = MACHINE_PAPERS.slice();
			var ep = getPaperSize();
			if (ep.src.indexOf('estimate') === 0) opts.unshift({ name: 'จาก estimate (' + r(ep.w) + '×' + r(ep.l) + ')', w: ep.w, l: ep.l, gmin: 0, gmax: 9999 });
			var rows = opts.map(function (m) {
				var st = nestCount(m.w, m.l, pw, ph, false), cr = nestCount(m.w, m.l, pw, ph, true), best = Math.max(st, cr);
				var waste = Math.max(0, 100 - best * (_unitArea || pw * ph) / (m.w * m.l) * 100);
				var sheets = (qty && best > 0) ? Math.ceil(qty / best) : null;
				var totalKg = (sheets != null && gram) ? (sheets * m.w * m.l * gram / 1e9) : null;
				var cost = (totalKg != null && priceKg) ? (totalKg * priceKg) : null;
				return { m: m, st: st, cr: cr, best: best, waste: waste, sheets: sheets, totalKg: totalKg, cost: cost, ok: gramOk(m, gram) };
			});
			var pool = rows.filter(function (x) { return x.ok && x.best > 0; }); if (!pool.length) pool = rows;
			var bestRow = pool.reduce(function (a, b) {
				if (b.best !== a.best) return b.best > a.best ? b : a;
				return b.waste < a.waste ? b : a;
			}, pool[0]);
			var matchIdx = (_prodLayout && _prodLayout.num > 0 && _prodLayout.paperW > 0)
				? rows.findIndex(function (x) {
					var a = _prodLayout.paperW, b = _prodLayout.paperL;
					return (Math.abs(a - x.m.w) < 6 && Math.abs(b - x.m.l) < 6) ||
						   (Math.abs(a - x.m.l) < 6 && Math.abs(b - x.m.w) < 6);
				}) : -1;
			var selIdx = matchIdx >= 0 ? matchIdx : rows.indexOf(bestRow);
			var costPool = rows.filter(function (x) { return x.ok && x.best > 0 && x.totalKg != null; });
			var cheapest = costPool.length ? costPool.reduce(function (a, b) { return b.totalKg < a.totalKg ? b : a; }, costPool[0]) : null;
			var optHtml = rows.map(function (x, i) { return '<option value="' + i + '"' + (i === selIdx ? ' selected' : '') + '>' + x.m.name + (x.ok ? '' : ' ⚠️แกรมไม่รับ') + '</option>'; }).join('');
			var tblRows = rows.slice().map(function (x, i) { return { x: x, i: i }; }).sort(function (a, b) { return b.x.best - a.x.best; }).map(function (o) {
				var x = o.x, hl = (o.i === selIdx), waste = x.waste, wc = waste < 25 ? '#16a34a' : (waste > 40 ? '#dc2626' : '#92400e');
				return '<tr style="' + (hl ? 'background:#dcfce7;font-weight:bold' : '') + '"><td style="padding:4px 8px">' + '' + x.m.name + '</td>' +
					'<td style="padding:4px 8px;text-align:center">' + r(x.m.w) + '×' + r(x.m.l) + '</td>' +
					'<td style="padding:4px 8px;font-size:11px;color:#64748b">' + (x.m.mc || '-') + '</td>' +
					'<td style="padding:4px 8px;text-align:center">' + x.st + '</td>' +
					'<td style="padding:4px 8px;text-align:center;color:#2563eb">' + x.cr + '</td>' +
					'<td style="padding:4px 8px;text-align:center;font-weight:bold;color:' + wc + '">' + (x.ok && x.best > 0 ? waste.toFixed(0) + '%' : '-') + '</td>' +
					'<td style="padding:4px 8px;text-align:center' + (x === cheapest ? ';color:#16a34a;font-weight:bold' : '') + '">' + (x.totalKg != null ? ('' + x.sheets + ' แผ่น · ' + x.totalKg.toFixed(0) + ' kg' + (x.cost != null ? ' · ฿' + Math.round(x.cost).toLocaleString() : '')) : '-') + '</td>' +
					'<td style="padding:4px 8px;text-align:center">' + (x.ok ? '✅' : '⚠️') + '</td></tr>';
			}).join('');
			el.innerHTML =
				'<div style="background:#eff6ff;font-size:13px;color:#1e40af;display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px;border-radius:6px;padding:8px 12px">' +
				'เลือกเครื่อง/กระดาษ <select class="vn-sel" style="padding:4px 6px;border:1px solid #93c5fd;border-radius:5px">' + optHtml + '</select>' +
				'<span class="vn-gram"></span></div>' +
				'<div class="vn-sheets" style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:14px"></div>' +
				'<div><div style="font-weight:bold;color:#334155;margin-bottom:6px">เทียบทุกขนาด (ไดไลน์ ≈ ' + r(pw) + '×' + r(ph) + ' mm · gripper ' + _margins.gripper + ' / color bar ' + _margins.colorbar + ' / edge ' + _margins.edge + ' mm)</div>' +
				'<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="background:#f1f5f9"><th style="padding:5px 8px;text-align:left">กระดาษ</th><th style="padding:5px 8px">ขนาด mm</th><th style="padding:5px 8px;text-align:left">เครื่อง</th><th style="padding:5px 8px">วางตรง</th><th style="padding:5px 8px">วางไขว้</th><th style="padding:5px 8px">เสีย%</th><th style="padding:5px 8px">กระดาษที่ใช้</th><th style="padding:5px 8px">แกรม</th></tr>' + tblRows + '</table>' +
				'<div style="font-size:11px;color:#64748b;margin-top:6px">✅/⚠️=แกรมงาน' + (gram ? ' ' + gram + 'g' : '') + (qty ? ' · ยอด ' + qty.toLocaleString() : '') + (priceKg ? ' · ราคา ' + priceKg + ' ฿/kg' : '') + '</div>' +
				(_prodLayout && _prodLayout.cols > 0 ? '<div style="font-size:11px;color:#16a34a;margin-top:4px">กระดาษ ' + r(_prodLayout.paperW) + '×' + r(_prodLayout.paperL) + ' = <b>Ups สูตรระบบ ' + _prodLayout.num + ' ตัว</b> (' + _prodLayout.cols + '×' + _prodLayout.rows + ')</div>' : '') + '</div>';
			function renderSel(i) {
				var m = rows[i].m;
				var st = drawNest(m.w, m.l, unit, false), cr = drawNest(m.w, m.l, unit, true);
				var b = cr.count > st.count ? 'สอด' : 'ตรง';
				var ebtn = 'border:0;padding:4px 10px;border-radius:5px;font-size:11px;font-weight:bold;cursor:pointer;color:#fff;margin-right:5px';
				var bar = function (k) { return '<div style="margin:6px 0 8px"><button class="np-pdf-' + k + '" style="background:#dc2626;' + ebtn + '">PDF</button><button class="np-svg-' + k + '" style="background:#059669;' + ebtn + '">SVG</button><span style="font-size:11px;color:#94a3b8;margin-left:6px">(คลิกเลือกกรอบ → ลูกกลิ้งซูม)</span></div>'; };
				var zwrap = function (svg) { return '<div class="nz-holder" style="overflow:auto;max-height:74vh;border:1px solid #eef2f7;border-radius:4px"><div class="nz-inner" style="transform-origin:0 0;width:100%">' + svg + '</div></div>'; };
				el.querySelector('.vn-sheets').innerHTML =
					'<div class="vn-panel" data-idx="0" style="flex:1;min-width:280px;border:2px solid #e2e8f0;border-radius:8px;padding:10px;cursor:pointer"><div style="font-weight:bold;color:#334155">วางตรง — <span style="color:#2563eb;font-size:18px">' + st.count + '</span> ตัว/แผ่น · ' + st.eff.toFixed(0) + '%</div>' + sheetInfo(st.count, st.eff) + bar('st') + zwrap(st.svg) + '</div>' +
					'<div class="vn-panel" data-idx="1" style="flex:1;min-width:280px;border:2px solid #e2e8f0;border-radius:8px;padding:10px;cursor:pointer"><div style="font-weight:bold;color:#334155">วางไขว้ — <span style="color:#2563eb;font-size:18px">' + cr.count + '</span> ตัว/แผ่น · ' + cr.eff.toFixed(0) + '%</div>' + sheetInfo(cr.count, cr.eff) + bar('cr') + zwrap(cr.svg) + '</div>';
				var ns = el.querySelector('.vn-sheets');
				var ttl = function (kind, cnt, eff) { return 'Nesting — Type ' + d.type + ' · ' + kind + ' · เครื่อง ' + m.name + ' (' + r(m.w) + '×' + r(m.l) + 'mm) · ' + cnt + ' ตัว/แผ่น · เสีย ' + Math.max(0, 100 - eff).toFixed(0) + '%'; };
				ns.querySelector('.np-pdf-st').onclick = function () { exportNestPDF(st.svg, ttl('วางตรง', st.count, st.eff)); };
				ns.querySelector('.np-svg-st').onclick = function () { downloadNestSVG(st.svg, 'nest_type' + d.type + '_straight_' + r(m.w) + 'x' + r(m.l)); };
				ns.querySelector('.np-pdf-cr').onclick = function () { exportNestPDF(cr.svg, ttl('วางไขว้', cr.count, cr.eff)); };
				ns.querySelector('.np-svg-cr').onclick = function () { downloadNestSVG(cr.svg, 'nest_type' + d.type + '_cross_' + r(m.w) + 'x' + r(m.l)); };
				// คลิกเลือกกรอบ → เขียว(เลือก)/เทา(ไม่เลือก) · ลูกกลิ้งซูมเฉพาะกรอบที่เลือก (ไม่งั้นหน้าเลื่อนปกติ)
				var _panels = ns.querySelectorAll('.vn-panel'), _sel = -1;
				function _setSel(k) {
					_sel = (_sel === k) ? -1 : k;
					_panels.forEach(function (p, j) { p.style.borderColor = (_sel === j) ? '#16a34a' : (_sel === -1 ? '#e2e8f0' : '#9ca3af'); });
				}
				_panels.forEach(function (p, k) { p.addEventListener('click', function (e) { if (e.target.closest('button')) return; _setSel(k); }); });
				ns.querySelectorAll('.nz-holder').forEach(function (h, k) {
					var nzInner = h.querySelector('.nz-inner'), z = 1;
					h.addEventListener('wheel', function (e) {
						if (_sel !== k) return;   // ยังไม่เลือกกรอบนี้ → ปล่อยให้หน้าเลื่อนปกติ
						e.preventDefault();
						var rect = h.getBoundingClientRect(), ox = e.clientX - rect.left, oy = e.clientY - rect.top;
						var cx = (h.scrollLeft + ox) / z, cy = (h.scrollTop + oy) / z;
						z = Math.min(Math.max(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 1), 8);
						nzInner.style.transform = 'scale(' + z + ')';
						h.scrollLeft = cx * z - ox; h.scrollTop = cy * z - oy;
					}, { passive: false });
				});
				var ok = rows[i].ok;
				el.querySelector('.vn-gram').innerHTML = '· กระดาษ <b>' + r(m.w) + '×' + r(m.l) + ' mm</b>' + (m.mc ? ' · เครื่อง: <b>' + m.mc + '</b>' : '') + ' · ยอดสั่ง <b>' + (qty ? qty.toLocaleString() : '?') + '</b> ตัว · ' +
					(gram ? ('แกรมงาน ' + gram + 'g ' + (ok ? '<span style="color:#16a34a">✅ รับได้</span>' : '<span style="color:#dc2626">⚠️ เกินช่วง ' + m.gmin + '-' + m.gmax + 'g</span>')) : 'ไม่ทราบแกรมงาน');
			}
			renderSel(selIdx);
			el.querySelector('.vn-sel').addEventListener('change', function () { renderSel(+this.value); });
		}
	}
})();
