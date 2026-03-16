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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { InventoryService } from '../../../core/services/inventory.service';
import { UiDialogService } from '../../../core/services/ui-dialog.service';
import { Supply, SupplyCategory } from '../../../core/models/domain.models';

@Component({
  selector: 'app-supplies-admin',
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
      <span>Administrar Insumos</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="addNewSupply()">
        <mat-icon>add</mat-icon>
      </button>
    </mat-toolbar>

    <div class="admin-container">
      <!-- Formulario -->
      <mat-card class="form-card" *ngIf="editingSupply">
        <mat-card-header>
          <mat-card-title>
            {{ editingSupply.id ? 'Editar Insumo' : 'Nuevo Insumo' }}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre</mat-label>
              <input matInput [(ngModel)]="editingSupply.name" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoría</mat-label>
              <mat-select [(ngModel)]="editingSupply.categoryId">
                <mat-option *ngFor="let category of categories" [value]="category.id">
                  {{category.name}}
                </mat-option>
              </mat-select>
              <button mat-icon-button matSuffix (click)="addCustomCategory()" type="button">
                <mat-icon>add</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Unidad</mat-label>
              <mat-select [(ngModel)]="editingSupply.unit">
                <mat-option *ngFor="let unit of units" [value]="unit">
                  {{unit}}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stock Actual</mat-label>
              <input matInput type="number" [(ngModel)]="editingSupply.currentStock" step="0.001" min="0">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stock Mínimo</mat-label>
              <input matInput type="number" [(ngModel)]="editingSupply.minStock" step="0.001" min="0">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Costo Unidad</mat-label>
              <input matInput type="number" [(ngModel)]="editingSupply.unitCost" step="0.01" min="0">
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notas</mat-label>
              <textarea matInput rows="2" [(ngModel)]="editingSupply.notes"></textarea>
            </mat-form-field>

            <div class="toggle-field">
              <mat-slide-toggle [(ngModel)]="editingSupply.active">
                Activo
              </mat-slide-toggle>
            </div>
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-button (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" (click)="saveSupply()">
            {{ editingSupply.id ? 'Actualizar' : 'Crear' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Lista -->
      <div class="supplies-list">
        <mat-card *ngFor="let supply of supplies" class="supply-item">
          <div class="supply-content">
            <div class="supply-info">
              <h3>{{supply.name}}</h3>
              <p class="category">{{getSupplyCategoryName(supply)}}</p>
              <div class="details">
                <span>Unidad: {{supply.unit}}</span>
                <span>Stock: {{supply.currentStock}}</span>
                <span *ngIf="supply.minStock !== undefined">Mín: {{supply.minStock}}</span>
                <span>Costo unidad: \${{(supply.unitCost || 0).toFixed(2)}}</span>
                <span class="value">Valor: \${{getInventoryValue(supply).toFixed(2)}}</span>
              </div>
              <div class="status" [class.inactive]="!supply.active">
                {{supply.active ? 'Activo' : 'Inactivo'}}
              </div>
            </div>
            <div class="supply-actions">
              <button mat-icon-button color="primary" (click)="editSupply(supply)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteSupply(supply)">
                <mat-icon>delete</mat-icon>
              </button>
            </div>
          </div>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .spacer {
      flex: 1;
    }

    .admin-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .form-card {
      margin-bottom: 24px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .toggle-field {
      display: flex;
      align-items: center;
      padding: 8px 0;
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px;
      flex-wrap: wrap;
    }

    .supplies-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .supply-item {
      padding: 16px;
    }

    .supply-content {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 16px;
      align-items: center;
    }

    .supply-info h3 {
      margin: 0 0 6px 0;
      font-size: 18px;
    }

    .category {
      margin: 0 0 8px 0;
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      text-transform: uppercase;
    }

    .details {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 14px;
      color: rgba(0,0,0,0.7);
    }

    .details .value {
      font-weight: 600;
      color: #4caf50;
    }

    .status {
      margin-top: 8px;
      font-size: 12px;
      font-weight: 600;
      color: #2e7d32;
    }

    .status.inactive {
      color: #f44336;
    }

    .supply-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    @media (max-width: 768px) {
      .admin-container {
        padding: 12px;
      }

      .supply-content {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .supply-actions {
        flex-direction: row;
        justify-content: flex-end;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      mat-card-actions button {
        width: 100%;
      }
    }
  `]
})
export class SuppliesAdminComponent implements OnInit {
  supplies: Supply[] = [];
  editingSupply: Supply | null = null;

  categories: SupplyCategory[] = [];
  units: string[] = [
    'kg',
    'gramos',
    'litros',
    'mililitros',
    'pzas',
    'caja',
    'paquete'
  ];

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private uiDialog: UiDialogService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadCategories();
    await this.loadSupplies();
  }

  async loadCategories() {
    this.categories = await this.inventoryService.getSupplyCategories();
  }

  async loadSupplies() {
    this.supplies = await this.inventoryService.getSupplies();
  }

  addNewSupply() {
    const defaultCategory = this.categories[0];
    this.editingSupply = {
      name: '',
      category: defaultCategory?.name || '',
      categoryId: defaultCategory?.id,
      unit: 'kg',
      currentStock: 0,
      unitCost: 0,
      minStock: 0,
      notes: '',
      active: true,
      createdAt: new Date()
    };
  }

  editSupply(supply: Supply) {
    const matchedCategory =
      this.categories.find(c => c.id === supply.categoryId) ||
      this.categories.find(c => c.name.toLowerCase() === (supply.category || '').toLowerCase());

    this.editingSupply = {
      ...supply,
      categoryId: matchedCategory?.id ?? supply.categoryId,
      category: matchedCategory?.name ?? supply.category
    };
  }

  cancelEdit() {
    this.editingSupply = null;
  }

  async addCustomCategory() {
    const category = await this.uiDialog.prompt({
      title: 'Nueva categoría',
      message: 'Captura el nombre de la categoría',
      label: 'Categoría',
      confirmText: 'Agregar',
      required: true
    });
    if (category && category.trim()) {
      const categoryId = await this.inventoryService.addSupplyCategory(category.trim());
      await this.loadCategories();
      const created = this.categories.find(c => c.id === categoryId);
      if (this.editingSupply) {
        this.editingSupply.categoryId = categoryId;
        this.editingSupply.category = created?.name || category.trim();
      }
    }
  }

  async saveSupply() {
    if (!this.editingSupply) return;

    if (!this.editingSupply.name || !this.editingSupply.unit) {
      this.snackBar.open('Completa nombre y unidad', 'Cerrar', { duration: 3000 });
      return;
    }

    const selectedCategory = this.categories.find(c => c.id === this.editingSupply?.categoryId);
    if (!selectedCategory) {
      this.snackBar.open('Selecciona una categoría', 'Cerrar', { duration: 3000 });
      return;
    }

    this.editingSupply.category = selectedCategory.name;

    try {
      if (this.editingSupply.id) {
        const { id, createdAt, ...updates } = this.editingSupply;
        await this.inventoryService.updateSupply(id, updates);
        this.snackBar.open('Insumo actualizado', 'Cerrar', { duration: 2000 });
      } else {
        await this.inventoryService.addSupply(this.editingSupply);
        this.snackBar.open('Insumo creado', 'Cerrar', { duration: 2000 });
      }

      this.editingSupply = null;
      await this.loadCategories();
      await this.loadSupplies();
    } catch (error) {
      console.error('Error al guardar insumo:', error);
      this.snackBar.open('Error al guardar insumo', 'Cerrar', { duration: 3000 });
    }
  }

  async deleteSupply(supply: Supply) {
    if (!supply.id) return;

    const confirmed = await this.uiDialog.confirm({
      title: 'Eliminar insumo',
      message: `¿Eliminar ${supply.name}?`,
      confirmText: 'Eliminar'
    });
    if (!confirmed) return;

    try {
      await this.inventoryService.updateSupply(supply.id, { active: false });
      this.snackBar.open('Insumo marcado como inactivo', 'Cerrar', { duration: 2000 });
      await this.loadSupplies();
    } catch (error) {
      console.error('Error al eliminar insumo:', error);
      this.snackBar.open('Error al eliminar insumo', 'Cerrar', { duration: 3000 });
    }
  }

  getInventoryValue(supply: Supply): number {
    return supply.currentStock * (supply.unitCost || 0);
  }

  getSupplyCategoryName(supply: Supply): string {
    if (supply.categoryId) {
      const found = this.categories.find(c => c.id === supply.categoryId);
      if (found) return found.name;
    }
    return supply.category || 'Sin categoría';
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}

