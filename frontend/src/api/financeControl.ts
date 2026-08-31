import { apiClient } from './client';
export const financeControlApi={
 summary:async()=> (await apiClient.get('/finance-control/summary')).data,
 expenses:async(params?:any)=> (await apiClient.get('/finance-control/expenses',{params})).data,
 createExpense:async(p:any)=> (await apiClient.post('/finance-control/expenses',p)).data,
 approveExpense:async(id:string)=> (await apiClient.post(`/finance-control/expenses/${id}/approve`)).data,
 reconciliations:async()=> (await apiClient.get('/finance-control/reconciliations')).data,
 createReconciliation:async(p:any)=> (await apiClient.post('/finance-control/reconciliations',p)).data,
 closeReconciliation:async(id:string)=> (await apiClient.post(`/finance-control/reconciliations/${id}/close`)).data,
 accounts:async()=> (await apiClient.get('/finance/accounts')).data,
};
