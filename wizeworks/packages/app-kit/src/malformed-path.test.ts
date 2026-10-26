import { describe, expect, it } from 'vitest';
import { isMalformedPath, malformedPathResponse } from './malformed-path';

// market answered GET /%c0 with a 500: Next failed to decode the path.
const req = (pathname: string) => ({ nextUrl: { pathname } });

describe('malformedPathResponse', () => {
  it.each(['/%c0', '/a/%E0%A4%A', '/%'])('answers 400 for %s', (path) => {
    expect(isMalformedPath(path)).toBe(true);
    expect(malformedPathResponse(req(path))?.status).toBe(400);
  });

  it.each(['/', '/products/caf%C3%A9', '/search%20term', '/a%2Fb'])('leaves %s alone', (path) => {
    expect(malformedPathResponse(req(path))).toBeNull();
  });
});
