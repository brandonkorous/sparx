'use client';

// Google One Tap — the streamlined "sign in as <you>" prompt that appears on
// top of the auth card, distinct from the "Continue with Google" button (that's
// a full redirect; this is an in-page overlay Google renders itself).
//
// It only mounts when a client id is present (AuthWrapper passes it down from
// the server, resolved from process.env at request time — never a NEXT_PUBLIC
// bake, so the portable image stays environment-agnostic). We drive Google's
// GSI library directly rather than through Better Auth's oneTapClient plugin,
// because the shared @wizeworks/auth client is app-agnostic and must not carry a
// baked client id. The credential Google returns goes to the same server
// endpoint the plugin would call: POST /api/auth/one-tap/callback { idToken }.
//
// Deployment note: One Tap needs this origin registered as an authorized
// JavaScript origin on the Google OAuth client, and the page CSP must allow
// https://accounts.google.com (script + frame + connect). Until both are true
// it silently no-ops, which is the correct degraded state.

import { useEffect, useRef } from 'react';
import { startOneTap, type GoogleIdApi } from './one-tap-session';

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const FAILED = 'Google sign-in did not complete. Use your email or the Google button instead.';

/** POST Google's credential, then land on `callbackURL`; `onError` on failure. */
async function completeSignIn(
  idToken: string,
  callbackURL: string,
  onError: (message: string) => void
): Promise<void> {
  try {
    const res = await fetch('/api/auth/one-tap/callback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new Error('one-tap callback rejected');
    window.location.href = callbackURL;
  } catch {
    onError(FAILED);
  }
}

export function GoogleOneTap({
  clientId,
  onError,
  callbackURL = '/',
}: {
  clientId: string;
  onError: (message: string) => void;
  /** Same-origin path to land on after One Tap completes (sanitized upstream).
   *  Carries the MCP consent flow through One Tap. Defaults to '/'. */
  callbackURL?: string;
}) {
  // Held in refs so a parent re-render never re-runs the effect (and initialise).
  const latest = useRef({ onError, callbackURL });
  useEffect(() => {
    latest.current = { onError, callbackURL };
  }, [onError, callbackURL]);

  useEffect(() => {
    let cancelled = false;

    function init() {
      const api = window.google?.accounts.id;
      if (cancelled || !api) return;
      startOneTap(api, clientId, (idToken) => {
        const { callbackURL: to, onError: fail } = latest.current;
        void completeSignIn(idToken, to, fail);
      });
    }

    // Load the GSI library once, then initialise. If it's already present (a
    // remount), initialise straight away.
    if (window.google?.accounts.id) {
      init();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = GSI_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', init);

    return () => {
      cancelled = true;
      script.removeEventListener('load', init);
      window.google?.accounts.id.cancel();
    };
  }, [clientId]);

  return null;
}
