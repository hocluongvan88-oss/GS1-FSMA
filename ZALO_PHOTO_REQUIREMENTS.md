# Hướng Dẫn Chụp Ảnh - Zalo Mini App

## Ảnh Cần Chụp Gì?

### 1. **Ảnh Sản Phẩm với Mã Vạch/QR Code**
**Mục đích:** Nhận diện tự động GTIN, Batch Number, Lot Number

**Yêu cầu:**
- ✅ Chụp rõ mã vạch (barcode) hoặc QR code trên bao bì
- ✅ Đảm bảo mã không bị mờ, không bị che khuất
- ✅ Ánh sáng đủ sáng, không quá tối hoặc quá chói
- ✅ Góc chụp vuông góc với mã vạch (không chụp nghiêng)
- ✅ Khoảng cách: 15-30cm từ camera đến sản phẩm

**Ví dụ tốt:**
\`\`\`
📦 [Bao gạo] → Mã vạch rõ ràng
🏷️ [Thùng hàng] → QR code sắc nét
📋 [Nhãn sản phẩm] → Số lot/batch hiển thị
\`\`\`

**Tránh:**
- ❌ Mã vạch bị nhòe, mờ
- ❌ Chụp quá xa, không đọc được mã
- ❌ Ánh sáng phản chiếu gây lóa
- ❌ Góc chụp nghiêng quá 30 độ

---

### 2. **Ảnh Đếm Số Lượng Sản Phẩm**
**Mục đích:** AI đếm số lượng thùng, bao, kiện hàng

**Yêu cầu:**
- ✅ Chụp toàn cảnh khu vực có sản phẩm
- ✅ Sản phẩm xếp gọn gàng, không đè lên nhau quá nhiều
- ✅ Đủ ánh sáng để phân biệt từng đơn vị
- ✅ Nền tảng đơn giản (không lộn xộn)

**Ví dụ counting scenarios:**
- 📦📦📦 → AI đếm: 3 thùng
- 🛢️🛢️🛢️🛢️ → AI đếm: 4 can
- 🌾🌾🌾🌾🌾 → AI đếm: 5 bao gạo

**Best practices:**
- Xếp sản phẩm thành hàng ngang/dọc dễ nhìn
- Chụp từ góc cao (bird's eye view) nếu có nhiều sản phẩm
- Tránh chụp trong điều kiện thiếu sáng

---

### 3. **Ảnh Sự Kiện Supply Chain**
**Mục đích:** Ghi nhận hoạt động (nhận hàng, xuất hàng, sản xuất, đóng gói, kiểm tra)

#### A. **Nhận Hàng (Receiving)**
Chụp:
- Xe tải đang dỡ hàng
- Sản phẩm vừa nhận từ nhà cung cấp
- Phiếu giao hàng/POD (Proof of Delivery)

#### B. **Xuất Hàng (Shipping)**
Chụp:
- Sản phẩm đã đóng gói xong chờ vận chuyển
- Xe tải đang chất hàng
- Bill of Lading (vận đơn)

#### C. **Sản Xuất (Production)**
Chụp:
- Nguyên liệu đầu vào
- Quy trình sản xuất (máy móc, công nhân đang làm)
- Sản phẩm thành phẩm sau sản xuất

#### D. **Đóng Gói (Packing)**
Chụp:
- Sản phẩm đang được đóng gói
- Thùng carton/bao bì đã đóng gói xong
- Nhãn mác được dán lên sản phẩm

#### E. **Kiểm Tra (Inspection)**
Chụp:
- Sản phẩm đang được kiểm tra chất lượng
- Dụng cụ đo lường (cân, nhiệt kế, pH meter...)
- Giấy chứng nhận/Test results

---

## Gemini Vision AI Nhận Diện Được Gì?

### **Khả Năng Tự Động Trích Xuất:**

1. **Event Type**
   - ObjectEvent (nhận, xuất, quan sát)
   - TransformationEvent (sản xuất, chuyển đổi)
   - AggregationEvent (đóng gói, gom nhóm)

2. **Business Action**
   - receiving (nhận hàng)
   - shipping (xuất hàng)
   - production (sản xuất)
   - packing (đóng gói)
   - inspection (kiểm tra)

3. **Product Information**
   - Tên sản phẩm (product name)
   - Số lượng (quantity)
   - Đơn vị (unit: kg, bao, thùng, cái...)

4. **Barcode/QR Data**
   - GTIN (14 chữ số)
   - Batch/Lot number
   - Serial number
   - GS1 DataMatrix

5. **Location Info**
   - Tên địa điểm (nếu có biển hiệu)
   - Số nhà, tên đường (nếu rõ ràng)

6. **Detected Objects**
   - Danh sách các đối tượng trong ảnh
   - Số lượng mỗi loại

---

## Kỹ Thuật Chụp Ảnh Tối Ưu

### **Ánh Sáng**
✅ Ánh sáng tự nhiên ban ngày (tốt nhất)  
✅ Đèn trắng LED (khá tốt)  
⚠️ Đèn vàng (có thể dùng nhưng kém hơn)  
❌ Ánh sáng hỗn hợp lộn xộn (tránh)  

### **Góc Chụp**
- **Barcode/QR:** 90° vuông góc
- **Counting:** 45-60° từ trên xuống
- **Event scenes:** 60-90° tùy tình huống

### **Khoảng Cách**
- **Barcode close-up:** 15-30cm
- **Counting 1-10 items:** 50cm-1m
- **Counting >10 items:** 1-2m
- **Event scene:** 1-3m

### **Resolution**
- Minimum: 1280x720 (HD)
- Recommended: 1920x1080 (Full HD)
- Camera phone thông thường đều đạt chuẩn

---

## Ví Dụ Thực Tế

### **Case 1: Nông Dân Nhận Giống**
\`\`\`
📸 Chụp:
- Bao giống (có mã vạch)
- Số lượng bao (đếm 10 bao)
- Xe tải đang dỡ hàng

🤖 AI trích xuất:
{
  "eventType": "ObjectEvent",
  "action": "receiving",
  "productName": "Giống lúa IR50404",
  "quantity": 10,
  "unit": "bags",
  "barcodeData": "08938507001526",
  "detectedObjects": ["rice bags", "truck"],
  "confidence": 0.92
}
\`\`\`

### **Case 2: Nhà Máy Sản Xuất**
\`\`\`
📸 Chụp:
- Dây chuyền xay xát
- Gạo thành phẩm đang đóng bao
- Cân điện tử hiển thị 25kg

🤖 AI trích xuất:
{
  "eventType": "TransformationEvent",
  "action": "production",
  "productName": "Gạo trắng ST25",
  "quantity": 25,
  "unit": "kg",
  "barcodeData": null,
  "detectedObjects": ["rice milling machine", "white rice", "scale"],
  "confidence": 0.88
}
\`\`\`

### **Case 3: Xuất Hàng cho Nhà Phân Phối**
\`\`\`
📸 Chụp:
- Pallet chứa 50 thùng gạo
- QR code trên mỗi thùng
- Xe tải đang chất hàng

🤖 AI trích xuất:
{
  "eventType": "ObjectEvent",
  "action": "shipping",
  "productName": "ST25 Premium Rice",
  "quantity": 50,
  "unit": "boxes",
  "barcodeData": "https://dl.gs1.org/01/08938507001526/10/LOT123",
  "detectedObjects": ["pallet", "cardboard boxes", "truck"],
  "confidence": 0.95
}
\`\`\`

---

## Confidence Score & Validation

### **Confidence Thresholds:**
- **≥ 0.9** → Excellent (tự động chấp nhận)
- **0.7 - 0.89** → Good (cần review nhanh)
- **0.6 - 0.69** → Fair (cần xem lại kỹ)
- **< 0.6** → Poor (cần chụp lại hoặc nhập thủ công)

### **Khi Nào AI Yêu Cầu Xác Nhận:**
- Confidence < 0.6
- Không phát hiện được barcode (cần thiết)
- Số lượng không rõ ràng
- Event type không chắc chắn

---

## Tips Chụp Ảnh Nhanh & Hiệu Quả

1. **Chuẩn bị trước:**
   - Xếp sản phẩm gọn gàng
   - Đảm bảo ánh sáng đủ
   - Lau sạch ống kính camera

2. **Trong khi chụp:**
   - Gi�� máy thật vững (không rung)
   - Chụp nhiều góc độ khác nhau
   - Focus vào điểm quan trọng (barcode, số lượng)

3. **Sau khi chụp:**
   - Xem trước preview để đảm bảo rõ ràng
   - Nếu mờ → chụp lại ngay
   - Đợi AI xử lý và xác nhận kết quả

---

## Troubleshooting

### **Vấn đề: AI không đọc được barcode**
**Giải pháp:**
- Chụp gần hơn (15-20cm)
- Đảm bảo mã không bị nhòe
- Tăng độ sáng môi trường
- Chụp lại với góc khác

### **Vấn đề: AI đếm sai số lượng**
**Giải pháp:**
- Xếp sản phẩm rõ ràng hơn
- Chụp từ góc cao hơn
- Tránh sản phẩm đè chồng lên nhau
- Nếu quá nhiều → chụp từng nhóm nhỏ

### **Vấn đề: AI không nhận diện được event type**
**Giải pháp:**
- Chụp thêm context (xe tải, máy móc, con người)
- Thêm caption voice "Đang nhận hàng từ nhà cung cấp"
- Chụp phiếu giao hàng/documents

---

## Kết Luận

Gemini 2.0 Flash Vision AI có khả năng nhận diện mạnh mẽ nhưng chất lượng ảnh đầu vào là yếu tố quyết định. Hãy chụp ảnh **rõ ràng, đủ sáng, góc chuẩn** để đạt confidence score cao và giảm thiểu sai sót.

**Quy tắc vàng:** 
> "Nếu mắt người nhìn thấy rõ → AI cũng nhận diện được tốt"

---

## Liên Hệ & Hỗ Trợ

Nếu gặp vấn đề kỹ thuật hoặc cần training thêm về cách chụp ảnh hiệu quả, vui lòng liên hệ:
- 📧 Email: support@gs1-traceability.vn
- 📱 Zalo: [Support Group Link]
- 🌐 Dashboard: https://gs1-traceability.vn/dashboard
