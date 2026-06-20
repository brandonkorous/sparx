// Mosaic — Pricing page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-483',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Pricing',
  children: [
    {
      id: 'msc-380',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
      name: 'Pricing intro',
      children: [
        {
          id: 'msc-378',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Pricing that scales with your team.',
          },
          class: 'text-4xl font-bold tracking-tight text-[#191918] text-center',
        },
        {
          id: 'msc-379',
          type: 'el:p',
          props: {
            text: 'Start free, upgrade when you need more. Every plan includes unlimited docs and a 14-day trial of paid features.',
          },
          class: 'mx-auto max-w-xl text-lg text-base-content/60',
        },
      ],
    },
    {
      id: 'msc-453',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'Plans',
      children: [
        {
          id: 'msc-452',
          type: 'el:div',
          props: {},
          class: 'grid w-full grid-cols-1 items-stretch gap-6 @3xl:grid-cols-3',
          children: [
            {
              id: 'msc-401',
              type: 'el:div',
              props: {},
              class:
                'relative flex flex-col gap-6 rounded-2xl p-8 border border-base-300 bg-base-100',
              children: [
                {
                  id: 'msc-383',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col gap-1',
                  children: [
                    {
                      id: 'msc-381',
                      type: 'el:h3',
                      props: {
                        text: 'Free',
                      },
                      class: 'text-lg font-semibold text-[#191918]',
                    },
                    {
                      id: 'msc-382',
                      type: 'el:p',
                      props: {
                        text: 'For individuals organizing their work.',
                      },
                      class: 'text-sm text-base-content/60',
                    },
                  ],
                },
                {
                  id: 'msc-386',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-baseline gap-1',
                  children: [
                    {
                      id: 'msc-384',
                      type: 'el:span',
                      props: {
                        text: '$0',
                      },
                      class: 'text-4xl font-bold tracking-tight text-[#191918]',
                    },
                    {
                      id: 'msc-385',
                      type: 'el:span',
                      props: {
                        text: '/user / month',
                      },
                      class: 'text-sm text-base-content/50',
                    },
                  ],
                },
                {
                  id: 'msc-399',
                  type: 'el:ul',
                  props: {},
                  class: 'flex flex-col gap-3',
                  children: [
                    {
                      id: 'msc-389',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-387',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-388',
                          type: 'el:span',
                          props: {
                            text: 'Unlimited pages & docs',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-392',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-390',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-391',
                          type: 'el:span',
                          props: {
                            text: 'Up to 10 guests',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-395',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-393',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-394',
                          type: 'el:span',
                          props: {
                            text: 'Basic page analytics',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-398',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-396',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-397',
                          type: 'el:span',
                          props: {
                            text: '7-day version history',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'msc-400',
                  type: 'el:a',
                  props: {
                    href: '/request-demo',
                    text: 'Get started',
                  },
                  class: 'st-btn st-c-neutral st-v-outline st-btn--sz-md mt-auto w-full',
                },
              ],
            },
            {
              id: 'msc-427',
              type: 'el:div',
              props: {},
              class:
                'relative flex flex-col gap-6 rounded-2xl p-8 border-2 border-primary bg-base-100 shadow-lg',
              children: [
                {
                  id: 'msc-403',
                  type: 'el:div',
                  props: {},
                  class: 'absolute -top-3 left-8',
                  children: [
                    {
                      id: 'msc-402',
                      type: 'Badge',
                      props: {
                        label: 'Most popular',
                      },
                      class: 'st-badge st-c-primary st-v-solid',
                    },
                  ],
                },
                {
                  id: 'msc-406',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col gap-1',
                  children: [
                    {
                      id: 'msc-404',
                      type: 'el:h3',
                      props: {
                        text: 'Plus',
                      },
                      class: 'text-lg font-semibold text-[#191918]',
                    },
                    {
                      id: 'msc-405',
                      type: 'el:p',
                      props: {
                        text: 'For small teams working together.',
                      },
                      class: 'text-sm text-base-content/60',
                    },
                  ],
                },
                {
                  id: 'msc-409',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-baseline gap-1',
                  children: [
                    {
                      id: 'msc-407',
                      type: 'el:span',
                      props: {
                        text: '$12',
                      },
                      class: 'text-4xl font-bold tracking-tight text-[#191918]',
                    },
                    {
                      id: 'msc-408',
                      type: 'el:span',
                      props: {
                        text: '/user / month',
                      },
                      class: 'text-sm text-base-content/50',
                    },
                  ],
                },
                {
                  id: 'msc-425',
                  type: 'el:ul',
                  props: {},
                  class: 'flex flex-col gap-3',
                  children: [
                    {
                      id: 'msc-412',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-410',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-411',
                          type: 'el:span',
                          props: {
                            text: 'Everything in Free',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-415',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-413',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-414',
                          type: 'el:span',
                          props: {
                            text: 'Unlimited blocks for teams',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-418',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-416',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-417',
                          type: 'el:span',
                          props: {
                            text: 'Unlimited file uploads',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-421',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-419',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-420',
                          type: 'el:span',
                          props: {
                            text: '30-day version history',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-424',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-422',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-423',
                          type: 'el:span',
                          props: {
                            text: 'Custom Agents',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'msc-426',
                  type: 'el:a',
                  props: {
                    href: '/request-demo',
                    text: 'Start free trial',
                  },
                  class: 'st-btn st-c-primary st-v-solid st-btn--sz-md mt-auto w-full',
                },
              ],
            },
            {
              id: 'msc-451',
              type: 'el:div',
              props: {},
              class:
                'relative flex flex-col gap-6 rounded-2xl p-8 border border-base-300 bg-base-100',
              children: [
                {
                  id: 'msc-430',
                  type: 'el:div',
                  props: {},
                  class: 'flex flex-col gap-1',
                  children: [
                    {
                      id: 'msc-428',
                      type: 'el:h3',
                      props: {
                        text: 'Business',
                      },
                      class: 'text-lg font-semibold text-[#191918]',
                    },
                    {
                      id: 'msc-429',
                      type: 'el:p',
                      props: {
                        text: 'For companies that run on Mosaic.',
                      },
                      class: 'text-sm text-base-content/60',
                    },
                  ],
                },
                {
                  id: 'msc-433',
                  type: 'el:div',
                  props: {},
                  class: 'flex items-baseline gap-1',
                  children: [
                    {
                      id: 'msc-431',
                      type: 'el:span',
                      props: {
                        text: '$24',
                      },
                      class: 'text-4xl font-bold tracking-tight text-[#191918]',
                    },
                    {
                      id: 'msc-432',
                      type: 'el:span',
                      props: {
                        text: '/user / month',
                      },
                      class: 'text-sm text-base-content/50',
                    },
                  ],
                },
                {
                  id: 'msc-449',
                  type: 'el:ul',
                  props: {},
                  class: 'flex flex-col gap-3',
                  children: [
                    {
                      id: 'msc-436',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-434',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-435',
                          type: 'el:span',
                          props: {
                            text: 'Everything in Plus',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-439',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-437',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-438',
                          type: 'el:span',
                          props: {
                            text: 'SAML single sign-on',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-442',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-440',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-441',
                          type: 'el:span',
                          props: {
                            text: 'Private team spaces',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-445',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-443',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-444',
                          type: 'el:span',
                          props: {
                            text: 'Advanced page analytics',
                          },
                        },
                      ],
                    },
                    {
                      id: 'msc-448',
                      type: 'el:li',
                      props: {},
                      class: 'flex items-start gap-2 text-sm text-base-content/80',
                      children: [
                        {
                          id: 'msc-446',
                          type: 'el:span',
                          props: {
                            text: '✓',
                          },
                          class: 'mt-0.5 shrink-0 text-primary',
                        },
                        {
                          id: 'msc-447',
                          type: 'el:span',
                          props: {
                            text: 'Bulk export',
                          },
                        },
                      ],
                    },
                  ],
                },
                {
                  id: 'msc-450',
                  type: 'el:a',
                  props: {
                    href: '/request-demo',
                    text: 'Start free trial',
                  },
                  class: 'st-btn st-c-neutral st-v-outline st-btn--sz-md mt-auto w-full',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'msc-459',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'Enterprise band',
      children: [
        {
          id: 'msc-458',
          type: 'el:div',
          props: {},
          class:
            'flex w-full flex-col items-start gap-4 rounded-2xl bg-[#191918] p-8 text-white @2xl:flex-row @2xl:items-center @2xl:justify-between @2xl:p-10',
          children: [
            {
              id: 'msc-456',
              type: 'el:div',
              props: {},
              class: 'flex flex-col gap-2',
              children: [
                {
                  id: 'msc-454',
                  type: 'Heading',
                  props: {
                    level: 'h2',
                    text: 'Need enterprise controls?',
                  },
                  class: 'text-2xl font-semibold',
                },
                {
                  id: 'msc-455',
                  type: 'el:p',
                  props: {
                    text: 'Advanced security, SCIM provisioning, audit logs, a dedicated success manager, and a 99.9% uptime SLA.',
                  },
                  class: 'max-w-xl text-sm text-white/70',
                },
              ],
            },
            {
              id: 'msc-457',
              type: 'el:a',
              props: {
                href: '/enterprise',
                text: 'Contact sales',
              },
              class: 'st-btn st-c-neutral st-v-outline st-btn--sz-md shrink-0',
            },
          ],
        },
      ],
    },
    {
      id: 'msc-482',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Pricing FAQ',
      children: [
        {
          id: 'msc-482__c',
          type: 'Stack',
          class: 'mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
          props: {},
          children: [
            {
              id: 'msc-460',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Frequently asked questions',
              },
              class: 'text-4xl font-bold tracking-tight text-[#191918]',
            },
            {
              id: 'msc-481',
              type: 'el:div',
              props: {},
              class: 'flex w-full flex-col gap-3',
              children: [
                {
                  id: 'msc-465',
                  type: 'el:details',
                  props: {
                    open: true,
                  },
                  class: 'group rounded-2xl border border-base-300 bg-base-100 p-5',
                  children: [
                    {
                      id: 'msc-463',
                      type: 'el:summary',
                      props: {},
                      class:
                        'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#191918] [&::-webkit-details-marker]:hidden',
                      children: [
                        {
                          id: 'msc-461',
                          type: 'el:span',
                          props: {
                            text: 'Is there a free plan?',
                          },
                        },
                        {
                          id: 'msc-462',
                          type: 'Icon',
                          props: {
                            name: 'chevron-down',
                          },
                          class:
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                        },
                      ],
                    },
                    {
                      id: 'msc-464',
                      type: 'el:p',
                      props: {
                        text: 'Yes. The Free plan is genuinely free forever for individuals and small teams — no credit card required to start.',
                      },
                      class: 'mt-3 text-sm leading-relaxed text-base-content/70',
                    },
                  ],
                },
                {
                  id: 'msc-470',
                  type: 'el:details',
                  props: {},
                  class: 'group rounded-2xl border border-base-300 bg-base-100 p-5',
                  children: [
                    {
                      id: 'msc-468',
                      type: 'el:summary',
                      props: {},
                      class:
                        'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#191918] [&::-webkit-details-marker]:hidden',
                      children: [
                        {
                          id: 'msc-466',
                          type: 'el:span',
                          props: {
                            text: 'Can I change plans later?',
                          },
                        },
                        {
                          id: 'msc-467',
                          type: 'Icon',
                          props: {
                            name: 'chevron-down',
                          },
                          class:
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                        },
                      ],
                    },
                    {
                      id: 'msc-469',
                      type: 'el:p',
                      props: {
                        text: 'Anytime. Upgrade or downgrade in a click; we prorate the difference so you only pay for what you use.',
                      },
                      class: 'mt-3 text-sm leading-relaxed text-base-content/70',
                    },
                  ],
                },
                {
                  id: 'msc-475',
                  type: 'el:details',
                  props: {},
                  class: 'group rounded-2xl border border-base-300 bg-base-100 p-5',
                  children: [
                    {
                      id: 'msc-473',
                      type: 'el:summary',
                      props: {},
                      class:
                        'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#191918] [&::-webkit-details-marker]:hidden',
                      children: [
                        {
                          id: 'msc-471',
                          type: 'el:span',
                          props: {
                            text: 'Do you offer discounts for nonprofits or education?',
                          },
                        },
                        {
                          id: 'msc-472',
                          type: 'Icon',
                          props: {
                            name: 'chevron-down',
                          },
                          class:
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                        },
                      ],
                    },
                    {
                      id: 'msc-474',
                      type: 'el:p',
                      props: {
                        text: 'We do. Eligible nonprofits and educational institutions get a significant discount — reach out and our team will set you up.',
                      },
                      class: 'mt-3 text-sm leading-relaxed text-base-content/70',
                    },
                  ],
                },
                {
                  id: 'msc-480',
                  type: 'el:details',
                  props: {},
                  class: 'group rounded-2xl border border-base-300 bg-base-100 p-5',
                  children: [
                    {
                      id: 'msc-478',
                      type: 'el:summary',
                      props: {},
                      class:
                        'flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-[#191918] [&::-webkit-details-marker]:hidden',
                      children: [
                        {
                          id: 'msc-476',
                          type: 'el:span',
                          props: {
                            text: 'What happens when my trial ends?',
                          },
                        },
                        {
                          id: 'msc-477',
                          type: 'Icon',
                          props: {
                            name: 'chevron-down',
                          },
                          class:
                            'h-5 w-5 shrink-0 text-base-content/50 transition-transform group-open:rotate-180',
                        },
                      ],
                    },
                    {
                      id: 'msc-479',
                      type: 'el:p',
                      props: {
                        text: 'Your workspace stays intact. Paid features pause until you choose a plan — nothing is deleted, and you can upgrade whenever you’re ready.',
                      },
                      class: 'mt-3 text-sm leading-relaxed text-base-content/70',
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
