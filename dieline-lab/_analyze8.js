// Standalone: รัน SVGImp parser + max-span-tree บน SVG เพื่อดูโครงสร้าง panel
const fs = require('fs');
const svgFile = process.argv[2];
const svgText = fs.readFileSync(svgFile, 'utf8');

// ---- SVGImp (คัดจาก function_dieline_3d.js) ----
function parsePath(d) {
  var t = d.match(/[MLAZmlaz]|-?\d*\.?\d+(?:[eE]-?\d+)?/g) || []; var i = 0, cur = null, out = [], cmd = null;
  function num() { return parseFloat(t[i++]) }
  while (i < t.length) {
    if (/[A-Za-z]/.test(t[i])) { cmd = t[i].toUpperCase(); i++ }
    if (cmd === 'M') { cur = [num(), num()] }
    else if (cmd === 'L') { var p = [num(), num()]; out.push({ type: 'line', a: cur, b: p }); cur = p }
    else if (cmd === 'A') { var rx = num(), ry = num(), rot = num(), large = num(), sweep = num(), p2 = [num(), num()]; out.push({ type: 'line', a: cur, b: p2 }); cur = p2 }
    else { i++ }
  }
  return out;
}
function extractGroup(svg, id) {
  var re = new RegExp('<g[^>]*id="' + id + '"[^>]*>([\\s\\S]*?)</g>'); var m = re.exec(svg); if (!m) return [];
  var body = m[1], segs = [], pm, pre = /\sd="([^"]+)"/g;
  while ((pm = pre.exec(body))) parsePath(pm[1]).forEach(function (s) { segs.push(s) });
  return segs;
}
function snapVerts(segs, tol) {
  tol = tol || 2.0; var reps = [];
  function rep(p) { for (var i = 0; i < reps.length; i++) { if (Math.abs(reps[i][0] - p[0]) <= tol && Math.abs(reps[i][1] - p[1]) <= tol) return reps[i] } var r = [p[0], p[1]]; reps.push(r); return r }
  segs.forEach(function (s) { s.a = rep(s.a); s.b = rep(s.b) });
  return segs.filter(function (s) { return Math.abs(s.a[0] - s.b[0]) > tol * 0.5 || Math.abs(s.a[1] - s.b[1]) > tol * 0.5 });
}
function vkey(p) { return Math.round(p[0]) + ',' + Math.round(p[1]) }
function nodeSegments(segs) {
  var vmap = {}, verts = [];
  segs.forEach(function (s) {[s.a, s.b].forEach(function (p) { var k = vkey(p); if (!vmap[k]) { vmap[k] = 1; verts.push(p) } }) });
  var out = [];
  segs.forEach(function (s) {
    var dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], L2 = dx * dx + dy * dy;
    if (L2 < 1) { out.push(s); return }
    var cuts = [];
    verts.forEach(function (v) { var t = ((v[0] - s.a[0]) * dx + (v[1] - s.a[1]) * dy) / L2; if (t <= 0.001 || t >= 0.999) return; if (Math.hypot(v[0] - (s.a[0] + t * dx), v[1] - (s.a[1] + t * dy)) < 1.5) cuts.push({ t: t, p: v }) });
    if (!cuts.length) { out.push(s); return }
    cuts.sort(function (a, b) { return a.t - b.t }); var prev = s.a;
    cuts.forEach(function (c) { out.push({ type: 'line', a: prev, b: c.p }); prev = c.p }); out.push({ type: 'line', a: prev, b: s.b });
  });
  return out;
}
function findFaces(segs) {
  var vmap = {}, verts = [];
  function vid(p) { var k = vkey(p); if (vmap[k] == null) { vmap[k] = verts.length; verts.push([p[0], p[1]]) } return vmap[k] }
  var emap = {}, edges = [];
  segs.forEach(function (s) { var u = vid(s.a), v = vid(s.b); if (u === v) return; var k = u < v ? u + '_' + v : v + '_' + u; if (emap[k] == null) { emap[k] = edges.length; edges.push({ u: u, v: v }) } });
  var darts = [], outAt = verts.map(function () { return [] });
  edges.forEach(function (e) {
    var d1 = { from: e.u, to: e.v }, d2 = { from: e.v, to: e.u };
    d1.ang = Math.atan2(verts[e.v][1] - verts[e.u][1], verts[e.v][0] - verts[e.u][0]);
    d2.ang = Math.atan2(verts[e.u][1] - verts[e.v][1], verts[e.u][0] - verts[e.v][0]);
    darts.push(d1, d2); outAt[e.u].push(d1); outAt[e.v].push(d2);
  });
  outAt.forEach(function (lst) { lst.sort(function (a, b) { return a.ang - b.ang }) });
  function nextDart(d) { var v = d.to, lst = outAt[v], idx = -1; for (var i = 0; i < lst.length; i++) { if (lst[i].to === d.from) { idx = i; break } } return lst[(idx - 1 + lst.length) % lst.length] }
  var used = {}, faces = [];
  darts.forEach(function (d, di) { d._i = di });
  darts.forEach(function (d) { if (used[d._i]) return; var face = [], cur = d, guard = 0; do { used[cur._i] = 1; face.push(cur.from); cur = nextDart(cur); if (++guard > 2000) break } while (cur._i !== d._i); if (face.length >= 3) faces.push(face) });
  function area(f) { var s = 0; for (var i = 0; i < f.length; i++) { var a = verts[f[i]], b = verts[f[(i + 1) % f.length]]; s += a[0] * b[1] - b[0] * a[1] } return s / 2 }
  var wa = faces.map(function (f) { return { f: f, a: area(f) } }); wa.sort(function (x, y) { return Math.abs(y.a) - Math.abs(x.a) });
  var outer = wa[0];
  return { verts: verts, faces: wa.filter(function (w) { return w !== outer && Math.abs(w.a) > 1 }).map(function (w) { return w.f }) };
}
function ekey(a, b) { var r = function (n) { return Math.round(n * 2) / 2 }; var pa = r(a[0]) + ',' + r(a[1]), pb = r(b[0]) + ',' + r(b[1]); return pa < pb ? pa + '|' + pb : pb + '|' + pa }
function fromSVG(svgText) {
  var cr = extractGroup(svgText, 'crease'), ct = extractGroup(svgText, 'cut'); var all = cr.concat(ct);
  all.forEach(function (s) { s.a = [s.a[0], -s.a[1]]; s.b = [s.b[0], -s.b[1]] });
  all = snapVerts(all, 2.0); all = nodeSegments(all);
  var res = findFaces(all);
  var panels = res.faces.map(function (f, i) { var segs = []; for (var k = 0; k < f.length; k++) { var a = res.verts[f[k]], b = res.verts[f[(k + 1) % f.length]]; segs.push({ type: 'line', a: [a[0], a[1]], b: [b[0], b[1]] }) } return { id: 'p' + i, segs: segs } });
  return { panels: panels, rootId: pickRoot(panels) };
}
function pickRoot(panels) {
  var info = panels.map(function (p) { var ys = p.segs.map(function (s) { return s.a[1] }); var ar = 0; p.segs.forEach(function (e) { ar += e.a[0] * e.b[1] - e.b[0] * e.a[1] }); return { h: Math.max.apply(0, ys) - Math.min.apply(0, ys), a: Math.abs(ar / 2) } });
  var maxH = Math.max.apply(0, info.map(function (x) { return x.h })); var isWall = info.map(function (x) { return x.h >= 0.7 * maxH });
  var em = {}; panels.forEach(function (p, pi) { p.segs.forEach(function (s) { var k = ekey(s.a, s.b); (em[k] = em[k] || []).push(pi) }) });
  var nb = panels.map(function () { return {} }); Object.keys(em).forEach(function (k) { var e = em[k]; if (e.length === 2) { nb[e[0]][e[1]] = 1; nb[e[1]][e[0]] = 1 } });
  var bestI = 0, bestScore = -1e18;
  panels.forEach(function (p, i) { if (!isWall[i]) return; var wn = 0, maxFlap = 0; Object.keys(nb[i]).forEach(function (j) { if (isWall[+j]) wn++; else if (info[+j].h > maxFlap) maxFlap = info[+j].h }); var score = wn * 1e9 - maxFlap * 1e3 + info[i].a; if (score > bestScore) { bestScore = score; bestI = i } });
  return panels[bestI].id;
}
// ---- max-span-tree (Prim's) ----
function buildTree(geo, rootId) {
  var edgeMap = {};
  geo.panels.forEach(function (p, pi) { p.segs.forEach(function (s) { var k = ekey(s.a, s.b); (edgeMap[k] = edgeMap[k] || []).push({ pi: pi, a: s.a, b: s.b }) }) });
  var adj = geo.panels.map(function () { return [] });
  Object.keys(edgeMap).forEach(function (k) { var e = edgeMap[k]; if (e.length === 2) { var L = Math.hypot(e[0].a[0] - e[0].b[0], e[0].a[1] - e[0].b[1]); adj[e[0].pi].push({ nb: e[1].pi, len: L }); adj[e[1].pi].push({ nb: e[0].pi, len: L }) } });
  var rootIdx = 0; geo.panels.forEach(function (p, i) { if (p.id === rootId) rootIdx = i });
  var parent = {}, depth = {}; parent[rootIdx] = -1; depth[rootIdx] = 0;
  var visited = {}; visited[rootIdx] = 1; var frontier = adj[rootIdx].map(function (e) { return { from: rootIdx, e: e } });
  while (frontier.length) {
    var best = -1, bi = -1; for (var i = 0; i < frontier.length; i++) { if (!visited[frontier[i].e.nb] && frontier[i].e.len > best) { best = frontier[i].e.len; bi = i } }
    if (bi < 0) break; var pick = frontier[bi]; frontier.splice(bi, 1); var nb = pick.e.nb; if (visited[nb]) continue;
    visited[nb] = 1; parent[nb] = pick.from; depth[nb] = depth[pick.from] + 1;
    adj[nb].forEach(function (e) { if (!visited[e.nb]) frontier.push({ from: nb, e: e }) });
  }
  return { parent: parent, depth: depth };
}

var geo = fromSVG(svgText);
var tree = buildTree(geo, geo.rootId);
console.log('panels:', geo.panels.length, 'root:', geo.rootId);
geo.panels.forEach(function (p, i) {
  var xs = p.segs.map(s => s.a[0]), ys = p.segs.map(s => s.a[1]);
  var minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  var ar = 0; p.segs.forEach(e => ar += e.a[0] * e.b[1] - e.b[0] * e.a[1]); ar = Math.abs(ar / 2);
  var nv = p.segs.length;
  var pi = geo.panels.indexOf(p);
  console.log(p.id + ' verts=' + nv + ' area=' + (ar / 1000).toFixed(0) + 'k X[' + minX.toFixed(0) + '..' + maxX.toFixed(0) + '] Y[' + minY.toFixed(0) + '..' + maxY.toFixed(0) + '] W=' + (maxX - minX).toFixed(0) + ' H=' + (maxY - minY).toFixed(0) + ' d=' + tree.depth[i] + ' parent=' + (tree.parent[i] >= 0 ? geo.panels[tree.parent[i]].id : 'ROOT'));
});
