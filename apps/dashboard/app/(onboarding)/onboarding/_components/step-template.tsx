'use client';

import * as React from 'react';
import { Badge, Button, Heading, Stack, Text, cn } from '@sparx/ui';
import { ArrowRight, Check, PencilRuler, Sparkles } from 'lucide-react';
import { selectTemplateAction, startFromScratchAction } from '../_lib/actions';
import type { BlueprintVertical, WizardBlueprint } from '../_lib/types';
import type { StepNav } from './onboarding-wizard';

// Step 1 — Template. The opening move: a gallery of complete, themed blueprints.
// Picking one installs a whole site (pages, theme, brand, products, content) as a
// draft and advances to Domain. The site is finished from the first second —
// nothing is 1/10th built. "Start from scratch" is the quiet escape hatch.
//
// The gallery only ever receives blueprints that have a real preview screenshot
// (filtered server-side), so a new tenant never sees a placeholder.

const VERTICAL_LABEL: Record<BlueprintVertical, string> = {
  retail: 'Store',
  b2b: 'Wholesale',
  content: 'Publication',
  services: 'Services',
};

function contentsLine(bp: WizardBlueprint): string {
  const c = bp.contents;
  const parts: string[] = [];
  if (c.products > 0) parts.push(`${c.products} products`);
  if (c.content > 0) parts.push(`${c.content} pages of content`);
  parts.push(`${c.theme} theme`);
  return parts.join(' · ');
}

export function StepTemplate({
  blueprints,
  preselectKey,
  nav,
}: {
  blueprints: WizardBlueprint[];
  preselectKey: string | null;
  nav: StepNav;
}) {
  const [error, setError] = React.useState<string | null>(null);
  // The key currently being installed (per-card spinner); '' = scratch path.
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const busy = busyKey !== null;

  function choose(key: string) {
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      const res = await selectTemplateAction(key);
      if (res.ok) nav.onNext();
      else {
        setError(res.error);
        setBusyKey(null);
      }
    });
  }

  function scratch() {
    setError(null);
    setBusyKey('');
    startTransition(async () => {
      const res = await startFromScratchAction();
      if (res.ok) nav.onNext();
      else {
        setError(res.error);
        setBusyKey(null);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <Stack gap={8}>
        <Stack gap={2} align="center" className="text-center">
          <Badge color="module" variant="soft" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Step 1 of 4
          </Badge>
          <Heading level={1}>What are you building?</Heading>
          <Text variant="muted" className="max-w-xl">
            Pick a starting point and we&apos;ll build you a complete, ready-to-launch site — pages,
            design, products, and content included. You can change everything later.
          </Text>
        </Stack>

        {error && (
          <Text size="sm" variant="danger" role="alert" aria-live="polite" className="text-center">
            {error}
          </Text>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {blueprints.map((bp) => {
            const preselected = bp.key === preselectKey;
            const installing = busyKey === bp.key;
            return (
              <article
                key={bp.key}
                className={cn(
                  'group flex flex-col overflow-hidden rounded-xl border bg-[var(--color-bg-surface)] transition-shadow',
                  preselected
                    ? 'border-[var(--module-active)] shadow-md ring-1 ring-[var(--module-active)]'
                    : 'border-[var(--color-border-default)] hover:shadow-md'
                )}
              >
                {/* The blueprint's home-page screenshot — top-aligned so the hero
                    leads, the same crop the marketplace uses. */}
                <div className="relative aspect-[16/10] w-full bg-[var(--color-bg-subtle)]">
                  {bp.preview && (
                    <div
                      className="h-full w-full bg-cover bg-top"
                      style={{ backgroundImage: `url("${bp.preview}")` }}
                    />
                  )}
                  {preselected && (
                    <span className="absolute top-3 right-3">
                      <Badge color="module" variant="solid" className="gap-1">
                        <Check className="h-3 w-3" />
                        Your pick
                      </Badge>
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-5">
                  <Stack direction="row" align="center" justify="between" gap={2}>
                    <Text weight="medium">{bp.name}</Text>
                    <Badge variant="soft" color="neutral">
                      {VERTICAL_LABEL[bp.vertical]}
                    </Badge>
                  </Stack>
                  <Text size="sm" variant="muted" className="line-clamp-2">
                    {bp.summary}
                  </Text>
                  <Text size="xs" variant="muted" className="mt-auto">
                    {contentsLine(bp)}
                  </Text>
                  <Button
                    color="module"
                    onClick={() => choose(bp.key)}
                    disabled={busy}
                    loading={installing}
                    rightIcon={installing ? undefined : <ArrowRight className="h-4 w-4" />}
                    className="w-full"
                  >
                    {installing ? 'Building your site…' : 'Use this template'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Start from scratch — the secondary path for builders who want a blank
            canvas. Turns the Builder on and skips straight to setup. */}
        <Stack
          gap={2}
          align="center"
          className="border-t border-[var(--color-border-default)] pt-8 text-center"
        >
          <Text size="sm" variant="muted">
            Prefer to design it yourself?
          </Text>
          <Button
            variant="ghost"
            color="neutral"
            onClick={scratch}
            disabled={busy}
            loading={busyKey === ''}
            leftIcon={<PencilRuler className="h-4 w-4" />}
          >
            Start from scratch
          </Button>
        </Stack>
      </Stack>
    </div>
  );
}
