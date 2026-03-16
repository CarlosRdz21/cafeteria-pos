import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { AppliedPromotionSummary, Order } from '../models/domain.models';
import { buildApiUrl } from '../config/server.config';

@Injectable({ providedIn: 'root' })
export class PendingOrdersService {
  private get API() {
    return buildApiUrl('orders');
  }

  private pendingOrdersSubject = new BehaviorSubject<Order[]>([]);
  pendingOrders$ = this.pendingOrdersSubject.asObservable();

  constructor(private http: HttpClient) {}

  async loadPendingOrders() {
    this.http.get<Order[]>(`${this.API}?status=pending`)
      .subscribe(orders => this.pendingOrdersSubject.next(orders));
  }

  async createPendingOrder(payload: any) {
    return this.http.post<Order>(this.API, payload).toPromise();
  }

  async updatePendingOrder(orderId: number, items: any[]) {
    return this.http
      .patch<any>(`${this.API}/${orderId}/status`, {
        status: 'pending',
        items
      })
      .toPromise();
  }

  async cancelPendingOrder(orderId: number) {
    return this.http
      .patch(`${this.API}/${orderId}/cancel`, {})
      .toPromise();
  }

  async completePendingOrder(
    orderId: number,
    paymentMethod: 'cash' | 'card',
    items: any[],
    discountTotal?: number,
    appliedPromotions?: AppliedPromotionSummary[],
    amountPaid?: number,
    paymentDetails?: {
      provider?: string;
      reference?: string;
      metadata?: Record<string, unknown>;
    }
  ) {
    return this.http.patch(`${this.API}/${orderId}/status`, {
      status: 'completed',
      paymentMethod,
      items,
      discountTotal: discountTotal ?? 0,
      appliedPromotions: appliedPromotions ?? [],
      amountPaid,
      paymentDetails
    }).toPromise();
  }

  async getPendingOrder(orderId: number) {
    return this.http
      .get<any>(`${this.API}/${orderId}`)
      .toPromise();
  }
}


