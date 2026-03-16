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
import { MatDialogModule } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Expense } from '../../core/models/domain.models';
import { AuthService, User } from '../../core/services/auth.service';
import { CashRegisterService } from '../../core/services/cash-register.service';
import { UiDialogService } from '../../core/services/ui-dialog.service';
import { ExpenseService } from '../../core/services/expense.service';
import { endOfDay, format, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';

interface CategoryTotal {
  category: string;
  total: number;
}

@Component({
  selector: 'app-expenses',
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
    MatDialogModule,
    MatTableModule,
    MatSnackBarModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Registro de Gastos</span>
      <span class="spacer"></span>
      <button mat-raised-button color="accent" (click)="setToday()">
        <mat-icon>today</mat-icon>
        Hoy
      </button>
    </mat-toolbar>

    <div class="expenses-container">
      <!-- Formulario de gasto -->
      <mat-card class="form-card">
        <mat-card-header>
          <mat-card-title>Nuevo Gasto</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Concepto</mat-label>
              <input matInput [(ngModel)]="newExpense.concept" required>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Monto</mat-label>
              <input matInput type="number" [(ngModel)]="newExpense.amount" step="0.01" min="0">
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoría</mat-label>
              <mat-select [(ngModel)]="newExpense.category">
                <mat-option *ngFor="let category of categories" [value]="category">
                  {{category}}
                </mat-option>
                <mat-option [value]="customCategory" *ngIf="showCustomCategory">
                  {{customCategory}}
                </mat-option>
              </mat-select>
              <button mat-icon-button matSuffix type="button" (click)="addCustomCategory()">
                <mat-icon>add</mat-icon>
              </button>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha</mat-label>
              <input matInput [matDatepicker]="expenseDatePicker" [(ngModel)]="newExpenseDate">
              <mat-datepicker-toggle matSuffix [for]="expenseDatePicker"></mat-datepicker-toggle>
              <mat-datepicker #expenseDatePicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Notas</mat-label>
              <textarea matInput rows="2" [(ngModel)]="newExpense.notes"></textarea>
            </mat-form-field>
          </div>
        </mat-card-content>
        <mat-card-actions>
          <button mat-button (click)="resetForm()">Limpiar</button>
          <button mat-raised-button color="primary" (click)="saveExpense()">
            Guardar Gasto
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Resumen -->
      <mat-card class="summary-card">
        <mat-card-content>
          <div class="summary-grid">
            <div class="summary-item total">
              <span class="label">Total de Gastos</span>
              <span class="value">\${{totalExpenses.toFixed(2)}}</span>
            </div>
            <div class="summary-item">
              <span class="label">Gastos Registrados</span>
              <span class="value">{{filteredExpenses.length}}</span>
            </div>
            <div class="summary-item">
              <span class="label">Usuario Actual</span>
              <span class="value">{{currentUser?.name || 'Sin sesión'}}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Filtros -->
      <mat-card class="filters-card">
        <mat-card-content>
          <div class="filters-row">
            <mat-form-field appearance="outline">
              <mat-label>Inicio</mat-label>
              <input matInput [matDatepicker]="filterStart" [(ngModel)]="startDate" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="filterStart"></mat-datepicker-toggle>
              <mat-datepicker #filterStart></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fin</mat-label>
              <input matInput [matDatepicker]="filterEnd" [(ngModel)]="endDate" (ngModelChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="filterEnd"></mat-datepicker-toggle>
              <mat-datepicker #filterEnd></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Categoría</mat-label>
              <mat-select [(ngModel)]="selectedCategory" (ngModelChange)="applyFilters()">
                <mat-option value="all">Todas</mat-option>
                <mat-option *ngFor="let category of categories" [value]="category">
                  {{category}}
                </mat-option>
              </mat-select>
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Tabla de gastos -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>Gastos del Período</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="table-scroll">
            <table mat-table [dataSource]="filteredExpenses" class="expenses-table">
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
                <td mat-cell *matCellDef="let element" class="amount">\${{element.amount.toFixed(2)}}</td>
              </ng-container>

              <ng-container matColumnDef="notes">
                <th mat-header-cell *matHeaderCellDef>Notas</th>
                <td mat-cell *matCellDef="let element">{{element.notes || '-'}}</td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
            </table>
          </div>

          <div class="empty-state" *ngIf="filteredExpenses.length === 0">
            <mat-icon>receipt</mat-icon>
            <p>No hay gastos en este período</p>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Totales por categoría -->
      <mat-card>
        <mat-card-header>
          <mat-card-title>Totales por Categoría</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="category-grid">
            <div class="category-item" *ngFor="let item of totalsByCategory">
              <span class="category-name">{{item.category}}</span>
              <span class="category-total">\${{item.total.toFixed(2)}}</span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .spacer {
      flex: 1;
    }

    .expenses-container {
      min-height: calc(100vh - 64px);
      background-color: #f5f5f5;
      padding: 20px;
    }

    .form-card, .summary-card, .filters-card {
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

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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

    .summary-item.total {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .summary-item .label {
      font-size: 12px;
      opacity: 0.8;
      text-transform: uppercase;
    }

    .summary-item .value {
      font-size: 20px;
      font-weight: 700;
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

    .expenses-table {
      width: 100%;
      min-width: 760px;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }

    .amount {
      font-weight: 600;
      color: #f44336;
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
    }

    .category-total {
      font-weight: 600;
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
      .expenses-container {
        padding: 12px;
      }

      .filters-row {
        flex-direction: column;
        align-items: stretch;
      }

      .filters-row mat-form-field {
        width: 100%;
      }

      .expenses-table {
        min-width: 680px;
      }
    }
  `]
})
export class ExpensesComponent implements OnInit {
  expenses: Expense[] = [];
  filteredExpenses: Expense[] = [];
  totalsByCategory: CategoryTotal[] = [];

  categories: string[] = [
    'Insumos',
    'Limpieza',
    'Mantenimiento',
    'Servicios',
    'Transporte',
    'Otros'
  ];
  customCategory = '';
  showCustomCategory = false;
  selectedCategory = 'all';

  startDate: Date = startOfDay(new Date());
  endDate: Date = endOfDay(new Date());
  totalExpenses = 0;

  currentUser: User | null = null;

  newExpense: Expense = {
    concept: '',
    amount: 0,
    category: 'Insumos',
    timestamp: new Date(),
    notes: ''
  };
  newExpenseDate: Date = new Date();

  displayedColumns: string[] = ['date', 'concept', 'category', 'user', 'amount', 'notes'];

  constructor(
    private expenseService: ExpenseService,
    private authService: AuthService,
    private cashRegisterService: CashRegisterService,
    private router: Router,
    private uiDialog: UiDialogService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    this.currentUser = this.authService.getCurrentUser();
    await this.loadExpenses();
  }

  async loadExpenses() {
    this.expenses = await this.expenseService.getByDateRange(this.startDate, this.endDate);
    this.applyFilters();
  }

  applyFilters() {
    const start = startOfDay(this.startDate);
    const end = endOfDay(this.endDate);

    this.filteredExpenses = this.expenses.filter(expense => {
      const time = new Date(expense.timestamp).getTime();
      const inRange = time >= start.getTime() && time <= end.getTime();
      const inCategory = this.selectedCategory === 'all' || expense.category === this.selectedCategory;
      return inRange && inCategory;
    });

    this.totalExpenses = this.filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
    this.calculateTotalsByCategory();
  }

  calculateTotalsByCategory() {
    const totals = new Map<string, number>();
    for (const expense of this.filteredExpenses) {
      totals.set(expense.category, (totals.get(expense.category) || 0) + expense.amount);
    }
    this.totalsByCategory = Array.from(totals.entries()).map(([category, total]) => ({
      category,
      total
    }));
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
      this.customCategory = category.trim();
      this.showCustomCategory = true;
      this.newExpense.category = this.customCategory;
    }
  }

  async saveExpense() {
    if (!this.newExpense.concept || this.newExpense.amount <= 0) {
      this.snackBar.open('Completa concepto y monto válido', 'Cerrar', { duration: 3000 });
      return;
    }

    const register = this.cashRegisterService.getCurrentRegister();
    if (!register?.id) {
      this.snackBar.open('No hay caja abierta para registrar gastos', 'Cerrar', { duration: 3000 });
      return;
    }

    const expense: Expense = {
      concept: this.newExpense.concept.trim(),
      description: this.newExpense.concept.trim(),
      amount: this.newExpense.amount,
      category: this.newExpense.category,
      timestamp: this.newExpenseDate || new Date(),
      notes: this.newExpense.notes?.trim() || '',
      userId: this.currentUser?.id,
      userName: this.currentUser?.name,
      cashRegisterId: register.id
    };

    try {
      await this.expenseService.create(expense);
      this.snackBar.open('Gasto registrado', 'Cerrar', { duration: 2000 });
      this.resetForm();
      await this.loadExpenses();
    } catch (error) {
      console.error('Error al guardar gasto:', error);
      this.snackBar.open('Error al guardar gasto', 'Cerrar', { duration: 3000 });
    }
  }

  resetForm() {
    this.newExpense = {
      concept: '',
      amount: 0,
      category: 'Insumos',
      timestamp: new Date(),
      notes: ''
    };
    this.newExpenseDate = new Date();
  }

  setToday() {
    this.startDate = startOfDay(new Date());
    this.endDate = endOfDay(new Date());
    this.applyFilters();
  }

  formatDate(date: Date | string): string {
    return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: es });
  }

  goBack() {
    this.router.navigate(['/pos']);
  }
}

