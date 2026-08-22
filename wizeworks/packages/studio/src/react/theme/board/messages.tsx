'use client';

// What the site says when something happened.
//
// These four are the reason the meaning colors exist. Seen together, a theme
// whose "went wrong" reads as calmly as its "went through" is obvious in a second
// — which it never is when they are looked at one at a time.

import { Alert, AlertDescription, AlertTitle, EmptyState } from '@wizeworks/silicaui-react';
import { BoardTile } from './tile';

export function MessagesTile() {
  return (
    <BoardTile
      title="What your site tells people"
      hint="People read these by color before they read the words."
    >
      <Alert color="success" variant="soft">
        <AlertTitle>Order confirmed</AlertTitle>
        <AlertDescription>We will have it ready by eight.</AlertDescription>
      </Alert>

      <Alert color="warning">
        <AlertTitle>Only two left</AlertTitle>
        <AlertDescription>Order today and we will hold one for you.</AlertDescription>
      </Alert>

      <Alert color="error">
        <AlertTitle>That card was declined</AlertTitle>
        <AlertDescription>Try another, or pay when you collect.</AlertDescription>
      </Alert>

      <Alert color="info">
        <AlertTitle>Closed on Monday</AlertTitle>
        <AlertDescription>Back at six on Tuesday morning.</AlertDescription>
      </Alert>

      <Alert color="error">
        <AlertTitle>The same message, at full weight</AlertTitle>
        <AlertDescription>Solid fills need ink that still reads.</AlertDescription>
      </Alert>

      <EmptyState
        title="Nothing here yet"
        description="Empty screens are most of a new site. This is what yours looks like."
      />
    </BoardTile>
  );
}
