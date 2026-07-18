'use client';

import * as React from 'react';
import { AlertTriangle, Download } from 'lucide-react';
import { Alert, Button, Input, NativeSelect, Switch } from '@wizeworks/silicaui-react';
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
            <NativeSelect
              id="bc-format"
              value={format}
              onChange={(e) => setFormat(e.target.value as BarcodeFormat)}
            >
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
              <HexColorField value={lineColor} onChange={setLineColor} label="Bar color" />
            </Field>
            <Field label="Background">
              <HexColorField value={background} onChange={setBackground} label="Background color" />
            </Field>
          </div>
          <Field label="Height" adornment={`${height}px`}>
            <NumberRange value={height} onValueChange={setHeight} min={40} max={160} step={5} />
          </Field>
          <Field label="Show number">
            <Switch checked={displayValue} onCheckedChange={setDisplayValue} />
          </Field>
        </Panel>
      </ControlsPane>

      <OutputPane>
        <Panel title="Your barcode">
          {/* The canvas stays mounted even while the value is invalid — the render
              effect draws into it, and an unmounted ref would leave the preview
              blank on the next valid keystroke. Only the frame is hidden. */}
          <div
            className={
              valid
                ? 'tool-checkerboard flex min-h-40 items-center justify-center rounded-lg p-6'
                : 'hidden'
            }
          >
            <canvas ref={canvasRef} className="block h-auto max-w-full" />
          </div>
          {!valid ? (
            <Alert color="danger" variant="soft">
              <AlertTriangle />
              {error}
            </Alert>
          ) : null}
          {valid ? (
            <div className="flex flex-wrap items-center gap-2.5">
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
              <CopyButton value={value} label="Copy value" toastLabel="Value copied" />
            </div>
          ) : null}
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
