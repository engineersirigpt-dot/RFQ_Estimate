// แปลง SVG ที่แยก cut/crease ด้วย "สี" (red stroke=cut, green fill thin-rect=crease) → group cut/crease มาตรฐาน
// node _color2groups.js <in.svg> <out.svg>
const fs = require('fs');
const inFile = process.argv[2], outFile = process.argv[3];
let s = fs.readFileSync(inFile, 'utf8');
const vb = (s.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 1357 1230';

function pathPts(d) {  // → จุดทั้งหมด (M L H V C Z), C sample
  var t = d.match(/[MLHVCZmlhvcz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [];
  var i = 0, cmd = null, cur = [0, 0], start = [0, 0], pts = [], segs = [];
  function n() { return parseFloat(t[i++]); }
  function push(p) { segs.push([cur, p]); pts.push(p); cur = p; }
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i]; i++; }
    var C = cmd.toUpperCase();
    if (C === 'M') { cur = [n(), n()]; start = cur.slice(); pts.push(cur); cmd = 'L'; }
    else if (C === 'L') push([n(), n()]);
    else if (C === 'H') push([n(), cur[1]]);
    else if (C === 'V') push([cur[0], n()]);
    else if (C === 'C') { var c1 = [n(), n()], c2 = [n(), n()], e = [n(), n()]; var N = 8, p0 = cur; for (var k = 1; k <= N; k++) { var u = k / N, m = 1 - u; var x = m*m*m*p0[0]+3*m*m*u*c1[0]+3*m*u*u*c2[0]+u*u*u*e[0]; var y = m*m*m*p0[1]+3*m*m*u*c1[1]+3*m*u*u*c2[1]+u*u*u*e[1]; push([x, y]); } }
    else if (C === 'Z') { segs.push([cur, start]); cur = start.slice(); }
    else i++;
  }
  return { pts: pts, segs: segs };
}
// แกนกลางของ thin-rect (crease เขียว): ปลาย = midpoint ของ 2 ขอบสั้นสุด
function centerline(d) {
  var r = pathPts(d), segs = r.segs;
  if (segs.length < 3) return segs[0] ? [segs[0][0], segs[0][1]] : null;
  var withLen = segs.map(function (s) { return { s: s, L: Math.hypot(s[1][0]-s[0][0], s[1][1]-s[0][1]) }; });
  withLen.sort(function (a, b) { return a.L - b.L; });
  var e1 = withLen[0].s, e2 = withLen[1].s;
  var m1 = [(e1[0][0]+e1[1][0])/2, (e1[0][1]+e1[1][1])/2];
  var m2 = [(e2[0][0]+e2[1][0])/2, (e2[0][1]+e2[1][1])/2];
  return [m1, m2];
}

var cutSegs = [], creaseSegs = [];
[...s.matchAll(/<path[^>]*>/g)].forEach(function (m) {
  var tag = m[0];
  var d = (tag.match(/\bd="([^"]+)"/) || [])[1]; if (!d) return;
  var stroke = (tag.match(/stroke="([^"]+)"/) || [])[1] || '';
  var fill = (tag.match(/fill="([^"]+)"/) || [])[1] || '';
  if (/FF0000|red/i.test(stroke)) {                                 // แดง stroke = cut boundary (โค้ง) → segments
    pathPts(d).segs.forEach(function (sg) { if (Math.hypot(sg[1][0]-sg[0][0], sg[1][1]-sg[0][1]) > 0.3) cutSegs.push(sg); });
  } else if (/FF0000|FF0101/i.test(fill)) { var cc = centerline(d); if (cc) cutSegs.push(cc); }   // แดง fill thin-rect = cut → แกนกลาง
  else if (/00FF00|green/i.test(fill)) { var c = centerline(d); if (c) creaseSegs.push(c); }       // เขียว fill = crease → แกนกลาง
  // ดำ (dimension) ทิ้ง
});
// ---- weld ปลาย cut ที่ใกล้กัน (ปิดช่องว่างขอบ) ----
function weld(segList, tol) { var cl = []; function rep(p) { for (var i = 0; i < cl.length; i++) if (Math.hypot(cl[i][0]-p[0], cl[i][1]-p[1]) <= tol) return cl[i]; var c = [p[0], p[1]]; cl.push(c); return c; } segList.forEach(function (s) { s[0] = rep(s[0]); s[1] = rep(s[1]); }); }
weld(cutSegs, 5);
// ---- snap ปลาย crease ไปติด cut/crease ใกล้สุด (ปิด panel) ----
function nearestOn(p, list, skip, tol) { var best = null, bd = tol; list.forEach(function (s) { if (s === skip) return; var ax = s[0][0], ay = s[0][1], bx = s[1][0], by = s[1][1]; var dx = bx - ax, dy = by - ay, L2 = dx*dx+dy*dy; if (L2 < 1e-6) return; var t = ((p[0]-ax)*dx+(p[1]-ay)*dy)/L2; t = Math.max(0, Math.min(1, t)); var qx = ax+t*dx, qy = ay+t*dy, d = Math.hypot(p[0]-qx, p[1]-qy); if (d < bd) { bd = d; best = [qx, qy]; } }); return best; }
creaseSegs.forEach(function (s) { [0, 1].forEach(function (e) { var sn = nearestOn(s[e], cutSegs, null, 12) || nearestOn(s[e], creaseSegs, s, 12); if (sn) s[e] = sn; }); });
console.log('cut segs:', cutSegs.length, '| crease:', creaseSegs.length, '(welded+snapped)');

function pd(s) { return 'M' + s[0][0].toFixed(2) + ' ' + s[0][1].toFixed(2) + ' L' + s[1][0].toFixed(2) + ' ' + s[1][1].toFixed(2); }
var out = '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg">\n<g id="cut">\n';
out += cutSegs.map(function (s) { return '  <path d="' + pd(s) + '" fill="none" stroke="#FF0000" stroke-width="1.5"/>'; }).join('\n');
out += '\n</g>\n<g id="crease">\n';
out += creaseSegs.map(function (s) { return '  <path d="' + pd(s) + '" fill="none" stroke="#00AA00" stroke-width="1.5" stroke-dasharray="8,4"/>'; }).join('\n');
out += '\n</g>\n</svg>\n';
fs.writeFileSync(outFile, out);
console.log('wrote', outFile);
