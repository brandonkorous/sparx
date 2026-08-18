'use client';

// A zero-render client island the PDP mounts to record the product into the
// guest's recently-viewed history (localStorage). Kept tiny and side-effect-only
// so the PDP itself stays a server component.

import { useEffect } from 'react';

import { recordView } from '@/lib/recently-viewed-client';

export function RecordView({ slug }: { slug: string }) {
  useEffect(() => {
    recordView(slug);
  }, [slug]);
  return null;
}
