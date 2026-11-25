import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { BROWSER_SESSION_WRITE } from './auth-api.service';

describe('Browser session cookie coordination', () => {
  it('waits for a cookie writer in another same-origin document', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const scope = crypto.randomUUID();
    const writer = TestBed.inject(BROWSER_SESSION_WRITE);
    const calls: string[] = [];
    let pending!: Promise<string>;
    try {
      const other = frame.contentWindow as Window & typeof globalThis;
      await other.navigator.locks.request('prontoequipas.auth:' + scope, async () => {
        pending = firstValueFrom(writer(scope, () => {
          calls.push('refresh');
          return of('rotated');
        }));
        await navigator.locks.query();
        expect(calls).toEqual([]);
      });
      expect(await pending).toBe('rotated');
      expect(calls).toEqual(['refresh']);
    } finally {
      frame.remove();
    }
  });
});
