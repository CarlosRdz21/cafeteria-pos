import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { PrismaClient, Prisma } from '@prisma/client';

type Snapshot = {
  meta: { app: string; schemaVersion: number; generatedAt: string };
  productCategories: Array<{ id: number; name: string; active: boolean; sortOrder: number; createdAt: string }>;
  supplyCategories: Array<{ id: number; name: string; active: boolean; sortOrder: number; createdAt: string }>;
  products: Array<{
    id: number;
    name: string;
    description: string;
    price: number;
    image: string;
    category: string;
    categoryId?: number;
    categoryName: string;
    available: boolean;
    stock?: number;
    variantPricing?: Record<string, unknown>;
    drinkBaseType?: string;
    milkOptions?: string[];
    waterOptions?: string[];
    milkOptionExtras?: Record<string, number>;
    waterOptionExtras?: Record<string, number>;
    serviceTemperature?: string;
  }>;
  supplies: Array<{
    id: number;
    name: string;
    category: string;
    categoryId?: number;
    categoryName: string;
    unit: string;
    currentStock: number;
    unitCost?: number;
    minStock?: number;
    notes?: string;
    active: boolean;
    createdAt: string;
  }>;
  orders: Array<{
    id: number;
    items: Array<{
      id?: number;
      productId: number;
      name: string;
      price: number;
      quantity: number;
      subtotal: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    status: string;
    createdAt: string;
    paymentMethod?: 'cash' | 'card';
    amountPaid?: number;
    change?: number;
    tableNumber?: string;
    customerName?: string;
    notes?: string | null;
  }>;
  cashRegisters: Array<{
    id: number;
    openingAmount: number;
    closingAmount?: number;
    expectedAmount?: number;
    difference?: number;
    cashSales: number;
    cardSales: number;
    expenses: number;
    totalTransactions: number;
    openedAt: string;
    closedAt?: string;
    status: string;
    userId: string;
  }>;
  expenses: Array<{
    id: number;
    description?: string;
    concept?: string;
    amount: number;
    category: string;
    timestamp: string;
    userId?: number;
    userName?: string;
    notes?: string;
    cashRegisterId?: number;
  }>;
  supplyMovements: Array<{
    id: number;
    supplyId: number;
    type: 'in' | 'out';
    quantity: number;
    unitCost?: number;
    totalCost?: number;
    reason?: string;
    reference?: string;
    userId?: number;
    userName?: string;
    timestamp: string;
    notes?: string;
  }>;
  users: Array<{
    id: number;
    username: string;
    password: string;
    name: string;
    role: string;
    active: boolean;
    createdAt: string;
  }>;
  integrity?: {
    missingProductCategoryIds?: number[];
    missingSupplyCategoryIds?: number[];
    productsWithoutCategoryId?: number[];
    suppliesWithoutCategoryId?: number[];
  };
};

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--'));
  const truncate = args.includes('--truncate');
  if (!file) {
    throw new Error('Uso: ts-node scripts/import-clean-snapshot.ts <snapshot.json> [--truncate]');
  }
  return { file: path.resolve(process.cwd(), file), truncate };
}

function readSnapshot(filePath: string): Snapshot {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as Snapshot;
}

