'use client';

import * as React from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button, ColorPicker, NativeSelect, Slider, FileUpload, toast } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { QrFieldSet } from './qr-fields';
import { buildQrPayload, renderQrCanvas, renderQrSvg, type QrType, type QrStyle } from './lib/qr';
import { downloadBlob, downloadText, readAsDataUrl } from './lib/download';

const TYPES: { value: QrType; label: string }[] = [
  { value: 'url', label: 'URL' },
  { value: 'text', label: 'Text' },
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'vcard', label: 'Contact' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'tel', label: 'Phone' },
];

const EXPORT_WIDTH = 1024;

export function QrTool() {
  const [type, setType] = React.useState<QrType>('url');
  const [fields, setFields] = React.useState<Record<string, string>>({ url: '' });
  const [fg, setFg] = React.useState('#0A0A0A');
  const [bg, setBg] = React.useState('#FFFFFF');
  const [ecc, setEcc] = React.useState<QrStyle['ecc']>('M');
  const [margin, setMargin] = React.useState(2);
  const [logo, setLogo] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const payload = buildQrPayload(type, fields);
  const hasData = payload.length > 0;
  const style: QrStyle = { fg, bg, ecc, margin, width: EXPORT_WIDTH, logo };

  React.useEffect(() => {
    if (!hasData || !canvasRef.current) return;
    let cancelled = false;
    const canvas = canvasRef.current;
    const timer = setTimeout(() => {
      renderQrCanvas(canvas, payload, style).catch(() => {
        if (!cancelled) toast.error('That content is too long for one QR code.');
      });
    }, 140);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, fg, bg, ecc, margin, logo, hasData]);

  const set = (key: string, value: string) => setFields((prev) => ({ ...prev, [key]: value }));

  const handleLogo = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLogo(await readAsDataUrl(file));
    setEcc((prev) => (prev === 'H' || prev === 'Q' ? prev : 'H'));
  };

  const downloadPng = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'qr-code.png');
    }, 'image/png');
  };

  const downloadSvg = async () => {
    downloadText(await renderQrSvg(payload, style), 'qr-code.svg', 'image/svg+xml');
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Content">
          <div className="mkt-cluster" style={{ gap: '8px' }}>
            {TYPES.map((t) => (
              <Button
                key={t.value}
                type="button"
                size="sm"
                variant={type === t.value ? 'solid' : 'outline'}
                color={type === t.value ? 'module' : 'neutral'}
                onClick={() => setType(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
          <QrFieldSet type={type} fields={fields} set={set} />
        </Panel>

        <Panel title="Style">
          <div className="tool-fieldgrid">
            <Field label="Foreground">
              <ColorPicker value={fg} onChange={setFg} ariaLabel="Foreground color" />
            </Field>
            <Field label="Background">
              <ColorPicker value={bg} onChange={setBg} ariaLabel="Background color" />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Error correction" hint="Higher survives damage and logos.">
              <NativeSelect value={ecc} onChange={(e) => setEcc(e.target.value as QrStyle['ecc'])}>
                <option value="L">Low (7%)</option>
                <option value="M">Medium (15%)</option>
                <option value="Q">Quartile (25%)</option>
                <option value="H">High (30%)</option>
              </NativeSelect>
            </Field>
            <Field label="Quiet zone" adornment={`${margin}`}>
              <Slider
                value={[margin]}
                onValueChange={(v) => setMargin(v[0] ?? 0)}
                min={0}
                max={8}
                step={1}
              />
            </Field>
          </div>
          <Field
            label="Center logo"
            hint="Optional. We bump error correction to High so it still scans."
          >
            {logo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={logo}
                  alt=""
                  width={40}
                  height={40}
                  style={{ borderRadius: '6px', objectFit: 'contain' }}
                />
                <Button
                  type="button"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  onClick={() => setLogo(null)}
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>
            ) : (
              <FileUpload accept="image/*" maxSize={4 * 1024 * 1024} onFilesChange={handleLogo} />
            )}
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Your QR code">
          <div
            className="tool-checkerboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              minHeight: '240px',
            }}
          >
            {hasData ? (
              // Responsive square canvas: the square aspect-ratio lives on the
              // wrapper, and the canvas is absolutely positioned to fill it. A
              // canvas is a replaced element with an intrinsic 1024px height, so
              // an in-flow `height:100%` would force the wrapper to grow to 1024
              // and override aspect-ratio — taking it out of flow fixes that.
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '300px',
                  aspectRatio: '1 / 1',
                }}
              >
                <canvas
                  ref={canvasRef}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    display: 'block',
                  }}
                />
              </div>
            ) : (
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '14px',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Fill in the content to generate your code
              </span>
            )}
          </div>
          {hasData ? (
            <div className="mkt-cluster" style={{ gap: '10px' }}>
              <Button type="button" color="module" variant="solid" size="sm" onClick={downloadPng}>
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
              <CopyButton value={payload} label="Copy content" toastLabel="Content copied" />
            </div>
          ) : null}
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
