import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Subscription, firstValueFrom } from 'rxjs';
import { PendingOrdersService } from '../../core/services/pending-orders.service';
import { Order, OrderItem, Product } from '../../core/models/domain.models';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { SocketService } from '../../core/services/socket.service';
import { PrinterService } from '../../core/services/printer.service';
import { UiDialogService } from '../../core/services/ui-dialog.service';
import { PromotionService } from '../../core/services/promotion.service';
import { buildApiUrl } from '../../core/config/server.config';

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
          (mousedown)="startLongPress(order)"
          (mouseup)="clearLongPress()"
          (mouseleave)="clearLongPress()"
          (touchstart)="startLongPress(order)"
          (touchend)="clearLongPress()"
          (touchcancel)="clearLongPress()"
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

            <div class="hint-line">
              Mantén presionada la comanda para editar sus productos
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
      cursor: pointer;
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

    .hint-line {
      margin-bottom: 10px;
      font-size: 12px;
      color: rgba(25,118,210,.8);
      font-weight: 600;
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
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private products: Product[] = [];

  constructor(
    private pendingOrdersService: PendingOrdersService,
    private printerService: PrinterService,
    private uiDialog: UiDialogService,
    private router: Router,
    private snackBar: MatSnackBar,
    private socketService: SocketService,
    private dialog: MatDialog,
    private promotionService: PromotionService,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await Promise.allSettled([
      this.loadProducts(),
      this.promotionService.ensureLoaded()
    ]);

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
    this.clearLongPress();
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
    let printableOrder = order;

    try {
      await this.ensureProductsLoaded();
      await this.promotionService.ensureLoaded();

      if (this.products.length) {
        const pricing = this.promotionService.evaluateOrder(order.items, this.products);
        printableOrder = {
          ...order,
          items: pricing.pricedItems,
          subtotal: pricing.subtotal,
          tax: pricing.tax,
          total: pricing.total,
          discountTotal: pricing.discountTotal,
          appliedPromotions: pricing.appliedPromotions
        };
      }
    } catch (error) {
      console.error('No se pudieron recalcular promociones para la cuenta previa:', error);
    }

    const printed = await this.printerService.printPendingAccount(printableOrder);
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

  startLongPress(order: Order) {
    this.clearLongPress();
    this.pressTimer = setTimeout(() => {
      void this.openEditOrder(order);
    }, 650);
  }

  clearLongPress() {
    if (!this.pressTimer) {
      return;
    }

    clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  async openEditOrder(order: Order) {
    const confirmed = await this.uiDialog.confirm({
      title: 'Editar comanda',
      message: `¿Deseas editar la comanda #${order.id}?`,
      confirmText: 'Editar'
    });

    if (!confirmed) {
      return;
    }

    const dialogRef = this.dialog.open(PendingOrderEditDialogComponent, {
      width: '700px',
      maxWidth: '95vw',
      data: { order }
    });

    dialogRef.afterClosed().subscribe(async (items?: OrderItem[]) => {
      if (!items || !items.length || !order.id) {
        return;
      }

      try {
        const updatedOrder = await this.pendingOrdersService.replacePendingOrderItems(order.id, items);
        if (!updatedOrder) {
          throw new Error('No updated order returned');
        }

        this.pendingOrdersService.upsertPendingOrder(updatedOrder);
        this.snackBar.open(`Comanda #${order.id} actualizada`, 'Cerrar', {
          duration: 2500
        });
      } catch {
        this.snackBar.open('No se pudo actualizar la comanda', 'Cerrar', {
          duration: 3000
        });
      }
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
      this.loadOrders();
    } catch {
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

  private async ensureProductsLoaded(): Promise<void> {
    if (this.products.length) {
      return;
    }

    await this.loadProducts();
  }

  private async loadProducts(): Promise<void> {
    const rows = await firstValueFrom(this.http.get<any[]>(buildApiUrl('products')));
    this.products = Array.isArray(rows) ? rows.map(row => this.mapApiProduct(row)) : [];
  }

  private mapApiProduct(row: any): Product {
    return {
      id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      description: typeof row?.description === 'string' ? row.description : '',
      price: Number.isFinite(Number(row?.price)) ? Number(row.price) : 0,
      image: typeof row?.image === 'string' ? row.image : '',
      category: typeof row?.categoryName === 'string' ? row.categoryName : '',
      categoryId: Number.isFinite(Number(row?.categoryId)) ? Number(row.categoryId) : undefined,
      available: row?.available !== false
    };
  }
}

@Component({
  selector: 'app-pending-order-edit-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <div class="dialog-shell">
      <div class="dialog-header">
        <h2>Editar comanda #{{ data.order.id }}</h2>
        <p>Quita o ajusta productos si el cliente hizo cambios.</p>
      </div>

      <div class="item-list">
        <div class="item-row" *ngFor="let item of items; let i = index">
          <div class="item-main">
            <div class="item-name">{{ item.name }}</div>
            <div class="item-price">\${{ item.price.toFixed(2) }} c/u</div>
          </div>

          <div class="item-actions">
            <button mat-icon-button type="button" (click)="decreaseQuantity(i)" [disabled]="item.quantity <= 1">
              <mat-icon>remove</mat-icon>
            </button>
            <span class="qty">{{ item.quantity }}</span>
            <button mat-icon-button type="button" (click)="increaseQuantity(i)">
              <mat-icon>add</mat-icon>
            </button>
            <button mat-icon-button color="warn" type="button" (click)="removeItem(i)">
              <mat-icon>delete</mat-icon>
            </button>
          </div>
        </div>
      </div>

      <div class="empty-message" *ngIf="items.length === 0">
        La comanda se quedó sin productos. Cierra este editor y usa Cancelar si deseas anularla completa.
      </div>

      <div class="summary-box">
        <div>Total actualizado</div>
        <strong>\${{ total.toFixed(2) }}</strong>
      </div>

      <div class="dialog-actions">
        <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
        <button mat-raised-button color="primary" type="button" (click)="save()" [disabled]="items.length === 0">
          Guardar cambios
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-shell {
      padding-top: 8px;
      min-width: min(640px, 88vw);
    }

    .dialog-header h2 {
      margin: 0 0 6px;
      font-size: 28px;
      font-weight: 700;
    }

    .dialog-header p {
      margin: 0;
      color: rgba(0,0,0,.68);
    }

    .item-list {
      margin-top: 20px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 14px 16px;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      background: #fafafa;
    }

    .item-main {
      min-width: 0;
    }

    .item-name {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .item-price {
      color: rgba(0,0,0,.65);
      font-size: 14px;
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .qty {
      min-width: 28px;
      text-align: center;
      font-size: 18px;
      font-weight: 700;
    }

    .empty-message {
      margin-top: 16px;
      padding: 14px 16px;
      border-radius: 12px;
      background: #fff3e0;
      color: #8a5300;
      font-size: 14px;
    }

    .summary-box {
      margin-top: 18px;
      padding: 16px;
      border-radius: 14px;
      background: linear-gradient(135deg, #eff6ff, #eef2ff);
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 18px;
    }

    .dialog-actions {
      margin-top: 18px;
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    @media (max-width: 720px) {
      .dialog-shell {
        min-width: 0;
      }

      .item-row {
        flex-direction: column;
        align-items: stretch;
      }

      .item-actions {
        justify-content: flex-end;
      }
    }
  `]
})
export class PendingOrderEditDialogComponent {
  items: OrderItem[];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { order: Order },
    public dialogRef: MatDialogRef<PendingOrderEditDialogComponent>
  ) {
    this.items = data.order.items.map(item => ({
      ...item,
      subtotal: Number(item.price) * Number(item.quantity)
    }));
  }

  get total(): number {
    return this.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
  }

  increaseQuantity(index: number) {
    const item = this.items[index];
    item.quantity += 1;
    item.subtotal = Number(item.price) * Number(item.quantity);
  }

  decreaseQuantity(index: number) {
    const item = this.items[index];
    if (item.quantity <= 1) {
      return;
    }

    item.quantity -= 1;
    item.subtotal = Number(item.price) * Number(item.quantity);
  }

  removeItem(index: number) {
    this.items.splice(index, 1);
  }

  save() {
    this.dialogRef.close(
      this.items.map(item => ({
        ...item,
        subtotal: Number(item.price) * Number(item.quantity)
      }))
    );
  }
}
