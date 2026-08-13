import { BehaviorSubject } from 'rxjs';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent - liberacion de recursos', () => {
  const crearDependencias = () => {
    const conexion$ = new BehaviorSubject(false);
    const socketService = {
      connected$: conexion$.asObservable(),
      setServerUrl: jasmine.createSpy('setServerUrl'),
      connect: jasmine.createSpy('connect'),
      disconnect: jasmine.createSpy('disconnect'),
      isConnected: jasmine.createSpy('isConnected').and.returnValue(false)
    };
    const router = { navigate: jasmine.createSpy('navigate') };
    const snackBar = { open: jasmine.createSpy('open') };

    return { conexion$, socketService, router, snackBar };
  };

  afterEach(() => localStorage.clear());

  it('deja de procesar cambios de conexion al destruirse', () => {
    const dependencias = crearDependencias();
    const componente = new SettingsComponent(
      dependencias.socketService as never,
      dependencias.router as never,
      dependencias.snackBar as never
    );

    componente.ngOnInit();
    dependencias.conexion$.next(true);
    componente.ngOnDestroy();
    dependencias.conexion$.next(false);

    expect(componente.isConnected).toBeTrue();
  });

  it('cancela la comprobacion pendiente de conexion al destruirse', () => {
    jasmine.clock().install();
    try {
      const dependencias = crearDependencias();
      const componente = new SettingsComponent(
        dependencias.socketService as never,
        dependencias.router as never,
        dependencias.snackBar as never
      );

      componente.connect();
      componente.ngOnDestroy();
      jasmine.clock().tick(5001);

      expect(componente.connectionError).toBe('');
      expect(dependencias.snackBar.open).toHaveBeenCalledTimes(1);
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
