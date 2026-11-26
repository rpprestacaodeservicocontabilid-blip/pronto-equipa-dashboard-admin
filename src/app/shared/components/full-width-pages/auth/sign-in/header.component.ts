import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-sign-in-header',
  imports: [CommonModule],
  templateUrl: './header.component.html',
  host: {
    class: 'contents',
  },
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class SignInHeaderComponent {
  @Input() title: string = $localize`:@@ui-wcrgg3:Sign In`;
  @Input() description: string = $localize`:@@ui-1cjb5fy:Enter your email and password to sign in!`;
  @Input() className: string = '';
}
