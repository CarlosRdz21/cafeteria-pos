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
  private get API() {
    return buildApiUrl('auth');
  }

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private cashRegisterService: CashRegisterService
  ) {
    const stored = localStorage.getItem('currentUser');
    if (stored) {
      this.currentUserSubject.next(JSON.parse(stored));
    }
  }

  login(username: string, password: string) {
    return this.http.post<any>(`${this.API}/login`, { username, password }).pipe(
      tap(res => {
        const user: User = res.user;
        localStorage.setItem('token', res.token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
      })
    );
  }

  logout() {
    localStorage.clear();
    this.cashRegisterService.clearCurrentRegister();
    this.currentUserSubject.next(null);
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.getCurrentUser()?.role || '');
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }
}
