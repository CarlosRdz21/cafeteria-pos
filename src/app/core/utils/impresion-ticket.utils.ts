export async function imprimirTicketConReintentos(
  intentarImpresion: () => Promise<boolean>,
  confirmarReintento: () => Promise<boolean>
): Promise<boolean> {
  while (true) {
    try {
      if (await intentarImpresion()) return true;
    } catch {
      // Un fallo de impresión no debe revertir ni repetir una venta confirmada.
    }

    if (!(await confirmarReintento())) return false;
  }
}
