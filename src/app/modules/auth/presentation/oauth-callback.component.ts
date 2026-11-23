import { Component, OnInit } from '@angular/core';
@Component({
  selector: 'app-oauth-callback', standalone: true,
  template: `<main class="flex min-h-screen items-center justify-center bg-white p-6 text-gray-700 dark:bg-gray-900 dark:text-gray-300"><p role="status">{{ message }}</p></main>`,
})
export class OAuthCallbackComponent implements OnInit {
  message = 'Completing Google sign-in…';
  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const state = params.get('state');
    const code = params.get('code');
    const error = params.get('error');
    window.history.replaceState(null, '', window.location.pathname);
    if (!window.opener || !state || !(code || error)) {
      this.message = 'Return to the sign-in page and start Google sign-in again.';
      return;
    }
    window.opener.postMessage({ type: 'prontoequipas-google', state, code, error }, window.location.origin);
    // The opener closes the popup after validating source, origin and state.
  }
}
