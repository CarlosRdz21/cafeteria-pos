import { of } from 'rxjs';
import { Expense } from '../../shared/models/domain.models';
import { ExpenseService } from './expense.service';

describe('ExpenseService', () => {
  it('envia la misma clave de idempotencia en el cuerpo y el encabezado', async () => {
    const gasto: Omit<Expense, 'id'> = {
      idempotencyKey: 'gasto-intencion-1',
      concept: 'Leche',
      amount: 100,
      category: 'Insumos',
      timestamp: new Date('2026-08-27T12:00:00.000Z'),
      paidFromCashRegister: true,
    };
    const http = {
      post: jasmine.createSpy('post').and.returnValue(of({ id: 10, ...gasto })),
    };
    const service = new ExpenseService(http as never);

    const resultado = await service.crear(gasto);

    expect(http.post).toHaveBeenCalledWith(
      jasmine.any(String),
      gasto,
      { headers: { 'Idempotency-Key': 'gasto-intencion-1' } },
    );
    expect(resultado.id).toBe(10);
    expect(resultado.timestamp).toEqual(gasto.timestamp);
  });
});
