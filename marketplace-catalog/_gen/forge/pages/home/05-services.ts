// Forge home · 05 What we do — a heading + blurb intro over the four disciplines as
// numbered, divide-ruled rows (each title lights acid on hover). Tracks the mockup.

import { SERVICES } from '../../data';
import { band, sectionIntro, serviceList, serviceRow } from '../../sections';
import { type BuilderNode } from '../../_kit';

export function services(): BuilderNode {
  return band({
    name: 'What we do',
    gap: 'lg',
    children: [
      sectionIntro(
        'What we do',
        'A full-service studio built around three disciplines that compound — strategy that informs design, design that drives growth.'
      ),
      serviceList(SERVICES.map((s) => serviceRow(s.num, s.title, s.desc))),
    ],
  });
}
