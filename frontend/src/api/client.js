import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/',
});

// Endpoints que NO requieren token (públicos)
const PUBLIC_ENDPOINTS = [
  '/auth/login/',
  '/auth/register/bodeguero/',
  '/auth/refresh/',
];

// Adjunta el token JWT automáticamente si existe (excepto en endpoints públicos)
api.interceptors.request.use((config) => {
  const url = config.url || '';
  const isPublic = PUBLIC_ENDPOINTS.some(endpoint => url.includes(endpoint));
  
  if (!isPublic) {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;