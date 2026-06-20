// Forge — Studio Notes email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-766',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'fg-756',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'fg-757',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Studio Notes from {{site.name}} ✦',
      },
    },
    {
      id: 'fg-758',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — a short note from the studio on what we’ve been making and thinking about.',
      },
    },
    {
      id: 'fg-759',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🚀  New work: a rebrand and product site we’re proud to show.',
      },
    },
    {
      id: 'fg-760',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🧭  New thinking: how the best brand systems survive growth.',
      },
    },
    {
      id: 'fg-761',
      type: 'Text',
      props: {
        variant: 'body',
        text: '📈  A field note on turning a launch into compounding pipeline.',
      },
    },
    {
      id: 'fg-762',
      type: 'Button',
      props: {
        label: 'Read the latest',
        href: '{{site.url}}',
      },
    },
    {
      id: 'fg-763',
      type: 'Divider',
      props: {},
    },
    {
      id: 'fg-764',
      type: 'unsubscribe_link',
      props: {},
    },
    {
      id: 'fg-765',
      type: 'physical_address',
      props: {},
    },
  ],
};
