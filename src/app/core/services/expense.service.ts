import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { buildApiUrl } from '../config/server.config';
import { Expense } from '../models/domain.models';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private get api() {
    return buildApiUrl('expenses');
  }

  constructor(private http: HttpClient) {}

  async getByDateRange(start: Date, end: Date): Promise<Expense[]> {
    const rows = await firstValueFrom(this.http.get<Expense[]>(this.api, {
      params: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    }));
    return (rows || []).map(row => ({
      ...row,
      timestamp: row.timestamp ? new Date(row.timestamp) : new Date()
    }));
  }

  async create(payload: Omit<Expense, 'id'>): Promise<Expense> {
    const created = await firstValueFrom(this.http.post<Expense>(this.api, payload));
    return {
      ...created,
      timestamp: created?.timestamp ? new Date(created.timestamp) : new Date()
    };
  }
}


