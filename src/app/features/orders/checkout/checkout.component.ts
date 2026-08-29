import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { OrderService } from '../../../core/services/order.service';
import { PendingOrdersService } from '../../../core/services/pending-orders.service';
import { Order, OrderItem, Product } from '../../../shared/models/domain.models';
import { PaymentService } from '../../../core/services/payment.service';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { PrinterService } from '../../../core/services/printer.service';
import { MatDialogModule } from '@angular/material/dialog';
import { UiDialogService } from '../../../core/services/ui-dialog.service';
import { PromotionPricingResult, PromotionService } from '../../../core/services/promotion.service';
import { buildApiUrl } from '../../../core/config/server.config';
import { imprimirTicketConReintentos } from '../../../core/utils/impresion-ticket.utils';
import { BlankZeroNumberDirective } from '../../../shared/directives/blank-zero-number.directive';

export function calcularMontosSugeridos(total: number): number[] {
  const totalValido = Number.isFinite(total) && total > 0 ? total : 0;
  const siguienteCentenar = (Math.floor(totalValido / 100) + 1) * 100;

  return [
    siguienteCentenar,
    siguienteCentenar + 100,
    siguienteCentenar + 200
  ];
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  styleUrl: './checkout.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatDialogModule,
    BlankZeroNumberDirective
  ],
  template: `
    <div class="checkout-container">
      <mat-card class="checkout-card">
        <mat-card-header>
          <button mat-icon-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
          </button>
          <mat-card-title>
            {{ pendingOrderId ? 'Cobrar Orden #' + pendingOrderId : 'Procesar Pago' }}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content class="checkout-content">
          <!-- Resumen de la orden -->
          <div class="order-summary">
            <h3>Resumen de la Orden</h3>
            <div class="summary-items">
              <div class="summary-item" *ngFor="let item of currentOrder">
                <span>{{item.quantity}}x {{item.name}}</span>
                <span>\${{item.subtotal.toFixed(2)}}</span>
              </div>
            </div>

            <div class="promotion-summary" *ngIf="pricingSummary.appliedPromotions.length">
              <div class="promotion-item" *ngFor="let promotion of pricingSummary.appliedPromotions">
                <span>Descuento de Promoción: {{ promotion.promotionName }}</span>
                <strong>- \${{promotion.discountTotal.toFixed(2)}}</strong>
              </div>
            </div>

            <mat-divider></mat-divider>

            <div class="summary-totals">
              <div class="total-row">
                <span>Subtotal original:</span>
                <span>\${{pricingSummary.originalSubtotal.toFixed(2)}}</span>
              </div>
              <div class="total-row discount" *ngIf="pricingSummary.discountTotal > 0">
                <span>Descuentos:</span>
                <span>- \${{pricingSummary.discountTotal.toFixed(2)}}</span>
              </div>
              <div class="total-row total">
                <span>Total a Pagar:</span>
                <span>\${{totals.total.toFixed(2)}}</span>
              </div>
            </div>
          </div>

          <!-- Selección de método de pago -->
          <mat-button-toggle-group
            [(ngModel)]="paymentMethod"
            class="full-width payment-selector"
          >
            <mat-button-toggle value="cash">
              <mat-icon>payments</mat-icon>
              Efectivo
            </mat-button-toggle>

            <mat-button-toggle value="card">
              <mat-icon>credit_card</mat-icon>
              Tarjeta
            </mat-button-toggle>
          </mat-button-toggle-group>


          <!-- Pago en Efectivo -->
          <div class="payment-section" *ngIf="paymentMethod === 'cash'">
            <h3>
              <mat-icon>payments</mat-icon>
              Pago en Efectivo
            </h3>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Monto Recibido</mat-label>
              <input
                matInput
                type="number"
                appBlankZero
                [(ngModel)]="amountReceived"
                (ngModelChange)="calculateChange()"
                placeholder="0.00"
                step="0.01"
                min="0"
              />
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <div class="quick-amounts">
              <button
                mat-raised-button
                *ngFor="let amount of quickAmounts"
                (click)="setQuickAmount(amount)"
              >
                \${{amount}}
              </button>
              <button
                mat-raised-button
                color="accent"
                (click)="setExactAmount()"
              >
                Exacto
              </button>
            </div>

            <div class="cash-summary" *ngIf="change >= 0">
              <div class="cash-summary-item">
                <span>Total a pagar</span>
                <strong>\${{ totals.total.toFixed(2) }}</strong>
              </div>
              <div class="cash-summary-item cash-change">
                <span>Cambio</span>
                <strong>\${{ change.toFixed(2) }}</strong>
              </div>
              <div class="cash-summary-item">
                <span>Método</span>
                <strong>Efectivo</strong>
              </div>
            </div>

            <div class="warning" *ngIf="amountReceived > 0 && change < 0">
              <mat-icon>warning</mat-icon>
              El monto recibido es insuficiente
            </div>
          </div>
          <!-- Pago con Tarjeta -->
          <div class="payment-section" *ngIf="paymentMethod === 'card'">
            <h3>
              <mat-icon>credit_card</mat-icon>
              Pago con Tarjeta (Mercado Pago Point)
            </h3>

            <div class="card-info">
              <mat-icon class="card-icon">credit_card</mat-icon>
              <p>Por ahora registra el cobro de tarjeta manualmente y confirma la venta en el POS.</p>
            </div>

            <div class="card-status-panel">
              <div class="status-row">
                <span>Total a cobrar</span>
                <strong>\${{ totals.total.toFixed(2) }}</strong>
              </div>
              <div class="status-row" *ngIf="mpTerminalId">
                <span>Terminal</span>
                <strong>{{ mpTerminalId }}</strong>
              </div>
              <div class="status-row" *ngIf="mpPointOrderId">
                <span>Operacion MP</span>
                <strong>{{ mpPointOrderId }}</strong>
              </div>
              <div class="status-row" *ngIf="mpPointOrderStatus">
                <span>Estado</span>
                <strong>{{ mpPointOrderStatus }}</strong>
              </div>
            </div>

            <div class="card-steps">
              <div class="step" [class.active]="cardStep >= 1">
                <mat-icon>{{ cardStep > 1 ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>Monto enviado a terminal</span>
              </div>
              <div class="step" [class.active]="cardStep >= 2">
                <mat-icon>{{ cardStep > 2 ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>Cliente paga en terminal</span>
              </div>
              <div class="step" [class.active]="cardStep >= 3">
                <mat-icon>{{ cardApproved ? 'check_circle' : 'radio_button_unchecked' }}</mat-icon>
                <span>Pago confirmado automaticamente</span>
              </div>
            </div>

            <div class="card-payment-actions">
              <button
                mat-raised-button
                color="primary"
                (click)="startMercadoPagoPointFlow()"
                [disabled]="processingCard || cardApproved"
              >
                {{ processingCard ? 'Esperando terminal...' : (cardApproved ? 'Pago aprobado' : 'Enviar a terminal MP' ) }}
              </button>

              <button
                mat-stroked-button
                (click)="confirmManualCardPayment()"
                [disabled]="processingCard || cardApproved"
              >
                Confirmar cobro manual con tarjeta
              </button>
            </div>

            <div class="warning card-status-message" *ngIf="mpPointStatusMessage">
              <mat-icon>info</mat-icon>
              {{ mpPointStatusMessage }}
            </div>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button
            mat-raised-button
            (click)="goBack()"
            [disabled]="processing"
          >
            Cancelar
          </button>
          <button
            mat-raised-button
            color="primary"
            class="complete-payment-button"
            (click)="completePayment()"
            [disabled]="!canComplete() || processing"
          >
            <mat-icon *ngIf="!processing">lock</mat-icon>
            {{ processing ? 'Procesando...' : (paymentMethod === 'card' ? 'Confirmar Pago con Tarjeta' : 'Completar Pago') }}
            <mat-spinner diameter="20" *ngIf="processing"></mat-spinner>
          </button>
        </mat-card-actions>
      </mat-card>
    </div>
  `,
  styles: [`
    .checkout-container {
      height: calc(var(--app-viewport-height) - var(--topbar-altura));
      min-height: 0;
      padding: 12px 16px;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      box-sizing: border-box;
    }

    .checkout-card {
      width: 100%;
      max-width: 1180px;
      max-height: 100%;
      display: flex;
      flex-direction: column;
    }

    mat-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 0;
      flex: 0 0 auto;
    }

    mat-card-title {
      margin: 0;
      font-size: 24px;
    }

    .order-summary {
      padding: 12px 14px;
      border-radius: 8px;
      margin-bottom: 10px;
    }

    .order-summary h3 {
      margin: 0 0 8px 0;
      font-size: 16px;
    }

    .summary-items {
      max-height: clamp(64px, 13dvh, 118px);
      margin-bottom: 8px;
      padding-right: 4px;
      overflow-y: auto;
      scrollbar-gutter: stable;
    }

    .promotion-summary {
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-item {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
      font-size: 14px;
    }

    .promotion-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 5px 9px;
      background: #e8f5e9;
      border-radius: 8px;
      color: #1b5e20;
      font-size: 13px;
    }

    .summary-totals {
      margin-top: 6px;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 14px;
    }

    .total-row.total {
      font-size: 19px;
      font-weight: 600;
      color: #4caf50;
      border-top: 2px solid #4caf50;
      margin-top: 4px;
      padding-top: 7px;
    }

    .total-row.discount {
      color: #2e7d32;
      font-weight: 600;
    }

    .payment-section {
      margin-top: 0;
      padding: 12px 14px;
    }

    .payment-section h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 9px 0;
      font-size: 16px;
    }

    .full-width {
      width: 100%;
    }

    .quick-amounts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 8px 0;
    }

    .quick-amounts button {
      min-height: 44px;
      padding: 6px 10px;
    }

    .cash-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-top: 9px;
      border: 1px solid var(--color-borde);
      border-radius: 10px;
      overflow: hidden;
    }

    .cash-summary-item {
      display: grid;
      gap: 2px;
      padding: 8px 12px;
    }

    .cash-summary-item + .cash-summary-item {
      border-left: 1px solid var(--color-borde);
    }

    .cash-summary-item span {
      font-size: 12px;
    }

    .cash-summary-item strong {
      font-size: 17px;
    }

    .cash-change strong {
      color: var(--color-exito);
    }

    .warning {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      background-color: #fff3e0;
      color: #e65100;
      border-radius: 8px;
      margin-top: 8px;
    }

    .card-info {
      display: flex;
      align-items: center;
      gap: 10px;
      text-align: left;
      padding: 8px 12px;
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .card-icon {
      flex: 0 0 auto;
      font-size: 28px;
      width: 28px;
      height: 28px;
      margin-bottom: 0;
    }

    .card-info p {
      margin: 0;
      color: #666;
    }

    .card-steps {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 6px;
      margin: 8px 0;
    }

    .card-status-panel {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 12px;
      border-radius: 10px;
      margin-bottom: 8px;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 14px;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px;
      font-size: 12px;
      opacity: 0.4;
      transition: opacity 0.3s;
    }

    .step.active {
      opacity: 1;
    }

    .step mat-icon {
      flex: 0 0 auto;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .card-payment-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }

    .card-payment-actions button {
      min-height: 44px;
    }

    .card-status-message {
      margin-top: 8px;
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 10px 16px;
      flex-wrap: wrap;
      position: sticky;
      bottom: 0;
      background: #fff;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
      padding-bottom: calc(10px + var(--app-safe-bottom));
      flex: 0 0 auto;
    }

    mat-card-actions button {
      min-width: 120px;
      min-height: 44px;
    }

    @media (min-width: 900px) and (orientation: landscape) {
      .checkout-content {
        display: grid;
        grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
        grid-template-rows: auto minmax(0, 1fr);
        align-items: start;
        gap: 12px 14px;
      }

      .order-summary {
        grid-column: 1;
        grid-row: 1 / span 2;
        align-self: stretch;
        min-height: 0;
        margin-bottom: 0;
      }

      .summary-items {
        max-height: clamp(150px, 40dvh, 340px);
      }

      .payment-selector {
        grid-column: 2;
        grid-row: 1;
        min-height: 48px;
        margin-bottom: 0;
      }

      .payment-section {
        grid-column: 2;
        grid-row: 2;
      }
    }

    @media (max-width: 768px) {
      .checkout-container {
        height: auto;
        min-height: calc(var(--app-viewport-height) - var(--topbar-altura));
        padding: 0 0 calc(16px + var(--app-safe-bottom));
        align-items: flex-start;
      }

      .checkout-card {
        max-width: 100%;
        max-height: none;
        border-radius: 0;
      }

      .checkout-content {
        overflow: visible;
      }

      .summary-items {
        max-height: 180px;
      }

      .card-steps,
      .card-payment-actions {
        grid-template-columns: 1fr;
      }

      .quick-amounts {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 520px) {
      .quick-amounts {
        grid-template-columns: repeat(2, 1fr);
      }

      .cash-summary {
        grid-template-columns: 1fr;
      }

      .cash-summary-item + .cash-summary-item {
        border-top: 1px solid var(--color-borde);
        border-left: 0;
      }

      mat-card-title {
        font-size: 20px;
      }

      .change-amount {
        font-size: 30px;
      }

      mat-card-actions button {
        width: 100%;
        min-width: 0;
      }
    }
  `]
})
export class CheckoutComponent implements OnInit, OnDestroy {
  paymentMethod: 'cash' | 'card' = 'cash';
  currentOrder: OrderItem[] = [];
  totals = { subtotal: 0, tax: 0, total: 0 };
  pricingSummary: PromotionPricingResult = {
    originalSubtotal: 0,
    discountTotal: 0,
    subtotal: 0,
    tax: 0,
    total: 0,
    pricedItems: [],
    appliedPromotions: []
  };
  pendingOrderId: number | null = null;
  products: Product[] = [];

