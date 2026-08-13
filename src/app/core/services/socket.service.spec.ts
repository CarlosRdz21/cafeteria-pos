import { SocketService } from './socket.service';

describe('SocketService - ciclo de vida', () => {
  const authServiceSimulado = {
    token: 'jwt-prueba',
    logout: jasmine.createSpy('logout')
  };

  beforeEach(() => {
    authServiceSimulado.token = 'jwt-prueba';
    authServiceSimulado.logout.calls.reset();
    localStorage.clear();
  });

  it('libera todos los listeners y el socket al desconectar', () => {
    const servicio = new SocketService(authServiceSimulado as never);
    const socketSimulado = {
      connected: true,
      removeAllListeners: jasmine.createSpy('removeAllListeners'),
      disconnect: jasmine.createSpy('disconnect')
    };
    (servicio as unknown as { socket: typeof socketSimulado }).socket = socketSimulado;
    const estados: boolean[] = [];
    servicio.connected$.subscribe(estado => estados.push(estado));

    servicio.disconnect();

    expect(socketSimulado.removeAllListeners).toHaveBeenCalledOnceWith();
    expect(socketSimulado.disconnect).toHaveBeenCalledOnceWith();
    expect(servicio.isConnected()).toBeFalse();
    expect(estados.at(-1)).toBeFalse();
  });

  it('no intenta conectar cuando no existe un JWT valido', () => {
    authServiceSimulado.token = '';
    const servicio = new SocketService(authServiceSimulado as never);

    servicio.connect();

    expect(servicio.isConnected()).toBeFalse();
    expect(authServiceSimulado.logout).not.toHaveBeenCalled();
  });

  it('no reemplaza una conexion que ya esta activa', () => {
    const servicio = new SocketService(authServiceSimulado as never);
    const socketSimulado = {
      connected: true,
      removeAllListeners: jasmine.createSpy('removeAllListeners'),
      disconnect: jasmine.createSpy('disconnect')
    };
    (servicio as unknown as { socket: typeof socketSimulado }).socket = socketSimulado;

    servicio.connect();

    expect(socketSimulado.removeAllListeners).not.toHaveBeenCalled();
    expect(socketSimulado.disconnect).not.toHaveBeenCalled();
  });
});
