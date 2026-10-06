import { describe, expect, it } from 'vitest';
import { encodeActiveSite, readActiveSite } from './active-site-cookie';

// sparx persona issue 011: a site id left by one company's operator keyed the
// layout of the next person to sign in on that computer.
const MINE = '5944fe23-be83-4ce5-aafc-ef56b8594508';
const THEIRS = 'b44414a0-21b6-4d75-8d4e-59ea161d3826';
const SITE = 'bac86a9f-47db-468f-b4da-1e4323978ee9';

describe('active-site cookie', () => {
  it('returns the site for the tenant that set it', () => {
    expect(readActiveSite(encodeActiveSite(MINE, SITE), MINE)).toBe(SITE);
  });

  it('drops a site set under another tenant', () => {
    expect(readActiveSite(encodeActiveSite(THEIRS, SITE), MINE)).toBeNull();
  });

  it('drops a bare site id, which cannot be checked', () => {
    expect(readActiveSite(SITE, MINE)).toBeNull();
  });

  it('drops a value when nobody is signed in', () => {
    expect(readActiveSite(encodeActiveSite(MINE, SITE), null)).toBeNull();
  });
});
