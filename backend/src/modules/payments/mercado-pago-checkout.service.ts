import https from 'https';
import { randomUUID } from 'crypto';

type CheckoutItem = {
  title: string;
  quantity: number;
  unitPrice: number;
  currencyId?: string;
};

type CreatePreferenceInput = {
  items: CheckoutItem[];
  externalReference: string;
  payerEmail?: string;
  metadata?: Record<string, unknown>;
};

type PreferenceResult = {
  id: string;
  initPoint: string;
  sandboxInitPoint?: string;
};

type VerifyPaymentResult = {
  id: string;
  status: string;
  statusDetail?: string;
  totalAmount?: number;
  externalReference?: string;
};

type CreatePointOrderInput = {
  externalReference: string;
  totalAmount: number;
  description?: string;
};

type PointOrderResult = {
  id: string;
  status: string;
  externalReference?: string;
  totalAmount?: number;
  terminalId?: string;
  terminalSerial?: string;
  paymentId?: string;
  paymentStatus?: string;
  raw?: unknown;
};

export class MercadoPagoCheckoutService {
  static async createPreference(input: CreatePreferenceInput): Promise<PreferenceResult> {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      throw new Error('MP_ACCESS_TOKEN is not configured');
    }

    const payload: Record<string, unknown> = {
      external_reference: input.externalReference,
      items: input.items.map(item => ({
        title: item.title,
        quantity: Math.max(1, Number(item.quantity || 1)),
        unit_price: Number(item.unitPrice || 0),
        currency_id: item.currencyId || 'MXN'
      })),
      metadata: input.metadata || {}
    };

    if (input.payerEmail) {
      payload['payer'] = { email: input.payerEmail };
    }

    if (process.env.MP_SUCCESS_URL || process.env.MP_PENDING_URL || process.env.MP_FAILURE_URL) {
      payload['back_urls'] = {
        success: process.env.MP_SUCCESS_URL || undefined,
        pending: process.env.MP_PENDING_URL || undefined,
        failure: process.env.MP_FAILURE_URL || undefined
      };
      payload['auto_return'] = process.env.MP_AUTO_RETURN || 'approved';
    }

    const response = await this.requestJson(
      'POST',
      '/checkout/preferences',
      token,
      payload
    );

