// Auto-detect cut/crease: เส้นนอกทึบ(ต่อกัน)=cut · เส้นในประ(สั้น/ปลายลอย)=crease → merge collinear → group cut/crease
// node _autodetect.js <in.svg> <out.svg>
const fs = require('fs');
const inFile = process.argv[2], outFile = process.argv[3];
let s = fs.readFileSync(inFile, 'utf8');
const vb = (s.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 411 247';

function parsePath(d) {
  var t = d.match(/[MLHVCZmlhvcz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || [];
  var i = 0, cmd = null, cur = [0, 0], start = [0, 0], out = [];
  function n() { return parseFloat(t[i++]); }
  function bez(p0, p1, p2, p3) { var seg = [], N = 8, prev = p0; for (var k = 1; k <= N; k++) { var u = k / N, m = 1 - u; var x = m*m*m*p0[0]+3*m*m*u*p1[0]+3*m*u*u*p2[0]+u*u*u*p3[0]; var y = m*m*m*p0[1]+3*m*m*u*p1[1]+3*m*u*u*p2[1]+u*u*u*p3[1]; seg.push([prev, [x, y]]); prev = [x, y]; } return seg; }
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i]; i++; }
    var C = cmd.toUpperCase();
    if (C === 'M') { cur = [n(), n()]; start = cur.slice(); cmd = 'L'; }
    else if (C === 'L') { var p = [n(), n()]; out.push([cur, p]); cur = p; }
    else if (C === 'H') { var p2 = [n(), cur[1]]; out.push([cur, p2]); cur = p2; }
    else if (C === 'V') { var p3 = [cur[0], n()]; out.push([cur, p3]); cur = p3; }
    else if (C === 'C') { var c1 = [n(), n()], c2 = [n(), n()], e = [n(), n()]; bez(cur, c1, c2, e).forEach(function (sg) { out.push(sg); }); cur = e; }
    else if (C === 'Z') { out.push([cur, start]); cur = start.slice(); }
    else { i++; }
  }
  return out;
}
var segs = [];
[...s.matchAll(/<path[^>]*\bd="([^"]+)"/g)].forEach(function (p) { parsePath(p[1]).forEach(function (sg) { if (Math.hypot(sg[1][0]-sg[0][0], sg[1][1]-sg[0][1]) > 0.3) segs.push(sg); }); });

// ---- group collinear → ต่อเนื่อง=cut, มีช่องว่าง(ประ)=crease ----
function lineKey(s) { var dx = s[1][0] - s[0][0], dy = s[1][1] - s[0][1]; var ang = Math.atan2(dy, dx); if (ang < 0) ang += Math.PI; var nx = -Math.sin(ang), ny = Math.cos(ang); var off = s[0][0] * nx + s[0][1] * ny; return Math.round(ang / Math.PI * 180 / 2) + '|' + Math.round(off / 2.5); }
var groups = {};
segs.forEach(function (s) { var k = lineKey(s); (groups[k] = groups[k] || []).push(s); });
var cutM = [], creaseM = [];
Object.keys(groups).forEach(function (key) {
  var g = groups[key]; var s0 = g[0]; var dx = s0[1][0] - s0[0][0], dy = s0[1][1] - s0[0][1], L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  var iv = g.map(function (s) { var t0 = s[0][0] * dx + s[0][1] * dy, t1 = s[1][0] * dx + s[1][1] * dy; return t0 < t1 ? [t0, t1, s[0], s[1]] : [t1, t0, s[1], s[0]]; });
  iv.sort(function (a, b) { return a[0] - b[0]; });
  var hasGap = false, runs = [], cur = [iv[0][0], iv[0][1], iv[0][2], iv[0][3]];
  for (var i = 1; i < iv.length; i++) { var gap = iv[i][0] - cur[1]; if (gap > 2.0) { hasGap = true; runs.push(cur); cur = [iv[i][0], iv[i][1], iv[i][2], iv[i][3]]; } else if (iv[i][1] > cur[1]) { cur[1] = iv[i][1]; cur[3] = iv[i][3]; } }
  runs.push(cur);
  if (g.length >= 2 && hasGap) creaseM.push([iv[0][2], iv[iv.length - 1][3]]);   // ประ → merge เต็มช่วง = เส้นต่อเนื่อง
  else runs.forEach(function (r) { cutM.push([r[2], r[3]]); });                  // ทึบ
});
cutM = cutM.filter(function (s) { return Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > 1; });
creaseM = creaseM.filter(function (s) { return Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) > 1; });
// ---- snap ปลาย crease ไปติด cut/crease ใกล้สุด (ปิด panel ให้ 3D พับได้) ----
function nearestOn(p, list, skip, tol) { var best = null, bd = tol; list.forEach(function (s) { if (s === skip) return; var ax = s[0][0], ay = s[0][1], bx = s[1][0], by = s[1][1]; var dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy; if (L2 < 1e-6) return; var t = ((p[0] - ax) * dx + (p[1] - ay) * dy) / L2; t = Math.max(0, Math.min(1, t)); var qx = ax + t * dx, qy = ay + t * dy, d = Math.hypot(p[0] - qx, p[1] - qy); if (d < bd) { bd = d; best = [qx, qy]; } }); return best; }
creaseM.forEach(function (s) { [0, 1].forEach(function (e) { var sn = nearestOn(s[e], cutM, null, 9) || nearestOn(s[e], creaseM, s, 9); if (sn) s[e] = sn; }); });
console.log('raw segs:', segs.length, '| groups:', Object.keys(groups).length, '| cut:', cutM.length, '| crease:', creaseM.length, '(snapped ends)');

function pd(s) { return 'M' + s[0][0].toFixed(2) + ' ' + s[0][1].toFixed(2) + ' L' + s[1][0].toFixed(2) + ' ' + s[1][1].toFixed(2); }
var out = '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg">\n<g id="cut">\n';
out += cutM.map(function (s) { return '  <path d="' + pd(s) + '" fill="none" stroke="#FF0000" stroke-width="1"/>'; }).join('\n');
out += '\n</g>\n<g id="crease">\n';
out += creaseM.map(function (s) { return '  <path d="' + pd(s) + '" fill="none" stroke="#00AA00" stroke-width="1" stroke-dasharray="6,3"/>'; }).join('\n');
out += '\n</g>\n</svg>\n';
fs.writeFileSync(outFile, out);
console.log('wrote', outFile);
