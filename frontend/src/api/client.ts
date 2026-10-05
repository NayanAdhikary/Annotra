import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { useOrgStore } from '../store/orgStore';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30_000,
});

// ---------- Request: attach auth + org ----------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { accessToken } = useAuthStore.getState();
  const org = useOrgStore.getState().current;

  config.headers = config.headers ?? {};
  if (accessToken) {
    (config.headers as any).Authorization = `Bearer ${accessToken}`;
  }
  if (org) {
    (config.headers as any)['X-Org-Id'] = org.id;
  }
  return config;
});

// ---------- Response: silent refresh ----------
let refreshInFlight: Promise<string> | null = null;

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;

    // Attach a user-friendly message to every error
    attachUserMessage(err);

    if (!original || err.response?.status !== 401 || original._retried) {
      return Promise.reject(err);
    }

    const { refreshToken, setTokens, clear } = useAuthStore.getState();
    if (!refreshToken) {
      clear();
      return Promise.reject(err);
    }

    try {
      refreshInFlight =
        refreshInFlight ??
        (async () => {
          try {
            const { data } = await axios.post('/api/auth/refresh', {
              refresh_token: refreshToken,
            });
            setTokens(data.access_token, data.refresh_token);
            return data.access_token as string;
          } finally {
            refreshInFlight = null;
          }
        })();

      const fresh = await refreshInFlight;
      original._retried = true;
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${fresh}`;
      return api(original);
    } catch (refreshErr) {
      clear();
      window.location.assign('/login');
      return Promise.reject(refreshErr);
    }
  },
);

// ---------- Friendly messages ----------
function attachUserMessage(err: AxiosError) {
  const status = err.response?.status;
  const data = err.response?.data as any;
  const backendMessage =
    typeof data?.message === 'string' ? data.message :
    typeof data?.detail === 'string' ? data.detail : null;

  let userMessage = 'Something went wrong. Please try again.';

  if (!err.response) {
    if (err.code === 'ECONNABORTED') {
      userMessage = 'The request took too long. Check your connection and try again.';
    } else {
      userMessage = "Can't reach the server. Check your internet connection.";
    }
  } else if (status === 400 && backendMessage) {
    userMessage = backendMessage;
  } else if (status === 401) {
    userMessage = 'Your session expired. Please sign in again.';
  } else if (status === 403) {
    userMessage = "You don't have permission to do that.";
  } else if (status === 404) {
    userMessage = 'That item no longer exists.';
  } else if (status === 409) {
    userMessage = 'Someone else changed this. Reload the page and try again.';
  } else if (status === 422 && Array.isArray(data?.errors)) {
    userMessage = data.message ?? 'Please check the highlighted fields.';
  } else if (status === 423) {
    userMessage = 'This item is locked.';
  } else if (status === 429) {
    userMessage = 'Too many requests. Please wait a moment.';
  } else if (status && status >= 500) {
    userMessage = 'Server error. Our team has been notified.';
  } else if (backendMessage) {
    userMessage = backendMessage;
  }

  (err as any).userMessage = userMessage;
}

declare module 'axios' {
  interface AxiosError {
    userMessage?: string;
  }
}
