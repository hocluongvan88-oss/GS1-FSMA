# Flow: Từ Zalo Mini App → Digital Link QR Code → Người tiêu dùng

## 📱 Tổng quan Flow

\`\`\`
┌─────────────────┐
│  Nông dân/      │ 1. Ghi nhận sự kiện bằng 
│  Công nhân      │    Voice/Camera trong Zalo App
│  (Zalo App)     │ ──────────────────────────┐
└─────────────────┘                            │
                                               ▼
┌──────────────────────────────────────────────────────┐
│  SUPABASE DATABASE                                   │
│  ┌────────────┐    ┌──────────────┐                 │
│  │  events    │───→│  digital_links│                │
│  │  table     │    │  table        │                │
│  └────────────┘    └──────────────┘                 │
└──────────────────────────────────────────────────────┘
                           │
                           │ 2. Nhà máy/Admin tạo QR Code
                           │    từ Digital Link page
                           ▼
                  ┌──────────────────┐
                  │   QR Code được   │
                  │   in ra/gửi cho  │
                  │   nông dân       │
                  └──────────────────┘
                           │
                           │ 3. Người tiêu dùng scan QR
                           ▼
                  ┌──────────────────┐
                  │  Public Landing  │
                  │  Page: /dl/abc123│
                  │  Hiển thị toàn   │
                  │  bộ lịch sử sự   │
                  │  kiện truy xuất  │
                  └──────────────────┘
\`\`\`

## 🔄 Chi tiết từng bước

### Bước 1: Ghi nhận sự kiện từ Zalo Mini App

**Người dùng:** Nông dân, công nhân nhà máy

**Action trong Zalo App:**
- Tab "Ghi âm": Nói "Nhận 100 kg cà phê từ vườn A"
- Tab "Chụp ảnh": Chụp ảnh hàng hóa
- Tab "Nhiều SP": Nhập batch nhiều sản phẩm cùng lúc

**Xử lý:**
\`\`\`typescript
// 1. Zalo App gọi Supabase Edge Function
POST /functions/v1/process-voice-input
POST /functions/v1/process-vision-input

// 2. Gemini AI trích xuất thông tin
{
  "productName": "Cà phê Arabica",
  "quantity": 100,
  "unit": "kg",
  "action": "receiving",
  "location": "Nhà máy chế biến A"
}

// 3. Lưu vào bảng events với EPCIS mapping
INSERT INTO events (
  event_type,      -- 'ObjectEvent'
  action,          -- 'OBSERVE' (receiving)
  biz_step,        -- 'receiving'
  epc_list,        -- ['urn:epc:id:sgtin:...']
  quantity_list,   -- [{"quantity": 100, "uom": "KGM"}]
  read_point,      -- GLN của nhà máy
  source_type,     -- 'voice_ai' | 'vision_ai'
  user_id,         -- ID của nông dân/công nhân
  user_name        -- Tên người ghi nhận
)
\`\`\`

**Kết quả:** Event được lưu vào database với đầy đủ EPCIS schema

---

### Bước 2: Tạo Digital Link & QR Code (Dashboard)

**Người dùng:** Admin nhà máy, quản lý

**Location:** Dashboard → Digital Link (QR Code) page (`/dashboard/digital-link`)

**Quy trình tạo QR:**

\`\`\`typescript
// 1. Chọn sản phẩm và batch
Selected Product: Cà phê Arabica (GTIN: 08123456789012)
Selected Batch: LOT-2024-001
Serial (optional): SN12345

// 2. Nhấn "Generate QR Code"
POST /api/generate-qr
{
  "gtin": "08123456789012",
  "lot": "LOT-2024-001", 
  "serial": "SN12345",
  "metadata": {
    "product_name": "Cà phê Arabica",
    "link_type": "traceability"
  }
}

// 3. Hệ thống tự động tạo:
{
  "shortCode": "Kx7mP2qZ",  // Random 8-character code
  "shortUrl": "https://gs-1-fsma.vercel.app/dl/Kx7mP2qZ",
  "digitalLinkUri": "/01/08123456789012/10/LOT-2024-001/21/SN12345",
  "qrCodeUrl": "https://api.qrserver.com/v1/create-qr-code/?...",
  "epc": "urn:epc:id:sgtin:812345.678901.12345"
}

// 4. Lưu vào bảng digital_links
INSERT INTO digital_links (
  short_url,     -- 'Kx7mP2qZ'
  gtin,          -- '08123456789012'
  lot,           -- 'LOT-2024-001'
  serial,        -- 'SN12345'
  epc,           -- EPC identifier
  metadata,      -- Link type, product info
  access_count   -- 0 (will increment on each scan)
)
\`\`\`

**Kết quả:** 
- QR Code image được tạo
- Short URL được lưu vào database
- Admin có thể:
  - Download QR code (PNG/SVG)
  - Copy link gửi qua Zalo/email
  - In QR code dán lên bao bì

---

### Bước 3: Người tiêu dùng Scan QR Code

**Người dùng:** Người tiêu dùng cuối, khách hàng

**Flow truy xuất:**

\`\`\`
1. Scan QR Code bằng điện thoại
   ↓
2. Mở link: https://gs-1-fsma.vercel.app/dl/Kx7mP2qZ
   ↓
3. Hệ thống xử lý:
   
   GET /dl/Kx7mP2qZ (Public page, không cần đăng nhập)
   
   a) Tìm digital_links.short_url = 'Kx7mP2qZ'
      → Lấy được gtin, lot, serial, epc
   
   b) Tìm product từ GTIN
      → Lấy tên, mô tả, category
   
   c) Tìm tất cả events liên quan
      → WHERE epc_list @> [epc]
      → ORDER BY event_time DESC
   
   d) Tăng access_count += 1
   
   ↓
4. Hiển thị Public Landing Page với:
\`\`\`

**Landing Page hiển thị:**

\`\`\`
╔══════════════════════════════════════════╗
║  PRODUCT TRACEABILITY                    ║
╠══════════════════════════════════════════╣
║                                          ║
║  📦 Cà phê Arabica                       ║
║  Cà phê hạt nguyên chất từ Đà Lạt       ║
║                                          ║
║  Category: coffee                        ║
║  Lot: LOT-2024-001                       ║
║  Serial: SN12345                         ║
║  GTIN: 08123456789012                    ║
║                                          ║
╠══════════════════════════════════════════╣
║  TRACEABILITY HISTORY                    ║
╠══════════════════════════════════════════╣
║                                          ║
║  ● ObjectEvent | Shipping                ║
║    📅 15/01/2025 14:30                   ║
║    📍 Nhà máy chế biến A                 ║
║    👤 Recorded by: Nguyễn Văn A          ║
║    🤖 Source: Manual Entry               ║
║                                          ║
║  ● ObjectEvent | Packing                 ║
║    📅 14/01/2025 09:15                   ║
║    📍 Nhà máy chế biến A                 ║
���    👤 Recorded by: Trần Thị B            ║
║    🤖 Source: Vision AI                  ║
║                                          ║
║  ● ObjectEvent | Receiving               ║
║    📅 10/01/2025 07:00                   ║
║    📍 Vườn cà phê Đà Lạt                 ║
║    👤 Recorded by: Lê Văn C              ║
║    🤖 Source: Voice AI                   ║
║                                          ║
╠══════════════════════════════════════════╣
║  Powered by GS1 EPCIS 2.0 Standard       ║
║  This product has been accessed 47 times ║
╚══════════════════════════════════════════╝
\`\`\`

---

## 🗂️ Database Mapping

### Từ Zalo Event → Digital Link → Consumer View

\`\`\`sql
-- 1. Events từ Zalo được lưu với EPC
events {
  id: uuid
  event_type: 'ObjectEvent'
  epc_list: ['urn:epc:id:sgtin:812345.678901.12345']
  quantity_list: [{"quantity": 100, "uom": "KGM"}]
  biz_step: 'receiving'
  read_point: 'urn:epc:id:sgln:8234567.00001.0'
  source_type: 'voice_ai'
  user_name: 'Nguyễn Văn A'
}

-- 2. Digital Link mapping
digital_links {
  id: uuid
  short_url: 'Kx7mP2qZ'
  gtin: '08123456789012'
  lot: 'LOT-2024-001'
  epc: 'urn:epc:id:sgtin:812345.678901.12345'  ← SAME EPC
  access_count: 47
}

-- 3. Query để hiển thị trên public page
SELECT e.*, l.name as location_name
FROM events e
LEFT JOIN locations l ON e.read_point = l.gln
WHERE e.epc_list @> ARRAY['urn:epc:id:sgtin:812345.678901.12345']
ORDER BY e.event_time DESC;
\`\`\`

---

## 🎯 Tóm tắt Mapping

| **Stage**          | **Component**           | **Key Fields**                          |
|--------------------|-------------------------|-----------------------------------------|
| **Zalo Input**     | Voice/Camera/Batch      | productName, quantity, action           |
| **AI Processing**  | Gemini 2.0 Flash        | Trích xuất → structured JSON            |
| **Event Storage**  | `events` table          | epc_list, quantity_list, biz_step       |
| **QR Generation**  | Digital Link page       | gtin, lot, serial → generate short_url  |
| **Link Storage**   | `digital_links` table   | short_url, epc (links to events)        |
| **Consumer View**  | `/dl/{shortCode}`       | Query events by EPC → show timeline     |

---

## 💡 Lợi ích của Flow này

1. **Traceability hoàn chỉnh:** Từ nông trại → nhà máy → người tiêu dùng
2. **Zero manual data entry:** Dùng AI để tự động trích xuất
3. **GS1 compliant:** Tuân thủ chuẩn EPCIS 2.0 và Digital Link
4. **Accessible for everyone:** Public page không cần login
5. **Analytics built-in:** Track số lần truy cập (access_count)

---

## 🔧 Technical Details

### API Endpoints

\`\`\`
POST /functions/v1/process-voice-input    → Xử lý giọng nói
POST /functions/v1/process-vision-input   → Xử lý hình ảnh
POST /api/generate-qr                     → Tạo QR code
GET  /dl/{shortCode}                      → Public landing page
GET  /api/dl/{shortCode}                  → API lấy traceability data
\`\`\`

### Key Tables

\`\`\`
events          → Lưu tất cả EPCIS events
digital_links   → Mapping short URL → product/batch
products        → Master data sản phẩm (GTIN)
batches         → Lô sản xuất
locations       → Địa điểm (GLN)
\`\`\`

### Tech Stack

- **Frontend:** Next.js 16, React, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Edge Functions)
- **AI:** Google Gemini 2.0 Flash (voice + vision)
- **QR Generation:** qrserver.com API
- **Standards:** GS1 EPCIS 2.0, GS1 Digital Link
