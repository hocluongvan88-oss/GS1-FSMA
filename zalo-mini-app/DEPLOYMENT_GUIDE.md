# Hướng dẫn Deploy Zalo Mini App

## Mục lục
1. [Yêu cầu](#yêu-cầu)
2. [Chuẩn bị](#chuẩn-bị)
3. [Build & Deploy](#build--deploy)
4. [Kiểm tra](#kiểm-tra)
5. [Troubleshooting](#troubleshooting)

---

## Yêu cầu

### 1. Tài khoản Zalo Developer
- Đăng ký tại: https://developers.zalo.me
- Đăng nhập với tài khoản Zalo

### 2. Tạo Zalo Mini App
- Truy cập Zalo Mini App Console: https://mini.zalo.me
- Tạo app mới hoặc sử dụng app đã có
- Lấy **App ID** từ dashboard

### 3. Công cụ cần thiết
```bash
# Cài đặt Node.js (v16 hoặc cao hơn)
node --version

# Cài đặt Zalo Mini App CLI
npm install -g zmp-cli

# Kiểm tra
zmp --version
```

---

## Chuẩn bị

### Bước 1: Cấu hình App ID
Mở file `/zalo-mini-app/app-config.json` và cập nhật:

```json
{
  "app": {
    "appId": "YOUR_ACTUAL_ZALO_APP_ID",
    "appName": "Truy xuất nguồn gốc",
    "version": "1.0.0"
  }
}
```

**Lưu ý:** Thay `YOUR_ACTUAL_ZALO_APP_ID` bằng App ID thực tế từ Zalo Mini App Console.

### Bước 2: Cấu hình API Backend
Mở file `/zalo-mini-app/.env.local` và thêm:

```env
# Next.js API URL (production)
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app

# Supabase (nếu cần)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### Bước 3: Cấu hình Permissions
Kiểm tra file `app-config.json` đã có đủ quyền:

```json
{
  "permission": {
    "scope.userInfo": "Lấy thông tin người dùng",
    "scope.camera": "Truy cập camera để chụp ảnh sản phẩm",
    "scope.record": "Ghi âm giọng nói để nhập liệu"
  }
}
```

---

## Build & Deploy

### Bước 1: Build Production
```bash
cd zalo-mini-app

# Cài dependencies
npm install

# Build production
npm run build
```

Kết quả: Thư mục `dist/` chứa app đã build.

### Bước 2: Deploy lên Zalo
```bash
# Login vào Zalo Developer (chỉ cần 1 lần)
zmp login

# Deploy app
npm run deploy
```

Hoặc:

```bash
zmp deploy
```

### Bước 3: Chọn phiên bản deploy
CLI sẽ hỏi:
- **Development**: Test nội bộ, chỉ developer thấy
- **Production**: Người dùng thực thấy (cần review)

Chọn **Development** để test trước.

### Bước 4: Xác nhận thông tin
```
✓ App ID: 1234567890
✓ Version: 1.0.0
✓ Build size: 2.5 MB
? Deploy to Development? (Y/n)
```

Nhấn `Y` để confirm.

---

## Kiểm tra

### 1. Test trên Zalo DevTools
Sau khi deploy Development:

1. Tải **Zalo DevTools**: https://mini.zalo.me/devtools
2. Mở DevTools > Tab "Debugger"
3. Quét QR code hoặc nhập App ID
4. App sẽ mở trong simulator

### 2. Test trên điện thoại thật
**Thêm Test User:**
1. Vào Zalo Mini App Console
2. Settings > Test Users
3. Thêm số điện thoại Zalo của bạn
4. Bạn sẽ thấy app trong Zalo > Mini Apps

**Mở app:**
- Zalo > Khám phá > Mini Apps > Tìm tên app
- Hoặc dùng Deep Link: `https://zalo.me/s/{app_id}`

### 3. Kiểm tra chức năng
- ✅ Voice input: Ghi âm và xử lý voice
- ✅ Camera: Chụp ảnh và phân tích
- ✅ API calls: Kiểm tra console logs
- ✅ Database: Xem events trong admin panel

---

## Deploy Production

### Bước 1: Review & Test kỹ
- Test đầy đủ trên Development
- Kiểm tra tất cả features hoạt động
- Fix bugs nếu có

### Bước 2: Submit for Review
```bash
# Deploy production
zmp deploy --env production
```

### Bước 3: Zalo Review Process
1. Zalo team sẽ review app (2-7 ngày)
2. Kiểm tra:
   - Content phù hợp
   - Privacy policy
   - Permissions hợp lý
   - Không vi phạm chính sách

3. Kết quả:
   - **Approved**: App được publish
   - **Rejected**: Fix theo feedback và submit lại

### Bước 4: Publish
Sau khi approved, click "Publish" trong console.

---

## Cập nhật Version mới

### 1. Update version
Mở `app-config.json`:
```json
{
  "app": {
    "version": "1.1.0"  // Tăng version
  }
}
```

### 2. Build & Deploy
```bash
npm run build
npm run deploy
```

### 3. Release Notes
Trong console, thêm release notes:
- Tính năng mới
- Bug fixes
- Breaking changes

---

## Troubleshooting

### Lỗi: "App ID not found"
**Nguyên nhân:** App ID trong `app-config.json` sai.

**Giải pháp:** 
1. Kiểm tra App ID trong Zalo Console
2. Copy chính xác vào `app-config.json`

### Lỗi: "Build failed"
**Nguyên nhân:** Dependencies thiếu hoặc code lỗi.

**Giải pháp:**
```bash
# Xóa node_modules
rm -rf node_modules

# Cài lại
npm install

# Build lại
npm run build
```

### Lỗi: "Permission denied"
**Nguyên nhân:** Chưa login hoặc token hết hạn.

**Giải pháp:**
```bash
zmp logout
zmp login
```

### Lỗi: "API calls fail"
**Nguyên nhân:** NEXT_PUBLIC_API_URL chưa đúng.

**Giải pháp:**
1. Kiểm tra `.env.local`
2. Đảm bảo Next.js app đã deploy lên Vercel
3. Update URL production

### App chậm hoặc không load
**Nguyên nhân:** Build size quá lớn.

**Giải pháp:**
1. Kiểm tra size: `npm run build`
2. Optimize images
3. Code splitting
4. Remove unused dependencies

---

## Best Practices

### 1. Environment Variables
```env
# Development
NEXT_PUBLIC_API_URL=http://localhost:3000

# Production
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app
```

### 2. Version Management
- Development: Test features
- Staging: Internal testing (dùng Zalo Dev)
- Production: End users

### 3. Monitoring
- Check Zalo Console > Analytics
- Monitor API logs
- Track user feedback

### 4. Security
- Không commit secrets vào git
- Dùng environment variables
- Enable HTTPS cho API

---

## Workflow hoàn chỉnh

```
1. Code changes
   ↓
2. Test locally (npm run dev)
   ↓
3. Build (npm run build)
   ↓
4. Deploy Development (npm run deploy)
   ↓
5. Test on Zalo DevTools + Phone
   ↓
6. Fix bugs (if any) → Back to step 1
   ↓
7. Deploy Production (zmp deploy --env production)
   ↓
8. Submit for Review
   ↓
9. Approved → Publish
```

---

## Resources

- **Zalo Mini App Documentation**: https://mini.zalo.me/docs
- **Zalo Developer Console**: https://developers.zalo.me
- **Zalo DevTools**: https://mini.zalo.me/devtools
- **Support**: https://mini.zalo.me/support

---

## Checklist trước khi Deploy Production

- [ ] Đã test đầy đủ trên Development
- [ ] App ID đúng trong app-config.json
- [ ] API URL production đúng
- [ ] Permissions đã được khai báo đầy đủ
- [ ] Privacy Policy đã thêm (nếu cần)
- [ ] Icons và images đã optimize
- [ ] Build size < 10MB
- [ ] Version number đã tăng
- [ ] Release notes đã viết
- [ ] Backup code hiện tại

---

**Lưu ý cuối:** Sau khi deploy thành công Development, hãy test kỹ trước khi submit Production để tránh bị reject!
