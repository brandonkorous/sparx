'use client';

import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldLabel,
  Select,
} from '@wizeworks/silicaui-react';
import { toast } from '@sparx/ui';
import { rule, rules, useFieldValidation } from '@sparx/forms';
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
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<OrgRole>('editor');
  const [pending, startTransition] = React.useTransition();

  const v = useFieldValidation(
    { email },
    { email: rules(rule.required('Enter an email address.'), rule.email()) }
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!v.validate()) return;
    const formData = new FormData(e.currentTarget);
    formData.set('role', role);
    startTransition(async () => {
      const result = await inviteMember(formData);
      if (result.ok) {
        toast.success('Invitation sent');
        formRef.current?.reset();
        setEmail('');
        setRole('editor');
      } else {
        const msg = result.error ?? 'Could not send the invitation.';
        if (/email|invit|member|exist/i.test(msg)) {
          v.setServerErrors({ email: msg });
        } else {
          toast.error(msg);
        }
      }
    });
  }

  return (
    <Card>
      <CardBody>
        <form ref={formRef} onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-end">
              <Field {...v.field('email')} className="w-full sm:flex-1">
                <FieldLabel required>Email address</FieldLabel>
                <FieldControl
                  name="email"
                  type="email"
                  autoComplete="off"
                  placeholder="teammate@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...v.control('email')}
                />
              </Field>
              <Field className="w-full sm:w-48">
                <FieldLabel>Role</FieldLabel>
                <Select
                  value={role}
                  onValueChange={(val) => setRole(val as OrgRole)}
                  items={ROLE_ITEMS}
                />
              </Field>
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
            <p className="text-base-content text-sm">{ROLE_DESCRIPTIONS[role]}</p>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
