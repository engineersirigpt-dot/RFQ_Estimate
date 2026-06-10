/**
 * batch_test.js — รัน test cases ทั้งหมดผ่าน AI endpoint แล้ว save ผล
 * Usage: node test/batch_test.js
 * ต้องมี server รันอยู่ที่ localhost:3099 ก่อน
 */

const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:3099'
const COOKIE = 'accessToken=test.local; emp_id=Admin' // mock auth cookie

// ===== TEST CASES (ถอดจาก test table) =====
const TEST_CASES = [
  {
    id: 1,
    label: 'Trimmine/USA – B-Flute Tray, Offset 1-3 สี',
    input: `Log no: TB26/148
CUSTOMER/BRAND: Trimmine
DESTINATION: USA
PROJECT NAME: Tri marine Shrine P5
CAN SIZE: 307x105.5 EOE
บรรจุกี่ชิ้น/กล่อง(ลัง) / Case: 5 Cans/Shrink, 8 Shrink/Carton
บรรจุกล่องลังแบบ: Tray (ถาด)
Dimension: Score line
W(mm): 175
L(mm): 350
M(mm): 76
MATERIAL: B-Flute
MATERIAL GRADE: KS170CA125/K125-B
Print process: Offset
COLOR QTY: 1-3
Component: 1`
  },
  {
    id: 2,
    label: 'KIBU – B-Flute FSC, Varnishing',
    input: `E20220706
CUSTOMER: KIBU
DESTINATION: USA / Thailand
CAN SIZE: 307 x 108 EOE
NET WEIGHT: 85ml 160g
บรรจุ: 24 Cans/Trays+Cover
W(mm): 258
L(mm): 340
MATERIAL: B-Flute
MATERIAL GRADE: DP250CA125-B (FSC)
COLOR QTY: 3-5
COATING: Varnishing`
  },
  {
    id: 3,
    label: 'MPM Top Dog – Inner box, E-Flute, Waterbase + Gloss Varnish',
    input: `Log no: TS25/052
CUSTOMER/BRAND: MPM
DESTINATION: USA
PROJECT NAME: Top Dog
NET WEIGHT: 85g
CAN SIZE: 95 x 140 + 28
บรรจุ: 6 Pouches/Inner, 4 Inner/Shrink
บรรจุกล่อง: Inner box
Dimension: Score line
W(mm): 95
L(mm): 112
MATERIAL: E-Flute
MATERIAL GRADE: DP250CA105/CA125-B (PAP 20)
COLOR QTY: 1-8
COATING: Waterbase, Gloss Varnish`
  },
  {
    id: 4,
    label: 'P.O.CARE Oil Control Sachet – Offset, Gloss Waterbase Hi-Rub',
    input: `E26090175
P.O.CARE PUREPERFECT OIL CONTROL SUNSCREEN SPF30+PA+++ 8 ML (Sachet) Pack 5
Size: 315.5 x 298.5 mm
Paper: กระดาษ 350 gram
Print: Ryo 70 & Gloss Waterbase Hi-Rub 1/s
Binding: ไม่มี + ลวด + ติดกาว
QTY: 3000, 5000, 10000, 20000, 50000`
  },
  {
    id: 5,
    label: 'Display Box – ประกบลูกฟูก E, Offset, Waterbase, 4/6 สี',
    input: `E26220706
Display Box 9x255 E Brand
Spec: กระดาษ 310 gram ทำบนลูกฟูก E (CA125/CA125-E) พิมพ์ offset
Coat: water base
Color: 4, 6
QTY: 1000, 2000, 3000, 4000, 5000, 7000, 10000`
  },
  {
    id: 6,
    label: 'ART CARD 270GSM 1/S – 4 สี + ดำ, qty 5000-20000',
    input: `E26020628
5000, 10000, 15000, 20000
แผ่น ART CARD 270 GSM 1/S
มีสี: 1 สี + ดำ + พิเศษ 3 อย่าง
Coating: 1 s ล่าง`
  },
  {
    id: 7,
    label: 'เฉพาะลูกฟูก 400g – Gloss Waterbase, qty 20000-100000',
    input: `E26030773
กระดาษ 350 x 362 mm
กระดาษ 400 gram (เฉพาะลูกฟูก)
Gloss 4/0, Gloss Waterbase 1/S
ปริมาณ: 20,000 / 50,000 / 100,000`
  },
  {
    id: 8,
    label: 'หลาย F-code – foil หลาย spec, qty 394400',
    input: `E26030013
Size: 424 x 425 x 72 mm (inner), 133 x 260 mm (other)
PAPER: 310 gram + 4.8 gram
Foil F017726 w=36,400
F018021 w=25,000
F018020 w=25,000
F018019 w=25,000
F017964 w=28,000
F017965 w=28,000
Total QTY: 394,400`
  },
  {
    id: 9,
    label: 'ลูกฟูก CA125/CA125 B-flute 2 ชั้น – 180x280x260mm',
    input: `E26040347
กระดาษ 270 gram ประกบลูกฟูก B 2 ชั้น
(CA125/CA125)
ขนาด 180x280x260mm
6 Qty per carton
โดยประมาณ 1 ชั้น
3k, 5k, 8k, 10k`
  },
  {
    id: 10,
    label: 'Inner S.R.P. Jelly – DP350/DP400, sheet W360xL434mm, Waterbase',
    input: `E26040011
Inner S.R.P. Jelly 12P-Becover
Spec: DP 350 / DP 400 (40gsm)
sheet size: W 360 x L 434 mm
Printing: color + waterbase
MQQ: 5,000 / 5,000 / 10,000 / 50,000 pc`
  },
  {
    id: 11,
    label: '300 gram, 2/0 สี, Spot UV, qty 10000-30000',
    input: `E26050169
กระดาษ 300 gram
สี 2/0
Coating: Spot UV
ปริมาณ: 10000, 20000, 30000`
  },
  {
    id: 12,
    label: 'Liquid Snack Tuck Box – Duplex 450gsm, OPP Window, 6-7 สี, Waterbase',
    input: `E26050144
Liquid Snack 140X12
Style: Tuck Box, Staple free with Plastic Window
Material: Duplex 450gsm
Dimension (D): W30 x L95 x H178 mm (window W64 x H30 mm)
Printing: 6-7 Colors / Gloss waterbase
QTY: 1,000 5,000 7,000 10,000`
  },
  {
    id: 13,
    label: 'ประกบลูกฟูก E 2 ชั้น CA125/K125 – 385x230x160mm',
    input: `E26050018
3K, 4K, 5K, 6K, 7K, 10K
ขนาด 385 mm x 230 mm x 160 mm
ลูกฟูก 300 gram ประกบ E 2 ชั้น
CA125/K125
Size 0/0
1 ชั้น`
  },
  {
    id: 14,
    label: 'Eye Cream กล่องเล็ก – 350g, OPP 4 ส่วน, CMYK, qty 1000-5000',
    input: `E26050007
OIL/FOAM ANTI-WRINKLE FIRMING EYE CREAM
size: 28 x 124 mm (128 x 124 mm)
กระดาษ 350 gram
สี 3.8 CMYK 4 สี
Coating: OPP 4 ส่วน (4 sides)
ปริมาณ: 1000, 2000, 3000, 4000, 5000`
  },
  {
    id: 15,
    label: 'หลายโมเดล 7 แบบ – 250x250mm, 4/4 + OPP 2 ด้าน',
    input: `E26040652
ขนาดกระดาษ 250 x 250 mm
ประกอบ 120 x 125 mm
สี 4/4, Coating OPP 2 ด้าน + spot UV ไม่มีทา 1 ด้าน
รายการ:
1. Wallet (Default) 2,000
2. Sticker 500
3. Casa Lapin 500
4. Suki Teanol 1,000
5. Jaymart Insurance 500
6. LAS Asset 100
7. SINGER 100
8. SG Controll 100`
  },
  {
    id: 16,
    label: '332x361.5mm – Gloss OPP Window 1/s + Water Proof 1/s',
    input: `E26040575
ขนาด 332 x 361.5 mm (กระดาษ), 50 mm x 230 mm x 105 mm (กล่อง)
Coating: Gloss OPP Window 1/s, Water Proof 1/s`
  },
  {
    id: 17,
    label: 'E30885 Berceges F018270 – 5 สี + Gloss Water Base, qty 5000-60000',
    input: `E26040530
E30885 Berceges - F018270
ขนาด (inside): 17 x 72 x 110 mm
สี 5 (C, M, Y, K, DIC-444) + Gloss Water Base
QTY: 5,000 / 10,000 / 20,000 / 25,000 / 30,000 / 35,000 / 60,000`
  },
  {
    id: 18,
    label: '400 gram, 55x64.5cm – UV 1 ด้าน, qty 120/24000',
    input: `E26040504
กระดาษ 400 gram
ขนาด 55.0 x 64.5 cm
สี 4/0 + 1 สาย PVC
กล่อง 53.5 x 64 cm
UV 1 ด้าน
ปริมาณ: 12,000 / 24,000`
  },
  {
    id: 19,
    label: '[PASS] A/C C2s 300gsm – 500x503x150mm, qty 3000-30000',
    input: `S-AC/C2s 300
กระดาษ A/C C2s 300gsm
ขนาด 500x503x150mm
3000 4000 5000 8000 10000 20000 30000`
  },
  {
    id: 20,
    label: 'ลูกฟูก 300gram + UV – qty 20000/50000',
    input: `E28030829
กระดาษลูกฟูก 300 gram
สี + UV
Coating: Gloss
ปริมาณ: 20000 / 50000`
  },

  // ===== SYNTHETIC CASES (AI-generated edge cases) =====

  {
    id: 21,
    label: '[REPRINT] Rep. ใช้ Plate เก่า – A/C C1s, 4/0, Gloss OPP',
    input: `Rep. E25041122
CUSTOMER: บริษัท ยูนิซัน จำกัด
กล่อง A/C C1s 300 gsm
ขนาด W80 x L200 x H30 mm
สี 4/0
เคลือบ Gloss OPP 1 ด้าน
ใช้ Plate เดิม (Reprint — plate ชุดเก่า ไม่ต้องทำใหม่)
จำนวน: 5,000 / 10,000 / 20,000`
  },
  {
    id: 22,
    label: '[KONICA] Digital พิมพ์ Konica – A/C 250g, 4/4, Matt OPP, qty น้อย',
    input: `E26120222
พิมพ์ด้วยเครื่อง Konica Minolta
กระดาษ Art Card 250 gsm
ขนาด 100 x 150 x 50 mm
พิมพ์ 4/4 CMYK
เคลือบ Matt OPP 1 ด้าน
จำนวน: 100 / 200 / 500`
  },
  {
    id: 23,
    label: '[JET PRESS] HP Indigo / Jet Press – Ivory 350g, 4C, Waterbase',
    input: `E26120333
ลูกค้า: Fancy Brand Co., Ltd.
พิมพ์ Jet Press (HP Indigo)
Ivory 350 gsm
ขนาด 60 x 200 x 60 mm
สี 4 Colors (CMYK)
Gloss Waterbase 1 s
จำนวน: 500 / 1,000 / 2,000`
  },
  {
    id: 24,
    label: '[UV INK] กระดาษ A/C 300g, UV Ink 4/0, Gloss UV coating',
    input: `E26120444
CUSTOMER: Pharma Pack Ltd.
กระดาษ A/C 300 gsm
ขนาด 120 x 80 x 40 mm
พิมพ์ UV Ink 4/0
เคลือบ Full UV (UV coating) 1 ด้าน
จำนวน: 10,000 / 20,000 / 50,000`
  },
  {
    id: 25,
    label: '[FOIL+EMBOSS] A/C C2s 350g, 4/0, Spot UV + Foil ทอง + Emboss',
    input: `E26120555
CUSTOMER: Luxury Cosmetics Co.
กระดาษ A/C C2s 350 gsm
ขนาด W70 x L200 x H70 mm
สี 4/0
เคลือบ Spot UV 1 ด้าน
Foil Stamp สีทอง ขนาด 2 x 1 นิ้ว
Emboss ขนาด 1.5 x 0.5 นิ้ว ลึก 1.25 mm
จำนวน: 5,000 / 10,000 / 30,000`
  },
  {
    id: 26,
    label: '[MULTI-DELIVERY] ส่ง 2 จังหวัด – สมุทรปราการ + ชลบุรี',
    input: `E26120666
CUSTOMER: XYZ Food Co., Ltd.
A/C C1s 300 gsm
ขนาด 200 x 150 x 100 mm
สี 4/0
Gloss Waterbase 1 ด้าน
ส่งงานสมุทรปราการ 1 จุด
ส่งงานชลบุรี 1 จุด
จำนวน: 20,000 / 50,000`
  },
  {
    id: 27,
    label: '[FLEXO] Flexo พิมพ์ลูกฟูก – KS/CA125/K125 B-flute, 2/0, Waterbase',
    input: `E26120777
CUSTOMER: Agri Export Co.
พิมพ์ Flexo 2 สี
กระดาษลูกฟูก KS170/CA125/K125 B-flute (single-wall)
ขนาดกล่อง 300 x 200 x 150 mm
เคลือบ Waterbase 1 ด้าน
จำนวน: 10,000 / 20,000 / 50,000`
  },
  {
    id: 28,
    label: '[SLEEVE] ปลอกกล่อง – A/C C2s 300g, 4/0, Scuff Free OPP',
    input: `E26120888
CUSTOMER: Beauty Brand
ปลอกกล่อง (Sleeve)
A/C C2s 300 gsm
Open size: W=200 mm x L=500 mm
สี 4/0
เคลือบ Scuff Free OPP 1 ด้าน
จำนวน: 5,000 / 10,000 / 20,000`
  },
  {
    id: 29,
    label: '[AUTO-BOTTOM] กล่องก้นล็อก – A/C 350g, 4/0, Soft Touch + Spot UV',
    input: `E26120999
CUSTOMER: Premium Gift Box Co.
กล่องก้นล็อก (Auto-bottom / ก้นล็อก)
A/C 350 gsm
ขนาด W100 x L100 x H150 mm
สี 4/0
เคลือบ Soft Touch OPP 1 ด้าน
Spot UV ด้านนอก
จำนวน: 10,000 / 20,000 / 50,000`
  },
  {
    id: 30,
    label: '[BASELINE] กล่องธรรมดา – A/C 300g, 4/0, Gloss WB, ส่งนครปฐม',
    input: `E26130000
CUSTOMER: Uni-President (Thailand) Co., Ltd.
กล่อง A/C 300 gsm
ขนาด W100 x L200 x H80 mm
สี 4/0
Gloss Waterbase 1 ด้าน
ส่งงานนครปฐม 1 จุด
จำนวน: 10,000 / 20,000 / 50,000`
  }
]

