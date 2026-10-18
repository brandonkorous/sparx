// Next runs this file before the app hydrates, so it is the one place that
// lands ahead of react-dom.
//
// WizeLens: React reports every commit to a global hook that react-dom reads
// once, when it loads. Installing it here times each render per component. Only
// when this page's server traces it; see components/wizelens.tsx.

import { installReactHook } from '@wizeworks/lens-react';
import { serverTraces } from './components/wizelens';

if (serverTraces()) {
  installReactHook();
}
