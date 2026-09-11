/*
 * The looks on the page, and Show more.
 *
 * The first batch is loaded before React mounts (see index.jsx), while the
 * skeleton from Liquid is still on screen, so this starts with looks in hand and
 * only ever loads more — one batch per Show more click (see storefront.js).
 *
 * status is one of:
 *   'error'         the first batch failed, so there is nothing to show
 *   'idle'          looks are shown and more can be loaded
 *   'loading-more'  a further batch is on its way
 *   'error-more'    a further batch failed; Show more is offered again
 *   'done'          every look is shown
 */

import { useState } from 'react';

function initialStatus(firstBatch) {
  if (firstBatch.failed) return 'error';
  return firstBatch.hasMore ? 'idle' : 'done';
}

export default function useLookbookEntries(loader, firstBatch) {
  const [entries, setEntries] = useState(firstBatch.entries);
  const [status, setStatus] = useState(() => initialStatus(firstBatch));

  async function loadMore() {
    setStatus('loading-more');

    try {
      const batch = await loader.next();
      setEntries((current) => [...current, ...batch.entries]);
      setStatus(batch.hasMore ? 'idle' : 'done');
    } catch (error) {
      console.error('[lookbook] could not load more looks from the Storefront API', error);
      setStatus('error-more');
    }
  }

  return { entries, status, loadMore };
}
