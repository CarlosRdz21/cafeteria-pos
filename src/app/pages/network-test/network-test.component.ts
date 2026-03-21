import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { getServerUrl } from '../../core/config/server.config';

@Component({
  selector: 'app-network-test',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatToolbarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Diagnóstico de Red</span>
    </mat-toolbar>

    <div class="test-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Probar Conexión al Servidor</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>URL del Servidor</mat-label>
            <input matInput [(ngModel)]="serverUrl" placeholder="http://192.168.1.100:3000">
          </mat-form-field>

          <button mat-raised-button color="primary" (click)="testConnection()" [disabled]="testing">
            <mat-icon>network_check</mat-icon>
            {{ testing ? 'Probando...' : 'Probar Conexión' }}
          </button>

          <div class="test-result" *ngIf="testResult">
            <div class="result-item" [class.success]="testResult.ping" [class.error]="!testResult.ping">
              <mat-icon>{{ testResult.ping ? 'check_circle' : 'cancel' }}</mat-icon>
              <span>Ping al servidor: {{ testResult.ping ? 'OK' : 'Fallido' }}</span>
            </div>

            <div class="result-item" [class.success]="testResult.api" [class.error]="!testResult.api">
              <mat-icon>{{ testResult.api ? 'check_circle' : 'cancel' }}</mat-icon>
              <span>API REST: {{ testResult.api ? 'OK' : 'Fallido' }}</span>
            </div>

            <div class="result-item" [class.success]="testResult.socket" [class.error]="!testResult.socket">
              <mat-icon>{{ testResult.socket ? 'check_circle' : 'cancel' }}</mat-icon>
              <span>Socket.IO: {{ testResult.socket ? 'OK' : 'Fallido' }}</span>
            </div>

            <div class="details" *ngIf="testResult.details">
              <strong>Detalles:</strong>
              <pre>{{ testResult.details }}</pre>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Instrucciones de Solución</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="instructions">
            <h3>Si la conexión falla:</h3>

            <div class="step">
              <strong>1. Verifica que el servidor esté corriendo</strong>
              <p>En la computadora, ejecuta:</p>
              <code>cd backend</code>
              <code>npm run dev</code>
            </div>

            <div class="step">
              <strong>2. Confirma la IP correcta</strong>
              <p>Windows: <code>ipconfig</code></p>
              <p>Mac/Linux: <code>ifconfig</code></p>
              <p>Busca la IPv4 (ej: 192.168.1.100)</p>
            </div>

            <div class="step">
              <strong>3. Misma red WiFi</strong>
              <p>Asegúrate de que el celular/tablet y la computadora estén conectados a la misma red WiFi.</p>
            </div>

            <div class="step">
              <strong>4. Firewall de Windows</strong>
              <p>Agrega una regla para permitir el puerto 3000:</p>
              <ul>
                <li>Windows Defender Firewall</li>
                <li>Configuración avanzada</li>
                <li>Reglas de entrada → Nueva regla</li>
                <li>Puerto TCP 3000</li>
                <li>Permitir conexión</li>
              </ul>
            </div>

            <div class="step">
              <strong>5. Prueba desde el navegador</strong>
              <p>Abre el navegador del celular y visita:</p>
              <code>http://[TU-IP]:3000/api/health</code>
              <p>Deberías ver un JSON con "status": "ok"</p>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .test-container {
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

    .test-result {
      margin-top: 24px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .result-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      margin-bottom: 8px;
      border-radius: 4px;
    }

    .result-item.success {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .result-item.error {
      background-color: #ffebee;
      color: #c62828;
    }

    .details {
      margin-top: 16px;
      padding: 12px;
      background-color: white;
      border-radius: 4px;
    }

    .details pre {
      font-size: 12px;
      overflow-x: auto;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .instructions h3 {
      color: #667eea;
      margin-bottom: 16px;
    }

    .step {
      margin-bottom: 24px;
      padding: 16px;
      background-color: #f5f5f5;
      border-radius: 8px;
    }

    .step strong {
      display: block;
      margin-bottom: 8px;
      color: #667eea;
    }

    .step p {
      margin: 4px 0;
    }

    .step code {
      display: block;
      background-color: #263238;
      color: #aed581;
      padding: 8px;
      border-radius: 4px;
      margin: 4px 0;
      font-family: 'Courier New', monospace;
    }

    .step ul {
      margin: 8px 0;
      padding-left: 24px;
    }

    @media (max-width: 768px) {
      .test-container {
        padding: 12px;
      }
    }
  `]
})
export class NetworkTestComponent {
  serverUrl = getServerUrl();
  testing = false;
  testResult: any = null;

  constructor(private router: Router) {
    const savedUrl = localStorage.getItem('serverUrl');
    if (savedUrl) {
      this.serverUrl = savedUrl;
    }
  }

  async testConnection() {
    this.testing = true;
    this.testResult = null;

    const result = {
      ping: false,
      api: false,
      socket: false,
      details: ''
    };

    try {
      // Test 1: Ping básico a la API
      const pingResponse = await fetch(`${this.serverUrl}/api/health`, {
        method: 'GET',
        mode: 'cors'
      });

      result.ping = pingResponse.ok;

      if (result.ping) {
        const data = await pingResponse.json();
        result.api = data?.ok === true || data?.status === 'ok' || data?.status === 'healthy';
        result.details += `✅ API respondió: ${JSON.stringify(data, null, 2)}\n\n`;
      }
    } catch (error: any) {
      result.details += `❌ Error al conectar: ${error.message}\n\n`;
      
      if (error.message.includes('Failed to fetch')) {
        result.details += 'Posibles causas:\n';
        result.details += '- El servidor no está corriendo\n';
        result.details += '- Firewall bloqueando el puerto 3000\n';
        result.details += '- IP incorrecta\n';
        result.details += '- No están en la misma red WiFi\n';
      }
    }

    // Test 2: Socket.IO
    try {
      const { io } = await import('socket.io-client');
      const socket = io(this.serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.disconnect();
          reject(new Error('Timeout esperando conexión Socket.IO'));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          result.socket = true;
          result.details += '✅ Socket.IO conectado exitosamente\n';
          socket.disconnect();
          resolve(true);
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          result.details += `❌ Error Socket.IO: ${error.message}\n`;
          reject(error);
        });
      });
    } catch (error: any) {
      result.details += `❌ Socket.IO falló: ${error.message}\n`;
    }

    this.testResult = result;
    this.testing = false;
  }

  goBack() {
    this.router.navigate(['/settings']);
  }
}
