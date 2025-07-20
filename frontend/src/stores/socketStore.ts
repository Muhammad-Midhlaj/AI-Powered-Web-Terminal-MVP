import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore';

interface SocketState {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  
  // Actions
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data?: any) => void;
}

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  connectionError: null,

  connect: () => {
    const { token } = useAuthStore.getState();
    
    if (!token) {
      set({ connectionError: 'No authentication token available' });
      return;
    }

    if (get().socket?.connected) {
      return; // Already connected
    }

    const socket = io('http://localhost:5000', {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      set({ 
        isConnected: true, 
        connectionError: null,
        socket
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ 
        isConnected: false,
        socket: null
      });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      set({ 
        connectionError: error.message,
        isConnected: false,
        socket: null
      });
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ 
        socket: null, 
        isConnected: false,
        connectionError: null
      });
    }
  },

  emit: (event: string, data?: any) => {
    const { socket, isConnected } = get();
    if (socket && isConnected) {
      socket.emit(event, data);
    } else {
      console.warn('Cannot emit event: socket not connected');
    }
  }
})); 