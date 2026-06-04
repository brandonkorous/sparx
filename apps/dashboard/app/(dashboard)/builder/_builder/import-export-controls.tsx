'use client';

// Export / Import controls for the Builder toolbar (docs/47). Export downloads
// the current tree as a portable `sparx.builder/v1` JSON document; Import reads a
// JSON file, validates it (in @sparx/builder-schemas), and hands the parsed tree
// back to the shell to apply + persist. Shared by the page and site editors.
//
// This is the agent-friendly path: a model authors a tree as JSON and drops it
// in here — far more reliable than hand-driving the canvas — and "imports +
// renders" is itself the validation.

import * as React from 'react';
import { Download, FileUp } from 'lucide-react';
import { Button } from '@sparx/ui';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'builder'
  );
}

export interface ImportExportControlsProps {
  /** 'page' | 'layout' | 'email' — drives the filename suffix + labels. */
  kind: 'page' | 'layout' | 'email';
  /** The document name (used to build the download filename). */
  name: string;
  /** Build the export document (called on click so it reflects the latest tree). */
  getDocument: () => unknown;
  /** Apply an imported file's text. Returns an error message, or null on success. */
  onImportText: (text: string) => string | null;
  disabled?: boolean;
}

export function ImportExportControls({
  kind,
  name,
  getDocument,
  onImportText,
  disabled,
}: ImportExportControlsProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [notice, setNotice] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const doExport = () => {
    setNotice(null);
    const json = JSON.stringify(getDocument(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(name)}.${kind}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    try {
      const text = await file.text();
      const err = onImportText(text);
      setNotice(
        err
          ? { kind: 'error', text: err }
          : { kind: 'ok', text: 'Imported — review the canvas, then Publish.' }
      );
    } catch {
      setNotice({ kind: 'error', text: 'Could not read the file.' });
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        aria-hidden
        tabIndex={-1}
        onChange={(e) => void onFile(e)}
      />
      <Button
        size="sm"
        variant="ghost"
        leftIcon={<Download className="h-3.5 w-3.5" />}
        disabled={disabled}
        onClick={doExport}
      >
        Export
      </Button>
      <span className="bx-impwrap">
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<FileUp className="h-3.5 w-3.5" />}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          Import
        </Button>
        {notice ? (
          <div
            className={`bx-impnotice bx-impnotice--${notice.kind}`}
            role={notice.kind === 'error' ? 'alert' : 'status'}
          >
            <div className="bx-impnotice__head">
              <span className="bx-impnotice__title">
                {notice.kind === 'error' ? 'Import failed — nothing was saved' : 'Imported ✓'}
              </span>
              <button
                type="button"
                className="bx-impnotice__x"
                aria-label="Dismiss"
                onClick={() => setNotice(null)}
              >
                ✕
              </button>
            </div>
            <p className="bx-impnotice__msg">{notice.text}</p>
          </div>
        ) : null}
      </span>
    </>
  );
}
