'use client';

import * as React from 'react';
import { Download, Package } from 'lucide-react';
import { Button, Card, CardBody } from '@wizeworks/silicaui-react';
import { Text } from '../primitives';
import { Panel, CopyButton, CodeBlock } from './ui-kit';
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
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2.5 p-0">
          {result.assets.map((asset) => (
            <li key={asset.name}>
              <Card className="h-full">
                <CardBody className="flex-row items-center gap-2.5 p-2">
                  <span className="tool-checkerboard inline-flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center overflow-hidden rounded-md">
                    {urls[asset.name] ? (
                      <img src={urls[asset.name]} alt="" width={28} height={28} />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text as="span" size={12} mono className="truncate">
                      {asset.name}
                    </Text>
                    <Text as="span" size={11}>
                      {asset.label}
                    </Text>
                  </span>
                  <Button
                    type="button"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    shape="square"
                    aria-label={`Download ${asset.name}`}
                    onClick={() => downloadBlob(asset.blob, asset.name)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
        <Button
          color="neutral"
          type="button"
          variant="outline"
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
          <span className="inline-flex gap-1.5">
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
        <CodeBlock>{snippet}</CodeBlock>
        <div>
          <CopyButton value={snippet} label="Copy snippet" toastLabel="Snippet copied" />
        </div>
      </Panel>
    </>
  );
}
