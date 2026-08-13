type SenalCierre = 'SIGINT' | 'SIGTERM';

interface ServidorHttpCerrable {
  close: (callback: (error?: Error) => void) => unknown;
  closeAllConnections?: () => void;
}

interface ServidorSocketCerrable {
  close: (callback: () => void) => unknown;
}

interface ProcesoConSenales {
  once: (senal: SenalCierre, listener: () => void) => unknown;
}

interface DependenciasCierre {
  servidorHttp: ServidorHttpCerrable;
  servidorSocket: ServidorSocketCerrable;
  desconectarPrisma: () => Promise<unknown>;
  finalizarProceso?: (codigo: number) => void;
  registrarInformacion?: (mensaje: string) => void;
  registrarError?: (mensaje: string) => void;
  tiempoLimiteMs?: number;
}

function cerrarServidorHttp(servidor: ServidorHttpCerrable): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      servidor.close(error => {
        if (error) reject(error);
        else resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
}

function cerrarServidorSocket(servidor: ServidorSocketCerrable): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      servidor.close(resolve);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Coordina un cierre único: deja de aceptar HTTP, cierra Socket.IO, espera las
 * conexiones activas hasta el límite y desconecta Prisma antes de finalizar.
 */
export function crearManejadorCierreControlado(dependencias: DependenciasCierre) {
  const tiempoLimiteMs = dependencias.tiempoLimiteMs ?? 10_000;
  const finalizarProceso = dependencias.finalizarProceso ?? (codigo => process.exit(codigo));
  const registrarInformacion = dependencias.registrarInformacion ?? console.info;
  const registrarError = dependencias.registrarError ?? console.error;
  let promesaCierre: Promise<void> | undefined;

  return (senal: SenalCierre): Promise<void> => {
    if (promesaCierre) return promesaCierre;

    promesaCierre = (async () => {
      let codigoSalida = 0;
      let temporizador: NodeJS.Timeout | undefined;

      registrarInformacion(`[shutdown] signal=${senal}`);
      const cierreHttp = cerrarServidorHttp(dependencias.servidorHttp);
      const cierreSocket = cerrarServidorSocket(dependencias.servidorSocket);
      const limite = new Promise<never>((_resolve, reject) => {
        temporizador = setTimeout(() => {
          dependencias.servidorHttp.closeAllConnections?.();
          reject(new Error('Shutdown timeout'));
        }, tiempoLimiteMs);
        temporizador.unref?.();
      });

      try {
        await Promise.race([Promise.all([cierreHttp, cierreSocket]), limite]);
      } catch (error) {
        codigoSalida = 1;
        const tipo = error instanceof Error ? error.name : 'UnknownError';
        registrarError(`[shutdown] close_error type=${tipo}`);
      } finally {
        if (temporizador) clearTimeout(temporizador);
        try {
          await dependencias.desconectarPrisma();
        } catch (error) {
          codigoSalida = 1;
          const tipo = error instanceof Error ? error.name : 'UnknownError';
          registrarError(`[shutdown] prisma_error type=${tipo}`);
        }
        finalizarProceso(codigoSalida);
      }
    })();

    return promesaCierre;
  };
}

export function registrarSenalesCierre(
  manejarCierre: (senal: SenalCierre) => Promise<void>,
  proceso: ProcesoConSenales = process,
): void {
  proceso.once('SIGINT', () => {
    void manejarCierre('SIGINT');
  });
  proceso.once('SIGTERM', () => {
    void manejarCierre('SIGTERM');
  });
}
