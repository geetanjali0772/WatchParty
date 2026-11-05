import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Send and receive HttpOnly cookies
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF protection for cookie-authenticated requests
  },
});

// Request interceptor ensuring standard anti-CSRF headers on every request
apiClient.interceptors.request.use((config) => {
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  return config;
});

// Response interceptor to detect and handle expired or unauthorized sessions
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('watchparty_session_expired', {
            detail: { message: error.response?.data?.message || 'Session expired' },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const createSession = async ({ username }) => {
  const response = await apiClient.post('/auth/session', { username });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};

export const logoutSession = async () => {
  const response = await apiClient.post('/auth/logout');
  return response.data;
};

// Room API
export const createRoom = async ({ roomName }) => {
  const response = await apiClient.post('/rooms', { roomName });
  return response.data;
};

export const getRoom = async (roomId) => {
  const response = await apiClient.get(`/rooms/${roomId}`);
  return response.data;
};

export const joinRoom = async (roomId, { hostToken } = {}) => {
  const response = await apiClient.post(`/rooms/${roomId}/join`, { hostToken });
  return response.data;
};

export const getParticipants = async (roomId) => {
  const response = await apiClient.get(`/rooms/${roomId}/participants`);
  return response.data;
};

export const getRoomMessages = async (roomId, limit = 50) => {
  const response = await apiClient.get(`/rooms/${roomId}/messages?limit=${limit}`);
  return response.data;
};

export const updateRoomTitle = async (roomId, { roomName }) => {
  const response = await apiClient.patch(`/rooms/${roomId}`, { roomName });
  return response.data;
};

export default apiClient;
