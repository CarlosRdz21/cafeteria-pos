import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { BehaviorSubject, Subject } from 'rxjs';
import { AuthService } from './auth.service';
import { getServerUrl } from '../config/server.config';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket?: Socket;
  private serverUrl = getServerUrl();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  connected$ = this.connectedSubject.asObservable();

  // Eventos del sistema
  newOrderNotification$ = new Subject<any>();
  orderUpdatedNotification$ = new Subject<any>();
  orderCancelledNotification$ = new Subject<number>();

  constructor(private authService: AuthService) {}

  setServerUrl(url: string) {
    this.serverUrl = url;
    localStorage.setItem('serverUrl', url);
  }

  connect() {
    if (this.socket?.connected) return;

    const token = this.authService.token;
    if (!token) return;

    this.socket = io(this.serverUrl, {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('🔌 Socket conectado');
      this.connectedSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket desconectado');
      this.connectedSubject.next(false);
    });

    // 🔔 Eventos del backend
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
    this.socket?.disconnect();
    this.connectedSubject.next(false);
  }

  isConnected(): boolean {
    return !!this.socket?.connected;
  }
}
