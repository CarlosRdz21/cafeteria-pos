import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { SocketService } from './core/services/socket.service';
import { AuthService, User } from './core/auth/auth.service';

interface ElementoNavegacion {
  etiqueta: string;
  icono: string;
  ruta: string;
  roles?: User['role'][];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MatIconModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit, OnDestroy {
  private readonly subscriptions = new Subscription();
  private relojId?: number;

  usuarioActual: User | null = null;
  estaConectado = false;
  menuMovilAbierto = false;
  fechaActual = new Date();
  tituloActual = 'Punto de venta';

  readonly elementosNavegacion: ElementoNavegacion[] = [
    { etiqueta: 'Punto de venta', icono: 'storefront', ruta: '/pos' },
    { etiqueta: 'Comandas', icono: 'receipt_long', ruta: '/pending-orders' },
    { etiqueta: 'Caja', icono: 'point_of_sale', ruta: '/cash-register', roles: ['admin', 'barista'] },
    { etiqueta: 'Reportes', icono: 'monitoring', ruta: '/reports', roles: ['admin', 'barista'] },
    { etiqueta: 'Gastos', icono: 'receipt', ruta: '/expenses', roles: ['admin', 'barista'] },
    { etiqueta: 'Insumos', icono: 'inventory_2', ruta: '/admin/supplies', roles: ['admin'] },
    { etiqueta: 'Movimientos', icono: 'swap_vert', ruta: '/inventory-movements', roles: ['admin', 'barista'] },
    { etiqueta: 'Productos', icono: 'coffee', ruta: '/admin/products', roles: ['admin'] },
    { etiqueta: 'Promociones', icono: 'local_offer', ruta: '/admin/promotions', roles: ['admin'] },
    { etiqueta: 'Usuarios', icono: 'group', ruta: '/admin/users', roles: ['admin'] },
    { etiqueta: 'Impresora', icono: 'print', ruta: '/admin/printer', roles: ['admin', 'barista'] },
    { etiqueta: 'Configuración', icono: 'settings', ruta: '/settings' }
  ];
  private readonly onDocumentFocusIn = (event: Event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && !target.hasAttribute('enterkeyhint')) {
      target.setAttribute('enterkeyhint', 'done');
    }
  };

  private readonly onDocumentKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target instanceof HTMLTextAreaElement) {
      return;
    }

    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    event.preventDefault();
    target.blur();
  };

  constructor(
    private socketService: SocketService,
    private authService: AuthService,
    private router: Router,
    @Inject(DOCUMENT) private document: Document
  ) {}

  async ngOnInit() {
    this.document.addEventListener('focusin', this.onDocumentFocusIn);
    this.document.addEventListener('keydown', this.onDocumentKeyDown);

    this.subscriptions.add(
      this.authService.usuarioActual$.subscribe(usuario => {
        this.usuarioActual = usuario;
        if (usuario && !this.socketService.isConnected()) {
          this.socketService.connect();
        }

        if (!usuario && this.socketService.isConnected()) {
          this.socketService.disconnect();
        }

        if (!usuario) this.menuMovilAbierto = false;
      })
    );

    this.subscriptions.add(
      this.socketService.connected$.subscribe(estaConectado => {
        this.estaConectado = estaConectado;
      })
    );

    this.subscriptions.add(
      this.router.events
        .pipe(filter(evento => evento instanceof NavigationEnd))
        .subscribe(() => {
          this.tituloActual = this.obtenerTituloRuta(this.router.url);
          this.menuMovilAbierto = false;
        })
    );

    this.tituloActual = this.obtenerTituloRuta(this.router.url);
    this.relojId = window.setInterval(() => this.fechaActual = new Date(), 60_000);
  }

  puedeVer(elemento: ElementoNavegacion): boolean {
    return !elemento.roles || (!!this.usuarioActual && elemento.roles.includes(this.usuarioActual.role));
  }

  alternarMenuMovil(): void {
    this.menuMovilAbierto = !this.menuMovilAbierto;
  }

  cerrarMenuMovil(): void {
    this.menuMovilAbierto = false;
  }

  verEstadoConexion(): void {
    void this.router.navigate(['/settings']);
  }

  cerrarSesion(): void {
    this.authService.logout();
    void this.router.navigate(['/login']);
  }

  nombreRol(rol: User['role']): string {
    const nombres: Record<User['role'], string> = {
      admin: 'Administrador',
      barista: 'Barista',
      mesero: 'Mesero',
      waiter: 'Mesero'
    };
    return nombres[rol];
  }

  inicialesUsuario(nombre: string): string {
    return nombre.trim().split(/\s+/).slice(0, 2)
      .map(parte => parte.charAt(0).toUpperCase()).join('') || 'DA';
  }

  private obtenerTituloRuta(ruta: string): string {
    return this.elementosNavegacion.find(elemento => ruta.startsWith(elemento.ruta))?.etiqueta
      ?? 'Dulce Aroma Café';
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
    if (this.relojId !== undefined) window.clearInterval(this.relojId);
    this.document.removeEventListener('focusin', this.onDocumentFocusIn);
    this.document.removeEventListener('keydown', this.onDocumentKeyDown);
  }
}


