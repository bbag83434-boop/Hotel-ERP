export interface Role {
  id: string;
  name: string;
  permissions: string[];
}

export interface Company {
  id: string;
  name: string;
  code: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  type: 'RESTAURANT' | 'HOTEL' | 'HYBRID';
  isDefault?: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName?: string;
  avatarUrl?: string;
  role: Role;
  company: Company | null;
  branches: Branch[];
  defaultBranch: Branch | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedBranchId: string | null;
}
