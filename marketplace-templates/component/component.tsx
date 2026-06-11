// component.tsx — the payload for a COMPONENT submission.
//
// A component is a DECLARATIVE builder node-tree (the same JSON the visual editor
// emits), optionally parameterized with fields. It is DATA — the platform renders
// it by expansion through trusted renderers; the submitter's file never executes.
//
// Author with the allow-listed `node()` helper (the pipeline provides the same
// vocabulary). Reference brand via tokens so the component re-themes to whatever
// site installs it. Use `{ $prop: 'key' }` slots for values the installer fills in,
// and declare each slot in `propSpec`.

import { seedNode, type BuilderNode } from '@sparx/builder-schemas';

let n = 0;
const node = (type: string, opts: Parameters<typeof seedNode>[2] = {}): BuilderNode =>
  seedNode(`cta-${(n += 1)}`, type, opts);

const tree: BuilderNode = node('Section', {
  box: {
    name: 'CTA banner',
    surface: 'inverse',
    backgroundWidth: 'full',
    contentWidth: 'contained',
    align: 'center',
    padding: 'xl',
  },
  layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
  children: [
    node('Heading', { props: { level: 'h2', text: { $prop: 'heading' } } }),
    node('Text', { props: { variant: 'body', text: { $prop: 'body' } } }),
    node('Button', {
      props: { label: { $prop: 'buttonLabel' }, href: { $prop: 'buttonHref' }, style: 'primary' },
    }),
  ],
});

// The submission's exported shape. `slug`/`name` come from sparx.json; this file
// supplies the design: group, surfaces, icon, the field spec, and the tree.
const component = {
  group: 'content' as const, // layout | content | data
  surfaces: ['page', 'site'] as const, // page | site | email
  icon: 'megaphone',
  description: 'A full-width call-to-action band with a heading, body, and button.',
  propSpec: [
    { key: 'heading', label: 'Heading', kind: 'text', default: 'Ready to get started?' },
    { key: 'body', label: 'Body', kind: 'text', default: 'Join thousands already on board.' },
    { key: 'buttonLabel', label: 'Button label', kind: 'text', default: 'Get started' },
    { key: 'buttonHref', label: 'Button link', kind: 'url', default: '/signup' },
  ],
  tree,
};

export default component;
