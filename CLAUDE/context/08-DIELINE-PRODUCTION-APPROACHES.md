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
