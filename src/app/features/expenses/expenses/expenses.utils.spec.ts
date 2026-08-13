import { Expense } from '../../../shared/models/domain.models';
import { calcularTotalGastos, filtrarGastos, resumirGastosPorCategoria } from './expenses.utils';

const gastos: Expense[] = [
  { amount: 30, category: 'Insumos', timestamp: new Date('2026-07-10T12:00:00') },
  { amount: 20, category: 'Limpieza', timestamp: new Date('2026-07-11T12:00:00') },
  { amount: 15, category: 'Insumos', timestamp: new Date('2026-07-12T12:00:00') }
];

describe('utilidades de gastos', () => {
  it('filtra por rango inclusivo y categoría', () => {
    const resultado = filtrarGastos(
      gastos,
      new Date('2026-07-10T00:00:00'),
      new Date('2026-07-11T23:59:59'),
      'Insumos'
    );

    expect(resultado).toEqual([gastos[0]]);
  });

  it('calcula el total sin modificar los gastos', () => {
    expect(calcularTotalGastos(gastos)).toBe(65);
  });

  it('mantiene el orden de aparición al resumir categorías', () => {
    expect(resumirGastosPorCategoria(gastos)).toEqual([
      { category: 'Insumos', total: 45 },
      { category: 'Limpieza', total: 20 }
    ]);
  });
});
