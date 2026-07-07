import { Injectable } from '@angular/core';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AppliedPromotionSummary, Order, OrderItem, Product } from '../models/domain.models';
import { buildApiUrl } from '../config/server.config';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private readonly currentOrderStorageKey = 'cafeteria-pos.current-order';
  private currentOrderSubject = new BehaviorSubject<OrderItem[]>([]);
  public currentOrder$ = this.currentOrderSubject.asObservable();
  private readonly TAX_RATE = 0;

  constructor(private http: HttpClient) {
    this.restoreCurrentOrder();
  }

  addItem(product: Product, quantity: number = 1, customName?: string, customPrice?: number) {
    const currentItems = this.currentOrderSubject.value;
    const itemName = customName?.trim() || product.name;
    const itemPrice = customPrice ?? product.price;
    const existingItemIndex = currentItems.findIndex(
      item => this.getOrderItemKey(item) === this.getOrderItemKey({ productId: product.id!, name: itemName })
    );

    if (existingItemIndex >= 0) {
      currentItems[existingItemIndex].quantity += quantity;
      currentItems[existingItemIndex].subtotal = currentItems[existingItemIndex].quantity * currentItems[existingItemIndex].price;
    } else {
      currentItems.push({
        productId: product.id!,
        name: itemName,
        quantity,
        price: itemPrice,
        subtotal: itemPrice * quantity
      });
    }

    this.setCurrentOrder([...currentItems]);
  }

  updateItemQuantity(itemRef: number | Pick<OrderItem, 'productId' | 'name'>, quantity: number) {
    const currentItems = this.currentOrderSubject.value;
    const itemIndex = currentItems.findIndex(item => this.matchesItem(item, itemRef));
    if (itemIndex < 0) return;

    if (quantity <= 0) {
      currentItems.splice(itemIndex, 1);
    } else {
      currentItems[itemIndex].quantity = quantity;
      currentItems[itemIndex].subtotal = currentItems[itemIndex].price * quantity;
    }
    this.setCurrentOrder([...currentItems]);
  }

  removeItem(itemRef: number | Pick<OrderItem, 'productId' | 'name'>) {
    const currentItems = this.currentOrderSubject.value;
    this.setCurrentOrder(currentItems.filter(item => !this.matchesItem(item, itemRef)));
  }

  clearOrder() {
    this.setCurrentOrder([]);
  }

  calculateTotals() {
    const items = this.currentOrderSubject.value;
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }

  async createCompletedOrder(data: {
    items: any[];
    paymentMethod: 'cash' | 'card';
    amountPaid?: number;
    discountTotal?: number;
    appliedPromotions?: AppliedPromotionSummary[];
    paymentDetails?: {
      provider?: string;
      reference?: string;
      metadata?: Record<string, unknown>;
    };
  }) {
    if (!data.items || data.items.length === 0) {
      throw new Error('El pedido está vacío');
    }

    const subtotal = data.items.reduce((sum, item) => sum + item.subtotal, 0);
    const tax = subtotal * this.TAX_RATE;
    const total = subtotal + tax;
    if (data.paymentMethod === 'cash' && (data.amountPaid ?? 0) < total) {
      throw new Error('El monto pagado es insuficiente');
    }

    return this.http.post<any>(buildApiUrl('orders'), {
      items: data.items,
      status: 'completed',
      paymentMethod: data.paymentMethod,
      amountPaid: data.amountPaid,
      discountTotal: data.discountTotal ?? 0,
      appliedPromotions: data.appliedPromotions ?? [],
      paymentDetails: data.paymentDetails
    }).toPromise();
  }

  async completeOrder(
    paymentMethod: 'cash' | 'card',
    amountPaid?: number,
    paymentDetails?: {
      provider?: string;
      reference?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<number | null> {
    const created = await this.createCompletedOrder({
      items: this.currentOrderSubject.value,
      paymentMethod,
      amountPaid,
      paymentDetails
    });
    this.clearOrder();
    return created?.id ?? null;
  }

  async getCompletedOrders(limit: number = 50): Promise<Order[]> {
    const rows = await this.http.get<any[]>(buildApiUrl('orders'), {
      params: { status: 'completed' }
    }).toPromise();
    return (rows || []).slice(0, limit);
  }

  async deleteOrder(id: number): Promise<void> {
    await firstValueFrom(this.http.delete(buildApiUrl('orders/' + id)));
  }

  async getOrdersByDateRange(startDate: Date, endDate: Date): Promise<Order[]> {
    const rows = await this.getCompletedOrders(500);
    return rows.filter(order => {
      const t = new Date(order.createdAt).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
  }

  async getSalesStats(startDate: Date, endDate: Date) {
    const orders = await this.getOrdersByDateRange(startDate, endDate);
    const totalSales = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    const cashSales = orders.filter(o => o.paymentMethod === 'cash').reduce((sum, order) => sum + order.total, 0);
    const cardSales = orders.filter(o => o.paymentMethod === 'card').reduce((sum, order) => sum + order.total, 0);

    return {
      totalSales,
      totalOrders,
      cashSales,
      cardSales,
      averageTicket: totalOrders > 0 ? totalSales / totalOrders : 0
    };
  }

  getCurrentOrder(): OrderItem[] {
    return this.currentOrderSubject.value;
  }

  private setCurrentOrder(items: OrderItem[]): void {
    this.currentOrderSubject.next(items);
    try {
      if (items.length) {
        sessionStorage.setItem(this.currentOrderStorageKey, JSON.stringify(items));
      } else {
        sessionStorage.removeItem(this.currentOrderStorageKey);
      }
    } catch {
      // El flujo sigue funcionando aunque el navegador bloquee sessionStorage.
    }
  }

  private restoreCurrentOrder(): void {
    try {
      const stored = sessionStorage.getItem(this.currentOrderStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;

      const items = parsed.filter(item =>
        Number.isFinite(Number(item?.productId))
        && typeof item?.name === 'string'
        && Number(item?.quantity) > 0
        && Number.isFinite(Number(item?.price))
      ).map(item => ({
        productId: Number(item.productId),
        name: item.name,
        quantity: Number(item.quantity),
        price: Number(item.price),
        subtotal: Number(item.price) * Number(item.quantity)
      }));

      if (items.length) {
        this.currentOrderSubject.next(items);
      }
    } catch {
      sessionStorage.removeItem(this.currentOrderStorageKey);
    }
  }

  private getOrderItemKey(item: Pick<OrderItem, 'productId' | 'name'>): string {
    return `${item.productId}::${item.name}`;
  }

  private matchesItem(item: OrderItem, itemRef: number | Pick<OrderItem, 'productId' | 'name'>): boolean {
    if (typeof itemRef === 'number') return item.productId === itemRef;
    return this.getOrderItemKey(item) === this.getOrderItemKey(itemRef);
  }
}


