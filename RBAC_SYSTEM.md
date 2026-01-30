# Hệ thống phân quyền RBAC (Role-Based Access Control)

## Tổng quan

Hệ thống traceability đã được tích hợp đầy đủ hệ thống phân quyền dựa trên vai trò (RBAC) với 8 roles khác nhau và các permissions chi tiết.

---

## Các Roles trong hệ thống

### 1. **SYSTEM_ADMIN** - Quản trị hệ thống
- **Mô tả**: Quyền cao nhất, quản lý toàn bộ hệ thống
- **Quyền hạn**:
  - Quản lý tất cả người dùng (tạo, sửa, xóa, cấp/thu hồi quyền)
  - Quản lý cấu hình hệ thống
  - Truy cập toàn bộ audit logs
  - Quản lý tất cả dữ liệu master data
  - Toàn quyền với tất cả chức năng

### 2. **ADMIN** - Quản trị doanh nghiệp
- **Mô tả**: Quản trị cấp doanh nghiệp, quản lý hoạt động hàng ngày
- **Quyền hạn**:
  - Quản lý người dùng trong tổ chức (không bao gồm system_admin)
  - Xem và xuất báo cáo analytics
  - Quản lý partners, products, locations
  - Xem audit logs của tổ chức
  - Phê duyệt AI review queue

### 3. **FACTORY_MANAGER** - Quản lý nhà máy
- **Mô tả**: Quản lý hoạt động sản xuất và vận hành nhà máy
- **Quyền hạn**:
  - Tạo và quản lý batches
  - Quản lý events (OBSERVE, TRANSFORM, AGGREGATE)
  - Phê duyệt quality inspections
  - Xem analytics liên quan đến nhà máy
  - Quản lý workers

### 4. **QUALITY_INSPECTOR** - Thanh tra chất lượng
- **Mô t��**: Kiểm tra và đảm bảo chất lượng sản phẩm
- **Quyền hạn**:
  - Tạo quality inspection events
  - Cập nhật quality metrics
  - Xem và sửa certifications
  - Phê duyệt/từ chối batches dựa trên quality
  - Truy cập quality reports

### 5. **LOGISTICS_MANAGER** - Quản lý vận chuyển
- **Mô tả**: Quản lý vận chuyển và logistics
- **Quyền hạn**:
  - Tạo và quản lý shipment events
  - Cập nhật shipping status
  - Quản lý locations (warehouses, distribution centers)
  - Xem logistics analytics
  - Tạo SHIP events

### 6. **WORKER** - Công nhân
- **Mô tả**: Nhân viên sản xuất và nhập liệu
- **Quyền hạn**:
  - Nhập events qua voice, vision, manual
  - Xem batches và products được giao
  - Cập nhật production progress
  - Chỉ xem dữ liệu liên quan đến công việc của mình

### 7. **FARMER** - Nông dân
- **Mô tả**: Nhà cung cấp nguyên liệu thô từ nông nghiệp
- **Quyền hạn**:
  - Tạo và quản lý agricultural batches
  - Nhập harvest events
  - Cập nhật certifications của nông trại
  - Xem products và batches của mình
  - Giới hạn: chỉ xem dữ liệu liên quan đến nông trại

### 8. **AUDITOR** - Kiểm toán viên
- **Mô tả**: Kiểm toán độc lập, chỉ xem không sửa
- **Quyền hạn**:
  - **READ-ONLY** trên tất cả dữ liệu
  - Xem toàn bộ audit logs
  - Xuất compliance reports
  - Truy cập blockchain records
  - Không có quyền tạo/sửa/xóa bất kỳ dữ liệu nào

---

## Permissions Matrix

| Resource | System Admin | Admin | Factory Manager | Quality Inspector | Logistics Manager | Worker | Farmer | Auditor |
|----------|:------------:|:-----:|:---------------:|:-----------------:|:-----------------:|:------:|:------:|:-------:|
| **Users** | CRUD | CRU* | - | - | - | - | - | R |
| **Products** | CRUD | CRUD | RU | RU | R | R | R | R |
| **Locations** | CRUD | CRUD | RU | R | CRUD | R | R | R |
| **Batches** | CRUD | CRUD | CRUD | RU | R | R | CR* | R |
| **Events** | CRUD | CRUD | CRUD | CR* | CR* | CR | CR* | R |
| **Partners** | CRUD | CRUD | RU | R | RU | R | R | R |
| **Certifications** | CRUD | CRUD | RU | CRUD | R | R | RU* | R |
| **Shipments** | CRUD | CRUD | R | R | CRUD | R | R | R |
| **AI Queue** | CRUD | CRUD | RU | RU | R | - | - | R |
| **Analytics** | R | R | R | R | R | R | R | R |
| **Audit Logs** | R | R | R | - | - | - | - | R |
| **Settings** | CRUD | R | - | - | - | - | - | R |

**Chú thích:**
- C = Create, R = Read, U = Update, D = Delete
- `*` = Có giới hạn (VD: chỉ của mình, chỉ loại specific)
- `-` = Không có quyền

---

## Cấu trúc Database

