import type { Metadata } from 'next';
import { ComingSoon } from '@/components/marketing/coming-soon';

export const metadata: Metadata = {
  title: 'Changelog — sparx',
  description: 'Every release, every breaking change, every deprecation. RSS feed ships with v1.0.',
  alternates: { canonical: '/changelog' },
  robots: { index: false },
};

export default function ChangelogPage() {
  return (
    <ComingSoon
      eyebrow="Platform"
      title="Changelog"
      description="Every release, every breaking change, every deprecation — published the moment it ships. RSS feed and email digest go live with v1.0."
    />
  );
}
