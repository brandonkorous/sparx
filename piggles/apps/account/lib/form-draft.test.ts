import { describe, expect, it } from 'vitest';
import { clearDraft, readDraft, saveDraft, type DraftStore } from './form-draft';
import { keepSignupDraft, restoreSignupDraft } from './signup-draft';
import { keepOnboardingDraft, restoreOnboardingDraft } from './onboarding-draft';

/** sessionStorage as a Map; it survives a "reload" because the test keeps it. */
function memoryStore(): DraftStore & { raw: Map<string, string> } {
  const raw = new Map<string, string>();
  return {
    raw,
    getItem: (key) => raw.get(key) ?? null,
    setItem: (key, value) => void raw.set(key, value),
    removeItem: (key) => void raw.delete(key),
  };
}

function signupForm(): FormData {
  const form = new FormData();
  form.set('name', 'Dana Baker');
  form.set('email', 'dana@bakery.com');
  form.set('password', 'hunter2-secret');
  form.set('analytics', 'on');
  return form;
}

describe('signup draft across a stale-build reload', () => {
  it('restores name, email and consent, and never stores the password', () => {
    const store = memoryStore();
    keepSignupDraft(signupForm(), store);
    // The UnrecognizedActionError recovery reloads the tab: only storage survives.
    const restored = restoreSignupDraft(store);
    expect(restored).toEqual({ name: 'Dana Baker', email: 'dana@bakery.com', analytics: true });
    expect([...store.raw.values()].join('')).not.toContain('hunter2');
  });

  it('is empty in a fresh tab', () => {
    expect(restoreSignupDraft(memoryStore())).toBeNull();
  });
});

describe('onboarding draft across a reload', () => {
  it('restores every answer and drops unknown groups', () => {
    const store = memoryStore();
    keepOnboardingDraft(
      {
        name: 'Dana Bakes',
        trade: 'bakery',
        address: 'dana-bakes',
        ownAddress: true,
        look: 'piggles-starter',
        picked: ['sell', 'money'],
        heard: 'friend',
      },
      store
    );
    store.raw.set(
      'piggles.draft.onboarding',
      store.raw.get('piggles.draft.onboarding')!.replace('"money"', '"money","nope"')
    );
    expect(restoreOnboardingDraft(store)).toEqual({
      name: 'Dana Bakes',
      trade: 'bakery',
      address: 'dana-bakes',
      ownAddress: true,
      look: 'piggles-starter',
      picked: ['sell', 'money'],
      heard: 'friend',
    });
  });
});

describe('form drafts', () => {
  it('drops secret keys even when a caller passes them', () => {
    const store = memoryStore();
    saveDraft('x', { name: 'a', password: 'p', cardNumber: '4242' }, store);
    expect(readDraft('x', store)).toEqual({ name: 'a' });
  });

  it('reads a malformed draft as none', () => {
    const store = memoryStore();
    store.setItem('piggles.draft.x', '{not json');
    expect(readDraft('x', store)).toBeNull();
  });

  it('forgets a draft once cleared', () => {
    const store = memoryStore();
    saveDraft('x', { name: 'a' }, store);
    clearDraft('x', store);
    expect(readDraft('x', store)).toBeNull();
  });

  it('never throws when storage is blocked', () => {
    const blocked: DraftStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveDraft('x', { name: 'a' }, blocked)).not.toThrow();
    expect(readDraft('x', blocked)).toBeNull();
    expect(() => clearDraft('x', blocked)).not.toThrow();
    expect(readDraft('x', null)).toBeNull();
  });
});
