import { describe, expect, it } from 'vitest';
import {
  isBoundlessMultipart,
  isMalformedPath,
  malformedFormResponse,
  malformedPathResponse,
  malformedRequestResponse,
} from './malformed-path';

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

// sparx.works and getpiggles.com answered `multipart/form-data; boundary=` with a 500.
const post = (contentType: string | null, pathname = '/') => ({
  nextUrl: { pathname },
  headers: new Headers(contentType === null ? {} : { 'content-type': contentType }),
});

describe('malformedFormResponse', () => {
  it.each([
    'multipart/form-data; boundary=',
    'multipart/form-data',
    'multipart/form-data; charset=utf-8',
    'Multipart/Form-Data; boundary=""',
    `multipart/form-data; boundary=${'x'.repeat(71)}`,
  ])('answers 400 for %s', (type) => {
    expect(isBoundlessMultipart(type)).toBe(true);
    expect(malformedFormResponse(post(type))?.status).toBe(400);
  });

  it.each([
    null,
    'application/x-www-form-urlencoded',
    'text/plain;charset=UTF-8',
    'multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW',
    'multipart/form-data; BOUNDARY="quoted-ok"',
    'multipart/mixed; boundary=',
  ])('leaves %s alone', (type) => {
    expect(malformedFormResponse(post(type))).toBeNull();
  });

  it('checks the path first, then the body', () => {
    expect(malformedRequestResponse(post(null, '/%c0'))?.status).toBe(400);
    expect(malformedRequestResponse(post('multipart/form-data; boundary='))?.status).toBe(400);
    expect(malformedRequestResponse(post('multipart/form-data; boundary=abc'))).toBeNull();
  });
});
