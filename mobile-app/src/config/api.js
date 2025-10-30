/**
 * API Configuration
 * Axios instance for backend API calls
 */

import axios from 'axios';
import Config from 'react-native-config';
import {auth} from './firebase';

const API_BASE_URL = Config.API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async config => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      const token = await currentUser.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  response => {
    return response.data;
  },
  error => {
    if (error.response) {
      // Server responded with error
      const errorMessage = error.response.data?.message || error.response.data?.error || 'An error occurred';
      return Promise.reject(new Error(errorMessage));
    } else if (error.request) {
      // No response received
      return Promise.reject(new Error('Network error. Please check your connection'));
    } else {
      return Promise.reject(error);
    }
  }
);

export default api;
