'use client';

import * as React from 'react';
import { Input, Textarea } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton, CodeBlock } from './ui-kit';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function counter(len: number, max: number): React.ReactNode {
  return (
    <span className={len > max ? 'text-danger' : 'text-ink-subtle'}>
      {len}/{max}
    </span>
  );
}

export function MetaTool() {
  const [title, setTitle] = React.useState('sparx — the modular content & commerce OS');
  const [description, setDescription] = React.useState(
    'One platform for storefront, CRM, CMS, email, and B2B. Activate only what you need, on one data layer and one bill.'
  );
  const [url, setUrl] = React.useState('https://sparx.works');
  const [siteName, setSiteName] = React.useState('sparx');
  const [image, setImage] = React.useState('');

  let host = url;
  let crumb = '';
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    host = u.hostname.replace(/^www\./, '');
    crumb = u.pathname === '/' ? '' : u.pathname.split('/').filter(Boolean).join(' › ');
  } catch {
    /* keep raw */
  }

  const lines = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:type" content="website">`,
    siteName && `<meta property="og:site_name" content="${esc(siteName)}">`,
    image && `<meta property="og:image" content="${esc(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
    image && `<meta name="twitter:image" content="${esc(image)}">`,
  ].filter(Boolean);
  const snippet = lines.join('\n');

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Page details">
          <Field label="Title tag" htmlFor="meta-title" adornment={counter(title.length, 60)}>
            <Input id="meta-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field
            label="Meta description"
            htmlFor="meta-desc"
            adornment={counter(description.length, 160)}
          >
            <Textarea
              id="meta-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="Page URL" htmlFor="meta-url">
            <Input id="meta-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Site name" htmlFor="meta-site">
              <Input
                id="meta-site"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
              />
            </Field>
            <Field label="OG image URL" htmlFor="meta-img" hint="Optional 1200×630 image.">
              <Input
                id="meta-img"
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
              />
            </Field>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Google preview">
          {/* SIMULATION — a Google result. Deliberately NOT silica: Google's own
              arial + link/URL/snippet hexes, so the preview reads as the real thing. */}
          <div className="flex flex-col gap-[3px] font-[arial,sans-serif]">
            <span className="text-[12px] text-[#202124]">
              {host}
              {crumb ? <span className="text-[#5f6368]"> › {crumb}</span> : null}
            </span>
            <span className="text-[20px] leading-[1.3] text-[#1a0dab]">
              {clip(title || 'Your page title', 60)}
            </span>
            <span className="text-[14px] leading-[1.5] text-[#4d5156]">
              {clip(description || 'Your meta description shows here.', 160)}
            </span>
          </div>
        </Panel>

        <Panel title="Social card">
          {/* SIMULATION — a social share unfurl (image over a compact meta block).
              Kept bespoke so it reads as another platform's card, not a sparx Card. */}
          <div className="border-base-300 overflow-hidden rounded-lg border">
            <div
              className="bg-base-200 flex aspect-[1200/630] items-center justify-center bg-cover bg-center"
              style={image ? { backgroundImage: `url("${image}")` } : undefined}
            >
              {!image ? (
                <span className="text-ink-subtle text-[13px]">og:image preview</span>
              ) : null}
            </div>
            <div className="bg-base-100 px-3.5 py-3">
              <div className="text-ink-subtle text-[11px] uppercase">{host}</div>
              <div className="text-base-content text-[15px] font-semibold">
                {clip(title || 'Your page title', 70)}
              </div>
              <div className="text-ink-muted text-[13px]">
                {clip(description || 'Your description.', 120)}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Meta tags"
          action={
            <CopyButton
              value={snippet}
              label="Copy tags"
              toastLabel="Meta tags copied"
              color="module"
              variant="solid"
            />
          }
        >
          <CodeBlock>{snippet}</CodeBlock>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
