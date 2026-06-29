// Mosaic — Product Tips email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-601',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'msc-591',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'msc-592',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'New in {{site.name}} this month 🚀',
      },
    },
    {
      id: 'msc-593',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — a few things we shipped to help your team move faster.',
      },
    },
    {
      id: 'msc-594',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🤖  Custom Agents can now answer from your whole knowledge base.',
      },
    },
    {
      id: 'msc-595',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🔍  Enterprise Search spans docs, chats, and connected drives.',
      },
    },
    {
      id: 'msc-596',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🎙️  AI Meeting Notes captures decisions and action items automatically.',
      },
    },
    {
      id: 'msc-597',
      type: 'Button',
      props: {
        label: 'See what’s new',
        href: '{{site.url}}',
      },
    },
    {
      id: 'msc-598',
      type: 'Divider',
      props: {},
    },
    {
      id: 'msc-599',
      type: 'unsubscribe_link',
      props: {},
    },
    {
      id: 'msc-600',
      type: 'physical_address',
      props: {},
    },
  ],
};
