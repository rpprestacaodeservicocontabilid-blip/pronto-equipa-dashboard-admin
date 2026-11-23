import { Directive } from '@angular/core';
@Directive({
  selector: '[appAuthInput]', standalone: true,
  host: { class: 'mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs outline-hidden focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 disabled:opacity-50 dark:border-gray-700 dark:text-white/90 dark:focus:border-brand-500' },
})
export class AuthInputDirective {}