// ===== HTTP helper =====
function postJSON(url, body, cookie) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const u = new URL(url)
    const lib = u.protocol === 'https:' ? https : http
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Cookie': cookie
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }) }
        catch { resolve({ status: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.setTimeout(60000, () => { req.destroy(new Error('timeout')) })
    req.write(payload)
    req.end()
  })
}

// ===== Main =====
async function run() {
  const outPath = path.join(__dirname, 'results.json')
  const results = []

  console.log(`\n===== AI Batch Test — ${TEST_CASES.length} cases =====\n`)

  for (const tc of TEST_CASES) {
    process.stdout.write(`[${tc.id.toString().padStart(2)}] ${tc.label} ... `)
    const start = Date.now()
    try {
      const resp = await postJSON(
        `${BASE_URL}/ai/parse-spec`,
        { text: tc.input },
        COOKIE
      )
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's'
      if (resp.status === 200 && resp.body) {
        console.log(`OK (${elapsed})`)
        results.push({ id: tc.id, label: tc.label, status: 'ok', elapsed, result: resp.body })
      } else {
        console.log(`HTTP ${resp.status} (${elapsed})`)
        results.push({ id: tc.id, label: tc.label, status: 'error', elapsed, error: resp.body })
      }
    } catch (e) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1) + 's'
      console.log(`ERROR: ${e.message} (${elapsed})`)
      results.push({ id: tc.id, label: tc.label, status: 'error', elapsed, error: e.message })
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf8')
  console.log(`\n===== Done — results saved to test/results.json =====\n`)

  // print quick summary
  const ok = results.filter(r => r.status === 'ok').length
  console.log(`OK: ${ok}/${results.length}`)
}

run().catch(console.error)
