// Staff-user presentation for the operator console (user & site management).
// Membership status / role / member-type map to semantic Badge tones + human
// labels here so every user surface reads the same way. Tones are the shared
// semantic set (the `statusTone` vocabulary); these cover the membership-specific
// values the curated dictionary doesn't.

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Member.status — active | invited | suspended. */
export function membershipStatusTone(status: string): Tone {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  if (status === 'invited') return 'warning';
  return 'neutral';
}

export function membershipStatusLabel(status: string): string {
  const LABELS: Record<string, string> = {
    active: 'Active',
    invited: 'Invited',
    suspended: 'Suspended',
  };
  return LABELS[status] ?? status;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  builder: 'Builder',
  marketing: 'Marketing',
  support: 'Support',
  viewer: 'Viewer',
  api: 'API',
};
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** Owner reads as the standout role; the rest are neutral chips. */
export function roleTone(role: string): Tone {
  if (role === 'owner') return 'primary';
  if (role === 'admin') return 'info';
  return 'neutral';
}

const MEMBER_TYPE_LABELS: Record<string, string> = {
  owner: 'Owner',
  staff: 'Staff',
  consultant: 'Consultant',
};
export function memberTypeLabel(memberType: string): string {
  return MEMBER_TYPE_LABELS[memberType] ?? memberType;
}

/** The roles an operator can assign from the console (owner..viewer). */
export const ASSIGNABLE_ROLES = [
  'owner',
  'admin',
  'editor',
  'builder',
  'marketing',
  'support',
  'viewer',
] as const;
