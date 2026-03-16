import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { CashRegisterService } from './core/services/cash-register.service';

// Guard para rutas autenticadas
export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  console.log('No autenticado, redirigiendo a login');
  router.navigate(['/login']);
  return false;
};

const getPostLoginUrl = async () => {
  const authService = inject(AuthService);
  const cashRegisterService = inject(CashRegisterService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return router.parseUrl('/pos');
  }

  await cashRegisterService.ensureInitialized();
  return cashRegisterService.isRegisterOpen()
    ? router.parseUrl('/pos')
    : router.parseUrl('/cash-register');
};

// Guard para verificar caja abierta
export const cashRegisterGuard = async () => {
  const authService = inject(AuthService);
  const cashRegisterService = inject(CashRegisterService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  await cashRegisterService.ensureInitialized();

  const isOpen = cashRegisterService.isRegisterOpen();

  if (isOpen) {
    return true;
  }

  console.log('No hay caja abierta, redirigiendo a cash-register');
  return router.parseUrl('/cash-register');
};

export const posAccessGuard = async () => {
  const authService = inject(AuthService);

  if (authService.isAdmin()) {
    return true;
  }

  return cashRegisterGuard();
};

// Guard para admin
export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  console.log('Acceso denegado: se requiere rol admin');
  router.navigate(['/pos']);
  return false;
};

// Guard para admin o barista
export const adminOrBaristaGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasRole('admin', 'barista')) {
    return true;
  }

  console.log('Acceso denegado: se requiere rol admin o barista');
  router.navigate(['/pos']);
  return false;
};

export const loginRedirectGuard = async () => {
  const authService = inject(AuthService);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return getPostLoginUrl();
};

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/pos',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
    canActivate: [loginRedirectGuard]
  },
  {
    path: 'pos',
    loadComponent: () => import('./pages/pos/pos.component').then(m => m.PosComponent),
    canActivate: [authGuard, posAccessGuard]
  },
  {
    path: 'pending-orders',
    loadComponent: () => import('./pages/pending-orders/pending-orders.component').then(m => m.PendingOrdersComponent),
    canActivate: [authGuard]  // Solo requiere autenticación, no caja abierta
  },
  {
    path: 'checkout',
    loadComponent: () => import('./pages/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard, cashRegisterGuard]
  },
  {
    path: 'cash-register',
    loadComponent: () => import('./pages/cash-register/cash-register.component').then(m => m.CashRegisterComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'reports',
    loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'expenses',
    loadComponent: () => import('./pages/expenses/expenses.component').then(m => m.ExpensesComponent),
    canActivate: [authGuard, adminOrBaristaGuard, cashRegisterGuard]
  },
  {
    path: 'admin/products',
    loadComponent: () => import('./pages/admin/products-admin/products-admin.component').then(m => m.ProductsAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/promotions',
    loadComponent: () => import('./pages/admin/promotions-admin/promotions-admin.component').then(m => m.PromotionsAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/supplies',
    loadComponent: () => import('./pages/admin/supplies-admin/supplies-admin.component').then(m => m.SuppliesAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/users',
    loadComponent: () => import('./pages/admin/users-admin/users-admin.component').then(m => m.UsersAdminComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'admin/printer',
    loadComponent: () => import('./pages/admin/printer-settings/printer-settings.component').then(m => m.PrinterSettingsComponent),
    canActivate: [authGuard, adminGuard]
  },
  {
    path: 'inventory-movements',
    loadComponent: () => import('./pages/inventory-movements/inventory-movements.component').then(m => m.InventoryMovementsComponent),
    canActivate: [authGuard, adminOrBaristaGuard]
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'network-test',
    loadComponent: () => import('./pages/network-test/network-test.component').then(m => m.NetworkTestComponent)
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
