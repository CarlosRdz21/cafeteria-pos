import {
  mapearProductoApi,
  rastrearPedidoPorId,
  rastrearProductoPedido
} from './pending-orders.utils';

describe('mapearProductoApi', () => {
  it('convierte la respuesta conocida de productos al modelo de UI', () => {
    expect(mapearProductoApi({
      id: '8',
      name: 'Latte',
      description: 'Café con leche',
      price: '48.50',
      image: 'latte.webp',
      categoryName: 'Bebidas',
      categoryId: '2',
      available: true
    })).toEqual({
      id: 8,
      name: 'Latte',
      description: 'Café con leche',
      price: 48.5,
      image: 'latte.webp',
      category: 'Bebidas',
      categoryId: 2,
      available: true
    });
  });

  it('aplica los mismos valores seguros ante una respuesta desconocida', () => {
    expect(mapearProductoApi(null)).toEqual({
      id: undefined,
      name: '',
      description: '',
      price: 0,
      image: '',
      category: '',
      categoryId: undefined,
      available: true
    });
  });
});

describe('claves estables de pedidos pendientes', () => {
  it('conserva la identidad del pedido cuando Socket.IO entrega una nueva instancia', () => {
    expect(rastrearPedidoPorId(0, { id: 25 })).toBe(
      rastrearPedidoPorId(3, { id: 25 })
    );
  });

  it('prioriza el id del renglon y usa productId cuando el renglon aun no tiene id', () => {
    expect(rastrearProductoPedido(0, { id: 9, productId: 4 })).toBe(9);
    expect(rastrearProductoPedido(1, { productId: 4 })).toBe(4);
  });
});
