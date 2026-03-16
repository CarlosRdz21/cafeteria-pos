import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { buildApiUrl } from '../config/server.config';

export type MercadoPagoPreferenceRequest = {
  externalReference: string;
  items: Array<{
    title: string;
    quantity: number;
    unitPrice: number;
    currencyId?: string;
  }>;
  payerEmail?: string;
  metadata?: Record<string, unknown>;
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
};

export type MercadoPagoVerifyResponse = {
  id: string;
  status: string;
  statusDetail?: string;
  totalAmount?: number;
  externalReference?: string;
};

export type MercadoPagoPointOrderRequest = {
  externalReference: string;
  totalAmount: number;
  description?: string;
};

export type MercadoPagoPointOrderResponse = {
  id: string;
  status: string;
  externalReference?: string;
  totalAmount?: number;
  terminalId?: string;
  terminalSerial?: string;
  paymentId?: string;
  paymentStatus?: string;
};

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private get API() {
    return buildApiUrl('payments');
  }

  constructor(private http: HttpClient) {}

  registerPayment(
    orderId: number,
    method: 'cash' | 'card',
    amountPaid?: number
  ) {
    return this.http.post(this.API, {
      orderId,
      method,
      amountPaid
    }).toPromise();
  }

  async getPaymentsByDateRange(start: Date, end: Date) {
    return this.http.get<any[]>(`${this.API}/reports`, {
      params: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    }).toPromise();
  }

  async createMercadoPagoPreference(payload: MercadoPagoPreferenceRequest): Promise<MercadoPagoPreferenceResponse> {
    return this.http.post<MercadoPagoPreferenceResponse>(`${this.API}/mercado-pago/preference`, payload).toPromise() as Promise<MercadoPagoPreferenceResponse>;
  }

  async verifyMercadoPagoPayment(paymentId: string): Promise<MercadoPagoVerifyResponse> {
    return this.http.post<MercadoPagoVerifyResponse>(`${this.API}/mercado-pago/verify`, { paymentId }).toPromise() as Promise<MercadoPagoVerifyResponse>;
  }

  async createMercadoPagoPointOrder(payload: MercadoPagoPointOrderRequest): Promise<MercadoPagoPointOrderResponse> {
    return this.http.post<MercadoPagoPointOrderResponse>(`${this.API}/mercado-pago/point/order`, payload).toPromise() as Promise<MercadoPagoPointOrderResponse>;
  }

  async getMercadoPagoPointOrder(orderId: string): Promise<MercadoPagoPointOrderResponse> {
    return this.http.get<MercadoPagoPointOrderResponse>(`${this.API}/mercado-pago/point/order/${encodeURIComponent(orderId)}`).toPromise() as Promise<MercadoPagoPointOrderResponse>;
  }
}
