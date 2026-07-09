'use client';

// Visual image framing — Fill/Fit, a draggable focal point, and zoom, edited
// against a live crop preview. Launched from any media field that opts in via
// `mediaField(..., { fitKey, focalKey, zoomKey })`. The same control serves
// every image in the builder, so framing is consistent everywhere. On Apply it
// writes the three sibling config keys back through `onApply`.

import * as React from 'react';
import { Button, Modal, ModalContent, ModalHeader, ModalTitle, Slider } from '@sparx/ui';

export interface Framing {
  fit: 'cover' | 'contain';
  focal: { x: number; y: number };
  zoom: number;
}

export function ImageFramingModal({
  open,
  onOpenChange,
  src,
  initial,
  showZoom = true,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string | null;
  initial: Framing;
  // Zoom only applies where the image renders on its own layer (e.g. the hero);
  // sections that draw the image as a background behind content hide it.
  showZoom?: boolean;
  onApply: (framing: Framing) => void;
}) {
  const [fit, setFit] = React.useState<Framing['fit']>(initial.fit);
  const [focal, setFocal] = React.useState(initial.focal);
  const [zoom, setZoom] = React.useState(initial.zoom);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  // Re-seed from the latest stored values each time the modal is opened.
  React.useEffect(() => {
    if (open) {
      setFit(initial.fit);
      setFocal(initial.focal);
      setZoom(initial.zoom);
    }
    // Only re-seed on open transitions, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setFromPointer = (clientX: number, clientY: number) => {
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100));
    setFocal({ x: Math.round(x), y: Math.round(y) });
  };

  const position = `${focal.x}% ${focal.y}%`;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Adjust framing</ModalTitle>
        </ModalHeader>

        {src ? (
          <div className="flex flex-col gap-4">
            <div
              ref={boxRef}
              className="border-base-300 bg-base-200 relative aspect-video w-full cursor-crosshair touch-none overflow-hidden rounded-md border select-none"
              onPointerDown={(e) => {
                dragging.current = true;
                try {
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                } catch {
                  // setPointerCapture throws for an inactive pointer id — ignore;
                  // dragging still works via the move handler.
                }
                setFromPointer(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (dragging.current) setFromPointer(e.clientX, e.clientY);
              }}
              onPointerUp={() => (dragging.current = false)}
            >
              <img
                src={src}
                alt=""
                className="pointer-events-none h-full w-full"
                style={{
                  objectFit: fit,
                  objectPosition: position,
                  transform: zoom > 1 ? `scale(${zoom})` : undefined,
                  transformOrigin: position,
                }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.55)]"
                style={{ left: `${focal.x}%`, top: `${focal.y}%` }}
              />
            </div>
            <p className="text-base-content/60 text-xs">
              Click or drag on the image to set the focal point — the part kept in view when it’s
              cropped.
            </p>

            <div className="flex flex-col gap-1.5">
              <span className="text-base-content text-sm font-medium">Fit</span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={fit === 'cover' ? 'solid' : 'outline'}
                  onClick={() => setFit('cover')}
                >
                  Fill
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={fit === 'contain' ? 'solid' : 'outline'}
                  onClick={() => setFit('contain')}
                >
                  Fit whole image
                </Button>
              </div>
            </div>

            {showZoom ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-base-content text-sm font-medium">Zoom</span>
                  <span className="text-base-content/60 text-xs tabular-nums">
                    {zoom.toFixed(1)}×
                  </span>
                </div>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.1}
                  onValueChange={(v) => setZoom(v[0] ?? 1)}
                  aria-label="Zoom"
                />
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => {
                  onApply({ fit, focal, zoom });
                  onOpenChange(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-base-content/60 text-sm">
            Choose an image first, then you can frame it here.
          </p>
        )}
      </ModalContent>
    </Modal>
  );
}
