// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hydrateBehaviors } from './index';

function mount(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body.firstElementChild as HTMLElement;
}

/** The shape the catalog authors: hidden in the markup, revealed by the
 *  behavior. Every test starts from that, because a reveal that begins visible
 *  is the bug this behavior exists to avoid. */
function offer(attrs: string, inner = '<p>10% off</p>'): string {
  return `<aside hidden data-sx-reveal ${attrs}>${inner}</aside>`;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('reveal behavior — when the offer appears', () => {
  it('shows immediately on load', () => {
    const root = mount(offer('data-sx-on="load"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('waits the authored number of seconds', () => {
    const root = mount(offer('data-sx-on="delay" data-sx-delay="20"'));
    const cleanup = hydrateBehaviors(root, { edit: false });

    expect(root.hidden).toBe(true);
    vi.advanceTimersByTime(19_000);
    expect(root.hidden).toBe(true);
    vi.advanceTimersByTime(1_500);
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('does not fire its timer after cleanup', () => {
    const root = mount(offer('data-sx-on="delay" data-sx-delay="5"'));
    hydrateBehaviors(root, { edit: false })();
    vi.advanceTimersByTime(10_000);
    expect(root.hidden).toBe(true);
  });

  it('shows once the visitor has read far enough down', () => {
    const root = mount(offer('data-sx-on="scroll" data-sx-scroll="50"'));
    // 2000px of document in an 800px window ⇒ 1200px of travel.
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(2000);
    window.innerWidth = 1200;
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(true);

    window.scrollY = 300; // 25%
    window.dispatchEvent(new Event('scroll'));
    expect(root.hidden).toBe(true);

    window.scrollY = 700; // ~58%
    window.dispatchEvent(new Event('scroll'));
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('treats a page too short to scroll as fully read', () => {
    const root = mount(offer('data-sx-on="scroll" data-sx-scroll="50"'));
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(400);
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
    const cleanup = hydrateBehaviors(root, { edit: false });
    // Otherwise an offer on a short page could never appear at all.
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('shows on exit intent only when the pointer leaves through the top', () => {
    const root = mount(offer('data-sx-on="exit"'));
    const cleanup = hydrateBehaviors(root, { edit: false });

    // Moving onto another element in the page is not leaving.
    document.dispatchEvent(
      new MouseEvent('mouseout', { relatedTarget: document.createElement('div'), clientY: 5 })
    );
    expect(root.hidden).toBe(true);

    // Out of the window, but sideways — not the address bar.
    document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null, clientY: 400 }));
    expect(root.hidden).toBe(true);

    document.dispatchEvent(new MouseEvent('mouseout', { relatedTarget: null, clientY: 0 }));
    expect(root.hidden).toBe(false);
    cleanup();
  });
});

describe('reveal behavior — the returning visitor', () => {
  it('skips the first visit and shows on the next one', () => {
    const first = mount(offer('data-sx-on="return"'));
    hydrateBehaviors(first, { edit: false })();
    expect(first.hidden).toBe(true);

    const second = mount(offer('data-sx-on="return"'));
    const cleanup = hydrateBehaviors(second, { edit: false });
    expect(second.hidden).toBe(false);
    cleanup();
  });

  it('treats an unreadable store as a first visit', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const root = mount(offer('data-sx-on="return"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    // Showing a "welcome back" offer to a first-timer is the more intrusive of
    // the two possible mistakes, so uncertainty resolves to staying quiet.
    expect(root.hidden).toBe(true);
    cleanup();
    getItem.mockRestore();
  });
});

describe('reveal behavior — the frequency cap', () => {
  it('remembers when it was shown, under its own key', () => {
    const root = mount(offer('data-sx-on="load" data-sx-key="spring-sale"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    expect(Number(localStorage.getItem('sx-revealed:spring-sale'))).toBeGreaterThan(0);
    cleanup();
  });

  it('stays quiet inside the window and returns after it', () => {
    const dayMs = 86_400_000;
    localStorage.setItem('sx-revealed:spring-sale', String(Date.now() - 3 * dayMs));

    const early = mount(offer('data-sx-on="load" data-sx-key="spring-sale" data-sx-every="7"'));
    hydrateBehaviors(early, { edit: false })();
    expect(early.hidden).toBe(true);

    localStorage.setItem('sx-revealed:spring-sale', String(Date.now() - 9 * dayMs));
    const later = mount(offer('data-sx-on="load" data-sx-key="spring-sale" data-sx-every="7"'));
    const cleanup = hydrateBehaviors(later, { edit: false });
    expect(later.hidden).toBe(false);
    cleanup();
  });

  it('shows every visit when the window is zero', () => {
    localStorage.setItem('sx-revealed:always', String(Date.now()));
    const root = mount(offer('data-sx-on="load" data-sx-key="always" data-sx-every="0"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('keeps two offers on one site capped separately', () => {
    localStorage.setItem('sx-revealed:spring-sale', String(Date.now()));
    const other = mount(offer('data-sx-on="load" data-sx-key="newsletter"'));
    const cleanup = hydrateBehaviors(other, { edit: false });
    expect(other.hidden).toBe(false);
    cleanup();
  });

  it('fails OPEN when storage cannot be read', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const root = mount(offer('data-sx-on="load" data-sx-key="spring-sale"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    // An offer nobody ever sees is a worse failure than one seen twice, and a
    // private-mode visitor must not silently lose the site's promotion.
    expect(root.hidden).toBe(false);
    cleanup();
    getItem.mockRestore();
  });

  it('still reveals when the store cannot be written to', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const root = mount(offer('data-sx-on="load" data-sx-key="spring-sale"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    cleanup();
    setItem.mockRestore();
  });
});

describe('reveal behavior — the modal case', () => {
  const MODAL = offer(
    'data-sx-on="delay" data-sx-delay="5" data-sx-opens="1"',
    '<button data-sx-trigger>Open</button>'
  );

  it('clicks the dialog trigger and leaves the host hidden', () => {
    const root = mount(MODAL);
    const trigger = root.querySelector<HTMLElement>('[data-sx-trigger]')!;
    const clicked = vi.fn();
    trigger.addEventListener('click', clicked);

    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(clicked).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(clicked).toHaveBeenCalledTimes(1);
    // The dialog portals its own panel; un-hiding the host would leave a stray
    // trigger button sitting on the page.
    expect(root.hidden).toBe(true);
    cleanup();
  });

  it('clicks through the wrapper the walker puts around a registry atom', () => {
    // `part(node, 'trigger')` on a Dialog marks its WRAPPER, not the button.
    const root = mount(
      offer(
        'data-sx-on="load" data-sx-opens="1"',
        '<div data-sx-trigger><button type="button">Open</button></div>'
      )
    );
    const button = root.querySelector('button')!;
    const clicked = vi.fn();
    button.addEventListener('click', clicked);

    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(clicked).toHaveBeenCalledTimes(1);
    cleanup();
  });

  it('does nothing rather than throwing when there is no trigger to open', () => {
    const root = mount(offer('data-sx-on="load" data-sx-opens="1"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(true);
    cleanup();
  });
});

describe('reveal behavior — the editor canvas', () => {
  it('shows the offer at rest so the author can edit it', () => {
    const root = mount(offer('data-sx-on="delay" data-sx-delay="30"'));
    const cleanup = hydrateBehaviors(root, { edit: true });
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('never writes the frequency cap from the canvas', () => {
    const root = mount(offer('data-sx-on="load" data-sx-key="spring-sale"'));
    const cleanup = hydrateBehaviors(root, { edit: true });
    // Otherwise an author editing their own offer would burn its cap and then
    // not see it on their own site.
    expect(localStorage.getItem('sx-revealed:spring-sale')).toBeNull();
    cleanup();
  });

  it('is visible in the canvas even when its cap says otherwise', () => {
    localStorage.setItem('sx-revealed:spring-sale', String(Date.now()));
    const root = mount(offer('data-sx-on="load" data-sx-key="spring-sale"'));
    const cleanup = hydrateBehaviors(root, { edit: true });
    expect(root.hidden).toBe(false);
    cleanup();
  });
});

describe('reveal behavior — authored badly', () => {
  it('falls back to showing on load when the trigger is unrecognised', () => {
    const root = mount(offer('data-sx-on="whenever"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    // A node authored against a trigger that no longer exists must still show
    // its offer rather than disappearing from the site silently.
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('uses the default delay when the authored one is garbled', () => {
    const root = mount(offer('data-sx-on="delay" data-sx-delay="soon"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    vi.advanceTimersByTime(9_000);
    expect(root.hidden).toBe(true);
    vi.advanceTimersByTime(2_000); // default is 10s
    expect(root.hidden).toBe(false);
    cleanup();
  });

  it('has no cap at all without a key', () => {
    const root = mount(offer('data-sx-on="load"'));
    const cleanup = hydrateBehaviors(root, { edit: false });
    expect(root.hidden).toBe(false);
    expect(localStorage.length).toBe(0);
    cleanup();
  });
});
