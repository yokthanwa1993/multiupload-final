# การตั้งค่า Google OAuth สำหรับ YouTube API

## ขั้นตอนการตั้งค่า

### 1. สร้าง Google Cloud Project

1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจคใหม่หรือเลือกโปรเจคที่มีอยู่
3. เปิดใช้งาน YouTube Data API v3:
   - ไปที่ "APIs & Services" > "Library"
   - ค้นหา "YouTube Data API v3"
   - คลิก "Enable"

### 2. สร้าง OAuth 2.0 Credentials

1. ไปที่ "APIs & Services" > "Credentials"
2. คลิก "Create Credentials" > "OAuth 2.0 Client IDs"
3. เลือก Application type: "Web application"
4. ตั้งชื่อ: "AI Video Uploader"
5. เพิ่ม Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/youtube/callback
   ```
6. คลิก "Create"
7. คัดลอก Client ID และ Client Secret

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env.local` ในโฟลเดอร์ root ของโปรเจค:

```bash
# Google OAuth Configuration for YouTube API
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/youtube/callback

# Next.js Configuration
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Facebook API Configuration (for future use)
FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
```

### 4. รีสตาร์ท Development Server

```bash
npm run dev
```

## การทดสอบ

1. เปิด http://localhost:3000
2. คลิก "เชื่อมต่อกับ YouTube"
3. ระบบจะพาคุณไปหน้า Google OAuth
4. ให้สิทธิ์เข้าถึง YouTube
5. ระบบจะพากลับมาหน้าหลักพร้อมสถานะเชื่อมต่อ

## หมายเหตุ

- ในระหว่างการพัฒนา YouTube API อาจต้องการการยืนยันจาก Google
- สำหรับการใช้งานจริง ต้องผ่านกระบวนการ OAuth verification
- ตรวจสอบให้แน่ใจว่า redirect URI ตรงกันทั้งใน Google Console และ environment variables

## การแก้ไขปัญหา

### Error: redirect_uri_mismatch
- ตรวจสอบ GOOGLE_REDIRECT_URI ใน .env.local
- ตรวจสอบ Authorized redirect URIs ใน Google Console

### Error: invalid_client
- ตรวจสอบ GOOGLE_CLIENT_ID และ GOOGLE_CLIENT_SECRET

### Error: access_denied
- ผู้ใช้ปฏิเสธการให้สิทธิ์
- ลองเชื่อมต่อใหม่อีกครั้ง 