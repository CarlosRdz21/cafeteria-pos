import { prisma } from '../prisma';

export class OrderRepository {

  static async create(data: any) {
    return prisma.order.create({
      data: {
        status: data.status,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        tableNumber: data.tableNumber,
        customerName: data.customerName,
        notes: data.notes,
        items: {
          create: data.items.map((item: any) => ({
            productId: item.productId,
            name: item.productName,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity
          }))
        }
      },
      include: { items: true }
    });
  }

  static async getOrdersByStatus(status: string) {
    return prisma.order.findMany({
      where: { status },
      include: { items: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async updateStatus(orderId: number, status: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status }
    });
  }

  static async getOrderById(orderId: number) {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true }
    });
  }
}

