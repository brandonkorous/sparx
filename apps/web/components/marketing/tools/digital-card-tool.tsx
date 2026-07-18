'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button, Input, Text } from '@wizeworks/silicaui-react';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { renderQrCanvas } from './lib/qr';
import { downloadBlob, downloadText } from './lib/download';
import { useLocalStorageState } from './lib/use-local-storage';

interface CardData {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
}

const DEFAULT: CardData = {
  firstName: 'Jordan',
  lastName: 'Rivera',
  title: 'Founder',
  company: 'Acme Co.',
  phone: '+1 555 012 3456',
  email: 'jordan@acme.co',
  website: 'acme.co',
};

function buildVcard(d: CardData): string {
  const full = `${d.firstName} ${d.lastName}`.trim();
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${d.lastName};${d.firstName}`, `FN:${full}`];
  if (d.company) lines.push(`ORG:${d.company}`);
  if (d.title) lines.push(`TITLE:${d.title}`);
  if (d.phone) lines.push(`TEL;TYPE=CELL:${d.phone}`);
  if (d.email) lines.push(`EMAIL;TYPE=INTERNET:${d.email}`);
  if (d.website) {
    const url = /^https?:\/\//.test(d.website) ? d.website : `https://${d.website}`;
    lines.push(`URL:${url}`);
  }
  lines.push('END:VCARD');
  return lines.join('\n');
}

export function DigitalCardTool() {
  const [data, setData] = useLocalStorageState<CardData>('sparx-digital-card', DEFAULT);
  const set = (k: keyof CardData, v: string) => setData((p) => ({ ...p, [k]: v }));
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const vcard = buildVcard(data);
  const full = `${data.firstName} ${data.lastName}`.trim() || 'Your Name';

  React.useEffect(() => {
    if (!canvasRef.current) return;
    void renderQrCanvas(canvasRef.current, vcard, {
      fg: '#0A0A0A',
      bg: '#FFFFFF',
      ecc: 'M',
      margin: 2,
      width: 512,
      logo: null,
    });
  }, [vcard]);

  const slug =
    full
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'contact';
  const downloadVcf = () => downloadText(vcard, `${slug}.vcf`, 'text/vcard;charset=utf-8');
  const downloadQr = () =>
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, `${slug}-qr.png`), 'image/png');

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Your details">
          <div className="tool-fieldgrid">
            <Field label="First name">
              <Input value={data.firstName} onChange={(e) => set('firstName', e.target.value)} />
            </Field>
            <Field label="Last name">
              <Input value={data.lastName} onChange={(e) => set('lastName', e.target.value)} />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Job title">
              <Input value={data.title} onChange={(e) => set('title', e.target.value)} />
            </Field>
            <Field label="Company">
              <Input value={data.company} onChange={(e) => set('company', e.target.value)} />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Phone">
              <Input type="tel" value={data.phone} onChange={(e) => set('phone', e.target.value)} />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={data.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </Field>
          </div>
          <Field label="Website">
            <Input value={data.website} onChange={(e) => set('website', e.target.value)} />
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Your card">
          {/* SIMULATION — how the contact renders once saved to a phone: a business
              card, not sparx chrome. Kept bespoke (card typography) rather than
              converted to a silica Card nested inside this Panel. */}
          <div className="border-base-300 bg-base-100 flex flex-col gap-1 rounded-lg border p-[22px]">
            <span className="text-base-content text-[18px] font-semibold">{full}</span>
            <span className="text-ink-muted text-[13px]">
              {[data.title, data.company].filter(Boolean).join(' · ')}
            </span>
            <div className="text-ink-muted mt-2 flex flex-col gap-0.5 text-[13px]">
              {data.phone ? <span>{data.phone}</span> : null}
              {data.email ? <span>{data.email}</span> : null}
              {data.website ? <span>{data.website}</span> : null}
            </div>
          </div>

          <div className="tool-checkerboard flex justify-center rounded-lg p-5">
            <div className="relative h-[180px] w-[180px]">
              <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
            </div>
          </div>

          <div className="mkt-cluster gap-2.5">
            <Button type="button" color="module" variant="solid" size="sm" onClick={downloadVcf}>
              <Download className="h-4 w-4" />
              Download .vcf
            </Button>
            <Button type="button" color="neutral" variant="outline" size="sm" onClick={downloadQr}>
              <Download className="h-4 w-4" />
              QR PNG
            </Button>
            <CopyButton value={vcard} label="Copy vCard" toastLabel="vCard copied" />
          </div>
          <Text className="text-ink-muted m-0">
            Scan the QR to save the contact, or share the .vcf file. Saved on this device only.
          </Text>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