function toDate(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fakeEmailFromUsername(username: string): string {
  return `${username.replace(/\s+/g, '.').toLowerCase()}@local.migrated`;
}

async function truncateAll() {
  // Order matters due to FKs
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.supplyMovement.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cashRegister.deleteMany();
  await prisma.product.deleteMany();
  await prisma.productSupply.deleteMany();
  await prisma.productCategory.deleteMany();
  await prisma.supplyCategory.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const { file, truncate } = parseArgs();
  const snapshot = readSnapshot(file);

  if (snapshot.integrity) {
    const hasIntegrityIssues =
      (snapshot.integrity.missingProductCategoryIds?.length || 0) > 0 ||
      (snapshot.integrity.missingSupplyCategoryIds?.length || 0) > 0 ||
      (snapshot.integrity.productsWithoutCategoryId?.length || 0) > 0 ||
      (snapshot.integrity.suppliesWithoutCategoryId?.length || 0) > 0;
    if (hasIntegrityIssues) {
      throw new Error(`Snapshot con inconsistencias de categorías: ${JSON.stringify(snapshot.integrity)}`);
    }
  }

  console.log(`Importando snapshot generado en ${snapshot.meta?.generatedAt || 'N/D'}...`);

  await prisma.$transaction(async tx => {
    if (truncate) {
      console.log('Limpiando tablas...');
      // Use the outer client helper because we need strict order.
      await truncateAll();
    }

    for (const row of snapshot.productCategories || []) {
      await tx.productCategory.upsert({
        where: { id: row.id },
        update: {
          name: row.name,
          active: row.active,
          sortOrder: row.sortOrder,
          createdAt: toDate(row.createdAt) || new Date()
        },
        create: {
          id: row.id,
          name: row.name,
          active: row.active,
          sortOrder: row.sortOrder,
          createdAt: toDate(row.createdAt) || new Date()
        }
      });
    }

    for (const row of snapshot.supplyCategories || []) {
      await tx.supplyCategory.upsert({
        where: { id: row.id },
        update: {
          name: row.name,
          active: row.active,
          sortOrder: row.sortOrder,
          createdAt: toDate(row.createdAt) || new Date()
        },
        create: {
          id: row.id,
          name: row.name,
          active: row.active,
          sortOrder: row.sortOrder,
          createdAt: toDate(row.createdAt) || new Date()
        }
      });
    }

    for (const user of snapshot.users || []) {
      await tx.user.upsert({
        where: { id: user.id },
        update: {
          username: user.username,
          email: fakeEmailFromUsername(user.username),
          password: user.password,
          name: user.name,
          role: user.role,
          active: user.active,
          createdAt: toDate(user.createdAt) || new Date()
        },
        create: {
          id: user.id,
          username: user.username,
          email: fakeEmailFromUsername(user.username),
          password: user.password,
          name: user.name,
          role: user.role,
          active: user.active,
          createdAt: toDate(user.createdAt) || new Date()
        }
      });
    }

    for (const p of snapshot.products || []) {
      if (!p.categoryId) {
        throw new Error(`Producto sin categoryId: ${p.id} (${p.name})`);
      }
      await tx.product.upsert({
        where: { id: p.id },
        update: {
          name: p.name,
          description: p.description || '',
          price: p.price,
          image: p.image || '',
          categoryId: p.categoryId,
          categoryName: p.categoryName || p.category || '',
          available: !!p.available,
          stock: p.stock ?? null,
          variantPricing: (p.variantPricing ?? undefined) as Prisma.InputJsonValue | undefined,
          drinkBaseType: p.drinkBaseType ?? null,
          milkOptions: (p.milkOptions ?? undefined) as Prisma.InputJsonValue | undefined,
          waterOptions: (p.waterOptions ?? undefined) as Prisma.InputJsonValue | undefined,
          milkOptionExtras: (p.milkOptionExtras ?? undefined) as Prisma.InputJsonValue | undefined,
          waterOptionExtras: (p.waterOptionExtras ?? undefined) as Prisma.InputJsonValue | undefined,
          serviceTemperature: p.serviceTemperature ?? null
        },
        create: {
          id: p.id,
          name: p.name,
          description: p.description || '',
          price: p.price,
          image: p.image || '',
          categoryId: p.categoryId,
          categoryName: p.categoryName || p.category || '',
          available: !!p.available,
          stock: p.stock ?? null,
          variantPricing: (p.variantPricing ?? undefined) as Prisma.InputJsonValue | undefined,
          drinkBaseType: p.drinkBaseType ?? null,
          milkOptions: (p.milkOptions ?? undefined) as Prisma.InputJsonValue | undefined,
          waterOptions: (p.waterOptions ?? undefined) as Prisma.InputJsonValue | undefined,
          milkOptionExtras: (p.milkOptionExtras ?? undefined) as Prisma.InputJsonValue | undefined,
          waterOptionExtras: (p.waterOptionExtras ?? undefined) as Prisma.InputJsonValue | undefined,
          serviceTemperature: p.serviceTemperature ?? null
        }
      });
    }

    for (const s of snapshot.supplies || []) {
      if (!s.categoryId) {
        throw new Error(`Insumo sin categoryId: ${s.id} (${s.name})`);
      }
      await tx.productSupply.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          categoryId: s.categoryId,
          categoryName: s.categoryName || s.category || '',
          unit: s.unit,
          currentStock: s.currentStock,
          unitCost: s.unitCost ?? null,
          minStock: s.minStock ?? null,
          notes: s.notes ?? null,
          active: !!s.active,
          createdAt: toDate(s.createdAt) || new Date()
        },
        create: {
          id: s.id,
          name: s.name,
          categoryId: s.categoryId,
          categoryName: s.categoryName || s.category || '',
          unit: s.unit,
          currentStock: s.currentStock,
          unitCost: s.unitCost ?? null,
          minStock: s.minStock ?? null,
          notes: s.notes ?? null,
          active: !!s.active,
          createdAt: toDate(s.createdAt) || new Date()
        }
      });
    }

    for (const reg of snapshot.cashRegisters || []) {
      await tx.cashRegister.upsert({
        where: { id: reg.id },
        update: {
          openingAmount: reg.openingAmount,
          closingAmount: reg.closingAmount ?? null,
          expectedAmount: reg.expectedAmount ?? null,
          difference: reg.difference ?? null,
          cashSales: reg.cashSales,
          cardSales: reg.cardSales,
          expenses: reg.expenses,
          totalTransactions: reg.totalTransactions,
          openedAt: toDate(reg.openedAt) || new Date(),
          closedAt: toDate(reg.closedAt) || null,
          status: reg.status,
          userRef: reg.userId
        },
        create: {
          id: reg.id,
          openingAmount: reg.openingAmount,
          closingAmount: reg.closingAmount ?? null,
          expectedAmount: reg.expectedAmount ?? null,
          difference: reg.difference ?? null,
          cashSales: reg.cashSales,
          cardSales: reg.cardSales,
          expenses: reg.expenses,
          totalTransactions: reg.totalTransactions,
          openedAt: toDate(reg.openedAt) || new Date(),
          closedAt: toDate(reg.closedAt) || null,
          status: reg.status,
          userRef: reg.userId
        }
      });
    }

    for (const order of snapshot.orders || []) {
      await tx.order.upsert({
        where: { id: order.id },
        update: {
          status: order.status,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          tableNumber: order.tableNumber ?? null,
          customerName: order.customerName ?? null,
          notes: order.notes ?? null,
          createdAt: toDate(order.createdAt) || new Date(),
          paymentMethod: order.paymentMethod ?? null,
          amountPaid: order.amountPaid ?? null,
          change: order.change ?? null
        },
        create: {
          id: order.id,
          status: order.status,
          subtotal: order.subtotal,
          tax: order.tax,
          total: order.total,
          tableNumber: order.tableNumber ?? null,
          customerName: order.customerName ?? null,
          notes: order.notes ?? null,
          createdAt: toDate(order.createdAt) || new Date(),
          paymentMethod: order.paymentMethod ?? null,
          amountPaid: order.amountPaid ?? null,
          change: order.change ?? null
        }
      });

      await tx.orderItem.deleteMany({ where: { orderId: order.id } });
      if (order.items?.length) {
        for (const item of order.items) {
          await tx.orderItem.create({
            data: {
              id: item.id ?? undefined,
              orderId: order.id,
              productId: item.productId,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              subtotal: item.subtotal
            }
          });
        }
      }

      // Generate a payment row if order snapshot includes payment info and one does not exist.
      if (order.paymentMethod && typeof order.total === 'number') {
        const existingPayments = await tx.payment.count({ where: { orderId: order.id } });
        if (existingPayments === 0) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: order.paymentMethod,
              amount: order.total,
              paidAt: toDate(order.createdAt) || new Date()
            }
          });
        }
      }
    }

    for (const expense of snapshot.expenses || []) {
      await tx.expense.upsert({
        where: { id: expense.id },
        update: {
          description: expense.description ?? null,
          concept: expense.concept ?? null,
          amount: expense.amount,
          category: expense.category,
          timestamp: toDate(expense.timestamp) || new Date(),
          userId: expense.userId ?? null,
          userName: expense.userName ?? null,
          notes: expense.notes ?? null,
          cashRegisterId: expense.cashRegisterId ?? null
        },
        create: {
          id: expense.id,
          description: expense.description ?? null,
          concept: expense.concept ?? null,
          amount: expense.amount,
          category: expense.category,
          timestamp: toDate(expense.timestamp) || new Date(),
          userId: expense.userId ?? null,
          userName: expense.userName ?? null,
          notes: expense.notes ?? null,
          cashRegisterId: expense.cashRegisterId ?? null
        }
      });
    }

    for (const movement of snapshot.supplyMovements || []) {
      await tx.supplyMovement.upsert({
        where: { id: movement.id },
        update: {
          supplyId: movement.supplyId,
          type: movement.type,
          quantity: movement.quantity,
          unitCost: movement.unitCost ?? null,
          totalCost: movement.totalCost ?? null,
          reason: movement.reason ?? null,
          reference: movement.reference ?? null,
          userId: movement.userId ?? null,
          userName: movement.userName ?? null,
          timestamp: toDate(movement.timestamp) || new Date(),
          notes: movement.notes ?? null
        },
        create: {
          id: movement.id,
          supplyId: movement.supplyId,
          type: movement.type,
          quantity: movement.quantity,
          unitCost: movement.unitCost ?? null,
          totalCost: movement.totalCost ?? null,
          reason: movement.reason ?? null,
          reference: movement.reference ?? null,
          userId: movement.userId ?? null,
          userName: movement.userName ?? null,
          timestamp: toDate(movement.timestamp) || new Date(),
          notes: movement.notes ?? null
        }
      });
    }
  });

  console.log('Importación completada.');
}

main()
  .catch((err) => {
    console.error('Error importando snapshot:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
