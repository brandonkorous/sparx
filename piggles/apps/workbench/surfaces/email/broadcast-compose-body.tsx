'use client';

// The composer's form, in the order an owner thinks about it: what it says, who
// gets it, which design carries it, what that looks like, who it comes from,
// and when it goes.

import { TheEmail, WhatYoureSending, WhoItGoesTo } from './broadcast-compose-message';
import { WhatItLooksLike, WhenToSend, WhereItComesFrom } from './broadcast-compose-delivery';
import type { ComposeBodyProps } from './broadcast-draft';

export function BroadcastComposeBody(props: ComposeBodyProps) {
  return (
    <>
      <TheEmail {...props} />
      <WhoItGoesTo {...props} />
      <WhatYoureSending {...props} />
      <WhatItLooksLike {...props} />
      <WhereItComesFrom {...props} />
      <WhenToSend {...props} />
    </>
  );
}
