import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from './authStore';
import { useTerminalStore } from './terminalStore';
import { SSHConnectionStatus } from '../../../shared/src/types';

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

    // Check if already connected
    const currentSocket = get().socket;
    if (currentSocket?.connected) {
      return; // Already connected
    }

    // Disconnect existing socket if present
    if (currentSocket) {
      currentSocket.disconnect();
      set({ socket: null, isConnected: false });
    }

    const socket = io('http://localhost:5000', {
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      forceNew: true, // Force new connection
      timeout: 5000
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

    // SSH connection status events
    socket.on('ssh:status', (data: { sessionId: string; status: SSHConnectionStatus; error?: string; profile?: any }) => {
      const { updateSessionStatus } = useTerminalStore.getState();
      updateSessionStatus(data.sessionId, data.status);
      
      if (data.error) {
        console.error('SSH connection error:', data.error);
      }
    });

    // Terminal output events  
    socket.on('terminal:output', (data: { sessionId: string; data: string }) => {
      // This will be handled by the Terminal component
      console.log('Terminal output for session', data.sessionId, ':', data.data);
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