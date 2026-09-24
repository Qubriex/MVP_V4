// src/utils/api.js
import axios from 'axios';

const api = axios.create({ baseURL: process.env.REACT_APP_API_BASE_URL || '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('qubirex_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('qubirex_token');
      localStorage.removeItem('qubirex_user');
      localStorage.removeItem('qubirex_role');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
