'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Eye } from 'lucide-react';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  ModuleProvider,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createSegmentAction, previewSegmentCountAction } from '../../segment-actions';
import { type Rule, RuleBuilder, defaultRule } from './rule-builder';

// New-segment form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields + rule editor sit in
// module-tinted Cards. No bespoke card-footer toolbar, no repeated overlay
// title — that drift is what docs/86 standardizes away.
//
// The rule editor is a visual AND/OR/NOT tree builder over the SegmentRule
// shape — see ./rule-builder. "Preview count" runs against the live rule object
// so "X of Y match" reads against whatever the user has constructed in the tree
// — it's an in-card control, NOT part of the floor toolbar. On success the
// overlay swaps the token to the new record's detail view (create flows into
// view); the page pushes to the record.

interface SegmentCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function SegmentCreateForm({ surface }: SegmentCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [rule, setRule] = React.useState<Rule>(defaultRule);
  const [preview, setPreview] = React.useState<{
    matches: number;
    sampled: number;
    total: number;
  } | null>(null);
  const [previewing, setPreviewing] = React.useState(false);

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/crm/segments');
    }
  }, [surface, pathname, searchParams, router]);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `segment:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/crm/segments/${id}`);
    router.refresh();
  }

  function runPreview() {
    setError(null);
    setPreviewing(true);
    startTransition(async () => {
      const result = await previewSegmentCountAction(rule);
      setPreviewing(false);
      if (!result.ok) {
        setError(result.error.message);
        setPreview(null);
        return;
      }
      setPreview(result.data);
    });
  }

  function submit() {
    setError(null);
    if (!name.trim() || !slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    const input = {
      name: name.trim(),
      slug: slug.trim(),
      ...(description.trim() ? { description: description.trim() } : {}),
      rules: rule,
    };
    startTransition(async () => {
      const result = await createSegmentAction(input);
      if (result.ok) {
        onCreated(result.data.id);
        return;
      }
      setError(result.error.message);
    });
  }

  return (
    <ModuleProvider module="crm" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New segment"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Segment details',
            supporting:
              'Segments are materialized incrementally; this rule is evaluated on every event that could change a customer’s projection (orders, opens, clicks, B2B updates).',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create segment',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Stack gap={6}>
            <Card variant="module">
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent>
                <Stack gap={4}>
                  <Stack direction="row" gap={4} wrap>
                    <Stack gap={2} className="flex-1">
                      <Label htmlFor="seg-name">Name</Label>
                      <Input
                        id="seg-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="High-value customers"
                      />
                    </Stack>
                    <Stack gap={2} className="flex-1">
                      <Label htmlFor="seg-slug">Slug</Label>
                      <Input
                        id="seg-slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="high-value-customers"
                        pattern="^[a-z][a-z0-9-]*$"
                      />
                    </Stack>
                  </Stack>
                  <Stack gap={2}>
                    <Label htmlFor="seg-description">Description</Label>
                    <Input
                      id="seg-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <Card variant="module">
              <CardHeader>
                <Stack direction="row" align="center" justify="between">
                  <CardTitle>Rule</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={runPreview}
                    disabled={pending || previewing}
                    loading={previewing}
                    leftIcon={!previewing ? <Eye className="h-3.5 w-3.5" /> : undefined}
                  >
                    Preview count
                  </Button>
                </Stack>
              </CardHeader>
              <CardContent>
                <Stack gap={3}>
                  <RuleBuilder value={rule} onChange={setRule} />
                  {preview && (
                    <Stack
                      direction="row"
                      align="center"
                      gap={2}
                      className="rounded-md border border-[var(--color-border-default)] bg-[var(--module-active-soft)] p-3"
                    >
                      <Text size="sm">
                        <span className="font-medium tabular-nums">{preview.matches}</span> of{' '}
                        <span className="tabular-nums">{preview.sampled}</span> sampled match
                      </Text>
                      <Text size="xs" variant="muted">
                        ({preview.total} customers total)
                      </Text>
                    </Stack>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
