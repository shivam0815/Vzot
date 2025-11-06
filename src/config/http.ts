import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'https://localhost:5000/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // keep true if you also use refresh cookies
});

const TOKEN_KEY = 'nakoda-token';

// attach token before each request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const setAuthHeader = (token?: string) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(TOKEN_KEY);
    delete api.defaults.headers.common.Authorization;
  }
};

export default api;