  // Para efectivo
  amountReceived = 0;
  change = 0;
  quickAmounts: number[] = [];

  // Para tarjeta
  cardStep = 0;
  processingCard = false;
  cardApproved = false;
  cardProvider: 'mercado_pago_point' = 'mercado_pago_point';
  mpOperationReference = '';
  mpCardBrand = 'Tarjeta';
  mpExternalReference = '';
  mpCheckoutUrl = '';
  mpPreferenceId = '';
  mpPointOrderId = '';
  mpPointOrderStatus = '';
  mpPointPaymentStatus = '';
  mpTerminalId = '';
  mpPointStatusMessage = 'Presiona "Enviar a terminal" para iniciar el cobro con tarjeta.';
  manualCardMode = true;
  private pointPollingTimer: ReturnType<typeof setTimeout> | null = null;

  processing = false;

  constructor(
    private orderService: OrderService,
    private pendingOrdersService: PendingOrdersService,
    private router: Router,
    private route: ActivatedRoute,
    private http: HttpClient,
    private paymentService: PaymentService,
    private printerService: PrinterService,
    private promotionService: PromotionService,
    private uiDialog: UiDialogService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    // Obtener mÃ©todo de pago y orden pendiente de los parÃ¡metros
    const params = await new Promise<any>(resolve => {
      this.route.queryParams.subscribe(p => resolve(p));
    });

    this.paymentMethod = params['method'] ?? 'cash';

    await this.loadProducts();

    this.pendingOrderId = params['pendingOrderId']
    ? +params['pendingOrderId']
    : null;



    // Si hay una orden pendiente, cargarla
    if (this.pendingOrderId) {
      const loaded = await this.loadPendingOrder(this.pendingOrderId);
      if (!loaded) return;
    } else {
      // Cargar orden actual del servicio
      this.currentOrder = this.orderService.getCurrentOrder();
      this.refreshPricingSummary();
    }


    // Verificar que hay productos DESPUÃ‰S de cargar
    if (this.currentOrder.length === 0) {
      console.error('No hay items en la orden');
      this.snackBar.open('No hay productos en la orden', 'Cerrar', {
        duration: 3000
      });

      // Si es orden pendiente, regresar a comandas, sino al POS
      if (this.pendingOrderId) {
        this.router.navigate(['/pending-orders']);
      } else {
        this.router.navigate(['/pos']);
      }
      return;
    }

    // Calcular montos rápidos para efectivo
    this.calculateQuickAmounts();
  }

