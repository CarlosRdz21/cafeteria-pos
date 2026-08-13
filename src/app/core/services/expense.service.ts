import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/server.config';
import { Expense } from '../../shared/models/domain.models';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private get api() {
    return buildApiUrl('expenses');
  }

  constructor(private http: HttpClient) {}

  async obtenerPorRangoFechas(inicio: Date, fin: Date): Promise<Expense[]> {
    const gastos = await firstValueFrom(this.http.get<Expense[]>(this.api, {
      params: {
        startDate: inicio.toISOString(),
        endDate: fin.toISOString()
      }
    }));
    return (gastos || []).map(gasto => ({
      ...gasto,
      timestamp: gasto.timestamp ? new Date(gasto.timestamp) : new Date()
    }));
  }

  async crear(datosGasto: Omit<Expense, 'id'>): Promise<Expense> {
    const gastoCreado = await firstValueFrom(this.http.post<Expense>(this.api, datosGasto));
    return {
      ...gastoCreado,
      timestamp: gastoCreado?.timestamp ? new Date(gastoCreado.timestamp) : new Date()
    };
  }

  async eliminar(idGasto: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.api}/${idGasto}`));
  }
}
