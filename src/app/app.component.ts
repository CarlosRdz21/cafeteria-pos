import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SocketService } from './core/services/socket.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
  styles: [`
    :host {
      display: block;
      height: 100%;
      min-height: 100%;
      padding-top: var(--app-safe-top);
      padding-right: var(--app-safe-right);
      padding-bottom: var(--app-safe-bottom);
      padding-left: var(--app-safe-left);
      box-sizing: border-box;
    }
  `]
})
export class AppComponent implements OnInit {
  constructor(
    private socketService: SocketService,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      if (user && !this.socketService.isConnected()) {
        this.socketService.connect();
        return;
      }

      if (!user && this.socketService.isConnected()) {
        this.socketService.disconnect();
      }
    });
  }
}


