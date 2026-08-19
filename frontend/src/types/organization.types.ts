export interface Company {
  id: string;
  name: string;
  code: string;
  email?: string;
  phone?: string;
  address?: string;
  logo_url?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  type: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StoreLocation {
  id: string;
  warehouse_id: string;
  item_id?: string;
  aisle?: string;
  rack?: string;
  shelf?: string;
  bin?: string;
  capacity?: number;
  created_at?: string;
}

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  branch_id?: string;
  company_id?: string;
  is_central: boolean;
  is_active: boolean;
  locations?: StoreLocation[];
  created_at?: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  company_id?: string;
  branch_id?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Staff {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  designation: string;
  department?: string;
  branch_id: string;
  company_id?: string;
  user_id?: string;
  joining_date?: string;
  base_salary: number;
  hourly_rate: number;
  status: string;
  is_active: boolean;
  created_at?: string;
}

export interface BranchCreateInput {
  name: string;
  code: string;
  type?: string;
  email?: string;
  phone?: string;
  address?: string;
  company_id?: string;
  is_active?: boolean;
}

export interface WarehouseCreateInput {
  name: string;
  code: string;
  branch_id?: string;
  company_id?: string;
  is_central?: boolean;
  is_active?: boolean;
}

export interface DepartmentCreateInput {
  name: string;
  code: string;
  company_id?: string;
  branch_id?: string;
  is_active?: boolean;
}

export interface StaffCreateInput {
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  designation: string;
  department?: string;
  branch_id: string;
  company_id?: string;
  user_id?: string;
  joining_date?: string;
  base_salary?: number;
  hourly_rate?: number;
  status?: string;
  is_active?: boolean;
}
