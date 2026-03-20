import { Request, Response } from 'express';
import { OrderService } from '../services/order.service';
import { getIO } from '../socket';
import { prisma } from '../prisma';
import { PaymentService } from '../services/payment.service';
import { CashRegistersController } from './cash-registers.controller';



export class OrderController {

  static async create(req: Request, res: Response) {
    try {
      const {
        items,
        status,
        paymentMethod,
        amountPaid,
        paymentDetails,
        discountTotal,
        appliedPromotions,
        tableNumber,
        customerName,
        notes
      } = req.body;

      if (!items || items.length === 0) {
        return res.status(400).json({ error: 'La orden está vacía' });
      }

      const subtotal = items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      );

      const tax = 0;
      const total = subtotal + tax;

      const order = await prisma.order.create({
        data: {
          subtotal,
          tax,
          total,
          discountTotal: Number(discountTotal || 0),
          appliedPromotions: appliedPromotions ?? null,
          status: status ?? 'pending',
          tableNumber,
          customerName,
          notes,
          items: {
            create: items.map((item: any) => ({
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal
            }))
          }

        },
        include: {
          items: true
        }
      });

      // Si la orden ya estÃ¡ completada, registrar el pago para que aparezca en reportes
      if ((status ?? 'pending') === 'completed') {
        if (!paymentMethod) {
          return res.status(400).json({ error: 'Payment method required' });
        }

        if (paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
          return res.status(400).json({ error: 'amountPaid required for cash payments' });
        }

        await PaymentService.registerPayment(
          order.id,
          paymentMethod,
          paymentMethod === 'cash' ? amountPaid : undefined,
          paymentDetails
        );
        await CashRegistersController.applySaleToOpenRegister(paymentMethod, total);
      }

      res.status(201).json(order);
    } catch (error: any) {
      console.error('❌ Error creating order:', error);
      res.status(500).json({ error: error.message });
    }
  }



  static async list(req: Request, res: Response) {
    try {
      const status = req.query.status as string;

      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }

      const orders = await OrderService.getOrdersByStatus(status);
      res.json(orders);
    } catch (error: any) {
      console.error('❌ Error listing orders:', error);
      res.status(500).json({ error: 'Failed to list orders' });
    }
  }

  static async updateStatus(req: Request, res: Response) {
    try {
      const orderId = Number(req.params.id);
      const { status, paymentMethod, amountPaid, items, paymentDetails, discountTotal, appliedPromotions } = req.body;

      if (!orderId || !status) {
        return res.status(400).json({ error: 'Order ID and status are required' });
      }
      const existingOrder = await prisma.order.findUnique({ where: { id: orderId } });
      if (!existingOrder) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      if (status === 'completed') {
        let effectiveTotal = existingOrder.total;

        if (Array.isArray(items) && items.length > 0) {
          const subtotal = items.reduce(
            (sum: number, item: any) => sum + Number(item.price || 0) * Number(item.quantity || 0),
            0
          );
          const tax = 0;
          effectiveTotal = subtotal + tax;

          await prisma.order.update({
            where: { id: orderId },
            data: {
              subtotal,
              tax,
              total: effectiveTotal,
              discountTotal: Number(discountTotal || 0),
              appliedPromotions: appliedPromotions ?? null,
              items: {
                deleteMany: {},
                create: items.map((item: any) => ({
                  productId: item.productId,
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  subtotal: Number(item.price || 0) * Number(item.quantity || 0)
                }))
              }
            }
          });
        }

        if (!paymentMethod) {
          return res.status(400).json({ error: 'Payment method required' });
        }

        // 💳 Tarjeta NO requiere amountPaid
        if (paymentMethod === 'cash' && (amountPaid === undefined || amountPaid === null)) {
          return res.status(400).json({ error: 'amountPaid required for cash payments' });
        }

        await PaymentService.registerPayment(
          orderId,
          paymentMethod,
          paymentMethod === 'cash' ? amountPaid : undefined,
          paymentDetails
        );

        if (existingOrder.status !== 'completed') {
          await CashRegistersController.applySaleToOpenRegister(paymentMethod, effectiveTotal);
        }
      } else {
        if (status === 'pending' && Array.isArray(items) && items.length > 0) {
          const pendingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
          });

          if (!pendingOrder) {
            return res.status(404).json({ error: 'Orden no encontrada' });
          }

          const mergedItemsMap = new Map<number, any>();

          for (const item of pendingOrder.items) {
            mergedItemsMap.set(item.productId, {
              productId: item.productId,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal
            });
          }

          for (const item of items) {
            const existing = mergedItemsMap.get(item.productId);
            if (existing) {
              existing.quantity += item.quantity;
              existing.subtotal = existing.price * existing.quantity;
            } else {
              mergedItemsMap.set(item.productId, {
                productId: item.productId,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                subtotal: item.price * item.quantity
              });
            }
          }

          const mergedItems = Array.from(mergedItemsMap.values());

          const subtotal = mergedItems.reduce(
            (sum: number, item: any) => sum + item.price * item.quantity,
            0
          );
          const tax = 0;
          const total = subtotal + tax;

          await prisma.order.update({
            where: { id: orderId },
            data: {
              status,
              subtotal,
              tax,
              total,
              items: {
                deleteMany: {},
                create: mergedItems.map((item: any) => ({
                  productId: item.productId,
                  name: item.name,
                  quantity: item.quantity,
                  price: item.price,
                  subtotal: item.price * item.quantity
                }))
              }
            }
          });
        } else {
          await prisma.order.update({
            where: { id: orderId },
            data: { status }
          });
        }
      }

      res.json({ success: true });

    } catch (error: any) {
      console.error('❌ Error updating order:', error);
      res.status(500).json({ error: error.message });
    }
  }




  static async cancel(req: Request, res: Response) {
    try {
      const orderId = Number(req.params.id);

      if (!orderId) {
        return res.status(400).json({ error: 'Invalid order id' });
      }

      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'cancelled' }
      });

      // 🔔 Notificar por socket
      const io = getIO();
      io.to('waiters').emit('order-updated', order);
      io.to('admins').emit('order-updated', order);

      res.json(order);
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      res.status(500).json({ error: 'Error cancelling order' });
    }
  }

  static async getById(req: Request, res: Response) {
    try {
      const orderId = Number(req.params.id);

      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: true
        }
      });

      if (!order) {
        return res.status(404).json({ error: 'Orden no encontrada' });
      }

      res.json(order);
    } catch (error: any) {
      console.error('❌ Error getting order:', error);
      res.status(500).json({ error: error.message });
    }
  }



}
