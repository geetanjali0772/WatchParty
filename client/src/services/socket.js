import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.replace(/\/+$/, '');
  }
  // Fall back to VITE_API_URL if defined with an absolute URL (strip trailing /api)
  if (import.meta.env.VITE_API_URL && /^https?:\/\//i.test(import.meta.env.VITE_API_URL)) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '').replace(/\/api$/, '');
  }
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
};

const SOCKET_URL = getSocketUrl();

let socketInstance = null;

export const getSocket = (token) => {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      withCredentials: true, // Automatically sends HttpOnly cookies (wp_token) in handshake
      auth: token ? { token } : {},
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  } else if (token) {
    socketInstance.auth = { token };
  }
  return socketInstance;
};

export const connectSocket = (token) => {
  const socket = getSocket(token);
  if (token) {
    socket.auth = { token };
  }
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};
