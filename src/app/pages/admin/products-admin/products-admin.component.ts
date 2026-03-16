import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
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
import { MatTableModule } from '@angular/material/table';
import { MatDialogModule } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { DrinkBaseType, Product, ProductCategory, ProductServiceTemperature, ProductVariantPricing } from '../../../core/models/domain.models';
import { buildApiUrl } from '../../../core/config/server.config';
import { UiDialogService } from '../../../core/services/ui-dialog.service';

type AdminProductKind = 'drink' | 'food';

@Component({
  selector: 'app-products-admin',
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
    MatSnackBarModule,
    MatTableModule,
    MatDialogModule
  ],
  template: `
    <mat-toolbar color="primary">
      <button mat-icon-button (click)="goBack()">
        <mat-icon>arrow_back</mat-icon>
      </button>
      <span>Administrar Productos</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="addNewProduct()">
        <mat-icon>add</mat-icon>
      </button>
    </mat-toolbar>

    <div class="admin-container">
      <!-- Formulario de edición/creación -->
      <mat-card class="form-card" *ngIf="editingProduct">
        <mat-card-header>
          <mat-card-title>
            {{ editingProduct.id ? 'Editar Producto' : 'Nuevo Producto' }}
          </mat-card-title>
        </mat-card-header>

        <mat-card-content>
          <div class="form-grid">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre</mat-label>
              <input matInput [(ngModel)]="editingProduct.name" required>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Descripción</mat-label>
              <textarea matInput [(ngModel)]="editingProduct.description" rows="2"></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Precio</mat-label>
              <input matInput type="number" [(ngModel)]="editingProduct.price" step="0.01" min="0">
              <span matPrefix>$&nbsp;</span>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Stock</mat-label>
              <input matInput type="number" [(ngModel)]="editingProduct.stock" min="0">
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tipo de producto</mat-label>
              <mat-select
                [ngModel]="getProductKind(editingProduct)"
                (ngModelChange)="onProductKindChange($event)"
              >
                <mat-option value="drink">Bebida</mat-option>
                <mat-option value="food">Alimento</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="drink-base-card full-width" *ngIf="editingProduct && isDrinkProduct(editingProduct)">
              <div class="drink-base-header">
                <h3>Base de bebida</h3>
                <p>Define si esta bebida usa leche o agua para pedir el tipo en caja</p>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Base</mat-label>
                <mat-select
                  [(ngModel)]="editingProduct.drinkBaseType"
                  (selectionChange)="onDrinkBaseTypeChange()"
                >
                  <mat-option value="none">No aplica</mat-option>
                  <mat-option value="milk">Con leche</mat-option>
                  <mat-option value="water">Con agua</mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Temperatura de servicio</mat-label>
                <mat-select
                  [(ngModel)]="editingProduct.serviceTemperature"
                  (selectionChange)="onServiceTemperatureChange()"
                >
                  <mat-option value="default">Caliente y fría</mat-option>
                  <mat-option value="cold-only">Solo fría (16 oz)</mat-option>
                </mat-select>
              </mat-form-field>

              <ng-container *ngIf="editingProduct.drinkBaseType !== 'none'">
                <div class="drink-base-options-header">
                  <span>{{ editingProduct.drinkBaseType === 'milk' ? 'Tipos de leche' : 'Tipos de agua' }}</span>
                  <button mat-stroked-button type="button" (click)="addDrinkBaseOption()">
                    <mat-icon>add</mat-icon>
                    Agregar opción
                  </button>
                </div>

                <div class="drink-base-options" *ngIf="currentDrinkBaseOptions.length > 0; else emptyOptions">
                  <div class="option-row" *ngFor="let option of currentDrinkBaseOptions">
                    <span class="option-name">{{ option }}</span>

                    <mat-form-field appearance="outline" class="option-extra-field">
                      <mat-label>Extra (+)</mat-label>
                      <input
                        matInput
                        type="number"
                        step="0.01"
                        min="0"
                        [ngModel]="getDrinkBaseExtraValue(option)"
                        (ngModelChange)="setDrinkBaseExtraValue(option, $event)"
                      >
                      <span matPrefix>$&nbsp;</span>
                    </mat-form-field>

                    <button
                      mat-icon-button
                      type="button"
                      aria-label="Eliminar opción"
                      (click)="removeDrinkBaseOption(option)"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
                <ng-template #emptyOptions>
                  <p class="empty-options-text">No hay opciones configuradas</p>
                </ng-template>
              </ng-container>
            </div>

            <div class="drink-base-card full-width" *ngIf="editingProduct && isDrinkProduct(editingProduct)">
              <div class="drink-base-header">
                <h3>Sabores adicionales</h3>
                <p>Activa y configura sabores para que se puedan elegir en caja</p>
              </div>

              <mat-slide-toggle
                [(ngModel)]="editingProduct.allowFlavorSelection"
                (change)="onFlavorSelectionToggle()"
              >
                Permitir selección de sabor
              </mat-slide-toggle>

              <ng-container *ngIf="editingProduct.allowFlavorSelection">
                <div class="drink-base-options-header">
                  <span>Sabores</span>
                  <button mat-stroked-button type="button" (click)="addFlavorOption()">
                    <mat-icon>add</mat-icon>
                    Agregar sabor
                  </button>
                </div>

                <div class="drink-base-options" *ngIf="currentFlavorOptions.length > 0; else emptyFlavorOptions">
                  <div class="option-row" *ngFor="let option of currentFlavorOptions">
                    <span class="option-name">{{ option }}</span>

                    <mat-form-field appearance="outline" class="option-extra-field">
                      <mat-label>Extra (+)</mat-label>
                      <input
                        matInput
                        type="number"
                        step="0.01"
                        min="0"
                        [ngModel]="getFlavorExtraValue(option)"
                        (ngModelChange)="setFlavorExtraValue(option, $event)"
                      >
                      <span matPrefix>$&nbsp;</span>
                    </mat-form-field>

                    <button
                      mat-icon-button
                      type="button"
                      aria-label="Eliminar sabor"
                      (click)="removeFlavorOption(option)"
                    >
                      <mat-icon>close</mat-icon>
                    </button>
                  </div>
                </div>
                <ng-template #emptyFlavorOptions>
                  <p class="empty-options-text">No hay sabores configurados</p>
                </ng-template>
              </ng-container>
            </div>

            <div class="variant-pricing-card full-width" *ngIf="editingProduct && isDrinkProduct(editingProduct)">
              <div class="variant-pricing-header">
                <h3>Precios por variante</h3>
                <p *ngIf="editingProduct.serviceTemperature === 'cold-only'">
                  Esta bebida se sirve solo fría; se usa por defecto Frío 16 oz
                </p>
                <p *ngIf="editingProduct.serviceTemperature !== 'cold-only'">
                  Configura incrementos sobre el precio base del producto
                </p>
              </div>

              <div class="variant-pricing-grid" *ngIf="editingProduct.serviceTemperature !== 'cold-only'; else coldOnlyPricing">
                <mat-form-field appearance="outline">
                  <mat-label>Caliente 12 oz (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.hot12OzExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Caliente 16 oz (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.hot16OzExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Frío 16 oz (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.cold16OzExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Flat White 8 oz (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.flatWhite8OzExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Espresso base 3 oz (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.espresso3OzExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Espresso doble (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.espressoDobleExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Espresso cortado (+)</mat-label>
                  <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.espressoCortadoExtra" step="0.01">
                  <span matPrefix>$&nbsp;</span>
                </mat-form-field>
              </div>

              <ng-template #coldOnlyPricing>
                <div class="variant-pricing-grid">
                  <mat-form-field appearance="outline">
                    <mat-label>Frío 16 oz (+)</mat-label>
                    <input matInput type="number" [(ngModel)]="editingProduct.variantPricing!.cold16OzExtra" step="0.01">
                    <span matPrefix>$&nbsp;</span>
                  </mat-form-field>
                </div>
              </ng-template>
            </div>

            <div class="drink-base-card full-width" *ngIf="editingProduct && isFoodProduct(editingProduct)">
              <div class="drink-base-header">
                <h3>Personalización de alimento</h3>
                <p>Configura ingredientes que el cliente puede excluir y extras que sí se cobran</p>
              </div>

              <div class="drink-base-options-header">
                <span>Ingredientes para excluir</span>
                <button mat-stroked-button type="button" (click)="addRemovableIngredient()">
                  <mat-icon>add</mat-icon>
                  Agregar ingrediente
                </button>
              </div>

              <div class="drink-base-options" *ngIf="currentRemovableIngredients.length > 0; else emptyRemovableIngredients">
                <div class="option-row simple" *ngFor="let ingredient of currentRemovableIngredients">
                  <span class="option-name">{{ ingredient }}</span>
                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Eliminar ingrediente"
                    (click)="removeRemovableIngredient(ingredient)"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
              <ng-template #emptyRemovableIngredients>
                <p class="empty-options-text">No hay ingredientes configurados para excluir</p>
              </ng-template>

              <div class="drink-base-options-header">
                <span>Ingredientes extra con costo</span>
                <button mat-stroked-button type="button" (click)="addExtraIngredient()">
                  <mat-icon>add</mat-icon>
                  Agregar extra
                </button>
              </div>

              <div class="drink-base-options" *ngIf="currentExtraIngredients.length > 0; else emptyExtraIngredients">
                <div class="option-row" *ngFor="let ingredient of currentExtraIngredients">
                  <span class="option-name">{{ ingredient }}</span>

                  <mat-form-field appearance="outline" class="option-extra-field">
                    <mat-label>Extra (+)</mat-label>
                    <input
                      matInput
                      type="number"
                      step="0.01"
                      min="0"
                      [ngModel]="getExtraIngredientPrice(ingredient)"
                      (ngModelChange)="setExtraIngredientPrice(ingredient, $event)"
                    >
                    <span matPrefix>$&nbsp;</span>
                  </mat-form-field>

                  <button
                    mat-icon-button
                    type="button"
                    aria-label="Eliminar extra"
                    (click)="removeExtraIngredient(ingredient)"
                  >
                    <mat-icon>close</mat-icon>
                  </button>
                </div>
              </div>
              <ng-template #emptyExtraIngredients>
                <p class="empty-options-text">No hay ingredientes extra configurados</p>
              </ng-template>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Categoria</mat-label>
              <mat-select [(ngModel)]="editingProduct.categoryId">
                <mat-option *ngFor="let category of productCategoryRows" [value]="category.id">{{category.name}}</mat-option>
              </mat-select>
              <button mat-icon-button matSuffix (click)="addCategory()" type="button">
                <mat-icon>add</mat-icon>
              </button>
              <button mat-icon-button matSuffix (click)="renameCategory(getEditingCategoryName())" type="button">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button matSuffix (click)="deleteCategory(getEditingCategoryName())" type="button">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-form-field>

            <div class="image-selector full-width">
              <label class="image-label">Imagen del Producto</label>
              <div class="image-actions">
                <input
                  type="file"
                  #fileInput
                  accept="image/*"
                  (change)="onFileSelected($event)"
                  style="display: none"
                />
                <button mat-raised-button type="button" (click)="fileInput.click()">
                  <mat-icon>image</mat-icon>
                  Seleccionar Imagen
                </button>
                <button mat-raised-button type="button" (click)="openCamera()" color="accent">
                  <mat-icon>camera_alt</mat-icon>
                  Tomar Foto
                </button>
              </div>
              <mat-hint *ngIf="imageFileName">Archivo: {{imageFileName}}</mat-hint>
            </div>

            <div class="toggle-field">
              <mat-slide-toggle [(ngModel)]="editingProduct.available">
                Disponible
              </mat-slide-toggle>
            </div>
          </div>

          <div class="image-preview">
            <button
              *ngIf="canRemoveSelectedImage()"
              mat-icon-button
              type="button"
              class="remove-image-button"
              (click)="clearSelectedImage()"
              aria-label="Quitar imagen"
            >
              <mat-icon>close</mat-icon>
            </button>
            <img [src]="editingProduct.image || defaultProductImage" alt="Preview" (error)="onImageError($event)">
          </div>
        </mat-card-content>

        <mat-card-actions>
          <button mat-button (click)="cancelEdit()">Cancelar</button>
          <button mat-raised-button color="primary" (click)="saveProduct()">
            {{ editingProduct.id ? 'Actualizar' : 'Crear' }}
          </button>
        </mat-card-actions>
      </mat-card>

      <!-- Lista de productos -->
      <div class="products-list">
        <mat-card *ngFor="let product of products" class="product-item">
          <div class="product-content">
            <div class="product-image-small">
              <img [src]="product.image" [alt]="product.name" (error)="onImageError($event)">
            </div>
            <div class="product-info">
              <h3>{{product.name}}</h3>
              <p class="description">{{product.description}}</p>
              <div class="product-details">
                <span class="price">\${{product.price}}</span>
                <span class="category">{{getProductCategoryName(product)}}</span>
                <span class="base-chip food" *ngIf="isFoodProduct(product)">Alimento</span>
                <span class="base-chip" *ngIf="product.drinkBaseType === 'milk'">Con leche</span>
                <span class="base-chip water" *ngIf="product.drinkBaseType === 'water'">Con agua</span>
                <span class="base-chip" *ngIf="product.allowFlavorSelection">Con sabor</span>
                <span class="stock">Stock: {{product.stock}}</span>
                <span class="status" [class.available]="product.available" [class.unavailable]="!product.available">
                  {{product.available ? 'Disponible' : 'No disponible'}}
                </span>
              </div>
            </div>
            <div class="product-actions">
              <button mat-icon-button color="primary" (click)="editProduct(product)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteProduct(product)">
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
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .toggle-field {
      display: flex;
      align-items: center;
      padding: 8px 0;
    }

    .variant-pricing-card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      background: #fafafa;
    }

    .variant-pricing-header h3 {
      margin: 0;
      font-size: 16px;
    }

    .variant-pricing-header p {
      margin: 4px 0 12px 0;
      color: rgba(0,0,0,0.6);
      font-size: 13px;
    }

    .variant-pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }

    .drink-base-card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .drink-base-header h3 {
      margin: 0;
      font-size: 16px;
    }

    .drink-base-header p {
      margin: 4px 0 0 0;
      color: rgba(0,0,0,0.6);
      font-size: 13px;
    }

    .drink-base-options-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      font-weight: 600;
      font-size: 13px;
    }

    .drink-base-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .option-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 180px auto;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
    }

    .option-row.simple {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .option-name {
      font-size: 14px;
      font-weight: 600;
      color: #1b5e20;
    }

    .option-extra-field {
      margin-bottom: -1.25em;
    }

    .empty-options-text {
      margin: 0;
      color: rgba(0,0,0,0.6);
      font-size: 13px;
    }

    .image-selector {
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      background-color: #fafafa;
    }

    .image-label {
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 12px;
      color: rgba(0,0,0,0.87);
    }

    .image-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .image-actions button {
      flex: 1;
      min-width: 150px;
    }

    .image-preview {
      margin-top: 16px;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: fit-content;
      align-self: center;
    }

    .image-preview img {
      display: block;
      max-width: 200px;
      max-height: 200px;
      border-radius: 8px;
      border: 2px solid #e0e0e0;
      object-fit: cover;
    }

    .remove-image-button {
      position: absolute;
      top: -10px;
      right: -10px;
      z-index: 1;
      width: 32px;
      height: 32px;
      min-width: 32px;
      min-height: 32px;
      background: #f44336;
      color: white;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }

    .remove-image-button:hover {
      background: #d32f2f;
    }

    .remove-image-button mat-icon {
      margin: 0;
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }

    mat-card-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px;
      flex-wrap: wrap;
    }

    .products-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .product-item {
      padding: 16px;
    }

    .product-content {
      display: grid;
      grid-template-columns: auto 1fr auto;
      gap: 16px;
      align-items: center;
    }

    .product-image-small {
      width: 80px;
      height: 80px;
      border-radius: 8px;
      overflow: hidden;
      background-color: #f5f5f5;
    }

    .product-image-small img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .product-info h3 {
      margin: 0 0 8px 0;
      font-size: 18px;
    }

    .description {
      margin: 0 0 12px 0;
      color: rgba(0,0,0,0.6);
      font-size: 14px;
    }

    .product-details {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
    }

    .price {
      font-size: 20px;
      font-weight: 600;
      color: #4caf50;
    }

    .category {
      padding: 4px 12px;
      background-color: #e3f2fd;
      color: #1976d2;
      border-radius: 12px;
      font-size: 12px;
    }

    .base-chip {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      background: #e8f5e9;
      color: #2e7d32;
    }

    .base-chip.water {
      background: #e3f2fd;
      color: #1565c0;
    }

    .base-chip.food {
      background: #fff3e0;
      color: #ef6c00;
    }

    .stock {
      font-size: 14px;
      color: rgba(0,0,0,0.6);
    }

    .status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status.available {
      background-color: #c8e6c9;
      color: #2e7d32;
    }

    .status.unavailable {
      background-color: #ffcdd2;
      color: #c62828;
    }

    .product-actions {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    @media (max-width: 768px) {
      .admin-container {
        padding: 12px;
      }

      .product-content {
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .product-actions {
        flex-direction: row;
        justify-content: flex-end;
      }

      .form-grid {
        grid-template-columns: 1fr;
      }

      .image-actions button {
        min-width: 0;
        width: 100%;
      }

      .option-row {
        grid-template-columns: 1fr;
        align-items: stretch;
      }

      mat-card-actions button {
        width: 100%;
      }
    }
  `]
})
export class ProductsAdminComponent implements OnInit {
  readonly defaultProductImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTgiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Qcm9kdWN0bzwvdGV4dD48L3N2Zz4=';
  products: Product[] = [];
  editingProduct: Product | null = null;
  imageFileName: string = '';
  productCategoryRows: ProductCategory[] = [];
  productCategories: string[] = [];
  private readonly defaultVariantPricing: Required<ProductVariantPricing> = {
    hot12OzExtra: 0,
    hot16OzExtra: 10,
    cold16OzExtra: 10,
    flatWhite8OzExtra: 0,
    espresso3OzExtra: 0,
    espressoDobleExtra: 0,
    espressoCortadoExtra: 0
  };
  private readonly defaultMilkOptions = ['Entera', 'Deslactosada', 'Almendra', 'Avena'];
  private readonly defaultWaterOptions = ['Natural', 'Mineral'];
  private readonly defaultFlavorOptions = ['Vainilla', 'Caramelo', 'Avellana', 'Chocolate'];

