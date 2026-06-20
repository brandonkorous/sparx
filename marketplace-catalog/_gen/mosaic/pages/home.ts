// Mosaic generator — the Home page tree. The big page: hero · workspace preview · logo
// wall · agents · assistants · work-together · trusted · try-free. Each section is its
// own module under ./home/NN-*.ts (cohesion); this file just stitches them in order.
// The emit splits these direct children into per-section payload files
// (parts/pages/home/NN-*.ts) so no shipped file is a wall. The home Section's children
// order is load-bearing for node ids — keep it stable.

import { hero } from './home/01-hero';
import { preview } from './home/02-preview';
import { logos } from './home/03-logos';
import { agents } from './home/04-agents';
import { assistants } from './home/05-assistants';
import { together } from './home/06-together';
import { trusted } from './home/07-trusted';
import { tryFree } from './home/08-try-free';
import { node, type BuilderNode } from '../_kit';

export function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [hero(), preview(), logos(), agents(), assistants(), together(), trusted(), tryFree()],
  });
}
