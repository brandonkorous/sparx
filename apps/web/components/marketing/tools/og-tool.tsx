'use client';

import * as React from 'react';
import { Download, Trash2 } from 'lucide-react';
import { Button, Input, Textarea, ColorPicker, FileUpload, toast } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field, CopyButton } from './ui-kit';
import { renderOgCanvas, type OgOptions } from './lib/og-image';
import { downloadBlob, readAsDataUrl } from './lib/download';

const META_SNIPPET = [
  '<meta property="og:image" content="https://yoursite.com/og-image.png">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="https://yoursite.com/og-image.png">',
].join('\n');

export function OgTool() {
  const [title, setTitle] = React.useState('One platform. Everything you sell, in one place.');
  const [eyebrow, setEyebrow] = React.useState('Announcing');
  const [siteName, setSiteName] = React.useState('yoursite.com');
  const [accent, setAccent] = React.useState('#6366F1');
  const [theme, setTheme] = React.useState<'light' | 'dark'>('dark');
  const [logo, setLogo] = React.useState<string | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const opts: OgOptions = { title, eyebrow, siteName, accent, theme, logo };

  React.useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) void renderOgCanvas(canvas, opts);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, eyebrow, siteName, accent, theme, logo]);

  const handleLogo = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLogo(await readAsDataUrl(file));
  };

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (blob) downloadBlob(blob, 'og-image.png');
      else toast.error('Could not export the image.');
    }, 'image/png');
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Content">
          <Field label="Headline" htmlFor="og-title" adornment={`${title.length} chars`}>
            <Textarea
              id="og-title"
              rows={3}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="tool-fieldgrid">
            <Field label="Eyebrow" htmlFor="og-eyebrow" hint="Small label above the headline.">
              <Input id="og-eyebrow" value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
            </Field>
            <Field label="Site name" htmlFor="og-site" hint="Footer attribution.">
              <Input id="og-site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </Field>
          </div>
        </Panel>

        <Panel title="Style">
          <Field label="Theme">
            <span style={{ display: 'inline-flex', gap: '6px' }}>
              <Button
                type="button"
                size="sm"
                variant={theme === 'light' ? 'solid' : 'outline'}
                color={theme === 'light' ? 'module' : 'neutral'}
                onClick={() => setTheme('light')}
              >
                Light
              </Button>
              <Button
                type="button"
                size="sm"
                variant={theme === 'dark' ? 'solid' : 'outline'}
                color={theme === 'dark' ? 'module' : 'neutral'}
                onClick={() => setTheme('dark')}
              >
                Dark
              </Button>
            </span>
          </Field>
          <Field label="Accent color">
            <ColorPicker value={accent} onChange={setAccent} ariaLabel="Accent color" />
          </Field>
          <Field label="Logo" hint="Optional — sits in the top-right corner.">
            {logo ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img
                  src={logo}
                  alt=""
                  height={36}
                  style={{ maxHeight: '36px', objectFit: 'contain' }}
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
        <Panel
          title="Preview · 1200×630"
          action={
            <Button type="button" color="module" variant="solid" size="sm" onClick={download}>
              <Download className="h-4 w-4" />
              Download PNG
            </Button>
          }
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: 'auto',
              aspectRatio: '1200 / 630',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-default)',
              display: 'block',
            }}
          />
        </Panel>

        <Panel title="Add it to your <head>">
          <pre className="tool-code">{META_SNIPPET}</pre>
          <div>
            <CopyButton value={META_SNIPPET} label="Copy meta tags" toastLabel="Meta tags copied" />
          </div>
        </Panel>
      </OutputPane>
    </Workbench>
  );
}
