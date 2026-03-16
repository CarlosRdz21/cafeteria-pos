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
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InventoryService } from '../../core/services/inventory.service';
import { AuthService, User } from '../../core/services/auth.service';
import { Supply, SupplyCategory, SupplyMovement } from '../../core/models/domain.models';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

@Component({
  selector: 'app-inventory-movements',
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
    MatDatepickerModule,
    MatNativeDateModule,
    MatTableModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Movimientos de Insumos</span>
    </mat-toolbar>

    <div class="movements-container">
      <!-- Formulario -->
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Registrar Movimiento</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select [(ngModel)]="movementForm.type">
                <mat-option value="in">Entrada</mat-option>
                <mat-option value="out">Salida</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Insumo</mat-label>
              <mat-select [(ngModel)]="movementForm.supplyId">
                <mat-option *ngFor="let supply of supplies" [value]="supply.id">
                  {{supply.name}} ({{supply.unit}})
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" [(ngModel)]="movementForm.quantity" step="0.001" min="0">
            </mat-form-field>

            <mat-form-field appearance="outline" *ngIf="movementForm.type === 'in'">
              <mat-label>Costo Unitario</mat-label>
              <input matInput type="number" [(ngModel)]="movementForm.unitCost" step="0.01" min="0">
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Motivo</mat-label>
              <input matInput [(ngModel)]="movementForm.reason">
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Referencia</mat-label>
              <input matInput [(ngModel)]="movementForm.reference">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notas</mat-label>
              <textarea matInput rows="2" [(ngModel)]="movementForm.notes"></textarea>
            </mat-form-field>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-button (click)="resetForm()">Limpiar</button>
          <button mat-raised-button color="primary" (click)="saveMovement()">
            Guardar
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Filtros -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Inicio</mat-label>
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="startDate" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fin</mat-label>
              <input matInput [matDatepicker]="endPicker" [(ngModel)]="endDate" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select [(ngModel)]="filterType" (ngModelChange)="applyFilters()">
                <mat-option value="all">Todos</mat-option>
                <mat-option value="in">Entradas</mat-option>
                <mat-option value="out">Salidas</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoría</mat-label>
              <mat-select [(ngModel)]="filterCategory" (ngModelChange)="applyFilters()">
                <mat-option value="all">Todas</mat-option>
                <mat-option *ngFor="let category of categories" [value]="category.name">
                  {{category.name}}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Resumen -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-grid">
            <div class="summary-item">
              <span class="label">Entradas</span>
              <span class="value">\${{totalEntries.toFixed(2)}}</span>
            </div>
            <div class="summary-item">
              <span class="label">Salidas</span>
              <span class="value">\${{totalExits.toFixed(2)}}</span>
            </div>
            <div class="summary-item">
              <span class="label">Movimientos</span>
              <span class="value">{{filteredMovements.length}}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Tabla -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>Movimientos</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-scroll">
            <table mat-table [dataSource]="filteredMovements" class="movements-table">
              <ng-container matColumnDef="date">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let element">{{formatDate(element.timestamp)}}</td>
              </ng-container>

              <ng-container matColumnDef="type">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let element">
                  <span class="type-badge" [class.in]="element.type === 'in'" [class.out]="element.type === 'out'">
                    {{element.type === 'in' ? 'Entrada' : 'Salida'}}
                  </span>
                </td>
              </ng-container>

              <ng-container matColumnDef="supply">
                <th mat-header-cell *matHeaderCellDef>Insumo</th>
                <td mat-cell *matCellDef="let element">{{getSupplyName(element.supplyId)}}</td>
              </ng-container>

              <ng-container matColumnDef="quantity">
                <th mat-header-cell *matHeaderCellDef>Cantidad</th>
                <td mat-cell *matCellDef="let element">
                  {{element.quantity}} {{getSupplyUnit(element.supplyId)}}
                </td>
              </ng-container>

              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Costo</th>
                <td mat-cell *matCellDef="let element" class="amount">
                  \${{(element.totalCost || 0).toFixed(2)}}
                </td>
              </ng-container>

              <ng-container matColumnDef="user">
                <th mat-header-cell *matHeaderCellDef>Usuario</th>
                <td mat-cell *matCellDef="let element">{{element.userName || 'N/D'}}</td>
              </ng-container>

              <ng-container matColumnDef="notes">
                <th mat-header-cell *matHeaderCellDef>Notas</th>
                <td mat-cell *matCellDef="let element">{{element.notes || '-'}}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <div class="empty-state" *ngIf="filteredMovements.length === 0">
            <mat-icon>swap_vert</mat-icon>
            <p>No hay movimientos en este período</p>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .movements-container {
      min-height: calc(100vh - 64px);
      background-color: #f5f5f5;
      padding: 20px;
    }

    .form-card, .filters-card, .summary-card {
      margin-bottom: 20px;
    }

    .form-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }

    .filters-row mat-form-field {
      min-width: 200px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px;
      background-color: #fafafa;
      border-radius: 8px;
    }

    .summary-item .label {
      font-size: 12px;
      color: rgba(0,0,0,0.6);
      text-transform: uppercase;
    }

    .summary-item .value {
      font-size: 20px;
      font-weight: 700;
    }

    .movements-table {
      width: 100%;
      min-width: 760px;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .type-badge {
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }

    .type-badge.in {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .type-badge.out {
      background-color: #ffebee;
      color: #c62828;
    }

    .amount {
      font-weight: 600;
      color: #333;
    }

    .empty-state {
      text-align: center;
      padding: 40px 20px;
      color: rgba(0,0,0,0.6);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 12px;
    }

    @media (max-width: 768px) {
      .movements-container {
        padding: 12px;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filters-row mat-form-field {
        width: 100%;
      }

      .movements-table {
        min-width: 680px;
      }
    }
  `]
})
export class InventoryMovementsComponent implements OnInit {
  supplies: Supply[] = [];
  movements: SupplyMovement[] = [];
  filteredMovements: SupplyMovement[] = [];

  categories: SupplyCategory[] = [];

  movementForm = {
    type: 'in' as 'in' | 'out',
    supplyId: undefined as number | undefined,
    quantity: 0,
    unitCost: 0,
    reason: '',
    reference: '',
    notes: ''
  };

  startDate: Date = startOfDay(new Date());
  endDate: Date = endOfDay(new Date());
  filterType: 'all' | 'in' | 'out' = 'all';
  filterCategory: 'all' | string = 'all';

  totalEntries = 0;
  totalExits = 0;
  displayedColumns: string[] = ['date', 'type', 'supply', 'quantity', 'amount', 'user', 'notes'];

  currentUser: User | null = null;

  constructor(
    private inventoryService: InventoryService,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    await this.loadCategories();
    await this.loadSupplies();
    await this.loadMovements();
  }

  async loadCategories() {
    this.categories = await this.inventoryService.getSupplyCategories();
  }

  async loadSupplies() {
    this.supplies = await this.inventoryService.getSupplies();
  }

  async loadMovements() {
    this.movements = await this.inventoryService.getMovementsByDateRange(
      this.startDate,
      this.endDate
    );
    this.applyFilters();
  }

  applyFilters() {
    const start = startOfDay(this.startDate);
    const end = endOfDay(this.endDate);

    this.filteredMovements = this.movements.filter(m => {
      const time = new Date(m.timestamp).getTime();
      const inRange = time >= start.getTime() && time <= end.getTime();
      const matchesType = this.filterType === 'all' || m.type === this.filterType;
      const supply = this.supplies.find(s => s.id === m.supplyId);
      const matchesCategory =
        this.filterCategory === 'all' || this.getSupplyCategoryNameBySupply(supply) === this.filterCategory;
      return inRange && matchesType && matchesCategory;
    });

    this.totalEntries = this.filteredMovements
      .filter(m => m.type === 'in')
      .reduce((sum, m) => sum + (m.totalCost || 0), 0);
    this.totalExits = this.filteredMovements
      .filter(m => m.type === 'out')
      .reduce((sum, m) => sum + (m.totalCost || 0), 0);
  }

  async saveMovement() {
    if (!this.movementForm.supplyId || this.movementForm.quantity <= 0) {
      this.snackBar.open('Selecciona insumo y cantidad válida', 'Cerrar', { duration: 3000 });
      return;
    }

    try {
      if (this.movementForm.type === 'in') {
        await this.inventoryService.recordEntry({
          supplyId: this.movementForm.supplyId,
          quantity: this.movementForm.quantity,
          unitCost: this.movementForm.unitCost || undefined,
          reason: this.movementForm.reason,
          reference: this.movementForm.reference,
          userId: this.currentUser?.id,
          userName: this.currentUser?.name,
          notes: this.movementForm.notes
        });
      } else {
        await this.inventoryService.recordExit({
          supplyId: this.movementForm.supplyId,
          quantity: this.movementForm.quantity,
          reason: this.movementForm.reason,
          reference: this.movementForm.reference,
          userId: this.currentUser?.id,
          userName: this.currentUser?.name,
          notes: this.movementForm.notes
        });
      }

      this.snackBar.open('Movimiento registrado', 'Cerrar', { duration: 2000 });
      this.resetForm();
      await this.loadSupplies();
      await this.loadMovements();
    } catch (error: any) {
      this.snackBar.open(error?.message || 'Error al registrar movimiento', 'Cerrar', { duration: 3000 });
    }
  }

  resetForm() {
    this.movementForm = {
      type: 'in',
      supplyId: undefined,
      quantity: 0,
      unitCost: 0,
      reason: '',
      reference: '',
      notes: ''
    };
  }

  getSupplyName(id: number) {
    return this.supplies.find(s => s.id === id)?.name || 'N/D';
  }

  getSupplyUnit(id: number) {
    return this.supplies.find(s => s.id === id)?.unit || '';
  }

  private getSupplyCategoryNameBySupply(supply?: Supply): string {
    if (!supply) return '';
    if (supply.categoryId) {
      const found = this.categories.find(c => c.id === supply.categoryId);
      if (found) return found.name;
    }
    return supply.category || '';
  }

  formatDate(date: Date | string): string {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}

