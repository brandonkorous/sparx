// The DNS lookup a CSV feed's address is checked with (sparx persona issue 363).
// `@wizeworks/dropship` does not reach for Node itself; this hands it in.

import { lookup } from 'node:dns/promises';
import type { FeedDeps } from '@wizeworks/dropship';

export const feedDeps: FeedDeps = {
  resolveHost: async (host) =>
    (await lookup(host, { all: true, verbatim: true })).map((entry) => entry.address),
};
