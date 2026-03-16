import { prisma } from '../prisma';

export class OrderService {

  static async createOrder(data: any) {
    console.log('📦 BODY ORDER:', data);

    return prisma.order.create({
      data: {
        status: data.status ?? 'pending',
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        notes: data.notes,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          }))
        }
      },
      include: { items: true }
    });
  }

  // 🔹 Obtener órdenes por estado
  static async getOrdersByStatus(status: string) {
    return prisma.order.findMany({
      where: { status },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  // 🔹 Actualizar estado de una orden
  static async updateOrderStatus(orderId: number, status: string) {
    const allowedStatuses = [
      'pending',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ];

    if (!allowedStatuses.includes(status)) {
      throw new Error('Invalid order status');
    }

    return prisma.order.update({
      where: { id: orderId },
      data: { status },
      include: { items: true }
    });
  }

  // 🔹 Obtener una orden por ID (opcional pero recomendable)
  static async getOrderById(orderId: number) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
  }
}
