import Link from 'next/link';
import { Badge, Button, Card, Heading, Stack, Text } from '@sparx/ui';
import { ArrowRight } from 'lucide-react';
import { onboardingEntryHref } from '@/lib/onboarding-entry';
import type { OnboardingProgress } from '../welcome/onboarding';

// Compact welcome banner shown on the dashboard home until the tenant
// either finishes every actionable step OR dismisses onboarding, whichever
// comes first. Shown for at most 7 days after the wizard finishes.
//
// If onboarding hasn't been finished yet: CTA resumes it at the right front end
// (onboardingEntryHref — the story flow or the classic wizard, picking up where the
// tenant left off). Once finished: CTA points at the day-0+ checklist (/welcome) and
// the 7-day countdown starts.

const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000;

export interface OnboardingBannerProps {
  progress: OnboardingProgress;
}

export function OnboardingBanner({ progress }: OnboardingBannerProps) {
  if (progress.state.dismissed) return null;

  const wizardFinished = Boolean(progress.state.finishedAt);

  // After the wizard finishes, hide the banner after 7 days (docs/65 Ph2).
  if (wizardFinished && progress.state.finishedAt) {
    const finishedMs = new Date(progress.state.finishedAt).getTime();
    if (Date.now() - finishedMs > DAYS_7_MS) return null;
  }

  const actionable = progress.steps.filter((s) => !s.comingSoon);
  const done = actionable.filter((s) => s.done).length;
  if (done === actionable.length) return null;

  const pct = Math.round(progress.completion * 100);
  const cta = wizardFinished
    ? { href: '/welcome', label: 'Open checklist' }
    : { href: onboardingEntryHref(progress.state), label: 'Resume setup' };

  return (
    <Card variant="subtle">
      <Stack direction="row" align="center" justify="between" gap={4}>
        <Stack gap={1} className="flex-1">
          <Stack direction="row" align="center" gap={2}>
            <Heading level={3}>Finish setting up sparx</Heading>
            <Badge color="neutral" variant="soft" size="sm">
              {done} of {actionable.length} done
            </Badge>
          </Stack>
          <Text size="sm" variant="muted">
            A few quick steps to get your site production-ready ({pct}% complete).
          </Text>
        </Stack>
        <Button asChild rightIcon={<ArrowRight className="h-3.5 w-3.5" />}>
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      </Stack>
    </Card>
  );
}
