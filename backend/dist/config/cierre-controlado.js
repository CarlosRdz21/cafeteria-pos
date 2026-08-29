"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crearManejadorCierreControlado = crearManejadorCierreControlado;
exports.registrarSenalesCierre = registrarSenalesCierre;
function cerrarServidorHttp(servidor) {
    return new Promise((resolve, reject) => {
        try {
            servidor.close(error => {
                if (error)
                    reject(error);
                else
                    resolve();
            });
        }
        catch (error) {
            reject(error);
        }
    });
}
function cerrarServidorSocket(servidor) {
    return new Promise((resolve, reject) => {
        try {
            servidor.close(resolve);
        }
        catch (error) {
            reject(error);
        }
    });
}
/**
 * Coordina un cierre único: deja de aceptar HTTP, cierra Socket.IO, espera las
 * conexiones activas hasta el límite y desconecta Prisma antes de finalizar.
 */
function crearManejadorCierreControlado(dependencias) {
    const tiempoLimiteMs = dependencias.tiempoLimiteMs ?? 10000;
    const finalizarProceso = dependencias.finalizarProceso ?? (codigo => process.exit(codigo));
    const registrarInformacion = dependencias.registrarInformacion ?? console.info;
    const registrarError = dependencias.registrarError ?? console.error;
    let promesaCierre;
    return (senal) => {
        if (promesaCierre)
            return promesaCierre;
        promesaCierre = (async () => {
            let codigoSalida = 0;
            let temporizador;
            registrarInformacion(`[shutdown] signal=${senal}`);
            const cierreHttp = cerrarServidorHttp(dependencias.servidorHttp);
            const cierreSocket = cerrarServidorSocket(dependencias.servidorSocket);
            const limite = new Promise((_resolve, reject) => {
                temporizador = setTimeout(() => {
                    dependencias.servidorHttp.closeAllConnections?.();
                    reject(new Error('Shutdown timeout'));
                }, tiempoLimiteMs);
                temporizador.unref?.();
            });
            try {
                await Promise.race([Promise.all([cierreHttp, cierreSocket]), limite]);
            }
            catch (error) {
                codigoSalida = 1;
                const tipo = error instanceof Error ? error.name : 'UnknownError';
                registrarError(`[shutdown] close_error type=${tipo}`);
            }
            finally {
                if (temporizador)
                    clearTimeout(temporizador);
                try {
                    await dependencias.desconectarPrisma();
                }
                catch (error) {
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
function registrarSenalesCierre(manejarCierre, proceso = process) {
    proceso.once('SIGINT', () => {
        void manejarCierre('SIGINT');
    });
    proceso.once('SIGTERM', () => {
        void manejarCierre('SIGTERM');
    });
}
