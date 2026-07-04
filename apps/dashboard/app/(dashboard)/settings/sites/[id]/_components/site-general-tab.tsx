'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Palette, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Code,
  Heading,
  Input,
  Label,
  Stack,
  Text,
  useConfirm,
} from '@sparx/ui';

import { deleteSite, renameSite } from '../../actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';
import type { StatusBadge } from '../../_lib';

// General tab of the site detail — identity + the operational essentials. This is
// ONE panel of a tabbed detail, so it is NOT a nested SurfaceFrame (docs/86): the
// panel brought onto the design system directly (neutral cards, explicit Save
// that disables until dirty, the unsaved guard the GuardedTabs/back-link consult).
// Look & branding are NOT here — they live on the Brand page, linked below.

interface SiteGeneralTabProps {
  propertyId: string;
  name: string;
  slug: string;
  isPrimary: boolean;
  status: StatusBadge;
  createdAt: string;
  primaryHost: string | null;
  zoneSuffix: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function SiteGeneralTab({
  propertyId,
  name,
  slug,
  isPrimary,
  status,
  createdAt,
  primaryHost,
  zoneSuffix,
}: SiteGeneralTabProps) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = React.useTransition();
  const [value, setValue] = React.useState(name);
  const [baseline, setBaseline] = React.useState(name);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const dirty = value.trim() !== baseline.trim();
  useUnsavedGuard(dirty, { kind: 'edit', noun: 'site' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set('propertyId', propertyId);
    fd.set('name', value.trim());
    startTransition(async () => {
      const res = await renameSite(fd);
      if (res.ok) {
        setBaseline(value.trim());
        setSavedAt(Date.now());
        router.refresh();
      } else {
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Delete “${baseline}”?`,
      description:
        'This permanently removes this site — its pages, layout, and domains. Your products, content, and orders are not affected. This can’t be undone.',
      confirmLabel: 'Delete site',
      tone: 'danger',
    });
    if (!ok) return;
    startTransition(async () => {
      const res = await deleteSite(propertyId);
      if (res.ok) {
        router.push('/settings/sites');
      } else {
        setError(res.error ?? 'Something went wrong.');
      }
    });
  }

  return (
    <Stack gap={4}>
      {/* Identity — the site's customer-facing name (Property.name). Editable field
          only; no read-only heading restating it (docs/86 identity-once). */}
      <form onSubmit={onSubmit} noValidate>
        <Card variant="default">
          <CardHeader>
            <Heading level={3}>Site name &amp; address</Heading>
            <CardDescription>
              The name shows to customers in this site&apos;s title bar, header, and emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Stack gap={4}>
              <Stack gap={2}>
                <Label htmlFor="site-name">Site name</Label>
                <Input
                  id="site-name"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  required
                  maxLength={255}
                />
              </Stack>

              <Stack gap={2}>
                <Label htmlFor="site-handle">URL handle</Label>
                <Input id="site-handle" value={slug} readOnly disabled />
                <Text size="xs" variant="muted">
                  Anchors this site&apos;s built-in address{' '}
                  <Code>
                    {slug}.{zoneSuffix}
                  </Code>
                  . Connect your own domain from the Domains tab.
                </Text>
              </Stack>

              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}

              <Stack direction="row" justify="end" align="center" gap={2}>
                {savedAt !== null && !dirty && (
                  <Stack
                    direction="row"
                    align="center"
                    gap={1}
                    className="text-[var(--color-success-text)]"
                  >
                    <Check className="h-4 w-4" />
                    <Text size="sm" variant="success">
                      Saved
                    </Text>
                  </Stack>
                )}
                <Button type="submit" color="module" disabled={pending || !dirty} loading={pending}>
                  Save changes
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </form>

      {/* Where the LOOK is set — a read-only pointer, not design controls. */}
      <Card variant="default">
        <CardContent>
          <Stack direction="row" align="center" gap={3}>
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--module-active-tint)] text-[var(--module-active)]"
            >
              <Palette className="h-4 w-4" />
            </span>
            <Stack gap={0} className="min-w-0 flex-1">
              <Text weight="medium" size="sm">
                Look &amp; branding
              </Text>
              <Text size="sm" variant="muted">
                Colours, fonts, and theme for this site are set on the Brand page.
              </Text>
            </Stack>
            <Button
              asChild
              variant="outline"
              size="sm"
              rightIcon={<ArrowRight className="h-4 w-4" />}
            >
              <Link href="/builder/brand">Open Brand</Link>
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* At a glance */}
      <Card variant="default">
        <CardHeader>
          <Heading level={3}>At a glance</Heading>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-[var(--color-text-muted)]">Status</dt>
            <dd>
              <Badge color={status.color} variant="soft">
                {status.label}
              </Badge>
            </dd>
            <dt className="text-[var(--color-text-muted)]">Primary domain</dt>
            <dd>{primaryHost ?? '—'}</dd>
            <dt className="text-[var(--color-text-muted)]">Handle</dt>
            <dd>
              <Code>{slug}</Code>
            </dd>
            <dt className="text-[var(--color-text-muted)]">Created</dt>
            <dd>{formatDate(createdAt)}</dd>
          </dl>
        </CardContent>
      </Card>

      {/* Danger zone — the primary site can't be deleted (api-rest refuses it). */}
      {!isPrimary && (
        <Card variant="default" className="border-[var(--color-danger-border)]">
          <CardHeader>
            <Heading level={3}>Delete this site</Heading>
            <CardDescription>
              Permanently removes this site — its pages, layout, and domains. Your products,
              content, and orders are untouched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="ghost"
              color="danger"
              disabled={pending}
              onClick={() => void onDelete()}
              leftIcon={<Trash2 className="h-4 w-4" />}
            >
              Delete “{baseline}”
            </Button>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}
