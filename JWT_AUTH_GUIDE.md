# JWT Authentication Implementation Guide

## สรุปการทำงาน

ระบบ JWT Authentication ประกอบด้วย 3 ส่วนหลัก:

### 1. Backend Middleware (auth.js)

- ตรวจสอบ `accessToken` จาก cookie ทุกครั้งที่มีการเรียก route ที่มี `checkAuth`
- ส่ง `Authorization: Bearer <token>` header ไปยัง API `/user/check-auth`
- ถ้า token หมดอายุ (401) จะพยายาม refresh token อัตโนมัติ
- เรียก API `POST /user/token` พร้อม `refreshToken` เพื่อขอ token ใหม่
- อัปเดต cookie ด้วย token ใหม่และ retry request
- หาก refresh ไม่สำเร็จจะ redirect ไป `/logout`

### 2. Frontend Login Flow (function_index.js)

```javascript
// หลัง login สำเร็จ backend จะส่ง
{
  isPassed: 1,
  accessToken: "eyJhbGc...",
  refreshToken: "eyJhbGc...",
  roles: [...],
  data: [...]
}

// Frontend จะ:
1. เก็บ accessToken และ refreshToken ใน localStorage
2. เรียก POST /set-cookie เพื่อเซ็ต httpOnly cookies
3. Redirect ไปหน้าแรก (/) ซึ่ง middleware จะตรวจสอบ
```

### 3. Client-side Token Management (auth-interceptor.js)

- **Request Interceptor**: แนบ `Authorization` header ให้ทุก AJAX request อัตโนมัติ
- **Response Interceptor**: จับ error 401 และพยายาม refresh token
- ป้องกัน race condition (หลาย request พยายาม refresh พร้อมกัน)
- หาก refresh สำเร็จจะ retry request เดิมด้วย token ใหม่

## การใช้งาน

### Backend Routes

```javascript
// Public routes (ไม่ต้องใช้ checkAuth)
app.get('/login', ...)
app.get('/logout', ...)
app.post('/set-cookie', ...)

// Protected routes (ต้องผ่าน checkAuth)
app.get('/', checkAuth, ...)
app.get('/estimate', checkAuth, ...)
app.get('/quote', checkAuth, ...)
```

### Frontend AJAX Calls

```javascript
// ไม่ต้องแนบ token เอง - interceptor จะทำให้อัตโนมัติ
$.ajax({
    url: `${node_api}/estimate/list`,
    type: 'POST',
    data: JSON.stringify({...}),
    contentType: 'application/json',
    // interceptor จะเพิ่ม Authorization header
    success: function(res) { ... },
    error: function(xhr) {
        // หาก 401 interceptor จะ refresh และ retry
        // หาก refresh ไม่สำเร็จจะ redirect ไป /logout
    }
});
```

## Token Lifecycle

```
1. User Login
   └─> Backend สร้าง JWT (accessToken 15 min, refreshToken 7 days)
   └─> Frontend เก็บใน localStorage + cookie

2. User เข้า Protected Route
   └─> Middleware ตรวจ accessToken จาก cookie
   └─> ส่ง Authorization header ไปยัง /user/check-auth
   └─> ถ้า valid ให้ render หน้า
   └─> ถ้า 401:
       └─> ลอง refresh token
       └─> ถ้าสำเร็จ: อัปเดต cookie และ continue
       └─> ถ้าไม่สำเร็จ: redirect /logout

3. Frontend AJAX Request
   └─> Interceptor แนบ Authorization header
   └─> ถ้าได้ 401:
       └─> ลอง refresh (POST /user/token)
       └─> อัปเดต localStorage + cookie
       └─> Retry request เดิม
       └─> ถ้า refresh ไม่สำเร็จ: redirect /logout

4. Token หมดอายุ
   └─> accessToken หมดอายุหลัง 15 นาที
   └─> refreshToken หมดอายุหลัง 7 วัน
   └─> ถ้าทั้งสองหมดอายุ: ต้อง login ใหม่
```

## API Endpoints ที่ Backend ต้องมี

### 1. POST /user/login

```json
Request:
{
  "username": "user@example.com",
  "password": "password123",
  "estimate_type": "packaging"
}

Response:
{
  "isPassed": 1,
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "roles": [...],
  "data": [{ "emp_id": "E001", "emp_name": "John" }]
}
```

### 2. GET /user/check-auth?emp_id=E001

```
Headers: Authorization: Bearer eyJhbGc...

Response (valid):
{
  "valid": true,
  "expires_at": 1699999999999
}

Response (invalid):
Status: 401 Unauthorized
หรือ
{
  "valid": false
}
```

### 3. POST /user/token

```json
Request:
{
  "refreshToken": "eyJhbGc..."
}

Response (success):
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."  // optional - ถ้าต้องการ rotate refresh token
}

Response (expired/invalid):
Status: 401 Unauthorized
```

## Security Best Practices

1. **httpOnly Cookies**: ป้องกัน XSS attacks
2. **Short-lived Access Token**: ลดความเสี่ยงถ้า token รั่วไหล (15 นาที)
3. **Long-lived Refresh Token**: ลด UX friction (7 วัน)
4. **Token Rotation**: พิจารณา rotate refresh token ทุกครั้งที่ refresh
5. **HTTPS Only**: ใช้ `secure: true` flag สำหรับ production
6. **SameSite Cookie**: เพิ่ม `sameSite: 'strict'` เพื่อป้องกัน CSRF

## Troubleshooting

### ปัญหา: redirect loop /logout

- ตรวจสอบว่า `/logout` อยู่ใน `publicPaths`
- ตรวจสอบว่า cookie ถูกเซ็ตสำเร็จหลัง login

### ปัญหา: token ไม่ถูกส่ง

- ตรวจสอบว่า `cookieParser()` ถูกเรียกก่อน routes
- ตรวจสอบว่า axios interceptor ถูก load ก่อน AJAX calls

### ปัญหา: refresh token ไม่ทำงาน

- ตรวจสอบ response format จาก `POST /user/token`
- ตรวจสอบว่า refreshToken ถูกเก็บใน localStorage และ cookie

## Files Modified/Created

1. **c:\Users\User\Documents\GitHub\Estimate_Packaging\index.js**

   - เพิ่ม `/set-cookie` route รับ accessToken + refreshToken
   - เพิ่ม clearCookie สำหรับ tokens ที่ `/logout`

2. **c:\Users\User\Documents\GitHub\Estimate_Packaging\public\js\includes\auth.js**

   - เพิ่มการส่ง Authorization header
   - เพิ่มระบบ refresh token อัตโนมัติ
   - เพิ่มการตรวจสอบ token expiry

3. **c:\Users\User\Documents\GitHub\Estimate_Packaging\public\js\auth-interceptor.js** (NEW)

   - Axios interceptor สำหรับ client-side
   - จัดการ token หมดอายุและ refresh อัตโนมัติ

4. **c:\Users\User\Documents\GitHub\Estimate_Packaging\public\js\function_index.js**

   - แก้ไข login() เพื่อรับและเก็บ tokens
   - เรียก `/set-cookie` หลัง login
   - แก้ไข logout() ให้ clear tokens

5. **c:\Users\User\Documents\GitHub\Estimate_Packaging\public\header.ejs**
   - เพิ่ม axios CDN
   - เพิ่ม auth-interceptor.js script
