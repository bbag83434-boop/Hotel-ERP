export interface UserRoleInfo {
  id: string;
  name: string;
  description?: string;
  is_system?: boolean;
}

export interface UserBranchDetail {
  id: string;
  branch_id: string;
  branch_name: string;
  branch_code: string;
  branch_type?: string;
  is_default?: boolean;
}

export interface ManagedUser {
  id: string;
  email: string;
  username?: string | null;
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  role_id: string;
  role_name: string;
  role?: UserRoleInfo | null;
  company_id?: string | null;
  is_active: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  branches: UserBranchDetail[];
}

export interface UserCreatePayload {
  email: string;
  first_name: string;
  last_name?: string;
  username?: string;
  phone?: string;
  role_id: string;
  branch_ids?: string[];
  default_branch_id?: string;
  password?: string;
  is_active?: boolean;
  company_id?: string;
}

export interface UserUpdatePayload {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role_id?: string;
  branch_ids?: string[];
  default_branch_id?: string;
  is_active?: boolean;
  password?: string;
}

export interface UserManagementSummary {
  total_users: number;
  active_users: number;
  inactive_users: number;
  super_admins: number;
  admins: number;
  managers: number;
  staff: number;
  roles: UserRoleInfo[];
}

export interface UserFilterParams {
  search?: string;
  role_id?: string;
  branch_id?: string;
  is_active?: boolean;
}
