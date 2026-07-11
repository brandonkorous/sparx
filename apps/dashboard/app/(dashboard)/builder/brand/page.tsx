import { redirect } from 'next/navigation';

// Brand & Theme retired (docs/118): the silica builder now owns theme (colours,
// type, shape) natively — its studio captures `site.theme` on every save/publish
// and the storefront frame serves it. The surface's only remaining unique job was
// site IDENTITY (name, tagline, logo, favicon, socials), which moved to its own
// Site settings surface. This route redirects there so old links/bookmarks land
// somewhere sensible. The former ThemeCenter components still live under `_brand/`
// (unreferenced by nav) until silica theme parity is confirmed.
export default function BuilderBrandRedirect() {
  redirect('/builder/site');
}
