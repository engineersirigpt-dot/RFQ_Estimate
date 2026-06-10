# Dieline 2D + 3D — สถานะปัจจุบัน (อัปเดตล่าสุด)

เอกสารนี้บันทึกงาน dieline ทั้ง 3D viewer และ 2D dieline (v2) — อ่านชุดนี้เมื่อ context เต็ม

## สถาปัตยกรรม: แยก 3D / 2D

```
3D viewer  →  /dieline/local/:type   →  โฟลเดอร์ 2D_Dieline/   (template มี group cut/crease — พับสะอาด)
2D dieline →  /dieline/v2svg/:type   →  โฟลเดอร์ Diline_svg/    (ไฟล์ใหม่ — fallback ไป 2D_Dieline ถ้าไม่มี)
```

- Router: `router/dieline.js` — route `/local/:type` (3D) + `/v2svg/:type` (2D) · map `LOCAL_SVG` (ชื่อไฟล์ 1-11)
- SVG template format: `<g id="cut">` (แดง) + `<g id="crease">` (เขียวประ) + `<g id="perforation">` (เหลือง) + `<g id="dimensions">` (ทิ้ง)

## ไฟล์หลัก

| ไฟล์ | หน้าที่ |
|---|---|
| `public/js/function_dieline_3d.js` | 3D viewer — พับ SVG เป็น 3D (buildSVGGroup) + procedural (buildBoxGroup/buildGable/buildPillow) + ปุ่มเส้น toggle |
| `public/js/function_dieline_generator.js` | 2D dieline v2 — สร้าง dieline จากสูตร+template + nesting (วางกระดาษ) + export PDF/SVG |
| `router/dieline.js` | เสิร์ฟ SVG (/local, /v2svg) |
| `2D_Dieline/` | template 3D (group-based) |
| `Diline_svg/` | template 2D (ไฟล์ใหม่ของผู้ใช้) |

## 3D fold engine (function_dieline_3d.js → buildSVGGroup)

- **LOCAL_SVG_TYPES** = {1,2,3,4,5,6,7,8,9,11} → พับจาก SVG · ทรง 10 (pillow), 12 (custom) = procedural
- **buildTreeImp = max-spanning-tree (Prim's):** ต่อ panel กับ parent ผ่าน "ขอบที่ยาวที่สุด" → ปีกต่อกับผนัง (ขอบยาว) ไม่ใช่ลิ้นเสียบ (ขอบสั้น) → **ปีก dust พับ 90° เข้าในถูกต้อง** (แก้ทรง 1)
- **กฎพับพิเศษ (ใน rec + post-pass):**
  - `isLip` (leaf ใหญ่ ≥0.8 parent, depth≥2) → พับ 180° (double-wall lip ถาด)
  - `isEar` (boxType 5, leaf เล็ก, 90°) → พับ 180° แนบผนัง (หูมุมถาด)
  - `isLid` (boxType 7) → พับ 0.4×90° (ฝาเปิดค้าง)
  - lip clip → ตัดลิ้นที่ยาวเกินผนัง (ไม่โผล่)
  - **flatten post-pass:** ปีกเล็กตั้งฉาก up-axis ณ ปลายปิด → พับราบ (up = แกน area-weighted ที่ผนังหันน้อยสุด)
  - **parent-based flatten:** ลิ้นเล็กตั้งฉากกับ parent ที่เป็นปีกเล็ก → พับราบ (แก้ลิ้นล็อก auto-bottom ทรง 4)
  - **toward-center sign:** ปีกพับเข้าหาจุดกลางกล่อง
- **ทรง 8 gable (SVG fold):** roof (flat-Y ครึ่งล่าง) พับ 0.62×90° ลาด + จั่ว (ครึ่งบนถึง apex) พับ 0.55×90° → ขึ้นสันจั่ว (gate boxType===8)
- **ปุ่มเส้น toggle (`#d3-foldlines`):** OFF = ไม่มีเส้น (กล่อง solid) · ON = เส้น cut(แดง)/fold(เขียว) **depthTest off = x-ray เห็นครบ 2 ฝั่ง**
- console marker: `[dieline3d] build vN` (เช็คว่า deploy ติด)

## 2D dieline v2 (function_dieline_generator.js)

- `dielineCore(d)` → builder ตาม type → ถ้ามี template (`_localBodyCache`) ใช้ `tplToBody` scale ตามขนาดที่กรอก
- `ourSvgToBody` → ดึง group cut/crease/**perforation** (เพิ่ม perf แล้ว · สีทอง #eab308 ปรุ)
- fetch จาก `/dieline/v2svg/` (โฟลเดอร์ Diline_svg)
- **Nesting (วางกระดาษ):** straight vs ไขว้ (interlock) · เทียบ 6 ขนาดกระดาษ (MACHINE_PAPERS) · %เสีย, kg, ฿
- **Ups match (สำคัญ):** `getProdLayout()` อ่าน `item.layout.selected_layout.num_laying` (Ups สูตรระบบ) → กระดาษที่ตรงกับ layout ระบบ → nesting ใช้ Ups ตรงๆ + วาด grid จริง (cols×rows แชร์ขอบ) · กระดาษอื่น = nesting ประมาณ
  - เหตุผล: Ups สูตรระบบ (`setCalculateWSide/LSide` ใน function_estimate_layout.js) รู้การแชร์ขอบเฉพาะทรง → แม่นกว่า nesting generic

## Tools (dieline-lab/)

- `_gen.js` — harness render 3D headless (Edge swiftshader) · `node _gen.js <type> <svg> <view> <foldT> <off|fold|xray>`
- `_v2gen.js` — harness render 2D dieline เทียบ template
- `_color2groups.js` — แปลง SVG ที่แยกด้วยสี (red stroke=cut, green fill=crease) → group cut/crease
- `_autodetect.js` — แปลง outline ดำล้วน → cut/crease ด้วย face-finding (ขอบนอก=cut, แชร์=crease)
- `_analyze8.js` — รัน SVG parser ใน Node ดูโครงสร้าง panel

## รูปแบบ SVG ที่ผู้ใช้ทำจาก Figma

- **ดีสุด:** มี `<g id="cut">` (stroke แดง) + `<g id="crease">` (stroke เขียว) แยก layer → ใช้ได้ทันที
- color-based (ไม่มี group): red stroke=cut, green fill thin-rect=crease → `_color2groups.js`
- ดำล้วน (เส้นประ=ท่อนสั้น): `_autodetect.js` (face-finding)
- ⚠️ outline หยาบจาก Figma มักพับ 3D ไม่สะอาด (panel ไม่ปิดเป๊ะ) — 2D nesting ใช้ได้ (แค่ขอบ/bbox)

## Deploy

```
scp public\js\function_dieline_3d.js public\js\function_dieline_generator.js webadmin@192.168.5.32:~/Estimate-Packaging/public/js/
scp router\dieline.js webadmin@192.168.5.32:~/Estimate-Packaging/router/
scp -r Diline_svg 2D_Dieline webadmin@192.168.5.32:~/Estimate-Packaging/
ssh: pm2 restart estimate-frontend    # router เปลี่ยน → restart
browser: Ctrl+Shift+R
```
