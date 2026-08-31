import { apiClient } from './client';

export interface AIProviderStatus {
  default_provider: string;
  configured_providers: string[];
  available: boolean;
  timeout_seconds: number;
}

export const aiProviderApi = {
  status: async () => (await apiClient.get('/ai-provider/providers')).data.data as AIProviderStatus,
  generate: async (payload: { messages: { role: string; content: string }[]; provider?: string; temperature?: number; max_tokens?: number }) =>
    (await apiClient.post('/ai-provider/generate', payload)).data.data,
};
