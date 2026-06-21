'use client';

import { useCallback, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Label,
  ModuleProvider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  Textarea,
  WizardFrame,
  WizardStep,
  type WizardStepDef,
  toast,
} from '@sparx/ui';

import { addSuppressionAction, importSuppressionsAction } from '../actions';

// Suppression create form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → WizardFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → WizardFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Suppression has NO detail view, so there's no "create flows into view" hop: on
// success we keep the form OPEN, clear the field, and `router.refresh()` so the
// list behind updates. Feedback is via `toast`, not navigation.

interface AddSuppressionFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: WizardStepDef[] = [{ key: 'address', label: 'Address' }];

export function AddSuppressionForm({ surface }: AddSuppressionFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState('');
  const [scope, setScope] = useState('all');

  function parseEmails(raw: string): string[] {
    return raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  }

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/email/suppressions');
    }
  }, [surface, pathname, searchParams, router]);

  function submit() {
    const emails = parseEmails(value);
    if (emails.length === 0) {
      toast.error('Enter at least one email address.');
      return;
    }

    startTransition(async () => {
      if (emails.length === 1) {
        const result = await addSuppressionAction({ email: emails[0], scope, reason: 'manual' });
        if (result.ok) {
          toast.success(`${emails[0]} suppressed.`);
          setValue('');
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      } else {
        const result = await importSuppressionsAction({ emails, scope, reason: 'manual' });
        if (result.ok) {
          toast.success(
            `${result.data.added} address${result.data.added === 1 ? '' : 'es'} suppressed.`
          );
          setValue('');
          router.refresh();
        } else {
          toast.error(result.error.message);
        }
      }
    });
  }

  return (
    <ModuleProvider module="email" className="h-full">
      <WizardFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="Suppress an address"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <WizardStep
          header={{
            title: 'Suppress an address',
            supporting:
              'Add one or many addresses to the do-not-send list. Choose whether to block all email or just marketing.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Suppress',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack gap={2}>
                  <Label htmlFor="emails">Email addresses</Label>
                  <Textarea
                    id="emails"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="one@example.com, two@example.com — or one per line"
                    rows={3}
                    disabled={pending}
                  />
                  <Text size="sm" variant="muted">
                    Paste one or many addresses (comma, space, or newline separated).
                  </Text>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="scope">Scope</Label>
                  <Select value={scope} onValueChange={setScope} disabled={pending}>
                    <SelectTrigger id="scope" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All email</SelectItem>
                      <SelectItem value="marketing">Marketing only</SelectItem>
                      <SelectItem value="transactional">Transactional only</SelectItem>
                    </SelectContent>
                  </Select>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </WizardStep>
      </WizardFrame>
    </ModuleProvider>
  );
}
