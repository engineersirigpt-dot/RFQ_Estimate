# สรุป Flow การคำนวณราคา — ระบบ Estimate Packaging

> **เอกสารนี้** สรุปสูตรคำนวณ, parameter, แหล่งข้อมูลทุกขั้นตอน
> ข้อมูลที่มาจาก database จะระบุเป็น `[database: table_name]`
> ข้อมูลจาก config จะระบุเป็น `[config: default.js > field_name]`
> ข้อมูลจาก user input จะระบุเป็น `[input]`
> ข้อมูลที่ hardcode ใน source code จะระบุเป็น `[hardcoded]`

---

## 1. ภาพรวม Pipeline การคำนวณ

[input] ข้อมูล Spec
↓
[A] Layout Calculation — คำนวณ Open Size → Layout Size → UPS
↓
[B] Paper Usage — คำนวณปริมาณกระดาษ (waste, split, paper_net, tons)
↓
[C] Cost Calculation — คำนวณต้นทุนแต่ละรายการ (16 รายการ)
↓
[D] Markup & Total Price — บวก markup, ภาษี → ราคาสุดท้าย

**Source file หลัก:**

- `public/js/function_estimate_calculation.js` — Core calculation engine (8,813 บรรทัด)
- `public/js/function_estimate_layout.js` — Layout computation
- `public/js/data/default.js` — Config ค่าคงที่ทั้งหมด

---

## 2. สูตรคำนวณแต่ละขั้นตอน

---

### [A] Layout Calculation (คำนวณการวาง Layout บนกระดาษ)

---

#### [A1] คำนวณ Open Size (ขนาดกางแผ่น)

> Source: `setCalculateOpenSize()` — บรรทัด 4023-4115

สูตรขึ้นอยู่กับ box template type (1-12) :

Type 1 — RTE (Reverse Tuck End) :

- width : 2×(W+T) + D
- length : 2×(W+L) + G

Type 2 — STE (Straight Tuck End) :

- width : 2×(W+T) + D
- length : 2×(W+L) + G

Type 3 — TTSLB (Tuck Top Snap Lock Bottom) :

- width : T + W + D + W/2 + OL
- length : 2×(W+L) + G

Type 4 — TTAB (Tuck Top Auto Bottom) :

- width : T + W + D + W/2 + OL
- length : 2×(W+L) + G

Type 5 — DGWS (Double Glued Wall Sleeve) :

- width : W + 4×D
- length : L + 4×D + 2×dust

Type 6 — FVT (Four View Tray) :

- width : W + 4×D + 2×dust + 2×OL
- length : L + 4×D + 2×dust + 2×OL

Type 7 — CBT (Crash Bottom Tray) :

- width : 2×(L+dust) + W
- length : 2×(L+D) + L

Type 8 — GTA (Gable Top Auto) :

- width : T + 2×D + W/2 + OL
- length : 2×(W+L) + G

Type 9 — Sleeve :

- width : D
- length : 2×(W+L) + G

Type 10 — Pillow :

- width : L + D
- length : 2×W + G

Type 11 — SE (Seal End) :

- width : 2×W + D
- length : 2×(W+L) + G

Type 12 — Custom :

- ผู้ใช้กำหนดเอง `[input]`

**Parameter ที่ใช้ :**

- W (width) : ความกว้างกล่อง (mm) `[input]`
- L (length) : ความยาวกล่อง (mm) `[input]`
- D (depth) : ความลึกกล่อง (mm) `[input]`
- T (tuck_flap) : ฝาเสียบ (mm) `[input]`
- G (glue_flap) : ลิ้นกาว (mm) `[input]`
- dust (dust_flap) : ปีกฝุ่น (mm) `[input]` หรือ `[config: default.js > box_template]` (type 5,6 = 25mm)
- OL (overlap) : ส่วนเกย (mm) `[input]`

---

#### [A2] คำนวณ Tolerance (ขอบเผื่อ)

> Source: `setLayoutTolerance()` — function_estimate_layout.js บรรทัด 3-41

**สูตร tolerance ตาม component type :**

ไม่ประกบลูกฟูก (type 1) :

- ด้านสั้น : gripper + color_bar
- ด้านยาว : paper_edge × 2

ประกบลูกฟูก (type 2) :

- ด้านสั้น : gripper + color_bar
- ด้านยาว : paper_edge × 2

เฉพาะลูกฟูก (type 3) :

- ด้านสั้น : gripper + color_bar + (paper_edge × 2)
- ด้านยาว : paper_edge × 2

**ค่า Tolerance ตาม Print Type :**

Offset :

- gripper : 12 mm
- color_bar : 8 mm
- paper_edge : 4 mm
- bleed : 3 mm

Flexo :

- gripper : 25 mm
- color_bar : 3 mm
- paper_edge : 4 mm
- bleed : 3 mm

Jet Press :

- gripper : 25 mm
- color_bar : 3 mm
- paper_edge : 4 mm
- bleed : 3 mm

Konica :

- gripper : 35 mm
- color_bar : 0 mm
- paper_edge : 15 mm
- bleed : 3 mm

> แหล่งข้อมูล: `[config: default.js > print_type_config > tolerance]`

#### [A3] เลือก Machine & Standard Paper Size

> Source: `setMachine()` — บรรทัด 482-708

**เครื่องจักร :**

L444SP (Cut 1) :

- ID : 1
- Print Type : Offset
- ขนาด min : 18.11 × 24.41 inch
- ขนาด max : 33 × 45.275 inch
- สีสูงสุด : 8
- Component Type : 1, 2

L440 (Cut 2) :

- ID : 2
- Print Type : Offset
- ขนาด min : 14.18 × 20.48 inch
- ขนาด max : 28.35 × 40.56 inch
- สีสูงสุด : 6
- Component Type : 1, 2

LS1029 (Cut 3) :

- ID : 3
- Print Type : Offset
- ขนาด min : 10.24 × 14.18 inch
- ขนาด max : 20.87 × 29.53 inch
- สีสูงสุด : 8
- Component Type : 1, 2

Flexo :

