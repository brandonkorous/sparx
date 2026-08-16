'use client';

// The post-setup nudge on the "Start here" surface.
//
// For a short window after a tenant finishes onboarding (and only while the
// welcome checklist still has something left), a quiet banner points them at the
// remaining work. It disappears on its own once the checklist is done, the window
// closes, or the tenant dismisses it — a nudge, never a wall.
//
// Renders nothing at all when it doesn't apply, so a caller can drop it in
// unconditionally.

import { faArrowRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Alert, Button } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../../lib/surfaces/registry';
import { useOnboarding, useOnboardingProgress } from '../../../lib/onboarding/api';

/** How long after finishing we keep nudging (ms). Matches the dashboard's 7 days. */
const NUDGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function WelcomeBanner({ ctx }: { ctx: SurfaceContext }) {
  const { data: state } = useOnboarding();
  const { data: progress } = useOnboardingProgress();

  if (!state?.finishedAt || state.dismissed) return null;

  const finishedAt = Date.parse(state.finishedAt);
  if (Number.isFinite(finishedAt) && Date.now() - finishedAt > NUDGE_WINDOW_MS) return null;

  // Nothing left to nudge — the checklist is done (or hasn't loaded yet, in which
  // case we stay quiet rather than flash a banner that immediately vanishes).
  if (!progress || progress.completion >= 1) return null;

  const remaining = progress.steps.filter((s) => !s.done).length;

  return (
    <Alert color="module" variant="soft" className="items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">Finish getting production-ready</span>
        <span className="text-sm">
          {remaining === 1
            ? 'One more thing to set up when you have a minute.'
            : `${String(remaining)} more things to set up when you have a minute.`}
        </span>
      </div>
      <Button
        size="sm"
        color="module"
        onClick={() => {
          ctx.open('workbench.welcome');
        }}
      >
        Pick up where you left off
        <Icon glyph={faArrowRight} className="size-4" aria-hidden />
      </Button>
    </Alert>
  );
}
