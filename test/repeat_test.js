const axios = require('axios')

const BASE = 'http://localhost:3099'
const RUNS = 5

const SPEC = `GEFEN ขอใบเสนอราคา SLEEVE BOX 3/211x109E
SIZE 20.20x6.60x3.90CM
DUPLEX 350 G
WATER BASE
4 COLORS
ไดคัท ติดกาว
จำนวน 5,000 ใบ / 10,000 ใบ`

function extract(data) {
    const d = data?.data || {}
    const c = d.components?.[0] || {}
    return {
        job_name:        d.job_name,
        customer_name:   d.customer_name,
        print_type:      d.print_type,
        quantities:      JSON.stringify(d.quantities),
        box_template_id: c.box_template_id,
        paper_type:      c.paper_type,
        paper_gram:      c.paper_gram,
        color_outside:   c.color_outside,
        coating:         JSON.stringify(c.coating),
        width:           c.dimensions_mm?.width,
        length:          c.dimensions_mm?.length,
        height:          c.dimensions_mm?.height,
    }
}

async function testTemp(headers, temp) {
    console.log(`\n${'='.repeat(50)}`)
    console.log(`  temperature = ${temp}  (${RUNS} runs)`)
    console.log('='.repeat(50))

    const rows = []
    for (let i = 1; i <= RUNS; i++) {
        const { data } = await axios.post(
            `${BASE}/ai/parse-spec`,
            { text: SPEC, _temperature: temp },
            { headers }
        )
        const fields = extract(data)
        rows.push(fields)
        console.log(`ครั้งที่ ${i}:`, Object.entries(fields).map(([k,v]) => `${k}=${v}`).join(' | '))
    }

    console.log('\n--- สรุป ---')
    for (const k of Object.keys(rows[0])) {
        const vals = rows.map(r => String(r[k]))
        const allSame = vals.every(v => v === vals[0])
        if (!allSame) console.log(`❌ ${k.padEnd(16)} ต่างกัน: ${[...new Set(vals)].join(' | ')}`)
        else console.log(`✅ ${k.padEnd(16)} = ${vals[0]}`)
    }
}

async function run() {
    const loginRes = await axios.post(`${BASE}/user/login`, { username: 'Admin', password: 'Admin1234' })
    const { accessToken } = loginRes.data
    if (!accessToken) { console.error('Login failed'); return }
    const emp_id = loginRes.data?.data?.[0]?.emp_id || 'Admin'
    const headers = { Cookie: `accessToken=${accessToken}; emp_id=${emp_id}` }

    await testTemp(headers, 0)
    await testTemp(headers, 1)
}

run()