  ngOnDestroy() {
    this.stopPointPolling();
  }

  async loadPendingOrder(orderId: number): Promise<boolean> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const order = await this.pendingOrdersService.obtenerPedidoPendiente(orderId);
        if (order && order.items.length > 0) {
          this.currentOrder = [...order.items];
          this.refreshPricingSummary();
          return true;
        }
        lastError = new Error('Orden no encontrada o sin productos');
      } catch (error) {
        lastError = error;
      }

      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 350 * attempt));
      }
    }

    console.error('Error al cargar orden pendiente');
    this.snackBar.open('No se pudo cargar la orden. Intenta nuevamente.', 'Cerrar', {
      duration: 3500
    });
    this.router.navigate(['/pending-orders']);
    return false;
  }

  calculateQuickAmounts() {
    this.quickAmounts = calcularMontosSugeridos(this.totals.total);
  }

  setQuickAmount(amount: number) {
    this.amountReceived = amount;
    this.calculateChange();
  }

  setExactAmount() {
    this.amountReceived = this.totals.total;
    this.calculateChange();
  }

  calculateChange() {
    this.change = this.amountReceived - this.totals.total;
  }

  async createMercadoPagoCheckout() {
    this.processingCard = true;
    try {
      this.cardStep = 1;
      this.cardApproved = false;
      this.mpOperationReference = '';

      const externalReference = this.pendingOrderId != null
        ? `order-${this.pendingOrderId}-${Date.now()}`
        : `direct-${Date.now()}`;

      const preference = await this.paymentService.createMercadoPagoPreference({
        externalReference,
        items: [{
          title: this.pendingOrderId != null ? `Orden #${this.pendingOrderId}` : 'Consumo en cafetería',
          quantity: 1,
          unitPrice: this.totals.total,
          currencyId: 'MXN'
        }],
        metadata: {
          pendingOrderId: this.pendingOrderId ?? null,
          total: this.totals.total
        }
      });

      this.mpCheckoutUrl = preference.initPoint || preference.sandboxInitPoint || '';
      this.mpPreferenceId = preference.id || '';
      this.mpExternalReference = externalReference;
      this.cardStep = 2;

      if (this.mpCheckoutUrl) {
        this.snackBar.open('Link de checkout generado', 'Cerrar', { duration: 2200 });
      } else {
        this.snackBar.open('No se obtuvo URL de checkout', 'Cerrar', { duration: 3200 });
      }
    } catch (error: any) {
      this.snackBar.open(error?.message || 'No se pudo generar checkout de Mercado Pago', 'Cerrar', { duration: 3200 });
      this.cardStep = 0;
    } finally {
      this.processingCard = false;
    }
  }

  openMercadoPagoCheckout() {
    if (!this.mpCheckoutUrl) return;
    if (typeof window !== 'undefined') {
      window.open(this.mpCheckoutUrl, '_blank', 'noopener,noreferrer');
    }
  }

  async verifyMercadoPagoPayment() {
    const paymentId = this.mpOperationReference.trim();
    if (!paymentId) {
      this.snackBar.open('Ingresa el ID de pago de Mercado Pago', 'Cerrar', { duration: 2600 });
      return;
    }

    this.processingCard = true;
    try {
      const verification = await this.paymentService.verifyMercadoPagoPayment(paymentId);
      if (verification.status !== 'approved') {
        this.snackBar.open(`Pago no aprobado (${verification.status})`, 'Cerrar', { duration: 3200 });
        this.cardApproved = false;
        return;
      }

      this.cardApproved = true;
      this.cardStep = 3;
      this.snackBar.open('Pago verificado correctamente', 'Cerrar', { duration: 2200 });
    } catch (error: any) {
      this.cardApproved = false;
      this.snackBar.open(error?.message || 'No se pudo verificar pago en Mercado Pago', 'Cerrar', { duration: 3200 });
    } finally {
      this.processingCard = false;
    }
  }

  async startMercadoPagoPointFlow() {
    this.processingCard = true;
    this.cardStep = 1;
    this.cardApproved = false;
    this.mpOperationReference = '';
    this.mpPointOrderId = '';
    this.mpPointOrderStatus = '';
    this.mpPointPaymentStatus = '';
    this.mpTerminalId = '';
    this.mpPointStatusMessage = 'Enviando monto a la terminal Mercado Pago...';
    this.stopPointPolling();

    try {
      const externalReference = this.pendingOrderId != null
        ? `order-${this.pendingOrderId}-${Date.now()}`
        : `direct-${Date.now()}`;

      const pointOrder = await this.paymentService.createMercadoPagoPointOrder({
        externalReference,
        totalAmount: this.totals.total,
        description: this.pendingOrderId != null ? `Orden #${this.pendingOrderId}` : 'Consumo en cafeteria'
      });

      this.mpExternalReference = externalReference;
      this.mpPointOrderId = pointOrder.id || '';
      this.mpPointOrderStatus = pointOrder.status || '';
      this.mpPointPaymentStatus = pointOrder.paymentStatus || '';
      this.mpTerminalId = pointOrder.terminalId || pointOrder.terminalSerial || '';
      this.cardStep = 2;
      this.mpPointStatusMessage = this.buildPointStatusMessage();

      if (!this.mpPointOrderId) {
        throw new Error('Mercado Pago no devolvio un id de operacion');
      }

      this.snackBar.open('Monto enviado a la terminal', 'Cerrar', { duration: 2200 });
      this.pollMercadoPagoPointOrder();
    } catch (error: any) {
      this.processingCard = false;
      this.cardStep = 0;
      this.mpPointStatusMessage = this.extractErrorMessage(error, 'No se pudo iniciar el cobro en la terminal');
      this.snackBar.open(this.mpPointStatusMessage, 'Cerrar', { duration: 3200 });
    }
  }

  async confirmManualCardPayment() {
    const confirmed = await this.uiDialog.confirm({
      title: 'Confirmar cobro con tarjeta',
      message: `Confirma solo si el pago ya fue aprobado en tu terminal por $${this.totals.total.toFixed(2)}.`,
      confirmText: 'Confirmar cobro'
    });

    if (!confirmed) return;

    this.stopPointPolling();
    this.processingCard = false;
    this.cardApproved = true;
    this.cardStep = 3;
    this.mpPointOrderStatus = 'manual_confirmed';
    this.mpPointPaymentStatus = 'approved';
    this.mpOperationReference = this.mpOperationReference.trim() || `manual-${Date.now()}`;
    this.mpPointStatusMessage = 'Cobro manual confirmado. Ya puedes completar la venta.';
    this.snackBar.open('Cobro con tarjeta confirmado manualmente', 'Cerrar', { duration: 2200 });
  }

  canComplete(): boolean {
    if (this.paymentMethod === 'cash') {
      return this.amountReceived >= this.totals.total;
    } else {
      return this.cardApproved;
    }
  }

  async completePayment() {
    if (this.processing || !this.canComplete()) return;

    this.processing = true;

    try {

      // ORDEN PENDIENTE
      if (this.pendingOrderId !== null) {
        await this.pendingOrdersService.completarPedidoPendiente(
          this.pendingOrderId,
          this.paymentMethod,
          this.getPricedOrderItems(),
          this.pricingSummary.discountTotal,
          this.pricingSummary.appliedPromotions,
          this.paymentMethod === 'cash'
            ? this.amountReceived
            : undefined,
          this.paymentMethod === 'card' ? this.buildCardPaymentDetails() : undefined
        );
      }
      // ORDEN DIRECTA
      else {
        await this.orderService.createCompletedOrder({
          items: this.getPricedOrderItems(),
          paymentMethod: this.paymentMethod,
          discountTotal: this.pricingSummary.discountTotal,
          appliedPromotions: this.pricingSummary.appliedPromotions,
          amountPaid:
            this.paymentMethod === 'cash'
              ? this.amountReceived
              : undefined,
          paymentDetails: this.paymentMethod === 'card' ? this.buildCardPaymentDetails() : undefined
        });

        this.orderService.clearOrder();
      }

      if (this.paymentMethod === 'cash') {
        await this.openCashDrawer();
      }

      const ticketImpreso = await imprimirTicketConReintentos(
        () => this.printTicket(),
        () => this.uiDialog.confirm({
          title: 'Error al imprimir ticket',
          message: 'No se pudo imprimir el ticket. Verifica que la impresora esté conectada y tenga papel. ¿Deseas volver a intentarlo?',
          confirmText: 'Reintentar impresión',
          cancelText: 'Continuar sin imprimir'
        })
      );

      this.snackBar.open(
        ticketImpreso
          ? '¡Venta completada e impresión enviada!'
          : 'Venta completada sin imprimir el ticket',
        'Cerrar',
        { duration: 3000 }
      );

      this.router.navigate(['/pos']);

    } catch (error: any) {
      this.snackBar.open(
        error.message || 'Error al procesar el pago',
        'Cerrar',
        { duration: 3000 }
      );
    } finally {
      this.processing = false;
    }
  }

  async openCashDrawer() {
    try {
      const opened = await this.printerService.openCashDrawer();
      if (opened) {
        this.snackBar.open('Cajon abierto', '', { duration: 1000 });
      }
    } catch (error) {
      console.error('Error al abrir cajon');
    }
  }

  private async printTicket(): Promise<boolean> {
    const orderForPrint: Order = {
      id: this.pendingOrderId || undefined,
      items: this.getPricedOrderItems(),
      subtotal: this.totals.subtotal,
      tax: this.totals.tax,
      total: this.totals.total,
      discountTotal: this.pricingSummary.discountTotal,
      appliedPromotions: this.pricingSummary.appliedPromotions,
      status: 'completed',
      paymentMethod: this.paymentMethod,
      amountPaid: this.paymentMethod === 'cash' ? this.amountReceived : undefined,
      change: this.paymentMethod === 'cash' ? this.change : undefined,
      createdAt: new Date().toISOString()
    };

    try {
      const printerConfig = this.printerService.getConfig();
      return await this.printerService.printReceipt(orderForPrint, {
        name: printerConfig.businessName,
        address: printerConfig.businessAddress,
        phone: printerConfig.businessPhone
      });
    } catch {
      return false;
    }
  }

  async goBack() {
    const confirmed = await this.uiDialog.confirm({
      title: 'Cancelar pago',
      message: '¿Cancelar el proceso de pago?',
      confirmText: 'Sí, cancelar'
    });
    if (confirmed) {
      this.router.navigate(['/pos']);
    }
  }

  private pollMercadoPagoPointOrder() {
    this.stopPointPolling();
    this.pointPollingTimer = setTimeout(async () => {
      try {
        await this.refreshMercadoPagoPointOrder();
      } finally {
        if (!this.cardApproved && this.processingCard) {
          this.pollMercadoPagoPointOrder();
        }
      }
    }, 2500);
  }

  private stopPointPolling() {
    if (this.pointPollingTimer) {
      clearTimeout(this.pointPollingTimer);
      this.pointPollingTimer = null;
    }
  }

  private async refreshMercadoPagoPointOrder() {
    if (!this.mpPointOrderId) return;

    try {
      const pointOrder = await this.paymentService.getMercadoPagoPointOrder(this.mpPointOrderId);
      this.mpPointOrderStatus = pointOrder.status || this.mpPointOrderStatus;
      this.mpPointPaymentStatus = pointOrder.paymentStatus || this.mpPointPaymentStatus;
      this.mpTerminalId = pointOrder.terminalId || pointOrder.terminalSerial || this.mpTerminalId;
      this.mpOperationReference = pointOrder.paymentId || pointOrder.id || this.mpOperationReference;
      this.mpPointStatusMessage = this.buildPointStatusMessage();

      if (this.isPointApproved(pointOrder.status, pointOrder.paymentStatus)) {
        this.cardApproved = true;
        this.cardStep = 3;
        this.processingCard = false;
        this.stopPointPolling();
        this.snackBar.open('Pago aprobado en la terminal', 'Cerrar', { duration: 2200 });
        return;
      }

      if (this.isPointRejected(pointOrder.status, pointOrder.paymentStatus)) {
        this.cardApproved = false;
        this.processingCard = false;
        this.stopPointPolling();
        throw new Error(`Pago con tarjeta no aprobado (${pointOrder.paymentStatus || pointOrder.status || 'sin estado'})`);
      }
    } catch (error: any) {
      this.processingCard = false;
      this.stopPointPolling();
      this.mpPointStatusMessage = this.extractErrorMessage(error, 'No se pudo consultar el estado del cobro');
      this.snackBar.open(this.mpPointStatusMessage, 'Cerrar', { duration: 3200 });
    }
  }

  private isPointApproved(orderStatus?: string, paymentStatus?: string): boolean {
    const normalizedOrder = String(orderStatus || '').toLowerCase();
    const normalizedPayment = String(paymentStatus || '').toLowerCase();
    return normalizedOrder === 'processed'
      || normalizedPayment === 'approved'
      || normalizedPayment === 'processed';
  }

  private isPointRejected(orderStatus?: string, paymentStatus?: string): boolean {
    const normalizedOrder = String(orderStatus || '').toLowerCase();
    const normalizedPayment = String(paymentStatus || '').toLowerCase();
    return ['failed', 'canceled', 'cancelled', 'expired'].includes(normalizedOrder)
      || ['rejected', 'failed', 'cancelled', 'canceled', 'expired'].includes(normalizedPayment);
  }

  private buildPointStatusMessage(): string {
    if (this.cardApproved) {
      return 'Cobro aprobado. Ya puedes completar la venta.';
    }

    const paymentStatus = this.mpPointPaymentStatus || this.mpPointOrderStatus;
    if (!paymentStatus) {
      return 'Esperando confirmacion de la terminal Mercado Pago...';
    }

    return `Estado actual en terminal: ${paymentStatus}`;
  }

  private extractErrorMessage(error: any, fallback: string): string {
    return error?.error?.error
      || error?.error?.message
      || error?.message
      || fallback;
  }

  private buildCardPaymentDetails() {
    const reference = this.mpOperationReference.trim();
    const brand = this.mpCardBrand.trim();
    const provider =
      this.mpPointOrderId || this.mpTerminalId
        ? this.cardProvider
        : 'manual_card_terminal';
    return {
      provider,
      reference: reference || `manual-${Date.now()}`,
      metadata: {
        checkoutPreferenceId: this.mpPreferenceId || undefined,
        externalReference: this.mpExternalReference || undefined,
        cardBrand: brand || undefined,
        pointOrderId: this.mpPointOrderId || undefined,
        pointOrderStatus: this.mpPointOrderStatus || undefined,
        pointPaymentStatus: this.mpPointPaymentStatus || undefined,
        terminalId: this.mpTerminalId || undefined
      }
    };
  }

  private async loadProducts() {
    const rows = await this.http.get<any[]>(buildApiUrl('products')).toPromise();
    this.products = (rows || []).map(row => ({
      id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      description: typeof row?.description === 'string' ? row.description : '',
      price: Number.isFinite(Number(row?.price)) ? Number(row.price) : 0,
      image: typeof row?.image === 'string' ? row.image : '',
      category: typeof row?.categoryName === 'string' ? row.categoryName : '',
      categoryId: Number.isFinite(Number(row?.categoryId)) ? Number(row.categoryId) : undefined,
      available: row?.available !== false
    }));
  }

  private refreshPricingSummary() {
    this.pricingSummary = this.promotionService.evaluateOrder(this.currentOrder, this.products);
    this.totals = {
      subtotal: this.pricingSummary.subtotal,
      tax: this.pricingSummary.tax,
      total: this.pricingSummary.total
    };
  }

  private getPricedOrderItems(): OrderItem[] {
    return this.pricingSummary.pricedItems.length
      ? this.pricingSummary.pricedItems
      : this.currentOrder;
  }
}






