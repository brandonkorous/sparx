// A resource's TAB knows what kind of thing it is without its pane ever having
// been opened (sparx persona issue 086, second pass).
//
// The first fix let a mounted pane claim its tab's icon. A tab restored into the
// dock and never opened has no mounted pane, so "Bay 2 (light duty)" still
// showed a person beside "Bay 1", which showed a door. The tab now reads the
// resource itself, from the same query the pane uses, so it is right whether or
// not the pane has rendered, and it follows a change of kind when the save
// refreshes that query.
//
// Rendered with react-dom/server against a seeded cache: no pane, no network.

import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@wizeworks/query';
import { describe, expect, it } from 'vitest';

import { resourceKindIcon } from './resource-kind-icon';
import { useResourceTabIcon } from './resource-tab-icon';
import { resourceKeys } from './setup-data';

function tabIconFor(client: QueryClient, params: Record<string, string>) {
  let seen: unknown = 'not rendered';
  function Tab() {
    seen = useResourceTabIcon(params);
    return null;
  }
  renderToString(createElement(QueryClientProvider, { client }, createElement(Tab)));
  return seen;
}

function clientWith(id: string, kind: string): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(resourceKeys.one(id), { id, kind, name: 'Bay 2 (light duty)' });
  return client;
}

describe("a resource tab's icon, with its pane never opened", () => {
  it('draws a room or space for a bay', () => {
    const client = clientWith('bay-2', 'space');
    expect(tabIconFor(client, { id: 'bay-2' })).toBe(resourceKindIcon('space'));
  });

  it('follows the resource when its kind is changed and saved', () => {
    const client = clientWith('bay-2', 'space');
    client.setQueryData(resourceKeys.one('bay-2'), { id: 'bay-2', kind: 'equipment' });
    expect(tabIconFor(client, { id: 'bay-2' })).toBe(resourceKindIcon('equipment'));
  });

  it('claims nothing for a resource it has not read yet, or a new one', () => {
    const client = new QueryClient();
    expect(tabIconFor(client, { id: 'unknown' })).toBeUndefined();
    expect(tabIconFor(client, { id: 'new' })).toBeUndefined();
  });
});