  constructor(
    private http: HttpClient,
    private router: Router,
    private uiDialog: UiDialogService,
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadProducts();
    await this.loadCategories();
  }

  async loadProducts() {
try {
      const rows = await firstValueFrom(this.http.get<any[]>(buildApiUrl('products')));
      this.products = (rows || []).map(row => this.mapApiProduct(row));
    } catch (error) {
      console.error('Error cargando productos desde API:', error);
      this.products = [];
      this.snackBar.open('No se pudo cargar productos del servidor', 'Cerrar', {
        duration: 3200
      });
    }
  }

  private async loadCategories() {
    const rows = await this.fetchProductCategories();
    this.productCategoryRows = rows;
    const fromCatalog = rows.map(c => c.name);
    const fromProducts = this.products
      .map(p => this.normalizeCategory(p.category))
      .filter((c): c is string => !!c);

    this.productCategories = this.uniqueCategories([
      ...(fromCatalog.length ? fromCatalog : this.productCategories),
      ...fromProducts
    ]);
  }

  private saveCategories() {}

  private normalizeCategory(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const clean = value.trim();
    return clean || null;
  }

  private uniqueCategories(values: string[]): string[] {
    const out: string[] = [];
    for (const value of values) {
      if (!out.some(existing => existing.toLowerCase() === value.toLowerCase())) {
        out.push(value);
      }
    }
    return out;
  }

