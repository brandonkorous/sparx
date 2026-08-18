import { describe, expect, it } from 'vitest';

import { renderForTarget, renderForTargets } from './renderer.js';
import type { ComposedPost, MediaRef } from './types.js';

const image: MediaRef = { url: 'https://cdn.example/img.jpg', kind: 'image' };
const video: MediaRef = { url: 'https://cdn.example/clip.mp4', kind: 'video' };

const textPost: ComposedPost = { body: 'Fresh batch of sourdough out of the oven.', media: [] };
const imagePost: ComposedPost = {
  body: 'New drop',
  media: [image],
  link: 'https://shop.example/p/1',
};

describe('renderForTarget — happy path', () => {
  it('renders text + resolved media URLs + link for a permissive platform', () => {
    const r = renderForTarget(imagePost, 'facebook_page');
    expect(r.publishable).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.rendered.text).toBe('New drop');
    expect(r.rendered.mediaUrls).toEqual([image.url]);
    expect(r.rendered.link).toBe('https://shop.example/p/1');
  });

  it('omits link + firstComment from the render when absent', () => {
    const r = renderForTarget(textPost, 'linkedin');
    expect(r.rendered.link).toBeUndefined();
    expect(r.rendered.firstComment).toBeUndefined();
  });
});

describe('renderForTarget — per-target overrides', () => {
  it('applies a text override without mutating the base post', () => {
    const r = renderForTarget(imagePost, 'x', { text: 'shorter for X' });
    expect(r.rendered.text).toBe('shorter for X');
    expect(imagePost.body).toBe('New drop'); // base untouched
  });

  it('applies a media override and a first comment', () => {
    const r = renderForTarget(textPost, 'instagram', {
      media: [image],
      firstComment: '#bread #local',
    });
    expect(r.rendered.mediaUrls).toEqual([image.url]);
    expect(r.rendered.firstComment).toBe('#bread #local');
    expect(r.publishable).toBe(true);
  });
});

describe('renderForTarget — validation', () => {
  it('flags text over the platform limit as a blocking error', () => {
    const long: ComposedPost = { body: 'x'.repeat(300), media: [] };
    const r = renderForTarget(long, 'x'); // limit 280
    expect(r.publishable).toBe(false);
    const issue = r.issues.find((i) => i.code === 'text_too_long');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('20'); // 300 - 280
  });

  it('requires media on Instagram (text-only is not publishable)', () => {
    const r = renderForTarget(textPost, 'instagram');
    expect(r.publishable).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain('media_required');
  });

  it('allows text-only on platforms that permit it', () => {
    const r = renderForTarget(textPost, 'facebook_page');
    expect(r.publishable).toBe(true);
  });

  it('flags too many attachments (Google Business allows one)', () => {
    const r = renderForTarget({ body: 'sale', media: [image, image] }, 'google_business');
    expect(r.issues.map((i) => i.code)).toContain('too_many_media');
    expect(r.publishable).toBe(false);
  });

  it('flags unsupported media kinds (Google Business is image-only)', () => {
    const r = renderForTarget({ body: 'sale', media: [video] }, 'google_business');
    const issue = r.issues.find((i) => i.code === 'unsupported_media');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toContain('video');
  });

  it('flags a wholly empty post', () => {
    const r = renderForTarget({ body: '   ', media: [] }, 'facebook_page');
    expect(r.issues.map((i) => i.code)).toContain('empty_post');
    expect(r.publishable).toBe(false);
  });

  it('accumulates multiple errors on one target', () => {
    // Google Business: 1,500-char limit, image-only. A long body + a video trips both.
    const bad: ComposedPost = { body: 'x'.repeat(1600), media: [video] };
    const r = renderForTarget(bad, 'google_business');
    const codes = r.issues.map((i) => i.code);
    expect(codes).toContain('text_too_long');
    expect(codes).toContain('unsupported_media');
    expect(r.publishable).toBe(false);
  });
});

describe('renderForTargets — fan-out', () => {
  it('renders one post independently per target with per-target verdicts', () => {
    const results = renderForTargets(textPost, [
      { platform: 'facebook_page' },
      { platform: 'instagram' }, // will fail: needs media
      { platform: 'linkedin' },
    ]);
    expect(results).toHaveLength(3);
    const byPlatform = Object.fromEntries(results.map((r) => [r.platform, r.publishable]));
    expect(byPlatform.facebook_page).toBe(true);
    expect(byPlatform.instagram).toBe(false);
    expect(byPlatform.linkedin).toBe(true);
  });
});
