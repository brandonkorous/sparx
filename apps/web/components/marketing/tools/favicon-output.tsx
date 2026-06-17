'use client';

import * as React from 'react';
import { Download, Package } from 'lucide-react';
import { Button } from '@sparx/ui';
import { Panel, CopyButton } from './ui-kit';
import { FaviconPreviews } from './favicon-previews';
import type { FaviconResult } from './lib/favicon';
import { downloadBlob, downloadText } from './lib/download';
import { createZip } from './lib/zip';

const encoder = new TextEncoder();

/** Map every generated asset to an object URL, revoked when the result changes. */
function useAssetUrls(result: FaviconResult | null): Record<string, string> {
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  React.useEffect(() => {
    if (!result) {
      setUrls({});
      return;
    }
    const next: Record<string, string> = {};
    for (const asset of result.assets) next[asset.name] = URL.createObjectURL(asset.blob);
    setUrls(next);
    return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url));
  }, [result]);
  return urls;
}

export interface FaviconOutputProps {
  result: FaviconResult;
  appName: string;
  domain: string;
  themeColor: string;
}

export function FaviconOutput({ result, appName, domain, themeColor }: FaviconOutputProps) {
  const urls = useAssetUrls(result);
  const [mode, setMode] = React.useState<'html' | 'next'>('html');

  const snippet = mode === 'html' ? result.htmlSnippet : result.nextManifestSnippet;

  const small = urls['favicon-32x32.png'];
  const apple = urls['apple-touch-icon.png'];
  const maskable = urls['maskable-512.png'];

  const downloadZip = () => {
    const entries = [
      ...result.assets.map((a) => ({ name: a.name, data: a.bytes })),
      { name: 'site.webmanifest', data: encoder.encode(result.manifest) },
      { name: 'head-tags.html', data: encoder.encode(result.htmlSnippet) },
    ];
    downloadBlob(createZip(entries), 'favicons.zip');
  };

  return (
    <>
      <Panel title="Preview">
        {small && apple && maskable ? (
          <FaviconPreviews
            small={small}
            apple={apple}
            maskable={maskable}
            themeColor={themeColor}
            name={appName || 'Your site'}
            domain={domain || 'yoursite.com'}
          />
        ) : null}
      </Panel>

      <Panel
        title="The package"
        action={
          <Button type="button" color="module" variant="solid" size="sm" onClick={downloadZip}>
            <Package className="h-4 w-4" />
            Download .zip
          </Button>
        }
      >
        <ul
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '10px',
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {result.assets.map((asset) => (
            <li
              key={asset.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              <span
                className="tool-checkerboard"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '34px',
                  height: '34px',
                  borderRadius: '6px',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {urls[asset.name] ? (
                  <img src={urls[asset.name]} alt="" width={28} height={28} />
                ) : null}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11.5px',
                    color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {asset.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '11px',
                    color: 'var(--color-text-tertiary)',
                  }}
                >
                  {asset.label}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                shape="square"
                aria-label={`Download ${asset.name}`}
                onClick={() => downloadBlob(asset.blob, asset.name)}
              >
                <Download className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          color="neutral"
          size="sm"
          onClick={() =>
            downloadText(result.manifest, 'site.webmanifest', 'application/manifest+json')
          }
        >
          <Download className="h-4 w-4" />
          site.webmanifest
        </Button>
      </Panel>

      <Panel
        title="Add it to your site"
        action={
          <span style={{ display: 'inline-flex', gap: '6px' }}>
            <Button
              type="button"
              size="sm"
              variant={mode === 'html' ? 'solid' : 'outline'}
              color={mode === 'html' ? 'module' : 'neutral'}
              onClick={() => setMode('html')}
            >
              HTML
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'next' ? 'solid' : 'outline'}
              color={mode === 'next' ? 'module' : 'neutral'}
              onClick={() => setMode('next')}
            >
              Next.js
            </Button>
          </span>
        }
      >
        <pre className="tool-code">{snippet}</pre>
        <div>
          <CopyButton value={snippet} label="Copy snippet" toastLabel="Snippet copied" />
        </div>
      </Panel>
    </>
  );
}
