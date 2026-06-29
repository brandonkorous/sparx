// Farm Fresh — Home page · Order (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-179',
  type: 'Section',
  class: 'w-full bg-accent text-accent-content',
  props: {},
  name: 'Order',
  children: [
    {
      id: 'ffb-179__c',
      type: 'Stack',
      class:
        'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
      props: {},
      children: [
        {
          id: 'ffb-174',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Ready to eat fresh?',
          },
          class: 'text-center text-4xl @3xl:text-5xl',
        },
        {
          id: 'ffb-175',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Order online for pickup or free local delivery — or join our list for seasonal menus, new flavors, and the occasional treat.',
          },
          class: 'text-center max-w-lg',
        },
        {
          id: 'ffb-176',
          type: 'Button',
          props: {
            label: 'Start an order',
            href: '/menu',
          },
          class: 'st-btn st-c-surface st-v-glass st-btn--sz-md',
        },
        {
          id: 'ffb-178',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col items-center w-full max-w-md',
          children: [
            {
              id: 'ffb-177',
              type: 'Signup',
              props: {
                cta: 'Sign up',
              },
            },
          ],
        },
      ],
    },
  ],
};
