import type { ContentTypeDefinition } from '../types';

// A scheduled event — webinar, conference, launch, meetup. Routable so it can
// have a registration page.

export const eventType: ContentTypeDefinition = {
  key: 'event',
  name: 'Event',
  pluralName: 'Events',
  description: 'A scheduled event with start/end times, location, and registration.',
  urlPattern: '/events/{slug}',
  icon: 'calendar',
  schema: {
    fields: [
      { key: 'title', type: 'text', label: 'Title', required: true, max: 255 },
      { key: 'description', type: 'rich_text', label: 'Description', required: true },
      { key: 'startAt', type: 'datetime', label: 'Starts', required: true },
      { key: 'endAt', type: 'datetime', label: 'Ends' },
      {
        key: 'location',
        type: 'text',
        label: 'Location',
        max: 200,
        helpText: 'Venue and address, or the platform for a virtual event.',
      },
      { key: 'isVirtual', type: 'boolean', label: 'Virtual event' },
      { key: 'registrationUrl', type: 'url', label: 'Registration URL' },
      { key: 'featuredImage', type: 'asset', label: 'Featured image', accept: ['image/*'] },
    ],
  },
};
