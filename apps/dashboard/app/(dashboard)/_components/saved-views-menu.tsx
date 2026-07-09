'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ListFilter, Star, Trash2 } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  cn,
  useConfirm,
} from '@sparx/ui';

import {
  createSavedViewAction,
  deleteSavedViewAction,
  listSavedViewsAction,
  setDefaultSavedViewAction,
} from '../_shell/saved-views-actions';
import { hasNoViewParams, snapshotParams, viewHref, type SavedView } from '@/lib/saved-views';

// The "Views" control for the shared ListToolbar. A saved view is a named
// snapshot of the list's query params; applying one navigates to `?<params>`.
// `target` (the route path) makes this work on any list with no per-list wiring.
// Auto-applies the default view once when the list opens with no view params.

interface SavedViewsMenuProps {
  target: string;
  /** The query keys that constitute a view (search / filters / sort / view). */
  paramKeys: string[];
}

export function SavedViewsMenu({ target, paramKeys }: SavedViewsMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [open, setOpen] = React.useState(false);
  const autoApplied = React.useRef(false);

  const reload = React.useCallback(() => {
    listSavedViewsAction(target)
      .then(setViews)
      .catch(() => undefined);
  }, [target]);

  React.useEffect(() => reload(), [reload]);

  // Auto-apply the default view once, when the list opens with no view params.
  React.useEffect(() => {
    if (autoApplied.current) return;
    if (!hasNoViewParams(searchParams, paramKeys)) {
      autoApplied.current = true;
      return;
    }
    const def = views.find((v) => v.isDefault);
    if (def && Object.keys(def.config.params).length > 0) {
      autoApplied.current = true;
      router.replace(viewHref(pathname, def.config.params));
    }
  }, [views, searchParams, paramKeys, pathname, router]);

  const apply = (v: SavedView) => {
    setOpen(false);
    router.replace(viewHref(pathname, v.config.params));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter className="h-4 w-4" />
          Views{views.length > 0 ? ` · ${views.length}` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="max-h-64 overflow-auto py-1">
          {views.length === 0 ? (
            <p className="text-muted-foreground px-3 py-2 text-sm">No saved views yet.</p>
          ) : (
            views.map((v) => (
              <ViewRow
                key={v.id}
                view={v}
                onApply={() => apply(v)}
                onDefault={() => setDefaultSavedViewAction(v.id).then(reload)}
                onDeleted={reload}
              />
            ))
          )}
        </div>
        <SaveViewForm
          target={target}
          getParams={() => snapshotParams(searchParams, paramKeys)}
          onSaved={reload}
        />
      </PopoverContent>
    </Popover>
  );
}

function ViewRow({
  view,
  onApply,
  onDefault,
  onDeleted,
}: {
  view: SavedView;
  onApply: () => void;
  onDefault: () => void;
  onDeleted: () => void;
}) {
  const confirm = useConfirm();
  const remove = async () => {
    const ok = await confirm({
      title: `Delete “${view.name}”?`,
      description: 'This removes the saved view for everyone who can see it.',
      confirmLabel: 'Delete view',
      tone: 'danger',
    });
    if (!ok) return;
    await deleteSavedViewAction(view.id);
    onDeleted();
  };

  return (
    <div className="flex items-center gap-1 px-1.5">
      <Button variant="ghost" size="sm" className="min-w-0 flex-1 justify-start" onClick={onApply}>
        <span className="truncate">{view.name}</span>
        {!view.shared && <span className="text-muted-foreground ml-1 text-xs">· private</span>}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        aria-pressed={view.isDefault}
        title={view.isDefault ? 'Default view' : 'Set as default'}
        onClick={onDefault}
      >
        <Star className={cn('h-3.5 w-3.5', view.isDefault && 'text-module fill-current')} />
      </Button>
      <Button variant="ghost" size="xs" title="Delete view" onClick={remove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function SaveViewForm({
  target,
  getParams,
  onSaved,
}: {
  target: string;
  getParams: () => Record<string, string>;
  onSaved: () => void;
}) {
  const [name, setName] = React.useState('');
  const [shared, setShared] = React.useState(false);
  const [isDefault, setIsDefault] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createSavedViewAction({
        target,
        name: name.trim(),
        config: { params: getParams() },
        shared,
        isDefault,
      });
      setName('');
      setShared(false);
      setIsDefault(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 border-t p-2.5">
      <Label className="text-xs">Save current view</Label>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="View name…"
        onKeyDown={(e) => e.key === 'Enter' && void save()}
      />
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor="sv-shared" className="text-muted-foreground font-normal">
          Share with team
        </Label>
        <Switch id="sv-shared" checked={shared} onCheckedChange={setShared} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor="sv-default" className="text-muted-foreground font-normal">
          Set as default
        </Label>
        <Switch id="sv-default" checked={isDefault} onCheckedChange={setIsDefault} />
      </div>
      <Button size="sm" className="w-full" disabled={!name.trim() || saving} onClick={save}>
        Save view
      </Button>
    </div>
  );
}
