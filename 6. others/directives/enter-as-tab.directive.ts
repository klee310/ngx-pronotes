import { Directive, ElementRef, HostListener } from '@angular/core';

@Directive({
  selector: 'input[enterAsTab]'
})
export class EnterAsTab {
  // this directive is made specifically for adv-table; and logic within will likely break if html-structure of adv-table changes. Please be careful. this is the way...

  self: any;

  @HostListener('keydown.enter', ['$event'])
  onEnter(e: KeyboardEvent) {
    const nextElem = this.getNextFocusElem();
    if (nextElem) {
      nextElem.focus();
      e.preventDefault();
    }
  }

  constructor(private elemRef: ElementRef<HTMLElement>) {
    this.self = this.elemRef;
  }

  getNextFocusElem(): HTMLElement | null {
    const td = this.traverseParentElem(this.self.nativeElement, 'TD');
    const inp = td?.nextElementSibling?.getElementsByTagName('input');
    if (inp && inp.length && !!inp[0].focus) {
      return inp[0]
    }

    // if not returned by this point, look for the next available button
    return this.traverseSiblingFindButton(td);
  }

  // recursive
  traverseParentElem(start: HTMLElement | null, target: string): HTMLElement | null {
    if (start == null) {
      return null;
    }
    if (start.tagName == 'BODY') {
      return null;
    }
    if (start.tagName == target) {
      return start
    }
    return this.traverseParentElem(start.parentElement, target);
  }

  traverseSiblingFindButton(td: HTMLElement | null) {
    let currentElem = td;
    while (true) {
      if (!currentElem) { break; }  // default exit

      var next = currentElem.nextElementSibling as HTMLElement;
      if (!next) { break; }  // secondary exit

      var butElem = next.getElementsByTagName('button');
      if (!butElem.length) {
        currentElem = next;
        continue;  // loop
      }

      var button = butElem[0] as HTMLButtonElement;
      if (button) {
        button.click();
      }
      return null;
    }
    return null;
  }

}
