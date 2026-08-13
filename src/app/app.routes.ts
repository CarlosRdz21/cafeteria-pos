import { Routes } from '@angular/router';
import {
  adminGuard,
  adminOrBaristaGuard,
  authGuard,
  cashRegisterGuard,
  loginRedirectGuard,
  posAccessGuard
} from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/pos',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginRedirectGuard]
  },
  {
    path: 'pos',
    loadComponent: () => import('./features/pos/pos.component').then(m => m.PosComponent),
    canActivate: [authGuard, posAccessGuard]
  },
  {
    path: 'pending-orders',
    loadComponent: () => import('./features/orders/pending-orders/pending-orders.component').then(m => m.PendingOrdersComponent),
    canActivate: [authGuard]  // Solo requiere autenticación, no caja abierta
  },
  {
    path: 'checkout',
    loadComponent: () => import('./features/orders/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard, cashRegisterGuard]
  },
  {
    path: 'cash-register',
    loadComponent: () => import('./features/cash/cash-register/cash-register.component').then(m => m.CashRegisterComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'reports',
    loadComponent: () => import('./features/reports/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./features/expenses/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'admin/products',
    loadComponent: () => import('./features/products/products-admin/products-admin.component').then(m => m.ProductsAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/promotions',
    loadComponent: () => import('./features/promotions/promotions-admin/promotions-admin.component').then(m => m.PromotionsAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/supplies',
    loadComponent: () => import('./features/inventory/supplies-admin/supplies-admin.component').then(m => m.SuppliesAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./features/users/users-admin/users-admin.component').then(m => m.UsersAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/printer',
    loadComponent: () => import('./features/settings/printer-settings/printer-settings.component').then(m => m.PrinterSettingsComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'inventory-movements',
    loadComponent: () => import('./features/inventory/inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./features/settings/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'network-test',
    loadComponent: () => import('./features/settings/network-test/network-test.component').then(m => m.NetworkTestComponent)
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
