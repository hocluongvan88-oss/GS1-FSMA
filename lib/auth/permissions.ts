/**
 * Role-Based Access Control (RBAC) System
 * Hệ thống phân quyền cho nền tảng traceability
 */

export type UserRole = 
  | 'system_admin'      // Quản trị toàn hệ thống
  | 'admin'             // Quản trị doanh nghiệp
  | 'factory_manager'   // Quản lý nhà máy
  | 'quality_inspector' // Thanh tra chất lượng
  | 'logistics_manager' // Quản lý vận chuyển
  | 'worker'            // Công nhân
  | 'farmer'            // Nông dân
  | 'auditor'           // Kiểm toán viên (chỉ đọc)
  | 'customer'          // Khách hàng (xem qua QR code)

export type Permission = 
  // System Management
  | 'system:manage_users'
  | 'system:manage_roles'
  | 'system:view_logs'
  | 'system:manage_settings'
  
  // Master Data Management
  | 'master:manage_products'
  | 'master:manage_locations'
  | 'master:manage_partners'
  | 'master:view_products'
  | 'master:view_locations'
  | 'master:view_partners'
  
  // Event Management
  | 'event:create'
  | 'event:edit_own'
  | 'event:edit_all'
  | 'event:delete'
  | 'event:view_all'
  | 'event:approve'
  
  // Batch Management
  | 'batch:create'
  | 'batch:edit'
  | 'batch:delete'
  | 'batch:view_all'
  
  // Quality & Certification
  | 'quality:inspect'
  | 'quality:approve'
  | 'quality:reject'
  | 'cert:manage'
  | 'cert:view'
  
  // Shipment & Logistics
  | 'shipment:create'
  | 'shipment:edit'
  | 'shipment:view_all'
  | 'shipment:track'
  
  // AI Processing
  | 'ai:submit_voice'
  | 'ai:submit_vision'
  | 'ai:review_results'
  | 'ai:approve_results'
  
  // Analytics & Reports
  | 'analytics:view_dashboard'
  | 'analytics:view_advanced'
  | 'analytics:export'
  
  // Audit Trail
  | 'audit:view_all'
  | 'audit:export'

/**
 * Role permissions mapping
 * Định nghĩa quyền cho từng role
 */
