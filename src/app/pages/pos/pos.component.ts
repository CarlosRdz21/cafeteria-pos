import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Subscription, firstValueFrom } from 'rxjs';
import { DrinkBaseType, Product, ProductServiceTemperature, ProductVariantPricing, OrderItem, Order } from '../../core/models/domain.models';
import { OrderService } from '../../core/services/order.service';
import { PendingOrdersService } from '../../core/services/pending-orders.service';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { AuthService } from '../../core/services/auth.service';
import { SocketService } from '../../core/services/socket.service';
import { PrinterService } from '../../core/services/printer.service';
import { UiDialogService } from '../../core/services/ui-dialog.service';
import { buildApiUrl } from '../../core/config/server.config';

@Component({
  selector: 'app-pos',
  standalone: true,
  styleUrl: './pos.component.scss',
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatBadgeModule,
    MatChipsModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule,
    MatMenuModule,
    MatTooltipModule
  ],
  template: `
    <div class="pos-container">
      <!-- Toolbar -->
      <mat-toolbar color="primary" class="toolbar">
        <mat-icon>local_cafe</mat-icon>
        <span class="toolbar-title">Dulce Aroma Café</span>
        <span class="toolbar-subtitle" *ngIf="addToOrderId">
          (Agregando a Orden #{{addToOrderId}})
        </span>
        <span class="spacer"></span>
        
        <!-- Indicador de conexión -->
        <button mat-icon-button [matTooltip]="isConnected ? 'Conectado al servidor' : 'Desconectado'" (click)="goToSettings()">
          <mat-icon [class.connected]="isConnected" [class.disconnected]="!isConnected">
            {{ isConnected ? 'wifi' : 'wifi_off' }}
          </mat-icon>
        </button>
        
        <button mat-icon-button [matMenuTriggerFor]="menu">
          <mat-icon>more_vert</mat-icon>
        </button>
        <mat-menu #menu="matMenu">
          <button mat-menu-item (click)="goToPendingOrders()">
            <mat-icon>receipt_long</mat-icon>
            <span>Comandas Pendientes</span>
          </button>
          <button mat-menu-item (click)="goToCashRegister()" *ngIf="isAdminOrBarista()">
            <mat-icon>point_of_sale</mat-icon>
            <span>Caja</span>
          </button>
          <button mat-menu-item (click)="goToReports()" *ngIf="isAdmin()">
            <mat-icon>assessment</mat-icon>
            <span>Reportes</span>
          </button>
          <button mat-menu-item (click)="goToSuppliesAdmin()" *ngIf="isAdmin()">
            <mat-icon>inventory_2</mat-icon>
            <span>Administrar Insumos</span>
          </button>
          <button mat-menu-item (click)="goToInventoryMovements()" *ngIf="isAdminOrBarista()">
            <mat-icon>swap_vert</mat-icon>
            <span>Movimientos de Insumos</span>
          </button>
          <button mat-menu-item (click)="goToExpenses()" *ngIf="isAdminOrBarista()">
            <mat-icon>receipt</mat-icon>
            <span>Gastos</span>
          </button>
          <button mat-menu-item (click)="goToProductsAdmin()" *ngIf="isAdmin()">
            <mat-icon>inventory</mat-icon>
            <span>Administrar Productos</span>
          </button>
          <button mat-menu-item (click)="goToPromotionsAdmin()" *ngIf="isAdmin()">
            <mat-icon>local_offer</mat-icon>
            <span>Promociones</span>
          </button>
          <button mat-menu-item (click)="goToUsersAdmin()" *ngIf="isAdmin()">
            <mat-icon>manage_accounts</mat-icon>
            <span>Administrar Usuarios</span>
          </button>
          <button mat-menu-item (click)="goToPrinterSettings()" *ngIf="isAdmin()">
            <mat-icon>print</mat-icon>
            <span>Configurar Impresora</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon>exit_to_app</mat-icon>
            <span>Cerrar Sesión</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      <div class="main-content">
        <!-- Panel de productos -->
        <div class="products-panel">
          <!-- Filtros por categoría -->
          <div class="category-filters">
            <mat-chip-listbox [(ngModel)]="selectedCategory">
              <mat-chip-option value="all" selected>Todos</mat-chip-option>
              <mat-chip-option *ngFor="let cat of categories" [value]="cat">
                {{cat}}
              </mat-chip-option>
            </mat-chip-listbox>
          </div>

          <!-- Grid de productos -->
          <div class="products-grid">
            <mat-card 
              *ngFor="let product of filteredProducts"
              class="product-card"
              (click)="addToOrder(product)"
              [class.unavailable]="!product.available"
            >
              <div class="product-image">
                <img [src]="product.image" [alt]="product.name" 
                     (error)="onImageError($event)">
                <div class="product-badge" *ngIf="!product.available">
                  Agotado
                </div>
              </div>
              <mat-card-content>
                <h3>{{product.name}}</h3>
                <p class="product-description">{{product.description}}</p>
                <div class="product-footer">
                  <span class="price">\${{product.price}}</span>
                  <!-- Stock oculto temporalmente -->
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </div>

        <!-- Panel de orden actual -->
        <div class="order-panel">
          <div class="order-header">
            <h2>Orden Actual</h2>
            <button mat-icon-button color="warn" (click)="clearOrder()" 
                    *ngIf="currentOrder.length > 0">
              <mat-icon>delete</mat-icon>
            </button>
          </div>

          <div class="order-items" *ngIf="currentOrder.length > 0; else emptyOrder">
            <div class="order-item" *ngFor="let item of currentOrder">
              <div class="item-info">
                <h4>{{item.name}}</h4>
                <p class="item-price">\${{item.price}} x {{item.quantity}}</p>
              </div>
              <div class="item-actions">
                <button mat-icon-button (click)="decreaseQuantity(item)">
                  <mat-icon>remove</mat-icon>
                </button>
                <span class="quantity">{{item.quantity}}</span>
                <button mat-icon-button (click)="increaseQuantity(item)">
                  <mat-icon>add</mat-icon>
                </button>
                <button mat-icon-button color="warn" (click)="removeItem(item)">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              <div class="item-subtotal">
                \${{item.subtotal.toFixed(2)}}
              </div>
            </div>
          </div>

          <ng-template #emptyOrder>
            <div class="empty-order">
              <mat-icon>shopping_cart</mat-icon>
              <p>No hay productos en la orden</p>
            </div>
          </ng-template>

          <!-- Totales -->
          <div class="order-totals" *ngIf="currentOrder.length > 0">
            <mat-divider></mat-divider>
            <div class="total-row">
              <span>Subtotal:</span>
              <span>\${{totals.subtotal.toFixed(2)}}</span>
            </div>
            <div class="total-row total">
              <span>Total:</span>
              <span>\${{totals.total.toFixed(2)}}</span>
            </div>

            <!-- Botones de acción -->
            <div class="action-buttons">
              <button mat-raised-button 
                      (click)="savePendingOrder()"
                      class="pending-btn">
                <mat-icon>{{ addToOrderId ? 'add_circle' : 'bookmark' }}</mat-icon>
                {{ addToOrderId ? 'Agregar a Orden #' + addToOrderId : 'Guardar Comanda' }}
              </button>
              
              <!-- Solo admin y barista pueden cobrar directamente -->
              <div class="payment-buttons" *ngIf="isAdminOrBarista()">
                <button mat-raised-button color="primary" 
                        (click)="processPayment('cash')"
                        class="payment-btn"
                        *ngIf="!addToOrderId">
                  <mat-icon>payments</mat-icon>
                  Pagar Efectivo
                </button>
                <button mat-raised-button color="accent" 
                        (click)="processPayment('card')"
                        class="payment-btn"
                        *ngIf="!addToOrderId">
                  <mat-icon>credit_card</mat-icon>
                  Pagar Tarjeta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pos-container {
      min-height: calc(100dvh - var(--app-safe-top) - var(--app-safe-bottom));
      height: calc(100dvh - var(--app-safe-top) - var(--app-safe-bottom));
      display: flex;
      flex-direction: column;
      background-color: #f5f5f5;
    }

    .toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .toolbar-title {
      margin-left: 12px;
      font-size: 20px;
      font-weight: 500;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .toolbar-subtitle {
      margin-left: 8px;
      font-size: 14px;
      opacity: 0.9;
      font-weight: 400;
    }

    .toolbar mat-icon.connected {
      color: #4caf50;
    }

    .toolbar mat-icon.disconnected {
      color: #f44336;
    }

    .spacer {
      flex: 1;
    }

    .main-content {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      overflow: hidden;
    }

    .products-panel {
      flex: 2;
      min-width: 0;
      min-height: 0;
      display: flex;
      flex-direction: column;
      padding: 16px;
      overflow-y: auto;
    }

    .category-filters {
      margin-bottom: 16px;
    }

    .products-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 220px));
      justify-content: start;
      gap: 16px;
    }

    .product-card {
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
      width: 100%;
    }

    .product-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .product-card.unavailable {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .product-image {
      position: relative;
      width: 100%;
      height: 150px;
      overflow: hidden;
      border-radius: 4px 4px 0 0;
    }

    .product-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-badge {
      position: absolute;
      top: 8px;
      right: 8px;
      background-color: #f44336;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .product-card h3 {
      margin: 0 0 4px 0;
      font-size: 16px;
      font-weight: 500;
    }

    .product-description {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      margin: 0 0 8px 0;
    }

    .product-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .price {
      font-size: 18px;
      font-weight: 600;
      color: #4caf50;
    }

    .stock {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .order-panel {
      flex: 1;
      min-width: 400px;
      min-height: 0;
      height: 100%;
      align-self: stretch;
      background-color: white;
      border-left: 1px solid #e0e0e0;
      display: flex;
      flex-direction: column;
    }

    .order-header {
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e0e0e0;
    }

    .order-header h2 {
      margin: 0;
      font-size: 20px;
    }

    .order-items {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
    }

    .order-item {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 12px;
      background-color: #fafafa;
    }

    .item-info h4 {
      margin: 0 0 4px 0;
      font-size: 14px;
    }

    .item-price {
      margin: 0;
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .item-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .quantity {
      min-width: 30px;
      text-align: center;
      font-weight: 500;
    }

    .item-subtotal {
      font-size: 16px;
      font-weight: 600;
      color: #4caf50;
    }

    .empty-order {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      color: rgba(0,0,0,0.4);
    }

    .empty-order mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .order-totals {
      padding: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 14px;
    }

    .total-row.total {
      font-size: 18px;
      font-weight: 600;
      color: #4caf50;
      border-top: 2px solid #4caf50;
      margin-top: 8px;
      padding-top: 12px;
    }

    .action-buttons {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }

    .pending-btn {
      height: 48px;
      font-size: 14px;
      background-color: #ff9800;
      color: white;
    }

    .payment-buttons {
      display: flex;
      gap: 12px;
    }

    .payment-btn {
      flex: 1;
      height: 56px;
      font-size: 14px;
    }

    .payment-btn mat-icon {
      margin-right: 8px;
    }

    @media (max-width: 1024px) {
      .main-content {
        flex-direction: column;
      }

      .order-panel {
        min-width: unset;
        width: 100%;
        border-left: none;
        border-top: 1px solid #e0e0e0;
        max-height: 50vh;
      }

      .products-grid {
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      }
    }

    @media (max-width: 768px) {
      .main-content {
        flex-direction: column;
      }

      .order-panel {
        min-width: unset;
        border-left: none;
        border-top: 1px solid #e0e0e0;
        max-height: 50vh;
      }

      .products-grid {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 12px;
      }

      .products-panel {
        padding: 12px;
      }

      .product-card {
        padding: 8px;
      }

      .product-image {
        height: 120px;
      }

      .category-filters {
        overflow-x: auto;
      }

      .payment-buttons {
        flex-direction: column;
      }

      .payment-btn {
        width: 100%;
      }

      .order-item {
        grid-template-columns: 1fr;
        gap: 8px;
      }

      .item-actions {
        justify-content: flex-start;
      }

      .item-subtotal {
        justify-self: start;
      }
    }

    @media (max-width: 480px) {
      .products-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .toolbar-title {
        font-size: 16px;
        max-width: 46vw;
      }

      .toolbar-subtitle {
        display: none;
      }
    }
  `]
})
export class PosComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  filteredProducts: Product[] = [];
  categories: string[] = [];
  private productCategoryById = new Map<number, string>();
  private readonly preferredCategories: string[] = [];
  private readonly drinkVariantPriceConfig = {
    hot12OzExtra: 0,
    hot16OzExtra: 10,
    cold16OzExtra: 10,
    flatWhite8OzExtra: 0,
    espresso3OzExtra: 0,
    espressoDobleExtra: 0,
    espressoCortadoExtra: 0
  };
  selectedCategory = 'all';
  currentOrder: OrderItem[] = [];
  totals = { subtotal: 0, tax: 0, total: 0 };
  addToOrderId?: number; // ID de orden pendiente si estamos agregando items
  isConnected = false;
  
  private subscription = new Subscription();

  constructor(
    private orderService: OrderService,
    private pendingOrdersService: PendingOrdersService,
    private cashRegisterService: CashRegisterService,
    private authService: AuthService,
    private socketService: SocketService,
    private printerService: PrinterService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar,
    private uiDialog: UiDialogService,
    private dialog: MatDialog,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    await this.cashRegisterService.ensureInitialized();
    // Verificar que haya caja abierta
    if (!this.cashRegisterService.isRegisterOpen() && !this.authService.isAdmin()) {
      this.snackBar.open('No hay caja abierta. Redirigiendo...', 'Cerrar', {
        duration: 3000
      });
      this.router.navigate(['/cash-register']);
      return;
    }

    // Verificar si estamos agregando a una orden pendiente
    this.route.queryParams.subscribe(async params => {
      this.addToOrderId = params['addToOrderId'] ? +params['addToOrderId'] : undefined;
      
      if (this.addToOrderId) {
        // NO cargar items existentes, solo limpiar para agregar nuevos
        this.orderService.clearOrder();
        this.snackBar.open(`Agregando items a la Orden #${this.addToOrderId}`, 'Cerrar', {
          duration: 3000
        });
      }
    });

    await this.loadProducts();
    
    // Verificar conexión al servidor
    this.subscription.add(
      this.socketService.connected$.subscribe(connected => {
        this.isConnected = connected;
      })
    );

    // Escuchar notificaciones de nuevas órdenes (solo baristas y admins)
    if (this.authService.hasRole('admin', 'barista')) {
      this.subscription.add(
        this.socketService.newOrderNotification$.subscribe(data => {
          if (data) {
            this.snackBar.open(
              `🔔 ${data.message}`,
              'Ver',
              { duration: 5000 }
            ).onAction().subscribe(() => {
              this.router.navigate(['/pending-orders']);
            });
          }
        })
      );

      this.subscription.add(
        this.socketService.orderUpdatedNotification$.subscribe(data => {
          if (data) {
            this.snackBar.open(
              `🔔 ${data.message}`,
              'Ver',
              { duration: 5000 }
            ).onAction().subscribe(() => {
              this.router.navigate(['/pending-orders']);
            });
          }
        })
      );
    }
    
    // Suscribirse a cambios en la orden
    this.subscription.add(
      this.orderService.currentOrder$.subscribe(order => {
        this.currentOrder = order;
        this.totals = this.orderService.calculateTotals();
      })
    );

    // Watch para cambios en categoría
    this.subscription.add(
      // Simular cambio de categoría
      (() => {
        const interval = setInterval(() => {
          this.filterProducts();
        }, 100);
        return () => clearInterval(interval);
      })()
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  async loadProducts() {
    try {
      const [apiProducts, apiCategories] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(buildApiUrl('products'))),
        firstValueFrom(this.http.get<any[]>(buildApiUrl('product-categories')))
      ]);

      this.products = (apiProducts || []).map(row => this.mapApiProduct(row));
      const catalogRows = (apiCategories || []).map(row => ({
        id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
        name: typeof row?.name === 'string' ? row.name : ''
      }));

      this.productCategoryById = new Map(
        catalogRows.filter(c => c.id).map(c => [c.id as number, c.name])
      );
      const catalogCategories = catalogRows.map(c => this.normalizeMenuCategory(c.name));
      const existingCategories = [
        ...new Set(this.products.map(p => this.normalizeMenuCategory(this.getProductCategoryName(p))))
      ];
      const baseCategories = catalogCategories.length
        ? catalogCategories
        : this.preferredCategories;
      const extraCategories = existingCategories.filter(c => !baseCategories.includes(c));
      this.categories = [...baseCategories, ...extraCategories];
      this.filterProducts();
    } catch (error) {
      console.error('Error cargando catálogo desde API:', error);
      this.products = [];
      this.categories = [...this.preferredCategories];
      this.filterProducts();
      this.snackBar.open('No se pudo cargar el catálogo del servidor', 'Cerrar', {
        duration: 3200
      });
    }
  }
  filterProducts() {
    if (this.selectedCategory === 'all') {
      this.filteredProducts = this.products;
    } else {
      this.filteredProducts = this.products.filter(
        p => this.normalizeMenuCategory(this.getProductCategoryName(p)) === this.selectedCategory
      );
    }
  }

  private normalizeMenuCategory(category: string): string {
    const normalized = (category || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    const aliases: Record<string, string> = {
      'Con Cafe': 'Con Cafe',
      'Sin Cafeina': 'Sin Cafeina',
      'Tisanas y Te': 'Tisanas y Te',
      'Frappes': 'Frappes',
      'Smoothies y Malteadas': 'Smoothies y Malteadas'
    };

    return aliases[normalized] || normalized;
  }

  private getProductCategoryName(product: Product): string {
    if (product.categoryId) {
      const fromCatalog = this.productCategoryById.get(product.categoryId);
      if (fromCatalog) return fromCatalog;
    }
    return product.category || '';
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
      available: row?.available !== false,
      stock: row?.stock == null ? undefined : Number(row.stock),
      variantPricing: this.normalizeVariantPricing(row?.variantPricing),
      drinkBaseType: this.normalizeDrinkBaseType(row?.drinkBaseType),
      milkOptions: this.normalizeOptionList(row?.milkOptions),
      waterOptions: this.normalizeOptionList(row?.waterOptions),
      milkOptionExtras: this.normalizeOptionExtras(row?.milkOptionExtras),
      waterOptionExtras: this.normalizeOptionExtras(row?.waterOptionExtras),
      allowFlavorSelection: row?.allowFlavorSelection === true,
      flavorOptions: this.normalizeOptionList(row?.flavorOptions),
      flavorOptionExtras: this.normalizeOptionExtras(row?.flavorOptionExtras),
      serviceTemperature: this.normalizeServiceTemperature(row?.serviceTemperature),
      removableIngredients: this.normalizeOptionList(row?.removableIngredients),
      extraIngredients: this.normalizeOptionList(row?.extraIngredients),
      extraIngredientPrices: this.normalizeOptionExtras(row?.extraIngredientPrices)
    };
  }

  private normalizeVariantPricing(value: unknown): ProductVariantPricing {
    const source = (value && typeof value === 'object' && !Array.isArray(value))
      ? (value as Record<string, unknown>)
      : {};

    const toNumber = (raw: unknown) => {
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    return {
      hot12OzExtra: toNumber(source['hot12OzExtra']),
      hot16OzExtra: toNumber(source['hot16OzExtra']),
      cold16OzExtra: toNumber(source['cold16OzExtra']),
      flatWhite8OzExtra: toNumber(source['flatWhite8OzExtra']),
      espresso3OzExtra: toNumber(source['espresso3OzExtra']),
      espressoDobleExtra: toNumber(source['espressoDobleExtra']),
      espressoCortadoExtra: toNumber(source['espressoCortadoExtra'])
    };
  }

  private normalizeOptionList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean);
  }

  private normalizeOptionExtras(value: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!value || typeof value !== 'object' || Array.isArray(value)) return out;

    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const cleanKey = key.trim();
      if (!cleanKey) continue;
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      out[cleanKey] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    return out;
  }
  onImageError(event: any) {
    // Si la imagen falla, usar un SVG placeholder
    event.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qcm9kdWN0bzwvdGV4dD48L3N2Zz4=';
  }

  async addToOrder(product: Product) {
    if (!product.available) {
      this.snackBar.open('Producto no disponible', 'Cerrar', {
        duration: 2000
      });
      return;
    }

    const selection = await this.buildSelectedProductSelection(product);
    if (selection === null) {
      return;
    }

    this.orderService.addItem(product, 1, selection.name, selection.price);
    this.snackBar.open(`${selection.name} agregado`, '', {
      duration: 1000
    });
  }

  increaseQuantity(item: OrderItem) {
    this.orderService.updateItemQuantity(item, item.quantity + 1);
  }

  decreaseQuantity(item: OrderItem) {
    if (item.quantity > 1) {
      this.orderService.updateItemQuantity(item, item.quantity - 1);
    }
  }

  removeItem(item: OrderItem) {
    this.orderService.removeItem(item);
    this.snackBar.open('Producto eliminado', '', {
      duration: 1000
    });
  }

  async clearOrder() {
    const confirmed = await this.uiDialog.confirm({
      title: 'Limpiar orden',
      message: '¿Estás seguro de limpiar la orden?',
      confirmText: 'Sí, limpiar'
    });
    if (confirmed) {
      this.orderService.clearOrder();
    }
  }

  async savePendingOrder() {
    // Si estamos agregando a una orden existente
    if (this.addToOrderId) {
      try {
        const currentItems = this.orderService.getCurrentOrder();
        
        if (currentItems.length === 0) {
          this.snackBar.open('No hay items nuevos para agregar', 'Cerrar', {
            duration: 2000
          });
          return;
        }

        // Simplemente agregar los items nuevos
        const success = await this.pendingOrdersService.updatePendingOrder(
          this.addToOrderId,
          currentItems
        );

        if (success) {
          const updatedOrder = await this.pendingOrdersService.getPendingOrder(this.addToOrderId);
          const newItemsSubtotal = currentItems.reduce((sum, item) => sum + item.subtotal, 0);
          const kitchenDeltaOrder: Order = {
            id: this.addToOrderId,
            items: currentItems,
            subtotal: newItemsSubtotal,
            tax: 0,
            total: newItemsSubtotal,
            status: 'pending',
            createdAt: new Date().toISOString(),
            tableNumber: updatedOrder?.tableNumber,
            customerName: updatedOrder?.customerName,
            notes: 'Productos agregados a comanda existente'
          };
          void this.printKitchenTicketAfterSave(kitchenDeltaOrder);
          this.snackBar.open('Items agregados a la orden', 'Cerrar', {
            duration: 2000
          });
          this.orderService.clearOrder();
          this.router.navigate(['/pending-orders']);
        }
      } catch (error: any) {
        this.snackBar.open(error.message || 'Error al actualizar orden', 'Cerrar', {
          duration: 3000
        });
      }
    } else {
      // Crear nueva comanda
      const tableNumber = await this.uiDialog.prompt({
      title: 'Guardar comanda',
      message: 'Número de mesa (opcional)',
      label: 'Mesa',
      confirmText: 'Continuar'
    });
      const customerName = await this.uiDialog.prompt({
      title: 'Guardar comanda',
      message: 'Nombre del cliente (opcional)',
      label: 'Cliente',
      confirmText: 'Guardar comanda'
    });
      
      try {
        const payload = {
          items: this.currentOrder,
          tableNumber,
          customerName,
          subtotal: this.totals.subtotal,
          tax: this.totals.tax,
          total: this.totals.total,
          status: 'pending'
        };

        const createdOrder = await this.pendingOrdersService.createPendingOrder(payload);
        if (createdOrder) {
          void this.printKitchenTicketAfterSave(createdOrder as Order);
        }

        this.snackBar.open('Comanda guardada', 'Cerrar', { duration: 2000 });
        this.orderService.clearOrder();


      } catch (error: any) {
        this.snackBar.open(error.message || 'Error al guardar comanda', 'Cerrar', {
          duration: 3000
        });
      }
    }
  }

  processPayment(method: 'cash' | 'card') {
    // Aquí abriremos un diílogo para procesar el pago
    // Por ahora, simplemente completamos la orden
    this.router.navigate(['/checkout'], {
      queryParams: { method }
    });
  }

  goToPendingOrders() {
    this.router.navigate(['/pending-orders']);
  }

  goToCashRegister() {
    this.router.navigate(['/cash-register']);
  }

  goToReports() {
    this.router.navigate(['/reports']);
  }

  goToProductsAdmin() {
    this.router.navigate(['/admin/products']);
  }

  goToPromotionsAdmin() {
    this.router.navigate(['/admin/promotions']);
  }

  goToUsersAdmin() {
    this.router.navigate(['/admin/users']);
  }

  goToPrinterSettings() {
    this.router.navigate(['/admin/printer']);
  }

  goToSuppliesAdmin() {
    this.router.navigate(['/admin/supplies']);
  }

  goToInventoryMovements() {
    this.router.navigate(['/inventory-movements']);
  }

  goToExpenses() {
    this.router.navigate(['/expenses']);
  }

  goToSettings() {
    this.router.navigate(['/settings']);
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  isAdminOrBarista(): boolean {
    return this.authService.hasRole('admin', 'barista');
  }

  async logout() {
    const confirmed = await this.uiDialog.confirm({
      title: 'Cerrar sesión',
      message: '¿Estás seguro de cerrar sesión?',
      confirmText: 'Cerrar sesión'
    });
    if (confirmed) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }
  }

  private async printKitchenTicketAfterSave(order: Order): Promise<void> {
    const printed = await this.printerService.printKitchenTicket(order);
    if (!printed) {
      this.snackBar.open('Comanda guardada, pero no se pudo imprimir el ticket de proceso', 'Cerrar', {
        duration: 3500
      });
    }
  }

  private async buildSelectedProductSelection(product: Product): Promise<DrinkSelectionResult | null> {
    const normalizedName = this.normalizeText(product.name);
    const categoryName = this.getProductCategoryName(product);
    const isFoodProduct = this.normalizeDrinkBaseType(product.drinkBaseType) === 'food';
    const hasBaseSelection = this.hasDrinkBaseSelection(product);
    const hasFlavorSelection = this.hasFlavorSelection(product);
    const hasFoodCustomization = this.hasFoodCustomization(product);
    const serviceTemperature = this.normalizeServiceTemperature(product.serviceTemperature);
    const isColdOnly = serviceTemperature === 'cold-only';
    const needsHotCold = this.requiresHotColdSelection(categoryName);
    const isFlatWhite = normalizedName.includes('flat white');
    const isEspresso = normalizedName.includes('espresso') || normalizedName.includes('expresso');
    const hasSpecialNameOptions = isFlatWhite || isEspresso;

    const needsDialog =
      hasFoodCustomization ||
      hasSpecialNameOptions ||
      needsHotCold ||
      hasBaseSelection ||
      hasFlavorSelection;

    if (!isFoodProduct && isColdOnly && needsHotCold && !hasSpecialNameOptions && !hasBaseSelection) {
      const cfg = this.resolveDrinkVariantPriceConfig(product);
      return {
        name: `${product.name} - Frío 16 oz`,
        price: product.price + cfg.cold16OzExtra
      };
    }

    if (!needsDialog) {
      return {
        name: product.name,
        price: product.price
      };
    }

    const dialogRef = this.dialog.open(DrinkOptionsDialogComponent, {
      width: '680px',
      maxWidth: '96vw',
      data: {
        product,
        categoryName,
        serviceTemperature,
        priceConfig: this.resolveDrinkVariantPriceConfig(product)
      }
    });

    return (await firstValueFrom(dialogRef.afterClosed())) ?? null;
  }

  private requiresHotColdSelection(category: string): boolean {
    const normalizedCategory = this.normalizeText(category);
    return normalizedCategory === 'con cafe' || normalizedCategory === 'sin cafeina';
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private resolveDrinkVariantPriceConfig(product: Product): DrinkVariantPriceConfig {
    return {
      ...this.drinkVariantPriceConfig,
      ...(product.variantPricing || {})
    };
  }

  private hasDrinkBaseSelection(product: Product): boolean {
    const drinkBaseType = this.normalizeDrinkBaseType(product.drinkBaseType);
    return drinkBaseType === 'milk' || drinkBaseType === 'water';
  }

  private hasFlavorSelection(product: Product): boolean {
    return product.allowFlavorSelection === true;
  }

  private hasFoodCustomization(product: Product): boolean {
    if (this.normalizeDrinkBaseType(product.drinkBaseType) !== 'food') return false;
    return this.normalizeOptionList(product.removableIngredients).length > 0
      || this.normalizeOptionList(product.extraIngredients).length > 0;
  }

  private normalizeDrinkBaseType(value: unknown): DrinkBaseType {
    return value === 'milk' || value === 'water' || value === 'food'
      ? value
      : 'none';
  }

  private normalizeServiceTemperature(value: unknown): ProductServiceTemperature {
    return value === 'cold-only' ? 'cold-only' : 'default';
  }
}

