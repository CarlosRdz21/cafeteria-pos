const path = require('node:path');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const { validarConfiguracionBasePruebas } = require('./test-database-safety');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env.test'),
  override: true,
  quiet: true,
});

const limpiar = process.argv.includes('--clean');
validarConfiguracionBasePruebas(process.env, { requerirDestructiva: limpiar });

const nombresUsuarios = [
  'admin_local',
  'barista_local',
  'mesero_local',
  'inactivo_local',
];
const nombresProductos = [
  'Café Americano [LOCAL]',
  'Latte [LOCAL]',
  'Cappuccino [LOCAL]',
  'Chocolate [LOCAL]',
  'Producto de prueba [LOCAL]',
];
const nombresInsumos = [
  'Café en grano [LOCAL]',
  'Leche de prueba [LOCAL]',
  'Chocolate de prueba [LOCAL]',
];
const nombreCategoriaProducto = 'Bebidas de prueba [LOCAL]';
const nombreCategoriaInsumo = 'Insumos de prueba [LOCAL]';
const idPromocion = 'promocion-local-pruebas';

async function eliminarSemilla(prisma) {
  await prisma.promotion.deleteMany({ where: { id: idPromocion } });
  await prisma.product.deleteMany({ where: { name: { in: nombresProductos } } });
  await prisma.productSupply.deleteMany({ where: { name: { in: nombresInsumos } } });
  await prisma.user.deleteMany({ where: { username: { in: nombresUsuarios } } });
  await prisma.productCategory.deleteMany({ where: { name: nombreCategoriaProducto } });
  await prisma.supplyCategory.deleteMany({ where: { name: nombreCategoriaInsumo } });
}

async function ejecutar() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    if (limpiar) {
      await eliminarSemilla(prisma);
      console.info('[LOCAL] Semilla ficticia eliminada de cafeteria_pos_test.');
      return;
    }

    const password = String(process.env.LOCAL_SEED_PASSWORD || '');
    if (password.length < 12) {
      throw new Error('Define LOCAL_SEED_PASSWORD con al menos 12 caracteres para crear el seed.');
    }
    const passwordHash = await bcrypt.hash(password, 12);

    const categoriaProducto = await prisma.productCategory.upsert({
      where: { name: nombreCategoriaProducto },
      update: { active: true, sortOrder: 100 },
      create: { name: nombreCategoriaProducto, active: true, sortOrder: 100 },
    });
    const categoriaInsumo = await prisma.supplyCategory.upsert({
      where: { name: nombreCategoriaInsumo },
      update: { active: true, sortOrder: 100 },
      create: { name: nombreCategoriaInsumo, active: true, sortOrder: 100 },
    });

    const usuarios = [
      ['admin_local', 'Administrador local', 'admin', true],
      ['barista_local', 'Barista local', 'barista', true],
      ['mesero_local', 'Mesero local', 'mesero', true],
      ['inactivo_local', 'Usuario inactivo local', 'mesero', false],
    ];
    for (const [username, name, role, active] of usuarios) {
      await prisma.user.upsert({
        where: { username },
        update: { name, role, active, password: passwordHash, email: null },
        create: { username, name, role, active, password: passwordHash },
      });
    }

    const productos = [
      ['Café Americano [LOCAL]', 35],
      ['Latte [LOCAL]', 45],
      ['Cappuccino [LOCAL]', 48],
      ['Chocolate [LOCAL]', 42],
      ['Producto de prueba [LOCAL]', 1],
    ];
    for (const [name, price] of productos) {
      const existente = await prisma.product.findFirst({ where: { name } });
      const data = {
        name,
        description: 'Dato ficticio exclusivo del entorno local.',
        price,
        image: '',
        categoryId: categoriaProducto.id,
        categoryName: categoriaProducto.name,
        available: true,
        stock: 100,
      };
      if (existente) await prisma.product.update({ where: { id: existente.id }, data });
      else await prisma.product.create({ data });
    }

    for (const name of nombresInsumos) {
      const existente = await prisma.productSupply.findFirst({ where: { name } });
      const data = {
        name,
        categoryId: categoriaInsumo.id,
        categoryName: categoriaInsumo.name,
        unit: 'unidad',
        currentStock: 100,
        unitCost: 1,
        minStock: 10,
        notes: 'Dato ficticio exclusivo del entorno local.',
        active: true,
      };
      if (existente) await prisma.productSupply.update({ where: { id: existente.id }, data });
      else await prisma.productSupply.create({ data });
    }

    await prisma.promotion.upsert({
      where: { id: idPromocion },
      update: { name: 'Promoción local de prueba', active: true },
      create: {
        id: idPromocion,
        name: 'Promoción local de prueba',
        active: true,
        type: 'percentage',
        scope: 'all',
        percentageOff: 10,
      },
    });

    console.info('[LOCAL] Seed ficticio e idempotente listo en cafeteria_pos_test.');
    console.info('[LOCAL] Usuarios: admin_local, barista_local, mesero_local e inactivo_local.');
  } finally {
    await prisma.$disconnect();
  }
}

ejecutar().catch(error => {
  console.error(error instanceof Error ? error.message : 'No se pudo preparar el seed local.');
  process.exitCode = 1;
});
