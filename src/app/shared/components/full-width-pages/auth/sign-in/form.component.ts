import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { SignInFormData } from './schema';
import { ButtonComponent } from '../../../ui/button/button.component';
import { InputDirective } from '../../../ui/input/input.directive';

@Component({
  selector: 'app-sign-in-form-fields',
  standalone: true,
  imports: [InputDirective, ButtonComponent, CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './form.component.html',
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
export class SignInFormFieldsComponent {
  @Input() className: string = '';
  @Output() formSubmit = new EventEmitter<SignInFormData>();

  showPassword = false;
  @Input() isSubmitting: boolean = false;

  signInForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/\S/)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  isFieldInvalid(fieldName: 'email' | 'password'): boolean {
    const control = this.signInForm.get(fieldName);
    return !!(control && control.invalid && (control.dirty || control.touched));
  }

  getFieldError(fieldName: 'email' | 'password'): string {
    const control = this.signInForm.get(fieldName);
    if (!control || !control.errors) return '';

    if (fieldName === 'email') {
      return 'Enter your email or phone.';
    }

    if (fieldName === 'password') {
      if (control.errors['required']) return 'Password is required';
    }

    return '';
  }

  onSubmit() {
    if (this.isSubmitting) return;
    if (this.signInForm.invalid) {
      this.signInForm.markAllAsTouched();
      return;
    }

    const data: SignInFormData = this.signInForm.getRawValue();
    this.formSubmit.emit(data);

  }
}
