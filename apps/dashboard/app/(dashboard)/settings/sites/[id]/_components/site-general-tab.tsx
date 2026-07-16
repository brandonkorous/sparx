'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Palette, Trash2 } from 'lucide-react';
import { Code, useConfirm } from '@sparx/ui';
import {
  Badge,
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

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

  const v = useFieldValidation({ name: value }, { name: rule.required('Enter a site name.') });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
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
    <div className="flex flex-col gap-4">
      {/* Identity — the site's customer-facing name (Property.name). Editable field
          only; no read-only heading restating it (docs/86 identity-once). */}
      <form onSubmit={onSubmit} noValidate>
        <Card>
          <CardBody>
            <h3 className="text-xl font-semibold">Site name &amp; address</h3>
            <p className="opacity-70">
              The name shows to customers in this site&apos;s title bar, header, and emails.
            </p>
            <div className="flex flex-col gap-4">
              <Field {...v.field('name')}>
                <FieldLabel required>Site name</FieldLabel>
                <FieldControl
                  name="name"
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(null);
                  }}
                  maxLength={255}
                  {...v.control('name')}
                />
              </Field>

              <Field>
                <FieldLabel>URL handle</FieldLabel>
                <FieldControl name="handle" value={slug} readOnly disabled />
                <FieldDescription>
                  Anchors this site&apos;s built-in address{' '}
                  <Code>
                    {slug}.{zoneSuffix}
                  </Code>
                  . Connect your own domain from the Domains tab.
                </FieldDescription>
              </Field>

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
              )}

              <div className="flex flex-row items-center justify-end gap-2">
                {savedAt !== null && !dirty && (
                  <div className="text-success flex flex-row items-center gap-1">
                    <Check className="h-4 w-4" />
                    <p className="text-success text-sm">Saved</p>
                  </div>
                )}
                <Button type="submit" color="module" disabled={pending || !dirty} loading={pending}>
                  Save changes
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </form>

      {/* Where the LOOK is set — a read-only pointer, not design controls. */}
      <Card>
        <CardBody>
          <div className="flex flex-row items-center gap-3">
            <span
              aria-hidden
              className="bg-module bg-soft text-module flex size-9 shrink-0 items-center justify-center rounded-md"
            >
              <Palette className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0">
              <p className="text-sm font-medium">Look &amp; branding</p>
              <p className="text-base-content text-sm">
                Name, logo, and links for this site are set in Site settings; colours and fonts are
                set in the Builder.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              iconEnd={<ArrowRight className="h-4 w-4" />}
              render={<Link href="/builder/site" />}
            >
              Open Site settings
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* At a glance */}
      <Card>
        <CardBody>
          <h3 className="text-xl font-semibold">At a glance</h3>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-3 text-sm">
            <dt className="text-base-content">Status</dt>
            <dd>
              <Badge color={status.color} variant="soft">
                {status.label}
              </Badge>
            </dd>
            <dt className="text-base-content">Primary domain</dt>
            <dd>{primaryHost ?? '—'}</dd>
            <dt className="text-base-content">Handle</dt>
            <dd>
              <Code>{slug}</Code>
            </dd>
            <dt className="text-base-content">Created</dt>
            <dd>{formatDate(createdAt)}</dd>
          </dl>
        </CardBody>
      </Card>

      {/* Danger zone — the primary site can't be deleted (api-rest refuses it). */}
      {!isPrimary && (
        <Card className="border-danger">
          <CardBody>
            <h3 className="text-xl font-semibold">Delete this site</h3>
            <p className="opacity-70">
              Permanently removes this site — its pages, layout, and domains. Your products,
              content, and orders are untouched.
            </p>
            <Button
              variant="ghost"
              color="danger"
              disabled={pending}
              onClick={() => void onDelete()}
              iconStart={<Trash2 className="h-4 w-4" />}
            >
              Delete “{baseline}”
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
