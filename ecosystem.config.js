// pm2 config — รัน frontend + test-backend ค้างตลอด (auto-restart + start on boot)
// ใช้:  pm2 start ecosystem.config.js  แล้ว  pm2 save  แล้ว  pm2 startup
//
// หมายเหตุ: frontend ตั้งใจไม่เซ็ต NODE_ENV=production
//   เพราะ config module จะไปโหลด production.json (ที่ node_api ชี้ prod 192.168.5.3)
//   ต้องให้ใช้ default.json (ที่ node_api ชี้ test 192.168.5.32:4010) → ปล่อย NODE_ENV ว่างไว้
module.exports = {
  apps: [
    {
      name: 'estimate-frontend',
      script: './index.js',
      cwd: '/home/webadmin/Estimate-Packaging',
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'estimate-test-backend',
      script: './src/server.js',
      cwd: '/home/webadmin/Estimate-Packaging/test-backend',
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
}
