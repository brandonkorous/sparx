'use client';

// The two bespoke controls the ContactForm inspector needs beyond plain
// text/switch fields (docs/115 Part B): the notify RECIPIENTS editor (email
// chips) and the inline TURN-ON-CRM prompt. Kept beside the panel
// (contact-form-inspector.tsx) so that file stays focused on assembling the
// cards. Both reuse the inspector's `bx-*` field chrome.

import * as React from 'react';
import { X } from 'lucide-react';
import { Button, Input, Text, toast } from '@sparx/ui';

import { setModuleEnabledAction } from '../../settings/modules/actions';

// Add/remove email chips. Prefilled with the owner's email when the list is
// empty (the endpoint falls back to it), so one click makes the target explicit
// without silently mutating saved props.
export function RecipientsEditor({
  recipients,
  ownerEmail,
  onChange,
}: {
  recipients: string[];
  ownerEmail: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState('');
  const seeded = React.useRef(false);
  React.useEffect(() => {
    if (!seeded.current && recipients.length === 0 && ownerEmail && draft === '') {
      setDraft(ownerEmail);
      seeded.current = true;
    }
  }, [ownerEmail, recipients.length, draft]);

  function add() {
    const email = draft.trim().toLowerCase();
    if (!email || !email.includes('@') || recipients.includes(email)) return;
    onChange([...recipients, email]);
    setDraft('');
  }

  return (
    <div className="bx-field">
      <span className="bx-field__label">Send it to these addresses</span>
      {recipients.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {recipients.map((email) => (
            <span
              key={email}
              className="bg-base-200 inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-sm"
            >
              <span className="break-all">{email}</span>
              <button
                type="button"
                aria-label={`Remove ${email}`}
                className="text-base-content/50 hover:text-base-content rounded-full p-0.5"
                onClick={() => onChange(recipients.filter((r) => r !== email))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <Input
          type="email"
          size="sm"
          value={draft}
          placeholder="you@business.com"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          Add
        </Button>
      </div>
      {recipients.length === 0 ? (
        <span className="bx-field__hint">
          {ownerEmail
            ? `No addresses yet — replies go to ${ownerEmail} (your account email) by default.`
            : 'No addresses yet — replies go to your account email by default.'}
        </span>
      ) : null}
    </div>
  );
}

// Inline "turn on CRM" prompt shown when addToCrm is on but the module is off.
// Reuses the real activation path (which also backfills stored leads).
export function CrmActivatePrompt({ canActivate }: { canActivate: boolean }) {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (done) {
    return <p className="bx-inspector__tip">CRM is on — new submissions will become contacts.</p>;
  }

  async function activate() {
    setBusy(true);
    const result = await setModuleEnabledAction('crm', true);
    setBusy(false);
    if (result.ok) {
      setDone(true);
      toast.success('CRM is on — your existing leads are being imported.');
    } else {
      toast.error(result.error.message);
    }
  }

  return (
    <div className="bg-base-200 flex flex-col gap-2 rounded-md p-3">
      <Text size="sm" variant="muted">
        Adding people to your contacts needs the CRM turned on. It&apos;s free to switch on, and the
        leads you&apos;ve already collected are imported automatically.
      </Text>
      {canActivate ? (
        <Button type="button" size="sm" color="module" loading={busy} onClick={activate}>
          Turn on CRM
        </Button>
      ) : (
        <Text size="sm" variant="muted">
          Ask a workspace owner or admin to turn on CRM.
        </Text>
      )}
    </div>
  );
}
