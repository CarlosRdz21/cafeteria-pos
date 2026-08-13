import { imprimirTicketConReintentos } from '../../../core/utils/impresion-ticket.utils';
import { calcularMontosSugeridos } from './checkout.component';

describe('sugerencias de efectivo del checkout', () => {
  it('sugiere los tres centenares siguientes para un total de 225', () => {
    expect(calcularMontosSugeridos(225)).toEqual([300, 400, 500]);
  });

  it('evita duplicar el botón Exacto cuando el total ya es un centenar', () => {
    expect(calcularMontosSugeridos(300)).toEqual([400, 500, 600]);
  });

  it('conserva centenares exactos con totales decimales', () => {
    expect(calcularMontosSugeridos(399.5)).toEqual([400, 500, 600]);
  });
});

describe('impresión automática del ticket', () => {
  it('imprime una vez y no abre el modal cuando tiene éxito', async () => {
    const imprimir = jasmine.createSpy('imprimir').and.resolveTo(true);
    const confirmarReintento = jasmine.createSpy('confirmarReintento');

    const resultado = await imprimirTicketConReintentos(imprimir, confirmarReintento);

    expect(resultado).toBeTrue();
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(confirmarReintento).not.toHaveBeenCalled();
  });

  it('muestra el modal tras un fallo y reintenta sólo si se confirma', async () => {
    const imprimir = jasmine.createSpy('imprimir')
      .and.returnValues(Promise.resolve(false), Promise.resolve(true));
    const confirmarReintento = jasmine.createSpy('confirmarReintento').and.resolveTo(true);

    const resultado = await imprimirTicketConReintentos(imprimir, confirmarReintento);

    expect(resultado).toBeTrue();
    expect(imprimir).toHaveBeenCalledTimes(2);
    expect(confirmarReintento).toHaveBeenCalledTimes(1);
  });

  it('permite continuar sin imprimir y no realiza otro intento', async () => {
    const imprimir = jasmine.createSpy('imprimir').and.resolveTo(false);
    const confirmarReintento = jasmine.createSpy('confirmarReintento').and.resolveTo(false);

    const resultado = await imprimirTicketConReintentos(imprimir, confirmarReintento);

    expect(resultado).toBeFalse();
    expect(imprimir).toHaveBeenCalledTimes(1);
    expect(confirmarReintento).toHaveBeenCalledTimes(1);
  });

  it('trata una excepción de la impresora como un fallo recuperable', async () => {
    const imprimir = jasmine.createSpy('imprimir').and.rejectWith(new Error('impresora desconectada'));
    const confirmarReintento = jasmine.createSpy('confirmarReintento').and.resolveTo(false);

    await expectAsync(
      imprimirTicketConReintentos(imprimir, confirmarReintento)
    ).toBeResolvedTo(false);
    expect(confirmarReintento).toHaveBeenCalledTimes(1);
  });
});
