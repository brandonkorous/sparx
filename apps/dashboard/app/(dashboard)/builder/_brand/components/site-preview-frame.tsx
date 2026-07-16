'use client';

// Live "Site" preview for the Brand & Theme center — the second half of the
// preview toggle (the first is the component showcase). It embeds the tenant's
// real storefront (apps/site) in an iframe and re-themes it on every brand edit,
// so the tenant sees their identity applied to their ACTUAL site, not just a
// generic component board.
//
// How it stays live without a reload: the storefront mounts <PreviewBridge>
// (apps/site/components/preview-bridge.tsx), which — when loaded with a
// `?sparxSitePreview=` token — opens a postMessage channel. On its `…-ready`
// handshake we push the compiled theme CSS (`sparx-preview-theme`) and the
// light/dark flip (`sparx-preview-mode`); the bridge injects the CSS at :root so
// it wins over the server-rendered theme. Every later brand keystroke recompiles
// `css` upstream and re-posts here — the iframe re-themes instantly.
//
// The token also makes api-rest serve the site's DRAFT composition (so the
// preview shows the work-in-progress site), scoped to `propertySlug` so a
// non-primary site previews ITS own site (docs/49).

import * as React from 'react';
import { Button } from '@sparx/ui';
import { RotateCw } from 'lucide-react';
import { mintBuilderPreviewToken } from '../../_lib/actions';

type Mode = 'light' | 'dark';

export interface SitePreviewFrameProps {
  /** Public origin of the active site (dev → http://localhost:3004). */
  origin: string;
  tenantSlug: string;
  /** Active web property slug — scopes the preview to a non-primary site. */
  propertySlug: string | null;
  /** Compiled theme CSS scoped to `:root` (NOT the showcase's `#st-theme-preview`),
   *  posted to the iframe so the live site re-themes. */
  css: string;
  mode: Mode;
  /** Extra controls rendered at the right of the header (the Components|Site
   *  surface toggle owned by the parent). */
  headerExtra?: React.ReactNode;
}

export function SitePreviewFrame({
  origin,
  tenantSlug,
  propertySlug,
  css,
  mode,
  headerExtra,
}: SitePreviewFrameProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const [src, setSrc] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  // Whether the iframe's PreviewBridge has handshaked. A ref (not state) so the
  // post-on-change effect reads the latest value without re-subscribing.
  const readyRef = React.useRef(false);

  // Push the current theme + mode to the iframe. No-op until the bridge is ready.
  const post = React.useCallback(() => {
    const win = iframeRef.current?.contentWindow;
    if (!win || !readyRef.current) return;
    win.postMessage({ type: 'sparx-preview-theme', css }, origin);
    win.postMessage({ type: 'sparx-preview-mode', mode }, origin);
  }, [css, mode, origin]);

  // Mint a fresh preview token and (re)build the iframe src. Called on mount and
  // by the manual Reload control. A failed mint still previews — the bridge
  // activates on the param's presence; the site just falls back to its published
  // (or empty-store) content instead of the draft.
  const load = React.useCallback(() => {
    readyRef.current = false;
    setStatus('loading');
    void (async () => {
      const res = await mintBuilderPreviewToken();
      const token = res.ok && res.data ? res.data.token : 'preview';
      const params = new URLSearchParams({ tenant: tenantSlug });
      if (propertySlug) params.set('property', propertySlug);
      params.set('sparxSitePreview', token);
      setSrc(`${origin}/?${params.toString()}`);
    })();
  }, [origin, tenantSlug, propertySlug]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Listen for the bridge handshake from THIS iframe's origin, then push theme.
  React.useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin) return;
      const data = e.data as { type?: string } | null;
      if (data?.type === 'sparx-preview-ready') {
        readyRef.current = true;
        setStatus('ready');
        post();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [origin, post]);

  // Re-push whenever the compiled theme or mode changes (after the handshake).
  React.useEffect(() => {
    post();
  }, [post]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-base-content text-sm font-semibold">Live site preview</span>
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="ghost"
            leftIcon={<RotateCw className="h-3.5 w-3.5" />}
            onClick={load}
          >
            Reload
          </Button>
          {headerExtra}
        </div>
      </div>

      <div className="border-base-300 relative overflow-hidden rounded-[var(--radius-lg)] border shadow-sm">
        {status === 'loading' ? (
          <div className="bg-base-100 absolute inset-0 z-10 flex items-center justify-center">
            <span className="text-base-content text-sm">Loading your site…</span>
          </div>
        ) : null}
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            title="Live site preview"
            className="bg-base-100 h-[760px] w-full"
            // Same-origin so the bridge can read cookies/postMessage; allow forms
            // so interactive chrome doesn't error in the preview.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setStatus('error')}
          />
        ) : null}
      </div>

      <p className="text-base-content text-xs">
        Your live site, re-themed as you edit. Content reflects your latest saved draft —{' '}
        <strong>Publish</strong> to make it public.
      </p>
    </div>
  );
}