- ID : 4
- Print Type : Offset, Flexo
- ขนาด min : 15.75 × 21 inch
- ขนาด max : 57 × 94.4 inch (ขึ้นกับจำนวนชั้น → ดู [A3-FLEXO])
- สีสูงสุด : 8
- Component Type : 3

Jet Press :

- ID : 5
- Print Type : Jet Press
- ขนาด min : 15.5 × 21.5 inch
- ขนาด max : 23.03 × 29.52 inch
- สีสูงสุด : 8
- Component Type : 1, 2

Konica :

- ID : 6
- Print Type : Konica
- ขนาด min : 5.51 × 7.16 inch
- ขนาด max : 13 × 19.17 inch
- สีสูงสุด : 8
- Component Type : 1

> แหล่งข้อมูล: `[config: default.js > machine]`

[A3-FLEXO] Flexo max size ตามจำนวนชั้นลูกฟูก :

- 2 ชั้น : max 57 × 50 inch
- 3-5 ชั้น : max 57 × 94.4 inch

**Logic เลือก Machine (Offset) :**

1. Default เลือก Cut 2 (id=2)
2. หา std paper ที่ match กับ open_size + offset `[hardcoded: 1.04" width, 0.57" length]`
3. ถ้าไม่เจอใน Cut 2 → ลองหาใน machine อื่น
4. ถ้าไม่เจอเลย → ใช้ machine แรก + max size

> Standard Paper Sizes : `[database: tb_master_std_paper]` + `[database: machine_std_paper]`

---

#### [A4] คำนวณ UPS (จำนวนชิ้นต่อแผ่น)

> Source: `calculateStraightPrintSize()` / `calculateOverlapPrintSize()` — function_estimate_layout.js

**สูตรคำนวณ UPS (Straight Laying) :**

```
W_side_count = จำนวน box ที่วางได้ด้าน Width (เพิ่มทีละ 1 จนเกิน paperSize)
L_side_count = floor(paperSize_L / L_side_one)
UPS = W_side_count × L_side_count
```

**มี 4 แบบ Layout :**

1. Straight + Vertical (ตั้ง)
2. Straight + Horizontal (นอน)
3. Overlap + Vertical (เกย + ตั้ง)
4. Overlap + Horizontal (เกย + นอน)

ระบบจะคำนวณทั้ง 4 แบบแล้วเลือก layout ที่ได้ UPS สูงสุด

---

### [B] Paper Usage (คำนวณปริมาณกระดาษ)

> Source: `setCalculatePaperWeight()` — บรรทัด 3489-3571

---

#### [B1] คำนวณ Split

> Source: `setCalculateSplit()` — บรรทัด 3439-3487

```
split = floor(roll_width / paperSize_width) × floor(cut_off / paperSize_length)
```

> หมายเหตุ: roll_width และ cut_off มาจาก `[database: tb_master_std_paper]`

---

#### [B2] คำนวณ After UPS

```
after_ups = ceil(qty / UPS)
```

---

#### [B3] คำนวณ Waste (เศษกระดาษสูญเสีย)

> Source: `setWaste()` — บรรทัด 848-1046

**ประเภท waste ทั้งหมด :**

waste_print :

- แหล่งข้อมูล : `[database: tb_master_waste > print_rate]` ตาม print_type
- หมายเหตุ : ถ้า rate < 1 → คิดเป็น % ของ after_ups

waste_afterpress :

- แหล่งข้อมูล : `[database: tb_master_waste > afterpress_rate]`
- หมายเหตุ : ค่าเดียวกันทุก print_type

waste_coating :

- แหล่งข้อมูล : `[database: tb_master_waste > coating_rate]`
- หมายเหตุ : คิดต่อด้าน (1 หรือ 2 ด้าน)

waste_foilstamp :

- แหล่งข้อมูล : `[database: tb_master_waste > foilstamp_rate]`
- หมายเหตุ : คิดต่อรายการ foil

waste_bossing :

- แหล่งข้อมูล : `[database: tb_master_waste > bossing_rate]`
- หมายเหตุ : คิดต่อรายการ emboss/deboss

waste_corrugated_board :

- แหล่งข้อมูล : `[database: tb_master_waste > corrugated_board_rate]`
- หมายเหตุ : สำหรับ comp type 2, 3

waste_color_limit :

- แหล่งข้อมูล : คำนวณจาก color_limit config → ดูสูตร [B3-CL]
- หมายเหตุ : ดูเงื่อนไขด้านล่าง

waste_print_col_add :

- แหล่งข้อมูล : `[database: tb_master_waste > print_col_add_rate]`
- หมายเหตุ : สำหรับสี > 4 สี

[B3-CL] สูตรคำนวณ waste_color_limit :

```
ถ้า component type 1 หรือ 2 และเปิดใช้ color_limit:
    waste_color_limit = 0
    ถ้า outside > 0:
        waste_color_limit += color_limit_waste               [config: print_type_config > color_limit_waste > waste]
        ถ้า outside > 4:
            waste_color_limit += (outside - 4) × waste_per_color  [config: print_type_config > color_limit_waste > waste_per_color]
    ถ้า inside > 0:
        (เช่นเดียวกับ outside)
```

**ค่า Color Limit Waste ตาม Print Type :**

Offset :

- waste เริ่มต้น : 300 แผ่น
- waste_per_color : 50 แผ่น/สี
- reduce_percent : 0%

Flexo :

- waste เริ่มต้น : 300 แผ่น
- waste_per_color : 50 แผ่น/สี
- reduce_percent : 0%

Jet Press :

- waste เริ่มต้น : 150 แผ่น
- waste_per_color : 20 แผ่น/สี
- reduce_percent : 30%

Konica :

- waste เริ่มต้น : 150 แผ่น
- waste_per_color : 20 แผ่น/สี
- reduce_percent : 30%

> แหล่งข้อมูล: `[config: default.js > print_type_config > color_limit_waste]`

[B3-REDUCE] สูตร waste reduction :

```
wasteReducePercent = reduce_paper_waste_percent                [config]
ถ้าเป็น digital_diecut:
    wasteReducePercent += reduce_paper_waste_percent_digital_diecut [config: 20%]

สำหรับแต่ละ waste type (ยกเว้น waste_print, waste_color_limit):
    total_reduce = ceil(waste_value × (wasteReducePercent / 100))
    waste_value = waste_value - total_reduce
```

