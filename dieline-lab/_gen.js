// node _gen.js <type> <file.svg> <view> <foldT> <xray>
const fs = require('fs');
const type = process.argv[2] || '1';
const svgFile = process.argv[3];
const view = process.argv[4] || 'iso';
const foldT = process.argv[5] || '1.0';
const PROC = svgFile === 'PROC';
const svg = PROC ? '' : fs.readFileSync(svgFile, 'utf8');

const cams = {
  iso:    'cam.position.set(c.x+maxd*1.4, c.y+maxd*1.1, c.z+maxd*2.0);',
  front:  'cam.position.set(c.x, c.y, c.z+maxd*2.6);',
  top:    'cam.position.set(c.x+0.01, c.y+maxd*2.6, c.z);',
  bottom: 'cam.position.set(c.x+0.01, c.y-maxd*2.6, c.z);',
  under:  'cam.position.set(c.x+maxd*1.2, c.y-maxd*1.4, c.z+maxd*1.6);',
  isol:   'cam.position.set(c.x-maxd*1.4, c.y+maxd*0.9, c.z+maxd*1.9);',
  isolb:  'cam.position.set(c.x-maxd*1.4, c.y-maxd*0.9, c.z+maxd*1.9);',
  topiso: 'cam.position.set(c.x+maxd*1.0, c.y+maxd*2.0, c.z+maxd*1.2);',
  side:   'cam.position.set(c.x+maxd*2.6, c.y+maxd*0.3, c.z+0.01);',
};

const html = `<!doctype html><html><head><meta charset="utf8"><style>html,body{margin:0}</style></head>
<body><canvas id="cv" width="500" height="560"></canvas>
<script src="../../public/js/library/jquery-3.5.1.min.js"></script>
<script src="../../public/js/library/three.min.js"></script>
<script src="../../public/js/function_dieline_3d.js"><\/script>
<script>
var SVG = ${JSON.stringify(svg)};
window.addEventListener('load', function(){
  try {
    var r;
    if (${PROC ? 'true' : 'false'}) { var spec = window.__dieline3d.buildSpec({ type: ${type}, W: 202, L: 66, D: 39, G: 8, dust: 6, T: 12, OL: 5 }); r = window.__dieline3d.buildBoxGroup(spec, {}); }
    else { r = window.__dieline3d.buildSVGGroup(SVG, {}, ${type}); }
    window.__dieline3d.applyFold(r.folds, ${foldT});
    if (${process.argv[6] === 'xray' ? 'true' : 'false'}) { r.material.transparent = true; r.material.opacity = 0.30; r.material.depthWrite = false; }
    var _foldMode = ${process.argv[6] === 'fold' ? 'true' : 'false'};
    if (_foldMode) { var lm = r.group.userData.lineMats; if (lm) { lm.cut.color.setHex(0xdd1111); lm.fold.color.setHex(0x16a34a); lm.cut.depthTest = false; lm.fold.depthTest = false; } }
    r.group.traverse(function(o){ if (o.type==='LineSegments'||o.type==='Line') o.visible = _foldMode; });
    var scene = new THREE.Scene();
    scene.add(r.group);
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    var dl = new THREE.DirectionalLight(0xffffff, 0.55); dl.position.set(1,2,3); scene.add(dl);
    var dl2 = new THREE.DirectionalLight(0xffffff, 0.3); dl2.position.set(-1,-1,-2); scene.add(dl2);
    r.group.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(r.group);
    var c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    var maxd = Math.max(sz.x,sz.y,sz.z,0.001);
    var cam = new THREE.PerspectiveCamera(38, 500/560, 0.01, 1000);
    ${cams[view]}
    cam.lookAt(c);
    var renderer = new THREE.WebGLRenderer({canvas:document.getElementById('cv'), antialias:true});
    renderer.setClearColor(0xeaeefb);
    renderer.render(scene, cam);
    var dbg = 'OK folds=' + r.folds.length + ' size('+sz.x.toFixed(2)+','+sz.y.toFixed(2)+','+sz.z.toFixed(2)+')\\n';
    var nrm = new THREE.Matrix3();
    r.folds.forEach(function(f, i){
      if(!f.mesh) return;
      f.mesh.geometry.computeBoundingBox();
      var bb=f.mesh.geometry.boundingBox;
      var cc = bb.getCenter(new THREE.Vector3());
      f.mesh.localToWorld(cc);
      nrm.getNormalMatrix(f.mesh.matrixWorld);
      var n = new THREE.Vector3(0,0,1).applyMatrix3(nrm).normalize();
      var wbb = new THREE.Box3().setFromObject(f.mesh);
      dbg += (f.leaf?'leaf':'node')+'#'+i+' d='+f._d+' sgn='+f.sign+' ang='+(f.angle/Math.PI).toFixed(2)+'PI'+
             ' X['+wbb.min.x.toFixed(2)+'..'+wbb.max.x.toFixed(2)+']'+
             ' Y['+wbb.min.y.toFixed(2)+'..'+wbb.max.y.toFixed(2)+']'+
             ' Z['+wbb.min.z.toFixed(2)+'..'+wbb.max.z.toFixed(2)+']'+
             ' n('+n.x.toFixed(1)+','+n.y.toFixed(1)+','+n.z.toFixed(1)+')\\n';
    });
    var pre = document.createElement('pre'); pre.id='dbg'; pre.textContent = dbg; document.body.appendChild(pre);
    document.title = 'OK panels=' + r.folds.length;
  } catch(e){ document.title = 'ERR ' + e.message; document.body.innerHTML += '<pre>'+e.stack+'</pre>'; }
});
<\/script></body></html>`;
fs.mkdirSync('estimate', { recursive: true });
fs.writeFileSync('estimate/_r.html', html);
console.log('wrote for type', type);
