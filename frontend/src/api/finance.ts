import { apiClient } from '@/api/client';
export const financeApi={
 summary:async()=> (await apiClient.get('/finance/summary')).data,
 accounts:async()=> (await apiClient.get('/finance/accounts')).data,
 journals:async()=> (await apiClient.get('/finance/journals')).data,
 createAccount:async(p:any)=> (await apiClient.post('/finance/accounts',p)).data,
 createJournal:async(p:any)=> (await apiClient.post('/finance/journals',p)).data,
 trialBalance:async(asOf?:string)=> (await apiClient.get('/finance/trial-balance',{params:{as_of:asOf}})).data,
 profitLoss:async(startDate:string,endDate:string)=> (await apiClient.get('/finance/profit-loss',{params:{start_date:startDate,end_date:endDate}})).data,
};
