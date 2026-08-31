import { apiClient } from './client';

export type AIDocumentResult = {
  id: string; status: string; file_name: string; storage_ref?: string;
  extracted_data?: Record<string, any> | null; provider?: string | null; model?: string | null;
  is_duplicate?: boolean;
};

export const aiDocumentsApi = {
  upload: async (payload: { branch_id?: string; document_type?: string; file_name: string; file_type: string; file_base64: string; auto_extract?: boolean }) => {
    const res = await apiClient.post<{success: boolean; duplicate?: boolean; data: AIDocumentResult}>('/ai/documents/upload', payload);
    return res.data;
  },
  list: async (status_filter?: string) => {
    const res = await apiClient.get<{success: boolean; data: any[]}>('/ai/documents', { params: status_filter ? { status_filter } : {} });
    return res.data;
  },
};
