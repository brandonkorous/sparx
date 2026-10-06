'use client';

import { Badge, Button, Select, Text } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../../lib/confirm';
import { CONTACT_ROLE_LABELS, type AccountContact, type ContactRole } from '../accounts-data';

/* ── Contacts ───────────────────────────────────────────────────────────── */

export const ROLE_OPTIONS: { value: ContactRole; label: string }[] = (
  Object.keys(CONTACT_ROLE_LABELS) as ContactRole[]
).map((role) => ({ value: role, label: CONTACT_ROLE_LABELS[role] }));

function contactName(contact: AccountContact): string {
  const person = [contact.customer.firstName, contact.customer.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (person !== '') return person;
  return contact.customer.company ?? contact.customer.email ?? 'Unnamed contact';
}

export function ContactRow({
  contact,
  busy,
  onRole,
  onToggleActive,
}: {
  contact: AccountContact;
  busy: boolean;
  onRole: (role: ContactRole) => void;
  onToggleActive: () => void;
}) {
  // Asked first. Remove is one click and the list re-sorts after every change,
  // so after Restore the pointer sat on the NEXT person's Remove: a double click
  // took the account's only approver away, with nothing to say so (sparx persona
  // issue 091). Restore needs no question; it gives access back.
  const confirm = useConfirm();
  const onToggle = async () => {
    if (contact.isActive) {
      const name = contactName(contact);
      const ok = await confirm({
        title: `Remove ${name} from this account?`,
        description: `${name} will no longer be able to use this account on your site. Orders they already placed stay as they are. You can restore them here at any time.`,
        confirmLabel: `Remove ${name}`,
        cancelLabel: 'Keep them',
        color: 'danger',
      });
      if (!ok) return;
    }
    onToggleActive();
  };
  return (
    <li className="border-base-300 flex flex-wrap items-center gap-x-3 gap-y-2 border-b pb-3 last:border-b-0 last:pb-0">
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{contactName(contact)}</span>
        {contact.customer.email ? (
          <Text as="span" className="block text-sm">
            {contact.customer.email}
          </Text>
        ) : null}
      </span>
      <ContactRoleControl contact={contact} onRole={onRole} />
      <Button
        size="sm"
        variant="ghost"
        color={contact.isActive ? 'danger' : 'module'}
        disabled={busy}
        onClick={() => {
          void onToggle();
        }}
      >
        {contact.isActive ? 'Remove' : 'Restore'}
      </Button>
    </li>
  );
}

/** A removed person can no longer order or approve for the account. It is a
 *  `warning`, not a `danger`: the person is set aside and can be added back,
 *  where red is kept for a suspended account or a failed payment. */
const REMOVED = { label: 'Removed', tone: 'warning' } as const;

function ContactRoleControl({
  contact,
  onRole,
}: {
  contact: AccountContact;
  onRole: (role: ContactRole) => void;
}) {
  return contact.isActive ? (
    <div className="w-52 shrink-0">
      <Select
        size="sm"
        color="module"
        aria-label={`What ${contactName(contact)} can do`}
        value={contact.role}
        items={ROLE_OPTIONS}
        onValueChange={(next) => {
          onRole((next as ContactRole | null) ?? contact.role);
        }}
      />
    </div>
  ) : (
    <Badge color={REMOVED.tone} variant="soft" size="sm">
      {REMOVED.label}
    </Badge>
  );
}
