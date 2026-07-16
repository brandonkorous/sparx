'use client';

import { useTransition, type ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { ListChecks, Sparkles } from 'lucide-react';
import type { OnboardingFlow } from '@/lib/onboarding-entry';
import { switchOnboardingFlowAction } from '../_lib/flow-actions';

// The affordance that moves an owner between the two onboarding front ends. Shared by
// both, so the switch reads and behaves identically in either direction — the flows are
// alternatives, not a primary and a fallback.

/** `to` names the flow being switched TO, so the copy is what the owner gets. */
const LABEL: Record<OnboardingFlow, string> = {
  story: 'Tell your story',
  classic: 'Use the classic step-by-step setup',
};

const PROMPT: Record<OnboardingFlow, string> = {
  story: 'Rather just describe your business?',
  classic: 'Rather fill it in yourself?',
};

/** Each flow's own character, so the button previews what it's handing you: narrating
 *  (sparkles — the same mark the wizard's pitch card uses) vs working a checklist. */
const ICON: Record<OnboardingFlow, ReactNode> = {
  story: <Sparkles className="h-3.5 w-3.5" />,
  classic: <ListChecks className="h-3.5 w-3.5" />,
};

/** The switch itself. Renders as a real accent `<Button>` by default — the other flow is
 *  a genuine alternative an owner should be able to SEE, not a footnote. Accent (violet)
 *  rather than the rail's Builder-indigo `module` hue, so it never reads as a second
 *  primary; `soft` keeps the solid CTA above it unambiguously first.
 *
 *  Pass `children` to wrap the same behavior in bespoke chrome (the wizard's dashed pitch
 *  card), which keeps ONE code path for recording the choice + routing. */
export function FlowSwitchButton({
  to,
  className,
  children,
}: {
  to: OnboardingFlow;
  className?: string;
  children?: ReactNode;
}): ReactNode {
  const [pending, startTransition] = useTransition();
  const go = (): void => {
    startTransition(async () => {
      await switchOnboardingFlowAction(to);
    });
  };

  if (children) {
    return (
      <button type="button" onClick={go} disabled={pending} className={className}>
        {children}
      </button>
    );
  }
  return (
    <Button
      color="accent"
      variant="soft"
      size="sm"
      block
      onClick={go}
      disabled={pending}
      loading={pending}
      iconStart={ICON[to]}
    >
      {LABEL[to]}
    </Button>
  );
}

/** The alt-path row pinned under the SummaryCard's CTA — the persistent home for the
 *  switch in both flows, so it's reachable from any step rather than only the first. */
export function FlowSwitchAlt({ to }: { to: OnboardingFlow }): ReactNode {
  return (
    <div className="border-base-300 flex flex-col gap-2.5 border-t px-6 py-4">
      <p className="text-base-content text-center text-sm">{PROMPT[to]}</p>
      <FlowSwitchButton to={to} />
    </div>
  );
}
