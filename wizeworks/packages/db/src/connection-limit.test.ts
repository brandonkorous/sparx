import { describe, expect, it } from 'vitest';
import { connectionLimit, connectionUrl, DEFAULT_CONNECTION_LIMIT } from './connection-limit';

// WW-1: an unset DB_CONNECTION_LIMIT left Prisma to size its own pool, and ~10
// processes overran the 35-slot database (P2037 on 10-19, P2028 on 10-21).

const URL_BASE = 'postgresql://u:p%40ss@h:5432/db?schema=public';

describe('connectionUrl', () => {
  it('caps an unset process at the small default', () => {
    expect(connectionUrl({ DATABASE_URL: URL_BASE })).toBe(
      `${URL_BASE}&connection_limit=${DEFAULT_CONNECTION_LIMIT}`
    );
    expect(DEFAULT_CONNECTION_LIMIT).toBe(2);
  });

  it('uses DB_CONNECTION_LIMIT when set', () => {
    expect(connectionUrl({ DATABASE_URL: URL_BASE, DB_CONNECTION_LIMIT: '4' })).toBe(
      `${URL_BASE}&connection_limit=4`
    );
  });

  it('leaves a URL that already names a limit alone', () => {
    const url = `${URL_BASE}&connection_limit=20`;
    expect(connectionUrl({ DATABASE_URL: url, DB_CONNECTION_LIMIT: '4' })).toBe(url);
  });

  it('adds a query string when the URL has none', () => {
    expect(connectionUrl({ DATABASE_URL: 'postgresql://h/db' })).toBe(
      'postgresql://h/db?connection_limit=2'
    );
  });

  it('is undefined with no DATABASE_URL', () => {
    expect(connectionUrl({})).toBeUndefined();
  });
});

describe('connectionLimit', () => {
  it.each([
    [{}, 2, 'default'],
    [{ DB_CONNECTION_LIMIT: 'nope' }, 2, 'default'],
    [{ DB_CONNECTION_LIMIT: '8' }, 8, 'env'],
    [{ DATABASE_URL: `${URL_BASE}&connection_limit=12`, DB_CONNECTION_LIMIT: '4' }, 12, 'url'],
  ])('reads %j as %i (%s)', (env, limit, source) => {
    expect(connectionLimit(env)).toEqual({ limit, source });
  });
});
