import axios from 'axios';

const TOKEN_KEY = 'algions_token';
export const tokenStore = {
  get: () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } },
  set: (t) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message); this.status = status; this.code = code; this.details = details; }
}

export const http = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res) => res,
  (error) => {
    if (!error.response) {
      return Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Cannot reach the server. Check your connection and try again.'));
    }
    const { status, data } = error.response;
    const e = data && data.error ? data.error : {};
    if (status === 401 && tokenStore.get() && e.code !== 'INVALID_CREDENTIALS') {
      tokenStore.clear();
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(new ApiError(status, e.code || 'ERROR', e.message || 'Something went wrong', e.details));
  }
);

/** Unwrap { success, data, meta } → { ...data, meta } */
export const unwrap = (res) => ({ ...res.data.data, meta: res.data.meta });

/** Turn an ApiError with field details into { field: message } for forms. */
export const fieldErrors = (err) => {
  const out = {};
  if (err && Array.isArray(err.details)) err.details.forEach((d) => { if (d.field && !out[d.field]) out[d.field] = d.message; });
  return out;
};
