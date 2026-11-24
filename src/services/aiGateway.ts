import { BeneficiaryProfile, SupportedLanguage } from '../types';

export type VoiceAppAction =
  | 'detect_gps'
  | 'refresh_location_data'
  | 'change_language'
  | 'open_opportunity'
  | 'save_opportunity'
  | 'start_assessment'
  | null;

export interface VoiceChatResponse {
  fallback?: boolean;
  reply?: string;
  spokenReply?: string;
  targetView?: string | null;
  actionHighlight?: string | null;
  appAction?: VoiceAppAction;
  actionPayload?: {
    language?: SupportedLanguage;
    index?: number;
    opportunityTitle?: string;
  } | null;
  profileUpdates?: Record<string, string> | null;
  error?: string;
}

/**
 * Returns the normalized Cloudflare Worker base URL if configured via VITE_CLOUDFLARE_WORKER_URL.
 * Supports either base origin ("https://jeevika-worker.example.workers.dev")
 * or a full endpoint URL ("https://jeevika-worker.example.workers.dev/api/chat") by stripping trailing /api/*.
 */
export function getCloudflareWorkerBaseUrl(): string {
  try {
    const raw = String((import.meta as any).env?.VITE_CLOUDFLARE_WORKER_URL || '').trim();
    if (!raw) return '';
    return raw.replace(/\/api\/[a-z0-9/_-]*$/i, '').replace(/\/+$/, '');
  } catch {
    return '';
  }
}

export function isCloudflareWorkerConfigured(): boolean {
  return Boolean(getCloudflareWorkerBaseUrl());
}

/**
 * Calls a JeevikaAI backend endpoint via Cloudflare Worker (when VITE_CLOUDFLARE_WORKER_URL is set)
 * with automatic fallback to local Express /api/* routes during local development or AI Studio preview.
 */
async function postAiRoute<T = any>(
  apiPath: string,
  payload: Record<string, unknown>,
  timeoutMs = 20000
): Promise<T | null> {
  const normalizedPath = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  const workerBase = getCloudflareWorkerBaseUrl();
  const body = JSON.stringify(payload);

  // Build ordered endpoint list:
  // - If VITE_CLOUDFLARE_WORKER_URL is configured, try Worker first, then local /api/* fallback.
  // - Otherwise call local Express /api/* directly.
  const endpoints: string[] = workerBase
    ? [`${workerBase}${normalizedPath}`, normalizedPath]
    : [normalizedPath];

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Jeevika-Client': 'jeevika-web-v1',
  };

  for (const url of endpoints) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        continue;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        continue;
      }

      const data = (await response.json()) as T;
      return data;
    } catch {
      clearTimeout(timer);
      continue;
    }
  }

  return null;
}

export const aiGateway = {
  generateLocationData(params: {
    location: string;
    district: string;
    state: string;
    locality?: string;
    pincode?: string;
    language: SupportedLanguage;
    existingProfile?: Partial<BeneficiaryProfile> | null;
  }) {
    return postAiRoute<{ fallback?: boolean; result?: any; error?: string }>(
      '/api/generate-location-data',
      {
        location: params.location,
        district: params.district,
        state: params.state,
        locality: params.locality || '',
        pincode: params.pincode || '',
        language: params.language,
        existingProfile: params.existingProfile || {},
      },
      26000
    );
  },

  chat(params: {
    message: string;
    language: SupportedLanguage;
    currentView: string;
    userProfile?: Partial<BeneficiaryProfile> | null;
    chatHistory?: Array<{ sender: 'user' | 'ai'; text: string }>;
    locationData?: Record<string, unknown> | null;
  }) {
    return postAiRoute<VoiceChatResponse>(
      '/api/chat',
      {
        message: params.message,
        language: params.language,
        currentView: params.currentView,
        userProfile: params.userProfile || {},
        chatHistory: params.chatHistory || [],
        locationData: params.locationData || null,
      },
      18000
    );
  },

  analyzeProfile(params: {
    profile: Partial<BeneficiaryProfile>;
    language: SupportedLanguage;
  }) {
    return postAiRoute<{ fallback?: boolean; analysis?: any }>(
      '/api/analyze-profile',
      {
        profile: params.profile,
        language: params.language,
      },
      15000
    );
  },

  extractProfile(params: {
    message: string;
    language: SupportedLanguage;
    currentStep: string;
    existingProfile?: Partial<BeneficiaryProfile>;
    stepQuestion?: string;
  }) {
    return postAiRoute<{ fallback?: boolean; result?: any }>(
      '/api/extract-profile',
      params,
      12000
    );
  },

  parseSpeech(params: {
    message: string;
    language: SupportedLanguage;
    currentProfile?: Partial<BeneficiaryProfile>;
    stepKey?: string;
  }) {
    return postAiRoute<{
      fallback?: boolean;
      updatedProfile?: Partial<BeneficiaryProfile>;
      updatedProfileFields?: Partial<BeneficiaryProfile>;
      summary?: string;
      reply?: string;
    }>('/api/parse-speech', params, 12000);
  },

  generateReadback(params: {
    profile: Partial<BeneficiaryProfile>;
    language: SupportedLanguage;
  }) {
    return postAiRoute<{ fallback?: boolean; readbackText?: string }>(
      '/api/generate-readback',
      params,
      12000
    );
  },
};
