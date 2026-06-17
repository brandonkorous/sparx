'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button, Input, Switch } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { buildPrivacyPolicy, buildTerms, type LegalData } from './lib/legal-templates';
import { downloadText } from './lib/download';
import { useLocalStorageState } from './lib/use-local-storage';

const DEFAULT: LegalData = {
  businessName: 'Acme Co.',
  website: 'https://acme.co',
  email: 'privacy@acme.co',
  effectiveDate: '',
  jurisdiction: 'California, USA',
  collectsAccount: true,
  collectsPayment: true,
  usesCookies: true,
  usesAnalytics: true,
  sharesThirdParties: true,
  gdpr: true,
  ccpa: true,
};

const TOGGLES: { key: keyof LegalData; label: string }[] = [
  { key: 'collectsAccount', label: 'Names & emails (accounts, contact)' },
  { key: 'collectsPayment', label: 'Payments' },
  { key: 'usesCookies', label: 'Cookies' },
  { key: 'usesAnalytics', label: 'Analytics' },
  { key: 'sharesThirdParties', label: 'Third-party service providers' },
  { key: 'gdpr', label: 'Serve EU / UK users (GDPR)' },
  { key: 'ccpa', label: 'Serve California users (CCPA)' },
];

function renderInline(text: string, key: number): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <React.Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p
      )}
    </React.Fragment>
  );
}

function Markdown({ text }: { text: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-sans)',
        color: '#27272a',
      }}
    >
      {text.split('\n').map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: '8px' }} />;
        if (line.startsWith('### '))
          return (
            <h4 key={i} style={{ fontSize: '14px', fontWeight: 700, margin: '12px 0 4px' }}>
              {line.slice(4)}
            </h4>
          );
        if (line.startsWith('## '))
          return (
            <h3 key={i} style={{ fontSize: '16px', fontWeight: 700, margin: '16px 0 6px' }}>
              {line.slice(3)}
            </h3>
          );
        if (line.startsWith('# '))
          return (
            <h2 key={i} style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 8px' }}>
              {line.slice(2)}
            </h2>
          );
        if (line.startsWith('- '))
          return (
            <div
              key={i}
              style={{
                fontSize: '13.5px',
                lineHeight: 1.6,
                paddingLeft: '16px',
                position: 'relative',
              }}
            >
              <span style={{ position: 'absolute', left: 0 }}>•</span>
              {renderInline(line.slice(2), i)}
            </div>
          );
        if (line.startsWith('_') && line.endsWith('_'))
          return (
            <p key={i} style={{ fontSize: '12.5px', color: '#71717a', margin: 0 }}>
              {line.slice(1, -1)}
            </p>
          );
        return (
          <p key={i} style={{ fontSize: '13.5px', lineHeight: 1.6, margin: 0 }}>
            {renderInline(line, i)}
          </p>
        );
      })}
    </div>
  );
}

export function PrivacyTool() {
  const [data, setData] = useLocalStorageState<LegalData>('sparx-legal', DEFAULT);
  const [doc, setDoc] = React.useState<'privacy' | 'terms'>('privacy');
  const set = (patch: Partial<LegalData>) => setData((p) => ({ ...p, ...patch }));

  const text = doc === 'privacy' ? buildPrivacyPolicy(data) : buildTerms(data);
  const filename = doc === 'privacy' ? 'privacy-policy.md' : 'terms-of-service.md';

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Your business">
          <div className="tool-fieldgrid">
            <Field label="Business name">
              <Input
                value={data.businessName}
                onChange={(e) => set({ businessName: e.target.value })}
              />
            </Field>
            <Field label="Website">
              <Input value={data.website} onChange={(e) => set({ website: e.target.value })} />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Contact email">
              <Input
                type="email"
                value={data.email}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="Effective date">
              <Input
                type="date"
                value={data.effectiveDate}
                onChange={(e) => set({ effectiveDate: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Governing law" hint="Where your business operates.">
            <Input
              value={data.jurisdiction}
              onChange={(e) => set({ jurisdiction: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel title="What applies to you">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {TOGGLES.map((t) => (
              <div
                key={t.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '14px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {t.label}
                </span>
                <Switch
                  checked={data[t.key] as boolean}
                  onCheckedChange={(c) => set({ [t.key]: c })}
                />
              </div>
            ))}
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel
          title="Document"
          action={
            <span style={{ display: 'inline-flex', gap: '6px' }}>
              <Button
                type="button"
                size="sm"
                variant={doc === 'privacy' ? 'solid' : 'outline'}
                color={doc === 'privacy' ? 'module' : 'neutral'}
                onClick={() => setDoc('privacy')}
              >
                Privacy
              </Button>
              <Button
                type="button"
                size="sm"
                variant={doc === 'terms' ? 'solid' : 'outline'}
                color={doc === 'terms' ? 'module' : 'neutral'}
                onClick={() => setDoc('terms')}
              >
                Terms
              </Button>
            </span>
          }
        >
          <div
            style={{
              maxHeight: '420px',
              overflowY: 'auto',
              padding: '24px',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-default)',
            }}
          >
            <Markdown text={text} />
          </div>
          <div className="mkt-cluster" style={{ gap: '10px' }}>
            <CopyButton
              value={text}
              label="Copy markdown"
              toastLabel="Document copied"
              color="module"
              variant="solid"
            />
            <Button
              type="button"
              variant="outline"
              color="neutral"
              size="sm"
              onClick={() => downloadText(text, filename, 'text/markdown;charset=utf-8')}
            >
              <Download className="h-4 w-4" />
              Download .md
            </Button>
          </div>
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            A strong starting point — review and adapt it to your business. This is not legal
            advice.
          </p>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
