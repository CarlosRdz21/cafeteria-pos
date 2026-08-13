import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  crearManejadorCierreControlado,
  registrarSenalesCierre,
} from '../src/config/cierre-controlado';

function crearDependencias() {
  const servidorHttp = {
    close: vi.fn((callback: (error?: Error) => void) => callback()),
    closeAllConnections: vi.fn(),
  };
  const servidorSocket = {
    close: vi.fn((callback: () => void) => callback()),
  };
  const desconectarPrisma = vi.fn().mockResolvedValue(undefined);
  const finalizarProceso = vi.fn();
  const registrarInformacion = vi.fn();
  const registrarError = vi.fn();

  return {
    servidorHttp,
    servidorSocket,
    desconectarPrisma,
    finalizarProceso,
    registrarInformacion,
    registrarError,
  };
}

describe('cierre controlado del backend', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['SIGINT', 'SIGTERM'] as const)(
    'registra y procesa %s sin afectar al proceso de pruebas',
    async senal => {
      const dependencias = crearDependencias();
      const manejarCierre = crearManejadorCierreControlado(dependencias);
      const listeners = new Map<string, () => void>();
      const proceso = {
        once: vi.fn((evento: string, listener: () => void) => {
          listeners.set(evento, listener);
        }),
      };

      registrarSenalesCierre(manejarCierre, proceso);
      listeners.get(senal)?.();
      await manejarCierre(senal);

      expect(proceso.once).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(proceso.once).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(dependencias.servidorHttp.close).toHaveBeenCalledOnce();
      expect(dependencias.servidorSocket.close).toHaveBeenCalledOnce();
      expect(dependencias.desconectarPrisma).toHaveBeenCalledOnce();
      expect(dependencias.finalizarProceso).toHaveBeenCalledWith(0);
    },
  );

  it('es idempotente ante señales repetidas', async () => {
    const dependencias = crearDependencias();
    const manejarCierre = crearManejadorCierreControlado(dependencias);

    const primera = manejarCierre('SIGTERM');
    const segunda = manejarCierre('SIGINT');
    await Promise.all([primera, segunda]);

    expect(segunda).toBe(primera);
    expect(dependencias.servidorHttp.close).toHaveBeenCalledOnce();
    expect(dependencias.servidorSocket.close).toHaveBeenCalledOnce();
    expect(dependencias.desconectarPrisma).toHaveBeenCalledOnce();
    expect(dependencias.finalizarProceso).toHaveBeenCalledOnce();
  });

  it('desconecta Prisma y finaliza con error si falla un cierre', async () => {
    const dependencias = crearDependencias();
    dependencias.servidorHttp.close.mockImplementation(callback => {
      callback(new Error('fallo HTTP'));
    });
    const manejarCierre = crearManejadorCierreControlado(dependencias);

    await manejarCierre('SIGTERM');

    expect(dependencias.servidorSocket.close).toHaveBeenCalledOnce();
    expect(dependencias.desconectarPrisma).toHaveBeenCalledOnce();
    expect(dependencias.registrarError).toHaveBeenCalledWith(
      '[shutdown] close_error type=Error',
    );
    expect(dependencias.finalizarProceso).toHaveBeenCalledWith(1);
  });

  it('fuerza el cierre de conexiones al vencer el tiempo límite', async () => {
    vi.useFakeTimers();
    const dependencias = crearDependencias();
    dependencias.servidorHttp.close.mockImplementation(() => undefined);
    dependencias.servidorSocket.close.mockImplementation(() => undefined);
    const manejarCierre = crearManejadorCierreControlado({
      ...dependencias,
      tiempoLimiteMs: 1_000,
    });

    const cierre = manejarCierre('SIGTERM');
    await vi.advanceTimersByTimeAsync(1_000);
    await cierre;

    expect(dependencias.servidorHttp.closeAllConnections).toHaveBeenCalledOnce();
    expect(dependencias.desconectarPrisma).toHaveBeenCalledOnce();
    expect(dependencias.finalizarProceso).toHaveBeenCalledWith(1);
  });
});
