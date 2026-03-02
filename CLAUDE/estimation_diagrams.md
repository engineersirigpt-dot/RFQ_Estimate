# Diagrams ระบบ Estimate Packaging (Mermaid)

> **เอกสารนี้** รวม Mermaid diagrams ทั้งหมด 7 รายการ
> เปิดดูได้ใน GitHub, VS Code (Markdown Preview Enhanced), หรือ https://mermaid.live

---

## 1. Main Calculation Pipeline (ภาพรวมการคำนวณทั้งหมด)

```mermaid
flowchart TD
    START([เริ่มต้น]) --> INPUT

    subgraph INPUT["(A) รับข้อมูล Spec จากผู้ใช้"]
        I1[/"จำนวน qty, runon, AE, customer"/]
        I2[/"ประเภทพิมพ์: Offset / Flexo / Jet Press / Konica"/]
        I3[/"ประเภทหมึก: Normal / UV"/]
        I4[/"Component Type: 1=ไม่ประกบ / 2=ประกบ / 3=เฉพาะลูกฟูก"/]
        I5[/"Box Template: 1-12 + ขนาด W,L,D,T,G,dust,OL"/]
        I6[/"กระดาษ: type, gram, thickness"/]
        I7[/"สีพิมพ์: outside, inside + หมึกพิเศษ"/]
        I8[/"ตัวเลือกเสริม: coating, foil, emboss, ลูกฟูก"/]
    end

    INPUT --> LAYOUT

    subgraph LAYOUT["(B) Layout Calculation"]
        L1["คำนวณ Open Size\nตาม box template 1-12"]
        L2["คำนวณ Tolerance\ngripper + color_bar + paper_edge"]
        L3["เลือก Machine\n+ Standard Paper Size"]
        L4["คำนวณ UPS\nStraight & Overlap × Vertical & Horizontal"]
        L5["เลือก Layout ที่ UPS สูงสุด"]

        L1 --> L2 --> L3 --> L4 --> L5
    end

    LAYOUT --> PAPER

    subgraph PAPER["(C) Paper Usage Calculation"]
        P1["คำนวณ Split\nfloor(roll/paper) × floor(cut/paper)"]
        P2["คำนวณ After UPS\nceil(qty / UPS)"]
        P3["คำนวณ Waste\nprint + afterpress + coating + foil + bossing"]
        P4["คำนวณปริมาณกระดาษ\npaper_print → paper_qty → paper_net"]
        P5["คำนวณน้ำหนัก\nkilogram → ton"]

        P1 --> P2 --> P3 --> P4 --> P5
    end

    PAPER --> COST

    subgraph COST["(D) Cost Calculation"]
        C1["ต้นทุนกระดาษ\npaper_net × unit_price"]
        C2["ต้นทุนเพลท\ncolors × plate_ppu × qty"]
        C3["ต้นทุนพิมพ์\nrate × ink_factor × colors"]
        C4["ต้นทุน Coating\nwidth × length × rate × side"]
        C5["ต้นทุน Foil Stamp\nlabor + foil_roll + block"]
        C6["ต้นทุน Emboss/Deboss\nlabor + block"]
        C7["ต้นทุนหมึกพิเศษ\nqty × ink_price"]
        C8["ต้นทุนลูกฟูก\nunit_inch × flute × cut"]
        C9["ต้นทุน Afterpress\nassembly + diecut + chip + inspection"]
        C10["ต้นทุนแพ็คกิ้ง\npaperband + kraft + carton + pallet"]
        C11["ต้นทุนจัดส่ง\nweight × delivery_rate"]
    end

    COST --> TOTAL

    subgraph TOTAL["(E) Markup & Total Price"]
        T1["รวมต้นทุนทั้งหมด\nsubtotal = sum of all costs"]
        T2{"Profit Sharing?"}
        T3["+ Standard Markup\nตาม default_marking"]
        T4["+ Profit Sharing Markup\n+5% total, min 5,000 THB"]
        T5["+ Markup/Markdown จากผู้ใช้"]
        T6["+ ภาษี 3%"]
        T7["× Exchange Rate"]
        T8["ราคาสุดท้าย\nGrand Total"]

        T1 --> T2
        T2 -->|ไม่| T3
        T2 -->|ใช่| T4
        T3 --> T5
        T4 --> T5
        T5 --> T6 --> T7 --> T8
    end

    T8 --> END([จบการคำนวณ])
```

