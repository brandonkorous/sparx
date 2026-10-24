import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetOneTapForTests, startOneTap, type GoogleIdApi } from './one-tap-session';

// "initialize() is called multiple times" on app.sparx.works/sign-in (trace
// 69076b02): the effect re-ran on every new onError. Initialise once, prompt each time.

function fakeApi() {
  const initialize = vi.fn<GoogleIdApi['initialize']>();
  const prompt = vi.fn<GoogleIdApi['prompt']>();
  const api: GoogleIdApi = { initialize, prompt, cancel: vi.fn() };
  return { api, initialize, prompt };
}

const noop = vi.fn();

describe('startOneTap', () => {
  beforeEach(() => resetOneTapForTests());

  it('initialises once however often it starts', () => {
    const { api, initialize, prompt } = fakeApi();
    startOneTap(api, 'client-1', noop);
    startOneTap(api, 'client-1', noop);
    startOneTap(api, 'client-1', noop);
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(prompt).toHaveBeenCalledTimes(3);
  });

  it('hands the credential to the newest handler', () => {
    const { api, initialize } = fakeApi();
    const first = vi.fn();
    const second = vi.fn();
    startOneTap(api, 'client-1', first);
    startOneTap(api, 'client-1', second);
    const config = initialize.mock.calls[0]?.[0];
    config?.callback({ credential: 'id-token' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('id-token');
  });

  it('initialises again only for a different client id', () => {
    const { api, initialize } = fakeApi();
    startOneTap(api, 'client-1', noop);
    startOneTap(api, 'client-2', noop);
    expect(initialize).toHaveBeenCalledTimes(2);
  });
});
