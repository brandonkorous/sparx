import type { Metadata } from 'next';
import { BrandHero } from '@/components/marketing/brand/brand-hero';
import { WordmarkSection } from '@/components/marketing/brand/wordmark-section';
import { MonogramSection } from '@/components/marketing/brand/monogram-section';
import { MascotSection } from '@/components/marketing/brand/mascot-section';
import { MisuseSection } from '@/components/marketing/brand/misuse-section';
import { PrimaryColorSection } from '@/components/marketing/brand/primary-color-section';
import { ModulesSection } from '@/components/marketing/brand/modules-section';
import { PaletteSection } from '@/components/marketing/brand/palette-section';
import { TypeSection } from '@/components/marketing/brand/type-section';
import { PrinciplesSection } from '@/components/marketing/brand/principles-section';
import { VoiceSection } from '@/components/marketing/brand/voice-section';
import { NotSection } from '@/components/marketing/brand/not-section';
import { DownloadsSection } from '@/components/marketing/brand/downloads-section';

export const metadata: Metadata = {
  title: 'Brand — sparx',
  description:
    'The sparx brand system: the lowercase wordmark (the “x” is always sparx Ember), the spark mark, sparky the mascot, the module color system, the Geist type scale, the voice, and the usage rules — plus press-ready logo downloads.',
  alternates: { canonical: '/brand' },
  openGraph: {
    title: 'Brand — sparx',
    description:
      'The sparx wordmark, color system, type scale, voice, and usage rules. Press-ready logo assets included.',
    url: 'https://sparx.works/brand',
    type: 'website',
  },
};

export default function BrandPage() {
  return (
    <main>
      <BrandHero />
      <WordmarkSection />
      <MonogramSection />
      <MascotSection />
      <MisuseSection />
      <PrimaryColorSection />
      <ModulesSection />
      <PaletteSection />
      <TypeSection />
      <PrinciplesSection />
      <VoiceSection />
      <NotSection />
      <DownloadsSection />
    </main>
  );
}
