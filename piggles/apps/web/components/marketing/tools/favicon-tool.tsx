'use client';

import { useEffect, useRef, useState } from 'react';
import { Dropzone } from '@wizeworks/silicaui-react';
import { loadImageFile, type LoadedImage } from './lib/canvas';
import { buildFaviconSet, type FaviconOutput } from './lib/favicon';
import { readBackdrop, type BackdropReading } from './lib/favicon-backdrop';
import { CodeToPaste, FileList, WhatYouGet } from './favicon/output-cards';
import { SettingsPanel, type FaviconSettings } from './favicon/settings-panel';
import { SourceNotes } from './favicon/source-notes';
import { TabPreview } from './favicon/tab-preview';
import { Panel, Problem, ToolLayout } from './ui-kit';
import { useReportToolResult } from './tool-result-context';

/**
 * One picture in, the whole set out — previewed at sixteen pixels, which is the
 * size that decides whether a favicon works. Half the people who see their full
 * logo that small go back and use just the mark.
 */
export function FaviconTool() {
  const [image, setImage] = useState<LoadedImage | null>(null);
  const [output, setOutput] = useState<FaviconOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [reading, setReading] = useState<BackdropReading | null>(null);

  const [settings, setSettings] = useState<FaviconSettings>({
    backdrop: 'see-through',
    background: '#FFFFFF',
    appName: 'My business',
    themeColor: '#FF6F86',
  });

  /** Dropping a picture in picks a STARTING POINT. The moment somebody sets one
   *  of these themselves it is theirs, and nothing here puts it back — a tool
   *  that overrules the color you typed is worse than one that never suggests. */
  const chosen = useRef({ backdrop: false, background: false });

  const change: <K extends keyof FaviconSettings>(key: K, value: FaviconSettings[K]) => void = (
    key,
    value
  ) => {
    if (key === 'backdrop') chosen.current.backdrop = true;
    if (key === 'background') chosen.current.background = true;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const accept = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      const loaded = await loadImageFile(file);
      const read = readBackdrop(loaded);
      setImage(loaded);
      setReading(read);
      setSettings((prev) => ({
        ...prev,
        background: chosen.current.background ? prev.background : read.suggested,
        backdrop: chosen.current.backdrop
          ? prev.backdrop
          : read.seeThroughWorks
            ? 'see-through'
            : 'solid',
      }));
    } catch (e) {
      setImage(null);
      setReading(null);
      setError(e instanceof Error ? e.message : 'That image could not be opened.');
    } finally {
      setWorking(false);
    }
  };

  const { backdrop, background, appName, themeColor } = settings;

  useEffect(() => {
    if (!image) {
      setOutput(null);
      return;
    }
    let cancelled = false;
    setWorking(true);
    buildFaviconSet(image, {
      background,
      fillBackground: backdrop === 'solid',
      appName,
      themeColor,
    })
      .then((built) => {
        if (!cancelled) setOutput(built);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'The icons could not be made.');
      })
      .finally(() => {
        if (!cancelled) setWorking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [image, backdrop, background, appName, themeColor]);

  // The icons stay on the computer, as the dropzone promises. Only the code, the
  // manifest and the settings travel — the half that gets forwarded anyway.
  useReportToolResult(
    output
      ? {
          lines: [
            { label: 'App name', value: appName },
            { label: 'Theme color', value: themeColor.toUpperCase() },
            {
              label: 'Behind your logo',
              value:
                backdrop === 'solid'
                  ? `${background.toUpperCase()} on every icon`
                  : `See-through, except the home-screen icon, which is ${background.toUpperCase()}`,
            },
            { label: 'Code to add', value: output.html },
            { label: 'Manifest file', value: output.manifest },
          ],
          note: 'The icon files stay on your computer, exactly as promised. Open the tool again with the same picture and these settings to download them, put them in the top level of your website, then add the code to every page. Look at it at sixteen pixels before you commit — that is the size that decides whether it works.',
        }
      : null
  );

  return (
    <ToolLayout
      outputWidth="wide"
      form={
        <>
          <Panel title="Your picture" description="A square PNG or SVG works best.">
            <Dropzone
              className="border-module"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              multiple={false}
              maxSize={12 * 1024 * 1024}
              onFiles={accept}
              title={image ? 'Drop a different picture' : 'Drop your logo here, or click to choose'}
              hint="PNG, SVG, JPG or WebP. It never leaves your computer."
            />
            {error ? <Problem>{error}</Problem> : null}
            <SourceNotes image={image} />
          </Panel>

          {image ? <SettingsPanel settings={settings} onChange={change} reading={reading} /> : null}
        </>
      }
      output={
        image ? (
          <>
            <TabPreview
              image={image}
              background={background}
              fillBackground={backdrop === 'solid'}
            />
            {output ? (
              <>
                <FileList output={output} working={working} />
                <CodeToPaste output={output} />
              </>
            ) : null}
          </>
        ) : (
          <WhatYouGet />
        )
      }
    />
  );
}
