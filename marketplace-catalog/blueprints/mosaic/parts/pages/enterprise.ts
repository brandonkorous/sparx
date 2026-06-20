// Mosaic — Enterprise page (GENERATED payload part, docs/85). Pure data, no imports.
// Safe to hand-edit for a quick tweak; re-running the generator overwrites it. The
// authoring source of truth is marketplace-catalog/_gen/mosaic/.

export default {
  id: 'msc-533',
  type: 'Section',
  props: {},
  class: 'w-full flex flex-col',
  name: 'Enterprise',
  children: [
    {
      id: 'msc-490',
      type: 'Section',
      props: {},
      class:
        'w-full mx-auto w-full max-w-site flex flex-col gap-4 justify-center items-center p-8 @3xl:p-16 text-center',
      name: 'Enterprise intro',
      children: [
        {
          id: 'msc-484',
          type: 'Badge',
          props: {
            label: 'Mosaic for Enterprise',
          },
          class: 'st-badge st-c-primary st-v-soft',
        },
        {
          id: 'msc-485',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Built for the way your company works.',
          },
          class: 'text-4xl font-bold tracking-tight text-[#191918] text-center @2xl:text-5xl',
        },
        {
          id: 'msc-486',
          type: 'el:p',
          props: {
            text: 'The security, control, and scale that IT and security teams require — with the simplicity your whole company will actually adopt.',
          },
          class: 'mx-auto max-w-2xl text-lg text-base-content/60',
        },
        {
          id: 'msc-489',
          type: 'el:div',
          props: {},
          class: 'mt-2 flex flex-col items-center gap-3 @sm:flex-row',
          children: [
            {
              id: 'msc-487',
              type: 'el:a',
              props: {
                href: '/request-demo',
                text: 'Request a demo',
              },
              class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
            },
            {
              id: 'msc-488',
              type: 'el:a',
              props: {
                href: '/request-demo',
                text: 'Talk to sales',
              },
              class: 'st-btn st-c-neutral st-v-outline st-btn--sz-md',
            },
          ],
        },
      ],
    },
    {
      id: 'msc-523',
      type: 'Section',
      props: {},
      class: 'w-full mx-auto w-full max-w-site flex flex-col gap-6 items-start p-8 @3xl:p-16',
      name: 'Enterprise features',
      children: [
        {
          id: 'msc-491',
          type: 'Heading',
          props: {
            level: 'h2',
            text: 'Enterprise-grade by default.',
          },
          class: 'text-4xl font-bold tracking-tight text-[#191918]',
        },
        {
          id: 'msc-522',
          type: 'el:div',
          props: {},
          class: 'grid w-full grid-cols-1 gap-8 @2xl:grid-cols-2 @4xl:grid-cols-3',
          children: [
            {
              id: 'msc-496',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-493',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-492',
                      type: 'Icon',
                      props: {
                        name: 'shield-check',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-494',
                  type: 'el:h3',
                  props: {
                    text: 'SSO & SAML',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-495',
                  type: 'el:p',
                  props: {
                    text: 'Bring your own identity provider with SAML single sign-on and enforce it across your whole org.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
            {
              id: 'msc-501',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-498',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-497',
                      type: 'Icon',
                      props: {
                        name: 'users',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-499',
                  type: 'el:h3',
                  props: {
                    text: 'SCIM provisioning',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-500',
                  type: 'el:p',
                  props: {
                    text: 'Automatically provision and deprovision members and groups as your directory changes.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
            {
              id: 'msc-506',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-503',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-502',
                      type: 'Icon',
                      props: {
                        name: 'scroll-text',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-504',
                  type: 'el:h3',
                  props: {
                    text: 'Audit logs',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-505',
                  type: 'el:p',
                  props: {
                    text: 'A complete, exportable record of every important action across your workspace.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
            {
              id: 'msc-511',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-508',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-507',
                      type: 'Icon',
                      props: {
                        name: 'lock',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-509',
                  type: 'el:h3',
                  props: {
                    text: 'Advanced permissions',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-510',
                  type: 'el:p',
                  props: {
                    text: 'Private team spaces, granular sharing controls, and guest access that IT can govern.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
            {
              id: 'msc-516',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-513',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-512',
                      type: 'Icon',
                      props: {
                        name: 'server',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-514',
                  type: 'el:h3',
                  props: {
                    text: 'Data residency & encryption',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-515',
                  type: 'el:p',
                  props: {
                    text: 'Encryption in transit and at rest, with regional data residency options for your records.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
            {
              id: 'msc-521',
              type: 'el:div',
              props: {},
              class: 'flex flex-col items-start gap-4',
              children: [
                {
                  id: 'msc-518',
                  type: 'el:div',
                  props: {},
                  class:
                    'inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary',
                  children: [
                    {
                      id: 'msc-517',
                      type: 'Icon',
                      props: {
                        name: 'headset',
                      },
                      class: 'h-6 w-6',
                    },
                  ],
                },
                {
                  id: 'msc-519',
                  type: 'el:h3',
                  props: {
                    text: 'Dedicated support',
                  },
                  class: 'text-lg font-semibold text-[#191918]',
                },
                {
                  id: 'msc-520',
                  type: 'el:p',
                  props: {
                    text: 'A named success manager, priority support, and a 99.9% uptime SLA in writing.',
                  },
                  class: 'text-sm leading-relaxed text-base-content/70',
                },
              ],
            },
          ],
        },
      ],
    },
    {
      id: 'msc-528',
      type: 'Section',
      class: 'w-full bg-neutral text-neutral-content',
      props: {},
      name: 'Enterprise stats',
      children: [
        {
          id: 'msc-528__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-4 gap-6 items-start p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'msc-524',
              type: 'Stat',
              props: {
                value: '62%',
                label: 'of the Fortune 100',
              },
              class: 'flex flex-col gap-1',
            },
            {
              id: 'msc-525',
              type: 'Stat',
              props: {
                value: '99.9%',
                label: 'uptime SLA',
              },
              class: 'flex flex-col gap-1',
            },
            {
              id: 'msc-526',
              type: 'Stat',
              props: {
                value: 'SOC 2',
                label: 'Type II certified',
              },
              class: 'flex flex-col gap-1',
            },
            {
              id: 'msc-527',
              type: 'Stat',
              props: {
                value: '24/7',
                label: 'priority support',
              },
              class: 'flex flex-col gap-1',
            },
          ],
        },
      ],
    },
    {
      id: 'msc-532',
      type: 'Section',
      class: 'w-full bg-base-200',
      props: {},
      name: 'Enterprise CTA',
      children: [
        {
          id: 'msc-532__c',
          type: 'Stack',
          class:
            'mx-auto w-full max-w-site flex flex-col gap-6 justify-center items-center p-8 @3xl:p-16 text-center',
          props: {},
          children: [
            {
              id: 'msc-529',
              type: 'Heading',
              props: {
                level: 'h2',
                text: 'Bring Mosaic to your whole company.',
              },
              class: 'text-4xl font-bold tracking-tight text-[#191918] text-center',
            },
            {
              id: 'msc-530',
              type: 'el:p',
              props: {
                text: 'See how Mosaic scales from your first team to your entire organization.',
              },
              class: 'mx-auto max-w-xl text-lg text-base-content/60',
            },
            {
              id: 'msc-531',
              type: 'el:a',
              props: {
                href: '/request-demo',
                text: 'Request a demo',
              },
              class: 'st-btn st-c-primary st-v-solid st-btn--sz-md',
            },
          ],
        },
      ],
    },
  ],
};
