import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { PendingOrdersService } from '../../core/services/pending-orders.service';
import { Order } from '../../core/models/domain.models';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SocketService } from '../../core/services/socket.service';
import { PrinterService } from '../../core/services/printer.service';
import { UiDialogService } from '../../core/services/ui-dialog.service';

@Component({
  selector: 'app-pending-orders',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Órdenes Pendientes</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="loadOrders()">
        <mat-icon>refresh</mat-icon>
      </button>
    </mat-toolbar>

    <div class="pending-orders-container">
      <div class="orders-grid" *ngIf="pendingOrders.length; else empty">
        <mat-card
          class="order-card"
          *ngFor="let order of pendingOrders"
        >
          <mat-card-header>
            <div class="order-header">
              <div class="order-title">
                <mat-icon>receipt</mat-icon>
                <span>Orden #{{ order.id }}</span>
              </div>

              <mat-chip *ngIf="order.tableNumber" class="table-chip">
                <mat-icon>table_restaurant</mat-icon>
                Mesa {{ order.tableNumber }}
              </mat-chip>
            </div>
          </mat-card-header>

          <mat-card-content>
            <div class="meta-info" *ngIf="order.tableNumber || order.customerName">
              <div class="meta-row" *ngIf="order.tableNumber">
                <mat-icon>table_restaurant</mat-icon>
                <span><strong>Mesa:</strong> {{ order.tableNumber }}</span>
              </div>
              <div class="meta-row" *ngIf="order.customerName">
                <mat-icon>person</mat-icon>
                <span><strong>Cliente:</strong> {{ order.customerName }}</span>
              </div>
            </div>

            <div class="time-info">
              <mat-icon>schedule</mat-icon>
              <span>{{ formatTime(order.createdAt) }}</span>
            </div>

            <div class="items-summary">
              <div class="item-line" *ngFor="let item of order.items">
                <span>{{ item.quantity }}x</span>
                <span>{{ item.name }}</span>
              </div>
            </div>

            <div class="order-total">
              <span>Total</span>
              <span class="amount">\${{ order.total.toFixed(2) }}</span>
            </div>

          </mat-card-content>

          <mat-card-actions>
            <button mat-raised-button color="accent" (click)="printAccount(order)">
              <mat-icon>print</mat-icon>
              Imprimir cuenta
            </button>

            <button mat-raised-button color="primary" (click)="pay(order)">
              <mat-icon>payment</mat-icon>
              Cobrar
            </button>

            <button mat-button (click)="addItems(order)">
              <mat-icon>add_circle</mat-icon>
              Agregar
            </button>

            <button mat-button color="warn" (click)="cancel(order)">
              <mat-icon>cancel</mat-icon>
              Cancelar
            </button>
          </mat-card-actions>

        </mat-card>
      </div>

      <ng-template #empty>
        <div class="empty-state">
          <mat-icon>inventory_2</mat-icon>
          <h2>No hay órdenes pendientes</h2>
          <p>Las comandas aparecerán aquí cuando se creen</p>
          <button mat-raised-button color="primary" (click)="goToPos()">
            <mat-icon>add</mat-icon>
            Nueva Orden
          </button>
        </div>
      </ng-template>
    </div>
  `,
  styles: [`
    .spacer { flex: 1; }

    .pending-orders-container {
      padding: 20px;
      background: #f5f5f5;
      min-height: calc(100vh - 64px);
    }

    .orders-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .order-card {
      transition: transform .2s, box-shadow .2s;
    }

    .order-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 16px rgba(0,0,0,.15);
    }

    .order-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    }

    .order-title {
      display: flex;
      gap: 8px;
      font-weight: 600;
    }

    .table-chip {
      background: #e3f2fd;
      color: #1976d2;
    }

    .meta-info {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
      padding: 10px 12px;
      background: #f8fbff;
      border: 1px solid #e3f2fd;
      border-radius: 10px;
    }

    .meta-row,
    .time-info {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 14px;
      color: rgba(0,0,0,.7);
    }

    .time-info {
      margin-bottom: 8px;
    }

    .items-summary {
      background: #fafafa;
      padding: 12px;
      border-radius: 8px;
      margin: 12px 0;
    }

    .item-line {
      display: flex;
      gap: 8px;
      font-size: 14px;
    }

    .item-line span:first-child {
      font-weight: 600;
      color: #1976d2;
    }

    .order-total {
      display: flex;
      justify-content: space-between;
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      padding: 12px;
      border-radius: 8px;
      font-weight: 600;
    }

    .amount {
      font-size: 20px;
    }

    mat-card-actions {
      display: flex;
      gap: 8px;
      border-top: 1px solid #e0e0e0;
      padding: 12px;
      flex-wrap: wrap;
    }

    mat-card-actions button {
      flex: 1;
    }

    .empty-state {
      text-align: center;
      margin-top: 80px;
      color: rgba(0,0,0,.6);
    }

    .empty-state mat-icon {
      font-size: 72px;
      margin-bottom: 16px;
      color: rgba(0,0,0,.3);
    }

    @media (max-width: 768px) {
      .orders-grid {
        grid-template-columns: 1fr;
      }

      mat-card-actions button {
        min-width: 0;
      }
    }
  `]
})
export class PendingOrdersComponent implements OnInit, OnDestroy {

  pendingOrders: Order[] = [];
  private sub = new Subscription();
  private audioContext?: AudioContext;

  constructor(
    private pendingOrdersService: PendingOrdersService,
    private printerService: PrinterService,
    private uiDialog: UiDialogService,
    private router: Router,
    private snackBar: MatSnackBar,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.loadOrders();

    this.sub.add(
      this.pendingOrdersService.pendingOrders$
        .subscribe(o => this.pendingOrders = o)
    );

    this.sub.add(
      this.socketService.newOrderNotification$
        .subscribe(order => {
          if (!order) return;
          this.pendingOrdersService.upsertPendingOrder(order);
          this.playNotificationTone();
          this.snackBar.open(`Nueva comanda #${order.id} recibida`, 'Cerrar', {
            duration: 3000
          });
        })
    );

    this.sub.add(
      this.socketService.orderUpdatedNotification$
        .subscribe(order => {
          if (!order) return;
          this.pendingOrdersService.upsertPendingOrder(order);
        })
    );

    this.sub.add(
      this.socketService.orderCancelledNotification$
        .subscribe(orderId => {
          if (!orderId) return;
          this.pendingOrdersService.removePendingOrder(orderId);
        })
    );
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  loadOrders() {
    this.pendingOrdersService.loadPendingOrders();
  }

  formatTime(date?: string | Date): string {
    if (!date) return '--:--';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '--:--';
    return format(d, 'HH:mm', { locale: es });
  }

  pay(order: Order) {
    this.router.navigate(['/checkout'], {
      queryParams: {
        pendingOrderId: order.id,
        method: 'cash'
      }
    });
  }

  async printAccount(order: Order) {
    const printed = await this.printerService.printPendingAccount(order);
    if (printed) {
      this.snackBar.open(`Cuenta de orden #${order.id} enviada a impresión`, 'Cerrar', {
        duration: 2500
      });
      return;
    }

    this.snackBar.open(
      'No se pudo imprimir la cuenta. Verifica conexión de impresora en Configuración.',
      'Cerrar',
      { duration: 3500 }
    );
  }


  addItems(order: Order) {
    this.router.navigate(['/pos'], {
      queryParams: { addToOrderId: order.id }
    });
  }

  async cancel(order: Order) {
    const confirmed = await this.uiDialog.confirm({
      title: 'Cancelar orden',
      message: `¿Cancelar la orden #${order.id}?`,
      confirmText: 'Cancelar orden'
    });
    if (!confirmed) return;

    try {
      await this.pendingOrdersService.cancelPendingOrder(order.id!);

      this.snackBar.open('Orden cancelada', 'Cerrar', { duration: 2000 });

      // FORZAR RECARGA
      this.loadOrders();

    } catch (e) {
      this.snackBar.open('Error al cancelar la orden', 'Cerrar', {
        duration: 3000
      });
    }
  }


  goBack() {
    this.router.navigate(['/pos']);
  }

  goToPos() {
    this.router.navigate(['/pos']);
  }

  private playNotificationTone() {
    if (typeof window === 'undefined') {
      return;
    }

    const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    this.audioContext ??= new AudioContextCtor();

    if (this.audioContext.state === 'suspended') {
      void this.audioContext.resume().catch(() => undefined);
    }

    const startAt = this.audioContext.currentTime + 0.02;
    const pattern = [
      { offset: 0, duration: 0.12, frequency: 880 },
      { offset: 0.18, duration: 0.12, frequency: 1174 }
    ];

    for (const note of pattern) {
      const oscillator = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency, startAt + note.offset);

      gain.gain.setValueAtTime(0.0001, startAt + note.offset);
      gain.gain.exponentialRampToValueAtTime(0.16, startAt + note.offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.offset + note.duration);

      oscillator.connect(gain);
      gain.connect(this.audioContext.destination);

      oscillator.start(startAt + note.offset);
      oscillator.stop(startAt + note.offset + note.duration);
    }
  }
}


