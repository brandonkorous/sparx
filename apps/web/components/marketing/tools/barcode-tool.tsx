'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { Button, Input, NativeSelect, Switch, Slider, ColorPicker } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import {
  renderBarcodeCanvas,
  renderBarcodeSvg,
  BARCODE_FORMATS,
  type BarcodeFormat,
  type BarcodeStyle,
} from './lib/barcode';
import { downloadBlob, downloadText } from './lib/download';

export function BarcodeTool() {
  const [format, setFormat] = React.useState<BarcodeFormat>('CODE128');
  const [value, setValue] = React.useState('SPARX-001');
  const [lineColor, setLineColor] = React.useState('#0A0A0A');
  const [background, setBackground] = React.useState('#FFFFFF');
  const [height, setHeight] = React.useState(80);
  const [displayValue, setDisplayValue] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const style: BarcodeStyle = { format, lineColor, background, height, displayValue };
  const hint = BARCODE_FORMATS.find((f) => f.value === format)?.hint;

  React.useEffect(() => {
    if (!canvasRef.current || !value.trim()) {
      setError(value.trim() ? null : 'Enter a value to encode.');
      return;
    }
    renderBarcodeCanvas(canvasRef.current, value, style)
      .then(() => setError(null))
      .catch(() => setError(`"${value}" isn't valid for ${format}. ${hint ?? ''}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, format, lineColor, background, height, displayValue]);

  const valid = !error && value.trim().length > 0;

  const downloadPng = () => {
    canvasRef.current?.toBlob((b) => b && downloadBlob(b, `barcode-${value}.png`), 'image/png');
  };
  const downloadSvg = async () => {
    try {
      downloadText(await renderBarcodeSvg(value, style), `barcode-${value}.svg`, 'image/svg+xml');
    } catch {
      setError('Could not export SVG for this value.');
    }
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Barcode">
          <Field label="Format" htmlFor="bc-format" hint={hint}>
            <NativeSelect id="bc-format" value={format} onChange={(e) => setFormat(e.target.value as BarcodeFormat)}>
              {BARCODE_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Value" htmlFor="bc-value">
            <Input id="bc-value" value={value} onChange={(e) => setValue(e.target.value)} />
          </Field>
        </Panel>

        <Panel title="Style">
          <div className="tool-fieldgrid">
            <Field label="Bars">
              <ColorPicker value={lineColor} onChange={setLineColor} ariaLabel="Bar color" />
            </Field>
            <Field label="Background">
              <ColorPicker value={background} onChange={setBackground} ariaLabel="Background color" />
            </Field>
          </div>
          <Field label="Height" adornment={`${height}px`}>
            <Slider value={[height]} onValueChange={(v) => setHeight(v[0] ?? 40)} min={40} max={160} step={5} />
          </Field>
          <Field label="Show number">
            <Switch checked={displayValue} onCheckedChange={setDisplayValue} />
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Your barcode">
          <div
            className="tool-checkerboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              borderRadius: 'var(--radius-lg)',
              minHeight: '160px',
            }}
          >
            <canvas
              ref={canvasRef}
              style={{ maxWidth: '100%', height: 'auto', display: valid ? 'block' : 'none' }}
            />
            {!valid ? (
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-danger)', textAlign: 'center' }}>
                {error}
              </span>
            ) : null}
          </div>
          {valid ? (
            <div className="mkt-cluster" style={{ gap: '10px' }}>
              <Button type="button" color="module" variant="solid" size="sm" onClick={downloadPng}>
                <Download className="h-4 w-4" />
                PNG
              </Button>
              <Button type="button" color="neutral" variant="outline" size="sm" onClick={downloadSvg}>
                <Download className="h-4 w-4" />
                SVG
              </Button>
              <CopyButton value={value} label="Copy value" toastLabel="Value copied" />
            </div>
          ) : null}
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
