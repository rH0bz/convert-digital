/*
 * State for the looks on the page and the Show more button. Starts with the first
 * batch (loaded by index.jsx) and loads one more batch per click.
 *
 * status: 'error' (first batch failed), 'idle' (more to load), 'loading-more',
 * 'error-more' (a later batch failed; Show more is offered again) or 'done'.
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
