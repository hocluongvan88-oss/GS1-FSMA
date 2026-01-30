# BÁO CÁO PHÂN TÍCH: MASTER DATA EDITING POLICY
## Kiểm toán chuyên sâu về chính sách chỉnh sửa dữ liệu chuẩn

**Ngày:** 27/01/2026  
**Phiên bản:** 1.0  
**Auditor:** v0 AI System Analyst

---

## EXECUTIVE SUMMARY

Sau khi kiểm tra chi tiết 3 trang **Products**, **Locations**, và **Batches**, đối chiếu với tiêu chuẩn GS1 EPCIS 2.0, FSMA 204, và hệ thống RBAC hiện tại, tôi kết luận:

### CÓ - CẦN PHẢI THÊM NÚT CHỈNH SỬA

**Lý do quan trọng:**
1. **GS1 Best Practice**: Master data CẦN có khả năng sửa lỗi (typo, cập nhật thông tin)
2. **Business Reality**: Sản phẩm đổi tên, địa chỉ thay đổi, GLN cần update
3. **FSMA 204 Compliance**: Cho phép sửa KDEs (Key Data Elements) NẾU có audit trail
4. **RBAC System**: Đã có permissions `master:manage_*` nhưng chưa implement UI

---

## HIỆN TRẠNG HỆ THỐNG

### ✅ Có (Only Delete):
- **/products**: Chỉ có Delete button
- **/locations**: Chỉ có Delete button  
- **/batches**: Chỉ có Delete button

### ❌ Thiếu (Edit Functionality):
- Không có nút Edit trên bất kỳ trang nào
- Không có dialog/form để sửa data
- Không có API endpoint PUT/PATCH cho master data

---

## QUY ĐỊNH THEO CHUẨN GS1/EPCIS 2.0

### Master Data vs Event Data