  addNewProduct() {
    const defaultCategory = this.productCategoryRows[0];
    this.editingProduct = {
      name: '',
      description: '',
      price: 0,
      image: this.defaultProductImage,
      category: defaultCategory?.name || this.productCategories[0] || '',
      categoryId: defaultCategory?.id,
      available: true,
      stock: 0,
      variantPricing: { ...this.defaultVariantPricing },
      drinkBaseType: 'none',
      milkOptions: [],
      waterOptions: [],
      milkOptionExtras: {},
      waterOptionExtras: {},
      allowFlavorSelection: false,
      flavorOptions: [],
      flavorOptionExtras: {},
      serviceTemperature: 'default',
      removableIngredients: [],
      extraIngredients: [],
      extraIngredientPrices: {}
    };
    this.imageFileName = '';
  }

  editProduct(product: Product) {
    const matchedCategory =
      this.productCategoryRows.find(c => c.id === product.categoryId) ||
      this.productCategoryRows.find(c => c.name.toLowerCase() === (product.category || '').toLowerCase());
    this.editingProduct = {
      ...product,
      categoryId: matchedCategory?.id ?? product.categoryId,
      category: matchedCategory?.name ?? product.category,
      variantPricing: this.buildVariantPricing(product.variantPricing),
      drinkBaseType: this.normalizeDrinkBaseType(product.drinkBaseType),
      milkOptions: this.normalizeOptionList(product.milkOptions),
      waterOptions: this.normalizeOptionList(product.waterOptions),
      milkOptionExtras: this.normalizeOptionExtras(product.milkOptionExtras),
      waterOptionExtras: this.normalizeOptionExtras(product.waterOptionExtras),
      allowFlavorSelection: product.allowFlavorSelection === true,
      flavorOptions: this.normalizeOptionList(product.flavorOptions),
      flavorOptionExtras: this.normalizeOptionExtras(product.flavorOptionExtras),
      serviceTemperature: this.normalizeServiceTemperature(product.serviceTemperature),
      removableIngredients: this.normalizeOptionList(product.removableIngredients),
      extraIngredients: this.normalizeOptionList(product.extraIngredients),
      extraIngredientPrices: this.normalizeOptionExtras(product.extraIngredientPrices)
    };
    this.ensureVariantPricingForServiceTemperature(this.editingProduct);
    this.ensureDrinkBaseOptions(this.editingProduct);
    this.ensureFoodCustomizationOptions(this.editingProduct);
    this.imageFileName = '';
  }

