import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Supply, SupplyCategory, SupplyMovement } from '../models/domain.models';
import { buildApiUrl } from '../config/server.config';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  constructor(private http: HttpClient) {}

  private get suppliesApi() {
    return buildApiUrl('supplies');
  }

  private get categoriesApi() {
    return buildApiUrl('supply-categories');
  }

  private get movementsApi() {
    return buildApiUrl('supply-movements');
  }

  async addSupply(
    payload: Omit<Supply, 'id' | 'createdAt' | 'currentStock'> & { currentStock?: number }
  ) {
    return firstValueFrom(this.http.post(this.suppliesApi, payload));
  }

  async updateSupply(id: number, updates: Partial<Supply>) {
    return firstValueFrom(this.http.put(`${this.suppliesApi}/${id}`, updates));
  }

  async getSupplies() {
    return firstValueFrom(this.http.get<Supply[]>(this.suppliesApi));
  }

  async getSupplyCategories(includeInactive = false): Promise<SupplyCategory[]> {
    const rows = await firstValueFrom(this.http.get<SupplyCategory[]>(this.categoriesApi));
    if (includeInactive) return rows || [];
    return (rows || []).filter(c => c.active !== false);
  }

  async addSupplyCategory(name: string): Promise<number> {
    const created = await firstValueFrom(this.http.post<SupplyCategory>(this.categoriesApi, { name }));
    return created?.id || 0;
  }

  async recordEntry(input: {
    supplyId: number;
    quantity: number;
    unitCost?: number;
    reason?: string;
    reference?: string;
    userId?: number;
    userName?: string;
    timestamp?: Date;
    notes?: string;
  }) {
    if (input.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }
    return firstValueFrom(this.http.post(`${this.movementsApi}/entry`, input));
  }

  async recordExit(input: {
    supplyId: number;
    quantity: number;
    reason?: string;
    reference?: string;
    userId?: number;
    userName?: string;
    timestamp?: Date;
    notes?: string;
  }) {
    if (input.quantity <= 0) {
      throw new Error('La cantidad debe ser mayor a 0');
    }
    return firstValueFrom(this.http.post(`${this.movementsApi}/exit`, input));
  }

  async getMovementsByDateRange(start: Date, end: Date) {
    return firstValueFrom(this.http.get<SupplyMovement[]>(this.movementsApi, {
      params: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      }
    }));
  }
}


