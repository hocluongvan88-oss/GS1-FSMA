# Hệ thống Validation Ảnh - Image Rejection System

## Tổng quan

Hệ thống tự động từ chối ảnh không liên quan đến chuỗi cung ứng để đảm bảo data integrity.

---

## Quy tắc Từ chối (Rejection Rules)

### ❌ REJECT - Ảnh BỊ TỪ CHỐI

#### 1. Ảnh con người
- Khuôn mặt, selfie
- Ảnh chân dung
- Người trong các hoạt động cá nhân

**Lý do:** Không phải dữ liệu supply chain

#### 2. Ảnh phong cảnh/thiên nhiên
- Cảnh núi non, biển cả
- Vườn cây (không phải nông trại sản xuất)
- Ảnh du lịch, nghỉ dưỡng

**Lý do:** Không liên quan truy xuất nguồn gốc

#### 3. Đồ vật cá nhân
- Điện thoại, laptop
- Quần áo, giày dép
- Nội thất gia đình

**Lý do:** Không phải sản phẩm trong chuỗi cung ứng

#### 4. Thức ăn trên đĩa
- Món ăn đã chế biến
- Thức ăn tại nhà hàng
- Đồ ăn không đóng gói

**Lý do:** Không có thông tin truy xuất

#### 5. Thú cưng, động vật
- Chó, mèo, thú cưng
- Động vật không liên quan sản xuất

**Lý do:** Không phải đối tượng truy xuất

---

### ✅ ACCEPT - Ảnh ĐƯỢC CHẤP NHẬN

#### 1. Sản phẩm đóng gói
- Hộp, túi, bao bì có nhãn
- Thùng carton có mã vạch
- Bao xi măng, phân bón có in thông tin

**Ví dụ:** Thùng sữa, bao gạo, chai nước mắm

#### 2. Mã vạch/QR code
- GTIN barcode rõ ràng
- QR code trên bao bì
- Tem nhãn sản phẩm

**Ví dụ:** Mã vạch 8936012341234

#### 3. Kho bãi, chuỗi cung ứng
- Hàng trên kệ kho
- Pallet chứa sản phẩm
- Xe tải chở hàng

**Ví dụ:** Kho lạnh chứa hải sản, kho chứa phân bón

#### 4. Hoạt động sản xuất
- Dây chuyền sản xuất
- Đóng gói sản phẩm
- Kiểm tra chất lượng

**Ví dụ:** Xưởng đóng gói trái cây, nhà máy chế biến

#### 5. Nông nghiệp thương mại
- Vườn trồng quy mô lớn
- Thu hoạch nông sản
- Phân loại sản phẩm

**Ví dụ:** Vườn cà phê, ruộng lúa thương mại

#### 6. Khu vực nhận/xuất hàng
- Bãi tập kết
- Khu vực loading dock
- Sân vận chuyển

**Ví dụ:** Khu vực nhận hàng siêu thị, cảng container

---

## Cơ chế Hoạt động