---

## 2. Layout Calculation Flow (การคำนวณ Layout)

```mermaid
flowchart TD
    START([เริ่มคำนวณ Layout]) --> A1

    A1["รับ box template type 1-12\n+ ขนาด W, L, D, T, G, dust, OL"]

    A1 --> A2{"Box Type = 12\n(Custom)?"}
    A2 -->|ใช่| A2Y["ใช้ Open Size จากผู้ใช้\n[input]"]
    A2 -->|ไม่| A3

    A3["คำนวณ Open Size ตามสูตร\nเช่น Type 1: [2(W+T)+D, 2(W+L)+G]"]
    A3 --> A4

    A4["คำนวณ Fold Size\n+ Packing Size"]

    A2Y --> A5
    A4 --> A5

    A5["ดึง Tolerance ตาม Print Type\ngripper, color_bar, paper_edge, bleed"]
    A5 --> A6

    A6{"Component\nType?"}
    A6 -->|"1,2"| A6A["shortSide = gripper + color_bar\nlongSide = paper_edge × 2"]
    A6 -->|"3"| A6B["shortSide = gripper + color_bar + paper_edge×2\nlongSide = paper_edge × 2"]

    A6A --> A7
    A6B --> A7

    A7["เลือก Machine ที่เหมาะสม"]
    A7 --> A8

    A8["หา Standard Paper Size\nจาก machine_std_paper + tb_master_std_paper"]
    A8 --> A9

    A9["คำนวณ 4 แบบ Layout"]

    A9 --> L1["1. Straight + Vertical"]
    A9 --> L2["2. Straight + Horizontal"]
    A9 --> L3["3. Overlap + Vertical"]
    A9 --> L4["4. Overlap + Horizontal"]

    L1 --> A10
    L2 --> A10
    L3 --> A10
    L4 --> A10

    A10{"เลือก Layout\nที่ UPS สูงสุด"}
    A10 --> A11["Layout Result:\nUPS, layout_size, laying_type, grain"]

    A11 --> END([จบคำนวณ Layout])
```

---

## 3. Machine Selection Logic (เงื่อนไขเลือกเครื่องจักร)

