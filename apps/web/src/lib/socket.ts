import { SOCKET_PATH, type ClientToServerEvents, type ServerToClientEvents } from '@livelog/shared';
import { io, type Socket } from 'socket.io-client';
import { authStore } from './auth';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;
let connectedAs: string | null = null;

/**
 * Where the API server lives when it is not on the page's own origin (e.g. web on Vercel,
 * API on Render). HTTP calls go through the host's /api rewrite, but rewrites cannot proxy
 * WebSockets, so the socket connects to the API directly. Unset → same origin.
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

/**
 * One shared connection per tab. The auth callback runs on every (re)connect,
 * so the server always sees the freshest access token.
 */
export function getSocket(): AppSocket {
  if (socket) return socket;
  connectedAs = authStore.get().user?.id ?? null;
  socket = io(SOCKET_URL, {
    path: SOCKET_PATH,
    transports: ['websocket', 'polling'],
    reconnectionDelay: 500,
    reconnectionDelayMax: 5_000,
    auth: (cb) => cb({ token: authStore.get().accessToken ?? '' }),
  });

  // Signing in or out changes what this socket may do, so re-handshake.
  authStore.subscribe(() => {
    const { status, user } = authStore.get();
    if (status === 'loading') return;
    const id = user?.id ?? null;
    if (id !== connectedAs && socket) {
      connectedAs = id;
      socket.disconnect().connect();
    }
  });
  return socket;
}
