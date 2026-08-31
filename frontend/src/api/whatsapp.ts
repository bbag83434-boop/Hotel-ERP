import { apiClient } from './client';
export interface WhatsAppStatus { configured:boolean; channel:string; provider:string; webhook_configured:boolean; signature_verification:boolean; production_mode:boolean; }
export interface WhatsAppLink { id:string; wa_user_id:string; phone_number_id:string; user_id:string; branch_id?:string; display_name?:string; is_active:boolean; last_seen_at?:string; }
export const whatsappApi = {
 status: async()=> (await apiClient.get('/whatsapp/status')).data.data as WhatsAppStatus,
 links: async()=> (await apiClient.get('/whatsapp/links')).data.data as WhatsAppLink[],
 link: async(payload:any)=> (await apiClient.post('/whatsapp/link',payload)).data.data as WhatsAppLink,
 unlink: async(id:string)=> (await apiClient.delete(`/whatsapp/links/${id}`)).data.data,
 configure: async(public_url?:string)=> (await apiClient.post('/whatsapp/webhook/configure',public_url?{public_url}:{})).data.data,
};
