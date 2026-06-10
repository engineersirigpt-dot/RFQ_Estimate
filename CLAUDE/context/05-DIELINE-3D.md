# 05 — Dieline 3D Viewer (มุมมอง 3D + กางแบน)

ฟีเจอร์ปุ่ม **"3D"** ในหน้า estimate — เปิด popup แสดงกล่องบรรจุภัณฑ์ 3 มิติ พับ/กางได้ตามขนาดที่กรอก

> สรุป ณ ปัจจุบัน: **ทรง 1-7 พับจาก SVG จริง** (DiecutTemplates) · **ทรง 8-12 ยัง procedural เดิม**

---

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
| --- | --- |
| `public/js/function_dieline_3d.js` | **ทั้งหมดของ 3D viewer** (IIFE เดียว) — UI popup, Three.js viewer, 2 ตัว builder, SVG importer |
| `router/dieline.js` | Backend — proxy ไป diecuttemplates API + **เสิร์ฟ local SVG** (`/dieline/local/:type`) |
| `2D_Dieline/*.svg` | ไฟล์ SVG dieline จริง (ชื่อตรงกับ `BOX_NAMES`) — ถูก deploy ไป `~/Estimate-Packaging/2D_Dieline/` |
| `dieline-lab/` | **PoC / ห้องทดลอง** standalone (engine.js, svgimport.js, fold3d.js, index.html) — ใช้ลองก่อนพอร์ตเข้า production |

> ⚠️ `public/js/function_dieline_3d.js` มี **CRLF line endings** → ตอน Edit ต้องใช้ **single-line old_string** (multi-line จะ match ไม่เจอ). `dieline-lab/*.js` เป็น LF (multi-line ได้)
> หลังแก้ทุกครั้ง `cp` ไป `_dieline_3d_bundle/public/js/` ด้วย (sync bundle)

---

## 2 เส้นทาง (builder)

```
กดปุ่ม 3D → startViewer(d, fin) → buildModelAsync(d, fin, cb)
                                       │
              ┌────────────────────────┴─────────────────────────┐
       ทรงมี local SVG (LOCAL_SVG_TYPES = {1..7})          ทรงอื่น (8-12)
              │                                                   │
       fetch /dieline/local/{type} → buildSVGGroup(txt)    buildBoxGroup(buildSpec(d))
       (พับจาก SVG จริง)                                    (procedural fold-tree เดิม)
              └────────────────────────┬─────────────────────────┘
                          คืน { group, folds } รูปแบบเดียวกัน → Viewer.setScene
```

ทั้งคู่คืน `folds` แบบเดียวกัน `[{ pivot, axis:'x', sign, angle, phase }]` → **Viewer ใช้ `applyFold` ตัวเดียว ไม่ต้องแยก** (พอร์ต SVG เข้าโดยไม่แตะ Viewer = เสี่ยงน้อย)

ถ้า fetch SVG fail → fallback `buildBoxGroup` อัตโนมัติ (ไม่พัง)

---

## SVG → 3D pipeline (สำคัญสุด — อยู่ใน `SVGImp` + `buildSVGGroup`)

SVG จาก DiecutTemplates มีโครงสร้าง:
- `<g id="crease">` = เส้นพับ (stroke `#00FF00`)
- `<g id="cut">` = เส้นตัด (stroke `#FF0000`, มี `Arc` = มุมโค้ง)
- `<g id="dimensions">` = เส้นบอกขนาด → **ข้าม**

**ขั้นตอน `SVGImp.fromSVG(text)`:**
1. **parse path** — รองรับ command ติดเลข (`M351.4`) + sample Arc เป็น polyline
   - ⚠️ regex ดึง path ต้อง `\sd="..."` (กันไปแมตช์ `id="..."`)
2. **flip y** (SVG y-ลง → world y-ขึ้น)
3. **snapVerts** (tol 2pt) — รวมจุดใกล้กัน = ยุบ "material gap" (เส้นคู่ห่าง ~1.4pt จาก material 0.5mm)
4. **nodeSegments** — ตัดเส้นที่ **T-junction** (จุดยอดเส้นอื่นอยู่กลางเส้นนี้) → planar graph ปิดหน้าได้
   - 🔑 จำเป็นสำหรับ STE (มี 6 T-junction), RTE ไม่มีเลยเลยผ่านตั้งแต่แรก
5. **findFaces** — half-edge traversal หา "หน้า" (face) = panel; ตัด outer face (area ใหญ่สุด)
6. **pickRoot** — เลือก panel เป็นฐาน (อยู่นิ่ง)

