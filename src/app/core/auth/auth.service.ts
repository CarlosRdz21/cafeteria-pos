import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap } from 'rxjs';
import { buildApiUrl } from '../config/server.config';
import { CashRegisterService } from '../services/cash-register.service';

export interface User {
  id: number;
  name: string;
  role: 'admin' | 'barista' | 'mesero' | 'waiter';
}

interface LoginResponse {
  token: string;
  user: User;
}

interface JwtPayload {
  exp?: number;
}

/** Considera inválido cualquier JWT ilegible o sin expiración para cerrar la sesión de forma segura. */
export function estaJwtExpirado(token: string, instanteActualSegundos = Math.floor(Date.now() / 1000)): boolean {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return true;
    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as JwtPayload;
    return typeof payload.exp !== 'number' || payload.exp <= instanteActualSegundos;
  } catch {
    return true;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly claveAlmacenamientoToken = 'token';
  private readonly claveAlmacenamientoUsuarioActual = 'currentUser';

  private get API() {
    return buildApiUrl('auth');
  }

  private sujetoUsuarioActual = new BehaviorSubject<User | null>(null);
  usuarioActual$ = this.sujetoUsuarioActual.asObservable();

  constructor(
    private http: HttpClient,
    private cashRegisterService: CashRegisterService
  ) {
    const tokenAlmacenado = sessionStorage.getItem(this.claveAlmacenamientoToken);
    const usuarioAlmacenado = sessionStorage.getItem(this.claveAlmacenamientoUsuarioActual);
    if (tokenAlmacenado && usuarioAlmacenado && !estaJwtExpirado(tokenAlmacenado)) {
      try {
        this.sujetoUsuarioActual.next(JSON.parse(usuarioAlmacenado));
      } catch {
        this.limpiarSesion();
      }
    } else if (tokenAlmacenado || usuarioAlmacenado) {
      this.limpiarSesion();
    }

    // Limpia credenciales heredadas que antes se guardaban de forma persistente.
    localStorage.removeItem(this.claveAlmacenamientoToken);
    localStorage.removeItem(this.claveAlmacenamientoUsuarioActual);
  }

  login(nombreUsuario: string, contrasena: string) {
    return this.http.post<LoginResponse>(`${this.API}/login`, {
      username: nombreUsuario,
      password: contrasena
    }).pipe(
      tap(respuesta => {
        const usuario: User = respuesta.user;
        sessionStorage.setItem(this.claveAlmacenamientoToken, respuesta.token);
        sessionStorage.setItem(this.claveAlmacenamientoUsuarioActual, JSON.stringify(usuario));
        this.sujetoUsuarioActual.next(usuario);
      })
    );
  }

  logout() {
    this.limpiarSesion();
  }

  /** Elimina credenciales de ambos almacenamientos para cubrir sesiones de versiones anteriores. */
  private limpiarSesion() {
    sessionStorage.removeItem(this.claveAlmacenamientoToken);
    sessionStorage.removeItem(this.claveAlmacenamientoUsuarioActual);
    localStorage.removeItem(this.claveAlmacenamientoToken);
    localStorage.removeItem(this.claveAlmacenamientoUsuarioActual);
    this.cashRegisterService.clearCurrentRegister();
    this.sujetoUsuarioActual.next(null);
  }

  getCurrentUser(): User | null {
    return this.sujetoUsuarioActual.value;
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  isAdmin(): boolean {
    return this.getCurrentUser()?.role === 'admin';
  }

  hasRole(...roles: string[]): boolean {
    return roles.includes(this.getCurrentUser()?.role || '');
  }

  get token(): string | null {
    const token = sessionStorage.getItem(this.claveAlmacenamientoToken);
    if (!token || estaJwtExpirado(token)) {
      if (token) this.limpiarSesion();
      return null;
    }
    return token;
  }
}
