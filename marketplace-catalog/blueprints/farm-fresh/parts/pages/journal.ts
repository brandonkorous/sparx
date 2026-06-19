// Farm Fresh — Journal page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/farm-fresh/.

export default {
  id: 'ffb-386',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Journal',
  children: [
    {
      id: 'ffb-368',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Journal intro',
      children: [
        {
          id: 'ffb-368__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-2 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'ffb-366',
              type: 'Heading',
              props: {
                level: 'h1',
                size: 'display',
                text: 'The Journal',
              },
              class: 'text-center',
            },
            {
              id: 'ffb-367',
              type: 'Text',
              props: {
                variant: 'body',
                text: 'Notes from the counter — how we source, what’s in season, and the people behind the bowls.',
              },
              class: 'text-center max-w-xl',
            },
          ],
        },
      ],
    },
    {
      id: 'ffb-385',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site grid grid-cols-1 @3xl:grid-cols-2 gap-6 p-8 @3xl:p-16',
      name: 'Posts',
      children: [
        {
          id: 'ffb-376',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
          children: [
            {
              id: 'ffb-370',
              type: 'Section',
              props: {},
              class:
                'w-full bg-primary text-primary-content flex flex-col justify-center items-center text-center h-44 rounded-b-none',
              children: [
                {
                  id: 'ffb-369',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '🥗',
                  },
                  class: 'text-6xl leading-none',
                },
              ],
            },
            {
              id: 'ffb-375',
              type: 'Stack',
              props: {},
              class:
                'mx-auto w-full max-w-site flex flex-col gap-4 justify-between items-start p-6 flex-1',
              children: [
                {
                  id: 'ffb-373',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-371',
                      type: 'Heading',
                      props: {
                        level: 'h3',
                        text: 'Why we source within 60 miles',
                      },
                      class: 'text-xl',
                    },
                    {
                      id: 'ffb-372',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'Fresher produce, a smaller footprint, and farmers we know by name.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/70',
                    },
                  ],
                },
                {
                  id: 'ffb-374',
                  type: 'Button',
                  props: {
                    label: 'Read article →',
                    href: '/blog/sourcing-within-60-miles',
                  },
                  class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                },
              ],
            },
          ],
        },
        {
          id: 'ffb-384',
          type: 'Card',
          props: {},
          class:
            'mx-auto w-full max-w-site rounded-box flex flex-col overflow-hidden bg-white shadow-lg border border-base-300 st-hover--lift',
          children: [
            {
              id: 'ffb-378',
              type: 'Section',
              props: {},
              class:
                'w-full bg-accent text-accent-content flex flex-col justify-center items-center text-center h-44 rounded-b-none',
              children: [
                {
                  id: 'ffb-377',
                  type: 'Text',
                  props: {
                    variant: 'body',
                    text: '🍓',
                  },
                  class: 'text-6xl leading-none',
                },
              ],
            },
            {
              id: 'ffb-383',
              type: 'Stack',
              props: {},
              class:
                'mx-auto w-full max-w-site flex flex-col gap-4 justify-between items-start p-6 flex-1',
              children: [
                {
                  id: 'ffb-381',
                  type: 'Stack',
                  props: {},
                  class: 'mx-auto w-full max-w-site flex flex-col gap-2 items-start',
                  children: [
                    {
                      id: 'ffb-379',
                      type: 'Heading',
                      props: {
                        level: 'h3',
                        text: 'Eating with the seasons',
                      },
                      class: 'text-xl',
                    },
                    {
                      id: 'ffb-380',
                      type: 'Text',
                      props: {
                        variant: 'body',
                        text: 'How our menu shifts with what the farms are picking.',
                      },
                      class: 'text-sm leading-relaxed text-base-content/70',
                    },
                  ],
                },
                {
                  id: 'ffb-382',
                  type: 'Button',
                  props: {
                    label: 'Read article →',
                    href: '/blog/eating-with-the-seasons',
                  },
                  class: 'st-btn st-c-primary st-v-soft st-btn--sz-md',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
