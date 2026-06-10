require('dotenv').config()
const prisma = require('./db')

async function main() {
  // user เทส (จาก .env)
  const username = process.env.TEST_USER_USERNAME || '2690006'
  const user = await prisma.user.upsert({
    where: { username },
    update: {},
    create: {
      empId: username,
      empName: process.env.TEST_USER_EMPNAME || 'Test User',
      username,
      password: process.env.TEST_USER_PASSWORD || 'golfthefa9',
      roles: [
        { user_group_id: 1, sale_group_id: null, enable_price_check: 1, is_super_admin: 0, authorized: 1 },
      ],
    },
  })
  console.log('✓ seeded user:', user.username)

  // สถานะเอกสาร (เผื่อใช้)
  const statuses = [
    { statusId: 1, statusName: 'Draft' },
    { statusId: 2, statusName: 'Pending' },
    { statusId: 3, statusName: 'Approved' },
    { statusId: 4, statusName: 'Rejected' },
  ]
  for (const s of statuses) {
    await prisma.status.upsert({ where: { statusId: s.statusId }, update: {}, create: s })
  }
  console.log('✓ seeded statuses:', statuses.length)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1) })
