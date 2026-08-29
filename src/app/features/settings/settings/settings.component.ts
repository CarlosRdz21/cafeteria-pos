import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, takeUntil } from 'rxjs';
import { SocketService } from '../../../core/services/socket.service';
import { getServerUrl, validarUrlServidorLocal } from '../../../core/config/server.config';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <!--<mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Configuracion</span>
    </mat-toolbar>-->

    <div class="settings-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Conexion al Servidor</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="connection-status">
            <mat-icon [class.connected]="isConnected" [class.disconnected]="!isConnected">
              {{ isConnected ? 'check_circle' : 'cancel' }}
            </mat-icon>
            <span>{{ isConnected ? 'Conectado' : 'Desconectado' }}</span>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>URL del Servidor</mat-label>
            <input matInput [(ngModel)]="serverUrl" placeholder="http://localhost:3000">
            <mat-hint>Esta copia sólo permite el backend local en el puerto 3000</mat-hint>
          </mat-form-field>

          <div class="toggle-field">
            <mat-slide-toggle [(ngModel)]="autoConnect">
              Conectar automaticamente al iniciar
            </mat-slide-toggle>
          </div>

          <div class="error-message" *ngIf="connectionError">
            <mat-icon>error</mat-icon>
            <span>{{ connectionError }}</span>
          </div>

          <div class="actions">
            <button mat-raised-button color="accent" (click)="connect()" [disabled]="isConnected">
              <mat-icon>link</mat-icon>
              Conectar
            </button>
            <button mat-raised-button color="warn" (click)="disconnect()" [disabled]="!isConnected">
              <mat-icon>link_off</mat-icon>
              Desconectar
            </button>
            <button mat-button (click)="runDiagnostic()">
              <mat-icon>network_check</mat-icon>
              Diagnostico
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!--<mat-card>
        <mat-card-header>
          <mat-card-title>Instrucciones</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="instructions">
            <h3>Como configurar la conexion</h3>
            <ol>
              <li>
                <strong>Inicia el backend local:</strong>
                <ul>
                  <li>Abre la carpeta <code>backend</code></li>
                  <li>Ejecuta <code>npm run dev:local</code></li>
                  <li>Comprueba <code>http://localhost:3000/api/health</code></li>
                </ul>
              </li>
              <li>
                <strong>Inicia el frontend local:</strong>
                <ul>
                  <li>En la raíz ejecuta <code>npm run start:local</code></li>
                  <li>Abre <code>http://localhost:4200</code></li>
                </ul>
              </li>
              <li>
                <strong>Conexión permitida:</strong>
                <ul>
                  <li>Usa <code>http://localhost:3000</code></li>
                  <li>Las direcciones externas se rechazan en esta rama</li>
                  <li>Click en "Conectar"</li>
                </ul>
              </li>
            </ol>

            <div class="note">
              <mat-icon>info</mat-icon>
              <p>ENTORNO LOCAL DE PRUEBAS: esta copia no debe conectarse a producción.</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>-->
    </div>
  `,
  styles: [`
    .settings-container {
      padding: 20px;
      max-width: 800px;
      margin: 0 auto;
    }

    mat-card {
      margin-bottom: 20px;
    }

    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }

    .connection-status {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 18px;
      font-weight: 500;
    }

    .connection-status mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .connection-status mat-icon.connected {
      color: #4caf50;
    }

    .connection-status mat-icon.disconnected {
      color: #f44336;
    }

    .toggle-field {
      margin: 20px 0;
    }

    .error-message {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      margin: 16px 0;
      background-color: #ffebee;
      color: #c62828;
      border-radius: 4px;
      font-size: 14px;
    }

    .error-message mat-icon {
      color: #c62828;
    }

    .actions {
      display: flex;
      gap: 12px;
      margin-top: 20px;
    }

    .actions button {
      flex: 1;
    }

    .instructions h3 {
      margin: 0 0 16px 0;
      color: var(--color-primary);
    }

    .instructions ol {
      padding-left: 20px;
    }

    .instructions li {
      margin-bottom: 12px;
    }

    .instructions ul {
      margin-top: 8px;
    }

    .instructions code {
      background-color: #f5f5f5;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Courier New', monospace;
      color: var(--color-primary);
    }

    .note {
      display: flex;
      gap: 12px;
      padding: 16px;
      background-color: #e3f2fd;
      border-radius: 8px;
      margin-top: 20px;
      align-items: flex-start;
    }

    .note mat-icon {
      color: #1976d2;
    }

    .note p {
      margin: 0;
      color: #1976d2;
    }

    @media (max-width: 768px) {
      .settings-container {
        padding: 12px;
      }

      .actions {
        flex-direction: column;
      }
    }
  `]
})
export class SettingsComponent implements OnInit, OnDestroy {
  serverUrl = getServerUrl();
  autoConnect = false;
  isConnected = false;
  connectionError = '';
  private readonly destruccion$ = new Subject<void>();
  private temporizadorConexion: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private socketService: SocketService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    const savedAutoConnect = localStorage.getItem('autoConnect');
    if (savedAutoConnect) {
      this.autoConnect = savedAutoConnect === 'true';
    }

    this.socketService.connected$
      .pipe(takeUntil(this.destruccion$))
      .subscribe(connected => {
        this.isConnected = connected;
        if (connected) {
          this.connectionError = '';
        }
      });
  }

  connect() {
    try {
      this.serverUrl = validarUrlServidorLocal(this.serverUrl);
    } catch (error) {
      this.connectionError = error instanceof Error ? error.message : 'URL local no válida.';
      this.snackBar.open(this.connectionError, 'Cerrar', {
        duration: 3000
      });
      return;
    }

    this.connectionError = '';
    localStorage.setItem('autoConnect', this.autoConnect.toString());

    this.snackBar.open('Conectando al servidor...', '', {
      duration: 2000
    });

    this.socketService.setServerUrl(this.serverUrl);
    this.socketService.connect();

    if (this.temporizadorConexion) {
      clearTimeout(this.temporizadorConexion);
    }

    this.temporizadorConexion = setTimeout(() => {
      this.temporizadorConexion = null;
      if (!this.socketService.isConnected()) {
        this.connectionError = 'No se pudo conectar. Verifica la URL y que el backend este disponible.';
        this.snackBar.open('Error de conexion. Revisa la URL del backend.', 'Cerrar', {
          duration: 5000
        });
      }
    }, 5000);
  }

  ngOnDestroy() {
    if (this.temporizadorConexion) {
      clearTimeout(this.temporizadorConexion);
      this.temporizadorConexion = null;
    }
    this.destruccion$.next();
    this.destruccion$.complete();
  }

  disconnect() {
    this.socketService.disconnect();
    this.snackBar.open('Desconectado del servidor', 'Cerrar', {
      duration: 2000
    });
  }

  runDiagnostic() {
    this.router.navigate(['/network-test']);
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}
