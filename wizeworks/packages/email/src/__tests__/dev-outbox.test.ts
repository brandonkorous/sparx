// Every console send lands in the dev outbox, so a link in an email sent by any
// process can be opened from the screen being tested (piggles persona issue 980).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { consoleProvider } from '../providers/console';
import { devOutboxFileName, linksIn } from '../providers/dev-outbox';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-outbox-'));
  process.env.SPARX_DEV_OUTBOX = dir;
});

afterEach(() => {
  delete process.env.SPARX_DEV_OUTBOX;
  fs.rmSync(dir, { recursive: true, force: true });
});

const email = {
  to: 'p09.rosalind@piggles.test',
  from: 'Piggles <hello@piggles.test>',
  replyTo: 'editors@marrowreview.test',
  subject: 'Confirm your email address',
  templateId: 'email-verification',
  html: '<p>Press <a href="http://localhost:3021/api/auth/verify-email?token=abc">confirm</a></p>',
  text: 'Press this link: http://localhost:3021/api/auth/verify-email?token=abc. It works for an hour.',
};

describe('the dev outbox', () => {
  it('keeps every console send as a file, with its links', async () => {
    await consoleProvider.send(email);
    const files = fs.readdirSync(dir);
    expect(files.filter((f) => f.endsWith('.json'))).toHaveLength(1);
    expect(files.filter((f) => f.endsWith('.html'))).toHaveLength(1);
    const saved = JSON.parse(
      fs.readFileSync(
        path.join(
          dir,
          files.find((f) => f.endsWith('.json'))!
        ),
        'utf8'
      )
    ) as { to: string; replyTo: string; subject: string; links: string[] };
    expect(saved.to).toBe('p09.rosalind@piggles.test');
    expect(saved.replyTo).toBe('editors@marrowreview.test');
    expect(saved.subject).toBe('Confirm your email address');
    expect(saved.links).toEqual(['http://localhost:3021/api/auth/verify-email?token=abc']);
  });

  it('names a file by time, then who it went to, then what it was', () => {
    expect(
      devOutboxFileName({
        acceptedAt: '2026-10-11T07:01:33.212Z',
        to: 'P09.Rosalind@piggles.test',
        templateId: 'email-verification',
        id: 'con_1',
      })
    ).toBe('2026-10-11T07-01-33-212Z__p09.rosalind@piggles.test__email-verification__con_1');
  });

  it('reads each link once, without the full stop after it', () => {
    expect(linksIn('Go to https://a.test/x. Or https://a.test/x, or http://b.test/y')).toEqual([
      'https://a.test/x',
      'http://b.test/y',
    ]);
  });
});
