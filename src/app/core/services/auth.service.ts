import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { buildApiUrl } from '../config/server.config';
import { CashRegisterService } from './cash-register.service';

export interface User {
  id: number;
  name: string;
  role: 'admin' | 'barista' | 'waiter';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenStorageKey = 'token';
  private readonly currentUserStorageKey = 'currentUser';

  private get API() {
    return buildApiUrl('auth');
  }

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cashRegisterService: CashRegisterService
  ) {
    const stored = sessionStorage.getItem(this.currentUserStorageKey);
    if (stored) {
      this.currentUserSubject.next(JSON.parse(stored));
    }

    // Limpia credenciales heredadas que antes se guardaban de forma persistente.
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.currentUserStorageKey);
  }

  login(username: string, password: string) {
    return this.http.post<any>(`${this.API}/login`, { username, password }).pipe(
      tap(res => {
        const user: User = res.user;
        sessionStorage.setItem(this.tokenStorageKey, res.token);
        sessionStorage.setItem(this.currentUserStorageKey, JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  logout() {
    sessionStorage.removeItem(this.tokenStorageKey);
    sessionStorage.removeItem(this.currentUserStorageKey);
    localStorage.removeItem(this.tokenStorageKey);
    localStorage.removeItem(this.currentUserStorageKey);
    this.cashRegisterService.clearCurrentRegister();
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem(this.tokenStorageKey);
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.getCurrentUser()?.role || '');
  }

  get token(): string | null {
    return sessionStorage.getItem(this.tokenStorageKey);
  }
}
