'use client';

import * as React from 'react';
import { Button, Card, CardBody, Input, Label, Select } from 'silicaui-react';
import { toast } from '@sparx/ui';
import { UserPlus } from 'lucide-react';
import { ASSIGNABLE_ORG_ROLES, type OrgRole } from '@sparx/auth/org-roles';
import { inviteMember } from '../actions';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../_lib/roles';

const ROLE_ITEMS: Record<string, string> = Object.fromEntries(
  ASSIGNABLE_ORG_ROLES.map((r) => [r, ROLE_LABELS[r]])
);

// The invite row for Settings → Team — email + role, submitted to the
// `inviteMember` server action (which fires the invitation email via the org
// plugin). Rendered only for owners/admins.
export function InviteForm() {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [role, setRole] = React.useState<OrgRole>('editor');
  const [pending, startTransition] = React.useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set('role', role);
    startTransition(async () => {
      const result = await inviteMember(formData);
      if (result.ok) {
        toast.success('Invitation sent');
        formRef.current?.reset();
        setRole('editor');
      } else {
        toast.error(result.error ?? 'Could not send the invitation.');
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <form ref={formRef} onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-end">
              <div className="flex w-full flex-col gap-2 sm:flex-1">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  placeholder="teammate@example.com"
                  required
                />
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-48">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  id="invite-role"
                  value={role}
                  onValueChange={(v) => setRole(v as OrgRole)}
                  items={ROLE_ITEMS}
                />
              </div>
              <Button
                type="submit"
                loading={pending}
                disabled={pending}
                className="w-full sm:w-auto"
                iconStart={<UserPlus className="h-4 w-4" />}
              >
                Send invite
              </Button>
            </div>
            <p className="text-base-content/70 text-sm">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
