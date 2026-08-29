import { Order } from '../../../shared/models/domain.models';
import { ReportsComponent } from './reports.component';

const ventaPrueba: Order = {
  id: 25,
  items: [{
    productId: 10,
    name: 'Producto de prueba',
    price: 85,
    quantity: 1,
    subtotal: 85
  }],
  subtotal: 85,
  tax: 0,
  total: 85,
  status: 'completed',
  createdAt: '2026-07-29T12:00:00.000Z',
  paymentMethod: 'cash',
  amountPaid: 100,
  change: 15
};

function crearComponente(resultadosImpresion: boolean[] = [true]) {
  const printerService = {
    getConfig: jasmine.createSpy('getConfig').and.returnValue({
      businessName: 'Cafetería de prueba',
      businessAddress: '',
      businessPhone: ''
    }),
    printReceipt: jasmine.createSpy('printReceipt').and.callFake(
      () => Promise.resolve(resultadosImpresion.shift() ?? false)
    )
  };
  const uiDialog = {
    confirm: jasmine.createSpy('confirm').and.resolveTo(true)
  };
  const snackBar = { open: jasmine.createSpy('open') };

  const componente = new ReportsComponent(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    printerService as never,
    uiDialog as never,
    {} as never,
    snackBar as never
  );

  return { componente, printerService, uiDialog, snackBar };
}

function crearPromesaControlada<T>() {
  let resolver!: (value: T) => void;
  const promise = new Promise<T>(resolve => resolver = resolve);
  return { promise, resolver };
}

describe('reimpresión de tickets desde reportes', () => {
  for (const rol of ['administrador', 'barista']) {
    it(`permite reimprimir una venta al rol ${rol} sin modificarla`, async () => {
      const dependencias = crearComponente();
      const venta = structuredClone(ventaPrueba);
      const estadoInicial = structuredClone(venta);
      dependencias.componente.isAdminView = rol === 'administrador';
      dependencias.componente.isBaristaView = rol === 'barista';

      await dependencias.componente.reprintTicket(venta);

      expect(dependencias.printerService.printReceipt).toHaveBeenCalledOnceWith(
        venta,
        jasmine.any(Object)
      );
      expect(dependencias.uiDialog.confirm).not.toHaveBeenCalled();
      expect(venta).toEqual(estadoInicial);
    });
  }

  it('muestra el modal y reintenta cuando falla la primera impresión', async () => {
    const dependencias = crearComponente([false, true]);

    await dependencias.componente.reprintTicket(structuredClone(ventaPrueba));

    expect(dependencias.printerService.printReceipt).toHaveBeenCalledTimes(2);
    expect(dependencias.uiDialog.confirm).toHaveBeenCalledTimes(1);
  });
});

describe('carga de reportes', () => {
  it('conserva seleccionado el periodo personalizado y respeta sus fechas', () => {
    const dependencias = crearComponente();
    const inicio = new Date('2026-07-27T12:00:00.000Z');
    const fin = new Date('2026-07-29T12:00:00.000Z');
    dependencias.componente.startDate = inicio;
    dependencias.componente.endDate = fin;
    spyOn(dependencias.componente, 'loadReports').and.resolveTo();

    dependencias.componente.onPeriodChange('custom');

    expect(dependencias.componente.selectedPeriod).toBe('custom');
    expect(dependencias.componente.startDate).toBe(inicio);
    expect(dependencias.componente.endDate).toBe(fin);
  });

  it('ignora una respuesta anterior que termina despues del rango mas reciente', async () => {
    const primera = crearPromesaControlada<unknown[]>();
    const segunda = crearPromesaControlada<unknown[]>();
    const paymentService = {
      getPaymentsByDateRange: jasmine.createSpy('getPaymentsByDateRange').and.returnValues(
        primera.promise,
        segunda.promise
      )
    };
    const expenseService = {
      obtenerPorRangoFechas: jasmine.createSpy('obtenerPorRangoFechas').and.resolveTo([])
    };
    const componente = new ReportsComponent(
      {} as never,
      paymentService as never,
      {} as never,
      expenseService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { open: jasmine.createSpy('open') } as never
    );

    const cargaAnterior = componente.loadReports();
    const cargaReciente = componente.loadReports();
    segunda.resolver([{
      id: 2,
      method: 'cash',
      amount: 100,
      paidAt: '2026-07-29T12:00:00.000Z',
      order: { ...ventaPrueba, id: 2, total: 100 }
    }]);
    await cargaReciente;
    primera.resolver([]);
    await cargaAnterior;

    expect(componente.stats.totalSales).toBe(100);
    expect(componente.stats.totalOrders).toBe(1);
  });
});

describe('presentación del resumen de reportes', () => {
  it('representa una distribución mixta de efectivo y tarjeta con datos reales', () => {
    const { componente } = crearComponente();
    componente.stats.totalSales = 760;
    componente.stats.cashSales = 500;
    componente.stats.cardSales = 260;

    expect(componente.getPercentage(componente.stats.cashSales)).toBeCloseTo(65.79, 2);
    expect(componente.getPercentage(componente.stats.cardSales)).toBeCloseTo(34.21, 2);
    expect(componente.getPaymentDonutBackground()).toContain('65.789');
    expect(componente.getPrimaryPaymentMethod()).toBe('Efectivo');
  });

  it('mantiene en cero las barras sin ventas', () => {
    const { componente } = crearComponente();
    componente.weekdaySales = [
      { label: 'Lunes', shortLabel: 'Lun', total: 0 },
      { label: 'Martes', shortLabel: 'Mar', total: 100 }
    ];

    expect(componente.getWeekdaySalesBarHeight(0)).toBe(0);
    expect(componente.getWeekdaySalesBarHeight(100)).toBeGreaterThan(0);
  });

  it('muestra las horas del eje en formato de 24 horas', () => {
    const { componente } = crearComponente();

    expect(componente.formatHourLabel(7)).toBe('07:00');
    expect(componente.formatHourLabel(13)).toBe('13:00');
    expect(componente.formatHourLabel(22)).toBe('22:00');
  });
});
