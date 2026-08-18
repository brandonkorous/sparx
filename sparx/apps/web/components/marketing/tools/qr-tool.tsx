'use client';

import * as React from 'react';
import { Download, QrCode, Trash2 } from 'lucide-react';
import { toast } from '@wizeworks/ui';
import { Button, EmptyState, FileUpload, NativeSelect } from '@wizeworks/silicaui-react';
import {
  Workbench,
  ControlsPane,
  OutputPane,
  Panel,
  Field,
  CopyButton,
  NumberRange,
  HexColorField,
} from './ui-kit';
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
          <div className="flex flex-wrap items-center gap-2">
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
              <HexColorField value={fg} onChange={setFg} label="Foreground color" />
            </Field>
            <Field label="Background">
              <HexColorField value={bg} onChange={setBg} label="Background color" />
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
              <NumberRange value={margin} onValueChange={setMargin} min={0} max={8} step={1} />
            </Field>
          </div>
          <Field
            label="Center logo"
            hint="Optional. We bump error correction to High so it still scans."
          >
            {logo ? (
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 rounded-md object-contain"
                />
                <Button
                  type="button"
                  color="error"
                  variant="outline"
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
          {hasData ? (
            // The checkerboard supplies the alpha backdrop; it is a fixed light
            // surface that deliberately does NOT follow the theme, so nothing but
            // the rendered artifact sits on it.
            <div className="tool-checkerboard flex min-h-60 items-center justify-center rounded-lg p-6">
              {/* Responsive square canvas: the square aspect-ratio lives on the
                  wrapper, and the canvas is absolutely positioned to fill it. A
                  canvas is a replaced element with an intrinsic 1024px height, so
                  an in-flow `height:100%` would force the wrapper to grow to 1024
                  and override aspect-ratio — taking it out of flow fixes that. */}
              <div className="relative aspect-square w-full max-w-[300px]">
                <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
              </div>
            </div>
          ) : (
            <EmptyState
              size="sm"
              icon={<QrCode />}
              title="Nothing to encode yet"
              description="Fill in the content above and your QR code appears here."
            />
          )}
          {hasData ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" color="module" variant="solid" size="sm" onClick={downloadPng}>
                <Download className="h-4 w-4" />
                PNG
              </Button>
              <Button
                color="neutral"
                type="button"
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
