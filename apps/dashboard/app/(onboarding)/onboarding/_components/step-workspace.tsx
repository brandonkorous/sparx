'use client';

import * as React from 'react';
import { Button, Input, Label, Spinner, Text, WizardStep, cn } from '@sparx/ui';
import { Check } from 'lucide-react';
import { checkSlugAction, saveWorkspaceAction } from '../_lib/actions';
import type { SlugAvailability } from '../_lib/types';
import type { StepNav } from './onboarding-wizard';

const STORE_ZONE = 'sparx.zone';

const REASON_COPY: Record<string, string> = {
  invalid: 'Use lowercase letters, numbers, and hyphens (3–63 characters).',
  reserved: 'That address is reserved — try another.',
  taken: 'That address is already taken — try another.',
};

type CheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'done'; result: SlugAvailability };

// Step 3 — Workspace. Name the company, confirm the storefront address (slug),
// and name the first site. This is the LAST chance to change the address: after
// the site goes live, the URL is locked (changing a live address breaks links).
// The site-name default is "Primary" (a tenant is a workspace that HAS sites, so
// the first one reads as the primary, not an echo of the company name).
export function StepWorkspace({
  initial,
  nav,
}: {
  initial: { companyName: string; slug: string; siteName: string };
  nav: StepNav;
}) {
  const [companyName, setCompanyName] = React.useState(initial.companyName);
  const [slug, setSlug] = React.useState(initial.slug);
  const [siteName, setSiteName] = React.useState(initial.siteName);
  const [check, setCheck] = React.useState<CheckState>({ status: 'idle' });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, startSave] = React.useTransition();

  const normalized = slug.trim().toLowerCase();
  const unchangedSlug = normalized === initial.slug.trim().toLowerCase();

  // Debounced availability check — skipped when the slug is unchanged (their own
  // address always "available").
  React.useEffect(() => {
    if (!normalized || unchangedSlug) {
      setCheck({ status: 'idle' });
      return;
    }
    setCheck({ status: 'checking' });
    const handle = setTimeout(() => {
      void checkSlugAction(normalized).then((res) => {
        if (res.ok) setCheck({ status: 'done', result: res.data });
        else setCheck({ status: 'idle' });
      });
    }, 400);
    return () => clearTimeout(handle);
  }, [normalized, unchangedSlug]);

  const slugOk = unchangedSlug || (check.status === 'done' && check.result.available);
  const canContinue = companyName.trim().length > 0 && siteName.trim().length > 0 && slugOk;

  function onContinue() {
    if (!canContinue) return;
    setError(null);
    startSave(async () => {
      const res = await saveWorkspaceAction({
        companyName: companyName.trim(),
        slug: normalized,
        siteName: siteName.trim(),
      });
      if (res.ok) nav.onNext();
      else setError(res.error);
    });
  }

  return (
    <WizardStep
      width="default"
      header={{
        title: 'Name your workspace',
        supporting:
          'This is your company and its first site. We pre-filled what you told us at signup — tweak anything. Your free address goes live the moment you launch.',
      }}
      actions={{
        onBack: nav.onBack,
        onNext: onContinue,
        nextLabel: 'Continue',
        nextDisabled: !canContinue,
        nextLoading: saving,
      }}
    >
      <div className="max-w-xl rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ws-company">Company name</Label>
            <Input
              id="ws-company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Bob's Barbers"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ws-slug">Workspace address</Label>
            <div className="flex items-center gap-2">
              <Input
                id="ws-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="bobs-barbers"
                className="flex-1"
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
              />
              <Text variant="muted" className="whitespace-nowrap">
                .{STORE_ZONE}
              </Text>
            </div>
            {check.status === 'checking' && (
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <Text size="xs" variant="muted">
                  Checking availability…
                </Text>
              </div>
            )}
            {!unchangedSlug && check.status === 'done' && check.result.available && (
              <div className="flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[var(--color-success-text)]" />
                <Text size="xs" className="text-[var(--color-success-text)]">
                  {normalized}.{STORE_ZONE} is available
                </Text>
              </div>
            )}
            {!unchangedSlug && check.status === 'done' && !check.result.available && (
              <div className="flex flex-col gap-1">
                <Text size="xs" variant="danger">
                  {REASON_COPY[check.result.reason] ?? 'That address is unavailable.'}
                </Text>
                {check.result.suggestions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Text size="xs" variant="muted">
                      Try:
                    </Text>
                    {check.result.suggestions.map((s) => (
                      <Button
                        key={s}
                        color="module"
                        variant="link"
                        size="sm"
                        onClick={() => setSlug(s)}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="ws-site">
              Site name{' '}
              <span className="font-normal text-[var(--color-text-tertiary)]">
                · you can add more sites later
              </span>
            </Label>
            <Input
              id="ws-site"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Primary"
            />
          </div>
        </div>
      </div>

      {error && (
        <Text
          size="sm"
          variant="danger"
          role="alert"
          aria-live="polite"
          className={cn('mt-4 block')}
        >
          {error}
        </Text>
      )}
    </WizardStep>
  );
}
