// Farm Fresh — Home page · Hero (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-40',
  type: 'Section',
  props: {},
  class:
    'w-full mx-auto w-full max-w-site flex flex-col justify-center items-center p-8 @3xl:p-16 text-center',
  name: 'Hero',
  children: [
    {
      id: 'ffb-39',
      type: 'Section',
      props: {},
      class:
        'rounded-box bg-accent text-accent-content flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center w-fit rounded-box shadow-lg',
      children: [
        {
          id: 'ffb-33',
          type: 'Heading',
          props: {
            level: 'h2',
            text: '🍓',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-34',
          type: 'Heading',
          props: {
            level: 'h1',
            size: 'display',
            text: 'Here to deliver health',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-35',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Balanced, nutritious bowls made with local ingredients — without any chemicals or preservatives.',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-38',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col @3xl:flex-row gap-2 justify-center',
          children: [
            {
              id: 'ffb-36',
              type: 'Button',
              props: {
                label: 'Order Online',
                href: '/menu',
              },
              class: 'st-btn st-c-secondary st-v-solid st-btn--sz-md',
            },
            {
              id: 'ffb-37',
              type: 'Button',
              props: {
                label: 'See the Menu',
                href: '/menu',
              },
              class: 'st-btn st-c-surface st-v-glass st-btn--sz-md',
            },
          ],
        },
      ],
    },
  ],
};