[B3-SUM] สูตรรวม waste ทั้งหมด :

```
waste = 0

// Print waste
ถ้า Jet Press หรือ Konica:
    ถ้า outside > 0: waste += waste_print
    ถ้า inside > 0:  waste += waste_print
มิฉะนั้น (Offset/Flexo):
    waste += waste_print

waste += waste_color_limit
waste += waste_afterpress
waste += waste_afterpress_net   (สำหรับ digital_diecut)

// สีเพิ่ม (> 4 สี) — เฉพาะ Offset/Flexo
ถ้า all_colors > 4 และไม่ใช่ Jet Press/Konica:
    waste += (all_colors - 4) × waste_print_col_add

// Process waste (ตาม addon ที่เลือก)
สำหรับแต่ละ coating:
    ถ้า 1 ด้าน: waste += waste_coating + waste_coating_net
    ถ้า 2 ด้าน: waste += 2 × waste_coating + 2 × waste_coating_net

สำหรับแต่ละ foilstamp:    waste += waste_foilstamp
สำหรับแต่ละ emboss/deboss: waste += waste_bossing
```

**หมายเหตุ Jet Press & Konica :** ใช้ตาราง waste แยกต่างหาก

- Jet Press : `[database: tb_master_jetpress_waste]`
- Konica : `[database: tb_master_konica_waste]`

---

#### [B4] คำนวณปริมาณกระดาษ

```
after_waste = after_ups + waste                                ← waste จาก [B3-SUM]
paper_print = after_waste × sig                                (sig = 1 ปกติ)
paper_qty   = ceil(paper_print / split)                        ← split จาก [B1]
paper_net   = ceil(paper_qty / 100) × 100                     (ปัดขึ้นให้หาร 100 ลงตัว)

// เงื่อนไขพิเศษ: Konica ไม่ปัดขึ้น 100
ถ้า print_type == "Konica":
    paper_net = paper_qty

kilogram = paper_net × gram / 1,550,000 × roll_width × cut_off
ton      = kilogram / 1,000
```

> `[hardcoded: formula_value = 1,550,000]` — ค่าคงที่ในการแปลงหน่วย (gsm → kg)

---

### [C] Cost Calculation (คำนวณต้นทุนแต่ละรายการ)

> ลำดับการคำนวณ (เรียกจาก `setCalculatePaperWeight`) :
> [C1] Paper → [C2] Plate → [C3] Proof → [C4] Print → [C5] Coating →
> [C6] Foil Stamp → [C7] Bossing → [C8] Special Ink → [C9] Assembly →
> [C10] Die-cut → [C11] Digital Die-cut → [C12] Chip → [C13] Inspection →
> [C14] Corrugated → [C15] Packing → [C16] Delivery

---

#### [C1] ต้นทุนกระดาษ (Paper Cost)

> Source: `setCalculatePaperCost()` — บรรทัด 3573-3618

```
paper_total_price = (paper_cost × (1 + paper_markup/100)) + paper_percent

// ถ้าหน่วยเป็น THB/sheet:
unit_price = paper_total_price

// ถ้าหน่วยเป็น THB/kg:
unit_price = roll_width × cut_off × paper_total_price × gram / 1,550,000

price = paper_net × unit_price                                 ← paper_net จาก [B4]
```

**Parameter :**

- paper_cost : ราคากระดาษ (THB/kg หรือ THB/sheet) `[database: tb_master_paper > price]`
- paper_markup : % markup กระดาษ `[config: default.js > paper_price_marking]` (ปกติ 10%, profit sharing 18% → ดู [D])
- paper_percent : ส่วนเพิ่มราคากระดาษ `[input]` (ปกติ = 0)
- gram : แกรมกระดาษ (gsm) `[database: tb_master_paper > gram]`
- roll_width, cut_off : ขนาดกระดาษ (inch) `[database: tb_master_std_paper]`

> หมายเหตุ: ถ้ามี std_paper_id จะใช้ `std_paper_size_cost_width_in` / `std_paper_size_cost_length_in` แทน

---

#### [C2] ต้นทุนเพลท (Plate Cost)

> Source: `setCalculatePlateCost()` — บรรทัด 3621-3795

**Offset :**

```
plate_ppu = plate_price                                        [config: plate_price = 800 THB]
ถ้าใช้ Cut 1: plate_ppu += cut_1_plate_markup                  [config: cut_1_plate_markup = 50 THB]
ถ้า reprint + ใช้ plate เดิม:
    plate_ppu = plate_ppu - (plate_ppu × reprintReducePercent/100)  [config: reprintReducePlateCostPercent = 50%]

qty = max(round(after_waste / 100,000), 1)
unit_price_outside = outside_colors × sig × plate_ppu
unit_price_inside  = inside_colors × sig × plate_ppu
price_outside = unit_price_outside × qty
price_inside  = unit_price_inside × qty

// ถ้า qty > 1 และไม่ได้ใช้ plate เดิม → แยก reprint plate
reprint_plate_ppu = plate_price - (plate_price × 50/100) + plate_markup
reprint_qty = qty - 1
first_qty = 1
```

**Offset + Profit Sharing :** → ดู [D2]

```
plate_ppu = 1,875 THB/สี                                      [config: profit_sharing > plate_price]
```

**Flexo :**

```
plate_polymer_ppu = plate_polymer_price × flexo_width × flexo_length
                                                               [config: plate_polymer_price = 6.53 THB/sqin]
// ถ้า reprint:
plate_polymer_ppu = reprint_plate_polymer_price × flexo_width × flexo_length
                                                               [config: reprint_plate_polymer_price = 5.94 THB/sqin]

price_outside = plate_polymer_ppu × UPS × outside_colors
price_inside  = plate_polymer_ppu × UPS × inside_colors
// ถ้า price > 0 แต่ < block_polymer_min_price → ใช้ min_price
                                                               [config: block_polymer_min_price = 50 THB]
```

**Jet Press / Konica :** ไม่มีค่า plate (= 0)

---

#### [C3] ต้นทุน Proof

> Source: `setCalculateProofCost()` — บรรทัด 3990-4021

