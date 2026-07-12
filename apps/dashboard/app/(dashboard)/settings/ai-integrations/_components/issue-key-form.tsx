'use client';

// "Issue key" launcher + dialog (WS5). A trigger button opens a standard Modal
// holding the issue form; on success the modal swaps to a one-time reveal panel
// showing the plaintext key with a Copy button (the plaintext is never sent back
// to the server or re-rendered after the modal closes). Closing the modal resets
// it back to a fresh form.

import * as React from 'react';
import { Copy, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Label,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';
import type { McpScopeMeta } from '@sparx/auth';

import { createApiKeyAction } from '../actions';

export interface IssueKeyFormProps {
  /** Scopes this staffer's role may grant — the full cross-module catalog
   *  capped by grantableScopesForRole(), same as the MCP OAuth consent page. */
  catalog: McpScopeMeta[];
}

// Group by module, preserving catalog order — mirrors oauth/consent's ConsentForm.
function groupByModule(catalog: McpScopeMeta[]): { module: string; scopes: McpScopeMeta[] }[] {
  const groups: { module: string; scopes: McpScopeMeta[] }[] = [];
  for (const meta of catalog) {
    const g = groups.find((x) => x.module === meta.module);
    if (g) g.scopes.push(meta);
    else groups.push({ module: meta.module, scopes: [meta] });
  }
  return groups;
}

export function IssueKeyForm({ catalog }: IssueKeyFormProps) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [name, setName] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [issued, setIssued] = React.useState<{ plaintext: string; prefix: string } | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const groups = React.useMemo(() => groupByModule(catalog), [catalog]);

  const v = useFieldValidation({ name }, { name: rule.required('Give the key a label.') });

  // Reset to a fresh form whenever the modal closes (the reveal must not persist).
  function onOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) {
      setIssued(null);
      setName('');
      setError(null);
      setSelected(new Set());
    }
  }

  const toggleScope = (scope: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(scope);
      else next.delete(scope);
      return next;
    });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!v.validate()) return;
    const form = new FormData(e.currentTarget);
    const scopes = form.getAll('scopes').map(String);
    if (scopes.length === 0) {
      setError('Select at least one scope for this key.');
      return;
    }
    const rawExpiresAt = (form.get('expiresAt') as string | null)?.trim();
    const expiresAt = rawExpiresAt ? new Date(rawExpiresAt).toISOString() : null;

    startTransition(async () => {
      const res = await createApiKeyAction({ name: name.trim(), scopes, expiresAt });
      if (!res.ok) {
        const msg = res.error.message;
        if (/name|label/i.test(msg)) {
          v.setServerErrors({ name: msg });
        } else {
          setError(msg);
        }
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
              <code className="bg-base-200 flex-1 rounded p-2 font-mono text-xs break-all select-all">
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
                <Field {...v.field('name')} className="min-w-[14rem] flex-1">
                  <FieldLabel required>Label</FieldLabel>
                  <FieldControl
                    name="name"
                    placeholder="Claude Desktop — sales rep"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    {...v.control('name')}
                  />
                </Field>
                <Field className="w-56">
                  <FieldLabel>Expires at (optional)</FieldLabel>
                  <FieldControl name="expiresAt" type="date" />
                </Field>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Scopes</Label>
                <div className="flex max-h-[50vh] flex-col gap-4 overflow-y-auto pr-1">
                  {groups.map((group) => (
                    <div key={group.module} className="flex flex-col gap-2">
                      <p className="text-base-content/70 text-xs font-medium">{group.module}</p>
                      {group.scopes.map((s) => (
                        <label key={s.scope} className="flex items-start gap-2 text-sm">
                          <Checkbox
                            color="module"
                            name="scopes"
                            value={s.scope}
                            checked={selected.has(s.scope)}
                            onChange={(e) => toggleScope(s.scope, e.target.checked)}
                            className="mt-0.5"
                          />
                          <span>
                            <code className="text-xs">{s.scope}</code> — {s.description}
                            {s.sensitive && (
                              <Badge color="danger" variant="soft" size="sm" className="ml-2">
                                sensitive
                              </Badge>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                  {error}
                </FieldStatus>
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
