// Forge generator — the Services page (singleton): a page hero, the four disciplines as
// numbered divide-ruled rows, the process band (reused from the home page), and the
// shared contact CTA. The discipline copy is the shared SERVICES data.

import { contactCta } from './home/08-contact-cta';
import { process } from './home/06-process';
import { SERVICES } from '../data';
import { band, pageHero, serviceList, serviceRow } from '../sections';
import { node, type BuilderNode } from '../_kit';

export function servicesTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Services', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'What we do',
        'Strategy, design, and growth — under one roof.',
        'A full-service studio built around disciplines that compound. We can own the whole journey or slot into your team where you need us most.'
      ),
      band({
        name: 'Disciplines',
        children: [serviceList(SERVICES.map((s) => serviceRow(s.num, s.title, s.desc)))],
      }),
      process(),
      contactCta(),
    ],
  });
}
