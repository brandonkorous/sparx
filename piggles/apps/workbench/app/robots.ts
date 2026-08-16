import type { MetadataRoute } from 'next';

// Nothing here is public, and nothing here should ever be indexed.
//
// This is somebody's business: their customers, their money, their stock. Every
// route requires a session, so a crawler would be turned away regardless — but
// "it would fail anyway" is not a reason to leave the sign off the door. A route
// that leaks, a preview deployment left open, a misconfigured proxy: each is a
// day when the only thing standing between an operating console and a search
// index is this file.
//
// It is deliberately a blanket disallow with no exceptions and no sitemap. The
// marketing site (meetpiggles.com) is where crawlers are welcomed, including
// answer-engine ones — see piggles/apps/web/app/robots.ts, which is the opposite
// posture for the opposite reason.
//
// The layout's `robots: { index: false, follow: false }` metadata says the same
// thing per-page. Both, because they fail differently: a meta tag needs the page
// to render, and this file does not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  };
}
