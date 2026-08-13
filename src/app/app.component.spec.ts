import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AppComponent } from './app.component';
import { AuthService, User } from './core/auth/auth.service';
import { SocketService } from './core/services/socket.service';

describe('AppComponent', () => {
  let usuarioActual$: BehaviorSubject<User | null>;
  let socketService: jasmine.SpyObj<SocketService>;

  beforeEach(async () => {
    usuarioActual$ = new BehaviorSubject<User | null>(null);
    socketService = jasmine.createSpyObj<SocketService>('SocketService', [
      'connect',
      'disconnect',
      'isConnected',
    ]);
    socketService.isConnected.and.returnValue(false);
    Object.defineProperty(socketService, 'connected$', {
      value: new BehaviorSubject(false).asObservable(),
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            usuarioActual$: usuarioActual$.asObservable(),
            logout: jasmine.createSpy('logout'),
          },
        },
        { provide: SocketService, useValue: socketService },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the application router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).not.toBeNull();
  });

  it('should connect the socket when a user authenticates', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    usuarioActual$.next({ id: 1, name: 'Administrador', role: 'admin' });

    expect(socketService.connect).toHaveBeenCalled();
  });

  it('should disconnect the socket when there is no authenticated user', () => {
    socketService.isConnected.and.returnValue(true);
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(socketService.disconnect).toHaveBeenCalled();
  });

  it('should stop reacting to session changes after destruction', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    socketService.connect.calls.reset();

    fixture.destroy();
    usuarioActual$.next({ id: 1, name: 'Administrador', role: 'admin' });

    expect(socketService.connect).not.toHaveBeenCalled();
  });
});
