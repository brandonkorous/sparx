'use client';

// Google One Tap — the streamlined "sign in as <you>" prompt that appears on
// top of the auth card, distinct from the "Continue with Google" button (that's
// a full redirect; this is an in-page overlay Google renders itself).
//
// It only mounts when a client id is present (AuthWrapper passes it down from
// the server, resolved from process.env at request time — never a NEXT_PUBLIC
// bake, so the portable image stays environment-agnostic). We drive Google's
// GSI library directly rather than through Better Auth's oneTapClient plugin,
// because the shared @sparx/auth client is app-agnostic and must not carry a
// baked client id. The credential Google returns goes to the same server
// endpoint the plugin would call: POST /api/auth/one-tap/callback { idToken }.
//
// Deployment note: One Tap needs this origin registered as an authorized
// JavaScript origin on the Google OAuth client, and the page CSP must allow
// https://accounts.google.com (script + frame + connect). Until both are true
// it silently no-ops, which is the correct degraded state.

import { useEffect } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }): void;
  prompt(): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

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
  useEffect(() => {
    let cancelled = false;

    async function completeSignIn(idToken: string) {
      try {
        const res = await fetch('/api/auth/one-tap/callback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
        if (!res.ok) throw new Error('one-tap callback rejected');
        window.location.href = callbackURL;
      } catch {
        onError('Google sign-in did not complete. Use your email or the Google button instead.');
      }
    }

    function init() {
      if (cancelled) return;
      const api = window.google?.accounts.id;
      if (!api) return;
      api.initialize({
        client_id: clientId,
        callback: (response) => {
          void completeSignIn(response.credential);
        },
        cancel_on_tap_outside: false,
      });
      api.prompt();
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
  }, [clientId, onError, callbackURL]);

  return null;
}
