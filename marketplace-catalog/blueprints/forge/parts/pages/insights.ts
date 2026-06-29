// Forge — Insights page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-602',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Insights',
  children: [
    {
      id: 'fg-587',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Page hero',
      children: [
        {
          id: 'fg-582',
          type: 'el:p',
          props: {},
          class: 'flex items-center gap-3 text-sm font-medium tracking-wide text-base-content/60',
          children: [
            {
              id: 'fg-580',
              type: 'el:span',
              props: {},
              class: 'inline-block h-2 w-2 shrink-0 rounded-full bg-[#C6F24E]',
            },
            {
              id: 'fg-581',
              type: 'el:span',
              props: {
                text: 'Insights',
              },
            },
          ],
        },
        {
          id: 'fg-585',
          type: 'el:h1',
          props: {},
          class:
            'font-heading max-w-4xl text-[2.5rem] font-medium leading-[1.02] tracking-tight text-[#ECE7DD] @2xl:text-6xl',
          children: [
            {
              id: 'fg-583',
              type: 'el:span',
              props: {
                text: '/',
              },
              class: 'mr-2 inline-block -skew-x-12 font-bold text-[#C6F24E] mr-3',
            },
            {
              id: 'fg-584',
              type: 'el:span',
              props: {
                text: 'Notes on brand, web & growth.',
              },
            },
          ],
        },
        {
          id: 'fg-586',
          type: 'el:p',
          props: {
            text: 'Field notes from the studio — what we’re learning about building brands and products that compound.',
          },
          class: 'max-w-2xl text-lg leading-relaxed text-base-content/70',
        },
      ],
    },
    {
      id: 'fg-589',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'Articles',
      children: [
        {
          id: 'fg-588',
          type: 'el:p',
          props: {
            text: 'Field notes are on the way — check back soon.',
          },
          class: 'text-base leading-relaxed text-base-content/60',
        },
      ],
    },
    {
      id: 'fg-601',
      type: 'Section',
      class: 'w-full bg-primary text-primary-content',
      props: {},
      name: 'Contact CTA',
      children: [
        {
          id: 'fg-601__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'fg-590',
              type: 'el:p',
              props: {
                text: 'Let’s work together',
              },
              class: 'font-heading text-sm font-medium tracking-wide text-[#15120D]/60',
            },
            {
              id: 'fg-593',
              type: 'el:h2',
              props: {},
              class:
                'font-heading max-w-4xl text-[2.75rem] font-medium leading-[0.98] tracking-tight text-[#15120D] @2xl:text-7xl',
              children: [
                {
                  id: 'fg-591',
                  type: 'el:span',
                  props: {
                    text: '/',
                  },
                  class: 'inline-block -skew-x-12 font-bold text-[#15120D] mr-2',
                },
                {
                  id: 'fg-592',
                  type: 'el:span',
                  props: {
                    text: 'Start something impactful.',
                  },
                },
              ],
            },
            {
              id: 'fg-599',
              type: 'el:div',
              props: {},
              class: 'mt-4 flex flex-wrap items-center justify-center gap-3',
              children: [
                {
                  id: 'fg-594',
                  type: 'el:a',
                  props: {
                    href: 'mailto:hello@forge.studio',
                    text: 'hello@forge.studio',
                  },
                  class: 'st-btn st-c-neutral st-v-solid st-btn--sz-md rounded-full',
                },
                {
                  id: 'fg-598',
                  type: 'el:a',
                  props: {
                    href: '/contact',
                  },
                  class:
                    'st-btn bg-[#15120D] text-[#ECE7DD] transition-colors hover:bg-black st-btn--sz-md rounded-full',
                  children: [
                    {
                      id: 'fg-597',
                      type: 'el:span',
                      props: {
                        text: 'Book a call',
                      },
                    },
                    {
                      id: 'fg-596',
                      type: 'el:svg',
                      props: {
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        strokeWidth: 2,
                      },
                      class: 'h-4 w-4',
                      children: [
                        {
                          id: 'fg-595',
                          type: 'el:path',
                          props: {
                            d: 'M5 12h14M13 6l6 6-6 6',
                            strokeLinecap: 'round',
                            strokeLinejoin: 'round',
                          },
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: 'fg-600',
              type: 'el:p',
              props: {
                text: 'Working with teams worldwide',
              },
              class: 'text-sm text-[#15120D]/60',
            },
          ],
        },
      ],
    },
  ],
};
