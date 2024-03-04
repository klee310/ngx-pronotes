import { Directive, ElementRef, HostListener, Renderer2 } from "@angular/core";


@Directive({selector: 'input[numberOnly]'})
export class NumberOnly {

  negative = false;
  decimal = false;

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
    this.negative = this.elementRef.nativeElement.getAttribute('negative') !== null;
    this.decimal = this.elementRef.nativeElement.getAttribute('decimal') !== null;
  }

  @HostListener('input', ['$event.target.value'])
  onInputChange(input: string) {
    const value = this.filterValue(input);
    this.renderer.setProperty(this.elementRef.nativeElement, 'value', value);
  }

  private filterValue(value: any): string {
    if (this.negative && this.decimal) {
      return value.replace(/[^\-0-9\.]*/g, '');
    }
    else if (this.negative) {
      return value.replace(/[^\-0-9]*/g, '');
    }
    else if (this.decimal) {
      return value.replace(/[^0-9\.]*/g, '');
    }
    else {
      return value.replace(/[^0-9]*/g, '');
    }
  }
}
