// node _v2gen.js <type> <file.svg>  → estimate/_v2.html (ซ้าย=v2 dieline, ขวา=template ดิบ)
const fs = require('fs');
const type = process.argv[2] || '1';
const svgFile = process.argv[3];
const svg = fs.readFileSync(svgFile, 'utf8');
// dims กลางๆ
const dims = { 1:{W:60,L:95,D:30}, 2:{W:60,L:95,D:30}, 3:{W:70,L:100,D:40}, 4:{W:70,L:100,D:40},
  5:{W:120,L:200,D:40}, 6:{W:120,L:200,D:40}, 7:{W:120,L:160,D:40}, 8:{W:90,L:140,D:80},
  9:{W:60,L:95,D:30}, 10:{W:80,L:120,D:25}, 11:{W:60,L:95,D:30}, 12:{W:80,L:100,D:40} };
const dm = dims[type] || {W:80,L:120,D:50};
const d = { type:+type, W:dm.W, L:dm.L, D:dm.D, T:15, G:10, dust:8, OL:5 };

const html = `<!doctype html><html><head><meta charset="utf8"><style>
html,body{margin:0;font-family:sans-serif}
.row{display:flex}.col{flex:1;padding:6px;box-sizing:border-box}
.ttl{font-size:13px;font-weight:bold;color:#334155;margin-bottom:4px}
.box{border:1px solid #e2e8f0;background:#fff;min-height:300px}
svg{width:100%;height:auto;display:block}
</style></head><body>
<div class="row">
  <div class="col"><div class="ttl">v2 dieline (type ${type}) — สูตร+template scale</div><div class="box" id="v2"></div></div>
  <div class="col"><div class="ttl">template ดิบ (3D ใช้ตัวนี้)</div><div class="box" id="raw"></div></div>
</div>
<script src="../../public/js/library/jquery-3.5.1.min.js"></script>
<script src="../../public/js/function_dieline_generator.js"><\/script>
<script>
var SVG = ${JSON.stringify(svg)};
var D = ${JSON.stringify(d)};
window.addEventListener('load', function(){
  try {
    window.__dielineV2._setCache(${type}, SVG);
    document.getElementById('v2').innerHTML = window.__dielineV2.buildDielineSVG(D);
    document.getElementById('raw').innerHTML = SVG.replace(/<svg /, '<svg style="width:100%;height:auto" ');
    document.title = 'OK';
  } catch(e){ document.title = 'ERR '+e.message; document.body.innerHTML += '<pre>'+e.stack+'</pre>'; }
});
<\/script></body></html>`;
fs.mkdirSync('estimate', { recursive: true });
fs.writeFileSync('estimate/_v2.html', html);
console.log('wrote v2 harness type', type);
