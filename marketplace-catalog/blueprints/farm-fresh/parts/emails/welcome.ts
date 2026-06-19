// Farm Fresh — Welcome email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-451',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'ffb-446',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'ffb-447',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Welcome to the table 🌱',
      },
    },
    {
      id: 'ffb-448',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Thanks for joining Farm Fresh. You’ll be first to hear about seasonal menus, new flavors, and the occasional treat.',
      },
    },
    {
      id: 'ffb-449',
      type: 'Button',
      props: {
        label: 'Start an order',
        href: '/menu',
      },
      class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
    },
    {
      id: 'ffb-450',
      type: 'Text',
      props: {
        variant: 'meta',
        text: 'Here to deliver health — one bowl at a time.',
      },
    },
  ],
};
