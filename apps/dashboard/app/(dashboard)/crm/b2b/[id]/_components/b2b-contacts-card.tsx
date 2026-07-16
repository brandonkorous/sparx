'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardTitle, NativeSelect } from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';

import { addB2bAccountContactAction, updateB2bAccountContactAction } from '../../../b2b-actions';

const ROLES = [
  { value: 'primary_contact', label: 'Primary contact' },
  { value: 'buyer', label: 'Buyer' },
  { value: 'approver', label: 'Approver' },
  { value: 'viewer', label: 'Viewer' },
] as const;

function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export interface B2bContactRow {
  id: string;
  role: string;
  isActive: boolean;
  customer: { id: string; firstName: string | null; lastName: string | null; email: string | null };
}

export interface CustomerOption {
  id: string;
  name: string;
  email: string | null;
}

// Contacts are what actually grant a customer B2B pricing + portal access
// (packages/db/prisma/schema/62-b2b-contacts.prisma) — a B2B account with no
// active contact here is unreachable by any real shopper login.
export function B2bContactsCard({
  accountId,
  contacts,
  customers,
}: {
  accountId: string;
  contacts: B2bContactRow[];
  customers: CustomerOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [customerId, setCustomerId] = React.useState('');
  const [role, setRole] = React.useState<string>('buyer');

  const linkedIds = new Set(contacts.filter((c) => c.isActive).map((c) => c.customer.id));
  const pickable = customers.filter((c) => !linkedIds.has(c.id));

  function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!customerId) {
      toast.error('Pick a customer to add.');
      return;
    }
    startTransition(async () => {
      const result = await addB2bAccountContactAction(accountId, { customerId, role });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success('Contact added.');
      setCustomerId('');
      setRole('buyer');
      router.refresh();
    });
  }

  function onToggleActive(contact: B2bContactRow) {
    startTransition(async () => {
      const result = await updateB2bAccountContactAction(accountId, contact.id, {
        isActive: !contact.isActive,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(contact.isActive ? 'Contact deactivated.' : 'Contact reactivated.');
      router.refresh();
    });
  }

  function onRoleChange(contact: B2bContactRow, next: string) {
    if (next === contact.role) return;
    startTransition(async () => {
      const result = await updateB2bAccountContactAction(accountId, contact.id, { role: next });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <CardTitle>Contacts</CardTitle>
        <p className="text-base-content -mt-2 text-sm">
          Who can sign in as this company — sets their pricing, net-terms eligibility, and portal
          access.
        </p>

        {contacts.length > 0 && (
          <div className="flex flex-col gap-2">
            {contacts.map((c) => {
              const name =
                `${c.customer.firstName ?? ''} ${c.customer.lastName ?? ''}`.trim() ||
                (c.customer.email ?? '') ||
                c.customer.id.slice(0, 8);
              return (
                <div
                  key={c.id}
                  className="border-base-300 flex flex-row flex-wrap items-center gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    {c.customer.email && (
                      <p className="text-base-content truncate text-xs">{c.customer.email}</p>
                    )}
                  </div>
                  <Badge color={c.isActive ? 'module' : 'neutral'} variant="soft" size="sm">
                    {c.isActive ? roleLabel(c.role) : 'Inactive'}
                  </Badge>
                  <NativeSelect
                    value={c.role}
                    disabled={pending || !c.isActive}
                    onChange={(e) => onRoleChange(c, e.target.value)}
                    className="w-40"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </NativeSelect>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => onToggleActive(c)}
                  >
                    {c.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <form
          onSubmit={onAdd}
          className="border-base-300 flex flex-row flex-wrap items-end gap-3 rounded-lg border border-dashed p-3"
        >
          <div className="flex min-w-[14rem] flex-1 flex-col gap-1">
            <label className="text-base-content text-xs" htmlFor="b2b-contact-customer">
              Customer
            </label>
            <NativeSelect
              id="b2b-contact-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="">— pick —</option>
              {pickable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.email && c.email !== c.name ? ` · ${c.email}` : ''}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex w-40 flex-col gap-1">
            <label className="text-base-content text-xs" htmlFor="b2b-contact-role">
              Role
            </label>
            <NativeSelect
              id="b2b-contact-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <Button type="submit" color="module" size="sm" disabled={pending}>
            <UserPlus className="h-3.5 w-3.5" />
            {pending ? 'Adding…' : 'Add contact'}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
