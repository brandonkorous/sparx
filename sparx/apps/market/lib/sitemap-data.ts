// Sitemap catalog fan-out. The sitemap appends the live catalog (every product +
// merchant URL); these helpers page through the browse/directory endpoints to
// collect slugs. We cap the fan-out so a huge catalog doesn't blow the
// single-file sitemap limit (50k URLs) — past the cap a future pass would shard
// into a sitemap index. Both reads degrade to a partial/empty list (the sitemap
// still ships its static routes) rather than failing the build.

import { listMerchants, listProducts } from './market';

const PER_PAGE = 60; // the API's max perPage

/** Product slugs for the sitemap (best-effort, capped). */
export async function listProductSlugs(max = 5000): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; slugs.length < max; page++) {
      const result = await listProducts({ page, perPage: PER_PAGE, sort: 'newest' });
      if (result.items.length === 0) break;
      for (const item of result.items) slugs.push(item.slug);
      if (page * result.perPage >= result.total) break;
    }
  } catch {
    return slugs;
  }
  return slugs.slice(0, max);
}

/** Merchant slugs for the sitemap (best-effort, capped). */
export async function listMerchantSlugs(max = 5000): Promise<string[]> {
  const slugs: string[] = [];
  try {
    for (let page = 1; slugs.length < max; page++) {
      const result = await listMerchants({ page, perPage: PER_PAGE });
      if (result.items.length === 0) break;
      for (const item of result.items) slugs.push(item.slug);
      if (page * result.perPage >= result.total) break;
    }
  } catch {
    return slugs;
  }
  return slugs.slice(0, max);
}
