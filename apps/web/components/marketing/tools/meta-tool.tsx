'use client';

import * as React from 'react';
import { Input, Textarea } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

function counter(len: number, max: number): React.ReactNode {
  const over = len > max;
  return <span style={{ color: over ? 'var(--color-danger)' : 'var(--color-text-tertiary)' }}>{len}/{max}</span>;
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
          <Field label="Meta description" htmlFor="meta-desc" adornment={counter(description.length, 160)}>
            <Textarea id="meta-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Page URL" htmlFor="meta-url">
            <Input id="meta-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Site name" htmlFor="meta-site">
              <Input id="meta-site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </Field>
            <Field label="OG image URL" htmlFor="meta-img" hint="Optional 1200×630 image.">
              <Input id="meta-img" type="url" value={image} onChange={(e) => setImage(e.target.value)} />
            </Field>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Google preview">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            <span style={{ fontFamily: 'arial, sans-serif', fontSize: '12px', color: '#202124' }}>
              {host}
              {crumb ? <span style={{ color: '#5f6368' }}> › {crumb}</span> : null}
            </span>
            <span style={{ fontFamily: 'arial, sans-serif', fontSize: '20px', color: '#1a0dab', lineHeight: 1.3 }}>
              {clip(title || 'Your page title', 60)}
            </span>
            <span style={{ fontFamily: 'arial, sans-serif', fontSize: '14px', color: '#4d5156', lineHeight: 1.5 }}>
              {clip(description || 'Your meta description shows here.', 160)}
            </span>
          </div>
        </Panel>

        <Panel title="Social card">
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border-default)' }}>
            <div
              style={{
                aspectRatio: '1200 / 630',
                backgroundColor: 'var(--color-bg-subtle)',
                backgroundImage: image ? `url("${image}")` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!image ? (
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-tertiary)' }}>
                  og:image preview
                </span>
              ) : null}
            </div>
            <div style={{ padding: '12px 14px', backgroundColor: 'var(--color-bg-surface)' }}>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-tertiary)' }}>
                {host}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                {clip(title || 'Your page title', 70)}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                {clip(description || 'Your description.', 120)}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
          title="Meta tags"
          action={<CopyButton value={snippet} label="Copy tags" toastLabel="Meta tags copied" color="module" variant="solid" />}
        >
          <pre className="tool-code">{snippet}</pre>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