### Bảng `users`
\`\`\`sql
- id (uuid, PK)
- email (text, unique)
- role (enum: system_admin, admin, factory_manager, quality_inspector, logistics_manager, worker, farmer, auditor)
- full_name (text)
- phone (text)
- organization_id (uuid, FK)
- is_active (boolean)
- created_at, updated_at
\`\`\`

### Bảng `permissions`
\`\`\`sql
- id (uuid, PK)
- name (text, unique)
- description (text)
- resource (text)
- action (text)
\`\`\`

### Bảng `role_permissions`
\`\`\`sql
- role (enum)
- permission_id (uuid, FK)
- PK: (role, permission_id)
\`\`\`

---

## Row Level Security (RLS) Policies

### Users Table
- System Admin: Toàn quyền
- Admin: Xem tất cả users trong org, tạo/sửa (trừ system_admin)
- Others: Chỉ xem profile của mình

### Batches Table
- System Admin, Admin, Factory Manager: CRUD
- Quality Inspector: Read + Update quality fields
- Others: Read only

### Events Table
- System Admin, Admin: CRUD tất cả
- Factory Manager: CRUD events của nhà máy
- Quality Inspector: Tạo quality events
- Logistics Manager: Tạo shipping events
- Worker, Farmer: Tạo events liên quan đến công việc
- Auditor: Read only

### Partners Table
- System Admin, Admin, Factory Manager: CRUD
- Others: Read only

---

## Middleware & Route Protection

### File: `/middleware.ts`
- Tự động kiểm tra authentication cho tất cả routes (trừ public)
- Redirect về `/auth/login` nếu chưa đăng nhập
- Lưu redirect URL trong searchParams

### Protected Routes:
- `/admin/*` - Chỉ system_admin và admin
- `/analytics` - Tất cả authenticated users
- `/audit` - system_admin, admin, auditor
- `/ai-review` - system_admin, admin, factory_manager, quality_inspector

---

## Sử dụng trong Code

### 1. Server-side (API Routes, Server Components)
\`\`\`typescript
import { checkPermission } from '@/lib/auth/permissions'

export async function GET(request: Request) {
  const user = await getCurrentUser()
  
  if (!checkPermission(user.role, 'users', 'read')) {
    return new Response('Forbidden', { status: 403 })
  }
  
  // Process request...
}
\`\`\`

### 2. Client-side (React Components)
\`\`\`typescript
import { useAuth, usePermission } from '@/lib/auth/hooks'

export default function MyComponent() {
  const { user, isAdmin } = useAuth()
  const canCreate = usePermission('products', 'create')
  
  return (
    <div>
      {canCreate && <Button>Tạo sản phẩm mới</Button>}
    </div>
  )
}
\`\`\`

### 3. Permission Gates
\`\`\`typescript
import { RequirePermission, RequireRole } from '@/components/auth/permission-gate'

// Yêu cầu permission cụ thể
<RequirePermission action="create_product">
  <CreateProductForm />
</RequirePermission>

// Yêu cầu role cụ thể
<RequireRole roles={['system_admin', 'admin']}>
  <AdminPanel />
</RequireRole>
\`\`\`

---

## API Endpoints mới

### `/api/users` - User Management
- `GET` - Danh sách users (phân quyền theo role)
- `POST` - Tạo user mới (system_admin, admin)
- `PATCH /api/users/[id]` - Cập nhật user
- `DELETE /api/users/[id]` - Xóa user

### `/api/permissions` - Permission Management
- `GET` - Danh sách permissions
- `GET /api/permissions/[role]` - Permissions của role

---

## Pages mới

### `/admin/users` - User Management Dashboard
- Danh sách người dùng với filter theo role
- Tạo/sửa/xóa users
- Active/Deactivate users
- Xem chi tiết permissions

### `/admin/settings` - System Settings
- Cấu hình hệ thống
- AI features toggle
- QR code settings
- Security settings

---

## Migration Scripts

### `006-enhanced-rbac-system.sql`
- Thêm các roles mới
- Tạo bảng permissions và role_permissions
- Cập nhật RLS policies
- Seed initial permissions

---

## Best Practices

1. **Luôn kiểm tra permissions** ở cả client và server
2. **Sử dụng RLS policies** cho database security
3. **Log tất cả sensitive actions** trong audit_log
4. **Principle of Least Privilege**: Chỉ cấp quyền tối thiểu cần thiết
5. **Review permissions định kỳ**: Đảm bảo users chỉ có quyền cần thiết

---

## Testing Checklist

- [ ] System Admin có thể quản lý tất cả users
- [ ] Admin không thể sửa System Admin
- [ ] Worker chỉ tạo được events, không xóa
- [ ] Auditor chỉ read, không create/update/delete
- [ ] RLS policies hoạt động đúng
- [ ] Middleware redirect đúng routes
- [ ] Permission gates ẩn/hiện UI đúng

---

## Roadmap

### Phase 2 (Tương lai)
- [ ] Organization-based multi-tenancy
- [ ] Custom permissions per organization
- [ ] API keys và OAuth2 integration
- [ ] Two-factor authentication (2FA)
- [ ] Permission delegation
- [ ] Time-based access (temporary permissions)
