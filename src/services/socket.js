import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('📡 Connected to Real-Time Proctoring Socket Server');
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Proctoring Socket Server');
    });
  }
  return socket;
}
