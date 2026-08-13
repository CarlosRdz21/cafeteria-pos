import { describe, expect, it } from 'vitest';
import { generarClaveFusionProductoPendiente } from '../src/modules/orders/order.utils';

describe('generarClaveFusionProductoPendiente', () => {
  it('mantiene producto, nombre normalizado y precio con dos decimales', () => {
    expect(generarClaveFusionProductoPendiente({ productId: 12, name: ' Latte ', price: 45 }))
      .toBe('12::Latte::45.00');
  });

  it('distingue variantes del mismo producto cuando cambia el nombre o precio', () => {
    const caliente = generarClaveFusionProductoPendiente({ productId: 12, name: 'Latte caliente', price: 45 });
    const frio = generarClaveFusionProductoPendiente({ productId: 12, name: 'Latte frío', price: 50 });

    expect(caliente).not.toBe(frio);
  });
});
