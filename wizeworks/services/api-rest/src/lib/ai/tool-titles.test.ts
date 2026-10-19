import { describe, expect, it } from 'vitest';
import { TOOL_CATALOG } from './tool-catalog';
import { TOOL_TITLES, toolTitle } from './tool-titles';

// Words a business owner should never have to read in a tool's title. Each is
// matched as a whole word, ignoring case.
const TECHNICAL_WORDS = [
  'b2b',
  'crm',
  'mcp',
  'sku',
  'slug',
  'id',
  'ids',
  'uuid',
  'enum',
  'payload',
  'json',
  'api',
  'upsert',
  'rls',
  'tenant',
  'cms',
  'boolean',
  'null',
  'schema',
  'metadata',
  'webhook',
];

const titleEntries = Object.entries(TOOL_TITLES);

describe('TOOL_TITLES', () => {
  it('gives every catalog tool a title', () => {
    const missing = TOOL_CATALOG.map((t) => t.name).filter(
      (name) => (toolTitle(name) ?? '').trim() === ''
    );
    expect(missing).toEqual([]);
  });

  it('has no title for a tool that is not in the catalog', () => {
    const known = new Set(TOOL_CATALOG.map((t) => t.name));
    const stale = Object.keys(TOOL_TITLES).filter((name) => !known.has(name));
    expect(stale).toEqual([]);
  });

  it('keeps every title to 70 characters or fewer', () => {
    const long = titleEntries.filter(([, title]) => title.length > 70);
    expect(long).toEqual([]);
  });

  it('never uses an em dash or an en dash', () => {
    const dashed = titleEntries.filter(([, title]) => /[—–]/.test(title));
    expect(dashed).toEqual([]);
  });

  it('never uses a technical word', () => {
    const pattern = new RegExp(`\\b(${TECHNICAL_WORDS.join('|')})\\b`, 'i');
    const technical = titleEntries.filter(([, title]) => pattern.test(title));
    expect(technical).toEqual([]);
  });

  it('answers null for a name that is not a tool', () => {
    expect(toolTitle('not_a_real_tool')).toBeNull();
    expect(toolTitle('toString')).toBeNull();
  });
});
