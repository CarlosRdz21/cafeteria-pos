"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generarClaveFusionProductoPendiente = generarClaveFusionProductoPendiente;
/**
 * Genera la identidad usada al fusionar productos de una comanda pendiente.
 * El nombre y el precio forman parte de la clave porque representan variantes
 * que no deben acumularse aunque compartan el mismo producto base.
 */
function generarClaveFusionProductoPendiente(producto) {
    const idProducto = Number(producto.productId || 0);
    const nombre = String(producto.name || '').trim();
    const precio = Number(producto.price || 0).toFixed(2);
    return `${idProducto}::${nombre}::${precio}`;
}
