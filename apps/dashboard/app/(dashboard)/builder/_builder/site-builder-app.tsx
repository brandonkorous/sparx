'use client';

// The site editor shell — the Builder surface at /builder/site (docs/45).
//
// Edits the ONE site layout (the chrome shell every page renders inside) with
// the SAME editing brain + body as the page editor: the `useBuilderEditor` hook
// and `BuilderWorkspace`. The only differences are the shell chrome — there's one
// layout (no page switcher, no slug, no kind), the palette is the `site` surface
// (Outlet + chrome components), and the catalog is the `site` sources.

import * as React from 'react';
import { Eye, Globe, Monitor, Save, Smartphone, Tablet, Upload } from 'lucide-react';
import { Button, ModuleProvider } from '@sparx/ui';
import type { BindingCatalog, BuilderLayoutDto } from '@sparx/builder-schemas';

import { type BuilderNode, type Device } from './model';
import { LayoutSettings } from './inspector';
import { BuilderWorkspace } from './builder-workspace';
import { useBuilderEditor, type SaveStatus } from './use-builder-editor';
import { publishLayout, saveLayoutTree } from '../_lib/actions';

const DEVICES: { id: Device; label: string; icon: typeof Monitor }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor },
  { id: 'tablet', label: 'Tablet', icon: Tablet },
  { id: 'mobile', label: 'Mobile', icon: Smartphone },
];

const SAVE_LABEL: Record<SaveStatus, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: 'Save failed',
};

export interface SiteBuilderAppProps {
  initialLayout: BuilderLayoutDto;
  /** The `site` sources — navigation / brand / social (docs/45 §3). Constant. */
  bindingCatalog: BindingCatalog;
}

export function SiteBuilderApp({ initialLayout, bindingCatalog }: SiteBuilderAppProps) {
  // The layout loads from the server (get-or-seed) and seeds this state ONCE;
  // from here the client is authoritative and the server is the persistence sink.
  const [tree, setTree] = React.useState<BuilderNode>(initialLayout.tree);
  const [busy, setBusy] = React.useState(false);

  const editor = useBuilderEditor({
    tree,
    catalog: bindingCatalog,
    save: async (next) => (await saveLayoutTree(next)).ok,
    onTreeChange: setTree,
  });

  const onPublish = async () => {
    setBusy(true);
    await editor.flushSave();
    const res = await publishLayout();
    setBusy(false);
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        {/* Editor toolbar — site-specific actions only. */}
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            <span className="bx-toolbar__title">
              <Globe aria-hidden /> {initialLayout.name}
            </span>
          </div>
          <div className="bx-toolbar__devices">
            {DEVICES.map((d) => {
              const Icon = d.icon;
              return (
                <button
                  key={d.id}
                  type="button"
                  className="bx-device"
                  data-on={editor.device === d.id}
                  aria-label={d.label}
                  aria-pressed={editor.device === d.id}
                  onClick={() => editor.setDevice(d.id)}
                >
                  <Icon aria-hidden />
                </button>
              );
            })}
          </div>
          <div className="bx-toolbar__actions">
            {editor.saveStatus !== 'idle' ? (
              <span className="bx-savestate" data-state={editor.saveStatus}>
                {SAVE_LABEL[editor.saveStatus]}
              </span>
            ) : null}
            <Button size="sm" variant="ghost" leftIcon={<Eye className="h-3.5 w-3.5" />} disabled>
              Preview
            </Button>
            <Button
              size="sm"
              variant="soft"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void editor.flushSave()}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Upload className="h-3.5 w-3.5" />}
              disabled={busy}
              onClick={() => void onPublish()}
            >
              Publish
            </Button>
          </div>
        </div>

        {/* Context bar — what the chrome binds to */}
        <div className="bx-ctx">
          <span className="bx-ctx__lead">This layout wraps every page</span>
          <span className="bx-ctx__note">
            The header and footer persist across navigation; the <strong>Page content</strong> block
            is where each routed page renders. Navigation, brand, and social bind to your existing
            site data — editing them lives in Navigation &amp; Brand.
          </span>
        </div>

        <BuilderWorkspace
          tree={tree}
          editor={editor}
          catalog={bindingCatalog}
          surface="site"
          settings={<LayoutSettings name={initialLayout.name} />}
        />
      </div>
    </ModuleProvider>
  );
}
