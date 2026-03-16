import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { OrderService } from '../../core/services/order.service';
import { AppliedPromotionSummary, Expense, Order, Product, ProductCategory } from '../../core/models/domain.models';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { PaymentService } from '../../core/services/payment.service';
import { buildApiUrl } from '../../core/config/server.config';
import { firstValueFrom } from 'rxjs';
import { ExpenseService } from '../../core/services/expense.service';

interface SalesStats {
  totalSales: number;
  totalOrders: number;
  cashSales: number;
  cardSales: number;
  averageTicket: number;
}

interface ProductStats {
  productId: number;
  name: string;
  quantity: number;
  total: number;
}

interface Payment {
  id: number;
  method: 'cash' | 'card';
  amount: number;
  paidAt: string;
  order: Order;
}

interface ExpenseCategoryTotal {
  category: string;
  total: number;
}

interface WeekdaySalesPoint {
  label: string;
  shortLabel: string;
  total: number;
}

interface HourlySalesPoint {
  hour: number;
  label: string;
  total: number;
}

interface PromotionStats {
  promotionalSales: number;
  promotionalDiscountTotal: number;
  promotionalOrders: number;
}

interface PromotionReportItem {
  name: string;
  discountTotal: number;
  orderCount: number;
  salesTotal: number;
}


