import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CashRegisterService } from '../services/cash-register.service';

/** Impide cargar rutas privadas cuando la sesión ya no tiene un JWT vigente. */
export const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

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

/** Exige una caja abierta a los roles operativos; administración puede supervisar sin abrirla. */
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

  return router.parseUrl('/cash-register');
};

export const posAccessGuard = async () => {
  const authService = inject(AuthService);

  if (authService.isAdmin()) {
    return true;
  }

  return cashRegisterGuard();
};

/** Restringe funcionalidades administrativas aunque se intente navegar mediante una URL directa. */
export const adminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAdmin()) {
    return true;
  }

  router.navigate(['/pos']);
  return false;
};

/** Permite vistas de preparación únicamente a administración y baristas. */
export const adminOrBaristaGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.hasRole('admin', 'barista')) {
    return true;
  }

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
