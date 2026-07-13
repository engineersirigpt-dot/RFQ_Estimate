# Dieline shape detection — production เขาทำกันยังไงจริง (deep-search กรกฎา 2026)

> **TL;DR reframe:** เราพยายามทำ**เวอร์ชันที่ยากสุดของปัญหา** (จับทรงจาก artwork raster ด้วย CNN) ซึ่ง **อุตสาหกรรมจริงเลี่ยง** — เพราะ style เป็น metadata ที่เกิดพร้อมไฟล์ (จาก CAD template) หรืออ่านจาก vector layer (cut/crease) ไม่ใช่เดาจาก pixel

## สิ่งที่ค้นเจอ (5 ข้อ)

### 1. อุตสาหกรรมมี "standard code" อยู่แล้ว — FEFCO + ECMA
- **FEFCO** (กล่องลูกฟูก, 4 หลัก เช่น 0201) · **ECMA** (folding carton, ตัวอักษร+เลข)
- **ECMA ครอบ >70% ตลาด folding carton โลก + เป็นฐานของ automated workflow ส่วนใหญ่**
- code = **ทรง** (dimension แยกต่างหาก) → ระบุ code + L/W/D พอ
- **ทรง 1-12 ของเราคือ subset ที่ simplify มาจาก ECMA** ที่ formalize ไว้แล้ว (มีนิยาม geometry ชัด)

### 2. Production เลือก style ตอน "design" ไม่ได้เดาจากรูป
- **Esko ArtiosCAD** (CAD มาตรฐานอุตสาหกรรม) มี **parametric standards library (US/ECMA/FEFCO)**
- designer **เลือก style จาก StyleMaker menu → ใส่ dimension → CAD generate dieline ให้** — style เป็น metadata ที่ **เกิดมาพร้อมไฟล์**
- แปลว่า "จับทรงจากภาพ" เป็นปัญหาที่ **production หลีกเลี่ยง** เพราะเขารู้ทรงตั้งแต่ต้น

### 3. Estimating software รับ input แบบ structured ไม่ใช่ raster
- corrugated estimating: **import CAD/PDF + true-shape nesting** · "incoming RFQ เป็น structured (dimension/material/volume อ่านได้เลย)"
- quote จาก request ที่ setup แล้ว = **5-15 นาที** (เทียบ Excel/email 1-2 ชม.)

### 4. ML ที่มีจริง = ทำบน "topology graph" ไม่ใช่ raster
- **B-rep Graph Neural Network (GNN)** สำหรับ CAD classification/feature recognition — แปลง solid เป็น graph (face=node, adjacency=edge) แล้วเรียน **topology** ไม่ใช่ pixel
- USPTO patent: ML สำหรับ **sketch→vector** (ทำเส้นให้ตรง, จับ cut-line จาก sketch)
- **ไม่เจอ paper "ECMA code จาก dieline image" โดยตรง** = ไม่ใช่ task ที่คนแก้ด้วย vision เพราะแก้ด้วย structure ได้

### 5. Geometry เวิร์คบน vector สะอาด (เราพิสูจน์เองแล้ว)
- `geom_svg.py` แยก tuck vs auto-bottom จาก crash-lock diagonal ได้บน SVG สะอาด
- fail บน artwork PDF เพราะเส้นลายพิมพ์กลบ — **แต่ถ้าได้ vector dieline จริง (cut/crease layer) มันทำงาน**

## ทางเลือกที่ทำได้จริง (แทน CNN-on-raster)

| # | วิธี | ข้อดี | ข้อเสีย/ต้องมี |
|---|---|---|---|
| **A** | **ขอ vector dieline (ArtiosCAD/.ARD/PDF มี layer) แทน artwork** → geometry/topology | แม่นสูง, deterministic, เราพิสูจน์แล้ว | ต้องมีไฟล์ vector (บริษัทน่าจะมี ArtiosCAD อยู่แล้ว?) |
| **B** | **คนเลือก style จาก visual menu ในฟอร์ม RFQ** (แบบ ArtiosCAD StyleMaker) — AI เติมแค่ dimension/material/สี | ตรงกับ production จริง, ไม่ต้องแม่น 100% | คนต้องกด 1 ครั้ง (แต่เป็นงานเขาอยู่แล้ว) |
| **C** | **map เป็น ECMA code + จับด้วย topology graph vs reference 11 template** (D4 canonicalize) | align มาตรฐานโลก, label สะอาดขึ้น | ต้อง parse vector เป็น graph |
| **D** | **Vision-LLM few-shot: แนบ 11 template ใน context แล้วถามว่าตรงอันไหน** (anchored ไม่ใช่ blind) | ไม่ต้องเทรน, GPT Round 15 พิสูจน์ว่า anchored ดีกว่า blind | ต่อ API, ยังพลาด custom บ้าง |
| E | CNN-on-raster fine-tune (ที่ทำอยู่) | ไม่ต้องพึ่ง vector | **เพดานต่ำ (macro-F1 0.40) — ยากสุด** |

**ข้อสังเกตหลัก:** ปัญหาที่เราสู้อยู่ (E) คือทางที่ยากสุดและอุตสาหกรรมไม่ใช้ — ทาง A/B น่าจะให้ผลจริงเร็วกว่ามาก

## Brief ให้ GPT deep-search ต่อ (คำถามที่ยังต้องหาคำตอบ)

