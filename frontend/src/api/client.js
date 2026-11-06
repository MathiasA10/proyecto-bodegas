import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || '/api/';

let accessToken = null;
let refreshPromise = null;

const refreshApi = axios.create({ baseURL, withCredentials: true });
const api = axios.create({ baseURL, withCredentials: true });

export const API_ORIGIN = new URL(baseURL, window.location.origin).origin;

export function mediaUrl(path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}${path}`;
}

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

// Endpoints que nunca requieren token (login/registro/refresh/recuperación)
const PUBLIC_ENDPOINTS = [
  'auth/login/',
  'auth/register/bodeguero/',
  'auth/refresh/',
  'auth/logout/',
  'auth/password-reset/',
];

function esEndpointPublico(url = '') {
  const normalizada = url.replace(/^\/+/, '');
  return PUBLIC_ENDPOINTS.some((endpoint) => normalizada.startsWith(endpoint));
}

async function renovarAccessToken() {
  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post('auth/refresh/')
      .then((res) => {
        setAccessToken(res.data.access);
        return res.data.access;
      })
      .catch((error) => {
        setAccessToken(null);
        window.dispatchEvent(new Event('auth:logout'));
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (!esEndpointPublico(config.url) && accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !esEndpointPublico(original.url)
    ) {
      original._retry = true;
      try {
        const token = await renovarAccessToken();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
