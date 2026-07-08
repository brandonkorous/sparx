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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Input,
  Label,
} from 'silicaui-react';

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button color="module" iconStart={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>
        Issue key
      </Button>
      <DialogContent className="sm:max-w-lg">
        <div>
          <DialogTitle>Issue a new key</DialogTitle>
          <DialogDescription>
            Scope the key to only what the assistant needs. The key is shown once at issuance — copy
            and store it securely.
          </DialogDescription>
        </div>

        {issued ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="text-sm font-medium">
              Key issued. Copy it now — you won&apos;t see this again.
            </p>
            <div className="flex flex-row items-center gap-2">
              <code className="flex-1 rounded bg-[var(--color-bg-subtle)] p-2 font-mono text-xs break-all select-all">
                {issued.plaintext}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyKey}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <p className="text-base-content/70 text-xs">
              Prefix <code>{issued.prefix}</code> identifies this key in the list.
            </p>
            <div className="flex flex-row justify-end">
              <Button type="button" color="module" size="sm" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form id="issue-key-form" onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div className="flex flex-row flex-wrap gap-4">
                <div className="flex min-w-[14rem] flex-1 flex-col gap-2">
                  <Label htmlFor="name">Label</Label>
                  <Input id="name" name="name" required placeholder="Claude Desktop — sales rep" />
                </div>
                <div className="flex w-56 flex-col gap-2">
                  <Label htmlFor="expiresAt">Expires at (optional)</Label>
                  <Input id="expiresAt" name="expiresAt" type="date" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Scopes</Label>
                <div className="flex flex-col gap-2">
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
                </div>
              </div>

              {error && (
                <p className="text-danger text-sm" role="alert" aria-live="polite">
                  {error}
                </p>
              )}
            </div>
          </form>
        )}

        {!issued && (
          <div className="mt-4 flex justify-end gap-2">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
