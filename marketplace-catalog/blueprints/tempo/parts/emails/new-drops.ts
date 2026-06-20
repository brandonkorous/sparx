// Tempo — New Drops email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-699',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'tmp-689',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'tmp-690',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'New drops just landed 🔥',
      },
    },
    {
      id: 'tmp-691',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — fresh styles hit {{site.name}} this week. Move fast; the best sizes go first.',
      },
    },
    {
      id: 'tmp-692',
      type: 'Text',
      props: {
        variant: 'body',
        text: '👟  Glide Boost — the daily trainer, reengineered.',
      },
    },
    {
      id: 'tmp-693',
      type: 'Text',
      props: {
        variant: 'body',
        text: '⚽  Strike Pro TF — turf-ready, cage-tested.',
      },
    },
    {
      id: 'tmp-694',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🧥  Field Track Jacket — the original, back in the line.',
      },
    },
    {
      id: 'tmp-695',
      type: 'Button',
      props: {
        label: 'Shop new arrivals',
        href: '{{site.url}}',
      },
    },
    {
      id: 'tmp-696',
      type: 'Divider',
      props: {},
    },
    {
      id: 'tmp-697',
      type: 'unsubscribe_link',
      props: {},
    },
    {
      id: 'tmp-698',
      type: 'physical_address',
      props: {},
    },
  ],
};