เฉพาะ Jet Press และ Konica เท่านั้น :

```
price = proof_price_per_component × 1 (ครั้ง / job)
```

**ค่า proof_price_per_component ตาม Print Type :**

Offset :

- proof_price_per_component : 500 THB

Flexo :

- proof_price_per_component : 500 THB

Jet Press :

- proof_price_per_component : 500 THB

Konica :

- proof_price_per_component : 200 THB

> แหล่งข้อมูล: `[config: default.js > print_type_config > proof_price_per_component]`

---

#### [C4] ต้นทุนพิมพ์ (Print Cost)

> Source: `setCalculatePrintCost()` — บรรทัด 3798-3988

**Offset :**

```
// กำหนด type ตามจำนวนสี
type = outside < 3 ? 'print_1col' : outside < 5 ? 'print_3col' : 'print_5col'

// หา price rate จาก database → ดู [E]
print_price = setPriceRate(type, after_ups)                    [database: tb_master_price_rate]
                                                               [database: tb_master_min_price]

// ถ้าหมึก UV → ตัวคูณ 2.5 เท่า
ink_factor = 1
ถ้า ink_type == 'UV': ink_factor = 2.5                         [hardcoded]

// outside
unitprice_out = ink_factor × print_price_out × outside_colors × sig
price_out = unitprice_out × 1

// inside (คำนวณเหมือนกัน)
unitprice_in = ink_factor × print_price_in × inside_colors × sig
price_in = unitprice_in × 1
```

**Offset/Flexo + Profit Sharing :** → ดู [D2]

```
print_price = after_ups × print_rate                           [config: profit_sharing > print > print_rate = 0.14]
ถ้า print_price < print_min_price:
    print_price = print_min_price                              [config: profit_sharing > print > print_min_price = 1,400]
```

**Flexo :**

```
print_price = setPriceRate('print_flexo', after_ups)           [database: tb_master_price_rate]
unitprice_out = print_price × outside_colors
qty = UPS × outside_colors
```

**Jet Press :**

```
col_factor = (colors > 0) ? 1 : 0
print_price = setPriceRate4JetPress(item, paper_print)         [database: tb_master_jetpress_info]
    → หา price ตาม std_paper_size ที่ match กับ layout_size

unitprice = col_factor × print_price
qty = paper_print
price = unitprice × qty (คำนวณแยก outside, inside)
```

**Konica :**

```
col_factor = (colors > 0) ? 1 : 0
print_price = 3 THB (สี) หรือ 1 THB (ขาวดำ)                    [hardcoded]

unitprice = col_factor × print_price
qty = paper_print
price = unitprice × qty (คำนวณแยก outside, inside)
```

---

#### [C5] ต้นทุน Coating (เคลือบ)

> Source: `setCalculateCoatingCost()` — บรรทัด 5967-6045

```
qty = paper_print                                              ← จาก [B4]

// ปกติ (UV, Waterbase, OPP ฯลฯ)
unit_price = UPS_factor × width × length × coating_price × side_count
                                                               [database: tb_master_coating > rate]

// B-PACK (Blister Pack):
unit_price = coating_price × side_count

// S-UV (Spot UV):
UPS_factor = UPS                                               (คูณ UPS เพราะ Spot UV คิดต่อชิ้น)
unit_price = UPS × width × length × coating_price × side_count

// Minimum cost check:
ถ้า unit_min_cost == 'sheet': ถ้า unit_price < min_cost → unit_price = min_cost
ถ้า unit_min_cost == 'price': ถ้า qty × unit_price < min_cost → price = min_cost

// + Afterpress markup → ดู [D]
unit_price = unit_price × (1 + afterpress_price_marking/100)
price = qty × unit_price
```

**Parameter :**

- coating_price (rate) : ราคาเคลือบ/sq.in `[database: tb_master_coating > rate]`
- min_cost : ราคาขั้นต่ำ `[database: tb_master_coating > min_cost]`
- unit_min_cost : หน่วยราคาขั้นต่ำ ('sheet' หรือ 'price') `[database: tb_master_coating > unit_min_cost]`
- side_count : จำนวนด้าน (1 หรือ 2) `[input]`
- width, length : ขนาดพื้นที่เคลือบ (inch) → จาก `layout.laySize` หรือ `[input]` สำหรับ S-UV

---

#### [C6] ต้นทุน Foil Stamp (ปั๊มฟอยล์)

> Source: `setCalculateFoilStampCost()` — บรรทัด 6333-6454

```
// 1. คำนวณจำนวนชิ้นต่อม้วน
num_roll_width_side  = floor(foil_width / (stamp_width + foil_width_tolerance × 2))
num_roll_long_side   = floor(foil_length × 12 / (stamp_length + foil_length_tolerance))
pcs_per_roll = num_roll_width_side × num_roll_long_side

// 2. ราคาฟอยล์ต่อชิ้น
foil_unit_price = (foil_roll_price × (1 + material_price_marking/100)) / pcs_per_roll

// 3. ค่า Block (บล็อค)
block_unit_price = stamp_width × stamp_length × block_rate     [database: tb_master_blockstamp > rate (foil)]
ถ้า < block_foilstamp_min_cost → ใช้ min                       [config: block_foilstamp_min_cost = 70 THB]

film_unit_price = stamp_width × stamp_length × film_rate       [config: film_rate = 1.25 THB/sqin]
ถ้า < film_min_cost → ใช้ min                                  [config: film_min_cost = 120 THB]

total_block_unit_price = (block_unit_price + film_unit_price) × (1 + material_price_marking/100)

// 4. ค่าแรง → ดู [E]
labor_unit_price = (setPriceRate('foilstamp', after_ups).unit_price / UPS) × (1 + addon_labor_price_marking/100)
labor_price = labor_unit_price × qty
ถ้า labor_price < min_price → labor_price = min_price          [database: tb_master_min_price]
labor_price = labor_price × (1 + afterpress_price_marking/100) ← markup จาก [D]

// 5. ราคาฟอยล์ม้วน
foil_roll_price_total = qty × foil_unit_price
ถ้า < foil_roll_min_price → ใช้ min × (1 + material_price_marking/100)

// 6. Block price
block_price = total_block_unit_price × UPS

// รวม = labor + foil_roll + block
```