@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Reportes y Estadísticas</span>
    </mat-toolbar>

    <div class="reports-container">
      <!-- Filtros de fecha -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Período</mat-label>
              <mat-select [(ngModel)]="selectedPeriod" (ngModelChange)="onPeriodChange()">
                <mat-option value="today">Hoy</mat-option>
                <mat-option value="week">Esta Semana</mat-option>
                <mat-option value="month">Este Mes</mat-option>
                <mat-option value="custom">Personalizado</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="selectedPeriod === 'custom'">
              <mat-label>Fecha Inicio</mat-label>
              <input matInput [matDatepicker]="pickerStart" [(ngModel)]="startDate">
              <mat-datepicker-toggle matSuffix [for]="pickerStart"></mat-datepicker-toggle>
              <mat-datepicker #pickerStart></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="selectedPeriod === 'custom'">
              <mat-label>Fecha Fin</mat-label>
              <input matInput [matDatepicker]="pickerEnd" [(ngModel)]="endDate">
              <mat-datepicker-toggle matSuffix [for]="pickerEnd"></mat-datepicker-toggle>
              <mat-datepicker #pickerEnd></mat-datepicker>
            </mat-form-field>

            <button mat-raised-button color="primary" (click)="loadReports()">
              <mat-icon>refresh</mat-icon>
              Actualizar
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <mat-tab-group>
        <!-- Tab: Resumen de Ventas -->
        <mat-tab label="Resumen">
          <div class="tab-content">
            <!-- KPIs -->
            <div class="kpi-grid">
              <mat-card class="kpi-card total-sales">
                <mat-icon>attach_money</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Total Ventas</span>
                  <span class="kpi-value">\${{stats.totalSales.toFixed(2)}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card total-orders">
                <mat-icon>receipt_long</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Pedidos</span>
                  <span class="kpi-value">{{stats.totalOrders}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card average-ticket">
                <mat-icon>shopping_cart</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Ticket Promedio</span>
                  <span class="kpi-value">\${{stats.averageTicket.toFixed(2)}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card cash-sales">
                <mat-icon>payments</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Efectivo</span>
                  <span class="kpi-value">\${{stats.cashSales.toFixed(2)}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card card-sales">
                <mat-icon>credit_card</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Tarjeta</span>
                  <span class="kpi-value">\${{stats.cardSales.toFixed(2)}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card promotion-sales">
                <mat-icon>local_offer</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Ventas con promo</span>
                  <span class="kpi-value">\${{promotionStats.promotionalSales.toFixed(2)}}</span>
                </div>
              </mat-card>

              <mat-card class="kpi-card promotion-discount">
                <mat-icon>sell</mat-icon>
                <div class="kpi-content">
                  <span class="kpi-label">Descuento promo</span>
                  <span class="kpi-value">\${{promotionStats.promotionalDiscountTotal.toFixed(2)}}</span>
                </div>
              </mat-card>
            </div>

            <!-- Gráfico de métodos de pago -->
            <mat-card class="chart-card">
              <mat-card-header>
                <mat-card-title>Distribución de Pagos</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="payment-chart">
                  <div class="chart-bars">
                    <div class="bar-container">
                      <div 
                        class="bar cash"
                        [style.height.%]="getPercentage(stats.cashSales)"
                      ></div>
                      <span class="bar-label">Efectivo</span>
                      <span class="bar-value">\${{stats.cashSales.toFixed(2)}}</span>
                      <span class="bar-percent">{{getPercentage(stats.cashSales).toFixed(0)}}%</span>
                    </div>
                    <div class="bar-container">
                      <div 
                        class="bar card"
                        [style.height.%]="getPercentage(stats.cardSales)"
                      ></div>
                      <span class="bar-label">Tarjeta</span>
                      <span class="bar-value">\${{stats.cardSales.toFixed(2)}}</span>
                      <span class="bar-percent">{{getPercentage(stats.cardSales).toFixed(0)}}%</span>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="chart-card">
              <mat-card-header>
                <mat-card-title>Rendimiento de promociones</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="promotion-kpi-grid" *ngIf="promotionStats.promotionalOrders > 0; else noPromotionData">
                  <div class="promotion-kpi">
                    <span class="mini-caption">Órdenes con promoción</span>
                    <strong>{{promotionStats.promotionalOrders}}</strong>
                  </div>
                  <div class="promotion-kpi">
                    <span class="mini-caption">Venta final</span>
                    <strong>\${{promotionStats.promotionalSales.toFixed(2)}}</strong>
                  </div>
                  <div class="promotion-kpi">
                    <span class="mini-caption">Descuento aplicado</span>
                    <strong>\${{promotionStats.promotionalDiscountTotal.toFixed(2)}}</strong>
                  </div>
                </div>

                <div class="promotion-breakdown" *ngIf="promotionBreakdown.length > 0">
                  <div class="promotion-breakdown-row" *ngFor="let item of promotionBreakdown">
                    <div>
                      <div class="promotion-name">{{item.name}}</div>
                      <div class="promotion-meta">{{item.orderCount}} órdenes</div>
                    </div>
                    <div class="promotion-values">
                      <span>Venta: \${{item.salesTotal.toFixed(2)}}</span>
                      <strong>Desc: \${{item.discountTotal.toFixed(2)}}</strong>
                    </div>
                  </div>
                </div>

                <ng-template #noPromotionData>
                  <div class="empty-state compact">
                    <mat-icon>local_offer</mat-icon>
                    <p>No hubo ventas con promoción en este período</p>
                  </div>
                </ng-template>
              </mat-card-content>
            </mat-card>

            <div class="dashboard-mini-grid">
              <mat-card class="mini-chart-card">
                <mat-card-header>
                  <mat-card-title>Ventas por día de la semana</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="weekday-chart" *ngIf="weekdaySales.length > 0; else noWeekdaySales">
                    <div class="weekday-target-line" [style.bottom.%]="getWeekdayTargetLineBottom()"></div>
                    <div class="weekday-columns">
                      <div class="weekday-col" *ngFor="let item of weekdaySales" [title]="item.label + ': $' + item.total.toFixed(2)">
                        <div class="weekday-col-bar" [style.height.%]="getWeekdaySalesBarHeight(item.total)"></div>
                        <div class="weekday-col-label">{{item.shortLabel}}</div>
                      </div>
                    </div>
                  </div>
                  <ng-template #noWeekdaySales>
                    <div class="empty-state compact">
                      <mat-icon>calendar_view_week</mat-icon>
                      <p>Sin ventas para el período</p>
                    </div>
                  </ng-template>
                </mat-card-content>
              </mat-card>

              <mat-card class="mini-chart-card hour-bars-card">
                <mat-card-header>
                  <mat-card-title>Ventas por Hora</mat-card-title>
                </mat-card-header>
                <mat-card-content>
                  <div class="hour-bars-chart" *ngIf="hourlySalesVisible.length > 0; else noHourlySales">
                    <div class="hour-bars-header">
                      <div>
                        <div class="mini-caption">Hora más fuerte</div>
                        <div class="mini-highlight">{{getTopHourLabel()}}</div>
                      </div>
                      <div class="mini-total">\${{getTopHourTotal().toFixed(2)}}</div>
                    </div>
                    <div class="hour-line-wrap">
                      <svg class="hour-line-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <line class="hour-grid-line" x1="0" x2="100" y1="20" y2="20"></line>
                        <line class="hour-grid-line" x1="0" x2="100" y1="40" y2="40"></line>
                        <line class="hour-grid-line" x1="0" x2="100" y1="60" y2="60"></line>
                        <line class="hour-grid-line" x1="0" x2="100" y1="80" y2="80"></line>
                        <line class="hour-target-svg" x1="0" x2="100" [attr.y1]="100 - getHourlyTargetLineBottom()" [attr.y2]="100 - getHourlyTargetLineBottom()"></line>
                        <polyline class="hour-line-path" [attr.points]="getHourlyLinePoints()"></polyline>
                        <g *ngFor="let item of hourlySalesVisible; let i = index">
                          <circle
                            class="hour-line-dot"
                            [attr.cx]="getHourlyPointX(i)"
                            [attr.cy]="getHourlyPointY(item.total)"
                            [attr.r]="isTopHourPoint(item) ? 2.4 : 1.7"
                            [attr.fill]="isTopHourPoint(item) ? '#ffd54f' : '#fff'"
                            [attr.stroke]="isTopHourPoint(item) ? '#f9a825' : '#34b56f'"
                            [attr.stroke-width]="isTopHourPoint(item) ? 1.2 : 0.9"
                          >
                            <title>{{item.label}}: \${{item.total.toFixed(2)}}</title>
                          </circle>
                        </g>
                      </svg>
                      <div class="hour-x-labels" [style.gridTemplateColumns]="'repeat(' + hourlySalesVisible.length + ', minmax(0,1fr))'">
                        <span class="hour-x-label" *ngFor="let item of hourlySalesVisible; let i = index">{{getHourAxisLabel(item, i)}}</span>
                      </div>
                    </div>
                  </div>
                  <ng-template #noHourlySales>
                    <div class="empty-state compact">
                      <mat-icon>bar_chart</mat-icon>
                      <p>Sin ventas por hora para el período</p>
                    </div>
                  </ng-template>
                </mat-card-content>
              </mat-card>
            </div>
          </div>
        </mat-tab>

        <!-- Tab: Productos Vendidos -->
        <mat-tab label="Productos">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Productos Más Vendidos</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="rank-chart" *ngIf="productStats.length > 0">
                  <div class="rank-row" *ngFor="let item of productStats | slice:0:8; let i = index">
                    <div class="rank-meta">
                      <span class="rank-index">#{{i + 1}}</span>
                      <span class="rank-name">{{item.name}}</span>
                    </div>
                    <div class="rank-track">
                      <div class="rank-fill" [style.width.%]="getProductQuantityWidth(item.quantity)"></div>
                    </div>
                    <div class="rank-stats">
                      <span>{{item.quantity}} pzs</span>
                      <strong>\${{item.total.toFixed(2)}}</strong>
                    </div>
                  </div>
                </div>

                <div class="table-scroll">
                <table mat-table [dataSource]="productStats" class="products-table">
                  <ng-container matColumnDef="rank">
                    <th mat-header-cell *matHeaderCellDef>#</th>
                    <td mat-cell *matCellDef="let element; let i = index">
                      <span class="rank">{{i + 1}}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="product">
                    <th mat-header-cell *matHeaderCellDef>Producto</th>
                    <td mat-cell *matCellDef="let element">{{element.name}}</td>
                  </ng-container>

                  <ng-container matColumnDef="quantity">
                    <th mat-header-cell *matHeaderCellDef>Cantidad</th>
                    <td mat-cell *matCellDef="let element">
                      <span class="quantity-badge">{{element.quantity}}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="total">
                    <th mat-header-cell *matHeaderCellDef>Total</th>
                    <td mat-cell *matCellDef="let element">
                      <span class="total-amount">\${{element.total.toFixed(2)}}</span>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
                </div>

                <div class="empty-state" *ngIf="productStats.length === 0">
                  <mat-icon>inventory_2</mat-icon>
                  <p>No hay productos vendidos en este período</p>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tab: Últimas Ventas -->
        <mat-tab label="Ventas">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Últimas Ventas</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="sales-list">
                  <mat-card 
                    *ngFor="let order of recentOrders"
                    class="sale-card"
                  >
                    <div class="sale-header">
                      <div class="sale-info">
                        <span class="sale-id">#{{order.id}}</span>
                        <span class="sale-date">{{formatDate(order.createdAt)}}</span>
                      </div>
                      <span 
                        class="payment-method"
                        [class.cash]="order.paymentMethod === 'cash'"
                        [class.card]="order.paymentMethod === 'card'"
                      >
                        <mat-icon>{{order.paymentMethod === 'cash' ? 'payments' : 'credit_card'}}</mat-icon>
                        {{order.paymentMethod === 'cash' ? 'Efectivo' : 'Tarjeta'}}
                      </span>
                    </div>

                    <div class="sale-promo" *ngIf="hasPromotion(order)">
                      <mat-icon>local_offer</mat-icon>
                      <span>Venta con promoción</span>
                      <strong>- \${{getOrderDiscountTotal(order).toFixed(2)}}</strong>
                    </div>

                    <div class="sale-promo-list" *ngIf="order.appliedPromotions?.length">
                      <div class="sale-promo-entry" *ngFor="let promotion of order.appliedPromotions">
                        <span>{{promotion.promotionName}}</span>
                        <strong>- \${{promotion.discountTotal.toFixed(2)}}</strong>
                      </div>
                    </div>

                    <div class="sale-items">
                      <div 
                        class="sale-item"
                        *ngFor="let item of order.items"
                      >
                        <span>{{item.quantity}}x {{item.name}}</span>
                        <span>\${{item.subtotal.toFixed(2)}}</span>
                      </div>
                    </div>

                    <div class="sale-total">
                      <span>Total:</span>
                      <span class="total-amount">\${{order.total.toFixed(2)}}</span>
                    </div>
                  </mat-card>
                </div>

                <div class="empty-state" *ngIf="recentOrders.length === 0">
                  <mat-icon>receipt_long</mat-icon>
                  <p>No hay ventas en este período</p>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tab: Inventario -->
        <mat-tab label="Inventario">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Estado del Inventario</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="inventory-grid">
                  <mat-card 
                    *ngFor="let product of products"
                    class="inventory-card"
                    [class.low-stock]="isLowStock(product)"
                    [class.out-of-stock]="isOutOfStock(product)"
                  >
                    <div class="product-info">
                      <h4>{{product.name}}</h4>
                      <p>{{getProductCategoryName(product)}}</p>
                    </div>
                    <div class="stock-info">
                      <span class="stock-label">Stock:</span>
                      <span class="stock-value">{{product.stock || 0}}</span>
                    </div>
                    <div class="stock-status" *ngIf="isLowStock(product) || isOutOfStock(product)">
                      <mat-icon>{{isOutOfStock(product) ? 'error' : 'warning'}}</mat-icon>
                      <span>{{isOutOfStock(product) ? 'Agotado' : 'Stock Bajo'}}</span>
                    </div>
                  </mat-card>
                </div>
              </mat-card-content>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tab: Gastos -->
        <mat-tab label="Gastos">
          <div class="tab-content">
            <mat-card>
              <mat-card-header>
                <mat-card-title>Gastos del Período</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <div class="expense-summary">
                  <div class="expense-total">
                    <span class="label">Total Gastos</span>
                    <span class="value">\${{expenseTotal.toFixed(2)}}</span>
                  </div>
                  <div class="expense-count">
                    <span class="label">Registros</span>
                    <span class="value">{{expenses.length}}</span>
                  </div>
                </div>

                <div class="table-scroll">
                <table mat-table [dataSource]="expenses" class="expenses-table">
                  <ng-container matColumnDef="date">
                    <th mat-header-cell *matHeaderCellDef>Fecha</th>
                    <td mat-cell *matCellDef="let element">{{formatDate(element.timestamp)}}</td>
                  </ng-container>

                  <ng-container matColumnDef="concept">
                    <th mat-header-cell *matHeaderCellDef>Concepto</th>
                    <td mat-cell *matCellDef="let element">
                      {{element.concept || element.description || 'Sin concepto'}}
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="category">
                    <th mat-header-cell *matHeaderCellDef>Categoría</th>
                    <td mat-cell *matCellDef="let element">{{element.category}}</td>
                  </ng-container>

                  <ng-container matColumnDef="user">
                    <th mat-header-cell *matHeaderCellDef>Usuario</th>
                    <td mat-cell *matCellDef="let element">{{element.userName || 'N/D'}}</td>
                  </ng-container>

                  <ng-container matColumnDef="amount">
                    <th mat-header-cell *matHeaderCellDef>Monto</th>
                    <td mat-cell *matCellDef="let element" class="expense-amount">\${{element.amount.toFixed(2)}}</td>
                  </ng-container>

                  <ng-container matColumnDef="notes">
                    <th mat-header-cell *matHeaderCellDef>Notas</th>
                    <td mat-cell *matCellDef="let element">{{element.notes || '-'}}</td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="expenseColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: expenseColumns;"></tr>
                </table>
                </div>

                <div class="empty-state" *ngIf="expenses.length === 0">
                  <mat-icon>receipt</mat-icon>
                  <p>No hay gastos en este período</p>
                </div>

                <div class="expense-categories" *ngIf="expenseCategoryTotals.length > 0">
                  <h4>Totales por Categoría</h4>
                  <div class="expense-bar-chart">
                    <div class="expense-bar-row" *ngFor="let item of expenseCategoryTotals">
                      <div class="expense-bar-head">
                        <span>{{item.category}}</span>
                        <strong>\${{item.total.toFixed(2)}}</strong>
                      </div>
                      <div class="expense-track">
                        <div class="expense-fill" [style.width.%]="getExpenseCategoryWidth(item.total)"></div>
                      </div>
                    </div>
                  </div>
                  <div class="category-grid">
                    <div class="category-item" *ngFor="let item of expenseCategoryTotals">
                      <span>{{item.category}}</span>
                      <span>\${{item.total.toFixed(2)}}</span>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>
            
          </div>
        </mat-tab>
      </mat-tab-group>
    </div>
  `,
  styles: [`
    .reports-container {
      min-height: calc(100vh - 64px);
      background-color: #f5f5f5;
      padding: 20px;
    }

    .filters-card {
      margin-bottom: 20px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }

    .filters-row mat-form-field {
      min-width: 200px;
    }

    .tab-content {
      padding: 20px;
    }

    /* KPIs */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .kpi-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
    }

    .kpi-card mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }

    .kpi-card.total-sales mat-icon { color: #4caf50; }
    .kpi-card.total-orders mat-icon { color: #2196f3; }
    .kpi-card.average-ticket mat-icon { color: #ff9800; }
    .kpi-card.cash-sales mat-icon { color: #8bc34a; }
    .kpi-card.card-sales mat-icon { color: #00bcd4; }
    .kpi-card.promotion-sales mat-icon { color: #fb8c00; }
    .kpi-card.promotion-discount mat-icon { color: #8e24aa; }

    .kpi-content {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .kpi-label {
      font-size: 14px;
      color: rgba(0,0,0,0.6);
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
    }

    /* Gráfico */
    .chart-card {
      margin-bottom: 24px;
    }

    .payment-chart {
      padding: 20px;
    }

    .promotion-kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .promotion-kpi {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px;
      border-radius: 10px;
      background: #fafafa;
    }

    .promotion-kpi strong {
      font-size: 22px;
      color: #ef6c00;
    }

    .promotion-breakdown {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .promotion-breakdown-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding: 12px;
      border-radius: 10px;
      background: #fafbfc;
      border: 1px solid #eceff1;
    }

    .promotion-name {
      font-weight: 600;
    }

    .promotion-meta {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      margin-top: 4px;
    }

    .promotion-values {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      font-size: 13px;
    }

    .chart-bars {
      display: flex;
      justify-content: space-around;
      align-items: flex-end;
      height: 300px;
      gap: 40px;
    }

    .bar-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .bar {
      width: 100%;
      max-width: 120px;
      border-radius: 8px 8px 0 0;
      transition: height 0.3s ease;
      min-height: 10%;
    }

    .bar.cash {
      background: linear-gradient(to top, #4caf50, #8bc34a);
    }

    .bar.card {
      background: linear-gradient(to top, #2196f3, #64b5f6);
    }

    .bar-label {
      font-size: 14px;
      font-weight: 500;
    }

    .bar-value {
      font-size: 18px;
      font-weight: 700;
      color: #333;
    }

    .bar-percent {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .dashboard-mini-grid {
      display: grid;
      grid-template-columns: 1.1fr 1.9fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .weekday-chart {
      position: relative;
    }

    .weekday-target-line {
      position: absolute;
      left: 0;
      right: 0;
      border-top: 2px solid rgba(196, 96, 96, 0.45);
    }

    .weekday-columns {
      height: 220px;
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 8px;
      align-items: end;
      padding-top: 8px;
    }

    .weekday-col {
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      gap: 6px;
      align-items: stretch;
      height: 100%;
    }

    .weekday-col-bar {
      width: 100%;
      margin-top: auto;
      min-height: 4px;
      background: #ef9b7f;
    }

    .weekday-col-label {
      font-size: 11px;
      text-align: center;
    }

    .hour-bars-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
      padding: 8px 10px;
      border-radius: 10px;
    }

    .mini-caption {
      font-size: 11px;
      color: rgba(0,0,0,0.55);
    }

    .mini-highlight {
      font-size: 18px;
      font-weight: 700;
      color: #1565c0;
    }

    .mini-total {
      font-size: 18px;
      font-weight: 700;
      color: #00897b;
    }

    .hour-line-svg {
      width: 100%;
      height: 156px;
      display: block;
    }

    .hour-grid-line {
      stroke: #edf1f4;
      stroke-width: 0.7;
    }

    .hour-target-svg {
      stroke: rgba(196, 96, 96, 0.45);
      stroke-width: 0.8;
      stroke-dasharray: 2 2;
    }

    .hour-line-path {
      fill: none;
      stroke: #34b56f;
      stroke-width: 1;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .hour-line-dot {
      fill: #fff;
      stroke: #34b56f;
      stroke-width: 0.9;
    }

    .hour-x-labels {
      display: grid;
      gap: 2px;
      margin-top: 2px;
    }

    .hour-x-label {
      font-size: 9px;
      text-align: center;
      color: rgba(0,0,0,0.5);
      min-height: 12px;
    }

    /* Tabla de productos */
    .products-table {
      width: 100%;
      min-width: 620px;
    }

    .rank-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 12px;
    }

    .rank-row {
      display: grid;
      grid-template-columns: minmax(140px, 2fr) minmax(120px, 4fr) minmax(120px, 1.6fr);
      gap: 10px;
      align-items: center;
    }

    .rank-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .rank-index {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #e3f2fd;
      color: #1565c0;
      font-weight: 700;
      font-size: 12px;
      flex: 0 0 auto;
    }

    .rank-name {
      font-size: 13px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .rank-track {
      height: 10px;
      border-radius: 999px;
      background: #eceff1;
      overflow: hidden;
    }

    .rank-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #26a69a 0%, #66bb6a 100%);
    }

    .rank-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      font-size: 12px;
    }

    .rank-stats strong {
      color: #2e7d32;
    }

    .rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #e3f2fd;
      color: #1976d2;
      font-weight: 600;
    }

    .quantity-badge {
      display: inline-block;
      padding: 4px 12px;
      background-color: #e8f5e9;
      color: #2e7d32;
      border-radius: 12px;
      font-weight: 500;
    }

    .total-amount {
      font-weight: 600;
      color: #4caf50;
      font-size: 16px;
    }

    /* Lista de ventas */
    .sales-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .sale-card {
      padding: 16px;
    }

    .sale-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .sale-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .sale-id {
      font-weight: 600;
      font-size: 16px;
    }

    .sale-date {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .payment-method {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 500;
    }

    .payment-method.cash {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .payment-method.card {
      background-color: #e3f2fd;
      color: #1976d2;
    }

    .payment-method mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    .sale-promo {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      border-radius: 10px;
      background: #fff3e0;
      color: #ef6c00;
      margin-bottom: 12px;
      font-size: 13px;
      font-weight: 600;
    }

    .sale-promo-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 12px;
    }

    .sale-promo-entry {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      background: #fff8e1;
      border-radius: 8px;
      font-size: 13px;
    }

    .sale-items {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
      padding: 12px;
      background-color: #fafafa;
      border-radius: 8px;
    }

    .sale-item {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
    }

    .sale-total {
      display: flex;
      justify-content: space-between;
      padding-top: 12px;
      border-top: 2px solid #e0e0e0;
      font-size: 18px;
      font-weight: 600;
    }

    /* Inventario */
    .inventory-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
    }

    .inventory-card {
      padding: 16px;
      position: relative;
    }

    .inventory-card.low-stock {
      border-left: 4px solid #ff9800;
    }

    .inventory-card.out-of-stock {
      border-left: 4px solid #f44336;
      opacity: 0.7;
    }

    .product-info h4 {
      margin: 0 0 4px 0;
      font-size: 16px;
    }

    .product-info p {
      margin: 0;
      font-size: 12px;
      color: rgba(0,0,0,0.6);
    }

    .stock-info {
      display: flex;
      justify-content: space-between;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e0e0e0;
    }

    .stock-label {
      font-size: 14px;
      color: rgba(0,0,0,0.6);
    }

    .stock-value {
      font-size: 24px;
      font-weight: 700;
      color: #4caf50;
    }

    .inventory-card.low-stock .stock-value {
      color: #ff9800;
    }

    .inventory-card.out-of-stock .stock-value {
      color: #f44336;
    }

    .stock-status {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 8px;
      font-size: 12px;
      font-weight: 500;
    }

    .inventory-card.low-stock .stock-status {
      color: #ff9800;
    }

    .inventory-card.out-of-stock .stock-status {
      color: #f44336;
    }

    .stock-status mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Empty state */
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: rgba(0,0,0,0.6);
    }

    /* Gastos */
    .expense-summary {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    .expense-summary .label {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      text-transform: uppercase;
    }

    .expense-summary .value {
      font-size: 20px;
      font-weight: 700;
    }

    .expense-total, .expense-count {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      border-radius: 8px;
      background-color: #fafafa;
      min-width: 180px;
    }

    .expense-amount {
      color: #f44336;
      font-weight: 600;
    }

    .expenses-table {
      width: 100%;
      margin-bottom: 16px;
      min-width: 760px;
    }

    .expense-categories h4 {
      margin: 16px 0 8px 0;
      font-size: 16px;
    }

    .expense-bar-chart {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 14px;
      padding: 12px;
      border-radius: 12px;
      background: #fafbfc;
      border: 1px solid #eceff1;
    }

    .expense-bar-row {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .expense-bar-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 13px;
      font-weight: 500;
    }

    .expense-bar-head strong {
      color: #c62828;
      white-space: nowrap;
    }

    .expense-track {
      height: 10px;
      border-radius: 999px;
      background: #f1f3f4;
      overflow: hidden;
    }

    .expense-fill {
      height: 100%;
      border-radius: 999px;
      background: linear-gradient(90deg, #ff8a65 0%, #e53935 100%);
    }

    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .category-item {
      display: flex;
      justify-content: space-between;
      padding: 12px;
      background-color: #fafafa;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
    }

    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
      margin-bottom: 16px;
    }

    .empty-state.compact {
      padding: 28px 12px;
    }

    .empty-state.compact mat-icon {
      font-size: 42px;
      width: 42px;
      height: 42px;
      margin-bottom: 8px;
    }

    @media (max-width: 768px) {
      .reports-container {
        padding: 12px;
      }

      .kpi-grid {
        grid-template-columns: 1fr;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filters-row mat-form-field {
        width: 100%;
      }

      .chart-bars {
        height: 200px;
      }

      .dashboard-mini-grid {
        grid-template-columns: 1fr;
      }

      .hour-line-svg {
        height: 140px;
      }

      .rank-row {
        grid-template-columns: 1fr;
        gap: 6px;
      }

      .rank-track {
        order: 3;
      }

      .rank-stats {
        justify-content: flex-start;
      }

      .expenses-table {
        min-width: 680px;
      }
    }
  `]
})

export class ReportsComponent implements OnInit {
  selectedPeriod = 'today';
  startDate: Date = new Date();
  endDate: Date = new Date();
  

  stats: SalesStats = {
    totalSales: 0,
    totalOrders: 0,
    cashSales: 0,
    cardSales: 0,
    averageTicket: 0
  };

  productStats: ProductStats[] = [];
  recentOrders: Order[] = [];
  products: Product[] = [];
  productCategoryRows: ProductCategory[] = [];
  expenses: Expense[] = [];
  expenseTotal = 0;
  expenseCategoryTotals: ExpenseCategoryTotal[] = [];
  weekdaySales: WeekdaySalesPoint[] = [];
  hourlySales: HourlySalesPoint[] = [];
  hourlySalesVisible: HourlySalesPoint[] = [];
  promotionStats: PromotionStats = {
    promotionalSales: 0,
    promotionalDiscountTotal: 0,
    promotionalOrders: 0
  };
  promotionBreakdown: PromotionReportItem[] = [];

  displayedColumns: string[] = ['rank', 'product', 'quantity', 'total'];
  expenseColumns: string[] = ['date', 'concept', 'category', 'user', 'amount', 'notes'];

  constructor(
    private orderService: OrderService,
    private paymentService: PaymentService,
    private http: HttpClient,
    private expenseService: ExpenseService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadProducts();
    this.onPeriodChange();
  }

  async loadProducts() {
    const [categoriesRaw, productsRaw] = await Promise.all([
      firstValueFrom(this.http.get<any[]>(buildApiUrl('product-categories'))),
      firstValueFrom(this.http.get<any[]>(buildApiUrl('products')))
    ]);

    this.productCategoryRows = (categoriesRaw || []).map(row => ({
      id: row.id,
      name: row.name,
      active: row.active !== false,
      sortOrder: Number(row.sortOrder || 0),
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date()
    }));

    this.products = (productsRaw || []).map(row => ({
      id: row.id,
      name: row.name || '',
      description: row.description || '',
      price: Number(row.price || 0),
      image: row.image || '',
      category: row.categoryName || '',
      categoryId: row.categoryId,
      available: row.available !== false,
      stock: row.stock == null ? undefined : Number(row.stock),
      variantPricing: row.variantPricing || undefined,
      drinkBaseType: row.drinkBaseType || undefined,
      milkOptions: row.milkOptions || undefined,
      waterOptions: row.waterOptions || undefined,
      milkOptionExtras: row.milkOptionExtras || undefined,
      waterOptionExtras: row.waterOptionExtras || undefined,
      serviceTemperature: row.serviceTemperature || undefined
    }));
  }

  onPeriodChange() {
    const now = new Date();
    
    switch (this.selectedPeriod) {
      case 'today':
        this.startDate = startOfDay(now);
        this.endDate = endOfDay(now);
        break;
      case 'week':
        this.startDate = startOfWeek(now, { locale: es });
        this.endDate = endOfWeek(now, { locale: es });
        break;
      case 'month':
        this.startDate = startOfMonth(now);
        this.endDate = endOfMonth(now);
        break;
    }

    this.loadReports();
  }

  async loadReports() {
    const payments: Payment[] =
      await this.paymentService.getPaymentsByDateRange(
        this.startDate,
        this.endDate
      ) ?? [];


    this.calculateStatsFromPayments(payments);
    this.buildWeekdaySales(payments);
    this.buildHourlySales(payments);

    this.recentOrders = payments
      .filter(p => p.order)
      .map(p => ({
        ...p.order,
        paymentMethod: p.method,
        discountTotal: this.getOrderDiscountTotal(p.order),
        appliedPromotions: this.normalizeAppliedPromotions(p.order?.appliedPromotions)
      }));

    this.buildPromotionReport(this.recentOrders);
    this.calculateProductStats();
    await this.loadExpenses();
  }


  calculateStatsFromPayments(payments: any[]) {
    const completedPayments = payments.filter(p => p.order);

    this.stats.totalSales = completedPayments.reduce(
      (sum, p) => sum + this.getPaymentReportAmount(p),
      0
    );

    this.stats.totalOrders = new Set(
      completedPayments.map(p => p.order.id)
    ).size;

    this.stats.cashSales = completedPayments
      .filter(p => p.method === 'cash')
      .reduce((sum, p) => sum + this.getPaymentReportAmount(p), 0);

    this.stats.cardSales = completedPayments
      .filter(p => p.method === 'card')
      .reduce((sum, p) => sum + this.getPaymentReportAmount(p), 0);

    this.stats.averageTicket =
      this.stats.totalOrders > 0
        ? this.stats.totalSales / this.stats.totalOrders
        : 0;
  }


  calculateProductStats() {
    const productMap = new Map<number, ProductStats>();

    for (const order of this.recentOrders) {
      for (const item of order.items) {
        const existing = productMap.get(item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.total += item.subtotal;
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            total: item.subtotal
          });
        }
      }
    }

    this.productStats = Array.from(productMap.values())
      .sort((a, b) => b.quantity - a.quantity);
  }

  buildPromotionReport(orders: Order[]) {
    const promotionalOrders = orders.filter(order => this.hasPromotion(order));
    this.promotionStats = {
      promotionalSales: promotionalOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
      promotionalDiscountTotal: promotionalOrders.reduce((sum, order) => sum + this.getOrderDiscountTotal(order), 0),
      promotionalOrders: promotionalOrders.length
    };

    const map = new Map<string, PromotionReportItem>();
    for (const order of promotionalOrders) {
      for (const promotion of this.normalizeAppliedPromotions(order.appliedPromotions)) {
        const existing = map.get(promotion.promotionName);
        if (existing) {
          existing.orderCount += 1;
          existing.discountTotal += Number(promotion.discountTotal || 0);
          existing.salesTotal += Number(order.total || 0);
          continue;
        }

        map.set(promotion.promotionName, {
          name: promotion.promotionName,
          orderCount: 1,
          discountTotal: Number(promotion.discountTotal || 0),
          salesTotal: Number(order.total || 0)
        });
      }
    }

    this.promotionBreakdown = Array.from(map.values())
      .sort((left, right) => right.discountTotal - left.discountTotal);
  }


  getPercentage(amount: number): number {
    if (this.stats.totalSales === 0) return 0;
    return (amount / this.stats.totalSales) * 100;
  }

  formatDate(date: string | Date): string {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  }

  hasPromotion(order: Order): boolean {
    return this.getOrderDiscountTotal(order) > 0 || this.normalizeAppliedPromotions(order.appliedPromotions).length > 0;
  }

  getOrderDiscountTotal(order: Partial<Order> | null | undefined): number {
    const value = Number(order?.discountTotal);
    return Number.isFinite(value) ? value : 0;
  }


  isLowStock(product: Product): boolean {
    return product.stock !== undefined && product.stock > 0 && product.stock <= 10;
  }

  isOutOfStock(product: Product): boolean {
    return product.stock !== undefined && product.stock <= 0;
  }

  getProductCategoryName(product: Product): string {
    if (product.categoryId) {
      const found = this.productCategoryRows.find(c => c.id === product.categoryId);
      if (found) return found.name;
    }
    return product.category || 'Sin categoría';
  }

  async loadExpenses() {
    this.expenses = await this.expenseService.getByDateRange(this.startDate, this.endDate);

    this.expenseTotal = this.expenses.reduce((sum, e) => sum + e.amount, 0);
    this.calculateExpenseCategoryTotals();
  }

  calculateExpenseCategoryTotals() {
    const map = new Map<string, number>();
    for (const expense of this.expenses) {
      map.set(expense.category, (map.get(expense.category) || 0) + expense.amount);
    }
    this.expenseCategoryTotals = Array.from(map.entries()).map(([category, total]) => ({
      category,
      total
    })).sort((a, b) => b.total - a.total);
  }

  buildWeekdaySales(payments: Payment[]) {
    const labels = [
      { label: 'Lunes', shortLabel: 'Lun' },
      { label: 'Martes', shortLabel: 'Mar' },
      { label: 'Miércoles', shortLabel: 'Mié' },
      { label: 'Jueves', shortLabel: 'Jue' },
      { label: 'Viernes', shortLabel: 'Vie' },
      { label: 'Sábado', shortLabel: 'Sáb' },
      { label: 'Domingo', shortLabel: 'Dom' }
    ];

    const totals = new Array<number>(7).fill(0);
    for (const payment of payments.filter(p => p.order)) {
      const date = new Date(payment.paidAt || payment.order?.createdAt || new Date());
      const dayIndex = this.toMondayFirstDayIndex(date.getDay());
      totals[dayIndex] += this.getPaymentReportAmount(payment);
    }

    this.weekdaySales = labels.map((item, index) => ({
      ...item,
      total: totals[index]
    }));
  }

  buildHourlySales(payments: Payment[]) {
    const totals = new Array<number>(24).fill(0);

    for (const payment of payments.filter(p => p.order)) {
      const date = new Date(payment.paidAt || payment.order?.createdAt || new Date());
      totals[date.getHours()] += this.getPaymentReportAmount(payment);
    }

    this.hourlySales = totals.map((total, hour) => ({
      hour,
      label: hour.toString().padStart(2, '0'),
      total
    }));
    this.hourlySalesVisible = this.hourlySales.filter(item => item.hour >= 7 && item.hour <= 22);
  }

  getProductQuantityWidth(quantity: number): number {
    const max = Math.max(...this.productStats.map(item => item.quantity), 0);
    if (max <= 0) return 0;
    return Math.max(6, (quantity / max) * 100);
  }

  getExpenseCategoryWidth(total: number): number {
    const max = Math.max(...this.expenseCategoryTotals.map(item => item.total), 0);
    if (max <= 0) return 0;
    return Math.max(6, (total / max) * 100);
  }

  getWeekdaySalesWidth(total: number): number {
    const max = Math.max(...this.weekdaySales.map(item => item.total), 0);
    if (max <= 0) return 0;
    return Math.max(6, (total / max) * 100);
  }

  getWeekdaySalesBarHeight(total: number): number {
    const max = Math.max(...this.weekdaySales.map(item => item.total), 0);
    if (max <= 0) return 0;
    return Math.max(3, (total / max) * 100);
  }

  getWeekdayTargetTotal(): number {
    if (this.weekdaySales.length === 0) return 0;
    const total = this.weekdaySales.reduce((sum, item) => sum + item.total, 0);
    return total / this.weekdaySales.length;
  }

  getWeekdayTargetLineBottom(): number {
    const max = Math.max(...this.weekdaySales.map(item => item.total), 0);
    if (max <= 0) return 0;
    return Math.min(100, (this.getWeekdayTargetTotal() / max) * 100);
  }

  getHourlyLinePoints(): string {
    return this.hourlySalesVisible
      .map((item, index) => `${this.getHourlyPointX(index)},${this.getHourlyPointY(item.total)}`)
      .join(' ');
  }

  getHourlyPointX(index: number): number {
    if (this.hourlySalesVisible.length <= 1) return 0;
    return (index / (this.hourlySalesVisible.length - 1)) * 100;
  }

  getHourlyPointY(total: number): number {
    const max = Math.max(...this.hourlySalesVisible.map(item => item.total), 0);
    if (max <= 0) return 96;
    const height = Math.max(6, (total / max) * 86);
    return 100 - height;
  }

  getHourlyTargetTotal(): number {
    if (this.hourlySalesVisible.length === 0) return 0;
    const total = this.hourlySalesVisible.reduce((sum, item) => sum + item.total, 0);
    return total / this.hourlySalesVisible.length;
  }

  getHourlyTargetLineBottom(): number {
    const max = Math.max(...this.hourlySalesVisible.map(item => item.total), 0);
    if (max <= 0) return 0;
    return Math.min(100, (this.getHourlyTargetTotal() / max) * 100);
  }

  getHourAxisLabel(item: HourlySalesPoint, index: number): string {
    if (index === 0) return '7:30a';
    if (index === this.hourlySalesVisible.length - 1) return '10:30p';
    return item.hour % 2 === 0 ? this.formatHourCompact(item.hour) : '';
  }

  getTopHourLabel(): string {
    const top = this.getTopHourPoint();
    return top ? `${top.label}:00` : '--';
  }

  getTopHourTotal(): number {
    return this.getTopHourPoint()?.total ?? 0;
  }

  isTopHourPoint(point: HourlySalesPoint): boolean {
    return this.getTopHourPoint()?.hour === point.hour;
  }

  private getTopHourPoint(): HourlySalesPoint | null {
    if (this.hourlySalesVisible.length === 0) return null;
    return this.hourlySalesVisible.reduce((max, current) => current.total > max.total ? current : max);
  }

  private formatHourCompact(hour: number): string {
    const suffix = hour >= 12 ? 'p' : 'a';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}${suffix}`;
  }

  private getPaymentReportAmount(payment: Payment): number {
    const orderTotal = Number(payment.order?.total);
    if (Number.isFinite(orderTotal) && orderTotal > 0) {
      return orderTotal;
    }

    const paymentAmount = Number(payment.amount);
    return Number.isFinite(paymentAmount) ? paymentAmount : 0;
  }

  private normalizeAppliedPromotions(value: unknown): AppliedPromotionSummary[] {
    if (!Array.isArray(value)) return [];
    return value
      .filter(item => item && typeof item === 'object')
      .map(item => {
        const row = item as Record<string, unknown>;
        return {
          promotionId: typeof row['promotionId'] === 'string' ? row['promotionId'] : '',
          promotionName: typeof row['promotionName'] === 'string' ? row['promotionName'] : 'Promoción',
          discountTotal: Number(row['discountTotal'] || 0),
          affectedUnits: Number(row['affectedUnits'] || 0)
        };
      })
      .filter(item => !!item.promotionName);
  }

  private toMondayFirstDayIndex(jsDay: number): number {
    return jsDay === 0 ? 6 : jsDay - 1;
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}


