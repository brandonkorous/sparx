'use client';

import * as React from 'react';
import { Bookmark, Download, Trash2 } from 'lucide-react';
import { toast } from '@sparx/ui';
import { Button, Input, Switch } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { renderQrCanvas, renderQrSvg, type QrStyle } from './lib/qr';
import { useLocalStorageState } from './lib/use-local-storage';
import { downloadBlob, downloadText } from './lib/download';

interface UtmParams {
  source: string;
  medium: string;
  campaign: string;
  term: string;
  content: string;
}

interface SavedLink {
  url: string;
  campaign: string;
}

const EMPTY: UtmParams = { source: '', medium: '', campaign: '', term: '', content: '' };

const PRESETS = [
  { label: 'Google Ads', source: 'google', medium: 'cpc' },
  { label: 'Facebook', source: 'facebook', medium: 'paid_social' },
  { label: 'Instagram', source: 'instagram', medium: 'social' },
  { label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { label: 'X / Twitter', source: 'x', medium: 'social' },
  { label: 'Newsletter', source: 'newsletter', medium: 'email' },
];

const QR_STYLE: QrStyle = {
  fg: '#0A0A0A',
  bg: '#FFFFFF',
  ecc: 'M',
  margin: 2,
  width: 512,
  logo: null,
};

function normalizeBase(input: string): string {
  const v = input.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function buildUtm(base: string, p: UtmParams, lower: boolean): { url: string; valid: boolean } {
  const norm = normalizeBase(base);
  if (!norm) return { url: '', valid: false };
  try {
    const u = new URL(norm);
    const xf = (s: string) => (lower ? s.trim().toLowerCase() : s.trim());
    const entries: [string, string][] = [
      ['utm_source', p.source],
      ['utm_medium', p.medium],
      ['utm_campaign', p.campaign],
      ['utm_term', p.term],
      ['utm_content', p.content],
    ];
    for (const [k, val] of entries) if (val.trim()) u.searchParams.set(k, xf(val));
    return { url: u.toString(), valid: true };
  } catch {
    return { url: '', valid: false };
  }
}

export function UtmTool() {
  const [base, setBase] = React.useState('');
  const [p, setP] = React.useState<UtmParams>(EMPTY);
  const [lower, setLower] = React.useState(true);
  const [history, setHistory] = useLocalStorageState<SavedLink[]>('sparx-utm-history', []);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const { url, valid } = buildUtm(base, p, lower);
  const ready =
    valid && (p.source.trim() !== '' || p.medium.trim() !== '' || p.campaign.trim() !== '');
  const set = (k: keyof UtmParams, v: string) => setP((prev) => ({ ...prev, [k]: v }));

  React.useEffect(() => {
    if (!ready || !canvasRef.current) return;
    const canvas = canvasRef.current;
    void renderQrCanvas(canvas, url, QR_STYLE);
  }, [url, ready]);

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'utm-qr.png');
    }, 'image/png');
  };

  const downloadSvg = async () => {
    downloadText(await renderQrSvg(url, QR_STYLE), 'utm-qr.svg', 'image/svg+xml');
  };

  const save = () => {
    if (!ready) return;
    setHistory((prev) =>
      [{ url, campaign: p.campaign || '(untitled)' }, ...prev.filter((l) => l.url !== url)].slice(
        0,
        12
      )
    );
    toast.success('Saved to your link history');
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Destination">
          <Field label="Website URL" htmlFor="utm-base" hint="Where the link should send people.">
            <Input
              id="utm-base"
              type="url"
              inputMode="url"
              placeholder="https://yoursite.com/landing"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
          </Field>
          {base.trim() && !valid ? (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '12.5px',
                color: 'var(--color-danger)',
              }}
            >
              That doesn&apos;t look like a valid URL.
            </span>
          ) : null}
        </Panel>

        <Panel title="Campaign parameters">
          <div className="mkt-cluster" style={{ gap: '8px' }}>
            {PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="outline"
                color="neutral"
                onClick={() =>
                  setP((prev) => ({ ...prev, source: preset.source, medium: preset.medium }))
                }
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="tool-fieldgrid">
            <Field label="Source" htmlFor="utm-source" hint="utm_source — e.g. google">
              <Input
                id="utm-source"
                value={p.source}
                onChange={(e) => set('source', e.target.value)}
              />
            </Field>
            <Field label="Medium" htmlFor="utm-medium" hint="utm_medium — e.g. cpc">
              <Input
                id="utm-medium"
                value={p.medium}
                onChange={(e) => set('medium', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Campaign" htmlFor="utm-campaign" hint="utm_campaign — e.g. spring_sale">
            <Input
              id="utm-campaign"
              value={p.campaign}
              onChange={(e) => set('campaign', e.target.value)}
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Term" htmlFor="utm-term" hint="utm_term — paid keyword (optional)">
              <Input id="utm-term" value={p.term} onChange={(e) => set('term', e.target.value)} />
            </Field>
            <Field
              label="Content"
              htmlFor="utm-content"
              hint="utm_content — a/b variant (optional)"
            >
              <Input
                id="utm-content"
                value={p.content}
                onChange={(e) => set('content', e.target.value)}
              />
            </Field>
          </div>
          <Field
            label="Force lowercase"
            hint="Analytics treats Source and source as different. Keeping it lowercase avoids split reports."
          >
            <Switch checked={lower} onCheckedChange={setLower} />
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Your campaign URL">
          {ready ? (
            <>
              <p
                className="tool-code"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: 'none' }}
              >
                {url}
              </p>
              <div className="mkt-cluster" style={{ gap: '10px' }}>
                <CopyButton
                  value={url}
                  label="Copy link"
                  toastLabel="Link copied"
                  color="module"
                  variant="solid"
                />
                <Button type="button" variant="outline" color="neutral" size="sm" onClick={save}>
                  <Bookmark className="h-4 w-4" />
                  Save
                </Button>
              </div>
              <div
                className="tool-checkerboard"
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '20px',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div style={{ position: 'relative', width: '160px', height: '160px' }}>
                  <canvas
                    ref={canvasRef}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                  />
                </div>
              </div>
              <div className="mkt-cluster" style={{ gap: '10px' }}>
                <Button
                  type="button"
                  color="module"
                  variant="solid"
                  size="sm"
                  onClick={downloadPng}
                >
                  <Download className="h-4 w-4" />
                  PNG
                </Button>
                <Button
                  type="button"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  onClick={downloadSvg}
                >
                  <Download className="h-4 w-4" />
                  SVG
                </Button>
                <CopyButton value={url} label="Copy content" toastLabel="Link copied" />
              </div>
            </>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '14px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              Add a URL and at least a source, medium, or campaign to build your link.
            </span>
          )}
        </Panel>

        {history.length > 0 ? (
          <Panel
            title="Saved links"
            action={
              <Button
                type="button"
                variant="ghost"
                color="neutral"
                size="sm"
                onClick={() => setHistory([])}
              >
                Clear all
              </Button>
            }
          >
            <ul
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                listStyle: 'none',
                margin: 0,
                padding: 0,
              }}
            >
              {history.map((link) => (
                <li
                  key={link.url}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-base-300)',
                  }}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: '13px',
                        color: 'var(--color-base-content)',
                      }}
                    >
                      {link.campaign}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {link.url}
                    </span>
                  </span>
                  <CopyButton
                    value={link.url}
                    label=""
                    copiedLabel=""
                    aria-label="Copy link"
                    shape="square"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    color="neutral"
                    size="sm"
                    shape="square"
                    aria-label="Remove link"
                    onClick={() => setHistory((prev) => prev.filter((l) => l.url !== link.url))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </OutputPane>
    </Workbench>
  );
}
