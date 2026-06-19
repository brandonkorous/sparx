// Farm Fresh Bowls generator — the two collection templates: product detail (binds the
// commerce record) and blog post (binds the CMS record). These render per-record at
// runtime, so they bind tokens (`product.*` / `page.*`) rather than literal copy.

import { node, type BuilderNode } from '../_kit';

export function productTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Product', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'start' },
    children: [
      node('Image', { bind: 'product.images', props: { ratio: 'square', alt: 'Bowl' } }),
      node('Stack', {
        box: { padding: 'none' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('Heading', { props: { level: 'h1' }, bind: 'product.title' }),
          node('Prose', { bind: 'product.description' }),
          node('BuyBox', { bind: 'product' }),
        ],
      }),
    ],
  });
}

export function postTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Post', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Post header', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [node('Heading', { box: { align: 'center' }, props: { level: 'h1' }, bind: 'page.title' })],
      }),
      node('Section', {
        box: { name: 'Post body', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md' },
        children: [node('Prose', { bind: 'page.body' })],
      }),
    ],
  });
}
