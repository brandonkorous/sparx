// Forge — Welcome email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-755',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'fg-746',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'fg-747',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Thanks — we’ll be in touch 👋',
      },
    },
    {
      id: 'fg-748',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — thanks for reaching out to {{site.name}}. Your note landed with our team and we’ll reply within one business day.',
      },
    },
    {
      id: 'fg-749',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'In the meantime, here’s what happens next:',
      },
    },
    {
      id: 'fg-750',
      type: 'Text',
      props: {
        variant: 'body',
        text: '📥  We read your note and route it to the right lead.',
      },
    },
    {
      id: 'fg-751',
      type: 'Text',
      props: {
        variant: 'body',
        text: '📞  A 30-minute intro call to understand your goals.',
      },
    },
    {
      id: 'fg-752',
      type: 'Text',
      props: {
        variant: 'body',
        text: '📝  A tailored proposal, scope, and timeline.',
      },
    },
    {
      id: 'fg-753',
      type: 'Button',
      props: {
        label: 'See our work',
        href: '{{site.url}}',
      },
    },
    {
      id: 'fg-754',
      type: 'Text',
      props: {
        variant: 'meta',
        text: 'Impactful brands & websites. Engineered growth.',
      },
    },
  ],
};
