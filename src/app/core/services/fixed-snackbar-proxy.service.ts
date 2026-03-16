import { Injectable } from '@angular/core';
import { EMPTY, Observable, of } from 'rxjs';
import { MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';
import { FixedMessageService } from './fixed-message.service';

@Injectable({
  providedIn: 'root'
})
export class FixedSnackbarProxyService {
  constructor(private fixedMessage: FixedMessageService) {}

  open(message: string, _action?: string, _config?: MatSnackBarConfig): MatSnackBarRef<TextOnlySnackBar> {
    this.fixedMessage.show(message);
    return this.buildRef();
  }

  dismiss(): void {
    this.fixedMessage.clear();
  }

  private buildRef(): MatSnackBarRef<TextOnlySnackBar> {
    const afterDismissed = (): Observable<{ dismissedByAction: boolean }> =>
      of({ dismissedByAction: false });
    const onAction = (): Observable<void> => EMPTY;

    return {
      dismiss: () => this.fixedMessage.clear(),
      dismissWithAction: () => this.fixedMessage.clear(),
      afterDismissed,
      onAction
    } as MatSnackBarRef<TextOnlySnackBar>;
  }
}
