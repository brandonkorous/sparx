import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasCapability, requireCapability } from '@sparx/operator-auth/next';
import { logOperatorAction } from '@sparx/operator-auth';
import { Badge, Card, Heading, Stack, Text } from '@sparx/ui';
import { OperatorApiError, type OperatorUserDetail } from '@sparx/operator';
import { operatorApi } from '@/lib/operator-api';
import { formatDate, formatRelative } from '@/lib/format';
import {
  memberTypeLabel,
  membershipStatusLabel,
  membershipStatusTone,
  roleLabel,
  roleTone,
} from '@/lib/users';
import { MembershipControls } from './_components/membership-controls';
import { PasswordResetButton } from './_components/password-reset-button';

const backLink = (
  <Link href="/sparx/users" className="text-base-content text-sm hover:underline">
    ← All users
  </Link>
);

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const operator = await requireCapability('user:read');
  const { id } = await params;

  try {
    await logOperatorAction({
      operatorId: operator.id,
      operatorEmail: operator.email,
      capability: 'user:read',
      action: 'user.detail.view',
    });
  } catch {
    // best-effort — a logging failure must never blank the page
  }

  let user: OperatorUserDetail | null = null;
  let error: string | null = null;
  try {
    user = await operatorApi().getUser(id, operator.id);
  } catch (err) {
    if (err instanceof OperatorApiError && err.status === 404) notFound();
    error = err instanceof OperatorApiError ? err.message : 'Could not reach api-rest.';
  }

  if (!user) {
    return (
      <Stack gap={6}>
        {backLink}
        <Card>
          <Text variant="muted">{error ?? 'User unavailable.'}</Text>
        </Card>
      </Stack>
    );
  }

  const canAct = hasCapability(operator, 'user:act');
  const label = user.name ?? user.email;

  return (
    <Stack gap={6}>
      <Stack gap={2}>
        {backLink}
        <Stack direction="row" align="center" gap={3} className="flex-wrap">
          <Heading level={1}>{label}</Heading>
          <Badge color={roleTone(user.role)} variant="soft">
            {roleLabel(user.role)}
          </Badge>
          {user.emailVerified ? (
            <Badge color="success" variant="soft">
              Verified
            </Badge>
          ) : (
            <Badge color="warning" variant="soft">
              Unverified
            </Badge>
          )}
          {canAct ? (
            <div className="ml-auto">
              <PasswordResetButton
                userId={id}
                homeTenantId={user.homeTenantId}
                email={user.email}
              />
            </div>
          ) : null}
        </Stack>
        <Text variant="muted">
          {user.email} · Home{' '}
          {user.homeTenantName ? (
            <Link
              href={`/sparx/tenants/${user.homeTenantId}`}
              className="text-module hover:underline"
            >
              {user.homeTenantName}
            </Link>
          ) : (
            (user.homeTenantSlug ?? '—')
          )}{' '}
          · Joined {formatDate(user.createdAt)} · Last seen{' '}
          {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'never'}
        </Text>
      </Stack>

      <Stack gap={3}>
        <Heading level={2}>
          Tenants{' '}
          <Text as="span" size="sm" variant="muted">
            ({user.memberships.length})
          </Text>
        </Heading>
        {user.memberships.length === 0 ? (
          <Card>
            <Text variant="muted">This user has no organization memberships.</Text>
          </Card>
        ) : (
          user.memberships.map((m) => (
            <Card key={m.tenantId}>
              <Stack gap={3}>
                <Stack direction="row" align="center" gap={3} className="flex-wrap">
                  {m.tenantName ? (
                    <Link
                      href={`/sparx/tenants/${m.tenantId}`}
                      className="text-base-content font-medium hover:underline"
                    >
                      {m.tenantName}
                    </Link>
                  ) : (
                    <Text className="font-medium">{m.tenantSlug ?? m.tenantId}</Text>
                  )}
                  <Badge color={roleTone(m.role)} variant="soft" size="sm">
                    {roleLabel(m.role)}
                  </Badge>
                  <Badge color={membershipStatusTone(m.status)} variant="soft" size="sm">
                    {membershipStatusLabel(m.status)}
                  </Badge>
                  <Text size="sm" variant="muted">
                    {memberTypeLabel(m.memberType)} · Joined {formatDate(m.createdAt)}
                  </Text>
                </Stack>
                {canAct ? (
                  <MembershipControls userId={id} userLabel={label} membership={m} />
                ) : null}
              </Stack>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  );
}
