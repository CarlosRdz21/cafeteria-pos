import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import {
  AppliedPromotionSummary,
  Order,
  OrderItem,
  PaymentDetails,
  PaymentMethod
} from '../../shared/models/domain.models';
import { buildApiUrl } from '../config/server.config';

interface DatosPedidoPendiente {
  items: OrderItem[];
  tableNumber: string;
  customerName: string;
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending';
}

@Injectable({ providedIn: 'root' })
export class PendingOrdersService {
  private get API() {
    return buildApiUrl('orders');
  }

  private sujetoPedidosPendientes = new BehaviorSubject<Order[]>([]);
  pedidosPendientes$ = this.sujetoPedidosPendientes.asObservable();

  constructor(private http: HttpClient) {}

  async cargarPedidosPendientes() {
    this.http.get<Order[]>(`${this.API}?status=pending`)
      .subscribe(pedidos => this.sujetoPedidosPendientes.next(pedidos));
  }

  /**
   * Mantiene la copia local sincronizada con Socket.IO.
   * Si el pedido dejó de estar pendiente, se retira para no mostrar datos obsoletos.
   */
  actualizarOAgregarPedidoPendiente(pedido: Order) {
    const pedidosActuales = this.sujetoPedidosPendientes.value;
    const indice = pedidosActuales.findIndex(pedidoExistente => pedidoExistente.id === pedido.id);

    if (pedido.status !== 'pending') {
      if (indice >= 0) {
        const pedidosSiguientes = [...pedidosActuales];
        pedidosSiguientes.splice(indice, 1);
        this.sujetoPedidosPendientes.next(pedidosSiguientes);
      }
      return;
    }

    if (indice >= 0) {
      const pedidosSiguientes = [...pedidosActuales];
      pedidosSiguientes[indice] = pedido;
      this.sujetoPedidosPendientes.next(pedidosSiguientes);
      return;
    }

    this.sujetoPedidosPendientes.next([pedido, ...pedidosActuales]);
  }

  quitarPedidoPendiente(idPedido: number) {
    this.sujetoPedidosPendientes.next(
      this.sujetoPedidosPendientes.value.filter(pedido => pedido.id !== idPedido)
    );
  }

  async crearPedidoPendiente(datosPedido: DatosPedidoPendiente) {
    return this.http.post<Order>(this.API, datosPedido).toPromise();
  }

  async actualizarPedidoPendiente(idPedido: number, productos: OrderItem[]) {
    return this.http
      .patch<Order>(`${this.API}/${idPedido}/status`, {
        status: 'pending',
        items: productos
      })
      .toPromise();
  }

  async reemplazarProductosPedidoPendiente(idPedido: number, productos: OrderItem[]) {
    return this.http
      .put<Order>(`${this.API}/${idPedido}`, { items: productos })
      .toPromise();
  }

  async cancelarPedidoPendiente(idPedido: number) {
    return this.http
      .patch(`${this.API}/${idPedido}/cancel`, {})
      .toPromise();
  }

  async completarPedidoPendiente(
    idPedido: number,
    metodoPago: PaymentMethod,
    productos: OrderItem[],
    descuentoTotal?: number,
    promocionesAplicadas?: AppliedPromotionSummary[],
    montoPagado?: number,
    detallesPago?: PaymentDetails
  ) {
    return this.http.patch<Order>(`${this.API}/${idPedido}/status`, {
      status: 'completed',
      paymentMethod: metodoPago,
      items: productos,
      discountTotal: descuentoTotal ?? 0,
      appliedPromotions: promocionesAplicadas ?? [],
      amountPaid: montoPagado,
      paymentDetails: detallesPago
    }).toPromise();
  }

  async obtenerPedidoPendiente(idPedido: number) {
    return this.http
      .get<Order>(`${this.API}/${idPedido}`)
      .toPromise();
  }
}


