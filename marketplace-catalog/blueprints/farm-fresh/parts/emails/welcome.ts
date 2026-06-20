// Farm Fresh — Welcome email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-456',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'ffb-447',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'ffb-448',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Welcome to the table 🌱',
      },
    },
    {
      id: 'ffb-449',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — thanks for joining {{site.name}}. You’re on the list for seasonal menus, new flavors, and the occasional treat.',
      },
    },
    {
      id: 'ffb-450',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Here’s what to expect:',
      },
    },
    {
      id: 'ffb-451',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🥣  First look at new bowls and seasonal specials.',
      },
    },
    {
      id: 'ffb-452',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🌾  Stories from the farms we source within 60 miles.',
      },
    },
    {
      id: 'ffb-453',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🎁  Member-only offers and the occasional surprise.',
      },
    },
    {
      id: 'ffb-454',
      type: 'Button',
      props: {
        label: 'See this week’s menu',
        href: '{{site.url}}',
      },
    },
    {
      id: 'ffb-455',
      type: 'Text',
      props: {
        variant: 'meta',
        text: 'Here to deliver health — one bowl at a time.',
      },
    },
  ],
};
