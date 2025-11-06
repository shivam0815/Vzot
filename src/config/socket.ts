// src/config/socket.ts
import { io, Socket } from 'socket.io-client';

type JoinPayload = { role?: 'admin'; userId?: string };

let socket: Socket | null = null;
// track what we've joined in THIS app session
let joined = { admin: false, userId: null as string | null };

// Always same-origin (.com in prod)
const SOCKET_URL = 'https://localhost:5000';


const getToken = () =>
  localStorage.getItem('adminToken') ||
  localStorage.getItem('token') ||
  '';

export function getSocket(): Socket {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
    timeout: 15000,
    auth: { token: getToken() },
  });

  // refresh token before each reconnect attempt
  socket.on('reconnect_attempt', () => {
    (socket as any).auth = { token: getToken() };
  });

  if (import.meta.env.DEV) {
    socket.on('connect', () => {
      console.log('🔌 [socket] connected:', socket?.id, '→', SOCKET_URL);
    });
    socket.on('disconnect', (reason) => {
      console.log('🔌 [socket] disconnected:', reason);
    });
    socket.on('connect_error', (err) => {
      console.warn('🔌 [socket] connect_error:', err?.message || err);
    });
    socket.on('reconnect_attempt', (n) => {
      console.log('🔁 [socket] reconnect attempt:', n);
    });
    socket.on('reconnect', (n) => {
      console.log('✅ [socket] reconnected on attempt:', n);
    });
  }

  return socket;
}

/** Emit joins ONLY after a successful connect, and only once per session. */
function joinOnConnect(payload: JoinPayload) {
  const s = getSocket();

  const doJoin = () => {
    // ADMIN
    if (payload.role === 'admin' && !joined.admin) {
      s.emit('join', { role: 'admin' } as JoinPayload);
      joined.admin = true;
      if (import.meta.env.DEV) console.log('👑 [socket] joined admin room once');
    }

    // USER
    if (payload.userId && joined.userId !== payload.userId) {
      s.emit('join', { userId: payload.userId } as JoinPayload);
      joined.userId = payload.userId;
      if (import.meta.env.DEV) console.log('👤 [socket] joined user room:', payload.userId);
    }
  };

  if (s.connected) {
    doJoin();
  } else {
    const handler = () => {
      s.off('connect', handler);
      doJoin();
    };
    s.on('connect', handler);
  }
}

export function joinAdminRoom(): void {
  joinOnConnect({ role: 'admin' });
}

export function joinUserRoom(userId: string): void {
  if (!userId) return;
  joinOnConnect({ userId });
}

export function closeSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  joined = { admin: false, userId: null };
}
