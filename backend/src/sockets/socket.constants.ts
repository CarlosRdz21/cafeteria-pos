export const SOCKET_ROOMS = {
  admins: 'admins',
  baristas: 'baristas',
  waiters: 'waiters',
} as const;

export const SOCKET_EVENTS = {
  newOrder: 'new-order',
  orderUpdated: 'order-updated',
  orderCancelled: 'order-cancelled',
} as const;

export type SocketRoom = typeof SOCKET_ROOMS[keyof typeof SOCKET_ROOMS];
