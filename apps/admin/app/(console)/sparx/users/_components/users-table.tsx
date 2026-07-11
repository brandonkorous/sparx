import Link from 'next/link';
import {
  Badge,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Text,
} from '@sparx/ui';
import type { OperatorUserListItem } from '@sparx/operator';
import { formatRelative } from '@/lib/format';
import { roleLabel, roleTone } from '@/lib/users';

// The cross-tenant staff-user roster, rendered read-only. Row click-through opens
// the user detail; the home tenant links to that tenant's detail. Verification +
// role read as semantic badges so the list stays scannable.
export function UsersTable({ users }: { users: OperatorUserListItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Home tenant</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Tenants</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Last seen</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Stack gap={0}>
                <Link
                  href={`/sparx/users/${user.id}`}
                  className="text-base-content font-medium hover:underline"
                >
                  {user.name ?? user.email}
                </Link>
                <Text size="xs" variant="muted">
                  {user.email}
                </Text>
              </Stack>
            </TableCell>
            <TableCell>
              {user.homeTenantName ? (
                <Link
                  href={`/sparx/tenants/${user.homeTenantId}`}
                  className="text-module text-sm hover:underline"
                >
                  {user.homeTenantName}
                </Link>
              ) : (
                <Text size="sm" variant="muted">
                  {user.homeTenantSlug ?? '—'}
                </Text>
              )}
            </TableCell>
            <TableCell>
              <Badge color={roleTone(user.role)} variant="soft" size="sm">
                {roleLabel(user.role)}
              </Badge>
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {user.membershipCount}
              </Text>
            </TableCell>
            <TableCell>
              {user.emailVerified ? (
                <Badge color="success" variant="soft" size="sm">
                  Verified
                </Badge>
              ) : (
                <Badge color="warning" variant="soft" size="sm">
                  Unverified
                </Badge>
              )}
            </TableCell>
            <TableCell>
              <Text size="sm" variant="muted">
                {user.lastLoginAt ? formatRelative(user.lastLoginAt) : 'Never'}
              </Text>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
