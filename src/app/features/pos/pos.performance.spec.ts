import { Product } from '../../shared/models/domain.models';
import { PosComponent } from './pos.component';

describe('PosComponent - filtrado por eventos', () => {
  function crearComponente(): PosComponent {
    const componente = Object.create(PosComponent.prototype) as PosComponent;
    Object.assign(componente, {
      products: [
        { id: 1, name: 'Café americano', description: 'Caliente', price: 40, image: '', category: 'Bebidas', available: true },
        { id: 2, name: 'Croissant', description: 'Pan dulce', price: 35, image: '', category: 'Alimentos', available: true }
      ] satisfies Product[],
      filteredProducts: [],
      selectedCategory: 'all',
      searchTerm: '',
      productCategoryById: new Map<number, string>()
    });
    return componente;
  }

  it('actualiza el resultado al cambiar la categoría sin depender de sondeo periódico', () => {
    const componente = crearComponente();

    componente.selectedCategory = 'Bebidas';
    componente.filterProducts();

    expect(componente.filteredProducts.map(producto => producto.id)).toEqual([1]);
  });

  it('actualiza el resultado al cambiar el término de búsqueda', () => {
    const componente = crearComponente();

    componente.searchTerm = 'croissant';
    componente.filterProducts();

    expect(componente.filteredProducts.map(producto => producto.id)).toEqual([2]);
  });
});