1. มี **public dataset / pretrained model** สำหรับ ECMA/FEFCO classification ไหม? หรือ dieline structure dataset?
2. คู่แข่ง (estimating/RFQ SaaS: iQuote, PAXLY, Clarico, Esko) **จับ box style ยังไง** — dropdown ให้คนเลือก หรือ auto-detect? มี AI ตัวไหน infer จริง?
3. **artwork PDF ที่โรงพิมพ์ส่งมา มี vector layer (cut/crease/die) แยกได้ไหมโดยทั่วไป?** หรือ flatten เป็น raster หมด? (ตัวชี้ว่าทาง A ทำได้แค่ไหน)
4. มี startup/tool ที่ทำ **"dieline image → ECMA/FEFCO code"** ด้วย ML จริงไหม (ถ้าไม่มี = สัญญาณว่าเขาแก้ด้วย structure)
5. **topology/graph matching** จาก vector dieline (panel + crease graph) เทียบ template — มี lib/approach สำเร็จรูปไหม (เช่น จาก B-rep GNN งานวิจัย)
6. ในทางปฏิบัติ **human-pick-style + AI-extract-rest** vs auto-classify — best practice ของ RFQ automation คืออะไร

## Sources
- ECMA/FEFCO: [packagingdesignsoftware.com](https://www.packagingdesignsoftware.com/post/ecma-fefco-standards-digitalizing-packaging-with-packq), [ECMA Codes 2022 PDF](https://ecma.org/uploads/Bestanden/ECMA%20Sales%20Toolkit/ECMA%20Support%20Tools/New%202022/ECMA%20Codes%20EN%202022.pdf), [gwp.co.uk FEFCO](https://www.gwp.co.uk/packaging/fefco-styles/)
- ArtiosCAD parametric standards: [esko.com/artioscad](https://www.esko.com/en/products/artioscad), [Esko FEFCO 2022 parametric](https://site.esko.com/en/company/press-releases/2023/esko-implement-design-software-fefco-code)
- ML sketch→vector patent: [USPTO 11442430](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11442430)
- B-rep GNN CAD classification: [FuS-GCN ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1474034623001362), [Hierarchical CADNet](https://sciencedirect.com/science/article/pii/S0010448522000240)
- Estimating software: [Clarico corrugated](https://www.claricosystems.com/corrugated), [ePS iQuote](https://epssw.com/iquote-estimating), [PAXLY](https://paxly.ai/en/producers/quotes)

---

## GPT deep-search — คำตอบ 6 ข้อ (ตรวจเมื่อ 2026-07-13)

### Executive verdict

**ข้อสรุปของ Claude ถูกทิศทาง แต่ควรปรับเป็น B → A → C ไม่ใช่เลือก A หรือ B เพียงอย่างเดียว**

1. **ทำ B ตอนนี้:** ให้ผู้ใช้เลือก `box_type` จาก visual cards 1–12 โดยมี `Custom` และ `ไม่แน่ใจ` ชัดเจน
2. **เพิ่ม A เป็นช่องทางที่ต้องการ:** ขอ structural dieline แยกจาก artwork ถ้ามี (`.ARD/.MFG/.CF2/.DXF/.SVG` หรือ PDF ที่ยังเป็น vector และมี CAD separation/layer)
3. **ทำ C เป็น validator:** อ่าน cut/crease จาก vector แล้วเทียบ topology กับ template เพื่อยืนยันหรือเตือนว่าทรงที่เลือกไม่ตรง
4. **ลดบทบาท CNN/VLM:** ใช้แค่เสนอ候选/จัดคิวตรวจสำหรับไฟล์ raster เก่า ห้ามใช้เป็นผู้ตัดสินราคาคนเดียว

เหตุผลสำคัญคือ workflow ที่ตรวจพบในผลิตภัณฑ์จริงเกือบทั้งหมดเริ่มจาก **เลือกโครงสร้างมาตรฐาน + กรอกมิติ + generate/import CAD** ไม่ได้เริ่มจากเดา style จากภาพ artwork อิสระ ส่วนระบบ estimating เช่น iQuote/Clarico เน้น optimize เส้นทางผลิต, นำเข้า CAD/PDF และ true-shape nesting; ในหน้าผลิตภัณฑ์สาธารณะที่ตรวจไม่พบคำกล่าวอ้างว่า infer ECMA/FEFCO จากภาพโดยอัตโนมัติ

> ข้อควรแก้จากรายงานรอบแรก: ยังไม่มี primary source รองรับตัวเลข “ECMA ครอบคลุม >70%” จึงไม่ควรใช้ตัวเลขนี้ในการตัดสินใจ และ `box_type` 1–12 ของระบบเราไม่ควรถูกเรียกว่า ECMA subset แบบ 1:1 จนกว่าจะทำตาราง mapping จาก geometry จริง

### 1) Public dataset / pretrained model มีไหม?

**ผลค้น: ยังไม่พบ public benchmark หรือ pretrained checkpoint ที่น่าเชื่อถือสำหรับ `dieline image → ECMA/FEFCO code` โดยตรง** จากการค้น GitHub, Hugging Face, Kaggle, Papers with Code และงานวิจัยที่เกี่ยวข้อง ณ วันที่ด้านบน

- dataset ที่ชื่อเกี่ยวกับ packaging ส่วนใหญ่เป็น object detection ของขวด/กระป๋อง/กล่องในภาพถ่าย, defect detection, waste classification หรือกิจกรรมการแพ็ก ไม่ใช่โครงสร้าง cut/crease ของไดไลน์
- dataset CAD ขนาดใหญ่ เช่น [ABC](https://arxiv.org/abs/1812.06216) และ [Fusion 360 Gallery](https://github.com/AutodeskAILab/Fusion360GalleryDataset) มี geometry/topology แต่ไม่ใช่ packaging nets และไม่มี label ECMA/FEFCO
- API/library ที่มี ECMA/FEFCO เช่น [Boxshot Dielines API](https://dielines.boxshot.com/api/) เป็น **structured generator**: ผู้เรียกต้องระบุ layout ID และ parameter แล้วระบบสร้าง dieline ไม่ใช่ classifier ของไฟล์ลูกค้า

จึงควรบันทึกอย่างระมัดระวังว่า “**ยังไม่พบใน public indexes ที่ค้น**” ไม่ใช่ “ไม่มีอยู่แน่นอน” เพราะผู้ขายอาจมีข้อมูลภายในที่ไม่เผยแพร่

**ทางใช้ประโยชน์:** ถ้าจะสร้าง dataset เอง ให้ generate ตัวอย่างจาก template ที่บริษัทมีสิทธิ์ใช้ แล้ว augment ด้วย scale/rotation/reflection, line style, scan noise และ artwork overlay แต่ split ต้องแยกตาม design family/source file เพื่อไม่ให้ template เดียวกันหลุดทั้ง train/val/test และต้องมี real expert gold แยกต่างหาก

### 2) คู่แข่งและ production software จับ style อย่างไร?

หลักฐานสาธารณะที่ตรวจพบสนับสนุน workflow แบบ **select/configure/import** มากกว่า image inference:

| ผลิตภัณฑ์ | สิ่งที่เอกสารสาธารณะระบุ | หลักฐาน image→style |
|---|---|---|
| Esko ArtiosCAD | สร้างจากศูนย์หรือใช้ library ของ folding-carton/corrugated styles; เครื่องมือเป็น parametric | ไม่พบ claim ว่าอ่าน artwork raster แล้วคืน ECMA/FEFCO |
| Heidelberg Prinect Package Designer | มี reusable carton types และ catalog ECMA/FEFCO; สร้าง standard design/layout จาก library | ไม่พบ claim image inference |
| PrintXpand | flow เขียนตรง ๆ ว่า “Pick a box. Upload artwork.” พร้อม prebuilt ECMA/FEFCO templates และรับ custom dieline | เป็น human/template selection |
| Pacdora AI Structural Design | ขั้นแรกยังให้เลือก packaging structure/style แล้วจึงสร้าง/ปรับแบบ | เป็น assisted generation ไม่ใช่ recognition |
| PackMyMan / Dieline Genius / Boxshot API | เลือก template/layout ID → ใส่มิติ → export CAD/vector | structured generation |
| ePS iQuote | algorithms และ constraints เลือก production route/equipment ที่คุ้มค่า | ไม่พบ public claim เรื่อง box-style inference |
| Clarico | import CAD/PDF, true-shape nesting และเชื่อม ERP/CRM/MIS | ไม่พบ public claim เรื่อง ECMA/FEFCO inference |
| PAXLY | public material เน้น RFQ/quotation workflow | ยังไม่มีหลักฐานสาธารณะที่ยืนยัน image-to-style inference |

แหล่งหลัก: [ArtiosCAD](https://www.esko.com/en/products/artioscad), [Prinect Package Designer](https://www.heidelberg.com/global/en/print_and_packaging/software/workflow/prinect_modules/packaging_workflow_1/prinect_package_designer/product_information_100/prinect_package_designer.jsp), [PrintXpand](https://www.printxpand.com/web-to-pack-solution/), [Pacdora](https://www.pacdora.com/tools/ai-structural-packaging-design), [iQuote](https://epssw.com/iquote-estimating), [Clarico](https://www.claricosystems.com/corrugated)

คำว่า “ไม่พบ public claim” ไม่ได้พิสูจน์ว่า vendor ไม่มีโมดูล private/custom แต่เพียงพอที่จะบอกว่า auto-classification จากภาพ **ไม่ใช่ capability หลักที่เขาใช้โฆษณา workflow**

### 3) Artwork PDF มี vector cut/crease แยกได้โดยทั่วไปไหม?

คำตอบคือ **“มีได้และพบได้บ่อยในไฟล์ prepress ที่ส่งถูกวิธี แต่ห้ามถือว่ามีเสมอ”**

- ArtiosCAD มี semantic line types แยก `Cut`, `Crease`, partial cut, print image ฯลฯ และรองรับหลาย layer; ตอน export สามารถเลือกเฉพาะ visible layers ได้ ([Esko line types](https://docs.esko.com/docs/en-us/artioscad/14.1/userguide/en-us/common/ac/topic/UG8_Appendix-and-Glossary_id1158693URY36.html), [Esko layers](https://docs.esko.com/docs/en-us/artioscad/22.11/userguide/en-us/common/ac/topic/UG3_Designer_id1053631UER23.html))
- structural file เช่น `.ARD` เก็บ cut/crease และอาจเก็บ fold angle โดยแยกจาก graphics ([Esko structural design files](https://docs.esko.com/docs/en-us/icutlayout/18/userguide/en-us/common/st/concept/co_aboutardfiles.html))
- PDF สามารถมี vector path, spot/separation colors และ Optional Content Groups (“layers”) ได้ แต่ **vector ไม่ได้แปลว่ามี layer หรือ semantic name** และการ export อาจซ่อน dieline, flatten transparency, outline/rasterize หรือเอา dieline ออกทั้งหมด
- คู่มือส่งงานบางแห่งถึงกับให้แยก dieline/artwork ในไฟล์ต้นฉบับ แต่ปิด dieline ก่อน export print-ready PDF; จึงมีกรณีที่ไฟล์ลูกค้ามี artwork ครบแต่ไม่มี structural line ใน PDF

ดังนั้นต้องตรวจ **ต่อไฟล์** ด้วย intake ladder:

1. ดีที่สุด: รับ structural CAD แยก (`ARD/MFG/CF2/DXF/SVG`) และ artwork แยก
2. รองลงมา: PDF vector ที่มี OCG, spot color/separation หรือชื่อ processing step สำหรับ cut/crease
3. PDF vector ไม่มี semantic layer: พยายามแยกจาก stroke color/dash/width/geometry แล้วให้คนยืนยัน
4. PDF/JPG raster หรือมี artwork กลบเส้น: ให้คนเลือก style; AI แค่เสนอและต้อง abstain ได้

ทางเทคนิค [PyMuPDF `Page.get_drawings()`](https://pymupdf.readthedocs.io/en/latest/page.html#get-drawings) อ่าน vector graphics จากหน้า PDF ได้ แต่การอ่านเส้นออกมาได้ยังไม่เท่ากับรู้ว่าเส้นใดเป็น cut/crease—ต้องใช้ layer/separation/style และ validation เพิ่ม

### 4) มี startup/tool ที่ทำ “dieline image → ECMA/FEFCO code” จริงไหม?

**ยังไม่พบผลิตภัณฑ์ที่เผยแพร่หลักฐานชัดว่ารับ arbitrary dieline/artwork image แล้วคืน ECMA/FEFCO code ด้วย ML ใน production**

ตัวที่ใกล้เคียงที่สุดที่พบคือ [Pack AI](https://packai.tech/) ซึ่งกล่าวถึงการรับ PDF/SVG/AI/PNG/JPEG และ parse/split panels หรืออ่าน dimension แต่หน้า public ไม่ได้กล่าวว่าจะ classify เป็น ECMA/FEFCO code ส่วนเครื่องมือที่ใช้คำว่า AI อื่น ๆ เช่น Pacdora, Packniche, CutNFlow หรือ Cubit ส่วนใหญ่เป็น **generation/configuration จาก structure/template ที่เลือกก่อน**

นี่เป็นสัญญาณสนับสนุนว่า task นี้มักถูกแก้ด้วย metadata/template/vector structure แต่ยังไม่ใช่หลักฐานว่าไม่มีทีมใดทำ classifier ภายใน

### 5) Topology/graph matching มีของสำเร็จรูปไหม?

**ไม่มี library สำเร็จรูปแบบ `dieline → ECMA/FEFCO` ที่พบ แต่มี building blocks ครบพอทำ deterministic matcher ได้** และสำหรับ template ภายในเพียง 11 แบบ วิธีนี้เหมาะกว่าเริ่มจาก GNN

building blocks ที่ใช้ได้:

- PDF vector: [PyMuPDF `get_drawings()`](https://pymupdf.readthedocs.io/en/latest/page.html#get-drawings)
- DXF entities/layer/linetype: [ezdxf](https://ezdxf.readthedocs.io/en/stable/concepts/layers.html)
- node เส้นและสร้าง polygon/panel: [Shapely `polygonize`](https://shapely.readthedocs.io/en/stable/reference/shapely.polygonize.html)
- graph isomorphism/subgraph matching พร้อม node/edge attributes: [NetworkX VF2/VF2++](https://networkx.org/documentation/stable/reference/algorithms/isomorphism.html)

pipeline ที่แนะนำ:

1. แยก cut/crease vectors และเก็บ provenance ของทุกเส้น
2. snap endpoint ตาม tolerance และ node จุดตัด
3. polygonize เป็น panel/faces
4. สร้าง attributed graph: panel เป็น node; crease adjacency เป็น edge; เก็บ normalized aspect/area, edge-length ratios, flap/boundary signature และ line type
5. normalize scale และ canonicalize ภายใต้ rotation/reflection (D4) เพื่อให้กลับหัวหรือพลิกซ้ายขวาแล้วยังเป็นทรงเดิม
6. exact/tolerant graph match กับ 11 templates; ถ้ามี node/edge/cut/flap เพิ่มหรือลดจาก template ให้คะแนน deviation และเข้า `Custom`/review ตามกติกาธุรกิจ
7. ถ้า parse ไม่ครบหรือ semantic cut/crease ไม่ชัด ให้ abstain ไม่เดา

[BRepNet](https://github.com/AutodeskAILab/BRepNet) เป็น topological message passing สำหรับ **3D solid B-rep/STEP** จึงเป็นงานอ้างอิงเชิงแนวคิด ไม่ใช่ drop-in solution สำหรับ 2D packaging net การใช้ GNN ควรเกิดหลังจาก deterministic graph baseline มีข้อมูลจริงมากพอและพิสูจน์แล้วว่า rules/matching ไม่พอ

### 6) Best practice: human-pick + AI-extract-rest หรือ auto-classify?

สำหรับ RFQ ที่ผลลัพธ์กระทบ open size, UPS, paper usage, die-cut และราคา **best practical architecture คือ human-confirmed style + AI-extract/check the rest**:

```text
Upload artwork / structural file
        ↓
ผู้ใช้เลือก 1–12 / Custom / ไม่แน่ใจ
        ↓
AI อ่าน dimension, material, color, finish และเสนอ style (ถ้าจำเป็น)
        ↓
Vector topology validator ตรวจ style ที่เลือกกับ cut/crease
        ↓
ตรง → คำนวณอัตโนมัติ
ไม่ตรง/ไม่ชัด → human review ก่อนราคา
```

ข้อเสนอ UI สำหรับระบบนี้:

- แสดง 12 visual cards จาก reference ที่ expert รับรอง ไม่ใช้ชื่อ RTE/STE อย่างเดียว
- card ต้องบอกลักษณะจำแนก เช่น ตำแหน่งฝา/ปีก/ก้น และอนุญาต rotation/reflection
- `Custom` ใช้เมื่อมีชิ้นส่วน/แง่ง/เส้นตัดสำคัญเพิ่มหรือลด หรือ topology ไม่ตรง ไม่ใช่เพียงเพราะภาพหมุน
- เพิ่ม `ไม่แน่ใจ — ให้เจ้าหน้าที่ตรวจ` แยกจาก Custom เพราะ “ไฟล์อ่านไม่ออก” ไม่เท่ากับ “โครงสร้าง custom”
- AI คืน top-3 + เหตุผลเชิงโครงสร้าง + confidence/abstention; ห้ามบันทึก label อัตโนมัติเมื่อคนเลือกไว้แล้ว
- log `user_selected`, `ai_suggested`, `vector_verified`, `expert_corrected` แยก provenance เพื่อสร้าง gold ที่สะอาดในอนาคต

### ข้อเสนอการตัดสินใจสำหรับโปรเจกต์

**ไม่ควรลงทุนรอบหลักกับ CNN-on-raster ต่อในตอนนี้** เพราะผล expert gold แสดง label-copy/เพดานต่ำ และ input raster ทิ้งข้อมูลที่สำคัญที่สุดคือ cut/crease semantics แต่ไม่จำเป็นต้องลบงาน CNN: เก็บเป็น fallback baseline และ FN miner สำหรับ legacy images

ลำดับ implement ที่คุ้มที่สุด:

1. **B — 1 sprint:** visual selector + Custom + ไม่แน่ใจ + provenance
2. **A — 1 sprint:** รับ structural file แยก, ทำ PDF/vector capability check และแจ้งคุณภาพไฟล์
3. **C — prototype 2–3 sprints:** matcher สำหรับ type 1–4 ที่สับสนกันก่อน แล้วขยาย 5–11
4. **วัดผล:** style-confirmation rate, mismatch rate, manual-review rate, custom precision/recall และผลต่อ quotation correction—not accuracy บน proxy เพียงอย่างเดียว

**เกณฑ์ production:** ระบบคำนวณราคาได้อัตโนมัติเฉพาะเมื่อ (ก) คนยืนยัน style หรือ (ข) vector validator ผ่าน threshold ที่กำหนด; raster model เพียงตัวเดียวไม่ควรปลดล็อกการคำนวณราคา

---

# Claude → GPT · consult: เจอ metadata/structural layers ในไฟล์เดิม (probe จริง)

หลังคุยว่า production เก็บ structure ไว้ ไม่ได้เดาจาก raster — ผม probe ไฟล์จริงในระบบ (fitz อ่าน OCG/spot/producer) ว่ามี structure ซ่อนไหม **โดยไม่ต้องขอไฟล์ใหม่**

## ผล probe 400 PDF (จาก 6,107 ในระบบ)
| เจอ | จำนวน |
|---|---|
| OCG layer มีชื่อ | 120 (30%) |
| **layer ชื่อโครงสร้าง** (`Die Line`, `dieline`, **`D/C CUT`** + **`D/C CREASE`** แยกกัน, `dicut`) | **39 (~10%)** |
| Separation spot color ชื่อ cut/die | 29 (~7%) |
| **producer = `PackDesign 2008 by BCSI System`** (packaging CAD) | **121 (30%)** |

ตัวอย่าง layer: `['D/C CUT','D/C CREASE']`, `['Die Line 9']`, `['dicut']`

**นัย:** intake ladder tier-2 ของคุณ (PDF vector + OCG/spot) **มีจริง ~10-30%** ในไฟล์เดิม → ทาง A/C ทำได้เลยบน subset โดยไม่ต้องขอ vector ใหม่ + อาจเอา structure ที่ดึงได้มา **สร้าง clean label ให้ CNN** (แก้ label noise ที่ค้าง)

## 5 คำถามถึงคุณ (ก่อนผมลงมือสร้าง extractor)
1. **ดึง cut/crease จาก OCG layer + spot separation** ด้วย PyMuPDF ให้ robust — best practice? (`get_drawings()` คืน path แต่ไม่บอก layer/สีมันสังกัด; ต้อง map path→OCG/separation ยังไง)
2. **BCSI PackDesign** (30% ของไฟล์) — มี layer/line-type convention ที่รู้กันไหม ที่ exploit ได้แม้ layer ไม่ได้ตั้งชื่อ?
3. เอา structure ที่ดึงได้มา **bootstrap clean gold label** (geometry ตัดสินทรง แทน proxy) — **circular/เสี่ยงไหม?** ควร gate ยังไง (เช่น เฉพาะไฟล์ที่ parse ครบ + คนสุ่มตรวจ)?
4. **intake ladder + confidence tier** — ควรออกแบบยังไงให้ราคา auto ได้เฉพาะ tier บน (structural ชัด) และ tier ล่าง (raster) บังคับคนยืนยัน?
5. **pitfall การดึง vector จาก OCG** ที่ควรระวัง (เช่น artwork อยู่ layer เดียวกับ die, layer ชื่อ die แต่มี path อื่นปน, transparency/clip)?

จุดยืนผม: **นี่น่าจะเป็น unlock จริง** — แทนที่จะสู้ raster ต่อ ใช้ structure ที่ซ่อนอยู่แล้วในไฟล์เดิม (deterministic) + สร้าง clean label ไปในตัว

— Claude

---

# GPT → Claude · consult response: ใช่ เป็น unlock แต่ต้อง pilot ก่อนสแกน 6,107

## Verdict

**เห็นด้วยกับทิศทาง structure-first และควรทำ extractor ต่อ แต่ยังไม่ควรเรียกผล 10–30% ว่า usable rate หรือสแกนเต็ม corpus ทันที** ตัวเลขปัจจุบันเป็น marginal counts คนละเงื่อนไข:

- 30% มี OCG ชื่อใด ๆ ไม่ได้แปลว่า 30% มี cut/crease ที่ใช้ได้
- 30% มี producer เป็น PackDesign ไม่ได้แปลว่ามี structural paths หรือ semantics
- 10% มีชื่อ layer เชิงโครงสร้าง แต่ยังไม่รู้ว่า path ใน layer สะอาด/ครบและแยก cut กับ crease ได้กี่ไฟล์

ต้องทำ intersection table ก่อน เช่น `PackDesign ∩ structural OCG`, `PackDesign ∩ spot`, `structural OCG ∩ spot` และตรวจ **path-level usability** ไม่ใช่ metadata presence อย่างเดียว

ทางที่เล็กและปลอดภัยกว่า full scan คือ: **pilot extractor กับ 39 positives + negative controls 40–60 ไฟล์ → expert inspect ทุกไฟล์ → ค่อยสแกน 6,107**

## Blocker 1 — สมมติฐานเรื่อง PyMuPDF layer ไม่ตรงกับ API รุ่นใหม่

ตั้งแต่ **PyMuPDF 1.22.0** `Page.get_drawings()` และ `Page.get_cdrawings()` คืน key `layer` ซึ่งเป็นชื่อ Optional Content Group ของ path โดยตรง ไม่ต้องสร้าง `path → OCG` mapper เอง ([official Page docs](https://pymupdf.readthedocs.io/en/latest/page.html#get-drawings)) และ `get_cdrawings()` เร็วกว่าสำหรับ batch scan

แนวทาง OCG ที่ควรเริ่ม:

```python
import pymupdf

# pin PyMuPDF >= 1.22 และบันทึก version ลง manifest ทุก run
with pymupdf.open(pdf_path) as doc:
    ocgs = doc.get_ocgs()  # xref -> name/on/intent/usage
    for page_no, page in enumerate(doc):
        for path in page.get_cdrawings(extended=True):
            layer = normalize_layer_name(path.get("layer") or "")
            path_type = path.get("type")
            # extended=True มี clip/group records ด้วย ต้องแยกออกจาก stroke/fill
```

สิ่งที่ต้องทำก่อนรันจริง:

1. pin dependency และ fail-fast ถ้า `<1.22`; ตอนนี้ repo ยังไม่มี lock/requirements สำหรับ PyMuPDF
2. เก็บ `version`, file SHA-256, page, `seqno`, raw layer name, normalized layer name และ path attributes ลง manifest
3. normalize ชื่อด้วย Unicode NFKC + lowercase + collapse whitespace/punctuation แต่เก็บ raw name ไว้เสมอ
4. ใช้ whitelist/alias ที่ audit ได้ เช่น `d/c cut`, `die line`, `dicut`, `crease`, `fold`; อย่าใช้ substring `cut` อย่างเดียวเพราะอาจชน `cutout`, annotation หรือ artwork name
5. ทดสอบทั้ง layer ที่ default ON/OFF, OCG/OCMD ซ้อน และ Form XObject; OCG visibility มี configuration/usage rules และเคยมี version-specific rendering bugs จึงต้องเทียบผลกับ visual render/Acrobat บน pilot ([PyMuPDF optional-content docs](https://pymupdf.readthedocs.io/en/latest/recipes-optional-content.html))

### Spot separation เป็นคนละเส้นทางกับ OCG

`get_drawings()` เปลี่ยน stroke/fill เป็น RGB tuple ตั้งแต่ 1.19.1 ดังนั้น **ชื่อ `/Separation` หรือ `/DeviceN` อาจหาย** ห้าม map spot path จากค่า RGB เพราะ alternate color/tint transform ทำให้หลาย spot กลายเป็น RGB เดียวกัน

ทำสองระยะ:

- **ระยะ 1:** ship OCG extractor ก่อน เพราะ path มี `layer` โดยตรง
- **ระยะ 2:** สำหรับ spot-only PDFs ให้ parse PDF content/resources ที่ระดับต่ำกว่า โดยติดตาม `CS/cs`, `SCN/scn`, `q/Q`, `cm`, `Do`, `BDC/EMC` และ recurse Form XObjects; [pikepdf `parse_content_stream()`](https://pikepdf.readthedocs.io/en/latest/api/filters.html#pikepdf.parse_content_stream) เป็นจุดเริ่ม แต่ PDF content stream เป็น stateful จึงห้ามทำด้วย regex

ถ้าต้องการ prototype เร็ว ให้ลอง [MuPDF `mutool trace`](https://mupdf.readthedocs.io/en/1.27.0/tools/mutool-trace.html) หรือ PDFBox graphics-stream engine เพื่อรักษา colorspace/marked-content semantics แล้วเทียบกับ PyMuPDF geometry ก่อนตัดสินใจเขียน interpreter เอง

## Blocker 2 — geometry-derived label ยังไม่ใช่ clean gold

ใช้ structure bootstrap label ได้ แต่ต้องเรียกว่า **silver/weak label** จนกว่า expert จะยืนยัน เพราะเกิดวงกลมได้ 3 ทาง:

1. template/matcher สร้างจาก proxy label เดิม แล้วเอาผล matcher ไปประกาศว่า proxy ถูก
2. geometry rule พลาด pattern เดียวกันทั้ง corpus เช่น artwork ปน layer, flap เพิ่ม หรือ crease หาย
3. ไฟล์ family เดียวกันเข้า train และ eval ทำให้ metric ดูดีเกินจริง

gate ที่แนะนำ:

- gold test เดิมต้อง frozen และ **ห้าม**รับ label จาก extractor
- label ใหม่เก็บ provenance แยก: `expert`, `vector_exact`, `vector_heuristic`, `proxy`, `model`
- `vector_exact` ต้องมี cut+crease semantic แยก, parse coverage ผ่าน, net connected/valid, unique template match และ margin จากอันดับสองสูง
- `vector_heuristic` ใช้ train/active learning ได้ แต่ห้ามใช้เป็น evaluation gold
- แยก split ตาม source design/family/hash ไม่ใช่สุ่มรายไฟล์
- รอบ pilot ให้ expert ตรวจ positives ทุกไฟล์และ negatives แบบ stratified ตาม producer/layer convention; หลังขยายให้สุ่ม audit ต่อเนื่องและเก็บ false-positive case
- หากจะอนุญาต auto-label โดยไม่ตรวจทุกใบ ควรกำหนด precision target สูงมาก เช่น ≥99% พร้อม lower confidence bound จาก sample ที่เพียงพอ ไม่ใช้ “ตรวจ 10 ใบแล้วถูกหมด”

จุดสำคัญ: กติกาธุรกิจที่ผู้ใช้ให้ไว้ว่า “มีแง่ง/ชิ้นส่วนสำคัญเพิ่มแม้เล็กน้อยให้เป็น Custom” หมายความว่า matcher ต้องตรวจ **extra topology** ด้วย ไม่ใช่เพียงพบ core panels ตรงกับ template

## Major — BCSI PackDesign ใช้เป็น prior ได้ แต่ยังไม่มี public convention ที่ควร hardcode

ค้นพบข้อมูลสาธารณะว่า PackDesign รองรับ line types จำนวนมากสำหรับ cut/crease/perforation, independent product layers และ export PDF/EPS/AI/CF2/DXF แต่ **ไม่พบ specification ทางการที่รับประกันชื่อ PDF layer/spot หรือ numeric line-type mapping ข้าม version** แหล่งสาธารณะที่พบเป็นหน้าตัวแทนจำหน่าย ไม่ใช่ format contract ([PackDesign feature summary](https://dieboardlaserindia.com/packdesignsoftware.html))

ดังนั้น:

- ใช้ `Producer=PackDesign...` เป็น feature/prior สำหรับเลือก parser profile ไม่ใช่หลักฐานว่าไฟล์ใช้ได้
- derive convention จาก 121 ไฟล์จริง: distribution ของ raw layer names, spot names, dash, width, stroke/fill, page/XObject structure และ version string
- ทำ producer profile แบบ versioned/configurable เช่น `bcsi_packdesign_2008_v1`; ไม่ฝัง logic กระจายใน geometry code
- ตรวจ XMP/custom metadata และ embedded attachments ด้วย เผื่อมี style code หรือ CAD payload ที่ตรงกว่า geometry
- ถ้ามี CF2/DXF ต้นทางหรือ attachment ให้ใช้สิ่งนั้นก่อน PDF เพราะ line type semantics ชัดกว่า
- ทางที่ดีที่สุดคือขอ export specification/sample จาก BCSI; จนกว่าจะได้ ให้ทุก convention ที่เรียนจาก corpusเป็น empirical rule พร้อม audit

## Confidence tier ที่แนะนำ

อย่ารวมทุกอย่างเป็น probability เดียว ให้ใช้ **evidence tier + reason codes** ที่ตรวจย้อนหลังได้:

| Tier | หลักฐาน | การใช้ |
|---|---|---|
| **T0 — expert confirmed** | คนยืนยัน style/dimensions หรือ CAD master ที่เชื่อถือได้ | auto-price ได้เมื่อ field อื่นครบ |
| **T1 — structural exact** | cut+crease semantic แยก, parse ครบ, topology valid, unique exact/tolerant match, ไม่มี extra flap/cut, scale/dimensions สอดคล้อง | ช่วง pilot ให้คนยืนยัน; หลังผ่าน precision gate จึง auto-price standard type ได้ |
| **T2 — structural partial** | มี layer/spot เดียว, ต้องเดา crease, path ปน หรือ match ไม่ unique | prefill/top-3 แต่บังคับคนยืนยัน |
| **T3 — vector heuristic** | มี vector แต่ไม่มี semantic layer/spot; อาศัยสี/dash/geometry | suggestion/queue only |
| **T4 — raster/unreadable** | raster, flatten, parse error หรือ coverage ต่ำ | human pick; CNN/VLM เป็น assist เท่านั้น |

`Custom` ไม่ควร auto-price จาก matcher ในระยะแรก เพราะ “ไม่ตรง template” อาจหมายถึง extractor พัง ไม่ใช่ custom จริง ให้ส่ง human review พร้อม reason เช่น `extra_component`, `missing_crease`, `ambiguous_layer`, `incomplete_net`

และ auto-price gate ต้องเป็น conjunction ไม่ใช่ดู style อย่างเดียว:

```text
style_tier <= T1
AND dimensions_verified
AND unit/scale_verified
AND material/process fields complete
AND no custom/ambiguity/error flags
```

## Pitfalls ที่ extractor ต้องออกแบบรับตั้งแต่แรก

1. **ชื่อ layer ไม่ใช่ความจริง:** ซ้ำ, ว่าง, localized, สะกดผิด หรือใช้ชื่อ `Die Line` แต่มี dimension/text/registration mark ปน
2. **cut/crease อาจอยู่ layer เดียวกัน:** แยกด้วย spot, dash หรือ line type; บางไฟล์กลับกันหรือถูก outline เป็น filled thin polygons
3. **OCG กับ OCMD:** visibility อาจเป็น logical expression หลายกลุ่ม ไม่ใช่ OCG เดี่ยว และ default ON/OFF ไม่ใช่ semantic type
4. **Form XObject reuse:** path อยู่ใน nested XObject พร้อม transform หลายชั้น; ต้องรักษา CTM และห้ามนับ geometry ซ้ำโดยไม่รู้ invocation
5. **clipping/transparency/mask:** `extended=True` คืน clip/group hierarchy; path นอก clip อาจไม่ปรากฏจริง และ knockout/opacity อาจทำให้ visual inspection ต่าง
6. **Separation/DeviceN:** RGB ที่ PyMuPDF คืนไม่รักษาชื่อ colorant; overprint/tint transform ทำให้สีที่เห็นหลอกได้
7. **stroke ไม่เท่ากับ dieline:** artwork มี stroke จำนวนมาก `bench/geom_pdf.py` ปัจจุบันตัดแค่ fill จึงยังรับ stroke artwork ทั้งหมด และ `fs`/mixed paths ก็เป็นช่องปน
8. **curve handling:** `geom_pdf.py` ยุบ Bézier เป็นเส้นตรงจากต้นไปปลาย ทำให้ flap curve/topology เพี้ยน ต้อง flatten curve ตาม tolerance หรือเก็บ curve primitive
9. **page/crop/rotation/units:** MediaBox/CropBox/Rotate, user unit และ scaling จาก placement/XObject ต้อง normalize ก่อนเทียบ dimension
10. **broken geometry:** duplicate/overlapping segments, endpoint gap, hairline, zero-length, partial page, multiple dielines/n-up และ dieline หลายชิ้นในหน้าเดียว
11. **hidden/print-only content:** ViewState และ PrintState อาจต่างกัน; ต้องบันทึก configuration ที่ใช้และมี render-diff test
12. **PDF เสีย/เข้ารหัส/feature แปลก:** parse failure ต้องลด tier ไม่ใช่ silently fallback แล้วให้ confidence สูง

## Minimal pilot ก่อนอนุมัติ full scan

1. ทำ per-file manifest ของ probe 400 ใบและ intersection table ก่อน
2. pin PyMuPDF รุ่นเดียวกับ production; เปลี่ยนจาก `get_drawings()` เป็น `get_cdrawings(extended=True)` และใช้ `path['layer']`
3. OCG-only extractor รุ่นแรก: `D/C CUT` + `D/C CREASE` แยกกันก่อน ซึ่งเป็นกรณี evidence แข็งที่สุด
4. รัน 39 structural-name files + negative controls 40–60 ใบ; export overlay PNG แยก cut/crease ให้ expert ดูทุกใบ
5. วัด `semantic-path precision`, `parse completeness`, `valid-net rate`, `unique-template-match rate` แยกตาม producer—not เพียง classification accuracy
6. ถ้า OCG pilot ผ่าน ค่อยเพิ่ม spot-only parser; อย่าผูกสองความเสี่ยงในรุ่นแรก
7. เมื่อ extractor ผ่าน จึงสแกน 6,107 และบันทึกผลเป็น silver labels พร้อม provenance; ไม่แก้ expert gold อัตโนมัติ

**คำตัดสิน: fix-then-ship pilot — unlock นี้มีน้ำหนักจริง แต่ตัวปลดล็อกทันทีคือ `path['layer']` ไม่ใช่การเขียน OCG mapper และ blocker ใหญ่ที่สุดคือพิสูจน์ว่า structural paths “ครบและสะอาด” ไม่ใช่แค่มี metadata ชื่อดี**

---

# Claude → GPT · milestone: pilot สำเร็จ + full-scan usable rate + BCSI ปลดล็อกด้วยสีเส้น

ทำ pilot ตามที่คุณแนะครบ (path['layer'], whitelist, cut/crease split, overlay inspect) + full-scan 6,107 แล้ว รายงานผลจริง

## 1. Extraction พิสูจน์แล้ว (overlay ยืนยันด้วยตา)
- **Adobe (OCG layer):** ดึง structural layer แยกจาก artwork สะอาด (เห็น die-cut ลากตามโครงเป๊ะ)
- **cut/crease split จาก dash:** 24/24 แยกได้ (solid=cut, dashed=crease) — crease โชว์ panel grid, cut โชว์ outline/closure

## 2. Full-scan usable rate (9,748 ไฟล์: 6,107 PDF + 3,028 raster)
| | จำนวน | % |
|---|---|---|
| T1 แยก cut+crease ได้ (Adobe OCG) | 737 PDF | 12% ของ PDF |
| raster → human fallback | 3,028 | 31% ของทั้งหมด |

**แยกตาม producer:** Adobe 2,156 (34% แยกได้) · **BCSI PackDesign 1,855 (30%!) = 0 ด้วย OCG**

## 3. BCSI ปลดล็อก (คุณทำนายไว้เป๊ะ — "derive convention จากไฟล์จริง")
BCSI **ไม่ใช้ OCG** — เข้ารหัสด้วย **stroke color คงที่:** native แดง `(0.93,0.12,0.14)` = cut · น้ำเงินเทา `(0.37,0.40,0.68)` = crease · near-black = glue hatching/dimension
overlay ยืนยัน: cut=ขอบ+flap+ลิ้น, crease=เส้นพับ สะอาด → **BCSI extract ได้ด้วยสี = usable ceiling ~42% ของ PDF**

## 4. Classifier ต้นแบบ: นับมุมหยาบไป (ไม่ overclaim)
ป้อน cut สะอาดเข้า crash-lock detection (นับเส้น ~45°) → **over-fire** เพราะ 45° มีทั้ง crash-lock จริง + มุม dust flap + "///" hatching → แยก auto-bottom(4) จาก tuck ไม่คลีน
**สรุป: extraction (ส่วนยาก) solved · classifier ต้องเป็น proper topology matcher ไม่ใช่นับมุม**

## 5 คำถามถึงคุณ
1. **สร้าง topology matcher ตอนนี้ หรือ ship B (human-pick) ก่อนแล้วเพิ่ม auto ทีหลัง?** (B ครอบ 100% 1 คลิก · matcher auto ~42%)
2. matcher: ให้ cut/crease สะอาดแล้ว **วิธี minimal แยก 1/2/3/4** (core ที่สับสน) — polygonize+panel-graph+closure-signature หรือ feature rule ที่เบากว่า? เริ่มยังไงให้ได้ผลเร็ว
3. **BCSI color profile** — hardcode RGB (แดง=cut) ปลอดภัยไหม หรือ per-file dominant-color clustering (เผื่อ version/ไฟล์ต่าง)?
4. **n-up (LAY) isolation** — connected-components แยกกล่องก่อน match ใช่ไหม? ทำที่ระดับ cut graph?
5. **~42% clean extraction เป็น silver label** ให้ทั้งระบบ (แก้ label noise 17 rounds) — gate ที่คุยไว้ (provenance + precision ≥99%) ยังใช้ได้ หรือมีอะไรเพิ่ม?

จุดยืนผม: extraction ~42% + human-pick ที่เหลือ = product ใช้ได้จริง · matcher เป็น automation layer ที่ค่อยเพิ่ม · **นี่คือทางออกที่ยั่งยืนกว่าสู้ CNN raster**

— Claude
