'use client';

import * as React from 'react';
import { toast } from '@wizeworks/ui';
import { EmptyState, FileUpload, Input, Switch } from '@wizeworks/silicaui-react';
import { ImageUp } from 'lucide-react';
import { Text } from '../primitives';
import {
  Workbench,
  ControlsPane,
  OutputPane,
  Panel,
  Field,
  NumberRange,
  HexColorField,
} from './ui-kit';
import { loadImageFromFile } from './lib/canvas';
import { generateFavicons, type FaviconResult } from './lib/favicon';
import { FaviconOutput } from './favicon-output';
import { useReportToolResult } from './tool-result-context';

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

  // This page promises the uploaded image never leaves the browser, and that
  // promise is only worth anything if it holds here too. The icons themselves
  // stay on the device: what travels is the markup and the manifest, both of
  // which this tool wrote, plus the settings needed to regenerate the same set.
  useReportToolResult(
    result
      ? {
          lines: [
            { label: 'App name', value: appName || 'My App' },
            { label: 'Home-screen name', value: shortName || appName || 'My App' },
            { label: 'Theme color', value: themeColor },
            { label: 'Splash background', value: manifestBg },
            { label: 'Icon background', value: transparent ? 'Transparent' : bgColor },
            { label: 'Padding', value: `${padding}%` },
            { label: 'Corner radius', value: `${radius}%` },
            { label: 'Markup', value: result.htmlSnippet },
            { label: 'Manifest', value: result.manifest },
          ],
          note: 'The icon files stay on your device, exactly as promised. Open the tool again with the same image and these settings to download the package, drop the files in your site root, then paste the markup into your <head>.',
        }
      : null
  );

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
            multiple={false}
            onFilesChange={handleFiles}
            onReject={(rejections) =>
              toast.error(
                rejections[0]?.reason === 'size'
                  ? 'That file is over 10 MB.'
                  : 'Unsupported file type.'
              )
            }
          />
          <Text size={13}>
            PNG, SVG, JPG, or WebP. A square image of at least 512×512 looks best. Everything is
            processed in your browser — the file never leaves your device.
          </Text>
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
              <HexColorField value={bgColor} onChange={setBgColor} label="Background fill" />
            </Field>
          ) : null}
          <Field label="Padding" adornment={`${padding}%`}>
            <NumberRange value={padding} onValueChange={setPadding} min={0} max={40} step={1} />
          </Field>
          <Field label="Corner radius" adornment={`${radius}%`}>
            <NumberRange value={radius} onValueChange={setRadius} min={0} max={50} step={1} />
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
              <HexColorField value={themeColor} onChange={setThemeColor} label="Theme color" />
            </Field>
            <Field label="Splash background" hint="PWA launch screen.">
              <HexColorField
                value={manifestBg}
                onChange={setManifestBg}
                label="Splash background"
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
            <EmptyState
              icon={<ImageUp className="h-8 w-8" />}
              title={img ? 'Rendering your favicons…' : 'Upload an image to begin'}
              description="Live previews, the full icon package, and copy-paste markup appear here."
            />
          </Panel>
        )}
      </OutputPane>
    </Workbench>
  );
}