**Parameter :**

- foil_width, foil_length : ขนาดม้วนฟอยล์ (mm, mm→ft) `[database: tb_master_foilstamp]`
- foil_roll_price : ราคาม้วนฟอยล์ `[database: tb_master_foilstamp > roll_price]`
- foil_roll_min_price : ราคาขั้นต่ำม้วน `[database: tb_master_foilstamp > roll_min_price]`
- stamp_width, stamp_length : ขนาดพื้นที่ปั๊ม (inch) `[input]`
- block_rate : ราคาบล็อค/sq.in `[database: tb_master_blockstamp > rate (foil = 17 THB/sqin)]`
- film_rate : ราคายิงฟิล์ม/sq.in `[config: film_rate = 1.25]`
- foil_width_tolerance : เผื่อ tolerance ด้านกว้าง `[config: foil_width_tolerance = 0.5 inch]`
- foil_length_tolerance : เผื่อ tolerance ด้านยาว `[config: foil_length_tolerance = 1 inch]`
- addon_labor_price_marking : % markup ค่าแรงเพิ่มเติม `[config: addon_labor_price_marking = 20%]`

---

#### [C7] ต้นทุน Emboss/Deboss (ปั๊มนูน/ปั๊มจม)

> Source: `setCalculateBossingCost()` — บรรทัด 6456-6575

```
// สำหรับแต่ละจุดปั๊ม (size):
block_unit_price = width × length × block_rate                 [database: tb_master_blockstamp > rate]
film_unit_price  = width × length × film_rate                  [config: film_rate = 1.25 THB/sqin]
ถ้า film_unit_price < film_min_cost → ใช้ min                   [config: film_min_cost = 120 THB]

total_block_price = (block_unit_price + film_unit_price) × (1 + material_price_marking/100)

// ค่าแรง (คิดครั้งเดียวต่อ addon ไม่ว่าจะมีกี่จุด) → ดู [E]
labor_unit_price = (setPriceRate('bossing', after_ups).unit_price / UPS) × (1 + addon_labor_price_marking/100)
labor_price = labor_unit_price × qty
ถ้า < min_price → ใช้ min
labor_price = labor_price × (1 + afterpress_price_marking/100) ← markup จาก [D]

block_price = total_block_price × UPS
```

**Block Rate ตาม stamp_type / depth :**

Foil :

- rate : 17 THB/sqin

Emboss บาง (1.25mm) :

- rate : 38 THB/sqin

Emboss หนา (1.65mm) :

- rate : 50 THB/sqin

Deboss บาง (1.25mm) :

- rate : 38 THB/sqin

Deboss หนา (1.65mm) :

- rate : 50 THB/sqin

> แหล่งข้อมูล: `[database: tb_master_blockstamp]`

---

#### [C8] ต้นทุนหมึกพิเศษ (Special Ink Cost)

> Source: `setCalculateSpecialInkCost()` — บรรทัด 6729-6771

```
qty = ceil(1.05 × laySize_W × laySize_L × after_waste × filling_percent / factor)
                                                               [database: special_ink_factor_info → factor, filling_percent]

unit_price = special_ink_price × (1 + material_price_marking/100) ← markup จาก [D]
price = qty × unit_price
```

**ราคาหมึกพิเศษ ตามประเภท :**

Common Special Ink :

- ราคา : 250 THB

Metallic :

- ราคา : 950 THB

Reflective :

- ราคา : 1,000 THB

UV Resistant :

- ราคา : 450 THB

UV :

- ราคา : 1,300 THB

> แหล่งข้อมูล: `[database: tb_master_special_ink]`

---

#### [C9] ต้นทุน Assembly (ประกอบ/ติดกาว)

> Source: `setCalculateAssemblyCost()` — บรรทัด 6915-6951

```
// กำหนด type ตามขนาด open_size → ดู [C9-SIZE]
type = setAssemblyType(open_size)

// Assembly Factor ตามจำนวนจุดกาว → ดู [C9-FACTOR]
rate = setPriceRate(type, qty) × factor                        [database: tb_master_price_rate] → ดู [E]

// เพิ่ม markup สำหรับ comp type 2,3 (ประกบ/ลูกฟูก)
ถ้า comp_type == 2 หรือ 3:
    unit_price += corrugated_assembly_markup_price              [config: corrugated_assembly_markup_price = 0.1 THB]

// Minimum price check
ถ้า unit_price × qty < min_price → price = min_price           [database: tb_master_min_price]

// + Afterpress markup → ดู [D]
price = price × (1 + afterpress_price_marking/100)
```

[C9-SIZE] Assembly Size Classification :

assembly_S :

- เงื่อนไข : open_size ≤ 9 × 11 inch

assembly_M :

- เงื่อนไข : open_size ≤ 21 × 31 inch

assembly_L :

- เงื่อนไข : open_size > 21 × 31 inch

> แหล่งข้อมูล: `[config: default.js > assembly_size]`

[C9-FACTOR] Assembly Factor ตามจำนวนจุดกาว `[hardcoded]` :

- 1 จุด : × 1.0
- 2 จุด : × 1.5
- 3 จุด : × 1.75
- 4 จุด : × 1.9

---

#### [C10] ต้นทุน Die-cut (ไดคัท)

> Source: `setCalculateDieCutCost()` — บรรทัด 6953-7007

```
// Block cost
block_rate = setBlockDiecutRate2(layout.laySize)               [database: tb_master_blockdiecut]
block_rate = block_rate × (1 + material_price_marking/100)     ← markup จาก [D]
block_qty = 1 (หรือ 2 ถ้ามี OPP Window coating → ดู [C10-OPP])
block_price = block_qty × block_rate

// Labor cost → ดู [E]
labor_diecut_rate = setPriceRate('diecut', after_ups)           [database: tb_master_price_rate]
labor_unit_price = labor_diecut_rate.unit_price / UPS
factor = 1 (หรือ 2 ถ้ามี OPP Window coating → ดู [C10-OPP])
labor_price = labor_unit_price × factor × qty
ถ้า < min_price → ใช้ min_price                                [database: tb_master_min_price]
labor_price = labor_price × (1 + afterpress_price_marking/100) ← markup จาก [D]
```

