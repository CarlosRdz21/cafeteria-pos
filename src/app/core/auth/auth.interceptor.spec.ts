import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let httpTesting: HttpTestingController;
  const authServiceSimulado = {
    token: 'jwt-prueba',
    logout: jasmine.createSpy('logout')
  };

  beforeEach(() => {
    authServiceSimulado.token = 'jwt-prueba';
    authServiceSimulado.logout.calls.reset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSimulado }
      ]
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('agrega el JWT a las solicitudes autenticadas', () => {
    const http = TestBed.inject(HttpTestingController);
    const cliente = TestBed.inject(HttpClient);

    cliente.get('/api/orders').subscribe();

    const solicitud = http.expectOne('/api/orders');
    expect(solicitud.request.headers.get('Authorization')).toBe('Bearer jwt-prueba');
    solicitud.flush([]);
  });

  it('elimina la sesion ante un 401 fuera del login', () => {
    const cliente = TestBed.inject(HttpClient);

    cliente.get('/api/orders').subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/orders').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSimulado.logout).toHaveBeenCalledOnceWith();
  });

  it('no elimina la sesion por un 401 del propio login', () => {
    const cliente = TestBed.inject(HttpClient);

    cliente.post('/api/auth/login', {}).subscribe({ error: () => undefined });
    httpTesting.expectOne('/api/auth/login').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSimulado.logout).not.toHaveBeenCalled();
  });
});
