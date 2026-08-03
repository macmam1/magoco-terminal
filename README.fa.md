# 🖥️ ترمینال MAGoCo نسخه ۳.۰

ترمینال وب حرفه‌ای مبتنی بر HTTP با دسترسی کامل به Shell. ساخته شده با Node.js برای اجرای سریع و قابل اعتماد دستورات از راه دور.

---

## ✨ امکانات

| امکان | توضیح |
|-------|-------|
| 🐚 **دسترسی کامل Shell** | اجرای هر دستور لینوکسی (`apt`, `pip`, `npm`, `git`, `docker` و...) |
| 📁 **مدیریت Session** | دستور `cd` بین فرمان‌ها حفظ میشه |
| 📤 **آپلود/دانلود فایل** | آپلود فایل به سرور یا دانلود خروجی |
| 📊 **مانیتورینگ سیستم** | نمای فوری از CPU، RAM، دیسک |
| 📦 **نصب‌کننده پکیج** | نصب پکیج با `apt`، `npm` یا `pip` |
| 🛡️ **محدودیت درخواست** | ۱۲۰ درخواست در دقیقه به ازای هر IP |
| 🎨 **رابط وب مدرن** | تم تاریک، طراحی واکنش‌گرا، تاریخچه دستورات |

---

## 🚀 شروع سریع

### ۱. Docker (توصیه شده)

```bash
docker build -t magoco-terminal .
docker run -d -p 3000:3000 \
  -e TERMINAL_USER=admin \
  -e TERMINAL_PASS=your-secret-password \
  magoco-terminal
```

### ۲. Node.js مستقیم

```bash
npm install
TERMINAL_USER=admin TERMINAL_PASS=your-password node server.js
```

### ۳. Docker Compose

```yaml
version: '3.8'
services:
  terminal:
    build: .
    ports:
      - "3000:3000"
    environment:
      - TERMINAL_USER=admin
      - TERMINAL_PASS=${TERMINAL_PASS}  # در فایل .env تنظیم کنید
    restart: unless-stopped
```

---

## 🔐 امنیت

| لایه امنیتی | پیاده‌سازی |
|------------|-----------|
| **احراز هویت** | HTTP Basic Auth (نام کاربری + رمز عبور) |
| ** اعتبارنامه‌ها** | فقط متغیرهای محیطی — **هرگز در کد** |
| **محدودیت درخواست** | ۱۲۰ درخواست/دقیقه به ازای هر IP |
| **تایم‌اوت دستور** | ۶۰ ثانیه به ازای هر دستور |
| **محدودیت خروجی** | حداکثر ۵۰ مگابایت |
| **جداسازی Session** | هر session پروسه shell جداگانه داره |

### ⚠️ مهم: رمزها را هرگز در کد قرار ندهید

```bash
# ✅ صحیح — از متغیرهای محیطی استفاده کنید
docker run -e TERMINAL_USER=admin -e TERMINAL_PASS=secret123 ...

# ❌ غلط — هرگز رمز را در کد یا Dockerfile قرار ندهید
# ENV TERMINAL_USER=admin
# ENV TERMINAL_PASS=secret123
```

### متغیرهای محیطی

| متغیر | الزامی | پیش‌فرض | توضیح |
|--------|--------|---------|-------|
| `TERMINAL_USER` | ✅ | — | نام کاربری ورود |
| `TERMINAL_PASS` | ✅ | — | رمز عبور ورود |
| `PORT` | ❌ | `3000` | پورت سرور |
| `WORK_DIR` | ❌ | `/tmp` | دایرکتوری کاری |
| `LOG_DIR` | ❌ | `/var/log/magoco-terminal` | دایرکتوری لاگ |

---

## 📡 مرجع API

### بررسی سلامت
```http
GET /health
```
```json
{"status": "ok", "uptime": 123.456}
```

### اجرای دستور
```http
POST /execute
Content-Type: application/json
Authorization: Basic base64(user:pass)
```
```json
{"command": "ls -la /tmp"}
```
```json
{
  "stdout": "total 8\ndrwxrwxrwt 2 root root 4096 ...",
  "stderr": "",
  "exitCode": 0,
  "duration": "25ms"
}
```

### اجرای دسته‌ای
```http
POST /batch
```
```json
{
  "commands": ["whoami", "pwd", "uname -a"]
}
```

### اطلاعات سیستم
```http
GET /sysinfo
```
```json
{
  "hostname": "terminal-server",
  "platform": "linux",
  "cpus": 2,
  "memory": "7.8GB",
  "disk": "14GB free",
  "uptime": "5 days"
}
```

### نصب پکیج
```http
POST /install
```
```json
{
  "package": "python3-pip",
  "manager": "apt"
}
```

### لیست فایل‌ها
```http
POST /files
```
```json
{
  "path": "/tmp"
}
```

---

## 🏗️ معماری

```
┌─────────────────────────────────────────┐
│              مرورگر (رابط)              │
│         تم تاریک، WebSocket             │
└──────────────────┬──────────────────────┘
                   │ HTTP
┌──────────────────▼──────────────────────┐
│         سرور Express.js                 │
│  ┌─────────────┬─────────────┐         │
│  │  لایه Auth   │ Rate Limit  │         │
│  └──────┬──────┴──────┬──────┘         │
│         │             │                 │
│  ┌──────▼──────┐ ┌────▼───────┐        │
│  │  مدیریت     │ │  اجرای     │        │
│  │  Session    │ │  دستور     │        │
│  └─────────────┘ └────────────┘        │
└─────────────────────────────────────────┘
```

---

## 📦 ساختار پروژه

```
magoco-terminal/
├── server.js          # سرور اصلی (Express)
├── package.json       # پکیج‌ها
├── Dockerfile         # بیلد Docker
├── .dockerignore      # قوانین نادیده گرفتن Docker
├── README.md          # مستندات انگلیسی
├── README.fa.md       # مستندات فارسی
└── public/
    └── index.html     # رابط وب
```

---

## 🛠️ توسعه

```bash
# کلون
git clone https://github.com/magoco-terminal.git

# نصب
npm install

# اجرا (توسعه)
TERMINAL_USER=admin TERMINAL_PASS=dev123 node server.js

# تست
curl -u admin:dev123 http://localhost:3000/health
```

---

## 📋 تاریخچه تغییرات

### نسخه ۳.۰ (۲۰۲۶-۰۸-۰۳)
- ✅ بازنویسی کامل با رویکرد امنیت اول
- ✅ احراز هویت از متغیرهای محیطی
- ✅ محدودیت درخواست و تایم‌اوت دستور
- ✅ رابط مدرن تاریک با طراحی واکنش‌گرا
- ✅ پشتیبانی آپلود/دانلود فایل
- ✅ داشبورد مانیتورینگ سیستم

---

## 📄 مجوز

مجوز MIT — جزئیات در [LICENSE](LICENSE)

---

## 🔗 لینک‌ها

- **GitHub:** [magoco-terminal](https://github.com/magoco-terminal)
- **Docker Hub:** `magoco-terminal:latest`
- **مشکلات:** [GitHub Issues](https://github.com/magoco-terminal/issues)
