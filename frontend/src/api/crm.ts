import { apiClient } from './client';

export type CustomerType = 'REGULAR' | 'VIP' | 'CORPORATE';
export type ComplaintSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'REJECTED';

export interface Customer { id:string; phone:string; name:string; email?:string; customer_type:CustomerType; total_orders:number; total_spent:number; loyalty_points:number; is_active:boolean; notes?:string; }
export interface Complaint { id:string; complaint_number:string; branch_id:string; customer_id?:string; order_id?:string; category:string; severity:ComplaintSeverity; status:ComplaintStatus; description:string; assigned_to?:string; investigation?:string; action_taken?:string; resolution?:string; compensation_amount:number; root_cause?:string; management_review?:string; created_at:string; resolved_at?:string; }

export const crmApi = {
  customers: async (q?:string) => (await apiClient.get<Customer[]>('/crm/customers', { params: q ? { q } : {} })).data,
  createCustomer: async (payload: Partial<Customer> & {phone:string;name:string}) => (await apiClient.post<Customer>('/crm/customers', payload)).data,
  updateCustomer: async (id:string, payload:Partial<Customer>) => (await apiClient.put<Customer>(`/crm/customers/${id}`, payload)).data,
  orders: async (id:string) => (await apiClient.get<any[]>(`/crm/customers/${id}/orders`)).data,
  loyalty: async (id:string, points:number, description?:string) => (await apiClient.post<Customer>(`/crm/customers/${id}/loyalty`, { points, description })).data,
  complaints: async (status?:ComplaintStatus) => (await apiClient.get<Complaint[]>('/crm/complaints', { params: status ? { status } : {} })).data,
  complaintStats: async () => (await apiClient.get<Record<string,number>>('/crm/complaints/stats')).data,
  createComplaint: async (payload:any) => (await apiClient.post<Complaint>('/crm/complaints', payload)).data,
  updateComplaint: async (id:string, payload:any) => (await apiClient.patch<Complaint>(`/crm/complaints/${id}`, payload)).data,
};