[C10-OPP] เงื่อนไข OPP Window :

- ถ้ามี OPP Window Coating (process_id 36 หรือ 51) → block_qty = 2, factor = 2

---

#### [C11] ต้นทุน Digital Die-cut

> Source: `setCalculateDigitalDieCutCost()` — บรรทัด 7009-7047

เฉพาะ Konica ที่เลือก digital_diecut :

```
unit_price = 5 THB/แผ่น                                        [hardcoded]
qty = after_waste
price = unit_price × qty × (1 + afterpress_price_marking/100) ← markup จาก [D]
```

---

#### [C12] ต้นทุน Chip (แกะชิ้นงาน)

> Source: `setCalculateChipCost()` — บรรทัด 6784-6835

```
qty = รวม qty ทุก component (ยกเว้น digital_diecut)
rate = setPriceRate('chip', qty)                                [database: tb_master_price_rate] → ดู [E]
ถ้า rate × qty < min_price → price = min_price                 [database: tb_master_min_price]
price = price × (1 + afterpress_price_marking/100)             ← markup จาก [D]
```

---

#### [C13] ต้นทุน Inspection (ตรวจสอบคุณภาพ)

> Source: `setCalculateInspectionCost()` — บรรทัด 7051-7102

```
qty = รวม qty ทุก component (ยกเว้น digital_diecut)
rate = setPriceRate('inspection', qty)                          [database: tb_master_price_rate] → ดู [E]
ถ้า rate × qty < min_price → price = min_price                 [database: tb_master_min_price]
price = price × (1 + afterpress_price_marking/100)             ← markup จาก [D]
```

---

#### [C14] ต้นทุนลูกฟูก (Corrugated Board)

> Source: `setCalculateCorrugatedBoard()` — บรรทัด 6047-6294

```
// หา corrugated cost จาก database ตาม grade, flute_type, qty range
cost = db.corrugated_info.find(
    grade == info.name
    && flute_type == info.flute_type
    && min_qty <= after_ups
    && max_qty >= after_ups
).rate                                                          [database: tb_master_corrugated_board]

// คำนวณ unit price
unit_inch = (cost / 144) × (1 + corrugated_markup/100)        [config: corrugated_markup → ดู [D]]

// Component type 2: ลูกฟูกเล็กกว่ากระดาษ 0.375 นิ้ว
flute_side = laySize - corrugated_tolerance                     [config: corrugated_tolerance = 0.375 inch]
cut_off = laySize - corrugated_tolerance

unit_price = unit_inch × flute_side × cut_off

// Component type 3: ลูกฟูกเป็นขนาดกระดาษเลย → ใช้ roll_width, cut_off ตรงๆ
```

[C14-GLUE] Corrugated Glued Cost (กาวประกบลูกฟูก) :

```
glued_unit_price = flute_side × cut_off × corrugated_glued_cost
                                                               [config: corrugated_glued_cost = 0.0015 THB/sqin]
glued_price = qty × glued_unit_price × (1 + afterpress_price_marking/100) ← markup จาก [D]
```

---

#### [C15] ต้นทุนแพ็คกิ้ง (Packing Cost)

> Source: `setCalculatePackingCost()` (external function)

Paperband (สายรัดกระดาษ) :

- qty_per_paperband : 100 ชิ้น/มัด `[config: paperband_info > qty_per_paperband]`
- paperband_price : 0.5 THB/มัด `[config: paperband_info > paperband_price]`

Kraft Wrap (ห่อกระดาษคราฟท์) :

- limit_weight : 5 kg/ห่อ `[config: kraftwrap_info > limit_kraftwrap_weight]`
- kraftwrap_price : 5 THB/ห่อ `[config: kraftwrap_info > kraftwrap_price]`

Carton (กล่องลูกฟูก) :

- limit_weight : 15 kg/กล่อง `[config: carton_info > limit_carton_weight]`
- carton_price : 5 THB/กล่อง `[config: carton_info > carton_price]`
- carton_printing_price : 3 THB/กล่อง `[config: carton_info > carton_printing_price]`
- markup_price : 15 THB/กล่อง `[config: carton_info > markup_price]`

Pallet :

- limit_weight : 750 kg/พาเลท `[config: pallet_info > limit_pallet_weight]`
- empty_pallet_weight : 25 kg `[config: pallet_info > empty_pallet_weight]`
- limit_height : 44 inch `[config: pallet_info > limit_pallet_height]`
- mif_unit_price : 1,100 THB (ค่าพาเลท MIF) `[config: pallet_info > mif_unit_price]`

---

#### [C16] ต้นทุนจัดส่ง (Delivery Cost)

> Source: `setCalculateDelivery()` — บรรทัด 7303-7358

```
unit_price = delivery_rate × gross_weight / 1,000              [config: delivery_rate = 1,500 THB/ton]
```

gross_weight มาจากน้ำหนัก packing ที่คำนวณได้ (carton, kraftwrap, หรือ pallet) ← จาก [C15]

---

### [D] Markup & Total Price

> Source: `setCalculateTotalPrice()` — บรรทัด 7361+

---

#### [D1] โหมด Standard (ไม่มี Profit Sharing)

paper_price_marking (กระดาษในประเทศ) :

- ค่า : 10%
- แหล่งข้อมูล : `[config: default_marking > paper > marking_price]`

import_paper_price_marking (กระดาษนำเข้า) :

- ค่า : 13%
- แหล่งข้อมูล : `[config: default_marking > paper > import_marking_price]`

addon_labor_price_marking (ค่าแรงเสริม) :

- ค่า : 20%
- แหล่งข้อมูล : `[config: default_marking > addon_labor_price_marking]`

afterpress_price_marking (หลังพิมพ์) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > afterpress_price_marking]`
- ใช้ใน : [C5] Coating, [C6] Foil labor, [C7] Bossing labor, [C9] Assembly, [C10] Die-cut labor, [C11] Digital Die-cut, [C12] Chip, [C13] Inspection, [C14-GLUE]

material_price_marking (วัสดุ) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > material_price_marking]`
- ใช้ใน : [C6] Foil block/roll, [C7] Bossing block, [C8] Special Ink, [C10] Die-cut block

