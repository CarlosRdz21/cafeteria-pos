import { of } from 'rxjs';
import { CashRegisterService } from './cash-register.service';

describe('CashRegisterService', () => {
  it('difiere la consulta inicial para permitir que autenticacion termine de construirse', async () => {
    const http = {
      get: jasmine.createSpy('get').and.returnValue(of(null))
    };

    const service = new CashRegisterService(http as never);

    expect(http.get).not.toHaveBeenCalled();
    await service.ensureInitialized();

    expect(http.get).toHaveBeenCalledTimes(1);
    expect(service.getCurrentRegister()).toBeNull();
  });
});
