import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, Renderer2 } from '@angular/core';

/** https://www.htmlgoodies.com/javascript/loading-external-scripts-dynamically-in-angular/ */
@Injectable({
  providedIn: 'root'
})
export class ScriptService {

  constructor(@Inject(DOCUMENT) private document: Document) { }

  public loadJsScript(renderer: Renderer2, src: string): HTMLScriptElement {
    const script = renderer.createElement('script');
    script.type = 'text/javascript';
    script.src = src;
    renderer.appendChild(this.document.head, script);
    return script;
  }
}
