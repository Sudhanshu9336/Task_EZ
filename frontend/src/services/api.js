
import axios from 'axios';

// Use environment variable for API URL or fallback to local
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://vernan-backend.onrender.com/api'
  : 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    
    if (error.response) {
      // Server responded with error status
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received:', error.request);
    } else {
      // Something else happened
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export const contactAPI = {
  submitForm: async (formData) => {
    try {
      const response = await api.post('/contact-us', formData);
      return response;
    } catch (error) {
      throw error;
    }
  },

  getContacts: async () => {
    try {
      const response = await api.get('/contacts');
      return response;
    } catch (error) {
      throw error;
    }
  },

  getContactById: async (id) => {
    try {
      const response = await api.get(`/contacts/${id}`);
      return response;
    } catch (error) {
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response;
    } catch (error) {
      throw error;
    }
  }
};