import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Product, ProductCategory } from '../../../core/models/domain.models';
import { buildApiUrl } from '../../../core/config/server.config';
import { Promotion, PromotionService } from '../../../core/services/promotion.service';

@Component({
  selector: 'app-promotions-admin',
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
    MatSelectModule,
    MatSlideToggleModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Promociones y Descuentos</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="startCreate()">
        <mat-icon>add</mat-icon>
      </button>
    </mat-toolbar>

    <div class="admin-container">
      <mat-card class="form-card" *ngIf="editingPromotion">
        <mat-card-header>
          <mat-card-title>{{ isEditingExisting() ? 'Editar promoción' : 'Nueva promoción' }}</mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre de la promoción</mat-label>
              <input matInput [(ngModel)]="editingPromotion.name" required>
            </mat-form-field>

            <div class="toggle-field full-width">
              <mat-slide-toggle [(ngModel)]="editingPromotion.active">
                Promoción activa
              </mat-slide-toggle>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select [(ngModel)]="editingPromotion.type">
                <mat-option value="percentage_discount">Descuento porcentual</mat-option>
                <mat-option value="bundle_price">Precio especial por combo</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Aplicar a</mat-label>
              <mat-select [(ngModel)]="editingPromotion.scope" (selectionChange)="onScopeChange()">
                <mat-option value="all">Todo el catálogo</mat-option>
                <mat-option value="category">Categorías</mat-option>
                <mat-option value="product">Productos</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="editingPromotion.type === 'percentage_discount'">
              <mat-label>Descuento (%)</mat-label>
              <input matInput type="number" min="0" max="100" step="0.01" [(ngModel)]="editingPromotion.percentageOff">
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="editingPromotion.type === 'bundle_price'">
              <mat-label>Cantidad requerida</mat-label>
              <input matInput type="number" min="2" step="1" [(ngModel)]="editingPromotion.bundleQuantity">
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="editingPromotion.type === 'bundle_price'">
              <mat-label>Precio del combo</mat-label>
              <input matInput type="number" min="0" step="0.01" [(ngModel)]="editingPromotion.bundlePrice">
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="editingPromotion.scope === 'category'">
              <mat-label>Categorías</mat-label>
              <mat-select [(ngModel)]="editingPromotion.categoryIds" multiple>
                <mat-option *ngFor="let category of categories" [value]="category.id">
                  {{ category.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width" *ngIf="editingPromotion.scope === 'product'">
              <mat-label>Productos</mat-label>
              <mat-select [(ngModel)]="editingPromotion.productIds" multiple>
                <mat-option *ngFor="let product of products" [value]="product.id">
                  {{ product.name }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Días de la semana</mat-label>
              <mat-select [(ngModel)]="editingPromotion.dayOfWeek" multiple>
                <mat-option *ngFor="let day of weekdays" [value]="day.value">
                  {{ day.label }}
                </mat-option>
              </mat-select>
              <mat-hint>Déjalo vacío si aplica cualquier día</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha inicial</mat-label>
              <input matInput type="date" [(ngModel)]="editingPromotion.startDate">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha final</mat-label>
              <input matInput type="date" [(ngModel)]="editingPromotion.endDate">
            </mat-form-field>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-button (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" (click)="savePromotion()">Guardar</button>
        </mat-card-actions>
      </mat-card>

      <div class="promotion-list">
        <mat-card class="promotion-item" *ngFor="let promotion of promotions">
          <div class="promotion-content">
            <div class="promotion-info">
              <div class="promotion-header">
                <h3>{{ promotion.name }}</h3>
                <span class="status" [class.active]="promotion.active" [class.inactive]="!promotion.active">
                  {{ promotion.active ? 'Activa' : 'Inactiva' }}
                </span>
              </div>
              <p>{{ describePromotion(promotion) }}</p>
              <div class="tags">
                <span class="tag">{{ describeScope(promotion) }}</span>
                <span class="tag" *ngIf="promotion.dayOfWeek.length">{{ describeWeekdays(promotion.dayOfWeek) }}</span>
                <span class="tag" *ngIf="promotion.startDate || promotion.endDate">
                  {{ describeDateRange(promotion) }}
                </span>
              </div>
            </div>
            <div class="promotion-actions">
              <button mat-icon-button color="primary" (click)="editPromotion(promotion)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deletePromotion(promotion.id)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .spacer { flex: 1; }
    .admin-container {
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .form-card {
      margin-bottom: 24px;
    }
    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .toggle-field {
      display: flex;
      align-items: center;
      min-height: 56px;
    }
    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px;
      flex-wrap: wrap;
    }
    .promotion-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .promotion-item {
      padding: 16px;
    }
    .promotion-content {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
    }
    .promotion-header {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .promotion-info h3 {
      margin: 0;
      font-size: 18px;
    }
    .promotion-info p {
      margin: 8px 0;
      color: rgba(0, 0, 0, 0.7);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .tag, .status {
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: #eceff1;
      color: #455a64;
    }
    .status.active {
      background: #e8f5e9;
      color: #2e7d32;
    }
    .status.inactive {
      background: #ffebee;
      color: #c62828;
    }
    .promotion-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (max-width: 768px) {
      .admin-container {
        padding: 12px;
      }
      .form-grid {
        grid-template-columns: 1fr;
      }
      .promotion-content {
        grid-template-columns: 1fr;
      }
      .promotion-actions {
        flex-direction: row;
        justify-content: flex-end;
      }
    }
  `]
})
export class PromotionsAdminComponent implements OnInit {
  promotions: Promotion[] = [];
  editingPromotion: Promotion | null = null;
  originalPromotionId: string | null = null;
  products: Product[] = [];
  categories: ProductCategory[] = [];
  readonly weekdays = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' }
  ];

  constructor(
    private promotionService: PromotionService,
    private http: HttpClient,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.promotionService.ensureLoaded();
    this.promotions = this.promotionService.getPromotions();
    await this.loadCatalog();
  }

  startCreate() {
    this.originalPromotionId = null;
    this.editingPromotion = this.promotionService.createDraftPromotion();
  }

  editPromotion(promotion: Promotion) {
    this.originalPromotionId = promotion.id;
    this.editingPromotion = JSON.parse(JSON.stringify(promotion));
  }

  cancelEdit() {
    this.originalPromotionId = null;
    this.editingPromotion = null;
  }

  isEditingExisting(): boolean {
    return !!this.originalPromotionId;
  }

  onScopeChange() {
    if (!this.editingPromotion) return;
    if (this.editingPromotion.scope !== 'category') {
      this.editingPromotion.categoryIds = [];
    }
    if (this.editingPromotion.scope !== 'product') {
      this.editingPromotion.productIds = [];
    }
  }

  async savePromotion() {
    if (!this.editingPromotion) return;
    const draft = {
      ...this.editingPromotion,
      name: this.editingPromotion.name.trim(),
      categoryNames: this.editingPromotion.scope === 'category'
        ? this.categories
            .filter(category => category.id != null && this.editingPromotion!.categoryIds.includes(category.id))
            .map(category => category.name)
        : []
    };

    if (!draft.name) {
      this.snackBar.open('Agrega un nombre para la promoción', 'Cerrar', { duration: 2600 });
      return;
    }

    if (draft.scope === 'category' && draft.categoryIds.length === 0) {
      this.snackBar.open('Selecciona al menos una categoría', 'Cerrar', { duration: 2600 });
      return;
    }

    if (draft.scope === 'product' && draft.productIds.length === 0) {
      this.snackBar.open('Selecciona al menos un producto', 'Cerrar', { duration: 2600 });
      return;
    }

    if (draft.type === 'percentage_discount' && (!draft.percentageOff || draft.percentageOff <= 0)) {
      this.snackBar.open('El descuento debe ser mayor a 0%', 'Cerrar', { duration: 2600 });
      return;
    }

    if (draft.type === 'bundle_price') {
      if (!draft.bundleQuantity || draft.bundleQuantity < 2) {
        this.snackBar.open('La promo por combo requiere al menos 2 productos', 'Cerrar', { duration: 2600 });
        return;
      }
      if (!draft.bundlePrice || draft.bundlePrice <= 0) {
        this.snackBar.open('Ingresa el precio especial del combo', 'Cerrar', { duration: 2600 });
        return;
      }
    }

    await this.promotionService.savePromotion(draft);
    this.promotions = this.promotionService.getPromotions();
    this.cancelEdit();
    this.snackBar.open('Promoción guardada', 'Cerrar', { duration: 2200 });
  }

  async deletePromotion(id: string) {
    await this.promotionService.deletePromotion(id);
    this.promotions = this.promotionService.getPromotions();
    if (this.originalPromotionId === id) {
      this.cancelEdit();
    }
    this.snackBar.open('Promoción eliminada', 'Cerrar', { duration: 2200 });
  }

  describePromotion(promotion: Promotion): string {
    if (promotion.type === 'bundle_price') {
      return `${promotion.bundleQuantity} por $${Number(promotion.bundlePrice || 0).toFixed(2)}`;
    }
    return `${Number(promotion.percentageOff || 0).toFixed(2)}% de descuento`;
  }

  describeScope(promotion: Promotion): string {
    if (promotion.scope === 'all') {
      return 'Todo el catálogo';
    }
    if (promotion.scope === 'category') {
      const labels = this.categories
        .filter(category => category.id != null && promotion.categoryIds.includes(category.id))
        .map(category => category.name);
      return labels.length ? labels.join(', ') : 'Categorías';
    }
    const labels = this.products
      .filter(product => product.id != null && promotion.productIds.includes(product.id))
      .map(product => product.name);
    return labels.length ? labels.join(', ') : 'Productos';
  }

  describeWeekdays(dayOfWeek: number[]): string {
    return this.weekdays
      .filter(day => dayOfWeek.includes(day.value))
      .map(day => day.label)
      .join(', ');
  }

  describeDateRange(promotion: Promotion): string {
    if (promotion.startDate && promotion.endDate) {
      return `${promotion.startDate} a ${promotion.endDate}`;
    }
    return promotion.startDate || promotion.endDate || '';
  }

  goBack() {
    this.router.navigate(['/pos']);
  }

  private async loadCatalog() {
    const [productsRows, categoryRows] = await Promise.all([
      firstValueFrom(this.http.get<any[]>(buildApiUrl('products'))),
      firstValueFrom(this.http.get<any[]>(buildApiUrl('product-categories')))
    ]);

    this.products = (productsRows || []).map(row => ({
      id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      description: typeof row?.description === 'string' ? row.description : '',
      price: Number.isFinite(Number(row?.price)) ? Number(row.price) : 0,
      image: typeof row?.image === 'string' ? row.image : '',
      category: typeof row?.categoryName === 'string' ? row.categoryName : '',
      categoryId: Number.isFinite(Number(row?.categoryId)) ? Number(row.categoryId) : undefined,
      available: row?.available !== false
    } as Product));

    this.categories = (categoryRows || []).map(row => ({
      id: Number.isFinite(Number(row?.id)) ? Number(row.id) : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      active: row?.active !== false,
      sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
      createdAt: row?.createdAt ? new Date(row.createdAt) : new Date()
    }));
  }
}
