import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FixedMessageService {
  private readonly messageSubject = new BehaviorSubject<string>('');
  readonly message$ = this.messageSubject.asObservable();

  show(message: string): void {
    this.messageSubject.next((message || '').trim());
  }

  clear(): void {
    this.messageSubject.next('');
  }
}
