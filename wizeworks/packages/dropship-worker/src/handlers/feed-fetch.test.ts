// Sparx persona issue 363: a CSV supplier's feed address was fetched wherever it
// pointed, the platform's own network included.

import { describe, expect, it } from 'vitest';

import { checkFeedAddress, FeedAddressError, isPrivateAddress } from '@wizeworks/dropship';

const resolvesTo =
  (...addresses: string[]) =>
  () =>
    Promise.resolve(addresses);

describe('isPrivateAddress', () => {
  it('refuses the networks a server must not be sent into', () => {
    for (const ip of [
      '10.0.0.5',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.4.1',
      '172.31.255.255',
      '192.168.1.10',
      '100.64.0.1',
      '0.0.0.0',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1',
    ]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('lets the public internet through', () => {
    for (const ip of ['8.8.8.8', '151.101.1.69', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});

describe('checkFeedAddress', () => {
  it('refuses a host that resolves to a private address', async () => {
    await expect(
      checkFeedAddress('https://feed.example.com/catalog.csv', {
        allowLoopback: false,
        resolveHost: resolvesTo('10.0.4.7'),
      })
    ).rejects.toBeInstanceOf(FeedAddressError);
  });

  it('refuses cloud metadata and a cluster service by address', async () => {
    await expect(
      checkFeedAddress('http://169.254.169.254/latest/meta-data', { allowLoopback: false })
    ).rejects.toThrow('not on the public internet');
  });

  it('refuses a feed named by host when it cannot be looked up here', async () => {
    await expect(
      checkFeedAddress('https://feed.example.com/catalog.csv', { allowLoopback: false })
    ).rejects.toThrow('could not be checked here');
  });

  it('refuses anything that is not http or https', async () => {
    await expect(checkFeedAddress('file:///etc/passwd')).rejects.toThrow('https://');
  });

  it('allows a public feed, and loopback only when building', async () => {
    await expect(
      checkFeedAddress('https://feed.example.com/catalog.csv', {
        resolveHost: resolvesTo('151.101.1.69'),
      })
    ).resolves.toBeInstanceOf(URL);
    await expect(
      checkFeedAddress('http://localhost:8799/feed.csv', {
        allowLoopback: true,
        resolveHost: resolvesTo('127.0.0.1'),
      })
    ).resolves.toBeInstanceOf(URL);
    await expect(
      checkFeedAddress('http://localhost:8799/feed.csv', {
        allowLoopback: false,
        resolveHost: resolvesTo('127.0.0.1'),
      })
    ).rejects.toBeInstanceOf(FeedAddressError);
  });
});
