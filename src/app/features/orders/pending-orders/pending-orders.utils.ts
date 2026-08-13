import { Order, OrderItem, Product } from '../../../shared/models/domain.models';

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

/** Convierte una respuesta dinámica de productos al modelo seguro de la UI. */
export function mapearProductoApi(valor: unknown): Product {
  const datos = esRegistro(valor) ? valor : {};

  return {
    id: Number.isFinite(Number(datos['id'])) ? Number(datos['id']) : undefined,
    name: typeof datos['name'] === 'string' ? datos['name'] : '',
    description: typeof datos['description'] === 'string' ? datos['description'] : '',
    price: Number.isFinite(Number(datos['price'])) ? Number(datos['price']) : 0,
    image: typeof datos['image'] === 'string' ? datos['image'] : '',
    category: typeof datos['categoryName'] === 'string' ? datos['categoryName'] : '',
    categoryId: Number.isFinite(Number(datos['categoryId'])) ? Number(datos['categoryId']) : undefined,
    available: datos['available'] !== false
  };
}

export function rastrearPedidoPorId(_indice: number, pedido: Pick<Order, 'id'>): number | undefined {
  return pedido.id;
}

export function rastrearProductoPedido(
  _indice: number,
  producto: Pick<OrderItem, 'id' | 'productId'>
): number | undefined {
  return producto.id ?? producto.productId;
}