  cancelEdit() {
    this.editingProduct = null;
    this.imageFileName = '';
  }

  // Manejar selecciÃ³n de archivo
  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.imageFileName = file.name;

      try {
        const optimizedImage = await this.optimizeImage(file);
        if (this.editingProduct) {
          this.editingProduct.image = optimizedImage;
        }
      } catch (error) {
        console.error('Error al procesar imagen:', error);
        this.snackBar.open('No se pudo procesar la imagen seleccionada', 'Cerrar', {
          duration: 3000
        });
      }
    }
  }

  // Abrir cÃ¡mara para tomar foto
  openCamera() {
    // Crear input temporal para captura de cÃ¡mara
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment'; // Usar cÃ¡mara trasera
    
    input.onchange = async (event: any) => {
      const file = event.target.files[0];
      if (file) {
        this.imageFileName = file.name;

        try {
          const optimizedImage = await this.optimizeImage(file);
          if (this.editingProduct) {
            this.editingProduct.image = optimizedImage;
          }
        } catch (error) {
          console.error('Error al procesar imagen de camara:', error);
          this.snackBar.open('No se pudo procesar la foto capturada', 'Cerrar', {
            duration: 3000
          });
        }
      }
    };
    
    input.click();
  }

  async addCategory() {
    const name = this.normalizeCategory(await this.uiDialog.prompt({
      title: 'Nueva categoría',
      message: 'Nombre de la nueva categoría',
      label: 'Categoría',
      confirmText: 'Agregar',
      required: true
    }));
    if (!name) return;

    if (this.productCategories.some(c => c.toLowerCase() === name.toLowerCase())) {
      this.snackBar.open('Esa categoria ya existe', 'Cerrar', { duration: 2500 });
      return;
    }

    await firstValueFrom(this.http.post(buildApiUrl('product-categories'), { name }));
    await this.loadCategories();
    if (this.editingProduct) {
      const created = this.productCategoryRows.find(c => c.name.toLowerCase() === name.toLowerCase());
      this.editingProduct.category = created?.name || name;
      this.editingProduct.categoryId = created?.id;
    }
    this.snackBar.open('Categoria agregada', 'Cerrar', { duration: 2000 });
  }

  async renameCategory(category: string) {
    const oldName = this.normalizeCategory(category);
    if (!oldName) return;

    const newName = this.normalizeCategory(await this.uiDialog.prompt({
      title: 'Renombrar categoría',
      message: 'Nuevo nombre de la categoría',
      label: 'Categoría',
      initialValue: oldName,
      confirmText: 'Guardar',
      required: true
    }));
    if (!newName || newName.toLowerCase() === oldName.toLowerCase()) return;

    if (this.productCategories.some(c => c.toLowerCase() === newName.toLowerCase())) {
      this.snackBar.open('Ya existe otra categoria con ese nombre', 'Cerrar', { duration: 2500 });
      return;
    }

    const target = this.productCategoryRows.find(c => c.name.toLowerCase() === oldName.toLowerCase());
    if (!target?.id) {
      this.snackBar.open('No se encontró la categoría para renombrar', 'Cerrar', { duration: 2800 });
      return;
    }

    await firstValueFrom(this.http.patch(buildApiUrl('product-categories/' + target.id), { name: newName }));
    await this.loadCategories();

    if (this.editingProduct?.categoryId) {
      const selected = this.productCategoryRows.find(c => c.id === this.editingProduct?.categoryId);
      if (selected) {
        this.editingProduct.category = selected.name;
      }
    } else if (this.editingProduct?.category === oldName) {
      this.editingProduct.category = newName;
    }

    await this.loadProducts();
    this.snackBar.open('Categoria actualizada', 'Cerrar', { duration: 2000 });
  }
  async deleteCategory(category: string) {
    const name = this.normalizeCategory(category);
    if (!name) return;

    const target = this.productCategoryRows.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!target?.id) {
      this.snackBar.open('No se encontró la categoría para eliminar', 'Cerrar', { duration: 2800 });
      return;
    }

    const inUse = this.products.some(product => {
      if (product.categoryId != null) {
        return product.categoryId === target.id;
      }
      return (product.category || '').toLowerCase() === name.toLowerCase();
    });

    if (inUse) {
      this.snackBar.open('No puedes eliminar una categoría con productos asignados', 'Cerrar', {
        duration: 3200
      });
      return;
    }

    const confirmed = await this.uiDialog.confirm({
      title: 'Eliminar categoría',
      message: `¿Eliminar la categoría "${name}"?`,
      confirmText: 'Eliminar'
    });
    if (!confirmed) return;

    try {
      await firstValueFrom(this.http.delete(buildApiUrl('product-categories/' + target.id)));
      await this.loadCategories();

      if (this.editingProduct?.categoryId === target.id) {
        const fallback = this.productCategoryRows[0];
        this.editingProduct.categoryId = fallback?.id;
        this.editingProduct.category = fallback?.name || '';
      }

      this.snackBar.open('Categoria eliminada', 'Cerrar', { duration: 2000 });
    } catch (error) {
      console.error('Error al eliminar categoría:', error);
      this.snackBar.open('No se pudo eliminar la categoría', 'Cerrar', { duration: 3000 });
    }
  }
  async saveProduct() {
    if (!this.editingProduct) return;
    const editingProduct = this.editingProduct;

    const selectedCategory = this.productCategoryRows.find(c => c.id === editingProduct.categoryId);
    if (!editingProduct.name || !selectedCategory || editingProduct.price <= 0) {
      this.snackBar.open('Por favor completa todos los campos', 'Cerrar', {
        duration: 3000
      });
      return;
    }

    editingProduct.category = selectedCategory.name;

    try {
      const productToSave: Product = {
        ...editingProduct,
        variantPricing: this.buildVariantPricing(editingProduct.variantPricing),
        drinkBaseType: this.normalizeDrinkBaseType(editingProduct.drinkBaseType),
        milkOptions: this.normalizeOptionList(editingProduct.milkOptions),
        waterOptions: this.normalizeOptionList(editingProduct.waterOptions),
        milkOptionExtras: this.normalizeOptionExtras(editingProduct.milkOptionExtras),
        waterOptionExtras: this.normalizeOptionExtras(editingProduct.waterOptionExtras),
        allowFlavorSelection: editingProduct.allowFlavorSelection === true,
        flavorOptions: this.normalizeOptionList(editingProduct.flavorOptions),
        flavorOptionExtras: this.normalizeOptionExtras(editingProduct.flavorOptionExtras),
        serviceTemperature: this.normalizeServiceTemperature(editingProduct.serviceTemperature),
        removableIngredients: this.normalizeOptionList(editingProduct.removableIngredients),
        extraIngredients: this.normalizeOptionList(editingProduct.extraIngredients),
        extraIngredientPrices: this.normalizeOptionExtras(editingProduct.extraIngredientPrices)
      };
      this.ensureVariantPricingForServiceTemperature(productToSave);
      this.ensureDrinkBaseOptions(productToSave);
      this.ensureFlavorOptions(productToSave);
      this.ensureFoodCustomizationOptions(productToSave);

      if (editingProduct.id) {
        // Actualizar
        const payload = this.toApiProductPayload(productToSave, selectedCategory.name);
          await firstValueFrom(this.http.put(buildApiUrl('products/' + editingProduct.id), payload));
        this.snackBar.open('Producto actualizado', 'Cerrar', { duration: 2000 });
      } else {
        // Crear
        const payload = this.toApiProductPayload(productToSave, selectedCategory.name);
          await firstValueFrom(this.http.post(buildApiUrl('products'), payload));
        this.snackBar.open('Producto creado', 'Cerrar', { duration: 2000 });
      }

      this.editingProduct = null;
      await this.loadProducts();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      this.snackBar.open('Error al guardar producto', 'Cerrar', { duration: 3000 });
    }
  }

  async deleteProduct(product: Product) {
    if (!product.id) return;

    const confirmed = await this.uiDialog.confirm({
      title: 'Eliminar producto',
      message: `¿Estás seguro de eliminar ${product.name}?`, 
      confirmText: 'Eliminar'
    });
    if (!confirmed) {
      return;
    }

    try {
      await firstValueFrom(this.http.delete(buildApiUrl('products/' + product.id)));
      this.snackBar.open('Producto eliminado', 'Cerrar', { duration: 2000 });
      await this.loadProducts();
    } catch (error) {
      console.error('Error al eliminar producto:', error);
      this.snackBar.open('Error al eliminar producto', 'Cerrar', { duration: 3000 });
    }
  }

  onImageError(event: any) {
    event.target.src = this.defaultProductImage;
  }

  clearSelectedImage() {
    if (!this.editingProduct) return;
    this.editingProduct.image = '';
    this.imageFileName = '';
  }

  canRemoveSelectedImage(): boolean {
    return !!this.editingProduct?.image && this.editingProduct.image !== this.defaultProductImage;
  }

  private async optimizeImage(file: File): Promise<string> {
    const dataUrl = await this.readFileAsDataUrl(file);
    const image = await this.loadImage(dataUrl);
    const maxDimension = 1280;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, width, height);

    const optimized = canvas.toDataURL('image/jpeg', 0.82);
    return optimized.length < dataUrl.length ? optimized : dataUrl;
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo'));
      reader.readAsDataURL(file);
    });
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('No se pudo cargar la imagen seleccionada'));
      image.src = src;
    });
  }

  goBack() {
    this.router.navigate(['/pos']);
  }

  getEditingCategoryName(): string {
    if (!this.editingProduct) return '';
    if (this.editingProduct.categoryId) {
      const found = this.productCategoryRows.find(c => c.id === this.editingProduct?.categoryId);
      if (found) return found.name;
    }
    return this.editingProduct.category || '';
  }

  getProductCategoryName(product: Product): string {
    if (product.categoryId) {
      const found = this.productCategoryRows.find(c => c.id === product.categoryId);
      if (found) return found.name;
    }
    return product.category || 'Sin categoría';
  }

  private buildVariantPricing(input?: ProductVariantPricing): Required<ProductVariantPricing> {
    const merged = {
      ...this.defaultVariantPricing,
      ...(input || {})
    };

    return {
      hot12OzExtra: this.toNumber(merged.hot12OzExtra),
      hot16OzExtra: this.toNumber(merged.hot16OzExtra),
      cold16OzExtra: this.toNumber(merged.cold16OzExtra),
      flatWhite8OzExtra: this.toNumber(merged.flatWhite8OzExtra),
      espresso3OzExtra: this.toNumber(merged.espresso3OzExtra),
      espressoDobleExtra: this.toNumber(merged.espressoDobleExtra),
      espressoCortadoExtra: this.toNumber(merged.espressoCortadoExtra)
    };
  }

  private toNumber(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  get currentDrinkBaseOptions(): string[] {
    if (!this.editingProduct) return [];
    return this.editingProduct.drinkBaseType === 'water'
      ? (this.editingProduct.waterOptions || [])
      : (this.editingProduct.milkOptions || []);
  }

  get currentFlavorOptions(): string[] {
    if (!this.editingProduct) return [];
    return this.editingProduct.flavorOptions || [];
  }

  get currentRemovableIngredients(): string[] {
    if (!this.editingProduct) return [];
    return this.editingProduct.removableIngredients || [];
  }

  get currentExtraIngredients(): string[] {
    if (!this.editingProduct) return [];
    return this.editingProduct.extraIngredients || [];
  }

  getProductKind(product: Product | null | undefined): AdminProductKind {
    return product?.drinkBaseType === 'food' ? 'food' : 'drink';
  }

  isFoodProduct(product: Product | null | undefined): boolean {
    return product?.drinkBaseType === 'food';
  }

  isDrinkProduct(product: Product | null | undefined): boolean {
    return !!product && product.drinkBaseType !== 'food';
  }

  onProductKindChange(kind: AdminProductKind) {
    if (!this.editingProduct) return;

    if (kind === 'food') {
      this.editingProduct.drinkBaseType = 'food' as DrinkBaseType;
      this.editingProduct.serviceTemperature = 'default';
      this.editingProduct.allowFlavorSelection = false;
      this.editingProduct.milkOptions = [];
      this.editingProduct.waterOptions = [];
      this.editingProduct.milkOptionExtras = {};
      this.editingProduct.waterOptionExtras = {};
      this.editingProduct.flavorOptions = [];
      this.editingProduct.flavorOptionExtras = {};
      this.editingProduct.removableIngredients = [];
      this.editingProduct.extraIngredients = [];
      this.editingProduct.extraIngredientPrices = {};
      this.editingProduct.variantPricing = {
        hot12OzExtra: 0,
        hot16OzExtra: 0,
        cold16OzExtra: 0,
        flatWhite8OzExtra: 0,
        espresso3OzExtra: 0,
        espressoDobleExtra: 0,
        espressoCortadoExtra: 0
      };
      return;
    }

    if (this.editingProduct.drinkBaseType === 'food') {
      this.editingProduct.drinkBaseType = 'none';
      this.editingProduct.serviceTemperature = 'default';
      this.editingProduct.variantPricing = { ...this.defaultVariantPricing };
    }

    this.ensureDrinkBaseOptions(this.editingProduct);
    this.ensureFlavorOptions(this.editingProduct);
    this.ensureVariantPricingForServiceTemperature(this.editingProduct);
    this.ensureFoodCustomizationOptions(this.editingProduct);
  }

  onDrinkBaseTypeChange() {
    if (!this.editingProduct) return;
    this.editingProduct.drinkBaseType = this.normalizeDrinkBaseType(this.editingProduct.drinkBaseType);
    this.ensureDrinkBaseOptions(this.editingProduct);
  }

  onServiceTemperatureChange() {
    if (!this.editingProduct) return;
    this.editingProduct.serviceTemperature = this.normalizeServiceTemperature(this.editingProduct.serviceTemperature);
    this.ensureVariantPricingForServiceTemperature(this.editingProduct);
  }

  onFlavorSelectionToggle() {
    if (!this.editingProduct) return;
    this.editingProduct.allowFlavorSelection = this.editingProduct.allowFlavorSelection === true;
    this.ensureFlavorOptions(this.editingProduct);
  }

  async addDrinkBaseOption() {
    if (!this.editingProduct || this.editingProduct.drinkBaseType === 'none') return;

    const label = this.editingProduct.drinkBaseType === 'milk' ? 'tipo de leche' : 'tipo de agua';
    const option = this.normalizeOptionValue(await this.uiDialog.prompt({
      title: 'Nueva opción',
      message: `Escribe el ${label}`,
      label: 'Opción',
      confirmText: 'Agregar',
      required: true
    }));
    if (!option) return;

    const list = this.currentDrinkBaseOptions;
    if (list.some(v => v.toLowerCase() === option.toLowerCase())) {
      this.snackBar.open('Esa opción ya existe', 'Cerrar', { duration: 2200 });
      return;
    }

    list.push(option);
    this.setDrinkBaseExtraValue(option, 0);
  }

  removeDrinkBaseOption(option: string) {
    if (!this.editingProduct || this.editingProduct.drinkBaseType === 'none') return;
    const key = option.toLowerCase();
    if (this.editingProduct.drinkBaseType === 'water') {
      this.editingProduct.waterOptions = (this.editingProduct.waterOptions || []).filter(v => v.toLowerCase() !== key);
      const map = this.editingProduct.waterOptionExtras || {};
      for (const mapKey of Object.keys(map)) {
        if (mapKey.toLowerCase() === key) {
          delete map[mapKey];
        }
      }
    } else {
      this.editingProduct.milkOptions = (this.editingProduct.milkOptions || []).filter(v => v.toLowerCase() !== key);
      const map = this.editingProduct.milkOptionExtras || {};
      for (const mapKey of Object.keys(map)) {
        if (mapKey.toLowerCase() === key) {
          delete map[mapKey];
        }
      }
    }
  }

  getDrinkBaseExtraValue(option: string): number {
    if (!this.editingProduct) return 0;
    const map = this.getCurrentDrinkBaseExtraMap();
    const fromExact = map[option];
    if (typeof fromExact === 'number' && Number.isFinite(fromExact)) {
      return fromExact;
    }
    const entry = Object.entries(map).find(([key]) => key.toLowerCase() === option.toLowerCase());
    if (!entry) return 0;
    return this.toNumber(entry[1]);
  }

  setDrinkBaseExtraValue(option: string, value: unknown): void {
    if (!this.editingProduct || this.editingProduct.drinkBaseType === 'none') return;
    const map = this.getCurrentDrinkBaseExtraMap();
    const normalized = Math.max(0, this.toNumber(value));
    const existingKey = Object.keys(map).find(key => key.toLowerCase() === option.toLowerCase()) || option;
    map[existingKey] = normalized;
  }

  async addFlavorOption() {
    if (!this.editingProduct || this.editingProduct.allowFlavorSelection !== true) return;

    const option = this.normalizeOptionValue(await this.uiDialog.prompt({
      title: 'Nuevo sabor',
      message: 'Escribe el sabor',
      label: 'Sabor',
      confirmText: 'Agregar',
      required: true
    }));
    if (!option) return;

    const list = this.currentFlavorOptions;
    if (list.some(v => v.toLowerCase() === option.toLowerCase())) {
      this.snackBar.open('Ese sabor ya existe', 'Cerrar', { duration: 2200 });
      return;
    }

    list.push(option);
    this.setFlavorExtraValue(option, 0);
  }

  removeFlavorOption(option: string) {
    if (!this.editingProduct || this.editingProduct.allowFlavorSelection !== true) return;
    const key = option.toLowerCase();
    this.editingProduct.flavorOptions = (this.editingProduct.flavorOptions || []).filter(v => v.toLowerCase() !== key);
    const map = this.editingProduct.flavorOptionExtras || {};
    for (const mapKey of Object.keys(map)) {
      if (mapKey.toLowerCase() === key) {
        delete map[mapKey];
      }
    }
  }

  getFlavorExtraValue(option: string): number {
    if (!this.editingProduct) return 0;
    const map = this.getFlavorExtraMap();
    const fromExact = map[option];
    if (typeof fromExact === 'number' && Number.isFinite(fromExact)) return fromExact;
    const entry = Object.entries(map).find(([key]) => key.toLowerCase() === option.toLowerCase());
    if (!entry) return 0;
    return this.toNumber(entry[1]);
  }

  setFlavorExtraValue(option: string, value: unknown): void {
    if (!this.editingProduct || this.editingProduct.allowFlavorSelection !== true) return;
    const map = this.getFlavorExtraMap();
    const normalized = Math.max(0, this.toNumber(value));
    const existingKey = Object.keys(map).find(key => key.toLowerCase() === option.toLowerCase()) || option;
    map[existingKey] = normalized;
  }

  async addRemovableIngredient() {
    if (!this.editingProduct || !this.isFoodProduct(this.editingProduct)) return;

    const ingredient = this.normalizeOptionValue(await this.uiDialog.prompt({
      title: 'Ingrediente excluible',
      message: 'Escribe el ingrediente que el cliente puede pedir sin él',
      label: 'Ingrediente',
      confirmText: 'Agregar',
      required: true
    }));
    if (!ingredient) return;

    if (this.currentRemovableIngredients.some(value => value.toLowerCase() === ingredient.toLowerCase())) {
      this.snackBar.open('Ese ingrediente ya existe', 'Cerrar', { duration: 2200 });
      return;
    }

    this.currentRemovableIngredients.push(ingredient);
  }

  removeRemovableIngredient(ingredient: string) {
    if (!this.editingProduct || !this.isFoodProduct(this.editingProduct)) return;
    const key = ingredient.toLowerCase();
    this.editingProduct.removableIngredients = this.currentRemovableIngredients.filter(value => value.toLowerCase() !== key);
  }

  async addExtraIngredient() {
    if (!this.editingProduct || !this.isFoodProduct(this.editingProduct)) return;

    const ingredient = this.normalizeOptionValue(await this.uiDialog.prompt({
      title: 'Ingrediente extra',
      message: 'Escribe el ingrediente extra que se puede cobrar',
      label: 'Ingrediente',
      confirmText: 'Agregar',
      required: true
    }));
    if (!ingredient) return;

    if (this.currentExtraIngredients.some(value => value.toLowerCase() === ingredient.toLowerCase())) {
      this.snackBar.open('Ese extra ya existe', 'Cerrar', { duration: 2200 });
      return;
    }

    this.currentExtraIngredients.push(ingredient);
    this.setExtraIngredientPrice(ingredient, 0);
  }

  removeExtraIngredient(ingredient: string) {
    if (!this.editingProduct || !this.isFoodProduct(this.editingProduct)) return;
    const key = ingredient.toLowerCase();
    this.editingProduct.extraIngredients = this.currentExtraIngredients.filter(value => value.toLowerCase() !== key);
    const prices = this.getExtraIngredientPriceMap();
    for (const mapKey of Object.keys(prices)) {
      if (mapKey.toLowerCase() === key) {
        delete prices[mapKey];
      }
    }
  }

  getExtraIngredientPrice(ingredient: string): number {
    const prices = this.getExtraIngredientPriceMap();
    const exact = prices[ingredient];
    if (typeof exact === 'number' && Number.isFinite(exact)) return exact;
    const match = Object.entries(prices).find(([key]) => key.toLowerCase() === ingredient.toLowerCase());
    return match ? this.toNumber(match[1]) : 0;
  }

  setExtraIngredientPrice(ingredient: string, value: unknown): void {
    const prices = this.getExtraIngredientPriceMap();
    const normalized = Math.max(0, this.toNumber(value));
    const existingKey = Object.keys(prices).find(key => key.toLowerCase() === ingredient.toLowerCase()) || ingredient;
    prices[existingKey] = normalized;
  }

  private normalizeDrinkBaseType(value: unknown): DrinkBaseType {
    return value === 'milk' || value === 'water' || value === 'food'
      ? (value as DrinkBaseType)
      : 'none';
  }

  private normalizeServiceTemperature(value: unknown): ProductServiceTemperature {
    return value === 'cold-only' ? 'cold-only' : 'default';
  }

  private normalizeOptionList(values: unknown): string[] {
    if (!Array.isArray(values)) return [];
    const out: string[] = [];
    for (const value of values) {
      const normalized = this.normalizeOptionValue(value);
      if (!normalized) continue;
      if (!out.some(v => v.toLowerCase() === normalized.toLowerCase())) {
        out.push(normalized);
      }
    }
    return out;
  }

  private normalizeOptionValue(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  private normalizeOptionExtras(values: unknown): Record<string, number> {
    const out: Record<string, number> = {};
    if (!values || typeof values !== 'object' || Array.isArray(values)) {
      return out;
    }

    for (const [key, raw] of Object.entries(values as Record<string, unknown>)) {
      const normalizedKey = this.normalizeOptionValue(key);
      if (!normalizedKey) continue;
      out[normalizedKey] = Math.max(0, this.toNumber(raw));
    }

    return out;
  }

  private ensureDrinkBaseOptions(product: Product): void {
    const type = this.normalizeDrinkBaseType(product.drinkBaseType);
    product.drinkBaseType = type;
    product.serviceTemperature = this.normalizeServiceTemperature(product.serviceTemperature);

    if (type === 'food') {
      product.milkOptions = [];
      product.waterOptions = [];
      product.milkOptionExtras = {};
      product.waterOptionExtras = {};
      return;
    }

    if (type === 'milk') {
      const normalized = this.normalizeOptionList(product.milkOptions);
      product.milkOptions = normalized.length ? normalized : [...this.defaultMilkOptions];
      product.milkOptionExtras = this.ensureOptionExtrasForList(product.milkOptions, product.milkOptionExtras);
      product.waterOptions = [];
      product.waterOptionExtras = {};
      return;
    }

    if (type === 'water') {
      const normalized = this.normalizeOptionList(product.waterOptions);
      product.waterOptions = normalized.length ? normalized : [...this.defaultWaterOptions];
      product.waterOptionExtras = this.ensureOptionExtrasForList(product.waterOptions, product.waterOptionExtras);
      product.milkOptions = [];
      product.milkOptionExtras = {};
      return;
    }

    product.milkOptions = [];
    product.waterOptions = [];
    product.milkOptionExtras = {};
    product.waterOptionExtras = {};
  }

  private ensureFlavorOptions(product: Product): void {
    if (product.drinkBaseType === 'food') {
      product.allowFlavorSelection = false;
      product.flavorOptions = [];
      product.flavorOptionExtras = {};
      return;
    }

    product.allowFlavorSelection = product.allowFlavorSelection === true;
    if (!product.allowFlavorSelection) {
      product.flavorOptions = [];
      product.flavorOptionExtras = {};
      return;
    }

    const normalized = this.normalizeOptionList(product.flavorOptions);
    product.flavorOptions = normalized.length ? normalized : [...this.defaultFlavorOptions];
    product.flavorOptionExtras = this.ensureOptionExtrasForList(product.flavorOptions, product.flavorOptionExtras);
  }

  private ensureFoodCustomizationOptions(product: Product): void {
    if (product.drinkBaseType !== 'food') {
      product.removableIngredients = [];
      product.extraIngredients = [];
      product.extraIngredientPrices = {};
      return;
    }

    product.removableIngredients = this.normalizeOptionList(product.removableIngredients);
    product.extraIngredients = this.normalizeOptionList(product.extraIngredients);
    product.extraIngredientPrices = this.ensureOptionExtrasForList(
      product.extraIngredients,
      product.extraIngredientPrices
    );
  }

  private ensureVariantPricingForServiceTemperature(product: Product): void {
    product.variantPricing = this.buildVariantPricing(product.variantPricing);
    product.serviceTemperature = this.normalizeServiceTemperature(product.serviceTemperature);

    if (product.drinkBaseType === 'food') {
      product.variantPricing.hot12OzExtra = 0;
      product.variantPricing.hot16OzExtra = 0;
      product.variantPricing.cold16OzExtra = 0;
      product.variantPricing.flatWhite8OzExtra = 0;
      product.variantPricing.espresso3OzExtra = 0;
      product.variantPricing.espressoDobleExtra = 0;
      product.variantPricing.espressoCortadoExtra = 0;
      return;
    }

    if (product.serviceTemperature === 'cold-only') {
      product.variantPricing.hot12OzExtra = 0;
      product.variantPricing.hot16OzExtra = 0;
    }
  }

  private getCurrentDrinkBaseExtraMap(): Record<string, number> {
    if (!this.editingProduct) return {};
    if (this.editingProduct.drinkBaseType === 'water') {
      if (!this.editingProduct.waterOptionExtras) this.editingProduct.waterOptionExtras = {};
      return this.editingProduct.waterOptionExtras;
    }

    if (!this.editingProduct.milkOptionExtras) this.editingProduct.milkOptionExtras = {};
    return this.editingProduct.milkOptionExtras;
  }

  private getFlavorExtraMap(): Record<string, number> {
    if (!this.editingProduct) return {};
    if (!this.editingProduct.flavorOptionExtras) this.editingProduct.flavorOptionExtras = {};
    return this.editingProduct.flavorOptionExtras;
  }

  private getExtraIngredientPriceMap(): Record<string, number> {
    if (!this.editingProduct) return {};
    if (!this.editingProduct.extraIngredientPrices) this.editingProduct.extraIngredientPrices = {};
    return this.editingProduct.extraIngredientPrices;
  }

  private ensureOptionExtrasForList(options: string[], extras?: Record<string, number>): Record<string, number> {
    const normalizedExtras = this.normalizeOptionExtras(extras);
    const out: Record<string, number> = {};
    for (const option of options) {
      const entry = Object.entries(normalizedExtras).find(([key]) => key.toLowerCase() === option.toLowerCase());
      out[option] = entry ? Math.max(0, this.toNumber(entry[1])) : 0;
    }
    return out;
  }
  private async fetchProductCategories(): Promise<ProductCategory[]> {
    

    try {
      const rows = await firstValueFrom(this.http.get<any[]>(buildApiUrl('product-categories')));
      return (rows || []).map(row => this.mapApiCategory(row));
    } catch (error) {
      console.error('Error cargando categorías desde API:', error);
      this.snackBar.open('No se pudo cargar categorías del servidor', 'Cerrar', {
        duration: 3200
      });
      return [];
    }
  }

  private mapApiCategory(row: any): ProductCategory {
    return {
      id: typeof row?.id === 'number' ? row.id : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      active: row?.active !== false,
      sortOrder: Number.isFinite(Number(row?.sortOrder)) ? Number(row.sortOrder) : 0,
      createdAt: row?.createdAt ? new Date(row.createdAt) : new Date()
    };
  }

  private mapApiProduct(row: any): Product {
    return {
      id: typeof row?.id === 'number' ? row.id : undefined,
      name: typeof row?.name === 'string' ? row.name : '',
      description: typeof row?.description === 'string' ? row.description : '',
      price: Number.isFinite(Number(row?.price)) ? Number(row.price) : 0,
      image: typeof row?.image === 'string' ? row.image : '',
      category: typeof row?.categoryName === 'string' ? row.categoryName : '',
      categoryId: Number.isFinite(Number(row?.categoryId)) ? Number(row.categoryId) : undefined,
      available: row?.available !== false,
      stock: row?.stock == null ? undefined : Number(row.stock),
      variantPricing: this.buildVariantPricing(row?.variantPricing),
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

  private toApiProductPayload(product: Product, categoryName: string): Record<string, unknown> {
    return {
      name: product.name,
      description: product.description || '',
      price: this.toNumber(product.price),
      image: product.image || '',
      categoryId: product.categoryId,
      categoryName,
      available: product.available !== false,
      stock: product.stock ?? 0,
      variantPricing: this.buildVariantPricing(product.variantPricing),
      drinkBaseType: this.normalizeDrinkBaseType(product.drinkBaseType),
      milkOptions: this.normalizeOptionList(product.milkOptions),
      waterOptions: this.normalizeOptionList(product.waterOptions),
      milkOptionExtras: this.normalizeOptionExtras(product.milkOptionExtras),
      waterOptionExtras: this.normalizeOptionExtras(product.waterOptionExtras),
      allowFlavorSelection: product.allowFlavorSelection === true,
      flavorOptions: this.normalizeOptionList(product.flavorOptions),
      flavorOptionExtras: this.normalizeOptionExtras(product.flavorOptionExtras),
      serviceTemperature: this.normalizeServiceTemperature(product.serviceTemperature),
      removableIngredients: this.normalizeOptionList(product.removableIngredients),
      extraIngredients: this.normalizeOptionList(product.extraIngredients),
      extraIngredientPrices: this.normalizeOptionExtras(product.extraIngredientPrices)
    };
  }
}









