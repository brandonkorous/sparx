// Forge generator — the Home page tree. The big page: hero · logo+awards marquee ·
// selected work · stats · what-we-do · process · testimonials · contact CTA. Each section
// is its own module under ./home/NN-*.ts (cohesion); this file just stitches them in
// order. The emit splits these direct children into per-section payload files
// (parts/pages/home/NN-*.ts) so no shipped file is a wall. The home Section's children
// order is load-bearing for node ids — keep it stable.

import { hero } from './home/01-hero';
import { marqueeBand } from './home/02-marquee';
import { work } from './home/03-work';
import { stats } from './home/04-stats';
import { services } from './home/05-services';
import { process } from './home/06-process';
import { testimonials } from './home/07-testimonials';
import { contactCta } from './home/08-contact-cta';
import { node, type BuilderNode } from '../_kit';

export function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      hero(),
      marqueeBand(),
      work(),
      stats(),
      services(),
      process(),
      testimonials(),
      contactCta(),
    ],
  });
}
