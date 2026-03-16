import { Component, OnInit } from '@angular/core';
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
import { SocketService } from '../../core/services/socket.service';
import { getServerUrl } from '../../core/config/server.config';

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
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Configuración</span>
    </mat-toolbar>

    <div class="settings-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Conexión al Servidor</mat-card-title>
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
            <input matInput [(ngModel)]="serverUrl" placeholder="http://192.168.1.100:3000">
            <mat-hint>Ingresa la IP de la computadora donde corre el servidor</mat-hint>
          </mat-form-field>

          <div class="toggle-field">
            <mat-slide-toggle [(ngModel)]="autoConnect">
              Conectar automáticamente al iniciar
            </mat-slide-toggle>
          </div>

          <div class="error-message" *ngIf="connectionError">
            <mat-icon>error</mat-icon>
            <span>{{ connectionError }}</span>
          </div>

          <div class="actions">
            <button mat-raised-button color="primary" (click)="connect()" [disabled]="isConnected">
              <mat-icon>link</mat-icon>
              Conectar
            </button>
            <button mat-raised-button color="warn" (click)="disconnect()" [disabled]="!isConnected">
              <mat-icon>link_off</mat-icon>
              Desconectar
            </button>
            <button mat-button (click)="runDiagnostic()">
              <mat-icon>network_check</mat-icon>
              Diagnóstico
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Instrucciones</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="instructions">
            <h3>Cómo configurar la conexión:</h3>
            <ol>
              <li>
                <strong>En la computadora:</strong>
                <ul>
                  <li>Ve a la carpeta <code>backend</code></li>
                  <li>Ejecuta: <code>npm run dev</code></li>
                  <li>El servidor iniciará en el puerto 3000</li>
                </ul>
              </li>
              <li>
                <strong>Obtén la IP de la computadora:</strong>
                <ul>
                  <li>Windows: <code>ipconfig</code></li>
                  <li>Mac/Linux: <code>ifconfig</code></li>
                  <li>Busca la IPv4 (ej: 192.168.1.100)</li>
                </ul>
              </li>
              <li>
                <strong>En cada dispositivo (tablets/celular):</strong>
                <ul>
                  <li>Ingresa la URL: <code>http://[IP]:3000</code></li>
                  <li>Ejemplo: <code>http://192.168.1.100:3000</code></li>
                  <li>Click en "Conectar"</li>
                </ul>
              </li>
            </ol>

            <div class="note">
              <mat-icon>info</mat-icon>
              <p>Asegúrate de que todos los dispositivos estén en la misma red WiFi</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
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
      color: #667eea;
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
      color: #667eea;
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
export class SettingsComponent implements OnInit {
  serverUrl = getServerUrl();
  autoConnect = false;
  isConnected = false;
  connectionError = '';

  constructor(
    private socketService: SocketService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit() {
    // Cargar configuración guardada
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      this.serverUrl = savedUrl;
    }

    const savedAutoConnect = localStorage.getItem('autoConnect');
    if (savedAutoConnect) {
      this.autoConnect = savedAutoConnect === 'true';
    }

    // Verificar estado de conexión
    this.socketService.connected$.subscribe(connected => {
      this.isConnected = connected;
      if (connected) {
        this.connectionError = '';
      }
    });
  }

  connect() {
    if (!this.serverUrl) {
      this.snackBar.open('Por favor ingresa la URL del servidor', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    // Limpiar error anterior
    this.connectionError = '';

    // Guardar configuración
    localStorage.setItem('serverUrl', this.serverUrl);
    localStorage.setItem('autoConnect', this.autoConnect.toString());

    // Mostrar mensaje
    this.snackBar.open('Conectando al servidor...', '', {
      duration: 2000
    });

    // Conectar
    console.log('Iniciando conexión a:', this.serverUrl);
    this.socketService.setServerUrl(this.serverUrl);
    this.socketService.connect();

    // Verificar conexión después de 5 segundos
    setTimeout(() => {
      if (!this.socketService.isConnected()) {
        this.connectionError = 'No se pudo conectar. Verifica la URL y que el servidor esté corriendo.';
        this.snackBar.open('Error de conexión. Abre la consola para más detalles.', 'Cerrar', {
          duration: 5000
        });
      }
    }, 5000);
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
