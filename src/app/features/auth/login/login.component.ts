import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/auth/auth.service';
import { CashRegisterService } from '../../../core/services/cash-register.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="login-container">
        <mat-card class="login-card">
          <mat-card-header>
            <div class="logo">
              <img src="assets/images/Logo-Cafeteria.png" alt="Logo Dulce Aroma Cafe" />
            </div>
            <mat-card-title>Dulce Aroma Café POS</mat-card-title>
            <mat-card-subtitle>Accede a tu espacio de trabajo</mat-card-subtitle>
          </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="iniciarSesion()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Usuario</mat-label>
                <input
                  matInput
                  type="text"
                  [(ngModel)]="nombreUsuario"
                  name="username"
                  placeholder="Ingresa tu usuario"
                  required
                />
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contraseña</mat-label>
              <input
                matInput
                [type]="ocultarContrasena ? 'password' : 'text'"
                [(ngModel)]="contrasena"
                name="password"
                placeholder="Ingresa tu contraseña"
                required
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="ocultarContrasena = !ocultarContrasena"
              >
                <mat-icon>{{ocultarContrasena ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width login-button"
              [disabled]="estaCargando"
            >
              {{ estaCargando ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: var(--app-viewport-height);
      overflow: hidden;
      background:
        radial-gradient(circle at 15% 15%, rgba(196, 147, 98, 0.2), transparent 30%),
        radial-gradient(circle at 85% 80%, rgba(111, 166, 111, 0.1), transparent 28%),
        linear-gradient(145deg, #160c07 0%, var(--color-bg-primary) 46%, #24140c 100%);
      padding: clamp(20px, 4vw, 48px);
    }

    .login-container::before,
    .login-container::after {
      position: absolute;
      border: 1px solid rgba(240, 212, 181, 0.08);
      border-radius: 50%;
      content: '';
      pointer-events: none;
    }

    .login-container::before {
      top: -190px;
      right: -120px;
      width: 430px;
      height: 430px;
    }

    .login-container::after {
      bottom: -220px;
      left: -140px;
      width: 520px;
      height: 520px;
    }

    .login-card {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 430px;
      padding: clamp(24px, 5vw, 42px);
      border-color: rgba(240, 212, 181, 0.2) !important;
      background: rgba(45, 28, 18, 0.94) !important;
      box-shadow: 0 28px 70px rgba(5, 2, 1, 0.46) !important;
      backdrop-filter: blur(18px);
    }

    mat-card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 26px;
    }

    .logo {
      width: 126px;
      height: 126px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 18px;
      overflow: hidden;
      border: 1px solid rgba(240, 212, 181, 0.28);
      border-radius: 28px;
      background: var(--color-cream-soft);
      box-shadow: 0 16px 34px rgba(8, 4, 2, 0.3);
    }

    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    mat-card-title {
      font-size: 28px;
      font-weight: 750;
      margin-bottom: 8px;
      color: var(--color-text-primary);
      letter-spacing: -0.03em;
    }

    mat-card-subtitle {
      margin-top: 6px;
      color: var(--color-text-secondary);
      font-size: 0.9rem;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .login-button {
      height: 52px;
      font-size: 16px;
      font-weight: 750;
      letter-spacing: 0.01em;
    }

    @media (max-width: 480px) {
      .login-container {
        align-items: stretch;
        padding: 14px;
      }

      .login-card {
        align-self: center;
        padding: 26px 20px;
      }

      .logo {
        width: 104px;
        height: 104px;
      }

      mat-card-title {
        font-size: 23px;
      }
    }
  `]
})
export class LoginComponent {
  nombreUsuario = '';
  contrasena = '';
  ocultarContrasena = true;
  estaCargando = false;

  constructor(
    private authService: AuthService,
    private cashRegisterService: CashRegisterService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  iniciarSesion() {
    if (this.estaCargando) return;

    if (!this.nombreUsuario || !this.contrasena) {
      this.snackBar.open('Por favor completa todos los campos', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.estaCargando = true;

    this.authService.login(this.nombreUsuario, this.contrasena)
    .pipe(
      finalize(() => {
        this.estaCargando = false;
      })
    )
    .subscribe({
      next: async () => {
        await this.cashRegisterService.refreshCurrentRegister();
        const targetRoute = this.cashRegisterService.isRegisterOpen() ? '/pos' : '/cash-register';
        this.router.navigate([targetRoute]);
      },
      error: () => {
        this.snackBar.open('Credenciales incorrectas', 'Cerrar', {
          duration: 3000
        });
      }
    });

  }
}
