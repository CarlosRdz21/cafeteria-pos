import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { CashRegister } from '../models/domain.models';
import { buildApiUrl } from '../config/server.config';

@Injectable({
  providedIn: 'root'
})
export class CashRegisterService {
  private currentRegisterSubject = new BehaviorSubject<CashRegister | null>(null);
  public currentRegister$ = this.currentRegisterSubject.asObservable();
  private readonly initPromise: Promise<void>;

  private get API() {
    return buildApiUrl('cash-registers');
  }

  constructor(private http: HttpClient) {
    this.initPromise = this.loadCurrentRegister();
  }

  private async loadCurrentRegister() {
    try {
      const row = await this.http.get<any>(`${this.API}/current`).toPromise();
      this.currentRegisterSubject.next(this.mapRegister(row));
    } catch (error) {
      console.error('Error al cargar caja actual desde API:', error);
      this.currentRegisterSubject.next(null);
    }
  }

  async openRegister(openingAmount: number, userId: string): Promise<number | null> {
    try {
      const created = await this.http.post<any>(`${this.API}/open`, {
        openingAmount,
        userId
      }).toPromise();
      const mapped = this.mapRegister(created);
      this.currentRegisterSubject.next(mapped);
      return mapped?.id ?? null;
    } catch (error) {
      console.error('Error al abrir caja:', error);
      return null;
    }
  }

  async closeRegister(closingAmount: number): Promise<boolean> {
    try {
      const updated = await this.http.post<any>(`${this.API}/current/close`, {
        closingAmount
      }).toPromise();
      if (!updated) throw new Error('No hay caja abierta');
      this.currentRegisterSubject.next(null);
      return true;
    } catch (error) {
      console.error('Error al cerrar caja:', error);
      return false;
    }
  }

  async recordSale(amount: number, paymentMethod: 'cash' | 'card'): Promise<void> {
    await this.http.post(`${this.API}/current/record-sale`, {
      amount,
      paymentMethod
    }).toPromise();
    await this.loadCurrentRegister();
  }

  async recordExpense(amount: number): Promise<void> {
    await this.http.post(`${this.API}/current/record-expense`, { amount }).toPromise();
    await this.loadCurrentRegister();
  }

  getCurrentRegister(): CashRegister | null {
    return this.currentRegisterSubject.value;
  }

  clearCurrentRegister(): void {
    this.currentRegisterSubject.next(null);
  }

  isRegisterOpen(): boolean {
    return this.currentRegisterSubject.value !== null;
  }

  async getRegisterHistory(limit: number = 10): Promise<CashRegister[]> {
    try {
      const rows = await this.http.get<any[]>(`${this.API}?limit=${limit}`).toPromise();
      return (rows || []).map(row => this.mapRegister(row)).filter((row): row is CashRegister => !!row);
    } catch (error) {
      console.error('Error al cargar historial de caja desde API:', error);
      return [];
    }
  }

  async ensureInitialized(): Promise<void> {
    await this.initPromise;
  }

  async refreshCurrentRegister(): Promise<void> {
    await this.loadCurrentRegister();
  }

  private mapRegister(row: any): CashRegister | null {
    if (!row || typeof row !== 'object') return null;
    return {
      id: Number.isFinite(Number(row.id)) ? Number(row.id) : undefined,
      openingAmount: Number(row.openingAmount ?? 0),
      closingAmount: row.closingAmount == null ? undefined : Number(row.closingAmount),
      expectedAmount: row.expectedAmount == null ? undefined : Number(row.expectedAmount),
      difference: row.difference == null ? undefined : Number(row.difference),
      cashSales: Number(row.cashSales ?? 0),
      cardSales: Number(row.cardSales ?? 0),
      expenses: Number(row.expenses ?? 0),
      totalTransactions: Number(row.totalTransactions ?? 0),
      openedAt: row.openedAt ? new Date(row.openedAt) : new Date(),
      closedAt: row.closedAt ? new Date(row.closedAt) : undefined,
      status: row.status === 'closed' ? 'closed' : 'open',
      userId: String(row.userRef ?? row.userId ?? '')
    };
  }
}