outsouce_price_marking (จ้างภายนอก) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > outsouce_price_marking]`

packing_marking (แพ็คกิ้ง) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > packing_marking]`

delivery_marking (จัดส่ง) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > delivery_marking]`

corrugated_markup (ลูกฟูก) :

- ค่า : 10%
- แหล่งข้อมูล : `[config: default_marking > corrugated_markup]`
- ใช้ใน : [C14]

total_price_marking (ราคารวม) :

- ค่า : 0%
- แหล่งข้อมูล : `[config: default_marking > total_price_marking]`

marking_total_price.min :

- ค่า : 0 THB
- แหล่งข้อมูล : `[config: default_marking > marking_total_price > min]`

plate_price :

- ค่า : 800 THB/สี
- แหล่งข้อมูล : `[config: default_marking > plate_price]`
- ใช้ใน : [C2]

---

#### [D2] โหมด Profit Sharing

paper_price_marking :

- ค่า : 18% (+8% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > paper > marking_price]`

afterpress_price_marking :

- ค่า : 20% (+20% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > afterpress_price_marking]`

material_price_marking :

- ค่า : 25% (+25% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > material_price_marking]`

outsouce_price_marking :

- ค่า : 25% (+25% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > outsouce_price_marking]`

packing_marking :

- ค่า : 25% (+25% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > packing_marking]`

delivery_marking :

- ค่า : 20% (+20% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > delivery_marking]`

corrugated_markup :

- ค่า : 20% (+10% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > corrugated_markup]`

total_price_marking :

- ค่า : 5% (+5% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > total_price_marking]`

marking_total_price.min :

- ค่า : 5,000 THB
- แหล่งข้อมูล : `[config: profit_sharing > marking_total_price > min]`

plate_price :

- ค่า : 1,875 THB/สี (+134% จาก Standard)
- แหล่งข้อมูล : `[config: profit_sharing > plate_price]`

print (เฉพาะ Profit Sharing) :

- print_rate : 0.14 THB/แผ่น `[config: profit_sharing > print > print_rate]`
- print_min_price : 1,400 THB `[config: profit_sharing > print > print_min_price]`
- min_paper_qty : 10,000 แผ่น `[config: profit_sharing > print > min_paper_qty]`
- ใช้ใน : [C4] แทน database rate

---

#### [D3] สูตรราคาสุดท้าย

```
subtotal = paper [C1] + corrugated [C14] + special_ink [C8] + material
         + plate [C2] + proof [C3] + print [C4]
         + coating [C5] + foilstamp [C6] + bossing [C7]
         + assembly [C9] + diecut [C10] + chip [C12] + inspection [C13] + digital_diecut [C11]
         + other_process + other_cost + handwork + custom_process
         + packing [C15] + delivery [C16]

// Markup/Markdown ที่ผู้ใช้กรอก [input]
total_after_markup = subtotal × (1 + mark_up_percent/100) × (1 - mark_down_percent/100)

// Profit sharing total markup (ถ้าเปิด → [D2])
ถ้า is_profit_sharing:
    marking_amount = total × total_price_marking/100
    ถ้า marking_amount < marking_total_price.min:
        marking_amount = marking_total_price.min
    total += marking_amount

// ภาษี
tax_amount = total × tax                                       [config: tax = 0.03 (3%)]
grand_total = total + tax_amount

