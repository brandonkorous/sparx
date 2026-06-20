// Tempo — Welcome email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/tempo/.

export default {
  id: 'tmp-688',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'tmp-679',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'tmp-680',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Welcome to the Club »',
      },
    },
    {
      id: 'tmp-681',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — welcome to {{site.name}}. Your membership is live, and it pays for itself the first time you check out.',
      },
    },
    {
      id: 'tmp-682',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Here’s what you just unlocked:',
      },
    },
    {
      id: 'tmp-683',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🚚  Free shipping on every order and free 30-day returns.',
      },
    },
    {
      id: 'tmp-684',
      type: 'Text',
      props: {
        variant: 'body',
        text: '⚡  Early access to limited drops and members-only colorways.',
      },
    },
    {
      id: 'tmp-685',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🎁  Points on everything you buy, plus a birthday surprise.',
      },
    },
    {
      id: 'tmp-686',
      type: 'Button',
      props: {
        label: 'Start shopping',
        href: '{{site.url}}',
      },
    },
    {
      id: 'tmp-687',
      type: 'Text',
      props: {
        variant: 'meta',
        text: 'Built to move. Welcome to the team.',
      },
    },
  ],
};
