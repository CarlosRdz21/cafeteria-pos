import { AfterViewInit, Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: 'input[appBlankZero]',
  standalone: true
})
export class BlankZeroNumberDirective implements AfterViewInit {
  constructor(private elementRef: ElementRef<HTMLInputElement>) {}

  ngAfterViewInit(): void {
    queueMicrotask(() => this.clearDisplayedZero());
  }

  @HostListener('focus')
  onFocus(): void {
    this.clearDisplayedZero();
  }

  private clearDisplayedZero(): void {
    const input = this.elementRef.nativeElement;
    if (input.type !== 'number') return;

    const value = input.value.trim();
    if (value === '0' || value === '0.0' || value === '0.00' || (Number(value) === 0 && /^0+(\.0+)?$/.test(value))) {
      input.value = '';
    }
  }
}
