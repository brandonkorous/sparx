'use client';

import * as React from 'react';
import { Copy, Trash2 } from 'lucide-react';
import { toast } from '@sparx/ui';
import { Button, FileUpload, Input, Text } from '@wizeworks/silicaui-react';
import {
  Workbench,
  ControlsPane,
  OutputPane,
  Panel,
  Field,
  CopyButton,
  HexColorField,
} from './ui-kit';
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

type SetField = (key: keyof SignatureData, value: string | null) => void;

/** One labeled text input bound to a `SignatureData` key. */
function TextField({
  id,
  label,
  field,
  data,
  set,
  type,
  hint,
}: {
  id: string;
  label: string;
  field: keyof SignatureData;
  data: SignatureData;
  set: SetField;
  type?: string;
  hint?: string;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Input
        id={id}
        type={type}
        value={data[field] ?? ''}
        onChange={(e) => set(field, e.target.value)}
      />
    </Field>
  );
}

/** An image slot: a dropzone until something is picked, then a Remove button. */
function ImageField({
  label,
  hint,
  value,
  onFiles,
  onClear,
  clearLabel,
}: {
  label: string;
  hint: string;
  value: string | null;
  onFiles: (files: File[]) => void;
  onClear: () => void;
  clearLabel: string;
}) {
  return (
    <Field label={label} hint={hint}>
      {value ? (
        <Button type="button" variant="outline" color="neutral" size="sm" onClick={onClear}>
          <Trash2 className="h-4 w-4" /> {clearLabel}
        </Button>
      ) : (
        <FileUpload accept="image/*" maxSize={4 * 1024 * 1024} onFilesChange={onFiles} />
      )}
    </Field>
  );
}

export function SignatureTool() {
  const [data, setData] = useLocalStorageState<SignatureData>('sparx-signature', DEFAULT_DATA);
  const [layout, setLayout] = useLocalStorageState<SignatureLayout>(
    'sparx-signature-layout',
    'horizontal'
  );
  const set: SetField = (k, v) => setData((prev) => ({ ...prev, [k]: v }));

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

  const field = (id: string, label: string, key: keyof SignatureData, type?: string) => (
    <TextField id={id} label={label} field={key} data={data} set={set} type={type} />
  );

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="You">
          <div className="tool-fieldgrid">
            {field('sig-name', 'Name', 'name')}
            {field('sig-title', 'Job title', 'title')}
          </div>
          {field('sig-company', 'Company', 'company')}
          <div className="tool-fieldgrid">
            {field('sig-email', 'Email', 'email', 'email')}
            {field('sig-phone', 'Phone', 'phone', 'tel')}
          </div>
          {field('sig-web', 'Website', 'website')}
        </Panel>

        <Panel title="Links">
          <div className="tool-fieldgrid">
            {field('sig-li', 'LinkedIn URL', 'linkedin')}
            {field('sig-x', 'X / Twitter URL', 'twitter')}
          </div>
          {field('sig-ig', 'Instagram URL', 'instagram')}
        </Panel>

        <Panel title="Style">
          <Field label="Layout">
            <span className="inline-flex flex-wrap gap-1.5">
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
            <HexColorField
              value={data.accent}
              onChange={(c) => set('accent', c)}
              label="Accent color"
            />
          </Field>
          <div className="tool-fieldgrid">
            <ImageField
              label="Photo"
              hint="Used by the Photo layout."
              value={data.photo}
              onFiles={upload('photo')}
              onClear={() => set('photo', null)}
              clearLabel="Remove photo"
            />
            <ImageField
              label="Logo"
              hint="Optional company mark."
              value={data.logo}
              onFiles={upload('logo')}
              onClear={() => set('logo', null)}
              clearLabel="Remove logo"
            />
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Preview">
          {/* The signature itself is inline-styled table markup — that is a hard
              requirement of email clients, not a style choice, so it is rendered
              verbatim. The white plate is deliberate: it simulates the email
              client's canvas, so the preview must NOT follow the site theme. */}
          <div
            className="border-base-300 overflow-x-auto rounded-lg border bg-white p-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <div className="flex flex-wrap items-center gap-2.5">
            <Button type="button" color="module" variant="solid" size="sm" onClick={copySignature}>
              <Copy className="h-4 w-4" />
              Copy signature
            </Button>
            <CopyButton value={html} label="Copy HTML" toastLabel="HTML source copied" />
          </div>
          <Text variant="caption" className="text-ink-muted m-0">
            “Copy signature” puts formatted HTML on your clipboard — paste it straight into Gmail,
            Outlook, or Apple Mail signature settings. Your details are saved on this device only.
          </Text>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
