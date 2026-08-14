// Mounted, not reimplemented — see ./token/route.ts, including why the segment
// config is declared here rather than re-exported.
//
// Reports the release this pod is serving, so a tab left open across a deploy
// can notice and offer to reload. The value is stamped into the image at build
// time; the client compares it against the version baked into its own bundle.
// Never cached: during a rolling deploy the answer changes pod to pod.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export { GET } from '@workbench/app/api/version/route';
