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
import { AuthService } from '../../core/services/auth.service';
import { CashRegisterService } from '../../core/services/cash-register.service';
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
          </mat-card-header>

        <mat-card-content>
          <form (ngSubmit)="onLogin()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Usuario</mat-label>
                <input
                  matInput
                  type="text"
                  [(ngModel)]="username"
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
                [type]="hidePassword ? 'password' : 'text'"
                [(ngModel)]="password"
                name="password"
                placeholder="Ingresa tu contraseña"
                required
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword = !hidePassword"
              >
                <mat-icon>{{hidePassword ? 'visibility_off' : 'visibility'}}</mat-icon>
              </button>
            </mat-form-field>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width login-button"
              [disabled]="loading"
            >
              {{ loading ? 'Iniciando sesión...' : 'Iniciar Sesión' }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      padding: 20px;
    }

    mat-card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 30px;
    }

    .logo {
      width: 120px;
      height: 120px;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-bottom: 20px;
    }

    .logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    mat-card-title {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    mat-card-subtitle {
      color: rgba(0, 0, 0, 0.6);
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .login-button {
      height: 48px;
      font-size: 16px;
      font-weight: 500;
    }
  `]
})
export class LoginComponent {
  username = '';
  password = '';
  hidePassword = true;
  loading = false;

  constructor(
    private authService: AuthService,
    private cashRegisterService: CashRegisterService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  onLogin() {
    if (this.loading) return;

    if (!this.username || !this.password) {
      this.snackBar.open('Por favor completa todos los campos', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.loading = true;

    this.authService.login(this.username, this.password)
    .pipe(
      finalize(() => {
        this.loading = false;
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

