'use client';

// The per-theme action for a marketplace card/detail (docs/60 §10, D11). A theme
// "Apply" is active-site-only: it loads the preset into the active property's
// DRAFT (same call as the Brand & Theme editor's theme picker), so nothing public
// changes until the tenant reviews + publishes. Confirm-gated + toasted, mirroring
// the blueprint/module-toggle pattern. After applying, we point at the Brand &
// Theme editor to review and go live.

import * as React from 'react';
import Link from 'next/link';
import { Button, Stack, Text, toast, useConfirm } from '@sparx/ui';

import { applyThemeAction } from '../actions';

interface Props {
  themeSlug: string;
  themeName: string;
  canInstall: boolean;
}

export function ThemeCardActions({ themeSlug, themeName, canInstall }: Props) {
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [applied, setApplied] = React.useState(false);

  if (!canInstall) {
    return (
      <Text size="xs" variant="muted">
        Only an owner or admin can apply a theme.
      </Text>
    );
  }

  // confirm() opens a dialog via React state — it MUST run outside startTransition
  // (see blueprint-card-actions): the transition would hold the dialog-open update.
  function onApply(): void {
    void (async () => {
      const ok = await confirm({
        title: `Apply “${themeName}”?`,
        description:
          'This loads the theme into your active site as a draft. Your live site is unchanged until you review and publish in Brand & Theme.',
        confirmLabel: 'Apply theme',
        tone: 'module',
      });
      if (!ok) return;
      startTransition(async () => {
        try {
          const res = await applyThemeAction(themeSlug);
          if (res.ok) {
            setApplied(true);
            toast.success(`${themeName} applied`, {
              description: 'Loaded into your site draft. Review and publish in Brand & Theme.',
            });
          } else {
            toast.error("Couldn't apply theme", { description: res.error.message });
          }
        } catch (err) {
          toast.error("Couldn't apply theme", {
            description: err instanceof Error ? err.message : String(err),
          });
        }
      });
    })();
  }

  if (applied) {
    return (
      <Stack direction="row" gap={2} align="center" className="flex-wrap">
        <Text size="sm" variant="muted">
          Applied to draft
        </Text>
        <Button variant="outline" size="sm" asChild>
          <Link href="/builder/_brand">Review &amp; publish</Link>
        </Button>
      </Stack>
    );
  }

  return (
    <Button color="primary" onClick={onApply} loading={pending} disabled={pending}>
      Apply to my site
    </Button>
  );
}
