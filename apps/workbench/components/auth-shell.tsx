'use client';

// The workbench's own auth chrome — sign-in and sign-up share it.
//
// It is deliberately NOT the dashboard's auth screen (a marketing lede beside a
// form). The workbench has one visual language — a recessed base-200 canvas with
// base-100 surfaces lifted onto it, separated by edge and colour, never a shadow —
// and its auth should look like the app you're signing into, not a landing page.
// So the form sits in a card that reads as a workbench PANE: a header row like a
// pane tab, an Ember top-accent, the wordmark above it, all centred on the canvas.

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button, cx, Text } from '@wizeworks/silicaui-react';
import { SparkMascot, Wordmark } from '@sparx/brand/react';
import { signIn } from '@sparx/auth/client';
import { SparkField } from './spark-field';

/** "Sparky" idling behind the pane. ONE mascot (one DOM node — so two can never
 *  show at once) that roams behind the card and pokes out from a different edge
 *  each beat: upper-right, then middle-left, then the bottom, tucking fully
 *  behind the card's centre in between. Position + lean are the `.sparky-peek`
 *  keyframe (app/globals.css, gated on prefers-reduced-motion); the mascot is
 *  decorative (pointer-events-none) and sits under the opaque pane, which hides
 *  it whenever it hasn't leaned past an edge. */
function Sparky() {
  return (
    <div className="sparky-peek pointer-events-none absolute z-0">
      <SparkMascot expression="happy" bob={false} size={132} tone="light" />
    </div>
  );
}

/** Google's mark, inline so the button needs no asset request or icon dependency. */
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden focusable="false">
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

/** "Continue with Google" — the same OAuth entry for sign-in and sign-up (Better
 *  Auth's user.create hook provisions a tenant for a first-time Google user, then
 *  the workbench gate routes them into onboarding). Redirects on success; only a
 *  config/setup error surfaces through onError. */
export function GoogleButton({
  onError,
  disabled,
  callbackURL = '/',
}: {
  onError: (message: string) => void;
  /** Blocked until the sign-up legal agreement is accepted (create-account mode). */
  disabled?: boolean;
  /** Same-origin path to return to after the Google round trip (sanitized upstream).
   *  Carries the MCP consent flow through social sign-in. Defaults to '/'. */
  callbackURL?: string;
}) {
  return (
    <Button
      variant="outline"
      color="neutral"
      className="w-full"
      disabled={disabled}
      onClick={() => {
        void (async () => {
          try {
            await signIn.social({ provider: 'google', callbackURL });
          } catch {
            onError('Google sign-in is unavailable right now. Use your email instead.');
          }
        })();
      }}
    >
      <span className="inline-flex items-center gap-2">
        <GoogleIcon />
        Continue with Google
      </span>
    </Button>
  );
}

/** The "or" rule between the Google button and the email form. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <span className="bg-base-300 h-px flex-1" />
      <span className="text-base-content/60 text-sm">or</span>
      <span className="bg-base-300 h-px flex-1" />
    </div>
  );
}

/** One tab in the pane's header strip. */
export interface AuthTab {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface AuthShellProps {
  /** The tabs in the header strip. One or two: two (with onSelect) is the real
   *  sign-in ⇄ create-account toggle; one is a static mid-flow label (code entry,
   *  link sent) that isn't switchable. */
  tabs: AuthTab[];
  /** Which tab id is active (merged into the body). */
  activeTab: string;
  /** Selecting a NON-active tab. Omit for a static single-tab header (mid-flow). */
  onSelect?: (id: string) => void;
  children: ReactNode;
  /** Optional helper row under the pane. */
  footer?: ReactNode;
}

export function AuthShell({ tabs, activeTab, onSelect, children, footer }: AuthShellProps) {
  return (
    <div className="bg-base-200 text-base-content relative grid min-h-dvh place-items-center overflow-hidden p-6">
      <SparkField />
      <div className="relative z-10 flex w-full max-w-md flex-col items-center gap-6">
        {/* Sized via the `size` prop (height in px) — the wordmark sets its own
            width attribute, so a height utility class alone wouldn't scale it. */}
        <Wordmark size={66} aria-label="sparx" />

        {/* Pane anchor — Sparky peeks from behind this box; the opaque pane (z-10)
            occludes whatever hasn't leaned out yet. */}
        <div className="relative w-full">
          <Sparky />

          {/* The pane. Its header is a real dock tab-strip — a recessed base-200
              strip carrying the base-100 ACTIVE tab that merges into the body below,
              so the auth card reads as a workbench surface and the tabs ARE the
              sign-in ⇄ create-account toggle (the dock's own idiom). Active state is
              carried by the merge + the Ember icon, never by fading the inactive
              label (it stays readable — it's a live control). */}
          <div className="bg-base-100 border-base-300 relative z-10 w-full overflow-hidden rounded-xl border">
            <div
              className="bg-base-200 border-base-300 flex items-center gap-1 border-b px-2 pt-2"
              role={onSelect ? 'tablist' : undefined}
            >
              {tabs.map(({ id, label, icon: Icon }) => {
                const active = id === activeTab;
                const inner = (
                  <>
                    <Icon
                      className={cx(
                        'size-3.5 shrink-0',
                        active ? 'text-primary' : 'text-base-content/50'
                      )}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{label}</span>
                  </>
                );
                const shape = 'flex h-8 items-center gap-2 rounded-t-md px-3';

                if (active) {
                  return (
                    <div
                      key={id}
                      className={cx(shape, 'bg-base-100 border-base-300 -mb-px border border-b-0')}
                      role={onSelect ? 'tab' : undefined}
                      aria-selected={onSelect ? true : undefined}
                      aria-current={onSelect ? undefined : 'page'}
                    >
                      {inner}
                    </div>
                  );
                }

                // Inactive tab — a live control, so it stays on the recessed strip
                // (distinguished by NOT merging into the body, not by faded text).
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={false}
                    className={cx(shape, 'hover:bg-base-100/60 border border-transparent')}
                    onClick={() => onSelect?.(id)}
                  >
                    {inner}
                  </button>
                );
              })}
            </div>
            <div className="@container p-6">{children}</div>
          </div>
        </div>

        {footer ? <Text className="text-sm">{footer}</Text> : null}
      </div>
    </div>
  );
}
