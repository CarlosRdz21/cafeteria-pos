import { Expense } from '../../../shared/models/domain.models';

export interface CategoryTotal {
  category: string;
  total: number;
}

/** Filtra gastos con límites de fecha inclusivos, igual que la consulta visual. */
export function filtrarGastos(
  gastos: Expense[],
  inicio: Date,
  fin: Date,
  categoria: string
): Expense[] {
  const inicioMs = inicio.getTime();
  const finMs = fin.getTime();

  return gastos.filter(gasto => {
    const fechaMs = new Date(gasto.timestamp).getTime();
    const dentroDelRango = fechaMs >= inicioMs && fechaMs <= finMs;
    const coincideCategoria = categoria === 'all' || gasto.category === categoria;
    return dentroDelRango && coincideCategoria;
  });
}

export function calcularTotalGastos(gastos: Expense[]): number {
  return gastos.reduce((total, gasto) => total + gasto.amount, 0);
}

/** Agrupa sin ordenar para conservar el orden de aparición de las categorías. */
export function resumirGastosPorCategoria(gastos: Expense[]): CategoryTotal[] {
  const totales = new Map<string, number>();
  for (const gasto of gastos) {
    totales.set(gasto.category, (totales.get(gasto.category) || 0) + gasto.amount);
  }

  return Array.from(totales.entries()).map(([category, total]) => ({ category, total }));
}
