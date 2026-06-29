'use client';

// "Issue key" launcher + dialog (WS5). A trigger button opens a standard Modal
// holding the issue form; on success the modal swaps to a one-time reveal panel
// showing the plaintext key with a Copy button (the plaintext is never sent back
// to the server or re-rendered after the modal closes). Closing the modal resets
// it back to a fresh form.

import * as React from 'react';
import { Copy, Plus } from 'lucide-react';
import {
  Button,
  Checkbox,
  Input,
  Label,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Stack,
  Text,
} from '@sparx/ui';

import { createApiKeyAction } from '../actions';

const SCOPE_OPTIONS = [
  { value: 'read:crm', label: 'Read CRM (customers, deals, segments, reports)' },
  { value: 'write:crm', label: 'Write CRM (notes, tasks, single-record updates)' },
  { value: 'write:crm_bulk', label: 'Bulk write CRM (multi-record updates, mass assignments)' },
] as const;

export function IssueKeyForm() {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{ plaintext: string; prefix: string } | null>(null);

  // Reset to a fresh form whenever the modal closes (the reveal must not persist).
  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setIssued(null);
      setError(null);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const name = (form.get('name') as string | null)?.trim() ?? '';
    const scopes = form.getAll('scopes').map(String);
    const rawExpiresAt = (form.get('expiresAt') as string | null)?.trim();
    const expiresAt = rawExpiresAt ? new Date(rawExpiresAt).toISOString() : null;

    startTransition(async () => {
      const res = await createApiKeyAction({ name, scopes, expiresAt });
      if (!res.ok) {
        setError(res.error.message);
        return;
      }
      setIssued({ plaintext: res.data.plaintext, prefix: res.data.prefix });
    });
  }

  function copyKey() {
    if (!issued) return;
    void navigator.clipboard.writeText(issued.plaintext);
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <Button color="module" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Issue key
      </Button>
      <ModalContent size="lg">
        <ModalHeader>
          <ModalTitle>Issue a new key</ModalTitle>
          <ModalDescription>
            Scope the key to only what the assistant needs. The key is shown once at issuance — copy
            and store it securely.
          </ModalDescription>
        </ModalHeader>

        {issued ? (
          <Stack gap={3} className="py-2">
            <Text size="sm" weight="medium">
              Key issued. Copy it now — you won&apos;t see this again.
            </Text>
            <Stack direction="row" align="center" gap={2}>
              <code className="flex-1 rounded bg-[var(--color-bg-subtle)] p-2 font-mono text-xs break-all select-all">
                {issued.plaintext}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </Stack>
            <Text size="xs" variant="muted">
              Prefix <code>{issued.prefix}</code> identifies this key in the list.
            </Text>
            <Stack direction="row" justify="end">
              <Button type="button" color="module" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </Stack>
          </Stack>
        ) : (
          <form id="issue-key-form" onSubmit={onSubmit} noValidate>
            <Stack gap={4}>
              <Stack direction="row" gap={4} wrap>
                <Stack gap={2} className="min-w-[14rem] flex-1">
                  <Label htmlFor="name">Label</Label>
                  <Input id="name" name="name" required placeholder="Claude Desktop — sales rep" />
                </Stack>
                <Stack gap={2} className="w-56">
                  <Label htmlFor="expiresAt">Expires at (optional)</Label>
                  <Input id="expiresAt" name="expiresAt" type="date" />
                </Stack>
              </Stack>

              <Stack gap={2}>
                <Label>Scopes</Label>
                <Stack gap={2}>
                  {SCOPE_OPTIONS.map((s) => (
                    <label key={s.value} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        color="module"
                        name="scopes"
                        value={s.value}
                        defaultChecked={s.value === 'read:crm'}
                        className="mt-0.5"
                      />
                      <span>
                        <code className="text-xs">{s.value}</code> — {s.label}
                      </span>
                    </label>
                  ))}
                </Stack>
              </Stack>

              {error && (
                <Text size="sm" variant="danger" role="alert" aria-live="polite">
                  {error}
                </Text>
              )}
            </Stack>
          </form>
        )}

        {!issued && (
          <ModalFooter>
            <Button variant="ghost" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="issue-key-form"
              color="module"
              disabled={pending}
              loading={pending}
            >
              <Plus className="h-3.5 w-3.5" /> Issue key
            </Button>
          </ModalFooter>
        )}
      </ModalContent>
    </Modal>
  );
}
