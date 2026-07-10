'use client';

import * as React from 'react';
import { Download, ChevronDown } from 'lucide-react';
import { Button } from '../primitives/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../overlay/dropdown-menu';
import { cn } from '../../utils/cn';

// ExportButton — dropdown trigger for CSV export (docs/68 §8).
//
// When `selectedCount` > 0, a "Export selected" option is shown in addition
// to "Export all". The `onExport` callback receives the mode ('all' or
// 'selected'); the caller is responsible for constructing the URL and
// triggering the download.
//
// Usage:
//   <ExportButton
//     selectedCount={selected.length}
//     onExport={(mode) => {
//       if (mode === 'selected') window.location.href = `/api/export/products?ids=${selected.join(',')}`;
//       else window.location.href = '/api/export/products';
//     }}
//   />

export interface ExportButtonProps {
  selectedCount?: number;
  onExport: (mode: 'all' | 'selected') => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** Render as an icon-only square button (no label text) — for dense
   *  toolbars. The dropdown's "Export all" / "Export selected" item labels
   *  stay full text either way. */
  iconOnly?: boolean;
}

export function ExportButton({
  selectedCount = 0,
  onExport,
  disabled,
  className,
  label = 'Export',
  iconOnly = false,
}: ExportButtonProps) {
  const hasSelection = selectedCount > 0;

  if (!hasSelection) {
    return (
      <Button
        variant="outline"
        size="sm"
        shape={iconOnly ? 'square' : undefined}
        leftIcon={iconOnly ? undefined : <Download className="h-4 w-4" />}
        aria-label={iconOnly ? label : undefined}
        disabled={disabled}
        className={className}
        onClick={() => onExport('all')}
      >
        {iconOnly ? <Download className="h-4 w-4" /> : label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          leftIcon={iconOnly ? undefined : <Download className="h-4 w-4" />}
          rightIcon={iconOnly ? undefined : <ChevronDown className="h-3.5 w-3.5" />}
          aria-label={iconOnly ? label : undefined}
          disabled={disabled}
          className={cn(!iconOnly && 'gap-1', className)}
        >
          {iconOnly ? <Download className="h-4 w-4" /> : label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onExport('all')}>Export all</DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onExport('selected')}>
          Export selected ({selectedCount})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
