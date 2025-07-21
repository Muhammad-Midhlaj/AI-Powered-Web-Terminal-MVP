// API Configuration
export const API_BASE_URL = 'http://localhost:5000';

// API endpoints
export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/api/auth/login`,
    register: `${API_BASE_URL}/api/auth/register`,
    verify: `${API_BASE_URL}/api/auth/verify`,
    refresh: `${API_BASE_URL}/api/auth/refresh`,
  },
  profiles: {
    list: `${API_BASE_URL}/api/profiles`,
    create: `${API_BASE_URL}/api/profiles`,
    update: (id: string) => `${API_BASE_URL}/api/profiles/${id}`,
    delete: (id: string) => `${API_BASE_URL}/api/profiles/${id}`,
  },
  websocket: `${API_BASE_URL}`,
} as const;

// Helper function for API requests
export const apiRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = localStorage.getItem('auth-token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  return fetch(url, config);
}; 