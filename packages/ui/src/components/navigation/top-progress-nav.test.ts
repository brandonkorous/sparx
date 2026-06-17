import { afterEach, describe, expect, it, vi } from 'vitest';
import { installNavigationListeners, resolveRouteModule } from './top-progress-nav';

describe('resolveRouteModule', () => {
  it('maps a module segment to its module', () => {
    expect(resolveRouteModule('/commerce/products')).toBe('commerce');
    expect(resolveRouteModule('/cms')).toBe('cms');
    expect(resolveRouteModule('/crm?tab=1#x')).toBe('crm');
  });

  it('aliases legacy segments to their module color', () => {
    expect(resolveRouteModule('/sitebuilder/pages')).toBe('builder');
    expect(resolveRouteModule('/storefront')).toBe('builder');
  });

  it('returns null (→ spectrum) for platform routes', () => {
    expect(resolveRouteModule('/')).toBeNull();
    expect(resolveRouteModule('/settings/sites')).toBeNull();
    expect(resolveRouteModule('')).toBeNull();
    expect(resolveRouteModule(undefined)).toBeNull();
  });
});

describe('installNavigationListeners', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function clickAnchor(href: string): void {
    const a = document.createElement('a');
    a.setAttribute('href', href);
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  }

  it('fires onStart with the destination module for in-app links', () => {
    const onStart = vi.fn();
    const cleanup = installNavigationListeners(onStart);
    clickAnchor('/commerce/products');
    expect(onStart).toHaveBeenCalledWith('commerce');
    cleanup();
  });

  it('ignores same-path, external, and download links', () => {
    const onStart = vi.fn();
    const cleanup = installNavigationListeners(onStart);
    clickAnchor(window.location.pathname);
    clickAnchor('https://example.com/x');
    const dl = document.createElement('a');
    dl.setAttribute('href', '/files/report.pdf');
    dl.setAttribute('download', '');
    document.body.appendChild(dl);
    dl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(onStart).not.toHaveBeenCalled();
    cleanup();
  });

  it('catches programmatic pushState navigations (deferred to a microtask)', async () => {
    const onStart = vi.fn();
    const cleanup = installNavigationListeners(onStart);
    history.pushState({}, '', '/cms/content');
    // The start signal is deferred to a microtask so it never fires while React
    // is mid-commit (App Router pushes from an insertion effect).
    expect(onStart).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onStart).toHaveBeenCalledWith('cms');
    cleanup();
    history.pushState({}, '', '/'); // restore for other tests
  });

  it('stops firing after cleanup', () => {
    const onStart = vi.fn();
    const cleanup = installNavigationListeners(onStart);
    cleanup();
    clickAnchor('/cms');
    expect(onStart).not.toHaveBeenCalled();
  });
});