```mermaid
flowchart TD
    START([เลือกเครื่องจักร]) --> PT

    PT{"Print Type?"}

    PT -->|Offset| OFF
    PT -->|Flexo| FLX
    PT -->|Jet Press| JP
    PT -->|Konica| KON

    subgraph OFF["Offset Machines"]
        O1{"Component\nType?"}
        O1 -->|"1,2"| O2{"Custom\nMachine?"}
        O1 -->|"3"| O3["→ Flexo Machine\n(Component 3 ต้องใช้ Flexo)"]

        O2 -->|ใช่| O2Y["ใช้ Machine ที่เลือก"]
        O2 -->|ไม่| O4["Default = Cut 2 (L440)"]

        O4 --> O5{"หา Std Paper\nที่ match?"}
        O5 -->|เจอ| O6["ใช้ Cut 2 + Std Paper"]
        O5 -->|ไม่เจอ| O7{"หา Std Paper\nในทุก machine?"}
        O7 -->|เจอ| O8["เปลี่ยน Machine\nตาม Std Paper"]
        O7 -->|ไม่เจอ| O9["ใช้ Machine แรก\n+ Max Size"]
    end

    subgraph FLX["Flexo Machine"]
        F1{"Open Size\n≤ Max Size?"}
        F1 -->|ใช่| F2["ใช้ Flexo (id=4)"]
        F1 -->|ไม่| F3["ใช้ Machine ว่าง (id=9998)"]

        F2 --> F4{"จำนวนชั้น\nลูกฟูก?"}
        F4 -->|"2 ชั้น"| F5["Max: 57 × 50 inch"]
        F4 -->|"3-5 ชั้น"| F6["Max: 57 × 94.4 inch"]
    end

    subgraph JP["Jet Press Machine"]
        J1["Machine เดียว\n15.5×21.5 ~ 23.03×29.52 inch"]
        J2["GSM: 190-500"]
        J3["ไม่มี Special Ink"]
        J4["Component: 1, 2 เท่านั้น"]
    end

    subgraph KON["Konica Machine"]
        K1["Machine เดียว\n5.51×7.16 ~ 13×19.17 inch"]
        K2["GSM: 60-350"]
        K3["ไม่มี Special Ink"]
        K4["Component: 1 เท่านั้น"]
    end

    OFF --> FILTER
    FLX --> FILTER
    JP --> FILTER
    KON --> FILTER

    FILTER["กรองตามเงื่อนไข:\n1. Print Type match\n2. Component Type match\n3. Color range match\n4. ถ้า Profit Sharing → เช็ค Cut 2 only"]

    FILTER --> RESULT(["Machine ที่เลือก"])
```

---

## 4. Cost Calculation Breakdown (รายละเอียดต้นทุน)

```mermaid
flowchart LR
    subgraph MAT["วัสดุ (Material)"]
        M1["กระดาษ\npaper_net × unit_price\n[db: tb_master_paper]"]
        M2["ลูกฟูก\nunit_inch × flute × cut\n[db: tb_master_corrugated_board]"]
        M3["หมึกพิเศษ\nqty × ink_price\n[db: tb_master_special_ink]"]
        M4["วัสดุเพิ่มเติม\nqty × unit_price\n[input]"]
    end

    subgraph PLT["เพลท/Proof"]
        P1["เพลท Offset\ncolors × 800 THB\n[config: plate_price]"]
        P2["เพลท Flexo\n6.53 THB/sqin × area\n[config: plate_polymer_price]"]
        P3["Proof\n500 / 200 THB\n[config: proof_price]"]
    end

    subgraph PRT["พิมพ์ (Print)"]
        PR1["Offset\nrate × ink_factor × colors\n[db: tb_master_price_rate]"]
        PR2["Flexo\nrate × UPS × colors\n[db: tb_master_price_rate]"]
        PR3["Jet Press\nprice/sheet × paper_print\n[db: tb_master_jetpress_info]"]
        PR4["Konica\n3 THB/ด้าน × paper_print\n[hardcoded]"]
    end

    subgraph AFP["หลังพิมพ์ (Afterpress)"]
        A1["Coating\nw × l × rate × side\n[db: tb_master_coating]"]
        A2["Foil Stamp\nlabor + foil_roll + block\n[db: tb_master_blockstamp]"]
        A3["Emboss/Deboss\nlabor + block\n[db: tb_master_blockstamp]"]
        A4["Die-cut\nblock + labor\n[db: tb_master_blockdiecut]"]
        A5["Assembly\nrate × qty × factor\n[db: tb_master_price_rate]"]
        A6["Chip\nrate × qty\n[db: tb_master_price_rate]"]
        A7["Inspection\nrate × qty\n[db: tb_master_price_rate]"]
        A8["Digital Die-cut\n5 THB × qty\n[hardcoded]"]
    end

    subgraph PKG["แพ็คกิ้ง & จัดส่ง"]
        PK1["Paperband\n0.5 THB/มัด\n[config]"]
        PK2["Kraft Wrap\n5 THB/ห่อ\n[config]"]
        PK3["Carton\n5+3+15 THB/กล่อง\n[config]"]
        PK4["Pallet\n1,100 THB MIF\n[config]"]
        PK5["Delivery\n1,500 THB/ton\n[config]"]
    end

    MAT --> SUM["รวมต้นทุน\nSubtotal"]
    PLT --> SUM
    PRT --> SUM
    AFP --> SUM
    PKG --> SUM

    SUM --> MK["+ Markup %\n+ Profit Sharing %"]
    MK --> TAX["+ Tax 3%"]
    TAX --> GRAND["Grand Total\n× Exchange Rate"]
```

