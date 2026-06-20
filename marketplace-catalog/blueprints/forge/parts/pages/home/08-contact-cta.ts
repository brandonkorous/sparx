// Forge — Home page · Contact CTA (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-308',
  type: 'Section',
  class: 'w-full bg-primary text-primary-content',
  props: {},
  name: 'Contact CTA',
  children: [
    {
      id: 'fg-308__c',
      type: 'Stack',
      class:
        'mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
      props: {},
      children: [
        {
          id: 'fg-297',
          type: 'el:p',
          props: {
            text: 'Let’s work together',
          },
          class: 'font-heading text-sm font-medium tracking-wide text-[#15120D]/60',
        },
        {
          id: 'fg-300',
          type: 'el:h2',
          props: {},
          class:
            'font-heading max-w-4xl text-[2.75rem] font-medium leading-[0.98] tracking-tight text-[#15120D] @2xl:text-7xl',
          children: [
            {
              id: 'fg-298',
              type: 'el:span',
              props: {
                text: '/',
              },
              class: 'inline-block -skew-x-12 font-bold text-[#15120D] mr-2',
            },
            {
              id: 'fg-299',
              type: 'el:span',
              props: {
                text: 'Start something impactful.',
              },
            },
          ],
        },
        {
          id: 'fg-306',
          type: 'el:div',
          props: {},
          class: 'mt-4 flex flex-wrap items-center justify-center gap-3',
          children: [
            {
              id: 'fg-301',
              type: 'el:a',
              props: {
                href: 'mailto:hello@forge.studio',
                text: 'hello@forge.studio',
              },
              class: 'st-btn st-c-neutral st-v-solid st-btn--sz-md rounded-full',
            },
            {
              id: 'fg-305',
              type: 'el:a',
              props: {
                href: '/contact',
              },
              class:
                'st-btn bg-[#15120D] text-[#ECE7DD] transition-colors hover:bg-black st-btn--sz-md rounded-full',
              children: [
                {
                  id: 'fg-304',
                  type: 'el:span',
                  props: {
                    text: 'Book a call',
                  },
                },
                {
                  id: 'fg-303',
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
                      id: 'fg-302',
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
          id: 'fg-307',
          type: 'el:p',
          props: {
            text: 'Working with teams worldwide',
          },
          class: 'text-sm text-[#15120D]/60',
        },
      ],
    },
  ],
};
