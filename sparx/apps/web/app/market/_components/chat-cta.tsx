'use client';

// "Chat with {publisher}" CTA for the marketplace listing detail (docs/72 §"Chat
// module integration"). A secondary action beneath the signup CTA: it opens the
// live-chat panel pointed at the publisher's tenant, tagging the conversation
// `source: 'sparx_market'` so the tenant sees the lead originated in the
// marketplace rather than on their own site.
//
// The widget is mounted launcher-less and controlled — the marketing site has no
// floating bubble; this button is the sole entry point. It mounts on render so
// the widget preloads its public config, making the open instant on click.

import { useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { ChatWidget } from '@wizeworks/chat-widget';

export interface MarketChatCtaProps {
  /** Browser-reachable api-rest origin (https://api.sparx.works). */
  apiUrl: string;
  /** The publisher tenant's slug — identifies the tenant on every public call. */
  tenantSlug: string;
  /** Publisher display name — the button label + chat panel header. */
  publisherName: string;
  /** Listing accent, used as the panel accent until the tenant's own chat color
   *  loads from config. */
  accentColor?: string | null;
}

export function MarketChatCta({
  apiUrl,
  tenantSlug,
  publisherName,
  accentColor,
}: MarketChatCtaProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="outline"
        size="lg"
        block
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        Chat with {publisherName}
      </Button>
      <ChatWidget
        apiUrl={apiUrl}
        tenantSlug={tenantSlug}
        title={publisherName}
        accentColor={accentColor}
        source="sparx_market"
        hideLauncher
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
