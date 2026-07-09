'use client';

import * as React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { ColorPicker, FileUpload, toast } from '@sparx/ui';
import { Button, Input } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import {
  buildSignatureHtml,
  buildSignatureText,
  type SignatureData,
  type SignatureLayout,
} from './lib/signature';
import { useLocalStorageState } from './lib/use-local-storage';
import { readAsDataUrl } from './lib/download';

const DEFAULT_DATA: SignatureData = {
  name: 'Jordan Rivera',
  title: 'Founder',
  company: 'Acme Co.',
  phone: '+1 (555) 012-3456',
  email: 'jordan@acme.co',
  website: 'acme.co',
  accent: '#6366F1',
  photo: null,
  logo: null,
  linkedin: '',
  twitter: '',
  instagram: '',
};

const LAYOUTS: { value: SignatureLayout; label: string }[] = [
  { value: 'horizontal', label: 'Photo' },
  { value: 'stacked', label: 'Stacked' },
  { value: 'minimal', label: 'Minimal' },
];

async function copyHtml(html: string, text: string): Promise<boolean> {
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' }),
        }),
      ]);
      return true;
    }
  } catch {
    /* fall through to execCommand */
  }
  try {
    const holder = document.createElement('div');
    holder.contentEditable = 'true';
    holder.innerHTML = html;
    holder.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(holder);
    const range = document.createRange();
    range.selectNodeContents(holder);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    const ok = document.execCommand('copy');
    sel?.removeAllRanges();
    holder.remove();
    return ok;
  } catch {
    return false;
  }
}

export function SignatureTool() {
  const [data, setData] = useLocalStorageState<SignatureData>('sparx-signature', DEFAULT_DATA);
  const [layout, setLayout] = useLocalStorageState<SignatureLayout>(
    'sparx-signature-layout',
    'horizontal'
  );
  const set = (k: keyof SignatureData, v: string | null) =>
    setData((prev) => ({ ...prev, [k]: v }));

  const html = buildSignatureHtml(data, layout);

  const upload = (key: 'photo' | 'logo') => async (files: File[]) => {
    const file = files[0];
    if (file) set(key, await readAsDataUrl(file));
  };

  const copySignature = async () => {
    const ok = await copyHtml(html, buildSignatureText(data));
    if (ok) toast.success('Signature copied — paste into your email settings');
    else toast.error('Copy failed — use “Copy HTML” and paste the source instead');
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="You">
          <div className="tool-fieldgrid">
            <Field label="Name" htmlFor="sig-name">
              <Input
                id="sig-name"
                value={data.name}
                onChange={(e) => set('name', e.target.value)}
              />
            </Field>
            <Field label="Job title" htmlFor="sig-title">
              <Input
                id="sig-title"
                value={data.title}
                onChange={(e) => set('title', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Company" htmlFor="sig-company">
            <Input
              id="sig-company"
              value={data.company}
              onChange={(e) => set('company', e.target.value)}
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Email" htmlFor="sig-email">
              <Input
                id="sig-email"
                type="email"
                value={data.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
            <Field label="Phone" htmlFor="sig-phone">
              <Input
                id="sig-phone"
                type="tel"
                value={data.phone}
                onChange={(e) => set('phone', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Website" htmlFor="sig-web">
            <Input
              id="sig-web"
              value={data.website}
              onChange={(e) => set('website', e.target.value)}
            />
          </Field>
        </Panel>

        <Panel title="Links">
          <div className="tool-fieldgrid">
            <Field label="LinkedIn URL" htmlFor="sig-li">
              <Input
                id="sig-li"
                value={data.linkedin}
                onChange={(e) => set('linkedin', e.target.value)}
              />
            </Field>
            <Field label="X / Twitter URL" htmlFor="sig-x">
              <Input
                id="sig-x"
                value={data.twitter}
                onChange={(e) => set('twitter', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Instagram URL" htmlFor="sig-ig">
            <Input
              id="sig-ig"
              value={data.instagram}
              onChange={(e) => set('instagram', e.target.value)}
            />
          </Field>
        </Panel>

        <Panel title="Style">
          <Field label="Layout">
            <span style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap' }}>
              {LAYOUTS.map((l) => (
                <Button
                  key={l.value}
                  type="button"
                  size="sm"
                  variant={layout === l.value ? 'solid' : 'outline'}
                  color={layout === l.value ? 'module' : 'neutral'}
                  onClick={() => setLayout(l.value)}
                >
                  {l.label}
                </Button>
              ))}
            </span>
          </Field>
          <Field label="Accent color">
            <ColorPicker
              value={data.accent}
              onChange={(c) => set('accent', c)}
              ariaLabel="Accent color"
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Photo" hint="Used by the Photo layout.">
              {data.photo ? (
                <Button
                  type="button"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  onClick={() => set('photo', null)}
                >
                  <Trash2 className="h-4 w-4" /> Remove photo
                </Button>
              ) : (
                <FileUpload
                  accept="image/*"
                  maxSize={4 * 1024 * 1024}
                  onFilesChange={upload('photo')}
                />
              )}
            </Field>
            <Field label="Logo" hint="Optional company mark.">
              {data.logo ? (
                <Button
                  type="button"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  onClick={() => set('logo', null)}
                >
                  <Trash2 className="h-4 w-4" /> Remove logo
                </Button>
              ) : (
                <FileUpload
                  accept="image/*"
                  maxSize={4 * 1024 * 1024}
                  onFilesChange={upload('logo')}
                />
              )}
            </Field>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Preview">
          <div
            style={{
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-base-300)',
              overflowX: 'auto',
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div className="mkt-cluster" style={{ gap: '10px' }}>
            <Button type="button" color="module" variant="solid" size="sm" onClick={copySignature}>
              <Copy className="h-4 w-4" />
              Copy signature
            </Button>
            <CopyButton value={html} label="Copy HTML" toastLabel="HTML source copied" />
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              margin: 0,
            }}
          >
            “Copy signature” puts formatted HTML on your clipboard — paste it straight into Gmail,
            Outlook, or Apple Mail signature settings. Your details are saved on this device only.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
