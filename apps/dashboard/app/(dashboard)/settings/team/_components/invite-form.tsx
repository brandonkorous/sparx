'use client';

import * as React from 'react';
import {
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Stack,
  Text,
  toast,
} from '@sparx/ui';
import { UserPlus } from 'lucide-react';
import { ASSIGNABLE_ORG_ROLES, type OrgRole } from '@sparx/auth/org-roles';
import { inviteMember } from '../actions';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../_lib/roles';

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
      <CardContent className="pt-6">
        <form ref={formRef} onSubmit={onSubmit}>
          <Stack gap={4}>
            <Stack
              direction="row"
              gap={3}
              align="end"
              className="flex-col sm:flex-row sm:items-end"
            >
              <Stack gap={2} className="w-full sm:flex-1">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  placeholder="teammate@example.com"
                  required
                />
              </Stack>
              <Stack gap={2} className="w-full sm:w-48">
                <Label htmlFor="invite-role">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as OrgRole)}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ORG_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Stack>
              <Button
                type="submit"
                loading={pending}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                <UserPlus className="h-4 w-4" />
                Send invite
              </Button>
            </Stack>
            <Text size="sm" variant="muted">
              {ROLE_DESCRIPTIONS[role]}
            </Text>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}
