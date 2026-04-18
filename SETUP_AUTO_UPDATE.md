# 🚀 Hướng Dẫn Cập Nhật Tự Động cho CheckOps v5

Bắt đầu từ v5.2.0, ứng dụng CheckOps hỗ trợ **cập nhật tự động** mà không cần cài lại!

## 📦 Cách Hoạt Động

1. **Ứng dụng sẽ tự động kiểm tra cập nhật** mỗi giờ
2. **Nếu có phiên bản mới**, người dùng sẽ nhận được thông báo
3. **Người dùng có thể tải xuống & cài đặt** trực tiếp từ giao diện

## 🔧 Setup GitHub Releases (Cách Đơn Giản - Miễn Phí)

### 1️⃣ Tạo GitHub Repository

```bash
# Lần đầu tiên
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/quan-ly-checklist.git
git push -u origin main
```

### 2️⃣ Update package.json

Mở file `package.json` và tìm section `build.publish`:

```json
"publish": [
  {
    "provider": "github",
    "owner": "YOUR_GITHUB_USERNAME",
    "repo": "quan-ly-checklist",
    "channel": "latest"
  }
]
```

**Thay thế:**
- `YOUR_GITHUB_USERNAME` → Username GitHub của bạn
- `quan-ly-checklist` → Tên repository GitHub

### 3️⃣ Tạo GitHub Personal Access Token

1. Vào https://github.com/settings/tokens
2. Click "Generate new token" → "Generate new token (classic)"
3. Điền tên: `CheckOps Auto Update`
4. Chọn scopes:
   - ✅ `repo` (full control)
   - ✅ `workflow` (update workflows)
5. Click "Generate token"
6. **Copy token** (sẽ không thể xem lại!)

### 4️⃣ Set Environment Variable



```bash
npm run dist
```

Khi build hoàn thành:
- ✅ Sẽ tạo GitHub Release tự động
- ✅ Upload file `.exe` lên GitHub
- ✅ Người dùng có thể cập nhật qua app

## 📋 Quy Trình Phát Hành Phiên Bản Mới

Mỗi khi bạn muốn phát hành phiên bản mới:

```bash
# 1. Cập nhật version trong package.json
# "version": "5.2.1"

# 2. Build & publish
npm run dist

# 3. Trong terminal sẽ thấy:
# ✓ Uploading artifacts to GitHub Release...
```

## 🔍 Kiểm Tra Cập Nhật trong Ứng Dụng

1. Mở **Settings** (⚙️) → Tab **Cập Nhật**
2. Bấm **"🔄 Kiểm Tra Cập Nhật"**
3. Nếu có phiên bản mới:
   - Bấm **"⬇️ Tải Xuống Cập Nhật"**
   - Chờ tải xong
   - Bấm **"🚀 Cài Đặt & Khởi Động Lại"**

## 🛠️ Cách Thay Thế (S3 hoặc Server Riêng)

Nếu muốn dùng S3 hoặc server riêng để host file update:

**Update `package.json`:**
```json
"publish": [
  {
    "provider": "s3",
    "bucket": "your-bucket-name",
    "region": "us-east-1",
    "path": "/releases/"
  }
]
```

Hoặc tự host file trên web server, config `electron-updater` trong app...

## ⚙️ File Quan Trọng

| File | Chức Năng |
|------|---------|
| `electron/autoUpdater.ts` | Logic cập nhật |
| `src/hooks/useAutoUpdate.ts` | React hook cho UI |
| `src/pages/Settings/UpdateTab.tsx` | Giao diện cập nhật |
| `electron/preload.ts` | Expose IPC APIs |

## 🐛 Troubleshooting

**Cập nhật không hoạt động:**
- ✅ Kiểm tra internet connection
- ✅ Kiểm tra GitHub token có hợp lệ
- ✅ Xem browser DevTools Console (F12) có lỗi gì
- ✅ Chắc chắn version trong package.json cao hơn phiên bản hiện tại

**Không tìm thấy phiên bản mới:**
- ⚠️ Chắc chắn Release được publish đúng cách
- ⚠️ Check GitHub repo settings: Releases có file `.exe` không?

## 📚 Tài Liệu Thêm

- [electron-updater docs](https://www.electron.build/auto-update)
- [GitHub Releases API](https://docs.github.com/en/rest/releases)

---

**Happy Updates! 🎉**
