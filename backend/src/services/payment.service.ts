import { prisma } from '../prisma';

type PaymentDetails = {
  provider?: string;
  reference?: string;
  metadata?: Record<string, unknown>;
};

export class PaymentService {

  static async registerPayment(
    orderId: number,
    method: 'cash' | 'card',
    amountPaid?: number,
    details?: PaymentDetails
  ) {
    // 🔎 Obtener la orden para conocer el total
    const db = prisma as any;
    const order = await db.order.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      throw new Error('Orden no encontrada');
    }

    const payment = await db.payment.create({
      data: {
        orderId,
        method,
        // 💡 SI es tarjeta → usar el total de la orden
        amount: order.total,
        provider: details?.provider || null,
        reference: details?.reference || null,
        metadata: details?.metadata ?? null
      }
    });

    // 🔄 Marcar orden como completada
    await db.order.update({
      where: { id: orderId },
      data: {
        status: 'completed'
      }
    });

    return payment;
  }


  static async getPaymentsByDateRange(start: Date, end: Date) {
    const db = prisma as any;
    return db.payment.findMany({
      where: {
        paidAt: {
          gte: start,
          lte: end
        }
      },
      include: {
        order: {
          include: { items: true }
        }
      },
      orderBy: { paidAt: 'desc' }
    });
  }

}
