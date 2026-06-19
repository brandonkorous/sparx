// Farm Fresh generator — the welcome email body (newsletter signup). Composed
// from the email wordmark + heading/text/button atoms.

import { node, type BuilderNode } from './_kit';

export function welcomeEmail(): BuilderNode {
  return node('Section', {
    box: { name: 'Email body', padding: 'none', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'md' },
    children: [
      node('email_wordmark', { props: { treatment: 'lockup', align: 'center', size: 'md' } }),
      node('Heading', { props: { level: 'h1', text: 'Welcome to the table 🌱' } }),
      node('Text', {
        props: {
          variant: 'body',
          text: 'Thanks for joining Farm Fresh. You’ll be first to hear about seasonal menus, new flavors, and the occasional treat.',
        },
      }),
      node('Button', { props: { label: 'Start an order', style: 'primary', href: '/menu' } }),
      node('Text', { props: { variant: 'meta', text: 'Here to deliver health — one bowl at a time.' } }),
    ],
  });
}
