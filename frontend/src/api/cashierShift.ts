import { apiClient } from './client';

export type CashMovementType = 'CASH_IN' | 'CASH_OUT' | 'CLOSING_DROP';
export type PaymentMethod = 'CASH' | 'UPI' | 'CARD';
export interface CashSession { id:string; sessionNumber:string; status:'OPEN'|'CLOSED'|'RECONCILED'; branchId:string; cashierId:string; openingFloat:number; openedAt:string; closedAt?:string|null; closingCash?:number|null; expectedCash:number; cashVariance?:number|null; totalCashSales:number; totalUpiSales:number; totalCardSales:number; notes?:string|null; varianceReason?:string|null; liveMetrics:{cashSales:number;upiSales:number;cardSales:number;cashIn:number;cashOut:number;safeDrops:number;expectedDrawerCash:number;ordersCount:number}; movements:Array<{id:string;movementType:string;amount:number;reason:string;orderId?:string|null;createdAt:string}>; }
export const cashierShiftApi={
 active:async(branchId?:string)=> (await apiClient.get<CashSession|null>('/cashier-shift/active',{params:{branch_id:branchId}})).data,
 open:async(payload:{branch_id:string;opening_float:number;notes?:string})=> (await apiClient.post<CashSession>('/cashier-shift/open',payload)).data,
 movement:async(sessionId:string,payload:{movement_type:CashMovementType;amount:number;reason:string})=> (await apiClient.post<CashSession>(`/cashier-shift/${sessionId}/movement`,payload)).data,
 close:async(sessionId:string,payload:{closing_cash:number;notes?:string;variance_reason?:string})=> (await apiClient.post<CashSession>(`/cashier-shift/${sessionId}/close`,payload)).data,
 reconcile:async(sessionId:string,notes:string)=> (await apiClient.post<CashSession>(`/cashier-shift/${sessionId}/reconcile`,{notes})).data,
 history:async(branchId?:string,status?:string)=> (await apiClient.get<CashSession[]>('/cashier-shift/history',{params:{branch_id:branchId,status}})).data,
};
