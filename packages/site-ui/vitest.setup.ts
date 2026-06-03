import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

// ── jsdom polyfills for Radix-backed (Tier 4) components ───────────────────────
// jsdom doesn't implement these browser APIs that Radix primitives rely on
// (ResizeObserver, matchMedia, pointer capture, scrollIntoView). Stub them so the
// interactive components can open/close under test.
const noop = (): void => {
  /* jsdom stub */
};

class ResizeObserverStub {
  observe(): void {
    /* jsdom stub */
  }
  unobserve(): void {
    /* jsdom stub */
  }
  disconnect(): void {
    /* jsdom stub */
  }
}

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (!('matchMedia' in window)) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: noop,
      removeEventListener: noop,
      addListener: noop,
      removeListener: noop,
      dispatchEvent: () => false,
    }),
  });
}

if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = noop;
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = noop;
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = noop;
}
