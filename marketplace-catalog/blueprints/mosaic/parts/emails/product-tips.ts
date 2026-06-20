// Mosaic — Product Tips email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-616',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'msc-606',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'msc-607',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'New in {{site.name}} this month 🚀',
      },
    },
    {
      id: 'msc-608',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — a few things we shipped to help your team move faster.',
      },
    },
    {
      id: 'msc-609',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🤖  Custom Agents can now answer from your whole knowledge base.',
      },
    },
    {
      id: 'msc-610',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🔍  Enterprise Search spans docs, chats, and connected drives.',
      },
    },
    {
      id: 'msc-611',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🎙️  AI Meeting Notes captures decisions and action items automatically.',
      },
    },
    {
      id: 'msc-612',
      type: 'Button',
      props: {
        label: 'See what’s new',
        href: '{{site.url}}',
      },
    },
    {
      id: 'msc-613',
      type: 'Divider',
      props: {},
    },
    {
      id: 'msc-614',
      type: 'unsubscribe_link',
      props: {},
    },
    {
      id: 'msc-615',
      type: 'physical_address',
      props: {},
    },
  ],
};
