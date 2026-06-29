// Mosaic — Welcome email (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-590',
  type: 'Section',
  props: {},
  class: 'flex flex-col gap-4',
  name: 'Email body',
  children: [
    {
      id: 'msc-581',
      type: 'email_wordmark',
      props: {
        treatment: 'lockup',
        align: 'center',
        size: 'md',
      },
    },
    {
      id: 'msc-582',
      type: 'Heading',
      props: {
        level: 'h1',
        text: 'Welcome to {{site.name}} ✨',
      },
    },
    {
      id: 'msc-583',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Hi {{customer.firstName ?? "there"}} — thanks for joining {{site.name}}. Your AI workspace is ready: capture context, find answers, and let agents handle the busywork.',
      },
    },
    {
      id: 'msc-584',
      type: 'Text',
      props: {
        variant: 'body',
        text: 'Three ways to get started:',
      },
    },
    {
      id: 'msc-585',
      type: 'Text',
      props: {
        variant: 'body',
        text: '📋  Spin up your first workspace and drop in a doc or a project board.',
      },
    },
    {
      id: 'msc-586',
      type: 'Text',
      props: {
        variant: 'body',
        text: '🔍  Connect your tools so one search covers everything.',
      },
    },
    {
      id: 'msc-587',
      type: 'Text',
      props: {
        variant: 'body',
        text: '⚡  Build a Custom Agent to automate a task you do every week.',
      },
    },
    {
      id: 'msc-588',
      type: 'Button',
      props: {
        label: 'Open your workspace',
        href: '{{site.url}}',
      },
    },
    {
      id: 'msc-589',
      type: 'Text',
      props: {
        variant: 'meta',
        text: 'The AI workspace where your work comes together.',
      },
    },
  ],
};
