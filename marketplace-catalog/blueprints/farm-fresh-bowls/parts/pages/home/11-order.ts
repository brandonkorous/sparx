// Farm Fresh Bowls — Home page · Order (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-242',
  type: 'Section',
  class: 'w-full bg-accent text-accent-content',
  props: {},
  name: 'Order',
  children: [
    {
      id: 'ffb-242__c',
      type: 'Stack',
      class:
        'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
      props: {},
      children: [
        {
          id: 'ffb-238',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Ready to eat fresh?',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-239',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Order online for pickup or free local delivery — or join our list for seasonal menus, new flavors, and the occasional treat.',
          },
          class: 'text-center',
        },
        {
          id: 'ffb-240',
          type: 'Button',
          props: {
            label: 'Start an order',
            href: '/menu',
          },
          class: 'st-btn st-c-surface st-v-glass st-btn--sz-md',
        },
        {
          id: 'ffb-241',
          type: 'Signup',
          props: {
            cta: 'Sign up',
          },
        },
      ],
    },
  ],
};
