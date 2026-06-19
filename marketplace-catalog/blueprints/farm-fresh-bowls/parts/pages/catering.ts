// Farm Fresh Bowls — Catering page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh-bowls/.

export default {
  id: 'ffb-312',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Catering',
  children: [
    {
      id: 'ffb-297',
      type: 'Section',
      class: 'w-full flex items-center justify-center bg-primary text-primary-content min-h-[50vh]',
      props: {},
      name: 'Catering hero',
      children: [
        {
          id: 'ffb-297__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-295',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'Catering & events',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-296',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Bowl bars, smoothie stations and grain platters — built fresh, delivered on time.',
              },
              class: 'text-center',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-307',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
      name: 'Catering options',
      children: [
        {
          id: 'ffb-300',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
          children: [
            {
              id: 'ffb-298',
              type: 'Heading',
              props: {
                level: 'h3',
                text: '🥣  Bowl bars',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-299',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Build-your-own açaí & smoothie stations for any crowd.',
              },
              class: 'text-center',
            },
          ],
        },
        {
          id: 'ffb-303',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
          children: [
            {
              id: 'ffb-301',
              type: 'Heading',
              props: {
                level: 'h3',
                text: '🥗  Grain platters',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-302',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Seasonal salad and grain platters, portioned and labeled.',
              },
              class: 'text-center',
            },
          ],
        },
        {
          id: 'ffb-306',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box bg-base-200 flex flex-col gap-2 items-center p-6 @3xl:p-10 text-center',
          children: [
            {
              id: 'ffb-304',
              type: 'Heading',
              props: {
                level: 'h3',
                text: '🚲  On-time delivery',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-305',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Set up and delivered fresh, in compostable packaging.',
              },
              class: 'text-center',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-311',
      type: 'Section',
      class: 'w-full bg-primary text-primary-content',
      props: {},
      name: 'Catering CTA',
      children: [
        {
          id: 'ffb-311__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-308',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Plan your event',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-309',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Tell us the date, the headcount, and the vibe — we’ll handle the fresh part.',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-310',
              type: 'Signup',
              props: {
                cta: 'Request a quote',
              },
            },
          ],
        },
      ],
    },
  ],
};
