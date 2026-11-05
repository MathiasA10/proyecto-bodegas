import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/';

const api = axios.create({ baseURL });

export const API_ORIGIN = new URL(baseURL, window.location.origin).origin;

export function mediaUrl(path) {
  if (!path) return null;
  return /^https?:\/\//i.test(path) ? path : `${API_ORIGIN}${path}`;
}

// Endpoints que nunca requieren token (login/registro/refresh)
const PUBLIC_ENDPOINTS = [
  'auth/login/',
  'auth/register/bodeguero/',
  'auth/refresh/',
  'auth/password-reset/',
];

function esEndpointPublico(url = '') {
  const normalizada = url.replace(/^\/+/, '');
  return PUBLIC_ENDPOINTS.some((endpoint) => normalizada.startsWith(endpoint));
}

api.interceptors.request.use((config) => {
  if (!esEndpointPublico(config.url)) {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_rol');
      localStorage.removeItem('user_nombre');
      localStorage.removeItem('user_id');
    }
    return Promise.reject(error);
  }
);

export default api;