### Bước 1: Gemini Vision Analysis
\`\`\`typescript
{
  "isRelevant": true/false,
  "rejectionReason": "Reason if rejected",
  "confidence": 0.0-1.0
}
\`\`\`

### Bước 2: Validation Logic

#### Primary Check - isRelevant flag
\`\`\`typescript
if (data.isRelevant === false) {
  return {
    valid: false,
    errors: [`Image rejected: ${data.rejectionReason}`]
  }
}
\`\`\`

#### Fallback Check - Keyword Detection
Nếu Gemini không trả về `isRelevant`:

**Supply Chain Keywords:**
- box, package, pallet
- barcode, qr, label
- warehouse, product, shipping

**Irrelevant Keywords:**
- person, face, selfie
- landscape, pet, furniture
- phone, personal

### Bước 3: Confidence Threshold
\`\`\`typescript
if (data.confidence < 0.6) {
  warnings.push('Low confidence - manual review needed')
}
\`\`\`

---

## Thông báo User

### Trong Zalo Mini App

#### ❌ Ảnh bị từ chối:
\`\`\`
"Ảnh không hợp lệ"
"Vui lòng chụp ảnh sản phẩm, bao bì, 
hoặc hoạt động supply chain"

Lý do: [rejection reason]
\`\`\`

#### ⚠️ Confidence thấp:
\`\`\`
"AI không chắc chắn về ảnh này"
"Bạn có muốn tiếp tục không?"

[Tiếp tục] [Chụp lại]
\`\`\`

#### ✅ Ảnh được chấp nhận:
\`\`\`
"Đang xử lý ảnh..."
"Đã phát hiện: [detected objects]"
\`\`\`

---

## Testing Scenarios

### Test Case 1: Ảnh khuôn mặt
**Input:** Selfie của user  
**Expected:** `isRelevant: false`  
**Reason:** "Contains human face - not supply chain related"

### Test Case 2: Ảnh phong cảnh
**Input:** Ảnh núi non  
**Expected:** `isRelevant: false`  
**Reason:** "Landscape photo - no products detected"

### Test Case 3: Thức ăn trên đĩa
**Input:** Món ăn tại nhà hàng  
**Expected:** `isRelevant: false`  
**Reason:** "Prepared food without packaging - not traceable"

### Test Case 4: Sản phẩm đóng gói
**Input:** Thùng sữa có mã vạch  
**Expected:** `isRelevant: true`  
**Detected:** barcode, product, package

### Test Case 5: Kho hàng
**Input:** Kệ chứa hàng trong kho  
**Expected:** `isRelevant: true`  
**Detected:** warehouse, shelves, products

### Test Case 6: Hoạt động sản xuất
**Input:** Dây chuyền đóng gói  
**Expected:** `isRelevant: true`  
**Detected:** production, packaging, workers

---

## Metrics & Monitoring

### Key Metrics

1. **Rejection Rate**
   - Target: < 5% false rejections
   - Monitor: False positive rate

2. **Confidence Distribution**
   - High (>0.8): Auto-approve
   - Medium (0.6-0.8): Auto-approve with review
   - Low (<0.6): Manual review required

3. **Processing Time**
   - Target: < 3 seconds
   - Includes: Gemini API + validation

### Database Logging
\`\`\`sql
-- ai_processing_logs table
SELECT 
  processing_type,
  status,
  error_message,
  confidence_score
FROM ai_processing_logs
WHERE processing_type = 'vision'
  AND status = 'failed'
  AND error_message LIKE '%rejected%'
\`\`\`

---

## Best Practices

### Cho Users
1. Chụp ảnh rõ nét, đủ sáng
2. Tập trung vào sản phẩm/bao bì
3. Tránh chụp người, phông nền lộn xộn
4. Chụp vuông góc với mã vạch

### Cho Admins
1. Review rejected images định kỳ
2. Cập nhật keyword list khi cần
3. Monitor false rejection rate
4. Train users về ảnh hợp lệ

### Cho Developers
1. Log rejection reasons chi tiết
2. A/B test threshold values
3. Collect feedback on false rejections
4. Update Gemini prompt based on patterns

---

## Edge Cases

### Case 1: Ảnh mơ hồ
**Scenario:** Ảnh có cả người và sản phẩm  
**Solution:** Ưu tiên sản phẩm nếu có mã vạch/nhãn rõ ràng

### Case 2: Nông sản chưa đóng gói
**Scenario:** Trái cây trên cây, rau củ trên ruộng  
**Solution:** ACCEPT nếu có context sản xuất thương mại

### Case 3: Ảnh tài liệu
**Scenario:** Photo của giấy tờ, chứng từ  
**Solution:** ACCEPT nếu có thông tin truy xuất (số lô, ngày sản xuất)

### Case 4: Ảnh màn hình
**Scenario:** Chụp màn hình điện thoại/máy tính  
**Solution:** REJECT - yêu cầu chụp vật lý thật

---

## Update History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-30 | 1.0.0 | Initial release with relevance checking |

---

## References

- Gemini 2.0 Flash Vision: https://ai.google.dev/gemini-api/docs/vision
- EPCIS Validation: `/lib/validators/epcis-validator.ts`
- Supabase Functions: `/supabase/functions/process-vision-input/`