type DrinkVariantPriceConfig = Required<ProductVariantPricing>;

type DrinkSelectionResult = {
  name: string;
  price: number;
};

type DrinkOptionsDialogData = {
  product: Product;
  categoryName: string;
  serviceTemperature: ProductServiceTemperature;
  priceConfig: DrinkVariantPriceConfig;
};

@Component({
  selector: 'app-drink-options-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>{{ data.product.name }}</h2>

    <mat-dialog-content class="drink-dialog-content">
      <p class="hint">{{ isFoodProduct ? 'Personaliza el alimento' : 'Selecciona la preparación' }}</p>

      <ng-container *ngIf="isFoodProduct; else drinkCustomization">
        <ng-container *ngIf="removableIngredients.length">
          <div class="section-title">Quitar ingredientes</div>
          <div class="option-grid cols-fluid">
            <button
              mat-stroked-button
              [class.selected]="excludedIngredients.length === 0"
              (click)="clearExcludedIngredients()"
            >
              Todo
            </button>
            <button
              mat-stroked-button
              *ngFor="let ingredient of removableIngredients"
              [class.selected]="isIngredientExcluded(ingredient)"
              (click)="toggleExcludedIngredient(ingredient)"
            >
              {{ getRemovableIngredientLabel(ingredient) }}
            </button>
          </div>
        </ng-container>

        <ng-container *ngIf="extraIngredients.length">
          <div class="section-title">Ingredientes extra</div>
          <div class="option-grid cols-fluid">
            <button
              mat-stroked-button
              *ngFor="let ingredient of extraIngredients"
              [class.selected]="isExtraIngredientSelected(ingredient)"
              (click)="toggleExtraIngredient(ingredient)"
            >
              {{ getExtraIngredientLabel(ingredient) }}
            </button>
          </div>
        </ng-container>
      </ng-container>

      <ng-template #drinkCustomization>
      <ng-container *ngIf="isEspresso; else nonEspresso">
        <div class="section-title">Tipo (3 oz)</div>
        <div class="option-grid cols-3">
          <button mat-stroked-button [class.selected]="espressoType === 'normal'" (click)="espressoType = 'normal'">
            Normal
          </button>
          <button mat-stroked-button [class.selected]="espressoType === 'doble'" (click)="espressoType = 'doble'">
            Doble
          </button>
          <button mat-stroked-button [class.selected]="espressoType === 'cortado'" (click)="espressoType = 'cortado'">
            Cortado
          </button>
        </div>
      </ng-container>

      <ng-template #nonEspresso>
        <ng-container *ngIf="isFlatWhite; else standardCoffee">
          <div class="fixed-pill">Caliente 8 oz</div>
        </ng-container>

        <ng-template #standardCoffee>
          <ng-container *ngIf="requiresHotCold">
            <ng-container *ngIf="!isColdOnly; else coldOnlyTemperature">
            <div class="section-title">Temperatura</div>
            <div class="option-grid cols-2">
              <button mat-stroked-button [class.selected]="temperature === 'hot'" (click)="temperature = 'hot'">
                Caliente
              </button>
              <button mat-stroked-button [class.selected]="temperature === 'cold'" (click)="temperature = 'cold'">
                Frío
              </button>
            </div>

            <div class="section-title" *ngIf="temperature === 'hot'">Tamaño</div>
            <div class="option-grid cols-2" *ngIf="temperature === 'hot'">
              <button mat-stroked-button [class.selected]="hotSizeOz === 12" (click)="hotSizeOz = 12">
                12 oz
              </button>
              <button mat-stroked-button [class.selected]="hotSizeOz === 16" (click)="hotSizeOz = 16">
                16 oz
              </button>
            </div>

            <div class="fixed-pill" *ngIf="temperature === 'cold'">Frío 16 oz</div>
            </ng-container>
            <ng-template #coldOnlyTemperature>
              <div class="fixed-pill">Solo frío 16 oz</div>
            </ng-template>
          </ng-container>
        </ng-template>
      </ng-template>

      <ng-container *ngIf="drinkBaseType !== 'none' && drinkBaseOptions.length">
        <div class="section-title">{{ drinkBaseType === 'milk' ? 'Tipo de leche' : 'Tipo de agua' }}</div>
        <div class="option-grid cols-fluid">
          <button
            mat-stroked-button
            *ngFor="let option of drinkBaseOptions"
            [class.selected]="drinkBaseOption === option"
            (click)="drinkBaseOption = option"
          >
            {{ getDrinkBaseOptionLabel(option) }}
          </button>
        </div>
      </ng-container>

      <ng-container *ngIf="allowFlavorSelection && flavorOptions.length">
        <div class="section-title">Sabor</div>
        <div class="option-grid cols-fluid">
          <button
            mat-stroked-button
            [class.selected]="flavorOption === ''"
            (click)="flavorOption = ''"
          >
            Sin sabor
          </button>
          <button
            mat-stroked-button
            *ngFor="let option of flavorOptions"
            [class.selected]="flavorOption === option"
            (click)="flavorOption = option"
          >
            {{ getFlavorOptionLabel(option) }}
          </button>
        </div>
      </ng-container>
      </ng-template>

      <div class="preview-box">
        <span class="preview-label">Se agregará como</span>
        <strong>{{ previewName }}</strong>
        <span class="preview-price">\${{ previewPrice.toFixed(2) }}</span>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">Cancelar</button>
      <button mat-raised-button color="primary" (click)="confirm()">Agregar</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .drink-dialog-content {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 320px;
    }

    .hint {
      margin: 0;
      color: rgba(0, 0, 0, 0.6);
      font-size: 13px;
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: rgba(0, 0, 0, 0.8);
      margin-top: 4px;
    }

    .option-grid {
      display: grid;
      gap: 8px;
    }

    .option-grid.cols-2 {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .option-grid.cols-fluid {
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    }

    .option-grid.cols-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .option-grid button {
      min-height: 42px;
      border-radius: 10px;
    }

    .option-grid button.selected {
      border-color: #1976d2;
      background-color: rgba(25, 118, 210, 0.08);
      color: #0d47a1;
      font-weight: 600;
    }

    .fixed-pill {
      display: inline-flex;
      align-self: flex-start;
      padding: 8px 12px;
      border-radius: 999px;
      background: #e3f2fd;
      color: #1565c0;
      font-weight: 600;
      font-size: 13px;
    }

    .preview-box {
      background: #f5f5f5;
      border-radius: 10px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .preview-label {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.6);
    }

    .preview-price {
      color: #2e7d32;
      font-weight: 700;
      font-size: 16px;
    }

    @media (max-width: 480px) {
      .drink-dialog-content {
        min-width: 0;
        max-height: min(68vh, 560px);
        overflow: auto;
      }

      .option-grid.cols-3 {
        grid-template-columns: 1fr;
      }

      .option-grid.cols-fluid {
        grid-template-columns: 1fr;
      }
    }

    @media (min-width: 481px) {
      .drink-dialog-content {
        max-height: unset;
        overflow: visible;
      }
    }
  `]
})
export class DrinkOptionsDialogComponent {
  temperature: 'hot' | 'cold' = 'hot';
  hotSizeOz: 12 | 16 = 12;
  espressoType: 'normal' | 'doble' | 'cortado' = 'normal';
  drinkBaseOption = '';
  flavorOption = '';
  excludedIngredients: string[] = [];
  selectedExtraIngredients: string[] = [];

  readonly isFoodProduct: boolean;
  readonly isEspresso: boolean;
  readonly isFlatWhite: boolean;
  readonly requiresHotCold: boolean;
  readonly serviceTemperature: ProductServiceTemperature;
  readonly isColdOnly: boolean;
  readonly drinkBaseType: DrinkBaseType;
  readonly drinkBaseOptions: string[];
  readonly drinkBaseOptionExtras: Record<string, number>;
  readonly allowFlavorSelection: boolean;
  readonly flavorOptions: string[];
  readonly flavorOptionExtras: Record<string, number>;
  readonly removableIngredients: string[];
  readonly extraIngredients: string[];
  readonly extraIngredientPrices: Record<string, number>;
  private readonly defaultMilkOptions = ['Entera', 'Deslactosada', 'Almendra', 'Avena'];
  private readonly defaultWaterOptions = ['Natural', 'Mineral'];
  private readonly defaultFlavorOptions = ['Vainilla', 'Caramelo', 'Avellana', 'Chocolate'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DrinkOptionsDialogData,
    private dialogRef: MatDialogRef<DrinkOptionsDialogComponent, DrinkSelectionResult | null>
  ) {
    const normalizedName = this.normalizeText(data.product.name);
    const normalizedCategory = this.normalizeText(data.categoryName);

    this.isFoodProduct = this.normalizeDrinkBaseType(data.product.drinkBaseType) === 'food';
    this.isEspresso = normalizedName.includes('espresso') || normalizedName.includes('expresso');
    this.isFlatWhite = normalizedName.includes('flat white');
    this.requiresHotCold = normalizedCategory === 'con cafe' || normalizedCategory === 'sin cafeina';
    this.serviceTemperature = this.normalizeServiceTemperature(data.serviceTemperature);
    this.isColdOnly = this.serviceTemperature === 'cold-only';
    this.drinkBaseType = this.normalizeDrinkBaseType(data.product.drinkBaseType);
    this.drinkBaseOptions = this.getDrinkBaseOptions();
    this.drinkBaseOptionExtras = this.getDrinkBaseOptionExtras();
    this.drinkBaseOption = this.drinkBaseOptions[0] || '';
    this.allowFlavorSelection = data.product.allowFlavorSelection === true;
    this.flavorOptions = this.getFlavorOptions();
    this.flavorOptionExtras = this.getFlavorOptionExtras();
    this.flavorOption = '';
    this.removableIngredients = this.normalizeOptionList(data.product.removableIngredients);
    this.extraIngredients = this.normalizeOptionList(data.product.extraIngredients);
    this.extraIngredientPrices = this.normalizeOptionExtras(data.product.extraIngredientPrices);
  }

  get previewName(): string {
    const name = this.data.product.name;
    if (this.isFoodProduct) {
      const exclusionLabel = this.getExcludedIngredientsSuffix();
      const extrasLabel = this.getExtraIngredientsSuffix();
      return `${name}${exclusionLabel}${extrasLabel}`;
    }

    const drinkBaseLabel = this.getDrinkBaseNameSuffix();
    const flavorLabel = this.getFlavorNameSuffix();

    if (this.isFlatWhite) {
      return `${name} - Caliente 8 oz${drinkBaseLabel}${flavorLabel}`;
    }

    if (this.isEspresso) {
      const baseName = this.espressoType === 'normal'
        ? `${name} - 3 oz`
        : `${name} ${this.capitalize(this.espressoType)} - 3 oz`;
      return `${baseName}${drinkBaseLabel}${flavorLabel}`;
    }

    if (this.requiresHotCold) {
      if (this.isColdOnly) {
        return `${name} - Frío 16 oz${drinkBaseLabel}${flavorLabel}`;
      }
      const baseName = this.temperature === 'cold'
        ? `${name} - Frío 16 oz`
        : `${name} - Caliente ${this.hotSizeOz} oz`;
      return `${baseName}${drinkBaseLabel}${flavorLabel}`;
    }

    return `${name}${drinkBaseLabel}${flavorLabel}`;
  }

  get previewPrice(): number {
    const base = this.data.product.price;
    if (this.isFoodProduct) {
      return base + this.getSelectedExtraIngredientsTotal();
    }

    const cfg = this.data.priceConfig;
    const drinkBaseExtra = this.getSelectedDrinkBaseExtra();
    const flavorExtra = this.getSelectedFlavorExtra();

    if (this.isFlatWhite) {
      return base + cfg.flatWhite8OzExtra + drinkBaseExtra + flavorExtra;
    }

    if (this.isEspresso) {
      if (this.espressoType === 'doble') {
        return base + cfg.espresso3OzExtra + cfg.espressoDobleExtra + drinkBaseExtra + flavorExtra;
      }
      if (this.espressoType === 'cortado') {
        return base + cfg.espresso3OzExtra + cfg.espressoCortadoExtra + drinkBaseExtra + flavorExtra;
      }
      return base + cfg.espresso3OzExtra + drinkBaseExtra + flavorExtra;
    }

    if (this.requiresHotCold) {
      if (this.isColdOnly) {
        return base + cfg.cold16OzExtra + drinkBaseExtra + flavorExtra;
      }
      if (this.temperature === 'cold') {
        return base + cfg.cold16OzExtra + drinkBaseExtra + flavorExtra;
      }
      return base + (this.hotSizeOz === 16 ? cfg.hot16OzExtra : cfg.hot12OzExtra) + drinkBaseExtra + flavorExtra;
    }

    return base + drinkBaseExtra + flavorExtra;
  }

  confirm() {
    this.dialogRef.close({
      name: this.previewName,
      price: this.previewPrice
    });
  }

  cancel() {
    this.dialogRef.close(null);
  }

  private normalizeText(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private normalizeDrinkBaseType(value: unknown): DrinkBaseType {
    return value === 'milk' || value === 'water' || value === 'food'
      ? value
      : 'none';
  }

  private normalizeServiceTemperature(value: unknown): ProductServiceTemperature {
    return value === 'cold-only' ? 'cold-only' : 'default';
  }

  private getDrinkBaseOptions(): string[] {
    if (this.drinkBaseType === 'milk') {
      const productOptions = this.normalizeOptionList(this.data.product.milkOptions);
      return productOptions.length ? productOptions : [...this.defaultMilkOptions];
    }

    if (this.drinkBaseType === 'water') {
      const productOptions = this.normalizeOptionList(this.data.product.waterOptions);
      return productOptions.length ? productOptions : [...this.defaultWaterOptions];
    }

    return [];
  }

  private getDrinkBaseOptionExtras(): Record<string, number> {
    if (this.drinkBaseType === 'milk') {
      return this.normalizeOptionExtras(this.data.product.milkOptionExtras);
    }

    if (this.drinkBaseType === 'water') {
      return this.normalizeOptionExtras(this.data.product.waterOptionExtras);
    }

    return {};
  }

  private getFlavorOptions(): string[] {
    if (!this.allowFlavorSelection) return [];
    const productOptions = this.normalizeOptionList(this.data.product.flavorOptions);
    return productOptions.length ? productOptions : [...this.defaultFlavorOptions];
  }

  private getFlavorOptionExtras(): Record<string, number> {
    if (!this.allowFlavorSelection) return {};
    return this.normalizeOptionExtras(this.data.product.flavorOptionExtras);
  }

  private normalizeOptionList(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const out: string[] = [];
    for (const value of values) {
      if (typeof value !== 'string') continue;
      const clean = value.trim();
      if (!clean) continue;
      if (!out.some(v => v.toLowerCase() === clean.toLowerCase())) {
        out.push(clean);
      }
    }
    return out;
  }

  private normalizeOptionExtras(values: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!values || typeof values !== 'object' || Array.isArray(values)) return out;

    for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
      if (typeof key !== 'string') continue;
      const normalizedKey = key.trim();
      if (!normalizedKey) continue;
      const parsed = typeof raw === 'number' ? raw : Number(raw);
      out[normalizedKey] = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    }

    return out;
  }

  private getSelectedDrinkBaseExtra(): number {
    if (!this.drinkBaseOption) return 0;
    return this.getDrinkBaseOptionExtra(this.drinkBaseOption);
  }

  private getSelectedFlavorExtra(): number {
    if (!this.flavorOption) return 0;
    return this.getFlavorOptionExtra(this.flavorOption);
  }

  toggleExcludedIngredient(ingredient: string) {
    const existing = this.excludedIngredients.findIndex(value => value.toLowerCase() === ingredient.toLowerCase());
    if (existing >= 0) {
      this.excludedIngredients = this.excludedIngredients.filter((_, index) => index !== existing);
      return;
    }
    this.excludedIngredients = [...this.excludedIngredients, ingredient];
  }

  clearExcludedIngredients() {
    this.excludedIngredients = [];
  }

  isIngredientExcluded(ingredient: string): boolean {
    return this.excludedIngredients.some(value => value.toLowerCase() === ingredient.toLowerCase());
  }

  getRemovableIngredientLabel(ingredient: string): string {
    return `Sin ${ingredient}`;
  }

  toggleExtraIngredient(ingredient: string) {
    const existing = this.selectedExtraIngredients.findIndex(value => value.toLowerCase() === ingredient.toLowerCase());
    if (existing >= 0) {
      this.selectedExtraIngredients = this.selectedExtraIngredients.filter((_, index) => index !== existing);
      return;
    }
    this.selectedExtraIngredients = [...this.selectedExtraIngredients, ingredient];
  }

  isExtraIngredientSelected(ingredient: string): boolean {
    return this.selectedExtraIngredients.some(value => value.toLowerCase() === ingredient.toLowerCase());
  }

  getExtraIngredientLabel(ingredient: string): string {
    const extra = this.getExtraIngredientPrice(ingredient);
    return extra > 0 ? `${ingredient} (+$${extra.toFixed(2)})` : ingredient;
  }

  getDrinkBaseOptionExtra(option: string): number {
    const fromExact = this.drinkBaseOptionExtras[option];
    if (typeof fromExact === 'number' && Number.isFinite(fromExact)) {
      return fromExact;
    }

    const match = Object.entries(this.drinkBaseOptionExtras).find(
      ([key]) => key.toLowerCase() === option.toLowerCase()
    );
    if (!match) return 0;
    return Number.isFinite(match[1]) ? Math.max(0, match[1]) : 0;
  }

  getDrinkBaseOptionLabel(option: string): string {
    const extra = this.getDrinkBaseOptionExtra(option);
    return extra > 0 ? `${option} (+$${extra.toFixed(2)})` : option;
  }

  getFlavorOptionExtra(option: string): number {
    const fromExact = this.flavorOptionExtras[option];
    if (typeof fromExact === 'number' && Number.isFinite(fromExact)) {
      return fromExact;
    }

    const match = Object.entries(this.flavorOptionExtras).find(
      ([key]) => key.toLowerCase() === option.toLowerCase()
    );
    if (!match) return 0;
    return Number.isFinite(match[1]) ? Math.max(0, match[1]) : 0;
  }

  getFlavorOptionLabel(option: string): string {
    const extra = this.getFlavorOptionExtra(option);
    return extra > 0 ? `${option} (+$${extra.toFixed(2)})` : option;
  }

  private getDrinkBaseNameSuffix(): string {
    if (!this.drinkBaseOption || this.drinkBaseType === 'none') return '';
    return this.drinkBaseType === 'milk'
      ? ` - Leche ${this.drinkBaseOption}`
      : ` - Agua ${this.drinkBaseOption}`;
  }

  private getFlavorNameSuffix(): string {
    if (!this.flavorOption) return '';
    return ` - Sabor ${this.flavorOption}`;
  }

  private getExcludedIngredientsSuffix(): string {
    if (!this.excludedIngredients.length) return '';
    return ` - ${this.excludedIngredients.map(ingredient => `Sin ${ingredient}`).join(' - ')}`;
  }

  private getExtraIngredientsSuffix(): string {
    if (!this.selectedExtraIngredients.length) return '';
    return ` - Extra ${this.selectedExtraIngredients.join(', ')}`;
  }

  private getSelectedExtraIngredientsTotal(): number {
    return this.selectedExtraIngredients.reduce((sum, ingredient) => sum + this.getExtraIngredientPrice(ingredient), 0);
  }

  private getExtraIngredientPrice(ingredient: string): number {
    const exact = this.extraIngredientPrices[ingredient];
    if (typeof exact === 'number' && Number.isFinite(exact)) {
      return Math.max(0, exact);
    }

    const match = Object.entries(this.extraIngredientPrices).find(
      ([key]) => key.toLowerCase() === ingredient.toLowerCase()
    );
    if (!match) return 0;
    return Number.isFinite(match[1]) ? Math.max(0, match[1]) : 0;
  }
}








