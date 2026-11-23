import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SignInFormData } from './schema';
import { RouterModule } from '@angular/router';
import { AuthDividerComponent } from '../../shared/auth-divider/auth-divider.component';
import { SignInFormFieldsComponent } from './form.component';
import { SignInHeaderComponent } from './header.component';
import { SocialButtonsComponent } from './social-button.component';

@Component({
  selector: 'app-sign-in-content',
  imports: [
    CommonModule,
    RouterModule,
    AuthDividerComponent,
    SignInHeaderComponent,
    SocialButtonsComponent,
    SignInFormFieldsComponent,
  ],
  templateUrl: './sign-in.component.html',
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
export class SignInContentComponent {
  @Input() className: string = '';
  @Input() showForm: boolean = true;
  @Input() isSubmitting: boolean = false;
  @Input() googleEnabled: boolean = false;
  @Output() googleSelect = new EventEmitter<void>();
  @Output() formSubmit = new EventEmitter<SignInFormData>();
}
