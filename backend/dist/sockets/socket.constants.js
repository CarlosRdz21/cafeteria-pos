"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOCKET_EVENTS = exports.SOCKET_ROOMS = void 0;
exports.SOCKET_ROOMS = {
    admins: 'admins',
    baristas: 'baristas',
    waiters: 'waiters',
};
exports.SOCKET_EVENTS = {
    newOrder: 'new-order',
    orderUpdated: 'order-updated',
    orderCancelled: 'order-cancelled',
};
