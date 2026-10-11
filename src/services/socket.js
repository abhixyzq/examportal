import { io } from 'socket.io-client';

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Only attempt socket connection on localhost or if a custom secure socket server is explicitly configured
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (isLocalhost ? 'http://localhost:5000' : null);

let socket = null;

// Safe mock socket for environments without a dedicated WebSocket server
const mockSocket = {
  emit: () => {},
  on: () => {},
  off: () => {},
  connect: () => {},
  disconnect: () => {},
};

export function getSocket() {
  if (!SOCKET_URL) {
    return mockSocket;
  }

  if (!socket) {
    try {
      socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1500,
      });

      socket.on('connect', () => {
        console.log('📡 Connected to Real-Time Proctoring Socket Server');
      });

      socket.on('disconnect', () => {
        console.log('🔌 Disconnected from Proctoring Socket Server');
      });
    } catch {
      return mockSocket;
    }
  }
  return socket || mockSocket;
}
