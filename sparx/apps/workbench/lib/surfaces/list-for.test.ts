// A gone record's way out is the list it belongs to (persona issue 267).
//
// 104 detail screens said "That segment is no longer here" and offered nothing
// to press. The list that owns a detail screen already names it, as the screen
// its create button opens; this reads that link backwards.

import { describe, expect, it } from 'vitest';

import { listFor } from './list-for';
import { registerSurfaces, type SurfaceDefinition } from './registry';

const Nothing = () => null;
const icon = Nothing as unknown as SurfaceDefinition['icon'];

registerSurfaces([
  {
    key: 'test.segments.list',
    title: 'Segments',
    module: 'crm',
    component: Nothing,
    icon,
    createSurface: 'test.segment.detail',
    createLabel: 'New segment',
  },
  {
    key: 'test.segment.detail',
    title: 'Segment',
    module: 'crm',
    component: Nothing,
    icon,
    listed: false,
  },
  {
    key: 'test.orphan.detail',
    title: 'Orphan',
    module: 'crm',
    component: Nothing,
    icon,
    listed: false,
  },
  {
    key: 'test.quote.detail',
    title: 'Quote',
    module: 'crm',
    component: Nothing,
    icon,
    listed: false,
  },
  { key: 'test.quotes.list', title: 'Quotes', module: 'crm', component: Nothing, icon },
  { key: 'test.site', title: 'Site', module: 'crm', component: Nothing, icon, listed: false },
  { key: 'test.sites', title: 'Sites', module: 'crm', component: Nothing, icon },
]);

describe('the list a detail screen belongs to', () => {
  it('is the list whose create button opens it', () => {
    expect(listFor('test.segment.detail')).toBe('test.segments.list');
  });

  it('falls back to the list by its plural name when no create button names it', () => {
    expect(listFor('test.quote.detail')).toBe('test.quotes.list');
    expect(listFor('test.site')).toBe('test.sites');
  });

  it('is nothing when no list opens it', () => {
    expect(listFor('test.orphan.detail')).toBeNull();
  });

  it('is nothing for a screen that is not registered', () => {
    expect(listFor('test.never.registered')).toBeNull();
  });
});
