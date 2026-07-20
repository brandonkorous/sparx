// The declared vocabulary, as data.
//
// A MIRROR of the `@source inline(...)` patterns in `builder-vocabulary.css`, which is
// the file Tailwind actually reads. It is duplicated here rather than parsed because
// this module ships to the BROWSER (the studio validates as an author types) and a
// runtime `fs` read would not survive the bundle.
//
// Duplication without drift: `vocabulary-patterns.test.ts` reads the real CSS and fails
// if the two ever disagree, so the copy cannot rot silently — which is the same class of
// bug the vocabulary itself exists to prevent.

export const VOCABULARY_PATTERNS: readonly string[] = [
  '{sm:,md:,lg:,xl:,2xl:,}grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12}',
  '{@sm:,@md:,@lg:,@xl:,@2xl:,@3xl:,@4xl:,}grid-cols-{1,2,3,4,5,6,7,8,9,10,11,12}',
  '{sm:,md:,lg:,xl:,2xl:,}col-span-{1,2,3,4,5,6,7,8,9,10,11,12,full}',
  '{@sm:,@md:,@lg:,@xl:,@2xl:,@3xl:,@4xl:,}col-span-{1,2,3,4,5,6,7,8,9,10,11,12,full}',
  '{sm:,md:,lg:,xl:,}grid-rows-{1,2,3,4,5,6}',
  '{sm:,md:,lg:,xl:,}row-span-{1,2,3,4,5,6,full}',
  '{sm:,md:,lg:,xl:,}col-start-{1,2,3,4,5,6,7,8,9,10,11,12,13}',
  '{sm:,md:,lg:,xl:,}col-end-{1,2,3,4,5,6,7,8,9,10,11,12,13}',
  '{sm:,md:,lg:,xl:,}row-start-{1,2,3,4,5,6,7}',
  '{sm:,md:,lg:,xl:,}row-end-{1,2,3,4,5,6,7}',
  '{sm:,md:,lg:,xl:,}flex-{1,auto,initial,none}',
  '{sm:,md:,lg:,xl:,}{flex-row,flex-col,flex-wrap,flex-nowrap,flex-row-reverse,flex-col-reverse}',
  '{sm:,md:,lg:,xl:,}order-{1,2,3,4,5,6,first,last,none}',
  'max-w-{xs,sm,md,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,full,none,prose}',
  '{sm:,md:,lg:,xl:,}text-{xs,sm,base,lg,xl,2xl,3xl,4xl,5xl,6xl,7xl,8xl,9xl}',
  '{sm:,md:,lg:,xl:,}font-{thin,extralight,light,normal,medium,semibold,bold,extrabold,black}',
  '{sm:,md:,lg:,xl:,}tracking-{tighter,tight,normal,wide,wider,widest}',
  '{sm:,md:,lg:,xl:,}leading-{none,tight,snug,normal,relaxed,loose}',
  'bg-{primary,secondary,accent,neutral,base-100,base-200,base-300,info,success,warning,error}',
  'text-{primary,secondary,accent,neutral,base-content,primary-content,secondary-content,accent-content,neutral-content,info,success,warning,error}',
  'border-{primary,secondary,accent,neutral,base-200,base-300}',
  '{border,divide}-{base-content,primary-content,neutral-content,accent-content}/{10,20,30}',
  '{sm:,md:,lg:,xl:,}{p,px,py,pt,pb,pl,pr}-{0,1,2,3,4,5,6,8,10,12,14,16,20,24,28,32,40,48}',
  '{sm:,md:,lg:,xl:,}{gap,gap-x,gap-y}-{0,1,2,3,4,5,6,8,10,12,14,16,20,24}',
  '{sm:,md:,lg:,xl:,}{mt,mb,mx,my}-{0,1,2,3,4,5,6,8,10,12,16,20,24,auto}',
];
