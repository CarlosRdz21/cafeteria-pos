import { DOCUMENT } from '@angular/common';
import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
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
export class AppComponent implements OnInit, OnDestroy {
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
    @Inject(DOCUMENT) private document: Document
  ) {}

  async ngOnInit() {
    this.document.addEventListener('focusin', this.onDocumentFocusIn);
    this.document.addEventListener('keydown', this.onDocumentKeyDown);

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

  ngOnDestroy() {
    this.document.removeEventListener('focusin', this.onDocumentFocusIn);
    this.document.removeEventListener('keydown', this.onDocumentKeyDown);
  }
}


