'use client';

// The component editor shell — the Builder surface at /builder/components/[key]/edit
// (docs/53 P-C). Edits ONE tenant component's node tree with the SAME editing
// brain + body as the page/site editors (useBuilderEditor + BuilderWorkspace),
// pointed at a single component instead of a page catalog.
//
// Two deliberate differences from the page editor:
//  · NO autosave. Editing a component COMMITS a new immutable version (docs/53),
//    so saves are explicit (the "Save version" button) rather than per-keystroke —
//    placements pin a version and opt into upgrades, so we don't want a version
//    per debounce. Edits live in this component's state until saved.
//  · NO custom components in the palette (v1 forbids nesting) and no "Save as
//    component" — we're already inside one. We pass no `components` map, so the
//    Add palette shows only system primitives.
//
// The "Fields" rail tab (PropSpecPanel) declares the component's configurable
// slots, and the node inspector's "Make a field" affordance (via `slotEditor`)
// wires a node's text prop to one — both saved with the tree as a new version.

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Monitor, Save, Smartphone, Tablet } from 'lucide-react';
import { Button, Input, ModuleProvider } from '@sparx/ui';
import type { BindingCatalog, BuilderNode, ComponentDto, PropSpec } from '@sparx/builder-schemas';

import { type Device } from './model';
import { BuilderWorkspace } from './builder-workspace';
import { PropSpecPanel } from './prop-spec-panel';
import { deriveFieldKey } from './field-kinds';
import { type SlotEditor } from './inspector';
import { useBuilderEditor, type SaveStatus } from './use-builder-editor';
import { updateComponent } from '../components/_lib/component-actions';

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

export interface ComponentBuilderAppProps {
  component: ComponentDto;
  /** What the component can bind to (the page binding catalog — docs/43). */
  bindingCatalog: BindingCatalog;
}

export function ComponentBuilderApp({ component, bindingCatalog }: ComponentBuilderAppProps) {
  const router = useRouter();
  // The component's surface drives the palette (a site component gets the site
  // chrome; everything else is a page component).
  const surface = component.surfaces.includes('page') ? 'page' : 'site';

  const [tree, setTree] = React.useState<BuilderNode>(component.tree);
  const [propSpec, setPropSpec] = React.useState<PropSpec[]>(component.propSpec);
  const [name, setName] = React.useState(component.name);
  const [version, setVersion] = React.useState(component.latestVersion);
  const [dirty, setDirty] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  // The shared editing brain with autosave OFF — a component save is an explicit
  // version commit. Mutations update local state + mark dirty.
  const editor = useBuilderEditor({
    tree,
    catalog: bindingCatalog,
    autosave: false,
    // Autosave is off, so this never runs — the component editor commits versions
    // explicitly via "Save version". A resolved promise satisfies the contract.
    save: () => Promise.resolve(true),
    onTreeChange: (next) => {
      setTree(next);
      setDirty(true);
    },
  });

  // Declaring / editing the configurable slots (docs/53 §5, P-D). A propSpec change
  // is a content change too, so it marks the component dirty (saved with the tree).
  const onPropSpecChange = (next: PropSpec[]) => {
    setPropSpec(next);
    setDirty(true);
  };

  // "Make a field" / "Unlink" from a node's settings (docs/53 P-D): binding a
  // node prop to a slot creates the slot (if new) and writes a `{ $prop }` value
  // on the selected node; unbinding clears it back to a literal. Both flow through
  // the editor's onProp (which targets the selected node) + local propSpec state.
  const slotEditor: SlotEditor = {
    onBind: (propKey, propLabel, control) => {
      const key = deriveFieldKey(propLabel, propSpec);
      const kind = control === 'textarea' ? 'richtext' : 'text';
      setPropSpec((prev) =>
        prev.some((s) => s.key === key) ? prev : [...prev, { key, label: propLabel, kind }]
      );
      setDirty(true);
      editor.onProp(propKey, { $prop: key });
    },
    onUnbind: (propKey) => editor.onProp(propKey, ''),
  };

  // Commit a new version: persist tree + propSpec (the service snapshots a new
  // immutable version and bumps latestVersion). Identity (name) is patched in
  // place separately by the rename handler.
  const onSave = async () => {
    setBusy(true);
    editor.setSaveStatus('saving');
    const res = await updateComponent(component.key, { tree, propSpec });
    setBusy(false);
    if (res.ok && res.data) {
      setVersion(res.data.latestVersion);
      setDirty(false);
      editor.setSaveStatus('saved');
    } else {
      editor.setSaveStatus('error');
    }
  };

  // Rename — an identity patch (in place, no new version). Optimistic.
  const onRename = async (next: string) => {
    const trimmed = next.trim();
    if (!trimmed || trimmed === name) return;
    setName(trimmed);
    editor.setSaveStatus('saving');
    const res = await updateComponent(component.key, { name: trimmed });
    editor.setSaveStatus(res.ok ? 'saved' : 'error');
  };

  return (
    <ModuleProvider module="builder">
      <div className="bx-shell">
        <div className="bx-toolbar">
          <div className="bx-toolbar__templates">
            <button
              type="button"
              className="bx-newtpl"
              aria-label="Back to component"
              disabled={busy}
              onClick={() => router.push(`/builder/components/${component.key}`)}
            >
              <ArrowLeft aria-hidden />
            </button>
            <Input
              size="sm"
              className="bx-tplselect"
              value={name}
              aria-label="Component name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              onBlur={() => void onRename(name)}
            />
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
            <span className="bx-savestate" data-state={dirty ? 'idle' : editor.saveStatus}>
              {dirty ? `v${version} · unsaved` : (SAVE_LABEL[editor.saveStatus] ?? `v${version}`)}
            </span>
            <Button
              size="sm"
              variant="solid"
              leftIcon={<Save className="h-3.5 w-3.5" />}
              disabled={busy || !dirty}
              title="Save a new version of this component"
              onClick={() => void onSave()}
            >
              Save version
            </Button>
          </div>
        </div>

        <div className="bx-ctx">
          <span className="bx-ctx__lead">Editing a reusable component</span>
          <span className="bx-ctx__note">
            Saving creates a new version. Pages and layouts that use this component keep their
            pinned version until you upgrade them — so an edit never changes a live page
            unexpectedly.
          </span>
        </div>

        <BuilderWorkspace
          tree={tree}
          editor={editor}
          catalog={bindingCatalog}
          surface={surface}
          slotEditor={slotEditor}
          fields={<PropSpecPanel propSpec={propSpec} tree={tree} onChange={onPropSpecChange} />}
          settings={<ComponentSettings name={name} version={version} />}
        />
      </div>
    </ModuleProvider>
  );
}

// The no-selection panel — a short orientation for the component editor (parity
// with the page/site editors' settings panels).
function ComponentSettings({ name, version }: { name: string; version: number }) {
  return (
    <div className="bx-inspector">
      <header className="bx-ins-head">
        <div className="bx-ins-head__row">
          <h3>{name}</h3>
          <span className="bx-ins-kind">v{version}</span>
        </div>
      </header>
      <section className="bx-grp">
        <h4 className="bx-grp__label">Component</h4>
        <div className="bx-grp__body">
          <p className="bx-grp__caption">
            Compose this component from the blocks on the left. Use the <strong>Fields</strong> tab
            to expose configurable slots each placement can fill, then <strong>Save version</strong>{' '}
            to publish your changes.
          </p>
        </div>
      </section>
      <p className="bx-inspector__tip">Select a layer to edit it.</p>
    </div>
  );
}
