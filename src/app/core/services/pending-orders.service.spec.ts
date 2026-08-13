import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Order } from '../../shared/models/domain.models';
import { PendingOrdersService } from './pending-orders.service';

function crearPedido(id: number, status: Order['status'] = 'pending'): Order {
  return {
    id,
    items: [],
    subtotal: 40,
    tax: 0,
    total: 40,
    status,
    createdAt: '2026-07-20T12:00:00.000Z'
  };
}

describe('PendingOrdersService', () => {
  let servicio: PendingOrdersService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PendingOrdersService, provideHttpClient(), provideHttpClientTesting()]
    });
    servicio = TestBed.inject(PendingOrdersService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('carga pedidos pendientes desde el endpoint actual', () => {
    let pedidos: Order[] = [];
    servicio.pedidosPendientes$.subscribe(valor => pedidos = valor);

    void servicio.cargarPedidosPendientes();
    const solicitud = httpTesting.expectOne(req => req.urlWithParams.endsWith('/api/orders?status=pending'));
    solicitud.flush([crearPedido(1)]);

    expect(pedidos.map(pedido => pedido.id)).toEqual([1]);
  });

  it('agrega, reemplaza y retira localmente pedidos recibidos por Socket.IO', () => {
    let pedidos: Order[] = [];
    servicio.pedidosPendientes$.subscribe(valor => pedidos = valor);

    servicio.actualizarOAgregarPedidoPendiente(crearPedido(1));
    servicio.actualizarOAgregarPedidoPendiente({ ...crearPedido(1), total: 55 });
    expect(pedidos.length).toBe(1);
    expect(pedidos[0]).toEqual(jasmine.objectContaining({ id: 1, total: 55 }));

    servicio.actualizarOAgregarPedidoPendiente(crearPedido(1, 'completed'));
    expect(pedidos).toEqual([]);
  });

  it('propaga el contrato actual al completar un pedido', async () => {
    const promesa = servicio.completarPedidoPendiente(
      7,
      'cash',
      [],
      5,
      [],
      100,
      { reference: 'ref-prueba' }
    );

    const solicitud = httpTesting.expectOne(req => req.url.endsWith('/api/orders/7/status'));
    expect(solicitud.request.method).toBe('PATCH');
    expect(solicitud.request.body).toEqual({
      status: 'completed',
      paymentMethod: 'cash',
      items: [],
      discountTotal: 5,
      appliedPromotions: [],
      amountPaid: 100,
      paymentDetails: { reference: 'ref-prueba' }
    });
    solicitud.flush(crearPedido(7, 'completed'));

    await expectAsync(promesa).toBeResolved();
  });

  it('propaga el error al cancelar sin alterar silenciosamente el estado local', async () => {
    servicio.actualizarOAgregarPedidoPendiente(crearPedido(4));
    const promesa = servicio.cancelarPedidoPendiente(4);
    const solicitud = httpTesting.expectOne(req => req.url.endsWith('/api/orders/4/cancel'));
    solicitud.flush({ error: 'fallo' }, { status: 500, statusText: 'Error' });

    await expectAsync(promesa).toBeRejected();
    let ids: Array<number | undefined> = [];
    servicio.pedidosPendientes$.subscribe(pedidos => ids = pedidos.map(pedido => pedido.id));
    expect(ids).toEqual([4]);
  });
});
