import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { KnownPrinter, PrinterConfig, PrinterService } from '../../../core/services/printer.service';

@Component({
  selector: 'app-printer-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatSelectModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Configuracion de Impresora</span>
    </mat-toolbar>

    <div class="container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Conexion Bluetooth</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="status">
            <mat-icon [class.ok]="connected" [class.bad]="!connected">
              {{ connected ? 'check_circle' : 'cancel' }}
            </mat-icon>
            <span>{{ connected ? 'Conectada' : 'Desconectada' }}</span>
          </div>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Impresora vinculada</mat-label>
            <mat-select [(ngModel)]="config.bluetoothName">
              <mat-option *ngFor="let printer of knownPrinters" [value]="printer.name">
                {{ printer.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full" *ngIf="knownPrinters.length === 0">
            <mat-label>Nombre Bluetooth de impresora</mat-label>
            <input matInput [(ngModel)]="config.bluetoothName" placeholder="BlueTooth Printer" />
          </mat-form-field>

          <div class="actions">
            <button mat-raised-button color="accent" (click)="pairPrinter()">Buscar / agregar impresora</button>
            <button mat-raised-button color="primary" (click)="connect()">Conectar</button>
            <button mat-raised-button color="warn" (click)="disconnect()">Desconectar</button>
            <button mat-raised-button (click)="printTest()">Imprimir prueba</button>
          </div>

          <div class="bt-message" *ngIf="lastBluetoothMessage">
            {{ lastBluetoothMessage }}
          </div>
        </mat-card-content>
      </mat-card>

      <mat-card>
        <mat-card-header>
          <mat-card-title>Datos del Ticket</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <mat-form-field appearance="outline" class="full">
            <mat-label>Nombre del negocio</mat-label>
            <input matInput [(ngModel)]="config.businessName" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Direccion</mat-label>
            <input matInput [(ngModel)]="config.businessAddress" />
          </mat-form-field>

          <mat-form-field appearance="outline" class="full">
            <mat-label>Telefono</mat-label>
            <input matInput [(ngModel)]="config.businessPhone" />
          </mat-form-field>

          <mat-slide-toggle [(ngModel)]="config.cutPaper">Cortar papel al final</mat-slide-toggle>
        </mat-card-content>
        <mat-card-actions>
          <button mat-button (click)="resetDefaults()">Restaurar</button>
          <button mat-raised-button color="primary" (click)="save()">Guardar</button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .container { padding: 16px; max-width: 760px; margin: 0 auto; display: grid; gap: 16px; }
    .full { width: 100%; }
    .status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-weight: 600; }
    .status .ok { color: #2e7d32; }
    .status .bad { color: #c62828; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
    .bt-message { margin-top: 6px; color: #b71c1c; font-weight: 500; }
    mat-card-actions { display: flex; justify-content: flex-end; gap: 8px; }
  `]
})
export class PrinterSettingsComponent implements OnInit {
  config!: PrinterConfig;
  knownPrinters: KnownPrinter[] = [];
  connected = false;
  bluetoothSupported = true;
  lastBluetoothMessage = '';

  constructor(
    private printerService: PrinterService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.config = this.printerService.getConfig();
    this.refreshKnownPrinters();
    this.connected = this.printerService.isConnected();
    this.bluetoothSupported = this.printerService.isPrinterCapabilityAvailable();
    if (!this.bluetoothSupported) {
      this.showBluetoothMessage('Bluetooth no disponible en este dispositivo.');
    }
  }

  save(showToast: boolean = true) {
    this.config = this.printerService.saveConfig(this.config);
    this.refreshKnownPrinters();
    if (showToast) {
      this.snackBar.open('Configuracion guardada', 'Cerrar', { duration: 2000, verticalPosition: 'top' });
    }
  }

  async pairPrinter() {
    if (!this.bluetoothSupported) {
      this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'Bluetooth no soportado en esta plataforma');
      return;
    }

    const printer = await this.printerService.pairAndSelectPrinter();
    if (!printer) {
      this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'No se pudo seleccionar impresora');
      return;
    }

    this.lastBluetoothMessage = '';
    this.config.bluetoothName = printer.name;
    this.save(false);
    this.snackBar.open(`Impresora agregada: ${printer.name}`, 'Cerrar', { duration: 2500, verticalPosition: 'top' });
  }

  async connect() {
    if (!this.bluetoothSupported) {
      this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'Bluetooth no soportado en esta plataforma');
      return;
    }

    this.save(false);
    const ok = await this.printerService.connectToPrinter(this.config.bluetoothName);
    this.connected = this.printerService.isConnected();
    this.config = this.printerService.getConfig();
    this.refreshKnownPrinters();
    if (ok) {
      this.lastBluetoothMessage = '';
      this.snackBar.open('Impresora conectada', 'Cerrar', { duration: 3500, verticalPosition: 'top' });
      return;
    }
    this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'No se pudo conectar');
  }

  async disconnect() {
    await this.printerService.disconnect();
    this.connected = false;
    this.lastBluetoothMessage = '';
    this.snackBar.open('Impresora desconectada', 'Cerrar', { duration: 2000, verticalPosition: 'top' });
  }

  async printTest() {
    if (!this.bluetoothSupported) {
      this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'Bluetooth no soportado en esta plataforma');
      return;
    }

    this.save(false);
    const ok = await this.printerService.printTestTicket();
    this.connected = this.printerService.isConnected();
    if (ok) {
      this.lastBluetoothMessage = '';
      this.snackBar.open('Ticket de prueba enviado', 'Cerrar', { duration: 3500, verticalPosition: 'top' });
      return;
    }
    this.showBluetoothMessage(this.printerService.getLastBluetoothIssue() || 'Error al imprimir prueba');
  }

  resetDefaults() {
    this.config = this.printerService.saveConfig({
      bluetoothName: 'BlueTooth Printer',
      businessName: 'CAFETERIA',
      businessAddress: '',
      businessPhone: '',
      cutPaper: true
    });
    this.refreshKnownPrinters();
    this.snackBar.open('Valores por defecto restaurados', 'Cerrar', { duration: 2000 });
  }

  goBack() {
    this.router.navigate(['/pos']);
  }

  private refreshKnownPrinters() {
    this.knownPrinters = this.printerService.getKnownPrinters();
    const selectedExists = this.knownPrinters.some(printer => printer.name === this.config.bluetoothName);
    const hasRealPrinters = this.knownPrinters.length > 0;

    if (hasRealPrinters && !selectedExists && this.config.bluetoothName) {
      this.knownPrinters = [
        {
          id: '',
          name: this.config.bluetoothName,
          lastUsedAt: new Date().toISOString()
        },
        ...this.knownPrinters
      ];
    }
  }

  private showBluetoothMessage(message: string): void {
    this.lastBluetoothMessage = message;
    this.snackBar.open(message, 'Cerrar', { duration: 5500, verticalPosition: 'top' });
  }
}
