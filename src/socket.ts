import { io } from 'socket.io-client';

// Use same host/port. VITE intercepts path if not specified
// In production it will be same origin.
export const socket = io({
  autoConnect: false
});
