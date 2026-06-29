// Farm Fresh — Home page · Catering & gifts (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-173',
  type: 'Section',
  props: {},
  class: 'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 p-8 @3xl:p-16',
  name: 'Catering & gifts',
  children: [
    {
      id: 'ffb-168',
      type: 'Card',
      props: {},
      class:
        'mx-auto w-full max-w-site rounded-box bg-primary text-primary-content flex flex-col gap-4 justify-between items-start p-9 st-hover--lift',
      children: [
        {
          id: 'ffb-165',
          type: 'Heading',
          props: {
            level: 'h3',
            text: '🥗 Catering & Events',
          },
        },
        {
          id: 'ffb-166',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Bowl bars, smoothie stations and grain platters for offices, weddings and team workouts. Built fresh, delivered on time.',
          },
        },
        {
          id: 'ffb-167',
          type: 'Button',
          props: {
            label: 'Plan an event',
            href: '/catering',
          },
          class: 'st-btn st-c-accent st-v-solid st-btn--sz-md',
        },
      ],
    },
    {
      id: 'ffb-172',
      type: 'Card',
      props: {},
      class:
        'mx-auto w-full max-w-site rounded-box bg-secondary text-secondary-content flex flex-col gap-4 justify-between items-start p-9 st-hover--lift',
      children: [
        {
          id: 'ffb-169',
          type: 'Heading',
          props: {
            level: 'h3',
            text: '🎁 Gift Cards',
          },
        },
        {
          id: 'ffb-170',
          type: 'Text',
          props: {
            variant: 'body',
            text: 'Give the gift of good food. Digital gift cards arrive instantly and never expire — redeemable at both locations and online.',
          },
        },
        {
          id: 'ffb-171',
          type: 'Button',
          props: {
            label: 'Buy a gift card',
            href: '/catering',
          },
          class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
        },
      ],
    },
  ],
};
