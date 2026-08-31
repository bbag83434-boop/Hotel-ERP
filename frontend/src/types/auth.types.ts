export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
}

export interface Company {
  id: string;
  name: string;
  code: string;
}

export interface BranchScopeInfo {
  id: string;
  name: string;
  code: string;
  type: string;
  is_default?: boolean;
  isDefault?: boolean;
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  first_name?: string;
  firstName?: string;
  last_name?: string;
  lastName?: string;
  avatarUrl?: string;
  role: string | Role;
  is_active?: boolean;
  isActive?: boolean;
  company_id?: string | null;
  companyId?: string | null;
  permissions: string[];
  assigned_branches?: BranchScopeInfo[];
  assignedBranches?: BranchScopeInfo[];
  active_branch?: BranchScopeInfo | null;
  activeBranch?: BranchScopeInfo | null;
}

export type User = UserProfile;

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedBranchId: string | null;
}