---

## 5. Waste Calculation Flow (การคำนวณเศษสูญเสีย)

```mermaid
flowchart TD
    START([เริ่มคำนวณ Waste]) --> QTY

    QTY["after_ups = ceil(qty / UPS)"]
    QTY --> LOOKUP

    LOOKUP["ค้นหา waste rate จาก database\nตาม print_type + qty range\n[db: tb_master_waste]"]
    LOOKUP --> TYPES

    subgraph TYPES["คำนวณ Waste แต่ละประเภท"]
        W1["waste_print\nถ้า rate < 1 → ceil(after_ups × rate)\nมิฉะนั้น → ใช้ rate ตรงๆ"]
        W2["waste_afterpress\nจาก afterpress_rate"]
        W3["waste_coating\nจาก coating_rate × จำนวนด้าน"]
        W4["waste_foilstamp\nจาก foilstamp_rate"]
        W5["waste_bossing\nจาก bossing_rate"]
        W6["waste_corrugated_board\nจาก corrugated_board_rate"]
        W7["waste_print_col_add\nจาก print_col_add_rate\nสำหรับสี > 4"]
    end

    TYPES --> CL

    CL{"ใช้ Color Limit?"}
    CL -->|ใช่| CL_Y["waste_color_limit =\nwaste(300) + (colors-4) × per_color(50)"]
    CL -->|ไม่| CL_N["waste_color_limit = 0"]

    CL_Y --> REDUCE
    CL_N --> REDUCE

    REDUCE{"Waste Reduction\n(Jet Press 30%, Konica 30%)"}
    REDUCE --> RED_CALC["สำหรับแต่ละ waste type:\nreduce = ceil(waste × reduce%/100)\nwaste = waste - reduce"]

    RED_CALC --> SUM

    subgraph SUM["รวม Waste ทั้งหมด"]
        S1["+ waste_print\n(Jet Press/Konica: คิดแยก outside/inside)"]
        S2["+ waste_color_limit"]
        S3["+ waste_afterpress + waste_afterpress_net"]
        S4["+ waste_print_col_add × (all_colors - 4)\nเฉพาะ Offset/Flexo ที่สี > 4"]
        S5["+ waste_coating × จำนวนด้าน\nต่อ coating ที่เลือก"]
        S6["+ waste_foilstamp\nต่อ foilstamp ที่เลือก"]
        S7["+ waste_bossing\nต่อ emboss/deboss ที่เลือก"]
    end

    SUM --> TOTAL["Total Waste = sum of all"]
    TOTAL --> END([จบคำนวณ Waste])
```

---

## 6. Paper Usage Flow (การคำนวณปริมาณกระดาษ)

