'use client';

import { Button } from '@wizeworks/silicaui-react';
import { signIn } from '@wizeworks/auth/client';

// "Continue with Google", and the rule that separates it from the email form.
//
// Rendered only where `googleSignInAvailable()` said so (lib/social.ts) — the
// provider is registered conditionally on env, and a button that cannot work is
// worse than no button on this particular screen.
//
// The same component serves sign-in and create-account, because Google does not
// distinguish them: Better Auth's `user.create` hook provisions a tenant for a
// first-time Google user, and an existing one is linked by verified email
// (`accountLinking.trustedProviders` includes google), so a password user who
// later clicks this lands on their own business rather than a second empty one.

/** Google's mark.
 *
 *  Literal hex, and one of exactly two places the repo permits it: another
 *  company's brand mark is not ours, means nothing else, and has no light/dark
 *  variant to respond with (root CLAUDE.md RULE #1). Inline rather than an asset
 *  so the button costs no extra request and no icon dependency. */
function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export function GoogleButton({
  next,
  onError,
  disabled,
}: {
  /** Where to land after the round trip — already sanitised to a same-origin
   *  path by `safeInternalPath` at the page. */
  next: string;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  return (
    // `outline` + `neutral`: this is the second way in, and the primary fill is
    // spoken for by the thing the form is actually for. Not `ghost` — a
    // borderless control beside a bordered input reads as a link, and this is a
    // button that leaves the site.
    <Button
      type="button"
      variant="outline"
      color="neutral"
      size="lg"
      block
      disabled={disabled}
      onClick={() => {
        void (async () => {
          try {
            await signIn.social({ provider: 'google', callbackURL: next });
          } catch {
            onError('Google is not answering right now. Your email and password still work.');
          }
        })();
      }}
    >
      <GoogleMark />
      Continue with Google
    </Button>
  );
}

/** The "or" rule between the social button and the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-4" aria-hidden>
      <span className="bg-base-300 h-px flex-1" />
      {/* A real ink, not a faded one. This is text a person reads (DESIGN.md §3
          — `soft`/`/opacity` is for text deliberately NOT meant to be read), and
          it is de-emphasised by being small and centred rather than by fading. */}
      <span className="text-sm font-semibold">or</span>
      <span className="bg-base-300 h-px flex-1" />
    </div>
  );
}
