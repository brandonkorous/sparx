// Unit coverage for the file reader — CSV + JSON parsing and the mtime-as-observedAt
// contract. Writes throwaway files to the OS temp dir.

import { describe, it, expect, afterEach } from 'vitest';
import { writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';

import { FileReader } from './file-reader.js';

const written: string[] = [];

async function tempFile(name: string, content: string): Promise<string> {
  const path = join(tmpdir(), `bridge-${crypto.randomUUID()}-${name}`);
  await writeFile(path, content, 'utf8');
  written.push(path);
  return path;
}

afterEach(async () => {
  await Promise.all(written.splice(0).map((p) => rm(p, { force: true })));
});

describe('FileReader', () => {
  it('parses a CSV export and stamps observedAt from the file mtime', async () => {
    const path = await tempFile(
      'stock.csv',
      'sku,quantity,location\nWMS-1,10,MAIN\nWMS-2,5,\nWMS-3,not-a-number,MAIN\n'
    );
    const snapshot = await new FileReader(path, 'csv').readSnapshot();

    expect(snapshot.rows).toEqual([
      { sku: 'WMS-1', location: 'MAIN', quantity: 10 },
      { sku: 'WMS-2', location: null, quantity: 5 },
    ]);
    expect(() => new Date(snapshot.observedAt).toISOString()).not.toThrow();
    expect(snapshot.observedAt).toBe(new Date(snapshot.observedAt).toISOString());
  });

  it('parses a bare JSON array', async () => {
    const path = await tempFile(
      'stock.json',
      JSON.stringify([
        { sku: 'A', quantity: 7, location: 'W1' },
        { sku: 'B', quantity: '3' },
        { sku: '', quantity: 9 },
      ])
    );
    const snapshot = await new FileReader(path, 'json').readSnapshot();

    expect(snapshot.rows).toEqual([
      { sku: 'A', location: 'W1', quantity: 7 },
      { sku: 'B', location: null, quantity: 3 },
    ]);
  });

  it('parses a JSON { items: [...] } envelope with qty/on_hand aliases', async () => {
    const path = await tempFile(
      'stock.json',
      JSON.stringify({
        items: [
          { sku: 'C', on_hand: 4 },
          { sku: 'D', qty: 2, location: 'W2' },
        ],
      })
    );
    const snapshot = await new FileReader(path, 'json').readSnapshot();

    expect(snapshot.rows).toEqual([
      { sku: 'C', location: null, quantity: 4 },
      { sku: 'D', location: 'W2', quantity: 2 },
    ]);
  });
});
