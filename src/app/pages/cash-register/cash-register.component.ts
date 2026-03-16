import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { AuthService, User } from '../../core/services/auth.service';
import { CashRegister } from '../../core/models/domain.models';
import { PrinterService } from '../../core/services/printer.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-cash-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatTabsModule,
    MatTableModule,
    MatSnackBarModule,
    MatToolbarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Gestión de Caja</span>
      <span class="toolbar-spacer"></span>
      <button mat-button (click)="logout()">
        <mat-icon>logout</mat-icon>
        <span>Cerrar sesión</span>
      </button>
    </mat-toolbar>

    <div class="cash-register-container">
      <mat-tab-group [(selectedIndex)]="selectedTab">
        <!-- Tab: Caja Actual -->
        <mat-tab label="Caja Actual">
          <div class="tab-content">
            <!-- No hay caja abierta -->
            <mat-card *ngIf="!currentRegister" class="action-card">
              <mat-card-content>
                <div class="empty-state">
                  <mat-icon>point_of_sale</mat-icon>
                  <h2>No hay caja abierta</h2>
                  <p>Abre una caja para comenzar a registrar ventas</p>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Monto Inicial</mat-label>
                  <input
                    matInput
                    type="number"
                    [(ngModel)]="openingAmount"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                  />
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <button
                  mat-raised-button
                  color="primary"
                  class="full-width"
                  (click)="openRegister()"
                  [disabled]="openingAmount <= 0"
                >
                  <mat-icon>lock_open</mat-icon>
                  Abrir Caja
                </button>
              </mat-card-content>
            </mat-card>

            <!-- Caja abierta -->
            <mat-card *ngIf="currentRegister" class="register-info-card">
              <mat-card-header>
                <mat-card-title>
                  <mat-icon>check_circle</mat-icon>
                  Caja Abierta
                </mat-card-title>
              </mat-card-header>

              <mat-card-content>
                <div class="info-grid">
                  <div class="info-item">
                    <span class="label">Apertura:</span>
                    <span class="value">{{formatDate(currentRegister.openedAt)}}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Usuario:</span>
                    <span class="value">{{currentUser?.name || currentRegister.userId}}</span>
                  </div>
                  <div class="info-item">
                    <span class="label">Monto Inicial:</span>
                    <span class="value amount">\${{currentRegister.openingAmount.toFixed(2)}}</span>
                  </div>
                </div>

                <mat-divider></mat-divider>

                <div class="sales-summary">
                  <h3>Resumen de Ventas</h3>
                  <div class="summary-grid">
                    <div class="summary-card cash">
                      <mat-icon>payments</mat-icon>
                      <div class="summary-info">
                        <span class="summary-label">Efectivo</span>
                        <span class="summary-value">\${{currentRegister.cashSales.toFixed(2)}}</span>
                      </div>
                    </div>

                    <div class="summary-card card">
                      <mat-icon>credit_card</mat-icon>
                      <div class="summary-info">
                        <span class="summary-label">Tarjeta</span>
                        <span class="summary-value">\${{currentRegister.cardSales.toFixed(2)}}</span>
                      </div>
                    </div>

                    <div class="summary-card expenses">
                      <mat-icon>remove_circle</mat-icon>
                      <div class="summary-info">
                        <span class="summary-label">Gastos</span>
                        <span class="summary-value">\${{currentRegister.expenses.toFixed(2)}}</span>
                      </div>
                    </div>

                    <div class="summary-card total">
                      <mat-icon>attach_money</mat-icon>
                      <div class="summary-info">
                        <span class="summary-label">Total Ventas</span>
                        <span class="summary-value">
                          \${{(currentRegister.cashSales + currentRegister.cardSales).toFixed(2)}}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="transactions-info">
                    <mat-icon>receipt</mat-icon>
                    <span>{{currentRegister.totalTransactions}} transacciones</span>
                  </div>
                </div>

                <div class="expected-cash">
                  <div class="expected-label">Efectivo Esperado en Caja:</div>
                  <div class="expected-amount">
                    \${{calculateExpectedCash().toFixed(2)}}
                  </div>
                  <div class="expected-breakdown">
                    Inicial (\${{currentRegister.openingAmount.toFixed(2)}}) + 
                    Ventas (\${{currentRegister.cashSales.toFixed(2)}}) - 
                    Gastos (\${{currentRegister.expenses.toFixed(2)}})
                  </div>
                </div>

                <button
                  mat-raised-button
                  color="warn"
                  class="full-width"
                  (click)="showCloseDialog()"
                >
                  <mat-icon>lock</mat-icon>
                  Cerrar Caja
                </button>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tab: Historial -->
        <mat-tab label="Historial">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Historial de Cajas</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="history-list" *ngIf="history.length > 0; else noHistory">
                  <mat-card 
                    *ngFor="let register of history"
                    class="history-card"
                    [class.open]="register.status === 'open'"
                  >
                    <div class="history-header">
                      <div class="history-date">
                        <mat-icon>calendar_today</mat-icon>
                        {{formatDate(register.openedAt)}}
                      </div>
                      <span 
                        class="status-badge"
                        [class.open]="register.status === 'open'"
                        [class.closed]="register.status === 'closed'"
                      >
                        {{register.status === 'open' ? 'Abierta' : 'Cerrada'}}
                      </span>
                    </div>

                    <div class="history-details">
                      <div class="detail-row">
                        <span>Inicial:</span>
                        <span>\${{register.openingAmount.toFixed(2)}}</span>
                      </div>
                      <div class="detail-row">
                        <span>Ventas Efectivo:</span>
                        <span>\${{register.cashSales.toFixed(2)}}</span>
                      </div>
                      <div class="detail-row">
                        <span>Ventas Tarjeta:</span>
                        <span>\${{register.cardSales.toFixed(2)}}</span>
                      </div>
                      <div class="detail-row">
                        <span>Gastos:</span>
                        <span>\${{register.expenses.toFixed(2)}}</span>
                      </div>
                      <div class="detail-row">
                        <span>Transacciones:</span>
                        <span>{{register.totalTransactions}}</span>
                      </div>

                      <mat-divider *ngIf="register.status === 'closed'"></mat-divider>

                      <div *ngIf="register.status === 'closed'" class="close-details">
                        <div class="detail-row">
                          <span>Esperado:</span>
                          <span>\${{register.expectedAmount?.toFixed(2)}}</span>
                        </div>
                        <div class="detail-row">
                          <span>Contado:</span>
                          <span>\${{register.closingAmount?.toFixed(2)}}</span>
                        </div>
                        <div 
                          class="detail-row difference"
                          [class.positive]="(register.difference || 0) >= 0"
                          [class.negative]="(register.difference || 0) < 0"
                        >
                          <span>Diferencia:</span>
                          <span>\${{register.difference?.toFixed(2)}}</span>
                        </div>
                        <button
                          mat-stroked-button
                          color="primary"
                          class="print-cut-btn"
                          (click)="printClosure(register)"
                        >
                          <mat-icon>print</mat-icon>
                          Imprimir corte
                        </button>
                      </div>
                    </div>
                  </mat-card>
                </div>

                <ng-template #noHistory>
                  <div class="empty-state">
                    <mat-icon>history</mat-icon>
                    <p>No hay historial de cajas</p>
                  </div>
                </ng-template>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Dialog de cierre de caja -->
      <div class="dialog-overlay" *ngIf="showingCloseDialog" (click)="cancelClose()">
        <mat-card class="close-dialog" (click)="$event.stopPropagation()">
          <mat-card-header>
            <mat-card-title>Cerrar Caja</mat-card-title>
          </mat-card-header>

          <mat-card-content>
            <div class="close-info">
              <p>Cuenta el dinero en efectivo que tienes en la caja</p>
              
              <div class="expected-info">
                <span>Se espera:</span>
                <span class="amount">\${{calculateExpectedCash().toFixed(2)}}</span>
              </div>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Efectivo Contado</mat-label>
              <input
                matInput
                type="number"
                [(ngModel)]="closingAmount"
                (ngModelChange)="calculateDifference()"
                placeholder="0.00"
                step="0.01"
                min="0"
                autofocus
              />
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <div 
              class="difference-display"
              *ngIf="closingAmount > 0"
              [class.positive]="difference >= 0"
              [class.negative]="difference < 0"
            >
              <span>Diferencia:</span>
              <span class="diff-amount">
                {{difference >= 0 ? '+' : ''}}\${{difference.toFixed(2)}}
              </span>
            </div>

            <div class="warning" *ngIf="difference !== 0 && closingAmount > 0">
              <mat-icon>info</mat-icon>
              <span *ngIf="difference > 0">Hay un sobrante de dinero</span>
              <span *ngIf="difference < 0">Falta dinero en la caja</span>
            </div>
          </mat-card-content>

          <mat-card-actions>
            <button mat-button (click)="cancelClose()">
              Cancelar
            </button>
            <button
              mat-raised-button
              color="primary"
              (click)="confirmClose(true)"
              [disabled]="closingAmount <= 0"
            >
              Cerrar e imprimir corte
            </button>
          </mat-card-actions>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .cash-register-container {
      min-height: calc(100vh - 64px);
      background-color: #f5f5f5;
    }

    .toolbar-spacer {
      flex: 1;
    }

    .tab-content {
      padding: 20px;
    }

    .action-card, .register-info-card {
      max-width: 800px;
      margin: 0 auto;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: rgba(0,0,0,0.6);
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .empty-state h2 {
      margin: 0 0 8px 0;
      font-size: 24px;
    }

    .empty-state p {
      margin: 0;
    }

    .full-width {
      width: 100%;
    }

    mat-card-header {
      margin-bottom: 24px;
    }

    mat-card-title {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 20px;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .info-item .label {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      text-transform: uppercase;
    }

    .info-item .value {
      font-size: 16px;
      font-weight: 500;
    }

    .info-item .value.amount {
      color: #4caf50;
      font-size: 18px;
    }

    .sales-summary {
      margin: 24px 0;
    }

    .sales-summary h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .summary-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .summary-card mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .summary-card.cash mat-icon { color: #4caf50; }
    .summary-card.card mat-icon { color: #2196f3; }
    .summary-card.expenses mat-icon { color: #f44336; }
    .summary-card.total mat-icon { color: #ff9800; }

    .summary-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-label {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .summary-value {
      font-size: 20px;
      font-weight: 600;
    }

    .transactions-info {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background-color: #e3f2fd;
      border-radius: 8px;
      color: #1976d2;
    }

    .expected-cash {
      margin: 24px 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 12px;
      text-align: center;
    }

    .expected-label {
      font-size: 14px;
      opacity: 0.9;
      margin-bottom: 8px;
    }

    .expected-amount {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .expected-breakdown {
      font-size: 12px;
      opacity: 0.8;
    }

    /* Historial */
    .history-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .history-card {
      padding: 16px;
    }

    .history-card.open {
      border-left: 4px solid #4caf50;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .history-date {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .status-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-badge.open {
      background-color: #c8e6c9;
      color: #2e7d32;
    }

    .status-badge.closed {
      background-color: #e0e0e0;
      color: #616161;
    }

    .history-details {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .detail-row.difference {
      font-weight: 600;
      font-size: 16px;
    }

    .detail-row.difference.positive { color: #4caf50; }
    .detail-row.difference.negative { color: #f44336; }

    .close-details {
      margin-top: 12px;
      padding-top: 12px;
    }

    .print-cut-btn {
      width: 100%;
      margin-top: 8px;
    }

    /* Dialog de cierre */
    .dialog-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
      padding: 20px;
    }

    .close-dialog {
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
    }

    .close-info {
      margin-bottom: 24px;
    }

    .close-info p {
      margin: 0 0 16px 0;
      color: rgba(0,0,0,0.7);
    }

    .expected-info {
      display: flex;
      justify-content: space-between;
      padding: 16px;
      background-color: #e3f2fd;
      border-radius: 8px;
      font-size: 16px;
    }

    .expected-info .amount {
      font-weight: 600;
      color: #1976d2;
    }

    .difference-display {
      display: flex;
      justify-content: space-between;
      padding: 16px;
      border-radius: 8px;
      margin: 16px 0;
      font-size: 18px;
      font-weight: 500;
    }

    .difference-display.positive {
      background-color: #c8e6c9;
      color: #2e7d32;
    }

    .difference-display.negative {
      background-color: #ffcdd2;
      color: #c62828;
    }

    .diff-amount {
      font-size: 24px;
      font-weight: 700;
    }

    .warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px;
      background-color: #fff3e0;
      color: #e65100;
      border-radius: 8px;
      font-size: 14px;
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      flex-wrap: wrap;
    }

    @media (max-width: 768px) {
      .summary-grid {
        grid-template-columns: 1fr;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }

      .history-header {
        flex-wrap: wrap;
        gap: 8px;
      }

      .detail-row {
        flex-wrap: wrap;
        gap: 6px;
      }
    }
  `]
})
export class CashRegisterComponent implements OnInit, OnDestroy {
  currentRegister: CashRegister | null = null;
  history: CashRegister[] = [];
  currentUser: User | null = null;
  
  openingAmount = 0;
  closingAmount = 0;
  difference = 0;
  
  showingCloseDialog = false;
  selectedTab = 0;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private cashRegisterService: CashRegisterService,
    private authService: AuthService,
    private printerService: PrinterService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        this.currentUser = user;
      });
    await this.loadData();
  }

  async loadData() {
    await this.cashRegisterService.ensureInitialized();
    await this.cashRegisterService.refreshCurrentRegister();
    this.currentRegister = this.cashRegisterService.getCurrentRegister();
    this.history = await this.cashRegisterService.getRegisterHistory(20);
  }

  async openRegister() {
    if (this.openingAmount <= 0) {
      this.snackBar.open('Ingresa un monto válido', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const user = this.authService.getCurrentUser();
    if (!user) return;

    const id = await this.cashRegisterService.openRegister(
      this.openingAmount,
      user.name
    );

    if (id) {
      this.snackBar.open('Caja abierta exitosamente', 'Cerrar', {
        duration: 2000
      });
      await this.loadData();
      this.openingAmount = 0;
      
      // Redirigir al POS
      setTimeout(() => {
        this.router.navigate(['/pos']);
      }, 1000);
    } else {
      this.snackBar.open('Error al abrir caja', 'Cerrar', {
        duration: 3000
      });
    }
  }

  showCloseDialog() {
    this.showingCloseDialog = true;
    this.closingAmount = 0;
    this.difference = 0;
  }

  cancelClose() {
    this.showingCloseDialog = false;
  }

  calculateExpectedCash(): number {
    if (!this.currentRegister) return 0;
    return this.currentRegister.openingAmount + 
           this.currentRegister.cashSales - 
           this.currentRegister.expenses;
  }

  calculateDifference() {
    this.difference = this.closingAmount - this.calculateExpectedCash();
  }

  async confirmClose(printCut: boolean = true) {
    if (this.closingAmount <= 0) {
      this.snackBar.open('Ingresa el monto contado', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    const registerSnapshot = this.currentRegister
      ? {
          ...this.currentRegister,
          expectedAmount: this.calculateExpectedCash(),
          closingAmount: this.closingAmount,
          difference: this.closingAmount - this.calculateExpectedCash(),
          closedAt: new Date(),
          status: 'closed' as const
        }
      : null;

    const success = await this.cashRegisterService.closeRegister(this.closingAmount);

    if (success) {
      if (printCut && registerSnapshot) {
        const printed = await this.printerService.printCashClosure(registerSnapshot);
        this.snackBar.open(
          printed ? 'Caja cerrada e impresión de corte enviada' : 'Caja cerrada, pero no se pudo imprimir el corte',
          'Cerrar',
          { duration: 3000 }
        );
      } else {
        this.snackBar.open('Caja cerrada exitosamente', 'Cerrar', { duration: 2000 });
      }
      this.showingCloseDialog = false;
      await this.loadData();
      this.selectedTab = 1; // Mostrar historial
    } else {
      this.snackBar.open('Error al cerrar caja', 'Cerrar', {
        duration: 3000
      });
    }
  }

  formatDate(date: Date): string {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  }

  async printClosure(register: CashRegister) {
    if (register.status !== 'closed') return;

    const printed = await this.printerService.printCashClosure(register);
    this.snackBar.open(
      printed ? 'Corte enviado a impresión' : 'No se pudo imprimir el corte',
      'Cerrar',
      { duration: 3000 }
    );
  }

  goBack() {
    if (this.currentRegister || this.authService.isAdmin()) {
      this.router.navigate(['/pos']);
    } else {
      this.router.navigate(['/login']);
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}


