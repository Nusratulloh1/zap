// Socket.IO — живой статус сплитов. Подключение и путь повторяют веб:
// namespace /realtime, engine-путь = префикс API + /socket.io, JWT в auth.
// В фоне сокет отключается (батарея), при возврате приложение переподключает
// его и перезапрашивает данные — пропущенное событие не оставляет старый UI.
import { io, type Socket } from 'socket.io-client';
import { API_URL } from '@/lib/env';
import { getTokens } from '@/api/client';

export type RealtimeEvent =
  | 'member_opened'
  | 'member_paid'
  | 'member_covered'
  | 'split_closed'
  | 'debt_settled'
  | 'cashback_awarded';

type Listener = (event: RealtimeEvent, payload: Record<string, unknown>) => void;

let socket: Socket | null = null;
const listeners = new Set<Listener>();
/** комнаты, в которые надо перевойти после reconnect */
const rooms = new Set<string>();

const EVENTS: RealtimeEvent[] = [
  'member_opened',
  'member_paid',
  'member_covered',
  'split_closed',
  'debt_settled',
  'cashback_awarded',
];

export function onRealtime(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function connectRealtime(): void {
  if (socket) return;
  const u = new URL(API_URL);
  const prefix = u.pathname.endsWith('/') ? u.pathname.slice(0, -1) : u.pathname;
  const tokens = getTokens();
  socket = io(u.origin + '/realtime', {
    path: (prefix === '/' ? '' : prefix) + '/socket.io',
    auth: tokens ? { token: tokens.accessToken } : {},
    transports: ['websocket'],
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  for (const ev of EVENTS) {
    socket.on(ev, (p: Record<string, unknown>) => listeners.forEach((fn) => fn(ev, p ?? {})));
  }
  socket.on('connect', () => {
    // после reconnect комнаты теряются — восстанавливаем
    for (const code of rooms) socket?.emit('join_split', { code });
  });
}

export function joinSplitRoom(code: string): void {
  rooms.add(code);
  connectRealtime();
  socket?.emit('join_split', { code });
}

export function disconnectRealtime(): void {
  socket?.disconnect();
  socket = null;
}
