import type { ContentTypeDefinition } from '../types';

// A team member / staff bio. Routable so each person can have a profile page;
// also bindable as a list for an "our team" grid.

export const teamMemberType: ContentTypeDefinition = {
  key: 'team_member',
  name: 'Team member',
  pluralName: 'Team',
  description: 'A staff or team member profile with role, bio, and photo.',
  urlPattern: '/team/{slug}',
  icon: 'user-round',
  schema: {
    fields: [
      { key: 'name', type: 'text', label: 'Name', required: true, max: 160 },
      { key: 'role', type: 'text', label: 'Role', required: true, max: 120 },
      { key: 'bio', type: 'rich_text', label: 'Bio' },
      { key: 'photo', type: 'asset', label: 'Photo', accept: ['image/*'] },
      { key: 'email', type: 'email', label: 'Email' },
      { key: 'linkedinUrl', type: 'url', label: 'LinkedIn URL' },
      {
        key: 'order',
        type: 'number',
        label: 'Order',
        integer: true,
        helpText: 'Lower numbers appear first in team listings.',
      },
    ],
  },
};
