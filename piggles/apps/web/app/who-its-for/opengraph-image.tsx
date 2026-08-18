import { OG_SIZE, renderOg } from '@piggles/brand/og';
import { MASCOT_POSES } from '@piggles/mascot';

export const runtime = 'nodejs';
export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Who Piggles is for — a bakery, a barber, a potter, a garage';

export default function Image() {
  return renderOg({
    title: 'A bakery, a barber, a potter, a garage.',
    subtitle:
      'What is different about running each of them, and which of the fifteen apps that shape leans on.',
    // One trade has to stand for all of them on a card. The market stall is the
    // least specialised of the eleven — nobody reads it as "this is for retail".
    pose: MASCOT_POSES['market-stall'],
  });
}