\`\`\`
╔═══════════════════════════════════════════════════════════╗
║  LOẠI DỮ LIỆU          │  CHO PHÉP SỬA?  │  YÊU CẦU       ║
╠═══════════════════════════════════════════════════════════╣
║  Master Data:          │                 │                ║
║  - Products (GTIN)     │  ✅ CÓ          │  Audit trail   ║
║  - Locations (GLN)     │  ✅ CÓ          │  Audit trail   ║
║  - Partners            │  ✅ CÓ          │  Audit trail   ║
╠════════════════════════════════════════════���══════════════╣
║  Transactional Data:   │                 │                ║
║  - Events (EPCIS)      │  ❌ KHÔNG       │  Immutable     ║
║  - Audit Logs          │  ❌ KHÔNG       │  Immutable     ║
╠═══════════════════════════════════════════════════════════╣
║  Production Data:      │                 │                ║
║  - Batches             │  ⚠️ CÓ GIỚ⚠️   │  Conditional   ║
║    > Trước production  │  ✅ CÓ          │  Draft mode    ║
║    > Đang production   │  ⚠️ LIMITED     │  Chỉ quantity  ║
║    > Đã shipped        │  ❌ KHÔNG       │  Locked        ║
╚═══════════════════════════════════════════════════════════╝
\`\`\`

### GS1 EPCIS 2.0 Guidelines:

**Theo tài liệu GS1:**
- **Master data** (product, location) được phép sửa VÌ chúng là **reference data**, không phải transaction
- **Event data** (OBSERVE, SHIP, RECEIVE) là **immutable** - không được sửa sau khi tạo
- Nếu event sai, phải tạo **corrective event** mới, không sửa event cũ

**Reference:** GS1 EPCIS 2.0 Standard Section 6.3.2 - Master Data Management

---

## QUY ĐỊNH THEO FSMA 204

### FDA Food Traceability Rule Requirements:

**Critical Tracking Events (CTEs) - IMMUTABLE:**
- Harvest events
- Cooling events
- Packing events  
- Shipping/Receiving events

**Key Data Elements (KDEs) - CAN BE CORRECTED:**
- Traceability Lot Code (TLC)
- Product identifiers (GTIN)
- Location identifiers (GLN)
- Quantity/Unit of Measure

**YÊU CẦU CHỈNH SỬA THEO FDA:**
\`\`\`
IF correction IS needed:
  1. Phải GHI RÕ trong audit log
  2. Giữ lại old value
  3. Ghi rõ user + timestamp + reason
  4. Không được xóa history
  5. Phải notify đối tác nếu đã share data
\`\`\`

**Reference:** FSMA 204 Final Rule - 21 CFR 1.1345 (Recordkeeping Requirements)

---

## PHÂN TÍCH RBAC PERMISSIONS

### Hệ thống đã có permissions nhưng chưa implement:

\`\`\`typescript
// lib/auth/permissions.ts - LINE 20-27

export type Permission = 
  // Master Data Management
  | 'master:manage_products'    // ← CÓ permission này
  | 'master:manage_locations'   // ← CÓ permission này  
  | 'master:manage_partners'    // ← CÓ permission này
  | 'master:view_products'
  | 'master:view_locations'
  | 'master:view_partners'
\`\`\`

### Roles có quyền Edit:

| Role | Products | Locations | Batches |
|------|:--------:|:---------:|:-------:|
| **system_admin** | ✅ CRUD | ✅ CRUD | ✅ CRUD |
| **admin** | ✅ CRUD | ✅ CRUD | ✅ CRUD |
| **factory_manager** | ❌ R | ❌ R | ✅ CRUD |
| **quality_inspector** | ❌ R | ❌ R | ⚠️ RU (quality only) |
| **logistics_manager** | ❌ R | ⚠️ RU (warehouse) | ❌ R |
| **worker** | ❌ R | ❌ R | ❌ R |
| **farmer** | ❌ R | ❌ R | ⚠️ CR (own only) |
| **auditor** | ❌ R | ❌ R | ❌ R |

---

## KHUYẾN NGHỊ TRIỂN KHAI

### 1. PRODUCTS - Cần Edit Button

**Lý do:**
- Sản phẩm đổi tên (rebranding)
- Cập nhật category, unit
- **KHÔNG cho phép sửa GTIN** (unique identifier)

**Implementation:**
\`\`\`typescript
// Cho phép sửa:
- name ✅
- category ✅  
- unit ✅
- description ✅

// Không cho sửa:
- gtin ❌ (immutable identifier)
- created_at ❌
\`\`\`

### 2. LOCATIONS - Cần Edit Button

**Lý do:**
- Địa chỉ thay đổi
- Tên location update
- Coordinates điều chỉnh
- **KHÔNG cho phép sửa GLN** (unique identifier)

**Implementation:**
\`\`\`typescript
// Cho phép sửa:
- name ✅
- type ✅
- address ✅
- coordinates ✅

// Không cho sửa:
- gln ❌ (immutable identifier)
- created_at ❌
\`\`\`

### 3. BATCHES - Cần Edit Button (Conditional)

**Lý do:**
- Sửa lỗi nhập liệu KDEs (FSMA 204)
- Cập nhật quality status
- **CÓ ĐIỀU KIỆN** dựa trên lifecycle

**Implementation - Tiered Editing:**
\`\`\`typescript
// Batch Lifecycle States:
enum BatchState {
  DRAFT = 'draft',              // ✅ Full edit
  IN_PRODUCTION = 'production', // ⚠️ Limited edit
  QUALITY_REVIEW = 'review',    // ⚠️ Quality only
  APPROVED = 'approved',        // ❌ Read-only
  SHIPPED = 'shipped',          // ❌ Locked forever
}

// Edit permissions by state:
IF state === DRAFT:
  - Tất cả fields EXCEPT (id, traceability_lot_code)
  
IF state === IN_PRODUCTION:
  - quantity_produced ✅
  - cooling_completion_datetime ✅
  - harvest_date ❌ (KDE locked)
  - product_id ❌ (locked)
  
IF state === QUALITY_REVIEW:
  - quality_status ✅ (quality_inspector only)
  - Other fields ❌
  
IF state === APPROVED OR SHIPPED:
  - ALL FIELDS ❌ (immutable)
\`\`\`

---

## AUDIT TRAIL REQUIREMENTS

### Mọi edit action PHẢI log vào audit_logs:

\`\`\`sql
-- audit_logs table
INSERT INTO audit_logs (
  action,           -- 'UPDATE'
  entity_type,      -- 'product', 'location', 'batch'
  entity_id,        -- UUID of edited record
  old_value,        -- JSONB của giá trị cũ
  new_value,        -- JSONB của giá trị mới
  user_id,          -- User thực hiện
  reason,           -- Lý do sửa (optional text field)
  ip_address,       
  user_agent,
  created_at
)
\`\`\`

### Audit Log Entry Example:
\`\`\`json
{
  "action": "UPDATE",
  "entity_type": "product",
  "entity_id": "uuid-123",
  "old_value": {
    "name": "Cà phê Robusta",
    "category": "Coffee"
  },
  "new_value": {
    "name": "Cà phê Robusta Đặc Biệt",
    "category": "Premium Coffee"
  },
  "user_id": "admin-uuid",
  "reason": "Cập nhật tên sản phẩm theo yêu cầu marketing",
  "ip_address": "192.168.1.100",
  "created_at": "2026-01-27T10:30:00Z"
}
\`\`\`

---

## UI/UX DESIGN GUIDELINES

### Edit Button Placement:
\`\`\`
┌─────────────────────────────────────────────────────┐
│ Table Row                          │ Actions Column │
│ Product Name | GTIN | Category    │ [Edit] [Delete]│
└─────────────────────────────────────────────────────┘
\`\`\`

### Edit Dialog Flow:
1. Click Edit → Open dialog với current values
2. Show warning nếu sửa sensitive fields
3. Require "Reason" field (optional nhưng recommended)
4. Show confirmation: "Bạn chắc chắn muốn cập nhật?"
5. Success toast + auto-refresh table

### Conditional Edit States:
\`\`\`tsx
// Batch editing - show different warnings
{batch.state === 'approved' && (
  <Alert variant="destructive">
    Batch đã được phê duyệt. Không thể chỉnh sửa.
    Liên hệ admin nếu cần điều chỉnh.
  </Alert>
)}

{batch.state === 'draft' && (
  <Button variant="outline">
    <Edit className="h-4 w-4 mr-2" />
    Chỉnh sửa
  </Button>
)}
\`\`\`

---

## SECURITY CONSIDERATIONS

### 1. Permission Check (Server-side):
\`\`\`typescript
// API Route: /api/products/[id]
export async function PATCH(request: Request, { params }) {
  const user = await getCurrentUser()
  
  // Check permission
  if (!hasPermission(user.role, 'master:manage_products')) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Prevent GTIN modification
  const { gtin, ...updateData } = await request.json()
  if (gtin) {
    return new Response('GTIN cannot be modified', { status: 400 })
  }
  
  // Log to audit trail
  await logAudit({
    action: 'UPDATE',
    entity_type: 'product',
    entity_id: params.id,
    old_value: oldProduct,
    new_value: updateData,
    user_id: user.id,
  })
  
  // Perform update
  const result = await supabase
    .from('products')
    .update(updateData)
    .eq('id', params.id)
  
  return Response.json(result)
}
\`\`\`

### 2. Database RLS Policy Update:
\`\`\`sql
-- Allow UPDATE for admin roles
CREATE POLICY "products_update_policy" ON products
  FOR UPDATE
  USING (
    auth.jwt() ->> 'role' IN ('system_admin', 'admin')
  );

-- Prevent GTIN modification (application-level check)
\`\`\`

---

## RISK ASSESSMENT

### Rủi ro NẾU KHÔNG có Edit:

| Risk | Impact | Likelihood | Severity |
|------|--------|------------|----------|
| Phải xóa & tạo lại khi có lỗi | ⚠️ Mất traceability history | HIGH | CRITICAL |
| Không tuân thủ FSMA 204 | ⚠️ FDA violation | MEDIUM | HIGH |
| UX kém, user frustration | ⚠️ Training overhead | HIGH | MEDIUM |
| Data inconsistency | ⚠️ Wrong information in system | MEDIUM | HIGH |

### Rủi ro NẾU CÓ Edit (nhưng thiếu audit):

| Risk | Impact | Likelihood | Severity |
|------|--------|------------|----------|
| Sửa data không có audit trail | ⚠️ Compliance violation | MEDIUM | CRITICAL |
| Sửa identifier (GTIN/GLN) | ⚠️ Break traceability chain | LOW | CRITICAL |
| Unauthorized edits | ⚠️ Data tampering | LOW | HIGH |

### Giải pháp đề xuất:
✅ **CÓ Edit + Audit Trail + Immutable Identifiers + Permission Control**

---

## IMPLEMENTATION ROADMAP

### Phase 1: Core Edit Functionality (1 Sprint - 2 weeks)
- [ ] Add Edit button to Products page
- [ ] Add Edit button to Locations page
- [ ] Add Edit dialog with form validation
- [ ] Create PATCH API endpoints
- [ ] Implement audit logging for all edits
- [ ] Block editing of immutable fields (GTIN, GLN)

### Phase 2: Batches Conditional Editing (1 Sprint)
- [ ] Add batch_state field to database
- [ ] Implement state machine for batch lifecycle
- [ ] Conditional Edit based on state
- [ ] Quality Inspector-specific edit permissions
- [ ] Lock batches when shipped

### Phase 3: Enhanced Audit & Compliance (1 Sprint)
- [ ] Audit log viewer UI
- [ ] Change history timeline per record
- [ ] "Reason for edit" required field
- [ ] Export audit reports (PDF/CSV)
- [ ] Compliance dashboard

---

## KẾT LUẬN CHÍNH THỨC

### Câu trả lời: **CÓ - CẦN PHẢI CÓ NÚT CHỈNH SỬA**

**Căn cứ:**
1. ✅ **GS1 EPCIS 2.0**: Master data được phép sửa
2. ✅ **FSMA 204**: KDEs có thể correct với audit trail
3. ✅ **RBAC System**: Đã có permissions, chỉ thiếu UI
4. ✅ **Business Need**: Real-world data changes (typos, updates)

**Điều kiện bắt buộc:**
1. ⚠️ **Audit Trail** - Mọi thay đổi phải log chi tiết
2. ⚠️ **Immutable Identifiers** - GTIN, GLN, TLC không được sửa
3. ⚠️ **Permission Control** - Chỉ admin/system_admin
4. ⚠️ **Lifecycle-based** - Batches có điều kiện dựa trên state
5. ⚠️ **Reason Field** - Ghi rõ lý do sửa

**Priority:**
- **P0 (Critical):** Products & Locations edit
- **P1 (High):** Batches conditional edit
- **P2 (Medium):** Enhanced audit viewer

---

## TÀI LIỆU THAM KHẢO

1. **GS1 EPCIS 2.0 Standard**  
   https://www.gs1.org/standards/epcis

2. **FDA FSMA 204 - Food Traceability Rule**  
   https://www.fda.gov/food/food-safety-modernization-act-fsma/fsma-final-rule-requirements-additional-traceability-records-certain-foods

3. **ISO 22000:2018 - Food Safety Management**  
   Section 7.3.2 - Traceability System

4. **GS1 Implementation Guideline**  
   "Master Data Management in Supply Chain Traceability"

---

**Prepared by:** v0 AI System Analyst  
**Reviewed by:** Pending stakeholder review  
**Date:** 27/01/2026  
**Version:** 1.0 - Final
