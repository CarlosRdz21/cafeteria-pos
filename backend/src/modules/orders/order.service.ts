import { prisma } from '../../config/prisma';

interface ProductoCrearPedido {
  productId: number;
  name: string;
  price: number;
  quantity: number;
}

interface DatosCrearPedido {
  status?: string;
  subtotal: number;
  tax: number;
  total: number;
  tableNumber?: string;
  customerName?: string;
  notes?: string;
  items: ProductoCrearPedido[];
}

export class OrderService {

  static async crearPedido(datosPedido: DatosCrearPedido) {

    return prisma.order.create({
      data: {
        status: datosPedido.status ?? 'pending',
        subtotal: datosPedido.subtotal,
        tax: datosPedido.tax,
        total: datosPedido.total,
        tableNumber: datosPedido.tableNumber,
        customerName: datosPedido.customerName,
        notes: datosPedido.notes,
        items: {
          create: datosPedido.items.map(producto => ({
            productId: producto.productId,
            name: producto.name,
            price: producto.price,
            quantity: producto.quantity,
            subtotal: producto.price * producto.quantity
          }))
        }
      },
      include: { items: true }
    });
  }

  static async obtenerPedidosPorEstado(estado: string) {
    return prisma.order.findMany({
      where: { status: estado },
      include: { items: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async actualizarEstadoPedido(idPedido: number, estado: string) {
    const estadosPermitidos = [
      'pending',
      'preparing',
      'ready',
      'delivered',
      'cancelled'
    ];

    if (!estadosPermitidos.includes(estado)) {
      throw new Error('Invalid order status');
    }

    return prisma.order.update({
      where: { id: idPedido },
      data: { status: estado },
      include: { items: true }
    });
  }

  static async obtenerPedidoPorId(idPedido: number) {
    return prisma.order.findUnique({
      where: { id: idPedido },
      include: { items: true }
    });
  }
}