    return {
      id: String(response?.id || ''),
      initPoint: String(response?.init_point || ''),
      sandboxInitPoint: response?.sandbox_init_point ? String(response.sandbox_init_point) : undefined
    };
  }

  static async verifyPayment(paymentId: string): Promise<VerifyPaymentResult> {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      throw new Error('MP_ACCESS_TOKEN is not configured');
    }

    const safePaymentId = encodeURIComponent(paymentId.trim());
    const response = await this.requestJson(
      'GET',
      `/v1/payments/${safePaymentId}`,
      token
    );

    return {
      id: String(response?.id || paymentId),
      status: String(response?.status || ''),
      statusDetail: response?.status_detail ? String(response.status_detail) : undefined,
      totalAmount: response?.transaction_amount == null ? undefined : Number(response.transaction_amount),
      externalReference: response?.external_reference ? String(response.external_reference) : undefined
    };
  }

  static async createPointOrder(input: CreatePointOrderInput): Promise<PointOrderResult> {
    const token = this.getRequiredToken();
    const terminal = await this.resolvePointTerminal(token);
    const amount = this.normalizeAmount(input.totalAmount);
    const paymentId = `PAY${Date.now()}`;

    const payload: Record<string, unknown> = {
      type: 'point',
      external_reference: input.externalReference,
      processing_mode: 'automatic',
      point_of_interaction: {
        terminal_id: terminal.id
      },
      config: {
        payment_method: {
          default_type: 'credit_card'
        },
        print_on_terminal: process.env.MP_POINT_PRINT_ON_TERMINAL || 'no_ticket'
      },
      transactions: {
        payments: [
          {
            id: paymentId,
            amount: amount.toFixed(2),
            status: 'created'
          }
        ]
      }
    };

    if (input.description?.trim()) {
      payload['description'] = input.description.trim();
    }

    const response = await this.requestJson('POST', '/v1/orders', token, payload, {
      'X-Idempotency-Key': randomUUID()
    });

    return this.mapPointOrder(response, {
      terminalId: terminal.id,
      terminalSerial: terminal.serial
    });
  }

  static async getPointOrder(orderId: string): Promise<PointOrderResult> {
    const token = this.getRequiredToken();
    const safeOrderId = encodeURIComponent(orderId.trim());
    const response = await this.requestJson('GET', `/v1/orders/${safeOrderId}`, token);
    return this.mapPointOrder(response);
  }

  private static getRequiredToken(): string {
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) {
      throw new Error('MP_ACCESS_TOKEN is not configured');
    }
    return token;
  }

  private static async resolvePointTerminal(token: string): Promise<{ id: string; serial?: string }> {
    const configuredId = String(process.env.MP_POINT_TERMINAL_ID || '').trim();
    if (configuredId) {
      return { id: configuredId };
    }

    const configuredSerial = String(process.env.MP_POINT_TERMINAL_SERIAL || '').trim();
    if (!configuredSerial) {
      throw new Error('Configura MP_POINT_TERMINAL_ID o MP_POINT_TERMINAL_SERIAL');
    }

    const query = new URLSearchParams({
      limit: '50',
      offset: '0'
    });

    const storeId = String(process.env.MP_POINT_STORE_ID || '').trim();
    const posId = String(process.env.MP_POINT_POS_ID || '').trim();
    if (storeId) query.set('store_id', storeId);
    if (posId) query.set('pos_id', posId);

    const response = await this.requestJson(
      'GET',
      `/terminals/v1/list?${query.toString()}`,
      token
    );

    const terminals = Array.isArray(response?.data?.terminals) ? response.data.terminals : [];
    const normalizedSerial = configuredSerial.toLowerCase();
    const matched = terminals.find((terminal: any) => {
      const id = String(terminal?.id || '').trim();
      return id.toLowerCase() === normalizedSerial
        || id.toLowerCase().endsWith(normalizedSerial)
        || id.toLowerCase().includes(normalizedSerial);
    });

    if (!matched?.id) {
      throw new Error(`No se encontro terminal Mercado Pago para el serial ${configuredSerial}`);
    }

    return {
      id: String(matched.id),
      serial: configuredSerial
    };
  }

  private static mapPointOrder(
    response: any,
    terminal?: { terminalId?: string; terminalSerial?: string }
  ): PointOrderResult {
    const payment = Array.isArray(response?.transactions?.payments) ? response.transactions.payments[0] : undefined;
    return {
      id: String(response?.id || ''),
      status: String(response?.status || payment?.status || ''),
      externalReference: response?.external_reference ? String(response.external_reference) : undefined,
      totalAmount: payment?.amount == null ? undefined : Number(payment.amount),
      terminalId:
        terminal?.terminalId
        || response?.point_of_interaction?.terminal_id
        || response?.point?.terminal_id
        || undefined,
      terminalSerial: terminal?.terminalSerial,
      paymentId: payment?.id ? String(payment.id) : undefined,
      paymentStatus: payment?.status ? String(payment.status) : undefined,
      raw: response
    };
  }

  private static normalizeAmount(value: number): number {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('El monto para Mercado Pago Point es invalido');
    }
    return Math.round(amount * 100) / 100;
  }

  private static requestJson(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const rawBody = body ? JSON.stringify(body) : undefined;
      const req = https.request(
        {
          hostname: 'api.mercadopago.com',
          path,
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...(extraHeaders || {}),
            ...(rawBody ? { 'Content-Length': Buffer.byteLength(rawBody) } : {})
          }
        },
        res => {
          const chunks: Buffer[] = [];
          res.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
          res.on('end', () => {
            const text = Buffer.concat(chunks).toString('utf8');
            const status = res.statusCode || 500;
            const parsed = text ? this.safeParse(text) : {};

            if (status >= 200 && status < 300) {
              resolve(parsed);
              return;
            }

            const apiMessage =
              parsed?.message ||
              parsed?.error ||
              parsed?.cause?.[0]?.description ||
              `Mercado Pago API error (${status})`;
            reject(new Error(String(apiMessage)));
          });
        }
      );

      req.on('error', reject);
      if (rawBody) req.write(rawBody);
      req.end();
    });
  }

  private static safeParse(value: string): any {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }
}
