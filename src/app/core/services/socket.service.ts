import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { getServerUrl, guardarUrlServidorLocal } from '../config/server.config';
import { Order } from '../../shared/models/domain.models';

type OrderSocketNotification = Order & { message?: string };

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;
  private serverUrl = getServerUrl();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  newOrderNotification$ = new Subject<OrderSocketNotification>();
  orderUpdatedNotification$ = new Subject<OrderSocketNotification>();
  orderCancelledNotification$ = new Subject<number>();

  constructor(private authService: AuthService) {}

  setServerUrl(url: string) {
    this.serverUrl = guardarUrlServidorLocal(url);
  }

  connect() {
    if (this.socket?.connected) return;

    const token = this.authService.token;
    if (!token) return;

    this.disconnect();
    this.socket = io(this.serverUrl, {
      auth: { token }
    });

    this.socket.on('connect', () => {
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connectedSubject.next(false);
    });

    this.socket.on('connect_error', error => {
      this.connectedSubject.next(false);
      if (error.message === 'Invalid token' || error.message === 'Unauthorized') {
        this.authService.logout();
        this.disconnect();
      }
    });

    this.socket.on('new-order', order => {
      this.newOrderNotification$.next(order);
    });

    this.socket.on('order-updated', order => {
      this.orderUpdatedNotification$.next(order);
    });

    this.socket.on('order-cancelled', orderId => {
      this.orderCancelledNotification$.next(orderId);
    });
  }

  disconnect() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
    this.connectedSubject.next(false);
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}