**`pickRoot(panels)` — เลือกฐานให้พับปิดถูก:**
- "ผนัง" = panel ที่ `h ≥ 0.7 × maxH`
- เลือกผนังที่ **มีผนังเพื่อนบ้านมากสุด** (อยู่กลาง chain) **และฝาเพื่อนบ้านเตี้ย** (ไม่ใช่ tuck)
- score `= wallNeighbors*1e9 − maxFlapHeight*1e3 + area`
- 🔑 ถ้า root เป็นผนังที่มี tuck → ฝา tuck จะตั้งชี้ขึ้นไม่ปิด (เพราะ root นอนแบน)

**`buildTreeImp`** — BFS จาก root, แต่ละ edge ที่แชร์ = บานพับ
- 🔑 orient hinge A→B ให้ **centroid ลูกอยู่ซ้าย** (cross>0) → ทุก panel พับทิศเดียวกัน (sign=1) → กล่องปิด

**`buildSVGGroup`** — สร้าง Three.js:
- แต่ละ panel = `ShapeGeometry` ใน "เฟรมท้องถิ่น" (ขอบพับวางที่ origin ตามแกน +x)
- ห่อด้วย `joint`(วางตำแหน่ง+หันตามขอบ) + `fold`(หมุนพับรอบแกน x)
- **มุมพับ:** ปกติ 90° (`HALF`) — **ยกเว้น "ลิ้นในถาด"** (double-wall) พับ ~180°:
  - เงื่อนไข `isLip` = leaf + `depth≥2` + `area ≥ 0.8 × parentArea` → `fAngle = Math.PI*0.97`
  - 🔑 แยกถาด double-wall (5 Shirt Box: ลิ้นใหญ่กว่าผนัง ratio~1.3) จากกล่องฝาเสียบ (ฝา/ปีก ratio<0.5)
- **phase** สตักเกอร์ตามชั้น (`_d/maxDepth`) → animation พับไล่ชั้น

---

## การ render เส้น (สี + occlusion)

ใน `buildSVGGroup` แต่ละ panel:
- จัดประเภทขอบด้วย `ecount` (ขอบที่ panel 2 ชิ้นแชร์ = พับ, 1 ชิ้น = ตัด)
- **🔴 เส้นตัด = แดง** `0xdd1111` (`cutMat`) · **🟢 เส้นพับ = เขียว** `0x11aa33` (`foldMat`)
- **occlusion (เส้นโดนบังหาย):** `material.polygonOffset=true` (ดันผิวถอย) + เส้น `depthTest` ปกติ → เส้นบนผิวชนะ z-fight แต่โดนผนังที่อยู่หน้ากว่าบัง

> ทรง procedural (8-12) ยังใช้ระบบเส้นประↆทึบเดิม (`addCrease`, `_updateCreases`) — กาง=ประ, พับ=ทึบ

---

## กล้อง / การหมุน (`Viewer`)

- เปิดมา = **auto-follow**: กาง(t=0) มองตรงเห็น dieline, พับ(t=1) มุม 3D (ขับด้วย `_t` ใน `_loop`)
- **ผู้ใช้ลากหมุนเองได้** → ตั้ง `_userRot=true` → **หยุด auto-follow** ปล่อยให้คุมเอง (แก้กลับหัว/หันหลัง)
- ล้อ = ซูม · auto-fit ด้วย bounding sphere

---

## Backend — `router/dieline.js`

- `GET /dieline/local/:type` → เสิร์ฟไฟล์จาก `2D_Dieline/` (Content-Type svg)
- `POST /dieline/generate` → ถ้า `internal_template_id` มีใน `LOCAL_SVG` และ format=svg → คืน local URL **(ไม่ยิง API, ไม่ต้องมี key)**; ทรงอื่น → ยิง diecuttemplates API
- `LOCAL_SVG` = map `เลขทรง → ชื่อไฟล์`

`function_dieline_3d.js` ฝั่ง frontend:
- `LOCAL_SVG_TYPES = {1..7}` = ทรงที่พับจาก SVG
- กล่อง dieline มุมขวาบนใน popup **ถูกเอาออกแล้ว** (user ขอ — เกะกะ 3D)

---

## วิธีเพิ่มทรงใหม่ (เช่นทรง 8)

1. เซฟ SVG ลง `2D_Dieline/<ชื่อตรง BOX_NAMES>.svg` (จาก DiecutTemplates)
2. `router/dieline.js` → เพิ่มใน `LOCAL_SVG`: `'8': '<ชื่อไฟล์>.svg'`
3. `function_dieline_3d.js` → เพิ่มใน `LOCAL_SVG_TYPES`: `8: 1`
4. test import: `node -e "..."` ใน dieline-lab (ดูว่า panels ครบ) แล้ว render headless เช็คพับ
5. deploy (ดูล่าง) — **ถ้าพับเพี้ยน** มักเป็น pickRoot/ทิศพับ/มุมลิ้น → จูนเหมือนเคส STE/Shirt Box