export const rolePermissions: Record<UserRole, Permission[]> = {
  system_admin: [
    // Full system access
    'system:manage_users',
    'system:manage_roles',
    'system:view_logs',
    'system:manage_settings',
    'master:manage_products',
    'master:manage_locations',
    'master:manage_partners',
    'master:view_products',
    'master:view_locations',
    'master:view_partners',
    'event:create',
    'event:edit_all',
    'event:delete',
    'event:view_all',
    'event:approve',
    'batch:create',
    'batch:edit',
    'batch:delete',
    'batch:view_all',
    'quality:inspect',
    'quality:approve',
    'quality:reject',
    'cert:manage',
    'cert:view',
    'shipment:create',
    'shipment:edit',
    'shipment:view_all',
    'shipment:track',
    'ai:submit_voice',
    'ai:submit_vision',
    'ai:review_results',
    'ai:approve_results',
    'analytics:view_dashboard',
    'analytics:view_advanced',
    'analytics:export',
    'audit:view_all',
    'audit:export',
  ],

  admin: [
    // Business admin - quản lý doanh nghiệp
    'master:manage_products',
    'master:manage_locations',
    'master:manage_partners',
    'master:view_products',
    'master:view_locations',
    'master:view_partners',
    'event:create',
    'event:edit_all',
    'event:view_all',
    'event:approve',
    'batch:create',
    'batch:edit',
    'batch:view_all',
    'quality:approve',
    'cert:manage',
    'cert:view',
    'shipment:create',
    'shipment:edit',
    'shipment:view_all',
    'ai:review_results',
    'ai:approve_results',
    'analytics:view_dashboard',
    'analytics:view_advanced',
    'analytics:export',
    'audit:view_all',
  ],

  factory_manager: [
    // Factory operations management
    'master:view_products',
    'master:view_locations',
    'master:view_partners',
    'event:create',
    'event:edit_own',
    'event:view_all',
    'batch:create',
    'batch:edit',
    'batch:view_all',
    'quality:inspect',
    'cert:view',
    'shipment:create',
    'shipment:view_all',
    'ai:submit_voice',
    'ai:submit_vision',
    'ai:review_results',
    'analytics:view_dashboard',
  ],

  quality_inspector: [
    // Quality control specialist
    'master:view_products',
    'master:view_locations',
    'event:view_all',
    'batch:view_all',
    'quality:inspect',
    'quality:approve',
    'quality:reject',
    'cert:manage',
    'cert:view',
    'analytics:view_dashboard',
  ],

  logistics_manager: [
    // Shipping and logistics
    'master:view_locations',
    'master:view_partners',
    'event:create',
    'event:view_all',
    'batch:view_all',
    'shipment:create',
    'shipment:edit',
    'shipment:view_all',
    'shipment:track',
    'analytics:view_dashboard',
  ],

  worker: [
    // Factory worker - nhập dữ liệu cơ bản
    'master:view_products',
    'event:create',
    'event:edit_own',
    'event:view_all',
    'batch:view_all',
    'ai:submit_voice',
    'ai:submit_vision',
  ],

  farmer: [
    // Farmer - nhập dữ liệu sản xuất
    'master:view_products',
    'event:create',
    'event:edit_own',
    'event:view_all',
    'batch:view_all',
    'ai:submit_voice',
    'ai:submit_vision',
  ],

  auditor: [
    // Read-only auditor
    'master:view_products',
    'master:view_locations',
    'master:view_partners',
    'event:view_all',
    'batch:view_all',
    'cert:view',
    'shipment:view_all',
    'analytics:view_dashboard',
    'analytics:view_advanced',
    'audit:view_all',
    'audit:export',
  ],

  customer: [
    // Public customer - chỉ xem qua QR code
    'event:view_all',
    'cert:view',
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Role hierarchy - for privilege escalation checks
 */
export const roleHierarchy: Record<UserRole, number> = {
  system_admin: 100,
  admin: 80,
  factory_manager: 60,
  quality_inspector: 50,
  logistics_manager: 50,
  worker: 30,
  farmer: 30,
  auditor: 20,
  customer: 10,
}

/**
 * Check if role1 has higher privilege than role2
 */
export function hasHigherPrivilege(role1: UserRole, role2: UserRole): boolean {
  return roleHierarchy[role1] > roleHierarchy[role2]
}

/**
 * Get user-friendly role name in Vietnamese
 */
export const roleNames: Record<UserRole, string> = {
  system_admin: 'Quản trị hệ thống',
  admin: 'Quản trị doanh nghiệp',
  factory_manager: 'Quản lý nhà máy',
  quality_inspector: 'Thanh tra chất lượng',
  logistics_manager: 'Quản lý vận chuyển',
  worker: 'Công nhân',
  farmer: 'Nông dân',
  auditor: 'Kiểm toán viên',
  customer: 'Khách hàng',
}

/**
 * Get role description in Vietnamese
 */
export const roleDescriptions: Record<UserRole, string> = {
  system_admin: 'Toàn quyền quản lý hệ thống, users và cấu hình',
  admin: 'Quản lý toàn bộ hoạt động doanh nghiệp',
  factory_manager: 'Quản lý hoạt động sản xuất tại nhà máy',
  quality_inspector: 'Kiểm tra và phê duyệt chất lượng sản phẩm',
  logistics_manager: 'Quản lý vận chuyển và chuỗi cung ứng',
  worker: 'Nhập dữ liệu sản xuất và sự kiện',
  farmer: 'Nhập dữ liệu canh tác và thu hoạch',
  auditor: 'Xem và kiểm toán dữ liệu (chỉ đọc)',
  customer: 'Xem thông tin truy xuất nguồn gốc',
}
