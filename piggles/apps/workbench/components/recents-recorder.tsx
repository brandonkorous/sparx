'use client';

// Records recents — the bridge between the controller (which knows when a
// surface is opened) and the api-rest recents spine (which stores it).
//
// It lives as a mounted-but-invisible component rather than a call inside the
// controller because recording is a REACT concern: it needs the query client
// (to fire the mutation and invalidate the rail's recents list) and the same
// auth'd api client every other hook rides. The controller is a plain class
// with none of that, and deliberately so — giving it a fetch path would be a
// second, divergent way for the app to talk to the server.
//
// The controller emits one visit per interactive foreground open of a
// browsable surface (see WorkbenchController.onVisit); everything about WHICH
// opens count as visits is decided there, so this component only forwards.

import { useEffect, useRef } from 'react';
import { useRecordVisit } from '../lib/api/shell-data';
import { useWorkbench } from '../lib/workbench/context';

export function RecentsRecorder() {
  const { controller } = useWorkbench();
  const record = useRecordVisit();

  // The mutation object is a fresh reference each render; a ref lets the
  // subscription read the latest without re-subscribing on every render (which
  // would tear down and rebuild the listener continuously).
  const recordRef = useRef(record);
  recordRef.current = record;

  useEffect(
    () => controller.onVisit((surfaceKey) => recordRef.current.mutate(surfaceKey)),
    [controller]
  );

  return null;
}