---

## Deploy

```cmd
scp router\dieline.js webadmin@192.168.5.32:~/Estimate-Packaging/router/
scp public\js\function_dieline_3d.js webadmin@192.168.5.32:~/Estimate-Packaging/public/js/
scp -r 2D_Dieline webadmin@192.168.5.32:~/Estimate-Packaging/
```
```bash
pm2 restart estimate-frontend   # process รัน index.js (frontend + /dieline router)
```

---

## เทคนิค debug (render เช็คโดยไม่ต้องเปิด browser)

ใน `dieline-lab/` ใช้ **headless Edge + swiftshader** screenshot กล่อง 3D:
```bash
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=520,460 --screenshot=out.png "file:///c:/.../dieline-lab/test.html"
```
- ใช้ **file:// URL เต็ม** ห้ามมี `#hash` ในส่วน path (ทำให้หาไฟล์ไม่เจอ) — hash ใส่ท้าย URL ได้
- ทดลองใน lab (svgimport.js + fold3d.js) ก่อน แล้วค่อยพอร์ตเข้า production (โค้ดเดียวกันแต่ inline ใน function_dieline_3d.js)

---

## ประวัติบั๊กที่แก้ไปแล้ว (กันแก้ซ้ำ)

| อาการ | ต้นเหตุ | วิธีแก้ |
| --- | --- | --- |
| STE กางแบนเป็นก้อนใหญ่ผิด | T-junction → face ไม่ปิด | `nodeSegments` ตัด T-junction |
| STE ฝาตั้งชี้ขึ้นไม่ปิด | root เป็นผนังที่มี tuck | `pickRoot` เลือกผนังไม่มี tuck |
| Shirt Box Tray ลิ้นในนอนเป็นฝา | ลิ้น double-wall พับ 90° | ตรวจ `isLip` → พับ 180° |
| เส้นทะลุตอนพับ | ไม่มี occlusion | `polygonOffset` + depthTest |
| กล่องกลับหัว/หันหลัง | default orientation ต่อทรง | เปิด user หมุนเอง (`_userRot`) |

---

## Dieline v2 (generator ของเพื่อน) + แบบกางข้าง 3D

- `public/js/function_dieline_generator.js` — generator วาด SVG dieline เองจากสูตร (free, ไม่ใช้ API), ครบ 12 ทรง + **nesting/imposition + PDF export** อ่าน paper/gram/qty/machine จาก `est.mainData`
  - expose `window.__dielineV2 = { buildDielineSVG(d), buildExportSVG, readDims }`
  - inject ปุ่ม **"Dieline v2 (ฟรี)"** (`#dieline-v2-btn`) เอง → modal แยกต่างหาก
  - อ่านฟอร์มชุดเดียวกัน (`.specmm.*`, `est.mainData`) + เรียก `window.__dieline3d.readDims` → เข้ากับระบบได้ ไม่ชนกับ 3D
  - โหลดใน `estimate.ejs` (script tag หลัง function_dieline_3d.js)
  - **ใช้เทมเพตเดียวกับ 3D (ทรง 1-7):** `onV2Click` fetch `/dieline/local/{type}` → `ourSvgToBody()` (parse cut/crease + bbox pt, cache ตาม type) → `dielineCore()` เรียก `tplToBody()` bake พิกัด pt→mm scale ตามขนาดที่กรอก → display/nesting/%เสีย/PDF ใช้เทมเพตเรา. 8-12 ใช้ procedural. fetch fail → fallback. **bake เป็น mm จริง (ไม่ใช้ `<g transform>`)** เพราะ `parseShapes` (cross-nesting) อ่านพิกัด path ดิบ
- **แบบกางข้าง 3D:** ลองทำแล้ว (panel ขวาใน popup 3D, hybrid 1-7 SVG จริง / 8-12 generator เพื่อน) แต่ **user ขอเอาออก** — popup 3D เหลือกล่อง 3D เต็มจอ. ฟังก์ชัน `renderSideDieline(d)` ยังอยู่แต่ no-op (ไม่มี `#d3-dieline-side` แล้ว) — ถ้าจะเอากลับ เพิ่ม div `#d3-dieline-side` ใน modal คืน

## ค้าง / TODO

- ทรง **8-11** ยังเป็น procedural (ยังไม่มี SVG)
- SVG เป็น **ขนาดคงที่** (ตามไฟล์) — แก้ขนาด W/L/D ในป๊อปอัปไม่เปลี่ยน 3D ของทรง SVG. ถ้าอยาก real-time ต่อขนาด: (ก) ยิง API ต่อ size หรือ (ข) parameterize SVG เป็นสูตร
- ทรง 12 (Custom) ยังไม่ map
