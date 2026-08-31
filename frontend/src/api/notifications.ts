import { apiClient } from './client';
export interface TelegramStatus { configured:boolean; default_chat_configured:boolean; channel:string; free_bot_api:boolean; webhook_configured:boolean; inbound_authentication:string; }
export interface TelegramNotification { id:string; branchId?:string; channel:string; chatId:string; title?:string; message:string; status:string; attempts:number; lastError?:string; sentAt?:string; eventType?:string; createdAt:string; }
export interface TelegramLink { id:string; chat_id:string; user_id:string; branch_id?:string; username?:string; is_active:boolean; last_seen_at?:string; }
export const notificationsApi = {
  status: async () => (await apiClient.get('/notifications/status')).data.data as TelegramStatus,
  test: async (chat_id:string, message:string) => (await apiClient.post('/notifications/test',{chat_id,message})).data.data,
  queue: async (payload:any) => (await apiClient.post('/notifications/queue',payload)).data.data as TelegramNotification,
  history: async (status?:string) => (await apiClient.get('/notifications/history',{params: status?{status}: {}})).data.data as TelegramNotification[],
  retry: async (id:string) => (await apiClient.post(`/notifications/retry/${id}`)).data.data as TelegramNotification,
  links: async () => (await apiClient.get('/notifications/telegram/links')).data.data as TelegramLink[],
  link: async (payload:any) => (await apiClient.post('/notifications/telegram/link',payload)).data.data as TelegramLink,
  unlink: async (id:string) => (await apiClient.delete(`/notifications/telegram/links/${id}`)).data.data,
  configureWebhook: async (public_url?:string) => (await apiClient.post('/notifications/telegram/webhook/configure',public_url?{public_url}:{})).data.data,
  removeWebhook: async () => (await apiClient.delete('/notifications/telegram/webhook')).data.data,
};
