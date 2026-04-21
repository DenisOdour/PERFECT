import axios from 'axios';

// ── Base URL ───────────────────────────────────────────────────────
// Priority: env variable → hardcoded Render URL
const BASE_URL =
  process.env.REACT_APP_API_URL ||
  'https://perfect-backend.onrender.com';

const API = axios.create({
  baseURL: BASE_URL,
  timeout: 35000,  // 35s — Render free tier sleeps and takes ~20s to wake
  headers: { 'Content-Type': 'application/json' },
  // ⚠️  DO NOT set withCredentials: true
  // When withCredentials is true, the browser requires the server to respond
  // with the exact requesting origin (not *). Since we use wildcard CORS on
  // the backend, withCredentials causes a CORS failure on every request.
  // We use Authorization Bearer tokens instead — no cookies needed.
  withCredentials: false,
});

// ── Request interceptor — attach JWT ──────────────────────────────
API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mtaa_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor — friendly error messages ────────────────
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      // Network error / CORS / server down / Render cold start
      if (
        error.code === 'ERR_NETWORK' ||
        error.code === 'ERR_FAILED' ||
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('cors')
      ) {
        error.userMessage =
          'Cannot reach the server. The server may be waking up (this can take up to 20 seconds on free hosting). Please wait a moment and try again.';
      } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        error.userMessage =
          'Request timed out. The server is waking up — please try again in a few seconds.';
      } else {
        error.userMessage = error.message || 'Network error. Please check your connection.';
      }
    }

    if (error.response?.status === 401) {
      localStorage.removeItem('mtaa_token');
      localStorage.removeItem('mtaa_user');
    }

    return Promise.reject(error);
  }
);

export default API;
