// Mosaic — Request a demo page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-566',
  type: 'Section',
  props: {},
  class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-8 @3xl:p-16',
  name: 'Request a demo',
  children: [
    {
      id: 'msc-565',
      type: 'el:div',
      props: {},
      class: 'grid w-full grid-cols-1 gap-10 @3xl:grid-cols-2',
      children: [
        {
          id: 'msc-553',
          type: 'el:div',
          props: {},
          class: 'flex flex-col gap-5',
          children: [
            {
              id: 'msc-534',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'See Mosaic in action.',
              },
              class: 'text-4xl font-bold tracking-tight text-[#191918]',
            },
            {
              id: 'msc-535',
              type: 'el:p',
              props: {
                text: 'Tell us a bit about your team and we’ll walk you through how Mosaic brings your docs, projects, and agents together.',
              },
              class: 'max-w-md text-lg text-base-content/60',
            },
            {
              id: 'msc-545',
              type: 'el:ul',
              props: {},
              class: 'mt-1 flex flex-col gap-3',
              children: [
                {
                  id: 'msc-538',
                  type: 'el:li',
                  props: {},
                  class: 'flex items-start gap-3 text-sm text-base-content/80',
                  children: [
                    {
                      id: 'msc-536',
                      type: 'el:span',
                      props: {
                        text: '✓',
                      },
                      class:
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary',
                    },
                    {
                      id: 'msc-537',
                      type: 'el:span',
                      props: {
                        text: 'A tailored 30-minute walkthrough, not a generic pitch.',
                      },
                    },
                  ],
                },
                {
                  id: 'msc-541',
                  type: 'el:li',
                  props: {},
                  class: 'flex items-start gap-3 text-sm text-base-content/80',
                  children: [
                    {
                      id: 'msc-539',
                      type: 'el:span',
                      props: {
                        text: '✓',
                      },
                      class:
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary',
                    },
                    {
                      id: 'msc-540',
                      type: 'el:span',
                      props: {
                        text: 'Answers on security, SSO, and rollout for your org.',
                      },
                    },
                  ],
                },
                {
                  id: 'msc-544',
                  type: 'el:li',
                  props: {},
                  class: 'flex items-start gap-3 text-sm text-base-content/80',
                  children: [
                    {
                      id: 'msc-542',
                      type: 'el:span',
                      props: {
                        text: '✓',
                      },
                      class:
                        'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary',
                    },
                    {
                      id: 'msc-543',
                      type: 'el:span',
                      props: {
                        text: 'We’ll reply within one business day.',
                      },
                    },
                  ],
                },
              ],
            },
            {
              id: 'msc-552',
              type: 'el:div',
              props: {},
              class: 'mt-2 flex flex-col gap-1 text-sm text-base-content/70',
              children: [
                {
                  id: 'msc-548',
                  type: 'el:p',
                  props: {},
                  children: [
                    {
                      id: 'msc-546',
                      type: 'el:span',
                      props: {
                        text: 'Email — ',
                      },
                      class: 'font-medium text-[#191918]',
                    },
                    {
                      id: 'msc-547',
                      type: 'el:span',
                      props: {
                        text: 'sales@mosaic.example',
                      },
                    },
                  ],
                },
                {
                  id: 'msc-551',
                  type: 'el:p',
                  props: {},
                  children: [
                    {
                      id: 'msc-549',
                      type: 'el:span',
                      props: {
                        text: 'Sales — ',
                      },
                      class: 'font-medium text-[#191918]',
                    },
                    {
                      id: 'msc-550',
                      type: 'el:span',
                      props: {
                        text: '(555) 010-0142',
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          id: 'msc-564',
          type: 'el:form',
          props: {},
          class: 'flex flex-col gap-4 rounded-2xl border border-base-300 bg-base-100 p-6 @2xl:p-8',
          name: 'Demo request form',
          children: [
            {
              id: 'msc-555',
              type: 'Field',
              props: {
                label: 'Full name',
              },
              class: 'w-full',
              children: [
                {
                  id: 'msc-554',
                  type: 'Input',
                  props: {
                    type: 'text',
                    name: 'name',
                    placeholder: 'Jordan Avery',
                  },
                  class: 'st-c-primary st-fv-outline',
                },
              ],
            },
            {
              id: 'msc-557',
              type: 'Field',
              props: {
                label: 'Work email',
              },
              class: 'w-full',
              children: [
                {
                  id: 'msc-556',
                  type: 'Input',
                  props: {
                    type: 'email',
                    name: 'email',
                    placeholder: 'you@company.com',
                  },
                  class: 'st-c-primary st-fv-outline',
                },
              ],
            },
            {
              id: 'msc-559',
              type: 'Field',
              props: {
                label: 'Company',
              },
              class: 'w-full',
              children: [
                {
                  id: 'msc-558',
                  type: 'Input',
                  props: {
                    type: 'text',
                    name: 'company',
                    placeholder: 'Acme Inc.',
                  },
                  class: 'st-c-primary st-fv-outline',
                },
              ],
            },
            {
              id: 'msc-561',
              type: 'Field',
              props: {
                label: 'What would you like to see?',
              },
              class: 'w-full',
              children: [
                {
                  id: 'msc-560',
                  type: 'Textarea',
                  props: {
                    name: 'message',
                    placeholder: 'A few words about your team and goals…',
                  },
                  class: 'st-c-primary st-fv-outline',
                },
              ],
            },
            {
              id: 'msc-562',
              type: 'Button',
              props: {
                label: 'Request a demo',
              },
              class: 'st-btn st-c-primary st-v-solid st-btn--sz-md w-full',
            },
            {
              id: 'msc-563',
              type: 'el:p',
              props: {
                text: 'By submitting, you agree to be contacted about Mosaic. We respect your inbox.',
              },
              class: 'text-xs text-base-content/50',
            },
          ],
        },
      ],
    },
  ],
};
