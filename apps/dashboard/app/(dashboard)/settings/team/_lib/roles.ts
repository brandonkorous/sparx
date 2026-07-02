import type { OrgRole } from '@sparx/auth';

// Human labels + one-line descriptions for the org roles (docs/114 §A.2). The
// canonical vocabulary + which roles are assignable live in @sparx/auth
// (org-roles.ts); this is presentation only.

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  builder: 'Builder',
  marketing: 'Marketing',
  support: 'Support',
  viewer: 'Viewer',
};

export const ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  owner: 'Full access including billing and ownership. Assigned to the workspace creator.',
  admin: 'Everything except billing and ownership settings.',
  editor: 'Products, content, orders, and customers. No team management.',
  builder: 'Site builder only.',
  marketing: 'Email, CMS, and analytics. No orders or customer PII.',
  support: 'Orders and customers, read-mostly.',
  viewer: 'Read-only across active sections.',
};

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

export function memberTypeLabel(memberType: string): string {
  switch (memberType) {
    case 'owner':
      return 'Owner';
    case 'consultant':
      return 'Consultant';
    default:
      return 'Staff';
  }
}
