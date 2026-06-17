'use client';

import * as React from 'react';
import { FileUpload, Input, Switch, Slider, ColorPicker, toast } from '@sparx/ui';
import { Workbench, ControlsPane, OutputPane, Panel, Field } from './ui-kit';
import { loadImageFromFile } from './lib/canvas';
import { generateFavicons, type FaviconResult } from './lib/favicon';
import { FaviconOutput } from './favicon-output';

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'yoursite'
  );
}

function prettyName(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()) : 'My App';
}

export function FaviconTool() {
  const [img, setImg] = React.useState<HTMLImageElement | null>(null);
  const [transparent, setTransparent] = React.useState(true);
  const [bgColor, setBgColor] = React.useState('#FFFFFF');
  const [padding, setPadding] = React.useState(0);
  const [radius, setRadius] = React.useState(0);
  const [themeColor, setThemeColor] = React.useState('#6366F1');
  const [manifestBg, setManifestBg] = React.useState('#FFFFFF');
  const [appName, setAppName] = React.useState('My App');
  const [shortName, setShortName] = React.useState('');
  const [result, setResult] = React.useState<FaviconResult | null>(null);

  React.useEffect(() => {
    if (!img) {
      setResult(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void generateFavicons(img, {
        background: transparent ? null : bgColor,
        padding: padding / 100,
        radius: radius / 100,
        themeColor,
        backgroundColor: manifestBg,
        appName: appName || 'My App',
        appShortName: shortName,
      }).then((r) => {
        if (!cancelled) setResult(r);
      });
    }, 160);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [img, transparent, bgColor, padding, radius, themeColor, manifestBg, appName, shortName]);

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    try {
      const image = await loadImageFromFile(file);
      setImg(image);
      setAppName((prev) => (prev === 'My App' ? prettyName(file.name) : prev));
    } catch {
      toast.error('Could not read that image — try a PNG, SVG, JPG, or WebP.');
    }
  };

  return (
    <Workbench>
      <ControlsPane>
        <Panel title="Source image">
          <FileUpload
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            maxSize={10 * 1024 * 1024}
            onFilesChange={handleFiles}
            onReject={({ reason }) =>
              toast.error(reason === 'size' ? 'That file is over 10 MB.' : 'Unsupported file type.')
            }
          />
          <p
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '12.5px',
              color: 'var(--color-text-tertiary)',
              margin: 0,
            }}
          >
            PNG, SVG, JPG, or WebP. A square image of at least 512×512 looks best. Everything is
            processed in your browser — the file never leaves your device.
          </p>
        </Panel>

        <Panel title="Look">
          <Field
            label="Transparent background"
            hint="Off lets you set a solid fill behind the icon. Apple touch and maskable icons are always given a solid background."
          >
            <Switch checked={transparent} onCheckedChange={setTransparent} />
          </Field>
          {!transparent ? (
            <Field label="Background fill">
              <ColorPicker value={bgColor} onChange={setBgColor} ariaLabel="Background fill" />
            </Field>
          ) : null}
          <Field label="Padding" adornment={`${padding}%`}>
            <Slider
              value={[padding]}
              onValueChange={(vals) => setPadding(vals[0] ?? 0)}
              min={0}
              max={40}
              step={1}
            />
          </Field>
          <Field label="Corner radius" adornment={`${radius}%`}>
            <Slider
              value={[radius]}
              onValueChange={(vals) => setRadius(vals[0] ?? 0)}
              min={0}
              max={50}
              step={1}
            />
          </Field>
        </Panel>

        <Panel title="Manifest & app">
          <div className="tool-fieldgrid">
            <Field label="App name" htmlFor="fav-name">
              <Input id="fav-name" value={appName} onChange={(e) => setAppName(e.target.value)} />
            </Field>
            <Field label="Short name" htmlFor="fav-short" hint="Home-screen label.">
              <Input
                id="fav-short"
                value={shortName}
                placeholder={appName}
                onChange={(e) => setShortName(e.target.value)}
              />
            </Field>
          </div>
          <div className="tool-fieldgrid">
            <Field label="Theme color" hint="Browser UI tint.">
              <ColorPicker value={themeColor} onChange={setThemeColor} ariaLabel="Theme color" />
            </Field>
            <Field label="Splash background" hint="PWA launch screen.">
              <ColorPicker
                value={manifestBg}
                onChange={setManifestBg}
                ariaLabel="Splash background"
              />
            </Field>
          </div>
        </Panel>
      </ControlsPane>

      <OutputPane>
        {result ? (
          <FaviconOutput
            result={result}
            themeColor={themeColor}
            appName={appName}
            domain={`${slugify(appName)}.com`}
          />
        ) : (
          <Panel>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '48px 24px',
                textAlign: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  color: 'var(--color-text-primary)',
                }}
              >
                {img ? 'Rendering your favicons…' : 'Upload an image to begin'}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                Live previews, the full icon package, and copy-paste markup appear here.
              </span>
            </div>
          </Panel>
        )}
      </OutputPane>
    </Workbench>
  );
}
