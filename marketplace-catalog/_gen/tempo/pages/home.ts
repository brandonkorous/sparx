// Tempo generator — the Home page tree. The big page: hero carousel · find-your-team
// marquee · shop-the-season tiles · shop-by-category tiles · best-sellers grid · editorial
// panels · the long-run banner · the membership band · the benefit strip · SEO copy. Each
// section is its own module under ./home/NN-*.ts (cohesion); this file just stitches them
// in order. The emit splits these direct children into per-section payload files
// (parts/pages/home/NN-*.ts) so no shipped file is a wall. The children order is
// load-bearing for node ids — keep it stable.

import { hero } from './home/01-hero';
import { findYourTeam } from './home/02-find-your-team';
import { shopSeason } from './home/03-shop-season';
import { shopCategory } from './home/04-shop-category';
import { bestSellers } from './home/05-best-sellers';
import { editorial } from './home/06-editorial';
import { longRun } from './home/07-long-run';
import { membership } from './home/08-membership';
import { benefits } from './home/09-benefits';
import { seoCopy } from './home/10-seo';
import { node, type BuilderNode } from '../_kit';

export function homeTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Home', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      hero(),
      findYourTeam(),
      shopSeason(),
      shopCategory(),
      bestSellers(),
      editorial(),
      longRun(),
      membership(),
      benefits(),
      seoCopy(),
    ],
  });
}