```mermaid
flowchart TD
    START([เริ่ม]) --> QTY

    QTY[/"qty = จำนวนสินค้า\n[input]"/]
    QTY --> UPS

    UPS["UPS = จำนวนชิ้น/แผ่น\nจาก Layout Calculation"]
    UPS --> AU

    AU["after_ups = ceil(qty / UPS)"]
    AU --> WASTE

    WASTE["waste = คำนวณจาก\nWaste Calculation Flow\n(ดู Diagram #5)"]
    WASTE --> AW

    AW["after_waste = after_ups + waste"]
    AW --> PP

    PP["paper_print = after_waste × sig\n(sig = 1 ปกติ)"]
    PP --> SPLIT

    SPLIT["split = floor(roll_width / paperW)\n× floor(cut_off / paperL)\n[db: tb_master_std_paper]"]
    SPLIT --> PQ

    PQ["paper_qty = ceil(paper_print / split)"]
    PQ --> PN

    PN{"Print Type?"}
    PN -->|Konica| PN_K["paper_net = paper_qty\n(ไม่ปัดขึ้น)"]
    PN -->|อื่นๆ| PN_N["paper_net = ceil(paper_qty / 100) × 100\n(ปัดขึ้นหลัก 100)"]

    PN_K --> KG
    PN_N --> KG

    KG["kilogram = paper_net × gram / 1,550,000\n× roll_width × cut_off"]
    KG --> TON

    TON["ton = kilogram / 1,000"]
    TON --> COST

    COST["→ ไปคำนวณ Paper Cost\nprice = paper_net × unit_price"]
    COST --> END([จบ])

    style QTY fill:#e1f5fe
    style UPS fill:#e8f5e9
    style WASTE fill:#fff3e0
    style PN fill:#fce4ec
    style KG fill:#f3e5f5
```

---

## 7. Profit Sharing vs Standard Pricing (เปรียบเทียบ 2 โหมด)

```mermaid
flowchart TD
    START([ตรวจสอบโหมดราคา]) --> CHECK

    CHECK{"is_profit_sharing\n= true?"}

    CHECK -->|ไม่ใช่| STD
    CHECK -->|ใช่| PS

    subgraph STD["Standard Mode (ปกติ)"]
        direction TB
        S1["plate: 800 THB/สี"]
        S2["paper markup: 10%\n(นำเข้า 13%)"]
        S3["afterpress markup: 0%"]
        S4["material markup: 0%"]
        S5["outsource markup: 0%"]
        S6["corrugated markup: 10%"]
        S7["packing markup: 0%"]
        S8["delivery markup: 0%"]
        S9["total markup: 0%\n(min 0 THB)"]
        S10["addon labor: 20%"]
    end

    subgraph PS["Profit Sharing Mode"]
        direction TB
        P1["plate: 1,875 THB/สี\n(+134%)"]
        P2["paper markup: 18%\n(+8%)"]
        P3["afterpress markup: 20%\n(+20%)"]
        P4["material markup: 25%\n(+25%)"]
        P5["outsource markup: 25%\n(+25%)"]
        P6["corrugated markup: 20%\n(+10%)"]
        P7["packing markup: 25%\n(+25%)"]
        P8["delivery markup: 20%\n(+20%)"]
        P9["total markup: 5%\n(min 5,000 THB)"]
        P10["print: 0.14 THB/แผ่น\n(min 1,400 THB)"]
    end

    STD --> TOTAL_STD["Subtotal × (1 + markup%)\n+ Tax 3%"]
    PS --> TOTAL_PS["Subtotal × (1 + markup%)\n+ Total Markup 5% (min 5,000)\n+ Tax 3%"]

    TOTAL_STD --> RESULT(["Grand Total"])
    TOTAL_PS --> RESULT
```

---

## ดัชนี Diagram

| # | ชื่อ Diagram | วัตถุประสงค์ |
|---|------------|-----------|
| 1 | Main Calculation Pipeline | ภาพรวม flow ทั้งหมดตั้งแต่ input ถึง output |
| 2 | Layout Calculation Flow | ขั้นตอนคำนวณ layout: open size → tolerance → machine → UPS |
| 3 | Machine Selection Logic | เงื่อนไขเลือกเครื่องจักรตาม print type, component, สี |
| 4 | Cost Calculation Breakdown | รายละเอียดต้นทุนทุกรายการ + แหล่งข้อมูล |
| 5 | Waste Calculation Flow | การคำนวณ waste แต่ละประเภท + reduction |
| 6 | Paper Usage Flow | ขั้นตอน qty → after_ups → waste → paper_net → tons |
| 7 | Profit Sharing vs Standard | เปรียบเทียบ markup rates ระหว่าง 2 โหมด |
