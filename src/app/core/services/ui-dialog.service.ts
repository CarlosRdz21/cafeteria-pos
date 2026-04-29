import { Component, Injectable, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export type ConfirmDialogOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

export type PromptDialogOptions = {
  title?: string;
  message?: string;
  label?: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
  rows?: number;
  inputType?: 'text' | 'number';
  extraActionText?: string;
  extraActionValue?: string;
};

export type PromptDialogResult = {
  confirmed: boolean;
  value: string | null;
  action?: 'confirm' | 'cancel' | 'extra';
};

@Injectable({ providedIn: 'root' })
export class UiDialogService {
  constructor(private dialog: MatDialog) {}

  async confirm(options: ConfirmDialogOptions): Promise<boolean> {
    const dialogRef = this.dialog.open(AppConfirmDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      data: options
    });

    return (await firstValueFrom(dialogRef.afterClosed())) === true;
  }

  async prompt(options: PromptDialogOptions): Promise<string | null> {
    const result = await this.promptWithResult(options);
    return result.confirmed ? result.value : null;
  }

  async promptWithResult(options: PromptDialogOptions): Promise<PromptDialogResult> {
    const dialogRef = this.dialog.open(AppPromptDialogComponent, {
      width: '440px',
      maxWidth: '95vw',
      autoFocus: false,
      restoreFocus: false,
      data: options
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    if (result && typeof result === 'object' && 'action' in result) {
      return result as PromptDialogResult;
    }

    if (typeof result === 'string') {
      return { confirmed: true, value: result, action: 'confirm' };
    }

    return { confirmed: false, value: null, action: 'cancel' };
  }
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Confirmar' }}</h2>
    <mat-dialog-content>
      <p class="message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="close(false)">{{ data.cancelText || 'Cancelar' }}</button>
      <button mat-raised-button color="primary" (click)="close(true)">{{ data.confirmText || 'Aceptar' }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .message {
      margin: 0;
      white-space: pre-line;
      color: rgba(0, 0, 0, 0.75);
    }
  `]
})
export class AppConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogOptions,
    private dialogRef: MatDialogRef<AppConfirmDialogComponent, boolean>
  ) {}

  close(value: boolean) {
    this.dialogRef.close(value);
  }
}

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <h2 mat-dialog-title>{{ data.title || 'Captura de dato' }}</h2>
    <mat-dialog-content class="content">
      <p class="message" *ngIf="data.message">{{ data.message }}</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>{{ data.label || 'Valor' }}</mat-label>
        <textarea
          *ngIf="(data.rows || 1) > 1; else inputTemplate"
          matInput
          [rows]="data.rows || 2"
          [(ngModel)]="value"
          [placeholder]="data.placeholder || ''"
        ></textarea>
        <ng-template #inputTemplate>
          <input
            matInput
            [type]="data.inputType || 'text'"
            [(ngModel)]="value"
            [placeholder]="data.placeholder || ''"
            [attr.inputmode]="data.inputType === 'number' ? 'numeric' : null"
          />
        </ng-template>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cancel()">{{ data.cancelText || 'Cancelar' }}</button>
      <button mat-stroked-button *ngIf="data.extraActionText" (click)="extraAction()">
        {{ data.extraActionText }}
      </button>
      <button mat-raised-button color="primary" (click)="confirm()" [disabled]="isInvalid()">
        {{ data.confirmText || 'Aceptar' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .content {
      min-width: 320px;
    }

    .full-width {
      width: 100%;
    }

    .message {
      margin: 0 0 12px 0;
      white-space: pre-line;
      color: rgba(0, 0, 0, 0.75);
    }
  `]
})
export class AppPromptDialogComponent {
  value = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: PromptDialogOptions,
    private dialogRef: MatDialogRef<AppPromptDialogComponent, PromptDialogResult | string | null>
  ) {
    this.value = data.initialValue ?? '';
  }

  isInvalid(): boolean {
    return !!this.data.required && !this.value.trim();
  }

  private normalizeValue(): string {
    if (this.data.inputType === 'number') {
      return this.value.replace(/[^\d]/g, '').trim();
    }
    return this.value.trim();
  }

  cancel() {
    this.dialogRef.close({ confirmed: false, value: null, action: 'cancel' });
  }

  extraAction() {
    this.dialogRef.close({
      confirmed: true,
      value: this.data.extraActionValue ?? this.normalizeValue(),
      action: 'extra'
    });
  }

  confirm() {
    this.dialogRef.close({
      confirmed: true,
      value: this.normalizeValue(),
      action: 'confirm'
    });
  }
}
