// Forge — Contact page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/forge/.

export default {
  id: 'fg-716',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Contact',
  children: [
    {
      id: 'fg-673',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-4 items-start p-8 @3xl:p-16',
      name: 'Page hero',
      children: [
        {
          id: 'fg-668',
          type: 'el:p',
          props: {},
          class: 'flex items-center gap-3 text-sm font-medium tracking-wide text-base-content/60',
          children: [
            {
              id: 'fg-666',
              type: 'el:span',
              props: {},
              class: 'inline-block h-2 w-2 shrink-0 rounded-full bg-[#C6F24E]',
            },
            {
              id: 'fg-667',
              type: 'el:span',
              props: {
                text: 'Contact',
              },
            },
          ],
        },
        {
          id: 'fg-671',
          type: 'el:h1',
          props: {},
          class:
            'font-heading max-w-4xl text-[2.5rem] font-medium leading-[1.02] tracking-tight text-[#ECE7DD] @2xl:text-6xl',
          children: [
            {
              id: 'fg-669',
              type: 'el:span',
              props: {
                text: '/',
              },
              class: 'mr-2 inline-block -skew-x-12 font-bold text-[#C6F24E] mr-3',
            },
            {
              id: 'fg-670',
              type: 'el:span',
              props: {
                text: 'Let’s talk.',
              },
            },
          ],
        },
        {
          id: 'fg-672',
          type: 'el:p',
          props: {
            text: 'Tell us about your project and what success looks like. We reply within one business day.',
          },
          class: 'max-w-2xl text-lg leading-relaxed text-base-content/70',
        },
      ],
    },
    {
      id: 'fg-715',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 p-8 @3xl:p-16',
      name: 'Inquiry',
      children: [
        {
          id: 'fg-714',
          type: 'el:div',
          props: {},
          class: 'grid w-full grid-cols-1 gap-10 @3xl:grid-cols-[1.3fr_1fr]',
          children: [
            {
              id: 'fg-691',
              type: 'el:form',
              props: {},
              class:
                'flex flex-col gap-4 rounded-[1.5rem] border border-white/10 bg-[#221D16] p-6 @2xl:p-8',
              name: 'Contact form',
              children: [
                {
                  id: 'fg-675',
                  type: 'Field',
                  props: {
                    label: 'Full name',
                  },
                  class: 'w-full',
                  children: [
                    {
                      id: 'fg-674',
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
                  id: 'fg-677',
                  type: 'Field',
                  props: {
                    label: 'Work email',
                  },
                  class: 'w-full',
                  children: [
                    {
                      id: 'fg-676',
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
                  id: 'fg-679',
                  type: 'Field',
                  props: {
                    label: 'Company',
                  },
                  class: 'w-full',
                  children: [
                    {
                      id: 'fg-678',
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
                  id: 'fg-686',
                  type: 'Field',
                  props: {
                    label: 'Project budget',
                  },
                  class: 'w-full',
                  children: [
                    {
                      id: 'fg-685',
                      type: 'el:select',
                      props: {
                        name: 'budget',
                      },
                      class:
                        'w-full rounded-xl border border-white/15 bg-[#1A1611] px-4 py-3 text-sm text-[#ECE7DD]',
                      children: [
                        {
                          id: 'fg-680',
                          type: 'el:option',
                          props: {
                            value: '',
                            text: 'Select a range',
                          },
                        },
                        {
                          id: 'fg-681',
                          type: 'el:option',
                          props: {
                            value: 'under-25k',
                            text: 'Under $25k',
                          },
                        },
                        {
                          id: 'fg-682',
                          type: 'el:option',
                          props: {
                            value: '25-50k',
                            text: '$25k – $50k',
                          },
                        },
                        {
                          id: 'fg-683',
                          type: 'el:option',
                          props: {
                            value: '50-100k',
                            text: '$50k – $100k',
                          },
                        },
                        {
                          id: 'fg-684',
                          type: 'el:option',
                          props: {
                            value: '100k-plus',
                            text: '$100k+',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'fg-688',
                  type: 'Field',
                  props: {
                    label: 'About the project',
                  },
                  class: 'w-full',
                  children: [
                    {
                      id: 'fg-687',
                      type: 'Textarea',
                      props: {
                        name: 'message',
                        placeholder: 'Goals, timeline, and what you’re hoping to achieve…',
                      },
                      class: 'st-c-primary st-fv-outline',
                    },
                  ],
                },
                {
                  id: 'fg-689',
                  type: 'Button',
                  props: {
                    label: 'Send inquiry',
                  },
                  class: 'st-btn st-c-primary st-v-solid st-btn--sz-md w-full rounded-full',
                },
                {
                  id: 'fg-690',
                  type: 'el:p',
                  props: {
                    text: 'By submitting, you agree to be contacted about your inquiry. We respect your inbox.',
                  },
                  class: 'text-xs text-base-content/50',
                },
              ],
            },
            {
              id: 'fg-713',
              type: 'el:div',
              props: {},
              class: 'flex flex-col gap-6',
              children: [
                {
                  id: 'fg-694',
                  type: 'el:div',
                  props: {},
                  children: [
                    {
                      id: 'fg-692',
                      type: 'el:p',
                      props: {
                        text: 'Email',
                      },
                      class: 'text-sm font-medium text-base-content/50',
                    },
                    {
                      id: 'fg-693',
                      type: 'el:a',
                      props: {
                        href: 'mailto:hello@forge.studio',
                        text: 'hello@forge.studio',
                      },
                      class:
                        'mt-1 inline-block font-heading text-lg text-[#ECE7DD] transition-colors hover:text-[#C6F24E]',
                    },
                  ],
                },
                {
                  id: 'fg-697',
                  type: 'el:div',
                  props: {},
                  children: [
                    {
                      id: 'fg-695',
                      type: 'el:p',
                      props: {
                        text: 'New business',
                      },
                      class: 'text-sm font-medium text-base-content/50',
                    },
                    {
                      id: 'fg-696',
                      type: 'el:a',
                      props: {
                        href: 'mailto:newbiz@forge.studio',
                        text: 'newbiz@forge.studio',
                      },
                      class:
                        'mt-1 inline-block font-heading text-lg text-[#ECE7DD] transition-colors hover:text-[#C6F24E]',
                    },
                  ],
                },
                {
                  id: 'fg-700',
                  type: 'el:div',
                  props: {},
                  children: [
                    {
                      id: 'fg-698',
                      type: 'el:p',
                      props: {
                        text: 'Studio',
                      },
                      class: 'text-sm font-medium text-base-content/50',
                    },
                    {
                      id: 'fg-699',
                      type: 'el:p',
                      props: {
                        text: 'Remote-first · Working worldwide',
                      },
                      class: 'mt-1 font-heading text-lg text-[#ECE7DD]',
                    },
                  ],
                },
                {
                  id: 'fg-712',
                  type: 'el:div',
                  props: {},
                  class: 'mt-2 rounded-[1.5rem] border border-white/10 bg-[#221D16] p-6',
                  children: [
                    {
                      id: 'fg-701',
                      type: 'el:h3',
                      props: {
                        text: 'What happens next',
                      },
                      class: 'font-heading text-lg font-semibold text-[#ECE7DD]',
                    },
                    {
                      id: 'fg-711',
                      type: 'el:ul',
                      props: {},
                      class: 'mt-4 flex flex-col gap-3',
                      children: [
                        {
                          id: 'fg-704',
                          type: 'el:li',
                          props: {},
                          class: 'flex items-start gap-3 text-sm text-base-content/70',
                          children: [
                            {
                              id: 'fg-702',
                              type: 'el:span',
                              props: {
                                text: '✓',
                              },
                              class:
                                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C6F24E]/15 text-xs font-bold text-[#C6F24E]',
                            },
                            {
                              id: 'fg-703',
                              type: 'el:span',
                              props: {
                                text: 'We reply within one business day.',
                              },
                            },
                          ],
                        },
                        {
                          id: 'fg-707',
                          type: 'el:li',
                          props: {},
                          class: 'flex items-start gap-3 text-sm text-base-content/70',
                          children: [
                            {
                              id: 'fg-705',
                              type: 'el:span',
                              props: {
                                text: '✓',
                              },
                              class:
                                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C6F24E]/15 text-xs font-bold text-[#C6F24E]',
                            },
                            {
                              id: 'fg-706',
                              type: 'el:span',
                              props: {
                                text: 'A 30-minute intro call to understand your goals.',
                              },
                            },
                          ],
                        },
                        {
                          id: 'fg-710',
                          type: 'el:li',
                          props: {},
                          class: 'flex items-start gap-3 text-sm text-base-content/70',
                          children: [
                            {
                              id: 'fg-708',
                              type: 'el:span',
                              props: {
                                text: '✓',
                              },
                              class:
                                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C6F24E]/15 text-xs font-bold text-[#C6F24E]',
                            },
                            {
                              id: 'fg-709',
                              type: 'el:span',
                              props: {
                                text: 'A tailored proposal, scope, and timeline.',
                              },
                            },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
