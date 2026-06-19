// Farm Fresh — Catering page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-330',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Catering',
  children: [
    {
      id: 'ffb-312',
      type: 'Section',
      class: 'w-full flex items-center justify-center bg-primary text-primary-content min-h-[50vh]',
      props: {},
      name: 'Catering hero',
      children: [
        {
          id: 'ffb-312__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-310',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'Catering & events',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-311',
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
      id: 'ffb-325',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-6 p-8 @3xl:p-16',
      name: 'Catering options',
      children: [
        {
          id: 'ffb-316',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
          children: [
            {
              id: 'ffb-313',
              type: 'Text',
              props: {
                variant: 'body',
                text: '🥣',
              },
              class:
                'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
            },
            {
              id: 'ffb-314',
              type: 'Heading',
              props: {
                level: 'h3',
                text: 'Bowl bars',
              },
              class: 'text-center text-lg',
            },
            {
              id: 'ffb-315',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Build-your-own açaí & smoothie stations for any crowd.',
              },
              class: 'text-center text-sm',
            },
          ],
        },
        {
          id: 'ffb-320',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
          children: [
            {
              id: 'ffb-317',
              type: 'Text',
              props: {
                variant: 'body',
                text: '🥗',
              },
              class:
                'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
            },
            {
              id: 'ffb-318',
              type: 'Heading',
              props: {
                level: 'h3',
                text: 'Grain platters',
              },
              class: 'text-center text-lg',
            },
            {
              id: 'ffb-319',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Seasonal salad and grain platters, portioned and labeled.',
              },
              class: 'text-center text-sm',
            },
          ],
        },
        {
          id: 'ffb-324',
          type: 'Stack',
          props: {},
          class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-center text-center',
          children: [
            {
              id: 'ffb-321',
              type: 'Text',
              props: {
                variant: 'body',
                text: '🚲',
              },
              class:
                'h-16 w-16 bg-base-200 text-3xl shrink-0 inline-flex items-center justify-center rounded-full leading-none',
            },
            {
              id: 'ffb-322',
              type: 'Heading',
              props: {
                level: 'h3',
                text: 'On-time delivery',
              },
              class: 'text-center text-lg',
            },
            {
              id: 'ffb-323',
              type: 'Text',
              props: {
                variant: 'meta',
                text: 'Set up and delivered fresh, in compostable packaging.',
              },
              class: 'text-center text-sm',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-329',
      type: 'Section',
      class: 'w-full bg-primary text-primary-content',
      props: {},
      name: 'Catering CTA',
      children: [
        {
          id: 'ffb-329__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-326',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Plan your event',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-327',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Tell us the date, the headcount, and the vibe — we’ll handle the fresh part.',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-328',
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
