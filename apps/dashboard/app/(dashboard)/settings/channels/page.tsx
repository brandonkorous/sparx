import { redirect } from 'next/navigation';

// Sales-channel management moved into the Commerce module — channels are a selling
// surface (connect TikTok Shop, Etsy, Amazon, Meta…), not a platform setting, and
// the API already gates them on Commerce. This redirect keeps old links and
// bookmarks working; the revenue rollup stays in Finance → Channels.
export default function ChannelsSettingsRedirect(): never {
  redirect('/commerce/channels');
}
