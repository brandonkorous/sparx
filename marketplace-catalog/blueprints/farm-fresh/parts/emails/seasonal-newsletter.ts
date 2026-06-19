// Farm Fresh — Seasonal Newsletter email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-466',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'ffb-456',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'ffb-457',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Fresh this week 🌿',
      },
    },
    {
      id: 'ffb-458',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — the counter’s looking good. Here’s what’s in season at {{site.name}} and worth a trip.',
      },
    },
    {
      id: 'ffb-459',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🍓  Strawberry Fields is back — local berries over a creamy banana base.',
      },
    },
    {
      id: 'ffb-460',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🥗  Harvest Kale with roasted squash, quinoa and pomegranate.',
      },
    },
    {
      id: 'ffb-461',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🥤  Cold-pressed smoothies, blended to order and never from concentrate.',
      },
    },
    {
      id: 'ffb-462',
      type: 'Button',
      props: {
        label: 'Order for pickup or delivery',
        href: '{{site.url}}',
      },
    },
    {
      id: 'ffb-463',
      type: 'Divider',
      props: {},
    },
    {
      id: 'ffb-464',
      type: 'unsubscribe_link',
      props: {},
    },
    {
      id: 'ffb-465',
      type: 'physical_address',
      props: {},
    },
  ],
};