// แปลงสกุลเงิน (ถ้ามี)
grand_total = grand_total × exchange_rate                      [input: exchange_rate, default = 1]
```

---

## 3. ตาราง Parameter Reference

---

### 3.1 Parameter จาก User Input `[input]`

- qty : จำนวนสินค้า → ใช้ในทุกขั้นตอน
- print_type : รูปแบบพิมพ์ (Offset/Flexo/Jet Press/Konica) → ใช้ใน [A3], [C2]-[C4]
- ink_type : ประเภทหมึก (Normal/UV) → ใช้ใน [C4] (UV ×2.5)
- component_type : ประเภท component (1/2/3) → ใช้ใน [A2], [A3], [C14]
- box_type : แม่แบบกล่อง (1-12) → ใช้ใน [A1]
- W, L, D, T, G, dust, OL : ขนาดกล่อง (mm) → ใช้ใน [A1]
- outside_colors, inside_colors : จำนวนสีนอก/ใน → ใช้ใน [C2], [C4]
- paper_code, gram : ประเภท/แกรมกระดาษ → ใช้ใน [C1]
- is_profit_sharing : โหมด profit sharing → ใช้ใน [D]
- is_reprinted, is_use_previous_plate : งาน reprint → ใช้ใน [C2]
- coating selections : เลือก coating → ใช้ใน [C5]
- foil stamp size, color : ขนาด/สีฟอยล์ → ใช้ใน [C6]
- emboss/deboss size, depth : ขนาด/ความลึก → ใช้ใน [C7]
- special_ink type, style : ประเภท/สไตล์หมึกพิเศษ → ใช้ใน [C8]
- packing selections : เลือกวิธีแพ็ค → ใช้ใน [C15]
- delivery destination : สถานที่จัดส่ง → ใช้ใน [C16]
- mark_up_percent, mark_down_percent : % markup/markdown → ใช้ใน [D3]
- tax : ภาษี (%) → ใช้ใน [D3]

---

### 3.2 Parameter จาก Config `[config: default.js]`

**Layout :**

- tolerance.bleed : 3 mm → ใช้ใน [A2]
- tolerance.gripper : 12 mm (Offset) → ใช้ใน [A2]
- tolerance.color_bar : 8 mm (Offset) → ใช้ใน [A2]
- tolerance.paper_edge : 4 mm (Offset) → ใช้ใน [A2]
- formula_value : 1,550,000 → ใช้ใน [B4]

**Plate Cost :**

- plate_price : 800 THB → ใช้ใน [C2]
- cut_1_plate_markup : 50 THB → ใช้ใน [C2]
- plate_polymer_price : 6.53 THB/sqin → ใช้ใน [C2] (Flexo)
- reprint_plate_polymer_price : 5.94 THB/sqin → ใช้ใน [C2] (Flexo reprint)
- reprintReducePlateCostPercent : 50% → ใช้ใน [C2]

**Foil / Bossing :**

- film_rate : 1.25 THB/sqin → ใช้ใน [C6], [C7]
- film_min_cost : 120 THB → ใช้ใน [C6], [C7]
- foil_width_tolerance : 0.5 inch → ใช้ใน [C6]
- foil_length_tolerance : 1 inch → ใช้ใน [C6]
- block_foilstamp_min_cost : 70 THB → ใช้ใน [C6]

**Corrugated :**

- corrugated_tolerance : 0.375 inch → ใช้ใน [C14]
- corrugated_markup : 10% (ปกติ) / 20% (PS) → ใช้ใน [C14], [D]
- corrugated_glued_cost : 0.0015 THB/sqin → ใช้ใน [C14-GLUE]
- corrugated_assembly_markup_price : 0.1 THB → ใช้ใน [C9]

**อื่นๆ :**

- coating_opp_cold_film_cost_sqin : 0.0103 THB/sqin → ใช้ใน [C5]
- delivery_rate : 1,500 THB/ton → ใช้ใน [C16]
- tax : 3% → ใช้ใน [D3]
- addon_labor_price_marking : 20% → ใช้ใน [C6], [C7] labor
- reprinted_block : 500 THB/block → ใช้ใน [C10]

---

### 3.3 Parameter จาก Database `[database]`

- tb_master_paper : ราคากระดาษ, แกรม, ความหนา → ใช้ใน [C1]
  - JSON : `CLAUDE/json/tb_master_paper.json`

- tb_master_std_paper : ขนาดกระดาษมาตรฐาน → ใช้ใน [A3], [B1]
  - JSON : `CLAUDE/json/tb_master_std_paper.json`

- machine_std_paper : mapping เครื่อง ↔ กระดาษ → ใช้ใน [A3]
  - JSON : `CLAUDE/json/machine_std_paper.json`

- tb_master_price_rate : อัตราค่าแรงตาม qty → ใช้ใน [C4], [C6], [C7], [C9], [C10], [C12], [C13] ผ่าน [E]
  - JSON : `CLAUDE/json/tb_master_price_rate.json`

- tb_master_min_price : ราคาขั้นต่ำแต่ละ process → ใช้ใน [C4], [C6], [C7], [C9], [C10], [C12], [C13] ผ่าน [E]
  - JSON : `CLAUDE/json/tb_master_min_price.json`

- tb_master_waste : อัตรา waste ตาม qty → ใช้ใน [B3]
  - JSON : `CLAUDE/json/tb_master_waste.json`

- tb_master_jetpress_waste : waste เฉพาะ Jet Press → ใช้ใน [B3]
  - JSON : `CLAUDE/json/tb_master_jetpress_waste.json`

- tb_master_konica_waste : waste เฉพาะ Konica → ใช้ใน [B3]
  - JSON : `CLAUDE/json/tb_master_konica_waste.json`

- tb_master_coating : ราคา/ข้อมูล coating → ใช้ใน [C5]
  - JSON : `CLAUDE/json/tb_master_coating.json`

- tb_master_foilstamp : ข้อมูลม้วนฟอยล์ → ใช้ใน [C6]
  - JSON : `CLAUDE/json/tb_master_foilstamp.json`

- tb_master_blockstamp : ราคาบล็อคปั๊ม (foil / emboss / deboss) → ใช้ใน [C6], [C7]
  - JSON : `CLAUDE/json/tb_master_blockstamp.json`

- tb_master_blockdiecut : ราคาบล็อคไดคัท → ใช้ใน [C10]
  - JSON : `CLAUDE/json/tb_master_blockdiecut.json`

- tb_master_corrugated_board : ราคาลูกฟูก → ใช้ใน [C14]
  - JSON : `CLAUDE/json/tb_master_corrugated_board.json`

- tb_master_special_ink : ราคาหมึกพิเศษ → ใช้ใน [C8]
  - JSON : `CLAUDE/json/tb_master_special_ink.json`

- tb_master_jetpress_info : ข้อมูลเครื่อง Jet Press → ใช้ใน [C4]
  - JSON : `CLAUDE/json/tb_master_jetpress_info.json`

---

## [E] ฟังก์ชัน setPriceRate — ระบบ Rate & Min Price

> Source: `setPriceRate()` — บรรทัด 1048-1137

ฟังก์ชันนี้ใช้ lookup ราคาจาก database ตาม qty range :

```
// หา rate จาก tb_master_price_rate ที่ qty อยู่ใน range
price_rate = db.price_info.find(min_qty ≤ qty ≤ max_qty)[type]

// หา min_price จาก tb_master_min_price
min_price = db.min_price_info.find(min_qty ≤ qty ≤ max_qty)[type]

// ถ้า qty × unit_price < min_price → ใช้ min_price
return { unit_price: price_rate, min_price: min_price }
```

**Types ที่รองรับ :**

- print_1col, print_3col, print_5col → ใช้ใน [C4] Offset
- print_flexo → ใช้ใน [C4] Flexo
- trim → ใช้ใน afterpress
- diecut → ใช้ใน [C10]
- foilstamp → ใช้ใน [C6]
- bossing → ใช้ใน [C7]
- chip → ใช้ใน [C12]
- inspection → ใช้ใน [C13]
- assembly_S, assembly_M, assembly_L → ใช้ใน [C9]

---

## [F] หมายเหตุสำคัญ

1. **Multi-F Jobs :** งานหลาย F code จะคำนวณ qty, waste, ราคาแยกตาม F code แต่ใช้ layout เดียวกัน
2. **Konica ไม่ปัดขึ้น 100 :** paper_net = paper_qty → ดู [B4]
3. **UV Ink × 2.5 :** หมึก UV ค่าพิมพ์เพิ่ม 2.5 เท่า (เฉพาะ Offset) → ดู [C4]
4. **Assembly Factor :** จำนวนจุดกาว → ดู [C9-FACTOR]
5. **OPP Window Coating :** ถ้ามี → die-cut block ×2, labor ×2 → ดู [C10-OPP]
6. **Profit Sharing Print :** ใช้ rate 0.14 THB/แผ่น (min 1,400 THB) แทน database rate → ดู [D2]
