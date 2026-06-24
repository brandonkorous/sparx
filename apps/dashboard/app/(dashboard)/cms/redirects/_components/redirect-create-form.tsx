'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Input,
  Label,
  ModuleProvider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createRedirect } from '../actions';

// New-redirect form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Redirects have NO detail view, so on success the form STAYS OPEN: it shows an
// inline success line, resets the fields + status Select, and refreshes the
// underlying list — there is no URL token switch into a record.

interface RedirectCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'redirect', label: 'Redirect' }];

export function RedirectCreateForm({ surface }: RedirectCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  const [fromPath, setFromPath] = React.useState('');
  const [toPath, setToPath] = React.useState('');
  const [statusCode, setStatusCode] = React.useState('301');

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
      router.push('/cms/redirects');
    }
  }, [surface, pathname, searchParams, router]);

  function submit() {
    setError(null);
    setMessage(null);
    if (!fromPath.trim() || !toPath.trim()) {
      setError('Both From and To paths are required.');
      return;
    }
    // The <Select> writes to React state, not native FormData — build the body
    // with the SAME keys the action expects.
    const data = new FormData();
    data.append('from_path', fromPath.trim());
    data.append('to_path', toPath.trim());
    data.append('status_code', statusCode);
    startTransition(async () => {
      const result = await createRedirect(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create redirect.');
        return;
      }
      // No detail view: stay open, reset to defaults, and refresh the list.
      setMessage('Redirect added.');
      setFromPath('');
      setToPath('');
      setStatusCode('301');
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Add redirect"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Redirect',
            supporting: 'Paths must begin with a slash. Same-path or loop targets are rejected.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Add redirect',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack direction="row" gap={3} align="end" wrap>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="from_path">From</Label>
                  <Input
                    id="from_path"
                    name="from_path"
                    value={fromPath}
                    onChange={(e) => setFromPath(e.target.value)}
                    placeholder="/old-path"
                  />
                </Stack>
                <Stack gap={1} className="flex-1">
                  <Label htmlFor="to_path">To</Label>
                  <Input
                    id="to_path"
                    name="to_path"
                    value={toPath}
                    onChange={(e) => setToPath(e.target.value)}
                    placeholder="/new-path"
                  />
                </Stack>
                <Stack gap={1}>
                  <Label htmlFor="status_code">Status</Label>
                  <Select value={statusCode} onValueChange={setStatusCode}>
                    <SelectTrigger id="status_code" aria-label="HTTP status code">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="301">301 Permanent</SelectItem>
                      <SelectItem value="302">302 Found</SelectItem>
                      <SelectItem value="307">307 Temporary</SelectItem>
                      <SelectItem value="308">308 Permanent (keep method)</SelectItem>
                    </SelectContent>
                  </Select>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
          {message && (
            <Text size="sm" variant="success" aria-live="polite" className="mt-4">
              {message}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
