// The one-post→N-platforms renderer (docs/133 §8).
//
// Takes a tenant's platform-agnostic ComposedPost + a per-target override and produces
// the RenderedPost the adapter publishes, PLUS the validation issues that drive the
// composer's author-time preview ("24 over X's limit", "Instagram needs an image").
//
// Pure + deterministic — no I/O, no platform calls. The SAME function runs in the
// composer (client, as-you-type) and in the worker (server, as a pre-publish guard),
// so what the tenant sees at author time is exactly what the worker enforces. Media is
// assumed already resolved to public URLs upstream (the media service turns
// `mediaAssetIds` → CDN URLs before this runs), keeping the renderer free of any
// service dependency.

import { constraintsFor } from './constraints.js';
import type { ComposedPost, RenderedPost, SocialPlatform, TargetOverride } from './types.js';

/** A single validation finding. `error` blocks publishing to that target; `warning`
 *  is advisory (the tenant may still publish). */
export interface RenderIssue {
  severity: 'error' | 'warning';
  code: 'empty_post' | 'text_too_long' | 'media_required' | 'too_many_media' | 'unsupported_media';
  message: string;
}

/** The render of a ComposedPost for ONE target. `publishable` is false iff any issue
 *  is an error — the worker skips (and the composer disables) a non-publishable
 *  target rather than sending a doomed request. */
export interface RenderedTarget {
  platform: SocialPlatform;
  rendered: RenderedPost;
  issues: RenderIssue[];
  publishable: boolean;
}

/** One target to render for — its platform + optional per-target override. */
export interface RenderTargetSpec {
  platform: SocialPlatform;
  override?: TargetOverride;
}

/** Render a ComposedPost for one platform, applying an optional override, and
 *  validate it against that platform's constraints. */
export function renderForTarget(
  post: ComposedPost,
  platform: SocialPlatform,
  override?: TargetOverride
): RenderedTarget {
  const constraints = constraintsFor(platform);

  const text = override?.text ?? post.body;
  const media = override?.media ?? post.media;
  const firstComment = override?.firstComment;

  const issues: RenderIssue[] = [];

  const trimmedLen = text.trim().length;
  if (trimmedLen === 0 && media.length === 0) {
    issues.push({
      severity: 'error',
      code: 'empty_post',
      message: 'A post needs text or at least one image or video.',
    });
  }

  if (text.length > constraints.maxTextLength) {
    issues.push({
      severity: 'error',
      code: 'text_too_long',
      message: `Too long for ${platform} by ${text.length - constraints.maxTextLength} characters (limit ${constraints.maxTextLength}).`,
    });
  }

  if (constraints.requiresMedia && media.length === 0) {
    issues.push({
      severity: 'error',
      code: 'media_required',
      message: `${platform} can't publish a text-only post — add an image or video.`,
    });
  }

  if (media.length > constraints.maxMediaCount) {
    issues.push({
      severity: 'error',
      code: 'too_many_media',
      message: `${platform} allows at most ${constraints.maxMediaCount} attachment${constraints.maxMediaCount === 1 ? '' : 's'} (this post has ${media.length}).`,
    });
  }

  const unsupported = media.filter((m) => !constraints.supportedMedia.includes(m.kind));
  if (unsupported.length > 0) {
    const kinds = [...new Set(unsupported.map((m) => m.kind))].join(' and ');
    issues.push({
      severity: 'error',
      code: 'unsupported_media',
      message: `${platform} doesn't accept ${kinds} attachments.`,
    });
  }

  const rendered: RenderedPost = {
    text,
    mediaUrls: media.map((m) => m.url),
    ...(post.link ? { link: post.link } : {}),
    ...(firstComment ? { firstComment } : {}),
  };

  return {
    platform,
    rendered,
    issues,
    publishable: !issues.some((i) => i.severity === 'error'),
  };
}

/** Render a ComposedPost for many targets at once — the composer's fan-out preview. */
export function renderForTargets(
  post: ComposedPost,
  targets: RenderTargetSpec[]
): RenderedTarget[] {
  return targets.map((t) => renderForTarget(post, t.platform, t.override));
}
