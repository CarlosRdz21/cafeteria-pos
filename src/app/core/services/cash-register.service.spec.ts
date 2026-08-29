import { of } from 'rxjs';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  it('no consulta la caja hasta que una ruta autenticada solicita inicializarla', async () => {
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of(null))
    };

    const service = new CashRegisterService(http as never);
    await Promise.resolve();

    expect(http.get).not.toHaveBeenCalled();
    await service.ensureInitialized();
    await service.ensureInitialized();

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(service.getCurrentRegister()).toBeNull();
  });

  it('considera inicializada la caja cuando se actualiza despues del login', async () => {
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of(null))
    };

    const service = new CashRegisterService(http as never);

    await service.refreshCurrentRegister();
    await service.ensureInitialized();

    expect(http.get).toHaveBeenCalledTimes(1);
  });
});
